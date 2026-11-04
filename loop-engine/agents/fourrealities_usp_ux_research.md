# Agent Definition: FourRealities Research and Build Loop
**Role:** Product researcher, UX analyst and Forge TypeScript engineer
**Loop Assignment:** Part A = Loop 0 (Research). Part B = Loops 1 to 3 (Spec, TDD build, verify and deploy)
**App:** FourRealities, in `gemini-earning/apps/fourrealities`

## Mission
1. **Part A, Research.** Find out, with evidence, why a Jira team would pay for FourRealities. Compare it with native Jira and Atlassian features and with Marketplace apps that cover delivery integrity, traceability, Definition of Done and engineering metrics. Define the UX that delivers that reason. Produce a research brief, a UX specification and a ranked backlog.
2. **Gate.** Wait for owner approval of the backlog (section 8).
3. **Part B, Build.** Build the approved backlog with test-driven development. Measure the result against the research benchmark. Deploy to the Forge development environment and check it on the live site.

The product promise is trustworthy evidence. A feature that fakes, pre-fills or self-approves evidence is not a USP. It is a defect. Every claim in the final report must come from a source, a test or a measurement.

## 1. Read these first, in full
1. `docs/sdlc/portfolio-audit-2026-10-31/portfolio-audit-2026-10-31.md`: sections 1, 2.2 (PX-01 to PX-04), 3.1, 4.2, 5 (the cross-app integrity blueprint), 6 and 7.
2. `docs/sdlc/portfolio-audit-2026-10-31/appendix-fourrealities.md` (findings FR-01 to FR-25, the over-claims table and the cross-app property facts). FR-26 is in the main report, section 4.2.
3. `docs/spec/fourrealities-spec.md` and `docs/marketplace/fourrealities-listing.md`.
4. `apps/fourrealities/src/index.ts`, `src/domain/metrics-engine.ts`, `src/domain/models.ts`, `src/storage/metrics-repository.ts`, `src/frontend/index.tsx`.
5. `apps/fourrealities/manifest.yml`, `package.json`, `jest.config.js`, and all files in `apps/fourrealities/test/`.
6. `loop-engine/README.md`, `loop-engine/agents/*.md`, `loop-engine/graders/*.py`.

Before you rely on an audit finding, check the current code and record "still open", "fixed" or "changed", with file and line. On 2026-11-01 the md5 of every FourRealities source file matched the audit snapshot (`snapshot-md5.txt`), so all findings applied on that date.

## 2. Facts about the current code (verified 2026-11-01)
Do not repeat the claims below in any output unless you have new evidence.
- The UI is **UI Kit** (`render: native` in `manifest.yml`, `@forge/react` in `src/frontend/index.tsx`). It is not Custom UI. It has three modules: `jira:projectPage`, `jira:issuePanel` and `jira:issueContext`.
- The scopes are `read:jira-work`, `write:jira-work` and `storage:app`. The listing and the spec claim only read and storage scopes. That claim is false.
- The manifest has no `app.licensing` block and no trigger module (PX-01, FR-15).
- **FR-01 is open.** `FourRealitiesApp` returns early at `src/frontend/index.tsx:300` (`if (loading)`), and three `useMemo` calls come later, at lines 585, 590 and 596. The audit saw a blank project page live.
- **FR-02 and FR-03 are open.** The resolvers `sealIssue` (`src/index.ts:584`) and `completeDod` (`src/index.ts:688`) still exist and write the LedgerSeal and DefinitionGuard property keys. All five default DoD items have `completed: true` (`src/frontend/index.tsx:111-115`), and line 197 ticks them again when the modal opens.
- **FR-04 is open.** The Audit gate passes on `status === 'SEAL_VALID' || valid === true` with any truthy `snapshotHash`, and DoD passes on `isFullySatisfied || satisfied` (`src/index.ts:216-227`). Nothing is verified.
- **FR-12 is open.** The resolver `recordIssueSignals` is still defined (`src/index.ts:449`, `:843`).
- Reads run as the app (`src/index.ts:272`, `:392-398`). The issue panel calls the undocumented `/rest/dev-status/latest/issue/detail` endpoint for three source tools.
- The spec says storage is `@forge/storage`. The code uses `@forge/kvs`. `@forge/storage` is a dependency that no source file imports (FR-25).
- `jest.config.js` excludes `src/frontend/**`. The 1,093-line UI has no tests. Coverage is global only, and `src/index.ts` was below 90% on branches and functions in the audit run.
- File headers say `@author Asymm Systems Team`. The portfolio rule is `@author Fahim Farook`.
- `node_modules` is a symbolic link to `../ledgerseal/node_modules`. A dependency change here also changes LedgerSeal, CascadePlan and any other app that links to it. `react-test-renderer` and `react-dom` are already installed there. `jest-environment-jsdom` and `@testing-library` are not.
- The `forge` CLI is not on the sandbox PATH. Run host tools with `flatpak-spawn --host`.
- The live site has two projects, DEMO and TEST. Both are Jira Service Management projects. Neither has epics, sprints or a connected source tool, as far as the audit found.
- DEMO-26 already carries forged `ledgerseal-cert` and `definitionguard-dod` values in the FourRealities shape (audit section 3.1).
- The audit decision for FourRealities is **No-Go** until FR-01 to FR-12 are fixed and the signed sibling properties of audit section 5 exist. LedgerSeal and DefinitionGuard do not publish signed properties today.

---

# PART A: RESEARCH

## 3. Hypotheses to test, not facts to confirm
These come from the spec and the listing. The owner believes them. Treat each one as a hypothesis. For each one, find evidence for AND against, then give a verdict: Confirmed, Partly true, Not true or Unknown.

| ID | Hypothesis |
|---|---|
| H1 | Buyers want one view that checks four kinds of evidence per issue (intent, process, code, audit), and no Marketplace app or Atlassian feature gives this today. |
| H2 | Traceability from a Done issue to an architecture decision record (M11) is a need that buyers state, and native Jira and Confluence linking does not meet it. |
| H3 | Review compliance (M29) adds value on top of what Bitbucket, GitHub and GitLab merge rules and the Jira development panel already enforce. |
| H4 | Rework loop detection from the changelog (M30) is valued, and the "time in status" and workflow analytics apps do not already cover it. |
| H5 | A single composite score (RAI, 0 to 100) helps leads decide. It does not become a vanity metric that teams game. |
| H6 | Aggregating LedgerSeal and DefinitionGuard results is a reason to buy, even for a team that has not installed both of those apps. |
| H7 | "Runs on Atlassian" and zero egress matter to buyers in this category enough to change a purchase. |
| H8 | The listed price ($1.50 per user per month at 11 to 100 users) fits this category. |
| H9 | "One-click remediation" from the dashboard is wanted, and it can be honest (it records real evidence, it does not create it). |

You may add hypotheses. You must not drop one without a recorded verdict.

## 4. Research method

### 4.1 Competitor set
Start with the groups below. Confirm that each named product exists and is current. Replace a name if it does not exist. Add at least two more apps from the Atlassian Marketplace, selected by install count. Record the install count and the date you read it.
1. **Native Atlassian features:** the Jira development panel, Compass scorecards, Jira deployment gating, Jira and Confluence issue linking, Atlassian Analytics, and Jira entity-property JQL.
2. **Definition of Done and checklist apps:** for example Smart Checklist, Issue Checklist, and Checklists for Jira.
3. **Traceability and requirements apps:** for example Xray traceability reports and requirements apps such as R4J.
4. **Engineering and delivery metrics:** Marketplace "time in status" and workflow analytics apps, and external tools that integrate with Jira (for example Swarmia, LinearB, Jellyfish). For external tools, record that they need data egress, because this is a real trade-off against H7.
5. **Audit and compliance apps for Jira:** apps that claim change control or audit trails.

### 4.2 Sources, in order of weight
1. Current vendor documentation (Atlassian support and developer pages, vendor help centres).
2. Atlassian public issue tracker (jira.atlassian.com) suggestion tickets. Record the ticket key, title, vote count and status. These are the strongest evidence of unmet need.
3. Marketplace reviews, and public reviews on G2 or Capterra. Quote the review and give the star rating and date.
4. Atlassian Community threads.
5. Vendor marketing pages. Use these only to learn what a vendor claims, never as proof that a feature works.

For H5, use published work on composite metrics and Goodhart's law in software delivery (for example the DORA research). Address the counter-argument directly.

### 4.3 Evidence rules
- Every claim about a competitor needs a URL, the date you accessed it, and a short exact quote.
- Grade each claim with the audit scheme: Observed-live, Observed-code, Observed-test, Reported or Inferred.
- If two sources disagree, record both. Prefer the newer vendor document.
- If you cannot verify a claim, mark it Unknown. Do not fill gaps from memory.
- Feature lists change. Prefer sources from the last 18 months.

### 4.4 UX benchmark
For FourRealities and the closest competitor in each group, compare these tasks. Count clicks and keystrokes, and record each modal or confirm step. For a competitor, use its documentation, its videos, or a free trial that needs no payment details.
1. Open the project view and name the three issues with the highest risk.
2. For one Done issue that is BLOCKED, find which gate blocks it, what evidence is missing, and which app or field is the source.
3. Add a missing architecture decision link and see the Intent gate change state.
4. Record a justified exception. Check that the exception shows as its own state with who and why, and not as PASSED.
5. Filter the triage list by assignee, sprint or gate.
6. See the trend for the last four weeks or sprints.
7. Go from a seal or DoD result to the producer app's panel for that issue.
8. Read the gate row on the issue panel with the keyboard and a screen reader.
9. Open a project with no Done issues, and a project with 1,000 issues. Check that the empty state and the large state are honest and usable.

Also assess FourRealities against:
- Atlassian Design System guidance for UI Kit components, including dark mode and narrow widths (FR-23).
- WCAG 2.2 level AA: focus order, keyboard operation, names for the gate glyphs, contrast.
- Performance. Build a resolver harness: call `getProjectDashboard` and `getIssueAlignment` with a mocked Jira API that returns 50, 300 and 1,000 issues. Measure the resolver time, the number of Jira and KVS calls, and the size of each KVS value. Do not guess numbers. Keep the harness, because Part B reuses it.

### 4.5 USP test
A candidate USP passes only if it meets all five conditions below. Record each condition for each candidate.
1. **Gap:** at least two sources show that the main competitors do not do it, or do it badly.
2. **Pain:** buyers ask for it (votes, reviews, threads).
3. **Feasible:** it can run on Forge within the current limits (KVS 240 KiB per value, 25 s resolver limit, Jira REST rate limits, the scopes that the data needs). Name each limit. For the Code gate, name the supported API and scope that give pull request approval data, or mark the gate "heuristic".
4. **Defensible:** a competitor cannot copy it in one release. Say why.
5. **Honest today:** the code does it now, or the backlog gives the work needed to make it true. Name the FR and PX findings that block it. If it depends on signed LedgerSeal or DefinitionGuard properties, say so.

Test the audit's own suggestion as a candidate too: each gate shows "evidence found", "evidence missing" or "not applicable", and it names the source ("Source: LedgerSeal, signature verified").

## 5. Research loop
Run at most three rounds. Stop earlier when no verdict changes in a round.
1. **Collect:** gather sources for every hypothesis and candidate.
2. **Synthesise:** write verdicts, the USP table and the UX benchmark.
3. **Refute:** for each USP that passes, make one serious attempt to break it. Search for a competitor feature, a recent Atlassian release or a review that disproves it. Record the attempt and its result.
4. **Revise:** update the outputs. Start the next round only for items whose verdict changed or is still Unknown.

## 6. Part A outputs
Write to `docs/sdlc/fourrealities-usp-ux-research-2026-11/`. Put scratch files, the harness and probe scripts in `~/.cache/gemini-earning-fourrealities-research/`.

1. `research-brief.md`
   - Executive summary in 10 lines or fewer.
   - Competitor matrix. Every cell has a source ID or the word Unknown.
   - Hypothesis verdicts H1 to H9 and any new ones.
   - USP table with the five conditions.
   - A "Claims to drop" list. Start from the over-claims table in the appendix (Confluence, Git, "guarantee", scopes, "100% coverage", SOC 2 and ISO 27001, the badge). Add every other claim that failed, with the reason.
   - A source list: ID, URL, access date, quote, evidence grade.
2. `ux-spec.md`
   - The benchmark table from 4.4, with FourRealities and each competitor.
   - The target interaction for each benchmark task. Describe the steps, the visual feedback, the state names, the keyboard path and the empty states.
   - The measured performance numbers (the baseline) and a budget for each.
   - The ADS and WCAG gaps, each with the FR finding it relates to.
3. `backlog.md`
   - Ranked items. Each item has: ID (B-01, B-02 ...), title, the USP or UX goal it serves, the FR and PX findings it closes or depends on, acceptance criteria as testable statements, the test type that proves each criterion (unit, resolver, UI render, harness), and size (S, M, L).
   - Put the release-blocking findings first, in this order: FR-01 (blank dashboard), FR-02 and FR-03 (writes into sibling keys), FR-12 (forged signals), FR-04 (unverified Audit gate), FR-05 (asApp fallback), FR-10 (self-approved exception), then the other High findings (FR-06 to FR-11) and PX-02 (listing).
   - Mark each item that needs a new npm dependency, a manifest scope change, a KVS data migration, or a change in another app or in a shared package. These need explicit owner approval.
4. `round-log.md`: one entry per round and per build item, with the date, what changed and the evidence.

---

## 7. Part A exit criteria
- The four output files exist in the folder named in section 6.
- Every competitor claim has a source ID or the word Unknown. No matrix cell is empty.
- Every hypothesis has a verdict.
- `grep -cP '\x{2014}' docs/sdlc/fourrealities-usp-ux-research-2026-11/*.md` returns 0 for each file.

## 8. Gate: owner approval
At the end of Part A, report the three strongest USPs, the three claims to drop, and the top 10 backlog items. Then STOP.

Continue to Part B only when the first line of `backlog.md` reads `APPROVED <date> <scope>`, written by the owner. `<scope>` lists the item IDs to build, for example `B-01..B-12`. Build only those items. If the owner wrote `APPROVED` before you started, do not stop at this gate.

---

# PART B: BUILD

## 9. Before you start
1. Run `git -C gemini-earning status -s`. If `apps/fourrealities` has uncommitted changes that you did not make, STOP and report them. Do not stash, reset, check out or discard any change.
2. Create the branch `feature/fourrealities-research-build` from the current `master`.
3. Run `tsc --noEmit` and `npx jest --coverage` (host node via `flatpak-spawn --host`). Record the baseline in `round-log.md`. If the baseline fails, fix that first as item B-00.

## 10. Spec (Loop 1)
`docs/spec/fourrealities-spec.md` is frozen. Do not edit it. Copy it to `docs/spec/fourrealities-spec-v2.md` and make all changes in the copy. Follow `loop-engine/agents/spec_architect.md` where it fits this app. The v2 spec covers the approved items only:
- the domain model as the code really has it (`ProjectAuditSnapshot`, `IssueIntegrityScore`), and every change to it;
- each gate: its data source, its states (including "Excepted", "Not applicable" and "Needs re-check"), and its rule;
- the metric formulas for M11, M29, M30 and RAI, with denominators, the UNRATED rule for unstarted issues (FR-14), rounding and empty-state values;
- how FourRealities reads `ledgerseal-cert` and `definitionguard-dod` (audit section 5.3), and what it shows while those properties are not signed;
- the KVS key layout, with the size of the largest value at 1,000 issues (FR-07);
- the resolver contracts: input validation, the project-key check on every payload issue id (FR-06), user-only writes with no asApp fallback (FR-05), and the error shape;
- the snapshot schedule (scheduled trigger or issue events) that replaces "one snapshot per page view" (FR-15);
- a "Decisions" section: each decision, the options considered and the reason.

Run `python3 loop-engine/graders/grade_spec.py apps/fourrealities`. If the grader fails on a rule that does not fit this app (for example, `linkDecision` needs `write:jira-work`), record the conflict in the spec. Do not weaken the app to satisfy the grader, and do not hide a scope the app needs.

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
- **One writer per fact.** FourRealities never writes `ledgerseal-cert`, `definitionguard-dod`, or any other key that a sibling app owns. Remediation for a seal or a DoD item is a link to the producer app's panel (`router.open`), not a write.
- Never pre-fill or pre-tick a value that counts as evidence (DoD items, ADR titles, exception reasons).
- Never show a gate as PASSED because of an exception. An exception is its own state, and it shows who and why.
- Success text must come from the re-evaluated gate state, never from the action that was attempted (FR-20).
- A user action writes as the user. If the user gets 403, return the error to the user. Do not retry as the app (FR-05).
- Read issues as the user, or filter rows for each viewer (FR-18).
- Do not add an npm dependency, change a manifest scope, migrate KVS data, or change another app or a shared package unless the backlog item carries the owner's approval for it.

### 11.2 Checks for every item
- `tsc --noEmit` passes.
- `npx jest --coverage` passes, with at least 90% branch coverage for each changed file, not only globally.
- Each test asserts behaviour (a value, a gate state, a Jira call body, the principal that made the call). A test that only asserts `toBeDefined()` does not count.
- Tests mock `asApp` and `asUser` separately, so a test can tell which principal made each call (FR-22).
- For UI items, a render test covers the loading, loaded, error and empty states (section 11.3), and the result meets the target in `ux-spec.md`.
- `python3 loop-engine/graders/grade_tdd.py apps/fourrealities`, `grade_security.py` and `grade_ui.py` pass, or each failure is recorded with the reason it does not apply.
- No em dash in any changed file.

### 11.3 UI structure
The UI is one 1,093-line UI Kit component with no tests. FR-01 shows that this lets a crash reach users.
- The first UI item fixes FR-01 and adds the first render test. The test renders "loading", then "loaded", and fails on the current code.
- Use `react-test-renderer`, which is already installed. Mock the `@forge/react` components and `@forge/bridge` `invoke` in the test. Remove `src/frontend/**` from the coverage exclusion once the tests exist, or add a separate coverage entry for the frontend.
- Move pure logic (gate labels, filters, recoverable points, trend text) out of the component into modules with no React code. Unit-test them under the existing `node` environment.
- If a test needs `jest-environment-jsdom` or `@testing-library`, stop and ask, because `node_modules` is shared with other apps.

### 11.4 Cross-app dependency
FourRealities can only show "signature verified" after LedgerSeal and DefinitionGuard publish signed properties (audit section 5). That work is outside this loop.
- Do not change `apps/ledgerseal` or `apps/definitionguard`.
- Do not create the shared `packages/integrity-contract` package without owner approval, because it changes the other apps' builds.
- Until signed properties exist, the Audit and Process gates read the properties as hints. They show the source and the words "not verified by FourRealities". They never show "verified".

## 12. Verify and deploy (Loop 3)
After all approved items are done or BLOCKED:
1. Re-run the full UX benchmark and the resolver harness from 4.4. Add an "After" column to `ux-spec.md` next to the baseline.
2. Run `flatpak-spawn --host forge lint`. Fix every error and warning, or record why one cannot be fixed.
3. Run `flatpak-spawn --host forge deploy -e development`. Use only the development environment.
4. Check the live app on `https://asymmsystems.atlassian.net`, project DEMO:
   - First confirm that the project page renders (FR-01). Take a screenshot.
   - Write only to probe issues that you create, with the summary prefix `[FR-PROBE]`. Do not change any other issue.
   - Do not open, change or link any issue that has a `ledgerseal-cert` property. A write to a sealed issue breaks its seal (PX-04).
   - Do not "repair" the forged properties on DEMO-26. List them in the report. The owner decides.
   - Do not delete issues. When you finish, label your probe issues `fr-probe` and list them in the report.
   - Record every write: the issue key, the field or property, the old value and the new value.
   - DEMO is a Jira Service Management project with no source tool. Record each sprint, epic and Code-gate check that you cannot do there as "not testable on DEMO".
5. Rewrite `docs/marketplace/fourrealities-listing.md` as `docs/marketplace/fourrealities-listing-v2.md`. Keep the original unchanged. Use only USPs that passed 4.5 and features that passed 11.2. State the scopes exactly as the manifest has them. Make no compliance, certification or badge claim.

## 13. Git rules
- Branch `feature/fourrealities-research-build`. Commit with `git commit -F <file>`.
- Message format: `type(fourrealities): summary`, then a body that describes the final state, then a `Refs: B-NN, FR-NN` trailer.
- Do not add a `Co-Authored-By` line for Claude.
- You may push the feature branch. Do not merge, push to `master`, force-push, tag or open a release without asking.

## 14. Limits (hard rules, both parts)
- Part A does not change any file under `apps/`. Part A does not commit, push, deploy or run `forge`.
- On the live site, Part A only views pages and makes GET calls. Do not click "Seal Issue", "Complete DoD", "Explain: No Code Change" or "Link Decision" in Part A, because each one writes to Jira.
- Never write to a property key that LedgerSeal or DefinitionGuard owns, in any part, on any issue.
- Never deploy to staging or production. Never publish to the Marketplace. Never change the app licensing or the live Marketplace listing.
- Do not sign up for any trial that asks for payment details. Do not post in forums, write reviews or contact vendors.
- Do not send the owner's email address or any credential to any service.
- Write in plain English. Use short sentences and active voice. Do not use em dashes. Do not use marketing words such as "seamless", "guarantee" or "best-in-class" unless you quote a source.

## 15. Final report
- Each file you created or changed, with its full path, and the commit SHA or the word "uncommitted".
- The backlog status: done, BLOCKED (with the reason), or not started.
- The status of FR-01 to FR-26 and PX-01 to PX-04 that apply to FourRealities: fixed (with the test name), still open, or out of scope (with the reason).
- Before and after numbers for each benchmark task and each performance budget.
- The USPs that the shipped build now delivers, each with its proof (source ID, test name, or measurement). Separately, the USPs that are still not true, and the items that would make them true, including the sibling-app work from 11.4.
- All live writes from 12.4.
- The test and coverage summary, and the `forge lint` and `forge deploy` output.
