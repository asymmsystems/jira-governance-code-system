#!/bin/sh
# Copyright (c) 2026 Asymm Systems. All rights reserved.
#
# @author Fahim Farook
#
# Generates a new Ed25519 signing key for LedgerSeal or DefinitionGuard, as step 1 of
# docs/security/signing-key-rotation.md.
#
# What it does:
#   - makes a new temporary directory with mode 700 and writes the key pair only there;
#   - prints the public key (SPKI PEM) and the SHA-256 fingerprint of the DER public key;
#   - checks that the private key signs and the public key verifies a test message;
#   - prints, but does NOT run, the forge variables commands for the new key.
#
# What it never does:
#   - print the private key;
#   - write a file outside the temporary directory;
#   - call forge, git or the network.
#
# Usage:
#   tools/rotate-signing-key.sh [--dry-run] <ledgerseal|definitionguard> <production|development> [key-id]
#
#   key-id    Defaults to <ls|dg>-<prod|dev>-<YYYY-MM of today>, for example ls-prod-2026-12.
#   --dry-run Generates a throwaway key, prints the same output, and deletes the temporary
#             directory before it exits. Use it to test the script.
#
# Without --dry-run the temporary directory is kept, so that you can set the Forge variables
# from it. Delete it with the shred command that the script prints at the end.
#
# Needs: OpenSSL 3 (Ed25519 and pkeyutl -rawin), mktemp, shred (or rm as a fallback).

set -eu

DRY_RUN=0
usage() {
    echo "Usage: $0 [--dry-run] <ledgerseal|definitionguard> <production|development> [key-id]" >&2
    exit 2
}

# ---- Arguments ---------------------------------------------------------------------------
if [ "${1:-}" = "--dry-run" ]; then
    DRY_RUN=1
    shift
fi
[ $# -ge 2 ] && [ $# -le 3 ] || usage
APP=$1
ENVIRONMENT=$2

case "$APP" in
    ledgerseal)      PREFIX=ls; KEY_VAR=LEDGERSEAL_SIGNING_KEY; ID_VAR=LEDGERSEAL_KEY_ID ;;
    definitionguard) PREFIX=dg; KEY_VAR=DG_SIGNING_KEY;         ID_VAR=DG_SIGNING_KEY_ID ;;
    *) usage ;;
esac
case "$ENVIRONMENT" in
    production)  ENV_PART=prod ;;
    development) ENV_PART=dev ;;
    *) usage ;;
esac

KEY_ID=${3:-$PREFIX-$ENV_PART-$(date +%Y-%m)}
# A key id is public and becomes a file name: allow only the published naming pattern.
if ! printf '%s\n' "$KEY_ID" | grep -Eq "^$PREFIX-$ENV_PART-[0-9]{4}-[0-9]{2}(-[a-z0-9]+)?\$"; then
    echo "Key id '$KEY_ID' does not match $PREFIX-$ENV_PART-YYYY-MM (an optional -suffix is allowed)." >&2
    exit 2
fi

# A key id names exactly one key, for ever. Refuse an id that the repository already uses
# (read only: the trust list of FourRealities and the published key files).
REPO_ROOT=$(cd "$(dirname "$0")/.." && pwd)
if grep -q "keyId: '$KEY_ID'" "$REPO_ROOT/apps/fourrealities/src/accessor/attestation-keys.ts" 2>/dev/null \
    || [ -e "$REPO_ROOT/apps/ledgerseal/keys/$KEY_ID.pub.pem" ] \
    || [ -e "$REPO_ROOT/docs/marketplace/definitionguard-public-key-$KEY_ID.pem" ]; then
    if [ "$DRY_RUN" -eq 1 ]; then
        echo "WARNING: key id '$KEY_ID' is already used. A real run refuses it; pass a new key id." >&2
    else
        echo "Key id '$KEY_ID' is already used in this repository. Pass a new key id as the third argument." >&2
        exit 2
    fi
fi

command -v openssl >/dev/null 2>&1 || { echo "openssl is not installed." >&2; exit 1; }

# ---- Temporary directory -----------------------------------------------------------------
# umask 077 makes every file below readable by the owner only; the directory itself is 700.
umask 077
WORK_DIR=$(mktemp -d "${TMPDIR:-/tmp}/signing-key.XXXXXXXX")
chmod 700 "$WORK_DIR"

wipe() {
    # Overwrite, then remove, every file in the temporary directory, then the directory.
    for f in "$WORK_DIR"/*; do
        [ -f "$f" ] || continue
        if command -v shred >/dev/null 2>&1; then shred -u "$f"; else rm -f "$f"; fi
    done
    rmdir "$WORK_DIR"
}

if [ "$DRY_RUN" -eq 1 ]; then
    # A dry run leaves nothing behind, also when a step fails.
    trap wipe EXIT
    trap 'exit 1' INT TERM HUP
else
    # A real run keeps the directory for the forge commands, but removes it when a step fails.
    trap 'if [ $? -ne 0 ]; then wipe; fi' EXIT
    trap 'exit 1' INT TERM HUP
fi

PRIVATE_PEM="$WORK_DIR/$KEY_ID.key.pem"   # PKCS#8 PEM. Secret: never printed.
PUBLIC_PEM="$WORK_DIR/$KEY_ID.pub.pem"    # SPKI PEM. Public.

# ---- Generate the key pair ---------------------------------------------------------------
openssl genpkey -algorithm ed25519 -out "$PRIVATE_PEM" 2>/dev/null
openssl pkey -in "$PRIVATE_PEM" -pubout -out "$PUBLIC_PEM"
FINGERPRINT=$(openssl pkey -pubin -in "$PUBLIC_PEM" -outform DER | openssl dgst -sha256 -r | cut -d ' ' -f 1)

# ---- Check that the pair works -----------------------------------------------------------
printf 'asymm signing key self-test %s\n' "$KEY_ID" > "$WORK_DIR/self-test.txt"
openssl pkeyutl -sign -rawin -inkey "$PRIVATE_PEM" -in "$WORK_DIR/self-test.txt" -out "$WORK_DIR/self-test.sig"
openssl pkeyutl -verify -rawin -pubin -inkey "$PUBLIC_PEM" -in "$WORK_DIR/self-test.txt" -sigfile "$WORK_DIR/self-test.sig" >/dev/null
rm -f "$WORK_DIR/self-test.txt" "$WORK_DIR/self-test.sig"

# ---- Output ------------------------------------------------------------------------------
[ "$DRY_RUN" -eq 1 ] && echo "DRY RUN: a throwaway key. It is deleted when this script exits. Do not publish it."
echo
echo "App:          $APP"
echo "Environment:  $ENVIRONMENT"
echo "Key id:       $KEY_ID"
echo "Algorithm:    Ed25519"
echo "SHA-256 fingerprint of the DER public key:"
echo "  $FINGERPRINT"
echo "Self-test:    the private key signed and the public key verified a test message."
echo
echo "Public key (SPKI PEM), also in $PUBLIC_PEM:"
cat "$PUBLIC_PEM"
echo

# The Forge variable formats come from the app code:
#   LedgerSeal       apps/ledgerseal/src/domain/attestation.ts       base64 of the PKCS#8 DER private key
#   DefinitionGuard  apps/definitionguard/src/integrity/attestation.ts base64 of the PKCS#8 PEM private key
if [ "$APP" = ledgerseal ]; then
    VALUE_CMD="openssl pkey -in '$PRIVATE_PEM' -outform DER | openssl base64 -A"
else
    VALUE_CMD="openssl base64 -A -in '$PRIVATE_PEM'"
fi

echo "Forge commands. NOT run by this script. Run them from apps/$APP only at step 4 of"
echo "docs/security/signing-key-rotation.md, after FourRealities trusts the new key:"
echo
echo "  forge variables set -e $ENVIRONMENT --encrypt $KEY_VAR \"\$($VALUE_CMD)\""
echo "  forge variables set -e $ENVIRONMENT $ID_VAR $KEY_ID"
echo
if [ "$DRY_RUN" -eq 1 ]; then
    echo "DRY RUN: the temporary directory $WORK_DIR is deleted now."
else
    echo "After you have stored the private key in the password manager and set the Forge"
    echo "variables, delete the temporary directory:"
    echo
    echo "  shred -u '$WORK_DIR'/* && rmdir '$WORK_DIR'"
fi
