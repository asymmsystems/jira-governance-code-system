# FourRealities: answers for the Marketplace security questionnaires (MK-02)

Answers for the owner to enter in the Developer Console. Nothing here has been submitted. Each answer names the code or the check that makes it true, so it can be checked again before submission.

- Question wording: the live "Forge" tab of the Forge app security questionnaire, as read from ECOHELP-182619 on 2026-11-06 (19 questions). The older numbering (Q1a, Q3, Q7 to Q13) from `docs/sdlc/cascadeplan-marketplace-review-2026-11/marketplace-research.md` section A.c is kept only as a cross-reference in the last column.
- Production build: FourRealities 2.0.0 was built from commit `c8be4c9`. `git diff --stat c8be4c9 origin/master -- apps/fourrealities` shows only `apps/fourrealities/test/listing.test.ts`, so `src/`, `manifest.yml`, `package.json` and `package-lock.json` are the same on master (`bda60e4`, 2026-11-06). Every answer below is true for both.
- All paths below are under `apps/fourrealities/` unless they start with `.github/` or `docs/`.

---

## Open issues

1. **Question 3 (blocking): the dashboard's per-viewer check is a search as the user, not a permissions REST call, and some aggregates are not filtered.** The project dashboard is built from a search of the whole project **as the app** (`DefaultSnapshotManager.build`, `src/manager/default-snapshot-manager.ts`; `searchProjectIssues`, `src/accessor/jira-search.ts`), plus remote links and Confluence page existence as the app. Before anything is returned, `view` reads the ids of the project's issues that the viewer can browse with the same JQL search **as the user** (`visibleIssueIds`) and keeps only those rows (`visibleRows`); the summary is computed from the kept rows. Jira's search as the user applies Browse projects and issue security, so it is a real per-issue permission check, but it is not one of the "permissions REST APIs" the question names. Two things are not filtered per viewer: the trend history (`getTrend`, built from the summary over all issues at each snapshot) and the coverage counts in `meta` (`shownCount`, `totalKnown`). A viewer who can browse only some issues of the project therefore sees counts that include issues they cannot see (counts only, no keys or fields). Also, `pageExists` on a visible row's Confluence link is checked as the app (`existingPages`, `src/accessor/default-forge-confluence-search-accessor.ts`), so a viewer can learn that a linked page exists even when they cannot open it. Recommended fix: show the trend and coverage only to users who can browse every issue counted, or label them as project totals; check page existence as the user in the view. Answer question 3 with the text in the table, which says this plainly.

No other answer is in doubt.

---

## 1. Forge app security questionnaire (live wording, 19 questions)

| # | Question (short) | Answer | Justification and evidence | Old Q |
|---|---|---|---|---|
| 1 | Does the app include user interactions? | Yes | Project page, issue panel, issue context and admin page, all UI Kit (`manifest.yml` modules `fourrealities-project-dashboard`, `fourrealities-issue-panel`, `fourrealities-issue-context`, `fourrealities-admin`), plus two scheduled triggers. The issue panel reads and every user action run as the user: `compose(..., 'user')` in `src/index.ts` for `getIssueAlignment`, `linkDecision`, `recordException`, `decideException`, `requestReview` and the admin resolvers; `DefaultForgeJiraIssueAccessor('user')` (`src/accessor/default-forge-jira-issue-accessor.ts`); `DefaultForgeConfluenceSearchAccessor()` (user by default) for the Confluence search; `DefaultForgeJiraDirectoryAccessor(requestAs('user'))` for admin, groups and names. | Q1a |
| 2 | Does the app use Forge remote? | No | `manifest.yml` has no `remotes`. | |
| 3 | Before `asApp()` calls on actions that need user permissions, do you check the user's permissions with the permissions REST APIs? | Yes for actions; partly for the dashboard (Open issue 1) | Every `asApp()` use (section 2.1): **Code exception decision** (`decide`, `src/manager/default-exception-manager.ts`): first the issue is read as the user (`issueProject`, must return 200), the scope rule is applied (`scopeError`, `src/engine/default-policy-engine.ts`), then `isApprover` checks as the user `GET /rest/api/3/mypermissions?projectKey=<key>&permissions=ADMINISTER_PROJECTS,ADMINISTER` (`hasAnyPermission`) or membership of an approver group (`myself?expand=groups`, as the user). Only then is the `fourrealities-exception` property written as the app (a withdrawal is written as the user). **Project dashboard** (`getProjectDashboard`, `refreshProjectSnapshot`): built as the app, then filtered to the issues the viewer can browse, read as the user (Open issue 1). **Scheduled snapshot** and **personal data job**: no user caller; their results reach users only through the filtered dashboard; the personal data job's property rewrite (`rewriteProperty`, `src/manager/default-personal-data-manager.ts`) only removes erased account ids. **Site configuration** (`/rest/api/3/serverInfo`, `/status`, `/field`, a one-result JQL probe; `src/accessor/default-kvs-site-config-accessor.ts`): site metadata, not user data. Suggested console text: "User actions are authorised with the permissions REST API as the user before any asApp write. The project dashboard is computed as the app and filtered per viewer by a Jira search run as that viewer, so each viewer sees only issues they can browse; project-level trend counts are being restricted as well." | Q3 (blocking) |
| 4 | Does the app use web triggers? | No | No `webtrigger` module in `manifest.yml`. | |
| 5 | Does the app use display conditions? | No | No `displayConditions` in `manifest.yml`. | |
| 6 | Does the app egress data to external hosts? | No | No `permissions.external` and no `remotes` in `manifest.yml`. All calls are `requestJira` and `requestConfluence` to the customer's own Atlassian site. Links users add are stored as Jira remote links; the app never fetches them. | |
| 7 | Least privilege? | Yes | `read:jira-work`, `write:jira-work` (remote link, comment, `fourrealities-exception` property), `read:jira-user` (groups, display names), `storage:app`, `search:confluence` and `read:confluence-content.summary` (page search and page-exists check), `report:personal-data`. Each scope and its code use: `fourrealities-submission-notes.md` section 1. | Q7 |
| 8 | Does the app log sensitive information (PII, credentials, tokens, keys)? | No | All four backend log lines are in `src/index.ts`: `snapshot` logs a fixed text when the licence is inactive, and `JSON.stringify` of `ScheduledRunResult` (project keys built, failed or skipped, and counts; `src/contract/data/models.ts`); `personalData` logs `PersonalDataRunResult` (three counts) or, on failure, the error's message only. No account id, name, issue field or token is logged. The frontend has no `console` call. | Q8 |
| 9 | Controls to validate and sanitize all user inputs? | Yes | The issue and project come from the Forge context (`callerOf`, `src/index.ts`). An issue id in a payload must be the context issue, or (on the project page) an issue of the context project, read as the user (`scopeError`, `src/engine/default-policy-engine.ts`; `src/manager/default-exception-manager.ts`, `src/manager/default-issue-evidence-manager.ts`). Links must parse as URLs with `http` or `https`, titles 3 to 255 characters (`linkInputError`); exception reasons 15 to 500, notes at most 1000 (`exceptionInputError`); review comments 15 to 1000 (`reviewCommentInputError`); decisions must be one of a fixed list (`decide`). Admin: sources from fixed lists and decision issue types limited in number and length (`validate`, `src/engine/default-source-policy-engine.ts`); group search at most 100 characters; at most 20 groups, and only groups Jira returns are saved (`saveApprovers`, `src/manager/default-admin-manager.ts`). The Confluence search removes `"` and `\` from the CQL title term (`searchPages`). Every path is built with the `route` tag; the one `assumeTrustedRoute` (`userNames`, `src/accessor/default-forge-jira-directory-accessor.ts`) encodes each account id with `encodeURIComponent`, and the ids come from Jira, not from users. | Q9 |
| 10 | Reviewed 3rd party dependencies with automated tools, and plan to keep them up to date? | Yes | CI runs `npm audit --omit=dev --audit-level=high` for FourRealities on every push and pull request that touches `apps/**` (`.github/workflows/apps-ci.yml`, step "Dependency audit (production, high and critical)"); a high or critical finding fails the build. Last run: Apps CI run 42242271357 on `1709054` (2026-11-06; no app change since), step passed with 0 critical, 0 high, 7 moderate (two advisories inside Atlassian's `@forge/manifest`: `glob` GHSA-3g3m-2fjr-6pw4, `minimatch` GHSA-g3hv-75wg-m249; npm's only fix is a breaking change to the Forge packages). `package.json` `overrides` pins `prosemirror-view` to `^1.42.3`. `npm audit` was not run again for this document (no `node_modules` in this clone). | Q10 (blocking) |
| 11 | Does the app collect Atlassian credentials? | No | No credential field and no credential storage in `src/`. | Q11 (blocking) |
| 12 | Does the app collect any 3rd party credentials or tokens? | No | No third party (question 6). | |
| 13 | Does the app expose secrets in plain text (URLs, source code, repositories)? | No | The app has no secrets. `forge variables list -e production` (run 2026-11-06): "There are no variables in the production environment." `src/` reads no `process.env` value. The keys in `src/accessor/attestation-keys.ts` are the **public** keys of LedgerSeal and DefinitionGuard, used to verify their signed issue properties; they are meant to be published. | Q13 (blocking) |
| 14 | Do you perform vulnerability scans and review results? | Owner to confirm. Facts the repo supports: | The CI dependency audit (question 10) runs on every change and blocks high and critical findings; the moderate findings were reviewed. Atlassian scans the app on submission (research C6). No other scanner is in the repo. | |
| 15 | Have you read the Marketplace security bug fix policy? | Owner to confirm | | |
| 16 | Will you notify customers and Atlassian of a security incident or critical vulnerability? | Owner to confirm. Facts the repo supports: | The published compliance page (https://asymm.systems/product/jira-governance/compliance, section 4, "Vulnerability Management"): disclosure address security@asymm.systems, "Initial response within 72 hours; critical remediation target within 30 days." Atlassian requires notice through ECOHELP (research C5; Partner Agreement 8.4(g): within 48 hours). `site/vendor-security-assessment.md` in this repo says 24 hours; one of the two texts should be corrected. | |
| 17 | Have you read the security incident notification guide? | Owner to confirm | | |
| 18 | Security contact identified, with an account on ecosystem.atlassian.net? | Owner to confirm | Research C5. | |
| 19 | Additional details (free text) | Suggested text | "FourRealities runs only on Atlassian Forge (Node.js 22, `nodejs22.x`) with no remote backend and no egress; it calls only the customer's own Jira and Confluence. Issue views and user actions run as the user. The one app-level write, an approver's exception decision, follows a permissions REST check as the user. Dashboards are filtered per viewer by a Jira search run as that viewer. Snapshots store no account id; a weekly job reports stored account ids and erases closed accounts." | |

---

## 2. Evidence detail

### 2.1 Every `asApp` use

`requestAs('app')` and `DefaultForgeConfluenceSearchAccessor('app')` are built in `compose` (`src/index.ts`).

| Use | Endpoints | Check before it |
|---|---|---|
| Snapshot build (`build`, from the dashboard resolvers and the daily trigger) | `GET /rest/api/3/search/jql` over the project, `POST /rest/api/3/search/approximate-count`, `GET /rest/api/3/issue/{id}/remotelink` | None before the read; the result is filtered per viewer before it is returned (Open issue 1). |
| Confluence page check in the build (`checkPages`, `existingPages`) | `GET /wiki/rest/api/content/search?cql=id in (...)` | None (Open issue 1). |
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
