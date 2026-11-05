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

### Live check on development after ADR-008 step 1 (build tag `74785ec`, version 2.51.0)

- `live_move.py DEMO-29 7`: 170 px after the reload, 2026-11-04 to 2026-11-17. New read-only `test/live/prop_read.py DEMO-29`: property `cascadeplan.dates` = `{startDate: 2026-11-04, endDate: 2026-11-17, v: 1}`, due date 2026-11-17. So real Jira accepts the property write as the user through Forge.
- `live_move.py DEMO-29 -7`: 170 px before, during, after the answer and after the reload; Changes panel "start date 2026-11-04 -> 2026-10-28 Written" and "due date 2026-11-17 -> 2026-11-10 Written". Property after: `{startDate: 2026-10-28, endDate: 2026-11-10, v: 1}`, due date 2026-11-10. The reload reads the start from the property.
- `forge logs -e development --since 20m`: no `cascadeplan` failure line.
- **Live site changes:** DEMO-29's due date 2026-11-10 -> 2026-11-17 -> 2026-11-10. DEMO-29 now holds the issue property `cascadeplan.dates` (start 2026-10-28, end 2026-11-10), the same dates it had in the plan record. It stays: it is the shared start date from now on.

### ADR-008 step 2. No copy of dates into every plan (F-10 R-01, R-28)

- **What changed:** `shareTaskDates` and its callers are removed. Every path that copied dates now writes the shared property instead: a move, a cascade, `continueCascade`, scheduling from the backlog, creating a task and creating a sub-task. Scheduling and creating write the start and the planner's default end to the property, never to the Jira due date (F-06 holds).
- **Unscheduling:** writes the property with no start (`{v: 1}`) instead of deleting it. A deleted property cannot be told apart from a task not yet migrated, so plans whose records still hold dates kept showing the task. The planner reads "a property without a start" as off the timeline. The write is listed in the Changes panel ("start date ... -> none").
- **Tests:** R-01 rewritten: two users move the same task in two plans; both plans show the last write, and the property and the due date agree. R-28 rewritten: one move costs the same KVS work for 1, 3 and 10 plans (3 queries, 600 rows, 7 gets, 1 swap; before: grew with each plan). Plan-isolation tests now check every plan through its rendered view (the fake Jira stores and returns properties), plus three new tests: a move writes no record of another plan; a property without a start takes a task off the timeline over an older record; a task with no property keeps its record's dates and nothing is written on read. Scheduling tests assert no due date and the exact property written.
- **Harness:** cross-plan checks 2d, 2j, R3b and R6b compare against the shared value the planner reads (property first, else the record). Two new on-screen checks: 2g2 (the Main Plan bar shows the Plan B move) and R6d (the Main Plan bar shows the cascade made in Plan B).
- **Proof:** unit suite 803 passed with coverage thresholds; tsc clean; harness `e2e.py` 31/31, `e2e_review.py` 26/26; undo, F-11, N-10, N-07 and BL-2 step 8 probes pass.
- **Docs:** spec v2 has no OPEN markers left: decisions are stated, with `[ADOPTED DEC-n]` on those adopted under the owner's instruction. Storage table lists `cascadeplan.dates`. ADR-008 status and implementation notes updated. Fix plan v4 register: the baseline design is ADR-009 (ADR-008 is taken).
- **Remaining:** R-29 (batch of 50) still makes 102 prefix queries: F-17 needs one in-memory state per batch.

### Live check on development after ADR-008 step 2 (build tag `cabc808`, version 2.52.0)

- `live_move.py DEMO-29 7` then `-7`: 170 px before, after the answer and after the reload, both ways. Changes panel both ways: "start date ... Written" and "due date ... Written". `prop_read.py DEMO-29` after each move: the property and the due date agree (2026-11-04 to 2026-11-17, then 2026-10-28 to 2026-11-10). `forge logs -e development --since 15m`: no `cascadeplan` failure line.
- Not checked live: the cross-plan read, which needs a move in a second plan on DEMO. The harness covers it (checks 2g2 and R6d).
- **Live site changes:** DEMO-29's due date 2026-11-10 -> 2026-11-17 -> 2026-11-10, and its property `cascadeplan.dates` the same way. Final state as before this check.

### F-22 (plan list and plan delete) and N-02. Versioned plan list; clone and delete in pages

- **What changed:** the plan list is stored as `{v, plans}`. Every change (create, rename, delete) re-reads the list, applies itself and writes with the swap-and-restore check, at most 3 tries; a list stored as a plain array reads as version 0. A clone is listed with `state: 'copying'` and copies at most 100 records per call (`createProjectPlan` runs the first page, `continuePlanCopy` the rest; copied records are skipped, so a page can run again). A delete marks `state: 'deleting'` and removes at most 100 records per call (`deleteProjectPlan`, then `continuePlanDelete`); the last page deletes the plan's settings, baselines, active-baseline pointer and scope-shift requests, then removes the plan from the list. A plan that is not ready opens as the Main Plan and refuses writes; a clone from it is refused. Both new resolvers need a plan approver.
- **Frontend:** clone, create-with-clone and delete loop until done, with a progress flag. The plan list hides plans being deleted and finishes stopped deletes in the background (approvers); a clone not yet finished shows "copy not finished", and picking it finishes the copy first. The keyboard path of a plan row now does what a click does.
- **Tests:** R-20 rewritten (no key of the deleted plan is left). New store tests: a 1,000-record plan is cloned in 10 pages of 100 and deleted in 10 pages of 100, the source untouched; two creates that read the same list both survive (version 2); a plain-array list is read and kept. New resolver tests: a copying plan opens as the Main Plan and refuses writes, `continuePlanCopy` finishes it with the dependency copied; a stopped delete is finished by `continuePlanDelete` with no key left; a clone of a plan being deleted is refused. View model test: deleting plans hidden, unfinished copy marked.
- **Proof:** unit suite 810 passed with coverage thresholds; tsc clean; bundle rebuilt. New harness probe `test/e2e/e2e_plan_pages_probe.py`: 258 Main Plan records cloned from the plan list in 3 calls (`createProjectPlan`, `continuePlanCopy` x2), the clone opens with 258 records; delete in 3 calls (`deleteProjectPlan`, `continuePlanDelete` x2), 0 keys left, the Main Plan shown. Harness `e2e.py` 31/31, `e2e_review.py` 26/26 and every probe pass.
- **Not done here:** a timing check on real KVS (the fix plan asks for each call under 10 s; the harness has no real KVS latency). The baseline keys still use the project key; moving them to the project id belongs to the baseline storage design (ADR-009, with F-16).

### Live check on development after F-22 and N-02 (build tag `167cb55`, version 2.53.0)

- New `test/live/live_plan_pages.py` on project DEMO: plans before "Main Plan", "Test Plan 1". Clone of the Main Plan from the plan list: one `createProjectPlan` call of 1,630 ms (the DEMO plan fits in one page), 2.7 s until "Main Plan (Copy)" opened with 15 rows and no "copy not finished" note. Delete of the clone: one `deleteProjectPlan` call of 1,415 ms, 3.2 s until the Main Plan was shown; plans after: "Main Plan", "Test Plan 1". So the plan list written before this change (no version) is read and kept by the new code on real KVS. `forge logs -e development --since 15m`: no `cascadeplan` failure line.
- Not measured live: a page of 100 records (DEMO has fewer records than one page).
- **Live site changes:** plan "Main Plan (Copy)" created in DEMO and deleted. The DEMO plan list is now stored in the versioned form.

### F-17 (rest). One read of each KVS key and prefix per batch

- **What changed:** new `src/storage/batch-storage.ts` (`BatchStorage`): a read-through cache over the storage provider for one `batchUpdateTasks` call. Each prefix query and each get reaches KVS once; later reads come from memory. Every write goes to KVS first and then updates the cache, so later items read the batch's own writes. `swap` always reaches KVS and returns the value KVS replaced, so the version check of each record still refuses a write made by anyone else during the batch. Values are copied in and out.
- **Proof:** R-29 rewritten to the fix plan target: a 50-item batch at 200 tasks now makes 1 prefix query (200 rows, 2 gets, 50 swaps); before this change 102 queries (20,400 rows, 253 gets), and 151 queries at the start of the fixes. New timing test: a 50-item batch at 1,000 scheduled tasks takes about 1 s in Jest (target under 10 s). New `test/storage/batch-storage.test.ts` (4 tests): repeated reads from memory, own writes and deletes read back and written to KVS, returned values cannot change the cache, and a write by someone else during the batch is refused with its value kept. Unit suite 815 passed with coverage thresholds; harness 31/31, 26/26, N-02 probe pass.
- **Not done:** the KVS quota measurement on development (fix plan section 10). The DEMO project has about 15 tasks, so a batch there cannot show the quota at scale.

### N-05 (block move) and DEC-6 (the parent's Jira due date follows its roll-up)

- **What changed (server):** new `src/domain/block-move.ts` (`planBlockMove`, `rollUpAfter`, `blockState`): the ADR-003 state rules as pure functions, also used by the client preview. New resolver `moveTaskGroup({taskId, days, expectedVersions})` (rule `issue-checked`). It refuses an epic (DEC-5b), a task without dated sub-tasks, a bad day count and more than 25 changing sub-tasks. Before any write it checks `EDIT_ISSUES` and `SCHEDULE_ISSUES` on every changing sub-task, then every record version (all or nothing). It writes each sub-task's record and its due date and start property; when Jira refuses one due date, the sub-tasks already moved are put back in KVS and in Jira. Then the successors outside the block are cascaded from the parent, each moved sub-task and the parent's ancestors (25 per call; the client continues as for any cascade). New helper `followParentDueDates` (DEC-6): when a planner action changes a parent's roll-up end, the parent's Jira due date is written to that end as the user; a parent the user may not edit or schedule keeps its due date and the write is listed "not written". It runs after `updateWbsTask` and `moveTaskGroup`, so undoing a block move (which replays each sub-task) also puts the parent's due date back.
- **What changed (client):** a task or story roll-up parent can be dragged (no resize handles), moved with Space and the arrow keys, and moved with the toolbar "earlier" and "later"; each calls `moveTaskGroup`. The drag and keyboard previews draw where each sub-task goes. A keyboard resize of a parent is refused with a message. Undo label: "Moved DEMO-26 with its sub-tasks". The bundle is rebuilt.
- **Tests:** new `test/block-move.test.ts` (8 tests: the ADR-003 example; in-progress ends never before today; a 7-day block move with done and undated sub-tasks fixed, the parent due date following and the successor cascaded; all or nothing on a missing permission and on a refused due date; a stale version; refusals of an epic, a task without sub-tasks and bad input; a direct date write to a parent still refused). DEC-6 tests in `test/write-transparency.test.ts` (the parent write listed with its old value; a parent without permission keeps its due date while the sub-task move stands); the old test "moving a sub-task writes nothing to its parent issue" now asserts the DEC-6 write. Undo tests: the label, and a block move undoes as sub-task dates only.
- **Proof:** unit suite 825 passed with coverage thresholds; tsc clean. New harness probe `test/e2e/e2e_block_move_probe.py`: dragging DEMO-26 one week moves DEMO-28 (2026-11-09 -> 2026-11-16) and DEMO-31 (2026-11-14 -> 2026-11-21), the parent bar 2026-11-09..18 -> 2026-11-16..25, due dates written for DEMO-26, DEMO-28 and DEMO-31, the Changes panel lists them, and one Ctrl+Z restores both sub-tasks. Harness 31/31, 26/26 and every probe pass.
- **Remaining (N-05, N-06):** a cascade into another roll-up parent is reported "not moved: move its block" instead of moving that block (ADR-003 section 3, N-06 rule 2). Blocks of more than 25 changing sub-tasks are refused instead of continuing in later calls. Multi-select with a parent and its sub-tasks (each issue once). The enforce-dependencies snap and the conflict dialog for a block (N-06 rule 5: the parent's links apply to each sub-task). The drag preview strip text still describes only the parent.

### Live check on development after N-05 (build tag `84e22f6`, version 2.54.0), and the Undo fix it found

- The first `forge build -t 84e22f6` failed with no message, and the deploy reported that build tag missing. The same build run again succeeded with no change; deployed as 2.54.0.
- New `test/live/live_block_move.py DEMO-23` (DEMO-23 is a Task with not-started sub-tasks DEMO-29, DEMO-30, DEMO-31). Drag of the DEMO-23 bar one week: bar 2026-09-30..12-15 -> 2026-10-07..12-22. Changes panel, all "Written": DEMO-23 due date 2026-11-17 -> 2026-12-22 (DEC-6); DEMO-29, DEMO-30 and DEMO-31 start date and due date each +7 days; and DEMO-16 start 2026-11-19 -> 2026-12-23, due 2026-12-07 -> 2027-01-10. DEMO-16 depends on DEMO-23 and already started before DEMO-23's roll-up end, so the cascade moved it after the new end.
- **Two defects found:**
  1. The flag said "Changed DEMO-23": the label for a block move was added after the bundle was built, so the committed `app.js` was stale. Fixed: the bundle is rebuilt; it now holds the label.
  2. Undo restored DEMO-23 and its sub-tasks exactly, but not DEMO-16: it ended at 2026-12-16..2027-01-03. Undo replays each changed task through `updateWbsTask`, and each replay cascaded again, so a successor whose old dates broke a link could not get them back. This is not specific to block moves. Fixed: Undo and Redo send `restore: true`; `updateWbsTask` then writes the exact dates with no cascade and no dependency snap. New tests run the live order both ways: without `restore` the successor is cascaded again, with it the exact old dates come back.
- **Live site changes and restore:** DEMO-23, DEMO-29, DEMO-30, DEMO-31 moved and put back by Undo (Jira due dates as before: 2026-11-10, 2026-10-20, 2026-12-15; DEMO-30 and DEMO-31 now hold the `cascadeplan.dates` property with their old dates). DEC-6 left DEMO-23's due date at its roll-up end 2026-12-15 after the Undo; the script set it back to 2026-11-17 (204). DEMO-16 was set back by hand in Jira: due date 2026-12-07 (204) and property `{startDate: 2026-11-19, endDate: 2026-12-07, v: 1}` (200); read back the same. DEMO-16's Main Plan record still holds the cascaded dates, but the property, which the planner reads first, holds the original ones.
- **Proof of the fix:** unit suite 828 passed with coverage thresholds; harness 31/31, 26/26, undo probe and N-05 probe pass. Not yet checked live (next deploy).

### Live check on development after the Undo fix (build tag `e3371b6`, version 2.55.0)

- `live_block_move.py DEMO-23` again: the move gave the same writes as before (DEMO-16 cascaded to 2026-12-23..2027-01-10). Flag: "Moved DEMO-23 with its sub-tasks (4 issues changed)". After one Undo: the DEMO-23 bar 2026-09-30..12-15, sub-task due dates as before, and DEMO-16 back to start 2026-11-19 and due 2026-12-07 by the Undo itself (`prop_read.py DEMO-16`). DEC-6 again left DEMO-23 at its roll-up end 2026-12-15; the script set it back to 2026-11-17 (204). `forge logs -e development --since 20m`: no `cascadeplan` failure line.
- **Live site changes:** the same issues moved and put back; final Jira due dates DEMO-23 2026-11-17, DEMO-29 2026-11-10, DEMO-30 2026-10-20, DEMO-31 2026-12-15, DEMO-16 2026-12-07.

### N-06 rule 2. A cascade into a parent moves its block

- **What changed:** new `expandParentCascades` in `src/index.ts`. When a cascade reaches a task or story roll-up parent, the parent's sub-tasks move by the block rules of ADR-003 (not started moves, in progress keeps its start, done stays); the parent has no record of its own to write. A cascade into an epic is reported "not moved: it is an epic; move its work items" (DEC-5b). The task the user moved is never changed by the expansion. Used by `updateWbsTask`, `continueCascade` and `moveTaskGroup` (which reported such parents "not moved" before). With DEC-6, the cascaded parent's Jira due date follows its new roll-up end.
- **Tests:** PM-02 (a GAP test) rewritten as a regression test: a predecessor moved 7 days later moves the parent's sub-task 7 days, the parent bar follows, its link is no longer violated, and its Jira due date equals its new end. New unit tests of the expansion: a parent change becomes its block (a done sub-task stays), leaf changes are kept, epics are returned unmoved, an excluded key is never changed.
- **Proof:** unit suite 830 passed with coverage thresholds; tsc clean; harness `e2e.py` 31/31, `e2e_review.py` 26/26, N-05 probe and undo probe pass. Not checked live: it needs a link from another issue into a parent on DEMO, and none was set up for this check.

### N-06 rules 5 and 6 (client checks). A parent's links bind its sub-tasks; a link from a descendant does not bind its ancestor

- **What changed:** `checkDependencyConflict` (`src/ui/dependency-edit.ts`) now also checks the incoming links of every ancestor of the moved task (rule 5), ignores a link whose predecessor is the task itself or one of its descendants (rule 6), and returns the latest earliest day over all blocking links (before: the first conflict found), with `viaParent` naming the ancestor whose link blocks. So the enforce snap and the conflict dialog of a single sub-task move respect the parent's links. A block move (`moveBlock`) checks each moving not-started sub-task the same way: with "Enforce dependencies" on, the whole block moves only as far as every link allows; with it off, the move is made and a flag names the sub-task that now starts too early.
- **Why not in the server engine:** adding the parent's links to each sub-task in `engineInputs` would make a cascade move the violating sub-tasks one by one, which contradicts ADR-003 section 3 (a cascade into a parent moves its block, done in N-06 rule 2). The rule is therefore applied where a single move is checked.
- **Tests:** new tests in `test/ui/dependency-edit.test.ts`: a parent's link binds its sub-task and a sub-sub-task, the latest earliest day wins, and a link from a task's own sub-task does not bind it. Unit suite 832 passed with coverage thresholds; bundle rebuilt; harness `e2e.py` 31/31, `e2e_review.py` 26/26, N-05 probe pass.
- **Remaining:** the server-side refusal of a link between an issue and its own ancestor or descendant when it is created (rule 6 in `validateDependency` was done earlier; links imported from Jira are not yet marked "ignored by the schedule" on screen).

### N-05 multi-select. A selected parent moves as a block; each issue moves once

- **What changed:** new `selectedBlockParents` in `src/ui/selection.ts`; `moveSelectionBy` leaves out a selected sub-task whose ancestor is a selected task or story parent. "Move by days" in the selection bar moves the leaves in one `batchUpdateTasks` call, then each selected parent with `moveTaskGroup` (enforce and conflict rules of the block move apply).
- **Proof:** new unit tests in `test/ui/selection.test.ts` (a selected parent and its selected sub-task: the sub-task is not in the leaf batch; an epic is not a block; a sub-task without its parent selected moves on its own). New harness probe `test/e2e/e2e_select_block_probe.py`: DEMO-26 and DEMO-28 selected with Ctrl+click and moved 7 days; DEMO-28 2026-11-09 -> 2026-11-16 and DEMO-31 2026-11-14 -> 2026-11-21 (7 days each, not 14). Unit suite 834 passed with coverage thresholds; bundle rebuilt.
- **Remaining:** a selection move with parents gives one Undo step per call (the leaf batch, then each block), not one for the whole selection.
