/**
 * Copyright (c) 2026 Asymm Systems. All rights reserved.
 *
 * LedgerSeal: the signed ledgerseal-cert attestation, schema 3 (spec v2 section 8, ADR-011 decision 8).
 * It names no person: any user who can browse the issue can read the property.
 * The app signs with an Ed25519 private key held in a Forge encrypted variable. Anyone verifies with the public key.
 * The vendor holds the private key, so a valid signature shows that LedgerSeal wrote the record, not that the vendor could not.
 *
 * @author Fahim Farook
 */

import * as crypto from 'crypto';
import { canonicalJson } from './canonical-json';

/** The seal facts an attestation states. */
export interface AttestationSource {
  issueId: string;
  certificateId: string;
  snapshotHash: string;
  canonicalizerVersion: string;
  sealedAt: string;
  everCompromised: boolean;
  incidentCount: number;
}

export type AttestationStatus = 'SEAL_VALID' | 'SEAL_BROKEN' | 'SEAL_COMPROMISED' | 'SEAL_REVOKED';

export interface Attestation {
  schemaVersion: 3;
  issueId: string;
  status: AttestationStatus;
  certificateId: string;
  snapshotHash: string;
  canonicalizerVersion: string;
  sealedAt: string;
  /** A string, because entity property indexes have no boolean type. */
  everCompromised: 'true' | 'false';
  incidentCount: number;
  issuedAt: string;
  keyId?: string;
  sig?: string;
}

export interface Signer {
  keyId: string;
  sign(data: string): string;
}

export function createSigner(privateKeyDerBase64: string, keyId: string): Signer {
  const key = crypto.createPrivateKey({ key: Buffer.from(privateKeyDerBase64, 'base64'), format: 'der', type: 'pkcs8' });
  if (key.asymmetricKeyType !== 'ed25519') throw new Error('LedgerSeal: the signing key is not an Ed25519 key.');
  return {
    keyId,
    sign: data => crypto.sign(null, Buffer.from(data, 'utf8'), key).toString('base64')
  };
}

/**
 * Builds the signer from the Forge variables LEDGERSEAL_SIGNING_KEY and LEDGERSEAL_KEY_ID.
 * Returns null, and the app writes unsigned attestations, when either is missing or the key cannot be read.
 * The key value is never logged.
 */
export function signerFromEnvironment(env: Record<string, string | undefined>): Signer | null {
  const key = env.LEDGERSEAL_SIGNING_KEY;
  const keyId = env.LEDGERSEAL_KEY_ID;
  if (!key || !keyId) return null;
  try {
    return createSigner(key, keyId);
  } catch {
    console.error('LedgerSeal: LEDGERSEAL_SIGNING_KEY could not be read as an Ed25519 key. Attestations are unsigned.');
    return null;
  }
}

export function buildAttestation(source: AttestationSource, status: AttestationStatus, issuedAt: string, signer: Signer | null): Attestation {
  const body: Attestation = {
    schemaVersion: 3,
    issueId: source.issueId,
    status,
    certificateId: source.certificateId,
    snapshotHash: source.snapshotHash,
    canonicalizerVersion: source.canonicalizerVersion,
    sealedAt: source.sealedAt,
    everCompromised: source.everCompromised ? 'true' : 'false',
    incidentCount: source.incidentCount,
    issuedAt
  };
  if (!signer) return body;
  const signed: Attestation = { ...body, keyId: signer.keyId };
  return { ...signed, sig: signer.sign(canonicalJson(signed)) };
}

/** ADR-017: the approval state of a routed issue (schema 4). */
export interface ApprovalSummary {
  runState: 'OPEN' | 'REJECTED' | 'VOIDED' | 'COMPLETE';
  stagesComplete: number;
  stagesTotal: number;
  routeHash: string;
}

/**
 * Schema 4 (spec v4 section 15.4), only for an issue with a route: schema 3 plus `approval`. Before the first seal it
 * has no status, certificate, snapshot hash or seal time. `status` keeps its four values and meanings.
 */
export function buildRoutedAttestation(
  issueId: string,
  source: AttestationSource | null,
  status: AttestationStatus | null,
  approval: ApprovalSummary,
  issuedAt: string,
  signer: Signer | null
): Record<string, unknown> {
  const sealed = source && status ? { ...buildAttestation(source, status, issuedAt, null) } : null;
  const body: Record<string, unknown> = sealed
    ? { ...sealed, schemaVersion: 4, approval }
    : { schemaVersion: 4, issueId, approval, issuedAt };
  delete body.sig;
  delete body.keyId;
  if (!signer) return body;
  const signed = { ...body, keyId: signer.keyId };
  return { ...signed, sig: signer.sign(canonicalJson(signed)) };
}

export type VerifyResult = { valid: true } | { valid: false; reason: 'UNSIGNED' | 'UNKNOWN_KEY' | 'WRONG_ISSUE' | 'BAD_SIGNATURE' };

/**
 * Checks an attestation against a set of public keys (PEM, by key id) and the issue it must belong to.
 */
export function verifyAttestation(attestation: any, publicKeys: Record<string, string>, expectedIssueId: string): VerifyResult {
  if (!attestation || typeof attestation.sig !== 'string' || typeof attestation.keyId !== 'string') return { valid: false, reason: 'UNSIGNED' };
  const pem = publicKeys[attestation.keyId];
  if (!pem) return { valid: false, reason: 'UNKNOWN_KEY' };
  if (String(attestation.issueId) !== String(expectedIssueId)) return { valid: false, reason: 'WRONG_ISSUE' };
  const { sig, ...signed } = attestation;
  const ok = crypto.verify(null, Buffer.from(canonicalJson(signed), 'utf8'), crypto.createPublicKey(pem), Buffer.from(sig, 'base64'));
  return ok ? { valid: true } : { valid: false, reason: 'BAD_SIGNATURE' };
}
