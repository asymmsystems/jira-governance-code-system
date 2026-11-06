/**
 * Copyright (c) 2026 Asymm Systems. All rights reserved.
 *
 * Merge review finding M-11: a covered work log's comment is part of the sealed snapshot. The evidence export follows
 * the rule for comments (owner decision 2026-11-06, fail closed): a covered work log that is restricted at the seal
 * or now, or that the app can no longer read, refuses the export (RESTRICTED_EVIDENCE) to any viewer whose own Jira
 * work log list does not contain it, and a work log the app can no longer read refuses it to everyone. The panel
 * shows only the number of work logs.
 *
 * @author Fahim Farook
 */

import { canonicalizeIssueState } from '../src/domain/canonicalizer';
import { computeSnapshotHash } from '../src/domain/crypto';
import { getSealEvidence, sealIssue, verifyIssue } from '../src/index';
import { createJiraClient } from '../src/jira/jira-client';
import { FakeJira, MemoryStore, model, panelContext, sampleIssue, validSignature } from './support/fakes';

jest.mock('@forge/api', () => ({ __esModule: true, default: {}, route: (s: any, ...v: any[]) => s.reduce((a: string, x: string, i: number) => a + x + (v[i] ?? ''), '') }));
jest.mock('@forge/kvs', () => ({ kvs: {} }));

const ROLE = { type: 'role', value: 'Developers', identifier: '10002' };
const worklog = (id: string, comment: string, restricted = false) => ({
  id,
  author: { accountId: 'dev' },
  started: '2026-11-01T00:00:00.000+0000',
  timeSpentSeconds: 60,
  comment,
  ...(restricted ? { visibility: ROLE } : {})
});

function setup(worklogs: any[]) {
  const issue: any = sampleIssue();
  issue.fields.worklog = { total: worklogs.length, worklogs };
  const jira = new FakeJira(issue);
  jira.approvers = new Set(['ann']);
  const storage = new MemoryStore();
  const as = (user: string) => {
    jira.currentUser = user;
    return { jira, storage };
  };
  return { jira, storage, as };
}

const setWorklogs = (jira: FakeJira, worklogs: any[]) => {
  jira.issue.fields.worklog = { total: worklogs.length, worklogs };
};

describe('M-11 the snapshot records restricted work logs outside the hash', () => {
  it('lists each covered restricted work log with its role, and the visibility does not change the hash', () => {
    const snap = canonicalizeIssueState({ id: '1', key: 'X-1', fields: { worklog: { worklogs: [worklog('1', 'open'), worklog('2', 'secret', true)] } } }, 't');
    expect(snap.restrictedWorklogs).toEqual([{ id: '2', type: 'role', value: 'Developers' }]);
    const plain = canonicalizeIssueState({ id: '1', key: 'X-1', fields: { worklog: { worklogs: [worklog('1', 'open'), worklog('2', 'secret')] } } }, 't');
    expect(computeSnapshotHash(snap)).toBe(computeSnapshotHash(plain));
    expect(canonicalizeIssueState({ id: '1', key: 'X-1', fields: {} }, 't').restrictedWorklogs).toEqual([]);
  });
});

describe('M-11 the export (probe P5)', () => {
  it('P5: a work log restricted at the seal is not exported to a viewer outside the role, and the panel shows only the count', async () => {
    const { jira, as } = setup([worklog('50', 'SECRET-P5 vault code', true)]);
    await sealIssue({ signature: validSignature() }, panelContext('ann'), as('ann'));
    jira.hiddenFrom = { outsider: ['50'] };
    const evidence: any = await getSealEvidence({}, panelContext('outsider'), as('outsider'));
    expect(evidence).toMatchObject({ ok: false, code: 'RESTRICTED_EVIDENCE' });
    expect(JSON.stringify(evidence)).not.toContain('SECRET-P5');
    const insider: any = await getSealEvidence({}, panelContext('insider'), as('insider'));
    expect(insider).toMatchObject({ format: 'ledgerseal-evidence/1' });
    expect(JSON.stringify(insider)).toContain('SECRET-P5');
    setWorklogs(jira, [{ ...worklog('50', 'SECRET-P5 changed', true) }]);
    const panel: any = await verifyIssue({}, panelContext('outsider'), as('outsider'));
    expect(panel.status).toBe('SEAL_BROKEN');
    expect(JSON.stringify(panel)).not.toContain('SECRET-P5');
    expect(JSON.stringify(panel)).toContain('1 work log entries');
  });

  it('a work log open at the seal and restricted later is not exported to a viewer outside the role', async () => {
    const { jira, as } = setup([worklog('50', 'SECRET-NOW')]);
    await sealIssue({ signature: validSignature() }, panelContext('ann'), as('ann'));
    setWorklogs(jira, [worklog('50', 'SECRET-NOW', true)]);
    jira.hiddenFrom = { outsider: ['50'] };
    const evidence: any = await getSealEvidence({}, panelContext('outsider'), as('outsider'));
    expect(evidence).toMatchObject({ ok: false, code: 'RESTRICTED_EVIDENCE' });
    expect(JSON.stringify(evidence)).not.toContain('SECRET-NOW');
    await expect(getSealEvidence({}, panelContext('insider'), as('insider'))).resolves.toMatchObject({ format: 'ledgerseal-evidence/1' });
  });

  it('a work log restricted at the seal is checked even when the live read no longer shows a restriction', async () => {
    const { jira, as } = setup([worklog('50', 'SECRET-SEAL', true)]);
    await sealIssue({ signature: validSignature() }, panelContext('ann'), as('ann'));
    setWorklogs(jira, [worklog('50', 'SECRET-SEAL')]);
    jira.hiddenFrom = { outsider: ['50'] };
    await expect(getSealEvidence({}, panelContext('outsider'), as('outsider'))).resolves.toMatchObject({ ok: false, code: 'RESTRICTED_EVIDENCE' });
  });

  it('a seal made before M-11 is checked against the live visibility', async () => {
    const { jira, storage, as } = setup([worklog('50', 'SECRET-OLD', true)]);
    await sealIssue({ signature: validSignature() }, panelContext('ann'), as('ann'));
    const we = await model.workEffort(storage);
    const snap = JSON.parse(storage.map.get(model.contentKey(we)));
    delete snap.restrictedWorklogs;
    storage.map.set(model.contentKey(we), JSON.stringify(snap));
    jira.hiddenFrom = { outsider: ['50'] };
    await expect(getSealEvidence({}, panelContext('outsider'), as('outsider'))).resolves.toMatchObject({ ok: false, code: 'RESTRICTED_EVIDENCE' });
    await expect(getSealEvidence({}, panelContext('insider'), as('insider'))).resolves.toMatchObject({ format: 'ledgerseal-evidence/1' });
  });

  it('a covered work log the app can no longer read stops the export for everyone, until the changes are approved', async () => {
    const { jira, as } = setup([worklog('50', 'SECRET-GONE')]);
    await sealIssue({ signature: validSignature() }, panelContext('ann'), as('ann'));
    // Deleted, or restricted to a role the app's user is not in: Jira leaves it out of the app's read
    setWorklogs(jira, []);
    for (const viewer of ['ann', 'viewer']) {
      const evidence: any = await getSealEvidence({}, panelContext(viewer), as(viewer));
      expect(evidence).toMatchObject({ ok: false, code: 'RESTRICTED_EVIDENCE' });
      expect(JSON.stringify(evidence)).not.toContain('SECRET-GONE');
    }
    jira.approvers.add('bob');
    await expect(sealIssue({ signature: validSignature({ reason: 'Work log deleted on purpose' }) }, panelContext('bob'), as('bob'))).resolves.toMatchObject({ ok: true });
    await expect(getSealEvidence({}, panelContext('viewer'), as('viewer'))).resolves.toMatchObject({ format: 'ledgerseal-evidence/1' });
  });

  it('reads every work log page as the app, so a work log past the first page is not taken as missing', async () => {
    const logs = [worklog('50', 'one'), worklog('51', 'two')];
    const { jira, as } = setup(logs);
    jira.issue.fields.worklog = { total: 2, worklogs: [logs[0]] };
    jira.worklogs = logs;
    await sealIssue({ signature: validSignature() }, panelContext('ann'), as('ann'));
    await expect(getSealEvidence({}, panelContext('viewer'), as('viewer'))).resolves.toMatchObject({ format: 'ledgerseal-evidence/1' });
  });

  it('fails closed when a work log read fails, and reads no work logs when the seal covers none', async () => {
    const { jira, as } = setup([worklog('50', 'secret', true)]);
    await sealIssue({ signature: validSignature() }, panelContext('ann'), as('ann'));
    jira.failVisibleWorklogs = true;
    await expect(getSealEvidence({}, panelContext('viewer'), as('viewer'))).resolves.toMatchObject({ ok: false, code: 'JIRA_UNREACHABLE' });
    jira.failVisibleWorklogs = false;
    jira.failWorklogs = true;
    await expect(getSealEvidence({}, panelContext('viewer'), as('viewer'))).resolves.toMatchObject({ ok: false, code: 'JIRA_UNREACHABLE' });

    const none = setup([]);
    await sealIssue({ signature: validSignature() }, panelContext('ann'), none.as('ann'));
    none.jira.failWorklogs = true;
    none.jira.failVisibleWorklogs = true;
    await expect(getSealEvidence({}, panelContext('viewer'), none.as('viewer'))).resolves.toMatchObject({ format: 'ledgerseal-evidence/1' });
  });
});

describe('M-11 the Jira client', () => {
  const reply = (status: number, body: any = {}) => ({ status, json: async () => body, headers: { get: () => null } });

  it('reads the work log ids as the user, page by page', async () => {
    const asUser = {
      requestJira: jest.fn()
        .mockResolvedValueOnce(reply(200, { total: 3, worklogs: [{ id: '1' }, { id: '2' }] }))
        .mockResolvedValueOnce(reply(200, { total: 3, worklogs: [{ id: '3' }] }))
    };
    const asApp = { requestJira: jest.fn() };
    await expect(createJiraClient(asApp, asUser).getVisibleWorklogIds('9')).resolves.toEqual({ ok: true, value: ['1', '2', '3'] });
    expect(asApp.requestJira).not.toHaveBeenCalled();
    expect(String(asUser.requestJira.mock.calls[1][0])).toContain('/rest/api/3/issue/9/worklog?startAt=2');
    await expect(createJiraClient(asApp, null).getVisibleWorklogIds('9')).resolves.toEqual({ ok: false, error: 'FORBIDDEN' });
    const endless = { requestJira: jest.fn().mockImplementation(async () => reply(200, { total: 99999, worklogs: [{ id: 'x' }] })) };
    await expect(createJiraClient(asApp, endless).getVisibleWorklogIds('9')).resolves.toEqual({ ok: false, error: 'TOO_LARGE' });
  });
});
