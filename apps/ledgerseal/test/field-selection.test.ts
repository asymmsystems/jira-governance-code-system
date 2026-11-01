/**
 * Copyright (c) 2026 Asymm Systems. All rights reserved.
 *
 * B-05: the sealed field set is chosen by schema type from /rest/api/3/field, never by id or value.
 *
 * @author Fahim Farook
 */

import * as fs from 'fs';
import * as path from 'path';
import { canonicalizeIssueState } from '../src/domain/canonicalizer';
import { computeSnapshotHash } from '../src/domain/crypto';
import { sealIssue, validateTransition, verifyIssue } from '../src/index';
import { FakeJira, MemoryStore, panelContext, sampleIssue, validSignature, model } from './support/fakes';

jest.mock('@forge/api', () => ({ __esModule: true, default: {}, route: () => '' }));
jest.mock('@forge/kvs', () => ({ kvs: {} }));

/** A field list in the shape of GET /rest/api/3/field, with the ids a JSM site uses. */
export const FIELD_LIST = [
  { id: 'summary', name: 'Summary', schema: { type: 'string', system: 'summary' } },
  { id: 'status', name: 'Status', schema: { type: 'status', system: 'status' } },
  { id: 'reporter', name: 'Reporter', schema: { type: 'user', system: 'reporter' } },
  { id: 'resolution', name: 'Resolution', schema: { type: 'resolution', system: 'resolution' } },
  { id: 'worklog', name: 'Log Work', schema: { type: 'array', items: 'worklog', system: 'worklog' } },
  { id: 'updated', name: 'Updated', schema: { type: 'datetime', system: 'updated' } },
  { id: 'customfield_10001', name: 'Approved budget', schema: { type: 'string', custom: 'com.atlassian.jira.plugin.system.customfieldtypes:textfield', customId: 10001 } },
  { id: 'customfield_10050', name: 'Risk score', schema: { type: 'number', custom: 'com.atlassian.jira.plugin.system.customfieldtypes:float', customId: 10050 } },
  { id: 'customfield_10019', name: 'Rank', schema: { type: 'any', custom: 'com.pyxis.greenhopper.jira:gh-lexo-rank', customId: 10019 } },
  { id: 'customfield_10020', name: 'Sprint', schema: { type: 'array', items: 'json', custom: 'com.pyxis.greenhopper.jira:gh-sprint', customId: 10020 } },
  { id: 'customfield_10030', name: 'Time to resolution', schema: { type: 'sd-servicelevelagreement', custom: 'com.atlassian.servicedesk:sd-sla-field', customId: 10030 } },
  { id: 'customfield_10031', name: 'Request participants', schema: { type: 'array', items: 'user', custom: 'com.atlassian.servicedesk:sd-request-participants', customId: 10031 } },
  { id: 'customfield_10032', name: 'Approvals', schema: { type: 'sd-approvals', custom: 'com.atlassian.servicedesk.approvals-plugin:sd-approvals', customId: 10032 } },
  { id: 'customfield_10033', name: 'Satisfaction', schema: { type: 'sd-feedback', custom: 'com.atlassian.servicedesk:sd-request-feedback', customId: 10033 } },
  { id: 'customfield_10000', name: 'Development', schema: { type: 'any', custom: 'com.atlassian.jira.plugins.jira-development-integration-plugin:devsummarycf', customId: 10000 } },
  { id: 'customfield_20001', name: 'Release notes', schema: { type: 'string', custom: 'com.atlassian.jira.plugin.system.customfieldtypes:textarea', customId: 20001 } },
  { id: 'customfield_20003', name: 'Tier', schema: { type: 'array', items: 'option', custom: 'com.atlassian.jira.plugin.system.customfieldtypes:multiselect', customId: 20003 } }
];

function issue(): any {
  const i = sampleIssue();
  Object.assign(i.fields, {
    reporter: { accountId: 'r1', displayName: 'Rita' },
    resolution: null,
    updated: '2026-11-01T10:00:00.000+0000',
    customfield_10001: 'Approved budget 1000',
    customfield_10050: 42,
    customfield_10019: '0|i0001:',
    customfield_10020: [{ id: 1, state: 'active', name: 'Sprint 1' }],
    customfield_10030: { ongoingCycle: { elapsedTime: { millis: 1 } } },
    customfield_10031: [{ accountId: 'p1' }],
    customfield_10033: { rating: 5 },
    customfield_20001: 'see pullrequest 12 notes',
    customfield_20003: [{ id: '7', value: 'Gold', state: 'ok' }],
    worklog: { startAt: 0, maxResults: 20, total: 0, worklogs: [] }
  });
  return i;
}

const T = '2026-11-01T00:00:00Z';
const hash = (i: any) => computeSnapshotHash(canonicalizeIssueState(i, T, FIELD_LIST));
const BASE = hash(issue());

function changed(mutate: (i: any) => void): boolean {
  const i = issue();
  mutate(i);
  return hash(i) !== BASE;
}

describe('B-05 schema-based field selection', () => {
  it('has no hard-coded custom field id and no value heuristic in the canonicalizer', () => {
    const src = fs.readFileSync(path.resolve(__dirname, '../src/domain/canonicalizer.ts'), 'utf8');
    expect(src).not.toMatch(/customfield_\d+/);
    for (const heuristic of ['pullrequest', "'0|'", 'branch={', "'approvers'", 'ongoingCycle', 'val[0]?.state', "includes('sla')"]) {
      expect(src).not.toContain(heuristic);
    }
  });

  it('adversarial (audit probe.js, T-03): reporter, work log and the old blind-spot fields now break the seal', () => {
    expect(changed(i => (i.fields.reporter = { accountId: 'evil', displayName: 'Eve' }))).toBe(true);
    expect(changed(i => (i.fields.worklog.worklogs = [{ id: '1', author: { accountId: 'a' }, started: T, timeSpentSeconds: 28800 }]))).toBe(true);
    expect(changed(i => (i.fields.customfield_10001 = 'Approved budget 9999999'))).toBe(true);
    expect(changed(i => (i.fields.customfield_10050 = 0))).toBe(true);
    expect(changed(i => (i.fields.customfield_20001 = 'see pullrequest 99 notes, scope tripled'))).toBe(true);
    expect(changed(i => (i.fields.customfield_20003 = [{ id: '8', value: 'Bronze', state: 'ok' }]))).toBe(true);
  });

  it('does not break the seal for fields excluded by schema type', () => {
    expect(changed(i => (i.fields.customfield_10019 = '0|i0009:'))).toBe(false);
    expect(changed(i => (i.fields.customfield_10020 = [{ id: 2, state: 'active', name: 'Sprint 2' }]))).toBe(false);
    expect(changed(i => (i.fields.customfield_10030 = { ongoingCycle: { elapsedTime: { millis: 99 } } }))).toBe(false);
    expect(changed(i => (i.fields.customfield_10031 = [{ accountId: 'p2' }]))).toBe(false);
    expect(changed(i => (i.fields.customfield_10033 = { rating: 1 }))).toBe(false);
    expect(changed(i => (i.fields.status = { name: 'Done' }))).toBe(false);
    // NF-05: Resolution follows the status rule (D-2), so a manual resolution change is left to Jira's change log
    expect(changed(i => (i.fields.resolution = { id: '10001', name: "Won't Do" }))).toBe(false);
    expect(changed(i => (i.fields.updated = '2026-11-02T10:00:00.000+0000'))).toBe(false);
  });

  it('NF-05 (live, LSP-1): a gated transition that sets a resolution does not break the seal', () => {
    const fields = [
      { id: 'summary', name: 'Summary', schema: { type: 'string', system: 'summary' } },
      { id: 'resolution', name: 'Resolution', schema: { type: 'resolution', system: 'resolution' } },
      { id: 'resolutiondate', name: 'Resolved', schema: { type: 'datetime', system: 'resolutiondate' } }
    ];
    const open = { id: '10069', key: 'LSP-1', fields: { summary: 'Probe' } };
    const done = { id: '10069', key: 'LSP-1', fields: { summary: 'Probe', resolution: { id: '10000', name: 'Done' }, resolutiondate: '2026-11-01T10:49:50.655+0530' } };

    const before = canonicalizeIssueState(open, 't', fields);
    const after = canonicalizeIssueState(done, 't', fields);

    expect(computeSnapshotHash(after)).toBe(computeSnapshotHash(before));
    const reasons = Object.fromEntries((after.excluded || []).map(e => [e.id, e.reason]));
    expect(reasons.resolution).toBe('The gated transition sets the resolution. The status at seal is recorded.');
    expect(reasons.resolutiondate).toBe('The gated transition sets the resolution. The status at seal is recorded.');
  });

  it('NF-04 (live, DEMO /rest/api/3/field): computed JSM sentiment, forms counts and agent sessions do not break the seal', () => {
    const computed = [
      ['customfield_10024', 'Sentiment', 'com.atlassian.servicedesk.sentiment:sd-sentiment', 'array'],
      ['customfield_10031', 'Total forms', 'com.atlassian.jira.plugins.proforma-managed-fields:forms-total-field-cftype', 'number'],
      ['customfield_10032', 'Submitted forms', 'com.atlassian.jira.plugins.proforma-managed-fields:forms-submitted-field-cftype', 'number'],
      ['customfield_10034', 'Locked forms', 'com.atlassian.jira.plugins.proforma-managed-fields:forms-locked-field-cftype', 'number'],
      ['customfield_10035', 'Open forms', 'com.atlassian.jira.plugins.proforma-managed-fields:forms-open-field-cftype', 'number'],
      ['customfield_10040', 'Agent Sessions', 'com.atlassian.jira.plugin.system.customfieldtypes:agent-sessions', 'array']
    ];
    const forms = ['customfield_10030', 'Work item created forms', 'com.atlassian.jira.plugins.proforma-managed-fields:proforma-forms-field-cftype', 'array'];
    const fields = [...computed, forms].map(([id, name, custom, type]) => ({ id, name, schema: { type, custom } }));
    const raw = (n: number) => ({
      id: '10001',
      key: 'SD-1',
      fields: {
        summary: 'Request',
        customfield_10024: [{ name: n ? 'Negative' : 'Neutral' }],
        customfield_10031: n,
        customfield_10032: n,
        customfield_10034: n,
        customfield_10035: n,
        customfield_10040: [{ id: String(n) }],
        customfield_10030: [{ id: 'form-1' }]
      }
    });

    const before = canonicalizeIssueState(raw(0), 't', fields);
    const after = canonicalizeIssueState(raw(3), 't', fields);

    expect(computeSnapshotHash(after)).toBe(computeSnapshotHash(before));
    expect((before.excluded || []).map(e => e.name).sort()).toEqual(computed.map(c => c[1]).sort());
    for (const e of before.excluded || []) expect(e.reason).toBe('Computed by Jira.');
    expect(before.fields.map(f => f.id)).toContain('customfield_10030');
  });

  it('lists covered fields by Jira name and excluded fields with a reason', () => {
    const snap = canonicalizeIssueState(issue(), T, FIELD_LIST);
    const names = snap.fields.map(f => f.name);
    expect(names).toEqual(expect.arrayContaining(['Approved budget', 'Risk score', 'Reporter', 'Release notes', 'Tier', 'Summary']));
    expect(names).not.toContain('Log Work'); // an empty work log has no content
    const excluded = Object.fromEntries((snap.excluded || []).map(e => [e.name, e.reason]));
    expect(excluded['Rank']).toBe('Rank changes on every board drag.');
    expect(excluded['Sprint']).toBe('Sprint changes when a sprint closes.');
    expect(excluded['Time to resolution']).toBe('SLA timers change by themselves.');
    expect(excluded['Status']).toBe('The gated transition changes the status. The status at seal is recorded.');
    expect(excluded['Updated']).toBe('Jira sets this time itself.');
  });

  it('keeps an unknown custom type covered, and names a field missing from the list by its id', () => {
    const snap = canonicalizeIssueState({ id: '1', key: 'X-1', fields: { customfield_99999: 'v', customfield_10001: 'w' } }, T, [
      { id: 'customfield_10001', name: 'Budget', schema: { type: 'string', custom: 'vendor.app:something-new' } }
    ]);
    expect(snap.fields.map(f => [f.id, f.name])).toEqual([
      ['customfield_10001', 'Budget'],
      ['customfield_99999', 'customfield_99999']
    ]);
  });

  it('stores the covered and excluded lists in the seal record and returns them to the panel', async () => {
    const jira = new FakeJira(issue());
    jira.fields = FIELD_LIST;
    jira.approvers = new Set(['ann']);
    const storage = new MemoryStore();
    jira.currentUser = 'ann';
    await sealIssue({ signature: validSignature() }, panelContext('ann'), { jira, storage });
    const sealed = await model.sealedSnapshot(storage);
    const record = { coveredFields: sealed.fields.map((f: any) => ({ id: f.id, name: f.name })), excludedFields: sealed.excluded };
    expect(record.coveredFields).toEqual(expect.arrayContaining([{ id: 'customfield_10001', name: 'Approved budget' }]));
    expect(record.excludedFields).toEqual(expect.arrayContaining([{ id: 'customfield_10019', name: 'Rank', reason: 'Rank changes on every board drag.' }]));

    jira.currentUser = 'viewer';
    jira.fieldCalls = 0;
    const view: any = await verifyIssue({}, panelContext('viewer'), { jira, storage });
    expect(jira.fieldCalls).toBe(1);
    expect(view.coveredFields).toEqual(record.coveredFields);
    expect(view.excludedFields).toEqual(record.excludedFields);
  });

  it('fails closed without writing when the field list cannot be read', async () => {
    const jira = new FakeJira(issue());
    jira.approvers = new Set(['ann']);
    jira.currentUser = 'ann';
    jira.failFields = true;
    const storage = new MemoryStore();
    await expect(
      sealIssue({ signature: validSignature() }, panelContext('ann'), { jira, storage })
    ).resolves.toMatchObject({ code: 'JIRA_UNREACHABLE' });
    await expect(validateTransition({ issue: { key: 'CHG-1' } }, {}, { jira, storage })).resolves.toMatchObject({ result: false });
    expect(storage.sets).toEqual([]);
  });
});

describe('B-05 sparse Jira objects', () => {
  it('normalises sparse users, lists, links, work logs, attachments and comments with fixed defaults', () => {
    const snap = canonicalizeIssueState(
      {
        id: '1',
        key: 'X-1',
        fields: {
          reporter: { accountId: '' },
          customfield_1: [{ accountId: 'b' }, { accountId: 'a', displayName: 'A' }],
          priority: { id: '2' },
          components: ['raw-string', { name: '' }],
          fixVersions: [{ id: '9' }],
          labels: [''],
          issuelinks: [{ outwardIssue: { key: 'X-2' } }],
          subtasks: [{ id: '55' }, {}],
          worklog: { worklogs: [{}] },
          attachment: [{}],
          comment: { comments: [{ body: 'hi' }] },
          aliasOfUpdated: '2026-01-01T00:00:00Z'
        }
      },
      T,
      [{ id: 'aliasOfUpdated', name: 'Last change', schema: { system: 'updated' } }]
    );
    const value = (id: string) => snap.fields.find(f => f.id === id)?.value;
    expect(value('reporter')).toBeUndefined(); // no account id and no id: no content
    expect(value('customfield_1')).toEqual([{ accountId: 'b' }, { accountId: 'a' }]);
    expect(value('priority')).toEqual({ id: '2' });
    expect(value('components')).toEqual(['raw-string']);
    expect(value('fixVersions')).toEqual([{ id: '9' }]);
    expect(value('labels')).toBeUndefined();
    expect(value('issuelinks')).toEqual([{ type: '', direction: 'outward', issue: 'X-2' }]);
    expect(value('subtasks')).toEqual([{ id: '55' }]);
    expect(value('worklog')).toEqual([{ id: '', authorAccountId: '', started: '', timeSpentSeconds: 0, comment: null }]);
    expect(snap.attachments).toEqual([{ id: '', filename: '', size: 0, mimeType: '', created: '', authorAccountId: '' }]);
    expect(snap.comments).toEqual([{ id: '', authorAccountId: '', body: 'hi', created: '' }]);
    expect(snap.excluded).toEqual([{ id: 'aliasOfUpdated', name: 'Last change', reason: 'Jira sets this time itself.' }]);
  });

  it('drops empty lists that normalise to nothing', () => {
    const snap = canonicalizeIssueState(
      { id: '1', key: 'X-1', fields: { components: [{ name: '' }], fixVersions: [''], issuelinks: [], subtasks: [], worklog: { worklogs: [] } } },
      T
    );
    expect(snap.fields).toEqual([]);
  });
});
