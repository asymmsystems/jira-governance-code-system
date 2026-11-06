# Atlassian Marketplace Reviewer Notes: DefinitionGuard

## App Overview
- **App Name:** DefinitionGuard
- **App ID:** `ari:cloud:ecosystem::app/73e4f63d-7d60-450c-96d5-f81ca68a709c`
- **Publisher:** Asymm Systems (`https://asymm.systems`)
- **Support Contact:** `support@asymm.systems`
- **Documentation:** `https://asymm.systems/product/jira-governance/user-guide/definitionguard.html`

---

## 1. OAuth Scopes Justification

Every scope declared in `manifest.yml` is listed below with how the code uses it:

| Scope | User-Facing Capability | How the code uses it |
|---|---|---|
| `read:jira-work` | DoD checklist, transition validation, permission checks, not-the-assignee rule, template re-sync | Reads the issue type, project and assignee to choose the template and apply the not-the-assignee rule. Reads the issue's changelog to find everyone who was the assignee after an item was opened. Reads the target status of a transition to see whether it is a Done-category status. Reads the project and its statuses for the settings page. Searches open issues of an issue type to re-sync them to a changed template. Reads the user's permissions (`mypermissions`) to check who may tick, waive, reset, export and edit templates. |
| `write:jira-work` | `definitionguard-dod` issue property | Writes a signed summary of the checklist into the `definitionguard-dod` issue property after each change, for other tools to read. The gate never reads it. The fields are listed in section 2. |
| `read:jira-user` | Approver groups | Reads the current user's groups to check approver-group membership, and group names for the group search and group list on the DefinitionGuard approvers admin page. |
| `storage:app` | Templates, checklists and history | Keeps the per-issue-type templates, exempt statuses, checklist state, evidence, waiver reasons, the hash-chained history, the approver group list and the person pseudonyms in Forge key-value storage. |
| `read:workflow:jira` | Gate coverage check | Reads the project's workflows and their transitions so the settings page can list each transition into a Done status as Gated, Not gated or Exempt. Read only. |
| `report:personal-data` | Personal data reporting | A weekly scheduled trigger reports the stored account ids to the personal data reporting API and erases the link of each account reported as closed. |

---

## 2. Architecture, Data and Personal Data Statement

- **No External Egress:** DefinitionGuard declares no external fetch permissions and no remotes. The app calls only the Jira REST API of the customer's site and the Forge platform APIs.
- **UI:** UI Kit only (`render: native`) for the issue panel, the project settings page and the admin page. No Custom UI, so no content security policy entries are needed.
- **Forge Storage:** checklists, history, templates, exempt statuses and approver groups are kept in Atlassian Forge key-value storage (`storage:app`). Data residency follows Atlassian's rules for Forge app storage.
- **Personal data:** every stored record names a person by a random per-site pseudonym. The Atlassian account id is kept only in two link keys per person (`dg:pty:<accountId>` and `dg:pid:<pseudonym>`). The scheduled trigger `personal-data-report` (weekly) reports those account ids and deletes both keys of each closed account; the hash-chained history then still verifies and shows "A deleted user". Free text that users write (evidence notes, evidence links, waiver reasons) is stored as written. When an issue is deleted, the trigger `issue-deleted` (`avi:jira:deleted:issue`) deletes its checklist and history.
- **The `definitionguard-dod` issue property** (schema 3) holds: `schemaVersion`, `issueId`, `templateId`, `templateVersion`, `stateVersion`, `mandatoryTotal`, `mandatoryCompleted`, `openMandatoryItemIds`, `isFullySatisfied`, `headHash` (hash of the newest history event), `issuedAt`, `keyId` and `sig` (Ed25519 over the canonical JSON of every other field). It holds no account id. The production key id is `dg-prod-2026-11`; the public key is at `https://asymm.systems/product/jira-governance/signing-keys.html`. A development or review install may have no signing key; the property then has `keyId: null` and `sig: null`, and the panel's history section says "Property not signed".
- **Licence:** with an inactive licence the validator lets every move through (the gate is off), the panel and the settings page show "Licence not active", and checklist changes are refused. Reads still work. On a licensed site, any error in the validator blocks the move (fail closed).

---

## 3. Reviewer Setup on Your Own Site

These steps work on any Jira Cloud site; nothing depends on our site. You need a Jira admin account and a second user (any user who can edit issues), for the not-the-assignee check.

1. Install DefinitionGuard on your site.
2. Create a company-managed Scrum or Kanban software project (any template with a Done status).
3. Add the validator: **Project settings > Workflows** (or **Jira settings > Issues > Workflows**), edit the project's workflow, select the transition into **Done**, add the validator **DefinitionGuard DoD Enforcement**, and publish the workflow. The app cannot add the validator itself; the settings page says so.
4. Create an issue of type **Task** and assign it to yourself.

---

## 4. Reviewer Test Plan Steps

### Test Step 1: The Definition of Done checklist
1. Open the issue. If the **Definition of Done** panel is not shown, add it from the issue's **View app actions** button (the hexagon icon under the issue title).
2. Observe the built-in Task template: each item has a Mandatory or Optional lozenge, and the summary names the open mandatory items, says "Incomplete", and shows the approver line ("Authorized approvers (waive and reset): ...").

### Test Step 2: An item with required evidence
1. Find an item with the "Needs evidence" lozenge and tick it.
2. The evidence form opens in the panel and asks for a link, a note, or both. **Save and tick** stays disabled until one is entered.
3. Enter a link (for example `https://ci.example.com/build/42`) and click **Save and tick**.
4. The item is completed with an "Evidence attached" lozenge. Click **Show evidence** to see the link.

### Test Step 3: The not-the-assignee rule
1. In **Project settings > DefinitionGuard**, choose the issue type **Task**, add an item "Peer review" with **Mandatory** and **Not the assignee** ticked, and click **Save template**. New checklists of Task issues use it (or click **Re-sync open issues** to update the open ones).
2. Create a new Task assigned to yourself and open its panel. Tick "Peer review": the panel says "The assignee cannot complete this item. Ask a reviewer."
3. Unassign the issue and try again: the panel still refuses, because you were the assignee after the item was opened.
4. Sign in as the second user and tick "Peer review": it is accepted.

### Test Step 4: A waiver
1. As the Jira admin, click **Waive** on another open mandatory item, enter a reason of at least 10 characters, and click **Waive item**. The item shows "Waived" and who waived it.
2. A waiver of the "Peer review" item by its assignee is refused, even for an admin.

### Test Step 5: The gate
1. With mandatory items still open, move the issue to **Done** (board or issue view). Jira shows the DefinitionGuard message, which lists the open mandatory items, and the issue stays where it was.
2. Complete or waive the remaining mandatory items and move the issue to **Done** again: the move succeeds.

### Test Step 6: Project settings and gate coverage
1. Open **Project settings > DefinitionGuard** as a project admin.
2. Templates: add, reorder, edit and remove items for an issue type, then **Save template**.
3. **Gate coverage** lists each transition into a Done-category status as Gated, Not gated or Exempt. Tick a status such as **Canceled** under exempt statuses and save; moves into it are not gated.

### Test Step 7: History and export
1. In the panel, expand **Checklist audit history** and click **Load audit history**. Each change is listed with who and when; the chain check says "History checked: N events, chain intact." and states its limit; the signature line says whether the issue property is signed on this site.
2. As a project admin, click **Export history** and copy the JSON text (UI Kit has no file download).

### Test Step 8: The approvers admin page
1. As a Jira admin, open **Jira settings > Apps > DefinitionGuard approvers**.
2. Search for a group, add it and click **Save changes**. Members of that group can now waive, reopen waived items and reset checklists in every project; the panel's approver line names the group.

---

## 5. Known Review Risks and Mitigations

1. **Compliance claims:** the listing says the app supports SOC 2 (CC8.1) and ISO 27001 evidence and that the customer's auditor decides. It claims no certification, and it states that a tick or a waiver is not an electronic signature.
2. **Workflow configuration:** Jira workflow validators must be added by a Jira administrator in the workflow editor. The app cannot add the validator itself, and the settings page says so.
3. **Signature on a review install:** a review install from the development or staging environment may have no signing key, so the property is unsigned there; the panel says so. Production installs sign with `dg-prod-2026-11`.
