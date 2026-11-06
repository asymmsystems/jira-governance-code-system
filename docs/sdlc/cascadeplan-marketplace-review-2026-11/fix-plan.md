# CascadePlan: recommended fix plan

- **Companion to:** `report.md` in the same folder (review of commit `db080096007208d2cad97f79c620d49964aa05c9`, 2026-11-05).
- **Written:** 2026-11-05, by the same review session, after the report.
- **Purpose:** one recommended fix for every blocker, finding, concurrency case, Marketplace item and frontend item in the review, with a priority, a rough effort and the test that proves the fix.
- **Status:** a recommendation for independent review. Nothing in the product was changed. The owner (Fahim Farook) decides.
- **Paths:** relative to `apps/cascadeplan/` unless they start with `docs/` or `site/`. Line numbers are at `db08009`.
- **Source of each problem:** the ID names the source.
  - `BL-n`, `F-n`, `C-n`, `D-n` and `R-n` are in `report.md`.
  - `H-n`, `M-n` and the numbered sections ("FE section 6") are in `frontend-review.md`.
  - `N-01` is new in this plan (section 9).

---

## 1. How to read this plan

### 1.1 Priority

| Priority | Meaning |
|---|---|
| P0 | Blocker. Must be closed before the app is submitted to the Marketplace. |
| P1 | High. Wrong data or a broken feature in normal use. Close before submission. |
| P2 | Medium. Close before submission if possible, else in the first update. |
| P3 | Low. Quality work for a later update. |

### 1.2 Effort

The effort is a rough guess for one developer who knows this code base. It includes the tests. It does not include review rounds.

| Size | Meaning |
|---|---|
| S | Half a day or less |
| M | Half a day to 2 days |
| L | 2 to 5 days |
| XL | More than 5 days |

### 1.3 Proof

- "R-xx" is a test in `test/review/review-findings.test.ts`.
- A test named "FINDING" passes **while the defect is present**. When a fix lands, that test fails. Rewrite it as a regression test that asserts the correct behaviour, and keep the same R number.
- "Harness R1c" and similar names are checks in `harness/e2e_review.py`. "Harness 2d" and similar names are checks in `harness/e2e.py`.
- "Live" means a manual or scripted check on asymmsystems.atlassian.net, project DEMO, development environment.

---

## 2. Decisions for the owner

Four fixes depend on a choice that only the owner can make. Each has a recommendation. The rest of the plan assumes the recommendation and says what changes if the owner chooses the other option.

### DEC-1. Baseline features: describe the app that exists, or build the baseline features first (BL-1)

| | Option A (recommended): ship the planner, describe it truthfully | Option B: build baseline, scope creep and shift approval before submission |
|---|---|---|
| What changes | Rewrite `site/apps/cascadeplan/*.md`, `docs/marketplace/cascadeplan-listing.md`, the submission notes and the admin page text. Disable the baseline, scope-creep, scope-shift and utilization-grid resolvers on the server. Build the baseline features later as a v1.1, with the listing updated then. | Build a freeze button, a status bar, a scope delta, a request and approval UI, versioned baselines and export. Fix their backend first: F-01 (no permission check), F-16 (baseline does not fit in one KVS value), F-22 (keys under the project key) and the missing tests (F-31). |
| Effort | M (text) plus S (disable resolvers) | XL (several weeks, plus a second review) |
| Risk | Low. The planner is the tested part of the app. | High. The baseline backend has no tests and three known defects, and the claims (signed PDF, SHA-256, immutable trail) need new design work. |
| Effect on other fixes | F-16, F-22 (baseline part) and the baseline part of BL-5 move out of the release scope. | All of them stay in scope. |

**Recommendation: Option A.** Atlassian rejects apps that do not do what the listing says. Option A closes BL-1 in days, and Option B delays submission by weeks. Do not leave the unused governance resolvers defined. Without a permission check they can be called from the browser console (F-01).

If Option A is chosen, keep the admin page and give it a real job: it sets who may create, rename and delete plans (see BL-2). Then its text and the `read:jira-user` scope justification are true.

### DEC-2. Personal data: store none, or report what is stored (BL-5)

| | Option A (recommended): store no personal data | Option B: keep account ids and report them |
|---|---|---|
| What changes | Contributors: store only the sub-task key (`subtaskKey`, `src/domain/models.ts:459-462`) and read the assignee from Jira on each load. Approver policy: drop `setByPartyId`. Under DEC-1 Option A, the baseline (`frozenBy`, display names) and shift records (`requestedBy`, `reviewedBy`) are not written in v1. Remove display names from baselines in any case (INV-04). | Add a `scheduledTrigger` (weekly) that collects every stored account id, calls the Forge personal data reporting API, and erases or anonymises closed accounts. Keep a key index so the trigger does not scan every key. |
| Effort | M | L |
| Risk | Low. Jira stays the source for people, as INV-04 already requires. | Medium. The trigger must cover every key family, now and in the future. A missed one is a compliance gap. |

**Recommendation: Option A.** Atlassian recommends that apps resolve people live (`marketplace-research.md`, A.d D5). The app already reads assignees from Jira on every load, so this costs one field per contributor. Before closing BL-5, check with the reviewers that no other key family keeps an account id (search the code for `accountId`, `partyId`, `By:` and `displayName`).

### DEC-3. Shared dates: one record per issue, or a copy in every plan (D3, F-10 R-01, F-17, C2)

| | Option A (recommended): one shared date record per issue | Option B: keep the copy in every plan, and make the copy conditional |
|---|---|---|
| What changes | Store the shared date fields (`SHARED_DATE_FIELDS`, `src/index.ts:329`) once per issue, under a new key such as `cp:<projectId>:dates:<issueId>`. Each per-plan record keeps only the per-plan fields (order, links, contributors, milestones, progress settings). `getProjectPlan` merges the two records. `shareTaskDates` (`:338-374`) is deleted. A one-time migration takes the Main Plan dates as the truth (since `db08009` all plans hold the same copy). | Keep `shareTaskDates`. Copy only when the other plan still holds the dates that this write replaced (a compare-and-set on the dates). Otherwise report the task as "not moved in plan X". |
| Effort | L (includes the migration and its tests) | M |
| Concurrency | One record, one version check. C2 (two users, two plans) becomes the same case as C1, which already works. | C2 is reported instead of lost. The cost still grows with plans times issues (R-28). |
| KVS cost per move | 1 date record, plus a per-plan record when a per-plan field changes | One full prefix scan per other plan (R-28: 12 queries at 10 plans) |

**Recommendation: Option A.** D3 says that a task has one set of dates. Storing them once matches that rule directly, removes the lost-update case and removes the cost that grows with the number of plans. Option B keeps the copy, and the copy is the source of the defect.

### DEC-4. Version check: custom entity with a conditional transaction, or plain KVS (D6, F-10 R-02, C5)

| | Option A (recommended): custom entity | Option B: keep plain KVS swap-and-restore |
|---|---|---|
| What changes | Move WorkEffort records (and the shared date records of DEC-3) to a Forge custom entity with a `version` attribute. Write with `transact()` and a condition on `version`. Then the version check and the write are one atomic step, and the restore step (`src/storage/plan-store.ts:128-131`) is removed. | Keep `putEntry`. Accept the C5 race: a third writer is lost if it saves inside the few milliseconds between the swap and the restore. Document the risk. |
| Effort | L (entity schema in `manifest.yml`, `PlanStore` rewrite, data migration, tests) | None |
| Risk | Medium. The migration must move every record exactly once. The reviewers should verify the `@forge/kvs` entity and transaction API against the current Forge documentation. I read only `node_modules/@forge/kvs/out/interfaces/transaction.d.ts` (version 2.1.1). | Low frequency, but the loss is silent, and the third writer is told that the save worked. |

**Recommendation: Option A, combined with DEC-3 Option A in one migration.** Both change the storage layout, so one migration costs less than two. If the release date is fixed, Option B is acceptable for the first version only when DEC-3 Option A is done. DEC-3 removes the more common race (C2), and C5 is rare.

---

## 3. Order of work

The order follows the dependencies between the fixes. Work in one phase can run in parallel.

| Phase | Work | Why in this order | Rough effort |
|---|---|---|---|
| 1 | DEC-1 to DEC-4 decided. BL-8 (reproducible build and CI). | Every later fix needs a build that deploys from a clean clone and a CI job that proves it. | M |
| 2 | BL-2 and N-01 (authorization), BL-9 (prune), F-03 and F-04 (stale response, Undo), F-06 (default values), F-07 (write order), F-08, F-11, F-12, F-13. | These change what the app writes. Fix them before the storage migration, so the migration tests run against correct write paths. | L to XL |
| 3 | DEC-3 and DEC-4 migration (if chosen), F-10, F-17, F-15, F-19, F-20. | Storage layout and the paths that depend on it. | L |
| 4 | BL-1, BL-3 (closed by phase 2), BL-4, BL-5, BL-6, BL-7, Marketplace items (section 7). | Text, legal and media work. Its content depends on what phases 2 and 3 deliver. | M to L, much of it not code |
| 5 | P2 findings and frontend items. | Before submission if time allows. | L |
| 6 | Release gate (section 10), then submission. | | M |
| Later | P3 items. | First update after listing. | L |

Total before submission, with all four recommendations: about 5 to 7 weeks for one developer. This is a rough figure. The largest parts are phase 2 and the migration in phase 3.

---

## 4. Blockers

### BL-1. Public material describes features the app does not have

- **Fix (DEC-1 Option A):**
  1. Rewrite `site/apps/cascadeplan/*.md` (user guide, admin guide, index) to describe the planner that exists: plans, percent-trigger dependencies, cascade, shared dates, Changes panel, Undo, keyboard move, table view, utilization view.
  2. Remove every claim in report section 9 that is marked False: freeze, status bar, scope delta, scope shift, baseline versions, comparison view, JSON/CSV/PDF export, SHA-256, "cryptographic snapshot", "immutable", Project Settings pages, governance modes, workflow validator, working days, estimate-unit setting.
  3. Rewrite the submission notes test plan steps 2 to 5 to test the planner features that exist.
  4. Change the admin page text (`src/frontend/admin.tsx:53, 94`) to "Approvers can create, rename and delete plans." This text is true only after BL-2.
  5. Disable the resolvers `freezePlanBaseline`, `getPlanBaselines`, `getScopeCreepReport`, `requestScopeShift`, `reviewScopeShift`, `getResourceUtilizationGrid`, and also `previewCascade`, `saveTaskDependency` and `saveProjectMilestone`, which no frontend file calls (FE section 3). Remove only their `resolver.define` lines (`src/index.ts:2612, 2618, 2623, 2631-2636`). The other definitions in that range (`saveColumnWidths`, `saveHiddenColumns`, `continueCascade`, `unscheduleTask`, `reorderWbsTasks`, `createSubtaskForResource`) stay. Keep the domain code and its tests for v1.1.
  6. Rename the "Baselines" tab, or remove it (`src/ui/plan-manager.ts:20-27`). It groups plans by name only (FE section 16 item 12).
- **Priority:** P0. **Effort:** M.
- **Proof:**
  - Test-log #36 grep again: every resolver that remains defined has a UI caller, and the five governance resolvers are no longer defined.
  - A new unit test that invokes each removed name through the handler and expects "no such resolver".
  - The reviewers re-run the claims audit (report section 9) against the new text: every row True.

### BL-2. No server-side authorization

- **Fix:** one central guard, applied before any KVS write or Jira write.
  1. Add a table in `src/index.ts`: resolver name, then the required permission. Apply it in `withResolverHandler` (`src/index.ts:2448`), so no resolver can skip it. Also apply it in the special `updateWbsTask` wrapper (`:2599-2608`), which does not use `withResolverHandler`.
  2. **Task writes** (`updateWbsTask`, `batchUpdateTasks`, `scheduleBacklogTask`, `unscheduleTask`, `continueCascade`, `reorderWbsTasks`, `addSubtaskToTask`, `createSubtaskForResource`):
     - Check, as the user, `EDIT_ISSUES` on each issue the call will write.
     - For any date change, also check `SCHEDULE_ISSUES`. Jira needs it to set a due date.
     - Use one bulk call, `POST /rest/api/3/permissions/check`, with `projectPermissions` and the issue ids. A batch of 50 then costs one call, not 50.
     - A cascade checks the successors too. A successor the user cannot edit is not moved and is reported "you cannot edit this issue".
  3. **Creates** (`createInlineTask`, `createJiraEpic`): check `CREATE_ISSUES` on the project (`projectId` from the Forge context). Run the plan check (`writablePlanId`) first, before the Jira create (R-14, H9).
  4. **Plan management** (`createProjectPlan`, `renameProjectPlan`, `deleteProjectPlan`): require `isPlanApprover` (`src/security/policy-admin.ts:76`) with the project id. Fix `hasTier1AdminPermission` first (F-24), so that it can take a project id.
  5. **View settings** (`saveColumnWidths`, `saveHiddenColumns`): require `BROWSE_PROJECTS`. These settings are shared by the project, so consider `ADMINISTER_PROJECTS`. Owner choice, low risk either way.
  6. **Governance resolvers** (if DEC-1 Option B): approver for freeze and review; refuse `reviewedBy === requestedBy`; accept only `APPROVED` and `REJECTED`; refuse a second review of the same request.
  7. **Fail closed:** any error in the check, or a non-200 answer, refuses the call with `error: 'forbidden'` and a plain message. This follows `docs/design/uniform-permission-management-standard.md`, sections 1 and 4.
  8. **UI:** hide the plan rename and delete buttons for users who are not approvers (`legacy-planner.js:1519-1593`). The server check stays the real control.
- **Priority:** P0. **Effort:** L.
- **Proof:**
  - R-11 rewritten: a user whose permission check fails changes nothing in any plan, and the result is `forbidden`.
  - R-16 rewritten (if Option B): self-approval and unknown status are refused.
  - New unit tests: one for each row of the permission table, with an allow case and a deny case. A test asserts that every `resolver.define` name appears in the table, so a new resolver cannot be added without a rule.
  - Live: a second test user with Browse Projects only (needs owner, to create the user) drags a bar. The expected result is "You cannot edit DEMO-29", and no plan changes.

### BL-3. Values the user did not enter are written to Jira

- **Fix:** closed by F-03 (stale response, so Redo writes wrong values), F-06 (default span, default estimate, status from progress) and F-11 (unassign). See those items.
- **Priority:** P0. **Effort:** included in those items.
- **Proof:**
  - A new harness check "no unrequested write": record every Jira write during a scripted session of 20 actions (schedule, create, drag, Undo, Redo, progress edit, form save without change). Each write must match a value the script entered.
  - The form save without change must write nothing.

### BL-4. Legal, support and documentation URLs are broken or incomplete

- **Fix:**
  1. **Terms:** publish `https://asymm.systems/terms`, or choose Atlassian's standard end-user agreement in the app version's Links tab. Recommendation: the Atlassian standard agreement for v1. It costs nothing and avoids writing a contract. The owner's rule against riba-based late fees has no effect on it, because Atlassian handles the billing.
  2. **Support:** publish `https://asymm.systems/support` with the contact address `support@asymm.systems`, the hours and the response time. Send a test mail to that address, so that the MX records are proven to deliver.
  3. **Privacy:** extend `https://asymm.systems/privacy` with a CascadePlan section. Atlassian Partner Agreement 8.4(e) requires these items (`marketplace-research.md` A.d D2):
     - what the app processes (issue ids, dates, links, plan names; after DEC-2, no personal data);
     - that nothing leaves the Atlassian site;
     - where the data is stored (Forge storage, in the customer's data residency region);
     - who is responsible;
     - how a customer deletes the data (uninstall).
  4. **Documentation:** change every `docs.asymm.systems` link and image in `site/apps/cascadeplan/*.md` to the live `https://asymm.systems/product/jira-governance/user-guide/` pages. Or publish `docs.asymm.systems`, but the live path is less work.
  5. Re-run the URL check of `marketplace-research.md` Section B.
- **Priority:** P0. **Effort:** M (mostly writing; the site publishing steps are in the site repository).
- **Proof:** every listing URL returns 200 with the right content (the reviewers re-run the Section B check). The support mailbox receives a test mail.

### BL-5. Personal data reporting

- **Fix (DEC-2 Option A):**
  - Store only `subtaskKey` for contributors, and read the assignee live from the Jira sub-task.
  - Remove `setByPartyId` from the approver policy.
  - Write no baseline or shift records in v1 (DEC-1 Option A).
  - Remove display names from the baseline snapshot code (`src/domain/scope-creep.ts:101-111`), so that v1.1 cannot bring them back.
  - Migrate existing records: drop the account id fields. Note that this is a data change on installed sites. Today only the owner's sites have the app.
  - In the Marketplace "Privacy and security" tab, declare that the app stores no personal data.
- **Priority:** P0. **Effort:** M.
- **Proof:**
  - A new unit test serialises every record type that the app writes (WorkEffort, shared dates, settings, plans, approver policy) and asserts that no value matches the Atlassian account id pattern and that no field is named `displayName`.
  - R-19 rewritten to match.

### BL-6. Badge and compliance claims

- **Fix:**
  - Remove from the listing: "Cloud Fortified", "100% Data Residency Compliant", "Runs on Atlassian" and "Inherits SOC 2, ISO 27001, and GDPR compliance natively".
  - Replace them with facts the code supports: "Runs entirely on Atlassian Forge. No data leaves your Atlassian site."
  - Run `forge eligibility` in `apps/cascadeplan`. Atlassian shows the Runs on Atlassian badge by itself when the app qualifies.
- **Priority:** P0. **Effort:** S.
- **Proof:** the reviewers re-run report section 9 for the listing. `forge eligibility` output is kept in the release evidence.

### BL-7. App name and media

- **Fix:**
  1. Rename the app to "CascadePlan" in the Developer Console (app settings) for app `cac8499e-e92e-4ba6-95cc-af398b1be791`.
  2. Redeploy, then check the name on the install screen, the consent screen and Administration > Connected apps.
  3. Make a new `banner.png` at 1120x548, with "CascadePlan" and no "PlanShift".
  4. Retake the screenshots at 1840x900 inside Jira, on a production-like install with no "DEV" badge.
  5. Make the three 580x330 highlight images with captions.
  6. Search the repository for "PlanShift" (all cases, and also "plan shift" and "plan-shift") and replace every user-facing hit.
- **Priority:** P0. **Effort:** M (media work).
- **Proof:** `forge deploy` prints "Deploying CascadePlan". The image sizes are checked with `file` or `identify`. The "PlanShift" search returns no user-facing hits.

### BL-8. Build not reproducible or deployable from a clean clone

- **Fix:**
  1. Commit `apps/cascadeplan/package-lock.json`. Also commit `apps/cascadeplan/tools/package-lock.json` if it is missing.
  2. Make `@asymm/jira-ui` a real package. Today it resolves only through `tsconfig.json` `paths` (`tsconfig.json:11-12`), which the Forge bundler does not use for `forge deploy`.
     - In `packages/asymm-jira-ui`, add a build step that writes JavaScript and type files to `dist/`, and point `main` and `types` at `dist/`. ts-loader will not compile TypeScript inside `node_modules` (test-log #23).
     - In the app, depend on `"@asymm/jira-ui": "file:../../packages/asymm-jira-ui"`, and add `install-links=true` to `apps/cascadeplan/.npmrc`. npm then copies the package instead of linking it, so `react` and `@forge/react` resolve from the app's own `node_modules` (test-log #22 failed because of the link).
     - Remove the `paths` entries, or keep them only for the editor.
     - The reviewers must check this on a clean clone. I could not deploy, so this exact recipe has not been run.
  3. Rebuild `static/frontend/build/app.js` from the app's own `node_modules`, and commit it. Then `git status` must be clean after `npm run build` (test-log #9, #10).
  4. Add a CI job: clean clone, `npm ci` in the app and in `tools`, `tsc --noEmit`, `npm test -- --coverage`, `npm run build`, `git diff --exit-code static/frontend/build`, `forge lint`. Add `forge deploy` to development, or a bundling-only step if the CI has no Forge credentials.
  5. Add a build tag or the commit SHA to each deployment, so that the deployed build can be identified (report section 11).
- **Priority:** P0. Do it first: every other fix needs it. **Effort:** M.
- **Proof:** a clean clone deploys to development with no manual step. CI is green. Rebuilding gives an identical `app.js`.

### BL-9. Opening the planner can delete other users' planning data

- **Fix:**
  1. Remove the automatic call to `pruneStaleEntries` (`legacy-planner.js:1672-1674`).
  2. Delete records only when Jira says that the issue was deleted. Add a Forge product event trigger for the issue-deleted event (`avi:jira:deleted:issue`) in `manifest.yml`. Its handler deletes the issue's records in every plan of its project (and its shared date record under DEC-3). The trigger runs as the app, not as a user, so a user's permissions cannot cause a delete. The reviewers should check the event name and payload against the current Forge Jira events reference.
  3. For an issue moved to another project (the issue-updated event with a project change in the changelog), delete or re-key its records in the old project.
  4. Keep `staleEntries` in the response only to show a quiet "N planned issues are no longer visible to you" note. Never delete because of it.
  5. If a manual clean-up is still wanted, make it an approver-only action that confirms each issue with an app-scoped read (`asApp`), and logs what it deletes.
- **Priority:** P0. **Effort:** M.
- **Proof:**
  - R-18 rewritten: a 404 for the user deletes nothing.
  - A new unit test: the deleted-issue trigger handler removes the records in every plan.
  - Harness: opening the planner causes no KVS delete (add a delete counter to the fake storage in `harness/setup.ts`).
  - Live: delete a throw-away DEMO issue that has a plan record. Its record disappears. Opening the planner deletes nothing.

---

## 5. Findings

Findings already fixed by a blocker point to it. Each other finding has its own fix.

| ID | Problem (short) | Recommended fix | Pri | Effort | Proof |
|---|---|---|---|---|---|
| F-01 | No server-side authorization | BL-2 | P0 | (BL-2) | (BL-2) |
| F-02 | Public material describes absent features | BL-1 | P0 | (BL-1) | (BL-1) |
| F-03 | The plan returned after a write uses the Jira read taken before the write: the bar is drawn too short or too long, and Undo/Redo are corrupted | Patch the live read with the due dates that Jira accepted, before building the response. In `updateWbsTask` (`src/index.ts:1829`), `batchUpdateTasks` (`:1896`) and `continueCascade` (`:1933`), collect the keys whose due-date write is in the `SyncLog` with `ok: true`. Then pass a copy of `live` to `getProjectPlan` where `live.raw.issues[i].fields.duedate` is the written value. This needs no extra Jira call. A due date Jira rejected keeps the old value, which is correct (see F-19 for the KVS side). A re-read by key (`search/jql` with `key in (...)`) also works, but costs one Jira call per write. | P1 | S | R-30, R-31 rewritten (new start and new end returned). Harness R1c (length kept after the response), R2a, R2b. A new unit test where Jira already holds a due date, because the existing plan-isolation tests start with none. Live: repeat L2 and L3 on DEMO-29 (170 px kept at every step). |
| F-04 | A drag cannot be undone, and Cancel in the conflict dialog does not revert | Take the "before" snapshot when the drag starts (mousedown), before `task.startDate` and `task.endDate` change (`legacy-planner.js:4536-4537`). Pass it to `callResolver` (`:151-165`) as an explicit `before` option, so that `pendingUndo` (`:154`) does not take a snapshot of the changed plan. Keep `prevStart`/`prevEnd` with the drag, and have Cancel (`:4647-4654`) write those values and use the record version from the save it reverts. | P1 | M | Harness probe (`e2e_undo_probe.py`): the first drag offers Undo, and Ctrl+Z restores the dates. A new harness check: Cancel in the dependency dialog restores the old dates in KVS and Jira. |
| F-05 | Automatic prune deletes on a user-scoped 404 | BL-9 | P0 | (BL-9) | (BL-9) |
| F-06 | Default values are written to Jira | 1. Schedule from backlog: when the issue has a Jira due date, use it. When it has none, save a default span in KVS only, write no Jira due date, and draw the bar end with a "no due date in Jira" style until the user resizes the bar or sets an end. Remove `spanWeeks: 3` from the client calls (`legacy-planner.js:1835-1839, 3166-3171, 3889-3895, 4108-4114, 4163, 5582-5588`), and do not compute a due date on the server (`src/index.ts:1024, 1033-1036`) unless the user sent an end. 2. `createInlineTask`: the same rule (`legacy-planner.js:2899, 6289`; `src/index.ts:1186-1207`). 3. `createSubtaskForResource`: send no estimate and no due date when the fields are empty (`legacy-planner.js:5974`; `src/index.ts:2046-2048, 2146-2152`). 4. Progress: do not change the status (`src/index.ts:1579-1583`; `legacy-planner.js:6134-6139`). In the form, offer "Also move the issue to Done" as a checkbox when the progress is 100, unticked by default. | P0 (part of BL-3) | M | R-10 and R-13 rewritten. The BL-3 "no unrequested write" harness check. |
| F-07 | Jira writes run before the version check, and a conflict hides them | Order every write path the same way: validate, check permission (BL-2), check the version and write KVS, then write Jira. In `updateWbsTask`, move the link POST (`:1614`), the sub-task create (`:1655`) and the sub-task DELETE (`:1685`) after `putEntry` (`:1808`). Creates that must go to Jira first (a new issue) report the created issue in `jiraSync.writes` even when the KVS step fails, and `conflictResult` (`:451-457`) accepts the writes already done. | P1 | M | R-04, R-05, R-06, R-14 rewritten: on conflict, no Jira write happens, or the write that happened is listed. |
| F-08 | Status reported as written when no transition happened | In `syncTaskFields` (`src/index.ts:1447-1458`), push `status` into `sentFields` only when the transition POST returned 204. When no transition matched, put it into `rejected` with the message "No workflow transition to <status> from the current status". | P1 | S | R-08, R-09 rewritten. |
| F-09 | Personal data stored, and no reporting | BL-5 | P0 | (BL-5) | (BL-5) |
| F-10 | Lost updates across plans and in the restore step | DEC-3 Option A removes the cross-plan copy (R-01). DEC-4 Option A removes the restore race (R-02). With DEC-3 Option B, use the compare-and-set copy described there. | P1 | (DEC-3, DEC-4) | R-01 and R-02 rewritten: no lost update, or a reported conflict. |
| F-11 | Saving the form can unassign the issue | Always add the current assignee to the list, even when not in the first 50 (`src/index.ts:511`; `legacy-planner.js:5852-5861`). Send `resourceAccountId` only when the user changed the field (`:6100-6103`). Match people by account id, not by display name (FE section 16 item 6). | P1 | S | A new harness check: open and save the form of an issue whose assignee is not in the assignable list. Jira receives no assignee write. |
| F-12 | Three undefined functions in the bundle | Fix the names: use the imported `addDays` under its real name (`legacy-planner.js:5383-5392`), import `showErrorBanner` from `banner.ts` (`:6345`), and define `populateEpicDropdowns` or remove its call (`:6401`). Add `// @ts-check` and `checkJs` for `legacy-planner.js`, or an esbuild step that fails on undefined globals, so this cannot return. | P1 | S | A new harness check clicks the +/- 1 week buttons in the date editor and creates an epic. No page error. |
| F-13 | Create flows report success after a failed call | Normalise the result in one place: `bridge.ts:26-29` returns `{ ok: false, success: false, error, message }`, and every caller tests `ok !== true`. Fix the create flows (`legacy-planner.js:2903, 6292, 6386`), the schedule flows (M6) and the batch progress message (FE section 16 item 13). | P1 | S | A new harness check: make `invoke` throw. The form stays open, the summary is kept and no success text is shown. |
| F-14 | Build not reproducible | BL-8 | P0 | (BL-8) | (BL-8) |
| F-15 | A cycle through a second link passes validation | Make `validateDependency` (`src/domain/planner-engine.ts:176-177`) build the same graph that `cascade` uses: every active stored link plus the imported Jira "Blocks" links (`engineInputs`). Validate before any Jira write (F-07 order). For a cycle that already exists in Jira, make `cascade` report the cycle and move nothing, instead of throwing (`schedule-engine.ts:173`), so the other tasks still move. | P2 | M | R-15 rewritten. A new test: a plan with an existing Jira cycle still allows a move of a task outside the cycle. |
| F-16 | Baseline too large for one KVS value; shift list grows without bound | DEC-1 Option A takes this out of v1. For v1.1: store a baseline as a header key plus chunk keys of at most 200 tasks each, with only ids, dates and hours (no summary, no names). Store one key per shift request. | P2 (P3 under DEC-1 Option A) | M | R-27 rewritten: a 5,000-task baseline saves and loads. |
| F-17 | Batch and multi-plan writes are costly | DEC-3 Option A removes the per-plan scan. In `batchUpdateTasks` (`src/index.ts:1860-1908`), load the plan and entries once, apply all items in memory with their version checks, write the records, then build one response. `updateWbsTask` then takes the loaded state as a parameter, as it already takes `preloaded` live data. | P2 | M | R-28, R-29 re-measured. Target: a 50-item batch at 200 tasks makes at most 5 prefix queries. A timing test at 1,000 tasks stays under 10 s in the harness. |
| F-18 | Validation gaps | In `src/validation.ts`: refuse an end before the start; refuse dates outside today minus 5 years to today plus 10 years; validate `spanWeeks` (1 to 104), `startWeek` (a known week key), `effortHours` (0 to 10,000), `summary` (1 to 255 characters, trimmed) and `targetIndex` (whole number, 0 or more) in all four create and schedule resolvers. Return a validation result, never a `TypeError`. | P2 | S | R-21, R-22, R-23 rewritten. |
| F-19 | When Jira rejects a due date, KVS keeps the new dates | When the due-date write is rejected, put the target record back to the dates it had before this call (one more `putEntry` with the new version) and do not share the dates to other plans. Show on the bar and in the flag that Jira refused the date and why. | P2 | S | R-12 rewritten. Harness R8c: after reload, the bar keeps the old dates and its old length. |
| F-20 | Cascade successors skipped, and the multi-select remainder dropped | In `continueCascade` (`src/index.ts:1927-1929`) and `updateWbsTask`, return a skipped successor in a new `cascadeSkipped` list with the reason. Show it in the Changes panel as "not moved: changed by someone else; move it again". In `batchUpdateTasks` (`:1907`), merge the `cascadeRemaining` of each item, without duplicates, instead of returning `[]`, so that the client loop in `bridge.ts` continues the cascades. | P2 | S | R-07 rewritten. A new unit test for a batch whose items each have more than 25 successors. |
| F-21 | Silent failures, and no logs | Add a small logger that writes one line for each failed Jira or KVS call, with the resolver name, the issue key and the HTTP status (no summaries, no names, no account ids). Replace the 14 empty `catch {}` blocks in `src/index.ts` with a call to it. In `fetchRawIssues` (`:584`), return an `error` with the status, and show "Jira is not reachable" (status 5xx or a network error) or "You cannot browse this project" (403) instead of the empty-project text. Show "Licence required" on load (FE section 12). | P2 | M | A unit test for each state. `forge logs` shows a line after a forced failure in development. |
| F-22 | Orphaned and misplaced keys | `deleteProjectPlan` deletes the plan's baselines, active-baseline pointer and shift requests as well. Key baselines and shifts by project id, as D7 does for records (`baseline-repository.ts:16-30`), with a one-time migration from the project-key form. Give `createPlan` and `savePlans` a version check (store the plan list with a version and use `putEntry` semantics). | P2 (baseline parts P3 under DEC-1 Option A) | M | R-20 rewritten. A new test: two concurrent creates both survive, or one is refused with a message. |
| F-23 | Local sub-tasks hide the real Jira sub-tasks | In `mapLiveIssues` (`src/index.ts:761-763`), merge instead of replacing: show the live Jira sub-tasks, and add the stored local items that have no Jira key. Better, given D2 (Jira is the source of truth): stop storing local sub-tasks, and make `addSubtaskToTask` create a real Jira sub-task. Owner choice. I recommend the second option, because it removes a second source of truth. | P2 | M | R-26 rewritten. |
| F-24 | `checkPlanApprover` passes a project key as an issue key | Change `hasTier1AdminPermission` (`src/security/policy-admin.ts:49-58`) to take `{ issueId }` or `{ projectId }`, and call `mypermissions?projectId=<id>&permissions=ADMINISTER_PROJECTS,ADMINISTER` for plan-level checks. Read the project id only from the Forge context, never from `req.payload` (`src/index.ts:2647, 2655` use `req.payload?.projectKey` first). | P0 (needed by BL-2) | S | R-17 rewritten. A unit test: a project admin with no approver group is an approver. |
| F-25 | Progress formula differs from the spec | Follow spec 3.3 item 9 in `src/index.ts:728-736`. A leaf issue uses its own `timespent` divided by its own `timeoriginalestimate`. A parent uses `aggregatetimespent` divided by `aggregatetimeoriginalestimate`. Add `timespent` and `aggregatetimeoriginalestimate` to the search fields (`:581-582`). | P2 | S | A new unit test with a parent whose time is logged on sub-tasks. |
| F-26 | Other UI defects | See section 8 (FE items), one row each. | | | |
| F-27 | Projects with more than 1,000 issues | Keep the cap, but let the user choose the scope: add an optional JQL filter per plan (for example `fixVersion = 2.0` or `"Epic Link" = X`), validated by Jira itself, and combined as `project = X AND (<filter>)`. Show the cap message with a link to the filter. Load assignable users in pages (F-11). | P3 | M | A unit test: the filter goes into the JQL, and the truncation message names the filter. |
| F-28 | `reorderWbsTasks` returns ok after a lost race | Check the `putEntry` results (`src/index.ts:2019, 2026`). On a conflict, return `conflictResult`, so that the client reloads. | P3 | S | R-24 rewritten. |
| F-29 | The week grid starts on Wednesday; server dates are UTC | Align `generateDynamicWeeks` (`src/domain/planner-engine.ts:195-199`) to Monday, the same as the timeline header. For "today", let the client send its local date (`todayIso` at `src/index.ts:259` becomes a parameter with the UTC value as the fallback), and validate it as within one day of the server's UTC date. | P3 | S | A unit test of the week starts. A unit test with a client date of tomorrow (UTC+5:30 just after midnight). |
| F-30 | 13 files without the copyright header | Add "Copyright (c) 2026 Asymm Systems" and "@author Fahim Farook" to the 13 files in report F-30, and to `static/frontend/build/index.html` and `style.css` (FE section 14). Add a CI check that fails on any source file without both lines. | P3 | S | Re-run test-log #34. It finds 0 files. |
| F-31 | Maintainability | No single fix. Recommended path: (1) split `src/index.ts` by resolver group (plans, tasks, creates, governance, admin), with no change in behaviour, guarded by the existing 726 tests; (2) add tests for the governance resolvers before any v1.1 work; (3) one result shape for all resolvers (`{ ok, error?, message?, ... }`), with no thrown `Error` for validation (`:1606, 2244`); (4) move `legacy-planner.js` to TypeScript one feature at a time, starting with the drag and Undo paths that hold F-04 and F-12. | P3 | XL (spread over updates) | Coverage includes `src/frontend` for each part moved. |

---

## 6. Concurrency cases

| ID | Problem | Recommended fix | Pri | Effort | Proof |
|---|---|---|---|---|---|
| C1 | Same task, same plan | No fix needed. It works. Keep R-03 and harness R7. | | | |
| C2 | Same task, different plans: the plans diverge | DEC-3 Option A (one shared date record), or Option B (compare-and-set copy) | P1 | (DEC-3) | R-01 rewritten |
| C3 | A Jira due-date edit and a planner move at the same time | The client sends the Jira due date it saw (`expectedDueDate`) with each date change. The server compares it with its fresh read (already made at `src/index.ts:1537`), and refuses with a conflict when they differ ("DEMO-29's due date was changed in Jira a moment ago. Reload."). On load, mark a bar whose Jira end differs from the saved end with "changed in Jira", so the start that does not match is visible. | P2 | S | A new unit test: a different Jira due date gives a conflict and no write. |
| C4 | A cascade batch and a move of a successor at the same time | F-20 (report the skipped successor) | P2 | (F-20) | R-07 rewritten |
| C5 | Restore step overwrites a third writer | DEC-4 Option A | P1 or accepted risk | (DEC-4) | R-02 rewritten |
| C6 | KVS saved, Jira write failed | F-19 for a rejected due date. BL-2 removes the 403 case (no KVS write without permission). For 5xx and network errors, retry once in `withRetry` (`src/index.ts:128-143`) for idempotent PUTs only, then roll back as in F-19 | P2 | S | A new unit test: a 503 on PUT leaves KVS unchanged after the rollback |
| C7 | Jira write done, then the function times out | Short term (v1): F-13, so that the client never shows success. On an unknown result, reload and show "The result is unknown. Check the plan before you try again." Longer term: make creates idempotent. The client sends a create id. The server writes it as a Jira issue entity property in the create body, and on a retry searches for it before creating. That needs an indexed `jira:entityProperty` module, so leave it for later. | P2 (short term), P3 (idempotency) | S, then M | A harness check: a forced invoke timeout after the Jira create shows the "unknown" message and no success text |
| C8 | Plan deleted in another tab | Done, except `createInlineTask` (R-14). Run `writablePlanId` before the Jira create (BL-2 step 3) | P1 | S | R-14 rewritten |
| C9 | 50-item batch with partial failure | F-17 (cost). Show the per-item results in the Changes panel instead of the general "The change failed." (FE section 3, `batchUpdateTasks` row) | P2 | S | A harness check: a batch with one conflicting item lists that item and saves the others |
| C10 | KVS rate limit | Wrap the storage provider with a retry for the KVS rate-limit error, in the same way as `withRetry`: at most 3 tries, total wait under 20 s. The reviewers should check the error code that `@forge/kvs` throws. | P3 | S | A unit test with a fake storage that throws the rate-limit error twice |

---

## 7. Marketplace checklist and listing items

Items not already covered by a blocker:

| ID | Item | Recommended fix | Pri | Effort |
|---|---|---|---|---|
| MK-01 | Runs on Atlassian: `forge eligibility` not run | Run it after BL-8, and keep the output in the release evidence | P0 | S |
| MK-02 | Security questionnaires, partner questionnaire | Fill in after BL-2, so the answers can say that every write is checked against Jira permissions. Remove the retired "Security Self-Assessment" row from `docs/marketplace/developer-console-checklist.md` | P0 | M (owner's sign-in) |
| MK-03 | Pricing differs (251+ tier: listing $0.60, checklist and FAQ $0.90) | Choose one price, and make the listing, the checklist, the FAQ and the Developer Console pricing page say the same | P0 | S |
| MK-04 | Scope justifications cite absent features | Rewrite the justifications in the submission notes section 1 for the features that exist: `read:jira-work` (read issues, links, transitions, permissions), `write:jira-work` (due date, estimate, assignee, links, sub-tasks, transitions the user chooses), `read:jira-user` (assignable users; group search for plan approvers), `storage:app` (plan records) | P0 | S |
| MK-05 | Other open rows of `developer-console-checklist.md` | Correct the production-install row and the review-time row against `marketplace-research.md` Section C | P2 | S |
| MK-06 | "Smooth 60 fps on thousands of tasks" not measured | Measure it (report section 11, performance row), or remove the number. Recommendation: remove it for v1 and add it back when measured | P1 | S (remove) |
| MK-07 | "Zero accessibility violations" not measured | Run axe on the harness page in light and dark themes. Fix the findings (section 8, FE accessibility rows), or change the text to "Built to WCAG 2.2 AA. Report accessibility problems to support." Do not claim zero without a result | P1 | S (text), M (axe and fixes) |
| MK-08 | Licensing not tested live | After approval, install from production on a test site with an evaluation licence. Check that an active licence works and that a cancelled licence shows "Licence required" on load (F-21) | P1 | S (owner) |
| MK-09 | `'unsafe-inline'` styles | Allowed. Optional: move the 183 inline `style="..."` attributes to classes and drop the permission (FE section 2) | P3 | M |

---

## 8. Frontend items not covered above

The source is `frontend-review.md`. H1 to H3 are covered by F-06, H4 by F-13, H5 by F-04, H6 by F-05 (BL-9), H7 by F-11, H8 by F-12, M2 by F-21 and M5 by F-20.

| ID | Problem | Recommended fix | Pri | Effort | Proof |
|---|---|---|---|---|---|
| H9 | `createInlineTask` creates the Jira issue before the plan check | Run `writablePlanId` first (BL-2 step 3). Show the message, not the raw code (M7) | P1 | S | R-14 rewritten |
| M1 | A keyboard move into a conflict: "Keep" saves nothing | Make the keyboard path save the move first and then open the dialog, the same as the mouse path. Or make "Keep" call the save. Share one handler for both paths (`legacy-planner.js:4882-4951, 4642-4645`) | P2 | S | A harness check: a keyboard move into a conflict, then Keep, saves the move |
| M3 | `MAX_CASCADE_ROUNDS` limits nothing | Make the loop in `bridge.ts:37-42` iterative, with one counter for the whole cascade, instead of a recursive `callResolver`. Stop at the cap with "The cascade did not finish. Move the task again to continue." | P2 | S | A unit test with a fake resolver that always returns remaining keys stops at 40 |
| M4 | A dependency on a backlog task is dropped on Save | List backlog tasks in the predecessor list, marked "(not scheduled)" (`legacy-planner.js:5902-5912`). Send the dependency field only when the user changed it (`:6159-6165`) | P2 | S | A harness check: save the form of a task with a backlog predecessor. The link is kept |
| M6 | Schedule flows show success after a failure | Test `ok` (F-13) in the four schedule handlers (`legacy-planner.js:1841-1847, 3173-3179, 5589-5595`). Better, merge the four copies into one function (FE section 15) | P2 | S | A harness check with a forced conflict on schedule |
| M7 | Raw codes ("conflict", "validation", "license_required") shown to users | Always show `message` when present. Keep a fixed map from code to plain text as the fallback (`legacy-planner.js:6177-6180, 2904, 6294, 6388`; `result.ts:24`) | P2 | S | A unit test for `result.ts`. A harness check with a forced conflict in the form |
| M8 | Undo overwrites a colleague's later edit | Undo sends the version from the moment the entry was made (the "after" version), not the current version (`legacy-planner.js:197, 201`). A conflict then says "DEMO-29 was changed after your edit. Undo was not applied." | P2 | S | A harness check: two tabs, edit in tab 1, edit the same task in tab 2, Undo in tab 1 is refused |
| M9 | Undo of a cascade stops at the first failure, and the entry is already on the redo stack | Move the entry to the redo stack only when every operation succeeded. On a partial failure, keep it on the undo stack with the operations that remain, and report which tasks were not restored (`legacy-planner.js:203-208`; `undo-stack.ts:29-33`) | P2 | S | A unit test for `undo-stack.ts` |
| FE section 3 | 13 `updateWbsTask` calls send no `expectedVersion` (last writer wins) | Send the version of the task the user edited from each call site listed (`legacy-planner.js:690, 706, 721, 763, 778, 800, 2317, 2568, 2616, 2646, 3639, 3688, 197`). Consider making `expectedVersion` required on the server for user edits | P2 | S | A unit test: the server refuses a user edit without a version (if made required) |
| FE section 3 | Dead try/catch blocks around `callResolver` | Remove them after F-13 makes the result handling consistent | P3 | S | Code review |
| FE section 5 | localStorage keys not scoped to the site; plan scope falls back to the project key alone; a malformed stored plan id is never cleared | Prefix every key with the cloud id (`cascadeplan_hidden_cols_`, `cascadeplan_zoom`, `cascadeplan_enforce_deps`, `cascadeplan_shortcuts`, `cascadeplan_hint_link`). When the stored plan id fails validation, delete it and open the Main Plan. Remove the dead hidden-columns cache | P3 | S | A unit test for `plan-view-state.ts` with a malformed id |
| FE section 6 | The Undo button of an old flag undoes the newest action | Bind each flag's Undo to its own entry id. When that entry is not the newest, disable the button or say "Undo the newer change first" (`legacy-planner.js:176`) | P2 | S | A harness check: two actions, Undo on the first flag |
| FE section 6 | Two actions merged into one Undo entry | Settle `pendingUndo` on every path that shows a result (`legacy-planner.js:1842-1843, 3174-3175, 5590-5591`), or start a fresh snapshot for each write | P2 | S | A harness check: two schedules, one Undo reverts one |
| FE section 6 | Redo of a schedule writes a default due date first (`spanWeeks \|\| 1`) | Replay a schedule as one `scheduleBacklogTask` call with the recorded dates, and no `updateWbsTask` afterwards (`legacy-planner.js:195-197`) | P2 | S | The BL-3 "no unrequested write" harness check covers Undo and Redo |
| FE section 6 | `replayingUndo` is global; a parent roll-up may not be restored (Uncertain) | Queue user writes made during a replay instead of skipping their Undo record. Add a unit test for `undo-plan.ts` with a successor that is also a Jira parent, to settle the uncertain case | P3 | S | The new unit test |
| FE section 7 | The collapse state is lost on a plan switch or reload | Keep the collapsed set per project in `sessionStorage` (wrapped in try/catch), and do not delete keys that are missing in the new plan | P3 | S | Harness 4a to 4g, extended with a reload |
| FE section 9 | Hours parsed differently (`parseInt` against `Math.round`) | One parser: decimal hours rounded to 0.25, used at `legacy-planner.js:2885, 3685, 6254, 6079` | P3 | S | A unit test for the parser |
| FE section 9 | Trigger 30 as the default when the field is empty | Require the user to choose a trigger when they choose a predecessor, or default to 100 (finish to start, the Jira meaning of "blocks") and show it | P3 | S | A harness check of the form |
| FE section 11 | Modals have no dialog role, no focus move, no focus trap and no focus return | Add `role="dialog"`, `aria-modal="true"` and `aria-labelledby` (`index.html:414, 615, 656`). Move focus to the first field on open. Trap Tab inside. Return focus to the opener on close | P1 (for MK-07) | M | axe run. A keyboard-only harness check |
| FE section 11 | The treegrid has no expand or collapse key | ArrowRight expands and ArrowLeft collapses when focus is on a row with children (ARIA treegrid pattern), in `keyboard-grid.ts` | P2 | S | A unit test for `keyboard-grid.ts` |
| FE section 11 | Targets below 24x24 px; no labels on the resource checkboxes; the error banner has no `role="alert"`; icon-only buttons use `title` only; the delete confirmation reverts after 4 s; focus styles not checked | Make the targets 24x24 (`style.css` rules listed in FE section 11). Add `<label>` or `aria-label`. Add `role="alert"` to `plannerErrorBanner`. Add `aria-label` to the icon buttons. Keep the delete confirmation until the user acts or presses Escape. Check each `outline: none` for a visible replacement | P2 | M | axe run. A contrast check in both themes |
| FE section 11 | The keyboard cannot change only the start; the bar toolbar opens only on a click | Add a key for start minus and plus (for example Shift+[ and Shift+]). Open the bar toolbar on Enter or Space when the bar has focus | P3 | S | A unit test for `keyboard-grid.ts` |
| FE section 12 | The empty backlog text promises "drag from timeline to unmap", which does not work | Change the text to the action that works (the Unschedule action). Or make the drop work: the drop handler exists, but no dragstart sets `fromTimeline` | P3 | S | Harness |
| FE section 13 | Hard-coded fallback `https://asymmsystems.atlassian.net`; the issue key is not URL-encoded at line 117 | Remove the fallback (`legacy-planner.js:99`). When no site URL is known, use `router.open` only, and disable middle-click links. Encode the key with `encodeURIComponent` | P2 | S | A unit test of the URL helper with no site URL |
| FE section 15 | Dead code, unused imports and exports, duplicated handlers, `any` | Remove the dead code listed in FE section 15. Merge the four backlog-drop handlers and the two pickers. Type the `any` sites in the TypeScript files | P3 | M | `tsc`, tests and harness all pass |
| FE section 16, item 4 | The conflict dialog opens even when the write failed | Open it only when the write returned `ok` (`legacy-planner.js:4557`) | P2 | S | A harness check |
| FE section 16, item 7 | `syncTaskResources` changes the task in memory before the call and never rolls back | Apply the change after the call succeeds, or roll it back on failure (`legacy-planner.js:2307-2309`) | P3 | S | A harness check with a rejected assignee |
| FE section 16, item 8 | A plan rename can be sent twice (Enter and then blur) | A `done` flag in `finish` (`legacy-planner.js:1555-1559`), so it runs once | P3 | S | A harness check |
| FE section 16, item 9 | `JSON.parse` of dropped text without try/catch | Wrap the parse, and ignore drops that are not from the app (`legacy-planner.js:4104, 4159`) | P3 | S | A harness check that drops plain text |
| FE section 16, item 10 | `currentPlan.weeks.find` without a guard | Guard it, and show the load error when there are no weeks (`legacy-planner.js:2751`) | P3 | S | A unit or harness check |
| FE section 16, item 11 | `[` can move the end before the start | Stop at a one-day bar and announce "The end cannot be before the start" (`keyboard-grid.ts:65`) | P3 | S | A unit test |
| FE section 16, item 12 | Plans named with "main", "actual" or "baseline" are called baselines | BL-1 step 6 | P0 | (BL-1) | |
| FE section 16, item 13 | Batch progress announces success after a failure | F-13 | P2 | (F-13) | |

---

## 9. New item found while writing this plan

**N-01. Planner resolvers trust the project key from the payload when the Forge context has no project.** Confirmed by reading only. Not executed.

- Both modules (`jira:projectPage` and `jira:adminPage`) use the same function `resolver` (`manifest.yml:7-8, 13-14`), so every resolver can be called from the admin page.
- The admin page has no project in its context. There, `extractProjectKey` (`src/index.ts:2399-2406`) uses `req.payload.projectKey`, and `"DEMO"` when the payload has none. `extractProjectId` returns undefined, so records are keyed by the project key.
- `checkPlanApprover` and `authority-check` read `req.payload?.projectKey` first, even on the project page (`:2647, 2655`).
- Effect: a user who can open the admin page (normally a Jira administrator) can call planner write resolvers for any project key. The writes go to key-based records, which no planner page reads. The Jira writes still run as that user, with that user's Jira permissions. The risk is low, but the code gives no project isolation in this path.
- **Recommended fix:**
  1. Give the admin page its own function (for example `admin-resolver`), with only the approver-policy resolvers.
  2. In the planner function, refuse every call that has no `context.extension.project.id`, and remove the payload and `"DEMO"` fallbacks.
  3. Read the project only from the context in `checkPlanApprover`.
- **Priority:** P1 (part of BL-2). **Effort:** S.
- **Proof:** new unit tests. A planner resolver called without a project context is refused. The admin function does not define planner resolvers.

---

## 10. Release gate after the fixes

Run all of these again on the fixed commit before submission, and keep the results:

1. Clean clone. `npm ci` in the app and in `tools`. `tsc --noEmit`. `npm test -- --coverage` (thresholds 90). `npm run build` with no diff. `forge lint`. (BL-8)
2. The review tests, with every FINDING test rewritten as a regression test (section 1.3): all 32 pass.
3. Harness: `e2e.py` (30 checks) and `e2e_review.py` (25 checks), plus the new checks named in this plan. All pass, with no page error.
4. `forge deploy -e development` from the clean clone, with a build tag.
5. Live on DEMO:
   - repeat L1 to L6;
   - repeat L2 and L3 with the bar length kept at every step;
   - the BL-2 test with a Browse-only user;
   - the BL-9 delete test;
   - the "no unrequested write" session against Jira history.
6. `forge eligibility`. Check the app name on the install, consent and Connected apps screens. Re-run the URL check. Re-run the claims audit. Check the media sizes.
7. The rows of report section 11 that the owner can now run: Developer Console checks, licensing on a production install, axe and a screen-reader pass, browsers other than Chrome, performance at 1,000 issues.
8. A second independent review of the changed code. Reviews run in several rounds. Do not treat one green round as "ready to merge".

---

## 11. Items with no fix, and why

| Item | Reason |
|---|---|
| C1 (same task, same plan) | Works as expected (R-03, harness R7). |
| D10 (canvas plus treegrid) | The design is sound. Only the accessibility gaps in section 8 need work. |
| D4, D5, D7, D12 | Sound as implemented. D5 persistence and D12 live licensing are covered by the FE section 7 row and MK-08. |
| INV-01 (XSS) | Holds (FE section 1). No change. Keep the `html` tagged template as the only way to write HTML. |
| Report section 11 "Not run" rows | These are missing checks, not defects. They are in the release gate (section 10, step 7). |
