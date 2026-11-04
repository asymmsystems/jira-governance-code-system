/**
 * Copyright (c) 2026 Asymm Systems. All rights reserved.
 * @author Fahim Farook
 * FourRealities: Engine contracts (ADR-002).
 */

import { Engine } from './service-types';
import {
  ExceptionActor,
  ExceptionDecision,
  ExceptionStatus,
  GateExceptionEvent,
  GateExceptionState,
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
  reviewCommentInputError(comment: string): string | undefined;
}

/** Gate exception lifecycle rules (ADR-001 Patterns 3 and 5, Option C). */
export interface ExceptionPolicyEngine extends Engine {
  /** Current state from the events, newest last; undefined when there are none. */
  currentState(events: GateExceptionEvent[]): GateExceptionState | undefined;
  /** Error text when a new request is not allowed now, else undefined. */
  requestError(current: GateExceptionState | undefined, pullRequestCount: number, issueKey: string): string | undefined;
  /** The status a decision leads to. */
  targetStatus(decision: ExceptionDecision): ExceptionStatus;
  /** Error text when the actor may not make this decision now, else undefined. */
  decisionError(current: GateExceptionState | undefined, decision: ExceptionDecision, actor: ExceptionActor, assigneeAccountId: string | undefined, reason: string): string | undefined;
}
