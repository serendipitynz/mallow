#!/usr/bin/env sh
# Register the GitHub Actions secrets that .github/workflows/release.yml needs
# to sign + notarize macOS builds in CI. The Apple account values (APPLE_ID /
# APPLE_PASSWORD / APPLE_TEAM_ID) are read from .env.signing; the certificate
# comes from a password-protected .p12 you export from Keychain Access, and
# APPLE_SIGNING_IDENTITY is derived from that .p12's certificate common name.
#
# Deriving the identity from the .p12 (rather than copying .env.signing's
# APPLE_SIGNING_IDENTITY) is deliberate: local signing accepts a SHA-1 hash as
# the identity, but tauri-action in CI string-matches the imported certificate's
# common name against APPLE_SIGNING_IDENTITY — a hash there fails the build.
# No secret value is printed — each is piped straight into `gh secret set`.
#
# This covers the six Apple secrets only. release.yml also needs
# TAURI_SIGNING_PRIVATE_KEY and TAURI_SIGNING_PRIVATE_KEY_PASSWORD for updater
# signing, and they are deliberately not registered here: this script takes a
# .p12 as a required argument, so rotating only the updater key would demand the
# whole certificate. Set those two by hand (AGENTS.md "Signed self-update").
#
# Usage:
#   ./scripts/setup-ci-signing-secrets.sh path/to/DeveloperID.p12
#
# Export the certificate first: Keychain Access > login > My Certificates >
# "Developer ID Application: <Name> (<TEAMID>)" > right-click > Export…, save as
# a .p12 and set an export password (you'll type it below).
#
# Prerequisites: `gh` authenticated for this repo (`gh auth status`) and a
# filled-in .env.signing (see .env.signing.example).
set -eu

root=$(CDPATH= cd "$(dirname "$0")/.." && pwd)
env_file="$root/.env.signing"
p12="${1:-}"

if [ -z "$p12" ]; then
  echo "usage: $0 path/to/DeveloperID.p12" >&2
  exit 1
fi
[ -f "$p12" ] || { echo "error: certificate '$p12' not found." >&2; exit 1; }
[ -f "$env_file" ] || {
  echo "error: $env_file not found — copy .env.signing.example and fill it in." >&2
  exit 1
}

# Load APPLE_ID / APPLE_PASSWORD / APPLE_TEAM_ID without echoing them.
# (APPLE_SIGNING_IDENTITY is derived from the .p12 below, not from this file.)
set -a
# shellcheck source=/dev/null
. "$env_file"
set +a

# Prompt for the .p12 export password with echo off.
printf 'Export password for %s: ' "$p12"
stty -echo 2>/dev/null || true
IFS= read -r p12_password
stty echo 2>/dev/null || true
printf '\n'

# Derive the signing identity from the certificate inside the .p12 so it always
# matches APPLE_CERTIFICATE. Try modern openssl first, then -legacy (OpenSSL 3
# needs it to read the ciphers Keychain exports use; LibreSSL ignores the retry).
# The export password is fed on stdin (-passin stdin), never on argv, so it stays
# out of process listings.
signing_identity=''
for legacy in '' '-legacy'; do
  signing_identity=$(
    printf '%s' "$p12_password" \
      | openssl pkcs12 $legacy -in "$p12" -passin stdin -nokeys -clcerts 2>/dev/null \
      | openssl x509 -noout -subject -nameopt multiline 2>/dev/null \
      | sed -n 's/^[[:space:]]*commonName[[:space:]]*=[[:space:]]*//p' \
      | head -1
  )
  [ -n "$signing_identity" ] && break
done
if [ -z "$signing_identity" ]; then
  echo "error: could not read the certificate from $p12 — wrong export password?" >&2
  exit 1
fi
case "$signing_identity" in
  "Developer ID Application:"*) : ;;
  *) echo "warning: the .p12 is not a 'Developer ID Application' certificate;" \
          "notarization may be rejected." >&2 ;;
esac

# APPLE_CERTIFICATE is the base64-encoded .p12; APPLE_SIGNING_IDENTITY is the
# certificate's common name; the rest come from .env.signing. Piping keeps every
# value off the argv list and out of the logs.
base64 < "$p12"                 | gh secret set APPLE_CERTIFICATE
printf '%s' "$p12_password"     | gh secret set APPLE_CERTIFICATE_PASSWORD
printf '%s' "$signing_identity" | gh secret set APPLE_SIGNING_IDENTITY
printf '%s' "$APPLE_ID"         | gh secret set APPLE_ID
printf '%s' "$APPLE_PASSWORD"   | gh secret set APPLE_PASSWORD
printf '%s' "$APPLE_TEAM_ID"    | gh secret set APPLE_TEAM_ID

echo "Registered signing secrets on $(gh repo view --json nameWithOwner -q .nameWithOwner)."
echo "Verify with: gh secret list"
