import { useEffect, useState } from "react";
import { Link } from "react-router";

interface Me {
  displayName: string | null;
  email: string | null;
  nameId: string;
  idpEntityId: string;
  groups: string[];
  sessionExpiresAt: string;
}

type State =
  | { kind: "loading" }
  | { kind: "anonymous" }
  | { kind: "error"; message: string }
  | { kind: "ok"; me: Me };

export function Dashboard() {
  const [state, setState] = useState<State>({ kind: "loading" });

  async function load() {
    // Same origin, so the browser attaches the sp_sid cookie automatically.
    const res = await fetch("/api/me");
    if (res.status === 401) return setState({ kind: "anonymous" });
    if (!res.ok) return setState({ kind: "error", message: `HTTP ${res.status}` });
    setState({ kind: "ok", me: (await res.json()) as Me });
  }

  useEffect(() => {
    load().catch((err: unknown) => setState({ kind: "error", message: String(err) }));
  }, []);

  async function localLogout() {
    await fetch("/api/logout", { method: "POST" });
    setState({ kind: "anonymous" });
  }

  if (state.kind === "loading") return <p>Loading…</p>;
  if (state.kind === "error") return <p>Something went wrong: {state.message}</p>;
  if (state.kind === "anonymous") {
    return (
      <section className="card">
        <h1>Dashboard</h1>
        <p>You are not logged in.</p>
        <Link to="/">Go to login</Link>
      </section>
    );
  }

  const { me } = state;
  return (
    <section className="card">
      <h1>Hello, {me.displayName ?? me.email ?? me.nameId}</h1>
      <dl>
        <dt>Email</dt><dd>{me.email ?? "—"}</dd>
        <dt>NameID</dt><dd><code>{me.nameId}</code></dd>
        <dt>IdP</dt><dd><code>{me.idpEntityId}</code></dd>
        <dt>Groups</dt><dd>{me.groups.join(", ") || "—"}</dd>
        <dt>Session expires</dt><dd>{new Date(me.sessionExpiresAt).toLocaleString()}</dd>
      </dl>
      <div className="row">
        <button onClick={localLogout}>Log out (this app only)</button>
        {/* Full-page navigation: SLO travels through the browser to the IdP. */}
        <button onClick={() => (window.location.href = "/saml/logout")}>
          Single Logout (everywhere)
        </button>
      </div>
    </section>
  );
}
