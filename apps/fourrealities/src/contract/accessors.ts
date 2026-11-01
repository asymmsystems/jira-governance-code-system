/**
 * Copyright (c) 2026 Asymm Systems. All rights reserved.
 * @author Fahim Farook
 * FourRealities: Accessor contracts (ADR-002). Implementations do all Jira and KVS I/O.
 */

import { Accessor } from './service-types';
import {
  ExceptionRecord,
  IssueFacts,
  IssueRow,
  ProjectSearchResult,
  ProjectSummary,
  RemoteLink,
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
  set(key: string, value: any): Promise<void>;
  delete(key: string): Promise<void>;
  /** One page (at most 100) of keys that start with the prefix. */
  queryPrefix?<T>(prefix: string, cursor?: string): Promise<{ results: Array<{ key: string; value: T }>; nextCursor?: string }>;
}

/** Jira issue reads and user writes, bound to one principal (the user or the app). */
export interface JiraIssueAccessor extends Accessor {
  searchProject(projectKey: string, config: SiteConfig, deadline: number): Promise<ProjectSearchResult>;
  visibleIssueIds(projectKey: string, deadline: number): Promise<VisibleIds>;
  readIssue(issueId: string, config: SiteConfig): Promise<{ status: number; facts?: IssueFacts }>;
  /** Remote links per issue id; an id is absent when its read failed or the deadline passed. */
  remoteLinks(issueIds: string[], deadline: number): Promise<Map<string, RemoteLink[]>>;
  issueProject(issueId: string): Promise<{ status: number; issueKey?: string; projectKey?: string }>;
  pullRequests(issueId: string, devFieldId: string): Promise<{ status: number; issueKey?: string; summary?: DevFieldSummary }>;
  addRemoteLink(issueId: string, link: { url: string; title: string; summary: string }): Promise<number>;
  putExceptionProperty(issueId: string, record: ExceptionRecord): Promise<number>;
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

export interface ExceptionAccessor extends Accessor {
  get(issueId: string): Promise<ExceptionRecord | undefined>;
  save(record: ExceptionRecord): Promise<void>;
  /** All exception records by issue id; one paged prefix query when the store supports it. */
  listByIssue(issueIds: string[]): Promise<Map<string, ExceptionRecord>>;
}
