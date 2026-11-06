# DefinitionGuard FSRT authorization merge review

- Date: 2026-11-07. Reviewer: independent merge review session.
- Branch: `feature/definitionguard-fsrt-authorization` at `2cc51fd`, cut from master `e5b574c`. Master had not moved, so the merge result has the same tree as `2cc51fd`. Two commits:
  - `f454379`: the code;
  - `2cc51fd`: `docs/security/fsrt-scan-2026-11-07.md`.
- Purpose: fix the Marketplace rejection AMS-76722, FSRT `Custom-Check-Authorization-16711047855292326038` (High, Requirement 1.2) on DefinitionGuard.
- Output and scripts, not committed: `/home/fahimfarookme/Documents/projects/jira-governance/.tmp/cache/merge-review/definitionguard-fsrt/` (FSRT reports, `gate-branch.txt`, `mutate.py`, `mutations.txt`).
- Nothing deployed by this review. The fixing session deployed 7.1.0 to development. With `forge lint -e production` there is no approval (no scope change), so the production deploy is a minor version.

## 1. Verdict

**Merge.**
- FSRT at the pinned commit `6c821bd` reports the ticket's check on master and nothing on the branch. I confirmed this with the provided binary and with my own build from that commit.
- The permission semantics are unchanged, except one call that is now stricter.
- The 429 retry gives the same tries and waits as `withRetry`.
- All 12 mutations are caught, and the gate passes.

No finding.

## 2. FSRT

| Scan (`fsrt --appkey systems.asymm.<app> apps/<app>`) | Provided binary (`.tmp/fsrt-bin/fsrt`) | My build of `6c821bd` (`cargo build --release -p fsrt`, Rust 1.93.0) |
|---|---|---|
| DefinitionGuard, master `e5b574c` | 1 finding: `Custom-Check-Authorization-16711047855292326038`, `handler.toggleItem -> publishAttestation -> toggleChecklistItem`, the ticket's check name | the same |
| DefinitionGuard, branch | 0 findings, `errors: false` | 0 findings, `errors: false` |
| LedgerSeal, FourRealities, CascadePlan, master and branch | 0 findings | not run (no code change) |
| `--scanners secret-logging`, all four, branch | 0 findings, `errors: false` | not run |

Probe: in a copy of the branch, the three `mypermissions` calls of `permissions.ts` were put back inside `withRetry(() => ...)`. FSRT then reported `Custom-Check-Authorization-13168914673425698921` (`handler.resetChecklist`), one of the findings the scan report says were hidden. So a clean scan means FSRT sees the checks, not that it did not look.

## 3. Semantics

| Function | Before | After |
|---|---|---|
| `requireBrowseIssue` | `fetchGranted(withRetry(asUser mypermissions?issueId=&BROWSE_PROJECTS))`; any throw or non-200 gives `BROWSE_CHECK_FAILED`; no grant gives `BROWSE_DENIED` | The same call inline. The whole block, including `grantedIn`, is inside the same `try`, so the same two outcomes. |
| `getIssuePermissions`, `getProjectPermissions` | throw or non-200 gives `PERMISSION_CHECK_FAILED` | The same: `catch` around the loop, then `grantedIn` (non-200, or no response at all, throws) |
| `isJiraAdmin`, `hasTier1AdminPermission` | `withRetry`; route in a variable in `hasTier1AdminPermission`; any failure gives `false` | Inline, with a literal route in each branch (`issueId` or `issueKey`), the same keys and the same `false` on failure |
| `fetchLiveJiraIssue` (template lookup) | as the app, after the Browse check | **as the user**, after the Browse check. Stricter: it reads only what the user may see, which Browse projects already allows. |

**429 retry.**
- `withRetry` makes a call, and while the status is 429 and `attempt < MAX_TRIES` (3), it sleeps `backoffMs(res, attempt)` and calls again.
- The inline loop calls with `attempt` = 1, 2, 3, and `retryAfter` sleeps `backoffMs(res, attempt)` only for a 429 with `attempt < MAX_TRIES`.
- So both make at most 3 calls, with the same waits (Retry-After, else 1 s and 2 s, capped at 5 s), and both return the last response.
- `retryAfter` also treats a missing response as "do not retry".

## 4. Mutations (each applied alone; full jest run)

| Mutation | Tests failing |
|---|---|
| No 429 retry in `requireBrowseIssue` / `getIssuePermissions` / `isJiraAdmin` | 1 / 2 / 1 |
| `retryAfter` allows one try too many / retries any status | 1 / 113 |
| `grantedIn` accepts a non-200 | 7 |
| `getIssuePermissions` grants every key on a network error | 1 |
| `isJiraAdmin` always true / `hasTier1AdminPermission` skips the check / `getProjectPermissions` grants every key | 10 / 13 / 11 |
| `fetchLiveJiraIssue` back to `asApp()` | 1 |
| Browse check put back inside `withRetry` | caught (the source-rule test; this mutant also fails to compile, because `withRetry` is not imported there) |

All 12 caught. The "no retry" mutants are caught by the source-pattern tests (`jira-client.test.ts`, `fsrt-authorization.test.ts`), which require each inline call to end with the `retryAfter` line. `retryAfter` itself has unit tests.

`test/security/fsrt-authorization.test.ts` sends all 18 resolver keys (`handler`, `adminHandler` and `settingsHandler`, without the static `getAvailableTemplates`) to a user whom Jira grants nothing. Each is refused with no storage access, no call as the app, and only the permission question asked as the user. A test fails if a key is added without a case.

## 5. The scan report (`docs/security/fsrt-scan-2026-11-07.md`)

- The rule in section 3 matches what the scans show: the closure limit is the cause, and the inline form is the fix.
- Its summary gives CascadePlan production as 2.2.0. `forge deploy list -e production` shows a CascadePlan production deploy at 2026-11-06T17:04:56Z (major version 2), after the CSV merge `7414f98`.
- So section 7 of `docs/security/pentest-report-2026-11-06.md` ("ASYMM-SEC-04: fixed in code, not yet in production") is now out of date. It should be updated in the next pass.

## 6. Gate

| Check | Branch `2cc51fd` (equals the merge result) |
|---|---|
| `npm ci` (shared package, app) | exit 0 |
| `npx tsc --noEmit` | 0 errors |
| `npm test` (jest with coverage) | 35 suites, 484 tests pass; statements 99.23%, branches 96.39%, functions 98.33%, lines 99.45% |
| `npm run build` | exit 0 |
| `npm audit --omit=dev --audit-level=high` | exit 0 (7 moderate) |
| `forge lint`, `forge lint -e production` | No issues found (minor version) |
| Apps CI | run 42267274416 on `f454379`: success (`2cc51fd` is docs only and does not trigger it) |
| FSRT | section 2 |
