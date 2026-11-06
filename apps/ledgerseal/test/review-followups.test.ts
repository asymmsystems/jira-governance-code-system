/**
 * Copyright (c) 2026 Asymm Systems. All rights reserved.
 *
 * Merge review follow-ups (docs/sdlc/merge-reviews-2026-11/ledgerseal-merge-review.md):
 * M-1 a conversion stopped after its commit is finished, never replayed over later rows (probe R1);
 * M-2 an erased account is never stored again (probe R2); L-2 a deleted issue's conversion journal goes with it.
 *
 * @author Fahim Farook
 */

import { convertRecord, LEASE_PREFIX, takeLease } from '../src/service/conversion';
import { getSealEvidence, getSealHistory, onIssueDeleted, personalDataReport, revokeSeal, sealIssue, verifyIssue } from '../src/index';
import { buildPanelView } from '../src/frontend/view-model';
import { createJiraClient } from '../src/jira/jira-client';
import { PARTY_PREFIX } from '../src/storage/party-repository';
import { FakeJira, MemoryStore, model, panelContext, sampleIssue, validSignature } from './support/fakes';
import { writeOldRecord } from './support/old-record';

jest.mock('@forge/api', () => ({ __esModule: true, default: {}, route: (s: any, ...v: any[]) => s.reduce((a: string, x: string, i: number) => a + x + (v[i] ?? ''), ''), privacy: {} }));
jest.mock('@forge/kvs', () => ({ kvs: {}, WhereConditions: {} }));

const quiet = () => jest.spyOn(console, 'log').mockImplementation(() => undefined);

function setup() {
  const jira = new FakeJira(sampleIssue());
  jira.approvers = new Set(['ann', 'bob', 'carol']);
  const storage = new MemoryStore();
  const as = (user: string | null) => {
    jira.currentUser = user;
    return { jira, storage };
  };
  return { jira, storage, as };
}

/** An old record whose conversion committed, but whose journal stayed because the invocation stopped. */
async function stoppedAfterCommit() {
  const s = setup();
  await writeOldRecord(s.storage, sampleIssue());
  const realDelete = s.storage.delete.bind(s.storage);
  s.storage.delete = async (key: string) => (key.startsWith('ls3:convert:') ? Promise.reject(new Error('invocation timed out')) : realDelete(key));
  await expect(convertRecord(s.as(null), '10001')).rejects.toThrow('timed out');
  s.storage.delete = realDelete;
  expect(s.storage.map.has('ls3:convert:10001')).toBe(true);
  return s;
}

/** An old record whose conversion stopped just before its commit, in 2000, so its lease has expired. */
async function stoppedBeforeCommit() {
  const s = setup();
  await writeOldRecord(s.storage, sampleIssue());
  const realCommit = s.storage.commit.bind(s.storage);
  s.storage.commit = async (items: any[]) => (items.some(i => i.key === 'ls3:we:10001') ? Promise.reject(new Error('timed out')) : realCommit(items));
  await expect(convertRecord(s.as(null), '10001', '2000-01-01T00:00:00.000Z')).rejects.toThrow('timed out');
  s.storage.commit = realCommit;
  return s;
}

/** Pauses the first call of a storage method that matches, until released. */
function pauseOn(storage: any, method: 'set' | 'commit', match: (args: any[]) => boolean) {
  let release!: () => void;
  let reached!: () => void;
  const gate = new Promise<void>(r => (release = r));
  const at = new Promise<void>(r => (reached = r));
  const real = storage[method].bind(storage);
  let first = true;
  storage[method] = async (...args: any[]) => {
    if (first && match(args)) {
      first = false;
      reached();
      await gate;
    }
    return real(...args);
  };
  return { at, release };
}

describe('M-1 a stopped conversion is finished, never replayed (probe R1)', () => {
  it('a revoke after the stop finishes the clean-up; the weekly job keeps the revoke; a new seal works', async () => {
    const { storage, as } = await stoppedAfterCommit();
    await expect(revokeSeal({ reason: 'probe revoke' }, panelContext('bob'), as('bob'))).resolves.toMatchObject({ ok: true });
    expect(storage.map.has('ls3:convert:10001')).toBe(false);
    const log = quiet();
    await personalDataReport({}, {}, as(null), async () => []);
    log.mockRestore();
    const view: any = await verifyIssue({}, panelContext('bob'), as('bob'));
    expect(view.status).toBe('SEAL_REVOKED');
    expect(view.seal.revocation.reason).toBe('probe revoke');
    const evidence: any = await getSealEvidence({}, panelContext('bob'), as('bob'));
    expect(evidence.history.map((r: any) => r.transitionName)).toEqual(['SEAL', 'REDACT', 'REVOKE']);
    await expect(sealIssue({ signature: validSignature({ reason: 'again' }) }, panelContext('carol'), as('carol'))).resolves.toMatchObject({ ok: true });
  });

  it('a conversion run that finds a committed record with a journal only cleans up, even after later rows', async () => {
    const { storage, as } = await stoppedAfterCommit();
    const journal = storage.map.get('ls3:convert:10001');
    await revokeSeal({ reason: 'probe revoke' }, panelContext('bob'), as('bob'));
    // A weekly run that started before the revoke still holds the journal
    storage.map.set('ls3:convert:10001', journal);
    const before = JSON.stringify(await model.workEffort(storage));
    expect(await convertRecord(as(null), '10001')).toBe('ALREADY');
    expect(JSON.stringify(await model.workEffort(storage))).toBe(before);
    expect(storage.map.has('ls3:convert:10001')).toBe(false);
    expect((await model.workEffort(storage)).currentStatusId).toBe('LS_REVOKED');
  });
});

describe('M-2 an erased account is never stored again (probe R2)', () => {
  it('a later change by someone else does not bring back a closed account found in the change log', async () => {
    const { jira, storage, as } = setup();
    await sealIssue({ signature: validSignature() }, panelContext('ann'), as('ann'));
    jira.edit('mallory', '2099-03-01T00:00:00.000Z', 'summary', 'mallory');
    await verifyIssue({}, panelContext('ann'), as('ann'));
    expect(JSON.stringify([...storage.map.values()])).toContain('mallory');
    const log = quiet();
    await personalDataReport({}, {}, as(null), async a => a.filter(x => x.accountId === 'mallory').map(x => ({ accountId: x.accountId, status: 'closed' })));
    log.mockRestore();
    jira.inactive.add('mallory');
    expect(JSON.stringify([...storage.map.values()])).not.toContain('mallory');
    jira.edit('carol', '2099-03-02T00:00:00.000Z', 'summary', 'carol');
    await verifyIssue({}, panelContext('ann'), as('ann'));
    expect(JSON.stringify([...storage.map.entries()])).not.toContain('mallory');
    expect(storage.map.get(PARTY_PREFIX + (await model.token(storage, 'carol')))).toMatchObject({ accountId: 'carol' });
    // The change is still attributed by token, and the panel shows a closed account
    const view: any = await verifyIssue({}, panelContext('ann'), as('ann'));
    expect(view.tamperedFields[0].changedByClosed).toBe(1);
  });

  it('L-8, L-13: an unreadable account keeps its name; an inactive one is not mapped (unknown); a gone one is marked closed', async () => {
    const { jira, storage, as } = setup();
    await sealIssue({ signature: validSignature() }, panelContext('ann'), as('ann'));
    jira.unknownUsers.add('dora');
    jira.inactive.add('dino');
    jira.gone.add('gus');
    jira.edit('dora', '2099-03-01T00:00:00.000Z', 'summary', 'dora');
    jira.edit('dino', '2099-03-01T00:01:00.000Z', 'summary', 'dino');
    jira.edit('gus', '2099-03-01T00:02:00.000Z', 'summary', 'gus');
    const view: any = await verifyIssue({}, panelContext('ann'), as('ann'));
    expect(storage.map.get(PARTY_PREFIX + (await model.token(storage, 'dora')))).toMatchObject({ accountId: 'dora' });
    // L-13: Jira may answer a closed account as inactive, so an inactive account not yet mapped gets no mapping
    expect(storage.map.has(PARTY_PREFIX + (await model.token(storage, 'dino')))).toBe(false);
    expect(storage.map.get(PARTY_PREFIX + (await model.token(storage, 'gus')))).toEqual({ closed: true, closedAt: expect.any(String) });
    expect(JSON.stringify([...storage.map.entries()])).not.toContain('"gus"');
    expect(view.tamperedFields[0]).toMatchObject({ changedBy: ['dora'], changedByClosed: 1, changedByUnknown: 1 });
  });

  it('L-8: a token with no map entry is unknown, not deleted, in the panel, the history and the evidence', async () => {
    const { storage, as } = setup();
    await sealIssue({ signature: validSignature() }, panelContext('ann'), as('ann'));
    storage.map.delete(PARTY_PREFIX + (await model.token(storage, 'ann')));
    const view: any = await verifyIssue({}, panelContext('bob'), as('bob'));
    expect(view.seal).toMatchObject({ sealedByAccountId: '', sealedByUnknown: true });
    expect(view.seal).not.toHaveProperty('sealedByClosed');
    const panel = buildPanelView({ loading: false, result: view });
    expect(panel.seal).toMatchObject({ signerClosed: false, signerUnknown: true });
    const history: any = await getSealHistory({}, panelContext('bob'), as('bob'));
    expect(history.entries[0]).toMatchObject({ actorAccountId: '', actorClosed: false, actorUnknown: true });
    const evidence: any = await getSealEvidence({}, panelContext('bob'), as('bob'));
    expect(evidence.parties).toEqual({});
    await revokeSeal({ reason: 'x' }, panelContext('bob'), as('bob'));
    storage.map.delete(PARTY_PREFIX + (await model.token(storage, 'bob')));
    const revoked: any = await verifyIssue({}, panelContext('carol'), as('carol'));
    expect(revoked.seal.revocation).toMatchObject({ revokedByAccountId: '', revokedByUnknown: true });
    expect(buildPanelView({ loading: false, result: revoked }).revokedByUnknown).toBe(true);
  });

  it('the conversion of an old record does not store a closed account', async () => {
    const { jira, storage, as } = setup();
    const changed = sampleIssue();
    changed.fields.summary = 'changed';
    await writeOldRecord(storage, sampleIssue(), { changedTo: { issue: changed, by: 'mallory', at: '2026-10-02T00:00:00.000Z' } });
    jira.issue = changed;
    jira.gone.add('mallory');
    expect(await convertRecord(as(null), '10001')).toBe('CONVERTED');
    expect(JSON.stringify([...storage.map.entries()])).not.toContain('mallory');
    expect(storage.map.get(PARTY_PREFIX + (await model.token(storage, 'ann')))).toMatchObject({ accountId: 'ann' });
  });

  it('reads whether an account is active from Jira', async () => {
    const reply = (status: number, body: any = {}) => ({ status, json: async () => body, headers: { get: () => null } });
    const asApp = {
      requestJira: jest.fn()
        .mockResolvedValueOnce(reply(200, { active: true }))
        .mockResolvedValueOnce(reply(200, { active: false }))
        .mockResolvedValueOnce(reply(200, {}))
        .mockResolvedValueOnce(reply(404))
        .mockResolvedValueOnce(reply(401))
    };
    const client = createJiraClient(asApp, null, { maxRetries: 0 });
    expect(await client.accountState('a')).toBe('active');
    expect(await client.accountState('b')).toBe('inactive');
    expect(await client.accountState('c')).toBeNull();
    expect(await client.accountState('d')).toBe('gone');
    expect(await client.accountState('e')).toBeNull();
  });
});

describe('L-2 a deleted issue takes its conversion journal with it', () => {
  it('deletes ls3:convert of the issue', async () => {
    const { storage } = await stoppedAfterCommit();
    const log = quiet();
    await onIssueDeleted({ issue: { id: '10001' } }, {}, storage);
    log.mockRestore();
    expect([...storage.map.keys()].filter(k => k.includes('10001'))).toEqual([]);
  });
});

describe('M-5 two conversions of one record never overlap (probe P1)', () => {
  it('P1: while the weekly run is inside its commit, a revoke answers CONFLICT and nothing is rolled back', async () => {
    const { storage, as } = setup();
    await writeOldRecord(storage, sampleIssue());
    const realCommit = storage.commit.bind(storage);
    let release!: () => void;
    let reached!: () => void;
    const gate = new Promise<void>(r => (release = r));
    const atCommit = new Promise<void>(r => (reached = r));
    let first = true;
    storage.commit = async (items: any[]) => {
      if (first && items.some(i => i.key === 'ls3:we:10001')) {
        first = false;
        reached();
        await gate;
      }
      return realCommit(items);
    };
    const weekly = convertRecord(as(null), '10001');
    await atCommit;
    await expect(revokeSeal({ reason: 'probe revoke' }, panelContext('bob'), as('bob'))).resolves.toMatchObject({ ok: false, code: 'CONFLICT' });
    release();
    expect(await weekly).toBe('CONVERTED');
    // The user tries again: the record is converted and the revoke goes in
    await expect(revokeSeal({ reason: 'probe revoke' }, panelContext('bob'), as('bob'))).resolves.toMatchObject({ ok: true });
    const view: any = await verifyIssue({}, panelContext('bob'), as('bob'));
    expect(view.status).toBe('SEAL_REVOKED');
    const evidence: any = await getSealEvidence({}, panelContext('bob'), as('bob'));
    expect(evidence.history.map((r: any) => r.transitionName)).toEqual(['SEAL', 'REDACT', 'REVOKE']);
    await expect(sealIssue({ signature: validSignature({ reason: 'again' }) }, panelContext('carol'), as('carol'))).resolves.toMatchObject({ ok: true });
  });

  it('a held lease makes a second conversion stop (Q4): the seal resuming a stopped run holds it, the weekly run gets BUSY', async () => {
    const { storage, as } = await stoppedBeforeCommit();
    const p = pauseOn(storage, 'set', args => args[0] === 'ls3:wes:10001:000001');
    const first = convertRecord(as(null), '10001');
    await p.at;
    expect(await convertRecord(as(null), '10001')).toBe('BUSY');
    p.release();
    expect(await first).toBe('CONVERTED');
    expect(storage.map.has(LEASE_PREFIX + '10001')).toBe(false);
  });

  it('M-7 (Q1): a stalled run whose lease was taken over never writes its old assignment back over a revoke', async () => {
    const { storage, as } = setup();
    await writeOldRecord(storage, sampleIssue());
    const p = pauseOn(storage, 'set', args => args[0] === 'ls3:wes:10001:000001');
    const stalled = convertRecord(as(null), '10001', '2000-01-01T00:00:00.000Z');
    await p.at;
    // Its lease (taken in 2000) has expired, so Bob's revoke takes it over, converts and revokes
    await expect(revokeSeal({ reason: 'probe revoke' }, panelContext('bob'), as('bob'))).resolves.toMatchObject({ ok: true });
    p.release();
    expect(await stalled).toBe('BUSY');
    const assignment = [...storage.map.entries()].find(([k]) => k.startsWith('ls3:wepa:10001:'))![1];
    expect(assignment.thruDate).not.toBeNull();
    const view: any = await verifyIssue({}, panelContext('bob'), as('bob'));
    expect(view.status).toBe('SEAL_REVOKED');
    expect(view.seal.revocation.reason).toBe('probe revoke');
    const evidence: any = await getSealEvidence({}, panelContext('bob'), as('bob'));
    expect(evidence.history.map((r: any) => r.transitionName)).toEqual(['SEAL', 'REDACT', 'REVOKE']);
  });

  it('M-7 (Q3): two resumers after a stop never both convert; the seal answers CONFLICT, then goes in on retry', async () => {
    const { storage, as } = await stoppedBeforeCommit();
    const p = pauseOn(storage, 'commit', args => args[0].some((i: any) => i.key === 'ls3:we:10001'));
    const weekly = convertRecord(as(null), '10001');
    await p.at;
    await expect(sealIssue({ signature: validSignature({ reason: 'x' }) }, panelContext('carol'), as('carol'))).resolves.toMatchObject({ ok: false, code: 'CONFLICT' });
    p.release();
    expect(await weekly).toBe('CONVERTED');
    await expect(sealIssue({ signature: validSignature({ reason: 'x' }) }, panelContext('carol'), as('carol'))).resolves.toMatchObject({ ok: true });
    const view: any = await verifyIssue({}, panelContext('bob'), as('bob'));
    expect(view.status).toBe('SEAL_VALID');
    const evidence: any = await getSealEvidence({}, panelContext('bob'), as('bob'));
    expect(evidence.history.map((r: any) => r.transitionName)).toEqual(['SEAL', 'REDACT', 'RESEAL']);
  });

  it('Q2: within the lease of a stopped run a seal answers CONFLICT; after the lease it resumes and works', async () => {
    const { storage, as } = setup();
    await writeOldRecord(storage, sampleIssue());
    const realCommit = storage.commit.bind(storage);
    storage.commit = async (items: any[]) => (items.some(i => i.key === 'ls3:we:10001') ? Promise.reject(new Error('timed out')) : realCommit(items));
    await expect(convertRecord(as(null), '10001')).rejects.toThrow('timed out');
    storage.commit = realCommit;
    await expect(sealIssue({ signature: validSignature({ reason: 'x' }) }, panelContext('carol'), as('carol'))).resolves.toMatchObject({ ok: false, code: 'CONFLICT' });
    const lease = storage.map.get(LEASE_PREFIX + '10001');
    storage.map.set(LEASE_PREFIX + '10001', { ...lease, takenAt: new Date(Date.now() - 11 * 60 * 1000).toISOString() });
    await expect(sealIssue({ signature: validSignature({ reason: 'x' }) }, panelContext('carol'), as('carol'))).resolves.toMatchObject({ ok: true });
    expect(storage.map.has('ls3:convert:10001')).toBe(false);
  });

  it('a lease taken over by someone else between the write and its read-back is not claimed', async () => {
    const storage = new MemoryStore();
    storage.map.set(LEASE_PREFIX + '1', { holder: 'old', takenAt: '2000-01-01T00:00:00.000Z' });
    const realSet = storage.set.bind(storage);
    storage.set = async (key: string, value: any) => realSet(key, key.startsWith(LEASE_PREFIX) ? { holder: 'other', takenAt: value.takenAt } : value);
    expect(await takeLease(storage, '1', '2026-11-06T00:00:00.000Z')).toBeNull();
  });
});
