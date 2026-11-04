# CascadePlan build loop: handover to Gemini

Date: 2026-11-01. From: Claude (Opus), working for the owner, Fahim Farook. To: the agent that continues the loop.

Read this whole file before you run a command. Then read the files in section 3, in that order.

## 1. Your task

Continue the "CascadePlan Research and Build Loop" from where it stopped.

- Part A (research) is done and approved.
- Part B (build) is done for 19 of the 28 backlog items.
- You must finish the rest of Part B (section 5), then Loop 3 (section 6), then the final report (section 7).

Work one backlog item at a time. Each item gets one commit and one round-log row. Do not start the next item before the current one is committed.

## 2. Where everything is

| What | Where |
|---|---|
| Repository | `/home/fahimfarookme/Documents/projects/gemini-earning` |
| Branch | `feature/cascadeplan-research-build` (no remote; do not push, merge, rebase, tag or force anything) |
| App | `apps/planshift` (product name CascadePlan; Forge app, Custom UI) |
| Spec | `docs/spec/cascadeplan-spec.md` (invariants INV-01 to INV-15, domain model, decisions D-01 to D-10) |
| Research and backlog | `docs/sdlc/cascadeplan-usp-ux-research-2026-11/` (`research-brief.md`, `ux-spec.md`, `backlog.md`, `round-log.md`, `silverston-conformance.md`, this file) |
| Original loop instructions | `loop-engine/agents/cascadeplan_usp_ux_research.md` (read-only; it is not yours, do not edit or commit it) |
| Harness and scratch output | `~/.cache/gemini-earning-cascadeplan-research/` (`harness/`, `commits/`, `logrow.py`, `run_graders.sh`) |
| Last commit when this was written | `d1e0c95 feat(cascadeplan): standup flow with multi-select and batch edits` |

The working tree is clean for CascadePlan files. Other folders in the repo show as untracked (for example `docs/sdlc/definitionguard-usp-ux-research-2026-11/`, `docs/sdlc/ledgerseal-usp-ux-research-2026-11/`, `loop-engine/agents/*.md`). They belong to other work. Never stage them. Never use `git add -A`, `git add .` or `git add docs`. Always stage explicit file paths.

## 3. Read first, in this order

1. `docs/sdlc/cascadeplan-usp-ux-research-2026-11/backlog.md`: the first line is the owner approval; the table lists 28 items; each item has acceptance criteria. B-28 was added by the owner on 2026-11-01.
2. `docs/sdlc/cascadeplan-usp-ux-research-2026-11/round-log.md`: the "Build" table has one row per finished item, with test counts, coverage, measured results, deviations and known limits. Read the last 8 rows closely.
3. `docs/spec/cascadeplan-spec.md`: sections 1 (invariants), 3.1 and 3.2 (stored WorkEffort model, rewritten in B-28), 3.3 (schedule engine), and the decisions table.
4. `docs/sdlc/cascadeplan-usp-ux-research-2026-11/silverston-conformance.md`: the model audit. F11 (stored week fields) is still open.
5. `apps/planshift/src/index.ts` (resolvers), `src/domain/` (engine, models, links), `src/ui/` (pure UI logic), `src/frontend/` (DOM code; `legacy-planner.js` is the big one).

## 4. Hard rules (from the owner and the brief; do not break any)

Product rules:
- Never write a value to Jira that the user did not enter in this action (INV-03). Read Jira-owned fields live. Store only app-owned planning data in KVS (INV-04).
- Escape all text. Never put data into `innerHTML` except through the `html` tagged template in `src/ui/safe-html.ts`, which escapes every value (INV-01).
- No new npm dependency, manifest scope change or KVS migration without owner approval. Already approved: esbuild in `apps/planshift/tools/`, the B-21 `[SCOPE]` change (`app.licensing` in `manifest.yml`), the B-09 and B-28 migrations.
- Never deploy to staging or production. Never publish to the Marketplace. Never change licensing settings or the listing.
- No trials that ask for payment details. Do not post in forums, write reviews or contact vendors.
- Never send the owner's email address or any credential to any service.

Process rules:
- Test-driven: write the failing test first, run it, see it fail, then write the code. If you write a test after the code, say so in the round-log row.
- At least 90% branch coverage for every changed source file under `src/` (frontend DOM files under `src/frontend/` are excluded from coverage; put logic into pure modules under `src/ui/` or `src/domain/` and test those).
- Every new file starts with this header:
  ```
  /*
   * Copyright (c) 2026 Asymm Systems. All rights reserved.
   *
   * @author Fahim Farook
   */
  ```
- Plain English everywhere, no marketing words, and never an em dash (the long dash character) in any file, commit or message.
- Commit with a message file: `git -c user.email="fahim@fahimfarook.me" -c user.name="Fahim Farook" commit -F <file>`. Subject: `type(cascadeplan): summary`. Body: describes the final state (what the code does now), not what was wrong. End with a `Refs:` trailer (for example `Refs: B-26`). Never add a `Co-Authored-By` line for any AI.
- Put commit message files in `~/.cache/gemini-earning-cascadeplan-research/commits/`.
- Add one round-log row per item with `python3 ~/.cache/gemini-earning-cascadeplan-research/logrow.py '<row>'`. Follow the style of the existing rows: tests added, test count and coverage, each acceptance criterion with what was measured, fixes made on the way, deviations, known limits. Last column: `see git log`.
- Ask the owner only when a decision is genuinely theirs. Ask one fully framed question at a time (options, trade-offs, your recommendation). Do all unblocked work first.

## 5. Remaining backlog, in order

The order the owner approved (B-18 was done before B-25 because B-25 depends on it):

| Item | Status | Notes |
|---|---|---|
| B-01 to B-12, B-17, B-24 | done | earlier commits |
| B-13, B-23, B-14, B-15, B-28, B-27 (+ follow-up), B-18, B-25, B-16 | done | commits `abbf736` to `d1e0c95` |
| **B-26** Table view and in-app search | next | criteria in `backlog.md`. A "Table view" toggle shows the same rows and dates as a plain DOM table with no canvas; axe 0 violations on it; an in-app search field plus Ctrl/Cmd+F (only while focus is in the planner) finds a key or summary and moves focus to that row (use `scrollRowIntoView(key)` and the treegrid focus helpers in `legacy-planner.js`). B-15 criterion 11 (axe in the Table view) is closed by this item. |
| **B-19** One honest "second person" path | open | B-28 already stores contributors by account id (`contributors: [{accountId, since, subtaskKey}]`). B-19: adding a second person creates a Jira sub-task assigned to that person (POST body has `parent` and `assignee.accountId`), from the picker and the form; removing that person asks (inside the form, no browser dialog) whether to delete or unassign the sub-task; Create Task sends `assignee.accountId` and `parent.key`. Record the sub-task key in `subtaskKey`. Deleting a Jira issue is a destructive write: only on the user's explicit choice. |
| **B-20** Estimation unit stored per task, or claim dropped | needs owner decision | Ask the owner first, with options: (a) keep mixed units (store `unit` and `rawEstimate` per task in the existing `WorkEffortEstimate` extension; no migration for new data), or (b) drop the mixed-unit claim from the listing and the UI. Recommend (a) only if the form keeps the unit on reopen; see audit finding F8. |
| **B-21** Licensing check | open, `[SCOPE]` approved | Add `app.licensing` to `manifest.yml`; an unlicensed context gets a clear "licence required" result and no write (resolver test). Read the Forge licensing docs before you write it (verify the exact manifest key and the `context.license` shape from developer.atlassian.com; do not guess). |
| **B-22** Test suite asserts behaviour, not defaults | open | Criteria in `backlog.md`. |

Open items you must not lose (from the round log):
- Audit finding F11: stored week fields (`startWeek`, `spanWeeks`, `weeklyAllocations`) are still in each record; "scheduled" still depends on `startWeek`. Fix it only with its own tested migration step, or list it in the final report as known.
- `grade_ui` fails its rule "Frontend components must use native '@forge/react' UI Kit 2". That is expected: decision D-09 (Custom UI is required for the canvas). The grader is shared code; do not edit it. Report it.
- A batch (`batchUpdateTasks`) does not continue cascades beyond 25 dependents per item.
- With all 8 data columns frozen, only about 3 weeks show at 1,280 px; the planner then starts in compact columns automatically (owner decision 2026-11-01).

## 6. Loop 3 (after B-22)

1. Rerun the UX benchmark and the performance measurement; add an "After" column to `ux-spec.md` next to the baseline numbers. The scripts are `harness/ux_bench.py` and `harness/measure_perf.py`. Both still use some pre-B-13 assumptions (`.gantt-bar`, the SVG layer, 2 calls per drag). Update them to the current UI first (`.bar-hit`, `wait_plan`, `wrapper.dataset.origin` and `dataset.dayPx`, frozen columns); `check_b13.py` shows the current way to drive and measure the timeline.
2. `flatpak-spawn --host sh -c "cd /home/fahimfarookme/Documents/projects/gemini-earning/apps/planshift && forge lint"`. Record the full output.
3. `forge deploy -e development` only (same `flatpak-spawn --host` pattern). Never another environment. Record the full output.
4. Live check on `https://asymmsystems.atlassian.net`, project DEMO:
   - write only to issues whose summary starts with `[CP-PROBE]` and that carry the label `cp-probe` (create them if needed);
   - delete nothing;
   - record every write (issue key, field, old value, new value, time) in the round log;
   - anything that needs a software (Jira Software) project is marked "not testable on DEMO".
5. Write `docs/marketplace/cascadeplan-listing.md` (plain English, only claims the code supports; the three approved USPs are U1, U2, U3 in `research-brief.md`; drop any claim that B-20 drops).
6. Final report (section 7).

## 7. Final report must contain

- Every changed or new file with its full path and the commit SHA that holds it (or "uncommitted").
- Every live write on DEMO.
- The `forge lint` and `forge deploy` output.
- Test count, coverage per changed file, grader results (with the D-09 note).
- Known limits and deviations (section 5 list, plus anything new).
- Disclosure: commit `a112a09` (B-04) accidentally also committed the folder `docs/sdlc/portfolio-audit-2026-10-31/`. History was not rewritten. Say so plainly.

## 8. How to build, test and check

All Node tools run on the host, because the shell runs in a Flatpak sandbox. Use absolute paths. Do not chain `cd ..` after a command that can fail.

```
APP=/home/fahimfarookme/Documents/projects/gemini-earning/apps/planshift
flatpak-spawn --host sh -c "cd $APP && npm run build"            # tsc + esbuild bundle -> static/frontend/build/app.js
flatpak-spawn --host sh -c "cd $APP && npx jest"                   # all unit tests (533 at handover)
flatpak-spawn --host sh -c "cd $APP && npx jest --coverage"        # per-file coverage
flatpak-spawn --host sh -c "cd $APP && npx jest test/ui/foo --coverage --collectCoverageFrom=src/ui/foo.ts"
sh ~/.cache/gemini-earning-cascadeplan-research/run_graders.sh    # grade_tdd, grade_security, grade_ui
sh ~/.cache/gemini-earning-cascadeplan-research/harness/regress.sh   # rebuilds the site copy, runs every browser check
```

Facts that save time:
- `static/frontend/build/app.js` is committed. Rebuild it (`npm run build:ui`) after any change under `src/frontend/` or `src/ui/` and commit it with the item.
- `node_modules` in `apps/planshift` is a symlink to `ledgerseal/node_modules`. Never modify it, never run `npm install` there. esbuild lives in `apps/planshift/tools/node_modules`.
- Browser checks: Python Playwright with `/opt/google/chrome/chrome`, headless. Never run Python with `-I` for the harness (it breaks the imports). `harness/build_site.py` copies the built UI into `harness/site/` and injects `mock-bridge.js` (a fake Forge bridge with a synthetic plan; URL options such as `n=1000`, `latency=1500`, `theme=dark`, `syncfail=<fn>`, `empty=1`, `none=1`, `nodeps=1`, `derived=1`, `stale=1`, `autocompact=1`) and `instrument.js`.
- `smoke.wait_plan(pg)` waits for the first canvas draw and for the smooth scroll to today to stop. Use it after every `goto`.
- `instrument.js` stores compact columns "off" for every check except when the URL has `autocompact=1`.
- Give each check section its own browser context (`b.new_context(...)`). Mouse state left by one page can break a drag on the next.
- The data columns are frozen. To show a bar, set `wrapper.scrollLeft = days_from(wrapper.dataset.origin) * Number(wrapper.dataset.dayPx) - 60`; do not scroll it to the wrapper's left edge.
- The full `regress.sh` run was once killed by the host (exit 137, memory). If that happens, run the remaining checks one by one: `python3 check_bXX.py > results/check_bXX.out 2>&1`.
- Timing checks (`check_b13`) can fail under high host load. Look at `uptime`; rerun alone before you change code. Report both readings if you rely on a rerun.

## 9. Architecture you must keep

- Canvas timeline: `src/frontend/canvas-timeline.ts`. The canvas is an overlay next to the scroll container (not inside it; inside it caused a scroll loop). It starts at the frozen-column edge. The accessible treegrid lives in the canvas fallback content.
- Time axis: `src/ui/time-scale.ts` (zoom levels, open-ended range). Scroll positions set by code go through `setTimelineScrollLeft` in `legacy-planner.js`, because the top scrollbar mirror otherwise undoes them.
- Undo: every `updateWbsTask`, `unscheduleTask`, `scheduleBacklogTask` and `batchUpdateTasks` call goes through the planner-local `callResolver` wrapper, which records an undo entry when the next plan is shown (`settleUndo`). Use the wrapper for new writes, or the change will not be undoable.
- Every Jira write is reported with old and new values (`jiraSync.writes[].changes`) and shown in the Changes panel. New write paths must report the same way.
- Stored model (spec 3.1): `WorkEffort`, `WorkEffortAssoc` of type `WORK_EFF_PRECEDENCY` with `attrs: { triggerPercent, jiraLinkId }`, `fromDate`, `thruDate`; `WorkEffortPartyAssignment` with `partyId` = account id. Parent dates are derived on load, never stored.
- `getProjectPlan` writes nothing to KVS except the one-time migrations in `migrateIfNeeded` (INV-07). Stale entries are deleted only by `pruneStaleEntries`, after Jira answers 404.
- No browser dialogs (`confirm`, `alert`, `prompt`); a static test enforces it. Use Flags (`src/frontend/flag.ts`) and in-form prompts.

## 10. When you finish or stop

- Leave the tree clean (everything committed) or list exactly what is uncommitted.
- Update the round log.
- Tell the owner in plain, short sentences what is done, what is open, and the one decision you need, if any.
