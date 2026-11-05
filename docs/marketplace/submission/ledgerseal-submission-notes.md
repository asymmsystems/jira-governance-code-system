# Atlassian Marketplace Reviewer Notes: LedgerSeal

## App Overview
- **App Name:** LedgerSeal
- **App ID:** `ari:cloud:ecosystem::app/7489a645-7c96-400a-b289-eb36f2701a00`
- **Publisher:** Asymm Systems (`https://asymm.systems`)
- **Support Contact:** `support@asymm.systems`
- **Documentation:** `https://asymm.systems/product/jira-governance/user-guide/ledgerseal.html`

---

## 1. OAuth Scopes Justification

Every scope declared in `manifest.yml` is listed below with how the code uses it:

| Scope | User-Facing Capability | How the code uses it |
|---|---|---|
| `read:jira-work` | Snapshot hashing, change detection, separation of duties, approver permission checks | Reads the issue fields, the field list, comments, work logs, and the change log to compute the SHA-256 snapshot, detect changes after approval, and name who changed each item. The change log is also used to stop the author of a change from approving it. Reads the user's project and Jira permissions (`mypermissions`) to decide who may seal. |
| `write:jira-work` | Searchable seal property (`ledgerseal-cert`) | Writes the seal attestation into the `ledgerseal-cert` issue property on seal, approval of changes, revocation, and each new detected change. The manifest indexes `status`, `everCompromised`, and `incidentCount` so users can search them with JQL. |
| `read:jira-user` | Approver display names and approver groups | Reads user details for display, the current user's groups to check approver-group membership, and group names for the group search and group list on the LedgerSeal approvers admin page. |
| `storage:app` | Seal records, history, and approver groups | Keeps the seal records, the sealed snapshots, the hash-chained history, and the approver group list in Forge key-value storage. |

---

## 2. Architecture & Data Residency Statement

- **No External Egress:** LedgerSeal declares no external fetch permissions (`permissions.external` is absent). The app calls only the Jira REST API of the customer's site. It sends no telemetry.
- **Forge Storage:** Seal records, history, and approver groups are kept in Atlassian Forge key-value storage (`storage:app`). No third-party databases are used.
- **Data Residency:** Data residency follows Atlassian's rules for Forge app storage.
- **Signing:** When the vendor signing key is configured for the installation, the seal attestation is signed with Ed25519. Without that key the attestation is written unsigned.

---

## 3. Test Credentials & Reviewer Environment Guidance

> **Publisher Note for Submission:** When submitting to the Atlassian Developer Console, provision a test Jira Cloud site or invite the Atlassian review team to the designated review instance (`asymmsystems.atlassian.net`) with administrative permissions.

### Sample Test Issues
- **Issue with Active Seal:** `LSP-3` (shows the green `SEALED` lozenge and the seal details).
- **Issue Changed After Approval:** `DEMO-34` (shows the red `CHANGED` lozenge and the changed items with who changed them).

---

## 4. Reviewer Test Plan Steps

### Test Step 1: Viewing a Sealed Issue
1. Navigate to issue `LSP-3`.
2. Locate the **Approval Seal** issue panel in the main column of the issue view.
3. Observe the green `SEALED` lozenge and the text "Approval seal: Sealed. No change detected since approval."
4. Click **Show details** on **Certificate & attestation details** to see the signer, sign-off role, hash, covered fields, history, and certificate ID.
5. Click **Show evidence (JSON)** to see the evidence record in the panel. It can be copied and checked with the offline verifier.

### Test Step 2: Post-Approval Change Detection
1. Open issue `LSP-3` and edit the ticket summary or description.
2. Click **Refresh** in the LedgerSeal panel, or reopen the issue.
3. Observe the red `CHANGED` lozenge and the **Changed items** list, which names each changed field, its value at approval, its current value, and who changed it.

### Test Step 3: Workflow Transition Gate
1. A Jira administrator adds the **Require Valid LedgerSeal** validator to the transition into **Done**.
2. Attempt to move the changed issue to **Done**.
3. Observe that Jira blocks the transition and shows the LedgerSeal message naming the changed items.

### Test Step 4: Admin Policy Page
1. Navigate to **Jira Settings** -> **Apps** -> **LedgerSeal approvers**.
2. Search for a Jira group, add it, and click **Save changes**. Members of the saved groups can seal, approve changes, and revoke seals.

---

## 5. Known Review Risks & Mitigations

1. **Compliance Claims:** LedgerSeal documentation states that it supports compliance with SOC 2 and 21 CFR Part 11 and that the customer's auditor decides. It does not claim certification.
2. **Icon & Static Assets:** The module icon is bundled with the app (`static/icons/icon.svg`). The manifest contains no external URLs.
