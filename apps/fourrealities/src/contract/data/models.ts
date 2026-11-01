/**
 * Copyright (c) 2026 Asymm Systems. All rights reserved.
 * @author Fahim Farook
 * FourRealities: contract data. Value types only, no behaviour (ADR-002).
 */

export type GateName = 'intent' | 'process' | 'code' | 'audit';

export const GATE_NAMES: GateName[] = ['intent', 'process', 'code', 'audit'];

/** Rows per snapshot chunk in KVS (spec v2, Storage Schema). */
export const CHUNK_SIZE_HINT = 100;

/** Order in which a missing gate is offered as the next thing to fix. */
export const RECOVERY_ORDER: GateName[] = ['intent', 'code', 'process', 'audit'];

export type PullRequestState = 'MERGED' | 'OPEN' | 'DECLINED';

/** Pull request summary parsed from the Jira Development field. Review approval is not in it. */
export interface DevFieldSummary {
  count: number;
  state: PullRequestState | null;
  openCount: number;
  mergedCount: number;
  declinedCount: number;
}

export const NO_PULL_REQUEST: DevFieldSummary = { count: 0, state: null, openCount: 0, mergedCount: 0, declinedCount: 0 };

/**
 * Evidence state of one gate. FOUND and MISSING are scored; the other states are excluded
 * from every score and rate.
 */
export type GateState = 'FOUND' | 'MISSING' | 'EXCEPTED' | 'NEEDS_RECHECK' | 'NOT_APPLICABLE';

/**
 * How FourRealities knows a FOUND fact: it read the fact itself (VERIFIED), another app
 * reports it and nothing verifies it (NOT_VERIFIED), or it is inferred (HEURISTIC).
 */
export type Verification = 'VERIFIED' | 'NOT_VERIFIED' | 'HEURISTIC';

/** Reason codes. The UI turns each code into a source line and plain text. */
export type GateReason =
  | 'NOT_STARTED'
  | 'NOT_DONE'
  | 'INTENT_CONFLUENCE_LINK'
  | 'INTENT_DECISION_ISSUE'
  | 'INTENT_LINKS_NOT_READ'
  | 'INTENT_NONE'
  | 'DOD_COMPLETE_DG'
  | 'DOD_OPEN_DG'
  | 'DOD_SHAPE_UNKNOWN'
  | 'DOD_COMPLETE_HC'
  | 'DOD_OPEN_HC'
  | 'DOD_NONE'
  | 'CODE_EXCEPTED'
  | 'PR_MERGED'
  | 'PR_OPEN'
  | 'PR_OPEN_AT_DONE'
  | 'PR_NONE'
  | 'NO_DEV_TOOL'
  | 'SEAL_VALID_LS'
  | 'SEAL_BROKEN_LS'
  | 'SEAL_OTHER_LS'
  | 'SEAL_SHAPE_UNKNOWN'
  | 'SEAL_NONE'
  | 'CHANGED_SINCE_ATTESTATION';

export interface GateResult {
  state: GateState;
  verification?: Verification;
  reason: GateReason;
  args?: Record<string, string | number>;
}

export type IssueGates = Record<GateName, GateResult>;

export type StatusCategory = 'new' | 'indeterminate' | 'done';

export type RiskLevel = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL' | 'UNRATED';

export interface ExceptionNote {
  reason: string;
  notes?: string;
  recordedBy: string;
  recordedAt: string;
}

/** Stored in KVS at fr:issue:{issueId}:exception and in the fourrealities-exception property. */
export interface ExceptionRecord {
  schemaVersion: 2;
  issueId: string;
  issueKey: string;
  code?: ExceptionNote;
  rework?: ExceptionNote;
}

/** The v1 exception record shape, read for migration only. */
export interface IssueExceptionRecord {
  issueId: string;
  issueKey: string;
  type: 'CODE' | 'REWORK';
  reason: string;
  notes?: string;
  recordedBy: string;
  recordedAt: string;
}

/** Facts about one issue, parsed from Jira. Gate rules read only these facts. */
export interface IssueFacts {
  issueId: string;
  issueKey: string;
  summary: string;
  statusName: string;
  statusCategory: StatusCategory;
  assigneeName?: string;
  sprintNames: string[];
  updated?: string;
  /** The status category is not "new", or the status changed at least once. */
  started: boolean;
  statusChanges: number;
  reworkLoops: number;
  issueLinks: Array<{ key?: string; summary?: string; typeName?: string; linkInward?: string; linkOutward?: string }>;
  /** undefined means the remote links were not read. */
  remoteLinks?: Array<{ url?: string; title?: string; applicationType?: string }>;
  siteHost?: string;
  /** present: the site has a Development field. summary: parsed pull request counts. */
  devField: { present: boolean; summary: DevFieldSummary };
  properties: { ledgerseal?: any; dod?: any; checklist?: any };
  exception?: ExceptionRecord;
}

/** One issue as shown in the dashboard and the issue panel. */
export interface IssueRow {
  issueId: string;
  issueKey: string;
  summary: string;
  statusName: string;
  statusCategory: StatusCategory;
  assigneeName?: string;
  sprintNames: string[];
  started: boolean;
  gates: IssueGates;
  reworkLoops: number;
  rai: number | null;
  risk: RiskLevel;
  applicableGates: number;
  recoverablePoints: number;
  exception?: ExceptionNote;
  reworkNote?: ExceptionNote;
}

export interface GateCount {
  found: number;
  missing: number;
  excepted: number;
  recheck: number;
  notApplicable: number;
}

export interface ProjectSummary {
  totalIssues: number;
  ratedIssues: number;
  unratedIssues: number;
  averageRAI: number | null;
  gates: Record<GateName, GateCount>;
  m11IntentRate: number | null;
  m29PullRequestRate: number | null;
  m30ReworkRate: number | null;
  dodRate: number | null;
  sealRate: number | null;
  startedIssues: number;
  reworkIssues: number;
  riskDistribution: { low: number; medium: number; high: number; critical: number; unrated: number };
}

export interface TrendPoint {
  weekStart: string;
  generatedAt: string;
  ratedIssues: number;
  averageRAI: number | null;
  gates: Record<GateName, { found: number; missing: number }>;
  startedIssues: number;
  reworkIssues: number;
}

export interface SnapshotMeta {
  schemaVersion: 2;
  projectKey: string;
  snapshotId: string;
  generatedAt: string;
  generatedBy: string;
  chunkCount: number;
  shownCount: number;
  totalKnown: number | null;
  capped: boolean;
  remoteLinksRead: number;
}

/** Response of getProjectDashboard and refreshProjectSnapshot. */
export interface ProjectDashboardView {
  projectKey: string;
  generatedAt: string;
  summary: ProjectSummary;
  rows: IssueRow[];
  trend: TrendPoint[];
  /** How many issues were read, and how many the project has. */
  coverage: { shown: number; totalKnown: number | null; capped: boolean };
  meta?: SnapshotMeta;
  warning?: string;
}

export type ResolverError = {
  code: 'INVALID_INPUT' | 'FORBIDDEN' | 'NOT_FOUND' | 'JIRA_ERROR' | 'RATE_LIMITED' | 'LICENSE_INACTIVE';
  message: string;
  status?: number;
};

export type ResolverResult<T> = ({ ok: true } & T) | { ok: false; error: ResolverError };

export type RemoteLink = { url?: string; title?: string; applicationType?: string };

/** Per-site configuration read from Jira (spec v2, Storage Schema). */
export interface SiteConfig {
  /** Id of the Development field, or null when the site has none. */
  devFieldId: string | null;
  /** Host name of this Jira site, used to recognise Confluence pages on the same site. */
  siteHost: string | null;
  readAt: string;
}

export interface ProjectSearchResult {
  facts: IssueFacts[];
  capped: boolean;
  /** Exact count when not capped; approximate count when capped; null when unknown. */
  totalKnown: number | null;
  status?: number;
  error?: string;
}

export interface VisibleIds {
  ids: Set<string>;
  complete: boolean;
  status?: number;
}

export interface StoredSnapshot {
  meta: SnapshotMeta;
  rows: IssueRow[];
}

export interface ScheduledRunResult {
  built: string[];
  failed: string[];
  skipped: string[];
  signalsDeleted: number;
}

/** Who calls, from where: the parts of the Forge context that Managers use. */
export interface CallerContext {
  accountId?: string;
  issueId?: string;
  issueKey?: string;
  projectKey?: string;
}
