// IdP login and logout.
//
//   GET  /login   show the form (or skip it if an SSO session already exists)
//   POST /login   CSRF check → password check → start SSO session → continue
//   GET  /logout  end the IdP's SSO session

import { Router, type Response } from "express";
import { z } from "zod";
import { checkPassword } from "../auth/password.ts";
import { issueCsrfToken, verifyCsrfToken } from "../auth/csrf.ts";
import { endSsoSession, getSsoSession, startSsoSession } from "../auth/sso-session.ts";
import { config } from "../config.ts";
import { audit } from "../db/audit.ts";
import { pool } from "../db/pool.ts";
import { loginView } from "../views/login.ts";

export const loginRouter = Router();

const LoginForm = z.object({
  email: z.string().trim().min(1).max(320),
  password: z.string().min(1).max(1024),
});

/** Where the browser goes once it has a valid SSO session.
 *  Phase 4 will check here for a pending AuthnRequest and, if there is one,
 *  answer it with a signed Response instead of showing the portal. */
function continueAfterLogin(res: Response): void {
  res.redirect(303, "/apps");
}

function renderLogin(res: Response, status: number, vm: { email?: string; error?: string; notice?: string }) {
  // A fresh CSRF token on every render, so a failed attempt can't be replayed.
  const csrfToken = issueCsrfToken(res);
  res.status(status).type("html").send(loginView({ csrfToken, ...vm }));
}

loginRouter.get("/login", async (req, res) => {
  if (await getSsoSession(req)) return continueAfterLogin(res);
  const notice = req.query.signed_out === "1" ? "You have signed out of the IdP." : undefined;
  renderLogin(res, 200, { notice });
});

loginRouter.post("/login", async (req, res) => {
  if (!verifyCsrfToken(req)) {
    await audit(pool, "login.csrf_rejected", { ip: req.ip });
    return renderLogin(res, 403, { error: "Your sign-in form expired. Please try again." });
  }

  const form = LoginForm.safeParse(req.body);
  if (!form.success) {
    return renderLogin(res, 400, { error: "Enter your email and password." });
  }
  const { email, password } = form.data;

  const result = await checkPassword(email, password);
  if (!result.ok) {
    // The audit log records the precise reason (unknown_user vs bad_password);
    // the user only ever sees one generic message, so the login page can't be
    // used to discover which emails have accounts.
    await audit(pool, "login.failure", { email, reason: result.reason, ip: req.ip });
    return renderLogin(res, 401, { email, error: "Incorrect email or password." });
  }

  // Session fixation defence: never reuse a session id that existed before
  // login. Drop any old session and always mint a brand-new id.
  const previous = await getSsoSession(req);
  if (previous) await endSsoSession(res, previous.id);

  const sessionId = await startSsoSession(res, result.user.id);
  res.clearCookie(config.csrfCookieName, { path: "/login" });
  await audit(pool, "login.success", { userId: result.user.id, email: result.user.email, sessionId });

  continueAfterLogin(res);
});

// GET because the spec lists it as a link target. In production prefer POST
// (a GET logout can be triggered by any <img src> on another site). Phase 6
// will extend this to send Single Logout requests to the SPs.
loginRouter.get("/logout", async (req, res) => {
  const session = await getSsoSession(req);
  if (session) {
    await endSsoSession(res, session.id);
    await audit(pool, "logout", { userId: session.user.id, sessionId: session.id });
  } else {
    res.clearCookie(config.ssoCookieName, { path: "/" });
  }
  res.redirect(303, "/login?signed_out=1");
});
