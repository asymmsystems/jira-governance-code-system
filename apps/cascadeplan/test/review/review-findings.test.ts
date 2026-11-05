/*
 * Copyright (c) 2026 Asymm Systems. All rights reserved.
 *
 * @author Fahim Farook
 */

/**
 * Independent review tests (marketplace readiness review, 2026-11-05). NOT part of the product.
 * Each test asserts the behaviour the code has at review commit db08009. A test named
 * "FINDING ..." passes when the defect is present, so it proves the finding. A test named
 * "OK ..." proves that the behaviour is correct.
 */

import {
  getProjectPlan,
  updateWbsTask,
  batchUpdateTasks,
  scheduleBacklogTask,
  continueCascade,
  createInlineTask,
  createSubtaskForResource,
  addSubtaskToTask,
  reorderWbsTasks,
  pruneStaleEntries,
  createProjectPlan,
  deleteProjectPlan,
  freezePlanBaseline,
  reviewScopeShift,
  shareTaskDates,
  migrateIfNeeded,
  openStore,
  setGlobalStorageProvider,
  setSleepForTests,
  getTimelineWeeks
} from '../../src/index';
import { PlanStore } from '../../src/storage/plan-store';
import { BaselineRepository } from '../../src/storage/baseline-repository';
import { ValidationError } from '../../src/validation';
import { toWorkEffortRecord, fromWorkEffortRecord, WbsTask } from '../../src/domain/models';
import { isPlanApprover } from '../../src/security/policy-admin';
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

/** Fake Jira state. */
let jiraDue: Record<string, string> = {};
let extraFields: Record<string, any> = {};
let searchKeys: number[] = [];
/** Per-test override; return undefined to fall through to the default fake. */
let override: ((url: string, opts?: any) => any) | null = null;

const issue = (n: number) => ({ id: String(n), key: `TEST-${n}`,
  fields: { summary: `T${n}`, issuetype: { name: 'Task', hierarchyLevel: 0 }, status, duedate: jiraDue[`TEST-${n}`] || null, ...(extraFields[`TEST-${n}`] || {}) } });

function calls(method: string, re: RegExp): string[] {
  return mockRequestJira.mock.calls
    .filter(([url, opts]) => (opts?.method || 'GET') === method && re.test(String(url)))
    .map(([url]) => String(url));
}

async function planEntry(storage: MemStorage, planId: string, key: string): Promise<any> {
  return (await new PlanStore(storage, 'TEST', 'TEST', planId).loadEntries()).get(key);
}

async function planTask(storage: MemStorage, planId: string | undefined, key: string): Promise<any> {
  const plan = await getProjectPlan('TEST', storage, new Date(), undefined, undefined, undefined, planId);
  return [...plan.tasks, ...(plan.backlogTasks || [])].find(t => t.key === key);
}

let storage: MemStorage;
let planB: string;

beforeEach(async () => {
  storage = new MemStorage();
  setGlobalStorageProvider(storage);
  setSleepForTests(async () => undefined);
  jiraDue = {};
  extraFields = {};
  searchKeys = [1, 2, 3, 4, 5, 6, 8];
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
    if (url === '/rest/api/3/issueLink' && opts?.method === 'POST') return { status: 201, json: async () => ({}) };
    if (url === '/rest/api/3/issue' && opts?.method === 'POST') return { status: 201, json: async () => ({ id: '50', key: 'TEST-50' }) };
    return { status: 204, json: async () => ({}) };
  });
  const w = weeks[5];
  const map: any = {};
  for (let n = 1; n <= 5; n++) map[`TEST-${n}`] = { startWeek: w.weekKey, spanWeeks: 1, startDate: w.startDate, endDate: add(w.startDate, 2) };
  map['TEST-6'] = { startWeek: w.weekKey, spanWeeks: 1, startDate: add(w.startDate, 3), endDate: add(w.startDate, 4),
    dependency: { predecessorKey: 'TEST-5', predecessorId: 'TEST-5', triggerPercent: 100, isTriggerSatisfied: false } };
  await storage.set('scheduleMap:TEST', map);
  await getProjectPlan('TEST', storage);
  const created = await createProjectPlan({ projectKey: 'TEST', name: 'Plan B', cloneFromPlanId: 'default' }, storage);
  planB = created.plan.id;
  mockRequestJira.mockClear();
});

describe('D3 shared dates: concurrency', () => {
  it('FINDING R-01: two users move the same task in two plans at once; the plans end up with different dates', async () => {
    const sA = new PlanStore(storage, 'TEST', 'TEST');
    const sB = new PlanStore(storage, 'TEST', 'TEST', planB);
    const eA = (await sA.loadEntries()).get('TEST-1')!;
    const eB = (await sB.loadEntries()).get('TEST-1')!;
    const X = { startDate: add(start, 1), endDate: add(start, 3) };
    const Y = { startDate: add(start, 6), endDate: add(start, 8) };
    // Interleaving: A saves in Main, B saves in Plan B, A copies to Plan B, B copies to Main (what updateWbsTask does in order).
    const pA = await sA.putEntry('TEST-1', '1', { ...eA, ...X }, eA.version);
    const pB = await sB.putEntry('TEST-1', '1', { ...eB, ...Y }, eB.version);
    expect(pA.ok && pB.ok).toBe(true);
    expect(await shareTaskDates(storage, 'TEST', undefined, undefined, [{ key: 'TEST-1', id: '1', entry: pA.entry }])).toEqual([]);
    expect(await shareTaskDates(storage, 'TEST', undefined, planB, [{ key: 'TEST-1', id: '1', entry: pB.entry }])).toEqual([]);
    // Each plan now holds the OTHER user's dates.
    expect((await planEntry(storage, 'default', 'TEST-1')).startDate).toBe(Y.startDate);
    expect((await planEntry(storage, planB, 'TEST-1')).startDate).toBe(X.startDate);
    // Jira got A's due date then B's due date; Plan B shows A's start with B's end: a bar nobody drew.
    jiraDue['TEST-1'] = Y.endDate;
    const inB = await planTask(storage, planB, 'TEST-1');
    const inMain = await planTask(storage, undefined, 'TEST-1');
    expect(inB.startDate).toBe(X.startDate);
    expect(inB.endDate).toBe(Y.endDate);
    expect(inMain.startDate).toBe(Y.startDate);
    expect(inB.startDate).not.toBe(inMain.startDate);
  });

  it('FINDING R-02: putEntry restore overwrites a third writer; that writer was told its write succeeded (lost update)', async () => {
    const key = 'cp:TEST:we:1';
    const store = new PlanStore(storage, 'TEST', 'TEST');
    const v1 = (await store.loadEntries()).get('TEST-1')!;
    const realSwap = storage.swap.bind(storage);
    const realSet = storage.set.bind(storage);
    let phase = 0;
    let cResult: any;
    storage.swap = async <T>(k: string, value: T): Promise<T | undefined> => {
      if (k === key && phase === 0) {
        phase = 1;
        // Writer B commits first, between A's read and A's swap.
        const rec = storage.store.get(key);
        storage.store.set(key, { ...rec, effort: { ...rec.effort, estimatedStartDate: 'B-WROTE' }, version: rec.version + 1 });
      }
      return realSwap<T>(k, value);
    };
    storage.set = async (k: string, value: any): Promise<void> => {
      if (k === key && phase === 1) {
        phase = 2;
        // Writer C runs between A's swap and A's restore. It reads A's interim record and saves on top of it.
        const c = new PlanStore(storage, 'TEST', 'TEST');
        const seen = (await c.loadEntries()).get('TEST-1')!;
        cResult = await c.putEntry('TEST-1', '1', { ...seen, startDate: add(start, 9) }, seen.version);
      }
      return realSet(k, value);
    };
    const aResult = await store.putEntry('TEST-1', '1', { ...v1, startDate: add(start, 4) }, v1.version);
    expect(aResult.ok).toBe(false);
    expect(cResult.ok).toBe(true); // C was told OK ...
    const finalStart = (await planEntry(storage, 'default', 'TEST-1')).startDate;
    expect(finalStart).not.toBe(add(start, 9)); // ... but C's value is gone.
    expect(finalStart).toBe('B-WROTE');
  });

  it('OK R-03: two users move the same task in the same plan; the second is refused with a conflict and writes nothing to Jira', async () => {
    const v = (await planEntry(storage, 'default', 'TEST-1')).version;
    const first: any = await updateWbsTask({ projectKey: 'TEST', taskId: 'TEST-1', updates: { startDate: add(start, 1), endDate: add(start, 3) }, expectedVersion: v }, storage);
    expect(first.ok).toBe(true);
    mockRequestJira.mockClear();
    const second: any = await updateWbsTask({ projectKey: 'TEST', taskId: 'TEST-1', updates: { startDate: add(start, 5), endDate: add(start, 7) }, expectedVersion: v }, storage);
    expect(second.conflict).toBe(true);
    expect(calls('PUT', /\/issue\/TEST-1$/)).toEqual([]);
  });

  it('FINDING R-04: a conflict after the Jira link is created hides the Jira write (jiraSync.writes is empty)', async () => {
    const key = 'cp:TEST:we:2';
    const realSwap = storage.swap.bind(storage);
    let bumped = false;
    storage.swap = async <T>(k: string, value: T): Promise<T | undefined> => {
      if (k === key && !bumped) {
        bumped = true;
        const rec = storage.store.get(key);
        storage.store.set(key, { ...rec, version: rec.version + 1 });
      }
      return realSwap<T>(k, value);
    };
    const v = (await planEntry(storage, 'default', 'TEST-2')).version;
    const res: any = await updateWbsTask({ projectKey: 'TEST', taskId: 'TEST-2', expectedVersion: v,
      updates: { dependency: { predecessorKey: 'TEST-1', predecessorId: 'TEST-1', triggerPercent: 50, isTriggerSatisfied: false } } }, storage);
    expect(res.conflict).toBe(true);
    expect(calls('POST', /\/rest\/api\/3\/issueLink$/).length).toBe(1);
    expect(res.jiraSync.writes).toEqual([]);
  });

  it('FINDING R-05: a conflict after a second person is added leaves a new Jira sub-task that the user is not told about', async () => {
    const key = 'cp:TEST:we:2';
    const realSwap = storage.swap.bind(storage);
    let bumped = false;
    storage.swap = async <T>(k: string, value: T): Promise<T | undefined> => {
      if (k === key && !bumped) {
        bumped = true;
        const rec = storage.store.get(key);
        storage.store.set(key, { ...rec, version: rec.version + 1 });
      }
      return realSwap<T>(k, value);
    };
    const v = (await planEntry(storage, 'default', 'TEST-2')).version;
    const res: any = await updateWbsTask({ projectKey: 'TEST', taskId: 'TEST-2', expectedVersion: v,
      updates: { contributors: [{ accountId: 'acc-9' }] } as any }, storage);
    expect(res.conflict).toBe(true);
    expect(calls('POST', /\/rest\/api\/3\/issue$/).length).toBe(1);
    expect(res.jiraSync.writes).toEqual([]);
  });

  it('FINDING R-06: a sub-task DELETE runs before the version check that later refuses the update', async () => {
    const key = 'cp:TEST:we:2';
    const realSwap = storage.swap.bind(storage);
    let bumped = false;
    storage.swap = async <T>(k: string, value: T): Promise<T | undefined> => {
      if (k === key && !bumped) {
        bumped = true;
        const rec = storage.store.get(key);
        storage.store.set(key, { ...rec, version: rec.version + 1 });
      }
      return realSwap<T>(k, value);
    };
    const v = (await planEntry(storage, 'default', 'TEST-2')).version;
    const res: any = await updateWbsTask({ projectKey: 'TEST', taskId: 'TEST-2', expectedVersion: v,
      updates: { removeSubtaskAction: { subtaskKey: 'TEST-77', action: 'delete' } } as any }, storage);
    expect(res.conflict).toBe(true);
    expect(calls('DELETE', /\/rest\/api\/3\/issue\/TEST-77$/).length).toBe(1);
    expect(res.jiraSync.writes).toEqual([]);
  });

  it('FINDING R-07: a cascade batch skips a successor that another user moved, and does not list it as remaining', async () => {
    const store = new PlanStore(storage, 'TEST', 'TEST');
    const e5 = (await store.loadEntries()).get('TEST-5')!;
    await store.putEntry('TEST-5', '5', { ...e5, endDate: add(start, 8) }, e5.version);
    const key6 = 'cp:TEST:we:6';
    const realSwap = storage.swap.bind(storage);
    let bumped = false;
    storage.swap = async <T>(k: string, value: T): Promise<T | undefined> => {
      if (k === key6 && !bumped) {
        bumped = true;
        const rec = storage.store.get(key6);
        storage.store.set(key6, { ...rec, version: rec.version + 1 });
      }
      return realSwap<T>(k, value);
    };
    const res: any = await continueCascade({ projectKey: 'TEST', taskId: 'TEST-5' }, storage);
    expect(res.cascadeRemaining).toEqual([]);
    expect(res.jiraSync.writes.some((w: any) => w.key === 'TEST-6' && !w.ok)).toBe(true);
    // TEST-6 still starts before TEST-5 ends; the client stops because nothing is "remaining".
    const t6 = await planTask(storage, undefined, 'TEST-6');
    expect(t6.dependency.isViolated).toBe(true);
  });
});

describe('Jira sync honesty (D2, D8)', () => {
  it('FINDING R-08: a status change is reported as written when no workflow transition matches', async () => {
    override = (url, opts) => (url.endsWith('/transitions') && !opts ? { status: 200, json: async () => ({ transitions: [] }) } : undefined);
    const v = (await planEntry(storage, 'default', 'TEST-1')).version;
    const res: any = await updateWbsTask({ projectKey: 'TEST', taskId: 'TEST-1', updates: { status: 'COMPLETED' }, expectedVersion: v }, storage);
    expect(calls('POST', /transitions$/)).toEqual([]);
    const w = res.jiraSync.writes.find((x: any) => x.fields.includes('status'));
    expect(w.ok).toBe(true);
    expect(res.jiraSync.ok).toBe(true);
  });

  it('FINDING R-09: a status change is reported as written when the transition POST fails', async () => {
    override = (url, opts) => {
      if (url.endsWith('/transitions') && !opts) return { status: 200, json: async () => ({ transitions: [{ id: '31', name: 'Done', to: { statusCategory: { key: 'done' } } }] }) };
      if (url.endsWith('/transitions') && opts?.method === 'POST') return { status: 400, json: async () => ({ errorMessages: ['Resolution is required'] }) };
      return undefined;
    };
    const v = (await planEntry(storage, 'default', 'TEST-1')).version;
    const res: any = await updateWbsTask({ projectKey: 'TEST', taskId: 'TEST-1', updates: { status: 'COMPLETED' }, expectedVersion: v }, storage);
    expect(calls('POST', /transitions$/).length).toBe(1);
    expect(res.jiraSync.ok).toBe(true);
  });

  it('FINDING R-10: setting progress to 100 transitions the Jira status although the user did not edit the status (INV-03)', async () => {
    override = (url, opts) => (url.endsWith('/transitions') && !opts
      ? { status: 200, json: async () => ({ transitions: [{ id: '31', name: 'Done', to: { statusCategory: { key: 'done' } } }] }) } : undefined);
    const v = (await planEntry(storage, 'default', 'TEST-1')).version;
    await updateWbsTask({ projectKey: 'TEST', taskId: 'TEST-1', updates: { progress: 100 }, expectedVersion: v }, storage);
    expect(calls('POST', /\/issue\/TEST-1\/transitions$/).length).toBe(1);
  });

  it('FINDING R-11: a user who cannot edit the issue (Jira 403) still changes the shared dates in every plan', async () => {
    override = (url, opts) => (opts?.method === 'PUT' && /\/issue\/TEST-1$/.test(url)
      ? { status: 403, json: async () => ({ errorMessages: ['You do not have permission to edit issues in this project.'] }) } : undefined);
    const v = (await planEntry(storage, 'default', 'TEST-1')).version;
    const res: any = await updateWbsTask({ projectKey: 'TEST', taskId: 'TEST-1', updates: { startDate: add(start, 2), endDate: add(start, 4) }, expectedVersion: v }, storage);
    expect(res.jiraSync.ok).toBe(false);
    expect((await planEntry(storage, 'default', 'TEST-1')).startDate).toBe(add(start, 2));
    expect((await planEntry(storage, planB, 'TEST-1')).startDate).toBe(add(start, 2));
  });

  it('FINDING R-12 (D3 edge a): a due date the screen rejects leaves the bar with the new start and the OLD Jira end', async () => {
    jiraDue['TEST-3'] = add(start, 2);
    override = (url, opts) => (opts?.method === 'PUT' && /\/issue\/TEST-3$/.test(url)
      ? { status: 400, json: async () => ({ errors: { duedate: 'Field duedate cannot be set. It is not on the appropriate screen.' } }) } : undefined);
    const v = (await planEntry(storage, 'default', 'TEST-3')).version;
    const res: any = await updateWbsTask({ projectKey: 'TEST', taskId: 'TEST-3', updates: { startDate: add(start, 1), endDate: add(start, 9) }, expectedVersion: v }, storage);
    expect(res.jiraSync.ok).toBe(false);
    const t3 = await planTask(storage, planB, 'TEST-3');
    expect(t3.startDate).toBe(add(start, 1));
    expect(t3.endDate).toBe(add(start, 2)); // the user asked for start+9
  });

  it('FINDING R-13: createSubtaskForResource writes a 20 h estimate and a 2-week due date that the user did not enter', async () => {
    await createSubtaskForResource({ projectKey: 'TEST', parentKey: 'TEST-1', resourceAccountId: 'acc-3' } as any, storage);
    const puts = mockRequestJira.mock.calls.filter(([url, opts]) => opts?.method === 'PUT' && String(url) === '/rest/api/3/issue/TEST-50');
    const fields = JSON.parse(puts[0][1].body).fields;
    expect(fields.timetracking).toEqual({ originalEstimate: '20h' });
    expect(fields.duedate).toBeDefined();
  });

  it('FINDING R-14: createInlineTask creates the Jira issue before it checks that the plan still exists', async () => {
    await deleteProjectPlan({ projectKey: 'TEST', planId: planB }, storage);
    mockRequestJira.mockClear();
    await expect(createInlineTask({ projectKey: 'TEST', planId: planB, summary: 'New' } as any, storage)).rejects.toThrow(ValidationError);
    expect(calls('POST', /\/rest\/api\/3\/issue$/).length).toBe(1);
  });

  it('FINDING R-15: a cycle through a second (imported Jira) link passes validation, a Jira link is created, then the update throws', async () => {
    // TEST-2 waits for TEST-3 (stored, first link) and is blocked by TEST-1 in Jira (imported, second link).
    const store = new PlanStore(storage, 'TEST', 'TEST');
    const e2 = (await store.loadEntries()).get('TEST-2')!;
    await store.putEntry('TEST-2', '2', { ...e2, dependency: { predecessorKey: 'TEST-3', predecessorId: 'TEST-3', triggerPercent: 100, isTriggerSatisfied: false },
      dependencies: [{ predecessorKey: 'TEST-3', predecessorId: 'TEST-3', triggerPercent: 100, isTriggerSatisfied: false }] }, e2.version);
    extraFields['TEST-2'] = { issuelinks: [{ type: { name: 'Blocks' }, inwardIssue: { key: 'TEST-1', id: '1' } }] };
    const v1 = (await planEntry(storage, 'default', 'TEST-1')).version;
    mockRequestJira.mockClear();
    await expect(updateWbsTask({ projectKey: 'TEST', taskId: 'TEST-1', expectedVersion: v1,
      updates: { dependency: { predecessorKey: 'TEST-2', predecessorId: 'TEST-2', triggerPercent: 100, isTriggerSatisfied: false } } }, storage))
      .rejects.toThrow(/cycle/i);
    expect(calls('POST', /\/rest\/api\/3\/issueLink$/).length).toBe(1);
  });
});

describe('Security and permissions (D11)', () => {
  it('FINDING R-16: reviewScopeShift approves without any approver check', async () => {
    override = url => (url.includes('mypermissions')
      ? { status: 200, json: async () => ({ permissions: { ADMINISTER: { havePermission: false }, ADMINISTER_PROJECTS: { havePermission: false } } }) } : undefined);
    const repo = new BaselineRepository(storage);
    await repo.saveShiftRequest({ shiftId: 's1', planId: 'default', baselineId: 'b1', projectKey: 'TEST', requestedBy: 'acc-1', requestedAt: 'x',
      status: 'PENDING', deltaHours: 10, reason: 'r', addedTaskKeys: [], removedTaskKeys: [], modifiedTaskKeys: [] });
    const res = await reviewScopeShift({ projectKey: 'TEST', shiftId: 's1', status: 'APPROVED' }, storage, { accountId: 'acc-1' });
    expect(res.success).toBe(true);
    expect(res.request!.status).toBe('APPROVED');
    expect(res.request!.reviewedBy).toBe('acc-1'); // the requester approved their own request
    expect(calls('GET', /mypermissions/)).toEqual([]);
    // Any status string is stored.
    const odd = await reviewScopeShift({ projectKey: 'TEST', shiftId: 's1', status: 'WHATEVER' as any }, storage, { accountId: 'acc-1' });
    expect(odd.request!.status).toBe('WHATEVER');
  });

  it('FINDING R-17: checkPlanApprover sends the project key as an issue key to mypermissions', async () => {
    override = url => (url.includes('mypermissions') ? { status: 404, json: async () => ({ errorMessages: ['Issue does not exist'] }) } : undefined);
    const ok = await isPlanApprover(storage, 'TEST');
    expect(ok).toBe(false);
    expect(calls('GET', /mypermissions/)[0]).toContain('issueKey=TEST&');
  });

  it('FINDING R-18 (plausible on Jira): a user whose search cannot see an issue causes its record to be pruned on a 404', async () => {
    // Jira returns 404 both for a deleted issue and for an issue the caller has no permission to see.
    searchKeys = [1, 2, 3, 4, 6, 8];
    const plan = await getProjectPlan('TEST', storage);
    expect(plan.staleEntries).toContain('TEST-5');
    override = url => (/\/issue\/TEST-5\?fields=project/.test(url) ? { status: 404, json: async () => ({ errorMessages: ['Issue does not exist or you do not have permission to see it.'] }) } : undefined);
    const res = await pruneStaleEntries({ projectKey: 'TEST', keys: ['TEST-5'] }, storage);
    expect(res.pruned).toEqual(['TEST-5']);
    expect(await planEntry(storage, 'default', 'TEST-5')).toBeUndefined();
  });

  it('FINDING R-19: baselines store Jira-owned text and display names in KVS (INV-04, personal data)', async () => {
    const res = await freezePlanBaseline({ projectKey: 'TEST', name: 'B1' }, storage, { accountId: 'acc-1' });
    expect(res.success).toBe(true);
    const stored: any = [...storage.store.entries()].find(([k]) => k.startsWith('ps:baseline:TEST:default:'))![1];
    const snap: any = Object.values(stored.tasks)[0];
    expect(snap.summary).toBeDefined();
    expect(snap.resource).toBeDefined();
    expect(stored.frozenBy).toBe('acc-1');
    // Keyed by project KEY, not id (CP-09 says keys use the id so a renamed project keeps its data).
    expect([...storage.store.keys()].some(k => k.startsWith('ps:baseline:TEST:'))).toBe(true);
  });

  it('FINDING R-20: deleting a plan leaves its baselines, active-baseline pointer and scope-shift requests in KVS', async () => {
    await freezePlanBaseline({ projectKey: 'TEST', planId: planB, name: 'B' }, storage, { accountId: 'acc-1' });
    await new BaselineRepository(storage).saveShiftRequest({ shiftId: 's1', planId: planB, baselineId: 'b', projectKey: 'TEST', requestedBy: 'acc-1', requestedAt: 'x',
      status: 'PENDING', deltaHours: 1, reason: 'r', addedTaskKeys: [], removedTaskKeys: [], modifiedTaskKeys: [] });
    await deleteProjectPlan({ projectKey: 'TEST', planId: planB }, storage);
    const left = [...storage.store.keys()].filter(k => k.includes(planB));
    expect(left.some(k => k.startsWith('ps:baseline:'))).toBe(true);
    expect(left.some(k => k.startsWith('ps:active_baseline:'))).toBe(true);
    expect(left.some(k => k.startsWith('ps:shifts:'))).toBe(true);
    expect(left.some(k => k.startsWith('cp:'))).toBe(false);
  });
});

describe('Validation (spec section 6)', () => {
  it('FINDING R-21: an end date before the start date is accepted and stored', async () => {
    const v = (await planEntry(storage, 'default', 'TEST-1')).version;
    const res: any = await updateWbsTask({ projectKey: 'TEST', taskId: 'TEST-1', updates: { startDate: add(start, 5), endDate: add(start, 1) }, expectedVersion: v }, storage);
    expect(res.ok).toBe(true);
    const e = await planEntry(storage, 'default', 'TEST-1');
    expect(e.startDate > e.endDate).toBe(true);
  });

  it('FINDING R-22: a date far outside the 10-year window is accepted and sent to Jira', async () => {
    const v = (await planEntry(storage, 'default', 'TEST-1')).version;
    await updateWbsTask({ projectKey: 'TEST', taskId: 'TEST-1', updates: { startDate: '9999-12-01', endDate: '9999-12-31' }, expectedVersion: v }, storage);
    expect(jiraDue['TEST-1']).toBe('9999-12-31');
  });

  it('FINDING R-23: scheduleBacklogTask does not validate spanWeeks; 0 crashes with a TypeError instead of a validation result', async () => {
    await expect(scheduleBacklogTask({ projectKey: 'TEST', taskId: 'TEST-8', startWeek: weeks[0].weekKey, spanWeeks: 0 } as any, storage))
      .rejects.toThrow(TypeError);
  });

  it('FINDING R-24: reorderWbsTasks returns ok when its record write lost a version race', async () => {
    const realSwap = storage.swap.bind(storage);
    storage.swap = async <T>(k: string, value: T): Promise<T | undefined> => {
      const rec = storage.store.get(k);
      if (rec && rec.version !== undefined) storage.store.set(k, { ...rec, version: rec.version + 1 });
      return realSwap<T>(k, value);
    };
    const res: any = await reorderWbsTasks({ projectKey: 'TEST', taskId: 'TEST-3', targetIndex: 0 }, storage);
    expect(res.ok).toBe(true);
    storage.swap = realSwap;
    const plan = await getProjectPlan('TEST', storage);
    expect(plan.tasks[0].key).not.toBe('TEST-3');
  });
});

describe('Data model (D7, section 4.1)', () => {
  it('round trip: which fields survive toWorkEffortRecord -> fromWorkEffortRecord', () => {
    const entry: Partial<WbsTask> = {
      startDate: '2026-11-04', endDate: '2026-11-10', sequenceNum: 1500, targetProgress: 40, manualTargetProgress: true,
      manualProgress: true, progress: 30, startWeek: '04-Nov', endWeek: '04-Nov', spanWeeks: 1, weeklyAllocations: { '04-Nov': 100 },
      isBacklog: false,
      dependencies: [{ predecessorId: 'X-1', predecessorKey: 'X-1', triggerPercent: 30, isTriggerSatisfied: false, jiraLinkId: '77', since: '2026-11-01', notes: 'why' }],
      endedLinks: [{ predecessorKey: 'X-2', until: '2026-11-02' }],
      contributors: [{ accountId: 'acc-1', since: '2026-11-01', subtaskKey: 'X-9', legacyName: 'Old Name' }],
      effortConfig: { unit: 'STORY_POINTS', rawEstimate: 3, hoursConversionRatio: 6, bufferType: 'PERCENTAGE', bufferValue: 10, bufferHours: 2, totalCalculatedHours: 20 },
      subtasks: [{ id: 's', summary: 'local', estimateValue: 1, estimateUnit: 'HOURS', normalizedHours: 1, status: 'NOT_STARTED' }]
    };
    const back: any = fromWorkEffortRecord(toWorkEffortRecord('X-5', entry, '2026-11-05'));
    expect(back.startDate).toBe(entry.startDate);
    expect(back.sequenceNum).toBe(1500);
    expect(back.weeklyAllocations).toEqual({ '04-Nov': 100 });
    expect(back.isBacklog).toBe(false);
    expect(back.effortConfig.totalCalculatedHours).toBe(20);
    expect(back.subtasks[0].summary).toBe('local');
    // Dropped or changed silently:
    expect(back.dependencies[0].notes).toBeUndefined();                 // notes dropped
    expect(back.endedLinks[0].triggerPercent).toBe(100);                // undefined becomes 100
    expect(back.contributors[0].legacyName).toBeUndefined();            // dropped when an account id exists (by design)
    expect(back.dependency).toEqual(back.dependencies[0]);
  });

  it('OK R-25: migrateIfNeeded twice gives the same records, and a failure halfway then a rerun gives the same result', async () => {
    const legacy = (await storage.query<any>('cp:TEST:we:')).map(r => r.value);
    // Run again: nothing changes.
    await migrateIfNeeded(openStore(storage, 'TEST'), 'TEST');
    const again = (await storage.query<any>('cp:TEST:we:')).map(r => r.value);
    expect(again).toEqual(legacy);

    // Fresh project; fail on the 3rd record write, then rerun.
    const s2 = new MemStorage();
    setGlobalStorageProvider(s2);
    const map: any = {};
    for (let n = 1; n <= 5; n++) map[`TEST-${n}`] = { startWeek: weeks[5].weekKey, spanWeeks: 1, startDate: start, endDate: add(start, 2) };
    await s2.set('scheduleMap:TEST', map);
    const realSwap = s2.swap.bind(s2);
    let n = 0;
    s2.swap = async <T>(k: string, v: T) => { if (++n === 3) throw new Error('KVS 503'); return realSwap<T>(k, v); };
    await expect(migrateIfNeeded(openStore(s2, 'TEST'), 'TEST')).rejects.toThrow('KVS 503');
    expect(await s2.get('scheduleMap:TEST')).toBeDefined(); // old data kept
    s2.swap = realSwap;
    await migrateIfNeeded(openStore(s2, 'TEST'), 'TEST');
    const recs = (await s2.query<any>('cp:TEST:we:')).map(r => fromWorkEffortRecord(r.value));
    expect(recs.length).toBe(5);
    expect(recs.every(r => r.startDate === start)).toBe(true);
    expect(await s2.get('scheduleMap:TEST')).toBeUndefined();
  });

  it('FINDING R-26: addSubtaskToTask stores local sub-tasks that then hide the live Jira sub-tasks of the issue', async () => {
    extraFields['TEST-1'] = { subtasks: [{ id: '91', key: 'TEST-91', fields: { summary: 'Real Jira subtask', status: { statusCategory: { key: 'done' } } } }] };
    let t1 = await planTask(storage, undefined, 'TEST-1');
    expect(t1.subtasks.map((s: any) => s.key)).toEqual(['TEST-91']);
    await addSubtaskToTask({ projectKey: 'TEST', parentTaskId: 'TEST-1', subtask: { summary: 'Local only', estimateValue: 2, estimateUnit: 'HOURS' } }, storage);
    t1 = await planTask(storage, undefined, 'TEST-1');
    expect(t1.subtasks.map((s: any) => s.summary)).toEqual(['Local only']);
  });
});

describe('Shorter bar right after a drag (owner observation 2026-11-05)', () => {
  it('FINDING R-30: the plan returned by updateWbsTask ends the moved bar on the OLD Jira due date', async () => {
    // Jira already holds the due date of the current bar (as after any earlier move).
    const before = await planEntry(storage, 'default', 'TEST-1');
    jiraDue['TEST-1'] = before.endDate;
    const res: any = await updateWbsTask({ projectKey: 'TEST', taskId: 'TEST-1', expectedVersion: before.version,
      updates: { startDate: add(before.startDate, 7), endDate: add(before.endDate, 7) } }, storage);
    expect(jiraDue['TEST-1']).toBe(add(before.endDate, 7));           // Jira has the new due date
    expect((await planEntry(storage, 'default', 'TEST-1')).endDate).toBe(add(before.endDate, 7)); // KVS too
    const returned = res.tasks.find((t: any) => t.key === 'TEST-1');
    // The 3-day bar moved 7 days: the new start is after the old Jira end, so the start is pulled back
    // to the old end too. The screen gets a one-day bar on the old end date.
    expect(returned.startDate).toBe(before.endDate);
    expect(returned.endDate).toBe(before.endDate);
    // A fresh load (reload) is correct.
    expect(await planTask(storage, undefined, 'TEST-1')).toMatchObject({ startDate: add(before.startDate, 7), endDate: add(before.endDate, 7) });

    // A 1-day move of a 3-day bar: new start, old end, so the bar is drawn 1 day shorter.
    const v2 = (await planEntry(storage, 'default', 'TEST-2'));
    jiraDue['TEST-2'] = v2.endDate;
    const r2: any = await updateWbsTask({ projectKey: 'TEST', taskId: 'TEST-2', expectedVersion: v2.version,
      updates: { startDate: add(v2.startDate, 1), endDate: add(v2.endDate, 1) } }, storage);
    expect(r2.tasks.find((t: any) => t.key === 'TEST-2')).toMatchObject({ startDate: add(v2.startDate, 1), endDate: v2.endDate });
  });

  it('FINDING R-31: same stale read in batchUpdateTasks and continueCascade', async () => {
    const e1 = await planEntry(storage, 'default', 'TEST-1');
    jiraDue['TEST-1'] = e1.endDate;
    const res: any = await batchUpdateTasks({ projectKey: 'TEST', items: [{ taskId: 'TEST-1', updates: { startDate: add(e1.startDate, 7), endDate: add(e1.endDate, 7) } }] }, storage);
    expect(res.tasks.find((t: any) => t.key === 'TEST-1').endDate).toBe(e1.endDate);

    const store = new PlanStore(storage, 'TEST', 'TEST');
    const e5 = (await store.loadEntries()).get('TEST-5')!;
    await store.putEntry('TEST-5', '5', { ...e5, endDate: add(start, 8) }, e5.version);
    jiraDue['TEST-5'] = add(start, 8);
    const oldEnd6 = (await planEntry(storage, 'default', 'TEST-6')).endDate; // start+4
    jiraDue['TEST-6'] = oldEnd6;
    const c: any = await continueCascade({ projectKey: 'TEST', taskId: 'TEST-5' }, storage);
    expect(await planEntry(storage, 'default', 'TEST-6')).toMatchObject({ startDate: add(start, 9), endDate: add(start, 10) });
    const t6 = c.tasks.find((t: any) => t.key === 'TEST-6');
    // The new start is after the old Jira end, so the returned bar collapses to one day on the old end.
    expect(t6.startDate).toBe(oldEnd6);
    expect(t6.endDate).toBe(oldEnd6);
    expect((await planTask(storage, undefined, 'TEST-6')).startDate).toBe(add(start, 9));
  });
});

describe('Sizes and costs (section 4.1, 4.5)', () => {
  it('MEASURE R-27: baseline value size at 1,000 tasks against the KVS value limit', () => {
    const { ScopeCreepEngine } = require('../../src/domain/scope-creep');
    const sizes: Record<number, number> = {};
    for (const summaryLen of [40, 80, 160]) {
      const tasks = Array.from({ length: 1000 }, (_, i) => ({ id: String(10000 + i), key: `PROJ-${10000 + i}`, summary: 'x'.repeat(summaryLen),
        effortHours: 8, startWeek: '04-Nov', endWeek: '18-Nov', spanWeeks: 3, resource: 'Firstname Lastname', status: 'IN_PROGRESS' })) as any;
      const b = ScopeCreepEngine.freezeBaseline('default', 'PROJ', 'B', '557058:aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee', tasks);
      sizes[summaryLen] = Buffer.byteLength(JSON.stringify(b), 'utf8');
    }
    // eslint-disable-next-line no-console
    console.log('baseline bytes at 1000 tasks by summary length', sizes);
    expect(sizes[80]).toBeGreaterThan(240 * 1024);
  });

  it('MEASURE R-28: KVS operations for one move, by number of plans (200 scheduled tasks)', async () => {
    const results: Record<number, any> = {};
    for (const planCount of [1, 3, 10]) {
      const s = new MemStorage();
      setGlobalStorageProvider(s);
      const map: any = {};
      for (let n = 1; n <= 200; n++) map[`TEST-${n}`] = { startWeek: weeks[5].weekKey, spanWeeks: 1, startDate: start, endDate: add(start, 2) };
      await s.set('scheduleMap:TEST', map);
      searchKeys = Array.from({ length: 200 }, (_, i) => i + 1);
      await getProjectPlan('TEST', s);
      for (let p = 1; p < planCount; p++) await createProjectPlan({ projectKey: 'TEST', name: `P${p}`, cloneFromPlanId: 'default' }, s);
      const counts = { get: 0, set: 0, swap: 0, query: 0, queryRows: 0, delete: 0 };
      const g = s.get.bind(s), st = s.set.bind(s), sw = s.swap.bind(s), q = s.query.bind(s), d = s.delete.bind(s);
      s.get = async (k: string) => { counts.get++; return g(k); };
      s.set = async (k: string, v: any) => { counts.set++; return st(k, v); };
      s.swap = async (k: string, v: any) => { counts.swap++; return sw(k, v); };
      s.query = async (p: string) => { counts.query++; const r = await q(p); counts.queryRows += r.length; return r as any; };
      s.delete = async (k: string) => { counts.delete++; return d(k); };
      mockRequestJira.mockClear();
      const v = (await new PlanStore(s, 'TEST', 'TEST').loadEntries()).get('TEST-1')!.version;
      counts.query = 0; counts.queryRows = 0; counts.get = 0;
      await updateWbsTask({ projectKey: 'TEST', taskId: 'TEST-1', updates: { startDate: add(start, 1), endDate: add(start, 3) }, expectedVersion: v }, s);
      // Real KVS pages queries at 100 rows: one query of 200 rows = 2 pages.
      results[planCount] = { ...counts, queryPagesAt100: Math.ceil(counts.queryRows / 100) + counts.query, jiraCalls: mockRequestJira.mock.calls.length };
    }
    // eslint-disable-next-line no-console
    console.log('KVS ops for one move (200 tasks)', JSON.stringify(results));
    expect(results[10].query).toBeGreaterThan(results[1].query);
  });

  it('MEASURE R-29: KVS operations for batchUpdateTasks with 50 items (200 scheduled tasks, 1 plan)', async () => {
    const s = new MemStorage();
    setGlobalStorageProvider(s);
    const map: any = {};
    for (let n = 1; n <= 200; n++) map[`TEST-${n}`] = { startWeek: weeks[5].weekKey, spanWeeks: 1, startDate: start, endDate: add(start, 2) };
    await s.set('scheduleMap:TEST', map);
    searchKeys = Array.from({ length: 200 }, (_, i) => i + 1);
    await getProjectPlan('TEST', s);
    const counts = { get: 0, swap: 0, query: 0, queryRows: 0 };
    const g = s.get.bind(s), sw = s.swap.bind(s), q = s.query.bind(s);
    s.get = async (k: string) => { counts.get++; return g(k); };
    s.swap = async (k: string, v: any) => { counts.swap++; return sw(k, v); };
    s.query = async (p: string) => { counts.query++; const r = await q(p); counts.queryRows += r.length; return r as any; };
    mockRequestJira.mockClear();
    const items = Array.from({ length: 50 }, (_, i) => ({ taskId: `TEST-${i + 1}`, updates: { startDate: add(start, 1), endDate: add(start, 3) } }));
    const res: any = await batchUpdateTasks({ projectKey: 'TEST', items }, s);
    expect(res.ok).toBe(true);
    const out = { ...counts, queryPagesAt100: counts.query + Math.ceil(counts.queryRows / 100), jiraCalls: mockRequestJira.mock.calls.length };
    // eslint-disable-next-line no-console
    console.log('batch of 50 (200 tasks)', JSON.stringify(out));
    expect(out.query).toBeGreaterThan(100);
  });
});
