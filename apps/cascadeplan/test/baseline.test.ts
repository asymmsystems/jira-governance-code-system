/*
 * Copyright (c) 2026 Asymm Systems. All rights reserved.
 *
 * @author Fahim Farook
 */

/** ADR-009: baselines, scope delta, versions, comparison, export, integrity and personal data. */
import { baselineItems, compareItems, baselineCsv } from '../src/domain/baseline';
import { BaselineStore, ACCOUNTS_KEY } from '../src/storage/baseline-store';
import {
  getProjectPlan, freezePlanBaseline, getPlanBaselines, getScopeCreepReport, compareBaselines, exportBaseline,
  setActiveBaseline, requestScopeShift, reviewScopeShift, reportPersonalData, deleteProjectPlan, createProjectPlan,
  updateWbsTask, setGlobalStorageProvider, setSleepForTests, getTimelineWeeks
} from '../src/index';
import { ValidationError } from '../src/validation';
import { MemStorage } from './helpers/mem-storage';
import { PlanStore } from '../src/storage/plan-store';

const mockRequestJira = jest.fn();
jest.mock('@forge/api', () => ({
  __esModule: true,
  default: { asApp: () => ({ requestJira: mockRequestJira }), asUser: () => ({ requestJira: mockRequestJira }) },
  route: (strings: any, ...values: any[]) => strings.reduce((acc: string, str: string, i: number) => acc + str + (values[i] !== undefined ? values[i] : ''), '')
}));
jest.mock('@forge/kvs', () => ({ kvs: { get: jest.fn(), set: jest.fn(), delete: jest.fn() } }));

const weeks = getTimelineWeeks().weeks;
const s0 = weeks[5].startDate;
const add = (iso: string, d: number) => new Date(Date.parse(`${iso}T00:00:00Z`) + d * 86400000).toISOString().slice(0, 10);

describe('baseline domain', () => {
  const tasks: any[] = [
    { id: '1', key: 'P-1', effortHours: 8, startDate: '2026-11-02', endDate: '2026-11-06', status: 'NOT_STARTED' },
    { id: '2', key: 'P-2', startDate: '2026-11-09', endDate: '2026-11-13', status: 'COMPLETED' },
    { id: '3', key: 'P-3', effortHours: 16, startDate: '2026-11-02', endDate: '2026-11-13', datesFromChildren: true },
    { id: '4', key: 'P-4', effortHours: 40, isEpic: true, hierarchyLevel: 1, startDate: '2026-11-02' },
    { id: '5', key: 'P-5', effortHours: 4 }
  ];
  it('freezes leaf work items on the timeline only, with no made-up hours', () => {
    expect(baselineItems(tasks)).toEqual([
      { id: '1', key: 'P-1', hours: 8, start: '2026-11-02', end: '2026-11-06' },
      { id: '2', key: 'P-2', start: '2026-11-09', end: '2026-11-13', done: true }
    ]);
  });
  it('compares: added, removed, changed hours and dates, totals, percent, slipped', () => {
    const from = [{ id: '1', key: 'P-1', hours: 8, start: '2026-11-02', end: '2026-11-06' }, { id: '2', key: 'P-2', hours: 2 }];
    const to = [{ id: '1', key: 'P-1', hours: 12, start: '2026-11-02', end: '2026-11-10' }, { id: '6', key: 'P-6' }];
    const c = compareItems(from, to);
    expect(c.added.map(i => i.key)).toEqual(['P-6']);
    expect(c.removed.map(i => i.key)).toEqual(['P-2']);
    expect(c.changed).toEqual([{ id: '1', key: 'P-1', fromHours: 8, toHours: 12, fromEnd: '2026-11-06', toEnd: '2026-11-10' }]);
    expect(c).toMatchObject({ fromHours: 10, toHours: 12, deltaHours: 2, deltaPercent: 20, slipped: 1, grew: true });
    expect(compareItems(from, from)).toMatchObject({ added: [], removed: [], changed: [], grew: false, deltaPercent: 0 });
  });
  it('CSV quotes text and carries the digest', () => {
    const csv = baselineCsv({ header: { name: 'Q4, "final"', frozenAt: 'T', digest: 'abc' } as any, items: [{ id: '1', key: 'P-1', hours: 8, done: true }] });
    expect(csv.split('\n')).toEqual(['# "Q4, ""final""", frozen T, SHA-256 abc', 'issue_id,issue_key,estimate_hours,start,end,done', '1,P-1,8,,,yes', '']);
  });
});

describe('baseline domain: more comparison cases', () => {
  it('sorts items by id, notes a start change, a shrink, and an estimate that only grew', () => {
    expect(baselineItems([{ id: '9', key: 'P-9', startDate: '2026-11-02' }, { id: '10', key: 'P-10', startDate: '2026-11-02' }, { id: '10', key: 'P-10b', startDate: '2026-11-02' }] as any).map(i => i.key)).toEqual(['P-10', 'P-10b', 'P-9']);
    const c = compareItems([{ id: '1', key: 'A', hours: 4, start: '2026-11-02', end: '2026-11-06' }], [{ id: '1', key: 'A', hours: 2, start: '2026-11-03', end: '2026-11-05' }]);
    expect(c.changed).toEqual([{ id: '1', key: 'A', fromHours: 4, toHours: 2, fromStart: '2026-11-02', toStart: '2026-11-03', fromEnd: '2026-11-06', toEnd: '2026-11-05' }]);
    expect(c).toMatchObject({ grew: false, slipped: 0, deltaHours: -2, deltaPercent: -50 });
    expect(compareItems([{ id: '1', key: 'A' }], [{ id: '1', key: 'A', hours: 3 }])).toMatchObject({ grew: true, deltaPercent: 0 });
  });
});

describe('BaselineStore: guards', () => {
  it('needs query and swap; requests list newest first; an index change can be declined', async () => {
    expect(() => new BaselineStore({ get: async () => undefined, set: async () => undefined, delete: async () => undefined } as any, 'P')).toThrow('query and swap');
    const s = new BaselineStore(new MemStorage(), 'P');
    const shift = (id: string, at: string) => ({ id, planId: 'default', baselineId: 'b', requestedBy: null, requestedAt: at, reason: 'r', status: 'PENDING' as const, summary: { added: 0, removed: 0, changed: 0, deltaHours: 0 }, v: 1 as const });
    await s.saveShift(shift('a', '2026-11-01'));
    await s.saveShift(shift('b', '2026-11-03'));
    expect((await s.shifts()).map(x => x.id)).toEqual(['b', 'a']);
    expect(await s.updateIndex(() => null)).toBe(false);
    await s.save({ id: 'x', name: 'X', frozenAt: 'T', frozenBy: null, items: [] });
    await s.updateIndex(idx => ({ ...idx, ids: [] }));
    expect(await s.setActive('x')).toBe(false);
  });
});

describe('BaselineStore: chunks, index, integrity', () => {
  it('a changed chunk or a missing chunk shows as not intact', async () => {
    const storage = new MemStorage();
    const store = new BaselineStore(storage, 'P', 'default');
    const items = Array.from({ length: 450 }, (_, i) => ({ id: String(i), key: `P-${i}`, hours: 1 }));
    const h = await store.save({ id: 'b', name: 'B', frozenAt: 'T', frozenBy: null, items });
    expect(h).toMatchObject({ chunks: 3, itemCount: 450, totalHours: 450 });
    expect((await store.load('b'))!.intact).toBe(true);
    const chunk = storage.store.get('cp:P:bl:default:c:b:1');
    chunk[0].hours = 99;
    storage.store.set('cp:P:bl:default:c:b:1', chunk);
    expect((await store.load('b'))!.intact).toBe(false);
    storage.store.delete('cp:P:bl:default:c:b:2');
    expect((await store.load('b'))!.intact).toBe(false);
  });
});

describe('baseline resolvers', () => {
  let storage: MemStorage;
  const users = [{ accountId: 'acc-1', displayName: 'Ann Lee' }, { accountId: 'acc-2', displayName: 'Bo Chen' }];
  const issue = (n: number, est?: number) => ({ id: String(n), key: `TEST-${n}`, fields: { summary: `T${n}`, issuetype: { name: 'Task', hierarchyLevel: 0 },
    status: { statusCategory: { key: 'new' } }, ...(est ? { timeoriginalestimate: est * 3600 } : {}) } });
  let keys: number[];

  beforeEach(async () => {
    storage = new MemStorage();
    setGlobalStorageProvider(storage);
    setSleepForTests(async () => undefined);
    keys = [1, 2, 3];
    mockRequestJira.mockReset();
    mockRequestJira.mockImplementation(async (r: any, o?: any) => {
      const url = String(r);
      const ok = (status: number, body: any = {}) => ({ status, json: async () => body });
      if (url.includes('/user/assignable')) return ok(200, users);
      if (/\/rest\/api\/3\/issue\/TEST-\d+\?fields=project/.test(url)) return ok(200, { id: url.match(/TEST-(\d+)/)![1], fields: { project: { key: 'TEST', id: 'TEST' } } });
      if (url.includes('/search/jql')) return ok(200, { issues: url.includes('Epic') ? [] : keys.map(n => issue(n, n * 4)), isLast: true });
      if (o?.method === 'PUT') return ok(204);
      return ok(200, {});
    });
    const w = weeks[5].weekKey;
    await storage.set('scheduleMap:TEST', {
      'TEST-1': { startWeek: w, spanWeeks: 1, startDate: s0, endDate: add(s0, 2) },
      'TEST-2': { startWeek: w, spanWeeks: 1, startDate: s0, endDate: add(s0, 4) }
    });
    await getProjectPlan('TEST', storage);
  });

  it('freeze, list with names read live, integrity of the active one', async () => {
    const f: any = await freezePlanBaseline({ projectKey: 'TEST', name: 'Sprint 7' }, storage, { accountId: 'acc-1' });
    expect(f).toMatchObject({ ok: true, baseline: { name: 'Sprint 7', itemCount: 2, totalHours: 12, frozenBy: 'acc-1' } });
    const l: any = await getPlanBaselines({ projectKey: 'TEST' }, storage);
    expect(l).toMatchObject({ ok: true, active: f.baseline.id, activeIntact: true });
    expect(l.baselines[0]).toMatchObject({ name: 'Sprint 7', frozenByName: 'Ann Lee' });
    await expect(freezePlanBaseline({ projectKey: 'TEST', name: ' ' }, storage, { accountId: 'acc-1' })).rejects.toThrow(ValidationError);
  });

  it('nothing on the timeline: nothing to freeze', async () => {
    keys = [3];
    const f: any = await freezePlanBaseline({ projectKey: 'TEST', name: 'Empty' }, storage, { accountId: 'acc-1' });
    expect(f).toMatchObject({ ok: false, error: 'empty' });
  });

  it('the scope delta against the current plan, then a request, its approval as a new version, and a version comparison', async () => {
    const f: any = await freezePlanBaseline({ projectKey: 'TEST', name: 'Sprint 7' }, storage, { accountId: 'acc-1' });
    // The plan grows: TEST-3 is scheduled (12 h), TEST-2 ends 3 days later.
    await storage.set('cp:TEST:we:3', { issueKey: 'TEST-3', issueId: '3', version: 1, effort: { workEffortId: 'TEST-3', estimatedStartDate: s0, estimatedCompletionDate: add(s0, 1) }, grid: { startWeek: weeks[5].weekKey, spanWeeks: 1 } });
    const v2 = (await getProjectPlan('TEST', storage)).tasks.find(t => t.key === 'TEST-2')!.version;
    await updateWbsTask({ projectKey: 'TEST', taskId: 'TEST-2', updates: { startDate: s0, endDate: add(s0, 7) }, expectedVersion: v2 }, storage);
    const r: any = await getScopeCreepReport({ projectKey: 'TEST' }, storage);
    expect(r.intact).toBe(true);
    expect(r.comparison.added.map((i: any) => i.key)).toEqual(['TEST-3']);
    expect(r.comparison.changed).toEqual([{ id: '2', key: 'TEST-2', fromEnd: add(s0, 4), toEnd: add(s0, 7) }]);
    expect(r.comparison).toMatchObject({ deltaHours: 12, slipped: 1, grew: true });
    expect(r.summaries['TEST-3']).toBe('T3');

    const req: any = await requestScopeShift({ projectKey: 'TEST', reason: 'Customer asked for T3' }, storage, { accountId: 'acc-2' });
    expect(req.request).toMatchObject({ status: 'PENDING', requestedBy: 'acc-2', summary: { added: 1, removed: 0, changed: 1, deltaHours: 12 } });
    expect((await reviewScopeShift({ projectKey: 'TEST', shiftId: req.request.id, status: 'APPROVED' }, storage, { accountId: 'acc-2' })).error).toContain('person who made it');
    const ok: any = await reviewScopeShift({ projectKey: 'TEST', shiftId: req.request.id, status: 'APPROVED', comment: 'fine' }, storage, { accountId: 'acc-1' });
    expect(ok.request).toMatchObject({ status: 'APPROVED', reviewedBy: 'acc-1', comment: 'fine' });
    const l: any = await getPlanBaselines({ projectKey: 'TEST' }, storage);
    expect(l.active).toBe(ok.request.newBaselineId);
    expect(l.baselines.map((b: any) => b.name)).toEqual(['Sprint 7 (version 2)', 'Sprint 7']);
    expect(l.shifts[0]).toMatchObject({ requestedByName: 'Bo Chen', reviewedByName: 'Ann Lee' });
    // The new version matches the plan; the comparison of the two versions shows the change.
    expect((await getScopeCreepReport({ projectKey: 'TEST' }, storage)).comparison.grew).toBe(false);
    const c: any = await compareBaselines({ projectKey: 'TEST', fromId: f.baseline.id, toId: ok.request.newBaselineId }, storage);
    expect(c.comparison.added.map((i: any) => i.key)).toEqual(['TEST-3']);
    // Set the old version active again.
    expect(await setActiveBaseline({ projectKey: 'TEST', baselineId: f.baseline.id }, storage)).toMatchObject({ ok: true });
    expect((await getPlanBaselines({ projectKey: 'TEST' }, storage)).active).toBe(f.baseline.id);
    expect(await setActiveBaseline({ projectKey: 'TEST', baselineId: 'nope' }, storage)).toMatchObject({ ok: false });
  });

  it('a request with no change is refused; a plan with no baseline gives a plain message', async () => {
    expect(await getScopeCreepReport({ projectKey: 'TEST' }, storage)).toMatchObject({ ok: false, error: 'no_baseline' });
    expect(await requestScopeShift({ projectKey: 'TEST', reason: 'x' }, storage, { accountId: 'acc-2' })).toMatchObject({ ok: false, error: 'no_baseline' });
    await freezePlanBaseline({ projectKey: 'TEST', name: 'B' }, storage, { accountId: 'acc-1' });
    expect(await requestScopeShift({ projectKey: 'TEST', reason: 'x' }, storage, { accountId: 'acc-2' })).toMatchObject({ ok: false, error: 'no_change' });
    await expect(requestScopeShift({ projectKey: 'TEST', reason: '' }, storage, { accountId: 'acc-2' })).rejects.toThrow(ValidationError);
  });

  it('export gives CSV and JSON with the digest', async () => {
    const f: any = await freezePlanBaseline({ projectKey: 'TEST', name: 'B' }, storage, { accountId: 'acc-1' });
    const e: any = await exportBaseline({ projectKey: 'TEST', baselineId: f.baseline.id }, storage);
    expect(e).toMatchObject({ ok: true, intact: true, header: { digest: f.baseline.digest } });
    expect(e.items.map((i: any) => i.key)).toEqual(['TEST-1', 'TEST-2']);
    expect(e.csv).toContain(`SHA-256 ${f.baseline.digest}`);
    expect(e.csv).toContain('1,TEST-1,4,');
  });

  it('a baseline of a scenario plan is deleted with the plan', async () => {
    const b = await createProjectPlan({ projectKey: 'TEST', name: 'Plan B', cloneFromPlanId: 'default' }, storage);
    await freezePlanBaseline({ projectKey: 'TEST', planId: b.plan.id, name: 'B' }, storage, { accountId: 'acc-1' });
    expect([...storage.store.keys()].some(k => k.startsWith(`cp:TEST:bl:${b.plan.id}:`))).toBe(true);
    await deleteProjectPlan({ projectKey: 'TEST', planId: b.plan.id }, storage);
    expect([...storage.store.keys()].some(k => k.includes(b.plan.id))).toBe(false);
  });

  it('personal data: every stored account id is reported; a closed account is erased from its records, and the digest still holds', async () => {
    const f: any = await freezePlanBaseline({ projectKey: 'TEST', name: 'B' }, storage, { accountId: 'acc-1' });
    const reported: any[] = [];
    const res = await reportPersonalData(storage, async accounts => { reported.push(...accounts); return [{ accountId: 'acc-1', status: 'closed' }]; });
    expect(reported.map(a => a.accountId)).toEqual(['acc-1']);
    expect(res).toMatchObject({ status: 'done', reported: 1, closed: ['acc-1'] });
    expect((await new BaselineStore(storage, 'TEST', 'default').header(f.baseline.id))!.frozenBy).toBeNull();
    expect(storage.store.get(ACCOUNTS_KEY)).toEqual({});
    const l: any = await getPlanBaselines({ projectKey: 'TEST' }, storage);
    expect(l.activeIntact).toBe(true);
    expect(l.baselines[0].frozenByName).toBe('a deleted user');
    // Within 7 days of the last report nothing is reported again.
    expect(await reportPersonalData(storage, async () => [])).toMatchObject({ status: 'waiting', reported: 0, closed: [] });
  });

  it('personal data: contributors named in plan records are reported too, and a closed one is removed from its records', async () => {
    const store = new PlanStore(storage, 'TEST', 'TEST');
    await store.putEntry('TEST-1', '1', { contributors: [{ accountId: 'acc-9', subtaskKey: 'TEST-77', since: '2026-10-01' }, { accountId: 'acc-8', subtaskKey: 'TEST-78' }] } as any);
    // A copy of the record in another plan, written outside putEntry, is found as well.
    await storage.set('cp:TEST:plan:p2:we:1', storage.store.get('cp:TEST:we:1'));
    const reported: any[] = [];
    const res = await reportPersonalData(storage, async accounts => { reported.push(...accounts); return [{ accountId: 'acc-9', status: 'closed' }]; });
    expect(reported.map(a => a.accountId).sort()).toEqual(['acc-8', 'acc-9']);
    expect(reported.find(a => a.accountId === 'acc-9').updatedAt).toBe('2026-10-01T00:00:00.000Z');
    expect(res).toMatchObject({ reported: 2, closed: ['acc-9'] });
    for (const key of ['cp:TEST:we:1', 'cp:TEST:plan:p2:we:1']) {
      const parties = (storage.store.get(key) as any).parties;
      expect(parties.map((p: any) => p.partyId)).toEqual([undefined, 'acc-8']);
      expect(parties[0].subtaskKey).toBe('TEST-77');
    }
    // The next report (a new cycle, 7 days later) no longer names the closed account.
    const again: any[] = [];
    await reportPersonalData(storage, async accounts => { again.push(...accounts); return []; }, { now: () => Date.now() + 8 * 24 * 3600 * 1000 });
    expect(again.map(a => a.accountId)).toEqual(['acc-8']);
  });
});
