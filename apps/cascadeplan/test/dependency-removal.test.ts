/*
 * Copyright (c) 2026 Asymm Systems. All rights reserved.
 *
 * @author Fahim Farook
 */

/**
 * CascadePlan: dependencies are Jira "Blocks" links, the same in every plan, and the trigger percent is
 * the successor's issue property cascadeplan.links (ADR-006, N-11 L3 to L5; B-06).
 */

import { getProjectPlan, updateWbsTask, createProjectPlan, setGlobalStorageProvider, getTimelineWeeks } from '../src/index';
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
  let props: Record<string, Record<string, any>>;
  const weeks = getTimelineWeeks().weeks;

  // Links as Jira shows them on the successor issue.
  const linksOn = (key: string) => links.filter(l => l.succ === key)
    .map(l => ({ id: l.id, type: { name: 'Blocks' }, inwardIssue: { id: l.pred.split('-')[1], key: l.pred } }));

  beforeEach(async () => {
    storage = new MemStorage();
    setGlobalStorageProvider(storage);
    links = [];
    nextId = 100;
    props = {};
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
      const prop = url.match(/\/rest\/api\/3\/issue\/([A-Z0-9_]+-\d+)\/properties\/([^/?]+)$/);
      if (prop && method === 'PUT') { props[prop[1]] = { ...(props[prop[1]] || {}), [prop[2]]: JSON.parse(options.body) }; return { status: 200, json: async () => ({}) }; }
      if (prop && method === 'GET') {
        const v = props[prop[1]]?.[prop[2]];
        return v === undefined ? { status: 404, json: async () => ({}) } : { status: 200, json: async () => ({ key: prop[2], value: v }) };
      }
      const del = url.match(/\/rest\/api\/3\/issueLink\/(\d+)$/);
      if (del && method === 'DELETE') {
        links = links.filter(l => l.id !== del[1]);
        return { status: 204, json: async () => ({}) };
      }
      if (url.includes('/search/jql')) {
        return { status: 200, json: async () => ({ issues: ['TEST-1', 'TEST-2'].map((k, i) => ({ id: String(i + 1), key: k,
          fields: { summary: k, issuetype: { name: 'Task', hierarchyLevel: 0 }, status: { statusCategory: { key: 'new' } }, issuelinks: linksOn(k) },
          properties: props[k] || {} })) }) };
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

  const depOf = async (key: string, planId?: string) =>
    ((await getProjectPlan('TEST', storage, new Date(), undefined, undefined, undefined, planId)).tasks.find(x => x.key === key)!.dependencies || []);

  it('setting a dependency creates one Blocks link and stores its percent in Jira, not in the plan record (L4, L5)', async () => {
    await updateWbsTask({ projectKey: 'TEST', taskId: 'TEST-2', updates: { dependency: dep } });
    expect(links).toEqual([{ id: '100', pred: 'TEST-1', succ: 'TEST-2' }]);
    expect(props['TEST-2']['cascadeplan.links']).toEqual({ v: 1, links: { '1': 40 } });
    expect((await stored()).dependency).toBeUndefined();
    expect(await depOf('TEST-2')).toEqual([expect.objectContaining({ predecessorKey: 'TEST-1', triggerPercent: 40, jiraLinkId: '100' })]);
  });

  it('saving the same dependency twice keeps one link and updates its percent', async () => {
    await updateWbsTask({ projectKey: 'TEST', taskId: 'TEST-2', updates: { dependency: dep } });
    await updateWbsTask({ projectKey: 'TEST', taskId: 'TEST-2', updates: { dependency: { ...dep, triggerPercent: 50 } } });
    expect(links.length).toBe(1);
    expect(props['TEST-2']['cascadeplan.links'].links).toEqual({ '1': 50 });
  });

  it('removeDependency removes exactly one link, also one the user made in Jira (L3), and its percent', async () => {
    links.push({ id: '8', pred: 'TEST-1', succ: 'TEST-2' }, { id: '7', pred: 'TEST-9', succ: 'TEST-2' });
    props['TEST-2'] = { 'cascadeplan.links': { v: 1, links: { '1': 30, '9': 60 } } };
    expect((await depOf('TEST-2')).map(d => [d.predecessorKey, d.triggerPercent])).toEqual([['TEST-1', 30], ['TEST-9', 60]]);
    await updateWbsTask({ projectKey: 'TEST', taskId: 'TEST-2', updates: { removeDependency: { predecessorKey: 'TEST-1' } } as any });
    expect(deletes()).toEqual(['/rest/api/3/issueLink/8']);
    expect(links).toEqual([{ id: '7', pred: 'TEST-9', succ: 'TEST-2' }]);
    expect(props['TEST-2']['cascadeplan.links'].links).toEqual({ '9': 60 });
    expect((await depOf('TEST-2')).map(d => d.predecessorKey)).toEqual(['TEST-9']);
    // The removal is history in the plan record, never a filter: a new Jira link from TEST-1 shows again.
    expect((await stored()).endedLinks.map((e: any) => e.predecessorKey)).toEqual(['TEST-1']);
    links.push({ id: '9', pred: 'TEST-1', succ: 'TEST-2' });
    expect((await depOf('TEST-2')).map(d => d.predecessorKey).sort()).toEqual(['TEST-1', 'TEST-9']);
  });

  it('removing a dependency that does not exist is refused, with no write', async () => {
    await expect(updateWbsTask({ projectKey: 'TEST', taskId: 'TEST-2', updates: { removeDependency: { predecessorKey: 'TEST-1' } } as any })).rejects.toThrow('has no dependency on TEST-1');
    expect(deletes()).toEqual([]);
  });

  it('choosing None removes every link of the task in Jira, whoever created it (L3)', async () => {
    links.push({ id: '7', pred: 'TEST-9', succ: 'TEST-2' });
    await updateWbsTask({ projectKey: 'TEST', taskId: 'TEST-2', updates: { dependency: dep } });
    await updateWbsTask({ projectKey: 'TEST', taskId: 'TEST-2', updates: { dependency: null } });
    expect(deletes().sort()).toEqual(['/rest/api/3/issueLink/100', '/rest/api/3/issueLink/7']);
    expect(links).toEqual([]);
    expect(await depOf('TEST-2')).toEqual([]);
  });

  it('an empty dependency object also removes every link', async () => {
    await updateWbsTask({ projectKey: 'TEST', taskId: 'TEST-2', updates: { dependency: dep } });
    await updateWbsTask({ projectKey: 'TEST', taskId: 'TEST-2', updates: { dependency: { predecessorId: '', predecessorKey: '', triggerPercent: 0, isTriggerSatisfied: false } } });
    expect(links).toEqual([]);
    expect(props['TEST-2']['cascadeplan.links'].links).toEqual({});
  });

  it('the percent survives a reload from Jira alone, with empty KVS (L4)', async () => {
    links.push({ id: '5', pred: 'TEST-1', succ: 'TEST-2' });
    props['TEST-2'] = { 'cascadeplan.links': { v: 1, links: { '1': 25 } } };
    await storage.delete('scheduleMap:TEST');
    const plan = await getProjectPlan('TEST', storage);
    const t2 = [...plan.tasks, ...(plan.backlogTasks || [])].find(x => x.key === 'TEST-2')!;
    expect(t2.dependencies).toEqual([expect.objectContaining({ predecessorKey: 'TEST-1', triggerPercent: 25 })]);
  });

  it('a link made in Plan B shows in the Main Plan with the same percent (L5)', async () => {
    await getProjectPlan('TEST', storage);
    const b = await createProjectPlan({ projectKey: 'TEST', name: 'Plan B', cloneFromPlanId: 'default' }, storage);
    await updateWbsTask({ projectKey: 'TEST', planId: b.plan.id, taskId: 'TEST-2', updates: { dependency: dep } }, storage);
    expect((await depOf('TEST-2')).map(d => [d.predecessorKey, d.triggerPercent])).toEqual([['TEST-1', 40]]);
  });

  it('a link stored only in a plan record (before ADR-006) is shown as planOnly; adding it creates the Jira link and it leaves the record (L5)', async () => {
    await storage.set('scheduleMap:TEST', {
      'TEST-1': { startWeek: weeks[4].weekKey, spanWeeks: 2 },
      'TEST-2': { startWeek: weeks[8].weekKey, spanWeeks: 2, dependency: { predecessorKey: 'TEST-1', predecessorId: 'TEST-1', triggerPercent: 35, isTriggerSatisfied: false } }
    });
    expect(await depOf('TEST-2')).toEqual([expect.objectContaining({ predecessorKey: 'TEST-1', triggerPercent: 35, planOnly: true })]);
    await updateWbsTask({ projectKey: 'TEST', taskId: 'TEST-2', updates: { dependency: { ...dep, triggerPercent: 35 } } });
    expect(links).toEqual([{ id: '100', pred: 'TEST-1', succ: 'TEST-2' }]);
    expect((await stored()).dependency).toBeUndefined();
    expect(await depOf('TEST-2')).toEqual([expect.objectContaining({ predecessorKey: 'TEST-1', triggerPercent: 35, jiraLinkId: '100' })]);
    expect((await depOf('TEST-2'))[0].planOnly).toBeUndefined();
  });
});
