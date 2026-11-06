/**
 * Copyright (c) 2026 Asymm Systems. All rights reserved.
 *
 * B-12: each change shows the field, was, now, who changed it and when; long and rich values are summarised;
 * an issue type or project change is named (NF-01).
 *
 * @author Fahim Farook
 */

import { RESTRICTED_COMMENT_TEXT } from '../src/service/ledger';
import { canonicalizeIssueState } from '../src/domain/canonicalizer';
import { generateSealCertificate } from '../src/domain/crypto';
import { analyzeTamperState } from '../src/domain/tamper-detector';
import { sealIssue, validateTransition, verifyIssue } from '../src/index';
import { FakeJira, MemoryStore, panelContext, sampleIssue, validSignature } from './support/fakes';

jest.mock('@forge/api', () => ({ __esModule: true, default: {}, route: () => '' }));
jest.mock('@forge/kvs', () => ({ kvs: {} }));

const para = (text: string) => ({ type: 'paragraph', content: [{ type: 'text', text }] });
const doc = (...texts: string[]) => ({ type: 'doc', version: 1, content: texts.map(para) });

async function sealed(mutate: (issue: any) => void = () => {}) {
  const issue = sampleIssue();
  mutate(issue);
  const jira = new FakeJira(issue);
  jira.approvers = new Set(['ann']);
  jira.currentUser = 'ann';
  const storage = new MemoryStore();
  await sealIssue({ signature: validSignature() }, panelContext('ann'), { jira, storage });
  jira.currentUser = 'viewer';
  return { jira, storage, deps: { jira, storage } };
}

const view = async (deps: any) => (await verifyIssue({}, panelContext('viewer'), deps)) as any;

describe('B-12 change list with who and when', () => {
  it('shows field, was, now, who and when for each changed field, from the change log', async () => {
    const { jira, deps } = await sealed();
    jira.edit('mallory', '2099-01-01T10:00:00.000Z', 'summary', 'Rotate credentials and drop the audit table');
    jira.edit('trent', '2099-01-01T11:00:00.000Z', 'duedate', '2099-02-01');
    const rows = (await view(deps)).tamperedFields;
    expect(rows.map((r: any) => [r.fieldName, r.sealedValue, r.liveValue, r.changedBy, r.changedAt])).toEqual([
      ['Summary', 'Rotate production database credentials', 'Rotate credentials and drop the audit table', ['mallory'], '2099-01-01T10:00:00.000Z'],
      ['Due Date', '(empty)', '2099-02-01', ['trent'], '2099-01-01T11:00:00.000Z']
    ]);
  });

  it('shows the same names and times on every later view, from the recorded incident, even if the change log fails', async () => {
    const { jira, deps } = await sealed();
    jira.edit('mallory', '2099-01-01T10:00:00.000Z', 'summary', 'changed');
    await view(deps);
    jira.failChangelog = true;
    const rows = (await view(deps)).tamperedFields;
    expect(rows[0]).toMatchObject({ changedBy: ['mallory'], changedAt: '2099-01-01T10:00:00.000Z' });
  });

  it('flags values over 200 characters for "Show full value"', async () => {
    const { jira, deps } = await sealed();
    jira.edit('mallory', '2099-01-01T10:00:00.000Z', 'summary', 'x'.repeat(250));
    const row = (await view(deps)).tamperedFields[0];
    expect(row).toMatchObject({ sealedLong: false, liveLong: true });
  });

  it('summarises a rich text change by paragraph', async () => {
    const { jira, deps } = await sealed(issue => (issue.fields.description = doc('Scope: database A', 'Rollback: restore snapshot', 'Owner: ops')));
    jira.edit('mallory', '2099-01-01T10:00:00.000Z', 'description', doc('Scope: database A and B', 'Rollback: restore snapshot', 'Owner: ops', 'Extra: skip tests'));
    const row = (await view(deps)).tamperedFields[0];
    expect(row.fieldName).toBe('Description');
    expect(row.detail).toBe('Paragraph 1 changed. Paragraph 4 added.');
  });

  it('lists each changed comment with its author, instead of a count', async () => {
    const original = [{ id: '7', author: { accountId: 'ann' }, body: doc('Approved by CAB'), created: '2026-10-01T00:00:00.000Z' }];
    const { jira, deps } = await sealed(issue => (issue.fields.comment = { comments: original, total: 1 }));
    jira.comments = [
      {
        id: '7',
        author: { accountId: 'ann' },
        updateAuthor: { accountId: 'mallory' },
        body: doc('Approved by CAB, scope B too'),
        created: '2026-10-01T00:00:00.000Z',
        updated: '2099-01-01T09:00:00.000Z'
      },
      { id: '8', author: { accountId: 'trent' }, body: doc('new note'), created: '2099-01-01T10:00:00.000Z' }
    ];
    const rows = (await view(deps)).tamperedFields;
    expect(rows.map((r: any) => [r.fieldId, r.fieldName, r.sealedValue, r.liveValue, r.changedBy, r.changedAt])).toEqual([
      ['comment:7', 'Comment edited', 'Approved by CAB', 'Approved by CAB, scope B too', ['mallory'], '2099-01-01T09:00:00.000Z'],
      ['comment:8', 'Comment added', '(empty)', 'new note', ['trent'], '2099-01-01T10:00:00.000Z']
    ]);
  });

  it('lists a removed comment, without its sealed text (H-2: it may be restricted, not deleted)', async () => {
    const original = [{ id: '7', author: { accountId: 'ann' }, body: doc('Approved by CAB'), created: '2026-10-01T00:00:00.000Z' }];
    const { jira, deps } = await sealed(issue => (issue.fields.comment = { comments: original, total: 1 }));
    jira.comments = [];
    const rows = (await view(deps)).tamperedFields;
    expect(rows.map((r: any) => [r.fieldId, r.fieldName, r.sealedValue, r.liveValue])).toEqual([['comment:7', 'Comment removed', RESTRICTED_COMMENT_TEXT, '(empty)']]);
  });

  it('adversarial (T-03 C05, NF-01): names an issue type change and a move to another project', () => {
    const base = { id: '1', key: 'CHG-1', fields: { project: { key: 'CHG' }, issuetype: { name: 'Change' }, summary: 's' } };
    const cert = generateSealCertificate(canonicalizeIssueState(base, 't'), {
      signerAccountId: 'a',
      signerDisplayName: 'A',
      signedAt: 't',
      meaning: 'm',
      reasonCode: 'APPROVAL',
      declarationText: 'd'
    });
    const retyped = analyzeTamperState(cert, canonicalizeIssueState({ ...base, fields: { ...base.fields, issuetype: { name: 'Bug' } } }, 't'), 't');
    expect(retyped.tamperedFields).toEqual([{ fieldId: 'issuetype', fieldName: 'Issue type', sealedValue: 'Change', liveValue: 'Bug' }]);
    const moved = analyzeTamperState(
      cert,
      canonicalizeIssueState({ id: '1', key: 'OPS-9', fields: { ...base.fields, project: { key: 'OPS' } } }, 't'),
      't'
    );
    expect(moved.tamperedFields.map(f => [f.fieldName, f.sealedValue, f.liveValue])).toEqual([
      ['Issue key', 'CHG-1', 'OPS-9'],
      ['Project', 'CHG', 'OPS']
    ]);
  });

  it('names the issue type in the validator message', async () => {
    const { jira, deps } = await sealed();
    jira.issue.fields.issuetype = { id: '1', name: 'Bug' };
    const gate = await validateTransition({ issue: { key: 'CHG-1' } }, {}, deps);
    expect(gate.errorMessage).toContain('1 field changed after approval (Issue type)');
  });
});
