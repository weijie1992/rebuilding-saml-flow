#!/bin/sh
# Generate the IdP's signing key pair.
#
# SAML concept: the IdP signs every Assertion with its PRIVATE key (idp.key).
# The SP learns the matching PUBLIC certificate (idp.crt) out-of-band, via the
# IdP's metadata — never from the SAML message itself. A self-signed cert is
# normal for SAML: trust comes from metadata exchange, not from a CA chain.
#
# Usage: gen-keys.sh [output-dir]   (default: ./shared/keys)
# Idempotent: does nothing if the key and cert already exist.
set -eu

OUT="${1:-$(dirname "$0")/../shared/keys}"
mkdir -p "$OUT"

if [ -f "$OUT/idp.key" ] && [ -f "$OUT/idp.crt" ]; then
  echo "keygen: $OUT/idp.key and idp.crt already exist, skipping"
  exit 0
fi

echo "keygen: generating RSA-2048 key + self-signed cert (365 days) in $OUT"
openssl req -x509 -newkey rsa:2048 -nodes -sha256 -days 365 \
  -subj "/CN=SAML Lab IdP Signing" \
  -keyout "$OUT/idp.key" \
  -out "$OUT/idp.crt"

# The IdP container runs as a non-root user and must be able to read the key.
chmod 644 "$OUT/idp.key" "$OUT/idp.crt"
echo "keygen: done"
