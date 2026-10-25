import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// In Docker the API serves the built SPA, so this proxy is only for
// `npm run dev` on the host (with sp-api running on :3000).
// Note: SAML flows still need the browser on http://localhost:3000, because
// that URL is baked into the AuthnRequest and the IdP's registered ACS URL.
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      "/api": "http://localhost:3000",
      "/saml": "http://localhost:3000",
    },
  },
});
