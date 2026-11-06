# LedgerSeal second follow-ups merge review

- Date: 2026-11-06. Reviewer: independent merge review session (not the session that wrote the fixes).
- Branch: `feature/ledgerseal-review-followups-2` at `a57d950`, cut from master `47ad030`. Master at merge: `c3abc07` (holds the FourRealities follow-ups merge `094f202`).
- Read: the "Second follow-ups" entries of `docs/sdlc/ledgerseal-marketplace-fixes-2026-11/progress-log.md`, the previous review `docs/sdlc/merge-reviews-2026-11/ledgerseal-followups-merge-review.md` (M-5, M-6, L-8, L-9, L-10), the full diff (16 files), `src/service/conversion.ts` in full, the seal, revoke and incident paths of `src/service/ledger.ts`, `src/storage/party-repository.ts`, `src/service/personal-data.ts`, ADR-011 and spec v3.
- Probes (not committed): `/home/fahimfarookme/.cache/jira-suite-merge-review/ledgerseal-followups-2/probes/zz-probe-m5.test.ts` (Q1 to Q4), and the earlier probe P1 (`/home/fahimfarookme/.cache/jira-suite-merge-review/ledgerseal-followups/probes/zz-probe-concurrent.test.ts`).
- No live check and no deploy. M-3 (production key) is not treated as open: the key `ls-prod-2026-11` exists in the Forge production variables, and `feature/production-public-keys` publishes its public key.

## 1. Verdict

**Merge.** No Critical or High finding. P1 is fixed: while the weekly run is inside its commit, a revoke answers CONFLICT, and the retried revoke goes in (P1 on the branch: CONFLICT, then CONVERTED, then a clean reseal). A conversion stopped before its commit blocks a seal or revoke for at most 10 minutes; after that the seal resumes it and works (probe Q2). No path found blocks an issue permanently. The closed mark works as described, and the weekly report still reports every stored account id and erases closed ones. The launch article has the decided 11.50 text character for character, 11.200 and 11.300 "Not met", and the token model. Each fix has a test that fails without it.

Two Medium findings remain. M-7 is a remaining overlap of two conversions, possible only after a stopped conversion and only on records written before ADR-011 (development site only; production was never deployed). M-8 is documentation that still says the map key is deleted. Neither blocks the merge.

## 2. Findings

### Critical

None.

### High

None.

### Medium

**M-7. The lease is not renewed when a stopped run is resumed, and the resumer rewrites the assignments before its re-check.** `apps/ledgerseal/src/service/conversion.ts:190` compares `now` with `journal.startedAt`. A resume keeps the old `startedAt` (the redaction row needs it, `:247`), so once a journal is older than 10 minutes, every invocation treats it as "stopped". Two resumers (the weekly run and a seal or revoke, or a seal and a revoke) then run at the same time with no lease. The re-check (`:294-295`) runs after `:274-275`, which rewrite the history rows and the assignment rows from the resumer's first read.
- Probe Q1: a conversion that started more than 10 minutes ago pauses at its first history-row write. Bob's revoke resumes the same journal, converts, commits, ends the assignment and appends REVOKE (`ok: true`). The paused run then writes the old assignment back (`thruDate: null`), and its re-check returns BUSY. Result: RECORD_INVALID (assignment hash mismatch), history SEAL, REDACT, REVOKE. The revoke row is kept, and a reseal is still possible, so nothing is blocked. But the record shows as invalid, and its evidence is refused until a reseal. With an extra re-check before `:275` (reviewer change, not committed), Q1 gives SEAL_REVOKED.
- Probe Q3: the same two resumers, with the weekly run paused between its re-check and its commit (the two-call window that the fix log names). Carol's seal returns `ok: true`, then the weekly run commits. Result: head seq 2, RECORD_INVALID; the seal is lost. This needs a pause of milliseconds, so it is the residual the log accepts. But the log says the lease "closes the window for two conversions", and that is not true after a stop.
- Probe Q4: two resumers after the lease both proceed (the second gives CONVERTED, the first BUSY), so the lease gives no exclusion after a stop.
- When does a stop happen? The seal resolver has the default 25 s limit, so a large old record can stop inside a seal. Any KVS error during a conversion leaves the journal too (`convertAll` catches the error, `:353`). The weekly function's 300 s limit (`manifest.yml:68`) and the 200 s budget (`src/index.ts:326`) fit the 10 minute lease, so a single run cannot outlive its own lease.
- Scope: as for M-1 and M-5, only records written before ADR-011, which exist only on the development site. It needs a stopped conversion and then two invocations on the same issue at the same moment. Hence Medium.
- Fix: claim the lease atomically on every attempt, not only on the first. For example, a lease key `ls3:convert-lease:{issueId}` created with `createIfAbsent` (`kvs.set` with `keyPolicy: 'FAIL_IF_EXISTS'`, `src/index.ts:48-57`), and replaced only when it is older than `CONVERSION_LEASE_MS`. Also run the re-check before the assignment writes (`:275`), not only before the commit.

**M-8. ADR-011, spec v3 and the reviewer notes still say that a closed account's map key is deleted.** The branch keeps the key and stores a closed mark `{ closed: true, closedAt }` (`apps/ledgerseal/src/storage/party-repository.ts:106-108`). These documents were not changed:
- `architecture/decision/adr-00011-ledgerseal-personal-data.org:52-53`: "On closure this key is deleted" and the panel shows "a closed account". `:57`: the report "deletes the map key". `:79` and spec v3 `:417`: `parties` maps "each party token" to an id or null. Now a token with no entry is left out (`src/service/ledger.ts:884-889`).
- `docs/spec/ledgerseal-spec-v3.md:43` ("a closed account's key is deleted") and `:154` (no `sealedByUnknown`).
- `docs/marketplace/submission/ledgerseal-submission-notes.md:22` ("it deletes the account's token-to-account key") and `:32` ("a closed account's token-to-account key is deleted"). These notes go to the Atlassian reviewer. What they claim about privacy is still true: no account id is kept, and the token names no one. But "the key is deleted" is no longer literally true.
- The public listing (`docs/marketplace/ledgerseal-listing.md:42, 62`) speaks of the "link" from token to account id. That link is still erased, so the listing is correct.
- Fix: amend ADR-011 decisions 4, 5 and 10 (the closed mark, "a deleted user" and "an unknown user", unknown tokens left out of `parties`), spec v3 items 12 and the evidence API, and the two lines of the reviewer notes, before submission.

### Low

- **L-11.** The stalled-run test does not show what the re-check prevents. `apps/ledgerseal/test/review-followups.test.ts:674-701` pauses the run on `get('ls3:wes:10001:000003')`, and the re-check's own read makes that call. Without the re-check, the test fails by a 5 s timeout because the pause is never reached; it does not fail by showing a rollback. If only the head-hash part of the re-check is removed, the test still passes. It does not cover the assignment rewrite (M-7, Q1).
- **L-12.** The launch article (`docs/launch/approved-ticket-problem.md`), outside the decided rows, still has three problems. Lines 152-158 say "four independent checks" and "four `PASS` lines", but verifier 1.2.0 runs five (the fix log reports "5 of 5 PASS"). Line 149 uses the development key `ls-dev-2026-11.pub.pem`, but the production key exists now. Line 181 says "cryptographic immutability", but row 11.10(e) (line 168) says the chain does not stop someone who can rewrite the storage. The article is not posted yet.
- **L-13.** On a site where the 4.3.0 weekly report already erased accounts (key deleted, no mark), those tokens now show "an unknown user", not "a deleted user". If Jira answers 200 with `active: false` for a closed account (not 404), `register` stores the id again (`party-repository.ts:74-83`), and the next weekly report erases it. The same holds for a closed account that was never in the map. This is development only, and it is limited to one week by the report. I did not confirm live what Jira returns for a closed account.

## 3. Fix-log entries checked

| Entry | Diff does what it says | Test fails without the fix | Notes |
|---|---|---|---|
| M-5 lease (`f2aab21`) | Yes: `conversion.ts:190`, `CONVERSION_LEASE_MS` = 10 min; a seal or revoke turns BUSY into CONFLICT (`ledger.ts:418, 923`) | Yes: without the lease the P1 test fails (1 of 10) | M-7: no exclusion after a stop |
| M-5 re-check (`f2aab21`) | Yes: `conversion.ts:294-295`, re-read of `ls3:we:` and of the row after the redaction row | Yes, by a timeout (L-11). With only the row part kept, all pass | Two calls, as the log says |
| L-8 closed mark (`f2aab21`) | Yes: `markClosed` (closed mark, no id); `register` skips a mark, marks 404 as closed, stores active, inactive and unreadable accounts; `accountState` in `jira-client.ts:212-217`; "a deleted user" only for a mark; "an unknown user" for signer, revoker, changer and history; evidence leaves an unknown token out | Yes: without the skip of a mark, 1 fails; the old `register` rule, 1 fails; `markClosed` deleting the key, 7 fail; evidence `null` for unknown, 1 fails; the old `signerClosed` rule, 1 fails | M-8, L-13 |
| L-8 report | `reportPersonalData` reports only entries with an account id (`party-repository.ts:98-103`), so a mark is not reported, and it marks closed accounts (`personal-data.ts:61`) | `personal-data.test.ts` expects the mark and no id | Correct |
| L-9 (`f2aab21`) | Yes: plural label guarded; `site/apps/ledgerseal/compliance-mapping.md` read for the decided wording | Yes: `${n} closed accounts` makes it fail | |
| M-6 (`39e3d66`) | Yes: token model, the app's signature, separation of duties as built, "How LedgerSeal Supports It", 11.10(e) with the vendor limit, 11.50 "Partly met." plus the decided text character for character, 11.70 "your auditor decides", 11.200 and 11.300 "Not met" | n/a (docs) | L-12 |
| L-10 | Yes: the M-2 proof now says three tests | n/a | |

Could not confirm: the development 4.4.0 deploy and the live checks in the log (PAY-10, PAY-13, LSP-3 with verifier 1.2.0). I did not re-run them. `accountState` was not called live (L-13).

## 4. Gate

| Check | Branch head `a57d950` | Merge result |
|---|---|---|
| `npm ci` (shared UI package, then the app) | exit 0 | exit 0 |
| `npx tsc --noEmit` | 0 errors | 0 errors |
| `npm test -- --coverage` | 47 suites, 501 tests pass; statements 97.89%, branches 94.19%, functions 96.74%, lines 98.65% | same |
| `npm run build` | exit 0 | exit 0 |
| `npm audit --omit=dev --audit-level=high` | exit 0 | exit 0 |
| `forge lint` | No issues found | No issues found |
| `git status` | clean | clean |
| Em or en dashes in changed files | none | none |
| Copyright header and `@author` in changed source files | present | present |

Apps CI on the branch: run 42202638603 (push, `39e3d66`) success. The last push (`a57d950`) changed only docs, so I started run 42207956342 (workflow_dispatch) on the branch head `a57d950`: success for all four apps. The merge onto `c3abc07` had no conflicts and changes only LedgerSeal files, the LedgerSeal fix log and the launch article.
