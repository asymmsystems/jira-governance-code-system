/**
 * Copyright (c) 2026 Asymm Systems. All rights reserved.
 * @author Fahim Farook
 * FourRealities: gate exception lifecycle rules (ADR-001 Patterns 3 and 5, Option C). Pure, no I/O.
 */

import {
  ExceptionActor,
  ExceptionDecision,
  ExceptionStatus,
  GateExceptionEvent,
  GateExceptionState
} from '../contract/data/models';
import { ExceptionPolicyEngine } from '../contract/engines';

/** Valid transitions (Knowledge Level): the decision, the status it needs, the status it gives. */
const TRANSITIONS: Record<ExceptionDecision, { from: ExceptionStatus; to: ExceptionStatus; stateError: string }> = {
  APPROVE: { from: 'REQUESTED', to: 'APPROVED', stateError: 'Only a waiting request can be approved or rejected.' },
  REJECT: { from: 'REQUESTED', to: 'REJECTED', stateError: 'Only a waiting request can be approved or rejected.' },
  REVOKE: { from: 'APPROVED', to: 'REVOKED', stateError: 'Only an approved exception can be revoked.' },
  WITHDRAW: { from: 'REQUESTED', to: 'WITHDRAWN', stateError: 'Only a waiting request can be withdrawn.' }
};

export class DefaultExceptionPolicyEngine implements ExceptionPolicyEngine {
  readonly serviceType = 'engine' as const;

  currentState(events: GateExceptionEvent[]): GateExceptionState | undefined {
    const ordered = [...events].sort((a, b) => a.at.localeCompare(b.at));
    let state: GateExceptionState | undefined;
    for (const e of ordered) {
      if (e.status === 'REQUESTED') {
        state = { status: 'REQUESTED', issueKey: e.issueKey, requestedBy: e.byAccountId, requestedAt: e.at, reason: e.reason, notes: e.notes, migrated: e.migrated };
      } else if (state) {
        state = { ...state, status: e.status, decidedBy: e.byAccountId, decidedAt: e.at, decisionReason: e.reason };
      }
    }
    return state;
  }

  requestError(current: GateExceptionState | undefined, pullRequestCount: number, issueKey: string): string | undefined {
    if (pullRequestCount > 0) {
      return `A pull request is linked to ${issueKey}. A Code exception applies only to work with no pull request.`;
    }
    if (current?.status === 'REQUESTED') {
      return `An exception request for ${issueKey} is already waiting for approval.`;
    }
    if (current?.status === 'APPROVED') {
      return `${issueKey} already has an approved exception.`;
    }
    return undefined;
  }

  targetStatus(decision: ExceptionDecision): ExceptionStatus {
    return TRANSITIONS[decision].to;
  }

  /**
   * Withdraw: only the requester, while waiting. Approve, reject, revoke: a project administrator
   * who is neither the requester nor the issue's assignee (separation of duties).
   */
  decisionError(current: GateExceptionState | undefined, decision: ExceptionDecision, actor: ExceptionActor, assigneeAccountId: string | undefined, reason: string): string | undefined {
    if (!current) {
      return 'There is no exception request on this issue.';
    }
    const transition = TRANSITIONS[decision];
    if (current.status !== transition.from) {
      return transition.stateError;
    }
    if (decision === 'WITHDRAW') {
      return actor.accountId === current.requestedBy ? undefined : 'Only the person who requested the exception can withdraw it.';
    }
    if (!actor.isProjectAdmin) {
      return 'Only a project administrator or a Jira administrator can approve, reject or revoke an exception.';
    }
    if (actor.accountId === current.requestedBy) {
      return 'The person who requested the exception cannot approve, reject or revoke it.';
    }
    if (assigneeAccountId && actor.accountId === assigneeAccountId) {
      return "The issue's assignee cannot approve, reject or revoke its exception.";
    }
    if (decision !== 'APPROVE' && (reason.length < 15 || reason.length > 500)) {
      return 'Give a reason of 15 to 500 characters.';
    }
    if (reason.length > 500) {
      return 'A reason can be at most 500 characters.';
    }
    return undefined;
  }
}
