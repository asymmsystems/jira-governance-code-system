# LedgerSeal public keys

LedgerSeal signs the `ledgerseal-cert` issue property with Ed25519 (spec v2 section 8). An auditor or another tool checks a signature with the public key whose file name matches the attestation's `keyId`.

| keyId | Environment | File |
|---|---|---|
| `ls-dev-2026-11` | Forge development | `ls-dev-2026-11.pub.pem` |
| `ls-prod-2026-11` | Forge production (the Marketplace app) | `ls-prod-2026-11.pub.pem`, published 2026-11-06, SHA-256 of the DER public key `09f2b807adc803a7f687e0561e90b8dcadadd6c1d752c66b55980a27b89cc5d3` |

- Fingerprint: `openssl pkey -pubin -in ls-prod-2026-11.pub.pem -outform DER | sha256sum`. The same keys are listed on https://asymm.systems/product/jira-governance/signing-keys.html and in release v1.3.0 of https://github.com/asymmsystems/ledgerseal-verifier.
- Private keys are never stored in this repository. Each one is set as the encrypted Forge variable `LEDGERSEAL_SIGNING_KEY` for its environment.
- The vendor holds the private keys. A valid signature shows that LedgerSeal wrote the attestation. It does not protect against the vendor.
- Rotation: a new key gets a new `keyId` and a new file here and in https://github.com/asymmsystems/ledgerseal-verifier/tree/main/keys. Readers accept the old key for the overlap period stated in the release notes. Evidence is signed again at export with the current key, so an old export keeps its old key id.
- When a Forge environment has no key, LedgerSeal logs every unsigned write and the panel shows a warning; it never writes unsigned attestations silently.
