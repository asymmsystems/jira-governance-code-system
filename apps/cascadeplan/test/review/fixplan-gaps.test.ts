/*
 * Copyright (c) 2026 Asymm Systems. All rights reserved.
 *
 * @author Fahim Farook
 */

/**
 * Independent review of fix-plan.md (2026-11-05). NOT part of the product.
 * Each "GAP" test passes while the code at db08009 has the behaviour, and shows a path that a fix
 * in fix-plan.md does not name. When the code is fixed, the test fails and must be rewritten.
 */

import {
  getProjectPlan,
  updateWbsTask,
  batchUpdateTasks,
  setGlobalStorageProvider,
  setSleepForTests,
  getTimelineWeeks,
  handler,
  issueDeleted
} from '../../src/index';
import { PlanStore } from '../../src/storage/plan-store';
import { MemStorage } from '../helpers/mem-storage';

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
const start = weeks[5].startDate;

let jiraDue: Record<string, string> = {};
let searchKeys: number[] = [];
let override: ((url: string, opts?: any) => any) | null = null;
let storage: MemStorage;

const issue = (n: number) => ({ id: String(n), key: `TEST-${n}`,
  fields: { summary: `T${n}`, issuetype: { name: 'Task', hierarchyLevel: 0 }, status, duedate: jiraDue[`TEST-${n}`] || null } });

function calls(method: string, re: RegExp): string[] {
  return mockRequestJira.mock.calls
    .filter(([url, opts]) => (opts?.method || 'GET') === method && re.test(String(url)))
    .map(([url]) => String(url));
}

async function entry(key: string, planId = 'default', projectId = 'TEST'): Promise<any> {
  return (await new PlanStore(storage, projectId, 'TEST', planId).loadEntries()).get(key);
}

beforeEach(async () => {
  storage = new MemStorage();
  setGlobalStorageProvider(storage);
  setSleepForTests(async () => undefined);
  jiraDue = {};
  searchKeys = [1, 2, 3];
  override = null;
  mockRequestJira.mockReset();
  mockRequestJira.mockImplementation(async (routeStr: any, opts?: any) => {
    const url = String(routeStr);
    if (override) {
      const r = await override(url, opts);
      if (r !== undefined) return r;
    }
    const put = opts?.method === 'PUT' ? url.match(/^\/rest\/api\/3\/issue\/(TEST-\d+)$/) : null;
    if (put) {
      const fields = JSON.parse(opts.body).fields || {};
      if (fields.duedate) jiraDue[put[1]] = fields.duedate;
      return { status: 204, json: async () => ({}) };
    }
    if (/\/rest\/api\/3\/issue\/TEST-\d+\?fields=project/.test(url)) {
      return { status: 200, json: async () => ({ id: url.match(/TEST-(\d+)/)![1], fields: { project: { key: 'TEST' } } }) };
    }
    if (url.includes('/search/jql')) return { status: 200, json: async () => ({ issues: url.includes('Epic') ? [] : searchKeys.map(issue), isLast: true }) };
    return { status: 204, json: async () => ({}) };
  });
});

/** A (TEST-1) -> B (TEST-2) -> C (TEST-3), finish to start; Jira due dates equal the stored ends. */
async function seedChain(): Promise<void> {
  const w = weeks[5];
  const dep = (k: string) => ({ predecessorKey: k, predecessorId: k, triggerPercent: 100, isTriggerSatisfied: false });
  await storage.set('scheduleMap:TEST', {
    'TEST-1': { startWeek: w.weekKey, spanWeeks: 1, startDate: start, endDate: add(start, 2) },
    'TEST-2': { startWeek: w.weekKey, spanWeeks: 1, startDate: add(start, 3), endDate: add(start, 5), dependency: dep('TEST-1') },
    'TEST-3': { startWeek: w.weekKey, spanWeeks: 1, startDate: add(start, 6), endDate: add(start, 9), dependency: dep('TEST-2') }
  });
  await getProjectPlan('TEST', storage);
  jiraDue = { 'TEST-1': add(start, 2), 'TEST-2': add(start, 5), 'TEST-3': add(start, 9) };
  mockRequestJira.mockClear();
}

describe('F-03: each batch item sees the due dates the earlier items wrote', () => {
  it('FX-01: a multi-select move of A and B keeps C at its length (A -> B -> C)', async () => {
    await seedChain();
    const a = await entry('TEST-1');
    const b = await entry('TEST-2');
    // What src/ui/selection.ts moveSelectionBy sends for "move A and B by 7 days".
    await batchUpdateTasks({ projectKey: 'TEST', items: [
      { taskId: 'TEST-1', updates: { startDate: add(start, 7), endDate: add(start, 9) }, expectedVersion: a.version },
      { taskId: 'TEST-2', updates: { startDate: add(start, 10), endDate: add(start, 12) }, expectedVersion: b.version }
    ] }, storage);

    // C keeps its 4-day length and starts after B: start+13 .. start+16, in KVS, in Jira and on reload,
    // the same as with two separate calls (CONTROL FX-01b).
    const c = await entry('TEST-3');
    expect(c).toMatchObject({ startDate: add(start, 13), endDate: add(start, 16) });
    expect(jiraDue['TEST-3']).toBe(add(start, 16));
    const reloaded = (await getProjectPlan('TEST', storage)).tasks.find(t => t.key === 'TEST-3')!;
    expect(reloaded).toMatchObject({ startDate: add(start, 13), endDate: add(start, 16) });
  });

  it('CONTROL FX-01b: the same two moves as two separate updateWbsTask calls (fresh Jira read each) keep C at 4 days', async () => {
    await seedChain();
    const a = await entry('TEST-1');
    await updateWbsTask({ projectKey: 'TEST', taskId: 'TEST-1', updates: { startDate: add(start, 7), endDate: add(start, 9) }, expectedVersion: a.version }, storage);
    const b = await entry('TEST-2');
    await updateWbsTask({ projectKey: 'TEST', taskId: 'TEST-2', updates: { startDate: add(start, 10), endDate: add(start, 12) }, expectedVersion: b.version }, storage);
    const c = await entry('TEST-3');
    expect(c).toMatchObject({ startDate: add(start, 13), endDate: add(start, 16) });
    expect(jiraDue['TEST-3']).toBe(add(start, 16));
  });
});

describe('F-07: Jira writes before the version check that the plan does not list', () => {
  async function seedOwnedLink(): Promise<void> {
    const w = weeks[5];
    const store = new PlanStore(storage, 'TEST', 'TEST');
    await store.saveSettings({ migratedAt: '2026-01-01', modelVersion: 2 });
    await store.putEntry('TEST-1', '1', { startWeek: w.weekKey, spanWeeks: 1, startDate: start, endDate: add(start, 2) });
    await store.putEntry('TEST-2', '2', { startWeek: w.weekKey, spanWeeks: 1, startDate: add(start, 3), endDate: add(start, 5),
      dependencies: [{ predecessorKey: 'TEST-1', predecessorId: 'TEST-1', triggerPercent: 100, isTriggerSatisfied: false, jiraLinkId: '900' }],
      contributors: [{ accountId: 'acc-2', since: '2026-01-01', subtaskKey: 'TEST-77' }] } as any);
    mockRequestJira.mockClear();
  }
  async function bumpByAnotherUser(): Promise<void> {
    const other = new PlanStore(storage, 'TEST', 'TEST');
    const cur = (await other.loadEntries()).get('TEST-2')!;
    await other.putEntry('TEST-2', '2', { ...cur, startDate: add(start, 4) }, cur.version);
  }

  it('GAP FX-02: removing a dependency DELETEs the owned Jira link (index.ts:1624) before putEntry; the conflict hides it', async () => {
    await seedOwnedLink();
    override = async (url, opts) => {
      if (opts?.method === 'DELETE' && url === '/rest/api/3/issueLink/900') { await bumpByAnotherUser(); return { status: 204, json: async () => ({}) }; }
      return undefined;
    };
    const res: any = await updateWbsTask({ projectKey: 'TEST', taskId: 'TEST-2', updates: { dependency: null } as any }, storage);
    expect(calls('DELETE', /issueLink\/900$/)).toHaveLength(1); // the Jira link is gone
    expect(res.conflict).toBe(true);                             // the update was refused
    expect(res.jiraSync.writes).toEqual([]);                     // and the Changes panel shows nothing
  });

  it('GAP FX-03: "unassign" of a contributor sub-task PUTs to Jira (index.ts:1691) before putEntry; the conflict hides it', async () => {
    await seedOwnedLink();
    override = async (url, opts) => {
      if (opts?.method === 'PUT' && url === '/rest/api/3/issue/TEST-77') { await bumpByAnotherUser(); return { status: 204, json: async () => ({}) }; }
      return undefined;
    };
    const res: any = await updateWbsTask({ projectKey: 'TEST', taskId: 'TEST-2',
      updates: { contributors: [], removeSubtaskAction: { subtaskKey: 'TEST-77', action: 'unassign' } } as any }, storage);
    expect(calls('PUT', /issue\/TEST-77$/)).toHaveLength(1);
    expect(JSON.parse(mockRequestJira.mock.calls.find(([u, o]) => String(u).endsWith('TEST-77') && o?.method === 'PUT')![1].body))
      .toEqual({ fields: { assignee: null } });
    expect(res.conflict).toBe(true);
    expect(res.jiraSync.writes).toEqual([]);
  });
});

describe('N-01: a call without a project context', () => {
  it('GAP FX-04: getProjectPlan from a context with no project migrates legacy keys under the project KEY and deletes them; the project page then finds no record', async () => {
    const w = weeks[5];
    await storage.set('scheduleMap:TEST', { 'TEST-1': { startWeek: w.weekKey, spanWeeks: 1, startDate: start, endDate: add(start, 2) } });
    // Admin page: same function, no context.extension.project (manifest.yml:9-15).
    await handler({ call: { functionKey: 'getProjectPlan', payload: { projectKey: 'TEST' } }, context: { extension: { type: 'jira:adminPage' } } });
    expect(await storage.get('scheduleMap:TEST')).toBeUndefined();         // legacy key deleted
    expect((await storage.query('cp:TEST:we:')).length).toBe(1);           // record under the project key
    // Project page: records are keyed by the project id (extractProjectId), so the task is in the backlog.
    const res: any = await handler({ call: { functionKey: 'getProjectPlan', payload: {} },
      context: { extension: { type: 'jira:projectPage', project: { key: 'TEST', id: '10001' } } } });
    expect(res.tasks.find((t: any) => t.key === 'TEST-1')).toBeUndefined();
    expect(res.backlogTasks.find((t: any) => t.key === 'TEST-1')).toBeDefined();
  });
});

describe('BL-9: the issue-deleted trigger finds records in both key forms', () => {
  it('FX-05: a legacy entry stored under the issue KEY is deleted by the issue-deleted event', async () => {
    const w = weeks[5];
    searchKeys = [1];
    await storage.set('scheduleMap:TEST', {
      'TEST-1': { startWeek: w.weekKey, spanWeeks: 1, startDate: start, endDate: add(start, 2) },
      'TEST-9': { startWeek: w.weekKey, spanWeeks: 1, startDate: start, endDate: add(start, 2) }
    });
    await getProjectPlan('TEST', storage);
    const keys = (await storage.query('cp:TEST:we:')).map(r => r.key).sort();
    expect(keys).toEqual(['cp:TEST:we:1', 'cp:TEST:we:TEST-9']);
    // The record holds issueId = 'TEST-9' (plan-store.ts:120); the event carries the numeric id and the key.
    expect(((await storage.get('cp:TEST:we:TEST-9')) as any).issueId).toBe('TEST-9');
    const res = await issueDeleted({ issue: { id: '9', key: 'TEST-9', fields: { project: { id: 'TEST', key: 'TEST' } } } }, storage);
    expect(res.deleted.length).toBe(1);
    expect(await storage.get('cp:TEST:we:TEST-9')).toBeUndefined();
    expect(await storage.get('cp:TEST:we:1')).toBeDefined();
  });
});
