/**
 * Copyright (c) 2026 Asymm Systems. All rights reserved.
 * @author Fahim Farook
 * FourRealities: Manager contracts (ADR-002). One per use case group.
 */

import { Manager } from './service-types';
import { PersonalDataRunResult, AdminResult, AdminView, ApprovalView, CallerContext, DecideExceptionPayload, IssueRow, LinkDecisionPayload, ProjectDashboardView, ProjectSummary, RecordExceptionPayload, RequestReviewPayload, ResolverResult, ScheduledRunResult, SnapshotMeta, WriteResult } from './data/models';

export interface DashboardManager extends Manager {
  /** Stored snapshot (built once when absent), filtered to what the viewer can browse. */
  view(caller: CallerContext, rebuild: boolean): Promise<ResolverResult<ProjectDashboardView>>;
}

export interface IssueEvidenceManager extends Manager {
  evaluate(caller: CallerContext): Promise<ResolverResult<{ row: IssueRow }>>;
  linkDecision(caller: CallerContext, payload: LinkDecisionPayload | undefined): Promise<WriteResult>;
  requestReview(caller: CallerContext, payload: RequestReviewPayload | undefined): Promise<WriteResult>;
}

export interface ExceptionManager extends Manager {
  /** Requests a Code exception, or records a rework note. */
  record(caller: CallerContext, payload: RecordExceptionPayload | undefined): Promise<WriteResult>;
  /** Approves, rejects, revokes or withdraws a Code exception (ADR-001, Option C). */
  decide(caller: CallerContext, payload: DecideExceptionPayload | undefined): Promise<WriteResult>;
  /** What the issue panel may offer the viewer for the row's Code exception (ADR-011). */
  approval(caller: CallerContext, row: IssueRow): Promise<ApprovalView | undefined>;
}

export interface SnapshotManager extends Manager {
  build(projectKey: string, generatedBy: string, deadline: number): Promise<ResolverResult<{ meta: SnapshotMeta; rows: IssueRow[]; summary: ProjectSummary }>>;
  runScheduled(deadline: number): Promise<ScheduledRunResult>;
}

/** The admin page "FourRealities gate authority": Jira administrators only, checked on every call (ADR-011). */
export interface AdminManager extends Manager {
  view(): Promise<AdminResult<AdminView>>;
  saveSources(payload: unknown): Promise<AdminResult<AdminView>>;
  searchGroups(payload: unknown): Promise<AdminResult<{ groups: Array<{ groupId: string; name: string }> }>>;
  saveApprovers(payload: unknown): Promise<AdminResult<AdminView>>;
}

/** The weekly personal data report and the erasure of closed accounts (ADR-012). */
export interface PersonalDataManager extends Manager {
  run(): Promise<PersonalDataRunResult>;
}
