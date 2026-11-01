/**
 * Copyright (c) 2026 Asymm Systems. All rights reserved.
 * @author Fahim Farook
 * FourRealities: records a Code exception or a rework reason (spec v2, recordException).
 * Orchestration only; rules live in the PolicyEngine.
 */

import { CallerContext, ExceptionRecord } from '../contract/data/models';
import { ExceptionAccessor, JiraIssueAccessor, SiteConfigAccessor } from '../contract/accessors';
import { PolicyEngine } from '../contract/engines';
import { ExceptionManager } from '../contract/managers';

export interface ExceptionManagerDeps {
  userJira: JiraIssueAccessor;
  siteConfig: SiteConfigAccessor;
  exceptions: ExceptionAccessor;
  policy: PolicyEngine;
  now?: () => Date;
}

export class DefaultExceptionManager implements ExceptionManager {
  readonly serviceType = 'manager' as const;

  constructor(private readonly d: ExceptionManagerDeps) {}

  /**
   * The issue property is written as the user first; the KVS record follows only after Jira
   * accepts the write, so a user without edit rights cannot change the gate (FR-05, FR-24).
   */
  async record(caller: CallerContext, payload: any): Promise<{ success: boolean; record?: ExceptionRecord; error?: string }> {
    const issueId = payload?.issueId || caller.issueId;
    if (caller.issueId && payload?.issueId && caller.issueId !== payload.issueId) {
      return { success: false, error: 'Unauthorized: Cannot record exception on external issue.' };
    }
    if (!issueId) {
      return { success: false, error: 'Missing issueId.' };
    }
    const type = payload?.type === 'REWORK' ? 'REWORK' : 'CODE';
    const reason = String(payload?.reason || '').trim();
    const notes = payload?.notes ? String(payload.notes).trim() : undefined;
    const inputError = this.d.policy.exceptionInputError(reason, notes);
    if (inputError) {
      return { success: false, error: inputError };
    }

    let issueKey = String(payload?.issueKey || issueId);
    try {
      const scopeError = await this.scopeError(issueId, caller);
      if (scopeError) {
        return { success: false, error: scopeError };
      }
      const devFieldId = type === 'CODE' ? (await this.d.siteConfig.get()).devFieldId : null;
      if (devFieldId) {
        const prs = await this.d.userJira.pullRequests(issueId, devFieldId);
        if (prs.status !== 200) {
          return { success: false, error: `Jira returned HTTP ${prs.status} reading issue ${issueId}.` };
        }
        issueKey = String(prs.issueKey || issueKey);
        const blocked = this.d.policy.pullRequestBlocksException(prs.summary?.count || 0, issueKey);
        if (blocked) {
          return { success: false, error: blocked };
        }
      }
    } catch (err: any) {
      return { success: false, error: err?.message || 'Failed to check the issue.' };
    }

    const now = this.d.now || (() => new Date());
    const existing = await this.d.exceptions.get(String(issueId));
    const note = { reason, notes, recordedBy: String(caller.accountId || 'unknown-user'), recordedAt: now().toISOString() };
    const record = this.d.policy.mergeException(existing, { issueId: String(issueId), issueKey }, type, note);

    try {
      const status = await this.d.userJira.putExceptionProperty(String(issueId), record);
      if (status === 403) {
        return { success: false, error: `You need the Edit issues permission on ${record.issueKey} to record an exception.` };
      }
      if (status < 200 || status >= 300) {
        return { success: false, error: `Jira returned status ${status} recording the exception.` };
      }
    } catch (err: any) {
      return { success: false, error: err?.message || 'Failed to record exception.' };
    }

    await this.d.exceptions.save(record);
    return { success: true, record };
  }

  /** Reads the issue's project as the user on the project page, then applies the scope rule (FR-06). */
  private async scopeError(issueId: string, caller: CallerContext): Promise<string | undefined> {
    if (caller.issueId || !caller.projectKey) {
      return this.d.policy.scopeError({ issueId }, caller);
    }
    const project = await this.d.userJira.issueProject(issueId);
    if (project.status !== 200) {
      return `Jira returned HTTP ${project.status} reading issue ${issueId}.`;
    }
    return this.d.policy.scopeError({ issueId, issueKey: project.issueKey, projectKey: project.projectKey }, caller);
  }
}
