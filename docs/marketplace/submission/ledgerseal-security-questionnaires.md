# LedgerSeal: answers for the Marketplace security questionnaires (MK-02)

Answers for the owner to enter in the Developer Console. Nothing here has been submitted. Each answer names the code or the check that makes it true, so it can be checked again before submission.

- Question wording: the live "Forge" tab of the Forge app security questionnaire, as read from ECOHELP-182619 on 2026-11-06 (19 questions). The older numbering (Q1a, Q3, Q7 to Q13) from `docs/sdlc/cascadeplan-marketplace-review-2026-11/marketplace-research.md` section A.c is kept only as a cross-reference in the last column.
- Production build: LedgerSeal 3.0.0 was built from master at `fc8ca40` or later. `git diff --stat fc8ca40 origin/master -- apps/ledgerseal packages` shows only `apps/ledgerseal/test/listing.test.ts`, so `src/`, `manifest.yml`, `package.json` and `package-lock.json` are the same on master (`bda60e4`, 2026-11-06). Every answer below is true for both. (The 2.0.0 commit `c8be4c9` differs: restricted comments and work logs, the issue context module, and the granular property scope came after it.)
- All paths below are under `apps/ledgerseal/` unless they start with `.github/` or `docs/`.

---

## Open issues

1. **Question 3 (blocking): not clearly "yes" for the read paths.** The seal and revoke actions check the user's permission with the permissions REST API (as the user) before any `asApp()` call. Three panel resolvers do not:
   - `verify-issue-api` (`verifyIssueFlow`, `src/service/ledger.ts`) reads the issue, every field, every comment, every work log, the field list, the change log and user display names **as the app** (`readLiveSnapshot`, `getChangelog`, `getUserName`, `src/jira/jira-client.ts`). It returns the changed field values (shortened) to the viewer. No permissions REST call checks first that the viewer may browse the issue. The issue id comes from the Forge invocation context (`contextIssue`), never from the payload, and Jira shows the panel only on an issue the user can open. The only as-user read in this path is the comment visibility check: a changed restricted comment is shown as "A restricted comment that you cannot see in Jira" unless the viewer's own comment list (read as the user) contains it (`hiddenComments`). The permission check that does run (`viewerRights` to `isApprover`) runs after the reads and decides only which buttons to show.
   - `seal-evidence-api` (`evidenceFlow`) reads the comments and work logs as the app and returns the sealed snapshot. It checks as the user only that the viewer can see each restricted sealed comment and work log (`getVisibleCommentIds`, `getVisibleWorklogIds`); there is no general Browse check.
   - `seal-history-api` (`historyFlow`) reads app storage only (no Jira call) and returns the seal history of the context issue with no permission check.
   Whether Forge guarantees that a resolver's `context.extension.issue` is an issue the calling user can browse was not verified for this document. Atlassian's requirement (research C1) asks for an explicit check with the permissions REST API. Recommended fix before submission: at the start of these three resolvers, call `GET /rest/api/3/mypermissions?issueId=<id>&permissions=BROWSE_PROJECTS` as the user and refuse when it is not granted or the call fails (the client already has the pattern in `hasApproverPermission`). Until then, answer question 3 with the text in the table, which says this plainly.
2. **Question 8 (logs): residual risk in logged error objects.** Six `console.error` calls log a whole error object (section 2.2). No code path puts issue content into an error: Jira responses are never thrown (`send` in `src/jira/jira-client.ts` returns null on a network error, and a non-200 status becomes an error code); the stored snapshot is parsed inside a `try` (`getContent`, `src/storage/seal-repository.ts`); the errors that LedgerSeal throws have fixed texts (`src/domain/canonicalizer.ts`, `src/domain/attestation.ts`, `src/storage/party-repository.ts`). The remaining sources are Forge storage errors and JavaScript runtime errors, whose messages name code, keys and properties, not stored values. This was read from LedgerSeal's code only; the `@forge/kvs` error texts were not checked (no `node_modules` in this clone). Recommended fix: log only `err.name` and `err.code`, as CascadePlan's `logFailure` does.
3. **Key custody outside the app (question 13 context).** The production signing key is held by Forge as an encrypted variable. Two plain copies of the private key are on the owner's workstation: `~/.keys/ledgerseal/ls-prod-2026-11.key.pem` (PKCS#8, not passphrase-encrypted) and `~/.keys/ledgerseal/ls-prod-2026-11.key.b64` (the base64 value given to Forge); files mode 600, directory mode 700 (checked 2026-11-06 without reading the key). The runbook (`docs/sdlc/ledgerseal-marketplace-fixes-2026-11/progress-log.md`, section "Owner commands", step 3) says to move it to the company password manager or an encrypted offline copy and then shred the plain file; that step is not marked done. This does not change the answer to question 13, which is about the app.

---

## 1. Forge app security questionnaire (live wording, 19 questions)

| # | Question (short) | Answer | Justification and evidence | Old Q |
|---|---|---|---|---|
| 1 | Does the app include user interactions? | Yes | Issue panel, issue context (glance) and admin page, all UI Kit (`manifest.yml` modules `ledgerseal-panel`, `ledgerseal-context`, `ledgerseal-admin`), plus a workflow validator and product triggers. Calls that act for the user run as the user: the approver checks, the user's groups, the admin check, group search and lookup, and the visible comment and work log ids (`hasApproverPermission`, `getMyGroupIds`, `isJiraAdmin`, `findGroups`, `getGroups`, `getVisibleCommentIds`, `getVisibleWorklogIds` in `src/jira/jira-client.ts`). The issue reads and the app's own property write run as the app (question 3), because the seal must cover the whole issue, not only what one viewer can see. | Q1a |
| 2 | Does the app use Forge remote? | No | `manifest.yml` has no `remotes`. | |
| 3 | Before `asApp()` calls on actions that need user permissions, do you check the user's permissions with the permissions REST APIs? | Yes for writes; not for three read resolvers (Open issue 1) | **Seal** (`sealIssueFlow`, `src/service/ledger.ts`) and **revoke** (`revokeFlow`): first `isApprover` (`src/service/approver.ts`), which calls `GET /rest/api/3/mypermissions?issueId=<id>&permissions=ADMINISTER_PROJECTS,ADMINISTER` as the user, then (if not an admin) `GET /rest/api/3/myself?expand=groups` as the user against the approver groups a Jira administrator chose. A failed call refuses the action. Only after that does the app read the issue as the app and write its `ledgerseal-cert` property as the app (`putSealProperty`). **Admin page** (`src/service/policy-admin.ts`, `adminCaller`): global Administer Jira, checked as the user, before anything. **Workflow validator** (`validateTransition`, `src/index.ts`) and **triggers** (`onIssueChanged`, `onIssueDeleted`, `personalDataReport`): no user can call them; Jira runs the validator inside a user's transition, which Jira has already authorised; they read as the app and write only app storage and the app's own issue property. **Panel reads**: `verify-issue-api`, `seal-evidence-api` and `seal-history-api` do not check with the permissions REST API first (Open issue 1). Suggested console text until the fix ships: "Writes (seal, revoke, admin) are authorised with the permissions REST API as the user before any asApp call. The panel's read resolvers take the issue only from the Forge context and hide restricted comments and work logs per user; an explicit Browse check is being added." | Q3 (blocking) |
| 4 | Does the app use web triggers? | No | No `webtrigger` module in `manifest.yml`. | |
| 5 | Does the app use display conditions? | No | No `displayConditions` in `manifest.yml`. | |
| 6 | Does the app egress data to external hosts? | No | No `permissions.external` and no `remotes` in `manifest.yml`. All calls are `requestJira` to the customer's site. Signing runs inside the Forge function (`createSigner`, `src/domain/attestation.ts`, Node.js `crypto`). | |
| 7 | Least privilege? | Yes | `read:jira-work` (issue, comments, work logs, change log, field list, my permissions), `write:issue.property:jira` (the granular scope for the one write the app makes, the `ledgerseal-cert` property, `putSealProperty`), `read:jira-user` (display names and account state, `getUserName`, `accountState`; groups), `storage:app`, `report:personal-data` (`src/service/personal-data.ts`). LedgerSeal never edits an issue. Scope justification: `ledgerseal-submission-notes.md` section 1. | Q7 |
| 8 | Does the app log sensitive information (PII, credentials, tokens, keys)? | No (with the residual risk in Open issue 2) | Every backend log line is listed in section 2.2. They hold numeric issue ids, counts and, in six lines, an error object. No account id, name, email, comment text or field value is written by LedgerSeal's code. The signing key is never logged: `signerFromEnvironment` (`src/domain/attestation.ts`) logs a fixed text when the key cannot be read, and the unsigned warning (`UNSIGNED_LOG`, `src/service/ledger.ts`) names only the variable names. The `console.error` calls in `src/frontend/` run in the user's browser and do not reach Forge logs. | Q8 |
| 9 | Controls to validate and sanitize all user inputs? | Yes | The issue always comes from the Forge context, never from the payload (`contextIssue`, `src/service/ledger.ts`). Seal: `signature` must be present, the declaration version and text must equal the one the panel shows (`matchesDeclaration`, `src/domain/declaration.ts`), `meaning` must be one of three values (`isMeaning`), a reason is 1 to 500 characters (`validReason`), and `viewHash` is compared with the live issue (a change since the panel loaded refuses the seal). Revoke: reason 1 to 500 characters. History: `fromSeq` is made a whole number and clamped to the stored range (`historyFlow`). Admin: search query at most 100 characters; group ids must be text of 1 to 128 characters, at most 20, and each must exist in Jira (`setPolicyFlow`, `src/service/policy-admin.ts`). Every path is built with the `route` tag of `@forge/api`, which encodes it. | Q9 |
| 10 | Reviewed 3rd party dependencies with automated tools, and plan to keep them up to date? | Yes | CI runs `npm audit --omit=dev --audit-level=high` for LedgerSeal on every push and pull request that touches `apps/**` (`.github/workflows/apps-ci.yml`, step "Dependency audit (production, high and critical)"); a high or critical finding fails the build. Last run: Apps CI run 42242271357 on `1709054` (2026-11-06; no app change since), step passed with 0 critical, 0 high, 7 moderate (two advisories inside Atlassian's `@forge/manifest`: `glob` GHSA-3g3m-2fjr-6pw4, `minimatch` GHSA-g3hv-75wg-m249; npm's only fix is a breaking change to the Forge packages). `package.json` `overrides` pins `prosemirror-view` to `^1.42.3`, which removes the high findings that came through `@forge/bridge` and `@forge/react`. `npm audit` was not run again for this document (no `node_modules` in this clone). | Q10 (blocking) |
| 11 | Does the app collect Atlassian credentials? | No | No credential field and no credential storage in `src/`. | Q11 (blocking) |
| 12 | Does the app collect any 3rd party credentials or tokens? | No | No third party (question 6). | |
| 13 | Does the app expose secrets in plain text (URLs, source code, repositories)? | No. The app has one secret, and it is stored encrypted. | The app holds an Ed25519 private key that signs the `ledgerseal-cert` attestation. It is the Forge environment variable `LEDGERSEAL_SIGNING_KEY`, set with `forge variables set -e production --encrypt` (runbook: `docs/sdlc/ledgerseal-marketplace-fixes-2026-11/progress-log.md`, section "Owner commands", step 2). `forge variables list -e production` (run 2026-11-06) shows `LEDGERSEAL_SIGNING_KEY` as encrypted (value `****`) and `LEDGERSEAL_KEY_ID` = `ls-prod-2026-11` (an identifier, not a secret). The code reads it only from the environment (`forgeDeps`, `src/index.ts`, to `signerFromEnvironment`, `src/domain/attestation.ts`) and never logs or returns it. Only public keys are in the repository (`keys/ls-dev-2026-11.pub.pem`, `keys/ls-prod-2026-11.pub.pem`). `git log --all -S"BEGIN PRIVATE KEY"` over all 474 commits finds nothing. See Open issue 3 for the backup copy on the owner's workstation. | Q13 (blocking) |
| 14 | Do you perform vulnerability scans and review results? | Owner to confirm. Facts the repo supports: | The CI dependency audit (question 10) runs on every change and blocks high and critical findings; the moderate findings were reviewed. Atlassian scans the app on submission (research C6). No other scanner is in the repo. | |
| 15 | Have you read the Marketplace security bug fix policy? | Owner to confirm | | |
| 16 | Will you notify customers and Atlassian of a security incident or critical vulnerability? | Owner to confirm. Facts the repo supports: | The published compliance page (https://asymm.systems/product/jira-governance/compliance, section 4, "Vulnerability Management"): disclosure address security@asymm.systems, "Initial response within 72 hours; critical remediation target within 30 days." Atlassian requires notice through ECOHELP (research C5; Partner Agreement 8.4(g): within 48 hours). `site/vendor-security-assessment.md` in this repo says 24 hours; one of the two texts should be corrected. | |
| 17 | Have you read the security incident notification guide? | Owner to confirm | | |
| 18 | Security contact identified, with an account on ecosystem.atlassian.net? | Owner to confirm | Research C5. | |
| 19 | Additional details (free text) | Suggested text | "LedgerSeal runs only on Atlassian Forge (Node.js 22, `nodejs22.x`) with no remote backend and no egress. Its only write to Jira is its own issue property, under the granular scope write:issue.property:jira. Sealing and revoking are authorised with the permissions REST API as the user before any app-level call. The attestation signing key is an encrypted Forge variable; only public keys are published. Records name people by a keyed pseudonymous token, and a weekly job reports account ids and erases closed accounts." Add the Browse check sentence after Open issue 1 is fixed. | |

---

## 2. Evidence detail

### 2.1 Every `asApp` and `asUser` call

All Jira calls go through `createJiraClient(asApp, asUser)` in `src/jira/jira-client.ts`. `forgeDeps(asUser)` (`src/index.ts`) passes `api.asUser()` for resolvers and `null` for the validator and the triggers (so every as-user method returns `FORBIDDEN` there and the action fails closed).

| Method | Endpoint | Runs as | Permission check before it |
|---|---|---|---|
| `getIssue` | `GET /rest/api/3/issue/{id}?fields=*all,-comment` | app | Seal, revoke: `isApprover` as the user. Verify: none (Open issue 1). Validator, trigger: none possible (no user). |
| `getComments` | `GET /rest/api/3/issue/{id}/comment` (paged) | app | Same as `getIssue`. Evidence: none before the read; restricted comments then checked as the user. |
| `getWorklogs` | `GET /rest/api/3/issue/{id}/worklog` (paged) | app | Same as `getIssue`. |
| `getFields` | `GET /rest/api/3/field` | app | Site metadata, not issue data. |
| `getChangelog` | `GET /rest/api/3/issue/{id}/changelog` (paged) | app | Seal, revoke: after `isApprover`. Verify: none (Open issue 1). |
| `getUserName`, `accountState` | `GET /rest/api/3/user?accountId=` | app | Display names of people already named on the issue or in the record; account state for the personal data job. |
| `putSealProperty` | `PUT /rest/api/3/issue/{id}/properties/ledgerseal-cert` | app | Written on seal and revoke (after `isApprover`), and when a change is recorded (`recordIncidentIfNew`, from verify, the validator or the trigger). The property holds only ids, hashes, status, counts and the signature (`buildAttestation`). |
| `hasApproverPermission` | `GET /rest/api/3/mypermissions?issueId=&permissions=ADMINISTER_PROJECTS,ADMINISTER` | user | It is the check. |
| `getMyGroupIds` | `GET /rest/api/3/myself?expand=groups` | user | It is the check. |
| `isJiraAdmin` | `GET /rest/api/3/mypermissions?permissions=ADMINISTER` | user | It is the check. |
| `findGroups`, `getGroups` | `GET /rest/api/3/groups/picker`, `GET /rest/api/3/group/bulk` | user | After `isJiraAdmin`. |
| `getVisibleCommentIds`, `getVisibleWorklogIds` | comment and work log lists | user | They are the visibility checks. |

### 2.2 Every backend log call

| File and function | What is written |
|---|---|
| `src/jira/jira-client.ts`, `pages` | `LedgerSeal: more than 5000 <comments or worklogs>; the issue is too large to check` |
| `src/jira/jira-client.ts`, `readChangelog` | the same text for change log entries, with the numeric issue id |
| `src/index.ts`, `onIssueDeleted` | numeric issue id and a count; on failure the numeric issue id and the error object |
| `src/index.ts`, `personalDataReport` | counts; on failure a fixed text and the error object |
| `src/domain/attestation.ts`, `signerFromEnvironment` | fixed text: the key could not be read as an Ed25519 key |
| `src/service/ledger.ts`, `writeAttestation` | `UNSIGNED_LOG` (names the variables, not their values) and the numeric issue id; or "could not write the ledgerseal-cert property on issue <id>" |
| `src/service/ledger.ts`, `sealIssueFlow` | "could not delete the replaced snapshot of issue <id>" and the error object |
| `src/service/ledger.ts`, `verifyIssueFlow` (two calls) | "verify failed" and the error object |
| `src/service/ledger.ts`, `issueChangedFlow` | "issue event handling failed" and the error object |
| `src/service/ledger.ts`, `evidenceFlow` | `UNSIGNED_LOG` and the numeric issue id |
| `src/service/conversion.ts` (weekly conversion loop) | "could not convert the record of issue <id>" and the error object |

Can an error object hold issue content? See Open issue 2: no LedgerSeal code path puts it there, but the six error objects are logged whole.

---

## 3. Privacy & Security tab

Scope justification and the data residency statement are in `ledgerseal-submission-notes.md` sections 1 and 2. PATs: No. AI or third-party inference: No. Data out of scope for data residency: Forge function logs, which hold the items in section 2.2.

## 4. Partner questionnaire and other console items

As for CascadePlan (`cascadeplan-security-questionnaires.md` sections 4 and 5): the partner questionnaire is information only and the owner answers it; the security contact, partner identity verification and the submission scan are owner steps.
