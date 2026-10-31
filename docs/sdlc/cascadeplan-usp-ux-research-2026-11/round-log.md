# CascadePlan research and build: round log

One entry per research round and per build item. Dates are local (UTC+5:30).

## Round 0: setup (2026-11-01)

- **Repo state.** HEAD `5097bf5`. `git status -s` shows uncommitted changes in 7 files under `apps/planshift` (models.ts, planner-engine.ts, index.ts, index.html, style.css, and two test files; `git diff --stat`: 7,180 insertions, 256 deletions). The research did not make these changes. Part A reviewed this working tree as "current code".
- **Read in full:** the audit (sections 1 and 7, and section 4.1), `appendix-planshift.md`, `models.ts`, `planner-engine.ts`, `index.ts`, `plan-repository.ts` (via the compiled probe), `index.html` (4,076 lines), `manifest.yml`, `package.json`, `jest.config.js`, and the `loop-engine` README, agents and graders.
- **Scratch location:** `~/.cache/gemini-earning-cascadeplan-research/` (`sources/`, `harness/`, `probes/`).
- **Tools:** headless Chrome 153 at `/opt/google/chrome/chrome` driven by Python Playwright; host node 26.13 through `flatpak-spawn --host`; TypeScript compiled to the cache only (`npx tsc -p . --outDir ~/.cache/.../probes/build`).

## Round 1: collect and synthesise (2026-11-01)

### Collect
- Three research subagents ran in parallel, with WebSearch and WebFetch only, no sign-up and no credentials:
  - Jira Plans: 41 sources (JP-01 to JP-41) in `sources/jira-plans.md`. Vote counts were read from the public `jira.atlassian.com` REST API.
  - Marketplace apps: 60 sources (MP-01 to MP-60) in `sources/marketplace-apps.md`. Install counts read from the Marketplace REST API (all-hosting totals).
  - Team size, Silverston and Forge limits: 31 sources (RS-01 to RS-31) in `sources/team-size-silverston-forge.md`.
- Blocked sources: G2, Capterra and Gartner returned HTTP 403. Atlassian Community threads returned the title only. These are recorded as "not readable" and no verdict rests on them.

### Observed-test evidence produced in this round
| ID | What | Result | Where |
|---|---|---|---|
| T-01 | `node --check` on the working-tree inline script | `SyntaxError: Unexpected end of input`. `openEpicPicker` has no closing brace (`index.html:1969-1970`). HEAD `1c238e9` version parses. | `probes/inline-script.js` |
| T-02 | Harness build with patch P-01 (one closing brace, harness copy only) | UI renders 50, 300 and 1,000 tasks with zero page errors | `harness/build_site.py` |
| T-03 | Performance baseline, 5 load runs and 3 drag runs per size | See `ux-spec.md` section 3 | `harness/results/perf-baseline.json` |
| T-04 | UX benchmark, tasks 1 to 9, axe-core, dark-mode emulation | See `ux-spec.md` sections 1 and 4 | `harness/results/ux-baseline.json` |
| T-05 | Backend probes on compiled working tree (P1 to P4, Q2 to Q7) | Dependency cannot be cleared; 40 h and "Unassigned" written on drop; modal dates snapped; engines disagree; plan value 1,214 KiB at 1,000 tasks | `probes/backend-probe-output.json`, `probes/p4.js` |

### Synthesise
- Verdicts H1 to H9 and H10 to H12: `research-brief.md` section 3.
- USP table: `research-brief.md` section 4.
- Benchmark and budgets: `ux-spec.md`.
- Backlog: `backlog.md` (22 items, B-01 to B-22).

### Refute
- Recorded per USP in `research-brief.md` section 5.

## Round 2: revise (2026-11-01)

- Scope: the Unknown items a new source could change: H1 (do teams split tickets?) and H4 (are long-bar drags in Plans unreliable?).
- Searches: "Jira Plans start to start dependency workaround split story" and "Jira Plans timeline drag schedule bar wrong date bug 2025". Results: Atlassian Community threads on finish-to-start links and on splitting stories (bodies not readable), and Plans tickets on date pickers and sprint end dates. None shows ticket splitting as a Plans workaround or a current long-bar drag bug.
- Verdict changes: none. Per brief section 5, the loop stops here. H9 for Plans stays Unknown because G2, Capterra and Gartner return HTTP 403.
- Refute results for each USP: `research-brief.md` section 5. U1 was not disproved. U3 was disproved as unique (WBS Gantt assigns several people, MP-35).

## Owner decisions (2026-11-01)

- Commit the work in progress, with permission to change it: committed as `3ef4841` on `feature/cascadeplan-research-build`. Commit `0252680` closes `openEpicPicker` so the UI script parses (NF-01).
- USP candidates U1, U2, U3 approved as the direction.
- Claims: keep "canvas" (to be made true by B-13), drop the team factor as stated, keep the Silverston WorkEffort model (to become the real model in B-24). See `research-brief.md` section 4.3.
- Run research round 3 with a UX focus.

### Baseline on `0252680`
- `npx tsc --noEmit -p .`: exit 0.
- `npx jest --coverage`: 3 suites, 205 of 205 tests pass. Statements 99.5%, branches 91.88%, functions 96.68%, lines 100%. Per file branches: `index.ts` 88.73% (below 90%), `models.ts` 97.95%, `planner-engine.ts` 97.04%, `plan-repository.ts` 100%.

## Round 3: UX (2026-11-01)

### Collect
- Two research subagents in parallel, WebSearch and WebFetch only:
  - Competitor UX and reviews: 45 sources (UX-01 to UX-45) in `sources/round3-competitor-ux.md`. 393 Cloud reviews read through the Marketplace REST API (`hosting=cloud`); 137 from 2024-05-01 onward have text.
  - UX patterns, accessibility and canvas: 70 sources (UP-01 to UP-70) in `sources/round3-ux-patterns.md`.
- Not readable: Tempo undo page (locked), monday critical path (403), Asana Help Center (404), VTable npm (403).

### Observed-test evidence
| ID | What | Result | Where |
|---|---|---|---|
| T-06 | Canvas timeline prototype with row virtualisation, accessible layer and live dependent preview, same synthetic plans as T-03 | 5,000 tasks: first draw 99 ms, redraw 0.3 ms, drag and scroll p95 16.7 ms, worst 16.8 ms, 59 DOM nodes. Keyboard Right x14 moved a bar 14 days. Drag of SYN-3 by 21 days moved SYN-4 to the computed earliest start (day 74). axe-core: 0 violations (cannot see canvas pixels). Computed contrast: labels on fill 2.71:1 and 2.14:1, unfilled bar on background 1.34:1 and 1.30:1 (fail); arrows 3.23:1 and 4.22:1 (pass) | `harness/canvas-proto.*`, `harness/results/canvas-proto.json`, `canvas-drag-preview.png`, `canvas-dark-proto.png` |

### Synthesise
- `ux-spec.md`: keyboard paths aligned with B-15; canvas column in section 3; new section 5 (review themes, opportunities O1 to O10, interaction rules UR-01 to UR-13, canvas risks R1 to R18).
- `backlog.md`: re-ranked to 27 items. Rewritten: B-12, B-13, B-14, B-15, B-16, B-17. New: B-23 (write transparency), B-24 (WorkEffort as the real model), B-25 (first run), B-26 (Table view and search), B-27 (timeline navigation).
- `research-brief.md`: executive summary, H11, section 4.3 owner decisions, round 3 note in section 5, sources T-06 and sections 8.5, 8.6.

### Refute
- U1 and U2: searched rival docs for a live preview of dependents and a per-task reason naming the driver. None found (UX section 2.6). Not disproved.
- Canvas decision: searched for evidence that canvas Gantts can be accessible. No canvas Gantt with a documented accessible mirror was found; Google Docs on canvas got "only rudimentary assistive technology support" per WebAIM (UP section 1.2). Kept as a risk with 18 required mitigations, not as a blocker, because the prototype shows the treegrid-layer pattern working for keyboard moves.

### Revise
- Verdict changes: H11 (now "achievable with canvas"). No other hypothesis verdict changed. This was the third and last research round allowed by brief section 5.

## Build items

Approved 2026-11-01: `B-01..B-27`. Spec: `docs/spec/cascadeplan-spec.md` (commit `11953b1`); `grade_spec.py` passes on a copy named `planshift-spec.md` (the grader looks for the folder name; the brief names the file `cascadeplan-spec.md`).

Checks per item: `tsc --noEmit`; `npx jest --coverage` with 90% branches for each changed file; `grade_tdd`, `grade_security`, `grade_ui` (`~/.cache/gemini-earning-cascadeplan-research/run_graders.sh`); Playwright harness for UI items; no em dash.

| Item | Date | Tests added | Result | Commit |
|---|---|---|---|---|
| B-01 | 2026-11-01 | `test/ui/static-ui.test.ts` (6), `timeline-math.test.ts` (4), `undo-stack.test.ts` (5), `cascade-preview.test.ts` (7); harness `check_load.py` | Failed first (no modules, inline script). Now 227 of 227 pass; `src/ui/*` branches 92.6% to 100%; bundle loads 50, 300, 1,000 rows with 0 page errors and 0 inline scripts; graders pass. Bundler: esbuild 0.25.11 in `tools/` (D-01) | see git log |
| B-02 | 2026-11-01 | `test/validation.test.ts` (40), `test/resolver-validation.test.ts` (10), `test/ui/safe-html.test.ts` (8), `test/sync-transitions.test.ts` (8); harness `check_xss.py`, `check_no_visible_markup.py` | Failed first (no validation module, 20 raw `innerHTML` templates). Now 290 of 290 pass; branches: `index.ts` 90.18%, `validation.ts` 98.86%, `safe-html.ts` 100%. Payload `<img src=x onerror=...>"><b>x</b>` renders as text in rows, backlog, milestone strip, tooltip, resource picker, epic picker and heatmap; no script ran; no stray markup in normal mode. Old tests changed: invalid sample keys (`P-1`, `TEST-UNSEEN`) replaced by valid keys; mock answers the project lookup | see git log |
| B-03 | 2026-11-01 | `test/no-unrequested-writes.test.ts` (6); harness `check_b03.py` | Failed first (5 of 6). Now 296 of 296 pass; `index.ts` branches 90.52%. Tray drop of an unestimated issue sends no estimate and no assignee; row and card show "Unestimated"; resize payload has no estimate (option off by default); a click with no movement sends 0 writes; modal dates reach the resolver unchanged (2026-11-12, 2026-11-20) and are stored and sent to Jira unchanged; a drag or resize by weeks keeps the exact days. Also fixed: one drop sent two schedule calls (bubbling), and the second overwrote the chosen week. Old test changed: the 40 h default assertion now expects 0 | see git log |
| B-04 | 2026-11-01 | `test/kvs-app-owned.test.ts` (9); harness `check_b04.py` (+ `check_b03.py` rerun) | Failed first (no strip helper). Now 305 of 305 pass; `index.ts` branches 90.41%. Jira summary, status, assignee, estimate and progress win over stale stored values; only a hand-set progress is kept; the one-time migration strips Jira fields and does not run again; summary and epic edits go to Jira (epic as `parent`) and are not stored; computed roll-ups are not stored; the task form sends nothing when nothing changed and only `{summary}` for a summary edit. Criterion 3 clarified (progress on tasks too), recorded in `backlog.md` and the spec. 8 old tests rewritten to assert the Jira write instead of a stored override | see git log |
| B-05 | 2026-11-01 | `test/hierarchy.test.ts` (3); harness `check_b05.py` | Passed on first run: the engine fix predates this item (`3ef4841`). Mutation check: disabling the epic-parent branch in `buildWbsHierarchy` fails the ordering test (levels and order wrong); file restored. Stories of an unscheduled epic render as visible top-level rows and the epic stays in the backlog. Criterion 3 (live Jira Software project): not testable on DEMO, which is a service project | see git log |
| B-06 | 2026-11-01 | `test/dependency-removal.test.ts` (5) | Failed first (null not allowed; no link tracking). Now 313 of 313 pass; `index.ts` branches 90.1%. Setting a dependency creates one "Blocks" link and records its id; saving the same dependency again (through either resolver) keeps one link; choosing None (null or an empty object) stores `dependency: null` and deletes only the link CascadePlan created; a dependency removed by the user does not come back from a Jira link the user made. Note: the link direction semantics of "Blocks" (CP-16 remark) are unchanged and still unverified against Jira docs | see git log |
