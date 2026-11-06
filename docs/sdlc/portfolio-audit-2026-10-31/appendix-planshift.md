# CascadePlan (apps/planshift): Commercial-Readiness Review

- Reviewer: independent reviewer 3 of 4 (code review only, no live access)
- Date: 2026-10-31
- Scope: the working tree of `jira-governance-code-system/apps/planshift`. Repo HEAD is `5097bf5`. The working tree has uncommitted changes in 7 files (`git diff --stat`: 1483 insertions, 96 deletions).
- Rules kept: read-only on the repo. No `forge` command. No network call. All scratch output went to `~/Documents/projects/jira-governance/.tmp/cache/portfolio-audit/`.

## 1. Snapshot and commands

### 1.1 Files read in full (md5sum)

| File | Lines | MD5 |
|---|---|---|
| manifest.yml | 30 | 29b96d9a8461496cc398354352ddac5a |
| package.json | 40 | 2a69a98aa5fd6e9c4bda873d36607eac |
| tsconfig.json | 17 | cb00b66f256c375c3fba8f3ee535e42b |
| jest.config.js | 20 | b4867e2c3c4d5c1d066f606ef4fa8294 |
| src/index.ts | 1271 | da0fb5ad9245f7271b3841d444194b4f |
| src/domain/models.ts | 254 | b62e2aef2d4190d9b40589f8d4c2fc19 |
| src/domain/planner-engine.ts | 624 | ed76988321d72fa7ae3ab6e0786cd2dd |
| src/storage/plan-repository.ts | 60 | 25303146106382e6cb6bd7d835b4cfe8 |
| src/frontend/index.tsx | 562 | 79dcd29c873d1f585bbb43ec4d1a4e15 |
| static/frontend/build/index.html | 1687 | 6cbd59ce53a739213b80f42b41ac244b |
| static/frontend/build/style.css | 344 | cbe3fcc94f9a561b691604625f5bd4d2 |
| static/frontend/build/icon.svg | 7 | 0a783b29fd2cb5270211bc2da1f50d81 (not reviewed for content) |
| test/index.test.ts | 1542 | 29fd55150bc1b82492ba72f9189ed77d |
| test/domain/planner-engine.test.ts | 652 | 6cf3aad98a1908aec71d21de95ab1218 |
| test/storage/plan-repository.test.ts | 73 | 6a2b2146888334d2a3f5330999d4e098 |

I also read `docs/sdlc/planshift-audit-2026-10-30.md`, only to check which of its findings are now fixed (section 5).

### 1.2 Commands and results

| # | Command (host node via flatpak-spawn) | Result |
|---|---|---|
| 1 | `npx tsc --noEmit -p .` (TypeScript 5.9.3) | Exit 0. No errors. |
| 2 | `npx jest --coverage --coverageDirectory=~/Documents/projects/jira-governance/.tmp/cache/portfolio-audit/cov-planshift` (Jest 29.7.0) | 3 suites passed, 152 tests passed, 0 failed. |
| 3 | `grep` counts on src and index.html | See questions 6 and 7. |
| 4 | `npx tsc -p . --outDir ~/.cache/.../planshift-scripts/build`, then `node probe.js` | Behaviour probes of PlannerEngine. Output quoted in findings as "probe P1" to "probe P9". |
| 5 | `node size.js` (synthetic JSON shaped like `WbsTask`, no repo code) | KVS payload size estimate. See CP-09. |

Coverage table (command 2):

| File | % Stmts | % Branch | % Funcs | % Lines |
|---|---|---|---|---|
| All files | 99.04 | 90.11 | 96.46 | 100 |
| src/index.ts | 98.90 | 86.46 | 94.11 | 100 |
| src/domain/models.ts | 100 | 100 | 100 | 100 |
| src/domain/planner-engine.ts | 99.27 | 98.42 | 100 | 100 |
| src/storage/plan-repository.ts | 100 | 100 | 100 | 100 |

Files NOT in coverage at all:
- `src/frontend/**` is excluded by `jest.config.js:9`. This file is dead code (the manifest does not load it).
- `static/frontend/build/index.html` is outside `collectCoverageFrom` (`jest.config.js:6-10`). It holds all of the real UI logic (about 1360 lines of inline JavaScript, `index.html:327-1685`). No test loads it. The real UI is 0% tested.
- `src/index.ts` branch coverage is 86.46%, below the 90% target. The global threshold still passes because other files raise the average.

## 2. Verdict table

| # | Question | Verdict | Key evidence |
|---|---|---|---|
| 1 | Tenant isolation | PARTIAL | Project key comes from context first (`index.ts:1203-1210`). Issue keys from the payload are not checked against the project (CP-16). |
| 2 | asUser vs asApp | PARTIAL | Writes run as user (`index.ts:65-70`). All reads run as app (`index.ts:136,160,185`), so issue security is bypassed (CP-06). |
| 3 | Manifest | PARTIAL | `nodejs22.x`, 4 scopes, all used. Only styles have `unsafe-inline`. The whole UI is an inline script (CP-02). No licensing (CP-22). |
| 4 | KVS | FAIL | Single-key maps, full plan written on every read, no concurrency control (CP-09, CP-11). |
| 5 | Jira REST hygiene | FAIL | No pagination, no 429 handling, sequential N+1 writes (CP-10, CP-17). |
| 6 | CSP and bridge | FAIL | 3 inline `onclick` handlers, 29 `innerHTML` sinks with unescaped Jira and payload strings, private `window.__bridge` API (CP-01, CP-02). |
| 7 | Type safety | PARTIAL | tsc passes with `strict`. 20 `any` in live backend code (19 in index.ts, 1 in plan-repository.ts), 13 more in dead index.tsx. |
| 8 | Tests | PARTIAL | 152 pass, 99/90/96/100. Real UI untested. Several tests lock in the 40 h default. asApp and asUser are mocked as the same function (CP-27). |
| 9 | Unestimated issues | FAIL | Backend reads 0 h. UI shows 40 h, and drag from backlog writes 40 h to Jira (CP-03). |
| 10 | In-progress synthetic progress | PASS | Progress = spent / original estimate, or 100 when done, else 0 (`index.ts:209-214`). The 30 default applies to dependency triggers, not progress. |
| 11 | Timeline weeks | PARTIAL | Built from `new Date()` (`index.ts:302`). Sprint names are synthetic. A module-level copy goes stale (CP-18). |
| 12 | Assignee | PARTIAL | Real `displayName` or "Unassigned". Six placeholder users ("Resource 1 (Placeholder)") are offered (`index.ts:95-102`). Stored names override Jira (CP-04, CP-05). |
| 13 | Other fake data | FAIL | Header "Completion: 31% / Target: 25%", "Project: DEMO", "Prerequisites" epic, heatmap CoE defaults, capacity metric (CP-19). |
| 14 | cascadeSchedule | PARTIAL | Cycle detection is correct for the single-predecessor model. Cascade has 4 defects (CP-14). Calendar weeks only, no working days. |
| 15 | buildWbsHierarchy | FAIL | Stories under an epic become "subtasks" and are hidden. Three levels break (CP-08). |
| 16 | Two-way sync | FAIL | Writes exist, but stored values freeze Jira fields, failures are hidden, and no conflict check exists (CP-05, CP-11, CP-12). |
| 17 | PM mental model | PARTIAL | WBS grid with Gantt, backlog tray and drop slots is a good fit. Hidden stories and snapped dates break it. Multi-resource subtasks are a sound idea (CP-08, CP-07). |
| 18 | Destructive actions | FAIL | No confirmation and no undo for unschedule, tray drop, dependency removal (CP-20). |
| 19 | Error messages | PARTIAL | Create and edit show Jira error text. Bridge errors become `null` and show as success (CP-12). |
| 20 | ADS fidelity | FAIL | Token names redefined as fixed hex, 48 hex literals in index.html, 0 ARIA attributes, mouse-only scheduling (CP-21). |

## 3. Findings

Severity: Critical = blocks any release. High = blocks paid listing. Medium = fix before GA. Low = polish.

### CP-01. Critical. Stored XSS through innerHTML with Jira and payload strings
- Evidence: Observed-code.
- Sinks: `index.html:518` (milestone title), `:537-546` (backlog card key, story, summary, resource), `:657-690` (row epic, story, summary, key, in text and in `title="..."` attributes), `:672-685` (`columnWidths.*` in `style` attributes), `:1145-1152` (tooltip summary, resource, predecessor key), `:1264` (subtask summary), `:1633` and `:1670-1672` (resource name, CoE, vertical). No escape function exists in the file.
- Sources an attacker controls:
  - Any Jira issue summary or epic summary. Any user who can edit one issue in the project controls it.
  - `saveTaskDependency` stores the `dependency` object from the payload as is (`index.ts:1126-1129`). `validateDependency` accepts any string as `predecessorKey` (probe P5b: `{"valid":true}` for `OTHER-999`).
  - `saveProjectMilestone` stores the `milestone` object as is (`index.ts:1163-1165`).
  - `updateWbsTask` allow-lists keys but not types or lengths (`index.ts:787-798`). `resource`, `epic`, `story` accept any string.
  - `saveColumnWidths` stores any object (`index.ts:1149`).
- Failure scenario: user A sets an issue summary to `<img src=x onerror="...">`. User B opens CascadePlan. The summary goes into `tr.innerHTML` (`index.html:671`). The handler runs in B's app frame. It can call the resolvers with B's identity. Writes run `asUser` (`index.ts:65-70`), so A can create, reassign or transition issues with B's permissions.
- Note: whether the payload runs depends on the CSP (CP-02). If the app works at all, inline script is allowed, and then this XSS also runs.
- Fix: build all rows with `createElement` and `textContent`. Validate every resolver payload with a schema (types, lengths, allowed characters for issue keys). Check that `predecessorKey` exists in the plan.

### CP-02. Critical (Inferred, needs live confirmation). The whole UI is an inline script that the default Forge CSP blocks
- Evidence: Observed-code for the structure. Inferred for the CSP effect.
- `index.html:327-1685` is one inline `<script>`. `index.html:661,665,666` add inline `onclick` attributes inside `innerHTML`. `manifest.yml:17-20` grants only `styles: 'unsafe-inline'`. It grants no `scripts` permission.
- My understanding of Forge Custom UI is that the default CSP does not allow inline scripts unless `permissions.content.scripts` includes `'unsafe-inline'`. I did not verify this against current Atlassian docs in this session.
- The page does not load `@forge/bridge`. It calls a private global, `window.__bridge.callBridge('invoke', ...)` (`index.html:329-343`). This is an internal detail of the bridge library, not a public API.
- Failure scenario: if the CSP blocks the script, the page stays on "Loading project schedule..." with the fixed badges "Project: DEMO" and "Completion: 31% | Target: 25%" (`index.html:21-22`). If someone "fixes" this with `scripts: 'unsafe-inline'`, CP-01 becomes exploitable.
- Fix: move the script to a bundled `.js` file served from the resource. Import `@forge/bridge` (`invoke`, `view`, `router`). Remove inline handlers. The lead auditor should confirm the live behaviour.

### CP-03. High. Synthetic 40 h estimates are shown and written to Jira
- Evidence: Observed-code.
- `scheduleBacklogTask` defaults `effortHours = 40` (`index.ts:416`). Both drop handlers omit `effortHours` (`index.html:800-805`, `:944-949`). The resolver then writes `originalEstimate: "40h"` to Jira (`index.ts:455-458`, `:622-626`).
- The backlog card shows `item.effortHours || 40` (`index.html:544`). An unestimated issue shows "40h".
- Bar resize uses `task.effortHours || 40` as the base and auto-scales by default (`index.html:962`, `:979-982`, checkbox `:188` is checked), then saves it (`:990-997`).
- Create defaults: `index.html:291`, `:1498`; `index.ts:471`.
- `calculateEffortWithSubtasksAndBuffer` returns 40 h when `rawEstimate` is missing and subtasks sum to 0 (`planner-engine.ts:54`, `:63-65`; probe P6: `40`).
- Failure scenario: issue PROJ-7 has a 10 h estimate in Jira. The PM drags it from the tray to a week. Jira PROJ-7 now has an original estimate of 40 h. The planner also stores 40 h, which overrides the Jira value on every later load (`index.ts:234`, `:240-242`).
- Fix: send the real estimate. Never write an estimate the user did not enter. Show unestimated issues as "Unestimated", not a number.

### CP-04. High. Scheduling from the tray replaces the real assignee with "Unassigned"
- Evidence: Observed-code.
- `scheduleBacklogTask` stores `resource: resource || 'Unassigned'` (`index.ts:437`). The drop handlers do not send `resource` (`index.html:800-805`, `:944-949`). On reload, `stored?.resource` wins over the Jira assignee (`index.ts:258`), because "Unassigned" is a non-empty string.
- Failure scenario: PROJ-7 is assigned to Jane in Jira. After the drop, the grid, tooltip and heatmap show "Unassigned". Jane's utilization drops by that task.
- Fix: do not store identity fields in KVS. Read assignee from Jira on every load.

### CP-05. High. The planner freezes Jira fields after the first save
- Evidence: Observed-code.
- `fetchLiveJiraIssues` prefers stored values for summary, epic, resource, status, effort and end date (`index.ts:234`, `:240-242`, `:251-264`).
- The task modal always sends `summary`, `resource` and `status` (`index.html:1385`). One save stores all three in `scheduleMap`.
- Failure scenario: a PM saves PROJ-7 with status IN_PROGRESS. Later a developer moves PROJ-7 to Done in Jira. The planner computes progress 100 from the live status (`index.ts:210-211`) but shows status IN_PROGRESS from storage (`:262`). A Jira rename never appears either.
- Fix: KVS keeps only app-owned data (week placement, allocations, dependencies). Jira-owned fields are always read live. Send only changed fields.

### CP-06. High. All Jira reads run as the app and bypass issue-level security
- Evidence: Observed-code. Impact Inferred from Jira permission behaviour.
- `fetchProjectUsers` (`index.ts:136`), `fetchProjectEpics` (`:160`), `fetchLiveJiraIssues` (`:185`) use `api.asApp()`.
- Failure scenario: an issue has a security level "HR only". A developer without that level opens the project page. The app returns that issue's summary, assignee and dates to the developer.
- Fix: run reads with `asUser()`, or filter results with the user's permissions.

### CP-07. High. A plain click on a bar overwrites the Jira due date
- Evidence: Observed-code.
- `setupBarDrag` adds a `mouseup` listener on every `mousedown` and always calls `updateWbsTask({ startWeek })`, even with zero movement (`index.html:1006-1030`). The click also opens the modal (`:909-911`).
- `updateWbsTask` then recomputes start and end from week boundaries (`index.ts:829-839`) and writes `duedate` to Jira (`:887`, `:618-620`). If the stored `startWeek` is outside the window, `findIndex` returns -1 and the task moves to week 0 (`index.ts:832`, `index.html:1010`).
- The modal does the same: a picked end date is replaced with the week-end date (`index.html:1392-1413`, then `index.ts:829-839`). The time inputs (`index.html:145`, `:152`) are never read.
- Failure scenario: PROJ-7 has due date Thursday 2026-11-05. The PM clicks its bar to read it. Jira PROJ-7 now has due date 2026-11-10 (the week end). Dependents are cascaded too.
- Fix: write only on real movement. Keep exact dates. Remove the time inputs or store them.

### CP-08. High. Stories under an epic are treated as subtasks and disappear from the grid
- Evidence: Observed-code and Observed-test (probe P4).
- `isSubtask` is true for any issue with a `parent` that is not an Epic (`index.ts:244`). In Jira Cloud, a story under an epic has a `parent`. `buildWbsHierarchy` then marks it `isSubtask: true` (`planner-engine.ts:586-589`).
- The grid hides subtask rows unless the parent row is expanded (`index.html:635-637`). The epic issue is usually in the tray, not in `tasks`, so no expand button exists.
- Probe P4: epic E-1, stories S-1 and S-2, sub-task ST-1 under S-1. Output order: `E-1 S-1(sub) S-2(sub) ST-1(sub)`. ST-1 is detached from S-1.
- Failure scenario: the PM drags story PROJ-12 (child of epic PROJ-1) onto the timeline. After reload the row is gone. The backlog count drops by one.
- Fix: model Epic, Story/Task and Sub-task levels from `issuetype.hierarchyLevel`. Recurse when grouping. Show orphans whose parent is not on the timeline as top-level rows.

### CP-09. High. KVS data model does not scale and fails hard when a value is too large
- Evidence: Observed-code for the model. Observed-test for the size estimate. Inferred for the platform limit.
- Every `getProjectPlan` call writes the full plan (tasks, backlog, weeks, 56 users) to `ps:plan:${projectKey}` (`index.ts:405`, `plan-repository.ts:37-39`). Every resolver ends with `getProjectPlan`.
- All schedule data sits in one value, `scheduleMap:${projectKey}` (`index.ts:305`).
- Size estimate (command 5, worst case with 3 subtasks and a dependency per task): about 2.35 KB per task. 100 tasks: plan 252 KB, scheduleMap 41 KB. 300 tasks: plan 724 KB, scheduleMap 124 KB. A task with no subtasks or dependency is about 1 KB.
- Against a 32 KB per-value limit (the figure in my brief), the plan fails at about 15 to 30 tasks. Against 240 KiB (the figure I recall from Forge docs; not verified in this session), it fails near 100 heavy tasks.
- Failure scenario: the plan exceeds the limit. `kvs.set` rejects. `getProjectPlan` throws. Every resolver throws. The UI shows "Unable to synchronize with Jira" with no way out.
- Also: keys use the project key, not the project id. A renamed project loses its plan. A new project that reuses the old key inherits it.
- Fix: do not cache the full plan. Store one record per issue id, prefixed with the project id. Use KVS queries to list them.

### CP-10. High. No pagination: projects with more than 100 issues lose data silently
- Evidence: Observed-code.
- `maxResults=100` for issues, 50 for epics, 50 for users (`index.ts:136`, `:161`, `:186`). No `nextPageToken` loop.
- Failure scenario: a project has 400 issues. Sorted by `created desc`, the 300 oldest (often the epics and long-running work) never appear. No message tells the user.
- Fix: page with `nextPageToken` up to a stated limit, inside a time budget. Show "showing N of M".

### CP-11. High. Concurrent edits overwrite each other
- Evidence: Observed-code.
- Every write resolver reads `scheduleMap`, changes it, and writes it back (`index.ts:419-441`, `:514-540`, `:852-883`, `:902-910`, `:1017-1033`, `:1063-1093`, `:1124-1131`). `version` is incremented (`:854-860`) but never compared.
- Failure scenario: PM 1 moves PROJ-3 while PM 2 sets a dependency on PROJ-9. Both read the same map. The second write removes the first change.
- Fix: one key per issue. Use KVS transactions or a compare-and-set on `version`. Return a conflict error.

### CP-12. High. Jira sync failures and resolver errors are hidden or shown as success
- Evidence: Observed-code.
- Backend: the result of `syncTaskToJira` is ignored at `index.ts:455`, `:543`, `:878`, `:887`, `:1036`. KVS is written before the Jira call. Planner and Jira diverge with no message.
- Frontend: `callResolver` catches every error and returns `null` (`index.html:331-343`). Callers treat `null` as success: `:1307` (`res && res.error`), `:1431`, `:1526`, `:1590`.
- Failure scenario: `createSubtaskForResource` times out. The modal shows "Created Jira subtask for Jane (20h)" (`index.html:1314-1318`). No subtask exists.
- Fix: return `{ ok, jiraSync: { ok, error } }` from each resolver. Show a banner on partial failure. Treat `null` as an error.

### CP-13. Medium. Create task: chosen assignee and epic are not written to Jira
- Evidence: Observed-code.
- The create assignee options carry no `accountId` (`index.html:1466-1473`). The issue body has only project, summary and type (`index.ts:478-484`). The planner stores the display name (`:536`), so it shows an assignee that Jira does not have.
- The epic select uses the epic summary as its value (`index.html:1461`). It is stored as a text label only (`index.ts:527`). No `parent` is sent. The default label is "Prerequisites" (`index.html:1496`).
- Issue type "Task" is hardcoded (`index.ts:482`). A project without "Task" cannot create.
- Fix: send `assignee.accountId` and `parent.key`. Read creatable types from `createmeta`.

### CP-14. Medium. cascadeSchedule defects
- Evidence: Observed-code and Observed-test (probes P1 to P3).
- Cycle detection (`planner-engine.ts:160-182`) is correct for one predecessor per task. Probe P5 (3-node cycle) returns `Cyclic dependency detected: A -> C -> B -> A`. A diamond is not possible because each task has one predecessor.
- P1: a successor outside the 15-week window (`findIndex` = -1, `:529-530`) is always pulled in. A successor planned for January next year moves to the earliest week.
- P3: at the window end, the span is clamped (`:527`, `:533`). Output: `spanWeeks still 4`, allocations `{"06-Jan":25}`. The task loses 75% of its allocation.
- P2: offset = `Math.floor(span * pct / 100)` (`:526`). For a 3-week predecessor, any trigger below 34% gives offset 0. The successor may start in the same week as the predecessor. Rounding to whole weeks removes the "percent-lag" precision.
- Edge cases: `spanWeeks` 0 falls back to 3 (`:521`). A trigger of 100 starts the successor after the predecessor's span. Zero and negative spans are not rejected anywhere (`index.ts:416`, `:831`). In `scheduleBacklogTask`, `spanWeeks: 0` with the first week gives `endIdx = -1` (`index.ts:422`), so `DEFAULT_WEEKS[-1].weekKey` (`:423`) throws a TypeError (Inferred from the code path, not run).
- Missing trigger defaults to 30 (`planner-engine.ts:525`, `index.ts:805`), not an error.
- Weeks start on Wednesday (`planner-engine.ts:284`). No working days or holidays.
- Timezone: `weekKey` uses local `getDate()` but dates use `toISOString()` (`:299-312`). On a UTC+5:30 host, probe output shows week key `28-Oct` with start date `2026-10-27`. Forge runs in UTC, so production is likely consistent (Inferred). Tests depend on the host zone.
- The cascade rewrites other issues' Jira due dates (`index.ts:878`) with no preview or confirmation.
- Fix: compute in dates, not week indexes. Use effort-based offsets. Never move tasks outside the window. Confirm cascades.

### CP-15. Medium. Ghost rows and tasks that come back after unschedule
- Evidence: Observed-code.
- The restore loop adds every `scheduleMap` key that live search did not return (`index.ts:329-355`). It gives it `startWeek: stored.startWeek || activeWeeks[0]` (`:348`) and ignores `isBacklog`.
- Failure scenario 1: an issue beyond the 100-issue cap is unscheduled. On reload it returns at week 0.
- Failure scenario 2: an issue is deleted in Jira. Its row stays forever as "Task PROJ-44" or with its old summary.
- Failure scenario 3: `addSubtaskToTask` with any `parentTaskId` creates a map entry (`index.ts:1063-1093`), which becomes a ghost row.
- Fix: never render map entries that Jira did not return. Prune them.

### CP-16. Medium. Issue keys from the payload are not checked against the project
- Evidence: Observed-code.
- `scheduleBacklogTask.taskId` (`index.ts:416`, `:430`, `:455`), `addSubtaskToTask.parentTaskId` (`:1064`), `unscheduleTask.taskId` (`:903`) and `predecessorKey` (`:1114-1119`, probe P5b) accept any string.
- Failure scenario: a user calls `scheduleBacklogTask({ taskId: "OTHER-5" })` from project A. OTHER-5 appears in A's plan, and its due date and estimate change in Jira. The write runs as the user, so Jira still enforces the user's edit permission. This is a data-integrity defect, not a privilege escalation.
- Mirror links: `mirrorDependencyToJira` posts a "Blocks" link on every modal save that has a predecessor (`index.ts:821`). It may create duplicates (Inferred). Removing the dependency does not remove the link. I did not verify the inward/outward direction semantics for "Blocks" against Jira docs.
- Fix: check every key against the live project issue set before any write.

### CP-17. Medium. No 429 retry, many sequential calls, timeout risk
- Evidence: Observed-code. Timeout risk Inferred.
- No code reads `Retry-After` or retries on 429.
- `updateWbsTask` runs `getProjectPlan` twice (`index.ts:780`, `:889`). Each run makes 3 Jira calls, 5 KVS reads and 1 large KVS write. Then it makes one sequential Jira PUT per cascaded task (`:878`), then up to 4 more calls for the main task (`:645-740`).
- Failure scenario: a chain of 30 dependents with rate limiting. The resolver exceeds the 25 s limit. KVS is already changed for some tasks; Jira is changed for others.
- Fix: batch, bound the cascade, add backoff, and move cascades to an async event queue.

### CP-18. Medium. Stale week list in warm containers, synthetic sprint names
- Evidence: Observed-code. Container reuse Inferred.
- `DEFAULT_WEEKS` is computed once at module load (`index.ts:80`). It is used by `scheduleBacklogTask` (`:421-434`), `createInlineTask` (`:470`, `:517-534`) and `fetchLiveJiraIssues` defaults (`:263-264`). `getProjectPlan` uses fresh weeks (`:302`).
- Failure scenario: a warm container from Tuesday serves a Wednesday drop. `findIndex` of the new week key returns -1, so dates come from week 0 while `startWeek` holds the new key.
- Sprint names are "Sprint 0", "Sprint 0", "Sprint 1"... (`planner-engine.ts:303-304`). They are not Jira sprints.
- Fix: compute weeks per call. Read sprints from the Jira Software API, or label columns by date only.

### CP-19. Medium. Fake or misleading data shown to users
- Evidence: Observed-code and Observed-test (P8, P9).
- `index.html:21-22`: "Project: DEMO" and "Completion: 31% | Target: 25%" are shown before load and stay if load fails.
- `index.ts:201`: issues with no parent get epic "Prerequisites". `index.ts:527`: "General". `index.ts:391`: project name "Project KEY" instead of the real name.
- `planner-engine.ts:452-456`: heatmap rows get CoE "Core Engineering", vertical "Core Platform", project "Project 1". Probe P9 confirms. No UI sets real metadata.
- Utilization is the percent of a task's span, not the person's capacity. Probe P8: Ann with 120 h over 3 weeks shows "33% UNDER_UTILIZED" each week. Effort hours are ignored (`planner-engine.ts:376-387`).
- `targetProgress` is always 0 (`index.ts:261`) and the UI cannot set it. "Target" and "behind schedule" are therefore never meaningful.
- The "Resource Utilization (Per-Person)" view calls the heatmap resolver (`index.html:1623`). It shows the same data as the heatmap.
- Six placeholder users are offered for assignment (`index.ts:95-102`).
- Fix: remove all defaults that look like data. Compute utilization from effort and capacity. Show "Not set" for unknown values.

### CP-20. Medium. Destructive actions have no confirmation and no undo
- Evidence: Observed-code.
- Row unschedule button (`index.html:724-730`), drop on tray (`:406-418`), modal "Move to Backlog" (`:1334-1347`), and dependency removal by choosing "None" (`:1422-1424`) act at once.
- Escape closes every modal (`:435-441`). A backdrop click closes it (`:426-432`). Unsaved edits are lost with no warning.
- Fix: add a confirm or an undo flag. Warn on unsaved edits.

### CP-21. Medium. ADS and accessibility gaps
- Evidence: Observed-code.
- `style.css:1-18` redefines `--ds-*` names with fixed light-theme hex values. This hides real Atlassian tokens and blocks dark mode. `index.html` has 48 hex colour literals in inline styles.
- 0 `aria-*` or `role` attributes in `index.html`. Most `<label class="form-label">` elements have no `for` (for example `:121`, `:126`, `:131`). Icon buttons use emoji with only `title`.
- Scheduling, resizing, reordering and unmapping are mouse-only (`:956-1035`). Bars are `div` elements and take no focus. Modals have no focus trap.
- Layout: `.gantt-wrapper` scrolls horizontally (`style.css:118`), which is correct. The header uses flex without wrap (`style.css:35`, `:47`) and `body` hides horizontal overflow (`:21`), so header controls may clip at 1280 px. Inferred; the lead should check live.
- Fix: use real ADS tokens via `@atlaskit/tokens` or the Forge theme. Add keyboard actions, labels and ARIA.

### CP-22. Medium. No licensing and no product event triggers
- Evidence: Observed-code. `manifest.yml` has no `app.licensing` and no `trigger` module. A paid listing needs a licence check. Jira-side changes never refresh app data except on page load.

### CP-23. Low. Issue links in the grid point to the wrong host
- Evidence: Observed-code. Effect Inferred.
- `index.html:661` uses `href="/browse/${task.key}"`. In a Custom UI iframe, a relative path resolves to the app's CDN origin, not the Jira site.
- Fix: use `router.open` from `@forge/bridge`.

### CP-24. Low. Local "subtasks" are not Jira subtasks
- Evidence: Observed-code.
- `addSubtaskToTask` stores a subtask in KVS only (`index.ts:1069-1093`). Once stored, this list replaces the real Jira subtask list (`index.ts:228-230`). The UI section is labelled "Subtasks & Risk Buffer" (`index.html:214`) next to the real "Multi-Resource Allocation (Jira Subtasks)" section, which is confusing.

### CP-25. Low. Dead UI Kit code with hardcoded demo data
- Evidence: Observed-code. `src/frontend/index.tsx` is not referenced by the manifest. It contains "Resource 1", dates "2026-08-26", filter options "Project 1/2/3" (`:56-61`, `:439-459`). `tsc` compiles it into `dist/`. Delete it.

### CP-26. Low. Type and storage hygiene
- Evidence: Observed-code. 20 `any` in live backend code. `ps:${projectKey}:task:${key}` is written (`index.ts:884`, `:1132`) and never read. `extractProjectKey` falls back to payload and then to "DEMO" (`index.ts:1209`).

### CP-27. Low. Test quality gaps
- Evidence: Observed-code and Observed-test.
- The real UI (`index.html`) has no test.
- asApp and asUser return the same mock (`test/index.test.ts:36-47`). No test can detect CP-06.
- Tests assert the 40 h default as correct (`planner-engine.test.ts:435-440`, `:478-486`; `index.test.ts:449-464`).
- The cascade integration test only checks `toBeDefined()` (`index.test.ts:1499`).
- The test named "extracts projectKey from payload first" (`index.test.ts:987-989`) describes the old, unsafe order.
- The mock matches any URL that contains `/rest/api/3/issue` (`index.test.ts:162-168`), so links, transitions and assignee calls all return 201.
- No test covers pagination, payload size, 429, or concurrent writes.

### CP-28. Low. Progress uses mismatched Jira fields
- Evidence: Observed-code. Progress divides `aggregatetimespent` (includes subtasks) by `timeoriginalestimate` (parent only) (`index.ts:205-214`). A parent with time logged on subtasks shows inflated progress. Effort rounds to whole hours, so a 20-minute estimate reads as 0 h (`:207`).

## 4. What is correct

- Project key comes from `req.context.extension.project.key` first (`index.ts:1203-1210`). The F3 attack from the earlier audit no longer works when context is present.
- All Jira writes run `asUser()` (`index.ts:65-70`), so Jira permissions and Jira history apply to the real user.
- The app now reads real Jira issues, epics and assignable users. No seed tasks exist.
- `createInlineTask`, `createJiraEpic` and `createSubtaskForResource` return Jira error text and add no fake row on failure (`index.ts:493-504`, `:579-590`, `:1001-1003`).
- `updateWbsTask` uses an allow-list of fields (`index.ts:787-798`).
- Cycle detection and self-dependency rejection are correct for the single-predecessor model. The threshold is validated 0 to 100 in `saveTaskDependency` (`planner-engine.ts:146-151`).
- `evaluateDependency` computes an earliest start with a stated reason (planned rate or observed rate) and flags violations (`planner-engine.ts:192-272`). This is the product's real differentiator.
- Weeks are computed from the current date per `getProjectPlan` call.
- `syncTaskToJira` retries without `duedate` when the screen rejects it, and falls back to the assignee endpoint (`index.ts:653-689`).
- The UI handles `document.readyState` correctly (`index.html:358-362`) and uses `addEventListener` for almost all events.
- Multi-resource allocation through real Jira subtasks respects the single-assignee model.
- Runtime is `nodejs22.x`. The icon is packaged locally. tsc is clean under `strict`. 152 of 152 tests pass.

## 5. Status of the 2026-10-30 audit findings

| ID | Earlier finding | Status now |
|---|---|---|
| F1 | Invented tasks, no Jira reads | Fixed. Residue: stale cached plan fallback (`index.ts:320-326`) and ghost rows (CP-15). |
| F7 | Failed create returns success | Fixed in backend. Frontend still shows `null` errors as success (CP-12). |
| F8 | Heatmap invents people and org data | Partially fixed. Synthetic rows gone. Default CoE/vertical/project strings remain (CP-19). |
| F11 | Hardcoded calendar | Mostly fixed. Synthetic sprint names, stale module copy (CP-18). `CURRENT_WEEK_INDEX = 6` still exists in `models.ts:254` but only dead code uses it. |
| F15 | Resources are free text | Mostly fixed. accountId is read and written. Create flow does not send the assignee (CP-13). Placeholders remain. |
| F19 | Create form ignores dates | Partially fixed. Start week is used. Epic is not linked as parent, type "Task" is hardcoded (CP-13). Time inputs are ignored (CP-07). |
| F4 | No Gantt | Fixed in code (Custom UI, bars, SVG connectors, drag). Whether it runs depends on CP-02. |
| F12 | Wrong status colours and utilization | Partially fixed. "Done" rule fixed. Utilization is still span percent, not capacity (CP-19). |
| F18 | Heatmap filter stale closure | Not applicable to the live UI. The dead file still has it. |
| F5 | No two-way sync | Partially fixed. Writes exist. Jira-to-planner is overridden by stored values (CP-05). No triggers (CP-22). |
| F10 | Concurrent overwrites | Still open (CP-11). |
| F6 | Dependency engine is one comparison | Fixed for earliest start, violation and cycles. Still one predecessor per task. Unknown predecessor accepted (CP-16). |
| F14 | Threshold not validated | Mostly fixed. 0 is now allowed. `updateWbsTask` turns NaN into 30 silently (`index.ts:805`). |
| F21 | Unscoped dependency key | Fixed for `ps:dep:`. A new unread key `ps:KEY:task:*` replaces it (CP-26). |
| F3 | Payload project key preferred | Fixed for project key. Issue keys still unchecked (CP-16). |
| F9 | Issues created as app | Fixed for writes. Reads now run as app (CP-06). |
| F16 | Unused scope, no licensing | Partially fixed. `read:jira-user` is now used by assignable search. Licensing still missing. |
| F17 | updateWbsTask accepts any field | Fixed by allow-list. Types and lengths are still unchecked (CP-01). |
| F22 | One KVS value per plan | Still open, and worse: the full plan is now written on every read (CP-09). |
| F23 | Hotlinked icon | Fixed (`manifest.yml:5`, local `icon.svg`). |
| F20 | Tests assert fake behaviour | Partially fixed. Seed tests gone. Frontend untested. 40 h default asserted (CP-27). |
| F24 | No version control | Partially fixed. Repo is in git, but the reviewed tree is uncommitted, so no SHA identifies a deployable build. |

## 6. Suggestions

### Tier 1: quick wins (hours to 2 days)
1. Replace every `innerHTML` with `textContent` or an `escapeHtml` helper. Validate resolver payloads (CP-01).
2. Move the inline script to a bundled file and use `@forge/bridge` (CP-02).
3. Remove every 40 h default. Send the real estimate and assignee on drop (CP-03, CP-04).
4. Write to Jira only on real drag movement. Send only changed fields from the modal (CP-07, CP-05).
5. Switch reads to `asUser()` (CP-06).
6. Remove the fixed header badges, "Prerequisites", "General", the heatmap default strings and the dead `src/frontend/index.tsx` (CP-19, CP-25).
7. Treat `null` from the bridge as an error. Show sync failures (CP-12).
8. Commit the working tree and tag the build.

### Tier 2: hardening (1 to 3 weeks)
1. Redesign KVS: one record per issue id, project-id prefix, no full-plan cache, compare-and-set on version (CP-09, CP-11).
2. Page `/search/jql` with `nextPageToken` and a time budget. Add 429 backoff (CP-10, CP-17).
3. Build the hierarchy from `issuetype.hierarchyLevel`. Recurse. Show orphans (CP-08).
4. Prune ghost rows. Validate every issue key against the project (CP-15, CP-16).
5. Fix cascade: date-based, effort-based offsets, no pull-in from outside the window, preview before writing (CP-14).
6. Add `app.licensing` and `avi:jira:updated:issue` triggers (CP-22).
7. Test the UI: extract the JS into modules and test them with jsdom. Mock asApp and asUser separately (CP-27).

### Tier 3: strategic UX
1. Make the progress-threshold dependency the hero feature: show the earliest-start reason in the tooltip and on the connector.
2. Support many predecessors per task, with a real graph and Kahn ordering.
3. Model capacity per person (hours per week) and compute real utilization. Give the heatmap real CoE metadata or remove it.
4. Add keyboard scheduling, ADS components or tokens, dark mode, and undo for every destructive action.
5. Support configurable week start, working days and holidays, and Jira sprints as columns.

## 7. Readiness score

**25 / 100.**

The app has made real progress since the 2026-10-30 audit. It reads real Jira data, writes as the user, takes the project from trusted context, and has a working earliest-start engine. The code compiles cleanly and 152 tests pass. But the live UI is one untested inline script. It either does not run under the default Forge CSP, or, if it runs, it has stored XSS that lets one user act with another user's Jira permissions. The data path also corrupts Jira on normal use: a drag writes a fake 40 h estimate and hides the real assignee, a click rewrites the due date, and stored values hide later Jira changes. Stories under epics vanish from the grid. The KVS model fails hard as projects grow, has no concurrency control, and reads only the newest 100 issues. These defects block any release, not only a paid listing. The dependency engine is the asset worth keeping.
