// IdP configuration, read once from environment variables and validated with zod.
// If anything is missing or malformed the process refuses to start, which is
// much easier to debug than a half-working SAML flow.

import { z } from "zod";

const boolFromEnv = z
  .enum(["true", "false"])
  .default("false")
  .transform((v) => v === "true");

const EnvSchema = z.object({
  PORT: z.coerce.number().int().positive().default(4000),

  // Browser-facing base URL. Used to build the IdP entityID and endpoint URLs
  // that appear inside signed XML and metadata (see spec §3).
  IDP_BASE_URL: z.string().url().default("http://127.0.0.1:4000"),

  DATABASE_URL: z.string().min(1),

  // Lab-only: expose decoded SAML XML in the UI.
  LAB_DEBUG: boolFromEnv,

  // Mounted from ./shared — key material and metadata files.
  KEYS_DIR: z.string().default("/shared/keys"),
  METADATA_DIR: z.string().default("/shared/metadata"),
});

const env = EnvSchema.parse(process.env);

// Strip a trailing slash so we can safely do `${baseUrl}/path`.
const baseUrl = env.IDP_BASE_URL.replace(/\/$/, "");

export const config = {
  port: env.PORT,
  baseUrl,
  databaseUrl: env.DATABASE_URL,
  labDebug: env.LAB_DEBUG,
  keysDir: env.KEYS_DIR,
  metadataDir: env.METADATA_DIR,

  // SAML Metadata §2.3: the IdP's globally unique name. By convention it is
  // the URL where the IdP's metadata can be fetched.
  entityId: `${baseUrl}/metadata`,

  // The IdP's own login session (the "SSO session"). While it lives, every
  // SP that sends this browser here gets an answer without a password prompt.
  ssoCookieName: "idp_sid",
  ssoSessionTtlMs: 8 * 60 * 60 * 1000, // 8 hours

  // CSRF token for the login form (double-submit cookie, see auth/csrf.ts).
  csrfCookieName: "idp_csrf",
} as const;
