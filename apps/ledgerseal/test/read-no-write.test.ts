/**
 * Copyright (c) 2026 Asymm Systems. All rights reserved.
 *
 * B-03: a read never writes, and the panel response stays small and holds no snapshot or email.
 *
 * @author Fahim Farook
 */

import { sealIssue, validateTransition, verifyIssue } from '../src/index';
import { FakeJira, MemoryStore, panelContext, sampleIssue, validSignature, model } from './support/fakes';

jest.mock('@forge/api', () => ({ __esModule: true, default: {}, route: () => '' }));
jest.mock('@forge/kvs', () => ({ kvs: {} }));

const sig = validSignature();
const doc = (paras: number) => ({
  type: 'doc',
  version: 1,
  content: Array.from({ length: paras }, (_, n) => ({ type: 'paragraph', content: [{ type: 'text', text: 'Line ' + n + ' '.padEnd(200, 'x') }] }))
});

function combinedIssue() {
  const issue = sampleIssue();
  issue.fields.description = doc(400);
  issue.fields.comment = {
    total: 100,
    comments: Array.from({ length: 100 }, (_, n) => ({
      id: String(20000 + n),
      author: { accountId: 'c' + (n % 5), emailAddress: `c${n}@example.com` },
      body: doc(1),
      created: '2026-10-30T00:00:00.000+0000'
    }))
  };
  return issue;
}

function setup(issue: any = sampleIssue()) {
  const jira = new FakeJira(issue);
  jira.approvers = new Set(['ann']);
  jira.users = { ann: 'Ann Approver' };
  const storage = new MemoryStore();
  const as = (user: string | null) => {
    jira.currentUser = user;
    return { jira, storage };
  };
  return { jira, storage, as };
}

describe('B-03 a read never writes', () => {
  it('makes no KVS write and no property write when the sealed issue is unchanged', async () => {
    const { jira, storage, as } = setup();
    await sealIssue({ signature: sig }, panelContext('ann'), as('ann'));
    const sets = storage.sets.length;
    const writes = jira.propertyWrites.length;
    for (let i = 0; i < 3; i++) await verifyIssue({}, panelContext('viewer'), as('viewer'));
    await validateTransition({ issue: { key: 'CHG-1' } }, {}, as(null));
    expect(storage.sets.length - sets).toBe(0);
    expect(jira.propertyWrites.length - writes).toBe(0);
  });

  it('adversarial (audit flow.js step 2, T-01): 500 views of one change make one incident and one property write', async () => {
    const { jira, storage, as } = setup();
    await sealIssue({ signature: sig }, panelContext('ann'), as('ann'));
    const sizeAfterSeal = storage.bytes(model.workEffortKey());
    jira.edit('mallory', '2099-01-01T00:00:00.000Z', 'summary', 'changed');
    const sets = storage.sets.length;
    const writes = jira.propertyWrites.length;
    for (let i = 0; i < 500; i++) await verifyIssue({}, panelContext('viewer'), as('viewer'));
    for (let i = 0; i < 5; i++) await validateTransition({ issue: { key: 'CHG-1' } }, {}, as(null));
    expect(storage.sets.length - sets).toBe(3); // the incident entry, the updated record and the map key of the changer
    expect(jira.propertyWrites.length - writes).toBe(1);
    expect(jira.propertyWrites[jira.propertyWrites.length - 1].body).toMatchObject({
      schemaVersion: 3,
      status: 'SEAL_BROKEN',
      everCompromised: 'true',
      incidentCount: 1
    });
    expect(storage.bytes(model.workEffortKey()) - sizeAfterSeal).toBeLessThan(200);
  });

  it('keeps the panel response under 16 KiB for a large changed issue, with no snapshot and no email', async () => {
    const { jira, as } = setup(combinedIssue());
    await sealIssue({ signature: sig }, panelContext('ann'), as('ann'));
    jira.issue.fields.description.content.push({ type: 'paragraph', content: [{ type: 'text', text: 'Added after approval' }] });
    jira.issue.fields.comment.comments[0].body = doc(2);
    const response = await verifyIssue({}, panelContext('viewer'), as('viewer'));
    const text = JSON.stringify(response);
    expect(Buffer.byteLength(text, 'utf8')).toBeLessThanOrEqual(16 * 1024);
    expect(text).not.toContain('snapshot"');
    expect(text).not.toContain('@example.com');
    expect((response as any).tamperedFields.map((f: any) => f.fieldName)).toEqual(['Description', 'Comment edited']);
  });
});
