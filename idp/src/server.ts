// IdP (Identity Provider) entry point.
//
// Phase 1: seed users, expose /healthz.
// Phase 2: login page, SSO session cookie, /apps portal (no SAML yet).
// Metadata (phase 3) and SAML endpoints (phase 4+) come later.
//
// Schema migrations are NOT run here: the container runs
// `prisma migrate deploy` before starting this process (see Dockerfile).

import { existsSync } from "node:fs";
import path from "node:path";
import express, { type ErrorRequestHandler } from "express";
import cookieParser from "cookie-parser";
import { config } from "./config.ts";
import { pool } from "./db/pool.ts";
import { seed } from "./db/seed.ts";
import { audit } from "./db/audit.ts";
import { loginRouter } from "./routes/login.ts";
import { appsRouter } from "./routes/apps.ts";
import { errorView } from "./views/error.ts";

const app = express();
app.use(cookieParser());
// HTML forms post application/x-www-form-urlencoded.
app.use(express.urlencoded({ extended: false, limit: "20kb" }));

// Liveness + readiness in one: is the database reachable, and is the signing
// key (which keygen should have generated) actually mounted?
app.get("/healthz", async (_req, res) => {
  const signingKeyPresent =
    existsSync(path.join(config.keysDir, "idp.key")) &&
    existsSync(path.join(config.keysDir, "idp.crt"));
  try {
    await pool.query("SELECT 1");
    res.json({ status: "ok", service: "idp", db: "ok", signingKeyPresent, entityId: config.entityId });
  } catch (err) {
    res.status(503).json({ status: "error", service: "idp", db: "unreachable", signingKeyPresent });
  }
});

// The IdP has no home page of its own: send people to their portal, which
// redirects to /login if they aren't signed in.
app.get("/", (_req, res) => res.redirect(303, "/apps"));

app.use(loginRouter);
app.use(appsRouter);

// Express 5 forwards errors thrown in async handlers here. Log the detail,
// show the browser a generic page.
const onError: ErrorRequestHandler = (err, req, res, _next) => {
  console.error(`idp: ${req.method} ${req.path} failed`, err);
  res.status(500).type("html").send(errorView("The identity provider hit an unexpected error."));
};
app.use(onError);

async function main(): Promise<void> {
  await seed(pool);
  await audit(pool, "idp.started", { baseUrl: config.baseUrl, entityId: config.entityId });

  app.listen(config.port, () => {
    console.log(`idp: listening on :${config.port}, public URL ${config.baseUrl}`);
  });
}

main().catch((err: unknown) => {
  console.error("idp: failed to start", err);
  process.exit(1);
});
