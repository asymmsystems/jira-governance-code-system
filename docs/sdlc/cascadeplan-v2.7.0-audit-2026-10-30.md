# CascadePlan v2.7.0: GA and Marketplace Readiness Audit

- **Date:** 2026-10-30 (live tests run 20:45 to 21:15 IST)
- **Audience:** Product Owner and Engineering Leadership, deciding on general availability (GA) and a commercial Atlassian Marketplace listing
- **App:** CascadePlan Planner, Forge app `cac8499e-e92e-4ba6-95cc-af398b1be791`, module `cascadeplan-project-planner` (`jira:projectPage`, Custom UI)
- **Site:** https://asymmsystems.atlassian.net, space DEMO (Jira Service Management, company-managed), Forge environment `development` (`5dfcdd60-51aa-4ea9-a5e2-c94d7e294677`)
- **Release under review:** tag `v2.7.0`, commit `eaa725b`, working tree clean
- **Previous audit:** `docs/sdlc/planshift-audit-2026-10-30.md` (PlanShift, 22 findings F1 to F24). Section 5 tracks each one.

## How to read this report

- **Verdicts:** PASS, PARTIAL or FAIL for each dimension.
- **Severity:**
  - Critical: blocks any release.
  - High: blocks a paid listing.
  - Medium: fix before GA.
  - Low: polish.
- **Evidence grade:**
  - **Observed-live:** seen in the deployed app or the Jira REST API on 2026-10-30.
  - **Observed-code:** read in the source at the cited line. The behaviour follows from the code without assumptions.
  - **Inferred:** a conclusion from code or platform behaviour that was not exercised at runtime.
  - **Reported:** taken from vendor documentation or public pricing. Verify before you quote it externally.
- File paths are relative to `apps/planshift/`. The shipped UI is `static/frontend/build/index.html`. `src/frontend/index.tsx` is dead code (finding C19).

### Source snapshot (tag v2.7.0)

| File | MD5 |
|---|---|
| `src/index.ts` | `785955cc793250cd1c69791a5fd0ea8e` |
| `src/domain/planner-engine.ts` | `46201649f4314c8e6692e0f90c3b92a9` |
| `src/domain/models.ts` | `fa35c52646639f5a88e716a1e4cd80a4` |
| `src/storage/plan-repository.ts` | `25303146106382e6cb6bd7d835b4cfe8` |
| `static/frontend/build/index.html` | `82d65e4223655d05bd0be1cffd0077ee` |
| `static/frontend/build/style.css` | `955e318e72eb806dcc618003d88ea639` |
| `manifest.yml` | `29b96d9a8461496cc398354352ddac5a` |

### What was tested, and the limits

- **Tests:** `jest --coverage` on the tag. 3 suites, 111 tests, all pass. Line coverage is 100% and branch coverage is 91%. Coverage excludes the shipped UI (C19).
- **Forge CLI:**
  - `forge lint`: no issues.
  - `forge eligibility -e development`: "version 2.7.0 ... is eligible for the Runs on Atlassian program".
  - `forge deploy list`: last deploy 2026-10-30T12:27:16Z, build tag N/A.
- **Live writes I made, and how I reverted them:**
  1. I resized the DEMO-25 bar by one week. This wrote an original estimate to Jira.
  2. I opened the edit modal and clicked Save. Nothing was written.
  3. I clicked "Create & Schedule". Nothing was created.
  4. I changed DEMO-25's summary, due date and estimate through the REST API, to test read-back.
  5. I restored DEMO-25 through the REST API: summary "LSQA Visual Planner Task 1", no due date, no estimate.
  - **Not reverted:** Jira's changelog keeps the history entries. The app's storage keeps a schedule entry for DEMO-25, because the UI has no way to remove one.
- **Not done:**
  - **Brand-new empty project:** I did not create one, because that changes the site's configuration. The near-empty project TEST (1 issue) was used instead. The empty-project result is Observed-code plus the TEST observation.
  - **Backlog drag:** dragging a card from the Backlog Tray to the timeline did not fire in browser automation. The tray uses native HTML5 drag-and-drop, which automation often cannot trigger. That result is Observed-code only.
  - **Crafted cross-project calls:** not sent. Tenant isolation is Observed-code.
- **Iframe access:** the app's iframe is cross-origin, so its DOM, console and CSP header could not be read. Behaviour was checked by screenshots and by Jira-side effects.

---

## 1. Executive Summary

**Verdict: NO-GO for GA and NO-GO for a commercial listing. Readiness score: 24 / 100.**

v2.7.0 is real progress since the PlanShift audit:

- The app now reads live Jira issues. DEMO-1 to DEMO-26 appear with real keys, summaries and issue types.
- It renders a real Custom UI Gantt: continuous bars, a two-tone progress fill, SVG dependency curves and a TODAY marker.
- It writes to Jira as the signed-in user, not as the app.
- It takes the project key from the trusted Forge context.
- It ships its icon locally and qualifies for Runs on Atlassian.

The release still fails on the things a buyer tests first:

1. **Every editing action in the UI does nothing** (C1, Observed-live).
   - The task modal's Save and Cancel do nothing, and the modal cannot be closed without reloading the page.
   - "Create & Schedule", "Create Epic" and "Add Subtask" do nothing.
   - Cause: these buttons use inline `onclick=` attributes, which the deployed page does not execute. Handlers attached with `addEventListener` work.
   - The user cannot edit a summary, assignee, status or dependency, and cannot create a task.
2. **The one write that works corrupts Jira data** (C5, Observed-live). Resizing a bar writes `weeks × 15h` into the issue's original estimate. DEMO-25 received "1w 4d 3h" (75h) because its bar was 5 weeks long.
3. **Invented data is still shown as if it were the customer's** (C2, Observed-live). Every unestimated issue shows 40h. Every in-progress issue shows 30% progress. Every task has a 20% target, the epic "Prerequisites" and the resource "Resource 1". The plan also shows:
   - three milestones nobody created,
   - an invented "Backend & Cloud / Fintech Core" organisation,
   - a 30% dependency chain between the first six issues, which nobody configured.
4. **The headline differentiator cannot be used** (C3, Observed-code). The fractional dependency engine, its cycle detection and its Jira issue-link mirroring exist only behind a resolver that the UI never calls. Even with C1 fixed, the save path drops the `dependency` field.
5. **The "dynamic" calendar is fixed to a literal date** (C4, Observed-code). It is built from `new Date('2026-10-30')`. It is correct today only by coincidence, and the TODAY marker will stay on the 28-Oct week from next week onward.

The engineering direction is right, and most fixes are contained: event wiring, removing defaults, and a real date and storage model. This is no longer a rebuild. I estimate 3 to 5 focused weeks to a credible beta, and a further cycle for licensing, scale and accessibility before a paid listing (Inferred).

---

## 2. Audit Results Matrix

| # | Dimension | Verdict | Critical | High | Medium | Low |
|---|---|---|---|---|---|---|
| 1 | Data authenticity and Jira ingestion | **FAIL** | 1 | 2 | 0 | 0 |
| 2 | Visual interface and interaction (Custom UI) | **PARTIAL** | 1 | 0 | 2 | 1 |
| 3 | Bi-directional sync and concurrency | **FAIL** | 1 | 4 | 2 | 0 |
| 4 | Fractional dependency engine | **FAIL** | 1 | 1 | 1 | 0 |
| 5 | Forge compliance, security, multi-tenancy | **PARTIAL** | 0 | 2 | 1 | 2 |
| 6 | Commercial viability and market fit | **FAIL (as built)** | 0 | 0 | 0 | 0 |
| - | Engineering process (cross-cutting) | - | 0 | 0 | 1 | 0 |
| | **Total: 23 findings (C1 to C23)** | | **4** | **9** | **7** | **3** |

C1 is the root cause for parts of Dimensions 2, 3 and 4. It is counted once, under Dimension 2. Dimension 6 is a market assessment (section 4), not a defect count.

### Sub-items that PASS

| Check | Evidence |
|---|---|
| Live ingestion through `/rest/api/3/search/jql` with the requested fields | Observed-code `src/index.ts:183-185`. Observed-live: 26 of 26 DEMO issues appear, 6 on the timeline and 20 in the tray. |
| Synthetic keys DEMO-101 to DEMO-110 and the `createDefaultTasks` seed are gone | Observed-code, Observed-live |
| The Backlog Tray shows real keys, summaries, issue types and the real assignee (DEMO-17 "Fahim Farook") | Observed-live |
| Continuous `.gantt-bar` with `.gantt-bar-fill-actual` and `.gantt-bar-fill-planned` | Observed-code `index.html:567-592`, Observed-live |
| SVG `.dep-path` curves, `.dep-path.violated` drawn red and dashed, redrawn on window resize | Observed-code `index.html:693-753, 308-310`, Observed-live (red curve into DEMO-22) |
| Drag a bar to move it, and right-edge resize (mouse events) | Observed-live: the resize took effect and was saved |
| View switcher toggles the three views | Observed-live |
| Writes run as the user (`asUser()`) | Observed-live: DEMO-25 changelog author "Fahim Farook", `accountType: atlassian` |
| Project key comes from trusted context (closes F3) | Observed-code `src/index.ts:866-873` |
| Allow-list on task updates (closes F17) | Observed-code `src/index.ts:682-692` |
| Icon packaged locally (closes F23) | Observed-code `manifest.yml:5`, `static/frontend/build/icon.svg` |
| Runs on Atlassian eligibility | Observed-live (`forge eligibility`) |
| Scopes justified by code | Observed-code (C17 table) |
| No email addresses stored. Placeholder identities use the `ph:` prefix and are never sent to Jira. | Observed-code `src/index.ts:92-99, 601` |
| Cycle detection rejects self, direct and multi-hop cycles and names the chain (engine only) | Observed-code `planner-engine.ts:140-185`. The tests pass. Not reachable from the UI (C3). |

---

## 3. Detailed Findings Log

### Dimension 1: Data authenticity and Jira ingestion - FAIL

#### C2. Critical. Invented values are shown, and partly written to Jira, as if they were the customer's data
**Evidence:** Observed-live and Observed-code.

| Invented value | Where | Live observation |
|---|---|---|
| 40h effort for any issue without an estimate | `src/index.ts:204` | All 26 DEMO issues show 40h. Jira has no estimates on any of them. |
| 30% progress for any "in progress" issue | `src/index.ts:206-211` | DEMO-21, 22, 26 show 30% |
| 20% target progress | `src/index.ts:254` | Every row |
| Epic "Prerequisites" when there is no parent | `src/index.ts:199` | Every row. DEMO has no Epic type. |
| Resource "Resource 1" when unassigned | `src/index.ts:251` | Every unassigned row and card |
| Dates 2026-08-05 to 2026-09-16 and allocations on `05-Aug` | `src/index.ts:256-261, 359-364` | DEMO-25 tooltip: "Dates: 2026-08-05 to 2026-09-16" while its bar spans 14-Oct to 11-Nov |
| Milestones "Architecture Baseline", "Beta Feature Freeze", "Production Cutover" | `src/index.ts:86-90` | Shown in DEMO and in TEST |
| CoE and Vertical for "Resource 1" to "Resource 6" | `src/index.ts:101-108`, fallback `planner-engine.ts:450-454` | Utilization and heatmap: "Resource 1 (Backend & Cloud • Fintech Core)" |
| A 30% dependency chaining each of the first 6 issues to the previous one | `src/index.ts:283-292` | Green and red curves DEMO-26 → 25 → 24 → 23 → 22 → 21. The red one flags DEMO-22 as violated by a rule nobody made. |
| Jira subtasks fixed at 8h each | `src/index.ts:217-219` | Not exercised (DEMO has no subtasks) |

**Impact:** A buyer sees a completion percentage (15%), red "behind" bars and a dependency violation, all computed from invented numbers. C5 shows some of these values are then written into Jira.

**Empty-project case:**
- Code path: with no issues, `tasks` and `backlogTasks` are empty. The timeline shows "No scheduled tasks in project...", which is an honest empty state (`index.html:471-474`).
- But the three invented milestones and "Target: 0%" still show (Inferred from the TEST observation and the code).
- In TEST (1 issue), TEST-1 was auto-scheduled from 30-Sep, drawn red as behind, and given the same invented values.

**Fix:**
- Show empty values ("No estimate", "Unassigned", "No epic") instead of invented ones.
- Derive progress from Jira: time spent over original estimate, or the share of subtasks done, with the method shown.
- Remove `DEFAULT_MILESTONES`, `DEFAULT_RESOURCE_METADATA`, the heatmap fallback and the auto-generated dependency chain.

#### C4. High. The "dynamic" calendar is fixed to 2026-10-30
**Evidence:** Observed-code. It looks correct live today only because today is 2026-10-30.

- `src/index.ts:73`: `DEFAULT_WEEKS = getTimelineWeeks(new Date('2026-10-30')).weeks`. Every resolver uses `DEFAULT_WEEKS`, and `getTimelineWeeks()` with today's date is never called.
- `PlannerEngine.generateDynamicWeeks` itself is correct (`planner-engine.ts:277-322`), and `isCurrentWeek` is set on the 28-Oct week (Observed-live).
- `getPortfolioResourceHeatmap` passes the old constant `CURRENT_WEEK_INDEX = 6` (`src/index.ts:853`, `models.ts:223`). The real index is 4, so the heatmap treats the next two weeks as past.
- Week keys are `DD-Mon` with no year (`planner-engine.ts:299-301`). Any window over 12 months will collide, and keys stored by earlier versions (`05-Aug`, `26-Aug`) silently fall back to column 0 (`index.html:562`).

**Reproduce:** Run the app on or after 2026-11-04. The TODAY flag still reads "28-Oct".

**Fix:** Compute the weeks for each request from `new Date()`, or from the user's time zone sent by the frontend. Return `currentWeekIndex` and use it everywhere. Store dates as ISO dates, not week keys.

#### C11. High. Only the newest 100 issues are read, and stored issues outside that window come back as ghost rows
**Evidence:** Observed-code.

- `src/index.ts:184` sets `maxResults=100` and ignores `nextPageToken` and `isLast`.
- `src/index.ts:341-369` re-adds any key stored in `scheduleMap` that the search did not return. Such a row is shown as "Task KEY" with invented defaults. This happens to issues beyond the first 100 and to deleted or moved issues.
- `addSubtaskToTask` accepts any `parentTaskId` and writes it into `scheduleMap` without a check (`src/index.ts:730, 752`). That creates a ghost row too.

**Impact:** In a project with more than 100 issues, older issues vanish without a message. Deleted issues stay on the plan as rows that look real.

---

### Dimension 2: Visual interface and interaction - PARTIAL

#### C1. Critical. All inline `onclick` controls are dead in the deployed app
**Evidence:** Observed-live (behaviour). Inferred (cause).

Live, 2026-10-30:

| Control | Wiring | Result |
|---|---|---|
| Click a Gantt bar | `addEventListener` (`index.html:617`) | Modal opens |
| Click the task-name cell | inline `onclick` (`index.html:485`) | Nothing |
| Modal "Save Changes", with the summary edited | inline `onclick` (`:201`) | Nothing. Jira DEMO-25 unchanged (1 history entry). The modal stays open. |
| Modal "Cancel" | inline `onclick` (`:200`) | Nothing. The modal can only be left by reloading the page. |
| "+ Add Task / Issue" | `addEventListener` (`:305`) | Modal opens |
| "Create & Schedule", with a summary entered | inline `onclick` (`:241`) | Nothing. No issue created (JQL `created >= -10m` returned 0). |

Also inline and so affected: ✕ buttons (`:105, :211, :251`), "Add Subtask" (`:166`), the estimate-unit change (`:136`), "Create Epic" (`:261`) and the resource chip (`:489`).

- **Cause (Inferred):** Forge's Custom UI Content Security Policy blocks inline event-handler attributes. The inline `<script>` block does run.
- The manifest asks only for `permissions.content.styles: 'unsafe-inline'` (`manifest.yml:17-20`). Moving all handlers to `addEventListener` removes the dependency on CSP details either way.

**Impact:** The user cannot edit a summary, assignee, status, estimate or dependency, add a subtask, or create a task or epic. Dimensions 3 and 4 depend on these paths.

**Fix:**
- Remove every inline `on*=` attribute and wire the handlers in script.
- Move the script to a bundled `.js` file.
- Add an end-to-end smoke test that runs against a deployed environment and asserts each control has an effect.

#### C20. Medium. No keyboard or non-drag path for scheduling, and the backlog cannot be dropped onto an empty timeline
**Evidence:** Observed-code.

- Drop targets exist only inside rendered task rows (`index.html:516-540`). When no task is scheduled, the empty-state row has no drop slots, so tray items cannot be scheduled by dragging.
- No keyboard or form alternative exists for moving, resizing or scheduling. Atlassian design guidance and enterprise buyers expect one (Reported).
- Backlog drag was not confirmed live (see "What was tested, and the limits").

#### C14. Medium. Dependency and tooltip messages contradict the data
**Evidence:** Observed-live and Observed-code.

- **Live:** the tooltip of DEMO-24 reads "Dep: DEMO-25 >= 30% (SATISFIED)" while DEMO-25 is at 0%. The tooltip prints SATISFIED whenever `isViolated` is false (`index.html:759`), and "not yet violated" is not the same as "satisfied".
- `earliestStartDate`, `earliestStartReason` and `violationReason` are computed (`src/index.ts:376-380`), but the UI never shows them. There is no violation banner.
- There are no arrowheads: `.dep-arrow` does not exist. Curve labels ("Lag: 30% Trigger") render under the bars, because the SVG is at z-index 15 and the bars at 20 (`style.css:174, 203`).
- During a drag, `renderTimelineRows` runs without `renderDependencySvgOverlay`, so the curves point at old positions until the save completes (`index.html:670-675`).

#### C21. Low. Element names differ from the specification
**Evidence:** Observed-code.

- The specification names `.gantt-bar-resize-handle`, `.task-tooltip` and `.dep-arrow`.
- The build uses `.bar-handle-right` and `.tooltip-popup`, and has no arrow element.
- The view labels also differ ("Project Tracking (WBS & Timeline)", "Resource Utilization (Per-Person)", "Executive Heatmap (Capacity)").
- Align the specification or the code, so acceptance tests and the documentation match.

**Other Dimension 2 notes:**
- Column resizers (`.resizer`) are wired with `addEventListener`, and widths are saved (`index.html:443-465`). Not exercised live.
- The task cell is `display:flex` (`style.css:148`), which takes it out of table layout. The summary `<span>` has no `text-overflow: ellipsis`. Long summaries are clipped, not ellipsised (Observed-live: "DEMO-26: Track & improve your team's p").

---

### Dimension 3: Bi-directional sync and concurrency - FAIL

#### C5. Critical. Resizing a bar overwrites the Jira original estimate with an invented value
**Evidence:** Observed-live and Observed-code.

- `index.html:640`: on a right-edge resize, `task.effortHours = newSpan * 15`.
- `index.html:652-655` sends `effortHours`, and `syncTaskToJira` writes it to `timetracking.originalEstimate` (`src/index.ts:595-599`).
- A left-edge resize sends the current `effortHours` unchanged. For an issue without an estimate, that is the invented 40h (C2), which is then written to Jira.
- **Live:** one right-edge drag on DEMO-25 (4 → 5 weeks) gave this changelog entry: `timeoriginalestimate: null -> 270000` (75h, "1w 4d 3h"), author Fahim Farook, 2026-10-30 20:49 IST. Reverted.

**Impact:** Any schedule change destroys the team's real estimates. In an audited environment this is a data-integrity incident.

**Fix:**
- Resizing changes duration and dates, never effort.
- Write effort only from an explicit estimate field.
- Never write a value the user did not enter.

#### C6. High. Moves and resizes never update dates, so the Jira due date is never written
**Evidence:** Observed-live and Observed-code.

- A drag sends only `startWeek` (`index.html:680-683`). A resize sends `startWeek`, `spanWeeks` and `effortHours`. Neither path recomputes `startDate`, `endDate` or `endWeek`.
- `syncTaskToJira` writes `duedate` only when `updates.endDate` is present (`src/index.ts:591-593`), so it never does.
- **Live:** after the resize, Jira `duedate` stayed null. The tooltip showed "2026-08-05 to 2026-09-16". The Resource Utilization view showed 0% in every week for DEMO-25, because utilization reads the stale dates (`planner-engine.ts:371-388`).
- No start-date field is read or written anywhere.

#### C7. High. The first schedule change removes every other issue from the timeline
**Evidence:** Observed-live and Observed-code.

- With an empty `scheduleMap`, the first 6 issues are auto-scheduled but not saved (`src/index.ts:266-298`).
- After any write, `hasCustomSchedule` is true, and the auto-scheduled issues fall back to the tray.
- **Live:** after one resize of DEMO-25, the timeline went from 6 rows to 1, and the tray went from 20 to 25.

#### C8. High. Read-back from Jira is partial: values stored in the app override Jira
**Evidence:** Observed-live and Observed-code.

- `src/index.ts:231-257` prefers stored `summary`, `effortHours`, `resource`, `status`, `progress` and dates over the live values.
- **Live, after changing DEMO-25 in Jira (summary, estimate 10h, due date 2026-12-15) and reloading:**
  - Summary: shown ("... READBACK"), because no summary was stored for DEMO-25.
  - Estimate: app still shows **75h**, Jira says **10h**.
  - Due date: ignored. The tooltip still shows 2026-08-05 to 2026-09-16.
- Once a working modal saves a summary (C1 fixed), later summary edits in Jira will also be hidden.
- A status edited in the app is stored only in app storage. No Jira transition is called, so app status and Jira status diverge permanently.
- There are no Forge product triggers (`avi:jira:updated:issue` and the like). Sync happens only on a page load.

#### C9. High. No optimistic concurrency, and storage is still monolithic
**Evidence:** Observed-code.

- Every mutation reads, modifies and writes the whole `scheduleMap:${projectKey}` value (`src/index.ts:417-439, 494-520, 694-704, 729-759, 790-797`).
- `version: currentVersion + 1` is written (`:698-702`) but never compared, so a stale write overwrites a newer one.
- `ps:${projectKey}:task:${key}` is written (`:705, :798`) but **never read**. It adds storage cost without partitioning anything.
- `getProjectPlan` writes the full plan, with all tasks and backlog including duplicated `effortConfig` objects, to `ps:plan:${projectKey}` on **every read** (`:403`). The KVS per-value limit still applies to this value and to `scheduleMap` (Reported: about 240 KiB per value; verify the current figure).

**Reproduce (Inferred):** Two users resize different bars within the same second. Both read `scheduleMap` version N, and the last write wins. One user's change disappears without a message.

**Fix:** One key per issue, read and written individually. Use a compare-and-set on `version`, or the KVS transaction API, and return a conflict error to the UI. Do not write a plan cache when reading.

#### C12. Medium. Failures are silent
**Evidence:** Observed-code.

- `callResolver` returns `null` on any error (`index.html:270-281`). No caller shows an error.
- The UI ignores `createInlineTask`'s `{ success: false, error }` (`index.html:940-946`), so the backend part of the F7 fix never reaches the user.
- `updateWbsTask` discards the result of `syncTaskToJira` (`src/index.ts:708`). The app saves the change locally even when Jira rejects it, so the two diverge without a message.

#### C13. Medium. Assignee, epic and estimate never reach Jira from create or edit
**Evidence:** Observed-code.

- The edit modal sends `resource` as a display name, not `resourceAccountId` (`index.html:868, 873`). The assignee write in `syncTaskToJira` (`src/index.ts:601-605`) is therefore never triggered from the UI.
- `createInlineTask` sends only `project`, `summary` and `issuetype: Task` (`src/index.ts:458-464`). The epic, assignee and effort chosen in the form stay in app storage only.
- The modal's unit, T-shirt and buffer fields are never sent on Save (`index.html:865-888`).

---

### Dimension 4: Fractional dependency engine - FAIL

#### C3. Critical. The dependency engine cannot be configured from the product
**Evidence:** Observed-code. C1 is Observed-live.

- The only UI path is the edit modal, whose Save is dead (C1).
- Even with C1 fixed, `saveTaskModalChanges` sends `dependency` to `updateWbsTask` (`index.html:874-885`), and `dependency` is **not** in `ALLOWED_KEYS` (`src/index.ts:682-686`). It is dropped without a message.
- `saveTaskDependency`, the only path that runs `validateDependency` (threshold range, self-reference, cycles) and `mirrorDependencyToJira` (`src/index.ts:766-804`), is never called by the UI.
- The trigger input still uses `parseInt(...) || 30` (`index.html:871`), so 0% becomes 30%, and the HTML has `min="1"`. F14 is open.
- The only dependencies users see are the auto-generated ones (C2). They bypass validation, and they are not mirrored to Jira as issue links.

**Result against the brief:**

| Brief item | Engine (`planner-engine.ts`) | Reachable in the product |
|---|---|---|
| Earliest start, p = 0: start(A) + X% × duration(A) | Yes, calendar duration (`:230-233`) | Only for the auto-generated chain |
| Earliest start, p > 0: now + (X − p) / observedRate(A) | Yes (`:234-242`) | Only for the auto-generated chain, with invented p (C15) |
| Tooltip states "Planned timeline" or "Observed velocity" | Text computed (`:233, :241`) | Not shown (C14) |
| Violation if B started while A < X | Yes (`:249-255`) | Red curve shown. No banner. |
| Conflict if B scheduled before the earliest start | Yes (`:256-258`) | Red curve shown. No banner. |
| Cycle detection with the chain in the message | Yes, chain walk (`:140-185`); tests cover A → B → A and A → B → C → A | No |
| `POST /rest/api/3/issueLink` "Blocks" | Yes (`src/index.ts:643-663`) | No. DEMO has the "Blocks" link type. |

#### C15. High. The engine's arithmetic runs on invented progress
**Evidence:** Observed-code.

- Progress is 0, 30 or 100, taken from the status category alone (`src/index.ts:206-211`). `aggregatetimespent` is requested but never used.
- `observedRate(A)` is therefore 30% divided by the days elapsed since an invented start date. The "Observed velocity" earliest start is not an observation.
- The model also has these limits:
  - One predecessor per task (`models.ts:87`).
  - The cycle check looks only at scheduled tasks, not the backlog (`src/index.ts:780-785`).
  - An unknown predecessor is flagged as violated, not rejected (`planner-engine.ts:204-210`).
  - The p = 0 rule uses calendar days, not effort or working days.

#### C22. Medium. A dependency is mirrored to Jira as a link, but its removal is not
**Evidence:** Observed-code.

- `mirrorDependencyToJira` creates a link and returns `linked` (`src/index.ts:643-663`).
- No code deletes the link when a dependency changes or is removed. Repeat saves can create duplicate links.
- The result is discarded (`:801`).

---

### Dimension 5: Forge compliance, security and multi-tenancy - PARTIAL

#### C10. High. All reads run as the app, so users can see issues they are not allowed to see
**Evidence:** Observed-code.

- Issue search, epic search and assignable-user search use `api.asApp()` (`src/index.ts:134, 158, 183`).
- A user who can open the project page sees every issue in it, including issues hidden from them by issue security levels.
- This conflicts with the brief's identity requirement and with Atlassian's security expectations for user-initiated reads (Reported).

**Fix:** Use `asUser()` for every read started by a user.

#### C17. High. No licensing, so a paid listing is not possible
**Evidence:** Observed-code. The requirement is Reported.

- `manifest.yml` has no `app.licensing` block, and no resolver checks `context.license`.
- A paid Marketplace Forge app needs licensing enabled and a check that refuses or limits service when the license is inactive (Reported: Atlassian Forge licensing documentation; verify the current manifest key).

**Scopes against code (the scope part of F16 is closed):**

| Scope | Used by |
|---|---|
| `read:jira-work` | `/search/jql` (`src/index.ts:159, 184`) |
| `write:jira-work` | `POST /issue`, `PUT /issue/{id}`, `POST /issueLink` (`:467, :613, :654`) |
| `read:jira-user` | `/user/assignable/search` (`:134`) |
| `storage:app` | KVS (`:32-45`) |

#### C16. Medium. Jira text is inserted into the page as HTML
**Evidence:** Observed-code. Exploitability is Inferred.

- Summaries, display names, epic names and milestone titles are interpolated into `innerHTML` without escaping (`index.html:370, 389-399, 482-507, 765-772, 1005, 1042`).
- Script execution is probably blocked by the same CSP that blocks C1.
- Markup injection still works. A summary containing a styled link or form can fake UI inside the app.

**Fix:** Use `textContent`, or escape before interpolating.

#### C18. Low. Fixed issue types break in other project types
**Evidence:** Observed-live and Observed-code.

- "Create Epic" hardcodes `issuetype: Epic` (`src/index.ts:541`), and DEMO has no Epic type (Observed-live: IT Help, Task, Service Request, Sub-task, Service Request with Approvals).
- "Create Task" hardcodes `Task`.
- Read the project's issue types and offer only those.

#### C23. Low. The payload fallback for the project key remains
**Evidence:** Observed-code.

- `extractProjectKey` still falls back to `payload.projectKey`, and then to `'DEMO'`, when context is missing (`src/index.ts:872`).
- `jira:projectPage` always supplies context, so this cannot be exploited today (Inferred).
- Remove the fallback and reject the call, so a future module without project context cannot reach it.
- The test named "extracts projectKey from payload first" (`test/index.test.ts:851`) describes the old behaviour and should be renamed.

**Platform items:**
- **Audit trail:** writes are `asUser()`, and the Jira changelog shows the real person (Observed-live). F9 closed.
- **Identity:** placeholders use `ph:` IDs and are filtered before any Jira write. Real users carry `accountId` and `displayName` only. No emails are stored (Observed-code).
- **Runs on Atlassian:** eligible (Observed-live, CLI). The badge itself is granted on the listing (Reported).

---

### Engineering process (cross-cutting)

#### C19. Medium. The tests do not cover the code that broke, and the deployed build cannot be tied to the tag
**Evidence:** Observed.

- 111 tests pass, but `index.html`, the whole shipped UI, has no tests. `jest.config.js` excludes `src/frontend/**`, which now holds only dead UI Kit code. C1, C3 (frontend half), C5, C6 and C7 are all in untested code.
- `src/frontend/index.tsx` (UI Kit, unused since the move to Custom UI) and the `@forge/react` dependency remain. `plan-repository.ts` still says "PlanShift", and its `saveTaskDependency` and `getTaskDependency` are unused (F21 open).
- The last deploy (12:27:16Z) is four minutes before the commit (12:31:20Z) and has no build tag. File timestamps make it likely that the deployed code equals `eaa725b` (Inferred), but it cannot be proven. Deploy from the tag and record the tag in the deploy.

---

## 4. Dimension 6: Commercial Viability and Market Fit - FAIL (as built)

### Benchmark

Competitor capabilities are Reported (vendor listings and market knowledge). Confirm them before external use.

| Capability | CascadePlan 2.7.0 | Jira Plans (Premium) | BigPicture (Appfire) | Structure + Gantt (Tempo) | ActivityTimeline |
|---|---|---|---|---|---|
| Reads real Jira issues | Yes (first 100 only, C11) | Yes | Yes | Yes | Yes |
| Gantt bars, drag and resize | Yes, but resize corrupts estimates (C5) | Yes | Yes | Yes | Calendar style |
| Edit fields in the planner | No (C1) | Yes | Yes | Yes | Yes |
| Dependencies drawn as links | Yes (auto-generated only) | Yes | Yes | Yes | Limited |
| Progress-threshold ("percent-lag") dependency | Engine only, not configurable (C3) | No | No as a first-class type | No as a first-class type | No |
| Critical path, baselines | No | Limited | Yes | Yes | No |
| Capacity by real Jira users | Partly (assignee read, then defaults) | Teams | Yes | Via resources | Core strength |
| Export (PDF, Excel) | No | Partial | Yes | Yes | Yes |
| Permission-correct reads | No (C10) | Yes | Yes | Yes | Yes |

### The differentiator

"B may start when A reaches X%" is a real gap. The incumbents model start-to-start with a time lag, not a progress lag. Teams that hand work over in stages (design to build, build to test) think in progress terms. The engine's explanation strings ("Planned timeline: ..." and "Observed velocity: ...") are the right idea. The feature becomes sellable only when:

- users can create these dependencies (C3),
- progress comes from Jira data (C15),
- the explanation is shown (C14).

### Estimation and rollup

| Capability | State |
|---|---|
| Hours, story points (1 pt = 8h) and T-shirt (XS 4h, S 8h, M 16h, L 32h, XL 64h) normalisation | Correct in the engine (`planner-engine.ts:28-45`, `models.ts:213-221`). Tested. |
| Story points read from Jira | No. No story-point field is requested. |
| Unit and T-shirt choice in the UI | Not saved (C13). The dropdown only toggles visibility, and its handler is inline (C1). |
| Subtask rollup with a percentage or fixed buffer | Correct in the engine (`:50-88`). The UI "Add Subtask" is dead (C1). App subtasks are not created in Jira. Jira subtasks are counted at a fixed 8h (C2). The buffer is applied only when a subtask is added. |

### Pricing recommendation

Current public price points (Reported; check the Marketplace pricing tabs before you set prices, and note Tempo's announced 2026 increase):

| Product | Indicative Cloud price |
|---|---|
| Gantt Charts for Structure PPM (Tempo) | about $1.00 to $1.27 per user per month for up to 100 users |
| Structure PPM Standard (Tempo) | about $3.52 per user per month on average |
| BigPicture (Appfire) | free up to 10 users; about $1,303 per year for 25 users (about $4.34 per user per month), July 2025 |
| ActivityTimeline | from $2.50 per user per month |
| Jira timeline / Plans | included in Jira; Plans in Premium |

**Recommended structure, effective only after the Phase 0 and Phase 1 exit criteria in section 6 are met:**

| Tier | Price (per user per month, billed at the Jira user tier) | Contents |
|---|---|---|
| Free | up to 10 users | Full planner, one project. This matches the Marketplace norm and drives trials. |
| Standard | about $1.50 | Gantt, write-back, progress-threshold dependencies with explanations, estimation rollups |
| Premium (later) | about $3.00 | Cross-project portfolio heatmap, critical path, baselines, export |

Rationale:
- Standard sits above the Structure Gantt add-on, because of the dependency differentiator.
- It sits well below BigPicture and Structure PPM, matching its lightweight scope.
- Premium is introduced only when portfolio features exist. The current heatmap is single-project and uses invented organisation data.

Do not publish a price, or start a paid trial, on v2.7.0. A trial that writes invented estimates into a buyer's Jira (C5) would damage the brand more than a delay would.

---

## 5. Status of the Previous Audit's Findings

| Prior | Topic | Status in v2.7.0 | Now |
|---|---|---|---|
| F1 | Invented tasks, no Jira reads | Partly fixed: real issues are read; invented values remain | C2, C11 |
| F3 | Cross-project access | **Closed** (context-first) | C23 (residual fallback) |
| F4 | Table, not Gantt | **Closed** (Custom UI Gantt) | C1, C14 |
| F5 | No two-way sync | Partly fixed: user writes work; dates never written; read-back partial | C5, C6, C8 |
| F6 | Engine is one comparison | Engine rewritten, but not reachable | C3, C15 |
| F7 | Fake key on create failure | Backend fixed; UI ignores the error | C12 |
| F8 | Invented heatmap data | Open | C2 |
| F9 | Writes as app | **Closed** (Observed-live) | - |
| F10 | Lost updates | Open (version not compared) | C9 |
| F11 | Fixed calendar | Partly fixed: engine dynamic, but called with a literal date | C4 |
| F12 | Wrong colours and utilization | Partly fixed; utilization now 0% from stale dates | C6 |
| F14 | 0% threshold impossible | Open | C3 |
| F15 | Resources are free text | Partly fixed: assignee read; never written from UI | C13 |
| F16 | Unused scope, no licensing | Scopes **closed**; licensing open | C17 |
| F17 | Unfiltered updates | **Closed** (allow-list) | - |
| F18 | Filter closure bug | Not applicable (filters removed) | - |
| F19 | Create form ignores dates | Partly fixed (start week chosen); epic, assignee and effort not sent | C13 |
| F20 | Tests assert fake behaviour | Partly fixed; shipped UI untested | C19 |
| F21 | Unused dependency key | Open | C19 |
| F22 | One KVS value per plan | Open, now two monolithic values | C9 |
| F23 | Hotlinked icon | **Closed** | - |
| F24 | No version control | **Closed** (git, tag v2.7.0); deploy not tied to tag | C19 |

---

## 6. Marketplace Listing Readiness Verdict

### NO-GO

Four Critical findings each block any release:

| Finding | Problem |
|---|---|
| C1 | Editing controls are dead |
| C2 | Invented data is presented as real |
| C3 | The differentiator cannot be configured |
| C5 | Resize corrupts Jira estimates |

Licensing (C17) and permission-correct reads (C10) also block a paid listing.

### Exit criteria for a GO decision

**Phase 0: stop-ship (about 1 week)**

| Action | Closes | Done when |
|---|---|---|
| Replace every inline `on*=` with `addEventListener`; move the script to a bundled file | C1 | A deployed smoke test edits a summary, creates a task and adds a subtask, and each change is visible in Jira |
| Remove the `span × 15` effort rule; resizing changes dates only | C5 | A resize leaves `timeoriginalestimate` unchanged in the changelog |
| Remove the invented defaults, milestones, organisation metadata and auto-dependency chain | C2 | DEMO shows "No estimate", "Unassigned", no milestones and no curves until a user creates them |
| Use `new Date()` for weeks; delete `CURRENT_WEEK_INDEX` | C4 | A test with a mocked clock on 2026-11-11 puts TODAY on 11-Nov |
| Add `dependency` to the save path through `saveTaskDependency`; allow 0% | C3 | The UI rejects a cycle with the chain message and creates a "Blocks" link in Jira |

**Phase 1: integrity (2 to 3 weeks)**
- Recompute `startDate` and `endDate` on every move and resize, and write `duedate` and the start-date field (find its ID through `/rest/api/3/field`) (C6).
- Persist the auto-placement, or drop it (C7).
- Let Jira win for every Jira-owned field. Read the due date. Transition the status, or make it read-only (C8).
- Store one KVS key per issue with a version compare. Stop writing the plan cache on read (C9).
- Page through search results (C11).
- Show resolver errors (C12).
- Send `accountId`, the parent epic and the estimate (C13).
- Derive progress from time spent or from subtasks (C15).

**Phase 2: paid listing**
- `asUser()` for reads (C10). Licensing plus a license check (C17). Escape all HTML (C16).
- Keyboard alternatives for drag actions (C20). Violation banner, arrowheads and the earliest-start explanation in the tooltip (C14).
- Remove the dead UI Kit code and deploy from tags (C19).
- Load test with 5,000 issues. Test in a Jira Software project with epics, sprints and story points as well as JSM.

When Phase 0 and Phase 1 are done and verified live, re-score. I would expect the readiness score to move to about 65 to 70, which is enough for a free beta listing (Inferred).

---

## Appendix A: Live evidence (2026-10-30)

- Jira `project = DEMO`: 26 issues, DEMO-1 to DEMO-26, `isLast: true`. None has an estimate, due date, parent or subtask. Project type `service_desk`, style `classic`. Link types include "Blocks". `duedate`, `timetracking` and `assignee` are editable (editmeta on DEMO-1 and DEMO-23).
- Initial view: 6 scheduled (DEMO-26, 25, 24, 23, 22, 21), tray (20). Completion 15%, target 20%. Legend "Current Week (28-Oct)". TODAY flag on 28-Oct. Weeks 30-Sep to 06-Jan.
- The tooltip on DEMO-24 read "Dep: DEMO-25 >= 30% (SATISFIED)" at DEMO-25 = 0%. A red curve ran into DEMO-22 (in progress, predecessor DEMO-23 at 0%).
- Resize of DEMO-25 (4 → 5 weeks):
  - App: HRS 75h. Timeline 1 row. Tray 25.
  - Jira changelog: `timeoriginalestimate: null -> 270000`, author Fahim Farook (`atlassian`), 20:49:02 IST.
- Edit modal opened by clicking the bar (it did not open from the task-name cell). The summary was edited and Save clicked: no Jira change, modal stayed open. Cancel: no effect.
- Create Task with summary "CascadePlan audit probe 2026-10-30": no issue created. JQL `project = DEMO AND created >= -10m` returned 0.
- Read-back after `PUT /issue/DEMO-25` (summary "... READBACK", estimate 10h, due date 2026-12-15): summary shown; HRS still 75h; tooltip dates still 2026-08-05 to 2026-09-16.
- Resource Utilization: "Resource 1 (Backend & Cloud • Fintech Core)", 0% in all 15 weeks. Heatmap: the same row, 0%.
- Project TEST: TEST-1 auto-scheduled from 30-Sep, red, with the same three milestones.
- DEMO-25 restored: summary "LSQA Visual Planner Task 1", due date null, timetracking empty.
- Screenshots on the auditor's machine:
  - Initial view: `/tmp/claude-chrome-screenshots-h9RXy1/screenshot-1793373443598-0.jpg`
  - After the resize: `/tmp/claude-chrome-screenshots-h9RXy1/screenshot-1793373553775-1.jpg`
  - TEST project: `/tmp/claude-chrome-screenshots-h9RXy1/screenshot-1793375050441-2.jpg`

## Appendix B: Pricing sources (Reported)

- Appfire BigPicture plans and pricing: https://appfire.com/bigpicture/plans-and-pricing
- Appfire 2024 BigPicture price update: https://appfire.com/pricing-updates/big-picture-jira
- Tempo Gantt Charts for Structure PPM pricing: https://www.tempo.io/pricing/jira-gantt-chart
- Tempo Structure PPM pricing: https://www.tempo.io/pricing/project-portfolio-management-software-ppm
- Tempo pricing update, September 2026: https://www.tempo.io/news/tempo-pricing-update-september-15-2026
- ActivityTimeline purchasing: https://activitytimeline.atlassian.net/wiki/x/H4B1cQ
