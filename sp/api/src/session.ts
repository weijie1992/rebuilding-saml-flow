// SP session handling. This is ordinary web-app session code, not SAML: once
// the ACS has validated an Assertion (phase 4), the SP forgets about SAML and
// tracks the user with its own cookie, sp_sid.

import type { Request } from "express";
import { pool } from "./db/pool.ts";
import { config } from "./config.ts";

export interface SessionUser {
  sessionId: string;
  sessionExpiresAt: string;
  sessionIndex: string | null;
  userId: string;
  idpEntityId: string;
  nameId: string;
  email: string | null;
  displayName: string | null;
  groups: string[];
}

/** Look up the logged-in user from the sp_sid cookie, or null. */
export async function getSessionUser(req: Request): Promise<SessionUser | null> {
  const sid: unknown = req.cookies?.[config.sessionCookieName];
  if (typeof sid !== "string" || sid.length === 0) return null;

  const result = await pool.query(
    `SELECT s.id AS session_id, s.expires_at, s.session_index,
            u.id AS user_id, u.idp_entity_id, u.name_id, u.email, u.display_name, u.groups
       FROM sessions s JOIN users u ON u.id = s.user_id
      WHERE s.id = $1 AND s.expires_at > now()`,
    [sid],
  );
  const row = result.rows[0];
  if (!row) return null;

  return {
    sessionId: row.session_id,
    sessionExpiresAt: new Date(row.expires_at).toISOString(),
    sessionIndex: row.session_index,
    userId: row.user_id,
    idpEntityId: row.idp_entity_id,
    nameId: row.name_id,
    email: row.email,
    displayName: row.display_name,
    groups: row.groups,
  };
}

/** Delete the session row (local logout). */
export async function destroySession(sessionId: string): Promise<void> {
  await pool.query("DELETE FROM sessions WHERE id = $1", [sessionId]);
}
