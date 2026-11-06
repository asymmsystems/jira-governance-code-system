# DefinitionGuard research and build: round log

One entry per research round and per build item. Dates are local (UTC+5:30).

## Round 0: setup (2026-11-01)

- **Repo state.** Branch `feature/cascadeplan-research-build`, HEAD `b094ed8`. `git status -s` shows uncommitted changes only under `apps/planshift` and new untracked files in `loop-engine/agents/`. `apps/definitionguard` has no uncommitted change. Part A made no change under `apps/`.
- **md5 check.** All 17 files in appendix section 1.1 that sit under `apps/definitionguard` (manifest, package, tsconfig, jest config, README, 7 source files, 5 test files) match the appendix. Every DG finding is still open at its audit line.
- **Read in full:** the DefinitionGuard appendix; the portfolio audit (all sections, including 1, 2.2, 3.1, 4.4, 5, 5.2, 5.5, 6, 7); the spec; the listing; the README; all 7 source files; `manifest.yml`, `package.json`, `jest.config.js`, `tsconfig.json`; `test/index.test.ts` (mocks and test list) and the 4 other test files by test names; `loop-engine/README.md`; `spec_architect.md`, `tdd_engineer.md`, `adversary_grader.md`; all 5 graders; the audit probe script `docs/sdlc/portfolio-audit-2026-10-31/evidence/definitionguard-scratch/probe.js`.
- **Scratch location:** `~/Documents/projects/jira-governance/.tmp/cache/definitionguard-research/` (`sources/`, `harness/`, `merge_sources.py`, `merged-sources.md`, `brief-body.md`).
- **Tools:** host node v26.13.0, Jest 29.7.0 and tsc 5.9.3 through `flatpak-spawn --host`. The browser was the owner's logged-in Chrome session, used for REST GET only.

## Round 1: collect and synthesise (2026-11-01)

### Collect
- Two research subagents ran in parallel, with WebSearch and WebFetch only. They used no sign-up, no credentials and no email address.
  - Marketplace checklist apps: sources M-01 to M-142 in `sources/marketplace-competitors.md`. Install counts and prices come from the Marketplace REST API v2.
  - Native Jira, JMWE, ScriptRunner, suggestion tickets, audit frameworks and Forge limits: sources N-01 to N-64 in `sources/native-forge-audit.md`. N-50 was reserved and is unused.
- Blocked sources: G2 returned HTTP 403, and no Capterra listing was found. The AICPA TSC PDF needs registration and was excluded (N-60); a secondary source was used (N-57). The ISO/IEC 27001 text was not available (N-58, N-59).

### Observed-test and Observed-live evidence produced in this round
| ID | What | Result | Where |
|---|---|---|---|
| T-01 to T-13 | Jest harness on the app source in place, mocked `asApp()` and `asUser()` apart | 16 of 16 tests pass. Sizes, calls and validator behaviour are in `ux-spec.md` section 3 and `research-brief.md` section 7 | `harness/scale.harness.ts`, `harness/results/baseline.json` |
| Harness fix | The first run measured the 240 KiB crossing only after 1,000 toggles and reported 1,001 | Corrected to check after every toggle. Result for 6 items: 817 (audit probe 16 gave 814) | same |
| L-01 to L-06 | Live REST GET on workflows, projects and two issue properties | No workflow has the DefinitionGuard validator. A third project, AUDT, exists. Forged property on DEMO-26 still present. 8 DONE-category transitions on DEMO | `sources/live-observations.md` |

No live write was made. No DefinitionGuard or LedgerSeal panel was opened.

### Synthesise
- Verdicts H1 to H9 and H10 to H13: `research-brief.md` section 3.
- USP table U1 to U4: `research-brief.md` section 4.
- Benchmark, targets and budgets: `ux-spec.md`.
- Backlog B-01 to B-20: `backlog.md`.

## Round 2: refute and revise (2026-11-01)

- **Refute searches:** required evidence on checklist items; separation of duties in checklist and approval apps; DoD sign-off apps with audit export.
- **Found:**
  - Approval and sign-off apps that claim transition-level separation of duties and SOC 2 export, all with 1 to 302 installs (R-01, R-02, R-04).
  - A Forge "Definition of Done & Ready" app with 4 installs that blocks transitions (R-03).
  - Library code: KVS conditional writes exist only for Custom Entities (R-05), which corrects the "no compare-and-set" inference in N-14. UI Kit exports `User` (R-06).
- **Verdict changes:**
  - U2 Pain moved from Met to Partly. U2 Gap stands for item-level control.
  - H7 moved to Partly true, because approval apps cover part of the need.
  - No other verdict changed.
- **Stop:** round 3 was not run. The open items (H12 team-managed, H13 validator throw) need a live test, not more search. Brief section 5 allows stopping when no further verdict can change by research.

## Exit check (Part A, section 7 of the brief)

- The four files exist: `research-brief.md`, `ux-spec.md`, `backlog.md`, `round-log.md`.
- Every competitor matrix cell has a source ID, an Observed-code or Observed-live reference, or the word Unknown.
- H1 to H13 each have a verdict.
- `grep -cP '\x{2014}'` returns 0 for each of the four files (2026-11-01). A script check of the matrix found 19 rows and 0 empty cells. `git status -s apps/definitionguard` is empty.

## Part B setup (2026-11-01)

- **Approval:** owner, in chat: "APPROVED now all". Recorded on line 1 of `backlog.md` as B-01..B-20 with every flag. B-03 uses option A, the recommendation, because the owner did not pick one.
- **Branch and worktree:** `feature/definitionguard-research-build` from `master` (`5097bf5`), in the worktree `/home/fahimfarookme/Documents/projects/jira-governance/repository/code/jira-governance-code-system`. The main tree was on `feature/cascadeplan-research-build` with another session's untracked files, so a worktree keeps both apart, as the FourRealities and LedgerSeal sessions do. `node_modules` is a link to the shared `apps/ledgerseal/node_modules`; no dependency was installed.
- **9.1:** `apps/definitionguard` had no uncommitted change.
- **9.3 baseline (master):** `tsc --noEmit` exit 0. Jest 59 of 59 pass. Coverage 99.68 / 90.36 / 100 / 99.65; `src/index.ts` branch 88.28%. Same as the audit. No B-00 needed.
- **Loop 1:** `docs/spec/definitionguard-spec-v2.md`. `grade_spec.py` passes, but it reads the v1 spec file, not v2; v2 also has every section the grader looks for.
- **Check script:** `docs/sdlc/definitionguard-usp-ux-research-2026-11/evidence/check_item.sh` runs section 11.2 for each item: tsc, Jest with coverage, 90% branch on each changed source file, `grade_tdd`, `grade_security`, `grade_ui`, and an em dash scan.

## Build items

| Item | Commit | Tests added or changed | Result | Notes and deviations |
|---|---|---|---|---|
| B-01 | `ebd5832` | `test/validator/validate-transition.test.ts` (11), `test/helpers/forge-mocks.ts`; 2 old tests now assert the numeric-id rule | 73 pass; `index.ts` 91.26% | 5 tests red first for the right reason. Harness T-06: throw became `result: false` |
| B-02 | `c81edd1` | `test/security/permissions.test.ts` (10); old suite gets a separate `asUser` double | 82 pass | One new test first passed for the wrong reason (no storage provider); fixed before the code |
| B-03 | `8c6179d` | `test/storage/checklist-store.test.ts` (10), `test/domain/event-log.test.ts`, `test/resolvers/panel-resolvers.test.ts`; `test/index.test.ts` replaced | 90 pass | The old suite tested removed v1 behaviour (payload issue ids, name rewrites, notes, payload template id). Harness P14: 2 of 2 ticks kept |
| B-04 | `fd73621` | `test/storage/size-budget.test.ts` (7) | 98 pass | Budget corrected in spec v2 and ux-spec: change events 2 KiB; events that carry the item list 32 KiB. Three tests that read the trail from the panel response moved to `getHistory` |
| B-05 | `4aabbff` | `test/domain/chain-verify.test.ts` (14) | 112 pass | |
| B-06 | `27896d4` | `test/settings/project-templates.test.ts` (33), `test/ui/template-editor.test.ts` (5) | 155 pass | `[SCOPE]` `jira:projectSettingsPage`. Storage resolution moved to `src/storage/forge-storage.ts`. `forge lint`: no issues |
| B-07 | `3d9213d` | `test/ui/attribution.test.ts` (6) | 160 pass | `[SCOPE]` `read:jira-user` removed. `forge lint`: the scope change makes the next deploy a major version |
| B-09 | `e63c892` | `test/security/licence.test.ts` (6) | 166 pass | `[SCOPE]` licensing. The tests were written first, but in the same step as the code, so they were not run red first |
| B-10 | `1d0e1aa` | `test/validator/gate-rule.test.ts` (24) | 187 pass | The block message now follows spec v2; 3 tests that matched the old phrase changed. The status reader treats a non-list answer as empty |
| B-11 | `790450c` | `test/resolvers/evidence.test.ts` (16) | 203 pass | Spec v2 decision D-13: evidence on the event, a flag in the state, loaded on request |
| B-12 | `eb96f24` | `test/resolvers/roles-waivers.test.ts` (11) | 214 pass | Deviation from the backlog wording: a per-item "required role" is a Jira permission key (spec v2 D-03), so one call as the user can check it |
| B-13 | `eab59fc` | `test/ui/panel-view-model.test.ts` (13) | 226 pass | `index.tsx` renders the view model only; the settings page also uses the safe error text |
| B-14 | `612a7b8` | `test/integrity/attestation.test.ts` (11) | 235 pass | `[ENV]` key not yet set: generated and set at deploy time |
| B-15 | `3161643` | `test/resolvers/export.test.ts` (8) | 242 pass | UI Kit has no file download, so the export is copyable JSON in a `CodeBlock` (criterion 4, to confirm live) |
| B-21 | `15b0950` | `test/domain/event-log.test.ts` rewritten (25); raw-record tests ported to v3 rows; a resolver refusal test | 254 pass; every changed file at or above 90% branch | See "Owner review and B-21" below |
| B-16 | `7948031` | `test/settings/resync.test.ts` (9) | 264 pass | Re-sync pages 25 issues per call (JQL, nextPageToken); a removed criterion's breakdown link is ended with thruDate, never deleted |
| B-17 | `927bbeb` | `test/settings/coverage.test.ts` (10) | 274 pass | `[SCOPE]` only `read:workflow:jira` (read only), not `manage:jira-configuration` and not `read:workflow-scheme:jira` as spec v2 D-10 expected: `workflows/search?projectId=` alone returns the project's workflows (live GET on DEMO, L-07: 3 workflows). The validator rule shape in that response is Inferred until a workflow carries it |
| B-18 | `1b0d022` | `test/jira/jira-client.test.ts` (8) | 282 pass | A source-scan test fails if a Jira read bypasses the retry helper |
| B-19 | `3ad0509` | `test/hygiene.test.ts` (15), v1 engine edge cases; transition-validator and repository tests removed with their modules | 291 pass | `[DEP]` `@forge/storage` removed from package.json, no npm install. `[SCOPE]` bundled icon. The new per-file threshold caught the v1 engine at 86.53% branch; edge-case tests added |
| B-20 | `14a0b77` | `test/manifest.test.ts` (2) | 293 pass | The first red run failed for the wrong reason (a slice bug in the test); fixed. Red for the real criterion confirmed by inspection: the committed manifest had no projectTypes. Not testable live: the site has no team-managed project (L-02) |
| B-08 | `754f5ec` | `test/listing.test.ts` (6) | 299 pass | Written after the build, before the live checks; the listing claims only what passed 4.5 and 11.2. The "no marketing words" test caught the word "compliant" in a disclaimer; reworded |

Every item: `tsc` exit 0, Jest all pass, 90% branch or more on each changed source file, the three graders pass, and no em dash in a changed file.

## Owner review and B-21 (2026-11-01)

- **Question from the owner:** why so many failing tests, and does the model follow the Silverston patterns?
- **Answer given:** the failures were red-first tests, old tests of removed behaviour, churn when a later item changed an earlier contract, my own test mistakes, and a few real defects. None showed a wrong gate rule. The churn came from not freezing the panel response contract in spec v2. The model did not follow Silverston; only CascadePlan had that decision.
- **Owner decision "C":** restructure before B-16. Sources: the Apache OFBiz entity models (S-01 to S-05 in spec v3), because OFBiz states that its data model comes from Silverston's books. The books themselves were not read.
- **Spec v3** (`54e5b5d`), approved by the owner with option A: a criterion is a child WorkEffort with WorkEffortStatus history. B-21 added to the backlog.
- **B-21** (`15b0950`): the panel response, resolver payloads, settings payload, property schema and validator messages were frozen, and the UI, view-model, validator and licence test files did not change (git diff empty).
- **Harness after B-21** (`results/after-B-21.json`, 16 of 16): the largest value is 3,766 / 10,662 / 25,458 bytes at 6 / 20 / 50 items, at any toggle count. A panel load makes 2 KVS reads, no Jira call and no write. A toggle makes 2 Jira calls. Both concurrent ticks are kept. The panel and the validator agree on zero mandatory items.
- **Harness changes:** the harness now reads v2 and v3 records, records the B-10 behaviour change instead of asserting the baseline, and uses round-based toggles, because v3 refuses a repeated status.

## Loop 3 (2026-11-01)

1. **12.1 Benchmark and scale:** `ux-spec.md` sections 1 and 3 have the After column (`fb99be3`). Harness `results/after-all.json`: 16 of 16 pass.
2. **12.2 `forge lint`:** 0 errors, 0 warnings, 1 approval: "This deployment triggers a major version upgrade ... because: Change due to scope modification". Expected: the scopes changed under the approved `[SCOPE]` flags.
3. **`[ENV]` signing key:** an Ed25519 key pair was generated on the host. The private key went straight into the encrypted Forge variable `DG_SIGNING_KEY` in the development environment and was never written to disk or printed. `DG_SIGNING_KEY_ID` = `dg-dev-2026-11`. The public key is `docs/marketplace/definitionguard-public-key.pem` (`754f5ec`).
4. **12.3 `forge deploy -e development`:** the first run stopped: "The deploy failed due to 1 approval requested. Run forge deploy --approve MAJOR_VERSION_RULE". The second run with `--approve MAJOR_VERSION_RULE`: "Deployed DefinitionGuard to the development environment with 1 approval acknowledged." Version 4.0.0. Forge: "We've detected new scopes or egress URLs in your app. Run forge install --upgrade". Forge also reports that version 4.0.0 "is eligible for the Runs on Atlassian program".
5. **Installation upgrade:** owner, in chat: "Approved." `forge install --upgrade -e development --site asymmsystems.atlassian.net --product jira` output: "Your app will be upgraded with the following additional scopes: - read:workflow:jira", "Upgrade complete!". `forge install list`: version 4, "Up-to-date".
6. **Live defect found and fixed:** on DEMO-35 the evidence link field kept only its last typed character. A controlled UI Kit Textfield loses keystrokes, because each key makes a round trip through the bridge. Fixed in `bb9e96d` (uncontrolled fields, plus a guard test), redeployed to development with no scope change. Re-tested live: the full link and note were kept.
7. **12.4 live checks (2026-11-01, DEMO), version 4:**

| Check | Result |
|---|---|
| Panel on a new issue | Renders the v4 panel: "Definition of Done incomplete", names the 5 open mandatory items, says the gate applies where an admin added the validator, red "Blocked" lozenge, "0 of 6 done", accessible names such as "(mandatory, open)" |
| Panel load writes nothing | After the first load, DEMO-35 had no `definitionguard-dod` property |
| Tick with evidence | Item ticked; "Evidence attached"; "Completed by" rendered by the UI Kit User component; local time "Nov 1, 2026, 10:41 AM"; "Show evidence" shows the link and the note |
| Waive with a reason | Item waived; "Waived" lozenge; "Waived by" with user and time; status lists the 3 remaining open items |
| History | "History checked: 3 events, chain intact." with the limit note; one row per change with the evidence link |
| Export | JSON shown in a CodeBlock to copy (B-15 criterion 4: UI Kit has no download); Silverston-shaped rows (WorkEffort ISSUE, WorkEffortAssoc, WorkEffortStatus, Content) |
| Signed property | `definitionguard-dod` schema v2, stateVersion 3, mandatoryCompleted 2, keyId `dg-dev-2026-11`. An independent script (`docs/sdlc/definitionguard-usp-ux-research-2026-11/evidence/live/verify.js`) verifies the signature with `docs/marketplace/definitionguard-public-key.pem`: true; a copy with isFullySatisfied changed: false |
| Settings page, view only | Lists DEMO's Done-category statuses (Closed, Resolved, Canceled, Done). Coverage: "0 of 8 completion transitions are gated", listing all 8 (matches L-06). Read with the new `read:workflow:jira` scope as the app. Nothing saved |
| Gate (validator) on a real transition | Owner decision "A" (in chat): I add the validator, test, then remove it; this overrides the brief's "do not change any workflow" for this one test. With DefinitionGuard DoD Enforcement on DEMO "Mark as done": POST transition 61 on DEMO-35 returned 400 "Definition of Done is not complete. Open mandatory items: Peer code review approved by authorized reviewers; Static analysis and dependency vulnerability scan clear; Compliance and regulatory sign-off criteria satisfied. Open the DefinitionGuard panel on this issue to finish them."; the issue stayed Open. The waived item and the evidence item counted as done. After ticking the 3 items in the panel (the optional item left open), the panel said "Definition of Done satisfied" and the same POST returned 204; status Done; property isFullySatisfied true, stateVersion 6 |
| Validator rule shape | Jira stores the function validator as `ruleKey: forge:expression-validator` with the module key in `parameters.key`. The coverage matcher (module key) finds it; the test fixture now uses this exact shape |
| DG-08 on a live throw | Not tested: the validator now catches every error (unit-tested); a live throw would need a deliberately broken build |
| Keyboard and screen reader (task 9) | Not tested live. Accessible names are set and unit-tested |
| Team-managed (B-20) | Not testable: the site has no team-managed project |

8. **Live writes (all on the probe issue DEMO-35, id 10067, label `dg-probe`):**

| # | Write | Old value | New value |
|---|---|---|---|
| 1 | Issue created (REST POST as the owner's browser session) | none | DEMO-35, Task, summary "[DG-PROBE] DefinitionGuard 4.0.0 live check 1", label `dg-probe`, status Open |
| 2 | Issue properties added by Jira when the panel was added from the issue-view button (platform, not app code) | none | `ari:cloud:ecosystem::extension/73e4f63d.../static/definitionguard-issue-panel`, `issue.content.panel.customised.flag` |
| 3 | Tick "Automated test suite passes with zero regressions" with evidence | criterion DOD_OPEN; no app storage for 10067; no property | KVS `dg:evt:10067:00000001` (Create), `:00000002` (Complete with Content), `dg:state:10067`; property `definitionguard-dod` v2 stateVersion 2 |
| 4 | Waive "Branch test coverage meets or exceeds policy threshold" with reason "DG-PROBE live check: coverage gate not used on this probe." | criterion DOD_OPEN | KVS `dg:evt:10067:00000003` (Waive), `dg:state:10067`; property stateVersion 3 |

| 5 | Workflow "DEMO: Jira Service Management default workflow", transition "Mark as done" (61): added validator DefinitionGuard DoD Enforcement (owner decision A) | version 8, no Forge validator | version 9, validator present |
| 6 | Tick "Peer code review approved by authorized reviewers" on DEMO-35 | DOD_OPEN | DOD_DONE (entry 4) |
| 7 | Tick "Static analysis and dependency vulnerability scan clear" on DEMO-35 | DOD_OPEN | DOD_DONE (entry 5) |
| 8 | Tick "Compliance and regulatory sign-off criteria satisfied" on DEMO-35 | DOD_OPEN | DOD_DONE (entry 6); property stateVersion 6, isFullySatisfied true |
| 9 | Transition DEMO-35 "Mark as done" | first attempt blocked (400, no change); then Open | Done |
| 10 | Workflow: removed the DefinitionGuard validator from "Mark as done" (owner decision A) | version 9, validator present | version 10, no Forge validator (checked by GET) |

No other issue, workflow, template or project setting was changed. No LedgerSeal panel was opened. Nothing was deleted. DEMO-35 stays as a closed probe issue with the label `dg-probe`.

## Continuation (2026-11-01)

- **Handover takeover:** created branch `feature/definitionguard-completion` from `master`. Tag `definitionguard-handover-2026-11-01` and branch `snapshot/definitionguard-handover-2026-11-01` untouched. All baseline checks passed (300 tests, 96.08% branch coverage, 0 em dashes, graders passed, harness 16 of 16 passed).
- **History stream styling and alignment (B-13, B-15):** removed bullet points from `<List>` in `src/frontend/index.tsx`. Replaced with structured `<Stack>` matching native Jira activity styling. Formatted row with acting user avatar and name first, followed by action and timestamp. Indented waiver reason and evidence link and note underneath. Tests added in `test/resolvers/export.test.ts` for structured `actionText` and `reason` fields. Deployed version 4.2.0 to development environment.
- **Panel title generic naming (owner decision A):** changed issue panel title from "DefinitionGuard Checklist" to "Definition of Done" in `manifest.yml`. Test added in `test/manifest.test.ts`. Deployed version 4.3.0 to development environment.
- **Checklist and history alignment (B-13, B-15):** cleaned checkbox label text by passing `label={item.title}` and `name={item.label}` in `src/frontend/index.tsx`, removing redundant parenthesized state tags next to lozenges. Aligned attribution, action buttons, and input forms to `space.300` (24px) to match checkbox text offset. Added compact spacing on action buttons. Added structured `eventType`, `actionVerb`, and `itemTitle` fields on `HistoryRow` in `src/ui/panel-view-model.ts` with tests in `test/resolvers/export.test.ts`. Restyled history rows into a native Jira activity pattern with user and timestamp on the top line, and indented status lozenges and details below. Deployed version 4.4.0 to development environment.
- **Heading size and inline attribution alignment (B-13):** changed headings for Checklist items and History from h4 to h5 in `src/frontend/index.tsx`. Set `as="span"` on inline `<Text>` elements to eliminate paragraph top margin, aligning attribution text with user name. Deployed version 4.5.0 to development environment.
- **Button appearance and section demarcation (B-13, B-15):** replaced subtle buttons with default ButtonGroup components for item actions and toolbar, giving them visible borders, background color, and button affordance. Renamed History button and heading to "Checklist audit history". Wrapped history and export views in a bordered card container styled with xcss. Updated heading to "Definition of Done items". Deployed version 4.6.0 to development environment.
- **Asymm In-Jira UI Standard adoption (B-13, B-15, DG-15):** implemented the Asymm Systems In-Jira UI Standard (`docs/design/asymm-jira-ui-standard.md`). Added `src/brand/brand.ts` and `src/brand/layout.tsx` for brand palette constants, semantic spacing (`SPACE`), semantic tokens (`TOKENS`), and layout primitives (`AppSurface`, `PanelHeader`, `SummaryBlock`, `Section`, `SubSection`, `NoteBox`, `KeyValueInline`, `ActionRow`, `ListRow`). Refactored `src/frontend/index.tsx` to mount on `AppSurface`, render `PanelHeader` with status lozenge ("DoD complete" or "Incomplete") and right-aligned Refresh button, `SummaryBlock` hero card with next step line and single primary action "Complete DoD", collapsible `Section` for "Definition of Done items" with indented `SubSection` attributions and `NoteBox` forms, and collapsible `Section` for "Checklist audit history" with chain integrity lozenge and export block. Added `nextStep` to `GateStatusText` in `src/ui/panel-view-model.ts`. All 308 tests pass, 96.14% branch coverage, 0 em dashes, graders pass, scale harness 16 of 16 pass. Deployed version 4.7.0 to development environment (commit `2c5a679`).
- **Canonical @asymm/jira-ui adoption (B-13, B-15, DG-15):** migrated from duplicate local `src/brand/` to canonical monorepo package `@asymm/jira-ui` under `packages/asymm-jira-ui`. Configured path mapping in `tsconfig.json`. Removed duplicate `src/brand/` and `test/brand/`. Updated imports across `src/frontend/index.tsx` and `src/frontend/settings.tsx` to use semantic roles and layout primitives. Replaced raw tokens in settings with `SPACE` tokens. Added architecture hygiene test enforcing zero raw Atlassian tokens or hex colors outside `@asymm/jira-ui`. All 303 tests pass with 96.09% branch coverage. Scale harness passes 16 of 16 tests. Graders pass. Zero em dashes. Deployed version 4.8.0 to development environment.
- **Uniform Permission Management Standard implementation:** implemented native Jira admin page (`jira:adminPage` with key `definitionguard-admin`, title "DefinitionGuard approvers", resource `admin`, resolver `admin-resolver`). Added Two-Tier Fail-Closed Authorization Model (Tier 1: built-in Jira `ADMINISTER` or `ADMINISTER_PROJECTS`, Tier 2: configurable `DG_APPROVER` authority groups in Forge KVS `dg:cfg:approver_policy`). Evaluated via `asUser()` on Jira `/rest/api/3/mypermissions` and `/rest/api/3/myself?expand=groups`. Admin page UI implemented with `@asymm/jira-ui` `AdminPolicyPanel`. Added resolvers `authority-policy-get`, `authority-group-search`, and `authority-policy-set`. Restricted checklist waiver and reset to authorized approvers. Displayed approver helper text and audit line in `SummaryBlock`. Added `read:jira-user` scope to `manifest.yml` and `definitionguard-listing-v2.md`. All 28 test suites pass (347 tests), 100% branch coverage on approver modules, scale harness 16 of 16 pass, graders pass, zero em dashes. Deployed version 5.0.0 to development environment with major version upgrade.
- **Release merge and tagging:** merged `master` into `feature/definitionguard-completion`. All 347 unit tests and 16 scale harness tests pass. Fast-forwarded `master` to the merge commit. Tagged release `definitionguard-release-2026-11-03`.





