# FourRealities: merge review

Two rounds. Round 2 (section R2, below) is the current verdict. Round 1 follows it unchanged, as written.

## R2. Round 2 (2026-11-06): Merge

- Branch head `025a148` (fixes in `b82e2f8`, master merged in `25b8730`). Master before the merge: `42e79fa` (LedgerSeal `57c0b5b` is on master).
- Merge: `git merge --no-ff origin/feature/fourrealities-marketplace-fixes` onto `42e79fa`. No conflicts. Besides `apps/fourrealities/**`, its ADRs, docs and assets, the merge changes only the FourRealities lines of `site/faq.md`, `site/index.md`, `site/quickstart.md` and `site/permissions-standard.md`. The merge tree `2d46ce0` is the same tree as the gated trial merge.
- **Verdict: Merge.** There is no Critical or High finding. H-1 and M-1 are fixed. Three new Medium and Low findings are listed below for the fixing session.

### R2.1 Round 1 findings

| Finding | Status | Evidence |
|---|---|---|
| H-1 forged unsigned record raises the score | **Fixed** | Probe `probes/forged-unsigned-r2.test.ts`, run with the real snapshot manager and the dashboard summary. Done issues, with no record vs a forged unsigned DG "complete" record plus an LS `SEAL_VALID`: issue RAI 33 vs 33 (CRITICAL for both), Process and Audit MISSING for both. Dashboard average RAI 33 vs 33, "Audit readiness: Incomplete" for both. In-progress issues: 100 vs 100, NOT_APPLICABLE for both. Mutations: putting REPORTED back fails 14 tests; dropping the before-Done rule fails 5. |
| M-1 rollback | **Fixed** | Probe `probes/rollback-r2.test.ts` through `DefaultSnapshotManager` with shared storage. Build 1 reads a signed LS `SEAL_BROKEN` issued at 10:00. Build 2 reads a signed `SEAL_VALID` issued at 09:00 (the replay): Audit is MISSING, `SEAL_SIGNATURE_INVALID`, "older than a record already seen". Mutation that turns off the rollback check in the gate engine: 2 tests fail. See N-3 for the managers' wiring. |
| M-2 production keys | Open (owner action) | Not a code fix. The listing and admin guide now say that a check turned on by hand in production is "Evidence missing" on every Done issue until the keys exist. |
| L-1 group by name | **Fixed** | Groups are matched by id only. Mutation that puts name matching back: 1 test fails. |
| L-2 Confluence link vs page | **Fixed** | A global id and a URL that name different pages give no page id. A verified page must also be on this site. Each mutation: 1 test fails. |
| L-3 name in stored rows | **Fixed** | The round 1 mutation that survived now fails 2 tests. |
| L-4 chunkCount in the first response | Open (accepted, Low, cosmetic) | |
| L-5 names after the deadline | **Fixed** | Names are read only while `Date.now() < deadline - 1 s`. Mutation: 1 test fails. |

### R2.2 New findings (for the fixing session; none blocks the merge)

- **Medium, N-1. First build writes one KVS key per verified issue inside the page view.** Plausible; the timing was not run live. Where: `src/manager/default-snapshot-manager.ts:425-428` (the `history.raise` loop: sequential, before `saveSnapshot`, with no deadline). Evidence: probe `rollback-r2.test.ts` counts **2,000 `fr:att:` writes** for a first build of 2,000 sealed issues. At 10 to 50 ms per KVS write, a first view or Refresh of a large project whose records are verified can pass the 25 s Forge limit. That is the F-H2 problem again, with a new cause. It heals itself: each attempt keeps its writes, and the daily run (600 s) also writes them. Today it only happens in development and staging, because production trusts no key yet. Fix: stop the loop at the deadline, or move it after `saveSnapshot` and leave the rest to the scheduled run.
- **Medium, N-2. A DefinitionGuard state that starts again is treated as a rollback forever.** Confirmed by the probe. Where: `src/engine/default-gate-engine.ts` `isOlder` (it compares `stateVersion` first). Scenario: DefinitionGuard is uninstalled and installed again (Forge deletes its storage, so its state numbers start again), or an issue's DoD state is recreated. A genuine new record has `stateVersion` 1 and a later `issuedAt`. It still counts as MISSING with "older than a record already seen", on every such issue and with no way to reset. Probe: history `stateVersion` 7 (issued 2026-11-06), then a new record with `stateVersion` 1 issued 2026-11-07, gives Process MISSING `DOD_SIGNATURE_INVALID`. Fix: treat a record as a rollback only when its `issuedAt` is also older. A put-back record always has an older `issuedAt`.
- **Low, N-3. The managers' history wiring has no test.** Mutations that drop `history.raise` in `DefaultSnapshotManager` or in `DefaultIssueEvidenceManager` pass all 540 tests. My manager-level probe (M-1 above) shows the wiring works today. Add a manager test like that probe.
- **Low, N-4. One listing line is not exact.** `fourrealities-listing.md`, row "Signed Records Are Verified": it says that a record "changed after signing" or "copied from another issue" "counts exactly like no record". In code those two are MISSING even before Done (`DOD_SIGNATURE_INVALID`, `SEAL_SIGNATURE_INVALID`), while no record is not applicable before Done. The error is safe for buyers (it can only lower the score), but the sentence should name only unsigned, unknown-key and older records.

### R2.3 Gate on the merge result (tree `2d46ce0`)

| Step | Result |
|---|---|
| `npm ci` (UI package, then app) | 0, 0 |
| `tsc --noEmit` | 0 |
| `npm test -- --coverage` | 45 of 45 suites, 540 of 540 tests; 99.36% statements, 96.39% branches, 99.18% functions, 99.79% lines; every per-file threshold met |
| `npm run build` | 0 |
| `npm audit --omit=dev --audit-level=high` | exit 0 (7 moderate) on the merge commit. On the trial tree the first run hit a registry "socket hang up" (exit 1, not a finding); the rerun gave exit 0. |
| `forge lint` | "No issues found." |
| `git status --porcelain` | empty |
| Apps CI on the branch head `025a148` | run 42197644006, success |

Logs: `/home/fahimfarookme/Documents/projects/jira-governance/.tmp/cache/merge-review/fourrealities/logs/gate-trial2.log`, `gate-merge.log`, `mutations-r2.log`.

### R2.4 After the merge

- Separate commit: `"fourrealities"` added to the dependency audit list in `.github/workflows/apps-ci.yml`, so all four apps are audited.
- Live checks: none run by this review. The fixing session reports a development deploy 5.1.0 and a live H-1 check on PAY-4 (`test/live/live_h1_check.py`); I did not repeat it.

# Round 1 (superseded)

- Date: 2026-11-06. Reviewer: independent merge review session (brief: `docs/sdlc/cascadeplan-marketplace-review-2026-11/merge-review-prompt.md` on `origin/master`).
- Branch: `feature/fourrealities-marketplace-fixes`, head `2badcb4`. Merge base with master: `7f87747`. `git log master..branch` = 9 commits (`4284717` to `2badcb4`); the old CascadePlan commits from the base are already on master.
- Master at review: `8666cad` (CascadePlan `e1b0192`, DefinitionGuard `32e86ca`, CI `8666cad`). `git merge-base --is-ancestor origin/feature/ledgerseal-marketplace-fixes origin/master` = 1: LedgerSeal (`6b6e996`) is NOT on master yet.
- Clone: `/home/fahimfarookme/Documents/projects/jira-governance/.tmp/cache/merge-review/fourrealities/checkout`. Trial merge (master, then LedgerSeal `6b6e996`, then this branch): worktree `/home/fahimfarookme/Documents/projects/jira-governance/.tmp/cache/merge-review/fourrealities/trial`, local branch `trial`, never pushed.
- Logs: `.../fourrealities/logs/gate-branch.log`, `gate-trial.log`, `ls-audit.log`, `mutations.log`. Probe: `.../fourrealities/probes/forged-unsigned.test.ts`.

## 1. Verdict

**Do not merge.** One High finding: an unsigned, hand-written DefinitionGuard or LedgerSeal property still raises the RAI and can turn "Audit readiness" to Complete (H-1). That is the readiness review's F-H1, which the fix log, ADR-012 and the listing say is fixed. Everything else checked is sound: the trial merge onto master plus LedgerSeal is clean and touches only FourRealities files, the contract test passes against the real schema 3 writers of DefinitionGuard (master) and LedgerSeal (its branch), and the full gate is green. Merging would also have to wait for LedgerSeal to reach master. Nothing was committed or pushed, and the CI audit list was not changed.

## 2. Findings

### Critical

None.

### High

**H-1. A forged, unsigned sibling property still raises the score (F-H1 not fixed).** Confirmed by a probe.
- Where: `apps/fourrealities/src/engine/default-gate-engine.ts:137-151` (`trustOf`, `stated`: an unsigned record or one with an unknown key becomes `REPORTED`); `src/engine/default-metrics-engine.ts:30` (only FOUND and MISSING are scored); `src/ui/pipeline.ts:184` (Complete when every scored gate is evidenced).
- Scenario: Process = DefinitionGuard and Audit = LedgerSeal are in use (chosen by an admin, or detected). A Done issue has a Confluence decision page and no DoD record and no seal. Process and Audit are MISSING, so RAI = 33, CRITICAL. Any user with Edit issues can then `PUT /rest/api/3/issue/{id}/properties/definitionguard-dod` with `{isFullySatisfied:true, mandatoryCompleted:1, mandatoryTotal:1, headHash:"aaa..."}`, and also `ledgerseal-cert` with any well-formed `SEAL_VALID` body. Both records have no `sig`, so both become REPORTED and drop out of the denominator. The RAI becomes 100, LOW. If this is done on every rated issue, the dashboard shows "Audit readiness: Complete" (with a "reported" note). The same thing happens with a record that is verified but says "open items" or "broken seal" (MISSING): replacing it with an unsigned "complete" record removes that MISSING.
- Evidence: probe `probes/forged-unsigned.test.ts`, run against the branch code with the development keys: `NO RECORDS {"rai":33,"risk":"CRITICAL","p":"MISSING","a":"MISSING"}`, `FORGED UNSIGNED {"rai":100,"risk":"LOW","p":"REPORTED","a":"REPORTED"}`.
- The claims are wrong: the fix log D2 says "a forged record must not move the score" (`progress-log.md:20`), and ADR-012 Consequences says "A hand-written property no longer raises the RAI (F-H1)" (`adr-00012...org:84`). The listing highlight "anything else is shown as reported and not scored" is literally true, but buyers will read it as "a forgery cannot help".
- Fix (suggested, for the fixing session): when the check is in use, score an unverified record the same as no record. On a Done issue that is MISSING (the reason can stay "reported, not verified" in the text). Before Done, it is NOT_APPLICABLE as now. A Checklists for Jira source chosen by an admin can stay REPORTED-not-scored only if the listing says that a forged checklist raises the score, or it can follow the same rule. Add a test: no record vs unsigned "complete" record gives the same RAI. Then correct ADR-012 decision 4 and Consequences, spec v3, the listing and the guides. The production consequence also needs one line: until production keys exist, a check that an admin turns on by hand is MISSING on every Done issue.

### Medium

**M-1. An older signed record of the same issue can be put back (replay).** FourRealities side confirmed; whether it can be exploited live depends on whether the producer rewrites the property again. Not run live.
- Where: `default-gate-engine.ts:224-247` (Audit), `:161-176` (Process); ADR-012 decision 5 removed the `issuedAt` vs `updated` comparison (F-M3).
- Scenario: an issue is sealed, so LedgerSeal writes a signed `SEAL_VALID` record. Its JSON can be read by anyone who can browse the issue. Later the sealed content changes, and LedgerSeal writes a signed `SEAL_BROKEN` record. A user with Edit issues PUTs the old `SEAL_VALID` JSON back. The signature and `issueId` are valid, so Audit becomes FOUND (verified). DefinitionGuard has the same gap: an old "complete" record can replace a newer "open items" record. A property write does not change the issue's `updated` time, and FourRealities no longer compares times anyway. ADR-012 does not discuss replay.
- Fix: keep, per issue, the latest `issuedAt` (or DefinitionGuard `stateVersion`) seen for each producer in the snapshot row. Treat a record older than that as invalid (MISSING, "older than a record already seen"). Also say in ADR-012 that the check verifies who wrote the record, not that the record is the latest one.

**M-2. Production: Process and Audit cannot be scored until production keys are added (owner action before release).** `src/accessor/attestation-keys.ts` holds only the development keys `dg-dev-2026-11` and `ls-dev-2026-11`. Production trusts no key (ADR-012 decision 3), so "Detect" never turns these checks on in production. The listing says this honestly ("Works with, and works alone"), so it is not a false claim. But a paid app ships with two of its four checks inactive until the owner does "Owner commands" step 2 in the fix log, after DefinitionGuard (`dg-prod-2026-11`) and LedgerSeal (`ls-prod-2026-11`) make their keys. Not a merge blocker. It is a release blocker the owner must schedule.

### Low

- **L-1.** `src/manager/default-exception-manager.ts:212`: the Tier 2 check matches a group by id or by name. If the configured group is deleted and a new group is created with the same name, its members become approvers. Match by `groupId` only, and use the name only for a policy saved without an id.
- **L-2.** `src/accessor/default-forge-confluence-search-accessor.ts:94` and `issue-facts.ts:75-80`: "verified" means the page id from `globalId` or the URL exists on this site. A user can create a remote link with `application.type` Confluence, a `globalId` that names a real page id, and a URL to another page or another host. Intent then shows "FourRealities found the page". Check that the URL host is this site, or show the page that was found instead of the link's URL.
- **L-3.** Mutation `names-stored` survived (`logs/mutations.log`): no test fails if `buildRow` puts an assignee display name back into stored rows. The type no longer has the field, so this guards against future changes only. Add an assertion that stored chunks contain no `assigneeName`.
- **L-4.** `src/manager/default-snapshot-manager.ts:105`: the `meta` returned to the first view has `chunkCount` computed from the 100-row hint. The stored meta has the real count after the byte split, so this is only a cosmetic difference in the response.
- **L-5.** `default-snapshot-manager.ts` `view()`: `directory.userNames` and the second `siteConfig.get()` run after the viewer check without a deadline check. These are few calls (50 ids per call), so this is very unlikely to pass 25 s. Add `Date.now() < deadline` before the names.

## 3. Focus checks

| Check | Result | Evidence |
|---|---|---|
| Schema 3 records and signatures, real writers | Pass | Trial merge (master DG schema 3 with no `lastModifiedByAccountId`; LS branch schema 3 with no `sealedByAccountId`, string `everCompromised`, `SEAL_REVOKED`): `test/contract/sibling-attestations.test.ts` 9 of 9 inside the 528. The canonical JSON is the same in all three apps (sorted keys, `undefined` left out, `JSON.stringify` for leaves). FR's bundled PEMs are byte-equal to `docs/marketplace/definitionguard-public-key.pem` and `apps/ledgerseal/keys/ls-dev-2026-11.pub.pem`. An unknown environment means production (no keys). |
| Scoring of unverified records | **Fail** | H-1 |
| "In use / Not used on this site" admin page and detection | Pass | `fourrealities-admin` page with title "FourRealities gate authority". All four admin resolvers check global ADMINISTER as the user and fail closed (`default-admin-manager.ts`). Detect needs a VERIFIED record (`default-source-policy-engine.ts:68`) or PR data. Screenshot `05-admin.png` matches the code. |
| Personal data report and erasure | Pass | Weekly trigger `fourrealities-personal-data` (600 s) and scope `report:personal-data`. Ids are collected from `fr:ex:*`, `fr:note:*`, `fr:issue:*:exception`, the per-project `accounts` index and old rows. `@forge/api` sends 90 ids per call. Closed ids are replaced by `erased-account` and dropped from rows; old metas are minimised; the projection is rewritten as the app. Rows store no name, exception or note. |
| 20 s deadline | Pass | `RESOLVER_LINK_BUDGET_MS = 20_000`, one deadline per invocation set in `compose()`. The build stops at deadline minus 7 s; the viewer check stops at deadline minus 1 s and also stops once every snapshot id has been seen. See L-5. |
| Confluence verification | Pass (L-2) | VERIFIED only when the page id is returned (as the app in the snapshot, as the user in the panel). Otherwise LINK_ONLY "Evidence found (link only)". A refusal names both causes. |
| Chunk size cap | Pass | At most 100 rows and 200,000 bytes per chunk (`default-kvs-snapshot-accessor.ts:30-46`); stored text is cut to 120 characters, with at most 5 sprints of 60 characters. |
| Listing, notes, README, guides vs code | Pass except H-1 wording | Scopes match the manifest (7). "My issues", "Save evidence sources", "Search Confluence...", "a former user" and the panel names all exist in code. No admin-policy or sibling-button claims beyond the code. The production-key limit is stated. |
| Screenshots | Pass | Five PNGs at 1840 x 900, banner 1120 x 548, highlights 580 x 330. Viewed 01, 02 and 05: real app UI on PAY, no Jira chrome. Their content matches the code (Code "Not used", detection lines). |
| Prices | Pass | $1.40 / $14.00, $1.10 / $11.00, $0.80 / $8.00, free up to 10 users, custom above 1,000; checked by `test/listing.test.ts:29-31`. |
| ADR numbers | Pass | Trial tree: 00010 DefinitionGuard, 00011 LedgerSeal, 00012 to 00014 FourRealities. No duplicates; FR code and tests cite only 012 to 014. |
| Merge scope | Pass | Clean `ort` merge onto master plus LedgerSeal. It changes only `apps/fourrealities/**`, FR ADRs, FR docs and assets, and the FR lines in `site/faq.md`, `site/index.md`, `site/quickstart.md`, `site/permissions-standard.md`. No other app's code is touched and there are no conflicts. |
| Headers and dashes | Pass | Every new `.ts`, `.tsx` and `.py` file has the copyright line and `@author Fahim Farook`. The only dash characters are inside the two dash-check regexes (`test/listing.test.ts:64`, `test/frontend/accessibility.test.tsx:23`). |

## 4. Tests fail without each fix (mutation runs, `logs/mutations.log`)

Each change was applied to the branch source, the named tests were run, and the source was restored (the clone is clean afterwards).

| Mutation | Result |
|---|---|
| Verifier always returns VERIFIED | 2 fail |
| Wrong-issue check removed | 2 fail |
| DG schema 2/3 parsing removed | 5 of 9 contract tests fail |
| Production trusts development keys | 2 fail |
| REPORTED scored | 1 fail |
| "Not in use" ignored for Process | 3 fail |
| Detection from an unverified record | 1 fail (full suite) |
| Admin check removed from save | 2 fail |
| Erasure skipped | 3 fail |
| Report call skipped | 5 fail |
| Name stored in rows | **0 fail (L-3)** |
| Chunk byte cap removed | 1 fail |
| View reserve removed | 1 fail |
| Viewer-id early stop removed | 2 fail |
| Confluence page check bypassed | 3 fail |
| Old refusal message | 1 fail |
| Tier 2 group check removed | 1 fail |
| Decision projection written as user | 1 fail |
| `issuedAt` vs `updated` freshness put back | 1 fail |

## 5. Gate

Node v26 and npm 11 on the host; forge CLI 15.0.0 with an isolated HOME.

| Step | Branch head `2badcb4` | Trial merge (master + LS `6b6e996` + FR) |
|---|---|---|
| `npm ci` (UI package, then app) | 0, 0 | 0, 0 |
| `tsc --noEmit` | 0 | 0 |
| `npm test -- --coverage` | 44 of 44 suites, 528 of 528 tests; 99.45% statements, 96.56% branches, 99.16% functions, 99.79% lines; every per-file threshold met | same: 528 of 528, same coverage |
| `npm run build` | 0 | 0 |
| `npm audit --omit=dev --audit-level=high` | exit 0 (7 moderate) | exit 0 (7 moderate); LedgerSeal app: exit 0 |
| `forge lint` | "No issues found." | "No issues found." |
| `git status --porcelain` | empty | empty |
| Apps CI on the branch head (run 42193896875) | fourrealities and cascadeplan jobs green. The definitionguard and ledgerseal jobs fail only at Forge lint "0 errors, 0 warnings, 1 approval", because the branch still has the old CI step and the old app code from `7f87747`. On master, CI `78247e3` already accepts approval-only lint results. | not run (not pushed) |

## 6. Fix-log entries not confirmed

- **BL-1, F-H1 "a forged record must not move the score"**: refuted (H-1). The other parts of this entry (shapes, signature check, keys per environment, F-M3, F-L5) are confirmed.
- **Live checks** (deploys 4.1.0 and 5.0.0 to development; live verification of PAY and DEMO records; the screenshots run): not repeated. No live check was needed for the findings above. The screenshots match the code.
- **BL-3 first weekly run**: not observed by the fixing session; not run here either. The code path is covered by tests.
- **F-H3 Jira-only install** and **F-H2 timing on 2,000 issues**: not tested, as the fix log says.

## 7. Not done, and why

- No merge, no push, no commit on master: one High finding remains, and LedgerSeal is not on master yet.
- The CI dependency audit list in `.github/workflows/apps-ci.yml` was not changed. That edit belongs to the merge series. For that later merge: the FourRealities audit exits 0 (branch and trial), and the LedgerSeal audit exits 0 in the trial tree.
- No live change, deploy or Marketplace change.
