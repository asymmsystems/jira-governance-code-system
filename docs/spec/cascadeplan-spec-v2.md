# CascadePlan: specification v2

- **Date:** 2026-11-05
- **Status:** draft for owner approval. Every decision is recorded in fix plan v4, section 2.0. The owner decided DEC-1, DEC-5, DEC-7 and DEC-8. DEC-2, DEC-3, DEC-4 and DEC-6 follow the fix plan's recommendations, adopted under the owner's instruction ("Dont wait for me - fix all"); they are marked `[ADOPTED DEC-n]` so the owner can review them. Everything else follows ADR-003 to ADR-008 or fixes in the fix plan.
- **Replaces:** `docs/spec/cascadeplan-spec.md` (v1, 2026-11-01), which stays as the record. v1 did not describe plans or shared dates, and its resolver names differed from the code.
- **Inputs:**
  - `docs/sdlc/cascadeplan-marketplace-review-2026-11/report-v2.md` (the review of commit `db08009`);
  - `docs/sdlc/cascadeplan-marketplace-review-2026-11/fix-plan-v4.md` (the fixes and the decision register);
  - `architecture/decision/adr-00003` to `adr-00008`;
  - `docs/sdlc/cascadeplan-usp-ux-research-2026-11/` (the v1 research).
- **Branch:** `feature/cascadeplan-marketplace-fixes`.

## 1. Executive summary

CascadePlan is a Jira Cloud project page (Forge Custom UI) that plans issues on a timeline. Its promise: a successor can start when its predecessor reaches X% complete, and every bar shows its computed earliest start and the reason, naming the driving task.

**Jira is the record.** Every field, date end, parent-child link and dependency that CascadePlan shows lives in Jira (ADR-004). CascadePlan's own storage holds only planning data that Jira has no place for: the start date, plans, row order, columns and milestones.

**Plans.** A project has a Main Plan and any number of scenario plans. Dates (spec decision D3) and dependencies (ADR-006) are the same in every plan. A scenario plan differs only in row order, columns and milestones.

## 2. Invariants

| ID | Invariant | Source |
|---|---|---|
| INV-01 | No Jira or payload text reaches `innerHTML`, `outerHTML`, `insertAdjacentHTML` or an HTML attribute string, except through the escaping `html` tagged template (`src/ui/safe-html.ts`). | v1, review FE section 1 |
| INV-02 | The UI has no inline script and no `on*` attribute, and calls the backend only through `invoke` from `@forge/bridge`. | v1 |
| INV-03 | CascadePlan writes a Jira value only when the user chose it in this action, or when it follows directly from the user's action and the preview listed it before the drop (a cascaded due date, a block-moved sub-task's due date, a parent's due date that follows its roll-up end). The server and the preview compute these writes with the same code (`src/domain/drop-plan.ts`; `test/review/drop-preview-parity.test.ts`). It never writes a default: no default span, no default estimate, no status change caused by a progress edit, no "Unassigned". | v1, F-06, F-11 |
| INV-04 | KVS holds only app-owned planning data. Summary, status, assignee, Jira estimate, Jira due date, parent, issue links and leaf progress are read live from Jira on every load. `[ADOPTED DEC-2 A]` The account ids stored are: the subjects of the baseline audit records (who froze, requested and reviewed), the contributors of a plan record (`parties[].partyId`, a person working on the task through a Jira sub-task, ADR-004 and the ADR-009 correction), and the Jira administrator who last saved the approver policy (`setByPartyId`). Records of builds before November 2026 that a project has not opened since may also hold `resourceAccountId` and `contributors[].accountId`. An hourly job reads every stored record in steps and reports each id with Forge's personal data reporting API at most once every 7 days, and removes closed accounts' ids (ADR-009, `src/storage/personal-data.ts`). Baseline items reach a user only for issues that user can browse (merge review M1). | v1, ADR-004, ADR-009 |
| INV-05 | Every resolver returns `{ ok: boolean, ... }`. Every write resolver also returns `jiraSync: { ok, error?, writes[] }`, and the UI shows every failure. A thrown call is reported as failed, never as success. | v1, F-13 |
| INV-06 | All Jira calls run as the user (`asUser()`), except the issue-deleted trigger, which runs as the app and only deletes CascadePlan records. | v1, BL-9 |
| INV-07 | No KVS value exceeds 8 KiB at 1,000 tasks. `getProjectPlan` writes nothing, and opening the planner deletes nothing. | v1, BL-9 |
| INV-08 | A write with a stale base version is rejected with `conflict`, before any Jira write, and the newer value survives. | v1, F-07 |
| INV-09 | One function computes the earliest start for the auto-move, the violation check, the preview and the reason text. | v1 |
| INV-10 | Every computed earliest start has a reason that names the driving predecessor, the trigger percent, the date and the basis. | v1 |
| INV-11 | A cascade moves only successors that conflict, never moves a task the user did not see in the preview, and is bounded per call. A successor it cannot move is reported, never dropped. | v1, F-20 |
| INV-12 | Every date move, scheduling and unscheduling, block move, change to several rows, and task field and link change (`updateWbsTask`, the link editor included) can be undone, 20 steps. A hierarchy change has its own Undo in its message. Adding a contributor creates a Jira sub-task; Undo never deletes that sub-task. Creates, plan management, baselines, plan filters, row order and column settings have no Undo. The history is kept in memory: a plan switch or a reload clears it. No routine edit asks for confirmation; a hierarchy change does (ADR-005). | v1, F-04, CP-2 (2026-11-08) |
| INV-13 | Every pointer action has a keyboard path and a single-pointer path. | v1 |
| INV-14 | Every colour comes from an ADS token, in DOM and canvas, and meets WCAG 2.2 AA contrast. | v1 |
| INV-15 | Every issue key in a payload matches `^[A-Z][A-Z0-9_]+-\d+$` and belongs to the context project. The project comes only from the Forge context; a call without a project in the context is refused. | v1, N-01 |
| INV-16 | Every write is checked against the user's Jira permissions before any KVS or Jira write. A failed check, or an error in the check, refuses the call. | BL-2 |
| INV-17 | The response to a write shows the values Jira holds after the write. | F-03 |
| INV-18 | Every relationship the planner shows exists in Jira: parents through Jira's `parent` field, dependencies as Jira "Blocks" links, the trigger percent as a Jira issue property. | ADR-004, ADR-006 |
| INV-19 | The state of a work item (not started, in progress, done) comes only from its Jira status category. Progress measures how far an item has got; it never decides the state. A Done item shows 100% and its progress cannot be edited (the stored manual value stays for when it is reopened). When a progress edit disagrees with the status, the planner asks in the same action: above 0% on a To Do item offers "In Progress", 100% on an item that is not Done offers "Done"; 0% offers nothing. A batch gets one question. Only the user's choice is sent, through the workflow transition, so INV-03 holds; a refused transition is reported and the progress is still saved. | Owner decision 2026-11-06 |

## 3. Domain model

### 3.1 Storage model: WorkEffort

The Silverston WorkEffort pattern is the storage model (v1 decision D-03; `docs/sdlc/cascadeplan-usp-ux-research-2026-11/silverston-conformance.md`).

| Type | Role | Stored fields |
|---|---|---|
| `WorkEffort` | One per Jira issue on a plan | `workEffortId` (issue key), `estimatedStartDate`, `estimatedCompletionDate`, `sequenceNum`, `targetPercentComplete`, `manualProgress`, `percentComplete` (only when set by hand) |
| `WorkEffortAssoc` | History of precedency links into this effort | `workEffortIdFrom`, `workEffortIdTo`, `WORK_EFF_PRECEDENCY`, `fromDate`, `thruDate`. A record only (ADR-006): the active links come from Jira. |
| `WorkEffortPartyAssignment` | A second person on a task (U3), through a Jira sub-task | `subtaskKey`, `roleTypeId` = `CONTRIBUTOR`, `fromDate`, `thruDate`. `[ADOPTED DEC-2 A]` `partyId` is not stored; the person is read live from the sub-task's assignee. |
| `WorkEffortEstimate` | The estimate as the user entered it | `estimateUnit`, `rawEstimate`, `normalizedHours`. The buffer fields of the domain type (`bufferType`, `bufferValue`) are not offered in the UI and are never written (section 10, CP-3). |

Rules:
- **Dates.** One set of dates per task, the same in every plan (D3). The end is the Jira due date. The start has no standard Jira field, so it is the Jira issue property `cascadeplan.dates` (`startDate`, and the planner's `endDate` when Jira has no due date), set as the user and read in the same issue search (ADR-008, `[ADOPTED DEC-3 C]`). A property without a start marks a task taken off the timeline. A task with no property yet keeps the dates of its plan record until its next date change (lazy migration: opening the planner writes nothing).
- **Dependencies** (ADR-006). The active dependencies of a task are its Jira "Blocks" links, the same in every plan. The trigger percent of each incoming link is the Jira issue property `cascadeplan.links` on the successor (predecessor id to percent). A link with no stored percent is finish to start (100%). Adding a dependency creates the Jira link; if Jira refuses, nothing is stored. Removing one deletes the Jira link, whoever created it. A link stored only in a plan record before ADR-006 stays shown, marked "not in Jira", until the user creates it in Jira or removes it.
- **Parents.** A parent's dates are derived on load from its dated children: the earliest child start to the latest child end. They are never stored. A parent with at least one dated child is shown on the timeline, even with no record of its own. `[ADOPTED DEC-6 A]` When a planner action changes the roll-up end of a scheduled parent, the parent's Jira due date is written to follow it, and the preview and the Changes panel show that write.
- **Parent moves** (ADR-003). Moving a task or story parent moves its block of sub-tasks by the state rules in section 3.4. Epics cannot be moved in this release. A parent cannot be resized.
- **Sub-tasks.** Every sub-task is a real Jira sub-task. CascadePlan stores no sub-task of its own (ADR-004).
- No engine output (trigger satisfied, violation, reason) is stored (INV-09).

### 3.2 View model

`WbsTask` is the view model the UI receives. It merges the live Jira issue, its issue properties and its stored record. The view adds live fields: `dependencies[]` (from Jira links and the percent property), with `dependency` as the first; `contributingResources` (names read live); `datesFromChildren`; `started` (section 3.3, item 11).

### 3.3 Schedule engine equations

Unchanged from v1 section 3.3, items 1 to 10, with these changes:
- **Today** is the user's local date, sent by the client and checked to be within one day of the server's UTC date (F-29).
- **Progress source (item 9).** Done status category gives 100, also over a manual value (INV-19). Otherwise a manual value set by hand, else a leaf uses `timespent / timeoriginalestimate`; a parent uses `aggregatetimespent / aggregatetimeoriginalestimate` (F-25).
- **11. Started.** A work effort is started when its Jira status category is "In Progress" or "Done" (INV-19; progress alone never starts it, `src/domain/schedule-engine.ts:132`). A 0% link ("start together") is satisfied only once the predecessor has started. A cascade never moves the start of a started work effort; it reports the conflict.
- **12. Inherited links.** When the engine evaluates a sub-task, it also applies the incoming links of each of its ancestors (N-06 rule 5).
- **13. Roll-up in the cascade.** Before a cascade, the roll-ups of every changed parent are recomputed, and the cascade also starts from every ancestor whose roll-up changed (N-06 rule 1). A cascade that reaches a parent moves its block (section 3.4).
- **14. Hierarchy links.** A dependency between an issue and its own ancestor or descendant is refused. Such links imported from Jira are shown, marked "ignored by the schedule", and left out of the engine (N-06 rule 6).

### 3.4 Block move (ADR-003)

A move of a task or story parent by N days moves each of its sub-tasks by its state:

| State | Rule |
|---|---|
| Not started | Start and end move by N days. |
| In progress | Start stays. End moves by N days, never before today and never before the start. |
| Done | Start and end stay. |
| Undated | Stays undated. |

All or nothing: the permission (`EDIT_ISSUES`, `SCHEDULE_ISSUES`) and the version of every sub-task that will change are checked before any write. The preview lists every new date, and every date that stays with its reason. Undo restores the block in one step. In a multi-select, each issue moves once. The same rules apply when a cascade moves a parent.

### 3.5 Hierarchy changes (ADR-005)

| Change | Route |
|---|---|
| A standard issue to another epic, or out of one | Edit endpoint, `fields.parent` |
| A sub-task to another standard parent | Edit endpoint, if the development-site trial proves it; otherwise bulk move |
| A standard issue without sub-tasks becomes a sub-task | Bulk move (`POST /rest/api/3/bulk/issues/move`), background job |
| A sub-task becomes a standard issue | Bulk move, background job |

Refused before any write, with the Jira rule as the reason: a work item with sub-tasks onto a task; any row onto a sub-task; an epic onto anything; a sub-task onto an epic in a team-managed project; a row onto itself or one of its descendants. Every change is confirmed in a dialog first, and applies to every plan.

### 3.6 Plans

- Each project has a Main Plan (`default`) and scenario plans. Every resolver reads and writes only the plan named by `planId`. A write to a plan that no longer exists is refused. A read of an unknown plan returns the Main Plan, and the UI says so.
- Shared by every plan: dates, dependencies, the hierarchy and every Jira field. Per plan: row order, columns and milestones.
- Creating, renaming and deleting a plan needs plan-approver rights: Jira administrator, project administrator of this project, or a member of an approver group set on the admin page.
- Copying or deleting a plan runs in pages of at most 100 records, one page per call, until done (N-02). A clone is listed as "copy not finished" and refuses writes until its last page. A plan being deleted is not listed, opens as the Main Plan, and refuses writes; it leaves the plan list with its last record, together with its baselines and scope-shift requests, so a stopped delete can always be finished.
- The open plan is remembered per site and project in the browser's local storage, as a view preference only.
- **JQL filter (F-27).** A plan may have a JQL filter, for projects with more issues than one plan reads (10 pages of 100). The plan then reads `project = "X" AND (<filter>) order by created desc`, for the view and for every write. The filter can only narrow the project: it is one line of at most 1,000 characters, has balanced parentheses outside quoted strings and has no ORDER BY. Jira's JQL parser checks it in strict mode before it is saved (the issue search answers an unknown field with no issues, not an error), and Jira's own message is shown when Jira refuses it. An empty plan with a filter says that no work item matches it. Plan approvers set and clear it; everyone sees it. Work outside the filter is not shown, a cascade or a move does not move it, and a record of an issue outside the filter is not listed as stale. A copy of the plan keeps the filter. The epic list and the one-time record migration still read the whole project.

## 4. Manifest

```yaml
modules:
  jira:projectPage:
    - key: cascadeplan-project-planner
      title: CascadePlan Planner
      icon: resource:main;icon.svg
      resource: main
      resolver:
        function: resolver
  jira:adminPage:
    - key: cascadeplan-admin
      title: CascadePlan approvers
      render: native
      resource: admin
      resolver:
        function: admin-resolver
  jira:entityProperty:
    # C7: the create id of the call that created an issue, searchable by JQL, so a repeated create
    # finds the issue the first call created instead of creating a second one.
    - key: cascadeplan-create-id
      entityType: issue
      propertyKey: cascadeplan.create
      values:
        - path: id
          type: string
  trigger:
    - key: issue-deleted
      function: issue-deleted-fn
      events:
        - avi:jira:deleted:issue
  scheduledTrigger:
    # ADR-009 decision 7: the personal data report, one step of the job each hour (900 s timeout).
    - key: personal-data-report
      function: personal-data-fn
      interval: hour
  function:
    - key: resolver
      handler: index.handler
    - key: admin-resolver
      handler: index.adminHandler
    - key: issue-deleted-fn
      handler: index.issueDeletedTrigger
    - key: personal-data-fn
      handler: index.personalDataTrigger
      timeoutSeconds: 900

resources:
  - key: main
    path: static/frontend/build
  - key: admin
    path: src/frontend/admin.tsx

permissions:
  # MK-09: no 'unsafe-inline' styles; the planner has no inline style attributes or <style> elements
  # (checked by test/e2e/e2e_csp_probe.py under style-src 'self').
  scopes:
    - read:jira-work
    - write:jira-work
    - read:jira-user
    - storage:app
    - report:personal-data

app:
  runtime:
    name: nodejs22.x
  licensing:
    enabled: true
```

- No `content` permissions: no `scripts` and, since MK-09, no `'unsafe-inline'` styles (every style is in `style.css`; values computed at run time are set through CSSOM from `data-css-*` attributes). No egress.
- `jira:entityProperty` `cascadeplan-create-id` indexes the issue property `cascadeplan.create` for JQL, so a repeated create finds the issue it already created (C7).
- `write:jira-work` covers due dates, estimates, assignees, transitions the user chooses, issue links, issue properties, sub-task create and delete, parent changes and bulk moves. `read:jira-work` covers search, the permission checks, bulk move progress and the issue-deleted trigger.
- `report:personal-data` and an hourly `scheduledTrigger` (function `timeoutSeconds: 900`) for the personal data report of every stored account id (ADR-009 decision 7). Adding the scope needs the site admin's consent on the next upgrade.
- `[ADOPTED DEC-4 B]` no custom entity in v1.

## 5. Storage schema

Keys use the project id and the issue id, never the keys (a renamed project or issue keeps its data).

| Key | Value |
|---|---|
| `cp:<projectId>:we:<issueId>` | Main Plan `WorkEffortRecord` (its dates only until the task's first date change since ADR-008) |
| `cp:<projectId>:plan:<planId>:we:<issueId>` | Scenario plan `WorkEffortRecord` |
| `cp:<projectId>:settings`, `cp:<projectId>:plan:<planId>:settings` | `{ columnWidths, hiddenColumns, milestones (max 100), migratedAt, modelVersion, jqlFilter? }` |
| `cp:<projectId>:bl:<planId>:index` | `{ v, active, ids }`: the baseline versions of a plan and the active one (ADR-009) |
| `cp:<projectId>:bl:<planId>:h:<id>`, `cp:<projectId>:bl:<planId>:c:<id>:<n>` | a baseline header (name, frozen at and by, counts, hours, SHA-256 digest, supersedes) and its chunks of at most 200 items `{ id, key, hours?, start?, end?, done? }` |
| `cp:<projectId>:shift:<planId>:<shiftId>` | one scope-change request |
| `cp:pd:accounts` | account ids stored as audit subjects, with the time each was last written (personal data report) |
| `cppd:state`, `cppd:f:<accountId>` | progress of the personal data job, and the ids found in this cycle until they are reported |
| `cp:<projectId>:plans` | `{ v, plans }`: the list of plans, with a version that every change checks (F-22); each plan may carry `state` (`copying` or `deleting`) and `copyFrom` |
| `cascadeplan:cfg:approver_policy` | approver groups (site) |
| Jira issue property `cascadeplan.links` | trigger percents of the incoming links (ADR-006) |
| Jira issue property `cascadeplan.dates` | `{ startDate, endDate?, v: 1 }`: the shared start and the planner's end; `{ v: 1 }` alone marks a task taken off the timeline (ADR-008) |
| Jira issue property `cascadeplan.create` | `{ id, v: 1 }`: the create id of the call that created the issue, set in the create request and indexed for JQL by the `jira:entityProperty` module `cascadeplan-create-id` (C7) |

- The shared start date is not in KVS: it is the Jira issue property `cascadeplan.dates` (ADR-008). The version check stays `set` with `returnValue: 'PREVIOUS'` and restore (v1 D-02, `[ADOPTED DEC-4 B]`).
- The issue-deleted trigger finds a record by the issue id and by the issue key, because older records can be keyed by the key (FX-05).
- Migrations run once, are idempotent, and delete old data only after the new data is written. A migration that would create anything in Jira (local sub-tasks, plan-only links) lists it to the user instead, and creates it only on the user's choice.

## 6. Validator

As v1 section 6, plus:
- `spanWeeks` 1 to 104; `startWeek` a known week key; `targetIndex` a whole number, 0 or more; `summary` 1 to 255 characters, trimmed (F-18).
- Dates within today minus 5 years and today plus 10 years; the end on or after the start (F-18).
- `status` in a review only `APPROVED` or `REJECTED` (if DEC-1 Option B).
- A failed check returns `{ ok: false, error: 'validation', field, message }`, never a thrown `TypeError`, and makes no write.

## 7. Resolver contracts

All planner resolvers take the project from `req.context.extension.project` (key and id). A call without it is refused (INV-15). Every resolver is registered through one wrapper that runs the licence check, the permission check of its row in the permission table (fix plan BL-2), and the validation. A resolver with no row cannot be registered.

| Resolver | Purpose | Permission |
|---|---|---|
| `getProjectPlan` | The plan, with `truncated` when capped at 1,000 issues, and the plan's `jqlFilter` | Browse |
| `setPlanFilter` | Sets or clears the JQL filter of a plan after Jira accepts it (F-27) | Plan approver |
| `createProjectPlan`, `continuePlanCopy`, `renameProjectPlan`, `deleteProjectPlan`, `continuePlanDelete` | Plan management; the `continue` resolvers run the next page of a clone or a delete (N-02) | Plan approver |
| `checkPlanApprover` | Whether to show plan management to this user | none |
| `updateWbsTask` | Dates, effort, progress, assignee, status the user chose; one link added or updated (`dependency`) or removed (`removeDependency`); `restore` for Undo and Redo (exact dates, no cascade); `enforceDependencies` refuses a start that breaks the task's or an ancestor's incoming link (N-06 rule 5) | `EDIT_ISSUES`; `SCHEDULE_ISSUES` for dates; `LINK_ISSUES` for links |
| `batchUpdateTasks` | Up to 50 updates in one state (F-17) | as `updateWbsTask`, per issue |
| `continueCascade` | The next 25 successors of a cascade | as `updateWbsTask`, per successor |
| `moveTaskGroup` | Block move of a parent (ADR-003); `enforceDependencies` as for `updateWbsTask`, for each moving sub-task not started | `EDIT_ISSUES`, `SCHEDULE_ISSUES` on every changed sub-task |
| `scheduleBacklogTask`, `unscheduleTask` | Put a backlog issue on the timeline, or take it off | `EDIT_ISSUES`; `SCHEDULE_ISSUES` when a due date is written |
| `reorderWbsTasks` | Row order in this plan | `EDIT_ISSUES` |
| `createInlineTask`, `createJiraEpic` | Create an issue (plan check first) | Jira's own create check |
| `addSubtaskToTask`, `createSubtaskForResource` | Create a real Jira sub-task | `EDIT_ISSUES` on the parent |
| `changeParent` | Hierarchy change through the edit endpoint (ADR-005) | `EDIT_ISSUES` |
| `convertIssueType`, `checkConversion` | Type change through bulk move, and its progress (ADR-005) | "Make bulk changes", `MOVE_ISSUES`, `CREATE_ISSUES` |
| `saveColumnWidths`, `saveHiddenColumns` | Shared column settings | none beyond Browse |
| Admin function: `approver-policy-get-api`, `approver-policy-set-api`, `approver-group-search-api` | Approver groups | Jira administrator |

Not registered: `pruneStaleEntries` (replaced by the issue-deleted trigger), `saveTaskDependency`, `saveProjectMilestone`, `previewCascade`, `getProjectPlans` and the `authority-*` aliases (no caller). DEC-1 Option B (owner): the baseline resolvers of ADR-009 are `freezePlanBaseline`, `setActiveBaseline` and `reviewScopeShift` (plan approvers); `getPlanBaselines`, `getScopeCreepReport` (a baseline against the current plan), `compareBaselines`, `exportBaseline` (any project user who can read the plan); `requestScopeShift` (any project user). `getProjectPlan` also returns the active baseline's items, so the status follows each change with no extra call.

Creates are safe to repeat (C7): `createInlineTask`, `createJiraEpic`, `createSubtaskForResource`, `addSubtaskToTask`, `resolveLocalSubtasks` and the contributor sub-tasks of `updateWbsTask` take an optional `createId` (8 to 60 letters, digits or hyphens). Before a create, the server searches `issue.property[cascadeplan.create].id` for it and returns an issue found there instead of creating another; a new issue carries the id. A call that creates several sub-tasks gives each one the id plus a hash of a value that names it in every repeat (the account id, the stored sub-task id), never its position. The client keeps the id of a create that ended without an answer, and sends it again when the same request is made again. The search is eventually consistent, so a repeat within a moment of the lost answer can still miss the first issue.

`jiraSync = { ok, error?, writes: [{ key, fields, ok, error?, changes? }] }`. Every Jira write, including those before a conflict, is listed (F-07).

Rate limits: the Jira search pages with `nextPageToken`, at most 10 pages of 100. A search that follows a write passes `reconcileIssues` with the written ids, at most 50 (F-03). A Jira 429 is retried after `Retry-After`, at most 3 times and 20 s. A KVS rate-limit error (`RATE_LIMIT_EXCEEDED`, `TOO_MANY_REQUESTS`) is retried the same way, then fails with a clear message (C10).

Licensing: when `req.context.license` exists and is not active, every write resolver returns `{ ok: false, error: 'license_required', message }`, and the load says "Licence required".

## 8. UI module layout and build

| Path | Content | Tests |
|---|---|---|
| `src/index.ts` | The Forge entry point: resolver registration with the permission rules, the admin resolvers, the triggers; it re-exports the server modules | Jest unit |
| `src/server/*.ts` | The resolvers and their Jira and storage code, by group (F-31): `core` (storage, retries, Jira caller, today, defaults), `jira-read`, `plan-read` (`getProjectPlan`), `jira-write`, `tasks`, `create`, `hierarchy`, `block-moves`, `plans`, `request`, `baselines`. Imports go one way, from `core` up to `index` | Jest unit |
| `src/domain/*.ts` | Engine and domain rules | Jest unit |
| `src/ui/*.ts` | Pure UI logic | Jest unit |
| `src/frontend/*.ts`, `legacy-planner.js` | DOM and canvas code | Browser harness |
| `test/review/*.test.ts` | Review tests (R, FX, PM), rewritten as regression tests as fixes land | Jest |
| `test/e2e/` | Browser harness (`build_site.py`, `e2e*.py`) | Python Playwright |
| `test/live/` | Live checks on the development site, cookies from a file outside the repository | Python Playwright |
| `static/frontend/build/app.js` | esbuild bundle, rebuilt from the app's own `node_modules` | |

- **Shared UI package** (ADR-007): `@asymm/jira-ui` is a `file:` dependency with `install-links=true`, built by its own `prepare` script. Install order: `npm ci` in `packages/asymm-jira-ui`, then in the app, then in `tools`.
- **CI** (`.github/workflows/apps-ci.yml`): every app from a clean checkout, in that install order: type check, tests with coverage thresholds, `forge lint`, and for CascadePlan a rebuild of the bundle that must equal the committed one.
- **Deploy**: from a clean checkout of the commit, `forge build -t <short commit SHA>`, then `forge deploy -e <environment> -t <short commit SHA>`, so `forge deploy list` shows which commit each environment runs.
- **Canvas layers.** The link ports and any other control that must be visible sit in a layer above the canvas (N-10). A mouse click on a bar shows the designed selected outline; the system focus ring is drawn only after keyboard input (N-09).

## 9. Decisions

v1 decisions D-01 and D-03 to D-10 stand. Changes and additions:

| # | Decision | Record |
|---|---|---|
| D-02 | Version check | Swap-and-restore for v1 (`[ADOPTED DEC-4 B]`, ADR-008); a new key per version if a lost update is seen |
| D-11 | Dates are the same in every plan; the end is the Jira due date | Commit `db08009`; the start is the issue property `cascadeplan.dates` (ADR-008) |
| D-12 | Moving a parent moves its block of sub-tasks by their state; epics later | ADR-003 |
| D-13 | Jira holds every relationship the planner shows | ADR-004 |
| D-14 | Every hierarchy change Jira allows, made in Jira | ADR-005 |
| D-15 | Dependencies are Jira links, shared by every plan; the percent is an issue property | ADR-006 |
| D-16 | The shared UI package builds itself during install | ADR-007 |
| D-17 | Records are deleted only when Jira reports the issue deleted (trigger), never on a user's 404 | Fix plan BL-9 |
| D-18 | Baseline, scope creep and shift approval | Built (DEC-1 Option B, owner): freeze, status, scope delta, requests and review, versions, comparison, CSV export, SHA-256 integrity check (ADR-009) |
| D-19 | Personal data | Account ids of baseline and scope-change authors, plan record contributors and the approver policy's saver, each reported once every 7 days and erased for closed accounts (ADR-009, INV-04) |
| D-20 | The parent's Jira due date follows its sub-tasks | Yes (`[ADOPTED DEC-6 A]`) |

## 10. Change log

| Date | Change | Why |
|---|---|---|
| 2026-11-08 | CP-1. The "+ Allocate Resource" hours field starts empty for every task and after each create. An empty field sends no estimate, and the status line then reads "Created Jira subtask for <name>, with no estimate". | The field started at 20, so a create wrote a 20-hour estimate the user had not chosen, against INV-03. A blank field showed "(undefinedh)". |
| 2026-11-08 | CP-2. INV-12 states what Undo covers, as the code does, including that Undo never deletes the Jira sub-task created for an added contributor (review CP-2a). No code change: link changes in the link editor already record an Undo step (`test/ui/undo-coverage.test.ts`, harness probe `test/e2e/e2e_link_undo_probe.py`). | INV-12 and the listing said every edit or write can be undone. Creates, plans, baselines, filters, row order and column settings cannot. |
| 2026-11-08 | CP-3. The Buffer Type and Buffer Value controls are removed from the task dialog, and the section is named "Jira sub-tasks". | No code read the two controls, so they saved nothing. Section 3.1 named a buffer but did not say where it is stored or how it changes the estimate, the Jira estimate or the schedule. Wiring it would need a new stored field and a new rule that this spec does not define. The domain types and `PlannerEngine.calculateEffortWithSubtasksAndBuffer` stay, unused by the UI, until a spec defines the buffer. |
