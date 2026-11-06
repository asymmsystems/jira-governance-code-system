# CascadePlan merge review, round 2: feature/cascadeplan-marketplace-fixes

- Date: 2026-11-06
- Reviewer: independent review session, round 2 (not the session that wrote the fixes, and not the round 1 reviewer's clone)
- Branch: `feature/cascadeplan-marketplace-fixes` at `e9e85e8` (reviewed at `3f6828a`; `e9e85e8` changes only `docs/marketplace/submission/owner-partner-setup-guide.md`, 12 lines, no dashes)
- `master`: `907ccd7`, which is the merge base, so the merge has no conflict
- Clone: `/home/fahimfarookme/Documents/projects/jira-governance/.tmp/cache/merge-review/cascadeplan-r2/checkout`
- Brief: `docs/sdlc/cascadeplan-marketplace-review-2026-11/merge-review-prompt.md`
- Round 1 report (used as a checklist only): `/home/fahimfarookme/Documents/projects/jira-governance/.tmp/cache/merge-review/cascadeplan/cascadeplan-merge-review.md`

## Verdict: Merge

No Critical or High finding remains. The two round 1 High findings (H1, H2) and the two Medium findings (M1, M2) are fixed in the code. Each fix has a test that fails without it. The fixes add no new Critical or High problem. One Medium finding (M-1, Apps CI red for the other three apps once Forge lint runs) and three open Low findings are listed below. None of them blocks the merge.

No live check was run in this round. Nothing was deployed. No live site was changed.

## Round 1 findings: status

| Round 1 | Fix commit | Status | Evidence |
|---|---|---|---|
| H1 approver policy `setByPartyId` not reported or erased | `cf13df5`, `9365298` | Fixed | `src/storage/personal-data.ts` lines 35 and 53: the job scans `cp:`, `cascadeplan:`, `planshift:`, `scheduleMap:`, `ps:` and treats `setByPartyId` as an id field. A GROUP party's `partyId` is skipped (line 120). `policy-admin.ts` line 188 no longer stores `unknown`. The listing, questionnaire, submission notes, console checklist, admin guide, site index and spec INV-04 now name the approver policy's saver. Mutation: removing `setByPartyId` from `ID_FIELDS` fails 4 tests in `test/personal-data.test.ts`. |
| H2 drop preview misses cascade writes | `c4a2d44`, `9365298` | Fixed | `src/domain/drop-plan.ts` holds the cascade (`singleMoveCascade`, `cascadeFromRoots`, `parentDueDateTargets`). `updateWbsTask`, `cascadeAndApply` and `followParentDueDates` (`src/server/tasks.ts` lines 423, 921, 946) and the planner (`dropPreview`, `legacy-planner.js` line 344) call it. Harness: `e2e_drop_preview_probe.py` PASS at head. The same probe on the code before the fix (`c4a2d44^`) FAILS: for the sub-task drag the preview listed only DEMO-28, and the drop also wrote DEMO-26. Mutations: no parent due date in the preview fails 3 parity tests; dropping the block expansion from the single-move preview fails 1. |
| M1 baseline items to users without Browse | `7551e2f` | Fixed | `visibleItems` (`src/server/baselines.ts` line 49) keeps items in the caller's live read and checks the rest with Jira's bulk permission check as the user (`BROWSE_PROJECTS`); it fails closed. Used by `baselineStatusFor`, `getScopeCreepReport`, `compareBaselines` and `exportBaseline`. Mutations: no filter fails 3 of 4 tests in `test/baseline-visibility.test.ts`; fail open fails 1. |
| M2 weekly report could time out | `cf13df5` | Fixed | Hourly trigger, `timeoutSeconds: 900` (manifest), 600 s budget, progress in `cppd:state`, found ids in `cppd:f:<id>`, lease through the atomic KVS swap (`ForgeKvsProvider.swap`, `returnValue: 'PREVIOUS'`). Mutations: no budget fails 1 test; reported ids not removed from the list fails 2; no 7-day wait fails 2; no race check on the swap fails 1. |
| L1 Undo text, preview position | `9365298` | Fixed | Listing line 37, user guide and submission notes now say the Undo message stays until closed; user guide says the line is above the moved row. |
| L2 copyright headers | `93ebd92` | Fixed | All 13 files have the header. New files of this round have it too. |
| L3 spec INV-04 | `9365298` | Fixed | INV-04, INV-03, D-19, manifest excerpt and storage and resolver tables match the code. |
| L4 CI does not run forge lint | owner added the secrets | Closed for CascadePlan | See L-4 and M-1 below. |
| L5 server parent-link rule | `ebb490a`, `9365298` | Fixed | `refuseDependencyConflict` (`tasks.ts` line 397) uses the planner's own `checkDependencyConflict`; called in `updateWbsTask` (line 386) after all date derivation and before any write, and in `moveTaskGroup` (`block-moves.ts` line 66) for each not-started moving sub-task, as the planner's `blockConflict` does. Mutation: a no-op check fails 2 of 4 tests in `test/review/parent-links-server.test.ts`. |

Also: run against the parent commit's `src`, the new suites of `7551e2f` and `ebb490a` do not compile (the functions do not exist), and `cf13df5`'s three suites fail. The mutations above are the stronger proof, so they were also run.

## Regressions checked

- **Forge limits of the hourly trigger.** The Forge scheduled trigger reference (read 2026-11-06) gives the intervals `fiveMinute`, `hour`, `day`, `week`; a default timeout of 55 s; `timeoutSeconds` from 1 to 900; "a small chance of duplicated invocations"; no retry after an error; up to five scheduled triggers per app. The manifest matches. `forge lint`: "No issues found". A run with nothing due reads one key and returns (`status: 'waiting'`, no log line).
- **Duplicate runs.** The first run takes the lease with an atomic swap; a second run that sees a live lease in the swap's previous value restores it and stops. The lease (960 s) is longer than the timeout (900 s) and much shorter than the interval (3600 s).
- **Report at most once in 7 days.** A new cycle starts only 7 days after the last report of the previous cycle (line 188). Inside a cycle each reported id is deleted from `cppd:f:` right after the call, so a restarted page does not report it again. See L-2 for the one edge case.
- **Erasure and the baseline digest.** `digestOf` (`baseline-store.ts` line 47) does not cover `frozenBy`, so nulling audit fields keeps `intact`. `eraseClosedAccounts` removes the id from `cp:pd:accounts`.
- **`enforceDependencies` on the server.** The flag is validated as a boolean, skipped on Undo (`restore`), and checked only when the start changes. The planner and the server use the same function, the same task list (`plan.tasks`) and the same "today" (the request scope takes the client's local date, `core.ts` line 262). So a move the planner snapped is accepted by the server. A block that moves earlier with a link between two of its own sub-tasks is refused on both sides in the same way (both check against the current dates); this is the planner's existing rule, not a new one.
- **Preview code path.** `previewMoves` lost its `try`/`catch`, but `cascade` returns a cycle and does not throw (`schedule-engine.ts` line 177), so a cyclic plan does not break a drag.
- **Browser harness at head** (strict CSP build): `e2e.py` 31/31, `e2e_review.py` 26/26, `e2e_csp_probe.py` 17 states and 0 violations, and PASS for the drop preview, block move, BL-3 no unrequested write, links, multi-select block, and progress and status probes; the undo probe restores the start.

## Findings

### Critical

None.

### High

None.

### Medium

- **M-1. Apps CI is red on the branch head, and will be red on `master` after the merge, for the three other apps only.** The owner added the `FORGE_EMAIL` and `FORGE_API_TOKEN` secrets on 2026-11-06, so the Forge lint step now runs. Run 42192775137 (workflow_dispatch on `e9e85e8`): `app (cascadeplan)` success, its Forge lint step included; `app (definitionguard)`, `app (ledgerseal)` and `app (fourrealities)` fail in the Forge lint step only, each with "0 errors, 0 warnings, 1 approval": "This deployment triggers a major version upgrade in the default environment because: Change due to scope modification" (`MAJOR_VERSION_RULE`). This branch does not change those apps' manifests (`git diff 907ccd7 e9e85e8 -- apps/*/manifest.yml` lists only CascadePlan). The notice compares each manifest with the version deployed to the development environment, which other fix branches deployed. The branch brings `.github/workflows/apps-ci.yml` to `master` (it is new there), so `master` will show the same three red jobs until the other apps' fix branches merge or the step accepts an "approval" notice. It is not a defect of CascadePlan code, and it does not change any public claim, so it does not block this merge. Fix options: merge the other apps' branches (their manifests then match development), or make the CI step fail only on errors and warnings.

### Low

- **L-1. The erase pass can overwrite a concurrent plan edit.** `src/storage/personal-data.ts` lines 280 to 288: the erase pass reads a page, then writes each changed record with a plain `storage.set` and `version + 1`. If a user saves the same record between that read and that write, the user's change is lost, and the version matches the one the user wrote, so nothing detects it. This needs a closed account and an edit of the same record within the same moment, so it is rare. Fix: write with the swap and compare the previous version, or retry the page on a mismatch.
- **L-2. A failed report request blocks the job until it succeeds, and can repeat a report.** Lines 258 to 267: if the reporting call fails, the run stops and every later hourly run retries the same page. A request that Atlassian always refuses (for example an id it does not accept) stops all later reporting and erasure, with only a log line. If the call succeeds but a following `storage.delete` fails, the ids of that page are sent again in the same cycle. Both are edge cases. Suggest an alert or a count of failed runs in the state, and a split of a refused page.
- **L-3. M1 fix not confirmed live against issue security.** The live check ran only as an admin who can see every issue (fix log M1). The test uses a fake checker. Whether Jira's bulk permission check with `BROWSE_PROJECTS` on issue ids honours issue security levels was not confirmed in this round. The code fails closed when the check errors.
- **L-4 (round 1 L4): closed.** The owner added the secrets; in run 42192775137 the CascadePlan Forge lint step passed. `forge lint` also passed locally: "No issues found". (See M-1 for the other apps.)

## Gate

Clean clone at `3f6828a` (the code of `e9e85e8` is the same), host Node 26.13.0 and npm 11.20.0 (CI uses Node 22), CI install order:

| Step | Result |
|---|---|
| `npm ci` in `packages/asymm-jira-ui`, the app, `tools` | exit 0 each; `node_modules/@asymm/jira-ui/dist/index.js` exists |
| `npm audit --omit=dev --audit-level=high` | exit 0; 7 moderate, 0 high, 0 critical |
| `npx tsc --noEmit` | exit 0 |
| `npm test -- --coverage` | 84 suites, 977 tests passed; statements 96.88%, branches 90.9%, functions 94.48%, lines 98.54% |
| `npm run build`, `npm run build:ui` | exit 0; committed bundle unchanged |
| `forge lint` | No issues found |
| `git status --porcelain` | empty (also after the harness) |
| Apps CI | success on every push of the fix commits (`ebb490a` run 42150226642, `3f6828a` run 42151669865) and on a manual run on `e9e85e8` without Forge secrets (run 42153002533, all four apps). With the new secrets (run 42192775137 on `e9e85e8`): CascadePlan success including Forge lint; the other three apps fail in Forge lint only (M-1) |

Gate on the merge result (merge commit on `master`, same clone): `npm ci` x3 exit 0, audit exit 0 (7 moderate), `tsc` exit 0, 84 suites and 977 tests passed, `build` and `build:ui` exit 0 with the committed bundle unchanged, `forge lint` "No issues found" (the first try timed out on the network after 300 s; the rerun passed), `git status` empty.

## Fix-log entries that could not be confirmed

- The live checks of the 2026-11-06 entries (development 3.16.0 on PAY: drop preview, baseline visibility, the first hourly run of the personal data job). Live checks are optional and were not needed for the verdict, so none was run.
- M1 against a user without Browse on an issue (L-3); the fix log says so too.
- The asymm-corporate site commit `a43b01d` (guide and `/privacy`) is in another repository and was not reviewed.
