# CascadePlan: answers for the Marketplace security questionnaires (MK-02)

Answers for the owner to enter in the Developer Console. Nothing here has been submitted. Each answer names the code or the check that makes it true, so it can be checked again before submission.

- Question wording: the live "Forge" tab of the Forge app security questionnaire, as read from ECOHELP-182619 on 2026-11-06 (19 questions). The older numbering (Q1a, Q3, Q7 to Q13) from `docs/sdlc/cascadeplan-marketplace-review-2026-11/marketplace-research.md` section A.c (C1 to C11) is kept only as a cross-reference in the last column.
- Production build: CascadePlan 2.0.0 was built from commit `c8be4c9`. `git diff --stat c8be4c9 origin/master -- apps/cascadeplan` is empty, so `src/`, `manifest.yml`, `package.json` and `package-lock.json` are the same on master (`bda60e4`, 2026-11-06). Every answer below is true for both commits.
- The "Security Self-Assessment" of the old checklist is retired (Atlassian ended it on 13 August 2023, research C10). The current gates are: the Forge app security questionnaire (it has blocking items), the partner security questionnaire (information only), partner identity verification, a vulnerability scan, and the Privacy & Security tab.

---

## Open issues

None of these makes a blocking answer false. They are listed so that no answer below claims more than the code does.

1. **Question 9 (input validation), partial.** Most resolver payloads are checked by the app (section 2.3). Some fields of the create resolvers are passed to Jira without an app-side type or length check: `summary` in `createJiraEpic` (`src/server/create.ts`); `epicKey`, `parentKey`, `epic`, `story`, `resource`, `resourceAccountId` and `assigneeAccountId` in `createInlineTask`; `resource`, `assigneeName` and `assigneeAccountId` in `createSubtaskForResource`. Jira validates them, because every one of these calls runs as the user (`asUser`) and sends a JSON body. `effortConfig` in `validateTaskUpdates` (`src/validation.ts`) is checked only to be an object. In `setApproverPolicyFlow` (`src/security/policy-admin.ts`) each group id is converted to text with no length or character limit; only a Jira administrator can call it. Recommended fix: add the same `assertIssueKey`, `text()` and account-id checks used elsewhere in `src/validation.ts`.
2. **Question 8 (logs): the earlier draft was wrong.** It said "the only log call" is `logFailure`. There are two more backend log lines: the issue-deleted trigger logs the deleted issue's key (`issueDeleted`, `src/server/tasks.ts`), and the personal data job logs counts (`personalDataTrigger`, `src/server/baselines.ts`). Neither is PII, a credential or a token, so the answer stays "No". The text below is corrected.

---

## 1. Forge app security questionnaire (live wording, 19 questions)

| # | Question (short) | Answer | Justification and evidence | Old Q |
|---|---|---|---|---|
| 1 | Does the app include user interactions? | Yes | A project page (planner, Custom UI) and an admin page (UI Kit). `manifest.yml` modules `jira:projectPage` `cascadeplan-project-planner` and `jira:adminPage` `cascadeplan-admin`. Every Jira REST call made for a user runs as that user (`asUser`): `getJiraCaller` in `src/server/core.ts`; the admin calls in `src/security/policy-admin.ts`; the permission check in `src/security/write-permissions.ts`. | Q1a |
| 2 | Does the app use Forge remote? | No | `manifest.yml` has no `remotes` and no `endpoint`. | |
| 3 | Before `asApp()` calls on actions that need user permissions, do you check the user's permissions with the permissions REST APIs? | N/A (the app makes no `asApp()` call) | `getJiraCaller` (`src/server/core.ts`) returns `api.asUser()`; without a user context it throws, and it has no `asApp()` fallback. Every other Jira call in `src/` is `api.asUser()`. No file in `src/` names `asApp` (`grep -rn "asApp" apps/cascadeplan/src`: no hit), and `test/reads-as-user.test.ts` fails if one does. The fallback was removed on branch `feature/cascadeplan-no-asapp-fallback`; a production build made before it has an `api.asApp()` fallback line that the Forge runtime never reaches, because `asUser` is always a function there. The two triggers make no Jira REST call: `issueDeleted` (`src/server/tasks.ts`) deletes app storage only; `personalDataTrigger` (`src/server/baselines.ts`) uses the Forge storage and the personal data reporting API only. In addition, before any write the app checks the user's own Jira permissions on every issue it will change, with `POST /rest/api/3/permissions/check` as the user (`jiraPermissionChecker`, `requireIssuePermissions` in `src/security/write-permissions.ts`; Edit, Schedule, Link, Create, Move issues; global "Make bulk changes" for a type conversion, `src/server/hierarchy.ts`). A failed check refuses the write (`PermissionCheckError`). Plan management and baselines need a plan approver, checked on the server for every call (`isPlanApprover`, `src/security/policy-admin.ts`; the rule table `RESOLVER_RULES` and `define` in `src/index.ts` refuse to register a resolver without a rule). Admin resolvers check global Administer Jira first (`isJiraAdmin`). If the console does not offer N/A, answer "Yes" with this text. | Q3 (blocking) |
| 4 | Does the app use web triggers? | No | `manifest.yml` has no `webtrigger` module. | |
| 5 | Does the app use display conditions? | No | No `displayConditions` in `manifest.yml`. The planner checks permissions on the server instead (question 3). | |
| 6 | Does the app egress data to external hosts? | No | `manifest.yml` has no `permissions.external` and no `remotes`. The backend calls only Jira REST of the customer's site (`requestJira`). The Custom UI planner loads only its own bundle (`static/frontend/build`); the manifest declares no `permissions.content` or external sources. | |
| 7 | Least privilege? | Yes | Five scopes, each used: `read:jira-work` (issue and search reads, `src/server/jira-read.ts`), `write:jira-work` (issue edits, creates, links, the `cascadeplan.*` issue properties, `src/server/jira-write.ts`, `src/server/create.ts`), `read:jira-user` (assignable users, `fetchProjectUsers`; groups, `src/security/policy-admin.ts`), `storage:app`, `report:personal-data` (`src/storage/personal-data.ts`). Scope justification per scope: `cascadeplan-submission-notes.md` section 1. | Q7 |
| 8 | Does the app log sensitive information (PII, credentials, tokens, keys)? | No | Backend log lines, all of them: (a) `logFailure` (`src/logger.ts`, 30 call sites) writes the place of the failure and an HTTP status or an error type name and code, never a message or a value (`failureSummary` keeps a name or code only when it is a plain identifier); (b) `issueDeleted` (`src/server/tasks.ts`) writes the deleted issue's key (or id), whether a project id was present, and a count; (c) `personalDataTrigger` (`src/server/baselines.ts`) writes counts and the job phase. No account id, name, email, issue text, token or key is logged. The failure lines in `src/frontend/` (`bridge.ts`, `admin.tsx`, `theme.ts`, `legacy-planner.js`) also go through `logFailure`; they run in the user's browser and do not reach Forge logs. `test/log-safety.test.ts` makes them fail with an error whose message holds a secret and checks that it is not logged; its source rule fails if any `console` call in `src/` is given `.message`, `String(...)` or an error object. The app holds no credentials, tokens or keys (question 13). | Q8 |
| 9 | Controls to validate and sanitize all user inputs? | Yes, with the gaps in Open issue 1 | Payload checks before any storage or Jira write: `src/validation.ts` (`assertIssueKey`, `validateTaskUpdates`, `validateSchedulePayload`, `validatePlanId`, `validatePlanName`, `validateColumnWidths`, `validateHiddenColumns`, `validateMilestone`, `reconcileIdsOf`, `dateInWindow`); `createIdOf` (`src/server/jira-write.ts`); `cleanPlanFilter` (`src/domain/plan-filter.ts`); `cleanText` for baseline names, ids, reasons and comments (`src/server/baselines.ts`). The project always comes from the Forge context, never from the payload (`extractProjectKey`, `extractProjectId`, `src/server/request.ts`), and an issue named in a payload must be in that project (`verifyIssueInProject`, `src/server/core.ts`). A failed check returns a validation result and writes nothing (`withValidation`). Every path segment is built with the `route` tag of `@forge/api`, which encodes it. Tests: `test/resolver-validation.test.ts`, `test/validation.test.ts`. | Q9 |
| 10 | Reviewed 3rd party dependencies with automated tools, and plan to keep them up to date? | Yes | CI runs `npm audit --omit=dev --audit-level=high` for CascadePlan on every push and pull request that touches `apps/**` (step "Dependency audit (production, high and critical)", `.github/workflows/apps-ci.yml`); a high or critical finding fails the build. Last run: Apps CI run 42250544524 on `f16ab2e` (2026-11-06; `apps/cascadeplan` unchanged since `c8be4c9`), job "app (cascadeplan)", step passed with 0 critical, 0 high, 7 moderate. Check the latest run on master again just before submission. The 7 moderate findings come from two advisories inside Atlassian's own `@forge/manifest` (a dependency of `@forge/api`, `@forge/bridge`, `@forge/kvs`, `@forge/react`): `glob` GHSA-3g3m-2fjr-6pw4 and `minimatch` GHSA-g3hv-75wg-m249; npm's only offered fix is a breaking downgrade of `@forge/api`, so they wait for an Atlassian release. An npm override pins `prosemirror-view` to `^1.42.3` (`package.json` `overrides`), which removes the high findings that came through `@forge/bridge` and `@forge/react`. `npm audit` was not run again for this document (no `node_modules` in this clone); the lock file is unchanged since that CI run. | Q10 (blocking) |
| 11 | Does the app collect Atlassian credentials? | No | No credential field in the UI, no credential storage, no API token handling in `src/`. Users sign in through Atlassian. | Q11 (blocking) |
| 12 | Does the app collect any 3rd party credentials or tokens? | No | The app talks to no third party (question 6). | |
| 13 | Does the app expose secrets in plain text (URLs, source code, repositories)? | No | The app has no secrets. `forge variables list -e production` (run 2026-11-06): "There are no variables in the production environment." No `process.env` secret in `src/` (the only reads are `NODE_ENV` in `resolveStorage` and `JIRA_BASE_URL` in `src/server/plan-read.ts`, neither a secret). The CI token `FORGE_API_TOKEN` is a GitHub Actions secret (`.github/workflows/apps-ci.yml`), not part of the app. | Q13 (blocking) |
| 14 | Do you perform vulnerability scans and review results? | Owner to confirm. Facts the repo supports: | The CI dependency audit in question 10 runs on every change and blocks high and critical findings; the moderate findings were reviewed (question 10). Atlassian also scans the app on submission (research C6). The repo has no other scanner (no SAST or container scan). | |
| 15 | Have you read the Marketplace security bug fix policy? | Owner to confirm | | |
| 16 | Will you notify customers and Atlassian of a security incident or critical vulnerability? | Owner to confirm. Facts the repo supports: | The published compliance page (https://asymm.systems/product/jira-governance/compliance, section 4, "Vulnerability Management") names the security@asymm.systems disclosure address, "Initial response within 72 hours; critical remediation target within 30 days." Atlassian requires notice of incidents through ECOHELP (research C5; Partner Agreement 8.4(g): within 48 hours). `site/vendor-security-assessment.md` also says 72 hours (since `b922b18`), and points to the incident response process at https://asymm.systems/security and to Atlassian's fix times for cloud apps (critical 10 days, high 4 weeks). | |
| 17 | Have you read the security incident notification guide? | Owner to confirm | | |
| 18 | Security contact identified, with an account on ecosystem.atlassian.net? | Owner to confirm | Research C5. | |
| 19 | Additional details (free text) | Suggested text | "CascadePlan runs only on Atlassian Forge (Node.js 22, `nodejs22.x`, supported until 30 April 2027) with no remote backend and no egress. Every Jira call runs as the signed-in user. Before every write the app checks the user's own Jira permissions on each affected issue with the bulk permissions API and fails closed. All data stays in Forge storage of the customer's site and in issue properties. Logs hold only failure locations, HTTP status codes, issue keys of deleted issues and counts." | |

---

## 2. Evidence detail

### 2.1 Every `asApp` and `asUser` call

| Call | File and function | Runs as |
|---|---|---|
| All planner Jira reads and writes | `getJiraCaller`, `src/server/core.ts`, used by `src/server/jira-read.ts`, `jira-write.ts`, `tasks.ts`, `hierarchy.ts`, `create.ts` | `asUser` only; without a user context `getJiraCaller` throws (no `asApp` fallback) |
| Bulk permission check | `jiraPermissionChecker`, `src/security/write-permissions.ts` | `asUser` |
| Admin and approver checks, group search, group lookup | `isJiraAdmin`, `hasTier1AdminPermission`, `isPlanApprover`, `searchGroupsFlow`, `setApproverPolicyFlow`, `src/security/policy-admin.ts` | `asUser` |

### 2.2 Every backend log call

| Line | What is written |
|---|---|
| `logFailure`, `src/logger.ts` | `cascadeplan <place>: HTTP <status>` or `<ErrorName> <code>` or the type name |
| `issueDeleted`, `src/server/tasks.ts` | `issue-deleted <issue key or id> (project id present/missing): <n> record(s) deleted` |
| `personalDataTrigger`, `src/server/baselines.ts` | `personal data report: <status> (<phase>), <n> account(s) reported, <n> closed, <n> page(s)` |

### 2.3 Resolver validation

Every planner resolver is listed with its permission rule in `RESOLVER_RULES` (`src/index.ts`). Each resolver body starts with the checks named in question 9; for example `moveTaskGroup` (`src/server/block-moves.ts`) checks `taskId`, `days` (whole, not 0, at most 3660), `expectedVersions` and `planId`; `continueBlockMove` checks every item key and date; `convertIssueType` (`src/server/hierarchy.ts`) checks `toTypeName` against `^[\w -]{1,60}$`; `checkConversion` checks `jobId`. The gaps are in Open issue 1.

---

## 3. Privacy & Security tab

| Question | Answer |
|---|---|
| Does the app use Personal Access Tokens (PATs)? | No. |
| Permission justification | As in `cascadeplan-submission-notes.md` section 1 (one row per scope). |
| Does the app store End User Data outside Atlassian? | No. All data is in Forge storage of the customer's site, and in issue properties of the customer's Jira issues. The app makes no call outside the customer's Atlassian site. |
| Does the app support data residency? | Yes. Forge storage (the Key-Value Store) is data residency enabled, and issue properties are Jira data. |
| Data in scope for data residency | Forge storage: per-issue planning records of each plan (row order, start and end used by the planner, milestones, columns), plan settings (including the optional JQL filter), the plan list, baselines (each item's key, estimate, start and end, with a SHA-256 digest), scope-change requests, the approver groups (with the account id of the administrator who last saved them), the time each baseline or scope-change author was last written, and the progress of the personal data job (`cppd:*`). Issue properties: `cascadeplan.dates`, `cascadeplan.links`, `cascadeplan.create`. |
| Data out of scope for data residency | Forge function logs. They hold failure locations with HTTP status codes or error type names, the issue key of a deleted issue, and counts (section 2.2). |
| Personal data | Atlassian account ids: the authors of baseline freezes and of scope-change requests and reviews, the contributors of a task (a person working on it through a Jira sub-task), and the Jira administrator who last saved the approver groups (`setByPartyId`). An hourly job (`reportPersonalData`, `apps/cascadeplan/src/storage/personal-data.ts`) reads every stored record in steps of 600 s, keeps its progress, and reports each id through the Personal Data Reporting API once every 7 days; the ids of closed accounts are removed from every record (`test/personal-data.test.ts`). Group ids are not account ids and are not reported. The `cascadeplan.create` property of a contributor's Jira sub-task holds 12 hexadecimal digits of a SHA-256 of that person's account id (so a repeated create finds the same sub-task); that sub-task is assigned to the same person in Jira. A contributor name that matches no account (for example a placeholder role) is kept as typed. |
| Does the app use AI or third-party inference? | No. |
| Trust Center link (optional) | None yet. |

The data residency list above is also needed in the public documentation (research B6, Section C item 13). The site's privacy page has a CascadePlan section; the in-scope and out-of-scope list should be added there when the site is next published.

---

## 4. Partner security questionnaire

Information only; Atlassian does not evaluate it (research C9). It asks about the company (Asymm Systems), not the app, so the owner answers it.

---

## 5. Other items the owner completes in the console

- Security contact email, with an account on ecosystem.atlassian.net (research C5; question 18).
- Partner identity verification (KYC/KYB).
- The vulnerability scan runs on submission; Critical and certain High findings block approval (research C6). Run `npm audit --omit=dev` again just before submission.
