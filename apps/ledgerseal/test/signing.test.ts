/**
 * Copyright (c) 2026 Asymm Systems. All rights reserved.
 *
 * ADR-016 option B (spec v4 section 14): code signing with a single-use code emailed to the signer's own Atlassian
 * account. One test (or more) per rule: who may ask for a code, rate limits, single use, expiry, binding to person,
 * issue and action, lockout and unlock, the declaration gate, the admin flows, the chained records, and that no code
 * is ever logged, returned or stored in clear.
 *
 * @author Fahim Farook
 */

import * as declaration from '../src/domain/declaration';
import { DECLARATION_V2 } from '../src/domain/declaration';
import { codeEmail, codeMac, hasValidPolicyHash, isPart11Project, macEquals, newCode, nextPolicy, normaliseCode, validLockout, verifyEntries } from '../src/domain/signing';
import { evidenceFlow, LedgerSealDeps, revokeFlow, sealIssueFlow, verifyIssueFlow } from '../src/service/ledger';
import { ackAlertFlow, checkSigningCode, getSigningPolicyFlow, requestCodeFlow, setSigningPolicyFlow, signingAlertsFlow, unlockFlow } from '../src/service/signing';
import { signingAuthority } from '../src/index';
import { SigningRepository } from '../src/storage/signing-repository';
import { FakeJira, MemoryStore, model, panelContext, sampleIssue } from './support/fakes';

jest.mock('@forge/api', () => ({ __esModule: true, default: {}, route: () => '', privacy: { reportPersonalData: jest.fn() } }));
jest.mock('@forge/kvs', () => ({ kvs: {}, WhereConditions: {} }));

const V2 = (extra: Record<string, unknown> = {}) => ({ meaning: 'APPROVAL', declarationVersion: DECLARATION_V2.version, declarationText: DECLARATION_V2.text, ...extra });

let logs: string[] = [];
beforeEach(() => {
  logs = [];
  for (const level of ['error', 'warn', 'log', 'info'] as const) {
    jest.spyOn(console, level).mockImplementation((...args: unknown[]) => {
      logs.push(args.map(a => (typeof a === 'string' ? a : JSON.stringify(a))).join(' '));
    });
  }
});
afterEach(() => jest.restoreAllMocks());

function approve(on = true) {
  return jest.spyOn(declaration, 'isDeclarationV2Approved').mockReturnValue(on);
}

async function setup(opts: { part11?: boolean; lockout?: number } = {}) {
  const jira = new FakeJira(sampleIssue());
  const store = new MemoryStore();
  const deps: LedgerSealDeps = { jira, storage: store, secrets: store };
  jira.approvers.add('alice');
  jira.approvers.add('bob');
  jira.jiraAdmins.add('admin');
  jira.jiraAdmins.add('admin2');
  jira.projects.push({ id: '200', key: 'OPS', name: 'Operations' });
  if (opts.part11 !== false) {
    const spy = approve();
    jira.currentUser = 'admin';
    const saved: any = await setSigningPolicyFlow({ enabled: true, projectKeys: ['CHG'], lockoutThreshold: opts.lockout ?? 5 }, panelContext('admin'), deps);
    expect(saved.ok).toBe(true);
    spy.mockRestore();
  }
  return { jira, store, deps };
}

const as = (jira: FakeJira, who: string) => {
  jira.currentUser = who;
  return panelContext(who);
};

async function askCode(jira: FakeJira, deps: LedgerSealDeps, who: string, action = 'SEAL') {
  const res: any = await requestCodeFlow({ action }, as(jira, who), deps, signingAuthority);
  return { res, code: res.ok ? jira.lastCode(who) : '' };
}

async function signedSeal(jira: FakeJira, deps: LedgerSealDeps, who: string, extra: Record<string, unknown> = {}) {
  const { res, code } = await askCode(jira, deps, who, (extra.action as string) ?? 'SEAL');
  expect(res.ok).toBe(true);
  return sealIssueFlow({ signature: V2(extra.signature as any), signing: { challengeId: res.challengeId, code } }, as(jira, who), deps) as Promise<any>;
}

/** No stored value, secret, return value or log line holds the code in clear. */
function expectCodeNowhere(store: MemoryStore, code: string, ...returned: unknown[]) {
  const all = JSON.stringify([...store.map.entries()]) + JSON.stringify([...store.secrets.entries()]) + JSON.stringify(returned) + logs.join('\n');
  expect(all).not.toContain(code);
}

describe('domain: codes, MACs, policies', () => {
  it('makes 6-digit codes with leading zeros and normalises typed input', () => {
    expect(newCode(() => 42)).toBe('000042');
    expect(newCode()).toMatch(/^\d{6}$/);
    expect(normaliseCode(' 123 456 ')).toBe('123456');
    expect(normaliseCode('123-456')).toBe('123456');
    expect(normaliseCode('12345')).toBeNull();
    expect(normaliseCode('12345a')).toBeNull();
    expect(normaliseCode(123456)).toBeNull();
    expect(normaliseCode('1'.repeat(40))).toBeNull();
  });

  it('compares MACs in constant time and refuses malformed ones', () => {
    const key = Buffer.alloc(32, 7);
    const mac = codeMac(key, 'c1', '123456');
    expect(macEquals(mac, codeMac(key, 'c1', '123456'))).toBe(true);
    expect(macEquals(mac, codeMac(key, 'c1', '123457'))).toBe(false);
    expect(macEquals(mac, codeMac(key, 'c2', '123456'))).toBe(false);
    expect(macEquals(mac, 'zz')).toBe(false);
    expect(macEquals(mac, mac.slice(2))).toBe(false);
    expect(macEquals(mac, ('g' + mac.slice(1)))).toBe(false);
  });

  it('chains policy versions and detects a changed policy', () => {
    const v1 = nextPolicy(null, { enabled: true, projectIds: ['2', '1', '1'], lockoutThreshold: 5, declarationVersion: '2', setByPartyId: 'pty_x', fromDate: 't' });
    expect(v1.version).toBe(1);
    expect(v1.projectIds).toEqual(['1', '2']);
    expect(v1.prevPolicyHash).toBe('0'.repeat(64));
    expect(hasValidPolicyHash(v1)).toBe(true);
    const v2 = nextPolicy(v1, { enabled: false, projectIds: [], lockoutThreshold: 3, declarationVersion: '2', setByPartyId: 'pty_x', fromDate: 't2' });
    expect(v2.prevPolicyHash).toBe(v1.policyHash);
    expect(hasValidPolicyHash({ ...v1, lockoutThreshold: 10 })).toBe(false);
    expect(isPart11Project(v1, '1')).toBe(true);
    expect(isPart11Project(v1, '3')).toBe(false);
    expect(isPart11Project(v2, '1')).toBe(false);
    expect(isPart11Project(null, '1')).toBe(false);
  });

  it('accepts lockout thresholds 3 to 10 only', () => {
    expect(validLockout(3)).toBe(3);
    expect(validLockout(10)).toBe(10);
    expect(validLockout(2)).toBeNull();
    expect(validLockout(11)).toBeNull();
    expect(validLockout(4.5)).toBeNull();
    expect(validLockout('5')).toBeNull();
  });

  it('writes the email with the issue key cleaned and the code only in the body', () => {
    const mail = codeEmail('123456', 'CHG-1<script>', 'REVOKE');
    expect(mail.subject).toBe('LedgerSeal signing code for CHG-1script');
    expect(mail.subject).not.toContain('123456');
    expect(mail.textBody).toContain('revoke the seal of CHG-1script is 123456');
    expect(mail.htmlBody).toContain('<b>123456</b>');
    expect(mail.htmlBody).not.toContain('<script>');
  });
});

describe('code request (spec v4 section 14.2)', () => {
  it('emails one code, as the app, to the caller only, and returns no code', async () => {
    const { jira, store, deps } = await setup();
    approve();
    const { res, code } = await askCode(jira, deps, 'alice');
    expect(res).toEqual({ ok: true, challengeId: expect.any(String), expiresAt: expect.any(String) });
    expect(jira.notifications).toHaveLength(1);
    expect(jira.notifications[0].accountId).toBe('alice');
    expect(Date.parse(res.expiresAt) - Date.now()).toBeGreaterThan(290000);
    expectCodeNowhere(store, code, res);
    // The challenge holds only the keyed hash, and expires from storage
    const key = `ls3:sig:chal:${res.challengeId}`;
    expect(store.map.get(key).codeMac).toMatch(/^[0-9a-f]{64}$/);
    expect(store.ttls.get(key)).toBe(86400);
    expect(store.secrets.has('ls3:sig:key')).toBe(true);
  });

  it('refuses without identity, licence, issue, valid action or stage', async () => {
    const { jira, deps } = await setup();
    approve();
    expect(((await requestCodeFlow({ action: 'SEAL' }, { extension: { issue: { id: '10001' } } }, deps, signingAuthority)) as any).code).toBe('NO_IDENTITY');
    expect(((await requestCodeFlow({ action: 'SEAL' }, { ...as(jira, 'alice'), license: { active: false } }, deps, signingAuthority)) as any).code).toBe('LICENSE_INACTIVE');
    expect(((await requestCodeFlow({ action: 'SEAL' }, { accountId: 'alice' }, deps, signingAuthority)) as any).code).toBe('MISSING_ISSUE');
    expect(((await requestCodeFlow({ action: 'DELETE' }, as(jira, 'alice'), deps, signingAuthority)) as any).code).toBe('INVALID_REQUEST');
    expect(((await requestCodeFlow({ action: 'SIGN_STAGE' }, as(jira, 'alice'), deps, signingAuthority)) as any).code).toBe('INVALID_REQUEST');
    expect(((await requestCodeFlow({ action: 'SIGN_STAGE', stageId: 'Bad Id' }, as(jira, 'alice'), deps, signingAuthority)) as any).code).toBe('INVALID_REQUEST');
    expect(jira.notifications).toHaveLength(0);
  });

  it('checks Browse as the user first and reads nothing as the app when it is refused', async () => {
    const { jira, store, deps } = await setup();
    approve();
    jira.cannotBrowse.add('mallory');
    const sets = store.sets.length;
    const getScope = jest.spyOn(jira, 'getIssueScope');
    const res: any = await requestCodeFlow({ action: 'SEAL' }, as(jira, 'mallory'), deps, signingAuthority);
    expect(res.code).toBe('NO_BROWSE_PERMISSION');
    expect(getScope).not.toHaveBeenCalled();
    expect(store.sets.length).toBe(sets);
    jira.browseError = 'UNREACHABLE';
    expect(((await requestCodeFlow({ action: 'SEAL' }, as(jira, 'alice'), deps, signingAuthority)) as any).code).toBe('JIRA_UNREACHABLE');
  });

  it('sends nothing to a person who may not sign', async () => {
    const { jira, deps } = await setup();
    approve();
    const res: any = await requestCodeFlow({ action: 'SEAL' }, as(jira, 'mallory'), deps, signingAuthority);
    expect(res.code).toBe('NOT_APPROVER');
    expect(((await requestCodeFlow({ action: 'SIGN_STAGE', stageId: 'qa' }, as(jira, 'alice'), deps, signingAuthority)) as any).code).toBe('NOT_APPROVER');
    jira.permissionError = 'UNREACHABLE';
    expect(((await requestCodeFlow({ action: 'SEAL' }, as(jira, 'alice'), deps, signingAuthority)) as any).code).toBe('JIRA_UNREACHABLE');
    jira.permissionError = 'FORBIDDEN';
    expect(((await requestCodeFlow({ action: 'SEAL' }, as(jira, 'alice'), deps, signingAuthority)) as any).code).toBe('NOT_APPROVER');
    expect(jira.notifications).toHaveLength(0);
  });

  it('refuses outside a code-signing project, while the declaration is pending, and with a tampered policy', async () => {
    const { jira, store, deps } = await setup();
    approve(false);
    expect(((await requestCodeFlow({ action: 'SEAL' }, as(jira, 'alice'), deps, signingAuthority)) as any).code).toBe('DECLARATION_PENDING');
    approve(true);
    jira.issue.fields.project = { id: '200', key: 'OPS' };
    expect(((await requestCodeFlow({ action: 'SEAL' }, as(jira, 'alice'), deps, signingAuthority)) as any).code).toBe('NOT_PART11');
    jira.issue.fields.project = { id: '100', key: 'CHG' };
    jira.failScope = true;
    expect(((await requestCodeFlow({ action: 'SEAL' }, as(jira, 'alice'), deps, signingAuthority)) as any).code).toBe('JIRA_UNREACHABLE');
    jira.failScope = false;
    store.map.set('ls3:sig:policy', { ...store.map.get('ls3:sig:policy'), projectIds: ['999'] });
    expect(((await requestCodeFlow({ action: 'SEAL' }, as(jira, 'alice'), deps, signingAuthority)) as any).code).toBe('POLICY_INVALID');
    expect(jira.notifications).toHaveLength(0);
  });

  it('refuses a request within 30 seconds of the last, and more than 5 in 15 minutes, and records each refusal as an alert', async () => {
    const { jira, store, deps } = await setup();
    approve();
    expect((await askCode(jira, deps, 'alice')).res.ok).toBe(true);
    expect((await askCode(jira, deps, 'alice')).res.code).toBe('RATE_LIMITED');
    const repo = new SigningRepository(store, store);
    const party = await model.token(store, 'alice');
    // Window limit: the last-request time is pushed back each time, so only the window counts
    for (let i = 0; i < 4; i++) {
      await repo.saveState({ ...(await repo.getState(party)), lastRequestAt: '2000-01-01T00:00:00.000Z' });
      expect((await askCode(jira, deps, 'alice')).res.ok).toBe(true);
    }
    await repo.saveState({ ...(await repo.getState(party)), lastRequestAt: '2000-01-01T00:00:00.000Z' });
    expect((await askCode(jira, deps, 'alice')).res.code).toBe('RATE_LIMITED');
    expect(jira.notifications).toHaveLength(5);
    const alerts = await repo.alerts();
    expect(alerts.filter(a => a.kind === 'RATE_LIMITED')).toHaveLength(2);
  });

  it('records a send failure, deletes the request and signs nothing (outgoing email off)', async () => {
    const { jira, store, deps } = await setup();
    approve();
    jira.notifyStatus = 403;
    const { res } = await askCode(jira, deps, 'alice');
    expect(res.code).toBe('CODE_NOT_SENT');
    expect([...store.map.keys()].filter(k => k.startsWith('ls3:sig:chal:'))).toEqual([]);
    const alerts = await new SigningRepository(store, store).alerts();
    expect(alerts.map(a => [a.kind, a.reason])).toEqual([['CODE_NOT_SENT', 'HTTP 403']]);
  });

  it('refuses a locked person before sending', async () => {
    const { jira, store, deps } = await setup();
    approve();
    await askCode(jira, deps, 'alice');
    const repo = new SigningRepository(store, store);
    const party = await model.token(store, 'alice');
    await repo.saveState({ ...(await repo.getState(party)), locked: true, lockedAt: 'x', lastRequestAt: null });
    expect((await askCode(jira, deps, 'alice')).res.code).toBe('SIGNING_LOCKED');
    expect(jira.notifications).toHaveLength(1);
  });
});

describe('signing with the code (spec v4 section 14.3)', () => {
  it('seals with the code and records the signing evidence, never the code', async () => {
    const { jira, store, deps } = await setup();
    approve();
    const { res, code } = await askCode(jira, deps, 'alice');
    const sealed: any = await sealIssueFlow({ signature: V2(), signing: { challengeId: res.challengeId, code } }, as(jira, 'alice'), deps);
    expect(sealed.ok).toBe(true);
    const [row] = model.statusRows(store);
    expect(row.data.signing).toEqual({
      method: 'LS_ATL_EMAIL_OTP_1',
      components: 2,
      mode: 'PART11',
      challengeId: res.challengeId,
      policyVersion: 1,
      policyHash: (await new SigningRepository(store, store).getPolicy())!.policyHash
    });
    expect(row.data.declarationVersion).toBe('2');
    const [assignment] = model.assignments(store);
    expect(assignment.declaration).toEqual({ version: '2', text: DECLARATION_V2.text });
    expectCodeNowhere(store, code, sealed, jira.propertyWrites);
    const events = await new SigningRepository(store, store).events(await model.token(store, 'alice'));
    expect(events.map(e => e.kind)).toEqual(['CODE_SENT', 'SIGN_OK']);
    expect(verifyEntries(events)).toBe(true);
  });

  it('needs the code in a code-signing project and refuses declaration version 1 there', async () => {
    const { jira, store, deps } = await setup();
    approve();
    const v1 = { meaning: 'APPROVAL', declarationVersion: declaration.DECLARATION.version, declarationText: declaration.DECLARATION.text };
    expect(((await sealIssueFlow({ signature: v1 }, as(jira, 'alice'), deps)) as any).code).toBe('DECLARATION_MISMATCH');
    expect(((await sealIssueFlow({ signature: V2() }, as(jira, 'alice'), deps)) as any).code).toBe('SIGNING_REQUIRED');
    expect(((await sealIssueFlow({ signature: V2(), signing: 'x' }, as(jira, 'alice'), deps)) as any).code).toBe('SIGNING_REQUIRED');
    expect(model.statusRows(store)).toEqual([]);
  });

  it('refuses everything while declaration version 2 is pending, even with a policy on', async () => {
    const { jira, store, deps } = await setup();
    approve(false);
    expect(((await sealIssueFlow({ signature: V2() }, as(jira, 'alice'), deps)) as any).code).toBe('DECLARATION_PENDING');
    const policy = (await new SigningRepository(store, store).getPolicy())!;
    const direct = await checkSigningCode(deps, { accountId: 'alice', partyId: 'pty_x', issueId: '10001', action: 'SEAL', stageId: null, policy, signing: {} });
    expect((direct as any).code).toBe('DECLARATION_PENDING');
    expect(model.statusRows(store)).toEqual([]);
  });

  it('keeps v3 behaviour outside code-signing projects: declaration 1, no code, no extra Jira read', async () => {
    const { jira, store, deps } = await setup({ part11: false });
    const scope = jest.spyOn(jira, 'getIssueScope');
    const v1 = { meaning: 'APPROVAL', declarationVersion: declaration.DECLARATION.version, declarationText: declaration.DECLARATION.text };
    const sealed: any = await sealIssueFlow({ signature: v1 }, as(jira, 'alice'), deps);
    expect(sealed.ok).toBe(true);
    expect(scope).not.toHaveBeenCalled();
    expect(model.statusRows(store)[0].data.signing).toBeUndefined();
    // A policy that names another project leaves this one in v3 mode, after one project read
    const { jira: j2, deps: d2 } = await setup();
    j2.issue.fields.project = { id: '200', key: 'OPS' };
    expect(((await sealIssueFlow({ signature: v1 }, as(j2, 'alice'), d2)) as any).ok).toBe(true);
  });

  it('uses each code once', async () => {
    const { jira, store, deps } = await setup();
    approve();
    const { res, code } = await askCode(jira, deps, 'alice');
    const signing = { challengeId: res.challengeId, code };
    expect(((await sealIssueFlow({ signature: V2(), signing }, as(jira, 'alice'), deps)) as any).ok).toBe(true);
    const again: any = await sealIssueFlow({ signature: V2(), signing }, as(jira, 'alice'), deps);
    expect(again.code).toBe('CODE_REUSED');
    expect(model.statusRows(store)).toHaveLength(1);
    const alerts = await new SigningRepository(store, store).alerts();
    expect(alerts.map(a => a.kind)).toEqual(['CODE_REUSED']);
  });

  it('refuses a wrong code and counts it, without saying which part was wrong', async () => {
    const { jira, store, deps } = await setup();
    approve();
    const { res, code } = await askCode(jira, deps, 'alice');
    const wrong = code === '000000' ? '000001' : '000000';
    const out: any = await sealIssueFlow({ signature: V2(), signing: { challengeId: res.challengeId, code: wrong } }, as(jira, 'alice'), deps);
    expect(out.code).toBe('SIGNING_FAILED');
    expect(out.message).not.toMatch(/challenge|digit/i);
    expect(model.statusRows(store)).toEqual([]);
    expect(((await sealIssueFlow({ signature: V2(), signing: { challengeId: res.challengeId, code: 'abc' } }, as(jira, 'alice'), deps)) as any).code).toBe('SIGNING_FAILED');
    // The right code still works within the request's 3 wrong answers
    expect(((await sealIssueFlow({ signature: V2(), signing: { challengeId: res.challengeId, code } }, as(jira, 'alice'), deps)) as any).ok).toBe(true);
  });

  it('voids a request after 3 wrong codes: the right code then fails too', async () => {
    const { jira, store, deps } = await setup({ lockout: 10 });
    approve();
    const { res, code } = await askCode(jira, deps, 'alice');
    const wrong = code === '000000' ? '000001' : '000000';
    for (let i = 0; i < 3; i++) await sealIssueFlow({ signature: V2(), signing: { challengeId: res.challengeId, code: wrong } }, as(jira, 'alice'), deps);
    const out: any = await sealIssueFlow({ signature: V2(), signing: { challengeId: res.challengeId, code } }, as(jira, 'alice'), deps);
    expect(out.code).toBe('SIGNING_FAILED');
    expect(model.statusRows(store)).toEqual([]);
  });

  it('binds a code to its person, issue and action', async () => {
    const { jira, store, deps } = await setup();
    approve();
    const { res, code } = await askCode(jira, deps, 'alice');
    // Another approver cannot use Alice's code
    expect(((await sealIssueFlow({ signature: V2(), signing: { challengeId: res.challengeId, code } }, as(jira, 'bob'), deps)) as any).code).toBe('SIGNING_FAILED');
    // A code for revoking does not seal
    jira.currentUser = 'alice';
    const repo = new SigningRepository(store, store);
    await repo.saveState({ ...(await repo.getState(await model.token(store, 'alice'))), lastRequestAt: null });
    const revokeCode = await askCode(jira, deps, 'alice', 'REVOKE');
    expect(((await sealIssueFlow({ signature: V2(), signing: { challengeId: revokeCode.res.challengeId, code: revokeCode.code } }, as(jira, 'alice'), deps)) as any).code).toBe('SIGNING_FAILED');
    // A code for another issue does not seal this one
    const policy = (await repo.getPolicy())!;
    const other = await checkSigningCode(deps, { accountId: 'alice', partyId: await model.token(store, 'alice'), issueId: '99999', action: 'SEAL', stageId: null, policy, signing: { challengeId: res.challengeId, code } });
    expect((other as any).code).toBe('SIGNING_FAILED');
    expect(((await sealIssueFlow({ signature: V2(), signing: { challengeId: 'nope', code } }, as(jira, 'alice'), deps)) as any).code).toBe('SIGNING_FAILED');
    expect(model.statusRows(store)).toEqual([]);
  });

  it('refuses an expired code without counting it towards the lockout', async () => {
    const { jira, store, deps } = await setup({ lockout: 3 });
    approve();
    const { res, code } = await askCode(jira, deps, 'alice');
    const key = `ls3:sig:chal:${res.challengeId}`;
    store.map.set(key, { ...store.map.get(key), expiresAt: '2000-01-01T00:00:00.000Z' });
    for (let i = 0; i < 4; i++) {
      expect(((await sealIssueFlow({ signature: V2(), signing: { challengeId: res.challengeId, code } }, as(jira, 'alice'), deps)) as any).code).toBe('CODE_EXPIRED');
    }
    const state = await new SigningRepository(store, store).getState(await model.token(store, 'alice'));
    expect(state.locked).toBe(false);
  });

  it('locks after N failures in a row, refuses the right code while locked, and alerts', async () => {
    const { jira, store, deps } = await setup({ lockout: 3 });
    approve();
    const repo = new SigningRepository(store, store);
    const failOnce = async () => {
      const party = await model.token(store, 'alice').catch(() => null);
      if (party) await repo.saveState({ ...(await repo.getState(party)), lastRequestAt: null });
      const { res, code } = await askCode(jira, deps, 'alice');
      const wrong = code === '000000' ? '000001' : '000000';
      return sealIssueFlow({ signature: V2(), signing: { challengeId: res.challengeId, code: wrong } }, as(jira, 'alice'), deps) as Promise<any>;
    };
    expect((await failOnce()).code).toBe('SIGNING_FAILED');
    expect((await failOnce()).code).toBe('SIGNING_FAILED');
    expect((await failOnce()).code).toBe('SIGNING_LOCKED');
    const party = await model.token(store, 'alice');
    expect((await repo.getState(party)).locked).toBe(true);
    expect((await askCode(jira, deps, 'alice')).res.code).toBe('SIGNING_LOCKED');
    const kinds = (await repo.alerts()).map(a => a.kind);
    expect(kinds).toEqual(['SIGN_FAIL', 'SIGN_FAIL', 'SIGN_FAIL', 'LOCKED']);
    expect(verifyEntries(await repo.alerts())).toBe(true);
  });

  it('resets the failures in a row after a success', async () => {
    const { jira, store, deps } = await setup({ lockout: 3 });
    approve();
    const repo = new SigningRepository(store, store);
    const fresh = async () => {
      const party = await model.token(store, 'alice').catch(() => null);
      if (party) await repo.saveState({ ...(await repo.getState(party)), lastRequestAt: null });
      return askCode(jira, deps, 'alice');
    };
    let r = await fresh();
    const wrong = (c: string) => (c === '000000' ? '000001' : '000000');
    await sealIssueFlow({ signature: V2(), signing: { challengeId: r.res.challengeId, code: wrong(r.code) } }, as(jira, 'alice'), deps);
    await sealIssueFlow({ signature: V2(), signing: { challengeId: r.res.challengeId, code: wrong(r.code) } }, as(jira, 'alice'), deps);
    expect(((await sealIssueFlow({ signature: V2(), signing: { challengeId: r.res.challengeId, code: r.code } }, as(jira, 'alice'), deps)) as any).ok).toBe(true);
    r = await fresh();
    await sealIssueFlow({ signature: V2(), signing: { challengeId: r.res.challengeId, code: wrong(r.code) } }, as(jira, 'alice'), deps);
    await sealIssueFlow({ signature: V2(), signing: { challengeId: r.res.challengeId, code: wrong(r.code) } }, as(jira, 'alice'), deps);
    expect((await repo.getState(await model.token(store, 'alice'))).locked).toBe(false);
  });

  it('needs a code with the RESEAL action to approve changes, and a REVOKE code to revoke', async () => {
    const { jira, store, deps } = await setup();
    approve();
    expect((await signedSeal(jira, deps, 'alice')).ok).toBe(true);
    jira.edit('carol', new Date(Date.now() + 1000).toISOString(), 'summary', 'Changed');
    // The issue changed: a SEAL code does not approve the changes
    const repo = new SigningRepository(store, store);
    await repo.saveState({ ...(await repo.getState(await model.token(store, 'bob').catch(() => 'none'))), partyId: await model.token(store, 'bob'), lastRequestAt: null });
    const sealCode = await askCode(jira, deps, 'bob', 'SEAL');
    expect(((await sealIssueFlow({ signature: V2({ reason: 'ok' }), signing: { challengeId: sealCode.res.challengeId, code: sealCode.code } }, as(jira, 'bob'), deps)) as any).code).toBe('SIGNING_FAILED');
    await repo.saveState({ ...(await repo.getState(await model.token(store, 'bob'))), lastRequestAt: null });
    const approveCode = await askCode(jira, deps, 'bob', 'RESEAL');
    const approved: any = await sealIssueFlow({ signature: V2({ reason: 'ok' }), signing: { challengeId: approveCode.res.challengeId, code: approveCode.code } }, as(jira, 'bob'), deps);
    expect(approved.ok).toBe(true);
    expect(model.statusRows(store).at(-1).transitionName).toBe('RESEAL');
    // Revoke: no code refused, a REVOKE code accepted
    expect(((await revokeFlow({ reason: 'stop' }, as(jira, 'alice'), deps)) as any).code).toBe('SIGNING_REQUIRED');
    await repo.saveState({ ...(await repo.getState(await model.token(store, 'alice'))), lastRequestAt: null });
    const revokeCode = await askCode(jira, deps, 'alice', 'REVOKE');
    const revoked: any = await revokeFlow({ reason: 'stop', signing: { challengeId: revokeCode.res.challengeId, code: revokeCode.code } }, as(jira, 'alice'), deps);
    expect(revoked.ok).toBe(true);
    expect(model.statusRows(store).at(-1).data.signing.method).toBe('LS_ATL_EMAIL_OTP_1');
  });

  it('fails closed when the stored policy fails its hash', async () => {
    const { jira, store, deps } = await setup();
    approve();
    store.map.set('ls3:sig:policy', { ...store.map.get('ls3:sig:policy'), enabled: false });
    expect(((await sealIssueFlow({ signature: V2() }, as(jira, 'alice'), deps)) as any).code).toBe('POLICY_INVALID');
    const panel: any = await verifyIssueFlow({}, as(jira, 'alice'), deps);
    expect(panel.part11).toEqual(expect.objectContaining({ on: true, invalid: true }));
  });

  it('tells the panel when the project needs a code, and which declaration to show', async () => {
    const { jira, deps } = await setup();
    approve(false);
    const pending: any = await verifyIssueFlow({}, as(jira, 'alice'), deps);
    expect(pending.part11).toEqual({ on: true, invalid: false, declaration: { version: '2', text: DECLARATION_V2.text }, pending: true });
    approve(true);
    jira.issue.fields.project = { id: '200', key: 'OPS' };
    const off: any = await verifyIssueFlow({}, as(jira, 'alice'), deps);
    expect(off.part11).toEqual({ on: false, invalid: false, declaration: { version: '1', text: declaration.DECLARATION.text }, pending: false });
  });
});

describe('admin page (spec v4 section 14.4)', () => {
  it('refuses non-admins and failed admin checks for every admin flow', async () => {
    const { jira, deps } = await setup({ part11: false });
    for (const flow of [
      () => getSigningPolicyFlow(as(jira, 'alice'), deps),
      () => setSigningPolicyFlow({ enabled: false, projectKeys: [] }, as(jira, 'alice'), deps),
      () => signingAlertsFlow(as(jira, 'alice'), deps),
      () => ackAlertFlow({ seq: 1 }, as(jira, 'alice'), deps),
      () => unlockFlow({ accountId: 'bob', reason: 'r' }, as(jira, 'alice'), deps)
    ]) {
      expect(((await flow()) as any).code).toBe('NOT_ADMIN');
    }
    jira.failAdminCheck = true;
    expect(((await getSigningPolicyFlow(as(jira, 'admin'), deps)) as any).code).toBe('JIRA_UNREACHABLE');
  });

  it('cannot turn code signing on while the declaration is pending (Q-03)', async () => {
    const { jira, store, deps } = await setup({ part11: false });
    approve(false);
    const res: any = await setSigningPolicyFlow({ enabled: true, projectKeys: ['CHG'], lockoutThreshold: 5 }, as(jira, 'admin'), deps);
    expect(res.code).toBe('DECLARATION_PENDING');
    expect(store.map.has('ls3:sig:policy')).toBe(false);
    // Saving it off (choosing projects ahead) is allowed
    const off: any = await setSigningPolicyFlow({ enabled: false, projectKeys: ['CHG'] }, as(jira, 'admin'), deps);
    expect(off.ok).toBe(true);
    expect(off.policy.enabled).toBe(false);
    const got: any = await getSigningPolicyFlow(as(jira, 'admin'), deps);
    expect(got).toEqual(expect.objectContaining({ ok: true, policyValid: true, declaration: { version: '2', text: DECLARATION_V2.text, approved: false } }));
    expect(got.projects).toEqual([{ id: '100', key: 'CHG', name: 'Change' }]);
  });

  it('validates the policy and the projects, and keeps every version', async () => {
    const { jira, store, deps } = await setup({ part11: false });
    approve();
    const ctx = as(jira, 'admin');
    expect(((await setSigningPolicyFlow({ enabled: 'yes', projectKeys: ['CHG'] }, ctx, deps)) as any).code).toBe('INVALID_REQUEST');
    expect(((await setSigningPolicyFlow({ enabled: true, projectKeys: ['CHG'], lockoutThreshold: 99 }, ctx, deps)) as any).code).toBe('INVALID_REQUEST');
    expect(((await setSigningPolicyFlow({ enabled: true, projectKeys: ['bad key'] }, ctx, deps)) as any).code).toBe('INVALID_REQUEST');
    expect(((await setSigningPolicyFlow({ enabled: true, projectKeys: [] }, ctx, deps)) as any).code).toBe('INVALID_REQUEST');
    expect(((await setSigningPolicyFlow({ enabled: true, projectKeys: ['NOPE'] }, ctx, deps)) as any).code).toBe('INVALID_REQUEST');
    expect(((await setSigningPolicyFlow({ enabled: true, projectKeys: new Array(101).fill('CHG') }, ctx, deps)) as any).code).toBe('INVALID_REQUEST');
    jira.failProjects = true;
    expect(((await setSigningPolicyFlow({ enabled: true, projectKeys: ['CHG'] }, ctx, deps)) as any).code).toBe('JIRA_UNREACHABLE');
    jira.failProjects = false;
    const a: any = await setSigningPolicyFlow({ enabled: true, projectKeys: ['CHG', 'OPS'] }, ctx, deps);
    const b: any = await setSigningPolicyFlow({ enabled: true, projectKeys: ['OPS'], lockoutThreshold: 4 }, ctx, deps);
    expect(a.policy.projectIds).toEqual(['100', '200']);
    expect(b.policy.prevPolicyHash).toBe(a.policy.policyHash);
    const versions = await new SigningRepository(store, store).allPolicies();
    expect(versions.map(v => v.version)).toEqual([1, 2]);
    expect(versions[0].setByPartyId).toMatch(/^pty_/);
    // A lost race on the same version number saves nothing
    store.map.delete('ls3:sig:policy');
    store.map.set('ls3:sig:policy', versions[0]);
    expect(((await setSigningPolicyFlow({ enabled: true, projectKeys: ['OPS'] }, ctx, deps)) as any).code).toBe('CONFLICT');
  });

  it('lists open alerts with the person, acknowledges one as a new chained entry, and shows the locked people', async () => {
    const { jira, store, deps } = await setup({ lockout: 3 });
    approve();
    jira.notifyStatus = 500;
    await askCode(jira, deps, 'alice');
    const repo = new SigningRepository(store, store);
    await repo.saveState({ ...(await repo.getState(await model.token(store, 'alice'))), locked: true, lockedAt: 't' });
    const list: any = await signingAlertsFlow(as(jira, 'admin'), deps);
    expect(list.alerts).toEqual([expect.objectContaining({ seq: 1, kind: 'CODE_NOT_SENT', accountId: 'alice', issueId: '10001' })]);
    expect(list.locked).toEqual([{ accountId: 'alice', lockedAt: 't' }]);
    expect(((await ackAlertFlow({ seq: 'x' }, as(jira, 'admin'), deps)) as any).code).toBe('INVALID_REQUEST');
    expect(((await ackAlertFlow({ seq: 9 }, as(jira, 'admin'), deps)) as any).code).toBe('INVALID_REQUEST');
    expect(((await ackAlertFlow({ seq: 1 }, as(jira, 'admin'), deps)) as any).ok).toBe(true);
    expect(((await ackAlertFlow({ seq: 1 }, as(jira, 'admin'), deps)) as any).already).toBe(true);
    expect(((await signingAlertsFlow(as(jira, 'admin'), deps)) as any).alerts).toEqual([]);
    const log = await repo.alerts();
    expect(log.map(e => e.kind)).toEqual(['CODE_NOT_SENT', 'ACK']);
    expect(log[1].ackSeq).toBe(1);
    expect(verifyEntries(log)).toBe(true);
  });

  it('unlocks only with a reason, never for oneself, and only a locked person', async () => {
    const { jira, store, deps } = await setup();
    approve();
    await askCode(jira, deps, 'admin2');
    const repo = new SigningRepository(store, store);
    const party = await model.token(store, 'admin2');
    expect(((await unlockFlow({ accountId: 'admin2', reason: 'ok' }, as(jira, 'admin'), deps)) as any).message).toMatch(/not locked/);
    await repo.saveState({ ...(await repo.getState(party)), locked: true, lockedAt: 't' });
    expect(((await unlockFlow({ accountId: 'admin2', reason: ' ' }, as(jira, 'admin'), deps)) as any).code).toBe('REASON_REQUIRED');
    expect(((await unlockFlow({ reason: 'ok' }, as(jira, 'admin'), deps)) as any).code).toBe('INVALID_REQUEST');
    expect(((await unlockFlow({ accountId: 'admin2', reason: 'ok' }, as(jira, 'admin2'), deps)) as any).code).toBe('SELF_UNLOCK');
    const before = (await repo.getState(party)).series;
    expect(((await unlockFlow({ accountId: 'admin2', reason: 'Phone was replaced' }, as(jira, 'admin'), deps)) as any).ok).toBe(true);
    const after = await repo.getState(party);
    expect(after.locked).toBe(false);
    expect(after.series).toBe(before + 1);
    const events = await repo.events(party);
    expect(events.at(-1)).toEqual(expect.objectContaining({ kind: 'UNLOCKED', reason: 'Phone was replaced', byPartyId: await model.token(store, 'admin') }));
  });
});

describe('records and evidence', () => {
  it('detects a changed or removed entry in the signing history', async () => {
    const { jira, store, deps } = await setup();
    approve();
    await signedSeal(jira, deps, 'alice');
    const repo = new SigningRepository(store, store);
    const events = await repo.events(await model.token(store, 'alice'));
    expect(verifyEntries(events)).toBe(true);
    expect(verifyEntries([{ ...events[0], kind: 'SIGN_OK' }, events[1]])).toBe(false);
    expect(verifyEntries([events[1]])).toBe(false);
  });

  it('continues a chain whose head lags behind, and refuses a store that never accepts', async () => {
    const store = new MemoryStore();
    const repo = new SigningRepository(store, store);
    await repo.appendAlert({ at: 't1', kind: 'SIGN_FAIL' });
    store.map.delete('ls3:sig:alerthead');
    const second = await repo.appendAlert({ at: 't2', kind: 'LOCKED' });
    expect(second.seq).toBe(2);
    expect(verifyEntries(await repo.alerts())).toBe(true);
    const stuck = new MemoryStore();
    stuck.createIfAbsent = async () => false;
    await expect(new SigningRepository(stuck, stuck).appendAlert({ at: 't', kind: 'ACK' })).rejects.toThrow('could not be appended');
    await expect(new SigningRepository(store, null).siteKey()).rejects.toThrow('no secret store');
  });

  it('creates the site key once, and a writer that loses the race uses the winner', async () => {
    const store = new MemoryStore();
    const repo = new SigningRepository(store, store);
    const first = await repo.siteKey();
    expect(await repo.siteKey()).toEqual(first);
    const racing = new MemoryStore();
    let reads = 0;
    racing.getSecret = async () => (reads++ === 0 ? undefined : { key: Buffer.alloc(32, 1).toString('base64') });
    racing.createSecretIfAbsent = async () => false;
    expect(await new SigningRepository(racing, racing).siteKey()).toEqual(Buffer.alloc(32, 1));
    const broken = new MemoryStore();
    broken.getSecret = async () => undefined;
    broken.createSecretIfAbsent = async () => false;
    await expect(new SigningRepository(broken, broken).siteKey()).rejects.toThrow('could not be read');
    await expect(repo.savePolicy({ policyHash: 'x' } as any)).rejects.toThrow('wrong hash');
    expect(await repo.getChallenge('../../x')).toBeNull();
  });

  it('exports format 2 with the policy versions once a row is code-signed, and format 1 otherwise', async () => {
    const { jira, deps } = await setup();
    approve();
    await signedSeal(jira, deps, 'alice');
    const ev: any = await evidenceFlow({}, as(jira, 'alice'), deps);
    expect(ev.format).toBe('ledgerseal-evidence/2');
    expect(ev.signingPolicies).toHaveLength(1);
    expect(ev.verification.join(' ')).toContain('1.4.0');
    const { jira: j2, deps: d2 } = await setup({ part11: false });
    const v1 = { meaning: 'APPROVAL', declarationVersion: declaration.DECLARATION.version, declarationText: declaration.DECLARATION.text };
    await sealIssueFlow({ signature: v1 }, as(j2, 'alice'), d2);
    const plain: any = await evidenceFlow({}, as(j2, 'alice'), d2);
    expect(plain.format).toBe('ledgerseal-evidence/1');
    expect(plain.signingPolicies).toBeUndefined();
  });

  it('never writes a code to a log line, in success or failure paths', async () => {
    const { jira, store, deps } = await setup({ lockout: 3 });
    approve();
    const codes: string[] = [];
    const repo = new SigningRepository(store, store);
    for (let i = 0; i < 3; i++) {
      const party = await model.token(store, 'alice').catch(() => null);
      if (party) await repo.saveState({ ...(await repo.getState(party)), lastRequestAt: null });
      const { res, code } = await askCode(jira, deps, 'alice');
      codes.push(code);
      await sealIssueFlow({ signature: V2(), signing: { challengeId: res.challengeId, code: code === '000000' ? '000001' : '000000' } }, as(jira, 'alice'), deps);
    }
    for (const code of codes) expectCodeNowhere(store, code);
  });
});

describe('declaration coverage in the seal record (owner approval of v2, 2026-11-08)', () => {
  it('stores v2 text in the hashed assignment, its version in the chained row, and fails the integrity check if the text changes', async () => {
    const { jira, store, deps } = await setup();
    await signedSeal(jira, deps, 'alice');
    const [row] = model.statusRows(store);
    expect(row.data.declarationVersion).toBe('2');
    const [assignment] = model.assignments(store);
    expect(assignment.declaration).toEqual({ version: '2', text: DECLARATION_V2.text });
    expect(assignment.declaration.text).toContain('my organisation treats this electronic signature as the legally binding equivalent');
    expect((await verifyIssueFlow({}, as(jira, 'alice'), deps) as any).status).toBe('SEAL_VALID');
    const key = [...store.map.keys()].find(k => k.startsWith('ls3:wepa:10001:'))!;
    store.map.set(key, { ...store.map.get(key), declaration: { version: '2', text: 'Some other text' } });
    expect((await verifyIssueFlow({}, as(jira, 'alice'), deps) as any).status).toBe('RECORD_INVALID');
  });

  it('keeps a version 1 seal valid: its stored text and version are unchanged', async () => {
    const { jira, store, deps } = await setup({ part11: false });
    const v1 = { meaning: 'APPROVAL', declarationVersion: declaration.DECLARATION.version, declarationText: declaration.DECLARATION.text };
    await sealIssueFlow({ signature: v1 }, as(jira, 'alice'), deps);
    const [assignment] = model.assignments(store);
    expect(assignment.declaration).toEqual({ version: '1', text: declaration.DECLARATION.text });
    expect(model.statusRows(store)[0].data.declarationVersion).toBe('1');
    expect((await verifyIssueFlow({}, as(jira, 'alice'), deps) as any).status).toBe('SEAL_VALID');
  });

  it('refuses a seal that sends the earlier v2 draft text', async () => {
    const { jira, deps } = await setup();
    const { res, code } = await askCode(jira, deps, 'alice');
    // The earlier draft differed only in its second sentence ("My electronic signature is ...")
    const draft = DECLARATION_V2.text.replace('I understand that my organisation treats this electronic signature as', 'My electronic signature is');
    expect(draft).not.toBe(DECLARATION_V2.text);
    const out: any = await sealIssueFlow({ signature: V2({ declarationText: draft }), signing: { challengeId: res.challengeId, code } }, as(jira, 'alice'), deps);
    expect(out.code).toBe('DECLARATION_MISMATCH');
  });
});
