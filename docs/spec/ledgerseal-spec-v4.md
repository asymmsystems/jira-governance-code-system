# LedgerSeal: Technical Specification v4

- **Product:** LedgerSeal, a tamper-evident approval seal and transition gate for Jira Cloud
- **Platform:** Atlassian Forge, UI Kit issue panel, `jira:workflowValidator`, product event trigger
- **Version:** 4 (canonical form 2.3.0, attestation schema 4 for routed issues, evidence format `ledgerseal-evidence/2`, open verifier 1.5.0)
- **Status:** v3 plus the regulated features accepted by the owner on 2026-11-08: ADR-016 Part 11 signing (`architecture/decision/adr-00016-ledgerseal-part11-signing-credential.org`), ADR-017 approval routes (`adr-00017-ledgerseal-approval-routes.org`), ADR-018 signing on the transition screen (`adr-00018-ledgerseal-sign-on-transition.org`). Sections 14 to 18 are new; sections 1, 2, 5, 6, 8 to 11 and 13 name what changed. Build log: `docs/sdlc/ledgerseal-regulated-2026-11/`.
- **Supersedes:** `docs/spec/ledgerseal-spec-v3.md` (frozen, md5 `b922d63b4cfbdc356129ffe459bd975e`) and the draft delta `docs/spec/ledgerseal-spec-v4-draft.md` (frozen, md5 `85eb9e70b09c22af03be54a4842939eb`); v2 `docs/spec/ledgerseal-spec-v2.md` (frozen, md5 `7d52d65f1da9adc3dff9e33077f3d31a`); v1 `docs/spec/ledgerseal-spec.md` (frozen)
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

LedgerSeal is tamper-evident, not tamper-proof. It does not lock issues. Where a status lock fits, admins should also set `jira.issue.editable=false` (NJ-01). LedgerSeal does not provide 21 CFR Part 11 electronic signatures by itself. It does not perform the two-component signing of 11.200 (REG-24), except in Part 11 signing mode (section 14), where each signature also needs a single-use code that LedgerSeal emails to the signer's own Atlassian account; section 17 states what that meets. Approval routes (section 15) add ordered stages with quorum and separation of duties, and the signature field (section 16) lets a person sign on the transition screen. This specification makes no compliance claim. `research-brief.md` section 6.3 lists the wording the product may use.

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
12. **No personal data in hashed records or in the property (ADR-011).** Hashed records hold party tokens, never account ids or names. The token-to-account map is one key per account; on closure the key keeps only a closed mark `{ closed, closedAt }` with no account id, and that token is never mapped again. The `ledgerseal-cert` property holds no account id.
13. **What was seen is what is sealed (F-05).** The panel sends the hash of the issue it showed (`viewHash`); a seal is refused with `ISSUE_CHANGED` when the issue changed since.
14. **A code at every Part 11 signing.** In a Part 11 project no signature, revoke or rejection row is written unless a fresh single-use code, emailed to the signer's own Atlassian account for that issue and action, was verified in the same invocation (or in the intent it consumes, section 16), and each code is used once.
15. **No code leaves the app except in the email.** A code is never logged, returned, stored in clear, or put in a hashed row, the property or the evidence; only its keyed hash is stored, for at most a day.
16. **One person, one stage.** No party signs two stages of one run.
17. **Same content for every stage.** Every signature of a run signs the run's snapshot hash; a covered change voids the run.
18. **Format stability.** Evidence of an issue with no route and no Part 11 signature stays `ledgerseal-evidence/1` with the same bytes as v3.

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
  seal?: { certificateId; sealedAt; sealedByAccountId; sealedByClosed?; sealedByUnknown?; meaning; reason; declarationVersion; snapshotHash; canonicalizerVersion; everCompromised; incidentCount; revocation };   // sealedByAccountId resolved from the party token; empty for a closed account
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

An outside verifier recomputes the hash of an exported snapshot. `verify-evidence.mjs` (https://github.com/asymmsystems/jira-governance-code-cli; copy in `tools/verifier`) does it with the Node standard library only.

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

Restricted comments (F-06): the comments come from the app's own read, so a comment restricted to a project role or group the app user is not in is not returned by Jira and is not covered (seen live on LSP-5, 2026-11-06, with a comment restricted to the Administrators role). The snapshot records the restricted comments it covers in `restrictedComments` (`{ id, type, value }`, outside the hashed form). The panel shows a changed restricted comment's text only to a viewer whose own comment list (read as the user) contains it, otherwise "A restricted comment that you cannot see in Jira", with no author and no time (L-18); a removed restricted comment is never shown. `seal-evidence-api` reads the live comments as the app and answers `RESTRICTED_EVIDENCE` to a viewer who cannot see every sealed comment that is restricted at the seal or now (H-1). Decision (suite owner, 2026-11-06, H-2, fail closed): a sealed comment the app can no longer read (deleted, or restricted since to a role or group the app user is not in, which Jira does not return to the app) counts as possibly restricted for every seal: the panel shows its sealed text, author and time to no one, and the seal's evidence is refused to everyone. Cost: after a covered comment is deleted, that seal's evidence cannot be exported; approving the changes makes a new seal whose evidence can be exported (its history keeps the earlier rows). Restricted work logs (M-11, suite owner decision 2026-11-06, the same rule, fail closed): a covered work log's comment is in the hashed value of the `worklog` field, so the snapshot records the covered work logs restricted to a role or group in `restrictedWorklogs` (`{ id, type, value }`, outside the hashed form). `seal-evidence-api` reads the work logs as the app and answers `RESTRICTED_EVIDENCE` to everyone when a sealed work log is missing from that read (deleted, or restricted since to a role or group the app user is not in), and to a viewer whose own work log list (read as the user) does not contain a sealed work log that is restricted at the seal or now. The panel shows only the number of work logs ("N work log entries"), never their text, so it needs no masking. Cost: after a covered work log is deleted, that seal's evidence cannot be exported; approving the changes makes a new seal whose evidence can be exported.

### 4.5 Attachments
Each is `{ id, filename, size, mimeType, created (UTC), authorAccountId }`, sorted by id. Content is not hashed. Jira gives a replaced file a new id.

### 4.6 Test vectors
`tools/verifier/vectors.json` holds 10 vectors for 2.0.0; `apps/ledgerseal/test/fixtures/vectors-2.2.0.json` holds 5 hand-written vectors for 2.2.0, each with its party table. Each gives the issue fields and the canonical text written by hand from this section; the hash is the SHA-256 of that text. `test/canonical-v2.test.ts` checks the code against them, and the open verifier (section 11) checks itself against them.

---

## 5. Forge App Modules and Manifest

```yaml
modules:
  jira:issueContext:    ledgerseal-context (UI Kit, native, resource context; the seal state in the issue details column, F-12)
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
  scopes: read:jira-work, write:issue.property:jira, read:jira-user, storage:app, report:personal-data
```

| Scope | Why |
|---|---|
| `read:jira-work` | Read the issue, comments, change log, field list and the user's own permissions |
| `write:issue.property:jira` | Write the app's own `ledgerseal-cert` issue property; the granular scope replaces `write:jira-work` (F-20). The app never edits issue fields |
| `read:jira-user` | Read display names to show who changed an item (never stored), the caller's groups, groups for the admin page |
| `storage:app` | Keep seal records, history and the token-to-account map in KVS |
| `report:personal-data` | Weekly personal data report and erasure of closed accounts (ADR-011) |

**Grader conflict (recorded, not changed).** `loop-engine/graders/grade_security.py` passes with these scopes, and v1 claimed "only `read:jira-work` and `storage:app`". The app needs a write scope to publish its property (FG-27); since F-20 it uses the granular `write:issue.property:jira`, not `write:jira-work`, and states it.

Trigger events can arrive up to 3 minutes late (Forge trigger module page). The validator therefore checks the live issue itself at every transition and never relies on the trigger alone.

---

v4 adds (sections 14 to 16): `jira:customField` `ledgerseal-signature` (string; edit view on the transition screen), `jira:issueAction` `ledgerseal-sign-action`, the index path `approval.runState` (string, alias `ledgersealApproval`) on `ledgerseal-cert-index`, and the scope `send:notification:jira` (granular, Beta; used only to email the signer's own code, section 14.7).

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

v4 adds the key families of sections 14.5 (`ls3:sig:*`), 15.6 (`ls3:route*`) and 16.6 (`ls3:intent*`). `SealedWorkEffort` gains `run?` (section 15.6), and its size budget moves to under 16 KiB.

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
- **Schema 4** (section 15.4) is written only for an issue with a bound route: it adds `approval`, and before the first seal it has no `status` and no `certificateId`. Issues with no route keep schema 3. v4 also writes on each stage signature, rejection and run void.

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

v4 adds the stage-gate rows of section 15.5 and the signing-intent rows of section 16.4.

Every message is at most 250 characters. The validator writes only through `recordIncidentIfNew`. The licence state does not change the result (D-8), but when Forge reports an inactive licence a blocked transition says: "LedgerSeal: the LedgerSeal licence is not active, so this issue cannot be sealed or approved. Ask your Jira admin to renew the licence or to remove the Require Valid LedgerSeal validator from this workflow." (F-08)

---

## 10. Declaration

`src/domain/declaration.ts` holds the only copy:

- version `1`: "I approve this issue as it is now. I agree that this seal records my approval of its covered fields, comments and attachments."

The seal form shows this exact text with "(Declaration v1)". The record stores the text and the version. A new text gets a new version. Old records keep theirs.

- version `2` (Part 11 projects, section 14; **approved by the owner on 2026-11-08, Q-03, option A with the second sentence replaced**): "I am signing this record electronically. I understand that my organisation treats this electronic signature as the legally binding equivalent of my handwritten signature. I approve this issue as it is now, with the meaning shown above, and I agree that this signature records my approval of its covered fields, comments and attachments." Why the second sentence changed: under 21 CFR 11.100(c) the customer organisation certifies to FDA that its staff's electronic signatures are legally binding; the app cannot assert it, so the text states the signer's understanding.
- `src/domain/declaration.ts` holds version 2 with `approved: true` (since 2026-11-08). The gate stays for later versions: while a version's flag is false, `signing-policy-set-api` refuses to turn the mode on (`DECLARATION_PENDING`) and no Part 11 signature can be made.
- Version 2's text was never in a record before its approval: the mode could not be turned on, so no seal holds the earlier draft. The version number therefore stays `2`.

---

## 11. Evidence export and open verifier

- `seal-evidence-api` returns `{ format: "ledgerseal-evidence/1", attestation, publicKeyId, snapshot (canonical form), history, parties, verification, warning? }`. `parties` maps each party token of the history to its account id, or null for a closed account (closed mark); a token with no map entry is left out. It is not signed. The size limit is 5 MB (FG-04).
- `verify-evidence.mjs <file> [publicKey.pem]` (https://github.com/asymmsystems/jira-governance-code-cli, Apache-2.0, release v1.2.0; identical copy in `tools/verifier`) uses the Node standard library only. It checks five things:
  1. the snapshot hash against the attestation;
  2. the history chain;
  3. that the attestation's certificate id matches the head of the history;
  4. that the attestation's status is the state of the newest entry that is not `LS_REDACTED` (release v1.2.0);
  5. the Ed25519 signature.

  It exits 0 when every check passes, 1 when one fails and 2 for a usage error or a missing file. It prints a NOTE for each `LS_REDACTED` entry and for the `parties` map.
- PDF export is out of scope. It would need a new dependency.
- v4: evidence format `ledgerseal-evidence/2` and verifier 1.5.0, section 15.7. Format 1 is unchanged for every issue with no route and no Part 11 signature.

---

## 12. Quality Gates

- `tsc --noEmit` passes. `jest --coverage` passes with at least 90% branch coverage per changed file, `src/frontend/view-model.ts` included.
- Each T-02 scenario in `docs/sdlc/ledgerseal-usp-ux-research-2026-11/evidence/probes/` meets its "after" expectation in `round-log.md`.
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
| D-12 | Two-component signing in Forge | (a) LedgerSeal signing ID + TOTP; (b) signing ID + passphrase; (c) Atlassian session + one component; B: Atlassian account + emailed single-use code; C: Atlassian account + LedgerSeal TOTP | B, ADR-016: the owner kept the Atlassian identity (Q-01), and spike S-8 passed (as the app, either setting, Beta scope accepted as for `write:issue.property:jira`, 1 to 3 s) |
| D-13 | Multi-step approval | A stages on one seal; B one seal per stage; C workflow statuses; D JSM approvals | A, ADR-017. One certificate; quorum and separation of duties checkable offline |
| D-14 | Sign while transitioning | A Forge field + validator intent; B issue view then transition; C REST transition; D UIM; E post function; F condition | A with B as fallback, ADR-018. No new write scope; fails closed |
| D-10 | Data model | (a) Silverston WorkEffort, Party and Status patterns (ADR-01); (b) the B-02 event-history records | (a), owner approved 2026-11-01. One vocabulary with CascadePlan; an explicit state-change table; no v2 data existed to migrate |

---

## 14. Part 11 signing: the Atlassian account plus an emailed single-use code (ADR-016, option B)

### 14.1 Behaviour
- A Jira admin opens the admin page tab "Part 11 signing" and names the Part 11 projects (1 to 100 project ids) and the lockout threshold (default 5, range 3 to 10). The mode cannot be turned on while declaration version 2 is pending the owner's approval (section 10).
- In a Part 11 project, every signing needs a fresh code: seal, approval of changes (reseal), revoke, stage signature, rejection (section 15) and the signature on the transition screen (section 16). The form shows "Send me a code". LedgerSeal emails a 6-digit code to the signer's own Atlassian email address through Jira. The signer types it and signs. The code works once, for 5 minutes, for that person, that issue and that action.
- In any other project, and while the mode is off, LedgerSeal behaves as in spec v3.

### 14.2 Code request (`signing-code-request-api`)
Payload: `{ action: 'SEAL' | 'RESEAL' | 'REVOKE' | 'SIGN_STAGE' | 'REJECT' | 'TRANSITION', stageId? }`. The issue comes from the context.
1. Identity, licence and Browse checks (spec v3 section 7.3 steps 1 and 2, Q3).
2. The project is a Part 11 project, or `NOT_PART11`.
3. The caller may perform the action: approver (spec v3 section 7.1) for SEAL, RESEAL, REVOKE and TRANSITION; a member of an open stage's groups for SIGN_STAGE and REJECT (section 15). Otherwise `NOT_APPROVER`. Nothing is sent to a person who cannot sign. The check is made in the flow itself; for a stage, the caller's groups are read as the user before the route is read as the app (fix round 1 L-7).
4. Not locked, or `SIGNING_LOCKED`.
5. Rate limits: at most one request per 30 seconds and 5 per 15 minutes per person, or `RATE_LIMITED` (an event; an alert once per rule and 15-minute window, fix round 1 L-8). Both rules are create-once claims, not reads (fix round 1 H-2): the 30-second rule claims the request's own 5-second slot and the 6 after it (`ls3:sig:reqslot:{party}:{slot}`), so two requests less than 30 seconds apart always collide and requests 35 seconds or more apart never do.
6. Make the challenge: `challengeId` (128 random bits, base64url), code (6 digits, `crypto.randomInt`), `codeMac` = HMAC-SHA-256(site signing key, `challengeId + ":" + code`), `expiresAt` = now + 5 minutes. Store `ls3:sig:chal:{challengeId}` (TTL 1 day).
7. Send, as the app: `POST /rest/api/3/issue/{issueId}/notify` with `to.users` = the caller and `reporter`, `assignee`, `watchers` and `voters` set to `false`, `groups` and `groupIds` empty (fix round 1 M-2), subject "LedgerSeal signing code for {issueKey}", and a body with the code, the action and "It works once, for 5 minutes. If you did not ask for it, tell your Jira admin." Any status other than 204 gives `CODE_NOT_SENT` (an event and an alert); the challenge is deleted.
8. Event `CODE_SENT`. Result: `{ ok: true, challengeId, expiresAt }`. The code is never returned.

### 14.3 Code check (inside every signing flow, after every other check and before the first write)
Payload gains `signing: { challengeId, code }`.
Fix round 1 (H-2): every limit is a create-once claim taken before the code is compared, so parallel answers cannot compare more codes than the sequential rules allow.
1. The person's current series is not locked (`ls3:sig:lock:{party}:{series}` absent), or `SIGNING_LOCKED`.
2. The challenge exists, belongs to the caller's party token, the context issue and the action (and stage), and is not expired; else `SIGNING_FAILED`, counted as a failure (an expired one: `CODE_EXPIRED`, recorded, not counted). A `SEAL` code also approves changes and a `RESEAL` code also seals, because the issue may change between the request and the signature (L-4); `REVOKE`, stage and `TRANSITION` codes stay bound to their action.
3. Claim one of the challenge's 3 answer slots (`ls3:sig:attempt:{challengeId}:{n}`, n = 1 to 3). No slot left: `SIGNING_FAILED`, counted.
4. Claim the next failure slot of the series (`ls3:sig:fail:{party}:{series}:{n}`, n up to the threshold, TTL 30 days). No slot left: lock.
5. Compare the MAC with `timingSafeEqual`. A mismatch keeps the failure slot (event `SIGN_FAIL`, alert); when its n reaches the threshold, lock: create the lock key once (event `LOCKED`, alert). Answer `SIGNING_FAILED` (the message never says which part was wrong).
6. A match checks the lock again (a parallel failure may have locked the series), then claims `ls3:sig:used:{challengeId}`. If it exists: `CODE_REUSED` (event and alert; the failure slot is given back, so a double submit does not count, L-4).
7. Success gives the slot back, starts the next series once (`ls3:sig:series:{party}:{series + 1}`, create-once) and writes event `SIGN_OK` with the issue and the action. The flow then writes its row with `data.signing` (14.5). An unlock also starts the next series; a lock is never cleared, it stays on its series as a record.

### 14.4 Unlock and alerts (admin page)
- `signing-policy-get-api`, `signing-policy-set-api`: Jira admin only (as spec v3 section 7.1).
- `signing-locked-list-api`: Jira admin; the locked people (account ids resolved from tokens for display only).
- `signing-unlock-api` `{ accountId, reason }`: Jira admin, not for self (`SELF_UNLOCK`); reason 1 to 500 characters; event `UNLOCKED`, new failure series.
- `signing-alerts-api` `{ fromSeq? }` and `signing-alert-ack-api` `{ seq }`: Jira admin. The admin page lists alerts not yet acknowledged, newest first; an acknowledgement is a new chained entry `ACK` naming the alert's seq.
- No alert is emailed (Q-02). The admin page shows "No email is sent for these alerts. Check this page."
- Fix round 1: every saved policy version (on, off, projects, lockout) raises a `POLICY_CHANGED` alert naming the admin (L-5). The page reads an index of open alerts (`ls3:sig:open:{seq}`, kept with the log and built once from the log on first use), not the whole log (L-8).

### 14.5 Data
```typescript
interface SigningPolicy {                 // ls3:sig:policyver:{n} (created once); ls3:sig:policy = the newest
  schemaVersion: 1; version: number;
  enabled: boolean;
  projectIds: string[];                   // Part 11 projects, sorted
  lockoutThreshold: number;               // 3 to 10
  codeLifetimeSeconds: 300;
  declarationVersion: '2';
  setByPartyId: string; fromDate: string;
  prevPolicyHash: string;                 // 64 zeros for version 1
  policyHash: string;                     // SHA-256 of the canonical JSON of every other field
}
interface SigningChallenge {              // ls3:sig:chal:{challengeId}, TTL 1 day
  challengeId: string; partyId: string; issueId: string;
  action: 'SEAL' | 'RESEAL' | 'REVOKE' | 'SIGN_STAGE' | 'REJECT' | 'TRANSITION'; stageId: string | null;
  codeMac: string; createdAt: string; expiresAt: string;
}
interface SigningState {                  // ls3:sig:state:{partyToken}
  partyId: string; series: number; locked: boolean; lockedAt: string | null;
  lastRequestAt: string | null;
}
interface ChainEntry {                    // ls3:sig:ev:{partyToken}:{seq} and ls3:sig:alert:{seq}, created once
  seq: number; at: string;
  kind: 'CODE_SENT' | 'CODE_NOT_SENT' | 'SIGN_OK' | 'SIGN_FAIL' | 'CODE_REUSED' | 'LOCKED' | 'UNLOCKED' | 'RATE_LIMITED' | 'POLICY_CHANGED' | 'ACK';
  partyId: string | null;                 // whom the entry is about
  byPartyId: string | null;               // who acted (an admin for UNLOCKED and ACK); null for the app
  issueId: string | null; action: string | null; challengeId: string | null; reason: string | null; ackSeq: number | null;
  prevEntryHash: string; entryHash: string;
}
// Status row data (WorkEffortStatus.data), only in a Part 11 project
signing?: { method: 'LS_ATL_EMAIL_OTP_1'; components: 2; mode: 'PART11'; challengeId: string; policyVersion: number; policyHash: string }
// Fix round 1 (M-1): every signature row (seal, reseal, revoke, stage signature, rejection) names the policy in force,
// on or off, once any policy was saved; a policy saved during the signature refuses it (POLICY_CHANGED)
signingPolicy?: { version: number; policyHash: string }
```

| Key | Value |
|---|---|
| `ls3:sig:key` (secret store, `kvs.setSecret`, created once) | the site signing key, 32 random bytes, base64 |
| `ls3:sig:policy`, `ls3:sig:policyver:{n}` | `SigningPolicy` |
| `ls3:sig:chal:{challengeId}` | `SigningChallenge`, TTL 1 day |
| `ls3:sig:used:{challengeId}`, `ls3:sig:attempt:{challengeId}:{n}` | claims, TTL 1 day |
| `ls3:sig:fail:{party}:{series}:{n}` | failure claims, TTL 30 days |
| `ls3:sig:series:{party}:{n}`, `ls3:sig:lock:{party}:{series}` | series start and lock, created once (fix round 1) |
| `ls3:sig:req:{party}:{window}:{n}`, `ls3:sig:reqslot:{party}:{slot}` | rate-limit claims (window = 15-minute slot; slot = 5 seconds), TTL 1 day |
| `ls3:sig:alertonce:{name}`, `ls3:sig:open:{seq}`, `ls3:sig:openindex` | one rate alert per rule and window; the open-alert index (fix round 1) |
| `ls3:sig:state:{party}` | `SigningState` hint: the series and the last request time (the series and the lock are derived from the keys above) |
| `ls3:sig:ev:{party}:{seq}`, `ls3:sig:evhead:{party}` | per-person signing history and its head |
| `ls3:sig:alert:{seq}`, `ls3:sig:alerthead` | site alert log and its head |

A chain append reads the head, moves forward over entries that exist, then claims the next seq with `FAIL_IF_EXISTS` (a lost race moves on to the next seq), then updates the head.

### 14.6 Error codes (new)
`NOT_PART11`, `POLICY_CHANGED` (fix round 1: the policy, or for a transition-screen intent the route binding, changed while the person signed), `SIGNING_REQUIRED` (a Part 11 project and no `signing` in the payload), `SIGNING_FAILED`, `CODE_EXPIRED`, `CODE_REUSED`, `SIGNING_LOCKED`, `RATE_LIMITED`, `CODE_NOT_SENT`, `SELF_UNLOCK`, `DECLARATION_PENDING` (turning the mode on while declaration version 2 is not approved).

### 14.7 Scope and questionnaire
- New scope `send:notification:jira` (granular, Beta in the Jira OpenAPI, as is the existing `write:issue.property:jira`). It is used only to send the code to the signer. The production deploy is a major version; site admins consent on upgrade.
- Questionnaire: Q7 adds the scope; Q8 adds the code to the values never logged, with a test; Q13 adds the site signing key in the Forge secret store (no per-user secret); Q11 and Q12 stay No.

### 14.8 Personal data
Events, alerts and challenges hold party tokens and issue ids, never an account id or an email address. The weekly report covers the accounts behind those tokens through the existing party map (ADR-011): a person who requested a code is registered like a signer.

---

## 15. Approval routes (ADR-017)

### 15.1 Behaviour
- A Jira admin defines routes on the admin page and binds each to a project and issue types.
- The panel shows the route: each stage, its quorum, who signed, and which stages are open. A person sees "Sign as {stage}" only for open stages they qualify for; "Reject" next to it.
- With no binding, LedgerSeal behaves as in v3.

### 15.2 Run state machine (new; the seal state machine of v3 section 3.2 is unchanged)

| From | Event | To | Row written |
|---|---|---|---|
| no run | first stage signature | `OPEN` | `LS_RUN_SIGNED` / `SIGN_STAGE` |
| no run | first signature completes a one-stage route | `COMPLETE` | `LS_SEALED` / `SEAL` or `RESEAL` (as v3) |
| `OPEN` | stage signature, route not complete | `OPEN` | `LS_RUN_SIGNED` / `SIGN_STAGE` |
| `OPEN` | stage signature completes the last order group | `COMPLETE` | `LS_SEALED` / `SEAL` or `RESEAL` |
| `OPEN` | rejection | `REJECTED` | `LS_RUN_REJECTED` / `REJECT` |
| `OPEN` | covered change | `VOIDED` | `LS_RUN_VOIDED` / `VOID` |
| `OPEN`, while an earlier seal exists | revoke of that seal | `VOIDED` | `LS_REVOKED` / `REVOKE` (as v3, data `endsRun: true`); with no seal, a run ends only by rejection or change |
| `REJECTED`, `VOIDED`, `COMPLETE` | next stage signature | `OPEN` (new run) | `LS_RUN_SIGNED` |

### 15.3 Stage signing contract (`seal-issue-api`, extended)
Payload adds `stageId`. Steps after v3 step 6: resolve the route (binding, then pinned version of the open run); check the stage is open; check the caller is in a stage group (as user) and has not signed another stage of this run; check the separation of duties of v3 section 7.2 for every stage; check `viewHash` equals the run's snapshot hash (a new run takes the live hash); write the row. The first row of a run stores the snapshot content (`ls3:content:`), so every stage signs the same stored content.

`reject-stage-api`: payload `{ stageId, reason, signing? }`; same checks; writes `LS_RUN_REJECTED`.

Fix round 1 (H-1): every flow that changes a run (stage signature, rejection, void, the end of a run on revoke) holds the issue's run lock (`ls3:runlock:{issueId}`, created once; a lock older than 60 seconds is taken over by exactly one caller through a create-once break key; a busy lock is retried for about 4 seconds, then `CONFLICT`). Under the lock the flow reads the run again and repeats the run decisions: the stage is open, the person has not signed another stage of the run, an open run still holds the person's snapshot, and the run the checks saw has not ended (else `ISSUE_CHANGED`). The panel's `canReject` applies "one person, one stage" as the flow does (L-6).

### 15.4 Attestation schema 4 (v3 section 8)
Adds, only for an issue with a bound route:
```json
"approval": { "runState": "OPEN | REJECTED | VOIDED | COMPLETE", "stagesComplete": 1, "stagesTotal": 2, "routeHash": "64 hex" }
```
`status`, `certificateId`, `snapshotHash`, `sealedAt` keep their schema 3 names, types and meanings. Before the first seal the property has `schemaVersion`, `issueId`, `approval`, `issuedAt`, `keyId`, `sig` only. New index path `approval.runState` (string, alias `ledgersealApproval`). Issues with no route keep schema 3.

### 15.5 Validator (v3 section 9)
New rows:

| Case | `result` | `errorMessage` |
|---|---|---|
| The target status is gated by stage S, and S and every earlier group have their quorum in the open run or the seal | true | none |
| The target status is gated by stage S, which lacks its quorum | false | "LedgerSeal: this move needs the {stage} approval ({k} of {n} signed). Sign in the LedgerSeal panel." |
| The route is not complete, at a fully gated transition | false | "LedgerSeal: approval is in progress ({done} of {total} stages). The last stage must sign before this move." |
| The last run was rejected | false | "LedgerSeal: {stage} rejected this issue on {date} (reason: {reason}). Start the approval again in the LedgerSeal panel." |

### 15.6 High-level design

**Data model**
```typescript
interface RouteStage {
  stageId: string;                     // stable within a route, [a-z0-9-]{1,32}
  name: string;                        // 1 to 60 characters
  orderGroup: number;                  // 1 to 8
  roleTypeId: 'LS_APPROVER' | 'LS_REVIEWER' | 'LS_VERIFIER';
  approverGroups: { id: string; name: string }[];   // 1 to 10, ids checked in Jira
  quorum: { kind: 'ANY' } | { kind: 'N'; n: number }; // n 1 to 10
  gatesStatusIds: string[];            // target statuses this stage gates, at most 10
}
interface RouteVersion {               // ls3:routever:{routeId}:{version}, created once
  schemaVersion: 1; routeId: string; version: number; name: string;
  stages: RouteStage[];                // 1 to 8
  reapprovalStageIds: string[] | null; // null: the full route (Q-06)
  setByPartyId: string; fromDate: string;
  routeHash: string;                   // SHA-256 of canonical JSON of every other field
}
interface ApprovalRun {                // on SealedWorkEffort.run
  runId: string; routeId: string; routeVersion: number; routeHash: string;
  state: 'OPEN' | 'REJECTED' | 'VOIDED' | 'COMPLETE';
  snapshotHash: string; contentId: string; startedSeq: number;
  stageCounts: Record<string, number>; // distinct signers per stage
  signatureRows: { seq: number; entryHash: string; stageId: string; partyId: string }[]; // at most 80
}
```
`SealedWorkEffort` gains `run?: ApprovalRun` (covered by `recordHash`); its size budget moves from under 4 KiB to under 16 KiB. `WorkEffortPartyAssignment` gains `stageId?` and `runId?`.

Row data:
- `LS_RUN_SIGNED`: `{ runId, routeId, routeVersion, routeHash, stageId, qualifyingGroupId, snapshotHash, signing? }`
- `LS_SEALED` at the end of a run: as v3 plus `{ runId, routeId, routeHash, routeVersion, stageId, qualifyingGroupId, snapshotHash, stageSignatures: [entryHash...], requiredStageIds }`
- `LS_RUN_REJECTED`: `{ runId, stageId, snapshotHash, signing? }` with `reason`
- `LS_RUN_VOIDED`: `{ runId, liveHash, changes }` (as an incident's data, without changing `everCompromised`)

**Storage keys** (new)

| Key | Value |
|---|---|
| `ls3:route:{routeId}` | `{ routeId, currentVersion, name }` |
| `ls3:routever:{routeId}:{version}` | `RouteVersion`, created once |
| `ls3:routebind:{projectId}:{issueTypeId or all}` | `{ routeId, projectId, issueTypeId, setByPartyId, fromDate }`; "every issue type" is `*` in the API and `all` in the key (`*` is not a valid KVS key character, live 2026-11-08) |
| `ls3:run:{issueId}` | `ApprovalRun` with its `recordHash` and the chain head it last wrote |
| `ls3:runcontent:{contentId}:{part}` | the snapshot the stages of a run sign; deleted when the run ends |

The binding lookup is two direct reads (issue type, then `*`), no query.

**Resolvers**: `route-list-api`, `route-get-api`, `route-save-api` (new version), `route-bind-api`, `route-unbind-api` (all Jira admin, as v3 section 7.1 admin checks; group ids checked by `/rest/api/3/group/bulk`; status ids by `/rest/api/3/statuses/search`, `read:jira-work`); `reject-stage-api` (new); `seal-issue-api`, `verify-issue-api`, `seal-history-api`, `seal-evidence-api` (extended). `PanelData` gains `route?: { name, stages: [{ stageId, name, quorum, signed: [{ partyId, at }], open, canSign, canReject }], runState }`; the 16 KiB budget stays.

**UI surfaces**: admin page tab "Approval routes" (list, edit stages, bind to project and issue types); the panel's seal section becomes a stage list when a route applies; the issue context entry shows "In approval: 1 of 2".

**Canonical form of a route**: canonical JSON as v3 section 4.1 of the `RouteVersion` without `routeHash`; arrays keep their order except `approverGroups` and `gatesStatusIds`, sorted by id. New vectors in `tools/verifier/vectors-route-1.json`.

### 15.7 Evidence format 2 and verifier 1.5.0 (v3 section 11)
- `seal-evidence-api` returns `format: "ledgerseal-evidence/2"` when the history holds a run row, a stage-signed seal, a `signing` object or a `signingPolicy` reference (fix round 1), and `ledgerseal-evidence/1` otherwise (unchanged bytes for every existing issue).
- Format 2 adds `routes: RouteVersion[]` (each version named by the history) and `signingPolicies: SigningPolicy[]` (versions in force, without group names if the owner prefers, Q-11).
- Verifier 1.5.0 runs these checks whenever the content needs them (attestation `schemaVersion` 4; an `LS_RUN_*` row; `data.runId`, `data.routeId`, `data.signing` or `data.signingPolicy`), whatever the unsigned `format` field says (fix round 1 M-1). Routed content without `routes` fails check 6. It adds:
  6. each route version's hash recomputes;
  7. every `LS_RUN_SIGNED` row of the sealing run, and the `LS_SEALED` row, carry the attestation's `snapshotHash`, and `stageSignatures` equals the run's signature rows;
  8. quorum per stage (distinct `setByPartyId`) and order groups signed in order;
  9. no party signs two stages of one run;
  10. a signature row made under a Part 11 policy that names the project carries `signing` with `components: 2` and that policy's version and hash. The policy in force is the one the row names in `data.signingPolicy`, which must be in `signingPolicies` with the same hash (a swapped or emptied list fails); only a row written by an earlier release, without the reference, uses the policy dates (fix round 1 M-1, L-9).
- Check 4 skips `LS_RUN_SIGNED`, `LS_RUN_REJECTED` and `LS_RUN_VOIDED` rows, as it skips `LS_REDACTED`.
- A format-1 file gives the same output and exit code as v1.3.0 (tested with every existing fixture).
- Compatibility of v1.3.0 with format 2: a finished routed seal passes checks 1 to 5 but its route is not checked; an issue still in approval fails check 3 or 4. v1.3.0 never passes a record that is not sealed. The verifier README and the user guide say "use 1.4.0 or later for format 2". Version number: 1.4.0, because no existing result changes (Q-09).

### 15.8 Migration
None of the stored data changes. Existing seals have no `run` and are read as the implicit route. Binding a route affects the next signature on each issue. The weekly conversion job of ADR-011 is untouched.

---

---

## 16. Signing on the transition screen (ADR-018)

### 16.1 Behaviour
- A Jira admin adds the "LedgerSeal signature" field to a transition screen and the Require Valid LedgerSeal validator to that transition.
- In the transition dialog the field shows the declaration, the stage (or meaning), "Send me a code" and a "Code" input (Part 11 projects, section 14; elsewhere no code), with a "Sign" button inside the field. After a good signature it shows "Signed. Select Transition to finish." and holds only the intent id.
- The panel and an issue action modal "Sign with LedgerSeal" stay available for every case the field cannot serve.

### 16.2 Manifest (v3 section 5)
```yaml
jira:customField:
  - key: ledgerseal-signature
    name: LedgerSeal signature
    type: string
    edit: { resource: signature-edit, render: native }   # no experience limit: the bundled manifest schema (@forge/manifest 13.8.0) has no "issue-transition" value; spike S-1 showed the field on the new transition dialog without it
    # no view resource: with one, the new transition dialog showed a plain text box (live, LSP-6); the issue view shows the intent id
    resolver: { function: resolver }
jira:issueAction:
  - key: ledgerseal-sign-action
    title: Sign with LedgerSeal
    resource: main
    render: native
```
The YAML is indicative; key names are checked by `forge lint` when built.

### 16.3 Canonical form 2.3.0 (v3 section 4)
The rules of 2.2.0, plus one exclusion: a field whose `schema.custom` is LedgerSeal's own `ledgerseal-signature` field type (matched by the app id and the module key, in both development and production) is excluded, with the reason "LedgerSeal's own signature field". New seals use 2.3.0. 2.0.0 to 2.2.0 are unchanged. New vectors `apps/ledgerseal/test/fixtures/vectors-2.3.0.json` and verifier self-test cases. The verifier recomputes the snapshot hash from the exported canonical form, so it needs no rule change.

### 16.4 Validator (v3 section 9), new rows

| Case | `result` | `errorMessage` |
|---|---|---|
| Field holds an intent; intent valid, user matches, hash matches | signature written, then the normal gate | per gate |
| Intent expired or used | false | "LedgerSeal: this signature expired or was already used. Sign again in the LedgerSeal field." |
| Payload has no user, or a different user | false | "LedgerSeal: the person moving the issue is not the person who signed. Sign again." |
| The screen changed covered content | false | "LedgerSeal: fields on this screen changed the approved content. Use a screen with only the LedgerSeal signature field, or sign in the panel." |

### 16.5 Intent contract
`transition-sign-intent-api`, payload `{ viewHash, stageId?, meaning, declarationVersion, declarationText, signing: { challengeId, code } }`. It runs v3 steps 1 to 7 and the code check of section 14.3, but instead of writing the seal it writes `ls3:intent:{intentId}` = `{ partyId, issueId, viewHash, stageId, meaning, declaration, signingEvidence, expiresAt (now + 120 s) }` and returns `{ intentId }` (random, 128 bits). The edit view then calls `view.submit(intentId)`. The validator claims `ls3:intentuse:{intentId}` with `FAIL_IF_EXISTS` before it writes the signature.

### 16.6 High-level design
- **Data model:** `SigningIntent` (above); signature rows add `via: 'PANEL' | 'ISSUE_ACTION' | 'TRANSITION_SCREEN'` and, for the last, `transitionToStatusId`.
- **Storage keys:** `ls3:intent:{intentId}` (deleted by the weekly job after 1 day), `ls3:intentuse:{intentId}`.
- **Resolvers:** `transition-sign-context-api` (what the field shows), `transition-sign-intent-api`; the validator function `validate-transition` gains the intent branch; shared service code with `seal-issue-api` so both paths write the same rows.
- **UI surfaces:** the field edit view (UI Kit; it calls `view.submit(intentId)` as soon as the intent exists), the issue action modal (the panel). No field issue-view resource: a `view` resource hid the edit view on the new transition dialog (live, 2026-11-08); the issue view shows the stored intent id.
- **Verifier:** no change beyond 2.3.0 vectors; `via` is in the hashed row, so it is covered by the chain check.
- **Migration:** none; the field is new. Seals made before 2.3.0 keep their version, so adding the field to a screen does not break them unless someone sets the field on an issue sealed under 2.2.0 or earlier. Then that seal shows CHANGED (the field is covered under 2.2.0). The admin guide says to approve once after adding the field, or the app treats a change of only this field type as a non-content change for older versions too (open question Q-12).

### 16.7 Platform spikes (run 2026-11-08 on the development site, isolated project LSP; results in `docs/sdlc/ledgerseal-regulated-2026-11/spike-results.md`)
| Id | Question | Pass condition | If it fails |
|---|---|---|---|
| S-1 | Does a Forge custom field's UI Kit edit view render and call its resolver on the new transition dialog? (Docs list `issue-transition` but the limitations section names only view and create screens.) | Field renders, `invoke` works, `view.submit` sets the value | Build ADR-018 fallback only |
| S-2 | Does the function validator payload carry the transitioning user and the Forge field in `modifiedFields`? (Spec v3 saw `user` live on 2026-11-06; docs do not list it.) | Both present on board drag and issue view transitions | Fallback only |
| S-3 | Does Jira field history show only the intent id, never the typed code? | Only the submitted value appears | Redesign the edit view |
| S-4 | Which entry points open the dialog with the field (issue view, board drag, list view, bulk change)? | Recorded per entry point | Documented as limits |
| S-5 | Does `POST /issue/{id}/notify` work as the app, and what does it return with email off? | 204 and an email arrives | Alerts on the admin page only; 11.300(d) row stays weaker |
| S-8 | Can the app email the signer themself whatever their own-changes setting; which scope; latency over 5 sends; is the code kept out of the issue? (ADR-016 Q-01) | All of (1) to (3) | Option C (TOTP enrolment) |
| S-6 | Can UI Kit show a QR code (an `Image` with a data URI or an SVG)? | It renders | Text seed only, or a Custom UI enrolment page |
| S-7 | Can `kvs.setSecret` join `kvs.transact()`? TTL support for the step and intent keys? | Recorded | Not needed under option B (no per-user secret); the site key is created once with `FAIL_IF_EXISTS` |

---

---

## 17. Compliance mapping (recomputed for option B, conservatively; the site page changes only after release and live probes, Q-14)

Current rows: `asymmsystems/asymm-corporate-code-pfw`, `src/main/jbake/content/product/jira-governance/compliance.html`, origin/develop `7fcd97a`.

| Section | Today on the site | After this release, with Part 11 signing on | Why, and what stays with the customer |
|---|---|---|---|
| 11.10(e) audit trails | Supported, with the stated limit | Unchanged; the chained records add the signing history, the alert log and run rows | The vendor-rewrite limit stays |
| 11.10(f) operational checks (no row today) | not listed | **Supports** (new row): routes enforce the order of approval stages | Customer configures routes and workflows |
| 11.10(g) authority checks (no row today) | not listed | **Supports** (new row): only approvers and stage groups sign; Part 11 signing adds a code sent to the signer | Customer chooses the groups |
| 11.50 manifestation | Partly met | **Unchanged: partly met** | Printed name after account closure: the ADR-011 trade-off (Q-05) |
| 11.70 linking | App signature; "auditor decides" | Unchanged wording, plus: "each Part 11 signature row records the method and the single-use code request it used; the row is in the hash chain covered by the signed attestation" | Still an app signature, not the signer's own key |
| 11.100(a) unique, not reused | not listed | **Partly met** (new row): each signature is bound to one Atlassian account (party token); LedgerSeal never reassigns a token | Uniqueness and non-reuse of accounts are Atlassian's and the customer's |
| 11.100(b), (c) | not listed | Customer's responsibility (stated) | Identity checks before an account exists; letter to FDA |
| 11.200(a)(1) two components | Not met | **Partly met**: two distinct components at each signing: the signer's authenticated Atlassian account and a single-use code sent to that account's email. The first is the existing Jira session, not re-entered at each signing, so LedgerSeal does not claim that every component is executed at every signing (11.200(a)(1)(ii)) | Customer validation, session and re-authentication policy in the identity provider |
| 11.200(a)(2) genuine owner | Not met | **Partly met**: the code goes only to the account's own email address | Personal (not shared or delegated) mailboxes |
| 11.200(a)(3) collaboration | Not met | **Partly met**: misuse needs the person's Jira session and their mailbox | Keep Jira and email administrators apart from the people who sign |
| 11.200(b) biometrics | Not met | Not applicable | |
| 11.300(a) uniqueness | Not met | **Customer and Atlassian** (stated): account uniqueness is the identity provider's | |
| 11.300(b) periodic revision | Not met | **Customer** (stated): password ageing is the identity provider's; codes expire after 5 minutes | Choose the policy |
| 11.300(c) loss management | Not met | **Customer** (stated): disabling an account in the identity provider stops signing at once; LedgerSeal adds lockout and unlock by a Jira admin | Loss reporting procedure |
| 11.300(d) transaction safeguards | Not met | **Partly met**: single use, 5-minute life, rate limits, lockout after N failures, every attempt recorded, alerts on the admin page. Not "immediate and urgent" reporting: no alert email until a stable email API exists (Q-02) | The security unit's response |
| 11.300(e) device testing | Not met | Not applicable: LedgerSeal issues no device | |

Overall wording for the listing's "Honest Compliance Boundary", proposed for the owner (his prose): "With Part 11 signing on, each signature also needs a single-use code that LedgerSeal emails to the signer's own Atlassian address, with lockout and a recorded history of every attempt. LedgerSeal does not re-enter your Jira login at each signature, so it partly meets 21 CFR 11.200(a)(1); your identity provider's controls, procedures and validation decide whether this meets your predicate rules."

---

## 18. Open questions: answers (owner, 2026-11-08)

| Id | Question | Answer | Recorded in |
|---|---|---|---|
| Q-01 | Second component | Changed by the owner: identity stays the Atlassian account; B (emailed single-use code) if spike S-8 passes, else C (TOTP enrolment). S-8 passed: **B** | ADR-016 |
| Q-02 | Alert scope | No new Jira permission for alerts; admin page plus a hash-chained record; 11.300(d) stays partly met | ADR-016 |
| Q-03 | Declaration v2 | **Resolved 2026-11-08: option A, the developer's draft with the second sentence replaced.** Approved text, verbatim: "I am signing this record electronically. I understand that my organisation treats this electronic signature as the legally binding equivalent of my handwritten signature. I approve this issue as it is now, with the meaning shown above, and I agree that this signature records my approval of its covered fields, comments and attachments." | ADR-016, section 10 |
| Q-04 | QR code | Not needed under option B (no enrolment) | ADR-016 |
| Q-05 | 11.50 printed name | No change; ADR-011 stands; 11.50 partly met | ADR-016 |
| Q-06 | Approval of changes after a routed seal | Default: full route; optional re-approval subset per route | ADR-017 |
| Q-07 | Route edited while a run is open | Pin the run to its version | ADR-017 |
| Q-08 | Who edits routes | Jira admins only | ADR-017 |
| Q-09 | Verifier version | 1.4.0; released as 1.5.0, because FourRealities released its report verifier as 1.4.0 first (2026-11-08) | ADR-017 |
| Q-10 | Transition screens with covered fields or a comment | Block | ADR-018 |
| Q-11 | Group names in evidence | Include | ADR-017 |
| Q-12 | Signature field on an issue sealed before 2.3.0 | Show CHANGED until approved; admin guide says so | ADR-018 |
| Q-13 | Lockout threshold and lifetime | Lockout 5 (3 to 10); code lifetime 5 minutes (fixed) | ADR-016 |
| Q-14 | Listing and site copy | After release and live probes only | ADR-016 |

## 18A. Fix round 1 (independent review of 427f6c9, 2026-11-08)

The review is `repository/tmp/ls-regulated-review/REVIEW.md`. The changes are written into sections 14.2 to 14.6, 15.3 and 15.7 above; the progress log has a row per finding. In addition:
- **Transition-screen intents (L-1, L-3):** the validator re-reads the code-signing policy and the route binding when it completes an intent, and refuses on any difference (`POLICY_CHANGED`, `ROUTED`). The intent stores the issue key too; a validator payload with only a key must match it.
- **Validator (M-3):** any error inside the gate gives `{ result: false }` with "LedgerSeal could not complete its check, so this transition is blocked. Try again in a minute." (fail closed by construction).
- **Open by design, stated (L-2):** an intent and its `TRANSITION` code are bound to the party, the issue, the shown hash, the stage and the meaning, not to one transition or target status. Within its 120 seconds the signer can use it on another transition of the same issue; the row records the real target status. ADR-018 binds no more than this.
- **By spec, stated (L-6):** a rejection blocks the gated transitions until a new run starts, even when the issue has a valid seal (section 15.5). One member of a stage group can therefore stop the workflow until someone signs again; the rejection, its reason and its author are in the chained history.

## 18B. Fix round 2 (independent review of f537067, 2026-11-08)

The review is `repository/tmp/ls-regulated-review/REVIEW-round2.md`. In addition to section 18A:
- **Revoke under the run lock (R2-1):** after the Browse and right checks, the revoke takes the run lock and, under it, checks the right again, reads the route, checks the code, writes its row (with `endsRun` when a run is open) and ends the run. A stage signature or rejection refuses (`ISSUE_CHANGED`) when the seal's state or certificate changed since its checks.
- **The code under the lock (R2-2):** a stage signature, rejection and revoke check the code under the run lock, after every run decision. `SIGN_OK` is written only after the row is stored (for a transition-screen intent: when the validator writes the seal). A code whose signature was not written is given back (`ls3:sig:used:{challengeId}` removed), so a busy issue costs no code.
- **How a series ends (R2-3):** a success and a lock race for one create-once key, `ls3:sig:end:{party}:{series}` (`OK` or `LOCK`). A lock that won refuses the success and gives its code back; a success that won leaves the parallel failure in a series that is over.
- **Run lock take-over and fencing (R2-5):** the take-over checks that the key still names the stale holder, deletes it, and creates its own with `FAIL_IF_EXISTS`. Every run write (run row, run record, the completing stage's seal, the revoke row) first checks that the lock names its holder, else `CONFLICT`.
- **Declarations (D-1):** stage signature and rejection rows chain `declarationVersion` and `declarationHash` (SHA-256 of the exact text); a seal row does too when the record is format 2 anyway (a code-signing policy exists, or a route's stage writes the seal). A plain seal keeps format 1: its version 1 text is fixed and published. A rejection now needs the declaration, as a stage signature does; a revoke shows none and records none. The export adds `declarations` (version to text) for every version a row names by hash, and `data.declarationHash` makes a record format 2.
- **Policy reference (V-2):** `data.signingPolicy` also names the row's `projectId`; check 10 uses it, so an issue moved between projects after a signature is judged by the project it was signed in.
- **Verifier 1.5.0** (the release number; FourRealities released its report verifier as 1.4.0 in the same tool directory): check 11 (declaration texts) and check 12 (no entry of a run after the entry that ended it), with the format 2 checks above. Format 1 output is unchanged.
- **Policy alert (L-5):** the `POLICY_CHANGED` alert is written after the version is created and before it comes into force; if the alert cannot be written, the version is removed and the save fails.
- **Alert index (L-8):** after the one-time build, acknowledgements are applied again from a fresh read of the log.
- **Written answers:** R2-4 (a failure slot taken before a compare stays if the invocation is killed before the slot is given back; it affects only that person, counts as one failure, and an admin unlock starts a new series). R2-6 (a slow signature holds the issue's lock for its duration, at most the 25-second Forge limit, then 60 seconds if it died; others get "try again" after about 4 seconds and keep their code; no unprivileged action holds the lock on purpose).

## 19. Sources
Each ADR lists its sources with URLs. Spike evidence: `docs/sdlc/ledgerseal-regulated-2026-11/spike-results.md`.
