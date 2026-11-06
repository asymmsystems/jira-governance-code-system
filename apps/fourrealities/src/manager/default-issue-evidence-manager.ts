/**
 * Copyright (c) 2026 Asymm Systems. All rights reserved.
 * @author Fahim Farook
 * FourRealities: issue panel use cases: evaluate one issue, link a decision record.
 * Orchestration only. Every Jira call runs as the user (FR-05, FR-18).
 */

import { CallerContext, IssueRow, LinkDecisionPayload, RequestReviewPayload, ResolverResult, WriteResult } from '../contract/data/models';
import { ConfluencePageCheckAccessor, ExceptionEventAccessor, ReworkNoteAccessor, JiraIssueAccessor, SettingsAccessor, SiteConfigAccessor } from '../contract/accessors';
import { ExceptionPolicyEngine, GateEngine, MetricsEngine, PolicyEngine, SourcePolicyEngine } from '../contract/engines';
import { IssueEvidenceManager } from '../contract/managers';
import { jiraError, messageOf } from '../contract/data/errors';

export interface IssueEvidenceManagerDeps {
  userJira: JiraIssueAccessor;
  siteConfig: SiteConfigAccessor;
  notes: ReworkNoteAccessor;
  events: ExceptionEventAccessor;
  lifecycle: ExceptionPolicyEngine;
  gates: GateEngine;
  metrics: MetricsEngine;
  policy: PolicyEngine;
  settings: SettingsAccessor;
  sources: SourcePolicyEngine;
  /** Confluence as the user: checks that linked pages exist (F-H4). */
  confluence: ConfluencePageCheckAccessor;
  now?: () => Date;
}

/** Time the panel gives the Confluence page check (F-H4). */
export const PAGE_CHECK_MS = 4_000;

export class DefaultIssueEvidenceManager implements IssueEvidenceManager {
  readonly serviceType = 'manager' as const;

  constructor(private readonly d: IssueEvidenceManagerDeps) {}

  /** Evaluates one Jira issue from the Forge context. A failed Jira read is reported, never served from a cache. */
  async evaluate(caller: CallerContext): Promise<ResolverResult<{ row: IssueRow }>> {
    const issueId = caller.issueId || '';
    const issueKey = String(caller.issueKey || issueId);
    if (!issueId) {
      return { ok: false, error: { code: 'INVALID_INPUT', message: 'FourRealities: open this panel from a Jira issue.' } };
    }
    try {
      const reworkNotes = await this.d.notes.list(issueId);
      const codeException = this.d.lifecycle.currentState(await this.d.events.list(issueId));
      const config = await this.d.siteConfig.get();
      const read = await this.d.userJira.readIssue(issueId, config);
      if (read.status !== 200 || !read.facts) {
        return jiraError(read.status, `FourRealities: Jira returned HTTP ${read.status} for issue '${issueKey}'.`);
      }
      const checked = await this.d.confluence.checkPages(new Map([[issueId, read.facts.remoteLinks || []]]), Date.now() + PAGE_CHECK_MS);
      const facts = { ...read.facts, ...(read.facts.remoteLinks ? { remoteLinks: checked.get(issueId) } : {}), reworkNotes, codeException };
      // The checks in use on this site (ADR-011); a source first seen on this issue is recorded.
      const settings = await this.d.settings.getSettings();
      const at = (this.d.now || (() => new Date()))().toISOString();
      const merged = this.d.sources.merge(await this.d.settings.getDetected(), this.d.sources.sightings([facts], at));
      if (merged.changed) await this.d.settings.saveDetected(merged.detected);
      const sources = this.d.sources.resolve(settings, merged.detected, config);
      return { ok: true, row: this.d.metrics.buildRow(facts, this.d.gates.evaluate(facts, sources)) };
    } catch (err) {
      return jiraError(undefined, `FourRealities: Failed to query Jira for issue '${issueKey}': ${messageOf(err, 'network error')}`);
    }
  }

  /** Adds a remote link as the user. FourRealities never writes evidence that another app owns. */
  async linkDecision(caller: CallerContext, payload: LinkDecisionPayload | undefined): Promise<WriteResult> {
    const issueId = payload?.issueId || caller.issueId;
    if (caller.issueId && payload?.issueId && caller.issueId !== payload.issueId) {
      return { success: false, error: 'Unauthorized: Cannot link decision to external issue.' };
    }
    if (!issueId) {
      return { success: false, error: 'Missing issueId.' };
    }
    const url = String(payload?.url || '').trim();
    const title = String(payload?.title || '').trim();
    const summary = String(payload?.summary || 'Architecture decision record verifying Intent gate.').trim();
    const inputError = this.d.policy.linkInputError(url, title);
    if (inputError) {
      return { success: false, error: inputError };
    }
    try {
      const scopeError = await this.scopeError(issueId, caller);
      if (scopeError) {
        return { success: false, error: scopeError };
      }
      const status = await this.d.userJira.addRemoteLink(issueId, { url, title, summary });
      if (status >= 200 && status < 300) {
        return { success: true, remoteLink: { url, title } };
      }
      if (status === 403) {
        // A user action stays a user action: no retry as the app (FR-05).
        return { success: false, error: `You need the Edit issues permission on ${payload?.issueKey || issueId} to add a link.` };
      }
      return { success: false, error: `Jira returned status ${status} linking decision.` };
    } catch (err) {
      return { success: false, error: messageOf(err, 'Failed to link architecture decision.') };
    }
  }

  /** Requests a retrospective review by posting a Jira comment as the user. Never claims a review happened. */
  async requestReview(caller: CallerContext, payload: RequestReviewPayload | undefined): Promise<WriteResult> {
    const issueId = payload?.issueId || caller.issueId;
    if (caller.issueId && payload?.issueId && caller.issueId !== payload.issueId) {
      return { success: false, error: 'Unauthorized: Cannot request review on external issue.' };
    }
    if (!issueId) {
      return { success: false, error: 'Missing issueId.' };
    }
    const comment = String(payload?.comment || '').trim();
    const inputError = this.d.policy.reviewCommentInputError(comment);
    if (inputError) {
      return { success: false, error: inputError };
    }
    try {
      const scopeError = await this.scopeError(issueId, caller);
      if (scopeError) {
        return { success: false, error: scopeError };
      }
      const status = await this.d.userJira.addComment(issueId, comment);
      if (status >= 200 && status < 300) {
        return { success: true };
      }
      if (status === 403) {
        return { success: false, error: `You need permission to comment on ${payload?.issueKey || issueId}.` };
      }
      return { success: false, error: `Jira returned status ${status} adding review comment.` };
    } catch (err) {
      return { success: false, error: messageOf(err, 'Failed to post review comment.') };
    }
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
