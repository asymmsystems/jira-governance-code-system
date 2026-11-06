APPROVED 2026-11-01 B-01..B-20 (owner, in chat: "APPROVED now all"; [MANIFEST], [VAR] and [MIGRATE] flags approved; D-1, D-2, D-3 recommendations accepted); B-21 added and approved 2026-11-01 (owner, in chat: "approve", ADR-01), built before B-12

# LedgerSeal: ranked backlog

- **Date:** 2026-11-01
- **Status:** approved by the owner on 2026-11-01 for B-01 to B-20 (first line).
- **Inputs:** `research-brief.md` (verdicts, USP table, clause map), `ux-spec.md` (target interactions, budgets), audit findings LS-01 to LS-22 and PX-01 to PX-04.
- **Order:** release-blocking findings first, in the brief's order: LS-01, LS-02, LS-06, LS-03, LS-04 and LS-05, LS-08, LS-09, LS-10. Then PX-02 and PX-04. Then the rest by value.
- **Trust boundary (all items):** the panel and the validator verify against app storage (KVS), never against the `ledgerseal-cert` entity property. Any editor can change the property (NJ-30).
- **Test types:** U = unit (pure domain code), R = resolver test with an injected Jira client and an in-memory store, V = UI view-model test (no React), P = live probe on `[LS-PROBE]` issues in DEMO after deploy (Loop 3), A = adversarial re-run of a T-02 scenario in `docs/sdlc/ledgerseal-usp-ux-research-2026-11/evidence/probes/`.
- **Every item also needs the brief's section 11.2 checks:** `tsc --noEmit`, jest with at least 90% branch coverage per changed file, behaviour assertions, and no em dash.

## Approval flags

Items with these flags need explicit owner approval before the work starts (brief sections 6 and 11.1).

| Flag | Meaning | Items |
|---|---|---|
| [MANIFEST] | Changes `manifest.yml` (module, scope or licensing) | B-11, B-18, B-19, B-20; B-01 if decision D-1 picks a settings page |
| [VAR] | Needs a Forge encrypted variable | B-09 (Ed25519 private key) |
| [MIGRATE] | Changes the KVS key layout; existing records need migration or a legacy read path | B-02, B-03, B-17 |
| [DEP] | Adds an npm dependency (shared `node_modules` with CascadePlan, FourRealities, DefinitionGuard) | none planned. B-15 stops and asks if a React test renderer is wanted |
| [WORKFLOW] | Changes a workflow on the site | none. Loop 3 does not attach the validator without approval |

## Owner decisions needed

| ID | Decision | Options | Recommendation |
|---|---|---|---|
| D-1 | Where the approver policy comes from (B-01) | (a) a Jira project role with a fixed name, for example "LedgerSeal Approvers"; (b) a group per project, set on a project settings page [MANIFEST]; (c) a Jira project permission such as Administer Projects | (a) for this round: no manifest change, and admins already manage roles. Part B must first confirm that the app can read role members with the current scopes (FG-35, FG-36); if not, fall back to (c) and record it |
| D-2 | Is `status` inside the seal? (B-05) | (a) excluded from the gate hash, because the gated transition itself changes it, but recorded in the certificate; (b) hashed | (a), stated in the panel's "Not covered" list with the reason |
| D-3 | What to do with existing v1 certificates on the development site (B-02, B-03) | (a) read v1 as legacy and show "Sealed with an old format. Reseal to get the new record."; (b) migrate in place | (a): no write to old records, so no data loss |

## Items

### B-01 Approver policy and separation of duties for seal, reseal and revoke
- **Serves:** U2 and U5 (honest reseal); 11.10(g) wording.
- **Closes:** LS-01, LS-14. **Depends on:** D-1.
- **Acceptance criteria:**
  1. Production code has no `process.env.NODE_ENV` branch. Resolvers take an injected Jira client with separate `asApp` and `asUser` members. (U: a grep test over `src/`; R)
  2. `sealIssue` from a user outside the policy returns `{ ok: false, code: 'NOT_APPROVER' }`. KVS and the property are unchanged. (R, A: T-02 A1 with `mallory-9` outside the policy)
  3. After a tamper, a reseal by a user who authored any change since `sealedAt` (from the changelog) returns `{ ok: false, code: 'SELF_APPROVAL' }`. (R, A: T-02 A1)
  4. A reseal by a different policy member succeeds, and the validator then returns `result: true`. (R)
  5. When `context.accountId` is absent, every resolver fails with `NO_IDENTITY` and writes nothing. (R)
  6. The permission check uses `asUser()` or a documented permission API, never only `asApp()` (FG-35). (R: the `asUser` mock records the call)
- **Size:** L.

### B-02 Tamper record that survives a reseal, with a hash-chained history
- **Serves:** U2, U5; 11.10(e) "shall not obscure previously recorded information" (REG-10).
- **Closes:** LS-02, LS-13 (history part). **Depends on:** B-01. **Flag:** [MIGRATE] (D-3).
- **Acceptance criteria:**
  1. Each seal, incident, reseal and revoke is a history entry under its own key. Each entry holds `prevEntryHash` = SHA-256 of the previous entry's canonical JSON. (U)
  2. After seal, tamper, view and reseal, the active record has `everCompromised: true` and `incidentCount: 1`, and the panel view model shows "Resealed after 1 change incident". (R, V, A: T-02 A2 `everCompromisedVisible` = true)
  3. A verifier that recomputes the chain finds the first changed entry when any stored entry is edited. (U)
  4. The history is readable through a resolver, oldest first, paged at 50 entries. (R)
  5. A v1 certificate is read as legacy and never rewritten (D-3). (R)
- **Size:** L.

### B-03 A read never writes
- **Serves:** trust; budgets in `ux-spec.md` section 3.
- **Closes:** LS-06, NF-02. **Depends on:** B-02. **Flag:** [MIGRATE].
- **Acceptance criteria:**
  1. Verify on an unchanged sealed issue makes 0 KVS writes and 0 property writes. (R, A: T-02 A4 `validView` = 0 / 0)
  2. 500 views of a tampered issue with one live hash make 1 incident, 1 KVS write set and 1 property write in total. The active value does not grow. (R, A: T-01 `after500TamperedViews`)
  3. A new live hash (a second change) adds exactly one incident. (R)
  4. `verifyIssue` returns a view model of at most 16 KiB for the combined fixture, with no snapshot and no email (NF-03, LS-17). (R, T-01 `responseBytes`)
- **Size:** M.

### B-04 Identity from context only
- **Serves:** 11.50(a), 11.100(a).
- **Closes:** LS-03, LS-17. **Depends on:** B-01.
- **Acceptance criteria:**
  1. The resolver ignores `signerEmail`, `signerDisplayName` and `signerAccountId` in the payload. A spoofed payload stores the context account only. (R, A: T-02 A3 `storedEmail` = null)
  2. The certificate stores `accountId` and the Jira display name at signing time. It stores no email. (R)
  3. The view model gives the `accountId` for the UI Kit `User` component (FG-40). (V)
- **Size:** S.

### B-05 Sealed field set chosen by schema type
- **Serves:** U1, U4; "shows covered fields" claim.
- **Closes:** LS-04, LS-05. **Depends on:** D-2.
- **Acceptance criteria:**
  1. The canonicalizer has no hard-coded `customfield_` id and no value heuristic (`pullrequest`, `0|`, `.state`, `approvers`). (U: source grep test)
  2. Exclusion uses `schema.custom` and `schema.system` from `/rest/api/3/field`, with a named, documented list (Rank, Sprint, SLA, CSAT, development summary, request participants). (U with a captured field list)
  3. Reporter, resolution and worklog changes break the seal. A change to a custom field with id `customfield_10001` breaks it. (U, A: T-03 C03, C04, C06, C09, C10, C11, C12 all `correct`)
  4. The certificate stores the covered field ids and names and the excluded ones with a reason. The view model lists both. (U, V)
  5. One `/field` call per verify at most; it is cached for the invocation. (R)
- **Size:** L.

### B-06 Honest results when Jira cannot be read
- **Serves:** task 9 in `ux-spec.md`.
- **Closes:** LS-08, LS-19, LS-15. **Depends on:** B-01 (injected client).
- **Acceptance criteria:**
  1. If the issue GET fails, the validator returns `result: false` with "LedgerSeal could not read the issue from Jira, so this transition is blocked. Try again in a minute." It writes no property. (R, A: T-02 A5 `byKey`, `byId`, `propertyWrites` = [])
  2. Verify returns `{ state: 'ERROR', reason: 'JIRA_UNREACHABLE' }`, not "not sealed". (R, V)
  3. A 429 or 5xx is retried up to 3 times, honouring `Retry-After`, inside a 20 s total budget (FG-01, FG-29). (R with a fake clock)
  4. The issue GET asks for explicit `fields=`, and comments come from the paginated comment endpoint. (R)
- **Size:** M.

### B-07 Declaration text and version
- **Serves:** 11.50; honest wording.
- **Closes:** LS-09. **Depends on:** none.
- **Acceptance criteria:**
  1. The declaration text and version live in one module. The panel shows that exact text, and the certificate stores that exact text and version. (U, V, A: T-02 A6 `equal` = true)
  2. The free-text "re-authentication" field is gone from the payload contract and the UI. (R, V)
  3. A payload with a different `declarationText` is rejected with `DECLARATION_MISMATCH`. (R)
- **Size:** S.

### B-08 Integrity check on every read
- **Serves:** 11.50(b) controls; A.5.33.
- **Closes:** LS-10 (part 1). **Depends on:** B-02.
- **Acceptance criteria:**
  1. Verify and the validator call `verifyCertificateIntegrity` (or its v2 equivalent) on every stored record. (R)
  2. A stored record whose signer was rewritten gives `{ state: 'RECORD_INVALID' }` in the panel, and the validator blocks with "LedgerSeal: the seal record failed its integrity check. Contact your Jira admin." (R, A: T-02 A7 status is not SEAL_VALID)
  3. The UI and the listing say "tamper-evident", not "cryptographic proof". (V)
- **Size:** S.

### B-09 Signed attestation in `ledgerseal-cert` (schema v2)
- **Serves:** U3, U5; H11.
- **Closes:** LS-10 (part 2), H11. **Depends on:** B-02, B-03, B-13. **Flag:** [VAR].
- **Acceptance criteria:**
  1. The property body matches audit section 5.1: `schemaVersion: 2`, `issueId`, `status`, `certificateId`, `snapshotHash`, `canonicalizerVersion`, `sealedAt`, `sealedByAccountId`, `everCompromised`, `incidentCount`, `issuedAt`, `keyId`, `sig`. (U)
  2. `sig` is Ed25519 over the canonical JSON of the other fields, made with Node's built-in `crypto`. No npm package is added. (U)
  3. Verification with the public key passes. It fails for a changed field, a copied value with another `issueId`, and an unknown `keyId`. (U)
  4. The private key comes only from a Forge encrypted variable. It never appears in a log, a test fixture or a commit. Tests use a key made at test start. (R; source grep for PEM headers)
  5. The property body is at most 2 KiB (FG-25). (U)
- **Size:** M.

### B-10 Remove the claims that failed
- **Serves:** PX-02; H4, H5.
- **Closes:** PX-02 (README, `package.json`, UI text, validator text, manifest description). The listing is rewritten in Loop 3 (brief section 12.5). **Depends on:** none.
- **Acceptance criteria:**
  1. No file under `apps/ledgerseal` contains "21 CFR", "Part 11", "SOC 2", "soc2", "ISO 27001", "iso27001", "immutable", "audit ready", "AUDIT READY", "Cloud Fortified" or "compliant", except in a test that asserts their absence. (U: source grep test)
  2. Every UI and validator text equals the replacement in `ux-spec.md` section 5. (V, R)
  3. README test numbers equal the measured numbers of the last jest run. (manual check recorded in `round-log.md`)
- **Size:** S.

### B-11 Record changes when they happen (issue-updated trigger)
- **Serves:** U1 (who and when); PX-04 (the property never stays stale).
- **Closes:** LS-16, PX-04 (LedgerSeal side). **Depends on:** B-03. **Flag:** [MANIFEST] (a `trigger` module for `avi:jira:updated:issue`, `avi:jira:commented:issue` and the attachment events, FG-32, FG-33).
- **Acceptance criteria:**
  1. An update event on a sealed issue whose covered fields changed records one incident with the changelog author and time, and writes the property once. (R with a captured event payload)
  2. An update to a field that is not covered writes nothing. (R)
  3. An edit and a revert between two views is still recorded (T-02 A9 validator = false). (R, A)
  4. The trigger finishes within the 25 s limit for a 100-field changelog (FG-01). (R timing)
- **Size:** M.
- **Note:** CascadePlan's part of PX-04 (lock badge, confirm before writing to a sealed issue) belongs to the CascadePlan backlog.

### B-12 Change list with who and when
- **Serves:** U1; task 3 in `ux-spec.md`.
- **Closes:** LS-16 (UI), G-06, G-07. **Depends on:** B-05, B-11.
- **Acceptance criteria:**
  1. Each changed field row has field name, was, now, changed by (`accountId`) and when, from the changelog since `sealedAt` (NJ-20) or the recorded incidents. (V, R)
  2. Values over 200 characters carry a "Show full value" flag. Rich text gives a paragraph-level summary. (V)
  3. An issue type or project change gives a row "Issue type changed from X to Y" (NF-01). (U, A: T-03 C05 names a field)
  4. The validator message lists at most 5 field names and the count of the rest, under 250 characters. (R)
- **Size:** M.

### B-13 Canonical form v2
- **Serves:** U4; deterministic and honest hashing.
- **Closes:** LS-11, LS-22, NF-01 (hash side). **Depends on:** B-05.
- **Acceptance criteria:**
  1. Users hash by `accountId` only. A display-name change keeps the seal. (U, A: T-03 C19 `correct`)
  2. Date-times normalise to UTC ISO-8601. The same instant in two time zones gives one hash. (U, A: T-03 C18)
  3. Only schema-declared set fields are sorted. Ordered arrays keep their order (T-03 C14). Typed text is not trimmed; only line endings are normalised (T-03 C15). (U)
  4. Every certificate stores `canonicalizerVersion: "2.0.0"`. (U)
  5. A written specification of the canonical form is in `docs/spec/ledgerseal-spec-v2.md`, with 10 test vectors that the unit tests also check. (U)
- **Size:** M.

### B-14 Evidence export and an open verifier
- **Serves:** U4, U5; ux-spec task 6; 11.10(b); AS 1105 (REG-66).
- **Closes:** spec claim 21 (PDF/A) by replacing it. **Depends on:** B-09, B-13.
- **Acceptance criteria:**
  1. A resolver returns an evidence JSON with the attestation, the canonical snapshot, the history chain and the verification steps, under 5 MB (FG-04). (R)
  2. A stand-alone verifier script (Node standard library only, outside `src/`) checks the snapshot hash, the chain and the Ed25519 signature with the public key, and exits 0 or 1. (U on the script)
  3. The verifier rejects an export with one changed field value. (U)
- **Size:** M.

### B-15 Panel view model and the missing states
- **Serves:** all ux-spec tasks; PX-03.
- **Closes:** LS-12, LS-13 (UI), LS-21, PX-03 (for this app), G-01 to G-13. **Depends on:** B-03, B-04, B-07.
- **Acceptance criteria:**
  1. A pure module (no React import) maps the resolver result and the user's rights to a view model. Tests cover loading, sealed, changed, changed-back, revoked, not sealed, record invalid and error. (V)
  2. The view model hides seal, reseal and revoke actions from users who may not take them, and gives the "Ask a member of ..." text (G-10). (V)
  3. Times are local with the zone; the full hash has a copy value (LS-21). (V)
  4. `index.tsx` only maps the view model to UI Kit components. `jest.config.js` covers the view-model file. (U: coverage config test)
  5. If a React render test needs a new package, stop and ask [DEP].
- **Size:** L.

### B-16 Revoke
- **Serves:** ux-spec task 8; 11.10(g).
- **Closes:** LS-13. **Depends on:** B-01, B-02, B-15.
- **Acceptance criteria:**
  1. `revoke-seal-api` with a reason (1 to 500 characters) from a policy member writes a revoke history entry and sets the state to REVOKED. (R, A: T-02 A10 reachable)
  2. A revoke from a non-member returns `NOT_APPROVER` and writes nothing. (R)
  3. The validator blocks with the revoked text in ux-spec task 5. (R)
- **Size:** S.

### B-17 Bounded storage and concurrency control
- **Serves:** budgets in `ux-spec.md` section 3.
- **Closes:** LS-07. **Depends on:** B-02. **Flag:** [MIGRATE].
- **Acceptance criteria:**
  1. No single KVS value passes 120 KiB for the combined fixture (T-01). The snapshot is split by part. (R)
  2. Two concurrent seals: one succeeds, the other gets `CONFLICT` and the message in ux-spec task 1. (R with an interleaving store)
  3. Writes of one seal use one KVS transaction of at most 25 operations (FG-08). (R)
- **Size:** M.

### B-18 JQL for broken and unsealed issues
- **Serves:** ux-spec task 7.
- **Closes:** LS-20 (index part). **Depends on:** B-09. **Flag:** [MANIFEST] (`jira:entityProperty`, FG-26).
- **Acceptance criteria:**
  1. The manifest indexes `status` and `everCompromised`. (U: manifest test)
  2. Live: `issue.property[ledgerseal-cert].status = SEAL_BROKEN` returns the `[LS-PROBE]` issue that was changed. (P)
- **Size:** S.

### B-19 Marketplace licensing
- **Closes:** PX-01. **Flag:** [MANIFEST] (`app.licensing`, FG-37).
- **Acceptance criteria:**
  1. With an inactive licence, every resolver returns `LICENSE_INACTIVE` and the panel shows the ADS licence message. The validator does not change a transition outcome on licence alone; the decision is recorded in spec v2. (R, V)
- **Size:** S.

### B-20 Bundled icon and dead code
- **Closes:** LS-20, claim 15 (outbound icon). **Flag:** [MANIFEST] (icon resource).
- **Acceptance criteria:**
  1. The manifest has no `http` URL. (U: manifest test)
  2. `renderIssuePanel` is removed and no test imports it. (U)
- **Size:** S.

### B-21 Silverston WorkEffort, Party and Status data model (ADR-01, D-10) [MIGRATE]
- **Serves:** one vocabulary with CascadePlan; an explicit state machine; a stable base for B-13, B-14 and B-17.
- **Closes:** nothing new. It rebuilds the storage of B-02, B-03, B-08, B-09 and B-11 without changing their behaviour. **Depends on:** B-11. **Built before:** B-12.
- **Acceptance criteria:**
  1. A seal writes `ls3:we:{issueId}` (`workEffortTypeId: JIRA_ISSUE`, `sourceReferenceId` = key, `currentStatusId: LS_SEALED`), one `ls3:wepa:{issueId}:{fromDate}` assignment (`partyId`, `roleTypeId` from the meaning, `thruDate: null`, no display name), one `ls3:wes:{issueId}:{seq}` status row and the content parts. No `ls2:` key is written. (R)
  2. The meanings map to the roles `LS_APPROVER`, `LS_REVIEWER` and `LS_VERIFIER`. (U, R)
  3. A change writes an `LS_CHANGED` row with `setByPartyId: null`. A reseal ends the previous assignment (`thruDate` = reseal time), adds a new one with the reason in `comments`, and writes an `LS_SEALED` row with `transitionName: RESEAL`. (R)
  4. `src/domain/status.ts` lists exactly the allowed changes of spec v2 section 3.2, and the service refuses any other. (U)
  5. A rewritten assignment or sealing row is reported as `RECORD_INVALID`. (R, A: T-02 A7)
  6. Every test from B-01 to B-11 passes against the new model. Tests that read storage use the model helpers, not raw keys. (all)
- **Size:** L.

## Top 10 for the gate

B-01, B-02, B-03, B-04, B-05, B-06, B-07, B-08, B-09, B-10.

With B-01 to B-08 and B-10 done, the 6.3 "after" wording becomes testable, except for the signed record. B-09 needs [VAR] approval for the signing key.
