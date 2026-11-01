/**
 * Copyright (c) 2026 Asymm Systems. All rights reserved.
 *
 * B-11: changes are recorded when Jira reports them, through the issue, comment, attachment and work log events.
 * Payload shapes follow the Forge Jira events reference (read 2026-11-01).
 *
 * @author Fahim Farook
 */

import * as fs from 'fs';
import * as path from 'path';
import { onIssueChanged, sealIssue, validateTransition } from '../src/index';
import { FakeJira, MemoryStore, panelContext, sampleIssue, validSignature, model } from './support/fakes';

jest.mock('@forge/api', () => ({ __esModule: true, default: { asApp: jest.fn(), asUser: jest.fn() }, route: () => '' }));
jest.mock('@forge/kvs', () => ({ kvs: {} }));

const updated = (issueId = '10001', extra: any = {}) => ({
  eventType: 'avi:jira:updated:issue',
  selfGenerated: false,
  issue: { id: issueId, key: 'CHG-1' },
  atlassianId: 'mallory',
  changelog: { items: [{ field: 'summary', fieldId: 'summary', from: null, to: null }] },
  ...extra
});

async function sealed(fields: any[] = []) {
  const jira = new FakeJira(sampleIssue());
  jira.fields = fields;
  jira.approvers = new Set(['ann']);
  jira.currentUser = 'ann';
  const storage = new MemoryStore();
  await sealIssue({ signature: validSignature() }, panelContext('ann'), { jira, storage });
  jira.currentUser = null;
  return { jira, storage, deps: { jira, storage } };
}

const incidents = (storage: MemoryStore) =>
  model.statusRows(storage).filter(r => r.statusId === 'LS_CHANGED');

describe('B-11 issue-changed trigger', () => {
  it('records one incident, with the author and time, and writes the property once', async () => {
    const { jira, storage, deps } = await sealed();
    jira.edit('mallory', '2099-01-01T00:00:00.000Z', 'summary', 'Rotate credentials and drop the audit table');
    const writes = jira.propertyWrites.length;
    await onIssueChanged(updated(), {}, deps);
    await onIssueChanged(updated(), {}, deps);
    expect(incidents(storage)).toHaveLength(1);
    expect(incidents(storage)[0].data.changes).toEqual([
      { fieldId: 'summary', fieldName: 'Summary', changedBy: ['mallory'], changedAt: '2099-01-01T00:00:00.000Z' }
    ]);
    expect(jira.propertyWrites.length - writes).toBe(1);
    expect(jira.propertyWrites[jira.propertyWrites.length - 1].body).toMatchObject({ status: 'SEAL_BROKEN', incidentCount: 1 });
  });

  it('writes nothing for a change to a field the seal does not cover', async () => {
    const rank = { id: 'customfield_10019', name: 'Rank', schema: { custom: 'com.pyxis.greenhopper.jira:gh-lexo-rank' } };
    const { jira, storage, deps } = await sealed([rank]);
    jira.issue.fields.customfield_10019 = '0|i0001:';
    const sets = storage.sets.length;
    const writes = jira.propertyWrites.length;
    await onIssueChanged(updated('10001', { changelog: { items: [{ field: 'Rank', fieldId: 'customfield_10019' }] } }), {}, deps);
    expect(storage.sets.length).toBe(sets);
    expect(jira.propertyWrites.length).toBe(writes);
  });

  it('adversarial (T-02 A9, LS-16): an edit and a revert with no panel view in between keep the gate closed', async () => {
    const { jira, deps } = await sealed();
    const original = jira.issue.fields.summary;
    jira.edit('mallory', '2099-01-01T00:00:00.000Z', 'summary', 'Release v2 with unreviewed scope');
    await onIssueChanged(updated(), {}, deps);
    jira.edit('mallory', '2099-01-01T00:05:00.000Z', 'summary', original);
    await onIssueChanged(updated(), {}, deps);
    const gate = await validateTransition({ issue: { key: 'CHG-1' } }, {}, deps);
    expect(gate.result).toBe(false);
    expect(gate.errorMessage).toContain('was changed back');
  });

  it('finds the issue from comment, attachment and work log events', async () => {
    const { jira, storage, deps } = await sealed();
    jira.comments = [{ id: '1', author: { accountId: 'mallory' }, body: 'new', created: '2099-01-01T00:00:00.000Z' }];
    await onIssueChanged({ eventType: 'avi:jira:commented:issue', issue: { id: '10001' }, comment: { id: '1' } }, {}, deps);
    expect(incidents(storage)).toHaveLength(1);
    jira.issue.fields.attachment = [{ id: '5', filename: 'f.pdf', size: 1, created: 'x', author: { accountId: 'mallory' } }];
    await onIssueChanged({ eventType: 'avi:jira:created:attachment', attachment: { id: '5', issueId: '10001' } }, {}, deps);
    expect(incidents(storage)).toHaveLength(2);
    jira.issue.fields.worklog = { total: 1, worklogs: [{ id: '9', author: { accountId: 'mallory' }, started: 'x', timeSpentSeconds: 60 }] };
    await onIssueChanged({ eventType: 'avi:jira:created:worklog', worklog: { id: '9', issueId: '10001' } }, {}, deps);
    expect(incidents(storage)).toHaveLength(3);
  });

  it('ignores its own events, unsealed issues, unknown payloads and Jira failures, without throwing', async () => {
    const { jira, storage, deps } = await sealed();
    jira.issue.fields.summary = 'changed';
    const sets = storage.sets.length;
    await onIssueChanged(updated('10001', { selfGenerated: true }), {}, deps);
    await onIssueChanged({ eventType: 'avi:jira:updated:issue' }, {}, deps);
    await onIssueChanged(updated('99999'), {}, deps);
    jira.failIssueGet = true;
    await expect(onIssueChanged(updated(), {}, deps)).resolves.toEqual({ recorded: false });
    jira.failIssueGet = false;
    storage.get = async () => {
      throw new Error('KVS down');
    };
    await expect(onIssueChanged(updated(), {}, deps)).resolves.toEqual({ recorded: false });
    expect(storage.sets.length).toBe(sets);
  });

  it('handles a 100-field change well inside the 25 s limit', async () => {
    const { jira, deps } = await sealed();
    for (let i = 0; i < 100; i++) jira.edit('mallory', `2099-01-01T00:00:${String(i % 60).padStart(2, '0')}.000Z`, `customfield_${30000 + i}`, `value ${i}`);
    const started = Date.now();
    await expect(onIssueChanged(updated(), {}, deps)).resolves.toEqual({ recorded: true });
    expect(Date.now() - started).toBeLessThan(2000);
  });

  it('declares the trigger and its events in the manifest', () => {
    const manifest = fs.readFileSync(path.resolve(__dirname, '../manifest.yml'), 'utf8');
    for (const event of [
      'avi:jira:updated:issue',
      'avi:jira:commented:issue',
      'avi:jira:created:attachment',
      'avi:jira:deleted:attachment',
      'avi:jira:created:worklog',
      'avi:jira:updated:worklog',
      'avi:jira:deleted:worklog'
    ]) {
      expect(manifest).toContain(`- ${event}`);
    }
    expect(manifest).toMatch(/- key: on-issue-changed\n\s+handler: index\.onIssueChanged/);
  });
});

describe('B-11 trigger defaults', () => {
  it('uses the Forge defaults and returns early for an event without an issue', async () => {
    await expect(onIssueChanged({ eventType: 'avi:jira:updated:issue' })).resolves.toEqual({ recorded: false });
  });
});
