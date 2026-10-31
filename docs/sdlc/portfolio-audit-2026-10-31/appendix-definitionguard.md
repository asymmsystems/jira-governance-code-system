# DefinitionGuard commercial-readiness review

Reviewer: independent reviewer 4 of 4 (DefinitionGuard only). Date: 2026-10-31. Repo HEAD: 5097bf5.
App path: /home/fahimfarookme/Documents/projects/gemini-earning/apps/definitionguard
Mode: read-only. No deploy, no tunnel, no network calls. Scratch work is in /home/fahimfarookme/.cache/gemini-earning-portfolio-audit/definitionguard-scratch/.

## 1. Header

### 1.1 Files read in full (md5sum)

| md5 | File |
|---|---|
| c5bbe50a1a54d81dbf03829858a880b1 | manifest.yml |
| dd1830fa608a8857d5e90b5b0c78ccd1 | package.json |
| cb00b66f256c375c3fba8f3ee535e42b | tsconfig.json |
| b4867e2c3c4d5c1d066f606ef4fa8294 | jest.config.js |
| bae1b3f0ebe2fc1a0b0bcea32f87bbe8 | README.md (claims only) |
| fdc8fa925acd7f32a2b7354e42679b92 | src/index.ts |
| 1a933b0759c9d317029f76ddbc8c08ab | src/domain/checklist-engine.ts |
| 80e842e77f0dd564af6daa41c511d886 | src/domain/hasher.ts |
| 03cb77eb3eb0258d76296a187e36e259 | src/domain/models.ts |
| 6bf1a0ea1d8767c275e8bf10ce0a25cf | src/storage/checklist-repository.ts |
| 5add6f941aaac7dea6677a2885994102 | src/validator/transition-validator.ts |
| 1e10ebdc4834e2963a034f0d1f181f1b | src/frontend/index.tsx |
| b6f02dacb8a98230489932e72213557b | test/index.test.ts |
| 0f0b75c68cfab39e6abec0763eb05e6b | test/domain/checklist-engine.test.ts |
| f60a2f179e425e66b202f403166abf7e | test/domain/hasher.test.ts |
| 05b593dff3b349cc9e78844bdd48eb18 | test/storage/checklist-repository.test.ts |
| 8013de1bfb00d8c2f8be821dc4e82f7f | test/validator/transition-validator.test.ts |
| 77704df0310d74a98710ad0d63293464 | docs/spec/definitionguard-spec.md (claims only) |
| 02dd76552b476677329559f5cb5b9873 | docs/marketplace/definitionguard-listing.md (claims only) |

Not read: dist/ and coverage/ (build output, committed in the app folder). The working tree has uncommitted changes only under apps/planshift; none under apps/definitionguard.
Cross-app facts in section 6 come from grep only on apps/fourrealities and apps/ledgerseal. I did not read those apps in full.

### 1.2 Commands and results

1. `npx tsc --noEmit -p .` on host: no output, exit 0. Result: 0 type errors. `strict: true` (tsconfig.json:10).
2. `npx jest --coverage --coverageDirectory=/home/fahimfarookme/.cache/gemini-earning-portfolio-audit/cov-definitionguard`: exit 0.
   - Test Suites: 5 passed, 5 total. Tests: 59 passed, 59 total. 0 failed. 0 skipped.
   - Coverage table:

| File | Stmts | Branch | Funcs | Lines | Uncovered lines |
|---|---|---|---|---|---|
| All files | 99.68 | 90.36 | 100 | 99.65 | |
| src/index.ts | 100 | **88.28** | 100 | 100 | 71,118,173,184,209,211,230-236,297-343 (branch) |
| src/domain/checklist-engine.ts | 100 | 91.3 | 100 | 100 | 270,415,426-448,462-472 (branch) |
| src/domain/hasher.ts | 92.85 | 100 | 100 | 90 | 7 |
| src/storage/checklist-repository.ts | 100 | 100 | 100 | 100 | |
| src/validator/transition-validator.ts | 100 | 100 | 100 | 100 | |

   - Coverage exclusions (jest.config.js:6-10): `src/frontend/**` is excluded. The whole UI (src/frontend/index.tsx, 250 lines) has 0 tests. `*.d.ts` is excluded. models.ts has no executable code.
   - Threshold is global 90% (jest.config.js:12-19). Global branch passes at 90.36%. src/index.ts alone is below 90% branch.
3. `node probe.js` (scratch script /home/fahimfarookme/.cache/gemini-earning-portfolio-audit/definitionguard-scratch/probe.js, run against a scratch tsc build of src/domain, src/storage, src/validator). Output:

```
1 stored hash equals recompute: true
2 order independence (reversed items same hash): true
3 changed item title changes hash: true
4 changed checker accountId changes hash: true
5 changed checker display name changes hash: true
6 removed (optional) item changes hash: true
7 edited per-item history changes hash: false
8 edited earlier audit event (not last) changes hash: false
9 edited LAST audit event actorName (id kept) changes hash: false
10 forged state with recomputed hash passes validator: true
11 hash identical across issues (issueId not hashed): true
12 after app name-rewrite stored hash still matches recompute: false
13a reset changes hash: true
13b reset keeps prior audit events: true
13c reset keeps per-item history: true
14 concurrent ticks: completed after both: ["item-peer-review"] stateVersion=2 auditEvents=1
15 JSON bytes after N toggles: {"10":8889,"50":25390,"100":46015,"200":80366,"500":162716,"1000":299966,"2000":574467}
16 toggles (no notes) to exceed 32 KiB / 240 KiB: 76 / 814
17 validator with zero mandatory items allows: true (UI isGateOpen rule index.tsx:105 would show LOCKED)
```

Probe 14 note: the first run of probe 14 used a mock that read the value after the delay. That mock hid the race. The corrected mock takes the snapshot at read time, which is how a real remote KVS read behaves. The result above is from the corrected mock.

## 2. Verdict table

| # | Question | Verdict | Key evidence |
|---|---|---|---|
| 1 | Tenant isolation | PARTIAL | Issue id comes from `context.extension.issue` first (index.ts:132, 209, 269). Payload fallback exists. Project key for templates falls back to payload and to `'DEMO'` (index.ts:328, 342). |
| 2 | Authorization | FAIL | No permission check anywhere. Any viewer can tick, reset, and write project templates (index.ts:207-397). All Jira calls are asApp. accountId comes from context (index.ts:212), but the stored `completedBy` is a display name. |
| 3 | Manifest | PARTIAL | nodejs22.x (manifest.yml:29). Issue panel and validator exist. No project settings page and no admin page. 4 scopes, not the 2 the listing claims. |
| 4 | KVS | FAIL | Lost update observed (probe 14). Unbounded audit trail passes 32 KiB after 76 toggles and 240 KiB after 814 (probe 16). Inconsistent key prefixes. |
| 5 | Jira REST hygiene | PARTIAL | `route` template used. Entity property PUT ignores status and errors (index.ts:157-168, 248-259, 307-319). No retry on 429. N sequential user lookups per panel load. |
| 6 | UI Kit safety, invoke errors | PARTIAL | All three invokes catch errors and show a SectionMessage. Messages are raw `err.message`. No XSS sink (UI Kit text only). |
| 7 | Type safety | PARTIAL | tsc 0 errors, strict. 19 `any` occurrences on 14 lines in src (13 lines in index.ts and repository, 3 `err: any` in frontend). Every handler takes `payload: any, context?: any`. |
| 8 | Tests | PARTIAL | 59/59 pass. Global 90.36% branch, index.ts 88.28%. UI excluded. One test passes for the wrong reason. No auth, race, or size tests. |
| 9 | Persistence and template change | PARTIAL | Persists in KVS at `dg:checklist:<issueId>` (checklist-repository.ts:17). Items are a snapshot. Template or issue-type changes never reach existing checklists. Custom project templates are never applied. |
| 10 | Gate | PARTIAL | Validator blocks when a mandatory item is open (transition-validator.ts:16-27). It fails closed on a missing record (index.ts:111-121). It does not know "Done". The admin must add it to each transition by hand. A storage error throws, with no explicit handling. |
| 11 | Hash | FAIL | Order independent (probe 2). Plain unkeyed SHA-256. Nothing verifies it. History and old audit events are not hashed (probes 7-9). The app's own name rewrite breaks it (probe 12). |
| 12 | Evidence | FAIL | The UI has no evidence field. `notes` exists only in the backend and the UI never sends it (index.tsx:50-53). The listing claims "verification evidence". |
| 13 | Hardcoded or synthetic data | PARTIAL | No fake users or dates. Six hardcoded templates contain prescriptive policy text (for example ">= 90% branch coverage", "SOC 2 and ISO 27001") that the app presents as the customer's DoD. The panel shows internal ticket code "D-13". |
| 14 | Engine logic | PASS (minor) | `calculateMetrics` guards divide by zero (checklist-engine.ts:351-353). The UI and the validator disagree when a template has 0 mandatory items (probe 17). `calculateMetrics` is not used in production. |
| 15 | Mandatory vs optional, progress | PARTIAL | Text lozenges MANDATORY and OPTIONAL (index.tsx:175-179), so the state is not shown by colour only. The panel shows a count of pending mandatory items. It does not name them, and it has no progress bar. |
| 16 | Reset confirm, error messages | PARTIAL | Inline reset confirmation exists (index.tsx:133-149). The validator error names the pending items (transition-validator.ts:44-51). The panel says "Workflow transitions are blocked" even when no validator is set up. |
| 17 | ADS fidelity | PARTIAL | Tokens only (`space.*`). No hex colours. GATE LOCKED uses the blue `inprogress` appearance. The panel shows a raw hash fragment, a "v3" label, and internal code "(D-13)". |

## 3. Findings

Severity scale: Critical blocks any release. High blocks a paid listing. Medium means fix before GA. Low means polish.

### DG-01 High: The "tamper-evident" checklist hash detects no tampering
- Evidence: Observed-code hasher.ts:14-42, checklist-engine.ts:325, 428, 473. Observed-test probes 7, 8, 9, 10, 11, 12.
- The hash is plain SHA-256 over JSON (hasher.ts:40-41). It uses no key and no chain to previous hashes.
- No code anywhere recomputes the hash and compares it. grep shows `calculateChecklistHash` only in the engine. The validator does not read the hash.
- The hash covers only `eventCount` and `lastEventId` from the audit trail (hasher.ts:36-37). It does not cover per-item `history`. A change to an old audit event, or to the actor of the last event, leaves the hash unchanged (probes 7-9).
- `issueId` is not in the hash (probe 11). The same items on two issues give the same hash.
- Anyone who can write the record can recompute the hash. A forged, fully ticked state with a recomputed hash passes the validator (probe 10).
- Failure scenario: an auditor gets the hash from the entity property. The vendor, a support engineer with deploy rights, or a buggy migration rewrites the stored audit trail. The hash still matches, or it is simply recomputed. The auditor sees no difference.
- Who could tamper: Forge KVS is private to the app. Jira users cannot write to it directly. The real risks are the vendor (any code change) and the app's own resolvers. The hash protects against neither of these.
- Fix: remove "tamper-evident" from the UI (index.tsx:137, 224) and the listing. Alternatively, build a real chain: each audit event stores `prevHash`, the chain covers every event and every item history entry, and an HMAC uses a key kept in a Forge environment variable. Add a `verifyChecklist()` function and show its result in the panel.

### DG-02 High: Any user who can view an issue can tick mandatory items and reset the checklist
- Evidence: Observed-code index.ts:207-262, 267-322, 375-385. Inferred for Jira permission semantics.
- No resolver checks a Jira permission. No call uses `asUser()` or `/rest/api/3/mypermissions`. A user with only "Browse projects" can open the panel and tick every mandatory item.
- There is no separation of duties. The assignee can tick "Peer code review approved by authorized reviewers" (checklist-engine.ts:32-35) for their own work.
- Reset needs no special role. One click plus a confirmation clears every tick (index.tsx:133-149, 202-208).
- Failure scenario: a contractor with read-only access ticks all items on a ticket. The ticket then passes the gate, and the record shows the contractor as the person who completed each item.
- Fix: check "Edit issues" (or a permission the admin configures) through `asUser()` before a toggle. Limit reset to project admins. Add per-item roles (for example "reviewer must not be the assignee").

### DG-03 High: Any user can overwrite a project's DoD template, and the payload is not checked
- Evidence: Observed-code index.ts:341-360, 395-397.
- `saveProjectTemplate` is a resolver on the issue panel. It has no admin check. It saves `payload.template` as given, with no schema check and no size cap (index.ts:344, 356-358).
- The project key comes from `context.extension.project.key`. It falls back to `payload.projectKey`, then to `'DEMO'` (index.ts:342). When the context has no project, the payload chooses the project.
- `updatedBy` is set only when the config is new (index.ts:353). Later writes keep the first author's id, so the attribution is wrong.
- Present impact is limited because nothing reads the saved templates (see DG-04). Each project key can still hold an unbounded value, and an attacker can fill storage.
- Failure scenario: after a developer connects saved templates to initialization, any viewer can call `invoke('saveProjectTemplate', {issueType:'Bug', template:{items:[]}})`. Every new Bug then gets an empty checklist and passes the gate.
- Fix: limit this to a `jira:projectSettingsPage` or `jira:adminPage` resolver. Check project admin through `asUser()`. Validate the template shape and its size. Key the template by project id, not project key.

### DG-04 High: Customers cannot define their own DoD; saved custom templates are never used
- Evidence: Observed-code index.ts:118, 151, 230, 297 call `getTemplateForCategory(type)` without `customTemplates`. manifest.yml:1-20 has no settings or admin module.
- `getTemplateForCategory` accepts custom templates (checklist-engine.ts:266-282), but no production caller passes them. `dod-templates:<projectKey>` is written but never read during initialization.
- `ChecklistRepository.getTemplate` and `saveTemplate` (checklist-repository.ts:36-42) are never called in production.
- The only DoD a customer gets is one of six hardcoded templates, selected by matching words in the issue type name.
- Failure scenario: a buyer installs the app and wants "Security sign-off" to be mandatory and "Docs" to be optional. No screen exists to do this. The buyer's Task issues get the "Standard Engineering" template, which includes SOC 2 and ISO items the buyer does not use. These items are mandatory, so the gate blocks the buyer's work.
- Fix: add a project settings page with a template editor. Pass the project config into `getTemplateForCategory` on every initialization path. Record the template version in the state.

### DG-05 High: Concurrent ticks lose updates
- Evidence: Observed-test probe 14. Observed-code index.ts:227-245, checklist-repository.ts:28-30.
- Toggle is read, then modify, then write. It uses no version check and no KVS transaction. `stateVersion` is increased but never compared.
- Two users tick different items at the same time. Only the second tick is stored (probe 14: one item completed, stateVersion 2, one audit event). Both users see a success response.
- Failure scenario: during a release, QA ticks "staging verified" and the lead ticks "peer review". The lead's write erases the QA tick and its audit event. The audit trail shows no trace of the QA tick.
- Fix: store an etag or `stateVersion` and reject a write when it has changed (Forge KVS transactions with a condition), then retry. Or store each item in its own key.

### DG-06 High: The record grows without limit and will hit the KVS value size limit
- Evidence: Observed-code checklist-engine.ts:426 (auditTrail appended with no cap), 390-392 (history capped at 25 per item), 394-396 (notes up to 500 characters). Observed-test probes 15, 16.
- The 6-item default checklist passes 32 KiB after 76 toggles and 240 KiB after 814 toggles without notes. With 500-character notes, it reaches 46 KB after 100 toggles.
- I did not verify the current Forge KVS per-value limit against Atlassian documentation in this session. The brief states 32 KiB. My recollection is 240 KiB. Both limits are reachable.
- Failure scenario: a long-lived ticket is ticked and unticked many times, or a script calls the resolver in a loop. `kvs.set` then fails on every toggle. The user cannot tick the last item. The gate stays closed for good, and only the vendor can fix it.
- Fix: move the audit trail to append-only keys (`dg:audit:<issueId>:<seq>`) or to a Forge SQL table. Keep the item state small. Add a size test.

### DG-07 Medium: The gate is not tied to "Done", and the admin must add it manually
- Evidence: Observed-code index.ts:82-125, transition-validator.ts:7-34, manifest.yml:11-15.
- The validator never reads the transition, the target status, or the status category. It blocks whatever transition the admin attaches it to. The admin must add "DefinitionGuard DoD Enforcement" to each transition in each workflow by hand. The app does not do this.
- If the admin adds the validator to "Start progress", work cannot start until the DoD is complete. If the admin forgets a second path into Done (for example a global transition), that path is ungated.
- The panel says "Workflow transitions are blocked" (index.tsx:125) even when no validator exists. This is false on a fresh install.
- Never opening the panel does not let an issue bypass the gate. The validator creates a checklist from a template and blocks (index.ts:111-121; test index.test.ts:123-127). This part fails closed and is correct.
- Fix: read `payload.transition.to` and check status category `done`. Alternatively, document the manual setup in the listing and the panel. Add an onboarding check that lists the workflows that do not have the validator.

### DG-08 Medium: Validator error handling and side effects
- Evidence: Observed-code index.ts:102-121. Inferred for Jira behaviour.
- `repository.getIssueChecklist` and `saveIssueChecklist` are not wrapped in try/catch. A KVS error throws out of the validator. I did not verify how Jira treats a Forge validator that throws or times out. If Jira lets the transition pass on a throw, the gate fails open.
- The validator writes storage as a side effect and calls Jira two times in the worst case (index.ts:87, 114). Line 114 calls the issue API even when the context already gives the issue type.
- If only the key arrives and the lookup fails, the code stores a new checklist under the issue key (index.ts:91, 119-120). The panel uses the numeric id (index.ts:132). The two records split, and ticks in the panel never satisfy the validator for that issue. The fallback path is a corner case.
- Fix: wrap the validator in try/catch and return `{result:false, errorMessage:'DefinitionGuard could not read the checklist. Try again or contact your admin.'}`. Do not write from the validator. Always resolve the numeric id.

### DG-09 Medium: Panel loads rewrite stored attribution and break the hash
- Evidence: Observed-code index.ts:169-198, 218-222, 239. Observed-test probe 12.
- On every panel load, the code replaces any `completedBy` or history `userId` that contains `:` with the current display name and saves it. It does not recompute `checklistHash`, so the stored hash no longer matches its own content.
- Toggle stores the display name in `completedBy` and history `userId` (index.ts:239, checklist-engine.ts:386, 401). Display names change. The stable id is kept in `completedByAccountId`, and the history `userAccountId` is kept only if present.
- The `includes(':')` test also catches a real display name with a colon in it. The code makes one sequential Jira call per matching field on every load (resolver latency).
- Failure scenario: an auditor checks a record from last year. The names show the current display names, not the names at the time. The hash no longer matches the content.
- Fix: store the accountId only. Resolve names at render time in the UI. Never change audit records after they are written.

### DG-10 Medium: The entity property is best effort, incomplete, and can be spoofed
- Evidence: Observed-code index.ts:157-168, 248-259, 307-319.
- Status codes and exceptions are ignored (`catch {}`). A failed PUT leaves the property stale, and nobody is told.
- The validator's auto-initialization does not write the property (index.ts:111-121). The name rewrite does not update it.
- `completedCount` counts optional items too. A reader cannot tell mandatory progress from the property.
- Jira issue properties can be edited by any user with Edit Issues permission through REST (Inferred, standard Jira behaviour). FourRealities reads this property (grep, fourrealities/src/index.ts:186). A user can set `isFullySatisfied:true` and fool that reader.
- Fix: see section 6.

### DG-11 Medium: No evidence capture, but the listing claims it
- Evidence: Observed-code index.tsx:50-53 (sends only itemId and isCompleted), models.ts:52 (`notes`), checklist-engine.ts:394-396.
- A user ticks a mandatory item with one click. The user gives no link, no note, and no attachment. `notes` exists in the backend but the UI never sends it and never shows it.
- The template text says "Evidence captured for SOC 2 and ISO 27001 audit trail" (checklist-engine.ts:54), but the app captures no evidence.
- Failure scenario: a SOC 2 auditor asks for evidence behind "Security scan clear". The record shows only a name and a time.
- Fix: add an optional or required evidence field per item (URL or text). Show it in the panel. Remove "verification evidence" from the listing until this exists.

### DG-12 Medium: Checklists never follow template or issue-type changes
- Evidence: Observed-code checklist-engine.ts:316-322 (snapshot; `description` dropped), index.ts:143-155.
- Once created, a checklist keeps its items forever. A Task changed to a Bug keeps the Task checklist. A template update in a new app version never reaches open issues.
- Item `description` (for example ">= 90% branch coverage") is not copied to the instance and is never shown.
- Failure scenario: the vendor fixes a template item. Thousands of open issues keep the old item. The audit then mixes old and new definitions with no version marker.
- Fix: store the template id and version. Offer an explicit admin "re-sync" that keeps ticks for unchanged item ids and writes an audit event.

### DG-13 Medium: Tests are thin where the risk is
- Evidence: Observed-code test/index.test.ts:378-389, jest.config.js:9. Observed-test coverage table.
- The test "covers validateTransition fallback lookup by issueKey" stores at `issue:CR-2`. The repository never reads that key (`dg:checklist:` prefix, checklist-repository.ts:17). The test passes only because auto-initialization blocks. It does not test the fallback.
- The UI is excluded from coverage. No tests cover authorization, concurrency, storage size, storage failure in the validator, or hash verification.
- `hasher.test.ts:65-73` asserts only `toBeDefined()`. It is a coverage test, not a behaviour test.
- Most tests are behavioural. Examples: toggle attribution, the history cap, and the validator message.
- Fix: correct the fallback test. Add the missing negative tests. Put a per-file threshold on src/index.ts.

### DG-14 Low: The UI and the validator disagree when a template has no mandatory items
- Evidence: Observed-code index.tsx:105, transition-validator.ts:16-33. Observed-test probe 17.
- The validator allows the transition. The panel shows "GATE LOCKED, 0 mandatory item(s) remain pending".
- No built-in template has zero mandatory items. A custom template could, after DG-04 is fixed.
- Fix: use one rule in both places (share `calculateMetrics`).

### DG-15 Low: UX polish
- Evidence: Observed-code index.tsx:105-131, 134, 155-159, 176, 228, 236-238, 86.
- The warning shows only the count of pending mandatory items. It should list them.
- GATE LOCKED uses `inprogress` (blue). MANDATORY uses `moved` (yellow). Neither matches ADS semantics well.
- The user sees the internal code "(D-13)", a version label "v3", and a 16-character hash fragment with no explanation.
- The audit trail shows `itemId` (for example `item-peer-review`), not the item title.
- Times show as UTC ISO strings, not in the user's locale.
- The confirmation is an inline SectionMessage, not an ADS Modal. This is acceptable in a panel.
- Error messages show raw `err.message` and give no next step.

### DG-16 Low: Hygiene and dead code
- Evidence: Observed-code index.ts:44-46, 365-370; package.json:36; manifest.yml:6; checklist-engine.ts:285-300.
- `renderIssuePanel` returns `moduleKey: 'definitionguard-panel'`, but the manifest key is `definitionguard-issue-panel`. The function is dead code.
- `@forge/storage` is a dependency but no source file imports it. The code uses `@forge/kvs`.
- Production code contains a `NODE_ENV === 'test'` branch (index.ts:44-46).
- The panel icon is loaded from raw.githubusercontent.com (manifest.yml:6). Bundle it as a resource.
- Template selection matches substrings. "Debug task" matches `bug`. "Incident" gets the code-fix Bug template with "regression test" and "staging" items. "Support" is checked before "bug".

## 4. What is correct

- The issue identity comes from the trusted `context.extension.issue` first (index.ts:132, 209, 269). The panel invokes with `{}` (index.tsx:34, 70). From the issue panel, a payload cannot redirect a tick to another issue.
- The actor comes from `context.accountId` before any payload value (index.ts:212, 220). `completedByAccountId` and audit `actorAccountId` keep the real accountId.
- Checklists are keyed by the stable numeric issue id, not the key. Moving an issue does not orphan its checklist.
- The validator fails closed when no checklist exists (index.ts:111-121). The validator also blocks on missing issue context (index.ts:95-100).
- The validator's Jira error message names the pending mandatory items (transition-validator.ts:44-51).
- The hash is order independent (probe 2). It changes when the title, accountId, display name, or item set changes (probes 3-6). Reset changes the hash and keeps all prior audit events and item history (probes 13a-c).
- Notes are capped at 500 characters. Item history is capped at 25 entries.
- Divide by zero is guarded in `calculateMetrics`.
- Mandatory and optional are shown as text, not by colour only.
- Reset has a confirmation step.
- `route` tagged templates are used for every Jira path. The manifest uses runtime nodejs22.x and UI Kit `render: native`.
- tsc reports 0 errors in strict mode. 59 of 59 tests pass.

## 5. Listing and spec over-claims

| Claim | Source | Reality |
|---|---|---|
| "Only requests `read:jira-work` and `storage:app`" / "Least Privilege" | README:12, listing:23 | manifest.yml:32-36 also has `write:jira-work` and `read:jira-user`. |
| Data in `@forge/storage` | README:11, spec:13, 81 | The code uses `@forge/kvs` (index.ts:3). The spec keys `checklist:issue:{id}` etc. do not match the code key `dg:checklist:{id}`. |
| "Halts transitions to Done, Resolved, Released/Deployed" | README:16, listing:7, spec:8 | The validator does not check the target status. It runs only where an admin adds it (DG-07). |
| "Log exact user identity, timestamp, and verification evidence" | listing:8 | No evidence capture (DG-11). Display names are rewritten after the fact (DG-09). |
| "Tracks exact user account IDs" | README:17 | accountId is stored, but the visible `completedBy` is a mutable display name. |
| "Tamper-evident audit trail/history" | index.tsx:137, 224 | Not tamper-evident (DG-01). |
| "SHA-256 state hash for compliance verification" | listing:9 | Nothing verifies it, and the app itself breaks it (DG-01, DG-09). |
| "Seamless LedgerSeal Integration" | listing:11, README:18, spec:9 | DefinitionGuard writes no LedgerSeal-specific data. grep finds no `definitionguard` or `checklistHash` reference in apps/ledgerseal/src. FourRealities reads the property, not LedgerSeal. |
| "100% automated test coverage" | listing:24 | 90.36% branch, 88.28% on index.ts. UI excluded. |
| "Zero Config Setup" | listing:10 | True only in that defaults exist. No config is possible at all (DG-04). |
| "Inherits SOC 2, ISO 27001, GDPR compliance natively" | listing:18 | This is a platform claim, not an app property. It needs legal review. |
| "carries the official Runs on Atlassian badge" | listing:15 | The badge is granted by Atlassian after review. It cannot be claimed in advance. Zero egress is true by code: the manifest has no `external` permissions. |
| Spec invariant 4: "Every state change records the user account ID" | spec:15 | Validator auto-init records `'system'` (index.ts:119). Anonymous falls back to `'anonymous'` / `'unknown'`. |
| Spec storage: project default template key | spec:84 | Saved project templates are never applied (DG-04). |

## 6. Integration facts (Jira entity property)

- DefinitionGuard writes Jira issue property key **`definitionguard-dod`** with `api.asApp()` PUT `/rest/api/3/issue/{issueId}/properties/definitionguard-dod`.
- Shape written on first panel load (index.ts:157-168) and on toggle (index.ts:248-259):
  ```json
  { "isFullySatisfied": boolean, "completedCount": number, "totalCount": number, "checklistHash": "sha256 hex" }
  ```
- Shape on reset (index.ts:307-319): the same four fields plus `"lastModifiedAt": "ISO-8601"`.
- Not written: on validator auto-init (index.ts:111-121), on the name rewrite (index.ts:196-198), or on any failed PUT (errors swallowed).
- Consumer: FourRealities reads `definitionguard-dod` or `definitionguardDod` (grep: apps/fourrealities/src/index.ts:186, 273, 393, 603). LedgerSeal has no reference (grep on apps/ledgerseal/src).
- What to add for a reliable integration:
  1. `schemaVersion`, `issueId`, `stateVersion`, `templateId` and template version, `mandatoryTotal`, `mandatoryCompleted`, `incompleteMandatoryItemIds`, `lastModifiedAt`, and `lastModifiedByAccountId`, on every write.
  2. Write the property on every state change, including validator init. Check the HTTP status and retry on 429 or 5xx.
  3. Make spoofing detectable. Add an HMAC field (`sig`) over the canonical property JSON, with a key held in a Forge environment variable that each consuming app shares. Readers must treat an unsigned or mismatched value as "unknown", not "satisfied".
  4. Document in the listing that the property is informational. The authoritative gate is the validator over app storage.

## 7. Suggestions

### 7.1 Quick wins (days)
- Remove "tamper-evident", "verification evidence", the scope list, "100% coverage" and the badge claim from the listing and UI.
- Wrap the validator in try/catch and fail closed with an actionable message.
- List the pending mandatory item titles in the panel warning.
- Show item titles, not ids, in the audit trail. Remove "(D-13)" and the "v3" label.
- Fix the broken fallback test. Drop `@forge/storage` and `renderIssuePanel`.
- Stop the display-name rewrite on read.

### 7.2 Hardening (1-3 weeks)
- Add a permission check on toggle (asUser, Edit issues) and an admin-only reset.
- Add optimistic concurrency with KVS transactions, or per-item keys.
- Move the audit trail to append-only keys or Forge SQL. Add size tests.
- Build a real hash chain with HMAC and a verify routine shown in the panel.
- Write the entity property in full, signed, on every change.
- Add tests for authorization, races, storage failure, size, and the UI.

### 7.3 Strategic UX (1-2 months)
- Add a project settings page with a template editor (mandatory flags, per-item required role, evidence required) and template versioning with re-sync.
- Gate on status category `done` by default. Add an onboarding check that lists workflows where the validator is missing.
- Add per-item evidence (link, text, attachment) and a "reviewer must not be the assignee" rule.
- Add an exportable audit report per issue and per sprint, with a verification result.

## 8. Readiness score: 35 / 100

Rationale:
- The core loop works and is tested: tick items, persist by issue id, and block the transition with a named list of pending items. Missing checklists fail closed. Types and tests are clean. This earns the base score.
- The paid value proposition is "compliance gate with tamper-evident audit". That proposition fails in five places. The hash detects nothing (DG-01). Anyone who can view an issue can self-attest (DG-02). Customers cannot set their own DoD (DG-04). Concurrent ticks are lost (DG-05). The record grows until writes fail (DG-06).
- The listing over-claims scopes, evidence, coverage, LedgerSeal integration and the gate behaviour.
- It could ship as a free, honestly described "DoD checklist plus validator" after the quick wins. It should not ship as a paid compliance product until the hardening tier is done.
