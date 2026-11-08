/**
 * Copyright (c) 2026 Asymm Systems. All rights reserved.
 *
 * LedgerSeal LS-1 (user-guide audit): an attachment added, removed or replaced after the seal is a change row of the
 * panel, with who did it where Jira says so. The validator message and the evidence export do not change.
 *
 * @author Fahim Farook
 */
import { getSealEvidence, sealIssue, validateTransition, verifyIssue } from '../src/index';
import { attributeAttachments } from '../src/service/ledger';
import { buildPanelView } from '../src/frontend/view-model';
import { changedItemsMessage } from '../src/validator/workflow-validator';
import { FakeJira, MemoryStore, model, panelContext, sampleIssue, validSignature } from './support/fakes';

jest.mock('@forge/api', () => ({ __esModule: true, default: {}, route: () => '', privacy: { reportPersonalData: jest.fn() } }));
jest.mock('@forge/kvs', () => ({ kvs: {}, WhereConditions: {} }));
beforeEach(() => {
  for (const level of ['error', 'warn', 'log', 'info'] as const) jest.spyOn(console, level).mockImplementation(() => undefined);
});
afterEach(() => jest.restoreAllMocks());

const LATER = '2099-01-01T00:00:00.000Z';

async function sealedWithAttachment() {
  const issue = sampleIssue();
  issue.fields.attachment = [{ id: '3', filename: 'old.txt', size: 4, mimeType: 'text/plain', created: '2026-09-30T00:00:00.000Z', author: { accountId: 'ann' } }];
  const jira = new FakeJira(issue);
  jira.approvers = new Set(['ann', 'carl']);
  const storage = new MemoryStore();
  const deps = { jira, storage };
  jira.currentUser = 'ann';
  expect(((await sealIssue({ signature: validSignature() }, panelContext('ann'), deps)) as any).ok).toBe(true);
  return { jira, storage, deps };
}

describe('LS-1 attachment change rows', () => {
  it('names who added or removed an attachment, and the panel counts the rows', async () => {
    const { jira, storage, deps } = await sealedWithAttachment();
    // bob adds plan.pdf; mallory removes old.txt (the change log names her)
    jira.issue.fields.attachment = [{ id: '10', filename: 'plan.pdf', size: 9, created: LATER, author: { accountId: 'bob' } }];
    jira.changelog.push({ id: '99', author: { accountId: 'mallory' }, created: LATER, items: [{ field: 'Attachment', fieldId: 'attachment', fromString: 'old.txt', toString: null, from: '3', to: null } as any] });
    jira.currentUser = 'carl';
    const result: any = await verifyIssue({}, panelContext('carl'), deps);
    expect(result.tamperedFields).toEqual([]);
    expect(result.tamperedAttachments).toEqual([
      { type: 'REMOVED', attachmentId: '3', filename: 'old.txt', changedBy: ['mallory'], changedAt: LATER },
      { type: 'ADDED', attachmentId: '10', filename: 'plan.pdf', changedBy: ['bob'], changedAt: LATER }
    ]);
    const view = buildPanelView({ loading: false, result, locale: 'en-GB', timeZone: 'UTC' });
    expect(view.statusSentence).toBe('Approval seal: Changed after approval. 2 items modified.');
    expect(view.changes.map(c => [c.fieldName, c.detail, c.changedBy])).toEqual([
      ['Attachment: old.txt', 'Removed after the seal', ['mallory']],
      ['Attachment: plan.pdf', 'Added after the seal', ['bob']]
    ]);

    // The validator message names "Attachments", as before
    const gate: any = await validateTransition({ issue: { id: '10001', key: 'CHG-1' }, transition: { to: { id: '3' } }, user: { accountId: 'carl' } }, undefined, deps);
    expect(gate).toEqual({ result: false, errorMessage: changedItemsMessage(['Attachments']) });

    // The record and the export are unchanged: the incident counts attachment changes and names nobody for them
    const incident = model.statusRows(storage).find((r: any) => r.statusId === 'LS_CHANGED');
    expect(incident.data.attachmentChanges).toBe(2);
    expect(incident.data.changes).toEqual([]);
    const ev: any = await getSealEvidence({}, panelContext('carl'), deps);
    expect(JSON.stringify(ev.history)).not.toContain('mallory');
    expect(JSON.stringify(ev.history)).not.toContain('bob');
  });

  it('leaves who empty when Jira does not say, and names a replacement from the change log', () => {
    const diffs = [
      { type: 'MODIFIED' as const, attachmentId: '7', filename: 'spec.docx' },
      { type: 'REMOVED' as const, attachmentId: '8', filename: 'gone.txt' }
    ];
    const changelog = [
      { id: '1', author: { accountId: 'early' }, created: '2000-01-01T00:00:00.000Z', items: [{ field: 'Attachment', fieldId: 'attachment', from: '8' } as any] },
      { id: '2', author: { accountId: 'dave' }, created: LATER, items: [{ field: 'Attachment', to: '7' } as any] }
    ];
    expect(attributeAttachments(diffs, changelog, '2026-01-01T00:00:00.000Z', { fields: {} })).toEqual([
      { type: 'MODIFIED', attachmentId: '7', filename: 'spec.docx', changedBy: ['dave'], changedAt: LATER },
      { type: 'REMOVED', attachmentId: '8', filename: 'gone.txt', changedBy: [], changedAt: null }
    ]);
    expect(attributeAttachments([{ type: 'ADDED', attachmentId: '9', filename: 'x' }], [], '2026-01-01T00:00:00.000Z', null)).toEqual([
      { type: 'ADDED', attachmentId: '9', filename: 'x', changedBy: [], changedAt: null }
    ]);
  });
});
