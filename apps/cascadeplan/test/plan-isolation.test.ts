/*
 * Copyright (c) 2026 Asymm Systems. All rights reserved.
 *
 * @author Fahim Farook
 */

/**
 * CascadePlan: named plans (UX-05). Every resolver reads and writes the plan named by planId, and a
 * write to a deleted plan is refused. Jira is the single truth for a task: every field edit, the due
 * date included, goes to Jira from whichever plan it was made in; a task's dates are the same in every
 * plan; and a due date changed directly in Jira shows in every plan. Order, column settings,
 * milestones and dependency settings stay per plan.
 */

import {
  getProjectPlan,
  updateWbsTask,
  batchUpdateTasks,
  scheduleBacklogTask,
  unscheduleTask,
  reorderWbsTasks,
  continueCascade,
  previewCascade,
  saveColumnWidths,
  saveHiddenColumns,
  saveProjectMilestone,
  saveTaskDependency,
  pruneStaleEntries,
  createProjectPlan,
  deleteProjectPlan,
  mapLiveIssues,
  isMainPlan,
  shareTaskDates,
  DEFAULT_COLUMN_WIDTHS,
  setGlobalStorageProvider,
  setSleepForTests,
  getTimelineWeeks
} from '../src/index';
import { PlanStore } from '../src/storage/plan-store';
import { ValidationError } from '../src/validation';
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
const add = (iso: string, d: number) => new Date(Date.parse(`${iso}T00:00:00Z`) + d * 86400000).toISOString().slice(0, 10);

/** Due dates the fake Jira holds, by issue key: a PUT with a due date changes it, a search returns it. */
let jiraDue: Record<string, string> = {};
const issue = (n: number) => ({ id: String(n), key: `TEST-${n}`,
  fields: { summary: `T${n}`, issuetype: { name: 'Task', hierarchyLevel: 0 }, status, duedate: jiraDue[`TEST-${n}`] || null } });

/** Issue-field writes to Jira (PUT/POST on an issue); searches and counts are reads. */
function jiraIssueWrites(): string[] {
  return mockRequestJira.mock.calls
    .filter(([url, opts]) => opts && ['PUT', 'POST', 'DELETE'].includes(opts.method) && /\/rest\/api\/3\/issue\//.test(String(url)))
    .map(([url, opts]) => `${opts.method} ${String(url)}`);
}

/** The issue fields of the last PUT on one issue, or undefined when nothing was written. */
function jiraFieldsSent(key: string): Record<string, unknown> | undefined {
  const puts = mockRequestJira.mock.calls.filter(([url, opts]) => opts?.method === 'PUT' && String(url) === `/rest/api/3/issue/${key}`);
  return puts.length ? JSON.parse(puts[puts.length - 1][1].body).fields : undefined;
}

/** Every Main Plan key and value, to prove a write left the Main Plan untouched. */
function mainPlanSnapshot(storage: MemStorage): string {
  const rows = [...storage.store.entries()]
    .filter(([k]) => k.startsWith('cp:TEST:') && !k.startsWith('cp:TEST:plan:') && k !== 'cp:TEST:plans')
    .sort(([a], [b]) => (a < b ? -1 : 1));
  return JSON.stringify(rows);
}

async function planEntry(storage: MemStorage, planId: string, key: string): Promise<any> {
  return (await new PlanStore(storage, 'TEST', 'TEST', planId).loadEntries()).get(key);
}

async function planTask(storage: MemStorage, planId: string | undefined, key: string): Promise<any> {
  const plan = await getProjectPlan('TEST', storage, new Date(), undefined, undefined, undefined, planId);
  return [...plan.tasks, ...(plan.backlogTasks || [])].find(t => t.key === key);
}

describe('named plans: one truth for each task (UX-05)', () => {
  let storage: MemStorage;
  let planB: string;
  const start = weeks[5].startDate;

  beforeEach(async () => {
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
      if (url.includes('/search/jql')) return { status: 200, json: async () => ({ issues: url.includes('Epic') ? [] : [1, 2, 3, 4, 5, 6, 8].map(issue), isLast: true }) };
      return { status: 204, json: async () => ({}) };
    });
    const w = weeks[5];
    const map: any = {};
    for (let n = 1; n <= 5; n++) map[`TEST-${n}`] = { startWeek: w.weekKey, spanWeeks: 1, startDate: w.startDate, endDate: add(w.startDate, 2) };
    // TEST-6 waits for TEST-5 to finish and starts the day after it. TEST-8 stays in the backlog.
    map['TEST-6'] = { startWeek: w.weekKey, spanWeeks: 1, startDate: add(w.startDate, 3), endDate: add(w.startDate, 4),
      dependency: { predecessorKey: 'TEST-5', predecessorId: 'TEST-5', triggerPercent: 100, isTriggerSatisfied: false } };
    await storage.set('scheduleMap:TEST', map);
    await getProjectPlan('TEST', storage);
    const created = await createProjectPlan({ projectKey: 'TEST', name: 'Plan B', cloneFromPlanId: 'default' }, storage);
    planB = created.plan.id;
    mockRequestJira.mockClear();
  });

  it('isMainPlan: absent and default are the Main Plan, any other id is a scenario', () => {
    expect(isMainPlan(undefined)).toBe(true);
    expect(isMainPlan('default')).toBe(true);
    expect(isMainPlan('plan-x')).toBe(false);
  });

  it('a version is present on every task, 0 when nothing is stored', () => {
    const live = mapLiveIssues({ isLive: true, issues: [issue(1), issue(2)] }, { 'TEST-1': { startWeek: weeks[5].weekKey, version: 4 } as any });
    expect(live.tasks.find(t => t.key === 'TEST-1')!.version).toBe(4);
    expect(live.backlogTasks.find(t => t.key === 'TEST-2')!.version).toBe(0);
  });

  it('a move in a scenario plan writes the due date to Jira and the same dates to every plan, cascade included', async () => {
    const before = (await planEntry(storage, planB, 'TEST-5')).version;
    const res: any = await updateWbsTask({ projectKey: 'TEST', planId: planB, taskId: 'TEST-5', updates: { startDate: add(start, 3), endDate: add(start, 5) }, expectedVersion: before }, storage);
    expect(res.ok).toBe(true);
    expect(res.planId).toBe(planB);
    expect(res.jiraSync.ok).toBe(true);
    for (const p of [planB, 'default']) {
      expect(await planEntry(storage, p, 'TEST-5')).toMatchObject({ startDate: add(start, 3), endDate: add(start, 5) });
      // The dependent moved in every plan.
      expect(await planEntry(storage, p, 'TEST-6')).toMatchObject({ startDate: add(start, 6) });
    }
    expect(jiraFieldsSent('TEST-5')).toMatchObject({ duedate: add(start, 5) });
    expect(jiraIssueWrites()).toContain('PUT /rest/api/3/issue/TEST-6');
    expect(jiraDue['TEST-6']).toBe((await planEntry(storage, 'default', 'TEST-6')).endDate);
    expect((await planTask(storage, undefined, 'TEST-5')).endDate).toBe(add(start, 5));
  });

  it('the returned version lets the next move of the same task succeed (no stale-version conflict)', async () => {
    const first: any = await updateWbsTask({ projectKey: 'TEST', planId: planB, taskId: 'TEST-1', updates: { startDate: add(start, 1), endDate: add(start, 3) }, expectedVersion: (await planEntry(storage, planB, 'TEST-1')).version }, storage);
    const v = first.tasks.find((t: any) => t.key === 'TEST-1').version;
    const second: any = await updateWbsTask({ projectKey: 'TEST', planId: planB, taskId: 'TEST-1', updates: { startDate: add(start, 2), endDate: add(start, 4) }, expectedVersion: v }, storage);
    expect(second.ok).toBe(true);
    expect(second.conflict).toBeUndefined();
  });

  it('a move in the Main Plan writes the due date to Jira and reaches the scenario plan', async () => {
    const v = (await planEntry(storage, 'default', 'TEST-1')).version;
    const res: any = await updateWbsTask({ projectKey: 'TEST', taskId: 'TEST-1', updates: { startDate: add(start, 1), endDate: add(start, 3) }, expectedVersion: v }, storage);
    expect(res.ok).toBe(true);
    expect(jiraFieldsSent('TEST-1')).toMatchObject({ duedate: add(start, 3) });
    expect(await planEntry(storage, planB, 'TEST-1')).toMatchObject({ startDate: add(start, 1), endDate: add(start, 3) });
    expect((await planTask(storage, planB, 'TEST-1')).endDate).toBe(add(start, 3));
  });

  it('every field edit in a scenario plan syncs to Jira: summary, estimate, assignee, status, parent and due date', async () => {
    const base = mockRequestJira.getMockImplementation()!;
    mockRequestJira.mockImplementation(async (routeStr: any, opts?: any) => {
      if (String(routeStr).endsWith('/transitions') && !opts) {
        return { status: 200, json: async () => ({ transitions: [{ id: '31', name: 'Done', to: { statusCategory: { key: 'done' } } }] }) };
      }
      return base(routeStr, opts);
    });
    const v = (await planEntry(storage, planB, 'TEST-1')).version;
    const res: any = await updateWbsTask({ projectKey: 'TEST', planId: planB, taskId: 'TEST-1', expectedVersion: v,
      updates: { summary: 'Renamed in Plan B', effortHours: 12, resourceAccountId: 'acc-7', status: 'COMPLETED', epicKey: 'TEST-9',
        startDate: add(start, 1), endDate: add(start, 3) } }, storage);
    expect(res.ok).toBe(true);
    expect(jiraFieldsSent('TEST-1')).toEqual({
      summary: 'Renamed in Plan B',
      duedate: add(start, 3),
      timetracking: { originalEstimate: '12h' },
      parent: { key: 'TEST-9' },
      assignee: { accountId: 'acc-7' }
    });
    expect(jiraIssueWrites()).toContain('POST /rest/api/3/issue/TEST-1/transitions');
    expect(await planEntry(storage, 'default', 'TEST-1')).toMatchObject({ startDate: add(start, 1), endDate: add(start, 3) });
  });

  it('an edit without dates writes Jira only and leaves every plan record as it was', async () => {
    const main = mainPlanSnapshot(storage);
    const v = (await planEntry(storage, planB, 'TEST-2')).version;
    await updateWbsTask({ projectKey: 'TEST', planId: planB, taskId: 'TEST-2', updates: { summary: 'New name' }, expectedVersion: v }, storage);
    expect(jiraFieldsSent('TEST-2')).toEqual({ summary: 'New name' });
    expect(mainPlanSnapshot(storage)).toBe(main);
  });

  it('a due date changed directly in Jira shows in every plan; the start moves only when it would fall after the end', async () => {
    jiraDue['TEST-3'] = add(start, 10);
    jiraDue['TEST-4'] = add(start, -3);
    for (const p of [undefined, planB]) {
      const t3 = await planTask(storage, p, 'TEST-3');
      expect(t3).toMatchObject({ startDate: start, endDate: add(start, 10), startWeek: weeks[5].weekKey, spanWeeks: 2 });
      const t4 = await planTask(storage, p, 'TEST-4');
      expect(t4).toMatchObject({ startDate: add(start, -3), endDate: add(start, -3) });
    }
    // Reading writes nothing.
    expect(jiraIssueWrites()).toEqual([]);
  });

  it('a task in the backlog stays in the backlog when Jira has a due date for it', async () => {
    jiraDue['TEST-8'] = add(start, 4);
    const t8 = await planTask(storage, planB, 'TEST-8');
    expect(t8.isBacklog).toBe(true);
  });

  it('scheduleBacklogTask in a scenario plan schedules the task in every plan and syncs the estimate and the chosen end', async () => {
    const res: any = await scheduleBacklogTask({ projectKey: 'TEST', planId: planB, taskId: 'TEST-8', startWeek: weeks[6].weekKey, spanWeeks: 1, endDate: weeks[6].endDate, effortHours: 8 }, storage);
    expect(res.ok).toBe(true);
    expect(res.planId).toBe(planB);
    expect(jiraFieldsSent('TEST-8')).toEqual({ duedate: weeks[6].endDate, timetracking: { originalEstimate: '8h' } });
    for (const p of [planB, 'default']) expect((await planEntry(storage, p, 'TEST-8')).startWeek).toBe(weeks[6].weekKey);
    expect((await planTask(storage, undefined, 'TEST-8')).isBacklog).toBeFalsy();
  });

  it('batchUpdateTasks in a scenario plan moves the tasks in every plan and writes their due dates', async () => {
    const items = [1, 2].map(n => ({ taskId: `TEST-${n}`, updates: { startDate: add(start, 4), endDate: add(start, 6) } }));
    const res: any = await batchUpdateTasks({ projectKey: 'TEST', planId: planB, items }, storage);
    expect(res.ok).toBe(true);
    expect(res.planId).toBe(planB);
    for (const p of [planB, 'default']) for (const n of [1, 2]) expect(await planEntry(storage, p, `TEST-${n}`)).toMatchObject({ startDate: add(start, 4) });
    expect(jiraDue['TEST-1']).toBe(add(start, 6));
    expect(jiraDue['TEST-2']).toBe(add(start, 6));
  });

  it('unscheduleTask takes the task off the timeline in every plan; reorderWbsTasks stays in its plan', async () => {
    const unscheduled: any = await unscheduleTask({ projectKey: 'TEST', planId: planB, taskId: 'TEST-2' }, storage);
    expect(unscheduled.planId).toBe(planB);
    for (const p of [planB, 'default']) expect((await planEntry(storage, p, 'TEST-2')).startWeek).toBeUndefined();
    expect((await planTask(storage, undefined, 'TEST-2')).isBacklog).toBe(true);

    const main = mainPlanSnapshot(storage);
    const reordered: any = await reorderWbsTasks({ projectKey: 'TEST', planId: planB, taskId: 'TEST-3', targetIndex: 0 }, storage);
    expect(reordered.planId).toBe(planB);
    expect(reordered.tasks[0].key).toBe('TEST-3');
    expect(mainPlanSnapshot(storage)).toBe(main);
    expect(jiraIssueWrites()).toEqual([]);
  });

  it('continueCascade in a scenario plan moves the successors in every plan and writes their due dates', async () => {
    // Plan B: TEST-5 now ends later, so TEST-6 must move.
    const store = new PlanStore(storage, 'TEST', 'TEST', planB);
    const e5 = (await store.loadEntries()).get('TEST-5')!;
    await store.putEntry('TEST-5', '5', { ...e5, endDate: add(start, 8) }, e5.version);

    const preview = await previewCascade({ projectKey: 'TEST', planId: planB, taskId: 'TEST-5', updates: { endDate: add(start, 8) } }, storage);
    expect(preview.changes.map(c => c.key)).toContain('TEST-6');

    const res: any = await continueCascade({ projectKey: 'TEST', planId: planB, taskId: 'TEST-5' }, storage);
    expect(res.planId).toBe(planB);
    for (const p of [planB, 'default']) expect((await planEntry(storage, p, 'TEST-6')).startDate).toBe(add(start, 9));
    expect(jiraDue['TEST-6']).toBe((await planEntry(storage, planB, 'TEST-6')).endDate);
  });

  it('shareTaskDates applies the dates again when another writer saved the other record first', async () => {
    const mainKey = 'cp:TEST:we:1';
    const v0 = storage.store.get(mainKey).version;
    const realGet = storage.get.bind(storage);
    let raced = false;
    storage.get = async <T>(key: string): Promise<T | undefined> => {
      if (!raced && key === mainKey) {
        raced = true;
        const rec = storage.store.get(mainKey);
        storage.store.set(mainKey, { ...rec, version: rec.version + 1 });
      }
      return realGet<T>(key);
    };
    const entry = { startDate: add(start, 2), endDate: add(start, 4), startWeek: weeks[5].weekKey, spanWeeks: 1 };
    const failed = await shareTaskDates(storage, 'TEST', undefined, planB, [{ key: 'TEST-1', id: '1', entry }]);
    expect(raced).toBe(true);
    expect(failed).toEqual([]);
    expect(await planEntry(storage, 'default', 'TEST-1')).toMatchObject({ startDate: add(start, 2), endDate: add(start, 4), version: v0 + 2 });
  });

  it('shareTaskDates reports a task it could not update after 3 tries', async () => {
    const mainKey = 'cp:TEST:we:1';
    const realGet = storage.get.bind(storage);
    storage.get = async <T>(key: string): Promise<T | undefined> => {
      if (key === mainKey) {
        const rec = storage.store.get(mainKey);
        storage.store.set(mainKey, { ...rec, version: rec.version + 1 });
      }
      return realGet<T>(key);
    };
    const entry = { startDate: add(start, 2), endDate: add(start, 4), startWeek: weeks[5].weekKey, spanWeeks: 1 };
    expect(await shareTaskDates(storage, 'TEST', undefined, planB, [{ key: 'TEST-1', id: '1', entry }])).toEqual(['TEST-1']);
  });

  it('column widths, hidden columns and milestones are saved per plan', async () => {
    const main = mainPlanSnapshot(storage);
    await saveColumnWidths({ projectKey: 'TEST', planId: planB, columnWidths: { ...DEFAULT_COLUMN_WIDTHS, task: 300 } }, storage);
    await saveHiddenColumns({ projectKey: 'TEST', planId: planB, hiddenColumns: ['effort'] }, storage);
    await saveProjectMilestone({ projectKey: 'TEST', planId: planB, milestone: { id: 'm1', title: 'Go live', date: start, weekKey: weeks[5].weekKey, type: 'RELEASE' } as any }, storage);
    const b = await getProjectPlan('TEST', storage, new Date(), undefined, undefined, undefined, planB);
    expect(b.columnWidths!.task).toBe(300);
    expect(b.hiddenColumns).toEqual(['effort']);
    expect(b.milestones!.map(m => m.id)).toEqual(['m1']);
    const a = await getProjectPlan('TEST', storage);
    expect(a.columnWidths!.task).toBe(DEFAULT_COLUMN_WIDTHS.task);
    expect(a.hiddenColumns).toEqual([]);
    expect(a.milestones).toEqual([]);
    expect(mainPlanSnapshot(storage)).toBe(main);
  });

  it('saveTaskDependency in a scenario plan stores the link settings in that plan only', async () => {
    const main = mainPlanSnapshot(storage);
    const res: any = await saveTaskDependency({ projectKey: 'TEST', planId: planB, taskId: 'TEST-2', dependency: { predecessorKey: 'TEST-1', predecessorId: 'TEST-1', triggerPercent: 100, isTriggerSatisfied: false } }, storage);
    expect(res.planId).toBe(planB);
    expect((await planEntry(storage, planB, 'TEST-2')).dependencies[0].predecessorKey).toBe('TEST-1');
    expect(mainPlanSnapshot(storage)).toBe(main);
  });

  it('pruneStaleEntries deletes the stale record of the plan that listed it', async () => {
    const store = new PlanStore(storage, 'TEST', 'TEST', planB);
    await store.putEntry('TEST-99', '99', { startWeek: weeks[5].weekKey });
    mockRequestJira.mockImplementationOnce(async () => ({ status: 404, json: async () => ({}) }));
    const res = await pruneStaleEntries({ projectKey: 'TEST', planId: planB, keys: ['TEST-99'] }, storage);
    expect(res.pruned).toEqual(['TEST-99']);
    expect(await planEntry(storage, planB, 'TEST-99')).toBeUndefined();
  });

  it('a read of a deleted or unknown plan returns the Main Plan', async () => {
    await deleteProjectPlan({ projectKey: 'TEST', planId: planB }, storage);
    const res = await getProjectPlan('TEST', storage, new Date(), undefined, undefined, undefined, planB);
    expect(res.planId).toBe('default');
    expect(res.tasks.length).toBeGreaterThan(0);
  });

  it('a write to a deleted plan is refused before any KVS or Jira write', async () => {
    await deleteProjectPlan({ projectKey: 'TEST', planId: planB }, storage);
    const main = mainPlanSnapshot(storage);
    await expect(updateWbsTask({ projectKey: 'TEST', planId: planB, taskId: 'TEST-1', updates: { startDate: add(start, 1) } }, storage))
      .rejects.toThrow(ValidationError);
    await expect(batchUpdateTasks({ projectKey: 'TEST', planId: planB, items: [{ taskId: 'TEST-1', updates: { progress: 10 } }] }, storage))
      .rejects.toThrow(ValidationError);
    expect(mainPlanSnapshot(storage)).toBe(main);
    expect(jiraIssueWrites()).toEqual([]);
  });

  it('a plan id with characters outside the key alphabet is refused', async () => {
    await expect(getProjectPlan('TEST', storage, new Date(), undefined, undefined, undefined, 'x:we:1')).rejects.toThrow(ValidationError);
    await expect(updateWbsTask({ projectKey: 'TEST', planId: '../a', taskId: 'TEST-1', updates: { progress: 10 } }, storage)).rejects.toThrow(ValidationError);
    const clone = await createProjectPlan({ projectKey: 'TEST', name: 'Bad', cloneFromPlanId: 'a b' }, storage);
    expect(clone.ok).toBe(false);
  });
});
