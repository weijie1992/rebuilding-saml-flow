// JSON API used by the React SPA. Same origin as the SPA, so the browser
// sends the sp_sid cookie automatically — no tokens, no CORS.

import { Router } from "express";
import { config } from "../config.ts";
import { audit } from "../db/audit.ts";
import { pool } from "../db/pool.ts";
import { destroySession, getSessionUser } from "../session.ts";

export const apiRouter = Router();

// GET /api/me — the current user, or 401.
apiRouter.get("/me", async (req, res) => {
  const user = await getSessionUser(req);
  if (!user) {
    res.status(401).json({ error: "not_authenticated" });
    return;
  }
  res.json(user);
});

// POST /api/logout — local logout only: ends the SP session but leaves the
// IdP's SSO session alive, so the next login won't ask for a password.
// (Single Logout, which ends both, is phase 6.)
apiRouter.post("/logout", async (req, res) => {
  const user = await getSessionUser(req);
  if (user) {
    await destroySession(user.sessionId);
    await audit(pool, "session.local_logout", { userId: user.userId });
  }
  res.clearCookie(config.sessionCookieName, { path: "/" });
  res.status(204).end();
});

// GET /api/config — lets the SPA know which lab features are switched on.
apiRouter.get("/config", (_req, res) => {
  res.json({ labDebug: config.labDebug, allowIdpInitiated: config.allowIdpInitiated });
});
