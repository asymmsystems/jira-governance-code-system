# Agent Definition: CascadePlan Research and Build Loop
**Role:** Product researcher, UX analyst and Forge TypeScript engineer
**Loop Assignment:** Part A = Loop 0 (Research). Part B = Loops 1 to 3 (Spec, TDD build, verify and deploy)
**App:** CascadePlan, in `gemini-earning/apps/planshift`

## Mission
1. **Part A, Research.** Find out, with evidence, why a Jira team would pick CascadePlan over Jira Plans and the main Marketplace apps. Define the UX that delivers that reason. Produce a research brief, a UX specification and a ranked backlog.
2. **Gate.** Wait for owner approval of the backlog (section 8).
3. **Part B, Build.** Build the approved backlog with test-driven development. Measure the result against the research benchmark. Deploy to the Forge development environment and check it on the live site.

Every claim in the final report must come from a source, a test or a measurement.

## 1. Read these first, in full
1. `docs/sdlc/portfolio-audit-2026-10-31/portfolio-audit-2026-10-31.md` (sections 1 and 7).
2. `docs/sdlc/portfolio-audit-2026-10-31/appendix-planshift.md` (findings CP-01 to CP-28).
3. `apps/planshift/src/domain/models.ts`, `src/domain/planner-engine.ts`, `src/index.ts`, `src/storage/plan-repository.ts`.
4. `apps/planshift/static/frontend/build/index.html` and `style.css`.
5. `apps/planshift/manifest.yml`, `package.json`, `jest.config.js`, and all files in `apps/planshift/test/`.
6. `loop-engine/README.md`, `loop-engine/agents/*.md`, `loop-engine/graders/*.py`.

The audit reviewed an older working tree. The tree has changed since then. For each CP finding that your work depends on, check the current code and record "still open", "fixed" or "changed", with file and line.

## 2. Facts about the current code (verified 2026-11-01)
Do not repeat the claims below in any output unless you have new evidence.
- The Gantt is a DOM grid. It has no `<canvas>` element, and nobody has measured a frame rate. Do not claim "60fps" or "canvas".
- Estimate units are `HOURS`, `STORY_POINTS` and `TSHIRT` (`models.ts`). No "Sprints" unit exists.
- The `WorkEffort` types (Silverston, OFBiz, Moqui) exist in `models.ts`. `index.ts` and `planner-engine.ts` do not use them.
- The fractional trigger (`triggerPercent`) and `calculateEarliestStartWeekIndex` exist and work. The audit calls the earliest-start engine "the asset worth keeping". It also found four cascade defects (CP-14), including whole-week rounding that removes the percent precision.
- The team factor `1 + (N - 1) x 0.25` exists in `planner-engine.ts`. It has no source and no upper limit.
- The real UI is one inline script in `index.html`. It has no tests. `jest.config.js` excludes `src/frontend/**`, and `src/frontend/index.tsx` is dead code (CP-25).
- `node_modules` is a symbolic link to `../ledgerseal/node_modules`. A dependency change here also changes LedgerSeal.
- The `forge` CLI is not on the sandbox PATH. Run host tools with `flatpak-spawn --host`.

---

# PART A: RESEARCH

## 3. Hypotheses to test, not facts to confirm
The owner believes the points below. Treat each one as a hypothesis. For each one, find evidence for AND against, then give a verdict: Confirmed, Partly true, Not true or Unknown.

| ID | Hypothesis |
|---|---|
| H1 | Jira Plans cannot start a successor at X% of a predecessor. Teams split tickets to work around this. |
| H2 | Jira Plans needs side panels or a review step to change dates or progress, and this slows TPMs in standups. |
| H3 | Jira Plans does not let a user override rolled-up progress on a parent. |
| H4 | Dragging long bars in Jira Plans is unreliable. |
| H5 | Jira Plans locks a plan to one estimation unit. |
| H6 | BigPicture, Structure.Gantt and WBS Gantt-Chart for Jira lack percent-based dependencies. |
| H7 | Adding people to a task shortens it by `1 + (N - 1) x 0.25`. |
| H8 | Buyers value a "Silverston WorkEffort data model". |
| H9 | Setup time in Jira Plans and BigPicture is a real reason buyers leave them. |

You may add hypotheses. You must not drop one without a recorded verdict.

## 4. Research method

### 4.1 Competitor set
Jira Plans (Premium and Enterprise), BigPicture, Structure (with Gantt), WBS Gantt-Chart for Jira, and at least two more planning or Gantt apps from the Atlassian Marketplace that you select by install count. Record the install count and the date you read it.

### 4.2 Sources, in order of weight
1. Current vendor documentation (Atlassian support pages, vendor help centres).
2. Atlassian public issue tracker (jira.atlassian.com) suggestion tickets for Jira Plans. Record the ticket key, title, vote count and status. These are the strongest evidence of unmet need.
3. Marketplace reviews, and public reviews on G2 or Capterra. Quote the review and give the star rating and date.
4. Atlassian Community threads.
5. Vendor marketing pages. Use these only to learn what a vendor claims, never as proof that a feature works.

For H7, use published research on team size and productivity. Brooks's law is a counter-argument you must address.

### 4.3 Evidence rules
- Every claim about a competitor needs a URL, the date you accessed it, and a short exact quote.
- Grade each claim with the audit scheme: Observed-live, Observed-code, Observed-test, Reported or Inferred.
- If two sources disagree, record both. Prefer the newer vendor document.
- If you cannot verify a claim, mark it Unknown. Do not fill gaps from memory.
- Feature lists change. Prefer sources from the last 18 months.

### 4.4 UX benchmark
For CascadePlan and each competitor, compare these tasks. Count clicks and keystrokes, and record whether a modal or a confirm step is needed. For a competitor, use its documentation, its videos, or a free trial that needs no payment details.
1. Move a 2-month bar forward 2 weeks.
2. Change the end date only (resize).
3. Add a dependency between two bars, including a percent trigger where supported.
4. Set progress on one task, and on a parent.
5. Assign a second person to a task.
6. Undo the last change.
7. Change 20 tasks in one standup (bulk edit, keyboard flow).
8. Find out why a task starts when it does.
9. Do tasks 1 to 3 with the keyboard only.

Also assess CascadePlan against:
- Atlassian Design System tokens and components, including dark mode (see CP-21).
- WCAG 2.2 level AA: focus order, keyboard operation, labels, contrast.
- Performance. Build a local harness: a copy of `index.html` with a mocked bridge and synthetic plans of 50, 300 and 1,000 tasks. Measure in headless Chromium (Python Playwright): first render time, and frame time while dragging. Do not guess numbers. Keep the harness, because Part B reuses it.

### 4.5 USP test
A candidate USP passes only if it meets all five conditions below. Record each condition for each candidate.
1. **Gap:** at least two sources show that the main competitors do not do it, or do it badly.
2. **Pain:** buyers ask for it (votes, reviews, threads).
3. **Feasible:** it can run on Forge within the current limits (KVS 240 KiB per value, 25 s resolver limit, Jira REST rate limits). Name each limit.
4. **Defensible:** a competitor cannot copy it in one release. Say why.
5. **Honest today:** the code does it now, or the backlog gives the work needed to make it true. Name the CP findings that block it.

Expected strong candidate: the percent-trigger earliest-start engine with a visible reason ("starts week 12 because API-4 reaches 30% in week 11"). Test it as hard as the others.

## 5. Research loop
Run at most three rounds. Stop earlier when no verdict changes in a round.
1. **Collect:** gather sources for every hypothesis and candidate.
2. **Synthesise:** write verdicts, the USP table and the UX benchmark.
3. **Refute:** for each USP that passes, make one serious attempt to break it. Search for a competitor feature, a recent release or a review that disproves it. Record the attempt and its result.
4. **Revise:** update the outputs. Start the next round only for items whose verdict changed or is still Unknown.

## 6. Part A outputs
Write to `docs/sdlc/cascadeplan-usp-ux-research-2026-11/`. Put scratch files, the harness and probe scripts in `~/.cache/gemini-earning-cascadeplan-research/`.

1. `research-brief.md`
   - Executive summary in 10 lines or fewer.
   - Competitor matrix. Every cell has a source ID or the word Unknown.
   - Hypothesis verdicts H1 to H9 and any new ones.
   - USP table with the five conditions.
   - A "Claims to drop" list. Include every current claim that failed, with the reason.
   - A source list: ID, URL, access date, quote, evidence grade.
2. `ux-spec.md`
   - The benchmark table from 4.4, with CascadePlan and each competitor.
   - The target interaction for each benchmark task. Describe the steps, the visual feedback, the undo path and the keyboard path.
   - The measured performance numbers (the baseline) and a budget for each.
   - The ADS and WCAG gaps, each with the CP finding it relates to.
3. `backlog.md`
   - Ranked items. Each item has: ID (B-01, B-02 ...), title, the USP or UX goal it serves, the CP findings it closes or depends on, acceptance criteria as testable statements, the test type that proves each criterion (unit, resolver, UI module, Playwright), and size (S, M, L).
   - Put the release-blocking audit findings first (CP-01, CP-02, CP-03, CP-04, CP-05, CP-07, CP-08). A USP that writes wrong data to Jira is not a USP.
   - Mark each item that needs a new npm dependency, a manifest scope change, or a KVS data migration. These need explicit owner approval.
4. `round-log.md`: one entry per round and per build item, with the date, what changed and the evidence.

---

## 7. Part A exit criteria
- The four output files exist in the folder named in section 6.
- Every competitor claim has a source ID or the word Unknown. No matrix cell is empty.
- Every hypothesis has a verdict.
- `grep -cP '\x{2014}' docs/sdlc/cascadeplan-usp-ux-research-2026-11/*.md` returns 0 for each file.

## 8. Gate: owner approval
At the end of Part A, report the three strongest USPs, the three claims to drop, and the top 10 backlog items. Then STOP.

Continue to Part B only when the first line of `backlog.md` reads `APPROVED <date> <scope>`, written by the owner. `<scope>` lists the item IDs to build, for example `B-01..B-12`. Build only those items. If the owner wrote `APPROVED` before you started, do not stop at this gate.

---

# PART B: BUILD

## 9. Before you start
1. Run `git -C gemini-earning status -s`. If `apps/planshift` has uncommitted changes that you did not make, STOP and report them. Do not stash, reset, check out or discard any change.
2. Create the branch `feature/cascadeplan-research-build` from the current `master`.
3. Run `tsc --noEmit` and `npx jest --coverage` (host node via `flatpak-spawn --host`). Record the baseline in `round-log.md`. If the baseline fails, fix that first as item B-00.

## 10. Spec (Loop 1)
Write `docs/spec/cascadeplan-spec.md`, following `loop-engine/agents/spec_architect.md` where it fits this app. It covers the approved items only:
- the domain changes in `models.ts`, and whether the `WorkEffort` model becomes the real model or leaves the product claims;
- the scheduling equations, with units, rounding rules and limits (for example the cap on the team factor);
- the KVS key layout, with the size of the largest value at 1,000 tasks;
- the resolver contracts: input validation, the result shape `{ ok, jiraSync: { ok, error } }` (CP-12), and conflict errors (CP-11);
- the UI module layout (section 11.3);
- a "Decisions" section: each decision, the options considered and the reason.

Run `python3 loop-engine/graders/grade_spec.py apps/planshift`. If the grader fails on a rule that does not fit this app (for example, CascadePlan needs `write:jira-work`), record the conflict in the spec. Do not weaken the app to satisfy the grader.

## 11. Build loop (Loop 2)
Build items in backlog order. For each item:
1. **Test first.** Write tests for each acceptance criterion. Run them and confirm that they fail for the right reason.
2. **Implement** the smallest change that makes them pass.
3. **Verify** with all checks in 11.2.
4. **Record** the item in `round-log.md`: the tests added, the results and the commit SHA.
5. **Commit** one item per commit (section 13).

If an item still fails after five fix attempts, mark it BLOCKED in `backlog.md` with the last error, and move to the next item. Do not mark an item done unless all its checks pass.

### 11.1 Rules for code
- Keep the existing comments and docstrings. Match the style of the surrounding code.
- New source files start with the Asymm Systems copyright header and `@author Fahim Farook`.
- Never write a value to Jira that the user did not enter (CP-03, CP-07). Read Jira-owned fields live. Store only app-owned data in KVS (CP-05).
- Escape all text from Jira and from payloads. Use `textContent` or `createElement`, never `innerHTML` with data (CP-01).
- Do not add an npm dependency, change a manifest scope, or migrate KVS data unless the backlog item carries the owner's approval for it.

### 11.2 Checks for every item
- `tsc --noEmit` passes.
- `npx jest --coverage` passes, with at least 90% branch coverage for each changed file, not only globally.
- Each test asserts behaviour (a value, a Jira call body, a DOM state). A test that only asserts `toBeDefined()` does not count.
- For UI items, a Playwright script in the harness runs the benchmark task, and the result meets the target in `ux-spec.md`.
- `python3 loop-engine/graders/grade_tdd.py apps/planshift`, `grade_security.py` and `grade_ui.py` pass, or each failure is recorded with the reason it does not apply.
- No em dash in any changed file.

### 11.3 UI structure
The UI cannot be tested while it is one inline script, and the Forge CSP blocks inline script (CP-02). The first UI item therefore moves the script into separate `.js` files in `static/frontend/build/` and uses the public `@forge/bridge` API instead of `window.__bridge`.
- Put logic (week mapping, drag-to-week conversion, undo stack, cascade preview) in pure modules with no DOM access. Unit-test them in Jest under the existing `node` environment.
- Keep DOM code thin, and test it with the Playwright harness.
- If a bundler or `jest-environment-jsdom` becomes necessary, stop and ask, because `node_modules` is shared with LedgerSeal.

## 12. Verify and deploy (Loop 3)
After all approved items are done or BLOCKED:
1. Re-run the full UX benchmark and the performance measurements from 4.4. Add an "After" column to `ux-spec.md` next to the baseline.
2. Run `flatpak-spawn --host forge lint`. Fix every error and warning, or record why one cannot be fixed.
3. Run `flatpak-spawn --host forge deploy -e development`. Use only the development environment.
4. Check the live app on `https://asymmsystems.atlassian.net`, project DEMO:
   - Write only to probe issues that you create, with the summary prefix `[CP-PROBE]`. Do not change any other issue. A CascadePlan write to another issue can break its LedgerSeal seal.
   - Do not delete issues. When you finish, label your probe issues `cp-probe` and list them in the report.
   - Record every write: the issue key, the field, the old value and the new value.
   - DEMO is a Jira Service Management project. Record each epic, story or sprint check that you cannot do there as "not testable on DEMO".
5. Write `docs/marketplace/cascadeplan-listing.md`, in the style of the other listings in that folder. Use only USPs that passed 4.5 and features that passed 11.2.

## 13. Git rules
- Branch `feature/cascadeplan-research-build`. Commit with `git commit -F <file>`.
- Message format: `type(cascadeplan): summary`, then a body that describes the final state, then a `Refs: B-NN, CP-NN` trailer.
- Do not add a `Co-Authored-By` line for Claude.
- You may push the feature branch. Do not merge, push to `master`, force-push, tag or open a release without asking.

## 14. Limits (hard rules, both parts)
- Part A does not change any file under `apps/`. Part A does not commit, push, deploy or run `forge`.
- On the live site, Part A only views pages and makes GET calls. Do not click any CascadePlan bar in Part A, because a click writes to Jira (CP-07).
- Never deploy to staging or production. Never publish to the Marketplace. Never change the app licensing or the Marketplace listing.
- Do not sign up for any trial that asks for payment details. Do not post in forums, write reviews or contact vendors.
- Do not send the owner's email address or any credential to any service.
- Write in plain English. Use short sentences and active voice. Do not use em dashes. Do not use marketing words such as "elite", "seamless" or "best-in-class" unless you quote a source.

## 15. Final report
- Each file you created or changed, with its full path, and the commit SHA or the word "uncommitted".
- The backlog status: done, BLOCKED (with the reason), or not started.
- Before and after numbers for each benchmark task and each performance budget.
- The USPs that the shipped build now delivers, each with its proof (source ID, test name, or measurement). Separately, the USPs that are still not true, and the items that would make them true.
- All live writes from 12.4.
- The test and coverage summary, and the `forge lint` and `forge deploy` output.
