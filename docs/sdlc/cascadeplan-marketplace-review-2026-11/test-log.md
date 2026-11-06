# CascadePlan review: test log

- Review commit: `db080096007208d2cad97f79c620d49964aa05c9` (master HEAD at start, 2026-11-05 13:11 +0530).
- Checkout: `/home/fahimfarookme/Documents/projects/jira-governance/.tmp/cache/cascadeplan-marketplace-review/checkout` (own clone).
- Shell: VS Code Flatpak sandbox; node, npm, forge and git with GitHub credentials run on the host through `flatpak-spawn --host`. Python Playwright runs in the sandbox with `/opt/google/chrome/chrome`.
- Raw logs: `logs/` in the output folder.

All times are +0530.

## 1. Clone

| # | Command | Result |
|---|---|---|
| 1 | `git clone https://github.com/asymmsystems/jira-governance-code-system.git checkout` (sandbox git) | Failed: no GitHub credential helper in the sandbox. |
| 2 | Same command through `flatpak-spawn --host` | OK. HEAD `db08009 feat(planner): keep one set of task dates across every plan`. |

## 2. Static and unit gate (prompt section 5.1)

| # | Command (in `apps/cascadeplan`) | Result |
|---|---|---|
| 3 | `npm ci` | **Failed, exit 1**: `EUSAGE ... can only install with an existing package-lock.json`. The app folder has no lock file. `logs/npm-ci.log` |
| 4 | `(cd tools && npm ci)` | OK, exit 0 (esbuild 0.25.11). `logs/npm-ci-tools.log` |
| 5 | `npm install --no-audit --no-fund` (deviation: the only way to get dependencies) | OK, 662 packages, exit 0. Created an untracked `package-lock.json` in my checkout only. `logs/npm-install.log` |
| 6 | `npx --no-install tsc --noEmit` | OK, 0 errors, exit 0. `logs/tsc.log` |
| 7 | `npm test -- --coverage` | OK: **57 suites, 726 tests, all passed**, 16.7 s. Coverage: statements 95.81, branches 90.48, functions 90.65, lines 97.45 (thresholds 90 each: met). `src/frontend/**` is excluded from coverage. `src/index.ts` lines 2460-2578 (baseline, scope-shift and utilization resolvers) have no coverage. `logs/jest.log` |
| 8 | `npm run build` | OK, exit 0. `logs/build.log` |
| 9 | `git status --porcelain` and `git diff --stat` after build | `static/frontend/build/app.js` **changed** (276 insertions, 267 deletions). `logs/git-status-after-build.log` |
| 10 | Normalised diff of committed vs rebuilt bundle (`../ledgerseal/node_modules` replaced by `node_modules`) | 14 diff lines remain, all in `tslib` (`__rewriteRelativeImportExtension`). No app code differs. The committed bundle was built against `apps/ledgerseal/node_modules`. `logs/app-bundle.diff` |
| 11 | `git checkout static/frontend/build/app.js` | Restored the committed bundle in my checkout. |

## 3. Review unit tests (prompt section 5.2)

File: `checkout/apps/cascadeplan/test/review/review-findings.test.ts` (copy in `review-tests/`). Not committed.

| # | Command | Result |
|---|---|---|
| 12 | `npx jest test/review --coverage=false` (first run, 30 tests) | 30 passed. |
| 13 | Added R-30 and R-31 (owner item: shorter bar). First R-30 assertion was wrong (a 7-day move of a 3-day bar collapses to one day, not "new start, old end"); corrected the assertion and added a 1-day move case. | 32 passed. |
| 14 | Final run | **32 passed** (`review-tests/review-findings.result.log`). |

A test named "FINDING" passes when the defect is present. "OK" tests prove correct behaviour. "MEASURE" tests print numbers:

- R-27 baseline JSON size at 1,000 tasks: 220,245 bytes (40-char summaries), 260,245 bytes (80), 340,245 bytes (160). KVS value limit is 240 KiB = 245,760 bytes.
- R-28 KVS operations for one move with 200 scheduled tasks: 1 plan = 3 prefix queries (600 rows), 8 gets, 1 swap; 3 plans = 5 queries (1,000 rows), 3 swaps; 10 plans = 12 queries (2,400 rows), 17 gets, 10 swaps. Jira calls: 5 in each case.
- R-29 `batchUpdateTasks` with 50 items, 200 tasks, 1 plan: 151 prefix queries (30,200 rows), 400 gets, 50 swaps, 54 Jira calls.

## 4. Local browser harness (prompt section 5.3)

Harness copied from `~/Documents/projects/jira-governance/.tmp/cache/cascadeplan-bugfix/harness/` to `harness/`. Changes: the two absolute imports in `entry.ts` and `setup.ts` point to my checkout; `setup.ts` got two review switches (`__harness_reject_due` returns the Jira screen error for a due date; `__harness_put_delay_ms` delays issue writes). Added `e2e_review.py` and `e2e_undo_probe.py`.

| # | Command | Result |
|---|---|---|
| 15 | esbuild command from the prompt, run in `harness/` | OK, `site/app.js` 482 KB. |
| 16 | `python3 e2e.py` (30 existing checks) | **30/30 passed.** `harness/results/` |
| 17 | `python3 e2e_review.py` (first run) | 20/24. R2 did not run (bar off screen after reload): harness error, fixed with `scroll_into_view_if_needed`. |
| 18 | `python3 e2e_review.py` (final) | **22/25 expected behaviours held.** Fails: R1c (bar 60.7 px -> 12.1 px after the resolver response), R2a (Undo did not restore), R2b (Redo wrote end 2026-12-04, which the user never chose). `harness/results-review/e2e_review.json` |
| 19 | `python3 e2e_undo_probe.py` | First drag (Jira had no due date): no Undo flag; Ctrl+Z changed nothing (start stayed 2026-11-23). |

Screenshots: `harness/results-review/*.png` (R1a to R8c, probe).

## 5. Live site (prompt section 5.4)

| # | Command | Result |
|---|---|---|
| 20 | `forge whoami` | Logged in as the owner. |
| 21 | `forge deploy -e development --non-interactive` | **Failed** before upload: `Can't resolve '@asymm/jira-ui'` (bundling `src/frontend/admin.tsx`). CLI line: `Deploying PlanShift to development...`. `logs/forge-deploy-dev.log` |
| 22 | Same, with an untracked symlink `node_modules/@asymm/jira-ui` -> `packages/asymm-jira-ui` | **Failed**: `Can't resolve 'react'` / `'@forge/react'` from `packages/asymm-jira-ui/src`. `logs/forge-deploy-dev-2.log` |
| 23 | Same, with an untracked copy of the package in `node_modules/@asymm/jira-ui` | **Failed**: ts-loader will not compile `.ts` in `node_modules`. `logs/forge-deploy-dev-3.log` |
| 24 | Removed the copy. Stopped: the next option needs a `node_modules` folder outside the app, which the prompt forbids. | Nothing was deployed by this review. |
| 25 | `forge deploy list -e development`, `forge environments list`, `forge install list` | Last development deploy 2026-11-05T07:45:48Z (13:15:48 +0530, by the owner, 4 minutes after the db08009 commit). Development installed on asymmsystems.atlassian.net, version 2, up to date. Production environment last deployed 2026-10-29T20:16Z. `logs/forge-state.log` |
| 26 | Playwright session with the cookie set parsed at runtime from the testing guide (values not written anywhere); `bypass_csp` on the test browser only (the app CSP blocks `eval`, which Playwright needs). | Signed in; `/rest/api/3/myself` 200. DEMO is a company-managed Jira Service Management project. |
| 27 | `live/discover3.py` | Planner loads at `/jira/servicedesk/projects/DEMO/apps/<appId>/<devEnvId>`: 13 rows, Main Plan, 1 scenario plan, 22 backlog issues. No Freeze Baseline, Scope Creep, Request Scope Shift or export control. `live/shots/L1-planner-loaded.png` |
| 28 | `live/live_move.py DEMO-29 7 L2` | Before 170 px (2026-10-28 to 11-10). Optimistic render 170 px (11-04 to 11-17). After resolver response **85 px (11-04 to 11-10)**. After reload 170 px (11-04 to 11-17). Changes panel: `DEMO-29 due date 2026-11-10 -> 2026-11-17 Written`. Flag offered Undo. `live/L2-DEMO-29.json`, `live/shots/L2*.png` |
| 29 | `live/live_move.py DEMO-29 -7 L3` (restore) | Optimistic 170 px; after response **255 px (10-28 to 11-17)**; after reload 170 px (10-28 to 11-10). Restored. `live/L3-DEMO-29.json` |
| 30 | `live/changelog.py DEMO-29` | Jira history: 13:38:57 due 2026-11-10 -> 2026-11-17 (this review); 13:40:01 due 2026-11-17 -> 2026-11-10 (this review, restore). Earlier entries 13:17:58 and 13:18:41 are the owner's. |
| 31 | `forge logs -e development --since 30m -n 200` and `-n 50` | No log lines. The backend has no `console` logging (0 calls outside `src/frontend` and `src/ui`). |
| 32 | `live/admin_name.py` | Admin page title "CascadePlan approvers"; page text: "CascadePlan: only Jira administrators and project administrators can freeze delivery baseline, approve milestone variance, and manage plans." `/plugins/servlet/upm` now says app management has moved to Administration. `live/shots/L5-admin-page.png`, `L6-manage-apps.png` |
| 33 | `live/names2.py` | Connected apps: the "Take me there" link did not navigate in the headless run. Developer Console redirected to `id.atlassian.com/login` (the cookie set does not cover it). Both: Not run (needs owner). |

## 6. Other commands

| # | Command | Result |
|---|---|---|
| 34 | Header check over `src` and `test` (excluding `test/review`) | 13 files without "Asymm Systems" and "@author Fahim Farook" (list in the report, finding F-30). |
| 35 | `grep -rlP '[\x{2013}\x{2014}]'` over app src/test, manifest, listing, submission notes, site pages, research folder, spec | No matches. |
| 36 | `grep` for UI callers of `freezePlanBaseline`, `getPlanBaselines`, `getScopeCreepReport`, `requestScopeShift`, `reviewScopeShift`, `getResourceUtilizationGrid`, `checkPlanApprover`, `saveTaskDependency` in `src/frontend` and `index.html` | 0 callers each. |
| 37 | `grep -rn "crypto\|sha256\|createHash\|subtle" src` | 0 matches. |
| 38 | Marketplace research and URL checks | Delegated to a research agent with a written brief; output `marketplace-research.md` (fetched 2026-11-05). |
| 39 | Full read of `src/frontend/*`, `src/ui/*`, `index.html` | Delegated to a reviewer agent with a 16-point checklist; output `frontend-review.md`. I re-checked H1, H5, H6 and the absence of baseline/scope UI against the code myself. |
