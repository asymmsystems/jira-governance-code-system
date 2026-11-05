# Independent review of the CascadePlan fix plan

- **Reviewer:** second, independent review session, 2026-11-05.
- **Document under review:** `/home/fahimfarookme/.cache/gemini-earning-cascadeplan-marketplace-review/fix-plan.md` (called `fix-plan.md` below).
- **Sources of the problems:** `report.md` and `frontend-review.md` in the same folder.
- **Code:** commit `db080096007208d2cad97f79c620d49964aa05c9`. Paths are relative to `apps/cascadeplan/` unless they start with `packages/` or `docs/`. My clone is `/home/fahimfarookme/.cache/gemini-earning-cascadeplan-fixplan-review/checkout-claude`. `test-log.md` section 1 explains why it is not at `.../checkout`.
- **My tests:** `tests/fixplan-gaps.test.ts` in this folder (6 tests, all pass at `db08009`). A "GAP" test passes while the code has the behaviour. It shows a code path that a fix in `fix-plan.md` does not name.
- **Commands and results:** `test-log.md` in this folder.
- **Status:** a report for the owner (Fahim Farook). Nothing in the product was changed.

---

## 1. Summary

`fix-plan.md` is sound in direction. Its priorities mostly match the evidence, and its order of phases is workable. I checked 10 of its P0 and P1 findings in the code, and all 10 are real.

But four of its fixes are incomplete in ways that would leave the same defect in place after the fix:

- F-03: patching only the final response does not fix batches (GAP FX-01).
- F-07: the list of early Jira writes misses two paths (GAP FX-02, FX-03).
- BL-8: the package recipe fails on a clean clone, because `dist` is ignored by git (test-log rows 19 and 20).
- BL-9: the trigger design misses records stored under the issue key (GAP FX-05).

Several documentation claims that the plan marked as unverified are now confirmed: the bulk permission check, `SCHEDULE_ISSUES` for due dates, conditional writes only on custom entities, and the end of Cloud Fortified. One claim changes a design choice: the Jira search API is eventually consistent, and it has a `reconcileIssues` parameter.

DEC-3 lacks one option that deserves the owner's attention: store the shared start date as a Jira issue property.

The release gate cannot tell "nothing fixed" from "everything fixed". As written, "all 32 review tests pass" is true in both cases.

**The three most important changes I recommend:**

1. **F-03 and F-17: fix the stale read where it is used, not only in the response.**
   - In `batchUpdateTasks` (`src/index.ts:1884`), every item reuses one Jira read. A later item then computes cascades from due dates that an earlier item already changed. It writes wrong dates to KVS and Jira, and the error survives a reload (GAP FX-01, with control FX-01b).
   - Also pass `reconcileIssues` (at most 50 issue ids) on each Jira search that follows a write. The search is documented as eventually consistent (section 3, row 10).
   - Raise F-17 to P1 and do it in phase 2 together with F-03.
2. **BL-8: make the package build part of `npm ci`, or commit the built files.**
   - The recipe works with npm only when `packages/asymm-jira-ui/dist` exists (test-log rows 13 to 17).
   - The root `.gitignore` ignores `dist`, so a clean clone has none. `npm ci` then succeeds silently and bundling fails (test-log rows 19 and 20).
   - Use a `prepare` script, which npm runs for this kind of dependency (test-log row 18). Or commit `dist` with a `.gitignore` exception. And note that the change touches all four apps.
3. **Release gate (section 10 of `fix-plan.md`): make it able to fail.**
   - Require that no test name still contains "FINDING".
   - Add a migration rehearsal on a copy of pre-migration data.
   - Add a measured cost check at 1,000 issues: under 25 s per call, and within the KVS per-minute quota (section 3, row 4).

---

## 2. Verdict table

Priority and effort columns are filled only where I differ from `fix-plan.md`. "FX-nn" are my tests in `tests/fixplan-gaps.test.ts`. URLs were fetched on 2026-11-05.

### 2.1 Blockers

| ID | Verdict | Change or reason | Pri / effort | Evidence |
|---|---|---|---|---|
| BL-1 | Agree with change | (1) The proof "every resolver that remains defined has a UI caller" fails with the plan's own step 5. These stay defined with no UI caller: `getProjectPlans` (`src/index.ts:2586`), `authority-policy-get`, `authority-policy-set`, `authority-group-search` (`:2642-2644`), `checkPlanApprover` (`:2646`) and `authority-check` (`:2654`). Remove them as well, or keep `checkPlanApprover` only if BL-2 step 8 gives it a UI caller. Then restate the proof. (2) The proof says "the five governance resolvers", but step 5 lists six governance resolvers plus three others. (3) Move step 5 (removing the resolvers, effort S) into phase 2, before BL-2, so the permission table of BL-2 has fewer rows. (4) The step 5 line numbers are correct. The test "expects no such resolver" must expect a thrown error: `@forge/resolver` 2.0.2 throws `Resolver has no definition for 'X'` (`node_modules/@forge/resolver/out/index.js`, `getFunction`). | - | `src/index.ts:2585-2661`; `frontend-review.md` section 3, "Never called from any frontend file" |
| BL-2 | Agree with change | (1) "Apply it in `withResolverHandler`, so no resolver can skip it" is not true as written. Besides the `updateWbsTask` wrapper, the six policy resolvers and the two approver checks (`src/index.ts:2638-2661`) do not use `withResolverHandler`. Route every `resolver.define` through one wrapper that takes the resolver name. (2) Step 3: a `CREATE_ISSUES` pre-check is not needed. Jira refuses the create as the user, and `createInlineTask` writes KVS only after a 201 (`:1152-1189`). Keep the other part of step 3: run `writablePlanId` before the Jira create. (3) Bulk check, confirmed in docs: it works as the user without `accountId`, takes issue ids (not keys), accepts at most 1,000 issues, ignores invalid ids, and returns only the ids the user has. So an id missing from the answer must count as "denied". (4) Step 2, confirmed: Jira needs `SCHEDULE_ISSUES` to set a due date. (5) `createSubtaskForResource` also writes the parent's record (`:2139`), so it needs `EDIT_ISSUES` on the parent. | - | Section 3 rows 2a to 2c; `src/index.ts:2599-2661`, `:1152-1189`, `:2139` |
| BL-3 | Agree | The plan closes this through F-03, F-06 and F-11. My changes to those items apply here as well. The "no unrequested write" harness check is a good proof, because it fails on any write the script did not enter. | - | `src/index.ts:1024, 1579-1583, 2046-2048` |
| BL-4 | Agree with change | (1) Partner Agreement 8.4(e) asks for four things. The plan's list covers what is processed and who is responsible. It must also state (2) "with whom you share End User Data" (say: no third party) and (3) "in which country or countries" the data is stored. "The customer's data residency region" alone does not name a country, so list the countries or regions. Also say that Asymm Systems, not Atlassian, is responsible. (2) Terms: the standard agreement exists. It is drafted by Bonterms, and you choose it per app version on the Links tab ("Use a standard agreement as your End User License Agreement for this version?"). (3) The plan says the owner's rule against riba-based late fees "has no effect" on it. That is not verified: I did not read the Bonterms text. The owner should read its fee and late-payment clauses before choosing it. (4) Uninstall as the deletion method is not verified: I did not check what Forge does with app storage after an uninstall. | - | Section 3 rows 6a to 6c |
| BL-5 | Agree with change | (1) The migration "drop the account id fields" has no rule for contributors without a `subtaskKey`. These exist when the sub-task create failed (`src/index.ts:1644-1673` keeps the contributor without a key) and for legacy names. Decide: create the sub-task, keep a non-personal marker, or drop the contributor and report it. (2) The proof's "account id pattern" must match both forms: 24 hex characters, and `<digits>:<uuid>`. (3) The live assignee comes from the project search, which stops at 1,000 issues (`MAX_PAGES`, `:561`). A contributor whose sub-task is outside that window shows no name. | - | `src/index.ts:1632-1678`; `src/domain/models.ts:459-462` |
| BL-6 | Agree | Confirmed in docs. Cloud Fortified stopped taking submissions on 2 Sep 2026 and retires on 31 Dec 2026. Runs on Atlassian is "automatically applied". There is no "Data Residency" badge. Forge covers up to 20% of ISO 27001 and 30% of SOC 2. `forge eligibility` checks the deployed version. | - | Section 3 row 7 |
| BL-7 | Agree with change | (1) Confirmed in docs: the app name is changed in the Developer Console app settings. (2) Not confirmed: which name the install and consent screens show. Only community reports exist, saying that production consent screens kept the old name until developer support changed it. Keep the screen checks in the proof, and allow time for a support request. (3) Step 6: do not rename the storage keys `planshift:cfg:approver_policy` (`src/storage/policy-repository.ts:22`, read as a fallback) or the `ps:` prefixes. They hold data, not user-facing text. | - | Section 3 row 5 |
| BL-8 | Agree with change | I ran the recipe with npm only. It resolves when `dist` exists: one copy of `react` and `@forge/react` from the app, types without `paths`, bundling resolves, a clean `npm ci` works, 764 tests pass, and `forge lint` is clean (test-log rows 12 to 17). But: (1) the root `.gitignore` line 3 ignores `dist`, so a clean clone has no `packages/asymm-jira-ui/dist`. `npm ci` then exits 0 and bundling fails with `Could not resolve "@asymm/jira-ui"` (rows 19, 20). (2) A stale `dist` is used silently after a source change (row 18). (3) `jest.config.js` maps `@asymm/jira-ui` to `src`, so the tests and the bundle can run different code. (4) npm runs the dependency's `prepare` script under `install-links=true` (row 18), so `"prepare": "tsc -p ."` can build `dist` during `npm ci`. That needs TypeScript and the React types to be resolvable from `packages/asymm-jira-ui`, which today come from `apps/fourrealities/node_modules` (`packages/asymm-jira-ui/tsconfig.json`). The alternative is to commit `dist` with a `!packages/*/dist` exception, plus a CI check that `dist` matches `src`. (5) All four apps map the package (test-log row 27), so state the effect on DefinitionGuard, LedgerSeal and FourRealities. (6) The CI step "forge deploy, or a bundling-only step": `forge build` uploads, so it is not a local check. | P0 / M to L | test-log rows 12 to 21, 27 |
| BL-9 | Agree with change | (1) The trigger handler must find records under both key forms. A record can be stored as `cp:<pid>:we:<issueKey>` with `issueId` equal to the key (GAP FX-05; `src/storage/plan-store.ts:99, 120`; `src/index.ts:427`). Match by the issue id or the issue key from the event, in every plan. (2) The events reference names the `issue` object but does not define its fields, so check on a development site that the payload has the issue id, the key and the project id. (3) Events can take up to 3 minutes, and an app can ask for up to 4 retries, so the handler must be idempotent. Deleting a missing key is safe. The live proof must wait for delivery. (4) Step 3 (issue moved to another project): records are keyed by issue id under the old project id, and after step 4 nothing reads them, so they are harmless orphans. Move step 3 to P3. (5) Step 5's `asApp` read: "asApp gives access to all data it has permissions for". Whether issue security levels hide issues from the app user is not verified. | - | GAP FX-05; section 3 row 1 |

### 2.2 Findings

| ID | Verdict | Change or reason | Pri / effort | Evidence |
|---|---|---|---|---|
| F-01 | Agree | Covered by BL-2. Confirmed by reading: create, delete and rename plan (`src/index.ts:2340-2393`) and `reviewScopeShift` (`:2542-2564`) check nothing. | - | `src/index.ts:2340-2393, 2542-2564` |
| F-02 | Agree | Covered by BL-1. | - | - |
| F-03 | Agree with change | The cause is right, but the fix is incomplete. (1) In `batchUpdateTasks`, every item reuses the `live` read from `:1878` (`:1884`). An item that follows a cascade sees the cascaded tasks with their OLD Jira end (`mapLiveIssues` `:782-784`). It then stores and writes wrong dates (GAP FX-01: C stored and sent to Jira as a one-day bar; CONTROL FX-01b: separate calls are correct). Patch the shared `live` after each item, or apply all items to one in-memory state (F-17). (2) The plan's alternative "re-read by key with `search/jql`" is not reliable. Jira documents the search as eventually consistent ("The delay might vary from a few seconds to minutes") unless `reconcileIssues` (at most 50 ids) is passed. (3) The same lag can affect every resolver that reads Jira again after a write: `scheduleBacklogTask` (`:1038`), `createInlineTask` (`:1210`), `createSubtaskForResource` (`:2154`), `unscheduleTask` (`:1986`), and the next round of `continueCascade` (`:1918`), whose cascade input can then hold old ends. The code already knows about the lag (`:617-619`). Pass `reconcileIssues` with the ids just written, and in `continueCascade` with the ids of the cascade chain. (4) The proposed "new unit test where Jira already holds a due date" already exists as R-30. Add FX-01 as a proof. | P1 / M | GAP FX-01, FX-01b; section 3 row 10 |
| F-04 | Agree with change | Take the "before" snapshot just before the optimistic change at `legacy-planner.js:4536` (on drop), not on mousedown. A snapshot on every mousedown copies the whole plan even for plain clicks. The rest is right: `applyConflictCancel` (`:4647-4654`) writes `conflictState.task.startDate`, which is already the new date. | - | `legacy-planner.js:4534-4545, 4647-4654` |
| F-05 | Agree | Covered by BL-9. Confirmed: `src/index.ts:1850-1853`, `legacy-planner.js:1672-1674`. | - | - |
| F-06 | Agree | Confirmed at every cited line, including the client status change at `legacy-planner.js:6134-6139`, which must change together with the server change. One addition: the Redo path sends `spanWeeks || 1` (`legacy-planner.js:195`). The FE section 6 row covers it. | - | cited lines |
| F-07 | Agree with change | Two more Jira writes run before `putEntry` and are hidden on a conflict: the DELETE of an owned link (`src/index.ts:1624`, GAP FX-02) and the "unassign" PUT of a contributor sub-task (`:1691`, GAP FX-03). Add them. Also say how the data that Jira returns reaches KVS once Jira runs second: the link id (`:1618-1619`) and the sub-task key (`:1662`) are stored in the record. This needs a second `putEntry` after the Jira write, or a record that is first written as "pending". Under DEC-4 Option A, a transaction can cover both. | P1 / M to L | GAP FX-02, FX-03 |
| F-08 | Agree with change | (1) Also mark `status` as not written when the transition GET fails or the POST returns anything but 204 (R-09 covers this). (2) `syncTaskToJira` logs every `rejected` field with the fixed message "Jira did not accept the due date on this issue screen" (`src/index.ts:1308`). With `status` in `rejected`, the user would read a due-date message. Give each field its own message. | - | `src/index.ts:1304-1311, 1433-1459` |
| F-09 | Agree | Covered by BL-5. | - | - |
| F-10 | Agree | Depends on DEC-3 and DEC-4. | - | - |
| F-11 | Agree with change | The middle step "send `resourceAccountId` only when the user changed the field" is already what `legacy-planner.js:6100-6103` does: it compares the chosen name with `curTask.resource`. The defect is that the select shows "Unassigned" when the current assignee is not in the list, so the compare reports a change (`:5852-5861`). Keep steps 1 and 3 (always list the current assignee, match by account id). Replace step 2 with "track whether the user touched the control". | - | `legacy-planner.js:5852-5861, 6100-6103`; `src/index.ts:511` |
| F-12 | Agree | Confirmed: `addDays` is imported as `addDaysIso` (`legacy-planner.js:48`), and the bare `addDays` is called at `:5383-5392`. "Use the imported addDays under its real name" means `addDaysIso`. | - | `legacy-planner.js:18, 48, 5383-5392, 6345, 6401` |
| F-13 | Agree with change | Before callers test `ok !== true`, make every resolver return `ok`. `getProjectPlan` returns a plan with no `ok` field (`src/index.ts:960-983`), and the `updateWbsTask` wrapper returns `{ success: false, error }` with no `ok` (`:2606`). Otherwise a success is read as a failure. Also add `addSubtaskToTask`, whose result is not inspected at all (`frontend-review.md` section 3). | - | `bridge.ts:24-29`; `src/index.ts:2599-2608` |
| F-14 | Agree | Covered by BL-8. | - | - |
| F-15 | Agree | `validateDependency` follows only `dependency` (`src/domain/planner-engine.ts:176-177`). Using the same graph as `engineInputs` is correct. | - | - |
| F-16 | Agree | P3 under DEC-1 Option A. | - | - |
| F-17 | Agree with change | Raise the priority and move it to phase 2 with F-03. (1) Its "load once, apply in memory" design is also the fix for GAP FX-01. (2) The report's limits arithmetic (`report.md` section 5, "Rate ... is not the binding limit") leaves out the per-minute KVS quota: 4,000 reads per minute per installation in "10KB request" units. A 50-item batch at 200 tasks made 151 prefix queries over 30,200 rows (R-29). Counted per page, that is several hundred units. Counted by response size, it is several thousand. The docs do not define how a query page is counted, so this is Plausible and must be measured. (3) Keep the plan's targets, and add "within the KVS quota". | P1 / M | section 3 row 4; R-29 |
| F-18 | Agree | After F-06, the client no longer sends `spanWeeks`, but the server must still validate it. | - | - |
| F-19 | Agree with change | The rollback must also cover the copies already written to other plans. `shareDatesAndLog` runs before the Jira write (`src/index.ts:1823` before `:1827`). It must also cover cascade successors whose due dates Jira did accept. Better: share and cascade only after Jira accepted the target's due date. The rollback `putEntry` can itself meet a conflict, so define what the user sees then. | - | `src/index.ts:1807-1827` |
| F-20 | Agree | The line for `batchUpdateTasks` is `:1900` (`cascadeRemaining: []`), not `:1907`. The function is `:1865-1901`. | - | `src/index.ts:1900, 1929` |
| F-21 | Agree | 14 empty `catch {}` confirmed (test-log row 25). | - | - |
| F-22 | Agree with change | Add the cost of `createPlan` and `deletePlan`. Both loop over every record in one call (`src/storage/plan-store.ts:182, 203`), which at 1,000 records risks the 25 s limit and leaves a half-cloned plan (`report.md` section 5, "Clone"). That problem has no fix anywhere in `fix-plan.md`. | - | `src/storage/plan-store.ts:165-208` |
| F-23 | Agree with change | With the second option (a real Jira sub-task), drop the 8 h default estimate that the client sends when the field is empty (`frontend-review.md` section 9, `legacy-planner.js:5952`). Otherwise it becomes a new unrequested Jira write (BL-3). | - | - |
| F-24 | Agree | Confirmed: `isPlanApprover(storage, req.payload?.projectKey || ...)` (`src/index.ts:2647`) gives `mypermissions?issueKey=DEMO` (`src/security/policy-admin.ts:54`). Docs: `mypermissions` accepts `projectId` and returns 404 for an issue it cannot find. Add: `hasTier1AdminPermission` without an argument (`:55`) asks with no project, so the fixed function must refuse to run without a project id. | - | section 3 row 2d |
| F-25 | Agree | `src/index.ts:728-736` divides `aggregatetimespent` by the issue's own estimate. | - | - |
| F-26 | Agree | Pointer to `fix-plan.md` section 8. | - | - |
| F-27 | Agree | P3. | - | - |
| F-28 | Agree | `src/index.ts:2019, 2026` ignore the `putEntry` result. | - | - |
| F-29 | Agree with change | Moving the weeks from Wednesday to Monday changes every `weekKey`. A key is the start day and month of the week, for example `04-Nov` (`src/domain/planner-engine.ts:213`). Stored `startWeek`, `endWeek` and `weeklyAllocations` keys then match no week (`planner-engine.ts:111, 311`; `src/index.ts:645, 1003`). Recompute them from the stored dates in a migration, or derive the grid from dates on read. | P3 / M | `src/domain/planner-engine.ts:195-215` |
| F-30 | Agree | The same 13 files were found (test-log row 26). | - | - |
| F-31 | Agree | - | - | - |

### 2.3 Concurrency cases

| ID | Verdict | Change or reason | Pri / effort | Evidence |
|---|---|---|---|---|
| C1 | Agree | R-03 reproduced (32/32). | - | test-log row 9 |
| C2 | Agree | Depends on DEC-3. | - | - |
| C3 | Agree with change | The server's "fresh read" is the `search/jql` read (`src/index.ts:1537`), which is eventually consistent. A due date changed in Jira a few seconds earlier may not show, so the check misses exactly the race it is meant to catch. Compare against a read that is consistent for this issue: `reconcileIssues` with the issue id, or a direct issue GET. Whether the direct GET is immediately consistent is not documented. | - | section 3 row 10 |
| C4 | Agree | Covered by F-20. | - | - |
| C5 | Agree | Depends on DEC-4. | - | - |
| C6 | Agree with change | Same change as F-19: the rollback must include the copies in other plans and the cascade. A retry of an idempotent PUT on 5xx is sound. | - | - |
| C7 | Agree | - | - | - |
| C8 | Agree | R-14 confirmed: the create at `src/index.ts:1122` comes before `writablePlanId` at `:1174`. | - | - |
| C9 | Agree | - | - | - |
| C10 | Agree with change | The docs give two error codes: `RATE_LIMIT_EXCEEDED` with status 429, and `TOO_MANY_REQUESTS` for transactions. The error class is `ForgeKvsAPIError`, with `.code` and `.responseDetails.status`. That class comes from the package, not the docs, so match on the code and the status, not the class. The quota is per minute, so a retry budget under 20 s may not be enough. Fail with a clear message instead of a silent half-write. Raise to P2: the work is small and the quota is real (F-17). | P2 / S | section 3 row 4 |

### 2.4 Marketplace items

| ID | Verdict | Change or reason | Pri / effort | Evidence |
|---|---|---|---|---|
| MK-01 | Agree | `forge eligibility` checks the deployed version, so it runs after a deploy (needs the owner). | - | section 3 row 7 |
| MK-02 | Agree | - | - | - |
| MK-03 | Agree | - | - | - |
| MK-04 | Agree with change | In the `read:jira-work` justification, add the bulk permission check (`permissions/check` needs `read:jira-work`) and the issue-deleted trigger (needs `read:jira-work`). In the `write:jira-work` justification, add the sub-task delete (`src/index.ts:1685`). Neither needs a new scope. Under DEC-2 Option B, a new scope `report:personal-data` is needed. | - | section 3 rows 1, 2a, 9 |
| MK-05 | Agree | - | - | - |
| MK-06 | Agree | - | - | - |
| MK-07 | Agree | - | - | - |
| MK-08 | Agree | - | - | - |
| MK-09 | Agree | - | - | - |

### 2.5 Frontend items

I read every cited line in `src/frontend/legacy-planner.js` and the other cited files (test-log row 23). The defects are at the cited lines.

| ID | Verdict | Change or reason | Pri / effort | Evidence |
|---|---|---|---|---|
| H9 | Agree | Same as C8. | - | `src/index.ts:1122, 1174` |
| M1 | Agree | `applyConflictKeep` (`legacy-planner.js:4642-4645`) saves nothing. | - | - |
| M3 | Agree | `bridge.ts:41` calls `callResolver` again, which starts its own `rounds` counter. | - | `bridge.ts:37-46` |
| M4 | Agree | The predecessor list skips backlog tasks (`legacy-planner.js:5905-5912`), and Save compares with `origPred` (`:6159-6165`). | - | - |
| M6 | Agree | `legacy-planner.js:1841-1847` shows success after both branches. | - | - |
| M7 | Agree | `legacy-planner.js:6177-6180` shows `res.error`. | - | - |
| M8 | Agree | `legacy-planner.js:201` sends the current version. | - | - |
| M9 | Agree | `src/ui/undo-stack.ts:29-33` moves the entry before the replay runs. | - | - |
| FE section 3 (expectedVersion) | Agree | Spot-checked `legacy-planner.js:690, 2317, 197`: none sends `expectedVersion`. | - | - |
| FE section 3 (dead try/catch) | Agree | - | - | - |
| FE section 5 | Agree | - | - | - |
| FE section 6 (old flag undoes newest) | Agree | `legacy-planner.js:176` binds `undoLast`. | - | - |
| FE section 6 (merged entries) | Agree | - | - | - |
| FE section 6 (Redo default due date) | Agree | `legacy-planner.js:195` sends `spanWeeks: op.updates.spanWeeks \|\| 1`. | - | - |
| FE section 6 (replayingUndo global) | Agree | - | - | - |
| FE section 7 | Agree | - | - | - |
| FE section 9 (hours parser) | Agree | - | - | - |
| FE section 9 (trigger default) | Agree | Default 100 matches the server rule "no silent 30% default" (`src/index.ts:751-752`). | - | - |
| FE section 11 (modals) | Agree | `index.html:414, 615, 656` have no dialog role. If MK-07 changes only the text, P2 is enough. | - | - |
| FE section 11 (treegrid keys) | Agree | - | - | - |
| FE section 11 (targets, labels, alert, icons, timeout, focus) | Agree | `plannerErrorBanner` at `index.html:141` has no role. | - | - |
| FE section 11 (start-only key, toolbar) | Agree | - | - | - |
| FE section 12 | Agree | - | - | - |
| FE section 13 | Agree | `legacy-planner.js:99` returns the vendor site, and `:116` builds the URL without encoding. | - | - |
| FE section 15 | Agree | - | - | - |
| FE section 16 item 4 | Agree | `legacy-planner.js:4557` is not gated on the result. | - | - |
| FE section 16 item 7 | Agree | `legacy-planner.js:2307-2309`. | - | - |
| FE section 16 item 8 | Agree | `legacy-planner.js:1555-1559`. | - | - |
| FE section 16 item 9 | Agree | `legacy-planner.js:4104`. | - | - |
| FE section 16 item 10 | Agree | `legacy-planner.js:2751`. | - | - |
| FE section 16 item 11 | Agree | `src/ui/keyboard-grid.ts:65`. | - | - |
| FE section 16 item 12 | Agree | `src/ui/plan-manager.ts:20-27`. | - | - |
| FE section 16 item 13 | Agree | - | - | - |

### 2.6 New item and decisions

| ID | Verdict | Change or reason | Pri / effort | Evidence |
|---|---|---|---|---|
| N-01 | Agree with change | Real, but the effect is understated. See section 4. | P1 / S (agree) | GAP FX-04 |
| DEC-1 | Agree | Fair options. Option A follows from them. See section 2.7. | - | - |
| DEC-2 | Agree with change | Fair, but Option B leaves out that it needs the new scope `report:personal-data`. Adding a scope to an installed app needs the admin's consent again. That favours Option A further. | - | section 3 row 9 |
| DEC-3 | Agree with change | One claim is wrong, one cost and one trade-off are missing, and one option is missing. See section 2.7. | - | - |
| DEC-4 | Agree with change | Confirmed: conditions exist only for custom entities. One cheaper option on plain KVS is missing. See section 2.7. | - | section 3 row 3 |

### 2.7 The four owner decisions (brief section 3.2)

**DEC-1 (baseline features).**
- The options and trade-offs are stated fairly.
- Option A follows from Atlassian's rule that an app must do what its listing says.
- I found no better option.
- My recommendation: Option A, for the reason given in `fix-plan.md`.

**DEC-2 (personal data).**
- The options are fair, but Option B leaves out two costs:
  - It needs the scope `report:personal-data`.
  - Reporting is still required for any app that stores account ids. Forge does not do it automatically (section 3 row 9).
- Option A also needs a rule for contributors without a sub-task key (see the BL-5 row).
- My recommendation: Option A. It removes a recurring compliance task and a scope change.

**DEC-3 (shared dates).**
- **A claim is wrong.** "since `db08009` all plans hold the same copy" holds only for tasks moved since `db08009`. The commit has no step that makes existing plans equal (test-log row 28). The Jira due date makes the END equal on every load (`src/index.ts:776-785`), but not the start. A task scheduled only in a scenario plan before `db08009` has no Main Plan dates. So the migration rule "Main Plan dates are the truth" needs two more rules: one for tasks without Main Plan dates, and one for tasks whose scenario-plan start differs.
- **A cost is missing.** Option A adds one more prefix scan (`cp:<pid>:dates:`) to every plan load. Each task then has two records with two versions, and the client must send both versions. That works well only together with DEC-4 Option A, where one transaction (at most 25 operations) covers both records.
- **A trade-off is missing.** Links stay per plan, but the dates they drive are shared. So a cascade in a scenario plan moves the real Jira due date (`report.md` D3 (f), harness R6). This holds for both options, and the owner should see it in DEC-3.
- **An option is missing. Option C: a Jira issue property for the start date, with the Jira due date for the end.** What the docs confirm (section 3 row 11):
  - Setting a property needs Browse projects and Edit issues, enforced by Jira itself. So BL-2 is closed for date writes without an app check.
  - `search/jql` returns up to 5 properties in the same call. So no KVS scan is needed for dates, which removes the cost of R-28.
  - There is one value per issue, so C2 can no longer diverge.
  - Runs on Atlassian accepts entity properties as storage.
- **Option C has costs:**
  - There is no compare-and-set. The last writer wins, as for the Jira due date today.
  - Any user who can edit the issue can change the property through the REST API.
  - The search lag applies, so use `reconcileIssues`.
  - Not documented: whether a property is deleted with the issue, and whether it moves with the issue to another project. If it is deleted, BL-9 becomes simpler for dates.
- Jira's own "Start date" field is a weaker variant. Its field id differs per site, and it is not always on the screen.
- My recommendation: test Option C on the development site first. Delete an issue, move an issue, and check that the property is set as the user. If the two unverified points hold, Option C closes C2, part of BL-2 and R-28 with less code than Option A. If they do not hold, choose Option A, combined with DEC-4 Option A.

**DEC-4 (version check).**
- **The confirmed facts** (section 3 row 3):
  - `transact()` takes conditions only for custom entities.
  - A transaction holds at most 25 operations and 4 MB.
  - It counts as one write for the rate limit.
  - No status label marks it as preview.
- **Two things Option A must also cover:**
  - A custom entity is queried by index, not by key prefix. The manifest needs an index on project and plan (partition and range) to load one plan.
  - The 25-operation limit means a cascade of 25 successors plus the target cannot be one transaction. That is fine, because each record keeps its own check.
- **An option is missing. Option C: version keys on plain KVS.** Each save creates a new key `...:we:<issueId>:v<N+1>` with `keyPolicy: 'FAIL_IF_EXISTS'`. The docs say this is "if the key already exists, don't overwrite it". Exactly one writer can create version N+1, which gives a true compare-and-set without a custom entity. Old versions are deleted after the new one exists.
- **Costs of Option C:**
  - Loads read more rows until the old versions are cleaned up.
  - A clean-up step is needed.
  - Readers must pick the highest version per issue.
- My recommendation: Option A when DEC-3 Option A is chosen, because one migration covers both. Option C only if the custom entity migration is judged too large for v1. If DEC-3 Option C is chosen, the remaining per-plan records see little concurrency, and the plan's Option B (accept the risk) becomes reasonable for v1.

---

## 3. Unverified claims (brief section 3.3)

Fetched on 2026-11-05 by a research agent (read-only, no credentials, no email address sent). Quotes are verbatim from the pages.

| # | Claim | Result | Source |
|---|---|---|---|
| 1 | BL-9: `avi:jira:deleted:issue`, its payload, and whether it runs as the app | **Partly confirmed.** The event exists, and its payload has `eventType`, `selfGenerated`, `issue`, and optional `atlassianId` and `associatedUsers`. The fields of `issue` (id, key, project) are not defined on the page: Cannot verify. Scope: "The required OAuth scope is `read:jira-work`." The handler can call `asApp()`. Retries: "You can only retry an event for a maximum of four times." Delivery: "Events for `trigger` modules may take up to 3 minutes to reach your app." The updated event carries a `changelog`, and `jiraEventTypeName` includes `issue_moved`. That a project change appears in the changelog is an inference, not stated. Whether events arrive for issues the app cannot see: Cannot verify. | https://developer.atlassian.com/platform/forge/events-reference/jira/ ; https://developer.atlassian.com/platform/forge/events-reference/product_events ; https://developer.atlassian.com/platform/forge/manifest-reference/modules/trigger/ |
| 2a | BL-2: `POST /rest/api/3/permissions/check` as the user | **Confirmed.** "If no account ID is provided, the operation returns details for the logged in user." `projectPermissions[].issues` is a "List of issue IDs". "A maximum of 1000 projects and 1000 issues can be checked." "Invalid project and issue IDs are ignored." The response lists, per permission, the ids the user has. `EDIT_ISSUES` with `SCHEDULE_ISSUES` in one request fits the schema but is not shown in an example. | Atlassian OpenAPI `https://developer.atlassian.com/cloud/jira/platform/swagger-v3.v3.json` (backs https://developer.atlassian.com/cloud/jira/platform/rest/v3/api-group-permissions/) |
| 2b | `SCHEDULE_ISSUES` needed for the due date | **Confirmed.** "Only users with the schedule work items permission can populate the Due date field." | https://support.atlassian.com/jira-software-cloud/docs/schedule-an-issue/ |
| 2c | F-24: `mypermissions` with `projectId` | **Confirmed.** It accepts `projectKey`, `projectId`, `issueKey`, `issueId`; returns 404 "if the project or issue is not found". | OpenAPI as in 2a |
| 3 | DEC-4: custom entity and conditional `transact()` | **Confirmed.** Conditions only inside an entity argument. "Each transaction can contain a maximum of 25 operations." "Each transaction is limited to a payload size of 4MB." Plain keys: no compare-and-swap; only `keyPolicy: 'FAIL_IF_EXISTS'`. No preview label. | https://developer.atlassian.com/platform/forge/storage-reference/kvs-transactions/ ; https://developer.atlassian.com/platform/forge/storage-reference/entities-transactions/ ; https://developer.atlassian.com/platform/forge/storage-reference/kvs-api/ ; https://developer.atlassian.com/platform/forge/storage-reference/entities-manifest/ |
| 4 | C10: KVS rate-limit error | **Confirmed, two codes.** "Any request that exceeds a quota or limit will return a `429` status with an error code of `RATE_LIMIT_EXCEEDED`." The transactions page says `TOO_MANY_REQUESTS`. Class `ForgeKvsAPIError` (package only, https://unpkg.com/@forge/kvs/out/errors.js). Quota: "Read ( 10KB request per min) 4000", "Write ( 10KB request per min)* 4000", "Request rate (RPS) 1000", per installation. "Request sizes are rounded up to the nearest 10KB." How a query page is counted is not defined: Cannot verify. | https://developer.atlassian.com/platform/forge/storage-reference/kvs-errorhandling/ ; https://developer.atlassian.com/platform/forge/limits-kvs-ce/ |
| 5 | BL-7: where the app name is changed and shown | **Partly.** Changed "in Settings" of the Developer Console. "For Jira apps, the app name isn't the name displayed to users in the Jira issue ... update the title in the manifest." The name on install, consent and Connected apps screens: Cannot verify (community reports only). | https://developer.atlassian.com/platform/forge/manage-your-apps/ |
| 6a | BL-4: privacy policy | **Confirmed.** Partner Agreement 8.4(e): "(1) how you access, collect and process End User Data, (2) with whom you share End User Data, (3) in which country or countries the End User Data will be stored and (4) that you (not Atlassian) are responsible". "If you are listing your app on the Marketplace, you are required to include a URL for your privacy policy." | https://www.atlassian.com/licensing/marketplace/partneragreement ; https://developer.atlassian.com/platform/marketplace/data-privacy-guidelines/ |
| 6b | BL-4: standard terms | **Confirmed, with a name correction.** A standard agreement (Bonterms) is chosen per version on the Links tab: "Use a standard agreement as your End User License Agreement for this version?" Its payment clauses were not read. | https://developer.atlassian.com/platform/marketplace/list-customizable-end-user-agreement/ |
| 6c | BL-4: support | **Confirmed.** "Paid via Atlassian apps must be supported by the partner." Agreement 6.3: support "during normal business hours". | https://developer.atlassian.com/platform/marketplace/building-your-presence-on-marketplace/ |
| 7 | BL-6: badges | **Confirmed.** "We are stopping submissions for the Cloud Fortified App (CFA) program" (2 Sep 2026); "The CFA program will be retired on 31st December, 2026." "The Runs on Atlassian badge is automatically applied to eligible apps." No "Data Residency" badge found. "Up to 20% of ISO 27001 requirements", "30% of SOC 2". | https://developer.atlassian.com/platform/marketplace/changelog/ ; https://developer.atlassian.com/platform/forge/runs-on-atlassian-apps/ ; https://developer.atlassian.com/platform/forge/cli-reference/eligibility/ ; https://developer.atlassian.com/platform/forge/forge-soc2-iso27001/ |
| 8 | 25 s resolver limit | **Confirmed.** "Runtime seconds ... 25". `timeoutSeconds` applies only to async events and scheduled triggers. | https://developer.atlassian.com/platform/forge/limits-invocation/ |
| 9 | Personal data reporting still required | **Confirmed.** "All apps storing personal data must report user personal data" via `report-accounts` (scope `report:personal-data`). No automatic reporting for Forge. | https://developer.atlassian.com/platform/forge/user-privacy-guidelines/ |
| 10 | (added) Search consistency, which F-03 and C3 rely on | **Confirmed.** "Recent updates might not be immediately visible in the returned search results. If you need read-after-write consistency, you can utilize the `reconcileIssues` parameter." "Accepts max 50 ids." "The delay might vary from a few seconds to minutes." Whether a direct issue GET is immediately consistent: Cannot verify. | OpenAPI as in 2a; https://developer.atlassian.com/cloud/jira/platform/search-and-reconcile/ |
| 11 | (added) Issue properties, for DEC-3 Option C | **Partly.** PUT needs "Browse projects and Edit issues project permissions". "The maximum length is 32768 characters." `search/jql` `properties`: "A list of up to 5 issue properties". Deleted with the issue, or moved with it: Cannot verify. Start date field: a system field for the timeline, but not always on screens (support KB). | OpenAPI as in 2a; https://developer.atlassian.com/cloud/jira/platform/jira-entity-properties/ ; https://support.atlassian.com/jira/kb/start-date-not-visible-in-jira-project-timeline/ |
| BL-8 | `@asymm/jira-ui` recipe with npm only | **Resolves only when `dist` exists.** With `dist`: `npm ci`, `tsc` without `paths`, bundling, 764 tests and `forge lint` all pass. From a clean clone, `dist` is absent (ignored by git), `npm ci` exits 0, and bundling fails. Not run: `forge deploy` and `forge build` (upload). | test-log rows 12 to 21 |

---

## 4. N-01

**Is it real?** Yes. I read the code and reproduced it.

- `manifest.yml:7-8, 14-15`: both modules use the function `resolver`.
- `src/index.ts:2399-2406` (`extractProjectKey`): without a project in the context, it uses `req.payload.projectKey`, else `'DEMO'`.
- `src/index.ts:2411-2414` (`extractProjectId`): returns undefined, so `openStore` keys records by the project key (`:315-317`).
- `checkPlanApprover` and `authority-check` (`:2647, 2655`) read `req.payload?.projectKey` first.

**The effect is larger than `fix-plan.md` says.** The plan says the writes go to key-based records "which no planner page reads". But a read from the admin page also runs the migration:

- `getProjectPlan` (`src/index.ts:885`) calls `migrateIfNeeded`.
- `migrateIfNeeded` calls `ensureMigrated`.
- `ensureMigrated` (`src/storage/plan-store.ts:225-256`) moves the legacy keys `scheduleMap:<key>` and the others into `cp:<projectKey>:we:` and then DELETES the legacy keys.
- The project page reads `cp:<projectId>:...`, so the migrated data is lost for the planner.

GAP FX-04 shows this: after one admin-context call, the task is in the backlog on the project page. This affects only projects that still hold pre-B-09 data, and only a Jira administrator can open the admin page.

**Is the severity right?** P1 is right. It is a data-loss path in a narrow case, plus missing project isolation.

**Is the fix enough?** Yes, with three additions:

1. The admin function must not import or call any planner resolver, including `getProjectPlan` (so no migration runs there).
2. `isPlanApprover` and `hasTier1AdminPermission` must refuse to run without a project id. Today `hasTier1AdminPermission()` with no argument asks Jira with no project (`src/security/policy-admin.ts:55`).
3. Proof: add a test that calls the admin function with every planner resolver name and expects a thrown "no definition" error, and the GAP FX-04 scenario rewritten as "refused, legacy keys kept".

---

## 5. Gaps

### 5.1 Problems missing from `fix-plan.md`, or covered by a fix that does not apply

| # | Gap | Where | Recommendation |
|---|---|---|---|
| G-1 | Batch items use a stale Jira read (wrong dates stored and written) | GAP FX-01; `src/index.ts:1878-1894` | Part of F-03 and F-17, P1, phase 2. |
| G-2 | Search lag after writes and between cascade rounds | `src/index.ts:1038, 1210, 1918, 1986, 2154`; section 3 row 10 | `reconcileIssues` with the written ids (at most 50). Part of F-03. |
| G-3 | Two more Jira writes before the version check | GAP FX-02, FX-03 | Part of F-07. |
| G-4 | Records under the issue-key form | GAP FX-05 | Part of BL-9. |
| G-5 | `createPlan` and `deletePlan` loop over every record in one call (25 s risk, half-cloned plan) | `src/storage/plan-store.ts:165-208`; `report.md` section 5 "Clone" | New item, P2: do it in pages over several calls, or (under DEC-3 Option A or C) clone only the per-plan fields. |
| G-6 | KVS per-minute quota left out of the limits arithmetic | `report.md` section 5; section 3 row 4 | Measure in development. Raise C10 to P2 and F-17 to P1. |
| G-7 | Week key change in F-29 needs a data step | `src/domain/planner-engine.ts:213` | Part of F-29, effort M. |
| G-8 | `report.md` D3 (d): unscheduling leaves the Jira due date, and the UI does not say so | `src/index.ts:1983` | New item, P3: say "the Jira due date is kept" in the unschedule flag. |
| G-9 | `report.md` section 10: the five live loads may have pruned DEMO records, and this cannot be checked (no logs) | `report.md` section 10 | Owner action: compare DEMO record counts per plan with a known count, before BL-9 removes the prune. |
| G-10 | The `prepare` and `dist` handling of the shared package, and its effect on three other apps | test-log rows 18 to 20, 27 | Part of BL-8. |

### 5.2 Fixes that are not needed

| # | Item | Reason |
|---|---|---|
| U-1 | BL-2 step 3, the `CREATE_ISSUES` pre-check | Jira refuses the create as the user, and KVS is written only after a 201 (`src/index.ts:1152-1189`). Keep only "`writablePlanId` before the create". |
| U-2 | BL-2 step 5, `BROWSE_PROJECTS` for view settings | Every user who can open the project page can browse the project, so the check never refuses anyone. Either use `ADMINISTER_PROJECTS` or drop the row. |
| U-3 | BL-9 step 3 as P0 | Moved-issue records are harmless orphans after step 4. Move to P3. |

### 5.3 Phase order (section 3 of `fix-plan.md`)

The order is workable, with three changes:

1. Move BL-1 step 5 (remove unused resolvers, effort S) from phase 4 into phase 2, before BL-2. Fewer resolvers then need permission rules and tests. The F-01 exposure through the browser console also closes earlier.
2. Move F-17 from phase 3 to phase 2, with F-03. One in-memory batch state fixes both.
3. If DEC-3 Option C is tested, run that test in phase 1. The result decides how much of BL-2 (dates) and phase 3 remains.

The estimate of 5 to 7 weeks is plausible for the planned scope. The additions in this review are mostly S and M items, so I would add about one week.

### 5.4 Release gate (section 10 of `fix-plan.md`)

The gate is not enough to support "ready" as written:

1. **Step 2 cannot fail.** "All 32 pass" is true when every FINDING test is rewritten, and also when nothing is fixed (a FINDING test passes while the defect is present). Require: no test name contains "FINDING", and each R number has a regression test. Add FX-01 to FX-05 as regression tests.
2. **Step 1 does not test the real clean clone.** It must start from a clone with no `packages/*/dist` and no sibling `node_modules`, and run the bundling of `src/frontend/admin.tsx` (test-log row 20).
3. **No migration rehearsal.** DEC-3, DEC-4 and BL-5 change stored records on installed sites. Add these steps:
   - Deploy the old version to development, create data (several plans, contributors, links, a scenario-only task), then deploy the new version.
   - Check record counts and dates before and after.
   - Run the migration twice.
   - Write down a rollback step.
4. **No measured cost.** Run R-28 and R-29 at 1,000 issues and 10 plans, with pass limits: each call under 25 s, and the KVS units per minute inside the quota.
5. **Search lag is not covered.** Add a check that a response after a write shows the written due date when the search lags. The harness fake can return the old due date on the first search after a write.
6. **Steps 5 and 6 need the owner.** The second user, the BL-9 delete (wait up to 3 minutes), `forge eligibility` and the consent-screen name are all owner steps. Keep them, and name the owner as the person who signs them off.

---

## 6. Report spot check

I checked these P0 and P1 findings in the code at `db08009`. All are real.

| Finding | Result | Evidence |
|---|---|---|
| F-01 | Correct. Create, delete, rename plan and `reviewScopeShift` check nothing. | `src/index.ts:2340-2393, 2542-2564` |
| F-03 | Correct, and wider than reported (GAP FX-01). R-30 and R-31 reproduce. | `src/index.ts:1537, 1829, 1884`; test-log rows 9, 11 |
| F-05 (BL-9) | Correct. Prune on a user-scoped 404, called on every load. | `src/index.ts:1848-1855`; `legacy-planner.js:1672-1674` |
| F-06 | Correct at every cited line. | `src/index.ts:994, 1024, 1093, 2046-2048, 1579-1583`; `legacy-planner.js:6134-6139` |
| F-07 | Correct, and wider than reported (GAP FX-02, FX-03). | `src/index.ts:1614, 1624, 1655, 1685, 1691, 1808` |
| F-08 | Correct. `status` is pushed whatever happened. | `src/index.ts:1433-1458` |
| F-11 | Correct, with the nuance in the F-11 row (the change compare exists). | `legacy-planner.js:5852-5861, 6100-6103` |
| F-12 | Correct. | `legacy-planner.js:48, 5383-5392, 6345, 6401` |
| F-13 | Correct. | `bridge.ts:24-29`; `legacy-planner.js:2903, 6292, 6386` |
| F-24 | Correct. | `src/index.ts:2647`; `src/security/policy-admin.ts:49-58` |

Two small corrections to `report.md`:

1. Section 5, "Rate. 1,000 requests per second is not the binding limit": incomplete. The per-minute quota of 4,000 "10KB request" units per installation may bind first (section 3 row 4). This is Plausible until measured.
2. BL-7 says "the registered app name is shown on install and consent screens". The docs do not state this. Only community reports do (section 3 row 5).

Line references: F-20 and `frontend-review.md` M5 cite `src/index.ts:1907` for `cascadeRemaining: []`, but the line is `:1900`.

---

## 7. Not run

| Check | Reason | Exact step for the owner |
|---|---|---|
| `forge deploy` or `forge build` of the BL-8 recipe | Forbidden by the brief. `forge build` uploads. | In a clean clone with the recipe (`tests/bl8/recipe.diff`) and `dist` built: `cd apps/cascadeplan && npm ci && forge deploy -e development`. Check that the admin page loads. |
| `forge eligibility` | Checks the deployed version through the owner's Forge login. | After a deploy: `cd apps/cascadeplan && forge eligibility`. |
| Issue-deleted event payload and delivery | Needs a development site. | Add a trigger for `avi:jira:deleted:issue` that logs the payload keys. Deploy to development, delete a throw-away DEMO issue, and read `forge logs -e development` within 3 minutes. |
| Issue property behaviour (DEC-3 Option C) | Needs a development site. | On a throw-away issue: `PUT /rest/api/3/issue/{id}/properties/cascadeplan.dates` as a user with Edit issues, then as a Browse-only user (expect 403). Move the issue to another project and read the property. Delete the issue and check that the property is gone, for example by restoring from the trash if available. |
| `mypermissions?issueKey=DEMO` real answer | Needs a live call as a user. | In the browser console of the planner: `invoke('checkPlanApprover')` as a project admin, and read the network response. |
| Bulk permission check as a Browse-only user | Needs a second user. | Create the user, then call `POST /rest/api/3/permissions/check` with `EDIT_ISSUES` and `SCHEDULE_ISSUES` for two DEMO issue ids, as that user. |
| KVS quota cost of a query page | Not defined in the docs. Needs real KVS. | In development, run one 50-item batch at 200 tasks and read the usage on the Developer Console "Usage" page, if shown, or watch for `RATE_LIMIT_EXCEEDED` in `forge logs`. |
| Bonterms standard agreement text | Not read in this review. | Read its fee and late-payment clauses before choosing it on the Links tab. |
| Forge storage after uninstall | Not checked. | Read the current Forge "data retention after uninstall" page before writing the privacy text. |
| Browser harness (`harness/e2e.py`, `harness/e2e_review.py`) | No conclusion of this review depends on it. Its imports point to the other checkout. | None needed for this review. |
| Live Jira site | Forbidden by the brief. | - |
