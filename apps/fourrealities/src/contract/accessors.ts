/**
 * Copyright (c) 2026 Asymm Systems. All rights reserved.
 * @author Fahim Farook
 * FourRealities: Accessor contracts (ADR-002). Implementations do all Jira and KVS I/O.
 */

import { Accessor } from './service-types';
import {
  ApproverPolicy,
  DetectedSources,
  EvidenceSourceSettings,
  ExceptionProperty,
  GateExceptionEvent,
  IssueFacts,
  IssueRow,
  ProjectSearchResult,
  ProjectSummary,
  RemoteLink,
  ReworkNote,
  SiteConfig,
  SnapshotMeta,
  StoredSnapshot,
  TrendPoint,
  VisibleIds,
  DevFieldSummary
} from './data/models';

/** Key-value storage as seen by the KVS Accessors. Test fakes implement it. */
export interface StorageProvider {
  get<T>(key: string): Promise<T | undefined>;
  set(key: string, value: unknown): Promise<void>;
  delete(key: string): Promise<void>;
  /** One page (at most 100) of keys that start with the prefix. */
  queryPrefix<T>(prefix: string, cursor?: string): Promise<{ results: Array<{ key: string; value: T }>; nextCursor?: string }>;
}

/** Jira issue reads and user writes, bound to one principal (the user or the app). */
export interface JiraIssueAccessor extends Accessor {
  searchProject(projectKey: string, config: SiteConfig, deadline: number): Promise<ProjectSearchResult>;
  visibleIssueIds(projectKey: string, deadline: number): Promise<VisibleIds>;
  readIssue(issueId: string, config: SiteConfig): Promise<{ status: number; facts?: IssueFacts }>;
  /** Remote links per issue id; an id is absent when its read failed or the deadline passed. */
  remoteLinks(issueIds: string[], deadline: number): Promise<Map<string, RemoteLink[]>>;
  /** The issue's key, project and current assignee. */
  issueProject(issueId: string): Promise<{ status: number; issueKey?: string; projectKey?: string; assigneeAccountId?: string }>;
  /** Whether the caller holds a project permission, for example ADMINISTER_PROJECTS. */
  hasAnyPermission(projectKey: string, permissions: string[]): Promise<{ status: number; granted: boolean }>;
  pullRequests(issueId: string, devFieldId: string): Promise<{ status: number; issueKey?: string; summary?: DevFieldSummary }>;
  addRemoteLink(issueId: string, link: { url: string; title: string; summary: string }): Promise<number>;
  putExceptionProperty(issueId: string, value: ExceptionProperty): Promise<number>;
  addComment(issueId: string, comment: string): Promise<number>;
}

export interface SiteConfigAccessor extends Accessor {
  get(): Promise<SiteConfig>;
}

export interface SnapshotAccessor extends Accessor {
  saveSnapshot(meta: SnapshotMeta, rows: IssueRow[], summary: ProjectSummary): Promise<void>;
  loadSnapshot(projectKey: string): Promise<StoredSnapshot | undefined>;
  recordTrendPoint(projectKey: string, point: TrendPoint): Promise<void>;
  getTrend(projectKey: string): Promise<TrendPoint[]>;
  registerProject(projectKey: string): Promise<void>;
  listProjects(): Promise<string[]>;
  deleteV1ProjectKeys(projectKey: string): Promise<void>;
  deleteV1Signals(): Promise<number>;
}

/** The Forge app context of the current invocation. */
export interface AppContextAccessor extends Accessor {
  /** The licence state; undefined on development installs or outside the Forge runtime. */
  licenceActive(): boolean | undefined;
  /** The Forge environment type; undefined outside the Forge runtime. */
  environmentType(): string | undefined;
}

/** Append-only rework notes (ADR-001 Pattern 6). A note is never rewritten. */
export interface ReworkNoteAccessor extends Accessor {
  append(note: ReworkNote): Promise<void>;
  /** Notes of one issue, oldest first. A v2 rework note with no notes reads as one migrated note. */
  list(issueId: string): Promise<ReworkNote[]>;
  /** Notes of every issue, by issue id, read with paged prefix queries. Includes migrated v2 notes. */
  listAll(): Promise<Map<string, ReworkNote[]>>;
  /** Writes migrated notes for at most `limit` v2 rework notes and removes them from the v2 records; returns the count. */
  migrateV2ReworkNotes(limit: number): Promise<number>;
}

/** Append-only gate exception events (ADR-001 Pattern 3). An event is never rewritten. */
export interface ExceptionEventAccessor extends Accessor {
  append(event: GateExceptionEvent): Promise<void>;
  /** Events of one issue, oldest first. A v2 code note with no events reads as two migrated events. */
  list(issueId: string): Promise<GateExceptionEvent[]>;
  /** Events of every issue, by issue id, read with paged prefix queries. Includes migrated v2 notes. */
  listAll(): Promise<Map<string, GateExceptionEvent[]>>;
  /** Writes migrated events for at most `limit` v2 code notes and removes those notes; returns the count. */
  migrateV2CodeNotes(limit: number): Promise<number>;
}

export interface ConfluencePage {
  readonly title: string;
  readonly url: string;
  readonly spaceKey?: string;
}

export interface ConfluencePageSearchAccessor extends Accessor {
  searchPages(query: string): Promise<{ readonly ok: boolean; readonly pages: ConfluencePage[]; readonly error?: string }>;
}


/** Site settings of the admin page and what FourRealities has seen on the site (ADR-011). */
export interface SettingsAccessor extends Accessor {
  /** The saved settings, or the defaults when none are saved. */
  getSettings(): Promise<EvidenceSourceSettings>;
  saveSettings(settings: EvidenceSourceSettings): Promise<void>;
  getDetected(): Promise<DetectedSources>;
  saveDetected(detected: DetectedSources): Promise<void>;
  getApproverPolicy(): Promise<ApproverPolicy | undefined>;
  saveApproverPolicy(policy: ApproverPolicy): Promise<void>;
}

export interface GroupRef {
  readonly groupId: string;
  readonly name: string;
}

/** Jira users and groups, as the user (Uniform Permission Management Standard). Every check fails closed. */
export interface JiraDirectoryAccessor extends Accessor {
  /** The caller holds the global ADMINISTER permission; false on any error. */
  isJiraAdmin(): Promise<boolean>;
  /** The caller's groups; status other than 200 on error. */
  myGroups(): Promise<{ status: number; groups: GroupRef[] }>;
  /** Groups whose name matches the query, at most 20. */
  searchGroups(query: string): Promise<{ status: number; groups: GroupRef[] }>;
  /** Names of groups by id; an id that cannot be read keeps the id as its name. */
  groupNames(groupIds: string[]): Promise<GroupRef[]>;
  /** Display names by account id, read now and never stored (ADR-012); unreadable ids are left out. */
  userNames(accountIds: string[]): Promise<Record<string, string>>;
}

/** One stored account id, the date of its latest record, and the issues whose records name it. */
export interface StoredAccount {
  accountId: string;
  updatedAt: string;
  issueIds: string[];
}

/** Finds and erases the account ids FourRealities stores (ADR-012). */
export interface PersonalDataAccessor extends Accessor {
  /** Every stored account id, with the date of its latest record. */
  accounts(now: string): Promise<StoredAccount[]>;
  /** Replaces closed accounts with ERASED_ACCOUNT in events and notes, and removes them from snapshots. */
  erase(closedAccountIds: string[]): Promise<void>;
  /** Rewrites snapshot metas that still name a viewer to "user"; returns how many changed. */
  minimiseMeta(): Promise<number>;
}

/** The Forge personal data reporting API (scope report:personal-data). */
export interface PrivacyReportAccessor extends Accessor {
  report(accounts: Array<{ accountId: string; updatedAt: string }>): Promise<Array<{ accountId: string; status: string }>>;
}
