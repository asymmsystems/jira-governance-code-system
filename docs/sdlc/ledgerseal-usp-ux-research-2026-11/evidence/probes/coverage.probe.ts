// LedgerSeal research probe C: which changes break the seal (field coverage and canonical form).
// Copyright (c) 2026 Asymm Systems. @author Fahim Farook
import * as fs from 'fs';
import { APP_SRC } from './harness';
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { canonicalizeIssueState } = require(APP_SRC + '/domain/canonicalizer');
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { computeSnapshotHash, generateSealCertificate } = require(APP_SRC + '/domain/crypto');
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { analyzeTamperState } = require(APP_SRC + '/domain/tamper-detector');

const T = '2026-11-01T00:00:00Z';
const base = (): any => ({
  id: '10001', key: 'P-1',
  fields: {
    project: { key: 'P' }, issuetype: { name: 'Task' }, status: { name: 'Approved' },
    summary: 'Release v1', reporter: { accountId: 'r1' }, resolution: null,
    labels: ['b', 'a'], components: [{ name: 'X', id: '1' }], fixVersions: [{ name: '1.0', id: '7' }],
    priority: { id: '2', name: 'High' }, assignee: { accountId: 'a1', displayName: 'Alice' },
    security: { id: '100', name: 'Internal' },
    customfield_10001: 'Approved budget 1000', customfield_10050: 42,
    customfield_20000: ['step1', 'step2', 'step3'], customfield_20001: 'see pullrequest 12 notes',
    customfield_20002: '2026-10-31T10:00:00.000+0000', customfield_20003: [{ state: 'ok', value: 'Gold' }],
    customfield_20004: { value: 'Class II' },
    timetracking: { originalEstimate: '8h', originalEstimateSeconds: 28800 },
    attachment: [{ id: '5', filename: 'evidence.pdf', size: 100, created: '2026-10-30T00:00:00.000+0000', author: { accountId: 'u' } }],
    comment: { comments: [{ id: '9', author: { accountId: 'x' }, body: { type: 'doc', version: 1, content: [{ type: 'paragraph', content: [{ type: 'text', text: 'ok' }] }] }, created: T }], total: 1 }
  }
});
const snap = (i: any) => canonicalizeIssueState(i, T);
const cert = generateSealCertificate(snap(base()), { signerAccountId: 'a', signerDisplayName: 'A', signedAt: T, meaning: 'm', reasonCode: 'APPROVAL', declarationText: 'd' });
const H0 = cert.snapshotHash;
const rows: any[] = [];
function probe(id: string, name: string, expectBreak: boolean, mut: (i: any) => void) {
  const i = base(); mut(i);
  const a = analyzeTamperState(cert, snap(i), T);
  const broke = computeSnapshotHash(snap(i)) !== H0;
  rows.push({ id, change: name, shouldBreak: expectBreak, broke, status: a.status, correct: broke === expectBreak, named: a.tamperedFields.map((f: any) => f.fieldName).join('; ') });
}

it('C: coverage matrix', () => {
  probe('C01', 'summary changed', true, i => i.fields.summary = 'Release v2');
  probe('C02', 'status changed', true, i => i.fields.status = { name: 'Rejected' });
  probe('C03', 'reporter changed', true, i => i.fields.reporter = { accountId: 'evil' });
  probe('C04', 'resolution set', true, i => i.fields.resolution = { name: "Won't Do" });
  probe('C05', 'issue type changed', true, i => i.fields.issuetype = { name: 'Bug' });
  probe('C06', 'worklog added', true, i => i.fields.worklog = { worklogs: [{ id: '1', timeSpent: '8h' }] });
  probe('C07', 'timeoriginalestimate changed (flat field)', true, i => i.fields.timeoriginalestimate = 999999);
  probe('C08', 'timetracking estimate changed (composite field)', true, i => i.fields.timetracking = { originalEstimate: '60h', originalEstimateSeconds: 216000 });
  probe('C09', 'customfield_10001 changed (hard-coded id)', true, i => i.fields.customfield_10001 = 'Approved budget 9999999');
  probe('C10', 'customfield_10050 changed (hard-coded id)', true, i => i.fields.customfield_10050 = 0);
  probe('C11', 'text containing "pullrequest" changed', true, i => i.fields.customfield_20001 = 'see pullrequest 99 notes, scope tripled');
  probe('C12', 'array of objects with .state changed', true, i => i.fields.customfield_20003 = [{ state: 'ok', value: 'Bronze' }]);
  probe('C13', 'select field changed (Class II to Class III)', true, i => i.fields.customfield_20004 = { value: 'Class III' });
  probe('C14', 'ordered list reordered', true, i => i.fields.customfield_20000 = ['step3', 'step1', 'step2']);
  probe('C15', 'summary trailing spaces added', true, i => i.fields.summary = 'Release v1   ');
  probe('C16', 'field set to [] from absent', false, i => i.fields.customfield_30000 = []);
  probe('C17', 'labels reordered (set)', false, i => i.fields.labels = ['a', 'b']);
  probe('C18', 'same instant, other time zone', false, i => i.fields.customfield_20002 = '2026-10-31T15:30:00.000+0530');
  probe('C19', 'assignee display name renamed only', false, i => i.fields.assignee = { accountId: 'a1', displayName: 'Alice Smith' });
  probe('C20', 'assignee changed', true, i => i.fields.assignee = { accountId: 'b2', displayName: 'Bob' });
  probe('C21', 'security level changed', true, i => i.fields.security = { id: '101', name: 'Public' });
  probe('C22', 'component renamed, same id', false, i => i.fields.components = [{ name: 'Y', id: '1' }]);
  probe('C23', 'fix version swapped, same name', true, i => i.fields.fixVersions = [{ name: '1.0', id: '8' }]);
  probe('C24', 'comment edited', true, i => i.fields.comment.comments[0].body.content[0].content[0].text = 'changed');
  probe('C25', 'comment added', true, i => i.fields.comment.comments.push({ id: '10', author: { accountId: 'x' }, body: 'sneaky', created: T }));
  probe('C26', 'attachment removed', true, i => i.fields.attachment = []);
  probe('C27', 'priority changed', true, i => i.fields.priority = { id: '1', name: 'Highest' });
  probe('C28', 'label duplicated', false, i => i.fields.labels = ['a', 'b', 'b']);
  const sealed = cert.snapshot.fields.map((f: any) => f.id);
  const excluded = Object.keys(base().fields).filter(k => !sealed.includes(k));
  const correct = rows.filter(r => r.correct).length;
  fs.writeFileSync(__dirname + `/results-${process.env.LS_LABEL || 'baseline'}-coverage.json`,
    JSON.stringify({ correct, total: rows.length, sealedFieldIds: sealed, excludedFieldIds: excluded, rows }, null, 2));
  expect(rows.length).toBe(28);
});
