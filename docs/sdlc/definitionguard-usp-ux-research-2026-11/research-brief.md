# DefinitionGuard: USP and UX research brief

- **Date:** 2026-11-01
- **Scope:** Part A (research only) of `loop-engine/agents/definitionguard_usp_ux_research.md`. No file under `apps/` changed. No commit, deploy or `forge` command.
- **Code baseline:** all 17 source and test files, `manifest.yml`, `package.json`, `tsconfig.json` and `jest.config.js` have the md5 listed in `docs/sdlc/portfolio-audit-2026-10-31/appendix-definitionguard.md` section 1.1. Every DG finding is therefore **still open** at the cited line. `apps/definitionguard` has no uncommitted change.
- **Evidence grades:** Observed-code, Observed-test, Observed-live, Reported, Inferred (audit scheme). Source IDs: M- (Marketplace apps), N- (native Jira, workflow apps, Forge, audit frameworks), R- (round 2 refute and library code), L- (live GET, this research), T- (harness tests, this research). Section 8 lists every source.
- **Scratch:** `~/.cache/gemini-earning-definitionguard-research/` (`sources/`, `harness/`, `merge_sources.py`).

## 1. Executive summary

1. The core claim of the listing, "blocks transitions to Done", is not true today. The validator ignores the target status (T-04), and on the live site no workflow has it attached (L-01).
2. Blocking on mandatory items is not a gap. TitanApps, HeroCoders (also on its free tier, 30,175 installs) and Appbox already do it (M-30, M-60, M-80). H6 is **Not true**.
3. Every checklist competitor needs the admin to add the validator to each transition by hand, and none supports team-managed projects (M-30, M-60, M-71, M-90).
4. No checklist competitor documents required evidence, per-item "who may tick" rules, separation of duties, waivers with a reason, or any integrity claim. All are Unknown after two rounds of search.
5. Approval apps sell transition-level separation of duties and SOC 2 export, but with tiny install counts (1 to 302) (R-01, R-02, R-04).
6. The strongest USP candidate is U2: one item-level control record (evidence, required role, "not the assignee", waiver with reason) that the gate enforces. It meets Gap and Feasible. Pain and Defensible are only Partly met. It is not true today.
7. Signing (U3) and the coverage check (U4) support U2. Neither passes the USP test alone.
8. Native Jira cannot gate on "all mandatory items" (N-38), and Automation cannot block (N-46). It does have a Separation of Duties condition (N-30).
9. At 11 to 100 users, $1.00 per user per month is the top of the band (M-12). It is defensible only after the U2 items ship (H9).
10. Release blockers come first in the backlog: DG-08, DG-02, DG-05, DG-06, DG-01, DG-04 with DG-03, DG-09, PX-02, PX-01.

## 2. Competitor matrix

Columns: **DG** = DefinitionGuard today. **Titan** = TitanApps Smart Checklists (Pro). **HC Pro** = Checklists for Jira (Pro) by HeroCoders, formerly Issue Checklist. **HC Ent** = Checklists for Jira (Enterprise) by HeroCoders, formerly Okapya Checklist for Jira. **Appbox** = Checklist for Jira (Lite) by Appbox.ai. **SolDevelo** = Multiple Checklists. **Approval** = approval and sign-off apps (Approval Flow, Business Sign-off, Herzum). **JMWE**, **SR** = ScriptRunner. **Native** = Jira Cloud company-managed.

Names: HeroCoders says Free, Pro and Enterprise "use a common codebase" (M-76). The two extra apps were chosen by install count from the "checklist" search (M-01). Apps named "Definition of Done" have 0 to 82 installs (M-02); one of them, by ChefStackz, blocks transitions (R-03).

| Row | DG | Titan | HC Pro | HC Ent | Appbox | SolDevelo | Approval | JMWE | SR | Native |
|---|---|---|---|---|---|---|---|---|---|---|
| Installs (date 2026-11-01) | Not listed | 4,635 (M-03) | 7,783; Free 30,175 (M-07, M-24) | 4,543 (M-11) | 2,370 (M-15) | 1,062 in search, 0 on detail (M-01, M-20) | 1 to 302 (R-01, R-02) | 16,338 all hosting (N-51) | 34,250 all hosting (N-52) | Built in (N-30) |
| Price, 11 to 100 users, per user per month | $1.00 listed (listing) | $0.90 (M-04) | $0.82 (M-08) | $1.00 (M-12) | $0.10 (M-16) | $0.50 (M-21) | Unknown | $2.00 (N-51) | $2.67 (N-52) | Included (N-30) |
| 50 users, monthly (50 x rate, Inferred) | $50 | $45 (M-04) | $41 (M-08) | $50 (M-12) | $5 (M-16) | $25 (M-21) | Unknown | about $100 (N-51) | about $134 (N-52) | $0 extra (N-30) |
| Blocks transition on open mandatory items | Yes, wherever attached (T-04, T-05) | Yes, paid only (M-30, M-31) | Yes, free too (M-60, M-64) | Yes, plus specific-checklist rule (M-71) | Yes (M-80, M-17) | Whole or named checklist only (M-90) | Blocks until approvals (R-01, R-04) | Build-your-own expression validator (N-53) | Validate Details, Jira expressions (N-54, N-55) | Cannot require all checkboxes (N-38) |
| Admin attaches validator per transition | Yes (Observed-code `manifest.yml:11-15`, L-01) | Yes (M-30) | Yes (M-60) | Yes (M-71) | Yes (M-80) | Yes, global admin (M-90) | Yes, rules per transition (R-01) | Yes (N-53) | Yes (N-54) | Yes (N-30) |
| Team-managed projects | No: `projectTypes` not set (Observed-code manifest, N-01) | No (M-30, M-32) | No validator (M-61, M-62) | No (M-71) | Unknown | No (M-90) | Unknown | Unknown | Unknown | Fewer rules; "isn't empty" only (N-31, N-32) |
| Jira Service Management | Yes, JSM templates (Observed-code `checklist-engine.ts:176-246`) | Templates and portal (M-43, M-44) | Agents and portal (M-74) | Same codebase (M-76) | Unknown | Unknown | Herzum: "Jira and JSM" (R-02) | Unknown | Unknown | Yes (N-30) |
| Custom templates per project and issue type | No: saved, never applied (DG-04, Observed-code `index.ts:118,151,230,297`) | Yes, admin-only defaults (M-38, M-36) | Yes, space admin (M-66, M-77) | Yes, global checklists (M-67) | JQL auto-assign (M-83, M-84) | Issue type or JQL (M-94, M-93) | Not applicable: rules, not lists (R-01) | No checklist UI (N-53) | No checklist UI (N-54) | No checklist field type (N-36) |
| Template change reaches open issues | No, snapshot (DG-12) | Snapshot; Linked Templates propagate (M-39) | Copy (M-67) | Yes, not Done ones (M-67) | Unknown | No (M-95) | Unknown | Unknown | Unknown | Unknown |
| Per-item evidence | No: `notes` never sent by UI (DG-11) | Links and details (M-05, M-100) | Description, URLs (M-63) | Same codebase (M-76) | Links page exists (M-87) | Unknown | Notes for reviewers (R-04) | Unknown | Unknown | Action items in text only (N-33) |
| Evidence can be required | No (DG-11) | Unknown | Unknown | Unknown | Unknown | Unknown | Unknown | Unknown | Unknown | Unknown |
| Who may tick | Anyone who can view (T-10, DG-02) | Project permission (M-36, M-37) | "Toggle" permission (M-70) | Same (M-70) | View or Edit only (M-84) | Unknown | Approver by user, group, role (R-01) | User validator (N-53) | Expression (N-54) | Permission conditions (N-30) |
| Separation of duties | No (DG-02) | Unknown | Unknown | Unknown | Unknown | Unknown | Claimed, transition level (R-01) | User vs assignee by expression (N-53, Inferred) | Expression (N-54, Inferred) | SoD condition, transition level (N-30, N-42) |
| Waiver with a reason | No (Observed-code `models.ts:35`) | Unknown; "Skipped" status exists (M-32) | Unknown; "skipped" (M-72) | Unknown | Unknown | Unknown | Unknown | Unknown | Unknown | Unknown |
| Audit history | Trail in panel, names rewritten (DG-09, T-12) | History tab (M-35); acting user "Coming soon" (M-48) | History, PDF export, admins can clear (M-68) | Same (M-68) | Must switch on (M-82) | Last tick only on hover (M-91, M-92) | CSV export (R-04) | Unknown | Unknown | Issue history (Unknown for Action items) |
| Integrity claim | "Tamper-evident", false (DG-01, T-12) | None found (M-30 to M-50) | None found (M-60 to M-77) | None found | None found | None found | SOC 2 export claim (R-04) | Unknown | Unknown | Unknown |
| Blocked message names open items | Yes (T-05, Observed-code `transition-validator.ts:44-51`) | Unknown; custom message (M-30) | Unknown | Unknown | Unknown | Probably not (M-90, Inferred) | Unknown | Custom message (N-53, Inferred) | Unknown | Validator message only (N-01) |
| Forge, no egress | Yes (Observed-code manifest) | Forge, RoA claimed (M-05, M-47) | Forge (M-75); outside-access scope (M-09) | Same (M-75) | Forge (M-85) | Forge since 2026-03-23 (M-96) | Business Sign-off RoA signal (R-04) | Unknown | Unknown | Not applicable |

## 3. Hypothesis verdicts

| ID | Hypothesis | For | Against | Verdict |
|---|---|---|---|---|
| H1 | The gate blocks moves to Done, Resolved or Deployed | It blocks wherever an admin attaches it (T-05) | The validator never reads `transition.to` (Observed-code `index.ts:82-125`). It blocked a move to status id 3 (T-04). No live workflow has it (L-01). | **Not true** |
| H2 | It logs identity, time and verification evidence per item | accountId and time are stored (Observed-code `checklist-engine.ts:386-403`) | No evidence field in the UI (DG-11). A panel load rewrites the stored name and the hash then fails to match (T-12) | **Not true** |
| H3 | The SHA-256 hash gives compliance verification and a tamper-evident history | Hash changes on reset and on item change (audit probes 3 to 6, 13) | Nothing verifies it (DG-01). History and old events are outside the hash (audit probes 7 to 9). The app's own rewrite breaks it (T-12) | **Not true** |
| H4 | "Zero config" with a default template is what buyers want | First run needs no setup; the validator auto-creates a checklist (T-05) | Every checklist competitor offers templates per project and issue type (M-38, M-66, M-83, M-94). DG cannot apply a custom template (DG-04). The default puts mandatory SOC 2 items on every Task (Observed-code `checklist-engine.ts:51-57`) | **Partly true**: defaults help first run; custom templates are table stakes |
| H5 | The LedgerSeal integration has buyer value | None | `apps/ledgerseal/src` has 0 references to DefinitionGuard or `checklistHash` (Observed-code, grep 2026-11-01). No source shows buyer demand | **Not true** |
| H6 | Main checklist apps do not block on open mandatory items | SolDevelo has no per-item flag (M-90) | TitanApps (M-30), HeroCoders (M-60), Appbox (M-80, M-130) and ChefStackz (R-03) block | **Not true** |
| H7 | Regulated teams need evidence, SoD and an exportable record, and competitors do these badly | NIST CM-3 asks to "Test, validate, and document changes" (N-56); AC-5 is separation of duties (N-56); SOC 2 CC8.1 lists authorises, tests, approves (N-57). Checklist apps document none of evidence-required, SoD or waivers (section 2) | Approval apps claim SoD and SOC 2 export (R-01, R-04). Native has a SoD condition (N-30). HeroCoders exports history to PDF (M-68). Exact ISO 27001 wording is Unknown (N-58, N-59) | **Partly true**: the need is in the frameworks; checklist apps do not cover it; approval apps cover part at transition level |
| H8 | Native Jira is not enough for a DoD gate | Field Required cannot require all checkboxes (N-38). Automation cannot block (N-46). Validators do not run on Edit (N-40). Action items are text only (N-33) | Native has SoD and sub-task blocking conditions (N-30). Team-managed now has "isn't empty" (N-32) | **Confirmed** for an item-level gate. Native covers transition-level SoD |
| H9 | Teams will pay $1.00 per user per month at 11 to 100 users | HeroCoders Enterprise charges $1.00 (M-12). HeroCoders Pro has 7,783 paid installs at $0.82 (M-07, M-08) | Appbox charges $0.10 (M-16). The approval niche has 1 to 302 installs (R-02). DG today has fewer features than the $0.82 app (section 2) | **Partly true**: the price is in the band only as a premium tier, after U2 ships |
| H10 (new) | Gate every move into the status category Done by default (audit DG-07 fix) | The payload has `transition.to.id` (N-01) | The live JSM workflows send "Cancel request" to Canceled, a DONE-category status (L-05). A category-only rule would block cancellations | **Partly true**: gate Done-category moves, with an admin-set list of exempt statuses or transitions |
| H11 (new) | The app can attach its validator to workflows itself | The update API exists, scope `manage:jira-configuration` (N-18, N-19) | FRGE-2301 (2026-10-15): "There is no supported API to add the app's rule to a transition." (N-05) | **Not true** today. Attach stays a manual admin step; the app can only check and guide |
| H12 (new) | Team-managed support is a gap DG can fill | Forge opts in with `projectTypes` (N-01). All checklist competitors say company-managed only (M-30, M-61, M-71, M-90) | The site has no team-managed project to test on (L-02) | **Unknown** (untestable on this site) |
| H13 (new) | A failing Forge validator blocks the transition | Timeout blocks: FRGE-710, fixed 2022 (N-02) | A throw is not documented (N-01). Unlicensed users: the validator does not run (N-06), outcome Unknown | **Partly true**: DG must catch every error itself (DG-08) |

## 4. USP test

Conditions: **Gap** (2 sources), **Pain** (votes, reviews, threads), **Feasible** (named Forge limits), **Defensible** (not copied in one release), **Honest today**.

| Candidate | Gap | Pain | Feasible | Defensible | Honest today | Result |
|---|---|---|---|---|---|---|
| U1 Fail-closed gate that names pending items, no setup per issue | **Fails.** Four apps block (M-30, M-60, M-80, R-03). Small gap: HC Ent specific-checklist rule passes when the checklist is deleted (M-71) | Partly: threads ask for a gate (N-46, N-47, N-63) | Yes. Validator runtime 25 s (N-10, Inferred for validators) | No: one release | Partly: names items and fails closed on a missing record (T-05); throws on storage error (T-06) | **Fails.** Keep as table stakes, done right |
| U2 Item-level control record: required evidence, required role, "not the assignee", waiver with reason, enforced by the gate | **Met** for checklist apps: none documents it (section 2: M-sections Unknown in 5 apps). Done badly: history clearable by admins (M-68), acting user not in history (M-48), native cannot require all items (N-38). Refute (R-01): approval apps do SoD per transition, not per item | **Partly.** Frameworks ask for it (N-56, N-57). Votes: JSDCLOUD-6249 "stop reporter choosing themselves as approver", 28, fixed (N-44). Approval apps have low installs (R-02) | Yes. Events in append-only keys, each under 240 KiB (N-11); 25 operations per transaction (N-12); `FAIL_IF_EXISTS` for ordered appends (N-13, R-05); permission check per issue with `/mypermissions` and the issue key (N-20); issue write limit 20 per 2 s (N-22) | **Partly.** Each part is copyable. The combination needs a new data model, roles and an immutable trail in a competitor's app (Inferred) | **No.** Blocked by DG-02, DG-04, DG-05, DG-06, DG-09, DG-11 | **Strongest candidate.** Passes Gap and Feasible; Pain and Defensible Partly; needs B-02 to B-07, B-11, B-12 |
| U3 Signed DoD attestation that other tools can verify (audit 5.2) | **Met.** No checklist app makes an integrity claim (section 2); HeroCoders history can be cleared (M-68) | **Fails.** No vote or review found. Business Sign-off markets SOC 2 export with 6 installs (R-04) | Yes. Ed25519 in Node `crypto` (no new dependency, Inferred). Key in an encrypted Forge variable, which reaches the app as clear text (N-25), or `kvs.setSecret`. Property max 32,768 characters (N-21) | Partly: needs a published verifier and key rotation (audit 5.5) | **No.** DG-01, DG-09, DG-10. **Limit:** the vendor holds the key, so a signature proves the app wrote it, not that the vendor did not (audit 5.5) | **Fails** alone. Ship as the integrity layer of U2 |
| U4 (new) Coverage check: list Done-paths without the gate | **Met.** Every competitor is manual per transition (M-30, M-60, M-80, M-90); no check found | Partly: DG-07; threads N-47, N-63 | Needs workflow read; scope `manage:jira-configuration` (N-18, Inferred for read) | No: one release | No: DG-07 | **Fails** as USP. Keep as UX goal (task 3) |

**Refute attempts (round 2):**
- U2: searched for required evidence, SoD per item, and DoD sign-off apps. Found approval apps with transition-level SoD and SOC 2 export (R-01, R-02, R-04) and a Forge DoD app that blocks (R-03). None documents item-level evidence or roles. Gap stands; Pain lowered to Partly.
- U3: no competitor integrity claim found. Pain could not be shown. Result unchanged.
- U1: R-03 adds a fourth app that blocks. Result unchanged.
- Round 3 was not run. No verdict changed between rounds 1 and 2 except U2 Pain and H7, which both moved down. The remaining Unknowns (H12, H13 throw case) need a live test, not more search.

## 5. Claims to drop

| Claim | Where | Reason |
|---|---|---|
| "Least privilege: `read:jira-work` and `storage:app` only" | listing:23, README:12, spec:76-78 | Known false: 4 scopes (Observed-code `manifest.yml:32-36`) |
| "100% automated test coverage" | listing:24 | Known false: 90.36% branch, UI excluded (audit 1.2) |
| "carries the official Runs on Atlassian badge" | listing:15 | Known false as a claim. Atlassian applies the badge (N-29) |
| "Inherits SOC 2, ISO 27001 and GDPR compliance natively" | listing:18 | Known false: platform claim, not an app property |
| "Block transitions to Done, Resolved or Deployed" | listing:7, README:16, spec:8 | H1 Not true (T-04, L-01) |
| "verification evidence for every checklist item" | listing:8 | H2 Not true (DG-11) |
| "SHA-256 state hash for compliance verification", "tamper-evident" | listing:9, `index.tsx:137,224` | H3 Not true (DG-01, T-12) |
| "Seamless LedgerSeal Integration" | listing:11, README:18, spec:9 | H5 Not true (grep, 0 references) |
| "Zero Config Setup" as a feature | listing:10 | H4: no config is possible at all (DG-04) |
| "Tracks exact user account IDs" | README:17 | Visible names are rewritten (DG-09, T-12) |
| Data in `@forge/storage`, keys `checklist:issue:{id}` | README:11, spec:13, 81-84 | Code uses `@forge/kvs` and `dg:checklist:{id}` (Observed-code `index.ts:3`, `checklist-repository.ts:17`) |
| Spec invariant 4 "Every state change records the user account ID" | spec:15 | Validator auto-init records `system` (Observed-code `index.ts:119`) |
| Panel text "Workflow transitions are blocked" | `index.tsx:125` | False when no validator is attached (L-01) |

## 6. New findings from this research

| ID | Finding | Evidence |
|---|---|---|
| NF-01 | The DefinitionGuard validator is attached to no workflow on the live site. The gate blocks nothing today. | Observed-live L-01 |
| NF-02 | The site has a third project, AUDT (Jira Software, company-managed), created 2026-10-31. The brief says DEMO and TEST only. Some "not testable on DEMO" checks may be testable on AUDT, if the owner allows it. | Observed-live L-02 |
| NF-03 | A Done-category gate would block JSM "Cancel request" (target Canceled is DONE category). | Observed-live L-05 |
| NF-04 | KVS conditional writes exist only for Custom Entities. Plain keys support `FAIL_IF_EXISTS` only. So compare-and-set on `stateVersion` needs a custom entity (manifest change) or append-only event keys with `FAIL_IF_EXISTS`. | Observed-code R-05, Reported N-13 |
| NF-05 | When the user lookup fails, each panel load makes one Jira call per stored accountId, up to 154 calls for 6 items after 200 toggles, on every load. | Observed-test T-03 |
| NF-06 | The 240 KiB limit arrives sooner with more items: 817 toggles at 6 items, 623 at 20, 564 at 50. | Observed-test T-01 |

## 7. Harness tests (this research)

All in `~/.cache/gemini-earning-definitionguard-research/harness/scale.harness.ts`, results in `harness/results/baseline.json`, run 2026-11-01 on host node v26.13.0, Jest 29.7.0. 16 of 16 pass. The harness imports `apps/definitionguard/src` in place and writes nothing under `apps/`.

| ID | Test | Result |
|---|---|---|
| T-01 | Record size after 10, 100, 1,000 toggles at 6, 20, 50 items | See `ux-spec.md` section 3 |
| T-02 | Jira calls and KVS operations per panel load | 0 Jira calls, 1 KVS get when names resolve |
| T-03 | Panel load when every stored name is an accountId (lookup fails) | 154 user lookups per load (6 items, 200 toggles) |
| T-04 | Validator, transition to status id 3, checklist incomplete | Blocked |
| T-05 | Validator, no record | Blocked, message names 5 items, 1 KVS write, 1 Jira call |
| T-06 | Validator, KVS get throws; KVS set throws | Validator throws in both cases |
| T-07 | Validator reads the entity property | 0 property reads |
| T-08 | Zero mandatory items | Validator allows; panel rule shows locked |
| T-09 | Two concurrent ticks through the resolver | 1 of 2 stored, 1 audit event, stateVersion 2 |
| T-10 | Toggle and reset by any accountId | 0 permission calls, 0 `asUser` calls |
| T-11 | `saveProjectTemplate` with payload project and no context project | Writes `dod-templates:OTHER` |
| T-12 | Toggle while lookup fails, then panel load | Name rewritten; stored hash no longer matches recompute |
| T-13 | 6 items, 500-character notes | 8,859 / 45,940 / 299,441 bytes at 10 / 100 / 1,000 toggles |

## 8. Source list

The table below is generated by `merge_sources.py` from the research notes in `sources/`. Quotes are copied as the notes recorded them. N- sources have no per-row access date in the notes; all were read on 2026-11-01. L- sources are in `sources/live-observations.md`:

| ID | URL | Access date | Exact quote | Grade |
|---|---|---|---|---|
| L-01 | https://asymmsystems.atlassian.net/rest/api/3/workflows/search?expand=values.transitions&maxResults=50 | 2026-11-01 | "total":9; all 9 validators "ruleKey":"system:check-permission-validator" | Observed-live |
| L-02 | https://asymmsystems.atlassian.net/rest/api/3/project/search | 2026-11-01 | ["AUDT","software","classic"],["DEMO","service_desk","classic"],["TEST","service_desk","classic"] | Observed-live |
| L-03 | https://asymmsystems.atlassian.net/rest/api/3/issue/DEMO-26/properties/definitionguard-dod | 2026-11-01 | {"isFullySatisfied":true,"satisfied":true,"completedAt":"2026-10-30T16:12:22.188Z"} | Observed-live |
| L-04 | https://asymmsystems.atlassian.net/rest/api/3/issue/DEMO-22/properties/definitionguard-dod | 2026-11-01 | {"isFullySatisfied":false,"completedCount":1,"totalCount":4,"checklistHash":"58493ea3..."} | Observed-live |
| L-05 | same as L-01 | 2026-11-01 | "name":"Canceled","statusCategory":"DONE"; transition "Cancel request" "toStatusReference":"10006" | Observed-live |
| L-06 | same as L-01 | 2026-11-01 | DEMO: 8 transitions into DONE-category statuses in 3 workflows; 3 are "Declined" or "Cancel request". TEST: 2. AUDT: 1 GLOBAL "Done" | Observed-live |

The M-, N- and R- sources follow.

| ID | URL | Access date | Exact quote | Grade |
|---|---|---|---|---|
| M-01 | https://marketplace.atlassian.com/rest/2/addons?text=checklist&hosting=cloud&application=jira&limit=50 | 2026-11-01 | "Checklist for Jira (Lite) \| 2375 \| Appbox.ai" (fields name, totalInstalls, vendor) | Reported |
| M-02 | https://marketplace.atlassian.com/rest/2/addons?text=definition%20of%20done&hosting=cloud&application=jira&limit=50 | 2026-11-01 | "definition-of-done \| Definition of Done \| 60 \| Chasing Agility" | Reported |
| M-03 | https://marketplace.atlassian.com/rest/2/addons/rw-smart-checklist-biz | 2026-11-01 | "totalInstalls": 4635; "averageStars": 3.3907285, "count": 151 | Reported |
| M-04 | https://marketplace.atlassian.com/rest/2/addons/rw-smart-checklist-biz/pricing/cloud/live | 2026-11-01 | "editionDescription": "100 users", ... "amount": 0.9 | Reported |
| M-05 | https://marketplace.atlassian.com/rest/2/addons/rw-smart-checklist-biz/versions/latest?hosting=cloud | 2026-11-01 | "Block issue transition until checklist items are completed"; "Runs on Atlassian" | Reported (vendor claim text) |
| M-06 | https://marketplace.atlassian.com/rest/2/addons/rw-smart-checklist-biz/reviews?limit=50&sort=recent | 2026-11-01 | "count": 135, "averageStars": 4.694444444444445 | Reported |
| M-07 | https://marketplace.atlassian.com/rest/2/addons/com.gebsun.plugins.jira.issuechecklist | 2026-11-01 | "Checklists for Jira (Pro) by HeroCoders"; "totalInstalls": 7783 | Reported |
| M-08 | https://marketplace.atlassian.com/rest/2/addons/com.gebsun.plugins.jira.issuechecklist/pricing/cloud/live | 2026-11-01 | "100 users" ... "amount": 0.82 | Reported |
| M-09 | https://marketplace.atlassian.com/rest/2/addons/com.gebsun.plugins.jira.issuechecklist/versions/latest?hosting=cloud | 2026-11-01 | "Add checklist workflow validators to require definition of ready or acceptance criteria to be completed"; scope "Access and interact with your data from outside of Atlassian." | Reported |
| M-10 | https://marketplace.atlassian.com/rest/2/addons/com.gebsun.plugins.jira.issuechecklist/reviews?limit=50&sort=recent | 2026-11-01 | "count": 264, "averageStars": 4.540719696969697 | Reported |
| M-11 | https://marketplace.atlassian.com/rest/2/addons/com.okapya.jira.checklist | 2026-11-01 | "Checklists for Jira (Enterprise) by HeroCoders"; "totalInstalls": 4543 | Reported |
| M-12 | https://marketplace.atlassian.com/rest/2/addons/com.okapya.jira.checklist/pricing/cloud/live | 2026-11-01 | "100 users" ... "amount": 1.0; monthly "10 users" "amount": 5.0 | Reported |
| M-13 | https://marketplace.atlassian.com/rest/2/addons/com.okapya.jira.checklist/versions/latest?hosting=cloud | 2026-11-01 | "screen-reader compatible"; "Post-functions & validators" | Reported (vendor claim text) |
| M-14 | https://marketplace.atlassian.com/rest/2/addons/com.okapya.jira.checklist/reviews?limit=50&sort=recent | 2026-11-01 | "count": 143, "averageStars": 4.256993006993007 | Reported |
| M-15 | https://marketplace.atlassian.com/rest/2/addons/com.appbox.ai.checklist | 2026-11-01 | "Checklist for Jira (Lite)"; "totalInstalls": 2370 | Reported |
| M-16 | https://marketplace.atlassian.com/rest/2/addons/com.appbox.ai.checklist/pricing/cloud/live | 2026-11-01 | "100 users" ... "amount": 0.1 | Reported |
| M-17 | https://marketplace.atlassian.com/rest/2/addons/com.appbox.ai.checklist/versions/latest?hosting=cloud | 2026-11-01 | "Mark items mandatory  Workflow validation to finish all items before the transition"; "Rebuilt on Atlassian Forge" | Reported (vendor claim text) |
| M-18 | https://marketplace.atlassian.com/rest/2/addons/com.appbox.ai.checklist/reviews?limit=50&sort=recent | 2026-11-01 | "count": 56 ... "averageStars": 4.352678571428571 | Reported |
| M-19 | https://marketplace.atlassian.com/rest/2/addons/com.appbox.ai.checklist.enterprise (and /pricing/cloud/live, /versions/latest) | 2026-11-01 | "totalInstalls": 0; "100 users" ... "amount": 0.5 | Reported |
| M-20 | https://marketplace.atlassian.com/rest/2/addons/com.soldevelo.apps.checklists | 2026-11-01 | "totalInstalls": 0 (search shows 1062); "cloudFortified": {"status": "approved"} | Reported |
| M-21 | https://marketplace.atlassian.com/rest/2/addons/com.soldevelo.apps.checklists/pricing/cloud/live | 2026-11-01 | "100 users" ... "amount": 0.5 | Reported |
| M-22 | https://marketplace.atlassian.com/rest/2/addons/com.soldevelo.apps.checklists/versions/latest?hosting=cloud | 2026-11-01 | "Block issue status transitions if checklist items are not checked"; scope "admin:connect-jira" | Reported (vendor claim text) |
| M-23 | https://marketplace.atlassian.com/rest/2/addons/com.soldevelo.apps.checklists/reviews?limit=50&sort=recent | 2026-11-01 | "count": 29 ... "averageStars": 4.870689655172414 | Reported |
| M-24 | https://marketplace.atlassian.com/rest/2/addons/com.herocoders.plugins.jira.issuechecklist-free (and /versions/latest) | 2026-11-01 | "totalInstalls": 30175; "Have under 10 users? Pro is completely free for you!" | Reported |
| M-25 | https://marketplace.atlassian.com/rest/2/addons/rw-smart-checklists (and /versions/latest) | 2026-11-01 | "totalInstalls": 4924; "Validate  checklists before issue transition in your workflow" | Reported |
| M-30 | https://railsware.atlassian.net/wiki/spaces/CHK/pages/3807641616 (CF, v30, 2026-04-24) | 2026-11-01 | "Validator will work only for Company-managed projects ." | Reported |
| M-31 | https://railsware.atlassian.net/wiki/spaces/CHK/pages/3839393793 (CF, v23, 2026-04-24) | 2026-11-01 | "By default, checklist items are not marked as mandatory." | Reported |
| M-32 | https://railsware.atlassian.net/wiki/spaces/CHK/pages/144015403 (CF, v54, 2026-04-24) | 2026-11-01 | "Not available in Team-Managed projects." | Reported |
| M-33 | https://railsware.atlassian.net/wiki/spaces/CHK/pages/6201180179 (CF, v1, 2026-09-21) | 2026-11-01 | "Select All mandatory items per header/tab completed." | Reported |
| M-34 | https://railsware.atlassian.net/wiki/spaces/CHK/pages/3823566849 (CF, v9, 2023-12-20) | 2026-11-01 | "Herein, transition validators are not available either." | Reported (old) |
| M-35 | https://railsware.atlassian.net/wiki/spaces/CHK/pages/91095104 (CF, v27, 2026-07-07) | 2026-11-01 | "provides a complete chronological log of all changes made to the checklist for a Jira issue." | Reported |
| M-36 | https://railsware.atlassian.net/wiki/spaces/CHK/pages/3495133185 (CF, v50, 2025-12-19) | 2026-11-01 | "are able to create/modify templates and set them as default." | Reported |
| M-37 | https://railsware.atlassian.net/wiki/spaces/CHK/pages/3495002113 (CF, v24, 2025-12-19) | 2026-11-01 | "check/uncheck checklist items, set statuses" | Reported |
| M-38 | https://railsware.atlassian.net/wiki/spaces/CHK/pages/1294532651 (CF, v42, 2026-04-24) | 2026-11-01 | "Templates are applied only once per issue." | Reported |
| M-39 | https://railsware.atlassian.net/wiki/spaces/CHK/pages/4000579601 (CF, v16, 2024-08-27) | 2026-11-01 | "Any changes made to the original template, will affect every checklist where the template is imported to." | Reported |
| M-40 | https://railsware.atlassian.net/wiki/spaces/CHK/pages/3566829569 (CF, v21, 2024-05-10) | 2026-11-01 | "Created template is set as Project Template by default" | Reported |
| M-41 | https://railsware.atlassian.net/wiki/spaces/CHK/pages/5888639021 (CF, v2, 2026-06-12) | 2026-11-01 | "This feature disables checklist editing together with the entire issue" | Reported |
| M-42 | https://railsware.atlassian.net/wiki/spaces/CHK/pages/941162533 (CF, v22, 2025-11-27) | 2026-11-01 | "Export Issues with the Smart Checklist content" | Reported |
| M-43 | https://railsware.atlassian.net/wiki/spaces/CHK/pages/3455352833 (CF, v23, 2026-02-26) | 2026-11-01 | "Add Checklist for certain Request types in Jira Service Management project" | Reported |
| M-44 | https://railsware.atlassian.net/wiki/spaces/CHK/pages/3687874561 (CF, v17, 2026-03-06) | 2026-11-01 | "Smart Checklist can be displayed on the Jira Service Management Customer Portal in read-only mode ." | Reported |
| M-45 | https://railsware.atlassian.net/wiki/spaces/CHK/pages/2487320587 (CF, v13, 2024-05-16) | 2026-11-01 | "Save changes and close the Full screen Editor" | Reported |
| M-46 | https://railsware.atlassian.net/wiki/spaces/CHK/pages/6152060938 (CF, v3, 2026-09-25) | 2026-11-01 | "On 15 December 2026 , Smart Checklist Free version reaches end of support" | Reported |
| M-47 | https://railsware.atlassian.net/wiki/spaces/CHK/pages/4760829966 (CF, v12, 2026-03-10) | 2026-11-01 | "Uninstalling the Forge app will delete all checklist data." | Reported |
| M-48 | https://railsware.atlassian.net/wiki/spaces/CHK/pages/6312361987 (CF, v1, 2026-10-27) | 2026-11-01 | "Records Smart Checklist custom fields updates in Jira issue history as the actual user" ... "Coming soon!" | Reported |
| M-49 | https://railsware.atlassian.net/wiki/spaces/CHK/pages/5861736450 (CF, v6, 2026-06-12) | 2026-11-01 | "Assign checklist items to specific team members" | Reported |
| M-50 | https://railsware.atlassian.net/wiki/spaces/CHK/pages/1372586008 (CF, v24, 2026-08-20) | 2026-11-01 | "the Checklists and Smart Checklist Progress custom fields will be created automatically" | Reported |
| M-51 | https://railsware.atlassian.net/wiki/spaces/CHK/pages/4844028050 (CF, v19, 2026-09-14) | 2026-11-01 | "Runs on Atlassian (all data stays within Atlassian) ❌" (HeroCoders columns) | Vendor claim about competitor |
| M-60 | https://docs.herocoders.com/checklist/validate-that-all-mandatory-items-are-complete (source CF page 4103602801, v4, 2025-11-11) | 2026-11-01 | "This validation rule only works in Company-managed spaces." | Reported |
| M-61 | https://docs.herocoders.com/checklist/validate-that-all-checklist-items-are-complete | 2026-11-01 | "Checklist Completed for the field" ... "This value All Completed" | Reported |
| M-62 | https://docs.herocoders.com/checklist/validate-checklist-complete-team-managed-projects | 2026-11-01 | "which is not currently available for Team-managed spaces." | Reported |
| M-63 | https://docs.herocoders.com/checklist/checklist-items | 2026-11-01 | "Checklist items are mandatory by default" | Reported |
| M-64 | https://docs.herocoders.com/checklist/app-comparison-herocoders | 2026-11-01 | "Checklists for Jira Cloud is an old version of newly released Checklists for Jira (Enterprise)" | Reported |
| M-65 | https://docs.herocoders.com/checklist/features-free-pro-enterprise-comparison | 2026-11-01 | "You can also create up to six checklist templates ." | Reported |
| M-66 | https://docs.herocoders.com/checklist/setting-a-default-template | 2026-11-01 | "You must have space administrator permission to set default templates." | Reported |
| M-67 | https://docs.herocoders.com/checklist/global-checklists | 2026-11-01 | "Global checklist are live." | Reported |
| M-68 | https://docs.herocoders.com/checklist/checklist-history | 2026-11-01 | "The checklist history can be exported/printed as a PDF." | Reported |
| M-69 | https://docs.herocoders.com/checklist/configure-permissions | 2026-11-01 | "you can configure custom checklist permissions that are independent of the Jira work item permissions." | Reported |
| M-70 | https://docs.herocoders.com/checklist/limit-who-can-work-on-checklists | 2026-11-01 | "Toggle items / change item status" ... "Toggle Checklist Items" | Reported |
| M-71 | https://docs.herocoders.com/checklist/require-specific-checklist-on-transition | 2026-11-01 | "the validation will pass without requiring the checklist." | Reported |
| M-72 | https://docs.herocoders.com/checklist/validate-for-a-specific-checklist-item | 2026-11-01 | "(?ms).*^\*\s+\[(x\|done\|skipped)\]\s+first item.*" | Reported |
| M-73 | https://docs.herocoders.com/checklist/exporting-checklists | 2026-11-01 | "Global Checklists are not saved to the Checklist Text custom field." | Reported |
| M-74 | https://docs.herocoders.com/checklist/jsm-portal | 2026-11-01 | "Jira Service Management agents can see and work with the checklist" | Reported |
| M-75 | https://docs.herocoders.com/checklist/updating-your-app-to-a-forge-version | 2026-11-01 | "The most recent versions of Checklists for Jira apps are now running on the newest Forge platform." | Reported |
| M-76 | https://docs.herocoders.com/checklist/upgrading-from-checklist-for-jira-cloud-to-checkli | 2026-11-01 | "use a common codebase." | Reported |
| M-77 | https://docs.herocoders.com/checklist/editing-renaming-and-deleting-templates | 2026-11-01 | "Any user can edit, rename or delete templates they created." | Reported |
| M-78 | https://herocoders.com/blog/herocoders-okapya-merger | 2026-11-01 | "are joining forces." | Reported (vendor blog) |
| M-80 | https://docs.appbox.ai/checklist/block-issue-transition-using-checklist-validators/ | 2026-11-01 | "All mandatory checklist items are completed" | Reported |
| M-81 | https://docs.appbox.ai/checklist/locking-checklist-items/ | 2026-11-01 | "users are prevented from accidentally deleting those items." | Reported |
| M-82 | https://docs.appbox.ai/checklist/checklist-history/ | 2026-11-01 | "The old and new values (if applicable)." | Reported |
| M-83 | https://docs.appbox.ai/checklist/assigning-templates/ | 2026-11-01 | "write a JQL to assign the template." | Reported |
| M-84 | https://docs.appbox.ai/checklist/managing-checklist-custom-permissions/ | 2026-11-01 | "to edit/add templates, you MUST have project administrator permissions" | Reported |
| M-85 | https://docs.appbox.ai/checklist/v2-1-0-moved-to-forge/ | 2026-11-01 | "the app makes no calls to outside servers." | Reported (vendor doc) |
| M-86 | https://docs.appbox.ai/checklist/understanding-free-checklist-usage/ | 2026-11-01 | "a maximum of 1500 checklists per month" | Reported |
| M-87 | https://docs.appbox.ai/checklist/sitemap-0.xml | 2026-11-01 | "creating-link-in-a-checklist-item/" | Reported (title only) |
| M-90 | https://soldevelo.atlassian.net/wiki/spaces/CS/pages/1374519306 (CF, v16, 2026-06-12) | 2026-11-01 | "this feature is not available for team-managed projects in Jira Cloud." | Reported |
| M-91 | https://soldevelo.atlassian.net/wiki/spaces/CS/pages/1403486269 (CF, v11, 2026-06-12) | 2026-11-01 | "track actions performed on checklists by other users." | Reported |
| M-92 | https://soldevelo.atlassian.net/wiki/spaces/CS/pages/1264124107 (CF, v6, 2026-06-12) | 2026-11-01 | "the popover will show the user and the date of the last action." | Reported |
| M-93 | https://soldevelo.atlassian.net/wiki/spaces/CS/pages/4080828421 (CF, v8, 2026-06-12) | 2026-11-01 | "By default, only Jira administrators can manage Global Templates ." | Reported |
| M-94 | https://soldevelo.atlassian.net/wiki/spaces/CS/pages/1264058455 (CF, v13, 2026-06-12) | 2026-11-01 | "Adding automation is a feature reserved for users with global permissions as well as for project and Jira admins." | Reported |
| M-95 | https://soldevelo.atlassian.net/wiki/spaces/CS/pages/1264124252 (CF, v7, 2026-06-12) | 2026-11-01 | "will not affect the templates that have already been added to Jira issues." | Reported |
| M-96 | https://soldevelo.atlassian.net/wiki/spaces/CS/pages/5977341962 (CF, v28, 2026-06-12) | 2026-11-01 | "has been upgraded to run on Forge" | Reported |
| M-97 | https://soldevelo.atlassian.net/wiki/rest/api/space/CS/content/page?limit=250 | 2026-11-01 | "Automate template via JQL"; "Mention users"; "Dark Mode" (page titles) | Reported (titles only) |
| M-100 | https://marketplace.atlassian.com/apps/1216451/smart-checklists-for-jira?reviewId=5c4eb353e773004ed20f72ad (via reviews API) | 2026-11-01 | "to make sure all required steps are actually completed before closing an issue." (5 stars, 2026-05-29) | Reported |
| M-101 | https://marketplace.atlassian.com/apps/1216451/smart-checklists-for-jira?reviewId=5a77ef1f2aa9952cbfa58f75 | 2026-11-01 | "performance can sometimes be a little slow" (3 stars, 2026-01-19) | Reported |
| M-102 | https://marketplace.atlassian.com/apps/1216451/smart-checklists-for-jira?reviewId=5fa5bac38c4efd006f4c3dbb | 2026-11-01 | "Including checklist validation to the workflow really helps" (4 stars, 2025-10-24) | Reported |
| M-103 | https://marketplace.atlassian.com/apps/1216451/smart-checklists-for-jira?reviewId=712020%3Af159c2f8-4b19-4b94-b3e8-918737414a8c | 2026-11-01 | "Initializes and never starts." (1 star, 2025-08-20) | Reported |
| M-104 | https://marketplace.atlassian.com/apps/1216451/smart-checklists-for-jira?reviewId=623273ac33fb840069670228 | 2026-11-01 | "do not actively update across tasks." (3 stars, 2024-05-29) | Reported (old) |
| M-110 | https://marketplace.atlassian.com/apps/1213231/checklists-for-jira-pro-by-herocoders?reviewId=712020%3A0d58ce9b-a429-4001-bcbe-f420e13f5163 | 2026-11-01 | "Would like to see the checklist items or status in card view/Kanban" (3 stars, 2026-01-18) | Reported |
| M-111 | https://marketplace.atlassian.com/apps/1213231/checklists-for-jira-pro-by-herocoders?reviewId=712020%3Ae8b2f1f0-5890-4a27-8474-6f63725dab7c | 2026-11-01 | "a rich history of signoffs and papertrail" (4 stars, 2025-07-22) | Reported |
| M-112 | https://marketplace.atlassian.com/apps/1213231/checklists-for-jira-pro-by-herocoders?reviewId=557058%3A98fa7de4-0fc5-420e-8257-5377c3b480e3 | 2026-11-01 | "well worth its cost." (4 stars, 2025-06-19) | Reported |
| M-113 | https://marketplace.atlassian.com/apps/1213231/checklists-for-jira-pro-by-herocoders?reviewId=62fa8fad2cbfba0566ac252a | 2026-11-01 | "open/done are mandatory." (2 stars, 2025-04-30) | Reported |
| M-114 | https://marketplace.atlassian.com/apps/1213231/checklists-for-jira-pro-by-herocoders?reviewId=63ec67dba4fdf0935c878e46 | 2026-11-01 | "doesn't have live updates" (3 stars, 2024-02-29) | Reported (old) |
| M-115 | https://marketplace.atlassian.com/apps/1211562/checklists-for-jira-enterprise-by-herocoders?reviewId=557058%3A98ba5b4b-ed24-47ff-a96d-6134748904a2 | 2026-11-01 | "stored elsewhere." (1 star, 2024-11-05) | Reported (old) |
| M-116 | https://marketplace.atlassian.com/apps/1211562/checklists-for-jira-enterprise-by-herocoders?reviewId=557058%3A3ea6e754-d56f-484b-9dc7-0e4bda2dac48 | 2026-11-01 | "to have clear DoD-criteria." (4 stars, Data Center, 2026-03-04) | Reported |
| M-117 | https://marketplace.atlassian.com/apps/1211562/checklists-for-jira-enterprise-by-herocoders?reviewId=6267905e52310b0068ff6f8e | 2026-11-01 | "integrates seamlessly with Jira Automations" (4 stars, 2026-02-05) | Reported |
| M-118 | https://marketplace.atlassian.com/apps/1211562/checklists-for-jira-enterprise-by-herocoders?reviewId=712020%3A35189487-90d5-4d77-818c-c7038b2b90b5 | 2026-11-01 | "add a serial number while creating a checklist?" (3 stars, 2025-04-23) | Reported |
| M-120 | https://www.g2.com/products/smart-checklist-for-jira/reviews | 2026-11-01 | HTTP 403 Forbidden | Reported (could not load) |
| M-130 | https://marketplace.atlassian.com/apps/1223660/checklist-for-jira-lite?reviewId=636cc70a6bbefce0aca3d81a | 2026-11-01 | "didn't receive a response" (4 stars, 2026-03-12) | Reported |
| M-131 | https://marketplace.atlassian.com/apps/1223660/checklist-for-jira-lite?reviewId=636391e2548f1fe6f0c81bb7 | 2026-11-01 | "had a problem not seeing the Global template page." (4 stars, 2025-12-19) | Reported |
| M-132 | https://marketplace.atlassian.com/apps/1223660/checklist-for-jira-lite?reviewId=712020%3Aea818f77-576e-4890-bdd5-d5f223601fa0 | 2026-11-01 | (no text; 2 stars, 2025-07-16) | Reported |
| M-140 | https://marketplace.atlassian.com/apps/1220026/multiple-checklists-for-jira?reviewId=5aa51c30881f8f24ac161bf6 | 2026-11-01 | "makes tracking Definition of Done items much clearer" (5 stars, Data Center, 2026-06-25) | Reported |
| M-141 | https://marketplace.atlassian.com/apps/1220026/multiple-checklists-for-jira?reviewId=5c5469d23e729341b3519b6e | 2026-11-01 | "to prevent a security issue our company was impacted by." (4 stars, 2024-04-03) | Reported (old) |
| M-142 | https://marketplace.atlassian.com/apps/1220026/multiple-checklists-for-jira?reviewId=5d7905b18ce6b60c3810e4b1 | 2026-11-01 | "Thanks for the support." (3 stars, 2024-04-03) | Reported (old) |
| N-01 | https://developer.atlassian.com/platform/forge/manifest-reference/modules/jira-workflow-validator/ | 2026-11-01 | "If a validator fails, the work item does not progress to the destination status of the transition, the transition's post functions are not executed, and the error message of the failed validator is shown." | Reported |
| N-02 | https://ecosystem.atlassian.net/browse/FRGE-710 | 2026-11-01 | "The transition failed because we couldn’t invoke “<Validator name>”. Try again and if the problem persists, contact Jira support." | Reported (2022) |
| N-03 | https://community.developer.atlassian.com/t/transition-error-transition-failed-because-we-couldnt-invoke-validator/56991 | 2026-11-01 | "the issue was that the validator took more then 10 second." | Reported (2022 to 2023, user) |
| N-04 | https://ecosystem.atlassian.net/browse/FRGE-1870 | 2026-11-01 | "Once in this new editor, it is possible to add more workflow validators" | Reported |
| N-05 | https://ecosystem.atlassian.net/browse/FRGE-2301 | 2026-11-01 | "There is no supported API to add the app's rule to a transition." | Reported (developer, 2026-10-15) |
| N-06 | https://ecosystem.atlassian.net/browse/FRGE-2198 | 2026-11-01 | "WorkflowValidators don’t invoke if the user is unlicensed." | Reported (developer) |
| N-07 | https://ecosystem.atlassian.net/browse/FRGE-1106 | 2026-11-01 | "Currently, the app has no possibility to validate if a site has an active license to the app" | Reported (2023) |
| N-08 | https://ecosystem.atlassian.net/browse/FRGE-1938 | 2026-11-01 | "transition: { from: { id: '10003' }, to: { id: '3' } }," | Reported |
| N-09 | https://community.developer.atlassian.com/t/workflow-validator-error-message-doesnt-show/70170 | 2026-11-01 | "when I drag the ticket error message doesn’t show." | Reported (2023, user) |
| N-10 | https://developer.atlassian.com/platform/forge/limits-invocation/ | 2026-11-01 | "Runtime seconds (also includes UI modules invoked by Forge Remote) 25 Maximum runtime permitted before the app is stopped." | Reported |
| N-11 | https://developer.atlassian.com/platform/forge/limits-kvs-ce/ | 2026-11-01 | "Value size 240 KiB Maximum size of a single persisted value (in RAW)" | Reported |
| N-12 | https://developer.atlassian.com/platform/forge/storage-reference/kvs-transactions/ | 2026-11-01 | "Each transaction can contain a maximum of 25 operations." | Reported |
| N-13 | https://developer.atlassian.com/platform/forge/storage-reference/kvs-api/ | 2026-11-01 | "FAIL_IF_EXISTS : if the key already exists, don't overwrite it." | Reported |
| N-14 | https://developer.atlassian.com/platform/forge/storage-reference/kvs-api-query/ | 2026-11-01 | "The query API returns up to 10 values by default, this can be increased to a maximum of 100." | Reported (page also says 20 in a code comment) |
| N-15 | https://developer.atlassian.com/platform/forge/storage-reference/kvs-batch/ | 2026-11-01 | "Each batch operation can contain a maximum of 25 keys." | Reported |
| N-16 | https://developer.atlassian.com/platform/forge/storage-reference/kvs/ | 2026-11-01 | "The kvs.query method used by the Key-Value Store is eventually consistent." | Reported |
| N-17 | https://developer.atlassian.com/platform/forge/storage-reference/kvs-migration-from-legacy/ | 2026-11-01 | "As of March 17, 2025 , we stopped applying feature updates to this module." | Reported |
| N-18 | https://developer.atlassian.com/cloud/jira/platform/rest/v3/api-group-workflows/ (OpenAPI: https://developer.atlassian.com/cloud/jira/platform/swagger-v3.v3.json, POST /rest/api/3/workflows/update) | 2026-11-01 | "*Administer projects* project permissions to create project-scoped workflows" | Reported |
| N-19 | Same OpenAPI file, GET /rest/api/3/workflows/capabilities | 2026-11-01 | "`ruleKey` Validator: `forge:expression-validator`, Condition: `forge:expression-condition`, and Post function: `forge:workflow-post-function`" | Reported |
| N-20 | https://developer.atlassian.com/cloud/jira/platform/rest/v3/api-group-permissions/ (OpenAPI GET /rest/api/3/mypermissions) | 2026-11-01 | "users may be shown as having an issue permission (such as EDIT\_ISSUES) in the global context or a project context but may not have the permission for any or all issues." | Reported |
| N-21 | https://developer.atlassian.com/cloud/jira/platform/rest/v3/api-group-issue-properties/ (OpenAPI PUT issue property) | 2026-11-01 | "The maximum length is 32768 characters." | Reported |
| N-22 | https://developer.atlassian.com/cloud/jira/platform/rate-limiting/ | 2026-11-01 | "Your app shares a single 65,000 point hourly quota across all tenants." | Reported |
| N-23 | https://developer.atlassian.com/platform/forge/apis-reference/fetch-api-product.requestjira/ | 2026-11-01 | "If your app has all the required permissions, the request will work regardless of who uses the app." | Reported |
| N-24 | https://developer.atlassian.com/platform/forge/runtime-reference/authorize-api/ | 2026-11-01 | "Forge Authorize API helps app developers verify user permissions before making requests using the asApp method." | Reported |
| N-25 | https://developer.atlassian.com/platform/forge/environments-and-versions/ | 2026-11-01 | "However, they are passed to your app's environment as clear text." | Reported |
| N-26 | https://developer.atlassian.com/platform/forge/cli-reference/variables-set/ | 2026-11-01 | "--encrypt encrypt variable (default: false)" | Reported |
| N-27 | https://developer.atlassian.com/platform/forge/licensing-overview/ | 2026-11-01 | "To enable standard billing, set licensing.enabled to true in your app manifest" | Reported |
| N-28 | https://developer.atlassian.com/platform/forge/runtime-reference/app-context-api/ | 2026-11-01 | "This field is only present for paid apps in the production environment." | Reported |
| N-29 | https://developer.atlassian.com/platform/forge/runs-on-atlassian/ | 2026-11-01 | "Partners do not need to apply or opt in to receive the badge." | Reported |
| N-30 | https://support.atlassian.com/jira-cloud-administration/docs/configure-advanced-issue-workflows/ | 2026-11-01 | "Separation of Duties condition Condition preventing a user to perform the transition, if the user has already performed a transition on the work item." | Reported |
| N-31 | https://support.atlassian.com/jira-software-cloud/docs/available-workflow-rules-in-team-managed-projects/ | 2026-11-01 | "Validate that people have a specific permission This rule looks at what permissions someone has before they’re allowed to use a specific transition." | Reported |
| N-32 | https://jira.atlassian.com/browse/JRACLOUD-87579 | 2026-11-01 | "This is now possible in team-managed workflows by using the \"validate a field\" rule and the \"isn't empty\" option." | Reported |
| N-33 | https://community.atlassian.com/forums/Jira-articles/Introducing-Action-items-in-Jira/ba-p/2876018 | 2026-11-01 | "They’ll live within the description, comment, and other rich text fields." | Reported (Atlassian PM, 2024-11-21) |
| N-34 | https://jira.atlassian.com/browse/JRACLOUD-47605 | 2026-11-01 | "We have rolled Action Items to 100% in Jira." | Reported |
| N-35 | https://jira.atlassian.com/browse/JRACLOUD-96783 | 2026-11-01 | "when triggered via automation, it behaves as if the content is merely copied and pasted" | Reported |
| N-36 | https://jira.atlassian.com/browse/JRACLOUD-94964 | 2026-11-01 | "Create a checklist field type on issues cards that allows users to create checklists on the issue." | Reported |
| N-37 | https://jira.atlassian.com/browse/JRACLOUD-94963 | 2026-11-01 | "The idea would be to let board managers add a short check list of those steps that would be displayed at the bottom of each column." | Reported |
| N-38 | https://jira.atlassian.com/browse/JRACLOUD-67128 | 2026-11-01 | "Cannot force the transition validator to validate more than one checkbox." | Reported |
| N-39 | https://jira.atlassian.com/browse/JRACLOUD-67451 | 2026-11-01 | "Having the ability to specify conditions and validators which trigger when the transitioning issue matches a JQL statement would be extremely powerful." | Reported |
| N-40 | https://jira.atlassian.com/browse/JRACLOUD-15297 | 2026-11-01 | Title: "Add Conditions, Validators, Post Functions to the Clone, Edit operations" | Reported |
| N-41 | https://jira.atlassian.com/browse/JRACLOUD-96097 | 2026-11-01 | "allow movement to be restricted or enabled based on the state of a custom field, such as whether a checklist is completed." | Reported |
| N-42 | https://jira.atlassian.com/browse/JRACLOUD-98211 | 2026-11-01 | "We moved to matching by status ID a few months ago" | Reported |
| N-43 | https://jira.atlassian.com/browse/JRACLOUD-98713 | 2026-11-01 | "the UI does not clearly distinguish between *OR* logic (any condition met) and *AND* logic (all conditions met)" | Reported |
| N-44 | https://jira.atlassian.com/browse/JSDCLOUD-6249 | 2026-11-01 | "by allowing user input would allow the user to select themselves as the approver." | Reported |
| N-45 | https://jira.atlassian.com/browse/JRACLOUD-72299 | 2026-11-01 | "it is not possible to create *custom error messages*." | Reported |
| N-46 | https://community.atlassian.com/forums/Jira-questions/Jira-automation-to-block-transition-to-done/qaq-p/2832652 | 2026-11-01 | "What you mentioned is not feasible with Jira Automation" | Reported (community answer, 2024-10-07) |
| N-47 | https://community.atlassian.com/forums/Jira-questions/Workflow-Validator-Help-Prevent-Transition-to-Completed-Based-on/qaq-p/3088425 | 2026-11-01 | "Ideally, a pop-up message or error should appear explaining what’s missing." | Reported (2025-08-13) |
| N-48 | https://community.atlassian.com/forums/Jira-questions/Restricting-Transition-to-Done-of-Epics-until-all-child-issues/qaq-p/3145526 | 2026-11-01 | "Suggestions? Is this a known deficit on Epics?" | Reported (2025-11-12) |
| N-49 | https://community.atlassian.com/forums/Jira-questions/new-Checklist-feature-in-the-right-pane-of-all-issue-types-Team/qaq-p/3094421 | 2026-11-01 | "The checklist is coming from the app Checklist for Jira, it is not a native feature in Jira." | Reported (2025-08-21) |
| N-51 | https://marketplace.atlassian.com/rest/2/addons/com.innovalog.jmwe.jira-misc-workflow-extensions and .../pricing/cloud/live | 2026-11-01 | "totalInstalls":16338 ; "editionDescription": "50 users" ... "amount": 1000.0 ... "monthsValid": 12 | Reported |
| N-52 | https://marketplace.atlassian.com/rest/2/addons/com.onresolve.jira.groovy.groovyrunner and .../pricing/cloud/live | 2026-11-01 | "totalInstalls":34250 ; "editionDescription": "50 users" ... "amount": 1335.0 ... "monthsValid": 12 | Reported |
| N-53 | https://appfire.atlassian.net/wiki/spaces/JMWEC/pages/465372968/Includes+Feature+Comparison | 2026-11-01 | "Originally supported by JMWE for Jira Data Center but currently maintained by Atlassian on Jira Cloud." | Reported (vendor) |
| N-54 | https://docs.adaptavist.com/sr4jc/latest/features/workflow-rules/ | 2026-11-01 | "Validate Details - check to make sure that a requirement is met when a user tries to transition a work item." | Reported (vendor) |
| N-55 | https://docs.adaptavist.com/sr4jc/latest/features/workflow-rules/validate-details/ | 2026-11-01 | "It is not possible to use the REST API." | Reported (vendor) |
| N-56 | https://raw.githubusercontent.com/usnistgov/oscal-content/main/nist.gov/SP800-53/rev5/json/NIST_SP-800-53_rev5_catalog.json | 2026-11-01 | "Test, validate, and document changes to the system before finalizing the implementation of the changes." | Reported (primary) |
| N-57 | https://www.cyberday.ai/requirement/soc-2-cc8-1-change-management-procedures | 2026-11-01 | "The entity authorizes, designs, develops or acquires, configures, documents, tests, approves, and implements changes to infrastructure, data, software, and procedures to meet its objectives." | Reported (secondary) |
| N-58 | https://www.isms.online/iso-27001/annex-a-2022/5-3-segregation-of-duties-2022/ | 2026-11-01 | "This reduces the risk of fraud and error and bypasses information security controls." | Reported (secondary vendor) |
| N-59 | https://www.upguard.com/compliance/iso-27001/8-32.md | 2026-11-01 | "requires organizations to subject all changes to information processing facilities and systems to a formal Change Management (CM) process" | Reported (secondary vendor) |
| N-60 | https://www.aicpa-cima.com/resources/download/2017-trust-services-criteria-with-revised-points-of-focus-2022 | 2026-11-01 | No criterion text returned to anonymous GET | Considered and excluded (registration gate) |
| N-61 | https://jira.atlassian.com/browse/JRACLOUD-72370 | 2026-11-01 | "If the user name of the user is different from its user key in the database, the *separation of duties* condition will be ignored." | Reported (historical, fixed 2020) |
| N-62 | https://jira.atlassian.com/browse/JRACLOUD-87561 | 2026-11-01 | "a user should know the reason for a warning message ”you dont have this permission to transition the issue”" | Reported |
| N-63 | https://community.atlassian.com/forums/Jira-questions/Want-a-validator-for-an-Epic-to-transition-to-Done-only-if-all/qaq-p/3006214 | 2026-11-01 | "We Want a validator for an Epic to transition to Done only if all children are Done or Canceled." | Reported (2025-04-24) |
| N-64 | https://community.atlassian.com/forums/Jira-questions/Is-it-possible-to-use-checklist-to-prevent-transition-and-warn/qaq-p/2174998 | 2026-11-01 | "I woke up with idea of using a checklist field to be used to prevent a transition, if one of the checkboxes is not checked." | Reported (2022-10-27) |
| R-01 | https://marketplace.atlassian.com/rest/2/addons?text=sign-off%20approval&hosting=cloud&application=jira&limit=15 | 2026-11-01 | "Approval Flow: Required Sign-Offs for Jira" tagLine "Approval workflow with multi-approver sign-offs that block the transition: stages, groups, separation of duties, audit trail", totalInstalls 1 | Reported |
| R-02 | same as R-01 | 2026-11-01 | "Herzum Approval" totalInstalls 302; "Group Sign-Off: parallel Multi-Approvals" totalInstalls 204; "Business Sign-off & Approval for Jira" totalInstalls 6; 369 results for the query | Reported |
| R-03 | https://marketplace.atlassian.com/apps/2984911119/definition-of-done-ready-for-jira | 2026-11-01 | "blocks the move until mandatory items are complete"; installs 4; version 4.4.0, Jul 23rd 2026; "Built zero-egress on Forge" | Reported (page text via fetch summary) |
| R-04 | https://marketplace.atlassian.com/apps/1071447603/business-sign-off-approval-for-jira | 2026-11-01 | "Export to CSV for SOC 2, SOX, and ITGC audits."; installs 6 | Reported (page text via fetch summary) |
| R-05 | apps/definitionguard/node_modules/@forge/kvs/out/interfaces/transaction.d.ts (version 2.1.1) | 2026-11-01 | "check<T>(key: string, entity: EntityRequiredConditions<T>): this;" and in types.d.ts "keyPolicy: 'OVERRIDE' \| 'FAIL_IF_EXISTS';" | Observed-code |
| R-06 | apps/definitionguard/node_modules/@forge/react/out/components/ui-kit-components.d.ts (version 12.4.0) | 2026-11-01 | "export declare const User" | Observed-code |
