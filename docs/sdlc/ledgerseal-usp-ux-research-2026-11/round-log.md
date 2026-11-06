# LedgerSeal research and build: round log

One entry per research round and per build item. Dates are 2026-11-01 unless stated.

## Setup checks (Part A)

- `git -C jira-governance-code-system status -s`: no change under `apps/ledgerseal`. Uncommitted changes exist under `apps/planshift` and `loop-engine/agents/` (not made by this research, not touched).
- Repo HEAD `423b9b2`, branch `feature/cascadeplan-research-build` (another session's branch). Part A did not switch branches and made no commit.
- md5 of every LedgerSeal file in the audit snapshot equals the current file (manifest, package, tsconfig, jest config, all `src/` and `test/` files, README, spec, listing). Every LS finding is therefore unchanged at its cited lines.
- `loop-engine/runs/ledgerseal_state.json` says `ALL_LOOPS_COMPLETE` with grade_tdd score 93.26. The graders check section keywords, the presence of two scope strings, banned import names, and global branch coverage (`loop-engine/graders/*.py`). None of them checks permissions, identity, storage growth or claims. A grader pass is not evidence for any verdict in this research.

## Round 1: collect

- Three research agents, run in parallel, each writing one evidence file in `~/Documents/projects/jira-governance/.tmp/cache/ledgerseal-research/sources/`:
  - `reg-sources.md`: 109 items (REG-01 to REG-109). The Part 11 text comes from the eCFR API (current to 2026-10-29). The FDA guidance, NIST, PIC/S and EU draft Annex 11 PDFs were extracted verbatim.
  - `native-forge-sources.md`: 107 items (NJ-01 to NJ-45, JAC-01 to JAC-20, FG-01 to FG-42). Ticket votes come from the public jira.atlassian.com API.
  - `marketplace-sources.md`: 15 apps, MP-01 to MP-69. Installs, prices and reviews come from the public Marketplace REST API.
- Rule incidents, recorded:
  - The Marketplace agent opened one third-party vendor page on `werkstack.atlassian.net` by mistake, and a second fetch to `polscheit.atlassian.net` returned a redirect only. No content from either is used.
  - The owner's site (`asymmsystems.atlassian.net`) was not contacted by any agent or probe.
- Probes (T-01 to T-03), written in `docs/sdlc/ledgerseal-usp-ux-research-2026-11/evidence/probes/`. They import `apps/ledgerseal/src` read-only, mock `@forge/api` (separate `asApp` and `asUser` entries) and `@forge/kvs`, and run with `NODE_ENV=production`, so the LS-14 bypasses are off except in T-02 A8.
  - Command: `flatpak-spawn --host /home/fahimfarookme/Documents/projects/jira-governance/repository/code/jira-governance-code-system/apps/ledgerseal/node_modules/.bin/jest -c docs/sdlc/ledgerseal-usp-ux-research-2026-11/evidence/probes/jest.config.js`
  - Result: 3 suites, 16 tests, all pass (the tests record outcomes; they do not assert fixes). Host Node v26.13.0. Time 19.8 s.
  - Part B re-runs the same command with `LS_LABEL=after` to write `results-after*.json`.
  - `git status` after the run: no change under `apps/ledgerseal`. Jest cache is in the probes folder, and no coverage folder was written.

## Round 2: synthesise

- Verdicts H1 to H11, the competitor matrix, the clause map, the USP table and the claims list are in `research-brief.md`.
- UX benchmark, target interactions, baseline numbers and budgets are in `ux-spec.md`.
- New findings from the probes: NF-01 (an issue-type change breaks the seal with no field named), NF-02 (every view writes the property), and NF-03 (the full snapshot and email go to the browser).
- Correction made during synthesis: an early count said 11 of 22 present fields were excluded in T-03. That list included attachments, comments, issue type and project, which are hashed outside `fields`. The correct count is 7 of 22 (status, reporter, resolution and 4 custom fields). Both files were fixed.
- Graders were not run in Part A, because they run jest and tsc inside `apps/ledgerseal` and write `coverage/` there (brief section 14).

## Round 3: refute

One serious attempt per passing or near-passing USP. Searches were run on 2026-11-01.

| USP | Attempt | Result | Verdict change |
|---|---|---|---|
| U1 field diff tied to approval | Search for native Jira approval reset on edit, and for apps that compare approved and current values | Native approvals re-open on status re-entry, not on edit (MP-72). Found Signoff (2 installs, "approval goes stale", side-by-side view, MP-70) and Change Decision Evidence (1 install, "approved and current values side by side", MP-71). Neither states who or when | U1 Gap condition from P to ~. The gap now holds only for "with who and when" |
| U2 separation of duties on reseal | Search for e-signature apps with a different-approver rule after change | eSign: the same user can re-execute; nothing about a different approver (MP-13). JSM excludes listed users at first approval (NJ-15) | No change: gap holds, defensibility fails |
| U3 signed attestation, public key | Search for Jira apps whose approval an auditor verifies with a public key or Ed25519 | None. SealDoc uses HMAC (MP-54). Signoff uses an unnamed "fingerprint" (MP-70) | No change |
| U4 open verifier | Covered by the U3 search and the Vellum listing | Vellum recomputes a history chain, not an approval seal (MP-60) | No change |

Stop rule: in round 3 only U1 condition 1 changed, and no verdict in the hypothesis table changed. No item is still Unknown for a reason that another round of desk research can fix. H3, H8, H9 and the pain condition need buyer interviews. So the research stops after round 3.

## Part A exit checks

- Four output files exist in `docs/sdlc/ledgerseal-usp-ux-research-2026-11/`.
- Every cited source ID resolves to a row in `research-brief.md` section 9 (script check, 0 undefined IDs in the brief and in `ux-spec.md`).
- Every competitor matrix cell holds a source ID, a code reference or the word Unknown.
- `grep -cP '\x{2014}'` returns 0 for each of the four files (recorded at the end of Part A).

## Part B

### Gate and setup
- Owner approval in chat on 2026-11-01: "APPROVED now all". Recorded as the first line of `backlog.md`: B-01 to B-20, with the [MANIFEST], [VAR] and [MIGRATE] flags and the D-1 to D-3 recommendations.
- The main checkout is on another session's branch with its uncommitted work, so Part B uses a separate worktree: `/home/fahimfarookme/Documents/projects/jira-governance/repository/code/jira-governance-code-system`, branch `feature/ledgerseal-research-build` from `master` (`5097bf5`, the audit commit). `apps/ledgerseal/node_modules` there is a symbolic link to the shared folder in the main checkout. No dependency was added.
- The four research files moved from the main checkout into this worktree.

### Baseline (B-00 check)
- `tsc --noEmit -p .`: exit 0.
- `jest --coverage`: 8 of 8 suites, 77 of 77 tests pass. Global: statements 98.01, branches 90.24, functions 100, lines 98.41. Per file branches: `index.ts` 90.9, `canonicalizer.ts` 87.7, `workflow-validator.ts` 90, others 100. `src/frontend/**` is excluded.
- The baseline passes, so no B-00 item is needed.

### Loop 1: spec v2
- `docs/spec/ledgerseal-spec.md` is unchanged (md5 `e022e8e72a5e922808d7dcb1fdad3c17`). v2 is a copy with every change: `docs/spec/ledgerseal-spec-v2.md`.
- D-1 resolved by its approved fallback rule. `GET /rest/api/3/project/{key}/roledetails` requires Administer Jira or Administer projects from the caller (Jira REST v3 OpenAPI text, read 2026-11-01), so an approver cannot read their own role membership. The policy is the `ADMINISTER_PROJECTS` or `ADMINISTER` permission, checked as the user with `mypermissions` (permissions required: none; scope `read:jira-work`).
- Forge facts read for the spec: KVS `keyPolicy: FAIL_IF_EXISTS` and `kvs.transact()` exist in the installed `@forge/kvs` 2.1.1; entity property index types are number, text, string, user and date; trigger events can arrive up to 3 minutes late; UI Kit panel icons may be a resource path (`resource:icons;icon.svg`, as FourRealities does).
- `python3 loop-engine/graders/grade_spec.py apps/ledgerseal`: passed. The grader reads only the v1 file name (`docs/spec/{app}-spec.md`) and checks six section words, so this pass says nothing about v2. Spec v2 records the scope conflict with the v1 claim (section 5) and keeps `write:jira-work`.

### B-01 Approver policy and separation of duties (LS-01, LS-14)
- Tests first: `test/seal-authority.test.ts` (B-01 cases), `test/jira-client.test.ts`, fakes in `test/support/fakes.ts`. First run failed for the right reason: `createJiraClient` and the injected dependency argument did not exist (TS2345, module not found).
- Code:
  - `src/jira/jira-client.ts`: one Jira interface. Reads and the property write run as the app. `hasApproverPermission` runs as the user (`mypermissions`, `ADMINISTER_PROJECTS` or `ADMINISTER`).
  - `src/domain/policy.ts`: `authorsSince`, which fails closed on unreadable times.
  - `src/index.ts`: handlers take `LedgerSealDeps`, and every `NODE_ENV` branch is gone. The issue comes from context only. Errors are typed results: `NO_IDENTITY`, `NOT_APPROVER`, `SELF_APPROVAL`, `JIRA_UNREACHABLE`.
  - `src/frontend/index.tsx`: shows a refused or failed seal.
- Adversarial test: the audit flow.js step 3 scenario (an editor reseals their own change) now returns `SELF_APPROVAL`. The gate stays closed, and nothing is written.
- `index.test.ts` and `edge-cases.test.ts`: the cases that drove the `NODE_ENV`, payload-issue and global-storage paths are replaced by the same behaviour through injected fakes. Domain-level cases are kept.
- Results: `tsc --noEmit` OK. 10 suites, 97 tests pass. Global branches 92.97%. Changed files: `index.ts` 97.36%, `policy.ts` 100%, `jira-client.ts` 100%. graders: `grade_tdd` True (92.97), `grade_security` True, `grade_ui` True. No em dash.
- B-01 commit: `d5075f0`.

### B-02 Tamper record that survives a reseal (LS-02, LS-13 history)
- Tests: `test/seal-history.test.ts` (B-02 and B-03 incident cases), `test/canonical-json.test.ts`, `test/seal-repository.test.ts` (rewritten for v2).
- Test-first record: the service was drafted before the tests. To check the tests honestly, they ran against the B-01 commit in `docs/sdlc/ledgerseal-usp-ux-research-2026-11/evidence/tdd-red/b02/` (a `git archive` copy):
  - With the new imports, the suite failed to compile (`getSealHistory` and `src/domain/history` missing).
  - With those imports stubbed, 10 of 11 cases failed on assertions. The one that passed, "changed back keeps the gate closed", is v1 behaviour that v2 keeps.
- Code:
  - `src/domain/canonical-json.ts`, `src/domain/history.ts` (`buildEntry`, `verifyChain`), `src/domain/seal-record.ts` (`withRecordHash`, `summarise`).
  - `src/service/ledger.ts` (evaluate, `recordIncidentIfNew`, seal, verify, history flows).
  - `src/storage/seal-repository.ts` (v2 keys `ls2:seal`, `ls2:entry` created once, `ls2:snap`; v1 `cert:active` read only).
  - `src/domain/tamper-detector.ts` (`compareToSeal`, `diffSnapshots`, `fromCertificate`), and `src/validator/workflow-validator.ts` (takes `SealedState`).
  - `src/index.ts`: thin handlers, the `seal-history-api` resolver, and KVS `createIfAbsent` and `commit`.
- Adversarial test: the audit flow.js step 4 scenario now leaves `everCompromised: true` and `incidentCount: 1` on the active record after a reseal, and the auditor's view reports both.
- A reseal after an unviewed change first records the incident, then the reseal.
- B-03 note: the rule "one incident per distinct live hash" follows from create-once history entries, so its tests (500 views give 1 incident; a second change gives 1 more) were written and failed first here.
- Results: `tsc` OK. 12 suites, 119 tests pass. Global branches 93.87%. Changed files 92 to 100% (`workflow-validator.ts` 90.90%). Graders all True. No em dash.
- B-02 commit: `0720fab`.

### B-03 A read never writes (LS-06, NF-02, NF-03)
- Tests first: `test/read-no-write.test.ts`. First run: 3 of 3 failed for the right reasons.
  - Unchanged views: expected 0 property writes, received 3.
  - 500 views of one change: expected 1 property write, received 505.
  - Combined fixture response: expected at most 16,384 bytes, received 214,602.
- Code:
  - `src/service/ledger.ts`: the property is written only on seal, reseal and inside `recordIncidentIfNew`, with the real changed-item count. Verify no longer writes, and returns compact diff values.
  - `src/index.ts`: the validator no longer writes the property directly; it records a new incident through the same function.
  - `src/domain/display.ts`: display text, cut at 2,000 characters with a flag.
- Adversarial test: the T-01 tampered-view scenario (500 views) now makes one incident entry, one record update and one property write. The record grows by less than 200 bytes.
- Results: `tsc` OK. 14 suites, 126 tests pass. Global branches 94.21%. `ledger.ts` 98.86%, `display.ts` 100%, `index.ts` 94.73%. Graders all True. No em dash.
- B-03 commit: `31e6b74`.

### B-04 Identity from context only (LS-03, LS-17)
- Tests: `test/identity.test.ts`.
- First run: 2 of 3 passed and 1 failed.
  - The two that passed: a spoofed payload signer is ignored, and the panel gets the account id with no email. B-01 already takes the signer from context, and the B-02 record has no email field, so these had no red phase.
  - The UI test failed for the right reason: the panel printed the account id as text and had no `User` component.
- Code: `src/frontend/index.tsx` shows the signer with the UI Kit `User` component (FG-40), which respects the user's profile privacy.
- Adversarial test: the audit flow.js step 3 spoof (`cfo@victim.example`, "CFO", `cfo-account`) leaves no trace in any stored value.
- Results: `tsc` OK. 15 suites, 129 tests pass. Global branches 94.21% (no `.ts` source file changed). Graders all True.
- B-04 commit: `5a2b798`.

### B-05 Sealed field set chosen by schema type (LS-04, LS-05)
- Tests first: `test/field-selection.test.ts`. First run: compile failures for the right reason (`canonicalizeIssueState` took no field list; no `excluded` on the snapshot).
- Code:
  - `src/domain/canonicalizer.ts`: the 13 hard-coded `customfield_` ids and every value heuristic are removed. Exclusion is by field id for system fields and by `schema.custom` for custom types, each with the reason the panel shows. Reporter, resolution and work log are covered, and users and work-log entries are normalised.
  - `src/jira/jira-client.ts`: `getFields()`, read once per client; a failed read is not cached.
  - `src/service/ledger.ts`: `readLiveSnapshot`, and the record stores `coveredFields` and `excludedFields`. Verify returns both. A field-list failure writes nothing.
- Two v1 canonicalizer tests asserted the removed heuristics (excluding fields by `ongoingCycle`, `approvers`, `pullrequest`, `0|` values). They now assert schema-based exclusion.
- A new sparse-object test found a defect: a component or version with no name was hashed as the text "[object Object]". It is fixed: the name, else the id, else nothing.
- Adversarial test: the audit probe.js blind spots now break the seal (reporter, resolution, work log, `customfield_10001`, `customfield_10050`, text with "pullrequest", an option array with `.state`). Rank, Sprint, SLA, participants, satisfaction, status and Updated do not break it.
- Open: the custom type keys in the exclusion list come from spec v2 and public sources (Reported). The browser extension was not connected in this session, so they are not yet checked against the DEMO `/rest/api/3/field` list. That check is in Loop 3. An unknown custom type stays covered, so a wrong key can only cause a false alarm, never hide a change.
- Results: `tsc` OK. 16 suites, 138 tests pass. Global branches 97.92%. `canonicalizer.ts` 98.94% (baseline 87.7%), `jira-client.ts` 95.65%, `ledger.ts` 97.84%, `index.ts` 94.44%. Graders all True. No em dash.
- B-05 commit: `46fafd3`.

### B-06 Honest results when Jira cannot be read (LS-08, LS-19, LS-15, LS-12)
- Tests first: `test/jira-failure.test.ts`.
  - First run: the comment cases failed to compile (`getComments` missing).
  - The validator and verify cases, run on their own against the B-05 code, failed 3 of 3. The validator returned "must be sealed" and other fields' messages, and verify threw instead of returning a result.
- Code:
  - `src/jira/jira-client.ts`: the issue is read with `fields=*all,-comment`. Comments come from the paged comment endpoint. Work logs come from the paged endpoint when the issue body holds only the first page.
  - `src/service/ledger.ts`: verify returns `{ status: 'ERROR', errorReason: 'JIRA_UNREACHABLE' | 'STORAGE' }` and `MISSING_ISSUE` instead of throwing.
  - `src/index.ts`: when any live read fails, the validator returns the fixed message "LedgerSeal could not read the issue from Jira, so this transition is blocked. Try again in a minute." It writes nothing, and the stub-issue fallback is gone.
  - `src/frontend/index.tsx`: an ERROR state with "Try again". A failed load no longer shows "Issue Not Sealed".
- Retry (AC3) was built and tested in B-01 (`test/jira-client.test.ts`: Retry-After, exponential backoff to 3 retries, 20 s budget).
- An older `index.test.ts` case asserted the throws, and it now asserts the typed results.
- Adversarial test: in the audit flow.js step 6 scenario (Jira down at a transition), the validator now names the real cause, by key and by id, and writes no `SEAL_BROKEN` property.
- Results: `tsc` OK. 17 suites, 145 tests pass. Global branches 97.37%. `jira-client.ts` 92.59%, `ledger.ts` 97.08%, `index.ts` 93.75%. Graders all True. No em dash.
- B-06 commit: `c96da7d`.

### B-07 Declaration text and version (LS-09)
- Tests first: `test/declaration.test.ts`. First run: failed for the right reason (`src/domain/declaration` missing).
- Code:
  - `src/domain/declaration.ts` is the only copy of the declaration (version 1), the meanings (Approved, Reviewed, Verified) and the reason rule (1 to 500 characters).
  - `src/service/ledger.ts` rejects a payload whose declaration text or version differs (`DECLARATION_MISMATCH`), accepts only a listed meaning, and requires a reason to approve changes (`REASON_REQUIRED`). The record stores the declaration text, its version and the reason.
  - `src/frontend/index.tsx`: the form shows the declaration text with its version, an "I agree to the declaration above." checkbox, a meaning choice, and a required reason box when approving changes. The free-text "re-authentication" box is gone.
- Contract change: tests now build payloads with `validSignature()` in `test/support/fakes.ts`. Spec v2 section 7.3 now states the real payload shape, `{ signature: { ... } }`.
- Adversarial test: T-02 A6 (stored text differs from the shown text; any text passes "re-authentication") is closed. The stored text equals the shown text, and the re-authentication field no longer exists.
- Results: `tsc` OK. 18 suites, 151 tests pass. Global branches 97.42%. `declaration.ts` 100%, `ledger.ts` 97.08%. Graders all True. No em dash.
- B-07 commit: `9c76823`.

### B-08 Integrity check on every read (LS-10 part 1)
- Tests first: `test/record-integrity.test.ts`. First run: 3 of 4 failed for the right reason. A record with a rewritten signer, a changed sealed hash, or an edited snapshot part each showed `SEAL_VALID`. The fourth case (an invalid record writes nothing, and an approver can reseal) passed and stays as a guard.
- Code: in `src/service/ledger.ts`, `evaluate` checks `recordHash` on every read and recomputes the snapshot hash from the stored parts. Either mismatch gives `RECORD_INVALID`. The panel shows the integrity message, and the validator blocks with it. A reseal over an invalid record sets `everCompromised: true`, because the stored counts cannot be trusted, and the reseal entry records `previousState: RECORD_INVALID`.
- AC3 ("tamper-evident" wording in the UI and listing) is carried by B-10 and the Loop 3 listing rewrite.
- Limit (unchanged, stated in spec v2 section 8): a writer with app-storage access who recomputes every hash is not detected by this check. B-09 adds a signature on the public property.
- Adversarial test: T-02 A7 (a rewritten signer in KVS) now gives `RECORD_INVALID`, and the forged name is not shown.
- Results: `tsc` OK. 19 suites, 155 tests pass. Global branches 97.42%. `ledger.ts` 97.08%. Graders all True. No em dash.
- B-08 commit: `006bcc8`.

### B-09 Signed attestation in `ledgerseal-cert` (LS-10 part 2, H11) [VAR]
- Tests first: `test/attestation.test.ts`. First run: failed for the right reason (`src/domain/attestation` missing).
- Code:
  - `src/domain/attestation.ts` builds the schema v2 body (audit section 5.1), signs the canonical JSON of every other field with Ed25519 through Node's built-in `crypto` (no npm package), and verifies it against public keys by `keyId`, checking `issueId`.
  - `src/service/ledger.ts` writes the signed attestation on seal, reseal and each new incident. `src/index.ts` reads the signer from `LEDGERSEAL_SIGNING_KEY` and `LEDGERSEAL_KEY_ID` only. With no key, the body is written without `keyId` and `sig`.
- Key handling:
  - A development key pair was generated on the host with Node `crypto` into `~/Documents/projects/jira-governance/.tmp/secrets/ledgerseal-research-keys/` (directory 700, file 600). The private key was never printed.
  - The public key is committed as `apps/ledgerseal/keys/ls-dev-2026-11.pub.pem`, with `keys/README.md`. The Forge variable is set in Loop 3.
  - Tests make their own key at test start. A test fails if any file under `src`, `test`, `keys` or `verifier` holds a private key.
- Contract change: the B-03 test now asserts the v2 fields. `everCompromised` (a string) and `incidentCount` replace the v1 `isCompromised` and `tamperedFieldCount`.
- Adversarial tests: a changed field, a value copied to another issue, an unknown key id, a missing signature, and a FourRealities-style forged v1 body (FR-02 shape) all fail verification.
- Results: `tsc` OK. 20 suites, 162 tests pass. Global branches 97.12%. `attestation.ts` 93.33%, `ledger.ts` 96.22%, `index.ts` 93.75%. Graders all True. No em dash.
- B-09 commit: `1bfd383`.

### B-10 Remove the claims that failed (PX-02)
- Tests first: `test/claims.test.ts`.
  - First run: it failed to compile for the right reason (`SealInfo` had no `revokedAt` for the revoke date).
  - A temporary copy with that field cast failed 5 of 5 on the old code. The scan found banned claims in 13 tracked files (README, `package.json`, `manifest.yml`, `crypto.ts`, `tamper-detector.ts`, `index.tsx`, `workflow-validator.ts` and five test files).
- Scan: every tracked file under `apps/ledgerseal` (except this test, the public key and `package-lock.json`) is checked for "21 CFR", "Part 11", "SOC 2", "ISO 27001", "immutable", "audit ready", "Cloud Fortified", "compliant", "compliance", "cryptographic seal/sign/proof/integrity", "UNTAMPERED", "TAMPER DETECTED" and "re-authorise".
- Code:
  - `src/frontend/index.tsx` uses the texts of `ux-spec.md` section 5, with lozenges SEALED, CHANGED and NOT SEALED, and "Tamper-evident seal" in the seal details. The diff reads "Was: ... Now: ..." instead of an arrow.
  - `src/validator/workflow-validator.ts` uses the spec v2 section 9 messages, names at most five items and counts the rest (`changedItemsMessage`), and gives the revoke date.
  - `manifest.yml`: the title "LedgerSeal" and the plain validator description.
  - `package.json`: the description and keywords (`approval`, `change-control`, `tamper-evidence`).
  - `README.md` is rewritten from the code, with its stated limits and the measured numbers (169 tests in 21 suites, 97.33% branches).
- Test data that carried claim words (an "ISO 27001" declaration fixture, a "compliance" label) was changed. Tests that asserted the old messages now assert the new ones.
- B-08 AC3 ("tamper-evident" in the UI) is met here. The listing is rewritten in Loop 3.
- Results: `tsc` OK. 21 suites, 169 tests pass. Global branches 97.33%. `workflow-validator.ts` 100%, `crypto.ts` 100%, `tamper-detector.ts` 100%. Graders all True. No em dash.
- B-10 commit: `a588148`.

### B-11 Record changes when they happen (LS-16, PX-04 LedgerSeal side) [MANIFEST]
- Tests first: `test/issue-trigger.test.ts`. First run: failed for the right reason (`onIssueChanged` not exported).
- Event payload shapes come from the Forge Jira events reference (read 2026-11-01): issue and comment events carry `issue`, attachment events `attachment.issueId`, work log events `worklog.issueId`. Work log is a covered field, so the trigger also listens to the three work log events.
- Code:
  - `src/service/ledger.ts` `issueChangedFlow` runs the same `recordIncidentIfNew` as the panel and the validator. It never throws, and skips self-generated events and unsealed issues.
  - `src/index.ts` exports `onIssueChanged`.
  - `manifest.yml` adds the `trigger` module `ledgerseal-issue-changed` with 7 events and the function `on-issue-changed`.
- Adversarial test: T-02 A9 (an edit and a revert with no view in between) now leaves the gate closed with the "changed back" message.
- A 100-field change takes well under 2 s in-process (limit 25 s, FG-01).
- PX-04: the property is updated within the event delay, not only when someone opens the panel. CascadePlan's lock badge and its confirm-before-write step stay in the CascadePlan backlog.
- Results: `tsc` OK. 22 suites, 177 tests pass. Global branches 97.39%. `ledger.ts` 96.58%, `index.ts` 93.93%. Graders all True. README numbers updated. No em dash.
- B-11 commit: `bcc3889`.

### Owner question and ADR-01 (Silverston model)
- While the B-12 tests were red, the owner asked why so many tests failed, whether the design was wrong, and whether the model followed Silverston patterns.
  - Answer given: the 7 failures were the intended red phase of B-12.
  - The model had not been checked against Silverston. That was a gap.
- Owner chose to pause and model first ("Ok" to the recommended option), then approved ADR-01 ("approve").
- ADR-01 (`adr-01-silverston-data-model.md`) uses entity and field names from the Apache OFBiz entity definitions, trunk `f1865809` (Silverston-derived; the book itself was not read). It was committed with spec v2 decision D-10 and backlog item B-21 as `f8d8469`.
- The B-12 test file was parked in `~/Documents/projects/jira-governance/.tmp/cache/ledgerseal-research/parked/` during B-21 and restored afterwards.

### B-21 Silverston WorkEffort, Party and Status model (ADR-01, D-10)
- Tests first: `test/silverston-model.test.ts`. First run: failed for the right reason (`src/domain/status` missing).
- Code:
  - `src/domain/status.ts`: the `StatusValidChange` table and the meaning-to-role mapping.
  - `src/domain/models.ts`: `SealedWorkEffort`, `WorkEffortPartyAssignment` and `WorkEffortStatus` replace `SealRecord` and `HistoryEntry`.
  - `src/domain/history.ts`: chained status rows.
  - `src/domain/seal-record.ts`: `LoadedSeal`, integrity bindings and the summary.
  - `src/storage/seal-repository.ts`: `ls3:we`, `ls3:wepa`, `ls3:wes` and `ls3:content`.
  - `src/service/ledger.ts` and `src/index.ts` are moved onto the model. Every state change goes through `canChange`.
- Tests that read storage now use the `model` helpers in `test/support/fakes.ts`. Their behaviour assertions are unchanged. The history `type` values SEALED, INCIDENT and RESEALED are now `transitionName` values SEAL, CHANGE and RESEAL.
- Adversarial test: T-02 A7 now covers a rewritten assignment and a rewritten sealing row as well as a rewritten work effort.
- No migration: the `ls2:` layout was never deployed.
- Results: `tsc` OK. 23 suites, 187 tests pass (every B-01 to B-11 test included). Global branches 96.7%. `status.ts` and `seal-record.ts` 100%, `seal-repository.ts` 94.73%, `history.ts` 94.11%, `ledger.ts` 93.54%, `index.ts` 93.93%. Graders all True. README storage table and numbers updated. No em dash.
- B-21 commit: `a2f2dff`.

### B-12 Change list with who and when (LS-16 UI, G-06, G-07, NF-01)
- Tests: `test/change-list.test.ts`, written before ADR-01.
  - First run, on the B-11 code: 7 of 7 failed for the right reasons.
  - After B-21, with one comment test cleaned up (leftover setup) and a removed-comment case added: 8 of 8 failed on the new model.
- Code:
  - `src/domain/tamper-detector.ts` names changes outside the fields (issue key, project, issue type; NF-01) and lists each added, edited and removed comment as its own row.
  - `src/domain/display.ts` gives a block-level summary of a rich text change ("Paragraph 1 changed. Paragraph 4 added.").
  - `src/service/ledger.ts` flags values over 200 characters, attributes comment rows from the comment's author or editor and time, and fills `changedBy` and `changedAt` on every row from the recorded incident, so later views show the same names when the change log is down.
- AC4 (at most 5 names in the validator message) was built and tested in B-10 (`changedItemsMessage`).
- Contract changes: "Comments / Discussion: n comment(s)" is replaced by per-comment rows, and two older tests now assert the per-comment rows.
- Adversarial test: T-03 C05 (an issue type change with no field named) now names "Issue type", and the validator message says "1 field changed after approval (Issue type)".
- Results: `tsc` OK. 24 suites, 195 tests pass. Global branches 95.85%. `tamper-detector.ts` 100%, `display.ts` 95.83%, `ledger.ts` 91.09%, `index.ts` 93.93%. Graders all True. No em dash.
- B-12 commit: `50eec50`.

### B-13 Canonical form v2 (LS-11, LS-22, NF-01 hash side)
- Tests first: `test/canonical-v2.test.ts` and `apps/ledgerseal/verifier/vectors.json`.
  - The 10 vectors hold canonical texts written by hand from spec v2 section 4, so the tests compare the code with the specification.
  - First run: failed for the right reason (`canonicalFormText` missing).
- Code:
  - `src/domain/canonicalizer.ts`: v2 value rules.
    - Users become `{ accountId }`. Options, components, versions and issue references become `{ id }`, and a cascading option keeps its child.
    - Date-times become UTC. Text keeps its typed spaces, with `\n` line endings.
    - Only set fields are sorted. Links become `{ type, direction, issue }`, time tracking keeps only the original estimate, and work-log entries are normalised.
    - A display text that is not hashed sits next to each value.
  - `src/domain/crypto.ts`: `canonicalForm` and `canonicalFormText`. The hash covers the project and issue type ids and no field names.
  - `src/domain/tamper-detector.ts` shows display text and compares comment bodies as canonical JSON.
  - The service records `canonicalizerVersion: 2.0.0`.
- Defects found by the new tests and fixed:
  - Display text for a set field followed Jira's order, so equal issues gave unequal snapshots. It is now sorted.
  - A link with no other issue was dropped from the hash but still shown. The display now skips it.
- Old tests changed because B-13 replaces the rule they asserted: trimming, whitespace-only strings, sorting every array, user display names in the hash, the v1 link and sub-task shapes, an empty work log as content, and one fixture whose trailing spaces v1 ignored.
- Adversarial tests: T-03 C14 (reordered list), C15 (trailing spaces), C18 (time zone) and C19 (display-name rename) now behave as `shouldBreak` says. Component and custom-field renames keep the seal.
- Spec v2 sections 4.1, 4.3 and 4.6 were updated to the code.
- Results: `tsc` OK. 25 suites, 218 tests pass. Global branches 95.38%. `canonicalizer.ts` 96.95%, `crypto.ts` 100%, `tamper-detector.ts` 100%, `ledger.ts` 91.09%. Graders all True. No em dash.
- B-13 commit: `8798c08`.

### B-14 Evidence export and an open verifier (U4, U5, 11.10(b), AS 1105)
- Tests first: `test/evidence.test.ts`. They run `verifier/verify-evidence.mjs` as its own process, as an auditor would. First run: failed for the right reason (`getSealEvidence` not exported).
- Code:
  - `src/service/ledger.ts` `evidenceFlow` returns `ledgerseal-evidence/1`: a signed attestation of the stored state (`LS_SEALED` gives SEAL_VALID, `LS_CHANGED` gives SEAL_BROKEN, `LS_REVOKED` gives SEAL_REVOKED), the canonical snapshot form that was hashed, every status row, and the steps to verify.
  - `src/index.ts`: the resolver `seal-evidence-api`.
  - `verifier/verify-evidence.mjs` uses only `node:` modules. It checks the snapshot hash, the chain, that the attestation names the newest seal, and the Ed25519 signature, and exits 0, 1 or 2 (usage). `--self-test` checks its canonical JSON against the 10 hand-written vectors.
- Adversarial tests: an export with one changed field value, a rewritten history entry, a forged `everCompromised`, a swapped certificate id, and a wrong public key all fail with exit code 1.
- Deviation from `ux-spec.md` task 6: UI Kit has no file download, so the panel will show the evidence JSON for copying (B-15). PDF stays out of scope (D-7).
- Results: `tsc` OK. 26 suites, 229 tests pass. Global branches 95.31%. `ledger.ts` 91.71%, `index.ts` 91.17%. The verifier is outside `src/`, so it has no coverage number; its behaviour is covered by the 9 process-level tests. Graders all True. README section "Evidence for an auditor" added. No em dash.
- B-14 commit: `f8562b6`.

### B-15 Panel view model and the missing states (LS-12, LS-13 UI, LS-21, PX-03, G-01 to G-13)
- Tests first: `test/view-model.test.ts`. First run: failed for the right reason (`src/frontend/view-model` missing).
- Code:
  - `src/frontend/view-model.ts` is pure, with no React or bridge import. It maps the resolver result to the state, title, lozenge, message lines, actions, ask text and change rows. The states are LOADING, NOT_SEALED, SEALED, CHANGED, CHANGED_BACK, REVOKED, RECORD_INVALID, LEGACY, ERROR and LICENSE_INACTIVE. Times are in the viewer's locale with the zone, and the full hash comes with a short form.
  - `src/service/ledger.ts` adds the viewer's `rights` to the panel response. They come from the approver permission (as the user) and, on a changed issue, from whether the viewer authored a change. Both are reads.
  - `src/frontend/index.tsx` only maps the view model to UI Kit components:
    - the signer, revoker and change authors with `User`;
    - change rows with "Show full value";
    - covered and excluded fields;
    - history from `seal-history-api`;
    - evidence JSON in a `CodeBlock`;
    - one form for seal, approve (with a reason) and revoke.
  - `jest.config.js` covers `src/frontend/view-model.ts` and excludes only `src/frontend/**/*.tsx`.
- No new package was needed: the view model is tested in the existing node environment ([DEP] not triggered).
- `claims.test.ts` and `identity.test.ts` now read the panel text from both UI files.
- Results: `tsc` OK. 27 suites, 247 tests pass. Global branches 94.91%. `view-model.ts` 91.20%, `ledger.ts` 92.39%. Graders all True. No em dash.
- B-15 commit: `1c4b392`.

### B-16 Revoke (LS-13)
- Tests first: `test/revoke.test.ts`. First run: failed for the right reason (`revokeSeal` not exported).
- Code:
  - `src/service/ledger.ts` `revokeFlow`: identity, an approver permission checked as the user, a reason of 1 to 500 characters, and a consistent seal. The change must be allowed by `StatusValidChange`.
  - It writes an `LS_REVOKED` status row (set by the approver, with the reason), ends the current assignment at the revoke time, rebinds the assignment hash in the work effort, and writes a signed SEAL_REVOKED attestation.
  - `src/storage/seal-repository.ts` `saveRevocation` (one transaction). `src/index.ts` adds the `revoke-seal-api` resolver.
- Defect found by the new tests and fixed: a reseal after a revoke overwrote the revoke's end date on the old assignment. A reseal now ends only an assignment that is still open.
- Adversarial test: T-02 A10 (no revoke path) is closed. The resolver is reachable, a non-approver gets `NOT_APPROVER` and writes nothing, and a second revoke is refused by the state table.
- Results: `tsc` OK. 28 suites, 254 tests pass. Global branches 94.64%. `ledger.ts` 91.48%, `index.ts` 91.42%, `seal-repository.ts` 94.73%. Graders all True. No em dash.
- B-16 commit: `f3a1f8a`.

### B-17 Bounded storage and concurrency control (LS-07)
- Tests first: `test/bounded-storage.test.ts`. First run: failed for the right reason (`splitUtf8` and `MAX_PART_BYTES` missing).
- Code:
  - `src/storage/seal-repository.ts`: `splitUtf8` cuts the snapshot into parts of at most 120,000 bytes as stored, never inside a character; `MAX_CONTENT_PARTS` is 22; `removeStatus` is added.
  - `src/service/ledger.ts`: an oversized snapshot fails with `SNAPSHOT_TOO_LARGE` before anything is written. Seal, incident and revoke wrap their transaction in `commitAfterClaim`, which removes the claimed status row if the transaction fails.
- Defects found while writing these tests, and fixed:
  1. A failed transaction after a claimed status row would have left an orphan row, so every later write returned `CONFLICT`. The claimed row is now removed on failure.
  2. The first part-size rule counted raw UTF-8 bytes. KVS stores each part as a JSON string, so escaped quotes made the stored value 125,723 bytes, over the 120 KiB budget. Characters are now counted at their JSON-escaped size.
- Adversarial test: the T-01 / LS-07 combined fixture (400 paragraphs and 100 comments) now stores in several parts, each under 120 KiB, in one transaction of at most 25 operations. Two concurrent seals give one OK and one `CONFLICT` with the reload message.
- Spec v2 section 6 states the stored-size rule and the claim removal.
- Results: `tsc` OK. 29 suites, 260 tests pass. Global branches 94.67%. `seal-repository.ts` 95.45%, `ledger.ts` 91.53%. Graders all True. No em dash.
- B-17 commit: `ec03de7`.

### B-18 JQL for broken and unsealed issues (LS-20 index part) [MANIFEST]
- The manifest keys come from the Forge `jira:entityProperty` page: `entityType` (default issue), `propertyKey`, and `values` with `path`, `type` and `searchAlias`.
- Test first: `test/manifest.test.ts` (B-18 case). First run: 1 of 1 failed (no index). After the change: passed.
- Code: `manifest.yml` adds `jira:entityProperty` `ledgerseal-cert-index`, which indexes `status` (string, `ledgersealStatus`), `everCompromised` (string, `ledgersealEverCompromised`) and `incidentCount` (number, `ledgersealIncidents`). The README gives the JQL and the warning that the property is a searchable summary, not evidence.
- AC2 (the live JQL query on an `[LS-PROBE]` issue) runs in Loop 3.
- Results: `tsc` OK. 30 suites, 261 tests pass. No source branch change. No em dash.
- B-18 commit: `2df67f7`.

### B-19 Marketplace licensing (PX-01) [MANIFEST]
- Tests first: `test/licensing.test.ts`. First run: 3 of 4 failed for the right reasons (no `licensing` in the manifest; resolvers ignored `context.license`). The D-8 case (the validator result does not change on licence alone) passed before and after.
- Code:
  - `manifest.yml` sets `app.licensing.enabled: true` (FG-37).
  - In `src/service/ledger.ts`, `licenseInactive` reads `context.license.active`, and `isActive` as the deprecated fallback (FG-38). A missing licence object counts as active, as in development installs.
  - Verify, seal, revoke, history and evidence return `LICENSE_INACTIVE` and write nothing. The view model shows the B-15 licence state.
- Decision D-8 is kept: the validator does not block on licence, so a lapsed licence cannot stop a customer's releases.
- Results: `tsc` OK. 31 suites, 265 tests pass. Global branches 94.73%. `ledger.ts` 91.91%. Graders all True. No em dash.
- B-19 commit: `4abc72a`.

### B-20 Bundled icon and dead code (LS-20, claim 15) [MANIFEST]
- Tests first: two B-20 cases in `test/manifest.test.ts`. First run: 2 of 2 failed (an `https://raw.githubusercontent.com` icon URL, and an unused `renderIssuePanel`).
- Code:
  - `static/icons/icon.svg` is a simple shield drawn for this app, not copied from any icon set. The manifest uses `icon: resource:icons;icon.svg` with resource `icons` at `static/icons`, the same pattern as FourRealities.
  - `renderIssuePanel` is removed from `src/index.ts`, along with its test.
- Results: `tsc` OK. 31 suites, 266 tests pass. Global branches 94.73%. `index.ts` 91.42%. Graders all True. No em dash.
- B-01 to B-21 are all done. Loop 3 follows.
- B-20 commit: `e9fb5a1`.

### Loop 3, step 1: re-run of the size, time and attack probes
- The Part A probe files are kept, unchanged in logic, in `docs/sdlc/ledgerseal-usp-ux-research-2026-11/evidence/probes/baseline-v1/` with their results (`results-baseline*.json`). The `harness.ts` copy there was restored from this session, because the first rewrite overwrote it.
- The after-build probes call the app's real `createJiraClient` over a mocked REST layer. Results are in `results-after*.json`. All 15 probe cases ran.
- Performance defect found and fixed:
  - Sealing the 400-paragraph fixture took a p95 of 210.7 ms, over the 50 ms budget, because `splitUtf8` called `JSON.stringify` per character.
  - The stored size now comes from the code point, with a test for quotes, control characters, lone surrogates and astral characters.
  - After the fix the p95 is 10.6 ms (desc400) and 16.7 ms (combined).
  - The speed test measures worker CPU time. A wall-clock threshold failed once in two full parallel runs.
- Limits seen in the probes, not hidden:
  - T-03 C02 (status change keeps the seal) is decision D-2 by design.
  - C28 (duplicated label) cannot happen in Jira, which stores labels as a set.
  - T-02 A9 is detected when the issue-updated event arrives. With no event and no panel view between an edit and its revert, the change is not detected.
- Process error, recorded: commit `bf324e5` was made while the coverage run showed 1 failing test. The command chained the commit after the check without stopping on its result.
  - The failing test was a wall-clock and CPU-time threshold on `splitUtf8`. It passed alone, but under coverage instrumentation it took 54 to 61 ms against a 50 ms limit.
  - The follow-up commit replaces it with a deterministic check of the defect's cause: zero `JSON.stringify` calls while splitting. The speed itself is measured where it is fair, by the uninstrumented probe T-01 (p95 10.6 ms for desc400).
  - After the fix: 268 of 268 tests pass in two consecutive coverage runs.

### Loop 3, step 2: lint, deploy and live check on DEMO (12.3, 12.4)
- `forge lint`: "No issues found" on every deploy. Forge CLI 15.0.0 warns: "Unsupported Node.js versions are not guaranteed to work correctly." (host Node v26). The deploys worked.
- Forge variables, development only: `LEDGERSEAL_SIGNING_KEY` (encrypted) and `LEDGERSEAL_KEY_ID=ls-dev-2026-11`. The private key is in `~/Documents/projects/jira-governance/.tmp/secrets/ledgerseal-research-keys/` (mode 600). It was never printed or committed.
- Deploys, development environment only: 3.3.0 (`6f97669`), 3.4.0 (`5ddb3a8`), 3.5.0 (`f4ecb33`), 3.6.0 (`b2688f9`). Log: `~/Documents/projects/jira-governance/.tmp/cache/ledgerseal-research/forge-deploy.log`. The CLI says each version "is eligible for the Runs on Atlassian program". That is eligibility, not the badge.
- No validator was attached to a workflow. No workflow was changed. No other DEMO issue page was opened. No issue was deleted. CascadePlan and the FourRealities "Seal Issue" action were not used on the probe issue.

Live results (Observed-live, asymmsystems.atlassian.net, DEMO-34):
- All 10 custom exclusion type keys exist in `/rest/api/3/field`.
- First view: NOT SEALED, and no property write.
- Seal: a signed v2 property. `verify-property.mjs` checks it with the public key; a changed field fails the check.
- Summary edit: SEAL_BROKEN, incident 1. Label edit with no panel open: incident 2 within 0.7 s, so the issue-update trigger works.
- JQL by `ledgersealStatus`, `ledgersealEverCompromised` and `ledgersealIncidents` finds DEMO-34. DEMO-5, DEMO-20 and DEMO-22 also match, through old unsigned v1 properties.
- The panel shows the SoD sentence "You changed this issue, so another approver must approve it." and change rows with who and when.
- The evidence export passes the open verifier (exit 0): `live/demo-34-evidence.json`.
- `everCompromised` stays true and `incidentCount` carries forward across a revoke and a new seal.

New finding NF-04 (owner decision, not fixed): the computed JSM fields `sd-sentiment`, the forms counts and agent-sessions are covered by the hash. They may change by themselves and give false alarms on service projects. The listing names this in Known limits.

Live defects found and fixed:
1. Revoke reason saved as "e" (`live/demo-34-revoked-reason-defect.jpg`). A controlled `TextArea` lost typed characters over the UI Kit bridge. Fix `5ddb3a8`: an uncontrolled `TextArea` with a `key`; `test/ui-inputs.test.ts` guards the pattern. Live re-test on 3.4.0: the panel shows "Reason: Loop 3 re-test of the revoke reason".
2. SoD bypass through revoke. The editor revoked the seal and then sealed their own change with "Seal this issue". A seal from the revoked state had no SoD check and no reason check. Fix `f4ecb33`: the seal flow checks the change log since the revoked seal's `fromDate` (`SELF_APPROVAL`), and needs a reason when the issue changed (`REASON_REQUIRED`). Four tests in `test/seal-authority.test.ts`; 3 failed before the fix. Spec v2 section 7.2 states the rule. Live re-test on 3.5.0: seal, a label edit by the same account, revoke, then seal gave "You changed this issue, so another approver must approve it." and no write.
3. No reason box after a revoke. With fix 2, a second approver would get `REASON_REQUIRED` with no box to type a reason. Fix `b2688f9`: the view model gives the revoked-state seal action the label "Reason for sealing again (required)", and the panel sends the reason. Test first in `test/view-model.test.ts` (failed, then passed). Live on 3.6.0: the box shows; the form was cancelled with no write. The disabled state of the button is covered by the unit test; the browser tool cannot read it inside the Forge iframe.

Limit kept: T-02 A9. An edit and its revert with no issue update event and no panel view between them are not detected.

Every live write (DEMO-34, issue id 10066, by the owner's account through the panel or REST):

| # | Time (UTC) | Item | Old value | New value |
|---|---|---|---|---|
| 1 | 2026-11-01, before 03:36 | Issue DEMO-34 created | none | summary "[LS-PROBE] LedgerSeal v3.3.0 live check", label `ls-probe` |
| 2 | 03:36:59 | `ledgerseal-cert` property; KVS seal (WorkEffort, assignment, status row 1, content) | absent | SEAL_VALID, certificate 5d5f55ac, incidentCount 0 |
| 3 | 03:37:32 | Summary | "[LS-PROBE] LedgerSeal v3.3.0 live check" | "... (changed after seal)" |
| 4 | 03:37:35 | Property; KVS status row 2 (LS_CHANGED) | SEAL_VALID, incidents 0 | SEAL_BROKEN, everCompromised true, incidents 1 |
| 5 | 03:38:22 | Labels | `ls-probe` | `ls-probe`, `ls-probe-second-change` |
| 6 | 03:38:23 | Property; KVS status row 3 (LS_CHANGED, by the trigger) | SEAL_BROKEN, incidents 1 | SEAL_BROKEN, incidents 2 |
| 7 | after 03:39 | Property; KVS revoke row (reason "e", the defect) | SEAL_BROKEN, incidents 2 | SEAL_REVOKED |
| 8 | 03:46:04 | Property; KVS seal (certificate 2bf0ac7f) | SEAL_REVOKED | SEAL_VALID, everCompromised true, incidents 2 |
| 9 | 03:46:26 | Property; KVS revoke row, reason "Loop 3 re-test of the revoke reason" | SEAL_VALID | SEAL_REVOKED |
| 10 | 03:51:14 | Property; KVS seal (certificate a2e4eb21), no reason | SEAL_REVOKED | SEAL_VALID, incidents 2 |
| 11 | about 03:51:30 | Labels (REST PUT, HTTP 204) | `ls-probe`, `ls-probe-second-change` | plus `ls-probe-sod-revoke` |
| 12 | after 11 | Property; KVS status row (LS_CHANGED, by the trigger) | SEAL_VALID, incidents 2 | SEAL_BROKEN, incidents 3 |
| 13 | 03:52:05 | Property; KVS revoke row, reason "SoD revoke path re-test" | SEAL_BROKEN, incidents 3 | SEAL_REVOKED, incidents 3 |
| 14 | after 13 | Seal attempt by the editor | SEAL_REVOKED | no write (SELF_APPROVAL) |

Final state of DEMO-34: SEAL_REVOKED, everCompromised true, incidentCount 3 (`live/demo-34-property-final.json`). Labels: `ls-probe`, `ls-probe-second-change`, `ls-probe-sod-revoke`.

### Loop 3, step 3: listing (12.5)
- `docs/marketplace/ledgerseal-listing.md` is rewritten from the code. It uses only the U5 parts that are now true, the features verified in tests and on DEMO-34, and the wording in research-brief section 6.3.
- Removed: all three badges, "Immutable", "Cryptographic", "System of Record", the Part 11 signature claim, "no data privacy risks", "0 KB", "OAuth 2.0 (3LO)", "AES-256 / TLS 1.3", "Atlassian Starter Tier" and the unit-economics line (claims 1, 4 to 9, 13 to 17 and 24).
- Added: known limits (approver policy, status, excluded fields, attachment content, T-02 A9, NF-04) and the four real scopes with their use.
- The price tiers are kept as the owner set them. H9 (willingness to pay) stays Unknown.
- Nothing was changed on the Marketplace itself.
- README test numbers: 275 tests in 32 suites, branches 94.90%.

### Owner approval after the final report (2026-11-01)
- NF-04 fixed in `9ba3757`. The seal leaves out Sentiment, the four forms counts and Agent Sessions, by the type keys read again from the live `/rest/api/3/field` on DEMO. The forms list stays covered. Test first in `test/field-selection.test.ts` (failed on the hash, then passed). 276 tests pass. `canonicalizer.ts` branches 96.95%. Deployed to development as 3.7.0.
- No stored DEMO seal held these fields, so no seal broke. Spec v2 section 4.1 now says that after a production install a covered-set change needs a new `canonicalizerVersion` and the old rules kept. That rule is not built.
- Merge: `master` fast-forwarded to the feature branch locally (`5097bf5` to `9ba3757`, then to this commit). The main checkout stays on another session's branch and its files were not touched. No remote exists, so nothing was pushed.
- Not done: the old unsigned v1 properties on DEMO-5, DEMO-20 and DEMO-22 are left as they are. Removing them writes to issues that are not LedgerSeal probe issues.
- Waiting: the validator live test. The DEMO workflow for the probe issue type is shared by two issue types, so a gate there would block other sessions' probe issues.

### Validator live test in project LSP (owner approved a new project, 2026-11-01)
- Project LSP "LedgerSeal Probe" (id 10035): company-managed Kanban software project. Workflow scheme 10036 "LSP: Software Simplified Workflow Scheme" is used by LSP only. Its one workflow, "Software Simplified Workflow for Project LSP", shows "Used in 1 space".
- The LedgerSeal rule "Require Valid LedgerSeal" was added to transition 41 "Done" (any status to Done) only. No DEMO workflow was changed.

Results (Observed-live, LSP-1, version 3.7.0):

| Case | Transition 41 result | Status after |
|---|---|---|
| Not sealed | HTTP 400: "LedgerSeal: this issue is not sealed. Ask a project admin to seal it in the LedgerSeal panel, then try again." | Backlog |
| Sealed, unchanged | HTTP 204 | Done |
| Changed after seal (summary) | HTTP 400: "LedgerSeal: 1 field changed after approval (Summary). Ask a project admin who did not make the change to approve it in the LedgerSeal panel." | In Progress |

New finding NF-05 (owner decision, not fixed): the gated transition itself breaks the seal when it sets a resolution. The Backlog to Done transition set `resolution: null -> Done` (change log, 10:49:50 +0530). Resolution is covered (spec v2 section 4.2), so the trigger recorded incident 1 right after the gate passed. Every issue that passes a gate to a resolving status will show "Changed after approval" and match `ledgersealStatus = SEAL_BROKEN`. Status is excluded for this reason (D-2); resolution is not.

Every write in this test (owner's account):

| # | Time | Item | Old value | New value |
|---|---|---|---|---|
| 1 | 2026-11-01 | Project LSP (id 10035) created, with its scheme 10036 and workflow | none | Kanban template, lead = owner |
| 2 | 2026-11-01 | Workflow "Software Simplified Workflow for Project LSP", transition 41 validators | none | "Require Valid LedgerSeal" |
| 3 | 2026-11-01 | Issue LSP-1 (id 10069) created | none | summary "[LS-PROBE] LedgerSeal validator live check", label `ls-probe` |
| 4 | 05:19:36 UTC | `ledgerseal-cert` property; KVS seal (certificate 069e44a9) | absent | SEAL_VALID |
| 5 | 10:49:50 +0530 | Status, resolution (transition 41) | Backlog, none | Done, Done |
| 6 | after 5 | Property; KVS LS_CHANGED row (trigger, resolution) | SEAL_VALID | SEAL_BROKEN, incidents 1 |
| 7 | 10:49:57 +0530 | Status, resolution (transition 31) | Done, Done | In Progress, none |
| 8 | 10:49:57 +0530 | Summary | "[LS-PROBE] LedgerSeal validator live check" | "... (changed after seal)" |
| 9 | after 8 | Property; KVS LS_CHANGED row (trigger, summary) | SEAL_BROKEN, incidents 1 | SEAL_BROKEN, incidents 2 |
| 10 | after 9 | Transition 41 attempt | In Progress | no change (blocked) |

The project, the validator and LSP-1 stay in place. Whether to remove them is the owner's call.

### NF-05 fixed (owner chose "exclude, like Status", 2026-11-01)
- Fix `100f3e0`: `resolution` and `resolutiondate` are excluded with the reason "The gated transition sets the resolution. The status at seal is recorded." A manual resolution change after approval is no longer flagged; Jira's change log keeps it. Spec v2 section 4.2, the README and the listing say so.
- Test first: the NF-05 case in `test/field-selection.test.ts` failed on the hash, then passed. Two older tests that encoded "resolution is covered" were changed to the new rule. 277 tests pass, branches 94.90%, `canonicalizer.ts` 96.95%. Deployed to development as 3.8.0.
- No stored seal held a resolution (DEMO-34 and LSP-1 were sealed unresolved), so no seal broke.
- Live re-test on a new probe issue, because LSP-1 was broken by the owner's own edit and SoD blocks the owner from resealing it:

| # | Time | Item | Old value | New value |
|---|---|---|---|---|
| 1 | 2026-11-01 | Issue LSP-2 (id 10070) created | none | summary "[LS-PROBE] LedgerSeal resolution re-test (NF-05)", label `ls-probe` |
| 2 | 08:44:35 UTC | `ledgerseal-cert` property; KVS seal (certificate a67afbce) | absent | SEAL_VALID, incidents 0 |
| 3 | after 2 | Status, resolution (transition 41, HTTP 204) | Backlog, none | Done, Done |
| 4 | 8 s after 3 | Property read | SEAL_VALID, incidents 0 | unchanged (no write; `issuedAt` still 08:44:35) |

### Owner instruction "fix all open stuff" (2026-11-01)

**1. Old unsigned v1 properties.** Deleting issues is not done (permanent deletion stays with the owner). Instead the stale property on each issue was marked, keeping the old value on the issue. Old values first saved to `~/Documents/projects/jira-governance/.tmp/cache/ledgerseal-research/live/legacy-v1-properties-before.json`.

| Issues | Item | Old value | New value |
|---|---|---|---|
| TEST-1, DEMO-26, DEMO-22, DEMO-20, DEMO-19, DEMO-17, DEMO-14, DEMO-13, DEMO-11, DEMO-5 (HTTP 200 each) | `ledgerseal-cert` property | unsigned v1 value (SEAL_VALID or SEAL_BROKEN, no `schemaVersion`, no `sig`) | `{status: "LEGACY_UNSIGNED", note, previous: <old value>}` |

After it, `issue.property[ledgerseal-cert].status in ("SEAL_VALID","SEAL_BROKEN","SEAL_REVOKED")` returns only the signed v2 seals LSP-2, LSP-1 and DEMO-34.

**2. Versioned canonical rules** (`504a88e`, development 3.9.0). Rule sets 2.0.0 (original) and 2.1.0 (NF-04 and NF-05). New seals use 2.1.0. A seal is checked with the rules of the version it records; an unknown version gives RECORD_INVALID. 285 tests at that commit.

| # | Time | Item | Old value | New value |
|---|---|---|---|---|
| 1 | 2026-11-01 | Issue LSP-3 (id 10071) created | none | summary "[LS-PROBE] LedgerSeal canonical form 2.1.0 check", label `ls-probe` |
| 2 | about 09:03 UTC | LSP-3 property; KVS seal | absent | SEAL_VALID, canonical form 2.1.0, incidents 0 |
| 3 | after 2 | LSP-3 status, resolution (transition 41, HTTP 204) | Backlog, none | Done, Done |
| 4 | 8 s after 3 | LSP-3 property read | SEAL_VALID, incidents 0 | unchanged |
| 5 | after 4 | LSP-2 panel view (seal records 2.0.0); property and KVS LS_CHANGED row | SEAL_VALID, incidents 0 | SEAL_BROKEN: "Changed after approval", Resolution (empty) to Done. Correct under 2.0.0, where Resolution is covered |

Note: LSP-2 was sealed on 3.8.0, whose rules already left Resolution out while still recording "2.0.0". Its snapshot held no resolution, so the stored hash is the same under both rule sets; only the live resolution change differs.

**3. Approver groups** (`505cf45`, development 3.10.0). Spec v2 section 7.1. Tests first in `test/approver-policy.test.ts`, `test/admin-view-model.test.ts`, the manifest and view-model tests (red: suites did not compile, then 2 manifest and 1 view-model case failed). 306 tests in 35 suites pass, branches 95.29%; every changed file at 90% or more. `forge lint` clean. Install `b8f7e832` stayed "Up-to-date" (no new scope).

Live (admin page "LedgerSeal approvers" under Jira admin settings, Apps):

| # | Item | Old value | New value |
|---|---|---|---|
| 1 | Page load as the owner (Jira admin) | n/a | READY, "No approver groups." |
| 2 | Search "jira-admins" (`/groups/picker`, as user) | n/a | found `jira-admins-asymmsystems` |
| 3 | KVS `ls3:partyrole:LS_APPROVER` (Save; name resolved by `/group/bulk`) | absent | parties: `jira-admins-asymmsystems` |
| 4 | LSP-3 panel text (read) | n/a | "Who can seal: project admins, Jira admins and members of jira-admins-asymmsystems." |
| 5 | KVS `ls3:partyrole:LS_APPROVER` (Remove, Save) | parties: `jira-admins-asymmsystems` | parties: [] (restored; "Who can seal: project admins and Jira admins.") |

Not tested live: a seal by a non-admin group member, because the site has one human account. The unit tests cover it.

Also: the gate `tools/check.sh` now runs jest with `-w 2`; one full run was killed (exit 137) with the default worker count.

**4. Canonical In-Jira UI shared package adoption** (development 3.14.0).
- Adopted canonical `@asymm/jira-ui` package located at `packages/asymm-jira-ui` across LedgerSeal.
- Removed local duplicate `apps/ledgerseal/src/brand/` directory and test `test/brand/brand.test.ts`.
- Configured path mapping in `apps/ledgerseal/tsconfig.json` (`baseUrl: "."`, `paths` mapping `@asymm/jira-ui`) and removed `rootDir: "./src"` to allow compilation of monorepo package sources.
- Annotated child and index parameters in `packages/asymm-jira-ui/src/layout.tsx` grid components with explicit `React.ReactNode` and `number` types to satisfy strict TypeScript checking.
- Updated `apps/ledgerseal/src/frontend/index.tsx` to import directly from `@asymm/jira-ui`, displaying `title="LedgerSeal"` in `PanelHeader` and `<Section title="Certificate & attestation details" count={3} defaultCollapsed={true}>`.
- Updated `apps/ledgerseal/src/frontend/admin.tsx` to import `SPACE` and `TEXT_ROLE` from `@asymm/jira-ui` and eliminated all raw Atlassian tokens.
- Created `apps/ledgerseal/test/architecture.test.ts` verifying that no source file in LedgerSeal uses raw Atlassian tokens or hex colors outside `@asymm/jira-ui`, no local `src/brand` exists, and `TextArea` preserves uncontrolled input rules without a `value` prop.
- Added `@asymm/jira-ui` symlink in `apps/ledgerseal/node_modules/@asymm/jira-ui` so Forge CLI's native Webpack bundler resolves the shared package without modifying dependencies or running `npm install`.
- Verification results:
  - `tsc --noEmit -p .`: OK (0 errors).
  - Test suite: 36 passed, 36 total suites; 314 passed, 314 total tests; 95.54% branch coverage (all files >= 90%).
  - Em dash scan: 0 em dashes across all changed and untracked files.
  - Architecture test: passed 5 of 5 checks.
  - Graders (`tools/graders.sh`): `grade_tdd True 95.54`, `grade_security True`, `grade_ui True`.
  - Forge lint: 0 issues found.
  - Deployed to development as version 3.14.0; installation `b8f7e832` remains Up-to-date.

**5. Uniform Permission Management Standard adoption** (development 3.15.0).
- Standardized authorization and admin surface to comply with Asymm Systems Uniform Permission Management Standard (`docs/design/uniform-permission-management-standard.md`).
- Added canonical `AdminPolicyPanel` component and view model functions in `packages/asymm-jira-ui/src/admin.tsx` and exported via `packages/asymm-jira-ui/src/index.ts`.
- Replaced custom admin page UI in `apps/ledgerseal/src/frontend/admin.tsx` with canonical `AdminPolicyPanel` from `@asymm/jira-ui`.
- Updated unauthorized contextual in-app guidance in `apps/ledgerseal/src/frontend/view-model.ts` to standard text: "Requires Project Admin, Jira Admin, or membership in an authorized group. Configured by your Jira administrator in Jira Settings > Apps > LedgerSeal."
- Updated test assertions in `apps/ledgerseal/test/view-model.test.ts`.
- Deployed to development as version 3.15.0 (installation `b8f7e832` Up-to-date). All 314 tests pass, 95.54% branch coverage, 0 em dashes, graders all True.

**6. In-Jira UI library alignment refinements** (development 3.16.0).
- Configured `moduleNameMapper` and `moduleDirectories` in `apps/ledgerseal/jest.config.js` pointing `@asymm/jira-ui` to canonical monorepo source (Section 3.D).
- Standardized revoke button in issue panel action row to compact spacing (`appearance="default" spacing="compact"`).
- Added typography alignment rule test in `test/architecture.test.ts` verifying all UI Text elements specify `as="span"`.
- Deployed to development as version 3.16.0 (installation `b8f7e832` Up-to-date). All 315 tests pass across 36 suites, 95.54% branch coverage, 0 em dashes, graders all True.
