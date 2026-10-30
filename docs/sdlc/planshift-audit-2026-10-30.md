# PlanShift: Technical and Commercial Audit

- **Date:** 2026-10-30
- **Audience:** Product owner deciding on production readiness and an Atlassian Marketplace listing
- **App:** PlanShift Planner (Forge app `cac8499e-e92e-4ba6-95cc-af398b1be791`), `jira:projectPage`, UI Kit (`render: native`)
- **Site:** https://asymmsystems.atlassian.net, space DEMO, development environment `5dfcdd60-51aa-4ea9-a5e2-c94d7e294677`
- **Source:** `gemini-earning/apps/planshift/` (no git repository, so files are pinned by MD5 below)

## How to read this report

- **Verdicts:** PASS, PARTIAL or FAIL for each dimension.
- **Severity:** Critical (blocks any release), High (blocks a paid listing), Medium (fix before general availability), Low (polish).
- **Evidence grade:**
  - **Observed-live:** seen in the deployed app or the Jira REST API on 2026-10-30.
  - **Observed-code:** read in the source at the cited line. The behaviour follows from the code without assumptions.
  - **Inferred:** a conclusion from code or platform behaviour that was not exercised at runtime.
  - **Reported:** taken from vendor documentation or market knowledge. Verify before you quote it externally.

### Source snapshot

| File | MD5 | Modified |
|---|---|---|
| `src/index.ts` | `d429f0e09502a7e9150372d9226b4fd4` | 2026-10-30 02:41 |
| `src/frontend/index.tsx` | `79dcd29c873d1f585bbb43ec4d1a4e15` | 2026-10-30 02:40 |
| `src/domain/planner-engine.ts` | `18970f5ee190a06443aae5591d1f5444` | 2026-10-30 01:50 |
| `src/domain/models.ts` | `2961bfc80af2b7b0c3558b322c48a88e` | 2026-10-30 14:43 (changed during this audit, see F24) |
| `src/storage/plan-repository.ts` | `25303146106382e6cb6bd7d835b4cfe8` | 2026-10-30 01:51 |
| `manifest.yml` | `5c9799d4772a34b3acdf2a6db11135cc` | 2026-10-30 01:46 |

### Limits of this audit

- I did no write actions on the live site. I did not click "Add Task / Issue" or "Save Milestone Dependency", and I did not send crafted resolver payloads. Findings on write paths and on cross-project access are therefore Observed-code, not exercised live.
- Forge backend calls to Jira run server-side and do not show in the browser network log. I traced backend calls through the source instead.
- The browser connection dropped after I opened tab 2. Tab 3 (Executive Heatmap) was not seen live; its content comes from the code at `src/index.ts:425-450`.
- The test suite ran on the snapshot: 3 suites and 40 tests, all passed.

---

## 1. Executive Summary

**Verdict: not ready for production and not listable on the Marketplace.** All six dimensions FAIL.

PlanShift is a mock-up that runs inside Jira. It does not plan Jira work. These five facts decide the verdict:

1. **The app never reads Jira issues.** The source contains no call to `/rest/api/3/search/jql` or to any other read endpoint. On first load it writes 10 invented tasks, DEMO-101 to DEMO-110, into app storage and shows them as if they were real. The live DEMO space has 25 real issues, DEMO-1 to DEMO-25. None of the 10 invented keys exists in Jira, and PlanShift shows only 3 of the 25 real issues: the ones it created itself.
2. **There is no Gantt chart.** The UI is an Atlassian `DynamicTable` with text lozenges ("Done", "Lag", "Plan") in weekly columns. There are no bars, no dependency lines, no drag and drop, and no backlog drawer. UI Kit cannot render SVG or canvas, so the chosen architecture cannot deliver the headline feature.
3. **There is no two-way sync.** The only Jira write creates an issue with a summary and nothing else. Dates, estimates and assignees are never written. Edits made in Jira are never read back.
4. **The fractional dependency engine is one comparison** (`progress >= triggerPercent`), run once when you save. It does not compute a start date, does not detect violations, does not detect cycles, and accepts a task that depends on itself.
5. **One user can read and change another project's plan.** Every resolver prefers a project key sent by the browser over the key from the trusted Forge context, and issue creation runs as the app with no permission check.

The "percent-lag" dependency idea is a real, narrow niche that incumbents do not serve well. That is the only commercial asset today, and it exists as a data field only. The estimate to reach a credible minimum viable product is a rebuild of the frontend (Custom UI) and of the data layer, not a fix list.

---

## 2. Results Matrix

| # | Dimension | Verdict | Critical | High | Medium | Low |
|---|---|---|---|---|---|---|
| 1 | Data authenticity | **FAIL** | 1 | 4 | 1 | 0 |
| 2 | Visual interface and interaction | **FAIL** | 1 | 1 | 1 | 0 |
| 3 | Bi-directional sync and integrity | **FAIL** | 1 | 1 | 0 | 0 |
| 4 | Fractional dependency engine | **FAIL** | 1 | 0 | 1 | 1 |
| 5 | Forge compliance, security, multi-tenancy | **FAIL** | 1 | 1 | 3 | 1 |
| 6 | Commercial viability | **FAIL** | 0 | 0 | 0 | 0 |
| - | Engineering process (cross-cutting) | - | 0 | 0 | 2 | 0 |
| | **Total (22 findings)** | | **5** | **7** | **8** | **2** |

Dimension 6 is graded as a market assessment (section 4), not as defects. IDs F2 and F13 are not used: those findings were merged into F1 and F6. F15 (identity) is counted under Dimension 1 and also fails the identity check in Dimension 5.

**Sub-items that PASS:**

- Cross-tenant isolation: Forge KVS is scoped per installation by the platform. One customer site cannot read another. (Inferred, platform behaviour)
- No email addresses or other unredacted personal data are stored. (Observed-code)
- Forge invocation time: current resolvers make at most one Jira call, so they are far below the 25 s limit. This changes once real reads exist (F22). (Inferred)

---

## 3. Detailed Findings

### Dimension 1: Data authenticity - FAIL

#### F1. Critical. The planner shows invented tasks and never reads Jira issues
**Evidence:** Observed-live and Observed-code.

- `src/index.ts:72-232` `createDefaultTasks()` builds 10 tasks with keys `${projectKey}-101` to `-110`, invented summaries ("Cloud Architecture Setup", "Payment Gateway Integration"), resources ("Resource 1", "Resource 2"), progress values and dates.
- `src/index.ts:253-270` `getProjectPlan()` writes these tasks to KVS when no plan exists. It does not first check Jira, so an empty project and a full project get the same 10 tasks.
- The source has no call to `/rest/api/3/search/jql`, `/search`, or any GET on issues. The only Jira call is the POST at `src/index.ts:294`.
- **Live:** `GET /rest/api/3/search/jql?jql=project=DEMO` returned 25 issues (`isLast: true`), DEMO-1 to DEMO-25. Keys DEMO-101 to DEMO-110 do not exist. The PlanShift page shows DEMO-101 to DEMO-110 plus DEMO-23, DEMO-24 and DEMO-25. The other 22 real issues are absent.
- DEMO-23 to DEMO-25 appear only because PlanShift created them through its own "Add Task" flow (summary "LSQA Visual Planner Task 1") and appended them to its own store.

**Impact:** A buyer who opens the app sees a plan that is not theirs. The invented keys will collide with real keys: once the project reaches issue 101, "DEMO-101" in PlanShift and DEMO-101 in Jira will be different items, and `updateWbsTask` looks tasks up by key (`src/index.ts:355`).

**Reproduce:**
1. Open https://asymmsystems.atlassian.net/rest/api/3/search/jql?jql=project%3DDEMO&fields=summary&maxResults=100 and note keys DEMO-1 to DEMO-25.
2. Open Demo service space > Apps > PlanShift Planner.
3. Compare: the table lists DEMO-101 to DEMO-110, which step 1 does not return.
4. Empty-project case: install on a new space with no issues. The same 10 tasks appear (code path `src/index.ts:254`).

#### F7. High. Failed issue creation returns success with an invented key
**Evidence:** Observed-code. A test asserts this behaviour.

- `src/index.ts:289` sets a fallback key `DEMO-${Date.now().toString().slice(-4)}`. The prefix is the literal "DEMO" in every project.
- `src/index.ts:305` ignores any status other than 201 (400, 403, 404).
- `src/index.ts:310` `catch {}` discards network and permission errors.
- `src/index.ts:340` always returns `success: true`.
- `test/index.test.ts:160-179` asserts that a Jira error produces a `DEMO-` key and `success: true`.

**Impact:** When creation fails, for example because the space has no "Task" issue type (`src/index.ts:301`) or the app lacks permission, the user sees a new row with a fake key and no error.

**Reproduce:** In a space whose issue types do not include "Task", click "+ Add Task / Issue", enter a summary and save. A row with key `DEMO-NNNN` appears, and no Jira issue exists.

#### F8. High. The executive heatmap invents people and organisation data
**Evidence:** Observed-code.

- `src/index.ts:234-241` `DEFAULT_RESOURCE_METADATA` hardcodes six resources with CoE, vertical and project names ("Fintech Core", "Enterprise Risk", "Project 3").
- `src/index.ts:418-421` writes them to KVS for every project.
- `src/index.ts:425-450` adds rows for "Resource 3" to "Resource 6" with 100% utilization in every past week and the next week. The comment says "Synthesize rows ... to match Mockup 3".
- `src/frontend/index.tsx:439-459` hardcodes the filter options "Project 1/2/3" and three CoEs.

**Impact:** An executive view that reports invented staff as fully utilized is the most damaging kind of fake data for a buyer.

**Reproduce:** Open tab 3 in any project. Rows for Resource 3 to 6 appear, although no task is assigned to them.

#### F11. High. The calendar is hardcoded to July to October 2026, and "now" is fixed at 26 August
**Evidence:** Observed-live and Observed-code.

- `src/index.ts:52-68` `DEFAULT_WEEKS` has 15 fixed weeks from 15-Jul to 21-Oct, including invented sprint names ("Env Delay").
- `src/domain/models.ts:130` `CURRENT_WEEK_INDEX = 6`, a constant.
- `src/frontend/index.tsx:331` hardcodes the legend "Current Week: 26-Aug".
- **Live:** on 2026-10-30 the page shows "Current Week: 26-Aug", and the last column is 21-Oct. Today is outside the timeline.

**Impact:** "Behind schedule" and utilization states are computed against a fixed date. All status colours are wrong for every real customer on every day except one.

#### F15. High. Resources are free text, not Jira users
**Evidence:** Observed-code. This finding also belongs to Dimension 5.

- `WbsTask.resource` is a string. `resourceAccountId` is declared (`src/domain/models.ts:40`) but never set or read.
- The create form takes the resource as a free-text field (`src/frontend/index.tsx:504-510`), and the value is not sent to Jira as an assignee.
- The Jira assignee is never read.

**Impact:** Fails the brief's requirement that identities be bound to a verified `accountId` and `displayName`. Capacity cannot be tied to real people.

#### F19. Medium. The create form ignores dates and uses fixed allocations
**Evidence:** Observed-code.

- The start and end date state exists (`src/frontend/index.tsx:60-61`), but the modal renders no date inputs. Every task gets 2026-08-26 to 2026-09-16.
- `src/index.ts:325` hardcodes `weeklyAllocations: { '26-Aug': 50, '02-Sep': 50 }` whatever the dates are.
- The issue type "Task" is hardcoded (`src/index.ts:301`). The Epic and Story values are kept only in KVS and are not linked as Jira parent issues.

---

### Dimension 2: Visual interface and interaction - FAIL

#### F4. Critical. The interface is a table with text badges, not a Gantt chart
**Evidence:** Observed-live and Observed-code.

- `manifest.yml` declares `render: native` (UI Kit). UI Kit renders only Atlassian components. It cannot draw SVG or canvas, and it has no drag-and-drop primitives. (Reported: Forge UI Kit component model.)
- `src/frontend/index.tsx:335` renders `DynamicTable`. Each week cell is a `Lozenge` that reads "Done", "Lag" or "Plan" (`:214-227`).
- Dependencies appear as a text lozenge, "Dep: DEMO-106 >= 30%" (`:186-190`). There are no connector lines.
- No drag handlers, edge handles or backlog drawer exist anywhere in the source.
- **Live:** screenshot confirms a 15-column table of lozenges.

**Impact:** Every interaction claim in the brief (bars, progress fill, vector connectors, drag to move, drag to resize, drag from backlog) is absent. The fix is an architecture change to Forge Custom UI, not an incremental edit.

#### F12. High. Status colours and utilization numbers are wrong
**Evidence:** Observed-live and Observed-code.

- `src/domain/planner-engine.ts:55-57`: in any past week, a task with progress above 0 and at or above target gets `COMPLETED`, shown as a green "Done" lozenge. **Live:** DEMO-101, DEMO-102, DEMO-103 and DEMO-108 are at 20% progress and show "Done" in every past week.
- `src/domain/planner-engine.ts:136-141`: weeks without an explicit allocation get `100 / number of tasks`. Explicit and implied values mix in one row. **Live:** Resource 1 has filler cells of "13%" and a total of 313% in the 26-Aug week. Resource 2 shows 170% in 19-Aug.
- `src/frontend/index.tsx:153` omits `projectName`, so tab 2 labels every row "Current Project".
- Seed data contradicts itself: DEMO-109 is `NOT_STARTED` at 20% progress (`src/index.ts:209-211`).

#### F18. Medium. The heatmap filters use the previous filter value
**Evidence:** Observed-code.

- `src/frontend/index.tsx:436-437` calls `setFilterProject(opt.value)` and then `loadData()` at once. `loadData` reads `filterProject` from the closure, which still holds the old value, so each fetch uses the previous choice. The same applies to CoE at `:451-452`.
- The vertical filter has state (`:47`) but no control.

**Reproduce:** In tab 3, set Project to "Project 2". The rows still reflect "ALL". Set it to "Project 3". The rows now reflect "Project 2".

---

### Dimension 3: Bi-directional sync and integrity - FAIL

#### F5. Critical. Neither direction of sync exists
**Evidence:** Observed-code.

**Planner to Jira:**
- The only write is `POST /rest/api/3/issue` with `project`, `summary` and `issuetype` (`src/index.ts:294-304`).
- `duedate`, the start date field, `timetracking.originalEstimate`, `assignee` and `parent` are never sent.
- `updateWbsTask` (`src/index.ts:346-372`) changes KVS only. The frontend never calls it, so the UI has no way to edit progress, dates, effort or resource at all.

**Jira to planner:**
- No reads (F1). No Forge product-event triggers such as `avi:jira:updated:issue` in `manifest.yml`. Edits made in Jira never appear.
- **Live example:** DEMO-14 and DEMO-20 were edited in Jira ("LSQA Story 3 EDITED") and do not appear in PlanShift.

**Reproduce:** Change the due date of DEMO-23 in Jira, then click Refresh in PlanShift. Its row is unchanged, because the start and end dates come from KVS.

#### F10. High. Concurrent edits overwrite each other silently
**Evidence:** Observed-code.

- The whole plan is one KVS value under `ps:plan:${projectKey}` (`src/storage/plan-repository.ts:22, 37-39`).
- Every write does read, modify, write with no version check, no ETag and no KVS transaction (`src/index.ts:330-338, 354-370, 385-400`). `lastUpdated` is written but never compared.
- In `createInlineTask`, the Jira issue is created before the KVS save. If the save fails, the Jira issue is orphaned with no rollback.

**Reproduce (Inferred):** Two users click "Add Task" at nearly the same moment. Both resolvers read the plan with N tasks. Each appends one and saves. The final plan has N+1 tasks, and one Jira issue exists in Jira but not in the plan.

---

### Dimension 4: Fractional dependency engine - FAIL

#### F6. Critical. The engine compares two numbers once and never again
**Evidence:** Observed-code and Observed-live.

- `src/domain/planner-engine.ts:72-89` `evaluateDependency` returns `predecessor.progress >= triggerPercent`. There is no date arithmetic, no effort, no velocity and no earliest-start calculation.
- It runs only inside `saveTaskDependency` (`src/index.ts:392`). It does not run again when the predecessor's progress changes, so `isTriggerSatisfied` goes stale.
- The seed hardcodes `isTriggerSatisfied: true` (`src/index.ts:182`).
- No violation check compares the successor's start date with the predecessor's progress. An unsatisfied rule shows a yellow `moved` lozenge (`src/frontend/index.tsx:187`), not red, and sends no notification.
- No cycle detection: the source has no graph traversal. A task can name itself as predecessor, and A to B to A is accepted.
- One dependency per task: `dependency?` is a single field (`src/domain/models.ts:50`), so a second save replaces the first.
- An unknown predecessor key is accepted and saved as "not satisfied", with no error (`src/index.ts:391-397`).
- **Live:** DEMO-107 shows a green "Dep: DEMO-106 >= 30%" lozenge and red "Lag" in four weeks at 0% progress. The two signals contradict each other, and nothing marks the conflict.

**Reproduce:**
1. In the tracking view, click "Dep" on DEMO-107. Enter predecessor `DEMO-107` (itself) and threshold `30`. Save. It is accepted.
2. Click "Dep" on DEMO-106 and enter `DEMO-107`. Then click "Dep" on DEMO-107 and enter `DEMO-106`. Both are accepted, which makes a cycle.

#### F14. Medium. Threshold input is not validated, and 0% cannot be set
**Evidence:** Observed-code.

- `src/frontend/index.tsx:124` uses `Number(depTriggerPercent) || 30`. Input "0" becomes 30, because 0 is falsy. "abc" becomes 30 silently. -50 and 250 are accepted.
- The backend does no validation.

#### F21. Low. A dependency storage key is written and never read, and it is not scoped to a project
**Evidence:** Observed-code.

- `src/index.ts:399` writes `ps:dep:${taskId}`. `getTaskDependency` is never called.
- The key has no project prefix, so equal task IDs in two projects share one key.

---

### Dimension 5: Forge compliance, security and multi-tenancy - FAIL

#### F3. Critical. Any user can read and change any project's plan
**Evidence:** Observed-code. Not exercised live.

- All five resolvers take `req.payload?.projectKey` first and the trusted `req.context.extension.project.key` only as a fallback (`src/index.ts:465, 470, 475, 480, 485`). The payload is controlled by the browser.
- No resolver checks the caller's permissions (no `/rest/api/3/mypermissions` call).
- `createInlineTask` creates the issue `asApp()` (`src/index.ts:294`), so it uses the app's permissions, not the user's.

**Impact:** A user who can open PlanShift in project A can read project B's plan, add or change tasks and dependencies in it, and create Jira issues in B even without "Create issues" permission there. Atlassian's Marketplace security requirements expect the app to enforce the user's authorization for actions the user starts. (Reported)

**Reproduce (Inferred, do it only in a test site):** Open PlanShift in project A. In the browser devtools console of the app frame, call the bridge `invoke('getProjectPlan', { projectKey: 'B' })`. B's plan is returned. `invoke('createInlineTask', { projectKey: 'B', summary: 'x' })` creates an issue in B as the app.

**Fix:** Take the project key from `req.context` only. Make user-initiated Jira calls with `asUser()`, or check permissions explicitly before an `asApp()` call.

#### F9. High. Issues are created as the app, so Jira's audit trail is wrong
**Evidence:** Observed-code.

- `asApp()` at `src/index.ts:294` makes the app the reporter and creator. The Jira history does not show which person asked for the change.

#### F16. Medium. A scope is unused, and licensing is not declared
**Evidence:** Observed-code.

| Scope | Used today? | Needed after the fix? |
|---|---|---|
| `read:jira-work` | No (no reads) | Yes (search, fields) |
| `write:jira-work` | Yes (create) | Yes (create and update) |
| `read:jira-user` | **No** | Only if user profiles are read beyond the issue's assignee object |
| `storage:app` | Yes (KVS) | Yes |

- Remove `read:jira-user` until a call needs it. Extra scopes trigger extra review and slow customer approval.
- `manifest.yml` has no `app.licensing` block. A paid Marketplace app needs licensing enabled and a license check before it serves data. (Reported)

#### F17. Medium. `updateWbsTask` accepts any field from the browser
**Evidence:** Observed-code.

- `src/index.ts:360-363` spreads `updates` into the stored task without an allow-list. A crafted call can overwrite `id`, `key` or `dependency`, or inject unbounded strings. No resolver validates length or type.
- The UI never calls it, but the bridge exposes it.

#### F22. Medium. One KVS value holds the whole plan, which caps project size
**Evidence:** Inferred. The limit is Reported.

- The plan is one value. Forge KVS limits each value's size (Atlassian documents about 240 KiB per value; verify the current figure). At about 600 bytes per task, the cap is a few hundred tasks.
- After F1 is fixed, paging `/search/jql` for a large project inside one invocation also risks the 25 s timeout. Store only data that exists in the app alone (dependencies, allocations), one key per issue, and read issue fields live with paging.

#### F23. Low. The icon is hotlinked from raw.githubusercontent.com
**Evidence:** Observed-code.

- `manifest.yml:5`. It is a third-party availability dependency, and the generic Trello-style icon has branding risk. Package the icon with the app.

---

### Engineering process (cross-cutting)

#### F20. Medium. Tests pass by asserting the fake behaviour
**Evidence:** Observed (test run: 40 of 40 passed).

- `jest.config.js:9` excludes `src/frontend/**` from coverage, so the "100%" figure ignores the whole UI.
- The Jira mock always returns 201. No test covers reading issues, because no code reads them.
- Tests assert the seed data (`test/index.test.ts:101-111`) and the fake-key fallback (`:160-179`). When the fake data is removed, those tests should fail. Today they protect the defect.

#### F24. Medium. The source has no version control and was changing during the audit
**Evidence:** Observed.

- `gemini-earning/apps/planshift` is not a git repository. No commit identifies the deployed build.
- `src/domain/models.ts` was rewritten at 14:43 while this audit ran. Its header now reads "CascadePlan" and it adds type fields (`backlogTasks`, `isViolated`, `isLiveSynced`, `spanWeeks`, `ScheduleBacklogRequest`). No code uses these fields yet, so the findings above still apply.
- The deployed app matches the earlier source (live behaviour equals the code paths cited).

**Impact:** Nobody can prove which source produced the deployed app. That blocks any security self-assessment or Marketplace review answer.

---

## 4. Dimension 6: Commercial Viability - FAIL (as built)

### Competitive position

Competitor facts in this table are Reported (market knowledge). Check current listings before you quote them.

| Capability | PlanShift today | Jira Plans / Timeline | BigPicture (Appfire) | Structure + Gantt (Tempo) | ActivityTimeline |
|---|---|---|---|---|---|
| Reads real Jira issues | No | Yes | Yes | Yes | Yes |
| Gantt bars, drag and resize | No | Yes | Yes | Yes | Calendar-style |
| Dependencies drawn as links | No (text) | Yes | Yes | Yes | Limited |
| Progress-threshold ("percent-lag") dependency | Data field only | No (Reported) | Not as a first-class type (Reported) | Not as a first-class type (Reported) | No (Reported) |
| Critical path | No | No (Reported) | Yes | Yes | No |
| Baseline vs actual | No | Limited | Yes | Yes | No |
| Capacity by real users | No (free text) | Teams-based | Yes | Via resources | Core strength |
| Export (PDF, Excel) | No | Partial | Yes | Yes | Yes |
| Portfolio across projects | Fake rows | Premium tier | Yes | Yes | Yes |

### Missing table stakes

Real Jira data with the Epic > Story > Task hierarchy from `parent`, a dynamic calendar from today's date and the project's sprints, drag scheduling, Jira issue-link dependencies, critical path, baselines, export, multi-project scope, holidays and working hours, and permission-correct access.

### The wedge

A **progress-threshold dependency** says "B may start when A reaches 30%". Standard tools model start-to-start with a *time* lag, not a *progress* lag. For teams that hand work over in stages (design to build, build to test), that rule is closer to how they think. It is a credible differentiator if it is built properly: computed earliest starts, live violation alerts, and an explanation of *why* B is blocked.

It is a feature, not a product. On its own it does not beat a free Jira timeline. It has to sit on a planner that already meets the table stakes.

### Pricing and willingness to pay

- **Today:** no buyer will pay. The app shows invented data in a buyer's own project. A trial would harm the brand.
- **After the roadmap below:** position it as a lightweight planner priced under the heavy portfolio tools, with progress-based dependencies as the headline. Jira's built-in timeline is free, and Plans is bundled with Premium. That sets the price ceiling for "lightweight". Set the tiers only after you benchmark the current Marketplace listings for BigPicture, Structure and ActivityTimeline. I have not verified their current prices for this report.

---

## 5. Remediation Roadmap

The phases are ordered by dependency. Each phase ends with a check that proves it is done.

### Phase 0: Stop-ship fixes (days)

| Action | Closes | Done when |
|---|---|---|
| Put the app under git, tag the deployed build, and record the deploy SHA | F24 | `forge deploy` output and the tag match |
| Remove `createDefaultTasks`, `DEFAULT_RESOURCE_METADATA`, the synthetic heatmap rows and the hardcoded filter options. Show a real empty state | F1, F8 | Install on an empty space shows "No issues yet" |
| Take `projectKey` from `req.context` only. Use `asUser()` for user-initiated writes | F3, F9 | A bridge call with another project key is rejected |
| Return errors from `createInlineTask`. Remove the `DEMO-` fallback | F7 | A failed create shows an error and adds no row |
| Rewrite the tests that assert fake behaviour. Include the frontend in coverage | F20 | The old seed tests are gone, and a test fails if seeding returns |

### Phase 1: Real data layer

- Read issues with `GET /rest/api/3/search/jql`, paged with `nextPageToken`. Request `summary, status, assignee, parent, issuetype, duedate, timetracking` and the site's start-date field (find its id via `GET /rest/api/3/field`).
- Build the hierarchy from `parent`. Map status by `statusCategory`, not by name.
- Bind resources to `assignee.accountId` and show `displayName`. Store no emails.
- Keep only app-specific data in KVS (dependencies, weekly allocations, baselines), one key per issue id, prefixed with the project.
- Compute the calendar from today's date and the project's sprints, or from a configurable week range. Delete `DEFAULT_WEEKS` and `CURRENT_WEEK_INDEX`.
- Fix the "Done" rule and the utilization filler (F12).
- **Note:** DEMO is a service-management space. Test planning in a Jira Software space as well, where epics, sprints and estimates exist.

### Phase 2: Two-way sync and integrity

- Write moves and resizes with `PUT /rest/api/3/issue/{id}` (`duedate`, start-date field, `timetracking.originalEstimate`, `assignee`).
- Subscribe to `avi:jira:updated:issue`, `avi:jira:created:issue` and `avi:jira:deleted:issue` triggers to refresh app data.
- Add optimistic concurrency: store a version per record, and reject a stale write with a "changed by someone else" message. Roll back UI state on failure.
- Create the KVS record before or in the same step as the Jira issue, or remove orphans on failure.

### Phase 3: Gantt UI

- Move to Forge Custom UI (`resource` with a static build). Render the timeline as SVG: bars with progress fill, edge handles for duration, drag for start date, and a backlog drawer for unscheduled issues (issues with no start date).
- Draw dependencies as SVG connectors. Anchor the line at the predecessor's threshold point on its bar (for example at 30% of its length) so the "percent-lag" rule is visible.
- Add keyboard alternatives for every drag action. Marketplace reviewers and enterprise buyers check accessibility.

### Phase 4: Dependency engine

- Allow many predecessors per task and store them as a graph.
- Reject a cycle on save with a depth-first search or Kahn's algorithm. Report the cycle path.
- **Earliest start of B** when it waits for A to reach X%:
  - A not started: `start(A) + (X/100 × effort(A)) / plannedRate(A)`
  - A in progress at p% on date `now`: `now + ((X − p)/100 × effort(A)) / observedRate(A)`, where `observedRate(A) = (p/100 × effort(A)) / (now − start(A))`
  - State which rate is used, and show it in the tooltip so the date is explainable.
- **Violation:** B's start date is earlier than its computed earliest start, or B is in progress while A is below X%. Show a red connector and a warning, and offer to notify the assignee.
- Validate the threshold as an integer from 0 to 100, with 0 allowed.
- Option: mirror each dependency as a Jira issue link, so it is visible outside the app.

### Phase 5: Marketplace readiness

- Add `app.licensing` and a license check. Trim scopes to the calls that remain.
- Complete Atlassian's security self-assessment. Publish a privacy policy and a data-handling statement. If the app stores `accountId` values, confirm the current Forge personal-data reporting requirement. (Reported, verify)
- Load-test with 5,000 issues: page sizes, invocation time and KVS key counts.
- Then add critical path, baselines and PDF/Excel export, in that order of buyer impact.

---

## Appendix: Live evidence captured on 2026-10-30

- Jira search for `project=DEMO` returned 25 issues, keys DEMO-1 to DEMO-25. None has a due date or an original estimate set.
- The PlanShift tracking view listed DEMO-101 to DEMO-110 plus DEMO-23, DEMO-24 and DEMO-25. It showed "Completion: 28%" and "Current Week: 26-Aug".
- Clicking Refresh made two GraphQL invocations (the two resolvers `getProjectPlan` and `getPortfolioResourceHeatmap`). The browser made no other Jira requests.
- Tab 2: Resource 1 total utilization 313% in week 26-Aug. Several cells show "13%" filler. Every row is labelled "Current Project".
- Screenshots (local to the auditor's machine): `/tmp/claude-chrome-screenshots-gyc9Fz/screenshot-1793351511267-0.jpg` (tab 1), `/tmp/claude-chrome-screenshots-gyc9Fz/screenshot-1793351692919-1.jpg` (tab 2).
