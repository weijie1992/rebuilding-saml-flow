// CSRF protection for the login form (spec §13).
//
// The threat ("login CSRF"): an attacker's page silently POSTs THEIR OWN
// email and password to our /login. The victim's browser ends up logged in to
// the IdP as the attacker, and every SP the victim then visits receives
// Assertions for the attacker's account — the victim may type private data
// into it without noticing.
//
// The defence, "double-submit cookie": when we render the form we generate a
// random token, put it in a cookie AND in a hidden form field. On POST both
// must be present and equal. An attacker's page can make the browser send our
// cookie, but it can't read it, so it can't put the matching value in the
// form. (SameSite=Lax on the cookie also stops it being sent on a cross-site
// POST at all — two independent layers.)

import { randomBytes, timingSafeEqual } from "node:crypto";
import type { Request, Response } from "express";
import { config } from "../config.ts";

/** Issue a fresh token: set it as a cookie and return it for the hidden field. */
export function issueCsrfToken(res: Response): string {
  const token = randomBytes(32).toString("base64url");
  res.cookie(config.csrfCookieName, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: false, // lab runs on http://; true in production
    path: "/login",
  });
  return token;
}

/** True if the form field matches the cookie. */
export function verifyCsrfToken(req: Request): boolean {
  const fromCookie: unknown = req.cookies?.[config.csrfCookieName];
  const fromForm: unknown = req.body?._csrf;
  if (typeof fromCookie !== "string" || typeof fromForm !== "string") return false;

  const a = Buffer.from(fromCookie);
  const b = Buffer.from(fromForm);
  // timingSafeEqual compares in constant time so the response time doesn't
  // reveal how many leading characters matched. It throws on unequal lengths.
  return a.length === b.length && timingSafeEqual(a, b);
}
