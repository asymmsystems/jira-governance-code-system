# LedgerSeal Offline Open Verifier

> Open-source, zero-dependency Node.js script for independently verifying LedgerSeal evidence exports.

The LedgerSeal offline verifier allows compliance officers, security auditors, and release engineers to verify exported evidence files independently, without needing access to Jira, the LedgerSeal app, or any external network service.

---

## 1. Verifier Design

- **Zero Dependencies:** Uses standard library `node:crypto`, `node:fs`, and `node:path` only. No external npm packages.
- **Air-Gapped Execution:** Runs completely offline with zero external network egress.
- **Monorepo Package Location:** https://github.com/asymmsystems/jira-governance-code-system/tree/master/tools/verifier

---

## 2. Five Verification Checks

When executed against an evidence export, the script performs five sequential checks:

1. **Snapshot Hash:** Recomputes the SHA-256 digest over the Canonical JSON representation of `evidence.snapshot` and compares it to `attestation.snapshotHash`.
2. **History Hash Chain:** Traverses every sequential entry in `evidence.history`, checking genesis (`0000...0000`), `prevEntryHash`, and hash chaining continuity.
3. **Certificate Match:** Verifies that the attestation points to the newest valid seal certificate in the audit history.
4. **Status:** Verifies that `attestation.status` is the state of the newest history entry that is not a redaction (`SEAL_VALID` for a seal, `SEAL_BROKEN` for a change, `SEAL_REVOKED` for a revoke).
5. **Ed25519 Digital Signature:** Cryptographically verifies the digital signature over canonical attestation fields using the published vendor public key.

---

## 3. Usage & Command Line Interface

```bash
node verify-evidence.mjs <evidence.json> [public-key.pem]
```

### Self-Test
Verify that the canonical JSON encoder matches test vectors:
```bash
node verify-evidence.mjs --self-test
```
Expected output:
```text
PASS 10 of 10 vectors
```

### Verifying an Evidence File
```bash
node verify-evidence.mjs DEMO-101-evidence.json keys/ls-dev-2026-11.pub.pem
```

Expected output:
```text
PASS snapshot hash
PASS history chain (3 entries)
PASS attestation names the newest seal
PASS attestation status matches the history (SEAL_VALID)
PASS signature (ls-dev-2026-11)
```

> This worked example uses the development key `ls-dev-2026-11`. Evidence exported from the Marketplace app names the production key `ls-prod-2026-11` in `attestation.keyId`: run `node verify-evidence.mjs <evidence.json> keys/ls-prod-2026-11.pub.pem`, and the signature line reads `PASS signature (ls-prod-2026-11)`.

### Exit Codes
- `0`: Every check passed. The attestation was signed with the private key that belongs to the public key you used and has not been changed since; the snapshot is the one it names; and the history is one unbroken hash chain whose newest seal and state match it (in format 2, so are the signing policies, route versions and run signatures that the history names). Only the attestation is signed: the other parts are bound to it by hashes. This does not show that nobody could have written a different, consistent record: Asymm Systems holds the signing key, and anyone who can rewrite the app's stored data, including the vendor, could write a new consistent chain.
- `1`: At least one check failed, and the FAIL lines name which. The evidence may have been changed after it was exported, or the public key file you gave is not the key that signed it, or a part of the evidence is missing.
- `2`: Command line usage error, missing argument, or file not found.

---

## 4. Published Public Keys

Official public keys are published in the verifier repository under `keys/`:

| Key ID | Environment | Algorithm | Public Key Path |
|---|---|---|---|
| `ls-prod-2026-11` | Atlassian Forge Production (the Marketplace app) | Ed25519 | `keys/ls-prod-2026-11.pub.pem` |
| `ls-dev-2026-11` | Atlassian Forge Development / Staging (development builds only) | Ed25519 | `keys/ls-dev-2026-11.pub.pem` |

`ls-prod-2026-11` (production, the Marketplace app; SHA-256 of the DER public key `09f2b807adc803a7f687e0561e90b8dcadadd6c1d752c66b55980a27b89cc5d3`, release v1.3.0):

```text
-----BEGIN PUBLIC KEY-----
MCowBQYDK2VwAyEATeL77D87DnKc6DSKrt1kAfh0SIW0ok4NoALB371b/VE=
-----END PUBLIC KEY-----
```

`ls-dev-2026-11` (development builds only; SHA-256 of the DER public key `cecef4ee9d75298c9107ede72389edd5be59562027363aca90092b70b8c7d283`):

```text
-----BEGIN PUBLIC KEY-----
MCowBQYDK2VwAyEA3tGVQVDUPkk1+tAc9mYyPIAeTY+/qruaXJyTXrFKQpw=
-----END PUBLIC KEY-----
```

Fingerprint: `openssl pkey -pubin -in <key file> -outform DER | sha256sum`.
