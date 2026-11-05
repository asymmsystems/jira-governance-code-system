/*
 * Copyright (c) 2026 Asymm Systems. All rights reserved.
 *
 * @author Fahim Farook
 */

/**
 * CascadePlan: resolvers on per-issue KVS records with a version check (B-09, INV-07, INV-08).
 */

import { getProjectPlan, updateWbsTask, scheduleBacklogTask, setGlobalStorageProvider, resolveStorage, getTimelineWeeks } from '../src/index';
import { MemStorage, entryOf, recordOf } from './helpers/mem-storage';
import { kvs } from '@forge/kvs';

const mockRequestJira = jest.fn();
jest.mock('@forge/api', () => ({
  __esModule: true,
  default: {
    asApp: () => ({ requestJira: mockRequestJira }),
    asUser: () => ({ requestJira: mockRequestJira })
  },
  route: (strings: any, ...values: any[]) => strings.reduce((acc: string, str: string, i: number) => acc + str + (values[i] !== undefined ? values[i] : ''), '')
}));
const mockGetMany = jest.fn();
const mockCursor = jest.fn();
jest.mock('@forge/kvs', () => {
  const builder: any = {};
  builder.where = jest.fn(() => builder);
  builder.limit = jest.fn(() => builder);
  builder.cursor = jest.fn((c: string) => { mockCursor(c); return builder; });
  builder.getMany = jest.fn(() => mockGetMany());
  return {
    kvs: { get: jest.fn(), set: jest.fn(), delete: jest.fn(), query: jest.fn(() => builder) },
    WhereConditions: { beginsWith: (v: string) => ({ beginsWith: v }) }
  };
});

const weeks = getTimelineWeeks().weeks;
const ISSUES = Array.from({ length: 1000 }, (_, i) => ({ id: String(10001 + i), key: `TEST-${i + 1}`,
  fields: { summary: `Task ${i + 1}`, issuetype: { name: 'Task', hierarchyLevel: 0 }, status: { statusCategory: { key: 'new' } } } }));

describe('per-issue storage (B-09)', () => {
  let storage: MemStorage;

  beforeEach(() => {
    storage = new MemStorage();
    setGlobalStorageProvider(storage);
    mockRequestJira.mockReset();
    mockRequestJira.mockImplementation(async (routeStr: any, options?: any) => {
      const url = String(routeStr);
      const lookup = url.match(/\/rest\/api\/3\/issue\/([A-Z0-9_]+)-(\d+)\?fields=project/);
      if (lookup) return { status: 200, json: async () => ({ id: String(10000 + Number(lookup[2])), fields: { project: { key: lookup[1] } } }) };
      if (url.includes('/search/jql')) return { status: 200, json: async () => ({ issues: ISSUES.slice(0, 3) }) };
      return { status: 204, json: async () => ({}) };
    });
  });

  it('migrating 1,000 legacy entries keeps every value below 8 KiB and keys records by issue id', async () => {
    mockRequestJira.mockImplementation(async (url: string) => String(url).includes('/search/jql')
      ? { status: 200, json: async () => ({ issues: ISSUES }) } : { status: 200, json: async () => [] });
    const map: Record<string, any> = {};
    for (let i = 1; i <= 1000; i++) {
      map[`TEST-${i}`] = { startWeek: weeks[4].weekKey, spanWeeks: 3, startDate: weeks[4].startDate, endDate: weeks[6].endDate,
        weeklyAllocations: { a: 33, b: 33, c: 33 }, summary: 'stale', contributingResources: ['Ann Lee', 'Bo Chen'],
        dependency: i > 1 ? { predecessorKey: `TEST-${i - 1}`, predecessorId: `TEST-${i - 1}`, triggerPercent: 30, isTriggerSatisfied: false, jiraLinkId: '12345' } : undefined };
    }
    await storage.set('scheduleMap:TEST', map);
    const plan = await getProjectPlan('TEST', storage, new Date(), undefined, '10000');
    expect(plan.tasks.length).toBe(1000);
    const values = [...storage.store.entries()];
    expect(Math.max(...values.map(([, v]) => Buffer.byteLength(JSON.stringify(v))))).toBeLessThan(8 * 1024);
    expect(storage.store.has('cp:10000:we:10001')).toBe(true);
    expect(storage.store.has('scheduleMap:TEST')).toBe(false);
  });

  it('a plan load writes nothing to KVS once migrated', async () => {
    await getProjectPlan('TEST', storage);
    storage.sets = [];
    storage.deletes = [];
    await getProjectPlan('TEST', storage);
    expect(storage.sets).toEqual([]);
    expect(storage.deletes).toEqual([]);
  });

  it('two writes from the same base version: the second gets a conflict and no Jira write, the first survives', async () => {
    await scheduleBacklogTask({ projectKey: 'TEST', taskId: 'TEST-1', startWeek: weeks[5].weekKey });
    const base = (await recordOf(storage, 'TEST-1')).version;
    const first: any = await updateWbsTask({ projectKey: 'TEST', taskId: 'TEST-1', updates: { targetProgress: 40 }, expectedVersion: base });
    expect(first.ok).toBe(true);
    mockRequestJira.mockClear();
    const second: any = await updateWbsTask({ projectKey: 'TEST', taskId: 'TEST-1', updates: { summary: 'Late edit', targetProgress: 90 }, expectedVersion: base });
    expect(second).toMatchObject({ ok: false, error: 'conflict', conflict: true });
    expect(second.message).toContain('TEST-1');
    expect(mockRequestJira.mock.calls.filter(c => c[1]?.method === 'PUT')).toEqual([]);
    expect((await entryOf(storage, 'TEST-1')).targetProgress).toBe(40);
  });

  it('expectedVersion must be a whole number', async () => {
    await expect(updateWbsTask({ projectKey: 'TEST', taskId: 'TEST-1', updates: {}, expectedVersion: -1 })).rejects.toThrow('expectedVersion');
  });

  it('records are keyed by the project id, so a renamed project keeps its plan', async () => {
    await scheduleBacklogTask({ projectKey: 'TEST', projectId: '10000', taskId: 'TEST-2', startWeek: weeks[5].weekKey });
    expect([...storage.store.keys()].filter(k => k.includes(':we:'))).toEqual(['cp:10000:we:10002']);
    const renamed = await getProjectPlan('NEWKEY', storage, new Date(), undefined, '10000');
    expect(renamed.tasks.map(t => t.key)).toContain('TEST-2');
  });

  it('the Forge KVS provider pages queries by cursor and swaps atomically', async () => {
    setGlobalStorageProvider(null);
    const saved = process.env.NODE_ENV;
    process.env.NODE_ENV = 'production';
    const provider = resolveStorage();
    process.env.NODE_ENV = saved;
    mockGetMany.mockResolvedValueOnce({ results: [{ key: 'cp:1:we:1', value: { a: 1 } }], nextCursor: 'c2' })
      .mockResolvedValueOnce({ results: [{ key: 'cp:1:we:2', value: { a: 2 } }] });
    const rows = await provider.query!('cp:1:we:');
    expect(rows).toEqual([{ key: 'cp:1:we:1', value: { a: 1 } }, { key: 'cp:1:we:2', value: { a: 2 } }]);
    expect(mockCursor).toHaveBeenCalledWith('c2');
    (kvs.set as jest.Mock).mockResolvedValueOnce({ key: 'k', value: { version: 3 } }).mockResolvedValueOnce(undefined);
    expect(await provider.swap!('k', { version: 4 })).toEqual({ version: 3 });
    expect(kvs.set).toHaveBeenCalledWith('k', { version: 4 }, { keyPolicy: 'OVERRIDE', returnValue: 'PREVIOUS' });
    expect(await provider.swap!('k', { version: 1 })).toBeUndefined();
  });
});

describe('conflict paths of each write resolver (B-09, INV-08)', () => {
  let storage: MemStorage;

  /** On the nth swap, another writer saves a newer version of the same key first. */
  function raceOnSwap(n: number) {
    const real = storage.swap.bind(storage);
    let count = 0;
    storage.swap = async (key: string, value: any) => {
      count++;
      if (count === n) {
        const cur = storage.store.get(key) || { issueKey: value.issueKey, issueId: value.issueId, version: 0 };
        storage.store.set(key, { ...cur, version: (cur.version || 0) + 7, note: 'other writer' });
      }
      return real(key, value);
    };
  }

  beforeEach(async () => {
    storage = new MemStorage();
    setGlobalStorageProvider(storage);
    mockRequestJira.mockReset();
    mockRequestJira.mockImplementation(async (routeStr: any) => {
      const url = String(routeStr);
      const lookup = url.match(/\/rest\/api\/3\/issue\/([A-Z0-9_]+)-(\d+)\?fields=project/);
      if (lookup) return { status: 200, json: async () => ({ id: String(10000 + Number(lookup[2])), fields: { project: { key: lookup[1] } } }) };
      if (url.includes('/search/jql')) return { status: 200, json: async () => ({ issues: ISSUES.slice(0, 3) }) };
      return { status: 204, json: async () => ({}) };
    });
    await storage.set('scheduleMap:TEST', {
      'TEST-1': { startWeek: weeks[4].weekKey, spanWeeks: 2, startDate: weeks[4].startDate, endDate: weeks[5].endDate },
      'TEST-2': { startWeek: weeks[4].weekKey, spanWeeks: 1, startDate: weeks[4].startDate, endDate: weeks[4].endDate,
        dependency: { predecessorKey: 'TEST-1', predecessorId: 'TEST-1', triggerPercent: 100, isTriggerSatisfied: false } }
    });
    await getProjectPlan('TEST', storage);
  });

  // addSubtaskToTask writes no plan record since F-23 (a real Jira sub-task), so it cannot conflict.
  it('scheduleBacklogTask, unscheduleTask and saveTaskDependency return conflict', async () => {
    const { unscheduleTask, saveTaskDependency } = require('../src/index');
    raceOnSwap(1);
    expect(await scheduleBacklogTask({ projectKey: 'TEST', taskId: 'TEST-3', startWeek: weeks[5].weekKey })).toMatchObject({ ok: false, error: 'conflict' });
    raceOnSwap(1);
    expect(await unscheduleTask({ projectKey: 'TEST', taskId: 'TEST-1' })).toMatchObject({ ok: false, error: 'conflict' });
    raceOnSwap(1);
    expect(await saveTaskDependency({ projectKey: 'TEST', taskId: 'TEST-3', dependency: { predecessorId: 'TEST-1', predecessorKey: 'TEST-1', triggerPercent: 30, isTriggerSatisfied: false } })).toMatchObject({ ok: false, error: 'conflict' });
  });

  it('updateWbsTask returns conflict when the target record changes during the write', async () => {
    raceOnSwap(1);
    const res: any = await updateWbsTask({ projectKey: 'TEST', taskId: 'TEST-1', updates: { targetProgress: 10 } });
    expect(res).toMatchObject({ ok: false, error: 'conflict' });
  });

  it('a cascaded successor changed by someone else is reported and not moved', async () => {
    raceOnSwap(2);
    const res: any = await updateWbsTask({ projectKey: 'TEST', taskId: 'TEST-1', updates: { startWeek: weeks[6].weekKey } });
    expect(res.ok).toBe(true);
    expect(res.jiraSync.writes).toContainEqual({ key: 'TEST-2', fields: ['plan'], ok: false, error: 'not moved: someone else changed it; move the task again' });
    expect((await recordOf(storage, 'TEST-2')).note).toBe('other writer');
  });

  it('reorder gives rows without a sequence number one, then places the moved row between neighbours', async () => {
    const { reorderWbsTasks } = require('../src/index');
    await scheduleBacklogTask({ projectKey: 'TEST', taskId: 'TEST-3', startWeek: weeks[5].weekKey });
    const plan = await reorderWbsTasks({ projectKey: 'TEST', taskId: 'TEST-3', targetIndex: 0 });
    expect(plan.tasks.map((t: any) => t.key)).toEqual(['TEST-3', 'TEST-1', 'TEST-2']);
    expect((await recordOf(storage, 'TEST-1')).sequenceNum).toBe(1000);
    expect((await recordOf(storage, 'TEST-3')).sequenceNum).toBeLessThan(1000);
  });
});
