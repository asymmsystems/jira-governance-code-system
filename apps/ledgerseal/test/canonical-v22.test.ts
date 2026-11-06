/**
 * Copyright (c) 2026 Asymm Systems. All rights reserved.
 *
 * Canonical form 2.2.0 (ADR-011 decision 6, readiness finding F-07). The vectors in fixtures/vectors-2.2.0.json
 * were written by hand from the rules, so these tests compare the code with the rules, not with itself.
 *
 * @author Fahim Farook
 */

import * as crypto from 'crypto';
import * as fs from 'fs';
import * as path from 'path';
import { canonicalizeIssueState, isReferenceField } from '../src/domain/canonicalizer';
import { canonicalFormText, computeSnapshotHash } from '../src/domain/crypto';
import { pseudonymise } from '../src/domain/party';
import { sealIssue, verifyIssue } from '../src/index';
import { FakeJira, MemoryStore, panelContext, sampleIssue, validSignature } from './support/fakes';

jest.mock('@forge/api', () => ({ __esModule: true, default: {}, route: () => '' }));
jest.mock('@forge/kvs', () => ({ kvs: {} }));

const VECTORS = JSON.parse(fs.readFileSync(path.resolve(__dirname, 'fixtures/vectors-2.2.0.json'), 'utf8'));
const T = '2026-11-01T00:00:00Z';
const table = (accountId: string) => VECTORS.parties[accountId] as string;

describe('canonical form 2.2.0 test vectors', () => {
  it('has 5 vectors for 2.2.0', () => {
    expect(VECTORS.vectors).toHaveLength(5);
    expect(VECTORS.canonicalizerVersion).toBe('2.2.0');
  });

  for (const vector of VECTORS.vectors) {
    it(`${vector.name}: matches the hand-written canonical text and its SHA-256`, () => {
      const snapshot = canonicalizeIssueState(pseudonymise(vector.issue, table).value, T, vector.schemas, '2.2.0');
      expect(canonicalFormText(snapshot)).toBe(vector.canonical);
      expect(computeSnapshotHash(snapshot)).toBe(crypto.createHash('sha256').update(vector.canonical, 'utf8').digest('hex'));
    });
  }
});

describe('F-07 objects with an id', () => {
  const hash = (value: any, schemas: any[], version: string) =>
    computeSnapshotHash(canonicalizeIssueState({ id: '1', key: 'X-1', fields: { customfield_1: value } }, T, schemas, version));
  const forgeObject = [{ id: 'customfield_1', schema: { type: 'any', custom: 'x:forge-object' } }];

  it('2.2.0: a change to an object field\'s content breaks the seal even when its id stays', () => {
    expect(hash({ id: '5', amount: 10 }, forgeObject, '2.2.0')).not.toBe(hash({ id: '5', amount: 99 }, forgeObject, '2.2.0'));
  });

  it('2.1.0 keeps its rule (id only), so seals made with it still check the same way', () => {
    expect(hash({ id: '5', amount: 10 }, forgeObject, '2.1.0')).toBe(hash({ id: '5', amount: 99 }, forgeObject, '2.1.0'));
  });

  it('knows reference fields by system id, by schema type and by array item type', () => {
    expect(isReferenceField('priority', undefined)).toBe(true);
    expect(isReferenceField('parent', undefined)).toBe(true);
    expect(isReferenceField('customfield_9', { id: 'customfield_9', schema: { type: 'version' } })).toBe(true);
    expect(isReferenceField('customfield_9', { id: 'customfield_9', schema: { type: 'array', items: 'option' } })).toBe(true);
    expect(isReferenceField('customfield_9', { id: 'customfield_9', schema: { type: 'array', items: 'string' } })).toBe(false);
    expect(isReferenceField('customfield_9', { id: 'customfield_9', schema: { type: 'any' } })).toBe(false);
    expect(isReferenceField('customfield_9', undefined)).toBe(false);
  });

  it('a parent issue whose own summary changes keeps the child\'s seal', () => {
    const issue = (summary: string) => ({ id: '1', key: 'X-1', fields: { parent: { id: '20', key: 'X-20', fields: { summary } } } });
    expect(computeSnapshotHash(canonicalizeIssueState(issue('a'), T, [], '2.2.0'))).toBe(computeSnapshotHash(canonicalizeIssueState(issue('b'), T, [], '2.2.0')));
  });
});

describe('2.2.0 seal end to end', () => {
  it('a display name change keeps the seal; a different person breaks it', async () => {
    const issue = sampleIssue();
    issue.fields.assignee = { accountId: 'dev-1', displayName: 'Dana' };
    const jira = new FakeJira(issue);
    jira.approvers = new Set(['ann']);
    jira.currentUser = 'ann';
    const storage = new MemoryStore();
    await sealIssue({ signature: validSignature() }, panelContext('ann'), { jira, storage });
    jira.issue.fields.assignee = { accountId: 'dev-1', displayName: 'Dana Smith' };
    jira.currentUser = 'viewer';
    expect(((await verifyIssue({}, panelContext('viewer'), { jira, storage })) as any).status).toBe('SEAL_VALID');
    jira.issue.fields.assignee = { accountId: 'dev-2', displayName: 'Dana' };
    expect(((await verifyIssue({}, panelContext('viewer'), { jira, storage })) as any).status).toBe('SEAL_BROKEN');
  });
});
