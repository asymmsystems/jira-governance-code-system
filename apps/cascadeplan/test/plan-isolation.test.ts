/*
 * Copyright (c) 2026 Asymm Systems. All rights reserved.
 *
 * @author Fahim Farook
 */

/**
 * CascadePlan: named plans are isolated (UX-05). Every resolver reads and writes the plan named by
 * planId; a scenario plan never writes its schedule (the due date) to Jira, but its issue-field edits
 * (summary, estimate, assignee, status, parent) sync to Jira as on the Main Plan; a write to a deleted plan is refused;
 * a read of an unknown plan falls back to the Main Plan.
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
const issue = (n: number) => ({ id: String(n), key: `TEST-${n}`, fields: { summary: `T${n}`, issuetype: { name: 'Task', hierarchyLevel: 0 }, status } });
const add = (iso: string, d: number) => new Date(Date.parse(`${iso}T00:00:00Z`) + d * 86400000).toISOString().slice(0, 10);

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

/** Every Main Plan key and value, to prove a scenario write left the Main Plan untouched. */
function mainPlanSnapshot(storage: MemStorage): string {
  const rows = [...storage.store.entries()]
    .filter(([k]) => k.startsWith('cp:TEST:') && !k.startsWith('cp:TEST:plan:') && k !== 'cp:TEST:plans')
    .sort(([a], [b]) => (a < b ? -1 : 1));
  return JSON.stringify(rows);
}

async function planEntry(storage: MemStorage, planId: string, key: string): Promise<any> {
  return (await new PlanStore(storage, 'TEST', 'TEST', planId).loadEntries()).get(key);
}

describe('named plan isolation (UX-05)', () => {
  let storage: MemStorage;
  let planB: string;
  const start = weeks[5].startDate;

  beforeEach(async () => {
    storage = new MemStorage();
    setGlobalStorageProvider(storage);
    setSleepForTests(async () => undefined);
    mockRequestJira.mockReset();
    mockRequestJira.mockImplementation(async (routeStr: any) => {
      const url = String(routeStr);
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

  it('updateWbsTask on a scenario plan writes only that plan and nothing to Jira, cascade included', async () => {
    const main = mainPlanSnapshot(storage);
    const before = (await planEntry(storage, planB, 'TEST-5')).version;
    const res: any = await updateWbsTask({ projectKey: 'TEST', planId: planB, taskId: 'TEST-5', updates: { startDate: add(start, 3), endDate: add(start, 5) }, expectedVersion: before }, storage);
    expect(res.ok).toBe(true);
    expect(res.planId).toBe(planB);
    expect(await planEntry(storage, planB, 'TEST-5')).toMatchObject({ startDate: add(start, 3), endDate: add(start, 5), version: before + 1 });
    // The dependent moved in Plan B only.
    expect(await planEntry(storage, planB, 'TEST-6')).toMatchObject({ startDate: add(start, 6) });
    expect(mainPlanSnapshot(storage)).toBe(main);
    expect(jiraIssueWrites()).toEqual([]);
    expect(res.jiraSync).toEqual({ ok: true, writes: [] });
  });

  it('the returned version lets the next move of the same task succeed (no stale-version conflict)', async () => {
    const first: any = await updateWbsTask({ projectKey: 'TEST', planId: planB, taskId: 'TEST-1', updates: { startDate: add(start, 1), endDate: add(start, 3) }, expectedVersion: (await planEntry(storage, planB, 'TEST-1')).version }, storage);
    const v = first.tasks.find((t: any) => t.key === 'TEST-1').version;
    const second: any = await updateWbsTask({ projectKey: 'TEST', planId: planB, taskId: 'TEST-1', updates: { startDate: add(start, 2), endDate: add(start, 4) }, expectedVersion: v }, storage);
    expect(second.ok).toBe(true);
    expect(second.conflict).toBeUndefined();
  });

  it('updateWbsTask on the Main Plan still writes the due date to Jira', async () => {
    const v = (await planEntry(storage, 'default', 'TEST-1')).version;
    const res: any = await updateWbsTask({ projectKey: 'TEST', taskId: 'TEST-1', updates: { startDate: add(start, 1), endDate: add(start, 3) }, expectedVersion: v }, storage);
    expect(res.ok).toBe(true);
    expect(jiraIssueWrites()).toContain('PUT /rest/api/3/issue/TEST-1');
    expect(jiraFieldsSent('TEST-1')).toMatchObject({ duedate: add(start, 3) });
  });

  it('issue-field edits on a scenario plan sync to Jira (summary, estimate, assignee, status, parent), the due date does not', async () => {
    const base = mockRequestJira.getMockImplementation()!;
    mockRequestJira.mockImplementation(async (routeStr: any, opts?: any) => {
      if (String(routeStr).endsWith('/transitions') && !opts) {
        return { status: 200, json: async () => ({ transitions: [{ id: '31', name: 'Done', to: { statusCategory: { key: 'done' } } }] }) };
      }
      return base(routeStr, opts);
    });
    const main = mainPlanSnapshot(storage);
    const v = (await planEntry(storage, planB, 'TEST-1')).version;
    const res: any = await updateWbsTask({ projectKey: 'TEST', planId: planB, taskId: 'TEST-1', expectedVersion: v,
      updates: { summary: 'Renamed in Plan B', effortHours: 12, resourceAccountId: 'acc-7', status: 'COMPLETED', epicKey: 'TEST-9',
        startDate: add(start, 1), endDate: add(start, 3) } }, storage);
    expect(res.ok).toBe(true);
    expect(jiraFieldsSent('TEST-1')).toEqual({
      summary: 'Renamed in Plan B',
      timetracking: { originalEstimate: '12h' },
      parent: { key: 'TEST-9' },
      assignee: { accountId: 'acc-7' }
    });
    expect(jiraIssueWrites()).toContain('POST /rest/api/3/issue/TEST-1/transitions');
    // The new dates stay in Plan B; the Main Plan schedule is untouched.
    expect(await planEntry(storage, planB, 'TEST-1')).toMatchObject({ startDate: add(start, 1), endDate: add(start, 3) });
    expect(mainPlanSnapshot(storage)).toBe(main);
  });

  it('a date-only move on a scenario plan writes nothing to Jira', async () => {
    const v = (await planEntry(storage, planB, 'TEST-2')).version;
    await updateWbsTask({ projectKey: 'TEST', planId: planB, taskId: 'TEST-2', updates: { startDate: add(start, 1), endDate: add(start, 3) }, expectedVersion: v }, storage);
    expect(jiraIssueWrites()).toEqual([]);
  });

  it('scheduleBacklogTask on a scenario plan syncs the estimate but not the due date', async () => {
    await scheduleBacklogTask({ projectKey: 'TEST', planId: planB, taskId: 'TEST-8', startWeek: weeks[6].weekKey, spanWeeks: 1, effortHours: 8 }, storage);
    expect(jiraFieldsSent('TEST-8')).toEqual({ timetracking: { originalEstimate: '8h' } });
  });

  it('batchUpdateTasks on a scenario plan updates that plan, returns it, and leaves the Main Plan alone', async () => {
    const main = mainPlanSnapshot(storage);
    const items = [1, 2].map(n => ({ taskId: `TEST-${n}`, updates: { startDate: add(start, 4), endDate: add(start, 6) } }));
    const res: any = await batchUpdateTasks({ projectKey: 'TEST', planId: planB, items }, storage);
    expect(res.ok).toBe(true);
    expect(res.planId).toBe(planB);
    for (const n of [1, 2]) expect(await planEntry(storage, planB, `TEST-${n}`)).toMatchObject({ startDate: add(start, 4) });
    expect(mainPlanSnapshot(storage)).toBe(main);
    expect(jiraIssueWrites()).toEqual([]);
  });

  it('scheduleBacklogTask, unscheduleTask and reorderWbsTasks on a scenario plan stay in that plan', async () => {
    const main = mainPlanSnapshot(storage);
    const scheduled: any = await scheduleBacklogTask({ projectKey: 'TEST', planId: planB, taskId: 'TEST-8', startWeek: weeks[6].weekKey, spanWeeks: 1 }, storage);
    expect(scheduled.ok).toBe(true);
    expect(scheduled.planId).toBe(planB);
    expect((await planEntry(storage, planB, 'TEST-8')).startWeek).toBe(weeks[6].weekKey);

    const unscheduled: any = await unscheduleTask({ projectKey: 'TEST', planId: planB, taskId: 'TEST-2' }, storage);
    expect(unscheduled.planId).toBe(planB);
    expect((await planEntry(storage, planB, 'TEST-2')).startWeek).toBeUndefined();

    const reordered: any = await reorderWbsTasks({ projectKey: 'TEST', planId: planB, taskId: 'TEST-3', targetIndex: 0 }, storage);
    expect(reordered.planId).toBe(planB);
    expect(reordered.tasks[0].key).toBe('TEST-3');

    expect(mainPlanSnapshot(storage)).toBe(main);
    expect(jiraIssueWrites()).toEqual([]);
  });

  it('continueCascade and previewCascade read and write the scenario plan', async () => {
    // Plan B: TEST-5 now ends later, so TEST-6 must move; the Main Plan has no such conflict.
    const store = new PlanStore(storage, 'TEST', 'TEST', planB);
    const e5 = (await store.loadEntries()).get('TEST-5')!;
    await store.putEntry('TEST-5', '5', { ...e5, endDate: add(start, 8) }, e5.version);
    const main = mainPlanSnapshot(storage);

    const preview = await previewCascade({ projectKey: 'TEST', planId: planB, taskId: 'TEST-5', updates: { endDate: add(start, 8) } }, storage);
    expect(preview.changes.map(c => c.key)).toContain('TEST-6');

    const res: any = await continueCascade({ projectKey: 'TEST', planId: planB, taskId: 'TEST-5' }, storage);
    expect(res.planId).toBe(planB);
    expect((await planEntry(storage, planB, 'TEST-6')).startDate).toBe(add(start, 9));
    expect(mainPlanSnapshot(storage)).toBe(main);
    expect(jiraIssueWrites()).toEqual([]);
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

  it('saveTaskDependency on a scenario plan stores the link in that plan only', async () => {
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
