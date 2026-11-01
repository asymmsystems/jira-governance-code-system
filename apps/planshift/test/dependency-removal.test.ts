/*
 * Copyright (c) 2026 Asymm Systems. All rights reserved.
 *
 * @author Fahim Farook
 */

/**
 * CascadePlan: a dependency can be removed, the link CascadePlan created goes with it,
 * and the dependency does not come back (B-06, NF-02).
 */

import { getProjectPlan, updateWbsTask, saveTaskDependency, setGlobalStorageProvider, getTimelineWeeks } from '../src/index';
import { MemStorage, entryOf } from './helpers/mem-storage';

const mockRequestJira = jest.fn();
jest.mock('@forge/api', () => ({
  __esModule: true,
  default: {
    asApp: () => ({ requestJira: mockRequestJira }),
    asUser: () => ({ requestJira: mockRequestJira })
  },
  route: (strings: any, ...values: any[]) => strings.reduce((acc: string, str: string, i: number) => acc + str + (values[i] !== undefined ? values[i] : ''), '')
}));
jest.mock('@forge/kvs', () => ({ kvs: { get: jest.fn(), set: jest.fn(), delete: jest.fn() } }));


interface Link { id: string; pred: string; succ: string }

describe('dependency removal (B-06)', () => {
  let storage: MemStorage;
  let links: Link[];
  let nextId: number;
  const weeks = getTimelineWeeks().weeks;

  // Links as Jira shows them on the successor issue.
  const linksOn = (key: string) => links.filter(l => l.succ === key)
    .map(l => ({ id: l.id, type: { name: 'Blocks' }, inwardIssue: { id: l.pred.split('-')[1], key: l.pred } }));

  beforeEach(async () => {
    storage = new MemStorage();
    setGlobalStorageProvider(storage);
    links = [];
    nextId = 100;
    mockRequestJira.mockReset();
    mockRequestJira.mockImplementation(async (routeStr: any, options?: any) => {
      const url = String(routeStr);
      const method = options?.method || 'GET';
      const lookup = url.match(/\/rest\/api\/3\/issue\/([A-Z0-9_]+)-(\d+)\?fields=project/);
      if (lookup) return { status: 200, json: async () => ({ fields: { project: { key: lookup[1] } } }) };
      const linkQuery = url.match(/\/rest\/api\/3\/issue\/([A-Z0-9_]+-\d+)\?fields=issuelinks/);
      if (linkQuery) return { status: 200, json: async () => ({ fields: { issuelinks: linksOn(linkQuery[1]) } }) };
      if (url.endsWith('/rest/api/3/issueLink') && method === 'POST') {
        const body = JSON.parse(options.body);
        links.push({ id: String(nextId++), pred: body.inwardIssue.key, succ: body.outwardIssue.key });
        return { status: 201, json: async () => ({}) };
      }
      const del = url.match(/\/rest\/api\/3\/issueLink\/(\d+)$/);
      if (del && method === 'DELETE') {
        links = links.filter(l => l.id !== del[1]);
        return { status: 204, json: async () => ({}) };
      }
      if (url.includes('/search/jql')) {
        return { status: 200, json: async () => ({ issues: ['TEST-1', 'TEST-2'].map((k, i) => ({ id: String(i + 1), key: k,
          fields: { summary: k, issuetype: { name: 'Task', hierarchyLevel: 0 }, status: { statusCategory: { key: 'new' } }, issuelinks: linksOn(k) } })) }) };
      }
      return { status: 200, json: async () => [] };
    });
    await storage.set('scheduleMap:TEST', {
      'TEST-1': { startWeek: weeks[4].weekKey, spanWeeks: 2 },
      'TEST-2': { startWeek: weeks[8].weekKey, spanWeeks: 2 }
    });
  });

  const dep = { predecessorId: 'TEST-1', predecessorKey: 'TEST-1', triggerPercent: 40, isTriggerSatisfied: false };
  const stored = async () => (await entryOf(storage, 'TEST-2'));
  const deletes = () => mockRequestJira.mock.calls.filter(c => c[1]?.method === 'DELETE').map(c => String(c[0]));

  it('setting a dependency creates one Blocks link and records its id', async () => {
    await updateWbsTask({ projectKey: 'TEST', taskId: 'TEST-2', updates: { dependency: dep } });
    expect(links).toEqual([{ id: '100', pred: 'TEST-1', succ: 'TEST-2' }]);
    expect((await stored()).dependency.jiraLinkId).toBe('100');
  });

  it('saving the same dependency twice keeps one link', async () => {
    await updateWbsTask({ projectKey: 'TEST', taskId: 'TEST-2', updates: { dependency: dep } });
    await updateWbsTask({ projectKey: 'TEST', taskId: 'TEST-2', updates: { dependency: { ...dep, triggerPercent: 50 } } });
    await saveTaskDependency({ projectKey: 'TEST', taskId: 'TEST-2', dependency: dep });
    expect(links.length).toBe(1);
    expect((await stored()).dependency.jiraLinkId).toBe('100');
  });

  it('choosing None removes the dependency and the link CascadePlan created, and nothing else', async () => {
    links.push({ id: '7', pred: 'TEST-9', succ: 'TEST-2' });
    await updateWbsTask({ projectKey: 'TEST', taskId: 'TEST-2', updates: { dependency: dep } });
    await updateWbsTask({ projectKey: 'TEST', taskId: 'TEST-2', updates: { dependency: null } });
    expect((await stored()).dependency).toBeNull();
    expect(deletes()).toEqual(['/rest/api/3/issueLink/100']);
    expect(links).toEqual([{ id: '7', pred: 'TEST-9', succ: 'TEST-2' }]);
  });

  it('an empty dependency object also removes it', async () => {
    await updateWbsTask({ projectKey: 'TEST', taskId: 'TEST-2', updates: { dependency: dep } });
    await updateWbsTask({ projectKey: 'TEST', taskId: 'TEST-2', updates: { dependency: { predecessorId: '', predecessorKey: '', triggerPercent: 0, isTriggerSatisfied: false } } });
    expect((await stored()).dependency).toBeNull();
    expect(links).toEqual([]);
  });

  it('a removed dependency does not come back from a Jira link the user made', async () => {
    links.push({ id: '8', pred: 'TEST-1', succ: 'TEST-2' });
    const before = await getProjectPlan('TEST', storage);
    expect(before.tasks.find(t => t.key === 'TEST-2')!.dependency?.predecessorKey).toBe('TEST-1');
    await updateWbsTask({ projectKey: 'TEST', taskId: 'TEST-2', updates: { dependency: null } });
    expect(deletes()).toEqual([]);
    expect(links.length).toBe(1);
    const after = await getProjectPlan('TEST', storage);
    expect(after.tasks.find(t => t.key === 'TEST-2')!.dependency).toBeUndefined();
  });
});
