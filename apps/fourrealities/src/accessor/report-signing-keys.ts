/**
 * Copyright (c) 2026 Asymm Systems. All rights reserved.
 * @author Fahim Farook
 * FourRealities: the published public keys of the evidence report signing keys (spec v4 section 4.3, release
 * review REL-3). The signer refuses a configured private key whose public half is not the key published here for
 * its key id. Each entry is a copy of apps/fourrealities/keys/<keyId>.pub.pem; a test checks they are the same.
 */

/** SPKI PEM of each published Ed25519 public key, by key id. */
export const REPORT_SIGNING_KEYS: Readonly<Record<string, string>> = {
  // SHA-256 (DER): f2ad70911a15f39cf37570f86fb3b55e7cf62b48b65bbfd50c8f649de01b979f.
  'fr-dev-2026-11': '-----BEGIN PUBLIC KEY-----\nMCowBQYDK2VwAyEAhX7QRARkKnuAGHXDsHQ4ZaDKJPEF5EavHdzCNZg6l0M=\n-----END PUBLIC KEY-----\n',
  // SHA-256 (DER): 07b6b5e5749e282627a112d99dac364e199b4a355913e1b820145221cca30419.
  'fr-prod-2026-11': '-----BEGIN PUBLIC KEY-----\nMCowBQYDK2VwAyEAeRTLhQgqB3xygQvZ2TPKPlWSqzQie4ihk1M8iqo5634=\n-----END PUBLIC KEY-----\n'
};
