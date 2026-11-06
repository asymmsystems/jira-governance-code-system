/**
 * Copyright (c) 2026 Asymm Systems. All rights reserved.
 * @author Fahim Farook
 * FourRealities: issue-evidence Manager with fake Accessors (ADR-002: no platform mocks)
 */

import { DefaultIssueEvidenceManager } from '../../src/manager/default-issue-evidence-manager';
import { DefaultSourcePolicyEngine } from '../../src/engine/default-source-policy-engine';
import { DEFAULT_SOURCE_SETTINGS } from '../../src/contract/data/models';
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
    notes: { serviceType: 'accessor', append: jest.fn(), list: jest.fn().mockResolvedValue([]), listAll: jest.fn(), migrateV2ReworkNotes: jest.fn() },
    events: { serviceType: 'accessor', append: jest.fn(), list: jest.fn().mockResolvedValue(events), listAll: jest.fn(), migrateV2CodeNotes: jest.fn() },
    lifecycle: new DefaultExceptionPolicyEngine(),
    gates: new DefaultGateEngine(),
    metrics: new DefaultMetricsEngine(),
    policy: new DefaultPolicyEngine(),
    settings: { serviceType: 'accessor', getSettings: jest.fn().mockResolvedValue({ ...DEFAULT_SOURCE_SETTINGS, code: 'on' }), getDetected: jest.fn().mockResolvedValue({}), saveDetected: jest.fn(), saveSettings: jest.fn(), getApproverPolicy: jest.fn(), saveApproverPolicy: jest.fn() },
    sources: new DefaultSourcePolicyEngine(),
    confluence: { serviceType: 'accessor', existingPages: async () => null, checkPages: async (m: any) => m } as any,
    history: { serviceType: 'accessor', get: async () => ({}), listAll: async () => new Map(), raise: async () => false } as any
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

  it('validates review comment input and authorization before posting a comment', async () => {
    const m = manager(fakeJira());
    expect((await (m as any).requestReview({ issueId: '1' }, { issueId: '2', comment: 'Valid comment text here' })).error)
      .toBe('Unauthorized: Cannot request review on external issue.');
    expect((await (m as any).requestReview({}, {})).error).toBe('Missing issueId.');
    expect((await (m as any).requestReview({ issueId: '1' }, { comment: 'too short' })).error)
      .toBe('Give a comment of 15 to 1,000 characters.');
  });

  it('posts retrospective review comment and handles 403, 500, and network error', async () => {
    const addComment = jest.fn().mockResolvedValue(201);
    const jira = fakeJira({ addComment } as any);
    const m = manager(jira);
    const ok = await (m as any).requestReview({ issueId: '1' }, { issueId: '1', issueKey: 'DEMO-1', comment: 'Please review this pull request.' });
    expect(ok).toEqual({ success: true });
    expect(addComment).toHaveBeenCalledWith('1', 'Please review this pull request.');

    const forbidden = await (manager(fakeJira({ addComment: jest.fn().mockResolvedValue(403) } as any)) as any)
      .requestReview({ issueId: '1' }, { issueId: '1', issueKey: 'DEMO-1', comment: 'Please review this pull request.' });
    expect(forbidden.error).toBe('You need permission to comment on DEMO-1.');

    const serverError = await (manager(fakeJira({ addComment: jest.fn().mockResolvedValue(500) } as any)) as any)
      .requestReview({ issueId: '1' }, { issueId: '1', issueKey: 'DEMO-1', comment: 'Please review this pull request.' });
    expect(serverError.error).toBe('Jira returned status 500 adding review comment.');

    const networkError = await (manager(fakeJira({ addComment: jest.fn().mockRejectedValue(new Error('timeout')) } as any)) as any)
      .requestReview({ issueId: '1' }, { issueId: '1', issueKey: 'DEMO-1', comment: 'Please review this pull request.' });
    expect(networkError.error).toBe('timeout');
  });
});

describe('DefaultIssueEvidenceManager: unread links and scope', () => {
  it('evaluates an issue whose remote links were not read, with no page check', async () => {
    const jira = fakeJira({ readIssue: jest.fn().mockResolvedValue({ status: 200, facts: makeFacts({ issueId: '1', issueKey: 'DEMO-1', remoteLinks: undefined }) }) });
    const res: any = await manager(jira).evaluate({ issueId: '1', issueKey: 'DEMO-1' });
    expect(res.row.gates.intent.state).toBe('NEEDS_RECHECK');
  });

  it('refuses a review request for an issue outside the page project', async () => {
    const jira = fakeJira({ issueProject: jest.fn().mockResolvedValue({ status: 200, issueKey: 'TEST-1', projectKey: 'TEST' }) });
    const res = await manager(jira).requestReview({ projectKey: 'DEMO' }, { issueId: '1', comment: 'Please review this change again.' });
    expect(res.error).toBe('Forbidden: issue TEST-1 is not in project DEMO.');
  });
});
