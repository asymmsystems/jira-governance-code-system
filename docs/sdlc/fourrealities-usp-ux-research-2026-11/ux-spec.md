# FourRealities: UX specification

- **Date:** 2026-11-01
- **Scope:** the nine benchmark tasks of the research brief, the target interaction for each, performance baseline and budgets, and the ADS and WCAG gaps.
- Source IDs and test IDs (T-xx) are defined in `research-brief.md` section 9 and in `round-log.md`.

## 1. Benchmark: current state

### 1.1 FourRealities (Observed-code unless marked)

Counts start from the open project page or the open issue. "Click" means a pointer click or an Enter key press on a focused control. URL typing is counted as the length of a sample URL (60 characters).

| # | Task | Result today | Clicks | Keys | Modals or confirms | Evidence |
|---|---|---|---|---|---|---|
| 1 | Name the three highest-risk issues | **Fail.** The project page renders blank. The designed table sorts worst first (`index.tsx:624-630`), but RAI is inflated by unstarted issues (FR-14). | n/a | n/a | n/a | T-03, T-05 |
| 2 | For one Done, BLOCKED issue: which gate, what evidence is missing, which source | **Partial** (issue panel). Pills show each gate state. "View Details" lists findings. No gate names its source app or field. The Audit gate treats any property as proof (FR-04). | 2 (open issue, "View Details") | 0 | 0 | `index.tsx:340-418` |
| 3 | Add a missing decision link and see Intent change | **Dishonest.** "Link Decision (ADR)" opens a modal with a pre-filled passing title (FR-13). Success says "Intent gate verified" before re-evaluation (FR-20). | 2 | about 60 (URL) | 1 modal | `index.tsx:187-193`, `:215-235` |
| 4 | Record a justified exception, shown as its own state with who and why | **Fail.** Two clicks with a pre-filled reason turn Code to PASSED (FR-10). Who and why are not shown. | 2 | 0 | 1 modal | `index.tsx:206-212`, `metrics-engine.ts:45-46` |
| 5 | Filter by assignee, sprint or gate | **Fail.** Gate: one Quick View click, on a page that does not render. Assignee and sprint: no control exists (NF-01). | 1 (gate only) | 0 | 0 | `index.tsx:888-926` |
| 6 | See the trend for the last four weeks or sprints | **Fail.** Only "pts vs last scan" against the scan before last (FR-15). | n/a | n/a | n/a | `index.tsx:729-733` |
| 7 | Go from a seal or DoD result to the producer app's panel | **Fail.** No route exists (NF-02). The buttons write forged values instead (FR-02, FR-03). | n/a | n/a | n/a | `index.tsx:388-400` |
| 8 | Read the gate row with keyboard and screen reader | **Partial.** Gate pills carry a text label. Table glyphs have no name (FR-23), and "──▶" is read aloud. Not testable live because the page is blank. | Unknown | Unknown | 0 | `index.tsx:69-102` |
| 9 | Empty project, and a 1,000-issue project | **Fail.** Empty: blank page (T-03 renders `null` with an empty snapshot). 1,000 issues: 200 rows with 100 unique, then every load fails from view 2 (T-04). | n/a | n/a | n/a | T-03, T-04 |

### 1.2 Competitors

No document, screenshot or video read in this research gave click or keystroke counts, and no trial was used (research brief section 8). So every count is Unknown. The table records what each closest product can or cannot do.

| # | Native Jira (dev panel, JQL) | HeroCoders Checklists Pro | Timepiece (OBSS) | Xray | LinearB (external) | Release Readiness (per release) |
|---|---|---|---|---|---|---|
| 1 | No per-issue risk (NA section 5) | No ranking; JQL list only (DD section 5) | Sort a count report; clicks Unknown (TR section 4) | Unknown | Unknown | Per release, not issue (AU-29) |
| 2 | Read the dev panel by hand; no blocking-check concept (NA section 5) | Validator blocks; target status hidden in team-managed projects (DD-23) | Not applicable | Unknown | Unknown | "gaps are shown next to the results" (AU-29) |
| 3 | Remote link dialog; no dependent state (NA section 5) | Tick an item, progress updates (DD section 5) | Not supported | Not supported | Not supported (EX-09) | Unknown |
| 4 | No equivalent (NA section 5) | Unknown | Not supported | Unknown | Unknown | Unknown |
| 5 | JQL for assignee and sprint; no "check" field (NA section 5) | JQL with standard clauses (DD section 5) | JQL-based reports (TR section 4) | Unknown | Team and repo filters (TR section 4) | Unknown |
| 6 | Atlassian Analytics, build your own (NA section 5) | Unknown | Unknown | Unknown | Dashboard trends, detail Unknown | 7, 14 and 30 day trajectory (DD section 2) |
| 7 | Dev panel links to the PR (NA-01) | Unknown | Issue view tab (EM-01) | Unknown | Unknown | Unknown |
| 8 | Unknown | Unknown | Unknown | Unknown | Unknown | Unknown |
| 9 | Unknown; entity-property index limit 100 values per app (NA-15) | 20-item limit on Free, one review (DD-20) | Unknown | Slowness, one review (TR-13) | Unknown | Unknown |

## 2. Target interaction for each task

Rules that apply to every task:
- **Gate states.** Each gate has one of these states, with a text label, a glyph with an accessible name, and an ADS lozenge appearance:

| State | Meaning | Lozenge | Counts in RAI |
|---|---|---|---|
| Evidence found | The source has the evidence and FourRealities read it | `success` | Yes, as pass |
| Evidence found (not verified) | A sibling property says so, and nothing verifies it | `inprogress` | Yes, as pass, with the hint label |
| Evidence found (heuristic) | Code gate from the Development field string, not approval data | `inprogress` | Yes, as pass, with the heuristic label |
| Evidence missing | The gate applies and the evidence is absent | `removed` | Yes, as fail |
| Excepted | A recorded exception, with who, when and why | `moved` | No: excluded from the average and from M29 |
| Needs re-check | The issue changed after the attestation (`updated` > `issuedAt`), once siblings send `issuedAt` | `moved` | No |
| Not applicable | The gate does not apply yet (unstarted issue, or producer app absent) | `default` | No |

- **Source line.** Every gate shows "Source: <app or field>" and one of "verified by FourRealities", "not verified by FourRealities" or "heuristic". Until LedgerSeal and DefinitionGuard sign their properties, Audit and Process never show "verified" (backlog B-04).
- **No evidence writes.** Remediation is a link to where the evidence lives. FourRealities writes only its own keys: `fourrealities-exception` and the user's own remote link.
- **Feedback.** After any action the panel re-reads the issue. The message is built from the new gate state, for example "Intent: evidence still missing. The link title does not identify a decision record." The message uses a status region (WCAG 4.1.3, EV-11).

| # | Target steps | Visual feedback and state names | Keyboard path | Empty and edge states | Target counts |
|---|---|---|---|---|---|
| 1 | Open the project page. The "At risk" table shows rows sorted by: Evidence missing count, then lowest RAI. Unstarted issues are UNRATED and not in the table by default. | Row: key, summary, four named gate chips, RAI with "n of 4 gates applicable". | Tab to the table; rows are in reading order. | No rated issues: UI Kit `EmptyState` "No started work to rate yet" with a link to the issue list (EV-07). | 0 clicks, 0 keys |
| 2 | Open the issue. The panel lists four gates, each with state, source and the missing item in words. | Example: "Audit: evidence missing. Source: LedgerSeal property ledgerseal-cert. No seal record on this issue. Not verified by FourRealities." | Tab through gate rows; each row is one focus stop with a full text name. | Property present but malformed: "Evidence missing: record unreadable". | 1 click, 0 keys |
| 3 | In the Intent row, "Link decision record" opens a modal with empty URL and title fields. Submit as the user. The panel re-reads and shows the new state. | Success only when the re-evaluated gate is "Evidence found". Otherwise the reason it is still missing. | Modal focus starts on URL; Enter submits; Escape cancels. | 403: "You need the Edit issues permission on KEY to add a link." No retry as the app (FR-05). | 2 clicks plus typing; 1 modal |
| 4 | In the Code row, "Record exception" opens a modal with an empty reason (required, at least 15 characters). The option is hidden when a PR exists. Save. | Gate shows "Excepted", with "by <name>, <date>: <reason>". Never PASSED. | As task 3. | Second exception on the same gate replaces the first and keeps the history in the record. | 2 clicks plus typing; 1 modal |
| 5 | Filter bar above the table: Assignee, Sprint (only when the project has sprints), Gate state. | Active filters show as removable tags; the count reads "Showing 12 of 87 rated issues". | Tab order: search, Assignee, Sprint, Gate, Clear. | Service projects with no sprints: Sprint filter hidden, not empty. | 2 clicks per filter |
| 6 | Trend panel: last four weekly snapshots of RAI and of each gate's pass rate, with the denominators. | Text table first ("Week of 2026-10-26: Intent 12 of 40 started issues"), then a UI Kit `LineChart` (exported by the installed `@forge/react` 12.4.0). | Table is readable in order. | Fewer than two weekly snapshots: "Trend starts after two weekly snapshots. Next snapshot: <date>." | 0 clicks |
| 7 | In the Audit and Process rows, "Open in LedgerSeal" or "Open in DefinitionGuard" uses `router.open` to the issue view, and the text names the panel to open. | The link names its destination (EV-07). | One focus stop per link. | Producer not installed: gate "Not applicable: LedgerSeal not found on this site" (audit 5.0 rule 6). How to detect installation is a Part B design question. | 1 click |
| 8 | Gate rows and table chips have text names ("Intent: evidence found"). Decorative arrows are removed. | Colour plus glyph plus text (EV-06, EV-09). | Every action reachable by Tab, Enter and Escape (EV-08). | n/a | n/a |
| 9 | Empty project: empty state with the reason and next step. 1,000 issues: the page reads the latest scheduled snapshot, paged 25 rows, with "Showing N of M". | No 0% in red for an empty denominator; show "n/a" (FR-21). | As task 1. | Snapshot older than 7 days: warning with its date. | 0 clicks |

## 3. Performance: baseline and budgets

Baseline from the resolver harness T-04 (`~/.cache/gemini-earning-fourrealities-research/harness/results/resolver-baseline.json`), run 2026-11-01 on host node v26.13.0 with mocked Jira and KVS. CPU time excludes network time. Wall-clock time on the live site was not measured, because the mocks have no latency model and the live page does not render.

### 3.1 Baseline

| Measure | 50 issues | 300 issues | 1,000 issues |
|---|---|---|---|
| Jira calls per dashboard view | 1, all as app | 2, all as app | 2, all as app |
| Rows returned / unique issues | 50 / 50 | 200 / 100 (FR-08) | 200 / 100 (FR-08) |
| KVS reads per view (sequential) | 52 | 202 | 202 |
| KVS writes per view | 2 | 2 | 2 |
| Largest `latest` value | 38,981 B | 157,197 B | 157,197 B |
| `history` value at failure | 272,855 B at view 7 | 314,377 B at view 2 | 314,377 B at view 2 |
| First failing view (of 11) | 7 | 2 | 2 |
| Views that fail after the first failure | all (7 to 11) | all (2 to 11) | all (2 to 11) |
| CPU per view | 2.0 to 3.7 ms | 5.4 to 10.6 ms | 3.8 to 11.7 ms |
| Mean RAI shown (fixture) | 69 | 65 (over duplicated rows) | 65 (over duplicated rows) |

`getIssueAlignment`, one issue: 5 Jira calls, all as app, 3 of them to the undocumented `/rest/dev-status/latest/issue/detail`; 1 KVS read, 1 KVS write of 513 B; CPU 0.5 ms.

### 3.2 Budgets (Part B must meet these in the same harness, plus the live checks)

| Measure | Budget | Reason |
|---|---|---|
| Unique issues read | All issues up to the cap, no duplicates; the cap is shown as "Showing N of M" | FR-08 |
| Dashboard view, Jira calls | At most ceil(N / 100) search calls, all as the user, `fields` limited to what the view needs | FR-18, FL-03 |
| Dashboard view, KVS reads | At most 3 + ceil(N / 100), no per-issue sequential reads | FR-19 |
| Largest KVS value at 1,000 issues | At most 100 KiB, and no value grows with page views | FR-07, FL-01 |
| Consecutive views without failure | 52 views at 1,000 issues, 0 failures | FR-07, NF-06 |
| CPU per dashboard view at 1,000 issues (harness) | At most 200 ms | headroom under the 25 s limit (FL-02) |
| Scheduled snapshot at 1,000 issues | Completes within 300 s in the harness call count model; at most ceil(N / 100) searches plus one remote-link read per started issue | FL-02 (900 s limit), FL-03 |
| `getIssueAlignment` | At most 3 Jira calls, all as the user, no undocumented endpoint | FR-09, FR-18 |
| Live project page on DEMO | Renders within 10 s of navigation (iframe visible, height above 0) | FR-01, T-05 |

## 4. ADS and WCAG 2.2 AA gaps

| Gap | Rule | Finding | Evidence |
|---|---|---|---|
| Page crashes, so nothing is perceivable | All | FR-01 | T-03, T-05 |
| Table gate glyphs have no text name; screen readers read "black circle", "multiplication x" | WCAG 1.1.1, 4.1.2 (EV-08, EV-10) | FR-23 | `index.tsx:92-102` |
| Decorative "──▶" arrows are read as text | WCAG 1.1.1 | FR-23 | `index.tsx:82-86` |
| Cards and button rows do not wrap at narrow widths | ADS layout; WCAG 1.4.10 reflow (Inferred) | FR-23 | 0 uses of `shouldWrap` |
| Long hero lozenge text ("86% ALIGNED · Sprint 12") can truncate; lozenge max width 200 px, truncated text is lost | ADS lozenge (EV-06) | FR-15, FR-23 | `index.tsx:726-728` |
| Empty project shows 0% in red | ADS empty state (EV-07) | FR-21 | `index.tsx:860-867` |
| Success message written before re-evaluation; not a status region | WCAG 4.1.3 (EV-11); honest feedback | FR-20 | `index.tsx:227`, `:268` |
| Exception shows as PASSED (green) | ADS lozenge meaning (EV-06) | FR-10 | `metrics-engine.ts:45-46` |
| Progress bars on the cards have no label. UI Kit `ProgressBarProps` offers `ariaLabel` (installed `@atlaskit/forge-react-types`), and the code never sets it. | WCAG 1.1.1, 4.1.2 | FR-23 | `index.tsx:484`, `:805`, `:825`, `:845`, `:865` |
| Score text shows the em dash character and "+N" weights that may not add up to the total | Plain language; portfolio no-em-dash rule | NF-04, FR-17 | `metrics-engine.ts:212-217` |
| Assignee and sprint filters missing | Usability | NF-01 | `index.tsx:585-593` |
| Dark mode | UI Kit applies design tokens automatically (Reported, CascadePlan research RS-26); no hex colours in the code | PASS (Inferred) | `index.tsx` has no hex literal |
| Pills use colour, glyph and text | WCAG 1.4.1 (EV-09) | PASS | `index.tsx:69-76` |
