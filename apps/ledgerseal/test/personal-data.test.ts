/**
 * Copyright (c) 2026 Asymm Systems. All rights reserved.
 *
 * ADR-010 decisions 5 and 9 (readiness review B1, F-11): the weekly personal data report, the erasure of a
 * closed account, and the deletion of a deleted issue's records.
 *
 * @author Fahim Farook
 */

import { onIssueDeleted, personalDataReport, revokeSeal, sealIssue, setApproverPolicy, verifyIssue } from '../src/index';
import { PARTY_PREFIX } from '../src/storage/party-repository';
import { AccountUpdate, ReportedAccount } from '../src/service/personal-data';
import { FakeJira, MemoryStore, model, panelContext, sampleIssue, validSignature } from './support/fakes';

jest.mock('@forge/api', () => ({ __esModule: true, default: {}, route: () => '', privacy: { reportPersonalData: jest.fn() } }));
jest.mock('@forge/kvs', () => ({ kvs: {}, WhereConditions: {} }));

function setup() {
  const jira = new FakeJira(sampleIssue());
  jira.approvers = new Set(['ann', 'bob']);
  jira.jiraAdmins = new Set(['admin']);
  jira.siteGroups = [{ groupId: 'g1', name: 'release-approvers' }];
  const storage = new MemoryStore();
  const as = (user: string | null) => {
    jira.currentUser = user;
    return { jira, storage };
  };
  return { jira, storage, as };
}

function reporter(closed: string[] = []) {
  const calls: ReportedAccount[][] = [];
  const report = async (accounts: ReportedAccount[]): Promise<AccountUpdate[]> => {
    calls.push(accounts);
    return accounts.map(a => ({ accountId: a.accountId, status: closed.includes(a.accountId) ? 'closed' : 'updated' }));
  };
  return { calls, report };
}

describe('ADR-010 weekly personal data report', () => {
  it('reports nothing and calls nothing when the app holds no account id', async () => {
    const { calls, report } = reporter();
    await expect(personalDataReport({}, {}, { jira: new FakeJira(sampleIssue()), storage: new MemoryStore() }, report)).resolves.toMatchObject({ reported: 0, closed: [] });
    expect(calls).toEqual([]);
  });

  it('reports every account in the map once, with its newest update, and the policy admin', async () => {
    const { jira, storage, as } = setup();
    await sealIssue({ signature: validSignature() }, panelContext('ann'), as('ann'));
    jira.edit('bob', '2099-01-01T00:00:00.000Z', 'summary', 'changed');
    await verifyIssue({}, panelContext('viewer'), as('viewer'));
    await setApproverPolicy({ groupIds: ['g1'] }, panelContext('admin'), as('admin'));
    const { calls, report } = reporter();
    const result = await personalDataReport({}, {}, { jira: new FakeJira(sampleIssue()), storage }, report);
    expect(result).toMatchObject({ reported: 3, closed: [] });
    expect(calls[0].map(a => a.accountId)).toEqual(['admin', 'ann', 'bob']);
    for (const a of calls[0]) expect(Number.isNaN(Date.parse(a.updatedAt))).toBe(false);
  });

  it('keeps the newest time when two entries name one account, and fills a missing time', async () => {
    const storage = new MemoryStore();
    storage.map.set(`${PARTY_PREFIX}pty_${'1'.repeat(32)}`, { accountId: 'ann', updatedAt: '2026-01-01T00:00:00.000Z' });
    storage.map.set(`${PARTY_PREFIX}pty_${'2'.repeat(32)}`, { accountId: 'ann', updatedAt: '2026-06-01T00:00:00.000Z' });
    storage.map.set(`${PARTY_PREFIX}pty_${'3'.repeat(32)}`, { accountId: 'ann', updatedAt: '2026-03-01T00:00:00.000Z' });
    storage.map.set(`${PARTY_PREFIX}pty_${'4'.repeat(32)}`, { accountId: 'zed', updatedAt: '' });
    const { calls, report } = reporter();
    await personalDataReport({}, {}, { jira: new FakeJira(sampleIssue()), storage }, report);
    expect(calls[0]).toEqual([
      { accountId: 'ann', updatedAt: '2026-06-01T00:00:00.000Z' },
      { accountId: 'zed', updatedAt: new Date(0).toISOString() }
    ]);
  });

  it('erases a closed account: its map key goes, the seal stays valid, and the records do not change', async () => {
    const { jira, storage, as } = setup();
    await sealIssue({ signature: validSignature() }, panelContext('ann'), as('ann'));
    await setApproverPolicy({ groupIds: ['g1'] }, panelContext('admin'), as('admin'));
    const ann = await model.token(storage, 'ann');
    const records = JSON.stringify([...storage.map.entries()].filter(([k]) => k.startsWith('ls3:w') || k.startsWith('ls3:content')));
    const { report } = reporter(['ann', 'admin']);
    await expect(personalDataReport({}, {}, { jira: new FakeJira(sampleIssue()), storage }, report)).resolves.toMatchObject({ reported: 2, closed: ['admin', 'ann'] });
    expect(storage.map.has(PARTY_PREFIX + ann)).toBe(false);
    expect((await storage.get('ls3:partyrole:LS_APPROVER')).setByPartyId).toBeNull();
    expect(JSON.stringify([...storage.map.values()])).not.toMatch(/"ann"|"admin"/);
    expect(JSON.stringify([...storage.map.entries()].filter(([k]) => k.startsWith('ls3:w') || k.startsWith('ls3:content')))).toBe(records);
    const view: any = await verifyIssue({}, panelContext('viewer'), as('viewer'));
    expect(view.status).toBe('SEAL_VALID');
    expect(view.seal.sealedByClosed).toBe(true);
    // A later run has nothing left to report about them
    const next = reporter();
    await personalDataReport({}, {}, { jira: new FakeJira(sampleIssue()), storage }, next.report);
    expect(next.calls).toEqual([]);
    expect(jira.propertyWrites.every(w => !JSON.stringify(w.body).includes('ann'))).toBe(true);
  });

  it('shows a closed revoker as a closed account, and keeps the revoke reason', async () => {
    const { storage, as } = setup();
    await sealIssue({ signature: validSignature() }, panelContext('ann'), as('ann'));
    await revokeSeal({ reason: 'Wrong release' }, panelContext('bob'), as('bob'));
    const { report } = reporter(['bob']);
    await personalDataReport({}, {}, { jira: new FakeJira(sampleIssue()), storage }, report);
    const view: any = await verifyIssue({}, panelContext('viewer'), as('viewer'));
    expect(view.status).toBe('SEAL_REVOKED');
    expect(view.seal.revocation).toMatchObject({ revokedByAccountId: '', revokedByClosed: true, reason: 'Wrong release' });
  });

  it('logs and returns an empty result when the report call fails', async () => {
    const { storage, as } = setup();
    await sealIssue({ signature: validSignature() }, panelContext('ann'), as('ann'));
    const error = jest.spyOn(console, 'error').mockImplementation(() => undefined);
    await expect(personalDataReport({}, {}, { jira: new FakeJira(sampleIssue()), storage }, async () => Promise.reject(new Error('429')))).resolves.toEqual({ reported: 0, closed: [] });
    expect(error).toHaveBeenCalledWith('LedgerSeal: the personal data report failed', expect.any(Error));
    error.mockRestore();
  });
});

describe('F-11 deleted issues', () => {
  it('deletes the sealed issue, every seal, the history and every snapshot of a deleted issue, and only that issue', async () => {
    const { jira, storage, as } = setup();
    await sealIssue({ signature: validSignature() }, panelContext('ann'), as('ann'));
    jira.edit('bob', '2099-01-01T00:00:00.000Z', 'summary', 'changed');
    await sealIssue({ signature: validSignature({ reason: 'Agreed' }) }, panelContext('ann'), as('ann'));
    storage.map.set('cert:active:10001', { legacy: true });
    storage.map.set('ls3:we:20002', { other: true });
    storage.map.set('ls3:content:other-cert:0', 'x');
    const mine = [...storage.map.keys()].filter(k => k.includes('10001') || (k.startsWith('ls3:content:') && k !== 'ls3:content:other-cert:0'));
    expect(mine.length).toBeGreaterThanOrEqual(7);
    const log = jest.spyOn(console, 'log').mockImplementation(() => undefined);
    const result = await onIssueDeleted({ issue: { id: '10001' } }, {}, storage);
    log.mockRestore();
    expect(result.deleted).toBe(mine.length);
    expect([...storage.map.keys()].filter(k => k.includes('10001'))).toEqual([]);
    expect([...storage.map.keys()].filter(k => k.startsWith('ls3:content:') && k !== 'ls3:content:other-cert:0')).toEqual([]);
    expect(storage.map.has('ls3:we:20002')).toBe(true);
    expect(storage.map.has('ls3:content:other-cert:0')).toBe(true);
  });

  it('does nothing without an issue id, and logs a storage failure without throwing', async () => {
    await expect(onIssueDeleted({}, {}, new MemoryStore())).resolves.toEqual({ deleted: 0 });
    const broken = new MemoryStore();
    broken.query = async () => Promise.reject(new Error('KVS down'));
    const error = jest.spyOn(console, 'error').mockImplementation(() => undefined);
    await expect(onIssueDeleted({ issue: { id: '1' } }, {}, broken)).resolves.toEqual({ deleted: 0 });
    error.mockRestore();
  });

  it('a reseal deletes the snapshot of the seal it replaces, and keeps going if that delete fails', async () => {
    const { jira, storage, as } = setup();
    await sealIssue({ signature: validSignature() }, panelContext('ann'), as('ann'));
    const first = (await model.workEffort(storage)).currentContentId;
    jira.edit('bob', '2099-01-01T00:00:00.000Z', 'summary', 'changed');
    await sealIssue({ signature: validSignature({ reason: 'Agreed' }) }, panelContext('ann'), as('ann'));
    const second = (await model.workEffort(storage)).currentContentId;
    expect([...storage.map.keys()].filter(k => k.startsWith(`ls3:content:${first}:`))).toEqual([]);
    expect(storage.map.has(`ls3:content:${second}:0`)).toBe(true);

    jira.edit('bob', '2099-01-01T00:01:00.000Z', 'summary', 'again');
    const real = storage.delete.bind(storage);
    storage.delete = async (key: string) => (key.startsWith('ls3:content:') ? Promise.reject(new Error('KVS down')) : real(key));
    const error = jest.spyOn(console, 'error').mockImplementation(() => undefined);
    await expect(sealIssue({ signature: validSignature({ reason: 'Agreed again' }) }, panelContext('ann'), as('ann'))).resolves.toMatchObject({ ok: true });
    expect(error).toHaveBeenCalled();
    error.mockRestore();
  });
});
