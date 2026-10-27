// Safe XML parsing, XPath helpers and escaping.
//
// Everything SAML-related that comes from OUTSIDE this process (metadata
// files now, AuthnRequests in phase 4) goes through parseXmlSafely().

import { DOMParser } from "@xmldom/xmldom";
import xpath from "xpath";
import { NS } from "./constants.ts";

/**
 * Parse untrusted XML.
 *
 * Rejects any DOCTYPE outright. A DOCTYPE is how XML declares entities, and
 * entities enable two classic attacks:
 *   - XXE: <!ENTITY x SYSTEM "file:///etc/passwd"> pulls local files into the doc.
 *   - "Billion laughs": nested entities that expand to gigabytes in memory.
 * SAML messages and metadata never legitimately need a DOCTYPE, so the
 * simplest safe rule is: refuse them all. (Spec §8 item 1.)
 */
export function parseXmlSafely(xml: string): Document {
  if (/<!DOCTYPE/i.test(xml)) {
    throw new Error("XML contains a DOCTYPE; refusing to parse");
  }

  const doc = new DOMParser({
    // Treat every parser complaint — even a warning — as fatal. Half-parsed
    // security documents are worse than none.
    onError: (level, message) => {
      throw new Error(`XML ${level}: ${message}`);
    },
  }).parseFromString(xml, "text/xml");

  // xmldom has its own DOM typings; xpath uses the standard DOM ones. They
  // describe the same objects, so we cast once here and use the standard
  // types everywhere else.
  return doc as unknown as Document;
}

// XPath with the SAML prefixes bound. NOTE: the prefixes here (md:, ds:, …)
// are ours — a document may use different prefixes, or none, for the same
// namespace URI. XPath matches on the URI, which is the correct behaviour.
const select = xpath.useNamespaces(NS);

/** All elements matching an XPath expression. */
export function selectElements(expression: string, context: Node): Element[] {
  const result = select(expression, context);
  if (!Array.isArray(result)) return [];
  return result.filter((n): n is Element => n.nodeType === 1 /* ELEMENT_NODE */);
}

/** Exactly-one-or-none: first matching element, or undefined. */
export function selectElement(expression: string, context: Node): Element | undefined {
  return selectElements(expression, context)[0];
}

/** Escape a value for use inside XML text or a double-quoted attribute. */
export function escapeXml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}
