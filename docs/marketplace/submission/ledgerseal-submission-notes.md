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
| `write:issue.property:jira` | Searchable seal property (`ledgerseal-cert`) | The narrow (granular) scope for issue properties, used instead of `write:jira-work`: the app writes nothing else in Jira. Writes the seal attestation into the `ledgerseal-cert` issue property on seal, approval of changes, revocation, and each new detected change. The manifest indexes `status`, `everCompromised`, and `incidentCount` so users can search them with JQL. |
| `read:jira-user` | Names in the change list and approver groups | Reads a user's display name to show who changed an item (names are never stored), the current user's groups to check approver-group membership, and group names for the group search and group list on the LedgerSeal approvers admin page. |
| `storage:app` | Seal records, history, and approver groups | Keeps the seal records, the sealed snapshots, the hash-chained history, the approver group list, and the token-to-account map in Forge key-value storage. |
| `report:personal-data` | Personal data reporting | A weekly scheduled trigger reports every account id the app holds to the personal data reporting API. For a closed account it replaces the account's token-to-account entry with a closed mark that holds no account id, so the pseudonymous token in the seal records names no one, and removes the account id from the approver policy. |

---

## 2. Architecture & Data Residency Statement

- **No External Egress:** LedgerSeal declares no external fetch permissions (`permissions.external` is absent). The app calls only the Jira REST API of the customer's site. It sends no telemetry.
- **Forge Storage:** Seal records, history, and approver groups are kept in Atlassian Forge key-value storage (`storage:app`). No third-party databases are used.
- **Data Residency:** Data residency follows Atlassian's rules for Forge app storage.
- **Signing:** Every seal attestation and evidence export is signed with Ed25519 by the Asymm Systems key of the production environment (`ls-prod-2026-11`). The private key is a Forge encrypted variable; the public key is in https://github.com/asymmsystems/ledgerseal-verifier.
- **Personal data:** Hashed seal records name people by a pseudonymous party token (HMAC-SHA-256 of the account id under a per-site key in app storage), never by account id or name. The `ledgerseal-cert` issue property holds no account id. Account ids are reported weekly; a closed account's token-to-account entry keeps only a closed mark, with no account id. A deleted issue's records are deleted by a trigger on `avi:jira:deleted:issue`.

---

## 3. Reviewer Environment

Install LedgerSeal on your own test site; nothing depends on the Asymm Systems site. You need a Jira admin account (it is also an approver) and, for step 2, a second user who is an approver (a project admin, or a member of an approver group set in step 4).

---

## 4. Reviewer Test Plan Steps

### Test Step 1: Seal an issue
1. Open any issue, open the **Approval Seal** panel from the issue's app button (**View app actions**, then **Approval Seal**).
2. Click **Seal this issue**, choose the sign-off role, tick the declaration, click **Sign and seal**.
3. Observe the green `SEALED` lozenge and "Approval seal: Sealed. No change detected since approval."
4. Click **Show details** to see the signer, sign-off role, hash and covered fields; **Show history** lists the seal with who acted.
5. Click **Show evidence (JSON)**. Save it to a file and run `node verify-evidence.mjs <file>` from https://github.com/asymmsystems/ledgerseal-verifier: all five checks pass.

### Test Step 2: Change detection and separation of duties
1. As the first user, edit the summary and add a comment.
2. Click **Refresh** in the panel. Observe the red `CHANGED` lozenge and **Changed items**: each item's value at approval, its current value, and who changed it.
3. The first user is told "You changed this issue, so another approver must approve it." and is offered neither **Approve these changes** nor **Revoke seal**.
4. As the second user, open the issue: **Approve these changes** is offered; give a reason and seal.

### Test Step 3: Workflow Transition Gate
1. A Jira administrator adds the **Require Valid LedgerSeal** validator to the transition into **Done** of a company-managed workflow and publishes it.
2. Change a sealed issue, then try to move it to **Done**.
3. Observe that Jira blocks the transition with the LedgerSeal message naming the changed items.

### Test Step 4: Admin Policy Page
1. Navigate to **Jira Settings** -> **Apps** -> **LedgerSeal approvers**.
2. Search for a Jira group, add it, and click **Save changes**. Members of the saved groups can seal, approve changes, and revoke seals.

---

## 5. Known Review Risks & Mitigations

1. **Compliance Claims:** LedgerSeal documentation states that it supports compliance with SOC 2, ISO/IEC 27001 and 21 CFR Part 11 and that the customer's auditor decides. It does not claim certification. It states that 21 CFR 11.50 is partly met (Each seal records the date, time and meaning of the signature. The signer's name is shown from their Atlassian account while it exists; after the account is closed, it is shown as a deleted user, so a printed name is not kept in the record.) and that it does not perform the two-component signing of 21 CFR 11.200.
2. **Icon & Static Assets:** The module icon is bundled with the app (`static/icons/icon.svg`). The manifest contains no external URLs.
3. **Major version:** the `report:personal-data` scope was added, so the site admin consents to it on install or upgrade.
