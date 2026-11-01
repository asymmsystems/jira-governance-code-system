/**
 * Copyright (c) 2026 Asymm Systems. All rights reserved.
 * @author Fahim Farook
 * FourRealities: Manager contracts (ADR-002). One per use case group.
 */

import { Manager } from './service-types';
import { CallerContext, ExceptionProperty, IssueRow, ProjectDashboardView, ProjectSummary, ResolverResult, ScheduledRunResult, SnapshotMeta } from './data/models';

export interface DashboardManager extends Manager {
  /** Stored snapshot (built once when absent), filtered to what the viewer can browse. */
  view(caller: CallerContext, rebuild: boolean): Promise<ResolverResult<ProjectDashboardView>>;
}

export interface IssueEvidenceManager extends Manager {
  evaluate(caller: CallerContext): Promise<ResolverResult<{ row: IssueRow }>>;
  linkDecision(caller: CallerContext, payload: any): Promise<{ success: boolean; remoteLink?: any; error?: string }>;
}

export interface ExceptionManager extends Manager {
  /** Requests a Code exception, or records a rework note. */
  record(caller: CallerContext, payload: any): Promise<{ success: boolean; record?: ExceptionProperty; error?: string }>;
  /** Approves, rejects, revokes or withdraws a Code exception (ADR-001, Option C). */
  decide(caller: CallerContext, payload: any): Promise<{ success: boolean; record?: ExceptionProperty; error?: string }>;
}

export interface SnapshotManager extends Manager {
  build(projectKey: string, generatedBy: string, deadline: number): Promise<ResolverResult<{ meta: SnapshotMeta; rows: IssueRow[]; summary: ProjectSummary }>>;
  runScheduled(deadline: number): Promise<ScheduledRunResult>;
}
