// SP configuration, read once from environment variables and validated with zod.

import { z } from "zod";

const boolFromEnv = z
  .enum(["true", "false"])
  .default("false")
  .transform((v) => v === "true");

const EnvSchema = z.object({
  PORT: z.coerce.number().int().positive().default(3000),

  // Browser-facing base URL (spec §3). It builds our entityID and ACS URL,
  // which the IdP puts inside the signed Assertion — so it must be exactly
  // what the browser sees.
  SP_BASE_URL: z.string().url().default("http://localhost:3000"),

  DATABASE_URL: z.string().min(1),

  LAB_DEBUG: boolFromEnv,

  // Accept unsolicited (IdP-initiated) Responses with no InResponseTo. Phase 5.
  ALLOW_IDP_INITIATED: boolFromEnv,

  METADATA_DIR: z.string().default("/shared/metadata"),

  // Everything the SP knows about its IdP comes from this one file — there
  // is deliberately no IDP_BASE_URL. Switching IdP = switching file (phase 7).
  IDP_METADATA_FILE: z.string().optional(),

  // Where the built React SPA lives (copied in by the Dockerfile).
  WEB_DIST: z.string().default("../web/dist"),
});

const env = EnvSchema.parse(process.env);

const baseUrl = env.SP_BASE_URL.replace(/\/$/, "");

export const config = {
  port: env.PORT,
  baseUrl,
  databaseUrl: env.DATABASE_URL,
  labDebug: env.LAB_DEBUG,
  allowIdpInitiated: env.ALLOW_IDP_INITIATED,
  metadataDir: env.METADATA_DIR,
  idpMetadataFile: env.IDP_METADATA_FILE ?? `${env.METADATA_DIR}/idp-metadata.xml`,
  webDist: env.WEB_DIST,

  // SAML Metadata §2.3: the SP's globally unique name (also its metadata URL).
  entityId: `${baseUrl}/saml/metadata`,

  // SAML Profiles §4.1.4: the Assertion Consumer Service — the SP endpoint
  // the browser POSTs the SAMLResponse to.
  acsUrl: `${baseUrl}/saml/acs`,

  // Where the IdP sends LogoutRequests/LogoutResponses (phase 6).
  sloUrl: `${baseUrl}/saml/slo`,

  // Shown on the IdP's app tile (via our metadata's OrganizationDisplayName).
  displayName: "Acme App",

  sessionCookieName: "sp_sid",
  sessionTtlMs: 8 * 60 * 60 * 1000, // 8 hours
} as const;
