# DefinitionGuard: Architecture Specification v2

- **Date:** 2026-11-01
- **Status:** Covers backlog items B-01 to B-20 in `docs/sdlc/definitionguard-usp-ux-research-2026-11/backlog.md` (approved 2026-11-01, all items and flags).
- **Replaces:** nothing. `docs/spec/definitionguard-spec.md` (v1) stays as written. Where v2 and v1 differ, v2 describes the code on branch `feature/definitionguard-research-build`.
- **Sources:** source IDs (M-, N-, R-, L-, T-) refer to `research-brief.md` section 8 in the folder above. Finding IDs DG-01 to DG-16 and PX-01 to PX-04 come from `docs/sdlc/portfolio-audit-2026-10-31/`.

## Executive Summary

DefinitionGuard is a Definition of Done checklist on the Jira issue panel, with a Forge workflow validator that blocks a move into a Done-category status while a mandatory item is open. App storage is the only source of truth for the gate. Every change is an append-only event in Forge KVS, chained by hash. Project admins define templates per issue type on a project settings page. Each item can require evidence, a permission, or a person other than the assignee. An authorised user can waive an item with a reason. The app publishes a signed summary in the issue property `definitionguard-dod` for other tools. That property is informational: the gate never reads it.

The app runs on Forge with no egress. It does not make a customer compliant with any framework.

## Invariants

1. **Zero external egress.** No `external` permission, no HTTP call outside the Jira REST API.
2. **App storage decides the gate.** The validator reads Forge KVS only. It never reads the `definitionguard-dod` property, which any editor or app can write (DG-10, FR-03).
3. **The gate fails closed.** Any error in the validator returns `result: false` with a next step (DG-08). A missing record blocks, and the message names every open mandatory item.
4. **Reads never write.** The panel load and the validator make no KVS write. A checklist record is created by the first change.
5. **Events are append-only.** An event is never changed after it is written (DG-09). Each event stores the actor's accountId only. Names are rendered at view time.
6. **One rule.** The panel and the validator call the same function to decide "satisfied" (DG-14).
7. **Bounded values.** No KVS value grows with the number of changes. The largest value stays at 32 KiB or less at 50 items (KVS limit 240 KiB, N-11).

## Domain Model

```typescript
type ItemStatus = 'OPEN' | 'DONE' | 'WAIVED';

interface ChecklistItemTemplate {
  id: string;                 // unique in the template, 1 to 64 chars [A-Za-z0-9_-]
  title: string;              // 1 to 200 chars
  description?: string;       // 0 to 500 chars
  isMandatory: boolean;
  category: ChecklistCategory;
  evidenceRequired?: boolean; // a tick needs a link or a note
  requiredPermission?: JiraPermissionKey; // default EDIT_ISSUES
  notAssignee?: boolean;      // the current assignee may not complete it
}

interface ChecklistTemplate {
  id: string; name: string; description: string;
  version: number;            // increases on every save
  waiverPermission?: JiraPermissionKey; // default ADMINISTER_PROJECTS
  items: ChecklistItemTemplate[];       // 1 to 50
}

interface ItemState {          // inside ChecklistState
  id: string; title: string; isMandatory: boolean; category: ChecklistCategory;
  evidenceRequired: boolean; requiredPermission: JiraPermissionKey; notAssignee: boolean;
  status: ItemStatus;
  byAccountId?: string; at?: string; eventSeq?: number; hasEvidence?: boolean;
}

interface ChecklistState {     // KVS dg:state:<issueId>, a cache of the event log
  schemaVersion: 2;
  issueId: string; issueKey: string; projectId: string;
  templateId: string; templateVersion: number; waiverPermission: JiraPermissionKey;
  items: ItemState[];
  seq: number;                 // last applied event
  headHash: string;            // hash of event `seq`, or the genesis hash
  legacy?: { stateVersion: number; eventCount: number; checklistHash: string };
}

type EventType = 'CREATED' | 'MIGRATED' | 'TICK' | 'UNTICK' | 'WAIVE' | 'RESET' | 'RESYNC';

interface ChecklistEvent {     // KVS dg:evt:<issueId>:<seq as 8 digits>
  seq: number; issueId: string; type: EventType; at: string; actorAccountId: string;
  itemId?: string; itemTitle?: string;
  evidence?: { url?: string; note?: string };   // url http/https only; note 500 chars max
  reason?: string;                              // waiver reason, 10 to 500 chars
  templateId?: string; templateVersion?: number; // CREATED, MIGRATED, RESYNC
  prevHash: string; hash: string;
}
```

`ChecklistCategory` keeps the v1 values. `JiraPermissionKey` is a Jira permission key string, for example `EDIT_ISSUES`, `RESOLVE_ISSUES`, `ADMINISTER_PROJECTS`.

## Gate rule

One pure function, `evaluateGate(state, assigneeAccountId?)` in `src/domain/gate-rule.ts`, returns `{ satisfied, openMandatory: ItemState[] }`.

- A mandatory item counts as done when its status is `WAIVED`, or `DONE` with evidence if `evidenceRequired`.
- A `notAssignee` item that is `DONE` by the current assignee counts as open.
- Zero mandatory items means satisfied, in the panel and in the validator.

Validator flow (`validateTransition`), all inside one `try`/`catch`:

1. Resolve the issue. The payload carries `issue.key` (N-01). One `asApp` GET `/rest/api/3/issue/{key}?fields=project,issuetype,assignee` gives the numeric id, project id, issue type id and assignee. If the payload already has the id and nothing else is needed, the call is skipped.
2. Load the state (section "Storage Schema"). If none exists, build it in memory from the template. Do not store it.
3. If `evaluateGate` says satisfied, return `{ result: true }` with no further call.
4. Otherwise read the target status category with `asApp` GET `/rest/api/3/status/{transition.to.id}` (`read:jira-work`). If the category is not `DONE`, or the target status is in the project's exempt list, return `{ result: true }`.
5. Otherwise return `{ result: false, errorMessage }`. The message names every open mandatory item by title and says to open the DefinitionGuard panel.
6. When the licence context is present and inactive, return `{ result: false }` with a licence message (B-09).
7. Any thrown error or non-200 response returns `result: false` with: "DefinitionGuard could not check the Definition of Done, so this move is blocked. Try again. If it keeps failing, ask your Jira admin."

Jira calls per validation: at most 2. KVS: at most 3 gets (state, head probe, template), 0 sets.

## Storage Schema

Forge KVS (`@forge/kvs`). Key prefixes:

| Key | Value | Size bound |
|---|---|---|
| `dg:state:<issueId>` | `ChecklistState` | 32 KiB at 50 items with 200-char titles |
| `dg:evt:<issueId>:<seq 8 digits>` | `ChecklistEvent` | Change events (TICK, UNTICK, WAIVE, RESET): 2 KiB with 500-char evidence. CREATED, MIGRATED and RESYNC carry the item list: 32 KiB at 50 items |
| `dg:tmpl:<projectId>:<issueTypeId>` | `ChecklistTemplate` | 32 KiB, checked on save |
| `dg:proj:<projectId>` | `{ exemptStatusIds: string[], updatedAt, updatedByAccountId }` | 4 KiB |
| `dg:checklist:<issueId>` | v1 record, read only, never written by v2 | as stored |

### Write protocol (compare-and-set, B-03 option A)

A KVS transaction cannot carry `keyPolicy` (Observed-code `@forge/kvs` 2.1.1: `TransactSet.options` is `SetOptions`, TTL only; R-05). Conditions exist only for Custom Entities. So the event key is the lock:

1. Read the state with a strict `kvs.get` (N-16). Probe `dg:evt:<id>:<seq+1>`. If it exists, the cached state is behind: fold forward event by event until a probe misses.
2. Build the next event with `seq + 1` and `prevHash = state.headHash`.
3. `kvs.set(eventKey, event, { keyPolicy: 'FAIL_IF_EXISTS' })` (N-13). If it fails and a strict get finds the key, another writer won. Go to step 1, up to 3 attempts, then reply "Someone else changed this checklist. Refresh and try again."
4. `kvs.set(stateKey, nextState)`. If this write fails, the event stands and the next reader folds it forward (step 1). No change is lost.

### Reads

- Panel and validator: state get, one head probe, and the template get only when no state exists.
- History: `kvs.query().where('key', WhereConditions.beginsWith('dg:evt:<id>:'))`, pages of at most 100 (N-14), sorted by `seq` in code. The query is eventually consistent (N-16). The newest events are confirmed with strict gets from the state `seq`.

### Migration from v1 (`[MIGRATE]`)

- A read that finds no `dg:state` but a v1 `dg:checklist` record derives the state in memory. Item status comes from `isCompleted` and `completedByAccountId`. Nothing is written.
- The first change writes event 1 `MIGRATED`, which records the v1 `stateVersion`, audit event count and `checklistHash`. Then it writes the change itself as event 2. The v1 key is kept as is. The history view lists its events first, marked "Imported from version 1, not chained".

## Permission model

All permission checks call `asUser().requestJira` GET `/rest/api/3/mypermissions?issueKey=<key>&permissions=<keys>`. The check uses the issue key, because a project-level answer can be wrong (N-20). Storage writes run as the app. If the check fails or errors, the action is refused.

| Action | Needs |
|---|---|
| Tick or untick | `EDIT_ISSUES`, plus the item's `requiredPermission` |
| Tick a `notAssignee` item | Also: the caller is not the current assignee (asUser GET issue `fields=assignee`) |
| Waive | The template's `waiverPermission` (default `ADMINISTER_PROJECTS`) and a reason |
| Reset | `ADMINISTER_PROJECTS` |
| Export history | `ADMINISTER_PROJECTS` |
| Settings page: templates, exemptions, re-sync, coverage | `ADMINISTER_PROJECTS` on the project (`mypermissions?projectKey=`) |

Viewing the panel needs only what Jira needs to show the issue.

## Integrity design

- **Chain.** `hash = sha256(canonicalJson(event without hash))`, where the event includes `issueId`, `seq` and `prevHash`. The genesis `prevHash` is `sha256("definitionguard:" + issueId)`. Canonical JSON has sorted keys and no spaces.
- **Verify.** `verifyChain(issueId)` re-hashes every event in `seq` order. It reports the first event whose hash, `prevHash`, `issueId` or `seq` does not match, and any gap in `seq`. The history view shows "History checked: N events, chain intact." or "History check failed at event K."
- **What it proves.** The chain shows edits, deletions, reordering, and events copied from another issue, made by anything that does not recompute every later hash. It does not stop a writer who can rewrite the whole store and recompute the chain, and that includes the vendor (audit 5.5). The panel and the listing say so.
- **Signed property (B-14, `[ENV]`).** On every change, the app writes `definitionguard-dod` schema v2 (audit 5.2) with `asApp`:
  `{ schemaVersion: 2, issueId, templateId, templateVersion, stateVersion (= seq), mandatoryTotal, mandatoryCompleted, openMandatoryItemIds, isFullySatisfied, lastModifiedByAccountId, headHash, issuedAt, keyId, sig }`.
  `sig` is Ed25519 (Node `crypto`, no new dependency) over the canonical JSON of all other fields. The private key comes from the encrypted Forge variable `DG_SIGNING_KEY` (PKCS#8 PEM, base64), with `DG_SIGNING_KEY_ID` as `keyId`. The variable reaches the app as clear text (N-25). The public key is published in `docs/marketplace/definitionguard-public-key.pem`. Without the variable, the property is written with `sig: null` and readers must treat it as unsigned.
- **Vendor-key limit.** The vendor holds the private key. A valid signature proves that this app wrote the value. It does not protect against the vendor. The listing states this.
- The property write checks the HTTP status. It retries on 429 and 5xx, up to 3 tries with backoff. It never changes the gate result.

## Resolver contracts

Issue panel resolver (`definitionguard-issue-panel`). Issue identity always comes from `context.extension.issue`, and the payload never chooses the issue. The actor always comes from `context.accountId`.

| Function | Input | Checks | Output | Errors (each with a next step) |
|---|---|---|---|---|
| `getChecklist` | `{}` | none | `PanelData`: state (stored, or derived and unsaved), gate result, permissions for the caller | "DefinitionGuard could not load this checklist. Refresh the page." |
| `toggleItem` | `{ itemId, isCompleted, evidence? }` | itemId exists; evidence url `^https?://`, at most 2,000 chars; note at most 500 chars | new `PanelData` | permission text, "Add a link or a note. This item needs evidence before it counts as done.", "The assignee cannot complete this item. Ask a reviewer." |
| `waiveItem` | `{ itemId, reason }` | reason 10 to 500 chars | new `PanelData` | "Only users with <permission> can waive this item." |
| `resetChecklist` | `{}` | `ADMINISTER_PROJECTS` | new `PanelData` | "Only a project admin can reset this checklist." |
| `getHistory` | `{ cursor? }` | none | events page (100), legacy events, chain check | as above |
| `exportHistory` | `{}` | `ADMINISTER_PROJECTS` | JSON text of all events and the chain check | as above |

Project settings resolver (`definitionguard-project-settings`). Every function first checks `ADMINISTER_PROJECTS` on `context.extension.project`.

| Function | Input | Output |
|---|---|---|
| `getSettings` | `{}` | issue types, templates, exempt status ids, coverage report |
| `saveTemplate` | `{ issueTypeId, template }` | saved template with `version + 1`; count of open issues on older versions |
| `saveExemptions` | `{ exemptStatusIds }` | saved config |
| `resyncIssues` | `{ issueTypeId, cursor? }` | `{ updated, nextCursor }`; at most 25 issues per call |

Every resolver caps the input size (32 KiB) and rejects unknown fields in item templates. With licensing on, every write resolver refuses when `context.license.isActive === false` (B-09).

## Manifest

| Module or block | v2 |
|---|---|
| `jira:issuePanel` | as v1, icon from `resource:icons;check.svg` (DG-16) |
| `jira:workflowValidator` | as v1, plus `projectTypes: ['company-managed', 'team-managed']` (B-20, N-01) |
| `jira:projectSettingsPage` | new: `definitionguard-project-settings`, UI Kit (B-06, B-16, B-17) |
| `app.licensing.enabled` | `true` (B-09, N-27) |
| Scopes | `read:jira-work`, `write:jira-work`, `storage:app`, and for the coverage check `read:workflow:jira`, `read:workflow-scheme:jira`. `read:jira-user` is removed, because no code calls `/rest/api/3/user` after B-07 |

`write:jira-work` is needed to write the issue property. `grade_security.py` and `spec_architect.md` expect only `read:jira-work` and `storage:app`. That rule does not fit this app (see Decisions D-10).

## Decisions

| ID | Decision | Options considered | Reason |
|---|---|---|---|
| D-01 | Event log in single keys, `FAIL_IF_EXISTS` on the next event key as the lock; state is a cache | (A) this; (B) Custom Entity with a conditional set on `stateVersion`; (C) per-item keys | Owner approved option A. A transaction cannot carry `keyPolicy` (R-05), so (A) uses one guarded set plus a cache write. (B) needs a manifest storage entity. (C) keeps no ordered audit trail |
| D-02 | Reads never write; the record is created by the first change | Create on first panel load (v1) | A panel view or a validator run must have no side effect (DG-08, DG-09). The validator applies the same template in memory |
| D-03 | Permission keys, not project roles, for per-item rules | Project roles | One `mypermissions` call as the user checks several keys at once. Reading role members needs project admin rights (Inferred). Admins map roles to permissions in the permission scheme |
| D-04 | The validator re-checks `notAssignee` against the current assignee | Check only at tick time | Separation of duties holds at the moment of Done, even if the assignee changes after the tick |
| D-05 | Satisfied checklists pass without a status lookup; unsatisfied ones block only Done-category, non-exempt targets | Block every attached transition (v1); block every Done-category target | Avoids blocking "Cancel request" and "Declined" (NF-03, L-06) when an admin exempts them. Saves a Jira call on the common path |
| D-06 | Unkeyed hash chain in storage; Ed25519 signature on the property only | HMAC over events; no chain | The chain is verifiable by the app and an auditor export with no secret. A shared HMAC secret lets any holder forge (audit 5.0). Signing the property gives other tools a check |
| D-07 | Names rendered by the UI Kit `User` component | Resolve names in the resolver | 0 user lookups per load (R-06, T-03). Removes `read:jira-user` |
| D-08 | v1 records are migrated lazily and kept read only | Bulk migration | No bulk job, no data loss. The v1 key stays as evidence |
| D-09 | Licence inactive: write resolvers refuse, validator blocks with a licence message | Validator allows when unlicensed | Approved in B-09 criterion 4. Risk: a lapsed licence blocks every gated Done move until the admin removes the validator. The message says so |
| D-10 | Keep `write:jira-work`; add granular workflow read scopes | Drop the property to satisfy the grader rule | The property is the integration channel (audit 5.2). The grader rule targets read-only apps. Granular Beta scopes are used before `manage:jira-configuration` |
| D-11 | Templates keyed by project id and issue type id; built-in templates are matched on whole words | Project key and type name (v1) | Keys change on rename. "Debug task" no longer gets the Bug template (DG-16) |
| D-12 | Coverage check reads workflows as the user, read only, and identifies the rule by the module key `definitionguard-workflow-validator` in the rule parameters | Write the validator onto workflows | There is no supported API to attach it (N-05, H11). How a Forge validator rule looks in `/workflows/search` is Inferred: no workflow on the site has one (L-01) |
