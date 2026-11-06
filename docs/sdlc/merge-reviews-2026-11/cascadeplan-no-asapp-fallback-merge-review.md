# CascadePlan no asApp fallback merge review

- Date: 2026-11-07. Reviewer: independent merge review session.
- Branch: `feature/cascadeplan-no-asapp-fallback` at `527940d` (one commit), cut from master `d1e7127`. Master had not moved, so the merge result has the same tree as `527940d`.
- Change:
  - `getJiraCaller` (`apps/cascadeplan/src/server/core.ts`) returns `withRetry(api.asUser())`, and throws when `api.asUser` is not a function, instead of falling back to `api.asApp()`;
  - new tests in `test/reads-as-user.test.ts`, and an updated test in `test/index.test.ts`;
  - questionnaire question 3 and section 2.1 (`cascadeplan-security-questionnaires.md`).
- Output and scripts, not committed: `/home/fahimfarookme/Documents/projects/jira-governance/.tmp/cache/merge-review/cascadeplan-no-asapp/`.
- Nothing deployed by this review. `forge lint -e production` reports no approval, so this is a minor version.

## 1. Verdict

**Merge.** No production path can reach the throw, the gate passes, and the tests fail without the change. No finding.

## 2. Can a production path hit the throw?

- **The condition.** The throw depends only on `typeof api.asUser !== 'function'`. In the Forge runtime `api.asUser` is always a function, in resolvers and in triggers. So production behaviour equals the old code's: the old code took the `asUser` branch for the same reason. The throw replaces a fallback that was never reached.
- **Entry points** (`manifest.yml`):

  | Module | Function | Calls Jira? |
  |---|---|---|
  | `jira:projectPage` `cascadeplan-project-planner` | `index.handler` | Yes, as the user who opened the planner |
  | `jira:adminPage` `cascadeplan-admin` | `index.adminHandler` | Yes, as the admin who opened the page (`policy-admin.ts`, direct `api.asUser()` calls) |
  | `trigger` `issue-deleted` (`avi:jira:deleted:issue`) | `issueDeletedTrigger` to `issueDeleted` (`src/server/tasks.ts`) | No. `issueDeleted` builds a target from the event and calls `deleteIssueRecords`, which reads and deletes app storage only. |
  | `scheduledTrigger` `personal-data-report` | `personalDataTrigger` to `reportPersonalData` to `runPersonalDataJob` (`src/storage/personal-data.ts`) | No. Storage, `eraseClosedAccounts` (`baseline-store.ts`) and `privacy.reportPersonalData` only. Neither file has a `requestJira` or a `getJiraCaller`. |
  | `jira:entityProperty` `cascadeplan-create-id` | none (a JQL index of `cascadeplan.create`) | not code |

- Every `getJiraCaller()` call site is in `src/server/` (`core.ts`, `hierarchy.ts`, `jira-read.ts`, `jira-write.ts`, `tasks.ts`), reached only from the planner resolvers.
- `git grep asApp apps/cascadeplan/src` finds nothing.

## 3. Tests fail without the change

- With `src/server/core.ts` from `d1e7127` put back, 3 of 137 tests in `reads-as-user.test.ts` and `index.test.ts` fail:
  - "no source file names asApp";
  - "getJiraCaller fails, and does not fall back to asApp, without a user context";
  - "getJiraCaller fails clearly, and never uses asApp, when asUser is not available".
- The two trigger tests run with `asUser` removed. On their own that would prove little, so I added a `getJiraCaller().requestJira(...)` to each trigger in turn:
  - in `issueDeleted`, 1 test fails;
  - in `personalDataTrigger`, before the job, 1 test fails ("the personal data report works without a user and makes no Jira call").

  Both tests catch a Jira call in their trigger.

## 4. Questionnaire

Question 3 and section 2.1 now say "`asUser` only", with no `asApp` fallback, which is true for this code. They also say that a production build made before this branch had an unreached fallback line, which is true for 2.0.0 (`c8be4c9`).

## 5. Gate

| Check | Branch `527940d` (equals the merge result) |
|---|---|
| `npm ci` (shared package, app, `tools`) | exit 0 |
| `npx tsc --noEmit` | 0 errors |
| `npm test` (jest with coverage) | 85 suites, 987 tests pass; statements 96.91%, branches 90.9%, functions 94.6%, lines 98.54% |
| `npm run build`, then compare the UI bundle | exit 0; `static/` unchanged |
| `npm audit --omit=dev --audit-level=high` | exit 0 (7 moderate) |
| `forge lint`, `forge lint -e production` | No issues found (minor version) |
| CI | Apps CI 42276723778 and FSRT 42276723619 on `527940d`: success |
