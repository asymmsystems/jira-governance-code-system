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
5. Same section, add to the "Personal data" item: "Evidence report files name people by a pseudonymous token, a keyed hash of the Atlassian account id under a key only the app can read; the app keeps one link from each token to the account id and reports these account ids to Atlassian every week. When Atlassian reports an account as closed, the link is removed, so the report shows a former user and the signed files never change. The people file of a download maps tokens to account ids and names as the downloading user; it is kept for 24 hours."
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
