/**
 * LedgerSeal: v1 seal hashing and verification (SHA-256), kept to read v1 records and hash snapshots
 * Uses standard Node.js crypto (SHA-256) inside Atlassian Forge Node runtime.
 */

import * as crypto from 'crypto';
import { CanonicalIssueSnapshot, ElectronicSignature, SealCertificate } from './models';
import { canonicalJson, sha256Hex } from './canonical-json';

/**
 * The hashed form of a snapshot (spec v2 section 4.1). Field names, display text, the excluded list
 * and the status are not part of it.
 */
export function canonicalForm(snapshot: CanonicalIssueSnapshot) {
  return {
    canonicalizerVersion: snapshot.canonicalizerVersion ?? '2.0.0',
    issueId: snapshot.issueId,
    issueKey: snapshot.issueKey,
    projectId: snapshot.projectId ?? snapshot.projectKey,
    issueTypeId: snapshot.issueTypeId ?? snapshot.issueType,
    fields: snapshot.fields.map(f => ({ id: f.id, value: f.value })),
    attachments: snapshot.attachments,
    comments: snapshot.comments || []
  };
}

/** The exact text that is hashed: canonical JSON (sorted keys, no whitespace) of the canonical form. */
export function canonicalFormText(snapshot: CanonicalIssueSnapshot): string {
  return canonicalJson(canonicalForm(snapshot));
}

/**
 * Computes deterministic SHA-256 hash of a CanonicalIssueSnapshot.
 */
export function computeSnapshotHash(snapshot: CanonicalIssueSnapshot): string {
  return sha256Hex(canonicalFormText(snapshot));
}

/**
 * Generates a v1 SealCertificate combining snapshot state and electronic signature (tests and legacy reads only).
 */
export function generateSealCertificate(
  snapshot: CanonicalIssueSnapshot,
  signature: ElectronicSignature,
  certificateId: string = crypto.randomUUID()
): SealCertificate {
  const snapshotHash = computeSnapshotHash(snapshot);

  // Compute certificate signature hash
  const certPayload = JSON.stringify({
    certificateId,
    issueId: snapshot.issueId,
    issueKey: snapshot.issueKey,
    snapshotHash,
    sealedBy: signature
  });

  const certificateHash = crypto.createHash('sha256').update(certPayload, 'utf8').digest('hex');

  return {
    certificateId,
    issueId: snapshot.issueId,
    issueKey: snapshot.issueKey,
    snapshotHash,
    certificateHash,
    algorithm: 'SHA-256',
    schemaVersion: '1.0',
    sealedAt: signature.signedAt,
    sealedBy: signature,
    snapshot,
    status: 'ACTIVE'
  };
}

/**
 * Verifies that a v1 certificate still matches its own hashes.
 */
export function verifyCertificateIntegrity(certificate: SealCertificate): boolean {
  // 1. Verify snapshot hash matches snapshot content
  const expectedSnapshotHash = computeSnapshotHash(certificate.snapshot);
  if (expectedSnapshotHash !== certificate.snapshotHash) {
    return false;
  }

  // 2. Verify certificate hash matches certificate envelope
  const certPayload = JSON.stringify({
    certificateId: certificate.certificateId,
    issueId: certificate.issueId,
    issueKey: certificate.issueKey,
    snapshotHash: certificate.snapshotHash,
    sealedBy: certificate.sealedBy
  });

  const expectedCertHash = crypto.createHash('sha256').update(certPayload, 'utf8').digest('hex');
  return expectedCertHash === certificate.certificateHash;
}
