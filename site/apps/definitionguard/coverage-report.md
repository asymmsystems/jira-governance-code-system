# Transition Coverage Check: Eliminating Quality Blindspots

> How to ensure every workflow path into Done is protected by DefinitionGuard.

In complex Jira projects, workflows often have multiple transitions leading into the **Done** status category (for example: `In Progress -> Done`, `In Review -> Done`, `Reopened -> Done`, or global transitions `Any Status -> Done`).

If an administrator attaches the workflow validator to only one transition, developers can bypass the quality gate by taking an alternate workflow path.

---

## 1. How the Coverage Check Works

DefinitionGuard includes an automated **Transition Coverage Check** built into the project settings:

1. Navigate to **Project Settings** -> **DefinitionGuard**.
2. Scroll to the **Transition Coverage** section.
3. DefinitionGuard automatically scans all active workflows mapped to the current project and identifies every transition targeting a Done-category status.

---

## 2. Coverage States

The report categorizes each transition into one of two states:

| Status | Meaning | Action Required |
|---|---|---|
| **Protected (Green)** | The **DefinitionGuard DoD Enforcement** validator is attached to this transition. | None. Quality gate is active. |
| **Unprotected (Amber/Red)** | This transition moves into Done but lacks the DefinitionGuard validator. | Edit the workflow and attach the validator to close the blindspot. |
| **Exempt (Blue)** | Status is explicitly configured as exempt (e.g. `Canceled`, `Won't Fix`). | Allowed by policy. |

---

## 3. Best Practices for Full Coverage

- **Close Global Transitions:** Global transitions (`All -> Done`) should either carry the validator or be replaced with explicit transitions requiring review.
- **Audit After Workflow Edits:** Whenever a Jira administrator edits a project workflow, visit the DefinitionGuard settings page to verify that transition coverage remains 100%.
