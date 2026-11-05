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
  issueDeleted,
  handler,
  createProjectPlan,
  deleteProjectPlan,
  freezePlanBaseline,
  reviewScopeShift,
  migrateIfNeeded,
  openStore,
  setGlobalStorageProvider,
  setSleepForTests,
  getTimelineWeeks
} from '../../src/index';
import { setPermissionCheckerForTests } from '../../src/security/write-permissions';
import { PlanStore } from '../../src/storage/plan-store';
import { BaselineStore } from '../../src/storage/baseline-store';
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
/** The shared start property per issue key (ADR-008). */
let jiraDates: Record<string, any> = {};
let extraFields: Record<string, any> = {};
let searchKeys: number[] = [];
/** Per-test override; return undefined to fall through to the default fake. */
let override: ((url: string, opts?: any) => any) | null = null;

const issue = (n: number) => ({ id: String(n), key: `TEST-${n}`,
  fields: { summary: `T${n}`, issuetype: { name: 'Task', hierarchyLevel: 0 }, status, duedate: jiraDue[`TEST-${n}`] || null, ...(extraFields[`TEST-${n}`] || {}) },
  properties: jiraDates[`TEST-${n}`] ? { 'cascadeplan.dates': jiraDates[`TEST-${n}`] } : {} });

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
  jiraDates = {};
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
    const prop = opts?.method === 'PUT' ? url.match(/^\/rest\/api\/3\/issue\/(TEST-\d+)\/properties\/cascadeplan\.dates$/) : null;
    if (prop) {
      jiraDates[prop[1]] = JSON.parse(opts.body);
      return { status: 200, json: async () => ({}) };
    }
    const put = opts?.method === 'PUT' ? url.match(/^\/rest\/api\/3\/issue\/(TEST-\d+)$/) : null;
    if (put) {
      const fields = JSON.parse(opts.body).fields || {};
      if (fields.duedate) jiraDue[put[1]] = fields.duedate;
      return { status: 204, json: async () => ({}) };
    }
    if (/\/rest\/api\/3\/issue\/TEST-\d+\?fields=project/.test(url)) {
      return { status: 200, json: async () => ({ id: url.match(/TEST-(\d+)/)![1], fields: { project: { key: 'TEST', id: 'TEST' } } }) };
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
  it('R-01: two users move the same task in two plans; both plans show the same dates, the last write (ADR-008)', async () => {
    const vA = (await new PlanStore(storage, 'TEST', 'TEST').loadEntries()).get('TEST-1')!.version;
    const vB = (await new PlanStore(storage, 'TEST', 'TEST', planB).loadEntries()).get('TEST-1')!.version;
    const X = { startDate: add(start, 1), endDate: add(start, 3) };
    const Y = { startDate: add(start, 6), endDate: add(start, 8) };
    // A moves in the Main Plan, B in Plan B, each with the version it read: no copy between plans.
    const a: any = await updateWbsTask({ projectKey: 'TEST', taskId: 'TEST-1', updates: X, expectedVersion: vA }, storage);
    const b: any = await updateWbsTask({ projectKey: 'TEST', planId: planB, taskId: 'TEST-1', updates: Y, expectedVersion: vB }, storage);
    expect(a.ok && b.ok).toBe(true);
    // One value per issue: the property and the due date hold B's dates, the last write.
    expect(jiraDates['TEST-1']).toEqual({ ...Y, v: 1 });
    expect(jiraDue['TEST-1']).toBe(Y.endDate);
    const inB = await planTask(storage, planB, 'TEST-1');
    const inMain = await planTask(storage, undefined, 'TEST-1');
    expect(inMain).toMatchObject(Y);
    expect(inB).toMatchObject(Y);
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

  it('R-04: on a conflict, no Jira link is created (F-07)', async () => {
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
    expect(calls('POST', /\/rest\/api\/3\/issueLink$/)).toEqual([]);
    expect(res.jiraSync.writes).toEqual([]);
  });

  it('R-05: on a conflict, no Jira sub-task is created for a second person (F-07)', async () => {
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
    expect(calls('POST', /\/rest\/api\/3\/issue$/)).toEqual([]);
    expect(res.jiraSync.writes).toEqual([]);
  });

  it('R-06: on a conflict, no sub-task is deleted (F-07)', async () => {
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
    expect(calls('DELETE', /\/rest\/api\/3\/issue\/TEST-77$/)).toEqual([]);
    expect(res.jiraSync.writes).toEqual([]);
  });

  it('R-07: a successor another user moved is not moved, and is returned and reported as skipped (F-20)', async () => {
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
    expect(res.cascadeSkipped).toEqual(['TEST-6']);
    expect(res.jiraSync.writes.find((w: any) => w.key === 'TEST-6')).toMatchObject({ ok: false, error: 'not moved: someone else changed it; move the task again' });
  });
});

describe('Jira sync honesty (D2, D8)', () => {
  it('R-08: a status change with no matching workflow transition is reported as not written, with the reason', async () => {
    override = (url, opts) => (url.endsWith('/transitions') && !opts ? { status: 200, json: async () => ({ transitions: [] }) } : undefined);
    const v = (await planEntry(storage, 'default', 'TEST-1')).version;
    const res: any = await updateWbsTask({ projectKey: 'TEST', taskId: 'TEST-1', updates: { status: 'COMPLETED' }, expectedVersion: v }, storage);
    expect(calls('POST', /transitions$/)).toEqual([]);
    const w = res.jiraSync.writes.find((x: any) => x.fields.includes('status'));
    expect(w).toMatchObject({ ok: false, error: 'No workflow transition leads to completed from the current status' });
    expect(res.jiraSync.ok).toBe(false);
  });

  it('R-09: a status change whose transition POST fails is reported as not written', async () => {
    override = (url, opts) => {
      if (url.endsWith('/transitions') && !opts) return { status: 200, json: async () => ({ transitions: [{ id: '31', name: 'Done', to: { statusCategory: { key: 'done' } } }] }) };
      if (url.endsWith('/transitions') && opts?.method === 'POST') return { status: 400, json: async () => ({ errorMessages: ['Resolution is required'] }) };
      return undefined;
    };
    const v = (await planEntry(storage, 'default', 'TEST-1')).version;
    const res: any = await updateWbsTask({ projectKey: 'TEST', taskId: 'TEST-1', updates: { status: 'COMPLETED' }, expectedVersion: v }, storage);
    expect(calls('POST', /transitions$/).length).toBe(1);
    expect(res.jiraSync.ok).toBe(false);
    expect(res.jiraSync.writes.find((x: any) => x.fields.includes('status'))).toMatchObject({ ok: false, error: 'Jira did not apply the "Done" transition' });
  });

  it('R-10: setting progress to 100 or 50 does not change the Jira status (INV-03)', async () => {
    override = (url, opts) => (url.endsWith('/transitions') && !opts
      ? { status: 200, json: async () => ({ transitions: [{ id: '31', name: 'Done', to: { statusCategory: { key: 'done' } } }] }) } : undefined);
    for (const progress of [100, 50]) {
      const v = (await planEntry(storage, 'default', 'TEST-1')).version;
      await updateWbsTask({ projectKey: 'TEST', taskId: 'TEST-1', updates: { progress }, expectedVersion: v }, storage);
    }
    expect(calls('GET', /\/issue\/TEST-1\/transitions$/)).toEqual([]);
    expect(calls('POST', /\/issue\/TEST-1\/transitions$/)).toEqual([]);
  });

  it('R-11: a user who may not edit the issue in Jira changes nothing in any plan, and is told why (BL-2)', async () => {
    setPermissionCheckerForTests(); // the real Jira check
    override = (url, opts) => (opts?.method === 'POST' && url.endsWith('/permissions/check')
      ? { status: 200, json: async () => ({ projectPermissions: [{ permission: 'EDIT_ISSUES', issues: [] }, { permission: 'SCHEDULE_ISSUES', issues: [] }] }) } : undefined);
    const before = await planEntry(storage, 'default', 'TEST-1');
    const beforeB = await planEntry(storage, planB, 'TEST-1');
    const res: any = await updateWbsTask({ projectKey: 'TEST', taskId: 'TEST-1', updates: { startDate: add(start, 2), endDate: add(start, 4) }, expectedVersion: before.version }, storage);
    expect(res).toMatchObject({ ok: false, error: 'forbidden', message: 'You cannot change TEST-1: your Jira role lacks Edit issues, Schedule issues.' });
    expect(await planEntry(storage, 'default', 'TEST-1')).toEqual(before);
    expect(await planEntry(storage, planB, 'TEST-1')).toEqual(beforeB);
    expect(calls('PUT', /\/issue\/TEST-1$/)).toEqual([]);
  });

  it('R-12 (D3 edge a, F-19): a due date the screen rejects leaves the task on its old dates in every plan', async () => {
    jiraDue['TEST-3'] = add(start, 2);
    const before = await planEntry(storage, 'default', 'TEST-3');
    override = (url, opts) => (opts?.method === 'PUT' && /\/issue\/TEST-3$/.test(url)
      ? { status: 400, json: async () => ({ errors: { duedate: 'Field duedate cannot be set. It is not on the appropriate screen.' } }) } : undefined);
    const res: any = await updateWbsTask({ projectKey: 'TEST', taskId: 'TEST-3', updates: { startDate: add(start, 1), endDate: add(start, 9) }, expectedVersion: before.version }, storage);
    expect(res).toMatchObject({ ok: false, error: 'due_date_refused' });
    expect(res.jiraSync.ok).toBe(false);
    for (const p of ['default', planB]) {
      const e = await planEntry(storage, p, 'TEST-3');
      expect({ startDate: e.startDate, endDate: e.endDate }).toEqual({ startDate: before.startDate, endDate: before.endDate });
    }
  });

  it('R-13: createSubtaskForResource and createInlineTask write no estimate or due date the user did not enter', async () => {
    await createSubtaskForResource({ projectKey: 'TEST', parentKey: 'TEST-1', resourceAccountId: 'acc-3' } as any, storage);
    const sentTo = (key: string) => mockRequestJira.mock.calls
      .filter(([url, opts]) => opts?.method === 'PUT' && String(url) === `/rest/api/3/issue/${key}`)
      .map(([, opts]) => JSON.parse(opts.body).fields);
    for (const fields of sentTo('TEST-50')) {
      expect(fields.timetracking).toBeUndefined();
      expect(fields.duedate).toBeUndefined();
    }
    mockRequestJira.mockClear();
    const created: any = await createInlineTask({ projectKey: 'TEST', summary: 'New', startWeek: weeks[5].weekKey, spanWeeks: 3 } as any, storage);
    const key = created.task?.key || 'TEST-50';
    for (const fields of sentTo(key)) expect(fields.duedate).toBeUndefined();
    // An end the user chose is written.
    mockRequestJira.mockClear();
    await createSubtaskForResource({ projectKey: 'TEST', parentKey: 'TEST-1', resourceAccountId: 'acc-3', effortHours: 6, endDate: weeks[6].endDate } as any, storage);
    expect(sentTo('TEST-50').some(f => f.duedate === weeks[6].endDate && f.timetracking?.originalEstimate === '6h')).toBe(true);
  });

  it('R-14: createInlineTask checks that the plan still exists before it creates the Jira issue', async () => {
    await deleteProjectPlan({ projectKey: 'TEST', planId: planB }, storage);
    mockRequestJira.mockClear();
    await expect(createInlineTask({ projectKey: 'TEST', planId: planB, summary: 'New' } as any, storage)).rejects.toThrow(ValidationError);
    expect(calls('POST', /\/rest\/api\/3\/issue$/)).toEqual([]);
  });

  it('R-15 (F-15, F-07): the validator follows every link, so a cycle through a second (imported Jira) link is refused before any Jira write', async () => {
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
      .rejects.toThrow('Cyclic dependency detected: TEST-1 -> TEST-2 -> TEST-1');
    expect(calls('POST', /\/rest\/api\/3\/issueLink$/)).toEqual([]);
  });
});

describe('Security and permissions (D11)', () => {
  it('R-16: a scope shift review needs an approver, never by the requester, only APPROVED or REJECTED, and only once', async () => {
    override = url => (url.includes('mypermissions')
      ? { status: 200, json: async () => ({ permissions: { ADMINISTER: { havePermission: false }, ADMINISTER_PROJECTS: { havePermission: false } } }) } : undefined);
    const store = new BaselineStore(storage, 'TEST', 'default');
    await store.save({ id: 'b1', name: 'B1', frozenAt: '2026-11-01T00:00:00Z', frozenBy: 'acc-9', items: [{ id: '1', key: 'TEST-1', hours: 8, start: start, end: add(start, 2) }] });
    await store.saveShift({ id: 's1', planId: 'default', baselineId: 'b1', requestedBy: 'acc-1', requestedAt: 'x', reason: 'r', status: 'PENDING',
      summary: { added: 1, removed: 0, changed: 0, deltaHours: 10 }, v: 1 });
    // Through the resolver, a user who is not an approver is refused before anything is read or stored.
    const viaHandler: any = await handler({ call: { functionKey: 'reviewScopeShift', payload: { shiftId: 's1', status: 'APPROVED' } },
      context: { accountId: 'acc-2', extension: { project: { key: 'TEST', id: '10001' } } } });
    expect(viaHandler).toMatchObject({ ok: false, error: 'forbidden' });
    expect(calls('GET', /mypermissions/)[0]).toContain('projectId=10001');
    // The review rules themselves.
    expect((await reviewScopeShift({ projectKey: 'TEST', shiftId: 's1', status: 'APPROVED' }, storage, { accountId: 'acc-1' })).error)
      .toBe('A request cannot be approved or rejected by the person who made it.');
    expect((await reviewScopeShift({ projectKey: 'TEST', shiftId: 's1', status: 'WHATEVER' as any }, storage, { accountId: 'acc-2' })).error)
      .toBe('The review must be APPROVED or REJECTED.');
    const ok = await reviewScopeShift({ projectKey: 'TEST', shiftId: 's1', status: 'APPROVED' }, storage, { accountId: 'acc-2' });
    expect(ok.request).toMatchObject({ status: 'APPROVED', reviewedBy: 'acc-2' });
    // Approving freezes a new baseline version that supersedes b1 and is active (ADR-009).
    const idx = await store.readIndex();
    expect(idx.active).toBe(ok.request.newBaselineId);
    expect((await store.header(ok.request.newBaselineId))).toMatchObject({ supersedes: 'b1', name: 'B1 (version 2)', frozenBy: 'acc-2' });
    expect((await reviewScopeShift({ projectKey: 'TEST', shiftId: 's1', status: 'REJECTED' }, storage, { accountId: 'acc-3' })).error)
      .toBe('This request has already been reviewed.');
  });

  it('R-17: the approver check asks mypermissions about the project id, never with a key (F-24)', async () => {
    override = url => (url.includes('mypermissions') ? { status: 200, json: async () => ({ permissions: { ADMINISTER_PROJECTS: { havePermission: true } } }) } : undefined);
    expect(await isPlanApprover(storage, { projectId: '10001' })).toBe(true);
    expect(calls('GET', /mypermissions/)[0]).toContain('projectId=10001&');
    expect(await isPlanApprover(storage, { projectId: 'TEST' })).toBe(false);
    expect(calls('GET', /mypermissions/).length).toBe(1);
  });

  it('R-18: an issue the user cannot see keeps its record; there is no prune resolver, and loading deletes nothing (BL-9)', async () => {
    // Jira returns 404 both for a deleted issue and for an issue the caller has no permission to see.
    searchKeys = [1, 2, 3, 4, 6, 8];
    const plan = await getProjectPlan('TEST', storage);
    expect(plan.staleEntries).toContain('TEST-5');
    await expect(handler({ call: { functionKey: 'pruneStaleEntries', payload: { keys: ['TEST-5'] } },
      context: { extension: { project: { key: 'TEST', id: 'TEST' } } } })).rejects.toThrow(/no definition/i);
    await getProjectPlan('TEST', storage);
    expect(await planEntry(storage, 'default', 'TEST-5')).toBeDefined();
    // Only Jira's issue-deleted event removes it.
    await issueDeleted({ issue: { id: '5', key: 'TEST-5', fields: { project: { id: 'TEST', key: 'TEST' } } } }, storage);
    expect(await planEntry(storage, 'default', 'TEST-5')).toBeUndefined();
  });

  it('R-19 (ADR-009): a baseline stores no Jira text and no names; it is keyed by project id (here TEST, as in the fixture); who froze it is an audit subject that is reported', async () => {
    const res = await freezePlanBaseline({ projectKey: 'TEST', projectId: 'TEST', name: 'B1' }, storage, { accountId: 'acc-1' });
    expect(res.success).toBe(true);
    const keys = [...storage.store.keys()];
    expect(keys.some(k => k.startsWith('ps:baseline:'))).toBe(false);
    const chunkKey = keys.find(k => k.startsWith('cp:TEST:bl:default:c:'))!;
    const items: any[] = storage.store.get(chunkKey);
    expect(Object.keys(items[0]).sort()).toEqual(expect.arrayContaining(['id', 'key']));
    for (const i of items) { expect(i.summary).toBeUndefined(); expect(i.resource).toBeUndefined(); }
    expect(storage.store.get(keys.find(k => k.startsWith('cp:TEST:bl:default:h:'))!).frozenBy).toBe('acc-1');
    expect(storage.store.get('cp:pd:accounts')['acc-1'].keys).toEqual([expect.stringMatching(/^cp:TEST:bl:default:h:/)]);
  });

  it('R-20: deleting a plan also deletes its baselines, active-baseline pointer and scope-shift requests (F-22)', async () => {
    await freezePlanBaseline({ projectKey: 'TEST', planId: planB, name: 'B' }, storage, { accountId: 'acc-1' });
    await new BaselineStore(storage, 'TEST', planB).saveShift({ id: 's1', planId: planB, baselineId: 'b', requestedBy: 'acc-1', requestedAt: 'x', reason: 'r',
      status: 'PENDING', summary: { added: 0, removed: 0, changed: 1, deltaHours: 1 }, v: 1 });
    // Keys a development build wrote under the project key before ADR-009.
    await storage.set(`ps:baseline:TEST:${planB}:old`, { x: 1 });
    await storage.set(`ps:shifts:TEST:${planB}`, []);
    expect([...storage.store.keys()].filter(k => k.includes(planB)).length).toBeGreaterThan(3);
    await deleteProjectPlan({ projectKey: 'TEST', planId: planB }, storage);
    const left = [...storage.store.keys()].filter(k => k.includes(planB));
    expect(left).toEqual([]);
  });
});

describe('Validation (spec section 6)', () => {
  it('R-21 (F-18): an end before the start is refused, also when only one end is sent', async () => {
    const before = await planEntry(storage, 'default', 'TEST-1');
    await expect(updateWbsTask({ projectKey: 'TEST', taskId: 'TEST-1', updates: { startDate: add(start, 5), endDate: add(start, 1) }, expectedVersion: before.version }, storage))
      .rejects.toThrow('The end must be on or after the start.');
    await expect(updateWbsTask({ projectKey: 'TEST', taskId: 'TEST-1', updates: { endDate: add(before.startDate, -1) }, expectedVersion: before.version }, storage))
      .rejects.toThrow('The end must be on or after the start.');
    expect(await planEntry(storage, 'default', 'TEST-1')).toEqual(before);
  });

  it('R-22 (F-18): a date outside the window is refused and never sent to Jira', async () => {
    const v = (await planEntry(storage, 'default', 'TEST-1')).version;
    await expect(updateWbsTask({ projectKey: 'TEST', taskId: 'TEST-1', updates: { startDate: '9999-12-01', endDate: '9999-12-31' }, expectedVersion: v }, storage))
      .rejects.toThrow(/startDate must be between/);
    expect(jiraDue['TEST-1']).not.toBe('9999-12-31');
  });

  it('R-23 (F-18): scheduleBacklogTask refuses spanWeeks 0 with a validation result, not a TypeError', async () => {
    await expect(scheduleBacklogTask({ projectKey: 'TEST', taskId: 'TEST-8', startWeek: weeks[0].weekKey, spanWeeks: 0 } as any, storage))
      .rejects.toThrow(ValidationError);
    await expect(scheduleBacklogTask({ projectKey: 'TEST', taskId: 'TEST-8', startWeek: weeks[0].weekKey, targetIndex: -1 } as any, storage))
      .rejects.toThrow('targetIndex must be a whole number of at least 0');
  });

  it('R-24 (F-28): reorderWbsTasks reports a conflict when its record write lost a version race', async () => {
    const realSwap = storage.swap.bind(storage);
    storage.swap = async <T>(k: string, value: T): Promise<T | undefined> => {
      const rec = storage.store.get(k);
      if (rec && rec.version !== undefined) storage.store.set(k, { ...rec, version: rec.version + 1 });
      return realSwap<T>(k, value);
    };
    const res: any = await reorderWbsTasks({ projectKey: 'TEST', taskId: 'TEST-3', targetIndex: 0 }, storage);
    expect(res).toMatchObject({ ok: false, conflict: true });
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

  it('R-26 (F-23): addSubtaskToTask creates a Jira sub-task; nothing local hides the live Jira sub-tasks', async () => {
    extraFields['TEST-1'] = { subtasks: [{ id: '91', key: 'TEST-91', fields: { summary: 'Real Jira subtask', status: { statusCategory: { key: 'done' } } } }] };
    let t1 = await planTask(storage, undefined, 'TEST-1');
    expect(t1.subtasks.map((s: any) => s.key)).toEqual(['TEST-91']);
    const res: any = await addSubtaskToTask({ projectKey: 'TEST', parentTaskId: 'TEST-1', subtask: { summary: 'New one', estimateValue: 2, estimateUnit: 'HOURS' } }, storage);
    expect(res.createdKey).toBe('TEST-50');
    expect(calls('POST', /^\/rest\/api\/3\/issue$/)).toHaveLength(1);
    t1 = await planTask(storage, undefined, 'TEST-1');
    expect(t1.subtasks.map((s: any) => s.key)).toEqual(['TEST-91']);
    expect(t1.localSubtasks).toBeUndefined();
  });
});

describe('F-03: the plan returned after a write shows the written dates (owner observation 2026-11-05)', () => {
  it('R-30: the plan returned by updateWbsTask ends the moved bar on the NEW Jira due date', async () => {
    // Jira already holds the due date of the current bar (as after any earlier move).
    const before = await planEntry(storage, 'default', 'TEST-1');
    jiraDue['TEST-1'] = before.endDate;
    const res: any = await updateWbsTask({ projectKey: 'TEST', taskId: 'TEST-1', expectedVersion: before.version,
      updates: { startDate: add(before.startDate, 7), endDate: add(before.endDate, 7) } }, storage);
    expect(jiraDue['TEST-1']).toBe(add(before.endDate, 7));           // Jira has the new due date
    expect((await planEntry(storage, 'default', 'TEST-1')).endDate).toBe(add(before.endDate, 7)); // KVS too
    const returned = res.tasks.find((t: any) => t.key === 'TEST-1');
    // The 3-day bar moved 7 days keeps its length in the response.
    expect(returned).toMatchObject({ startDate: add(before.startDate, 7), endDate: add(before.endDate, 7) });
    // A fresh load (reload) shows the same.
    expect(await planTask(storage, undefined, 'TEST-1')).toMatchObject({ startDate: add(before.startDate, 7), endDate: add(before.endDate, 7) });

    // A 1-day move of a 3-day bar keeps its length.
    const v2 = (await planEntry(storage, 'default', 'TEST-2'));
    jiraDue['TEST-2'] = v2.endDate;
    const r2: any = await updateWbsTask({ projectKey: 'TEST', taskId: 'TEST-2', expectedVersion: v2.version,
      updates: { startDate: add(v2.startDate, 1), endDate: add(v2.endDate, 1) } }, storage);
    expect(r2.tasks.find((t: any) => t.key === 'TEST-2')).toMatchObject({ startDate: add(v2.startDate, 1), endDate: add(v2.endDate, 1) });
  });

  it('R-31: batchUpdateTasks and continueCascade also return the written dates', async () => {
    const e1 = await planEntry(storage, 'default', 'TEST-1');
    jiraDue['TEST-1'] = e1.endDate;
    const res: any = await batchUpdateTasks({ projectKey: 'TEST', items: [{ taskId: 'TEST-1', updates: { startDate: add(e1.startDate, 7), endDate: add(e1.endDate, 7) } }] }, storage);
    expect(res.tasks.find((t: any) => t.key === 'TEST-1').endDate).toBe(add(e1.endDate, 7));

    const store = new PlanStore(storage, 'TEST', 'TEST');
    const e5 = (await store.loadEntries()).get('TEST-5')!;
    await store.putEntry('TEST-5', '5', { ...e5, endDate: add(start, 8) }, e5.version);
    jiraDue['TEST-5'] = add(start, 8);
    const oldEnd6 = (await planEntry(storage, 'default', 'TEST-6')).endDate; // start+4
    jiraDue['TEST-6'] = oldEnd6;
    const c: any = await continueCascade({ projectKey: 'TEST', taskId: 'TEST-5' }, storage);
    expect(await planEntry(storage, 'default', 'TEST-6')).toMatchObject({ startDate: add(start, 9), endDate: add(start, 10) });
    const t6 = c.tasks.find((t: any) => t.key === 'TEST-6');
    // The cascaded successor is returned with its new dates, not collapsed onto its old Jira end.
    expect(t6).toMatchObject({ startDate: add(start, 9), endDate: add(start, 10) });
    expect(oldEnd6).not.toBe(t6.endDate);
    expect((await planTask(storage, undefined, 'TEST-6')).startDate).toBe(add(start, 9));
  });
});

describe('Sizes and costs (section 4.1, 4.5)', () => {
  it('R-27 (F-16): a 5,000-item baseline saves in chunks under the KVS value limit and loads back intact', async () => {
    const store = new BaselineStore(storage, '10001', 'default');
    const items = Array.from({ length: 5000 }, (_, i) => ({ id: String(100000 + i), key: `PROJ-${100000 + i}`, hours: 8, start: '2026-11-02', end: '2026-11-13' }));
    const h = await store.save({ id: 'big', name: 'Big', frozenAt: '2026-11-05T00:00:00Z', frozenBy: null, items });
    expect(h.chunks).toBe(25);
    const largest = Math.max(...[...storage.store.entries()].filter(([k]) => k.startsWith('cp:10001:bl:default:c:big:')).map(([, v]) => Buffer.byteLength(JSON.stringify(v), 'utf8')));
    // eslint-disable-next-line no-console
    console.log('largest baseline chunk bytes (200 items)', largest);
    expect(largest).toBeLessThan(240 * 1024);
    const loaded = await store.load('big');
    expect(loaded!.items).toHaveLength(5000);
    expect(loaded!.intact).toBe(true);
  });

  it('R-28: KVS operations for one move do not grow with the number of plans (200 scheduled tasks, ADR-008)', async () => {
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
    // No other plan is read or written on a move: the dates are the shared issue property.
    for (const k of ['query', 'queryRows', 'get', 'swap', 'set'] as const) expect(results[10][k]).toBe(results[1][k]);
  });

  it('F-17 timing: a batch of 50 items at 1,000 scheduled tasks finishes in under 10 s', async () => {
    const s = new MemStorage();
    setGlobalStorageProvider(s);
    const map: any = {};
    for (let n = 1; n <= 1000; n++) map[`TEST-${n}`] = { startWeek: weeks[5].weekKey, spanWeeks: 1, startDate: start, endDate: add(start, 2) };
    await s.set('scheduleMap:TEST', map);
    searchKeys = Array.from({ length: 1000 }, (_, i) => i + 1);
    await getProjectPlan('TEST', s);
    const items = Array.from({ length: 50 }, (_, i) => ({ taskId: `TEST-${i + 1}`, updates: { startDate: add(start, 1), endDate: add(start, 3) } }));
    const t0 = Date.now();
    const res: any = await batchUpdateTasks({ projectKey: 'TEST', items }, s);
    const ms = Date.now() - t0;
    // eslint-disable-next-line no-console
    console.log('batch of 50 at 1,000 tasks, ms', ms);
    expect(res.ok).toBe(true);
    expect(ms).toBeLessThan(10000);
  }, 30000);

  it('R-29: a batch of 50 items at 200 tasks makes at most 5 prefix queries (F-17)', async () => {
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
    expect(out.query).toBeLessThanOrEqual(5);
    // Every item is still written with its own version check.
    expect(out.swap).toBe(50);
  });
});
