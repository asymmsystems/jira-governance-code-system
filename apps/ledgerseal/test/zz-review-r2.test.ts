/**
 * Copyright (c) 2026 Asymm Systems. All rights reserved.
 *
 * LedgerSeal: review round 2 (R2-1). Started from the reviewer's probe (.review-tmp/r2/zz-r2probe.test.ts): a
 * completing stage signature holds the run lock while a revoke is made. The assertions state the fixed behaviour,
 * so this file fails on f537067, where the revoke wrote its row outside the lock and the run it ended then sealed.
 *
 * @author Fahim Farook
 */
import * as crypto from 'crypto';
import { DECLARATION } from '../src/domain/declaration';
import { createSigner } from '../src/domain/attestation';
import { revokeSeal, signStage, verifyIssue, getSealEvidence, validateTransition } from '../src/index';
import { LedgerSealDeps } from '../src/service/ledger';
import { bindRouteFlow, saveRouteFlow } from '../src/service/routes';
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

const STAGES = [
  { stageId: 'qa', name: 'QA', orderGroup: 1, roleTypeId: 'LS_REVIEWER', approverGroupIds: ['g-qa'], quorum: 'ANY', gatesStatusIds: [] },
  { stageId: 'reg', name: 'Regulatory', orderGroup: 2, roleTypeId: 'LS_APPROVER', approverGroupIds: ['g-reg'], quorum: 'ANY', gatesStatusIds: [] }
];
const V1 = { meaning: 'APPROVAL', declarationVersion: DECLARATION.version, declarationText: DECLARATION.text, reason: 'ok' };

function jiraFor(shared: FakeJira, who: string): FakeJira {
  const j = new FakeJira(shared.issue);
  j.issue = shared.issue;
  j.jiraAdmins = shared.jiraAdmins;
  j.siteGroups = shared.siteGroups;
  j.memberships = shared.memberships;
  j.currentUser = who;
  return j;
}

it('a revoke made while a completing stage signature holds the run lock waits for it, and no run continues after it ended', async () => {
  const pair = crypto.generateKeyPairSync('ed25519');
  const signer = createSigner(pair.privateKey.export({ format: 'der', type: 'pkcs8' }).toString('base64'), 'ls-test-r');
  const jira = new FakeJira(sampleIssue());
  const storage = new MemoryStore();
  const deps: LedgerSealDeps = { jira, storage, secrets: storage, signer };
  jira.jiraAdmins.add('admin');
  jira.siteGroups = [{ groupId: 'g-qa', name: 'qa' }, { groupId: 'g-reg', name: 'reg' }];
  jira.memberships = { qa1: ['g-qa'], qa2: ['g-qa'], reg1: ['g-reg'], reg2: ['g-reg'], reg3: ['g-reg'] };
  jira.currentUser = 'admin';
  const saved: any = await saveRouteFlow({ name: 'R', stages: STAGES }, panelContext('admin'), deps);
  await bindRouteFlow({ projectKey: 'CHG', issueTypeId: '*', routeId: saved.route.routeId }, panelContext('admin'), deps);
  const sign = async (who: string, stageId: string, d: LedgerSealDeps = deps) => {
    if (d === deps) jira.currentUser = who;
    const panel: any = await verifyIssue({}, panelContext(who), d);
    return signStage({ stageId, viewHash: panel.viewHash, signature: V1 }, panelContext(who), d) as Promise<any>;
  };
  expect((await sign('qa1', 'qa')).ok).toBe(true);
  expect((await sign('reg1', 'reg')).runState).toBe('COMPLETE');
  jira.issue.fields.summary = 'changed';
  expect((await sign('qa2', 'qa')).runState).toBe('OPEN');

  // reg2 signs the last stage and holds the run lock until released; reg3 revokes meanwhile
  let release!: () => void;
  const gate = new Promise<void>(r => (release = r));
  const slow: any = Object.create(storage);
  let held = false;
  slow.createIfAbsent = async (key: string, value: any, o?: any) => {
    const ok = await storage.createIfAbsent(key, value, o);
    if (ok && key === 'ls3:runlock:10001' && !held) {
      held = true;
      await gate;
    }
    return ok;
  };
  // The revoke's first attempt at the run lock is the moment to let reg2 go on
  let revokeTried = false;
  const revokeStore: any = Object.create(storage);
  revokeStore.createIfAbsent = async (key: string, value: any, o?: any) => {
    const ok = await storage.createIfAbsent(key, value, o);
    if (key === 'ls3:runlock:10001' && !ok) revokeTried = true;
    return ok;
  };
  const depsB: LedgerSealDeps = { ...deps, jira: jiraFor(jira, 'reg2'), storage: slow };
  const depsR: LedgerSealDeps = { ...deps, jira: jiraFor(jira, 'reg3'), storage: revokeStore };
  const pB = sign('reg2', 'reg', depsB);
  while (!held) await new Promise(r => setImmediate(r));
  const pR = revokeSeal({ reason: 'Stop this approval' }, panelContext('reg3'), depsR) as Promise<any>;
  const revokedEarly = () => [...storage.map.values()].some((v: any) => v?.statusId === 'LS_REVOKED');
  while (!revokeTried && !revokedEarly()) await new Promise(r => setTimeout(r, 5));
  // On f537067 the revoke row is already stored here, while reg2 still holds the lock
  expect(revokedEarly()).toBe(false);
  release();
  const [b, r] = await Promise.all([pB, pR]);
  expect(b.runState).toBe('COMPLETE');
  expect(r.ok).toBe(true);

  const rows: any[] = [...storage.map.entries()].filter(([k]) => k.startsWith('ls3:wes:10001:')).map(([, v]) => v).sort((x: any, y: any) => x.seq - y.seq);
  // The revoke came after the seal of the run, so it revokes that seal and ends no run
  expect(rows.slice(-2).map(x => `${x.statusId}/${x.transitionName}`)).toEqual(['LS_SEALED/RESEAL', 'LS_REVOKED/REVOKE']);
  expect(rows.at(-1).data.endsRun).toBeUndefined();
  const ended = new Set<string>();
  for (const row of rows) {
    if (row.data?.runId) expect(ended.has(row.data.runId)).toBe(false);
    if (row.statusId === 'LS_RUN_VOIDED' || row.statusId === 'LS_RUN_REJECTED' || row.data?.endsRun) ended.add(row.data.runId);
  }
  expect(((await new RouteRepository(storage).run('10001')) as any).state).toBe('COMPLETE');
  expect((await storage.get('ls3:we:10001')).currentStatusId).toBe('LS_REVOKED');
  const moved: any = await validateTransition({ issue: { id: '10001', key: 'CHG-1' }, transition: { from: { id: '3' }, to: { id: '10001' } }, user: { accountId: 'mover' } }, undefined, deps);
  expect(moved.result).toBe(false);

  const ev: any = await getSealEvidence({}, panelContext('reg2'), { ...deps, jira: jiraFor(jira, 'reg2') });
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ls-r2-'));
  const keyFile = path.join(dir, 'ls-test-r.pub.pem');
  fs.writeFileSync(keyFile, pair.publicKey.export({ format: 'pem', type: 'spki' }));
  fs.writeFileSync(path.join(dir, 'e.json'), JSON.stringify(ev));
  const out = spawnSync(process.execPath, [path.resolve(__dirname, '../../../tools/verifier/verify-evidence.mjs'), path.join(dir, 'e.json'), keyFile], { encoding: 'utf8' });
  expect(out.stdout).toContain('PASS no run continues after it ended');
  expect(out.stdout).toMatch(/PASS declaration texts \(versions 1\)/);
  expect(out.status).toBe(0);
});
