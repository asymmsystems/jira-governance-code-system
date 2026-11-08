<!--
Copyright (c) 2026 Asymm Systems. All rights reserved.

@author Fahim Farook
-->
# FourRealities: Specification v4

- **Status:** working specification from 2026-11-08. `fourrealities-spec-v3.md`, the approved delta `fourrealities-spec-v4-draft.md`, `fourrealities-spec-v2.md` and `fourrealities-spec.md` (v1) are frozen. v4 is v3 with the delta of ADR-015 (evidence reports for change-management audits, Accepted 2026-11-08 with the owner decisions Q1 to Q9) merged in, and the changes that the spikes made necessary (section 11, "Evidence reports", 11.10).
- **Date:** 2026-11-08
- **Sources:** v3 and its sources; ADR-015 (`architecture/decision/adr-00015-fourrealities-evidence-reports.org`); its high-level design (`architecture/model/fourrealities-evidence-report-hld.org`, "HLD n" below); the spike results (`docs/sdlc/fourrealities-evidence-reports-2026-11/spike-results.md`).

## Executive Summary

FourRealities shows, for each Jira issue, whether four kinds of delivery evidence exist, and where each piece of evidence comes from:

1. **Intent:** the issue links to a Confluence page on this site, or to a decision or specification issue.
2. **Process:** a Definition of Done record says the checklist is complete. Rework loops from the status changelog are shown beside it.
3. **Code:** the Development field shows a pull request. FourRealities cannot read review approvals, so this gate is a heuristic.
4. **Audit:** a LedgerSeal record says the issue is sealed.

Every gate names its source and says whether FourRealities verified the fact (a link it read, a page Confluence returned, or a sibling record whose signature it checked), or used a heuristic. A record from another app that it cannot verify counts like no record. A check that the site does not use is not scored and says so. FourRealities never writes evidence that another app owns. It runs on Forge with no external egress.

FourRealities also makes **evidence reports**. For one project and one date range, a report lists the issues in scope with their four checks, the DefinitionGuard and LedgerSeal records it verified, its own Code exception steps and rework notes, and who changed which field and when, from Jira's history. A report has a JSON file and a CSV file, and a manifest that FourRealities signs. Reports are kept in the app for download, on request or on a weekly or monthly schedule; nothing is sent out. FourRealities is not a Jira audit log: Jira's audit log and Atlassian Guard keep the administrative audit log.

## Invariants

1. **One writer per fact.** FourRealities writes only its own keys: KVS keys with the `fr:` prefix, the issue property `fourrealities-exception`, and its Object Store objects under `reports/` and `tmp/`. It writes a remote link only when a user asks, as that user. It never writes `ledgerseal-cert`, `definitionguard-dod` or `checklist`, and it never writes Jira history.
2. **No pre-filled evidence.** No form opens with a value that counts as evidence.
3. **An exception is not a pass.** An excepted gate has its own state and never counts as found.
4. **User actions run as the user.** A 403 for the user is returned to the user. There is no retry as the app. Two exceptions: after an approver's decision has passed the approver check, FourRealities writes its own projection property `fourrealities-exception` as the app (ADR-013 decision 6); and a report job reads, as the app, only the issue ids that a JQL search as the requesting user returned (on demand), or the project's issues (scheduled). Its files are downloaded only by a user who can browse every issue in them that still exists.
5. **Feedback comes from re-evaluation.** Text after an action is built from the gate state read after the action.
6. **Bounded storage.** No KVS value grows with page views. A snapshot chunk holds at most 100 rows and 200,000 bytes. A report holds at most 10,000 issues, 250,000 changes and 50 MB per file; a project keeps at most 200 reports; reports expire after the retention set by a Jira administrator (default 400 days, 90 days to 7 years).
10. **Minimal personal data.** Account ids only where a rule needs them, no names; reported weekly; erased for closed accounts (ADR-014). A report holds party tokens, never account ids or names. The token map is reported weekly; a closed account's entry becomes a closed mark, so signed files never change.
7. **Viewer permissions.** Rows that a viewer cannot browse in Jira are never returned to that viewer.
8. **Zero external egress.** The manifest declares no external fetch.
9. **Deterministic metrics.** The same input gives the same output.
11. **Complete or not stored; missing issues are signed and listed.** A report that cannot be finished (a cap, three failed reads, a lost part, no signing key in production) stores no file. When Jira cannot return an issue of the scope (deleted, moved to another project, or not readable), the report is still signed, and it names every such issue with its key and the reason: in `report.json` (`notReadable`, counted in the signed `counts.notReadable`), in the verifier output (a `WARN` line with the count and one line per issue), in the UI (a badge with the count on the row, and the download window naming every missing issue with its key and the reason, 50 per page with Previous and Next, each page returned only when the download is allowed; owner decision of 2026-11-08, "Name every one") and in the CSV (a `NOT_READ` row per issue). A report is never refused for this (owner decision of 2026-11-08, "Sign, list them"; D-19).
12. **Signed files never change.** Report files are written once. They are removed only by expiry or by a Jira administrator's delete, which leaves a tombstone. Object Store does not refuse a second write to a key (spike S-1), so FourRealities refuses to write a key that exists and checks the stored checksum after each write.

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

The evidence report types are in `apps/fourrealities/src/contract/data/reports.ts`: `ReportState` (`QUEUED`, `RUNNING`, `DONE`, `FAILED`, `EXPIRED`, `DELETED`), `ReportStep` (`FACTS`, `CHANGES`, `PARTS`, `ASSEMBLE`), `FieldClass` (`USER`, `FREE_TEXT`, `OTHER`), `ReportFilters` (at most 10 field ids and 10 party tokens), `ReportJob`, `ReportIndexEntry`, `ReportSchedule`, `ReportSettings`, `ReportTombstone`, and the file formats `ManifestHeader`, `ReportManifest`, `ReportData`, `ReportIssue` and `ReportChange` of HLD 3. Section 11 gives their rules.

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
| A verified record older than the newest verified record already seen on the issue (`fr:att:{issueId}`, by `issuedAt` when both carry one, else `stateVersion`): a rollback | MISSING | | `DOD_SIGNATURE_INVALID` (why: older than a record already seen) |
| HeroCoders `checklist` with a numeric `uncheckedMandatoryItems` (cannot be signed): scored like no record | MISSING (Done) or NOT_APPLICABLE | NOT_VERIFIED | `DOD_COMPLETE_HC` or `DOD_OPEN_HC` |
| No record, Done | MISSING | | `DOD_NONE` (DefinitionGuard) or `CHECKLIST_NONE` (Checklists for Jira) |
| No complete record, not Done | NOT_APPLICABLE | | `NOT_DONE` |

DefinitionGuard's shapes: schema 3 and 2 (`mandatoryCompleted`, `mandatoryTotal`, `headHash`; schema 3 has no account id field) and the older shape (`completedCount`, `totalCount`, `checklistHash`). Counts are non-negative integers with completed at most total; the hash is 64 hexadecimal characters. Extra fields are allowed. Freshness is the producer's: the issue's `updated` time is not compared (the reason `CHANGED_SINCE_ATTESTATION` stays only for rows stored before v3). Rework loops are shown in this row as "Rework loops: N" and do not change the state.

### Signature check (ADR-012)

Both producers sign the canonical JSON (keys sorted at every level, no white space) of every field except `sig`, with Ed25519 and the key named by `keyId`. FourRealities checks it with public keys bundled in `src/accessor/attestation-keys.ts`, each trusted per Forge environment: `dg-dev-2026-11` and `ls-dev-2026-11` in development and staging only; `dg-prod-2026-11` and `ls-prod-2026-11` (published 2026-11-06) in production only. Results: verified, unsigned, unknown key, signed for another issue (`issueId` differs), bad signature. A signature shows who wrote a record, not that it is the latest: the rollback rule above covers an earlier signed record put back after a newer one.

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
- Runtime `nodejs22.x`, `memoryMB: 1024` (the assembly of a 50 MB report; spike S-3 measured 540 MB at the peak). No external egress.
- Evidence reports (ADR-015): `consumer` `fourrealities-report-consumer` (queue `fourrealities-report-jobs`, function `report-worker`, 900 s); `scheduledTrigger` `fourrealities-report-daily` (`interval: day`, function `report-daily`, 600 s) and `fourrealities-report-tmp` (`interval: hour`, function `report-tmp`, 600 s); `objectStore` `fourrealities-reports` (`storageClass: standard`). A tab "Evidence reports" on the existing `jira:projectPage` and a section "Evidence reports" on the existing admin page. Encrypted variables `FOURREALITIES_SIGNING_KEY` (PKCS#8 DER, base64) and `FOURREALITIES_KEY_ID`. No new scope: spike S-1 showed that Object Store and the PUT to its pre-signed URL need none, and that the app stays eligible for Runs on Atlassian. Adding the `objectStore` module makes a major version: each site administrator accepts the update.
- Licence for the reports (owner decision Q9): `createEvidenceReport`, `saveReportSchedule` and `deleteReportSchedule` return `LICENSE_INACTIVE`; listing, download and early deletion stay available; the daily report run makes no scheduled report but still removes expired reports and temporary files.

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
| `fr:cfg:reports` | `ReportSettings`: retention and report groups; no account id | under 4 KiB |
| `fr:rp:{projectId}:rep:{createdAt}:{reportId}` | one `ReportIndexEntry` per report, at most 200 per project (review M-1; keyed by the project id: review N-2) | under 2 KiB each |
| `fr:rp:{projectId}:head` | `{ reportId, manifestSha256 }` of the newest DONE report | under 1 KiB |
| `fr:rp:{projectId}:schedules` | `ReportSchedule[]`, at most 5 | under 8 KiB |
| `fr:rj:{reportId}` | `ReportJob`; removed when the report fails, expires or is deleted | under 16 KiB |
| `fr:rj:{reportId}:ids:{i}` | the job's issue ids, at most 5,000 per value; after assembly the in-scope `{issueId}:{issueKey}` of the report, kept while the report is kept (download check, `missingSincePrevious`) | under 200 KiB |
| `fr:rj:{reportId}:tokens:{i}` | the party tokens of the report, at most 4,000 per value, for the people file | under 160 KiB |
| `fr:rt:{projectId}:{deletedAt}:{seq}` | `ReportTombstone`, written once | under 2 KiB |
| `fr:reports:project:{projectId}` | the project's current key, one value per project with reports or schedules (review R3-2); the key is updated when the tab is opened after a rename | under 1 KiB |
| `fr:rj:{reportId}:nr:{i}` | the issues of the report that are not in it, `{issueId}:{reason}:{issueKey}`, at most 5,000 per value, kept while the report is kept (review R3-1) | under 200 KiB |
| `fr:tmp:{createdAt}:{reportId}:{downloadId}` | the object keys of a temporary people file (Object Store cannot list) | under 1 KiB |
| `fr:partykey` | the site key of the party tokens, 32 random bytes, written once | under 1 KiB |
| `fr:party:{token}` | `{ accountId, updatedAt }` or `{ closed: true, closedAt }` | under 1 KiB |

Object Store: `reports/{projectId}/{reportId}/{manifest.json,report.json,report.csv}` (written once), `tmp/{reportId}/part-{i}.json` (one batch of report issues before assembly, removed after it) and `tmp/{reportId}/{downloadId}/people.{json,csv}` (removed after 24 hours).

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

**Evidence report resolvers** (project page resolver; project from the context only): `getEvidenceReports`, `createEvidenceReport`, `getEvidenceReport`, `generateReportDownloadUrls`, `saveReportSchedule`, `deleteReportSchedule`, `deleteEvidenceReport`; admin resolvers `fr-admin-reports-get` and `fr-admin-reports-save`. New error codes: `NO_SIGNING_KEY`, `NOT_REPORT_AUTHOR`, `NOT_ALL_VISIBLE`, `TOO_MANY_ISSUES`, `REPORT_TOO_LARGE`, `RANGE_INVALID`, `JOB_LIMIT`, `REPORT_LIMIT`, `REPORT_NOT_READY`. Every permission check is a direct `await api.asUser().requestJira(route\`/rest/api/3/mypermissions?...\`)` in the checking function's body, before any storage access or call as the app (FSRT form, `docs/security/fsrt-scan-2026-11-07.md` section 4.4). Section 11.6 gives the inputs, rules and outputs.

**Jira calls:** search uses `/rest/api/3/search/jql` with `nextPageToken` until `isLast`, at most 2,000 issues. When capped, `/rest/api/3/search/approximate-count` gives `totalKnown`. A 429 is retried at most 3 times, waiting `Retry-After` seconds (at most 5 s each) inside the time budget; then `RATE_LIMITED`.

## Snapshot schedule

- The `scheduledTrigger` runs daily. For each registered project it builds a snapshot as the app, within a 540 s budget across projects, and records the trend point for the current ISO week (a later build in the same week replaces it).
- A project is registered the first time its dashboard is opened.
- A page view never writes history. The UI shows the snapshot time, and "Refresh now" rebuilds it.
- Remote links are read for started issues, 8 at a time, while the time budget lasts. Issues not reached keep their Intent result from the previous snapshot when it exists, else they are NEEDS_RECHECK. `meta.remoteLinksRead` records the count.

The daily report run (`report-daily`, section 11.7) is separate from the daily snapshot.

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
| D-11 | Stored, signed per-project evidence reports (ADR-015 Option C, owner decision Q1) | No change; synchronous export; mirror all history; add the Jira audit log | Closes the change-management export gap of a cloud migrator within the product's purpose; mirroring breaks ADR-001; the Jira audit log needs `manage:jira-configuration` |
| D-12 | JSON plus CSV with a signed manifest; no PDF | PDF; unsigned files; hash shown in the UI only | The verifier can recheck JSON and CSV; a PDF needs a dependency (LedgerSeal D-7) |
| D-13 | Party tokens in signed files, names only in an unsigned people file | Account ids in the file; names in the file | Erasure must not break a signature (ADR-011 pattern) |
| D-14 | On-demand scope from a search as the user; long reads as the app for those ids only; download checks full visibility | Everything as the app; everything as the user in the browser | Long jobs run in a queue consumer, where reading as the user is not available (spike S-4: `AUTH_TYPE_UNAVAILABLE` without a user); no viewer gets an issue they cannot browse |
| D-15 | A report is complete or not stored; caps refuse, never truncate | Truncate at a cap and warn | A partial record misleads an auditor's sample |
| D-16 | Report retention is a FourRealities setting for its own reports only | Mirror Jira's history to extend it | Jira keeps issue history; FourRealities keeps the record it made |
| D-17 | The parts of a job are temporary Object Store objects, not KVS values (spike S-3) | KVS parts of 200,000 bytes (HLD 4.1) | KVS writes are limited to 4,000 units of 10 KB per minute per installation; the spike's KVS parts hit `RATE_LIMIT_EXCEEDED` after about 205 parts, and they would starve the dashboard's own KVS use |
| D-18 | FourRealities makes "written once" true itself | Rely on `overwrite: false` | Object Store accepted a second write to the same key with `overwrite: false` (spike S-1) |
| D-20 | A report holds a linked decision issue's key as the Intent evidence reference, never its title or content, as the dashboard does; the download check does not cover linked issues | Check the downloader can browse each linked issue; redact the key | Owner decision of 2026-11-08: "Keep the key" (L-10 part two) |
| D-19 | When Jira cannot return an in-scope issue (deleted, moved, or not readable), the report is still signed and names every missing issue with its key and the reason in the verifier output, in the UI (the download window names every one, 50 per page, each page only for a viewer allowed to download; the row shows the count) and in the CSV; a report is never refused for this (invariant 11) | Refuse the report (not stored) when an issue cannot be read; name only the first 50 in the UI | Owner decisions of 2026-11-08: "Sign, list them", and for the UI "Name every one" (review R4-3). A refused report gives the auditor nothing for the period; a signed report that names its gaps keeps the record and the gaps visible |

## 11. Evidence reports (ADR-015)

### 11.1 Scope of a report
- An issue is in scope when it is in the project and was created in the range, or has at least one changelog entry in the range that passes the filters. With a people filter, only entries by those people pass; with a field filter, only entries of those fields.
- The range runs from `from` (00:00 UTC, inclusive) to `to` (00:00 UTC, exclusive), at most 366 days; `to` is at most tomorrow. The form shows the last day; the payload carries the day after it.
- The candidate issues come from `project = {projectId} AND updated >= "{from - 1 day}" AND created < "{to + 1 day}"`: JQL dates use the site time zone, so the search is one day wider on each side and the rule above decides in UTC. More than 10,000 candidates gives `TOO_MANY_ISSUES` and nothing is stored.
- Gate results are observed when the report is built (`gatesObservedAt`), with the v3 rules, the sources in use (ADR-013) and the signature checks (ADR-012), by the same `DefaultGateEngine` as the dashboard. A report never claims a gate state for a past date.
- The issues of the project's previous report that the app can no longer read are listed in `missingSincePrevious`.

### 11.2 Field values (owner decision Q4)
- `USER` fields (`schema.type` `user`, or an array of `user`): account ids become party tokens; display names are left out.
- `FREE_TEXT` fields: `summary`, `description`, `environment`; every custom field whose schema type is `string` or not given (text field, text area, URL, read-only text, and app text fields); and every `customfield_*` that is not in the field list (for example a deleted field). The change is recorded with the old and new lengths, not the text (owner decision Q4, review M-2).
- `OTHER` fields: Jira's `from`, `to`, `fromString` and `toString`, each cut to 500 characters, with `truncated` set when cut. A changelog item whose field is not in the field list is `OTHER`, except a `customfield_*` id, which is `FREE_TEXT`.

### 11.3 Files, signature and chain
- `report.json` (`fourrealities-evidence-report-data/1`), `report.csv` (RFC 4180, UTF-8 without byte order mark, CRLF, every cell quoted, quotes doubled; a cell that starts with `=`, `+`, `-`, `@`, a tab or a carriage return gets a leading apostrophe, the JSON keeps the value) and `manifest.json` (`fourrealities-evidence-report/1`), as HLD 3.2 to 3.4. `report.json` and the manifest are canonical JSON (ADR-012 decision 2).
- The manifest holds the SHA-256 and byte count of each file and `previous`, the id and SHA-256 of the canonical JSON (with `sig`) of the project's previous DONE manifest, or `null` for the first. It is signed with Ed25519 over the canonical JSON of every other field, key `fr-dev-2026-11` in development and staging and `fr-prod-2026-11` in production. Without a configured key it carries `warning: "UNSIGNED"` and no `keyId` or `sig`, and the UI says so. The `header` of `report.json` equals the manifest without `files`, `keyId` and `sig`.
- The open verifier checks a report offline: `verify-fourrealities-report.mjs <manifest> <report.json> <report.csv> [publicKey.pem] [--previous <manifest>]` (HLD 3.6), in `tools/verifier` and the public `jira-governance-code-cli`.
- The download file names are `fourrealities-{projectKey}-{from}-{lastDay}-{reportId8}.json`, `.csv`, `-manifest.json` and `-people.csv`, where `lastDay` is the last day of the period, both days included, as the tab shows it (review round 3). The manifest's `range.to` stays the exclusive end (00:00 UTC of the day after the last day); the verifier prints the period with both days included. Object Store sends no file name (no `Content-Disposition`, spike S-1), so the UI Kit `FileCard` sets it.
- The people file (unsigned, HLD 3.5) is made at download, as the downloading user, from the token map and `GET /rest/api/3/user/bulk`; a closed account shows as "a former user". It is stored as a temporary object and removed 24 to 25 hours after the download by the hourly run `report-tmp` (review L-3). The UI offers its CSV form.

### 11.4 Who may do what (owner decisions Q2 and Q8)

| Action | Who | Check (as the user, fail closed) |
|---|---|---|
| See the list of reports | Browse projects | `mypermissions` |
| Create a report | Browse projects, and Administer projects or Administer Jira, or a member of an evidence report group | `mypermissions`; `myself?expand=groups` only when Tier 1 fails and groups are set |
| Download a report | Browse projects, and able to browse every issue in it that still exists; a report that holds a deleted issue needs Administer projects or Administer Jira | `mypermissions`; `search/jql` with `id in (...)` as the user (500 ids per call); then, as the app, which of the unseen ids still exist |
| Set or delete a schedule | Administer projects or Administer Jira | `mypermissions` |
| Delete a report before expiry | Administer Jira, with a reason of 15 to 500 characters; the tombstone is written first | `mypermissions` |
| Set retention and report groups | Administer Jira (admin page) | `mypermissions?permissions=ADMINISTER` |

### 11.5 Limits (owner decision Q6)
10,000 issues and 250,000 changes per report; 50 MB per file (`REPORT_TOO_LARGE`, no file stored); 366 days; 10 fields and 10 people; 3 queued jobs per project (`JOB_LIMIT`), 1 running per project and 10 running per site (a queued job waits and is tried again after 60 s); 200 reports per project (the oldest FAILED, EXPIRED or DELETED entry makes room, else `REPORT_LIMIT`); 5 schedules per project; 780 s per consumer event; 100 issues per batch, per part object and per bulk changelog call; a step that fails three times fails the job.

### 11.6 Resolver contracts

| Resolver | Input | Rules | Output |
|---|---|---|---|
| `getEvidenceReports` | `{ cursor? }` | Browse projects. 25 reports per page, the schedules, the tombstones, the viewer's rights, the retention, the signing key id, and the field list for the forms (only to a viewer who may create or schedule). | `{ reports, schedules, tombstones, canCreate, canSchedule, canDelete, licenceActive, retentionDays, signingKeyId, fields, next? }` |
| `createEvidenceReport` | `{ from, to, fieldIds?, actorAccountIds? }` | Licence active; Browse projects plus Tier 1 or a report group; 11.1 and 11.5. The account ids become party tokens before any storage. Writes the job, its ids and its index entry, then pushes the first event. | `{ reportId, state: 'QUEUED' }` |
| `getEvidenceReport` | `{ reportId }` | Browse projects; the report belongs to the context project. For a DONE report: the manifest and the download decision of 11.4. | `{ report, manifest?, download, fileNames }` |
| `generateReportDownloadUrls` | `{ keys }` (the `functionKey` of `useObjectStore`) | Browse projects. Each key is `reports/{contextProjectId}/{reportId}/{file}` or `people:{reportId}:{json|csv}`, all of one DONE report of the context project; the download decision of 11.4 again. A people key builds the people file first. | `{ [presignedUrl]: key }` (valid 1 hour), `{}` when refused |
| `saveReportSchedule` | `{ scheduleId?, cadence, fieldIds?, actorAccountIds? }` | Licence active; Tier 1; at most 5. | `{ schedules }` |
| `deleteReportSchedule` | `{ scheduleId }` | Licence active; Tier 1. | `{ schedules }` |
| `deleteEvidenceReport` | `{ reportId, reason }` | Administer Jira; reason 15 to 500 characters; a DONE report of the project. Tombstone first, then the files, ids, tokens and job; the index entry becomes DELETED. | `{ tombstone }` |
| `fr-admin-reports-get`, `fr-admin-reports-save` | `{ retentionDays, reportGroupIds }` | Administer Jira; `retentionDays` one of 90, 180, 400, 730, 1095, 1825, 2555; at most 20 groups, named by `group/bulk` as the user. | `{ retentionDays, allowedRetentionDays, policy, signingKeyId }` |

### 11.7 Queue consumer and daily run
- `report-worker` (as the app, 900 s): event body `{ reportId }`. A QUEUED job starts only when no other job of its project runs, it is the oldest queued one, and fewer than 10 run on the site. Then, per batch of 100 of the job's ids: the gate facts (one `search/jql` with `id in (...)`, the v3 fields, `created`, `issuetype` and the sibling properties), the remote links of started issues (8 at a time; a batch whose link reads were cut by time is read again in the next event), the bulk changelog (`POST /rest/api/3/changelog/bulkfetch`, `fieldIds` when filtered), the report issues in scope, one part object. The cursor is saved after each batch and the next event is pushed 60 s before the budget ends. The assembly reads the parts, checks the caps, builds both files, signs the manifest, writes the three objects once, then in one KVS transaction the DONE job, the index and the head, then removes the parts. A step that fails is tried again after 30 s, three times.
- `report-daily` (as the app, 540 s budget): stalled jobs (no progress for 2 hours) fail with `STALLED`; DONE reports past `finishedAt + retentionDays` are removed and their entry becomes EXPIRED (a shorter retention applies from this run); when the licence is active, each schedule's ended periods (weekly: Monday 00:00 UTC to the next Monday; monthly: calendar months, UTC; at most 3 per run) become scheduled jobs, with the scope searched as the app; temporary people files older than 24 hours are removed first. A period refused with `JIRA_ERROR`, `JOB_LIMIT` or `REPORT_LIMIT` is kept and tried again the next day, and the schedule records the refusal (`lastRefusal`, shown on the tab); a period refused for good (`TOO_MANY_ISSUES`) gets a FAILED row and is passed (review M-3).
- `report-tmp` (as the app, every hour): removes temporary people files older than 24 hours.
- A job event holds a lease (`job.lease`, the event id until the event's deadline); a second event for the same job ends at once while the lease holds (review L-1). A failed or stalled job removes its parts, its report objects, its token chunks and its ids (review L-2).
- Job transitions: none to QUEUED; QUEUED to RUNNING or FAILED; RUNNING to DONE or FAILED; DONE to EXPIRED or DELETED.

### 11.8 Personal data (amends ADR-014)
The weekly run also reports every account id in `fr:party:*`, and on closure replaces the entry with `{ closed: true, closedAt }`. Signed files keep the token. Report jobs, index entries, schedules and tombstones hold tokens only. The people file holds account ids and names for 24 to 25 hours.

### 11.9 UI
The project page has the tabs "Dashboard" and "Evidence reports" (the second loads when opened): the list (period, filters, who asked, state, size, SHA-256, action), "New evidence report" (From, To, Fields, People, and the note "The report holds every change in the range that you can see. It is kept until ... Free-text fields show that they changed, not the text."), the download modal with four `FileCard` rows (report JSON, report CSV, signed manifest, people file), early deletion with a reason (Jira administrators), the deleted reports, the schedules (Tier 1) and "How to check a report". The admin page has the section "Evidence reports" with the retention, the report groups and the signing key id. The accessibility rules of v3 apply. The words "audit log", "tamper-proof", "tamper-evident" and "compliant" are not used for reports.

### 11.10 Changes after the spikes (2026-11-08)
- S-3: the parts of a job are temporary Object Store objects (`tmp/{reportId}/part-{i}.json`), not KVS values (D-17).
- S-1: written once is made true by FourRealities (D-18); the file name comes from `FileCard`.
- The in-scope ids of a DONE report and its party tokens are kept while the report is kept: the download check and `missingSincePrevious` need the ids, the people file needs the tokens. The HLD deleted the ids after assembly.
- `REPORT_LIMIT` is the code of the full index (200 reports), separate from `JOB_LIMIT`.
- The site list `fr:reports:projects` and the temporary file register `fr:tmp:` (Object Store cannot list objects).

### 11.11 Changes after review round 1 (2026-11-08)
- H-1: `notReadable` and `counts.notReadable` (invariant 11 above); the batch read pages to the end.
- M-1: the index is one KVS value per report (`fr:p:{projectKey}:rep:{createdAt}:{reportId}`), so a writer changes only its own report's row; the single value `fr:p:{projectKey}:reports` is moved to these keys when read. A new entry's `createdAt` is later than the newest entry's, so the order of the index is the order of creation.
- M-2: the free-text rule of 11.2.
- M-3: scheduled periods kept on a temporary refusal (11.7).
- L-3: the hourly `report-tmp` run; L-1 lease; L-2 clean-up; L-5 the previous-report check uses the event deadline; L-6 party tokens are made only after every refusal; L-7 a key id with `-dev-` never signs a production report and one with `-prod-` never a development or staging report, and the verifier warns for a development key and fails a production report signed with one; L-8 the list has no issue or change counts, and `getEvidenceReport` gives the manifest only with a download decision that allows it.
- Download: the UI Kit `FileCard` does not save the Blob that `onDownload` returns (live check of 7.7.0); the tab saves the file itself with an object URL and a clicked anchor, as Atlassian's Object Store sample app does. The list reads itself again while a report is queued or running (5 s, doubling to 60 s, at most 40 times).

### 11.12 Changes after review round 2 (2026-11-08)
Invariant 11 was not changed in this round while the owner decided the rule; the owner then chose "Sign, list them" on 2026-11-08, and invariant 11 and D-19 now say so.
- N-1: the disclosure is where readers look. `report.json` `notReadable` entries carry `issueId`, `issueKey` and `reason`; `report.csv` has one `NOT_READ` row per such issue (after the issue rows; the `omitted` cell gives the reason); the tab shows a badge "N issues not in report" on the row and a notice in the download modal; the verifier prints a `WARN` line with the signed count and one line per issue, and fails when `report.json` lists a different number. The scope search keeps each issue's key with its id (`fr:rj:{id}:ids:{i}` holds `{issueId}:{issueKey}`).
- N-2: a project's report records (index, head, schedules, tombstones) are keyed by the project id; MOVED compares the project id; `getEvidenceReport` and downloads match the job by project id. A project key rename keeps every issue, report and schedule; the header names the key at the time of the report. Records of the development builds 7.7.0 and 7.8.0 (keyed by project key) are not read (N-4: no migration, so no migration can undo a newer write).
- N-3: the job records its token chunk count before it writes them, so a failed commit's clean-up removes them.
- N-5: an event that meets another event's lease is pushed again when the lease ends; the same event delivered again takes the job over.
- N-6: the 200-report cap stays a soft cap. A hard cap needs a conditional write on a counter, and Forge KVS offers conditions only on Custom Entities, not on plain keys. The overshoot is bounded by the creates that run at the same moment (at most 3 queued per project), and the next create removes the oldest removable entry.
- N-7: in production, a missing or unfitting signing key (no key, a `-dev-` key) makes no report: `createEvidenceReport` returns `NO_SIGNING_KEY`, a running job fails with `NO_SIGNING_KEY`, and a scheduled period is kept with the refusal on its schedule. An unsigned report is made only outside production.

### 11.13 Changes after review round 3 (2026-11-08)
- R3-1: the download modal names each issue that is not in the report, with key and reason; `getEvidenceReport` returns them only with an allowed download; the row badge keeps the count. (Round 3 named the first 50; round 4 names every one: 11.14.)
- R3-2, R3-6: the project registry is one KVS value per project (`fr:reports:project:{projectId}`); creating a report or saving a schedule adds the project; opening the tab only updates the key of a known project.
- R3-3: the download visibility check includes the MOVED issues, so their keys reach only a viewer who can see them.
- R3-5: on a production site with no fitting signing key the tab offers no "New evidence report" and states the reason (`cannotCreateReason`).
- File names use the inclusive last day (11.3).

### 11.14 Changes after review round 4 (2026-11-08)
- R4-3, owner decision of 2026-11-08 "Name every one": `getEvidenceReport` takes `notReadPage` and returns one page of 50 missing issues with `notReadablePage` `{ page, pageSize, total }`; a page outside the list is clamped. Every page runs the permission and visibility check again, and returns nothing when the download is not allowed. The download window shows "Issues 51 to 100 of 1000" with Previous and Next.
- R4-1: opening the tab registers a project that has reports or schedules but no registry key; a create registers the project before it writes the index entry.
- R4-2: the verifier gives a FAIL line, never a crash, for a range that is not two dates in order, and for files of any other shape.

### 11.15 Release preparation (2026-11-08)
- D-20 (owner, "Keep the key"): the linked decision issue's key only; the privacy text says so.
- Retention and content texts (review R5-1, R5-4): tombstones stay while the app is installed; the list entries of failed, expired and deleted reports stay until the 200-entry cap pushes them out; party token links stay while the account is open (reported weekly, removed on closure). The files hold, in plain text, issue summaries (up to 120 characters), Code exception reasons, rework notes, the URL and title of a linked Confluence page (user-typed, any text), linked decision-issue keys, and evidence references (LedgerSeal certificate ids, hashes) (release review REL-1).
- R5-3: a create that fails before its index entry removes its job record and id chunks.
- The verifier's `verifyReport` never throws, also when used as a library.
- Licence in the daily run: the Forge docs do not say that a scheduled trigger's app context carries the licence (app context API: "This field is only present for paid apps in the production environment"; scheduled trigger page: nothing on it; both read 2026-11-08). The run reads `license.active` (the deprecated `isActive` only without it), else, in production, the License REST API `GET /forge/app/v1/license` (`results[0].data.active`). New scheduled reports are made only when the licence is active, or unknown outside production (D-10); in production an unknown licence makes none. Retention and clean-up run whatever the licence. Resolvers and the snapshot trigger read `active` first too.
- Production key `fr-prod-2026-11` (SHA-256 of the DER public key `07b6b5e5749e282627a112d99dac364e199b4a355913e1b820145221cca30419`).
- Release review REL-2: an on-demand report covers the requesting user's own search; a scheduled report covers the project's issues, searched as the app; every download is checked as the user (invariant 4). The questionnaire says the same.
- Release review REL-3: the signer bundles the published public key of each key id (`report-signing-keys.ts`). A configured private key whose public half is not that key, or whose id has none, is refused: no report is made (`NO_SIGNING_KEY`), in every environment.
- Release review REL-4 (recorded, not changed): the snapshot trigger still runs when the context has no licence, and skips only on `active: false`. Failing closed there, as the report run does, would need the License REST API too. That API allows 1 request per 5 minutes per installation, so the two daily triggers would compete, and a refused or failed call would stop a paying site's daily snapshot. A missed scheduled report is made the next day; a missed snapshot leaves the dashboard a day old.

### Grader conflict

`loop-engine/graders/grade_spec.py` checks `docs/spec/fourrealities-spec.md` (v1, frozen), not this file. The agent definition `loop-engine/agents/spec_architect.md` also expects scopes limited to `read:jira-work` and `storage:app`. This app needs `write:jira-work` (D-8). The scope stays, and the conflict is recorded here and in the round log. The grader runs against a mirror that holds this v2 file under the v1 name.
