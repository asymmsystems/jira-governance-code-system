/**
 * Copyright (c) 2026 Asymm Systems. All rights reserved.
 * @author Fahim Farook
 * FourRealities: Engine contracts (ADR-002).
 */

import { Engine } from './service-types';
import {
  ExceptionNote,
  ExceptionRecord,
  GateCount,
  IssueFacts,
  IssueGates,
  IssueRow,
  ProjectSummary,
  RiskLevel,
  SnapshotMeta,
  TrendPoint
} from './data/models';

/** Evaluates the four gates from issue facts (spec v2, Gates). */
export interface GateEngine extends Engine {
  evaluate(facts: IssueFacts): IssueGates;
}

/** RAI, risk, recoverable points and project summaries (spec v2, Metrics). */
export interface MetricsEngine extends Engine {
  rai(gates: IssueGates): number | null;
  risk(rai: number | null): RiskLevel;
  recoverablePoints(gates: IssueGates): number;
  rate(count: Pick<GateCount, 'found' | 'missing'>): number | null;
  buildRow(facts: IssueFacts, gates: IssueGates): IssueRow;
  summarize(rows: IssueRow[]): ProjectSummary;
}

/** Snapshot rules: merging unread Intent results, visibility, staleness and trend points. */
export interface SnapshotEngine extends Engine {
  weekStartOf(iso: string): string;
  trendPoint(summary: ProjectSummary, generatedAt: string): TrendPoint;
  keepPreviousIntent(gates: IssueGates, remoteLinksRead: boolean, previous?: IssueRow): IssueGates;
  visibleRows(rows: IssueRow[], ids: Set<string>): IssueRow[];
  staleWarning(meta: SnapshotMeta, now: number): string | undefined;
}

/** Request validation and access rules for user actions. */
export interface PolicyEngine extends Engine {
  /** Error text when an issue id falls outside the caller's issue view or project, else undefined. */
  scopeError(target: { issueId: string; issueKey?: string; projectKey?: string }, caller: { issueId?: string; projectKey?: string }): string | undefined;
  linkInputError(url: string, title: string): string | undefined;
  exceptionInputError(reason: string, notes?: string): string | undefined;
  pullRequestBlocksException(pullRequestCount: number, issueKey: string): string | undefined;
  mergeException(existing: ExceptionRecord | undefined, issue: { issueId: string; issueKey: string }, type: 'CODE' | 'REWORK', note: ExceptionNote): ExceptionRecord;
}
