/**
 * Copyright (c) 2026 Asymm Systems. All rights reserved.
 *
 * B-02: a tamper record that survives a reseal, in a hash-chained history.
 * Also the B-03 incident rule: one incident per distinct live hash.
 *
 * @author Fahim Farook
 */

import { getSealHistory, sealIssue, validateTransition, verifyIssue } from '../src/index';
import { verifyChain } from '../src/domain/history';
import { FakeJira, MemoryStore, panelContext, sampleIssue, validSignature } from './support/fakes';

jest.mock('@forge/api', () => ({ __esModule: true, default: {}, route: () => '' }));
jest.mock('@forge/kvs', () => ({ kvs: {} }));

const sig = validSignature();
const entryKeys = (storage: MemoryStore) => [...storage.map.keys()].filter(k => k.startsWith('ls2:entry:10001:')).sort();

function setup() {
  const jira = new FakeJira(sampleIssue());
  jira.approvers = new Set(['ann', 'bob']);
  jira.users = { ann: 'Ann Approver', bob: 'Bob Approver' };
  const storage = new MemoryStore();
  const as = (user: string | null) => {
    jira.currentUser = user;
    return { jira, storage };
  };
  return { jira, storage, as };
}

async function sealTamperViewReseal() {
  const s = setup();
  await sealIssue({ signature: sig }, panelContext('ann'), s.as('ann'));
  s.jira.edit('mallory', '2099-01-01T00:00:00.000Z', 'summary', 'Rotate credentials and drop the audit table');
  await verifyIssue({}, panelContext('viewer'), s.as('viewer'));
  const reseal = await sealIssue({ signature: sig }, panelContext('bob'), s.as('bob'));
  return { ...s, reseal };
}

describe('B-02 history that a reseal cannot hide', () => {
  it('writes seal, incident and reseal as separate, chained entries', async () => {
    const { storage, reseal } = await sealTamperViewReseal();
    expect(reseal).toMatchObject({ ok: true });
    const keys = entryKeys(storage);
    expect(keys).toEqual(['ls2:entry:10001:000001', 'ls2:entry:10001:000002', 'ls2:entry:10001:000003']);
    const entries = await Promise.all(keys.map(k => storage.get(k)));
    expect(entries.map(e => e.type)).toEqual(['SEALED', 'INCIDENT', 'RESEALED']);
    expect(entries[0].prevEntryHash).toBe('0'.repeat(64));
    expect(entries[1].prevEntryHash).toBe(entries[0].entryHash);
    expect(entries[2].prevEntryHash).toBe(entries[1].entryHash);
    expect(entries[1].data.changes).toEqual([
      { fieldId: 'summary', fieldName: 'Summary', changedBy: ['mallory'], changedAt: '2099-01-01T00:00:00.000Z' }
    ]);
    expect(verifyChain(entries).valid).toBe(true);
  });

  it('adversarial (audit flow.js step 4): after a reseal the auditor still sees the earlier change', async () => {
    const { storage, as } = await sealTamperViewReseal();
    const record = await storage.get('ls2:seal:10001');
    expect(record).toMatchObject({ everCompromised: true, incidentCount: 1, lastIncidentHash: null, state: 'ACTIVE' });
    const view: any = await verifyIssue({}, panelContext('auditor'), as('auditor'));
    expect(view.status).toBe('SEAL_VALID');
    expect(view.seal).toMatchObject({ everCompromised: true, incidentCount: 1, sealedByName: 'Bob Approver', historyLength: 3 });
  });

  it('records the change before a reseal even when no one viewed the changed issue', async () => {
    const { jira, storage, as } = setup();
    await sealIssue({ signature: sig }, panelContext('ann'), as('ann'));
    jira.edit('mallory', '2099-01-01T00:00:00.000Z', 'summary', 'changed without a view');
    await sealIssue({ signature: sig }, panelContext('bob'), as('bob'));
    const types = await Promise.all(entryKeys(storage).map(async k => (await storage.get(k)).type));
    expect(types).toEqual(['SEALED', 'INCIDENT', 'RESEALED']);
  });

  it('finds the first changed entry when a stored entry is edited', async () => {
    const { storage } = await sealTamperViewReseal();
    const entries = await Promise.all(entryKeys(storage).map(k => storage.get(k)));
    entries[1].data.changes = [];
    expect(verifyChain(entries)).toEqual({ valid: false, firstInvalidSeq: 2 });
    const reordered = [entries[0], entries[2]];
    expect(verifyChain(reordered).valid).toBe(false);
  });

  it('returns the history oldest first through the resolver, in pages of 50, with a chain check', async () => {
    const { storage, as } = await sealTamperViewReseal();
    const page: any = await getSealHistory({}, panelContext('auditor'), as('auditor'));
    expect(page.ok).toBe(true);
    expect(page.entries.map((e: any) => e.type)).toEqual(['SEALED', 'INCIDENT', 'RESEALED']);
    expect(page.chainValid).toBe(true);
    expect(page.nextFromSeq).toBeNull();
    const second: any = await getSealHistory({ fromSeq: 2 }, panelContext('auditor'), as('auditor'));
    expect(second.entries.map((e: any) => e.seq)).toEqual([2, 3]);
    expect(second.chainValid).toBe(true);

    const tampered = await storage.get('ls2:entry:10001:000002');
    tampered.data.liveHash = 'f'.repeat(64);
    storage.map.set('ls2:entry:10001:000002', tampered);
    expect(((await getSealHistory({}, panelContext('auditor'), as('auditor'))) as any).chainValid).toBe(false);
    storage.map.delete('ls2:entry:10001:000003');
    expect(((await getSealHistory({ fromSeq: 3 }, panelContext('auditor'), as('auditor'))) as any).chainValid).toBe(false);
  });

  it('pages a long history 50 entries at a time', async () => {
    const { jira, storage, as } = setup();
    await sealIssue({ signature: sig }, panelContext('ann'), as('ann'));
    for (let i = 0; i < 60; i++) {
      jira.edit('mallory', `2099-01-01T00:${String(i).padStart(2, '0')}:00.000Z`, 'summary', `change ${i}`);
      await verifyIssue({}, panelContext('viewer'), as('viewer'));
    }
    expect((await storage.get('ls2:seal:10001')).head.seq).toBe(61);
    const first: any = await getSealHistory({}, panelContext('a'), as('a'));
    expect(first.entries).toHaveLength(50);
    expect(first.nextFromSeq).toBe(51);
    const next: any = await getSealHistory({ fromSeq: first.nextFromSeq }, panelContext('a'), as('a'));
    expect(next.entries.map((e: any) => e.seq)).toEqual([51, 52, 53, 54, 55, 56, 57, 58, 59, 60, 61]);
    expect(next.chainValid).toBe(true);
  });

  it('reads a v1 certificate as legacy, never rewrites it, and keeps the gate closed', async () => {
    const { storage, as } = setup();
    const legacy = { certificateId: 'old', issueId: '10001', snapshotHash: 'x', status: 'ACTIVE' };
    storage.map.set('cert:active:10001', legacy);
    const view: any = await verifyIssue({}, panelContext('viewer'), as('viewer'));
    expect(view.status).toBe('LEGACY');
    const gate = await validateTransition({ issue: { key: 'CHG-1' } }, {}, as(null));
    expect(gate).toEqual({
      result: false,
      errorMessage: 'LedgerSeal: this issue has an old-format seal. Ask a project admin to seal it again in the LedgerSeal panel.'
    });
    expect(storage.sets).toEqual([]);
    expect(storage.map.get('cert:active:10001')).toEqual(legacy);
  });

  it('returns CONFLICT and writes no record when another writer claimed the next entry', async () => {
    const { storage, as } = setup();
    storage.map.set('ls2:entry:10001:000001', { seq: 1, taken: true });
    await expect(sealIssue({ signature: sig }, panelContext('ann'), as('ann'))).resolves.toMatchObject({ ok: false, code: 'CONFLICT' });
    expect(storage.map.has('ls2:seal:10001')).toBe(false);
  });
});

describe('B-02 edge paths', () => {
  it('names only the people who changed a field after the seal', async () => {
    const { jira, storage, as } = setup();
    jira.edit('ann', '2000-01-01T00:00:00.000Z', 'summary', 'before the seal');
    await sealIssue({ signature: sig }, panelContext('ann'), as('ann'));
    jira.edit('mallory', '2099-01-01T00:00:00.000Z', 'summary', 'after the seal');
    await verifyIssue({}, panelContext('viewer'), as('viewer'));
    const incident = await storage.get('ls2:entry:10001:000002');
    expect(incident.data.changes[0].changedBy).toEqual(['mallory']);
  });

  it('still records the incident when the change log cannot be read, with no names', async () => {
    const { jira, storage, as } = setup();
    await sealIssue({ signature: sig }, panelContext('ann'), as('ann'));
    jira.issue.fields.summary = 'changed';
    jira.failChangelog = true;
    await verifyIssue({}, panelContext('viewer'), as('viewer'));
    const incident = await storage.get('ls2:entry:10001:000002');
    expect(incident.data.changes).toEqual([{ fieldId: 'summary', fieldName: 'Summary', changedBy: [], changedAt: null }]);
  });

  it('does not rewrite the record when another writer recorded the incident first', async () => {
    const { jira, storage, as } = setup();
    await sealIssue({ signature: sig }, panelContext('ann'), as('ann'));
    jira.issue.fields.summary = 'changed';
    storage.map.set('ls2:entry:10001:000002', { seq: 2, taken: true });
    const before = JSON.stringify(await storage.get('ls2:seal:10001'));
    await verifyIssue({}, panelContext('viewer'), as('viewer'));
    expect(JSON.stringify(await storage.get('ls2:seal:10001'))).toBe(before);
  });

  it('reports RECORD_INVALID, and blocks the gate, when a snapshot part is missing', async () => {
    const { storage, as } = setup();
    await sealIssue({ signature: sig }, panelContext('ann'), as('ann'));
    const record = await storage.get('ls2:seal:10001');
    storage.map.delete(`ls2:snap:${record.certificateId}:0`);
    expect(((await verifyIssue({}, panelContext('viewer'), as('viewer'))) as any).status).toBe('RECORD_INVALID');
    expect(await validateTransition({ issue: { key: 'CHG-1' } }, {}, as(null))).toEqual({
      result: false,
      errorMessage: 'LedgerSeal: the seal record failed its integrity check. Contact your Jira admin.'
    });
  });

  it('reports NO_SEAL on an unsealed issue and an empty history', async () => {
    const { as } = setup();
    expect(((await verifyIssue({}, panelContext('viewer'), as('viewer'))) as any).status).toBe('NO_SEAL');
    await expect(getSealHistory({}, panelContext('viewer'), as('viewer'))).resolves.toEqual({
      ok: true,
      entries: [],
      chainValid: true,
      nextFromSeq: null
    });
  });

  it('refuses the history without an identity or an issue', async () => {
    const { as } = setup();
    await expect(getSealHistory({}, panelContext(), as(null))).resolves.toMatchObject({ code: 'NO_IDENTITY' });
    await expect(getSealHistory({}, { accountId: 'a' }, as('a'))).resolves.toMatchObject({ code: 'MISSING_ISSUE' });
  });

  it('keeps the context key when Jira returns no key, and requires the confirmation text', async () => {
    const { jira, storage, as } = setup();
    delete jira.issue.key;
    await expect(sealIssue({ signature: validSignature({ meaning: 'x' }) }, panelContext('ann'), as('ann'))).resolves.toMatchObject({ code: 'INVALID_REQUEST' });
    await sealIssue({ signature: sig }, panelContext('ann'), as('ann'));
    expect((await storage.get('ls2:seal:10001')).issueKey).toBe('CHG-1');
  });
});

describe('B-03 one incident per distinct change', () => {
  it('records one incident for 500 views of the same change', async () => {
    const { jira, storage, as } = setup();
    await sealIssue({ signature: sig }, panelContext('ann'), as('ann'));
    jira.edit('mallory', '2099-01-01T00:00:00.000Z', 'summary', 'changed');
    for (let i = 0; i < 500; i++) await verifyIssue({}, panelContext('viewer'), as('viewer'));
    const record = await storage.get('ls2:seal:10001');
    expect(record.incidentCount).toBe(1);
    expect(entryKeys(storage)).toHaveLength(2);
  });

  it('records exactly one more incident for a second, different change', async () => {
    const { jira, storage, as } = setup();
    await sealIssue({ signature: sig }, panelContext('ann'), as('ann'));
    jira.edit('mallory', '2099-01-01T00:00:00.000Z', 'summary', 'first change');
    await verifyIssue({}, panelContext('viewer'), as('viewer'));
    await verifyIssue({}, panelContext('viewer'), as('viewer'));
    jira.edit('mallory', '2099-01-01T00:01:00.000Z', 'summary', 'second change');
    await verifyIssue({}, panelContext('viewer'), as('viewer'));
    await verifyIssue({}, panelContext('viewer'), as('viewer'));
    expect((await storage.get('ls2:seal:10001')).incidentCount).toBe(2);
    expect(entryKeys(storage)).toHaveLength(3);
  });

  it('keeps the gate closed when a change was changed back', async () => {
    const { jira, as } = setup();
    await sealIssue({ signature: sig }, panelContext('ann'), as('ann'));
    const original = jira.issue.fields.summary;
    jira.edit('mallory', '2099-01-01T00:00:00.000Z', 'summary', 'changed');
    await verifyIssue({}, panelContext('viewer'), as('viewer'));
    jira.edit('mallory', '2099-01-01T00:01:00.000Z', 'summary', original);
    const view: any = await verifyIssue({}, panelContext('viewer'), as('viewer'));
    expect(view.status).toBe('SEAL_COMPROMISED');
    expect((await validateTransition({ issue: { key: 'CHG-1' } }, {}, as(null))).result).toBe(false);
  });
});
