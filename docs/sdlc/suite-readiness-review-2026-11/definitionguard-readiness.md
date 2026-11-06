# DefinitionGuard: Marketplace readiness review (paid app)

- Date: 2026-11-06. Reviewer: independent review session. Static review, unit tests, build and local checks only. No live Jira site, no cookies, no deploy.
- Code reviewed: clone of `/home/fahimfarookme/Documents/projects/gemini-earning-cp-fixes` at HEAD `1e1318bcf7f1176f69adacdf74faf8e8ef6989f4` (branch `feature/cascadeplan-marketplace-fixes`), in `~/.cache/suite-readiness-2026-11/definitionguard/checkout`. App folder `apps/definitionguard`.
- The brief says DefinitionGuard on this branch is identical to `origin/master` (`907ccd7`). It is not. `git diff --stat 907ccd7 HEAD -- apps/definitionguard` shows 5 files: `package-lock.json` (new), `.npmrc` (new), `package.json` (adds `@asymm/jira-ui` as `file:` dependency), `tsconfig.json` and `jest.config.js` (path mapping removed). Source and tests are the same. These 5 changes are needed for a clean-clone build (commit `628bb79`).
- Forge CLI note: `forge lint`, `forge eligibility`, `forge variables list` and `forge environments list` ran with a scratch `HOME`, but the CLI still used the owner's stored Forge login (system keychain). All four calls are read only. Nothing was deployed or changed.

## 1. Verdict

**Ready after the listed fixes.** Do not submit today. The core product is sound: the gate rule is single and fails closed, writes are race-safe, every write resolver checks the caller's Jira permission as the user, the build is clean, CI is green on HEAD, and 347 tests pass with 96.28% branch coverage. But seven things block a paid submission. The app stores Atlassian account ids and has no personal data report (BL-1). Production runs an old build from 2026-10-29 with no signing key, while the listing says the property is signed and points to a public key in a private repository (BL-2). Three of five screenshots show something else or a mock-up, and all five have the wrong size (BL-3). An inactive licence makes the validator block every transition it sits on, even when the Definition of Done is complete (BL-4). Production dependencies have 8 high vulnerabilities (BL-5). Two compliance lines in the listing overstate what the app does, and the old listing with wrong prices is still in the repo (BL-6). Reviewer notes depend on the owner's own site (BL-7). Total estimate: about 3 to 4 working days, most of it BL-1 and BL-3.

## 2. Blockers

| ID | Blocker | Evidence | Fix | Size |
|---|---|---|---|---|
| BL-1 | **No personal data report.** The app stores Atlassian account ids in app storage and in a Jira issue property, but has no `report:personal-data` scope, no scheduled trigger and no `report-accounts` call. Atlassian requires periodic reporting and erasure of closed accounts. | `manifest.yml:58-64` (5 scopes, no `report:personal-data`, no `scheduledTrigger`). `grep -rn "privacy\|report-accounts" src` finds nothing. Stored fields: section 4. | Follow CascadePlan (`apps/cascadeplan/src/server/baselines.ts:216-244`, `apps/cascadeplan/src/storage/personal-data.ts`, `manifest.yml` `scheduledTrigger` `interval: week` and scope `report:personal-data`). DefinitionGuard has an extra problem: account ids sit inside hash-chained events (`src/domain/event-log.ts:181,191,227`), so rewriting them breaks the history check, and inside a signed property (`src/integrity/attestation.ts:56`). Recommended design: (a) keep an index `dg:acct:<accountId>` with `updatedAt` and the keys that hold it, written on every change; (b) store a per-site pseudonym (HMAC of the account id with a per-install secret) in event rows and keep the pseudonym-to-account map outside the chain, so erasure deletes the map entry and the chain still verifies; (c) on `closed`, clear `lastModifiedByPartyId` and `lastStatusByPartyId` in `dg:state:*`, `lastModifiedByPartyId` in `dg:tmpl:*`, `updatedByAccountId` in `dg:proj:*`, `setByPartyId` in `dg:cfg:approver_policy`; (d) drop `lastModifiedByAccountId` from the `definitionguard-dod` property (schema v3; FourRealities does not read it, checked by grep) or rewrite and re-sign it on erasure. Production has no customer data yet, so change the format before launch. Update the privacy page to say ids are reported weekly. | M |
| BL-2 | **Production is not the reviewed build and is not signed.** The listing says "On every change the app writes a summary ... and signs it with Ed25519" and "The public key ... is published in `docs/marketplace/definitionguard-public-key.pem`". | `forge environments list`: production last deployed 2026-10-29T09:01:39Z, development 2026-11-03 (5.0.0). `forge variables list -e production`: "There are no variables in the production environment." Development has `DG_SIGNING_KEY` (encrypted) and `DG_SIGNING_KEY_ID=dg-dev-2026-11`. Without the variable the code writes `sig: null` silently (`src/integrity/attestation.ts:80-88`; a warning is logged only for an unusable key). `gh repo view`: the repository is `PRIVATE`, and the site source has no copy of the key (grep for `BEGIN PUBLIC KEY` in the site source: 0 hits). | Generate a production key pair. `forge variables set --encrypt -e production DG_SIGNING_KEY ...` and `DG_SIGNING_KEY_ID` (for example `dg-prod-2026-11`). Deploy HEAD to production. Publish the production public key at a public URL on asymm.systems and put that URL in the listing. Optionally log a warning once when the key is missing. | S |
| BL-3 | **Screenshots are not the shipped app or have the wrong size.** | `03-transition-blocked.png` is a mock-up modal with an "Acknowledge" button that does not exist (viewed). The listing itself marks 02, 03 and 04 "RECAPTURE REQUIRED" (`docs/marketplace/definitionguard-listing-v2.md:123-125`). `file` shows all five at 1840x1150; CascadePlan's review records the rule as 1840x900 (`docs/sdlc/cascadeplan-marketplace-review-2026-11/report-v2.md` BL-7). `01-checklist-open.png` shows DEV badges, other apps in the sidebar, and the issue in status **Done** while the panel says "Incomplete", which contradicts the gate. `05-audit-export.png` shows the owner's name and account id. | Recapture all five on a clean probe issue in a non-DEV view, at 1840x900, with the validator on the Done transition: panel, evidence form, real Jira transition error, settings page with coverage, export. Use a demo user, not the owner's account. | M |
| BL-4 | **An inactive licence blocks every gated transition, even complete ones.** | `src/index.ts:120-122` returns `result: false` before any other check when `context.license.isActive === false`. The message tells the customer to renew or remove the validator (`src/security/licence.ts:12-14`). Covered by `test/security/licence.test.ts` (the "(V-a, V-b)" test). | Judgement in section 6: when the licence is inactive, let the transition through (`result: true`) and show the licence notice in the panel. A lapsed customer then loses the gate, not their ability to close work. Keep blocking on errors when licensed. | S |
| BL-5 | **8 high vulnerabilities in production dependencies.** Atlassian's security workflow requires critical and certain high findings to be fixed. | `npm audit --omit=dev --audit-level=high`: "13 vulnerabilities (5 moderate, 8 high)", exit 1. Root: `prosemirror-view@1.41.5` (GHSA-c8x8-7fp4-3x9w) through `@forge/react` and `@forge/bridge`. CascadePlan passes the same audit (exit 0) with `"overrides": { "prosemirror-view": "^1.42.3" }` (`apps/cascadeplan/package.json:42-44`). CI audits only CascadePlan (`.github/workflows/apps-ci.yml`, step "Dependency audit", `if: matrix.app == 'cascadeplan'`). | Add the same override, regenerate the lock file, re-run tests. Run the audit step for every app in CI. | S |
| BL-6 | **Listing and repo claims that are not true.** | (a) "SOC 2 Type II (CC8.1 & CC7.2)" (`listing-v2.md:74`): CC7.2 is anomaly monitoring of system components; a DoD gate does not do that. The public compliance page maps DefinitionGuard to CC8.1 only. (b) "GxP ... record of verification and review sign-offs" (`listing-v2.md:76`): the app records ticks by account id. It has no electronic signature (no re-authentication, no signature meaning). In a GxP context "sign-off" reads as a Part 11 signature. (c) The public-key claim (BL-2). (d) The old listing `docs/marketplace/definitionguard-listing.md` still says $1.00/$0.80/$0.40 (lines 29-31), "Inherits enterprise SOC 2, ISO 27001, and GDPR compliance" (line 18), "Least Privilege: Restricted to read:jira-work and storage:app" (line 23) and "100% automated test coverage" (line 24). The developer console checklist row "Real Screenshots" points to `docs/marketplace/<app>-listing.md`, which for DefinitionGuard is this old file (`developer-console-checklist.md:18`). | Drop CC7.2. Reword GxP to "keeps a hash-chained record of who ticked or waived each item and why; it does not provide electronic signatures", or remove GxP. Fix BL-2. Delete `definitionguard-listing.md` (v2 is the live listing: `test/listing.test.ts:11`, playbook line 42) and point the checklist at v2. Correct the stale price in `handover-gemini.md:101`. | S |
| BL-7 | **Reviewer notes depend on the owner's site.** | `definitionguard-submission-notes.md:36-39` sends the reviewer to `asymmsystems.atlassian.net`, project DEMO, issue DEMO-35. Marketplace reviewers install on their own site. The notes also omit the approvers admin page and the licence behaviour, and say the property holds "completion counts, open mandatory item IDs, and the history head hash" (line 19) but not the account id and signature it also holds. | Rewrite section 3 and 4 as fresh-site steps: install, add the validator to the Done transition, open an issue, tick, waive, try Done, open settings and the approvers page. List every field of the property. | S |

## 3. Findings by severity

Each finding: location, scenario, status (Confirmed by code or test, or Plausible), fix.

### High

- **H-1 Separation of duties can be bypassed by a waiver.** `src/index.ts:346-380`: `waiveChecklistItem` checks approver or waiver permission only. It never checks `excludedRoleTypeId`. `src/domain/gate-rule.ts:20` counts every waived item as done before the assignee check on line 23. Scenario: the assignee is a project admin (common in small teams and team-managed projects). They waive "Peer code review" with a 10-character reason and move the issue to Done. Confirmed. Fix: refuse a waiver of a not-the-assignee item by the current assignee, and in the validator count a waived not-the-assignee item as open when the waiver actor is the current assignee.
- **H-2 Not-the-assignee is checked only against the current assignee.** `src/index.ts:492` and `166-169`. Scenario: the assignee unassigns the issue, ticks "Peer code review", then leaves it unassigned (or assigns a colleague) and moves it to Done. The validator passes. Confirmed. The listing problem statement (`listing-v2.md:20`, "Self-Review Loopholes") implies this is closed. Fix: also refuse when the actor was an assignee of the issue at any time since the item opened (read the assignee changelog), or state the limit in the listing and guide.
- **H-3 Validator licence source may be absent.** `src/security/licence.ts:17` reads `context.license` from the function's second argument. For resolvers `@forge/resolver` fills it (`node_modules/@forge/resolver/out/index.js:39`). For the workflow validator the code relies on Forge passing `license` in the raw function context. `@forge/api` 8 exposes `getAppContext().license` for any invocation (`node_modules/@forge/api/out/api/runtime.d.ts:144`). Plausible: if the validator context has no `license`, an unlicensed site keeps the paid gate. Fix: read `context?.license ?? getAppContext().license` in all paths; verify live with `forge install --license inactive` (section 9).

### Medium

- **M-1 Approver audit line never shows the configured groups.** `toPanelResponse` (`src/index.ts:251-267`) never sets `approverGroups`; `approverGroupNames` is imported (`src/index.ts:31`) but unused. The panel always says "Authorized approvers: project administrators and Jira administrators." (`src/ui/panel-view-model.ts:89`), also visible in screenshot 01. Confirmed. Fix: add `approverGroups: await approverGroupNames(storage)` to the panel response and mention the template waiver permission.
- **M-2 Dead "Open Four Realities panel" button.** `src/frontend/index.tsx:203-210` opens `/browse/<issueKey>`, the same issue, in a new tab. A customer without FourRealities sees a button that does nothing useful. Confirmed. Fix: remove it, or show it only when the FourRealities property exists.
- **M-3 Admin page text promises actions approvers do not have.** `src/frontend/admin.tsx:38,45` and the permission standard (`docs/design/uniform-permission-management-standard.md` section 4) say approvers "baseline criteria, sign off Definition of Done, and authorize deviations". In code approvers can waive, reopen a waiver and reset (`src/index.ts:364,487,521`). Templates need Administer projects (`src/settings/settings-resolvers.ts:35-38`); there is no sign-off action. Confirmed. Fix: "waive items with a reason, reopen waived items and reset checklists".
- **M-4 No cleanup when an issue is deleted.** No `avi:jira:deleted:issue` trigger in `manifest.yml`. `dg:state:*` and `dg:evt:*` for deleted issues (account ids, evidence notes, reasons) stay until uninstall. CascadePlan has `issue-deleted-fn`. Confirmed. Fix: add the trigger and delete the issue's keys.
- **M-5 The panel must be added per issue.** `jira:issuePanel` (`manifest.yml:2-9`). The round log records that the panel was "added from the issue-view button" (`round-log.md`, live write 2). The validator message says "Open the DefinitionGuard panel" (`src/domain/gate-rule.ts`, `blockMessage`) but the panel title is "Definition of Done" (`manifest.yml:4`). Plausible friction: a blocked user does not know where to look. Fix: say "Open the Definition of Done panel (Apps button on the issue)" in the message, and document it.
- **M-6 Built-in templates apply everywhere by default.** `src/settings/template-store.ts:130-138` falls back to a built-in template on every issue type. Once a Jira admin adds the validator to a shared workflow, every project on it needs the built-in items ("Peer code review approved by authorized reviewers", "Compliance and regulatory sign-off ..."). The settings page shows an empty editor when no project template exists (`src/ui/template-editor.ts:46-47`), so an admin cannot see or start from the items that already apply. Confirmed. Fix: load the built-in template into the editor as a starting point and say "Currently using the built-in template X".
- **M-7 Admin page hangs or stays silent on errors.** `src/frontend/admin.tsx:25-29` has no `catch`, so a failed load leaves the spinner forever. Line 59 sets a notice only on success; a failed save shows nothing. Confirmed. Fix: catch and show the error.
- **M-8 Re-sync may hit the invocation limit.** `src/settings/settings-resolvers.ts:117-157` processes 25 issues per call in series. Each does several KVS reads, two writes and a property PUT that retries up to 3 times with 1 to 5 s waits (`src/integrity/attestation.ts`, `publishAttestation`). Under Jira rate limiting one page can exceed 25 s. Plausible. Fix: page size 10, or stop and return a cursor when `getRemainingTimeInMillis()` is low.

### Low

- **L-1 Read resolvers do not check Jira permission.** `getIssueChecklist`, `getChecklistHistory`, `getItemEvidence` (`src/index.ts:285-316,386-402`) read app storage with the issue id from the Forge context. The user opened the panel on the issue, so they can see it. Plausible defence-in-depth gap only. Fix: one `BROWSE_PROJECTS` check per load.
- **L-2 Re-sync searches as the app.** `src/settings/settings-resolvers.ts:128-130` uses `asApp()` search. A project admin can re-sync checklists of issues hidden from them by issue security. Confirmed, low impact. Fix: search `asUser()`.
- **L-3 Any permission key is accepted from a direct call.** `PERMISSION_PATTERN` (`src/settings/template-store.ts:30`) accepts any upper-case word. A template with `requiredPermission: "FOO"` makes `/mypermissions` fail, so the item can never be ticked, only waived. The UI offers 3 valid keys only. Fix: validate against a fixed list.
- **L-4 Validator worst case under rate limits.** Up to three Jira reads, each with up to 2 waits capped at 5 s (`src/jira/jira-client.ts:10-11,25-32`): about 30 s worst case, above the 25 s Forge limit. The result is still a block. Plausible.
- **L-5 Dead v1 code.** `ChecklistEngine` and `src/domain/hasher.ts` are used only by tests and `getTemplateForCategory`; `getAvailableTemplates` is exposed as an unauthenticated resolver (`src/index.ts:583-585`, static data only).
- **L-6 Template save race.** Two admins saving at once both write revision N+1 (`src/settings/template-store.ts:111-121`); re-sync compares only `revisionNumber`. Fix: `FAIL_IF_EXISTS` on a revision key.
- **L-7 Repo rules.** Missing header: `test/domain/checklist-engine.test.ts`, `test/domain/hasher.test.ts` (the hygiene test checks `src/` only, `test/hygiene.test.ts:15-20`). Config files (`jest.config.js`, `manifest.yml`, `tsconfig.json`) have none, as in CascadePlan. Em and en dash scan over `apps/definitionguard`, the DefinitionGuard docs and the site guide: 0 hits.
- **L-8 Doc and code differences (code wins).** `handover-gemini.md:35` says people "are read live from Jira, never stored" (they are stored, section 4); line 40 lists 4 scopes (manifest has 5). `apps/definitionguard/README.md:13-26` omits `read:jira-user` and the admin page and still says `node_modules` is a link to LedgerSeal. Spec v3 section 5 gives Waive and Reset to `waiverRoleTypeId` and ADMINISTER_PROJECTS only; code also allows approver groups (`src/index.ts:364,521`). The permission standard says "exactly four scopes"; DefinitionGuard needs five. Listing row B-07 "never stored by name": migrated v1 records keep `setByLegacyName` (`src/domain/event-log.ts:133`). The playbook still says "PlanShift" (line 3) and "peer-review rules" (line 19).

### Checked and found correct

- No controlled `Textfield` remains: panel fields have `onChange` only (`src/frontend/index.tsx:295-305,338-343`); settings fields use `defaultValue` and remount by `key` (`src/frontend/settings.tsx:185-200,244`); the shared admin search field is uncontrolled (`packages/asymm-jira-ui/src/admin.tsx:201-206`).
- Every write resolver checks permission as the user before writing: tick (`EDIT_ISSUES` plus required permission, `src/index.ts:478-494`), waive, reset, export (`ADMINISTER_PROJECTS`), settings (`ADMINISTER_PROJECTS` per project, `settings-resolvers.ts:35-38`), approver policy (global `ADMINISTER`, `policy-admin.ts`). Permission failures deny (`src/security/permissions.ts:26-41`).
- Issue and project ids come from the Forge context, never the payload (`src/index.ts:203-217`, `settings-resolvers.ts:27-33`).
- XSS: UI Kit only, no HTML. Evidence links must be `http(s)` (`src/domain/evidence.ts`), so `Link href` never gets another scheme.
- Concurrency: each change appends `dg:evt:<id>:<seq>` with `FAIL_IF_EXISTS`, retries 3 times, and readers fold forward over newer events (`src/storage/checklist-store.ts`, `mutate` and `load`). A crash between event and state write loses nothing.
- Validator: fails closed on any error (`src/index.ts:111-117`), never writes, never reads the issue property, gates only Done-category targets, honours exempt statuses, re-checks the not-the-assignee rule, applies the template in memory when no record exists.
- Forge KVS sizes: state at most 32 KiB after 1,000 toggles of 50 items; each event at most 2 KiB; history paged by 100 (`test/storage/size-budget.test.ts:62-114`). The template cap is 32 KiB (`template-store.ts:15`). All far under the 240 KiB value limit.
- No HeroCoders or other checklist integration exists in code; none is claimed.

## 4. Personal data map

| Where | Key or field | Content | Reported | Erased |
|---|---|---|---|---|
| KVS event (hash-chained) | `dg:evt:<issueId>:<seq>` `.actorPartyId` | account id (or `system`, `unknown`) | No | No |
| KVS event | `.rows[WorkEffortStatus].setByPartyId` | account id | No | No |
| KVS event | `.rows[WorkEffortStatus].setByLegacyName` | v1 display name (migrated records only) | No | No |
| KVS event | `.rows[WorkEffortStatus].reason`, `.rows[Content].textData`, `.objectInfo` | free text and URL; may hold personal data | n/a | No |
| KVS state | `dg:state:<issueId>` `.lastModifiedByPartyId`, `.criteria[].lastStatusByPartyId`, `.criteria[].legacyName` | account id, v1 name | No | No |
| KVS v1 record (read only) | `dg:checklist:<issueId>` `completedBy`, `completedByAccountId`, `auditTrail[].actorName/actorAccountId`, `items[].history[].userId/userAccountId` | names and account ids (development only) | No | No |
| KVS template | `dg:tmpl:<projectId>:<issueTypeId>` `.lastModifiedByPartyId` | account id | No | No |
| KVS project config | `dg:proj:<projectId>` `.updatedByAccountId` | account id | No | No |
| KVS approver policy | `dg:cfg:approver_policy` `.setByPartyId` | account id | No | No |
| Jira issue property (signed) | `definitionguard-dod` `.lastModifiedByAccountId` | account id | No | No; stays after uninstall |
| Resolver output only | export `.exportedByAccountId` | account id, not stored | n/a | n/a |

Uninstall: Forge deletes app storage (the privacy page says after 28 days); the issue property stays with each issue. There is no uninstall or issue-deleted handler (M-4). Logs contain no account ids (`console.warn` texts in `src/integrity/attestation.ts`). The privacy page lists account ids of who completed items and who acted (`privacy.html`, section DefinitionGuard), but not the property field or the free-text notes.

## 5. Scope and egress map

| Call (file:line) | As | Scope |
|---|---|---|
| `GET /rest/api/3/issue/{id}?fields=...` (`src/index.ts:54,71,332`) | app; user for assignee | `read:jira-work` |
| `GET /rest/api/3/status/{id}` (`src/index.ts:180`) | app | `read:jira-work` |
| `GET /rest/api/3/mypermissions` (`src/security/permissions.ts:52,62`, `approver.ts`) | user | `read:jira-work` |
| `GET /rest/api/3/myself?expand=groups` (`src/security/approver.ts:66`) | user | `read:jira-user` |
| `GET /rest/api/3/groups/picker`, `GET /rest/api/3/group/bulk` (`src/security/policy-admin.ts:58,105`) | user (Jira admin) | `read:jira-user` |
| `GET /rest/api/3/project/{id}`, `/project/{id}/statuses` (`src/settings/settings-resolvers.ts:43,53`) | user | `read:jira-work` |
| `GET /rest/api/3/search/jql` (`settings-resolvers.ts:128-130`) | app | `read:jira-work` |
| `GET /rest/api/3/workflows/search` (`src/settings/coverage.ts:83`) | app | `read:workflow:jira` |
| `PUT /rest/api/3/issue/{id}/properties/definitionguard-dod` (`src/integrity/attestation.ts`) | app | `write:jira-work` |
| Forge KVS `get`, `set`, `query` (`src/storage/forge-storage.ts`) | app | `storage:app` |
| Personal data report (missing, BL-1) | app | `report:personal-data` (missing) |

Every declared scope is used and no call needs an undeclared one, except the missing report scope. No `external` fetch, no remotes, no Custom UI (all three resources are UI Kit, `render: native`), so no CSP block is needed. `forge eligibility`: "The version of your app [5.0.0] that's deployed to [development] is eligible for the Runs on Atlassian program." Production (older build) was not checked. Licensing `enabled: true` (`manifest.yml:55-56`). Icon is local (`resource:icons;check.svg`, `manifest.yml:6`); Marketplace `icon.png` is 144x144. The app name is set in the Developer Console, not in the manifest; check it shows "DefinitionGuard" there.

## 6. Licensing result

- Writes are refused with an inactive licence: tick, reset, waive (`src/index.ts:353,450,519`), template, exemptions and re-sync (`settings-resolvers.ts:86,97,118`). Reads stay allowed. Tested in `test/security/licence.test.ts`.
- Not gated: approver policy save (`src/security/policy-admin.ts`). Low risk.
- Validator: blocks every transition when the licence is inactive, before it reads anything (`src/index.ts:120-122`). This includes issues whose Definition of Done is complete and moves into non-Done statuses if an admin put the validator there.
- Judgement: blocking is the wrong default. The customer stopped paying for enforcement; the fair result is that enforcement stops, not that nobody can close work until a Jira admin edits every workflow. It also creates support tickets and refund pressure at the worst moment. Recommended: return `result: true` when the licence is inactive, and show "DefinitionGuard is not licensed, so the gate is off" in the panel and settings page (BL-4). Keep fail-closed for errors on licensed sites.
- Licence source for the validator: see H-3. Free 1 to 10 user tier: the licence is active, so all features work, which matches the FAQ.

## 7. Claims audit

| Claim (source) | True in code? | Evidence |
|---|---|---|
| Per-issue-type templates, re-sync (listing-v2:32) | Yes | `settings-resolvers.ts:96-157` |
| Evidence required: link (http/https), note or both; format only (listing-v2:33) | Yes | `src/domain/evidence.ts`, `src/index.ts:472-474` |
| Not the assignee cannot tick; validator re-checks (listing-v2:34) | Yes, literally. Bypass in H-1, H-2 | `src/index.ts:492`, `166-169` |
| Waivers by approvers or waiver permission, reason 10 to 500 (listing-v2:35) | Yes | `src/index.ts:346-380` |
| Gate blocks Done-category moves, exempt statuses, blocks on errors (listing-v2:36) | Yes when licensed. Unlicensed: blocks all (BL-4) | `src/index.ts:111-200` |
| Gate coverage check (listing-v2:37) | Yes | `src/settings/coverage.ts` |
| Hash-chained history of every change (listing-v2:38) | Yes | `src/domain/event-log.ts` |
| JSON export, project admins (listing-v2:39) | Yes | `src/index.ts:410-432` |
| B-07 "never stored by name" (listing-v2:55) | Mostly; v1 names kept on migration | `event-log.ts:133` |
| At least 90% branch coverage per source file (listing-v2:103) | Yes; lowest `src/index.ts` 91.93% | section 8 |
| Signed with Ed25519 on every change (listing-v2:101, B-14 row) | **No on production** (no key) | BL-2 |
| Public key published in `docs/marketplace/...pem` (listing-v2:101) | **No**: private repo, not on site | BL-2 |
| SOC 2 CC7.2 (listing-v2:74) | **No** | BL-6 |
| GxP "review sign-offs" (listing-v2:76) | **Misleading** | BL-6 |
| No external egress (listing-v2:85, notes 2) | Yes | manifest, section 5 |
| Scopes list (listing-v2:94-98) | Yes; missing `report:personal-data` after BL-1 | `test/listing.test.ts:49-55` |
| Prices $1.50/$1.20/$0.90, annual 10x (listing-v2:111-114) | Matches console checklist 2.3 | old listing: wrong (BL-6) |
| Property holds counts, open ids, head hash (notes:19) | Incomplete: also account id, signature | `attestation.ts:43-57` |
| Site guide: approver groups can waive; reset by admins and approvers | Yes | `src/index.ts:364,521` |
| Site guide: validator "has no options"; message text | Yes | `manifest.yml:25-30`, `gate-rule.ts` |
| Site compliance page: separation of duties, evidence before Done | True literally; see H-1, H-2 | |
| Site FAQ: zero egress for every app; free tier full features | Yes for DefinitionGuard | |
| Privacy page: account ids of completers and actors | Partial: omits property field, not reported weekly | section 4 |
| Admin page: approvers "baseline criteria, sign off Definition of Done" | **No** | M-3 |
| Panel: "Authorized approvers: project administrators and Jira administrators" | **Wrong when groups are set** | M-1 |

## 8. Test results

| Check | Command (in the clone, through `flatpak-spawn --host`) | Result |
|---|---|---|
| Shared UI install | `npm ci` in `packages/asymm-jira-ui` | OK |
| App install | `npm ci --no-audit --no-fund` in `apps/definitionguard` | 662 packages; `node_modules/@asymm/jira-ui/dist/index.js` exists. Host node v26.13.0, npm 11.20.0 |
| Type check | `npx --no-install tsc --noEmit` | exit 0 |
| Tests | `npm test -- --coverage` | 28 of 28 suites, 347 of 347 tests passed, 17.6 s |
| Coverage | same | Statements 99.16%, Branches 96.28%, Functions 97.23%, Lines 99.17%. Lowest branch: `src/index.ts` 91.93%, `settings-resolvers.ts` 91.11%. Frontend `.tsx` not measured (`jest.config.js` excludes `src/frontend/**`) |
| Build | `npm run build` (`tsc`) | exit 0. `git status --short` empty: `dist/` and `coverage/` are git-ignored; no tracked file changes |
| Forge lint | `forge lint` (CLI 15.0.0) | "No issues found." |
| Runs on Atlassian | `forge eligibility` | development 5.0.0 eligible |
| Dependency audit | `npm audit --omit=dev --audit-level=high` | **8 high, 5 moderate, exit 1** (BL-5) |
| CI on HEAD | `gh run view 42134853441` | success for all four apps, including definitionguard |
| Hygiene | header and dash scans | section 3, L-7 |

**The reported CI failure.** Run `42094422053` (commit `7049e64`, before master was merged) failed in "Tests with coverage thresholds": `test/listing.test.ts` 5 failed, 342 passed. Cause: the test checks `docs/marketplace/definitionguard-listing-v2.md`, but at `7049e64` that file was the suite-format rewrite from `c173422`. It contained "tamper-evident", had no backlog table rows (`/^\| [A-Z].* \| B-\d\d/` matched 0, expected 10 or more), no `## Security` scope list, no "does not protect against the vendor" text, and no "A Jira admin adds the DefinitionGuard validator ..." text. Master `907ccd7` restored the listing to match the test, and `1e1318b` merged it. The test now passes locally and in CI run `42134853441`. No further fix is needed. Note: master itself has no `apps-ci.yml` (it lives only on this branch), so CI never ran "on master"; at `f69804e` the listing would also have failed (0 `## Security` headings).

## 9. Not run

| Check | Why | Exact steps |
|---|---|---|
| Licence states live, including H-3 | Needs the live site | `forge deploy -e development`; `forge install --upgrade -e development --site <test site> --product jira --license inactive`; add the validator to a Done transition; try Done on a complete and an incomplete issue; repeat with `--license active` and `--license trial`. |
| Validator after uninstall | Needs the live site | Uninstall from a test site with the validator still on a workflow; try a transition; record whether Jira blocks or skips it. Put the result in the guide. |
| Production deploy and signed property | Owner decision and live | After BL-2: `forge deploy -e production`; install on a test site; tick an item; `GET /rest/api/3/issue/<id>/properties/definitionguard-dod`; verify `sig` with the published production key. |
| Personal data report | Not built | After BL-1: invoke the trigger with `forge webtrigger` or a test hook; check the `report-accounts` response; close a test account and check erasure and that the history check still passes. |
| Panel per issue (M-5), keyboard and screen reader | Needs the live site | Open a fresh issue as a non-admin user; record how they find the panel; Tab through checkboxes, evidence and waiver forms. |
| Team-managed project | Needs a team-managed project | Create one, add the validator through its workflow rules, repeat the gate test. |
| Developer Console app name, Privacy and Security tab, security questionnaire | Needs the owner's sign-in | Check the listing name is "DefinitionGuard"; fill the questionnaire from section 5 of this report. |
| Public URLs | Not fetched in this review | `curl -sI` on the five URLs in `listing-v2.md:132-136`; the console checklist records terms and support as 200 on 2026-11-06. |

## 10. First customer: steps to value, and friction

1. Install from the Marketplace (Jira admin). The panel shows on issues at once with a built-in template matched on the issue type name (Bug, Story, Task, Service request, IT help, else the standard one).
2. Open an issue and add the "Definition of Done" panel from the issue's app button (M-5). Tick items, add evidence, waive with a reason.
3. To get the gate, a Jira admin opens each workflow, adds "DefinitionGuard DoD Enforcement" to every transition into a Done-category status, and publishes. The app cannot do this (`coverage.ts` header). In a company-managed site with many workflows this is the longest step.
4. A project admin opens Project settings > DefinitionGuard, checks Gate coverage ("x of y completion transitions are gated"), ticks exempt statuses such as Canceled, and saves.
5. Optional: the project admin writes a template per issue type and re-syncs open issues.
6. Optional: a Jira admin opens Apps > DefinitionGuard approvers and picks groups who may waive and reset.

Time to first value: minutes for the checklist; the gate needs a Jira admin and a workflow edit, often a separate person and a change window.

Main friction:
- The gate needs workflow edits by a Jira admin on every Done transition (step 3).
- The built-in template applies to every project on a gated workflow, and the editor does not show it (M-6).
- Users must find and add the panel per issue; the block message names "DefinitionGuard" while the panel is titled "Definition of Done" (M-5).
- The approver line does not show the configured groups (M-1), and the admin page describes powers approvers do not have (M-3).
- A dead "Open Four Realities panel" button (M-2).
- An inactive licence stops all gated work (BL-4).
