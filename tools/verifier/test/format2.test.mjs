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
 * Verifier 1.5.0: format 1 gives the same output and exit code as 1.3.0 for every fixture, and the format 2 checks
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
    const row = { workEffortId: '10001', statusId: 'LS_SEALED', statusDatetime: r.at, setByPartyId: 'pty_' + 'b'.repeat(32), reason: null, transitionName: r.transitionName ?? (i === 0 ? 'SEAL' : 'RESEAL'), seq: i + 1, data: { certificateId: `cert-${i + 1}`, snapshotHash, ...(r.signing ? { signing: r.signing } : {}), ...(r.policyRef ? { signingPolicy: r.policyRef } : {}), ...(r.extra ?? {}) }, prevEntryHash: prev, entryHash: '' };
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

describe('verifier 1.5.0: format 1 unchanged', () => {
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

describe('verifier 1.5.0: format 2 code signing', () => {
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

const ref = p => ({ version: p.version, policyHash: p.policyHash });

describe('verifier 1.5.0: the format and the policy in force cannot be switched off by an edit (review M-1)', () => {
  const p1 = policy(null, {});
  const unsignedUnderP1 = () => evidence({ policies: [p1], rows: [{ at: '2026-11-08T01:00:00.000Z', policyRef: ref(p1) }] });

  it('runs the format 2 checks when the content needs them, whatever the format field says', () => {
    const ev = unsignedUnderP1();
    assert.strictEqual(check(ev).status, 1);
    const downgraded = check({ ...ev, format: 'ledgerseal-evidence/1' });
    assert.strictEqual(downgraded.status, 1, downgraded.stdout);
    assert.match(downgraded.stdout, /FAIL code signing on every signature that needs it \(entries 1\)/);
    const dropped = check({ ...ev, format: 'ledgerseal-evidence/1', signingPolicies: undefined });
    assert.strictEqual(dropped.status, 1, dropped.stdout);
  });

  it('fails a swapped policy list (self-consistent, turned off) and an emptied one', () => {
    const off = policy(null, { enabled: false });
    const swapped = check({ ...unsignedUnderP1(), signingPolicies: [off] });
    assert.match(swapped.stdout, /PASS signing policies \(1 versions\)/);
    assert.match(swapped.stdout, /FAIL code signing on every signature that needs it \(entries 1\)/);
    assert.strictEqual(swapped.status, 1);
    const emptied = check({ ...unsignedUnderP1(), signingPolicies: [] });
    assert.strictEqual(emptied.status, 1, emptied.stdout);
  });

  it('passes a row that names an off policy without a code, and reads the named policy, not the dates (review L-9)', () => {
    const off = policy(null, { enabled: false });
    const honest = check(evidence({ policies: [off], rows: [{ at: '2026-11-08T01:00:00.000Z', policyRef: ref(off) }] }));
    assert.strictEqual(honest.status, 0, honest.stdout);
    // Policy 2 was saved before the row's time, but the row was checked against policy 1 and names it
    const p2 = policy(p1, { fromDate: '2026-11-08T00:30:00.000Z' });
    const named = check(evidence({ policies: [p1, p2], rows: [{ at: '2026-11-08T01:00:00.000Z', signing: signing(p1), policyRef: ref(p1) }] }));
    assert.strictEqual(named.status, 0, named.stdout);
    const mismatch = check(evidence({ policies: [p1, p2], rows: [{ at: '2026-11-08T01:00:00.000Z', signing: signing(p1), policyRef: ref(p2) }] }));
    assert.strictEqual(mismatch.status, 1, mismatch.stdout);
  });
});

describe('verifier 1.5.0: declarations, ended runs and moved issues (review round 2)', () => {
  const TEXT = 'I am signing this record electronically.';
  const decl = { declarationVersion: '2', declarationHash: sha256(TEXT) };

  it('shows the declaration each signer agreed to, and fails a missing or changed text', () => {
    const rows = [{ at: '2026-11-08T01:00:00.000Z', extra: decl }];
    const ok = check({ ...evidence({ policies: [], rows }), declarations: { 2: TEXT } });
    assert.strictEqual(ok.status, 0, ok.stdout);
    assert.match(ok.stdout, /PASS declaration texts \(versions 2\)/);
    assert.match(ok.stdout, /NOTE declaration version 2 \(entries 1\): "I am signing this record electronically\."/);
    const missing = check(evidence({ policies: [], rows }));
    assert.match(missing.stdout, /FAIL declaration texts \(entries 1\)/);
    const changed = check({ ...evidence({ policies: [], rows }), declarations: { 2: TEXT + ' And more.' } });
    assert.strictEqual(changed.status, 1);
    // A downgraded format field does not switch the check off
    const downgraded = check({ ...evidence({ policies: [], rows }), format: 'ledgerseal-evidence/1' });
    assert.match(downgraded.stdout, /FAIL declaration texts/);
  });

  it('judges a row by the project it names, so an issue moved to a code-signing project later is not a false FAIL', () => {
    const p1 = policy(null, {});
    // Signed without a code in project 200, then the issue moved to project 100, which needs codes
    const moved = check(evidence({ policies: [p1], projectId: '100', rows: [{ at: '2026-11-08T01:00:00.000Z', policyRef: { ...ref(p1), projectId: '200' } }] }));
    assert.strictEqual(moved.status, 0, moved.stdout);
    const inScope = check(evidence({ policies: [p1], projectId: '999', rows: [{ at: '2026-11-08T01:00:00.000Z', policyRef: { ...ref(p1), projectId: '100' } }] }));
    assert.match(inScope.stdout, /FAIL code signing on every signature that needs it \(entries 1\)/);
  });
});

/** A route version with its hash, as the app stores it (groups and gates sorted). */
function route(stages, version = 1) {
  const draft = { schemaVersion: 1, routeId: 'rte_t', version, name: 'QA then Regulatory', stages, reapprovalStageIds: null, setByPartyId: 'pty_' + 'c'.repeat(32), fromDate: '2026-11-08T00:00:00.000Z' };
  return { ...draft, routeHash: sha256(canonicalJson(draft)) };
}
const QA = { stageId: 'qa', name: 'QA', orderGroup: 1, roleTypeId: 'LS_REVIEWER', approverGroups: [{ id: 'g-qa', name: 'qa' }], quorum: { kind: 'ANY' }, gatesStatusIds: [] };
const REG = { stageId: 'reg', name: 'Regulatory', orderGroup: 2, roleTypeId: 'LS_APPROVER', approverGroups: [{ id: 'g-reg', name: 'reg' }], quorum: { kind: 'N', n: 2 }, gatesStatusIds: [] };
const P = c => 'pty_' + c.repeat(32);

/**
 * A routed evidence export: `sigs` are the run's signatures in order ([stageId, party]); the last one writes the seal.
 * `tweak` may change a row's data before it is hashed, so the chain stays valid and only the route checks can fail.
 */
function routedEvidence(r, sigs, { tweak = () => undefined, after = [], stageSignatures } = {}) {
  const snapshot = { canonicalizerVersion: '2.3.0', issueId: '10001', issueKey: 'CHG-1', projectId: '100', issueTypeId: '3', fields: [], attachments: [], comments: [] };
  const snapshotHash = sha256(canonicalJson(snapshot));
  const runData = stageId => ({ runId: 'run-1', routeId: r.routeId, routeVersion: r.version, routeHash: r.routeHash, stageId, qualifyingGroupId: 'g', snapshotHash });
  let prev = GENESIS;
  const history = [];
  const push = row => {
    const full = { workEffortId: '10001', reason: null, seq: history.length + 1, prevEntryHash: prev, entryHash: '', ...row };
    tweak(full);
    full.entryHash = sha256(canonicalJson(without(full, 'entryHash')));
    prev = full.entryHash;
    history.push(full);
    return full;
  };
  const runRows = sigs.slice(0, -1).map(([stageId, party], i) => push({ statusId: 'LS_RUN_SIGNED', statusDatetime: `2026-11-08T0${i + 1}:00:00.000Z`, setByPartyId: party, transitionName: 'SIGN_STAGE', data: runData(stageId) }));
  const [lastStage, lastParty] = sigs.at(-1);
  push({
    statusId: 'LS_SEALED',
    statusDatetime: '2026-11-08T09:00:00.000Z',
    setByPartyId: lastParty,
    transitionName: 'SEAL',
    data: { certificateId: 'cert-1', meaning: 'APPROVAL', declarationVersion: '1', previousCertificateId: null, previousState: null, ...runData(lastStage), stageSignatures: stageSignatures ?? runRows.map(x => x.entryHash), requiredStageIds: r.stages.map(s => s.stageId) }
  });
  for (const row of after) push(row);
  const body = { schemaVersion: 4, issueId: '10001', status: 'SEAL_VALID', certificateId: 'cert-1', snapshotHash, canonicalizerVersion: '2.3.0', sealedAt: '2026-11-08T09:00:00.000Z', everCompromised: 'false', incidentCount: 0, issuedAt: '2026-11-08T12:00:00.000Z', approval: { runState: 'COMPLETE', stagesComplete: 2, stagesTotal: 2, routeHash: r.routeHash }, keyId: 'test-v2' };
  const attestation = { ...body, sig: sign(null, Buffer.from(canonicalJson(body), 'utf8'), privateKey).toString('base64') };
  return { format: 'ledgerseal-evidence/2', attestation, snapshot, history, signingPolicies: [], routes: [JSON.parse(JSON.stringify(r))], parties: {} };
}

describe('verifier 1.5.0: format 2 approval routes (checks 6 to 9)', () => {
  const r = route([QA, REG]);
  const good = [['qa', P('a')], ['reg', P('b')], ['reg', P('c')]];

  it('fails a routed record whose format field says 1 or whose route versions were removed (review M-1)', () => {
    const ev = routedEvidence(r, good);
    for (const edited of [{ ...ev, format: 'ledgerseal-evidence/1', routes: undefined }, { ...ev, routes: undefined }]) {
      const res = check(edited);
      assert.strictEqual(res.status, 1, res.stdout);
      assert.match(res.stdout, /FAIL route versions \(missing\)/);
    }
  });

  it('fails a run that goes on after an entry that ended it (check 12, review round 2 R2-1)', () => {
    const ev = routedEvidence(r, good, { tweak: row => { if (row.seq === 2) row.data.endsRun = true; } });
    const res = check(ev);
    assert.strictEqual(res.status, 1, res.stdout);
    assert.match(res.stdout, /FAIL no run continues after it ended \(entries 3\)/);
    assert.match(check(routedEvidence(r, good)).stdout, /PASS no run continues after it ended/);
  });

  it('passes a run of QA then two Regulatory signers', () => {
    const res = check(routedEvidence(r, good));
    assert.strictEqual(res.status, 0, res.stdout);
    for (const name of ['route versions (1)', 'stage signatures of the sealing run', 'quorum and stage order', 'one stage per person']) assert.match(res.stdout, new RegExp(`PASS ${name.replace(/[()]/g, '\\$&')}`));
  });

  it('check 6: fails a route version that does not hash to its routeHash', () => {
    const ev = routedEvidence(r, good);
    ev.routes[0].stages[1].quorum = { kind: 'N', n: 1 };
    assert.match(check(ev).stdout, /FAIL route versions \(1\)/);
  });

  it('check 7: fails when the seal row names other stage signatures, or a stage signed another snapshot', () => {
    assert.match(check(routedEvidence(r, good, { stageSignatures: [] })).stdout, /FAIL stage signatures of the sealing run/);
    const other = routedEvidence(r, good, { tweak: row => { if (row.seq === 1) row.data.snapshotHash = 'f'.repeat(64); } });
    assert.match(check(other).stdout, /FAIL stage signatures of the sealing run/);
  });

  it('check 8: fails a stage below its quorum, and a later group signed before an earlier one was complete', () => {
    assert.match(check(routedEvidence(r, [['qa', P('a')], ['reg', P('b')]])).stdout, /FAIL quorum and stage order/);
    assert.match(check(routedEvidence(r, [['reg', P('b')], ['qa', P('a')], ['reg', P('c')]])).stdout, /FAIL quorum and stage order/);
  });

  it('check 9: fails a person who signed two stages of the run', () => {
    assert.match(check(routedEvidence(r, [['qa', P('a')], ['reg', P('a')], ['reg', P('c')]])).stdout, /FAIL one stage per person/);
  });

  it('check 4 skips run rows: a new run after the seal does not change the sealed status', () => {
    const later = [{ statusId: 'LS_RUN_SIGNED', statusDatetime: '2026-11-08T10:00:00.000Z', setByPartyId: P('d'), transitionName: 'SIGN_STAGE', data: { runId: 'run-2', stageId: 'qa' } }];
    const res = check(routedEvidence(r, good, { after: later }));
    assert.match(res.stdout, /PASS attestation status matches the history \(SEAL_VALID\)/);
    assert.strictEqual(res.status, 0, res.stdout);
  });

  it('skips the run checks for format 2 evidence whose newest seal has no run', () => {
    const p1 = policy(null, {});
    const ev = evidence({ policies: [p1], rows: [{ at: '2026-11-08T01:00:00.000Z', signing: signing(p1) }] });
    ev.routes = [];
    const res = check(ev);
    assert.match(res.stdout, /PASS route versions \(0\)/);
    assert.doesNotMatch(res.stdout, /quorum and stage order/);
  });
});
