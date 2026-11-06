/**
 * Copyright (c) 2026 Asymm Systems. All rights reserved.
 *
 * @author Fahim Farook
 */

import { computeSnapshotHash, generateSealCertificate, verifyCertificateIntegrity } from '../src/domain/crypto';
import { CanonicalIssueSnapshot, ElectronicSignature } from '../src/domain/models';

describe('Crypto Module', () => {
  const sampleSnapshot: CanonicalIssueSnapshot = {
    issueId: '10001',
    issueKey: 'SEC-101',
    projectKey: 'SEC',
    issueType: 'Bug',
    status: 'In Review',
    fields: [
      { id: 'summary', name: 'Summary', type: 'string', value: 'Critical vulnerability' },
      { id: 'description', name: 'Description', type: 'string', value: 'Details of patch' }
    ],
    attachments: [
      { id: 'att-1', filename: 'patch.diff', size: 512, created: '2026-10-28T08:00:00Z', authorAccountId: 'acc-1' }
    ],
    capturedAt: '2026-10-28T12:00:00Z'
  };

  const sampleSignature: ElectronicSignature = {
    signerAccountId: 'acc-1',
    signerDisplayName: 'Lead Security Architect',
    signedAt: '2026-10-28T12:05:00Z',
    meaning: 'Approved for production deployment',
    reasonCode: 'APPROVAL',
    declarationText: 'I verify this fix meets all security criteria.'
  };

  it('computes deterministic SHA-256 hash for identical snapshots', () => {
    const hash1 = computeSnapshotHash(sampleSnapshot);
    const hash2 = computeSnapshotHash({ ...sampleSnapshot });
    expect(hash1).toHaveLength(64);
    expect(hash1).toBe(hash2);
  });

  it('produces different hashes if any field changes', () => {
    const hash1 = computeSnapshotHash(sampleSnapshot);
    const modifiedSnapshot: CanonicalIssueSnapshot = {
      ...sampleSnapshot,
      fields: [
        { id: 'summary', name: 'Summary', type: 'string', value: 'Modified vulnerability text' },
        { id: 'description', name: 'Description', type: 'string', value: 'Details of patch' }
      ]
    };
    const hash2 = computeSnapshotHash(modifiedSnapshot);
    expect(hash1).not.toBe(hash2);
  });

  it('generates a valid SealCertificate', () => {
    const cert = generateSealCertificate(sampleSnapshot, sampleSignature);
    expect(cert.certificateId).toBeDefined();
    expect(cert.snapshotHash).toHaveLength(64);
    expect(cert.certificateHash).toHaveLength(64);
    expect(cert.status).toBe('ACTIVE');
    expect(cert.sealedBy).toEqual(sampleSignature);
    expect(verifyCertificateIntegrity(cert)).toBe(true);
  });

  it('detects certificate tampering if certificateHash does not match content', () => {
    const cert = generateSealCertificate(sampleSnapshot, sampleSignature);
    const tamperedCert = {
      ...cert,
      snapshotHash: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855' // empty hash
    };
    expect(verifyCertificateIntegrity(tamperedCert)).toBe(false);
  });
});
