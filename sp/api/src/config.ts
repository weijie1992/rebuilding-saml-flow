// SP configuration, read once from environment variables and validated with zod.

import { z } from "zod";

const boolFromEnv = z
  .enum(["true", "false"])
  .default("false")
  .transform((v) => v === "true");

const EnvSchema = z.object({
  PORT: z.coerce.number().int().positive().default(3000),

  // Browser-facing base URLs (spec §3). SP_BASE_URL builds our entityID and
  // ACS URL, which the IdP puts inside the signed Assertion — so it must be
  // exactly what the browser sees.
  SP_BASE_URL: z.string().url().default("http://localhost:3000"),
  IDP_BASE_URL: z.string().url().default("http://127.0.0.1:4000"),

  DATABASE_URL: z.string().min(1),

  LAB_DEBUG: boolFromEnv,

  // Accept unsolicited (IdP-initiated) Responses with no InResponseTo. Phase 5.
  ALLOW_IDP_INITIATED: boolFromEnv,

  METADATA_DIR: z.string().default("/shared/metadata"),

  // Where the built React SPA lives (copied in by the Dockerfile).
  WEB_DIST: z.string().default("../web/dist"),
});

const env = EnvSchema.parse(process.env);

const baseUrl = env.SP_BASE_URL.replace(/\/$/, "");

export const config = {
  port: env.PORT,
  baseUrl,
  idpBaseUrl: env.IDP_BASE_URL.replace(/\/$/, ""),
  databaseUrl: env.DATABASE_URL,
  labDebug: env.LAB_DEBUG,
  allowIdpInitiated: env.ALLOW_IDP_INITIATED,
  metadataDir: env.METADATA_DIR,
  webDist: env.WEB_DIST,

  // SAML Metadata §2.3: the SP's globally unique name (also its metadata URL).
  entityId: `${baseUrl}/saml/metadata`,

  // SAML Profiles §4.1.4: the Assertion Consumer Service — the SP endpoint
  // the browser POSTs the SAMLResponse to.
  acsUrl: `${baseUrl}/saml/acs`,

  sessionCookieName: "sp_sid",
  sessionTtlMs: 8 * 60 * 60 * 1000, // 8 hours
} as const;
