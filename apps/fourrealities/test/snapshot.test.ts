/**
 * Copyright (c) 2026 Asymm Systems. All rights reserved.
 * @author Fahim Farook
 * FourRealities: snapshot build tests: DefaultSnapshotManager over the real Accessors and Engines,
 * with a mocked Jira request (spec v2, Snapshot schedule)
 */

import { DefaultSnapshotManager } from '../src/manager/default-snapshot-manager';
import { DefaultKvsSnapshotAccessor, SnapshotRepository } from '../src/accessor/default-kvs-snapshot-accessor';
import { DefaultKvsReworkNoteAccessor } from '../src/accessor/default-kvs-rework-note-accessor';
import { DefaultKvsExceptionEventAccessor } from '../src/accessor/default-kvs-exception-event-accessor';
import { DefaultExceptionPolicyEngine } from '../src/engine/default-exception-policy-engine';
import { DefaultKvsSiteConfigAccessor } from '../src/accessor/default-kvs-site-config-accessor';
import { DefaultForgeJiraIssueAccessor } from '../src/accessor/default-forge-jira-issue-accessor';
import { DefaultGateEngine } from '../src/engine/default-gate-engine';
import { DefaultMetricsEngine } from '../src/engine/default-metrics-engine';
import { DefaultSnapshotEngine } from '../src/engine/default-snapshot-engine';
import { MemoryStorage } from './storage/memory-storage';

const pathOf = (r: any): string => (typeof r === 'string' ? r : r.value);

function buildSnapshot(o: { projectKey: string; storage: any; request: any; deadline: number; generatedBy: string; now?: () => Date }) {
  const jira = new DefaultForgeJiraIssueAccessor('app', () => o.deadline, o.request);
  const manager = new DefaultSnapshotManager({
    jira,
    viewerJira: jira,
    budgetMs: 0,
    siteConfig: new DefaultKvsSiteConfigAccessor(o.storage, o.request),
    snapshots: new DefaultKvsSnapshotAccessor(o.storage),
    notes: new DefaultKvsReworkNoteAccessor(o.storage),
    events: new DefaultKvsExceptionEventAccessor(o.storage),
    lifecycle: new DefaultExceptionPolicyEngine(),
    gates: new DefaultGateEngine(),
    metrics: new DefaultMetricsEngine(),
    snapshot: new DefaultSnapshotEngine(),
    now: o.now
  });
  return manager.build(o.projectKey, o.generatedBy, o.deadline);
}

const issue = (id: string, category: string, extra: any = {}) => ({
  id, key: `DEMO-${id}`,
  fields: { summary: `Work ${id}`, status: { name: category, statusCategory: { key: category } }, ...extra },
  properties: {}
});

function jira(issues: any[], remote: (id: string) => any = () => ({ status: 200, json: async () => [] })) {
  return jest.fn(async (r: any) => {
    const path = pathOf(r);
    if (path === '/rest/api/3/field') return { status: 200, json: async () => [{ id: 'customfield_10000', name: 'Development' }] };
    if (path === '/rest/api/3/serverInfo') return { status: 200, json: async () => ({ baseUrl: 'https://asymmsystems.atlassian.net' }) };
    if (path.startsWith('/rest/api/3/search/jql')) return { status: 200, json: async () => ({ issues, isLast: true }) };
    const m = /\/rest\/api\/3\/issue\/(\w+)\/remotelink/.exec(path);
    if (m) return remote(m[1]);
    return { status: 404, json: async () => ({}) };
  });
}

describe('buildSnapshot', () => {
  const now = () => new Date('2026-11-01T10:00:00.000Z');

  it('stores rows, meta and the trend point for the ISO week, and removes the v1 keys', async () => {
    const storage = new MemoryStorage();
    await storage.set('fr:project:DEMO:history', [{ huge: true }]);
    await storage.set('fr:issue:2:exception', { schemaVersion: 2, issueId: '2', issueKey: 'DEMO-2', code: { reason: 'Configuration change only', recordedBy: 'u', recordedAt: '2026-10-30T00:00:00Z' } });
    const request = jira([issue('1', 'indeterminate'), issue('2', 'done'), issue('3', 'new')],
      id => ({ status: 200, json: async () => (id === '1' ? [{ object: { url: 'https://asymmsystems.atlassian.net/wiki/x', title: 'ADR' } }] : []) }));
    const res: any = await buildSnapshot({ projectKey: 'DEMO', storage, request, deadline: Date.now() + 60_000, generatedBy: 'acc-1', now });
    expect(res.ok).toBe(true);
    expect(res.meta).toEqual(expect.objectContaining({ schemaVersion: 2, projectKey: 'DEMO', generatedBy: 'acc-1', generatedAt: '2026-11-01T10:00:00.000Z', shownCount: 3, totalKnown: 3, capped: false, remoteLinksRead: 2, chunkCount: 1 }));
    const repo = new SnapshotRepository(storage);
    expect((await repo.loadSnapshot('DEMO'))?.rows.map(r => r.issueKey)).toEqual(['DEMO-1', 'DEMO-2', 'DEMO-3']);
    const trend = await repo.getTrend('DEMO');
    expect(trend).toHaveLength(1);
    expect(trend[0].weekStart).toBe('2026-10-26');
    expect(trend[0].gates.intent).toEqual({ found: 1, missing: 1 });
    expect(storage.store.has('fr:project:DEMO:history')).toBe(false);
    const byKey = Object.fromEntries(res.rows.map((r: any) => [r.issueKey, r]));
    expect(byKey['DEMO-2'].gates.code.state).toBe('EXCEPTED');
    expect(storage.count('get', /exception$/)).toBe(0);
    const remoteCalls = request.mock.calls.map(c => pathOf(c[0])).filter(p => p.endsWith('/remotelink'));
    expect(remoteCalls.sort()).toEqual(['/rest/api/3/issue/1/remotelink', '/rest/api/3/issue/2/remotelink']);
  });

  it('keeps the previous Intent result for an issue whose remote links were not read', async () => {
    const storage = new MemoryStorage();
    const page = [{ object: { url: 'https://asymmsystems.atlassian.net/wiki/x', title: 'ADR' } }];
    await buildSnapshot({ projectKey: 'DEMO', storage, request: jira([issue('1', 'indeterminate')], () => ({ status: 200, json: async () => page })), deadline: Date.now() + 60_000, generatedBy: 'a', now });
    const second: any = await buildSnapshot({ projectKey: 'DEMO', storage, request: jira([issue('1', 'indeterminate')], () => ({ status: 500, json: async () => ({}) })), deadline: Date.now() + 60_000, generatedBy: 'a', now });
    expect(second.rows[0].gates.intent.reason).toBe('INTENT_CONFLUENCE_LINK');
    const fresh: any = await buildSnapshot({ projectKey: 'NEW', storage, request: jira([issue('9', 'indeterminate')], () => ({ status: 500, json: async () => ({}) })), deadline: Date.now() + 60_000, generatedBy: 'a', now });
    expect(fresh.rows[0].gates.intent.state).toBe('NEEDS_RECHECK');
  });

  it('returns the Jira error and stores nothing when the search fails', async () => {
    const storage = new MemoryStorage();
    const request = jest.fn(async (r: any) => {
      const path = pathOf(r);
      if (path === '/rest/api/3/field') return { status: 200, json: async () => [] };
      if (path === '/rest/api/3/serverInfo') return { status: 200, json: async () => ({}) };
      return { status: 403, json: async () => ({}) };
    });
    const res: any = await buildSnapshot({ projectKey: 'DEMO', storage, request, deadline: Date.now() + 60_000, generatedBy: 'a', now });
    expect(res).toEqual({ ok: false, error: { code: 'FORBIDDEN', message: 'Live Jira sync failed (Jira search/jql failed with HTTP 403).', status: 403 } });
    expect(storage.store.has('fr:p:DEMO:meta')).toBe(false);
    const cfgFail = jest.fn(async () => ({ status: 500, json: async () => ({}) }));
    const res2: any = await buildSnapshot({ projectKey: 'DEMO', storage: new MemoryStorage(), request: cfgFail, deadline: Date.now() + 60_000, generatedBy: 'a', now });
    expect(res2.error.message).toBe('Live Jira sync failed (Jira returned HTTP 500 reading the field list.).');
  });
});
