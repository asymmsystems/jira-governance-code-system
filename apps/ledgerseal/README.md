# LedgerSeal: Immutable Audit Seal & Sign-Off Gate for Jira

**LedgerSeal** transforms Atlassian Jira into an audit-grade **System of Record (SoR)**. It provides cryptographic state sealing, automated post-approval tamper detection, FDA 21 CFR Part 11 compliant electronic signatures, and workflow transition gating.

Built natively on **Atlassian Forge ("Runs on Atlassian")** with **zero external data egress**.

---

## Key Features

1. **Cryptographic State Sealing:**
   Computes a deterministic SHA-256 hash snapshot of all issue fields (standard and custom fields), attachments, and approver details upon sign-off.
2. **Automated Tamper Detection:**
   Continuously verifies the live Jira issue against the sealed certificate. If any field or attachment is altered after approval, it immediately displays a `SEAL BROKEN (TAMPER DETECTED)` alert with an exact field-level diff.
3. **Workflow Transition Gate (Validator):**
   Blocks ticket transitions to "Closed", "Released", or "Production" unless the issue has an active, untampered cryptographic seal.
4. **Electronic Signatures (21 CFR Part 11 & SOX):**
   Requires explicit signer identity, timestamp, meaning statement, and legal declaration checkbox.
5. **Zero External Egress:**
   Executes 100% serverless within Atlassian's secure AWS cloud. Uses native Forge Key-Value entity storage. No customer data ever leaves Atlassian.

---

## Architecture Overview

```
[Jira Issue View]
       |
       +---> [Forge UI Kit 2 Panel] (src/frontend/index.tsx)
       |            |
       |            +---> invoke('verify-issue-api')
       |            +---> invoke('seal-issue-api')
       |
[Jira Workflow Engine]
       |
       +---> [Workflow Validator] (src/validator/workflow-validator.ts)
                    |
                    +---> Checks cert:active:issue:{issueId}
                    +---> Compares live SHA-256 hash vs sealed hash
                    +---> ALLOW or BLOCK transition
```

---

## Verification & Test Suite

The test suite enforces $\ge 90\%$ branch coverage and comprehensive adversarial checks:

* **Unit Tests:** 52 automated tests across 8 test suites.
* **Coverage:** 100% Statements, 93.26% Branches, 100% Functions, 100% Lines.
* **Adversarial Checks:**
  * Single-bit hash manipulation detection.
  * Signer identity spoofing detection.
  * Float / numeric precision tampering detection (e.g., CVSS 9.8 to 9.81).
  * Static code analysis confirming zero external networking modules.
  * Verification of Forge storage 32 KB per-item constraints.

### Running Tests

```bash
npm install
npm test
npm run build
```
