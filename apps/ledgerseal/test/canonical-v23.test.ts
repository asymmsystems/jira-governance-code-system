/**
 * Copyright (c) 2026 Asymm Systems. All rights reserved.
 *
 * Canonical form 2.3.0 (ADR-018 decision 7, spec v4 section 16.3). The vectors in fixtures/vectors-2.3.0.json were
 * written by hand from the rules. Older versions keep their rules: under 2.2.0 the signature field is covered, so a
 * seal made before 2.3.0 shows a change when the field is set (Q-12).
 *
 * @author Fahim Farook
 */

import * as crypto from 'crypto';
import * as fs from 'fs';
import * as path from 'path';
import { canonicalizeIssueState, isExcludedField, SIGNATURE_FIELD_REASON } from '../src/domain/canonicalizer';
import { canonicalFormText, computeSnapshotHash } from '../src/domain/crypto';
import { pseudonymise } from '../src/domain/party';

const VECTORS = JSON.parse(fs.readFileSync(path.resolve(__dirname, 'fixtures/vectors-2.3.0.json'), 'utf8'));
const T = '2026-11-08T00:00:00Z';
const table = (accountId: string) => VECTORS.parties[accountId] as string;

describe('canonical form 2.3.0 test vectors', () => {
  it('has 4 vectors for 2.3.0', () => {
    expect(VECTORS.vectors).toHaveLength(4);
    expect(VECTORS.canonicalizerVersion).toBe('2.3.0');
  });

  for (const vector of VECTORS.vectors) {
    it(`${vector.name}: matches the hand-written canonical text, its SHA-256 and the excluded list`, () => {
      const snapshot = canonicalizeIssueState(pseudonymise(vector.issue, table).value, T, vector.schemas, '2.3.0');
      expect(canonicalFormText(snapshot)).toBe(vector.canonical);
      expect(computeSnapshotHash(snapshot)).toBe(crypto.createHash('sha256').update(vector.canonical, 'utf8').digest('hex'));
      expect((snapshot.excluded ?? []).map(e => e.id).filter(id => id.startsWith('customfield_'))).toEqual(vector.excluded);
      for (const e of snapshot.excluded ?? []) if (vector.excluded.includes(e.id)) expect(e.reason).toBe(SIGNATURE_FIELD_REASON);
    });
  }

  it('keeps 2.2.0 unchanged: the signature field is covered there (Q-12)', () => {
    const vector = VECTORS.vectors[0];
    const under22 = canonicalizeIssueState(vector.issue, T, vector.schemas, '2.2.0');
    expect(under22.fields.map(f => f.id)).toContain('customfield_10080');
    expect(isExcludedField('2.2.0', 'customfield_10080', vector.schemas)).toBe(false);
    expect(isExcludedField('2.3.0', 'customfield_10080', vector.schemas)).toBe(true);
  });
});
