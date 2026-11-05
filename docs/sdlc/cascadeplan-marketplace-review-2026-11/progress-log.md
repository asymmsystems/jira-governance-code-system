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
- **Remaining:** the live check of the event payload (does `issue.fields.project.id` arrive?) after a development deploy; the log line says whether the project id was present. The quiet "N planned issues are not visible to you" note in the UI. Moved issues (BL-9 step 3, P3).
