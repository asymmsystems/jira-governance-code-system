/**
 * Copyright (c) 2026 Asymm Systems. All rights reserved.
 * @author Fahim Farook
 * FourRealities: issue-evidence Manager with fake Accessors (ADR-002: no platform mocks)
 */

import { DefaultIssueEvidenceManager } from '../../src/manager/default-issue-evidence-manager';
import { DefaultGateEngine } from '../../src/engine/default-gate-engine';
import { DefaultMetricsEngine } from '../../src/engine/default-metrics-engine';
import { DefaultPolicyEngine } from '../../src/engine/default-policy-engine';
import { DefaultExceptionPolicyEngine } from '../../src/engine/default-exception-policy-engine';
import { JiraIssueAccessor } from '../../src/contract/accessors';
import { makeFacts } from '../domain/fixtures';

function fakeJira(over: Partial<JiraIssueAccessor> = {}): JiraIssueAccessor {
  return {
    serviceType: 'accessor',
    searchProject: jest.fn(),
    visibleIssueIds: jest.fn(),
    readIssue: jest.fn().mockResolvedValue({ status: 200, facts: makeFacts({ issueId: '1', issueKey: 'DEMO-1' }) }),
    remoteLinks: jest.fn(),
    issueProject: jest.fn().mockResolvedValue({ status: 200, issueKey: 'DEMO-1', projectKey: 'DEMO' }),
    pullRequests: jest.fn(),
    addRemoteLink: jest.fn().mockResolvedValue(201),
    putExceptionProperty: jest.fn(),
    ...over
  } as JiraIssueAccessor;
}

function manager(jira: JiraIssueAccessor, events: any[] = []) {
  return new DefaultIssueEvidenceManager({
    userJira: jira,
    siteConfig: { serviceType: 'accessor', get: jest.fn().mockResolvedValue({ devFieldId: null, siteHost: 's', readAt: 't' }) },
    exceptions: { serviceType: 'accessor', get: jest.fn().mockResolvedValue(undefined), save: jest.fn(), listByIssue: jest.fn() },
    events: { serviceType: 'accessor', append: jest.fn(), list: jest.fn().mockResolvedValue(events), listAll: jest.fn(), migrateV2CodeNotes: jest.fn() },
    lifecycle: new DefaultExceptionPolicyEngine(),
    gates: new DefaultGateEngine(),
    metrics: new DefaultMetricsEngine(),
    policy: new DefaultPolicyEngine()
  });
}

const link = { issueId: '1', url: 'https://s.atlassian.net/wiki/x', title: 'ADR-1' };

describe('DefaultIssueEvidenceManager', () => {
  it('is a Manager and evaluates the context issue with its exception', async () => {
    const e = (status: string, at: string) => ({ schemaVersion: 3, issueId: '1', issueKey: 'DEMO-1', gate: 'code', status, at, byAccountId: status === 'REQUESTED' ? 'dev-1' : 'admin-1', asRole: 'APPROVER', reason: 'Configuration change only' });
    const m = manager(fakeJira(), [e('REQUESTED', 't1'), e('APPROVED', 't2')]);
    expect(m.serviceType).toBe('manager');
    const res: any = await m.evaluate({ issueId: '1', issueKey: 'DEMO-1' });
    expect(res.row.gates.code.state).toBe('EXCEPTED');
  });

  it('reports a read with no facts and a thrown error', async () => {
    const empty: any = await manager(fakeJira({ readIssue: jest.fn().mockResolvedValue({ status: 200 }) })).evaluate({ issueId: '1' });
    expect(empty.error.message).toBe("FourRealities: Jira returned HTTP 200 for issue '1'.");
    const thrown: any = await manager(fakeJira({ readIssue: jest.fn().mockRejectedValue(new Error('boom')) })).evaluate({ issueId: '1', issueKey: 'DEMO-1' });
    expect(thrown.error.message).toBe("FourRealities: Failed to query Jira for issue 'DEMO-1': boom");
  });

  it('links on the project page after the project check, and names the issue id on 403 without a key', async () => {
    const jira = fakeJira({ addRemoteLink: jest.fn().mockResolvedValue(403) });
    const res = await manager(jira).linkDecision({ projectKey: 'DEMO' }, link);
    expect(jira.issueProject).toHaveBeenCalledWith('1');
    expect(res.error).toBe('You need the Edit issues permission on 1 to add a link.');
  });

  it('reports a failed project read, another status, and a thrown error without a message', async () => {
    expect((await manager(fakeJira({ issueProject: jest.fn().mockResolvedValue({ status: 404 }) })).linkDecision({ projectKey: 'DEMO' }, link)).error)
      .toBe('Jira returned HTTP 404 reading issue 1.');
    expect((await manager(fakeJira({ addRemoteLink: jest.fn().mockResolvedValue(500) })).linkDecision({ issueId: '1' }, link)).error)
      .toBe('Jira returned status 500 linking decision.');
    expect((await manager(fakeJira({ addRemoteLink: jest.fn().mockRejectedValue({}) })).linkDecision({ issueId: '1' }, link)).error)
      .toBe('Failed to link architecture decision.');
  });
});
