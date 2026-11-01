# LedgerSeal research and build: round log

One entry per research round and per build item. Dates are 2026-11-01 unless stated.

## Setup checks (Part A)

- `git -C gemini-earning status -s`: no change under `apps/ledgerseal`. Uncommitted changes exist under `apps/planshift` and `loop-engine/agents/` (not made by this research, not touched).
- Repo HEAD `423b9b2`, branch `feature/cascadeplan-research-build` (another session's branch). Part A did not switch branches and made no commit.
- md5 of every LedgerSeal file in the audit snapshot equals the current file (manifest, package, tsconfig, jest config, all `src/` and `test/` files, README, spec, listing). Every LS finding is therefore unchanged at its cited lines.
- `loop-engine/runs/ledgerseal_state.json` says `ALL_LOOPS_COMPLETE` with grade_tdd score 93.26. The graders check section keywords, the presence of two scope strings, banned import names, and global branch coverage (`loop-engine/graders/*.py`). None of them checks permissions, identity, storage growth or claims. A grader pass is not evidence for any verdict in this research.

## Round 1: collect

- Three research agents, run in parallel, each writing one evidence file in `~/.cache/gemini-earning-ledgerseal-research/sources/`:
  - `reg-sources.md`: 109 items (REG-01 to REG-109). The Part 11 text comes from the eCFR API (current to 2026-10-29). The FDA guidance, NIST, PIC/S and EU draft Annex 11 PDFs were extracted verbatim.
  - `native-forge-sources.md`: 107 items (NJ-01 to NJ-45, JAC-01 to JAC-20, FG-01 to FG-42). Ticket votes come from the public jira.atlassian.com API.
  - `marketplace-sources.md`: 15 apps, MP-01 to MP-69. Installs, prices and reviews come from the public Marketplace REST API.
- Rule incidents, recorded:
  - The Marketplace agent opened one third-party vendor page on `werkstack.atlassian.net` by mistake, and a second fetch to `polscheit.atlassian.net` returned a redirect only. No content from either is used.
  - The owner's site (`asymmsystems.atlassian.net`) was not contacted by any agent or probe.
- Probes (T-01 to T-03), written in `~/.cache/gemini-earning-ledgerseal-research/probes/`. They import `apps/ledgerseal/src` read-only, mock `@forge/api` (separate `asApp` and `asUser` entries) and `@forge/kvs`, and run with `NODE_ENV=production`, so the LS-14 bypasses are off except in T-02 A8.
  - Command: `flatpak-spawn --host /home/fahimfarookme/Documents/projects/gemini-earning/apps/ledgerseal/node_modules/.bin/jest -c ~/.cache/gemini-earning-ledgerseal-research/probes/jest.config.js`
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
- The main checkout is on another session's branch with its uncommitted work, so Part B uses a separate worktree: `/home/fahimfarookme/Documents/projects/gemini-earning-ls-build`, branch `feature/ledgerseal-research-build` from `master` (`5097bf5`, the audit commit). `apps/ledgerseal/node_modules` there is a symbolic link to the shared folder in the main checkout. No dependency was added.
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
- Test-first record: the service was drafted before the tests. To check the tests honestly, they ran against the B-01 commit in `~/.cache/gemini-earning-ledgerseal-research/tdd-red/b02/` (a `git archive` copy):
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
