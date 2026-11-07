/**
 * Copyright (c) 2026 Asymm Systems.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 *
 * Verifier 1.4.0: format 1 gives the same output and exit code as 1.3.0 for every fixture, and the format 2 checks
 * (LedgerSeal spec v4 section 15.7). Format 2 vectors are built here with a key made for the test.
 *
 * @author Fahim Farook
 */

import { describe, it } from 'node:test';
import assert from 'node:assert';
import { spawnSync } from 'node:child_process';
import { createHash, generateKeyPairSync, sign } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { canonicalJson } from '../verify-evidence.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const VERIFIER = join(HERE, '..', 'verify-evidence.mjs');
const FIXTURES = join(HERE, 'fixtures');
const GENESIS = '0'.repeat(64);
const sha256 = text => createHash('sha256').update(text, 'utf8').digest('hex');
const without = (obj, field) => Object.fromEntries(Object.entries(obj).filter(([k]) => k !== field));
const run = args => spawnSync(process.execPath, [VERIFIER, ...args], { encoding: 'utf8' });

const { publicKey, privateKey } = generateKeyPairSync('ed25519');
const DIR = mkdtempSync(join(tmpdir(), 'lsv2-'));
const KEY = join(DIR, 'k.pub.pem');
writeFileSync(KEY, publicKey.export({ type: 'spki', format: 'pem' }));

/** A policy version chained after `prev`. */
export function policy(prev, fields) {
  const draft = { schemaVersion: 1, version: (prev?.version ?? 0) + 1, enabled: true, projectIds: ['100'], lockoutThreshold: 5, codeLifetimeSeconds: 300, declarationVersion: '2', setByPartyId: 'pty_' + 'a'.repeat(32), fromDate: '2026-11-08T00:00:00.000Z', prevPolicyHash: prev?.policyHash ?? GENESIS, ...fields };
  return { ...draft, policyHash: sha256(canonicalJson(without(draft, 'policyHash'))) };
}

/** A signed evidence export of format 2 whose newest row seals `snapshot`, with the given rows' data. */
export function evidence({ rows, policies, projectId = '100' }) {
  const snapshot = { canonicalizerVersion: '2.2.0', issueId: '10001', issueKey: 'CHG-1', projectId, issueTypeId: '3', fields: [], attachments: [], comments: [] };
  const snapshotHash = sha256(canonicalJson(snapshot));
  let prev = GENESIS;
  const history = rows.map((r, i) => {
    const row = { workEffortId: '10001', statusId: 'LS_SEALED', statusDatetime: r.at, setByPartyId: 'pty_' + 'b'.repeat(32), reason: null, transitionName: r.transitionName ?? (i === 0 ? 'SEAL' : 'RESEAL'), seq: i + 1, data: { certificateId: `cert-${i + 1}`, snapshotHash, ...(r.signing ? { signing: r.signing } : {}) }, prevEntryHash: prev, entryHash: '' };
    if (r.statusId) row.statusId = r.statusId;
    row.entryHash = sha256(canonicalJson(without(row, 'entryHash')));
    prev = row.entryHash;
    return row;
  });
  const newestSeal = [...history].reverse().find(r => r.statusId === 'LS_SEALED');
  const STATUS = { LS_SEALED: 'SEAL_VALID', LS_CHANGED: 'SEAL_BROKEN', LS_REVOKED: 'SEAL_REVOKED' };
  const body = { schemaVersion: 3, issueId: '10001', status: STATUS[history.at(-1).statusId], certificateId: newestSeal.data.certificateId, snapshotHash, canonicalizerVersion: '2.2.0', sealedAt: newestSeal.statusDatetime, everCompromised: 'false', incidentCount: 0, issuedAt: '2026-11-08T12:00:00.000Z', keyId: 'test-v2' };
  const attestation = { ...body, sig: sign(null, Buffer.from(canonicalJson(body), 'utf8'), privateKey).toString('base64') };
  return { format: 'ledgerseal-evidence/2', attestation, snapshot, history, signingPolicies: policies, parties: {} };
}

const signing = p => ({ method: 'LS_ATL_EMAIL_OTP_1', components: 2, mode: 'PART11', challengeId: 'c-1', policyVersion: p.version, policyHash: p.policyHash });

function check(ev) {
  const file = join(DIR, `e-${Math.random().toString(36).slice(2)}.json`);
  writeFileSync(file, JSON.stringify(ev));
  return run([file, KEY]);
}

describe('verifier 1.4.0: format 1 unchanged', () => {
  for (const f of ['valid-evidence', 'broken-chain', 'tampered-snapshot', 'redacted-evidence']) {
    for (const k of ['test-key', 'wrong-key', 'redaction-key']) {
      it(`${f} with ${k}: same output and exit code as 1.3.0`, () => {
        const res = run([join(FIXTURES, `${f}.json`), join(FIXTURES, `${k}.pub.pem`)]);
        assert.strictEqual(res.stdout, readFileSync(join(FIXTURES, 'expected-1.3.0', `${f}.${k}.txt`), 'utf8'));
        assert.strictEqual(String(res.status), readFileSync(join(FIXTURES, 'expected-1.3.0', `${f}.${k}.exit`), 'utf8').trim());
      });
    }
  }
});

describe('verifier 1.4.0: format 2 code signing', () => {
  const p1 = policy(null, {});

  it('passes a code-signed seal and approval made under the policy', () => {
    const res = check(evidence({ policies: [p1], rows: [{ at: '2026-11-08T01:00:00.000Z', signing: signing(p1) }, { at: '2026-11-08T02:00:00.000Z', signing: signing(p1) }] }));
    assert.strictEqual(res.status, 0, res.stdout);
    assert.match(res.stdout, /PASS signing policies \(1 versions\)/);
    assert.match(res.stdout, /PASS code signing on every signature that needs it/);
  });

  it('fails a signature made under the policy without its code check', () => {
    const res = check(evidence({ policies: [p1], rows: [{ at: '2026-11-08T01:00:00.000Z', signing: signing(p1) }, { at: '2026-11-08T02:00:00.000Z' }] }));
    assert.strictEqual(res.status, 1);
    assert.match(res.stdout, /FAIL code signing on every signature that needs it \(entries 2\)/);
  });

  it('does not ask for a code before the policy came into force, or in another project, or after it was turned off', () => {
    const p2 = policy(p1, { enabled: false, fromDate: '2026-11-08T05:00:00.000Z' });
    const before = check(evidence({ policies: [p1], rows: [{ at: '2026-11-07T23:00:00.000Z' }, { at: '2026-11-08T01:00:00.000Z', signing: signing(p1) }] }));
    assert.strictEqual(before.status, 0, before.stdout);
    const other = check(evidence({ policies: [p1], projectId: '999', rows: [{ at: '2026-11-08T01:00:00.000Z' }] }));
    assert.strictEqual(other.status, 0, other.stdout);
    const off = check(evidence({ policies: [p1, p2], rows: [{ at: '2026-11-08T06:00:00.000Z' }] }));
    assert.strictEqual(off.status, 0, off.stdout);
  });

  it('fails a changed policy, a broken policy chain and a signing row naming a policy that is not in the evidence', () => {
    const changed = check(evidence({ policies: [{ ...p1, lockoutThreshold: 9 }], rows: [{ at: '2026-11-08T01:00:00.000Z', signing: signing(p1) }] }));
    assert.match(changed.stdout, /FAIL signing policies/);
    const p2 = policy(p1, { fromDate: '2026-11-08T05:00:00.000Z' });
    const gap = check(evidence({ policies: [p2], rows: [{ at: '2026-11-08T06:00:00.000Z', signing: signing(p2) }] }));
    assert.match(gap.stdout, /FAIL signing policies/);
    const foreign = check(evidence({ policies: [p1], projectId: '999', rows: [{ at: '2026-11-08T01:00:00.000Z', signing: { ...signing(p1), policyVersion: 7 } }] }));
    assert.match(foreign.stdout, /FAIL code signing/);
  });

  it('fails a code check of the wrong policy version, method or component count', () => {
    const p2 = policy(p1, { fromDate: '2026-11-08T05:00:00.000Z' });
    const stale = check(evidence({ policies: [p1, p2], rows: [{ at: '2026-11-08T06:00:00.000Z', signing: signing(p1) }] }));
    assert.match(stale.stdout, /FAIL code signing on every signature that needs it \(entries 1\)/);
    for (const bad of [{ method: 'OTHER' }, { components: 1 }, { policyHash: 'f'.repeat(64) }]) {
      const res = check(evidence({ policies: [p1], rows: [{ at: '2026-11-08T01:00:00.000Z', signing: { ...signing(p1), ...bad } }] }));
      assert.strictEqual(res.status, 1);
    }
  });

  it('checks revoke rows as signatures, and ignores rows that are not signatures', () => {
    const revokedUnsigned = check(evidence({ policies: [p1], rows: [{ at: '2026-11-08T01:00:00.000Z', signing: signing(p1) }, { at: '2026-11-08T02:00:00.000Z', statusId: 'LS_REVOKED', transitionName: 'REVOKE' }] }));
    assert.match(revokedUnsigned.stdout, /FAIL code signing on every signature that needs it \(entries 2\)/);
    const change = check(evidence({ policies: [p1], rows: [{ at: '2026-11-08T01:00:00.000Z', signing: signing(p1) }, { at: '2026-11-08T02:00:00.000Z', statusId: 'LS_CHANGED', transitionName: 'CHANGE' }] }));
    assert.match(change.stdout, /PASS code signing/);
  });
});
