# Atlassian Marketplace Reviewer Notes: LedgerSeal

## App Overview
- **App Name:** LedgerSeal
- **App ID:** `ari:cloud:ecosystem::app/7489a645-7c96-400a-b289-eb36f2701a00`
- **Publisher:** Asymm Systems (`https://asymm.systems`)
- **Support Contact:** `support@asymm.systems`
- **Documentation:** `https://asymm.systems/product/jira-governance/user-guide/ledgerseal.html`

---

## 1. OAuth Scopes Justification

Every scope declared in `manifest.yml` directly corresponds to user-facing functionality:

| Scope | User-Facing Capability | Justification |
|---|---|---|
| `read:jira-work` | Issue Snapshot Hashing & Field Change Detection | Required to read covered fields, comments, and attachments to compute SHA-256 snapshot hashes and detect post-approval edits. |
| `write:jira-work` | Searchable Certificate Property (`ledgerseal-cert`) | Required to write the cryptographic certificate summary into the issue property so users can search sealed issues via JQL. |
| `read:jira-user` | Approver Identity & Separation of Duties | Required to identify the approver's account ID, display name, and groups to enforce separation of duties (editors cannot approve their own changes). |
| `storage:app` | Forge Key-Value Storage Persistence | Required to persist the hash-chained history, certificate records, and approver policies within the customer tenant. |

---

## 2. Architecture & Data Residency Statement

- **Zero External Egress:** LedgerSeal declares zero outbound fetch endpoints (`permissions.external.fetch.backend` is completely absent). No data, telemetry, or ticket content ever leaves the customer's Atlassian tenant.
- **Tenant Storage:** All cryptographic audit records and policies are persisted exclusively in Atlassian Forge KVS (`storage:app`). No third-party databases are used.
- **Data Residency:** All data resides within the customer's Atlassian Cloud data region.

---

## 3. Test Credentials & Reviewer Environment Guidance

> **Publisher Note for Submission:** When submitting to the Atlassian Developer Console, provision a test Jira Cloud site or invite the Atlassian review team to the designated review instance (`asymmsystems.atlassian.net`) with administrative permissions.

### Sample Test Issues
- **Issue with Active Seal:** `LSP-3` (Shows verified `[SEALED]` lozenge, valid SHA-256 snapshot hash, and Ed25519 signature).
- **Issue with Tamper Detection:** `DEMO-34` (Shows `[COMPROMISED]` state with detailed attribution of post-approval description edits).

---

## 4. Reviewer Test Plan Steps

### Test Step 1: Viewing a Sealed Issue
1. Navigate to issue `LSP-3`.
2. Locate the **LedgerSeal Audit Gate** issue panel in the right sidebar.
3. Observe the green `[SEALED]` lozenge, the SHA-256 snapshot hash, and the approver declaration.
4. Click **Show details** to view the full cryptographic certificate.
5. Click **Export Audit Evidence (JSON)** to verify that evidence can be exported for offline auditing.

### Test Step 2: Post-Approval Tamper Detection
1. Open issue `LSP-3` and edit the ticket summary or description.
2. Refresh or reopen the LedgerSeal issue panel.
3. Observe that the status immediately updates to amber `[CHANGED]` or red `[COMPROMISED]`, naming the modified field and the editor.

### Test Step 3: Workflow Transition Gate
1. Attempt to move the tampered issue to the **Done** status.
2. Observe that the **LedgerSeal Validator** blocks the transition with a clear error message stating that the ticket was modified after approval.

### Test Step 4: Admin Policy Page
1. Navigate to **Jira Settings** -> **Apps** -> **LedgerSeal approvers**.
2. Verify that authorized approver groups can be searched and configured under the Uniform Permission Management Standard.

---

## 5. Known Review Risks & Mitigations

1. **Cryptographic Claims:** LedgerSeal documentation clearly states that it provides technical verification tools and does not constitute formal legal or regulatory certification ("supports compliance with SOC 2 / 21 CFR Part 11; your auditor decides").
2. **Icon & Static Assets:** All module icons are bundled locally or reference standard Feather vector icons over HTTPS.
