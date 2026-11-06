# LedgerSeal follow-ups merge review

- Date: 2026-11-06. Reviewer: independent merge review session (not the session that wrote the fixes).
- Branch: `feature/ledgerseal-review-followups` at `7f6dce8`, cut from master `42e79fa`. Master at merge: `494e68c` (holds the FourRealities merge `51c0d28`, `27e7dbe`, `494e68c`).
- Public verifier: `asymmsystems/ledgerseal-verifier` `main` `67776e4`, release `v1.2.0`.
- Read: the follow-up entries of `docs/sdlc/ledgerseal-marketplace-fixes-2026-11/progress-log.md`, the previous review `docs/sdlc/merge-reviews-2026-11/ledgerseal-merge-review.md` (M-1, M-2, M-4, L-1 to L-7), the full diff (25 files) and `src/service/conversion.ts` in full.
- Probe (not committed): `/home/fahimfarookme/.cache/jira-suite-merge-review/ledgerseal-followups/probes/zz-probe-concurrent.test.ts` (P1).
- No live check and no deploy. `isActiveUser` uses the same request as `getUserName` (`GET /rest/api/3/user?accountId=`, as the app), which the panel already uses on the development site.

## 1. Verdict

**Merge.** No Critical or High finding. The fix for M-1 covers the scenario that the previous review proved (probe R1): a conversion stopped after its commit no longer rolls back a later seal or revoke. M-2 is fixed: a closed account's id is not stored again. The 21 CFR 11.50 wording is exactly the decided text in the listing, the reviewer notes and the site compliance mapping. Every panel label for a closed account reads "a deleted user". Each fix has a test that fails without it. The open verifier 1.2.0 matches `tools/verifier`, and its release checksums and CI are correct. Two Medium findings remain; neither blocks the merge.

## 2. Findings

### Critical

None.

### High

None.

### Medium

**M-5. The second M-1 window (a weekly run and a seal or revoke at the same time) still rolls the record back.** `apps/ledgerseal/src/service/conversion.ts:283-287`: the commit of `ls3:we:` does not check that the stored record is unchanged. The new guard (`conversion.ts:176-181`, `ledger.ts:561-567`) reads the record only at the start. The previous review named this window in M-1 ("A concurrent weekly run and seal on the same old record has the same window"). Probe P1: the weekly `convertRecord` stops just before its commit. Bob revokes; his revoke runs `convertRecord` itself, commits it and appends row 3 (REVOKE), and returns `ok: true`. The weekly run then commits and returns CONVERTED. Result: `ls3:we:` head is seq 2, LS_SEALED, while row 3 exists. The panel shows RECORD_INVALID, evidence export is refused ("failed its integrity check"), and a new seal returns CONFLICT. Scope: as for M-1, only records written before ADR-011 (development site only; production was never deployed). It needs two invocations on the same old issue at the same moment. Hence Medium, not a merge blocker. Fix: re-read `ls3:we:` just before the commit and stop (delete nothing, return BUSY) when its `statusHead` is past the old head or when a row exists after the redaction row. Or make the commit conditional on the record that was read, if the storage layer supports it.

**M-6. The launch article still claims 11.50 and account ids in the record.** `docs/launch/approved-ticket-problem.md:168-169` (not changed by this branch): "How LedgerSeal Satisfies the Standard", "Append-only hash chain records actor Atlassian Account ID", and "21 CFR Part 11 (11.50/70) ... binds reviewer identity". Since ADR-011 the chain holds party tokens. The decided wording says 11.50 is only partly met. The article is not on the site yet (`site/` has only the phrase "The Approved Ticket Problem"). It is a launch draft that the distribution kit points to. Before it is posted, change the 11.50 row to the decided wording and "account ID" to "party token". Not a merge blocker, because nothing public changes.

### Low

- **L-8.** An active account can be shown as "a deleted user". `apps/ledgerseal/src/storage/party-repository.ts:63-66` skips an account that is not yet in the map when `isActiveUser` returns `false` or `null` (`apps/ledgerseal/src/jira/jira-client.ts:212-217`). `null` comes from a Jira error after retries (for example 429 or 5xx). `false` comes from a deactivated account that still exists. The incident row then names a token with no map entry: the panel shows "a deleted user", and the evidence `parties` map shows `null`, which the export defines as "closed". It heals only when the same person is registered again (a later incident on the issue). The wording says the name is shown "while it exists". Consider retrying the registration on the next view, or keeping the token as "unknown" instead of "deleted".
- **L-9.** The listing test guards the singular labels only. `apps/ledgerseal/test/listing.test.ts:72-76` checks that `index.tsx` holds "a deleted user" and not "a closed account". If the plural label went back to `${n} closed accounts` (`index.tsx:232`), the test would still pass. The test also does not read `site/apps/ledgerseal/compliance-mapping.md`, which holds the same 11.50 wording.
- **L-10.** The fix log says that removing the M-2 filter makes "the two M-2 incident tests" fail. In fact three tests fail (the conversion test as well). This understates the proof; it does not change it.

## 3. Fix-log entries checked

| Entry | Diff does what it says | Test fails without the fix | Notes |
|---|---|---|---|
| M-1 (`f24ab2d`) | Yes: `convertIfNeeded` treats a journal as "not finished"; `convertRecord` with `parties: TOKEN` and a journal only runs `finishCleanup` | Yes. Both halves reverted: 2 of 7 fail. Only `convertIfNeeded` reverted: the revoke test fails. Only the `convertRecord` guard reverted: the "only cleans up" test fails | `finishCleanup` deletes superseded snapshots as a reseal does (`ledger.ts:548`). M-5 |
| M-2 (`f24ab2d`) | Yes: `register` adds an account not in the map only when `isActiveUser` is `true`; used for incidents and conversions; seal and revoke callers are signed in | Yes: 3 of 7 fail with the filter removed | L-8, L-10 |
| L-2 (`f24ab2d`) | Yes | Yes: 1 of 7 fails | |
| L-1, L-7 verifier 1.2.0 (`6ac7045`) | Yes: fifth check; Apache-2.0 header on the workflow; spec v3 section 11 and the evidence steps name it | Yes: with master's `tools/verifier`, the new `evidence.test.ts` test fails | |
| M-4 (`7cbda07`) | Yes: the decided text, character for character, in the listing (line 52), the notes (section 5 item 1) and `site/apps/ledgerseal/compliance-mapping.md`; all four panel labels say "a deleted user" | Yes: with master's listing, notes and `index.tsx`, 4 of 16 fail; with master's `index.tsx` only, or one "Signed by" label set back, the label test fails | L-9, M-6 |
| L-3 (`7cbda07`) | Yes: 1, 2, 3 | Yes (in the 4 above) | |
| L-5 (`7cbda07`) | Yes, admin guide | n/a (docs) | User-guide text is in the owner's site list, item 17 |
| L-4 (`7f6dce8`) | Yes: screenshot 03 viewed, real capture of LSP-5, no test title, 1840 x 900 | `listing.test.ts` | |
| L-6 | Owner site list item 18 (privacy text) | n/a | Not in this repository |

Could not confirm: the live checks in the log (verifier 1.2.0 on PAY-10, PAY-13, LSP-3; gate on LSP-5); they were not re-run. `isActiveUser` was not called live (see the header).

## 4. Public verifier

`asymmsystems/ledgerseal-verifier` `main` = `67776e4` = tag `v1.2.0`. `diff -r` against `tools/verifier` on the branch: empty. The Apache-2.0 header is present on `verify-evidence.mjs`, `test/verify.test.mjs` and `.github/workflows/test.yml`. The fifth check (`verify-evidence.mjs:83-86`) maps LS_SEALED, LS_CHANGED and LS_REVOKED to SEAL_VALID, SEAL_BROKEN and SEAL_REVOKED, and compares the result with `attestation.status` for the newest entry that is not LS_REDACTED. The app's export takes the status from the stored `currentStatusId` and the history up to the stored head, so they agree. Release assets: `sha256sum -c SHA256SUMS` OK for all four files, and `verify-evidence.mjs`, `vectors.json`, `LICENSE` and the key are byte-identical to the repository. The four sums equal those in the fix log. CI: run 42196616081 (pull request) and run 42196827209 (push to `main`) on `67776e4`, both successful. I did not push to the verifier repository.

## 5. Gate

| Check | Branch head `7f6dce8` | Merge result |
|---|---|---|
| `npm ci` (shared UI package, then the app) | exit 0 | exit 0 |
| `npx tsc --noEmit` | 0 errors | 0 errors |
| `npm test -- --coverage` | 47 suites, 497 tests pass; statements 97.86%, branches 94.33%, functions 96.69%, lines 98.63% | same |
| `npm run build` | exit 0 | exit 0 |
| `npm audit --omit=dev --audit-level=high` | exit 0 | exit 0 |
| `forge lint` | No issues found | No issues found |
| `git status` | clean | clean |
| `tools/verifier` `node --test` | 12 of 12 | 12 of 12 |

Apps CI on the branch head `7f6dce8`: run 42198883247, success. The merge onto `494e68c` had no conflicts. It changes only LedgerSeal files, the shared docs and `tools/verifier`.
