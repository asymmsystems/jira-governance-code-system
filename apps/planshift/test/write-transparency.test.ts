/*
 * Copyright (c) 2026 Asymm Systems. All rights reserved.
 *
 * @author Fahim Farook
 */

/**
 * CascadePlan: every Jira write is reported with its old and new value and its true result, and a
 * change to a child writes nothing to the parent issue in Jira (B-23, INV-03, INV-11).
 */

import { updateWbsTask, setGlobalStorageProvider, getTimelineWeeks, setSleepForTests } from '../src/index';
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

const weeks = getTimelineWeeks().weeks;
const status = { statusCategory: { key: 'new' } };
const type = (name: string, hierarchyLevel: number) => ({ name, hierarchyLevel, subtask: hierarchyLevel === -1 });
const ISSUES = [
  { id: '1', key: 'TEST-1', fields: { summary: 'Story', issuetype: type('Story', 0), status, duedate: weeks[5].endDate } },
  { id: '2', key: 'TEST-2', fields: { summary: 'Sub', issuetype: type('Sub-task', -1), status, parent: { id: '1', key: 'TEST-1', fields: { summary: 'Story', issuetype: type('Story', 0) } } } }
];

describe('write transparency (B-23)', () => {
  let storage: MemStorage;
  let rejectDueDate: boolean;
  let puts: Array<{ url: string; body: any }>;

  beforeEach(async () => {
    storage = new MemStorage();
    setGlobalStorageProvider(storage);
    setSleepForTests(async () => undefined);
    rejectDueDate = false;
    puts = [];
    mockRequestJira.mockReset();
    mockRequestJira.mockImplementation(async (routeStr: any, options?: any) => {
      const url = String(routeStr);
      const method = options?.method || 'GET';
      const lookup = url.match(/\/rest\/api\/3\/issue\/([A-Z0-9_]+)-(\d+)\?fields=project/);
      if (lookup) return { status: 200, json: async () => ({ fields: { project: { key: lookup[1] } } }) };
      if (url.includes('/search/jql')) return { status: 200, json: async () => ({ issues: url.includes('Epic') ? [] : ISSUES, isLast: true }) };
      if (method === 'PUT') {
        const body = JSON.parse(options.body);
        puts.push({ url, body });
        if (rejectDueDate && body.fields && body.fields.duedate) {
          return { status: 400, json: async () => ({ errorMessages: [], errors: { duedate: 'Field duedate cannot be set. It is not on the appropriate screen.' } }) };
        }
      }
      return { status: 204, json: async () => ({}) };
    });
    await storage.set('scheduleMap:TEST', {
      'TEST-1': { startWeek: weeks[4].weekKey, spanWeeks: 2, startDate: weeks[4].startDate, endDate: weeks[5].endDate },
      'TEST-2': { startWeek: weeks[4].weekKey, spanWeeks: 1, startDate: weeks[4].startDate, endDate: weeks[4].endDate }
    });
  });

  it('a write reports each field with its old and new value', async () => {
    const res: any = await updateWbsTask({ projectKey: 'TEST', taskId: 'TEST-1', updates: { summary: 'Renamed', endDate: weeks[6].endDate } });
    expect(res.jiraSync.writes).toEqual([{ key: 'TEST-1', fields: ['summary', 'duedate'], ok: true, changes: [
      { field: 'summary', from: 'Story', to: 'Renamed' },
      { field: 'due date', from: weeks[5].endDate, to: weeks[6].endDate }
    ] }]);
  });

  it('a due date the issue screen rejects is reported as not written, while the rest is written', async () => {
    rejectDueDate = true;
    const res: any = await updateWbsTask({ projectKey: 'TEST', taskId: 'TEST-1', updates: { summary: 'Renamed', endDate: weeks[6].endDate } });
    expect(res.jiraSync.ok).toBe(false);
    expect(res.jiraSync.writes).toEqual([
      { key: 'TEST-1', fields: ['summary'], ok: true, changes: [{ field: 'summary', from: 'Story', to: 'Renamed' }] },
      { key: 'TEST-1', fields: ['duedate'], ok: false, error: 'Jira did not accept the due date on this issue screen',
        changes: [{ field: 'due date', from: weeks[5].endDate, to: weeks[6].endDate }] }
    ]);
    expect(puts.map(p => Object.keys(p.body.fields))).toEqual([['summary', 'duedate'], ['summary']]);
  });

  it('moving a sub-task writes nothing to its parent issue in Jira (INV-03)', async () => {
    const res: any = await updateWbsTask({ projectKey: 'TEST', taskId: 'TEST-2', updates: { startDate: weeks[6].startDate, endDate: weeks[7].endDate } });
    expect(puts.filter(p => p.url.endsWith('/issue/TEST-1'))).toEqual([]);
    expect(res.jiraSync.writes.map((w: any) => w.key)).toEqual(['TEST-2']);
  });
});
