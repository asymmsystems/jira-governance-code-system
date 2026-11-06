# LedgerSeal public keys

LedgerSeal signs the `ledgerseal-cert` issue property with Ed25519 (spec v2 section 8). An auditor or another tool checks a signature with the public key whose file name matches the attestation's `keyId`.

| keyId | Environment | File |
|---|---|---|
| `ls-dev-2026-11` | Forge development | `ls-dev-2026-11.pub.pem` |
| `ls-prod-2026-11` | Forge production (the Marketplace app) | `ls-prod-2026-11.pub.pem`, added by the owner with the commands in `docs/sdlc/ledgerseal-marketplace-fixes-2026-11/progress-log.md` |

- Private keys are never stored in this repository. Each one is set as the encrypted Forge variable `LEDGERSEAL_SIGNING_KEY` for its environment.
- The vendor holds the private keys. A valid signature shows that LedgerSeal wrote the attestation. It does not protect against the vendor.
- Rotation: a new key gets a new `keyId` and a new file here and in https://github.com/asymmsystems/ledgerseal-verifier/tree/main/keys. Readers accept the old key for the overlap period stated in the release notes. Evidence is signed again at export with the current key, so an old export keeps its old key id.
- When a Forge environment has no key, LedgerSeal logs every unsigned write and the panel shows a warning; it never writes unsigned attestations silently.
