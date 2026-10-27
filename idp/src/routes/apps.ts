// GET /apps — the IdP portal: tiles for every SP this IdP trusts.
// (Launching a tile = IdP-initiated SSO, phase 5.)

import { Router } from "express";
import { getSsoSession } from "../auth/sso-session.ts";
import { pool } from "../db/pool.ts";
import { appsView, type AppTile } from "../views/apps.ts";

export const appsRouter = Router();

appsRouter.get("/apps", async (req, res) => {
  const session = await getSsoSession(req);
  if (!session) return res.redirect(303, "/login");

  const apps = await pool.query<AppTile>(
    `SELECT entity_id AS "entityId", display_name AS "displayName"
       FROM service_providers ORDER BY display_name`,
  );
  res.type("html").send(appsView(session, apps.rows));
});
