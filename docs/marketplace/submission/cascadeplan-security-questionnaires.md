# CascadePlan: answers for the Marketplace security questionnaires (draft, MK-02)

Draft answers for the owner to enter in the Developer Console. Nothing here has been submitted. Each answer names the code or the check that makes it true, so it can be checked again before submission. Sources for the questions: `docs/sdlc/cascadeplan-marketplace-review-2026-11/marketplace-research.md` section A.c (C6 to C11). The question numbers follow the Forge app security questionnaire as summarised there; check the wording in the console, which can change.

The "Security Self-Assessment" of the old checklist is retired (Atlassian ended it on 13 August 2023, research C10). The current gates are: the Forge app security questionnaire (it has blocking items), the partner security questionnaire (information only), partner identity verification, a vulnerability scan, and the Privacy & Security tab.

State of the code: branch `feature/cascadeplan-marketplace-fixes`, commit `9526145` or later, development version 3.8.0 or later.

---

## 1. Forge app security questionnaire

| Item | Answer | Evidence |
|---|---|---|
| Q1a: does the app use `asUser()` for operations on behalf of the user? | Yes. Every Jira REST call of the planner and of the admin page is made with `api.asUser()`. | `getJiraCaller` in `apps/cascadeplan/src/server/core.ts`; the admin page calls in `src/security/policy-admin.ts`. The fallback to `asApp()` in `getJiraCaller` runs only where `asUser` does not exist; the two triggers (issue deleted, weekly personal data report) make no Jira REST call. |
| Q3 (blocking): before an `asApp()` call, are the expected permissions checked? | The app makes no `asApp()` Jira call in practice (see Q1a). In addition, before every write, the app checks the user's own permissions on every issue it will change with `POST /rest/api/3/permissions/check` (Edit issues, Schedule issues, Link issues, Create issues, Move issues; "Make bulk changes" for type conversions) and refuses the action, naming the missing permission. Plan management and baselines need a plan approver (Jira administrator, project administrator, or a member of an approver group), checked on the server for every call. | `src/security/write-permissions.ts`; the permission rule of every resolver in `RESOLVER_RULES`, `src/index.ts` (a resolver without a rule cannot be registered; test `write-permissions.test.ts` "every resolver has a permission rule"). |
| Q7: least privilege scopes | Five scopes, each used: `read:jira-work`, `write:jira-work`, `read:jira-user`, `storage:app`, `report:personal-data`. No egress, no remotes, no content (CSP) permissions. | `apps/cascadeplan/manifest.yml`; justification per scope in `cascadeplan-submission-notes.md` section 1. |
| Q8: are PII, credentials and sensitive data kept out of logs? | Yes. The only log call writes the place of the failure and an HTTP status or an error type name, never a value from the request, the issue or the user. | `logFailure` in `apps/cascadeplan/src/logger.ts`. |
| Q9: is untrusted input validated? | Yes. Every resolver payload is validated before use (issue keys, dates, numbers, plan ids and names, JQL filter text, create ids), and the project always comes from the Forge context, never from the payload. A failed check returns a validation error and writes nothing. | `src/validation.ts`; `withValidation`; `extractProjectKey` in `src/server/request.ts`; `cleanPlanFilter` in `src/domain/plan-filter.ts`; tests `resolver-validation.test.ts`, `validation.test.ts`. |
| Q10 (blocking): were third-party dependencies reviewed for vulnerabilities with automated tools? | Yes. `npm audit --omit=dev` (5 November 2026): no critical or high findings. An npm override pins `prosemirror-view` to a patched version (the source of 8 high findings through `@forge/bridge` and `@forge/react`). Seven moderate findings remain, from two advisories in `glob` (GHSA-3g3m-2fjr-6pw4) and `minimatch` (GHSA-g3hv-75wg-m249) inside Atlassian's `@forge/manifest`; their fixes need new major versions of those packages. CI fails on any high or critical production finding. | `apps/cascadeplan/package.json` `overrides`; CI step "Dependency audit (production, high and critical)" in `.github/workflows/apps-ci.yml`. |
| Q11 (blocking): does the app collect Atlassian credentials? | No. | No credential field or credential storage in the code. |
| Q13 (blocking): are secrets stored in plain text? | No. The app has no secrets: no API keys, tokens or environment variables. | `manifest.yml` (no `environment`, no `remotes`); no `process.env` secret in `src/`. |
| Runtime | Node.js 22 (`nodejs22.x`), supported until 30 April 2027 (research C4). | `manifest.yml` `app.runtime`. |

---

## 2. Privacy & Security tab

| Question | Answer |
|---|---|
| Does the app use Personal Access Tokens (PATs)? | No. |
| Permission justification | As in `cascadeplan-submission-notes.md` section 1 (one row per scope). |
| Does the app store End User Data outside Atlassian? | No. All data is in Forge storage of the customer's site, and in issue properties of the customer's Jira issues. The app makes no call outside the customer's Atlassian site. |
| Does the app support data residency? | Yes. Forge storage (the Key-Value Store) is data residency enabled, and issue properties are Jira data. |
| Data in scope for data residency | Forge storage: per-issue planning records of each plan (row order, start and end used by the planner, milestones, columns), plan settings (including the optional JQL filter), the plan list, baselines (each item's key, estimate, start and end, with a SHA-256 digest), scope-change requests, the approver groups, and the list of account ids stored as authors of baseline and scope-change records. Issue properties: `cascadeplan.dates`, `cascadeplan.links`, `cascadeplan.create`. |
| Data out of scope for data residency | Forge function logs, which hold only the place of a failure and an HTTP status or error type name, no End User Data. |
| Personal data | Atlassian account ids: the authors of baseline freezes and of scope-change requests and reviews, and the contributors of a task (a person working on it through a Jira sub-task). All are reported weekly through the Personal Data Reporting API (`reportPersonalData`, which reads the contributor ids from the stored records each week), and the ids of closed accounts are removed from the records. A contributor name that matches no account (for example a placeholder role) is kept as typed. |
| Does the app use AI or third-party inference? | No. |
| Trust Center link (optional) | None yet. |

The data residency list above is also needed in the public documentation (research B6, Section C item 13). The site's privacy page has a CascadePlan section; the in-scope and out-of-scope list should be added there when the site is next published.

---

## 3. Partner security questionnaire

Information only; Atlassian does not evaluate it (research C9). It asks about the company (Asymm Systems), not the app, so the owner answers it.

---

## 4. Other items the owner completes in the console

- Security contact email, with an account on ecosystem.atlassian.net (research C5).
- Partner identity verification (KYC/KYB).
- The vulnerability scan runs on submission; Critical and certain High findings block approval (research C6). Run `npm audit --omit=dev` again just before submission.
