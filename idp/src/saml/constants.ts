// SAML URNs used across the IdP. Every one of these is a fixed identifier
// defined by the OASIS SAML 2.0 specs; they're compared as exact strings.

/** XML namespaces (SAML Metadata §2.1, SAML Core §2.1). */
export const NS = {
  md: "urn:oasis:names:tc:SAML:2.0:metadata",
  ds: "http://www.w3.org/2000/09/xmldsig#",
  saml: "urn:oasis:names:tc:SAML:2.0:assertion",
  samlp: "urn:oasis:names:tc:SAML:2.0:protocol",
} as const;

/** The protocol value an SSO role descriptor must advertise (Metadata §2.4.1). */
export const SAML2_PROTOCOL = "urn:oasis:names:tc:SAML:2.0:protocol";

/** Bindings: HOW a message travels through the browser (SAML Bindings §3). */
export const BINDING = {
  /** §3.4 — message DEFLATEd + base64 + put in a URL query string (302 redirect). */
  redirect: "urn:oasis:names:tc:SAML:2.0:bindings:HTTP-Redirect",
  /** §3.5 — message base64'd into a hidden field of an auto-submitting HTML form. */
  post: "urn:oasis:names:tc:SAML:2.0:bindings:HTTP-POST",
} as const;

/** NameID formats: what kind of identifier the Subject carries (Core §8.3). */
export const NAMEID_FORMAT = {
  email: "urn:oasis:names:tc:SAML:1.1:nameid-format:emailAddress",
  persistent: "urn:oasis:names:tc:SAML:2.0:nameid-format:persistent",
  transient: "urn:oasis:names:tc:SAML:2.0:nameid-format:transient",
  unspecified: "urn:oasis:names:tc:SAML:1.1:nameid-format:unspecified",
} as const;
