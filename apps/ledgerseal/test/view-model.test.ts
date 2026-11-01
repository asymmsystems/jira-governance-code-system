/**
 * Copyright (c) 2026 Asymm Systems. All rights reserved.
 *
 * B-15: the panel view model. Pure logic, no React: which state, which text, which actions this user may take.
 *
 * @author Fahim Farook
 */

import * as fs from 'fs';
import * as path from 'path';
import { buildPanelView, formatTime } from '../src/frontend/view-model';
import { sealIssue, verifyIssue } from '../src/index';
import { FakeJira, MemoryStore, panelContext, sampleIssue, validSignature } from './support/fakes';

jest.mock('@forge/api', () => ({ __esModule: true, default: {}, route: () => '' }));
jest.mock('@forge/kvs', () => ({ kvs: {} }));

const TZ = { locale: 'en-GB', timeZone: 'Asia/Colombo' };
const rights = (r: any = {}) => ({ canSeal: true, canApproveChanges: true, canRevoke: true, blockedBySelfChange: false, ...r });
const seal = {
  certificateId: 'c-1',
  state: 'ACTIVE',
  sealedAt: '2026-11-01T08:35:00.000Z',
  sealedByAccountId: 'ann',
  sealedByName: 'Ann Approver',
  meaning: 'APPROVAL',
  reason: null,
  declarationVersion: '1',
  snapshotHash: 'ab'.repeat(32),
  canonicalizerVersion: '2.0.0',
  everCompromised: false,
  incidentCount: 0,
  revocation: null,
  historyLength: 1
};
const result = (status: string, extra: any = {}) => ({
  status,
  tamperedFields: [],
  tamperedAttachments: [],
  verifiedAt: 't',
  seal,
  coveredFields: [{ id: 'summary', name: 'Summary' }],
  excludedFields: [{ id: 'status', name: 'Status', reason: 'The gated transition changes the status.' }],
  rights: rights(),
  ...extra
});
const view = (r: any, extra: any = {}) => buildPanelView({ loading: false, result: r, ...TZ, ...extra });

describe('B-15 panel view model states', () => {
  it('LOADING', () => {
    expect(buildPanelView({ loading: true, result: null, ...TZ })).toMatchObject({ state: 'LOADING', title: 'Checking the seal...' });
  });

  it('SEALED: title, lozenge, local time with zone, full hash, and the reseal note', () => {
    const v = view(result('SEAL_VALID'));
    expect(v).toMatchObject({ state: 'SEALED', title: 'Sealed. No change since approval.', lozenge: { text: 'SEALED', appearance: 'success' } });
    expect(v.seal).toMatchObject({ signerAccountId: 'ann', meaningLabel: 'Approved', sealedAt: '1 Nov 2026, 14:05 GMT+5:30', hash: 'ab'.repeat(32) });
    expect(v.seal?.hashShort).toBe('abababab...abababab');
    expect(v.message.lines).toEqual([]);
    const resealed = view(result('SEAL_VALID', { seal: { ...seal, everCompromised: true, incidentCount: 2 } }));
    expect(resealed.message.lines).toEqual(['Resealed after 2 change incidents. See the history.']);
    expect(v.covered).toEqual(['Summary']);
    expect(v.excluded).toEqual([{ name: 'Status', reason: 'The gated transition changes the status.' }]);
  });

  it('CHANGED: change rows with who and when, and the approve action', () => {
    const changed = result('SEAL_BROKEN', {
      tamperedFields: [
        { fieldId: 'summary', fieldName: 'Summary', sealedValue: 'old', liveValue: 'x'.repeat(250), liveLong: true, sealedLong: false, changedBy: ['mallory'], changedAt: '2026-11-01T09:00:00.000Z' },
        { fieldId: 'description', fieldName: 'Description', sealedValue: 'a', liveValue: 'b', detail: 'Paragraph 2 changed.', changedBy: [], changedAt: null }
      ]
    });
    const v = view(changed);
    expect(v).toMatchObject({ state: 'CHANGED', title: 'Changed after approval', lozenge: { text: 'CHANGED', appearance: 'removed' } });
    expect(v.changes[0]).toMatchObject({
      fieldName: 'Summary',
      was: 'old',
      now: 'x'.repeat(200) + '...',
      nowFull: 'x'.repeat(250),
      showFullToggle: true,
      changedBy: ['mallory'],
      changedAt: '1 Nov 2026, 14:30 GMT+5:30'
    });
    expect(v.changes[1]).toMatchObject({ detail: 'Paragraph 2 changed.', changedAt: 'Unknown time', showFullToggle: false });
    expect(v.actions.approveChanges).toEqual({ label: 'Approve these changes' });
    expect(v.actions.seal).toBeUndefined();
  });

  it('CHANGED_BACK', () => {
    const v = view(result('SEAL_COMPROMISED'));
    expect(v).toMatchObject({ state: 'CHANGED_BACK', title: 'Changed after approval, then changed back', lozenge: { text: 'CHANGED' } });
    expect(v.message.lines).toEqual(['This issue changed after approval and was later changed back. An approver must approve it again.']);
    expect(v.actions.approveChanges).toBeDefined();
  });

  it('REVOKED: who, when and why, and seal again', () => {
    const revoked = { ...seal, state: 'REVOKED', revocation: { revokedAt: '2026-11-01T10:00:00.000Z', revokedByAccountId: 'bob', reason: 'Scope withdrawn' } };
    const v = view(result('SEAL_REVOKED', { seal: revoked }));
    expect(v).toMatchObject({ state: 'REVOKED', title: 'Seal revoked', lozenge: { text: 'REVOKED', appearance: 'moved' } });
    expect(v.message.lines).toEqual(['Revoked on 1 Nov 2026, 15:30 GMT+5:30. Reason: Scope withdrawn']);
    expect(v.revokedByAccountId).toBe('bob');
    expect(v.actions.seal).toEqual({ label: 'Seal this issue' });
    expect(v.actions.revoke).toBeUndefined();
  });

  it('NOT_SEALED', () => {
    const v = view({ status: 'NO_SEAL', tamperedFields: [], tamperedAttachments: [], verifiedAt: 't', rights: rights() });
    expect(v).toMatchObject({
      state: 'NOT_SEALED',
      title: 'Not sealed',
      lozenge: { text: 'NOT SEALED', appearance: 'default' },
      message: { lines: ['Seal this issue to record approval of its current content.'] }
    });
    expect(v.actions.seal).toEqual({ label: 'Seal this issue' });
  });

  it('RECORD_INVALID and LEGACY', () => {
    expect(view({ status: 'RECORD_INVALID', tamperedFields: [], tamperedAttachments: [], verifiedAt: 't', rights: rights() })).toMatchObject({
      state: 'RECORD_INVALID',
      title: 'Seal record failed its check',
      message: { appearance: 'error', lines: ['The stored seal record failed its integrity check. Contact your Jira admin.'] },
      actions: { seal: { label: 'Seal this issue' } }
    });
    expect(view({ status: 'LEGACY', tamperedFields: [], tamperedAttachments: [], verifiedAt: 't', rights: rights() })).toMatchObject({
      state: 'LEGACY',
      title: 'Sealed with an old format',
      message: { lines: ['This seal uses an old format. Reseal to get the new record.'] }
    });
  });

  it('ERROR: never "not sealed", with a retry', () => {
    for (const r of [
      { status: 'ERROR', errorReason: 'JIRA_UNREACHABLE', tamperedFields: [], tamperedAttachments: [], verifiedAt: 't' },
      { status: 'ERROR', errorReason: 'STORAGE', tamperedFields: [], tamperedAttachments: [], verifiedAt: 't' },
      { ok: false, code: 'NO_IDENTITY', message: 'LedgerSeal could not identify you. Reload the page and try again.' },
      null
    ]) {
      const v = view(r);
      expect(v.state).toBe('ERROR');
      expect(v.title).toBe('LedgerSeal could not check this issue');
      expect(v.actions.retry).toEqual({ label: 'Try again' });
      expect(v.actions.seal).toBeUndefined();
    }
    expect(view(null, { error: true }).message.lines).toEqual(['Jira did not answer. The seal state is unknown. Try again.']);
    expect(view({ status: 'ERROR', errorReason: 'STORAGE' }).message.lines).toEqual(['LedgerSeal could not read its seal record. The seal state is unknown. Try again.']);
  });

  it('LICENSE_INACTIVE', () => {
    expect(view({ ok: false, code: 'LICENSE_INACTIVE', message: 'm' })).toMatchObject({
      state: 'LICENSE_INACTIVE',
      title: 'LedgerSeal licence is not active',
      actions: {}
    });
  });
});

describe('B-15 rights in the view model', () => {
  it('hides every action from a user who may not take it, and says who to ask (G-10)', () => {
    const none = rights({ canSeal: false, canApproveChanges: false, canRevoke: false });
    for (const status of ['NO_SEAL', 'SEAL_VALID', 'SEAL_BROKEN', 'SEAL_REVOKED']) {
      const v = view(result(status, { rights: none }));
      expect(v.actions).toEqual({});
      expect(v.askText).toBe('You cannot seal this issue. Ask a project admin.');
    }
  });

  it('tells the author of a change that another approver must approve it', () => {
    const v = view(result('SEAL_BROKEN', { rights: rights({ canApproveChanges: false, blockedBySelfChange: true }) }));
    expect(v.actions.approveChanges).toBeUndefined();
    expect(v.askText).toBe('You changed this issue, so another approver must approve it.');
  });

  it('offers revoke on a sealed or changed issue to a permitted user', () => {
    expect(view(result('SEAL_VALID')).actions.revoke).toEqual({ label: 'Revoke seal' });
    expect(view(result('SEAL_BROKEN')).actions.revoke).toEqual({ label: 'Revoke seal' });
  });

  it('gives "who can seal" text', () => {
    expect(view(result('SEAL_VALID')).policyText).toBe('Who can seal: project admins and Jira admins.');
  });
});

describe('B-15 resolver rights', () => {
  async function setup(viewer: string, approvers: string[]) {
    const jira = new FakeJira(sampleIssue());
    jira.approvers = new Set(['ann', ...approvers]);
    jira.currentUser = 'ann';
    const storage = new MemoryStore();
    await sealIssue({ signature: validSignature() }, panelContext('ann'), { jira, storage });
    jira.currentUser = viewer;
    return { jira, storage, deps: { jira, storage } };
  }

  it('returns the viewer rights with the panel data', async () => {
    const { deps } = await setup('bob', ['bob']);
    expect(((await verifyIssue({}, panelContext('bob'), deps)) as any).rights).toEqual({
      canSeal: true,
      canApproveChanges: true,
      canRevoke: true,
      blockedBySelfChange: false
    });
    const other = await setup('viewer', []);
    expect(((await verifyIssue({}, panelContext('viewer'), other.deps)) as any).rights).toMatchObject({ canSeal: false, canRevoke: false });
  });

  it('marks the author of a change, and gives no rights when the permission check fails', async () => {
    const { jira, deps } = await setup('mallory', ['mallory']);
    jira.edit('mallory', '2099-01-01T00:00:00.000Z', 'summary', 'changed');
    expect(((await verifyIssue({}, panelContext('mallory'), deps)) as any).rights).toEqual({
      canSeal: false,
      canApproveChanges: false,
      canRevoke: true,
      blockedBySelfChange: true
    });
    jira.permissionError = 'UNREACHABLE';
    expect(((await verifyIssue({}, panelContext('mallory'), deps)) as any).rights).toMatchObject({ canSeal: false, canApproveChanges: false, canRevoke: false });
  });
});

describe('B-15 structure', () => {
  const root = path.resolve(__dirname, '..');
  it('keeps React out of the view model, and the view model inside coverage', () => {
    const vm = fs.readFileSync(path.join(root, 'src/frontend/view-model.ts'), 'utf8');
    expect(vm).not.toMatch(/from 'react'|@forge\/react|@forge\/bridge/);
    const config = require(path.join(root, 'jest.config.js'));
    expect(config.collectCoverageFrom).toContain('src/frontend/view-model.ts');
  });

  it('builds the panel only from the view model', () => {
    const ui = fs.readFileSync(path.join(root, 'src/frontend/index.tsx'), 'utf8');
    expect(ui).toContain("from './view-model'");
    expect(ui).toContain('buildPanelView(');
    expect(ui).not.toMatch(/status === 'SEAL_/);
  });

  it('formats times in the viewer locale with the time zone', () => {
    expect(formatTime('2026-11-01T08:35:00.000Z', 'en-GB', 'UTC')).toBe('1 Nov 2026, 08:35 UTC');
    expect(formatTime('not a time', 'en-GB', 'UTC')).toBe('Unknown time');
    expect(formatTime(null, 'en-GB', 'UTC')).toBe('Unknown time');
  });
});
