/*
 * Copyright (c) 2026 Asymm Systems. All rights reserved.
 *
 * @author Fahim Farook
 */

/**
 * CascadePlan: the personal data job (merge review H1 and M2). Every account id the app stores is
 * reported (the approver policy's saver too), at most once in 7 days, closed ones are erased from every
 * record, and the work runs in pages across runs within a time budget, with its progress kept.
 */

import * as fs from 'fs';
import * as path from 'path';

let mockAsUserRequest = jest.fn();
const mockKvsQuery: any = { where: jest.fn(), limit: jest.fn(), cursor: jest.fn(), getMany: jest.fn() };
jest.mock('@forge/api', () => ({
  __esModule: true,
  default: { asUser: () => ({ requestJira: (...a: any[]) => mockAsUserRequest(...a) }), asApp: () => ({ requestJira: jest.fn() }) },
  route: (s: TemplateStringsArray, ...v: any[]) => s.reduce((acc, str, i) => acc + str + (v[i] !== undefined ? v[i] : ''), ''),
  privacy: { reportPersonalData: jest.fn(async () => []) }
}));
jest.mock('@forge/kvs', () => ({
  kvs: { get: jest.fn(), set: jest.fn(), delete: jest.fn(), query: () => mockKvsQuery },
  WhereConditions: { beginsWith: (p: string) => ({ beginsWith: p }) }
}));

import { MemStorage } from './helpers/mem-storage';
import { PlanStore } from '../src/storage/plan-store';
import { BaselineStore, ACCOUNTS_KEY } from '../src/storage/baseline-store';
import { PolicyRepository, APPROVER_POLICY_KEY, LEGACY_APPROVER_POLICY_KEY } from '../src/storage/policy-repository';
import { setApproverPolicyFlow } from '../src/security/policy-admin';
import { reportPersonalData, personalDataTrigger, ForgeKvsProvider, setGlobalStorageProvider } from '../src/index';
import {
  runPersonalDataJob, accountIdsIn, eraseAccountsIn, pageOf, isAccountId, PD_STATE_KEY, PD_FOUND_PREFIX, CYCLE_MS, ReportFn
} from '../src/storage/personal-data';

const T0 = Date.parse('2026-11-06T10:00:00Z');

/** A report function that records every call and answers the given ids as closed. */
function recorder(closed: string[] = []): { fn: ReportFn; calls: string[][] } {
  const calls: string[][] = [];
  return { calls, fn: async accounts => { calls.push(accounts.map(a => a.accountId)); return accounts.filter(a => closed.includes(a.accountId)).map(a => ({ accountId: a.accountId, status: 'closed' })); } };
}

/** Runs the job until it is done (each run has a fresh budget), as the hourly trigger does. */
async function runUntilDone(storage: MemStorage, report: ReportFn, at = T0, opts: any = {}): Promise<number> {
  let runs = 0;
  let t = at;
  for (; runs < 500; runs++) {
    const r = await runPersonalDataJob(storage, report, { now: () => t, ...opts });
    t += 3600 * 1000;
    if (r.status === 'done') return runs + 1;
    if (r.status === 'waiting') return runs;
  }
  throw new Error('the job did not finish');
}

let storage: MemStorage;
beforeEach(() => {
  storage = new MemStorage();
  setGlobalStorageProvider(storage);
  mockAsUserRequest = jest.fn();
});

describe('H1: the approver policy saver is a stored account id', () => {
  async function savePolicy(): Promise<void> {
    mockAsUserRequest
      .mockResolvedValueOnce({ status: 200, json: async () => ({ permissions: { ADMINISTER: { havePermission: true } } }) })
      .mockResolvedValueOnce({ status: 200, json: async () => ({ values: [{ groupId: 'g1', name: 'Delivery Leads' }] }) });
    const res = await setApproverPolicyFlow({ groupIds: ['g1'] }, storage, { accountId: '712020:admin-user' });
    expect(res.ok).toBe(true);
  }

  it('is reported, and the group id of the policy is not', async () => {
    await savePolicy();
    const rec = recorder();
    await runUntilDone(storage, rec.fn);
    expect(rec.calls.flat()).toEqual(['712020:admin-user']);
  });

  it('is removed from the policy (and from the legacy policy) when the account is closed; the groups stay', async () => {
    await savePolicy();
    await storage.set(LEGACY_APPROVER_POLICY_KEY, { roleTypeId: 'PS_APPROVER', parties: [{ partyId: 'g0', partyTypeId: 'GROUP', name: 'Old' }], fromDate: '2026-01-01', setByPartyId: '712020:admin-user' });
    await runUntilDone(storage, recorder(['712020:admin-user']).fn);
    for (const key of [APPROVER_POLICY_KEY, LEGACY_APPROVER_POLICY_KEY]) {
      const p: any = storage.store.get(key);
      expect(p.setByPartyId).toBeUndefined();
      expect(p.parties.length).toBe(1);
    }
    expect((await new PolicyRepository(storage).getApproverPolicy())!.parties[0].partyId).toBe('g1');
  });

  it('a save without a caller stores no stand-in id', async () => {
    mockAsUserRequest
      .mockResolvedValueOnce({ status: 200, json: async () => ({ permissions: { ADMINISTER: { havePermission: true } } }) })
      .mockResolvedValueOnce({ status: 500, json: async () => ({}) });
    const res = await setApproverPolicyFlow({ groupIds: ['g1'] }, storage, {});
    expect(res.policy.setByPartyId).toBeUndefined();
  });
});

describe('every stored account id is covered', () => {
  async function seedEveryForm(): Promise<void> {
    // Baseline header (frozenBy) and scope-change request (requestedBy, reviewedBy), through the store.
    const bl = new BaselineStore(storage, 'TEST', 'default');
    await bl.save({ id: 'b1', name: 'B', frozenAt: '2026-10-01T00:00:00.000Z', frozenBy: 'acc-freezer', items: [] });
    await bl.saveShift({ id: 's1', planId: 'default', baselineId: 'b1', requestedBy: 'acc-requester', requestedAt: '2026-10-02T00:00:00.000Z', reason: 'r',
      status: 'APPROVED', reviewedBy: 'acc-reviewer', reviewedAt: '2026-10-03T00:00:00.000Z', summary: { added: 0, removed: 0, changed: 0, deltaHours: 0 }, v: 1 } as any);
    // A plan record's contributor (parties[].partyId), in two plans.
    await new PlanStore(storage, 'TEST', 'TEST').putEntry('TEST-1', '1', { contributors: [{ accountId: 'acc-contrib', subtaskKey: 'TEST-9', since: '2026-10-04' }] } as any);
    await storage.set('cp:TEST:plan:p2:we:1', storage.store.get('cp:TEST:we:1'));
    // The approver policy's saver.
    await storage.set(APPROVER_POLICY_KEY, { roleTypeId: 'CP_APPROVER', parties: [{ partyId: 'group-1', partyTypeId: 'GROUP', name: 'G' }], fromDate: '2026-10-05T00:00:00.000Z', setByPartyId: 'acc-admin' });
    // Records of builds before November 2026 that a project has not opened since.
    await storage.set('scheduleMap:OLD', { 'OLD-1': { resourceAccountId: 'acc-legacy-res', contributors: [{ accountId: 'acc-legacy-contrib' }] },
      'OLD-2': { resourceAccountId: 'unassigned' }, 'OLD-3': { resourceAccountId: 'ph:designer' } });
    await storage.set('ps:shifts:OLD:default', [{ id: 'x', requestedBy: 'acc-legacy-req', reviewedBy: 'system' }, { id: 'y', requestedBy: 'anonymous' }]);
    await storage.set('ps:baseline:OLD:default:1', { frozenBy: 'system' });
  }
  const ALL = ['acc-admin', 'acc-contrib', 'acc-freezer', 'acc-legacy-contrib', 'acc-legacy-req', 'acc-legacy-res', 'acc-requester', 'acc-reviewer'];

  it('the scan finds exactly the stored ids: no group id, placeholder or stand-in text', async () => {
    await seedEveryForm();
    const rec = recorder();
    await runUntilDone(storage, rec.fn);
    expect(rec.calls.flat().sort()).toEqual(ALL);
  });

  it('a closed account is named in no record afterwards; the contributor keeps its sub-task; audit fields are null', async () => {
    await seedEveryForm();
    await runUntilDone(storage, recorder(ALL).fn);
    const dump = JSON.stringify([...storage.store.entries()]);
    for (const id of ALL) expect(dump.includes(id)).toBe(false);
    const rec: any = storage.store.get('cp:TEST:we:1');
    expect(rec.parties[0]).toMatchObject({ subtaskKey: 'TEST-9' });
    expect(rec.parties[0].partyId).toBeUndefined();
    const h: any = await new BaselineStore(storage, 'TEST', 'default').header('b1');
    expect(h.frozenBy).toBeNull();
    expect(storage.store.get(ACCOUNTS_KEY)).toEqual({});
    expect((storage.store.get(APPROVER_POLICY_KEY) as any).parties[0].partyId).toBe('group-1');
  });

  it('an erased plan record gets a new version, so a write from an older read is refused, not lost', async () => {
    const store = new PlanStore(storage, 'TEST', 'TEST');
    await store.putEntry('TEST-1', '1', { contributors: [{ accountId: 'acc-x', subtaskKey: 'TEST-9' }] } as any);
    const before = (storage.store.get('cp:TEST:we:1') as any).version;
    await runUntilDone(storage, recorder(['acc-x']).fn);
    expect((storage.store.get('cp:TEST:we:1') as any).version).toBe(before + 1);
    const put = await store.putEntry('TEST-1', '1', { contributors: [{ accountId: 'acc-x', subtaskKey: 'TEST-9' }] } as any, before);
    expect(put.ok).toBe(false);
  });

  it('the update time is the latest the records give, else the index time', () => {
    const ids = accountIdsIn([{ partyId: 'a', fromDate: '2026-10-01' }, { partyId: 'a', fromDate: '2026-10-09' }, { frozenBy: 'b' }]);
    expect(ids.get('a')).toBe('2026-10-09T00:00:00.000Z');
    expect(ids.get('b')).toBeUndefined();
    expect(isAccountId('ph:x')).toBe(false);
    expect(isAccountId('557058:1f2e')).toBe(true);
    expect(isAccountId(42)).toBe(false);
    expect(eraseAccountsIn('text', new Set(['a']))).toEqual({ value: 'text', changed: false });
  });
});

describe('M2: the job runs in pages across runs, within a time budget, and keeps its progress', () => {
  async function seedContributors(n: number): Promise<void> {
    for (let i = 0; i < n; i++) {
      await storage.set(`cp:BIG:we:${String(i).padStart(5, '0')}`, { version: 1, parties: [{ partyId: `acc-${i % 400}`, fromDate: '2026-10-01', subtaskKey: `BIG-${i}` }] });
    }
  }

  it('1,050 records and 400 people: several runs, each inside its budget; every id reported exactly once', async () => {
    await seedContributors(1050);
    const rec = recorder();
    let t = T0;
    // Each clock read moves 1 s: a 5 s budget allows only a few pages per run.
    const clock = () => (t += 1000);
    let runs = 0;
    let last: any;
    do {
      last = await runPersonalDataJob(storage, rec.fn, { now: clock, budgetMs: 5000 });
      runs++;
      expect(last.pages).toBeLessThanOrEqual(6);
      // The progress is saved and no run holds the job when it ends.
      expect((storage.store.get(PD_STATE_KEY) as any).leaseUntil).toBeUndefined();
    } while (last.status === 'progress' && runs < 200);
    expect(last.status).toBe('done');
    expect(runs).toBeGreaterThan(3);
    const all = rec.calls.flat();
    expect(all.length).toBe(400);
    expect(new Set(all).size).toBe(400);
    expect(Math.max(...rec.calls.map(c => c.length))).toBeLessThanOrEqual(90);
    expect([...storage.store.keys()].some(k => k.startsWith(PD_FOUND_PREFIX))).toBe(false);
  });

  it('no id is reported again within 7 days of the last report; after that a new cycle reports it again', async () => {
    await seedContributors(3);
    const rec = recorder();
    await runUntilDone(storage, rec.fn, T0);
    expect(rec.calls.flat().length).toBe(3);
    const reportedAt = Date.parse((storage.store.get(PD_STATE_KEY) as any).reportedAt);
    const waiting = await runPersonalDataJob(storage, rec.fn, { now: () => reportedAt + CYCLE_MS - 1000 });
    expect(waiting.status).toBe('waiting');
    expect(rec.calls.flat().length).toBe(3);
    await runUntilDone(storage, rec.fn, reportedAt + CYCLE_MS);
    expect(rec.calls.flat().length).toBe(6);
  });

  it('a report that fails stops the run with its progress saved; the next run reports only the rest', async () => {
    await seedContributors(200);
    const calls: string[][] = [];
    let fail = true;
    const flaky: ReportFn = async a => {
      if (calls.length === 1 && fail) { fail = false; throw new Error('429'); }
      calls.push(a.map(x => x.accountId));
      return [];
    };
    let t = T0;
    await expect(runPersonalDataJob(storage, flaky, { now: () => t })).rejects.toThrow('429');
    expect((storage.store.get(PD_STATE_KEY) as any)).toMatchObject({ phase: 'report' });
    expect((storage.store.get(PD_STATE_KEY) as any).leaseUntil).toBeUndefined();
    t += 3600 * 1000;
    await runUntilDone(storage, flaky, t);
    const all = calls.flat();
    expect(all.length).toBe(200);
    expect(new Set(all).size).toBe(200);
  });

  it('a run that finds the job held by another run does nothing', async () => {
    await seedContributors(2);
    await storage.set(PD_STATE_KEY, { v: 1, phase: 'scan', cycle: new Date(T0).toISOString(), prefix: 0, closed: [], reported: 0, erased: 0, leaseUntil: T0 + 60000 });
    const rec = recorder();
    expect((await runPersonalDataJob(storage, rec.fn, { now: () => T0 })).status).toBe('busy');
    expect(rec.calls).toEqual([]);
  });

  it('a duplicated invocation that takes the lease first wins; the other gives way', async () => {
    await seedContributors(2);
    const rec = recorder();
    const racing = new MemStorage();
    racing.store = storage.store;
    // The other run takes the lease between this run's read and its own write.
    const swap = racing.swap.bind(racing);
    racing.swap = async (key: string, value: any) => {
      await storage.set(PD_STATE_KEY, { v: 1, phase: 'scan', cycle: new Date(T0).toISOString(), prefix: 0, closed: [], reported: 0, erased: 0, leaseUntil: T0 + 60000 });
      return swap(key, value);
    };
    expect((await runPersonalDataJob(racing, rec.fn, { now: () => T0 })).status).toBe('busy');
    expect((storage.store.get(PD_STATE_KEY) as any).leaseUntil).toBe(T0 + 60000);
  });

  it('an id noted in an earlier cycle and not found again is not reported', async () => {
    await storage.set(`${PD_FOUND_PREFIX}acc-gone`, { at: '2026-01-01T00:00:00.000Z', cycle: '2026-01-01T00:00:00.000Z' });
    await storage.set(PD_STATE_KEY, { v: 1, phase: 'report', cycle: new Date(T0).toISOString(), prefix: 0, closed: [], reported: 0, erased: 0 });
    const rec = recorder();
    await runUntilDone(storage, rec.fn);
    expect(rec.calls).toEqual([]);
    expect(storage.store.has(`${PD_FOUND_PREFIX}acc-gone`)).toBe(false);
  });

  it('a cursor that storage no longer accepts restarts that pass; other storage errors stop the run', async () => {
    await seedContributors(5);
    const paged = new MemStorage();
    paged.store = storage.store;
    let refuse = 1;
    (paged as any).queryPage = async (prefix: string, limit: number, cursor?: string) => {
      if (cursor && refuse-- > 0) throw new Error('cursor expired');
      return pageOf({ query: paged.query.bind(paged) } as any, prefix, limit, cursor);
    };
    const rec = recorder();
    let t = T0;
    for (let i = 0; i < 20; i++) {
      const r = await runPersonalDataJob(paged, rec.fn, { now: () => t, scanPage: 2 });
      t += 3600 * 1000;
      if (r.status === 'done') break;
    }
    expect(rec.calls.flat().sort()).toEqual(['acc-0', 'acc-1', 'acc-2', 'acc-3', 'acc-4']);
    const busy = new MemStorage();
    (busy as any).queryPage = async () => { const e = new Error('busy'); e.name = 'StorageBusyError'; throw e; };
    await expect(runPersonalDataJob(busy, rec.fn, { now: () => t })).rejects.toThrow('busy');
  });

  it('pageOf pages a full query by key when the provider has no paging of its own', async () => {
    for (const k of ['cp:c', 'cp:a', 'cp:b']) await storage.set(k, {});
    const p1 = await pageOf(storage, 'cp:', 2);
    expect(p1.results.map(r => r.key)).toEqual(['cp:a', 'cp:b']);
    const p2 = await pageOf(storage, 'cp:', 2, p1.nextCursor);
    expect(p2).toEqual({ results: [{ key: 'cp:c', value: {} }], nextCursor: undefined });
    expect((await pageOf(storage, 'cp:', 2, 'cp:z')).results).toEqual([]);
  });

  it('ForgeKvsProvider.queryPage asks Forge storage for one page from the cursor', async () => {
    mockKvsQuery.where.mockReturnValue(mockKvsQuery);
    mockKvsQuery.limit.mockReturnValue(mockKvsQuery);
    mockKvsQuery.cursor.mockReturnValue(mockKvsQuery);
    mockKvsQuery.getMany.mockResolvedValue({ results: [{ key: 'cp:a', value: 1 }], nextCursor: 'next' });
    const page = await new ForgeKvsProvider().queryPage('cp:', 100, 'c1');
    expect(page).toEqual({ results: [{ key: 'cp:a', value: 1 }], nextCursor: 'next' });
    expect(mockKvsQuery.limit).toHaveBeenCalledWith(100);
    expect(mockKvsQuery.cursor).toHaveBeenCalledWith('c1');
    mockKvsQuery.getMany.mockResolvedValue({ results: [] });
    expect((await new ForgeKvsProvider().queryPage('cp:', 100)).nextCursor).toBeUndefined();
  });

  it('the trigger logs one line per step with work, nothing while waiting, and catches a failure', async () => {
    const log = jest.spyOn(console, 'log').mockImplementation(() => undefined);
    const err = jest.spyOn(console, 'error').mockImplementation(() => undefined);
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
    await seedContributors(1);
    await personalDataTrigger();
    expect(log.mock.calls.flat().join(' ')).toMatch(/personal data report: done \(done\), 1 account\(s\) reported/);
    log.mockClear();
    await personalDataTrigger();
    expect(log).not.toHaveBeenCalled();
    storage.get = async () => { throw new Error('down'); };
    await expect(personalDataTrigger()).resolves.toBeUndefined();
    expect(await reportPersonalData(new MemStorage(), recorder().fn, { now: () => T0 })).toMatchObject({ status: 'done', reported: 0 });
    log.mockRestore(); err.mockRestore(); warn.mockRestore();
  });

  it('the manifest runs the trigger hourly with the 900 s function timeout Forge allows', () => {
    const manifest = fs.readFileSync(path.join(__dirname, '..', 'manifest.yml'), 'utf8');
    expect(manifest).toMatch(/- key: personal-data-report\n\s+function: personal-data-fn\n\s+interval: hour/);
    expect(manifest).toMatch(/- key: personal-data-fn\n\s+handler: index.personalDataTrigger\n(\s+#.*\n)*\s+timeoutSeconds: 900/);
  });

  it('after the erase pass the state keeps no closed id, only the count', async () => {
    await seedContributors(1);
    const rec = recorder(['acc-0']);
    await runUntilDone(storage, rec.fn);
    expect((storage.store.get(PD_STATE_KEY) as any)).toMatchObject({ phase: 'done', erased: 1, closed: [] });
  });
});
