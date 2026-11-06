# FourRealities: answers for the Marketplace security questionnaires (MK-02)

Answers for the owner to enter in the Developer Console. Nothing here has been submitted. Each answer names the code or the check that makes it true, so it can be checked again before submission.

- Question wording: the live "Forge" tab of the Forge app security questionnaire, as read from ECOHELP-182619 on 2026-11-06 (19 questions). The older numbering (Q1a, Q3, Q7 to Q13) from `docs/sdlc/cascadeplan-marketplace-review-2026-11/marketplace-research.md` section A.c is kept only as a cross-reference in the last column.
- Code described: branch `feature/fourrealities-permission-checks` (from master `6c19fa4`), which adds the dashboard's Browse check, the per-viewer counts and trend, and the Confluence page check as the user (question 3). It is deployed to the **development** environment only (Forge version 5.3.0, 2026-11-06). The production build (FourRealities 2.0.0, commit `c8be4c9`) does **not** have these changes; answer question 3 as below only after this branch is merged and deployed to production. No scope changes, so it is a minor version.
- All paths below are under `apps/fourrealities/` unless they start with `.github/` or `docs/`.

---

## Open issues

Question 3 was open on the production build `c8be4c9` (the dashboard's per-viewer check was a search, not a permissions REST call; the trend and the coverage counts included issues the viewer could not see; linked Confluence pages were checked as the app). Branch `feature/fourrealities-permission-checks` fixes it; the answers below describe that branch and are true for production only after it is merged and deployed.

1. **Live check of the fixed dashboard: not run.** The development deploy succeeded, but the saved browser session for asymmsystems.atlassian.net had expired (`/rest/api/3/myself` answered 401), so the dashboard was not opened. The owner should open the PAY project page on the development app once and check that it loads.
2. **Product effect to accept (not a security gap).** A trend is shown only to a viewer who can browse every issue it counts, and only complete reads (2,000 issues or fewer) record trend points, so projects over 2,000 issues have no trend, and every existing trend restarts once after the upgrade. Coverage on a project over 2,000 issues says "an unknown number of" issues. Details: `docs/sdlc/fourrealities-marketplace-fixes-2026-11/progress-log.md`, section "Security questionnaire Q3".

---

## 1. Forge app security questionnaire (live wording, 19 questions)

| # | Question (short) | Answer | Justification and evidence | Old Q |
|---|---|---|---|---|
| 1 | Does the app include user interactions? | Yes | Project page, issue panel, issue context and admin page, all UI Kit (`manifest.yml` modules `fourrealities-project-dashboard`, `fourrealities-issue-panel`, `fourrealities-issue-context`, `fourrealities-admin`), plus two scheduled triggers. The issue panel reads and every user action run as the user: `compose(..., 'user')` in `src/index.ts` for `getIssueAlignment`, `linkDecision`, `recordException`, `decideException`, `requestReview` and the admin resolvers; `DefaultForgeJiraIssueAccessor('user')` (`src/accessor/default-forge-jira-issue-accessor.ts`); `DefaultForgeConfluenceSearchAccessor()` (user by default) for the Confluence search; `DefaultForgeJiraDirectoryAccessor(requestAs('user'))` for admin, groups and names. | Q1a |
| 2 | Does the app use Forge remote? | No | `manifest.yml` has no `remotes`. | |
| 3 | Before `asApp()` calls on actions that need user permissions, do you check the user's permissions with the permissions REST APIs? | Yes | Every `asApp()` use (section 2.1): **Code exception decision** (`decide`, `src/manager/default-exception-manager.ts`): first the issue is read as the user (`issueProject`, must return 200), the scope rule is applied (`scopeError`, `src/engine/default-policy-engine.ts`), then `isApprover` checks as the user `GET /rest/api/3/mypermissions?projectKey=<key>&permissions=ADMINISTER_PROJECTS,ADMINISTER` (`hasAnyPermission`) or membership of an approver group (`myself?expand=groups`, as the user). Only then is the `fourrealities-exception` property written as the app (a withdrawal is written as the user). **Project dashboard** (`getProjectDashboard`, `refreshProjectSnapshot`; `view`, `src/manager/default-snapshot-manager.ts`): first `GET /rest/api/3/mypermissions?projectKey=<context project>&permissions=BROWSE_PROJECTS` as the viewer; a viewer without it, or a check that fails, gets an error and nothing is read, built or stored (fail closed). Only then is the snapshot read, or built as the app. Every number shown then covers only issues the viewer can browse: the rows, the summary and the coverage come from the issues the viewer's own Jira search returns (as the user, so issue security applies); the weekly trend is shown only when the viewer can browse every issue it counts (the ids are stored with the trend, and the trend restarts when a counted issue leaves the project); the project-wide snapshot metadata is not returned. Linked Confluence pages are checked as the viewer only (`existingPages`, as the user); the app never calls Confluence. **Scheduled snapshot** and **personal data job**: no user caller; their results reach users only through the dashboard above; the personal data job's property rewrite (`rewriteProperty`, `src/manager/default-personal-data-manager.ts`) only removes erased account ids. **Site configuration** (`/rest/api/3/serverInfo`, `/status`, `/field`, a one-result JQL probe; `src/accessor/default-kvs-site-config-accessor.ts`): site metadata, not user data. Tests: `test/manager/viewer-permissions.test.ts`. | Q3 (blocking) |
| 4 | Does the app use web triggers? | No | No `webtrigger` module in `manifest.yml`. | |
| 5 | Does the app use display conditions? | No | No `displayConditions` in `manifest.yml`. | |
| 6 | Does the app egress data to external hosts? | No | No `permissions.external` and no `remotes` in `manifest.yml`. All calls are `requestJira` and `requestConfluence` to the customer's own Atlassian site. Links users add are stored as Jira remote links; the app never fetches them. | |
| 7 | Least privilege? | Yes | `read:jira-work`, `write:jira-work` (remote link, comment, `fourrealities-exception` property), `read:jira-user` (groups, display names), `storage:app`, `search:confluence` and `read:confluence-content.summary` (page search and page-exists check), `report:personal-data`. Each scope and its code use: `fourrealities-submission-notes.md` section 1. | Q7 |
| 8 | Does the app log sensitive information (PII, credentials, tokens, keys)? | No | All four backend log lines are in `src/index.ts`: `snapshot` logs a fixed text when the licence is inactive, and `JSON.stringify` of `ScheduledRunResult` (project keys built, failed or skipped, and counts; `src/contract/data/models.ts`); `personalData` logs `PersonalDataRunResult` (three counts) or, on failure, the error's message only. No account id, name, issue field or token is logged. The frontend has no `console` call. | Q8 |
| 9 | Controls to validate and sanitize all user inputs? | Yes | The issue and project come from the Forge context (`callerOf`, `src/index.ts`). An issue id in a payload must be the context issue, or (on the project page) an issue of the context project, read as the user (`scopeError`, `src/engine/default-policy-engine.ts`; `src/manager/default-exception-manager.ts`, `src/manager/default-issue-evidence-manager.ts`). Links must parse as URLs with `http` or `https`, titles 3 to 255 characters (`linkInputError`); exception reasons 15 to 500, notes at most 1000 (`exceptionInputError`); review comments 15 to 1000 (`reviewCommentInputError`); decisions must be one of a fixed list (`decide`). Admin: sources from fixed lists and decision issue types limited in number and length (`validate`, `src/engine/default-source-policy-engine.ts`); group search at most 100 characters; at most 20 groups, and only groups Jira returns are saved (`saveApprovers`, `src/manager/default-admin-manager.ts`). The Confluence search removes `"` and `\` from the CQL title term (`searchPages`). Every path is built with the `route` tag; the one `assumeTrustedRoute` (`userNames`, `src/accessor/default-forge-jira-directory-accessor.ts`) encodes each account id with `encodeURIComponent`, and the ids come from Jira, not from users. | Q9 |
| 10 | Reviewed 3rd party dependencies with automated tools, and plan to keep them up to date? | Yes | CI runs `npm audit --omit=dev --audit-level=high` for FourRealities on every push and pull request that touches `apps/**` (`.github/workflows/apps-ci.yml`, step "Dependency audit (production, high and critical)"); a high or critical finding fails the build. Last run on this code: Apps CI run 42252210748 on `f165d73` (2026-11-06), step passed; a local `npm audit --omit=dev --audit-level=high` on `f165d73` reports 0 critical, 0 high, 7 moderate. Check the latest run on master again just before submission (two advisories inside Atlassian's `@forge/manifest`: `glob` GHSA-3g3m-2fjr-6pw4, `minimatch` GHSA-g3hv-75wg-m249; npm's only fix is a breaking change to the Forge packages). `package.json` `overrides` pins `prosemirror-view` to `^1.42.3`. `npm audit` was not run again for this document (no `node_modules` in this clone). | Q10 (blocking) |
| 11 | Does the app collect Atlassian credentials? | No | No credential field and no credential storage in `src/`. | Q11 (blocking) |
| 12 | Does the app collect any 3rd party credentials or tokens? | No | No third party (question 6). | |
| 13 | Does the app expose secrets in plain text (URLs, source code, repositories)? | No | The app has no secrets. `forge variables list -e production` (run 2026-11-06): "There are no variables in the production environment." `src/` reads no `process.env` value. The keys in `src/accessor/attestation-keys.ts` are the **public** keys of LedgerSeal and DefinitionGuard, used to verify their signed issue properties; they are meant to be published. | Q13 (blocking) |
| 14 | Do you perform vulnerability scans and review results? | Owner to confirm. Facts the repo supports: | The CI dependency audit (question 10) runs on every change and blocks high and critical findings; the moderate findings were reviewed. Atlassian scans the app on submission (research C6). No other scanner is in the repo. | |
| 15 | Have you read the Marketplace security bug fix policy? | Owner to confirm | | |
| 16 | Will you notify customers and Atlassian of a security incident or critical vulnerability? | Owner to confirm. Facts the repo supports: | The published compliance page (https://asymm.systems/product/jira-governance/compliance, section 4, "Vulnerability Management"): disclosure address security@asymm.systems, "Initial response within 72 hours; critical remediation target within 30 days." Atlassian requires notice through ECOHELP (research C5; Partner Agreement 8.4(g): within 48 hours). `site/vendor-security-assessment.md` also says 72 hours (since `b922b18`), and points to https://asymm.systems/security and to Atlassian's fix times for cloud apps (critical 10 days, high 4 weeks). | |
| 17 | Have you read the security incident notification guide? | Owner to confirm | | |
| 18 | Security contact identified, with an account on ecosystem.atlassian.net? | Owner to confirm | Research C5. | |
| 19 | Additional details (free text) | Suggested text | "FourRealities runs only on Atlassian Forge (Node.js 22, `nodejs22.x`) with no remote backend and no egress; it calls only the customer's own Jira and Confluence. Issue views and user actions run as the user. The one app-level write, an approver's exception decision, follows a permissions REST check as the user. Dashboards first check the viewer's Browse projects permission with the permissions REST API, then show only the issues, counts and trend that viewer can browse; Confluence is read only as the user. Snapshots store no account id; a weekly job reports stored account ids and erases closed accounts." | |

---

## 2. Evidence detail

### 2.1 Every `asApp` use

`requestAs('app')` is built in `compose` (`src/index.ts`). There is no app-principal Confluence call: `DefaultForgeConfluenceSearchAccessor` always calls `api.asUser().requestConfluence`.

| Use | Endpoints | Check before it |
|---|---|---|
| Snapshot build (`build`, from the dashboard resolvers and the daily trigger) | `GET /rest/api/3/search/jql` over the project, `POST /rest/api/3/search/approximate-count`, `GET /rest/api/3/issue/{id}/remotelink` | From the dashboard: the viewer's Browse projects on the project, as the viewer, with `mypermissions`; the result is then filtered to the issues the viewer can browse. From the daily trigger: no user. |
| Site configuration on the dashboard (`DefaultKvsSiteConfigAccessor` with `configPrincipal 'app'`) | `/rest/api/3/serverInfo`, `/rest/api/3/status`, `/rest/api/3/field`, a one-result JQL probe | Site metadata, not issue content. |
| Exception decision (`decide`, `commit` with `appJira`) | `PUT /rest/api/3/issue/{id}/properties/fourrealities-exception` | Issue read as the user, scope rule, `isApprover` as the user. |
| Personal data job (`rewriteProperty`) | the same property | Scheduled, no user; removes erased account ids. |

### 2.2 Every backend log call

| File and function | What is written |
|---|---|
| `src/index.ts`, `snapshot` | fixed text (licence inactive), or `FourRealities: scheduled snapshot` and the run result: project keys and counts |
| `src/index.ts`, `personalData` | three counts, or the error's message |

---

## 3. Privacy & Security tab

Scope justification and the data residency statement are in `fourrealities-submission-notes.md` sections 1 and 2. PATs: No. AI or third-party inference: No. Data out of scope for data residency: Forge function logs, which hold project keys and counts (section 2.2).

## 4. Partner questionnaire and other console items

As for CascadePlan (`cascadeplan-security-questionnaires.md` sections 4 and 5): the partner questionnaire is information only and the owner answers it; the security contact, partner identity verification and the submission scan are owner steps.
