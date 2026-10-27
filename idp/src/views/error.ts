import { escapeHtml, page } from "./layout.ts";

/** Generic error page. The specific reason goes to audit_log, never to the
 *  browser: detailed errors help attackers more than they help users. */
export function errorView(message: string): string {
  return page(
    "Error",
    `<section class="card narrow">
  <h1>Something went wrong</h1>
  <p>${escapeHtml(message)}</p>
  <a class="button" href="/apps">Back to your apps</a>
</section>`,
  );
}
