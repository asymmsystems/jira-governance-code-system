# LedgerSeal Offline Open Verifier

> Open-source, zero-dependency Node.js script for independently verifying LedgerSeal evidence exports.

The LedgerSeal offline verifier allows compliance officers, security auditors, and release engineers to verify exported evidence files independently, without needing access to Jira, the LedgerSeal app, or any external network service.

---

## 1. Verifier Design

- **Zero Dependencies:** Uses standard library `node:crypto`, `node:fs`, and `node:path` only. No external npm packages.
- **Air-Gapped Execution:** Runs completely offline with zero external network egress.
- **Monorepo Package Location:** https://github.com/asymmsystems/jira-governance-code-system/tree/master/tools/verifier

---

## 2. Four Verification Checks

When executed against an evidence export, the script performs four sequential checks:

1. **Snapshot Hash:** Recomputes the SHA-256 digest over the Canonical JSON representation of `evidence.snapshot` and compares it to `attestation.snapshotHash`.
2. **History Hash Chain:** Traverses every sequential entry in `evidence.history`, checking genesis (`0000...0000`), `prevEntryHash`, and hash chaining continuity.
3. **Certificate Match:** Verifies that the attestation points to the newest valid seal certificate in the audit history.
4. **Ed25519 Digital Signature:** Cryptographically verifies the digital signature over canonical attestation fields using the published vendor public key.

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
PASS signature (ls-dev-2026-11)
```

### Exit Codes
- `0`: All four verification stages passed. The evidence is authentic and untampered.
- `1`: One or more verification checks failed. The evidence has been tampered with or signature is invalid.
- `2`: Command line usage error, missing argument, or file not found.

---

## 4. Published Public Keys

Official public keys are published in the verifier repository under `keys/`:

| Key ID | Environment | Algorithm | Public Key Path |
|---|---|---|---|
| `ls-dev-2026-11` | Atlassian Forge Development / Staging | Ed25519 | `keys/ls-dev-2026-11.pub.pem` |

```text
-----BEGIN PUBLIC KEY-----
MCowBQYDK2VwAyEA3tGVQVDUPkk1+tAc9mYyPIAeTY+/qruaXJyTXrFKQpw=
-----END PUBLIC KEY-----
```
