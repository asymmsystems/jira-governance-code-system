/*
 * Copyright (c) 2026 Asymm Systems. All rights reserved.
 *
 * @author Fahim Farook
 */

/**
 * Merge review H2 (INV-03): the drop preview lists every Jira write the drop makes. For each case the
 * preview is computed from the plan the planner holds (getProjectPlan) and its text list is compared
 * with the writes the server reports after the same drop (updateWbsTask or moveTaskGroup).
 */

import { getProjectPlan, updateWbsTask, moveTaskGroup, setGlobalStorageProvider, setSleepForTests, getTimelineWeeks, todayIso } from '../../src/index';
import { previewSingleMove, previewBlockMove, DropPreview } from '../../src/domain/drop-plan';
import { describePendingWrites } from '../../src/ui/change-log';
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
      return { status: 200, json: async () => ({ id: url.match(/TEST-(\d+)/)![1], fields: { project: { key: 'TEST', id: 'TEST' } } }) };
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

/** The preview's list: "<key> due <date>" for Jira due dates, "<key> <date>" for start dates. */
function previewList(plan: any, p: DropPreview): string[] {
  const d = describePendingWrites([...plan.tasks, ...(plan.backlogTasks || [])], p.moves, '', { parentDue: p.parentDue, epics: p.epics });
  return [...d.jira, ...d.starts].sort();
}

/** The same list from the writes the server reports. */
function serverList(res: any): string[] {
  const out: string[] = [];
  for (const w of res.jiraSync.writes) {
    if (!w.ok) continue;
    for (const c of w.changes || []) {
      if (c.field === 'due date' && c.from !== c.to) out.push(`${w.key} due ${c.to}`);
      if (c.field === 'start date' && c.from !== c.to) out.push(`${w.key} ${c.to}`);
    }
  }
  return [...new Set(out)].sort();
}

const version = async (key: string) => (await new PlanStore(storage, 'TEST', 'TEST').loadEntries()).get(key)?.version || 0;

async function singleMove(key: string, s: string, e: string): Promise<{ preview: string[]; server: string[] }> {
  const plan = await getProjectPlan('TEST', storage);
  const preview = previewList(plan, previewSingleMove(plan as any, key, s, e, todayIso()));
  const res = await updateWbsTask({ projectKey: 'TEST', taskId: key, updates: { startDate: s, endDate: e }, expectedVersion: await version(key) }, storage);
  return { preview, server: serverList(res) };
}

describe('H2: the drop preview lists exactly the Jira writes of the drop', () => {
  it('PM-01 shape: a sub-task move lists its parent\'s successor and the parent due date (DEC-6)', async () => {
    issues = [jiraIssue(1, task), jiraIssue(2, subtask, 1), jiraIssue(3, task)];
    const w = weeks[5].weekKey;
    await seed({
      'TEST-1': { startWeek: w, spanWeeks: 1, startDate: start, endDate: add(start, 2) },
      'TEST-2': { startWeek: w, spanWeeks: 1, startDate: start, endDate: add(start, 2) },
      'TEST-3': { startWeek: w, spanWeeks: 1, startDate: add(start, 3), endDate: add(start, 5), dependency: dep('TEST-1') }
    }, { 'TEST-1': add(start, 2), 'TEST-2': add(start, 2), 'TEST-3': add(start, 5) });
    const r = await singleMove('TEST-2', add(start, 7), add(start, 9));
    expect(r.preview).toEqual(expect.arrayContaining([`TEST-3 due ${add(start, 12)}`, `TEST-1 due ${add(start, 9)}`, `TEST-2 due ${add(start, 9)}`]));
    expect(r.preview).toEqual(r.server);
  });

  it('PM-02 shape: a cascade into a parent lists the parent\'s sub-task and the parent due date', async () => {
    issues = [jiraIssue(1, task), jiraIssue(4, task), jiraIssue(5, subtask, 4)];
    const w = weeks[5].weekKey;
    await seed({
      'TEST-1': { startWeek: w, spanWeeks: 1, startDate: start, endDate: add(start, 2) },
      'TEST-4': { startWeek: w, spanWeeks: 1, startDate: add(start, 3), endDate: add(start, 5), dependency: dep('TEST-1') },
      'TEST-5': { startWeek: w, spanWeeks: 1, startDate: add(start, 3), endDate: add(start, 5) }
    }, { 'TEST-1': add(start, 2), 'TEST-4': add(start, 5), 'TEST-5': add(start, 5) });
    const r = await singleMove('TEST-1', add(start, 7), add(start, 9));
    expect(r.preview).toEqual(expect.arrayContaining([`TEST-5 due ${add(start, 12)}`, `TEST-4 due ${add(start, 12)}`]));
    expect(r.preview).toEqual(r.server);
  });

  it('a plain cascade, and a move with no successor', async () => {
    issues = [jiraIssue(1, task), jiraIssue(2, task), jiraIssue(3, task)];
    const w = weeks[5].weekKey;
    await seed({
      'TEST-1': { startWeek: w, spanWeeks: 1, startDate: start, endDate: add(start, 2) },
      'TEST-2': { startWeek: w, spanWeeks: 1, startDate: add(start, 3), endDate: add(start, 5), dependency: dep('TEST-1') },
      'TEST-3': { startWeek: w, spanWeeks: 1, startDate: add(start, 6), endDate: add(start, 8), dependency: dep('TEST-2') }
    }, { 'TEST-1': add(start, 2), 'TEST-2': add(start, 5), 'TEST-3': add(start, 8) });
    const chain = await singleMove('TEST-1', add(start, 4), add(start, 6));
    expect(chain.preview.length).toBe(6);
    expect(chain.preview).toEqual(chain.server);
    const alone = await singleMove('TEST-3', add(start, 20), add(start, 22));
    expect(alone.preview).toEqual(alone.server);
  });

  it('a left resize of an issue with no Jira due date lists the due date the server writes', async () => {
    issues = [jiraIssue(1, task)];
    const w = weeks[5].weekKey;
    await seed({ 'TEST-1': { startWeek: w, spanWeeks: 1, startDate: start, endDate: add(start, 4) } }, {});
    const r = await singleMove('TEST-1', add(start, 1), add(start, 4));
    expect(r.preview).toEqual([`TEST-1 ${add(start, 1)}`, `TEST-1 due ${add(start, 4)}`]);
    expect(r.preview).toEqual(r.server);
  });

  it('a block move lists each sub-task, the successor outside the block and the parent due date', async () => {
    issues = [jiraIssue(1, task), jiraIssue(2, subtask, 1), jiraIssue(3, subtask, 1), jiraIssue(4, task)];
    const w = weeks[5].weekKey;
    await seed({
      'TEST-2': { startWeek: w, spanWeeks: 1, startDate: start, endDate: add(start, 2) },
      'TEST-3': { startWeek: w, spanWeeks: 1, startDate: add(start, 1), endDate: add(start, 4) },
      'TEST-4': { startWeek: w, spanWeeks: 1, startDate: add(start, 5), endDate: add(start, 7), dependency: dep('TEST-1') }
    }, { 'TEST-1': add(start, 4), 'TEST-2': add(start, 2), 'TEST-3': add(start, 4), 'TEST-4': add(start, 7) });
    const plan = await getProjectPlan('TEST', storage);
    const preview = previewList(plan, previewBlockMove(plan as any, 'TEST-1', 7, todayIso()));
    const res = await moveTaskGroup({ projectKey: 'TEST', taskId: 'TEST-1', days: 7 }, storage);
    expect(preview).toEqual(expect.arrayContaining([`TEST-1 due ${add(start, 11)}`, `TEST-4 due ${add(start, 14)}`]));
    expect(preview).toEqual(serverList(res));
  });

  it('an unknown task and a block with nothing to move list nothing', async () => {
    issues = [jiraIssue(1, task)];
    await seed({ 'TEST-1': { startWeek: weeks[5].weekKey, spanWeeks: 1, startDate: start, endDate: add(start, 2) } }, {});
    const plan = await getProjectPlan('TEST', storage);
    expect(previewSingleMove(plan as any, 'NOPE-1', start, start, todayIso()).moves.size).toBe(0);
    expect(previewBlockMove(plan as any, 'TEST-1', 7, todayIso()).moves.size).toBe(0);
  });
});
