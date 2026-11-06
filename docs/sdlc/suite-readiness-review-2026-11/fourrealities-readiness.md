# FourRealities: Marketplace readiness review (paid app)

- Date: 2026-11-06. Reviewer: independent review session. Static review, unit tests, build and local checks only. No live Jira site, no deploy.
- Code reviewed: own clone `~/Documents/projects/jira-governance/.tmp/cache/suite-readiness/fourrealities/checkout` at HEAD `1e1318bcf7f1176f69adacdf74faf8e8ef6989f4` (branch `feature/cascadeplan-marketplace-fixes`, contains `907ccd7`). All file:line references below are in `apps/fourrealities/` unless another path is given.
- Note on "identical to master": `git diff --stat 907ccd7 HEAD -- apps/fourrealities` shows 5 changed build files (`.npmrc`, `jest.config.js`, `package.json`, `package-lock.json`, `tsconfig.json`; commit `628bb79`, shared UI package as a real dependency). The `src/` and `test/` trees are the same.
- Probes written for this review (scratch, not in the repo): `~/Documents/projects/jira-governance/.tmp/cache/suite-readiness/fourrealities/probes/sibling-shapes.js` and `chunk-size.js`, run with node against the built `dist/`.

## 1. Verdict

**Not ready.** The code is well layered, typed and tested (403 of 403 tests, 96% branch coverage, `forge lint` clean, Runs on Atlassian eligible). But two of the four gates do not work as sold. With the DefinitionGuard version in this same repository, a fully complete Definition of Done shows "Evidence missing: Record shape not written by DefinitionGuard" (probe, BL-1). On a site with FourRealities alone, Process and Audit are "Evidence missing" on every Done issue, so the best a perfect team can reach is 50% (HIGH risk), and the app tells them to "seal the issue in LedgerSeal" (BL-2), while the FAQ says each app can be installed on its own. The app stores Atlassian account ids and display names but has no personal data report (BL-3). Listing and site copy claim features that do not exist (an admin policy page) or that do not work (DefinitionGuard integration), and three screenshots are marked RECAPTURE REQUIRED (BL-4). Production dependencies have 8 high advisories with no override (BL-5). Fix BL-1 to BL-5, then re-review; the High findings in section 3 should be fixed in the same round.

## 2. Blockers

| ID | Blocker | Evidence | Fix | Size |
|---|---|---|---|---|
| BL-1 | **A genuine DefinitionGuard record is rejected.** DefinitionGuard (this repo) writes `definitionguard-dod` schema v2 with `mandatoryTotal`, `mandatoryCompleted`, `headHash`, `issuedAt`, `keyId`, `sig` (`apps/definitionguard/src/integrity/attestation.ts:23-35, 44-60, 98`). FourRealities accepts only `completedCount`, `totalCount`, `checklistHash` (`src/engine/default-gate-engine.ts:77-82`). Result: Process MISSING, reason `DOD_SHAPE_UNKNOWN`, text "Record shape not written by DefinitionGuard." (`src/ui/gate-text.ts:127`), while a hand-written v1-shaped property passes. Severity Critical, Confirmed. | Probe `sibling-shapes.js`: `DG v2 record : process DOD_SHAPE_UNKNOWN, rai 0, CRITICAL`; `Forged LS + DG v1 shapes : process DOD_COMPLETE_DG, audit SEAL_VALID_LS, rai 67`. No FourRealities test uses the v2 shape (`grep mandatoryTotal test/` = 0 hits). LedgerSeal v2 (`apps/ledgerseal/src/domain/attestation.ts:28-43`) still matches FourRealities' check. | Accept DefinitionGuard schema v2 (map `mandatoryCompleted`/`mandatoryTotal`, `headHash` as the reference, `issuedAt` for freshness). Add a contract test that feeds `buildAttestation()` output from both sibling apps into the gate engine. Then do B-26 (section 4.4). Fix the spec v2 Process section, which still documents the v1 shape. | S (shape and contract test); M with signature check |
| BL-2 | **Standalone buyer gets a misleading score and an upsell instead of results.** No detection of sibling apps exists (spec D-9, `docs/spec/fourrealities-spec-v2.md:362`). On every Done issue without a sibling record, Process = MISSING `DOD_NONE` and Audit = MISSING `SEAL_NONE` (`default-gate-engine.ts:133-135, 191-193`), both scored 0 (`default-metrics-engine.ts:29-36`). The panel and dashboard then say "Next: complete the Definition of Done in DefinitionGuard." and "Next: seal the issue in LedgerSeal." (`src/ui/pipeline.ts:62-64, 186-193`), show buttons to sibling panels that open the same issue page (`src/frontend/issue-panel.tsx:22-33, 155, 230`), and "Audit readiness: Incomplete" can never become Complete. Severity Critical, Confirmed. | Probe: standalone Done issue with Confluence link and merged PR = RAI 50 HIGH; without a Development field = 33 CRITICAL; the same issue while In Progress = 100 LOW, so finishing work drops the score. Section 4 has the full matrix. FAQ: "You can install only the specific capabilities ... Each app ... is published as an independent ... app" (`asymm-corporate/.../jira-governance/faq.html`). | Add "evidence sources in use" per site (and optionally per project) on a `jira:adminPage` (the permission standard already requires `fourrealities-admin`, section 3 M-6): Process = DefinitionGuard / HeroCoders / not in use; Audit = LedgerSeal / not in use. "Not in use" gives a new state reason `SOURCE_NOT_IN_USE` (NOT_APPLICABLE, not scored), hides the producer buttons and next steps, and the card says "Not in use on this site". Default on install: not in use until an admin turns it on, or a one-time suggestion when the snapshot finds the property on any issue. Do not auto-detect silently: a project where LedgerSeal is installed but nobody seals must still show MISSING. Update listing, guide and FAQ to say what a standalone install shows. | M |
| BL-3 | **No personal data reporting.** The app stores Atlassian account ids and display names but declares no `report:personal-data` scope and no weekly trigger (`manifest.yml:25-28, 49-56`). Atlassian requires periodic reporting of every stored accountId (source as cited in CascadePlan `report-v2.md` BL-5). Severity Critical, Confirmed. | Section 5 lists every key and field. Display names are stored in every snapshot row (`assigneeName`, `src/engine/default-metrics-engine.ts:69`). | Follow CascadePlan: `report:personal-data` scope, `scheduledTrigger` with `interval: week`, a `reportPersonalData()` that collects account ids from `fr:ex:*` (`byAccountId`), `fr:note:*` and `fr:issue:*:exception` (`recordedBy`), snapshot rows and `fr:p:*:meta.generatedBy`, calls `privacy.reportPersonalData`, and erases closed accounts (replace with a fixed token in events and notes, rebuild or drop affected chunks). Stop storing `assigneeName` (show it with the UI Kit `User` component from `assigneeAccountId`) and store `generatedBy` as "user" not the id. Pattern: `apps/cascadeplan/src/server/baselines.ts:216-244`, `apps/cascadeplan/src/storage/personal-data.ts`, `apps/cascadeplan/manifest.yml:30-34, 59`. | M |
| BL-4 | **Listing, reviewer notes and site copy contain false or unproven claims, and media are not ready.** (a) `fourrealities-listing-v2.md:15` "Uniform admin policy. Administrators can define allowed groups" (no admin page in `manifest.yml`; the guide says "FourRealities has no settings page"). (b) `fourrealities-listing.md:34`, guide section 1 "Process: a Definition of Done record written by DefinitionGuard" (false until BL-1). (c) Submission notes 5.1 "If no development tool is connected, the Code gate shows Not applicable" (only when the site has no Development field, `default-gate-engine.ts:144-146`; Plausible false on Jira Software sites, see F-H5). (d) Three of five screenshots marked RECAPTURE REQUIRED (`fourrealities-listing.md:84-86`); all are 1840x1150 and the banner 2280x1140, the sizes CascadePlan `report-v2.md` BL-7 found wrong (1840x900, 1120x548). (e) Panel buttons name "LedgerSeal Audit Gate panel" and "DefinitionGuard Checklist panel" (`issue-panel.tsx:27, 30`) but the sibling panels are titled "Approval Seal" and "Definition of Done" (`apps/ledgerseal/manifest.yml:4`, `apps/definitionguard/manifest.yml:4`). Severity High (a false claim is a blocker), Confirmed except (c). | Section 8. | Delete or mark `fourrealities-listing-v2.md` superseded (the live source is `fourrealities-listing.md`: updated 2026-11-05 in `86737f9`, and the checklist and playbook point at it). Fix (b) to (e). Recapture screenshots at the required sizes from a live install. | S |
| BL-5 | **8 high and 5 moderate advisories in production dependencies.** `npm audit --omit=dev --audit-level=high` exit 1; root cause `prosemirror-view` XSS via `@forge/react` and `@forge/bridge` (`@atlaskit/*`). CascadePlan fixed the same tree with `"overrides": { "prosemirror-view": "^1.42.3" }` (`apps/cascadeplan/package.json:42-44`); FourRealities has no override, and the CI audit step runs for CascadePlan only (`.github/workflows/apps-ci.yml`, `if: matrix.app == 'cascadeplan'`). Severity High, Confirmed. | Section 9. | Add the same override, regenerate `package-lock.json`, rerun tests, and run the audit step for every app in CI. | S |

## 3. Findings by severity

Each finding: location, scenario, severity, Confirmed or Plausible, fix.

### High

- **F-H1 Forged sibling properties raise the score like verified evidence.** `src/accessor/issue-facts.ts:12, 128-132`, `default-gate-engine.ts:90-96`, `default-metrics-engine.ts:29-36`. Any user with Edit issues can `PUT /rest/api/3/issue/{id}/properties/ledgerseal-cert` (or `definitionguard-dod`, `checklist`) with a well-formed body. The gate shows "found, not verified" (amber) but RAI counts it as 100, and "Audit readiness: Complete" counts it (`pipeline.ts:154`). Probe: forged LedgerSeal plus DefinitionGuard v1 shapes on a bare issue give RAI 67 HIGH. Confirmed. Both siblings now sign their v2 attestations with Ed25519 (`apps/ledgerseal/src/domain/attestation.ts:97-110`, `apps/definitionguard/src/integrity/attestation.ts:62-76`; public key `docs/marketplace/definitionguard-public-key.pem`), so B-26 is no longer blocked by the siblings. Fix: verify `sig` over the canonical JSON with bundled public keys and the right `issueId`; until verified, show NOT_VERIFIED records but do not score them, or score them in a separate "reported" count. Size M.
- **F-H2 Resolver can run past the 25 s Forge limit on large projects.** `default-snapshot-manager.ts:131` builds with a deadline of now + 18 s, then `:138` checks viewer visibility with a new deadline of now + 18 s, then writes up to 20 chunks. `visibleIssueIds` pages the whole project with no cap (`src/accessor/jira-search.ts:83-103`), even when the snapshot holds only the newest 2,000. Scenario: first open or Refresh on a 2,000-issue project: about 20 searches with changelog plus up to 2,000 remote-link reads (8 at a time) until 18 s, then up to 18 s more of id paging: the invocation times out and the page shows an error. On a 10,000-issue project every page view pages ids for up to 18 s and then shows "could not finish checking which issues you can see" although every stored row was checked. Plausible (timing not run live). Fix: one shared deadline for the whole resolver (for example 20 s total); stop the id search once all snapshot ids are seen or after `ISSUE_CAP`; on the first build, return a partial result and let the scheduled run finish. Size S.
- **F-H3 Confluence search may not work for a Jira-only install.** `src/accessor/default-forge-confluence-search-accessor.ts:32, 43` calls `asUser().requestConfluence` from a Jira app with no Confluence module. The owner's site had the app "upgraded on both Jira and Confluence products" (`round-log.md:310`), so the passing live check does not show the Jira-only case. If the call fails, the dialog says "You do not have permission to search Confluence." (`:44-46`), which misleads. Reviewer test step 2 depends on it. Plausible. Fix: test on a site where the app is installed in Jira only (section 10); if it fails, say so in the listing and setup steps, and show a message that names the real cause. Size S.
- **F-H4 A link to any same-site `/wiki/` path is "verified".** `default-gate-engine.ts:31-39, 46-52`, `catalog.ts:36`. `linkDecision` accepts any http(s) URL and title (`default-policy-engine.ts:28-38`; spec says title 3 to 255 characters, code checks only non-empty). Scenario: a user links `https://<site>/wiki/x` titled "ADR"; Intent turns green with "verified by FourRealities". Confirmed (spec says it does not read the page). For an integrity product the green "verified" label overstates it. Fix: with the Confluence scopes already granted, read the page by id as the user and mark VERIFIED only when it exists; otherwise label it "link found". Size S to M.
- **F-H5 Code gate on Jira Software sites without a Git integration.** `default-kvs-site-config-accessor.ts:63` finds the Development field by type or name; Code is NOT_APPLICABLE only when no such field exists (`default-gate-engine.ts:144`). If the field exists on every Jira Software site (Plausible; DEMO-1 showed "4 of 4 gates apply", `round-log.md:139`), a team with no Git integration gets Code MISSING "No pull request is linked" on every Done issue, and the text for NO_DEV_TOOL ("No development tool is connected", `gate-text.ts:136`) never shows. Fix: treat "no issue in the project has any Development data" as "not in use" through the same setting as BL-2, and correct the reviewer note. Size S (with BL-2).

### Medium

- **F-M1 Approvers also need Edit issues.** `default-exception-manager.ts:161, 182-187`: the decision writes the `fourrealities-exception` property as the user, so a Jira administrator or project administrator without Edit issues on that project is refused with "You need the Edit issues permission ... to record an exception." This is the L3-1 pattern again from another side. Plausible. Fix: after the permission check passes, write the projection property as the app (the event in KVS is the record of truth), or say in the guide that approvers need Edit issues. Size S.
- **F-M2 Snapshot chunk can exceed the 240 KiB KVS value limit.** `default-kvs-snapshot-accessor.ts:31-37` stores 100 rows per chunk. Rows carry uncut fields: Code exception reason, notes and decision reason (500 + 1,000 + 500), the latest rework note (500 + 1,000), sprint names and the Intent `title` arg (no cut, `default-gate-engine.ts:51`). Probe `chunk-size.js`: typical chunk 78.3 KiB; worst case 573.7 KiB. About 32 heavy rows in one chunk are enough to fail `kvs.set`, and then every build of that project fails. Plausible. Fix: store only reason codes and ids in rows and read notes and exceptions per issue on demand, or cut text in rows to 120 characters; size-check before `set` and split. Size S.
- **F-M3 Own actions turn sealed evidence into "Needs re-check".** `default-gate-engine.ts:102-104` compares the sibling `issuedAt` with the issue `updated`. "Request retrospective review" posts a comment (`default-forge-jira-issue-accessor.ts:125-147`) and "Link decision record" adds a remote link; both can move `updated`. Probe: LedgerSeal v2 seal plus a later `updated` gives Audit `CHANGED_SINCE_ATTESTATION` and RAI drops from 33 to 0. Plausible (whether remote links move `updated` is not checked live). Fix: compare against content changes only (changelog items other than comments and links), or let the producer's own status decide freshness after B-26. Size S.
- **F-M4 The permission standard is not met.** `docs/design/uniform-permission-management-standard.md:20, 32, 85-88` requires `jira:adminPage` key `fourrealities-admin` and Tier 2 approver groups. Neither exists (`manifest.yml`). `test/brand/admin.test.tsx` tests `AdminPolicyPanel` from `@asymm/jira-ui`, which no FourRealities source imports. Approve and Reject buttons show to every user (`issue-panel.tsx:90-99`); the standard asks for disabled buttons with a note. L3-1 judgement: the current rule (ADMINISTER_PROJECTS on the issue's project or global ADMINISTER, not the requester, not the assignee; `default-exception-manager.ts:17, 138-145`, `default-exception-policy-engine.ts:61-87`) is a sound Tier 1 and fails closed on errors. It is not enough for teams whose approvers are release managers without project admin rights. Fix: build the admin page with BL-2 (one page: sources in use, approver groups). Size M (shared with BL-2).
- **F-M5 Process and Audit wording is sibling-specific.** Card questions "Is completion sealed in LedgerSeal?" (`pipeline.ts:18`), metric text "share of rated done issues with a LedgerSeal record" (`project-dashboard.tsx:89`), source line "DefinitionGuard property definitionguard-dod" for `DOD_NONE` even when HeroCoders is the site's tool (`gate-text.ts:84`). Confirmed. Fix with BL-2. Size S.
- **F-M6 Decision issue types are fixed.** `catalog.ts:45` matches only `adr`, `architecture decision`, `decision`, `decision record`, `spec`, `specification`, `requirement`. "Architecture Decision Record", "RFC" or "Design" never count, and the reserved override key `fr:p:{key}:catalog` has no writer (`catalog.ts:6`). Confirmed. Fix: add the list to the admin page. Size S.

### Low

- **F-L1 One scheduled failure stops the run.** `default-snapshot-manager.ts:102-109` has no try/catch around `build`; a KVS error (F-M2) in one project skips every later project. Fix: catch per project and record it in `failed`.
- **F-L2 Site-wide reads on every build.** `default-snapshot-manager.ts:56-57` reads every `fr:note:` and `fr:ex:` key on the site for each project build; `kvs-v2-exception.ts:31-36` scans `fr:issue:` twice. Cost grows with use and is repeated for up to 500 projects per daily run. Fix: prefix by project or keep a per-project index.
- **F-L3 Lost update on the project registry.** `default-kvs-snapshot-accessor.ts:74-79` read-modify-write of `fr:projects`; two first views at once can drop one project from the daily run until it is opened again (self-healing). Concurrent decisions (approve and withdraw at the same time) both append; `currentState` takes the later `at` (`default-exception-policy-engine.ts:27-37`). Low.
- **F-L4 `read:jira-user` has no REST use.** No call to `/user`, `/myself` or group endpoints exists in `src/`. The submission notes justify it by the UI Kit `User` component. Plausible unneeded; verify in development without the scope (section 10) and drop it if names still render.
- **F-L5 Text mismatches.** Recovery order Intent, Code, Process, Audit (`models.ts:15`) differs from the next-action order Intent, Process, Code, Audit (`pipeline.ts:31`), so "Adding Code evidence raises ..." can sit under "Next: complete the Definition of Done". "Why n%?" uses `round(100/applicable)` per gate (`pipeline.ts:76`), so two of three gates read "+33 +33" next to RAI 67.
- **F-L6 Trend shows project-wide aggregates to every viewer** (`default-snapshot-manager.ts:148`), including counts from issues the viewer cannot browse. Documented as D-4; say it in the guide.
- **F-L7 Stale repo docs.** `README.md` claims "Only requests `read:jira-work` and `storage:app`", "Verifies that Pull Requests possess formal peer approvals", "In Review -> In Progress" counted as rework, and `@forge/storage`; all false. It also says `npm install`, but a clean `npm ci` fails unless `packages/asymm-jira-ui` is installed first (gate log, section 9). Spec v2 lists 3 scopes (`fourrealities-spec-v2.md:293`); the code has 6.

## 4. Standalone behaviour

### 4.1 How the sibling apps are detected

They are not. The search and issue reads request three properties in one call (`issue-facts.ts:12`, `jira-search.ts:40-47`, `default-forge-jira-issue-accessor.ts:55`). The gate engine sees only "property present with a known shape", "present with another shape" or "absent" (`default-gate-engine.ts:111-136, 172-194`). "App not installed" and "app installed but this issue not sealed" both give `SEAL_NONE` / `DOD_NONE`. Spec D-9 records this as a decision.

### 4.2 Results for a Done issue (probe output, `sibling-shapes.js`)

| Site | Intent | Process | Code | Audit | RAI | Risk |
|---|---|---|---|---|---|---|
| FourRealities alone, Confluence link, no Development field | FOUND | MISSING (DOD_NONE) | N/A (NO_DEV_TOOL) | MISSING (SEAL_NONE) | 33 | CRITICAL |
| FourRealities alone, Confluence link, merged PR | FOUND | MISSING | FOUND (heuristic) | MISSING | 50 | HIGH |
| Same issue while In Progress | FOUND | N/A (NOT_DONE) | N/A | N/A (NOT_DONE) | 100 | LOW |
| With LedgerSeal v2 seal, nothing else | MISSING | MISSING | N/A | FOUND (not verified) | 33 | CRITICAL |
| With DefinitionGuard v2 complete record, nothing else | MISSING | MISSING (DOD_SHAPE_UNKNOWN) | N/A | MISSING | 0 | CRITICAL |
| Forged LedgerSeal and DefinitionGuard v1 shapes | MISSING | FOUND (not verified) | N/A | FOUND (not verified) | 67 | HIGH |

A standalone buyer therefore sees every finished issue at HIGH or CRITICAL risk, a dashboard "Next step" that names a sibling app, and a score that falls when work is completed. That result is misleading. Design fix and size: BL-2 (M).

### 4.3 HeroCoders path

A HeroCoders `checklist` property with `uncheckedMandatoryItems: 0` gives Process FOUND (`default-gate-engine.ts:126-132`). The shape is from vendor documentation only and not checked on a site with the app (`final-report.md:45`). Not run.

### 4.4 Backlog status

- B-26 (verify signed sibling properties): marked BLOCKED (`backlog.md:277-281`). The blocking reason is gone: both siblings now write signed v2 attestations (section 3 F-H1). It should be unblocked and done with BL-1.
- B-27 (Teamwork Graph approvals): still blocked by the platform; not re-checked here.
- B-28 (publish signed `fourrealities-gates`): depends on B-26 and a key decision; not needed for submission.
- B-41 (Confluence page search): built (`cc32f08`, deployed 4.0.0 to development). Jira-only install not tested (F-H3).
- B-42 (retrospective review comment): built and checked live (`round-log.md:181, 203-209`).

## 5. Personal data map

| Where | Key or object | Personal fields | Written by |
|---|---|---|---|
| KVS | `fr:ex:{issueId}:code:{at}:{seq}` | `byAccountId`; free text `reason`, `notes` | `default-kvs-exception-event-accessor.ts:34-36` |
| KVS | `fr:note:{issueId}:{recordedAt}:{seq}` | `recordedBy`; free text `reason`, `notes` | `default-kvs-rework-note-accessor.ts:24-26` |
| KVS | `fr:issue:{issueId}:exception` (v1/v2, migration only) | `recordedBy` in `code` and `rework` | read and rewritten by `kvs-v2-exception.ts:39-47` |
| KVS | `fr:p:{projectKey}:chunk:{i}` | per row `assigneeName` (display name), `assigneeAccountId`, `codeException.requestedBy`, `decidedBy`, `reworkNote.recordedBy`, free text | `default-kvs-snapshot-accessor.ts:31-37`, row from `default-metrics-engine.ts:60-85` |
| KVS | `fr:p:{projectKey}:meta` | `generatedBy` = viewer accountId on a first view or Refresh | `default-snapshot-manager.ts:82, 131` |
| KVS | `fr:p:{key}:summary`, `:trend`, `fr:projects`, `fr:cfg:site` | none | |
| Jira issue property | `fourrealities-exception` | `code.requestedBy`, `code.decidedBy`, `rework.recordedBy`, free text | `default-forge-jira-issue-accessor.ts:116-123` (as the user) |
| Jira | remote links, comments | created as the user (Jira holds the author) | `:107-114`, `:125-148` |

No retention: events and notes are never deleted, also after the issue is deleted. On uninstall, Forge removes app storage; the issue property, remote links and comments stay in Jira (the FAQ says so). What the fix must do: BL-3.

## 6. Scope and egress map

| Call | Route | Principal | Scope |
|---|---|---|---|
| Project search, paged | `GET /rest/api/3/search/jql` (`jira-search.ts:46-47`) | app | read:jira-work |
| Approximate count | `POST /rest/api/3/search/approximate-count` (`:68`) | app | read:jira-work |
| Viewer visibility | `GET /rest/api/3/search/jql?fields=id` (`:90-91`) | user | read:jira-work |
| Issue with properties and changelog | `GET /rest/api/3/issue/{id}` (`default-forge-jira-issue-accessor.ts:55, 78, 98`) | user | read:jira-work |
| Remote links | `GET /rest/api/3/issue/{id}/remotelink` (`:56`, `remote-links.ts:29`) | user (panel), app (snapshot) | read:jira-work |
| Permission check | `GET /rest/api/3/mypermissions` (`:89`) | user | read:jira-work |
| Field list, status list, server info | `/rest/api/3/field`, `/status`, `/serverInfo` (`default-kvs-site-config-accessor.ts:21, 33, 57`) | app or user | read:jira-work |
| Add remote link | `POST /rest/api/3/issue/{id}/remotelink` (`:108`) | user | write:jira-work |
| Exception property | `PUT /rest/api/3/issue/{id}/properties/fourrealities-exception` (`:117`) | user | write:jira-work |
| Comment | `POST /rest/api/3/issue/{id}/comment` (`:126`) | user | write:jira-work |
| Confluence search | `GET /wiki/rest/api/content/search?cql=...` (`default-forge-confluence-search-accessor.ts:43`) | user | search:confluence, read:confluence-content.summary |
| KVS get, set, delete, query | `default-forge-kvs-store.ts` | app | storage:app |
| (none) | | | read:jira-user (F-L4) |
| Missing | personal data report | app | report:personal-data (BL-3) |

- Every route uses the `route` tag (`test/forge-route.test.ts` runs the real tag). JQL takes the project key from the Forge context only. CQL strips `"` and `\` (`default-forge-confluence-search-accessor.ts:41`).
- Egress: no `permissions.external`, no `remotes`, no fetch outside `requestJira`/`requestConfluence`. `forge eligibility`: "The version of your app [4.0.0] that's deployed to [development] is eligible for the Runs on Atlassian program." The production version is not checked.
- Git data: FourRealities reads no Git provider. It parses the Jira Development field summary (`dev-field.ts`). The customer must connect GitHub, Bitbucket or GitLab for Jira for Code to have data. Approvals are not readable (stated honestly).
- CSP: not applicable; all three modules are UI Kit `render: native` (`manifest.yml:5, 13, 21`). UI Kit renders text only, so no XSS path was found in `src/frontend`.
- Icon: module icon `resource:icons;icon.svg` (local, `static/icons/icon.svg`); Marketplace icon `docs/marketplace/assets/fourrealities/icon.png` 144x144.

## 7. Licensing result

- `manifest.yml:46-47` `licensing.enabled: true`. Every resolver returns `LICENSE_INACTIVE` (or `success: false`) when `context.license.isActive === false` before any Jira or KVS call (`src/index.ts:82-88, 106, 112, 133, 152, 160, 168, 176, 188`). The daily trigger skips when `getAppContext().license.isActive === false` (`src/index.ts:122-126`, `default-forge-app-context-accessor.ts:15-22`). Tests: `test/index.test.ts` (licence cases), `test/manifest.test.ts`.
- An undefined licence is allowed (D-10). For a paid app in production, Forge sends a licence object, so an unlicensed production site gets `isActive: false` and is blocked. Result: Pass (code). Not run (live), steps in section 10.

## 8. Claims audit

Source of truth for submission: `docs/marketplace/fourrealities-listing.md` (updated 2026-11-05). `fourrealities-listing-v2.md` is a 2026-11-01 draft and must be deleted or marked superseded.

| Claim (file) | True in code? | Evidence |
|---|---|---|
| "Reads only Jira and your Confluence site" (listing:11) | Yes | section 6 |
| "Process: a DefinitionGuard record" (listing:34; guide section 1) | **No** | BL-1 |
| "Audit: a LedgerSeal record" (listing:34) | Yes, unsigned shape only | `default-gate-engine.ts:90-96`; F-H1 |
| HeroCoders checklist as a hint (listing:34) | Code yes; shape unverified | section 4.3 |
| RAI = percent of rated gates found, risk bands (listing:35; guide 2) | Yes | `default-metrics-engine.ts:29-44` |
| PR state heuristic, approvals not read (listing:36) | Yes | `dev-field.ts`, `gate-text.ts:132-133` |
| Confluence search as the user (listing:37; notes test step 2) | Code yes; Jira-only install unproven | F-H3 |
| Code exceptions with separation of duties, who and when (listing:38) | Yes | `default-exception-policy-engine.ts:61-87`, append-only events |
| Rework loop definition (listing:39; guide 4) | Yes | `issue-facts.ts:19-34` |
| Dashboard parts, daily snapshots, Refresh (listing:40) | Yes; large projects may time out | F-H2 |
| "Every step is kept" / audit history | Yes in KVS; no retention or erasure | BL-3 |
| "Uniform admin policy ... define allowed groups" (listing-v2:15) | **No** | no `jira:adminPage` |
| "A project administrator ... approves" (listing-v2:12) | Stale: Jira admin also | `default-exception-manager.ts:17` |
| "If no development tool is connected, the Code gate shows Not applicable" (notes 5.1) | **Plausibly no** | F-H5 |
| "If the user cannot search Confluence, the dialog shows ..." (notes 5.2) | Yes; same text also for other 401/403 causes | F-H3 |
| Zero external egress, Forge KVS only (listing 58-64; notes 2; FAQ) | Yes | section 6 |
| "Data stays with your Atlassian Cloud site" (listing:63) | Forge storage, yes; also Jira properties | section 5 |
| "With an inactive licence the app shows Licence not active and reads nothing" (guide 5; listing-v2:40) | Yes | section 7 |
| "FourRealities has no settings page" (guide 5) | Yes; contradicts listing-v2 and the quickstart step 2 | `user-guide/index.html` step 2 |
| Panel "links to the LedgerSeal and DefinitionGuard panels" (listing:83; guide 6) | Buttons exist; panel names wrong, shown also without the apps | BL-4 (e), BL-2 |
| "Each app ... independent ... install only the capabilities you need" (FAQ) | **Misleading for FourRealities** | BL-2 |
| "free tier ... includes 100% of features" (FAQ) | Code has no tier logic; licence only | section 7 |
| Screenshots 03, 04, 05 (listing:84-86) | **Not ready** | RECAPTURE REQUIRED; sizes BL-4 (d) |
| Playbook positioning "Code (PRs) ... Audit (logs) into an objective score" (`suite-launch-and-first-sale-playbook.md:20`) | **No** (heuristic PR state, sibling records); playbook also names PlanShift and the retired Security Self-Assessment | stale, internal only |
| Checklist "Clean Lint & Tests" (developer-console-checklist.md:17) | Now Pass for FourRealities | section 9 |

## 9. Test results

Run in the clone on the host (node v26.13.0, npm 11.20.0, forge CLI 15.0.0). Logs: `~/Documents/projects/jira-governance/.tmp/cache/suite-readiness/fourrealities/gate.log`, `gate2.log`.

| Check | Result |
|---|---|
| `npm ci` in the app first (README order) | exit 127: `packages/asymm-jira-ui` prepare `tsc -p .`: "tsc: not found" |
| `npm ci` in `packages/asymm-jira-ui`, then in the app (CI order) | exit 0; `node_modules/@asymm/jira-ui/dist/index.js` present |
| `npx --no-install tsc --noEmit` | exit 0, no errors |
| `npm test -- --coverage` | 34 of 34 suites, 403 of 403 tests pass, 16.5 s. Statements 99.62%, branches 96.07%, functions 99.3%, lines 99.82%. Lowest branch: `default-gate-engine.ts` 92.56%, `triage.ts` 91.66%, `app.tsx` 90.9% |
| `npm run build` (`tsc`) | exit 0. `git status --porcelain` after all steps: empty (`dist/` is ignored) |
| `forge lint` (isolated HOME, no credentials, analytics off) | "No issues found." Warning: Node 26 not supported by the CLI |
| `forge eligibility` | development 4.0.0 eligible for Runs on Atlassian |
| `npm audit --omit=dev --audit-level=high` | exit 1: 13 vulnerabilities (5 moderate, 8 high); `prosemirror-view` XSS through `@forge/react`, `@forge/bridge` |
| Header rule | every `.ts`/`.tsx` in `src/` and `test/` has the Asymm Systems copyright and `@author Fahim Farook` (grep, 0 misses) |
| Dash rule | no em or en dash in `src/`, `manifest.yml`, `README.md`, spec v2, listings, submission notes, research folder. One em dash in `test/frontend/accessibility.test.tsx:23` is the forbidden-character regex itself (acceptable) |
| Probes | `sibling-shapes.js` (section 4.2); `chunk-size.js`: typical chunk 80,132 B (78.3 KiB), worst case 587,432 B (573.7 KiB), typical 2,000-row dashboard response 1.53 MiB |

## 10. Not run (with exact steps)

All live steps on a development install (`forge deploy -e development`, `forge install -e development`), never production.

1. **DefinitionGuard v2 live (confirms BL-1).** Install DefinitionGuard from this commit on the same site. On a probe issue labelled `fr-probe`, complete all mandatory DoD items, move to Done, open the Four Realities panel. Expected today: Process "Evidence missing", "Record shape not written by DefinitionGuard."
2. **Confluence search on a Jira-only install (F-H3).** On a site that has Confluence, install FourRealities into Jira only. Open the panel on a probe issue, click **Link decision record**, then **Search Confluence...**, type two letters, click **Search**. Record the HTTP status in `forge logs` and the message shown.
3. **Development field without a Git integration (F-H5).** On a Jira Software site with no GitHub, Bitbucket or GitLab app: `GET /rest/api/3/field`, look for schema custom `com.atlassian.jira.plugins.jira-development-integration-plugin:devsummarycf`. Open a Done issue panel; record whether Code says "Not applicable" or "No pull request is linked".
4. **Licence.** `forge install -e development --upgrade --license inactive` (if the CLI version supports the flag; else use the Developer Console licence override). Open the project page and an issue: expect "Licence not active" and no Jira calls in `forge logs`. Repeat with `--license active`.
5. **Large project timing (F-H2).** Create or import 2,000 issues in a test project, half started. Open the project page (first build), then **Refresh**; record the invocation duration in `forge logs` and any timeout.
6. **Personal data report.** After BL-3, run the weekly trigger with `forge webtrigger` or a test hook and confirm the report call returns per-account status.
7. **`read:jira-user` need (F-L4).** Remove the scope in a development branch, deploy, `forge install --upgrade`, open an issue with a rework note; check that the requester name still renders.
8. **Approver without Edit issues (F-M1).** A second user who is a project administrator but lacks Edit issues approves a request on a probe issue.
9. **Uninstall.** Uninstall from the development site; confirm app storage is gone and list what stays (`fourrealities-exception` property, remote links, comments).
10. **HeroCoders shape (B-25).** Needs the Checklists for Jira app on a test site (owner approval for its terms).
11. **Developer Console.** App name shown on the install and consent screens, screenshot and banner size rules, pricing tier setup: owner sign-in needed.
12. **Fast human typing (L3-3)** in the dialog text fields: needs a person.

## 11. First customer: steps to first value, and friction

Steps after install:
1. A Jira administrator accepts the scopes, including two Confluence scopes for a Jira app (expect a question from security reviewers).
2. Connect a Git integration (GitHub for Jira, Bitbucket or GitLab) if not done, or the Code gate has no data (F-H5).
3. Open **Four Realities** in each project's navigation once. Only opened projects get the daily snapshot (`default-snapshot-manager.ts:127`, spec "registered the first time its dashboard is opened"). The first open builds the snapshot inside the page request (F-H2).
4. Link decision records: either Confluence page remote links on this site, or issue links to an issue type with one of the seven exact names (F-M6). Rename issue types or retrain the team if needed.
5. For Process and Audit, buy and configure DefinitionGuard (after BL-1 is fixed) and LedgerSeal, or install HeroCoders Checklists. Without them, two of four gates stay red on every Done issue (BL-2).
6. Make sure the people who approve Code exceptions are project administrators or Jira administrators and have Edit issues (F-M1, F-M4).

Main friction points:
- Time to first value is short for Intent (one link per issue) but the first screen a standalone buyer sees is mostly red, with HIGH or CRITICAL on finished work and "Next step" pointing to other paid apps (BL-2).
- The score is hard to trust: finishing an issue lowers it (section 4.2), "not verified" records count the same as verified ones (F-H1), and a fake `/wiki/` link is "verified" (F-H4).
- No settings: decision issue types, sources in use and approver groups cannot be set (F-M4, F-M6).
- Empty state ("No issues to rate yet", `project-dashboard.tsx:194-204`) and error states (`app.tsx:73-90`) are clear. The Confluence error text can name the wrong cause (F-H3).
