# DefinitionGuard Marketplace fixes: progress log

Branch `feature/definitionguard-marketplace-fixes`, from `7f87747`, in the worktree `/home/fahimfarookme/.cache/jira-suite-fixes/definitionguard`. The review is `docs/sdlc/suite-readiness-review-2026-11/definitionguard-readiness.md` (blockers BL-1 to BL-7, findings H-1 to H-3, M-1 to M-8, L-1 to L-8). One entry per fix, in the order built, with the commit and the proof.

Owner instruction (2026-11-06): "do NOW". The recommendations of the review are adopted without further questions; each adopted decision is recorded below as "[ADOPTED: owner instruction 'do NOW', 2026-11-06]".

Baseline at `7f87747` (clean install of `packages/asymm-jira-ui`, then the app): `tsc --noEmit` exit 0; 28 suites, 347 tests passed; coverage statements 99.16%, branches 96.28%, functions 97.23%, lines 99.17%.

## 2026-11-06

### BL-5. No high or critical advisories in the production dependencies (and L-7 test headers)

- **Decision:** [ADOPTED: owner instruction 'do NOW', 2026-11-06] the same `overrides` entry as CascadePlan.
- **What changed:**
  - `apps/definitionguard/package.json`: `"overrides": { "prosemirror-view": "^1.42.3" }`; `package-lock.json` regenerated with `npm install` (only `prosemirror-view` 1.41.5 to 1.42.9 and its nested `prosemirror-model` 1.25.12 changed).
  - `test/hygiene.test.ts`: new test "(BL-5) pins prosemirror-view ...", and the header test now covers `test/` as well as `src/` (L-7). `test/domain/checklist-engine.test.ts` and `test/domain/hasher.test.ts` got the Asymm Systems header.
- **Proof:**
  - Before: `npm audit --omit=dev --audit-level=high` "13 vulnerabilities (5 moderate, 8 high)", exit 1 (review section 8).
  - After: `npm audit --omit=dev --audit-level=high` exit 0, "7 moderate severity vulnerabilities" (glob and minimatch through `@forge/manifest`; the only offered fix is a breaking downgrade of `@forge/bridge`, so they stay). `npm ls prosemirror-view`: every copy is 1.42.9.
  - `rm -rf node_modules && npm ci`: exit 0. Full suite: 28 suites, 348 tests passed.
- **Left for the main session:** the CI audit step runs only for CascadePlan (`.github/workflows/apps-ci.yml`, `if: matrix.app == 'cascadeplan'`). This session does not edit that file. Change needed: drop the `if:` line of the step "Dependency audit (production, high and critical)" and use `working-directory: apps/${{ matrix.app }}`.

### BL-4 and H-3. An inactive licence turns the gate off instead of blocking all work

- **Decision:** [ADOPTED: owner instruction 'do NOW', 2026-11-06] review section 6: with an inactive licence the validator returns `result: true`; the panel and the settings page show a notice; writes stay refused and reads stay allowed; errors on a licensed site still block (fail closed). The licence is read from the call context, else from the Forge runtime (`getAppContext().license`), so the validator sees it even if Forge does not pass it in the function's second argument (H-3).
- **What changed:**
  - `src/security/licence.ts`: `licenceOf(context)` (call context first, then `getAppContext()`, nothing outside the Forge runtime); `isLicenceInactive` understands `isActive` and the older `active`; new text `LICENCE_GATE_OFF`; `VALIDATOR_LICENCE_INACTIVE` removed.
  - `src/index.ts`: the validator returns `{ result: true }` for an inactive licence, before any read, and logs one line; `getIssueChecklist` adds `licenceInactive: true`.
  - `src/settings/settings-resolvers.ts`: `getSettings` adds `licenceNotice`.
  - `src/ui/panel-view-model.ts`: `licenceNotice` in the view model. `src/frontend/index.tsx` and `src/frontend/settings.tsx`: a warning "Licence not active" with that text.
- **Proof:** `test/security/licence.test.ts` (11 tests): "(BL-4) the validator lets every move through when the licence is inactive, complete or not, and writes nothing" (no Jira call, no write); "(BL-4) still blocks an incomplete move when the licence is active or absent"; "(H-3) reads the licence from the Forge app context when the call context has none" (validator passes, toggle refused); "(H-3) the call context wins ..."; "(H-3) outside the Forge runtime ..."; "(BL-4) the panel and the settings page say the gate is off ...". The old test "(V-a, V-b) the validator blocks with a licence message" asserted the old rule and was replaced. Full suite 353 passed; `licence.ts` 100% branches; `tsc` exit 0.
- **Live:** licence states can only be set on a development install with `forge install --upgrade --license inactive`, which changes the installation on the shared site; see "Live checks" below for what was run.

### Price. Owner pricing decision for DefinitionGuard (2026-11-06)

- **Decision (owner, through the coordinator, 2026-11-06, final):** free for 1 to 10 users; $0.95 per user per month for 11 to 100 users; $0.75 for 101 to 250; $0.24 for 251 to 1,000; custom above 1,000. Reason: a few cents below the dearest of the three leading paid checklist apps (HeroCoders Enterprise $1.00 / $0.80 / $0.25; `docs/sdlc/suite-readiness-review-2026-11/pricing-research.md` section B5).
- **What changed:** `docs/marketplace/definitionguard-listing-v2.md` pricing table (annual = 10 times monthly: $9.50, $7.50, $2.40; a "More than 1,000 Users: Custom price" row); `docs/sdlc/definitionguard-usp-ux-research-2026-11/handover-gemini.md` line 101 (it said $1.00). The submission notes state no price. `research-brief.md` keeps its 2026-11-01 research figures (a dated record of competitor prices, not a statement of our price). The superseded `docs/marketplace/definitionguard-listing.md` ($1.00 / $0.80 / $0.40) is deleted with BL-6.
- **Proof:** new test in `test/listing.test.ts`: "states the owner prices of 2026-11-06 ..." (each row, and none of $1.50, $1.20, $0.90, $1.00, $0.80, $0.40 anywhere in the listing). 7 of 7 listing tests pass.
- **Shared file not edited (main session):** `docs/marketplace/submission/developer-console-checklist.md` step 2.3 gives one price for all four apps ($1.50 / $1.20 / $0.90). It needs a DefinitionGuard line: "DefinitionGuard: 11 to 100 users $0.95 ($9.50 per year), 101 to 250 $0.75 ($7.50), 251 to 1,000 $0.24 ($2.40), 1,001+ custom."

### BL-1. Personal data: pseudonyms in the hashed history, weekly report, erasure (ADR-010)

- **Decision:** [ADOPTED: owner instruction 'do NOW', 2026-11-06] `architecture/decision/adr-00010-definitionguard-personal-data-pseudonyms.org`: a random per-site pseudonym (`dgp-` and 128 random bits) in every stored record; the link to the account id only in `dg:pty:<accountId>` and `dg:pid:<pseudonym>`; erasure deletes those two keys; a `Redact` event for records written before; no account id in the signed issue property (schema 3).
- **What changed:**
  - New `src/storage/party-store.ts` (`PartyStore`: `pseudonymFor`, `lookupPseudonym`, `idsOf`, `show`, `accountsOf`, `all`, `erase`).
  - New `src/privacy/personal-data.ts`: `reportPersonalData` (continues the one-time pass, then `privacy.reportPersonalData`, then erases each closed account), `migrateLegacyPersonalData` (phases v1, issues, templates, projects, policy; pages of 20; stops with 15 s left; place kept in `dg:pd:migration`), `pseudonymiseIssue` (Redact events first, then the rewritten events, then the state cache rebuilt from the events, then the property written again), `personalDataTrigger` (logs counts only).
  - `src/domain/event-log.ts` and `models.ts`: transition `Redact` with `Redaction` rows `{ seq, originalHash, redactedHash }`, at most 50 per event; `verifyChain` accepts a rewritten event only when a later Redact row names both hashes.
  - `src/index.ts`, `settings-resolvers.ts`, `policy-admin.ts`, `project-config.ts`: every write stores the pseudonym (`updatedByAccountId` became `updatedByPartyId`); the panel response, the history and the export resolve pseudonyms back to account ids (export format 2 adds `parties`); an erased person shows as "A deleted user", the app as "DefinitionGuard". The validator compares with the assignee's account id and pseudonym, read only.
  - `src/integrity/attestation.ts`: property schema 3 without `lastModifiedByAccountId` (shape in the final section).
  - `manifest.yml`: scope `report:personal-data`; `scheduledTrigger` `personal-data-report` (`interval: week`) on function `personal-data-fn` (`index.personalDataTrigger`). Listing v2 scope list updated.
  - `StorageProvider.listByPrefix` also returns the keys (the pass needs them).
- **Proof:** new `test/storage/party-store.test.ts` (9 tests) and `test/privacy/personal-data.test.ts` (18 tests), among them "reports every recorded account with its updatedAt, and erases the closed ones" (the account id is then stored nowhere), "keeps the history check intact after erasure, and the panel shows 'A deleted user'", "rewrites a history to pseudonyms with a Redact event, and the history check still passes", "erasing a rewritten account after the pass keeps the chain intact", "a rewritten event that is changed again, or a Redact row for a later event, fails the check", "migrates a v1 record, removes its display names, and deletes it", "replaces the account id in templates, project settings and the approver policy", "stops while time is short, keeps its place, and continues in the next run", "the trigger logs counts only and never throws". Updated tests assert the pseudonym and that the account id is stored nowhere outside the two map keys (`storedOutsideMap`). `test/manifest.test.ts`: "(BL-1, ADR-010) declares report:personal-data and a weekly trigger". Full suite 383 passed; thresholds met (`personal-data.ts` 96.55% branches, `party-store.ts` 94.73%, `index.ts` 90.69%); `tsc` exit 0.
- **Not changed:** the FourRealities fields of the property keep their names (`mandatoryTotal`, `mandatoryCompleted`, `isFullySatisfied`, `headHash`). `docs/spec/definitionguard-spec-v3.md` stays as approved; ADR-010 records the additions (Redact event, pseudonyms, property schema 3).
- **Live:** see "Live checks".

### H-1 and H-2. Not the assignee: no waiver by the assignee, and former assignees count

- **Decision:** [ADOPTED: owner instruction 'do NOW', 2026-11-06] review H-1 and H-2 fixes: refuse a waiver of a not-the-assignee item by the current assignee (even an approver); the validator counts such a waived item as open; "the assignee" means the current assignee and anyone who was the assignee at any moment after the item was last opened (read from the Jira changelog). An assignee from before the item was opened may still tick it.
- **What changed:**
  - New `src/jira/assignee-history.ts`: `assigneeChanges` (GET `/rest/api/3/issue/{id}/changelog`, pages of 100, at most 100 pages, fails closed) and `assigneesSince` (current assignee plus both sides of each assignee change after the window start, 5 s grace).
  - `src/domain/event-log.ts`: each criterion keeps `openedAt` (set on creation, on Reopen and on Reset), derived in the fold, so it survives a cache rebuild.
  - `src/domain/gate-rule.ts`: the assignee check now applies to DOD_WAIVED as well as DOD_DONE; `needsAssigneeCheck`.
  - `src/index.ts`: tick refuses the current assignee (`ASSIGNEE_DENIED`, unchanged) and a former assignee (`FORMER_ASSIGNEE_DENIED`); waive refuses both (`ASSIGNEE_WAIVE_DENIED`); the validator reads the changelog as the app when a not-the-assignee item is done or waived, and blocks on any read error.
  - Listing v2 row "Not-the-Assignee Rule" says exactly this.
- **Proof:** `test/resolvers/roles-waivers.test.ts` new tests: "refuses a waiver of a not-the-assignee item by an approver who is the assignee, and writes nothing"; "refuses the waiver from a former assignee too, and lets another approver waive"; "refuses a tick by someone who was the assignee after the item was opened (unassign, then tick)"; "lets someone tick who was the assignee only before the item was opened"; "fails closed when the assignee history cannot be read"; validator "(H-2) blocks when the person who ticked ... was the assignee after it was opened"; "(H-1) blocks when a not-the-assignee item was waived by someone who is or was the assignee"; "blocks when the assignee history cannot be read ...". New `test/jira/assignee-history.test.ts` (4 tests). `test/validator/gate-rule.test.ts`: "(H-1) treats a notAssignee item waived by an excluded assignee as open ...". Full suite 396 passed; `assignee-history.ts` and `gate-rule.ts` 100% branches; `index.ts` 90.7%.
- **Live:** see "Live checks".

## Site changes needed

(The main session applies these to the asymm.systems site repository, `asymm-corporate/repository/code/asymm-corporate-code-pfw/src/main/jbake/`, read at `6d838f9`. Each: page, old text, new text.)

1. **Price, suite product page** `content/product/jira-governance.html`, pricing table (lines 158 to 186). It gives one price for every app: "$1.50", "$1.20", "$0.90". New: keep the table for the apps whose price it is, and add under it: "DefinitionGuard has its own price: free for 1 to 10 users, $0.95 per user per month for 11 to 100 users, $0.75 for 101 to 250, $0.24 for 251 to 1,000, and a custom price above 1,000 users. Annual billing: pay for 10 months, get 12."
2. **Price, FAQ** `content/product/jira-governance/faq.html`, "How is billing calculated for larger instances?" (lines 29 to 31: "$1.50 per user per month.", "$1.20 ...", "$0.90 ..."). New: after the list, add "<p>DefinitionGuard costs less: $0.95 per user per month for 11 to 100 users, $0.75 for 101 to 250 and $0.24 for 251 to 1,000.</p>".

## Owner commands

(Commands only the owner runs. Nothing here has been run by this session.)

3. **Privacy page** `content/privacy.html` (on site `origin/develop` `e7579fb`, line 113), DefinitionGuard. Old: "<li><strong>Personal data:</strong> the Atlassian account id of the person who completed each checklist item, and of the person behind each recorded event.</li>". New: "<li><strong>Personal data:</strong> who completed, waived, reopened or reset each checklist item, and who saved a template, the exempt statuses or the approver groups. DefinitionGuard stores each person as a random pseudonym; the Atlassian account id is kept only in one link per person. The app reports these account ids to Atlassian every week and deletes the link of every account Atlassian reports as closed; the history then shows "A deleted user". Evidence links, evidence notes and waiver reasons are free text that you write and may name people. The issue property <code>definitionguard-dod</code> holds no personal data.</li>"
4. **User guide** `content/product/jira-governance/user-guide/definitionguard.html` (site `origin/develop` `e7579fb`), section "3. Not-the-Assignee Rule", lines 49 and 50. Old: "<li>When <strong>Not the assignee</strong> is set on an item (e.g. <em>Peer code review approved</em>), the current assignee cannot tick it. The panel shows: <em>The assignee cannot complete this item. Ask a reviewer.</em></li>" and "<li>The workflow validator checks the rule again against the assignee at the moment of the move into Done.</li>". New: "<li>When <strong>Not the assignee</strong> is set on an item (e.g. <em>Peer code review approved</em>), neither the current assignee nor anyone who was the assignee of the issue after the item was opened can tick it or waive it. DefinitionGuard reads this from the issue's change history. The panel shows: <em>The assignee cannot complete this item. Ask a reviewer.</em></li>" and "<li>The workflow validator checks the rule again at the moment of the move into Done, for ticked and for waived items.</li>". Same page, line 91 (template options). Old: "<li><strong>Not the assignee:</strong> the current assignee cannot tick this item.</li>". New: "<li><strong>Not the assignee:</strong> the current assignee, and anyone who was the assignee after the item was opened, cannot tick or waive this item.</li>".
