# Atlassian Marketplace Reviewer Notes: CascadePlan

## App Overview
- **App Name:** CascadePlan
- **App ID:** `ari:cloud:ecosystem::app/cac8499e-e92e-4ba6-95cc-af398b1be791`
- **Publisher:** Asymm Systems (`https://asymm.systems`)
- **Support Contact:** `support@asymm.systems`
- **Documentation:** `https://asymm.systems/product/jira-governance/user-guide/cascadeplan.html`

---

## 1. OAuth Scopes Justification

Every scope declared in `manifest.yml` and its real use in the code:

| Scope | User-Facing Capability | Justification |
|---|---|---|
| `read:jira-work` | Planner, timeline, backlog, epics | Reads the project, project issues (summary, status, issue type, assignee, estimates, time spent, dates, parent, issue links) through `/rest/api/3/search/jql`, the epic list, available transitions, and the user's permissions (`/rest/api/3/mypermissions`). |
| `write:jira-work` | Edits the user makes in the planner | Updates issue fields the user changes (dates, assignee, summary, estimates); runs status transitions; creates issues, epics and sub-tasks (**+ Task**, **+ Epic**, **+ Allocate Resource**); deletes or unassigns a contributor's sub-task when the user chooses **Delete sub-task** or **Unassign sub-task**; creates and deletes Jira issue links that mirror planner dependencies. Every write is listed in the **Changes** panel. |
| `read:jira-user` | Assignee picker, approvers admin page | Searches assignable users for the project (`/rest/api/3/user/assignable/search`); on the admin page, searches Jira groups (`/rest/api/3/groups/picker`, `/rest/api/3/group/bulk`) and reads the current user's groups (`/rest/api/3/myself?expand=groups`). |
| `storage:app` | Plans and settings | Stores named plans, task schedules, dependency and trigger settings, column widths and hidden columns, and the approver groups chosen on the admin page in Forge KVS. |

---

## 2. Architecture & Data Residency Statement

- **Zero External Egress:** The manifest declares no external egress endpoints. CascadePlan calls no external (non-Atlassian) APIs.
- **Reads and Writes as the User:** Jira calls run as the signed-in user (`asUser`).
- **Tenant Storage:** Plans, schedules and settings reside in customer Atlassian Forge KVS (`storage:app`).
- **Data Residency:** All data remains within the customer's Atlassian Cloud site.

---

## 3. Test Credentials & Reviewer Environment Guidance

> **Publisher Note for Submission:** Ensure the review instance (`asymmsystems.atlassian.net`) has project `TEST` populated with at least two tasks with start and due dates, estimates and assignees.

### Sample Test Project
- **Project Key:** `TEST`
- **Planner Page:** **CascadePlan Planner** in the project navigation.
- **Admin Page:** Jira admin settings, Apps, **CascadePlan approvers**.

---

## 4. Reviewer Test Plan Steps

### Test Step 1: Planner and Timeline
1. Open project `TEST` and click **CascadePlan Planner** in the project navigation.
2. Observe the task list and the canvas timeline. Use **Day**, **Week**, **Month**, **Quarter** and **Year** to change the zoom, and **Today** to jump to today.

### Test Step 2: Percent-Trigger Dependency and Why-Explanation
1. Click a task bar and choose **Add dependency** in the bar toolbar (or drag the arrow from one bar to another). Set **Starts when that issue reaches (percent)**, for example 30.
2. Select the successor task and press `?`, or choose **Why this date?** from its task menu. The popup names the driving task, the trigger percent and the driving dates.

### Test Step 3: Jira Write Preview, Undo and Changes Panel
1. Drag a task bar to a new date. While dragging, a preview shows the planned Jira updates.
2. Release. A flag with **Undo** appears for 10 seconds. Press Ctrl+Z to undo and Ctrl+Shift+Z to redo.
3. Click **Changes** in the toolbar. The panel "Jira writes in this session" lists each write with old value, new value and result.

### Test Step 4: Contributor Sub-Task
1. Open a task. Under **Multi-Resource Allocation (Jira Subtasks)**, choose a team member, enter hours and click **+ Allocate Resource**. A Jira sub-task assigned to that person is created.
2. Remove the contributor and choose **Delete sub-task** or **Unassign sub-task**.

### Test Step 5: Table and Utilization Views
1. In the view selector, choose **Table** to see all tasks and dates in a table.
2. Choose **Utilization** to see estimated hours per assignee for the next 8 weeks. No capacity is assumed.

### Test Step 6: Approvers Admin Page
1. Go to Jira admin settings, Apps, **CascadePlan approvers**.
2. Search for a Jira group, add it and click **Save changes**. The groups are stored. In this version no planner action is restricted by this list.

---

## 5. Known Review Risks & Technical Mitigations

1. **Manifest Key Naming:** The project page module key in `manifest.yml` is `cascadeplan-project-planner`, matching the commercial brand **CascadePlan**.
2. **No Unrequested Writes:** CascadePlan writes to Jira only values the user changed, and lists every write in the **Changes** panel (`apps/cascadeplan/test/no-unrequested-writes.test.ts`, `apps/cascadeplan/test/write-transparency.test.ts`).
3. **Approver Policy:** The admin page stores approver groups, but no planner action checks them yet. The page is not presented as an access control.
