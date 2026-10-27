// The SP's single source of truth about its IdP: the IdP metadata file.
//
// Note what's NOT here: no IdP URL in an environment variable, no cert path.
// Pointing this SP at a different IdP (Keycloak, phase 7) means swapping the
// metadata file and nothing else.

import { existsSync, readFileSync } from "node:fs";
import { config } from "../config.ts";
import { parseIdpMetadata, type IdpTrust } from "./metadata.ts";

let trust: IdpTrust | null = null;

/** Load the IdP metadata file at startup. Missing file = SSO disabled, not a crash. */
export function loadIdpTrust(): IdpTrust | null {
  const file = config.idpMetadataFile;
  if (!existsSync(file)) {
    console.warn(`sp-api: no IdP metadata at ${file} — SSO disabled. Run scripts/export-metadata.sh.`);
    trust = null;
    return null;
  }
  trust = parseIdpMetadata(readFileSync(file, "utf8"));
  for (const c of trust.signingCertificates) {
    console.log(`sp-api: trusting IdP ${trust.entityId} signing cert SHA-256 ${c.fingerprint256} (valid to ${c.validTo})`);
  }
  return trust;
}

/** The loaded IdP, or null if no metadata was found. */
export function getIdpTrust(): IdpTrust | null {
  return trust;
}
