# Atlassian Marketplace Reviewer Notes: CascadePlan

## App Overview
- **App Name:** CascadePlan
- **App ID:** `ari:cloud:ecosystem::app/cac8499e-e92e-4ba6-95cc-af398b1be791`
- **Publisher:** Asymm Systems (`https://asymm.systems`)
- **Support Contact:** `support@asymm.systems`
- **Documentation:** `https://asymm.systems/product/jira-governance/user-guide/cascadeplan.html`

---

## 1. OAuth Scopes Justification

| Scope | User-facing capability | Justification |
|---|---|---|
| `read:jira-work` | The timeline, permission checks, bulk move progress | Reads the project's issues, estimates, due dates, links and issue properties as the user; checks the user's permissions before every write; follows a type-conversion job. The issue-deleted trigger removes the planner's records of a deleted issue. |
| `write:jira-work` | Moves, links, sub-tasks, hierarchy changes | Writes only values the user chose: due dates, estimates, assignees, summaries, status transitions the user picks, "Blocks" links, the issue properties `cascadeplan.dates` and `cascadeplan.links`, sub-task create and delete, parent changes and type conversions (bulk move). |
| `read:jira-user` | Assignee picker, approver groups, names of baseline authors | Lists assignable users; searches groups for the plan approver admin page; shows the names of who froze a baseline or reviewed a scope change, read live. |
| `storage:app` | Plans and baselines | Stores row order, columns, milestones, plans, baselines and scope-change requests in Forge storage. |
| `report:personal-data` | Personal data reporting | Reports the account ids stored in baseline and scope-change records once a week, and clears those of closed accounts. |

---

## 2. Architecture and Data

- **No egress:** the manifest declares no external endpoint, and the app makes no call outside the customer's Atlassian site.
- **Storage:** Forge storage of the site, and two issue properties on the customer's issues.
- **Personal data:** only Atlassian account ids, as authors of baseline and scope-change records; reported weekly.

---

## 3. Reviewer Environment

- Site `asymmsystems.atlassian.net`, project `DEMO`, page **CascadePlan Planner** in the project sidebar. The reviewer account is a project administrator, so a plan approver.

---

## 4. Reviewer Test Plan

### Step 1: Timeline and dependencies
1. Open **CascadePlan Planner** in project `DEMO`. The grid lists the work items; the timeline shows their bars.
2. Hover a bar and drag its right arrow onto another bar. Choose 30%. The successor's badge reads 30%.
3. Drag the predecessor one week later. The line at the bottom lists the Jira writes before the drop; after it, the successor moved too. Open **Changes** to see each write with old and new values. Press **Ctrl+Z** to undo.

### Step 2: Move a task with its sub-tasks
1. Drag the bar of a task that has sub-tasks one week later. Its sub-tasks move with it; the task's Jira due date follows its new end.

### Step 3: Plans
1. Open the plan selector, create a plan as a copy of the Main Plan, and move a bar there. Switch back to the Main Plan: the same dates show, because dates are Jira's.

### Step 4: Baselines and scope review
1. Choose **Baseline** in the toolbar, enter `Sprint 1 commitment`, and choose **Freeze the plan as a baseline**. The button reads "on scope".
2. Move a bar one week later. The button now shows "1 later". Open **Baseline**: the change is listed.
3. Write a reason and choose **Request approval of this scope**. (A second user, a plan approver, can accept it; the requester cannot.)
4. Under **Baseline versions**, choose **Export CSV**.

### Step 5: Views
1. Choose **Table view**, then the **Utilization** view: hours per person per week.

---

## 5. Notes
- The project page module key is `cascadeplan-project-planner`.
- CascadePlan never writes a default value: no default estimate, no default due date, and no status change caused by a progress edit.
