# DefinitionGuard User Guide

This guide describes how to complete Definition of Done checklist items, submit verified evidence links, and request audited waivers.

---

## 1. Completing Checklist Items

1. Open a Jira issue and locate the **Definition of Done** panel in the right sidebar.
2. Review the checklist criteria. Mandatory items are indicated with a bold **Mandatory** badge.
3. For standard items, click the checkbox to mark the item complete. The panel records your Atlassian account ID and the exact completion timestamp.

---

## 2. Attaching Required Evidence

When an item has an **Evidence Required** indicator:
1. Clicking the checkbox automatically opens the **Add Evidence** modal.
2. Enter the evidence details:
   - **Evidence URL:** Link to the GitHub/GitLab PR, CI test build, SonarQube scan, or Confluence doc.
   - **Verification Note:** (Optional) Context for auditors.
3. Click **Submit Evidence**.
4. The item is marked complete, and the evidence URL is displayed directly beneath the checklist item.

![Evidence Form](/assets/definitionguard/02-evidence-link.png)

*Figure: Attaching mandatory evidence URL and verification note.*

---

## 3. Peer Review Sign-Offs

Items designated as **Non-Assignee Review Required** (such as Peer Code Review):
- The ticket assignee cannot mark this item complete. Attempting to click will display: `Peer review items cannot be signed off by the ticket assignee.`
- A teammate who is not assigned to the issue must review the work and check the item.

---

## 4. Granting Audited Waivers

When an item is legitimately not applicable for a specific ticket (e.g. `Documentation Update` for an internal refactoring bug):
1. An authorized user clicks the **Options (...)** menu next to the item and selects **Waive Item**.
2. An obligatory **Waiver Justification** must be entered.
3. Click **Confirm Waiver**.
4. The item is marked as waived with an amber badge, and the justification is appended to the issue audit history.

---

## 5. Exporting DoD Audit Evidence (JSON)

1. In the DefinitionGuard panel, click **Show details** to open the audit trail view.
2. Click **Export DoD Audit (JSON)**.
3. The resulting JSON file includes the complete hash-chained history of every item completion, evidence URL, and waiver justification.

![JSON Audit Export](/assets/definitionguard/05-audit-export.png)

*Figure: Full JSON audit history export for compliance reviews.*
