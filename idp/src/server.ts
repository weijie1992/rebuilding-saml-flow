// IdP (Identity Provider) entry point.
//
// Phase 1: infrastructure only — seed users, expose /healthz.
// Login (phase 2), metadata (phase 3) and SAML endpoints (phase 4+) come later.
//
// Schema migrations are NOT run here: the container runs
// `prisma migrate deploy` before starting this process (see Dockerfile).

import { existsSync } from "node:fs";
import path from "node:path";
import express from "express";
import { config } from "./config.ts";
import { pool } from "./db/pool.ts";
import { seed } from "./db/seed.ts";
import { audit } from "./db/audit.ts";

const app = express();

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

app.get("/", (_req, res) => {
  res.type("html").send(`<!doctype html>
<html lang="en">
<head><meta charset="utf-8"><title>Corp IdP</title></head>
<body style="font-family: system-ui, sans-serif; max-width: 40rem; margin: 3rem auto; padding: 0 1rem;">
  <h1>Corp Identity Provider</h1>
  <p>Phase 1: infrastructure is up. The login page arrives in phase 2.</p>
  <p>Entity ID: <code>${config.entityId}</code></p>
  <p><a href="/healthz">/healthz</a></p>
</body>
</html>`);
});

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
