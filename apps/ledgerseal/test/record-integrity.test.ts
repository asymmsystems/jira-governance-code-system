/**
 * Copyright (c) 2026 Asymm Systems. All rights reserved.
 *
 * B-08: every read checks the stored seal record and snapshot against their hashes.
 *
 * @author Fahim Farook
 */

import { sealIssue, validateTransition, verifyIssue } from '../src/index';
import { FakeJira, MemoryStore, panelContext, sampleIssue, validSignature } from './support/fakes';

jest.mock('@forge/api', () => ({ __esModule: true, default: {}, route: () => '' }));
jest.mock('@forge/kvs', () => ({ kvs: {} }));

const INVALID = 'LedgerSeal: the seal record failed its integrity check. Contact your Jira admin.';

async function sealedIssue() {
  const jira = new FakeJira(sampleIssue());
  jira.approvers = new Set(['ann']);
  jira.users = { ann: 'Ann Approver' };
  jira.currentUser = 'ann';
  const storage = new MemoryStore();
  await sealIssue({ signature: validSignature() }, panelContext('ann'), { jira, storage });
  jira.currentUser = 'viewer';
  return { jira, storage, deps: { jira, storage } };
}

describe('B-08 integrity check on every read', () => {
  it('adversarial (T-02 A7, LS-10): a stored record with a rewritten signer is reported, not shown as valid', async () => {
    const { storage, deps } = await sealedIssue();
    const record = await storage.get('ls2:seal:10001');
    record.sealedBy = { accountId: 'someone-else', displayName: 'Someone Else' };
    storage.map.set('ls2:seal:10001', record);
    const view: any = await verifyIssue({}, panelContext('viewer'), deps);
    expect(view.status).toBe('RECORD_INVALID');
    expect(JSON.stringify(view)).not.toContain('Someone Else');
    await expect(validateTransition({ issue: { key: 'CHG-1' } }, {}, deps)).resolves.toEqual({ result: false, errorMessage: INVALID });
  });

  it('reports a record whose sealed hash was changed to match the live issue', async () => {
    const { jira, storage, deps } = await sealedIssue();
    jira.issue.fields.summary = 'changed';
    const record = await storage.get('ls2:seal:10001');
    record.snapshotHash = 'f'.repeat(64);
    storage.map.set('ls2:seal:10001', record);
    await expect(verifyIssue({}, panelContext('viewer'), deps)).resolves.toMatchObject({ status: 'RECORD_INVALID' });
  });

  it('reports a snapshot part that no longer matches the sealed hash', async () => {
    const { storage, deps } = await sealedIssue();
    const record = await storage.get('ls2:seal:10001');
    const key = `ls2:snap:${record.certificateId}:0`;
    const snapshot = JSON.parse(storage.map.get(key));
    snapshot.fields[0].value = 'rewritten to match a later edit';
    storage.map.set(key, JSON.stringify(snapshot));
    await expect(verifyIssue({}, panelContext('viewer'), deps)).resolves.toMatchObject({ status: 'RECORD_INVALID' });
    await expect(validateTransition({ issue: { key: 'CHG-1' } }, {}, deps)).resolves.toEqual({ result: false, errorMessage: INVALID });
  });

  it('writes nothing for an invalid record, and an approver can still reseal to replace it', async () => {
    const { jira, storage, deps } = await sealedIssue();
    const record = await storage.get('ls2:seal:10001');
    record.incidentCount = 0;
    record.everCompromised = false;
    record.sealedBy.displayName = 'Edited';
    storage.map.set('ls2:seal:10001', record);
    const sets = storage.sets.length;
    await verifyIssue({}, panelContext('viewer'), deps);
    expect(storage.sets.length).toBe(sets);
    jira.currentUser = 'ann';
    await expect(sealIssue({ signature: validSignature() }, panelContext('ann'), deps)).resolves.toMatchObject({ ok: true });
    await expect(verifyIssue({}, panelContext('viewer'), deps)).resolves.toMatchObject({ status: 'SEAL_VALID', seal: { everCompromised: true } });
    const reseal = await storage.get('ls2:entry:10001:000002');
    expect(reseal.data.previousState).toBe('RECORD_INVALID');
  });
});
