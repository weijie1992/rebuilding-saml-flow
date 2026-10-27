import { escapeHtml, page } from "./layout.ts";

export interface LoginViewModel {
  csrfToken: string;
  email?: string;
  error?: string;
  notice?: string;
}

export function loginView(vm: LoginViewModel): string {
  return page(
    "Sign in",
    `<section class="card narrow">
  <h1>Sign in</h1>
  <p class="muted">One company account for every app.</p>
  ${vm.notice ? `<p class="notice">${escapeHtml(vm.notice)}</p>` : ""}
  ${vm.error ? `<p class="error" role="alert">${escapeHtml(vm.error)}</p>` : ""}
  <form method="post" action="/login">
    <input type="hidden" name="_csrf" value="${escapeHtml(vm.csrfToken)}">
    <label for="email">Email</label>
    <input id="email" name="email" type="email" autocomplete="username" required autofocus value="${escapeHtml(vm.email ?? "")}">
    <label for="password">Password</label>
    <input id="password" name="password" type="password" autocomplete="current-password" required>
    <button type="submit">Sign in</button>
  </form>
  <p class="muted" style="margin-top:1.5rem">Lab users: <code>alice@corp.test</code> / <code>bob@corp.test</code>, password <code>password123</code>.</p>
</section>`,
  );
}
