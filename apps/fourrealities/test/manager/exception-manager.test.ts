/**
 * Copyright (c) 2026 Asymm Systems. All rights reserved.
 * @author Fahim Farook
 * FourRealities: gate exception Manager with fake Accessors (ADR-001 Patterns 3, 5, Option C)
 */

import { DefaultExceptionManager } from '../../src/manager/default-exception-manager';
import { DefaultPolicyEngine } from '../../src/engine/default-policy-engine';
import { DefaultExceptionPolicyEngine } from '../../src/engine/default-exception-policy-engine';
import { GateExceptionEvent } from '../../src/contract/data/models';

const NOW = () => new Date('2026-11-02T08:00:00.000Z');
const REASON = 'Configuration change only, no code';
const requested: GateExceptionEvent = {
  schemaVersion: 3, issueId: '1', issueKey: 'DEMO-1', gate: 'code', status: 'REQUESTED', at: '2026-11-01T10:00:00.000Z',
  byAccountId: 'dev-1', asRole: 'REQUESTER', reason: REASON
};
const approved: GateExceptionEvent = { ...requested, status: 'APPROVED', at: '2026-11-01T11:00:00.000Z', byAccountId: 'admin-1', asRole: 'APPROVER', reason: 'ok' };

function setup(o: { events?: GateExceptionEvent[]; admin?: boolean; assignee?: string; prCount?: number; put?: number; project?: any; permission?: any; rework?: any } = {}) {
  const userJira: any = {
    serviceType: 'accessor',
    issueProject: jest.fn().mockResolvedValue(o.project || { status: 200, issueKey: 'DEMO-1', projectKey: 'DEMO', assigneeAccountId: o.assignee }),
    hasProjectPermission: jest.fn().mockResolvedValue(o.permission || { status: 200, granted: o.admin ?? true }),
    pullRequests: jest.fn().mockResolvedValue({ status: 200, issueKey: 'DEMO-1', summary: { count: o.prCount || 0 } }),
    putExceptionProperty: jest.fn().mockResolvedValue(o.put ?? 200)
  };
  const events: any = { serviceType: 'accessor', append: jest.fn(), list: jest.fn().mockResolvedValue(o.events || []), listAll: jest.fn(), migrateV2CodeNotes: jest.fn() };
  const exceptions: any = { serviceType: 'accessor', get: jest.fn().mockResolvedValue(o.rework ? { schemaVersion: 2, issueId: '1', issueKey: 'DEMO-1', rework: o.rework } : undefined), save: jest.fn(), listByIssue: jest.fn() };
  const siteConfig: any = { serviceType: 'accessor', get: jest.fn().mockResolvedValue({ devFieldId: 'customfield_10000', siteHost: 's', readAt: 't' }) };
  const manager = new DefaultExceptionManager({ userJira, siteConfig, exceptions, events, policy: new DefaultPolicyEngine(), lifecycle: new DefaultExceptionPolicyEngine(), now: NOW });
  return { manager, userJira, events, exceptions };
}

const issueView = (accountId: string) => ({ issueId: '1', accountId });

describe('DefaultExceptionManager.record (request)', () => {
  it('writes the property projection as the user, then appends a REQUESTED event', async () => {
    const { manager, userJira, events } = setup({ rework: { reason: 'r', recordedBy: 'u', recordedAt: 't' } });
    expect(manager.serviceType).toBe('manager');
    const res = await manager.record(issueView('dev-1'), { type: 'CODE', reason: REASON, notes: 'CHG-1' });
    expect(res.success).toBe(true);
    const event = events.append.mock.calls[0][0];
    expect(event).toEqual(expect.objectContaining({ status: 'REQUESTED', byAccountId: 'dev-1', asRole: 'REQUESTER', reason: REASON, notes: 'CHG-1', at: '2026-11-02T08:00:00.000Z' }));
    const [issueId, property] = userJira.putExceptionProperty.mock.calls[0];
    expect(issueId).toBe('1');
    expect(property.code.status).toBe('REQUESTED');
    expect(property.rework.reason).toBe('r');
    expect(userJira.putExceptionProperty.mock.invocationCallOrder[0]).toBeLessThan(events.append.mock.invocationCallOrder[0]);
  });

  it('refuses a request while one waits, when one is approved, or when a pull request exists', async () => {
    expect((await setup({ events: [requested] }).manager.record(issueView('dev-2'), { type: 'CODE', reason: REASON })).error)
      .toBe('An exception request for DEMO-1 is already waiting for approval.');
    expect((await setup({ events: [requested, approved] }).manager.record(issueView('dev-2'), { type: 'CODE', reason: REASON })).error)
      .toBe('DEMO-1 already has an approved exception.');
    const pr = setup({ prCount: 1 });
    expect((await pr.manager.record(issueView('dev-2'), { type: 'CODE', reason: REASON })).error).toContain('A pull request is linked to DEMO-1');
    expect(pr.events.append).not.toHaveBeenCalled();
  });

  it('appends no event when Jira refuses the property write', async () => {
    const { manager, events } = setup({ put: 403 });
    expect((await manager.record(issueView('dev-1'), { type: 'CODE', reason: REASON })).error)
      .toBe('You need the Edit issues permission on DEMO-1 to record an exception.');
    expect(events.append).not.toHaveBeenCalled();
  });
});

describe('DefaultExceptionManager.decide (Option C)', () => {
  it('lets a project administrator approve, checks the permission as the user, and appends an APPROVED event', async () => {
    const { manager, userJira, events } = setup({ events: [requested], assignee: 'dev-9' });
    const res = await manager.decide(issueView('admin-1'), { decision: 'APPROVE', reason: '' });
    expect(res.success).toBe(true);
    expect(userJira.hasProjectPermission).toHaveBeenCalledWith('DEMO', 'ADMINISTER_PROJECTS');
    expect(events.append.mock.calls[0][0]).toEqual(expect.objectContaining({ status: 'APPROVED', byAccountId: 'admin-1', asRole: 'APPROVER', reason: 'Approved without comment.' }));
    expect(res.record?.code).toEqual(expect.objectContaining({ status: 'APPROVED', requestedBy: 'dev-1', decidedBy: 'admin-1' }));
  });

  it('refuses a non-administrator, the requester and the assignee, and appends nothing', async () => {
    const cases: Array<[any, string, string]> = [
      [{ events: [requested], admin: false }, 'dev-2', 'Only a project administrator can approve, reject or revoke an exception.'],
      [{ events: [requested] }, 'dev-1', 'The person who requested the exception cannot approve, reject or revoke it.'],
      [{ events: [requested], assignee: 'admin-1' }, 'admin-1', "The issue's assignee cannot approve, reject or revoke its exception."]
    ];
    for (const [opts, who, error] of cases) {
      const { manager, events } = setup(opts);
      expect((await manager.decide(issueView(who), { decision: 'APPROVE' })).error).toBe(error);
      expect(events.append).not.toHaveBeenCalled();
    }
  });

  it('lets the requester withdraw without a permission check', async () => {
    const { manager, userJira, events } = setup({ events: [requested] });
    const res = await manager.decide(issueView('dev-1'), { decision: 'WITHDRAW' });
    expect(res.success).toBe(true);
    expect(userJira.hasProjectPermission).not.toHaveBeenCalled();
    expect(events.append.mock.calls[0][0]).toEqual(expect.objectContaining({ status: 'WITHDRAWN', asRole: 'REQUESTER' }));
  });

  it('revokes an approved exception with a reason, and rejects needs a reason', async () => {
    const revoke = setup({ events: [requested, approved] });
    expect((await revoke.manager.decide(issueView('admin-2'), { decision: 'REVOKE', reason: 'The change touched code after all' })).success).toBe(true);
    expect(revoke.events.append.mock.calls[0][0].status).toBe('REVOKED');
    expect((await setup({ events: [requested] }).manager.decide(issueView('admin-1'), { decision: 'REJECT', reason: 'no' })).error)
      .toBe('Give a reason of 15 to 500 characters.');
  });

  it('validates the request and reports Jira failures', async () => {
    const { manager } = setup({ events: [requested] });
    expect((await manager.decide({ issueId: '1' }, { decision: 'APPROVE' })).error).toBe('FourRealities: no signed-in user.');
    expect((await manager.decide(issueView('a'), { decision: 'MAYBE' })).error).toBe('Unknown decision.');
    expect((await manager.decide({ accountId: 'a' }, { decision: 'APPROVE' })).error).toBe('Missing issueId.');
    expect((await manager.decide(issueView('a'), { issueId: '2', decision: 'APPROVE' })).error).toBe('Unauthorized: Cannot change an exception on an external issue.');
    expect((await setup({ project: { status: 404 } }).manager.decide(issueView('a'), { decision: 'APPROVE' })).error).toBe('Jira returned HTTP 404 reading issue 1.');
    expect((await setup({ permission: { status: 401, granted: false } }).manager.decide(issueView('a'), { decision: 'APPROVE' })).error)
      .toBe('Jira returned HTTP 401 checking your permissions.');
    expect((await setup({ project: { status: 200, issueKey: 'TEST-1', projectKey: 'TEST' } }).manager.decide({ projectKey: 'DEMO', accountId: 'a' }, { issueId: '1', decision: 'APPROVE' })).error)
      .toBe('Forbidden: issue TEST-1 is not in project DEMO.');
    const thrown = setup();
    thrown.userJira.issueProject.mockRejectedValue({});
    expect((await thrown.manager.decide(issueView('a'), { decision: 'APPROVE' })).error).toBe('Failed to check the issue.');
  });

  it('reports another property status and a thrown write', async () => {
    expect((await setup({ events: [requested], put: 500 }).manager.decide(issueView('admin-1'), { decision: 'APPROVE' })).error)
      .toBe('Jira returned status 500 recording the exception.');
    const thrown = setup({ events: [requested] });
    thrown.userJira.putExceptionProperty.mockRejectedValue({});
    expect((await thrown.manager.decide(issueView('admin-1'), { decision: 'APPROVE' })).error).toBe('Failed to record exception.');
  });
});
