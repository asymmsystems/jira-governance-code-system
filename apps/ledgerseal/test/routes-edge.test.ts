/**
 * Copyright (c) 2026 Asymm Systems. All rights reserved.
 *
 * ADR-017 edge cases: storage, admin inputs, route resolution, lost races, failed reads, and the gate messages. Each
 * case fails closed or says why.
 *
 * @author Fahim Farook
 */

import * as declaration from '../src/domain/declaration';
import { DECLARATION } from '../src/domain/declaration';
import { withRouteHash } from '../src/domain/route';
import { requestSigningCode, revokeSeal, signStage, validateTransition, verifyIssue } from '../src/index';
import { LedgerSealDeps } from '../src/service/ledger';
import { bindRouteFlow, routeFor, routeGovernsSeal, saveRouteFlow, unbindRouteFlow, voidRunIfChanged } from '../src/service/routes';
import { setSigningPolicyFlow } from '../src/service/signing';
import { RouteRepository } from '../src/storage/route-repository';
import { FakeJira, MemoryStore, model, panelContext, sampleIssue } from './support/fakes';

jest.mock('@forge/api', () => ({ __esModule: true, default: {}, route: () => '', privacy: { reportPersonalData: jest.fn() } }));
jest.mock('@forge/kvs', () => ({ kvs: {}, WhereConditions: {} }));

beforeEach(() => {
  for (const level of ['error', 'warn', 'log', 'info'] as const) jest.spyOn(console, level).mockImplementation(() => undefined);
});
afterEach(() => jest.restoreAllMocks());

const QA = { stageId: 'qa', name: 'QA', orderGroup: 1, roleTypeId: 'LS_REVIEWER', approverGroupIds: ['g-qa'], quorum: 'ANY', gatesStatusIds: ['10002'] };
const REG = { stageId: 'reg', name: 'Regulatory', orderGroup: 2, roleTypeId: 'LS_APPROVER', approverGroupIds: ['g-reg'], quorum: 'ANY', gatesStatusIds: [] };
const V1 = { meaning: 'APPROVAL', declarationVersion: DECLARATION.version, declarationText: DECLARATION.text };

async function setup(stages: any[] = [QA, REG], bind = true) {
  const jira = new FakeJira(sampleIssue());
  const storage = new MemoryStore();
  const deps: LedgerSealDeps = { jira, storage, secrets: storage };
  jira.jiraAdmins.add('admin');
  jira.siteGroups = [{ groupId: 'g-qa', name: 'qa' }, { groupId: 'g-reg', name: 'reg' }];
  jira.memberships = { qa1: ['g-qa'], reg1: ['g-reg'], reg2: ['g-reg'] };
  jira.currentUser = 'admin';
  const saved: any = await saveRouteFlow({ name: 'R', stages }, panelContext('admin'), deps);
  if (bind) await bindRouteFlow({ projectKey: 'CHG', issueTypeId: '*', routeId: saved.route.routeId }, panelContext('admin'), deps);
  return { jira, storage, deps, route: saved.route };
}

const as = (jira: FakeJira, who: string) => {
  jira.currentUser = who;
  return panelContext(who);
};

async function sign(jira: FakeJira, deps: LedgerSealDeps, who: string, stageId: string, extra: any = {}) {
  const panel: any = await verifyIssue({}, as(jira, who), deps);
  return signStage({ stageId, viewHash: panel.viewHash, signature: { ...V1, ...extra }, ...(extra.signing ? { signing: extra.signing } : {}) }, as(jira, who), deps) as Promise<any>;
}

describe('route storage', () => {
  it('sorts routes by name, ignores a version with a wrong hash, and refuses to store one', async () => {
    const store = new MemoryStore();
    const repo = new RouteRepository(store);
    const mk = (id: string, name: string) => withRouteHash({ schemaVersion: 1, routeId: id, version: 1, name, stages: [], reapprovalStageIds: null, setByPartyId: 'p', fromDate: 't' });
    await repo.saveVersion(mk('r2', 'Zeta'));
    await repo.saveVersion(mk('r1', 'Alpha'));
    expect((await repo.heads()).map(h => h.name)).toEqual(['Alpha', 'Zeta']);
    expect(await repo.saveVersion(mk('r1', 'Alpha'))).toBe(false);
    const key = 'ls3:routever:r1:000001';
    store.map.set(key, { ...store.map.get(key), name: 'Changed' });
    expect(await repo.version('r1', 1)).toBeNull();
    expect(await repo.version('r1', 9)).toBeNull();
    expect(await repo.current('none')).toBeNull();
    await expect(repo.saveVersion({ ...mk('r3', 'x'), name: 'y' })).rejects.toThrow('wrong hash');
    await repo.bind({ routeId: 'r1', projectId: '1', issueTypeId: '*', setByPartyId: 'p', fromDate: 't' });
    await repo.bind({ routeId: 'r2', projectId: '1', issueTypeId: '5', setByPartyId: 'p', fromDate: 't' });
    expect((await repo.binding('1', '5'))!.routeId).toBe('r2');
    expect((await repo.binding('1', '6'))!.routeId).toBe('r1');
    expect(await repo.binding('2', '6')).toBeNull();
    // "*" is not a KVS key character: the binding for every issue type is stored under "all" (live finding)
    expect(store.map.has('ls3:routebind:1:all')).toBe(true);
    await expect(store.set('ls3:routebind:1:*', {})).rejects.toThrow('INVALID_KEY');
    await repo.deleteRunContent('');
    await repo.deleteRun('10001');
  });
});

describe('admin inputs', () => {
  it('refuses odd payloads and the 51st route, and a save that loses a race', async () => {
    const { jira, storage, deps, route } = await setup();
    const ctx = () => as(jira, 'admin');
    expect(((await saveRouteFlow({ name: 7, stages: [QA] }, ctx(), deps)) as any).code).toBe('INVALID_REQUEST');
    expect(((await bindRouteFlow({ projectKey: 7, issueTypeId: '*', routeId: route.routeId }, ctx(), deps)) as any).code).toBe('INVALID_REQUEST');
    expect(((await bindRouteFlow({ projectKey: 'CHG', issueTypeId: '*', routeId: 7 }, ctx(), deps)) as any).code).toBe('INVALID_REQUEST');
    expect(((await unbindRouteFlow({ projectId: 'x', issueTypeId: '*' }, ctx(), deps)) as any).code).toBe('INVALID_REQUEST');
    storage.map.set(`ls3:routever:${route.routeId}:000002`, { taken: true });
    expect(((await saveRouteFlow({ routeId: route.routeId, name: 'R', stages: [QA] }, ctx(), deps)) as any).code).toBe('CONFLICT');
    for (let i = 0; i < 50; i++) storage.map.set(`ls3:route:rte_fill${i}`, { routeId: `rte_fill${i}`, currentVersion: 1, name: `F${i}` });
    expect(((await saveRouteFlow({ name: 'R', stages: [QA] }, ctx(), deps)) as any).message).toMatch(/at most 50 routes/);
  });
});

describe('route resolution', () => {
  it('fails closed on a missing pinned version or route, and reports an unreadable scope', async () => {
    const { jira, storage, deps, route } = await setup();
    await sign(jira, deps, 'qa1', 'qa');
    storage.map.delete(`ls3:routever:${route.routeId}:000001`);
    expect(await routeFor(deps, '10001')).toBe('invalid');
    const second = await setup();
    second.storage.map.delete(`ls3:routever:${second.route.routeId}:000001`);
    expect(await routeFor(second.deps, '10001')).toBe('invalid');
    second.jira.failScope = true;
    expect(await routeFor(second.deps, '10001')).toBe('unreachable');
    expect(await routeGovernsSeal(second.deps, '10001')).toMatchObject({ code: 'JIRA_UNREACHABLE' });
  });

  it('describes a finished run whose route is no longer bound, and governs the seal while a run is open', async () => {
    const { jira, deps } = await setup([QA]);
    await sign(jira, deps, 'qa1', 'qa');
    await unbindRouteFlow({ projectId: '100', issueTypeId: '*' }, as(jira, 'admin'), deps);
    const ctx: any = await routeFor(deps, '10001');
    expect(ctx).toMatchObject({ open: false, run: expect.objectContaining({ state: 'COMPLETE' }) });
    const other = await setup([QA, REG]);
    await sign(other.jira, other.deps, 'qa1', 'qa');
    await unbindRouteFlow({ projectId: '100', issueTypeId: '*' }, as(other.jira, 'admin'), other.deps);
    expect(await routeGovernsSeal(other.deps, '10001')).toBe(true);
    // A route bound to another issue type leaves a finished run's context in place
    const third = await setup([QA], false);
    expect(await routeFor(third.deps, '10001')).toBeNull();
  });

  it('describes nothing when the finished run\'s route version is gone', async () => {
    const { jira, storage, deps, route } = await setup([QA]);
    await sign(jira, deps, 'qa1', 'qa');
    await unbindRouteFlow({ projectId: '100', issueTypeId: '*' }, as(jira, 'admin'), deps);
    storage.map.delete(`ls3:routever:${route.routeId}:000001`);
    expect(await routeFor(deps, '10001')).toBeNull();
  });
});

describe('lost races and failed reads', () => {
  it('answers CONFLICT when another writer took the next history row, for a stage, a completing stage and a rejection', async () => {
    const { jira, storage, deps } = await setup();
    const create = storage.createIfAbsent.bind(storage);
    storage.createIfAbsent = async (key: string, value: any, options?: any) => (key.startsWith('ls3:wes:') ? false : create(key, value, options));
    expect((await sign(jira, deps, 'qa1', 'qa')).code).toBe('CONFLICT');
    const panel: any = await verifyIssue({}, as(jira, 'qa1'), deps);
    const { rejectStage } = require('../src/index');
    expect(((await rejectStage({ stageId: 'qa', signature: { declarationVersion: require('../src/domain/declaration').DECLARATION.version, declarationText: require('../src/domain/declaration').DECLARATION.text }, viewHash: panel.viewHash, reason: 'No' }, as(jira, 'qa1'), deps)) as any).code).toBe('CONFLICT');
    storage.createIfAbsent = create;
    await sign(jira, deps, 'qa1', 'qa');
    storage.createIfAbsent = async (key: string, value: any, options?: any) => (key.startsWith('ls3:wes:') ? false : create(key, value, options));
    expect((await sign(jira, deps, 'reg1', 'reg')).code).toBe('CONFLICT');
  });

  it('voids nothing when it loses the race for the void row', async () => {
    const { jira, storage, deps } = await setup();
    await sign(jira, deps, 'qa1', 'qa');
    jira.edit('dev', new Date(Date.now() + 1000).toISOString(), 'summary', 'x');
    const create = storage.createIfAbsent.bind(storage);
    storage.createIfAbsent = async (key: string, value: any, options?: any) => (key.startsWith('ls3:wes:') ? false : create(key, value, options));
    const { readLiveSnapshot } = require('../src/service/ledger');
    const { PartyRepository } = require('../src/storage/party-repository');
    const live = await readLiveSnapshot(jira, '10001', new Date().toISOString(), { party: await new PartyRepository(storage).partyForRead() });
    expect(await voidRunIfChanged(deps, '10001', live, new Date().toISOString())).toBe(false);
  });

  it('refuses when Jira cannot read groups, the change log or the issue', async () => {
    const { jira, deps } = await setup();
    const panel: any = await verifyIssue({}, as(jira, 'qa1'), deps);
    jira.failGroups = true;
    expect(((await signStage({ stageId: 'qa', viewHash: panel.viewHash, signature: V1 }, as(jira, 'qa1'), deps)) as any).code).toBe('JIRA_UNREACHABLE');
    jira.failGroups = false;
    expect(((await signStage({ stageId: 7 }, as(jira, 'qa1'), deps)) as any).code).toBe('INVALID_REQUEST');
    jira.failIssueGet = true;
    expect(((await signStage({ stageId: 'qa', viewHash: panel.viewHash, signature: V1 }, as(jira, 'qa1'), deps)) as any).code).toBe('JIRA_UNREACHABLE');
  });

  it('refuses a stage that approves changes when the change log cannot be read', async () => {
    const { jira, deps } = await setup([QA]);
    await sign(jira, deps, 'qa1', 'qa');
    jira.edit('dev', new Date(Date.now() + 1000).toISOString(), 'summary', 'Changed');
    await verifyIssue({}, as(jira, 'viewer'), deps);
    const panel: any = await verifyIssue({}, as(jira, 'qa1'), deps);
    jira.failChangelog = true;
    expect(((await signStage({ stageId: 'qa', viewHash: panel.viewHash, signature: { ...V1, reason: 'ok' } }, as(jira, 'qa1'), deps)) as any).code).toBe('JIRA_UNREACHABLE');
  });

  it('refuses a stage in a code-signing project with a tampered policy or a pending declaration', async () => {
    const { jira, storage, deps } = await setup();
    const spy = jest.spyOn(declaration, 'isDeclarationV2Approved').mockReturnValue(true);
    await setSigningPolicyFlow({ enabled: true, projectKeys: ['CHG'] }, as(jira, 'admin'), deps);
    spy.mockReturnValue(false);
    const v2 = { declarationVersion: '2', declarationText: declaration.DECLARATION_V2.text };
    expect((await sign(jira, deps, 'qa1', 'qa', v2)).code).toBe('DECLARATION_PENDING');
    storage.map.set('ls3:sig:policy', { ...storage.map.get('ls3:sig:policy'), lockoutThreshold: 9 });
    expect((await sign(jira, deps, 'qa1', 'qa', v2)).code).toBe('POLICY_INVALID');
  });

  it('keeps the seal status in the property when a re-approval run is voided after a change', async () => {
    const { jira, storage, deps } = await setup();
    await sign(jira, deps, 'qa1', 'qa');
    await sign(jira, deps, 'reg1', 'reg');
    jira.edit('dev', new Date(Date.now() + 1000).toISOString(), 'summary', 'Changed');
    await verifyIssue({}, as(jira, 'viewer'), deps);
    expect((await sign(jira, deps, 'qa1', 'qa', { reason: 'ok' })).runState).toBe('OPEN');
    jira.edit('dev', new Date(Date.now() + 2000).toISOString(), 'summary', 'Changed again');
    await verifyIssue({}, as(jira, 'viewer'), deps);
    const voids = jira.propertyWrites.filter(w => w.body.approval?.runState === 'VOIDED');
    expect(voids.at(-1)!.body.status).toBe('SEAL_BROKEN');
    expect(model.statusRows(storage).map(r => r.statusId)).toContain('LS_RUN_VOIDED');
  });
});

describe('gate and revoke messages', () => {
  it('names an unknown rejecting stage neutrally and counts an "any one" quorum as 1', async () => {
    const { jira, storage, deps } = await setup();
    const panel: any = await verifyIssue({}, as(jira, 'qa1'), deps);
    const { rejectStage } = require('../src/index');
    await rejectStage({ stageId: 'qa', signature: { declarationVersion: require('../src/domain/declaration').DECLARATION.version, declarationText: require('../src/domain/declaration').DECLARATION.text }, viewHash: panel.viewHash, reason: 'No' }, as(jira, 'qa1'), deps);
    const last = model.statusRows(storage).at(-1);
    const key = model.statusKey(last.seq);
    storage.map.set(key, { ...storage.map.get(key), data: { ...last.data, stageId: 'gone' } });
    const res = await validateTransition({ issue: { id: '10001' }, transition: { to: { id: '10002' } }, user: { accountId: 'm' } }, {}, deps);
    expect(res.errorMessage).toMatch(/^LedgerSeal: A stage rejected this issue/);
    const fresh = await setup([{ ...QA, gatesStatusIds: [] }, { ...REG, gatesStatusIds: ['10001'] }]);
    await sign(fresh.jira, fresh.deps, 'qa1', 'qa');
    await sign(fresh.jira, fresh.deps, 'reg1', 'reg').catch(() => undefined);
    const two = await setup([QA, { ...REG, quorum: { kind: 'N', n: 2 }, gatesStatusIds: ['10001'] }]);
    await sign(two.jira, two.deps, 'qa1', 'qa');
    const gated = await validateTransition({ issue: { id: '10001' }, transition: { to: { id: '10001' } }, user: { accountId: 'm' } }, {}, two.deps);
    expect(gated.errorMessage).toContain('(0 of 2 signed)');
    const any = await setup([QA, { ...REG, gatesStatusIds: ['10001'] }]);
    await sign(any.jira, any.deps, 'qa1', 'qa');
    const gatedAny = await validateTransition({ issue: { id: '10001' }, transition: { to: { id: '10001' } }, user: { accountId: 'm' } }, {}, any.deps);
    expect(gatedAny.errorMessage).toContain('(0 of 1 signed)');
  });

  it('refuses a routed revoke when groups cannot be read, and revokes a routed seal with no open run', async () => {
    const { jira, storage, deps } = await setup([QA]);
    await sign(jira, deps, 'qa1', 'qa');
    jira.failGroups = true;
    expect(((await revokeSeal({ reason: 'x' }, as(jira, 'qa1'), deps)) as any).code).toBe('JIRA_UNREACHABLE');
    jira.failGroups = false;
    expect(((await revokeSeal({ reason: 'x' }, as(jira, 'qa1'), deps)) as any).ok).toBe(true);
    expect(model.statusRows(storage).at(-1).data.endsRun).toBeUndefined();
    jira.failScope = true;
    expect(((await revokeSeal({ reason: 'x' }, as(jira, 'qa1'), deps)) as any).code).toBe('JIRA_UNREACHABLE');
  });

  it('refuses a stage code for a person outside the stage, an unreadable route or groups', async () => {
    const { jira, storage, deps } = await setup();
    const spy = jest.spyOn(declaration, 'isDeclarationV2Approved').mockReturnValue(true);
    await setSigningPolicyFlow({ enabled: true, projectKeys: ['CHG'] }, as(jira, 'admin'), deps);
    jira.failGroups = true;
    expect(((await requestSigningCode({ action: 'SIGN_STAGE', stageId: 'qa' }, as(jira, 'qa1'), deps)) as any).code).toBe('JIRA_UNREACHABLE');
    jira.failGroups = false;
    storage.map.set('ls3:routebind:100:all', { ...storage.map.get('ls3:routebind:100:all'), routeId: 'rte_gone' });
    expect(((await requestSigningCode({ action: 'SIGN_STAGE', stageId: 'qa' }, as(jira, 'qa1'), deps)) as any).code).toBe('NOT_APPROVER');
    jira.failScope = true;
    expect(((await requestSigningCode({ action: 'REJECT', stageId: 'qa' }, as(jira, 'qa1'), deps)) as any).code).toBe('JIRA_UNREACHABLE');
    spy.mockRestore();
  });
});

describe('approval summary', () => {
  it('counts no stage as complete when the run\'s route version cannot be read, and is null for an issue without a run', async () => {
    const { approvalSummary } = require('../src/service/approval-summary');
    const { jira, storage, deps, route } = await setup();
    expect(await approvalSummary(storage, '10001')).toBeNull();
    await sign(jira, deps, 'qa1', 'qa');
    storage.map.delete(`ls3:routever:${route.routeId}:000001`);
    expect(await approvalSummary(storage, '10001')).toMatchObject({ runState: 'OPEN', stagesComplete: 0, stagesTotal: 2 });
    storage.map.set('ls3:run:10001', { ...storage.map.get('ls3:run:10001'), state: 'COMPLETE' });
    expect(await approvalSummary(storage, '10001')).toBeNull();
  });
});
