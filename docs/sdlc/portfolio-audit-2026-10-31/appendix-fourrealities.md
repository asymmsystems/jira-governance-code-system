# FourRealities commercial-readiness audit (reviewer 3 of 4)

Reviewer: Claude (independent reviewer). Date: 2026-10-31. Repo HEAD: 5097bf5 (`git log` output: "feat(fourrealities): remediate audit defects and deliver trustworthy delivery integrity pipeline").
Scope: apps/fourrealities. Mode: read-only. I made no change under jira-governance-code-system/.

## 1. Header

### 1.1 Files read (md5sum)

Read in full:

| md5 | File |
|---|---|
| 8d899447d058011f372e684fd8c79cf7 | apps/fourrealities/manifest.yml |
| 1171c2ebb3d06ca61bbb897046cd4eeb | apps/fourrealities/package.json |
| cb00b66f256c375c3fba8f3ee535e42b | apps/fourrealities/tsconfig.json |
| b4867e2c3c4d5c1d066f606ef4fa8294 | apps/fourrealities/jest.config.js |
| 15b19eed74ab3b67ca63fb3f7d7809d2 | apps/fourrealities/src/index.ts (863 lines) |
| 8b86d8d75f7dd91bff490309118b245b | apps/fourrealities/src/domain/metrics-engine.ts (428 lines) |
| 991c2861038bc501fc5419ab86ea2500 | apps/fourrealities/src/domain/models.ts (124 lines) |
| 929270a7fe1e342dd633921813c812ba | apps/fourrealities/src/storage/metrics-repository.ts (82 lines) |
| 3437d77524e88bae66d2fdd3ef5ee9d8 | apps/fourrealities/src/frontend/index.tsx (1093 lines) |
| 159447cc1765f0caa3a32c1ac79271e9 | apps/fourrealities/test/index.test.ts (885 lines) |
| ddca38d0c4a938520357c4aee25d9174 | apps/fourrealities/test/domain/metrics-engine.test.ts (371 lines) |
| 8bc00e15e3041eb1fa57bfbba00d2193 | apps/fourrealities/test/storage/metrics-repository.test.ts (146 lines) |
| af3532d5f7ef06b760414c74aec7e953 | docs/marketplace/fourrealities-listing.md |
| 357ee449bf38ba78c81a57962dba11ae | docs/spec/fourrealities-spec.md |

Read in part (property-write sites only, as the brief allows):

| md5 | File | Lines read |
|---|---|---|
| a8349fba7ac3a88e94d211eb6655fda5 | apps/ledgerseal/src/index.ts | 120-150, 200-330 |
| 3dab929eb4abaf50aaa387648fb8b569 | apps/ledgerseal/src/domain/crypto.ts | 28-50 |
| fdc8fa925acd7f32a2b7354e42679b92 | apps/definitionguard/src/index.ts | 140-175, 235-330 |

Not read: dist/ (build output), coverage/ (old report), static/icons/icon.svg, README.md (not evidence).

### 1.2 Commands run

1. `flatpak-spawn --host bash -c 'cd .../apps/fourrealities && npx tsc --noEmit -p .'`
   Result: no output, exit code 0. Zero type errors.
2. `flatpak-spawn --host bash -c 'cd .../apps/fourrealities && npx jest --coverage --coverageDirectory=/home/fahimfarookme/Documents/projects/jira-governance/.tmp/cache/portfolio-audit/cov-fourrealities'`
   Result: Test Suites 3 passed, 3 total. Tests 54 passed, 54 total. Time 283 s. Exit code 0.

```
File                    | % Stmts | % Branch | % Funcs | % Lines | Uncovered Line #s
All files               |   98.62 |    90.33 |   92.18 |   98.71 |
  index.ts              |   97.67 |    88.46 |   88.09 |    97.9 | 49,287,395-398,433
  metrics-engine.ts     |     100 |    93.46 |     100 |     100 | 94,213-216,353-356,394
  metrics-repository.ts |     100 |      100 |     100 |     100 |
```

Coverage exclusions (jest.config.js:6-10): `src/**/*.d.ts` and `src/frontend/**`. The 1093-line frontend has zero tests and does not count. models.ts holds types only, so it does not appear.

3. `grep -oE '\bany\b'` counts: src/index.ts 38, src/frontend/index.tsx 17, src/storage/metrics-repository.ts 1, domain 0. Total 56.
4. A local Python size estimate of one realistic `IssueIntegrityScore` JSON object (no network). Result: 992 bytes per issue.

## 2. Verdict table

| # | Question | Verdict | Key evidence |
|---|---|---|---|
| 1 | Tenant isolation | FAIL | Project page has no issue in context, so `sealIssue`, `completeDod`, `recordException`, `linkDecision` act on any payload `issueId` (index.ts:590, 693, 764, 528). `recordIssueSignals` writes any issue's KVS record (index.ts:478). Dashboard reads asApp (index.ts:272). |
| 2 | asUser vs asApp | FAIL | Seal and DoD writes fall back to asApp on any non-2xx, including 403 (index.ts:667-676, 738-747). Reads are asApp. accountId comes from `context.accountId` (correct) with fallback strings. |
| 3 | Manifest | PARTIAL | nodejs22.x (manifest.yml:37-38). Scopes read:jira-work, write:jira-work, storage:app (40-44). No scheduled trigger. Listing claims no write scope. dev-status calls may need a dev-info scope (Inferred). |
| 4 | KVS | FAIL | History key stores 10 full snapshots (metrics-repository.ts:38-48). Size exceeds any Forge value limit for normal projects. Read-modify-write race. N+1 reads. |
| 5 | Jira REST hygiene | FAIL | `/search/jql` with `startAt`, no `nextPageToken` (index.ts:271-289). Silent 200-issue cap. No 429 retry. |
| 6 | UI Kit safety | PARTIAL | No raw HTML. Text renders as Text. But hooks-order defect crashes the dashboard (index.tsx:300, 312 vs 585-596). |
| 7 | Type safety | PARTIAL | tsc exit 0. 56 `any`. Resolver payloads are untyped. |
| 8 | Tests | PARTIAL | Global 98.62/90.33/92.18/98.71 passes 90 %. index.ts branch 88.46 %, funcs 88.09 %. Frontend excluded. asUser and asApp share one mock. |
| 9 | Sprint Trend | PARTIAL | Computed from stored snapshots, not constants. Baseline is the scan before last. It is per page view, not per sprint. |
| 10 | Biggest mover | PARTIAL | Real diff of rate fields between snapshots (metrics-engine.ts:378-398). Same wrong baseline. Units mislabelled. |
| 11 | 1-click remediations | FAIL | DoD items arrive pre-ticked and the server trusts them. Seal forges a LedgerSeal-shaped property. Exception self-approves. |
| 12 | Gate data sources | FAIL | Intent: keywords. Code (dashboard): substring of a hard-coded custom field. Audit: property existence only. No hash check. |
| 13 | Other synthetic data | FAIL | Hard-coded 5-item DoD list, pre-ticked (index.tsx:110-116). Pre-filled ADR title and exception reason. Fabricated signal reconstruction (index.ts:487-501). |
| 14 | Metrics engine | PARTIAL | No divide-by-zero. But early-stage issues score 100 and inflate the average. Recoverable points are wrong constants. |
| 15 | Metaphor and glyphs | PARTIAL | Glyph plus colour plus label on pills. Mini row has no gate names. Arrows do not show causality. |
| 16 | Information architecture | PARTIAL | Hero, 4 cards, 2 button rows, table, modal on one page. Remediation modals missing on the dashboard. |
| 17 | State-changing actions | FAIL | Modals exist, but the seal modal shows check marks next to BLOCKED gates and a hard-coded "DoD: Complete". Success text claims "gate verified" before re-check. |
| 18 | ADS fidelity | PARTIAL | Lozenge and Badge appearances, no hex. Modals close by onClose and Cancel. `Inline` rows do not wrap on narrow widths. |

## 3. Findings

### FR-01 Critical. Project dashboard violates React hook order and crashes after load
- Evidence: Observed-code. Runtime effect Inferred (high confidence). The lead auditor should confirm live.
- Location: src/frontend/index.tsx:300-307 (early return while `loading`), 312 (early return for issue view), 585, 590, 596 (three `useMemo` calls after those returns).
- Mechanism: The first render has `loading = true` and returns before the `useMemo` calls. The next render has `loading = false` and calls three more hooks. React 18 throws "Rendered more hooks than during the previous render" (minified error 310). "Refresh Scan" sets `loading` again and gives the opposite error (300).
- Failure scenario: A user opens the FourRealities project page. The spinner shows. Then the page fails with a React error and no dashboard renders. Also, when `getIssueAlignment` throws in the issue panel, `issueScore` stays null, so the code falls through to the dashboard branch and crashes the same way. The user never sees the error text.
- Fix: Move all `useMemo` calls above the first conditional return. Add a frontend render test (react-test-renderer or @forge/react test utilities) that renders loading, then loaded.

### FR-02 Critical. "Seal Issue" forges a LedgerSeal certificate and can hide real tamper evidence
- Evidence: Observed-code.
- Location: src/index.ts:584-682. Compare apps/ledgerseal/src/domain/crypto.ts:34-36 and apps/ledgerseal/src/index.ts:233-242, 300-315.
- Mechanism: FourRealities hashes only `{issueId, issueKey, summary, status, isDoDSatisfied, sealedAt, sealedBy}` (index.ts:630-641). It builds `certificateId = "LS-" + first 8 hex chars` (642). LedgerSeal uses `crypto.randomUUID()` for the id and `computeSnapshotHash` over its canonical snapshot, and stores the certificate in its own KVS. FourRealities then PUTs `ledgerseal-cert` with `status: 'SEAL_VALID'` (657-672). LedgerSeal never holds this certificate. LedgerSeal only re-syncs the property when it has an `activeCert` in its own KVS (ledgerseal/src/index.ts:300-302).
- Failure scenario 1: LedgerSeal detected tampering and wrote `status: 'SEAL_BROKEN'` (ledgerseal/src/index.ts:130-142). A user clicks "Seal Issue" in FourRealities. The property now says `SEAL_VALID`. The tamper evidence on the issue is gone until LedgerSeal runs `verifyIssue` again.
- Failure scenario 2: No LedgerSeal seal exists. FourRealities writes a fake `SEAL_VALID`. The FourRealities Audit gate passes. The LedgerSeal panel shows "not sealed". An auditor sees two different answers.
- Fix: Remove `sealIssue` as a writer. Deep-link to the LedgerSeal panel instead. FourRealities must only read `ledgerseal-cert`.

### FR-03 Critical. "Complete DoD" ticks every item by default and the server trusts the client
- Evidence: Observed-code.
- Location: src/frontend/index.tsx:110-116 (`completed: true` on all 5 items), 197 (re-ticks on open). src/index.ts:703-710 (counts `i.completed` from payload), 728-747 (PUT `definitionguard-dod`, asApp fallback).
- Failure scenario: A developer on a Done issue clicks "Review & Complete DoD", then "Confirm & Record DoD". Two clicks. No item is checked against tests, PRs, or scans. The `definitionguard-dod` property now says `isFullySatisfied: true`. DefinitionGuard's own KVS checklist is unchanged, so DefinitionGuard still shows the checklist as open. The next DefinitionGuard toggle overwrites the property again (definitionguard/src/index.ts:247-259). The two apps disagree.
- Also: the 5 items are a generic list. They are not the project template that DefinitionGuard configures. `items` has no size cap; a large array exceeds the 32 KB entity-property limit (Inferred) and fails the PUT.
- Fix: Remove `completeDod`. Read `definitionguard-dod` only. Link to the DefinitionGuard panel.

### FR-04 Critical. Audit gate trusts property existence, not a verified seal
- Evidence: Observed-code.
- Location: src/index.ts:216-221, 224-227.
- Mechanism: `isSealed` is true when the property has `status === 'SEAL_VALID'` or `valid === true`, `isCompromised` is not true, and `snapshotHash` is any truthy value. Nothing recomputes or verifies the hash. Issue entity properties are writable by any user with edit-issue permission through REST, and by any app.
- Failure scenario: A user runs `PUT /rest/api/3/issue/PROJ-9/properties/ledgerseal-cert` with `{"valid":true,"snapshotHash":"x"}` and `.../definitionguard-dod` with `{"satisfied":true}`. The Audit gate shows PASSED. The listing says "cryptographic audit seals".
- Fix: Treat the property as a hint only. Show "Sealed (per LedgerSeal)" and state that FourRealities does not verify the hash. For real verification, LedgerSeal must expose a signed or app-owned attestation (for example an app property or a Forge remote-free shared contract). Drop the `valid` and `satisfied` legacy aliases, which no sibling app writes.

### FR-05 High. Writes fall back to asApp after the user is denied (permission bypass)
- Evidence: Observed-code. Observed-test: test/index.test.ts:737-752 and 806-811 assert that a 403 for the user still returns success.
- Location: src/index.ts:667-676 (seal), 738-747 (DoD).
- Failure scenario: A user with browse-only permission on an issue calls `sealIssue`. The asUser PUT returns 403. The app then writes the property as the app. The user changed audit state on an issue they may not edit.
- Fix: Never fall back to asApp for a user action. Return the 403 with "You need Edit Issues permission on PROJ-9".

### FR-06 High. Payload issueId lets a caller act on any issue in any project
- Evidence: Observed-code.
- Location: src/index.ts:527-533, 589-594, 692-697, 763-768. The check only runs when the context has an issue. On the project page (jira:projectPage) the context has no issue, so `payload.issueId` wins.
- Failure scenario: From the project page of project A, a caller invokes `recordException` with `issueId` of an issue in project B. The KVS record `fr:issue:<id>:exception` is written before any Jira call (index.ts:792-794). The Jira write fails silently (809). Project B's dashboard now shows the Code gate PASSED for that issue (index.ts:295, metrics-engine.ts:45-46). `sealIssue` and `completeDod` do the same with the asApp fallback.
- Fix: On the project page, fetch the issue as the user and check that its project key equals `context.extension.project.key`. Reject otherwise.

### FR-07 High. Snapshot history exceeds the Forge KVS value limit and then breaks every dashboard load
- Evidence: Observed-code for the structure. Size is Inferred from a measured estimate of 992 bytes per issue score.
- Location: src/storage/metrics-repository.ts:38-48. src/index.ts:339.
- Mechanism: The `:history` key holds an array of up to 10 full `ProjectAuditSnapshot` objects, each with all `issueScores`. The brief states a 32 KB limit. I recall the current Forge KVS limit as 240 KiB per value, but I did not verify it in this session. Under 32 KB, the `:latest` key alone fails above about 33 issues. Under 240 KiB, the history key fails once 10 snapshots of about 24 issues accumulate. At 200 issues, one snapshot is about 198 KB and the history would need about 1.98 MB.
- Failure scenario: A 60-issue project. After a few page views, `storage.set(history)` throws. `getProjectDashboard` rejects. Every later load fails, because the stored history is never trimmed below the limit.
- Fix: Store only summary metrics in history (a few hundred bytes each). Store issue scores per issue key, or not at all. Add a size guard.

### FR-08 High. `/search/jql` pagination uses startAt, so page 2 repeats page 1
- Evidence: Observed-code. API behaviour Inferred from the Atlassian enhanced-search contract (it pages by `nextPageToken` and does not document `startAt` or `total`).
- Location: src/index.ts:270-289.
- Failure scenario: A project with 150 issues. Page 1 returns 100 issues. The loop sends `startAt=100`, which the endpoint ignores, and receives the same 100 issues. The dashboard shows 200 rows with 100 duplicates. All rates use a doubled denominator. DynamicTable gets duplicate row keys (index.tsx:638). Projects above 200 issues are cut silently with no notice.
- Also: no 429 or 5xx retry anywhere. One throttled call shows "Live Jira sync failed".
- Fix: Loop on `nextPageToken` until `isLast`. Show "showing N of M" when capped. Add retry with `Retry-After`.

### FR-09 High. Code gate on the dashboard is a substring heuristic on a guessed field
- Evidence: Observed-code. Real field content Inferred.
- Location: src/index.ts:297 (dashboard passes `undefined` for PR data), 204-213 (checks `customfield_10000` string for "pullrequest" and "APPROVED"). test/index.test.ts:296 uses an invented `reviewStatus=APPROVED` fixture.
- Mechanism: The Development field id differs per site. Its summary string reports PR state and counts. I do not know of an approval token in it. So on the dashboard, a Done issue with a merged PR scores Code 40 and BLOCKED unless someone files an exception.
- Second path: the issue panel calls the undocumented `/rest/dev-status/latest/issue/detail` for stash, github and bitbucket (index.ts:396-398). It looks for `reviewers[].approvalStatus === 'APPROVED'` or `pr.status === 'APPROVED'` (197-199). I could not confirm these field names. The app has no dev-info scope. The endpoint may refuse asApp calls (Inferred).
- Failure scenario: The same issue shows Code PASSED in the issue panel and Code BLOCKED on the dashboard.
- Fix: Use one data path for both views. Use the supported development-information data the app can legally read, discover the field id by name, and label the gate "heuristic" until approval data is real.

### FR-10 High. "Explain: No Code Change" self-approves the Code gate
- Evidence: Observed-code.
- Location: src/index.ts:758-812, metrics-engine.ts:45-46 and 137-138. Frontend pre-fills the reason (index.tsx:154, 209) and shows the button whenever Code is BLOCKED (376-380), including when a PR exists but has no approval.
- Failure scenario: A developer merges an unreviewed PR. The Code gate is BLOCKED. The developer clicks "Explain: No Code Change", then "Save Exception". The pre-filled reason is accepted. Code is now PASSED with score 100. M29 "review compliance" counts it as compliant (metrics-engine.ts:310). The listing says "Guarantee that no code bypasses mandatory peer review".
- Fix: Hide the exception when `prCount > 0`. Require a second approver, or show exceptions as their own state ("Excepted"), not PASSED. Do not pre-fill the reason.

### FR-11 High. Project-page remediation buttons open nothing
- Evidence: Observed-code.
- Location: src/frontend/index.tsx:420-573 render the four remediation modals only inside the issue-view branch. The dashboard branch (701-1083) has the buttons (1019-1047) but no remediation modal.
- Failure scenario: A lead opens "Inspect" on a row and clicks "Link Decision (ADR)". State changes, but nothing appears. Errors set by handlers show at the top of the page, behind the open Inspect modal.
- Fix: Render the remediation modals in both branches, or remove the buttons from the dashboard.

### FR-12 High. `recordIssueSignals` accepts fully client-forged signals
- Evidence: Observed-code. No frontend caller (grep of src/frontend finds none). The resolver is still callable through `invoke`.
- Location: src/index.ts:449-516, 843-845.
- Failure scenario: A caller sends `signals` with `hasCryptographicSeal: true` and any `issueId`. The app stores it at `fr:issue:<id>:signals` and inserts it into the project snapshot and history. `getIssueAlignment` shows this forged record whenever the live Jira call fails (index.ts:437-440). The forged snapshot also becomes a trend baseline. Lines 487-501 rebuild signals from scores with invented values (`transitionCount: 1`, `regressionCount` from the process score).
- Fix: Delete this resolver. Signals must come from Jira only.

### FR-13 Medium. Intent gate is a keyword heuristic and the UI pre-fills a passing title
- Evidence: Observed-code.
- Location: src/index.ts:103-174. Frontend pre-fills `ADR: Architecture Decision for <key>` (index.tsx:190).
- Mechanism: Any remote link whose title contains "adr", "spec", "decision" and so on passes. Any issue link type whose name contains "implement", "design" or "document" passes (139, 145-148). FourRealities does not call Confluence.
- Failure scenario: A user pastes `https://example.com` and keeps the pre-filled title. The title contains "adr". Intent PASSED. Words like "inspection" contain "spec" and also pass.
- Fix: Require a Confluence page link (app-link remote link with a Confluence `globalId`) or a configured link type. Do not pre-fill the title.

### FR-14 Medium. Early-stage issues score 100 % and inflate the project average
- Evidence: Observed-code.
- Location: metrics-engine.ts:159-178 (RAI 100 and LOW when no gate applies), 322 (added to `sumRAI`), 336-337 (counted healthy). `UNRATED` exists in the type but is never assigned.
- Failure scenario: A project with 80 untouched To Do issues and 20 bad Done issues at 30 %. Average RAI is (80 x 100 + 20 x 30) / 100 = 86 %. The hero lozenge is green. Risk distribution shows 80 Low.
- Fix: Mark these issues UNRATED. Exclude them from the average and from the healthy count. Show the count separately.

### FR-15 Medium. Trend baseline is the scan before last, and a "scan" is any page view
- Evidence: Observed-code.
- Location: src/index.ts:322 reads `getPreviousProjectSnapshot` before saving. metrics-repository.ts:54-61 returns `history[length - 2]`, which before the save is two scans back. The UI says "pts vs last scan" (index.tsx:731). The repository test (metrics-repository.test.ts:86-98) reads after the save and hides this.
- Also: every page view and every Refresh writes a snapshot (index.ts:339). Trend is noise between page views. It is not a sprint trend. `sprintName` is the first sprint of the newest issue that has one (index.ts:230-231, metrics-engine.ts:272). The Sprint field array often lists older sprints first, so the label may name a closed sprint (Inferred). The hero shows "86% ALIGNED · Sprint 12" for a whole-project score.
- `trendNotice` says "minimum 10 completed issues" (metrics-engine.ts:292, 402). The code never enforces that.
- Fix: Take snapshots on a schedule (scheduledTrigger) or per sprint close. Compare with the last stored snapshot. Use the active sprint from the Agile API, or drop the sprint label.

### FR-16 Medium. Biggest mover units are wrong
- Evidence: Observed-code.
- Location: metrics-engine.ts:383-395. The delta is percentage points of a rate, but the text says "N pts change in decision links", "sealed issues" and so on. It also inherits the FR-15 baseline error.
- Fix: Say "Intent rate up 12 percentage points (from 40 % to 52 %)".

### FR-17 Medium. Recoverable points are fixed constants and are often wrong
- Evidence: Observed-code.
- Location: metrics-engine.ts:112-121.
- Failure scenario: An In Progress issue with no intent and no PR has 2 applicable gates (Intent 0, Process 100), so RAI is 50. Linking an ADR gives 100. The UI says "+25 pts recoverable ... reach 75 %".
- Fix: Recompute RAI with the gate set to its passed score and show the difference.

### FR-18 Medium. Dashboard reads all issues as the app, not as the viewer
- Evidence: Observed-code. Impact Inferred.
- Location: src/index.ts:272. The snapshot is shared per project in KVS (metrics-repository.ts:23).
- Failure scenario: A project uses issue security levels. A viewer without access sees summaries, assignees and findings of restricted issues in the triage table.
- Fix: Search with `asUser()`. If a shared cache is needed, filter rows per viewer.

### FR-19 Medium. N+1 KVS reads, read-modify-write race, timeout risk
- Evidence: Observed-code. Timing Inferred.
- Location: src/index.ts:292-298 (one sequential KVS `get` per issue, up to 200). metrics-repository.ts:42-47 (get, push, set on history with no transaction).
- Failure scenario: Two people load the dashboard at the same time. One history entry is lost. With 200 issues, two changelog-expanded searches plus 200 sequential KVS reads plus two large writes approach the resolver time limit.
- Fix: Read exceptions with one KVS query by key prefix. Use KVS transactions or per-snapshot keys.

### FR-20 Medium. Seal and success messages state things the code did not check
- Evidence: Observed-code.
- Location: index.tsx:514-516 (a check mark before `gates.intent` and `gates.code` even when BLOCKED; "Definition of Done: Complete" is hard-coded). 517-520 ("Irreversible", "immutable"; any user or app can overwrite the property). 227, 247, 268 ("Intent gate verified", "Audit gate verified") show before re-evaluation.
- Failure scenario: The user edits the ADR title to "Payment flow". The link is created. The message says "Intent gate verified". The re-evaluated gate is still BLOCKED.
- Fix: Show the real gate states. Build the success text from the re-evaluated score.

### FR-21 Medium. Metric denominators and empty states mislead
- Evidence: Observed-code.
- Location: metrics-engine.ts:368-369 (M11 and M29 divide by all issues, including To Do; the spec says "delivered features"). 367 and index.tsx:860-867 (no Done issues gives 0 % in red and "0 of 0 completed issues sealed"). 358-362 (weakest gate defaults to "audit" when all rates are equal, including an empty project). index.tsx:847 ("of N PRs peer approved" uses the issue count). 807, 827, 847 rebuild counts from a rounded percent, so they can be off by one.
- Fix: Use applicable (non-hollow) issues as the denominator. Show "n/a" when it is zero. Use real counts from `gateBreakdown`.

### FR-22 Medium. Tests do not protect the risky paths
- Evidence: Observed-test and Observed-code.
- Location: jest.config.js:9 excludes the frontend, so FR-01 and FR-11 pass CI. test/index.test.ts:30-41 maps `asApp` and `asUser` to the same mock, so no test can tell which principal made a call. Tests at 737-752 and 806-811 assert the permission bypass as correct. No test covers more than 100 issues, history ordering through `getProjectDashboard`, or value size. index.ts is below 90 % on branches (88.46) and functions (88.09); only the global threshold passes.
- Fix: Separate asApp and asUser mocks. Add frontend render tests. Add tests for pagination and the trend baseline.

### FR-23 Low. Responsive layout and glyph accessibility
- Evidence: Observed-code. Visual effect Inferred.
- Location: index.tsx:737-778, 794, 888-926 use `Inline` without `shouldWrap`. Four cards and seven buttons overflow at narrow widths. MiniGateRow (92-102) shows four glyphs with no gate names. Screen readers read "black circle", "multiplication x". The "──▶" separators are decorative text.
- Fix: Add `shouldWrap`. Add gate names or a tooltip in MiniGateRow. Hide the arrows from assistive technology.

### FR-24 Low. `recordException` reports success when Jira rejects the write
- Evidence: Observed-code.
- Location: src/index.ts:797-809. `.catch` handles only rejected promises. A 403 response resolves, so no fallback runs and the outer `catch {}` hides the error. The function returns `success: true`.
- Fix: Check `res.status` and return the error.

### FR-25 Low. Code hygiene
- Evidence: Observed-code.
- Location: 56 `any` (counts above). package.json:30 depends on `@forge/storage`, which src never imports. package.json:24 uses `@types/node` 20 with a nodejs22.x runtime. File headers use `@author Asymm Systems Team` (index.ts:3 and others); the portfolio rule is `@author Fahim Farook`. Status matching uses substrings (index.ts:67-71), so a status like "Latest build" counts as a test stage.
- Fix: Type the resolver payloads. Remove unused dependencies. Use status category ids, not names.

## 4. What is correct

- Runtime is nodejs22.x (manifest.yml:37-38). No external egress is declared.
- Project key and issue id come from `context.extension` first for reads (index.ts:314-315, 377-379).
- `linkDecision` writes as the user (index.ts:558) and validates http and https URLs (544-551).
- Audit records use `context.accountId` (index.ts:316, 629, 714, 788).
- The route template tag encodes the JQL project key (index.ts:273).
- No division by zero in the engine (metrics-engine.ts:274-296, 353-356, 364, 367).
- The trend is not hard-coded. It comes from stored snapshots (metrics-engine.ts:378-398), with an honest notice when no history exists.
- `averageRAI`, rates and gate counts are deterministic for the same input.
- Hollow gates for To Do work avoid punishing unstarted issues at the issue level.
- No raw HTML. All user strings render through `Text`. Every `invoke` has a try and catch with a message.
- No hex colours. Lozenge and Badge appearances follow ADS. Every modal has `onClose` and a Cancel button.
- Gate pills show glyph, colour and text, so colour is not the only signal there.
- tsc passes with strict mode (tsconfig.json:9).

## 5. Listing and spec over-claims

| Claim | Where | What the code does |
|---|---|---|
| "Align what was planned in Confluence" | listing:7, spec:6 | No Confluence call. Keywords in link titles and URLs (index.ts:103-174). |
| "committed in Git" | listing:7, spec:8 | Dashboard reads one guessed custom field string. Issue panel calls an undocumented dev-status API. No commit data. |
| "Guarantee that no code bypasses mandatory peer review" | listing:9 | Self-approved exception passes the gate (FR-10). Approval detection is a substring (FR-09). |
| "M11 ... percentage of completed issues" | listing:8, spec:12 | Divides by all fetched issues, including To Do (metrics-engine.ts:368). |
| "Directly aggregates LedgerSeal cryptographic audit seals" | listing:12, spec:9 | Reads property existence only. Also writes forged seals into LedgerSeal's key (FR-02, FR-04). |
| "Least Privilege: Restricted to read:jira-work and storage:app" | listing:24, spec:23 and 63-65 | Manifest also has write:jira-work (manifest.yml:43). The app writes remote links and properties. |
| "100% automated test coverage" | listing:25 | 98.62 % statements, 90.33 % branches, frontend excluded. |
| "Complies natively with SOC 2, ISO 27001, GDPR" | listing:19 | No code supports this. Compliance is a property of an organisation and an audit, not of an app. |
| "carries the official Runs on Atlassian badge" | listing:16 | Atlassian grants the badge. The code cannot claim it. No egress is declared, so it may qualify. |
| "Stored in @forge/storage" | spec:22, 68 | Code uses @forge/kvs (index.ts:8). |
| "Classifies issues with RAI < 60% as high risk" | spec:77 | Code uses < 50 CRITICAL, < 70 HIGH, < 85 MEDIUM (metrics-engine.ts:166-173). Hero uses 80/60 (index.tsx:634). |
| "real-time audit intelligence" | spec:24 | Snapshot per page view. No events, no triggers. |
| `fr:project:{key}:history`: "Historical RAI time-series records" | spec:70 | Stores full snapshots with all issue scores (FR-07). |
| Domain model `RealityAuditSnapshot.metrics/signals` | spec:49-56 | Code uses `ProjectAuditSnapshot.summary/issueScores`. |
| "Trend available after 2 scans (minimum 10 completed issues)" | UI, metrics-engine.ts:292 | The 10-issue minimum is not enforced. |

## 6. Cross-app integration facts

Forge KVS is per app. The only shared channel here is Jira issue entity properties.

### LedgerSeal writes `ledgerseal-cert` (all asApp)
- Seal: apps/ledgerseal/src/index.ts:233-242. Shape: `{status: 'SEAL_VALID', certificateId, snapshotHash, sealedAt, tamperedFieldCount: 0, isCompromised: false, lastVerifiedAt}`.
- Validator on tamper: apps/ledgerseal/src/index.ts:130-142. Shape: `{status: 'SEAL_BROKEN', certificateId, snapshotHash, sealedAt, tamperedFieldCount: 1, lastVerifiedAt}`. Note: no `isCompromised` field here.
- Verify sync: apps/ledgerseal/src/index.ts:300-315. Shape: `{status: analysis.status, certificateId, snapshotHash, sealedAt, tamperedFieldCount, isCompromised, lastVerifiedAt}`. Status values include SEAL_BROKEN and SEAL_COMPROMISED (comment at 263). It writes only when LedgerSeal's own KVS holds an `activeCert` (302).
- `certificateId` is a UUID from `crypto.randomUUID()` (apps/ledgerseal/src/domain/crypto.ts:34). `snapshotHash` comes from `computeSnapshotHash(snapshot)` (36).

### DefinitionGuard writes `definitionguard-dod` (all asApp)
- Init: apps/definitionguard/src/index.ts:158-166. Shape: `{isFullySatisfied, completedCount, totalCount, checklistHash}`.
- Toggle: apps/definitionguard/src/index.ts:249-257. Same shape.
- Reset: apps/definitionguard/src/index.ts:308-317. Same shape plus `lastModifiedAt`.

### What FourRealities reads
- Requests properties `ledgerseal-cert, ledgersealCert, definitionguard-dod, definitionguardDod` (index.ts:273, 393, 603). `ledgersealCert` and `definitionguardDod` are guesses; grep of both sibling apps finds no writer.
- Seal rule (index.ts:216-221): `status === 'SEAL_VALID' || valid === true`, `!isCompromised`, truthy `snapshotHash`. It matches LedgerSeal's key and SEAL_VALID value. It does not verify the hash. It also accepts a `valid` field that LedgerSeal never writes.
- DoD rule (index.ts:224-227): `isFullySatisfied === true || satisfied === true`. `isFullySatisfied` matches DefinitionGuard. `satisfied` does not exist in DefinitionGuard. `completedCount` and `totalCount` match.

### What FourRealities writes into the other apps' keys
- `ledgerseal-cert` with a FourRealities-made shape plus `valid: true` (index.ts:644-672). LedgerSeal never knows this certificate.
- `definitionguard-dod` with a FourRealities-made shape plus `satisfied`, `items`, `completedBy` (index.ts:716-743). DefinitionGuard's KVS state stays unchanged.
- Its own key `fourrealities-exception` (index.ts:798).

## 7. Suggestions

### Quick wins
1. Move the three `useMemo` calls above the early returns (FR-01).
2. Delete `sealIssue`, `completeDod` and `recordIssueSignals`. Replace the buttons with links to the LedgerSeal and DefinitionGuard panels (FR-02, FR-03, FR-12).
3. Remove every asApp fallback after a user write (FR-05).
4. Drop the `valid`, `satisfied`, `ledgersealCert`, `definitionguardDod` aliases.
5. Stop pre-filling the ADR title, exception reason and DoD ticks.
6. Fix listing text: scopes, coverage, Confluence, Git, compliance claims.

### Hardening
1. `/search/jql` with `nextPageToken`, a visible cap, and 429 retry (FR-08).
2. History stores only summaries; per-snapshot keys or KVS transactions (FR-07, FR-19).
3. Project-key check on every write that takes a payload issue id (FR-06).
4. Search as the user (FR-18).
5. One Code-gate data path for both views; label it heuristic until approval data is real (FR-09).
6. UNRATED issues out of the average (FR-14). Correct denominators (FR-21). Computed recoverable points (FR-17).
7. Separate asApp and asUser mocks. Frontend render tests. Per-file coverage threshold.

### Strategic UX
1. Make causality explicit. Show each gate as "evidence found / evidence missing / not yet applicable", with the source named ("Source: LedgerSeal property, not verified by FourRealities").
2. Show exceptions as a distinct "Excepted" state with who and why, not as PASSED.
3. Replace "Sprint" and per-view trends with a scheduled weekly snapshot and a small sparkline of RAI and the four rates.
4. Put remediation in one place: the issue panel. Keep the dashboard for triage with deep links.
5. Reduce the hero to RAI, scope, and trend. Move risk chips into the table filters.

## 8. Readiness score

**18 / 100.**

The domain engine is tidy, deterministic and well tested, and tsc is clean. But the product's core promise is trustworthy cross-app evidence, and the code breaks that promise in three ways. First, the project dashboard almost certainly crashes on load from a hook-order defect that no test covers, because the frontend is excluded from coverage. Second, the "1-click remediations" let a user pass the Audit gate in four clicks with pre-ticked DoD items and a self-made seal. They write into LedgerSeal's and DefinitionGuard's property keys, fall back to app permissions after a user is denied, and can overwrite a real SEAL_BROKEN status with SEAL_VALID. Third, the gates rest on keyword and substring heuristics, the Audit gate checks only property existence, and storage and pagination fail at modest project sizes. The listing over-claims scopes, coverage, Confluence and Git integration, and compliance. A paid listing needs the Critical and High items fixed and the listing rewritten.
