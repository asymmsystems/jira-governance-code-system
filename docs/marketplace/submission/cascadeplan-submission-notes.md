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
| `read:jira-work` | Planner, timeline, backlog, permission checks, job progress | Reads the project's issues (summary, status, issue type, assignee, estimates, time spent, due date, parent, sub-tasks, issue links) and the issue properties `cascadeplan.dates` and `cascadeplan.links` through `/rest/api/3/search/jql`; the epic list; transitions; the user's permissions (`/rest/api/3/mypermissions`, `/rest/api/3/permissions/check` before every write); the progress of a type-conversion job (`/rest/api/3/bulk/queue/{id}`); Jira's JQL parser for a plan filter (`/rest/api/3/jql/parse`). The issue-deleted trigger removes the planner's records of a deleted issue. |
| `write:jira-work` | Edits the user makes in the planner | Writes only values the user chose: due dates, estimates, assignees, summaries, status transitions the user picks; creates issues, epics and sub-tasks (**+ Task**, **+ Epic**, **+ Allocate Resource**, **Create sub-task in Jira**); deletes or unassigns a contributor's sub-task when the user chooses so; creates and deletes Jira "Blocks" links (dependencies); sets the issue properties `cascadeplan.dates` (shared start date), `cascadeplan.links` (trigger percents) and `cascadeplan.create` (the id of the call that created an issue, so a repeated create returns the first issue); changes parents and converts work types through Jira's bulk move. Every write is listed in the **Changes** panel. |
| `read:jira-user` | Assignee picker, approvers admin page, names of baseline authors | Searches assignable users for the project (`/rest/api/3/user/assignable/search`); on the admin page, searches Jira groups and reads the current user's groups (`/rest/api/3/myself?expand=groups`); shows the names of who froze a baseline or reviewed a scope change, read live. |
| `storage:app` | Plans, settings, baselines | Stores plans, row order, columns, milestones, a plan's optional JQL filter, baselines (with SHA-256 digests), scope-change requests and the approver groups in Forge storage. |
| `report:personal-data` | Personal data reporting | An hourly scheduled trigger (function timeout 900 s) reads the stored records in steps, reports each account id the app stores (baseline and scope-change authors, contributors of a task, the administrator who last saved the approver groups) once every 7 days, and removes the ids of closed accounts from every record. |

---

## 2. Architecture and Data

- **No egress:** the manifest declares no external endpoint, and the app makes no call outside the customer's Atlassian site.
- **Reads and writes as the user:** Jira calls run as the signed-in user (`asUser`), and every write is checked against the user's Jira permissions first. Plan management and baselines need a plan approver (Jira administrator, project administrator, or a member of an approver group), checked on the server.
- **Storage:** Forge storage of the site (data residency enabled), and three issue properties on the customer's issues (`cascadeplan.dates`, `cascadeplan.links`, `cascadeplan.create`; the last is indexed for JQL by a `jira:entityProperty` module).
- **Content Security Policy:** no `content` permissions: no inline scripts and no inline styles.
- **Personal data:** Atlassian account ids, as authors of baseline and scope-change records, as contributors of a task (a person working on it through a Jira sub-task), and of the Jira administrator who last saved the approver groups; each reported once every 7 days, and removed from every record for a closed account. A contributor name that matches no account (for example a placeholder role) is kept as typed.

---

## 3. Reviewer Environment

- Site `asymmsystems.atlassian.net`, project `PAY` ("Payments Platform"): three epics with stories, tasks and sub-tasks, percent links, progress and a frozen baseline. Page **CascadePlan Planner** in the project navigation.
- The reviewer account is a project administrator, so a plan approver.
- Admin page: Jira admin settings, Apps, **CascadePlan approvers**.

---

## 4. Reviewer Test Plan

### Step 1: Timeline, dependencies and Why this date?
1. Open **CascadePlan Planner** in project `PAY`. Use **Compact** for Key and Summary only, and **Day**, **Week**, **Month**, **Quarter**, **Year** to change the zoom.
2. Hover row PAY-12 and choose ❓ (**Why this date?**): it names PAY-11 and the 30% trigger.
3. Click the 30% label (or the arrow) between PAY-11 and PAY-12: the link editor opens. Choose **Cancel**.
4. Hover a bar and drag its right arrow onto another bar to add a link; choose a percent.

### Step 2: Write preview, undo and the Changes panel
1. Drag PAY-7 ("Saved cards and digital wallets") one week later and hold: the line above lists every due date and start date the drop will change, including its sub-tasks and the work that depends on it.
2. Release. A Jira message with **Undo** appears and stays until you close it. Press Ctrl+Z to undo and Ctrl+Shift+Z to redo.
3. Click **Changes**: "Jira writes in this session" lists each write with old value, new value and result.

### Step 3: Hierarchy
1. Drag a row by its handle onto the middle of another row: a label says what will happen; CascadePlan asks first, then changes the parent in Jira. Undo makes the reverse change.

### Step 4: Plans
1. Open the plan selector, create a plan as a copy of the Main Plan, and move a bar there. Switch back: the same dates show, because dates are Jira's.
2. In the plan list, enter the JQL filter `key in (PAY-11, PAY-12)` and choose **Save filter**: the plan shows those two. Clear it and save.

### Step 5: Baselines and scope review
1. Choose **Baseline** in the toolbar: the panel lists the change since "Sprint 23 commitment" (one task added, one estimate raised).
2. Write a reason and choose **Request approval of this scope**. A plan approver other than the requester can accept or reject it; the requester cannot.
3. Under **Baseline versions**, choose **Compare with now** or **Export CSV**.

### Step 6: Sub-tasks and views
1. Open a task (✏️). Under **Multi-Resource Allocation (Jira Subtasks)**, allocate a team member: a Jira sub-task assigned to that person is created. **Create sub-task in Jira** creates a plain one.
2. In the view selector, choose **Table**, then **Utilization** (estimated hours per person per week; no capacity is assumed).

### Step 7: Approvers admin page
1. Go to Jira admin settings, Apps, **CascadePlan approvers**. Search for a Jira group, add it and click **Save changes**. Members of the saved groups become plan approvers; the server checks this for plan management and baselines.

---

## 5. Known Review Risks & Technical Mitigations

1. **Manifest key naming:** the project page module key is `cascadeplan-project-planner`, matching the brand **CascadePlan**.
2. **No unrequested writes:** CascadePlan writes to Jira only values the user chose, never a default (no default estimate, no default due date, no status change caused by a progress edit), and lists every write in the **Changes** panel (`apps/cascadeplan/test/no-unrequested-writes.test.ts`, `apps/cascadeplan/test/write-transparency.test.ts`).
3. **Permissions:** every resolver has a permission rule, and a resolver without one cannot be registered (`apps/cascadeplan/test/write-permissions.test.ts`).
4. **Dependencies:** `npm audit --omit=dev` reports no high or critical finding; CI fails on any.
