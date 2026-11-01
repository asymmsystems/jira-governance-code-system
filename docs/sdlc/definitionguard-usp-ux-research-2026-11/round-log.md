# DefinitionGuard research and build: round log

One entry per research round and per build item. Dates are local (UTC+5:30).

## Round 0: setup (2026-11-01)

- **Repo state.** Branch `feature/cascadeplan-research-build`, HEAD `b094ed8`. `git status -s` shows uncommitted changes only under `apps/planshift` and new untracked files in `loop-engine/agents/`. `apps/definitionguard` has no uncommitted change. Part A made no change under `apps/`.
- **md5 check.** All 17 files in appendix section 1.1 that sit under `apps/definitionguard` (manifest, package, tsconfig, jest config, README, 7 source files, 5 test files) match the appendix. Every DG finding is still open at its audit line.
- **Read in full:** the DefinitionGuard appendix; the portfolio audit (all sections, including 1, 2.2, 3.1, 4.4, 5, 5.2, 5.5, 6, 7); the spec; the listing; the README; all 7 source files; `manifest.yml`, `package.json`, `jest.config.js`, `tsconfig.json`; `test/index.test.ts` (mocks and test list) and the 4 other test files by test names; `loop-engine/README.md`; `spec_architect.md`, `tdd_engineer.md`, `adversary_grader.md`; all 5 graders; the audit probe script `~/.cache/gemini-earning-portfolio-audit/definitionguard-scratch/probe.js`.
- **Scratch location:** `~/.cache/gemini-earning-definitionguard-research/` (`sources/`, `harness/`, `merge_sources.py`, `merged-sources.md`, `brief-body.md`).
- **Tools:** host node v26.13.0, Jest 29.7.0 and tsc 5.9.3 through `flatpak-spawn --host`. The browser was the owner's logged-in Chrome session, used for REST GET only.

## Round 1: collect and synthesise (2026-11-01)

### Collect
- Two research subagents ran in parallel, with WebSearch and WebFetch only. They used no sign-up, no credentials and no email address.
  - Marketplace checklist apps: sources M-01 to M-142 in `sources/marketplace-competitors.md`. Install counts and prices come from the Marketplace REST API v2.
  - Native Jira, JMWE, ScriptRunner, suggestion tickets, audit frameworks and Forge limits: sources N-01 to N-64 in `sources/native-forge-audit.md`. N-50 was reserved and is unused.
- Blocked sources: G2 returned HTTP 403, and no Capterra listing was found. The AICPA TSC PDF needs registration and was excluded (N-60); a secondary source was used (N-57). The ISO/IEC 27001 text was not available (N-58, N-59).

### Observed-test and Observed-live evidence produced in this round
| ID | What | Result | Where |
|---|---|---|---|
| T-01 to T-13 | Jest harness on the app source in place, mocked `asApp()` and `asUser()` apart | 16 of 16 tests pass. Sizes, calls and validator behaviour are in `ux-spec.md` section 3 and `research-brief.md` section 7 | `harness/scale.harness.ts`, `harness/results/baseline.json` |
| Harness fix | The first run measured the 240 KiB crossing only after 1,000 toggles and reported 1,001 | Corrected to check after every toggle. Result for 6 items: 817 (audit probe 16 gave 814) | same |
| L-01 to L-06 | Live REST GET on workflows, projects and two issue properties | No workflow has the DefinitionGuard validator. A third project, AUDT, exists. Forged property on DEMO-26 still present. 8 DONE-category transitions on DEMO | `sources/live-observations.md` |

No live write was made. No DefinitionGuard or LedgerSeal panel was opened.

### Synthesise
- Verdicts H1 to H9 and H10 to H13: `research-brief.md` section 3.
- USP table U1 to U4: `research-brief.md` section 4.
- Benchmark, targets and budgets: `ux-spec.md`.
- Backlog B-01 to B-20: `backlog.md`.

## Round 2: refute and revise (2026-11-01)

- **Refute searches:** required evidence on checklist items; separation of duties in checklist and approval apps; DoD sign-off apps with audit export.
- **Found:**
  - Approval and sign-off apps that claim transition-level separation of duties and SOC 2 export, all with 1 to 302 installs (R-01, R-02, R-04).
  - A Forge "Definition of Done & Ready" app with 4 installs that blocks transitions (R-03).
  - Library code: KVS conditional writes exist only for Custom Entities (R-05), which corrects the "no compare-and-set" inference in N-14. UI Kit exports `User` (R-06).
- **Verdict changes:**
  - U2 Pain moved from Met to Partly. U2 Gap stands for item-level control.
  - H7 moved to Partly true, because approval apps cover part of the need.
  - No other verdict changed.
- **Stop:** round 3 was not run. The open items (H12 team-managed, H13 validator throw) need a live test, not more search. Brief section 5 allows stopping when no further verdict can change by research.

## Exit check (Part A, section 7 of the brief)

- The four files exist: `research-brief.md`, `ux-spec.md`, `backlog.md`, `round-log.md`.
- Every competitor matrix cell has a source ID, an Observed-code or Observed-live reference, or the word Unknown.
- H1 to H13 each have a verdict.
- `grep -cP '\x{2014}'` returns 0 for each of the four files (2026-11-01). A script check of the matrix found 19 rows and 0 empty cells. `git status -s apps/definitionguard` is empty.

## Build items

None. Part B waits for `APPROVED <date> <scope>` on the first line of `backlog.md`.
