/*
 * Copyright (c) 2026 Asymm Systems. All rights reserved.
 *
 * @author Fahim Farook
 */

/**
 * F-06, INV-03: scheduling from the backlog writes no default due date. The bar ends on the issue's
 * Jira due date when it has one; a due date is written only for an end the user chose.
 */
import { scheduleBacklogTask, getProjectPlan, setGlobalStorageProvider, getTimelineWeeks } from '../src/index';
import { MemStorage } from './helpers/mem-storage';

const mockRequestJira = jest.fn();
jest.mock('@forge/api', () => ({
  __esModule: true,
  default: { asApp: () => ({ requestJira: mockRequestJira }), asUser: () => ({ requestJira: mockRequestJira }) },
  route: (strings: any, ...values: any[]) => strings.reduce((acc: string, str: string, i: number) => acc + str + (values[i] !== undefined ? values[i] : ''), '')
}));
jest.mock('@forge/kvs', () => ({ kvs: { get: jest.fn(), set: jest.fn(), delete: jest.fn() } }));

const weeks = getTimelineWeeks().weeks;
const add = (iso: string, d: number) => new Date(Date.parse(`${iso}T00:00:00Z`) + d * 86400000).toISOString().slice(0, 10);
const start = weeks[5].startDate;
let jiraDue: Record<string, string | null> = {};
let storage: MemStorage;

const issue = (n: number) => ({ id: String(n), key: `TEST-${n}`,
  fields: { summary: `T${n}`, issuetype: { name: 'Task', hierarchyLevel: 0 }, status: { statusCategory: { key: 'new' } }, duedate: jiraDue[`TEST-${n}`] || null } });
const allPuts = () => mockRequestJira.mock.calls.filter(([, o]) => o?.method === 'PUT').map(([u, o]) => ({ url: String(u), body: JSON.parse(o.body) }));
// Field writes (the due date); the shared start property is checked separately (ADR-008).
const puts = () => allPuts().filter(p => !p.url.includes('/properties/'));
const propertyPuts = () => allPuts().filter(p => p.url.includes('/properties/'));

beforeEach(() => {
  storage = new MemStorage();
  setGlobalStorageProvider(storage);
  jiraDue = {};
  mockRequestJira.mockReset();
  mockRequestJira.mockImplementation(async (r: any, opts?: any) => {
    const url = String(r);
    if (opts?.method === 'PUT') return { status: 204, json: async () => ({}) };
    const one = url.match(/^\/rest\/api\/3\/issue\/(TEST-(\d+))\?fields=(project|duedate)$/);
    if (one) return { status: 200, json: async () => ({ id: one[2], key: one[1], fields: { project: { key: 'TEST' }, duedate: jiraDue[one[1]] || null } }) };
    if (url.includes('/search/jql')) return { status: 200, json: async () => ({ issues: url.includes('Epic') ? [] : [1, 2].map(issue), isLast: true }) };
    return { status: 200, json: async () => ({}) };
  });
});

describe('F-06: scheduling from the backlog writes no default due date', () => {
  it('an issue with a Jira due date on or after the drop day ends on that due date, and no due date is written', async () => {
    jiraDue['TEST-1'] = add(start, 4);
    const res: any = await scheduleBacklogTask({ projectKey: 'TEST', taskId: 'TEST-1', startWeek: weeks[5].weekKey, startDate: start, spanWeeks: 3 }, storage);
    expect(res.ok).toBe(true);
    expect(puts()).toEqual([]);
    // Only the shared start is written, with the planner's end (ADR-008).
    expect(propertyPuts()).toEqual([{ url: '/rest/api/3/issue/TEST-1/properties/cascadeplan.dates', body: { startDate: start, endDate: add(start, 4), v: 1 } }]);
    const bar = (await getProjectPlan('TEST', storage)).tasks.find(t => t.key === 'TEST-1')!;
    expect(bar).toMatchObject({ startDate: start, endDate: add(start, 4) });
  });

  it('an issue due before the drop day is refused with a plain message, and nothing is stored or written', async () => {
    jiraDue['TEST-2'] = add(start, -3);
    await expect(scheduleBacklogTask({ projectKey: 'TEST', taskId: 'TEST-2', startWeek: weeks[5].weekKey, startDate: start }, storage))
      .rejects.toThrow(`TEST-2 is due on ${add(start, -3)} in Jira, before ${start}`);
    expect(allPuts()).toEqual([]);
    expect((await getProjectPlan('TEST', storage)).tasks.find(t => t.key === 'TEST-2')).toBeUndefined();
  });

  it('an end the user chose is the only due date written', async () => {
    await scheduleBacklogTask({ projectKey: 'TEST', taskId: 'TEST-1', startWeek: weeks[5].weekKey, startDate: start, endDate: add(start, 9) }, storage);
    expect(puts()).toEqual([{ url: '/rest/api/3/issue/TEST-1', body: { fields: { duedate: add(start, 9) } } }]);
    expect(propertyPuts()).toEqual([{ url: '/rest/api/3/issue/TEST-1/properties/cascadeplan.dates', body: { startDate: start, endDate: add(start, 9), v: 1 } }]);
  });
});
