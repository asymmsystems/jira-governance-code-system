/*
 * Copyright (c) 2026 Asymm Systems. All rights reserved.
 *
 * @author Fahim Farook
 */

/**
 * CascadePlan: KVS holds only app-owned planning data; Jira fields are read live (B-04, INV-04).
 */

import { getProjectPlan, updateWbsTask, setGlobalStorageProvider, stripJiraOwnedFields, getTimelineWeeks } from '../src/index';
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


const weeks = getTimelineWeeks().weeks;
const LIVE = [
  { id: '1', key: 'TEST-1', fields: { summary: 'Live summary', issuetype: { name: 'Task', hierarchyLevel: 0 },
    status: { name: 'Done', statusCategory: { key: 'done' } }, assignee: { displayName: 'Jane Live', accountId: 'acc-jane' },
    timeoriginalestimate: 7200 } },
  { id: '2', key: 'TEST-2', fields: { summary: 'Parent', issuetype: { name: 'Story', hierarchyLevel: 0 }, status: { statusCategory: { key: 'indeterminate' } } } },
  { id: '3', key: 'TEST-3', fields: { summary: 'Child', issuetype: { name: 'Sub-task', hierarchyLevel: -1 }, parent: { key: 'TEST-2', id: '2' },
    status: { statusCategory: { key: 'new' } }, timeoriginalestimate: 3600 } }
];

function puts(key: string): any[] {
  return mockRequestJira.mock.calls
    .filter(c => c[1]?.method === 'PUT' && String(c[0]).endsWith(`/issue/${key}`))
    .map(c => JSON.parse(c[1].body).fields);
}

describe('KVS holds app-owned data only (B-04)', () => {
  let storage: MemStorage;

  beforeEach(() => {
    storage = new MemStorage();
    setGlobalStorageProvider(storage);
    mockRequestJira.mockReset();
    mockRequestJira.mockImplementation(async (routeStr: any, options?: any) => {
      const url = String(routeStr);
      const m = url.match(/\/rest\/api\/3\/issue\/([A-Z0-9_]+)-(\d+)\?fields=project/);
      if (m && !options?.method) return { status: 200, json: async () => ({ fields: { project: { key: m[1] } } }) };
      if (url.includes('/search/jql')) return { status: 200, json: async () => ({ issues: LIVE }) };
      if (url.includes('/user/assignable')) return { status: 200, json: async () => [] };
      return { status: 204, json: async () => ({}) };
    });
  });

  it('Jira-side summary, status, assignee and estimate win over stale stored values', async () => {
    await storage.set('scheduleMap:TEST', { 'TEST-1': {
      startWeek: weeks[5].weekKey, spanWeeks: 1, summary: 'Old', status: 'IN_PROGRESS', resource: 'Old Person',
      resourceAccountId: 'acc-old', effortHours: 99, progress: 20, epic: 'Stale epic', story: 'Stale'
    } });
    const plan = await getProjectPlan('TEST', storage);
    const t1 = plan.tasks.find(t => t.key === 'TEST-1')!;
    expect(t1.summary).toBe('Live summary');
    expect(t1.status).toBe('COMPLETED');
    expect(t1.resource).toBe('Jane Live');
    expect(t1.resourceAccountId).toBe('acc-jane');
    expect(t1.effortHours).toBe(2);
    expect(t1.progress).toBe(100);
    expect(t1.story).toBe('Task');
    expect(t1.startWeek).toBe(weeks[5].weekKey);
  });

  it('a progress the user set by hand is kept', async () => {
    await storage.set('scheduleMap:TEST', { 'TEST-2': { startWeek: weeks[5].weekKey, spanWeeks: 1, progress: 40, manualProgress: true } });
    const plan = await getProjectPlan('TEST', storage);
    expect(plan.tasks.find(t => t.key === 'TEST-2')!.progress).toBe(40);
  });

  it('stripJiraOwnedFields keeps planning data and drops Jira fields, and is idempotent', () => {
    const entry = { startWeek: 'w', endWeek: 'x', startDate: '2026-11-04', endDate: '2026-11-10', spanWeeks: 1, weeklyAllocations: { w: 100 },
      dependency: { predecessorKey: 'TEST-9', predecessorId: 'TEST-9', triggerPercent: 30, isTriggerSatisfied: false },
      contributingResources: ['Bo'], targetProgress: 10, version: 3, summary: 'S', status: 'COMPLETED', resource: 'R',
      resourceAccountId: 'a', epic: 'E', epicKey: 'TEST-4', story: 'Story', effortHours: 5, progress: 50, parentKey: 'TEST-2',
      isSubtask: true, hierarchyLevel: -1 } as any;
    const once = stripJiraOwnedFields(entry);
    expect(once).toEqual({ startWeek: 'w', endWeek: 'x', startDate: '2026-11-04', endDate: '2026-11-10', spanWeeks: 1,
      weeklyAllocations: { w: 100 }, dependency: entry.dependency, contributingResources: ['Bo'], targetProgress: 10, version: 3 });
    expect(stripJiraOwnedFields(once)).toEqual(once);
    expect(stripJiraOwnedFields({ progress: 30, manualProgress: true } as any)).toEqual({ progress: 30, manualProgress: true });
  });

  it('a stored map with Jira fields is migrated once, and the plan renders the same apart from those fields', async () => {
    await storage.set('scheduleMap:TEST', { 'TEST-1': { startWeek: weeks[5].weekKey, spanWeeks: 2, summary: 'Old', resource: 'Old' } });
    storage.sets = [];
    const first = await getProjectPlan('TEST', storage);
    expect(await entryOf(storage, 'TEST-1')).toEqual({ startWeek: weeks[5].weekKey, spanWeeks: 2 });
    expect(storage.store.has('scheduleMap:TEST')).toBe(false);
    // After the one-time migration, a plan load writes nothing (B-09, INV-07).
    storage.sets = [];
    const second = await getProjectPlan('TEST', storage);
    expect(storage.sets).toEqual([]);
    const pick = (p: any) => p.tasks.map((t: any) => [t.key, t.summary, t.startWeek, t.spanWeeks]);
    expect(pick(second)).toEqual(pick(first));
  });

  it('a summary edit goes to Jira and is not stored', async () => {
    await storage.set('scheduleMap:TEST', { 'TEST-1': { startWeek: weeks[5].weekKey, spanWeeks: 1 } });
    await updateWbsTask({ projectKey: 'TEST', taskId: 'TEST-1', updates: { summary: 'Renamed' } });
    expect(puts('TEST-1')[0]).toEqual({ summary: 'Renamed' });
    const stored = (await entryOf(storage, 'TEST-1'));
    expect(stored.summary).toBeUndefined();
    expect(stored.manualProgress).toBeUndefined();
  });

  it('an epic change is written to Jira as the parent and is not stored', async () => {
    await storage.set('scheduleMap:TEST', { 'TEST-1': { startWeek: weeks[5].weekKey, spanWeeks: 1 } });
    await updateWbsTask({ projectKey: 'TEST', taskId: 'TEST-1', updates: { epic: 'Platform', epicKey: 'TEST-2' } });
    expect(puts('TEST-1')[0]).toEqual({ parent: { key: 'TEST-2' } });
    const stored = (await entryOf(storage, 'TEST-1'));
    expect(stored.epic).toBeUndefined();
    expect(stored.epicKey).toBeUndefined();
  });

  it('removing the epic clears the Jira parent', async () => {
    await storage.set('scheduleMap:TEST', { 'TEST-1': { startWeek: weeks[5].weekKey, spanWeeks: 1 } });
    await updateWbsTask({ projectKey: 'TEST', taskId: 'TEST-1', updates: { epic: '', epicKey: '' } });
    expect(puts('TEST-1')[0]).toEqual({ parent: null });
  });

  it('setting progress by hand marks it manual; other edits do not', async () => {
    await storage.set('scheduleMap:TEST', { 'TEST-1': { startWeek: weeks[5].weekKey, spanWeeks: 1 } });
    await updateWbsTask({ projectKey: 'TEST', taskId: 'TEST-1', updates: { progress: 30 } });
    const stored = (await entryOf(storage, 'TEST-1'));
    expect(stored.progress).toBe(30);
    expect(stored.manualProgress).toBe(true);
  });

  it('a computed parent roll-up is not stored as progress', async () => {
    await storage.set('scheduleMap:TEST', {
      'TEST-2': { startWeek: weeks[5].weekKey, spanWeeks: 2 },
      'TEST-3': { startWeek: weeks[5].weekKey, spanWeeks: 1 }
    });
    await updateWbsTask({ projectKey: 'TEST', taskId: 'TEST-3', updates: { startWeek: weeks[6].weekKey } });
    expect((await entryOf(storage, 'TEST-2')).progress).toBeUndefined();
  });
});
