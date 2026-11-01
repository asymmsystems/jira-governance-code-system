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
  exception?: ExceptionNote;       // shown in the panel
  reworkNote?: ExceptionNote;
}

interface ExceptionNote { reason: string; notes?: string; recordedBy: string; recordedByName?: string; recordedAt: string; }

interface ExceptionRecord {        // KVS fr:issue:{id}:exception (v2): holds the rework note; a v2 code note is migrated to events
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
| Approve | REQUESTED | APPROVED | a user with `ADMINISTER_PROJECTS` in the issue's project, who is not the requester and not the assignee |
| Reject | REQUESTED | REJECTED | as Approve; reason 15 to 500 characters |
| Revoke | APPROVED | REVOKED | as Approve; reason 15 to 500 characters |
| Withdraw | REQUESTED | WITHDRAWN | the requester only |

The administrator check is `GET /rest/api/3/mypermissions?projectKey={key}&permissions=ADMINISTER_PROJECTS`, run as the acting user (scope `read:jira-work`).

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
- **M30 rework rate** = started issues with at least one rework loop / started issues x 100, rounded; `null` when no issue is started. A rework loop is a status change from a status in category `done`, or from a status whose name contains "review", "qa" or "test", to a status in category `new` or `indeterminate`. The changelog item carries status ids (`from`, `to`); categories come from `/rest/api/3/status` when available, else the names (Decision D-7).
- **averageRAI** = rounded mean RAI over rated issues; `null` when none is rated.
- Counts shown in the UI come from the gate counts, never from a rounded percentage.

## Manifest

- Modules: `jira:projectPage`, `jira:issuePanel`, `jira:issueContext` (UI Kit, `render: native`), one resolver function, and a `scheduledTrigger` with `interval: day` that calls the `snapshot` function. The snapshot function sets `timeoutSeconds: 600`.
- `app.licensing.enabled: true`. Each resolver returns `LICENSE_INACTIVE` when `context.license.isActive === false`. An undefined licence (development installs) is allowed.
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
| `fr:issue:{issueId}:exception` | `ExceptionRecord` (v2): the rework note | under 4 KiB (reason 500 chars, notes 1,000 chars) |
| `fr:ex:{issueId}:code:{at}:{seq}` | one `GateExceptionEvent`, written once | under 2 KiB each |
| `fr:cfg:site` | `{ devFieldId: string or null, siteHost: string, readAt }` | under 1 KiB |

The snapshot is rebuilt by writing new chunks, then the meta. A reader that finds a chunk missing treats the snapshot as absent and rebuilds.

**Migration (B-03, B-08):** the v1 keys `fr:project:{key}:latest`, `fr:project:{key}:history` and `fr:issue:{id}:signals` are never read. The project keys are deleted on the first v2 build for that project. The `:signals` keys are deleted by the scheduled run, at most 100 per run. A v1 exception record (`{type, reason, ...}`) is read as `code` or `rework`. A v2 `code` note with no events reads as a REQUESTED and an APPROVED event by the note's author, marked migrated ("Approved before administrator approval was required"); the scheduled run writes those events and removes the `code` note, at most 100 per run.

## Resolver contracts

All resolvers return `{ ok: true, ... }` or `{ ok: false, error: { code, message, status? } }`. Codes: `INVALID_INPUT`, `FORBIDDEN`, `NOT_FOUND`, `JIRA_ERROR`, `RATE_LIMITED`, `LICENSE_INACTIVE`.

| Resolver | Input | Rules | Output |
|---|---|---|---|
| `getProjectDashboard` | none | Project key from context only. Reads the stored snapshot; builds it when absent. Filters rows to issues the viewer can browse (one `fields=id` search as the user, paged). Summary recomputed for the visible rows. | `{ meta, summary, rows, trend, warning? }` |
| `refreshProjectSnapshot` | none | As above, but always rebuilds within an 18 s budget. | same |
| `getIssueAlignment` | none | Issue from context only. Reads the issue (fields, properties, changelog) and its remote links as the user. At most 3 Jira calls (the field list is cached in `fr:cfg:site`). | `{ row }` |
| `linkDecision` | `issueId`, `url`, `title`, `summary?` | `url` is http or https; `title` 3 to 255 characters after trim. Project-key check (below). POST as the user. Re-reads the issue. | `{ row, linked: true }` |
| `recordException` | `issueId`, `type` (`CODE` or `REWORK`), `reason`, `notes?` | Reason 15 to 500 characters after trim. Project-key check. `CODE` requests an exception and is rejected when a pull request exists or one is waiting or approved. PUT `fourrealities-exception` (current state projection) as the user; the event or note is stored only after a 2xx. | `{ success, record }` |
| `decideException` | `issueId`, `decision` (`APPROVE`, `REJECT`, `REVOKE`, `WITHDRAW`), `reason` | Signed-in user required. Reads the issue's project and assignee as the user, checks scope, checks `ADMINISTER_PROJECTS` as the user (not for Withdraw), applies the lifecycle table. Property first, then the event. | `{ success, record }` |

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
| D-7 | Rework detection uses status categories when the changelog gives ids, else names | Names only (v1) | FR-25 asks for category ids. Changelog items carry status ids. |
| D-8 | Keep `write:jira-work` | Drop `linkDecision` and `recordException` to go read-only | Both are honest user actions. The listing states the scope exactly. |
| D-9 | "Not applicable: producer not installed" is not shown | Detect installed apps | No supported call tells one Forge app that another is installed. An absent record on a Done issue is MISSING with the text "No LedgerSeal record", and NOT_APPLICABLE before Done. |
| D-10 | Licence check blocks only `isActive === false` | Block when undefined | Development and free installs have no licence object. |

### Grader conflict

`loop-engine/graders/grade_spec.py` checks `docs/spec/fourrealities-spec.md` (v1, frozen), not this file. The agent definition `loop-engine/agents/spec_architect.md` also expects scopes limited to `read:jira-work` and `storage:app`. This app needs `write:jira-work` (D-8). The scope stays, and the conflict is recorded here and in the round log. The grader runs against a mirror that holds this v2 file under the v1 name.
