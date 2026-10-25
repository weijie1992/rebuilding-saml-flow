export function Home() {
  // SAML login is a FULL-PAGE NAVIGATION, not fetch(). The browser must
  // actually travel to the IdP (via the SP backend's 302) so the IdP can show
  // its own login page and set its own cookie. fetch() would just follow the
  // redirect invisibly in the background and get nowhere.
  function login() {
    window.location.href = "/saml/login?returnTo=/dashboard";
  }

  return (
    <section className="card">
      <h1>Welcome to Acme App</h1>
      <p>This app doesn't keep passwords. Sign in with your company account.</p>
      <button onClick={login}>Log in with Company SSO</button>
      <p className="muted">
        (Phase 1: the button reaches a "not built yet" page. SSO arrives in phase 4.)
      </p>
    </section>
  );
}
