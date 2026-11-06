/**
 * Copyright (c) 2026 Asymm Systems. All rights reserved.
 *
 * B-21: seals are stored on the Silverston WorkEffort, Party and Status patterns (ADR-01, spec v2 section 3.2).
 *
 * @author Fahim Farook
 */

import { ALLOWED_CHANGES, canChange, roleForMeaning } from '../src/domain/status';
import { sealIssue, verifyIssue } from '../src/index';
import { DECLARATION } from '../src/domain/declaration';
import { FakeJira, MemoryStore, model, panelContext, sampleIssue, validSignature } from './support/fakes';

jest.mock('@forge/api', () => ({ __esModule: true, default: {}, route: () => '' }));
jest.mock('@forge/kvs', () => ({ kvs: {} }));

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

describe('B-21 Silverston WorkEffort model', () => {
  it('stores a seal as a WorkEffort, a party assignment, a status row and content, and no ls2 key', async () => {
    const { storage, as } = setup();
    await sealIssue({ signature: validSignature() }, panelContext('ann'), as('ann'));
    const we = await model.workEffort(storage);
    expect(we).toMatchObject({
      schemaVersion: 3,
      workEffortId: '10001',
      workEffortTypeId: 'JIRA_ISSUE',
      sourceReferenceId: 'CHG-1',
      currentStatusId: 'LS_SEALED',
      revisionNumber: 1,
      everCompromised: false,
      incidentCount: 0
    });
    const [assignment] = model.assignments(storage);
    const ann = await model.token(storage, 'ann');
    expect(assignment).toEqual({
      workEffortId: '10001',
      partyId: ann,
      roleTypeId: 'LS_APPROVER',
      fromDate: we.currentAssignment.fromDate,
      thruDate: null,
      comments: null,
      contentId: we.currentContentId,
      declaration: { version: DECLARATION.version, text: DECLARATION.text }
    });
    const [row] = model.statusRows(storage);
    expect(row).toMatchObject({ workEffortId: '10001', statusId: 'LS_SEALED', transitionName: 'SEAL', setByPartyId: ann, reason: null, seq: 1 });
    expect(row.data).not.toHaveProperty('signerName');
    expect([...storage.map.keys()].filter(k => k.startsWith('ls2:'))).toEqual([]);
    expect(storage.map.has(model.contentKey(we))).toBe(true);
  });

  it('maps each meaning to a role type', async () => {
    expect(roleForMeaning('APPROVAL')).toBe('LS_APPROVER');
    expect(roleForMeaning('REVIEW')).toBe('LS_REVIEWER');
    expect(roleForMeaning('VERIFICATION')).toBe('LS_VERIFIER');
    const { storage, as } = setup();
    await sealIssue({ signature: validSignature({ meaning: 'REVIEW' }) }, panelContext('ann'), as('ann'));
    expect(model.assignments(storage)[0].roleTypeId).toBe('LS_REVIEWER');
  });

  it('records a change as LS_CHANGED by the app, and a reseal ends the old assignment and starts a new one', async () => {
    const { jira, storage, as } = setup();
    await sealIssue({ signature: validSignature() }, panelContext('ann'), as('ann'));
    jira.edit('mallory', '2099-01-01T00:00:00.000Z', 'summary', 'changed');
    await verifyIssue({}, panelContext('viewer'), as('viewer'));
    expect((await model.workEffort(storage)).currentStatusId).toBe('LS_CHANGED');
    await sealIssue({ signature: validSignature({ reason: 'Scope agreed' }) }, panelContext('bob'), as('bob'));
    const rows = model.statusRows(storage);
    const ann = await model.token(storage, 'ann');
    const bob = await model.token(storage, 'bob');
    expect(rows.map(r => [r.statusId, r.transitionName, r.setByPartyId])).toEqual([
      ['LS_SEALED', 'SEAL', ann],
      ['LS_CHANGED', 'CHANGE', null],
      ['LS_SEALED', 'RESEAL', bob]
    ]);
    expect(rows[2].reason).toBe('Scope agreed');
    const [first, second] = model.assignments(storage);
    expect(first.partyId).toBe(ann);
    expect(first.thruDate).toBe(rows[2].statusDatetime);
    expect(second).toMatchObject({ partyId: bob, thruDate: null, comments: 'Scope agreed' });
    expect(await model.workEffort(storage)).toMatchObject({ currentStatusId: 'LS_SEALED', everCompromised: true, incidentCount: 1, revisionNumber: 3 });
  });

  it('lists exactly the allowed state changes of spec v2 section 3.2', () => {
    expect(ALLOWED_CHANGES).toEqual([
      { statusId: null, statusIdTo: 'LS_SEALED', transitionName: 'SEAL' },
      { statusId: 'LS_SEALED', statusIdTo: 'LS_SEALED', transitionName: 'RESEAL' },
      { statusId: 'LS_SEALED', statusIdTo: 'LS_CHANGED', transitionName: 'CHANGE' },
      { statusId: 'LS_SEALED', statusIdTo: 'LS_REVOKED', transitionName: 'REVOKE' },
      { statusId: 'LS_CHANGED', statusIdTo: 'LS_CHANGED', transitionName: 'CHANGE' },
      { statusId: 'LS_CHANGED', statusIdTo: 'LS_SEALED', transitionName: 'RESEAL' },
      { statusId: 'LS_CHANGED', statusIdTo: 'LS_REVOKED', transitionName: 'REVOKE' },
      { statusId: 'LS_REVOKED', statusIdTo: 'LS_SEALED', transitionName: 'RESEAL' }
    ]);
    expect(canChange('LS_REVOKED', 'LS_CHANGED')).toBeNull();
    expect(canChange('LS_REVOKED', 'LS_REVOKED')).toBeNull();
    expect(canChange(null, 'LS_CHANGED')).toBeNull();
    expect(canChange('LS_CHANGED', 'LS_SEALED')).toBe('RESEAL');
  });

  it('adversarial (T-02 A7): a rewritten assignment or sealing row is reported as RECORD_INVALID', async () => {
    const { storage, as } = setup();
    await sealIssue({ signature: validSignature() }, panelContext('ann'), as('ann'));
    const key = [...storage.map.keys()].find(k => k.startsWith('ls3:wepa:'))!;
    const assignment = storage.map.get(key);
    storage.map.set(key, { ...assignment, partyId: 'someone-else' });
    expect(((await verifyIssue({}, panelContext('viewer'), as('viewer'))) as any).status).toBe('RECORD_INVALID');
    storage.map.set(key, assignment);
    expect(((await verifyIssue({}, panelContext('viewer'), as('viewer'))) as any).status).toBe('SEAL_VALID');
    const row = storage.map.get(model.statusKey(1));
    storage.map.set(model.statusKey(1), { ...row, data: { ...row.data, signerName: 'Someone Else' } });
    expect(((await verifyIssue({}, panelContext('viewer'), as('viewer'))) as any).status).toBe('RECORD_INVALID');
  });
});
