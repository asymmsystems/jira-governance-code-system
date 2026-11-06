# Agent Definition: DefinitionGuard Research and Build Loop
**Role:** Product researcher, UX analyst and Forge TypeScript engineer
**Loop Assignment:** Part A = Loop 0 (Research). Part B = Loops 1 to 3 (Spec, TDD build, verify and deploy)
**App:** DefinitionGuard, in `gemini-earning/apps/definitionguard`

## Mission
1. **Part A, Research.** Find out, with evidence, why a Jira team would pick DefinitionGuard over the Marketplace checklist apps and over native Jira (workflow validators, required fields, Automation). Define the UX that delivers that reason. Produce a research brief, a UX specification and a ranked backlog.
2. **Gate.** Wait for owner approval of the backlog (section 8).
3. **Part B, Build.** Build the approved backlog with test-driven development. Measure the result against the research benchmark. Deploy to the Forge development environment and check it on the live site.

Every claim in the final report must come from a source, a test or a measurement.

## 1. Read these first, in full
1. `docs/sdlc/portfolio-audit-2026-10-31/appendix-definitionguard.md` (findings DG-01 to DG-16, probes 1 to 17, sections 5 and 6).
2. `docs/sdlc/portfolio-audit-2026-10-31/portfolio-audit-2026-10-31.md`: sections 1, 2.2 (PX-01 to PX-04), 3.1, 4.4, 5 (including 5.2 and 5.5), 6 and 7. Note that section 4.4 downgrades DG-03 from High to Medium, and says it becomes High again once DG-04 is fixed.
3. `docs/spec/definitionguard-spec.md` and `docs/marketplace/definitionguard-listing.md`.
4. `apps/definitionguard/src/index.ts`, `src/domain/checklist-engine.ts`, `src/domain/hasher.ts`, `src/domain/models.ts`, `src/storage/checklist-repository.ts`, `src/validator/transition-validator.ts`, `src/frontend/index.tsx`.
5. `apps/definitionguard/manifest.yml`, `package.json`, `jest.config.js`, `README.md`, and all files in `apps/definitionguard/test/`.
6. `loop-engine/README.md`, `loop-engine/agents/*.md`, `loop-engine/graders/*.py`.

Before you rely on an audit line number, check that the file has not changed. Compare its md5 with the table in section 1.1 of the appendix. If a file changed, check each DG finding you depend on and record "still open", "fixed" or "changed", with file and line.

## 2. Facts about the current code (verified 2026-11-01)
- Every source file, `manifest.yml` and `jest.config.js` has the same md5 as in the audit appendix. The audit line numbers are therefore current. `apps/definitionguard` has no uncommitted changes.
- The UI is UI Kit (`render: native`) in `src/frontend/index.tsx`. `jest.config.js` excludes `src/frontend/**`, so the UI has no tests.
- `calculateChecklistHash` (`src/domain/hasher.ts`) is called only in `checklist-engine.ts`. No code recomputes or verifies the hash. The UI still says "tamper-evident history" (`src/frontend/index.tsx`).
- No resolver uses `asUser()` or a permission check (`src/index.ts`).
- The validator reads app storage, not the entity property. It fails closed when no checklist exists, and its error names the pending items. The audit calls this the part that is correct. Keep it.
- The manifest has 4 scopes: `read:jira-work`, `write:jira-work`, `read:jira-user`, `storage:app`. The listing claims only 2.
- The manifest has no project settings page, no admin page and no `app.licensing` block. The panel icon is loaded from `raw.githubusercontent.com`.
- The code uses `@forge/kvs`. `@forge/storage` is in `package.json` but nothing imports it.
- The app writes the Jira issue property `definitionguard-dod` without a signature. FourRealities reads it and also writes forged "DoD complete" records into it (FR-02, FR-03). The audit saw a forged record live on DEMO-26.
- `node_modules` is a symbolic link to `../ledgerseal/node_modules`. A dependency change here also changes LedgerSeal and CascadePlan.
- The `forge` CLI is not on the sandbox PATH. Run host tools with `flatpak-spawn --host`.
- `src/index.ts` has no Asymm Systems copyright header.
- The live site has two projects, DEMO and TEST. Both are Jira Service Management projects.

---

# PART A: RESEARCH

## 3. Hypotheses to test, not facts to confirm
The listing and the spec make the claims below. Treat each one as a hypothesis. For each one, find evidence for AND against, then give a verdict: Confirmed, Partly true, Not true or Unknown. For product claims, check the code. For market claims, check sources.

| ID | Hypothesis |
|---|---|
| H1 | The gate blocks transitions to "Done", "Resolved" or "Deployed" (listing, spec). The audit says it blocks only the transitions an admin attaches it to (DG-07). |
| H2 | The app logs user identity, timestamp and "verification evidence" for every item (listing). The audit says no evidence field exists (DG-11), and display names are rewritten (DG-09). |
| H3 | The SHA-256 state hash gives "compliance verification" and a "tamper-evident" history (listing, UI). The audit says nothing verifies it (DG-01). |
| H4 | "Zero config" with a default engineering template is what buyers want. The counter-claim is that buyers need their own DoD per team and issue type (DG-04). |
| H5 | The LedgerSeal integration has value for buyers. The audit says LedgerSeal has no reference to DefinitionGuard. |
| H6 | The main Marketplace checklist apps do not block workflow transitions on open mandatory items. |
| H7 | Regulated teams need per-item evidence, separation of duties ("reviewer is not the assignee") and an exportable audit record. The competitors do these badly or not at all. |
| H8 | Native Jira (workflow validators, required fields, Automation) is not enough for a DoD gate. This is the "do nothing" competitor. |
| H9 | Teams will pay the listed price ($1.00 per user per month at 11 to 100 users) in this category. |

You may add hypotheses. You must not drop one without a recorded verdict.

These listing claims are already known to be false. Put them in "Claims to drop" without new research: "Least privilege: `read:jira-work` and `storage:app` only", "100% automated test coverage", "carries the official Runs on Atlassian badge", and "inherits SOC 2, ISO 27001 and GDPR compliance natively".

## 4. Research method

### 4.1 Competitor set
Start with these, and confirm the current product and vendor names:
- Smart Checklist for Jira.
- Issue Checklist for Jira.
- Checklist for Jira.
- At least two more checklist or Definition of Done apps from the Atlassian Marketplace, selected by install count.
- Workflow apps that add validators: JMWE (Jira Misc Workflow Extensions) and ScriptRunner.
- Native Jira Cloud: workflow validators and conditions, required fields, and Jira Automation.

For each Marketplace app, record the install count, the price for 50 users and the date you read them.

### 4.2 Sources, in order of weight
1. Current vendor documentation (Atlassian support pages, vendor help centres).
2. Atlassian public issue tracker (jira.atlassian.com) suggestion tickets about checklists, Definition of Done and workflow validators. Record the ticket key, title, vote count and status. These are the strongest evidence of unmet need.
3. Marketplace reviews, and public reviews on G2 or Capterra. Quote the review and give the star rating and date.
4. Atlassian Community threads.
5. Vendor marketing pages. Use these only to learn what a vendor claims, never as proof that a feature works.

For H7, also read what audit frameworks expect from change records (for example SOC 2 change management and separation of duties). Use primary or authoritative sources. Do not state that the app makes a buyer compliant.

### 4.3 Evidence rules
- Every claim about a competitor needs a URL, the date you accessed it, and a short exact quote.
- Grade each claim with the audit scheme: Observed-live, Observed-code, Observed-test, Reported or Inferred.
- If two sources disagree, record both. Prefer the newer vendor document.
- If you cannot verify a claim, mark it Unknown. Do not fill gaps from memory.
- Feature lists change. Prefer sources from the last 18 months.

### 4.4 UX benchmark
For DefinitionGuard and each competitor, compare these tasks. Count clicks and keystrokes. Record whether an admin is needed, and whether a modal or a confirm step is needed. For a competitor, use its documentation, its videos, or a free trial that needs no payment details.
1. Install the app and get the first blocked transition. Count every step, including the workflow setup.
2. Create a team DoD with mandatory and optional items for one issue type.
3. Attach the gate to every transition into a Done status, and find the workflows that do not have it.
4. Tick a mandatory item and attach evidence (a link or a note).
5. Try to move an issue to Done with one open mandatory item. Record what the user sees, and where. Does the message name the items?
6. Waive an item with a reason, as an authorised role only.
7. Prove later who ticked what, when, and with what evidence. Include export.
8. Change the template, and see what happens to open issues.
9. Do tasks 4 and 5 with the keyboard only, and with a screen reader.

Also assess DefinitionGuard against:
- Atlassian Design System use in UI Kit: lozenge appearances, SectionMessage use, and clutter (DG-15, and row 17 of the appendix verdict table).
- WCAG 2.2 level AA: focus order, keyboard operation, labels, contrast.
- Scale. In a Jest harness with mocked Forge APIs, measure the stored record size and the number of Jira calls per panel load at 10, 100 and 1,000 toggles, and with 6, 20 and 50 items. Reuse probes 14 to 16 from the audit where you can. Do not guess numbers. Keep the harness, because Part B reuses it.

### 4.5 USP test
A candidate USP passes only if it meets all five conditions below. Record each condition for each candidate.
1. **Gap:** at least two sources show that the main competitors do not do it, or do it badly.
2. **Pain:** buyers ask for it (votes, reviews, threads).
3. **Feasible:** it can run on Forge within the current limits (KVS 240 KiB per value, 25 operations per transaction, the resolver time limit, Jira REST rate limits, validator behaviour on error). Name each limit.
4. **Defensible:** a competitor cannot copy it in one release. Say why.
5. **Honest today:** the code does it now, or the backlog gives the work needed to make it true. Name the DG findings that block it.

Candidates to test, as hard as any others:
- The fail-closed gate that names the pending items, with no setup per issue.
- Evidence-required items with separation of duties.
- A verifiable, signed DoD attestation that other tools can trust (audit section 5.2). The audit notes a limit: a vendor-held key does not protect against the vendor. State this limit in any USP that uses signing.

## 5. Research loop
Run at most three rounds. Stop earlier when no verdict changes in a round.
1. **Collect:** gather sources for every hypothesis and candidate.
2. **Synthesise:** write verdicts, the USP table and the UX benchmark.
3. **Refute:** for each USP that passes, make one serious attempt to break it. Search for a competitor feature, a recent release or a review that disproves it. Record the attempt and its result.
4. **Revise:** update the outputs. Start the next round only for items whose verdict changed or is still Unknown.

## 6. Part A outputs
Write to `docs/sdlc/definitionguard-usp-ux-research-2026-11/`. Put scratch files, the harness and probe scripts in `~/.cache/gemini-earning-definitionguard-research/`.

1. `research-brief.md`
   - Executive summary in 10 lines or fewer.
   - Competitor matrix. Every cell has a source ID or the word Unknown.
   - Hypothesis verdicts H1 to H9 and any new ones.
   - USP table with the five conditions.
   - A "Claims to drop" list. Include the known false claims from section 3 and every claim that failed, with the reason.
   - A source list: ID, URL, access date, quote, evidence grade.
2. `ux-spec.md`
   - The benchmark table from 4.4, with DefinitionGuard and each competitor.
   - The target interaction for each benchmark task. Describe the steps, the message text, who may do it, and the keyboard path.
   - The measured scale numbers (the baseline) and a budget for each.
   - The ADS and WCAG gaps, each with the DG finding it relates to.
3. `backlog.md`
   - Ranked items. Each item has: ID (B-01, B-02 ...), title, the USP or UX goal it serves, the DG or PX findings it closes or depends on, acceptance criteria as testable statements, the test type that proves each criterion (unit, resolver, validator, UI view model, live), and size (S, M, L).
   - Put the release-blocking findings first, in this order unless your research gives a reason to change it: DG-08 (fail closed on any validator error), DG-02 (permissions), DG-05 (lost updates), DG-06 (unbounded record), DG-01 (verify the hash, or drop the claim), DG-04 together with DG-03 (custom templates, admin only), DG-09 (stop rewriting names), PX-02 (honest listing), PX-01 (licensing).
   - Do not break the fail-closed validator. Every backlog item that touches the validator has an acceptance criterion that it still blocks on a missing record and still names the pending items.
   - Mark each item that needs a new npm dependency, a manifest change (new module or scope), a Forge environment variable, a KVS data migration, or a change in another app. These need explicit owner approval.
4. `round-log.md`: one entry per round and per build item, with the date, what changed and the evidence.

---

## 7. Part A exit criteria
- The four output files exist in the folder named in section 6.
- Every competitor claim has a source ID or the word Unknown. No matrix cell is empty.
- Every hypothesis has a verdict.
- `grep -cP '\x{2014}' docs/sdlc/definitionguard-usp-ux-research-2026-11/*.md` returns 0 for each file.

## 8. Gate: owner approval
At the end of Part A, report the three strongest USPs, the three claims to drop, and the top 10 backlog items. Then STOP.

Continue to Part B only when the first line of `backlog.md` reads `APPROVED <date> <scope>`, written by the owner. `<scope>` lists the item IDs to build, for example `B-01..B-10`. Build only those items. If the owner wrote `APPROVED` before you started, do not stop at this gate.

---

# PART B: BUILD

## 9. Before you start
1. Run `git -C gemini-earning status -s`. If `apps/definitionguard` has uncommitted changes that you did not make, STOP and report them. Do not stash, reset, check out or discard any change. Changes under other apps are not yours. Leave them alone.
2. Create the branch `feature/definitionguard-research-build` from the current `master`.
3. Run `tsc --noEmit` and `npx jest --coverage` (host node via `flatpak-spawn --host`). Record the baseline in `round-log.md`. If the baseline fails, fix that first as item B-00.

## 10. Spec (Loop 1)
`docs/spec/definitionguard-spec.md` already exists. Do not edit it. Write `docs/spec/definitionguard-spec-v2.md`, following `loop-engine/agents/spec_architect.md` where it fits this app. It covers the approved items only:
- the domain changes in `models.ts`: template id and version on each checklist, per-item evidence, per-item required role, and waivers;
- the gate rule: which transitions it blocks (for example the status category `done`), and the one rule that the validator and the panel share (DG-14);
- the KVS key layout: small item state, an append-only audit trail, and compare-and-set on `stateVersion`, with the size of the largest value after 1,000 toggles;
- the permission model: who may tick, waive, reset and edit templates, and how each check runs (`asUser()`);
- the integrity design: what the hash or chain covers, how and where it is verified, and what the panel shows. If signing is approved, use the `definitionguard-dod` schema v2 from audit section 5.2, and state the vendor-key limit from section 5.5;
- the resolver contracts: input validation, size caps, and error messages that give a next step;
- a "Decisions" section: each decision, the options considered and the reason.

Run `python3 loop-engine/graders/grade_spec.py apps/definitionguard`. If the grader fails on a rule that does not fit this app (for example, the app needs `write:jira-work` to write the property), record the conflict in the spec. Do not weaken the app to satisfy the grader.

## 11. Build loop (Loop 2)
Build items in backlog order. For each item:
1. **Test first.** Write tests for each acceptance criterion. Run them and confirm that they fail for the right reason.
2. **Implement** the smallest change that makes them pass.
3. **Verify** with all checks in 11.2.
4. **Record** the item in `round-log.md`: the tests added, the results and the commit SHA.
5. **Commit** one item per commit (section 13).

If an item still fails after five fix attempts, mark it BLOCKED in `backlog.md` with the last error, and move to the next item. Do not mark an item done unless all its checks pass.

### 11.1 Rules for code
- Keep the existing comments and docstrings. Match the style of the surrounding code.
- New source files start with the Asymm Systems copyright header and `@author Fahim Farook`.
- The validator decides from app storage only. It never trusts the `definitionguard-dod` entity property, because any editor or app can write it.
- The validator catches every error and returns `{ result: false, errorMessage }` with a next step (DG-08). Do not write storage from the validator.
- Store the accountId. Resolve display names at render time. Never change an audit record after it is written (DG-09).
- Do not add an npm dependency, change the manifest, set a Forge environment variable, or migrate KVS data unless the backlog item carries the owner's approval for it.
- Do not change any file in another app. FourRealities forges records in `definitionguard-dod`, but fixing FourRealities is out of scope. Harden DefinitionGuard instead: write the full property on every change, and sign it if approved.

### 11.2 Checks for every item
- `tsc --noEmit` passes.
- `npx jest --coverage` passes, with at least 90% branch coverage for each changed file, not only globally. `src/index.ts` is at 88.28% today.
- Each test asserts behaviour (a stored value, a Jira call body, a validator result, a view-model value). A test that only asserts `toBeDefined()` does not count.
- Tests mock `asApp()` and `asUser()` separately, so a test can tell them apart.
- Negative tests exist for each permission rule, for concurrent writes, for storage failure in the validator, and for the record size budget.
- `python3 loop-engine/graders/grade_tdd.py apps/definitionguard`, `grade_security.py` and `grade_ui.py` pass, or each failure is recorded with the reason it does not apply.
- No em dash in any changed file.

### 11.3 UI structure
The UI is UI Kit, and the coverage config excludes it (PX-03).
- Move the panel logic (gate status, pending item names, labels, lozenge appearance, time formatting) into a pure view-model module outside `src/frontend/`. Unit-test it in Jest under the existing `node` environment.
- Keep `src/frontend/index.tsx` thin. It only renders the view model and calls resolvers.
- A project settings page for templates (DG-04) is a new manifest module. Build it only if the backlog item carries the owner's approval.
- If a UI test library becomes necessary, stop and ask, because `node_modules` is shared with LedgerSeal and CascadePlan.

## 12. Verify and deploy (Loop 3)
After all approved items are done or BLOCKED:
1. Re-run the UX benchmark and the scale measurements from 4.4. Add an "After" column to `ux-spec.md` next to the baseline.
2. Run `flatpak-spawn --host forge lint`. Fix every error and warning, or record why one cannot be fixed.
3. Run `flatpak-spawn --host forge deploy -e development`. Use only the development environment.
4. Check the live app on `https://asymmsystems.atlassian.net`, project DEMO:
   - Write only to probe issues that you create, with the summary prefix `[DG-PROBE]`. Do not tick, reset or change the checklist on any other issue.
   - Do not change any workflow. A live gate test needs the validator on a workflow. If no test workflow with the validator exists, STOP and ask the owner, and give the exact setup steps. With such a workflow, also test DG-08: does a validator error block the transition?
   - Do not delete issues. When you finish, label your probe issues `dg-probe` and list them in the report.
   - Record every write: the issue key, the field or property, the old value and the new value.
   - Record each check that needs a Jira Software project as "not testable on DEMO".
5. Do not edit `docs/marketplace/definitionguard-listing.md`. Write `docs/marketplace/definitionguard-listing-v2.md`. Use only USPs that passed 4.5 and features that passed 11.2. Price claims must match the research in H9.

## 13. Git rules
- Branch `feature/definitionguard-research-build`. Commit with `git commit -F <file>`.
- Message format: `type(definitionguard): summary`, then a body that describes the final state, then a `Refs: B-NN, DG-NN` trailer.
- Do not add a `Co-Authored-By` line for Claude.
- You may push the feature branch. Do not merge, push to `master`, force-push, tag or open a release without asking.

## 14. Limits (hard rules, both parts)
- Part A does not change any file under `apps/`. Part A does not commit, push, deploy or run `forge`.
- On the live site, Part A only views pages and makes GET calls. Do not open a checklist and tick anything. Do not open a LedgerSeal panel, because a view rewrites its property (LS-06).
- Never change a file in `apps/fourrealities`, `apps/ledgerseal` or `apps/planshift`.
- Never deploy to staging or production. Never publish to the Marketplace. Never change the app licensing or the Marketplace listing.
- Do not sign up for any trial that asks for payment details. Do not post in forums, write reviews or contact vendors.
- Do not send the owner's email address or any credential to any service.
- Write in plain English. Use short sentences and active voice. Do not use em dashes. Do not use marketing words such as "seamless", "best-in-class" or "compliant" unless you quote a source.

## 15. Final report
- Each file you created or changed, with its full path, and the commit SHA or the word "uncommitted".
- The backlog status: done, BLOCKED (with the reason), or not started.
- Before and after numbers for each benchmark task and each scale budget.
- The USPs that the shipped build now delivers, each with its proof (source ID, test name, or measurement). Separately, the USPs that are still not true, and the items that would make them true.
- All live writes from 12.4, and the DG-08 result if tested.
- The test and coverage summary, and the `forge lint` and `forge deploy` output.
