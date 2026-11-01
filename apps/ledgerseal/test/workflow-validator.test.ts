import { validateTransitionGate } from '../src/validator/workflow-validator';
import { generateSealCertificate } from '../src/domain/crypto';
import { fromCertificate } from '../src/domain/tamper-detector';
import { CanonicalIssueSnapshot, ElectronicSignature } from '../src/domain/models';

describe('Workflow Validator', () => {
  const validSnapshot: CanonicalIssueSnapshot = {
    issueId: '10005',
    issueKey: 'REL-501',
    projectKey: 'REL',
    issueType: 'Release',
    status: 'Pre-Release',
    fields: [
      { id: 'summary', name: 'Summary', type: 'string', value: 'Release v1.2.0' }
    ],
    attachments: [
      { id: 'att-1', filename: 'evidence.pdf', size: 100, created: '2026-10-28T00:00:00Z', authorAccountId: 'acc-1' }
    ],
    capturedAt: '2026-10-28T12:00:00Z'
  };

  const sampleSig: ElectronicSignature = {
    signerAccountId: 'acc-99',
    signerDisplayName: 'Release Manager',
    signedAt: '2026-10-28T12:01:00Z',
    meaning: 'Approved for production deploy',
    reasonCode: 'RELEASE_GATE',
    declarationText: 'Verified test results.'
  };

  const cert = generateSealCertificate(validSnapshot, sampleSig);
  const info = (c: any) => ({
    certificateId: c.certificateId,
    sealedAt: c.sealedAt,
    signerName: c.sealedBy.signerDisplayName,
    revocationReason: c.revocation?.revocationReason
  });

  it('rejects transition if issue has no active seal', () => {
    const result = validateTransitionGate(null, validSnapshot);
    expect(result.isValid).toBe(false);
    expect(result.errorMessage).toContain('must be cryptographically sealed');
  });

  it('rejects transition if certificate is revoked with reason', () => {
    const revokedCert = {
      ...cert,
      status: 'REVOKED' as const,
      revocation: {
        revokedAt: '2026-10-28T12:10:00Z',
        revokedByAccountId: 'acc-admin',
        revocationReason: 'Security flaw detected'
      }
    };
    const result = validateTransitionGate(fromCertificate(revokedCert), validSnapshot, info(revokedCert));
    expect(result.isValid).toBe(false);
    expect(result.errorMessage).toContain('Security flaw detected');
  });

  it('rejects transition if certificate is revoked without specific reason', () => {
    const revokedCert = {
      ...cert,
      status: 'REVOKED' as const,
      revocation: undefined
    };
    const result = validateTransitionGate(fromCertificate(revokedCert), validSnapshot, info(revokedCert));
    expect(result.isValid).toBe(false);
    expect(result.errorMessage).toContain('Unspecified');
  });

  it('rejects transition if ticket state has been tampered with post-approval', () => {
    const tamperedSnapshot = {
      ...validSnapshot,
      fields: [
        { id: 'summary', name: 'Summary', type: 'string', value: 'Release v1.2.0 with backdoors' }
      ]
    };
    const result = validateTransitionGate(fromCertificate(cert), tamperedSnapshot, info(cert));
    expect(result.isValid).toBe(false);
    expect(result.errorMessage).toContain('Cryptographic seal broken');
    expect(result.details?.tamperCount).toBe(1);
  });

  it('rejects transition if only attachments were tampered with', () => {
    const tamperedSnapshot = {
      ...validSnapshot,
      attachments: [] // removed attachment
    };
    const result = validateTransitionGate(fromCertificate(cert), tamperedSnapshot, info(cert));
    expect(result.isValid).toBe(false);
    expect(result.errorMessage).toContain('attachments');
  });

  it('rejects transition if seal was previously compromised (tamper-then-revert)', () => {
    const compromisedCert = {
      ...cert,
      isCompromised: true,
      tamperHistory: [
        {
          detectedAt: '2026-10-28T12:05:00Z',
          alteredFields: ['Summary'],
          liveHash: 'abc',
          sealedHash: cert.snapshotHash,
          incidentType: 'ACTIVE_TAMPER' as const
        }
      ]
    };
    const result = validateTransitionGate(fromCertificate(compromisedCert), validSnapshot, info(compromisedCert));
    expect(result.isValid).toBe(false);
    expect(result.errorMessage).toContain('reverted');
  });

  it('permits transition if certificate is active and ticket is untampered', () => {
    const result = validateTransitionGate(fromCertificate(cert), validSnapshot, info(cert));
    expect(result.isValid).toBe(true);
    expect(result.details?.certificateId).toBe(cert.certificateId);
    expect(result.details?.signerName).toBe(cert.sealedBy.signerDisplayName);
  });
});
