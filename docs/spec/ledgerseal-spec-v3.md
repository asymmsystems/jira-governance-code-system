# LedgerSeal: Technical Specification v3

- **Product:** LedgerSeal, a tamper-evident approval seal and transition gate for Jira Cloud
- **Platform:** Atlassian Forge, UI Kit issue panel, `jira:workflowValidator`, product event trigger
- **Version:** 3.0.0 (canonical form 2.2.0, attestation schema 3)
- **Status:** v2 plus the readiness fixes of 2026-11-06 (`docs/sdlc/suite-readiness-review-2026-11/ledgerseal-readiness.md`, `docs/sdlc/ledgerseal-marketplace-fixes-2026-11/progress-log.md`) and ADR-011 (`architecture/decision/adr-00011-ledgerseal-personal-data.org`)
- **Supersedes:** `docs/spec/ledgerseal-spec-v2.md` (frozen, md5 `7d52d65f1da9adc3dff9e33077f3d31a`); v1 `docs/spec/ledgerseal-spec.md` (frozen)
- **Sources:** source IDs (REG, NJ, JAC, FG, MP, T) refer to `docs/sdlc/ledgerseal-usp-ux-research-2026-11/research-brief.md` section 9.

---

## 1. Executive Summary

LedgerSeal lets a permitted approver seal a Jira issue. A seal records a SHA-256 hash of a published canonical form of the issue's covered fields, comments and attachments, the signer (as a pseudonymous party token, ADR-011), the time, the meaning and the declaration text the signer agreed to.

After that, LedgerSeal:
- shows which covered fields changed, with the old value, the new value, who changed them and when;
- keeps every seal, change incident, reseal and revoke in a hash-chained history that a reseal cannot hide;
- requires a different approver to approve changes they did not make;
- blocks a workflow transition, when an admin adds the validator, until the issue is sealed and unchanged;
- publishes an Ed25519-signed summary in the `ledgerseal-cert` issue property, so other tools and auditors can check it with a public key;
- exports the evidence, and an open verifier rechecks it without access to the app.

LedgerSeal is tamper-evident, not tamper-proof. It does not lock issues. Where a status lock fits, admins should also set `jira.issue.editable=false` (NJ-01). LedgerSeal does not provide 21 CFR Part 11 electronic signatures by itself. It does not perform the two-component signing of 11.200 (REG-24). This specification makes no compliance claim. `research-brief.md` section 6.3 lists the wording the product may use.

---

## 2. Core Architectural Invariants

Each invariant names the tests that prove it.

1. **Trusted storage.** The panel and the validator decide only from app storage (KVS), which only the app can read and write (FG-12). The `ledgerseal-cert` property is an output. It is never an input (NJ-30).
2. **Identity from context.** The signer, resealer, revoker and viewer come only from Forge context (`context.accountId`). Payload identity fields are ignored. A call with no account id fails with `NO_IDENTITY` and writes nothing.
3. **A read does not write.** Opening the panel on an issue whose live hash equals the sealed hash, or equals the last recorded incident hash, makes no KVS write and no property write.
4. **One incident per distinct change.** A change incident is recorded only when the live hash differs from both the sealed hash and the last incident hash.
5. **History is append-only and chained.** Each history entry is created once (`keyPolicy: FAIL_IF_EXISTS`) and holds the hash of the previous entry. A reseal adds an entry. It never removes or rewrites one. `everCompromised` and `incidentCount` carry forward across reseals. The one exception is the recorded redaction event of ADR-011 decision 7: a record made before ADR-011 is converted once, its earlier entries get party tokens and new hashes, and an `LS_REDACTED` entry records the head hash before it.
6. **Separation of duties.** A user who changed covered content since the last seal (a change log item of a covered field, a comment or work log they added or edited, an attachment they added) cannot approve the change, revoke the seal, or seal again after a revoke. Changes to excluded fields (status, Rank, Sprint) do not count. A deleted comment or work log names no author in Jira and is not attributed.
7. **Authority.** Only a user with the approver permission (decision D-1) can seal, reseal or revoke.
8. **Honest failure.** When Jira cannot be read, LedgerSeal says so. It never reports "not sealed" or a field change because of a read failure, and it writes nothing.
9. **What is signed is what was shown.** The stored declaration text and version equal the text shown on the seal form.
10. **Deterministic canonical form.** Equal content gives an equal hash on any Node runtime. Section 4 defines the form. Its test vectors live in `tools/verifier/vectors.json` (2.0.0, checked by `test/canonical-v2.test.ts`) and `apps/ledgerseal/test/fixtures/vectors-2.2.0.json` (checked by `test/canonical-v22.test.ts`).
11. **Least privilege, stated honestly.** The app uses the scopes in section 5 and says why it needs each one.
12. **No personal data in hashed records or in the property (ADR-011).** Hashed records hold party tokens, never account ids or names. The token-to-account map is one key per account; a closed account's key is deleted. The `ledgerseal-cert` property holds no account id.
13. **What was seen is what is sealed (F-05).** The panel sends the hash of the issue it showed (`viewHash`); a seal is refused with `ISSUE_CHANGED` when the issue changed since.

Removed from v1: the v1 "if and only if" hash invariant (false, T-03), "never modified in place" (false in v1, LS-06), "only `read:jira-work` and `storage:app`" (false, the app needs to write its property), and the "32 KB per entry" storage rule (the KVS limit is 240 KiB, FG-07).

---

## 3. Domain Model

### 3.1 Canonical snapshot (`CanonicalSnapshot`, `src/domain/models.ts`)

```typescript
interface CanonicalField {
  id: string;        // Jira field id, for example "summary" or "customfield_10042"
  name: string;      // Jira display name from /rest/api/3/field (not hashed)
  value: unknown;    // canonical value (section 4), hashed
  display: string;   // human text for the change list (not hashed)
}
interface CanonicalAttachment { id: string; filename: string; size: number; mimeType: string; created: string; authorAccountId: string; }
interface CanonicalComment { id: string; authorAccountId: string; created: string; body: unknown; }
interface CanonicalSnapshot {
  canonicalizerVersion: '2.0.0' | '2.1.0' | '2.2.0';
  issueId: string;
  issueKey: string;
  fields: CanonicalField[];          // sorted by id
  attachments: CanonicalAttachment[]; // sorted by id
  comments: CanonicalComment[];       // sorted by id
  excluded: { id: string; name: string; reason: string }[];
  statusAtCapture: string;            // recorded, not hashed (D-2)
}
```

### 3.2 Silverston WorkEffort model (D-10, ADR-01)

The stored model follows the Silverston WorkEffort, Party and Status patterns, with names taken from the Apache OFBiz entity definitions (`docs/sdlc/ledgerseal-usp-ux-research-2026-11/adr-01-silverston-data-model.md`). Jira-owned issue fields are not stored; only LedgerSeal's own facts are.

```typescript
type LedgerSealStatusId = 'LS_SEALED' | 'LS_CHANGED' | 'LS_REVOKED';         // StatusItem, StatusType LEDGERSEAL_STATUS
type LedgerSealRoleTypeId = 'LS_APPROVER' | 'LS_REVIEWER' | 'LS_VERIFIER';  // RoleType = the meaning of the signature

interface SealedWorkEffort {            // WorkEffort, one per issue
  schemaVersion: 3;
  workEffortId: string;                 // Jira issue id
  workEffortTypeId: 'JIRA_ISSUE';
  sourceReferenceId: string;            // Jira issue key
  currentStatusId: LedgerSealStatusId;
  lastStatusUpdate: string;
  revisionNumber: number;               // seq of the newest status row
  statusHead: { seq: number; entryHash: string };
  currentAssignment: { partyId: string; roleTypeId: LedgerSealRoleTypeId; fromDate: string; assignmentHash: string; sealingSeq: number; sealingEntryHash: string };
  currentContentId: string;             // the certificate id: the sealed snapshot content
  attributes: { snapshotHash: string; canonicalizerVersion: string; declarationVersion: string; statusAtSeal: string; snapshotParts: number; parties?: 'TOKEN' }; // WorkEffortAttribute; parties: people are party tokens
  everCompromised: boolean;             // derived from status rows, kept as a current value
  incidentCount: number;                // derived from status rows, kept as a current value
  lastIncidentHash: string | null;      // live hash of the newest LS_CHANGED row of the current seal
  recordHash: string;                   // SHA-256 of the canonical JSON of every other field
}

interface WorkEffortPartyAssignment {   // one per seal
  workEffortId: string;
  partyId: string;                      // party token (ADR-011); records before ADR-011 held an account id until converted
  roleTypeId: LedgerSealRoleTypeId;
  fromDate: string;                     // seal time
  thruDate: string | null;              // set when a reseal or a revoke ends this seal
  comments: string | null;              // reseal reason
  contentId: string;
  declaration: { version: string; text: string };
}

interface WorkEffortStatus {            // one per state change, created once (history)
  workEffortId: string;
  statusId: LedgerSealStatusId;
  statusDatetime: string;
  setByPartyId: string | null;          // null when the app found the change
  reason: string | null;
  transitionName: 'SEAL' | 'RESEAL' | 'CHANGE' | 'REVOKE';
  seq: number;                          // LedgerSeal extension: chain position
  data: Record<string, unknown>;        // hashes, changed fields; no name (ADR-011)
  prevEntryHash: string;                // LedgerSeal extension (A-4)
  entryHash: string;                    // LedgerSeal extension (A-4)
}
```

Allowed state changes (`StatusValidChange`, `src/domain/status.ts`):

| From | To | transitionName |
|---|---|---|
| (none) | `LS_SEALED` | `SEAL` |
| `LS_SEALED` | `LS_SEALED` | `RESEAL` |
| `LS_SEALED` | `LS_CHANGED` | `CHANGE` |
| `LS_SEALED` | `LS_REVOKED` | `REVOKE` |
| `LS_CHANGED` | `LS_CHANGED` | `CHANGE` |
| `LS_CHANGED` | `LS_SEALED` | `RESEAL` |
| `LS_CHANGED` | `LS_REVOKED` | `REVOKE` |
| `LS_REVOKED` | `LS_SEALED` | `RESEAL` |

"Changed back" is derived, not stored: the current status is `LS_CHANGED` and the live hash equals the sealed hash.

### 3.3 Integrity bindings

`recordHash` covers the work effort. The work effort holds the hash of the current assignment and of the status row that sealed it, and the snapshot hash of the content. So a rewrite of any of them fails the check on read (B-08).

### 3.4 Panel data (resolver to UI)

`verify-issue-api` returns `PanelData`. It never holds the snapshot or an email (NF-03, LS-17). Its size budget is 16 KiB for the combined fixture of `ux-spec.md` section 3.

```typescript
type PanelState = 'NOT_SEALED' | 'SEALED' | 'CHANGED' | 'CHANGED_BACK' | 'REVOKED' | 'RECORD_INVALID' | 'LEGACY' | 'ERROR' | 'LICENSE_INACTIVE';
interface PanelData {
  state: PanelState;
  errorReason?: 'JIRA_UNREACHABLE' | 'STORAGE' | 'UNKNOWN';
  seal?: { certificateId; sealedAt; sealedByAccountId; sealedByClosed?; meaning; reason; declarationVersion; snapshotHash; canonicalizerVersion; everCompromised; incidentCount; revocation };   // sealedByAccountId resolved from the party token; empty for a closed account
  viewHash: string;                   // F-05
  signing: { signed: boolean; keyId: string | null };   // B5
  coveredFields: { id: string; name: string }[];
  excludedFields: { id: string; name: string; reason: string }[];
  changes: ChangeRow[];               // empty unless CHANGED
  rights: { canSeal: boolean; canApproveChanges: boolean; canRevoke: boolean; blockedBySelfChange: boolean };
  policyText: string;                 // who can seal
  declaration: { version: string; text: string };
}
interface ChangeRow { fieldId: string; fieldName: string; was: string; now: string; wasTruncated: boolean; nowTruncated: boolean; changedBy: string[]; changedAt: string | null; kind: 'FIELD' | 'COMMENT' | 'ATTACHMENT' }
```

---

## 4. Canonical Form v2 (`canonicalizerVersion` 2.2.0 for new seals; 2.0.0 and 2.1.0 still checked)

An outside verifier recomputes the hash of an exported snapshot. `verify-evidence.mjs` (https://github.com/asymmsystems/ledgerseal-verifier; copy in `tools/verifier`) does it with the Node standard library only.

### 4.1 Canonical JSON
- Objects: keys sorted by UTF-16 code unit order, at every level. No whitespace. Strings use `JSON.stringify` escaping. UTF-8 bytes.
- Numbers: finite numbers as `JSON.stringify` writes them. Non-finite numbers become `null`.
- The hash input is the canonical JSON of:
  `{ canonicalizerVersion, issueId, issueKey, projectId, issueTypeId, fields: [{ id, value }...], attachments, comments }`
  `projectId` and `issueTypeId` are the Jira ids (the key or the name when Jira gives no id). Field `name`, `display`, the excluded list, the project key, the issue type name and the status are not hashed, so renaming a field, a project or an issue type keeps the seal.
- `snapshotHash` = lowercase hex SHA-256 of those bytes.
- Versions. Each `canonicalizerVersion` has its own exclusion rules, and an old version's rules are never edited. A change to the covered or excluded set is a new version. New seals use the newest version. A seal is always checked with the rules of the version it records: the live issue is canonicalised again under that version before the hashes are compared. A version the app does not know gives `RECORD_INVALID`, never a guess.
  - 2.0.0: the rules in 4.2 without the rows marked "since 2.1.0". Resolution is covered there.
  - 2.1.0: all rules in 4.2.
  - 2.2.0 (ADR-011, F-07): the rules of 2.1.0, with two changes. (1) People are party tokens: before canonicalisation every user object becomes `{ accountId: <token>, displayName: <token> }` and a mention keeps the token as `attrs.id` and `attrs.text`. A token is `pty_` and the first 32 hex characters of HMAC-SHA-256 over the account id, keyed with the site key `ls3:partykey`. (2) An object with an `id` becomes `{ id }` (plus `child`) only in a reference field: the system fields priority, issuetype, project, resolution, security, components, fixVersions, versions, parent, subtasks, status, statusCategory, and fields whose schema type (or array item type) is option, option-with-child, priority, version, component, project, issuetype, resolution, securitylevel, issuelink, issuelinks, status, statuscategory, team or sd-customerorganization. Every other object is hashed in full (without `self`, `avatarUrls`, `iconUrl`).
  - A 2.0.0 or 2.1.0 seal marked `attributes.parties: "TOKEN"` (converted, ADR-011 decision 7) is compared with the live issue tokenised as in 2.2.0 (1).
  - Value shapes (4.3 to 4.5) are otherwise the same in every version.

### 4.2 Field selection (LS-04, LS-05)
Fields are chosen by schema, from `/rest/api/3/field` (`schema.system`, `schema.custom`), never by id or by value.

Excluded, with the reason shown in the panel:

| Field | Reason |
|---|---|
| `status`, `statuscategorychangedate` | The gated transition itself changes the status (D-2). The status at seal is recorded |
| `updated`, `lastViewed`, `created` | Timestamps that Jira sets itself |
| `watches`, `votes` | Interest counters, not content |
| `workratio`, `progress`, `aggregateprogress`, `timespent`, `aggregatetimespent`, `timeestimate`, `aggregatetimeestimate`, `aggregatetimeoriginalestimate` | Derived from work logs or sub-tasks |
| `resolutiondate` (2.0.0) | Set together with Resolution, which is covered |
| `resolution`, `resolutiondate` (since 2.1.0) | The gated transition sets the resolution (NF-05, seen live on LSP-1). The status at seal is recorded. A manual resolution change stays in Jira's change log |
| `comment`, `attachment` | Covered separately (sections 4.4 and 4.5) |
| custom type `com.pyxis.greenhopper.jira:gh-lexo-rank` | Rank changes on every board drag |
| custom type `com.pyxis.greenhopper.jira:gh-sprint` | Sprint changes when a sprint closes |
| custom types `com.atlassian.servicedesk:sd-sla-field` | SLA timers change by themselves |
| custom types `com.atlassian.servicedesk:sd-request-feedback`, `com.atlassian.servicedesk:sd-request-feedback-date` | Customer satisfaction is not request content |
| custom type `com.atlassian.servicedesk:sd-request-participants` | Participants change as people join |
| custom type `com.atlassian.servicedesk.approvals-plugin:sd-approvals` | Approvals change as approvers decide |
| custom type `com.atlassian.jira.plugins.jira-development-integration-plugin:devsummarycf` | Development summary changes with commits |
| custom type `com.atlassian.jira.ext.charting:timeinstatus`, `com.atlassian.jira.ext.charting:firstresponsedate` | Computed by Jira |
| custom type `com.atlassian.servicedesk.sentiment:sd-sentiment`, `com.atlassian.jira.plugin.system.customfieldtypes:agent-sessions`, and the `com.atlassian.jira.plugins.proforma-managed-fields` counts `forms-total-field-cftype`, `forms-submitted-field-cftype`, `forms-locked-field-cftype`, `forms-open-field-cftype` (NF-04, seen live on DEMO; since 2.1.0) | Computed by Jira. The forms list `proforma-forms-field-cftype` stays covered |

Every other field with a value is covered, including reporter, issue type, project, parent, worklog, time tracking (original estimate), security level and all other custom fields. A field id that is not in the field list is covered, with its id as its name.

### 4.3 Values
| Shape | Canonical value | Display |
|---|---|---|
| Absent, `null`, `""`, `[]`, `{}` | field omitted | n/a |
| String | as is, with `\r\n` and `\r` turned into `\n`. No trim, and a string of spaces is kept (LS-11) | the string |
| Date-time string (ISO-8601 with offset or `Z`) | UTC ISO-8601 with milliseconds (`toISOString`) | the original |
| Date string `YYYY-MM-DD` | as is | as is |
| Number, boolean | as is | `String(value)` |
| User (object with `accountId`) | `{ "accountId": "..." }` (LS-22) | `displayName` or the account id |
| Option, priority, issue type, resolution, security level, version, component, project, status category (object with `id`) | `{ "id": "..." }`; a cascading option adds `child: { id }` | `name` or `value` |
| Issue reference (`parent`, sub-task, linked issue) | `{ "id": "..." }` | `key` |
| Issue links | `{ type: id, direction: "inward" or "outward", issue: id }` | `type outward/inward KEY` |
| Atlassian Document Format | order kept; `localId` removed; text nodes normalised like strings | plain text of the document |
| Time tracking | `{ originalEstimateSeconds }` only | for example "8h" |
| Work log | each entry `{ id, authorAccountId, started (UTC), timeSpentSeconds, comment }` | "n work log entries" |
| Array | elements canonicalised, empty elements dropped. Sorted by their JSON only for a set: the fields `labels`, `components`, `fixVersions`, `versions`, `issuelinks` and `subtasks`, and any field whose schema has `type: array` with `items` `option`, `user`, `group`, `version` or `component`. Every other array keeps its order (LS-11) | elements joined by ", ", sorted for a set |
| Other object | keys sorted, each value canonicalised; `self`, `avatarUrls` and `iconUrl` are dropped | short JSON |

### 4.4 Comments
All comments come from `/rest/api/3/issue/{id}/comment`, paged by 100 (LS-15). Each is `{ id, authorAccountId, created (UTC), body (ADF, section 4.3) }`, sorted by id. An edit changes `body` and so breaks the seal.

### 4.5 Attachments
Each is `{ id, filename, size, mimeType, created (UTC), authorAccountId }`, sorted by id. Content is not hashed. Jira gives a replaced file a new id.

### 4.6 Test vectors
`tools/verifier/vectors.json` holds 10 vectors for 2.0.0; `apps/ledgerseal/test/fixtures/vectors-2.2.0.json` holds 5 hand-written vectors for 2.2.0, each with its party table. Each gives the issue fields and the canonical text written by hand from this section; the hash is the SHA-256 of that text. `test/canonical-v2.test.ts` checks the code against them, and the open verifier (section 11) checks itself against them.

---

## 5. Forge App Modules and Manifest

```yaml
modules:
  jira:issuePanel:      ledgerseal-panel (UI Kit, native, resource main, icon resource:icons;icon.svg)
  jira:workflowValidator: ledgerseal-validator, function validate-transition
  jira:entityProperty:  ledgerseal-cert-index on issue property ledgerseal-cert
                        status (string, alias ledgersealStatus), everCompromised (string, alias ledgersealEverCompromised),
                        incidentCount (number, alias ledgersealIncidents)
  jira:adminPage:       ledgerseal-admin (UI Kit, native, resource admin)
  trigger:              ledgerseal-issue-changed on avi:jira:updated:issue, avi:jira:commented:issue,
                        avi:jira:created:attachment, avi:jira:deleted:attachment, avi:jira:created:worklog,
                        avi:jira:updated:worklog, avi:jira:deleted:worklog -> function on-issue-changed
                        ledgerseal-issue-deleted on avi:jira:deleted:issue -> function on-issue-deleted
  scheduledTrigger:     ledgerseal-personal-data-report, weekly -> function personal-data-report (timeoutSeconds 300)
  function:             resolver, validate-transition, on-issue-changed, on-issue-deleted, personal-data-report
resources:              main (src/frontend/index.tsx), admin (src/frontend/admin.tsx), icons (static/icons)
app:
  runtime: nodejs22.x
  licensing: { enabled: true }
permissions:
  scopes: read:jira-work, write:jira-work, read:jira-user, storage:app, report:personal-data
```

| Scope | Why |
|---|---|
| `read:jira-work` | Read the issue, comments, change log, field list and the user's own permissions |
| `write:jira-work` | Write the app's own `ledgerseal-cert` issue property. The app never edits issue fields |
| `read:jira-user` | Read display names to show who changed an item (never stored), the caller's groups, groups for the admin page |
| `storage:app` | Keep seal records, history and the token-to-account map in KVS |
| `report:personal-data` | Weekly personal data report and erasure of closed accounts (ADR-011) |

**Grader conflict (recorded, not changed).** `loop-engine/graders/grade_security.py` passes with these scopes, and v1 claimed "only `read:jira-work` and `storage:app`". The app cannot publish its property without `write:jira-work` (FG-27). LedgerSeal keeps the scope and states it.

Trigger events can arrive up to 3 minutes late (Forge trigger module page). The validator therefore checks the live issue itself at every transition and never relies on the trigger alone.

---

## 6. Storage Schema (Forge KVS)

| Key | Value | Largest value |
|---|---|---|
| `ls3:we:{issueId}` | `SealedWorkEffort` | under 4 KiB |
| `ls3:wes:{issueId}:{seq}` (`seq` zero-padded to 6 digits) | `WorkEffortStatus`, created once | under 8 KiB (at most 50 changed field names) |
| `ls3:wepa:{issueId}:{fromDate}` | `WorkEffortPartyAssignment` | under 2 KiB |
| `ls3:content:{contentId}:{part}` | part `part` (0-based) of the canonical snapshot JSON string, with its covered and excluded field lists | 120,000 UTF-8 bytes |
| `ls3:partyrole:LS_APPROVER` | `ApproverPolicy`: the approver groups as party role (section 7.1) | under 4 KiB (at most 20 groups) |
| `ls3:partykey` | the site key of the party tokens | under 1 KiB |
| `ls3:party:{token}` | `{ accountId, updatedAt }`, deleted on account closure | under 1 KiB |
| `ls3:convert:{issueId}` | journal of a running conversion (ADR-011 decision 7) | under 4 KiB |
| `cert:active:{issueId}` (v1) | legacy certificate, read only; its personal data is replaced by a stub `{ schemaVersion, legacy, personalDataRemovedAt }` | not written otherwise |

The `ls2:` layout of B-02 to B-11 was never deployed and is not read.

- KVS value limit: 240 KiB (FG-07). A part is at most 120,000 UTF-8 bytes as stored, counting the JSON escaping of the stored string, so every part stays under half the limit (B-17). A split never cuts a character.
- A seal claims its status row first and then commits the rest. If that commit fails, the app removes the claimed row, so the next writer is not blocked by an orphan row.
- A seal or reseal writes its snapshot parts, its assignments and the work effort in one `kvs.transact()` of at most 25 operations (FG-08). A snapshot over 22 parts (about 2.6 MB) fails with `SNAPSHOT_TOO_LARGE` before anything is written.
- Concurrency: every write that changes the seal record first creates history entry `head.seq + 1` with `FAIL_IF_EXISTS`. If the key exists, another writer won, and the call returns `CONFLICT` (B-17).
- Measured sizes (T-01, after Part B) are in `ux-spec.md` section 3, column "After".
- **Migration (D-3):** a v1 record is read as `LEGACY`. The app never writes or deletes v1 keys. A reseal writes a `ls3:` work effort, and from then on it wins.

---

## 7. Seal, reseal, revoke and incidents

### 7.1 Approver policy (D-1)
- A user may seal, reseal and revoke if `GET /rest/api/3/mypermissions?issueId={id}&permissions=ADMINISTER_PROJECTS,ADMINISTER`, called `asUser()`, reports either permission (FG-35, FG-36).
- Why not a project role: `GET /rest/api/3/project/{key}/roledetails` requires the caller to have Administer Jira or Administer projects (Jira REST v3 docs, read 2026-11-01). So an approver cannot check their own role membership through it. The approved D-1 rule falls back to option (c).
- Approver groups (option (b) of D-1, added 2026-11-01 on owner instruction). A Jira admin chooses up to 20 groups on the LedgerSeal admin page (`jira:adminPage` `ledgerseal-admin`). Members of those groups may also seal, reseal and revoke.
  - Only a Jira admin (`mypermissions?permissions=ADMINISTER`, as user) may read, search or change the groups, or gets `NOT_ADMIN`.
  - The payload gives group ids only. Each id must exist in Jira (`/rest/api/3/group/bulk`, as user), and the stored name is Jira's. The admin comes from context.
  - Stored as the Silverston party role `LS_APPROVER` with group parties, `fromDate` and `setByPartyId` (key `ls3:partyrole:LS_APPROVER`).
  - The check: project or Jira admin first. Only when that fails and a policy names groups, the caller's groups are read (`/rest/api/3/myself?expand=groups`, as user). A failed read fails closed with `JIRA_UNREACHABLE`.
  - No new scope: these reads use `read:jira-work` and `read:jira-user`.
- The panel says: "Who can seal: project admins and Jira admins." With groups: "Who can seal: project admins, Jira admins and members of {names}."

### 7.2 Separation of duties (B-01)
The authors of a change since the seal are: authors of change log entries (`/rest/api/3/issue/{id}/changelog`, read once per invocation) after `sealedAt` with at least one item of a field the seal's canonical form covers (an entry with no readable item counts); users who added a comment or work log after `sealedAt`, or edited one after it (`updateAuthor`); users who added an attachment after it. A time that cannot be read counts as after. A deleted comment or work log has no author in Jira and is not attributed.
- An approve (reseal after a change) by such a user fails with `SELF_APPROVAL`, and the panel offers no Approve button.
- A revoke by such a user fails with `SELF_APPROVAL` ("You changed this issue after it was sealed, so another approver must revoke the seal."), and the panel offers no Revoke button.
- A seal after a revoke by such a user, counted from the `fromDate` of the revoked seal, fails with `SELF_APPROVAL`; a reason is required when the issue changed since that seal.
- A failed change log read fails closed (`JIRA_UNREACHABLE`; the panel gives no such right).

### 7.3 Seal and reseal contract (`seal-issue-api`)
Payload: `{ viewHash?, signature: { meaning, declarationVersion, declarationText, reason? } }`. Any other field is ignored. `meaning` defaults to `APPROVAL`. `viewHash` is the hash the panel received from `verify-issue-api` (the current canonical form of the live issue as Jira returned it); when given and different from the live issue, the seal fails with `ISSUE_CHANGED` and writes nothing.

Steps:
1. Identity from context, or `NO_IDENTITY`.
2. Licence check, or `LICENSE_INACTIVE`.
3. Permission check, or `NOT_APPROVER`.
4. Declaration check: version and text must equal `src/domain/declaration.ts`, or `DECLARATION_MISMATCH`.
5. Read the issue, comments, field list and work log, or `JIRA_UNREACHABLE` (nothing written).
6. If a seal exists and the issue changed: separation of duties (7.2) and a required reason (1 to 500 characters), or `REASON_REQUIRED`.
7. Canonicalise, hash, split into parts.
8. Create the next history entry (`SEALED` or `RESEALED`), or `CONFLICT`.
9. Transaction: snapshot parts and the new seal record. `everCompromised` and `incidentCount` carry forward.
10. Write the signed property (section 8).

Result: `{ ok: true, certificateId, sealedAt }` or `{ ok: false, code, message }`.

### 7.4 Incidents
- Verify, the validator and the trigger all use one function, `recordIncidentIfNew`.
- It writes an `INCIDENT` entry with `data: { liveHash, changes: [{ fieldId, fieldName, changedBy, changedAt }] (at most 50) }`. It sets `everCompromised: true`, increments `incidentCount`, sets `lastIncidentHash`, and writes the property once.
- `CHANGED_BACK`: the live hash equals the sealed hash, but the current seal has an incident. The gate stays closed until a reseal.

### 7.5 Revoke (`revoke-seal-api`)
Payload `{ reason }` (1 to 500 characters). Same identity, licence and permission checks, then separation of duties (7.2). A record from before ADR-011 is converted first. Writes a `REVOKED` entry, sets `state: REVOKED` and `revocation`, and writes the property.

### 7.6 History (`seal-history-api`)
Returns entries oldest first, 50 per page (`{ fromSeq }`), with a `chainValid` flag computed over the returned page and the head.

---

## 8. Attestation: `ledgerseal-cert` property (schema 3)

```json
{
  "schemaVersion": 3,
  "issueId": "10042",
  "status": "SEAL_VALID | SEAL_BROKEN | SEAL_COMPROMISED | SEAL_REVOKED",
  "certificateId": "uuid",
  "snapshotHash": "64 hex",
  "canonicalizerVersion": "2.1.0",
  "sealedAt": "ISO-8601 UTC",
  "everCompromised": "true | false",
  "incidentCount": 2,
  "issuedAt": "ISO-8601 UTC",
  "keyId": "ls-dev-2026-11",
  "sig": "base64 Ed25519 over the canonical JSON of every other field"
}
```

- `everCompromised` is a string, because the entity property index types are number, text, string, user and date (Forge `jira:entityProperty` page).
- **Key handling:**
  - The private key is a PKCS#8 DER key, base64-encoded, in the Forge encrypted variable `LEDGERSEAL_SIGNING_KEY`. The key id is in `LEDGERSEAL_KEY_ID`.
  - It is generated outside the repo and set with `forge variables set --encrypt` (FG-31). It is never printed, logged or committed.
  - Public keys live in `apps/ledgerseal/keys/{keyId}.pub.pem` and are committed.
  - If no key is configured, the property is written without `sig` and `keyId`, each write logs that it is unsigned, the panel shows a warning, and the evidence export has a `warning` field. Consumers must treat it as unverified.
- Schema 3 has no account id (ADR-011 decision 8). Its other fields keep the names and types of schema 2, so FourRealities and JQL read it unchanged.
- **Limit (stated in the listing):** the vendor holds the private key. A valid signature shows that LedgerSeal wrote the record. It does not protect against the vendor (audit section 5.5).
- Writes happen on seal, reseal, revoke and each new incident only.

---

## 9. Workflow Validator

The payload carries `issue` (`id`, `key`), `modifiedFields`, `transition` (`from`, `to`), `user` and `context` (shape seen live on 2026-11-06; no licence object on a development install). `modifiedFields` is read at the top level and under `transition`; the top level wins. Its values are applied over the live fields before canonicalisation, except `comment`, `attachment` and `worklog`: a non-empty transition comment is added as a new comment ("Comment added"), never replacing the list. Values from the screen record no incident.

| Case | `result` | `errorMessage` |
|---|---|---|
| Live issue cannot be read | false | "LedgerSeal could not read the issue from Jira, so this transition is blocked. Try again in a minute." |
| No seal | false | "LedgerSeal: this issue is not sealed. To proceed: open the LedgerSeal panel on this issue, select your sign-off role, agree to the declaration, and click \"Seal this issue\"." |
| v1 seal only | false | "LedgerSeal: this issue has an old-format seal. Ask a project admin to seal it again in the LedgerSeal panel." |
| Record fails its integrity check | false | "LedgerSeal: the seal record failed its integrity check. Contact your Jira admin." |
| Revoked | false | "LedgerSeal: the seal was revoked on {date} (reason: {reason}). Seal it again to continue." |
| Changed | false | "LedgerSeal: {n} fields changed after approval ({first 5 names}{, and m more}). Ask a project admin who did not make the change to approve it in the LedgerSeal panel." |
| Changed back | false | "LedgerSeal: this issue changed after approval and was changed back. Ask a project admin to approve it again in the LedgerSeal panel." |
| Sealed and unchanged | true | none |

Every message is at most 250 characters. The validator writes only through `recordIncidentIfNew`. The licence state does not change the result (D-8), but when Forge reports an inactive licence a blocked transition says: "LedgerSeal: the LedgerSeal licence is not active, so this issue cannot be sealed or approved. Ask your Jira admin to renew the licence or to remove the Require Valid LedgerSeal validator from this workflow." (F-08)

---

## 10. Declaration

`src/domain/declaration.ts` holds the only copy:

- version `1`: "I approve this issue as it is now. I agree that this seal records my approval of its covered fields, comments and attachments."

The seal form shows this exact text with "(Declaration v1)". The record stores the text and the version. A new text gets a new version. Old records keep theirs.

---

## 11. Evidence export and open verifier

- `seal-evidence-api` returns `{ format: "ledgerseal-evidence/1", attestation, publicKeyId, snapshot (canonical form), history, parties, verification, warning? }`. `parties` maps each party token of the history to its account id, or null for a closed account; it is not signed. The size limit is 5 MB (FG-04).
- `verify-evidence.mjs <file> [publicKey.pem]` (https://github.com/asymmsystems/ledgerseal-verifier, Apache-2.0, release v1.2.0; identical copy in `tools/verifier`) uses the Node standard library only. It checks five things:
  1. the snapshot hash against the attestation;
  2. the history chain;
  3. that the attestation's certificate id matches the head of the history;
  4. that the attestation's status is the state of the newest entry that is not `LS_REDACTED` (release v1.2.0);
  5. the Ed25519 signature.

  It exits 0 when every check passes, 1 when one fails and 2 for a usage error or a missing file. It prints a NOTE for each `LS_REDACTED` entry and for the `parties` map.
- PDF export is out of scope. It would need a new dependency.

---

## 12. Quality Gates

- `tsc --noEmit` passes. `jest --coverage` passes with at least 90% branch coverage per changed file, `src/frontend/view-model.ts` included.
- Each T-02 scenario in `~/.cache/gemini-earning-ledgerseal-research/probes/` meets its "after" expectation in `round-log.md`.
- No production code reads `process.env.NODE_ENV`.
- `forge lint` reports no error.

---

## 13. Decisions

| ID | Decision | Options considered | Choice and reason |
|---|---|---|---|
| D-1 | Approver policy source | (a) project role "LedgerSeal Approvers"; (b) group on a settings page; (c) Jira project permission | (c) `ADMINISTER_PROJECTS` or `ADMINISTER`, as user. (a) cannot work: the role API needs project admin rights from the caller. (b) needs a new module and storage for settings; deferred |
| D-2 | Status in the hash | (a) recorded, not hashed; (b) hashed | (a). The gated transition changes the status itself, so (b) would break every seal at the gate |
| D-3 | v1 records | (a) read as legacy; (b) migrate in place | (a). No write to old records, so no data is lost, and the gate stays closed until a v2 seal |
| D-4 | Where change authors come from | (a) change log REST at check time; (b) only the trigger payload | (a) for verify and the validator, because triggers can be 3 minutes late; (b) is not needed |
| D-5 | Snapshot storage | (a) one value; (b) parts by UTF-8 size; (c) Forge SQL | (b). It keeps KVS, needs no new module, and fits the 25-operation transaction |
| D-6 | Signature scheme | (a) HMAC; (b) Ed25519; (c) RSA | (b). An auditor verifies with a public key and no secret (REG-99, REG-102). Node `crypto` has it built in, so no dependency |
| D-7 | Evidence format | (a) JSON plus a stand-alone verifier; (b) PDF | (a). No new dependency, and the verifier can recompute the hash. A PDF cannot |
| D-8 | Licence and the validator | (a) block when unlicensed; (b) do not change the gate result | (b). A lapsed licence must not stop a customer's releases; the panel shows the licence state |
| D-9 | Field list per call | (a) fetch `/field` once per invocation; (b) cache in KVS | (a). A KVS cache write during a panel view would break invariant 3 |
| D-11 | Personal data in hashed records | (a) redact on closure; (b) per-account random token; (c) keyed token | (c), ADR-011, adopted on the owner's instruction 'do NOW' (2026-11-06) |
| D-10 | Data model | (a) Silverston WorkEffort, Party and Status patterns (ADR-01); (b) the B-02 event-history records | (a), owner approved 2026-11-01. One vocabulary with CascadePlan; an explicit state-change table; no v2 data existed to migrate |
