# LedgerSeal restricted work logs merge review

- Date: 2026-11-06. Reviewer: independent merge review session (not the session that wrote the fix).
- Branch: `feature/ledgerseal-restricted-worklogs` at `2579ec2`, cut from master `b877067`, which is still the master head. Commits: `a90d952` (code and 9 tests), `756279e` (docs), `2579ec2` (fix log).
- Finding fixed: M-11 of `docs/sdlc/merge-reviews-2026-11/ledgerseal-finish-merge-review.md` (round 3). A restricted work log's comment text was exported to any viewer.
- Decision: fail closed, the same rule as for comments. This was passed to me by the coordinating session as the suite owner's decision. It is recorded as such in spec v3 section 4.4 and in the fix log. I did not see it from the owner directly.
- Read: the M-11 entry of `docs/sdlc/ledgerseal-marketplace-fixes-2026-11/progress-log.md`, the full diff (11 files), `checkSealedWorklogs` and `evidenceFlow` in `apps/ledgerseal/src/service/ledger.ts`, `restrictedItems`, `specialValue` and `displayValue` in `src/domain/canonicalizer.ts`, `pages` and `visibleIds` in `src/jira/jira-client.ts`, and the field diff in `src/domain/tamper-detector.ts`.
- Probes and scripts (not committed), in `/home/fahimfarookme/.cache/jira-suite-merge-review/ledgerseal-restricted-worklogs/`: `probes/zz-probe-r3-worklog.test.ts` (P5, unchanged from the finish review), `scripts/mutate.py` with `mutation-results.txt` (10 mutations), `new-tests-at-master.txt`, `scripts/gate.sh` with `gate-branch-2579ec2.txt` and `gate-merge.txt`.
- Clone: `/home/fahimfarookme/Documents/projects/gemini-earning-cp-fixes/.tmp/review-ls-finish`. Every mutation and probe was undone.
- No live check, no deploy, no change to any Jira site.

## 1. Verdict

**Merge.** No Critical, High or Medium finding remains.
- The export now refuses a viewer who cannot see a covered restricted work log, and it refuses everyone when the app can no longer read a covered work log.
- My probe P5 gets `RESTRICTED_EVIDENCE` with no work log text.
- Every guard is load-bearing.
- A seal with no covered work logs makes no extra Jira call.
- No other path shows work log text.

## 2. Findings

### Critical

None.

### High

None.

### Medium

None.

### Low

- **L-23. The fix log's "5 of the 9 tests fail" is one valid count of several.** That figure reverts `ledger.ts` alone. I reverted `ledger.ts` and `canonicalizer.ts` to `b877067` and kept the new client and model so that the test file compiles. Then 7 of 9 fail by assertion. The 2 that still pass are the paging regression guard and the client test, and both use code that the fix also kept. The fix log also states that the whole `src` of `b877067` does not compile with the new tests, which is right. This is not a false claim.

## 3. Checks asked by the coordinator

| Check | Result |
|---|---|
| New tests fail on master and pass at the head | Yes. With `ledger.ts` and `canonicalizer.ts` of `b877067`, 7 of 9 fail by assertion (`new-tests-at-master.txt`). With all of `src` of `b877067`, the file does not compile (`restrictedWorklogs`, `getVisibleWorklogIds` missing). At `2579ec2`, 9 of 9 pass. |
| P5 refused | Yes: "P5 export leaks: false RESTRICTED_EVIDENCE"; panel: no leak, SEAL_BROKEN. At `b877067` the same probe gave the full export with the text. |
| Each guard load-bearing | Yes, 10 of 10 mutations fail at least one test by assertion (table below). |
| No other path exports work log text | Yes (section 4). |
| No extra Jira call when no work logs are covered | Yes: `checkSealedWorklogs` returns before any read when the sealed `worklog` value has no entries (`ledger.ts:918-919`). The test sets both work log reads to fail on such a seal, and the export still succeeds. Mutation W6 (early return removed) fails that test. A seal with only open work logs makes one read as the app (`getWorklogs`) and no read as the user. |
| Full gate | Passes (section 5). |

Mutations (`mutation-results.txt`, full suite of 547 tests each):

| Guard removed | Tests failing |
|---|---|
| W1 refusal when a sealed work log is missing from the app's read | 1 ("can no longer read stops the export for everyone") |
| W2 restricted-now part | 2 (restricted later; seal made before M-11) |
| W3 recorded-at-seal part | 1 (restricted at the seal while the live read shows no restriction) |
| W4 viewer-list check | 4 (P5 and three others) |
| W5 the export no longer calls the check | 6 |
| W6 early return when no work logs are covered | 1 (no reads when none are covered) |
| W7 failed app read not fail-closed | 1 |
| W8 failed viewer read not fail-closed | 1 |
| W9 canonicalizer records no restricted work logs | 2 |
| W10 visible ids read as the app instead of the user | 2 (comment and work log client tests) |

## 4. Other paths to work log text

| Path | Result |
|---|---|
| Panel change list | The work log field's display text is "N work log entries" (`canonicalizer.ts:292`), and the tamper detector shows display text for a non-document value (`tamper-detector.ts`, `shown`). `richTextSummary` returns null for a non-document value, so there is no `detail`. Probe P5: no text in the panel. |
| History rows (panel and export) | `LS_CHANGED` rows hold `fieldId`, `fieldName`, party tokens and `changedAt` only. |
| Context entry | Same resolver as the panel; shows the lozenge, the status sentence and a fixed hint. |
| `ledgerseal-cert` property | Hashes, ids and counts only. |
| Workflow validator | Field names only. |
| Older canonical forms | `specialValue` gives the work log value as an array of `{ id, ... }` for every version (no version gate), so `checkSealedWorklogs` finds the sealed ids on every snapshot that holds work log text. |
| Work logs the app cannot read at the seal | Not in the snapshot, so not exported (stated in the docs). |

## 5. Gate

| Check | Branch head `2579ec2` | Merge result |
|---|---|---|
| `npm ci` (shared UI package, then the app) | exit 0 | exit 0 |
| `npx tsc --noEmit` | 0 errors | 0 errors |
| `npm test -- --coverage` | 50 suites, 547 tests pass; statements 98.09%, branches 94.19%, functions 97.12%, lines 98.73% | same |
| `npm run build` | exit 0 | exit 0 |
| `npm audit --omit=dev --audit-level=high` | exit 0 | exit 0 |
| `npx --yes @forge/cli@15.0.0 lint` | No issues found | No issues found |
| `git status` | clean | clean |
| `tools/verifier` `node --test` | not run | 12 of 12 |
| Em or en dashes in changed files | none | none |
| Copyright header and `@author` in the new test file | present | present |

Apps CI: run 42237935620 (push, `2579ec2`) success. The fix-log gate numbers (50 suites, 547 tests, coverage) match mine.

Could not confirm (live): the development 5.4.0 deploy and the PAY-10 export with 5 of 5 PASS.

## 6. Merge

Merged `--no-ff` into `master` as `320573d` (parents `b877067` and `2579ec2`). Master had not moved, so there was no conflict, and the merge tree equals the branch head. The gate on the merge result is in section 5. This report is committed after the merge.
