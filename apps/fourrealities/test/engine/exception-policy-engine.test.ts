/**
 * Copyright (c) 2026 Asymm Systems. All rights reserved.
 * @author Fahim Farook
 * FourRealities: gate exception lifecycle rules (ADR-001 Patterns 3 and 5, Option C)
 */

import { DefaultExceptionPolicyEngine } from '../../src/engine/default-exception-policy-engine';
import { GateExceptionEvent } from '../../src/contract/data/models';

const policy = new DefaultExceptionPolicyEngine();
const ev = (status: GateExceptionEvent['status'], at: string, by: string, extra: Partial<GateExceptionEvent> = {}): GateExceptionEvent => ({
  schemaVersion: 3, issueId: '1', issueKey: 'DEMO-1', gate: 'code', status, at, byAccountId: by,
  asRole: status === 'REQUESTED' || status === 'WITHDRAWN' ? 'REQUESTER' : 'APPROVER', reason: `${status} reason text`, ...extra
});
const admin = (accountId: string) => ({ accountId, isProjectAdmin: true });
const REASON = 'Configuration change only, no code';

describe('currentState', () => {
  it('is undefined with no events and follows the newest event', () => {
    expect(policy.serviceType).toBe('engine');
    expect(policy.currentState([])).toBeUndefined();
    const state = policy.currentState([
      ev('APPROVED', '2026-11-01T10:05:00Z', 'admin-1'),
      ev('REQUESTED', '2026-11-01T10:00:00Z', 'dev-1', { notes: 'CHG-1' })
    ]);
    expect(state).toEqual({
      status: 'APPROVED', issueKey: 'DEMO-1', requestedBy: 'dev-1', requestedAt: '2026-11-01T10:00:00Z', reason: 'REQUESTED reason text', notes: 'CHG-1',
      decidedBy: 'admin-1', decidedAt: '2026-11-01T10:05:00Z', decisionReason: 'APPROVED reason text', migrated: undefined
    });
  });

  it('starts a fresh request after a rejection, and carries the migrated flag', () => {
    const state = policy.currentState([
      ev('REQUESTED', '2026-11-01T10:00:00Z', 'dev-1'),
      ev('REJECTED', '2026-11-01T10:05:00Z', 'admin-1'),
      ev('REQUESTED', '2026-11-02T09:00:00Z', 'dev-2', { reason: 'second request reason' })
    ]);
    expect(state).toEqual(expect.objectContaining({ status: 'REQUESTED', requestedBy: 'dev-2', reason: 'second request reason' }));
    expect(state?.decidedBy).toBeUndefined();
    expect(policy.currentState([ev('APPROVED', 't0', 'admin-1')])).toBeUndefined();
    const migrated = policy.currentState([ev('REQUESTED', 't1', 'u', { migrated: true }), ev('APPROVED', 't2', 'u', { migrated: true })]);
    expect(migrated?.migrated).toBe(true);
  });
});

describe('requestError', () => {
  it('blocks a request when a pull request exists, one is waiting, or one is approved', () => {
    expect(policy.requestError(undefined, 1, 'DEMO-1')).toBe('A pull request is linked to DEMO-1. A Code exception applies only to work with no pull request.');
    const waiting = policy.currentState([ev('REQUESTED', 't1', 'dev-1')]);
    expect(policy.requestError(waiting, 0, 'DEMO-1')).toBe('An exception request for DEMO-1 is already waiting for approval.');
    const approved = policy.currentState([ev('REQUESTED', 't1', 'dev-1'), ev('APPROVED', 't2', 'admin-1')]);
    expect(policy.requestError(approved, 0, 'DEMO-1')).toBe('DEMO-1 already has an approved exception.');
  });

  it('allows a request with none, or after rejection, withdrawal or revocation', () => {
    expect(policy.requestError(undefined, 0, 'DEMO-1')).toBeUndefined();
    for (const end of ['REJECTED', 'WITHDRAWN', 'REVOKED'] as const) {
      expect(policy.requestError(policy.currentState([ev('REQUESTED', 't1', 'dev-1'), ev(end, 't2', 'x')]), 0, 'DEMO-1')).toBeUndefined();
    }
  });
});

describe('decisionError (Option C)', () => {
  const waiting = policy.currentState([ev('REQUESTED', 't1', 'dev-1')]);
  const approved = policy.currentState([ev('REQUESTED', 't1', 'dev-1'), ev('APPROVED', 't2', 'admin-1')]);

  it('maps decisions to statuses', () => {
    expect(['APPROVE', 'REJECT', 'REVOKE', 'WITHDRAW'].map(d => policy.targetStatus(d as any))).toEqual(['APPROVED', 'REJECTED', 'REVOKED', 'WITHDRAWN']);
  });

  it('lets a project administrator who is neither requester nor assignee approve, reject or revoke', () => {
    expect(policy.decisionError(waiting, 'APPROVE', admin('admin-1'), 'dev-9', '')).toBeUndefined();
    expect(policy.decisionError(waiting, 'REJECT', admin('admin-1'), 'dev-9', REASON)).toBeUndefined();
    expect(policy.decisionError(approved, 'REVOKE', admin('admin-2'), 'dev-9', REASON)).toBeUndefined();
  });

  it('refuses a non-administrator, the requester and the assignee', () => {
    expect(policy.decisionError(waiting, 'APPROVE', { accountId: 'dev-2', isProjectAdmin: false }, undefined, ''))
      .toBe('Only a project administrator or a Jira administrator can approve, reject or revoke an exception.');
    expect(policy.decisionError(waiting, 'APPROVE', admin('dev-1'), undefined, ''))
      .toBe('The person who requested the exception cannot approve, reject or revoke it.');
    expect(policy.decisionError(waiting, 'APPROVE', admin('admin-1'), 'admin-1', ''))
      .toBe("The issue's assignee cannot approve, reject or revoke its exception.");
  });

  it('checks the current state for each decision', () => {
    expect(policy.decisionError(undefined, 'APPROVE', admin('a'), undefined, '')).toBe('There is no exception request on this issue.');
    expect(policy.decisionError(approved, 'APPROVE', admin('a'), undefined, '')).toBe('Only a waiting request can be approved or rejected.');
    expect(policy.decisionError(waiting, 'REVOKE', admin('a'), undefined, REASON)).toBe('Only an approved exception can be revoked.');
    expect(policy.decisionError(approved, 'WITHDRAW', { accountId: 'dev-1', isProjectAdmin: false }, undefined, '')).toBe('Only a waiting request can be withdrawn.');
  });

  it('lets only the requester withdraw, with no administrator needed', () => {
    expect(policy.decisionError(waiting, 'WITHDRAW', { accountId: 'dev-1', isProjectAdmin: false }, 'dev-1', '')).toBeUndefined();
    expect(policy.decisionError(waiting, 'WITHDRAW', admin('admin-1'), undefined, ''))
      .toBe('Only the person who requested the exception can withdraw it.');
  });

  it('needs a reason of 15 to 500 characters to reject or revoke, and at most 500 to approve', () => {
    expect(policy.decisionError(waiting, 'REJECT', admin('admin-1'), undefined, 'too short')).toBe('Give a reason of 15 to 500 characters.');
    expect(policy.decisionError(approved, 'REVOKE', admin('admin-1'), undefined, '')).toBe('Give a reason of 15 to 500 characters.');
    expect(policy.decisionError(waiting, 'APPROVE', admin('admin-1'), undefined, 'x'.repeat(501))).toBe('A reason can be at most 500 characters.');
  });
});
