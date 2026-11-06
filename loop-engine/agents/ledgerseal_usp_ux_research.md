# Agent Definition: LedgerSeal Research and Build Loop
**Role:** Product researcher, compliance analyst, UX analyst and Forge TypeScript engineer
**Loop Assignment:** Part A = Loop 0 (Research). Part B = Loops 1 to 3 (Spec, TDD build, verify and deploy)
**App:** LedgerSeal, in `gemini-earning/apps/ledgerseal`

## Mission
1. **Part A, Research.** Find out, with evidence, why a regulated Jira team would pick LedgerSeal over native Jira controls and the Marketplace approval, e-signature and audit-trail apps. Find out which compliance statements the app can honestly make. Define the UX that delivers the result. Produce a research brief, a UX specification and a ranked backlog.
2. **Gate.** Wait for owner approval of the backlog (section 8).
3. **Part B, Build.** Build the approved backlog with test-driven development. Measure the result against the research benchmark. Deploy to the Forge development environment and check it on the live site.

Every claim in the final report must come from a source, a test or a measurement.

## 1. Read these first, in full
1. `docs/sdlc/portfolio-audit-2026-10-31/appendix-ledgerseal.md` (findings LS-01 to LS-21).
2. `docs/sdlc/portfolio-audit-2026-10-31/portfolio-audit-2026-10-31.md`: sections 1, 2.2 (PX-01 to PX-04), 4.3 (LS-22), 5 (integrity pipeline blueprint) and 7 (live results).
3. `docs/spec/ledgerseal-spec.md` and `docs/marketplace/ledgerseal-listing.md`. These are claims, not facts. The audit (appendix section 5) lists where they are wrong.
4. `apps/ledgerseal/src/index.ts`, all files in `src/domain/`, `src/storage/seal-repository.ts`, `src/validator/workflow-validator.ts`, `src/frontend/index.tsx`.
5. `apps/ledgerseal/manifest.yml`, `package.json`, `jest.config.js`, `README.md`, and all files in `apps/ledgerseal/test/`.
6. `loop-engine/README.md`, `loop-engine/agents/*.md`, `loop-engine/graders/*.py`, and `loop-engine/runs/ledgerseal_state.json`. The state file says `ALL_LOOPS_COMPLETE`. The audit shows that the graders passed an app with two Critical findings. Do not treat a grader pass as proof.

If the code has changed since the audit, check each LS finding that your work depends on and record "still open", "fixed" or "changed", with file and line.

## 2. Facts about the current code (verified 2026-11-01)
Do not repeat the claims below in any output unless you have new evidence.
- The md5 sums of `src/index.ts`, `src/domain/canonicalizer.ts`, `src/storage/seal-repository.ts` and `src/frontend/index.tsx` equal the sums in the audit. The audited code is the current code. `git status` shows no uncommitted change in `apps/ledgerseal`.
- The UI is UI Kit (`@forge/react`), rendered natively (`manifest.yml`: `render: native`, resource `src/frontend/index.tsx`). It is the live UI, not dead code. `jest.config.js` excludes `src/frontend/**`, so the UI has no tests.
- The manifest has an issue panel and a workflow validator. Scopes are `read:jira-work`, `write:jira-work`, `read:jira-user` and `storage:app`. The spec says only `read:jira-work` and `storage:app`. The manifest has no `app.licensing` block (PX-01). The panel icon loads from `raw.githubusercontent.com`.
- All Jira calls use `api.asApp()` (`index.ts`). No call uses `asUser()`.
- `sealIssue` has no permission or approver check (LS-01).
- `sealIssue` starts `signerEmail` from the client payload (`index.ts`, `signature.signerEmail`) (LS-03).
- `verifyIssue` calls `repository.saveCertificate(activeCert)` (`index.ts`), so a view of a tampered issue writes to storage and to the `ledgerseal-cert` property (LS-06). The live audit saw this on DEMO-22.
- Production code has `process.env.NODE_ENV === 'test'` branches (`index.ts`) (LS-14).
- `verifyCertificateIntegrity` (`crypto.ts`) has no caller in `src` (LS-10).
- `canonicalizer.ts` has 13 hard-coded `customfield_100xx` ids (LS-05).
- The certificate stores "I electronically sign and seal this issue per compliance guidelines." (`frontend/index.tsx:87`). The checkbox the user ticks says "I certify that I am the authorized signer ..." (`frontend/index.tsx:233`) (LS-09).
- `seal-repository.ts` has `revokeCertificate` and a history key, but no resolver or UI reads them (LS-13).
- The audit names one asset to keep: the verifier and the validator trust app storage (KVS), not the writable entity property. Keep this trust boundary.
- `apps/ledgerseal/node_modules` is a real directory. `apps/planshift/node_modules`, `apps/fourrealities/node_modules` and `apps/definitionguard/node_modules` are symbolic links to it. Any dependency change here also changes CascadePlan, FourRealities and DefinitionGuard.
- The `forge` CLI is not on the sandbox PATH. Run host tools with `flatpak-spawn --host`.

---

# PART A: RESEARCH

## 3. Hypotheses to test, not facts to confirm
The listing, the spec and the README make the claims below. Treat each one as a hypothesis. For each one, find evidence for AND against, then give a verdict: Confirmed, Partly true, Not true or Unknown.

| ID | Hypothesis |
|---|---|
| H1 | Native Jira gives no way to stop or flag edits to an approved issue. Test this against native options, for example the workflow property that makes an issue not editable in a status, issue security, field permissions, and Jira Service Management approvals. |
| H2 | Native Jira issue history (the changelog) and the Atlassian admin audit log are not enough evidence for an auditor of change approval. |
| H3 | Regulated buyers want a hash-based seal, not only an access control or a history record. |
| H4 | LedgerSeal "enforces 21 CFR Part 11 electronic signatures". |
| H5 | LedgerSeal supports SOC 2, ISO 27001 and SOX audits. |
| H6 | A plain SHA-256 digest in app storage, with no signature and no outside anchor, is enough tamper evidence for an auditor (LS-10). |
| H7 | Competitors do not show a field-level diff of what changed after approval, with who and when. |
| H8 | "Zero egress" and "Runs on Atlassian" are reasons that regulated buyers choose an app. |
| H9 | Buyers will pay the price tiers in the listing. |

You may add hypotheses. You must not drop one without a recorded verdict.

### 3.1 Rules for compliance claims (H4, H5)
- An app cannot be "compliant" or "certified" on its own. A customer's system, procedures and validation make a customer compliant. Test the exact wording of each claim, and propose wording the app can support, such as "supports the audit trail requirements of 21 CFR 11.10(e)" only if the code meets that clause.
- Quote the regulation text itself. For 21 CFR Part 11, use the eCFR text (at least 11.10, 11.50, 11.70, 11.100, 11.200 and 11.300) and the FDA guidance "Part 11, Electronic Records; Electronic Signatures: Scope and Application". For SOX, ISO 27001 and SOC 2, name the exact control or criterion, with its source. If a standard's text is behind a paywall, quote a public summary and mark the claim Reported.
- Map each clause to the code: Met, Partly met, Not met, or Not the app's job (a customer procedure). Cite file and line, or the LS finding.
- This is a product analysis, not legal advice. Say so in the brief.

## 4. Research method

### 4.1 Competitor set
- Native Jira Cloud: issue history, workflow properties and conditions, field and issue security, Jira Service Management approvals.
- Atlassian Guard (formerly Atlassian Access) and the organization audit log, for the parts that overlap.
- At least four Marketplace apps for Jira Cloud found by searching for "electronic signature", "21 CFR Part 11", "approval", "audit trail" and "issue history". Select them by install count. Record the install count and the date you read it.

### 4.2 Sources, in order of weight
1. Regulation and standard texts (section 3.1).
2. Current vendor documentation (Atlassian support pages, vendor help centres).
3. Atlassian public issue tracker (jira.atlassian.com) suggestion tickets about locking, approval and history. Record the ticket key, title, vote count and status.
4. Marketplace reviews, and public reviews on G2 or Capterra. Quote the review and give the star rating and date.
5. Atlassian Community threads, and public guidance from auditors or validation consultants.
6. Vendor marketing pages. Use these only to learn what a vendor claims, never as proof that a feature works.

### 4.3 Evidence rules
- Every claim about a competitor or a regulation needs a URL, the date you accessed it, and a short exact quote.
- Grade each claim with the audit scheme: Observed-live, Observed-code, Observed-test, Reported or Inferred.
- If two sources disagree, record both. Prefer the newer vendor document.
- If you cannot verify a claim, mark it Unknown. Do not fill gaps from memory.
- Feature lists change. Prefer sources from the last 18 months. Regulation text is exempt.

### 4.4 UX benchmark
For LedgerSeal and each competitor, compare these tasks. Count clicks and keystrokes. Record any modal, any confirm step, and who is allowed to do the task. For a competitor, use its documentation, its videos, or a free trial that needs no payment details.
1. Sign and seal an approved issue.
2. See exactly which fields the seal covers, and which it excludes.
3. Find out that an issue changed after approval: which field, old and new value, who, and when.
4. Approve a legitimate change: a reseal by a different approver, with a reason, while the earlier tamper record stays visible.
5. Be blocked at a workflow transition, understand why, and know how to fix it.
6. Export evidence for an auditor, and let the auditor check the hash without access to the app.
7. List every broken or unsealed issue in a project (JQL, filter or dashboard).
8. Revoke an approval.
9. Recover when Jira is unreachable during a seal or a verify (LS-08, LS-12).

Also assess LedgerSeal against:
- Atlassian Design System and UI Kit patterns, including the error, empty and loading states.
- WCAG 2.2 level AA: keyboard operation, labels, and state that does not depend on colour alone.
- Wording: every status text and button label against the "Claims to drop" list. For example, "UNTAMPERED & AUDIT READY" and "Cryptographic Seal Verified".
- Performance and size. With mocked Forge APIs in Jest, measure resolver time and the stored certificate size for a small issue, a 400-paragraph description, and 100 comments. Measure the size after 500 views of a tampered issue. Do not guess numbers. Keep the scripts, because Part B reuses them.

### 4.5 USP test
A candidate USP passes only if it meets all five conditions below. Record each condition for each candidate.
1. **Gap:** at least two sources show that native Jira and the main competitors do not do it, or do it badly.
2. **Pain:** buyers or auditors ask for it (votes, reviews, threads, audit guidance).
3. **Feasible:** it can run on Forge within the current limits (KVS 240 KiB per value, 25 s resolver limit, the workflow validator time limit, Jira REST rate limits, entity property size). Name each limit and its source.
4. **Defensible:** a competitor cannot copy it in one release. Say why.
5. **Honest today:** the code does it now, or the backlog gives the work needed to make it true. Name the LS findings that block it.

A seal that any viewer can reset, or that a reseal can silently wipe, is not a USP. LS-01 and LS-02 block every integrity USP until they are fixed.

Expected candidates to test: a field-level tamper diff with who and when; separation of duties on reseal; a signed attestation (Ed25519, audit section 5.1) that an auditor can verify with a published public key; a published canonical form with an open verifier. Test them as hard as the others.

## 5. Research loop
Run at most three rounds. Stop earlier when no verdict changes in a round.
1. **Collect:** gather sources for every hypothesis and candidate.
2. **Synthesise:** write verdicts, the compliance clause map, the USP table and the UX benchmark.
3. **Refute:** for each USP that passes, make one serious attempt to break it. Search for a native Jira feature, a competitor feature, a recent release or a review that disproves it. Record the attempt and its result.
4. **Revise:** update the outputs. Start the next round only for items whose verdict changed or is still Unknown.

## 6. Part A outputs
Write to `docs/sdlc/ledgerseal-usp-ux-research-2026-11/`. Put scratch files and probe scripts in `~/.cache/gemini-earning-ledgerseal-research/`.

1. `research-brief.md`
   - Executive summary in 10 lines or fewer.
   - Competitor matrix. Every cell has a source ID or the word Unknown.
   - Hypothesis verdicts H1 to H9 and any new ones.
   - The compliance clause map (section 3.1), with the statement "This is a product analysis, not legal advice."
   - USP table with the five conditions.
   - A "Claims to drop" list. Include every claim in the listing, spec, README, `package.json` keywords and UI text that failed, with the reason and a replacement wording, or "remove".
   - A source list: ID, URL, access date, quote, evidence grade.
2. `ux-spec.md`
   - The benchmark table from 4.4, with LedgerSeal and each competitor.
   - The target interaction for each benchmark task. Describe the steps, the text shown, who may act, the error path and the keyboard path.
   - The measured size and time numbers (the baseline) and a budget for each.
   - The ADS, UI Kit and WCAG gaps, each with the LS finding it relates to.
3. `backlog.md`
   - Ranked items. Each item has: ID (B-01, B-02 ...), title, the USP or UX goal it serves, the LS and PX findings it closes or depends on, acceptance criteria as testable statements, the test type that proves each criterion (unit, resolver, UI view-model, live probe), and size (S, M, L).
   - Put the release-blocking findings first, in this order: LS-01 (any viewer can reseal), LS-02 (reseal hides tampering), LS-06 (a view rewrites the certificate and the property), LS-03 (spoofable signer), LS-04 and LS-05 (material fields outside the hash), LS-08, LS-09, LS-10. Then PX-02 (listing claims) and PX-04 (CascadePlan writes break seals with no warning).
   - Keep the trust boundary: verify against app storage, never against the entity property.
   - Mark each item that needs a new npm dependency, a manifest change (scope, module, licensing), a Forge encrypted variable (for example a signing key), a KVS data migration, or a workflow change on the site. These need explicit owner approval.
4. `round-log.md`: one entry per round and per build item, with the date, what changed and the evidence.

---

## 7. Part A exit criteria
- The four output files exist in the folder named in section 6.
- Every competitor claim has a source ID or the word Unknown. No matrix cell is empty.
- Every hypothesis has a verdict. Every compliance claim has a clause-level verdict.
- `grep -cP '\x{2014}' docs/sdlc/ledgerseal-usp-ux-research-2026-11/*.md` returns 0 for each file.

## 8. Gate: owner approval
At the end of Part A, report the three strongest USPs, the compliance wording the app can support today, the three claims to drop first, and the top 10 backlog items. Then STOP.

Continue to Part B only when the first line of `backlog.md` reads `APPROVED <date> <scope>`, written by the owner. `<scope>` lists the item IDs to build, for example `B-01..B-10`. Build only those items. If the owner wrote `APPROVED` before you started, do not stop at this gate.

---

# PART B: BUILD

## 9. Before you start
1. Run `git -C gemini-earning status -s`. If `apps/ledgerseal` has uncommitted changes that you did not make, STOP and report them. Do not stash, reset, check out or discard any change.
2. Create the branch `feature/ledgerseal-research-build` from the current `master`.
3. Run `tsc --noEmit` and `npx jest --coverage` (host node via `flatpak-spawn --host`). Record the baseline in `round-log.md`. If the baseline fails, fix that first as item B-00.

## 10. Spec (Loop 1)
`docs/spec/ledgerseal-spec.md` exists. Do not edit it. Copy it to `docs/spec/ledgerseal-spec-v2.md` and make all changes in the copy. The v2 spec covers the approved items only:
- the true invariants, with the false ones from the audit (appendix section 5) removed or corrected;
- the sealed field set: how fields are chosen by schema type through `/rest/api/3/field`, not by id or value (LS-05), and how the panel shows sealed and excluded fields;
- the canonical form, with a version number, so an outside verifier can recompute the hash (LS-11, LS-22);
- the approver policy and separation of duties for seal and reseal (LS-01);
- the tamper record: incidents that survive a reseal, a hash-chained history, and `everCompromised` (LS-02);
- the attestation format for `ledgerseal-cert`, if approved (audit section 5.1), with key handling;
- the KVS key layout, with the size of the largest value for a large issue and after many views (LS-06, LS-07);
- the resolver and validator contracts: identity from context only (LS-03), the error results (LS-08, LS-12), and conflict handling;
- the exact declaration text and its version (LS-09);
- a "Decisions" section: each decision, the options considered and the reason.

Run `python3 loop-engine/graders/grade_spec.py apps/ledgerseal`. If the grader fails on a rule that does not fit this app (for example, LedgerSeal needs `write:jira-work` to write the entity property), record the conflict in the spec. Do not weaken the app to satisfy the grader.

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
- Never take identity (account id, name, email) from the client payload. Fail when `context.accountId` is absent (LS-03).
- A read must not write. A verify that finds no new change must not change storage or the property (LS-06).
- Never write the `ledgerseal-cert` property with a value the code did not compute. On a Jira read failure, report "LedgerSeal could not read the issue" and do not write (LS-08).
- Replace the `NODE_ENV === 'test'` branches with an injected Jira client that tests can mock (LS-14). Mock `asApp` and `asUser` separately.
- Do not add an npm dependency, change the manifest, set a Forge variable, or migrate KVS data unless the backlog item carries the owner's approval for it.

### 11.2 Checks for every item
- `tsc --noEmit` passes.
- `npx jest --coverage` passes, with at least 90% branch coverage for each changed file, not only globally.
- Each test asserts behaviour (a hash, a stored value, a property body, a validator result and message). A test that only asserts `toBeDefined()` does not count.
- For each integrity item, an adversarial test reproduces the audit failure scenario (for example `flow.js` step 3 for LS-01) and shows that it now fails.
- For UI items, a view-model test (section 11.3) covers the loading, sealed, broken, revoked, unsealed and error states.
- `python3 loop-engine/graders/grade_tdd.py apps/ledgerseal`, `grade_security.py` and `grade_ui.py` pass, or each failure is recorded with the reason it does not apply.
- No em dash in any changed file.

### 11.3 UI structure
The UI is UI Kit, so a browser harness cannot load it locally.
- Put the panel logic (which state to show, which text, which actions this user may take) in a pure view-model module with no React import. Unit-test it in Jest under the existing `node` environment.
- Keep the React file thin: it maps the view model to UI Kit components.
- If a React render test needs a new package (for example a test renderer), stop and ask, because `node_modules` is shared with CascadePlan.

## 12. Verify and deploy (Loop 3)
After all approved items are done or BLOCKED:
1. Re-run the size and time measurements from 4.4. Add an "After" column to `ux-spec.md` next to the baseline. Re-run every audit probe scenario in your scratch folder and record the results.
2. Run `flatpak-spawn --host forge lint`. Fix every error and warning, or record why one cannot be fixed.
3. Run `flatpak-spawn --host forge deploy -e development`. Use only the development environment.
4. Check the live app on `https://asymmsystems.atlassian.net`, project DEMO:
   - Create probe issues with the summary prefix `[LS-PROBE]`. Open the LedgerSeal panel only on these issues. Do not open any other DEMO issue page, because a panel view can write (LS-06) until the fix is deployed and proven.
   - Do not schedule probe issues in CascadePlan, and do not use the FourRealities "Seal Issue" action on them (FR-02 forges `ledgerseal-cert`).
   - Do not attach the validator to a workflow, or change any workflow, without owner approval.
   - Do not delete issues. When you finish, label your probe issues `ls-probe` and list them in the report.
   - Record every write: the issue key, the field or property, the old value and the new value.
5. Rewrite `docs/marketplace/ledgerseal-listing.md` from the code. Use only USPs that passed 4.5, features that passed 11.2, and compliance wording from the clause map. Remove every badge and certification claim that has no evidence (PX-02).

## 13. Git rules
- Branch `feature/ledgerseal-research-build`. Commit with `git commit -F <file>`.
- Message format: `type(ledgerseal): summary`, then a body that describes the final state, then a `Refs: B-NN, LS-NN` trailer.
- Do not add a `Co-Authored-By` line for Claude.
- You may push the feature branch. Do not merge, push to `master`, force-push, tag or open a release without asking.

## 14. Limits (hard rules, both parts)
- Part A does not change any file under `apps/`. Part A does not commit, push, deploy or run `forge`.
- On the live site, Part A makes REST GET calls only. Part A creates no issues, so it has no probe issue. Therefore Part A opens no issue page and no LedgerSeal panel, because a panel view on a tampered issue writes (LS-06). If a live view is essential, ask the owner first.
- Never deploy to staging or production. Never publish to the Marketplace. Never change the app licensing or the Marketplace listing on the Marketplace itself.
- Do not sign up for any trial that asks for payment details. Do not post in forums, write reviews or contact vendors or auditors.
- Do not send the owner's email address or any credential to any service. Never print, log or commit a signing key.
- Write in plain English. Use short sentences and active voice. Do not use em dashes. Do not use words such as "immutable", "compliant", "certified" or "audit ready" unless the clause map supports them, or you quote a source.

## 15. Final report
- Each file you created or changed, with its full path, and the commit SHA or the word "uncommitted".
- The backlog status: done, BLOCKED (with the reason), or not started.
- Each LS and PX finding the build closed, with the test that proves it.
- Before and after numbers for each benchmark task and each size and time budget.
- The USPs that the shipped build now delivers, each with its proof (source ID, test name, or measurement). Separately, the USPs that are still not true, and the items that would make them true.
- The compliance wording the build now supports, clause by clause.
- All live writes from 12.4.
- The test and coverage summary, and the `forge lint` and `forge deploy` output.
