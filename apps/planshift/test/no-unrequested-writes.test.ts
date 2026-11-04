/*
 * Copyright (c) 2026 Asymm Systems. All rights reserved.
 *
 * @author Fahim Farook
 */

/**
 * CascadePlan: Jira receives only values the user entered in this action (B-03, INV-03).
 */

import {
  scheduleBacklogTask,
  createInlineTask,
  updateWbsTask,
  setGlobalStorageProvider,
  getTimelineWeeks
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


const issue = (key: string, extra: any = {}) => ({
  id: key.split('-')[1], key,
  fields: { summary: key, issuetype: { name: 'Task', hierarchyLevel: 0 }, status: { statusCategory: { key: 'new' } }, ...extra }
});

function puts(): any[] {
  return mockRequestJira.mock.calls
    .filter(c => c[1]?.method === 'PUT' && /\/rest\/api\/3\/issue\/[A-Z]+-\d+$/.test(String(c[0])))
    .map(c => ({ url: String(c[0]), fields: JSON.parse(c[1].body).fields }));
}

describe('no unrequested Jira writes (B-03)', () => {
  let storage: MemStorage;
  const weeks = getTimelineWeeks().weeks;

  beforeEach(() => {
    storage = new MemStorage();
    setGlobalStorageProvider(storage);
    mockRequestJira.mockReset();
    mockRequestJira.mockImplementation(async (routeStr: any, options?: any) => {
      const url = String(routeStr);
      const m = url.match(/\/rest\/api\/3\/issue\/([A-Z0-9_]+)-(\d+)\?fields=project/);
      if (m && !options?.method) return { status: 200, json: async () => ({ fields: { project: { key: m[1] } } }) };
      if (url.includes('/search/jql')) return { status: 200, json: async () => ({ issues: [issue('TEST-1'), issue('TEST-2', { timeoriginalestimate: 36000 })] }) };
      if (url.includes('/user/assignable')) return { status: 200, json: async () => [] };
      if (url.endsWith('/rest/api/3/issue') && options?.method === 'POST') return { status: 201, json: async () => ({ id: '9', key: 'TEST-9' }) };
      return { status: 204, json: async () => ({}) };
    });
  });

  it('scheduling an unestimated issue writes no estimate and no assignee, and stores neither', async () => {
    await scheduleBacklogTask({ projectKey: 'TEST', taskId: 'TEST-1', startWeek: weeks[5].weekKey, spanWeeks: 2 });
    const [put] = puts();
    expect(put.fields.timetracking).toBeUndefined();
    expect(put.fields.assignee).toBeUndefined();
    expect(put.fields.duedate).toBe(weeks[6].endDate);
    const stored = (await entryOf(storage, 'TEST-1'));
    expect(stored.effortHours).toBeUndefined();
    expect(stored.resource).toBeUndefined();
  });

  it('scheduling writes an estimate only when the user entered one', async () => {
    await scheduleBacklogTask({ projectKey: 'TEST', taskId: 'TEST-1', startWeek: weeks[5].weekKey, effortHours: 12 });
    expect(puts()[0].fields.timetracking).toEqual({ originalEstimate: '12h' });
  });

  it('creating a task without an estimate sends no estimate', async () => {
    const res = await createInlineTask({ projectKey: 'TEST', summary: 'New work', startWeek: weeks[5].weekKey });
    expect(res.success).toBe(true);
    const post = mockRequestJira.mock.calls.find(c => c[1]?.method === 'POST' && String(c[0]).endsWith('/rest/api/3/issue'));
    expect(JSON.parse(post[1].body).fields.timetracking).toBeUndefined();
    for (const p of puts()) expect(p.fields.timetracking).toBeUndefined();
    expect((await entryOf(storage, 'TEST-9')).effortHours).toBeUndefined();
  });

  it('dates picked in the modal reach Jira unchanged', async () => {
    await storage.set('scheduleMap:TEST', { 'TEST-1': { startWeek: weeks[5].weekKey, spanWeeks: 1, startDate: weeks[5].startDate, endDate: weeks[5].endDate } });
    const start = new Date(`${weeks[6].startDate}T00:00:00Z`); start.setUTCDate(start.getUTCDate() + 1);
    const end = new Date(start); end.setUTCDate(end.getUTCDate() + 8);
    const s = start.toISOString().slice(0, 10); const e = end.toISOString().slice(0, 10);
    await updateWbsTask({ projectKey: 'TEST', taskId: 'TEST-1', updates: { startDate: s, endDate: e, startWeek: weeks[6].weekKey } });
    const stored = (await entryOf(storage, 'TEST-1'));
    expect(stored.startDate).toBe(s);
    expect(stored.endDate).toBe(e);
    expect(stored.startWeek).toBe(weeks[6].weekKey);
    expect(puts().find(p => p.url.endsWith('TEST-1')).fields.duedate).toBe(e);
  });

  it('a drag by whole weeks keeps the exact days of the bar', async () => {
    const s0 = new Date(`${weeks[5].startDate}T00:00:00Z`); s0.setUTCDate(s0.getUTCDate() + 2);
    const e0 = new Date(s0); e0.setUTCDate(e0.getUTCDate() + 4);
    const iso = (d: Date) => d.toISOString().slice(0, 10);
    await storage.set('scheduleMap:TEST', { 'TEST-1': { startWeek: weeks[5].weekKey, spanWeeks: 1, startDate: iso(s0), endDate: iso(e0) } });
    await updateWbsTask({ projectKey: 'TEST', taskId: 'TEST-1', updates: { startWeek: weeks[6].weekKey } });
    const stored = (await entryOf(storage, 'TEST-1'));
    const plus7 = (d: Date) => { const x = new Date(d); x.setUTCDate(x.getUTCDate() + 7); return iso(x); };
    expect(stored.startDate).toBe(plus7(s0));
    expect(stored.endDate).toBe(plus7(e0));
    expect(puts().find(p => p.url.endsWith('TEST-1')).fields).toEqual({ duedate: plus7(e0) });
  });

  it('a resize changes the end date by whole weeks and writes no estimate', async () => {
    const iso = (d: Date) => d.toISOString().slice(0, 10);
    const s0 = new Date(`${weeks[5].startDate}T00:00:00Z`); s0.setUTCDate(s0.getUTCDate() + 1);
    const e0 = new Date(s0); e0.setUTCDate(e0.getUTCDate() + 3);
    await storage.set('scheduleMap:TEST', { 'TEST-2': { startWeek: weeks[5].weekKey, spanWeeks: 1, startDate: iso(s0), endDate: iso(e0) } });
    await updateWbsTask({ projectKey: 'TEST', taskId: 'TEST-2', updates: { startWeek: weeks[5].weekKey, spanWeeks: 2 } });
    const stored = (await entryOf(storage, 'TEST-2'));
    const e1 = new Date(e0); e1.setUTCDate(e1.getUTCDate() + 7);
    expect(stored.startDate).toBe(iso(s0));
    expect(stored.endDate).toBe(iso(e1));
    const put = puts().find(p => p.url.endsWith('TEST-2'));
    expect(put.fields.timetracking).toBeUndefined();
  });
});
