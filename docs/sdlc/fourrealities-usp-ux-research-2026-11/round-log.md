# FourRealities research and build: round log

Each entry gives the date, what changed and the evidence. Test IDs (T-xx) are cited in the other three files.

## Round 0: setup (2026-11-01)

- Read in full: the portfolio audit (all sections), `appendix-fourrealities.md`, `docs/spec/fourrealities-spec.md`, `docs/marketplace/fourrealities-listing.md`, every file under `apps/fourrealities/src` and `apps/fourrealities/test`, `manifest.yml`, `package.json`, `jest.config.js`, `tsconfig.json`, `loop-engine/README.md`, `loop-engine/agents/*.md` and `loop-engine/graders/*.py`.
- **T-00, md5 check.** The md5 of all 11 FourRealities source, test and config files equals `snapshot-md5.txt`. So every audit finding (FR-01 to FR-26) still applies to the code. Command: `md5sum` against the audit snapshot.
- Git: the repo is on branch `feature/cascadeplan-research-build`. The working tree has uncommitted changes under `apps/planshift` and four untracked agent files under `loop-engine/agents/`. None are under `apps/fourrealities`. Part A changed nothing under `apps/`.
- Scratch folder: `~/.cache/gemini-earning-fourrealities-research/` (`harness/`, `probes/`, `sources/`).

## Round 1: collect (2026-11-01)

### Observed-test evidence produced in this round

| ID | What | Result | Files |
|---|---|---|---|
| T-01 | Baseline `npx tsc --noEmit -p .` (host node v26.13.0) | Exit 0, no errors, 3.3 s | `probes/tsc-baseline.txt` |
| T-02 | Baseline `npx jest --coverage` (coverage written to the cache, not to `apps/`) | 3 suites, 54 of 54 tests pass, 7.0 s. All files 98.62 / 90.33 / 92.18 / 98.71. `index.ts` 97.67 / 88.46 / 88.09 / 97.9. `metrics-engine.ts` branch 93.46. `metrics-repository.ts` 100. Identical to the audit run. | `probes/jest-baseline.txt`, `probes/cov-baseline/` |
| T-03 | FR-01 render probe. Renders the real `FourRealitiesApp` with `react-test-renderer` 18.3.1. UI Kit components and `@forge/bridge` are mocked. | Project page: React throws "Rendered more hooks than during the previous render." at `src/frontend/index.tsx:585`, raised from `setLoading` in `init` (`:182`). The tree then renders `null`. Issue panel with a failing `getIssueAlignment`: same error, same blank result. The probe asserts the desired behaviour, so it fails today for the right reason. | `probes/fr01-render.test.tsx`, `probes/results/fr01-render.json` |
| T-04 | Resolver harness. Calls `getProjectDashboard` 11 times (11 page views) at 50, 300 and 1,000 issues, and `getIssueAlignment` once. The mocked Jira follows the enhanced `/search/jql` contract that the audit saw live (`startAt` ignored, no `total`). The KVS mock rejects a value above 240 KiB. | See `ux-spec.md` section 3. Short form: at 50 issues the history value passes 240 KiB on view 7 (272,855 bytes). At 300 and 1,000 issues the dashboard reads 200 rows that hold only 100 unique issues (FR-08), and view 2 fails (314,377 bytes). After the first failure every later view fails. KVS reads per view are N + 2, one by one (52 at 50 issues, 202 at 200 rows). Every Jira call runs as the app. | `harness/resolver-perf.test.ts`, `harness/results/resolver-baseline.json` |
| T-05 | Live, read-only (GET calls and one page view) on `asymmsystems.atlassian.net` | The DEMO project page still shows only its title. The app iframe is hidden with height 0 after 20 s. DEMO-26 still carries `ledgerseal-cert` `{status: SEAL_VALID, valid: true, sealedAt, isCompromised: false}` and `definitionguard-dod` `{isFullySatisfied: true, satisfied: true, completedAt}`, and no `fourrealities-exception`. 17 of the 34 issues in DEMO and TEST carry `ledgerseal-cert` or `definitionguard-dod`. **New:** the site now has a third project, AUDT ("Audit Test Software"), a classic Jira Software project with Scrum board 4 and 0 issues. | `probes/live-demo-project-page-2026-11-01.jpg` |

### Side effects of Part A on the live site

- The DEMO project page view ran `getProjectDashboard`. That resolver writes `fr:project:DEMO:latest` and `fr:project:DEMO:history` in FourRealities app storage on every view (Observed-code `src/index.ts:339`). This is app storage, not Jira. The effect is Inferred, because the audit cannot read app storage.
- No Jira write. No issue panel was opened, so no LedgerSeal panel ran (LS-06).

### Collect: web sources

Four research agents ran in parallel with WebSearch and WebFetch only (GET, no sign-up, no login, no posting, no email sent). Their source files are in `~/.cache/gemini-earning-fourrealities-research/sources/`:

| File | IDs | Rows |
|---|---|---|
| `native-atlassian.md` | NA-01 to NA-35 | 35 |
| `dod-and-audit-apps.md` | DD-01 to DD-29, AU-01 to AU-34 | 63 |
| `traceability-and-metrics.md` | TR-01 to TR-14, EM-01 to EM-22, EX-01 to EX-17 | 53 |
| `metrics-buyers-pricing.md` | CM-01 to CM-12, BY-01 to BY-10, PR-01 to PR-16, EV-01 to EV-11 | 49 |

Forge limits FL-01 to FL-03 are reused from the CascadePlan research of the same day (its RS-18, RS-19, RS-21).

Limits: G2, Capterra and TrustRadius returned HTTP 403. Atlassian Community pages returned titles only. No source gave click or keystroke counts. Six sources failed (ACM, PCAOB, NIST CPRT, OECD/JRC, trustnetinc); substitutes are named in the metrics source file.

### Synthesise

- Hypothesis verdicts H1 to H9, plus new H10 and H11: `research-brief.md` section 3.
- USP table U1 to U9: `research-brief.md` section 4.1. Before refute, U1 and U3 passed with conditions.
- UX benchmark and target interactions: `ux-spec.md` sections 1 and 2.

### Refute

| Candidate | Search | Result |
|---|---|---|
| U1 | Per-item requirement, PR and approval evidence products (RF-01, RF-02) | Partly refuted: Ketryx (291 installs) does this for FDA-regulated teams, as an external platform. Gap narrowed; verdict kept. |
| U3 | Native 2026 JQL for Confluence-linked issues; Marketplace JQL apps (RF-04 to RF-06) | Refuted: JQL Search Extensions (3,842 installs) and ScriptRunner already answer the query. Verdict changed to Fail. |
| U4 | Teamwork Graph GA date (RF-03) | Still Early Access, test sites only. Feasibility failure confirmed. |

## Round 2: revise (2026-11-01)

- U3 changed from conditional pass to Fail (Gap). H2 stays Partly true: the need for remote-link search is stated, but Marketplace apps meet it.
- U1 kept as the only conditional pass, with a narrower gap statement (general software teams, no egress).
- Items still Unknown after round 2: H6, H9 demand, H2 for decision records, all competitor click counts.

## Round 3: Unknown items only (2026-11-01)

- One extended search for buyer demand for one per-issue evidence view, or for linked Confluence evidence before closing.
- Result: no direct request. One indirect signal: a review dated 2026-10-28 keeps "Pull request merged, with at least one approving review" as a hand-ticked DoD item (RF-07). This supports U1 condition 2 as "Partly" and changes no verdict.
- No verdict changed in round 3, so the research loop stops. H6 and H9 demand stay Unknown.

## Outputs of Part A (2026-11-01, uncommitted)

- `docs/sdlc/fourrealities-usp-ux-research-2026-11/research-brief.md`
- `docs/sdlc/fourrealities-usp-ux-research-2026-11/ux-spec.md`
- `docs/sdlc/fourrealities-usp-ux-research-2026-11/backlog.md`
- `docs/sdlc/fourrealities-usp-ux-research-2026-11/round-log.md`

## Part B setup (2026-11-01)

- Owner approval in chat: "APPROVED now all". Recorded as line 1 of `backlog.md`: B-01..B-28, flags approved. B-26 to B-28 are BLOCKED (sibling apps not signing; Teamwork Graph not GA).
- Section 9 check: `apps/fourrealities` had no uncommitted changes. Other sessions had uncommitted work in `apps/planshift` and research folders, so Part B runs in a separate git worktree, `/home/fahimfarookme/Documents/projects/gemini-earning-fr-build`, on branch `feature/fourrealities-research-build` from `master` (`5097bf5`). The worktree `node_modules` is a symbolic link to the same shared `apps/ledgerseal/node_modules`.
- Baseline in the worktree: `tsc --noEmit` exit 0; jest 54 of 54 pass, coverage identical to T-02. No B-00 needed.
- Commits: `17488c6` (Part A outputs), `a19d959` (spec v2). `grade_spec.py` passes on a mirror that holds spec v2 under the v1 name (`~/.cache/gemini-earning-fourrealities-research/grader-mirror/`); conflict recorded in spec v2.

### Coverage deviation (applies from B-01 until B-22)

Section 11.2 asks for 90% branch coverage on each changed file. Before B-22 splits the 1,093-line UI into tested modules, `src/frontend/index.tsx` cannot reach 90% without tests for code that later items delete. From B-01, `jest.config.js` collects frontend coverage with per-path thresholds: domain and storage 90% per file, `src/index.ts` at its measured floor (88% branches and functions), frontend at its measured floor. Each item records its frontend figure here. `grade_tdd.py` reads the global total, so it fails until B-22 for this reason only.

## Build items

| Item | Date | Tests added | Result | Coverage (branch) | Graders | Commit |
|---|---|---|---|---|---|---|
Build order (deviation from backlog order, recorded 2026-11-01): B-03, B-05, B-07 on the current code; then B-16 (new domain model and a modular UI), because B-04, B-06, B-10, B-14 and B-15 change the data the whole UI consumes; then B-04, B-06, B-10, B-15, B-14; then B-09, B-08, B-13; then B-11, B-17 to B-21, B-22; then B-23 to B-25; B-12 in Loop 3.

| B-01 | 2026-11-01 | `test/frontend/app.test.tsx`: loading then loaded with no hook error; issue panel error view; refresh. All 3 failed first with "Rendered more hooks than during the previous render." | tsc 0; jest 57 of 57 | `index.tsx` 26.51; `index.ts` 88.46; domain 93.46; storage 100 | tdd FAIL (global 64.73, deviation above); security PASS; ui PASS | `419c53c` |
| B-02 | 2026-11-01 | `test/index.test.ts`: no `sealIssue` or `completeDod` resolver; source scan finds no write path to `ledgerseal-cert` or `definitionguard-dod`; issue panel with failing secondary calls. `test/frontend/app.test.tsx`: no seal or DoD action, both producer links call `router.open('/browse/DEMO-1')`. New tests failed first (3 of 3). Removed: the seal and DoD tests that asserted the forged writes and the asApp fallback. | tsc 0; jest 59 of 59 | `index.tsx` 38.88 (floor raised); `index.ts` 88.54 | tdd FAIL (global, deviation); security PASS; ui PASS | `40cbed3` |
| B-03 | 2026-11-01 | `test/index.test.ts`: no `recordIssueSignals` resolver; a failed Jira read rejects with "Jira returned HTTP 404" even when stored signals exist; a successful read writes no `:signals` key. `test/storage`: the v1 signals key can be deleted. Failed first: 4 of 4. Removed: the tests that asserted the forged-signal resolver and the stored fallback. | tsc 0; jest 56 of 56 | `index.ts` 88.66; `index.tsx` 38.88 | tdd FAIL (global, deviation); security PASS; ui PASS | `3489faf` |
| B-05 | 2026-11-01 | `test/index.test.ts`: separate recording mocks for `asApp` and `asUser`; `linkDecision` 403 returns the permission message and never calls `asApp`; `recordException` on 403, on a rejected request and on HTTP 500 returns an error and stores no KVS record; on 2xx it PUTs as the user, then stores. The `route` mock now interpolates values, so paths can be asserted. Failed first: 5 of 5. Removed: the test that asserted the asApp fallback. | tsc 0; jest 61 of 61 | `index.ts` 88.2; `index.tsx` 38.88 | tdd FAIL (global, deviation); security PASS; ui PASS | see next line |
