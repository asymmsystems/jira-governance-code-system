/**
 * Copyright (c) 2026 Asymm Systems. All rights reserved.
 *
 * LedgerSeal: fix round 2 (review of f537067). The code is used only under the run lock and given back when nothing
 * is written (R2-2); a success and a lock decide a series once (R2-3); the run lock's take-over and fencing (R2-5);
 * the policy alert before the policy is in force (L-5); the open-alert index and a parallel acknowledgement (L-8);
 * the declaration on every stage signature and rejection, and in the evidence (D-1).
 *
 * @author Fahim Farook
 */
import * as declaration from '../src/domain/declaration';
import { DECLARATION, DECLARATION_REJECT, DECLARATION_V2 } from '../src/domain/declaration';
import { declarationHash } from '../src/domain/declaration-hash';
import { getSealEvidence, rejectStage, requestSigningCode, signStage, verifyIssue } from '../src/index';
import { LedgerSealDeps } from '../src/service/ledger';
import { bindRouteFlow, saveRouteFlow, stillHoldsRunLock, withRunLock } from '../src/service/routes';
import { setSigningPolicyFlow } from '../src/service/signing';
import { RouteRepository, RUN_LOCK_STALE_MS } from '../src/storage/route-repository';
import { SigningRepository } from '../src/storage/signing-repository';
import { FakeJira, MemoryStore, model, panelContext, sampleIssue } from './support/fakes';

jest.mock('@forge/api', () => ({ __esModule: true, default: {}, route: () => '', privacy: { reportPersonalData: jest.fn() } }));
jest.mock('@forge/kvs', () => ({ kvs: {}, WhereConditions: {} }));
beforeEach(() => {
  for (const level of ['error', 'warn', 'log', 'info'] as const) jest.spyOn(console, level).mockImplementation(() => undefined);
});
afterEach(() => jest.restoreAllMocks());

const STAGES = [
  { stageId: 'qa', name: 'QA', orderGroup: 1, roleTypeId: 'LS_REVIEWER', approverGroupIds: ['g-qa'], quorum: { kind: 'N', n: 2 }, gatesStatusIds: [] },
  { stageId: 'reg', name: 'Regulatory', orderGroup: 2, roleTypeId: 'LS_APPROVER', approverGroupIds: ['g-reg'], quorum: 'ANY', gatesStatusIds: [] }
];

async function routed(codeSigning: boolean) {
  jest.spyOn(declaration, 'isDeclarationV2Approved').mockReturnValue(true);
  const jira = new FakeJira(sampleIssue());
  const storage = new MemoryStore();
  const deps: LedgerSealDeps = { jira, storage, secrets: storage };
  jira.jiraAdmins.add('admin');
  jira.siteGroups = [{ groupId: 'g-qa', name: 'qa' }, { groupId: 'g-reg', name: 'reg' }];
  jira.memberships = { qa1: ['g-qa'], qa2: ['g-qa'], reg1: ['g-reg'] };
  jira.currentUser = 'admin';
  if (codeSigning) expect(((await setSigningPolicyFlow({ enabled: true, projectKeys: ['CHG'], lockoutThreshold: 5 }, panelContext('admin'), deps)) as any).ok).toBe(true);
  const saved: any = await saveRouteFlow({ name: 'R', stages: STAGES }, panelContext('admin'), deps);
  await bindRouteFlow({ projectKey: 'CHG', issueTypeId: '*', routeId: saved.route.routeId }, panelContext('admin'), deps);
  const decl = codeSigning ? DECLARATION_V2 : DECLARATION;
  const sig = { meaning: 'APPROVAL', declarationVersion: decl.version, declarationText: decl.text };
  const view = async (who: string) => {
    jira.currentUser = who;
    return ((await verifyIssue({}, panelContext(who), deps)) as any).viewHash;
  };
  const code = async (who: string, action: string, stageId: string) => {
    for (const key of [...storage.map.keys()]) if (key.startsWith('ls3:sig:reqslot:')) storage.map.delete(key);
    jira.currentUser = who;
    const req: any = await requestSigningCode({ action, stageId }, panelContext(who), deps);
    expect(req.ok).toBe(true);
    return { challengeId: req.challengeId, code: jira.lastCode(who) as string };
  };
  return { jira, storage, deps, sig, view, code };
}

const events = (storage: MemoryStore, kind: string) => [...storage.map.entries()].filter(([k, v]) => k.startsWith('ls3:sig:ev:') && (v as any).kind === kind).length;

describe('the code is used only for a signature that is written (R2-2)', () => {
  it('leaves the code unused when the run lock stays busy, then signs with the same code', async () => {
    const { storage, deps, sig, view, code } = await routed(true);
    const signing = await code('qa1', 'SIGN_STAGE', 'qa');
    const hash = await view('qa1');
    jest.spyOn(global, 'setTimeout').mockImplementation(((fn: () => void) => {
      fn();
      return 0;
    }) as any);
    await storage.createIfAbsent('ls3:runlock:10001', { owner: 'other', at: Date.now() });
    expect(((await signStage({ stageId: 'qa', viewHash: hash, signature: sig, signing }, panelContext('qa1'), deps)) as any).code).toBe('CONFLICT');
    expect(storage.map.has(`ls3:sig:used:${signing.challengeId}`)).toBe(false);
    expect(events(storage, 'SIGN_OK')).toBe(0);
    storage.map.delete('ls3:runlock:10001');
    expect(((await signStage({ stageId: 'qa', viewHash: hash, signature: sig, signing }, panelContext('qa1'), deps)) as any).ok).toBe(true);
    expect(events(storage, 'SIGN_OK')).toBe(1);
    const row = model.statusRows(storage).at(-1);
    expect(row.data).toMatchObject({ declarationVersion: '2', declarationHash: declarationHash(DECLARATION_V2.text), signing: { challengeId: signing.challengeId } });
  });

  it('gives the code back when the row cannot be written, and writes SIGN_OK only for a written row', async () => {
    const { storage, deps, sig, view, code } = await routed(true);
    const signing = await code('qa1', 'SIGN_STAGE', 'qa');
    const hash = await view('qa1');
    const create = storage.createIfAbsent.bind(storage);
    storage.createIfAbsent = async (key: string, value: any, o?: any) => (key.startsWith('ls3:wes:') ? false : create(key, value, o));
    expect(((await signStage({ stageId: 'qa', viewHash: hash, signature: sig, signing }, panelContext('qa1'), deps)) as any).code).toBe('CONFLICT');
    expect(storage.map.has(`ls3:sig:used:${signing.challengeId}`)).toBe(false);
    expect(events(storage, 'SIGN_OK')).toBe(0);
    storage.createIfAbsent = create;
    expect(((await signStage({ stageId: 'qa', viewHash: hash, signature: sig, signing }, panelContext('qa1'), deps)) as any).ok).toBe(true);
    expect(events(storage, 'SIGN_OK')).toBe(1);
  });

  it('records the rejection declaration on a rejection, and refuses one without it or with the approval text (D-5)', async () => {
    const { storage, deps, sig, view, code } = await routed(true);
    const hash = await view('qa1');
    const signing = await code('qa1', 'REJECT', 'qa');
    expect(((await rejectStage({ stageId: 'qa', viewHash: hash, reason: 'Not ready', signing }, panelContext('qa1'), deps)) as any).code).toBe('DECLARATION_MISMATCH');
    // The approval text is not a rejection's declaration
    expect(((await rejectStage({ stageId: 'qa', viewHash: hash, reason: 'Not ready', signature: sig, signing }, panelContext('qa1'), deps)) as any).code).toBe('DECLARATION_MISMATCH');
    expect(storage.map.has(`ls3:sig:used:${signing.challengeId}`)).toBe(false);
    const reject = { declarationId: 'reject', declarationVersion: DECLARATION_REJECT.version, declarationText: DECLARATION_REJECT.text };
    expect(((await rejectStage({ stageId: 'qa', viewHash: hash, reason: 'Not ready', signature: reject, signing }, panelContext('qa1'), deps)) as any).runState).toBe('REJECTED');
    expect(model.statusRows(storage).at(-1).data).toMatchObject({ declarationId: 'reject', declarationVersion: '1', declarationHash: declarationHash(DECLARATION_REJECT.text) });
  });

  it('asks for no declaration on a rejection outside code signing, and records none (D-5)', async () => {
    const { storage, deps, view } = await routed(false);
    expect(((await rejectStage({ stageId: 'qa', viewHash: await view('qa1'), reason: 'Not ready' }, panelContext('qa1'), deps)) as any).runState).toBe('REJECTED');
    const row = model.statusRows(storage).at(-1);
    expect(row.data.declarationHash).toBeUndefined();
    expect(row.data.declarationId).toBeUndefined();
  });
});

describe('the evidence carries the declaration texts (D-1)', () => {
  it('exports the text of each declaration a row names, for stage signatures and the routed seal', async () => {
    const { jira, deps, sig, view } = await routed(false);
    for (const [who, stage] of [['qa1', 'qa'], ['qa2', 'qa'], ['reg1', 'reg']]) {
      expect(((await signStage({ stageId: stage, viewHash: await view(who), signature: sig }, panelContext(who), deps)) as any).ok).toBe(true);
    }
    jira.currentUser = 'reg1';
    const ev: any = await getSealEvidence({}, panelContext('reg1'), deps);
    expect(ev.declarations).toEqual({ 'approve/1': DECLARATION.text });
    expect(ev.history.every((r: any) => r.data.declarationHash === declarationHash(DECLARATION.text))).toBe(true);
  });
});

describe('a success and a lock decide a series once (R2-3)', () => {
  it('lets exactly one of a parallel lock and success end the series', async () => {
    for (let i = 0; i < 20; i++) {
      const store = new MemoryStore();
      const repo = new SigningRepository(store, store);
      const [locked, ok] = await Promise.all([repo.lock('pty_a', 1, 't'), repo.endSeries('pty_a', 1, 'OK', 't')]);
      expect([locked, ok].filter(Boolean)).toHaveLength(1);
      expect(Boolean(await repo.lockOf('pty_a', 1))).toBe(locked);
    }
  });
});

describe('the run lock take-over and fencing (R2-5)', () => {
  it('does not overwrite a fresh lock created after the stale one expired', async () => {
    const store = new MemoryStore();
    const repo = new RouteRepository(store);
    const old = Date.now() - RUN_LOCK_STALE_MS - 1;
    await store.createIfAbsent('ls3:runlock:10001', { owner: 'dead', at: old });
    const get = store.get.bind(store);
    let first = true;
    jest.spyOn(store, 'get').mockImplementation(async (key: string) => {
      const value = await get(key);
      if (key === 'ls3:runlock:10001' && first) {
        first = false;
        // The dead holder's key expires and a fresh caller creates the lock between the stale read and the take-over
        store.map.delete(key);
        await store.createIfAbsent(key, { owner: 'fresh', at: Date.now() });
      }
      return value;
    });
    expect(await repo.acquireRunLock('10001', 'taker', Date.now())).toBe(false);
    expect(store.map.get('ls3:runlock:10001').owner).toBe('fresh');
  });

  it('stops a holder whose lock was taken over from writing', async () => {
    const store = new MemoryStore();
    const deps: LedgerSealDeps = { jira: new FakeJira(sampleIssue()), storage: store, secrets: store };
    const result = await withRunLock(deps, '10001', async locked => {
      expect(await stillHoldsRunLock(locked, '10001')).toBe(true);
      store.map.set('ls3:runlock:10001', { owner: 'someone-else', at: Date.now() });
      return stillHoldsRunLock(locked, '10001');
    });
    expect(result).toBe(false);
    expect(store.map.get('ls3:runlock:10001').owner).toBe('someone-else');
    expect(await stillHoldsRunLock(deps, '10001')).toBe(true);
  });
});

describe('policy alert and alert index (L-5, L-8)', () => {
  it('does not bring a policy into force when its alert cannot be written', async () => {
    jest.spyOn(declaration, 'isDeclarationV2Approved').mockReturnValue(true);
    const jira = new FakeJira(sampleIssue());
    const store = new MemoryStore();
    const deps: LedgerSealDeps = { jira, storage: store, secrets: store };
    jira.jiraAdmins.add('admin');
    jira.currentUser = 'admin';
    const repo = new SigningRepository(store, store);
    jest.spyOn(SigningRepository.prototype, 'appendAlert').mockRejectedValueOnce(new Error('kvs down'));
    await expect(setSigningPolicyFlow({ enabled: true, projectKeys: ['CHG'] }, panelContext('admin'), deps)).rejects.toThrow('kvs down');
    expect(await repo.getPolicy()).toBeNull();
    expect(await repo.allPolicies()).toEqual([]);
    expect(((await setSigningPolicyFlow({ enabled: true, projectKeys: ['CHG'] }, panelContext('admin'), deps)) as any).policy.version).toBe(1);
    expect((await repo.alerts()).map(a => a.kind)).toEqual(['POLICY_CHANGED']);
  });

  it('keeps an alert acknowledged while the index was being built', async () => {
    const store = new MemoryStore();
    const repo = new SigningRepository(store, store);
    store.map.set('ls3:sig:alert:000001', { seq: 1, kind: 'SIGN_FAIL', at: 't' });
    const set = store.set.bind(store);
    jest.spyOn(store, 'set').mockImplementation(async (key: string, value: any, o?: any) => {
      await set(key, value, o);
      // An acknowledgement lands just after the build wrote the alert as open
      if (key === 'ls3:sig:open:000001') store.map.set('ls3:sig:alert:000002', { seq: 2, kind: 'ACK', ackSeq: 1, at: 't' });
    });
    expect(await repo.openAlerts()).toEqual([]);
  });
});
