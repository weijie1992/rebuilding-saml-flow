// IdP (Identity Provider) entry point.
//
// Phase 1: seed users, expose /healthz.
// Phase 2: login page, SSO session cookie, /apps portal.
// Phase 3: IdP metadata at /metadata; SP registered from its metadata file.
// SAML endpoints (/sso, /slo) arrive in phase 4+.
//
// Schema migrations are NOT run here: the container runs
// `prisma migrate deploy` before starting this process (see Dockerfile).

import express, { type ErrorRequestHandler } from "express";
import cookieParser from "cookie-parser";
import { config } from "./config.ts";
import { pool } from "./db/pool.ts";
import { seed } from "./db/seed.ts";
import { audit } from "./db/audit.ts";
import { loadSigningCertificate } from "./saml/keys.ts";
import { buildIdpMetadata } from "./saml/metadata.ts";
import { registerServiceProviders } from "./saml/sp-registry.ts";
import { loginRouter } from "./routes/login.ts";
import { appsRouter } from "./routes/apps.ts";
import { metadataRouter } from "./routes/metadata.ts";
import { errorView } from "./views/error.ts";

async function main(): Promise<void> {
  await seed(pool);

  // Fail fast: an IdP without a valid signing certificate can't do SAML.
  const cert = loadSigningCertificate();
  const metadataXml = buildIdpMetadata({ entityId: config.entityId, baseUrl: config.baseUrl, cert });
  console.log(`idp: signing cert SHA-256 ${cert.fingerprint256}, valid to ${cert.validTo}`);

  await registerServiceProviders(pool);

  const app = express();
  app.use(cookieParser());
  // HTML forms post application/x-www-form-urlencoded.
  app.use(express.urlencoded({ extended: false, limit: "20kb" }));

  // Liveness + readiness: database reachable, and which SPs are trusted.
  app.get("/healthz", async (_req, res) => {
    try {
      const sps = await pool.query<{ entity_id: string }>("SELECT entity_id FROM service_providers");
      res.json({
        status: "ok",
        service: "idp",
        db: "ok",
        entityId: config.entityId,
        signingCertSha256: cert.fingerprint256,
        registeredSps: sps.rows.map((r) => r.entity_id),
      });
    } catch {
      res.status(503).json({ status: "error", service: "idp", db: "unreachable" });
    }
  });

  // The IdP has no home page of its own: send people to their portal, which
  // redirects to /login if they aren't signed in.
  app.get("/", (_req, res) => res.redirect(303, "/apps"));

  app.use(metadataRouter(metadataXml));
  app.use(loginRouter);
  app.use(appsRouter);

  // Express 5 forwards errors thrown in async handlers here. Log the detail,
  // show the browser a generic page.
  const onError: ErrorRequestHandler = (err, req, res, _next) => {
    console.error(`idp: ${req.method} ${req.path} failed`, err);
    res.status(500).type("html").send(errorView("The identity provider hit an unexpected error."));
  };
  app.use(onError);

  await audit(pool, "idp.started", { baseUrl: config.baseUrl, entityId: config.entityId });
  app.listen(config.port, () => {
    console.log(`idp: listening on :${config.port}, public URL ${config.baseUrl}`);
  });
}

main().catch((err: unknown) => {
  console.error("idp: failed to start", err);
  process.exit(1);
});
