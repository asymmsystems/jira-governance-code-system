/**
 * LedgerSeal: Cryptographic Sealing & Verification Module
 * Uses standard Node.js crypto (SHA-256) inside Atlassian Forge Node runtime.
 */

import * as crypto from 'crypto';
import { CanonicalIssueSnapshot, ElectronicSignature, SealCertificate } from './models';

/**
 * Computes deterministic SHA-256 hash of a CanonicalIssueSnapshot.
 */
export function computeSnapshotHash(snapshot: CanonicalIssueSnapshot): string {
  // Exclude capturedAt timestamp so hash reflects pure state content
  const stateOnly = {
    issueId: snapshot.issueId,
    issueKey: snapshot.issueKey,
    projectKey: snapshot.projectKey,
    issueType: snapshot.issueType,
    fields: snapshot.fields,
    attachments: snapshot.attachments,
    comments: snapshot.comments || []
  };

  const serialized = JSON.stringify(stateOnly);
  return crypto.createHash('sha256').update(serialized, 'utf8').digest('hex');
}

/**
 * Generates an immutable SealCertificate combining snapshot state and electronic signature.
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
 * Verifies certificate internal cryptographic integrity.
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
