/**
 * Copyright (c) 2026 Asymm Systems. All rights reserved.
 * @author Fahim Farook
 * FourRealities: the evidence report engine (ADR-015, spec v4 section 11): field classes, the changes in
 * scope and the filters, free-text omission (owner decision Q4), party tokens in place of account ids,
 * the JSON and CSV files with the cell rule, the manifest body and the people file.
 */

import { DefaultReportEngine, canonicalJson, csvCell, CSV_COLUMNS } from '../../src/engine/default-report-engine';
import { ChangelogEntry, FieldInfo, ManifestHeader, ReportIssue } from '../../src/contract/data/reports';
import { DEFAULT_SOURCE_SETTINGS, ERASED_ACCOUNT, GateExceptionEvent, ReworkNote } from '../../src/contract/data/models';
import { makeFacts, gates, FOUND_V, MISSING, NA } from '../domain/fixtures';

const engine = new DefaultReportEngine();
const RANGE = { from: '2026-10-01T00:00:00.000Z', to: '2026-11-01T00:00:00.000Z' };
const FIELDS: FieldInfo[] = [
  { id: 'status', name: 'Status', schemaType: 'status' },
  { id: 'assignee', name: 'Assignee', schemaType: 'user' },
  { id: 'customfield_1', name: 'Reviewers', schemaType: 'array', schemaItems: 'user' },
  { id: 'customfield_2', name: 'Notes', schemaType: 'string', custom: 'com.atlassian.jira.plugin.system.customfieldtypes:textarea' },
  { id: 'customfield_3', name: 'Ticket', schemaType: 'string', custom: 'com.atlassian.jira.plugin.system.customfieldtypes:textfield' },
  { id: 'labels', name: 'Labels', schemaType: 'array', schemaItems: 'string' }
];
const TOKENS = { 'acc-ana': 'pty_' + 'a'.repeat(32), 'acc-bo': 'pty_' + 'b'.repeat(32) };
const item = (fieldId: string, from: string | null, to: string | null, fromString: string | null = from, toString: string | null = to) => ({ fieldId, field: fieldId, from, to, fromString, toString });
const entry = (id: string, at: string, author: string | null, items: ChangelogEntry['items']): ChangelogEntry => ({ changelogId: id, at, authorAccountId: author, items });

describe('field classes', () => {
  it('classes summary, description, environment and text custom fields as FREE_TEXT, user fields as USER, the rest as OTHER', () => {
    for (const id of ['summary', 'description', 'environment', 'customfield_2', 'customfield_3']) expect(engine.classifyField(id, FIELDS)).toBe('FREE_TEXT');
    expect(engine.classifyField('assignee', FIELDS)).toBe('USER');
    expect(engine.classifyField('customfield_1', FIELDS)).toBe('USER');
    expect(engine.classifyField('status', FIELDS)).toBe('OTHER');
    expect(engine.classifyField('labels', FIELDS)).toBe('OTHER');
    expect(engine.classifyField('not-in-list', FIELDS)).toBe('OTHER');
  });

  it('classes every text custom field as FREE_TEXT: app text fields, URL and read-only fields, and deleted custom fields (Q4, review M-2)', () => {
    const more: FieldInfo[] = [
      { id: 'customfield_20', name: 'App notes', schemaType: 'string', custom: 'ari:cloud:ecosystem::extension/app/static/notes' },
      { id: 'customfield_21', name: 'Link', schemaType: 'string', custom: 'com.atlassian.jira.plugin.system.customfieldtypes:url' },
      { id: 'customfield_22', name: 'Read only', schemaType: 'string', custom: 'com.atlassian.jira.plugin.system.customfieldtypes:readonlyfield' },
      { id: 'customfield_23', name: 'No schema' },
      { id: 'customfield_24', name: 'Points', schemaType: 'number', custom: 'com.atlassian.jira.plugin.system.customfieldtypes:float' },
      { id: 'customfield_25', name: 'Approvers', schemaType: 'array', schemaItems: 'user', custom: 'x:multiuserpicker' }
    ];
    for (const id of ['customfield_20', 'customfield_21', 'customfield_22', 'customfield_23', 'customfield_99999']) expect(engine.classifyField(id, more)).toBe('FREE_TEXT');
    expect(engine.classifyField('customfield_24', more)).toBe('OTHER');
    expect(engine.classifyField('customfield_25', more)).toBe('USER');
    expect(engine.classifyField('Link', more)).toBe('OTHER');
    const change = engine.reportChanges([entry('1', '2026-10-02T00:00:00.000Z', null, [item('customfield_99999', null, null, 'old secret text', 'new secret text')])], RANGE, { fieldIds: [], actors: [] }, more, {});
    expect(change[0]).toMatchObject({ fieldClass: 'FREE_TEXT', fromString: null, toString: null, omitted: { fromLength: 15, toLength: 15 } });
  });
});

describe('changes in the range', () => {
  const entries = [
    entry('12', '2026-10-05T10:00:00.000Z', 'acc-ana', [item('status', '1', '3', 'To Do', 'Done'), item('description', null, null, 'short', 'a longer text')]),
    entry('11', '2026-10-05T10:00:00.000Z', 'acc-bo', [item('assignee', 'acc-ana', 'acc-bo', 'Ana', 'Bo')]),
    entry('9', '2026-09-30T23:59:59.999Z', 'acc-ana', [item('status', '3', '1')]),
    entry('10', '2026-11-01T00:00:00.000Z', 'acc-ana', [item('status', '3', '1')]),
    entry('13', '2026-10-31T23:59:59.000Z', null, [item('labels', null, 'x'.repeat(600))])
  ];

  it('keeps entries from 00:00 UTC on From to before 00:00 UTC on To, oldest first, then by changelog id', () => {
    const out = engine.reportChanges(entries, RANGE, { fieldIds: [], actors: [] }, FIELDS, TOKENS);
    expect(out.map(c => c.changelogId)).toEqual(['11', '12', '12', '13']);
  });

  it('records free-text changes as changed with the lengths, never the text (Q4)', () => {
    const desc = engine.reportChanges(entries, RANGE, { fieldIds: ['description'], actors: [] }, FIELDS, TOKENS)[0];
    expect(desc).toEqual({ changelogId: '12', at: '2026-10-05T10:00:00.000Z', author: TOKENS['acc-ana'], fieldId: 'description', field: 'description', fieldClass: 'FREE_TEXT', from: null, to: null, fromString: null, toString: null, omitted: { reason: 'FREE_TEXT', fromLength: 5, toLength: 13 } });
    expect(JSON.stringify(desc)).not.toContain('longer');
  });

  it('turns user field values and authors into party tokens and drops display names', () => {
    const change = engine.reportChanges(entries, RANGE, { fieldIds: ['assignee'], actors: [] }, FIELDS, TOKENS)[0];
    expect(change).toMatchObject({ author: TOKENS['acc-bo'], from: TOKENS['acc-ana'], to: TOKENS['acc-bo'], fromString: null, toString: null, fieldClass: 'USER' });
    expect(JSON.stringify(change)).not.toMatch(/acc-|Ana|Bo"/);
  });

  it('cuts OTHER values to 500 characters and marks them', () => {
    const change = engine.reportChanges(entries, RANGE, { fieldIds: ['labels'], actors: [] }, FIELDS, TOKENS)[0];
    expect(change.to).toHaveLength(500);
    expect(change.truncated).toBe(true);
    expect(change.author).toBeNull();
  });

  it('filters by field and by person (tokens)', () => {
    expect(engine.reportChanges(entries, RANGE, { fieldIds: ['status'], actors: [] }, FIELDS, TOKENS).map(c => c.fieldId)).toEqual(['status']);
    expect(engine.reportChanges(entries, RANGE, { fieldIds: [], actors: [TOKENS['acc-bo']] }, FIELDS, TOKENS).map(c => c.changelogId)).toEqual(['11']);
    // An entry without an author never passes a people filter.
    expect(engine.reportChanges(entries, RANGE, { fieldIds: ['labels'], actors: [TOKENS['acc-ana']] }, FIELDS, TOKENS)).toEqual([]);
  });

  it('orders equal times by numeric changelog id and keeps a missing changelog value as the empty length', () => {
    const out = engine.reportChanges([
      entry('100', '2026-10-02T00:00:00.000Z', null, [item('status', '1', '2')]),
      entry('99', '2026-10-02T00:00:00.000Z', null, [item('status', '1', '2')]),
      entry('99', '2026-10-01T00:00:00.000Z', null, [item('summary', null, null, null, null)])
    ], RANGE, { fieldIds: [], actors: [] }, FIELDS, {});
    expect(out.map(c => `${c.at.slice(8, 10)}:${c.changelogId}`)).toEqual(['01:99', '02:99', '02:100']);
    expect(out[0].omitted).toEqual({ reason: 'FREE_TEXT', fromLength: 0, toLength: 0 });
  });

  it('uses the erased mark for an account that has no token', () => {
    const out = engine.reportChanges([entry('1', '2026-10-02T00:00:00.000Z', 'acc-gone', [item('assignee', 'acc-gone', null)])], RANGE, { fieldIds: [], actors: [] }, FIELDS, {});
    expect(out[0]).toMatchObject({ author: ERASED_ACCOUNT, from: ERASED_ACCOUNT, to: null });
  });

  it('is in scope when created in the range or with a change in the range', () => {
    expect(engine.inScope('2026-10-02T00:00:00.000Z', [], RANGE)).toBe(true);
    expect(engine.inScope('2026-09-02T00:00:00.000Z', [], RANGE)).toBe(false);
    expect(engine.inScope('2026-11-01T00:00:00.000Z', [], RANGE)).toBe(false);
    expect(engine.inScope('2026-09-02T00:00:00.000Z', engine.reportChanges(entries, RANGE, { fieldIds: [], actors: [] }, FIELDS, TOKENS), RANGE)).toBe(true);
  });

  it('lists every account id that a token must replace, without the erased marks', () => {
    const events = [{ byAccountId: 'acc-ex', status: 'REQUESTED' } as GateExceptionEvent, { byAccountId: ERASED_ACCOUNT } as GateExceptionEvent];
    const notes = [{ recordedBy: 'acc-note' } as ReworkNote, { recordedBy: 'unknown-user' } as ReworkNote];
    expect(engine.accountIdsOf(entries, FIELDS, events, notes)).toEqual(['acc-ana', 'acc-bo', 'acc-ex', 'acc-note']);
  });
});

function issue(over: Partial<ReportIssue> = {}): ReportIssue {
  return {
    issueId: '10002', issueKey: 'PAY-2', issueTypeName: 'Story', summary: 'S', created: '2026-10-01T00:00:00.000Z', statusCategory: 'done', statusId: '3',
    gates: gates(FOUND_V, MISSING, NA, { state: 'FOUND', verification: 'VERIFIED', reason: 'SEAL_VALID_LS' }), rai: 50, risk: 'HIGH',
    ledgerseal: { certificateId: 'cert-1', snapshotHash: 'h'.repeat(64), status: 'SEAL_VALID', sealedAt: 't', issuedAt: 't', keyId: 'ls-dev-2026-11', verification: 'VERIFIED' },
    definitionguard: { headHash: 'd'.repeat(64), stateVersion: 3, issuedAt: 't', mandatoryCompleted: 4, mandatoryTotal: 4, keyId: 'dg-dev-2026-11', verification: 'VERIFIED' },
    codeException: [{ status: 'REQUESTED', at: 't', by: TOKENS['acc-ana'], asRole: 'REQUESTER', reason: 'r' }, { status: 'APPROVED', at: 't2', by: TOKENS['acc-bo'], asRole: 'APPROVER', reason: 'ok' }],
    reworkNotes: [{ recordedAt: 't', by: TOKENS['acc-bo'], reason: 'changed' }],
    changes: [],
    ...over
  };
}

describe('report rows', () => {
  it('builds the issue with sibling references by id and hash, tokens for people and the summary cut to 120 characters', () => {
    const facts = makeFacts({
      summary: 'x'.repeat(200),
      properties: {
        ledgerseal: { status: 'SEAL_VALID', certificateId: 'c1', snapshotHash: 'sh', sealedAt: 's', issuedAt: 'i', keyId: 'ls-dev-2026-11', sig: 'z' },
        dod: { completedCount: 2, totalCount: 3, checklistHash: 'ch', issuedAt: 'i2', stateVersion: 7 }
      },
      attestations: { ledgerseal: 'VERIFIED', dod: 'UNKNOWN_KEY' }
    });
    const events = [{ status: 'APPROVED', at: 'a', byAccountId: 'acc-ana', asRole: 'APPROVER', reason: 'why', migrated: true } as GateExceptionEvent];
    const notes = [{ recordedAt: 'r', recordedBy: 'acc-gone', reason: 'because', notes: 'n' } as ReworkNote];
    const out = engine.reportIssue({ facts, basics: { issueId: '1', issueKey: 'PAY-1', issueTypeName: 'Bug', created: 'c', statusId: '3' }, gates: gates(FOUND_V, FOUND_V, NA, FOUND_V), rai: 100, risk: 'LOW', events, notes, changes: [], tokenOf: TOKENS });
    expect(out.summary).toHaveLength(120);
    expect(out.ledgerseal).toEqual({ certificateId: 'c1', snapshotHash: 'sh', status: 'SEAL_VALID', sealedAt: 's', issuedAt: 'i', keyId: 'ls-dev-2026-11', verification: 'VERIFIED' });
    expect(out.definitionguard).toEqual({ headHash: 'ch', stateVersion: 7, issuedAt: 'i2', mandatoryCompleted: 2, mandatoryTotal: 3, keyId: null, verification: 'UNKNOWN_KEY' });
    expect(out.codeException).toEqual([{ status: 'APPROVED', at: 'a', by: TOKENS['acc-ana'], asRole: 'APPROVER', reason: 'why', migrated: true }]);
    expect(out.reworkNotes).toEqual([{ recordedAt: 'r', by: ERASED_ACCOUNT, reason: 'because', notes: 'n' }]);
    expect(JSON.stringify(out)).not.toMatch(/acc-/);
  });

  it('gives null references when there is no sibling record, and UNSIGNED when the record was not checked', () => {
    const none = engine.reportIssue({ facts: makeFacts(), basics: { issueId: '1', issueKey: 'K-1', issueTypeName: 'T', created: 'c', statusId: '1' }, gates: gates(MISSING, MISSING, NA, MISSING), rai: 0, risk: 'CRITICAL', events: [], notes: [], changes: [], tokenOf: {} });
    expect(none.ledgerseal).toBeNull();
    expect(none.definitionguard).toBeNull();
    const unchecked = engine.reportIssue({ facts: makeFacts({ properties: { ledgerseal: { status: 7 }, dod: { headHash: 'h', mandatoryCompleted: 1, mandatoryTotal: 1 } } }), basics: { issueId: '1', issueKey: 'K-1', issueTypeName: 'T', created: 'c', statusId: '1' }, gates: gates(MISSING, MISSING, NA, MISSING), rai: 0, risk: 'CRITICAL', events: [], notes: [], changes: [], tokenOf: {} });
    expect(unchecked.ledgerseal).toMatchObject({ status: null, verification: 'UNSIGNED' });
    expect(unchecked.definitionguard).toMatchObject({ headHash: 'h', verification: 'UNSIGNED' });
  });

  it('collects the tokens of the report for the people file', () => {
    const withChange = issue({ changes: [{ changelogId: '1', at: 't', author: 'pty_' + 'c'.repeat(32), fieldId: 'assignee', field: 'Assignee', fieldClass: 'USER', from: 'pty_' + 'd'.repeat(32), to: null, fromString: null, toString: null }, { changelogId: '2', at: 't', author: null, fieldId: 'status', field: 'Status', fieldClass: 'OTHER', from: 'pty_' + 'e'.repeat(32), to: '3', fromString: 'x', toString: 'y' }] });
    expect(engine.tokensOf([withChange], { fieldIds: [], actors: ['pty_' + 'f'.repeat(32)] }, 'scheduled')).toEqual(['a', 'b', 'c', 'd', 'f'].map(c => 'pty_' + c.repeat(32)));
    expect(engine.tokensOf([], { fieldIds: [], actors: [] }, TOKENS['acc-ana'])).toEqual([TOKENS['acc-ana']]);
  });
});

const HEADER: ManifestHeader = {
  format: 'fourrealities-evidence-report/1', reportId: '11111111-2222-4333-8444-555555555555', siteHost: 'example.atlassian.net', environment: 'development',
  projectId: '10000', projectKey: 'PAY', range: RANGE, filters: { fieldIds: [], actors: [] }, trigger: 'user', requestedBy: TOKENS['acc-ana'],
  generatedAt: 'g', gatesObservedAt: 'o', counts: { issues: 2, changes: 0, missingSincePrevious: 0, notReadable: 0 }, previous: null
};
const SOURCES = { intent: true, process: 'definitionguard' as const, code: false, audit: true, decisionIssueTypes: DEFAULT_SOURCE_SETTINGS.decisionIssueTypes, detected: { process: true, code: false, audit: true } };

describe('report.json', () => {
  it('is canonical JSON with the issues by numeric id and the warnings', () => {
    const text = engine.reportJson({ header: { ...HEADER, warning: 'UNSIGNED' }, sourcesInUse: SOURCES, issues: [issue({ issueId: '10' }), issue({ issueId: '9' })], missingSincePrevious: [{ issueId: '100', issueKey: 'PAY-100' }, { issueId: '20', issueKey: 'PAY-20' }], notReadable: [{ issueId: '31', issueKey: 'PAY-31', reason: 'MOVED' }, { issueId: '4', issueKey: 'PAY-4', reason: 'NOT_READABLE' }], linksNotRead: 2 });
    const data = JSON.parse(text);
    expect(canonicalJson(data)).toBe(text);
    expect(data.format).toBe('fourrealities-evidence-report-data/1');
    expect(data.issues.map((i: ReportIssue) => i.issueId)).toEqual(['9', '10']);
    expect(data.missingSincePrevious.map((i: { issueId: string }) => i.issueId)).toEqual(['20', '100']);
    expect(data.warnings).toEqual([{ code: 'UNSIGNED' }, { code: 'REMOTE_LINKS_NOT_READ', count: 2 }, { code: 'ISSUES_NOT_READ', count: 2 }]);
    expect(data.notReadable).toEqual([{ issueId: '4', issueKey: 'PAY-4', reason: 'NOT_READABLE' }, { issueId: '31', issueKey: 'PAY-31', reason: 'MOVED' }]);
    expect(data.decisionIssueTypes).toEqual(SOURCES.decisionIssueTypes);
    expect(JSON.parse(engine.reportJson({ header: HEADER, sourcesInUse: SOURCES, issues: [], missingSincePrevious: [], notReadable: [], linksNotRead: 0 })).warnings).toEqual([]);
  });

  it('canonical JSON sorts keys at every level, leaves out undefined and writes non-finite numbers as null', () => {
    expect(canonicalJson({ b: 1, a: { d: [3, { z: 1, y: undefined }], c: null }, e: Infinity })).toBe('{"a":{"c":null,"d":[3,{"z":1}]},"b":1,"e":null}');
    expect(canonicalJson(undefined)).toBe('null');
    expect(canonicalJson('t')).toBe('"t"');
    expect(engine.canonicalJson({ y: 1, x: 2 })).toBe('{"x":2,"y":1}');
  });
});

describe('report.csv (RFC 4180 and the formula cell rule)', () => {
  it('has the header row, one row per change and an ISSUE row for an issue without changes, CRLF, every cell quoted', () => {
    const changed = issue({ issueId: '20', issueKey: 'PAY-20', changes: [
      { changelogId: '5', at: '2026-10-02T00:00:00.000Z', author: TOKENS['acc-ana'], fieldId: 'description', field: 'Description', fieldClass: 'FREE_TEXT', from: null, to: null, fromString: null, toString: null, omitted: { reason: 'FREE_TEXT', fromLength: 12, toLength: 40 } },
      { changelogId: '6', at: '2026-10-03T00:00:00.000Z', author: null, fieldId: 'labels', field: 'Labels', fieldClass: 'OTHER', from: null, to: '=HYPERLINK("x")', fromString: '-1', toString: '@cmd', truncated: true }
    ] });
    const csv = engine.reportCsv('rid', [changed, issue({ codeException: [], definitionguard: null, ledgerseal: null })]);
    const lines = csv.split('\r\n');
    expect(csv.endsWith('\r\n')).toBe(true);
    expect(csv.charCodeAt(0)).not.toBe(0xfeff);
    expect(lines[0]).toBe(CSV_COLUMNS.map(c => `"${c}"`).join(','));
    // Issues by numeric id: 20 before 10002.
    expect(lines[1]).toContain('"CHANGE","PAY-20","20","Story","2026-10-02T00:00:00.000Z","5","pty_');
    expect(lines[1]).toContain('"FREE_TEXT (12 -> 40 characters)"');
    expect(lines[1]).toContain('"SEAL_VALID","cert-1"');
    expect(lines[1]).toContain('"yes","APPROVED"');
    expect(lines[2]).toContain(`"'=HYPERLINK(""x"")"`);
    expect(lines[2]).toContain(`"'-1","'@cmd"`);
    expect(lines[3]).toContain('"rid","ISSUE","PAY-2","10002","Story"');
    expect(lines[3]).toContain('"FOUND VERIFIED","MISSING","NOT_APPLICABLE","FOUND VERIFIED","","","","","",""');
    expect(lines).toHaveLength(5);
  });

  it('adds one NOT_READ row per issue of the scope that is not in the report, after the issue rows (review N-1)', () => {
    const lines = engine.reportCsv('rid', [issue()], [{ issueId: '30', issueKey: 'PAY-30', reason: 'MOVED' }, { issueId: '4', issueKey: '', reason: 'NOT_READABLE' }]).split('\r\n');
    expect(lines[2]).toBe(`"rid","NOT_READ","","4","","","","","","","","","","","","NOT_READABLE: in the scope, but FourRealities could not read it when the report was made (deleted, or no longer readable); its changes are not in this report","","","","","","","","","",""`);
    expect(lines[3]).toContain('"rid","NOT_READ","PAY-30","30"');
    expect(lines[3]).toContain('"MOVED: in the scope, but in another project when the report was made');
    expect(lines[2].split('","')).toHaveLength(CSV_COLUMNS.length);
  });

  it('marks an open Definition of Done as no and quotes every cell', () => {
    const csv = engine.reportCsv('r', [issue({ definitionguard: { headHash: null, stateVersion: null, issuedAt: null, mandatoryCompleted: 1, mandatoryTotal: 4, keyId: null, verification: 'VERIFIED' } })]);
    expect(csv.split('\r\n')[1]).toContain('"","no","APPROVED"');
    expect(csvCell('\tx')).toBe(`"'\tx"`);
    expect(csvCell('\rx')).toBe(`"'\rx"`);
    expect(csvCell('+1')).toBe(`"'+1"`);
    expect(csvCell(null)).toBe('""');
    expect(csvCell(3)).toBe('"3"');
  });
});

describe('manifest, people file, names and JQL', () => {
  it('adds the files and the key id; the signed text is the canonical JSON of every field but sig', () => {
    const files = [{ name: 'report.json' as const, mediaType: 'application/json', bytes: 3, sha256: 'a' }];
    const signed = engine.manifest(HEADER, files, 'fr-dev-2026-11');
    expect(signed.manifest).toEqual({ ...HEADER, files, keyId: 'fr-dev-2026-11' });
    expect(signed.signedText).toBe(canonicalJson({ ...HEADER, files, keyId: 'fr-dev-2026-11' }));
    expect(engine.manifest(HEADER, files, null).manifest).not.toHaveProperty('keyId');
  });

  it('writes the people file with "a former user" for a closed account', () => {
    const csv = engine.peopleCsv([{ token: 'pty_1', accountId: 'acc-ana', displayName: 'Ana', active: true }, { token: 'pty_2', accountId: null, displayName: null, active: null }, { token: 'pty_3', accountId: 'acc-x', displayName: null, active: false }]);
    expect(csv.split('\r\n')).toEqual(['"token","accountId","displayName","active"', '"pty_1","acc-ana","Ana","true"', '"pty_2","","a former user",""', '"pty_3","acc-x","","false"', '']);
  });

  it('names the download files from the project, the range and the report id', () => {
    const id = '1a2b3c4d-0000-4000-8000-000000000000';
    expect(engine.fileName('PAY', RANGE, id, 'report.json')).toBe('fourrealities-PAY-2026-10-01-2026-11-01-1a2b3c4d.json');
    expect(engine.fileName('PAY', RANGE, id, 'report.csv')).toBe('fourrealities-PAY-2026-10-01-2026-11-01-1a2b3c4d.csv');
    expect(engine.fileName('PAY', RANGE, id, 'manifest.json')).toBe('fourrealities-PAY-2026-10-01-2026-11-01-1a2b3c4d-manifest.json');
    expect(engine.fileName('PAY', RANGE, id, 'people.csv')).toBe('fourrealities-PAY-2026-10-01-2026-11-01-1a2b3c4d-people.csv');
  });

  it('searches one day wider on each side, and builds id lists of digits only', () => {
    expect(engine.scopeJql('10000', RANGE)).toBe('project = 10000 AND updated >= "2026-09-30" AND created < "2026-11-02" ORDER BY created ASC');
    expect(engine.idsJql(['1', '2', '3) OR project = X', '4'])).toBe('id in (1,2,4)');
  });
});
