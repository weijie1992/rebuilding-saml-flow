// Shared page shell and HTML escaping for the IdP's server-rendered pages.
//
// The IdP deliberately renders plain HTML on the server, with no frontend
// framework: it's a separate "company" from the SP, and in real life its
// login page belongs to Okta / Entra ID / ADFS, not to the app you're using.

/** Escape text for safe insertion into HTML. Use on EVERY dynamic value. */
export function escapeHtml(value: unknown): string {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

/** Wrap a body fragment in the full IdP page. `body` must already be escaped. */
export function page(title: string, body: string): string {
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${escapeHtml(title)} · Corp IdP</title>
  <style>
    :root { font-family: system-ui, -apple-system, sans-serif; color: #1d2329; background: #eef1f4; }
    body { margin: 0; }
    header { background: #3b2a5c; color: #fff; padding: 0.75rem 1.5rem; display: flex; justify-content: space-between; align-items: center; }
    header a { color: #fff; }
    main { max-width: 44rem; margin: 2rem auto; padding: 0 1rem; }
    .card { background: #fff; border-radius: 8px; padding: 1.5rem 2rem; box-shadow: 0 1px 3px rgb(0 0 0 / 0.12); }
    .narrow { max-width: 24rem; margin: 0 auto; }
    label { display: block; font-weight: 600; margin: 1rem 0 0.3rem; }
    input[type=email], input[type=password] { width: 100%; box-sizing: border-box; font: inherit; padding: 0.55rem 0.7rem; border: 1px solid #b9c1ca; border-radius: 6px; }
    button, .button { display: inline-block; font: inherit; margin-top: 1.25rem; padding: 0.6rem 1.1rem; border: 0; border-radius: 6px; background: #3b2a5c; color: #fff; cursor: pointer; text-decoration: none; }
    .error { background: #fdecec; color: #8a1c1c; padding: 0.6rem 0.8rem; border-radius: 6px; }
    .notice { background: #e8f3ea; color: #1d5a2a; padding: 0.6rem 0.8rem; border-radius: 6px; }
    .muted { color: #5c6670; font-size: 0.9rem; }
    .tiles { display: grid; grid-template-columns: repeat(auto-fill, minmax(12rem, 1fr)); gap: 1rem; margin-top: 1rem; }
    .tile { display: block; padding: 1rem; border: 1px solid #d5dbe1; border-radius: 8px; color: inherit; text-decoration: none; }
    .tile:hover { border-color: #3b2a5c; }
    dl { display: grid; grid-template-columns: max-content 1fr; gap: 0.35rem 1rem; }
    dt { font-weight: 600; } dd { margin: 0; overflow-wrap: anywhere; }
    code { font-size: 0.85em; }
  </style>
</head>
<body>
  <header><strong>Corp Identity Provider</strong><span class="muted" style="color:#d8cff0">127.0.0.1:4000</span></header>
  <main>${body}</main>
</body>
</html>`;
}
