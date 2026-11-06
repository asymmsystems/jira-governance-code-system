# Asymm Forge Portfolio: Technical, Functional and UX Audit

- **Date:** 2026-10-31
- **Audience:** Product owner, lead architect, and enterprise buyers who decide on paid Atlassian Marketplace listings
- **Apps:** CascadePlan (`apps/planshift`), FourRealities (`apps/fourrealities`), LedgerSeal (`apps/ledgerseal`), DefinitionGuard (`apps/definitionguard`)
- **Source:** `jira-governance-code-system/` at HEAD `5097bf5`. PlanShift also has uncommitted changes in 7 files. This audit reviews the working tree. `snapshot-md5.txt` in this folder pins every reviewed file.
- **Site in brief:** https://asymmsystems.atlassian.net, project DEMO

## How to read this report

- **Severity:** Critical blocks any release. High blocks a paid listing. Medium must be fixed before general availability. Low is polish.
- **Verdict:** PASS, PARTIAL or FAIL for each audit question.
- **Evidence grade:**
  - **Observed-code:** read in the source at the cited line.
  - **Observed-test:** output of a command or probe script that the audit ran.
  - **Observed-live:** seen in the live Jira site.
  - **Inferred:** a conclusion from code or platform behaviour that the audit did not run.
  - **Reported:** taken from Atlassian documentation or community reports.
- **Finding IDs:** CP (CascadePlan), FR (FourRealities), LS (LedgerSeal), DG (DefinitionGuard), PX (portfolio-wide). The appendix files in this folder hold the full text of every finding.

### Method

1. Four independent reviewers read one app each, in full: manifest, source, tests, and the static UI. Each reviewer ran `tsc --noEmit` and `jest --coverage`. Three reviewers also ran probe scripts against compiled code.
2. The lead auditor re-read the source lines for every Critical finding and for selected High findings. The code facts are confirmed. Two severities change: DG-03 (section 4.4) and, after the live check, CP-02 (section 4.1). The lead also found one new defect (FR-26).
3. The lead checked two platform facts against Atlassian sources (section 1.3).
4. The lead ran a read-only live session on the DEMO project (section 7). It found one more portfolio-wide finding (PX-04).

### Limits of this audit

- Two live sessions ran on 2026-10-31 after the code review.
  - The first session was read-only: REST GET calls and page views.
  - The second session ran with the owner's approval. It created one probe issue and opened the CascadePlan Backlog Tray. Section 7.4 lists every write.
- Two page views had side effects that the apps cause on every view. The LedgerSeal panel on DEMO-22 rewrote the `ledgerseal-cert` property from SEAL_VALID to SEAL_BROKEN, and it added a history row (LS-06). The audit did not cause any other write.
- The audit did not click any CascadePlan bar, because CP-07 says a click writes to Jira.
- The audit sent no crafted resolver payloads. Attacks through resolver payloads are Observed-code or Observed-test with mocked Forge APIs. The only live injection test was one harmless HTML summary (CP-01).
- DEMO is a Jira Service Management project with 26 issues. Software-project behaviour (epics, stories, sprints) was not seen live.
- Section 7 lists the live results and the items that are still open.

### 1.3 Platform facts checked for this audit

| Fact | Value | Source |
|---|---|---|
| Forge KVS maximum value size | 240 KiB per value. Keys up to 500 characters. 25 operations per transaction. | Reported: Atlassian "KVS and Custom Entity Store limits" page |
| Jira entity property value size | 32 KB | Inferred from standard Jira REST behaviour. Not re-checked in this session. |
| Custom UI inline scripts | The official permissions page does not state the default. Community threads report that the default policy refuses inline scripts unless `'unsafe-inline'` or a hash is declared. | Reported: Atlassian permissions reference and Atlassian developer community |

**Correction to the brief:** the brief gives "32 KB per key" as the KVS limit. That figure is the Jira entity-property limit. The KVS limit is 240 KiB. The KVS findings in this report hold under the correct limit: each app still has a value that grows without a bound.

---

## 1. Executive Summary

### Portfolio commercial readiness score: 26 / 100

| App | Score | Critical | High | One-line verdict |
|---|---|---|---|---|
| CascadePlan | 32 | 0 | 12 | Real Jira data and a good dependency engine. The UI loads live. Jira summaries inject HTML into the UI (the CSP blocked script in the live probe). It corrupts Jira estimates and dates in normal use. |
| FourRealities | 18 | 4 | 8 | The project dashboard renders blank live (hook-order defect). The "1-click remediations" fake the evidence that the gates claim to check. |
| LedgerSeal | 25 | 2 | 7 | The SHA-256 core and trust boundary are sound. Any viewer can reseal, a reseal hides earlier tampering, and many fields are outside the hash. |
| DefinitionGuard | 35 | 0 | 5 | The basic checklist gate works and fails closed. The compliance features (tamper evidence, custom templates, permissions) do not exist in usable form. |
| Portfolio-wide | | 0 | 4 | No licensing. Listing over-claims. Untested UIs. CascadePlan writes break LedgerSeal seals with no warning. |

### What is good

- All four apps run on `nodejs22.x`. All four declare no external egress from the backend.
- `tsc --noEmit` passes with `strict` in all four apps. 342 of 342 tests pass (CascadePlan 152, FourRealities 54, LedgerSeal 77, DefinitionGuard 59).
- Each app now takes the issue or project from trusted Forge context first.
- All Jira data is real. No app shows seeded tasks or invented people as live data.
- Three assets are worth keeping:
  - the CascadePlan earliest-start and violation engine,
  - the LedgerSeal decision to trust app storage, not the writable entity property,
  - the DefinitionGuard validator, which fails closed and names the pending items.

### What blocks a release

1. **Integrity features that do not prove integrity.** This is the core promise of three of the four apps. FourRealities writes forged "SEAL_VALID" and "DoD complete" records into the properties of the other two apps (FR-02, FR-03). Its Audit gate accepts any property with a status string (FR-04). In LedgerSeal, any viewer can reseal an issue and erase the visible tamper record (LS-01, LS-02). The DefinitionGuard hash is never checked (DG-01).
2. **Defects that break the product or expose its users on first use.**
   - The FourRealities dashboard renders blank live, because of a React hook-order defect (FR-01).
   - In CascadePlan, a Jira summary injects HTML and breaks out of an attribute, Observed-live (CP-01). The deployed CSP blocked the injected script handler. One CSP change would make this a Critical stored XSS.
3. **Silent corruption of customer Jira data.** CascadePlan writes a 40 h estimate that nobody entered (CP-03). A click on a bar rewrites the due date (CP-07).
4. **Storage designs that fail as data grows.** Each app keeps a value in KVS that grows without a limit. Writes fail when that value passes 240 KiB (CP-09, FR-07, LS-06, DG-06).
5. **No licensing, and listing claims that a Marketplace review or a buyer's due diligence will reject** (PX-01, PX-02). Examples: "21 CFR Part 11 compliant", "SOC 2 / ISO 27001", "Cloud Fortified", "100% test coverage", and "read-only scopes".

### Decision

**No-Go for paid listings, for all four apps.** Section 6 gives the conditions for a later Go and the order of the work.

---

## 2. Architecture and Security Matrix

### 2.1 Pillar A verdicts

| Question | CascadePlan | FourRealities | LedgerSeal | DefinitionGuard |
|---|---|---|---|---|
| Trusted context for project/issue | PARTIAL: project key from context. Payload issue keys not checked against the project (CP-16). | FAIL: on the project page the context has no issue, so a payload `issueId` acts on any project (FR-06). | PARTIAL: issue from context. No permission check (LS-01). | PARTIAL: issue from context. No permission check (DG-02). |
| asUser vs asApp | PARTIAL: writes as user. All reads as app, so issue security is bypassed (CP-06). | FAIL: user writes fall back to asApp after a 403 (FR-05). Reads as app (FR-18). | PARTIAL: all calls as app. Signer email can come from the payload (LS-03). | FAIL: all calls as app. No permission check on tick, reset or template save. |
| Real accountId in audit records | PASS for writes (Jira history shows the user). | PASS (`context.accountId`). | PARTIAL: accountId from context, email and name can be spoofed (LS-03). | PARTIAL: accountId kept. Visible names are rewritten on every load (DG-09). |
| Runtime `nodejs22.x` | PASS | PASS | PASS | PASS |
| Scopes and manifest | PARTIAL: 4 scopes, all used. No licensing. | PARTIAL: listing claims no write scope. Manifest has `write:jira-work`. | PARTIAL: icon loaded from GitHub. No property index. | PARTIAL: no settings or admin module. Icon from GitHub. |
| KVS size (240 KiB) | FAIL: full plan written on every read. About 252 KB at 100 heavy tasks (CP-09). | FAIL: history stores 10 full snapshots. Fails at about 24 issues (FR-07). | FAIL: every view of a tampered issue adds a history row and an incident. 500 views give 152 KB (LS-06). | FAIL: audit trail has no cap. Passes 240 KiB after 814 toggles (DG-06). |
| KVS concurrency | FAIL (CP-11) | FAIL (FR-19) | FAIL (LS-07) | FAIL: lost update shown by probe (DG-05) |
| Key naming | PARTIAL: keyed by project key, not project id. | PARTIAL | PASS: `cert:active:{issueId}` | PASS: `dg:checklist:{issueId}` |
| JQL bounds and pagination | FAIL: one page of 100, no `nextPageToken` (CP-10). | FAIL: pages with `startAt`, which `/search/jql` does not use (FR-08). | Not applicable (single-issue reads). | Not applicable. |
| 429 retry and backoff | FAIL | FAIL | FAIL (LS-15) | FAIL |
| CSP and bridge (Custom UI) | FAIL: 1 inline script, 3 inline `onclick` handlers, 29 `innerHTML` sinks, private `window.__bridge` (CP-01, CP-02). The UI loads live, so the inline script runs. `document.readyState` handling is correct. | n/a | n/a | n/a |
| UI Kit safety | n/a | PARTIAL: no raw HTML. Hook-order crash (FR-01). | PASS: no raw HTML. | PASS: no raw HTML. |
| `any` count in `src` | 20 live, 13 in dead code | 56 | 27 | 19 |
| Coverage (stmts / branch / funcs / lines) | 99.04 / 90.11 / 96.46 / 100 | 98.62 / 90.33 / 92.18 / 98.71 | 98.01 / 90.24 / 100 / 98.41 | 99.68 / 90.36 / 100 / 99.65 |
| Coverage meets 90% on every metric | PARTIAL: global yes. `src/index.ts` branch 86.46%. UI 0% and excluded. | PARTIAL: global yes. `src/index.ts` branch 88.46%, funcs 88.09%. UI excluded. | PARTIAL: global yes (branch by 0.24 points). Canonicalizer branch 87.7%. UI excluded. | PARTIAL: global yes. `src/index.ts` branch 88.28%. UI excluded. |
| Behavioural tests vs mock echo | PARTIAL: tests assert the 40 h default as correct. asApp and asUser share one mock. | PARTIAL: tests assert the permission bypass as correct. Shared mock. | PARTIAL: production code has `NODE_ENV === 'test'` bypasses that tests use (LS-14). | PARTIAL: one fallback test passes for the wrong reason (DG-13). |

### 2.2 Portfolio-wide findings

**PX-01. High. No app enables Marketplace licensing.**
- Evidence: Observed-code. None of the four `manifest.yml` files has an `app.licensing` block. No resolver reads `context.license`.
- Failure scenario: a paid app cannot tell a licensed install from an evaluation that expired. The listing cannot go live as a paid app.
- Fix: enable licensing in each manifest. Check the licence in every resolver and show an ADS "licence inactive" state.

**PX-02. High. Every listing makes claims the code does not support.**
- Evidence: Observed-code against `docs/marketplace/*.md`, READMEs and specs. Each appendix has a full table.
- Examples:
  - **All four apps:** "Least privilege, read-only scopes", but `write:jira-work` is in every manifest. "100% automated test coverage", but measured branch coverage is about 90% with the UI excluded.
  - **LedgerSeal:** "21 CFR Part 11 compliant", "SOC 2 / ISO 27001", "Cloud Fortified", "100% data residency", "OAuth 3LO" and "Immutable".
  - **FourRealities:** "Aligns what was planned in Confluence" and "committed in Git", but the code makes no Confluence call and reads no commit data. "Guarantees that no code bypasses peer review" is false because of FR-10.
  - **DefinitionGuard:** "Seamless LedgerSeal integration", but LedgerSeal has no reference to DefinitionGuard. "Verification evidence", but the UI has no evidence field.
  - **Badges:** the "Runs on Atlassian" badge is granted by Atlassian. A listing cannot claim it in advance.
- Failure scenario: an enterprise buyer's security review compares the listing with the manifest and finds the write scope. The deal stops. A regulated buyer relies on the Part 11 claim, then fails an FDA inspection.
- Fix: rewrite each listing from the code. Remove every compliance, certification and badge claim until evidence exists.

**PX-03. High. No app has a UI test, and every coverage figure excludes the UI.**
- Evidence: Observed-code. `jest.config.js:9` excludes `src/frontend/**` in every app. The CascadePlan UI is `static/frontend/build/index.html`, which is outside `collectCoverageFrom`.
- Failure scenario: FR-01 (dashboard crash) and CP-01 (XSS) pass CI with green coverage.
- Fix: add render tests for each UI Kit app (loading, loaded, error). Move CascadePlan's script into modules and test them with jsdom. Set per-file coverage thresholds.

**PX-04. High. CascadePlan edits break LedgerSeal seals, and neither app warns the user.**
- Evidence: Observed-live on DEMO-22 on 2026-10-31.
  - LedgerSeal sealed DEMO-22 at 2026-10-30 10:29 UTC.
  - At 21:39 local time the same user set the original estimate to 90 h, then to 60 h (changelog).
  - CascadePlan shows 60 h for DEMO-22, and CascadePlan writes estimates as the user. So CascadePlan is the probable writer (Inferred).
  - The LedgerSeal panel now shows "CRITICAL: Cryptographic Seal Broken". The altered field is `timetracking`.
  - The `ledgerseal-cert` property still said SEAL_VALID until the audit opened the panel.
  - On 2026-10-31 at 10:38-10:39 local time, two more changes followed under the same account:
    - The due date was set to 2026-10-27, which is the Tuesday that ends a CascadePlan week, as CP-07 predicts.
    - A 20 h subtask, DEMO-28 "Subtask: Fahim Farook", was created, which is CascadePlan's multi-resource pattern.
  - LedgerSeal now lists 3 altered fields: Due Date, Subtasks and timetracking.
- Failure scenario: a PM drags a sealed, approved change on the Gantt. The drag writes an estimate and a due date. The release gate then blocks. The PM gets no warning, and the property tells other tools that the seal is valid until someone opens the issue.
- Fix:
  - CascadePlan reads `ledgerseal-cert` and shows a lock badge on sealed bars.
  - It asks for confirmation before it writes to a sealed issue.
  - LedgerSeal reacts to the issue-updated event, so the property never stays stale (section 5).

---

## 3. Data Truthfulness and Integrity Findings

| Check from the brief | Result | Evidence |
|---|---|---|
| CascadePlan: unestimated issues show 0 h or "unestimated" | **FAIL.** The backend reads 0 h. The UI shows "40h". A drag from the backlog writes `originalEstimate: "40h"` to Jira. | CP-03. Observed-code `index.html:544`, `index.ts:416`, `index.ts:455-458`. **Observed-live:** DEMO-26 has no estimate in Jira, but CascadePlan shows "40h". |
| CascadePlan: no synthetic 30% progress | **PASS.** Progress is time spent divided by original estimate, 100 when Done, else 0. The 30 default exists only as a dependency trigger value. | Observed-code `index.ts:209-214` |
| CascadePlan: weeks from `new Date()` | **PARTIAL.** `getProjectPlan` computes weeks per call. A module-level copy (`DEFAULT_WEEKS`) goes stale in warm containers. Sprint names ("Sprint 0", "Sprint 1") are invented, not Jira sprints. | CP-18. Observed-code `index.ts:80`, `index.ts:302`, `planner-engine.ts:303-304` |
| CascadePlan: assignee "Unassigned", no placeholders | **PARTIAL.** Real `displayName` or "Unassigned". Six "Resource N (Placeholder)" users are offered for assignment. A drop from the tray stores "Unassigned" over the real Jira assignee. | CP-04, CP-19. Observed-code `index.ts:95-102`, `index.ts:437`, `index.ts:258` |
| CascadePlan: other fixed data | **FAIL.** The header shows "Project: DEMO" and "Completion: 31% / Target: 25%" before load and after a failed load. Heatmap rows get the fixed values "Core Engineering", "Core Platform" and "Project 1". | CP-19. Observed-code `index.html:21-22`, `planner-engine.ts:452-456`. **Observed-live:** every row shows epic "Prerequisites" and target 0%. Columns are labelled "Sprint 0, Sprint 0, Sprint 1, Sprint 1", which a service project does not have. |
| FourRealities: Sprint Trend from history | **PARTIAL.** It is computed from stored snapshots, not constants. The baseline is the scan before last, and every page view counts as a scan. The sprint label is the first sprint found on the newest issue. | FR-15. Observed-code `index.ts:322`, `metrics-repository.ts:54-61` |
| FourRealities: "Biggest mover" from real data | **PARTIAL.** It is a real diff of rates between snapshots, with the same baseline error. The unit text says "pts", but the values are percentage points of a rate. | FR-16. Observed-code `metrics-engine.ts:378-398` |
| FourRealities: remediations check real evidence | **FAIL.** "Complete DoD" opens with all 5 items ticked, and the server trusts the client. "Seal Issue" writes its own certificate into LedgerSeal's property. "No Code Change" approves itself. | FR-02, FR-03, FR-10 |
| LedgerSeal: deterministic hash across field orders | **PASS** for object key order and label order (probe). **FAIL** for meaningful order: ordered custom arrays are sorted, so a reorder keeps the same hash. Dates are not normalised to one time zone. | LS-11. Observed-test `ledgerseal-scratch/probe.js` |
| LedgerSeal: any canonical field change gives SEAL_BROKEN | **FAIL.** Status, reporter, resolution and worklog are outside the hash. 13 fixed custom field ids and value heuristics also drop real fields. In a probe, a budget change kept SEAL_VALID. **Correction to the LS-04 appendix text:** the six flat time fields are excluded (`canonicalizer.ts:252-257`), but the composite `timetracking` field is hashed. Observed-live: an estimate change broke the DEMO-22 seal (PX-04). | LS-04, LS-05. Observed-code `canonicalizer.ts:25-66`, `canonicalizer.ts:226-258` |
| LedgerSeal: history monotonic, no erasure | **FAIL.** A reseal writes a new certificate with no tamper history. The history row records only "SUPERSEDED", not "was broken". No UI reads the history or the archive. | LS-02. Observed-code `index.ts:228`, `seal-repository.ts:46-66` |
| DefinitionGuard: state persists across reloads | **PASS.** Stored at `dg:checklist:{issueId}`. | Observed-code `checklist-repository.ts:17` |
| DefinitionGuard: mandatory items gate transitions | **PARTIAL.** The validator blocks when a mandatory item is open, and it blocks when no checklist exists. It does not check for Done. An admin must add it to each transition by hand. | DG-07. Observed-code `transition-validator.ts:16-27`, `index.ts:111-121` |
| DefinitionGuard: reset updates the hash | **PASS.** Reset changes the hash and keeps all earlier events. But no code ever verifies the hash, so the update has no effect on integrity. | DG-01. Observed-test probes 13a-c, 10 |

### 3.1 The cross-app trust problem

The cross-app trust problem is the most important single finding for the portfolio.

- **The channel:** Forge KVS is private to each app. The only shared channel between these apps is the Jira issue entity property.
- **Who can write it:** any user with Edit Issues permission can write an entity property through REST (Inferred from standard Jira behaviour). Any installed app can write it too.
- **What the code does today:**
  - LedgerSeal writes `ledgerseal-cert` without a signature (`ledgerseal/src/index.ts:233-244`).
  - DefinitionGuard writes `definitionguard-dod` without a signature (`definitionguard/src/index.ts:249-257`).
  - FourRealities reads both properties and believes them (`fourrealities/src/index.ts:216-227`).
  - FourRealities also writes both properties itself (`fourrealities/src/index.ts:584-747`).
- **Result:** the Audit gate passes after two clicks or one REST call. Section 5 gives the fix.
- **Observed-live:** DEMO-26 (status "Waiting for support", not Done) carries both foreign keys in FourRealities' shape.
  - `ledgerseal-cert` is `{status: SEAL_VALID, valid: true, sealedAt, isCompromised: false}`, with no `certificateId` and no `snapshotHash`.
  - `definitionguard-dod` is `{isFullySatisfied: true, satisfied: true, completedAt}`, with no counts and no hash.
  - Neither producer app writes these shapes.
- **Also Observed-live:** DEMO-20 carries the validator's SEAL_BROKEN shape with no `isCompromised` field, which LS-08 predicts.

---

## 4. App-by-App Review

### 4.1 CascadePlan (`apps/planshift`): 30 / 100

The reviewer scored the app 25 on the assumption that CP-02 might stop it from loading. The live checks show two things: the app loads, and the CSP blocked script in the CP-01 probe. So the lead raised the score to 32.

#### Code and security

| ID | Sev | Finding | Evidence |
|---|---|---|---|
| CP-01 | High (lead downgraded from Critical after the live probe) | **Stored HTML injection, one CSP change away from stored XSS.** Jira summaries, milestone titles and payload strings go into `innerHTML` and `title="..."` attributes with no escaping. The file has 29 `innerHTML` sinks and no escape function. **Live probe (DEMO-27):** the summary was `AUDIT PROBE CP-01 <b>BOLD-TAG</b><img src=x onerror="this.replaceWith('XSS-RAN-CP01')">`. In the Backlog Tray, the text "BOLD-TAG" rendered bold, an `<img>` element appeared, and a stray `">` showed that the summary broke out of the `title` attribute. The `onerror` handler did not run, so the deployed CSP blocks injected inline handlers. **Remaining impact:** any user who can edit a summary can inject markup, links and inline styles (`styles: 'unsafe-inline'` is granted) into every planner user's view. That allows spoofed content and phishing links. If the CSP ever allows inline scripts, the injection becomes stored XSS, and writes run `asUser`. | Observed-code `index.html:518`, `index.html:537-546`, `index.html:657-690`, `index.html:1145-1152`. Observed-live 2026-10-31 |
| CP-02 | High (lead downgraded from Critical) | **The whole UI is one inline `<script>`, plus 3 inline `onclick` handlers, and it calls the private `window.__bridge`, not `@forge/bridge`.** The manifest allows only `styles: 'unsafe-inline'`. **Observed-live:** the app loads and renders Jira data, so the deployed CSP lets the inline script run. The outage risk is therefore not present today. Two risks remain. First, the private bridge global is not a public API, and a platform change can break the app. Second, an inline script that runs means the CP-01 payloads can run. | Observed-code `index.html:327`, `index.html:329-343`, `manifest.yml:17-20`. Observed-live 2026-10-31 |
| CP-06 | High | All Jira reads run as the app, so users see issues hidden by issue security. | Observed-code `index.ts:136`, `index.ts:160`, `index.ts:185` |
| CP-09 | High | The full plan (tasks, backlog, weeks, users) is written to one KVS value on every read. About 252 KB at 100 heavy tasks. After the first failed write, every resolver fails. | Observed-code `index.ts:405`. Observed-test size probe |
| CP-10 | High | Only the newest 100 issues are read. No paging, no "showing N of M". | Observed-code `index.ts:186` |
| CP-11 | High | Read-modify-write on `scheduleMap` with no version check. Concurrent edits overwrite each other. | Observed-code `index.ts:852-883` and 6 other sites |
| CP-29 | Low | **New (lead).** The same CSP that blocked the probe handler also blocks the app's own inline `onclick="event.stopPropagation();"` handlers on the key link and on the edit and unschedule buttons. A click on them therefore also reaches the row handler. Not clicked live, because some row actions write to Jira. | Observed-code `index.html:661`, `index.html:665`, `index.html:666`. Effect Inferred from the CP-01 probe |
| CP-16 | Medium | Payload issue keys and `predecessorKey` are not checked against the project. Jira still enforces the user's edit permission, so this is an integrity defect, not a privilege escalation. | Observed-code `index.ts:416`, `index.ts:1114-1119` |
| CP-17 | Medium | No 429 retry. `updateWbsTask` runs the full plan build twice, then one sequential PUT per cascaded task. A long cascade risks the resolver time limit. | Observed-code `index.ts:780`, `index.ts:878`, `index.ts:889` |

#### Functional correctness

| ID | Sev | Finding | Evidence |
|---|---|---|---|
| CP-03 | High | Synthetic 40 h estimate shown and written to Jira. | See section 3 |
| CP-04 | High | A drop from the tray replaces the real assignee with "Unassigned". | Observed-code `index.ts:437`, `index.ts:258` |
| CP-05 | High | After one modal save, stored values override the Jira summary, status, assignee and estimate. Later Jira changes never show. | Observed-code `index.ts:251-264`, `index.html:1385` |
| CP-07 | High | A plain click on a bar calls `updateWbsTask`, which rewrites the Jira due date to the week end and can cascade to dependents. | Observed-code `index.html:1006-1030`, `index.ts:829-839` |
| CP-08 | High | Any issue with a non-epic `parent` counts as a subtask. Stories under an epic are hidden under an epic row that is usually not on the timeline. | Observed-code `index.ts:244`, `planner-engine.ts:586-589`. Observed-test probe P4 |
| CP-12 | High | Jira sync results are ignored. The bridge wrapper turns every error into `null`, and callers treat `null` as success. A failed subtask create can show "Created". | Observed-code `index.html:331-343`, `index.ts:455` |
| CP-14 | Medium | **`cascadeSchedule()`.** Cycle detection is correct. A probe reports `A -> C -> B -> A` for a 3-node cycle. The model allows one predecessor per task, so a diamond graph cannot exist. The offset formula `Math.floor(span * pct / 100)` is implemented, but whole-week rounding gives offset 0 for any trigger below 34% on a 3-week predecessor. A successor outside the 15-week window is pulled into the window. A task clamped at the window end loses 75% of its allocation. | Observed-code `planner-engine.ts:160-182`, `planner-engine.ts:521-533`. Observed-test probes P1-P3, P5 |
| CP-15 | Medium | Stored entries that Jira did not return come back as ghost rows. Deleted issues stay on the plan. | Observed-code `index.ts:329-355` |

#### UX and design

- **Mental model (PARTIAL):** a WBS grid beside Gantt bars, a backlog tray and drop slots fits how PMs plan. Hidden stories (CP-08) and snapped dates (CP-07) break trust in that model.
- **Drop affordance (PARTIAL):** drop slots exist. A drop silently writes 40 h and "Unassigned", so the affordance has a hidden cost.
- **Multi-resource subtasks (PASS):** one real Jira subtask per resource respects Jira's single-assignee rule. A second, KVS-only "Subtasks and Risk Buffer" section beside it confuses the two concepts (CP-24).
- **Destructive actions (FAIL):** unschedule, drop on tray, "Move to Backlog" and dependency removal act at once, with no confirm and no undo. Escape and a backdrop click close modals and lose unsaved edits with no warning (CP-20, `index.html:426-441`).
- **Modal dismissal:** Save, Cancel, the X, Escape and a backdrop click all close the modals. This meets the brief, but there is no guard for unsaved changes.
- **Errors (PARTIAL):** create and edit show the Jira error text. Bridge errors show as success (CP-12).
- **ADS (FAIL):** `style.css:1-18` redefines `--ds-*` token names as fixed light-theme hex values, so dark mode cannot work. `index.html` has 48 hex literals and 0 ARIA attributes. Scheduling is mouse-only (CP-21).
- **Responsive (FAIL, Observed-live at a 1280 px viewport, app frame 880 px wide):**
  - "+ Add Task / Issue" breaks over four lines.
  - The tray button reads "Backlog 23 ) Tray (", because its parts wrap out of order.
  - The view selector is clipped ("Project Tracking (WBS & Time").
  - With the tray open, the grid shows only up to the RESOURCE column, and the Gantt timeline is off-screen.
  - The LedgerSeal and DefinitionGuard panels wrap cleanly at the same width.

#### Suggestions

- **Tier 1 (quick wins):**
  1. Build rows with `createElement` and `textContent`, and validate payloads with a schema (CP-01).
  2. Move the script to a bundled file that imports `@forge/bridge` (CP-02).
  3. Remove every 40 h default. Send the real estimate and assignee on a drop (CP-03, CP-04).
  4. Write to Jira only after real movement. Send only changed fields (CP-05, CP-07).
  5. Treat `null` from the bridge as an error (CP-12).
  6. Remove the fixed header badges and heatmap strings. Delete the dead `src/frontend/index.tsx` (CP-19, CP-25).
  7. Commit the working tree and tag the build.
- **Tier 2 (hardening):**
  1. Store one KVS record per issue id, with a project-id prefix and a compare-and-set version check (CP-09, CP-11).
  2. Page with `nextPageToken` inside a time budget, and add 429 backoff (CP-10, CP-17).
  3. Build the hierarchy from `issuetype.hierarchyLevel` (CP-08).
  4. Read as the user (CP-06).
  5. Make the cascade date-based, with a preview before any Jira write (CP-14).
  6. Add licensing and issue-updated triggers.
- **Tier 3 (strategic UX):**
  1. Make the progress-threshold dependency the hero feature. Show the earliest-start reason on the connector.
  2. Allow many predecessors per task, ordered with Kahn's algorithm.
  3. Compute utilization from per-person capacity.
  4. Add keyboard scheduling, real ADS tokens, dark mode, and undo.
  5. Show FourRealities integrity badges on bars (section 5.4).

### 4.2 FourRealities (`apps/fourrealities`): 18 / 100

#### Code and security

| ID | Sev | Finding | Evidence |
|---|---|---|---|
| FR-01 | Critical | **React hook-order defect on the project dashboard.** `FourRealitiesApp` (lines 103-1085) returns early at `if (loading)` (line 300). Three `useMemo` hooks come later, at lines 585, 590 and 596. The first render calls fewer hooks than the second, so React throws "Rendered more hooks than during the previous render". The issue panel also falls into this path when `getIssueAlignment` fails. | Observed-code `src/frontend/index.tsx:300`, `src/frontend/index.tsx:585-596`. Lead confirmed the component boundaries. **Observed-live:** the project page shows only its title. The app iframe stays hidden with height 0 after 18 seconds and one reload. The React error text stays inside the cross-origin iframe, so the audit could not capture it. |
| FR-05 | High | User writes retry as the app after a 403. A user without edit rights still changes audit state. Tests assert this as correct. | Observed-code `index.ts:667-676`, `index.ts:738-747`. Lead re-read 657-676. |
| FR-06 | High | On the project page the context has no issue, so a payload `issueId` targets any issue in any project. The exception record is saved before any Jira check. | Observed-code `index.ts:590`, `index.ts:693`, `index.ts:764`, `index.ts:792` |
| FR-07 | High | History holds 10 full snapshots with every issue score (about 1 KB per issue). It passes 240 KiB at about 24 issues. After that, every dashboard load fails. | Observed-code `metrics-repository.ts:38-48`. Size Observed-test |
| FR-08 | High | The `/search/jql` loop pages with `startAt` and `total`. The enhanced endpoint pages with `nextPageToken`, so page 2 repeats page 1 and doubles the counts. Above 200 issues the list is cut silently. | Observed-code `index.ts:265-289`. **Observed-live:** with `maxResults=5`, `startAt=5` returned DEMO-1 to DEMO-5 again, and the response has no `total` field. |
| FR-12 | High | `recordIssueSignals` stores fully client-forged signals into the snapshot. No UI calls it, but `invoke` can. | Observed-code `index.ts:449-516` |
| FR-18 | Medium | The dashboard reads all issues as the app and caches them per project. Restricted issues show to every viewer. | Observed-code `index.ts:272` |
| FR-26 | Medium | **New (lead).** `sealIssue` hashes with `JSON.stringify(payload, Object.keys(payload).sort())`. A replacer array also filters nested objects, so any nested key that is not a top-level name drops out of the hash. | Observed-code `index.ts:640` |

#### Functional correctness

| ID | Sev | Finding | Evidence |
|---|---|---|---|
| FR-02 | Critical | **"Seal Issue" forges a LedgerSeal certificate.** It hashes 7 fields, invents an `LS-xxxxxxxx` id, and PUTs `ledgerseal-cert` with `SEAL_VALID`. LedgerSeal never holds this certificate. The write can overwrite a real `SEAL_BROKEN`. | Observed-code `index.ts:584-682`. Lead re-read 640-682. |
| FR-03 | Critical | **"Complete DoD" ticks all 5 generic items by default.** The server counts ticks from the payload and overwrites `definitionguard-dod`. DefinitionGuard's own checklist does not change, so the two apps disagree. | Observed-code `src/frontend/index.tsx:110-116`, `index.ts:703-747` |
| FR-04 | Critical | **The Audit gate checks property presence only.** It passes on `status === 'SEAL_VALID'` or `valid === true` with any truthy `snapshotHash`. It never verifies anything. It also reads two alias keys that no app writes. | Observed-code `index.ts:216-227` |
| FR-09 | High | On the dashboard, the Code gate is a substring test ("pullrequest", "APPROVED") on a fixed `customfield_10000`. The issue panel uses an undocumented dev-status API. The two views can disagree. | Observed-code `index.ts:204-213`, `index.ts:297`, `index.ts:396-398` |
| FR-10 | High | "Explain: No Code Change" passes the Code gate with a pre-filled reason, even when a PR exists. | Observed-code `index.ts:758-812`, `src/frontend/index.tsx:154` |
| FR-11 | High | The dashboard remediation buttons change state, but no modal renders, so nothing visible happens. | Observed-code `src/frontend/index.tsx:420-573` vs `src/frontend/index.tsx:1019-1047` |
| FR-13 | Medium | The Intent gate passes on keywords in link titles ("adr", "spec", "decision"). The UI pre-fills a passing title. "inspection" matches "spec". | Observed-code `index.ts:103-174`. **Observed-live:** DEMO-26 has a web link "ADR-014: Architecture Decision Record" to `https://confluence.atlassian.net/wiki/spaces/ARCH/pages/ADR-014`. That address is a placeholder, not this site's Confluence, but the title still satisfies the gate rule. |
| FR-14 | Medium | Unstarted issues score 100 and inflate the project average. 80 To Do issues and 20 poor Done issues give 86% "ALIGNED". | Observed-code `metrics-engine.ts:159-178`, `metrics-engine.ts:322` |
| FR-17, FR-21 | Medium | Recoverable points are fixed constants. Several denominators include To Do issues. An empty project shows 0% in red. | Observed-code `metrics-engine.ts:112-121`, `metrics-engine.ts:358-369` |

#### UX and design

- **Pipeline metaphor (PARTIAL):** Intent, Process, Code and Audit is a clear story for leads. The "──▶" arrows suggest causality that the scoring does not model: each gate is scored on its own. Exceptions show as PASSED, so the pipeline hides the difference between real evidence and an excuse.
- **Glyphs and colour (PARTIAL):** the gate pills show glyph, colour and label, so colour is not the only signal. `MiniGateRow` shows four bare glyphs with no names. Screen readers read "black circle" and "multiplication x".
- **Clutter (PARTIAL):** the dashboard puts a hero, 4 cards, 2 button rows, a table and modals on one page. Remediation belongs in the issue panel. The dashboard should do triage and deep links.
- **Honest feedback (FAIL):** the seal modal shows check marks beside BLOCKED gates and a fixed "Definition of Done: Complete". Success text says "gate verified" before the gate is re-evaluated (FR-20).
- **ADS (PARTIAL):** Lozenge and Badge appearances only, no hex. Every modal has `onClose` and Cancel. `Inline` rows lack `shouldWrap`, so cards overflow at narrow widths.

#### Suggestions

- **Tier 1 (quick wins):**
  1. Move the three `useMemo` calls above the first return, and add a render test (FR-01).
  2. Delete `sealIssue`, `completeDod` and `recordIssueSignals`. Replace their buttons with links to the LedgerSeal and DefinitionGuard panels (FR-02, FR-03, FR-12).
  3. Remove every asApp fallback after a user write (FR-05).
  4. Drop the `valid`, `satisfied`, `ledgersealCert` and `definitionguardDod` aliases.
  5. Stop pre-filling ADR titles, exception reasons and DoD ticks.
- **Tier 2 (hardening):**
  1. Page with `nextPageToken` and add retry (FR-08).
  2. Store only summaries in history, with a scheduled trigger for snapshots (FR-07, FR-15).
  3. Check the project key on every payload issue id (FR-06).
  4. Search as the user (FR-18).
  5. Use one Code-gate data path, labelled "heuristic" until approval data is real (FR-09).
  6. Mark unstarted issues UNRATED (FR-14).
  7. Verify sibling attestations as described in section 5.
- **Tier 3 (strategic UX):**
  1. Give each gate three states: "evidence found", "evidence missing" and "not yet applicable". Name the source, for example "Source: LedgerSeal, signature verified".
  2. Add a distinct "Excepted" state that shows who and why.
  3. Show a weekly RAI sparkline in place of the per-view trend.
  4. Publish gate results for CascadePlan (section 5.4).

### 4.3 LedgerSeal (`apps/ledgerseal`): 25 / 100

#### Code and security

| ID | Sev | Finding | Evidence |
|---|---|---|---|
| LS-01 | Critical | **Any user who can view the issue can seal or reseal it.** The code has no permission, role or approver check. In a probe, a user tampers with an issue, reseals it, and the validator passes. | Observed-code `index.ts:167-229`, `index.ts:344-346`. Lead re-read. Observed-test `flow.js` step 3 |
| LS-03 | High | `signerEmail` comes from the payload. Jira replaces it only when the profile shows an email, and most profiles hide it. In a probe, `cfo@victim.example` was stored for another user. | Observed-code `index.ts:194-206`. Lead re-read 196. |
| LS-06 | High | `verifyIssue` calls `saveCertificate(activeCert)` on every view of a tampered issue. `saveCertificate` archives the same certificate as SUPERSEDED against itself and appends a history row and an incident. 500 views give a 152 KB record. | Observed-code `index.ts:292-298`, `seal-repository.ts:46-62`. Lead re-read. Observed-test |
| LS-07 | Medium | The full snapshot sits in one KVS value. A 400-paragraph description gives a 108 KB certificate. No concurrency control. | Observed-test |
| LS-10 | High | The seal is a plain SHA-256 digest with no key and no signature. `verifyCertificateIntegrity` has no caller. The design is tamper-evident against normal users, who cannot write app storage. It gives no evidence against the vendor, a modified deploy, or LS-01. | Observed-code `crypto.ts:24-25`, `crypto.ts:67` |
| LS-14 | Medium | `NODE_ENV === 'test'` branches in production code accept a client issue and skip re-authentication. | Observed-code `index.ts:183-186`, `index.ts:210` |
| LS-15 | Medium | No retry. No `fields=` filter. Every error is swallowed to `null`. | Observed-code `index.ts:48-56` |

#### Functional correctness and crypto

| ID | Sev | Finding | Evidence |
|---|---|---|---|
| LS-02 | Critical | **A reseal hides earlier tampering.** The new certificate has no `isCompromised` flag and no `tamperHistory`. The history row says only "SUPERSEDED". The panel shows "UNTAMPERED & AUDIT READY". | Observed-code `index.ts:228`, `seal-repository.ts:46-66`. Lead re-read. |
| LS-04 | High | Status, reporter, resolution, worklog and time tracking are outside the hash. | Observed-code `canonicalizer.ts:226-258`, `crypto.ts:14-22`. Observed-test |
| LS-05 | High | 13 fixed custom field ids and value heuristics drop real fields. Custom field ids differ on each Jira site. | Observed-code `canonicalizer.ts:25-66`. Observed-test |
| LS-08 | High | When the Jira fetch fails, the validator reports "Summary modified after sign-off" and writes SEAL_BROKEN to the property. The gate correctly stays closed, but the message is false. | Observed-code `index.ts:109-147`. Lead re-read. Observed-test |
| LS-09 | High | The stored declaration differs from the text the user agrees to. "Re-authentication" accepts any non-empty text. This contradicts the Part 11 claim. | Observed-code `src/frontend/index.tsx:87` vs `src/frontend/index.tsx:233`, `index.ts:209` |
| LS-11 | Medium | Ordered arrays are sorted. Text is trimmed. An empty array equals an absent field. A display-name change breaks the seal. Equal instants in two time zones give different hashes. | Observed-test |
| LS-16 | Medium | A change that someone reverts before the next view or transition is never detected. No changelog read. | Observed-code |
| LS-18 | Low (resolved by docs) | The validator reads `payload.transition.modifiedFields`, which matches the documented payload. The documented shape is REST v3 "Get issue" format, with two exceptions: user fields carry `accountId` only, and cleared arrays are `null`. The payload carries `issue.key` only, so both validators resolve the id by a Jira call, as coded. | Reported: Forge "Jira workflow validator (preview)" page, section "Validating with lambda functions". Observed-code `index.ts:81-93` |
| LS-22 | Low | **New (lead).** `normalizeEntityField` hashes the assignee as `{accountId, displayName}` (`canonicalizer.ts:78-83`). The validator payload carries `{accountId}` only, so a transition-screen assignee change is hashed with displayName "unknown". The change is real, so SEAL_BROKEN is correct, but the altered-field text is misleading. The fix is the same as LS-11: hash the accountId only. | Observed-code. Payload shape Reported |

**Canonicalizer verdict (`canonicalizeIssueState`).** Key order is normalised. ADF order is kept and `localId` is stripped. Comments are hashed. Dates are not normalised. User objects hash the display name, so a profile rename breaks seals. Empty arrays become null, which hides a real change. Custom fields are excluded by id and by value, not by schema type.

**Crypto verdict.** The primitive (Node `crypto` SHA-256) is correct. The trust model is the problem: no key, no signature, and no outside anchor.

#### UX and design

- **Observed-live (DEMO-22):** the panel shows a red "CRITICAL: Cryptographic Seal Broken" message, a "TAMPER DETECTED" lozenge, and the altered field with its before and after values. It also shows a "Re-Authorize and Reseal" button, the certificate id, the signer's name and accountId, and the full digest. The tamper display is clear and useful. The reseal button is visible to every viewer (LS-01).
- **Certificate trust (PARTIAL):** shows the signer, an ISO timestamp and counts. It does not show which fields were sealed. "AUDIT READY" is an over-claim.
- **State distinction (PASS):** SEAL_VALID, SEAL_BROKEN and UNSEALED differ by title text and lozenge text, not by colour alone.
- **Error UX (FAIL):** a load failure shows "Issue Not Sealed" and offers "Seal Issue" (LS-12). A seal failure leaves the form open with no message.
- **Destructive actions (PARTIAL):** reseal needs a checkbox and text, but anyone can do it (LS-01). Revoke and history exist in code but have no resolver or UI (LS-13).
- **ADS (PASS):** UI Kit components and space tokens only, no hex.

#### Suggestions

- **Tier 1 (quick wins):**
  1. Take identity from context only (LS-03).
  2. Store the exact declaration text the user saw (LS-09).
  3. Stop `verifyIssue` from calling `saveCertificate`. Record an incident only on a new live hash (LS-06).
  4. When the Jira fetch fails, say so (LS-08).
  5. Add an ERROR UI state (LS-12).
  6. Hash reporter and resolution. Hash users by accountId (LS-04, LS-11).
  7. Remove the Part 11, SOC 2, Cloud Fortified, residency, 3LO and "immutable" claims.
- **Tier 2 (hardening):**
  1. Add an approver policy with separation of duties, so a reseal needs a different user (LS-01).
  2. Carry tamper history forward. Chain the history entries by hash (LS-02).
  3. Exclude fields by schema type through `/rest/api/3/field` (LS-05).
  4. Detect changes from the changelog or the issue-updated event (LS-16).
  5. Sign attestations with Ed25519 (section 5.1).
  6. Inject a Jira client in place of the `NODE_ENV` branches (LS-14).
- **Tier 3 (strategic UX):**
  1. Add a certificate view that lists sealed and excluded fields, the full hash with a copy action, and local time.
  2. Add a per-field diff that shows who changed each field, and when, from the changelog.
  3. Add a reseal flow that names the tamper and notifies the original signer.
  4. Publish an open-source verifier.

### 4.4 DefinitionGuard (`apps/definitionguard`): 35 / 100

#### Code and security

| ID | Sev | Finding | Evidence |
|---|---|---|---|
| DG-02 | High | **No permission check.** Any user who can view the issue can tick mandatory items or reset the checklist. The assignee can tick "Peer review approved" on their own work. | Observed-code `index.ts:207-322`. Lead re-read. |
| DG-03 | Medium (lead downgraded from High) | `saveProjectTemplate` has no admin check and no shape or size check. **Lead note:** in an issue panel, Forge always supplies `context.extension.project.key`, so the payload fallback cannot reach another project from the UI. Nothing reads saved templates today (DG-04). So the present impact is storage abuse, not gate bypass. It becomes High once DG-04 is fixed. | Observed-code `index.ts:341-360`. Lead re-read. |
| DG-05 | High | Concurrent ticks lose an update. A probe shows one of two ticks stored and one audit event. | Observed-code `index.ts:227-245`. Observed-test probe 14 |
| DG-06 | High | The audit trail has no cap. The record passes 240 KiB after 814 toggles. After that, saves fail and the issue stays blocked for good. | Observed-code `checklist-engine.ts:426`. Observed-test probe 16 |
| DG-08 | Medium | The validator does not catch KVS errors. The Forge docs say an expression validator "evaluates to false" when it fails, but they do not say what happens when a lambda validator throws or times out. So the fail-open risk cannot be ruled out from the docs. A read-only session cannot test it, because the test needs a deployed validator that throws. Catch every error and return `result: false`, whatever the platform default is. | Observed-code `index.ts:102-121`. Platform behaviour: Reported (docs are silent) |
| DG-10 | Medium | The entity property write ignores errors and is not written on validator auto-init. `completedCount` includes optional items. Any editor can overwrite the property. | Observed-code `index.ts:157-168`, `index.ts:248-259` |

#### Functional correctness

| ID | Sev | Finding | Evidence |
|---|---|---|---|
| DG-01 | High | **`calculateChecklistHash()` is order-independent (probe 2), but nothing ever verifies it.** It skips item history and earlier audit events. A forged state with a recomputed hash passes the validator. The UI calls it "tamper-evident". | Observed-code `hasher.ts:14-42`. Observed-test probes 7-12 |
| DG-04 | High | Customers cannot define their own DoD. No settings page exists, and saved templates are never applied. Buyers get 6 fixed templates that include mandatory "SOC 2 and ISO 27001" items they may not use. | Observed-code `index.ts:118`, `index.ts:151`, `index.ts:230`, `index.ts:297` |
| DG-07 | Medium | The validator does not check for Done. It blocks any transition an admin attaches it to. The panel says "Workflow transitions are blocked" even when no validator is set up. The documented payload includes `transition.to.id`, so a status-category check is possible without extra design. | Observed-code `index.ts:82-125`, `src/frontend/index.tsx:125`. Payload Reported (Forge docs) |
| DG-09 | Medium | Every panel load rewrites stored accountIds to current display names and does not recompute the hash. The stored hash then no longer matches its own content. | Observed-code `index.ts:169-198`. Observed-test probe 12 |
| DG-11 | Medium | No evidence field exists. `notes` is in the backend, but the UI never sends it. | Observed-code `src/frontend/index.tsx:50-53` |
| DG-12 | Medium | Checklists never follow template or issue-type changes. | Observed-code `checklist-engine.ts:316-322` |

**Correct behaviour:** an issue cannot bypass the gate by never opening the panel. The validator creates a checklist and blocks (`index.ts:111-121`). Its Jira error names the pending items (`transition-validator.ts:44-51`). Reset keeps all prior history.

#### UX and design

- **Observed-live (DEMO-22):** the panel shows "Definition of Done Incomplete: 2 mandatory item(s) remain pending. Workflow transitions are blocked." It shows a blue "GATE LOCKED" lozenge, a "v3" label and a "Checklist Hash: 58493ea37c58590a..." line. It does not name the two pending items.
- **Mandatory vs optional (PASS):** text lozenges MANDATORY and OPTIONAL, so colour is not the only signal. MANDATORY uses the yellow `moved` appearance, which does not match its ADS meaning.
- **Progress feedback (PARTIAL):** the panel shows a count of pending mandatory items. It does not name them, and it has no progress bar. "GATE LOCKED" uses the blue `inprogress` appearance.
- **Reset (PASS):** inline confirmation before reset.
- **Errors (PARTIAL):** the validator message is actionable. Panel errors show raw `err.message` with no next step.
- **Clutter (PARTIAL):** the panel shows the internal ticket code "(D-13)", a "v3" label and an unexplained hash fragment. The audit trail shows item ids, not titles. Times are in UTC ISO format, not the user's locale.

#### Suggestions

- **Tier 1 (quick wins):**
  1. Remove "tamper-evident" and the over-claims.
  2. Wrap the validator in try/catch and fail closed with a clear message (DG-08).
  3. List pending item titles in the panel.
  4. Remove "(D-13)" and "v3", and show item titles in the audit trail.
  5. Stop rewriting names on read (DG-09).
  6. Fix the fallback test (DG-13).
- **Tier 2 (hardening):**
  1. Check Edit Issues permission as the user before a toggle. Limit reset to project admins (DG-02).
  2. Use a KVS compare-and-set, or one key per item (DG-05).
  3. Move the audit trail to append-only keys (DG-06).
  4. Add a hash chain with a verify routine shown in the panel (DG-01).
  5. Write a full, signed property on every change (section 5.2).
- **Tier 3 (strategic UX):**
  1. Add a project settings page with a template editor: per-item roles, "evidence required", and versioning with re-sync (DG-04, DG-12).
  2. Gate on status category `done` by default, and add an onboarding check that lists workflows without the validator (DG-07).
  3. Add per-item evidence and a "reviewer is not the assignee" rule (DG-11).

**Path to market:** after the Tier 1 fixes and an honest listing, DefinitionGuard can ship as a **free** "DoD checklist plus validator". It is the closest of the four to a release.

---

## 5. Cross-App Unified Integrity Pipeline Blueprint

### 5.0 Design rules

1. **Each fact has one writer.** Only LedgerSeal writes seal facts. Only DefinitionGuard writes DoD facts. Only FourRealities writes gate results. No app writes another app's key. This rule removes FR-02 and FR-03 by design.
2. **A property is a claim. A signature makes it evidence.** Entity properties are writable by any editor and any app. So each producer signs its property with an Ed25519 private key held in a Forge encrypted environment variable. Consumers embed the producer's public key and verify the signature. A user can then change the property, but cannot forge it. An auditor can verify it with the published public key and no access to app storage. Use asymmetric keys, not a shared HMAC secret: a shared secret lets every consumer forge the producer's facts.
3. **Every attestation names its subject and time.** It must include `issueId`, so a value copied from another issue fails. It must include `issuedAt`, so a reader can detect a stale value.
4. **Freshness is part of the verdict.** If the issue `updated` time is later than `issuedAt`, the reader shows "Needs re-check", not "Verified".
5. **Shared contract code.** A small package (for example `packages/integrity-contract`) holds the TypeScript types, canonical JSON (sorted keys, UTF-8, no whitespace), and `verifyAttestation()`. Each app bundles it at build time.
6. **Graceful absence.** If a sibling app is not installed, the gate shows "Not applicable: LedgerSeal not installed". It must not show "Missing" or "Failed".

### 5.1 LedgerSeal attestation: `ledgerseal-cert` (schema v2)

```json
{
  "schemaVersion": 2,
  "issueId": "10042",
  "status": "SEAL_VALID | SEAL_BROKEN | SEAL_COMPROMISED | SEAL_REVOKED | UNSEALED",
  "certificateId": "uuid",
  "snapshotHash": "64 hex",
  "canonicalizerVersion": "2.0.0",
  "sealedAt": "ISO-8601 UTC",
  "sealedByAccountId": "557058:...",
  "everCompromised": true,
  "incidentCount": 2,
  "issuedAt": "ISO-8601 UTC",
  "keyId": "ls-2026-11",
  "sig": "base64 Ed25519 over canonical JSON of all other fields"
}
```

- LedgerSeal writes the property on seal, on verify, on validator failure, and on revoke. It uses the real tamper count on every write.
- `everCompromised` survives a reseal. This keeps LS-02 visible to every consumer.
- Add a `jira:entityProperty` index on `status` and `everCompromised`. Then JQL such as `issue.property[ledgerseal-cert].status = SEAL_BROKEN` works for dashboards and filters.

### 5.2 DefinitionGuard attestation: `definitionguard-dod` (schema v2)

```json
{
  "schemaVersion": 2,
  "issueId": "10042",
  "templateId": "standard-engineering",
  "templateVersion": 3,
  "stateVersion": 17,
  "mandatoryTotal": 5,
  "mandatoryCompleted": 4,
  "openMandatoryItemIds": ["item-security-scan"],
  "isFullySatisfied": false,
  "lastModifiedByAccountId": "557058:...",
  "issuedAt": "ISO-8601 UTC",
  "keyId": "dg-2026-11",
  "sig": "base64 Ed25519"
}
```

- DefinitionGuard writes the property on every state change, including validator auto-init. It checks the HTTP status and retries on 429 and 5xx.

### 5.3 How FourRealities reads them

- **One search per page:** keep the single `/search/jql` call with `properties=ledgerseal-cert,definitionguard-dod`, `fields=updated,...`, and paging with `nextPageToken`. No extra call per issue.
- **Audit gate:**

| Signature | Status | Fresh (`issuedAt` >= `updated`) | Gate shows |
|---|---|---|---|
| Valid | SEAL_VALID | Yes | PASSED: "Sealed, signature verified" |
| Valid | SEAL_VALID | No | ATTENTION: "Changed since last LedgerSeal check" |
| Valid | SEAL_BROKEN or SEAL_COMPROMISED | Any | BLOCKED: "Seal broken" |
| Valid | SEAL_VALID with `everCompromised: true` | Yes | PASSED with a note: "Resealed after tamper (2 incidents)" |
| Missing | n/a | n/a | BLOCKED: "Not sealed" (or "Not applicable" if LedgerSeal is absent) |
| Invalid or wrong `issueId` | n/a | n/a | BLOCKED in red: "Seal record failed verification", plus an admin alert |

- **Process gate:** same rule, with `definitionguard-dod`. The gate uses `mandatoryCompleted` / `mandatoryTotal` and names the open items.
- **Remediation:** a button deep-links to the producer's issue panel with `router.open`. FourRealities never writes the property itself.

### 5.4 FourRealities output for CascadePlan: `fourrealities-gates`

```json
{
  "schemaVersion": 1,
  "issueId": "10042",
  "gates": { "intent": "PASSED", "process": "ATTENTION", "code": "BLOCKED", "audit": "NOT_APPLICABLE" },
  "excepted": ["code"],
  "rai": 62,
  "evaluatedAt": "ISO-8601 UTC",
  "keyId": "fr-2026-11",
  "sig": "base64 Ed25519"
}
```

- FourRealities writes this property from a scheduled trigger and from the issue-updated event, not on each page view. This also fixes the noisy trend (FR-15).
- **CascadePlan rendering:**
  1. Add `fourrealities-gates,ledgerseal-cert,definitionguard-dod` to the `properties=` parameter of the existing issue search, so no new calls are needed.
  2. Verify each signature with the contract package.
  3. Draw a small badge at the right end of each bar with `textContent`, never `innerHTML`. Use an amber `color.icon.warning` badge for ATTENTION, unsealed or stale. Use a red `color.icon.danger` badge for BLOCKED or a broken seal. Show no badge when all gates pass.
  4. The tooltip names the gate and the source, for example "Audit: not sealed (LedgerSeal)".
  5. A click opens the issue with `router.open`.
  6. Add a filter: "Show only tasks with integrity warnings".
- This turns the portfolio into one story. CascadePlan shows when work is due. FourRealities shows whether that work can be trusted. LedgerSeal and DefinitionGuard are the evidence sources.

### 5.5 Key management

- Generate one Ed25519 key pair per producer app and environment. Store the private key with `forge variables set --encrypt`.
- Publish the public keys in each consumer bundle, and on a public page for auditors.
- `keyId` allows rotation. Consumers accept the current key and the previous key for a stated overlap period.
- **Limit of this design:** the vendor holds the private keys. The signatures prove that the app wrote the attestation. They do not protect against the vendor. For buyers who need that, add an optional outside anchor, such as a signer-authored issue comment or a customer webhook. The listing must state this limit plainly.

---

## 6. Final Commercial Recommendation

### Decision: No-Go for paid Marketplace listings (all four apps)

| App | Decision now | Earliest Go condition |
|---|---|---|
| DefinitionGuard | **No-Go (paid). Conditional Go (free)** after Tier 1 fixes and an honest listing. | Paid: DG-02, DG-04, DG-05 and DG-06 fixed, licensing on, settings page shipped. |
| CascadePlan | **No-Go.** No Critical finding remains, but 12 High findings block a paid listing. HTML injection (CP-01) and silent writes of fake estimates and dates to Jira (CP-03, CP-07) also block a free release. | CP-01 to CP-12 fixed, UI bundled and tested, licensing on, sealed-issue guard (PX-04). |
| LedgerSeal | **No-Go.** Do not sell to regulated buyers on the current claims. | LS-01 to LS-10 fixed, signed attestations, all regulatory claims removed or backed by a documented control mapping and legal review. |
| FourRealities | **No-Go.** It depends on honest sibling data. | FR-01 to FR-12 fixed, the forging remediations deleted, and section 5.3 implemented. Ship it after LedgerSeal and DefinitionGuard publish signed v2 properties. |

### Recommended order of work

1. **Week 1: portfolio-wide.**
   - Rewrite all four listings from the code (PX-02).
   - Commit and tag the PlanShift working tree.
   - Fix FR-01 and CP-01. Both are small changes with a large effect.
2. **Weeks 1 to 2:**
   - Delete the FourRealities write paths into sibling keys (FR-02, FR-03, FR-05, FR-12).
   - Add permission checks to LedgerSeal and DefinitionGuard (LS-01, DG-02).
3. **Weeks 2 to 4:**
   - Redesign storage in all four apps: bounded values, per-entity keys, and compare-and-set (CP-09, FR-07, LS-06, DG-05, DG-06).
   - Add pagination and retry.
   - Add licensing (PX-01).
   - Add UI tests (PX-03).
4. **Weeks 4 to 8:**
   - Build the integrity contract package and signed v2 properties (section 5).
   - Add the DefinitionGuard settings page.
   - Move the LedgerSeal canonicalizer to schema-based field exclusion.
5. **Then:**
   - A fresh live audit on the DEMO site.
   - A security review of the resolvers with crafted payloads.
   - A Marketplace security self-assessment.

---

## 7. Live check results and open items

### 7.1 Results (2026-10-31, read-only)

| # | Item | Result | Finding |
|---|---|---|---|
| 1 | Does the CascadePlan Custom UI load under the deployed CSP? | **Yes.** It renders 4 scheduled issues and a backlog of 22. CP-02 is downgraded to High. | CP-02 |
| 2 | Does the FourRealities project page render? | **No.** Only the page title shows. The app iframe stays hidden with height 0. This fits FR-01. The React error text was not captured. | FR-01 |
| 3 | Does `/search/jql` ignore `startAt`? | **Yes.** Page 2 repeats page 1. The response has no `total`. | FR-08 |
| 4 | Does CascadePlan show synthetic values? | **Yes:** 40 h on an unestimated issue, epic "Prerequisites", target 0%, sprint labels on a service project. | CP-03, CP-18, CP-19 |
| 5 | Do the sibling properties hold forged shapes? | **Yes,** on DEMO-26. | FR-02, FR-03 |
| 6 | Is the entity property authoritative? | **No.** DEMO-22 said SEAL_VALID while the seal was broken. The property changed only when the panel was opened. | LS-06, PX-04 |
| 7 | Do apps conflict? | **Yes.** An estimate change, probably from CascadePlan, broke a LedgerSeal seal. | PX-04 |

### 7.2 Second live session (2026-10-31, owner-approved)

| # | Item | Result | Finding |
|---|---|---|---|
| 1 | Harmless XSS probe on a new test issue (DEMO-27) | **HTML and attribute injection confirmed. Script blocked by the CSP.** CP-01 is downgraded to High, and CP-29 is added. | CP-01, CP-29 |
| 2 | Validator payload location and shape | **Resolved from the Forge docs.** The location matches the code. User fields carry `accountId` only. LS-22 is added. | LS-18, LS-22 |
| 3 | Does a lambda validator that throws let the transition pass? | **Not documented.** The docs state fail-closed only for expression validators. It cannot be tested without deploying a throwing validator to a workflow. | DG-08 |
| 4 | Layout at a true 1280 px viewport | **CascadePlan FAIL** (wrapping, clipping, timeline off-screen with the tray open). Issue panels PASS. FourRealities could not be judged, because it renders blank. | CP-21, FR-23 |
| 5 | Checks on a Jira Software project | **Not possible.** The site has two projects, DEMO and TEST, and both are service projects. | CP-08, CP-18 |

### 7.3 Still open

| # | Item | What it needs |
|---|---|---|
| 1 | Lambda validator behaviour on throw or timeout (DG-08) | A test app version whose validator throws, attached to a test workflow, or an answer from Atlassian developer support. |
| 2 | Epic, story and sprint behaviour (CP-08, CP-18) | A Jira Software project on the site, with an epic, two stories, one subtask and an active sprint. |
| 3 | FourRealities layout | FR-01 must be fixed first. |

### 7.4 Writes made by the audit

- **DEMO-27 created** for the CP-01 probe. Its summary is now "AUDIT PROBE CP-01 (neutralised, safe to delete)", with the label `audit-probe`. Permanent deletion is left to the site owner.
- **DEMO-22:** opening its LedgerSeal panel rewrote the `ledgerseal-cert` property and added a history row (normal on-view behaviour, LS-06).
- **Not made by the audit:** the DEMO-22 due date and the DEMO-28 subtask (2026-10-31, 10:38-10:39 local time, under the owner's account).

## Appendices (this folder)

- `appendix-planshift.md`: CascadePlan, 28 findings (CP-01 to CP-28), probes, and the status of the 22 findings from the 2026-10-30 audit.
- `appendix-fourrealities.md`: FourRealities, 25 findings, listing over-claims, and cross-app property facts.
- `appendix-ledgerseal.md`: LedgerSeal, 21 findings, canonicalizer probes, and over-claims.
- `appendix-definitionguard.md`: DefinitionGuard, 16 findings, hash and race probes, and over-claims.
- `snapshot-md5.txt`: MD5 of every reviewed source file.

The probe scripts live outside the repo, under `~/Documents/projects/jira-governance/.tmp/cache/portfolio-audit/`. Those are `ledgerseal-scratch/`, `definitionguard-scratch/` and `planshift-scripts/`.

Some details in this report differ from the appendices. These items appear only in this report:
- the lead's FR-26, PX-04, CP-29 and LS-22;
- the DG-03, CP-02 and CP-01 downgrades;
- the CascadePlan score change (25 to 32);
- the LS-04 time-tracking correction;
- all Observed-live evidence.

The appendices keep the reviewers' original text.
