# LedgerSeal Offline Evidence Verifier

> Independent, zero-dependency offline verifier for cryptographic approval evidence produced by LedgerSeal for Jira Cloud.

[![Test](https://github.com/asymm-systems/ledgerseal-verifier/actions/workflows/test.yml/badge.svg)](https://github.com/asymm-systems/ledgerseal-verifier/actions)
[![License](https://img.shields.io/badge/License-Apache_2.0-blue.svg)](LICENSE)

---

## 1. Overview

**LedgerSeal** provides tamper-evident cryptographic approval seals and post-approval change control for Jira issues. When an authorized lead approves an issue, LedgerSeal takes a canonical snapshot of covered fields, comments, and attachments, computes a SHA-256 hash, chains it into a tamper-evident audit history, and signs the attestation with an Ed25519 private key.

This repository provides an open-source, offline verification script (`verify-evidence.mjs`) that allows compliance officers, security auditors, and release engineers to verify exported evidence files independently, without needing access to Jira, the LedgerSeal app, or any external network service.

### Design Principles
- **Zero Dependencies:** Uses Node.js standard library only (`node:crypto`, `node:fs`, `node:path`). No external npm packages.
- **Air-Gapped Execution:** Runs completely offline. Zero network calls or external egress.
- **Deterministic Canonicalization:** Implements Canonical JSON (sorted UTF-16 code units, zero whitespace, strict type serialization) matching LedgerSeal specification v2 section 4.

---

## 2. Verification Mechanics

When you run `verify-evidence.mjs`, four sequential checks are executed:

| Stage | Check | Description | Failure Indication |
|---|---|---|---|
| **1** | **Snapshot Hash** | Recomputes SHA-256 over canonical JSON of `evidence.snapshot` and compares against `attestation.snapshotHash`. | Ticket fields, comments, or attachments were altered after approval. |
| **2** | **History Hash Chain** | Traverses every sequential entry from genesis (`0000...0000`) checking `prevEntryHash` and cryptographic continuity. | Audit history was truncated, reordered, or edited. |
| **3** | **Certificate Match** | Verifies that the attestation points to the newest valid seal certificate in the audit history. | Attestation does not reflect the current active seal. |
| **4** | **Ed25519 Signature** | Cryptographically verifies the digital signature over canonical attestation fields using the vendor public key. | Attestation was fabricated, forged, or signed with an unauthorized key. |

---

## 3. Installation & Quickstart

### Prerequisites
- Node.js 18.0.0 or higher.

### Clone Repository
```bash
git clone https://github.com/asymm-systems/ledgerseal-verifier.git
cd ledgerseal-verifier
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

---

## 4. Usage

### Command Line Interface
```bash
node verify-evidence.mjs <evidence.json> [public-key.pem]
```

- `<evidence.json>`: Path to the exported LedgerSeal evidence JSON file.
- `[public-key.pem]`: (Optional) Path to the Ed25519 public key file. If omitted, the verifier automatically looks for `keys/<keyId>.pub.pem` matching the `keyId` declared in the evidence file.

### Example: Verifying an Authentic Export
```bash
node verify-evidence.mjs test/fixtures/valid-evidence.json test/fixtures/test-key.pub.pem
```

Output:
```text
PASS snapshot hash
PASS history chain (1 entries)
PASS attestation names the newest seal
PASS signature (test-key)
```

### Exit Codes
- `0`: All four verification stages passed. The evidence is authentic and untampered.
- `1`: One or more verification checks failed. The evidence has been tampered with or signature is invalid.
- `2`: Command line usage error, missing argument, or file not found.

---

## 5. How to Export Evidence from Jira

1. Open the sealed Jira issue in your browser.
2. Locate the **LedgerSeal Audit Gate** issue panel in the right sidebar.
3. Click the certificate details view (`[SEALED]` lozenge).
4. Click **Export Audit Evidence (JSON)**.
5. Save the resulting JSON file (e.g. `DEMO-101-evidence.json`).
6. Run `node verify-evidence.mjs DEMO-101-evidence.json`.

---

## 6. Public Keys

Official public keys are published under the `keys/` directory:

| Key ID | Environment | Algorithm | Public Key Path |
|---|---|---|---|
| `ls-dev-2026-11` | Atlassian Forge Development / Staging | Ed25519 | `keys/ls-dev-2026-11.pub.pem` |

---

## 7. Automated Testing

Run the built-in test suite:
```bash
npm test
```
Or directly with Node test runner:
```bash
node --test test/verify.test.mjs
```

---

## 8. License & Support

- **License:** Apache License 2.0. See [LICENSE](LICENSE) for details.
- **Publisher:** Asymm Systems (`https://asymm.systems`)
- **Security Inquiries:** `security@asymm.systems`
- **Documentation:** `https://docs.asymm.systems/apps/ledgerseal/open-verifier`
