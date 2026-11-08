/**
 * Copyright (c) 2026 Asymm Systems. All rights reserved.
 *
 * LedgerSeal: fix round 3 (review of 71ca88c). Each code-signing signing records the declaration of its own action
 * (owner decision 2026-11-08, D-5), and the open verifier checks the declaration against the action; a policy
 * save that died after its version and alert does not block later saves, and is not exported (P-1).
 *
 * @author Fahim Farook
 */
import * as crypto from 'crypto';
import { spawnSync } from 'child_process';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import * as declaration from '../src/domain/declaration';
import { DECLARATION_REJECT, DECLARATION_REVOKE, DECLARATION_V2 } from '../src/domain/declaration';
import { declarationHash } from '../src/domain/declaration-hash';
import { createSigner } from '../src/domain/attestation';
import { getSealEvidence, rejectStage, requestSigningCode, revokeSeal, signStage, verifyIssue } from '../src/index';
import { LedgerSealDeps } from '../src/service/ledger';
import { bindRouteFlow, saveRouteFlow } from '../src/service/routes';
import { POLICY_SAVE_STALE_MS, setSigningPolicyFlow } from '../src/service/signing';
import { SigningRepository } from '../src/storage/signing-repository';
import { FakeJira, MemoryStore, model, panelContext, sampleIssue } from './support/fakes';
import { codeRequestRight } from '../src/service/signing';

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
const APPROVE = { declarationId: 'approve', declarationVersion: DECLARATION_V2.version, declarationText: DECLARATION_V2.text };
const REJECT = { declarationId: 'reject', declarationVersion: DECLARATION_REJECT.version, declarationText: DECLARATION_REJECT.text };
const REVOKE = { declarationId: 'revoke', declarationVersion: DECLARATION_REVOKE.version, declarationText: DECLARATION_REVOKE.text };

describe('each code-signing signing records the declaration of its own action (D-5)', () => {
  it('approves, rejects and revokes with their own texts, and the verifier checks each against its action', async () => {
    jest.spyOn(declaration, 'isDeclarationV2Approved').mockReturnValue(true);
    const pair = crypto.generateKeyPairSync('ed25519');
    const signer = createSigner(pair.privateKey.export({ format: 'der', type: 'pkcs8' }).toString('base64'), 'ls-test-r');
    const jira = new FakeJira(sampleIssue());
    const storage = new MemoryStore();
    const deps: LedgerSealDeps = { jira, storage, secrets: storage, signer };
    jira.jiraAdmins.add('admin');
    jira.siteGroups = [{ groupId: 'g-qa', name: 'qa' }, { groupId: 'g-reg', name: 'reg' }];
    jira.memberships = { qa1: ['g-qa'], qa2: ['g-qa'], reg1: ['g-reg'] };
    jira.currentUser = 'admin';
    await setSigningPolicyFlow({ enabled: true, projectKeys: ['CHG'] }, panelContext('admin'), deps);
    const saved: any = await saveRouteFlow({ name: 'R', stages: STAGES }, panelContext('admin'), deps);
    await bindRouteFlow({ projectKey: 'CHG', issueTypeId: '*', routeId: saved.route.routeId }, panelContext('admin'), deps);
    const code = async (who: string, action: string, stageId?: string) => {
      for (const key of [...storage.map.keys()]) if (key.startsWith('ls3:sig:reqslot:')) storage.map.delete(key);
      jira.currentUser = who;
      const req: any = await requestSigningCode({ action, ...(stageId ? { stageId } : {}) }, panelContext(who), deps);
      expect(req.ok).toBe(true);
      return { challengeId: req.challengeId, code: jira.lastCode(who) as string };
    };
    const view = async (who: string) => {
      jira.currentUser = who;
      return ((await verifyIssue({}, panelContext(who), deps)) as any).viewHash;
    };
    // QA rejects first (rejection text), then QA and Regulatory approve (approval text), then Regulatory revokes
    const r1 = await code('qa1', 'REJECT', 'qa');
    expect(((await rejectStage({ stageId: 'qa', viewHash: await view('qa1'), reason: 'Missing tests', signature: REJECT, signing: r1 }, panelContext('qa1'), deps)) as any).runState).toBe('REJECTED');
    const s1 = await code('qa2', 'SIGN_STAGE', 'qa');
    expect(((await signStage({ stageId: 'qa', viewHash: await view('qa2'), signature: APPROVE, signing: s1 }, panelContext('qa2'), deps)) as any).ok).toBe(true);
    const s2 = await code('reg1', 'SIGN_STAGE', 'reg');
    expect(((await signStage({ stageId: 'reg', viewHash: await view('reg1'), signature: APPROVE, signing: s2 }, panelContext('reg1'), deps)) as any).runState).toBe('COMPLETE');
    const v1 = await code('reg1', 'REVOKE');
    expect(((await revokeSeal({ reason: 'Withdrawn', signature: REJECT, signing: v1 }, panelContext('reg1'), deps)) as any).code).toBe('DECLARATION_MISMATCH');
    expect(((await revokeSeal({ reason: 'Withdrawn', signature: REVOKE, signing: v1 }, panelContext('reg1'), deps)) as any).ok).toBe(true);

    const rows = model.statusRows(storage);
    expect(rows.map((r: any) => [r.transitionName, r.data.declarationId, r.data.declarationHash])).toEqual([
      ['REJECT', 'reject', declarationHash(DECLARATION_REJECT.text)],
      ['SIGN_STAGE', 'approve', declarationHash(DECLARATION_V2.text)],
      ['SEAL', 'approve', declarationHash(DECLARATION_V2.text)],
      ['REVOKE', 'revoke', declarationHash(DECLARATION_REVOKE.text)]
    ]);
    jira.currentUser = 'reg1';
    const ev: any = await getSealEvidence({}, panelContext('reg1'), deps);
    expect(ev.declarations).toEqual({ 'approve/2': DECLARATION_V2.text, 'reject/1': DECLARATION_REJECT.text, 'revoke/1': DECLARATION_REVOKE.text });

    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ls-r3-'));
    const keyFile = path.join(dir, 'ls-test-r.pub.pem');
    fs.writeFileSync(keyFile, pair.publicKey.export({ format: 'pem', type: 'spki' }));
    const run = (e: unknown) => {
      const file = path.join(dir, `e-${crypto.randomUUID()}.json`);
      fs.writeFileSync(file, JSON.stringify(e));
      return spawnSync(process.execPath, [path.resolve(__dirname, '../../../tools/verifier/verify-evidence.mjs'), file, keyFile], { encoding: 'utf8' });
    };
    const ok = run(ev);
    expect(ok.status).toBe(0);
    expect(ok.stdout).toContain('PASS declaration texts (approve/2, reject/1, revoke/1)');
    expect(ok.stdout).toContain(`NOTE declaration reject/1 (entries 1): ${JSON.stringify(DECLARATION_REJECT.text)}`);
    // The rejection's text swapped for the approval text, with the hash to match: the verifier checks the key's text
    const swapped = run({ ...ev, declarations: { ...ev.declarations, 'reject/1': DECLARATION_V2.text } });
    expect(swapped.status).toBe(1);
    expect(swapped.stdout).toMatch(/FAIL declaration texts \(entries 1\)/);
    expect(swapped.stdout).not.toContain('NOTE declaration reject/1');
  });
});

describe('a policy save that died after its version and alert (P-1)', () => {
  it('does not block later saves, and the version that never came into force is not exported', async () => {
    jest.spyOn(declaration, 'isDeclarationV2Approved').mockReturnValue(true);
    const jira = new FakeJira(sampleIssue());
    const store = new MemoryStore();
    const deps: LedgerSealDeps = { jira, storage: store, secrets: store };
    jira.jiraAdmins.add('admin');
    jira.currentUser = 'admin';
    const repo = new SigningRepository(store, store);
    expect(((await setSigningPolicyFlow({ enabled: true, projectKeys: ['CHG'] }, panelContext('admin'), deps)) as any).policy.version).toBe(1);
    // Version 2 and its alert were stored, then the invocation died before version 2 came into force
    const set = store.set.bind(store);
    jest.spyOn(store, 'set').mockImplementation(async (key: string, value: any, o?: any) => {
      if (key === 'ls3:sig:policy') throw new Error('invocation ended');
      return set(key, value, o);
    });
    await expect(setSigningPolicyFlow({ enabled: false, projectKeys: [] }, panelContext('admin'), deps)).rejects.toThrow('invocation ended');
    (store.set as jest.Mock).mockRestore();
    expect((await repo.getPolicy())!.version).toBe(1);
    expect((await repo.allPolicies()).map(p => p.version)).toEqual([1, 2]);
    expect((await repo.policiesInForce()).map(p => p.version)).toEqual([1]);
    // A save right after: the version may still be a running save
    expect(((await setSigningPolicyFlow({ enabled: false, projectKeys: [] }, panelContext('admin'), deps)) as any).code).toBe('CONFLICT');
    // Later: the dead version is removed, said so in the alert log, and the save becomes version 2
    // (stands in for the time passing: the stored version's date is moved back past the limit)
    const orphan = store.map.get('ls3:sig:policyver:000002');
    store.map.set('ls3:sig:policyver:000002', { ...orphan, fromDate: new Date(Date.now() - POLICY_SAVE_STALE_MS - 1000).toISOString() });
    const saved: any = await setSigningPolicyFlow({ enabled: false, projectKeys: [] }, panelContext('admin'), deps);
    expect(saved.ok).toBe(true);
    expect(saved.policy.version).toBe(2);
    expect((await repo.getPolicy())!.enabled).toBe(false);
    expect((await repo.policiesInForce()).map(p => p.version)).toEqual([1, 2]);
    const reasons = (await repo.alerts()).map(a => a.reason);
    expect(reasons).toContain('policy version 2 never came into force (its save did not finish)');
  });
});

describe('who may ask for a revoke code on a routed issue (review round 3)', () => {
  it('follows the route\'s revoke rule, read as the user first, and fails closed', async () => {
    const jira = new FakeJira(sampleIssue());
    const storage = new MemoryStore();
    const deps: LedgerSealDeps = { jira, storage, secrets: storage };
    jira.jiraAdmins.add('admin');
    jira.siteGroups = [{ groupId: 'g-qa', name: 'qa' }, { groupId: 'g-reg', name: 'reg' }];
    jira.memberships = { qa1: ['g-qa'], reg1: ['g-reg'] };
    jira.currentUser = 'admin';
    const saved: any = await saveRouteFlow({ name: 'R', stages: STAGES }, panelContext('admin'), deps);
    await bindRouteFlow({ projectKey: 'CHG', issueTypeId: '*', routeId: saved.route.routeId }, panelContext('admin'), deps);
    jira.currentUser = 'reg1';
    expect(await codeRequestRight(deps, '10001', 'REVOKE', null)).toBeNull();
    jira.currentUser = 'qa1';
    expect((await codeRequestRight(deps, '10001', 'REVOKE', null))!.code).toBe('NOT_APPROVER');
    jira.failScope = true;
    expect((await codeRequestRight(deps, '10001', 'REVOKE', null))!.code).toBe('JIRA_UNREACHABLE');
    jira.failScope = false;
    storage.map.set('ls3:run:10001', { state: 'OPEN', recordHash: 'bad' });
    expect((await codeRequestRight(deps, '10001', 'REVOKE', null))!.code).toBe('NOT_APPROVER');
    jest.spyOn(jira, 'getMyGroupIds').mockResolvedValueOnce({ ok: false, error: 'FORBIDDEN' } as any).mockResolvedValueOnce({ ok: false, error: 'UNREACHABLE' } as any);
    expect((await codeRequestRight(deps, '10001', 'REVOKE', null))!.code).toBe('NOT_APPROVER');
    expect((await codeRequestRight(deps, '10001', 'REVOKE', null))!.code).toBe('JIRA_UNREACHABLE');
  });
});
