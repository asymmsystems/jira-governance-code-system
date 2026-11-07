# Safe error logging merge review

- Date: 2026-11-08. Reviewer: independent merge review session.
- Branch: `feature/safe-error-logging` at `88be6e9` (one commit, 29 files), cut from master `fd52e8b`. Merged onto master `a66c172` without conflict; the commits since `fd52e8b` touch only docs. The merge result's `apps/`, `packages/` and `.github/` equal the branch.
- Change:
  - every caught-error log line in all four apps writes a fixed place name plus the error's name, code and status;
  - 16 frontend sites (CascadePlan 9, LedgerSeal 7) go through the same helper;
  - new `test/log-safety.test.ts` per app, and a shared source rule `test/support/console-rule.ts`;
  - the CascadePlan bundle is rebuilt;
  - Q8 is updated in the four questionnaires.
- This closes L-49, L-51 and L-65.
- Outputs, not committed: `jira-governance/repository/tmp/review-safe-logging-out/` (`gate.txt`, `mutate.py`, `mutations.txt`).
- Nothing deployed by this review. The coordinator reports dev deploys CP 3.19.0, DG 7.2.0, LS 5.6.0 and FR 5.4.0. No scope change, so the production deploys are minor versions.

## 1. Verdict

**Merge.**
- No log line in `apps/*/src` can carry user data or issue content.
- The rule and the behaviour tests catch every unsafe form I tried, including two the source rule cannot see by itself.
- The gate passes, and behaviour is otherwise unchanged.
- The Q8 answers are true for all four apps.

No finding.

## 2. Every log line in `apps/*/src`

`git grep "console.(log|error|warn|info|debug|trace)"` on the branch gives 23 calls:
- **The four helpers.** CascadePlan `logger.ts` `logFailure`, DefinitionGuard `log.ts` `logFailure`, LedgerSeal `service/log.ts` `logFailure`, and FourRealities `index.ts:188` with `errorSummary`. Each writes a fixed place and `name`, `code` and `status` only: a name or a code is kept only when it is a plain identifier, and the message, stack and object never.
- **The other lines** write fixed text, counts or a variable name (DefinitionGuard `${missing}`). Some also name an issue by id or key:
  - LedgerSeal numeric issue ids (`index.ts:308`, `jira-client.ts:176`, `ledger.ts:238`, `:240`, `:1006`);
  - the CascadePlan issue-deleted line, with the deleted issue's key (`tasks.ts:544`);
  - FourRealities `JSON.stringify` of `ScheduledRunResult` (project keys and counts) and of `PersonalDataRunResult` (three counts).

  Ids and keys identify an issue; they hold no user data and no issue content. The questionnaires list them.
- **Place names given to `logFailure`.** All are literal text from the code:
  - DefinitionGuard frontend `action`: "load the checklist", "save the change", "reset the checklist", "waive the item", "load the evidence", "load the history", "export the history";
  - CascadePlan `resolver ${fnName}`: the resolver's own key.

## 3. Mutations (each applied alone; that app's `log-safety.test.ts` run)

| App | Mutation | Tests failing |
|---|---|---|
| LedgerSeal | `errorSummary` appends the message | 15 |
| LedgerSeal | a frontend site back to `console.error(..., err)` | 3 |
| LedgerSeal | the message put in a variable, then logged | 2 |
| LedgerSeal | the message put into the `logFailure` place text | 1 |
| LedgerSeal | `console.error(JSON.stringify(err))` | 3 |
| LedgerSeal | a `console` alias (`const c = console`) | 3 |
| LedgerSeal | a bracket call (`console['error']`) | 3 |
| DefinitionGuard | the issue-deleted line back to `${err.message}` | 2 |
| FourRealities | the personal data line back to `err.message` | 3 |
| CascadePlan | `failureSummary` keeps any error name | 1 |
| CascadePlan | a `legacy-planner.js` site back to `console.error(..., err)` (the rule reads `.js` too) | 3 |

All 11 caught. The source rule reads only `console` calls, so it cannot see the message in a variable or in a `logFailure` place text. The behaviour tests catch both: they make each failure place throw an error with a secret in its message and check the log output.

The rule's stated scope is errors. A `console` call given other user data, for example an issue summary, would pass the rule. No such call exists today (section 2).

## 4. Behaviour

- **Gate on the branch** (shared package installed first):

  | App | `tsc` | `npm test` | build |
  |---|---|---|---|
  | LedgerSeal | 0 errors | 52 suites, 587 tests | exit 0 |
  | DefinitionGuard | 0 errors | 36 suites, 493 tests | exit 0 |
  | FourRealities | 0 errors | 48 suites, 576 tests | exit 0 |
  | CascadePlan | 0 errors | 86 suites, 1,001 tests | exit 0 |

  The rebuilt CascadePlan bundle equals the committed one.
- **CI** on `88be6e9`: Apps CI 42404780025, FSRT 42404780055 and SAST 42404780323 all succeeded.
- **The only change in what the apps do** is the log text, plus the level of four CascadePlan browser lines (`console.error` becomes `console.warn` through `logFailure`). No control flow, return value or message to the user changed.

## 5. Questionnaire Q8

| App | Claim | Result |
|---|---|---|
| CascadePlan | `logFailure` 30 call sites (backend); frontend lines through `logFailure`; the issue-deleted key; job counts | 30 backend and 9 frontend `logFailure(` calls; the other lines as section 2 |
| DefinitionGuard | the three backend failure places through `logFailure`; resolver errors thrown to Forge can hold an issue key and an item id | Match (`issue-deleted.ts`, `personal-data.ts` twice) |
| FourRealities | four backend lines, all in `src/index.ts`; no frontend `console` call | Match (`index.ts:167`, `171`, `186`, `188`) |
| LedgerSeal | numeric ids, counts, fixed texts; `logFailure` for failures, frontend included | Match |

`test/support/console-rule.ts` is byte-identical in all four apps (one SHA-256).
