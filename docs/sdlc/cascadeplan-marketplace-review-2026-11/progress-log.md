# CascadePlan fixes: progress log

Branch `feature/cascadeplan-marketplace-fixes`, from `master` at `db08009`. One entry per fix, in the order built, with the commit and the proof. The plan is `fix-plan-v4.md`; the decisions are in its section 2.0.

## 2026-11-05

### BL-8. Build reproducible and deployable from a clean clone (ADR-007)

- **Commit:** `628bb79` "build: shared UI package builds itself during install"; CI workflow in the next commit.
- **What changed:**
  - `packages/asymm-jira-ui`: `prepare` builds `dist/`; own dev dependencies and lock file; no `paths` or `typeRoots` into an app.
  - All four apps: `file:` dependency on the package, `.npmrc` with `install-links=true`, no `@asymm/jira-ui` `paths` or jest mapping, a committed `package-lock.json`.
  - CascadePlan: `app.js` rebuilt from the app's own `node_modules`.
  - `.github/workflows/apps-ci.yml`: the clean-clone job for every app.
- **Proof** (fresh clone of `628bb79` in `/home/fahimfarookme/.cache/gemini-earning-cp-fixes-ci/clean`, no hand-built `dist`, no sibling `node_modules`):
  - `npm ci` in the package, the app and `tools`: all exit 0; the package's `dist/` and the app's copy exist.
  - CascadePlan: `tsc --noEmit` 0 errors; `jest --coverage` 769 tests passed, thresholds met; `npm run build` leaves `git status` clean (the committed bundle is reproducible); `src/frontend/admin.tsx` bundles; `forge lint` "No issues found".
  - `forge deploy -e development` from the clean clone: "Deployed PlanShift to the development environment", version 2.47.0. The CLI added: "eligible for the Runs on Atlassian program" (evidence for BL-6 and MK-01). The product code is unchanged from `db08009`.
  - Other apps, in the worktree: LedgerSeal 315 tests passed, FourRealities 403 passed, `tsc` 0 errors in each. DefinitionGuard: `tsc` 0 errors; 342 passed and 5 failed, all in `test/listing.test.ts` (B-08 listing v2), which compares `docs/marketplace/definitionguard-listing-v2.md`. That file, the manifest and the tests are unchanged from `origin/master`, so the failure exists on `master` and is not caused by this change. It belongs to the DefinitionGuard work.
- **Not done:** the deploy above had no build tag. From now on, deploys use `forge build -t <sha>` and `forge deploy -t <sha>` (spec v2 section 8).

### F-12. Three undefined functions in the shipped bundle

- **What changed:** `legacy-planner.js` calls `addDaysIso` (the imported `addDays`) in the date editor, imports `showErrorBanner` from `banner.ts`, and no longer calls the missing `populateEpicDropdowns` (the epic picker and the create form rebuild their lists from `currentPlan.availableEpics` when they open). New test `test/frontend-names.test.ts`.
- **Proof:** TypeScript (`checkJs`) found exactly these 6 call sites as TS2304 and no other undefined name. The new test fails on the old file with those 6 lines and passes on the fix. Full suite 770 passed, coverage thresholds met; bundle rebuilt.

### F-03 (parts 1 and 2). The plan after a write shows the dates Jira accepted

- **What changed:** new `applyAcceptedDueDate` in `src/index.ts`. After each due-date write that Jira accepted, it replaces that issue's due date in the call's own Jira data (a new list; the issue objects are not changed). Called for the target and every cascaded successor in `updateWbsTask`, and for each successor in `continueCascade`. `batchUpdateTasks` passes the same data to every item, so later items see the earlier items' due dates (FX-01).
- **Proof:** R-30, R-31 and FX-01 failed on the fix (they asserted the defect) and were rewritten to assert the written dates; full suite 770 passed, coverage thresholds met. Harness `e2e_review.py`: R1c now passes (60.7 px before and after the response); `e2e.py` 30/30.
- **Remaining for F-03:** part 3, `reconcileIssues` on the Jira searches that follow a write in a later call (the search is eventually consistent). Harness R2a to R2c (Undo and Redo after a drag) still fail; that is F-04.

### F-04. A drag can be undone, and Cancel restores the old dates

- **What changed:** `callResolver` takes an optional `before` snapshot. The drag takes it before its optimistic change and passes it. The dependency dialog keeps `prevStart` and `prevEnd`, and Cancel writes them through `commitDates` (current version), then announces whether the revert was saved.
- **Proof:** harness `e2e_review.py` 25/25 (R2a Undo restores, R2b Redo re-applies, R2c both write the due date to Jira); `e2e_undo_probe.py`: the first drag offers Undo and Ctrl+Z restores the start; `e2e.py` 30/30; unit suite 770 passed.
- **Not covered by a harness check yet:** Cancel in the dependency dialog (needs a scripted conflict drag); covered by reading.

### F-08. A status change is reported only when Jira applied it

- **What changed:** `syncTaskFields` records why the status was not written (no matching transition, transitions not readable, POST not 204) and returns it in `rejected` with a per-field `reasons` map. `syncTaskToJira` logs each refused field with its own reason (the due-date message stays for the due date).
- **Proof:** R-08 and R-09 failed on the fix and were rewritten to assert `ok: false` with the reason; full suite 770 passed, coverage thresholds met.

### F-06. No default values written to Jira (part of BL-3)

- **What changed:**
  - `scheduleBacklogTask`: the default span is planner data only. With a Jira due date on or after the drop day, the bar ends on it; with one before the drop day, the drop is refused ("TEST-2 is due on ... in Jira, before ..."); a due date is written only for a user-chosen `endDate` (new optional field). The estimate is written only when sent.
  - `createInlineTask`: no due date from the default span; only a sent `endDate`.
  - `createSubtaskForResource`: no 20 h estimate and no two-week due date; only sent values. The "Allocate resource" form sends no estimate when its hours field is empty.
  - Progress no longer sets the status, on the server and in the task form.
- **Proof:** R-10 and R-13 failed on the fix and were rewritten (R-13 now also covers `createInlineTask` and a positive case). New `test/schedule-due-date.test.ts` (3 tests). Four product tests that encoded the old default-span due date now assert no write, and a user-chosen end case was added. Full suite 774 passed, coverage thresholds met; harness `e2e.py` 30/30, `e2e_review.py` 25/25.
- **Remaining:** the bar style "no due date in Jira" for a scheduled issue without a Jira due date (UI); the optional "Also move the issue to Done" checkbox was not added, because the form's status field already lets the user choose. The 8 h default of the planner-only sub-task goes with F-23.

### BL-9 (and F-05). Only a deleted Jira issue removes its planning records

- **What changed:** `pruneStaleEntries` and its resolver are removed; the planner no longer calls anything on load. New `deleteIssueRecords` and `issueDeleted` in `src/index.ts`, exposed as `issueDeletedTrigger`. `manifest.yml`: trigger `issue-deleted` on `avi:jira:deleted:issue`, function `issue-deleted-fn` (Forge module keys are unique across modules; `forge lint` caught the first version).
- **Proof:** R-18 (no prune resolver: the handler throws "no definition"; loading twice keeps the record of an issue the user cannot see; the event deletes it), FX-05 (the key-form record is deleted), and the rewritten cleanup and plan-isolation tests (every plan; a second event changes nothing). Full suite 774 passed, coverage thresholds met; `forge lint` clean; harness 30/30 and 25/25.
- **Live (development, build tag `66e91cc`, version 2.48.0):** `test/live/trigger_check.py` created DEMO-36 (Task) as the signed-in user and deleted it (204). `forge logs` 12:14:36Z: "issue-deleted DEMO-36 (project id present): 0 record(s) deleted". So the event reaches the app, and its payload carries the issue key and `issue.fields.project.id` (not documented by Atlassian; now observed). 0 records, because DEMO-36 never had a plan record.
- **Live site changes:** DEMO-36 created and deleted (2026-11-05 12:14Z). Nothing else.
- **Remaining:** the quiet "N planned issues are not visible to you" note in the UI. Moved issues (BL-9 step 3, P3).

### F-13 (with M6 and part of M7). A failed or unreachable call never shows as a success

- **What changed:** `withOk` in `src/index.ts` gives every result passed through `withResolverHandler`, and the special `updateWbsTask` wrapper, a boolean `ok`. `bridge.ts` turns a thrown invoke into `{ ok: false, success: false, error: 'unavailable', message }`. In `legacy-planner.js`, the inline create, the create-task form, the epic form and the allocate-resource form test `ok !== true` and show `message` first; the three schedule flows show "Scheduled ..." only for `ok === true`.
- **Proof:** new `test/result-ok.test.ts` (2 tests). Full suite 776 passed, coverage thresholds met; harness 30/30 and 25/25.
- **Remaining:** a harness check that forces `invoke` to throw in a create flow. M7 outside the create flows (the task form shows `res.error` on a conflict).

### N-01 and F-24. Calls act only on the project page's own project

- **What changed:** `extractProjectKey` and `extractProjectId` throw a validation error when the Forge context has no project (no payload or "DEMO" fallback), so every planner resolver refuses such a call. New `adminHandler` with `approver-policy-get-api`, `approver-policy-set-api` and `approver-group-search-api`; `manifest.yml` points the admin page at function `admin-resolver`. The `authority-*` aliases are removed. `checkPlanApprover` runs through `withResolverHandler` and passes `{ projectId }` from the context. `hasTier1AdminPermission` and `isPlanApprover` take `{ projectId?, issueId? }` (numeric ids only) and return false without one, with no Jira call.
- **Proof:** FX-04 now asserts that a call from the admin context is refused, keeps the legacy keys and writes nothing under the project key, and that the project page then migrates under the project id. R-17 asserts `projectId=10001` and no call for a non-numeric id. Tests that encoded the payload-first and "DEMO" fallbacks now assert the refusal; the approver-policy tests use `adminHandler`, and the planner function refuses those names. Full suite 776 passed, coverage thresholds met; `forge lint` clean; harness 30/30 and 25/25.

### BL-2 (with F-01, C8, H9). The user's Jira permissions are checked before every write

- **What changed:**
  - New `src/security/write-permissions.ts`: the real check calls `POST /rest/api/3/permissions/check` as the user with the issue ids (chunks of 1,000); an id missing from the answer is denied; a non-200 answer or an error throws `PermissionCheckError`, which `withValidation` turns into `{ ok: false, error: 'forbidden', message }`. `requireIssuePermissions` throws `ForbiddenError` with the issue keys and the missing Jira permission names.
  - `updateWbsTask`: `EDIT_ISSUES` on the target, plus `SCHEDULE_ISSUES` for date fields and `LINK_ISSUES` for dependencies, checked after the version check and before any write. Cascaded successors without `EDIT_ISSUES` and `SCHEDULE_ISSUES` are not moved and are logged "not moved: you lack ... on this issue in Jira". `continueCascade` does the same per batch.
  - `scheduleBacklogTask` (`EDIT_ISSUES`, plus `SCHEDULE_ISSUES` when an end is written), `unscheduleTask`, `reorderWbsTasks`, `addSubtaskToTask` and `createSubtaskForResource` (`EDIT_ISSUES` on the parent).
  - `createInlineTask` checks the plan before the Jira create.
  - `RESOLVER_RULES` and `define()`: rules `read`, `issue-checked`, `plan-approver` (create, rename, delete plan; freeze baseline; review shift), `project-user` (shift request, column settings). `getProjectPlans`, `saveTaskDependency`, `saveProjectMilestone` and `previewCascade` are no longer registered (no caller); their functions stay.
  - `reviewScopeShift`: only `APPROVED` or `REJECTED`; a reviewed request cannot be reviewed again; the reviewer must be identified and must not be the requester.
  - Tests: `test/setup-permissions.ts` (jest `setupFilesAfterEnv`) installs an allow-all checker; `test/write-permissions.test.ts` restores the real check against a fake Jira. The browser harness uses the real check; its fake Jira answers the permission check and makes the user a project administrator.
- **Proof:** R-11 (real check, no permission: `forbidden`, both plans unchanged, no Jira PUT), R-14 (no Jira create for a deleted plan), R-16 (non-approver refused through the resolver; self-approval, an odd status and a second review refused). `write-permissions.test.ts`: denial of an id missing from the answer and of a key without an id; a 500 from the check refuses the write; a successor without permission is not moved and is reported; a non-approver cannot create a plan; no top-level `resolver.define` in `src/index.ts`, and every `define` name has a rule. Full suite 781 passed, coverage thresholds met; `forge lint` clean; harness 30/30 and 25/25.
- **Remaining:** BL-2 step 8 (hide plan rename and delete in the UI for non-approvers); the live test with a Browse-only user (needs the owner to create the user).

### Live check on development after BL-2 (build tag `12c98f6`, version 2.49.0)

- `test/live/live_move.py DEMO-29 7 L2`, then `-7 L3`, as the owner (project administrator), through the real Jira bulk permission check.
- One week later: bar 170 px before the move, during it, after the server answered, and after a reload (the review measured 85 px after the answer). The flag offered Undo. The Changes panel: "DEMO-29 | due date | 2026-11-10 | 2026-11-17 | Written".
- Back one week: 170 px after the answer (the review measured 255 px) and after a reload; Changes panel "2026-11-17 -> 2026-11-10 Written". DEMO-29 is restored to 2026-10-28 to 2026-11-10, Jira due date 2026-11-10.
- So F-03 and F-04 hold live, and the permission check (BL-2) works against real Jira as the user.
- **Live site changes:** DEMO-29's due date 2026-11-10 -> 2026-11-17 -> 2026-11-10 (both by this check, between 12:28Z and 12:37Z on 2026-11-05). The script records Jira's history from before the move, so the two new entries are not in its JSON.

### F-07 (with N-11 L2 and part of F-15). No Jira write before the task's record is saved

- **What changed:** `updateWbsTask` collects the Jira writes it needs (link create, owned-link deletes, new contributor sub-tasks, sub-task delete or unassign) in `jiraPlan` and runs them in the new `applyPlannedJiraWrites` after the target `putEntry` succeeded. The link id and sub-task keys go into the record with a second versioned `putEntry`. When Jira refuses the link (ADR-004), the previous record is restored and the result is `{ ok: false, error: 'link_refused', message }`. A contributor whose Jira sub-task could not be created is not stored and is reported. Because the cycle check and the cascade run before the save, a cycle now creates no Jira link (part of F-15; the validator still follows only the first link).
- **Proof:** R-04, R-05, R-06 (a version race at the save: no link, no sub-task create, no sub-task delete), R-15 (cycle: no link created), FX-02 and FX-03 (stale version: no link delete, no unassign) and a new FX-02/03 case without conflict (both writes run after the save and are reported); new N-11 L2 test (refused link: `link_refused`, record unchanged). The contributor test of `work-effort-model.test.ts` now has a fake Jira that creates the sub-task, and asserts its key. Full suite 783 passed, coverage thresholds met; harness 30/30 and 25/25 (the harness fake Jira now answers a link create with 201).

### F-11 (H7). Saving the task form never unassigns by accident

- **What changed:** `openTaskDetailModal` adds the current assignee as an option when Jira did not list them, and selects by account id. `saveTaskModalChanges` sends `resource` and `resourceAccountId` only when the field was touched (`data-touched`) and the account id differs from the one the form opened with.
- **Proof:** new `test/e2e/e2e_assignee_probe.py` (the fixture's DEMO-40 now has an assignee, Ann Lee, who is not among the assignable users). On the old planner it fails: the form shows "Unassigned", and Save writes `{"fields":{"assignee":null}}` to DEMO-40. On the fix it passes: Ann Lee is shown, and Save writes nothing. Harness 30/30 and 25/25; unit suite 783 passed.
- **Remaining:** matching people by account id elsewhere in the planner (FE section 16 item 6).

### F-19 (with C6). A refused due date leaves the task and its plans unchanged

- **What changed:** in `updateWbsTask`, the target's Jira sync runs right after the save (and after the planned Jira writes of F-07), before successors are saved, dates are shared and successors are synced. If the update has an end date and Jira did not accept the due date (screen error, other failure, or network), the target's shared date fields are put back from the record read at the start, nothing else moves, and the result is `{ ok: false, error: 'due_date_refused', message: "<reason>, so <key> keeps its dates and nothing else moved." }`. If another user saved in between, the message says to reload.
- **Proof:** R-12 (a refused due date: `due_date_refused`, old dates in both plans). The `jira-sync-report.test.ts` rejection test now asserts `ok: false`, the message and no write for the successor (it had asserted the old behaviour). Harness R8a (the user sees the reason) and R8b (rewritten: the task keeps its old dates; it had recorded the defect as expected). Unit suite 783 passed; harness 30/30, 25/25 and the F-11 check.

### F-20 (with M3, M5 and C4). A cascade finishes for every moved task, or says why not

- **What changed:** `batchUpdateTasks` returns `cascadeRoots` (each item with successors left) and the merged `cascadeRemaining` instead of `[]`. `bridge.ts` splits one call (`callOnce`) from the loop: `callResolver` continues from every root with one round counter for the whole call (40), and shows "The cascade did not finish. Move the task again to continue." when it runs out. `updateWbsTask` and `continueCascade` return `cascadeSkipped` (successors not moved because another user changed them or the user lacks permission); the Changes panel message is "not moved: someone else changed it; move the task again".
- **Proof:** R-07 rewritten (the skipped successor is returned and reported). New `test/frontend/bridge-cascade.test.ts`: a batch with two roots is continued from both, in the first write's plan; an endless cascade stops at 40 rounds in total and shows the message. Two tests updated for the new message text, and the source test now looks for `callOnce('continueCascade', ...)`. Unit suite 785 passed, coverage thresholds met; harness 30/30 and 25/25.

### F-15 (with N-06 rule 6, validator part). Dependency checks follow every link and the hierarchy

- **What changed:** `PlannerEngine.validateDependency` walks every active link of every task (`dependencies`, which include links imported from Jira), breadth first from the predecessor, and refuses a link between an issue and any of its ancestors or descendants (`parentKey` chain). `cascade` in `schedule-engine.ts` no longer throws on a cycle: when the changed task is in a cycle it moves nothing and returns `cycle`; tasks of a cycle elsewhere are left out of the Kahn order, and the rest moves. `updateWbsTask` and `continueCascade` report each task of a cycle as "not moved: it is in a dependency cycle; remove one of its links".
- **Proof:** R-15 now fails in the validator ("Cyclic dependency detected: TEST-1 -> TEST-2 -> TEST-1") before any Jira write. New engine tests: a cycle is reported and nothing in it moves; a cycle elsewhere does not stop the move of a task outside it. New validator tests: a cycle through a second link; parent and sub-task links refused both ways. Unit suite 788 passed, coverage thresholds met.
- **Remaining (N-06 rule 6):** links imported from Jira between a parent and its own child are not yet marked "ignored by the schedule" in the view.

### N-06 rules 1, 3 and 4. A parent's roll-up stays in step when its sub-tasks move

- **What changed:**
  - Rule 1: `updateWbsTask` builds the cascade input with `withRollUps` (parents recomputed from their dated children with the new dates), cascades from the target, then from every ancestor (`ancestorKeys`) whose roll-up changed, chaining the engine's efforts and merging the changes.
  - Rule 3: a date change of a task whose dates come from its children (`datesFromChildren`) is refused with "<key> takes its dates from its sub-tasks. Move its sub-tasks instead." until the block move (N-05) exists.
  - Rule 4: `getProjectPlan` moves a task or story parent with a dated child from the backlog to the timeline with its roll-up, repeating for grandparents. Epics stay in the backlog until scheduled, as backlog item B-05 requires (and DEC-5b leaves epic blocks for later).
- **Proof:** PM-01 (the parent's successor moves to the day after the new roll-up end, and its due date goes to Jira), PM-03 (a direct parent move is refused; nothing written), PM-04 (the parent is on the timeline with the roll-up). Two write-transparency tests moved TEST-1, which is a roll-up parent in their fixture; they now change the leaf TEST-2. The B-05 epic test and "moving a sub-task writes nothing to its parent issue in Jira" stay as they were and pass. Unit suite 788 passed, coverage thresholds met; harness 30/30, 25/25 and the F-11 check.
- **Not built, on purpose:** DEC-6 (the parent's Jira due date follows its roll-up end). Spec v2 INV-03 allows such a derived write only when the drag preview lists it first, and the preview does not yet show parent changes. It comes with the preview work of N-05. Rule 2 (a cascade into a parent moves its block, PM-02) and rule 5 (the parent's links bind its sub-tasks) also come with N-05.
- **Remaining:** the client-side drag preview does not yet draw the ancestor cascade of rule 1.

### F-18, F-25 and F-28. Validation, progress source and reorder conflicts

- **F-18:** `validateTaskUpdates` checks both dates against a window of five years back and ten years ahead (`dateInWindow`) and refuses an end before the start; `updateWbsTask` also refuses it when only one end is sent. New `validateSchedulePayload` for `scheduleBacklogTask`, `createInlineTask` (summary required, 1 to 255 characters) and `createSubtaskForResource`: span 1 to 104, estimate 0 to 10,000, a non-negative whole row position, dates in the window, end on or after start.
- **F-25:** the Jira search also reads `timespent` and `aggregatetimeoriginalestimate`. A leaf's progress is its own time spent over its own estimate; a parent with sub-tasks uses the aggregates.
- **F-28:** `reorderWbsTasks` returns `conflictResult` when any of its record writes lost a version race.
- **Proof:** R-21 (refused, also with one end; record unchanged), R-22 (refused; nothing sent to Jira), R-23 (a validation error, not a `TypeError`; a negative row position refused), R-24 (conflict). New `test/progress-source.test.ts` (parent and leaf). The `createInlineTask` test that sent an empty summary to Jira now uses a real summary, and a new test asserts an empty summary is refused before any Jira call. Unit suite 791 passed, coverage thresholds met; harness 30/30 and 25/25.

### N-10 and N-09. Visible link ports and a designed selected outline (owner reports)

- **N-10:** `.bar-hit` moves from `z-index: 20` to 32: above the canvas (30), below the frozen columns (36) and the sticky header (38). The hit layer is transparent and the canvas still draws the bars, so only the ports become visible. Ports: 24 x 24 px target, opacity 0.72 after a 0.15 s pause on hover and on the selected bar, solid under the pointer, no transition with `prefers-reduced-motion`.
- **N-09:** `canvas-timeline.ts` records the last input type (`pointerdown` or `keydown`). A focused bar gets a designed outline (2 px focus colour, 2 px outside, glow 6 px, no glow in forced colours); `drawFocusIfNeeded` (the system ring) runs only after keyboard input or in forced colours.
- **Proof:** `test/e2e/e2e_bar_ux_probe.py` now asserts: "PASS N-10 link ports visible above the canvas on hover" (port opacity 0.72, hit layer 32 over canvas 30). Screenshots `evidence/screenshots/harness/UX1-hover-ports-fixed.png` (both ports visible on hover) and `UX2-after-click-fixed.png` (blue outline, no black ring, ports shown). Harness 30/30, 25/25 and the F-11 check; unit suite 791 passed.
- **Remaining:** a contrast check of the outline in both themes, and an axe run (MK-07); a check that Tab focus still draws the ring.

### N-07. A sub-task shows its parent's epic and offers no epic picker

- **What changed:** the epic column of a sub-task row (`isSubtask` or hierarchy level -1) shows `.epic-inherited` read-only text instead of the `.epic-link-chip` picker. `updateWbsTask` refuses `epicKey` on a sub-task: "<key> is a sub-task; its epic comes from its parent work item."
- **Proof:** new test in `test/review/parent-move.test.ts` (refused, no Jira write). New `test/e2e/e2e_subtask_epic_probe.py`: sub-task rows (DEMO-30, DEMO-29, DEMO-28, DEMO-31) have no picker, standard rows keep it. Unit suite 792 passed; harness 30/30 and 25/25.

### BL-2 step 8. Plan management is offered only to plan approvers

- **What changed:** `legacy-planner.js` calls `checkPlanApprover` once after the first plan load (`loadPlanApprover`), disables the create-plan input and button for non-approvers with a title that says who creates plans, redraws the plan list, and adds the clone, rename and delete buttons only for approvers. Plan switching is unchanged.
- **Proof:** new `test/e2e/e2e_plan_approver_probe.py` with the harness switch `__harness_not_approver`: approver 1 action button and create enabled; non-approver 0 action buttons, create disabled, plan rows still listed. Harness 30/30 and 25/25; unit suite 792 passed.

### F-21 (with M2). Failures are logged and shown with their real cause

- **What changed:** new `src/logger.ts` (`logFailure(where, detail)`: "cascadeplan <where>: HTTP <status>" or the error name and code). All 14 empty `catch {}` blocks in `src/index.ts` log with their function name. `fetchRawIssues` returns `status` (0 for no answer) when the first page fails; `getProjectPlan` returns it as `jiraStatus`. The planner shows "You cannot browse this project in Jira, so CascadePlan cannot show its plan." for 401 and 403, "Jira is not reachable right now, so the plan cannot be shown. Click Retry in a moment." otherwise, and "A CascadePlan licence is required on this site. Ask your Jira administrator." for an inactive licence on load.
- **Proof:** new `test/failure-states.test.ts` (403 carried and logged as "cascadeplan fetchRawIssues: HTTP 403"; no answer is status 0; the log line holds no error message text). Unit suite 795 passed, coverage thresholds met; `forge lint` clean; harness 30/30 and 25/25.

### C10. Storage rate limits are retried, then reported plainly

- **What changed:** `withKvsRetry` wraps every call of the Forge storage provider (`get`, `set`, `delete`, each query page, `swap`). `isRateLimited` matches the code (`RATE_LIMIT_EXCEEDED`, `TOO_MANY_REQUESTS`) or status 429, not the error class. Waits 1, 2 and 4 s, then `StorageBusyError`, which `withValidation` turns into `{ ok: false, error: 'busy', message: 'CascadePlan is busy. Try again in a minute.' }`.
- **Proof:** new `test/kvs-retry.test.ts` (codes and status recognised; two failures then success with waits 1000 and 2000; four failures give up with the busy result after waits 1000, 2000, 4000; other errors not retried). Unit suite 799 passed, coverage thresholds met.
- **Remaining:** the quota itself (4,000 reads per minute per installation) is measured with F-17.

### F-17 (part). A batch builds one plan, not one per item

- **What changed:** `updateWbsTask` takes `options.skipResponse`; `batchUpdateTasks` passes it, so items return only their result and the batch builds one plan at the end.
- **Proof (R-29, 50 items, 200 tasks, 1 plan):** before: 151 prefix queries, 30,200 rows, 453 pages, 400 gets; after: 102 queries, 20,400 rows, 306 pages, 253 gets. Jira calls unchanged (54). Unit suite 799 passed.
- **Remaining:** the plan's target (at most 5 prefix queries for such a batch) needs one in-memory state for the whole batch, and the shared-date storage of DEC-3, which removes the scans of the other plans. Both come with the phase 3 storage work.

### DEC-3 development-site test (fix plan section 10, step 0)

- `test/live/property_check.py`, as the owner, on DEMO-37 and DEMO-38 (both created and deleted by the test, 2026-11-05).
- Results: property set as the user: 201. Read in `search/jql` with `properties=cascadeplan.dates`: returned only with `reconcileIssues` (the first run, without it, returned no properties for the new issue: the search lag is real, which also confirms F-03 part 3). Direct read: 200. After deleting the issue: 404.
- Not tested: the refusal for a Browse-only user (no second user; documented by Atlassian) and a move to another project (DEMO only).
- **Decision recorded:** DEC-3 Option C and DEC-4 Option B for v1, in ADR-008. Fix plan register updated.
- **Live site changes:** DEMO-37 and DEMO-38 created and deleted (about 13:3xZ on 2026-11-05).

### F-03 part 3. Reads after a write see the values just written

- **Live fact first:** a read-only search on DEMO showed that Jira refuses `reconcileIssues=10030,10029` (400, "Failed to convert 'reconcileIssues'") and accepts the repeated form `reconcileIssues=10030&reconcileIssues=10029` (200, 2 issues). The search uses the repeated form, built with `URLSearchParams` inside Forge's `route`.
- **What changed:** `fetchRawIssues` and `loadLive` take reconcile ids (numeric, at most 50). `getProjectPlan`, `updateWbsTask`, `continueCascade` and `batchUpdateTasks` accept `reconcileIds` (validated by `reconcileIdsOf`). Their results return `writtenIssueIds` (issues with a successful Jira write). `bridge.ts` keeps written ids for 60 s and sends them as `reconcileIds` with every call.
- **Proof:** new tests in `test/failure-states.test.ts` (the search URL holds the repeated parameter and no non-numeric id; invalid ids refused) and `test/frontend/bridge-cascade.test.ts` (an id written by one call is sent by the next). Unit suite 802 passed, coverage thresholds met; harness 30/30 and 25/25.

### Live check on development after F-03 part 3 (build tag `f0d45b9`, version 2.50.0)

- `live_move.py DEMO-29 7` then `-7`: 170 px before, after the answer and after the reload (which sends DEMO-29's id as `reconcileIds`), both ways; Changes panel "Written" both ways; restored to 2026-10-28 to 2026-11-10, Jira due date 2026-11-10. `forge logs` shows no `cascadeplan` failure line, so the search with the repeated `reconcileIssues` parameter is accepted by real Jira through Forge's `route`.
- **Live site changes:** DEMO-29's due date 2026-11-10 -> 2026-11-17 -> 2026-11-10 (this check).

### ADR-008 step 1. The shared start date is written to and read from the Jira issue property

- **What changed:** every issue search asks for `properties=cascadeplan.dates`. A task's start (and a planner-only end) comes from the property when it exists, else from the plan's own record (lazy migration: opening the planner writes nothing). Every date write that Jira accepts also sets the property as the user (`{startDate, endDate, v:1}`); a refused due date writes no property. Unscheduling a task removes the property (after the Edit issues check). The Changes panel lists a start date only when it changed.
- **Week moves:** the old week of a bar is now the week of its start date, because the date is the truth and the week is derived. A start outside the visible weeks has no week to shift from: the bar starts in the chosen week and keeps its length in days (found by the index test "preserves existing dependency when moving timeline bar", whose fixture holds an August start with an October week key).
- **Tests:** `write-transparency` (no unchanged start date listed), `plan-isolation` (unschedule writes only the property delete), `paging-retry-cascade` (the batch limit counts field writes; each moved issue also gets its property). Harness fake Jira stores, returns and deletes issue properties.
- **Proof:** unit suite 802 passed; tsc clean; harness `e2e.py` 30/30, `e2e_review.py` 25/25, undo probe (2026-11-16 -> 2026-11-23, Ctrl+Z back to 2026-11-16), F-11, N-10, N-07 and BL-2 step 8 probes pass. The harness results show the property writes.
- **Remaining (step 2):** remove `shareTaskDates`, make the unit test fakes return properties, rewrite R-01 and R-28.
