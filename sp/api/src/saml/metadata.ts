// SAML Metadata — the SP's business card, and how it learns the IdP's.
//
// Spec: "Metadata for the OASIS SAML V2.0" (saml-metadata-2.0-os).

import { X509Certificate } from "node:crypto";
import { BINDING, NAMEID_FORMAT, NS, SAML2_PROTOCOL } from "./constants.ts";
import { escapeXml, parseXmlSafely, selectElement, selectElements } from "./xml.ts";

export interface SpMetadataInput {
  entityId: string;
  acsUrl: string;
  sloUrl: string;
  displayName: string;
  baseUrl: string;
}

/**
 * Build the SP's metadata (Metadata §2.3.2 EntityDescriptor containing a
 * §2.4.4 SPSSODescriptor).
 *
 * The IdP reads this to learn:
 *   - entityID: the Issuer of our AuthnRequests, and the Audience it must
 *     put in every Assertion meant for us (spec §8 item 8).
 *   - AssertionConsumerService: the ONE place it may POST Responses to.
 *   - WantAssertionsSigned="true": we refuse unsigned Assertions.
 *
 * No KeyDescriptor: this SP has no key pair yet. One would be needed to sign
 * AuthnRequests or receive encrypted Assertions (optional phase 9).
 */
export function buildSpMetadata(m: SpMetadataInput): string {
  const e = escapeXml;
  return `<?xml version="1.0" encoding="UTF-8"?>
<md:EntityDescriptor xmlns:md="${NS.md}" entityID="${e(m.entityId)}">
  <md:SPSSODescriptor protocolSupportEnumeration="${SAML2_PROTOCOL}" AuthnRequestsSigned="false" WantAssertionsSigned="true">
    <!-- §2.4.2 SSODescriptor: Single Logout, phase 6. -->
    <md:SingleLogoutService Binding="${BINDING.redirect}" Location="${e(m.sloUrl)}"/>
    <md:NameIDFormat>${NAMEID_FORMAT.email}</md:NameIDFormat>
    <!-- §2.4.4.1: the Assertion Consumer Service. Responses arrive here via
         HTTP-POST (an auto-submitting form in the browser). -->
    <md:AssertionConsumerService Binding="${BINDING.post}" Location="${e(m.acsUrl)}" index="0" isDefault="true"/>
  </md:SPSSODescriptor>
  <md:Organization>
    <md:OrganizationName xml:lang="en">Acme</md:OrganizationName>
    <md:OrganizationDisplayName xml:lang="en">${e(m.displayName)}</md:OrganizationDisplayName>
    <md:OrganizationURL xml:lang="en">${e(m.baseUrl)}</md:OrganizationURL>
  </md:Organization>
</md:EntityDescriptor>
`;
}

/** Everything the SP trusts about its IdP. Comes ONLY from IdP metadata. */
export interface IdpTrust {
  /** Must equal the Issuer of every Response and Assertion (spec §8 item 7). */
  entityId: string;
  /** Where /saml/login sends the browser with the AuthnRequest (Redirect binding). */
  ssoRedirectUrl: string;
  sloRedirectUrl: string | null;
  /**
   * The certificates allowed to sign Assertions (PEM). Signature checks in
   * phase 4 use these and NOTHING else — never a certificate that arrives
   * inside the Response's own <ds:KeyInfo> (spec §8 item 4), because an
   * attacker can put any certificate they like there.
   *
   * A list, because during a key rollover an IdP publishes old and new.
   */
  signingCertificates: Array<{ pem: string; fingerprint256: string; validTo: string }>;
}

/**
 * Parse an IdP's metadata (Metadata §2.4.3 IDPSSODescriptor).
 * Works for any standards-compliant IdP — ours, Keycloak (phase 7), Okta, …
 */
export function parseIdpMetadata(xml: string): IdpTrust {
  const doc = parseXmlSafely(xml);

  const entity = selectElement("/md:EntityDescriptor", doc);
  if (!entity) throw new Error("IdP metadata: root element is not md:EntityDescriptor");
  const entityId = entity.getAttribute("entityID");
  if (!entityId) throw new Error("IdP metadata: EntityDescriptor has no entityID");

  const idp = selectElement("md:IDPSSODescriptor", entity);
  if (!idp) throw new Error("IdP metadata: no IDPSSODescriptor");
  if (!(idp.getAttribute("protocolSupportEnumeration") ?? "").split(/\s+/).includes(SAML2_PROTOCOL)) {
    throw new Error("IdP metadata: IDPSSODescriptor does not support SAML 2.0");
  }

  const ssoRedirectUrl = selectElements("md:SingleSignOnService", idp)
    .find((el) => el.getAttribute("Binding") === BINDING.redirect)
    ?.getAttribute("Location");
  if (!ssoRedirectUrl) throw new Error("IdP metadata: no SingleSignOnService with the HTTP-Redirect binding");

  const sloRedirectUrl =
    selectElements("md:SingleLogoutService", idp)
      .find((el) => el.getAttribute("Binding") === BINDING.redirect)
      ?.getAttribute("Location") ?? null;

  // §2.4.1.1: a KeyDescriptor with use="signing", OR with no use attribute
  // (meaning "both signing and encryption"), is a signing key.
  // use="encryption" keys must not be accepted for signatures.
  const signingCertificates = selectElements("md:KeyDescriptor", idp)
    .filter((kd) => {
      const use = kd.getAttribute("use");
      return use === null || use === "" || use === "signing";
    })
    .flatMap((kd) => selectElements("ds:KeyInfo/ds:X509Data/ds:X509Certificate", kd))
    .map((el) => toCertificate(el.textContent ?? ""));
  if (signingCertificates.length === 0) {
    throw new Error("IdP metadata: no signing certificate (KeyDescriptor use=signing)");
  }

  return { entityId, ssoRedirectUrl, sloRedirectUrl, signingCertificates };
}

/** <ds:X509Certificate> holds base64 DER, often wrapped across lines.
 *  Turn it back into PEM and parse it, so a corrupt cert fails right here. */
function toCertificate(base64: string) {
  const body = base64.replace(/\s+/g, "");
  const pem = `-----BEGIN CERTIFICATE-----\n${body.match(/.{1,64}/g)?.join("\n") ?? ""}\n-----END CERTIFICATE-----\n`;
  const cert = new X509Certificate(pem);
  return { pem, fingerprint256: cert.fingerprint256, validTo: cert.validTo };
}
