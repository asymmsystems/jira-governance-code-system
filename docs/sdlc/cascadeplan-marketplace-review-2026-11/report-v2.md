# CascadePlan: review and Marketplace readiness verdict

- **Version:** v2, 2026-11-05. The first version, `report.md`, is frozen (read-only, md5 `187b128ad4d586b2d5b55a0d1f26a73f`). v2 applies the corrections from the independent review of the fix plan (`/home/fahimfarookme/Documents/projects/jira-governance/.tmp/cache/cascadeplan-fixplan-review/fixplan-review.md`, section 6). Changes from v1:
  - BL-7: the claim that the registered app name is shown on install and consent screens is marked as not verified.
  - Section 5, "Rate": the KVS per-minute quota is added as a limit that may bind before the 25 s runtime.
  - The review of the fix plan also found a wrong line reference: `src/index.ts:1907` for `cascadeRemaining: []`. The correct line is `:1900`. That reference is in `frontend-review.md` (M5 and section 3), not in this report. `frontend-review.md` is kept unchanged as evidence.
- **Reviewer:** independent review session, 2026-11-05.
- **Review commit:** `db080096007208d2cad97f79c620d49964aa05c9` (`master` HEAD at start).
- **Scope:** `apps/cascadeplan`, its specification, research folder, listing, submission notes, public guide pages and standards.
- **Evidence files** (all in `/home/fahimfarookme/Documents/projects/jira-governance/.tmp/cache/cascadeplan-marketplace-review/`):
  - `test-log.md`: every command and its result.
  - `review-tests/review-findings.test.ts` and `review-findings.result.log`: 32 review tests (tests R-01 to R-31).
  - `harness/`: browser harness, `e2e_review.py`, screenshots in `harness/results-review/`.
  - `live/`: live scripts, JSON results and screenshots in `live/shots/`.
  - `frontend-review.md`: full line-by-line read of the frontend (findings H1 to H9 and others). I re-checked H1, H5, H6, H7 and H8 against the code myself.
  - `marketplace-research.md`: current Atlassian requirements with source URLs (fetched 2026-11-05) and URL status checks.
- File references are relative to `apps/cascadeplan/` unless they start with `docs/` or `site/`.

---

## 1. Verdict

**Not ready.**

The code base is well tested where it is tested (726 unit tests pass, coverage above 90%), and plan isolation (D1), optimistic locking within one plan (D6) and the XSS rule (INV-01) hold. But four groups of problems block submission:

1. **The public material describes a different product.** The guide pages, reviewer notes and admin page describe baseline freezing, scope-creep alerts, scope-shift approval, signed PDF export, "cryptographic snapshots" and an "immutable audit trail". None of these has any UI, and most have no code at all. Atlassian rejects apps that do not perform as described.
2. **The governance actions have no server-side permission check.** Any user who can open the project page can approve their own scope shift, delete plans, and change the shared dates of issues they cannot edit in Jira.
3. **The app writes values to Jira that the user did not choose,** although the listing promises it never does. After a drag the screen shows the wrong dates (the owner's "shorter bar" observation; cause found and reproduced live). The Undo entry is built from that wrong state, and Redo then writes a due date the user never chose. There are also default spans and estimates, and status transitions caused by a progress edit.
4. **The Marketplace basics are missing.**
   - The Terms and Support URLs return 404.
   - The privacy policy does not cover the app.
   - The documentation site does not resolve.
   - Personal data reporting is not implemented.
   - The registered app name and the banner say "PlanShift".
   - The media sizes are wrong.
   - The build cannot be reproduced or deployed from a clean clone.

Also, the live test was done on the build the owner deployed at 13:15 today, because my own deploy failed. See sections 7.4 and 11.

---

## 2. Blockers

Each blocker links to the findings (section 4) that carry the full evidence.

| ID | Blocker | Evidence | Proposed fix |
|---|---|---|---|
| BL-1 | **Public pages and reviewer notes describe features the app does not have.** Missing: the baseline freeze button, the baseline status bar, the scope delta, the scope-shift request and approval UI, baseline versions `v1.1`, the "Baseline Comparison View", JSON/CSV/PDF export, "SHA-256 baseline hashes", "cryptographic snapshot", "immutable audit trail", "Project Settings > CascadePlan > Baseline Settings / Resource Settings", the workflow validator, and working-days settings. | F-02; section 9. `grep` finds 0 UI callers of `freezePlanBaseline`, `getPlanBaselines`, `getScopeCreepReport`, `requestScopeShift`, `reviewScopeShift` (test-log #36). There is 0 crypto code (#37). The live toolbar has none of these controls (`live/shots/L1-planner-loaded.png`). The "Baselines" tab only groups plans whose name contains "baseline", "main" or "actual" (`src/ui/plan-manager.ts:20-24`). | Choose one product story. Either rewrite `site/apps/cascadeplan/*.md`, the submission notes test plan (steps 2 to 5) and the admin page text to describe the planner that exists, or build the baseline features first. Remove every crypto, PDF, export and "immutable" claim unless it is built. |
| BL-2 | **Governance and plan actions have no server-side authorization.** | F-01. R-16: `reviewScopeShift` approves with no approver check, lets the requester approve their own request, and stores any status string. R-11: a user whose Jira PUT returns 403 still changes the shared dates in every plan. `deleteProjectPlan`, `renameProjectPlan`, `createProjectPlan` and `freezePlanBaseline` check nothing (`src/index.ts:2340-2393, 2455`). The live admin page promises "only Jira administrators and project administrators can freeze delivery baseline, approve milestone variance, and manage plans" (`live/L5-L6-admin-name.json`). | Before any KVS write: (a) check `EDIT_ISSUES` (or `SCHEDULE_ISSUES`) on the issue or project as the user (`/rest/api/3/mypermissions`) for task writes; (b) call `isPlanApprover` (Tier 1 with the issue id or project id, not the project key, see F-24) for baseline, shift review and plan delete; (c) refuse self-approval; (d) validate `status`. Fail closed, as the permission standard requires (`docs/design/uniform-permission-management-standard.md` sections 1 and 4). |
| BL-3 | **Values the user did not enter are written to Jira**, against the listing ("never writes values to Jira that you did not enter") and INV-03. | F-03 (stale response; Redo writes a wrong due date; harness R2b; live L2/L3). F-06 (spanWeeks 3 gives a due date the user never chose; a default 20 h estimate; progress 100 or 1-99 triggers a Jira status transition; R-10, R-13, frontend H1 to H3). | See F-03 and F-06. |
| BL-4 | **Legal, support and documentation URLs are broken or wrong.** | `marketplace-research.md` Section B: `https://asymm.systems/terms` 404, `https://asymm.systems/support` 404 (also `/contact`), `docs.asymm.systems` does not resolve (every link and image in `site/apps/cascadeplan/*.md`). `https://asymm.systems/privacy` is live but covers only waitlist and website data. Partner Agreement 8.4(e) requires app data processing, sharing, storage country and responsibility (research A.d D2). | Publish terms (or select Atlassian's standard end-user agreement in the version Links tab), a support page with contact and SLA, an app privacy policy, and the docs site; then recheck every URL. |
| BL-5 | **Personal data reporting is not implemented**, while the app stores Atlassian account ids (contributors, `frozenBy`, `requestedBy`, `reviewedBy`, `setByPartyId`) and display names (baseline snapshots). | F-09. `manifest.yml` has no scheduled trigger and the code makes no `report-accounts` call. Atlassian: "you are required to periodically report the user personal data that your apps are storing. You must report each accountId" (https://developer.atlassian.com/platform/forge/user-privacy-guidelines/, research A.d D4, D7). | Either store no personal data (resolve people live, which Atlassian recommends, D5), or add a weekly scheduled trigger that reports the stored account ids and erases closed accounts. Remove display names from baselines. |
| BL-6 | **Listing badge and compliance claims are not true.** | Section 9. "Cloud Fortified": Atlassian takes no new submissions and ends the program in 2026. "100% Data Residency Compliant": not an Atlassian badge. "Runs on Atlassian" is assigned by Atlassian, not claimed, and `forge eligibility` was not run. "Inherits SOC 2, ISO 27001, and GDPR compliance natively": Atlassian says Forge covers only up to 20% of ISO 27001 and 30% of SOC 2 (research A.b). | Remove these badges and the compliance sentence. Run `forge eligibility`. |
| BL-7 | **App name and media.** | The CLI shows "Deploying **PlanShift** to development" (test-log #21). `banner.png` and screenshot 05 show "PlanShift" (research D). The banner is 2280x1140 (rule 1120x548 or 560x274). Screenshots are 1840x1150 (rule 1840x900). The three 580x330 highlight images and the captions are missing. Two screenshots show "DEV" badges. | Rename the app to CascadePlan in the Developer Console. Then check which name the install, consent and Connected apps screens show. The Atlassian documentation does not say which name these screens use. Only community reports say that they show the registered name, and that a production consent screen kept the old name until developer support changed it. Remake the banner, the screenshots (inside Jira, no DEV badge) and the highlights at the required sizes. |
| BL-8 | **The build cannot be reproduced or deployed from a clean clone.** | F-14. No `package-lock.json` in `apps/cascadeplan` (`npm ci` fails, test-log #3). `forge deploy` from a clean clone fails on `@asymm/jira-ui`, which is resolved only through tsconfig `paths` (test-log #21 to #23). The committed `app.js` was built against `../ledgerseal/node_modules` (test-log #10). | Commit a lock file. Make `@asymm/jira-ui` a real dependency (`"@asymm/jira-ui": "file:../../packages/asymm-jira-ui"` with built JS, or a Forge-supported alias). Rebuild `app.js` from the app's own `node_modules`. Add a CI job: clean clone, `npm ci`, test, build, `forge lint`, `forge deploy --dry-run` or equivalent. |
| BL-9 | **Opening the planner can delete other users' planning data.** | F-05. `pruneStaleEntries` runs on every load without confirmation (`src/frontend/legacy-planner.js:1672-1674`). It deletes a record when Jira answers 404 as the current user (`src/index.ts:1848-1855`). Jira also answers 404 when the user has no permission to see the issue. R-18. | Never delete on a user-scoped 404. Confirm deletion with an app-scoped read (`asApp`, read only) or a changelog/audit check, or only mark the record stale and let an admin purge it. |

The Section 6 items that are "Fail" or "Not run" (section 8) also block a "Ready" verdict.

---

## 3. Decisions table

| ID | Decision | Implemented | Evidence | Sound | Trade-off and comment |
|---|---|---|---|---|---|
| D1 | Every resolver reads and writes only the plan named by `planId`; a write to a deleted plan is refused; an unknown plan reads the Main Plan. | **Mostly yes.** | `writablePlanId` `src/index.ts:394-402`; `getProjectPlan` fallback `:880-883`; `test/plan-isolation.test.ts` (all pass); harness 1c/1d. Exceptions: `createInlineTask` creates the Jira issue before the plan check (R-14, `:1122` vs `:1174`). Baseline and scope resolvers use `payload.planId \|\| 'default'` without `writablePlanId` (`:2462, 2480, 2496, 2522, 2549`), so a baseline can be stored under a deleted plan id. | Yes | The fallback on read hides a deleted plan instead of failing, and the UI tells the user which plan it got. This is reasonable. |
| D2 | Jira is the single source of truth for a task; every field edit goes to Jira from any plan. | **Yes for the edit itself, but** the response after the write uses the Jira data read before the write (F-03). Status is reported as written when no transition happened (F-08). | Plan-isolation test "every field edit in a scenario plan syncs to Jira"; R-08, R-09, R-30. | Yes | Sound, and simpler than per-plan Jira state. It only works if every read after a write is fresh, which it is not today. |
| D3 | One set of dates per task: a date change in any plan writes the Jira due date and copies the dates to every other plan; each load ends a scheduled bar on the Jira due date; the shared start lives in KVS. | **Yes**, with defects. | `SHARED_DATE_FIELDS` and `shareTaskDates` `src/index.ts:329-387`; `mapLiveIssues` `:776-785`; harness 2d, 2j, 2k, 2l, R3, R6 pass. | **Partly.** | One date set per task removes the "which plan is right" question, and Jira stays authoritative for the end. The cost: (a) the end can come from Jira while the start comes from KVS, so any time the two differ the bar is a shape nobody drew (F-03, F-19); (b) copying is not atomic: two users moving the same task in two plans end with each plan holding the other user's dates (R-01, F-10); (c) a Jira due-date change does not cascade on read, so a successor can silently violate its link until someone moves something; (d) unscheduling leaves the Jira due date; acceptable, but the UI should say so; (e) each date write reads every other plan in full, so the KVS cost grows with plans times issues (R-28: 3 queries at 1 plan, 12 at 10 plans, each a full prefix scan); (f) links and contributors stay per plan while the dates they drive are shared, so a cascade in Plan B moves dates in the Main Plan for a reason the Main Plan does not show (harness R6). See section 6 for the edge-case verdicts. |
| D4 | The open plan is saved per project in `localStorage` key `cp_active_plan_<cloudId>:<projectKey>`. | **Yes.** | `src/ui/plan-view-state.ts`; `legacy-planner.js:133-149`; harness 1a, 1b, 1c, 1d; every access is wrapped in try/catch (frontend review item 5). | Yes | A per-browser choice. A user on two machines sees different default plans, which is fine for a view preference. |
| D5 | Collapsed parents stay collapsed across renders and hide all descendants; the toggle appears only when a row has child rows in view. | **Yes**, within a session. | `visibleRows`, `isHiddenByCollapse` `src/ui/plan-view-state.ts:99-125`; harness 4a to 4g, R5a, R5c, R5d. Not kept across a reload, and across a plan switch only for parents present in both plans (frontend review item 7). | Yes | Session-only state is acceptable. Persisting it per plan would be a small addition. |
| D6 | Optimistic concurrency: each record has a `version`; a stale write is refused and the client refreshes. | **Yes within one plan for one record.** | `putEntry` `src/storage/plan-store.ts:111-135`; R-03; harness R7a to R7d. Gaps: the restore step can overwrite a third writer (R-02); Jira writes run before the check (R-04 to R-06); 13 UI calls send no `expectedVersion` (frontend review), so for those calls the last writer wins; reorder ignores conflicts (R-24). | **Partly.** | The swap-and-restore is the best that plain KVS offers. The installed `@forge/kvs` 2.1.1 has `transact()` with conditions only for custom entities (`node_modules/@forge/kvs/out/interfaces/transaction.d.ts`). Moving records to a custom entity with a `version` condition would make the check atomic, at the cost of an entity schema and a data migration. |
| D7 | Storage: one WorkEffort record per issue, keys `cp:<projectId>:we:<issueId>` and `cp:<projectId>:plan:<planId>:we:<issueId>`. | **Yes.** | `src/storage/plan-store.ts:81-83`; `toWorkEffortRecord`/`fromWorkEffortRecord` `src/domain/models.ts:439-533`; round-trip test in review tests. Baselines, shifts and approver policy use other key families (section 5). | Yes | The design is good: one key per issue, keyed by id, which survives a project or issue rename. Baseline keys do not follow it (they use the project key). |
| D8 | Jira writes only after the KVS write succeeds, each reported in the Changes panel; opening, hovering and scrolling write nothing. | **No.** | Link creation, sub-task creation and sub-task deletion run before `putEntry` and are hidden on conflict (R-04, R-05, R-06). `createInlineTask` writes Jira first (R-14). Opening the planner calls `pruneStaleEntries`, a KVS delete (F-05). Hover and scroll write nothing (harness 2m, frontend review item 10). | Yes as a rule | The rule is right. Implementing it needs the writes ordered: KVS with version check first, then Jira. For creates, which must go to Jira first, report the created issue even when the KVS step fails. |
| D9 | Cascades move at most 25 successors per call; the client calls again until none remain. | **Yes, with gaps.** | `CASCADE_BATCH_LIMIT` `src/index.ts:1903`; the client loop is in `src/frontend/bridge.ts:37-42`. A successor that conflicts is skipped and not returned as remaining (R-07). `MAX_CASCADE_ROUNDS` does not limit anything (frontend review). A multi-select move discards the remainder (`src/index.ts:1900`). | Yes | Client-driven continuation keeps each call under 25 s with no queue. Forge async events would be more robust for large graphs, at the cost of a consumer module. |
| D10 | Canvas timeline with an accessible treegrid mirror. | **Yes.** | `src/frontend/canvas-timeline.ts`; treegrid in `legacy-planner.js` `initGrid` (from 4678); frontend review item 11. The form dialogs have no dialog role and no focus trap (frontend review). | Yes | Owner decision; canvas is needed for 5,000-row performance. Not fully audited against WCAG 2.2 AA (section 11). |
| D11 | Reads run as the user; writes as the user where possible. | **Yes for Jira.** | `getJiraCaller` `src/index.ts:145-150` uses `asUser`; no explicit `asApp()` call in `src/` other than the fallback. But KVS writes are app-level and checked against nothing (BL-2). | **Partly.** | Inheriting Jira permissions for Jira writes is right. It does not cover KVS: the app has to add its own check, or a read-only user can change shared plan data. |
| D12 | Licensing is enforced for paid use. | **Yes for project-page resolvers.** | `isLicenseActive` and `withResolverHandler` `src/index.ts:2429-2453`; `test/licensing.test.ts`. The approver-policy and `checkPlanApprover` resolvers skip it (`:2638-2661`, read or admin-only, low risk). | Yes | Missing `context.license` means "allow". That is right for development and staging, but it relies on Forge always sending the license in production. Not verifiable live (section 11). |
| D13 (added) | Stale records are pruned automatically on load. | Yes | `legacy-planner.js:1672-1674`, `src/index.ts:1837-1858` | **No** | See BL-9. |
| D14 (added) | The Jira read is capped at 10 pages of 100, newest first. | Yes | `MAX_PAGES` `src/index.ts:561`; JQL `order by created desc` `:581-582` | Partly | Keeps calls fast, but in a project with more than 1,000 issues, older issues never appear and cannot be planned. The UI shows `truncated`, but there is no way to choose which 1,000. A JQL filter (for example by epic or fix version) would make the cap usable. |
| D15 (added) | Calendar days only, no working-day calendar (spec D-06). | Yes | `src/domain/schedule-engine.ts` | Yes for v1 | The admin guide claims "Working Days: Select active working days", which is false (section 9). |
| D16 (added) | Custom UI with a legacy 6,478-line JS file replaced part by part (spec D-08). | Yes | `src/frontend/legacy-planner.js` | Partly | Untyped, outside coverage, and it hides real defects (frontend H8: three undefined functions in the shipped bundle). |

---

## 4. Findings

Severity: Critical (blocks release or causes data loss or a security breach), High (wrong data or a broken feature in normal use), Medium (wrong in edge cases or degraded), Low (quality). "Confirmed" means reproduced by a test, the harness or the live site. "Confirmed by reading" means checked line by line but not executed. "Plausible" means reasoned and not reproduced.

### Critical

**F-01. No server-side authorization on governance, plan management and shared-date writes.** Confirmed (R-11, R-16).
- `src/index.ts:2542-2564` `reviewScopeShift`: no `isPlanApprover` call. The requester can approve their own request (`reviewedBy` = requester). `status` is not validated (R-16 stores "WHATEVER"). An already-reviewed request can be reviewed again.
- `src/index.ts:2455-2472` `freezePlanBaseline`, `:2340-2393` create, delete and rename plan: no check of any kind. Any user who can open the project page can delete a plan with all its records.
- `src/index.ts:1808-1823` `updateWbsTask` writes KVS (and shares dates to every plan) before Jira; when the user cannot edit the issue, the Jira PUT returns 403 but the KVS start date has already changed in every plan (R-11).
- Scenario: a user with Browse Projects only opens the planner and drags a bar. Jira refuses the due date, but every plan now shows the new start. With the browser console the same user can call `invoke('reviewScopeShift', { shiftId, status: 'APPROVED' })`.
- Fix: see BL-2.

**F-02. Public material describes features that do not exist.** Confirmed by reading and live (section 9, BL-1).

### High

**F-03. The plan returned after a write uses the Jira data read before the write. The screen shows the wrong dates, and Undo/Redo build on them.** Confirmed: unit R-30 and R-31, harness R1c, R2a, R2b, live L2 and L3. This is the cause of the owner's observation of 2026-11-05.
- Mechanism:
  1. `updateWbsTask` reads Jira once (`loadLive`, `src/index.ts:1537`).
  2. It writes the new due date to Jira (`:1827`).
  3. It returns `getProjectPlan(..., live, planId)` with that **old** read (`:1829`).
  4. Since `db08009`, `mapLiveIssues` ends every scheduled bar on the Jira due date whenever it differs from the saved end (`:781-785`). So the returned task gets the new start and the **old** end. If the new start is after the old end, the start is pulled back too, and the bar is one day long (`:784`).
  5. The client draws the optimistic dates first (`legacy-planner.js:4536-4540`, correct), then `applyPlanInPlace(res)` replaces them with the wrong ones (`:4545`). After a reload the Jira read is fresh and the bar is right.
- The same pattern is in `batchUpdateTasks` (`:1878, 1896`) and `continueCascade` (`:1918, 1933`) (R-31).
- Live evidence on DEMO-29, one-week move right: optimistic 170 px, 2026-11-04 to 11-17; after response **85 px, 2026-11-04 to 11-10**; after reload 170 px (`live/L2-DEMO-29.json`, `live/shots/L2b`, `L2c`, `L2e`). Move left: after response **255 px** (`live/L3-DEMO-29.json`).
- Consequence on Undo/Redo:
  1. `settleUndo` builds the entry from the plan after `applyPlanInPlace` (`legacy-planner.js:168-176`), so the "after" state is wrong.
  2. The "before" snapshot is also wrong (F-04).
  3. In the harness, Undo left the moved dates in place (R2a), and Redo wrote an end date of 2026-12-04 to KVS and Jira that the user never chose (R2b; `harness/results-review/e2e_review.json`).
- Fix: after the Jira writes, refresh the issues just written before building the response. Either re-read them (one search by key), or patch `live.raw` with the due dates that Jira accepted (from the sync log). Add a test where Jira already holds a due date. The existing plan-isolation tests start with no due dates, which is why they missed this.

**F-04. A drag cannot be undone, and "Cancel" in the conflict dialog does not revert.** Confirmed (harness probe, frontend H5).
- The drag handler changes `task.startDate` and `task.endDate` in `currentPlan` (`legacy-planner.js:4536-4537`) **before** `callResolver` takes the "before" snapshot (`:154`).
- So "before" already has the new dates.
- When the response is fresh, before equals after and no Undo is offered. In the probe the first drag showed no Undo flag, and Ctrl+Z changed nothing (test-log #19).
- When the response is stale (F-03), the entry holds wrong values.
- "Cancel" in the dependency dialog writes `task.startDate`, which is already the new date, and announces "Reverted" (`:4647-4654`).
- The listing claims "20-Step Undo" and INV-12 says every edit can be undone.
- Fix: take the snapshot before the optimistic change (or keep `prevStart`/`prevEnd` and pass them in), and have Cancel use them.

**F-05. Automatic prune can delete planning records that other users need.** Confirmed code path (R-18). The Jira 404 semantics are Plausible: documented Jira behaviour, not reproduced live.
- `getProjectPlan` lists as stale every stored record whose issue the current user's search did not return (`src/index.ts:910`).
- The client calls `pruneStaleEntries` on every load (`legacy-planner.js:1672-1674`).
- The resolver deletes a record when `GET /issue/{key}` as the user returns 404 (`src/index.ts:1850-1853`).
- Jira returns 404 for "does not exist or you do not have permission to see it".
- Scenario: issue DEMO-50 has an issue security level that the user cannot see. That user opens the planner, and DEMO-50's dates, links and contributors are deleted for everyone.
- Also: an issue moved to another project still answers 200 under its old key, so its record is never pruned and is re-listed on every load. Only the open plan is pruned, so the other plans keep orphans.
- Fix: BL-9.

**F-06. Default values are written to Jira (INV-03, listing claim).** Confirmed (R-10, R-13), and Confirmed by reading (frontend H1 to H3).
- Every schedule-from-backlog path sends `spanWeeks: 3`, so the server writes a due date about three weeks after the start, which the user never chose (`legacy-planner.js:3889-3895, 4108-4114, 4163` and others; server `src/index.ts:1024, 1033`).
- `createInlineTask` does the same (`legacy-planner.js:2899, 6289`).
- `createSubtaskForResource` writes a 20 h estimate and a two-week due date when the user enters none (`src/index.ts:2046-2048, 2148-2152`; R-13; UI `legacy-planner.js:5974`).
- Setting progress to 100 (or 1 to 99 on a "To Do" issue) transitions the Jira status (`src/index.ts:1579-1583`; R-10).
- Fix: send only what the user entered. For scheduling, use the drop date with a duration the user picks, or no Jira due date until the user sets an end. Do not transition status from progress without an explicit choice.

**F-07. Jira writes run before the version check, and a conflict hides them.** Confirmed (R-04, R-05, R-06, R-14).
- In `updateWbsTask`, the issue link POST (`src/index.ts:1614`), the sub-task create (`:1655`) and the sub-task DELETE (`:1685`) run before `putEntry` (`:1808`).
- On conflict the resolver returns `conflictResult` with `jiraSync.writes: []` (`:451-457`), so the Changes panel shows nothing although Jira was changed.
- A destructive sub-task delete can happen for an update that is then refused.
- Fix: version check and KVS write first, then Jira. Always return the Jira writes that happened.

**F-08. A status change is reported as written when Jira did not change it.** Confirmed (R-08, R-09).
- `syncTaskFields` ignores the transition POST result and pushes `status` into the written fields even when no transition matched (`src/index.ts:1447-1458`).
- Fix: record the transition result; report "no matching transition" as not written.

**F-09. Personal data: no reporting, and Jira-owned text plus display names are stored.** Confirmed (R-19); no reporting code found.
- Baselines store `summary`, `resource` (display name) and `status` per task (`src/domain/scope-creep.ts:101-111`), against INV-04.
- Contributors (`models.ts:459-462`), baselines (`frozenBy`), shifts (`requestedBy`, `reviewedBy`) and the approver policy (`setByPartyId`) store account ids.
- Fix: BL-5.

**F-10. Lost updates across plans and in the restore step.** Confirmed (R-01, R-02).
- R-01: user A moves T in the Main Plan while user B moves T in Plan B. With the interleaving A put, B put, A copy, B copy, each plan holds the other user's dates. Plan B then shows A's start with B's Jira end.
- R-02: in `putEntry`, the restore `set(key, previous)` (`plan-store.ts:130`) overwrites a third writer C who saved between the swap and the restore. C was told OK. C's write succeeded because A's rejected interim record carries version `expected + 1`, the same number as B's committed record.
- Fix: a custom entity with a conditional transaction (D6). For cross-plan copies, copy only when the other plan still has the dates this write replaced (compare-and-set on the dates, not blind re-apply), and otherwise report the task.

**F-11. Saving the task form can unassign the issue in Jira.** Confirmed by reading (frontend H7).
- Only the first 50 assignable users are loaded (`src/index.ts:511`).
- If the current assignee is not among them, the form shows "Unassigned", and Save sends `resourceAccountId: 'unassigned'` (`legacy-planner.js:5852-5861, 6100-6103`).
- Fix: always include the current assignee and send the assignee only when the user changed it.

**F-12. Three functions are undefined in the shipped bundle.** Confirmed by reading of the built `static/frontend/build/app.js`.
- `addDays(...)` is called at `app.js:12586` and `12594` (source `legacy-planner.js:5383-5392`). It is defined nowhere in the bundle, because esbuild renamed the imported one to `addDays2`.
- `showErrorBanner(...)` is called at `app.js:13470` (source `:6345`).
- `populateEpicDropdowns()` is called at `app.js:13523` (source `:6401`).
- Each path throws `ReferenceError`: the +/- 1 week buttons in the date editor, and the "Epics not enabled" and "epic created" paths.
- Fix: use the right names, and add a lint or type check over the frontend (`checkJs`, or move these functions to TypeScript).

**F-13. Create flows report success after a failed call.** Confirmed by reading (frontend H4).
- `bridge.ts:26-29` returns `{ ok: false }` with no `success` field when `invoke` throws.
- The task and epic create flows check only `success === false` (`legacy-planner.js:2903, 6292, 6386`). They close the form and show "Task created and scheduled."
- Fix: check `ok`.

**F-14. Release build is not reproducible.** Confirmed (test-log #3, #10, #21 to #23). See BL-8.

### Medium

**F-15. A dependency cycle through a second link passes validation; the Jira link is created, then the update throws.** Confirmed (R-15).
- `validateDependency` follows only `dependency` (the first link) (`src/domain/planner-engine.ts:176-177`).
- Imported Jira "Blocks" links and second links are not followed. `mirrorDependencyToJira` creates the link (`src/index.ts:1614`), and then `cascade` throws "Dependency cycle" (`schedule-engine.ts:173`).
- Jira now holds a cycle. After that, every move of a task in the cycle fails, because the cascade always throws.
- Fix: validate over all active links (the same graph the engine uses), before any Jira write.

**F-16. Size limits: a baseline does not fit in one KVS value at 1,000 tasks, and the shifts list grows without bound.** Confirmed (R-27).
- At 1,000 tasks the baseline is 260,245 bytes with 80-character summaries, which is over the 240 KiB (245,760 bytes) value limit. `freezePlanBaseline` would fail.
- `ps:shifts:<key>:<plan>` is one array that only grows (`baseline-repository.ts:79-89`).
- Fix: one key per baseline task chunk, or store only ids and hours. One key per shift.

**F-17. Cost of batch and multi-plan writes.**
- Confirmed for 200 tasks (R-28, R-29). Extrapolation to 1,000 tasks is Plausible.
- `batchUpdateTasks` with 50 items runs `updateWbsTask` 50 times. Each run calls `getProjectPlan` twice plus `loadEntries` and `shareTaskDates`.
- Measured: 151 prefix queries for 50 items at 200 tasks. At 1,000 tasks each prefix query is 10 pages, so about 1,510 KVS page reads. At a plausible 50 to 100 ms per page that is 75 to 150 s, far over the 25 s resolver limit (research A.h H1).
- Fix: load entries once per batch and reuse them; share dates once at the end.

**F-18. Validation gaps.** Confirmed (R-21, R-22, R-23).
- An end date before the start date is accepted (spec section 6 says end on or after start).
- There is no 10-year window: 9999-12-31 is sent to Jira.
- `scheduleBacklogTask`, `createInlineTask`, `createSubtaskForResource` and `createJiraEpic` do not validate `spanWeeks`, `startWeek`, `effortHours`, `summary` or `targetIndex`. `spanWeeks: 0` crashes with a `TypeError` instead of returning a validation result.
- `reviewScopeShift.status`, `requestScopeShift.reason` and the baseline name are not validated or bounded.
- Hostile text (script tags, unicode) is safe on display, because INV-01 holds (frontend review item 1).

**F-19. Due date rejected by the Jira screen (D3 edge a).** Confirmed (R-12, harness R8).
- The user is told: the flag reads "Saved in CascadePlan, but Jira rejected part of it: DEMO-29: Field duedate cannot be set...", and the Changes panel shows "Not written".
- But after a reload the bar is a one-day bar on the old Jira due date (`harness/results-review/R8c-after-reload.png`), and KVS keeps dates that no plan shows.
- Fix: when Jira rejects the due date, keep the KVS dates unchanged (or roll them back) and show the reason on the bar.

**F-20. Cascade gaps.** Confirmed (R-07).
- A successor that conflicts is logged "not moved" but not returned in `cascadeRemaining`, so it stays in violation until someone notices.
- Multi-select moves discard the remainder (`src/index.ts:1900`).

**F-21. Silent failures and no logs.** Confirmed (test-log #31) and by reading (frontend review).
- The backend has 14 empty `catch {}` blocks in `src/index.ts` and no logging at all, so `forge logs` shows nothing.
- When the Jira search fails, the plan returns `isLiveSynced: false`, and the UI shows "This project has no issues yet".
- A licence failure on load appears as "Unable to synchronize with Jira".
- Fix: log failures with a correlation id; show a clear "Jira unavailable" and "licence required" state.

**F-22. Orphaned and misplaced keys.** Confirmed (R-20).
- Deleting a plan leaves its baselines, active-baseline pointer and shift requests.
- Baseline and shift keys use the project **key** (`baseline-repository.ts:16-30`), so a renamed project loses them (CP-09).
- `createPlan` and `savePlans` are read-modify-write with no version check, so two concurrent creates can lose one plan (Plausible).

**F-23. Local sub-tasks hide the real Jira sub-tasks.** Confirmed (R-26).
- After `addSubtaskToTask` stores a local sub-task, `mapLiveIssues` prefers the stored list over the live Jira sub-tasks (`src/index.ts:761-763`).

**F-24. `checkPlanApprover` passes the project key as an issue key.** Confirmed (R-17) for the URL. The Jira 404 result is Plausible.
- `src/index.ts:2647` sends `mypermissions?issueKey=DEMO`. Jira answers 404, so Tier 1 fails, and a project admin who is not in a group is not an approver.
- The permission standard uses `issueId` (section 3).
- Use `projectKey=` with `ADMINISTER_PROJECTS` instead.

**F-25. Progress formula differs from the spec.** Confirmed by reading.
- `src/index.ts:728-736` divides `aggregatetimespent` by the issue's own `timeoriginalestimate` for every issue.
- Spec 3.3 item 9 says: a leaf uses its own spent and estimate, and a parent uses the aggregates. Time logged on sub-tasks therefore inflates a parent's progress.

**F-26. Other UI defects from the frontend read** (Confirmed by reading; details in `frontend-review.md`):
- In a keyboard move with a conflict, "Keep" saves nothing.
- A dependency on a backlog task is silently dropped on Save.
- Undo sends the current version and so overwrites other people's edits.
- An old Undo button undoes the newest action, not its own.
- The fallback "open issue" URL is hard-coded to `https://asymmsystems.atlassian.net` (`legacy-planner.js:99`).
- Raw codes such as `conflict` and `license_required` are shown to users.
- The form dialogs have no dialog role or focus management.

**F-27. Projects over 1,000 issues.** Confirmed by reading (D14).
- Only the newest 1,000 issues can be planned (`src/index.ts:561, 581`).
- `fetchProjectUsers` reads 50 users (F-11).

### Low

**F-28. `reorderWbsTasks` returns ok when its write lost a race.** Confirmed (R-24). The result of `putEntry` is ignored (`src/index.ts:2019, 2026`).

**F-29. Week grid starts on Wednesday.** Confirmed by reading.
- `generateDynamicWeeks` aligns weeks to Wednesday (`planner-engine.ts:195-199`), while the timeline header shows Monday weeks (live screenshot, 02-Nov).
- Dropping a backlog issue on a row starts it on the Wednesday of the current week.
- All server dates are UTC days (`todayIso` `src/index.ts:259`). A user east of UTC sees "today" change at 05:30 local in Sri Lanka, for example.

**F-30. Copyright headers missing** in 13 files (test-log #34):
- `src/index.ts`, `src/domain/models.ts`, `src/domain/resource-utilization.ts`, `src/domain/scope-creep.ts`, `src/domain/planner-engine.ts`, `src/storage/plan-repository.ts`, `src/storage/baseline-repository.ts`
- `test/index.test.ts`, `test/domain/scope-creep.test.ts`, `test/domain/planner-engine.test.ts`, `test/domain/resource-utilization.test.ts`, `test/storage/baseline-repository.test.ts`, `test/storage/plan-repository.test.ts`

No em or en dashes were found in the files checked.

**F-31. Maintainability.**
- `src/index.ts` is 2,670 lines, with 35 `resolver.define` calls (some are aliases) and pervasive `any`.
- `legacy-planner.js` is 6,478 untyped lines outside coverage.
- The baseline, scope and utilization resolvers (`src/index.ts:2455-2580`) have no tests (coverage gap).
- Error results are inconsistent across resolvers (`success` vs `ok`; thrown `Error` vs validation result, for example `throw new Error(validation.error)` at `:1606, 2244`).

---

## 5. Data model map

| Key | Owner | Shape | Written by | Read by | Deleted when |
|---|---|---|---|---|---|
| `cp:<projectId>:we:<issueId>` | Main Plan | `StoredRecord` = WorkEffort body (`effort`, `assocs`, `parties`, `estimate`, `estimateExtras`, `grid`, `model: 2`) + `issueKey`, `issueId`, `version` (`plan-store.ts:27-31`, `models.ts:413-421`) | `putEntry` from `updateWbsTask`, `batchUpdateTasks`, `scheduleBacklogTask`, `unscheduleTask`, `reorderWbsTasks`, `continueCascade`, `createInlineTask`, `createSubtaskForResource`, `addSubtaskToTask`, `saveTaskDependency`, `shareTaskDates`, migration | `loadEntries` (every resolver that builds a plan) | Only by `pruneStaleEntries` on a 404 (F-05). Never on issue move or type change (id is stable, so a type change keeps the record, which is correct). |
| `cp:<projectId>:plan:<planId>:we:<issueId>` | Scenario plan | same | same, with `planId`; `createPlan` clone; `shareTaskDates` from any other plan | same | `deletePlan` (all), `pruneStaleEntries` |
| `cp:<projectId>:settings` | Main Plan | `{ columnWidths, hiddenColumns, milestones (max 100), migratedAt, modelVersion }` | `saveColumnWidths`, `saveHiddenColumns`, `saveProjectMilestone`, migration | `getProjectPlan`, `migrateIfNeeded` | Never |
| `cp:<projectId>:plan:<planId>:settings` | Scenario plan | same (cloned including `migratedAt`) | same, `createPlan` clone | same | `deletePlan` |
| `cp:<projectId>:plans` | Project | `PlanMetadata[]` `{ id, name, createdAt, isDefault? }` | `createPlan`, `deletePlan`, `renamePlan` (read-modify-write, no version) | every resolver (`listPlans`, `writablePlanId`, `shareTaskDates`) | Never |
| `ps:baseline:<projectKey>:<planId>:<baselineId>` | Plan (by project **key**) | `PlanBaseline` with per-task snapshot incl. `summary`, `resource` (display name), `status` | `freezePlanBaseline` (no UI) | `getPlanBaselines`, `getScopeCreepReport`, `requestScopeShift` (no UI) | Never (not on plan delete, R-20) |
| `ps:baselines_idx:<projectKey>:<planId>` | Plan | `string[]` of baseline ids | `saveBaseline` | `listBaselines` | Never |
| `ps:active_baseline:<projectKey>:<planId>` | Plan | baseline id | `saveBaseline` | `getActiveBaseline` | Never |
| `ps:shifts:<projectKey>:<planId>` | Plan | `ScopeShiftRequest[]` (unbounded) | `requestScopeShift`, `reviewScopeShift` | `getScopeCreepReport`, `reviewScopeShift` | Never |
| `cascadeplan:cfg:approver_policy` | Site | `ApproverPolicy` `{ roleTypeId, parties[{partyId, partyTypeId, name}], fromDate, setByPartyId }` | `setApproverPolicyFlow` (Jira admin only) | `getApproverPolicyFlow`, `isPlanApprover` | Never |
| `planshift:cfg:approver_policy` | Site (legacy) | same | none | `PolicyRepository.getApproverPolicy` fallback (`policy-repository.ts:22`) | Never |
| Legacy: `scheduleMap:<key>`, `taskOrder:<key>`, `colWidths:<key>`, `hiddenColumns:<key>`, `milestones:<key>`, `ps:plan:<key>`, `ps:resmeta:<key>`, `ps:<key>:task:<issueKey>` | Pre-B-09 | old shapes | none | `ensureMigrated` | Deleted by `ensureMigrated` after the new records and settings are written (`plan-store.ts:250-255`) |

Model checks:

- **Round trip.** Every stored field round-trips (review test "round trip"), with these silent changes:
  - `dependency.notes` is dropped.
  - An ended link with no trigger becomes 100.
  - A contributor's `legacyName` is dropped when an account id exists (by design).
  - Engine output (`isViolated`, reasons) is not stored (by design, INV-09).
- **`JIRA_OWNED_FIELDS`** (`src/index.ts:219-223`). The list covers summary, status, assignee, epic, estimate, hierarchy, `jiraDueDate` and others. They are removed by `stripJiraOwnedFields` before every `putEntry`, and `toWorkEffortRecord` maps only planning fields, so none of them is persisted in the record. Two exceptions store Jira-owned data elsewhere:
  - `grid.localSubtasks`: sub-task summaries (F-23).
  - Baselines: summary, resource and status (F-09).
- **Migration** (`migrateIfNeeded`, `ensureMigrated`). It is safe to run twice, and safe when it fails halfway and is rerun: R-25 passes. The old keys are deleted only after the new ones are written, and a rerun rewrites the same content. The rerun bumps versions, which is harmless before first use.
- **Clone** (`createPlan`). It copies every record and the settings (including `migratedAt` and `modelVersion`, which is harmless) and no baselines (correct). It is not atomic: the plan is listed before its records are copied. At 1,000 records that is 1,000 get+swap pairs in one call, which risks the 25 s limit and a half-cloned plan (Plausible).

Limits arithmetic. Sources: research A.h. Key length 500; value 240 KiB; query page up to 100; 1,000 requests per second per installation; resolver 25 s; response 5 MB.

- **Keys.** The longest is `cp:<id>:plan:<64 chars>:we:<id>`, under 100 characters: OK. All characters are allowed by the key pattern.
- **Values.** A WorkEffort record is under 2 KiB, and settings with 100 milestones are under 20 KiB: OK. Baselines exceed the limit at about 950 tasks with 80-character summaries (R-27). The shifts array grows without bound.
- **Issues read.** For 1,000, 5,000 and 10,000 issues, the Jira read stops at 1,000 (D14).
- **KVS per load.** One prefix scan of N records is N/100 pages: 10 pages at 1,000 records. The planner never holds more than 1,000 records per plan unless old records remain.
- **KVS per move,** with P plans and N records: about (3 + P - 1) x N/100 pages. At N = 1,000 that is 30 pages for 1 plan and 120 for 10 plans, plus 1 to P swaps.
- **Batch of 50.** About 1,510 pages at N = 1,000 (F-17).
- **Rate.** 1,000 requests per second is not the binding limit. Two other limits can bind first:
  - The 25 s runtime of a resolver call.
  - The KVS per-minute quota per installation: 4,000 reads and 4,000 writes per minute, counted in units of 10 KB of request size (https://developer.atlassian.com/platform/forge/limits-kvs-ce/, as quoted in the fix-plan review, section 3 row 4, fetched 2026-11-05). The documentation does not say how a query page is counted. For R-29 (a batch of 50 at 200 tasks, 151 prefix queries over 30,200 rows), the count is several hundred units if each page counts once, and several thousand units if the count follows the response size. Plausible until it is measured.
- **Response size.** A plan response at 1,000 tasks is about 1 to 1.5 MB (estimate, not measured), under 5 MB.

---

## 6. Concurrency matrix

| # | Case and interleaving | Expected | Actual | Evidence |
|---|---|---|---|---|
| C1 | Two users move the same task in the same plan: A saves; B saves with A's old version. | B refused, A's dates kept, B writes nothing to Jira, B sees a message. | **As expected.** | R-03; harness R7a to R7d ("Someone else changed DEMO-29 a moment ago...") |
| C2 | Two users move the same task in different plans: A put (Main), B put (Plan B), A copies to Plan B, B copies to Main. | One set of dates in every plan, equal to the last move; or a reported conflict. | **Plans diverge:** Main holds B's dates, Plan B holds A's start with the Jira end of whoever wrote last. No message. | R-01 |
| C3 | A user edits the due date in Jira while another moves the bar. | Last writer wins, consistently. | The Jira due date wins on the next load for the end. The KVS start stays from the planner. If the Jira change came last, the bar is the planner's start with the Jira end; no message. If the planner write came last, Jira is overwritten silently (no Jira version check). | Code `src/index.ts:776-785`; harness 2k, 2l |
| C4 | A cascade batch runs while another user moves a successor. | The moved successor is respected and re-evaluated, or retried. | The successor is skipped ("changed by someone else; not moved"), not returned as remaining, and left in violation. | R-07 |
| C5 | `putEntry` restore and a third writer: A reads v1, B commits v2, A swaps, C reads A's interim v2 and commits v3, A restores B's v2. | No lost update. | **C's write is lost, and C was told OK.** The swap is atomic, the whole sequence is not. | R-02 |
| C6 | KVS write succeeds, then the Jira write fails (403, 400, 5xx, network). | Reported, and KVS not left in a state that no plan shows. | Reported in the flag and the Changes panel (R-11, harness R8a). KVS keeps the new dates. On a 403 every plan shows the new start (F-01). On a rejected due date the bar shows new start and old end (F-19). 429 is retried up to 3 times within 20 s (`withRetry` `src/index.ts:128-143`). 5xx and network errors are not retried. | R-11, R-12, harness R8 |
| C7 | Jira write succeeds, then the function times out (25 s). | User told the state is unknown; a retry is safe. | The client gets an invoke error; `bridge.ts` returns `{ ok: false }` and some flows then show success (F-13). KVS and Jira are both updated. A retry with the old `expectedVersion` gets a conflict, then a reload; this is safe but confusing. A create retry makes a second Jira issue (not idempotent). | Plausible; code `bridge.ts:26-29`, `src/index.ts:1085-1215` |
| C8 | Two tabs: tab 1 deletes the plan that tab 2 has open; tab 2 writes. | Tab 2 refused and told. | Refused with "This plan no longer exists. Reload..." (`writablePlanId`). Exception: `createInlineTask` creates the Jira issue first (R-14, frontend H9). | plan-isolation test; R-14 |
| C9 | `batchUpdateTasks` with 50 items, partial failure; an item changed by an earlier item of the same batch. | Each item applied or reported; items changed by the batch retried. | A retry happens once when the version change came from the batch (`src/index.ts:1886-1890`). Others are reported as conflict. Cost: 151 queries at 200 tasks, likely over 25 s at 1,000 (F-17). | R-29; existing `test/batch-update.test.ts` |
| C10 | Many writes in a row (drag sequence, large cascade). | No call per mouse move; Jira 429 honoured. | One call per drop (frontend review item 10). 429 handled with Retry-After, 3 tries, 20 s budget. KVS 429 is not handled (Plausible risk at high fan-out). | `withRetry`; frontend review |

---

## 7. Test results

### 7.1 Static and unit gate

- `npm ci` **failed**: no lock file. I used `npm install` instead (deviation).
- `tsc --noEmit`: 0 errors.
- Jest: **57 suites, 726 tests, all passed.**
- Coverage: statements 95.81%, branches 90.48%, functions 90.65%, lines 97.45%. The thresholds are 90 for each, so all four pass. The frontend is excluded from coverage.
- Build: OK.
- `git status` after the build: `static/frontend/build/app.js` **changed**. App code is identical; only `tslib` differs, because the committed bundle was built from `../ledgerseal/node_modules` (test-log #9, #10).

### 7.2 Tests added (`test/review/review-findings.test.ts`, 32 tests, all pass)

| Kind | Tests |
|---|---|
| FINDING (defect proven) | R-01, R-02, R-04 to R-24, R-26, R-30, R-31 |
| OK (correct behaviour proven) | R-03, R-25, round trip |
| MEASURE | R-27, R-28, R-29 (numbers in test-log section 3) |

### 7.3 Browser harness

- Existing checks: **30/30 passed.**
- Added checks, 22 of 25 expected behaviours held:

| Check | Result |
|---|---|
| R1a first move keeps length | Pass |
| R1b optimistic render keeps length | Pass |
| R1c length after resolver response | **Fail** (60.7 px to 12.1 px) |
| R1d length after reload | Pass |
| R2 setup | Pass |
| R2a Undo restores | **Fail** |
| R2b Redo re-applies | **Fail** (writes end 2026-12-04) |
| R2c Undo and Redo write Jira | Pass |
| R3a, R3b three plans share dates | Pass |
| R4 Ctrl+Z after plan switch | No change (undo history is cleared on switch, by design) |
| R5a to R5d collapse at every level after a switch | Pass |
| R6a to R6c cascade in Plan B seen in Main, due date to Jira | Pass |
| R7a to R7d conflict between two tabs | Pass |
| R8a rejected due date reported | Pass |
| R8b rejected due date | KVS new, Jira old; after reload a one-day bar on the old date |
| No page errors | Pass |

- Probe: a first drag offers no Undo (F-04).
- Note: two browser contexts do not share `localStorage`, so the conflict check (R7) used two tabs of one context, which share the fake KVS.

### 7.4 Live (asymmsystems.atlassian.net, project DEMO)

- Build under test: the development deployment of 2026-11-05T07:45:48Z by the owner. My own deploy of db08009 failed (BL-8), so the live build is presumed, not proven, to be db08009.

| Check | Steps | Expected | Actual | Evidence |
|---|---|---|---|---|
| L1 Planner loads | Open `/jira/servicedesk/projects/DEMO/apps/<app>/<devEnv>` | Rows, plan selector | 13 rows, Main Plan, 1 scenario, backlog 22 | `live/shots/L1-planner-loaded.png` |
| L2 One-week drag of DEMO-29 (owner observation) | Drag +7 days | Bar keeps length; due date to Jira; Changes panel entry | Due date written (Jira history 13:38:57, 2026-11-10 to 11-17); Changes panel "Written"; **bar 170 px, then 85 px after the response, then 170 px after reload** | `live/L2-DEMO-29.json`, `live/shots/L2a` to `L2e` |
| L3 Drag back | Drag -7 days | Restored | Restored (Jira 13:40:01, 11-17 to 11-10); bar **255 px** after the response, correct after reload | `live/L3-DEMO-29.json` |
| L4 Baseline, scope creep, shift approval | Look for the controls in the user guide and reviewer notes | Present | **Absent** | L1 button list, `live/shots/L1-planner-loaded.png` |
| L5 Admin page | Open `jira/settings/apps/<app>/<devEnv>` | Approver group picker | Loads ("CascadePlan approvers"), with a claim the server does not enforce (BL-2) | `live/shots/L5-admin-page.png` |
| L6 Forge logs | `forge logs -e development` | Errors visible | Empty (no logging, F-21) | test-log #31 |
| Other user-guide features | | | Not run live (section 11) | |

---

## 8. Marketplace checklist

Requirement sources and quotes are in `marketplace-research.md`, Section A. Status: Pass, Fail, or Not run.

| Requirement | Source URL | Status | Evidence |
|---|---|---|---|
| App performs as described | https://developer.atlassian.com/platform/marketplace/app-approval-guidelines/ (research A.a) | **Fail** | BL-1, section 9 |
| Runs on Atlassian eligibility (no egress, data residency) | https://developer.atlassian.com/platform/marketplace/runs-on-atlassian/ (research A.b) | Not run (`forge eligibility` not run) | Manifest has no `external` permissions; no `fetch` or XHR in frontend (frontend review item 13); one hard-coded fallback link to the vendor's own site (`legacy-planner.js:99`, navigation, not egress) |
| Badge claims | research A.b | **Fail** | BL-6 |
| Security requirements, Forge app security questionnaire, partner questionnaire | research A.c | Not run (needs owner sign-in); content risk **Fail** | Missing authorization (F-01) would have to be declared. `developer-console-checklist.md` still lists the retired Security Self-Assessment |
| Privacy policy URL covering app data | https://developer.atlassian.com/platform/marketplace/data-privacy-guidelines/ (research A.d D1, D2) | **Fail** | URL 200 but content covers website only |
| Personal data reporting | https://developer.atlassian.com/platform/forge/user-privacy-guidelines/ (D4, D7) | **Fail** | BL-5 |
| Terms / EULA | research A.e | **Fail** | `https://asymm.systems/terms` 404 |
| Support URL and contact | research A.e | **Fail** | `https://asymm.systems/support` 404; `support@asymm.systems` has MX records; not mailed |
| Documentation URL | research A.e | Partial | `https://asymm.systems/product/jira-governance/user-guide/cascadeplan.html` live (research B); `docs.asymm.systems` NXDOMAIN |
| Icon (local resource) | manifest | **Pass** | `icon: resource:main;icon.svg`; file exists; 144x144 asset meets rules (research D) |
| Banner, screenshots, highlights | research A.f | **Fail** | BL-7 |
| App name consistent | CLI output | **Fail** | Registered name "PlanShift" (test-log #21). Developer Console and Connected apps views: Not run (needs owner sign-in) |
| Licensing enabled and enforced | https://developer.atlassian.com/platform/marketplace/cloud-app-licensing/ (research A.g) | Pass (code); Not run (live) | `manifest.yml:40-41`; `test/licensing.test.ts` |
| Pricing consistent | listing vs checklist | **Fail** | 251+ tier: listing $0.60, checklist and FAQ $0.90 (research C) |
| CSP `'unsafe-inline'` styles | research A.i | Pass (allowed) | Still needed: 183 inline style attributes (frontend review item 2). No `unsafe-eval` (confirmed live: Playwright `evaluate` was blocked) |
| Scopes justified and sufficient | submission notes section 1 | **Fail (text)** | The scopes themselves are right: `read:jira-work` (search, issue, transitions, mypermissions), `write:jira-work` (issue PUT/POST/DELETE, issueLink, transitions), `read:jira-user` (assignable users, `myself?expand=groups`, groups picker, group bulk), `storage:app`. No call needs an undeclared scope. But the justifications cite "Baseline Freezing" and "Shift Approvals", which have no UI |
| `developer-console-checklist.md` open items | research C | Open | The "Fix Needed" icon row is already met (local SVG). Other open rows: retired security self-assessment, production-install row conflicts with Atlassian guidance, review-time estimate differs from Atlassian's pages |

---

## 9. Listing claims audit

### `docs/marketplace/cascadeplan-listing.md`

| Claim | True? | Evidence |
|---|---|---|
| Percent-trigger dependencies with clear reasons (`?` / hover shows driver, trigger, dates, fixes) | True | `schedule-engine.ts:86-150`; `why-popup.ts`; harness dependency labels |
| "Never writes values to Jira that you did not enter" | **False** | F-03, F-06 |
| On-screen preview of every planned Jira update during a drag | Partly | Write preview strip exists (`legacy-planner.js:4490`); defaults written on schedule are not previewed |
| 10-second undo toast; Ctrl+Z / Ctrl+Shift+Z; 20 steps | **False for drags** | F-04; the stack holds 20 (`legacy-planner.js:125`) |
| Changes panel reviews every Jira write | **False** | Hidden on conflict (F-07); status reported as written when it was not (F-08) |
| Multi-person via native Jira sub-tasks, with unassign or delete prompt | True, with defects | `src/index.ts:1632-1700`; sub-task created even when the update is refused (R-05) |
| Canvas, Day to Year zoom, sticky headers, frozen columns, ghost previews | True | Live toolbar (Day/Week/Month/Quarter/Year); `canvas-timeline.ts` |
| "Smooth 60 fps on thousands of tasks" | Not verified | Not measured in this review; the research prototype T-06 is cited in the spec |
| Full keyboard control; Table view "with zero accessibility violations" | Partly; the "zero violations" part is unverified | Treegrid exists; no axe run in this review; form dialogs lack roles and focus management (frontend review) |
| Hours, Story Points, T-shirt units | True | `PlannerEngine.normalizeEstimateToHours` |
| "Zero customer data leaves your Atlassian site; no egress" | True (code) | No external permissions or calls |
| "Inherits SOC 2, ISO 27001, GDPR natively" | **False** | BL-6 |
| Badges: Cloud Fortified; 100% Data Residency Compliant; Runs on Atlassian | **False / not ours to claim** | BL-6 |
| "Reads Jira as the logged-in user and writes only user-approved edits" | Partly | Reads as user: true. "Only user-approved edits": false (F-06) |
| Pricing tiers | Inconsistent | Section 8 |

### `site/apps/cascadeplan/*.md`, admin page and submission notes

| Claim | True? | Evidence |
|---|---|---|
| Freeze baseline with a single click; "Freeze Baseline" button; confirmation dialog | **False** | No UI caller; not in live toolbar |
| "Cryptographic snapshot" of committed issues (index.md:25) | **False** | No crypto code (test-log #37) |
| "Immutable snapshot" / "immutable record" / "Immutable Audit Trail" | **False** | Plain `kvs.set`, overwritable (`baseline-repository.ts:32-46`); no versioning |
| Baseline Status Bar DRAFT / FROZEN / SHIFT_REQUESTED; Scope Delta Metric | **False** | No such UI or state |
| [ADDED] / [RE-ESTIMATED] badges; commitment delta header | **False** | No UI |
| Request Scope Shift modal with issue selection; notification of authorities | **False** | No UI; no notification code |
| Approve generates baseline version v1.1 and resets delta | **False** | `reviewShiftRequest` only sets status (`scope-creep.ts:262-275`) |
| Only designated authorities can freeze or review | **False** | F-01 |
| Resource Grid toggle; 40 h capacity highlighting | Partly | A "Utilization" view exists (`index.html:104, 216`), computed in the client; no capacity settings |
| Project Settings > CascadePlan > Baseline Settings / Resource Settings | **False** | Only a site-level `jira:adminPage` "CascadePlan approvers" exists (`manifest.yml:9-15`) |
| Alert-only vs strict governance modes; workflow validator | **False** | No code |
| Working days setting; Original Estimate vs Story Points setting | **False** | No code |
| Export JSON / CSV / signed PDF; SHA-256 hashes; Baseline Comparison View | **False** | No code |
| Baselines retained permanently; exportable from the admin console | Partly / False | Retained (never deleted, also not on plan delete); no export |
| Zero external network calls; data in Forge KVS | True | Manifest; code |
| Admin page: "only Jira administrators and project administrators can ... manage plans" | **False** | F-01 |
| Reviewer notes steps 2 to 5 (Freeze Baseline, Scope Creep indicator, Request Scope Shift, Resource Allocation view) | **False** for 2 to 4; partly for 5 | Same as above |
| Reviewer notes: "only writes to Jira when ... updated by the user" | **False** | F-06 |
| Scope justification "search user groups for baseline shift approval" | True for the admin page; the baseline feature itself is absent | `policy-admin.ts:126-158` |

---

## 10. Live site changes

| Item | What changed | State now |
|---|---|---|
| DEMO-29 | Jira due date 2026-11-10 to 2026-11-17 at 13:38:57, then back to 2026-11-10 at 13:40:01 (both by this review, under the owner's session). CascadePlan KVS record of DEMO-29: dates moved and moved back in the Main Plan and, through D3 sharing, in every other plan of DEMO (version +2 in each). | Due date 2026-11-10; bar 2026-10-28 to 2026-11-10 (verified after reload). Jira history keeps the two entries. |
| All DEMO plans | The planner was opened 5 times (discovery 1, L2 2, L3 2). Each load runs `pruneStaleEntries` automatically (F-05), which can delete records of issues the session cannot see. I cannot tell whether anything was pruned: there are no logs (F-21). | Unknown; owner may want to compare plan record counts. |
| Issues created or deleted | None. | |
| Plans created, renamed or deleted on the live site | None. | |
| Deploys | Three `forge deploy -e development` attempts, all failed at bundling before upload (test-log #21 to #23). No deploy to staging or production. | Development still runs the owner's 07:45:48Z deployment. |
| Site or app settings | None changed. The admin page was opened read only. | |

---

## 11. Not run

| Check | Reason | Exact step for the owner |
|---|---|---|
| Deploy of db08009 to development | Bundling fails from a clean clone (BL-8). The next workaround needs a `node_modules` folder outside the app folder, which the prompt forbids. | Fix BL-8, or tell the reviewer how the working deploy resolves `@asymm/jira-ui`; then `forge deploy -e development` from a clean clone. |
| Proof that the live build is db08009 | No build tag on deployments (`Build Tag N/A`). | Deploy with a build tag, or record the SHA in the deployment notes. |
| Live test of every user-guide feature one by one (create task, epic, schedule from backlog, unschedule, link, contributor sub-task, milestones, columns, table view, utilization, keyboard move, plan create/clone/rename/delete, three plans live) | Time box. The same paths were exercised locally against the real resolvers in the harness (30 + 25 checks). Live, I limited writes to one issue to keep the owner's cleanup small. | Run `harness/e2e.py`-style steps live, or give the reviewer a disposable project. |
| Baseline, scope creep and shift approval live | No UI exists. The resolvers could be called from the iframe console, but that would write governance records to the site. | None until the UI exists. |
| Licensing behaviour live | The development environment has no license context (`isLicenseActive` allows). Testing needs a production install, which I may not do. | Install from production on a test site after listing approval and check `context.license` handling. |
| Developer Console app name, Connected apps name, security questionnaires, partner portal, `forge eligibility` | Need an interactive sign-in to developer.atlassian.com and admin.atlassian.com; the cookie set does not cover them. | Open `https://developer.atlassian.com/console/myapps/cac8499e-e92e-4ba6-95cc-af398b1be791/overview` and Administration > Connected apps; run `forge eligibility` in `apps/cascadeplan`. |
| Performance at 100, 1,000 and 5,000 issues (time to first render, time per move) | Not measured. Only KVS operation counts at 200 tasks (R-28, R-29) and arithmetic. | Extend the harness fixture to N issues and time `getProjectPlan` and one `updateWbsTask`; run live with a seeded project. |
| WCAG 2.2 AA audit (axe, screen reader, contrast in dark theme, 24 px targets) | Not run. Only code reading (frontend review item 11) and existing unit contrast tests. | Run axe on the harness page in both themes and a screen-reader pass on the treegrid. |
| Firefox, Safari, Edge, small screens | Only headless Chrome available. | Manual pass or a cloud browser grid. |
| Jira 429 and 5xx behaviour live; Forge timeout | Cannot be provoked safely on the shared site. | Covered by unit tests for 429 (`test/paging-retry-cascade.test.ts`); 5xx and timeout remain Plausible (C6, C7). |
| Sending email to `support@asymm.systems` | Forbidden by the brief. | Send a test message. |
