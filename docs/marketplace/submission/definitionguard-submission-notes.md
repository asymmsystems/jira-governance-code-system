# Atlassian Marketplace Reviewer Notes: DefinitionGuard

## App Overview
- **App Name:** DefinitionGuard
- **App ID:** `ari:cloud:ecosystem::app/73e4f63d-7d60-450c-96d5-f81ca68a709c`
- **Publisher:** Asymm Systems (`https://asymm.systems`)
- **Support Contact:** `support@asymm.systems`
- **Documentation:** `https://asymm.systems/product/jira-governance/user-guide/definitionguard.html`

---

## 1. OAuth Scopes Justification

Every scope declared in `manifest.yml` directly maps to user-facing capabilities:

| Scope | User-Facing Capability | Justification |
|---|---|---|
| `read:jira-work` | DoD Checklist Rendering & Transition Validation | Required to inspect issue type, current status, and field values to present the appropriate DoD checklist and validate status transitions. |
| `write:jira-work` | Searchable DoD Summary (`definitionguard-dod`) | Required to write the DoD completion status and open item counts into issue properties for JQL querying. |
| `read:jira-user` | Reviewer Role Verification & Non-Assignee Checks | Required to identify the current user's account ID and permissions to enforce peer review rules (assignee cannot verify peer-review items). |
| `storage:app` | Checklist Templates & Audit History Persistence | Required to persist per-issue-type DoD templates, item check states, evidence notes, and hash-chained audit histories in customer Forge KVS. |

---

## 2. Architecture & Data Residency Statement

- **Zero External Egress:** DefinitionGuard makes zero external network calls. The manifest contains zero external domains.
- **Tenant Storage:** All checklists, templates, and waiver records reside strictly in customer Forge KVS (`storage:app`).
- **Data Residency:** All data remains strictly within the customer's Atlassian Cloud data region.

---

## 3. Test Credentials & Reviewer Environment Guidance

> **Publisher Note for Submission:** Ensure the review instance (`asymmsystems.atlassian.net`) has project `DEMO` configured with the DefinitionGuard workflow validator attached to the transition into **Done**.

### Sample Test Issues
- **Issue with Open Mandatory DoD:** `DEMO-35` (Contains mandatory items requiring evidence links before transition).

---

## 4. Reviewer Test Plan Steps

### Test Step 1: Viewing the Definition of Done Checklist
1. Open issue `DEMO-35`.
2. Locate the **Definition of Done** issue panel in the right sidebar.
3. Observe the checklist items categorized by mandatory and optional.

### Test Step 2: Ticking an Item with Required Evidence
1. Attempt to tick the item requiring evidence without entering a link.
2. Observe that DefinitionGuard opens an evidence entry modal requiring a valid URL or documentation note.
3. Enter a valid link (e.g. `https://ci.example.com/build/42`) and submit.
4. Observe the item becomes completed with the evidence link displayed.

### Test Step 3: Transition Gate Enforcement
1. Attempt to drag issue `DEMO-35` to **Done** on the board while other mandatory items remain open.
2. Observe that the **DefinitionGuard DoD Enforcement** validator blocks the transition and lists the open mandatory items.

### Test Step 4: Project Settings Template Management
1. Navigate to **Project Settings** -> **DefinitionGuard**.
2. Verify that project admins can add, reorder, or edit DoD items for specific issue types.
3. Observe the **Transition Coverage Check** showing which Done transitions are protected by the validator.

---

## 5. Known Review Risks & Mitigations

1. **Compliance Boundaries:** Documentation disclaims formal regulatory certification ("supports compliance with SOC 2 / ISO 27001; your auditor decides").
2. **Workflow Configuration:** The reviewer notes clearly explain that Jira workflow validators require a Jira administrator to attach them in the workflow editor.
