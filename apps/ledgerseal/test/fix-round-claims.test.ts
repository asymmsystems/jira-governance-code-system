/**
 * Copyright (c) 2026 Asymm Systems. All rights reserved.
 *
 * LedgerSeal: the claim keys of fix round 1 (review H-1 and H-2), one rule at a time: the run lock and its
 * take-over, and the series, lock, answer, failure and request claims of code signing.
 *
 * @author Fahim Farook
 */
import { DECLARATION } from '../src/domain/declaration';
import { rejectStage, signStage, verifyIssue } from '../src/index';
import { LedgerSealDeps } from '../src/service/ledger';
import { bindRouteFlow, openStageFor, RUN_BUSY_MESSAGE, saveRouteFlow, voidRunIfChanged, withRunLock } from '../src/service/routes';
import { RouteRepository, RUN_LOCK_STALE_MS } from '../src/storage/route-repository';
import { SigningRepository } from '../src/storage/signing-repository';
import { FakeJira, MemoryStore, panelContext, sampleIssue } from './support/fakes';

jest.mock('@forge/api', () => ({ __esModule: true, default: {}, route: () => '', privacy: { reportPersonalData: jest.fn() } }));
jest.mock('@forge/kvs', () => ({ kvs: {}, WhereConditions: {} }));

beforeEach(() => {
  for (const level of ['error', 'warn', 'log', 'info'] as const) jest.spyOn(console, level).mockImplementation(() => undefined);
});
afterEach(() => jest.restoreAllMocks());

describe('run lock (review H-1)', () => {
  it('is created once, released only by its owner, and taken over by exactly one caller when stale', async () => {
    const store = new MemoryStore();
    const repo = new RouteRepository(store);
    const now = Date.now();
    expect(await repo.acquireRunLock('10001', 'a', now)).toBe(true);
    expect(await repo.acquireRunLock('10001', 'b', now + 1000)).toBe(false);
    await repo.releaseRunLock('10001', 'b');
    expect(store.map.get('ls3:runlock:10001').owner).toBe('a');
    // Stale: two callers race to take it over, one wins
    const later = now + RUN_LOCK_STALE_MS + 1;
    const [b, c] = await Promise.all([repo.acquireRunLock('10001', 'b', later), repo.acquireRunLock('10001', 'c', later)]);
    expect([b, c].filter(Boolean)).toHaveLength(1);
    const winner = b ? 'b' : 'c';
    expect(store.map.get('ls3:runlock:10001').owner).toBe(winner);
    // The old owner's late release leaves the new lock alone
    await repo.releaseRunLock('10001', 'a');
    expect(store.map.get('ls3:runlock:10001').owner).toBe(winner);
    await repo.releaseRunLock('10001', winner);
    expect(store.map.has('ls3:runlock:10001')).toBe(false);
  });

  it('creates the lock when it was released between the claim and the read', async () => {
    const store = new MemoryStore();
    const repo = new RouteRepository(store);
    await store.createIfAbsent('ls3:runlock:10001', { owner: 'x', at: Date.now() });
    const get = store.get.bind(store);
    jest.spyOn(store, 'get').mockImplementationOnce(async (key: string) => {
      store.map.delete('ls3:runlock:10001');
      return get(key);
    });
    expect(await repo.acquireRunLock('10001', 'y', Date.now())).toBe(true);
    expect(store.map.get('ls3:runlock:10001').owner).toBe('y');
  });

  it('answers busy after its tries, runs a nested call at once, and releases the lock when the work throws', async () => {
    const store = new MemoryStore();
    const deps: LedgerSealDeps = { jira: new FakeJira(sampleIssue()), storage: store, secrets: store };
    jest.spyOn(global, 'setTimeout').mockImplementation(((fn: () => void) => {
      fn();
      return 0;
    }) as any);
    await store.createIfAbsent('ls3:runlock:10001', { owner: 'other', at: Date.now() });
    expect(await withRunLock(deps, '10001', async () => 'ran')).toBe('busy');
    expect(RUN_BUSY_MESSAGE).toMatch(/Try again/);
    store.map.delete('ls3:runlock:10001');
    const nested = await withRunLock(deps, '10001', locked => withRunLock(locked, '10001', async () => 'inner'));
    expect(nested).toBe('inner');
    await expect(withRunLock(deps, '10001', async () => Promise.reject(new Error('boom')))).rejects.toThrow('boom');
    expect(store.map.has('ls3:runlock:10001')).toBe(false);
  });
});

describe('code signing claims (review H-2)', () => {
  it('derives the series and the lock from create-once keys, and never clears a lock by a state save', async () => {
    const store = new MemoryStore();
    const repo = new SigningRepository(store, store);
    expect(await repo.getState('pty_a')).toEqual({ partyId: 'pty_a', series: 1, locked: false, lockedAt: null, lastRequestAt: null });
    await repo.saveState({ partyId: 'pty_a', series: 1, locked: true, lockedAt: null, lastRequestAt: null });
    const locked = await repo.getState('pty_a');
    expect(locked.locked).toBe(true);
    expect(typeof locked.lockedAt).toBe('string');
    await repo.saveState({ ...locked, locked: false, lastRequestAt: '2026-11-08T00:00:00.000Z' });
    expect((await repo.getState('pty_a')).locked).toBe(true);
    // An unlock (or a success) starts the next series once; the lock stays on series 1 as a record
    const [x, y] = await Promise.all([repo.advanceSeries('pty_a', 1, 't'), repo.advanceSeries('pty_a', 1, 't')]);
    expect([x, y].filter(Boolean)).toHaveLength(1);
    expect(await repo.getState('pty_a')).toMatchObject({ series: 2, locked: false, lastRequestAt: '2026-11-08T00:00:00.000Z' });
    expect(await repo.lockOf('pty_a', 1)).toEqual({ at: expect.any(String) });
    // The series hint can lag: the series keys decide
    store.map.set('ls3:sig:state:pty_a', { partyId: 'pty_a', series: 1 });
    expect(await repo.currentSeries('pty_a')).toBe(2);
  });

  it('lists only the people whose current series is locked', async () => {
    const store = new MemoryStore();
    const repo = new SigningRepository(store, store);
    await repo.lock('pty_a', 1, 't1');
    await repo.lock('pty_b', 1, 't2');
    await repo.advanceSeries('pty_b', 1, 't3');
    store.map.set('ls3:sig:lock:malformed', { at: 'x' });
    store.map.set('ls3:sig:lock:pty_c:1', {});
    expect(await repo.lockedStates()).toEqual([
      { partyId: 'pty_a', series: 1, locked: true, lockedAt: 't1', lastRequestAt: null },
      { partyId: 'pty_c', series: 1, locked: true, lockedAt: null, lastRequestAt: null }
    ]);
  });

  it('gives out at most 3 answer slots per request and threshold failure slots per series, under Promise.all', async () => {
    const store = new MemoryStore();
    const repo = new SigningRepository(store, store);
    const answers = await Promise.all(Array.from({ length: 10 }, () => repo.claimAttempt('chal', 't')));
    expect(answers.filter(n => n !== null).sort()).toEqual([1, 2, 3]);
    const fails = await Promise.all(Array.from({ length: 10 }, () => repo.claimFailureSlot('pty_a', 1, 5, 't', '10001')));
    expect(fails.filter(n => n !== null).sort()).toEqual([1, 2, 3, 4, 5]);
    await repo.releaseFailureSlot('pty_a', 1, 3);
    expect(await repo.claimFailureSlot('pty_a', 1, 5, 't', null)).toBe(3);
  });

  it('refuses a second request less than 30 seconds later, gives back a loser\'s slots, and allows one 35 seconds later', async () => {
    const store = new MemoryStore();
    const repo = new SigningRepository(store, store);
    const t0 = 1_000_004_900; // near the end of a 5-second slot
    expect(await repo.claimRequestSlot('pty_a', t0, 'a')).toBe(true);
    expect(await repo.claimRequestSlot('pty_a', t0 + 29_999, 'b')).toBe(false);
    const before = [...store.map.keys()].filter(k => k.startsWith('ls3:sig:reqslot:')).length;
    expect(before).toBe(7);
    expect(await repo.claimRequestSlot('pty_a', t0 + 35_000, 'c')).toBe(true);
    // A later request that collides part-way gives back what it took
    const store2 = new MemoryStore();
    const repo2 = new SigningRepository(store2, store2);
    expect(await repo2.claimRequestSlot('pty_a', 1_000_020_000, 'x')).toBe(true);
    expect(await repo2.claimRequestSlot('pty_a', 1_000_000_000, 'y')).toBe(false);
    const left = [...store2.map.keys()].filter(k => k.startsWith('ls3:sig:reqslot:')).map(k => Number(k.split(':').pop()));
    expect(Math.min(...left)).toBe(Math.floor(1_000_020_000 / 5000));
  });

  it('reads a stored policy version by number', async () => {
    const store = new MemoryStore();
    const repo = new SigningRepository(store, store);
    expect(await repo.getPolicyVersion(1)).toBeNull();
    store.map.set('ls3:sig:policyver:000001', { version: 1 });
    expect(await repo.getPolicyVersion(1)).toEqual({ version: 1 });
  });
});

describe('route flows under the run lock (review H-1)', () => {
  const V1 = { meaning: 'APPROVAL', declarationVersion: DECLARATION.version, declarationText: DECLARATION.text, reason: 'ok' };
  const STAGES = [
    { stageId: 'qa', name: 'QA', orderGroup: 1, roleTypeId: 'LS_REVIEWER', approverGroupIds: ['g-qa'], quorum: { kind: 'N', n: 2 }, gatesStatusIds: [] },
    { stageId: 'reg', name: 'Regulatory', orderGroup: 2, roleTypeId: 'LS_APPROVER', approverGroupIds: ['g-reg'], quorum: 'ANY', gatesStatusIds: [] }
  ];
  async function routed() {
    const jira = new FakeJira(sampleIssue());
    const storage = new MemoryStore();
    const deps: LedgerSealDeps = { jira, storage, secrets: storage };
    jira.jiraAdmins.add('admin');
    jira.siteGroups = [{ groupId: 'g-qa', name: 'qa' }, { groupId: 'g-reg', name: 'reg' }];
    jira.memberships = { qa1: ['g-qa'], qa2: ['g-qa'], qa3: ['g-qa'], reg1: ['g-reg'] };
    jira.currentUser = 'admin';
    const saved: any = await saveRouteFlow({ name: 'R', stages: STAGES }, panelContext('admin'), deps);
    await bindRouteFlow({ projectKey: 'CHG', issueTypeId: '*', routeId: saved.route.routeId }, panelContext('admin'), deps);
    /** Each flow sees the fake Jira as its own user, so parallel flows do not share the current user. */
    const as = (who: string): LedgerSealDeps => ({
      ...deps,
      jira: new Proxy(jira, { get: (t: any, p) => (typeof t[p] === 'function' ? (...args: unknown[]) => { t.currentUser = who; return t[p](...args); } : t[p]) })
    });
    const view = async (who: string) => ((await verifyIssue({}, panelContext(who), as(who))) as any).viewHash;
    return { jira, storage, deps, as, view };
  }

  it('lets exactly two of three parallel QA signers in (quorum 2), and the third finds the stage closed under the lock', async () => {
    const { storage, as, view } = await routed();
    expect(((await signStage({ stageId: 'qa', viewHash: await view('qa1'), signature: V1 }, panelContext('qa1'), as('qa1'))) as any).ok).toBe(true);
    const hashes = await Promise.all(['qa2', 'qa3'].map(view));
    const [a, b]: any[] = await Promise.all(
      ['qa2', 'qa3'].map((who, i) => signStage({ stageId: 'qa', viewHash: hashes[i], signature: V1 }, panelContext(who), as(who)))
    );
    expect([a.ok, b.ok].filter(Boolean)).toHaveLength(1);
    expect([a.code, b.code]).toContain('STAGE_NOT_OPEN');
    const run: any = await new RouteRepository(storage).run('10001');
    expect(run.signatures.map((s: any) => s.stageId)).toEqual(['qa', 'qa']);
  });

  it('answers CONFLICT with the busy message when the lock stays taken, for a signature and a rejection', async () => {
    const { storage, as, view } = await routed();
    jest.spyOn(global, 'setTimeout').mockImplementation(((fn: () => void) => {
      fn();
      return 0;
    }) as any);
    await storage.createIfAbsent('ls3:runlock:10001', { owner: 'other', at: Date.now() });
    const signed: any = await signStage({ stageId: 'qa', viewHash: await view('qa1'), signature: V1 }, panelContext('qa1'), as('qa1'));
    expect(signed).toMatchObject({ ok: false, code: 'CONFLICT', message: RUN_BUSY_MESSAGE });
    const rejected: any = await rejectStage({ stageId: 'qa', viewHash: await view('qa1'), reason: 'no' }, panelContext('qa1'), as('qa1'));
    expect(rejected).toMatchObject({ ok: false, code: 'CONFLICT', message: RUN_BUSY_MESSAGE });
    expect(await new RouteRepository(storage).run('10001')).toBeNull();
  });

  it('voids a changed run once when two readers see the change at the same moment', async () => {
    const { jira, storage, deps, as, view } = await routed();
    expect(((await signStage({ stageId: 'qa', viewHash: await view('qa1'), signature: V1 }, panelContext('qa1'), as('qa1'))) as any).ok).toBe(true);
    jira.issue.fields.summary = 'changed';
    const results = await Promise.all([verifyIssue({}, panelContext('qa2'), as('qa2')), verifyIssue({}, panelContext('qa3'), as('qa3'))]);
    expect(results.every((r: any) => r.status)).toBe(true);
    const voids = [...storage.map.entries()].filter(([k, v]) => k.startsWith('ls3:wes:10001:') && (v as any).statusId === 'LS_RUN_VOIDED');
    expect(voids).toHaveLength(1);
    expect(await voidRunIfChanged(deps, '10001', { snapshot: {} } as any, new Date().toISOString())).toBe(false);
  });

  it('names the open stage for a code request, or says why not', async () => {
    const { jira, deps, as, view } = await routed();
    expect(await openStageFor(deps, '10001', 'reg')).toBe('closed');
    expect(((await openStageFor(deps, '10001', 'qa')) as any).stageId).toBe('qa');
    expect(((await signStage({ stageId: 'qa', viewHash: await view('qa1'), signature: V1 }, panelContext('qa1'), as('qa1'))) as any).ok).toBe(true);
    expect(((await openStageFor(deps, '10001', 'qa')) as any).stageId).toBe('qa');
    jira.failScope = true;
    expect(await openStageFor({ ...deps, storage: new MemoryStore() }, '10001', 'qa')).toBeNull();
    const bound = new MemoryStore();
    await bound.set('ls3:routebind:100:all', { routeId: 'rte_x', projectId: '100', issueTypeId: '*' });
    expect(await openStageFor({ ...deps, storage: bound }, '10001', 'qa')).toBe('unreachable');
  });
});
