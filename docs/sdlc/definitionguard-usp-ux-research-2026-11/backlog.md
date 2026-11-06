APPROVED 2026-11-01 B-01..B-20 (owner, in chat: "APPROVED now all"; read as every item and every flag: [DEP], [SCOPE], [ENV], [MIGRATE]; B-03 uses option A, the recommendation, because the owner did not pick an option)

# DefinitionGuard: ranked backlog

- **Date:** 2026-11-01
- **Gate:** Part B starts only when the first line of this file reads `APPROVED <date> <scope>`, written by the owner.
- **Source:** `research-brief.md` and `ux-spec.md` in this folder. DG and PX ids come from `docs/sdlc/portfolio-audit-2026-10-31/`. NF ids are new findings (`research-brief.md` section 6).
- **Order:** the release blockers in the order of the brief: DG-08, DG-02, DG-05, DG-06, DG-01, DG-04 with DG-03, DG-09, PX-02, PX-01. Then the U2 items, then UX. One change to the brief's order is recommended but not applied: B-03 and B-04 (one storage redesign) should land together with B-07, so the new event schema stores accountIds from day one. Each keeps its own commit.
- **Approval flags.** An item with a flag needs the owner to approve the flag, not only the item.
  - `[DEP]` npm dependency change. `node_modules` is a symbolic link to `../ledgerseal/node_modules`, shared with LedgerSeal and CascadePlan.
  - `[SCOPE]` manifest change (module, scope, licensing, `projectTypes`, storage entity).
  - `[ENV]` Forge environment variable.
  - `[MIGRATE]` KVS data migration.
  - `[OTHER-APP]` change in another app. No item has this flag.
- **Test types:** Unit (pure module), Resolver (`src/index.ts` with mocked Forge APIs, `asApp()` and `asUser()` mocked apart), Validator (validator entry point), View model (pure panel module, no DOM), Harness (`docs/sdlc/definitionguard-usp-ux-research-2026-11/evidence/harness/`), Live (DEMO, `[DG-PROBE]` issues only).
- **Validator rule for every item that touches it:** the item keeps two acceptance criteria. (V-a) With no stored record, the validator returns `result: false`. (V-b) The error message names every open mandatory item by title.

## Summary

| Rank | ID | Title | Serves | Closes or depends on | Size | Flags |
|---|---|---|---|---|---|---|
| 1 | B-01 | Validator fails closed on any error and never writes | Release blocker | DG-08, NF-03 prep | S | none |
| 2 | B-02 | Permission checks on tick, reset and template save | Release blocker, U2 | DG-02, DG-03 (interim) | M | none |
| 3 | B-03 | No lost updates: ordered append-only events | Release blocker | DG-05, NF-04 | M | `[MIGRATE]`; option B also `[SCOPE]` |
| 4 | B-04 | Bounded record: small state, events in their own keys | Release blocker | DG-06, NF-06; with B-03 | M | `[MIGRATE]` |
| 5 | B-05 | Integrity: drop "tamper-evident" now, then a verified hash chain | Release blocker, U3 base | DG-01; depends on B-04 | M | none |
| 6 | B-06 | Project templates, admin only, applied on every path | Release blocker, H4 | DG-04, DG-03, DG-12 base | L | `[SCOPE]` |
| 7 | B-07 | Store accountIds only; render names at view time | Release blocker | DG-09, NF-05 | S | none |
| 8 | B-08 | Honest listing v2 and README | Release blocker | PX-02, section 5 of the brief | S | none |
| 9 | B-09 | Marketplace licensing | Paid listing | PX-01 | S | `[SCOPE]` |
| 10 | B-10 | One gate rule: Done-category moves, exempt list, shared with the panel | H1, H10, UX task 5 | DG-07, DG-14, NF-03 | M | none |
| 11 | B-11 | Per-item evidence, and "evidence required" items | U2, UX task 4 | DG-11; depends on B-04, B-06 | M | none |
| 12 | B-12 | Required role, "not the assignee", waiver with reason | U2, UX task 6 | DG-02; depends on B-02, B-06 | L | none |
| 13 | B-13 | Panel view model and UX fixes | UX tasks 5, 7, 9 | DG-15, PX-03, UX-01 to UX-09 | M | none |
| 14 | B-14 | Full entity property on every change, signed | U3 | DG-10, audit 5.2, 5.5 | M | `[ENV]` |
| 15 | B-15 | Audit history view and export with verification result | U2, U3, UX task 7 | DG-01; depends on B-05 | M | none |
| 16 | B-16 | Template versions and admin re-sync | UX task 8 | DG-12; depends on B-06 | M | none |
| 17 | B-17 | Gate coverage check on the settings page | U4, UX tasks 1, 3 | DG-07, H11 | M | `[SCOPE]` |
| 18 | B-18 | Jira call hygiene: no redundant lookups, 429 backoff | Scale budget | audit 2.1 row "429", DG-08 | S | none |
| 19 | B-19 | Hygiene, dead code, test truthfulness | Quality | DG-13, DG-16, copyright header | S | `[DEP]`, `[SCOPE]` |
| 20 | B-20 | Team-managed projects | H12 | NF-02 context | S | `[SCOPE]` |
| 15a | B-21 | Silverston-aligned domain and storage model (owner decision "C", 2026-11-01); runs before B-16 | Owner decision | spec v3; replaces v2 D-01, D-03, D-13 | L | spec v3 approved 2026-11-01 (option A) |

## Items

### B-01. Validator fails closed on any error and never writes
- **Serves:** release blocker. A thrown error has an undocumented outcome (H13, N-01). Timeouts block (N-02).
- **Closes:** DG-08. Also resolves the issue id split (key vs numeric id, DG-08 third bullet).
- **Acceptance criteria:**
  1. When the storage read throws, `validateTransition` returns `{ result: false }` and an `errorMessage` that says the move is blocked and gives a next step. Test: Validator.
  2. When any Jira call throws or returns a non-200, the validator returns `result: false`. Test: Validator.
  3. The validator makes 0 KVS writes in every path, including a missing record. Test: Validator (counting storage mock).
  4. (V-a) With no stored record, the validator returns `result: false`, using the template for the issue type without storing it. Test: Validator.
  5. (V-b) The message names every open mandatory item by title. Test: Validator.
  6. When only the issue key is given, the validator resolves the numeric id or blocks. It never stores or reads a record under the key. Test: Validator.
  7. Harness T-06 changes from "throws" to "returns result false". Test: Harness.
- **Size:** S.

### B-02. Permission checks on tick, reset and template save
- **Serves:** release blocker; base of U2.
- **Closes:** DG-02. DG-03 interim: removes `saveProjectTemplate` and `getProjectTemplates` from the issue-panel resolver until B-06 adds the settings page.
- **Design:** `asUser().requestJira` GET `/rest/api/3/mypermissions?issueKey=<key>&permissions=EDIT_ISSUES,ADMINISTER_PROJECTS`. Use the issue key, because a project-level answer can be wrong (N-20).
- **Acceptance criteria:**
  1. Toggle without EDIT_ISSUES is rejected with "You need Edit issues permission to change this checklist." The stored state does not change. Test: Resolver (negative).
  2. Reset without ADMINISTER_PROJECTS is rejected. The stored state does not change. Test: Resolver (negative).
  3. The permission call goes through `asUser()`, and storage writes go through the app. The test proves the call went to the `asUser` mock and not the `asApp` mock. Test: Resolver.
  4. When the permission call fails, the action is rejected (fail closed). Test: Resolver (negative).
  5. No resolver reachable from the issue panel writes `dod-templates:*`. Test: Resolver (negative).
  6. Harness T-10 shows 1 permission call per toggle, as user. Test: Harness.
- **Size:** M.

### B-03. No lost updates: ordered append-only events
- **Serves:** release blocker.
- **Closes:** DG-05. Uses NF-04.
- **Options (owner chooses, Part B will not):**
  - (A) Each change writes `dg:evt:<issueId>:<seq>` with `keyPolicy: FAIL_IF_EXISTS` (N-13, R-05). A collision means another writer won: re-read and retry, up to 3 times. No manifest change.
  - (B) A Custom Entity `checklist` with a conditional set on `stateVersion` (R-05). Needs a `storage.entities` manifest block: `[SCOPE]`.
  - Recommendation: (A). It needs no manifest change, and the event keys are also the audit trail that B-04 needs.
- **Acceptance criteria:**
  1. Two concurrent ticks on different items both persist, with 2 events and the final version incremented twice. Test: Resolver with the delayed snapshot-on-read storage mock, and Harness T-09.
  2. A forced collision retries and succeeds. After 3 failed retries the user sees "Someone else changed this checklist. Refresh and try again." No partial write remains. Test: Resolver (negative).
  3. Existing `dg:checklist:<id>` records are read and migrated on first write, and the old events stay in order. Test: Resolver (migration) `[MIGRATE]`.
  4. (V-a) and (V-b) still hold on migrated and new records. Test: Validator.
- **Size:** M. **Flags:** `[MIGRATE]`; option (B) also `[SCOPE]`.

### B-04. Bounded record: small state, events in their own keys
- **Serves:** release blocker.
- **Closes:** DG-06, NF-06. Lands with B-03.
- **Acceptance criteria:**
  1. After 1,000 toggles at 50 items, the largest single KVS value is 32 KiB or less. Test: Harness (budget, `ux-spec.md` 3.3).
  2. Each event value is 2 KiB or less with 500-character evidence. Test: Unit.
  3. The state value holds no per-item history array. History is read from event keys with a paged query of at most 100 (N-14). Test: Resolver.
  4. A toggle at 5,000 prior events still succeeds. Test: Harness (negative for the old failure).
  5. (V-a) and (V-b) still hold. Test: Validator.
- **Size:** M. **Flags:** `[MIGRATE]`.

### B-05. Integrity: drop "tamper-evident" now, then a verified hash chain
- **Serves:** release blocker; base of U3.
- **Closes:** DG-01.
- **Acceptance criteria:**
  1. The words "tamper-evident" appear nowhere in `src/` until criterion 4 passes. Test: Unit (source scan).
  2. Each event stores `prevHash`. The hash covers the issue id, the event and `prevHash`. Test: Unit.
  3. `verifyChain(issueId)` reports the first broken event when an old event is edited, removed or reordered, or when an event is copied from another issue. Test: Unit (negative, one test per case; replaces audit probes 7 to 11).
  4. The panel shows the result of the check (`ux-spec.md` task 7). Test: View model.
  5. The listing and panel state the limit: an unkeyed chain shows accidental or partial edits. It does not stop someone who can rewrite the whole store, including the vendor (audit 5.5). Test: Unit (copy string check).
  6. The validator does not depend on the chain check. (V-a) and (V-b) still hold. Test: Validator.
- **Size:** M.

### B-06. Project templates, admin only, applied on every path
- **Serves:** release blocker; H4.
- **Closes:** DG-04 and DG-03. Base for DG-12.
- **Acceptance criteria:**
  1. A `jira:projectSettingsPage` module exists. Its resolver checks ADMINISTER_PROJECTS through `asUser()` (N-20). Test: Resolver (negative for non-admin) `[SCOPE]`.
  2. A template is validated before save: 1 to 50 items, title 1 to 200 characters, unique item ids, at most 32 KiB. On failure the error names the field, for example "Item 3 needs a title." Test: Resolver (negative per rule).
  3. Templates are keyed by project id, not key. `updatedBy` and `updatedAt` change on every save. Test: Resolver.
  4. Every initialisation path (panel, toggle, reset, validator) applies the project template for the issue type before the built-in one. Test: Resolver and Validator.
  5. A template with 0 mandatory items is allowed, and the panel and validator agree on it (DG-14, with B-10). Test: View model and Validator.
  6. (V-a) and (V-b) still hold with a custom template. Test: Validator.
- **Size:** L. **Flags:** `[SCOPE]` (new module).

### B-07. Store accountIds only; render names at view time
- **Serves:** release blocker.
- **Closes:** DG-09, NF-05.
- **Acceptance criteria:**
  1. Toggle, reset and events store the accountId only, with no display name. Test: Resolver.
  2. A panel load makes 0 user lookups and 0 KVS writes, at any size and when lookups fail. Test: Resolver, and Harness T-02 and T-03 (budget).
  3. A stored event is never changed after it is written. Test: Resolver (event bytes are the same before and after 10 panel loads).
  4. The panel renders users with the UI Kit `User` component from the accountId (R-06). Test: View model.
  5. Old records that hold names stay as stored and are shown as text. Test: View model.
- **Size:** S.

### B-08. Honest listing v2 and README
- **Serves:** release blocker.
- **Closes:** PX-02 for this app.
- **Acceptance criteria:**
  1. `docs/marketplace/definitionguard-listing-v2.md` holds none of the claims in `research-brief.md` section 5. Test: Unit (string scan of the file).
  2. Each capability line maps to a passed backlog item and its test name. Test: Unit (each listed capability has a mapping row).
  3. Scopes listed equal `manifest.yml` scopes. Test: Unit (parse both).
  4. The price matches H9: it is shown only with the features that pass. Test: review (owner).
  5. The listing names the vendor-key limit if signing ships (B-14). Test: Unit (string check).
- **Size:** S. Written last in Part B (section 12.5 of the brief).

### B-09. Marketplace licensing
- **Serves:** paid listing.
- **Closes:** PX-01.
- **Acceptance criteria:**
  1. `manifest.yml` has `app.licensing.enabled: true` (N-27) `[SCOPE]`.
  2. When `context.license` exists and is inactive, write resolvers refuse with "Your DefinitionGuard licence is not active. Ask your Jira admin." Test: Resolver (negative).
  3. When `context.license` is absent (development and free apps, N-28), behaviour is unchanged. Test: Resolver.
  4. The validator never fails open because of licence state. (V-a) and (V-b) still hold. An inactive licence blocks, with a message. Test: Validator.
- **Size:** S. **Flags:** `[SCOPE]`.

### B-10. One gate rule: Done-category moves, exempt list, shared with the panel
- **Serves:** H1, H10, UX task 5.
- **Closes:** DG-07, DG-14, NF-03.
- **Acceptance criteria:**
  1. The validator reads `transition.to.id` (N-01) and blocks only when the target status is in category DONE. Test: Validator, both cases.
  2. A project admin can exempt target statuses or transitions (default empty; suggest Canceled and Declined). An exempt move passes. Test: Validator and Resolver.
  3. When the status category cannot be read, the move is blocked (fail closed). Test: Validator (negative).
  4. One pure function decides "satisfied", and both the panel view model and the validator call it. Zero mandatory items count as satisfied in both. Test: Unit, View model, Validator.
  5. The panel says "This issue can be moved to Done" or "Moving to Done is blocked while these items are open: ...". It never claims a block that the workflow does not have; the wording is "will be blocked where DefinitionGuard is on the workflow". Test: View model.
  6. (V-a) and (V-b) still hold for a Done-category move. Test: Validator.
- **Size:** M.

### B-11. Per-item evidence, and "evidence required" items
- **Serves:** U2, UX task 4.
- **Closes:** DG-11. Depends on B-04 and B-06.
- **Acceptance criteria:**
  1. A tick carries optional evidence: a URL (http or https only) or a note of 500 characters or less, stored in the event. Test: Resolver (negative for bad URL and size).
  2. An item marked "evidence required" cannot be ticked without evidence. The error is "Add a link or a note. This item needs evidence before it counts as done." Test: Resolver (negative).
  3. The validator treats an evidence-required item as open when its tick has no evidence. (V-a) and (V-b) still hold. Test: Validator.
  4. The panel shows evidence under the item and in history. Test: View model.
- **Size:** M.

### B-12. Required role, "not the assignee", waiver with reason
- **Serves:** U2, UX task 6.
- **Closes:** DG-02 per item. Depends on B-02 and B-06.
- **Acceptance criteria:**
  1. An item with a required project role can only be ticked by a member of that role, checked through `asUser()`. Test: Resolver (negative).
  2. An item marked "not the assignee" rejects a tick by the current assignee: "The assignee cannot complete this item. Ask a reviewer." Test: Resolver (negative).
  3. A waiver needs the template's waiver role (default project admin) and a reason of 10 to 500 characters. It writes an event with the reason. Test: Resolver (negative per rule).
  4. The validator counts a waived item as done and an unauthorised tick as never written. (V-a) and (V-b) still hold. Test: Validator.
  5. The validator reads the assignee only from app storage and the Jira issue, never from the entity property. Test: Validator.
- **Size:** L.

### B-13. Panel view model and UX fixes
- **Serves:** UX tasks 5, 7, 9.
- **Closes:** DG-15, PX-03 for this app, UX-01 to UX-09.
- **Acceptance criteria:**
  1. A pure module outside `src/frontend/` builds the view model: status, open item names, labels, lozenge appearance, accessible names and local-time strings. `src/frontend/index.tsx` only renders it. Test: View model (Jest, `node` environment).
  2. Blocked uses lozenge `removed`, satisfied uses `success`, and mandatory is a text label that is not yellow `moved`. Test: View model.
  3. No "(D-13)", "v<n>" or raw hash fragment is shown. Test: View model.
  4. Each checkbox's accessible name includes "mandatory" or "optional" and "open" or "done". Test: View model.
  5. Every error has a next step. Raw `err.message` is never shown. Test: View model.
  6. The view-model module has at least 90% branch coverage. Test: coverage.
- **Size:** M.

### B-14. Full entity property on every change, signed
- **Serves:** U3.
- **Closes:** DG-10, audit 5.2 schema v2.
- **Acceptance criteria:**
  1. Every state change writes `definitionguard-dod` schema v2 (audit 5.2), including the validator-independent init and migration. Test: Resolver (PUT body asserted).
  2. The write checks the HTTP status and retries on 429 and 5xx with backoff, up to 3 tries. On final failure it logs and leaves app storage authoritative. Test: Resolver (negative).
  3. With the `[ENV]` key set, `sig` is an Ed25519 signature over canonical JSON, using Node `crypto` (no new dependency). A one-byte change fails verification. Test: Unit (negative).
  4. The property is 32,768 characters or less at 50 items (N-21). Test: Unit (budget).
  5. The validator never reads the property. (V-a) and (V-b) still hold. Test: Validator (0 property reads, as T-07).
  6. The listing states the limit: the vendor holds the key (audit 5.5). Test: covered by B-08 criterion 5.
- **Size:** M. **Flags:** `[ENV]` (private key as an encrypted variable; it reaches the app as clear text, N-25).

### B-15. Audit history view and export with verification result
- **Serves:** U2, U3, UX task 7.
- **Depends on:** B-05.
- **Acceptance criteria:**
  1. The history view lists events with item title, action, user (accountId), local time, evidence and waiver reason. Test: View model.
  2. Export (project admins only) returns a JSON record with the events and the `verifyChain` result. Test: Resolver (negative for non-admin).
  3. Export of 1,000 events stays within the resolver time limit in the harness, paging at 100 (N-14). Test: Harness.
  4. If UI Kit cannot offer a file download, the export is shown as copyable text. Record which one was used. Test: Live.
- **Size:** M.

### B-16. Template versions and admin re-sync
- **Serves:** UX task 8.
- **Closes:** DG-12. Depends on B-06.
- **Acceptance criteria:**
  1. Each checklist stores `templateId` and `templateVersion`. Test: Resolver.
  2. Re-sync (project admin) keeps ticks on unchanged item ids, adds new items as open, and removes deleted items with an event. Test: Resolver.
  3. Open issues do not change until re-sync. Test: Resolver (negative).
  4. (V-a) and (V-b) still hold after re-sync. Test: Validator.
- **Size:** M.

### B-17. Gate coverage check on the settings page
- **Serves:** U4, UX tasks 1 and 3.
- **Closes:** DG-07 onboarding part. H11: attaching stays manual.
- **Acceptance criteria:**
  1. The settings page lists every transition into a DONE-category status in the project's workflows, and shows whether the DefinitionGuard validator is on it. On DEMO it lists the 8 transitions in L-06. Test: Resolver (fixture from L-01) and Live.
  2. It needs workflow read access. Scope `manage:jira-configuration` is an assumption (N-18, Inferred). Confirm it in Part B `[SCOPE]`.
  3. It makes no workflow write. Test: Resolver (no PUT or POST).
- **Size:** M. **Flags:** `[SCOPE]`.

### B-18. Jira call hygiene: no redundant lookups, 429 backoff
- **Acceptance criteria:**
  1. The validator does not fetch the issue when the payload gives the id and type (DG-08 second bullet). Test: Validator.
  2. Every Jira call in resolvers retries 429 with `Retry-After`, up to 3 tries. Test: Resolver (negative).
  3. Toggle makes 2 or fewer Jira calls. Test: Harness (budget).
- **Size:** S.

### B-19. Hygiene, dead code, test truthfulness
- **Acceptance criteria:**
  1. `src/index.ts` and every new file start with the Asymm Systems copyright header and `@author Fahim Farook`. Test: Unit (source scan).
  2. `renderIssuePanel` and the `NODE_ENV === 'test'` branch are removed. Storage is injected. Test: Resolver.
  3. The fallback-by-key test asserts the real behaviour (DG-13). `hasher.test.ts` no longer relies on `toBeDefined()` only. Test: review of tests.
  4. Per-file coverage threshold of 90% branch for each changed file in `jest.config.js`. Test: coverage.
  5. `@forge/storage` is removed from `package.json` `[DEP]`. This does not run `npm install`, so shared `node_modules` does not change.
  6. The panel icon is bundled as a resource and not loaded from raw.githubusercontent.com `[SCOPE]`.
  7. Issue-type matching uses whole words, so "Debug task" does not get the Bug template (DG-16). Test: Unit.
- **Size:** S. **Flags:** `[DEP]`, `[SCOPE]`.

### B-20. Team-managed projects
- **Serves:** H12.
- **Acceptance criteria:**
  1. The validator module declares `projectTypes` with company-managed and team-managed (N-01) `[SCOPE]`.
  2. Live check: "not testable on this site". It has no team-managed project (L-02). Record it as such unless the owner adds one.
- **Size:** S. **Flags:** `[SCOPE]`.

### B-21. Silverston-aligned domain and storage model
- **Serves:** owner decision 2026-11-01: restructure the model to follow the Silverston patterns (as Apache OFBiz implements them) before B-16.
- **Design:** `docs/spec/definitionguard-spec-v3.md`, approved 2026-11-01 ("approved. A.").
- **Acceptance criteria:**
  1. Criteria are DOD_CRITERION WorkEfforts under the issue WorkEffort (WORK_EFF_BREAKDOWN, sequenceNum); the template link is WORK_EFF_TEMPLATE with revisionNumber. Test: Unit.
  2. Every status change is a WorkEffortStatus row (statusId, statusDatetime, setByPartyId, reason) inside a change-log entry; StatusValidChange is enforced and an invalid change is refused before any write. Test: Unit, Resolver (negative).
  3. Evidence is a Content row linked by WorkEffortContent DOD_EVIDENCE with fromDate equal to the DONE statusDatetime. Test: Unit, Resolver.
  4. The panel response, resolver payloads, the settings payload, the property schema v2 and the validator messages do not change; the UI and view-model tests pass unchanged. Test: existing suites.
  5. (V-a) and (V-b) still hold, on new and on migrated v1 records. Test: Validator.
- **Size:** L.

## Not in the backlog (considered and excluded)

| Item | Reason |
|---|---|
| Automatic attach of the validator to workflows | No supported API (H11, N-05) |
| Fixing FourRealities forged records | Out of scope (brief 11.1). B-14 hardens DefinitionGuard instead |
| LedgerSeal integration | H5 Not true. No buyer evidence |
| A UI test library | Shared `node_modules`; the brief says stop and ask. B-13 tests a pure view model instead |
