// GET /metadata — the IdP's metadata, at the URL that is also its entityID.
//
// Served for inspection and for the export script. The SP itself never
// fetches this URL: it reads the exported file (spec §3).

import { Router } from "express";

export function metadataRouter(metadataXml: string): Router {
  const router = Router();
  router.get("/metadata", (_req, res) => {
    // The registered media type for SAML metadata (Metadata §4.1.1).
    res.type("application/samlmetadata+xml").send(metadataXml);
  });
  return router;
}
