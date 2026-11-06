# Security questionnaires merge review

- Date: 2026-11-06. Reviewer: independent merge review session.
- Branch: `feature/security-questionnaires` at `ac33731` (two commits, `2b5907c` and `ac33731`), cut from master `bda60e4`. Merged onto master `f60c7bd`, with one reviewer commit on top (`532d6b9`).
- Change: the Forge security questionnaire answers for CascadePlan (rewritten), DefinitionGuard (new) and FourRealities (new). All under `docs/marketplace/submission/`. The LedgerSeal file came to master with `696c763`.
- Scope as asked:
  - Check the CascadePlan file against production code `c8be4c9`, and fix L-39 and L-40 (from `ledgerseal-permission-checks-merge-review.md`) where they apply.
  - Check only that the DefinitionGuard and FourRealities files do no harm. `feature/definitionguard-permission-checks` and `feature/fourrealities-permission-checks` replace them.

## 1. Verdict

**Merge.** The CascadePlan answers are true for `c8be4c9`, and `apps/cascadeplan` has not changed since. L-40 applied to CascadePlan, and I fixed it. L-39 does not apply. The DefinitionGuard and FourRealities files describe production 2.0.0 and list its gaps as open issues, so they do no harm until the two branches replace them.

## 2. CascadePlan against `c8be4c9`

| Answer | Check | Result |
|---|---|---|
| Header: no app change since `c8be4c9` | `git diff --stat c8be4c9 origin/master -- apps/cascadeplan` | Empty, on master `f60c7bd` too |
| Q3: no `asApp()` in practice | `git grep "asApp\|asUser" c8be4c9 -- apps/cascadeplan/src` (backend) | One `asApp`, the fallback in `getJiraCaller` (`src/server/core.ts:148`) after `asUser` is a function. Every other call is `asUser` (`policy-admin.ts`, `write-permissions.ts`). |
| Q2, Q4 to Q6 | `manifest.yml` | No `remotes`, `external`, `webtrigger` or `displayConditions`. Runtime `nodejs22.x`. |
| Q7 | `manifest.yml` scopes | `read:jira-work`, `write:jira-work`, `read:jira-user`, `storage:app`, `report:personal-data`, as listed |
| Q8 | every backend `console.*` | Three lines, as section 2.2 lists: `logFailure` (`src/logger.ts`), `issueDeleted` (`src/server/tasks.ts:544`), `personalDataTrigger` (`src/server/baselines.ts:261`). All 30 `logFailure` call sites pass fixed text as the place. `logFailure` writes an HTTP status, or an error's `name` and `code`, never its message. |
| Q13 | `process.env` in `src/` | Only `NODE_ENV` (`core.ts:107`) and `JIRA_BASE_URL` (`plan-read.ts:194`), as stated |
| Q10 | evidence | See L-40 below |

## 3. L-39 and L-40

- **L-39** (`git log -S` evidence that matches the questionnaire itself): does not apply. The CascadePlan question 13 cites `forge variables list` and a `process.env` search, not a history search.
- **L-40** (dated CI evidence): applied. Question 10 cited run 42242271357 on `1709054` "(no app change since)". LedgerSeal changed at `696c763`, so the sentence was no longer true. Reviewer commit `532d6b9` cites Apps CI run 42250544524 on `f16ab2e`: job "app (cascadeplan)", step "Dependency audit (production, high and critical)" success, "7 moderate severity vulnerabilities" in its log. It also asks for the latest run to be checked again before submission.
- In the same commit, question 16 no longer says that `site/vendor-security-assessment.md` gives 24 hours. Since `b922b18` it gives 72 hours, as the compliance page does. This is L-43 of `signing-key-rotation-merge-review.md`, for CascadePlan. The LedgerSeal file still has the old note; see section 4.

## 4. Findings

### Critical, High, Medium

None.

### Low

- **L-48. The LedgerSeal questionnaire still has L-39, L-40 and L-43** (`ledgerseal-security-questionnaires.md` questions 13, 10 and 16). That file is not in this branch, so I did not change it.

### Considered, no finding

- DefinitionGuard and FourRealities files: they describe production 2.0.0 (`c8be4c9`), and state the blocking gaps of question 3 as open issues ("Yes, except the one read in Open issue 1"; "partly for the dashboard"). Nothing in them claims more than the code does. The next two branches replace them.

## 5. Gate

| Check | Result |
|---|---|
| Changed files | Three files in `docs/marketplace/submission/` only |
| `apps/`, `packages/`, `.github/` | Unchanged; the merge result's app tree equals master `f60c7bd` |
| Em or en dashes in added lines | None |
