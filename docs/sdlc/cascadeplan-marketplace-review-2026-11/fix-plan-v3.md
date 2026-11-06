# CascadePlan: recommended fix plan (v3)

- **Version:** v3, 2026-11-05. Earlier versions are frozen (read-only): `fix-plan.md` (v1, md5 `408d964b9df232171937f3805570e527`) and `fix-plan-v2.md` (v2, md5 `ae6c010c79e4bb90fce28ab5fa9aa831`).
- **What changed in v3:** the owner's BL-8 decision (build the shared package during install, for all four apps), and the owner's additions on 2026-11-05: moving a parent with its sub-tasks, moving a sub-task, and making a task a sub-task of another. Section 12.2 lists each change from v2.
- **What changed in v2:** v2 applied the independent review of v1, `/home/fahimfarookme/Documents/projects/jira-governance/.tmp/cache/cascadeplan-fixplan-review/fixplan-review.md`. The owner approved every point of that review on 2026-11-05. Section 12.1 lists each change from v1.
- **Companion to:** `report-v2.md` in the same folder. It is the review of commit `db080096007208d2cad97f79c620d49964aa05c9`. The first version, `report.md`, is frozen.
- **Purpose:** one recommended fix for every blocker, finding, concurrency case, Marketplace item and frontend item in the review. Each fix has a priority, a rough effort and the test that proves it.
- **Status:** a recommendation. Nothing in the product was changed. The owner (Fahim Farook) decides.
- **Paths:** relative to `apps/cascadeplan/` unless they start with `docs/`, `site/` or `packages/`. Line numbers are at `db08009`.
- **Source of each problem:**
  - `BL-n`, `F-n`, `C-n`, `D-n` and `R-n` are in `report-v2.md`.
  - `H-n`, `M-n` and numbered sections ("FE section 6") are in `frontend-review.md`.
  - `FX-nn` are the tests of the fix-plan review.
  - `PM-nn` are the review tests of parent and sub-task moves (v3).
  - `N-01` to `N-10` are new in this plan (section 9).
  - `reparent-research.md` (same folder, fetched 2026-11-05) holds the Jira API facts for N-08, with quotes and URLs. Two of its sources are outside developer.atlassian.com: an Atlassian announcement on community.developer.atlassian.com, and a support.atlassian.com knowledge-base article.

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
- "FX-nn" is a test in `test/review/fixplan-gaps.test.ts`. The source is `docs/sdlc/cascadeplan-marketplace-review-2026-11/independent-review/evidence/tests/fixplan-gaps.test.ts`. A copy is in the review checkout, not committed.
- A test named "FINDING" or "GAP" passes **while the defect is present**. When a fix lands, that test fails. Rewrite it as a regression test that asserts the correct behaviour, and keep the same number.
- "CONTROL FX-01b" passes now and must keep passing.
- "PM-nn" is a test in `test/review/parent-move.test.ts` in the review checkout (not committed). PM-00 is an "OK" test that must keep passing. PM-01 to PM-04 are "GAP" tests.
- "Harness R1c" and similar names are checks in `harness/e2e_review.py`. "Harness 2d" and similar names are checks in `harness/e2e.py`.
- "Live" means a manual or scripted check on asymmsystems.atlassian.net, project DEMO, development environment.

---

## 2. Decisions for the owner

Four fixes depend on a choice that only the owner can make. Each has a recommendation. The rest of the plan assumes the recommendation and says what changes if the owner chooses another option.

### DEC-1. Baseline features: describe the app that exists, or build the baseline features first (BL-1)

| | Option A (recommended): ship the planner, describe it truthfully | Option B: build baseline, scope creep and shift approval before submission |
|---|---|---|
| What changes | Rewrite `site/apps/cascadeplan/*.md`, `docs/marketplace/cascadeplan-listing.md`, the submission notes and the admin page text. Remove the unused governance resolvers on the server. Build the baseline features later as a v1.1, with the listing updated then. | Build a freeze button, a status bar, a scope delta, a request and approval UI, versioned baselines and export. Fix their backend first: F-01 (no permission check), F-16 (a baseline does not fit in one KVS value), F-22 (keys under the project key) and the missing tests (F-31). |
| Effort | M (text) plus S (remove resolvers) | XL (several weeks, plus a second review) |
| Risk | Low. The planner is the tested part of the app. | High. The baseline backend has no tests and three known defects. The claims (signed PDF, SHA-256, immutable trail) need new design work. |
| Effect on other fixes | F-16, F-22 (baseline part) and the baseline part of BL-5 move out of the release scope. | All of them stay in scope. |

**Recommendation: Option A.** Atlassian rejects apps that do not do what the listing says. Option A closes BL-1 in days, and Option B delays submission by weeks. The fix-plan review agrees and found no better option.

Do not leave the unused resolvers defined. Without a permission check, anyone can call them from the browser console (F-01).

If Option A is chosen, keep the admin page and give it a real job: it sets who may create, rename and delete plans (see BL-2). Then its text and the `read:jira-user` scope justification are true.

### DEC-2. Personal data: store none, or report what is stored (BL-5)

| | Option A (recommended): store no personal data | Option B: keep account ids and report them |
|---|---|---|
| What changes | Contributors: store only the sub-task key (`subtaskKey`, `src/domain/models.ts:459-462`), and read the assignee from Jira on each load. Approver policy: drop `setByPartyId`. Under DEC-1 Option A, the baseline records (`frozenBy`, display names) and shift records (`requestedBy`, `reviewedBy`) are not written in v1. Remove display names from baselines in any case (INV-04). | Add a weekly `scheduledTrigger` that collects every stored account id, calls the Forge personal data reporting API (`report-accounts`), and erases or anonymises closed accounts. Keep a key index, so the trigger does not scan every key. |
| New scope | None | `report:personal-data`. Adding a scope to an installed app needs the site admin's consent again. |
| Effort | M | L |
| Risk | Low. Jira stays the source for people, as INV-04 already requires. | Medium. The trigger must cover every key family, now and in the future. A missed one is a compliance gap. Forge does not report automatically. |
| Open rule | Contributors without a `subtaskKey` (see BL-5) | None |

**Recommendation: Option A.** Atlassian recommends that apps resolve people live (`marketplace-research.md`, A.d D5). The app already reads assignees from Jira on every load. Option A also avoids a recurring compliance task and a scope change.

Before closing BL-5, check that no other key family keeps an account id. Search the code for `accountId`, `partyId`, `By:` and `displayName`.

### DEC-3. Shared dates: where the one set of dates per task is stored (D3, F-10 R-01, F-17, C2)

**Facts that hold for every option:**
- **Existing plans can hold different dates.** `db08009` changes only `src/index.ts` and `test/plan-isolation.test.ts`. It has no step that makes existing plans equal. Dates are copied to other plans only when a task is written. The Jira due date makes the END the same on every load (`src/index.ts:776-785`), but not the start. So any migration needs these rules:
  1. A task with Main Plan dates: the Main Plan start is the truth.
  2. A task scheduled only in a scenario plan: take the start of the plan that was changed last. The record has no timestamp of its own, so use the highest `version`. If two plans tie, use the earliest start.
  3. A task whose scenario start differs from the Main Plan start: the Main Plan wins, and the migration writes a one-time list of these issue keys for the admin.
- **Links stay per plan, but the dates they drive are shared.** So a cascade in a scenario plan moves the real Jira due date (`report-v2.md` D3 (f), harness R6). The owner should accept this explicitly, whatever option is chosen. The alternative is to run cascades only in the Main Plan, which changes D3.

| | Option A: one shared date record per issue in KVS | Option B: keep the copy in every plan, and make the copy conditional | Option C: start date as a Jira issue property, end as the Jira due date |
|---|---|---|---|
| What changes | Store the shared date fields (`SHARED_DATE_FIELDS`, `src/index.ts:329`) once per issue, under a new key such as `cp:<projectId>:dates:<issueId>`. Each per-plan record keeps only the per-plan fields. `getProjectPlan` merges the two. `shareTaskDates` (`:338-374`) is deleted. | Keep `shareTaskDates`. Copy only when the other plan still holds the dates that this write replaced (a compare-and-set on the dates). Otherwise report "not moved in plan X". | Write the start date to an issue property (for example `cascadeplan.dates`) as the user. Read it in the same `search/jql` call (the `properties` parameter, up to 5 properties). `shareTaskDates` and the KVS date fields are deleted. |
| Effort | L, including the migration | M | M to L, including the migration and a development-site test first |
| Concurrency | One record and one version check. C2 becomes the same case as C1. But each task now has two records with two versions, and the client must send both. This works well only with DEC-4 Option A, where one transaction covers both records. | C2 is reported instead of lost. | One value per issue, so the plans cannot diverge. No compare-and-set: the last writer wins, the same as for the Jira due date today. |
| Permission | The app must check it (BL-2). | The app must check it (BL-2). | Jira enforces it: setting a property needs Browse projects and Edit issues. |
| Cost per load | One more prefix scan (`cp:<pid>:dates:`) | As today | No KVS read for dates |
| Cost per move | One date record, plus a per-plan record when a per-plan field changes | One full prefix scan per other plan (R-28: 12 queries at 10 plans) | One Jira PUT for the property |
| Other costs | | The cost still grows with plans times issues. | The search is eventually consistent, so pass `reconcileIssues`. Each property write is a Jira write and must appear in the Changes panel. Any user who can browse the issue can read the property. The properties stay in the customer's Jira after uninstall, so the privacy text must say so. Not verified: whether a property moves with the issue to another project, and whether it is deleted with the issue. |

Jira's own "Start date" field is a weaker variant of Option C. Its field id differs per site, and it is not always on the issue screen.

**Recommendation:**
1. In phase 1, test Option C on the development site. The steps are in section 10, step 0.
2. If the property is set as the user, refused for a Browse-only user, kept on a move, and deleted with the issue, choose Option C. It closes C2, the date part of BL-2 and the R-28 cost with less code than Option A.
3. Otherwise choose Option A, combined with DEC-4 Option A in one migration.
4. Option B is the fallback only if the release date allows neither.

### DEC-4. Version check on the per-plan records (D6, F-10 R-02, C5)

Confirmed in the Forge documentation (fix-plan review, section 3 row 3): `transact()` takes conditions only for custom entities. A transaction holds at most 25 operations and 4 MB, and counts as one write for the rate limit.

| | Option A: custom entity with a conditional transaction | Option B: keep plain KVS swap-and-restore | Option C: a new key per version on plain KVS |
|---|---|---|---|
| What changes | Move the WorkEffort records (and the DEC-3 Option A date records) to a Forge custom entity with a `version` attribute. Write with `transact()` and a condition on `version`. The restore step (`src/storage/plan-store.ts:128-131`) is removed. The manifest needs an index on project and plan (partition and range), because an entity is queried by index, not by key prefix. | Keep `putEntry`. Accept the C5 race and document it. | Each save creates a new key `...:we:<issueId>:v<N+1>` with `keyPolicy: 'FAIL_IF_EXISTS'`. Exactly one writer can create version N+1, which is a true compare-and-set. The old version is deleted after the new one exists. `FAIL_IF_EXISTS` is documented and is also in the installed package (`node_modules/@forge/kvs/out/interfaces/types.d.ts:27-28`, `PolicySetOptions` of a plain `set`). |
| Effort | L (entity schema, `PlanStore` rewrite, migration, tests) | None | M |
| Costs | A cascade of 25 successors plus the target cannot be one transaction (25-operation limit). That is fine, because each record keeps its own check. | A third writer is lost if it saves between the swap and the restore, and it is told that the save worked. Rare. | Readers must pick the highest version per issue, and compare the numbers as numbers ("v10" sorts before "v9" as text), or zero-pad them. Old versions add rows to every load and count against the KVS quota until a clean-up step deletes them. |

**Recommendation:**
- With DEC-3 Option A: choose Option A. One migration covers both.
- With DEC-3 Option C: the per-plan records then hold no dates and see little concurrency. Option B is reasonable for v1. Option C is the cheap upgrade if a lost update is still seen.
- Option C is also the fallback if the custom entity migration is judged too large for v1.

---

### DEC-5. Moving a parent: which parents move as a group, and what happens to done sub-tasks (N-05)

**Owner requirement (2026-11-05):** when the user moves a task that has sub-tasks, the parent and all its sub-tasks move together, as one block.

Today a parent with dated children cannot be moved at all. Its dates are derived from the children (B-28, `rollUpParentDates`, `src/domain/work-effort-links.ts:98-109`), and the drag, the keyboard move, the toolbar and the multi-select move all refuse it ("Move a child instead", `legacy-planner.js:4200, 4832, 5046`; `src/ui/selection.ts:38`). The server does not refuse it: a direct `updateWbsTask` on such a parent writes the parent's Jira due date and moves nothing on screen (PM-03).

Two questions remain for the owner:

| Question | Option A (recommended) | Option B |
|---|---|---|
| Which parents move as a group? | Task and story parents (hierarchy level 0) with sub-tasks, in v1. Epics keep "Move a child instead" until N-02 and F-17 prove the cost of large groups, then the same rule extends to epics in an update. | Every parent level, epics included, from v1. An epic can hold hundreds of issues, so one drag can mean hundreds of Jira writes over many calls. |
| Done sub-tasks in a moved group | They keep their dates. Their dates record finished work, and moving them would place done work in the future. The preview shows them as fixed. The parent bar still spans them, so it can get longer. | They move with the group, so the block keeps its exact shape. |

### DEC-6. Should the parent's Jira due date follow its sub-tasks? (N-05, N-06)

Today the planner shows a parent's end as the latest end of its sub-tasks, but it never writes that end to the parent's Jira due date. So the bar and Jira disagree after any sub-task move (PM-02 shows the case after a cascade). That breaks the D3 rule "a scheduled bar ends on the Jira due date" for parents.

| | Option A (recommended): write it | Option B: never write it |
|---|---|---|
| What changes | When a planner action changes the roll-up end of a scheduled parent (a sub-task move, a group move, a cascade, a reparent), the server also writes the new end to the parent's Jira due date. The drag preview and the Changes panel show it ("also updates DEMO-9 due date to 2026-11-20"). If the user lacks `SCHEDULE_ISSUES` on the parent, the sub-task move still happens, the parent write is reported "not written", and the parent shows a "Jira due date differs" marker. | The parent's Jira due date is left as it is. The parent shows a "Jira due date differs from its sub-tasks" marker when they disagree. |
| Effect | Jira and the planner agree, for people who look only at Jira. One more Jira write per change. | No extra writes. Jira and the planner disagree. |
| Applies to | Every roll-up parent, epics included (a story move changes the epic's roll-up too) | |

### DEC-7. Making an issue a child of another issue (N-08)

What Jira allows (`reparent-research.md`):

| Change | How Jira allows it | Status of the facts |
|---|---|---|
| R1. A standard issue (task, story, bug) under another epic, or out of an epic | Edit endpoint, `fields.parent`. Atlassian: "For issues in both company-managed and team-managed projects, provide the parent field (where applicable) for issues of all types." The planner already does this through the epic picker (`src/index.ts:1335-1338`). | Confirmed |
| R2. A sub-task under another standard parent, same project | Edit endpoint, `fields.parent`: "The parent field may be set by key or ID". The documentation never says that this works for a sub-task, and the user guide contradicts itself ("Select a new parent work item for your child work item or subtask" against "Subtasks also can't be moved directly from one work item to another"). | Partly. Must be tested on a development site |
| R3. A standard issue becomes a sub-task of another issue | Not through the edit endpoint (not documented). Only through the bulk move API (`POST /rest/api/3/bulk/issues/move`). It runs in the background (returns a task id, then polling), at most 5 bulk requests at once for all users of the site. The user needs the global "Make bulk changes" permission, plus Move issues and Create issues. Jira warns that data may be lost when the issue types use different workflows. "You can't convert a work item to a subtask if the work item has subtasks of its own." Whether Forge `asUser` may call it is not stated outright. | Partly |
| R4. A sub-task becomes a standard issue | The same as R3: bulk move only | Partly |
| Key, id, due date, links, worklogs and properties after R2 to R4 | Not documented for a change inside one project | Not documented |

| | Option A (recommended) | Option B | Option C |
|---|---|---|---|
| What the planner offers | R1 as today, plus R1 by dragging a row onto an epic row. R2 by dragging a sub-task row onto a task row, built only after a development-site test proves it (section 10, step 0). R3 and R4: an "Open in Jira to convert" link to Jira's own screen. | Also R3 and R4 in the planner, through the bulk move API with polling. | Only R1 through the epic picker, as today. No other change of parent in the planner. |
| Effort | M | L to XL | None |
| Risk | Low. R2 depends on the test result. If the test fails, R2 also becomes an "Open in Jira" link. | High. A background job outside the 25 s call, a global permission most users do not have, a site-wide limit of 5 jobs, possible data loss, and unclear Forge support. | None, but the planner cannot express a common planning step. |

---

## 3. Order of work

The order follows the dependencies between the fixes. Work in one phase can run in parallel.

| Phase | Work | Why in this order | Rough effort |
|---|---|---|---|
| 1 | DEC-1 to DEC-4 decided. BL-8 (reproducible build and CI). The DEC-3 Option C test on the development site. | Every later fix needs a build that deploys from a clean clone, and a CI job that proves it. The Option C result decides how much of BL-2 and phase 3 remains. | M to L |
| 2 | BL-1 step 5 (remove unused resolvers) first. Then BL-2 and N-01 (authorization), BL-9 (prune), F-03 with F-17 (stale read and one in-memory batch state), F-04 (Undo), F-06 (default values), F-07 (write order), F-08, F-11, F-12, F-13, N-06 rules 1, 3, 4 and 6 (roll-up kept in step). | Removing resolvers first leaves fewer permission rules and tests, and closes the browser-console exposure early. The rest changes what the app writes. Fix it before the storage migration, so the migration tests run against correct write paths. | L to XL |
| 3 | DEC-3 and DEC-4 migration (as chosen), F-10, F-15, F-19, F-20, N-02, N-05 (move a parent as a block) with N-06 rules 2 and 5. | Storage layout and the paths that depend on it. The block move needs the batch state of F-17 and the permission check of BL-2. | L to XL |
| 4 | The rest of BL-1, BL-3 (closed by phase 2), BL-4, BL-5, BL-6, BL-7, Marketplace items (section 7). | Text, legal and media work. Its content depends on what phases 2 and 3 deliver. | M to L, much of it not code |
| 5 | N-10 (link ports, P1), N-09, N-07, N-08 (after its development-site test), then the P2 findings and frontend items. | UI work with no storage change. N-10 first, because it hides a core feature. | L |
| 6 | Release gate (section 10), then submission. | | M |
| Later | P3 items. | First update after listing. | L |

Total before submission, with the recommendations: about 8 to 10 weeks for one developer (v2 said 6 to 8; v3 adds N-05, N-06, N-08, N-09 and N-10, about 2 weeks). This is a rough figure. The largest parts are phase 2 and the migration in phase 3.

---

## 4. Blockers

### BL-1. Public material describes features the app does not have

- **Fix (DEC-1 Option A):**
  1. Rewrite `site/apps/cascadeplan/*.md` (user guide, admin guide, index) to describe the planner that exists: plans, percent-trigger dependencies, cascade, shared dates, Changes panel, Undo, keyboard move, table view, utilization view.
  2. Remove every claim in `report-v2.md` section 9 that is marked False: freeze, status bar, scope delta, scope shift, baseline versions, comparison view, JSON/CSV/PDF export, SHA-256, "cryptographic snapshot", "immutable", Project Settings pages, governance modes, workflow validator, working days, estimate-unit setting.
  3. Rewrite the submission notes test plan steps 2 to 5, to test the planner features that exist.
  4. Change the admin page text (`src/frontend/admin.tsx:53, 94`) to "Approvers can create, rename and delete plans." This text is true only after BL-2.
  5. Remove these resolver definitions in `src/index.ts`. Keep the domain code and its tests for v1.1.
     - Governance, no UI: `freezePlanBaseline`, `getPlanBaselines`, `getScopeCreepReport`, `requestScopeShift`, `reviewScopeShift`, `getResourceUtilizationGrid` (`:2631-2636`).
     - No frontend caller (`frontend-review.md` section 3): `previewCascade` (`:2623`), `saveTaskDependency` (`:2612`), `saveProjectMilestone` (`:2618`), `getProjectPlans` (`:2586`).
     - Unused aliases: `authority-policy-get`, `authority-policy-set`, `authority-group-search` (`:2642-2644`) and `authority-check` (`:2654`).
     - Keep `checkPlanApprover` (`:2646`). BL-2 step 8 gives it a UI caller.
     - Keep the other definitions in the range: `saveColumnWidths`, `saveHiddenColumns`, `continueCascade`, `unscheduleTask`, `reorderWbsTasks` and `createSubtaskForResource`.
  6. Rename the "Baselines" tab, or remove it (`src/ui/plan-manager.ts:20-27`). It groups plans by name only (FE section 16 item 12).
- **Priority:** P0. **Effort:** M. Do step 5 first, at the start of phase 2.
- **Proof:**
  - Re-run the grep of test-log #36 over every name that remains defined: each one has a caller in `src/frontend`, `src/ui` or `index.html`, except the three approver-policy resolvers that `admin.tsx` calls.
  - A new unit test: invoke each removed name through `handler`, and expect the thrown error `Resolver has no definition for '<name>'`. That is what `@forge/resolver` 2.0.2 throws (`node_modules/@forge/resolver/out/index.js`, `getFunction`).
  - The reviewers re-run the claims audit (`report-v2.md` section 9) against the new text. Every row is True.

### BL-2. No server-side authorization

- **Fix:** one central guard, run before any KVS write or Jira write.
  1. **One wrapper for every resolver.** Today three paths skip `withResolverHandler` (`src/index.ts:2448`): the special `updateWbsTask` wrapper (`:2599-2608`), the approver-policy resolvers, and the approver checks (`:2638-2661`). Route every `resolver.define` through one wrapper that takes the resolver name. The wrapper looks up the required permission in a table, and refuses a name that has no row.
  2. **Task writes** (`updateWbsTask`, `batchUpdateTasks`, `scheduleBacklogTask`, `unscheduleTask`, `continueCascade`, `reorderWbsTasks`, `addSubtaskToTask`, `createSubtaskForResource`):
     - Check, as the user, `EDIT_ISSUES` on each issue that the call will write.
     - For any date change, also check `SCHEDULE_ISSUES`. Jira needs it to set a due date (confirmed: "Only users with the schedule work items permission can populate the Due date field").
     - Use one bulk call, `POST /rest/api/3/permissions/check`, with `projectPermissions` and the issue **ids** (not keys). With no `accountId`, it answers for the current user. It accepts at most 1,000 issues. It ignores invalid ids, and returns only the ids the user has the permission for. So **an id missing from the answer counts as denied.**
     - A cascade checks the successors too. A successor the user cannot edit is not moved, and is reported "you cannot edit this issue".
     - `createSubtaskForResource` also writes the parent's record (`:2139`), so it needs `EDIT_ISSUES` on the parent.
     - Under DEC-3 Option C, Jira itself refuses a date write by a user without Edit issues. The check is still needed for the per-plan KVS fields.
  3. **Creates** (`createInlineTask`, `createJiraEpic`): no permission pre-check. Jira refuses the create as the user, and `createInlineTask` writes KVS only after a 201 (`:1152-1189`). But run the plan check (`writablePlanId`) before the Jira create (R-14, H9).
  4. **Plan management** (`createProjectPlan`, `renameProjectPlan`, `deleteProjectPlan`): require `isPlanApprover` (`src/security/policy-admin.ts:76`) with the project id from the Forge context. Fix `hasTier1AdminPermission` first (F-24).
  5. **View settings** (`saveColumnWidths`, `saveHiddenColumns`): no check. Every user who can open the project page can already browse the project, so a `BROWSE_PROJECTS` check would never refuse anyone. Write down in the admin guide that every project user may change the shared column settings.
  6. **Governance resolvers** (only under DEC-1 Option B): approver for freeze and review; refuse `reviewedBy === requestedBy`; accept only `APPROVED` and `REJECTED`; refuse a second review of the same request.
  7. **Fail closed:** any error in the check, or a non-200 answer, refuses the call with `error: 'forbidden'` and a plain message. This follows `docs/design/uniform-permission-management-standard.md`, sections 1 and 4.
  8. **UI:** call `checkPlanApprover` on load, and hide the plan rename and delete buttons for users who are not approvers (`legacy-planner.js:1519-1593`). The server check stays the real control.
- **Priority:** P0. **Effort:** L.
- **Proof:**
  - R-11 rewritten: a user whose permission check fails changes nothing in any plan, and the result is `forbidden`.
  - R-16 rewritten (only under Option B): self-approval and an unknown status are refused.
  - New unit tests: one for each row of the permission table, with an allow case and a deny case. Include the case "the id is missing from the bulk answer", which must deny.
  - A test asserts that every `resolver.define` name has a row in the table, so a new resolver cannot be added without a rule.
  - Live: a second test user with Browse Projects only (needs owner, to create the user) drags a bar. The expected result is "You cannot edit DEMO-29", and no plan changes.

### BL-3. Values the user did not enter are written to Jira

- **Fix:** closed by F-03 (stale read, so Redo and batches write wrong values), F-06 (default span, default estimate, status from progress), F-11 (unassign) and F-23 (the 8 h default, if local sub-tasks become Jira sub-tasks).
- **Priority:** P0. **Effort:** included in those items.
- **Proof:**
  - A new harness check, "no unrequested write". Record every Jira write during a scripted session of 20 actions: schedule, create, drag, multi-select move, Undo, Redo, progress edit, and a form save without change. Each write must match a value the script entered.
  - The form save without change must write nothing.

### BL-4. Legal, support and documentation URLs are broken or incomplete

- **Fix:**
  1. **Terms:** publish `https://asymm.systems/terms`, or choose Atlassian's standard end-user agreement. It is drafted by Bonterms, and you choose it per app version on the Links tab ("Use a standard agreement as your End User License Agreement for this version?").
     - Recommendation: the standard agreement for v1, because it avoids writing a contract.
     - **The owner must first read its fee and late-payment clauses.** The owner's rule is to accept no clause that charges late fees (riba), and no clause that scholars dispute. This plan does not know whether the Bonterms text has such a clause. If it has one, publish the app's own terms instead.
  2. **Support:** publish `https://asymm.systems/support`. It must give the contact address `support@asymm.systems`, the support hours and the response time. Atlassian requires partner support "during normal business hours". Send a test mail to the address, to prove that it delivers.
  3. **Privacy:** extend `https://asymm.systems/privacy` with a CascadePlan section. It must state the four items of Atlassian Partner Agreement 8.4(e):
     - how the app accesses, collects and processes End User Data: issue ids, dates, links and plan names. After DEC-2, no personal data;
     - with whom End User Data is shared: no third party; nothing leaves the Atlassian site;
     - in which countries or regions the data is stored. Name them, for example "in the Atlassian data residency location of your site (for example the EU, the US or Australia)". "The customer's region" alone does not name a place;
     - that Asymm Systems, not Atlassian, is responsible for the app's processing.
     Also state how a customer deletes the data. Before writing that sentence, read the current Forge page on what happens to app storage after an uninstall (not verified by either review). Under DEC-3 Option C, also state that the date properties stay on the issues after an uninstall.
  4. **Documentation:** change every `docs.asymm.systems` link and image in `site/apps/cascadeplan/*.md` to the live `https://asymm.systems/product/jira-governance/user-guide/` pages. Or publish `docs.asymm.systems`, but the live path is less work.
  5. Re-run the URL check of `marketplace-research.md` Section B.
- **Priority:** P0. **Effort:** M (mostly writing; the site publishing steps are in the site repository).
- **Proof:** every listing URL returns 200 with the right content (the reviewers re-run the Section B check). The support mailbox receives a test mail. The owner records that the Bonterms clauses were read.

### BL-5. Personal data reporting

- **Fix (DEC-2 Option A):**
  1. Store only `subtaskKey` for contributors, and read the assignee live from the Jira sub-task.
  2. Remove `setByPartyId` from the approver policy.
  3. Write no baseline or shift records in v1 (DEC-1 Option A).
  4. Remove display names from the baseline snapshot code (`src/domain/scope-creep.ts:101-111`), so that v1.1 cannot bring them back.
  5. **Contributors without a `subtaskKey`.** These exist when the sub-task create failed (`src/index.ts:1644-1673` keeps the contributor without a key), and for legacy names (`legacyName`). Recommendation: the migration drops them. It writes a one-time list of the affected issue keys, which the planner shows to the user once ("1 contributor on DEMO-12 had no sub-task and was removed. Add the person again to create the sub-task."). Creating the sub-task in the migration is not recommended, because that is a Jira write the user did not ask for (BL-3).
  6. Migrate existing records: drop the account id fields. This is a data change on installed sites. Today only the owner's sites have the app.
  7. In the Marketplace "Privacy and security" tab, declare that the app stores no personal data.
- **Known limit:** the assignee is read from the project search, which stops at 1,000 issues (`MAX_PAGES`, `src/index.ts:561`). A contributor whose sub-task is outside that window shows no name. F-27 is the fix.
- **Priority:** P0. **Effort:** M.
- **Proof:**
  - A new unit test serialises every record type that the app writes: WorkEffort, shared dates, settings, plans and approver policy. It asserts that no value matches either Atlassian account id form (24 hex characters, or `<digits>:<uuid>`), and that no field is named `displayName` or `legacyName`.
  - R-19 rewritten to match.
  - A migration test with a contributor that has no `subtaskKey`.

### BL-6. Badge and compliance claims

- **Fix:**
  - Remove from the listing: "Cloud Fortified", "100% Data Residency Compliant", "Runs on Atlassian" and "Inherits SOC 2, ISO 27001, and GDPR compliance natively".
  - Confirmed facts (fix-plan review, section 3 row 7):
    - Cloud Fortified stopped taking submissions on 2 Sep 2026, and retires on 31 Dec 2026.
    - The Runs on Atlassian badge "is automatically applied to eligible apps".
    - Atlassian has no "Data Residency" badge.
    - Forge covers up to 20% of the ISO 27001 requirements and 30% of the SOC 2 requirements.
  - Replace the removed text with facts the code supports: "Runs entirely on Atlassian Forge. No data leaves your Atlassian site."
  - Run `forge eligibility` in `apps/cascadeplan` after a deploy. It checks the deployed version.
- **Priority:** P0. **Effort:** S.
- **Proof:** the reviewers re-run `report-v2.md` section 9 for the listing. The `forge eligibility` output is kept in the release evidence.

### BL-7. App name and media

- **Fix:**
  1. Rename the app to "CascadePlan" in the Developer Console, app settings, for app `cac8499e-e92e-4ba6-95cc-af398b1be791`. This is confirmed as the place to change the name. The module titles in `manifest.yml` set the names that Jira shows inside the product.
  2. Redeploy. Then check the name on the install screen, the consent screen and Administration > Connected apps. The documentation does not say which name these screens show. Community reports say that a production consent screen kept the old name until developer support changed it. So allow time for a support request before submission.
  3. Make a new `banner.png` at 1120x548, with "CascadePlan" and no "PlanShift".
  4. Retake the screenshots at 1840x900 inside Jira, on a production-like install with no "DEV" badge.
  5. Make the three 580x330 highlight images with captions.
  6. Search the repository for "PlanShift" (all cases, and also "plan shift" and "plan-shift"), and replace every user-facing hit.
     - **Do not rename storage keys.** `planshift:cfg:approver_policy` (`LEGACY_APPROVER_POLICY_KEY`, `src/storage/policy-repository.ts:14`, read as a fallback at `:22`) and the `ps:` key prefixes hold data, not user-facing text.
- **Priority:** P0. **Effort:** M (media work), plus the waiting time for a support request if it is needed.
- **Proof:**
  - `forge deploy` prints "Deploying CascadePlan".
  - The install, consent and Connected apps screens show "CascadePlan" (owner check).
  - The image sizes are checked with `file` or `identify`.
  - The "PlanShift" search returns no user-facing hits.

### BL-8. Build not reproducible or deployable from a clean clone

- **What the fix-plan review proved** (its test-log rows 12 to 21 and 27). It ran the v1 recipe with npm only:
  - With `packages/asymm-jira-ui/dist` present, the recipe works: one copy of `react` and `@forge/react` from the app, types without `paths`, bundling resolves, a clean `npm ci` works, 764 tests pass, and `forge lint` is clean.
  - The root `.gitignore` (line 3, `dist`) ignores `dist`. So a clean clone has no `dist`. `npm ci` then exits 0, and bundling fails with `Could not resolve "@asymm/jira-ui"`.
  - A stale `dist` is used silently after a source change.
  - npm runs the dependency's `prepare` script under `install-links=true`.
- **Fix:**
  1. Commit `apps/cascadeplan/package-lock.json`. Also commit `apps/cascadeplan/tools/package-lock.json` if it is missing.
  2. Make `@asymm/jira-ui` a real package. Today it resolves only through `tsconfig.json` `paths` (`tsconfig.json:11-12`), which the Forge bundler does not use.
     - In `packages/asymm-jira-ui`, compile `src` to JavaScript and type files in `dist/`, and point `main` and `types` at `dist/`. ts-loader will not compile TypeScript inside `node_modules` (review test-log #23).
     - **Owner decision (2026-11-05): build `dist` during install with a `prepare` script, for all four apps.** `dist` stays ignored by git.
     - **Make the package build on its own.** Today the package's own `tsconfig.json` points `react`, `@forge/react` and `typeRoots` at `../../apps/fourrealities/node_modules`. Commit `990b8ea` (2026-11-03, "feat(definitionguard): implement Uniform Permission Management Standard") added that file. That setting applies only when the package is type-checked on its own. When an app builds today, the app compiles the package source through its `paths`, with the app's own `node_modules`. A shared package must not depend on one app's install, so remove that setting:
       - Add `typescript`, `@types/react`, `react` and `@forge/react` to the package's `devDependencies`, at the versions the apps use. Keep `react` and `@forge/react` in `peerDependencies` as well.
       - Commit a `package-lock.json` for the package.
       - Remove `paths` and `typeRoots` from `packages/asymm-jira-ui/tsconfig.json`.
       - Add `"prepare": "tsc -p ."` to the package's `package.json`.
     - **Install order.** Run `npm ci` in `packages/asymm-jira-ui` first, then in each app. The fix-plan review proved that npm runs the package's `prepare` script when an app installs it (its test-log row 18). It did not prove where the script runs, or whether npm installs the package's `devDependencies` first. Until a clean clone proves otherwise, assume that `tsc` must resolve from `packages/asymm-jira-ui/node_modules`, so that folder must exist before the app's install.
     - In the app, depend on `"@asymm/jira-ui": "file:../../packages/asymm-jira-ui"`, and add `install-links=true` to `apps/cascadeplan/.npmrc`. npm then copies the package instead of linking it. The copy has no nested `node_modules` (review test-log row 13), so `react` and `@forge/react` resolve from the app's own `node_modules`, not from the package's dev install.
     - The copy in the app's `node_modules` does not change when the package source changes. After a change in `packages/asymm-jira-ui/src`, run `npm ci` again in each app. Write this in the repository README.
     - Remove the `paths` entries, or keep them only for the editor.
     - Change `jest.config.js` so that `@asymm/jira-ui` resolves to the installed package, not to `src`. Otherwise the tests and the bundle can run different code.
     - **All four apps** map the package (`cascadeplan`, `definitionguard`, `ledgerseal`, `fourrealities`). Give each app the same three changes (dependency, `.npmrc`, jest mapping). Change them together, or in one commit per app.
  3. Rebuild `static/frontend/build/app.js` from the app's own `node_modules`, and commit it. Then `git status` must be clean after `npm run build` (review test-log #9, #10).
  4. Add a CI job on a real clean clone, with no `packages/*/dist` built by hand and no sibling `node_modules`:
     - `npm ci` in `packages/asymm-jira-ui`, then in the app and in `tools`;
     - check that `packages/asymm-jira-ui/dist` and the app's copy of it exist after the install;
     - `tsc --noEmit`;
     - `npm test -- --coverage`;
     - `npm run build`, then `git diff --exit-code static/frontend/build`;
     - a bundling step for `src/frontend/admin.tsx` (esbuild, as in the fix-plan review test-log row 16). It emulates the bundler's module resolution. It is not the Forge bundler;
     - `forge lint`.
     `forge build` uploads ("build and upload your app"), so it is not a local check. The real proof is `forge deploy -e development` from the clean clone (owner, or CI with Forge credentials).
  5. Add a build tag or the commit SHA to each deployment, so that the deployed build can be identified (`report-v2.md` section 11).
- **Priority:** P0. Do it first: every other fix needs it. **Effort:** M to L (four apps).
- **Proof:**
  - A clean clone deploys to development with no manual step, and the admin page loads.
  - CI is green.
  - Rebuilding gives an identical `app.js`.
  - The package type-checks on its own (`npm ci && npx tsc -p .` in `packages/asymm-jira-ui`), with no folder outside the package.
  - A search of the repository for `apps/fourrealities/node_modules` finds no file outside `apps/fourrealities`.
  - The same clean-clone job passes for each of the four apps.

### BL-9. Opening the planner can delete other users' planning data

- **Fix:**
  1. Remove the automatic call to `pruneStaleEntries` (`legacy-planner.js:1672-1674`).
  2. **Delete records only when Jira says that the issue was deleted.** Add a Forge trigger for `avi:jira:deleted:issue` in `manifest.yml`. It needs the scope `read:jira-work`, which the app has.
     - The handler deletes the issue's records in every plan of its project, and the shared date record under DEC-3 Option A.
     - **Match both key forms.** A record can be stored as `cp:<pid>:we:<issueKey>` with `issueId` equal to the key, not the numeric id. This happens when the migrating user's search did not return the issue (FX-05; `src/storage/plan-store.ts:99, 120`; `src/index.ts:427`). Match on the issue id and on the issue key from the event, in every plan.
     - **Make the handler idempotent.** Events can take up to 3 minutes to arrive, and an app can retry an event up to four times. Deleting a key that is already gone is safe.
     - The handler runs as the app, so a user's permissions cannot cause a delete.
     - **Verify on the development site** that the event payload has the issue id, the key and the project id. The events reference names the `issue` object, but does not define its fields. Also verify that the event arrives for an issue with an issue security level.
  3. **Moved issues (P3):** for an issue moved to another project (the issue-updated event, with `jiraEventTypeName` `issue_moved`), delete or re-key its records in the old project. Until then, such records are harmless orphans.
  4. **The stale note.** Keep `staleEntries` in the response only to show a quiet note. The note cannot tell a hidden issue from a moved one, so word it as: "N planned issues are not in this project's search for you. They may be hidden from you or moved." Never delete because of it.
  5. If a manual clean-up is still wanted, make it an approver-only action that confirms each issue with an app-scoped read (`asApp`), and logs what it deletes. Not verified: whether issue security levels hide issues from the app user.
- **Priority:** P0 (step 3: P3). **Effort:** M.
- **Proof:**
  - R-18 rewritten: a 404 for the user deletes nothing.
  - A new unit test: the trigger handler removes the records in every plan, in both key forms (FX-05 rewritten), and a second run of the same event changes nothing.
  - Harness: opening the planner causes no KVS delete. Add a delete counter to the fake storage in `harness/setup.ts`.
  - Live: delete a throw-away DEMO issue that has a plan record. Wait up to 3 minutes. Its record disappears. Opening the planner deletes nothing.

---

## 5. Findings

Findings already fixed by a blocker point to it. Each other finding has its own fix.

| ID | Problem (short) | Recommended fix | Pri | Effort | Proof |
|---|---|---|---|---|---|
| F-01 | No server-side authorization | BL-2 | P0 | (BL-2) | (BL-2) |
| F-02 | Public material describes absent features | BL-1 | P0 | (BL-1) | (BL-1) |
| F-03 | The Jira read taken before a write is used after the write: the bar is drawn too short or too long, Undo/Redo are corrupted, and **batch items compute and store wrong dates** (FX-01) | Three parts. **(1) Batch input.** In `batchUpdateTasks` (`src/index.ts:1865-1901`), every item reuses the `live` read from `:1878` (`:1884`). After a cascade, the next item sees the cascaded tasks with their old Jira end (`mapLiveIssues`, `:782-784`), and stores and writes a wrong length (FX-01: C becomes a one-day bar in KVS and Jira, and a reload does not repair it). Fix it with F-17: load once, apply all items to one in-memory state, and update that state's due dates after each item. **(2) Response.** In `updateWbsTask` (`:1829`), `batchUpdateTasks` (`:1896`) and `continueCascade` (`:1933`), patch the live data with the due dates that Jira accepted (the `SyncLog` writes with `ok: true`) before building the response. This needs no extra Jira call. A due date that Jira rejected keeps the old value (see F-19). **(3) Later reads.** The Jira search is eventually consistent ("The delay might vary from a few seconds to minutes"). Every resolver that searches again after a write can see old values: `scheduleBacklogTask` (`:1038`), `createInlineTask` (`:1210`), `createSubtaskForResource` (`:2154`), `unscheduleTask` (`:1986`), and the next round of `continueCascade` (`:1918`). Pass `reconcileIssues` (at most 50 issue ids) with the ids just written, and in `continueCascade` with the ids of the cascade chain. A plain re-read by key without `reconcileIssues` is not reliable. | P1 | M | R-30, R-31 rewritten (new start and new end returned). FX-01 rewritten (C keeps 4 days in KVS and Jira). CONTROL FX-01b keeps passing. Harness R1c, R2a, R2b. A harness check where the fake search returns the old due date on the first search after a write: the response still shows the written date. Live: repeat L2 and L3 on DEMO-29 (170 px kept at every step). |
| F-04 | A drag cannot be undone, and Cancel in the conflict dialog does not revert | On drop, take the "before" snapshot just before the optimistic change (`legacy-planner.js:4536-4537` sets `task.startDate` and `task.endDate`). Pass it to `callResolver` (`:151-165`) as an explicit `before` option, so that `pendingUndo` (`:154`) does not take a snapshot of the changed plan. A snapshot on mousedown would copy the whole plan for every plain click. Keep `prevStart` and `prevEnd` with the drag. Cancel (`applyConflictCancel`, `:4647-4654`) writes those values, with the record version from the save it reverts. | P1 | M | Harness probe (`e2e_undo_probe.py`): the first drag offers Undo, and Ctrl+Z restores the dates. A new harness check: Cancel in the dependency dialog restores the old dates in KVS and Jira. |
| F-05 | Automatic prune deletes on a user-scoped 404 | BL-9 | P0 | (BL-9) | (BL-9) |
| F-06 | Default values are written to Jira | 1. Schedule from backlog: when the issue has a Jira due date, use it. When it has none, save a default span in KVS only, write no Jira due date, and draw the bar end with a "no due date in Jira" style until the user resizes the bar or sets an end. Remove `spanWeeks: 3` from the client calls (`legacy-planner.js:1835-1839, 3166-3171, 3889-3895, 4108-4114, 4163, 5582-5588`). Do not compute a due date on the server (`src/index.ts:1024, 1033-1036`) unless the user sent an end. 2. `createInlineTask`: the same rule (`legacy-planner.js:2899, 6289`; `src/index.ts:1186-1207`). 3. `createSubtaskForResource`: send no estimate and no due date when the fields are empty (`legacy-planner.js:5974`; `src/index.ts:2046-2048, 2146-2152`). 4. Progress: do not change the status, on the server (`src/index.ts:1579-1583`) and in the client (`legacy-planner.js:6134-6139`). Change both together. In the form, offer "Also move the issue to Done" as a checkbox when the progress is 100, unticked by default. 5. Redo of a schedule: see the FE section 6 row (`spanWeeks \|\| 1`, `legacy-planner.js:195`). | P0 (part of BL-3) | M | R-10 and R-13 rewritten. The BL-3 "no unrequested write" harness check. |
| F-07 | Jira writes run before the version check, and a conflict hides them | Order every write path the same way: validate, check permission (BL-2), check the version and write KVS, then write Jira. In `updateWbsTask`, these Jira writes run before `putEntry` (`:1808`) today: the link POST (`:1614`), the DELETE of an owned link (`:1624`, FX-02), the sub-task create (`:1655`), the sub-task DELETE (`:1685`) and the contributor "unassign" PUT (`:1691`, FX-03). Move all five after `putEntry`. Two of them return data that the record must hold: the link id (`:1618-1619`) and the sub-task key (`:1662`). Store it with a second `putEntry` after the Jira write, using the version from the first. Or write the record first as "pending" and complete it after. Under DEC-4 Option A, one transaction can cover both. Creates that must go to Jira first (a new issue) report the created issue in `jiraSync.writes`, even when the KVS step fails. `conflictResult` (`:451-457`) accepts the writes already done. | P1 | M to L | R-04, R-05, R-06, R-14 rewritten. FX-02, FX-03 rewritten: on a conflict, no Jira write happens, or each write that happened is listed. |
| F-08 | Status reported as written when no transition happened | In `syncTaskFields` (`src/index.ts:1433-1459`), push `status` into `sentFields` only when the transition POST returned 204. Put it into `rejected` when no transition matched, when the transition GET failed, or when the POST returned anything else. Give each rejected field its own message. Today `syncTaskToJira` logs every rejected field with the fixed due-date text "Jira did not accept the due date on this issue screen" (`:1308`). For status, say "No workflow transition to <status> from the current status". | P1 | S | R-08, R-09 rewritten. A test that a rejected status shows the status message, not the due-date message. |
| F-09 | Personal data stored, and no reporting | BL-5 | P0 | (BL-5) | (BL-5) |
| F-10 | Lost updates across plans and in the restore step | DEC-3 (Option C or A) removes the cross-plan copy (R-01). DEC-4 removes or accepts the restore race (R-02). With DEC-3 Option B, use the compare-and-set copy described there. | P1 | (DEC-3, DEC-4) | R-01 and R-02 rewritten: no lost update, or a reported conflict. |
| F-11 | Saving the form can unassign the issue | 1. Always add the current assignee to the list, even when not in the first 50 (`src/index.ts:511`; `legacy-planner.js:5852-5861`). 2. Track whether the user touched the assignee control, and send `resourceAccountId` only then. The existing check (`:6100-6103`) compares the chosen name with `curTask.resource`, but the control shows "Unassigned" when the assignee is not in the list, so the check sees a change. 3. Match people by account id, not by display name (FE section 16 item 6). | P1 | S | A new harness check: open and save the form of an issue whose assignee is not in the assignable list. Jira receives no assignee write. |
| F-12 | Three undefined functions in the bundle | Fix the names. `addDays` is imported as `addDaysIso` (`legacy-planner.js:48`), so call `addDaysIso` at `:5383-5392`. Import `showErrorBanner` from `banner.ts` (`:6345`; only `initErrorBanner` is imported, `:18`). Define `populateEpicDropdowns`, or remove its call (`:6401`). Add `// @ts-check` and `checkJs` for `legacy-planner.js`, or an esbuild step that fails on undefined globals, so this cannot return. | P1 | S | A new harness check clicks the +/- 1 week buttons in the date editor and creates an epic. No page error. |
| F-13 | Create flows report success after a failed call | 1. First make every resolver return `ok`. Today `getProjectPlan` returns a plan with no `ok` field (`src/index.ts:960-983`), and the `updateWbsTask` wrapper returns `{ success: false, error }` with no `ok` (`:2606`). Without this step, a caller that tests `ok` reads a success as a failure. 2. Normalise the thrown case in `bridge.ts:24-29` to `{ ok: false, success: false, error, message }`. 3. Every caller tests `ok !== true`: the create flows (`legacy-planner.js:2903, 6292, 6386`), the schedule flows (M6), `addSubtaskToTask` (its result is not inspected at all, FE section 3) and the batch progress message (FE section 16 item 13). | P1 | M | A new harness check: make `invoke` throw. The form stays open, the summary is kept, and no success text is shown. A unit test: every resolver result has a boolean `ok`. |
| F-14 | Build not reproducible | BL-8 | P0 | (BL-8) | (BL-8) |
| F-15 | A cycle through a second link passes validation | Make `validateDependency` (`src/domain/planner-engine.ts:176-177`) build the same graph that `cascade` uses: every active stored link, plus the imported Jira "Blocks" links (`engineInputs`). Validate before any Jira write (F-07 order). For a cycle that already exists in Jira, make `cascade` report the cycle and move nothing, instead of throwing (`schedule-engine.ts:173`), so that the other tasks still move. | P2 | M | R-15 rewritten. A new test: a plan with an existing Jira cycle still allows a move of a task outside the cycle. |
| F-16 | Baseline too large for one KVS value; shift list grows without bound | DEC-1 Option A takes this out of v1. For v1.1: store a baseline as a header key plus chunk keys of at most 200 tasks each, with only ids, dates and hours (no summary, no names). Store one key per shift request. | P3 under DEC-1 Option A (else P2) | M | R-27 rewritten: a 5,000-task baseline saves and loads. |
| F-17 | Batch and multi-plan writes are costly, and batches use a stale read | Do it in phase 2, together with F-03. In `batchUpdateTasks` (`src/index.ts:1865-1901`), load the plan and entries once. Apply all items in memory, with their version checks, updating the in-memory due dates after each item (this is also the fix for FX-01). Write the records, then build one response. `updateWbsTask` takes the loaded state as a parameter, as it already takes `preloaded` live data. DEC-3 Option C or A removes the per-plan scan. **Count the KVS quota too:** 4,000 reads and 4,000 writes per minute per installation, in units of 10 KB of request size. The documentation does not say how a query page is counted, so measure it (`report-v2.md` section 5, "Rate"). | P1 | M | R-28, R-29 re-measured. Targets: a 50-item batch at 200 tasks makes at most 5 prefix queries. A timing test at 1,000 tasks stays under 10 s in the harness. A measured run in development stays within the KVS quota (section 10). FX-01 rewritten. |
| F-18 | Validation gaps | In `src/validation.ts`: refuse an end before the start. Refuse dates outside the window from today minus 5 years to today plus 10 years. Validate `spanWeeks` (1 to 104), `startWeek` (a known week key), `effortHours` (0 to 10,000), `summary` (1 to 255 characters, trimmed) and `targetIndex` (whole number, 0 or more) in all four create and schedule resolvers. Return a validation result, never a `TypeError`. After F-06 the client no longer sends `spanWeeks`, but the server must still validate it. | P2 | S | R-21, R-22, R-23 rewritten. |
| F-19 | When Jira rejects a due date, KVS keeps the new dates | Change the order in `updateWbsTask` (`src/index.ts:1807-1827`): save the target record, write the target's due date to Jira, and only when Jira accepted it, share the dates to other plans and run the cascade. Today `shareDatesAndLog` (`:1823`) runs before the Jira write (`:1827`). When Jira rejects the date: put the target record back to its dates before this call (one more `putEntry` with the new version). Show on the bar and in the flag that Jira refused the date, and why. If that rollback meets a conflict (another user saved in between), keep the other user's record, and tell the user "Jira refused the date. Someone else changed the task since. Reload." | P2 | M | R-12 rewritten. Harness R8c: after reload, the bar keeps the old dates and its old length in every plan. A unit test: a rejected target due date writes nothing to other plans or successors. |
| F-20 | Cascade successors skipped, and the multi-select remainder dropped | In `continueCascade` (`src/index.ts:1927-1929`) and `updateWbsTask`, return a skipped successor in a new `cascadeSkipped` list, with the reason. Show it in the Changes panel as "not moved: changed by someone else; move it again". In `batchUpdateTasks`, merge the `cascadeRemaining` of each item without duplicates, instead of returning `[]` (`:1900`), so that the client loop in `bridge.ts` continues the cascades. | P2 | S | R-07 rewritten. A new unit test for a batch whose items each have more than 25 successors. |
| F-21 | Silent failures, and no logs | Add a small logger that writes one line for each failed Jira or KVS call, with the resolver name, the issue key and the HTTP status. It writes no summaries, no names and no account ids. Replace the 14 empty `catch {}` blocks in `src/index.ts` with a call to it. In `fetchRawIssues` (`:584`), return an `error` with the status. Show "Jira is not reachable" (status 5xx or a network error) or "You cannot browse this project" (403) instead of the empty-project text. Show "Licence required" on load (FE section 12). | P2 | M | A unit test for each state. `forge logs` shows a line after a forced failure in development. |
| F-22 | Orphaned and misplaced keys | `deleteProjectPlan` also deletes the plan's baselines, active-baseline pointer and shift requests. Key baselines and shifts by project id, as D7 does for records (`baseline-repository.ts:16-30`), with a one-time migration from the project-key form. Give `createPlan` and `savePlans` a version check (store the plan list with a version, and use `putEntry` semantics). The cost of a clone or delete of a large plan is N-02. | P2 (baseline parts P3 under DEC-1 Option A) | M | R-20 rewritten. A new test: two concurrent creates both survive, or one is refused with a message. |
| F-23 | Local sub-tasks hide the real Jira sub-tasks | Recommended: stop storing local sub-tasks, and make `addSubtaskToTask` create a real Jira sub-task. This follows D2 (Jira is the source of truth). Drop the 8 h default estimate that the client sends when the field is empty (`legacy-planner.js:5952`), or it becomes a new unrequested Jira write (BL-3). Alternative: in `mapLiveIssues` (`src/index.ts:761-763`), merge the live Jira sub-tasks with the stored local items that have no Jira key. | P2 | M | R-26 rewritten. The BL-3 harness check includes "add a sub-task with an empty estimate". |
| F-24 | `checkPlanApprover` passes a project key as an issue key | Change `hasTier1AdminPermission` (`src/security/policy-admin.ts:49-58`) to take `{ issueId }` or `{ projectId }`. For plan-level checks, call `mypermissions?projectId=<id>&permissions=ADMINISTER_PROJECTS,ADMINISTER` (confirmed: `mypermissions` accepts `projectId`, and returns 404 for an issue or project it cannot find). **Refuse to run without an id.** Today a call with no argument asks Jira with no project (`:55`), which answers for the user's permissions anywhere. Read the project id only from the Forge context, never from `req.payload` (`src/index.ts:2647, 2655` use `req.payload?.projectKey` first). | P0 (needed by BL-2) | S | R-17 rewritten. A unit test: a project admin with no approver group is an approver. A unit test: a call without a project id returns false. |
| F-25 | Progress formula differs from the spec | Follow spec 3.3 item 9 in `src/index.ts:728-736`. A leaf issue uses its own `timespent` divided by its own `timeoriginalestimate`. A parent uses `aggregatetimespent` divided by `aggregatetimeoriginalestimate`. Add `timespent` and `aggregatetimeoriginalestimate` to the search fields (`:581-582`). | P2 | S | A new unit test with a parent whose time is logged on sub-tasks. |
| F-26 | Other UI defects | See section 8 (FE items), one row each. | | | |
| F-27 | Projects with more than 1,000 issues | Keep the cap, but let the user choose the scope. Add an optional JQL filter per plan (for example `fixVersion = 2.0`), validated by Jira itself and combined as `project = X AND (<filter>)`. Show the cap message with a link to the filter. Load assignable users in pages (F-11). | P3 | M | A unit test: the filter goes into the JQL, and the truncation message names the filter. |
| F-28 | `reorderWbsTasks` returns ok after a lost race | Check the `putEntry` results (`src/index.ts:2019, 2026`). On a conflict, return `conflictResult`, so that the client reloads. | P3 | S | R-24 rewritten. |
| F-29 | The week grid starts on Wednesday; server dates are UTC | 1. Align `generateDynamicWeeks` (`src/domain/planner-engine.ts:195-199`) to Monday, the same as the timeline header. 2. **Migrate the stored week keys.** A week key is the start day and month of the week, for example `04-Nov` (`planner-engine.ts:213`). Moving the start day changes every key, so stored `startWeek`, `endWeek` and `weeklyAllocations` keys would match no week (`planner-engine.ts:111, 311`; `src/index.ts:645, 1003`). Recompute them from the stored dates in the same migration, or derive the grid from the dates on every read. 3. For "today", let the client send its local date (`todayIso` at `src/index.ts:259` becomes a parameter, with the UTC value as the fallback), and validate that it is within one day of the server's UTC date. | P3 | M | A unit test of the week starts. A migration test: a record with old week keys shows the same dates after the change. A unit test with a client date of tomorrow (UTC+5:30 just after midnight). |
| F-30 | 13 files without the copyright header | Add "Copyright (c) 2026 Asymm Systems" and "@author Fahim Farook" to the 13 files in `report-v2.md` F-30, and to `static/frontend/build/index.html` and `style.css` (FE section 14). Add a CI check that fails on any source file without both lines. | P3 | S | Re-run test-log #34. It finds 0 files. |
| F-31 | Maintainability | No single fix. Recommended path: (1) split `src/index.ts` by resolver group (plans, tasks, creates, governance, admin), with no change in behaviour, guarded by the existing 726 tests; (2) add tests for the governance resolvers before any v1.1 work; (3) one result shape for all resolvers (`{ ok, error?, message?, ... }`; F-13 step 1 starts this), with no thrown `Error` for validation (`:1606, 2244`); (4) move `legacy-planner.js` to TypeScript one feature at a time, starting with the drag and Undo paths that hold F-04 and F-12. | P3 | XL (spread over updates) | Coverage includes `src/frontend` for each part moved. |

---

## 6. Concurrency cases

| ID | Problem | Recommended fix | Pri | Effort | Proof |
|---|---|---|---|---|---|
| C1 | Same task, same plan | No fix needed. It works. Keep R-03 and harness R7. | | | |
| C2 | Same task, different plans: the plans diverge | DEC-3 (Option C or A removes the copy; Option B makes it conditional) | P1 | (DEC-3) | R-01 rewritten |
| C3 | A Jira due-date edit and a planner move at the same time | The client sends the Jira due date it saw (`expectedDueDate`) with each date change. The server compares it with a read that is consistent for this issue, and refuses with a conflict when they differ ("DEMO-29's due date was changed in Jira a moment ago. Reload."). The normal `search/jql` read (`src/index.ts:1537`) is eventually consistent, so it can miss exactly this race. Pass `reconcileIssues` with the issue id for this check. A direct issue GET is the other choice, but its consistency is not documented. On load, mark a bar whose Jira end differs from the saved end with "changed in Jira". | P2 | S | A new unit test: a different Jira due date gives a conflict and no write. A test that the search call for the check carries `reconcileIssues`. |
| C4 | A cascade batch and a move of a successor at the same time | F-20 (report the skipped successor) | P2 | (F-20) | R-07 rewritten |
| C5 | The restore step overwrites a third writer | DEC-4 | P1, or an accepted risk under DEC-4 Option B | (DEC-4) | R-02 rewritten |
| C6 | KVS saved, Jira write failed | F-19 for a rejected due date: the rollback covers the target, and nothing was shared to other plans or the cascade, because those run only after Jira accepted the date. BL-2 removes the 403 case (no KVS write without permission). For 5xx and network errors, retry once in `withRetry` (`src/index.ts:128-143`), for idempotent PUTs only, then roll back as in F-19. | P2 | S | A new unit test: a 503 on PUT leaves every plan unchanged after the rollback |
| C7 | Jira write done, then the function times out | Short term (v1): F-13, so that the client never shows success. On an unknown result, reload and show "The result is unknown. Check the plan before you try again." Longer term: make creates idempotent. The client sends a create id. The server writes it as a Jira issue entity property in the create body, and on a retry searches for it before it creates. That needs an indexed `jira:entityProperty` module, so leave it for later. | P2 (short term), P3 (idempotency) | S, then M | A harness check: a forced invoke timeout after the Jira create shows the "unknown" message and no success text |
| C8 | Plan deleted in another tab | Done, except `createInlineTask` (R-14). Run `writablePlanId` before the Jira create (BL-2 step 3). | P1 | S | R-14 rewritten |
| C9 | 50-item batch with partial failure | F-17 (cost and one state). Show the per-item results in the Changes panel, instead of the general "The change failed." (FE section 3, `batchUpdateTasks` row). | P2 | S | A harness check: a batch with one conflicting item lists that item and saves the others |
| C10 | KVS rate limit and quota | Wrap the storage provider with a retry for the KVS rate-limit errors. The documentation gives `RATE_LIMIT_EXCEEDED` with status 429, and `TOO_MANY_REQUESTS` for transactions. Match on the code and the status, not on the error class (`ForgeKvsAPIError` comes from the package, not from the documentation). The quota is per minute, so a short retry may not be enough. After the retries (total wait under 20 s), fail with a clear message ("CascadePlan is busy. Try again in a minute.") and write nothing more in that call, instead of a silent half-write. | P2 | S | A unit test with a fake storage that throws the rate-limit error twice, then succeeds. A unit test where it keeps throwing: the user gets the message, and no later write runs. |

---

## 7. Marketplace checklist and listing items

Items not already covered by a blocker:

| ID | Item | Recommended fix | Pri | Effort |
|---|---|---|---|---|
| MK-01 | Runs on Atlassian: `forge eligibility` not run | Run it after BL-8 and a deploy (it checks the deployed version). Keep the output in the release evidence. | P0 | S (owner) |
| MK-02 | Security questionnaires, partner questionnaire | Fill them in after BL-2, so the answers can say that every write is checked against Jira permissions. Remove the retired "Security Self-Assessment" row from `docs/marketplace/developer-console-checklist.md`. | P0 | M (owner's sign-in) |
| MK-03 | Pricing differs (251+ tier: listing $0.60, checklist and FAQ $0.90) | Choose one price, and make the listing, the checklist, the FAQ and the Developer Console pricing page say the same. | P0 | S |
| MK-04 | Scope justifications cite absent features | Rewrite the justifications in the submission notes section 1 for the features that exist. `read:jira-work`: read issues, links, transitions and permissions, including the bulk permission check (`permissions/check`) and the issue-deleted trigger. `write:jira-work`: due date, estimate, assignee, links, sub-task create and delete (`src/index.ts:1685`), transitions the user chooses, and the date property under DEC-3 Option C. `read:jira-user`: assignable users, and the group search for plan approvers. `storage:app`: plan records. None of these needs a new scope. Under DEC-2 Option B, add `report:personal-data`. | P0 | S |
| MK-05 | Other open rows of `developer-console-checklist.md` | Correct the production-install row and the review-time row against `marketplace-research.md` Section C. | P2 | S |
| MK-06 | "Smooth 60 fps on thousands of tasks" not measured | Measure it (`report-v2.md` section 11, performance row), or remove the number. Recommendation: remove it for v1, and add it back when measured. | P1 | S (remove) |
| MK-07 | "Zero accessibility violations" not measured | Run axe on the harness page in light and dark themes. Fix the findings (section 8, FE accessibility rows), or change the text to "Built to WCAG 2.2 AA. Report accessibility problems to support." Do not claim zero without a result. | P1 | S (text), M (axe and fixes) |
| MK-08 | Licensing not tested live | After approval, install from production on a test site with an evaluation licence. Check that an active licence works, and that a cancelled licence shows "Licence required" on load (F-21). | P1 | S (owner) |
| MK-09 | `'unsafe-inline'` styles | Allowed. Optional: move the 183 inline `style="..."` attributes to classes, and drop the permission (FE section 2). | P3 | M |

---

## 8. Frontend items not covered above

The source is `frontend-review.md`. H1 to H3 are covered by F-06, H4 by F-13, H5 by F-04, H6 by F-05 (BL-9), H7 by F-11, H8 by F-12, M2 by F-21 and M5 by F-20. Note: `frontend-review.md` M5 and section 3 cite `src/index.ts:1907` for `cascadeRemaining: []`. The correct line is `:1900`.

| ID | Problem | Recommended fix | Pri | Effort | Proof |
|---|---|---|---|---|---|
| H9 | `createInlineTask` creates the Jira issue before the plan check | Run `writablePlanId` first (BL-2 step 3). Show the message, not the raw code (M7). | P1 | S | R-14 rewritten |
| M1 | A keyboard move into a conflict: "Keep" saves nothing | Make the keyboard path save the move first and then open the dialog, the same as the mouse path. Or make "Keep" (`applyConflictKeep`) call the save. Share one handler for both paths (`legacy-planner.js:4882-4951, 4642-4645`). | P2 | S | A harness check: a keyboard move into a conflict, then Keep, saves the move |
| M3 | `MAX_CASCADE_ROUNDS` limits nothing | Make the loop in `bridge.ts:37-42` iterative, with one counter for the whole cascade, instead of a recursive `callResolver`. Stop at the cap with "The cascade did not finish. Move the task again to continue." | P2 | S | A unit test: a fake resolver that always returns remaining keys stops at 40 |
| M4 | A dependency on a backlog task is dropped on Save | List backlog tasks in the predecessor list, marked "(not scheduled)" (`legacy-planner.js:5902-5912`). Send the dependency field only when the user changed it (`:6159-6165`). | P2 | S | A harness check: save the form of a task with a backlog predecessor. The link is kept |
| M6 | Schedule flows show success after a failure | Test `ok` (F-13) in the four schedule handlers (`legacy-planner.js:1841-1847, 3173-3179, 5589-5595`). Better, merge the four copies into one function (FE section 15). | P2 | S | A harness check with a forced conflict on schedule |
| M7 | Raw codes ("conflict", "validation", "license_required") shown to users | Always show `message` when present. Keep a fixed map from code to plain text as the fallback (`legacy-planner.js:6177-6180, 2904, 6294, 6388`; `result.ts:24`). | P2 | S | A unit test for `result.ts`. A harness check with a forced conflict in the form |
| M8 | Undo overwrites a colleague's later edit | Undo sends the version from the moment the entry was made (the "after" version), not the current version (`legacy-planner.js:197, 201`). A conflict then says "DEMO-29 was changed after your edit. Undo was not applied." | P2 | S | A harness check: two tabs; edit in tab 1, edit the same task in tab 2; Undo in tab 1 is refused |
| M9 | Undo of a cascade stops at the first failure, and the entry is already on the redo stack | Move the entry to the redo stack only when every operation succeeded. On a partial failure, keep it on the undo stack with the operations that remain, and report which tasks were not restored (`legacy-planner.js:203-208`; `src/ui/undo-stack.ts:29-33`). | P2 | S | A unit test for `undo-stack.ts` |
| FE section 3 | 13 `updateWbsTask` calls send no `expectedVersion` (the last writer wins) | Send the version of the task the user edited, from each call site listed (`legacy-planner.js:690, 706, 721, 763, 778, 800, 2317, 2568, 2616, 2646, 3639, 3688, 197`). Consider making `expectedVersion` required on the server for user edits. | P2 | S | A unit test: the server refuses a user edit without a version (if made required) |
| FE section 3 | Dead try/catch blocks around `callResolver` | Remove them after F-13 makes the result handling consistent. | P3 | S | Code review |
| FE section 5 | localStorage keys not scoped to the site; the plan scope falls back to the project key alone; a malformed stored plan id is never cleared | Prefix every key with the cloud id (`cascadeplan_hidden_cols_`, `cascadeplan_zoom`, `cascadeplan_enforce_deps`, `cascadeplan_shortcuts`, `cascadeplan_hint_link`). When the stored plan id fails validation, delete it and open the Main Plan. Remove the dead hidden-columns cache. | P3 | S | A unit test for `plan-view-state.ts` with a malformed id |
| FE section 6 | The Undo button of an old flag undoes the newest action | Bind each flag's Undo to its own entry id (today it binds `undoLast`, `legacy-planner.js:176`). When that entry is not the newest, disable the button, or say "Undo the newer change first". | P2 | S | A harness check: two actions, then Undo on the first flag |
| FE section 6 | Two actions merged into one Undo entry | Settle `pendingUndo` on every path that shows a result (`legacy-planner.js:1842-1843, 3174-3175, 5590-5591`), or start a fresh snapshot for each write. | P2 | S | A harness check: two schedules, and one Undo reverts one |
| FE section 6 | Redo of a schedule writes a default due date first (`spanWeeks \|\| 1`) | Replay a schedule as one `scheduleBacklogTask` call with the recorded dates, and no `updateWbsTask` afterwards (`legacy-planner.js:195-197`). | P2 | S | The BL-3 "no unrequested write" harness check covers Undo and Redo |
| FE section 6 | `replayingUndo` is global; a parent roll-up may not be restored (Uncertain) | Queue user writes made during a replay, instead of skipping their Undo record. Add a unit test for `undo-plan.ts` with a successor that is also a Jira parent, to settle the uncertain case. | P3 | S | The new unit test |
| FE section 7 | The collapse state is lost on a plan switch or a reload | Keep the collapsed set per project in `sessionStorage` (wrapped in try/catch), and do not delete keys that are missing in the new plan. | P3 | S | Harness 4a to 4g, extended with a reload |
| FE section 9 | Hours parsed differently (`parseInt` against `Math.round`) | One parser: decimal hours rounded to 0.25, used at `legacy-planner.js:2885, 3685, 6254, 6079`. | P3 | S | A unit test for the parser |
| FE section 9 | Trigger 30 as the default when the field is empty | Require the user to choose a trigger when they choose a predecessor, or default to 100 (finish to start, the Jira meaning of "blocks") and show it. A default of 100 matches the server rule "no silent 30% default" (`src/index.ts:751-752`). | P3 | S | A harness check of the form |
| FE section 11 | Modals have no dialog role, no focus move, no focus trap and no focus return | Add `role="dialog"`, `aria-modal="true"` and `aria-labelledby` (`index.html:414, 615, 656`). Move focus to the first field on open. Trap Tab inside. Return focus to the opener on close. | P1 if MK-07 keeps an accessibility claim that needs it; P2 if MK-07 changes only the text | M | axe run. A keyboard-only harness check |
| FE section 11 | The treegrid has no expand or collapse key | ArrowRight expands and ArrowLeft collapses when focus is on a row with children (ARIA treegrid pattern), in `keyboard-grid.ts`. | P2 | S | A unit test for `keyboard-grid.ts` |
| FE section 11 | Targets below 24x24 px; no labels on the resource checkboxes; the error banner has no `role="alert"`; icon-only buttons use `title` only; the delete confirmation reverts after 4 s; focus styles not checked | Make the targets 24x24 (the `style.css` rules listed in FE section 11). Add `<label>` or `aria-label`. Add `role="alert"` to `plannerErrorBanner` (`index.html:141`). Add `aria-label` to the icon buttons. Keep the delete confirmation until the user acts or presses Escape. Check each `outline: none` for a visible replacement. | P2 | M | axe run. A contrast check in both themes |
| FE section 11 | The keyboard cannot change only the start; the bar toolbar opens only on a click | Add a key for start minus and plus (for example Shift+[ and Shift+]). Open the bar toolbar on Enter or Space when the bar has focus. | P3 | S | A unit test for `keyboard-grid.ts` |
| FE section 12 | The empty backlog text promises "drag from timeline to unmap", which does not work | Change the text to the action that works (the Unschedule action). Or make the drop work: the drop handler exists, but no dragstart sets `fromTimeline`. | P3 | S | Harness |
| FE section 13 | Hard-coded fallback `https://asymmsystems.atlassian.net`; the issue key is not URL-encoded | Remove the fallback (`legacy-planner.js:99`). When no site URL is known, use `router.open` only, and disable middle-click links. Encode the key with `encodeURIComponent` (`:116`). | P2 | S | A unit test of the URL helper with no site URL |
| FE section 15 | Dead code, unused imports and exports, duplicated handlers, `any` | Remove the dead code listed in FE section 15. Merge the four backlog-drop handlers and the two pickers. Type the `any` sites in the TypeScript files. | P3 | M | `tsc`, tests and harness all pass |
| FE section 16, item 4 | The conflict dialog opens even when the write failed | Open it only when the write returned `ok` (`legacy-planner.js:4557`). | P2 | S | A harness check |
| FE section 16, item 7 | `syncTaskResources` changes the task in memory before the call, and never rolls back | Apply the change after the call succeeds, or roll it back on failure (`legacy-planner.js:2307-2309`). | P3 | S | A harness check with a rejected assignee |
| FE section 16, item 8 | A plan rename can be sent twice (Enter, then blur) | A `done` flag in `finish` (`legacy-planner.js:1555-1559`), so that it runs once. | P3 | S | A harness check |
| FE section 16, item 9 | `JSON.parse` of dropped text without try/catch | Wrap the parse, and ignore drops that are not from the app (`legacy-planner.js:4104, 4159`). | P3 | S | A harness check that drops plain text |
| FE section 16, item 10 | `currentPlan.weeks.find` without a guard | Guard it, and show the load error when there are no weeks (`legacy-planner.js:2751`). | P3 | S | A unit or harness check |
| FE section 16, item 11 | `[` can move the end before the start | Stop at a one-day bar, and announce "The end cannot be before the start" (`src/ui/keyboard-grid.ts:65`). | P3 | S | A unit test |
| FE section 16, item 12 | Plans named with "main", "actual" or "baseline" are called baselines | BL-1 step 6 | P0 | (BL-1) | |
| FE section 16, item 13 | Batch progress announces success after a failure | F-13 | P2 | (F-13) | |

---

## 9. New items

### N-01. Planner resolvers trust the project key from the payload when the Forge context has no project

Confirmed by reading, and reproduced by FX-04.

- Both modules (`jira:projectPage` and `jira:adminPage`) use the same function, `resolver` (`manifest.yml:7-8, 14-15`). So every resolver can be called from the admin page.
- The admin page has no project in its context. There, `extractProjectKey` (`src/index.ts:2399-2406`) uses `req.payload.projectKey`, and `"DEMO"` when the payload has none. `extractProjectId` (`:2411-2414`) returns undefined, so `openStore` keys records by the project key.
- `checkPlanApprover` and `authority-check` read `req.payload?.projectKey` first, even on the project page (`:2647, 2655`).
- **Effect 1, isolation:** a user who can open the admin page (normally a Jira administrator) can call the planner write resolvers for any project key. The Jira writes still run as that user, with that user's Jira permissions.
- **Effect 2, data loss (FX-04):** a read from the admin page also runs the migration.
  - `getProjectPlan` (`src/index.ts:885`) calls `migrateIfNeeded`, which calls `ensureMigrated`.
  - `ensureMigrated` (`src/storage/plan-store.ts:225-256`) moves the legacy keys (`scheduleMap:<key>` and the others) into `cp:<projectKey>:we:`, and then DELETES the legacy keys.
  - The project page reads `cp:<projectId>:...`. So for the planner, the migrated data is lost, and the task shows in the backlog.
  - This affects only projects that still hold pre-B-09 data.
- **Recommended fix:**
  1. Give the admin page its own function (for example `admin-resolver`), with only the approver-policy resolvers. It must not import or call any planner resolver, including `getProjectPlan`, so no migration can run there.
  2. In the planner function, refuse every call that has no `context.extension.project.id`. Remove the payload and `"DEMO"` fallbacks.
  3. In `checkPlanApprover`, read the project only from the context.
  4. `isPlanApprover` and `hasTier1AdminPermission` refuse to run without a project id (F-24).
- **Priority:** P1 (part of BL-2). **Effort:** S.
- **Proof:**
  - A new unit test: call the admin function with every planner resolver name, and expect the thrown "no definition" error.
  - A new unit test: a planner resolver called without a project context is refused.
  - FX-04 rewritten: the admin-context call is refused, and the legacy keys are kept.

### N-02. Clone and delete of a large plan run in one call

Confirmed by reading (`src/storage/plan-store.ts:168-208`; `report-v2.md` section 5, "Clone").

- `createPlan` with `cloneFromPlanId` copies every record in one loop. `deletePlan` deletes every record in one loop.
- At 1,000 records, that is about 1,000 get-and-swap pairs, or 1,000 deletes, in one resolver call. That risks the 25 s limit and the KVS quota.
- The plan is listed before its records are copied. So a timeout leaves a half-cloned plan that looks complete. For a delete, the plan is removed from the list first, and a timeout leaves orphaned records.
- **Recommended fix:**
  - Under DEC-3 Option C or A, a clone copies only the per-plan fields, which shrinks the work.
  - Run the copy and the delete in pages of at most 100 records per call, with a client loop like `continueCascade`.
  - Mark a new plan as "copying" until the last page is done, and refuse writes to it until then.
  - Make the delete loop resumable from the plan's key prefix.
- **Priority:** P2. **Effort:** M.
- **Proof:** a unit test clones and deletes a 1,000-record plan in pages. A timing test in the harness keeps each call under 10 s.

### N-03. Unscheduling leaves the Jira due date, and the UI does not say so

`report-v2.md` D3 (d); `src/index.ts:1983`. Keeping the Jira due date is acceptable, but the user should know.

- **Recommended fix:** the unschedule flag says "Removed from the timeline. The Jira due date is kept."
- **Priority:** P3. **Effort:** S.
- **Proof:** a harness check of the flag text.

### N-04. The review's planner loads may have pruned DEMO records

`report-v2.md` section 10. The review opened the planner five times, and each load runs the automatic prune (F-05). There are no logs (F-21), so nobody can tell whether a record was deleted.

- **Recommended action (owner):** compare the DEMO record count per plan with a known count, before BL-9 removes the prune. If no earlier count exists, record the current count now, as the baseline for later checks.
- **Priority:** P2. **Effort:** S (owner).

### N-05. Move a parent and its sub-tasks as one block (owner requirement)

The owner's rule: moving a task that has sub-tasks moves the parent and all its sub-tasks together. The scope and the done sub-tasks follow DEC-5. The parent's Jira due date follows DEC-6. This item assumes the recommended options.

- **Behaviour:**
  1. The user drags a parent bar, uses Space on the parent row, uses the toolbar "earlier" or "later", or includes the parent in a multi-select move. Each of these moves the block by N days.
  2. Every dated sub-task that is not done moves by the same N days: the start and the end, so each keeps its length. Undated sub-tasks stay undated: the move does not schedule them. Done sub-tasks keep their dates (DEC-5).
  3. The parent's bar is the roll-up of the result. The parent's Jira due date is set to the new roll-up end (DEC-6).
  4. Each moved sub-task gets its new Jira due date. These are values the user chose by moving the block, and the drag preview lists them before the drop ("moves 4 sub-tasks; Jira due dates change for DEMO-30, DEMO-29, ...").
  5. Resizing a parent bar is not allowed. Stretching a block has no single clear meaning for its sub-tasks. The resize handles stay hidden on roll-up parents.
  6. **All or nothing.** Before any write, the server checks the permission (BL-2: `EDIT_ISSUES` and `SCHEDULE_ISSUES` on every sub-task that will move) and the version of every record. If one sub-task fails a check, nothing moves, and the user is told which sub-task blocked the move and why.
  7. **Dependencies:**
     - Links between issues inside the block keep their meaning, because both ends move by the same N days.
     - A predecessor outside the block still applies: the parent's own links apply to every sub-task (N-06 rule 5), and each sub-task's own links apply to it. A move earlier than any of these allow is handled as for a single bar: with "Enforce dependencies" on, the whole block stops at the earliest allowed day; otherwise the conflict dialog opens.
     - Successors outside the block (of the parent or of any sub-task) are cascaded as usual.
  8. **Multi-select:** if the selection holds a parent and some of its sub-tasks, each issue moves once. The sub-tasks move as part of the parent's block, not a second time.
  9. **Undo** restores the whole block in one step, including the parent's Jira due date.
- **Server design:** add a resolver `moveTaskGroup({ taskId, days, expectedVersions })`. It builds on the in-memory batch state of F-17 and the stale-read fix of F-03. It uses `reconcileIssues` for the parent and the sub-tasks. Blocks of more than 25 sub-tasks continue in later calls, as cascades do today (`bridge.ts`).
- **Client:** turn on the drag, the keyboard move and the toolbar moves for roll-up parents (remove the guards at `legacy-planner.js:4200, 4832, 5046` and in `src/ui/selection.ts:38`). Draw ghost bars for every sub-task during the drag.
- **Priority:** P1 (owner requirement). **Effort:** L. **Phase:** 3, after F-03, F-17 and BL-2.
- **Proof:**
  - Unit tests: a block of 3 sub-tasks moves by 7 days, and each keeps its length. A done sub-task keeps its dates. An undated sub-task stays undated. One sub-task that fails the permission check stops the whole move, with no write. A selection with a parent and its sub-task moves the sub-task once. Undo restores all.
  - Harness: drag a parent bar. All sub-task bars move, and the Changes panel lists each Jira due date.
  - PM-03 rewritten: a direct date update of a roll-up parent is refused, or is turned into a group move.

### N-06. Moving a sub-task: the roll-up is not kept in step (PM-01 to PM-04)

Confirmed by the review tests in `test/review/parent-move.test.ts` (5 tests, all pass at `db08009`; not committed).

- **How a sub-task move works today:** the sub-task moves freely. The parent's bar is recomputed from its sub-tasks on the next load. The rule itself is sound: under D3 and B-28, a parent has no dates of its own, so a sub-task cannot be clamped inside a parent window. A clamp would need a second set of dates for the parent, which D3 removed on purpose. **Recommendation: keep the free move**, and fix the five gaps below.
- **Gaps and fixes:**
  1. **PM-01: the parent's successors are not cascaded.** In `updateWbsTask`, the cascade input uses the parent's old roll-up (`candidateTasks` from `plan.tasks`, `src/index.ts:1793-1794`), and the cascade starts only from the moved sub-task. So a task that depends on the parent is left in violation, with no message. Fix: recompute the roll-ups in the candidate state before the cascade, and also cascade from every ancestor whose roll-up changed (sub-task, then task, then epic).
  2. **PM-02: a cascade into a parent moves nothing.** When a predecessor moves later, the cascade moves a successor that is a roll-up parent by writing the parent's record and the parent's Jira due date. The sub-tasks do not move, so on the next load the parent bar is unchanged and still in violation, and its Jira due date now disagrees with the bar. Fix: a cascade into a roll-up parent is a group move of that parent's block (N-05). Under DEC-5 Option A, a cascade into an epic is not applied. It is reported "not moved: move its stories" (F-20 `cascadeSkipped`).
  3. **PM-03: the server accepts a direct date write to a roll-up parent.** Fix: refuse it, or turn it into a group move (N-05).
  4. **PM-04: a parent with no schedule entry of its own stays in the backlog**, although its sub-task is on the timeline. Fix: a parent with at least one dated child is shown on the timeline with the roll-up, even with no entry of its own.
  5. **The parent's own links do not bind its sub-tasks.** If the parent depends on X (finish to start), the parent's work cannot start before X ends. Today a sub-task can be moved before that, and only the parent shows a violation. Fix: when the engine evaluates a sub-task, it also applies the incoming links of each ancestor (`engineInputs`, `src/index.ts:267-286`). Enforce mode then stops the sub-task at the right day.
  6. **Links between an issue and its own ancestor or descendant are allowed.** `validateDependency` (`src/domain/planner-engine.ts:159-182`) follows only the predecessor chain. A sub-task that depends on its own parent is a cycle through the roll-up, because the parent's end includes the sub-task's end. Fix: refuse such links with a plain message. Show such links imported from Jira, marked "ignored by the schedule", and leave them out of the engine. Confirmed by reading; not executed.
  7. **The parent's Jira due date** is not updated when its roll-up end changes. See DEC-6.
  8. **Screen:** during a sub-task drag, draw the parent's new span in the preview, so the user sees the parent stretch before the drop.
- **Priority:** P1 (PM-01 and PM-02 leave wrong schedules with no message). **Effort:** M. **Phase:** 2 (rules 1, 3, 4, 6), and 3 with N-05 (rule 2).
- **Proof:** PM-01 to PM-04 rewritten as regression tests. New unit tests for rules 5 and 6. A harness check: drag a sub-task past the parent's successor. The successor moves, and the parent bar and its Jira due date (DEC-6 Option A) show the new end.

### N-07. The epic picker on a sub-task row tries to make an epic the sub-task's parent

Confirmed by reading; the Jira answer is Plausible.

- Every row that is not an epic shows the epic chip, sub-tasks included (`legacy-planner.js:3460-3475`). Picking an epic sends `epicKey`, and the server writes `fields.parent = { key: <epic> }` (`src/index.ts:1335-1338`). Picking "None" sends `parent: null`.
- For a sub-task, the parent must be a standard issue, so Jira should refuse both writes. The planner then shows a failed write for a change the user meant as "set the epic".
- **Fix:** show the inherited epic of a sub-task as read-only text, with no picker. To move a sub-task under another parent, use N-08.
- **Priority:** P2. **Effort:** S.
- **Proof:** a harness check: a sub-task row has no epic picker. A unit test: the server refuses `epicKey` in an update for a sub-task, with a plain message and no Jira write.

### N-08. Making an issue a child of another issue (owner question)

The owner asked whether a task can be moved to become a sub-task of another task. The answer depends on the kind of change (DEC-7). This item assumes DEC-7 Option A.

- **Today:** the planner can change only the epic of a standard issue (R1), through the epic picker. The row drag only reorders rows (`reorderWbsTasks`). No other change of parent exists.
- **Interaction design:**
  1. Dragging a row onto the middle of another row means "make it a child of that row". Dropping between two rows keeps today's meaning: reorder. While the user drags, the target row is highlighted, and a label says which of the two will happen.
  2. Allowed drops:
     - a standard issue onto an epic row: R1 (set the epic);
     - a sub-task onto a standard issue row: R2;
     - anything else (a standard issue onto a task row, an epic onto anything, any row onto itself or onto one of its own descendants): refused, with a message. For a standard issue onto a task row, the message is "To make DEMO-41 a sub-task, convert it in Jira", with a link to the issue in Jira.
  3. Before any write, a dialog confirms the change: "Move DEMO-29 under DEMO-26? This changes the parent in Jira, so every plan shows it." Hierarchy belongs to Jira (D2), so a change made in a scenario plan changes every plan.
  4. Keyboard alternative: a "Parent" field in the task form. It lists the epics for a standard issue, and the standard issues of the project for a sub-task.
  5. Undo moves the issue back to its old parent through the same endpoint.
- **Server rules for R2** (a resolver such as `changeParent({ taskId, newParentKey, expectedVersion })`):
  1. Check `EDIT_ISSUES` on the sub-task (BL-2 table). Check that the new parent is a standard issue in the same project, and not the sub-task's current parent.
  2. **Links:** refuse the change if the sub-task has a dependency to or from the new parent or one of its ancestors. Under the roll-up, such a link is a cycle (N-06 rule 6).
  3. **Contributor sub-tasks:** if the sub-task is a contributor sub-task of the old parent (the old parent's record holds its `subtaskKey`), remove it from the old parent's contributors. Under the new parent it is an ordinary sub-task.
  4. **Roll-up:** after the write, recompute the roll-up of the old parent and of the new parent. Cascade the successors of both, and of their ancestors (N-06 rule 1). Apply DEC-6 to both parents.
  5. **Records:** the KVS record is keyed by the issue id. If the development-site test shows that the id is kept, the record needs no change. If the id or key changes, the change must be refused until a re-keying step exists.
  6. Use `reconcileIssues` for the sub-task and both parents in the search after the write (F-03).
- **R1 by drag:** it reuses the existing epic write (`src/index.ts:1335-1338`). Under a Standard plan with an old custom hierarchy, Jira can refuse with "You need to have Premium subscription to set parent...". Show that message as it is.
- **Priority:** P2 (a new feature, not a defect). **Effort:** M (R2 and the drag), S (R1 by drag). **Phase:** 5, after N-06.
- **Proof:**
  - Development-site test first (section 10, step 0).
  - Unit tests for each refused drop, for the link rule, for the contributor rule, and for the cascade of both parents.
  - A harness check: drag a sub-task onto another task. After the confirmation, both parent bars change, and Undo moves it back.
  - Live on DEMO: the Jira history of the sub-task shows the parent change (`IssueParentAssociation`). The key, the due date and the links are unchanged.

### N-09. A mouse click on a bar draws a thick black ring (owner report)

Confirmed in the harness (`harness/e2e_bar_ux_probe.py`; screenshot `harness/results-review/UX2-after-click.png`).

- **Cause:**
  - A click on a bar moves the grid focus to that row (`legacy-planner.js:4251-4262`, `focusGridCell`).
  - The canvas then strokes the bar in the focus colour at 2.25 px, and calls `ctx.drawFocusIfNeeded(this.focusElement)` (`src/frontend/canvas-timeline.ts:356-375`).
  - `drawFocusIfNeeded` draws the browser's own focus ring whenever the element has focus. It does not follow the browser's `:focus-visible` rule, which shows the ring only for keyboard use. So a mouse click gets the heavy system ring that is meant for keyboard users.
- **Recommended fix:**
  1. **A designed "selected" state** for a clicked bar: a 2 px outline in the brand colour, 2 px outside the bar, with a soft glow (the brand colour at low opacity, blur about 6 px). The bar itself keeps its fill. The same style marks every bar in a multi-select, so "selected" looks the same everywhere.
  2. **Keep a keyboard focus ring, but only for the keyboard.** Track the last input type (a `pointerdown` sets "pointer", a `keydown` sets "keyboard"). Call `drawFocusIfNeeded` only when the last input was the keyboard. Keyboard users still see where the focus is (WCAG 2.4.7).
  3. **Contrast:** the selected outline must have a contrast of at least 3:1 against the timeline background, in the light and the dark theme (WCAG 1.4.11).
  4. **Keep hover distinct from selected:** hover is a 1 px lighter outline, selected is the designed outline above, and a conflict keeps its red dashed outline.
- **Priority:** P2. **Effort:** S.
- **Proof:** the harness probe, rewritten: after a mouse click, the screenshot shows the designed outline and no system ring. After Tab focus, the focus ring is drawn. A contrast check of the outline colour in both themes.

### N-10. The link ports ("drag to link" arrows) never show (owner report)

Confirmed in the harness (`harness/e2e_bar_ux_probe.py`; screenshot `harness/results-review/UX1-hover-ports.png`).

- **What exists:** each bar has two link ports, in the style of draw.io. They are round 20 px buttons with an arrow, just outside the left and right ends (`legacy-planner.js:4218-4230`; `static/frontend/build/style.css:1547-1590`). The CSS shows them on hover (`.bar-hit:hover .bar-link-port`), and the probe measured opacity 1 on hover.
- **Cause:**
  - The bars, arrows and grid are drawn on a canvas layer (`.timeline-canvas`, `z-index: 30`, `style.css:461-464`).
  - The transparent bar hit areas and their ports sit below it (`.bar-hit`, `z-index: 20`; the ports at 26 inside the bar's own layer).
  - On hover, the canvas fills the whole hovered row with an opaque colour (`drawHoveredRow`, `src/frontend/canvas-timeline.ts:209-229`). The ports are then under that fill, so they are never visible.
  - The ports still take the pointer, because the canvas ignores the pointer. So a user who happens to press exactly there can start a link, but nobody can see that the feature exists.
- **Recommended fix:**
  1. Move the ports (and the link-drag preview controls) into an overlay layer above the canvas (`z-index` above 30), positioned from the bar's rectangle. Show them on hover after about 150 ms, while the bar is selected (N-09), and while a link drag is running. Hide them during a bar drag or resize.
  2. **Look:** a light, partly transparent circle with an arrow, about 16 px drawn inside a 24 px target (WCAG 2.5.8 asks for 24x24 px; today it is 20x20). On hover over a port: solid brand fill and a tooltip "Drag to another bar to add a dependency".
  3. **During the drag:** a dashed arrow follows the pointer (the canvas already draws it, `drawActiveLinking`). Valid target bars get a highlight. An invalid target (the same bar, an ancestor or a descendant, see N-06 rule 6) shows a "not allowed" cursor. Escape cancels.
  4. **Touch and pen:** a tap selects the bar and shows its ports, because touch has no hover.
  5. **Reduced motion:** no fade or scale animation when `prefers-reduced-motion` is set.
  6. **Keyboard:** the existing "Add dependency" action on the bar toolbar stays the keyboard route.
- **Priority:** P1 (a core feature that users cannot discover). **Effort:** M.
- **Proof:** the harness probe, rewritten: on hover, a screenshot shows both ports, and `document.elementsFromPoint` at the port centre returns the port. A harness check drags from a port to another bar and creates the link. An axe run finds no target-size problem on the ports.

---

## 10. Release gate after the fixes

Run all of these on the fixed commit before submission, and keep the results. Each step must be able to fail.

0. **(Phase 1, before the decisions are final) DEC-3 Option C test on the development site.** On a throw-away issue:
   - set `PUT /rest/api/3/issue/{id}/properties/cascadeplan.dates` as a user with Edit issues (expect success);
   - then as a Browse-only user (expect 403);
   - move the issue to another project, and read the property;
   - delete the issue, and check that the property is gone, for example by restoring the issue from the trash if the site has one.

   **(Phase 1) DEC-7 R2 test on the development site.** On throw-away issues in DEMO: create task A with sub-task S, and task B. Give S a due date, an issue link, a worklog and an issue property. Then `PUT /rest/api/3/issue/S` with `{"fields":{"parent":{"key":"B"}}}` as a user with Edit issues. Record:
   - the HTTP answer (if Jira refuses, R2 becomes an "Open in Jira" link);
   - whether the key and the id of S are unchanged;
   - whether the due date, the link, the worklog and the property are kept;
   - that the Jira history shows the parent change;
   - the answer for a Browse-only user (expect 403).
1. **Clean clone.** Start from a clone with no `packages/*/dist` built by hand and no sibling `node_modules`. Run `npm ci` in `packages/asymm-jira-ui`, then in the app and in `tools`, `tsc --noEmit`, `npm test -- --coverage` (thresholds 90), `npm run build` with no diff, the bundling of `src/frontend/admin.tsx`, and `forge lint` (BL-8).
2. **Regression tests.**
   - No test name contains "FINDING" or "GAP". A CI step greps for the two words and fails on a hit.
   - Each R number (R-01 to R-31), each FX number (FX-01 to FX-05) and each PM number (PM-01 to PM-04) has a regression test that asserts the correct behaviour.
   - CONTROL FX-01b and OK PM-00 still pass.
3. **Harness.** `e2e.py` (30 checks), `e2e_review.py` (25 checks), and the new checks named in this plan, including the search-lag check (the fake search returns the old due date on the first search after a write). All pass, with no page error.
4. **Migration rehearsal.** DEC-3, DEC-4, BL-5 and F-29 change stored records on installed sites.
   - Deploy the old version to development. Create data: several plans, contributors with and without a sub-task, links, a scenario-only task, a task whose start differs between plans, and legacy pre-B-09 keys if they can be created.
   - Count the records and save the dates per plan.
   - Deploy the new version. Check the record counts and the dates against the DEC-3 migration rules.
   - Run the migration a second time. Nothing changes.
   - Write down the rollback step (for example: keep the old records until the new version has run for N days, then delete them).
5. **Measured cost.** Run the R-28 and R-29 scenarios at 1,000 issues and 10 plans in development. Pass limits: each call under 25 s, and the KVS units per minute inside the quota (4,000 reads, 4,000 writes per installation).
6. **Deploy.** `forge deploy -e development` from the clean clone, with a build tag.
7. **Live on DEMO** (owner signs off):
   - repeat L1 to L6;
   - repeat L2 and L3 with the bar length kept at every step;
   - a multi-select move of a chain (FX-01 live);
   - the BL-2 test with a Browse-only user;
   - the BL-9 delete test (wait up to 3 minutes for the event);
   - the "no unrequested write" session, checked against the Jira history.
8. **Marketplace** (owner signs off): `forge eligibility`. The app name on the install, consent and Connected apps screens. The URL check. The claims audit. The media sizes. The Bonterms clauses read.
9. The rows of `report-v2.md` section 11 that the owner can now run: Developer Console checks, licensing on a production install, axe and a screen-reader pass, browsers other than Chrome, and performance at 1,000 issues.
10. A second independent review of the changed code. Reviews run in several rounds. Do not treat one green round as "ready to merge".

---

## 11. Items with no fix, and why

| Item | Reason |
|---|---|
| C1 (same task, same plan) | Works as expected (R-03, harness R7). |
| D10 (canvas plus treegrid) | The design is sound. Only the accessibility gaps in section 8 need work. |
| D4, D5, D7, D12 | Sound as implemented. D5 persistence and D12 live licensing are covered by the FE section 7 row and MK-08. |
| INV-01 (XSS) | Holds (FE section 1). No change. Keep the `html` tagged template as the only way to write HTML. |
| `report-v2.md` section 11 "Not run" rows | These are missing checks, not defects. They are in the release gate (section 10, steps 7 to 9). |

---

## 12. Changes

### 12.2 Changes from v2 to v3

Each change comes from the owner on 2026-11-05.

| Where | Change | Source |
|---|---|---|
| Header, 1.3 | v3 header; v2 frozen; PM tests; `reparent-research.md` | Owner additions |
| BL-8 | Owner decision: build the shared package during install (`prepare`), for all four apps. The fact about `packages/asymm-jira-ui/tsconfig.json` is stated exactly: it points to `apps/fourrealities/node_modules`, it was added in commit `990b8ea`, and it applies only when the package is type-checked on its own. The package gets its own dev install and lock file, and the setting is removed. New install order, CI steps and proof. | Owner answer to question 2 |
| DEC-5, N-05 | Move a parent and its sub-tasks as one block (owner requirement), with the scope of parents and done sub-tasks as owner choices | Owner addition |
| DEC-6 | Whether the parent's Jira due date follows its sub-tasks | Raised by the PM tests |
| N-06 | Moving a sub-task: keep the free move; fix the roll-up gaps PM-01 to PM-04, the parent's links binding its sub-tasks, and links between an issue and its own ancestors | Owner question; PM tests |
| N-07 | The epic picker on sub-task rows | Found while answering the owner's reparent question |
| DEC-7, N-08 | Making an issue a child of another issue: what Jira allows (R1 to R4), the recommended scope, and the interaction design | Owner question; `reparent-research.md` |
| N-09 | The black ring on a mouse click: the cause and a designed selected state | Owner report |
| N-10 | The link ports are hidden under the canvas: the cause and the fix | Owner report |
| F-03 | No change. The owner's second report (a bar resized after moving it back and forth, correct after a refresh) is the same defect, already fixed by F-03. | Owner report |
| Section 3 | N-05, N-06, N-07 to N-10 placed in the phases. Estimate 8 to 10 weeks. | |
| Section 10 | Step 0: the DEC-7 R2 test. Step 1: package install first. Step 2: PM tests. | |

### 12.1 Changes from v1 to v2

Each change comes from the fix-plan review (`fixplan-review.md`), unless the row says "(added in v2)". "FPR 2.1" means section 2.1 of that review.

| Where | Change | Source |
|---|---|---|
| Header, 1.3 | v2 header; frozen v1; FX tests and the GAP and CONTROL rules | FPR summary |
| DEC-1 | The review agrees; no change of substance | FPR 2.7 |
| DEC-2 | Option B needs the scope `report:personal-data` and the admin's consent again; Forge does not report automatically; Option A has an open rule for contributors without a sub-task | FPR 2.6, 2.7 |
| DEC-3 | The v1 claim "since db08009 all plans hold the same copy" is withdrawn, because it was wrong; migration rules added; Option A costs (extra scan, two versions); the scenario-cascade trade-off; new Option C (issue property) with its costs; the costs of Option C named in v2 (Changes panel, readable by Browse users, kept after uninstall); recommendation changed to "test Option C first" | FPR 2.7; the extra costs were added in v2 |
| DEC-4 | Entity index and 25-operation limit; new Option C (version keys with `FAIL_IF_EXISTS`); in v2, confirmed in the installed package, plus the numeric-ordering and quota notes; recommendation depends on DEC-3 | FPR 2.7; package check added in v2 |
| Section 3 | BL-1 step 5 moved to the start of phase 2; F-17 moved to phase 2; Option C test in phase 1; N-02 in phase 3; estimate 6 to 8 weeks | FPR 5.3 |
| BL-1 | More resolvers to remove (`getProjectPlans`, three `authority-*` aliases, `authority-check`); keep `checkPlanApprover`; proof by the thrown "no definition" error; the wrong count of "five" removed | FPR 2.1 |
| BL-2 | One wrapper for every resolver; no `CREATE_ISSUES` pre-check; bulk check facts (ids, at most 1,000, a missing id counts as denied); `EDIT_ISSUES` on the parent for `createSubtaskForResource`; no check on view settings | FPR 2.1, 5.2 U-1 and U-2 |
| BL-3 | F-23 added; multi-select move and Undo in the harness script | FPR 2.2 F-23 |
| BL-4 | Four items of Partner Agreement 8.4(e), including sharing and named countries; Bonterms name; the v1 claim that the late-fee rule "has no effect" is withdrawn, and the owner reads the clauses first; storage after uninstall marked not verified | FPR 2.1 |
| BL-5 | Rule for contributors without a sub-task key; both account id forms in the proof; the 1,000-issue limit | FPR 2.1 |
| BL-6 | Confirmed facts; `forge eligibility` after a deploy | FPR 2.1, 2.4 |
| BL-7 | Console rename confirmed; the screen names not verified, so allow time for support; do not rename storage keys | FPR 2.1 |
| BL-8 | `dist` ignored by git; recommendation to commit `dist` with a CI check (decision pending for all four apps); `prepare` as the alternative; jest mapping; four apps; `forge build` uploads; clean clone without `dist` | FPR 2.1; the recommendation between the two options was added in v2 |
| BL-9 | Both key forms; idempotent handler; 3-minute delivery and retries; payload to verify; step 3 to P3; step 4 note reworded so that it does not miscount moved issues | FPR 2.1, 5.2 U-3; the step 4 wording was added in v2 |
| F-03 | Batch input (FX-01) with F-17; `reconcileIssues` after writes and between cascade rounds; R-30 already exists, so the proof is FX-01 and a search-lag check | FPR 2.2 |
| F-04 | Snapshot on drop, not on mousedown | FPR 2.2 |
| F-06 | Client status change at `legacy-planner.js:6134-6139` changes with the server; Redo link | FPR 2.2 |
| F-07 | Two more early writes (`:1624`, `:1691`); how the link id and the sub-task key reach KVS | FPR 2.2 |
| F-08 | More failure cases; a message per field | FPR 2.2 |
| F-11 | Step 2 replaced: the change check exists; track whether the control was touched | FPR 2.2 |
| F-12 | `addDaysIso` named | FPR 2.2 |
| F-13 | Every resolver returns `ok` first; `addSubtaskToTask` added; effort M | FPR 2.2 |
| F-17 | P1, phase 2, KVS quota | FPR 2.2, 5.1 G-6 |
| F-18 | The server validates `spanWeeks` even after F-06 | FPR 2.2 |
| F-19 | Share and cascade only after Jira accepted; the rollback conflict case | FPR 2.2 |
| F-20 | Line `:1900` | FPR 2.2 |
| F-22 | Pointer to N-02 | FPR 2.2, 5.1 G-5 |
| F-23 | Drop the 8 h default; the Jira sub-task route recommended | FPR 2.2 |
| F-24 | Refuse to run without an id; `mypermissions` facts | FPR 2.2 |
| F-29 | Week key migration; effort M | FPR 2.2, 5.1 G-7 |
| C3, C6, C10 | `reconcileIssues` for the check; rollback scope; error codes, quota, clear failure, P2 | FPR 2.3 |
| MK-01, MK-04 | After deploy; the scope justifications | FPR 2.4 |
| Section 8 | Line `:1900` note; the modal priority depends on MK-07 | FPR 2.5, 6 |
| N-01 | Data-loss effect (FX-04); three additions to the fix; proof | FPR 4 |
| N-02, N-03, N-04 | New items | FPR 5.1 G-5, G-8, G-9 |
| Section 10 | Step 0 (Option C test); clean clone without `dist`; a gate that can fail; migration rehearsal; measured cost; search lag; owner sign-off | FPR 5.4 |
