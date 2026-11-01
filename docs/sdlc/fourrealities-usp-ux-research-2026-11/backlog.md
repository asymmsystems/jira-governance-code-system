APPROVED 2026-11-01 B-01..B-28 (owner, in chat: "APPROVED now all"; [DEP], [MANIFEST] and [MIGRATE] flags approved; B-26 to B-28 approved but BLOCKED, see their items)

# FourRealities: ranked backlog

Status: approved. Part B in progress on branch `feature/fourrealities-research-build`. Paused before B-17 (2026-11-01) for the domain review in `architecture/decision/adr-00001-*`, `adr-00002-*` and `architecture/model/fourrealities-domain-model.org`. ADR-001 (Option C) and ADR-002 approved by the owner in chat on 2026-11-01; B-29 to B-32 below are approved.

- **Date:** 2026-11-01
- **Order:** release blockers first, in the order the brief requires (FR-01, FR-02 and FR-03, FR-12, FR-04, FR-05, FR-10, then FR-06 to FR-11 and PX-02). Then the U1 trust work, storage, UX and hygiene. B-26 to B-28 depend on work outside this loop and are listed for order only.
- **Baseline:** `tsc` and jest pass (T-01, T-02), so no B-00 item is needed.
- **Flags that need explicit owner approval:**
  - **[DEP]** adds or removes an npm dependency. `node_modules` is shared with LedgerSeal and other apps.
  - **[SCOPE]** changes a manifest scope.
  - **[MANIFEST]** adds a manifest module or block, with no scope change.
  - **[MIGRATE]** changes or deletes stored KVS data.
  - **[OTHER-APP]** needs a change in another app or a shared package.
- **Test types:** unit (pure module, node environment), resolver (resolver function with separate `asApp` and `asUser` mocks), UI render (`react-test-renderer`, UI Kit and bridge mocked), harness (`~/.cache/gemini-earning-fourrealities-research/harness`).

## Summary

| ID | Title | Serves | Closes or depends on | Size | Flags |
|---|---|---|---|---|---|
| B-01 | Dashboard renders: hook order fixed, first render test | UX tasks 1, 9 | FR-01, PX-03 (part) | S | none |
| B-02 | Delete the sibling-key writers; link to the producer panel instead | U1, U9 | FR-02, FR-03, FR-26, FR-20 (part), NF-02 | M | none |
| B-03 | Delete `recordIssueSignals` and the silent stale fallback | U1 | FR-12, NF-05 | S | [MIGRATE] |
| B-04 | Audit and Process gates read sibling properties as hints | U1, U2 | FR-04 | M | none |
| B-05 | User writes stay user writes; principal-aware tests | U1 | FR-05, FR-24, FR-22 (part) | S | none |
| B-06 | Exception is its own state: Excepted, with who and why | U1, U2, task 4 | FR-10, FR-20 (part) | M | none |
| B-07 | Project-key check on every payload issue id | U1 | FR-06 | S | none |
| B-08 | Bounded storage and a scheduled snapshot | Perf budgets, task 6 | FR-07, FR-15, FR-19, NF-06 | L | [MANIFEST] [MIGRATE] |
| B-09 | Correct paging, 429 retry, "Showing N of M" | Perf budgets, task 9 | FR-08 | M | none |
| B-10 | One Code-gate path, labelled heuristic | U1, U4 | FR-09, H11 | M | none |
| B-11 | Dashboard does triage only; remediation lives in the issue panel | Tasks 2 to 4 | FR-11 | S | none |
| B-12 | Listing v2 from the code | PX-02 | PX-02, research brief 4.3 | S | none |
| B-13 | Dashboard rows respect the viewer's permissions | U1 | FR-18 | M | none |
| B-14 | UNRATED issues, honest denominators and recoverable points | U6, task 9 | FR-14, FR-17, FR-21 | M | none |
| B-15 | Intent gate from link structure, same rule on both views | U1 | FR-13, NF-03 | M | none |
| B-16 | Honest gate states with a named source on every gate | U1, U2, tasks 2, 8 | FR-04 (UI), FR-23 (part) | M | none |
| B-17 | Feedback from the re-evaluated state | Task 3 | FR-20 | S | none; DONE 2026-11-01 |
| B-18 | Assignee, sprint and gate filters | Task 5 | NF-01 | S | none; DONE 2026-11-01 |
| B-19 | Four-week trend with denominators | Task 6 | FR-15, FR-16 | M | depends on B-08; DONE 2026-11-01 |
| B-20 | Accessibility and narrow-width layout | Task 8 | FR-23, NF-04 | S | none; DONE 2026-11-01 |
| B-21 | RAI shown as a secondary number, with its parts | H5 | FR-15 (label), H5 | S | none; DONE 2026-11-01 |
| B-22 | Pure UI logic in modules; per-file coverage | PX-03 | PX-03, FR-22 | M | none; DONE 2026-11-01 |
| B-23 | Marketplace licensing | PX-01 | PX-01 | S | [MANIFEST]; owner chose "B" 2026-11-01; DONE 2026-11-01 |
| B-24 | Code hygiene: headers, unused dependency, typed payloads | Portfolio rules | FR-25 | S | [DEP] (removal); DONE 2026-11-01 |
| B-25 | Read the HeroCoders `checklist` property as a labelled DoD hint | U7, H6 | NF-08 | M | none; DONE 2026-11-01 |
| B-26 | Verify signed LedgerSeal and DefinitionGuard v2 properties | U1, U7 | audit 5.1 to 5.3 | L | [OTHER-APP] (blocked) |
| B-27 | Code gate from Teamwork Graph approvals | U4 | H11 | L | [SCOPE] (blocked by platform) |
| B-28 | Publish signed `fourrealities-gates` for CascadePlan | Portfolio | audit 5.4 | L | [OTHER-APP] (blocked) |

## Items

### B-01. Dashboard renders: hook order fixed, first render test
- **Serves:** UX tasks 1 and 9; the base for every UI item.
- **Closes:** FR-01. Part of PX-03.
- **Acceptance criteria:**
  1. A render test mounts `FourRealitiesApp` in project context and sees the loading text, then the loaded dashboard, with no React error logged. It fails on the current code with "Rendered more hooks than during the previous render." (UI render; model: `probes/fr01-render.test.tsx`).
  2. The issue panel with a rejected `getIssueAlignment` shows an error message, not the dashboard and not a blank tree (UI render).
  3. Refresh (loading again after loaded) renders without a hook error (UI render).
  4. `src/frontend/**` is covered by jest coverage, through a separate coverage entry or by removing the exclusion (config check in the test run output).
- **Size:** S.

### B-02. Delete the sibling-key writers; link to the producer panel instead
- **Serves:** U1, U9.
- **Closes:** FR-02, FR-03, FR-26 (the hash code goes with `sealIssue`), FR-20 for the seal modal, NF-02.
- **Acceptance criteria:**
  1. The resolver definitions no longer include `sealIssue` or `completeDod`. A call to either rejects with "Resolver has no definition" (resolver).
  2. No source file contains a PUT to `ledgerseal-cert` or `definitionguard-dod` (unit: a test reads the `src` tree and asserts zero matches).
  3. The UI has no "Seal Issue", "Cryptographic Seal Issue", "Review & Complete DoD" button, and no DoD item list (UI render).
  4. The Audit and Process rows show "Open in LedgerSeal" and "Open in DefinitionGuard". A click calls `router.open` with the issue URL, and the link text names the panel (UI render, with `router.open` mocked and its argument asserted).
  5. The existing tests that assert seal and DoD writes are removed or rewritten to assert the absence of those writes (resolver).
- **Size:** M.

### B-03. Delete `recordIssueSignals` and the silent stale fallback
- **Closes:** FR-12, NF-05.
- **Acceptance criteria:**
  1. `recordIssueSignals` is not defined. A call rejects (resolver).
  2. When the Jira issue read fails, `getIssueAlignment` returns an error state with the HTTP status. It never returns stored signals (resolver).
  3. The `fr:issue:{id}:signals` keys are no longer written (resolver: storage mock records zero writes with that prefix).
- **Migration [MIGRATE]:** the old `fr:issue:*:signals` keys are left unread. Deleting them needs a one-off clean-up; the owner decides.
- **Size:** S.

### B-04. Audit and Process gates read sibling properties as hints
- **Serves:** U1, U2.
- **Closes:** FR-04. Depends on B-02.
- **Acceptance criteria:**
  1. The aliases `ledgersealCert`, `definitionguardDod`, `valid` and `satisfied` are not read. A property `{valid: true, snapshotHash: "x"}` gives "Evidence missing" (unit).
  2. `ledgerseal-cert` with `status: SEAL_VALID` and a 64-hex `snapshotHash` gives "Evidence found (not verified)", with source "LedgerSeal property ledgerseal-cert" (unit).
  3. `SEAL_BROKEN` or `SEAL_COMPROMISED` gives "Evidence missing: seal broken" (unit).
  4. `definitionguard-dod` gives Process evidence from `completedCount` and `totalCount`, and "Evidence found (not verified)" only when `isFullySatisfied === true` and the counts agree (unit).
  5. The DEMO-26 shapes (T-05) give "Evidence missing: record shape not written by LedgerSeal" and "by DefinitionGuard" (unit, using the live shapes as fixtures).
  6. No code path or text says "verified" for a sibling property (unit: string scan of gate labels).
- **Size:** M.

### B-05. User writes stay user writes; principal-aware tests
- **Closes:** FR-05, FR-24. Part of FR-22.
- **Acceptance criteria:**
  1. The test file mocks `asApp` and `asUser` as separate functions, and each test can assert which principal made each call (resolver).
  2. `linkDecision` and `recordException` call only `asUser` for writes. A 403 returns `{success: false}` with "You need the Edit issues permission on KEY", and `asApp` is never called (resolver).
  3. `recordException` checks `res.status` and returns an error on any non-2xx (resolver).
  4. `recordException` saves the KVS record only after the Jira write succeeds (resolver: storage mock has no write on 403).
- **Size:** S.

### B-06. Exception is its own state: Excepted, with who and why
- **Serves:** U1, U2, UX task 4.
- **Closes:** FR-10. Part of FR-20.
- **Acceptance criteria:**
  1. A Code exception gives gate state `EXCEPTED`, never `PASSED` (unit).
  2. An excepted gate is excluded from the RAI average and from the M29 numerator and denominator (unit).
  3. The resolver rejects a Code exception when `prCount > 0` (resolver).
  4. The reason is required, at least 15 characters after trimming, and the modal opens with an empty reason (resolver, UI render).
  5. The panel shows "Excepted by <display name> on <date>: <reason>" (UI render).
  6. Rework reasons are stored as notes and do not change the Process state (unit).
- **Size:** M.

### B-07. Project-key check on every payload issue id
- **Closes:** FR-06.
- **Acceptance criteria:**
  1. In project context, a write with a payload issue id first reads the issue as the user. If its project key differs from `context.extension.project.key`, the resolver rejects and makes no write (resolver).
  2. In issue context, a payload id that differs from the context id is rejected (resolver; existing behaviour kept).
  3. If the user cannot read the issue (404 or 403), the resolver rejects with that status (resolver).
- **Size:** S.

### B-08. Bounded storage and a scheduled snapshot
- **Serves:** performance budgets; UX task 6.
- **Closes:** FR-07, FR-15, FR-19, NF-06.
- **Acceptance criteria:**
  1. History stores summaries only, one value per weekly snapshot or one bounded list of at most 52 summaries, each under 4 KiB (unit, harness).
  2. Issue scores are stored in chunks of at most 100 issues per key (harness: largest value at 1,000 issues is at most 100 KiB).
  3. A page view never writes history (resolver: zero history writes during `getProjectDashboard`).
  4. A `scheduledTrigger` (weekly) and a manual "Refresh now" build the snapshot. The trend compares with the last stored snapshot (resolver).
  5. Exceptions are read with one KVS query by key prefix or stored inside the snapshot. At most 3 + ceil(N / 100) KVS reads per view (harness).
  6. 52 consecutive views at 1,000 issues: 0 failures (harness).
- **Flags:** [MANIFEST] adds a `scheduledTrigger` module and its function. No scope change. [MIGRATE] the existing `fr:project:*:history` values can exceed 240 KiB and must be deleted or ignored on first run. The owner chooses.
- **Size:** L.

### B-09. Correct paging, 429 retry, "Showing N of M"
- **Closes:** FR-08.
- **Acceptance criteria:**
  1. The search loop pages with `nextPageToken` until `isLast` (resolver, with the harness Jira mock that ignores `startAt`).
  2. 300 and 1,000 issues give 300 and 1,000 unique rows, up to the configured cap (harness).
  3. When capped, the summary carries `shownCount` and `totalKnown`, and the UI shows "Showing N of M" (resolver, UI render).
  4. A 429 response with `Retry-After` is retried at most 3 times within the time budget, then returns an error state (resolver).
- **Size:** M.

### B-10. One Code-gate path, labelled heuristic
- **Serves:** U1, U4.
- **Closes:** FR-09. Follows H11.
- **Acceptance criteria:**
  1. Neither view calls `/rest/dev-status/` (resolver: no call path matches).
  2. The Development field id is found by name through `/rest/api/3/field`, and is not fixed to `customfield_10000` (resolver).
  3. Both views use the same function. The same issue fixture gives the same Code state in both (unit, resolver).
  4. A merged or open PR gives "Evidence found (heuristic): PR exists; approval not readable by apps", never "approved" (unit).
  5. No PR on a Done issue gives "Evidence missing" (unit).
- **Size:** M.

### B-11. Dashboard does triage only; remediation lives in the issue panel
- **Closes:** FR-11.
- **Acceptance criteria:**
  1. The Inspect modal has no remediation buttons. It has "Open issue", which calls `router.open` (UI render).
  2. No dashboard control changes state without visible output (UI render: every button has an asserted effect).
- **Size:** S.

### B-12. Listing v2 from the code
- **Closes:** PX-02.
- **Acceptance criteria:**
  1. `docs/marketplace/fourrealities-listing-v2.md` exists. The original is unchanged (git diff check).
  2. The scopes are listed exactly as in `manifest.yml` (scripted comparison).
  3. No claim from research brief 4.3 appears. No compliance, certification or badge claim (scripted word list check).
  4. Every capability named is backed by a passing test name or a Part A source ID (review checklist in `round-log.md`).
- **Size:** S. Written in Loop 3 (section 12.5 of the agent definition).

### B-13. Dashboard rows respect the viewer's permissions
- **Closes:** FR-18. Depends on B-08.
- **Acceptance criteria:**
  1. On each view, the resolver runs a search as the user with `fields=id` and returns only stored rows whose ids are in that result (resolver, with `asUser` returning a subset).
  2. Summary counts are recomputed for the visible rows, or labelled "project-wide, including issues you cannot see". The owner picks one (resolver).
- **Size:** M.

### B-14. UNRATED issues, honest denominators and recoverable points
- **Closes:** FR-14, FR-17, FR-21.
- **Acceptance criteria:**
  1. An issue with no applicable gate is `UNRATED`. It is excluded from the average and from the healthy count. The summary shows the UNRATED count (unit). Fixture: 80 To Do and 20 poor Done issues give the poor issues' mean, not 86 (unit).
  2. M11 and M29 divide by issues where the gate applies (not hollow, not excepted). A zero denominator gives `null`, which the UI shows as "n/a" (unit, UI render).
  3. Recoverable points equal the RAI recomputed with the blocking gate passed, minus the current RAI (unit; the audit FR-17 case gives 50).
  4. Card counts come from `gateBreakdown`, not from a rounded percent (unit, UI render).
- **Size:** M.

### B-15. Intent gate from link structure, same rule on both views
- **Closes:** FR-13, NF-03.
- **Acceptance criteria:**
  1. Intent passes on: a remote link whose application is Confluence (remote link `application.type` or `globalId`), or an issue link of a link type listed in a project setting. Title keywords alone never pass (unit).
  2. "inspection" in a title does not pass (unit).
  3. The dashboard reads remote links in the scheduled snapshot, within the rate budget, so both views agree on the same fixture (resolver, harness call count).
  4. The link modal opens with empty URL and title (UI render).
- **Size:** M. A settings page for link types is out of scope; the default list is in the spec.

### B-16. Honest gate states with a named source on every gate
- **Serves:** U1 core, U2; UX tasks 2 and 8.
- **Acceptance criteria:**
  1. The model has the seven states in `ux-spec.md` section 2, and each gate result carries `source` and `verification` ("verified", "not verified", "heuristic") (unit).
  2. Every gate row shows state, source and missing evidence in words (UI render).
  3. "Not applicable" never counts as pass or fail (unit).
- **Size:** M.

### B-17. Feedback from the re-evaluated state
- **Closes:** FR-20.
- **Acceptance criteria:**
  1. After `linkDecision`, the success text appears only if the re-read gate state is "Evidence found". Otherwise the text names the reason (UI render, two cases).
  2. The message renders in a status region or a component that assistive technology announces (UI render: element type asserted).
- **Size:** S.

### B-18. Assignee, sprint and gate filters
- **Closes:** NF-01.
- **Acceptance criteria:**
  1. Assignee and Gate `Select` controls render. Sprint renders only when at least one row has a sprint (UI render).
  2. Filter logic is a pure function with unit tests for each filter and their combination (unit).
  3. The count reads "Showing X of Y rated issues" (UI render).
- **Size:** S.

### B-19. Four-week trend with denominators
- **Closes:** FR-15, FR-16. Depends on B-08.
- **Acceptance criteria:**
  1. The trend shows the last four weekly snapshots, as a text table with numerators and denominators, plus a `LineChart` (UI render).
  2. With fewer than two snapshots it shows the date of the next snapshot (UI render).
  3. Mover text says "percentage points" and gives both values, for example "Intent rate up 12 percentage points (40% to 52%)" (unit).
- **Size:** M.

### B-20. Accessibility and narrow-width layout
- **Closes:** FR-23, NF-04.
- **Acceptance criteria:**
  1. Every `Inline` row that holds cards or buttons sets `shouldWrap` (UI render: props asserted).
  2. Table gate chips render text names ("Intent: evidence missing"), not bare glyphs (UI render).
  3. No "──▶" text and no U+2014 character in any UI string (unit: string scan of `src`).
  4. Every `ProgressBar` has an `ariaLabel` (UI render).
- **Size:** S.

### B-21. RAI shown as a secondary number, with its parts
- **Serves:** H5 mitigations (CM-02, CM-03, CM-10).
- **Acceptance criteria:**
  1. The hero shows the four gate rates first. RAI follows with "n of 4 gates applicable" and the issue count (UI render).
  2. No sprint name appears next to a project-wide score (UI render).
  3. No view ranks people or teams by RAI (UI render: no assignee ranking control).
- **Size:** S.

### B-22. Pure UI logic in modules; per-file coverage
- **Closes:** PX-03, FR-22.
- **Acceptance criteria:**
  1. Gate labels, filters, recoverable points and trend text live in modules with no React import, tested in the node environment (unit).
  2. `jest.config.js` enforces 90% branch coverage per changed file (config, test output).
  3. No test asserts only `toBeDefined()` (unit: string scan of `test`).
- **Size:** M. If a test needs `jest-environment-jsdom` or `@testing-library`, stop and ask (shared `node_modules`).

### B-23. Marketplace licensing
- **Closes:** PX-01.
- **Acceptance criteria:**
  1. `manifest.yml` has `app.licensing.enabled: true` [MANIFEST] (config test).
  2. Each resolver returns a "licence inactive" error state when `context.license.isActive === false` in production, and the UI shows an ADS message (resolver, UI render).
- **Size:** S.

### B-24. Code hygiene: headers, unused dependency, typed payloads
- **Closes:** FR-25.
- **Acceptance criteria:**
  1. Every FourRealities source file header says `@author Fahim Farook` (unit: header scan).
  2. `@forge/storage` is removed from `package.json` [DEP]. No `npm install` runs, so the shared `node_modules` does not change.
  3. Resolver payloads have TypeScript types; `any` count in `src` drops below 10 (tsc, grep count).
  4. Status matching uses `statusCategory.key`, not name substrings (unit).
- **Size:** S.

### B-25. Read the HeroCoders `checklist` property as a labelled DoD hint
- **Serves:** U7, H6.
- **Acceptance criteria:**
  1. When `definitionguard-dod` is absent and the `checklist` property is present, Process uses `uncheckedMandatoryItems` and shows "Source: Checklists for Jira (HeroCoders) property checklist, not verified by FourRealities" (unit, using the documented shape from DD-21).
  2. The search requests the extra property in the same call (resolver: one search call).
- **Size:** M. Shape taken from vendor docs; verify on a site with the app before release.

### B-26. Verify signed LedgerSeal and DefinitionGuard v2 properties
- **Status:** BLOCKED (2026-11-01). LedgerSeal and DefinitionGuard do not write signed v2 properties, and the agent definition (11.4) forbids changes to those apps in this loop.
- **Depends on:** LedgerSeal and DefinitionGuard writing signed v2 properties (audit 5.1, 5.2), and the `packages/integrity-contract` package [OTHER-APP]. Blocked in this loop (agent definition 11.4).
- **Acceptance criteria (for later):** the audit 5.3 table, row by row, as unit tests; "verified" appears only for a valid signature over the right `issueId` with a fresh `issuedAt`.
- **Size:** L.

### B-27. Code gate from Teamwork Graph approvals
- **Status:** BLOCKED (2026-11-01). Teamwork Graph is Early Access with test-site installs only (RF-03).
- **Depends on:** Teamwork Graph reaching a release phase that allows production installs (RF-03). [SCOPE] adds `read:graph:pull-request:external` and `read:graph:issue:jira` (NA-08), and needs an org admin to install (NA-09).
- **Acceptance criteria (for later):** a spike proves an issue-to-PR traversal (NA-10, NA-11) on a test site; the gate then shows "verified" approval data.
- **Size:** L.

### B-28. Publish signed `fourrealities-gates` for CascadePlan
- **Status:** BLOCKED (2026-11-01). Depends on B-26 and on a signing key decision.
- **Depends on:** B-26 and the contract package [OTHER-APP].
- **Size:** L.

## Scope note on `write:jira-work`

`linkDecision` writes a remote link as the user, and `recordException` writes the app's own `fourrealities-exception` property. Both need `write:jira-work`. The plan keeps the scope and states it in the listing (B-12). Removing both features would allow a read-only scope. That choice is the owner's.

## Added by the domain review (approved 2026-11-01, owner, in chat: "C")

| ID | Title | Source | Flags |
|---|---|---|---|
| B-29 | Volatility layering: contracts, Default implementations, one wiring point, architecture test; no behaviour change | ADR-002 | none |
| B-30 | Gate exception lifecycle: append-only events; approve, reject and revoke by a project administrator (`ADMINISTER_PROJECTS`, checked as the user) who is not the requester or the assignee; withdraw by the requester; migration of v2 records | ADR-001 Patterns 3, 5 (Option C) | [MIGRATE] DONE 2026-11-01 |
| B-31 | Evidence catalog as data (Knowledge Level); observation carries `method` and `evidence_ref` | ADR-001 Patterns 2, 4 | none; DONE 2026-11-01 |
| B-32 | Rework notes as an append-only list | ADR-001 Pattern 6 | [MIGRATE] DONE 2026-11-01 |

Order: B-29, B-30, B-31, B-32, then B-17 to B-25.

## Added by the UX consultation review (approved 2026-11-01, owner, in chat: "Approved all yor suggestions")

The owner's pasted consultation was reviewed item by item in chat; rejected items (approval-based Code wording, a FourRealities seal action, DoD checkboxes that write DefinitionGuard data, title-overlap ADR suggestions) stay out because of research H11, FR-13, T-05 and the hard rules.

| ID | Title | Source | Flags |
|---|---|---|---|
| B-33 | Four-gate pipeline: one row Intent, Process, Code, Audit with glyph, colour and name, a tooltip per gate, the same on every surface | consultation A, E | none |
| B-34 | Triage table: compact pipeline instead of four text boxes; "Top finding" column | consultation B3 | none |
| B-35 | Reality cards: plain question, rate, progress bar with label, plain count, action only when something is missing; metric codes in a tooltip | consultation B2 | none |
| B-36 | Drift sentence from the first missing gate, on the panel, the table and the Inspect modal | consultation A | none |
| B-37 | "Alignment n%" with risk as a small tag, the weakest gate named, "Why n%?" with each gate's part and the points a fix recovers; hero delta against the previous week, shown only with 10 or more rated issues | consultation A, B1 | none |
| B-38 | Compact issue-context view: pipeline, alignment line, next action, "See all findings" | consultation C | none |
| B-39 | Risk row: Critical, High, Medium, Low counts that filter the table | consultation B1 | none |
| B-40 | Inspect modal with previous and next; preset views (My issues, Critical and high, Audit prep, Needs a decision link) | consultation B3 | none |
| B-41 | Link-decision modal with Confluence page search | consultation C | [MANIFEST] scope |
| B-42 | "Request retrospective review" (comment as the user) | consultation C | none (write as user) |
