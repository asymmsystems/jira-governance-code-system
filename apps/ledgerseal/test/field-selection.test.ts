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
import { FakeJira, MemoryStore, panelContext, sampleIssue, validSignature } from './support/fakes';

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

  it('adversarial (audit probe.js, T-03): reporter, resolution, work log and the old blind-spot fields now break the seal', () => {
    expect(changed(i => (i.fields.reporter = { accountId: 'evil', displayName: 'Eve' }))).toBe(true);
    expect(changed(i => (i.fields.resolution = { id: '10001', name: "Won't Do" }))).toBe(true);
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
    expect(changed(i => (i.fields.updated = '2026-11-02T10:00:00.000+0000'))).toBe(false);
  });

  it('lists covered fields by Jira name and excluded fields with a reason', () => {
    const snap = canonicalizeIssueState(issue(), T, FIELD_LIST);
    const names = snap.fields.map(f => f.name);
    expect(names).toEqual(expect.arrayContaining(['Approved budget', 'Risk score', 'Reporter', 'Release notes', 'Tier', 'Summary', 'Log Work']));
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
    const record = await storage.get('ls2:seal:10001');
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
    expect(value('reporter')).toEqual({ accountId: 'unknown', displayName: 'unknown' });
    expect(value('customfield_1')).toEqual([
      { accountId: 'a', displayName: 'A' },
      { accountId: 'b', displayName: 'unknown' }
    ]);
    expect(value('priority')).toEqual({ id: '2', name: 'unknown' });
    expect(value('components')).toEqual(['raw-string']);
    expect(value('fixVersions')).toEqual(['9']);
    expect(value('labels')).toBeUndefined();
    expect(value('issuelinks')).toEqual([{ type: 'relates', outwardIssueKey: 'X-2', inwardIssueKey: null }]);
    expect(value('subtasks')).toEqual([{ key: '55' }, { key: 'unknown' }]);
    expect(value('worklog')).toEqual([{ id: '', authorAccountId: '', started: '', timeSpentSeconds: 0, comment: null }]);
    expect(snap.attachments).toEqual([{ id: '', filename: '', size: 0, created: '', authorAccountId: '' }]);
    expect(snap.comments).toEqual([{ id: '', authorAccountId: '', body: '"hi"', created: '' }]);
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
