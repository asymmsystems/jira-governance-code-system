/**
 * Copyright (c) 2026 Asymm Systems. All rights reserved.
 *
 * B-16: revoke a seal, with a reason, as an approver.
 *
 * @author Fahim Farook
 */

import { handler, revokeSeal, sealIssue, validateTransition, verifyIssue } from '../src/index';
import { FakeJira, MemoryStore, model, panelContext, sampleIssue, validSignature } from './support/fakes';

jest.mock('@forge/api', () => ({ __esModule: true, default: { asApp: jest.fn(), asUser: jest.fn() }, route: () => '' }));
jest.mock('@forge/kvs', () => ({ kvs: {} }));

async function sealed() {
  const jira = new FakeJira(sampleIssue());
  jira.approvers = new Set(['ann', 'bob']);
  jira.currentUser = 'ann';
  const storage = new MemoryStore();
  const deps = { jira, storage };
  await sealIssue({ signature: validSignature() }, panelContext('ann'), deps);
  return { jira, storage, deps };
}

describe('B-16 revoke', () => {
  it('adversarial (T-02 A10, LS-13): an approver revokes with a reason, which ends the seal and is recorded', async () => {
    const { jira, storage, deps } = await sealed();
    jira.currentUser = 'bob';
    await expect(revokeSeal({ reason: '  Scope withdrawn  ' }, panelContext('bob'), deps)).resolves.toMatchObject({ ok: true });
    const we = await model.workEffort(storage);
    expect(we).toMatchObject({ currentStatusId: 'LS_REVOKED', revisionNumber: 2 });
    const row = model.statusRows(storage)[1];
    expect(row).toMatchObject({ statusId: 'LS_REVOKED', transitionName: 'REVOKE', setByPartyId: 'bob', reason: 'Scope withdrawn' });
    expect(model.assignments(storage)[0].thruDate).toBe(row.statusDatetime);
    expect(jira.propertyWrites[jira.propertyWrites.length - 1].body.status).toBe('SEAL_REVOKED');
    const view: any = await verifyIssue({}, panelContext('viewer'), deps);
    expect(view.status).toBe('SEAL_REVOKED');
    expect(view.seal.revocation).toEqual({ revokedAt: row.statusDatetime, revokedByAccountId: 'bob', reason: 'Scope withdrawn' });
  });

  it('blocks the transition with the revoked message', async () => {
    const { jira, deps } = await sealed();
    jira.currentUser = 'bob';
    await revokeSeal({ reason: 'Scope withdrawn' }, panelContext('bob'), deps);
    const gate = await validateTransition({ issue: { key: 'CHG-1' } }, {}, deps);
    expect(gate.result).toBe(false);
    expect(gate.errorMessage).toMatch(/^LedgerSeal: the seal was revoked on \d{4}-\d{2}-\d{2} \(reason: Scope withdrawn\)\. Seal it again to continue\.$/);
  });

  it('refuses a revoke from a user outside the policy, and writes nothing', async () => {
    const { jira, storage, deps } = await sealed();
    jira.currentUser = 'mallory';
    const sets = storage.sets.length;
    const writes = jira.propertyWrites.length;
    await expect(revokeSeal({ reason: 'mine now' }, panelContext('mallory'), deps)).resolves.toMatchObject({ ok: false, code: 'NOT_APPROVER' });
    expect(storage.sets.length).toBe(sets);
    expect(jira.propertyWrites.length).toBe(writes);
  });

  it('requires a reason of 1 to 500 characters, an identity, a seal, and an allowed state change', async () => {
    const { jira, deps } = await sealed();
    jira.currentUser = 'bob';
    await expect(revokeSeal({ reason: ' ' }, panelContext('bob'), deps)).resolves.toMatchObject({ code: 'REASON_REQUIRED' });
    await expect(revokeSeal({ reason: 'x'.repeat(501) }, panelContext('bob'), deps)).resolves.toMatchObject({ code: 'REASON_REQUIRED' });
    await expect(revokeSeal({ reason: 'ok' }, panelContext(), deps)).resolves.toMatchObject({ code: 'NO_IDENTITY' });
    await expect(revokeSeal({ reason: 'ok' }, { accountId: 'bob' }, deps)).resolves.toMatchObject({ code: 'MISSING_ISSUE' });
    await revokeSeal({ reason: 'first' }, panelContext('bob'), deps);
    await expect(revokeSeal({ reason: 'again' }, panelContext('bob'), deps)).resolves.toMatchObject({ code: 'INVALID_REQUEST' });

    const empty = { jira, storage: new MemoryStore() };
    await expect(revokeSeal({ reason: 'ok' }, panelContext('bob'), empty)).resolves.toMatchObject({ code: 'NOT_SEALED' });
  });

  it('refuses to revoke an invalid record, and reports a lost race', async () => {
    const { jira, storage, deps } = await sealed();
    jira.currentUser = 'bob';
    const we = await model.workEffort(storage);
    storage.map.set(model.workEffortKey(), { ...we, incidentCount: 7 });
    await expect(revokeSeal({ reason: 'ok' }, panelContext('bob'), deps)).resolves.toMatchObject({ code: 'INVALID_REQUEST' });
    storage.map.set(model.workEffortKey(), we);
    storage.map.set(model.statusKey(2), { taken: true });
    await expect(revokeSeal({ reason: 'ok' }, panelContext('bob'), deps)).resolves.toMatchObject({ code: 'CONFLICT' });
  });

  it('lets an approver seal again after a revoke, keeping the revoke end date on the old seal', async () => {
    const { jira, storage, deps } = await sealed();
    jira.currentUser = 'bob';
    await revokeSeal({ reason: 'Scope withdrawn' }, panelContext('bob'), deps);
    const revokedAt = model.statusRows(storage)[1].statusDatetime;
    await new Promise(resolve => setTimeout(resolve, 5));
    await expect(sealIssue({ signature: validSignature() }, panelContext('bob'), deps)).resolves.toMatchObject({ ok: true });
    const [first, second] = model.assignments(storage);
    expect(first.thruDate).toBe(revokedAt);
    expect(second).toMatchObject({ partyId: 'bob', thruDate: null });
    expect(model.statusRows(storage).map(r => r.transitionName)).toEqual(['SEAL', 'REVOKE', 'RESEAL']);
  });

  it('is reachable through the revoke-seal-api resolver', async () => {
    await expect(
      handler({ call: { functionKey: 'revoke-seal-api', payload: { reason: 'x' } }, context: { extension: { issue: { id: '1' } } } } as any)
    ).resolves.toMatchObject({ code: 'NO_IDENTITY' });
  });
});
