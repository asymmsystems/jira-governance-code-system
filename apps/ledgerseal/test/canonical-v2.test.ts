/**
 * Copyright (c) 2026 Asymm Systems. All rights reserved.
 *
 * B-13: canonical form v2 (spec v2 section 4). The vectors in verifier/vectors.json were written by hand
 * from the specification, so these tests compare the code with the specification, not with itself.
 *
 * @author Fahim Farook
 */

import * as crypto from 'crypto';
import * as fs from 'fs';
import * as path from 'path';
import { canonicalizeIssueState } from '../src/domain/canonicalizer';
import { canonicalFormText, computeSnapshotHash } from '../src/domain/crypto';
import { sealIssue } from '../src/index';
import { FakeJira, MemoryStore, model, panelContext, sampleIssue, validSignature } from './support/fakes';

jest.mock('@forge/api', () => ({ __esModule: true, default: {}, route: () => '' }));
jest.mock('@forge/kvs', () => ({ kvs: {} }));

const VECTORS = JSON.parse(fs.readFileSync(path.resolve(__dirname, '../verifier/vectors.json'), 'utf8'));
const T = '2026-11-01T00:00:00Z';
const hash = (issue: any, fields: any[] = []) => computeSnapshotHash(canonicalizeIssueState(issue, T, fields));
const base = () => ({ id: '1', key: 'X-1', fields: { summary: 'Release v1' } as any });
const withField = (id: string, value: any) => {
  const i = base();
  i.fields[id] = value;
  return i;
};

describe('B-13 canonical form v2 test vectors', () => {
  it('has 10 vectors', () => {
    expect(VECTORS.vectors).toHaveLength(10);
    expect(VECTORS.canonicalizerVersion).toBe('2.0.0');
  });

  for (const vector of VECTORS.vectors) {
    it(`${vector.name}: matches the hand-written canonical text and its SHA-256`, () => {
      // The vectors are written for the canonical form the file names, so they keep checking that version's rules
      const snapshot = canonicalizeIssueState(vector.issue, T, [], VECTORS.canonicalizerVersion);
      expect(canonicalFormText(snapshot)).toBe(vector.canonical);
      expect(computeSnapshotHash(snapshot)).toBe(crypto.createHash('sha256').update(vector.canonical, 'utf8').digest('hex'));
    });
  }
});

describe('B-13 canonical form v2 rules', () => {
  it('adversarial (T-03 C19, LS-11): a display name change keeps the seal; a different user breaks it', () => {
    const a = hash(withField('assignee', { accountId: 'a1', displayName: 'Alice' }));
    expect(hash(withField('assignee', { accountId: 'a1', displayName: 'Alice Smith' }))).toBe(a);
    expect(hash(withField('assignee', { accountId: 'b2', displayName: 'Alice' }))).not.toBe(a);
  });

  it('adversarial (T-03 C18): the same instant in two time zones gives one hash', () => {
    expect(hash(withField('customfield_9', '2026-10-31T10:00:00.000+0000'))).toBe(hash(withField('customfield_9', '2026-10-31T15:30:00.000+0530')));
    expect(hash(withField('duedate', '2026-10-31'))).not.toBe(hash(withField('duedate', '2026-11-01')));
  });

  it('adversarial (T-03 C14, C15): order of an ordered list and typed spaces both break the seal', () => {
    expect(hash(withField('customfield_2', ['step1', 'step2', 'step3']))).not.toBe(hash(withField('customfield_2', ['step3', 'step1', 'step2'])));
    expect(hash(base())).not.toBe(hash(withField('summary', 'Release v1   ')));
  });

  it('sorts only fields whose schema says they are sets', () => {
    const multiSelect = [{ id: 'customfield_3', name: 'Tier', schema: { type: 'array', items: 'option', custom: 'x:multiselect' } }];
    const a = hash(withField('customfield_3', [{ id: '7', value: 'Gold' }, { id: '8', value: 'Silver' }]), multiSelect);
    expect(hash(withField('customfield_3', [{ id: '8', value: 'Silver' }, { id: '7', value: 'Gold' }]), multiSelect)).toBe(a);
    const orderedStrings = [{ id: 'customfield_4', name: 'Steps', schema: { type: 'array', items: 'string', custom: 'x:steps' } }];
    expect(hash(withField('customfield_4', ['a', 'b']), orderedStrings)).not.toBe(hash(withField('customfield_4', ['b', 'a']), orderedStrings));
  });

  it('identifies options, components and versions by id, so a rename keeps the seal and a swap breaks it', () => {
    expect(hash(withField('components', [{ id: '1', name: 'X' }]))).toBe(hash(withField('components', [{ id: '1', name: 'Y' }])));
    expect(hash(withField('fixVersions', [{ id: '7', name: '1.0' }]))).not.toBe(hash(withField('fixVersions', [{ id: '8', name: '1.0' }])));
    expect(hash(withField('customfield_5', { id: '10', value: 'Class II' }))).not.toBe(hash(withField('customfield_5', { id: '11', value: 'Class II' })));
  });

  it('leaves field names out of the hash, so renaming a custom field keeps the seal', () => {
    const issue = withField('customfield_6', 'budget 1000');
    expect(hash(issue, [{ id: 'customfield_6', name: 'Budget' }])).toBe(hash(issue, [{ id: 'customfield_6', name: 'Approved budget' }]));
  });

  it('keeps display text for the change list next to the hashed value', () => {
    const snap = canonicalizeIssueState(withField('priority', { id: '2', name: 'High' }), T);
    expect(snap.fields.find(f => f.id === 'priority')).toMatchObject({ value: { id: '2' }, display: 'High' });
  });

  it('records the current canonical form, 2.2.0, in every new seal and attestation', async () => {
    const jira = new FakeJira(sampleIssue());
    jira.approvers = new Set(['ann']);
    jira.currentUser = 'ann';
    const storage = new MemoryStore();
    await sealIssue({ signature: validSignature() }, panelContext('ann'), { jira, storage });
    expect((await model.workEffort(storage)).attributes.canonicalizerVersion).toBe('2.2.0');
    expect((await model.sealedSnapshot(storage)).canonicalizerVersion).toBe('2.2.0');
    expect(jira.propertyWrites[0].body.canonicalizerVersion).toBe('2.2.0');
  });
});

describe('B-13 canonical form v2 edge rules', () => {
  const fieldOf = (id: string, value: any, schemas: any[] = []) => canonicalizeIssueState(withField(id, value), T, schemas).fields.find(f => f.id === id);
  const cascading = [{ id: 'customfield_7', name: 'Region', schema: { type: 'option-with-child', custom: 'x:cascadingselect' } }];

  it('keeps the child of a cascading option and drops URLs from objects without an id', () => {
    expect(fieldOf('customfield_7', { id: '1', value: 'EMEA', child: { id: '11', value: 'UK' } }, cascading)?.value).toEqual({ id: '1', child: { id: '11' } });
    expect(fieldOf('customfield_8', { label: 'x', self: 'https://a', avatarUrls: { a: 1 }, iconUrl: 'https://i' })?.value).toEqual({ label: 'x' });
  });

  it('drops a link with no other issue, and names inward links in the display text', () => {
    const links = fieldOf('issuelinks', [
      { type: { id: '1', name: 'Blocks', inward: 'is blocked by' }, inwardIssue: { id: '4', key: 'X-4' } },
      { type: { id: '1' } }
    ]);
    expect(links?.value).toEqual([{ type: '1', direction: 'inward', issue: '4' }]);
    expect(links?.display).toBe('is blocked by X-4');
    expect(fieldOf('issuelinks', [{ inwardIssue: { id: '9' } }])?.display).toBe('relates to 9');
  });

  it('omits time tracking without an original estimate, and shows seconds when no text is given', () => {
    expect(fieldOf('timetracking', { remainingEstimate: '1h' })).toBeUndefined();
    expect(fieldOf('timetracking', { originalEstimateSeconds: 60 })?.display).toBe('60');
  });

  it('writes an empty time for work logs, attachments and comments without a time', () => {
    const snap = canonicalizeIssueState(
      {
        id: '1',
        key: 'X-1',
        fields: {
          worklog: { worklogs: [{ id: '1', started: 5 }] },
          attachment: [{ id: '2', created: 5 }],
          comment: { comments: [{ id: '3', created: null, body: 'b' }] }
        }
      },
      T
    );
    expect(snap.fields[0].value[0].started).toBe('');
    expect(snap.attachments[0].created).toBe('');
    expect(snap.comments?.[0].created).toBe('');
  });
});
