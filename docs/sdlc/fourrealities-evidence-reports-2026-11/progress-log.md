<!--
Copyright (c) 2026 Asymm Systems. All rights reserved.

@author Fahim Farook
-->
# FourRealities evidence reports (ADR-015): progress log

Branch `feature/fourrealities-evidence-reports` of `asymmsystems/jira-governance-code-system`, from `origin/master` `4fbc31f` with `origin/feature/fourrealities-audit-trail-design` (`1035aac`) merged in (`cd6be60`). Development environment only. Not merged, not deployed to production or staging.

## 2026-11-08

### Owner decisions

All nine recommendations of the HLD, section 11, approved on 2026-11-08 (Q1 Option C; Q2 Tier 1 plus a configured group; Q3 400 days, 90 days to 7 years; Q4 changed plus length; Q5 Object Store with the costed fallback; Q6 200 reports and 50 MB; Q7 "evidence reports for change-management audits"; Q8 early delete with a reason and a record; Q9 view and download when the licence is inactive, no new reports). Recorded verbatim in ADR-015, section "Owner decisions".

### Step 1. ADR and specification (`b551c86`)

- `architecture/decision/adr-00015-fourrealities-evidence-reports.org`: Status Accepted (2026-11-08), owner decisions recorded verbatim.
- `docs/spec/fourrealities-spec-v4.md`: spec v3 with the approved delta merged in, and section 11 "Evidence reports" (scope, field values, files, signature and chain, rights, limits, resolver contracts, consumer and daily run, personal data, UI, changes after the spikes). `fourrealities-spec-v3.md` is unchanged (frozen); the delta `fourrealities-spec-v4-draft.md` is marked frozen.

### Step 2. Spikes (`b551c86`; spike code `fb10e51` on `spike/fourrealities-evidence-report-spikes`, never merged)

Full results: `spike-results.md` in this folder. In short:

| Spike | Result | Change made |
|---|---|---|
| S-1 Object Store | Backend PASS (pre-signed PUT to `tdp-os.services.atlassian.com`, no `permissions.external`, no new scope, Runs on Atlassian kept). Browser download NOT RUN: no signed-in session (Chrome signed out; stored cookies 401; the owner's password may not be entered). | "Written once" enforced by the app (Object Store accepted a second write with `overwrite: false`); file name set by `FileCard`. |
| S-2 Bulk changelog | PASS as the app, about 1,270 bytes per entry. | None. |
| S-3 10,000 issues | Synthetic dataset (largest project on the site: 35 issues). Parts in KVS FAILED (`RATE_LIMIT_EXCEEDED` after about 205 parts); parts in Object Store PASS: 40 MB JSON and 45.7 MB CSV, peak 540 MB, visibility check 5.6 s for 20 x 500 ids. | Parts are temporary Object Store objects (spec v4 D-17). |
| S-4 asUser in a consumer | Not proven: without a user, `AUTH_TYPE_UNAVAILABLE`; the case with a user NOT RUN. | None: the design as written does not depend on it. |

No spike showed the approved design cannot work, so the build went ahead.

### Step 3. Build (`3379290`, verifier `8f79bb6`)

- Contracts `src/contract/data/reports.ts`, `src/contract/reports.ts`; engines `default-report-engine.ts`, `default-report-policy-engine.ts`; accessors for the permission check (FSRT form), Jira report reads, KVS records, Object Store, the queue, crypto, party tokens, the runtime and people; managers `default-evidence-report-manager.ts`, `default-report-settings-manager.ts`; wiring, consumer `reportWorker` and trigger `reportDaily` in `src/index.ts`; UI `src/frontend/evidence-reports.tsx` (tab), `src/frontend/report-settings.tsx` (admin section), `src/ui/report-text.ts`; manifest `objectStore`, `consumer`, `fourrealities-report-daily`, `memoryMB: 1024`; personal data accessor extended with the token map.
- Every report resolver calls `reportPermissionsAsUser` first: one direct `api.asUser().requestJira(route\`/rest/api/3/mypermissions?projectKey=${projectKey}&permissions=BROWSE_PROJECTS,ADMINISTER_PROJECTS,ADMINISTER\`)`, before any storage read or call as the app.
- Development signing key `fr-dev-2026-11` created: public key `apps/fourrealities/keys/fr-dev-2026-11.pub.pem` and `tools/verifier/keys/fr-dev-2026-11.pub.pem`, SHA-256 of the DER public key `f2ad70911a15f39cf37570f86fb3b55e7cf62b48b65bbfd50c8f649de01b979f`. Private key `~/Documents/projects/jira-governance/.tmp/secrets/fourrealities-report-keys/fr-dev-2026-11.pkcs8.der.b64` (mode 600, not in git). Forge development variables set: `FOURREALITIES_SIGNING_KEY` (encrypted) and `FOURREALITIES_KEY_ID=fr-dev-2026-11`. No production key was made.
- Verifier `tools/verifier/verify-fourrealities-report.mjs` (bin `fourrealities-verify-report`), its Node tests, README section, version 1.4.0.
- Found and fixed while testing: a changelog item without `toString` gave `Object.prototype.toString` (`changelogEntry`); equal tombstone times sorted unstably; a missing `Retry-After` header gave no wait; a function as a default constructor parameter (`DefaultForgeObjectStoreAccessor`) made FSRT's secret-logging scanner stop with "expected function" (found by bisecting; moved into the constructor body).

### Step 4. Tests

New: `test/engine/report-engine.test.ts`, `test/engine/report-policy-engine.test.ts`, `test/accessor-reports.test.ts`, `test/manager/evidence-report-manager.test.ts` (with `report-harness.ts`), `test/contract/report-verifier.test.ts` (the real report against the open verifier: one changed byte in each file, a changed header, a wrong key, an unsigned report, the chain), `test/security/report-fsrt-authorization.test.ts` (every report resolver key through the registered handler, for a user with no permission: refused, no storage, no Object Store write, no queue event, no call as the app, only the permission question; a new key without a case fails; the licence rule; the safe-logging rule for the two new handlers), `test/frontend/evidence-reports.test.tsx`, `test/frontend/report-settings.test.tsx`, `test/ui/report-text.test.ts`, and additions to `test/manifest.test.ts`, `test/architecture.test.ts` (the queue, Object Store and crypto only in `src/accessor/`) and `test/listing.test.ts` (Q7 wording). `tools/verifier/test/verify-fourrealities-report.test.mjs`.

### Step 5. Gate (branch head before the docs commit, `8f79bb6` code)

| Check | Result |
|---|---|
| `npx tsc --noEmit` | exit 0 |
| `npm test` (Jest with the per-file 90 % thresholds) | 57 suites, 767 tests passed; all files 99.48 % statements, 96.7 % branches, 99.39 % functions, 99.84 % lines; every per-file threshold met |
| `npm run build` | exit 0 |
| `npm audit --omit=dev --audit-level=high` | exit 0; 0 high, 0 critical; 9 moderate (master: 7; the two new ones are `@forge/events` and `@forge/object-store`, through `@forge/api` as the other seven) |
| `npx --yes @forge/cli@15.0.0 lint` | "No issues found." (the major version notice is not shown against development, where the spike already deployed `objectStore`; the spike's first lint showed "This deployment triggers a major version upgrade ... because: Change due to usage of core:os module") |
| FSRT `6c821bd` default scanners | 0 findings; 74 files parsed, 13 function checks; `tools/ci/fsrt_gate.py` passes |
| FSRT secret-logging | 0 findings; 74 files, 6 function checks; `fsrt_gate.py` passes |
| FSRT probe | an unchecked `api.asApp().requestJira` added before `reportPermissionsAsUser` in `getEvidenceReports` is reported (`Custom-Check-Authorization-9031189739672450855`, `handler.getEvidenceReports`); the same call after it is not. So FSRT sees the new check. |
| Semgrep 1.182.1 (`p/typescript`, `p/javascript`, `p/nodejs`, `p/secrets`, `--error`) | 110 rules, 215 files, 0 findings, exit 0 |
| Verifier `npm test` | 17 tests passed |
| `forge eligibility -e development` | 7.7.0 "is eligible for the Runs on Atlassian program" |

**Major version:** yes. Adding the `objectStore` module "triggers a major version upgrade" (Forge manifest reference "object store"; `forge lint` approval `MAJOR_VERSION_RULE` "Change due to usage of core:os module"). In development it became major at the spike (6.0.0). In production every site administrator must accept the update. Scopes do not change.

### Step 6. Deploy (development only)

- `forge deploy -e development`: **7.7.0** (from `8f79bb6`), "eligible for the Runs on Atlassian program". `forge install --upgrade` for Jira and Confluence on asymmsystems.atlassian.net: both at major version 7, "Up-to-date". Production (FourRealities 2.3.0) and staging untouched.
- Live check: NOT RUN in the browser (no signed-in session, as for the spikes). Owner checks below.
- Live changes: the spike objects and the 205 spike KVS keys were deleted (read back as absent). The spike deploys (6.0.0 to 7.x) are replaced by 7.7.0. FourRealities' own development storage holds nothing of the reports yet.

## Site items (asymm.systems repository `asymm-corporate-code-pfw`; not applied; read from `origin/main` `81242d4`)

Apply only when the version with evidence reports is in production.

1. `src/main/jbake/content/product/jira-governance/user-guide/fourrealities.html`, after section 6, add section 7:

   > **7. Evidence Reports for Change-Management Audits**
   >
   > For an auditor's sample, FourRealities makes an evidence report: for one project and one period, the issues in scope with their four checks, the DefinitionGuard and LedgerSeal records FourRealities verified, Code exceptions and rework reasons, and who changed which field and when, from Jira's history. An issue is in scope when it was created in the period or changed in it.
   >
   > - **Make a report:** open the project, then **Apps > Four Realities > Evidence reports**, and choose **New evidence report**. Choose From and To (UTC), and if you want, at most 10 fields and 10 people. Project administrators, Jira administrators and members of an evidence report group can make reports. The report holds every change in the range that you can see.
   > - **Schedules:** project and Jira administrators can add a weekly (Monday to Sunday, UTC) or monthly (calendar month, UTC) schedule. The report for a period is made the day after the period ends and stored in the app. It is not sent anywhere.
   > - **Download:** choose **Download** and save the four files: the report as JSON and as CSV, the signed manifest, and the people file. You can download a report only when you can see every issue in it. The people file is not signed: it names the people of the report as you can see them today.
   > - **What a report shows:** people appear as tokens in the signed files. Free-text fields (Summary, Description, Environment and text custom fields) show that they changed and the lengths, not the text. The checks are observed when the report is made, not at the time of each change.
   > - **Check a report:** FourRealities signs the manifest with Ed25519. Run the open verifier: `node verify-fourrealities-report.mjs <manifest.json> <report.json> <report.csv> [--previous <previous-manifest.json>]`. A changed file fails the check. Each manifest names the previous report of the project, so a removed report shows as a break.
   > - **Keeping and deleting:** reports are kept for 400 days unless a Jira administrator chooses 90 days to 7 years in **Jira settings > Apps > FourRealities gate authority > Evidence reports**. A Jira administrator can delete a report early with a reason; a record of the deletion stays in its place.
   > - **Limits:** at most 10,000 issues, 366 days, 50 MB per file and 200 reports per project. A report that is too large is not stored, and the list says why.
   > - FourRealities is not an administrative audit log: Jira's audit log and Atlassian Guard keep it. A report holds what Jira's history held when it was made; an issue deleted before then is not in it.

2. Same page, section 5, replace the bullet "**Storage:** snapshots, Code exception events, rework reasons and site settings are kept in Atlassian Forge storage." with "**Storage:** snapshots, Code exception events, rework reasons, site settings and evidence report records are kept in Atlassian Forge storage; evidence report files are kept in Atlassian Forge Object Store. Nothing is sent outside your Atlassian site."
3. Same page, section 5, replace "With an inactive licence the app shows "Licence not active" and reads nothing." with "With an inactive licence the app shows "Licence not active" and makes no new evidence reports; existing evidence reports can still be viewed and downloaded."
4. `src/main/jbake/content/privacy.html`, section FourRealities, replace the "What it accesses and stores" item with: "**What it accesses and stores:** it reads the issue, its Development field, its changelog and the issue properties of LedgerSeal and DefinitionGuard, and searches the Confluence pages of your own site. It stores snapshots, exception events, rework reasons and site settings in Forge storage. When you make an evidence report, it stores the report files (who changed which field and when, with the values of fields that are not free text) in Forge Object Store on your site, for the retention your Jira administrator sets (400 days by default)."
5. Same section, add to the "Personal data" item: "Evidence report files name people by a pseudonymous token, a keyed hash of the Atlassian account id under a key only the app can read; the app keeps one link from each token to the account id and reports these account ids to Atlassian every week. When Atlassian reports an account as closed, the link is removed, so the report shows a former user and the signed files never change. The people file of a download maps tokens to account ids and names as the downloading user; it is removed 24 to 25 hours after the download."
6. Signing keys page (`product/jira-governance/signing-keys.html`): add `fr-dev-2026-11` (FourRealities evidence reports, development builds only) with its fingerprint above; add `fr-prod-2026-11` when the production key exists.
7. Open verifier page (`product/jira-governance/user-guide/open-verifier`): add `verify-fourrealities-report.mjs` with the four checks of `tools/verifier/README.md`, section "FourRealities evidence reports", and the download of verifier 1.4.0 with its checksums.

## Listing and Marketplace items

- `docs/marketplace/fourrealities-listing.md`: section "Release copy: evidence reports (ADR-015)" with the capability row "Evidence Reports for Change-Management Audits", the boundary sentence "FourRealities is not an administrative audit log: Jira's audit log and Atlassian Guard keep it.", the storage and personal data bullets, a description line and the release note (major version, no new scope). Use when the version is in production. `test/listing.test.ts` checks the Q7 wording.
- `docs/marketplace/submission/fourrealities-security-questionnaires.md`, section 5: changed answers to questions 3, 6, 7, 8, 9 and 19, the new `asApp` uses, and the residency note. `fourrealities-submission-notes.md`, section 6: scope uses, storage and a reviewer test step. Scopes do not change, so no new scope justification is needed.

## Public verifier repository (`asymmsystems/jira-governance-code-cli`): files to copy (not pushed)

`tools/verifier` was identical to the public repository's `main` (`diff -rq` against `repository/code/jira-governance-code-cli`, 2026-11-08). Copy, at release:

- `tools/verifier/verify-fourrealities-report.mjs` (new)
- `tools/verifier/test/verify-fourrealities-report.test.mjs` (new)
- `tools/verifier/keys/fr-dev-2026-11.pub.pem` (new)
- `tools/verifier/README.md` (changed: title, keys table, section "FourRealities evidence reports", tests)
- `tools/verifier/package.json` (changed: version 1.4.0, description, second bin, test script, keyword)

Then tag v1.4.0 with a new `SHA256SUMS`. Not done: the owner's push rules apply to the public repository.

## Owner checks (need a signed-in user on the development site)

1. Spike S-1 in Chrome and Firefox: make a report on PAY, download the four files, check each file name (`spike-results.md`, owner check 1).
2. The download refusal for a user who lacks one issue's security level.
3. A report run end to end on 7.7.0 and the verifier on its files with `fr-dev-2026-11`.

## Left, with the reason

- Production signing key `fr-prod-2026-11`, its Forge production variables, and its public key in `apps/fourrealities/keys/`, `tools/verifier/keys/` and on the signing keys page: at production release.
- Merge review and production deploy (major version): not in this task.
- The 1,000-ids bulk changelog request and a real 10,000-issue run: no such project on the development site.

## Fix round 1 (2026-11-08)

Inputs: the independent review `repository/tmp/fr-evidence-review/REVIEW.md` (branch at `cee99f8`; verdict "one blocker, H-1"), and the coordinator's live Chrome run on 7.7.0 (project PAY, report 1 Jan to 7 Nov 2026, id ending `18520860`, Ready, 66.0 KB, SHA-256 starting `367c6afd06a9`).

### Live findings

- **Download did nothing.** The four FileCard rows showed the right names; a click sent one GraphQL POST (the resolver call) and saved no file. Cause, with evidence: the UI Kit `FileCard` does not save the Blob that `onDownload` returns on this platform. Atlassian's own Object Store sample app (`bitbucket.org/atlassian/forge-ui-object-store-example-app`, `src/frontend/index.tsx`) has the comment "Known bug: FileCard onDownload is () => void; trigger browser save explicitly" and saves the Blob itself with `URL.createObjectURL` and a clicked anchor. Fix: `src/ui/save-file.ts` (`saveBlob`) does the same, and the tab returns nothing to FileCard after a save (no double download if Atlassian fixes the bug). `forge logs` held no line for 04:16 to 04:20 local time (the report resolvers logged nothing); `generateReportDownloadUrls` now logs how many URLs were asked and given (two numbers). The live run also settles review L-4: the report reached Ready, so the stored checksum format matches. The Custom UI fallback is not needed and was not built.
- **List stayed "Queued".** The tab now reads the list again while a report is QUEUED or RUNNING: after 5 s, doubling to 60 s, at most 40 times; a failed refresh keeps the list and the next refresh still runs.
- **Date placeholder 2/18/1993.** Both date pickers show today's date as the placeholder.

### Review findings

| Finding | Fix | Tests |
|---|---|---|
| H-1 (blocker) | `factsByIds` pages to the last page (one page per issue at most; an endless token is an error). The job compares the ids read with the batch: an id not returned is listed as `NOT_READABLE`, an issue now in another project as `MOVED` (it is left out of the report, no longer reported under the old project: L-10 part one). Both go to `report.json` `notReadable`, `counts.notReadable`, the warning `ISSUES_NOT_READ`, and the job's progress. Spec v4 invariant 11. | `accessor-reports.test.ts` (short page, token only, endless token, failed second page); `evidence-report-manager.test.ts` "H-1" (a dropped and a moved issue) |
| M-1 | One KVS value per index entry (`fr:p:{projectKey}:rep:{createdAt}:{reportId}`); each writer writes only its own report's key; the DONE commit writes the job, its entry and the head in one transaction; the old single value is moved when read. New entries are strictly later than the newest one, so the order is the order of creation (found while testing: two creates in one millisecond had no order). | `accessor-reports.test.ts` (interleaved writers, migration); manager "M-1" (a create with a stale index during a commit) |
| M-2 | FREE_TEXT also for every custom field with schema type `string` or none (text, URL, read-only, app text fields) and for every `customfield_*` not in the field list. Spec 11.2. | `report-engine.test.ts` (app, URL, read-only, no schema, deleted; number and user fields stay OTHER and USER) |
| M-3 | A period refused with `JIRA_ERROR`, `JOB_LIMIT` or `REPORT_LIMIT` is kept, tried again the next day, and the schedule shows `lastRefusal` on the tab. | manager "M-3" (a 503, then a good run) and the full-project case |
| L-1 | A lease on the job (event id until the event's deadline); a second event while it holds ends at once. Not airtight (two events that read at the same moment), but closes redelivery after a timeout. | manager "L-1" |
| L-2 | A failed or stalled job also removes its report objects and token chunks. | manager "L-2" |
| L-3 (public claim) | An hourly scheduled trigger `fourrealities-report-tmp` (function `report-tmp`) sweeps people files older than 24 hours, and the daily run sweeps first. All texts now say "removed 24 to 25 hours after the download" (people note, tab text, spec, listing release copy, privacy site item). | manager "L-3"; `manifest.test.ts`; log lines |
| L-4 | Settled by the live run (report Ready on 7.7.0). | none needed |
| L-5 | The previous-report check uses the event deadline. | covered by the chain tests |
| L-6 | Party tokens for the caller and the people filter are made only after every refusal (create and schedule). | manager "L-6" |
| L-7 (public claim) | The signer refuses a `-dev-` key in production and a `-prod-` key in development or staging. The verifier prints `WARN signed with the development key ...: this is a test report ...` for a development key, and FAILs a report that says `environment: production` with one. README says so. | `accessor-reports.test.ts`; verifier test |
| L-8 | The list has no issue or change counts; `getEvidenceReport` gives the manifest only when the download is allowed. | manager "L-8" |
| L-9 | Not changed: every event reads `fr:att:`, `fr:ex:`, `fr:note:` site-wide. Reason: correct, bounded by the site's own records, and a per-issue read would cost about 300 reads per batch of 100; worth a change only with a measured large site. | none |
| L-10 | Part one fixed with H-1 (a moved issue is listed as `MOVED`). Part two not changed: a decision-issue `evidenceRef` can name a linked issue the downloader cannot browse. Reason: the same rule as today's dashboard snapshot; changing it needs a per-viewer check of linked keys at download, a separate decision. | none |

The report format stays `fourrealities-evidence-report/1` (not released): `counts` gains `notReadable`, `report.json` gains `notReadable`. The verifier needs no change for these (the header check covers them).

### Gate (fix round 1)

| Check | Result |
|---|---|
| `npx tsc --noEmit` | exit 0 |
| `npm test` with coverage | 59 suites, 788 tests passed; all files 99.32 % statements, 96.5 % branches, 99.31 % functions, 99.84 % lines; every per-file threshold met |
| `npm run build` | exit 0 |
| `npm audit --omit=dev --audit-level=high` | exit 0; 9 moderate, 0 high (unchanged) |
| `npx --yes @forge/cli@15.0.0 lint` | "No issues found." |
| FSRT `6c821bd`, default and secret-logging | 0 findings each; 75 files, 15 and 7 function checks; `fsrt_gate.py` passes both |
| FSRT probe | unchecked as-app call before `reportPermissionsAsUser`: reported (`Custom-Check-Authorization-9031189739672450855`); after it: none |
| Semgrep 1.182.1 | 0 findings, 216 files |
| Verifier `npm test` | 18 passed |
| `forge eligibility -e development` | 7.8.0 eligible for Runs on Atlassian |

### Deploy (fix round 1)

`forge deploy -e development`: **7.8.0** from `72c5401` (minor: the hourly trigger is not a major change). Jira and Confluence installations at major version 7, "Up-to-date". Production and staging untouched. Retest in Chrome: see the report of this round (download of the four files, the list refresh, the date placeholder, and the report `18520860`: made on 7.7.0 before the H-1 fix, so it has no `notReadable` field; make a new report to check it).

## Fix round 2 (2026-11-08)

Input: `repository/tmp/fr-evidence-review/REVIEW-round2.md` (branch at `fcceaff`; no merge blockers; N-1 and N-2 block production). Invariant 11 and L-10 part two are with the owner and are not changed.

| Finding | Fix | Test |
|---|---|---|
| N-1 (Medium) | Shown in four places. Verifier: `WARN N issue(s) of the scope are NOT in this report` with the signed count and one `WARN` line per issue (key, id, reason), and a FAIL when `report.json` lists a different number. Tab: badge "N issues not in report" on the row, and a notice in the download modal. CSV: one `NOT_READ` row per issue, the reason in the `omitted` cell. `report.json`: entries `{ issueId, issueKey, reason }`; the scope search keeps each key with its id. | verifier test; `evidence-reports.test.tsx` N-1; `report-engine.test.ts` NOT_READ rows; manager N-1 |
| N-2 (Medium) | MOVED compares the project id. The report index, head, schedules and tombstones are keyed by the project id (`fr:rp:{projectId}:...`); the registry maps id to the current key, updated when the tab is opened; jobs and downloads match by project id. | manager N-2 (a key renamed to PAYMENTS: every issue stays, the reports and schedules are found under the new key) |
| N-3 | The job saves its token chunk count before writing the chunks; the failed commit's clean-up removes them. The hand-set token part of the L-2 test is dropped. | manager N-3 (commit fails, retry ends STORE_FAILED, no `fr:rj:{id}*` key and no object left) |
| N-4 | No migration: the development formats of 7.7.0 and 7.8.0 are not read, so nothing can write a stale copy. On the development site the reports made on 7.7.0 and 7.8.0 no longer show (their objects stay; development only). | `accessor-reports.test.ts` (old keys present, not read) |
| N-5 | An event that meets another event's lease is pushed again after the lease ends (plus 5 s); the same event id takes the job over. | manager N-5 |
| N-6 | Not made hard: a hard cap needs a conditional write, and Forge KVS has conditions only on Custom Entities. The overshoot is bounded by concurrent creates (3 queued per project). Spec 11.12. | none |
| N-7 | Production with no fitting key: `createEvidenceReport` returns `NO_SIGNING_KEY` and stores nothing; a running job fails `NO_SIGNING_KEY`; a scheduled period is kept with the refusal on its schedule. Unsigned reports only outside production. | manager N-7 (two tests) |
| M-1 test | Rewritten: B's create reads the index, then during its Jira search A is built and committed, then B writes. Run against the round-1 code `cee99f8` (scratch worktree, deleted after), it fails: A reads back QUEUED. It passes on this code. | manager M-1 |
| L-5 test | The previous-report check gets the event deadline. | manager L-5 |

Also: the index and tombstone sort comparators are single comparisons (same order).

### Gate (fix round 2)

| Check | Result |
|---|---|
| tsc | exit 0 |
| tests with coverage | 59 suites, 798 tests passed; 99.32 % statements, 96.52 % branches, 99.31 % functions, 99.84 % lines; every per-file threshold met |
| build | exit 0 |
| `npm audit --omit=dev --audit-level=high` | exit 0; 0 high, 9 moderate (unchanged) |
| `forge lint` (CLI 15.0.0) | "No issues found." |
| FSRT `6c821bd` default and secret-logging | 0 findings; 75 files, 15 and 7 checks; `fsrt_gate.py` passes |
| Semgrep 1.182.1 | 0 findings, 216 files |
| verifier `npm test` | 19 passed |
| `forge eligibility -e development` | 7.9.0 eligible for Runs on Atlassian |

### Deploy (fix round 2)

`forge deploy -e development`: **7.9.0** from `8b1c2f5`; Jira and Confluence installations at major version 7, "Up-to-date". Production and staging untouched. The reports made on 7.7.0 and 7.8.0 are not listed any more (N-4); make new ones to retest.

## Owner decision on invariant 11 (2026-11-08)

"Sign, list them": a report with in-scope issues Jira cannot return is still signed and names each one with its key and the reason, in the verifier output, the UI and the CSV; it is never refused for this. Recorded in spec v4 (invariant 11, D-19) and ADR-015 (`89ae51f`).

## Live check of 7.9.0 (coordinator, Chrome, 2026-11-08)

A 30-day report on PAY went from Queued to Ready without a page reload; all four files downloaded; the verifier passed with the development-key WARN; counts: issues 21, changes 90, notReadable 0. The CSV is the same size as the 10-month report's, so the date filter is right. Finding: the file names used the exclusive end date (a report "to 7 Nov" was named `...-2026-11-08-...`).

## Fix round 3 (2026-11-08)

Input: `repository/tmp/fr-evidence-review/REVIEW-round3.md` (branch at `ec20fd7`; no merge blockers; R3-1 and R3-2 block production).

| Finding | Fix | Test |
|---|---|---|
| R3-1 (Medium) | The download modal names each missing issue with key and reason (the first 50, then "And N more: report.json and report.csv name every one."); `getEvidenceReport` returns the list only with an allowed download; the list is kept with the report (`fr:rj:{id}:nr:{i}`) and removed with it; the row badge keeps the count. Spec invariant 11 and D-19 corrected to say exactly this. | manager R3-1; UI R3-1 and N-1; store test |
| R3-2 (Medium) | Registry is one KVS value per project (`fr:reports:project:{projectId}`), listed with a prefix query. | store R3-2: project A's registration is interrupted by project B's; both stay |
| R3-3 | The download visibility check includes the MOVED issues. | manager R3-3 (a hidden moved issue refuses the download) |
| R3-4 | Not changed. `@forge/events` 3.0.x types `AsyncEvent.eventId`; if a platform retry carried a new id, it waits for the lease to end (at most 785 s) and then works the job: slower, not broken. | none |
| R3-5 | On a production site with no fitting key, `canCreate` is false and the tab shows "No reports can be made on this site" with the reason. | manager R3-5; UI R3-5 |
| R3-6 | Fixed with R3-2: opening the tab adds no project; it only updates the key of a known one. | manager R3-6 |
| File names | The last day of the period, both days included (`...-2026-10-09-2026-11-07-...` for "9 Oct to 7 Nov"); the manifest `range.to` stays exclusive, as the spec defines it; the verifier prints `NOTE period 2026-10-09 to 2026-11-07, both days included (UTC); ...`. | engine, manager and verifier tests |

The development records of 7.9.0 are under the same keys as before except the registry: projects with reports made on 7.9.0 were in `fr:reports:project-ids`, which is not read any more; such a project rejoins the daily run when its next report is made or a schedule is saved (development only).
