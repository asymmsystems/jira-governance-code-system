/**
 * Copyright (c) 2026 Asymm Systems. All rights reserved.
 * @author Fahim Farook
 * FourRealities: gate exception use cases: request a Code exception, decide on it, record a
 * rework note (ADR-001 Patterns 3, 5, Option C). Orchestration only; rules live in the Engines.
 */

import { ApprovalView, CallerContext, DecideExceptionPayload, ExceptionDecision, IssueRow, RecordExceptionPayload, ExceptionProperty, GateExceptionEvent, GateExceptionState, ReworkNote } from '../contract/data/models';
import { ExceptionEventAccessor, JiraDirectoryAccessor, ReworkNoteAccessor, JiraIssueAccessor, SettingsAccessor, SiteConfigAccessor } from '../contract/accessors';
import { ExceptionPolicyEngine, PolicyEngine } from '../contract/engines';
import { ExceptionManager } from '../contract/managers';
import { messageOf } from '../contract/data/errors';

const DECISIONS: ExceptionDecision[] = ['APPROVE', 'REJECT', 'REVOKE', 'WITHDRAW'];

/** Tier 1: Jira permissions that make the caller an approver (ADR-001 Option C, widened by owner decision 1B). */
const APPROVER_PERMISSIONS = ['ADMINISTER_PROJECTS', 'ADMINISTER'];

/** Stored when a decision comes without a comment. Reject and revoke always need a reason. */
const NO_COMMENT: Partial<Record<ExceptionDecision, string>> = {
  APPROVE: 'Approved without comment.',
  WITHDRAW: 'Withdrawn without comment.'
};

export interface ExceptionManagerDeps {
  userJira: JiraIssueAccessor;
  /** Jira as the app: writes the projection property after an approver's decision (ADR-013, F-M1). */
  appJira: JiraIssueAccessor;
  /** The caller's groups, as the user (Tier 2). */
  directory: JiraDirectoryAccessor;
  /** The approver groups. */
  settings: SettingsAccessor;
  siteConfig: SiteConfigAccessor;
  notes: ReworkNoteAccessor;
  events: ExceptionEventAccessor;
  policy: PolicyEngine;
  lifecycle: ExceptionPolicyEngine;
  now?: () => Date;
}

type Result = { success: boolean; record?: ExceptionProperty; error?: string };

export class DefaultExceptionManager implements ExceptionManager {
  readonly serviceType = 'manager' as const;

  constructor(private readonly d: ExceptionManagerDeps) {}

  private now(): string {
    return (this.d.now || (() => new Date()))().toISOString();
  }

  async record(caller: CallerContext, payload: RecordExceptionPayload | undefined): Promise<Result> {
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
    let pullRequestCount = 0;
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
        pullRequestCount = prs.summary?.count || 0;
      }
    } catch (err) {
      return { success: false, error: messageOf(err, 'Failed to check the issue.') };
    }

    const accountId = String(caller.accountId || 'unknown-user');
    const events = await this.d.events.list(String(issueId));
    const earlier = await this.d.notes.list(String(issueId));

    if (type === 'REWORK') {
      const note: ReworkNote = { schemaVersion: 1, issueId: String(issueId), issueKey, reason, ...(notes ? { notes } : {}), recordedBy: accountId, recordedAt: this.now() };
      const property: ExceptionProperty = { schemaVersion: 3, issueId: String(issueId), issueKey, code: this.d.lifecycle.currentState(events), ...this.reworkProjection([...earlier, note]) };
      const written = await this.writeProperty(String(issueId), property);
      if (written) return written;
      await this.d.notes.append(note);
      return { success: true, record: property };
    }

    const current = this.d.lifecycle.currentState(events);
    const requestError = this.d.lifecycle.requestError(current, pullRequestCount, issueKey);
    if (requestError) {
      return { success: false, error: requestError };
    }
    const event: GateExceptionEvent = {
      schemaVersion: 3, issueId: String(issueId), issueKey, gate: 'code', status: 'REQUESTED',
      at: this.now(), byAccountId: accountId, asRole: 'REQUESTER', reason, notes
    };
    return this.commit(event, events, earlier);
  }

  async decide(caller: CallerContext, payload: DecideExceptionPayload | undefined): Promise<Result> {
    const issueId = payload?.issueId || caller.issueId;
    if (caller.issueId && payload?.issueId && caller.issueId !== payload.issueId) {
      return { success: false, error: 'Unauthorized: Cannot change an exception on an external issue.' };
    }
    if (!issueId) {
      return { success: false, error: 'Missing issueId.' };
    }
    if (!caller.accountId) {
      return { success: false, error: 'FourRealities: no signed-in user.' };
    }
    const decision = DECISIONS.find(d => d === payload?.decision);
    if (!decision) {
      return { success: false, error: 'Unknown decision.' };
    }
    const reason = String(payload?.reason || '').trim();

    let isApprover = false;
    let issueKey: string;
    let assigneeAccountId: string | undefined;
    try {
      const project = await this.d.userJira.issueProject(String(issueId));
      if (project.status !== 200) {
        return { success: false, error: `Jira returned HTTP ${project.status} reading issue ${issueId}.` };
      }
      const scopeError = this.d.policy.scopeError({ issueId: String(issueId), issueKey: project.issueKey, projectKey: project.projectKey }, caller);
      if (scopeError) {
        return { success: false, error: scopeError };
      }
      issueKey = String(project.issueKey || issueId);
      assigneeAccountId = project.assigneeAccountId;
      if (decision !== 'WITHDRAW') {
        const approver = await this.isApprover(String(project.projectKey));
        if (approver.error) {
          return { success: false, error: approver.error };
        }
        isApprover = approver.granted;
      }
    } catch (err) {
      return { success: false, error: messageOf(err, 'Failed to check the issue.') };
    }

    const events = await this.d.events.list(String(issueId));
    const current = this.d.lifecycle.currentState(events);
    const decisionError = this.d.lifecycle.decisionError(current, decision, { accountId: caller.accountId, isApprover }, assigneeAccountId, reason);
    if (decisionError) {
      return { success: false, error: decisionError };
    }
    const event: GateExceptionEvent = {
      schemaVersion: 3, issueId: String(issueId), issueKey, gate: 'code', status: this.d.lifecycle.targetStatus(decision),
      at: this.now(), byAccountId: caller.accountId, asRole: decision === 'WITHDRAW' ? 'REQUESTER' : 'APPROVER',
      reason: reason || NO_COMMENT[decision] || ''
    };
    // The approver check passed: the projection is written as the app, so an approver without Edit
    // issues can decide (ADR-013, F-M1). A withdrawal is the requester's own edit and stays the user's.
    return this.commit(event, events, await this.d.notes.list(String(issueId)), decision === 'WITHDRAW' ? this.d.userJira : this.d.appJira);
  }

  /**
   * What the issue panel may offer the viewer for the current exception (ADR-013 decision 5).
   * Undefined when there is nothing to decide. Fails closed: a failed check means "may not decide".
   */
  async approval(caller: CallerContext, row: IssueRow): Promise<ApprovalView | undefined> {
    const current = row.codeException;
    if (!current || (current.status !== 'REQUESTED' && current.status !== 'APPROVED') || !caller.accountId) {
      return undefined;
    }
    let isApprover = false;
    let assignee: string | undefined = row.assigneeAccountId;
    try {
      const project = await this.d.userJira.issueProject(row.issueId);
      if (project.status === 200) {
        assignee = project.assigneeAccountId;
        isApprover = (await this.isApprover(String(project.projectKey))).granted;
      }
    } catch {
      isApprover = false;
    }
    return this.d.lifecycle.approvalView(current, { accountId: caller.accountId, isApprover }, assignee);
  }

  /**
   * Tier 1: ADMINISTER_PROJECTS on the project or global ADMINISTER, as the user. Tier 2: a member of
   * a configured approver group (GET /rest/api/3/myself?expand=groups as the user). A failed group
   * read denies; a failed permission read is reported (Uniform Permission Management Standard).
   */
  private async isApprover(projectKey: string): Promise<{ granted: boolean; error?: string }> {
    const permission = await this.d.userJira.hasAnyPermission(projectKey, APPROVER_PERMISSIONS);
    if (permission.status !== 200) {
      return { granted: false, error: `Jira returned HTTP ${permission.status} checking your permissions.` };
    }
    if (permission.granted) return { granted: true };
    const policy = await this.d.settings.getApproverPolicy();
    const parties = policy?.parties || [];
    if (parties.length === 0) return { granted: false };
    const mine = await this.d.directory.myGroups();
    if (mine.status !== 200) return { granted: false };
    const ids = new Set(parties.map(p => p.partyId));
    const names = new Set(parties.map(p => p.name));
    return { granted: mine.groups.some(g => ids.has(g.groupId) || names.has(g.name)) };
  }

  /** Writes the property projection (as the given principal), then appends the event (never before Jira accepts). */
  private async commit(event: GateExceptionEvent, previous: GateExceptionEvent[], notes: ReworkNote[], jira: JiraIssueAccessor = this.d.userJira): Promise<Result> {
    const state: GateExceptionState | undefined = this.d.lifecycle.currentState([...previous, event]);
    const property: ExceptionProperty = { schemaVersion: 3, issueId: event.issueId, issueKey: event.issueKey, code: state, ...this.reworkProjection(notes) };
    const written = await this.writeProperty(event.issueId, property, jira);
    if (written) return written;
    await this.d.events.append(event);
    return { success: true, record: property };
  }

  /** The latest rework note and the count, for the property projection. */
  private reworkProjection(notes: ReworkNote[]): Pick<ExceptionProperty, 'rework' | 'reworkNoteCount'> {
    if (notes.length === 0) return {};
    const { reason, notes: text, recordedBy, recordedAt } = notes[notes.length - 1];
    return { rework: { reason, ...(text ? { notes: text } : {}), recordedBy, recordedAt }, reworkNoteCount: notes.length };
  }

  /** Undefined on success; else the error result. A 403 stays the user's: no retry as the app (FR-05). */
  private async writeProperty(issueId: string, property: ExceptionProperty, jira: JiraIssueAccessor = this.d.userJira): Promise<Result | undefined> {
    try {
      const status = await jira.putExceptionProperty(issueId, property);
      if (status === 403) {
        return { success: false, error: `You need the Edit issues permission on ${property.issueKey} to record an exception.` };
      }
      if (status < 200 || status >= 300) {
        return { success: false, error: `Jira returned status ${status} recording the exception.` };
      }
      return undefined;
    } catch (err) {
      return { success: false, error: messageOf(err, 'Failed to record exception.') };
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
