#!/bin/sh
# Exchange SAML metadata between the IdP and the SP.
#
# SAML concept: before any login can happen, the two parties must trust each
# other. They do that by swapping metadata OUT OF BAND — in real life an admin
# uploads the SP's XML into Okta/Entra and the IdP's XML into the app's
# settings. Here, this script plays that admin:
#
#   http://127.0.0.1:4000/metadata        -> shared/metadata/idp-metadata.xml  (read by the SP)
#   http://localhost:3000/saml/metadata   -> shared/metadata/sp-metadata.xml   (read by the IdP)
#
# then restarts both apps so they load the other side's file.
#
# Usage: scripts/export-metadata.sh [--no-restart]
set -eu

cd "$(dirname "$0")/.."
OUT=shared/metadata
SP_BASE_URL="${SP_BASE_URL:-http://localhost:3000}"
IDP_BASE_URL="${IDP_BASE_URL:-http://127.0.0.1:4000}"

# fetch <url> <file>: download, sanity-check, then move into place atomically
# so an app never reads a half-written file.
fetch() {
  tmp="$2.tmp"
  if ! curl -fsS "$1" -o "$tmp"; then
    echo "export-metadata: could not fetch $1 — is the stack up? (docker compose up -d)" >&2
    rm -f "$tmp"
    exit 1
  fi
  if ! grep -q "EntityDescriptor" "$tmp"; then
    echo "export-metadata: $1 did not return SAML metadata" >&2
    rm -f "$tmp"
    exit 1
  fi
  mv "$tmp" "$2"
  echo "export-metadata: $1 -> $2"
}

mkdir -p "$OUT"
fetch "$IDP_BASE_URL/metadata" "$OUT/idp-metadata.xml"
fetch "$SP_BASE_URL/saml/metadata" "$OUT/sp-metadata.xml"

if [ "${1:-}" = "--no-restart" ]; then
  echo "export-metadata: skipped restart; run 'docker compose restart idp sp-api' to load the files"
else
  docker compose restart idp sp-api
fi
