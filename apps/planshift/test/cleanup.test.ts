/*
 * Copyright (c) 2026 Asymm Systems. All rights reserved.
 *
 * @author Fahim Farook
 */

/**
 * CascadePlan: no synthetic data, no ghost rows, weeks per call, no dead UI code (B-18, D-10).
 */

import * as fs from 'fs';
import * as path from 'path';
import { getProjectPlan, pruneStaleEntries, scheduleBacklogTask, fetchProjectUsers, getTimelineWeeks, setGlobalStorageProvider } from '../src/index';
import { MemStorage } from './helpers/mem-storage';

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

const ROOT = path.join(__dirname, '..');
const read = (p: string) => fs.readFileSync(path.join(ROOT, p), 'utf8');
const status = { statusCategory: { key: 'new' } };
const issue = (n: number) => ({ id: String(n), key: `TEST-${n}`, fields: { summary: `T${n}`, issuetype: { name: 'Task', hierarchyLevel: 0 }, status } });

describe('no synthetic data or dead UI (B-18 criteria 1, 4 and 5; D-10)', () => {
  const html = read('static/frontend/build/index.html');
  const ui = read('src/frontend/legacy-planner.js');
  const api = read('src/index.ts');

  it('no fixed badge text before load, no invented defaults, no placeholder users', () => {
    expect(html).not.toMatch(/Project: DEMO|Completion: 31%/);
    expect(ui).not.toMatch(/'General'|'Prerequisites'/);
    expect(api).not.toMatch(/PLACEHOLDER_USERS|\(Placeholder\)/);
  });

  it('the heatmap view with invented department data is gone (D-10)', () => {
    for (const src of [html, ui, api, read('src/domain/planner-engine.ts'), read('src/domain/models.ts')]) expect(src).not.toMatch(/[Hh]eatmap/);
  });

  it('the unused React entry is deleted, and the local checklist is not called sub-tasks', () => {
    expect(fs.existsSync(path.join(ROOT, 'src/frontend/index.tsx'))).toBe(false);
    expect(html).not.toContain('Subtasks &amp; Risk Buffer');
    expect(html).not.toContain('Subtasks & Risk Buffer');
    expect(html).toContain('Checklist and risk buffer (CascadePlan only, not Jira sub-tasks)');
  });
});

describe('ghost rows and pruning (B-18 criterion 2)', () => {
  let storage: MemStorage;
  let deletedInJira: Set<string>;

  beforeEach(async () => {
    storage = new MemStorage();
    setGlobalStorageProvider(storage);
    deletedInJira = new Set(['TEST-9']);
    mockRequestJira.mockReset();
    mockRequestJira.mockImplementation(async (routeStr: any) => {
      const url = String(routeStr);
      if (url.includes('/search/jql')) return { status: 200, json: async () => ({ issues: url.includes('Epic') ? [] : [issue(1)], isLast: true }) };
      const one = url.match(/\/rest\/api\/3\/issue\/(TEST-\d+)\?fields=project/);
      if (one) return deletedInJira.has(one[1]) ? { status: 404, json: async () => ({}) } : { status: 200, json: async () => ({ fields: { project: { key: 'TEST' } } }) };
      if (url.includes('/user/assignable/search')) return { status: 200, json: async () => [{ accountId: 'acc-1', displayName: 'Ann Lee' }] };
      return { status: 200, json: async () => [] };
    });
    const weeks = getTimelineWeeks().weeks;
    await storage.set('scheduleMap:TEST', {
      'TEST-1': { startWeek: weeks[2].weekKey, spanWeeks: 1, startDate: weeks[2].startDate, endDate: weeks[2].endDate },
      'TEST-8': { startWeek: weeks[2].weekKey, spanWeeks: 1, startDate: weeks[2].startDate, endDate: weeks[2].endDate },
      'TEST-9': { startWeek: weeks[2].weekKey, spanWeeks: 1, startDate: weeks[2].startDate, endDate: weeks[2].endDate }
    });
  });

  it('an entry Jira did not return is not rendered, and is listed as stale', async () => {
    const plan = await getProjectPlan('TEST', storage);
    expect(plan.tasks.map(t => t.key)).toEqual(['TEST-1']);
    expect(plan.staleEntries).toEqual(['TEST-8', 'TEST-9']);
  });

  it('pruning deletes only entries Jira confirms are gone (404); an issue that still exists is kept', async () => {
    await getProjectPlan('TEST', storage);
    const res: any = await pruneStaleEntries({ projectKey: 'TEST', keys: ['TEST-8', 'TEST-9', 'TEST-1'] });
    expect(res).toMatchObject({ ok: true, pruned: ['TEST-9'] });
    const keys = (await storage.query<any>('cp:TEST:we:')).map(r => r.value.issueKey).sort();
    expect(keys).toEqual(['TEST-1', 'TEST-8']);
  });

  it('a truncated Jira read lists nothing as stale', async () => {
    mockRequestJira.mockImplementation(async (routeStr: any) => {
      const url = String(routeStr);
      if (url.includes('/search/approximate-count')) return { status: 200, json: async () => ({ count: 5000 }) };
      if (url.includes('/search/jql')) return { status: 200, json: async () => ({ issues: url.includes('Epic') ? [] : [issue(1)], isLast: false, nextPageToken: 'more' }) };
      return { status: 200, json: async () => [] };
    });
    const plan = await getProjectPlan('TEST', storage);
    expect(plan.truncated).toBeDefined();
    expect(plan.staleEntries).toEqual([]);
  });

  it('only real Jira users are offered (no placeholder people)', async () => {
    expect((await fetchProjectUsers('TEST')).map(u => u.accountId)).toEqual(['unassigned', 'acc-1']);
  });
});

describe('weeks are computed per call (B-18 criterion 3)', () => {
  afterEach(() => jest.useRealTimers());

  it('a resolver uses the weeks of the moment it runs, not of module load', async () => {
    const storage = new MemStorage();
    setGlobalStorageProvider(storage);
    mockRequestJira.mockReset();
    mockRequestJira.mockImplementation(async (routeStr: any) => {
      const url = String(routeStr);
      const one = url.match(/\/rest\/api\/3\/issue\/(TEST-\d+)\?fields=project/);
      if (one) return { status: 200, json: async () => ({ fields: { project: { key: 'TEST' } } }) };
      if (url.includes('/search/jql')) return { status: 200, json: async () => ({ issues: url.includes('Epic') ? [] : [issue(1)], isLast: true }) };
      return { status: 204, json: async () => ({}) };
    });
    jest.useFakeTimers({ now: new Date('2027-03-03T10:00:00Z'), doNotFake: ['nextTick', 'setImmediate', 'setTimeout', 'clearTimeout', 'setInterval', 'clearInterval', 'queueMicrotask', 'performance', 'hrtime'] });
    const week = getTimelineWeeks().weeks[5];
    await scheduleBacklogTask({ projectKey: 'TEST', taskId: 'TEST-1', startWeek: week.weekKey, spanWeeks: 1 });
    const rec = (await storage.query<any>('cp:TEST:we:')).find(r => r.value.issueKey === 'TEST-1')!.value;
    expect(rec.effort.estimatedStartDate).toBe(week.startDate);
    expect(read('src/index.ts')).not.toMatch(/export const DEFAULT_WEEKS/);
  });
});
