# Atlassian Marketplace Listing: CascadePlan

## App Information
* **App Title:** CascadePlan: Timeline and Dependencies
* **Tagline:** Jira timeline with percent-trigger dependencies, write preview and undo.
* **Categories:** Project Management, Planning, Gantt Charts

---

## Short Highlight Description (Max 250 chars)
A canvas timeline for Jira with percent-trigger dependencies, a why-explanation for every start date, a preview and undo for every Jira write, sub-task contributors, a table view and full keyboard control. (205 characters)

---

## The Unaddressed Native Problem

Many Jira timeline tools support only finish-to-start dependencies. Real work often starts earlier: an API integration can begin when the database design is 30% done. Teams also lose trust in planning tools that write values to Jira that nobody entered, or that move dates without saying why.

Consider a common planning problem:
1. A planner drags a task two weeks later on the timeline.
2. Five dependent tasks move with it, and the tool writes new dates to all of them in Jira.
3. Nobody can see which Jira fields changed, why a task now starts on a given day, or how to undo it.

CascadePlan addresses this with percent-trigger dependencies, a plain explanation of why each task starts when it does, a preview of every Jira write before it happens, undo, and a panel that lists every Jira write in the session.

---

## Key Capabilities & Verifiable Proof

| Capability | Underlying Mechanism | Verifiable Proof in Code & Tests |
|---|---|---|
| **Percent-Trigger Dependencies** | A task can start when a predecessor reaches a set percent (for example 30%), not only at 100%. A conflict dialog names the predecessor and suggests a fix, such as moving the successor or changing the trigger percent. | `apps/cascadeplan/src/domain/schedule-engine.ts`, `apps/cascadeplan/src/ui/dependency-edit.ts`, `apps/cascadeplan/test/domain/schedule-engine.test.ts`, `apps/cascadeplan/test/ui/dependency-edit.test.ts` |
| **Why-Explanations** | Press `?` on a selected task, or choose **Why this date?** from the task menu, to see the driving task, the trigger percent and the driving dates. | `apps/cascadeplan/src/ui/why.ts`, `apps/cascadeplan/src/frontend/why-popup.ts`, `apps/cascadeplan/test/ui/why.test.ts` |
| **Transparent Jira Writes** | Only values the user changes are sent to Jira. During a drag, a preview shows the planned Jira updates. Every Jira write is listed with old value, new value and result in the **Changes** panel ("Jira writes in this session"). | `apps/cascadeplan/src/frontend/changes-panel.ts`, `apps/cascadeplan/test/write-transparency.test.ts`, `apps/cascadeplan/test/no-unrequested-writes.test.ts` |
| **Undo and Redo** | 20-step undo stack with Ctrl+Z and Ctrl+Shift+Z. Each write shows a flag with **Undo** for 10 seconds. | `apps/cascadeplan/src/ui/undo-stack.ts`, `apps/cascadeplan/src/frontend/flag.ts`, `apps/cascadeplan/test/ui/undo-stack.test.ts`, `apps/cascadeplan/test/ui/undo-plan.test.ts` |
| **Contributors as Jira Sub-Tasks** | **+ Allocate Resource** creates a Jira sub-task assigned to each extra contributor. Removing a contributor asks whether to **Delete sub-task** or **Unassign sub-task**. | `apps/cascadeplan/src/ui/second-person.ts`, `apps/cascadeplan/test/second-person.test.ts` |
| **Canvas Timeline and Table View** | HTML5 canvas timeline with Day, Week, Month, Quarter and Year zoom, plus a **Table** view of all tasks and dates. | `apps/cascadeplan/src/frontend/canvas-timeline.ts`, `apps/cascadeplan/src/ui/table-view.ts`, `apps/cascadeplan/test/ui/table-view.test.ts`, `apps/cascadeplan/test/ui/time-scale.test.ts` |
| **Keyboard Control and Search** | Arrow keys move between tasks, Space enters move mode, arrow and `[` `]` keys shift dates. Ctrl+F opens in-app search. | `apps/cascadeplan/src/ui/keyboard-grid.ts`, `apps/cascadeplan/src/ui/in-app-search.ts`, `apps/cascadeplan/test/ui/keyboard-grid.test.ts`, `apps/cascadeplan/test/ui/in-app-search.test.ts` |
| **Estimation Units** | Each task can use Hours, Story Points (1 pt = 8 hrs) or T-shirt sizes. Values are converted to hours for scheduling without changing Jira fields you did not change. | `apps/cascadeplan/src/domain/models.ts`, `apps/cascadeplan/test/estimation-unit.test.ts` |
| **Multiple Plans** | **Manage Project Plans** creates, clones, renames and deletes named plans. Each task keeps one set of dates across every plan. | `apps/cascadeplan/src/ui/plan-manager.ts`, `apps/cascadeplan/test/plan-isolation.test.ts`, `apps/cascadeplan/test/ui/plan-manager.test.ts` |
| **Utilization Table** | The **Utilization** view lists estimated hours per assignee for the next 8 weeks. No capacity is assumed. | `apps/cascadeplan/src/ui/weekly-hours.ts`, `apps/cascadeplan/test/ui/weekly-hours.test.ts` |

---

## Enterprise Compliance Grounding

CascadePlan is a planning tool. It gives limited compliance value on its own. It can support compliance with change-management controls in one narrow way:

- **SOC 2 Type II (CC8.1) and ISO/IEC 27001:2022 (A.8.32 Change Management):** Every Jira write made by CascadePlan is a normal Jira edit by the signed-in user, so it appears in Jira's own issue history. CascadePlan writes only values the user changed.

*Honest Compliance Boundary:* CascadePlan does not certify your organization and does not enforce approvals. Your auditor decides whether your controls meet a standard.

---

## Data Privacy & "Runs on Atlassian" Architecture Guarantee

- **100% Forge Native Execution:** CascadePlan runs entirely on Atlassian Cloud compute.
- **Zero External Egress:** The manifest declares no external egress endpoints. No data is sent to servers outside Atlassian.
- **Customer Tenant Storage:** Plans, task schedules, dependency settings, column settings and approver groups are stored in Atlassian Forge Key-Value Storage (KVS).
- **Reads and Writes as the User:** Jira data is read and written as the signed-in user (`asUser`).
- **Jira Writes:** CascadePlan writes to Jira only when the user acts: issue fields (dates, assignee, summary, estimates), status transitions, new issues, epics and sub-tasks, sub-task delete or unassign, and Jira issue links that mirror dependencies.

---

## Transparent Pricing

| Tier | Monthly Price | Annual Price (2 Months Free) |
|---|---|---|
| **1 to 10 Users** | **Free** | **Free** |
| **11 to 100 Users** | $1.50 per user / month | $15.00 per user / year |
| **101 to 250 Users** | $1.20 per user / month | $12.00 per user / year |
| **251 to 1,000 Users** | $0.90 per user / month | $9.00 per user / year |

*All billing is handled natively through Atlassian.*

---

## Retina Screenshot Gallery Manifest

1. `01-wbs-tree.png` - **CascadePlan Planner:** The project planner page with the task list, the week-zoom canvas timeline, the toolbar (Main Plan, Backlog, Changes, Columns) and the zoom buttons.
2. `02-resource-heatmap.png` - **RECAPTURE REQUIRED:** The file is a mock-up of a "Resource Allocation & Utilization Grid" with capacity percentages and over-allocation badges, which the app does not have. Capture the planner with the **Utilization** view selected, showing the hours-per-person table for 8 weeks.
3. `03-scope-creep-alert.png` - **RECAPTURE REQUIRED:** The file is a mock-up of a "Scope Creep Alert" dialog, which the app does not have. Capture the dependency conflict dialog or the why-explanation popup for a task with a percent-trigger dependency.
4. `04-baseline-settings.png` - **CascadePlan Approvers Admin Page:** The "CascadePlan approvers" page in Jira admin settings, where an administrator chooses Jira groups. The saved groups are not yet enforced by any planner action.
5. `05-shift-approval.png` - **RECAPTURE REQUIRED:** The file is a mock-up of a "Scope Shift Approval Request" dialog, which the app does not have. It also shows the old name "PlanShift". Capture the **Changes** panel ("Jira writes in this session") after a drag, or the drag preview of planned Jira updates.

---

## Support, Documentation & Legal Links

- **Documentation Portal:** https://asymm.systems/product/jira-governance/user-guide/cascadeplan.html
- **Privacy Policy:** https://asymm.systems/privacy
- **Terms of Service:** https://asymm.systems/terms
- **Support Portal & SLA:** https://asymm.systems/support
- **Direct Support Contact:** `support@asymm.systems`
