/**
 * Copyright (c) 2026 Asymm Systems. All rights reserved.
 * @author Fahim Farook
 * FourRealities: Accessor, Engine and Manager contracts of the evidence reports (ADR-015, ADR-002).
 */

import { Accessor, Engine, Manager } from './service-types';
import { AdminResult, GateExceptionEvent, GateResult, GateName, IssueFacts, ReworkNote, RiskLevel, SiteConfig, SourcesInUse } from './data/models';
import {
  ChainLink,
  ChangelogEntry,
  DownloadDecision,
  FieldClass,
  FieldInfo,
  ManifestHeader,
  NotReadableIssue,
  PartyEntry,
  PeopleRow,
  ReportCaller,
  ReportChange,
  ReportDailyResult,
  ReportDetail,
  ReportError,
  ReportFilters,
  ReportIndexEntry,
  ReportIssue,
  ReportIssueBasics,
  ReportJob,
  ReportManifest,
  ReportPermissions,
  ReportRange,
  ReportResult,
  ReportRights,
  ReportSchedule,
  ReportSettings,
  ReportSettingsView,
  ReportTombstone,
  ReportsView,
  TmpObject
} from './data/reports';

/** Jira reads of a report, bound to one principal (the user for scope and visibility, the app for the job). */
export interface JiraReportAccessor extends Accessor {
  /** Issue ids of a JQL search, oldest first; stops above `limit` ids (the caller refuses then). */
  searchIds(jql: string, limit: number, deadline: number): Promise<{ status: number; ids: string[] }>;
  /** The ids among `ids` that the principal's search returns (500 per call); null when a call failed. */
  presentAmong(ids: string[], deadline: number): Promise<Set<string> | null>;
  /** Gate facts and report basics of up to 100 issues, read in one search. */
  factsByIds(ids: string[], config: SiteConfig): Promise<{ status: number; issues: Array<{ facts: IssueFacts; basics: ReportIssueBasics }> }>;
  /** The changelog entries of the issues (bulk fetch), optionally only of some fields. */
  changelogs(ids: string[], fieldIds: string[], deadline: number): Promise<{ status: number; byIssue: Map<string, ChangelogEntry[]> }>;
  /** The site's fields (GET /rest/api/3/field). */
  fields(): Promise<{ status: number; fields: FieldInfo[] }>;
}

/** Report jobs, ids, index, chain head, schedules, tombstones and settings in KVS (all keys fr:). */
export interface ReportStoreAccessor extends Accessor {
  getSettings(): Promise<ReportSettings>;
  saveSettings(settings: ReportSettings): Promise<void>;
  getJob(reportId: string): Promise<ReportJob | undefined>;
  saveJob(job: ReportJob): Promise<void>;
  deleteJob(reportId: string): Promise<void>;
  saveIds(reportId: string, ids: string[]): Promise<number>;
  loadIds(reportId: string, chunks: number): Promise<string[]>;
  deleteIds(reportId: string, chunks: number): Promise<void>;
  saveTokens(reportId: string, tokens: string[]): Promise<number>;
  loadTokens(reportId: string, chunks: number): Promise<string[]>;
  deleteTokens(reportId: string, chunks: number): Promise<void>;
  /** The project's entries, newest first. Each entry is its own KVS value, so writers never overwrite each other's rows (review M-1). */
  getIndex(projectKey: string): Promise<ReportIndexEntry[]>;
  putEntry(projectKey: string, entry: ReportIndexEntry): Promise<void>;
  deleteEntry(projectKey: string, entry: ReportIndexEntry): Promise<void>;
  /** Makes the index exactly these entries (tests and tools). */
  saveIndex(projectKey: string, entries: ReportIndexEntry[]): Promise<void>;
  getHead(projectKey: string): Promise<ChainLink | undefined>;
  /** Writes the DONE job, its index entry and the head in one transaction. */
  commitDone(job: ReportJob, projectKey: string, entry: ReportIndexEntry, head: ChainLink): Promise<void>;
  getSchedules(projectKey: string): Promise<ReportSchedule[]>;
  saveSchedules(projectKey: string, schedules: ReportSchedule[]): Promise<void>;
  /** Written once; never rewritten. */
  addTombstone(projectKey: string, tombstone: ReportTombstone): Promise<void>;
  listTombstones(projectKey: string): Promise<ReportTombstone[]>;
  /** The projects that have reports or schedules. */
  projects(): Promise<string[]>;
  registerProject(projectKey: string, projectId: string): Promise<void>;
  projectId(projectKey: string): Promise<string | undefined>;
  addTmp(id: string, entry: TmpObject): Promise<void>;
  listTmp(): Promise<Array<{ id: string; entry: TmpObject }>>;
  deleteTmp(id: string): Promise<void>;
}

/** Forge Object Store: objects are written once (the app refuses to write an existing key). */
export interface ObjectStoreAccessor extends Accessor {
  /** False when the key exists already or the write failed. */
  putOnce(key: string, body: string, contentType: string): Promise<boolean>;
  readText(key: string): Promise<string | undefined>;
  exists(key: string): Promise<boolean>;
  delete(key: string): Promise<void>;
  /** A pre-signed download URL, valid 1 hour. */
  downloadUrl(key: string): Promise<string | undefined>;
}

export interface ReportQueueAccessor extends Accessor {
  push(reportId: string, delaySeconds?: number): Promise<void>;
}

/** Hashes and the Ed25519 signature (the encrypted Forge variable FOURREALITIES_SIGNING_KEY). */
export interface ReportCryptoAccessor extends Accessor {
  digest(text: string): { sha256: string; bytes: number };
  /** The signature of the text, or null when no key is set for this environment. */
  sign(text: string): { keyId: string; sig: string } | null;
  /** The key id used to sign, or null. */
  keyId(): string | null;
  newId(): string;
}

/** Party tokens (ADR-011 pattern): an HMAC-SHA-256 of an account id under a per-site key. */
export interface PartyTokenAccessor extends Accessor {
  /** Tokens for the account ids; each new token is written to the map. */
  tokensFor(accountIds: string[], now: string): Promise<Record<string, string>>;
  entries(tokens: string[]): Promise<Record<string, PartyEntry | undefined>>;
}

/** The Forge runtime facts a report header names. */
export interface ReportRuntimeAccessor extends Accessor {
  environment(): string;
  appVersion(): string | undefined;
  licenceActive(): boolean | undefined;
}

/** People as the downloading user (scope read:jira-user). */
export interface ReportPeopleAccessor extends Accessor {
  people(accountIds: string[]): Promise<Record<string, { displayName: string; active: boolean }>>;
  myGroupIds(): Promise<{ status: number; groupIds: string[] }>;
}

/** Field classes, scope, rows, files and the manifest. Pure (ADR-002). */
export interface ReportEngine extends Engine {
  classifyField(fieldId: string, fields: FieldInfo[]): FieldClass;
  /** The changes in the range that pass the filters, oldest first, with tokens for people. */
  reportChanges(entries: ChangelogEntry[], range: ReportRange, filters: ReportFilters, fields: FieldInfo[], tokenOf: Record<string, string>): ReportChange[];
  inScope(created: string, changes: ReportChange[], range: ReportRange): boolean;
  reportIssue(input: {
    facts: IssueFacts;
    basics: ReportIssueBasics;
    gates: Record<GateName, GateResult>;
    rai: number | null;
    risk: RiskLevel;
    events: GateExceptionEvent[];
    notes: ReworkNote[];
    changes: ReportChange[];
    tokenOf: Record<string, string>;
  }): ReportIssue;
  /** Every account id of the entries, the events and the notes that a token must replace. */
  accountIdsOf(entries: ChangelogEntry[], fields: FieldInfo[], events: GateExceptionEvent[], notes: ReworkNote[]): string[];
  tokensOf(issues: ReportIssue[], filters: ReportFilters, requestedBy: string): string[];
  canonicalJson(value: unknown): string;
  reportJson(data: { header: ManifestHeader; sourcesInUse: SourcesInUse; issues: ReportIssue[]; missingSincePrevious: Array<{ issueId: string; issueKey: string }>; notReadable: NotReadableIssue[]; linksNotRead: number }): string;
  reportCsv(reportId: string, issues: ReportIssue[]): string;
  /** The manifest without its signature, with keyId when a key signs it; signedText is what the key signs. */
  manifest(header: ManifestHeader, files: ReportManifest['files'], keyId: string | null): { manifest: ReportManifest; signedText: string };
  peopleCsv(rows: PeopleRow[]): string;
  fileName(projectKey: string, range: ReportRange, reportId: string, file: string): string;
  /** The JQL of the issues that may be in scope, one day wider each side (JQL dates use the site time zone). */
  scopeJql(projectId: string, range: ReportRange): string;
  idsJql(ids: string[]): string;
}

/** Validation, rights, job transitions, periods and retention. Pure (ADR-002). */
export interface ReportPolicyEngine extends Engine {
  rights(permissions: ReportPermissions, inReportGroup: boolean): ReportRights;
  validateCreate(input: unknown, fields: FieldInfo[], now: Date): { range: ReportRange; fieldIds: string[]; actorAccountIds: string[] } | { error: ReportError };
  validateSchedule(input: unknown, fields: FieldInfo[]): { scheduleId?: string; cadence: ReportSchedule['cadence']; fieldIds: string[]; actorAccountIds: string[] } | { error: ReportError };
  validateSettings(input: unknown): { retentionDays: ReportSettings['retentionDays']; groupIds: string[] } | { error: string };
  validateReason(input: unknown): { reason: string } | { error: ReportError };
  isReportId(value: unknown): value is string;
  /** The index with room for one more report, or REPORT_LIMIT. */
  admit(entries: ReportIndexEntry[]): { entries: ReportIndexEntry[] } | { error: ReportError };
  /** JOB_LIMIT when the project already has 3 queued jobs. */
  jobLimit(entries: ReportIndexEntry[]): ReportError | undefined;
  /** Whether a queued job may start now. */
  mayStart(projectEntries: ReportIndexEntry[], reportId: string, siteRunning: number): boolean;
  canTransition(from: ReportJob['state'] | undefined, to: ReportJob['state']): boolean;
  /** The periods of the schedule that have ended and have no report, oldest first, at most 3. */
  duePeriods(schedule: ReportSchedule, now: Date): ReportRange[];
  expiresAt(finishedAt: string, retentionDays: number): string;
  retentionDue(entries: ReportIndexEntry[], retentionDays: number, now: Date): string[];
  stalled(job: ReportJob, now: Date): boolean;
  /** Refuses a download when the viewer cannot see an issue that exists, or a deleted issue without Tier 1. */
  download(input: { total: number; hidden: number; deleted: number; isTier1: boolean }): DownloadDecision;
  tooLarge(bytes: number[], changes: number): ReportError | undefined;
}

/** The project page resolvers of the reports (each after the caller's permission check as the user). */
export interface EvidenceReportManager extends Manager {
  list(caller: ReportCaller, permissions: ReportPermissions, payload: unknown): Promise<ReportResult<ReportsView>>;
  create(caller: ReportCaller, permissions: ReportPermissions, payload: unknown): Promise<ReportResult<{ reportId: string; state: 'QUEUED' }>>;
  detail(caller: ReportCaller, permissions: ReportPermissions, payload: unknown): Promise<ReportResult<ReportDetail>>;
  /** The useObjectStore contract: { [presignedUrl]: key }; empty when refused. */
  downloadUrls(caller: ReportCaller, permissions: ReportPermissions, payload: unknown): Promise<Record<string, string>>;
  saveSchedule(caller: ReportCaller, permissions: ReportPermissions, payload: unknown): Promise<ReportResult<{ schedules: ReportSchedule[] }>>;
  deleteSchedule(caller: ReportCaller, permissions: ReportPermissions, payload: unknown): Promise<ReportResult<{ schedules: ReportSchedule[] }>>;
  deleteReport(caller: ReportCaller, permissions: ReportPermissions, payload: unknown): Promise<ReportResult<{ tombstone: ReportTombstone }>>;
}

/** The queue consumer and the daily run (as the app). */
export interface ReportJobManager extends Manager {
  /** One event of a job; eventId names the event's lease (review L-1). */
  work(reportId: string, deadline: number, eventId?: string): Promise<void>;
  daily(deadline: number, licenceActive: boolean): Promise<ReportDailyResult>;
  /** Removes temporary people files older than 24 hours (hourly and in the daily run). */
  sweepTmp(deadline: number): Promise<{ deleted: number; skipped: boolean }>;
}

/** The admin page section "Evidence reports": Jira administrators only, checked as the user on every call. */
export interface ReportSettingsManager extends Manager {
  view(): Promise<AdminResult<ReportSettingsView>>;
  save(input: unknown): Promise<AdminResult<ReportSettingsView>>;
}
