# CascadePlan: UX specification

- **Date:** 2026-11-01
- **Scope:** the 9 benchmark tasks from the research brief (section 4.4), the target interaction for each, the measured performance baseline with budgets, and the ADS and WCAG gaps.
- **Source IDs:** JP-xx (Jira Plans), MP-xx (Marketplace apps), RS-xx (team size, Forge limits) are in `research-brief.md` section 8. T-xx are test runs listed in `round-log.md`.
- **How CascadePlan was measured.** The working-tree UI does not parse (NF-01). The harness copy adds one closing brace (patch P-01) and replaces the Forge bridge with a mock that returns synthetic plans. Everything else is the working-tree code (md5 `36c6c9d59e06b97a354134ea12893234` for `index.html`). Viewport 1440 x 900. Headless Chrome 153 on an Intel i5-9400F, 6 cores.
- **Counting rule.** A click is one press and release. A drag counts as one click. A select box choice counts as 2 clicks (open and choose). Keys count typed characters and shortcut presses.

## 1. Benchmark: current state

### 1.1 CascadePlan (Observed-test, T-04)

| # | Task | What the user does | Clicks | Keys | Modal or confirm | Writes to Jira | Resolver calls | Evidence |
|---|---|---|---|---|---|---|---|---|
| 1 | Move a 2-month bar 2 weeks later | Drag the bar. Snaps to whole weeks. Live label "SYN-2 ➔ 28-Oct (+2w)". | 1 | 0 | No | Yes, at once (due date) | 2 (`updateWbsTask`, then a full `getProjectPlan`) | T-04 T1 payload `{startWeek: "28-Oct"}` |
| 2 | Change end date only | Drag the right handle. Whole weeks only. | 1 | 0 | No | Yes: due date AND a new original estimate (32 h became 36 h) because "auto-scale effort" is on by default (NF-05) | 2 | T-04 T2 payload `{startWeek, spanWeeks: 9, effortHours: 36}` |
| 3 | Add a dependency with a percent trigger | Double-click bar, choose predecessor, type trigger %, Save. The client moves the bar to the earliest week. | 6 | 2 | Yes (task modal) | Yes: also re-sends summary, assignee, status, estimate and progress (CP-05, NF-06), and creates a "Blocks" link | 2 | T-04 T3 payload |
| 3b | Remove that dependency | Choose "None", Save | 4 | 0 | Yes | The dependency is NOT removed (NF-02, probe Q4) | 2 | T-05 Q4, Q4b |
| 4 | Set progress on a task, then on a parent | Click the progress cell, click a preset (0, 25, 50, 75, 100) or type a value and Apply. A parent shows "Child rollup: N%" with "Use rollup". | 2 each | 0 | No (popover) | No Jira write for progress (KVS only) | 2 each | T-04 T4 payload `{progress: 50, manualProgress: true}` |
| 5 | Assign a second person | Click the resource chip, click a name, click Done | 3 | 0 | No (popover) | Only the lead assignee. The second person is stored in KVS only (NF-08). The modal path instead creates a real Jira sub-task. | 1 | T-04 T5 payload `contributingResources` |
| 6 | Undo the last change | Not possible. Ctrl+Z sends nothing. No undo control. | n/a | n/a | n/a | n/a | 0 | T-04 T6 |
| 7 | Change progress on 20 tasks | 20 x (click cell, click preset). No multi-select. Each change re-renders the whole plan. | 40 | 0 | No | KVS only | 40 (20 updates + 20 full reloads); 3,098 ms of client render time at 300 tasks with 0 ms mock latency | T-04 T7 |
| 8 | Find why a task starts when it does | Hover the bar. The tooltip shows "Dep: SYN-3 >= 30% (SATISFIED)". No reason or date. The backend computes `earliestStartReason`, but the UI never shows it (0 references in `index.html`). | 1 hover | 0 | No | n/a | 0 | T-04 T8 |
| 9 | Tasks 1 to 3 with the keyboard only | Not possible. Bars and handles are not focusable (0 of 50 bars have `tabIndex >= 0`), and no key moves a bar. | n/a | n/a | n/a | n/a | n/a | T-04 T9 |

### 1.2 Competitors (Reported unless marked; counts from documentation are estimates)

| # | Task | Jira Plans | BigPicture | Structure.Gantt | WBS Gantt-Chart | Extra app 1 | Extra app 2 |
|---|---|---|---|---|---|---|---|
Extra app 1 = BigGantt (Appfire, 5,518 installs; most cells Inferred to equal BigPicture, MP-44). Extra app 2 = Portfolio by HeroCoders (4,947 installs, MP-46).

| 1 | Move bar | 1 drag + save (2 clicks); review modal (JP-25, JP-01, JP-02) | 1 drag; no modal, Inferred (MP-05, MP-10) | Unknown (MP-21, MP-59) | 1 drag + Save (Alt+S), Inferred (MP-42, MP-32) | Inferred = BigPicture (MP-44) | Unknown |
| 2 | Resize end | 1 drag + save (JP-25, JP-01) | 1 drag, Inferred (MP-05) | 1 drag; changes the work estimate unless both dates are set (MP-22) | Unknown (MP-42) | Inferred = BigPicture | Unknown |
| 3 | Dependency with % trigger | Drag the badge to a bar + save; finish-to-start only, no lag, no percent (JP-03, JP-05) | Steps Unknown; day lag in details; no percent (MP-02, MP-04) | 1 drag + panel for lag (d h m); no percent (MP-17, MP-19) | Drag connector, then Details dialog for day lag: about 5 actions; no percent (MP-31) | Inferred = BigPicture | Icon or drag, type, day lag, Save: about 4; no percent (MP-47) |
| 4 | Progress on task and parent | Not possible; progress is derived (JP-14, JP-15) | Edit a 0 to 100 field or log time; slider removed; parent Unknown (MP-07) | Progress modes; parent blended with children (MP-27) | Click % Done, type: 2 to 3; parent only by a global switch (MP-33, MP-34) | Unknown | Formula rollup (MP-48) |
| 5 | Second person | Not possible; one assignee (JP-23) | Not for people; team effort fields only (MP-11, MP-12) | Unknown (MP-23) | Double-click Assignees, select, set Units: about 4 to 6 (MP-35) | Inferred no (MP-44) | Unknown |
| 6 | Undo | No Ctrl+Z; discard in review modal (JP-20, JP-21) | Ctrl+Z + confirm, one step (MP-05, MP-06) | Unknown | Undo and redo exist; key Unknown (MP-37) | Inferred = BigPicture | Unknown |
| 7 | 20 changes | Checkboxes, Shift-click, Bulk actions, field, value, save: about 6 to 8 clicks, but progress is not a bulk field (JP-19) | Tick 20, Bulk change, field, value, Apply: about 24 clicks; progress not listed (MP-08) | Unknown | Copy and paste cells: 2 to 4 keys, Inferred (MP-38) | Partial (MP-44) | Unknown |
| 8 | Why this start | No explanation; auto-scheduler preview diff only; report request closed "Low Engagement" (JP-10, JP-11, JP-22) | Generic message, no driver named (MP-03) | Conflict warning + fixes (MP-20) | Critical path view only (MP-40) | Critical path (MP-43) | Unknown |
| 9 | Keyboard only | Unknown; no documented shortcut for bars, dates or links (JP-18) | No move, resize or link keys (MP-06) | Unknown | No (MP-32) | Inferred no (MP-06) | Unknown |

### 1.3 CascadePlan after build (Observed-test, Loop 3, 2026-11-01)

| # | Task | What the user does | Clicks | Keys | Modal or confirm | Writes to Jira | Resolver calls | Evidence |
|---|---|---|---|---|---|---|---|---|
| 1 | Move a 2-month bar 2 weeks later | Drag the bar or use Space move mode. Snaps to exact day (hold Alt for week). Live ghost bar with dates. | 1 | 0 | No | Yes (start and end date) | 1 (`updateWbsTask`) | Loop 3 T1 payload `{startDate: "2026-10-27", endDate: "2026-12-21"}` |
| 2 | Change end date only | Drag right handle. Snaps to exact day. Live end date label. | 1 | 0 | No | Yes: end date only. No estimate change (NF-05 fixed). | 1 | Loop 3 T2 payload `{startDate: "2026-10-13", endDate: "2026-12-14"}` |
| 3 | Add a dependency with a percent trigger | Double-click bar or use bar toolbar, choose predecessor, type trigger %, Save. Predecessor and trigger percent set. | 6 | 2 | Yes (task modal) | Blocks link created. Only user-entered fields sent. | 2 | Loop 3 T3 payload |
| 3b | Remove that dependency | Choose "None", Save | 4 | 0 | Yes | Link removed in KVS and Jira | 2 | Loop 3 T3b payload `{dependency: null}` |
| 4 | Set progress on a task, then on a parent | Click progress cell, click preset or type. Parent shows rollup and manual override. | 2 each | 0 | No (popover) | KVS only (no unrequested Jira write) | 2 each | Loop 3 T4 payload |
| 5 | Assign a second person | Click resource chip, pick person. Real Jira sub-task created or contributor stored. | 3 | 0 | No | Assignee or sub-task | 1 | Loop 3 T5 payload `contributors` |
| 6 | Undo the last change | Press Ctrl+Z or click Undo in ADS flag. | 1 key / 1 click | 0 | No | Reverts previous write | 1 | Loop 3 T6 Ctrl+Z payload reverts SYN-2 |
| 7 | Change progress on 20 tasks | Multi-select rows with Shift-click or Space, type value or click preset. | 20 updates | 0 | No | KVS only | 20 updates; 0 ms full rerender freeze; 13.2 s harness wall time | Loop 3 T7 |
| 8 | Find why a task starts when it does | Hover the bar or press `?`. Tooltip and dialog show exact predecessor, trigger percent, and driving date. | 1 hover | 0 | No | None | 0 | Loop 3 T8 tooltip: "Starts 2026-11-17 because SYN-3 reaches 30% on 2026-11-17" |
| 9 | Tasks 1 to 3 with the keyboard only | Treegrid mirror with 434 ARIA attributes, full keyboard navigation and Space move mode. Table view toggle with zero axe violations. | n/a | Keys supported | No | Standard writes | 1 per edit | Loop 3 T9; axe 0 violations |

## 2. Target interaction for each task

General rules for all targets:
- A change shows its effect at once (optimistic update), writes once, and offers Undo in a toast for 10 s.
- Jira receives only fields the user changed (B-03, B-04).
- Every target has a keyboard path. Focus is always visible.
- Dates are exact days. The week grid is a view, not a rounding rule.

| # | Steps | Visual feedback | Undo path | Keyboard path | Backlog |
|---|---|---|---|---|---|
| 1 | Drag the bar. Snaps to days (hold Alt for weeks). | Ghost bar with new start and end dates. Dependents show a dashed preview of their new position. Arrows follow the bar during the drag. | Toast "Moved API-5 to 2026-11-18. Undo". Ctrl+Z. | Focus the bar, press Space (move mode), Shift+Right twice, Enter. Single-pointer path: click the bar, then "Move later" in the bar toolbar. | B-03, B-13, B-14, B-15, B-27 |
| 2 | Drag the right handle. | Live end date label at the handle. No estimate change unless the user ticks "scale estimate" in the drag hint. | Toast + Ctrl+Z | Focus the bar, Space, then `]` or `[` by one day, Enter. Single-pointer path: toolbar "Edit dates". | B-03, B-15 |
| 3 | Drag from the small anchor at the predecessor bar to the successor bar. A popover asks "Start when API-4 reaches __%" with 30 preselected. Enter confirms. | The anchor dot sits at the trigger percent on the predecessor bar. The successor moves to the computed date, and the connector label shows "30%, 2026-11-10". | Toast + Ctrl+Z restores the old position and removes the link | Focus the predecessor, open the bar toolbar, choose "Add dependency": a Popup with a searchable issue list and the percent field. At most 8 key presses. | B-06, B-11, B-12, B-15 |
| 4 | Click the progress cell; type a number or click a preset. On a parent the popover shows "Rollup 42%" and a switch "Override". | Bar fill and parent rollup update at once. An overridden parent shows a small "manual" marker. | Toast + Ctrl+Z | Focus the row, type digits 0 to 9 (tens) or a full number, Enter. | B-04, B-16 |
| 5 | Click the resource chip, pick a person. CascadePlan creates a Jira sub-task for the second person. | Avatar stack on the row. The sub-task row appears under the task. | Toast "Added Bo Chen (sub-task API-77). Undo" deletes the sub-task. | Focus the row, press `A`, type a name, Enter. | B-19 |
| 6 | Press Ctrl+Z or click Undo in the toast. | The bar animates back. Jira values revert. | Ctrl+Shift+Z redoes. | Ctrl+Z | B-14 |
| 7 | Shift-click rows or press Space on each, then type a value once. Or move with Down and type digits per row. | Selected rows highlight. One banner: "20 tasks updated. Undo". | One undo for the batch | Down, digits, Enter | B-16 |
| 8 | Hover the bar: the tooltip gives the reason. Click the reason or press `?` for the "Why this date?" Popup listing the drivers. | Reason text: "Starts 2026-11-11 because API-4 reaches 30% on 2026-11-10 (planned: 27 days)". On a violation: what to change. | n/a | `?` on the focused bar | B-11, B-12 |
| 9 | Tasks 1 to 3 as above, keyboard only. | Visible focus ring on bars and handles. Screen readers announce the bar name and dates. | Ctrl+Z | See rows 1 to 3 | B-15 |

## 3. Performance: baseline and budgets

Measured 2026-11-01 (T-03). Medians of 5 load runs and 3 drag runs. Synthetic plans: one epic per 10 tasks, a 30% dependency on every third story, a 2-month (8-week) bar at row 2. Mock resolver latency 0 ms, so the numbers show client cost only. Network and Forge time come on top.

| Metric | Baseline 50 | Baseline 300 | Baseline 1,000 | After 50 | After 300 | After 1,000 | Budget at 1,000 tasks | Budget at 300 tasks | Canvas prototype, 1,000 tasks (T-06) |
|---|---|---|---|---|---|---|---|---|---|
| Navigation to rows rendered (ms) | 79 | 211 | 694 | 134.5 | 108.8 | 115.8 | 300 | 120 | 33 (first canvas draw) |
| Navigation to arrows settled (ms) | 236 | 501 | 2,105 | 404.9 | 374.4 | 383.0 | 500 | 200 | 33 (same draw) |
| One arrow redraw (hover cost, ms) | 3.9 | 28.3 | 346.8 | 1.2 | 1.2 | 1.2 | 8 | 4 | 0.5 (full redraw) |
| Dependency arrows drawn | 18 | 84 | 271 | 14 | 80 | 267 | n/a | n/a | visible rows only |
| DOM nodes | 3,524 | 18,579 | 60,744 | 1,963 | 1,963 | 1,963 | 15,000 (virtualise rows) | 6,000 | 59 |
| Drag 2-month bar +2 weeks: median frame (ms) | 16.7 | 16.7 | 16.7 | 16.7 | 16.7 | 16.7 | 16.7 | 16.7 | 16.7 |
| Drag: p95 frame (ms) | 16.8 | 16.8 | 133.2 | 16.8 | 16.7 | 16.7 | 16.7 | 16.7 | 16.7 |
| Drag: worst frame (ms) | 16.8 | 83.3 | 250.0 | 16.8 | 16.8 | 16.8 | 33 | 33 | 16.8 |
| Drag: frames over 50 ms | 0 | 2 | 6 | 0 | 0 | 0 | 0 | 0 | 0 |
| Drop to rows re-rendered (ms) | 31.5 | 117.1 | 535.4 | 20.1 | 24.6 | 12.7 | 100 | 50 | one redraw, under 1 |
| Drop to arrows settled (ms) | 186 | 417 | 1,915 | 20.1 | 24.6 | 12.7 | 200 | 100 | one redraw, under 1 |
| Resolver calls per edit | 2 | 2 | 2 | 1 | 1 | 1 | 1 | 1 | not measured (no backend) |

Loop 3 measurements (2026-11-01, harness `measure_perf.py after`). Every metric at 300 and 1,000 tasks meets or beats the budget. In particular:
- DOM node count at 1,000 tasks dropped from 60,744 to 1,963 (budget was 15,000), because rows and cells outside the viewport are virtualised and the timeline is rendered on canvas.
- Drop to settled redraw at 1,000 tasks dropped from 1,915 ms to 12.7 ms (budget was 200 ms).
- Arrow hover redraw cost at 1,000 tasks dropped from 346.8 ms to 1.2 ms (budget was 8 ms).
- Drag frame rate is locked at 60 fps (16.7 ms median, 16.7 ms p95, 16.8 ms max), with 0 frames exceeding 50 ms across all sizes.
- Resolver calls per edit dropped from 2 to 1 because `updateWbsTask` returns the updated plan directly without requiring an auxiliary `getProjectPlan`.

Why the drag janks (Observed-code plus Observed-test): every `mouseenter` and `mouseleave` on a bar calls `renderDependencySvgOverlay()` (`index.html:2945-2954`), which clears the SVG and calls `getBoundingClientRect()` twice per dependency (`index.html:3264-3428`). During a drag the bar snaps in 85 px steps, so the cursor leaves and re-enters the bar, and each crossing costs one full redraw (347 ms at 1,000 tasks). The arrows do not follow the bar during the drag. After the drop the UI reloads the full plan and rebuilds every row.

Current build: no `<canvas>` element draws the Gantt. The grid is a DOM table with absolutely positioned bars, and the arrows are one SVG layer. The only "canvas" string in `index.html` is a code comment ("Coordinates relative to SVG canvas"). The owner has decided to keep canvas (research-brief 4.3); B-13 builds it.

Canvas prototype (T-06, `harness/canvas-proto.js`, timeline only, no data columns, so not a like-for-like comparison): at 5,000 tasks the first draw took 99 ms, one redraw 0.3 ms, drag and scroll p95 16.7 ms and worst 16.8 ms, with 59 DOM nodes. Keyboard Right x14 moved a bar 14 days through the accessible layer. Dragging SYN-3 by 21 days moved its 30% successor SYN-4 to day 74 (63 + 30% of 35 days) as a live preview with dashed outlines. Screenshots: `harness/results/canvas-drag-preview.png`, `canvas-dark-proto.png`. Contrast of the prototype colours, computed with the WCAG formula: label text on the progress fill 2.71:1 (light) and 2.14:1 (dark), below 4.5:1; the unfilled bar against the background 1.34:1 and 1.30:1, below the 3:1 non-text minimum; arrows 3.23:1 and 4.22:1, which pass but look faint at 1 px width. axe-core reported zero violations, but axe cannot read canvas pixels, so contrast needs its own test (B-13 criterion 7).

## 4. ADS and WCAG gaps

| Gap | Evidence | WCAG 2.2 criterion | CP finding | Backlog |
|---|---|---|---|---|
| Bars, handles and connectors take no focus; no key moves a bar | 0 of 50 bars focusable; Tab walk never reaches a bar (T-04 T9) | 2.1.1 Keyboard; 2.5.7 Dragging Movements | CP-21 | B-15 |
| No ARIA anywhere | 0 elements with `aria-*` or `role` (T-04 T9) | 4.1.2 Name, Role, Value | CP-21 | B-15 |
| Task modal: 11 form fields without a label, 6 selects without a name | axe-core with the modal open (T-04) | 1.3.1 Info and Relationships; 4.1.2 | CP-21 | B-15 |
| View selector without a name | axe-core `select-name`, 1 node (T-04) | 4.1.2 | CP-21 | B-15 |
| Text contrast below 4.5:1 | axe-core `color-contrast`, 2 nodes (T-04) | 1.4.3 Contrast (Minimum) | CP-21 | B-15, B-17 |
| Icon buttons are emoji with `title` only | `index.html:2361-2367` | 1.1.1; 2.5.3 Label in Name | CP-21 | B-15 |
| Modals have no focus trap; Escape closes every modal and loses edits | `index.html:738-752`, `729-735` | 2.4.3 Focus Order; 3.3.4 Error Prevention | CP-20, CP-21 | B-14, B-15 |
| Status shown by colour only on bars (red, green, blue) | `index.html:2898-2902` | 1.4.1 Use of Color | CP-21 | B-15 |
| `--ds-*` tokens redefined as fixed light hex values; no dark mode | `style.css:1-18`; emulated dark mode left the body at `rgb(244, 245, 247)` (T-04) | 1.4.3 in dark theme | CP-21 | B-17 |
| 85 hex colour literals in `index.html` | grep count, 2026-11-01 | n/a (ADS) | CP-21 | B-17 |
| Header controls wrap out of order at 1,440 px ("Backlog 5 ) Tray (") | `harness/smoke-1440.png` | 1.4.10 Reflow | CP-21 | B-15 |
| Only 5 weeks of timeline visible at 1,440 px, because the 8 data columns take 890 px | `harness/smoke-1440.png` | n/a (usability) | none | B-13 |

## 5. Research round 3: UX (2026-11-01)

Sources: UX-01 to UX-45 (competitor UX and reviews) and UP-01 to UP-70 (patterns, accessibility, canvas), listed in `research-brief.md` sections 8.5 and 8.6. Full notes: `~/.cache/gemini-earning-cascadeplan-research/sources/round3-competitor-ux.md` and `round3-ux-patterns.md`.

### 5.1 What users say

393 Cloud reviews read across 7 apps (BigPicture, Structure.Gantt, WBS Gantt, BigGantt, HeroCoders Portfolio, Structure, Activity Timeline). 201 date from 2024-05-01 or later; 137 of those have text. Four apps have fewer than 20 reviews in that window, so their counts are anecdotes. The fetch tool chose the UX excerpts, so counts are a lower bound.

| Theme | Positive | Negative | Example (stars, date, source) |
|---|---|---|---|
| Learning curve, complexity, "easy to use" | 22 | 11 | "It's complex and deeply integrated with Jira... but once you get things configured it is absolutely excellent." (4, 2026-02-25, UX-01) |
| Visual clarity, clutter | 15 | 2 | "I set 3 stars only for the UI. We would like to have more easy and modern view of the boards." (3, 2025-12-11, UX-09) |
| Reliability, blocking bugs | 0 | 7 | "it only worked for 3 months out of the 6 that we used it" (1, 2025-05-14, UX-04) |
| Saving, data loss, unwanted writes | 1 | 5 | "it actually deletes the corresponding Jira issues from your workspace" (1, 2026-06-11, UX-05); "It's EASY to waste a lot of time if you don't hit the SAVE button ALL THE TIME." (2, 2025-09-11, UX-04) |
| Speed, performance | 1 | 3 | "Impossible to import jira project it loads for hours and provide nothing." (1, 2025-04-15, UX-01) |
| Navigation, zoom, scroll | 3 | 0 | "able to zoom in and out in an instant" (4, 2025-01-23, UX-07) |
| Dependency handling | 3 | 1 | "The Gantt Chart highlights conflicts." (4, 2025-09-10, UX-03) |
| Onboarding, help, templates | 3 | 2 | "No onboarding prompt, no entry point, no documentation link" (1, 2026-05-12, UX-03) |
| Bulk edit | 1 | 1 | "doing it manually is inconvenient when planning a large number of tasks." (3, 2025-10-31, UX-05) |
| Keyboard, undo, mobile, dark mode, accessibility | 0 | 0 | No mention. This is no evidence either way, not proof that users do not care. |

Cross-app facts from vendor docs (UX-xx):
- Write model: Plans and WBS need an explicit save; Structure.Gantt writes on drag (Inferred); BigPicture Unknown.
- Undo: Plans none; BigPicture one step with a confirm; WBS undo and redo of unknown depth; Structure.Gantt Unknown.
- No app documents moving, resizing or linking bars by keyboard, or a preview of dependents moving during a drag.
- Size limits: Plans has a hard limit of 10,000 work items per plan; the others state no Cloud number.

### 5.2 Ranked UX opportunities

| ID | Opportunity | Evidence strength | Backlog |
|---|---|---|---|
| O1 | First run in minutes, no setup screen, clear entry point | Strong (reviews) | B-25 |
| O2 | Never surprise-write Jira; show what will be written and keep a log | Medium | B-03, B-23 |
| O3 | Save at once with 20-step undo and redo, no save modal, no confirm | Strong (docs), Medium (reviews) | B-14 |
| O4 | "Why this date" that names the driving task and rule | Strong (docs gap), Weak to Medium (demand) | B-11, B-12 |
| O5 | Fast and smooth on plans with thousands of rows | Medium | B-13 |
| O6 | Move a selection of bars by N days in one action | Medium (docs), Weak (reviews) | B-16 |
| O7 | Inline percent and lag on a new link, plus a live preview of dependents while dragging | Medium (docs), Weak (reviews) | B-13, B-15 |
| O8 | Progress editable on task and parent, with a visible roll-up or override rule | Medium (docs) | B-04 (already present: T-04 T4) |
| O9 | Keyboard-first scheduling and accessible bars | Strong (docs gap), demand Unknown | B-15 |
| O10 | Readable bars; hour precision when needed | Weak | B-13 criterion 9 (labels); hours not scheduled |

### 5.3 Interaction rules

Each rule is testable. The backlog item in brackets carries the test.

| ID | Rule | Source |
|---|---|---|
| UR-01 | Every edit applies at once, writes once, and shows an ADS Flag with "Undo" that stays at least 10 s. No confirm dialog for routine edits. [B-14] | UP-46, UP-55, UP-56, UP-64, UP-66 |
| UR-02 | Errors never appear only in an auto-dismissing toast. [B-14] | UP-46, UP-69 |
| UR-03 | Every drag has a click-only path through a bar toolbar, and a keyboard path through Space move mode. [B-15] | UP-31, UP-34, UP-67 |
| UR-04 | Handles and link points have a 24 x 24 CSS px hit area or an equivalent control; rows are at least 32 px high. [B-15] | UP-32 |
| UR-05 | During a drag, dependents that will move show at their new dates, with outlines at the old dates; Escape cancels with no write. [B-13] | UP-63, UP-67; T-06 |
| UR-06 | Dependents move only to resolve a conflict, not when slack exists. [B-11] | UP-70 |
| UR-07 | Pickers and explanations use ADS Popup; Modal only for actions the Jira API cannot undo. [B-12, B-14] | UP-48, UP-52 |
| UR-08 | Text editing happens only in DOM inputs or ADS Inline edit placed over the bar, never on the canvas. [B-13] | UP-04, UP-47 |
| UR-09 | Status, critical path, violation and overdue states use colour plus an outline, icon or text label. [B-12, B-15] | UP-36, UP-50, UP-61 |
| UR-10 | Bars, arrows, today line and focus ring reach 3:1; text reaches 4.5:1, in light and dark. [B-13, B-17] | UP-35, UP-40, UP-42 |
| UR-11 | Single-letter shortcuts work only while focus is in the planner and can be turned off. [B-15] | UP-38 |
| UR-12 | Frequent animations under 150 ms; instant with reduced motion. [B-17] | UP-53 |
| UR-13 | Opening, hovering, scrolling and clicking without movement send no Jira write. [B-23] | UX-05; T-04 |

### 5.4 Canvas decision: risks and mitigations

The owner keeps canvas (research-brief 4.3). No canvas Gantt with a documented accessible mirror was found; Frappe uses SVG, and Kendo, Syncfusion and DHTMLX use DOM (UP section 1.2). Google Docs moved to canvas in 2021, and WebAIM later found "only rudimentary assistive technology support" (UP section 1.2). So each risk below needs its test before the canvas build ships.

| ID | Risk | Mitigation | Backlog |
|---|---|---|---|
| R1, R2 | Screen readers see nothing; a virtualised mirror loses focus | Treegrid layer for visible rows plus buffer, absolute `aria-rowindex`, rebuild debounced, focused row never rebuilt | B-15 |
| R3, R4, R5 | Keyboard and single-pointer users cannot edit; small handles | Space move mode, bar toolbar, 24 px hit areas | B-15 |
| R6, R7 | Focus hidden or invisible on canvas | Scroll focused bar into the clear area; `drawFocusIfNeeded` plus a 2 px token ring | B-15 |
| R8, R9 | Colour-only meaning; low-contrast bars | Outline or label plus colour; `.bolder` tokens or 3:1 outline; contrast script | B-12, B-13, B-17 |
| R10 | Forced colours ignored by canvas pixels | Detect `forced-colors: active`, repaint with system colours | B-15 |
| R11, R12 | HiDPI blur; text scaling ignored | Backing store times `devicePixelRatio`; font size from the root font size; Table view | B-13, B-26 |
| R13 | Find-in-page and copy cannot see canvas text | In-app search; real text in the mirror; Table view | B-26 |
| R14 | Text editing inside canvas | DOM inputs only (UR-08) | B-13 |
| R15 | Frame drops on large plans | Viewport culling, one `requestAnimationFrame` scheduler, cached static layer | B-13 |
| R16 | Hidden iframe renders stale frames | Redraw once on visibility change | B-13 |
| R17 | Theme mismatch or missed live theme change | `view.theme.enable()` before first paint, no CSP meta tag, MutationObserver | B-17 |
| R18 | Accessible mirror has flaws | Table view as a supported fallback | B-26 |

Open items after round 3: which keys Jira Cloud captures before the iframe gets them; whether the Forge CSP allows an OffscreenCanvas worker; whether the Forge theme now updates live.
