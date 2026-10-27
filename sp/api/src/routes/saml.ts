// SAML endpoints for the SP.
// Built: metadata (phase 3). Still placeholders: login + ACS (phase 4), SLO (phase 6).

import { Router } from "express";
import { config } from "../config.ts";
import { buildSpMetadata } from "../saml/metadata.ts";

export const samlRouter = Router();

function notYet(phase: number, what: string) {
  return (_req: unknown, res: import("express").Response) => {
    res
      .status(501)
      .type("html")
      .send(
        `<!doctype html><meta charset="utf-8"><title>Not yet</title>
<body style="font-family: system-ui, sans-serif; max-width: 40rem; margin: 3rem auto; padding: 0 1rem;">
<h1>Not built yet</h1><p>${what} arrives in phase ${phase}.</p><p><a href="/">Back home</a></p></body>`,
      );
  };
}

// GET /saml/metadata — our metadata, at the URL that is also our entityID.
// Fixed for the life of the process, so build it once.
const metadataXml = buildSpMetadata({
  entityId: config.entityId,
  acsUrl: config.acsUrl,
  sloUrl: config.sloUrl,
  displayName: config.displayName,
  baseUrl: config.baseUrl,
});
samlRouter.get("/metadata", (_req, res) => {
  // The registered media type for SAML metadata (Metadata §4.1.1).
  res.type("application/samlmetadata+xml").send(metadataXml);
});
samlRouter.get("/login", notYet(4, "SP-initiated SSO (AuthnRequest via HTTP-Redirect)"));
samlRouter.post("/acs", notYet(4, "The Assertion Consumer Service"));
samlRouter.get("/logout", notYet(6, "Single Logout"));
samlRouter.all("/slo", notYet(6, "Single Logout"));
