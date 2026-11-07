/**
 * Copyright (c) 2026 Asymm Systems. All rights reserved.
 * @author Fahim Farook
 * FourRealities: contract data of the evidence reports for change-management audits (ADR-015, spec v4
 * section "Evidence reports"). Value types and limits only, no behaviour (ADR-002).
 */

import { GateName, GateResult, RiskLevel, SourcesInUse, StatusCategory } from './models';

export type ReportState = 'QUEUED' | 'RUNNING' | 'DONE' | 'FAILED' | 'EXPIRED' | 'DELETED';
export type ReportStep = 'FACTS' | 'CHANGES' | 'PARTS' | 'ASSEMBLE';
export type FieldClass = 'USER' | 'FREE_TEXT' | 'OTHER';
export type ReportTrigger = 'user' | 'scheduled';
export type ReportCadence = 'WEEKLY' | 'MONTHLY';

/** Error codes of the report resolvers (spec v4 section 7). */
export type ReportErrorCode =
  | 'INVALID_INPUT'
  | 'FORBIDDEN'
  | 'NOT_FOUND'
  | 'JIRA_ERROR'
  | 'LICENSE_INACTIVE'
  | 'NOT_REPORT_AUTHOR'
  | 'NOT_ALL_VISIBLE'
  | 'TOO_MANY_ISSUES'
  | 'REPORT_TOO_LARGE'
  | 'RANGE_INVALID'
  | 'JOB_LIMIT'
  | 'REPORT_LIMIT'
  | 'REPORT_NOT_READY';

export interface ReportError {
  code: ReportErrorCode;
  message: string;
  status?: number;
  /** NOT_ALL_VISIBLE: how many issues of the report the viewer cannot see. */
  count?: number;
}

export type ReportResult<T> = ({ ok: true } & T) | { ok: false; error: ReportError };

/** The bounds of ADR-015 and the HLD, section 9 (owner decision Q6: 200 reports and 50 MB). */
export const REPORT_LIMITS = {
  maxIssues: 10_000,
  maxRangeDays: 366,
  maxChanges: 250_000,
  maxFileBytes: 50 * 1024 * 1024,
  maxFilterFields: 10,
  maxFilterPeople: 10,
  queuedPerProject: 3,
  runningPerSite: 10,
  reportsPerProject: 200,
  schedulesPerProject: 5,
  pageSize: 25,
  /** Issues per search, per bulk changelog call and per part object. */
  batchSize: 100,
  idsPerValue: 5_000,
  tokensPerValue: 4_000,
  visibilityBatch: 500,
  valueMaxChars: 500,
  summaryMaxChars: 120,
  reasonMinChars: 15,
  reasonMaxChars: 500,
  maxStepFailures: 3,
  maxGroups: 20,
  /** Time one consumer event works, inside the 900 s limit. */
  eventBudgetMs: 780_000,
  /** Time the daily run works, inside its 600 s limit. */
  dailyBudgetMs: 540_000,
  stalledMs: 2 * 60 * 60 * 1000,
  tmpMaxAgeMs: 24 * 60 * 60 * 1000,
  /** Wait before a queued job that cannot start yet is tried again. */
  requeueSeconds: 60
} as const;

/** The retention a Jira administrator can choose, in days (owner decision Q3). */
export const RETENTION_DAYS = [90, 180, 400, 730, 1095, 1825, 2555] as const;
export type RetentionDays = (typeof RETENTION_DAYS)[number];
export const DEFAULT_RETENTION_DAYS: RetentionDays = 400;

export interface ReportRange {
  /** 00:00 UTC, inclusive. */
  from: string;
  /** 00:00 UTC, exclusive. */
  to: string;
}

/** At most 10 field ids and 10 people; actors are party tokens, never account ids. */
export interface ReportFilters {
  fieldIds: string[];
  actors: string[];
}

export interface ChainLink {
  reportId: string;
  manifestSha256: string;
}

export interface ReportFileRef {
  name: ReportFileName;
  objectKey: string;
  bytes: number;
  sha256: string;
}

export type ReportFileName = 'manifest.json' | 'report.json' | 'report.csv';

/** One report job, at fr:rj:{reportId}. Holds no account id. */
export interface ReportJob {
  schemaVersion: 1;
  reportId: string;
  projectId: string;
  projectKey: string;
  range: ReportRange;
  filters: ReportFilters;
  trigger: ReportTrigger;
  /** A party token, or "scheduled". */
  requestedBy: string;
  scheduleId?: string;
  state: ReportState;
  step?: ReportStep;
  /** The next batch of issue ids to read. */
  cursor: number;
  /** Part objects written so far (tmp/{reportId}/part-{i}.json). */
  parts: number;
  /** How many KVS values hold the job's issue ids. */
  idChunks: number;
  /** How many KVS values hold the report's party tokens (after assembly). */
  tokenChunks?: number;
  failures: number;
  progress: { issuesTotal: number; issuesDone: number; changes: number; linksNotRead: number };
  createdAt: string;
  updatedAt: string;
  startedAt?: string;
  finishedAt?: string;
  error?: { code: string; message: string };
  files?: ReportFileRef[];
  manifestSha256?: string;
  previous?: ChainLink | null;
  keyId?: string;
}

/** One row of the project's report index, at fr:p:{projectKey}:reports (newest first, at most 200). */
export interface ReportIndexEntry {
  reportId: string;
  state: ReportState;
  range: ReportRange;
  filters: ReportFilters;
  trigger: ReportTrigger;
  requestedBy: string;
  createdAt: string;
  finishedAt?: string;
  issues?: number;
  changes?: number;
  bytes?: number;
  reportSha256?: string;
  manifestSha256?: string;
  keyId?: string;
  unsigned?: boolean;
  error?: { code: string; message: string };
}

export interface ReportSchedule {
  scheduleId: string;
  cadence: ReportCadence;
  filters: ReportFilters;
  /** A party token. */
  createdBy: string;
  createdAt: string;
  /** The end of the last period a report was made for. */
  lastPeriodEnd?: string;
}

/** Site settings at fr:cfg:reports. They hold no account id. */
export interface ReportSettings {
  schemaVersion: 1;
  retentionDays: RetentionDays;
  reportGroups: Array<{ partyId: string; partyTypeId: 'GROUP'; name: string }>;
  fromDate: string;
}

export const DEFAULT_REPORT_SETTINGS: ReportSettings = { schemaVersion: 1, retentionDays: DEFAULT_RETENTION_DAYS, reportGroups: [], fromDate: '1970-01-01T00:00:00.000Z' };

/** Written once when a Jira administrator deletes a report early (owner decision Q8). */
export interface ReportTombstone {
  reportId: string;
  deletedAt: string;
  /** A party token. */
  by: string;
  reason: string;
}

export interface ManifestFile {
  name: ReportFileName;
  mediaType: string;
  bytes: number;
  sha256: string;
}

/** The manifest fields that report.json repeats as its header. */
export interface ManifestHeader {
  format: 'fourrealities-evidence-report/1';
  reportId: string;
  siteHost: string;
  environment: string;
  projectId: string;
  projectKey: string;
  range: ReportRange;
  filters: ReportFilters;
  trigger: ReportTrigger;
  requestedBy: string;
  generatedAt: string;
  gatesObservedAt: string;
  appVersion?: string;
  counts: { issues: number; changes: number; missingSincePrevious: number };
  previous: ChainLink | null;
  warning?: 'UNSIGNED';
}

export interface ReportManifest extends ManifestHeader {
  files: ManifestFile[];
  keyId?: string;
  sig?: string;
}

/** A sibling record referenced by id and hash, never copied (ADR-015 section 3). */
export interface LedgerSealRef {
  certificateId: string | null;
  snapshotHash: string | null;
  status: string | null;
  sealedAt: string | null;
  issuedAt: string | null;
  keyId: string | null;
  verification: string;
}

export interface DefinitionGuardRef {
  headHash: string | null;
  stateVersion: number | null;
  issuedAt: string | null;
  mandatoryCompleted: number | null;
  mandatoryTotal: number | null;
  keyId: string | null;
  verification: string;
}

export interface ReportChange {
  changelogId: string;
  at: string;
  /** A party token; null when Jira gives no author. */
  author: string | null;
  fieldId: string;
  field: string;
  fieldClass: FieldClass;
  /** OTHER: Jira's ids; USER: party tokens; FREE_TEXT: null. */
  from: string | null;
  to: string | null;
  /** OTHER only, at most 500 characters each. */
  fromString: string | null;
  toString: string | null;
  /** FREE_TEXT only (owner decision Q4): the field changed, with the lengths, not the text. */
  omitted?: { reason: 'FREE_TEXT'; fromLength: number; toLength: number };
  truncated?: boolean;
}

export interface ReportIssue {
  issueId: string;
  issueKey: string;
  issueTypeName: string;
  summary: string;
  created: string;
  statusCategory: StatusCategory;
  statusId: string;
  gates: Record<GateName, GateResult>;
  rai: number | null;
  risk: RiskLevel;
  ledgerseal: LedgerSealRef | null;
  definitionguard: DefinitionGuardRef | null;
  codeException: Array<{ status: string; at: string; by: string; asRole: string; reason: string; migrated?: boolean }>;
  reworkNotes: Array<{ recordedAt: string; by: string; reason: string; notes?: string }>;
  changes: ReportChange[];
}

export interface ReportWarning {
  code: 'UNSIGNED' | 'REMOTE_LINKS_NOT_READ';
  count?: number;
}

export interface ReportData {
  format: 'fourrealities-evidence-report-data/1';
  header: ManifestHeader;
  sourcesInUse: SourcesInUse;
  decisionIssueTypes: string[];
  issues: ReportIssue[];
  missingSincePrevious: Array<{ issueId: string; issueKey: string }>;
  warnings: ReportWarning[];
}

/** One item of a Jira changelog entry, as the bulk changelog fetch returns it. */
export interface ChangelogItem {
  fieldId: string;
  field: string;
  from: string | null;
  to: string | null;
  fromString: string | null;
  toString: string | null;
}

/** One Jira changelog entry. The author's account id is turned into a party token before any storage. */
export interface ChangelogEntry {
  changelogId: string;
  at: string;
  authorAccountId: string | null;
  items: ChangelogItem[];
}

/** One field of GET /rest/api/3/field. */
export interface FieldInfo {
  id: string;
  name: string;
  schemaType?: string;
  schemaItems?: string;
  custom?: string;
}

/** The issue facts a report needs beyond the gate facts. */
export interface ReportIssueBasics {
  issueId: string;
  issueKey: string;
  issueTypeName: string;
  created: string;
  statusId: string;
}

/** The caller's permissions in one project, asked as the caller in one call (spec v4 section 4.4). */
export interface ReportPermissions {
  /** 200 when Jira answered; anything else fails closed. */
  status: number;
  browse: boolean;
  administerProjects: boolean;
  administerJira: boolean;
}

export const NO_REPORT_PERMISSIONS: ReportPermissions = { status: 0, browse: false, administerProjects: false, administerJira: false };

/** What the caller may do with the project's reports. */
export interface ReportRights {
  canCreate: boolean;
  canSchedule: boolean;
  canDelete: boolean;
  /** Administer projects or Administer Jira. */
  isTier1: boolean;
}

/** Who calls a report resolver: the parts of the Forge context the report Manager uses. */
export interface ReportCaller {
  accountId?: string;
  projectKey?: string;
  projectId?: string;
  licenceActive: boolean;
}

/** A report row as the UI shows it. */
export interface ReportListRow extends ReportIndexEntry {
  /** "Scheduled", "by you", a name read as the viewer, or "a former user". */
  requestedByText: string;
  expiresAt?: string;
  progress?: ReportJob['progress'];
  objectKeys?: Partial<Record<ReportFileName, string>>;
}

export interface ReportsView {
  projectKey: string;
  reports: ReportListRow[];
  schedules: ReportSchedule[];
  tombstones: ReportTombstone[];
  canCreate: boolean;
  canSchedule: boolean;
  canDelete: boolean;
  licenceActive: boolean;
  retentionDays: number;
  signingKeyId: string | null;
  fields: Array<{ id: string; name: string }>;
  next?: string;
}

/** The download check of getEvidenceReport. */
export interface DownloadDecision {
  allowed: boolean;
  code?: ReportErrorCode;
  message?: string;
  count?: number;
}

export interface ReportDetail {
  report: ReportListRow;
  manifest?: ReportManifest;
  download: DownloadDecision;
  fileNames: Record<ReportFileName | 'people.json' | 'people.csv', string>;
}

/** One row of the unsigned people file, made at download as the downloading user. */
export interface PeopleRow {
  token: string;
  accountId: string | null;
  displayName: string | null;
  active: boolean | null;
}

/** A party token map entry at fr:party:{token}. */
export type PartyEntry = { accountId: string; updatedAt: string } | { closed: true; closedAt: string };

/** What the daily report run did. */
export interface ReportDailyResult {
  scheduled: number;
  expired: number;
  tmpDeleted: number;
  stalled: number;
  skipped: boolean;
}

/** The admin page section "Evidence reports". */
export interface ReportSettingsView {
  retentionDays: number;
  allowedRetentionDays: number[];
  policy: { parties: Array<{ partyId: string; name: string }> };
  signingKeyId: string | null;
}

/** A temporary people file, registered at fr:tmp:{createdAt}:{reportId}:{downloadId} (Object Store cannot list). */
export interface TmpObject {
  objectKeys: string[];
  createdAt: string;
}

/** The body of one queue event. */
export interface ReportEvent {
  reportId: string;
}
