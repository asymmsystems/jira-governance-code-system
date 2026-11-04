# Atlassian Marketplace Listing: LedgerSeal

## App Information
* **App Title:** LedgerSeal
* **Tagline:** Tamper-evident approval seals and post-approval change control for Jira.
* **Categories:** Security, Workflow & Automation, Project Management

---

## Short Highlight Description (Max 250 chars)
Seal Jira issues cryptographically at approval. LedgerSeal tracks post-approval edits with SHA-256 snapshot hashes, blocks unapproved releases at workflow gates, and provides standalone offline Ed25519 signature verification. (227 characters)

---

## The Unaddressed Native Problem

Standard Jira records when issue changes happen in its change history, but native Jira workflows cannot prove whether an approved ticket remained authentic before release. 

Consider the standard release trap:
1. At 10:00 AM, QA and compliance leadership formally approve ticket `DEMO-101` for production deployment.
2. At 2:00 PM, a developer edits the ticket description, modifies acceptance criteria, or changes an attached configuration script.
3. At 4:00 PM, the ticket moves cleanly to **Done** and deploys to production. 

Standard Jira permission schemes cannot prevent this without locking the entire project into read-only mode, which breaks active sprint execution. Jira's audit log shows an edit occurred, but native Jira cannot answer the auditor's core question: **"Was the exact work deployed identical to what leadership approved?"**

LedgerSeal solves this by binding the approval directly to the issue content with cryptographic snapshot hashing, tamper-evident seals, automated workflow transition gates, and open offline verification.

---

## Key Capabilities & Verifiable Proof

| Capability | Underlying Mechanism | Verifiable Proof in Code & Tests |
|---|---|---|
| **Cryptographic Content Snapshot** | Computes SHA-256 digest over Canonical JSON of covered fields, comments, and attachments. | `apps/ledgerseal/src/domain/canonicalizer.ts`, `apps/ledgerseal/test/canonicalizer.test.ts` |
| **Post-Approval Tamper Detection** | Detects modifications immediately via issue update events and UI reconciliation, attributing who changed what. | `apps/ledgerseal/src/domain/tamper-detector.ts`, `apps/ledgerseal/test/tamper-detector.test.ts` |
| **Separation of Duties** | Enforces that ticket editors cannot approve their own changes. Prevents self-approval bypasses. | `apps/ledgerseal/src/storage/seal-repository.ts`, `apps/ledgerseal/test/security-adversarial.test.ts` |
| **Tamper-Evident History Chain** | Hash-chained audit trail from genesis (`0000...0000`) where every seal, edit, reseal, or revocation is linked. | `apps/ledgerseal/src/domain/history.ts`, `apps/ledgerseal/test/history-chain.test.ts` |
| **Workflow Transition Gate** | Jira workflow validator blocks issue transition to Done if unsealed, broken, or modified post-approval. | `apps/ledgerseal/src/validator/workflow-validator.ts`, `apps/ledgerseal/test/workflow-validator.test.ts` |
| **Ed25519 Digital Signatures** | Attestation signed with Ed25519 asymmetric cryptography using published vendor public keys. | `apps/ledgerseal/src/domain/crypto.ts`, `apps/ledgerseal/keys/ls-dev-2026-11.pub.pem` |
| **Standalone Offline Verifier** | Open-source Node.js script verifies exported evidence offline using standard library `node:crypto` only. | `tools/verifier/verify-evidence.mjs`, `tools/verifier/test/verify.test.mjs` |

---

## Enterprise Compliance Grounding

LedgerSeal provides technical controls that support customer compliance across regulated industries:

- **SOC 2 Type II (Trust Services Criteria CC8.1):** Supports change authorization controls by cryptographically guaranteeing that code and configuration changes moving to production match approved tickets.
- **ISO/IEC 27001:2022 (Control A.8.32 Change Management):** Enforces separation of duties and tamper detection on change tickets.
- **FDA 21 CFR Part 11 (Electronic Records & Signatures):** Supports electronic signature manifestation (21 CFR 11.50) and signature-to-record linking (21 CFR 11.70) by binding the approver identity, timestamp, and meaning directly to the hashed ticket state.

*Honest Compliance Boundary:* LedgerSeal provides technical enforcement tools. It does not certify your organization. Regulatory compliance is determined by your external auditors based on your overall operating procedures and system validation.

---

## Data Privacy & "Runs on Atlassian" Architecture Guarantee

- **100% Forge Native Execution:** LedgerSeal executes entirely within Atlassian Cloud compute infrastructure.
- **Zero External Egress:** The app manifest contains zero egress endpoints (`permissions.external.fetch.backend` is completely absent). No data ever leaves your Atlassian tenant.
- **Customer Tenant Storage:** All seal records, audit chains, and certificates reside in your tenant Atlassian Forge Key-Value Storage (KVS).
- **Data Residency Compliance:** Your data remains stored in the same geographic region as your Jira Cloud instance.

---

## Transparent Pricing

| Tier | Monthly Price | Annual Price (2 Months Free) |
|---|---|---|
| **1 to 10 Users** | **Free** | **Free** |
| **11 to 100 Users** | $1.50 per user / month | $15.00 per user / year |
| **101 to 250 Users** | $1.20 per user / month | $12.00 per user / year |
| **251 to 1,000 Users** | $0.90 per user / month | $9.00 per user / year |

*All billing is handled natively through your existing Atlassian invoice.*

---

## Retina Screenshot Gallery Manifest

1. `01-sealed-panel.png` - **Cryptographic Issue Panel:** Issue in verified sealed state showing SHA-256 snapshot hash, approver identity, and certificate status.
2. `02-tamper-detected.png` - **Instant Tamper Detection:** Clear alert indicating issue description was edited post-approval with user attribution.
3. `03-transition-blocked.png` - **Enforcement Gate:** Workflow validator blocks transition into Done status because content was altered.
4. `04-admin-approvers.png` - **Approver Governance:** Admin settings page configuring authorized approver groups under the Uniform Permission Standard.
5. `05-certificate.png` - **Audit Certificate:** Expanded cryptographic attestation certificate ready for one-click JSON export.

---

## Support, Documentation & Legal Links

- **Documentation Portal:** https://docs.asymm.systems/apps/ledgerseal/
- **Offline Verifier Documentation & Source:** https://docs.asymm.systems/apps/ledgerseal/open-verifier
- **Privacy Policy:** https://asymm.systems/privacy
- **Terms of Service:** https://asymm.systems/terms
- **Support Portal & SLA:** https://asymm.systems/support
- **Direct Support Contact:** `support@asymm.systems`
