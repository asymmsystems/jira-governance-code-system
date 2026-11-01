/**
 * Copyright (c) 2026 Asymm Systems. All rights reserved.
 *
 * Versioned canonical rules (spec v2 section 4.1): a seal is checked with the rules of the canonical form it
 * was made with, so a later change to the covered set neither breaks old seals nor hides changes from them.
 *
 * @author Fahim Farook
 */

import * as canonicalizer from '../src/domain/canonicalizer';
import { canonicalizeIssueState, CANONICALIZER_VERSION, isKnownCanonicalizerVersion } from '../src/domain/canonicalizer';
import { sealIssue, verifyIssue, validateTransition } from '../src/index';
import { FakeJira, MemoryStore, model, panelContext, sampleIssue, validSignature } from './support/fakes';

jest.mock('@forge/api', () => ({ __esModule: true, default: {}, route: () => '' }));
jest.mock('@forge/kvs', () => ({ kvs: {} }));

const SENTIMENT = { id: 'customfield_10024', name: 'Sentiment', schema: { type: 'array', custom: 'com.atlassian.servicedesk.sentiment:sd-sentiment' } };

function raw(): any {
  return {
    id: '10001',
    key: 'CHG-1',
    fields: { summary: 'Rotate keys', resolution: { id: '10000', name: 'Done' }, customfield_10024: [{ name: 'Neutral' }] }
  };
}

function setup() {
  const jira = new FakeJira(sampleIssue());
  jira.approvers = new Set(['ann', 'bob']);
  jira.users = { ann: 'Ann Approver', bob: 'Bob Approver' };
  const storage = new MemoryStore();
  const as = (user: string | null) => {
    jira.currentUser = user;
    return { jira, storage };
  };
  return { jira, storage, as };
}

/** Seals as an app that still wrote canonical form 2.0.0 would have done. */
async function sealAsVersion200(as: (user: string | null) => any) {
  const replaced = jest.replaceProperty(canonicalizer, 'CANONICALIZER_VERSION', '2.0.0');
  try {
    return await sealIssue({ signature: validSignature() }, panelContext('ann'), as('ann'));
  } finally {
    replaced.restore();
  }
}

afterEach(() => jest.restoreAllMocks());

describe('canonical form rule sets', () => {
  it('new seals use 2.1.0, and both 2.0.0 and 2.1.0 are known', () => {
    expect(CANONICALIZER_VERSION).toBe('2.1.0');
    expect(isKnownCanonicalizerVersion('2.0.0')).toBe(true);
    expect(isKnownCanonicalizerVersion('2.1.0')).toBe(true);
    expect(isKnownCanonicalizerVersion('9.9.9')).toBe(false);
  });

  it('2.0.0 covers Resolution and Sentiment; 2.1.0 (NF-04, NF-05) leaves them out', () => {
    const old = canonicalizeIssueState(raw(), 't', [SENTIMENT], '2.0.0');
    const current = canonicalizeIssueState(raw(), 't', [SENTIMENT], '2.1.0');

    expect(old.canonicalizerVersion).toBe('2.0.0');
    expect(old.fields.map(f => f.id)).toEqual(['customfield_10024', 'resolution', 'summary']);
    expect(current.canonicalizerVersion).toBe('2.1.0');
    expect(current.fields.map(f => f.id)).toEqual(['summary']);
    expect(canonicalizeIssueState(raw(), 't', [SENTIMENT]).canonicalizerVersion).toBe('2.1.0');
  });

  it('refuses an unknown canonical form instead of guessing its rules', () => {
    expect(() => canonicalizeIssueState(raw(), 't', [], '9.9.9')).toThrow('Unknown canonical form version 9.9.9');
  });
});

describe('a seal is checked with the rules it was made with', () => {
  it('a 2.0.0 seal stays valid after the app moves to 2.1.0, and the gate stays open', async () => {
    const { storage, as } = setup();
    await expect(sealAsVersion200(as)).resolves.toMatchObject({ ok: true });
    expect((await model.workEffort(storage)).attributes.canonicalizerVersion).toBe('2.0.0');
    const writes = storage.sets.length;

    await expect(verifyIssue({}, panelContext('viewer'), as('viewer'))).resolves.toMatchObject({ status: 'SEAL_VALID' });
    await expect(validateTransition({ issue: { id: '10001', key: 'CHG-1' } }, {}, as(null))).resolves.toEqual({ result: true });
    expect(storage.sets.length).toBe(writes);
  });

  it('a 2.0.0 seal still breaks on a resolution change, which 2.0.0 covers', async () => {
    const { jira, as } = setup();
    await sealAsVersion200(as);
    jira.edit('bob', '2099-01-01T00:00:00.000Z', 'resolution', { id: '10000', name: 'Done' });

    const view: any = await verifyIssue({}, panelContext('viewer'), as('viewer'));

    expect(view.status).toBe('SEAL_BROKEN');
    expect(view.tamperedFields.map((f: any) => f.fieldId)).toEqual(['resolution']);
  });

  it('a 2.1.0 seal does not break on the same resolution change (NF-05)', async () => {
    const { jira, as } = setup();
    await sealIssue({ signature: validSignature() }, panelContext('ann'), as('ann'));
    jira.edit('bob', '2099-01-01T00:00:00.000Z', 'resolution', { id: '10000', name: 'Done' });

    await expect(verifyIssue({}, panelContext('viewer'), as('viewer'))).resolves.toMatchObject({ status: 'SEAL_VALID' });
  });

  it('a seal whose rules cannot be applied is reported as a record that failed its check, not as valid', async () => {
    const { as } = setup();
    await sealAsVersion200(as);
    const real = canonicalizer.canonicalizeIssueState;
    jest.spyOn(canonicalizer, 'canonicalizeIssueState').mockImplementation((r, at, f, v) => {
      if (v === '2.0.0') throw new Error('Unknown canonical form version 2.0.0');
      return real(r, at, f, v);
    });

    await expect(verifyIssue({}, panelContext('viewer'), as('viewer'))).resolves.toMatchObject({ status: 'RECORD_INVALID' });
    await expect(validateTransition({ issue: { id: '10001', key: 'CHG-1' } }, {}, as(null))).resolves.toMatchObject({ result: false });
  });

  it('a seal after a revoke compares the issue under the revoked seal’s rules', async () => {
    const { jira, storage, as } = setup();
    await sealAsVersion200(as);
    jira.edit('bob', '2099-01-01T00:00:00.000Z', 'summary', 'changed');
    const { revokeSeal } = require('../src/index');
    await revokeSeal({ reason: 'Scope withdrawn' }, panelContext('ann'), as('ann'));
    jira.edit('bob', '2099-01-01T00:01:00.000Z', 'summary', sampleIssue().fields.summary);

    // Unchanged under 2.0.0, so no reason is needed, although the 2.1.0 hash differs from the stored one
    await expect(sealIssue({ signature: validSignature({ reason: undefined }) }, panelContext('ann'), as('ann'))).resolves.toMatchObject({ ok: true });
    expect((await model.workEffort(storage)).attributes.canonicalizerVersion).toBe('2.1.0');
  });
});
