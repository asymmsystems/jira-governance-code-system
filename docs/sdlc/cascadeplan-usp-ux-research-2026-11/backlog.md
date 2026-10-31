APPROVED 2026-11-01 B-01..B-27 (owner, in chat: "APPROVED today full"; bundler choice delegated; [DEP], [MIGRATE] and [SCOPE] flags approved)

# CascadePlan: ranked backlog

- **Date:** 2026-11-01
- **Source:** `research-brief.md` and `ux-spec.md` in this folder. Finding IDs CP-01 to CP-29 come from `docs/sdlc/portfolio-audit-2026-10-31/`. NF-01 to NF-09 are new findings from this research (see `research-brief.md`, section 7).
- **Order:** release blockers first (CP-01, CP-02, CP-03, CP-04, CP-05, CP-07, CP-08), then data integrity, then the USP, then UX. A USP that writes wrong data to Jira is not a USP.
- **Approval flags.** Each item that needs one of these carries a flag. The owner must approve the flag, not only the item.
  - `[DEP]` new npm dependency or devDependency (`node_modules` is shared with LedgerSeal).
  - `[SCOPE]` manifest change (scope, permission, module or licensing).
  - `[MIGRATE]` KVS data migration.
- **Test types:** Unit (Jest, pure module), Resolver (Jest, `src/index.ts` with mocked Forge APIs), UI module (Jest, pure front-end module with no DOM), Playwright (harness in `~/.cache/gemini-earning-cascadeplan-research/harness/`).

## Precondition P-0 (owner action, not a build item)

**Resolved 2026-11-01.** The owner's 7-file work in progress is committed as `3ef4841` on `feature/cascadeplan-research-build`, with the owner's permission to change it. Commit `0252680` closes `openEpicPicker`, so the UI script parses (NF-01). Baseline on `0252680`: `tsc --noEmit` passes; Jest 205 of 205 tests pass; coverage 99.5% statements, 91.88% branches overall; `src/index.ts` has 88.73% branches, below the 90% per-file target (fix inside the first item that touches `index.ts`).

**Owner approvals so far (2026-11-01):** USP candidates U1, U2, U3. Not yet given: the `APPROVED` scope line above, the B-01 bundler choice, and the `[MIGRATE]` and `[SCOPE]` flags.

## Summary

| Rank | ID | Title | Serves | Closes or depends on | Size | Flags |
|---|---|---|---|---|---|---|
| 1 | B-01 | UI runs from external modules through the public bridge | Release blocker | CP-02, CP-29 (NF-01 fixed in `0252680`) | M | `[DEP]` decision (bundler) |
| 2 | B-02 | No HTML injection: text nodes only, validated payloads | Release blocker | CP-01, CP-16 | M | none |
| 3 | B-03 | Never write a value the user did not enter | Release blocker | CP-03, CP-04, CP-07, NF-05 | M | none |
| 4 | B-04 | KVS holds app-owned data only; Jira fields read live | Release blocker | CP-05, NF-06 | M | `[MIGRATE]` |
| 5 | B-05 | Epic, story and sub-task hierarchy regression lock | Release blocker | CP-08 | S | none |
| 6 | B-06 | Dependency removal works and stays removed | Integrity | NF-02, CP-16 | S | none |
| 7 | B-07 | Every write reports its Jira result | Integrity | CP-12 | S | none |
| 8 | B-08 | Reads run as the user | Integrity | CP-06 | S | none |
| 9 | B-09 | Per-issue KVS records with version check | Integrity, scale | CP-09, CP-11, CP-26 | L | `[MIGRATE]` |
| 10 | B-24 | WorkEffort becomes the real domain and storage model | Owner decision "Silverston" | B-09 | M | `[MIGRATE]` (shares the B-09 migration) |
| 11 | B-10 | Paged reads, 429 backoff, bounded cascade | Integrity, scale | CP-10, CP-17 | M | none |
| 12 | B-11 | One date-based scheduling engine with a stated reason | U1 | CP-14, NF-03, NF-04, H7 | L | none |
| 13 | B-12 | "Why this date" popup, tooltip and connector label | U1, U2; UX task 8; opportunity O4 | NF-03, B-11 | M | none |
| 14 | B-17 | Real ADS tokens and dark mode (DOM and canvas) | UX | CP-21; depends on B-01 | S | none |
| 15 | B-13 | Canvas timeline with an accessible DOM layer, within the performance budget | Owner decision "canvas"; opportunity O5 | NF-07; depends on B-17 | L | none |
| 16 | B-23 | Write transparency: preview and log of every Jira write | Opportunity O2 | B-03, B-07 | S | none |
| 17 | B-14 | Undo for every write (20 steps), Flag instead of confirm | UX task 6; opportunity O3 | CP-20 | M | none |
| 18 | B-15 | Keyboard and single-pointer scheduling, treegrid layer (WCAG 2.2 AA) | UX task 9; opportunity O9 | CP-21; depends on B-13 | M | none |
| 19 | B-27 | Timeline navigation: zoom levels, Today, frozen headers, day snapping | UX tasks 1 and 2 | B-13 | S | none |
| 20 | B-25 | First run in minutes: no setup screen, clear empty state | Opportunity O1 | B-18 | S | none |
| 21 | B-16 | Standup flow: multi-select, batch progress, move selection by N days | UX task 7; opportunity O6 | B-07, B-09 | M | none |
| 22 | B-26 | Table view and in-app search (canvas fallback) | Canvas risks R13, R18 | B-13 | S | none |
| 23 | B-18 | Remove synthetic data, ghost rows and dead code | Trust | CP-15, CP-18, CP-19, CP-24, CP-25 | M | none |
| 24 | B-19 | One honest "second person" path | U3 | NF-08, CP-13 | S | none |
| 25 | B-20 | Estimation unit stored per task, or claim dropped | Claim honesty | NF-09, H5 | S | `[MIGRATE]` if stored |
| 26 | B-21 | Licensing check | Paid listing | CP-22 | S | `[SCOPE]` |
| 27 | B-22 | Test suite asserts behaviour, not defaults | Quality | CP-27 | S | none |

Opportunity IDs O1 to O10 come from `ux-spec.md` section 5.2 (research round 3).

## Items

### B-01. UI runs from external modules through the public bridge
- **Serves:** release blocker. The Forge CSP and the private bridge are both release risks (CP-02).
- **Closes:** CP-02 (one inline script, private `window.__bridge`), CP-29 (inline handlers).
- **Owner decision needed `[DEP]`:** `@forge/bridge` is already in `package.json` (`^7.2.1`). The browser cannot load its CommonJS build without a bundler, and no bundler is installed. Options: (a) add `esbuild` as a devDependency (shared `node_modules`); (b) vendor one pre-built bridge file into `static/frontend/build/vendor/`. Brief section 11.3 says to stop and ask. Part B will not choose.
- **Acceptance criteria:**
  1. `static/frontend/build/index.html` contains no inline `<script>` body and no `on*=` attribute. (Unit: a Jest test reads the file and asserts zero matches.)
  2. Every resolver call goes through `invoke` from `@forge/bridge`. No source file references `__bridge`. (Unit: grep-style Jest test on the built JS.)
  3. Pure logic lives in modules with no DOM access: week mapping, drag-to-week conversion, undo stack, cascade preview. (UI module: Jest under the `node` environment, at least 90% branch coverage per file.)
  4. The page loads in the harness with zero `pageerror` events and renders all rows for 50, 300 and 1,000 tasks. (Playwright.)
  5. `manifest.yml` still declares no `scripts: unsafe-inline`. (Unit.)
- **Size:** M.

### B-02. No HTML injection: text nodes only, validated payloads
- **Serves:** release blocker (CP-01 was Observed-live on 2026-10-31).
- **Closes:** CP-01; the key-check part of CP-16.
- **Acceptance criteria:**
  1. No `innerHTML`, `outerHTML` or `insertAdjacentHTML` call takes Jira or payload data. (Unit: static check over the UI modules; the allowed list holds only constant template strings.)
  2. A summary of `<img src=x onerror=alert(1)>"><b>x</b>` renders as literal text in the row, backlog card, tooltip, epic picker, resource picker, milestone strip and heatmap. No `img` or `b` element is created. (Playwright.)
  3. Each write resolver rejects a payload whose issue key does not match `^[A-Z][A-Z0-9_]+-\d+$`, or whose key is not in the live project issue set, with a validation error and no KVS or Jira write. (Resolver.)
  4. `updateWbsTask` rejects wrong types and over-long strings for every allowed key. (Resolver.)
- **Size:** M.

### B-03. Never write a value the user did not enter
- **Serves:** release blocker.
- **Closes:** CP-03 (40 h written on drop, Observed-test probe Q5), CP-04 ("Unassigned" stored on drop), CP-07 (modal dates snapped to week edges, probe Q6; drag is already fixed), NF-05 (resize rewrites the Jira estimate by default).
- **Acceptance criteria:**
  1. Scheduling an unestimated issue from the tray sends no `timetracking` field to Jira, and the row shows "Unestimated". (Resolver: assert the PUT body; Playwright: assert the cell text.)
  2. Scheduling from the tray sends no assignee and stores no `resource`. (Resolver.)
  3. Resize changes dates only. It sends no estimate unless the user turns on a per-action option. The option is off by default. (Resolver + Playwright: payload has no `effortHours`.)
  4. A start date and due date picked in the modal reach Jira unchanged (for example `2026-11-11` stays `2026-11-11`). (Resolver.)
  5. The time inputs are removed, or stored and shown again on reopen. (Playwright.)
  6. A click on a bar with no movement sends no write. (Playwright: zero `updateWbsTask` calls; this guards the existing fix.)
- **Size:** M.

### B-04. KVS holds app-owned data only; Jira fields are read live
- **Serves:** release blocker.
- **Closes:** CP-05 (stored summary, status, assignee and estimate override Jira), NF-06 (modal save sets `manualProgress` on every task).
- **Approval `[MIGRATE]`:** existing `scheduleMap:*` entries hold Jira-owned fields. The migration drops `summary`, `status`, `resource`, `resourceAccountId`, `epic`, `effortHours` and leaf `progress` from stored entries.
- **Acceptance criteria:**
  1. After a Jira-side change of summary, status, assignee or estimate, the next `getProjectPlan` returns the Jira value even when a stored entry exists. (Resolver.)
  2. The modal sends only the fields the user changed. Opening and saving with no edit sends no write. (Playwright: payload diff.)
  3. `manualProgress` and a stored percent are set only when the user changes progress (on a task or a parent); a form save that does not change progress never sets them. Clarified 2026-11-01 during the build: U5 and benchmark task 4 need progress on tasks too, and NF-06 was about every save setting the flag. (UI module + Resolver.)
  4. The migration is idempotent, and the plan renders the same before and after it, apart from the dropped fields. (Resolver.)
- **Size:** M.

### B-05. Epic, story and sub-task hierarchy regression lock
- **Serves:** release blocker (CP-08). The engine fix exists in the working tree (probe P4 on 2026-11-01: `E-1 S-1 ST-1 S-2` in the right order and levels).
- **Acceptance criteria:**
  1. Jira-shaped search results with epic, two stories and one sub-task produce levels 1, 0, 0, -1, and the sub-task follows its story. (Resolver.)
  2. A story whose epic is not on the timeline renders as a top-level row, not a hidden sub-task. (Resolver + Playwright.)
  3. Live check on a Jira Software project. DEMO is a service project, so this is "not testable on DEMO" until the owner adds a software project.
- **Size:** S.

### B-06. Dependency removal works and stays removed
- **Serves:** integrity. The USP is dependencies, so a dependency that cannot be removed breaks it.
- **Closes:** NF-02 (probe Q4: `updateWbsTask({ dependency: null })` keeps the dependency; probe Q4b: a "Blocks" link recreates it); the duplicate-link part of CP-16.
- **Acceptance criteria:**
  1. Choosing "None" in the modal removes the dependency from KVS. (Resolver.)
  2. Removing a dependency also removes the "Blocks" link that CascadePlan created, and no other link. (Resolver: assert the DELETE call and its link id.)
  3. Saving the same dependency twice creates one link, not two. (Resolver.)
  4. A removed dependency does not come back on the next load. (Resolver.)
- **Size:** S.

### B-07. Every write reports its Jira result
- **Closes:** CP-12.
- **Acceptance criteria:**
  1. Each write resolver returns `{ ok, jiraSync: { ok, error } }`. (Resolver.)
  2. The UI treats a `null` or thrown bridge result as an error and shows a banner with the Jira error text. (UI module + Playwright with a failing mock.)
  3. A failed subtask create never shows "Created". (Playwright.)
- **Size:** S.

### B-08. Reads run as the user
- **Closes:** CP-06.
- **Acceptance criteria:**
  1. `fetchLiveJiraIssues`, `fetchProjectEpics` and `fetchProjectUsers` call `asUser()`. (Resolver with separate `asApp` and `asUser` mocks; the test fails if `asApp` is called.)
- **Size:** S.

### B-09. Per-issue KVS records with version check
- **Closes:** CP-09 (probe Q7: the cached plan value is 1,214 KiB at 1,000 tasks against a 240 KiB limit, source RS-18), CP-11, CP-26.
- **Approval `[MIGRATE]`:** move from `scheduleMap:<projectKey>` and `ps:plan:<projectKey>` to one record per issue id under a project-id prefix.
- **Acceptance criteria:**
  1. No KVS value exceeds 8 KiB at 1,000 tasks with one dependency each. (Resolver: size assertion.)
  2. `getProjectPlan` writes nothing to KVS. (Resolver.)
  3. Two writes with the same base version: the second gets a conflict error, and the first change survives. (Resolver.)
  4. Keys use the project id, so a renamed project keeps its plan. (Resolver.)
- **Size:** L.

### B-10. Paged reads, 429 backoff, bounded cascade
- **Closes:** CP-10, CP-17.
- **Acceptance criteria:**
  1. Search pages with `nextPageToken` up to a stated cap, and the UI shows "showing N of M" when capped. (Resolver + Playwright.)
  2. A 429 with `Retry-After` is retried with backoff inside a 20 s budget (the resolver limit is 25 s, RS-19). (Resolver.)
  3. A cascade that touches more than a set number of issues is previewed first and then applied through an async event (async limit 900 s, RS-19). (Resolver.)
  4. `updateWbsTask` builds the plan once, not twice. (Resolver: count calls.)
- **Size:** M.

### B-11. One date-based scheduling engine with a stated reason
- **Serves:** USP-1 (percent-trigger earliest start with a visible reason).
- **Closes:** CP-14 (pull-in from outside the window, probe P1; allocation lost at the window end, probe P3; whole-week rounding), NF-03 (the day engine and the week engine disagree, probe Q2), NF-04 (team factor with no cap, H7).
- **Acceptance criteria:**
  1. One function computes earliest start for both the auto-move and the violation check. The old week engine and its client copy are removed. (Unit.)
  2. The result is a date, with units in days, using effort-based progress when the predecessor has an estimate, and planned duration otherwise. (Unit: table of cases with expected dates.)
  3. The result always carries a reason with the predecessor key, the trigger percent, the date the trigger is reached and the basis (planned or observed). Example: "Starts 2026-11-11 because API-4 reaches 30% on 2026-11-10 (planned: 27 days)". (Unit.)
  4. A successor outside the visible window is never moved by a cascade. (Unit: probe P1 case.)
  5. A successor near the window end keeps its full duration and allocation. (Unit: probe P3 case.)
  6. The team factor is `1 + 0.25 x (min(N, 5) - 1)`, labelled as an assumption, and no gain applies to a task that has started or is late. Source: research-brief H7 (RS-04 to RS-08). If the owner prefers, remove the factor. (Unit.)
  7. A missing trigger is a validation error, not a silent 30. (Resolver.)
- **Size:** L.

### B-12. "Why this date" popup, tooltip and connector label
- **Serves:** U1 and U2 (approved 2026-11-01); UX benchmark task 8; opportunity O4. Pattern sources: MS Project Task Inspector and Smartsheet driving path (UP-60, UP-62).
- **Depends on:** B-11.
- **Acceptance criteria:**
  1. The tooltip of a dependent bar shows the reason text from B-11. (Playwright: tooltip contains "because".)
  2. The connector label shows the trigger percent and the trigger date. (Playwright.)
  3. "Why this date?" opens from the bar menu, a click on the reason, or the `?` key while focus is in the Gantt. It is an ADS Popup, not a Modal (UP-48, UP-52). (Playwright: no element with `role="dialog"` and `aria-modal="true"`.)
  4. The popup lists the drivers in order: driving predecessor with trigger percent and trigger date, observed or planned basis, manual pin if any. Each predecessor is a link that moves focus to its bar. (Playwright: click the predecessor link, focus is on that row.)
  5. The bars on the driving chain get a distinct outline plus a text label in the accessible layer, not colour alone (WCAG 1.4.1, UP-36). (Playwright + greyscale screenshot check.)
  6. A violation shows what to change: "Move API-5 to 2026-11-11 or lower the trigger to 20%", and each option is a button that applies the change with undo. (Unit + Playwright.)
- **Size:** M.

### B-13. Canvas timeline with an accessible DOM layer, within the performance budget
- **Serves:** UX; owner decision "keep canvas" (research-brief 4.3).
- **Closes:** NF-07 (hover redraws every arrow: 347 ms at 1,000 tasks; drag frames up to 250 ms; measured 2026-11-01).
- **Design:** bars, arrows, grid and the today line are drawn on one `<canvas>` (scaled by `devicePixelRatio`), drawing only visible rows. The data columns stay DOM, with row virtualisation. A transparent DOM layer holds one focusable `role="gridcell"` element per visible bar, with an accessible name, so focus, screen readers and keyboard moves do not depend on canvas pixels. Colours come from CSS custom properties read at draw time, so ADS tokens and dark mode apply. Reference prototype: `~/.cache/gemini-earning-cascadeplan-research/harness/canvas-proto.js` (T-06).
- **Acceptance criteria (budgets from `ux-spec.md` section 3):**
  1. Bars and arrows are drawn on a `<canvas>` element; no bar is a DOM element with a background. (Playwright: canvas present, `.gantt-bar` count 0.)
  2. Hover on a bar at 1,000 tasks costs at most 8 ms of script time. (Playwright harness.)
  3. Dragging a 2-month bar by 2 weeks at 1,000 and 5,000 tasks: p95 frame time at most 16.7 ms, no frame above 50 ms. (Playwright harness.)
  4. First render at 1,000 tasks: data rows and timeline within 300 ms. (Playwright harness.)
  5. During a drag, dependents move live as a preview, with dashed outlines at their old positions. (Playwright: preview start of the successor equals the computed earliest start.)
  6. After a drop, the UI sends 1 resolver call, not 2, and does not rebuild unchanged rows. (Playwright harness.)
  7. Every canvas colour pair used for text, bars and arrows meets WCAG contrast (4.5:1 text, 3:1 bars and arrows) in light and dark themes. axe cannot see canvas pixels, so the test computes the ratios from the token values. (Unit.)
  8. HiDPI: at `devicePixelRatio` 2 the canvas backing store is twice the CSS size. (Playwright.)
  9. Labels never sit on a fill with less than 4.5:1 contrast; a label moves outside the bar when needed. (Unit + screenshot check.)
- **Size:** L.

### B-14. Undo for every write (20 steps), Flag instead of confirm
- **Serves:** UX task 6; opportunity O3. Jira Plans has no Ctrl+Z (JP-21); BigPicture undoes one step and asks to confirm (MP-05). NN/g: no confirmation dialogs for routine actions; support multiple undo (UP-64, UP-66). Linear has global Cmd+Z (UP-56).
- **Closes:** CP-20.
- **Acceptance criteria:**
  1. An undo stack (pure module) records the inverse of each write, including the cascade, with at least 20 steps, and redo. (UI module: 20 edits then 20 undos restore every affected date exactly.)
  2. Ctrl+Z and Ctrl+Shift+Z (Cmd on macOS) work while focus is in the planner, and only there (WCAG 2.1.4, UP-38). (Playwright.)
  3. Each write shows an ADS Flag with one "Undo" action, for example "Moved ABC-12 and 4 dependents. Undo". The Flag stays at least 10 s and while the pointer or focus is on it (UP-46, UP-66). (Playwright: Flag present at 9.9 s.)
  4. Move, resize, link, unlink, progress, unschedule and tray drop open no confirm dialog. (Playwright: zero dialogs.)
  5. A failed Jira write shows a Flag that does not auto-dismiss (UP-46, UP-69). (Playwright with a failing mock.)
  6. A confirm Modal exists only for actions that the Jira API cannot undo, and it names the consequence ("Remove 37 links between 22 issues") (UP-64). (Unit: list of Modal uses.)
  7. A form with unsaved edits asks before it closes on Escape or a backdrop click. (Playwright.)
- **Size:** M.

### B-15. Keyboard and single-pointer scheduling, treegrid layer (WCAG 2.2 AA)
- **Serves:** UX task 9; opportunity O9 (no competitor documents keyboard move, resize or link of bars: JP-18, MP-06, MP-32, UX-14). Canvas risks R1 to R7 (`ux-spec.md` section 5.4).
- **Closes:** the accessibility part of CP-21 (0 ARIA attributes; bars not focusable; axe-core: 11 unlabelled form fields and 6 unnamed selects in the task modal, 2 contrast failures; measured 2026-11-01).
- **Depends on:** B-13.
- **Acceptance criteria:**
  1. The timeline exposes a `role="treegrid"` layer for the visible rows plus 10 rows each side, with `aria-rowcount` (all rows) and an absolute `aria-rowindex` and `aria-level` per row (UP-07, UP-13). (Playwright: scroll to row 500, focused row has `aria-rowindex="501"`.)
  2. Each row has cells Key, Summary, Start, Due, Progress, Status, Dependencies; the Dependencies cell reads like "Starts when ABC-12 reaches 30% (2026-11-10)". (Playwright: accessible names.)
  3. The treegrid has one tab stop. Arrow keys move between cells and rows; Home, End, Page Up, Page Down work (UP-06). (Playwright: Tab, then Tab again leaves the planner.)
  4. Space on a focused bar enters move mode: Left and Right move 1 day, Shift+Left and Shift+Right move 1 week, `[` and `]` change the end date, Enter commits, Escape cancels; an `aria-live="polite"` region announces mode and dates (UP-67). Exact keys are checked for conflicts with Jira shortcuts before build (open item). (Playwright: tasks 1 and 2 by keyboard only.)
  5. Every drag has a single-pointer path: clicking a bar shows a toolbar with Move earlier, Move later, Edit dates, Add dependency, Set progress (WCAG 2.5.7, UP-31). (Playwright: tasks 1 to 4 with `click()` only, no mouse down/move/up.)
  6. "Add dependency" opens an ADS Popup with a searchable issue list and a trigger percent field; a link is created by keyboard in at most 8 key presses (UP-48). (Playwright.)
  7. Resize handles and link points have a 24 x 24 CSS px hit area, or the toolbar is the equivalent control for short bars (WCAG 2.5.8, UP-32). Rows are at least 32 px high. (Unit: hit test at handle centre plus or minus 12 px.)
  8. Click on a bar and focus on its row stay in sync within one frame; the focused bar is never fully hidden by the sticky header, frozen columns or a Flag (WCAG 2.4.11, UP-33). (Playwright.)
  9. The focus ring is drawn with `drawFocusIfNeeded` plus a 2 px `color.border.focused` ring at 3:1 contrast (UP-03, UP-40). (Unit contrast check + Playwright.)
  10. Single-letter shortcuts work only while focus is in the planner, and a setting turns them off (WCAG 2.1.4). (Playwright: typing "t" in another input does nothing.)
  11. axe-core reports zero WCAG 2.2 A or AA violations on the page, in every popup and form, and in the Table view (B-26). (Playwright.)
  12. Forced colours: with `forced-colors: active`, bars, arrows and the focus ring use system colours (R10). (Playwright with forced-colors emulation.)
- **Size:** M.

### B-16. Standup flow: multi-select, batch progress, move selection by N days
- **Serves:** UX task 7 (baseline: 40 clicks and 40 resolver calls for 20 progress changes); opportunity O6 (Plans bulk edits only assignee, team and sprint, JP-19; BigPicture one field for up to 50 tasks, MP-08). Selection pattern: TeamGantt (UP-59).
- **Depends on:** B-07, B-09.
- **Acceptance criteria:**
  1. Ctrl/Cmd+click toggles a row, Shift+click selects a range, Space toggles the focused row. A selection bar shows the count and actions: Set progress, Move by N days, Set assignee. (Playwright.)
  2. Keyboard flow: Down moves to the next row, digits 0 to 9 set progress in steps of 10, Enter commits. (Playwright.)
  3. "Move by 3 days" on 5 selected rows moves all 5 and their dependents, with one undo for the batch. (Playwright.)
  4. 20 changes send at most 2 resolver calls. (Playwright: call count.)
- **Size:** M.

### B-17. Real ADS tokens and dark mode (DOM and canvas)
- **Closes:** the theming part of CP-21 (`style.css:1-18` redefines `--ds-*` tokens with fixed light values; dark-mode emulation left the body at `rgb(244, 245, 247)`).
- **Depends on:** B-01 (`view.theme.enable()` comes from `@forge/bridge`, RS-26, UP-43).
- **Acceptance criteria:**
  1. `view.theme.enable()` runs before the first paint; with Jira in dark mode the first canvas frame already uses dark token values (UP-43). (Playwright: pixel sample equals the resolved `--ds-surface`.)
  2. `style.css` defines no `--ds-*` token and `index.html` has no CSP meta tag (UP-44). (Unit: static check.)
  3. The canvas renderer reads every colour from resolved `--ds-*` properties and has no hex literals outside a fallback map. (Unit: static check.)
  4. A change of `data-color-mode` or `data-theme` on `<html>` repaints the canvas within one frame (MutationObserver; UP-44 reports stale themes). (Playwright.)
  5. Bars use `color.background.accent.*.bolder` tokens or a 3:1 outline (UP-42); text, bars, arrows, today line and focus ring meet contrast in light and dark. (Unit contrast script over resolved tokens.)
  6. Frequent animations last under 150 ms and are instant with `prefers-reduced-motion` (UP-53). (Playwright with emulated reduced motion.)
- **Size:** S.

### B-18. Remove synthetic data, ghost rows and dead code
- **Closes:** CP-15, CP-18, CP-19, CP-24, CP-25.
- **Acceptance criteria:**
  1. No fixed badge text before load ("Project: DEMO", "Completion: 31%"), no "Prerequisites" or "General" default, no placeholder users, no heatmap CoE defaults. (Unit: static check + Playwright.)
  2. Entries that Jira did not return are not rendered and are pruned. (Resolver.)
  3. Weeks are computed per call. No module-level week list is used by a resolver. (Resolver: fake clock across a week boundary.)
  4. `src/frontend/index.tsx` is deleted. (Unit.)
  5. The KVS-only "Subtasks and Risk Buffer" section is removed or renamed so it is not confused with Jira sub-tasks. (Playwright.)
- **Size:** M.

### B-19. One honest "second person" path
- **Serves:** USP-3 candidate (multi-person work on Jira's single-assignee model; JRACLOUD-61588, 76 votes, JP-23).
- **Closes:** NF-08 (the Team picker stores contributors only in KVS; the modal creates real Jira sub-tasks), the create-flow part of CP-13.
- **Acceptance criteria:**
  1. Adding a second person creates a Jira sub-task assigned to that person, from both the picker and the modal. (Resolver: POST body has `parent` and `assignee.accountId`.)
  2. Removing that person asks whether to delete or unassign the sub-task. (Playwright.)
  3. Create Task sends `assignee.accountId` and `parent.key`. (Resolver.)
- **Size:** S.

### B-20. Estimation unit stored per task, or claim dropped
- **Closes:** NF-09 (the modal resets the unit to Hours on every open; only hours are saved).
- **Owner decision:** keep mixed units (store `unit` and `rawEstimate` per task, `[MIGRATE]` none needed for new data) or drop the claim from the listing.
- **Acceptance criteria (if kept):**
  1. A task saved as 5 story points reopens as 5 story points and shows 40 h as the converted value. (Playwright + Resolver.)
  2. Jira receives only the original estimate in hours, and only when the user changed it. (Resolver.)
- **Size:** S.

### B-21. Licensing check
- **Closes:** CP-22.
- **Approval `[SCOPE]`:** adds `app.licensing` to `manifest.yml`.
- **Acceptance criteria:**
  1. An unlicensed context gets a clear "licence required" response and no write. (Resolver.)
- **Size:** S.

### B-23. Write transparency: preview and log of every Jira write
- **Serves:** opportunity O2. Recent reviews report a Gantt app deleting Jira issues and changing "Updated Date" on thousands of tickets (UX-05); the 2026-10-31 audit saw a CascadePlan estimate change break a LedgerSeal seal (PX-04).
- **Depends on:** B-03, B-07.
- **Acceptance criteria:**
  1. Before a cascade writes to more than one issue, the drag preview names every issue and field that will change (for example "API-5 due 2026-11-18, API-6 due 2026-11-25"). (Playwright.)
  2. A "Changes" panel lists each Jira write of the session: issue key, field, old value, new value, result. (Playwright + Resolver.)
  3. Opening the planner, hovering, clicking without movement and scrolling send no Jira write. (Playwright: zero PUT or POST calls.)
- **Size:** S.

### B-25. First run in minutes: no setup screen, clear empty state
- **Serves:** opportunity O1. Learning curve and complexity is the top negative UX theme in 137 recent Cloud reviews (11 negative), and "easy to use" is the top praise (22 positive) (`ux-spec.md` section 5.1). A Structure.Gantt reviewer: "No onboarding prompt, no entry point, no documentation link" (UX-03).
- **Depends on:** B-18.
- **Acceptance criteria:**
  1. A project with issues shows a working timeline on first open with no configuration step. (Playwright.)
  2. A project with no scheduled issues shows an empty state with one primary action ("Schedule your first issues") and a link to help. (Playwright.)
  3. The first percent-trigger link can be created within 3 actions of first open, guided by an inline hint that disappears after first use. (Playwright.)
- **Size:** S.

### B-26. Table view and in-app search (canvas fallback)
- **Serves:** canvas risks R13 (find-in-page cannot see canvas text) and R18 (accessible mirrors have known flaws, UP-12).
- **Depends on:** B-13.
- **Acceptance criteria:**
  1. A "Table view" toggle shows the same rows and dates as a plain DOM table without canvas. (Playwright.)
  2. The Table view passes axe-core with zero violations. (Playwright.)
  3. An in-app search field (and Ctrl/Cmd+F while focus is in the planner) finds an issue key or summary and moves focus to its row. (Playwright.)
- **Size:** S.

### B-27. Timeline navigation: zoom levels, Today, frozen headers, day snapping
- **Serves:** UX tasks 1 and 2. Zoom levels as in Linear and Notion (UP-57, UP-58); frozen headers (UP-68). Baseline: 15 fixed weeks, only 5 visible at 1,440 px.
- **Depends on:** B-13.
- **Acceptance criteria:**
  1. Zoom levels Day, Week, Month, Quarter, Year from a toolbar and Ctrl/Cmd+plus or minus while focus is in the planner; the focused issue stays in view. (Playwright.)
  2. The visible range is not limited to 15 weeks; scrolling past either edge loads more time. (Playwright.)
  3. "Today" scrolls the today line into view; `T` does the same while focus is in the planner. (Playwright.)
  4. Drag snaps to days at Day and Week zoom and to weeks at Month and above; Alt held snaps to days at any zoom. (Playwright.)
  5. The timescale header and the issue columns stay frozen while scrolling. (Playwright.)
  6. The data columns can collapse to Key and Summary, so at 1,280 px at least 12 weeks are visible at Week zoom. (Playwright.)
- **Size:** S.

### B-24. WorkEffort becomes the real domain and storage model
- **Serves:** owner decision "keep the Silverston WorkEffort model" (research-brief 4.3).
- **Depends on:** B-09 (one KVS record per issue). Both share one migration.
- **Acceptance criteria:**
  1. KVS stores app-owned planning data as `WorkEffort` (dates, sequence), `WorkEffortAssoc` (precedence with `triggerPercent`), `WorkEffortPartyAssignment` (second people) and `WorkEffortEstimate` (unit, raw value) records, keyed by project id and issue id. (Resolver.)
  2. The engine (B-11) takes WorkEffort and WorkEffortAssoc records as input. `WbsTask` is only a view model built for the UI. (Unit.)
  3. Jira-owned fields (summary, status, assignee, Jira estimate) are never stored in a WorkEffort record (B-04 rule). (Resolver.)
  4. `toWorkEffort` and `fromWorkEffort` round-trip every stored field without loss. (Unit: property-style table test.)
  5. Each WorkEffort record at 1,000 tasks stays under 8 KiB (RS-18 limit is 240 KiB). (Resolver.)
- **Size:** M.

### B-22. Test suite asserts behaviour, not defaults
- **Closes:** CP-27 (23 `toBeDefined()` assertions in `test/index.test.ts`; tests still assert the 40 h default at `test/domain/planner-engine.test.ts:447-448` and `test/index.test.ts:512`).
- **Acceptance criteria:**
  1. No test asserts the 40 h default as correct. (Unit.)
  2. Every `toBeDefined()` assertion is replaced by a value or a call-body assertion. (Unit: static check.)
  3. `asApp` and `asUser` are separate mocks, and a test fails if a read uses `asApp`. (Resolver.)
- **Size:** S.
