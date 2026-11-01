# FourRealities: Specification v2

- **Status:** working specification for Part B (backlog B-01 to B-25). `fourrealities-spec.md` (v1) is frozen.
- **Date:** 2026-11-01
- **Sources:** `docs/sdlc/fourrealities-usp-ux-research-2026-11/` (research brief, UX spec, backlog) and the portfolio audit of 2026-10-31, section 5.

## Executive Summary

FourRealities shows, for each Jira issue, whether four kinds of delivery evidence exist, and where each piece of evidence comes from:

1. **Intent:** the issue links to a Confluence page on this site, or to a decision or specification issue.
2. **Process:** a Definition of Done record says the checklist is complete. Rework loops from the status changelog are shown beside it.
3. **Code:** the Development field shows a pull request. FourRealities cannot read review approvals, so this gate is a heuristic.
4. **Audit:** a LedgerSeal record says the issue is sealed.

Every gate names its source and says whether FourRealities verified the fact itself, read it as an unverified hint from another app, or used a heuristic. FourRealities never writes evidence that another app owns. It runs on Forge with no external egress.

## Invariants

1. **One writer per fact.** FourRealities writes only its own keys: KVS keys with the `fr:` prefix and the issue property `fourrealities-exception`. It writes a remote link only when a user asks, as that user. It never writes `ledgerseal-cert`, `definitionguard-dod` or `checklist`.
2. **No pre-filled evidence.** No form opens with a value that counts as evidence.
3. **An exception is not a pass.** An excepted gate has its own state and never counts as found.
4. **User actions run as the user.** A 403 for the user is returned to the user. There is no retry as the app.
5. **Feedback comes from re-evaluation.** Text after an action is built from the gate state read after the action.
6. **Bounded storage.** No KVS value grows with page views. The largest value at 2,000 issues stays under 100 KiB.
7. **Viewer permissions.** Rows that a viewer cannot browse in Jira are never returned to that viewer.
8. **Zero external egress.** The manifest declares no external fetch.
9. **Deterministic metrics.** The same input gives the same output.

## Domain Model

```typescript
type GateName = 'intent' | 'process' | 'code' | 'audit';

type GateState =
  | 'FOUND'           // evidence found
  | 'MISSING'         // the gate applies and the evidence is absent
  | 'EXCEPTED'        // a recorded exception (Code only), with who, when and why
  | 'NEEDS_RECHECK'   // the evidence may be stale or was not read yet
  | 'NOT_APPLICABLE'; // the gate does not apply yet, or no data source exists

type Verification = 'VERIFIED' | 'NOT_VERIFIED' | 'HEURISTIC';

interface GateResult {
  state: GateState;
  verification?: Verification;   // set when state is FOUND
  reason: GateReason;            // a code; the UI turns it into text
  args?: Record<string, string | number>;
  method?: string;               // evidence source id in the catalog; set when a source record was read
  evidenceRef?: string;          // what was seen, at most 200 characters
}

interface IssueRow {               // one row per issue, stored in snapshot chunks
  issueId: string;
  issueKey: string;
  summary: string;                 // at most 120 characters
  statusCategory: 'new' | 'indeterminate' | 'done';
  assigneeName?: string;
  sprintNames: string[];
  gates: Record<GateName, GateResult>;
  reworkLoops: number;
  rai: number | null;              // null when UNRATED
  risk: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL' | 'UNRATED';
  applicableGates: number;         // gates in FOUND or MISSING
  recoverablePoints: number;
  codeException?: GateExceptionState; // current Code exception state, shown in the panel
  reworkNote?: ExceptionNote;      // the latest rework note
  reworkNoteCount?: number;        // how many rework notes exist, when at least one
}

interface ExceptionNote { reason: string; notes?: string; recordedBy: string; recordedByName?: string; recordedAt: string; }

interface ReworkNote extends ExceptionNote { // KVS fr:note:{issueId}:{recordedAt}:{seq}, written once (ADR-001 Pattern 6)
  schemaVersion: 1;
  issueId: string;
  issueKey: string;
  migrated?: boolean;              // converted from a v2 record
}

interface ExceptionRecord {        // KVS fr:issue:{id}:exception (v2): read for migration only; no code writes it
  schemaVersion: 2;
  issueId: string;
  issueKey: string;
  code?: ExceptionNote;
  rework?: ExceptionNote;
}

interface GateCount { found: number; missing: number; excepted: number; recheck: number; notApplicable: number; }

interface ProjectSummary {
  totalIssues: number;             // rows in scope
  ratedIssues: number;
  unratedIssues: number;
  averageRAI: number | null;
  gates: Record<GateName, GateCount>;
  m11IntentRate: number | null;    // FOUND / (FOUND + MISSING), intent
  m29PullRequestRate: number | null; // FOUND / (FOUND + MISSING), code (heuristic)
  m30ReworkRate: number | null;    // started issues with a rework loop / started issues
  dodRate: number | null;          // process
  sealRate: number | null;         // audit
  riskDistribution: { low: number; medium: number; high: number; critical: number; unrated: number };
}

interface TrendPoint {             // one per ISO week (Monday, UTC)
  weekStart: string;               // YYYY-MM-DD
  generatedAt: string;
  ratedIssues: number;
  averageRAI: number | null;
  gates: Record<GateName, { found: number; missing: number }>;
  startedIssues: number;
  reworkIssues: number;
}

interface SnapshotMeta {
  schemaVersion: 2;
  projectKey: string;
  snapshotId: string;
  generatedAt: string;
  generatedBy: 'scheduled' | string; // accountId for a manual refresh
  chunkCount: number;
  shownCount: number;              // unique issues read
  totalKnown: number | null;       // approximate count when capped
  capped: boolean;
  remoteLinksRead: number;         // started issues whose remote links were read in time
}
```

The removed v1 types are `RealitySignals` as stored state, `ProjectAuditSnapshot`, `MetricSummary` and the `HOLLOW`, `PASSED`, `ATTENTION` and `BLOCKED` gate statuses.

## Gates

"Started" means the status category is not `new`, or the changelog has at least one status change. "Done" means the status category key is `done`. Status matching uses `statusCategory.key`, never the status name.

### Evidence catalog and observations (ADR-001 Patterns 2 and 4)

Every name the gates match on is data in one catalog (`src/contract/data/catalog.ts`, `DEFAULT_CATALOG`); the gate code holds no lists. The catalog holds the evidence sources, each with its gate and verification class, and the Intent rule (issue types, content application types, same-site content path). The values in the tables below are the defaults. The key `fr:p:{key}:catalog` is reserved for a per-project override; no code writes it yet.

| Source (`method`) | Gate | Verification when FOUND | `evidenceRef` |
|---|---|---|---|
| `CONFLUENCE_PAGE_LINK` | Intent | VERIFIED | the link URL |
| `DECISION_ISSUE_LINK` | Intent | VERIFIED | the linked issue key |
| `DEFINITIONGUARD_PROPERTY` | Process | NOT_VERIFIED | the checklist hash, when the shape is DefinitionGuard's |
| `HEROCODERS_CHECKLIST_PROPERTY` | Process | NOT_VERIFIED | the property's `progressText` (B-25) |
| `DEVELOPMENT_FIELD` | Code | HEURISTIC | `pull requests: n` |
| `GATE_EXCEPTION` | Code | (EXCEPTED) | `approved <time>` |
| `LEDGERSEAL_PROPERTY` | Audit | NOT_VERIFIED | the certificate id, when the shape is LedgerSeal's |

A gate result is an observation: `method` names the source whose record it rests on, including a record that was read and did not count. A result with no source record (for example `INTENT_NONE`, `DOD_NONE`, `NOT_DONE`) has no `method`. Verification is taken from the catalog source.

### Intent

| Condition | State | Verification | Reason |
|---|---|---|---|
| A remote link points to a Confluence page on this site: `application.type` is `com.atlassian.confluence`, or the URL host equals the site host and the path starts with `/wiki/` | FOUND | VERIFIED | `INTENT_CONFLUENCE_LINK` (args: title) |
| An issue link points to an issue whose type name, compared without case, is one of `adr`, `architecture decision`, `decision`, `decision record`, `spec`, `specification`, `requirement` | FOUND | VERIFIED | `INTENT_DECISION_ISSUE` (args: key, type) |
| Started, remote links not read in this snapshot, and no qualifying issue link | NEEDS_RECHECK | | `INTENT_LINKS_NOT_READ` |
| Started, nothing qualifies | MISSING | | `INTENT_NONE` |
| Not started, nothing qualifies | NOT_APPLICABLE | | `NOT_STARTED` |

"VERIFIED" means FourRealities read the link from Jira itself. It does not read the page, and the text says so. Title keywords never count.

### Process (Definition of Done)

| Condition | State | Verification | Reason |
|---|---|---|---|
| `definitionguard-dod` has DefinitionGuard's shape and `isFullySatisfied === true` | FOUND | NOT_VERIFIED | `DOD_COMPLETE_DG` (args: completed, total) |
| DefinitionGuard shape, `isFullySatisfied === false` | MISSING (Done) or NOT_APPLICABLE (not Done) | | `DOD_OPEN_DG` |
| `definitionguard-dod` present with another shape | MISSING | | `DOD_SHAPE_UNKNOWN` |
| No `definitionguard-dod`; HeroCoders `checklist` has a numeric `uncheckedMandatoryItems` equal to 0 | FOUND | NOT_VERIFIED | `DOD_COMPLETE_HC` |
| HeroCoders `checklist` with `uncheckedMandatoryItems > 0` | MISSING (Done) or NOT_APPLICABLE | | `DOD_OPEN_HC` (args: open) |
| HeroCoders `checklist` whose `uncheckedMandatoryItems` is not a non-negative integer | as if absent | | `DOD_NONE` or `NOT_DONE` |
| No record, Done | MISSING | | `DOD_NONE` |
| No complete record, not Done | NOT_APPLICABLE | | `NOT_DONE` |
| A FOUND record carries `issuedAt` older than the issue's `updated` | NEEDS_RECHECK | | `CHANGED_SINCE_ATTESTATION` |

DefinitionGuard's shape: `isFullySatisfied` boolean, `completedCount` and `totalCount` non-negative integers with `completedCount <= totalCount`, `checklistHash` 64 hexadecimal characters. Rework loops are shown in this row as "Rework loops: N" and do not change the state.

### Code (heuristic)

The Development field is found by name (`Development`) through `/rest/api/3/field`. Its value is parsed for the pull request count and state.

| Condition | State | Verification | Reason |
|---|---|---|---|
| The current Code exception status is APPROVED and no pull request exists | EXCEPTED | | `CODE_EXCEPTED` |
| Pull request state MERGED | FOUND | HEURISTIC | `PR_MERGED` (args: count) |
| Pull request OPEN, issue Done | MISSING | | `PR_OPEN_AT_DONE` |
| Pull request OPEN, not Done | FOUND | HEURISTIC | `PR_OPEN` |
| Only DECLINED, or no pull request, issue Done | MISSING | | `PR_NONE` |
| No pull request, not Done | NOT_APPLICABLE | | `NOT_DONE` |
| The site has no Development field | NOT_APPLICABLE | | `NO_DEV_TOOL` |

An approved exception stops counting once a pull request exists. A waiting, rejected, withdrawn or revoked exception never counts. The text always says "Approval is not readable by apps."

### Code exception lifecycle (ADR-001, Option C)

A Code exception is a list of append-only events (`GateExceptionEvent`): REQUESTED, then APPROVED or REJECTED or WITHDRAWN; an APPROVED exception can be REVOKED. The current state is the last event.

| Decision | From | To | Who may make it |
|---|---|---|---|
| Request | none, REJECTED, WITHDRAWN, REVOKED | REQUESTED | any user with Edit issues; refused when a pull request exists |
| Approve | REQUESTED | APPROVED | a user with `ADMINISTER_PROJECTS` in the issue's project or the global `ADMINISTER` permission, who is not the requester and not the assignee |
| Reject | REQUESTED | REJECTED | as Approve; reason 15 to 500 characters |
| Revoke | APPROVED | REVOKED | as Approve; reason 15 to 500 characters |
| Withdraw | REQUESTED | WITHDRAWN | the requester only |

The administrator check is one call, `GET /rest/api/3/mypermissions?projectKey={key}&permissions=ADMINISTER_PROJECTS,ADMINISTER`, run as the acting user (scope `read:jira-work`); either permission is enough (owner decision 1B, 2026-11-01).

### Audit (seal)

| Condition | State | Verification | Reason |
|---|---|---|---|
| `ledgerseal-cert` has LedgerSeal's shape, `status === 'SEAL_VALID'`, `isCompromised !== true` | FOUND | NOT_VERIFIED | `SEAL_VALID_LS` (args: sealedAt) |
| LedgerSeal shape, status `SEAL_BROKEN` or `SEAL_COMPROMISED` | MISSING | | `SEAL_BROKEN_LS` |
| LedgerSeal shape, any other status | MISSING (Done) or NOT_APPLICABLE | | `SEAL_OTHER_LS` (args: status) |
| `ledgerseal-cert` present with another shape | MISSING | | `SEAL_SHAPE_UNKNOWN` |
| No record, Done | MISSING | | `SEAL_NONE` |
| No record, not Done | NOT_APPLICABLE | | `NOT_DONE` |
| A FOUND record carries `issuedAt` older than `updated` | NEEDS_RECHECK | | `CHANGED_SINCE_ATTESTATION` |

LedgerSeal's shape: `status` string, `certificateId` in UUID form, `snapshotHash` 64 hexadecimal characters, `sealedAt` an ISO date. The aliases `ledgersealCert`, `definitionguardDod`, `valid` and `satisfied` are never read.

### What the reader sees while sibling properties are not signed

Audit and Process show "Source: LedgerSeal property ledgerseal-cert" or "Source: DefinitionGuard property definitionguard-dod", and the words "not verified by FourRealities". They never show "verified". A shape that the producer does not write (for example the DEMO-26 values) gives MISSING with "record shape not written by LedgerSeal" (or DefinitionGuard). Remediation is a button that opens the issue with `router.open` and names the panel to use: "LedgerSeal Audit Gate" or "DefinitionGuard Checklist".

## Metrics

- **Gate score:** FOUND = 100, MISSING = 0. EXCEPTED, NEEDS_RECHECK and NOT_APPLICABLE are excluded.
- **RAI** = `Math.round(mean of included gate scores)`. With no included gate the issue is **UNRATED** and `rai` is `null`.
- **Risk:** RAI below 50 is CRITICAL, below 70 HIGH, below 85 MEDIUM, otherwise LOW. UNRATED issues have risk UNRATED.
- **Recoverable points:** for the first MISSING gate in the order Intent, Code, Process, Audit, recompute RAI with that gate FOUND and subtract the current RAI. 0 when no gate is MISSING.
- **M11 intent rate** = intent FOUND / (intent FOUND + intent MISSING) x 100, rounded. **M29 pull request rate (heuristic)**, **DoD rate** and **seal rate** use the same formula on their gates. The value is `null` when the denominator is 0, and the UI shows "n/a".
- **M30 rework rate** = started issues with at least one rework loop / started issues x 100, rounded; `null` when no issue is started. A rework loop is a status change from category `done` to `new` or `indeterminate`, or from `indeterminate` to `new`. The changelog item carries status ids (`from`, `to`); their categories come from `GET /rest/api/3/status` (scope `read:jira-work`), cached in `fr:cfg:site`. Status names are never read, and a status id missing from that list counts no rework (Decision D-7). A move between two statuses of the same category, for example "In Review" back to "In Progress" (both `indeterminate`), is not a rework loop: Jira gives no category that tells them apart.
- **averageRAI** = rounded mean RAI over rated issues; `null` when none is rated.
- Counts shown in the UI come from the gate counts, never from a rounded percentage.

## How RAI is shown (B-21, H5)

RAI is a secondary number, shown to users as "Alignment". The dashboard shows the four reality cards, each with its counts, before the alignment box, which names the rated and unrated issue counts. The issue panel shows the four gates first, then the RAI lozenge with its parts: "RAI 67% (HIGH): 2 of 3 rated gates have evidence found. 3 of 4 gates apply to this issue." No sprint name appears next to a project-wide score, and no view ranks people or teams by RAI (the triage table's Assignee column is not sortable; the Assignee filter selects one person).

## Dashboard and panel layout (B-33 to B-40)

Approved by the owner on 2026-11-01 from a UX consultation review (backlog "Added by the UX consultation review"). The words come from pure functions in `src/ui/pipeline.ts`; the components are in `src/frontend/`.

- **Pipeline (B-33).** Every surface shows the gates as one chain: Intent, Process, Code, Audit. Each chip shows a glyph, an ADS colour and a short state, for example "✕ Intent: missing", "● Code: found, heuristic", "○ Audit: n/a"; the chip text alone names the state. A tooltip adds the full state and the source. The chips sit in a clean chain with consistent spacing across all surfaces; text arrow glyphs are omitted to prevent vertical baseline misalignment and awkward line wrapping.
- **Table (B-34).** Columns: Issue, Summary, Gates (compact pipeline, widest column), Alignment, Top finding, Assignee, Action. Column widths (percent): 7, 18, 34, 9, 18, 8, 6.
- **Reality cards (B-35).** One bordered card per gate: gate name with the metric code in a tooltip (M11, DoD rate, M29, seal rate), the rate as a lozenge, one plain question, a progress bar with an `ariaLabel`, "n of m rated issues have evidence", and "Show n missing Gate" only when n is above 0. The Code question is "Was the work merged through a pull request?": apps cannot read review approvals (H11).
- **Drift sentence and next action (B-36).** From the first MISSING gate in chain order, for example "Code was merged, but it does not trace to a decision record." or "No Definition of Done record is on this issue.", and one next action, for example "Next: link the decision record." With nothing missing: "Every rated gate has evidence." or "No gate applies yet." Shown in the panel, the compact view, the Inspect modal and the table's Top finding column.
- **Alignment box (B-37, B-39).** After the cards (H5): "Alignment n%" with rated and unrated counts, the change against the previous weekly point (only when both weeks rate at least 10 issues, else "Not enough data for a trend yet."), the weakest rated gate with its counts, the risk buttons, and one sentence that defines Alignment. In the issue panel, "Why n%?" lists what each gate adds and what fixing the first missing gate recovers.
- **Compact issue-context view (B-38).** The `fourrealities-issue-context` module shows the pipeline, "Alignment n%" with its risk level, the next action and "See all findings"; the full panel has "Hide findings".
- **Inspect (B-40).** Shows the pipeline, the drift sentence and the gate rows, with "Previous issue" and "Next issue" through the visible rows, "Close" and "Open issue". No remediation action.
- **Retrospective review (B-42).** In the issue panel, when Code is FOUND with reason PR_MERGED, the panel offers "Request retrospective review". Opens a dialog with a comment text field (15 to 1,000 characters) and posts a Jira comment as the user without claiming a review occurred.
- **Not built from the consultation, with the reason:** review-approval wording for Code (H11); a seal action in FourRealities, DoD checkboxes and "tamper-evident" wording (hard rules, T-05); title-overlap decision suggestions (FR-13); Custom UI (needs new dependencies). Trend by sprint is not built: weekly points are stored, and a sprint trend needs a new storage shape.

## In-Jira UI Standard and Layout Redesign (B-43 to B-46)

Approved by the owner on 2026-11-01 (`docs/design/asymm-jira-ui-standard.md`). The implementation standardises UX patterns across all Asymm Systems Jira apps (FourRealities, LedgerSeal, DefinitionGuard).

- **Brand tokens and layout primitives (B-43):** Brand palette roles map to native Atlassian tokens in `src/brand/brand.ts`. Layout components in `src/brand/layout.tsx` enforce consistent spacing, borders, and typography. Zero raw token strings or hex colour codes are permitted in `src/` outside `src/brand/`.
- **Strict one-border rule:** Nested bordered boxes are forbidden in UI Kit panels to avoid visual clutter. Panels use an outer bordered `Card` or `Section`. Nested details use `SubSection` with left indentation (`space.200`) and no border.
- **Pure UI logic (B-44):** `auditReadiness` determines overall posture and next step. `issueGapsText` formats gap summaries. `priorityActions` ranks top action items respecting active filters.
- **Issue panel anatomy (B-45):** Wrapped in `AppSurface`. Starts with `PanelHeader` carrying the module title and a subtle Refresh button. A `SummaryBlock` presents the gate pipeline chips, drift sentence, next action, and single primary action. Gate findings are contained in a collapsible `<Section title="Gate findings" count={4} defaultCollapsed={true}>`. Exception notes and rework logs render in a subtle `NoteBox`. Secondary actions sit at the bottom in an `ActionRow`.
- **Project dashboard redesign (B-46):** Top Status Banner presents audit readiness status, summary sentence, and next step. Reality cards sit beside a Priority Actions tile that respects active filters. Snapshot button is labelled "Refresh". A quiet footnote states: "Alignment is calculated across rated gates only."

## Accessibility rules (B-20)

Checked on every rendered view by `test/frontend/accessibility.test.tsx`: every `Inline` wraps (`shouldWrap`); every `Textfield` and `Select` has a `Label` whose `labelFor` is its `id`; every `Lozenge` sets `maxWidth="100%"`, so its text is not cut at the 200 px default; every gate glyph sits next to its text name; every button has text; every modal closes with `onClose` (Escape); no UI text or UI source file contains the em dash, box-drawing arrows or the middle dot. UI Kit gives no role or `aria-live` prop on `SectionMessage`, so whether the result message is announced is checked only in the live run.

## Project dashboard trend (B-19)

The trend panel shows the last four weekly trend points, oldest first, labelled "whole project" (D-4: the trend is not filtered per viewer). It shows a text line per week first, then a UI Kit `LineChart` of the same numbers (`src/ui/trend.ts`). Each rate keeps its parts: "Week of 2026-10-26: RAI 64% (30 rated issues); Intent 12 of 40 rated (30%); ...". A gate with no rated issue in a week reads "n/a (0 rated)" and has no chart point. With fewer than two points the panel says "Trend starts after two weekly snapshots. Next snapshot: <Monday after this week>." and draws no chart.

## Project dashboard filters (B-18)

The filter bar sits above the triage table, in this tab order: Search (key or summary), Assignee, Sprint, Gate. Each is a labelled control. Filtering runs on the visible snapshot rows in the browser (`src/ui/filters.ts`); it makes no Jira call.

| Filter | Values | Rule |
|---|---|---|
| Assignee | assignee names in name order, then "Unassigned" when a row has no assignee | exact name |
| Sprint | sprint names on the rows, in name order | the row is in that sprint; the control is hidden when no row has a sprint |
| Gate | "Intent missing", "Process missing", "Code missing", "Audit missing" | that gate is MISSING; the cards' "Show n missing Gate" buttons set the same filter |
| Risk (B-39) | Critical, High, Medium, Low buttons in the alignment box, with counts | the row's risk is one of the chosen levels; each button adds or removes its level |
| My issues (B-40) | the viewer's account id | the row's assignee account id; offered only when the viewer is known |

Preset views (B-40) set several filters at once and keep the search text: "My issues", "Critical and high", "Audit prep" (Audit missing), "Needs a decision link" (Intent missing). Filters combine with AND. Each active filter has its own "Remove filter: ..." button; "Clear all filters" appears when two or more are active and keeps the search text. The count reads "Showing n of m issues".

## Manifest

- Modules: `jira:projectPage`, `jira:issuePanel`, `jira:issueContext` (UI Kit, `render: native`); the issue panel and context glance modules are both titled "Four Realities" in the manifest; one resolver function, and a `scheduledTrigger` with `interval: day` that calls the `snapshot` function. The snapshot function sets `timeoutSeconds: 600`.
- `app.licensing.enabled: true`. Each resolver returns `LICENSE_INACTIVE` when `context.license.isActive === false`, before any Jira or storage call; the write resolvers return `{ success: false, error }` with the same text. An undefined licence (development installs) is allowed. The UI shows a warning `SectionMessage` titled "Licence not active" with the message "The FourRealities licence for this site is not active. A site administrator can renew it in Manage apps." The daily scheduled trigger has no resolver context; it reads the licence from the Forge app context (`getAppContext().license`) and skips the whole run when `isActive === false`, logging "FourRealities: scheduled snapshot skipped: the licence is not active."
- Scopes: `read:jira-work`, `write:jira-work`, `storage:app`. `write:jira-work` is needed for the user's remote link (`linkDecision`) and for the `fourrealities-exception` property (`recordException`).
- Runtime `nodejs22.x`. No external egress.

## Storage Schema

| Key | Value | Largest size |
|---|---|---|
| `fr:p:{projectKey}:meta` | `SnapshotMeta` | under 1 KiB |
| `fr:p:{projectKey}:chunk:{i}` | `IssueRow[]`, at most 100 rows | measured in the harness; budget 100 KiB |
| `fr:p:{projectKey}:trend` | `TrendPoint[]`, at most 52 | under 52 KiB |
| `fr:p:{projectKey}:summary` | `ProjectSummary` for the whole project | under 2 KiB |
| `fr:projects` | registered project keys, at most 500 | under 8 KiB |
| `fr:note:{issueId}:{recordedAt}:{seq}` | one `ReworkNote`, written once; a rework note never changes a gate | under 2 KiB each (reason 500 chars, notes 1,000 chars) |
| `fr:issue:{issueId}:exception` | `ExceptionRecord` (v1 or v2), read for migration only | removed by the scheduled run |
| `fr:ex:{issueId}:code:{at}:{seq}` | one `GateExceptionEvent`, written once | under 2 KiB each |
| `fr:cfg:site` | `{ devFieldId: string or null, siteHost: string or null, statusCategories: { [statusId]: category }, readAt }`; a cache without `statusCategories` is read again | under 16 KiB (about 30 bytes per status) |

The snapshot is rebuilt by writing new chunks, then the meta. A reader that finds a chunk missing treats the snapshot as absent and rebuilds.

**Migration (B-03, B-08):** the v1 keys `fr:project:{key}:latest`, `fr:project:{key}:history` and `fr:issue:{id}:signals` are never read. The project keys are deleted on the first v2 build for that project. The `:signals` keys are deleted by the scheduled run, at most 100 per run. A v1 exception record (`{type, reason, ...}`) is read as `code` or `rework`. A v2 `code` note with no events reads as a REQUESTED and an APPROVED event by the note's author, marked migrated ("Approved before administrator approval was required"); the scheduled run writes those events and removes the `code` note, at most 100 per run. A v2 `rework` note with no notes reads as one note marked migrated; the scheduled run writes it under `fr:note:` and removes the `rework` note, at most 100 per run. A v2 record with no note left is deleted.

## Resolver contracts

All resolvers return `{ ok: true, ... }` or `{ ok: false, error: { code, message, status? } }`. Codes: `INVALID_INPUT`, `FORBIDDEN`, `NOT_FOUND`, `JIRA_ERROR`, `RATE_LIMITED`, `LICENSE_INACTIVE`.

| Resolver | Input | Rules | Output |
|---|---|---|---|
| `getProjectDashboard` | none | Project key from context only. Reads the stored snapshot; builds it when absent. Filters rows to issues the viewer can browse (one `fields=id` search as the user, paged). Summary recomputed for the visible rows. | `{ meta, summary, rows, trend, warning? }` |
| `refreshProjectSnapshot` | none | As above, but always rebuilds within an 18 s budget. | same |
| `getIssueAlignment` | none | Issue from context only. Reads the issue (fields, properties, changelog) and its remote links as the user. At most 3 Jira calls (the field list is cached in `fr:cfg:site`). | `{ row }` |
| `linkDecision` | `issueId`, `url`, `title`, `summary?` | `url` is http or https; `title` 3 to 255 characters after trim. Project-key check (below). POST as the user. Re-reads the issue. | `{ success, remoteLink, row? }` |
| `recordException` | `issueId`, `type` (`CODE` or `REWORK`), `reason`, `notes?` | Reason 15 to 500 characters after trim. Project-key check. `CODE` requests an exception and is rejected when a pull request exists or one is waiting or approved. `REWORK` appends a note and never replaces an earlier one. PUT `fourrealities-exception` (current Code state, latest rework note, `reworkNoteCount`) as the user; the event or note is stored only after a 2xx. | `{ success, record, row? }` |
| `decideException` | `issueId`, `decision` (`APPROVE`, `REJECT`, `REVOKE`, `WITHDRAW`), `reason` | Signed-in user required. Reads the issue's project and assignee as the user, checks scope, checks `ADMINISTER_PROJECTS` or `ADMINISTER` as the user (not for Withdraw), applies the lifecycle table. Property first, then the event. | `{ success, record, row? }` |
| `requestReview` | `issueId`, `comment` | Comment 15 to 1,000 characters after trim. Project-key check. POST ADF comment to `/rest/api/3/issue/{issueId}/comment` as the user. Re-reads the issue. Does not change any gate. | `{ success, row? }` |

**Feedback after a write (B-17, FR-20):** after a successful `linkDecision`, `recordException`, `decideException` or `requestReview` from an issue view, the resolver reads the issue again as the user (as `getIssueAlignment`) and returns its `row`. The panel replaces its row in place and stays mounted, and its message names the gate state from that row ("Link added. Intent: Evidence found."). When the read fails, or the call came from the project page, there is no `row`, and the message says "The gates could not be read again. Use Refresh." It never claims a state.

**Project-key check:** in issue context the payload `issueId` must equal the context issue id. In project context the resolver reads the issue as the user and rejects the call unless its project key equals the context project key. A 403 or 404 from Jira is returned as `FORBIDDEN` or `NOT_FOUND`.

**Jira calls:** search uses `/rest/api/3/search/jql` with `nextPageToken` until `isLast`, at most 2,000 issues. When capped, `/rest/api/3/search/approximate-count` gives `totalKnown`. A 429 is retried at most 3 times, waiting `Retry-After` seconds (at most 5 s each) inside the time budget; then `RATE_LIMITED`.

## Snapshot schedule

- The `scheduledTrigger` runs daily. For each registered project it builds a snapshot as the app, within a 540 s budget across projects, and records the trend point for the current ISO week (a later build in the same week replaces it).
- A project is registered the first time its dashboard is opened.
- A page view never writes history. The UI shows the snapshot time, and "Refresh now" rebuilds it.
- Remote links are read for started issues, 8 at a time, while the time budget lasts. Issues not reached keep their Intent result from the previous snapshot when it exists, else they are NEEDS_RECHECK. `meta.remoteLinksRead` records the count.

## Validator

The gate evaluation pipeline, for one issue:

1. Parse the Jira issue: status category, changelog status changes, issue links, remote links (when read), properties, Development field value.
2. Evaluate the four gates by the tables above.
3. Compute RAI, risk and recoverable points.
4. For a project: count gate states, compute the rates with their denominators, and compute the risk distribution, including UNRATED.

## Decisions

| ID | Decision | Options considered | Reason |
|---|---|---|---|
| D-1 | Process gate = Definition of Done; rework loops shown beside it, not scored | Keep rework as the Process score; split into five gates | The audit blueprint (section 5.3) maps Process to DefinitionGuard. Rework alone is already sold by Timepiece (research H4). |
| D-2 | Intent counts Confluence pages on this site and decision-type issues, never title keywords | Keyword list (v1); any remote link | FR-13: keywords are gameable. A plain external URL cannot be checked. |
| D-3 | Code gate stays a heuristic from the Development field; no dev-status calls | Undocumented dev-status API; Teamwork Graph | No GA read API for approvals (research H11). dev-status is undocumented and fails from Forge. |
| D-4 | Snapshots are built as the app and filtered per viewer at read time | Build per viewer as the user | One shared snapshot keeps reads bounded; per-viewer filtering closes FR-18. Visible-row summaries avoid leaking counts. The trend is labelled project-wide. |
| D-5 | Store gate results as reason codes; the UI renders the text | Store full text | Keeps 100 rows per chunk well under the size budget. |
| D-6 | Delete v1 history keys on first v2 build | Keep and ignore | v1 history can exceed 240 KiB and is never read again. Owner approved [MIGRATE]. |
| D-7 | Rework detection uses status categories by status id only; names are never read (B-24) | Names only (v1); categories with a name fallback (first v2 text) | FR-25 and B-24 ask for `statusCategory.key`, not name substrings. Changelog items carry status ids. Cost: a move inside one category is not counted. |
| D-8 | Keep `write:jira-work` | Drop `linkDecision` and `recordException` to go read-only | Both are honest user actions. The listing states the scope exactly. |
| D-9 | "Not applicable: producer not installed" is not shown | Detect installed apps | No supported call tells one Forge app that another is installed. An absent record on a Done issue is MISSING with the text "No LedgerSeal record", and NOT_APPLICABLE before Done. |
| D-10 | Licence check blocks only `isActive === false` | Block when undefined | Development and free installs have no licence object. |

### Grader conflict

`loop-engine/graders/grade_spec.py` checks `docs/spec/fourrealities-spec.md` (v1, frozen), not this file. The agent definition `loop-engine/agents/spec_architect.md` also expects scopes limited to `read:jira-work` and `storage:app`. This app needs `write:jira-work` (D-8). The scope stays, and the conflict is recorded here and in the round log. The grader runs against a mirror that holds this v2 file under the v1 name.
