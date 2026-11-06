/**
 * Copyright (c) 2026 Asymm Systems. All rights reserved.
 *
 * Merge review follow-ups (docs/sdlc/merge-reviews-2026-11/ledgerseal-merge-review.md):
 * M-1 a conversion stopped after its commit is finished, never replayed over later rows (probe R1);
 * M-2 an erased account is never stored again (probe R2); L-2 a deleted issue's conversion journal goes with it.
 *
 * @author Fahim Farook
 */

import { convertRecord } from '../src/service/conversion';
import { getSealEvidence, onIssueDeleted, personalDataReport, revokeSeal, sealIssue, verifyIssue } from '../src/index';
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

  it('adds no account Jira cannot confirm as active; a known account only gets a new time', async () => {
    const { jira, storage, as } = setup();
    await sealIssue({ signature: validSignature() }, panelContext('ann'), as('ann'));
    jira.unknownUsers.add('dora');
    jira.edit('dora', '2099-03-01T00:00:00.000Z', 'summary', 'dora');
    await verifyIssue({}, panelContext('ann'), as('ann'));
    expect(JSON.stringify([...storage.map.entries()])).not.toContain('dora');
  });

  it('the conversion of an old record does not store a closed account', async () => {
    const { jira, storage, as } = setup();
    const changed = sampleIssue();
    changed.fields.summary = 'changed';
    await writeOldRecord(storage, sampleIssue(), { changedTo: { issue: changed, by: 'mallory', at: '2026-10-02T00:00:00.000Z' } });
    jira.issue = changed;
    jira.inactive.add('mallory');
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
    expect(await client.isActiveUser('a')).toBe(true);
    expect(await client.isActiveUser('b')).toBe(false);
    expect(await client.isActiveUser('c')).toBeNull();
    expect(await client.isActiveUser('d')).toBe(false);
    expect(await client.isActiveUser('e')).toBeNull();
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
