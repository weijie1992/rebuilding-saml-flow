# SAML 2.0 Learning Lab

A local, fully working SAML 2.0 single sign-on setup in TypeScript — the same
shape as logging into Workday with your company account — built so you can
read every step.

| Component | URL | What it is |
| --- | --- | --- |
| **SP** (Service Provider) | http://localhost:3000 | "Acme App": a React SPA + its Node backend (`sp-api`). The backend speaks SAML; the SPA never does. |
| **IdP** (Identity Provider) | http://127.0.0.1:4000 | "Corp IdP": its own login page, user database, SSO session and signing key. |
| **Browser** | — | Your real browser. It carries every SAML message; the two backends never call each other. |

## Quick start

```sh
docker compose up --build
```

Seeded IdP users (**lab only — never reuse this password anywhere**):

| Email | Password | Groups |
| --- | --- | --- |
| `alice@corp.test` | `password123` | Finance, Employees |
| `bob@corp.test` | `password123` | Engineering, Employees |

Reset everything (databases included): `docker compose down -v`.
Delete `shared/keys/*` too if you want a fresh IdP signing key.

## Why two different hostnames?

Cookies are scoped by **host, not port**. If both apps lived on `localhost`,
the SP's `sp_sid` and the IdP's `idp_sid` cookies would be sent to both and
could collide. Using `localhost` for the SP and `127.0.0.1` for the IdP keeps
them apart — and makes the login genuinely **cross-site**, as in production.

These browser-facing URLs (`SP_BASE_URL`, `IDP_BASE_URL`) are what go inside
signed XML and metadata, so containers are configured with them — never with
Docker-internal names like `http://idp:4000`.

---

## Phase 1 — Infrastructure ✅

What exists now:

- `docker-compose.yml` with `keygen`, `idp-db`, `idp`, `sp-db`, `sp-api`.
- **keygen** (`scripts/gen-keys.sh`): one-shot job that creates the IdP's
  RSA-2048 signing key and self-signed cert in `shared/keys/` if missing. The
  apps wait for it to finish. Self-signed is normal in SAML: the SP will trust
  this cert because it appears in the IdP's *metadata*, not because of a CA.
- **Both databases** with healthchecks; the apps start only once Postgres is ready.
- **Migrations with Prisma Migrate** (`idp/prisma/`, `sp/api/prisma/`) —
  applied by `prisma migrate deploy` when each container starts.
- **Seed** (`idp/src/db/seed.ts`): alice and bob, argon2id password hashes,
  idempotent on every start.
- **Health endpoints**: `GET /healthz` on both apps.
- **SPA shell** (`sp/web`): `/` (login button), `/dashboard` (calls
  `/api/me`), `/debug` (placeholder). SAML routes return *501 Not built yet*.

### Verify it manually

1. `docker compose up --build`, then `docker compose ps -a`: `keygen` exited
   (0), the other four running.
2. http://127.0.0.1:4000/healthz → `"db":"ok","signingKeyPresent":true`
3. http://localhost:3000/healthz → `"db":"ok"` plus the SP entityID and ACS URL.
4. http://localhost:3000 → the Acme App home page. The SSO button does a
   full-page navigation to `/saml/login` (a "not built yet" page for now).
5. http://localhost:3000/dashboard → "You are not logged in" (`/api/me` → 401).
6. Look inside the databases — with any Postgres client (TablePlus, DBeaver,
   pgAdmin, `psql`), using the connection strings below, or via `docker compose exec`:
   ```
   IdP: postgres://idp:idp@localhost:5433/idp
   SP:  postgres://sp:sp@localhost:5434/sp
   ```
   ```sh
   docker compose exec idp-db psql -U idp -d idp -c 'select email, display_name from users'
   docker compose exec idp-db psql -U idp -d idp -c 'select * from audit_log'
   docker compose exec sp-db  psql -U sp  -d sp  -c '\dt'
   ```
7. `docker compose restart idp sp-api` → logs say *No pending migrations to
   apply*, and no duplicate users appear.

### Database schema and migrations (Prisma)

Prisma is used **only** for schema and migrations. App code queries with
plain `pg` and hand-written SQL, so every query stays visible.

- Schema: `idp/prisma/schema.prisma`, `sp/api/prisma/schema.prisma`
  (models map to snake_case tables, e.g. `@@map("users")`).
- Migrations: `prisma/migrations/<timestamp>_<name>/migration.sql` — plain
  SQL you can read.
- Containers run `prisma migrate deploy` on start (see each `Dockerfile`),
  which applies pending migrations and records them in `_prisma_migrations`.

To change the schema: edit `schema.prisma`, then generate a new migration
against a dev database (Prisma also needs to create a temporary shadow DB):

```sh
cd idp   # or sp/api
DATABASE_URL=postgres://idp:idp@localhost:5433/idp npm run db:migrate:new -- add_something
# SP: DATABASE_URL=postgres://sp:sp@localhost:5434/sp
```

Or skip the database entirely and generate the SQL offline:

```sh
npx prisma migrate diff --from-migrations prisma/migrations \
  --to-schema prisma/schema.prisma --script
```

### Behind a TLS-inspecting proxy (Cloudflare Gateway, Zscaler, …)

Prisma downloads its native schema engine from `binaries.prisma.sh` while the
**image is built** (never at container start). If your network intercepts TLS,
that download fails with `self-signed certificate in certificate chain`. Put
your proxy's root CA, PEM-encoded with a `.crt` extension, in `shared/certs/`
and rebuild. Every `*.crt` there is trusted by the app images. The folder is
gitignored, and an empty folder changes nothing.

---

## Phase 2 — IdP basics ✅

The IdP can now sign people in. There's still no SAML: this phase builds the
part of an IdP that exists *before* any SP is involved.

| Piece | File | What to notice |
| --- | --- | --- |
| Password check | `idp/src/auth/password.ts` | argon2id verify; an unknown email still runs a dummy verify, so timing doesn't reveal which accounts exist |
| SSO session | `idp/src/auth/sso-session.ts` | 256-bit random id stored in `sso_sessions` and in the `idp_sid` cookie (HttpOnly, SameSite=Lax, 8 h). `authn_instant` becomes the Assertion's `AuthnInstant` in phase 4 |
| Login CSRF | `idp/src/auth/csrf.ts` | Double-submit cookie: the token sits in the `idp_csrf` cookie *and* in a hidden form field, and they must match |
| Routes | `idp/src/routes/login.ts`, `routes/apps.ts` | `continueAfterLogin()` is where phase 4 will resume a pending AuthnRequest |
| Views | `idp/src/views/*.ts` | Plain server-rendered HTML; every dynamic value goes through `escapeHtml()` |

Security details worth reading in the code: one generic "Incorrect email or
password" message (the precise reason only goes to `audit_log`), a fresh
session id on every login (session-fixation defence), and a new CSRF token on
every form render.

### Verify it manually

1. `docker compose up -d --build idp`
2. Open http://127.0.0.1:4000 → redirected to `/apps` → redirected to `/login`.
3. Sign in as `alice@corp.test` / `password123` → the portal shows *Hello,
   Alice Anderson*, groups *Employees, Finance*, and "No apps registered yet"
   (SPs arrive in phase 3).
4. DevTools → Application → Cookies → `http://127.0.0.1:4000`: `idp_sid` is
   HttpOnly, SameSite=Lax. Then open http://localhost:3000 and look at its
   cookies: no `idp_sid`. Different host, different cookie jar.
5. Visit `/login` again: you skip straight to `/apps`. That's the SSO session
   at work, and in phase 4 it's what lets a second SP log you in without a
   password.
6. Try a wrong password, then an unknown email. The page says the same thing
   for both; the audit log doesn't:
   ```sh
   docker compose exec idp-db psql -U idp -d idp -c \
     "select ts, event, details from audit_log where event like 'log%' order by id"
   ```
7. **Sign out of the IdP** → back on `/login` with a notice, the
   `sso_sessions` row is gone, and `/apps` redirects to `/login` again.
8. CSRF: in DevTools, delete the `idp_csrf` cookie and submit the form →
   *"Your sign-in form expired"* (403) and a `login.csrf_rejected` audit row.

---

*Coming next:* Phase 3 — both sides generate SAML metadata, an export script
writes it to `shared/metadata`, and each side loads the other's.
