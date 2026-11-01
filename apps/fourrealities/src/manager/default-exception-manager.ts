/**
 * Copyright (c) 2026 Asymm Systems. All rights reserved.
 * @author Fahim Farook
 * FourRealities: gate exception use cases: request a Code exception, decide on it, record a
 * rework note (ADR-001 Patterns 3, 5, Option C). Orchestration only; rules live in the Engines.
 */

import { CallerContext, DecideExceptionPayload, ExceptionDecision, RecordExceptionPayload, ExceptionProperty, GateExceptionEvent, GateExceptionState, ReworkNote } from '../contract/data/models';
import { ExceptionEventAccessor, ReworkNoteAccessor, JiraIssueAccessor, SiteConfigAccessor } from '../contract/accessors';
import { ExceptionPolicyEngine, PolicyEngine } from '../contract/engines';
import { ExceptionManager } from '../contract/managers';
import { messageOf } from '../contract/data/errors';

const DECISIONS: ExceptionDecision[] = ['APPROVE', 'REJECT', 'REVOKE', 'WITHDRAW'];

export interface ExceptionManagerDeps {
  userJira: JiraIssueAccessor;
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

    let isProjectAdmin = false;
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
        const permission = await this.d.userJira.hasProjectPermission(String(project.projectKey), 'ADMINISTER_PROJECTS');
        if (permission.status !== 200) {
          return { success: false, error: `Jira returned HTTP ${permission.status} checking your permissions.` };
        }
        isProjectAdmin = permission.granted;
      }
    } catch (err) {
      return { success: false, error: messageOf(err, 'Failed to check the issue.') };
    }

    const events = await this.d.events.list(String(issueId));
    const current = this.d.lifecycle.currentState(events);
    const decisionError = this.d.lifecycle.decisionError(current, decision, { accountId: caller.accountId, isProjectAdmin }, assigneeAccountId, reason);
    if (decisionError) {
      return { success: false, error: decisionError };
    }
    const event: GateExceptionEvent = {
      schemaVersion: 3, issueId: String(issueId), issueKey, gate: 'code', status: this.d.lifecycle.targetStatus(decision),
      at: this.now(), byAccountId: caller.accountId, asRole: decision === 'WITHDRAW' ? 'REQUESTER' : 'APPROVER',
      reason: reason || 'Approved without comment.'
    };
    return this.commit(event, events, await this.d.notes.list(String(issueId)));
  }

  /** Writes the property projection as the user, then appends the event (never before Jira accepts). */
  private async commit(event: GateExceptionEvent, previous: GateExceptionEvent[], notes: ReworkNote[]): Promise<Result> {
    const state: GateExceptionState | undefined = this.d.lifecycle.currentState([...previous, event]);
    const property: ExceptionProperty = { schemaVersion: 3, issueId: event.issueId, issueKey: event.issueKey, code: state, ...this.reworkProjection(notes) };
    const written = await this.writeProperty(event.issueId, property);
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
  private async writeProperty(issueId: string, property: ExceptionProperty): Promise<Result | undefined> {
    try {
      const status = await this.d.userJira.putExceptionProperty(issueId, property);
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
