/**
 * Copyright (c) 2026 Asymm Systems. All rights reserved.
 *
 * LedgerSeal: real concurrency tests (fix round 1, review H-1 and H-2). Started from the reviewer's probe
 * (.review-tmp/zz-review-races.test.ts); the assertions state the fixed behaviour, so this file fails on 427f6c9.
 * Every race runs two or more flows at the same time (Promise.all, or a held read), never a pre-created key.
 *
 * @author Fahim Farook
 */
import * as crypto from 'crypto';
import * as declaration from '../src/domain/declaration';
import { DECLARATION } from '../src/domain/declaration';
import { createSigner } from '../src/domain/attestation';
import { requestSigningCode, signStage, verifyIssue, getSealEvidence, validateTransition } from '../src/index';
import { LedgerSealDeps } from '../src/service/ledger';
import { checkSigningCode, setSigningPolicyFlow } from '../src/service/signing';
import { bindRouteFlow, saveRouteFlow } from '../src/service/routes';
import { SigningRepository } from '../src/storage/signing-repository';
import { RouteRepository } from '../src/storage/route-repository';
import { FakeJira, MemoryStore, panelContext, sampleIssue } from './support/fakes';
import { spawnSync } from 'child_process';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

jest.mock('@forge/api', () => ({ __esModule: true, default: {}, route: () => '', privacy: { reportPersonalData: jest.fn() } }));
jest.mock('@forge/kvs', () => ({ kvs: {}, WhereConditions: {} }));

beforeEach(() => {
  for (const level of ['error', 'warn', 'log', 'info'] as const) jest.spyOn(console, level).mockImplementation(() => undefined);
});
afterEach(() => jest.restoreAllMocks());

const as = (jira: FakeJira, who: string) => {
  jira.currentUser = who;
  return panelContext(who);
};

async function codeSetup(lockoutThreshold: number) {
  jest.spyOn(declaration, 'isDeclarationV2Approved').mockReturnValue(true);
  const jira = new FakeJira(sampleIssue());
  const store = new MemoryStore();
  const deps: LedgerSealDeps = { jira, storage: store, secrets: store };
  jira.approvers.add('alice');
  jira.jiraAdmins.add('admin');
  expect(((await setSigningPolicyFlow({ enabled: true, projectKeys: ['CHG'], lockoutThreshold }, as(jira, 'admin'), deps)) as any).ok).toBe(true);
  const repo = new SigningRepository(store, store);
  return { jira, store, deps, repo };
}

async function newRequest(jira: FakeJira, store: MemoryStore, deps: LedgerSealDeps, repo: SigningRepository) {
  for (const key of [...store.map.keys()]) if (key.startsWith('ls3:sig:reqslot:')) store.map.delete(key);
  const req: any = await requestSigningCode({ action: 'SEAL' }, as(jira, 'alice'), deps);
  expect(req.ok).toBe(true);
  const code = jira.lastCode('alice') as string;
  const party = (await repo.getChallenge(req.challengeId))!.partyId;
  return { req, code, party };
}

const wrongOf = (code: string, i: number) => String((Number(code) + 1 + i) % 1000000).padStart(6, '0');

describe('code check under concurrency (review H-2)', () => {
  it('compares at most 3 answers per request and refuses a right code sent with 49 wrong ones in parallel', async () => {
    const { jira, store, deps, repo } = await codeSetup(5);
    const { req, code, party } = await newRequest(jira, store, deps, repo);
    const policy = (await repo.getPolicy())!;
    const attempts = [...Array.from({ length: 49 }, (_, i) => wrongOf(code, i)), code];
    const results = await Promise.all(
      attempts.map(c => checkSigningCode(deps, { accountId: 'alice', partyId: party, issueId: '10001', action: 'SEAL', stageId: null, policy, signing: { challengeId: req.challengeId, code: c } }))
    );
    const codes = results.map((r: any) => (r.ok ? 'OK' : r.code));
    expect(codes).not.toContain('OK');
    expect([...store.map.keys()].filter(k => k.startsWith(`ls3:sig:attempt:${req.challengeId}:`))).toHaveLength(3);
    expect([...store.map.keys()].filter(k => k.startsWith(`ls3:sig:fail:${party}:`)).length).toBeLessThanOrEqual(5);
    const state = await repo.getState(party);
    expect(state.locked).toBe(true);
    // Locked: a new request is refused before any email
    for (const key of [...store.map.keys()]) if (key.startsWith('ls3:sig:reqslot:')) store.map.delete(key);
    expect(((await requestSigningCode({ action: 'SEAL' }, as(jira, 'alice'), deps)) as any).code).toBe('SIGNING_LOCKED');
  });

  it('refuses a right code that runs at the same time as the failure that reaches the threshold', async () => {
    const { jira, store, deps, repo } = await codeSetup(3);
    const policy = (await repo.getPolicy())!;
    let { req, code, party } = await newRequest(jira, store, deps, repo);
    const check = (c: string, id = req.challengeId) =>
      checkSigningCode(deps, { accountId: 'alice', partyId: party, issueId: '10001', action: 'SEAL', stageId: null, policy, signing: { challengeId: id, code: c } });
    expect(((await check(wrongOf(code, 0))) as any).code).toBe('SIGNING_FAILED');
    expect(((await check(wrongOf(code, 1))) as any).code).toBe('SIGNING_FAILED');
    ({ req, code, party } = await newRequest(jira, store, deps, repo));
    const [a, b] = await Promise.all([check(wrongOf(code, 2)), check(code)]);
    expect([a, b].some((r: any) => r.ok)).toBe(false);
    expect((await repo.getState(party)).locked).toBe(true);
  });

  it('sends one code for a burst of parallel requests (the 30-second rule is a claim)', async () => {
    const { jira, deps } = await codeSetup(5);
    jira.currentUser = 'alice';
    const results: any[] = await Promise.all(Array.from({ length: 10 }, () => requestSigningCode({ action: 'SEAL' }, panelContext('alice'), deps)));
    expect(results.filter(r => r.ok)).toHaveLength(1);
    expect(results.filter(r => r.code === 'RATE_LIMITED')).toHaveLength(9);
    expect(jira.notifications).toHaveLength(1);
  });

  it('accepts a double submit of the right code once, and does not count the second as a failure (review L-4)', async () => {
    const { jira, store, deps, repo } = await codeSetup(3);
    const policy = (await repo.getPolicy())!;
    const { req, code, party } = await newRequest(jira, store, deps, repo);
    const check = () => checkSigningCode(deps, { accountId: 'alice', partyId: party, issueId: '10001', action: 'SEAL', stageId: null, policy, signing: { challengeId: req.challengeId, code } });
    const results: any[] = await Promise.all([check(), check()]);
    expect(results.filter(r => r.ok)).toHaveLength(1);
    expect(results.filter(r => r.code === 'CODE_REUSED')).toHaveLength(1);
    expect((await repo.getState(party)).locked).toBe(false);
    expect([...store.map.keys()].filter(k => k.startsWith(`ls3:sig:fail:${party}:`))).toEqual([]);
  });
});

describe('route run under concurrency (review H-1)', () => {
  const STAGES = [
    { stageId: 'qa', name: 'QA', orderGroup: 1, roleTypeId: 'LS_REVIEWER', approverGroupIds: ['g-qa'], quorum: { kind: 'N', n: 2 }, gatesStatusIds: [] },
    { stageId: 'sec', name: 'Security', orderGroup: 1, roleTypeId: 'LS_REVIEWER', approverGroupIds: ['g-sec'], quorum: 'ANY', gatesStatusIds: [] },
    { stageId: 'reg', name: 'Regulatory', orderGroup: 2, roleTypeId: 'LS_APPROVER', approverGroupIds: ['g-reg'], quorum: 'ANY', gatesStatusIds: [] }
  ];
  const V1 = { meaning: 'APPROVAL', declarationVersion: DECLARATION.version, declarationText: DECLARATION.text, reason: 'ok' };

  async function routed() {
    const pair = crypto.generateKeyPairSync('ed25519');
    const signer = createSigner(pair.privateKey.export({ format: 'der', type: 'pkcs8' }).toString('base64'), 'ls-test-r');
    const jira = new FakeJira(sampleIssue());
    const storage = new MemoryStore();
    const deps: LedgerSealDeps = { jira, storage, secrets: storage, signer };
    jira.jiraAdmins.add('admin');
    jira.siteGroups = [{ groupId: 'g-qa', name: 'qa' }, { groupId: 'g-sec', name: 'sec' }, { groupId: 'g-reg', name: 'reg' }];
    jira.memberships = { qa1: ['g-qa'], qa2: ['g-qa'], sec1: ['g-sec'], reg1: ['g-reg'], reg2: ['g-reg'], both: ['g-qa', 'g-sec'] };
    const saved: any = await saveRouteFlow({ name: 'R', stages: STAGES }, as(jira, 'admin'), deps);
    expect(((await bindRouteFlow({ projectKey: 'CHG', issueTypeId: '*', routeId: saved.route.routeId }, as(jira, 'admin'), deps)) as any).ok).toBe(true);
    const sign = async (who: string, stageId: string) => {
      const panel: any = await verifyIssue({}, as(jira, who), deps);
      return signStage({ stageId, viewHash: panel.viewHash, signature: V1 }, as(jira, who), deps) as Promise<any>;
    };
    return { pair, jira, storage, deps, sign };
  }

  /** A store whose n-th read of the run record waits until `release` is called (a tab paused mid-flow). */
  function heldStore(storage: MemoryStore, n: number) {
    let release!: () => void;
    const gateOpen = new Promise<void>(r => (release = r));
    const state = { runReads: 0 };
    const slowStore: any = Object.create(storage);
    slowStore.get = async (key: string) => {
      const value = await storage.get(key);
      if (key === 'ls3:run:10001' && ++state.runReads === n) await gateOpen;
      return value;
    };
    return { slowStore, release, state };
  }

  function verifierExit(pair: crypto.KeyPairKeyObjectResult, ev: unknown) {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ls-race-'));
    const keyFile = path.join(dir, 'ls-test-r.pub.pem');
    fs.writeFileSync(keyFile, pair.publicKey.export({ format: 'pem', type: 'spki' }));
    const file = path.join(dir, 'e.json');
    fs.writeFileSync(file, JSON.stringify(ev));
    return spawnSync(process.execPath, [path.resolve(__dirname, '../../../tools/verifier/verify-evidence.mjs'), file, keyFile], { encoding: 'utf8' });
  }

  it('refuses one person signing two stages of one run from two tabs, and the run record keeps every signature', async () => {
    const { pair, jira, storage, deps, sign } = await routed();
    expect((await sign('qa1', 'qa')).ok).toBe(true);
    expect((await sign('qa2', 'qa')).ok).toBe(true);
    expect((await sign('sec1', 'sec')).ok).toBe(true);
    expect((await sign('reg1', 'reg')).runState).toBe('COMPLETE');
    jira.issue.fields.summary = 'changed after the seal';
    expect((await sign('qa1', 'qa')).runState).toBe('OPEN');
    const panel: any = await verifyIssue({}, as(jira, 'both'), deps);
    // Tab B reads the run record, then waits until tab A finished, then goes on
    const { slowStore, release, state } = heldStore(storage, 2);
    jira.currentUser = 'both';
    const pB = signStage({ stageId: 'sec', viewHash: panel.viewHash, signature: V1 }, panelContext('both'), { ...deps, storage: slowStore });
    while (state.runReads < 2) await new Promise(r => setImmediate(r));
    const a: any = await signStage({ stageId: 'qa', viewHash: panel.viewHash, signature: V1 }, panelContext('both'), deps);
    release();
    const b: any = await pB;
    expect(a.ok).toBe(true);
    expect(b.code).toBe('SAME_PERSON_STAGE');
    const run: any = await new RouteRepository(storage).run('10001');
    const rows = [...storage.map.entries()].filter(([k]) => k.startsWith('ls3:wes:10001:')).map(([, v]) => v).filter((r: any) => r.statusId === 'LS_RUN_SIGNED' && r.data.runId === run.runId);
    expect(run.signatures.map((s: any) => s.stageId)).toEqual(['qa', 'qa']);
    expect(rows.map((r: any) => r.data.stageId)).toEqual(['qa', 'qa']);
    // QA is full; Security and Regulatory finish the run, and the app's own evidence passes the verifier
    expect((await sign('qa2', 'qa')).code).toBe('STAGE_NOT_OPEN');
    expect((await sign('sec1', 'sec')).ok).toBe(true);
    expect((await sign('reg2', 'reg')).runState).toBe('COMPLETE');
    const out = verifierExit(pair, await getSealEvidence({}, as(jira, 'reg2'), deps));
    expect(out.stdout).toContain('PASS');
    expect(out.status).toBe(0);
    const gate: any = await validateTransition({ issue: { id: '10001', key: 'CHG-1' }, transition: { from: { id: '3' }, to: { id: '10001' } }, user: { accountId: 'mover' } }, undefined, deps);
    expect(gate).toEqual({ result: true });
  });

  it('keeps both signatures when two people sign two stages of a new run at the same moment', async () => {
    const { pair, jira, storage, deps, sign } = await routed();
    const qa: any = await verifyIssue({}, as(jira, 'qa1'), deps);
    const sec: any = await verifyIssue({}, as(jira, 'sec1'), deps);
    jira.memberships.qa1 = ['g-qa'];
    // FakeJira answers the group read from currentUser, so each flow gets its own view of the fake
    const jiraFor = (who: string) => new Proxy(jira, { get: (t: any, p) => (p === 'currentUser' ? who : typeof t[p] === 'function' ? (...args: unknown[]) => { t.currentUser = who; return t[p](...args); } : t[p]) });
    const [x, y]: any[] = await Promise.all([
      signStage({ stageId: 'qa', viewHash: qa.viewHash, signature: V1 }, panelContext('qa1'), { ...deps, jira: jiraFor('qa1') }),
      signStage({ stageId: 'sec', viewHash: sec.viewHash, signature: V1 }, panelContext('sec1'), { ...deps, jira: jiraFor('sec1') })
    ]);
    expect(x.ok && y.ok).toBe(true);
    const run: any = await new RouteRepository(storage).run('10001');
    expect(run.signatures.map((s: any) => s.stageId).sort()).toEqual(['qa', 'sec']);
    expect((await sign('qa2', 'qa')).ok).toBe(true);
    expect((await sign('reg1', 'reg')).runState).toBe('COMPLETE');
    expect(verifierExit(pair, await getSealEvidence({}, as(jira, 'reg1'), deps)).status).toBe(0);
  });

  it('refuses a stage signature whose run was voided while it was in flight', async () => {
    const { jira, storage, deps, sign } = await routed();
    expect((await sign('qa1', 'qa')).ok).toBe(true);
    const panel: any = await verifyIssue({}, as(jira, 'qa2'), deps);
    const { slowStore, release, state } = heldStore(storage, 2);
    jira.currentUser = 'qa2';
    const pending = signStage({ stageId: 'qa', viewHash: panel.viewHash, signature: V1 }, panelContext('qa2'), { ...deps, storage: slowStore });
    while (state.runReads < 2) await new Promise(r => setImmediate(r));
    // Meanwhile a covered change, and someone opens the panel: the run is voided
    jira.issue.fields.summary = 'changed during the signature';
    await verifyIssue({}, as(jira, 'sec1'), deps);
    expect(((await new RouteRepository(storage).run('10001')) as any).state).toBe('VOIDED');
    jira.currentUser = 'qa2';
    release();
    const late: any = await pending;
    expect(late.code).toBe('ISSUE_CHANGED');
    const run: any = await new RouteRepository(storage).run('10001');
    expect(run.state).toBe('VOIDED');
    expect(run.signatures).toHaveLength(1);
  });
});
