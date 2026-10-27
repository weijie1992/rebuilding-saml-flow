// The IdP's SSO session — the "single" in single sign-on.
//
// After one successful password login, the IdP sets the idp_sid cookie on
// ITS OWN hostname (127.0.0.1:4000). Later, when any SP redirects the browser
// here with an AuthnRequest (phase 4), the browser sends idp_sid along, and
// the IdP can answer immediately without asking for the password again.
//
// The SP never sees this cookie: cookies are scoped to the host that set them.

import { randomBytes } from "node:crypto";
import type { Request, Response } from "express";
import { config } from "../config.ts";
import { pool } from "../db/pool.ts";

export interface SsoSession {
  id: string;
  /** When the user actually typed their password. Goes into the Assertion as
   *  AuthnStatement/@AuthnInstant (SAML Core §2.7.2) in phase 4. */
  authnInstant: Date;
  expiresAt: Date;
  user: {
    id: string;
    email: string;
    displayName: string;
    groups: string[];
  };
}

/** Create a session row and set the idp_sid cookie on the response. */
export async function startSsoSession(res: Response, userId: string): Promise<string> {
  // 32 random bytes = 256 bits: unguessable, so the cookie value itself is
  // the credential. base64url keeps it cookie-safe.
  const id = randomBytes(32).toString("base64url");
  const now = new Date();
  const expiresAt = new Date(now.getTime() + config.ssoSessionTtlMs);

  await pool.query(
    "INSERT INTO sso_sessions (id, user_id, authn_instant, expires_at) VALUES ($1, $2, $3, $4)",
    [id, userId, now, expiresAt],
  );

  res.cookie(config.ssoCookieName, id, {
    httpOnly: true, // page JavaScript can't read it (limits XSS damage)
    // Lax: sent on top-level navigations INTO the IdP, including the SP's
    // redirect to /sso. That's every way the IdP is reached, so Lax is enough.
    sameSite: "lax",
    // secure: true would be required in production (HTTPS). The lab runs on
    // plain http://, where browsers refuse to store Secure cookies.
    secure: false,
    path: "/",
    expires: expiresAt,
  });

  return id;
}

/** Read idp_sid and return the live session with its user, or null. */
export async function getSsoSession(req: Request): Promise<SsoSession | null> {
  const sid: unknown = req.cookies?.[config.ssoCookieName];
  if (typeof sid !== "string" || sid.length === 0) return null;

  const result = await pool.query<{
    id: string;
    authn_instant: Date;
    expires_at: Date;
    user_id: string;
    email: string;
    display_name: string;
    groups: string[];
  }>(
    `SELECT s.id, s.authn_instant, s.expires_at,
            u.id AS user_id, u.email, u.display_name,
            COALESCE(array_agg(g.name ORDER BY g.name) FILTER (WHERE g.name IS NOT NULL), '{}') AS groups
       FROM sso_sessions s
       JOIN users u ON u.id = s.user_id
       LEFT JOIN user_groups ug ON ug.user_id = u.id
       LEFT JOIN groups g ON g.id = ug.group_id
      WHERE s.id = $1 AND s.expires_at > now()
      GROUP BY s.id, u.id`,
    [sid],
  );
  const row = result.rows[0];
  if (!row) return null;

  return {
    id: row.id,
    authnInstant: row.authn_instant,
    expiresAt: row.expires_at,
    user: { id: row.user_id, email: row.email, displayName: row.display_name, groups: row.groups },
  };
}

/** Delete the session row and clear the cookie. */
export async function endSsoSession(res: Response, sessionId: string): Promise<void> {
  await pool.query("DELETE FROM sso_sessions WHERE id = $1", [sessionId]);
  res.clearCookie(config.ssoCookieName, { path: "/" });
}
