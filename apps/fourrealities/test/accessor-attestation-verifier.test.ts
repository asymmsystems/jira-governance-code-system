/**
 * Copyright (c) 2026 Asymm Systems. All rights reserved.
 * @author Fahim Farook
 * FourRealities: Ed25519 check of sibling records and the trusted keys per environment (ADR-012).
 */

import * as crypto from 'crypto';
import * as fs from 'fs';
import * as path from 'path';
import { attestationChecker, canonicalJson, trustedKeysFor, verifyAttestation } from '../src/accessor/attestation-verifier';
import { TRUSTED_KEYS, TrustedKey } from '../src/accessor/attestation-keys';
import { factsFromIssue } from '../src/accessor/issue-facts';

function keyPair(): { pem: string; sign: (data: string) => string } {
  const { publicKey, privateKey } = crypto.generateKeyPairSync('ed25519');
  return {
    pem: publicKey.export({ type: 'spki', format: 'pem' }).toString(),
    sign: data => crypto.sign(null, Buffer.from(data, 'utf8'), privateKey).toString('base64')
  };
}

const pair = keyPair();
const KEYS: TrustedKey[] = [{ producer: 'ledgerseal', keyId: 'ls-test', environments: ['PRODUCTION'], pem: pair.pem }];

function signed(record: Record<string, unknown>, keyId = 'ls-test', sign = pair.sign): Record<string, unknown> {
  const body = { ...record, keyId };
  return { ...body, sig: sign(canonicalJson(body)) };
}

const BASE = { schemaVersion: 2, issueId: '10001', status: 'SEAL_VALID', incidentCount: 0, nested: { b: [1, 'x', null], a: true } };

describe('canonicalJson', () => {
  it('sorts keys at every level and writes no white space', () => {
    expect(canonicalJson({ b: 1, a: { d: [2, null], c: 'x' } })).toBe('{"a":{"c":"x","d":[2,null]},"b":1}');
    expect(canonicalJson({ a: undefined, b: null })).toBe('{"b":null}');
    expect(canonicalJson(undefined)).toBe('null');
    expect(canonicalJson(false)).toBe('false');
  });
});

describe('verifyAttestation', () => {
  it('verifies a record signed with a trusted key for the same issue', () => {
    expect(verifyAttestation('ledgerseal', signed(BASE), '10001', KEYS)).toBe('VERIFIED');
  });

  it('reports unsigned records, including DefinitionGuard keyId null and sig null', () => {
    expect(verifyAttestation('ledgerseal', BASE, '10001', KEYS)).toBe('UNSIGNED');
    expect(verifyAttestation('definitionguard', { ...BASE, keyId: null, sig: null }, '10001', KEYS)).toBe('UNSIGNED');
    expect(verifyAttestation('ledgerseal', null, '10001', KEYS)).toBe('UNSIGNED');
    expect(verifyAttestation('ledgerseal', { ...BASE, keyId: 'ls-test', sig: '' }, '10001', KEYS)).toBe('UNSIGNED');
  });

  it('does not trust a key of another producer or an unknown key id', () => {
    expect(verifyAttestation('definitionguard', signed(BASE), '10001', KEYS)).toBe('UNKNOWN_KEY');
    expect(verifyAttestation('ledgerseal', signed(BASE, 'other'), '10001', KEYS)).toBe('UNKNOWN_KEY');
  });

  it('rejects a record copied from another issue', () => {
    expect(verifyAttestation('ledgerseal', signed(BASE), '10002', KEYS)).toBe('WRONG_ISSUE');
  });

  it('rejects a changed record, a signature by another key and a malformed signature', () => {
    expect(verifyAttestation('ledgerseal', { ...signed(BASE), status: 'SEAL_BROKEN' }, '10001', KEYS)).toBe('BAD_SIGNATURE');
    expect(verifyAttestation('ledgerseal', signed(BASE, 'ls-test', keyPair().sign), '10001', KEYS)).toBe('BAD_SIGNATURE');
    const badKey: TrustedKey[] = [{ ...KEYS[0], pem: 'not a key' }];
    expect(verifyAttestation('ledgerseal', signed(BASE), '10001', badKey)).toBe('BAD_SIGNATURE');
  });

  it('is bound to its keys by attestationChecker', () => {
    expect(attestationChecker(KEYS)('ledgerseal', signed(BASE), '10001')).toBe('VERIFIED');
    expect(attestationChecker([])('ledgerseal', signed(BASE), '10001')).toBe('UNKNOWN_KEY');
  });
});

describe('trusted keys per Forge environment', () => {
  const DEV_IDS = ['dg-dev-2026-11', 'ls-dev-2026-11'];
  const PROD_IDS = ['dg-prod-2026-11', 'ls-prod-2026-11'];
  const ids = (keys: readonly TrustedKey[]) => keys.map(k => k.keyId).sort();

  it('trusts the development keys in development and staging only', () => {
    expect(ids(trustedKeysFor('DEVELOPMENT'))).toEqual(DEV_IDS);
    expect(ids(trustedKeysFor('STAGING'))).toEqual(DEV_IDS);
  });

  it('trusts exactly the two production keys in production, and no development key', () => {
    expect(ids(trustedKeysFor('PRODUCTION'))).toEqual(PROD_IDS);
    expect(trustedKeysFor('PRODUCTION').map(k => [k.producer, k.keyId]).sort()).toEqual([
      ['definitionguard', 'dg-prod-2026-11'],
      ['ledgerseal', 'ls-prod-2026-11']
    ]);
  });

  it('treats an unknown environment as production', () => {
    expect(ids(trustedKeysFor(undefined))).toEqual(PROD_IDS);
    expect(ids(trustedKeysFor('SOMETHING'))).toEqual(PROD_IDS);
    expect(trustedKeysFor(undefined, KEYS)).toEqual(KEYS);
  });

  it('bundles valid Ed25519 public keys, one development and one production key per producer', () => {
    for (const k of TRUSTED_KEYS) {
      expect(crypto.createPublicKey(k.pem).asymmetricKeyType).toBe('ed25519');
    }
    expect(TRUSTED_KEYS.map(k => `${k.producer} ${k.keyId}`).sort()).toEqual([
      'definitionguard dg-dev-2026-11',
      'definitionguard dg-prod-2026-11',
      'ledgerseal ls-dev-2026-11',
      'ledgerseal ls-prod-2026-11'
    ]);
  });

  it('bundles the same public keys as the published key files', () => {
    const root = path.join(__dirname, '..', '..', '..');
    const files: Record<string, string> = {
      'dg-dev-2026-11': 'docs/marketplace/definitionguard-public-key.pem',
      'dg-prod-2026-11': 'docs/marketplace/definitionguard-public-key-dg-prod-2026-11.pem',
      'ls-dev-2026-11': 'apps/ledgerseal/keys/ls-dev-2026-11.pub.pem',
      'ls-prod-2026-11': 'apps/ledgerseal/keys/ls-prod-2026-11.pub.pem'
    };
    for (const k of TRUSTED_KEYS) {
      expect(k.pem).toBe(fs.readFileSync(path.join(root, files[k.keyId]), 'utf8'));
    }
  });

  it('checks a production record against the bundled key its keyId names', () => {
    const prod = trustedKeysFor('PRODUCTION');
    // The real production key did not sign this record, so the check reaches the key and fails.
    expect(verifyAttestation('ledgerseal', signed(BASE, 'ls-prod-2026-11'), '10001', prod)).toBe('BAD_SIGNATURE');
    expect(verifyAttestation('definitionguard', signed(BASE, 'dg-prod-2026-11'), '10001', prod)).toBe('BAD_SIGNATURE');
    // A development key id is not trusted in production.
    expect(verifyAttestation('ledgerseal', signed(BASE, 'ls-dev-2026-11'), '10001', prod)).toBe('UNKNOWN_KEY');
    expect(verifyAttestation('definitionguard', signed(BASE, 'dg-dev-2026-11'), '10001', prod)).toBe('UNKNOWN_KEY');
  });

  it('verifies a production record with the same table structure and a test-only key pair', () => {
    const table = TRUSTED_KEYS.map(k => ({ ...k, pem: pair.pem }));
    const prod = trustedKeysFor('PRODUCTION', table);
    expect(verifyAttestation('ledgerseal', signed(BASE, 'ls-prod-2026-11'), '10001', prod)).toBe('VERIFIED');
    expect(verifyAttestation('definitionguard', signed(BASE, 'dg-prod-2026-11'), '10001', prod)).toBe('VERIFIED');
    // The producer must match the key: a LedgerSeal key does not verify a DefinitionGuard record.
    expect(verifyAttestation('definitionguard', signed(BASE, 'ls-prod-2026-11'), '10001', prod)).toBe('UNKNOWN_KEY');
    // Development keys stay out of production even with a valid signature, and in development the production keys are not trusted.
    expect(verifyAttestation('ledgerseal', signed(BASE, 'ls-dev-2026-11'), '10001', prod)).toBe('UNKNOWN_KEY');
    const dev = trustedKeysFor('DEVELOPMENT', table);
    expect(verifyAttestation('ledgerseal', signed(BASE, 'ls-dev-2026-11'), '10001', dev)).toBe('VERIFIED');
    expect(verifyAttestation('ledgerseal', signed(BASE, 'ls-prod-2026-11'), '10001', dev)).toBe('UNKNOWN_KEY');
  });
});

describe('factsFromIssue records the signature check of each sibling record', () => {
  const issue = (properties: Record<string, unknown>) => ({ id: '10001', key: 'DEMO-1', fields: { status: { statusCategory: { key: 'done' } } }, properties });

  it('checks each record that is present, as its producer', () => {
    const verify = jest.fn((producer: string) => (producer === 'ledgerseal' ? 'VERIFIED' : 'UNSIGNED') as 'VERIFIED' | 'UNSIGNED');
    const facts = factsFromIssue(issue({ 'ledgerseal-cert': { a: 1 }, 'definitionguard-dod': { b: 2 } }), { verify });
    expect(facts.attestations).toEqual({ ledgerseal: 'VERIFIED', dod: 'UNSIGNED' });
    expect(verify).toHaveBeenCalledWith('definitionguard', { b: 2 }, '10001');
  });

  it('leaves attestations out when no record is present or no checker is given', () => {
    expect(factsFromIssue(issue({}), { verify: () => 'VERIFIED' }).attestations).toBeUndefined();
    expect(factsFromIssue(issue({ 'ledgerseal-cert': { a: 1 } })).attestations).toBeUndefined();
    expect(factsFromIssue(issue({ 'ledgerseal-cert': { a: 1 } }), { verify: () => 'UNSIGNED' }).attestations).toEqual({ ledgerseal: 'UNSIGNED' });
  });
});
