/*
 * Copyright (c) 2026 Asymm Systems. All rights reserved.
 *
 * @author Fahim Farook
 */

/**
 * CascadePlan: batch updates in one resolver call (B-16 criteria 3 and 4).
 */

import { batchUpdateTasks, getProjectPlan, setGlobalStorageProvider, setSleepForTests, getTimelineWeeks } from '../src/index';
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
const status = { statusCategory: { key: 'new' } };
const issue = (n: number) => ({ id: String(n), key: `TEST-${n}`, fields: { summary: `T${n}`, issuetype: { name: 'Task', hierarchyLevel: 0 }, status } });
const add = (iso: string, d: number) => new Date(Date.parse(`${iso}T00:00:00Z`) + d * 86400000).toISOString().slice(0, 10);

describe('batchUpdateTasks (B-16)', () => {
  let storage: MemStorage;
  let searches: number;

  beforeEach(async () => {
    storage = new MemStorage();
    setGlobalStorageProvider(storage);
    setSleepForTests(async () => undefined);
    searches = 0;
    mockRequestJira.mockReset();
    mockRequestJira.mockImplementation(async (routeStr: any) => {
      const url = String(routeStr);
      const one = url.match(/\/rest\/api\/3\/issue\/(TEST-\d+)\?fields=project/);
      if (one) return { status: 200, json: async () => ({ fields: { project: { key: 'TEST' } } }) };
      if (url.includes('/search/jql') && !url.includes('Epic')) searches++;
      if (url.includes('/search/jql')) return { status: 200, json: async () => ({ issues: url.includes('Epic') ? [] : [1, 2, 3, 4, 5, 6].map(issue), isLast: true }) };
      return { status: 204, json: async () => ({}) };
    });
    const w = weeks[5];
    const map: any = {};
    for (let n = 1; n <= 5; n++) map[`TEST-${n}`] = { startWeek: w.weekKey, spanWeeks: 1, startDate: w.startDate, endDate: add(w.startDate, 2) };
    // TEST-6 waits for TEST-5 to finish and starts the day after it.
    map['TEST-6'] = { startWeek: w.weekKey, spanWeeks: 1, startDate: add(w.startDate, 3), endDate: add(w.startDate, 4),
      dependency: { predecessorKey: 'TEST-5', predecessorId: 'TEST-5', triggerPercent: 100, isTriggerSatisfied: false } };
    await storage.set('scheduleMap:TEST', map);
    await getProjectPlan('TEST', storage);
  });

  it('moves 5 tasks by 3 days and their dependent in one call, with one Jira read and every write reported', async () => {
    const start = weeks[5].startDate;
    searches = 0;
    const items = [1, 2, 3, 4, 5].map(n => ({ taskId: `TEST-${n}`, updates: { startDate: add(start, 3), endDate: add(start, 5) } }));
    const res: any = await batchUpdateTasks({ projectKey: 'TEST', items });
    expect(res.ok).toBe(true);
    for (let n = 1; n <= 5; n++) expect(await entryOf(storage, `TEST-${n}`)).toMatchObject({ startDate: add(start, 3), endDate: add(start, 5) });
    expect(await entryOf(storage, 'TEST-6')).toMatchObject({ startDate: add(start, 6), endDate: add(start, 7) });
    expect(res.results.map((r: any) => r.ok)).toEqual([true, true, true, true, true]);
    expect(res.jiraSync.writes.map((w: any) => w.key).sort()).toEqual(['TEST-1', 'TEST-2', 'TEST-3', 'TEST-4', 'TEST-5', 'TEST-6']);
    expect(searches).toBeLessThanOrEqual(2);
    expect(Array.isArray(res.tasks)).toBe(true);
  });

  it('20 progress changes in one call', async () => {
    const items = Array.from({ length: 20 }, (_, i) => ({ taskId: `TEST-${(i % 5) + 1}`, updates: { progress: (i % 10) * 10 } }));
    const res: any = await batchUpdateTasks({ projectKey: 'TEST', items });
    expect(res.results.length).toBe(20);
    expect(res.results.every((r: any) => r.ok)).toBe(true);
  });

  it('a version changed by an earlier item of the same batch is retried; a stale version from elsewhere is a conflict', async () => {
    const start = weeks[5].startDate;
    const plan = await getProjectPlan('TEST', storage);
    const v = (k: string) => plan.tasks.find(t => t.key === k)!.version || 0;
    // Moving TEST-5 cascades TEST-6 (its version changes); TEST-6's own item still applies.
    const res: any = await batchUpdateTasks({ projectKey: 'TEST', items: [
      { taskId: 'TEST-5', updates: { startDate: add(start, 1), endDate: add(start, 3) }, expectedVersion: v('TEST-5') },
      { taskId: 'TEST-6', updates: { startDate: add(start, 10), endDate: add(start, 11) }, expectedVersion: v('TEST-6') },
      { taskId: 'TEST-1', updates: { startDate: add(start, 1), endDate: add(start, 3) }, expectedVersion: v('TEST-1') + 7 }
    ] });
    expect(res.results).toEqual([{ taskId: 'TEST-5', ok: true }, { taskId: 'TEST-6', ok: true }, { taskId: 'TEST-1', ok: false, conflict: true }]);
    expect(await entryOf(storage, 'TEST-6')).toMatchObject({ startDate: add(start, 10) });
    expect(res.ok).toBe(false);
  });

  it('rejects an empty or oversized batch and a bad key', async () => {
    await expect(batchUpdateTasks({ projectKey: 'TEST', items: [] })).rejects.toThrow(/items/);
    await expect(batchUpdateTasks({ projectKey: 'TEST', items: Array.from({ length: 51 }, () => ({ taskId: 'TEST-1', updates: {} })) })).rejects.toThrow(/items/);
    await expect(batchUpdateTasks({ projectKey: 'TEST', items: [{ taskId: 'bad', updates: {} }] })).rejects.toThrow(/taskId/);
  });
});
