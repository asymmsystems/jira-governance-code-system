# CascadePlan: specification

- **Date:** 2026-11-01
- **Status:** approved scope `B-01..B-27` (`docs/sdlc/cascadeplan-usp-ux-research-2026-11/backlog.md`, first line).
- **Inputs:** `research-brief.md`, `ux-spec.md`, `backlog.md` in the same research folder; audit findings CP-01 to CP-29; new findings NF-01 to NF-09.
- **Branch:** `feature/cascadeplan-research-build`.

## 1. Executive Summary

CascadePlan is a Jira Cloud project page (Forge Custom UI) that plans issues on a timeline. Its core promise (USP U1, with U2 inside it) is: a successor can start when its predecessor reaches X% complete, and every bar shows its computed earliest start and the reason, naming the driving task. U3 adds a second person to a task through a real Jira sub-task.

This specification covers the approved backlog. It fixes the release blockers (no HTML injection, no inline script, no values written to Jira that the user did not enter, Jira-owned fields read live), replaces the single-key storage with one WorkEffort record per issue, replaces the two disagreeing schedule engines with one date-based engine, and moves the timeline to a canvas renderer with an accessible DOM layer.

## 2. Invariants

| ID | Invariant | Backlog |
|---|---|---|
| INV-01 | No Jira or payload text reaches `innerHTML`, `outerHTML`, `insertAdjacentHTML` or an HTML attribute string. All text goes through `textContent` or `setAttribute`. | B-02 |
| INV-02 | The UI has no inline script and no `on*` attribute, and calls the backend only through `invoke` from `@forge/bridge`. | B-01 |
| INV-03 | CascadePlan writes a Jira field only when the user changed that field in this action. It never writes a default (no 40 h estimate, no "Unassigned"). | B-03 |
| INV-04 | KVS holds only app-owned planning data. Summary, status, assignee, Jira estimate and leaf progress are read live from Jira on every load. | B-04, B-24 |
| INV-05 | Every write resolver returns `{ ok, jiraSync: { ok, error } }`, and the UI shows every failure. | B-07 |
| INV-06 | All Jira reads run as the user (`asUser()`). | B-08 |
| INV-07 | No KVS value exceeds 8 KiB at 1,000 tasks (platform limit 240 KiB). `getProjectPlan` writes nothing. | B-09 |
| INV-08 | A write with a stale base version is rejected with `conflict`, and the newer value survives. | B-09 |
| INV-09 | One function computes the earliest start for the auto-move, the violation check, the preview and the reason text. | B-11 |
| INV-10 | Every computed earliest start has a reason that names the driving predecessor, the trigger percent, the date and the basis. | B-11, B-12 |
| INV-11 | A cascade moves only successors that conflict, never moves a task the user did not see in the preview, and is bounded per call. | B-10, B-11, B-23 |
| INV-12 | Every edit can be undone (20 steps) and no routine edit asks for confirmation. | B-14 |
| INV-13 | Every pointer action has a keyboard path and a single-pointer path. | B-15 |
| INV-14 | Every colour comes from an ADS token (CSS custom property), in DOM and canvas, and meets WCAG 2.2 AA contrast. | B-13, B-17 |
| INV-15 | Every issue key in a payload matches `^[A-Z][A-Z0-9_]+-\d+$` and belongs to the context project. | B-02 |

## 3. Domain Model

### 3.1 Storage model: WorkEffort (owner decision, B-24)

The Silverston / OFBiz / Moqui WorkEffort pattern is the storage model. `models.ts` already defines the types; this spec makes them the stored form.

| Type | Role | Stored fields |
|---|---|---|
| `WorkEffort` | One per Jira issue on the plan | `workEffortId` (issue key), `issueId`, `estimatedStartDate`, `estimatedCompletionDate`, `sequenceNum`, `manualProgress`, `percentComplete` (only when the user set progress by hand, on a task or a parent) |
| `WorkEffortAssoc` | Precedence link into this effort | `workEffortIdFrom` (predecessor key), `workEffortIdTo`, `workEffortAssocTypeId` (`FRACTIONAL_MILESTONE`), `triggerPercent` (0 to 100), `jiraLinkId` (the "Blocks" link CascadePlan created, if any) |
| `WorkEffortPartyAssignment` | Second people on a task (U3) | `partyId` (account id), `displayName`, `roleTypeId` (`CONTRIBUTOR`), `subtaskKey` |
| `WorkEffortEstimate` | Estimate as the user entered it | `estimateUnit`, `rawEstimate`, `normalizedHours` |

Not stored: summary, status, assignee, Jira original estimate, time spent, and computed progress (INV-04).

`WorkEffortRecord` (one KVS value per issue):

```ts
interface WorkEffortRecord {
  effort: WorkEffort;
  assocs: WorkEffortAssoc[];          // precedence links INTO this effort
  parties: WorkEffortPartyAssignment[];
  estimate?: WorkEffortEstimate;
  version: number;                    // incremented on every write
}
```

### 3.2 View model

`WbsTask` stays as the view model the UI receives. It is built by merging the live Jira issue with its `WorkEffortRecord` (B-24 criterion 2). `toWorkEffort` and `fromWorkEffort` convert between the two and round-trip every stored field.

### 3.3 Schedule engine equations (B-11)

All dates are UTC calendar days (ISO `YYYY-MM-DD`). Working days are out of scope for this release (recorded in Decisions).

For a predecessor P with start day `s_P`, end day `e_P` (inclusive), duration `d_P = max(1, e_P - s_P + 1)` days, progress `p_P` (0 to 100), and a link trigger `X` (0 to 100):

1. **Satisfied:** if `p_P >= X`, the link places no constraint. Reason: "API-4 is at 45%, past the 30% trigger."
2. **Observed basis:** if `0 < p_P < X` and today `t > s_P`: rate `r = p_P / max(1, t - s_P)` percent per day. Earliest start `E = t + ceil((X - p_P) / r)`.
3. **Planned basis:** otherwise `E = s_P + ceil(d_P * X / 100)`. So `X = 0` starts together with P, and `X = 100` gives finish-to-start (`E = e_P + 1`).
4. **Trigger date** shown to the user: `E - 1` (the day P reaches X%), or `s_P` when `X = 0`.
5. **Several predecessors:** `E = max(E_i)`; the driver is the predecessor with the largest `E_i`. Order: Kahn topological order; a cycle is a validation error.
6. **Violation:** successor S with start `s_S < E`, not satisfied.
7. **Cascade:** in topological order, move a successor only if `s_S < E`: new start `E`, same duration. Successors with slack do not move (UR-06).
8. **Rounding:** every division rounds up to a whole day.
9. **Progress source:** done status category gives 100. Otherwise, for a leaf, `timespent / timeoriginalestimate` of the same issue; for a parent, `aggregatetimespent / aggregatetimeoriginalestimate` (CP-28). A parent with `manualProgress` uses its stored `percentComplete`.
10. **Team factor (assumption, not a research result):** `F(N) = 1 + 0.25 x (min(N, 5) - 1)`. It is used only to *suggest* a shorter end date when a second person is added to a task that has not started. The user accepts or ignores the suggestion; the engine never applies it on its own (keeps INV-03 and avoids NF-04).

Reason text format: `Starts <E> because <P> reaches <X>% on <E-1> (<basis>: <detail>).` Basis detail: `planned: <d_P> days` or `observed: <p_P>% in <days> days`.

## 4. Manifest

```yaml
modules:
  jira:projectPage:
    - key: cascadeplan-project-planner
      title: CascadePlan Planner
      icon: resource:main;icon.svg
      resource: main
      resolver:
        function: resolver
  function:
    - key: resolver
      handler: index.handler
resources:
  - key: main
    path: static/frontend/build
permissions:
  content:
    styles:
      - 'unsafe-inline'      # only until style attributes are removed; no scripts entry
  scopes:
    - read:jira-work
    - write:jira-work
    - read:jira-user
    - storage:app
app:
  runtime:
    name: nodejs22.x
  licensing:
    enabled: true            # B-21 ([SCOPE] approved)
```

- No `scripts` permission (INV-02). No egress.
- `write:jira-work` is required: the product writes due dates, issue links and sub-tasks. `loop-engine/agents/spec_architect.md` asks for `read:jira-work` and `storage:app` only; that rule does not fit this app and is recorded as a conflict, not applied.

## 5. Storage Schema

Keys use the project **id**, not the key (CP-09: a renamed project keeps its plan).

| Key | Value | Size at 1,000 tasks |
|---|---|---|
| `cp:<projectId>:we:<issueId>` | `WorkEffortRecord` | about 0.5 KiB each with one link and one party; budget 8 KiB |
| `cp:<projectId>:settings` | `{ columnWidths, hiddenColumns, milestones (max 100), migratedAt }` | under 8 KiB |

- Listing: `kvs.query().where('key', WhereConditions.beginsWith('cp:<projectId>:we:')).limit(100).cursor(...)`, paged.
- Version check: write with `kvs.set(key, value, { keyPolicy: 'OVERRIDE', returnValue: 'PREVIOUS' })`. If the returned previous `version` differs from the base version, restore the previous value and return `{ ok: false, conflict: true }` (INV-08).
- Migration (B-04, B-09, B-24, approved): on first load, if `cp:<projectId>:settings.migratedAt` is absent and `scheduleMap:<projectKey>` exists, convert each entry to a `WorkEffortRecord` (dates, dependency to `WorkEffortAssoc`, contributors to `WorkEffortPartyAssignment`), drop Jira-owned fields, copy `colWidths`, `hiddenColumns`, `milestones`, then set `migratedAt`. Old keys are deleted only after every new record is written. Idempotent.

## 6. Validator

Every resolver validates its payload before any read-modify-write (`src/validation.ts`):

| Field | Rule |
|---|---|
| issue key | string, `^[A-Z][A-Z0-9_]+-\d+$`, max 50 characters, present in the live project issue set (INV-15) |
| dates | `^\d{4}-\d{2}-\d{2}$`, valid calendar date, end on or after start, within 10 years of today |
| `triggerPercent` | integer 0 to 100; required for a link |
| `progress`, `targetProgress` | integer 0 to 100 |
| `effortHours` / `rawEstimate` | number 0 to 10,000 |
| `estimateUnit` | `HOURS`, `STORY_POINTS`, `TSHIRT` |
| strings (summary, milestone title) | max 255 characters |
| `expectedVersion` | non-negative integer |
| `columnWidths` | object of known column keys to integers 40 to 800 |

A failed check returns `{ ok: false, error: 'validation', field, message }` and makes no write.

## 7. Resolver contracts

All resolvers take the project from `req.context.extension.project` (key and id). No payload project key is trusted.

| Resolver | Payload | Result |
|---|---|---|
| `getProjectPlan` | `{ cursor? }` | `{ ok, plan, truncated: { shown, total } }` |
| `updateSchedule` | `{ issueKey, start, end, expectedVersion }` | `{ ok, jiraSync, changes[], record, conflict? }` |
| `previewCascade` | `{ issueKey, start, end }` | `{ ok, changes[] }` (no write) |
| `applyCascade` | `{ changes[], expectedVersions }` | `{ ok, jiraSync, applied[], remaining[] }`; at most 25 issues per call (B-10) |
| `setDependency` | `{ issueKey, predecessorKey, triggerPercent, expectedVersion }` | `{ ok, jiraSync, record, conflict? }` |
| `removeDependency` | `{ issueKey, predecessorKey, expectedVersion }` | `{ ok, jiraSync, record }`; also deletes the Jira link CascadePlan created |
| `setProgress` | `{ issueKey, progress, manual }` | `{ ok, record }` (parents only; KVS only) |
| `updateIssueFields` | `{ issueKey, changed: { summary?, estimate?, assigneeAccountId?, status? } }` | `{ ok, jiraSync }`; sends only the changed fields |
| `scheduleIssue` / `unscheduleIssue` | `{ issueKey, start?, end? }` | `{ ok, jiraSync, record }` |
| `addPerson` / `removePerson` | `{ issueKey, accountId, deleteSubtask? }` | `{ ok, jiraSync, record, suggestedEnd? }` |
| `createIssue` | `{ summary, issueTypeId, parentKey?, assigneeAccountId?, start?, end? }` | `{ ok, jiraSync, issueKey }` |
| `saveSettings` | `{ columnWidths?, hiddenColumns?, milestones? }` | `{ ok }` |

`jiraSync = { ok: boolean, error?: string, writes: [{ key, field, from, to, ok }] }`. The `writes` list feeds the Changes panel (B-23).

Rate limits: Jira search pages with `nextPageToken` (max 5 pages of 100 inside a 20 s budget); a 429 is retried with `Retry-After` (max 3 tries) inside the budget (B-10).

Licensing: when `req.context.license` exists and `isActive` is false, every write resolver returns `{ ok: false, error: 'license' }` and makes no write (B-21).

## 8. UI module layout (B-01)

| Path | Content | Tests |
|---|---|---|
| `src/domain/schedule-engine.ts` | B-11 engine (shared by backend and UI bundle) | Jest unit |
| `src/ui/*.ts` | Pure UI logic: date and pixel mapping, drag-to-date, undo stack, selection, hit testing, contrast, shortcuts | Jest unit (node environment) |
| `src/frontend/*.ts` | DOM and canvas code, thin; entry `main.ts` | Playwright harness |
| `tools/package.json` | `esbuild` only, in its own `node_modules` (not the shared LedgerSeal tree) | |
| `static/frontend/build/app.js` | esbuild bundle (IIFE) | |
| `static/frontend/build/index.html` | markup and `<script src="app.js">` only | Unit (static check) |

Build: `npm run build:ui` runs `tools/node_modules/.bin/esbuild src/frontend/main.ts --bundle --format=iife --target=es2020 --outfile=static/frontend/build/app.js`.

## 9. Decisions

| # | Decision | Options considered | Reason |
|---|---|---|---|
| D-01 | Bundle the UI with esbuild installed in `apps/planshift/tools/` | esbuild in shared `node_modules`; vendor a pre-built bridge file; webpack | Isolated `node_modules`, so LedgerSeal is not touched. One small binary dependency. A vendored file would hide the bridge version and need manual updates. |
| D-02 | Version check by atomic `set` with `returnValue: 'PREVIOUS'` | Custom Entity Store with transaction conditions; read-then-write | Works on plain KVS with no entity schema. Detects every lost update; the restore step has a small race window, recorded as a known limit. |
| D-03 | WorkEffort is the stored model (owner decision) | Keep `scheduleMap`; separate keys per WorkEffort type | One record per issue keeps reads and writes to one key per issue and stays far below 240 KiB. |
| D-04 | Team factor only suggests a date | Apply automatically; remove | Automatic use writes values the user did not enter (INV-03) and caused NF-04. |
| D-05 | Bounded cascade with client-driven continuation (25 issues per call) | Forge async events queue | The queue needs `@forge/events` (not installed) and a consumer module. Continuation keeps every call under 25 s with no new runtime dependency. Recorded against B-10 criterion 3. |
| D-06 | Calendar days, no working-day calendar | Working days | Not in the approved backlog. High demand (JP-32); a later item. |
| D-07 | Timeline on canvas, data columns in DOM, accessible treegrid layer (owner decision) | All DOM with virtualisation | Owner decision; prototype T-06 meets the frame budget at 5,000 tasks. |
| D-08 | Keep the existing inline-script UI logic, moved to `src/frontend/legacy-planner.js`, and replace it part by part | Full rewrite in one item | One commit per backlog item stays possible, and each item stays testable. |
| D-09 | `grade_ui.py` expects UI Kit (`@forge/react`); CascadePlan is Custom UI | Switch to UI Kit | UI Kit has no canvas or DOM access (RS-25), so the approved canvas timeline is impossible in UI Kit. The `@forge/bridge` invoke check of the grader still applies. |
| D-10 | Remove the Executive Heatmap view; keep a per-person weekly hours view computed from estimates | Keep heatmap with metadata UI | The heatmap showed invented CoE data (CP-19) and is not in the USPs. |
