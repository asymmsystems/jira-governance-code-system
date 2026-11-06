/**
 * Copyright (c) 2026 Asymm Systems. All rights reserved.
 *
 * B-09: the ledgerseal-cert property is an Ed25519-signed attestation (schema v2).
 *
 * @author Fahim Farook
 */

import * as crypto from 'crypto';
import * as fs from 'fs';
import * as path from 'path';
import { createSigner, signerFromEnvironment, verifyAttestation } from '../src/domain/attestation';
import { sealIssue, verifyIssue } from '../src/index';
import { FakeJira, MemoryStore, panelContext, sampleIssue, validSignature } from './support/fakes';

jest.mock('@forge/api', () => ({ __esModule: true, default: {}, route: () => '' }));
jest.mock('@forge/kvs', () => ({ kvs: {} }));

// A key made at test start. No key is stored in the repository.
const pair = crypto.generateKeyPairSync('ed25519');
const privateDer = pair.privateKey.export({ format: 'der', type: 'pkcs8' }).toString('base64');
const publicPem = pair.publicKey.export({ format: 'pem', type: 'spki' }).toString();
const signer = createSigner(privateDer, 'ls-test-1');

async function sealedWithSigner() {
  const jira = new FakeJira(sampleIssue());
  jira.approvers = new Set(['ann']);
  jira.currentUser = 'ann';
  const storage = new MemoryStore();
  const deps = { jira, storage, signer };
  await sealIssue({ signature: validSignature() }, panelContext('ann'), deps);
  return { jira, storage, deps };
}

const FIELDS = [
  'canonicalizerVersion',
  'certificateId',
  'everCompromised',
  'incidentCount',
  'issueId',
  'issuedAt',
  'keyId',
  'schemaVersion',
  'sealedAt',
  'sig',
  'snapshotHash',
  'status'
];

describe('B-09 signed attestation', () => {
  it('writes the schema 3 body on seal, under 2 KiB, with every field and no account id (ADR-010)', async () => {
    const { jira } = await sealedWithSigner();
    const body = jira.propertyWrites[0].body;
    expect(Object.keys(body).sort()).toEqual(FIELDS);
    expect(body).toMatchObject({ schemaVersion: 3, issueId: '10001', status: 'SEAL_VALID', everCompromised: 'false', incidentCount: 0, keyId: 'ls-test-1' });
    expect(JSON.stringify(body)).not.toContain('ann');
    expect(Buffer.byteLength(JSON.stringify(body), 'utf8')).toBeLessThanOrEqual(2048);
  });

  it('verifies with the public key, and fails for a changed field, a copied value and an unknown key id', async () => {
    const { jira } = await sealedWithSigner();
    const body = jira.propertyWrites[0].body;
    const keys = { 'ls-test-1': publicPem };
    expect(verifyAttestation(body, keys, '10001')).toEqual({ valid: true });
    expect(verifyAttestation({ ...body, status: 'SEAL_BROKEN' }, keys, '10001')).toEqual({ valid: false, reason: 'BAD_SIGNATURE' });
    expect(verifyAttestation({ ...body, everCompromised: 'false', incidentCount: 9 }, keys, '10001')).toEqual({ valid: false, reason: 'BAD_SIGNATURE' });
    expect(verifyAttestation(body, keys, '99999')).toEqual({ valid: false, reason: 'WRONG_ISSUE' });
    expect(verifyAttestation({ ...body, keyId: 'ls-other' }, keys, '10001')).toEqual({ valid: false, reason: 'UNKNOWN_KEY' });
    expect(verifyAttestation({ ...body, sig: undefined }, keys, '10001')).toEqual({ valid: false, reason: 'UNSIGNED' });
    expect(verifyAttestation({ ...body, sig: '!!' }, keys, '10001')).toEqual({ valid: false, reason: 'BAD_SIGNATURE' });
  });

  it('adversarial (FR-02, audit section 3.1): a property forged in the v1 shape does not verify', () => {
    const forged = { status: 'SEAL_VALID', valid: true, sealedAt: '2026-10-30T00:00:00Z', isCompromised: false };
    expect(verifyAttestation(forged, { 'ls-test-1': publicPem }, '10001')).toEqual({ valid: false, reason: 'UNSIGNED' });
  });

  it('signs each later write: a new incident gives SEAL_BROKEN with everCompromised "true"', async () => {
    const { jira, deps } = await sealedWithSigner();
    jira.issue.fields.summary = 'changed';
    jira.currentUser = 'viewer';
    await verifyIssue({}, panelContext('viewer'), deps);
    const body = jira.propertyWrites[1].body;
    expect(body).toMatchObject({ status: 'SEAL_BROKEN', everCompromised: 'true', incidentCount: 1 });
    expect(verifyAttestation(body, { 'ls-test-1': publicPem }, '10001')).toEqual({ valid: true });
  });

  it('writes an unsigned body without keyId or sig when no key is configured', async () => {
    const jira = new FakeJira(sampleIssue());
    jira.approvers = new Set(['ann']);
    jira.currentUser = 'ann';
    await sealIssue({ signature: validSignature() }, panelContext('ann'), { jira, storage: new MemoryStore() });
    const body = jira.propertyWrites[0].body;
    expect(body.sig).toBeUndefined();
    expect(body.keyId).toBeUndefined();
    expect(body.schemaVersion).toBe(3);
  });

  it('reads the key only from the Forge variables, and returns no signer when they are missing or bad', () => {
    expect(signerFromEnvironment({ LEDGERSEAL_SIGNING_KEY: privateDer, LEDGERSEAL_KEY_ID: 'ls-dev' })?.keyId).toBe('ls-dev');
    expect(signerFromEnvironment({})).toBeNull();
    expect(signerFromEnvironment({ LEDGERSEAL_SIGNING_KEY: privateDer })).toBeNull();
    expect(signerFromEnvironment({ LEDGERSEAL_SIGNING_KEY: 'bm90IGEga2V5', LEDGERSEAL_KEY_ID: 'x' })).toBeNull();
  });

  it('keeps no private key in source or tests', () => {
    const root = path.resolve(__dirname, '..');
    const walk = (d: string): string[] =>
      fs.readdirSync(d).flatMap(n => (fs.statSync(path.join(d, n)).isDirectory() ? walk(path.join(d, n)) : [path.join(d, n)]));
    const files = ['src', 'test', 'keys', '../../tools/verifier']
      .map(d => path.join(root, d))
      .filter(d => fs.existsSync(d))
      .flatMap(walk);
    // Built from parts, so this file does not match itself. The second part is the start of an Ed25519 PKCS#8 DER key in base64.
    const pattern = new RegExp(['PRIVATE', 'KEY-----'].join(' ') + '|' + 'MC4CAQAw' + 'BQYDK2Vw');
    const leaks = files.filter(f => pattern.test(fs.readFileSync(f, 'utf8')));
    expect(leaks).toEqual([]);
  });
});
