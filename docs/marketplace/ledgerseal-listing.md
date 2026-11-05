# Atlassian Marketplace Listing: LedgerSeal

## App Information
* **App Title:** LedgerSeal
* **Tagline:** Tamper-evident approval seals and post-approval change control for Jira.
* **Categories:** Security, Workflow & Automation, Project Management

---

## Short Highlight Description (Max 250 chars)
Seal Jira issues at approval with a SHA-256 snapshot. LedgerSeal detects edits made after approval, names who changed what, blocks moves with a workflow validator, and shows evidence you can check with an offline verifier. (222 characters)

---

## The Unaddressed Native Problem

Standard Jira records when issue changes happen in its change history, but native Jira workflows cannot show whether an approved ticket stayed the same before release.

Consider the standard release trap:
1. At 10:00 AM, QA and compliance leadership formally approve ticket `DEMO-101` for production deployment.
2. At 2:00 PM, a developer edits the ticket description, modifies acceptance criteria, or changes an attached configuration script.
3. At 4:00 PM, the ticket moves cleanly to **Done** and deploys to production.

Standard Jira permission schemes cannot prevent this without locking the entire project into read-only mode, which breaks active sprint execution. Jira's history shows an edit occurred, but native Jira does not answer the auditor's question: **"Is the ticket that reached Done the same ticket that was approved?"**

LedgerSeal addresses this by binding the approval to the issue content with a SHA-256 snapshot hash, a tamper-evident seal history, a workflow transition validator, and an offline verifier.

---

## Key Capabilities & Verifiable Proof

| Capability | Underlying Mechanism | Verifiable Proof in Code & Tests |
|---|---|---|
| **Content Snapshot** | Computes a SHA-256 digest over the canonical JSON of covered fields, comments, and attachments. | `apps/ledgerseal/src/domain/canonicalizer.ts`, `apps/ledgerseal/test/canonicalizer.test.ts` |
| **Post-Approval Change Detection** | Detects changes through issue, comment, attachment, and work log events and when the panel loads. The panel lists each changed item with its value at approval, its current value, and who changed it. | `apps/ledgerseal/src/domain/tamper-detector.ts`, `apps/ledgerseal/src/service/ledger.ts`, `apps/ledgerseal/test/tamper-detector.test.ts` |
| **Separation of Duties** | A user who changed the issue after the last seal cannot approve those changes or revoke the seal. Another approver must do it. | `apps/ledgerseal/src/service/ledger.ts`, `apps/ledgerseal/test/seal-authority.test.ts` |
| **Tamper-Evident History Chain** | Hash-chained history starting from a genesis hash of 64 zeros. Every seal, detected change, approval of changes, and revocation is linked to the entry before it. | `apps/ledgerseal/src/domain/history.ts`, `apps/ledgerseal/test/seal-history.test.ts` |
| **Workflow Transition Gate** | The **Require Valid LedgerSeal** workflow validator blocks the transition when the issue is not sealed, was changed after approval, or the seal was revoked. It also blocks when Jira cannot be read. | `apps/ledgerseal/src/validator/workflow-validator.ts`, `apps/ledgerseal/src/index.ts`, `apps/ledgerseal/test/workflow-validator.test.ts` |
| **Ed25519 Signed Attestation** | When the vendor signing key is configured for the installation, the seal attestation is signed with Ed25519. Without that key the attestation is written unsigned. | `apps/ledgerseal/src/domain/attestation.ts`, `apps/ledgerseal/test/attestation.test.ts`, `apps/ledgerseal/keys/ls-dev-2026-11.pub.pem` |
| **Approver Groups Admin Page** | Jira administrators choose the Jira groups whose members may seal, approve changes, and revoke. Project administrators and Jira administrators always may. | `apps/ledgerseal/src/frontend/admin.tsx`, `apps/ledgerseal/src/service/policy-admin.ts`, `apps/ledgerseal/test/approver-policy.test.ts` |
| **Offline Verifier** | Open-source Node.js script that checks an evidence record offline using the Node standard library only. Exit code 0 when every check passes, 1 when a check fails, 2 for a usage error or a missing file. | `tools/verifier/verify-evidence.mjs`, `tools/verifier/test/verify.test.mjs` |

---

## Enterprise Compliance Grounding

LedgerSeal provides technical controls that support compliance in regulated industries:

- **SOC 2 Type II (Trust Services Criteria CC8.1):** Supports compliance with change authorization controls by recording who approved a Jira issue and detecting changes to that issue after approval.
- **ISO/IEC 27001:2022 (Control A.8.32 Change Management):** Supports compliance with change management through separation of duties and change detection on change tickets.
- **FDA 21 CFR Part 11 (Electronic Records & Signatures):** Supports compliance with signature manifestation (21 CFR 11.50) by recording the approver, the time, and the meaning of the sign-off (Approved, Reviewed, or Verified) with each seal.

*Honest Compliance Boundary:* LedgerSeal provides technical tools. It does not certify your organization. Your auditor decides whether your procedures and system validation meet these frameworks.

---

## Data Privacy & "Runs on Atlassian" Architecture

- **Forge Native Execution:** LedgerSeal runs on Atlassian Forge.
- **No External Egress:** The app manifest declares no external fetch permissions (`permissions.external` is absent). The app calls only the Jira REST API of your site.
- **Forge Storage:** Seal records, history chains, and approver groups are kept in Atlassian Forge key-value storage for your site.
- **Data Residency:** Data residency follows Atlassian's rules for Forge app storage.

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

1. `01-sealed-panel.png` - **RECAPTURE REQUIRED:** The current file shows issue LSP-3 with the Approval Seal panel still loading (grey placeholder bars only). Capture instead: the LedgerSeal panel on a sealed issue with the green SEALED lozenge, "Approval seal: Sealed. No change detected since approval.", and the expanded "Certificate & attestation details" section (Signed by, Sign-off role, hash, covered fields).
2. `02-tamper-detected.png` - **RECAPTURE REQUIRED:** The current file shows issue DEMO-34 with the panel showing "Checking the seal..." and no result. Capture instead: the panel on an issue changed after approval, with the red CHANGED lozenge and the "Changed items" list (Was (at approval), Now (current edit), Changed by).
3. `03-transition-blocked.png` - **RECAPTURE REQUIRED:** The current file is a mock-up modal ("Workflow Transition Blocked" with a check table and an Acknowledge button) that does not exist in Jira or in LedgerSeal. Capture instead: the real Jira transition error that shows the Require Valid LedgerSeal validator message, for example after moving a changed issue to Done.
4. `04-admin-approvers.png` - **Approver Groups:** The LedgerSeal approvers admin page in Jira settings, with the approver group list, Save changes, and the group search.
5. `05-certificate.png` - **Sealed Issue Panel:** The LedgerSeal panel on a sealed issue with the SEALED lozenge, the next step, the Revoke seal button, and the "Certificate & attestation details" section collapsed.

---

## Support, Documentation & Legal Links

- **Documentation Portal:** https://asymm.systems/product/jira-governance/user-guide/ledgerseal.html
- **Offline Verifier Documentation & Source:** https://asymm.systems/product/jira-governance/user-guide/open-verifier.html
- **Privacy Policy:** https://asymm.systems/privacy
- **Terms of Service:** https://asymm.systems/terms
- **Support Portal & SLA:** https://asymm.systems/support
- **Direct Support Contact:** `support@asymm.systems`
