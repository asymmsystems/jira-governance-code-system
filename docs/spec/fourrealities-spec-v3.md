# FourRealities: Specification v3

- **Status:** working specification after the Marketplace readiness fixes (2026-11-06). `fourrealities-spec-v2.md` and `fourrealities-spec.md` (v1) are frozen. The changes from v2 come from ADR-012 (sibling records and signatures), ADR-013 (evidence sources in use, admin page, approver groups) and ADR-014 (personal data), and from the readiness review `docs/sdlc/suite-readiness-review-2026-11/fourrealities-readiness.md`.
- **Date:** 2026-11-06
- **Sources:** `docs/sdlc/fourrealities-usp-ux-research-2026-11/` (research brief, UX spec, backlog) and the portfolio audit of 2026-10-31, section 5.

## Executive Summary

FourRealities shows, for each Jira issue, whether four kinds of delivery evidence exist, and where each piece of evidence comes from:

1. **Intent:** the issue links to a Confluence page on this site, or to a decision or specification issue.
2. **Process:** a Definition of Done record says the checklist is complete. Rework loops from the status changelog are shown beside it.
3. **Code:** the Development field shows a pull request. FourRealities cannot read review approvals, so this gate is a heuristic.
4. **Audit:** a LedgerSeal record says the issue is sealed.

Every gate names its source and says whether FourRealities verified the fact (a link it read, a page Confluence returned, or a sibling record whose signature it checked), or used a heuristic. A record from another app that it cannot verify counts like no record. A check that the site does not use is not scored and says so. FourRealities never writes evidence that another app owns. It runs on Forge with no external egress.

## Invariants

1. **One writer per fact.** FourRealities writes only its own keys: KVS keys with the `fr:` prefix and the issue property `fourrealities-exception`. It writes a remote link only when a user asks, as that user. It never writes `ledgerseal-cert`, `definitionguard-dod` or `checklist`.
2. **No pre-filled evidence.** No form opens with a value that counts as evidence.
3. **An exception is not a pass.** An excepted gate has its own state and never counts as found.
4. **User actions run as the user.** A 403 for the user is returned to the user. There is no retry as the app. One exception: after an approver's decision has passed the approver check, FourRealities writes its own projection property `fourrealities-exception` as the app (ADR-013 decision 6).
5. **Feedback comes from re-evaluation.** Text after an action is built from the gate state read after the action.
6. **Bounded storage.** No KVS value grows with page views. A snapshot chunk holds at most 100 rows and 200,000 bytes.
10. **Minimal personal data.** Account ids only where a rule needs them, no names; reported weekly; erased for closed accounts (ADR-014).
7. **Viewer permissions.** Rows that a viewer cannot browse in Jira are never returned to that viewer.
8. **Zero external egress.** The manifest declares no external fetch.
9. **Deterministic metrics.** The same input gives the same output.

## Domain Model

```typescript
type GateName = 'intent' | 'process' | 'code' | 'audit';

type GateState =
  | 'FOUND'           // evidence found
  | 'MISSING'         // the gate applies and the evidence is absent
  | 'REPORTED'        // rows stored before the ADR-012 amendment only; no longer produced
  | 'EXCEPTED'        // a recorded exception (Code only), with who, when and why
  | 'NEEDS_RECHECK'   // the evidence may be stale or was not read yet
  | 'NOT_APPLICABLE'; // the gate does not apply yet, no data source exists, or the check is not in use (SOURCE_NOT_IN_USE)

type Verification = 'VERIFIED' | 'NOT_VERIFIED' | 'HEURISTIC' | 'LINK_ONLY';

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
  updated?: string;                // ISO timestamp from Jira fields.updated
  statusCategory: 'new' | 'indeterminate' | 'done';
  assigneeAccountId?: string;     // no name is stored (ADR-014)
  sprintNames: string[];           // at most 5 in a stored row, 60 characters each
  gates: Record<GateName, GateResult>;
  reworkLoops: number;
  rai: number | null;              // null when UNRATED
  risk: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL' | 'UNRATED';
  applicableGates: number;         // gates in FOUND or MISSING
  recoverablePoints: number;
  codeException?: GateExceptionState; // panel only; never stored in a snapshot
  reworkNote?: ExceptionNote;      // panel only
  reworkNoteCount?: number;        // panel only
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

interface GateCount { found: number; missing: number; reported: number; excepted: number; recheck: number; notApplicable: number; }

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
  generatedBy: 'scheduled' | 'user'; // never an account id
  timedOut?: boolean;              // a page view's build stopped at its time budget
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
| `CONFLUENCE_PAGE_LINK` | Intent | VERIFIED when Confluence returns the page by id, else LINK_ONLY | the link URL |
| `DECISION_ISSUE_LINK` | Intent | VERIFIED | the linked issue key |
| `DEFINITIONGUARD_PROPERTY` | Process | VERIFIED (signature checked); an unverified record scores like no record | `headHash` (schema 2 and 3) or `checklistHash` (older shape) |
| `HEROCODERS_CHECKLIST_PROPERTY` | Process | never verified (cannot be signed): scores like no record | the property's `progressText` (B-25) |
| `DEVELOPMENT_FIELD` | Code | HEURISTIC | `pull requests: n` |
| `GATE_EXCEPTION` | Code | (EXCEPTED) | `approved <time>` |
| `LEDGERSEAL_PROPERTY` | Audit | VERIFIED (signature checked); an unverified record scores like no record | the certificate id, when the shape is LedgerSeal's |

A gate result is an observation: `method` names the source whose record it rests on, including a record that was read and did not count. A result with no source record (for example `INTENT_NONE`, `DOD_NONE`, `NOT_DONE`) has no `method`. Verification is taken from the catalog source.

### Intent

| Condition | State | Verification | Reason |
|---|---|---|---|
| The check is not in use on this site (ADR-013) | NOT_APPLICABLE | | `SOURCE_NOT_IN_USE` |
| A remote link points to a Confluence page on this site: `application.type` is `com.atlassian.confluence`, or the URL host equals the site host and the path starts with `/wiki/`; Confluence returned the page by its id (from the global id `pageId=N` or the URL `/pages/N`, CQL `id in (...)`, as the app for snapshots and as the user for the panel) | FOUND | VERIFIED | `INTENT_CONFLUENCE_LINK` (args: title) |
| The same, but the page could not be checked or was not returned | FOUND | LINK_ONLY | `INTENT_CONFLUENCE_LINK` |
| An issue link points to an issue whose type name, compared without case, is one of the decision issue types in the settings (default `adr`, `architecture decision`, `decision`, `decision record`, `spec`, `specification`, `requirement`) | FOUND | VERIFIED | `INTENT_DECISION_ISSUE` (args: key, type) |
| Started, remote links not read in this snapshot, and no qualifying issue link | NEEDS_RECHECK | | `INTENT_LINKS_NOT_READ` |
| Started, nothing qualifies | MISSING | | `INTENT_NONE` |
| Not started, nothing qualifies | NOT_APPLICABLE | | `NOT_STARTED` |

For a decision issue, "VERIFIED" means FourRealities read the link from Jira itself. For a Confluence page, it means Confluence returned the page; FourRealities does not read the page content, and the text says so. Title keywords never count. A link title has 3 to 255 characters.

### Process (Definition of Done)

The Process source is a setting (ADR-013): DefinitionGuard, Checklists for Jira, or not in use. "Detect" uses DefinitionGuard once a record with a verified signature was read on the site. Without settings (tests only) DefinitionGuard is read first, then the checklist.

| Condition | State | Verification | Reason |
|---|---|---|---|
| The check is not in use | NOT_APPLICABLE | | `SOURCE_NOT_IN_USE` |
| `definitionguard-dod` present with a shape DefinitionGuard does not write | MISSING | | `DOD_SHAPE_UNKNOWN` |
| Signature does not match, or the record was signed for another issue | MISSING | | `DOD_SIGNATURE_INVALID` (args: why) |
| Verified record, `isFullySatisfied === true` | FOUND | VERIFIED | `DOD_COMPLETE_DG` (args: completed, total) |
| Verified record, `isFullySatisfied === false` | MISSING (Done) or NOT_APPLICABLE | | `DOD_OPEN_DG` |
| Unsigned record, or signed with a key not trusted in this environment: scored like no record | MISSING (Done, verification NOT_VERIFIED) or NOT_APPLICABLE (`NOT_DONE`) | NOT_VERIFIED | `DOD_COMPLETE_DG` or `DOD_OPEN_DG` (args: why) |
| A verified record older than the newest verified record already seen on the issue (`fr:att:{issueId}`, by `stateVersion`, else `issuedAt`): a rollback | MISSING | | `DOD_SIGNATURE_INVALID` (why: older than a record already seen) |
| HeroCoders `checklist` with a numeric `uncheckedMandatoryItems` (cannot be signed): scored like no record | MISSING (Done) or NOT_APPLICABLE | NOT_VERIFIED | `DOD_COMPLETE_HC` or `DOD_OPEN_HC` |
| No record, Done | MISSING | | `DOD_NONE` (DefinitionGuard) or `CHECKLIST_NONE` (Checklists for Jira) |
| No complete record, not Done | NOT_APPLICABLE | | `NOT_DONE` |

DefinitionGuard's shapes: schema 3 and 2 (`mandatoryCompleted`, `mandatoryTotal`, `headHash`; schema 3 has no account id field) and the older shape (`completedCount`, `totalCount`, `checklistHash`). Counts are non-negative integers with completed at most total; the hash is 64 hexadecimal characters. Extra fields are allowed. Freshness is the producer's: the issue's `updated` time is not compared (the reason `CHANGED_SINCE_ATTESTATION` stays only for rows stored before v3). Rework loops are shown in this row as "Rework loops: N" and do not change the state.

### Signature check (ADR-012)

Both producers sign the canonical JSON (keys sorted at every level, no white space) of every field except `sig`, with Ed25519 and the key named by `keyId`. FourRealities checks it with public keys bundled in `src/accessor/attestation-keys.ts`, each trusted per Forge environment: `dg-dev-2026-11` and `ls-dev-2026-11` in development and staging only. Production trusts no key until the producers publish production keys. Results: verified, unsigned, unknown key, signed for another issue (`issueId` differs), bad signature. A signature shows who wrote a record, not that it is the latest: the rollback rule above covers an earlier signed record put back after a newer one.

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
| The check is not in use: "Detect" and no issue on the site has pull request data (JQL probe `development[pullrequests].all > 0`, cached 24 hours, or a pull request seen in a read), or an administrator turned it off | NOT_APPLICABLE | | `SOURCE_NOT_IN_USE` |

An approved exception stops counting once a pull request exists. A waiting, rejected, withdrawn or revoked exception never counts. The text always says "Approval is not readable by apps."

### Code exception lifecycle (ADR-001, Option C)

A Code exception is a list of append-only events (`GateExceptionEvent`): REQUESTED, then APPROVED or REJECTED or WITHDRAWN; an APPROVED exception can be REVOKED. The current state is the last event.

| Decision | From | To | Who may make it |
|---|---|---|---|
| Request | none, REJECTED, WITHDRAWN, REVOKED | REQUESTED | any user with Edit issues; refused when a pull request exists |
| Approve | REQUESTED | APPROVED | an approver: `ADMINISTER_PROJECTS` in the issue's project or the global `ADMINISTER` permission (Tier 1), or a member of an approver group set on the admin page (Tier 2, `GET /rest/api/3/myself?expand=groups` as the user); never the requester or the assignee |
| Reject | REQUESTED | REJECTED | as Approve; reason 15 to 500 characters |
| Revoke | APPROVED | REVOKED | as Approve; reason 15 to 500 characters |
| Withdraw | REQUESTED | WITHDRAWN | the requester only |

The Tier 1 check is one call, `GET /rest/api/3/mypermissions?projectKey={key}&permissions=ADMINISTER_PROJECTS,ADMINISTER`, run as the acting user; either permission is enough (owner decision 1B, 2026-11-01). Every check fails closed. The issue panel receives `approval` from the server and shows Approve, Reject and Revoke disabled with the standard note when the viewer may not decide; Withdraw shows only to the requester.

### Audit (seal)

| Condition | State | Verification | Reason |
|---|---|---|---|
| The check is not in use ("Detect" before a verified LedgerSeal record was read on the site, or turned off) | NOT_APPLICABLE | | `SOURCE_NOT_IN_USE` |
| `ledgerseal-cert` present with another shape | MISSING | | `SEAL_SHAPE_UNKNOWN` |
| Signature does not match, or signed for another issue | MISSING | | `SEAL_SIGNATURE_INVALID` (args: why) |
| Verified, `status === 'SEAL_VALID'` and `isCompromised !== true` | FOUND | VERIFIED | `SEAL_VALID_LS` (args: sealedAt) |
| Verified, `SEAL_BROKEN` or `SEAL_COMPROMISED` | MISSING | | `SEAL_BROKEN_LS` |
| Verified, any other status | MISSING (Done) or NOT_APPLICABLE | | `SEAL_OTHER_LS` (args: status) |
| Unsigned or untrusted key: scored like no record | MISSING (Done) or NOT_APPLICABLE (`NOT_DONE`) | NOT_VERIFIED | as above (args: why) |
| A verified record older than the newest verified one already seen (by `issuedAt`): a rollback | MISSING | | `SEAL_SIGNATURE_INVALID` (why: older than a record already seen) |
| No record, Done | MISSING | | `SEAL_NONE` |
| No record, not Done | NOT_APPLICABLE | | `NOT_DONE` |

LedgerSeal's shape: `status` string, `certificateId` in UUID form, `snapshotHash` 64 hexadecimal characters, `sealedAt` an ISO date; schema 3 has no account id field. LedgerSeal writes `SEAL_BROKEN` itself when sealed content changes, so the issue's `updated` time is not compared.

### Remediation text

The next step names the sibling panel only when its check is in use: "complete the items in the Definition of Done panel on this issue (DefinitionGuard)", "seal the issue in its Approval Seal panel (LedgerSeal)", or "add and complete the checklist in Checklists for Jira". There is no button that only reopens the issue.

## Metrics

- **Gate score:** FOUND = 100, MISSING = 0. REPORTED, EXCEPTED, NEEDS_RECHECK and NOT_APPLICABLE (including `SOURCE_NOT_IN_USE`) are excluded.
- **RAI** = `Math.round(mean of included gate scores)`. With no included gate the issue is **UNRATED** and `rai` is `null`.
- **Risk:** RAI below 50 is CRITICAL, below 70 HIGH, below 85 MEDIUM, otherwise LOW. UNRATED issues have risk UNRATED.
- **Recoverable points:** for the first MISSING gate in the chain order Intent, Process, Code, Audit (the same order as the next step), recompute RAI with that gate FOUND and subtract the current RAI. 0 when no gate is MISSING.
- **M11 intent rate** = intent FOUND / (intent FOUND + intent MISSING) x 100, rounded. **M29 pull request rate (heuristic)**, **DoD rate** and **seal rate** use the same formula on their gates. The value is `null` when the denominator is 0, and the UI shows "n/a".
- **M30 rework rate** = started issues with at least one rework loop / started issues x 100, rounded; `null` when no issue is started. A rework loop is a status change from category `done` to `new` or `indeterminate`, or from `indeterminate` to `new`. The changelog item carries status ids (`from`, `to`); their categories come from `GET /rest/api/3/status` (scope `read:jira-work`), cached in `fr:cfg:site`. Status names are never read, and a status id missing from that list counts no rework (Decision D-7). A move between two statuses of the same category, for example "In Review" back to "In Progress" (both `indeterminate`), is not a rework loop: Jira gives no category that tells them apart.
- **averageRAI** = rounded mean RAI over rated issues; `null` when none is rated.
- Counts shown in the UI come from the gate counts, never from a rounded percentage.

## How RAI is shown (B-21, H5)

RAI is a secondary number, shown to users as "Alignment". The dashboard shows the four reality cards, each with its counts, before the alignment box, which names the rated and unrated issue counts. The issue panel shows the four gates first, then the RAI lozenge with its parts: "RAI 67% (HIGH): 2 of 3 rated gates have evidence found. 3 of 4 gates apply to this issue." No sprint name appears next to a project-wide score, and no view ranks people or teams by RAI (the triage table's Assignee column is not sortable; the Assignee filter selects one person).

## Dashboard and panel layout (B-33 to B-40)

Approved by the owner on 2026-11-01 from a UX consultation review (backlog "Added by the UX consultation review"). The words come from pure functions in `src/ui/pipeline.ts`; the components are in `src/frontend/`.

- **Pipeline (B-33).** Every surface shows the gates as one chain: Intent, Process, Code, Audit. Each chip shows a glyph, an ADS colour and a short state, for example "✕ Intent: missing", "● Code: found, heuristic", "○ Audit: n/a"; the chip text alone names the state. A tooltip adds the full state and the source. The chips sit in a clean chain with consistent spacing across all surfaces; text arrow glyphs are omitted to prevent vertical baseline misalignment and awkward line wrapping.
- **Table (B-34, B-47).** Columns: Issue (key plus `updated` date), Summary, Gates (compact pipeline, widest column by default), Alignment (RAI lozenge plus `n / 4 evidenced`), Top finding (`n gaps: ...` plus drift sentence), Assignee, Action. Default balanced column widths (percent): 9, 19, 32, 11, 15, 7, 7. Because Forge native UI Kit `DynamicTable` has no drag-resize handles, the `TableCard` header includes a `Wide text columns` / `Balanced columns` toggle button that expands Summary and Top finding on demand (8, 28, 24, 10, 18, 6, 6).
- **Reality cards (B-35).** One bordered card per gate: gate name with the metric code in a tooltip (M11, DoD rate, M29, seal rate), the rate as a lozenge, one plain question, a progress bar with an `ariaLabel`, "n of m rated issues have evidence", and "Show n missing Gate" only when n is above 0. The Code question is "Was the work merged through a pull request?": apps cannot read review approvals (H11).
- **Drift sentence and next action (B-36).** From the first MISSING gate in chain order, for example "Code was merged, but it does not trace to a decision record." or "No Definition of Done record is on this issue.", and one next action, for example "Next: link the decision record." With nothing missing: "Every rated gate has evidence." or "No gate applies yet." Shown in the panel, the compact view, the Inspect modal and the table's Top finding column.
- **Coverage at a glance (B-37, B-39, B-47).** Shown beside `Priority actions` after the gate cards (H5): three borderless `StatTile` blocks (`Rated average` showing `Alignment n%` across rated and unrated counts, `Rated scope`, and `Weekly change`), a `NoteBox` naming the weakest rated gate with its counts, and selectable risk filter buttons (`Critical`, `High`, `Medium`, `Low`). In the issue panel, "Why n%?" lists what each gate adds and what fixing the first missing gate recovers.
- **Compact issue-context view (B-38).** The `fourrealities-issue-context` module shows the pipeline, "Alignment n%" with its risk level, the next action and "See all findings"; the full panel has "Hide findings".
- **Inspect (B-40, B-48).** Shows the pipeline, gaps summary, step position (`Issue k of n`), drift sentence and gate rows inside `ModalContent`, with "Previous issue" and "Next issue" through the visible rows, "Close" and "Open issue". No remediation action.
- **Retrospective review (B-42).** In the issue panel, when Code is FOUND with reason PR_MERGED, the panel offers "Request retrospective review". Opens a dialog with a comment text field (15 to 1,000 characters) and posts a Jira comment as the user without claiming a review occurred.
- **Not built from the consultation, with the reason:** review-approval wording for Code (H11); a seal action in FourRealities, DoD checkboxes and "tamper-evident" wording (hard rules, T-05); title-overlap decision suggestions (FR-13); Custom UI (needs new dependencies). Trend by sprint is not built: weekly points are stored, and a sprint trend needs a new storage shape.

## In-Jira UI Standard and Layout Redesign (B-43 to B-48)

Approved by the owner on 2026-11-01 (`docs/design/asymm-jira-ui-standard.md`) and refined on 2026-11-02. The implementation standardises UX patterns across all Asymm Systems Jira apps (FourRealities, LedgerSeal, DefinitionGuard) inside the standalone-ready `src/brand/` UI library (`brand.ts`, `layout.tsx`, `README.md`).

- **Brand tokens and layout primitives (B-43, B-47, B-48):** Brand palette roles, `SPACE`, and `TEXT_ROLE` map to native Atlassian tokens in `src/brand/brand.ts`. Layout components in `src/brand/layout.tsx` (`AppSurface`, `PageHeader`, `PanelHeader`, `KeyValueInline`, `StatusBanner`, `CardHeader`, `FourColumnGrid`, `TwoColumnGrid`, `ThreeColumnGrid`, `GateCard`, `SummaryBlock`, `Card`, `StatTile`, `ListRow`, `TableCard`, `Section`, `SubSection`, `NoteBox`, `ModalContent`, `FormField`, `LabeledInline`, `AttributionLine`, `ActionRow`, `StatusLozenge`) enforce consistent spacing, borders, and typography with zero FourRealities imports. Zero raw token strings (`color.*`, `elevation.*`, `space.*`, `radius.*`), raw hex codes, or raw HTML tags are permitted in `src/` outside `src/brand/`.
- **Inline typography and baseline alignment (B-48):** Because Jira Cloud's `@atlaskit/css-reset` adds `margin-top: 12px` to non-first `<p>` and `<h1..h6>` elements, every `<Text>` inside `<Inline>` or `<Stack>` renders `as="span"`, `KeyValueInline` locks bold labels and values to `alignBlock="baseline"`, and `StatTile` wraps its metric `value` in `<Box>` so semantic `<h3>` values carry zero extra top margin.
- **Strict one-border rule:** Nested bordered boxes are forbidden in UI Kit views to avoid visual clutter. Cards use a single outer border (`Card`, `SummaryBlock`, `Section`, `TableCard`, `GateCard`). Nested KPI tiles (`StatTile`), metadata blocks (`NoteBox`), and indented full-width rows (`SubSection`) are borderless.
- **Pure UI logic (B-44, B-47, B-48):** `auditReadiness` and `issueReadiness` determine overall posture (`Incomplete`, `Complete`, `Unrated`), semantic `Lozenge` appearance, summary sentence, and next step. `evidencedRatioText` and `issueGapsText` format gate evidence counts and gap summaries. `priorityActions` ranks top action items respecting active filters. `isPresetActive` and `togglePreset` detect active preset views and toggle them off on a second click while preserving free-text search.
- **Issue panel anatomy (B-45, B-47, B-48):** Wrapped in `AppSurface`. Starts with `PanelHeader` carrying the unified "Four Realities" title, semantic readiness `Lozenge`, and bordered `Refresh` button. `SummaryBlock` presents the gate pipeline chips, proximity-grouped drift/next/recovery lines, and at most one `primary` action. Gate findings sit in a collapsible `<Section title="Gate findings" count={4} defaultCollapsed={true}>` with `ListRow` hairline dividers and `AttributionLine` user records. Exception decisions and rework reason actions live contextually inside their respective full-width gate `NoteBox` containers so every `ActionRow` holds at most three buttons. All modals wrap body content in `ModalContent` and `FormField` and disable both submit and `Cancel` buttons while a write is in flight to prevent duplicate submissions.
- **Project dashboard redesign (B-46, B-47, B-48):** `PageHeader` displays "Four Realities", project scope lozenge, quiet read timestamp, and bordered `Refresh` button. `StatusBanner` uses an elevated card with a semantic left accent stripe, bold status `Lozenge` (never a numeric `Badge`), summary sentence, and a full-width borderless `Next step:` callout strip rendered via baseline-locked `KeyValueInline`. `FourColumnGrid` (gate cards) and `TwoColumnGrid` (`Priority actions` and `Coverage at a glance`) share the exact `space.200` (16px) gutter and stretch to equal height. `TableCard` unifies the filter/preset toolbar and `DynamicTable` into a single card separated by a hairline border. Ends with `TrendPanel` and the quiet footnote: "Alignment is calculated across rated gates only."

## Accessibility rules (B-20, B-43, B-47, B-48)

Checked on every rendered view by `test/frontend/accessibility.test.tsx`: every `Inline` wraps (`shouldWrap`); every `Text` inside `Inline` or `Stack` renders `as="span"` (or `"strong"`) so host `<p>` margins never distort baselines or stack gaps; every `Textfield` and `Select` has a `Label` whose `labelFor` is its `id`; every `Lozenge` sets `maxWidth="100%"`, so its text is not cut at the 200 px default; every `Stack` with a direct `Lozenge` child sets `alignInline="start"`; every button has text; at most one `primary` button appears per panel or modal; no bordered `Box` nests inside another bordered `Box`; every `ActionRow` holds at most three buttons; detail sections start collapsed by default; every modal closes with `onClose` (Escape); no UI text or UI source file contains the em dash, box-drawing arrows or the middle dot. UI Kit gives no role or `aria-live` prop on `SectionMessage`, so whether the result message is announced is checked only in the live run.

## Project dashboard trend (B-19)

The trend panel shows the last four weekly trend points, oldest first, labelled "whole project" (D-4: the trend is not filtered per viewer). It shows a text line per week first, then a UI Kit `LineChart` of the same numbers (`src/ui/trend.ts`). Each rate keeps its parts: "Week of 2026-10-26: RAI 64% (30 rated issues); Intent 12 of 40 rated (30%); ...". A gate with no rated issue in a week reads "n/a (0 rated)" and has no chart point. With fewer than two points the panel says "Trend starts after two weekly snapshots. Next snapshot: <Monday after this week>." and draws no chart.

## Project dashboard filters (B-18, B-40, B-48)

The filter bar sits inside the top toolbar of `TableCard`, directly above the triage table, in this tab order: Search (key or summary), Assignee, Sprint, Gate. Each is a labelled control inside `FormField`. Filtering runs on the visible snapshot rows in the browser (`src/ui/filters.ts`); it makes no Jira call.

| Filter | Values | Rule |
|---|---|---|
| Assignee | assignee names in name order, then "Unassigned" when a row has no assignee | exact name |
| Sprint | sprint names on the rows, in name order | the row is in that sprint; the control is hidden when no row has a sprint |
| Gate | "Intent missing", "Process missing", "Code missing", "Audit missing" | that gate is MISSING; the cards' "Show n missing Gate" buttons set the same filter |
| Risk (B-39) | Critical, High, Medium, Low buttons in Coverage at a glance, with counts | the row's risk is one of the chosen levels; each button adds or removes its level |
| My issues (B-40) | the viewer's account id | the row's assignee account id; offered only when the viewer is known |

Preset views (B-40, B-48) set several filters at once, reflect `isSelected` when active, toggle off when clicked a second time, and keep the search text: "My issues", "Critical and high", "Audit prep" (Audit missing), "Needs a decision link" (Intent missing). Filters combine with AND. Each active filter has its own "Remove filter: ..." button; "Clear all filters" appears when two or more are active and keeps the search text. The count reads "Showing n of m issues".

## Manifest

- Modules: `jira:projectPage`, `jira:issuePanel`, `jira:issueContext` (UI Kit, `render: native`), all titled "Four Realities"; `jira:adminPage` `fourrealities-admin` titled "FourRealities gate authority" (resource `admin`, function `admin-resolver`); `scheduledTrigger` `fourrealities-daily-snapshot` (`interval: day`, function `snapshot`, 600 s) and `fourrealities-personal-data` (`interval: week`, function `personal-data`, 600 s).
- `app.licensing.enabled: true`. Every resolver, including the admin resolvers, returns `LICENSE_INACTIVE` when `context.license.isActive === false`, before any Jira or storage call. The daily trigger reads the licence from the app context and skips the run when it is inactive. The weekly personal data run runs whatever the licence state.
- Scopes: `read:jira-work`, `write:jira-work`, `storage:app`, `search:confluence`, `read:confluence-content.summary`, `read:jira-user`, `report:personal-data`.
- Runtime `nodejs22.x`. No external egress.

## Storage Schema

| Key | Value | Largest size |
|---|---|---|
| `fr:p:{projectKey}:meta` | `SnapshotMeta` | under 1 KiB |
| `fr:p:{projectKey}:chunk:{i}` | `IssueRow[]` as stored (no exception, no note, no name), at most 100 rows and 200,000 bytes | 200,000 bytes |
| `fr:p:{projectKey}:trend` | `TrendPoint[]`, at most 52 | under 52 KiB |
| `fr:p:{projectKey}:summary` | `ProjectSummary` for the whole project | under 2 KiB |
| `fr:projects` | registered project keys, at most 500 | under 8 KiB |
| `fr:note:{issueId}:{recordedAt}:{seq}` | one `ReworkNote`, written once; a rework note never changes a gate | under 2 KiB each (reason 500 chars, notes 1,000 chars) |
| `fr:issue:{issueId}:exception` | `ExceptionRecord` (v1 or v2), read for migration only | removed by the scheduled run |
| `fr:ex:{issueId}:code:{at}:{seq}` | one `GateExceptionEvent`, written once | under 2 KiB each |
| `fr:cfg:site` | `{ devFieldId, siteHost, statusCategories, pullRequestsSeen, readAt }`; a cache without `statusCategories` or `pullRequestsSeen` is read again | under 16 KiB |
| `fr:cfg:sources` | admin settings: the mode of each check and the decision issue types; no account id | under 2 KiB |
| `fr:cfg:approver_policy` | `{ roleTypeId: 'FR_APPROVER', parties: [{ partyId, partyTypeId: 'GROUP', name }], fromDate }`, at most 20 groups | under 4 KiB |
| `fr:cfg:detected` | the date each source was first seen (and verified) on the site | under 1 KiB |
| `fr:att:{issueId}` | the newest verified DefinitionGuard (`stateVersion`, `issuedAt`) and LedgerSeal (`issuedAt`) record seen on the issue, against rollbacks | under 1 KiB |
| `fr:p:{projectKey}:accounts` | `{ generatedAt, accountIds }`: the distinct assignee ids of the snapshot, for the personal data report | under 64 KiB |

The snapshot is rebuilt by writing new chunks, then the meta. A reader that finds a chunk missing treats the snapshot as absent and rebuilds.

**Migration (B-03, B-08):** the v1 keys `fr:project:{key}:latest`, `fr:project:{key}:history` and `fr:issue:{id}:signals` are never read. The project keys are deleted on the first v2 build for that project. The `:signals` keys are deleted by the scheduled run, at most 100 per run. A v1 exception record (`{type, reason, ...}`) is read as `code` or `rework`. A v2 `code` note with no events reads as a REQUESTED and an APPROVED event by the note's author, marked migrated ("Approved before administrator approval was required"); the scheduled run writes those events and removes the `code` note, at most 100 per run. A v2 `rework` note with no notes reads as one note marked migrated; the scheduled run writes it under `fr:note:` and removes the `rework` note, at most 100 per run. A v2 record with no note left is deleted.

## Resolver contracts

All resolvers return `{ ok: true, ... }` or `{ ok: false, error: { code, message, status? } }`. Codes: `INVALID_INPUT`, `FORBIDDEN`, `NOT_FOUND`, `JIRA_ERROR`, `RATE_LIMITED`, `LICENSE_INACTIVE`.

| Resolver | Input | Rules | Output |
|---|---|---|---|
| `getProjectDashboard` | none | Project key from context only. Reads the stored snapshot; builds it when absent. Filters rows to issues the viewer can browse (one `fields=id` search as the user, paged). Summary recomputed for the visible rows. | `{ meta, summary, rows, trend, warning? }` |
| `refreshProjectSnapshot` | none | As above, but always rebuilds. One deadline for the whole call, 20 s from its start: the build stops 7 s before it, the viewer check 1 s before it and stops once every snapshot id is seen. | same |
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
| D-9 | Replaced by ADR-013: a check whose source is not in use on the site is "Not used on this site" and not scored; "Detect" turns Process and Audit on after a verified sibling record is read on the site, and Code after pull request data is found | Detect installed apps; every check always in use | No supported call tells one Forge app that another is installed; per-site detection of signed records needs none. |
| D-10 | Licence check blocks only `isActive === false` | Block when undefined | Development and free installs have no licence object. |

### Grader conflict

`loop-engine/graders/grade_spec.py` checks `docs/spec/fourrealities-spec.md` (v1, frozen), not this file. The agent definition `loop-engine/agents/spec_architect.md` also expects scopes limited to `read:jira-work` and `storage:app`. This app needs `write:jira-work` (D-8). The scope stays, and the conflict is recorded here and in the round log. The grader runs against a mirror that holds this v2 file under the v1 name.
