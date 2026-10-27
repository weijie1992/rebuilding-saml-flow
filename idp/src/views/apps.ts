import type { SsoSession } from "../auth/sso-session.ts";
import { escapeHtml, page } from "./layout.ts";

export interface AppTile {
  entityId: string;
  displayName: string;
}

/** The IdP portal: "which apps can I open?" — like the Okta or MyApps dashboard. */
export function appsView(session: SsoSession, apps: AppTile[]): string {
  const { user } = session;

  // Each tile will launch IdP-initiated SSO in phase 5: the IdP sends an
  // unsolicited signed Response to that SP without the SP having asked.
  const tiles =
    apps.length === 0
      ? `<p class="muted">No apps registered yet. SPs are loaded from their metadata in phase 3.</p>`
      : `<div class="tiles">${apps
          .map(
            (app) => `<a class="tile" href="/apps/${encodeURIComponent(app.entityId)}/launch">
  <strong>${escapeHtml(app.displayName)}</strong><br><span class="muted">${escapeHtml(app.entityId)}</span></a>`,
          )
          .join("")}</div>`;

  return page(
    "Your apps",
    `<section class="card">
  <h1>Hello, ${escapeHtml(user.displayName)}</h1>
  <h2>Your apps</h2>
  ${tiles}
</section>

<section class="card" style="margin-top:1.5rem">
  <h2>Your IdP session</h2>
  <p class="muted">This is the SSO session behind the <code>idp_sid</code> cookie. While it lasts,
  any SP that sends you here gets you back without a password prompt.</p>
  <dl>
    <dt>Email</dt><dd>${escapeHtml(user.email)}</dd>
    <dt>Groups</dt><dd>${escapeHtml(user.groups.join(", ") || "—")}</dd>
    <dt>Signed in at</dt><dd>${escapeHtml(session.authnInstant.toISOString())} <span class="muted">(becomes AuthnInstant)</span></dd>
    <dt>Session expires</dt><dd>${escapeHtml(session.expiresAt.toISOString())}</dd>
  </dl>
  <a class="button" href="/logout">Sign out of the IdP</a>
</section>`,
  );
}
