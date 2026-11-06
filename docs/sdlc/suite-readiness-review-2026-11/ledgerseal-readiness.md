# LedgerSeal: Marketplace readiness review (paid app)

- Date: 2026-11-06. Reviewer: independent review session (static review, unit tests, build and local checks only; no live site, no deploy).
- Code reviewed: clone of `jira-governance-code-system` at `1e1318bcf7f1176f69adacdf74faf8e8ef6989f4` (branch `feature/cascadeplan-marketplace-fixes`, contains `origin/master` `907ccd7`). Clone: `/home/fahimfarookme/Documents/projects/jira-governance/.tmp/cache/suite-readiness/ledgerseal/checkout`. During the review the branch moved to `3179089` (checklist only: adds a "Personal Data Reporting" row that agrees with B1); no LedgerSeal code, listing, notes or spec changed.
- Difference from the brief: LedgerSeal on this branch is NOT identical to master. Commit `628bb79` ("shared UI package builds itself during install") changes 5 LedgerSeal files: `.npmrc` (new), `jest.config.js`, `package-lock.json`, `package.json` (adds `@asymm/jira-ui: file:../../packages/asymm-jira-ui`), `tsconfig.json`. No `src/` file differs.
- Review probes (not committed): `/home/fahimfarookme/Documents/projects/jira-governance/.tmp/cache/suite-readiness/ledgerseal/zz-review.test.ts` (copy of `apps/ledgerseal/test/zz-review.test.ts` in the clone). Each probe asserts the current behaviour, so a pass confirms a finding. 8 of 8 pass.
- Not present in the repo: a "final report" and "handover" in `docs/sdlc/ledgerseal-usp-ux-research-2026-11/`. The handover is outside git at `~/Documents/projects/jira-governance/.tmp/cache/ledgerseal-research/handover-gemini.md`; I read it. The final report was a chat message and is not on disk.

## 1. Verdict

**Not ready.** The engineering core is strong: the gate is green (315 tests, 95.54% branches, `forge lint` clean), the canonical form is versioned, writes are claimed with `FAIL_IF_EXISTS`, every read re-checks the record hashes, and the app has no egress. But five things stop a paid submission today. (1) LedgerSeal stores Atlassian account ids and display names and has no personal data reporting, no closed-account handling and no LedgerSeal section in the privacy policy; this is the same blocker CascadePlan had, and it is harder here because the ids sit inside hashed, chained records. (2) Public claims are false: separation of duties does not cover comments and does not apply to revoke, the "open-source" verifier links to a repository that returns 404, and the Part 11 boundary (no 11.200 two-component signing) was dropped from the listing. (3) No production signing key exists, so in production every attestation is unsigned and every evidence file FAILS the verifier's signature check. (4) Three of five screenshots are marked RECAPTURE REQUIRED (one is a mock-up). (5) The app has never been deployed to the production environment.

## 2. Blockers

| # | Blocker | Evidence | Fix | Size |
|---|---|---|---|---|
| B1 | No personal data reporting or erasure | `manifest.yml:71-76` has no `report:personal-data`; no `scheduledTrigger`; no `avi:jira:deleted:issue` trigger. Personal data map in section 4. Probe R7 confirms the display name in KVS and the account id in the issue property. Live privacy page (`https://asymm.systems/privacy`, fetched 2026-11-06) has a CascadePlan section and none for LedgerSeal. | See section 4 "What a fix must do". Add the scope, a weekly scheduled report, closed-account redaction that keeps the chain verifiable, issue-deletion cleanup, and a LedgerSeal privacy section (Partner Agreement 8.4(e)). | L (redaction design for hashed records); privacy text S |
| B2 | False claims about separation of duties | Listing line 36: "cannot approve those changes or revoke the seal". `revokeFlow` (`src/service/ledger.ts:652-702`) has no author check; `viewerRights` (`ledger.ts:505`) offers Revoke to the author. Probe R2 passes: the editor revokes. Comments: `authorsSince` reads only the change log (`ledger.ts:352-354`, `src/domain/policy.ts:20-31`); Jira does not log comment adds or edits there. Probe R1 passes: a comment author approves their own comment. Same claim on the site: `user-guide/ledgerseal.html` section 4 and `compliance.html` SOC 2 row "Separation of Duties". Spec 7.2 promises comment and attachment authors are checked; the code does not. | Code: add comment authors (created or edited after `sealedAt`, from `liveComments`) and work log authors to the SoD set; decide whether revoke is subject to SoD and make code and copy agree. Or reword every copy to what the code does. | M (code + tests) or S (copy only) |
| B3 | "Open-source" verifier is not public, and the independence claim is false | Listing line 41 "Open-source Node.js script"; `open-verifier.html` links `https://github.com/asymmsystems/jira-governance-code-system/tree/master/tools/verifier`; `curl` on that repo and on the GitHub API both return 404 (2026-11-06). The playbook's `asymm-systems/ledgerseal-verifier` also returns 404. `open-verifier.html` says auditors verify "without trusting Jira or Asymm Systems" and "complete cryptographic independence"; the vendor holds the only signing key (`attestation.ts:5-6`) and the snapshot is the app's own stored copy. | Publish `tools/verifier` in its own public repository (or as a download on asymm.systems) and fix every link. Replace the independence sentences with the honest one already in the user guide ("does not stop someone who can rewrite the app's stored data, including the vendor"). | S |
| B4 | Part 11 boundary removed from the listing | Listing lines 49-53 claim 21 CFR 11.50 support and no longer say that 11.200 two-component signing is not performed. The earlier listing (`293ac92`, line 45) said it; round-log line 420 records removing "the Part 11 signature claim"; spec v2 line 24 states the limit. `compliance.html` maps 11.10(e), 11.50 and 11.70 and also omits 11.200. | Restore the boundary sentence in the listing and add an 11.200 / 11.300 row on `compliance.html` that says "Not met: LedgerSeal does not re-authenticate the signer". | S |
| B5 | No production signing key; production evidence always fails verification | `signerFromEnvironment` returns null without `LEDGERSEAL_SIGNING_KEY` (`src/domain/attestation.ts:64-74`), then the attestation has no `sig` (`attestation.ts:90`); the verifier fails any attestation without `sig` (`tools/verifier/verify-evidence.mjs:72`). Only `ls-dev-2026-11` exists (`apps/ledgerseal/keys/README.md`, `tools/verifier/keys/`); round-log line 374 records the variable on development only. Listing line 39 and the user guide say "configured for the installation", which a customer cannot do. | Generate a production key outside the repo, `forge variables set --environment production --encrypt LEDGERSEAL_SIGNING_KEY` and `LEDGERSEAL_KEY_ID`, publish its public key in both key folders and on the site, document backup and rotation. Say "Every production attestation is signed with the Asymm Systems key `<id>`". Consider failing loudly (log + panel note) when production has no key. | S |
| B6 | Screenshots not shippable | Listing lines 81-83: 01, 02 and 03 "RECAPTURE REQUIRED" (03 is a mock-up modal). 05 (viewed) shows "DEV" badges, a Confluence tooltip over the page, the FourRealities app and the "Open Four Realities panel" button. All five are 1840x1150 (`file`); CascadePlan used 1840x900 (checklist line 44). | Recapture all five from a production-like install with no DEV badges and no other apps, after F-04 is fixed. | S |
| B7 | Never deployed to production | `~/Documents/projects/jira-governance/.tmp/cache/ledgerseal-research/forge-deploy.log`: 14 deploys, all to development (last 3.16.0); checklist line 15 "Not verified". | `forge deploy -e production`, then the licence checks in section 9. | S |

## 3. Findings by severity

Blockers B1 to B7 are not repeated here. Status "Confirmed" means shown by code reading plus a test or command; "Plausible" means it depends on live Jira behaviour I could not run.

### High

**F-01 SoD gap for comments (code side of B2).** `ledger.ts:350-359`. Scenario: an approver adds a comment "Also drop the audit table" after the seal; the panel offers them "Approve these changes" (`canApproveChanges: true`) and the reseal succeeds with them as signer. Probe R1. Confirmed. Fix: build the author set from change log entries plus comments whose `created` or `updated` is after `sealedAt` (author or `updateAuthor`), plus work log authors; same in `viewerRights` (`ledger.ts:493-508`) and for the reseal after revoke (`ledger.ts:360-367`).

**F-02 Transition-screen comment replaces the comment list.** `src/index.ts:90-93` spreads `transition.modifiedFields` over `raw.fields`. A comment typed on the transition screen arrives as `modifiedFields.comment`; it overwrites `fields.comment`, and `canonicalizeIssueState` then reads no comments (`canonicalizer.ts:343`). Scenario: a sealed issue with one comment; the user adds a transition comment; the validator blocks with "Comment removed" and `recordIncidentIfNew` writes a false incident, which sets `everCompromised` for good. If the sealed issue had no comments, the new comment is not seen at all. Probe R8 (with a string value). Confirmed in code; the real payload shape is Plausible (not checked live). Fix: never let `modifiedFields` replace `comment` or `attachment`; treat a transition comment as "Comment added"; map each modified field value through the same shape Jira's issue GET returns, and test with a captured live payload.

**F-03 Validator reads `modifiedFields` only under `transition`.** `index.ts:90`. Research source FG-19 (Reported, not live-verified) says `transition.modifiedFields`. If Jira sends it at the top level, a field changed on the transition screen passes the gate (probe R4 shows a top-level value is ignored). Plausible. Fix: capture one live validator payload (section 9) and read both locations.

### Medium

**F-04 "Open Four Realities panel" button in a separately sold app.** `src/frontend/index.tsx:241-251` calls `router.open('/browse/<same issue>')`, which only reloads the issue. It names a different paid product even when that app is not installed (visible in screenshot 05). The UI standard asks for it (`asymm-jira-ui-standard.md:360`), but the implementation is a no-op. Confirmed. Fix: remove it, or show it only when FourRealities is installed and link to its panel.

**F-05 A seal is not bound to what the approver looked at.** `sealIssueFlow` (`ledger.ts:315-455`) seals the live issue at click time; the request carries no hash of the state the approver reviewed. Scenario: a developer edits the description while the approver reads the issue; the approver clicks "Sign and seal" and seals the edited text without seeing it. No SoD check applies to a first seal. Confirmed. Fix: return `liveHash` from `verify-issue-api`, send it with the seal, refuse with "The issue changed since you opened it" when it differs.

**F-06 App-level reads shown to every viewer.** Issue, comments and work logs are read `asApp` (`jira-client.ts:149-157`). The panel diff and `seal-evidence-api` (full sealed snapshot, `ledger.ts:622-647`) go to any user who can open the panel, with no approver check (probe R6). A comment or work log restricted to a role or group, if the app user can read it, is shown to viewers outside that role. Plausible (depends on what the app user can read). Conflicts with standard invariant 1 "Zero Escalation" (`uniform-permission-management-standard.md:17`). Fix: drop restricted comments and work logs from display text, or read them as the user for display; limit evidence export to approvers or show a redacted export.

**F-07 Object values with an `id` hide changes to their other properties.** `canonicalizer.ts:184-187` reduces any object with `id` to `{ id }` (plus `child`). A Forge or third-party custom field of type `object` whose value has an `id` and content (for example `{ id, amount }`) can change content without breaking the seal. Probe R5. Confirmed in code. Fix: apply the `{ id }` rule only to known reference schemas (option, priority, version, component, project, issue type, resolution, security level, issue references); hash every other object in full. New canonical form version 2.2.0.

**F-08 A lapsed licence blocks unsealed and changed issues for good.** Spec D-8 says a lapsed licence must not stop releases, so the validator ignores the licence (`index.ts:75-154`). But sealing and approving changes return `LICENSE_INACTIVE` (`ledger.ts:318`), so an unsealed or changed issue behind the validator can never pass until a Jira admin removes the validator. Probe R3. The trigger also keeps writing incidents and the property on an unlicensed site. Confirmed. Fix: when the licence is inactive, let the validator pass with no seal check (or say in the validator message that the admin must remove the validator), and state this in the listing.

**F-09 Fresh clone install fails as documented.** `apps/ledgerseal/README.md` says `npm install; npm test`. In a clean clone `npm ci` in the app fails: `packages/asymm-jira-ui` prepare runs `tsc -p .`, "sh: 1: tsc: not found" (`gate1.log`). It works only after `npm ci` in `packages/asymm-jira-ui` first; that order is in the commit message of `628bb79` only. Confirmed. Fix: put the order in the README (and a root script).

**F-10 Large issues.** `MAX_PAGES = 50` pages of 100 (`jira-client.ts:85`) for comments, work logs and the change log. The change log is oldest first, so on an issue with more than 5,000 entries the newest (post-seal) entries are dropped and SoD misses them; comments past 5,000 are silently not sealed. All reads are serial, with a 20 s retry budget per call (`jira-client.ts:99`), and `verify` may read the change log twice (`ledger.ts:282`, `499`). The 25 s Forge invocation limit can be hit on busy issues. Plausible. Fix: fail closed (`SNAPSHOT_TOO_LARGE`-style) when a list hits the page cap; read the change log once per invocation.

**F-11 No issue-deletion cleanup.** Seal records, content parts and history of deleted issues stay in KVS for ever (no `avi:jira:deleted:issue` trigger, compare CascadePlan `manifest.yml:28-29`). Old content parts of every reseal also stay (`seal-repository.ts:149-165`). Confirmed. Fix: delete or mark records on issue deletion (part of B1).

**F-12 Issue panel discovery.** `jira:issuePanel` is opened per issue from the issue's app button; the validator message tells users to "open the LedgerSeal panel". Plausible friction (Jira behaviour, not live-checked). Fix: add a `jira:issueContext` glance showing the seal state, which is always visible.

### Low

- **F-13** `authorsSince` counts every change log author after the seal, including status transitions, Rank and Sprint changes (`policy.ts:20-31`). An approver who only moved the issue is blocked from approving others' changes. Confirmed.
- **F-14** Validator message says click "Seal issue" (`workflow-validator.ts:41`); the button is "Seal this issue" (`view-model.ts:300`). Confirmed.
- **F-15** History shows only the first 50 entries (`index.tsx:126`, no paging) and does not show who acted; `loadHistory` and `loadEvidence` have no try/catch (`index.tsx:121-136`). Evidence is up to about 2.6 MB of JSON in a `CodeBlock`, with no download (Plausible UI and payload size limits).
- **F-16** Comment "Publish public audit property ... without PII" (`ledger.ts:451`) is false: the property holds `sealedByAccountId`, readable by anyone who can browse the issue.
- **F-17** Two verifier copies differ: `apps/ledgerseal/verifier/verify-evidence.mjs` lacks exit code 2 and named flags that `tools/verifier` has and the listing describes. Keep one.
- **F-18** Repo rules: 9 source files lack the Asymm Systems header and `@author Fahim Farook`: `src/index.ts`, `src/frontend/index.tsx`, `src/domain/canonicalizer.ts`, `crypto.ts`, `models.ts`, `tamper-detector.ts`, `src/storage/seal-repository.ts`, `src/validator/workflow-validator.ts`; plus `jest.config.js` and 8 test files (`canonicalizer`, `crypto`, `edge-cases`, `index`, `seal-repository`, `security-adversarial`, `tamper-detector`, `workflow-validator`). No em or en dash in any LedgerSeal file, the spec, the listing, the notes, the research folder or `tools/verifier`.
- **F-19** Doc drift (code wins): README test numbers 307 / 35 suites / 95.35% vs measured 315 / 36 / 95.54%; spec 5 manifest omits the work log events and the admin page; spec invariant 10 names `test/canonical-vectors.test.ts` (does not exist; it is `canonical-v2.test.ts`); spec 3.2 says "no name copy (A-5)" but `ledger.ts:400` stores `signerName`; spec 3.4 `PanelData` shape differs from the returned `TamperAnalysis`; the permission standard names key `[appPrefix]:cfg:approver_policy` and "exactly four scopes", the code uses `ls3:partyrole:LS_APPROVER` and B1 needs a fifth scope.
- **F-20** `write:jira-work` is used only for one issue property. A granular scope for issue properties would be narrower. Optional.
- **F-21** Playbook is stale: "PlanShift" (line 3), verifier repo `asymm-systems/ledgerseal-verifier` (404), "orange CHANGED" (the lozenge is red, `view-model.ts:157`), and it points auditors at the dev key (line 116).

## 4. Personal data map

| Where | Key or field | Personal data | Written by |
|---|---|---|---|
| KVS `ls3:wepa:{issueId}:{fromDate}` | `partyId`; `comments` (free-text reason) | signer account id; reason text | `ledger.ts:407-416` |
| KVS `ls3:we:{issueId}` | `currentAssignment.partyId` | signer account id | `ledger.ts:426-433` |
| KVS `ls3:wes:{issueId}:{seq}` | `setByPartyId`; `reason`; `data.signerName`; `data.changes[].changedBy[]` | sealer, revoker account ids; signer display name; editors' account ids | `ledger.ts:388-404`, `284-292`, `674-682` |
| KVS `ls3:content:{contentId}:{part}` | user field values `{accountId}`; `display` text of user fields (display names via `plainText`, `display.ts:30`); `comments[].authorAccountId`; `attachments[].authorAccountId`; work log `authorAccountId`; ADF mention `attrs.id` and `attrs.text`; all comment and field text | account ids and names of everyone on the issue; any personal data typed into the issue | `ledger.ts:385`, `canonicalizer.ts` |
| KVS `ls3:partyrole:LS_APPROVER` | `setByPartyId` | Jira admin account id | `policy-admin.ts:62-68` |
| KVS `cert:active:{issueId}` (v1, read only) | `sealedBy.signerAccountId`, `signerDisplayName`, optional `signerEmail` (`models.ts:52-55`) | development site only; never written by v2 | none (read only) |
| Issue property `ledgerseal-cert` (in Jira, not KVS) | `sealedByAccountId` | signer account id, readable by any issue viewer and JQL | `attestation.ts:76-93` |
| Evidence export (returned, not stored) | all of the above | as above | `ledger.ts:622-647` |

No email is stored by v2 code. Logs: `console.error` lines print issue ids only.

**Is the display name necessary?** No for function: `signerName` reaches only the validator `details` object, which `index.ts:143-153` drops, and `view-model.ts:333`, which `index.tsx` never renders (it uses `<User accountId>`). Its only argument is Part 11 11.50 "printed name"; since LedgerSeal does not claim Part 11 signatures, drop it from new rows (needs a new row schema; old rows keep theirs).

**What a fix must do (B1):**
1. Add `report:personal-data` and a weekly `scheduledTrigger`, as CascadePlan does (`apps/cascadeplan/manifest.yml:30-43`, `src/server/baselines.ts:216-244`). Report every account id from the rows above. KVS has no index of account ids, so keep one (for example `ls3:party:{accountId}` with the record keys and `updatedAt`) or scan with `kvs.query` by prefix, bounded per run.
2. On `closed`: the ids sit inside hashed data (`entryHash`, `recordHash`, `assignmentHash`, `snapshotHash`), so deleting them in place makes every read return RECORD_INVALID and the chain fail. Two workable designs: (a) redaction event: replace the id and name with a fixed token in every row and in the content, recompute the stored hashes, and append an `LS_REDACTED` status row that records the old head hash and the count of redacted values; teach the verifier the redaction row; or (b) pseudonymous storage from now on: store a per-account random token in hashed records and keep the token-to-account map in one separate key that is deleted on closure. (a) fits existing data; (b) is cleaner for new seals. Both need a new canonical form version and verifier support. The issue property must be rewritten without the id.
3. Handle issue deletion (F-11) and say in the privacy policy what is kept after uninstall: Forge hosted storage is deleted 28 days after uninstall (as the CascadePlan section states), and the `ledgerseal-cert` property stays on issues.
4. Signed snapshots after closure: the Jira issue itself still holds the closed account's anonymised user; the live canonical value then differs from the sealed `{accountId}` only if Jira changes the id (it does not on closure), so redaction must also apply the same token when canonicalising the live issue, or every sealed issue naming that person shows CHANGED.

## 5. Scope and egress map

| Call | Code | As | Scope |
|---|---|---|---|
| GET `/rest/api/3/issue/{id}?fields=*all,-comment` | `jira-client.ts:149` | app | read:jira-work |
| GET `/issue/{id}/comment` (paged) | `:153` | app | read:jira-work |
| GET `/issue/{id}/worklog` (paged) | `:157` | app | read:jira-work |
| GET `/field` | `:163` | app | read:jira-work |
| GET `/issue/{id}/changelog` (paged) | `:175` | app | read:jira-work |
| GET `/user?accountId=` | `:185` | app | read:jira-user |
| GET `/mypermissions?issueId=&permissions=ADMINISTER_PROJECTS,ADMINISTER` | `:191` | user | read:jira-work |
| GET `/myself?expand=groups` | `:200` | user | read:jira-user |
| GET `/mypermissions?permissions=ADMINISTER` | `:207` | user | read:jira-work |
| GET `/groups/picker` | `:214` | user | read:jira-user |
| GET `/group/bulk?groupId=` | `:223` | user | read:jira-user (live admin page check recorded in handover section 0) |
| PUT `/issue/{id}/properties/ledgerseal-cert` | `:231` | app | write:jira-work |
| `kvs.get/set/delete/transact`, `FAIL_IF_EXISTS` | `src/index.ts:24-56` | app | storage:app |
| `privacy.reportPersonalData` | not present | - | report:personal-data (missing, B1) |

- Every Jira path uses the `route` tag (`jira-client.ts`). No `fetch`, no `permissions.external`, no `remotes` (`manifest.yml`). No HTML insertion anywhere (`grep innerHTML` in `src/` and `packages/asymm-jira-ui/src`: none); UI Kit renders text only.
- Runs on Atlassian: the development deploy of 3.16.0 was reported eligible (`forge-deploy.log`). Both UI resources are UI Kit `render: native`, so no Custom UI CSP applies and there is no `'unsafe-inline'`. Icon is local (`resource:icons;icon.svg`, 328 bytes).
- Identity always comes from `context.accountId`; the issue always from `context.extension.issue` (`ledger.ts:85-89`). Write paths (seal, revoke, admin) check permission as the user first. Read paths (verify, history, evidence) do no permission check beyond the panel context (F-06).
- Signing key: read from Forge variables only, never logged (`attestation.ts:64-74`); vendor-held; rotation by new `keyId` (keys README). Evidence is re-signed at export time with the current key (`ledger.ts:642`), so rotation does not break old exports; old issue properties keep their old `keyId`.

## 6. Licensing result

- `app.licensing.enabled: true` (`manifest.yml:68-69`).
- `licenseInactive` (`ledger.ts:78-82`): no licence object counts as active (development); `active === false` or deprecated `isActive === false` is inactive.
- Checked in: seal, revoke, verify, history, evidence (`ledger.ts:318, 463, 549, 624, 655`) and every admin call (`policy-admin.ts:22`). Front end shows "LedgerSeal licence is not active" (`view-model.ts:120, 151`).
- Not checked in: the validator (by design D-8) and the event trigger (`ledger.ts:583-600`). Probe R3: on an inactive licence, a sealed unchanged issue still passes the gate, a change is still recorded with a property write, and an unsealed issue cannot be sealed, so it stays blocked (F-08).
- Answer: an unlicensed site cannot use the panel features. It keeps the gate on already sealed issues and keeps change recording. That is acceptable for a paid app, but F-08 must be fixed so a lapsed licence does not freeze workflows. Existing tests: `test/licensing.test.ts`. Live licence states: Not run (section 9).

## 7. Claims audit

| Claim (source) | Verdict | Evidence |
|---|---|---|
| SHA-256 snapshot of covered fields, comments, attachments (listing 11, 34) | True | `crypto.ts:14-37`, `canonicalizer.ts:275-368`; attachment content is not hashed (stated in spec 4.5) |
| Detects edits after approval and names who changed what (listing 11, 35) | True with gaps | `ledger.ts:247-263`; F-07 hides some object changes |
| Detects via issue, comment, attachment and work log events (listing 35) | True | `manifest.yml:37-47` |
| A user who changed the issue cannot approve those changes (listing 36, user guide 4, compliance SOC 2) | False for comments | F-01, probe R1 |
| ... or revoke the seal (listing 36) | False | B2, probe R2 |
| Hash-chained history from 64 zeros (listing 37) | True | `history.ts:15-72` |
| Validator blocks unsealed, changed, revoked, and when Jira cannot be read (listing 38) | True, with F-02, F-03 | `index.ts:75-154` |
| Ed25519 signed "when the vendor signing key is configured for the installation" (listing 39, notes 30, user guide 1, compliance) | Misleading | B5: key is per Forge environment; production has none |
| Approver groups admin page (listing 40, notes step 4) | True | `policy-admin.ts`, `admin.tsx`, `approver.ts` |
| Open-source offline verifier (listing 41, open-verifier page) | False (not public) | B3, HTTP 404 |
| Verifier exit codes 0/1/2 (listing 41, open-verifier 5) | True for `tools/verifier` only | F-17 |
| "about 120 lines" (open-verifier 2) | True | 117 lines |
| Verify "without trusting Jira or Asymm Systems", "complete cryptographic independence" (open-verifier 1) | False | B3 |
| SOC 2 CC8.1 / ISO 27001 A.8.32 "supports compliance" (listing 49-50, compliance 1-2) | Acceptable wording; the SoD rows inherit B2 | |
| 21 CFR 11.50 support (listing 51, compliance 3) | Misleading without the 11.200 boundary | B4 |
| "Records ... with Atlassian account IDs" (compliance 2) | True | section 4 |
| No external egress; calls only the site's Jira API (listing 60, notes 27, FAQ, compliance 4) | True | section 5 |
| Data in Forge storage; residency follows Atlassian (listing 61-62) | True | `index.ts:24-56` |
| Covered field set fixed by app version (user guide 6) | True | `canonicalizer.ts:81-100` |
| "View: anyone who can view the issue can see ... the evidence record" (user guide 6) | True (and see F-06) | `ledger.ts:622-647` |
| Free for up to 10 users with 100% of features (FAQ, listing pricing) | Consistent | no feature gate in code besides the licence |
| "Show details" on the details section (notes step 1) | True | `packages/asymm-jira-ui/src/layout.tsx:551` |
| Sample issues LSP-3 and DEMO-34 show SEALED and CHANGED (notes 3) | Not run (live) | section 9 |
| Icon bundled, no external URLs (notes 5.2) | True | `manifest.yml:6, 61-62` |

## 8. Test results

| Check | Command (in `apps/ledgerseal`, via `flatpak-spawn --host`) | Result |
|---|---|---|
| Install (clean clone, app first) | `npm ci` | FAIL: `packages/asymm-jira-ui` prepare, "tsc: not found" (F-09) |
| Install (documented order) | `npm ci` in `packages/asymm-jira-ui`, then in the app | exit 0 (warnings: deprecated `inflight`, `glob@7`, `@atlaskit/theme`; one unapproved install script `iframe-resizer`) |
| Type check | `npx tsc --noEmit` | exit 0, 0 errors |
| Unit tests | `npm test -- --coverage` | 36 of 36 suites, 315 of 315 tests pass, 17.6 s |
| Coverage (all files) | same | statements 98.47%, branches 95.54%, functions 96.23%, lines 98.99% (threshold 90%) |
| Build | `npm run build` (`tsc` to `dist/`) | exit 0 |
| Tracked files changed by the build | `git status --short` | none (only ignored `dist/`, `coverage/`, `node_modules/`) |
| Forge lint | `forge lint` (CLI 15.0.0, no login needed) | "No issues found." (warns Node 26 is unsupported) |
| Verifier self-test | `node verifier/verify-evidence.mjs --self-test` | PASS 10 of 10 vectors |
| Verifier tests | `node --test test/` in `tools/verifier` | 7 of 7 pass |
| Review probes | `npx jest test/zz-review.test.ts` | 8 of 8 pass (each confirms a finding: R1 F-01, R2 B2, R3 F-08, R4 F-03, R5 F-07, R6 F-06, R7 section 4, R8 F-02) |

Versions: `package.json` is `1.0.0`; Forge numbers its own versions per environment (development reached 3.16.0; production has none). The app id `ari:cloud:ecosystem::app/7489a645-7c96-400a-b289-eb36f2701a00` is the same in the manifest, the notes and the checklist. `package.json` is not read by Forge; set it to the release version you put in release notes, so support can map a customer report to a commit.

## 9. Not run, with exact steps

1. **Validator payload shape (F-02, F-03).** On a development install: add a temporary `console.log(JSON.stringify(payload))` in `validateTransition`, deploy to development, add the validator to a transition whose screen has Summary and Comment, run the transition with a changed summary and a comment, read `forge logs -e development`. Check where `modifiedFields` sits and the value shape of each field.
2. **Licence states.** `forge install --upgrade -e development --license active`, then `--license inactive`; open the panel and the admin page; run a gated transition on a sealed and an unsealed issue. Expected: panel shows the licence message; gate behaviour per F-08.
3. **Production deploy and key (B5, B7).** `forge variables set -e production --encrypt LEDGERSEAL_SIGNING_KEY <b64>`; `forge variables set -e production LEDGERSEAL_KEY_ID ls-prod-<yyyy-mm>`; `forge deploy -e production`; after approval, install, seal one issue, export evidence, run `node tools/verifier/verify-evidence.mjs evidence.json keys/ls-prod-<id>.pub.pem`; expect exit 0.
4. **Restricted comments (F-06).** Add a comment restricted to a role the viewer lacks; open the panel as that viewer on a sealed issue; check whether the body appears in "Changed items" or in "Show evidence (JSON)".
5. **Large issue limits (F-10, KVS).** Seal an issue with about 2 MB of description and attachments metadata (21 to 22 content parts) to check the 25-operation transaction succeeds within the KVS request size limit; time `verify-issue-api` on an issue with 3,000 change log entries.
6. **Reviewer sample issues.** Open `LSP-3` and `DEMO-34` on asymmsystems.atlassian.net and confirm the states the notes promise; reviewers will see the DEV build unless production is installed.
7. **Issue panel visibility (F-12).** Open a fresh issue as a non-admin and record how many clicks it takes to open the Approval Seal panel.

## 10. First customer: steps to value, and friction

Steps after install:
1. A Jira admin opens Jira Settings, Apps, "LedgerSeal approvers" and adds approver groups (optional; project and Jira admins can seal without it).
2. A Jira admin edits each company-managed workflow, adds the "Require Valid LedgerSeal" validator to the release transition, and publishes the workflow. Without this step LedgerSeal only reports; it does not gate.
3. An approver opens an issue, opens the Approval Seal panel from the issue's app button, clicks "Seal this issue", chooses the meaning, ticks the declaration, clicks "Sign and seal".
4. After an edit, the panel shows CHANGED with Was and Now; another approver clicks "Approve these changes" with a reason.
5. For an audit, someone opens "Show details", "Show evidence (JSON)", copies the JSON into a file and runs the verifier with the published production key.

Time to first value: about 5 minutes for one sealed issue; about 15 to 30 minutes more per workflow for the gate.

Main friction:
- The panel must be opened per issue (F-12); the validator message points users to a panel they may not see.
- No onboarding in the app: nothing tells the admin that the validator exists or which workflows lack it. The admin page covers groups only.
- Unsealed issues block at the gate with no bulk seal; teams adopting it on a busy project hit many blocked transitions on day one.
- Any approver who touched the issue after the seal, even by a status move, cannot approve (F-13), so small teams can lock themselves out.
- Evidence is copied by hand from a code block; there is no download (F-15). Verifier needs Node 18 and a key file that is not public yet (B3, B5).
- The "Open Four Realities panel" button confuses customers who did not buy FourRealities (F-04).
