# FourRealities merge review: round 2 follow-ups (2026-11-06)

Branch `feature/fourrealities-review-followups`, head `9abf2b6` (fix `64ed411`, log `9abf2b6`), cut from `master` `494e68c`. Merged onto `master` `47ad030` (LedgerSeal follow-ups had landed; no FourRealities file changed on `master` since `494e68c`, no conflict). Previous review: `docs/sdlc/merge-reviews-2026-11/fourrealities-merge-review.md`, section R2, findings N-1 to N-4.

## Verdict: Merge

All four round 2 findings are fixed as the fix log says. Each fix has a test that fails without it. No Critical, High or Medium finding. Five Low findings, none a blocker.

## 1. Round 2 findings

| Finding | Status | Evidence |
|---|---|---|
| N-1 history writes inside the page view | **Fixed** | `src/manager/default-snapshot-manager.ts:120-123`: `raiseHistory` runs after `saveSnapshot`, `recordTrendPoint` and `deleteV1ProjectKeys`. Lines 132-139: pending issues are those with a verified, non-rollback record; writes run in `Promise.all` batches of `HISTORY_BATCH = 25`; a new batch starts only while `Date.now() < deadline + HISTORY_GRACE_MS` (3 s). An issue not reached keeps its stored history; the next build calls `raise` again, which writes nothing for an issue whose history is already current (`raise` compares and returns early), so later builds advance through the rest. No data loss: the snapshot is saved before any history write, and a skipped history write only delays rollback detection for that issue. |
| N-2 restarted DefinitionGuard is a rollback forever | **Fixed** | `src/engine/default-gate-engine.ts:163-173` (`isOlder`) and `src/accessor/default-kvs-attestation-history-accessor.ts:16-22` (`newer`) both decide by `issuedAt` when both records carry it, else by `stateVersion`, else not older. The two rules agree in every case I worked through (equal `issuedAt` keeps the stored value and is not a rollback). `issuedAt` is inside the signed canonical JSON (ADR-012 decision 2), so it cannot be moved forward without breaking the signature. Both producers write `new Date().toISOString()` (`apps/definitionguard/src/index.ts:462,602,630`, `settings-resolvers.ts:148`; `apps/ledgerseal/src/service/ledger.ts:217,863` with `now = new Date().toISOString()`), so string order is time order. |
| N-3 manager wiring tests | **Fixed** | `test/manager/history-wiring.test.ts`: snapshot and issue panel each run with the real KVS history accessor, store a verified `SEAL_BROKEN`, then reject an earlier `SEAL_VALID` put back (`SEAL_SIGNATURE_INVALID`, "older than a record already seen"). |
| N-4 listing sentence | **Fixed** | `docs/marketplace/fourrealities-listing.md:35`. Code: unverified (unsigned, untrusted key) goes through `stated(...)`, MISSING on Done and NOT_APPLICABLE before Done; `trust.kind === 'invalid'` (bad signature, other issue, rollback) returns MISSING before the Done check (`default-gate-engine.ts:215-218`, same for Audit at 285). The new sentence says exactly that. It is more exact than my round 2 suggestion, which wrongly grouped "older" with unsigned. `test/listing.test.ts` checks the sentence. |

### N-2: put-back caught, reinstall not

- Genuine put-back, still caught: `unverified-and-rollback.test.ts:109` (DG `stateVersion` 3 issued 09:00 over history `stateVersion` 5 issued 09:30: `DOD_SIGNATURE_INVALID`) and both N-3 manager tests (LedgerSeal, by `issuedAt`).
- Reinstall, not a rollback: `unverified-and-rollback.test.ts:118` (history `stateVersion` 7 issued 2026-11-06, record `stateVersion` 1 issued 2026-11-07: FOUND, VERIFIED, and the history moves to the new record).
- A put-back of a pre-reinstall record (higher `stateVersion`, earlier `issuedAt`) is caught too: `isOlder({ stateVersion: 9, issuedAt: '2026-11-05' }, { stateVersion: 7, issuedAt: '2026-11-06' })` is true. My mutation "rollback only when both `issuedAt` and `stateVersion` are lower" (my round 2 suggestion) fails 1 test, so the chosen rule is the stronger one.
- ADR-012 decision 7 (lines 70-82) and spec v3 (line 180 for DefinitionGuard, line 233 for LedgerSeal, line 328 for the key) state the same rule.

### N-1: deadline arithmetic against the Forge limit

Page view or Refresh (`src/index.ts:43`, `RESOLVER_LINK_BUDGET_MS = 20_000`; Forge resolver limit 25 s), times from the start of the invocation:

| Step | Ends by |
|---|---|
| Jira search and remote links (build deadline = 20 s - `VIEW_RESERVE_MS` 7 s) | 13 s |
| Snapshot save, trend point, v1 key cleanup | no own limit (unchanged from master) |
| Last history batch may start | before 16 s (13 s + `HISTORY_GRACE_MS` 3 s), then runs for one parallel write round |
| Viewer check (`VISIBLE_RESERVE_MS`) | 19 s |
| Names: only started before 19 s | about 20 s |

That leaves about 5 s to Forge's 25 s for the one in-flight history batch and the last calls. If the snapshot save itself runs past 16 s, no history batch starts. Daily run: deadline 540 s, history stops at 543 s, timeout 600 s (`manifest.yml:46,51`). No overrun.

## 2. Fix-log entries: tests fail without each fix

Each mutation applied alone in my clone, full suite run, file restored (`git status` clean after each run). Runner: `docs/sdlc/merge-reviews-2026-11/evidence/fourrealities-followups/mutate.py`.

| Mutation | Result | Fix log claim |
|---|---|---|
| No time limit on history writes | 2 fail | 2: confirmed |
| No 3 s grace (stop at the build deadline) | 1 fails | not claimed |
| Writes one by one (sequential inside the batch) | 1 fails | 1: confirmed |
| Snapshot does not write the history | 3 fail | 3: confirmed |
| Panel does not write the history | 1 fails | 1: confirmed |
| `isOlder` by `stateVersion` first (old code) | 2 fail | |
| `newer` by `stateVersion` first (old code) | 1 fails | |
| Both of the above together | 3 fail | 5: **not reproduced** (3, not 5; the fix is still covered) |
| History written before `saveSnapshot` | **0 fail** | see L-1 |

The large-site test (2,000 verified issues, 30 ms writes) and the "next build finishes the rest, never more than 25 at once" test pass and match the log.

## 3. Findings

No Critical, High or Medium.

- **Low, L-1. The order "snapshot first, history after" has no test.** `test/manager/history-wiring.test.ts:111` is named "saves the snapshot first", but moving `raiseHistory` before `saveSnapshot` (`default-snapshot-manager.ts:120-123`) passes all 545 tests: the meta key is still written, because the history loop stops at its own limit. Fix: let the slow history store record whether `fr:p:PAY:meta` exists at its first write, and expect true.
- **Low, L-2. A failed history write now fails a view whose snapshot is saved.** `raiseHistory` (`default-snapshot-manager.ts:136-138`) has no catch. With 25 KVS writes in parallel, a rejected write (for example a storage rate limit) throws out of `build` after `saveSnapshot`, so the Refresh shows an error while the new snapshot is stored; the next view shows it. Before this branch the same error lost the snapshot as well, so this is better than `master`, not a regression. Fix: catch in `raiseHistory`; the next build writes it.
- **Low, L-3. Stale history can overwrite a newer panel write (existing; window slightly longer).** `raise(id, seen, current)` uses the history read at the start of the build (line 84). If the issue panel stores a newer record during the build, the snapshot's later write replaces it with the older version it saw, which weakens rollback detection for that issue (never a false "missing"). The window now includes the snapshot save. Fix later: re-read the key in `raise`, or compare with the stored value.
- **Low, L-4. Rule trade-off, by design.** With `issuedAt` first, a genuine DefinitionGuard write whose host clock is behind the host of the previous write (same issue, within the clock skew, milliseconds) would count as a rollback until the next write. This is unlikely and it is the price of catching a put-back of a pre-reinstall record. No change asked; noted so the trade-off is on record.
- **Low, L-5. Small document drift (existing, not from this branch).** ADR-012 lists decision 7 before decision 6 (lines 70-85). `default-gate-engine.ts:204` still says an unverified record "is REPORTED and not scored", which the H-1 amendment replaced.

Copyright headers present on the new test file; no em or en dashes in the diff. No permission, personal data or licensing code changed: `fr:att:` holds version numbers and dates only.

## 4. Gate

| Step | Branch head `9abf2b6` | Merge result |
|---|---|---|
| `npm ci` (`packages/asymm-jira-ui`, then the app) | exit 0 | exit 0 |
| `npx tsc --noEmit` | no errors | no errors |
| `npm test -- --coverage` | 46 suites, 545 of 545 passed; all files 99.39% statements, 96.55% branches, 99.18% functions, 99.79% lines; thresholds met | same |
| `npm run build` | exit 0 | exit 0 |
| `npm audit --omit=dev --audit-level=high` | exit 0 | exit 0 |
| `forge lint` | "No issues found." | "No issues found." |
| `git status` | clean | clean |
| Apps CI | run 42200828238 on `64ed411` success; run 42202609009 (dispatched) on `9abf2b6` success, all four apps | see the final message of the review session |

## 5. Live checks

None. The session's read-only dashboard check on PAY with 5.2.0 is in the fix log; I did not deploy and made no live change. N-1 timing on a large site and N-2 on a reinstalled DefinitionGuard cannot be run on the development site; the tests above cover both.
