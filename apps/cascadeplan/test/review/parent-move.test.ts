/*
 * Copyright (c) 2026 Asymm Systems. All rights reserved.
 *
 * @author Fahim Farook
 */

/**
 * Review of parent and sub-task moves (2026-11-05). NOT part of the product.
 * A "GAP" test passes while the code at db08009 has the behaviour. When the code is fixed, the test
 * fails and must be rewritten as a regression test.
 */

import { getProjectPlan, updateWbsTask, setGlobalStorageProvider, setSleepForTests, getTimelineWeeks } from '../../src/index';
import { PlanStore } from '../../src/storage/plan-store';
import { MemStorage } from '../helpers/mem-storage';

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
const status = { statusCategory: { key: 'new' } };
const task = { name: 'Task', hierarchyLevel: 0 };
const subtask = { name: 'Subtask', hierarchyLevel: -1, subtask: true };

let jiraDue: Record<string, string> = {};
let storage: MemStorage;
let issues: any[] = [];

function jiraIssue(n: number, type: any, parent?: number) {
  return () => ({ id: String(n), key: `TEST-${n}`, fields: {
    summary: `T${n}`, issuetype: type, status, duedate: jiraDue[`TEST-${n}`] || null,
    ...(parent ? { parent: { id: String(parent), key: `TEST-${parent}`, fields: { summary: `T${parent}`, issuetype: task } } } : {})
  } });
}

function putsTo(key: string): string[] {
  return mockRequestJira.mock.calls
    .filter(([url, opts]) => opts?.method === 'PUT' && String(url) === `/rest/api/3/issue/${key}`)
    .map(([, opts]) => opts.body);
}

beforeEach(() => {
  storage = new MemStorage();
  setGlobalStorageProvider(storage);
  setSleepForTests(async () => undefined);
  jiraDue = {};
  mockRequestJira.mockReset();
  mockRequestJira.mockImplementation(async (routeStr: any, opts?: any) => {
    const url = String(routeStr);
    const put = opts?.method === 'PUT' ? url.match(/^\/rest\/api\/3\/issue\/(TEST-\d+)$/) : null;
    if (put) {
      const fields = JSON.parse(opts.body).fields || {};
      if (fields.duedate) jiraDue[put[1]] = fields.duedate;
      return { status: 204, json: async () => ({}) };
    }
    if (/\/rest\/api\/3\/issue\/TEST-\d+\?fields=project/.test(url)) {
      return { status: 200, json: async () => ({ id: url.match(/TEST-(\d+)/)![1], fields: { project: { key: 'TEST' } } }) };
    }
    if (url.includes('/search/jql')) return { status: 200, json: async () => ({ issues: url.includes('Epic') ? [] : issues.map(f => f()), isLast: true }) };
    return { status: 204, json: async () => ({}) };
  });
});

const dep = (k: string) => ({ predecessorKey: k, predecessorId: k, triggerPercent: 100, isTriggerSatisfied: false });

async function seed(map: Record<string, any>, due: Record<string, string>): Promise<void> {
  await storage.set('scheduleMap:TEST', map);
  await getProjectPlan('TEST', storage);
  jiraDue = due;
  mockRequestJira.mockClear();
}

async function entry(key: string): Promise<any> {
  return (await new PlanStore(storage, 'TEST', 'TEST').loadEntries()).get(key);
}

describe('Parent and sub-task moves at db08009', () => {
  it('OK PM-00: a parent with a dated sub-task shows the dates of its sub-tasks (roll-up), not its own', async () => {
    issues = [jiraIssue(1, task), jiraIssue(2, subtask, 1)];
    const w = weeks[5].weekKey;
    await seed({
      'TEST-1': { startWeek: w, spanWeeks: 1, startDate: start, endDate: add(start, 1) },
      'TEST-2': { startWeek: w, spanWeeks: 1, startDate: add(start, 2), endDate: add(start, 6) }
    }, { 'TEST-2': add(start, 6) });
    const p = (await getProjectPlan('TEST', storage)).tasks.find(t => t.key === 'TEST-1')!;
    expect(p).toMatchObject({ startDate: add(start, 2), endDate: add(start, 6), datesFromChildren: true });
  });

  it('GAP PM-01: moving a sub-task past the start of the parent\'s successor does not cascade that successor', async () => {
    // TEST-1 parent, TEST-2 its sub-task, TEST-3 depends on TEST-1 (finish to start).
    issues = [jiraIssue(1, task), jiraIssue(2, subtask, 1), jiraIssue(3, task)];
    const w = weeks[5].weekKey;
    await seed({
      'TEST-1': { startWeek: w, spanWeeks: 1, startDate: start, endDate: add(start, 2) },
      'TEST-2': { startWeek: w, spanWeeks: 1, startDate: start, endDate: add(start, 2) },
      'TEST-3': { startWeek: w, spanWeeks: 1, startDate: add(start, 3), endDate: add(start, 5), dependency: dep('TEST-1') }
    }, { 'TEST-2': add(start, 2), 'TEST-3': add(start, 5) });
    const sub = await entry('TEST-2');
    // The user moves the sub-task 7 days later. The parent's roll-up now ends on start+9.
    await updateWbsTask({ projectKey: 'TEST', taskId: 'TEST-2', updates: { startDate: add(start, 7), endDate: add(start, 9) }, expectedVersion: sub.version }, storage);

    const plan = await getProjectPlan('TEST', storage);
    expect(plan.tasks.find(t => t.key === 'TEST-1')!.endDate).toBe(add(start, 9));
    const succ = plan.tasks.find(t => t.key === 'TEST-3')!;
    expect(succ.startDate).toBe(add(start, 3));          // not moved
    expect(succ.dependency!.isViolated).toBe(true);       // and now in violation
    expect(putsTo('TEST-3')).toHaveLength(0);             // no Jira write for the successor
  });

  it('GAP PM-02: a cascade into a parent writes the parent\'s record and Jira due date, but moves none of its sub-tasks, so the parent stays in violation', async () => {
    // TEST-1 predecessor, TEST-4 parent that depends on TEST-1, TEST-5 sub-task of TEST-4.
    issues = [jiraIssue(1, task), jiraIssue(4, task), jiraIssue(5, subtask, 4)];
    const w = weeks[5].weekKey;
    await seed({
      'TEST-1': { startWeek: w, spanWeeks: 1, startDate: start, endDate: add(start, 2) },
      'TEST-4': { startWeek: w, spanWeeks: 1, startDate: add(start, 3), endDate: add(start, 5), dependency: dep('TEST-1') },
      'TEST-5': { startWeek: w, spanWeeks: 1, startDate: add(start, 3), endDate: add(start, 5) }
    }, { 'TEST-1': add(start, 2), 'TEST-5': add(start, 5) });
    const a = await entry('TEST-1');
    await updateWbsTask({ projectKey: 'TEST', taskId: 'TEST-1', updates: { startDate: add(start, 7), endDate: add(start, 9) }, expectedVersion: a.version }, storage);

    expect(putsTo('TEST-4').length).toBeGreaterThan(0);    // the parent's own Jira due date is written
    expect(putsTo('TEST-5')).toHaveLength(0);               // the sub-task is not moved
    const plan = await getProjectPlan('TEST', storage);
    const parent = plan.tasks.find(t => t.key === 'TEST-4')!;
    expect(parent.startDate).toBe(add(start, 3));           // the bar shows the sub-task dates, unchanged
    expect(parent.dependency!.isViolated).toBe(true);
    expect(jiraDue['TEST-4']).not.toBe(parent.endDate);     // Jira due date of the parent disagrees with its bar
  });

  it('GAP PM-04: a parent with no schedule entry of its own stays in the backlog, although its sub-task is on the timeline', async () => {
    issues = [jiraIssue(1, task), jiraIssue(2, subtask, 1)];
    const w = weeks[5].weekKey;
    await seed({ 'TEST-2': { startWeek: w, spanWeeks: 1, startDate: start, endDate: add(start, 2) } }, { 'TEST-2': add(start, 2) });
    const plan = await getProjectPlan('TEST', storage);
    expect(plan.tasks.find(t => t.key === 'TEST-2')).toBeDefined();
    expect(plan.tasks.find(t => t.key === 'TEST-1')).toBeUndefined();
    expect((plan.backlogTasks || []).find(t => t.key === 'TEST-1')).toBeDefined();
  });

  it('GAP PM-03: the server accepts a direct move of a roll-up parent; only its Jira due date changes, its bar does not', async () => {
    issues = [jiraIssue(1, task), jiraIssue(2, subtask, 1)];
    const w = weeks[5].weekKey;
    await seed({
      'TEST-1': { startWeek: w, spanWeeks: 1, startDate: start, endDate: add(start, 2) },
      'TEST-2': { startWeek: w, spanWeeks: 1, startDate: start, endDate: add(start, 2) }
    }, { 'TEST-1': add(start, 2), 'TEST-2': add(start, 2) });
    const p = await entry('TEST-1');
    const res: any = await updateWbsTask({ projectKey: 'TEST', taskId: 'TEST-1', updates: { startDate: add(start, 7), endDate: add(start, 9) }, expectedVersion: p.version }, storage);
    expect(res.ok).toBe(true);
    expect(jiraDue['TEST-1']).toBe(add(start, 9));          // parent due date moved in Jira
    expect(putsTo('TEST-2')).toHaveLength(0);               // sub-task not moved
    const plan = await getProjectPlan('TEST', storage);
    expect(plan.tasks.find(t => t.key === 'TEST-1')!.startDate).toBe(start); // bar unchanged (roll-up)
  });
});
