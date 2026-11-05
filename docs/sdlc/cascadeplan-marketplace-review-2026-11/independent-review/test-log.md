# CascadePlan fix plan review: test log

- Reviewer: independent review session, 2026-11-05 (started 15:29 +0530).
- Document under review: `/home/fahimfarookme/.cache/gemini-earning-cascadeplan-marketplace-review/fix-plan.md`.
- Code: `asymmsystems/jira-governance-code-system`, commit `db080096007208d2cad97f79c620d49964aa05c9`, folder `apps/cascadeplan`.
- Output folder: `/home/fahimfarookme/.cache/gemini-earning-cascadeplan-fixplan-review/` (called OUT below).
- Raw logs: `OUT/logs/`.
- Shell: VS Code Flatpak sandbox. node 26.13.0, npm 11.20.0 and forge 15.0.0 run on the host through `flatpak-spawn --host`.
- Nothing was committed, pushed or deployed. No file in `/home/fahimfarookme/.cache/gemini-earning-cascadeplan-marketplace-review/` was changed.

## 1. Checkout

| # | Command | Result |
|---|---|---|
| 1 | `ls OUT` | OUT already held a folder `checkout`, created at 15:07 by another session (`apps/cascadeplan/package.json` modified, untracked `package-lock.json` and `test/review/`). I did not touch it, because I did not create it. |
| 2 | `git clone https://github.com/asymmsystems/jira-governance-code-system.git OUT/checkout-claude` | Failed: no GitHub credential helper in the sandbox (`/usr/bin/gh: No such file`). |
| 3 | `git clone --no-checkout /home/fahimfarookme/Documents/projects/gemini-earning OUT/checkout-claude` then `git checkout db080096007208d2cad97f79c620d49964aa05c9` | OK. HEAD `db08009 feat(planner): keep one set of task dates across every plan`. The local repository was the `origin` of the other checkout. My clone is `OUT/checkout-claude` (a sibling of `OUT/checkout`, not the path in the brief, for the reason in row 1). |

## 2. Static and unit gate (in `OUT/checkout-claude/apps/cascadeplan`)

| # | Command | Result |
|---|---|---|
| 4 | `npm ci` | Failed, exit 1: no `package-lock.json` (same as the first review). `logs/npm-ci.log` |
| 5 | `npm install --no-audit --no-fund` | OK, exit 0. `logs/npm-install.log` |
| 6 | `(cd tools && npm ci --no-audit --no-fund)` | OK, exit 0. `logs/npm-ci-tools.log` |
| 7 | `npx --no-install tsc --noEmit` | OK, 0 errors. `logs/tsc.log` |
| 8 | `npx jest --coverage=false` | OK: 57 suites, 726 tests passed. `logs/jest.log` |
| 9 | Copied `review-tests/review-findings.test.ts` to `test/review/`; `npx jest test/review --coverage=false` | OK: 32 passed (the first review's result reproduced). `logs/jest-review.log` |

## 3. My tests (`test/fixplan-review/fixplan-gaps.test.ts`, copy in `OUT/tests/`)

| # | Command | Result |
|---|---|---|
| 10 | `npx jest test/fixplan-review --coverage=false` (first run, 5 tests) | 5 passed. |
| 11 | Added the control CONTROL FX-01b, then reran | 6 passed. `logs/jest-fixplan-review.log` |

What each test shows (a "GAP" test passes while the code has the behaviour):

- GAP FX-01: in `batchUpdateTasks` (`src/index.ts:1865-1901`), item 2 is computed from the Jira read taken before item 1 wrote. A multi-select move of A and B (A -> B -> C) stores and writes a one-day bar for C with due date start+13 instead of start+13 to start+16. The wrong length survives a reload.
- CONTROL FX-01b: the same two moves as two separate `updateWbsTask` calls give the correct C (start+13 to start+16, Jira due start+16). This proves the cause is the shared stale read.
- GAP FX-02: removing a dependency deletes the owned Jira link (`src/index.ts:1624`) before `putEntry` (`:1808`). On a conflict, `jiraSync.writes` is empty.
- GAP FX-03: the contributor "unassign" PUT (`src/index.ts:1691`) runs before `putEntry`. On a conflict, `jiraSync.writes` is empty.
- GAP FX-04: `handler` called for `getProjectPlan` with no project in the context (admin page) migrates the legacy key `scheduleMap:TEST` into `cp:TEST:we:` (project key) and deletes the legacy key. A later project-page call (project id `10001`) finds no record, and the task is in the backlog.
- GAP FX-05: a legacy entry whose issue the migrating user's search does not return is stored under `cp:TEST:we:TEST-9` with `issueId: 'TEST-9'`, not under a numeric issue id.

## 4. BL-8 recipe trial (npm only, no deploy, in my clone only)

| # | Command | Result |
|---|---|---|
| 12 | `npx --no-install tsc -p test/fixplan-review/bl8/tsconfig.jira-ui.json` (compiles `packages/asymm-jira-ui/src` with the app's own TypeScript and types; no `node_modules` created outside the app) | OK. `packages/asymm-jira-ui/dist/` has `index.js`, `admin.js`, `brand.js`, `layout.js` and `.d.ts` files. |
| 13 | Set `main` and `types` of `packages/asymm-jira-ui/package.json` to `dist/`. Added `"@asymm/jira-ui": "file:../../packages/asymm-jira-ui"` to the app `package.json`. Wrote `apps/cascadeplan/.npmrc` with `install-links=true`. `npm install` | OK, exit 0. `node_modules/@asymm/jira-ui` is a copy (not a symlink) with `dist/`, and has no nested `node_modules`. Lock entry `"resolved": "file:../../packages/asymm-jira-ui"`, no `integrity`. `logs/bl8-npm-install.log`. Diff of these edits: `OUT/tests/bl8/recipe.diff`. |
| 14 | `node -e "require.resolve('react')"` and `'@forge/react'` from `node_modules/@asymm/jira-ui/dist`; `require.resolve('@asymm/jira-ui')` from the app | All resolve to the app's own `node_modules` (one copy of `react` 18.3.1 and `@forge/react` 12.4.0). |
| 15 | `npx --no-install tsc -p test/fixplan-review/bl8/tsconfig.app-nopaths.json` (app tsconfig with the `@asymm/jira-ui` paths removed) | OK, 0 errors. `logs/bl8-tsc-nopaths.log` |
| 16 | `tools/node_modules/.bin/esbuild src/frontend/admin.tsx --bundle --format=cjs --platform=browser --jsx=transform --tsconfig=test/fixplan-review/bl8/tsconfig.app-nopaths.json` | OK, exit 0. The bundle contains `node_modules/@asymm/jira-ui/dist/*.js` and `node_modules/react/*`. This emulates the module resolution of a bundler. It is not the Forge bundler. `logs/bl8-esbuild.log`, `logs/bl8-admin-bundle.js` |
| 17 | `rm -rf node_modules && npm ci`, then `npx jest --coverage=false`, then `forge lint` | `npm ci` OK. Jest 59 suites, 764 tests passed (726 + 32 review + 6 mine). `forge lint`: "No issues found." `logs/bl8-npm-ci.log`, `logs/bl8-jest.log`, `logs/bl8-forge-lint.log` |
| 18 | Added `export const FIXPLAN_PROBE = 1;` to `packages/asymm-jira-ui/src/brand.ts` without rebuilding `dist/`, and a `prepare` script that writes a marker file into `OUT/logs`. `rm -rf node_modules && npm ci` | `npm ci` OK. The copied `src/brand.ts` has the probe, but `dist/brand.js` does not (a stale `dist/` is used silently). The marker file was written, so npm ran the dependency's `prepare` script. Both edits were reverted, and the marker file was deleted. `logs/bl8-npm-ci-stale.log`, `logs/bl8-npm-ci-restore.log` |
| 19 | `git check-ignore -v packages/asymm-jira-ui/dist/index.js` | Ignored by `.gitignore:3:dist`. |
| 20 | Moved `packages/asymm-jira-ui/dist` away (a clean clone has none), `rm -rf node_modules && npm ci`, esbuild as in row 16 | `npm ci` OK (exit 0), esbuild **failed**: `Could not resolve "@asymm/jira-ui"` at `src/frontend/admin.tsx:18`. `dist/` was restored, followed by a clean `npm ci` (OK). `logs/bl8-npm-ci-nodist.log`, `logs/bl8-esbuild-nodist.log`, `logs/bl8-npm-ci-restore2.log` |
| 21 | `forge --help` | `forge build` is described as "build and upload your app", so I did not run it. `forge deploy` was not run. |

## 5. Reading and searches

| # | Command | Result |
|---|---|---|
| 22 | Read `src/index.ts` lines 1 to 2670 in full; `src/storage/plan-store.ts` in full; `src/security/policy-admin.ts` 1 to 200; `manifest.yml`; `src/domain/models.ts` 405 to 535; `src/frontend/bridge.ts` 18 to 46; `jest.config.js`; `tsconfig.json`; `packages/asymm-jira-ui/package.json` and `tsconfig.json` | Basis for the verdicts. |
| 23 | `sed -n` on the `legacy-planner.js` lines cited by `fix-plan.md` (97-100, 115-119, 150-166, 176, 193-208, 1555-1559, 1670-1675, 1841-1847, 2307-2309, 2751, 2902-2905, 4104, 4530-4560, 4640-4656, 4944-4951, 5383-5392, 5852-5861, 5905-5912, 6098-6104, 6134-6139, 6159-6165, 6177-6180, 6291-6293, 6345, 6385-6388, 6401); `keyboard-grid.ts` 60-68; `undo-stack.ts` 25-35; `index.html` 141, 414, 615, 656; `plan-manager.ts` 20-27; `planner-engine.ts` 170-215; `admin.tsx` 53, 94 | Each cited defect is present at the cited line, with the exceptions listed in `fixplan-review.md`. |
| 24 | `grep -c "^resolver.define" src/index.ts` | 35 definitions, lines 2585 to 2654. |
| 25 | `grep -c "catch {}" src/index.ts` | 14 (F-21 count confirmed). |
| 26 | Header check over `src` and `test` (excluding `test/review` and `test/fixplan-review`) | 13 files without the header, the same list as report F-30. |
| 27 | `grep -l "asymm/jira-ui" apps/*/package.json apps/*/tsconfig.json apps/*/jest.config.js` | All four apps (`cascadeplan`, `definitionguard`, `ledgerseal`, `fourrealities`) map `@asymm/jira-ui` through tsconfig or jest. |
| 28 | `git show --stat db08009` | Changes `src/index.ts` and `test/plan-isolation.test.ts` only. No step that makes the dates equal in every existing plan. |

## 6. Documentation checks

Delegated to one research agent with a written brief (no email address or credential sent anywhere, no sign-in, read-only fetching). Every result with its URL and fetch date (2026-11-05) is in `fixplan-review.md`, section 3. The agent read `developer.atlassian.com`, `support.atlassian.com` and `atlassian.com` pages. For REST details it read Atlassian's OpenAPI file `https://developer.atlassian.com/cloud/jira/platform/swagger-v3.v3.json`. For the KVS error class it read the published `@forge/kvs` package on `unpkg.com`.

## 7. Not run

See `fixplan-review.md`, section 7.

## 8. State of my clone at the end

`git -C OUT/checkout-claude status --short`:

```
 M apps/cascadeplan/package.json            (BL-8 trial: file: dependency)
 M packages/asymm-jira-ui/package.json      (BL-8 trial: main and types to dist/)
?? apps/cascadeplan/.npmrc                  (BL-8 trial: install-links=true)
?? apps/cascadeplan/package-lock.json
?? apps/cascadeplan/test/fixplan-review/
?? apps/cascadeplan/test/review/
```

`packages/asymm-jira-ui/dist/` exists but is ignored by git. `node_modules` exists only in `apps/cascadeplan` and `apps/cascadeplan/tools`.
