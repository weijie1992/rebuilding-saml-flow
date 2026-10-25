export function Debug() {
  return (
    <section className="card">
      <h1>Debug: last SAMLResponse</h1>
      <p className="muted">
        Lab only (<code>LAB_DEBUG=true</code>). Once SSO is built (phase 4), this page shows the
        decoded XML of the last SAMLResponse the SP received, with each signature and condition
        check annotated.
      </p>
    </section>
  );
}
