// SAML Metadata — how the IdP and SP learn about each other.
//
// Metadata is a "business card" in XML: who I am (entityID), where my
// endpoints are, which bindings they accept, and which certificate my
// signatures will be made with. Trust in SAML is established by exchanging
// these documents OUT OF BAND (here: files in shared/metadata), never by
// believing what arrives inside a SAML message.
//
// Spec: "Metadata for the OASIS SAML V2.0" (saml-metadata-2.0-os).

import { readFileSync } from "node:fs";
import { BINDING, NAMEID_FORMAT, NS, SAML2_PROTOCOL } from "./constants.ts";
import type { SigningCertificate } from "./keys.ts";
import { escapeXml, parseXmlSafely, selectElement, selectElements } from "./xml.ts";

export interface IdpMetadataInput {
  entityId: string;
  baseUrl: string;
  cert: SigningCertificate;
}

/**
 * Build the IdP's metadata (Metadata §2.3.2 EntityDescriptor containing a
 * §2.4.3 IDPSSODescriptor).
 *
 * The SP will read three things from this:
 *   - entityID: the exact Issuer value every Response/Assertion must carry.
 *   - SingleSignOnService: where to send the browser with an AuthnRequest.
 *   - KeyDescriptor use="signing": the ONLY certificate the SP will accept
 *     signatures from (spec §8 item 4).
 */
export function buildIdpMetadata({ entityId, baseUrl, cert }: IdpMetadataInput): string {
  const e = escapeXml;
  return `<?xml version="1.0" encoding="UTF-8"?>
<md:EntityDescriptor xmlns:md="${NS.md}" xmlns:ds="${NS.ds}" entityID="${e(entityId)}">
  <!-- WantAuthnRequestsSigned="false": this lab's SP doesn't sign its
       AuthnRequests (optional phase 9). -->
  <md:IDPSSODescriptor protocolSupportEnumeration="${SAML2_PROTOCOL}" WantAuthnRequestsSigned="false">
    <!-- §2.4.1.1 KeyDescriptor: the public certificate matching the private key
         that signs Assertions. Fingerprint (SHA-256): ${e(cert.fingerprint256)} -->
    <md:KeyDescriptor use="signing">
      <ds:KeyInfo>
        <ds:X509Data>
          <ds:X509Certificate>${cert.base64Der}</ds:X509Certificate>
        </ds:X509Data>
      </ds:KeyInfo>
    </md:KeyDescriptor>
    <!-- §2.4.2 SSODescriptor: Single Logout, phase 6. -->
    <md:SingleLogoutService Binding="${BINDING.redirect}" Location="${e(baseUrl)}/slo"/>
    <md:NameIDFormat>${NAMEID_FORMAT.email}</md:NameIDFormat>
    <!-- §2.4.3: where SPs send AuthnRequests. Same URL, two bindings. -->
    <md:SingleSignOnService Binding="${BINDING.redirect}" Location="${e(baseUrl)}/sso"/>
    <md:SingleSignOnService Binding="${BINDING.post}" Location="${e(baseUrl)}/sso"/>
  </md:IDPSSODescriptor>
  <md:Organization>
    <md:OrganizationName xml:lang="en">Corp</md:OrganizationName>
    <md:OrganizationDisplayName xml:lang="en">Corp Identity Provider</md:OrganizationDisplayName>
    <md:OrganizationURL xml:lang="en">${e(baseUrl)}</md:OrganizationURL>
  </md:Organization>
</md:EntityDescriptor>
`;
}

/** What the IdP needs to know about an SP — one row of service_providers. */
export interface SpRegistration {
  entityId: string;
  /** Where the IdP will POST the signed Response. Taken from metadata ONLY. */
  acsUrl: string;
  sloUrl: string | null;
  nameIdFormat: string;
  displayName: string;
  wantAssertionsSigned: boolean;
}

/**
 * Parse an SP's metadata (Metadata §2.4.4 SPSSODescriptor).
 *
 * The most security-relevant output is acsUrl. In phase 4, an AuthnRequest
 * may *ask* for a particular AssertionConsumerServiceURL, but the IdP will
 * only ever POST to the URL registered here. Otherwise an attacker could
 * craft an AuthnRequest naming their own server and receive a signed
 * Assertion for whoever is logged in.
 */
export function parseSpMetadata(xml: string): SpRegistration {
  const doc = parseXmlSafely(xml);

  const entity = selectElement("/md:EntityDescriptor", doc);
  if (!entity) throw new Error("SP metadata: root element is not md:EntityDescriptor");
  const entityId = entity.getAttribute("entityID");
  if (!entityId) throw new Error("SP metadata: EntityDescriptor has no entityID");

  const sp = selectElement("md:SPSSODescriptor", entity);
  if (!sp) throw new Error("SP metadata: no SPSSODescriptor");
  if (!(sp.getAttribute("protocolSupportEnumeration") ?? "").split(/\s+/).includes(SAML2_PROTOCOL)) {
    throw new Error("SP metadata: SPSSODescriptor does not support SAML 2.0");
  }

  // §2.2.3 IndexedEndpointType: an SP may list several ACS endpoints. We only
  // speak HTTP-POST for Responses, so pick among those: isDefault="true"
  // first, otherwise the lowest index.
  const postAcs = selectElements("md:AssertionConsumerService", sp)
    .filter((el) => el.getAttribute("Binding") === BINDING.post)
    .sort((a, b) => {
      const def = (el: Element) => (el.getAttribute("isDefault") === "true" ? 0 : 1);
      const idx = (el: Element) => Number(el.getAttribute("index") ?? Number.MAX_SAFE_INTEGER);
      return def(a) - def(b) || idx(a) - idx(b);
    });
  const acsUrl = postAcs[0]?.getAttribute("Location");
  if (!acsUrl) throw new Error("SP metadata: no AssertionConsumerService with the HTTP-POST binding");

  const sloUrl =
    selectElements("md:SingleLogoutService", sp)
      .find((el) => el.getAttribute("Binding") === BINDING.redirect)
      ?.getAttribute("Location") ?? null;

  // If the SP lists NameID formats, use its first one; otherwise email.
  const nameIdFormat =
    selectElement("md:NameIDFormat", sp)?.textContent?.trim() || NAMEID_FORMAT.email;

  const displayName =
    selectElement("md:Organization/md:OrganizationDisplayName", entity)?.textContent?.trim() ||
    entityId;

  return {
    entityId,
    acsUrl,
    sloUrl,
    nameIdFormat,
    displayName,
    wantAssertionsSigned: sp.getAttribute("WantAssertionsSigned") === "true",
  };
}

/** Read and parse an SP metadata file. */
export function loadSpMetadataFile(filePath: string): SpRegistration {
  return parseSpMetadata(readFileSync(filePath, "utf8"));
}
