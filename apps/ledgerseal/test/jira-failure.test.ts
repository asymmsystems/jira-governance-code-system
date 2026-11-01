/**
 * Copyright (c) 2026 Asymm Systems. All rights reserved.
 *
 * B-06: honest results when Jira cannot be read, explicit field selection and paged comments.
 *
 * @author Fahim Farook
 */

import { sealIssue, validateTransition, verifyIssue } from '../src/index';
import { createJiraClient } from '../src/jira/jira-client';
import { FakeJira, MemoryStore, panelContext, sampleIssue, validSignature } from './support/fakes';

jest.mock('@forge/api', () => ({
  __esModule: true,
  default: {},
  route: (strings: any, ...values: any[]) =>
    strings.reduce((acc: string, s: string, i: number) => acc + s + (i < values.length ? encodeURIComponent(String(values[i])) : ''), '')
}));
jest.mock('@forge/kvs', () => ({ kvs: {} }));

const UNREACHABLE = 'LedgerSeal could not read the issue from Jira, so this transition is blocked. Try again in a minute.';

function sealed() {
  const jira = new FakeJira(sampleIssue());
  jira.approvers = new Set(['ann']);
  const storage = new MemoryStore();
  const as = (user: string | null) => {
    jira.currentUser = user;
    return { jira, storage };
  };
  return { jira, storage, as };
}

describe('B-06 honest results when Jira cannot be read', () => {
  it('adversarial (audit flow.js step 6, LS-08, LS-19): the validator says Jira could not be read and writes nothing', async () => {
    const { jira, storage, as } = sealed();
    await sealIssue({ signature: validSignature() }, panelContext('ann'), as('ann'));
    jira.failIssueGet = true;
    const sets = storage.sets.length;
    const writes = jira.propertyWrites.length;
    await expect(validateTransition({ issue: { key: 'CHG-1' } }, {}, as(null))).resolves.toEqual({ result: false, errorMessage: UNREACHABLE });
    await expect(validateTransition({ issue: { id: '10001', key: 'CHG-1' } }, {}, as(null))).resolves.toEqual({ result: false, errorMessage: UNREACHABLE });
    jira.failIssueGet = false;
    jira.failFields = true;
    await expect(validateTransition({ issue: { key: 'CHG-1' } }, {}, as(null))).resolves.toEqual({ result: false, errorMessage: UNREACHABLE });
    expect(storage.sets.length).toBe(sets);
    expect(jira.propertyWrites.length).toBe(writes);
  });

  it('returns an ERROR state from verify, never "not sealed", when Jira or storage fails', async () => {
    const { jira, storage, as } = sealed();
    jira.failIssueGet = true;
    await expect(verifyIssue({}, panelContext('viewer'), as('viewer'))).resolves.toMatchObject({ status: 'ERROR', errorReason: 'JIRA_UNREACHABLE' });
    jira.failIssueGet = false;
    storage.get = async () => {
      throw new Error('KVS down');
    };
    await expect(verifyIssue({}, panelContext('viewer'), as('viewer'))).resolves.toMatchObject({ status: 'ERROR', errorReason: 'STORAGE' });
    expect(storage.sets).toEqual([]);
  });

  it('returns MISSING_ISSUE from verify instead of throwing', async () => {
    const { as } = sealed();
    await expect(verifyIssue({}, { accountId: 'viewer' }, as('viewer'))).resolves.toMatchObject({ ok: false, code: 'MISSING_ISSUE' });
  });
});

describe('B-06 explicit fields and paged comments', () => {
  const reply = (status: number, body: any = {}) => ({ status, json: async () => body, headers: { get: () => null } });

  it('asks for explicit fields and reads every comment page', async () => {
    const page = (startAt: number, n: number, total: number) => ({
      startAt,
      maxResults: 100,
      total,
      comments: Array.from({ length: n }, (_, i) => ({ id: String(startAt + i), author: { accountId: 'a' }, body: 'c', created: 'x' }))
    });
    const asApp = {
      requestJira: jest
        .fn()
        .mockResolvedValueOnce(reply(200, { id: '1', key: 'X-1', fields: {} }))
        .mockResolvedValueOnce(reply(200, page(0, 100, 150)))
        .mockResolvedValueOnce(reply(200, page(100, 50, 150)))
    };
    const client = createJiraClient(asApp, null);
    await client.getIssue('1');
    const comments = await client.getComments('1');
    const urls = asApp.requestJira.mock.calls.map((c: any[]) => String(c[0]));
    expect(urls[0]).toBe('/rest/api/3/issue/1?fields=*all,-comment');
    expect(urls[1]).toBe('/rest/api/3/issue/1/comment?startAt=0&maxResults=100&orderBy=created');
    expect(urls[2]).toBe('/rest/api/3/issue/1/comment?startAt=100&maxResults=100&orderBy=created');
    expect(comments.ok && comments.value).toHaveLength(150);
  });

  it('passes a comment read failure through and stops on an empty page', async () => {
    const asApp = {
      requestJira: jest.fn().mockResolvedValueOnce(reply(500)).mockResolvedValueOnce(reply(200, { total: 5, comments: [] }))
    };
    const client = createJiraClient(asApp, null, { maxRetries: 0 });
    await expect(client.getComments('1')).resolves.toMatchObject({ ok: false, error: 'UNREACHABLE' });
    await expect(client.getComments('1')).resolves.toEqual({ ok: true, value: [] });
  });

  it('hashes comments from the comment endpoint, not the issue body', async () => {
    const { jira, storage, as } = sealed();
    jira.issue.fields.comment = { comments: [{ id: 'stale', author: { accountId: 'x' }, body: 'old', created: 'x' }], total: 1 };
    jira.comments = [{ id: '7', author: { accountId: 'a' }, body: 'from the endpoint', created: '2026-11-01T00:00:00.000Z' }];
    await sealIssue({ signature: validSignature() }, panelContext('ann'), as('ann'));
    const record = await storage.get('ls2:seal:10001');
    const snapshot = JSON.parse(await storage.get(`ls2:snap:${record.certificateId}:0`));
    expect(snapshot.comments.map((c: any) => c.id)).toEqual(['7']);
    jira.failComments = true;
    await expect(verifyIssue({}, panelContext('viewer'), as('viewer'))).resolves.toMatchObject({ status: 'ERROR' });
  });

  it('reads every work log page when the issue body holds only the first page', async () => {
    const { jira, storage, as } = sealed();
    jira.issue.fields.worklog = { total: 3, worklogs: [{ id: '1', author: { accountId: 'a' }, started: 'x', timeSpentSeconds: 60 }] };
    jira.worklogs = ['1', '2', '3'].map(id => ({ id, author: { accountId: 'a' }, started: 'x', timeSpentSeconds: 60 }));
    await sealIssue({ signature: validSignature() }, panelContext('ann'), as('ann'));
    const record = await storage.get('ls2:seal:10001');
    const snapshot = JSON.parse(await storage.get(`ls2:snap:${record.certificateId}:0`));
    expect(snapshot.fields.find((f: any) => f.id === 'worklog').value.map((w: any) => w.id)).toEqual(['1', '2', '3']);
    jira.failWorklogs = true;
    await expect(verifyIssue({}, panelContext('viewer'), as('viewer'))).resolves.toMatchObject({ status: 'ERROR' });
  });
});
