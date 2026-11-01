# LedgerSeal public keys

LedgerSeal signs the `ledgerseal-cert` issue property with Ed25519 (spec v2 section 8). An auditor or another tool checks a signature with the public key whose file name matches the attestation's `keyId`.

| keyId | Environment | File |
|---|---|---|
| `ls-dev-2026-11` | Forge development | `ls-dev-2026-11.pub.pem` |

- Private keys are never stored in this repository. Each one is set as the encrypted Forge variable `LEDGERSEAL_SIGNING_KEY` for its environment.
- The vendor holds the private keys. A valid signature shows that LedgerSeal wrote the attestation. It does not protect against the vendor.
- Rotation: a new key gets a new `keyId` and a new file here. Readers accept the old key for the overlap period stated in the release notes.
