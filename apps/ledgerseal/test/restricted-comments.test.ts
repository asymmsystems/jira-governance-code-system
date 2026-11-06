/**
 * Copyright (c) 2026 Asymm Systems. All rights reserved.
 *
 * Readiness finding F-06: a comment restricted to a role or group is covered by the seal like any other comment the
 * app can read, but its text is shown in the panel, and the evidence is exported, only to a viewer who can see it in
 * Jira (checked as the user).
 *
 * @author Fahim Farook
 */

import { canonicalizeIssueState } from '../src/domain/canonicalizer';
import { computeSnapshotHash } from '../src/domain/crypto';
import { getSealEvidence, sealIssue, verifyIssue } from '../src/index';
import { RESTRICTED_COMMENT_TEXT } from '../src/service/ledger';
import { createJiraClient } from '../src/jira/jira-client';
import { FakeJira, MemoryStore, model, panelContext, sampleIssue, validSignature } from './support/fakes';

jest.mock('@forge/api', () => ({ __esModule: true, default: {}, route: (s: any, ...v: any[]) => s.reduce((a: string, x: string, i: number) => a + x + (v[i] ?? ''), '') }));
jest.mock('@forge/kvs', () => ({ kvs: {} }));

const ROLE = { type: 'role', value: 'Developers', identifier: '10002' };
const comment = (id: string, body: string, restricted = false, extra: any = {}) => ({
  id,
  author: { accountId: 'dev' },
  created: '2026-11-01T00:00:00.000Z',
  body,
  ...(restricted ? { visibility: ROLE } : {}),
  ...extra
});

function setup(comments: any[] = []) {
  const issue = sampleIssue();
  issue.fields.comment = { comments };
  const jira = new FakeJira(issue);
  jira.approvers = new Set(['ann']);
  const storage = new MemoryStore();
  const as = (user: string) => {
    jira.currentUser = user;
    return { jira, storage };
  };
  return { jira, storage, as };
}

const rowOf = (view: any, id: string) => view.tamperedFields.find((f: any) => f.fieldId === `comment:${id}`);

describe('F-06 the snapshot records restricted comments outside the hash', () => {
  it('lists each restricted comment with its role or group, and the visibility does not change the hash', () => {
    const issue = { id: '1', key: 'X-1', fields: { comment: { comments: [comment('1', 'open'), comment('2', 'secret', true)] } } };
    const snap = canonicalizeIssueState(issue, 't');
    expect(snap.restrictedComments).toEqual([{ id: '2', type: 'role', value: 'Developers' }]);
    const plain = { id: '1', key: 'X-1', fields: { comment: { comments: [comment('1', 'open'), comment('2', 'secret')] } } };
    expect(computeSnapshotHash(snap)).toBe(computeSnapshotHash(canonicalizeIssueState(plain, 't')));
    const group = canonicalizeIssueState({ id: '1', key: 'X-1', fields: { comment: { comments: [comment('3', 'g', false, { visibility: { type: 'group', identifier: 'gid-1' } })] } } }, 't');
    expect(group.restrictedComments).toEqual([{ id: '3', type: 'group', value: 'gid-1' }]);
  });
});

describe('F-06 the panel', () => {
  it('shows a restricted comment added after the seal only to a viewer who can see it in Jira', async () => {
    const { jira, as } = setup([comment('1', 'Approved')]);
    await sealIssue({ signature: validSignature() }, panelContext('ann'), as('ann'));
    jira.issue.fields.comment.comments.push(comment('2', 'Use the backup key in the vault', true, { created: '2099-01-01T00:00:00.000Z' }));
    jira.hiddenFrom = { outsider: ['2'] };
    const outsider: any = await verifyIssue({}, panelContext('outsider'), as('outsider'));
    expect(rowOf(outsider, '2')).toMatchObject({ fieldName: 'Comment added', liveValue: RESTRICTED_COMMENT_TEXT, sealedValue: '(empty)' });
    expect(JSON.stringify(outsider)).not.toContain('backup key');
    const insider: any = await verifyIssue({}, panelContext('insider'), as('insider'));
    expect(rowOf(insider, '2').liveValue).toContain('Use the backup key in the vault');
  });

  it('hides both values of an edited restricted comment, and a removed one, from a viewer who cannot see it', async () => {
    const { jira, as } = setup([comment('1', 'Rotate keys', true), comment('2', 'Old plan', true)]);
    await sealIssue({ signature: validSignature() }, panelContext('ann'), as('ann'));
    jira.issue.fields.comment.comments = [comment('1', 'Rotate keys and skip QA', true, { updated: '2099-01-01T00:00:00.000Z', updateAuthor: { accountId: 'dev' } })];
    jira.hiddenFrom = { outsider: ['1'] };
    const view: any = await verifyIssue({}, panelContext('outsider'), as('outsider'));
    expect(rowOf(view, '1')).toMatchObject({ fieldName: 'Comment edited', sealedValue: RESTRICTED_COMMENT_TEXT, liveValue: RESTRICTED_COMMENT_TEXT });
    expect(rowOf(view, '1')).not.toHaveProperty('detail');
    // A removed comment is in no one's list any more, so its text is never shown when it was restricted
    expect(rowOf(view, '2')).toMatchObject({ fieldName: 'Comment removed', sealedValue: RESTRICTED_COMMENT_TEXT, liveValue: '(empty)' });
    expect(JSON.stringify(view)).not.toMatch(/Rotate keys|Old plan|skip QA/);
  });

  it('shows open comments without asking Jira, and hides restricted ones when Jira cannot answer', async () => {
    const { jira, as } = setup([comment('1', 'Approved')]);
    await sealIssue({ signature: validSignature() }, panelContext('ann'), as('ann'));
    jira.issue.fields.comment.comments.push(comment('2', 'Open note'), comment('3', 'Restricted note', true));
    jira.failVisibleComments = true;
    const view: any = await verifyIssue({}, panelContext('viewer'), as('viewer'));
    expect(rowOf(view, '2').liveValue).toContain('Open note');
    expect(rowOf(view, '3').liveValue).toBe(RESTRICTED_COMMENT_TEXT);
  });

  it('a seal made before F-06 (no record of restricted comments) hides the text of a removed comment', async () => {
    const { jira, storage, as } = setup([comment('1', 'Gone soon')]);
    await sealIssue({ signature: validSignature() }, panelContext('ann'), as('ann'));
    const we = await model.workEffort(storage);
    const key = model.contentKey(we);
    const snap = JSON.parse(storage.map.get(key));
    delete snap.restrictedComments;
    storage.map.set(key, JSON.stringify(snap));
    jira.issue.fields.comment.comments = [];
    const view: any = await verifyIssue({}, panelContext('viewer'), as('viewer'));
    expect(rowOf(view, '1')).toMatchObject({ fieldName: 'Comment removed', sealedValue: RESTRICTED_COMMENT_TEXT });
  });
});

describe('F-06 the evidence export', () => {
  it('goes only to a viewer who can see every restricted comment the seal covers', async () => {
    const { jira, as } = setup([comment('1', 'Approved'), comment('2', 'Restricted note', true)]);
    await sealIssue({ signature: validSignature() }, panelContext('ann'), as('ann'));
    jira.hiddenFrom = { outsider: ['2'] };
    await expect(getSealEvidence({}, panelContext('outsider'), as('outsider'))).resolves.toMatchObject({ ok: false, code: 'RESTRICTED_EVIDENCE' });
    const evidence: any = await getSealEvidence({}, panelContext('insider'), as('insider'));
    expect(evidence.format).toBe('ledgerseal-evidence/1');
    jira.failVisibleComments = true;
    await expect(getSealEvidence({}, panelContext('insider'), as('insider'))).resolves.toMatchObject({ ok: false, code: 'JIRA_UNREACHABLE' });
  });

  it('for a seal made before F-06, reads the live comments to find which sealed comments are restricted', async () => {
    const { jira, storage, as } = setup([comment('1', 'Restricted note', true)]);
    await sealIssue({ signature: validSignature() }, panelContext('ann'), as('ann'));
    const we = await model.workEffort(storage);
    const snap = JSON.parse(storage.map.get(model.contentKey(we)));
    delete snap.restrictedComments;
    storage.map.set(model.contentKey(we), JSON.stringify(snap));
    jira.hiddenFrom = { outsider: ['1'] };
    await expect(getSealEvidence({}, panelContext('outsider'), as('outsider'))).resolves.toMatchObject({ code: 'RESTRICTED_EVIDENCE' });
    await expect(getSealEvidence({}, panelContext('insider'), as('insider'))).resolves.toMatchObject({ format: 'ledgerseal-evidence/1' });
    jira.failComments = true;
    await expect(getSealEvidence({}, panelContext('insider'), as('insider'))).resolves.toMatchObject({ ok: false, code: 'JIRA_UNREACHABLE' });
  });

  it('an export with no restricted comment asks Jira nothing extra', async () => {
    const { jira, as } = setup([comment('1', 'Approved')]);
    await sealIssue({ signature: validSignature() }, panelContext('ann'), as('ann'));
    jira.failVisibleComments = true;
    await expect(getSealEvidence({}, panelContext('viewer'), as('viewer'))).resolves.toMatchObject({ format: 'ledgerseal-evidence/1' });
  });
});

describe('F-06 the Jira client', () => {
  const reply = (status: number, body: any = {}) => ({ status, json: async () => body, headers: { get: () => null } });

  it('reads the comment ids as the user, page by page', async () => {
    const asUser = {
      requestJira: jest.fn()
        .mockResolvedValueOnce(reply(200, { total: 3, comments: [{ id: '1' }, { id: '2' }] }))
        .mockResolvedValueOnce(reply(200, { total: 3, comments: [{ id: '3' }] }))
    };
    const asApp = { requestJira: jest.fn() };
    await expect(createJiraClient(asApp, asUser).getVisibleCommentIds('9')).resolves.toEqual({ ok: true, value: ['1', '2', '3'] });
    expect(asApp.requestJira).not.toHaveBeenCalled();
    await expect(createJiraClient(asApp, null).getVisibleCommentIds('9')).resolves.toEqual({ ok: false, error: 'FORBIDDEN' });
    const failing = { requestJira: jest.fn().mockResolvedValueOnce(reply(403)) };
    await expect(createJiraClient(asApp, failing).getVisibleCommentIds('9')).resolves.toMatchObject({ ok: false, error: 'FORBIDDEN' });
    const endless = { requestJira: jest.fn().mockImplementation(async () => reply(200, { total: 99999, comments: [{ id: 'x' }] })) };
    await expect(createJiraClient(asApp, endless).getVisibleCommentIds('9')).resolves.toEqual({ ok: false, error: 'TOO_LARGE' });
  });
});
