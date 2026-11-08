/**
 * Copyright (c) 2026 Asymm Systems. All rights reserved.
 *
 * ADR-017 approval routes (spec v4 section 15): stages in order groups, a group per stage, quorum, one stage per
 * person, separation of duties across stages, rejection and restart, voiding on change, re-approval, revoke, the
 * validator's stage gates, schema 4, and evidence format 2 checked by the open verifier.
 *
 * @author Fahim Farook
 */

import { spawnSync } from 'child_process';
import * as crypto from 'crypto';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import * as declaration from '../src/domain/declaration';
import { DECLARATION, DECLARATION_V2 } from '../src/domain/declaration';
import { createSigner } from '../src/domain/attestation';
import { gateFor, hasValidRouteHash, isRouteComplete, openStages, parseStages, quorumOf, routeCanonicalText, stageCounts, stagesForNewRun, withRouteHash } from '../src/domain/route';
import { getSealEvidence, rejectStage, requestSigningCode, revokeSeal, sealIssue, signStage, validateTransition, verifyIssue } from '../src/index';
import { LedgerSealDeps } from '../src/service/ledger';
import { bindRouteFlow, listRoutesFlow, saveRouteFlow, unbindRouteFlow } from '../src/service/routes';
import { setSigningPolicyFlow } from '../src/service/signing';
import { RouteRepository } from '../src/storage/route-repository';
import { FakeJira, MemoryStore, model, panelContext, sampleIssue } from './support/fakes';

jest.mock('@forge/api', () => ({ __esModule: true, default: {}, route: () => '', privacy: { reportPersonalData: jest.fn() } }));
jest.mock('@forge/kvs', () => ({ kvs: {}, WhereConditions: {} }));

const VERIFIER = path.resolve(__dirname, '../../../tools/verifier/verify-evidence.mjs');
const pair = crypto.generateKeyPairSync('ed25519');
const signer = createSigner(pair.privateKey.export({ format: 'der', type: 'pkcs8' }).toString('base64'), 'ls-test-r');
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ls-routes-'));
const keyFile = path.join(dir, 'ls-test-r.pub.pem');
fs.writeFileSync(keyFile, pair.publicKey.export({ format: 'pem', type: 'spki' }));
function verify(evidence: any) {
  const file = path.join(dir, `e-${crypto.randomUUID()}.json`);
  fs.writeFileSync(file, JSON.stringify(evidence));
  const run = spawnSync(process.execPath, [VERIFIER, file, keyFile], { encoding: 'utf8' });
  return { status: run.status, out: run.stdout + run.stderr };
}

beforeEach(() => {
  for (const level of ['error', 'warn', 'log', 'info'] as const) jest.spyOn(console, level).mockImplementation(() => undefined);
});
afterEach(() => jest.restoreAllMocks());

const STAGES = [
  { stageId: 'qa', name: 'QA', orderGroup: 1, roleTypeId: 'LS_REVIEWER', approverGroupIds: ['g-qa'], quorum: 'ANY', gatesStatusIds: ['10002'] },
  { stageId: 'reg', name: 'Regulatory', orderGroup: 2, roleTypeId: 'LS_APPROVER', approverGroupIds: ['g-reg'], quorum: { kind: 'N', n: 2 }, gatesStatusIds: ['10001'] }
];
const V1 = (extra: Record<string, unknown> = {}) => ({ meaning: 'APPROVAL', declarationVersion: DECLARATION.version, declarationText: DECLARATION.text, ...extra });

async function setup(opts: { reapproval?: string[] | null; bind?: boolean } = {}) {
  const jira = new FakeJira(sampleIssue());
  const storage = new MemoryStore();
  const deps: LedgerSealDeps = { jira, storage, secrets: storage, signer };
  jira.jiraAdmins.add('admin');
  jira.approvers.add('padmin');
  jira.siteGroups = [{ groupId: 'g-qa', name: 'qa-team' }, { groupId: 'g-reg', name: 'regulatory' }];
  jira.memberships = { qa1: ['g-qa'], qa2: ['g-qa'], reg1: ['g-reg'], reg2: ['g-reg'], reg3: ['g-reg'], both: ['g-qa', 'g-reg'] };
  jira.currentUser = 'admin';
  const saved: any = await saveRouteFlow({ name: 'QA then Regulatory', stages: STAGES, reapprovalStageIds: opts.reapproval ?? undefined }, panelContext('admin'), deps);
  expect(saved.ok).toBe(true);
  if (opts.bind !== false) expect(((await bindRouteFlow({ projectKey: 'CHG', issueTypeId: '*', routeId: saved.route.routeId }, panelContext('admin'), deps)) as any).ok).toBe(true);
  return { jira, storage, deps, route: saved.route };
}

const as = (jira: FakeJira, who: string) => {
  jira.currentUser = who;
  return panelContext(who);
};

async function sign(jira: FakeJira, deps: LedgerSealDeps, who: string, stageId: string, extra: Record<string, unknown> = {}) {
  const panel: any = await verifyIssue({}, as(jira, who), deps);
  return signStage({ stageId, viewHash: panel.viewHash, signature: V1(extra.signature as any), ...(extra.signing ? { signing: extra.signing } : {}) }, as(jira, who), deps) as Promise<any>;
}

const toStatus = (id: string, user = 'mover') => ({ issue: { id: '10001', key: 'CHG-1' }, transition: { from: { id: '3' }, to: { id } }, user: { accountId: user } });

describe('route domain', () => {
  it('validates stages: ids, names, groups, quorum, gates, order groups with no gap', () => {
    expect(parseStages([])).toMatch(/1 to 8 stages/);
    expect(parseStages(new Array(9).fill(STAGES[0]))).toMatch(/1 to 8 stages/);
    expect(parseStages([{ ...STAGES[0], stageId: 'Bad Id' }])).toMatch(/own id/);
    expect(parseStages([STAGES[0], STAGES[0]])).toMatch(/own id/);
    expect(parseStages([{ ...STAGES[0], name: '' }])).toMatch(/name/);
    expect(parseStages([{ ...STAGES[0], orderGroup: 9 }])).toMatch(/order group/);
    expect(parseStages([{ ...STAGES[0], roleTypeId: 'BOSS' }])).toMatch(/meaning/);
    expect(parseStages([{ ...STAGES[0], approverGroupIds: [] }])).toMatch(/approver groups/);
    expect(parseStages([{ ...STAGES[0], quorum: { kind: 'N', n: 11 } }])).toMatch(/quorum/);
    expect(parseStages([{ ...STAGES[0], gatesStatusIds: ['done'] }])).toMatch(/status ids/);
    expect(parseStages([{ ...STAGES[0], orderGroup: 2 }])).toMatch(/no gap/);
    const ok = parseStages(STAGES) as any[];
    expect(ok.map(s => [s.stageId, s.quorum])).toEqual([['qa', { kind: 'ANY' }], ['reg', { kind: 'N', n: 2 }]]);
  });

  it('hashes a route independently of the order of its groups and target statuses', () => {
    const base = { schemaVersion: 1 as const, routeId: 'r', version: 1, name: 'n', reapprovalStageIds: null, setByPartyId: 'p', fromDate: 't' };
    const stage = (groups: string[], gates: string[]) => ({ stageId: 's', name: 'S', orderGroup: 1, roleTypeId: 'LS_APPROVER' as const, approverGroups: groups.map(id => ({ id, name: id })), quorum: { kind: 'ANY' as const }, gatesStatusIds: gates });
    const a = withRouteHash({ ...base, stages: [stage(['b', 'a'], ['2', '1'])] });
    const b = withRouteHash({ ...base, stages: [stage(['a', 'b'], ['1', '2'])] });
    expect(a.routeHash).toBe(b.routeHash);
    expect(hasValidRouteHash(a)).toBe(true);
    expect(hasValidRouteHash({ ...a, name: 'x' })).toBe(false);
    expect(routeCanonicalText(a)).not.toContain('routeHash');
  });

  it('opens order groups in order, counts distinct people for the quorum, and gates statuses', () => {
    const route = withRouteHash({ schemaVersion: 1, routeId: 'r', version: 1, name: 'n', reapprovalStageIds: ['reg'], setByPartyId: 'p', fromDate: 't', stages: (parseStages(STAGES) as any[]) });
    const all = stagesForNewRun(route, false);
    expect(all).toEqual(['qa', 'reg']);
    expect(stagesForNewRun(route, true)).toEqual(['reg']);
    const none = stageCounts(null);
    expect(openStages(route, all, none).map(s => s.stageId)).toEqual(['qa']);
    const qaDone = stageCounts({ signatures: [{ seq: 1, entryHash: 'h', stageId: 'qa', partyId: 'a' }] });
    expect(openStages(route, all, qaDone).map(s => s.stageId)).toEqual(['reg']);
    const regOnce = stageCounts({ signatures: [{ seq: 1, entryHash: 'h', stageId: 'qa', partyId: 'a' }, { seq: 2, entryHash: 'h', stageId: 'reg', partyId: 'b' }, { seq: 3, entryHash: 'h', stageId: 'reg', partyId: 'b' }] });
    expect(isRouteComplete(route, all, regOnce)).toBe(false);
    expect(quorumOf(route.stages[1])).toBe(2);
    expect(gateFor(route, all, qaDone, '10002')).toMatchObject({ met: true });
    expect(gateFor(route, all, qaDone, '10001')).toMatchObject({ met: false });
    expect(gateFor(route, all, qaDone, '999')).toBeNull();
    expect(openStages(route, all, stageCounts({ signatures: [...[1, 2].map(i => ({ seq: i, entryHash: 'h', stageId: 'reg', partyId: `p${i}` })), { seq: 3, entryHash: 'h', stageId: 'qa', partyId: 'a' }] }))).toEqual([]);
  });
});

describe('admin flows (Jira admins only, Q-08)', () => {
  it('refuses non-admins for every route flow', async () => {
    const { jira, deps } = await setup();
    for (const flow of [listRoutesFlow.bind(null, as(jira, 'qa1'), deps), () => saveRouteFlow({}, as(jira, 'qa1'), deps), () => bindRouteFlow({}, as(jira, 'qa1'), deps), () => unbindRouteFlow({}, as(jira, 'qa1'), deps)]) {
      expect(((await flow()) as any).code).toBe('NOT_ADMIN');
    }
  });

  it('validates the route against Jira and keeps every version as it was saved', async () => {
    const { jira, storage, deps, route } = await setup();
    const ctx = as(jira, 'admin');
    expect(((await saveRouteFlow({ name: '', stages: STAGES }, ctx, deps)) as any).code).toBe('INVALID_REQUEST');
    expect(((await saveRouteFlow({ name: 'x', stages: [] }, ctx, deps)) as any).message).toMatch(/1 to 8 stages/);
    expect(((await saveRouteFlow({ name: 'x', stages: STAGES, reapprovalStageIds: ['nope'] }, ctx, deps)) as any).message).toMatch(/re-approval/);
    expect(((await saveRouteFlow({ name: 'x', stages: [{ ...STAGES[0], approverGroupIds: ['g-none'] }] }, ctx, deps)) as any).message).toMatch(/group was not found/);
    expect(((await saveRouteFlow({ name: 'x', stages: [{ ...STAGES[0], gatesStatusIds: ['77'] }] }, ctx, deps)) as any).message).toMatch(/status was not found/);
    jira.failStatuses = true;
    expect(((await saveRouteFlow({ name: 'x', stages: STAGES }, ctx, deps)) as any).code).toBe('JIRA_UNREACHABLE');
    jira.failStatuses = false;
    jira.failGroups = true;
    expect(((await saveRouteFlow({ name: 'x', stages: STAGES }, ctx, deps)) as any).code).toBe('JIRA_UNREACHABLE');
    jira.failGroups = false;
    expect(((await saveRouteFlow({ routeId: 'rte_none', name: 'x', stages: STAGES }, ctx, deps)) as any).message).toMatch(/no such route/);
    const v2: any = await saveRouteFlow({ routeId: route.routeId, name: 'Renamed', stages: STAGES }, ctx, deps);
    expect(v2.route.version).toBe(2);
    expect(v2.route.stages[0].approverGroups).toEqual([{ id: 'g-qa', name: 'qa-team' }]);
    const versions = await new RouteRepository(storage).versions(route.routeId);
    expect(versions.map(v => [v.version, v.name])).toEqual([[1, 'QA then Regulatory'], [2, 'Renamed']]);
    expect(versions.every(hasValidRouteHash)).toBe(true);
    const list: any = await listRoutesFlow(ctx, deps);
    expect(list.routes.map((r: any) => r.version)).toEqual([2]);
    expect(list.bindings).toEqual([expect.objectContaining({ projectId: '100', issueTypeId: '*', routeId: route.routeId })]);
  });

  it('binds by project key and issue type, the issue type winning over "all", and unbinds', async () => {
    const { jira, deps, route } = await setup({ bind: false });
    const ctx = as(jira, 'admin');
    expect(((await bindRouteFlow({ projectKey: 'CHG', issueTypeId: 'x', routeId: route.routeId }, ctx, deps)) as any).code).toBe('INVALID_REQUEST');
    expect(((await bindRouteFlow({ projectKey: 'NOPE', issueTypeId: '*', routeId: route.routeId }, ctx, deps)) as any).message).toMatch(/project was not found/);
    expect(((await bindRouteFlow({ projectKey: 'CHG', issueTypeId: '*', routeId: 'rte_x' }, ctx, deps)) as any).message).toMatch(/no such route/);
    jira.failProjects = true;
    expect(((await bindRouteFlow({ projectKey: 'CHG', issueTypeId: '*', routeId: route.routeId }, ctx, deps)) as any).code).toBe('JIRA_UNREACHABLE');
    jira.failProjects = false;
    expect(((await bindRouteFlow({ projectKey: 'CHG', issueTypeId: '3', routeId: route.routeId }, ctx, deps)) as any).ok).toBe(true);
    // Bound: the plain panel seal is refused
    expect(((await sealIssue({ signature: V1() }, as(jira, 'padmin'), deps)) as any).code).toBe('ROUTED');
    expect(((await unbindRouteFlow({ projectId: '100', issueTypeId: 'x' }, as(jira, 'admin'), deps)) as any).code).toBe('INVALID_REQUEST');
    expect(((await unbindRouteFlow({ projectId: '100', issueTypeId: '3' }, as(jira, 'admin'), deps)) as any).ok).toBe(true);
    expect(((await sealIssue({ signature: V1() }, as(jira, 'padmin'), deps)) as any).ok).toBe(true);
  });
});

describe('stage signing (spec v4 section 15.3)', () => {
  it('runs QA then Regulatory (2 of the group), writes one seal naming every stage signature, and passes the verifier', async () => {
    const { jira, storage, deps } = await setup();
    const first = await sign(jira, deps, 'qa1', 'qa');
    expect(first).toMatchObject({ ok: true, runState: 'OPEN' });
    let rows = model.statusRows(storage);
    expect(rows.map(r => [r.statusId, r.transitionName])).toEqual([['LS_RUN_SIGNED', 'SIGN_STAGE']]);
    expect(rows[0].data).toMatchObject({ stageId: 'qa', qualifyingGroupId: 'g-qa' });
    // Schema 4 before the first seal: no status, no certificate
    const prop = jira.propertyWrites.at(-1)!.body;
    expect(prop).toMatchObject({ schemaVersion: 4, approval: { runState: 'OPEN', stagesComplete: 1, stagesTotal: 2 } });
    expect(prop.status).toBeUndefined();
    expect(prop.certificateId).toBeUndefined();
    expect(prop.sig).toEqual(expect.any(String));
    expect((await sign(jira, deps, 'reg1', 'reg')).runState).toBe('OPEN');
    const done = await sign(jira, deps, 'reg2', 'reg');
    expect(done).toMatchObject({ ok: true, runState: 'COMPLETE', certificateId: expect.any(String) });
    rows = model.statusRows(storage);
    expect(rows.map(r => r.statusId)).toEqual(['LS_RUN_SIGNED', 'LS_RUN_SIGNED', 'LS_SEALED']);
    const seal = rows[2];
    expect(seal.data.stageSignatures).toEqual([rows[0].entryHash, rows[1].entryHash]);
    expect(seal.data).toMatchObject({ stageId: 'reg', requiredStageIds: ['qa', 'reg'] });
    expect(seal.prevEntryHash).toBe(rows[1].entryHash);
    expect(jira.propertyWrites.at(-1)!.body).toMatchObject({ schemaVersion: 4, status: 'SEAL_VALID', approval: { runState: 'COMPLETE', stagesComplete: 2, stagesTotal: 2 } });
    jira.currentUser = 'auditor';
    const evidence: any = await getSealEvidence({}, panelContext('auditor'), deps);
    expect(evidence.format).toBe('ledgerseal-evidence/2');
    expect(evidence.routes).toHaveLength(1);
    const ok = verify(evidence);
    expect(ok.out).toContain('PASS route versions (1)');
    expect(ok.out).toContain('PASS stage signatures of the sealing run');
    expect(ok.out).toContain('PASS quorum and stage order');
    expect(ok.out).toContain('PASS one stage per person');
    expect(ok.status).toBe(0);
    // The validator: sealed and unchanged passes; the stage gates were met
    expect(await validateTransition(toStatus('10001'), {}, deps)).toEqual({ result: true });
  });

  it('refuses a stage that is not open, a person outside its groups, and a second stage by the same person', async () => {
    const { jira, deps } = await setup();
    expect((await sign(jira, deps, 'reg1', 'reg')).code).toBe('STAGE_NOT_OPEN');
    expect((await sign(jira, deps, 'reg1', 'qa')).code).toBe('NOT_APPROVER');
    expect((await sign(jira, deps, 'reg1', 'nope')).code).toBe('STAGE_NOT_OPEN');
    expect((await sign(jira, deps, 'both', 'qa')).ok).toBe(true);
    expect((await sign(jira, deps, 'both', 'reg')).code).toBe('SAME_PERSON_STAGE');
    jira.failGroups = true;
    expect((await sign(jira, deps, 'reg1', 'reg')).code).toBe('JIRA_UNREACHABLE');
  });

  it('refuses without identity, Browse, the shown hash, a current hash or the declaration', async () => {
    const { jira, deps } = await setup();
    expect(((await signStage({ stageId: 'qa' }, { extension: { issue: { id: '10001' } } }, deps)) as any).code).toBe('NO_IDENTITY');
    expect(((await signStage({ stageId: 'Bad' }, as(jira, 'qa1'), deps)) as any).code).toBe('INVALID_REQUEST');
    jira.cannotBrowse.add('qa1');
    expect(((await signStage({ stageId: 'qa', viewHash: 'x', signature: V1() }, as(jira, 'qa1'), deps)) as any).code).toBe('NO_BROWSE_PERMISSION');
    jira.cannotBrowse.clear();
    expect(((await signStage({ stageId: 'qa', signature: V1() }, as(jira, 'qa1'), deps)) as any).code).toBe('INVALID_REQUEST');
    expect(((await signStage({ stageId: 'qa', viewHash: 'stale', signature: V1() }, as(jira, 'qa1'), deps)) as any).code).toBe('ISSUE_CHANGED');
    expect((await sign(jira, deps, 'qa1', 'qa', { signature: { declarationText: 'other' } })).code).toBe('DECLARATION_MISMATCH');
    expect(((await signStage({ stageId: 'qa', viewHash: 'x' }, { ...as(jira, 'qa1'), license: { active: false } }, deps)) as any).code).toBe('LICENSE_INACTIVE');
    expect(((await signStage({ stageId: 'qa' }, { accountId: 'qa1' }, deps)) as any).code).toBe('MISSING_ISSUE');
  });

  it('says so when the issue has no route', async () => {
    const { jira, deps } = await setup({ bind: false });
    expect((await sign(jira, deps, 'qa1', 'qa')).code).toBe('NOT_ROUTED');
  });

  it('keeps an open run on the route version it started with when the route is edited (Q-07)', async () => {
    const { jira, storage, deps, route } = await setup();
    await sign(jira, deps, 'qa1', 'qa');
    jira.currentUser = 'admin';
    await saveRouteFlow({ routeId: route.routeId, name: 'Stricter', stages: [STAGES[0], { ...STAGES[1], quorum: { kind: 'N', n: 3 } }] }, panelContext('admin'), deps);
    await sign(jira, deps, 'reg1', 'reg');
    expect((await sign(jira, deps, 'reg2', 'reg')).runState).toBe('COMPLETE');
    expect(model.statusRows(storage).at(-1).data.routeVersion).toBe(1);
  });
});

describe('rejection, change, re-approval and revoke', () => {
  it('rejects with a reason, ends the run, blocks the gate with the reason, and the next signature starts again at the first group', async () => {
    const { jira, storage, deps } = await setup();
    await sign(jira, deps, 'qa1', 'qa');
    const panel: any = await verifyIssue({}, as(jira, 'reg1'), deps);
    expect(((await rejectStage({ stageId: 'reg', viewHash: panel.viewHash }, as(jira, 'reg1'), deps)) as any).code).toBe('REASON_REQUIRED');
    expect(((await rejectStage({ stageId: 'reg', viewHash: panel.viewHash, reason: 'Missing test evidence' }, as(jira, 'reg1'), deps)) as any)).toMatchObject({ ok: true, runState: 'REJECTED' });
    const last = model.statusRows(storage).at(-1);
    expect(last).toMatchObject({ statusId: 'LS_RUN_REJECTED', transitionName: 'REJECT', reason: 'Missing test evidence' });
    const gate = await validateTransition(toStatus('10002'), {}, deps);
    expect(gate.result).toBe(false);
    expect(gate.errorMessage).toMatch(/^LedgerSeal: Regulatory rejected this issue on \d{4}-\d\d-\d\d \(reason: Missing test evidence\)/);
    // A new run: QA again, by the same person as before (the old run's signatures count for nothing)
    expect((await sign(jira, deps, 'reg1', 'reg')).code).toBe('STAGE_NOT_OPEN');
    expect((await sign(jira, deps, 'qa1', 'qa')).runState).toBe('OPEN');
    expect(jira.propertyWrites.at(-1)!.body.approval).toMatchObject({ runState: 'OPEN', stagesComplete: 1 });
  });

  it('rejects before any signature too, by a person of the first group', async () => {
    const { jira, storage, deps } = await setup();
    const panel: any = await verifyIssue({}, as(jira, 'qa2'), deps);
    expect(((await rejectStage({ stageId: 'qa', viewHash: panel.viewHash, reason: 'Not ready' }, as(jira, 'qa2'), deps)) as any).runState).toBe('REJECTED');
    expect(model.statusRows(storage).map(r => r.statusId)).toEqual(['LS_RUN_REJECTED']);
  });

  it('voids an open run when covered content changes, with a run voided row and no incident', async () => {
    const { jira, storage, deps } = await setup();
    await sign(jira, deps, 'qa1', 'qa');
    jira.edit('dev', new Date(Date.now() + 1000).toISOString(), 'summary', 'Changed during approval');
    await verifyIssue({}, as(jira, 'viewer'), deps);
    const rows = model.statusRows(storage);
    expect(rows.map(r => r.statusId)).toEqual(['LS_RUN_SIGNED', 'LS_RUN_VOIDED']);
    expect(rows[1]).toMatchObject({ transitionName: 'VOID', setByPartyId: null });
    // A second view records nothing new (one row per change)
    await verifyIssue({}, as(jira, 'viewer'), deps);
    expect(model.statusRows(storage)).toHaveLength(2);
    expect((await sign(jira, deps, 'reg1', 'reg')).code).toBe('STAGE_NOT_OPEN');
    expect((await sign(jira, deps, 'qa2', 'qa')).runState).toBe('OPEN');
  });

  it('voids a run in the validator when the issue changed, then blocks the stage-gated move', async () => {
    const { jira, storage, deps } = await setup();
    await sign(jira, deps, 'qa1', 'qa');
    jira.edit('dev', new Date(Date.now() + 1000).toISOString(), 'summary', 'Changed');
    const res = await validateTransition(toStatus('10002'), {}, deps);
    expect(res.result).toBe(false);
    expect(model.statusRows(storage).at(-1).statusId).toBe('LS_RUN_VOIDED');
  });

  it('passes a stage-gated move once that stage has its quorum, and blocks a later gate with the count', async () => {
    const { jira, deps } = await setup();
    await sign(jira, deps, 'qa1', 'qa');
    expect(await validateTransition(toStatus('10002'), {}, deps)).toEqual({ result: true });
    await sign(jira, deps, 'reg1', 'reg');
    expect(await validateTransition(toStatus('10001'), {}, deps)).toEqual({ result: false, errorMessage: 'LedgerSeal: this move needs the Regulatory approval (1 of 2 signed). Sign in the LedgerSeal panel.' });
    // A status no stage gates needs the completed seal (the normal gate)
    expect((await validateTransition(toStatus('3'), {}, deps)).errorMessage).toContain('not sealed');
  });

  it('keeps the author of a change from signing any stage that approves it, and re-approves with the configured stages only', async () => {
    const { jira, storage, deps } = await setup({ reapproval: ['reg'] });
    await sign(jira, deps, 'qa1', 'qa');
    await sign(jira, deps, 'reg1', 'reg');
    await sign(jira, deps, 'reg2', 'reg');
    jira.edit('reg3', new Date(Date.now() + 1000).toISOString(), 'summary', 'Changed after the seal');
    // The re-approval needs only Regulatory; its author cannot sign it
    expect((await sign(jira, deps, 'reg3', 'reg', { signature: { reason: 'mine' } })).code).toBe('SELF_APPROVAL');
    expect((await sign(jira, deps, 'qa1', 'qa', { signature: { reason: 'x' } })).code).toBe('STAGE_NOT_OPEN');
    expect((await sign(jira, deps, 'reg1', 'reg', { signature: { reason: 'Reviewed' } })).runState).toBe('OPEN');
    const done = await sign(jira, deps, 'reg2', 'reg', { signature: { reason: 'Reviewed' } });
    expect(done.runState).toBe('COMPLETE');
    expect(model.statusRows(storage).at(-1)).toMatchObject({ transitionName: 'RESEAL', data: expect.objectContaining({ requiredStageIds: ['reg'] }) });
    jira.currentUser = 'auditor';
    const evidence: any = await getSealEvidence({}, panelContext('auditor'), deps);
    expect(verify(evidence).status).toBe(0);
  });

  it('lets only a member of the last order group revoke a routed seal, and a revoke ends an open run', async () => {
    const { jira, storage, deps } = await setup();
    await sign(jira, deps, 'qa1', 'qa');
    await sign(jira, deps, 'reg1', 'reg');
    await sign(jira, deps, 'reg2', 'reg');
    expect(((await revokeSeal({ reason: 'x' }, as(jira, 'qa1'), deps)) as any).message).toMatch(/last approval stage/);
    expect(((await revokeSeal({ reason: 'x' }, as(jira, 'padmin'), deps)) as any).code).toBe('NOT_APPROVER');
    // An open re-approval run is ended by the revoke
    jira.edit('dev', new Date(Date.now() + 1000).toISOString(), 'summary', 'Changed');
    await verifyIssue({}, as(jira, 'viewer'), deps);
    await sign(jira, deps, 'qa2', 'qa', { signature: { reason: 'Looks fine' } });
    const revoked: any = await revokeSeal({ reason: 'Stop' }, as(jira, 'reg3'), deps);
    expect(revoked.ok).toBe(true);
    expect(model.statusRows(storage).at(-1).data).toMatchObject({ endsRun: true });
    expect(jira.propertyWrites.at(-1)!.body).toMatchObject({ status: 'SEAL_REVOKED', approval: { runState: 'VOIDED' } });
  });
});

describe('panel and code signing', () => {
  it('shows each stage, who signed, and what this viewer may sign or reject', async () => {
    const { jira, deps } = await setup();
    await sign(jira, deps, 'qa1', 'qa');
    const forReg: any = await verifyIssue({}, as(jira, 'reg1'), deps);
    expect(forReg.route).toMatchObject({ name: 'QA then Regulatory', runState: 'OPEN', open: true });
    expect(forReg.route.stages.map((s: any) => [s.stageId, s.open, s.canSign, s.canReject, s.signed.length, s.quorum])).toEqual([
      ['qa', false, false, false, 1, 1],
      ['reg', true, true, true, 0, 2]
    ]);
    expect(forReg.route.stages[0].signed[0].accountId).toBe('qa1');
    const forQa: any = await verifyIssue({}, as(jira, 'qa1'), deps);
    expect(forQa.route.stages[1].canSign).toBe(false);
    const { jira: j2, deps: d2 } = await setup({ bind: false });
    expect(((await verifyIssue({}, as(j2, 'qa1'), d2)) as any).route).toBeNull();
  });

  it('needs a SIGN_STAGE code for a stage in a code-signing project, and sends codes only to open-stage group members', async () => {
    const { jira, storage, deps } = await setup();
    jest.spyOn(declaration, 'isDeclarationV2Approved').mockReturnValue(true);
    await setSigningPolicyFlow({ enabled: true, projectKeys: ['CHG'] }, as(jira, 'admin'), deps);
    const v2 = { declarationVersion: '2', declarationText: DECLARATION_V2.text };
    expect((await sign(jira, deps, 'qa1', 'qa', { signature: v2 })).code).toBe('SIGNING_REQUIRED');
    expect(((await requestSigningCode({ action: 'SIGN_STAGE', stageId: 'reg' }, as(jira, 'qa1'), deps)) as any).code).toBe('STAGE_NOT_OPEN');
    expect(((await requestSigningCode({ action: 'SIGN_STAGE', stageId: 'qa' }, as(jira, 'reg1'), deps)) as any).code).toBe('NOT_APPROVER');
    const party = await model.token(storage, 'qa1');
    storage.map.delete(`ls3:sig:state:${party}`);
    const req: any = await requestSigningCode({ action: 'SIGN_STAGE', stageId: 'qa' }, as(jira, 'qa1'), deps);
    expect(req.ok).toBe(true);
    const signed = await sign(jira, deps, 'qa1', 'qa', { signature: v2, signing: { challengeId: req.challengeId, code: jira.lastCode('qa1') } });
    expect(signed.ok).toBe(true);
    expect(model.statusRows(storage).at(-1).data.signing).toMatchObject({ method: 'LS_ATL_EMAIL_OTP_1' });
  });
});

describe('integrity', () => {
  it('fails closed when the run record is changed', async () => {
    const { jira, storage, deps } = await setup();
    await sign(jira, deps, 'qa1', 'qa');
    const key = 'ls3:run:10001';
    storage.map.set(key, { ...storage.map.get(key), requiredStageIds: ['qa'] });
    expect((await sign(jira, deps, 'reg1', 'reg')).message).toMatch(/integrity check/);
    expect((await validateTransition(toStatus('10002'), {}, deps)).errorMessage).toMatch(/integrity check/);
    expect(((await sealIssue({ signature: V1() }, as(jira, 'padmin'), deps)) as any).message).toMatch(/integrity check/);
  });

  it('refuses evidence a verifier would fail: a stage signature removed from the seal row', async () => {
    const { jira, deps } = await setup();
    await sign(jira, deps, 'qa1', 'qa');
    await sign(jira, deps, 'reg1', 'reg');
    await sign(jira, deps, 'reg2', 'reg');
    jira.currentUser = 'auditor';
    const evidence: any = await getSealEvidence({}, panelContext('auditor'), deps);
    const bad = JSON.parse(JSON.stringify(evidence));
    bad.routes[0].stages[1].quorum = { kind: 'N', n: 3 };
    const out = verify(bad);
    expect(out.status).toBe(1);
    expect(out.out).toContain('FAIL route versions (1)');
  });
});
