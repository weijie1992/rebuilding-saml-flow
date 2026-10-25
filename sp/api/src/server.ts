// SP (Service Provider) backend entry point.
//
// One origin (http://localhost:3000) serves both the React SPA and the API.
// The SPA never speaks SAML; only this backend does.
//
// Phase 1: /healthz, /api/me, local logout, and the SPA shell.
//
// Schema migrations are NOT run here: the container runs
// `prisma migrate deploy` before starting this process (see api/Dockerfile).

import path from "node:path";
import express from "express";
import cookieParser from "cookie-parser";
import { config } from "./config.ts";
import { pool } from "./db/pool.ts";
import { audit } from "./db/audit.ts";
import { apiRouter } from "./routes/api.ts";
import { samlRouter } from "./routes/saml.ts";

const app = express();
app.use(cookieParser());

app.get("/healthz", async (_req, res) => {
  try {
    await pool.query("SELECT 1");
    res.json({ status: "ok", service: "sp-api", db: "ok", entityId: config.entityId, acsUrl: config.acsUrl });
  } catch {
    res.status(503).json({ status: "error", service: "sp-api", db: "unreachable" });
  }
});

app.use("/api", express.json(), apiRouter);
app.use("/saml", samlRouter);

// Unknown /api or /saml paths: a real 404, not the SPA's index.html.
app.use(["/api", "/saml"], (_req, res) => {
  res.status(404).json({ error: "not_found" });
});

// --- The React SPA ---
// Static assets first, then any other GET falls back to index.html so React
// Router can handle client-side routes like /dashboard and /debug.
const webDist = path.resolve(config.webDist);
app.use(express.static(webDist, { index: false }));
app.use((req, res, next) => {
  if (req.method !== "GET") return next();
  res.sendFile(path.join(webDist, "index.html"));
});

async function main(): Promise<void> {
  await audit(pool, "sp.started", { baseUrl: config.baseUrl, entityId: config.entityId });

  app.listen(config.port, () => {
    console.log(`sp-api: listening on :${config.port}, public URL ${config.baseUrl}`);
  });
}

main().catch((err: unknown) => {
  console.error("sp-api: failed to start", err);
  process.exit(1);
});
