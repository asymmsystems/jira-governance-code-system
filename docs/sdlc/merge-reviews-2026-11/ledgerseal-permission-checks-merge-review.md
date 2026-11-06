# LedgerSeal permission checks merge review

- Date: 2026-11-06. Reviewer: independent merge review session.
- Branch: `feature/ledgerseal-permission-checks` at `35d23b8`, cut from master `6c19fa4`. Four commits:
  - `90522f7`: Q8, failure log lines.
  - `cfe2cba`: Q3, Browse check.
  - `8e44b40` and `35d23b8`: the questionnaire file.
- Purpose: make the answers to questions 3 and 8 of the Marketplace Forge app security questionnaire true for LedgerSeal.
- Read: the full source diff (`src/service/ledger.ts`, `src/jira/jira-client.ts`, `src/service/log.ts`, `src/index.ts`, `src/service/conversion.ts`, `src/frontend/view-model.ts`), `src/service/policy-admin.ts`, the validator and trigger entry points in `src/index.ts`, `manifest.yml`, the two new test files and the fake changes, `docs/marketplace/submission/ledgerseal-security-questionnaires.md` and the new progress log section.
- Gate output and mutation script (not committed): `/home/fahimfarookme/.cache/jira-suite-merge-review/ledgerseal-permission-checks/` (`gate-branch.txt`, `mutations.txt`, `mutate.py`).
- **No live check.** The fixing session's live run (`evidence_check.py PAY-10`) stopped at the Atlassian login page, because the saved Jira session cookie had expired. I did not run one either. The development deploy 5.5.0 is not proven on a real site. Owner action: refresh the cookie file, then run `evidence_check.py PAY-10` and one call as a user without Browse projects.
- Nothing deployed by this review.

## 1. Verdict

**Merge.**
- Every resolver that reads issue data as the app now checks Browse projects as the user first, and fails closed. The admin resolvers, the validator and the triggers are rightly exempt.
- No backend log line can carry an error message or issue content.
- The gate passes, and every check that guards Q3 or Q8 is pinned by a test.

Three Low findings stay open (section 4).

## 2. Q3: every resolver and trigger

| Entry point (manifest) | Reads or writes as the app | Check before the first app call | Result |
|---|---|---|---|
| `verify-issue-api` (panel and `ledgerseal-context`) | issue, comments, work logs, change log, users; KVS; may write the property | `browseDenied` | Covered |
| `seal-issue-api` | as verify, plus KVS writes and `putSealProperty` | `browseDenied`, then `isApprover` | Covered |
| `revoke-seal-api` | KVS writes, `putSealProperty` | `browseDenied`, then `isApprover` | Covered |
| `seal-history-api` | KVS (the stored record) | `browseDenied` | Covered |
| `seal-evidence-api` | KVS, issue reads for restricted items | `browseDenied` | Covered |
| `approver-policy-get-api`, `approver-policy-set-api`, `approver-group-search-api` | KVS policy; group calls run as the user | `adminCaller`: `isJiraAdmin` as the user (`mypermissions?permissions=ADMINISTER`) before anything | Rightly exempt: no issue data, and a global admin check first |
| `validate-transition` | issue reads, KVS, property | none | Rightly exempt: Jira calls it inside a transition that Jira has already authorised; `forgeDeps(false)` gives it no user client |
| `on-issue-changed`, `on-issue-deleted`, `personal-data-report` | issue reads, KVS, property | none | Rightly exempt: product events and a scheduled job, no calling user, nothing returned to a user |

In each of the five issue flows, only `accountId`, licence, `contextIssue` (from the Forge context, never the payload) and payload checks come before `browseDenied`. None of them reads Jira or KVS. `canBrowseIssue` calls `GET /rest/api/3/mypermissions?issueId=<id>&permissions=BROWSE_PROJECTS` as the user and counts only `havePermission === true`. 403 and 404 map to `NO_BROWSE_PERMISSION`; every other failure maps to `JIRA_UNREACHABLE`.

## 3. Mutations (each applied alone; the three affected test files run)

| Mutation | Result |
|---|---|
| Remove the Browse check from seal, verify, history, evidence, revoke (5 mutations) | Each caught: 3 tests fail |
| `browseDenied` ignores a refusal / passes a failed check / maps 403 and 404 to `JIRA_UNREACHABLE` | Each caught: 5 tests fail |
| `canBrowseIssue` counts anything but `false` as allowed / asks as the app | Each caught: 1 test fails |
| Revert each of the 7 `logFailure` calls to `console.error(..., err)` | Each caught: 1 or 2 tests fail |
| `errorSummary` appends the error message | Caught: 9 tests fail |
| History reads KVS before the Browse check | **Not caught** (L-38) |
| Seal runs `isApprover` (as-user calls and a KVS policy read) before the Browse check | **Not caught** (L-38) |

## 4. Findings

### Critical, High, Medium

None.

### Low

- **L-38. The tests do not pin the order of KVS reads against the Browse check.** The code is right today. But `test/permission-checks.test.ts` spies only on Jira app calls and KVS writes. So a later change that reads KVS, or runs the approver check, before `browseDenied` would pass every test. Neither change would break question 3, which is about `asApp()` Jira calls. But the questionnaire (Open issue 1, question 3) says "it reads nothing as the app", and the tests prove only "no Jira read as the app and no storage write". Suggested fix: count `storage.get` and `storage.query` calls in the refusal test, and expect `jira.browseChecks` to be called before `hasApproverPermission`.
- **L-39. The question 13 evidence is no longer true.** The answer says `git log --all -S"BEGIN PRIVATE KEY"` "finds nothing". Since `8e44b40` it finds that commit, because the questionnaire quotes the string itself (`ledgerseal-security-questionnaires.md:36`). `git grep "BEGIN PRIVATE KEY"` on master finds only that line. No key is in the repository. Suggested evidence: `git log --all -G'^-----BEGIN PRIVATE KEY-----$'`, which matches only a real key line. This review's clone has 482 commits, not 474.
- **L-40. The question 10 evidence is dated.** It cites Apps CI run 42242271357 on `1709054` ("no app change since"). This merge is an app change. The latest run is 42249374853 on `35d23b8`, which passed. My local `npm audit --omit=dev --audit-level=high` on `35d23b8` exits 0. Update the run id before the owner submits.

### Checked, no finding

- Q8: every backend `console.*` call in `src/` is in section 2.2. Their arguments are numeric issue ids, counts, constant list names and fixed texts. The seven failure lines go through `logFailure` with name, code and status only, and a name or code that is not a plain identifier is dropped. The three `throw new Error` texts in `src/` hold no issue content. The `src/frontend/` `console.error` calls run in the viewer's browser.
- Questionnaire facts I confirmed in code:
  - Scopes and the `nodejs22.x` runtime (`manifest.yml`).
  - No `remotes`, `external`, `webtrigger` or `displayConditions`.
  - Every as-user method is the one listed in section 2.1, and `forgeDeps(false)` gives the validator and triggers no user client.
  - `viewHash` refuses a stale seal (`ledger.ts:437`), and `fromSeq` is clamped (`ledger.ts:846`).
  - Every request path goes through `route`.
  - `git diff --stat fc8ca40 6c19fa4 -- apps/ledgerseal packages` shows only `test/listing.test.ts`.
- Not checked: production version 3.0.0 and the `forge variables list` output (no console access), and questions 14 to 18 (owner to confirm).

## 5. Gate

| Check | Branch `35d23b8` (equals the merge result tree) |
|---|---|
| `npm ci` (shared package, then app) | exit 0 |
| `npx tsc --noEmit` | 0 errors |
| `npm test` (jest with coverage) | 52 suites, 575 tests pass; statements 98.22%, branches 94.33%, functions 97.15%, lines 98.86% |
| `npm run build` | exit 0 |
| `npm audit --omit=dev --audit-level=high` | exit 0 |
| `forge lint` | No issues found |
| Apps CI | run 42249374853 on `35d23b8`: success |
| Live check | not run (expired Jira session cookie) |

Master was still `6c19fa4` at merge, so the merge result has the same tree as `35d23b8`.
