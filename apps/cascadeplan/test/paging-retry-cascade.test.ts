/*
 * Copyright (c) 2026 Asymm Systems. All rights reserved.
 *
 * @author Fahim Farook
 */

/**
 * CascadePlan: paged reads, 429 backoff, one plan build per update, bounded cascade (B-10).
 */

import {
  getProjectPlan,
  updateWbsTask,
  continueCascade,
  previewCascade,
  setGlobalStorageProvider,
  setSleepForTests,
  getJiraCaller,
  getTimelineWeeks,
  CASCADE_BATCH_LIMIT
} from '../src/index';
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
const issue = (n: number) => ({ id: String(20000 + n), key: `TEST-${n}`,
  fields: { summary: `T${n}`, issuetype: { name: 'Task', hierarchyLevel: 0 }, status: { statusCategory: { key: 'new' } } } });
const isIssueSearch = (url: string) => url.includes('/search/jql') && !url.includes('issuetype in (Epic') && !url.includes('issuetype = "Epic"');

describe('paged reads (B-10)', () => {
  let sleeps: number[];
  beforeEach(() => {
    setGlobalStorageProvider(new MemStorage());
    sleeps = [];
    setSleepForTests(async (ms: number) => { sleeps.push(ms); });
    mockRequestJira.mockReset();
  });

  it('follows nextPageToken until the last page', async () => {
    mockRequestJira.mockImplementation(async (url: string) => {
      if (isIssueSearch(url)) {
        if (!url.includes('nextPageToken=')) return { status: 200, json: async () => ({ issues: Array.from({ length: 100 }, (_, i) => issue(i + 1)), nextPageToken: 'p2' }) };
        return { status: 200, json: async () => ({ issues: Array.from({ length: 50 }, (_, i) => issue(i + 101)), isLast: true }) };
      }
      return { status: 200, json: async () => [] };
    });
    const plan = await getProjectPlan('TEST');
    expect(plan.backlogTasks!.length).toBe(150);
    expect(plan.truncated).toBeUndefined();
    expect(mockRequestJira.mock.calls.some(c => String(c[0]).includes('nextPageToken=p2'))).toBe(true);
  });

  it('stops at the page cap and reports shown and total', async () => {
    let page = 0;
    mockRequestJira.mockImplementation(async (url: string, options?: any) => {
      if (String(url).includes('/search/approximate-count')) return { status: 200, json: async () => ({ count: 1234 }) };
      if (isIssueSearch(url)) {
        page++;
        return { status: 200, json: async () => ({ issues: Array.from({ length: 100 }, (_, i) => issue(page * 100 + i)), nextPageToken: `p${page + 1}` }) };
      }
      return { status: 200, json: async () => [] };
    });
    const plan = await getProjectPlan('TEST');
    expect(plan.backlogTasks!.length).toBe(1000);
    expect(plan.truncated).toEqual({ shown: 1000, total: 1234 });
  });
});

describe('429 backoff (B-10)', () => {
  let sleeps: number[];
  beforeEach(() => {
    sleeps = [];
    setSleepForTests(async (ms: number) => { sleeps.push(ms); });
    mockRequestJira.mockReset();
  });

  it('retries after Retry-After and succeeds', async () => {
    mockRequestJira
      .mockResolvedValueOnce({ status: 429, headers: { get: (h: string) => (h.toLowerCase() === 'retry-after' ? '2' : null) } })
      .mockResolvedValueOnce({ status: 200, json: async () => ({ ok: 1 }) });
    const res = await getJiraCaller().requestJira('/rest/api/3/myself' as any);
    expect(res.status).toBe(200);
    expect(sleeps).toEqual([2000]);
  });

  it('gives up after three retries', async () => {
    mockRequestJira.mockResolvedValue({ status: 429, headers: { get: () => '1' } });
    const res = await getJiraCaller().requestJira('/rest/api/3/myself' as any);
    expect(res.status).toBe(429);
    expect(mockRequestJira).toHaveBeenCalledTimes(4);
    expect(sleeps).toEqual([1000, 1000, 1000]);
  });

  it('never waits past the 20 s budget and uses a short backoff when Retry-After is missing', async () => {
    mockRequestJira
      .mockResolvedValueOnce({ status: 429 })
      .mockResolvedValueOnce({ status: 429, headers: { get: () => '30' } })
      .mockResolvedValueOnce({ status: 200, json: async () => ({}) });
    const res = await getJiraCaller().requestJira('/rest/api/3/myself' as any);
    expect(res.status).toBe(429);
    expect(sleeps).toEqual([1000]);
  });
});

describe('one plan build and a bounded cascade (B-10)', () => {
  let storage: MemStorage;
  const CHAIN = 30;

  beforeEach(async () => {
    storage = new MemStorage();
    setGlobalStorageProvider(storage);
    setSleepForTests(async () => undefined);
    mockRequestJira.mockReset();
    mockRequestJira.mockImplementation(async (url: string, options?: any) => {
      const u = String(url);
      const lookup = u.match(/\/rest\/api\/3\/issue\/([A-Z0-9_]+)-(\d+)\?fields=project/);
      if (lookup) return { status: 200, json: async () => ({ id: String(20000 + Number(lookup[2])), fields: { project: { key: lookup[1] } } }) };
      if (isIssueSearch(u)) return { status: 200, json: async () => ({ issues: Array.from({ length: CHAIN }, (_, i) => issue(i + 1)), isLast: true }) };
      return { status: 204, json: async () => ({}) };
    });
    // A fan-out: TEST-2 to TEST-30 each start when TEST-1 is 100% done. All start in the same week, so every link conflicts.
    const map: Record<string, any> = {};
    for (let n = 1; n <= CHAIN; n++) {
      map[`TEST-${n}`] = { startWeek: weeks[1].weekKey, spanWeeks: 1, startDate: weeks[1].startDate, endDate: weeks[1].endDate,
        dependency: n > 1 ? { predecessorKey: 'TEST-1', predecessorId: 'TEST-1', triggerPercent: 100, isTriggerSatisfied: false } : undefined };
    }
    await storage.set('scheduleMap:TEST', map);
    await getProjectPlan('TEST', storage);
  });

  it('updateWbsTask searches Jira issues once', async () => {
    mockRequestJira.mockClear();
    await updateWbsTask({ projectKey: 'TEST', taskId: 'TEST-30', updates: { targetProgress: 10 } });
    expect(mockRequestJira.mock.calls.filter(c => isIssueSearch(String(c[0]))).length).toBe(1);
  });

  it('previewCascade lists the moves and writes nothing', async () => {
    mockRequestJira.mockClear();
    storage.sets = [];
    const res: any = await previewCascade({ projectKey: 'TEST', taskId: 'TEST-1', updates: { startWeek: weeks[2].weekKey } });
    expect(res.ok).toBe(true);
    expect(res.changes.length).toBeGreaterThan(CASCADE_BATCH_LIMIT);
    expect(res.changes[0]).toMatchObject({ key: 'TEST-2', field: 'startDate' });
    expect(res.changes[0].reason).toContain('TEST-1 reaches 100%');
    expect(storage.sets).toEqual([]);
    expect(mockRequestJira.mock.calls.filter(c => c[1]?.method && c[1].method !== 'GET')).toEqual([]);
  });

  it('a long cascade moves at most the batch limit per call and continues', async () => {
    mockRequestJira.mockClear();
    const first: any = await updateWbsTask({ projectKey: 'TEST', taskId: 'TEST-1', updates: { startWeek: weeks[2].weekKey } });
    const putsFirst = mockRequestJira.mock.calls.filter(c => c[1]?.method === 'PUT').length;
    expect(putsFirst).toBeLessThanOrEqual(CASCADE_BATCH_LIMIT + 1);
    expect(first.cascadeRemaining.length).toBeGreaterThan(0);
    let res: any = first;
    let rounds = 0;
    while (res.cascadeRemaining && res.cascadeRemaining.length > 0 && rounds < 10) {
      res = await continueCascade({ projectKey: 'TEST', taskId: 'TEST-1' });
      rounds++;
    }
    expect(res.cascadeRemaining).toEqual([]);
    const pred = await entryOf(storage, 'TEST-1');
    for (let n = 2; n <= CHAIN; n++) expect((await entryOf(storage, `TEST-${n}`)).startDate > pred.endDate).toBe(true);
  });
});

describe('read failures while paging (B-10)', () => {
  beforeEach(() => {
    setGlobalStorageProvider(new MemStorage());
    setSleepForTests(async () => undefined);
    mockRequestJira.mockReset();
  });

  it('keeps the pages already read when a later page fails, and reports the count it could not read', async () => {
    mockRequestJira.mockImplementation(async (url: string) => {
      if (String(url).includes('/search/approximate-count')) return { status: 500, json: async () => ({}) };
      if (isIssueSearch(url)) {
        if (!String(url).includes('nextPageToken=')) return { status: 200, json: async () => ({ issues: Array.from({ length: 100 }, (_, i) => issue(i + 1)), nextPageToken: 'p2' }) };
        return { status: 500, json: async () => ({}) };
      }
      return { status: 200, json: async () => [] };
    });
    const plan = await getProjectPlan('TEST');
    expect(plan.backlogTasks!.length).toBe(100);
    expect(plan.truncated).toEqual({ shown: 100, total: 100 });
  });

  it('marks the plan as not live when the first page throws', async () => {
    mockRequestJira.mockImplementation(async (url: string) => {
      if (isIssueSearch(url)) throw new Error('offline');
      return { status: 200, json: async () => [] };
    });
    const plan = await getProjectPlan('TEST');
    expect(plan.isLiveSynced).toBe(false);
    expect(plan.tasks).toEqual([]);
  });

  it('keeps the first page when the count request throws', async () => {
    mockRequestJira.mockImplementation(async (url: string) => {
      if (String(url).includes('/search/approximate-count')) throw new Error('count failed');
      if (isIssueSearch(url)) return { status: 200, json: async () => ({ issues: [issue(1)], nextPageToken: String(url).includes('nextPageToken=') ? undefined : 'p2', isLast: false }) };
      return { status: 200, json: async () => [] };
    });
    const plan = await getProjectPlan('TEST');
    expect(plan.backlogTasks!.length).toBe(2);
  });
});

describe('continueCascade conflicts (B-10)', () => {
  it('reports a successor changed by someone else and does not move it', async () => {
    const storage = new MemStorage();
    setGlobalStorageProvider(storage);
    setSleepForTests(async () => undefined);
    mockRequestJira.mockReset();
    mockRequestJira.mockImplementation(async (url: string) => {
      if (isIssueSearch(url)) return { status: 200, json: async () => ({ issues: [issue(1), issue(2)], isLast: true }) };
      return { status: 204, json: async () => ({}) };
    });
    await storage.set('scheduleMap:TEST', {
      'TEST-1': { startWeek: weeks[3].weekKey, spanWeeks: 1, startDate: weeks[3].startDate, endDate: weeks[3].endDate },
      'TEST-2': { startWeek: weeks[1].weekKey, spanWeeks: 1, startDate: weeks[1].startDate, endDate: weeks[1].endDate,
        dependency: { predecessorKey: 'TEST-1', predecessorId: 'TEST-1', triggerPercent: 100, isTriggerSatisfied: false } }
    });
    await getProjectPlan('TEST', storage);
    const real = storage.swap.bind(storage);
    storage.swap = async (key: string, value: any) => {
      storage.store.set(key, { ...storage.store.get(key), version: 99 });
      storage.swap = real;
      return real(key, value);
    };
    const res: any = await continueCascade({ projectKey: 'TEST', taskId: 'TEST-1' });
    expect(res.jiraSync.writes).toContainEqual({ key: 'TEST-2', fields: ['plan'], ok: false, error: 'not moved: someone else changed it; move the task again' });
    expect(res.cascadeRemaining).toEqual([]);
  });
});
