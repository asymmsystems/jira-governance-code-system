/**
 * Copyright (c) 2026 Asymm Systems. All rights reserved.
 *
 * B-14: the evidence export and the open verifier. The verifier runs as its own process, as an auditor would run it.
 *
 * @author Fahim Farook
 */

import { spawnSync } from 'child_process';
import * as crypto from 'crypto';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { createSigner } from '../src/domain/attestation';
import { getSealEvidence, revokeSeal, sealIssue, verifyIssue } from '../src/index';
import { FakeJira, MemoryStore, panelContext, sampleIssue, validSignature } from './support/fakes';

jest.mock('@forge/api', () => ({ __esModule: true, default: {}, route: () => '' }));
jest.mock('@forge/kvs', () => ({ kvs: {} }));

// The one copy of the open verifier, identical to the public repository asymmsystems/jira-governance-code-cli
const VERIFIER = path.resolve(__dirname, '../../../tools/verifier/verify-evidence.mjs');
const pair = crypto.generateKeyPairSync('ed25519');
const signer = createSigner(pair.privateKey.export({ format: 'der', type: 'pkcs8' }).toString('base64'), 'ls-test-1');
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ls-evidence-'));
const keyFile = path.join(dir, 'ls-test-1.pub.pem');
fs.writeFileSync(keyFile, pair.publicKey.export({ format: 'pem', type: 'spki' }));

function runVerifier(evidence: any, ...extra: string[]) {
  const file = path.join(dir, `e-${crypto.randomUUID()}.json`);
  fs.writeFileSync(file, JSON.stringify(evidence));
  const run = spawnSync(process.execPath, [VERIFIER, file, keyFile, ...extra], { encoding: 'utf8' });
  return { status: run.status, out: run.stdout + run.stderr };
}

async function sealedEvidence(change = false) {
  const jira = new FakeJira(sampleIssue());
  jira.approvers = new Set(['ann', 'bob']);
  const storage = new MemoryStore();
  const deps = { jira, storage, signer };
  jira.currentUser = 'ann';
  await sealIssue({ signature: validSignature() }, panelContext('ann'), deps);
  if (change) {
    jira.edit('mallory', '2099-01-01T00:00:00.000Z', 'summary', 'changed');
    jira.currentUser = 'viewer';
    await verifyIssue({}, panelContext('viewer'), deps);
    jira.currentUser = 'bob';
    await sealIssue({ signature: validSignature({ reason: 'Approved by CAB' }) }, panelContext('bob'), deps);
  }
  jira.currentUser = 'auditor';
  return (await getSealEvidence({}, panelContext('auditor'), deps)) as any;
}

describe('B-14 evidence export', () => {
  it('returns the attestation, the canonical snapshot, the history and the steps, under 5 MB', async () => {
    const evidence = await sealedEvidence(true);
    expect(evidence.format).toBe('ledgerseal-evidence/1');
    expect(evidence.publicKeyId).toBe('ls-test-1');
    expect(evidence.attestation).toMatchObject({ schemaVersion: 3, issueId: '10001', status: 'SEAL_VALID', everCompromised: 'true', incidentCount: 1 });
    expect(evidence.snapshot.canonicalizerVersion).toBe('2.3.0');
    expect(evidence.history.map((r: any) => r.transitionName)).toEqual(['SEAL', 'CHANGE', 'RESEAL']);
    expect(evidence.verification.length).toBeGreaterThanOrEqual(4);
    expect(Buffer.byteLength(JSON.stringify(evidence), 'utf8')).toBeLessThan(5 * 1024 * 1024);
  });

  it('refuses an export without identity, and says when the issue is not sealed', async () => {
    const jira = new FakeJira(sampleIssue());
    const deps = { jira, storage: new MemoryStore() };
    await expect(getSealEvidence({}, panelContext(), deps)).resolves.toMatchObject({ ok: false, code: 'NO_IDENTITY' });
    await expect(getSealEvidence({}, panelContext('a'), deps)).resolves.toMatchObject({ ok: false, code: 'NOT_SEALED' });
  });
});

describe('B-14 open verifier', () => {
  it('passes a genuine export, exit code 0', async () => {
    const run = runVerifier(await sealedEvidence(true));
    expect(run.out).toContain('PASS snapshot hash');
    expect(run.out).toContain('PASS history chain (3 entries)');
    expect(run.out).toContain('PASS attestation names the newest seal');
    expect(run.out).toContain('PASS signature (ls-test-1)');
    expect(run.status).toBe(0);
  });

  it('adversarial: rejects an export with one changed field value, exit code 1', async () => {
    const evidence = await sealedEvidence();
    evidence.snapshot.fields[0].value = 'Rotate production database credentials, and drop the audit table';
    const run = runVerifier(evidence);
    expect(run.out).toContain('FAIL snapshot hash');
    expect(run.status).toBe(1);
  });

  it('rejects a rewritten history entry, a forged attestation and a wrong key', async () => {
    const edited = await sealedEvidence(true);
    edited.history[1].data.changes = [];
    expect(runVerifier(edited).out).toContain('FAIL history chain');

    const forged = await sealedEvidence(true);
    forged.attestation.everCompromised = 'false';
    expect(runVerifier(forged).out).toContain('FAIL signature');

    const other = await sealedEvidence();
    other.attestation.certificateId = crypto.randomUUID();
    expect(runVerifier(other).status).toBe(1);

    const wrongKey = crypto.generateKeyPairSync('ed25519').publicKey.export({ format: 'pem', type: 'spki' });
    const wrongFile = path.join(dir, 'wrong.pub.pem');
    fs.writeFileSync(wrongFile, wrongKey);
    const file = path.join(dir, 'genuine.json');
    fs.writeFileSync(file, JSON.stringify(await sealedEvidence()));
    const run = spawnSync(process.execPath, [VERIFIER, file, wrongFile], { encoding: 'utf8' });
    expect(run.stdout).toContain('FAIL signature');
    expect(run.status).toBe(1);
  });

  it('L-1: the attestation status matches the history for a changed and a revoked seal', async () => {
    const jira = new FakeJira(sampleIssue());
    jira.approvers = new Set(['ann', 'bob']);
    const storage = new MemoryStore();
    const deps = { jira, storage, signer };
    jira.currentUser = 'ann';
    await sealIssue({ signature: validSignature() }, panelContext('ann'), deps);
    jira.edit('mallory', '2099-01-01T00:00:00.000Z', 'summary', 'changed');
    jira.currentUser = 'viewer';
    await verifyIssue({}, panelContext('viewer'), deps);
    const changed = runVerifier(await getSealEvidence({}, panelContext('viewer'), deps));
    expect(changed.out).toContain('PASS attestation status matches the history (SEAL_BROKEN)');
    expect(changed.status).toBe(0);
    jira.currentUser = 'bob';
    await revokeSeal({ reason: 'Scope withdrawn' }, panelContext('bob'), deps);
    const revoked = runVerifier(await getSealEvidence({}, panelContext('viewer'), deps));
    expect(revoked.out).toContain('PASS attestation status matches the history (SEAL_REVOKED)');
    expect(revoked.status).toBe(0);
  });

  it('checks its own canonical JSON against the hand-written vectors', () => {
    const run = spawnSync(process.execPath, [VERIFIER, '--self-test'], { encoding: 'utf8' });
    expect(run.stdout).toContain('PASS 10 of 10 vectors');
    expect(run.status).toBe(0);
  });

  it('reports a usage error with exit code 2', () => {
    const run = spawnSync(process.execPath, [VERIFIER], { encoding: 'utf8' });
    expect(run.status).toBe(2);
    expect(run.stderr).toContain('Usage');
  });

  it('uses only the Node standard library', () => {
    const src = fs.readFileSync(VERIFIER, 'utf8');
    const imports = [...src.matchAll(/from '([^']+)'/g)].map(m => m[1]);
    expect(imports.every(name => name.startsWith('node:'))).toBe(true);
  });
});

describe('B-14 export failure paths', () => {
  async function sealedStore(withSigner: boolean) {
    const jira = new FakeJira(sampleIssue());
    jira.approvers = new Set(['ann']);
    jira.currentUser = 'ann';
    const storage = new MemoryStore();
    await sealIssue({ signature: validSignature() }, panelContext('ann'), { jira, storage, ...(withSigner ? { signer } : {}) });
    return { jira, storage };
  }

  it('exports an unsigned attestation when no key is configured', async () => {
    const { jira, storage } = await sealedStore(false);
    const evidence: any = await getSealEvidence({}, panelContext('auditor'), { jira, storage });
    expect(evidence.publicKeyId).toBeNull();
    expect(evidence.attestation.sig).toBeUndefined();
  });

  it('refuses to export an invalid record or an unreadable snapshot', async () => {
    const { jira, storage } = await sealedStore(true);
    const we = await storage.get('ls3:we:10001');
    storage.map.set('ls3:we:10001', { ...we, incidentCount: 9 });
    await expect(getSealEvidence({}, panelContext('auditor'), { jira, storage, signer })).resolves.toMatchObject({ code: 'INVALID_REQUEST' });
    storage.map.set('ls3:we:10001', we);
    storage.map.delete(`ls3:content:${we.currentContentId}:0`);
    await expect(getSealEvidence({}, panelContext('auditor'), { jira, storage, signer })).resolves.toMatchObject({ code: 'INVALID_REQUEST' });
    await expect(getSealEvidence({}, { accountId: 'auditor' }, { jira, storage, signer })).resolves.toMatchObject({ code: 'MISSING_ISSUE' });
  });

  it('reports a missing key file with exit code 2', () => {
    const file = path.join(dir, 'nokey.json');
    fs.writeFileSync(file, JSON.stringify({ attestation: { keyId: 'not-a-real-key' } }));
    const run = spawnSync(process.execPath, [VERIFIER, file], { encoding: 'utf8' });
    expect(run.status).toBe(2);
    expect(run.stderr).toContain('No public key file');
  });
});

describe('ADR-016 code-signed evidence (format 2) through the open verifier', () => {
  it('passes the app export with code-signed seal and approval, and fails one whose signing data was removed', async () => {
    const declaration = require('../src/domain/declaration');
    const approved = jest.spyOn(declaration, 'isDeclarationV2Approved').mockReturnValue(true);
    const { setSigningPolicyFlow, requestCodeFlow } = require('../src/service/signing');
    const { signingAuthority } = require('../src/index');
    const jira = new FakeJira(sampleIssue());
    jira.approvers = new Set(['ann', 'bob']);
    jira.jiraAdmins.add('admin');
    const storage = new MemoryStore();
    const deps = { jira, storage, secrets: storage, signer };
    jira.currentUser = 'admin';
    await setSigningPolicyFlow({ enabled: true, projectKeys: ['CHG'] }, panelContext('admin'), deps);
    const v2 = { meaning: 'APPROVAL', declarationVersion: '2', declarationText: declaration.DECLARATION_V2.text };
    const signed = async (who: string, action: string, extra: any = {}) => {
      jira.currentUser = who;
      const req = await requestCodeFlow({ action }, panelContext(who), deps, signingAuthority);
      return sealIssue({ signature: { ...v2, ...extra }, signing: { challengeId: req.challengeId, code: jira.lastCode(who) } }, panelContext(who), deps);
    };
    await expect(signed('ann', 'SEAL')).resolves.toMatchObject({ ok: true });
    jira.edit('mallory', '2099-01-01T00:00:00.000Z', 'summary', 'changed');
    await expect(signed('bob', 'RESEAL', { reason: 'Approved by CAB' })).resolves.toMatchObject({ ok: true });
    jira.currentUser = 'auditor';
    const evidence: any = await getSealEvidence({}, panelContext('auditor'), deps);
    approved.mockRestore();
    expect(evidence.format).toBe('ledgerseal-evidence/2');
    const ok = runVerifier(evidence);
    expect(ok.out).toContain('PASS signing policies (1 versions)');
    expect(ok.out).toContain('PASS code signing on every signature that needs it');
    expect(ok.status).toBe(0);
    // Removing the code check from the approval row breaks its entry hash and the code-signing check
    const stripped = JSON.parse(JSON.stringify(evidence));
    const reseal = stripped.history.find((r: any) => r.transitionName === 'RESEAL');
    delete reseal.data.signing;
    const bad = runVerifier(stripped);
    expect(bad.status).toBe(1);
    expect(bad.out).toContain('FAIL history chain');
    expect(bad.out).toMatch(/FAIL code signing on every signature that needs it \(entries \d+\)/);
  });
});
