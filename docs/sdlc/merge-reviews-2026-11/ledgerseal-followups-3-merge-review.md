# LedgerSeal third follow-ups merge review

- Date: 2026-11-06. Reviewer: independent merge review session (not the session that wrote the fixes).
- Branch: `feature/ledgerseal-review-followups-3` at `ab7a63b`, cut from master `a215c9b`. Master at merge: `a215c9b` (it did not move).
- Read: the "Third follow-ups" entries of `docs/sdlc/ledgerseal-marketplace-fixes-2026-11/progress-log.md`, the previous review `docs/sdlc/merge-reviews-2026-11/ledgerseal-followups-2-merge-review.md` (M-7, M-8, L-11, L-12, L-13), the full diff (11 files), `apps/ledgerseal/src/service/conversion.ts` in full, the seal and revoke paths of `src/service/ledger.ts` (`convertIfNeeded`, `sealFlow`, `revokeFlow`), `src/storage/party-repository.ts`, `src/service/personal-data.ts`, `createIfAbsent` and `commit` in `src/index.ts`, `tools/verifier/verify-evidence.mjs`.
- Probes (not committed): `/home/fahimfarookme/.cache/jira-suite-merge-review/ledgerseal-followups-3/probes/zz-probe-m7.test.ts` (R1 to R3) and `zz-probe-m7-master.test.ts` (R1 against master's `conversion.ts`). Mutation script: `/home/fahimfarookme/.cache/jira-suite-merge-review/ledgerseal-followups-3/scripts/mutate.py`.
- No live check and no deploy. These conversion paths only touch records written before ADR-011, which exist only on the development site; LedgerSeal has never been deployed to production.

## 1. Verdict

**Merge.** No Critical or High finding. The lease key works as the log says on the path it guards: Q1 (a stalled run never writes its old assignment back), Q3 (two resumers after a stop: the seal answers CONFLICT, then goes in), Q4 (the second resumer gets BUSY) and Q2 (CONFLICT within the lease, then the seal works) all pass, and Q1, Q3 and Q4 fail with master's `conversion.ts`. A stopped run blocks an issue for at most 10 minutes. L-13, M-8 and L-12 are done as described.

One Medium finding remains (M-9): the run reads the record before it claims the lease, and the branch for an invalid record writes that old read back with no re-check. With a late run paused at its claim, this loses a revoke or a reseal and leaves the issue blocked for good. It is not new (master does the same), and it is reachable only on records written before ADR-011 (development site only; a production record is TOKEN from its first seal and never enters a conversion). Hence Medium, as for M-1, M-5 and M-7.

## 2. Findings

### Critical

None.

### High

None.

### Medium

**M-9. The record is read before the lease is claimed, and the invalid-record branch writes the old read back.** `apps/ledgerseal/src/service/conversion.ts:207-210` reads `ls3:we:` and the journal; `:219` claims the lease only after that. If another run converts the record and releases the lease in between, the late run gets the lease (the key is gone, so `createIfAbsent` succeeds) and continues with its old `we`. That old `we` is not TOKEN, its `snapshotHash` no longer matches the converted snapshot, and the journal is gone, so `valid` (`:251-253`) is false. The invalid branch (`:260-273`) has no lease or record re-check: `:272` writes the old `ls3:we:` back (old head, old record hash), and `:265` rewrites the assignment rows from its own read.
- Probe R1: a conversion pauses at its `createIfAbsent('ls3:convert-lease:10001')`. Bob's revoke converts, commits and revokes (`ok: true`). The paused run then returns REDACTED_INVALID. Result: RECORD_INVALID, `ls3:we:` head seq 1, while rows 1 to 3 (SEAL, REDACT, REVOKE) exist. The revoke is lost from the record.
- The issue is then blocked permanently: the weekly run returns ALREADY (nothing left to redact), and every reseal answers CONFLICT, because the reseal appends at seq 2, which is already taken. Probe R1 shows two reseals in a row, both CONFLICT.
- Probe R2: the same with a revoke and then a reseal by Carol before the late run wakes: the reseal is lost too (RECORD_INVALID, head seq 1).
- Not new: `zz-probe-m7-master.test.ts` gives the same result with master's `conversion.ts` (pause at the journal read).
- The window is three KVS calls in the late run, and another run must do a whole conversion inside it, so the late run must stall for seconds. It is the same class of stall as Q1.
- Reviewer patch (not committed): after `takeLease` succeeds, read `ls3:we:` and the journal again; if either changed, release the lease and start again. With it, R1 gives SEAL_REVOKED (SEAL, REDACT, REVOKE), R2 gives SEAL_VALID, later reseals work, and `test/review-followups.test.ts` passes (14 of 14). Also guard the invalid branch with `stillCurrent` before its writes.
- Fix before any further conversion work on the development site, or record it as accepted for development data only.

### Low

- **L-14. Three of the new guards have no test that fails without them** (L-11 is closed for the assignment re-check only). Mutation results on the full suite (506 tests):
  - re-check before the assignment writes removed (`conversion.ts:333`): 1 fails (Q1, shows the rollback). Matches the log.
  - read-back in `takeLease` removed (`:54`): 1 fails (the takeover test).
  - `releaseLease` removed (`:223`): 4 fail. Expiry check removed (`:52`): 4 fail.
  - lease key not deleted with the issue (`personal-data.ts:108`): 2 fail. Inactive accounts mapped again (`party-repository.ts:85`): 1 fails.
  - holder check removed from `stillCurrent` (`:323`): **0 fail**. Re-check before the history rows removed (`:327`): **0 fail**. Re-check before the commit removed (`:351`): **0 fail**.
  The log says "the run checks that it still holds the lease" before each group of writes; the code does, but no test shows the holder check or the first and last re-checks matter (in Q1 and Q3 the record-hash part, or the next re-check, catches the case). The history-row rewrite is the same on a retry, so the first re-check is defensive. Add a test that pauses between the assignment re-check and the commit after a takeover.
- **L-15. Launch article wording, outside the decided rows.** `docs/launch/approved-ticket-problem.md:186` points to "the 11.10(e) row", but the row is labelled "§ 11.10e" (`:169`). Check 4 (`:156`) says the status is "the state of the newest history entry"; the verifier (`tools/verifier/verify-evidence.mjs:85`) uses the newest entry that is not a redaction, as `site/apps/ledgerseal/open-verifier.md` says. The article is not posted yet. On `open-verifier.md`, exit code 0 still says "The evidence is authentic and untampered" (unchanged line); with the 11.10(e) limit, "matches what the vendor key signed" would be more exact.

### Takeover soundness (asked in the brief)

The takeover is a plain write and a read-back, not an atomic compare. Two takers of an expired lease can both read back their own holder only if one does its write and read-back fully before the other writes (A set, A get, B set, B get). Then both hold for a moment. Both resume the same journal, so their history, assignment and commit writes are the same values; a seal or revoke meanwhile meets a held lease and answers CONFLICT. Once one commits and releases, the other's next `stillCurrent` fails (holder or record hash) and it writes nothing more. What remains is the gap of milliseconds between a re-check and the write that follows it, which the log states ("each group of writes re-checks the holder. Plain KVS keys have no conditional write"). I find that statement honest for the converted (valid) path. It does not cover the read before the claim or the invalid-record branch (M-9). A single run cannot outlive its lease: the weekly function has 300 s, the seal and revoke resolvers 25 s, and each `convertRecord` in `convertAll` claims a new lease with a fresh `now`.

## 3. Fix-log entries checked

| Entry | Diff does what it says | Test fails without the fix | Notes |
|---|---|---|---|
| M-7 lease key (`3dde4a6`) | Yes: `takeLease` (`conversion.ts:47-55`), FAIL_IF_EXISTS via `createIfAbsent` (`src/index.ts:48-57`), takeover after `CONVERSION_LEASE_MS` with read-back, release at end (`:223`), kept on a throw | Yes: with master's `conversion.ts` Q1, Q3, Q4 fail (and Q2, which reads the lease key) | M-9 |
| M-7 re-checks | Yes: `stillCurrent` before history rows, assignments and commit (`:322-351`) | Assignment re-check: yes (Q1). Holder check, history and commit re-checks: no (L-14) | |
| M-7 lease deleted with the issue | Yes: `personal-data.ts:108` | Yes (2 fail) | The lease holds no personal data (UUID and time) |
| L-13 | Yes: `party-repository.ts:79-86`; an inactive account not yet mapped gets no entry; the weekly report sends only entries with an account id (`:103-108`), so it stays correct | Yes (1 fails) | Not confirmed live what Jira answers for a closed account (as the log says) |
| M-8 | Yes: ADR-011 decisions 4, 5, 10 and the consequence line, spec v3 item 12, `sealedByUnknown`, evidence `parties`, two lines of the reviewer notes; `test/listing.test.ts` guards the notes | Yes for the notes test | No "key is deleted" wording left in ADR-011, spec v3, the notes, the site or the article |
| L-12 | Yes: five checks and five `PASS` lines, "tamper evidence" with the 11.10(e) limit; the 11.50 row is not in the diff (unchanged from the owner's decision); `open-verifier.md` five checks, the status line, and the production key note (`tools/verifier/keys/ls-prod-2026-11.pub.pem` exists, also in the public verifier repository) | n/a (docs) | L-15 |

Could not confirm: the development 4.5.0 deploy and the PAY-10 export with 5 of 5 PASS. I did not re-run them.

## 4. Gate

| Check | Branch head `ab7a63b` | Merge result |
|---|---|---|
| `npm ci` (shared UI package, then the app) | exit 0 | exit 0 |
| `npx tsc --noEmit` | 0 errors | 0 errors |
| `npm test -- --coverage` | 47 suites, 506 tests pass; statements 97.88%, branches 94.23%, functions 96.79%, lines 98.67% | same |
| `npm run build` | exit 0 | exit 0 |
| `npm audit --omit=dev --audit-level=high` | exit 0 | exit 0 |
| `forge lint` | No issues found | No issues found |
| `git status` | clean | clean |
| `tools/verifier` `node --test` | 12 of 12 | 12 of 12 |
| Em or en dashes in changed files | none | none |
| Copyright header and `@author` in changed source files | present | present |

Apps CI on the branch: run 42209669375 (push, `5f9fa61`) success. The last push (`ab7a63b`) changed only the fix log, so I started run 42223255076 (workflow_dispatch) on `ab7a63b`: success for all four apps. Master did not move, so the merge tree is the branch tree; the right-hand column was run on the merge commit.
