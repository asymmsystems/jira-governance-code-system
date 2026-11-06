# LedgerSeal fourth follow-ups merge review

- Date: 2026-11-06. Reviewer: independent merge review session (not the session that wrote the fixes).
- Branch: `feature/ledgerseal-review-followups-4` at `354fa33`, cut from master `c8be4c9`. Master at merge: `3c76131` (one docs commit, `docs/marketplace/submission/owner-partner-setup-guide.md`; no conflict).
- Read: the "Fourth follow-ups" entries of `docs/sdlc/ledgerseal-marketplace-fixes-2026-11/progress-log.md`, the previous review `docs/sdlc/merge-reviews-2026-11/ledgerseal-followups-3-merge-review.md` (M-9, L-14, L-15), the full diff (5 files), `apps/ledgerseal/src/service/conversion.ts` in full, `convertIfNeeded`, `sealIssue` and `revokeSeal` in `src/service/ledger.ts`, `appendStatus` in `src/storage/seal-repository.ts`, the status check of `tools/verifier/verify-evidence.mjs`.
- Probes and scripts (not committed), in `/home/fahimfarookme/Documents/projects/jira-governance/.tmp/cache/merge-review/ledgerseal-followups-4/`: `probes/zz-probe-m9.test.ts` (P1), `probes/conversion.reviewer-patch.ts` (reviewer patch), `scripts/mutate.py` and `probes/mutation-results.txt` (guard mutations), `scripts/gate.sh`.
- No live check and no deploy. These conversion paths only touch records written before ADR-011. Such records exist only on the development site; production (2.0.0, deployed from `c8be4c9`) has none, because a production record is TOKEN from its first seal.

## 1. Verdict

**Merge.** No Critical or High finding. M-9 is fixed as described for the case the previous review probed (R1, R2): the late run re-reads the record after its lease claim, sees the converted record and returns ALREADY; the revoke and the reseal are kept, and later seals work. All four new M-9 tests fail with the conversion code of `c8be4c9`, each by its assertion. Every guard named in the L-14 table has a test that fails by its assertion when the guard is removed. L-15 is done.

One Medium finding remains (M-10): the invalid-record branch can still lose a reseal and block the issue for good. It needs a reseal on an invalid old record that still holds account ids, racing a conversion that read the record before the reseal's own conversion wrote. It is not new (the code of `c8be4c9` gives the same result) and it is reachable only on development data. Hence Medium, as for M-9.

## 2. Findings

### Critical

None.

### High

None.

### Medium

**M-10. The invalid-record branch can still write an old record over a reseal.** `apps/ledgerseal/src/service/conversion.ts:230` compares only `recordHash` after the lease claim, and `:280` checks the lease and `recordHash` once, before a write group that ends with `ls3:we:` at `:290`.
- Two facts make this reachable. First, the invalid branch writes `ls3:we:` with a new `currentAssignment.partyId` but the old `recordHash` (`:290`), so a `recordHash` compare cannot see that write. Second, a seal holds the lease only during its own conversion (`ledger.ts:416` via `convertIfNeeded`); its row claim and commit come after it released the lease, so the lease does not keep it out of a later conversion's write group.
- Probe P1 (`probes/zz-probe-m9.test.ts`): an invalid old record (record hash does not match, account ids still raw). Run A reads the record and pauses at its lease claim. Carol's reseal converts (REDACTED_INVALID), releases the lease and pauses at its row claim `ls3:wes:10001:000002`. A claims the lease; its re-read passes (same `recordHash`) and `heldAndUnchanged` passes; A pauses at its first row write. The reseal then finishes (`ok: true`, head seq 2, TOKEN). A resumes and returns REDACTED_INVALID.
- Result: `ls3:we:` is back to head seq 1 with record hash `ffff...` while row 2 (the reseal) exists. The panel shows RECORD_INVALID, and the next two seals (Ann, Bob) both answer CONFLICT, because every reseal appends at seq 2, which is taken. The reseal is lost and the issue is blocked for good, the same end state as M-9.
- Window: A must be slower than the reseal's conversion by about two KVS calls between its first read and its lease claim. After that, the reseal's row claim and commit must land inside A's write group, which includes `parties.register` (one Jira account call per actor) and one KVS write per row, assignment and content part. That is wider than the two-call residual the log states, and it needs no long stall.
- Not new: with the conversion code of `c8be4c9`, P1 gives the same result.
- Reviewer patch (not committed, `probes/conversion.reviewer-patch.ts`): at `:230`, compare the whole record (`canonicalJson(weNow) !== canonicalJson(we)`) instead of `recordHash`. A then sees the reseal's conversion write, restarts, and returns ALREADY. With the patch, P1 gives SEAL_VALID, history SEAL, RESEAL, RESEAL, RESEAL (the reseal and two later seals), and the full suite passes (512 of 512, plus P1). Comparing the whole record in `heldAndUnchanged` too, and checking that row `head.seq + 1` does not exist just before the `ls3:we:` write at `:290`, would close the rest of the branch the same way as `stillCurrent` does for the converted path.
- Fix before any further conversion work on the development site, or record it as accepted for development data only.

### Low

- **L-16. Two re-check parts and the attempt limit have no test that fails without them** (not claimed by the L-14 table, which lists each guard it names correctly). Mutation results on the full suite (512 tests, `probes/mutation-results.txt`):
  - journal compare removed from the re-read (`:230`): 0 fail. I find it defensive only: a changed journal with the same record either meets a held lease, fails its `createIfAbsent` of the journal, or meets a non-redaction row at the redaction seq, so no write follows.
  - next-row check removed from `stillCurrent` (`:342`, from M-5): 0 fail.
  - attempt limit raised from 3 to 10 (`:232`): 0 fail. The test "gives up with BUSY after three restarts" asserts only BUSY in the end. With `attempt < 3` and `attempt` starting at 1, the code makes three attempts, that is two restarts; the fix log says "at most three attempts", which is right, and the test title says "three restarts", which is not.
- **L-17. Open-verifier exit code 1 text.** `site/apps/ledgerseal/open-verifier.md:63` (unchanged line): "The evidence has been tampered with or signature is invalid." A FAIL also follows from the wrong public key file or an evidence file with a missing part; "the FAIL lines name which check failed" (as `tools/verifier/README.md:63` says) is more exact. Docs only.

### Interleavings checked (asked in the brief)

- Converted (valid) path: after the lease claim and a matching re-read, no seal or revoke can write to the record until the lease is released. A seal or revoke on a record that is not TOKEN must pass `convertIfNeeded`, which meets the held lease and answers CONFLICT. A seal or revoke whose own conversion finished before the claim made the record TOKEN, which changes `recordHash`, so the re-read restarts and the next attempt returns ALREADY. A revoke of an invalid record is refused (`ledger.ts`, "failed its integrity check"). What remains is the case the log states: a run that stalls past the 10-minute lease while another takes it over, with one write in flight after its last re-check (the final-save test shows one assignment write landing; the record and the history keep the revoke).
- Restarts: each restart releases the lease first; after three attempts the run answers BUSY and the next weekly run tries again, so a restart never blocks an issue.
- Invalid branch: M-10 above.
- Order in `stillCurrent` (lease read last): correct and harmless. No test can tell the two orders apart in a single-threaded fake, which the log does not claim.

## 3. Fix-log entries checked

| Entry | Diff does what it says | Test fails without the fix | Notes |
|---|---|---|---|
| M-9 re-read after the lease (`4b833ab`) | Yes: `conversion.ts:228-233`, release then restart, at most three attempts, then BUSY | Yes: re-read removed, R1 fails (Expected ALREADY, Received REDACTED_INVALID); record compare removed, R1 fails; restart removed (BUSY at once), R1 fails | Journal compare and the limit untested (L-16); `recordHash` compare misses the invalid-branch write (M-10) |
| M-9 invalid branch guarded | Yes: `:274-280`, lease and record checked before the writes, BUSY and no write otherwise | Yes: guard removed, lease part removed or record part removed, each fails "the invalid-record branch writes nothing ..." | Checked once, before the whole group (M-10) |
| M-9 order in `stillCurrent` | Yes: `:340-345`, record and next row first, lease last | n/a (no behaviour change in tests) | |
| M-9 tests fail with master's `conversion.ts` | Yes: with the code of `c8be4c9`, all four M-9 tests fail by their assertions (REDACTED_INVALID, RECORD_INVALID, REDACTED_INVALID, REDACTED_INVALID) | | |
| L-14 table | Yes, row by row: holder check removed, the "history rows" test fails; re-check before history removed, the same test fails; re-check before the final save removed, the "final save" test fails; re-check before assignments removed, Q1 fails. All by assertion, none by timeout | | L-16 for parts the table does not name |
| L-15 article | Yes: check 4 says the verifier skips redaction entries, as `verify-evidence.mjs:85` does; "(see the § 11.10e row)" matches the row label | n/a (docs) | |
| L-15 open-verifier | Yes: exit 0 states what a PASS shows (file unchanged since signing, signed with the private key of the public key used) and what it does not (a different, consistent record by someone who can rewrite the stored data, including the vendor) | n/a (docs) | L-17 for exit 1. The site page `product/jira-governance/user-guide/open-verifier.html` is outside this repository (owner action, item 20) |

Could not confirm: the development 4.6.0 deploy and the PAY-10 export with 5 of 5 PASS. I did not re-run them.

## 4. Gate

| Check | Branch head `354fa33` | Merge result |
|---|---|---|
| `npm ci` (shared UI package, then the app) | exit 0 | exit 0 |
| `npx tsc --noEmit` | 0 errors | 0 errors |
| `npm test -- --coverage` | 47 suites, 512 tests pass; statements 97.99%, branches 94.42%, functions 96.8%, lines 98.68% | same |
| `npm run build` | exit 0 | exit 0 |
| `npm audit --omit=dev --audit-level=high` | exit 0 | exit 0 |
| `forge lint` | No issues found | No issues found |
| `git status` | clean | clean |
| `tools/verifier` `node --test` | not run | 12 of 12 |
| Em or en dashes in changed files | none | none |
| Copyright header and `@author` in changed source files | present | present |

Apps CI on the branch: run 42225686158 (push, `ea98bc2`) success. The last push (`354fa33`) changed only the fix log, so I started run 42227080456 (workflow_dispatch) on `354fa33`: success for all four apps. The fix-log gate numbers (512 tests, coverage) match mine.
