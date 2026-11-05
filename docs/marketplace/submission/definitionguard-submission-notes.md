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
| `read:jira-work` | DoD checklist, transition validation, permission checks, template re-sync | Reads the issue type, project, and assignee to choose the template and apply the not-the-assignee rule. Reads the target status of a transition to see whether it is a Done-category status. Reads the project and its statuses for the settings page. Searches open issues of an issue type to re-sync them to a changed template. Reads the user's permissions (`mypermissions`) to check who may tick, waive, reset, export, and edit templates. |
| `write:jira-work` | `definitionguard-dod` issue property | Writes a DoD summary (completion counts, open mandatory item IDs, and the history head hash) into the `definitionguard-dod` issue property after each change, for other tools to read. The gate never reads it. The property is not indexed for JQL search. |
| `read:jira-user` | Approver groups | Reads the current user's groups to check approver-group membership, and group names for the group search and group list on the DefinitionGuard approvers admin page. |
| `storage:app` | Templates, checklists, and history | Keeps the per-issue-type templates, exempt statuses, checklist state, evidence, waiver reasons, the hash-chained history, and the approver group list in Forge key-value storage. |
| `read:workflow:jira` | Gate coverage check | Reads the project's workflows and their transitions so the settings page can list each transition into a Done status as Gated, Not gated, or Exempt. |

---

## 2. Architecture & Data Residency Statement

- **No External Egress:** DefinitionGuard declares no external fetch permissions. The app calls only the Jira REST API of the customer's site.
- **Forge Storage:** Checklists, templates, and waiver records are kept in Atlassian Forge key-value storage (`storage:app`).
- **Data Residency:** Data residency follows Atlassian's rules for Forge app storage.

---

## 3. Test Credentials & Reviewer Environment Guidance

> **Publisher Note for Submission:** Ensure the review instance (`asymmsystems.atlassian.net`) has project `DEMO` configured with the DefinitionGuard DoD Enforcement validator attached to the transition into **Done**.

### Sample Test Issues
- **Issue with Open Mandatory DoD:** `DEMO-35` (contains open mandatory items).

---

## 4. Reviewer Test Plan Steps

### Test Step 1: Viewing the Definition of Done Checklist
1. Open issue `DEMO-35`.
2. Locate the **Definition of Done** issue panel in the main column of the issue view.
3. Observe the items, each with a Mandatory or Optional lozenge, and the summary that names the open mandatory items.

### Test Step 2: Ticking an Item with Required Evidence
1. Tick an item marked "Evidence required" (it shows a "Needs evidence" lozenge).
2. Observe that DefinitionGuard opens an evidence form inside the panel and asks for a link, a note, or both. **Save and tick** stays disabled until one is entered.
3. Enter a link (e.g. `https://ci.example.com/build/42`) and click **Save and tick**.
4. Observe the item becomes completed with an "Evidence attached" lozenge. Click **Show evidence** to see the link.

### Test Step 3: Transition Gate Enforcement
1. Attempt to drag issue `DEMO-35` to **Done** on the board while other mandatory items remain open.
2. Observe that the **DefinitionGuard DoD Enforcement** validator blocks the transition and lists the open mandatory items.

### Test Step 4: Project Settings Template Management
1. Navigate to **Project Settings** -> **DefinitionGuard**.
2. Verify that project admins can add, reorder, edit, and remove DoD items for a chosen issue type, then click **Save template**.
3. Observe the **Gate coverage** list showing which Done transitions are Gated, Not gated, or Exempt.

---

## 5. Known Review Risks & Mitigations

1. **Compliance Claims:** Documentation states that DefinitionGuard supports compliance with SOC 2 and ISO 27001 and that the customer's auditor decides. It does not claim certification.
2. **Workflow Configuration:** Jira workflow validators must be added by a Jira administrator in the workflow editor. The app cannot add the validator itself, and the settings page says so.
