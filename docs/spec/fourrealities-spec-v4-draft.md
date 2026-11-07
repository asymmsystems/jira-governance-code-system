<!--
Copyright (c) 2026 Asymm Systems. All rights reserved.

@author Fahim Farook
-->
# FourRealities: Specification v4 (draft, delta only)

- **Status:** FROZEN 2026-11-08. Approved by the owner on 2026-11-08 (ADR-015, decisions Q1 to Q9) and merged into `docs/spec/fourrealities-spec-v4.md`, which is the working specification. Kept unchanged below this line as the approved delta.
- **Date:** 2026-11-08
- **Sources:** ADR-015 (`architecture/decision/adr-00015-fourrealities-evidence-reports.org`, Proposed) and its high-level design (`architecture/model/fourrealities-evidence-report-hld.org`, Proposed). Section numbers "HLD n" refer to that file.

Only what changes is listed. Every section of v3 not named here stays as it is.

## 1. Executive Summary (add)

Add after the list of four checks:

> FourRealities also makes **evidence reports**. For one project and one date range, a report lists the issues in scope with their four checks, the DefinitionGuard and LedgerSeal records it verified, its own Code exception steps and rework notes, and who changed which field and when, from Jira's history. A report has a JSON file and a CSV file, and a manifest that FourRealities signs. Reports are kept in the app for download, on request or on a weekly or monthly schedule; nothing is sent out. FourRealities is not a Jira audit log: Jira's audit log and Atlassian Guard keep the administrative audit log.

## 2. Invariants (change and add)

- **Invariant 1, one writer per fact (amended):** FourRealities also writes its Object Store objects under `reports/` and `tmp/`. It still never writes `ledgerseal-cert`, `definitionguard-dod` or `checklist`, and it never writes Jira history.
- **Invariant 4, user actions run as the user (amended):** add a second exception: a report job reads, as the app, only the issue ids that a JQL search as the requesting user returned (on demand), or the project's issues (scheduled). Its files are downloaded only by a user who can browse every issue in them that still exists.
- **Invariant 6, bounded storage (amended):** add: a report holds at most 10,000 issues, 250,000 changes and 50 MB per file; a project keeps at most 200 reports; reports expire after the retention set by a Jira administrator (default 400 days).
- **Invariant 10, minimal personal data (amended):** a report holds party tokens, never account ids or names. The token map is reported weekly; a closed account's entry becomes a closed mark, so signed files never change.
- **New invariant 11, complete or not stored:** a report that cannot be finished stores no file. It never holds a part of its range without saying so.
- **New invariant 12, signed files never change:** report files are written once. They are removed only by expiry or by a Jira administrator's delete, which leaves a tombstone.

## 3. Domain Model (add)

```typescript
type ReportState = 'QUEUED' | 'RUNNING' | 'DONE' | 'FAILED' | 'EXPIRED' | 'DELETED';
type ReportStep = 'FACTS' | 'CHANGES' | 'PARTS' | 'ASSEMBLE';
type FieldClass = 'USER' | 'FREE_TEXT' | 'OTHER';

interface ReportFilters { fieldIds: string[]; actors: string[] }   // at most 10 each; actors are party tokens

interface ReportJob {                    // KVS fr:rj:{reportId}
  schemaVersion: 1;
  reportId: string;                      // UUID
  projectId: string; projectKey: string;
  range: { from: string; to: string };   // 00:00 UTC; from inclusive, to exclusive; at most 366 days
  filters: ReportFilters;
  trigger: 'user' | 'scheduled';
  requestedBy: string;                   // party token or 'scheduled'
  state: ReportState;
  step?: ReportStep; cursor?: string;
  progress: { issuesTotal: number; issuesDone: number; changes: number };
  createdAt: string; startedAt?: string; finishedAt?: string;
  error?: { code: string; message: string };
  files?: { name: string; objectKey: string; bytes: number; sha256: string }[];
  manifestSha256?: string;
  previous?: { reportId: string; manifestSha256: string } | null;
  expiresAt?: string;
}

interface ReportSchedule {               // in fr:p:{projectKey}:schedules, at most 5
  scheduleId: string; cadence: 'WEEKLY' | 'MONTHLY';
  filters: ReportFilters; createdBy: string /* token */; createdAt: string;
  lastPeriodEnd?: string;
}

interface ReportSettings {               // KVS fr:cfg:reports; no account id
  retentionDays: 90 | 180 | 400 | 730 | 1095 | 1825 | 2555;   // default 400
  reportGroups: { partyId: string; partyTypeId: 'GROUP'; name: string }[]; // at most 20
  fromDate: string;
}

interface ReportTombstone { reportId: string; deletedAt: string; by: string /* token */; reason: string }
```

The file formats (`ManifestHeader`, `ReportData`, `ReportIssue`, `ReportChange`, CSV columns, people file) are defined in HLD 3. They are part of this specification by reference once approved.

## 4. Evidence reports (new section)

### 4.1 Scope of a report
- An issue is in scope when it is in the project and was created in the range, or has at least one changelog entry in the range that passes the filters. With a people filter, only entries by those people pass; with a field filter, only entries of those fields.
- Gate results are observed when the report is built (`gatesObservedAt`), with the v3 rules, the sources in use (ADR-013) and the signature checks (ADR-012). A report never claims a gate state for a past date.
- The issues of the project's previous report that can no longer be read are listed in `missingSincePrevious`.

### 4.2 Field values
- `USER` fields: account ids become party tokens; display names are left out.
- `FREE_TEXT` fields (`summary`, `description`, `environment`, text field and text area custom fields): the change is recorded with the old and new lengths, not the text (open question Q4).
- `OTHER` fields: Jira's `from`, `to`, `fromString` and `toString`, each cut to 500 characters, with `truncated` set when cut.

### 4.3 Signature and chain
- The manifest is signed with Ed25519 over its canonical JSON (ADR-012 decision 2), key `fr-prod-2026-11` in production and `fr-dev-2026-11` in development and staging. The manifest holds the SHA-256 and byte count of each file and the SHA-256 of the project's previous manifest.
- Without a configured key the manifest carries `warning: "UNSIGNED"`, and the UI says so.
- The open verifier checks a report offline (HLD 3.6).

### 4.4 Who may do what

| Action | Who | Check (as the user, fail closed) |
|---|---|---|
| See the list of reports | Browse projects | `mypermissions` |
| Create a report | Browse projects, and Administer projects or Administer Jira, or a member of a report group (Q2) | `mypermissions`; `myself?expand=groups` only when Tier 1 fails |
| Download a report | Browse projects, and able to browse every issue in it that still exists; a report that holds a deleted issue needs Administer projects or Administer Jira | `mypermissions`; `search/jql` with `id in (...)` |
| Set or delete a schedule | Administer projects or Administer Jira | `mypermissions` |
| Delete a report before expiry | Administer Jira, with a reason of 15 to 500 characters (Q8) | `mypermissions` |
| Set retention and report groups | Administer Jira (admin page) | `mypermissions` |

### 4.5 Licence (amends "Manifest", licensing paragraph)
`createEvidenceReport` and the schedule resolvers return `LICENSE_INACTIVE` when the licence is inactive; the daily report run makes no scheduled report then. Listing and download stay available (Q9).

## 5. Manifest (add)

- Modules: `consumer` `fourrealities-report-consumer` (queue `fourrealities-report-jobs`, function `report-worker`, 900 s); `scheduledTrigger` `fourrealities-report-daily` (`interval: day`, function `report-daily`, 600 s); the `objectStore` module (shape from the Object Store reference, spike S-1).
- A tab "Evidence reports" on the existing `jira:projectPage`; a section "Evidence reports" on the existing admin page.
- Runtime `memoryMB: 1024`.
- Scopes: unchanged (no new scope expected; spike S-1 confirms).
- Encrypted variables `FOURREALITIES_SIGNING_KEY` and `FOURREALITIES_KEY_ID`.
- Still no external egress.

## 6. Storage Schema (add rows)

| Key | Value | Largest size |
|---|---|---|
| `fr:cfg:reports` | `ReportSettings` | under 4 KiB |
| `fr:p:{projectKey}:reports` | report ids with state, range and expiry, newest first, at most 200 | under 64 KiB |
| `fr:p:{projectKey}:reports:head` | `{ reportId, manifestSha256 }` of the newest DONE report | under 1 KiB |
| `fr:p:{projectKey}:schedules` | `ReportSchedule[]`, at most 5 | under 8 KiB |
| `fr:rj:{reportId}` | `ReportJob` | under 16 KiB |
| `fr:rj:{reportId}:ids:{i}` | issue ids, at most 5,000 per value; deleted after assembly | under 64 KiB |
| `fr:rj:{reportId}:part:{i}` | one batch of report issues before assembly; deleted after assembly | 200,000 bytes |
| `fr:rt:{projectKey}:{deletedAt}:{seq}` | `ReportTombstone`, written once | under 2 KiB |
| `fr:partykey` | site key of the party tokens, written once | under 1 KiB |
| `fr:party:{token}` | `{ accountId, updatedAt }` or `{ closed: true, closedAt }` | under 1 KiB |

Object Store: `reports/{projectId}/{reportId}/{manifest.json,report.json,report.csv}` (written once) and `tmp/{reportId}/{downloadId}/people.{csv,json}` (removed after 24 hours).

## 7. Resolver contracts (add)

New resolvers on the project page resolver: `getEvidenceReports`, `createEvidenceReport`, `getEvidenceReport`, `generateReportDownloadUrls`, `saveReportSchedule`, `deleteReportSchedule`, `deleteEvidenceReport`. New admin resolvers: `getReportSettings`, `setReportSettings`. Inputs, rules and outputs: HLD 7.2. New error codes: `NOT_REPORT_AUTHOR`, `NOT_ALL_VISIBLE`, `TOO_MANY_ISSUES`, `REPORT_TOO_LARGE`, `RANGE_INVALID`, `JOB_LIMIT`, `REPORT_NOT_READY`.

Every permission check is a direct `await api.asUser().requestJira(route\`/rest/api/3/mypermissions?...\`)` in the checking method's body, before any storage access or call as the app (FSRT form, `docs/security/fsrt-scan-2026-11-07.md` section 4.4).

## 8. Snapshot schedule (add)

The daily report run (HLD 7.4) is separate from the daily snapshot: it makes scheduled reports, removes expired reports and temporary people files, and fails stalled jobs. Weekly periods are Monday 00:00 UTC to the next Monday; monthly periods are calendar months in UTC. A period's report is made on the first daily run after it ends.

## 9. Personal data (amends ADR-014 behaviour)

The weekly run also reports every account id in `fr:party:*`, and on closure replaces the entry with a closed mark. The people file of a download maps tokens to account ids and names as the downloading user; it is unsigned and removed after 24 hours.

## 10. UI (add)

HLD 8. The project page gets the tabs "Dashboard" and "Evidence reports". The accessibility rules of v3 apply to every new view. The words "audit log", "tamper-proof" and "tamper-evident" are not used for reports.

## 11. Decisions (add)

| ID | Decision | Options considered | Reason |
|---|---|---|---|
| D-11 | Stored, signed per-project evidence reports (ADR-015 Option C) | No change; synchronous export; mirror all history; add the Jira audit log | Closes the change-management export gap of a cloud migrator within the product's purpose; mirroring breaks ADR-001; the Jira audit log needs `manage:jira-configuration` |
| D-12 | JSON plus CSV with a signed manifest; no PDF | PDF; unsigned files; hash shown in the UI only | The verifier can recheck JSON and CSV; a PDF needs a dependency (LedgerSeal D-7) |
| D-13 | Party tokens in signed files, names only in an unsigned people file | Account ids in the file; names in the file | Erasure must not break a signature (ADR-011 pattern) |
| D-14 | On-demand scope from a search as the user; long reads as the app for those ids only; download checks full visibility | Everything as the app; everything as the user in the browser | Long jobs run in a queue consumer, where reading as the user is not confirmed (spike S-4); no viewer gets an issue they cannot browse |
| D-15 | A report is complete or not stored; caps refuse, never truncate | Truncate at a cap and warn | A partial record misleads an auditor's sample |
| D-16 | Report retention is a FourRealities setting for its own reports only | Mirror Jira's history to extend it | Jira keeps issue history; FourRealities keeps the record it made |

## 12. Listing (after approval only)

Not part of this draft's build. After approval, `docs/marketplace/fourrealities-listing.md` gains a capability row "Evidence reports" and, in the compliance boundary, "FourRealities is not an administrative audit log; Jira's audit log and Atlassian Guard keep it." (ADR-015 Q7.)
