/**
 * Copyright (c) 2026 Asymm Systems. All rights reserved.
 * @author Fahim Farook
 * FourRealities: Engine contracts (ADR-002).
 */

import { Engine } from './service-types';
import {
  ApprovalView,
  DetectedSources,
  EvidenceSourceSettings,
  SiteConfig,
  SourcesInUse,
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

/** Evaluates the four gates from issue facts (spec v3, Gates), for the checks in use (ADR-011). */
export interface GateEngine extends Engine {
  evaluate(facts: IssueFacts, sources?: SourcesInUse): IssueGates;
}

/** Which evidence sources are in use on the site, and what the reads show of them (ADR-011). */
export interface SourcePolicyEngine extends Engine {
  /** The checks in use from the settings, the detection and the site configuration. */
  resolve(settings: EvidenceSourceSettings, detected: DetectedSources, config: SiteConfig): SourcesInUse;
  /** What these issue reads show of each source; only the fields seen are set. */
  sightings(facts: IssueFacts[], at: string): DetectedSources;
  /** The detection with the sightings added (earliest dates kept), and whether anything changed. */
  merge(detected: DetectedSources, seen: DetectedSources): { detected: DetectedSources; changed: boolean };
  /** Notes for the dashboard: sources found on the site whose check is not in use. */
  notes(settings: EvidenceSourceSettings, detected: DetectedSources, sources: SourcesInUse): string[];
  /** Settings from an admin's input, or an error text. */
  validate(input: unknown, now: string): { settings?: EvidenceSourceSettings; error?: string };
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
  /** What the panel may offer this viewer for the current exception (ADR-011). */
  approvalView(current: GateExceptionState | undefined, actor: ExceptionActor, assigneeAccountId: string | undefined): ApprovalView;
  /** Error text when the actor may not make this decision now, else undefined. */
  decisionError(current: GateExceptionState | undefined, decision: ExceptionDecision, actor: ExceptionActor, assigneeAccountId: string | undefined, reason: string): string | undefined;
}
