/**
 * Copyright (c) 2026 Asymm Systems. All rights reserved.
 *
 * Readiness review B2, F-01, F-13: a user who changed covered content after the seal (a field, a comment, a work
 * log or an attachment) cannot approve the changes, revoke the seal or seal it again after a revoke. A change to a
 * field outside the seal, such as a status move or a Rank change, does not count.
 *
 * @author Fahim Farook
 */

import { revokeSeal, sealIssue, verifyIssue } from '../src/index';
import { authorsSince, changeAuthorsSince, itemAuthorsSince } from '../src/domain/policy';
import { SELF_REVOKE_MESSAGE } from '../src/service/ledger';
import { FakeJira, MemoryStore, panelContext, sampleIssue, validSignature } from './support/fakes';

jest.mock('@forge/api', () => ({ __esModule: true, default: {}, route: () => '' }));
jest.mock('@forge/kvs', () => ({ kvs: {} }));

const LATER = '2099-01-01T00:00:00.000Z';
const RANK = [{ id: 'customfield_10019', name: 'Rank', schema: { type: 'any', custom: 'com.pyxis.greenhopper.jira:gh-lexo-rank' } }];

function setup() {
  const jira = new FakeJira(sampleIssue());
  jira.fields = RANK;
  jira.approvers = new Set(['ann', 'bob', 'carl']);
  const storage = new MemoryStore();
  const as = (user: string) => {
    jira.currentUser = user;
    return { jira, storage };
  };
  return { jira, storage, as };
}

async function sealed() {
  const s = setup();
  await sealIssue({ signature: validSignature() }, panelContext('ann'), s.as('ann'));
  return s;
}

const approve = (s: ReturnType<typeof setup>, user: string) => sealIssue({ signature: validSignature({ reason: 'Reviewed' }) }, panelContext(user), s.as(user));
const rights = async (s: ReturnType<typeof setup>, user: string) => ((await verifyIssue({}, panelContext(user), s.as(user))) as any).rights;

describe('F-01 comments, work logs and attachments count as changes by their author', () => {
  it('a comment added after the seal: its author cannot approve it; another approver can', async () => {
    const s = await sealed();
    s.jira.issue.fields.comment = { comments: [{ id: '9', author: { accountId: 'bob' }, created: LATER, updated: LATER, body: 'Also drop the audit table' }] };
    expect(await rights(s, 'bob')).toMatchObject({ canApproveChanges: false, canRevoke: false, blockedBySelfChange: true });
    await expect(approve(s, 'bob')).resolves.toMatchObject({ ok: false, code: 'SELF_APPROVAL' });
    expect(await rights(s, 'carl')).toMatchObject({ canApproveChanges: true, blockedBySelfChange: false });
    await expect(approve(s, 'carl')).resolves.toMatchObject({ ok: true });
  });

  it('an old comment edited after the seal counts for the editor, not for its first author', async () => {
    const s = setup();
    s.jira.issue.fields.comment = { comments: [{ id: '5', author: { accountId: 'carl' }, created: '2026-01-01T00:00:00.000Z', updated: '2026-01-01T00:00:00.000Z', body: 'Ready' }] };
    await sealIssue({ signature: validSignature() }, panelContext('ann'), s.as('ann'));
    s.jira.issue.fields.comment.comments[0] = { ...s.jira.issue.fields.comment.comments[0], updated: LATER, updateAuthor: { accountId: 'bob' }, body: 'Ready, and skip QA' };
    await expect(approve(s, 'bob')).resolves.toMatchObject({ code: 'SELF_APPROVAL' });
    await expect(approve(s, 'carl')).resolves.toMatchObject({ ok: true });
  });

  it('a work log added after the seal counts for its author', async () => {
    const s = await sealed();
    s.jira.issue.fields.worklog = { total: 1, worklogs: [{ id: '3', author: { accountId: 'bob' }, created: LATER, updated: LATER, started: LATER, timeSpentSeconds: 60 }] };
    await expect(approve(s, 'bob')).resolves.toMatchObject({ code: 'SELF_APPROVAL' });
    const view: any = await verifyIssue({}, panelContext('carl'), s.as('carl'));
    expect(view.tamperedFields.find((f: any) => f.fieldId === 'worklog')).toMatchObject({ changedBy: ['bob'] });
  });

  it('an attachment added after the seal counts for its author', async () => {
    const s = await sealed();
    s.jira.issue.fields.attachment = [{ id: '4', filename: 'script.sql', size: 10, created: LATER, author: { accountId: 'bob' } }];
    await expect(approve(s, 'bob')).resolves.toMatchObject({ code: 'SELF_APPROVAL' });
  });
});

describe('B2 revoke follows separation of duties', () => {
  it('refuses a revoke from a user who changed the issue after the seal, and writes nothing', async () => {
    const s = await sealed();
    s.jira.edit('bob', LATER, 'summary', 'changed');
    const sets = s.storage.sets.length;
    await expect(revokeSeal({ reason: 'Hide it' }, panelContext('bob'), s.as('bob'))).resolves.toEqual({ ok: false, code: 'SELF_APPROVAL', message: SELF_REVOKE_MESSAGE });
    // Only the run lock (review round 2, R2-1) was taken and given back; no record was written
    expect(s.storage.sets.slice(sets).filter(k => !k.startsWith('ls3:runlock:'))).toEqual([]);
    expect(s.storage.map.has('ls3:runlock:10001')).toBe(false);
    await expect(revokeSeal({ reason: 'Scope changed' }, panelContext('carl'), s.as('carl'))).resolves.toMatchObject({ ok: true });
  });

  it('refuses a revoke when Jira cannot be read', async () => {
    const s = await sealed();
    s.jira.failChangelog = true;
    await expect(revokeSeal({ reason: 'x' }, panelContext('carl'), s.as('carl'))).resolves.toMatchObject({ code: 'JIRA_UNREACHABLE' });
    s.jira.failChangelog = false;
    s.jira.failIssueGet = true;
    await expect(revokeSeal({ reason: 'x' }, panelContext('carl'), s.as('carl'))).resolves.toMatchObject({ code: 'JIRA_UNREACHABLE' });
  });

  it('after a revoke, the user who changed the issue is offered no seal', async () => {
    const s = await sealed();
    s.jira.edit('bob', LATER, 'summary', 'changed');
    await revokeSeal({ reason: 'Scope changed' }, panelContext('carl'), s.as('carl'));
    expect(await rights(s, 'bob')).toMatchObject({ canSeal: false, blockedBySelfChange: true });
    expect(await rights(s, 'carl')).toMatchObject({ canSeal: true });
  });
});

describe('F-13 only covered changes count', () => {
  it('an approver who only moved the issue or ranked it may still approve another person\'s change', async () => {
    const s = await sealed();
    s.jira.edit('bob', LATER, 'status', { name: 'In Review' });
    s.jira.edit('bob', LATER, 'customfield_10019', '0|i0001');
    s.jira.edit('carl', LATER, 'summary', 'changed by carl');
    expect(await rights(s, 'bob')).toMatchObject({ canApproveChanges: true, canRevoke: true, blockedBySelfChange: false });
    await expect(approve(s, 'bob')).resolves.toMatchObject({ ok: true });
  });

  it('counts an entry with no readable item, and an entry with an unreadable time', () => {
    const since = '2026-11-01T00:00:00.000Z';
    expect([...authorsSince([{ id: '1', author: { accountId: 'a' }, created: LATER, items: [] }], since, () => false)]).toEqual(['a']);
    expect([...authorsSince([{ id: '1', author: { accountId: 'b' }, created: 'x', items: [{ field: 'status', fieldId: 'status' }] } as any], since, f => f !== 'status')]).toEqual([]);
    expect([...authorsSince([{ id: '1', author: { accountId: 'c' }, created: LATER, items: [{ field: 'Rank' }] } as any], since, f => f !== 'Rank')]).toEqual([]);
    expect([...authorsSince([{ id: '1', created: LATER, items: [] } as any], since)]).toEqual([]);
  });

  it('reads item authors safely from incomplete data', () => {
    expect([...itemAuthorsSince({}, '2026-11-01T00:00:00.000Z')]).toEqual([]);
    expect([...itemAuthorsSince({ fields: { comment: { comments: [{ created: LATER, author: {} }] }, attachment: [{ created: '2020-01-01T00:00:00.000Z', author: { accountId: 'old' } }] } }, '2026-11-01T00:00:00.000Z')]).toEqual([]);
    expect([...changeAuthorsSince([], { fields: { attachment: [{ created: LATER, author: { accountId: 'z' } }] } }, '2026-11-01T00:00:00.000Z', () => true)]).toEqual(['z']);
  });
});
