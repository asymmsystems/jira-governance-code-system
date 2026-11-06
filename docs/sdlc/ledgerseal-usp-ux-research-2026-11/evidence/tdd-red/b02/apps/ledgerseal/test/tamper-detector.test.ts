import { analyzeTamperState } from '../src/domain/tamper-detector';
import { generateSealCertificate } from '../src/domain/crypto';
import { CanonicalIssueSnapshot, ElectronicSignature } from '../src/domain/models';

describe('Tamper Detector', () => {
  const baseSnapshot: CanonicalIssueSnapshot = {
    issueId: '10001',
    issueKey: 'OPS-202',
    projectKey: 'OPS',
    issueType: 'Task',
    status: 'Ready for Prod',
    fields: [
      { id: 'summary', name: 'Summary', type: 'string', value: 'Rotate database credentials' },
      { id: 'customfield_10014', name: 'Scope', type: 'string', value: 'Production Azure SQL' }
    ],
    attachments: [
      { id: 'att-1', filename: 'runbook.md', size: 1024, created: '2026-10-28T10:00:00Z', authorAccountId: 'acc-1' }
    ],
    capturedAt: '2026-10-28T12:00:00Z'
  };

  const sampleSig: ElectronicSignature = {
    signerAccountId: 'acc-1',
    signerDisplayName: 'Lead DevOps Engineer',
    signedAt: '2026-10-28T12:01:00Z',
    meaning: 'Approved for execution',
    reasonCode: 'APPROVAL',
    declarationText: 'Execution runbook verified.'
  };

  const cert = generateSealCertificate(baseSnapshot, sampleSig);

  it('reports SEAL_VALID when live issue snapshot is identical to sealed state', () => {
    const analysis = analyzeTamperState(cert, baseSnapshot, '2026-10-28T12:05:00Z');
    expect(analysis.status).toBe('SEAL_VALID');
    expect(analysis.tamperedFields).toHaveLength(0);
    expect(analysis.tamperedAttachments).toHaveLength(0);
  });

  it('reports NO_SEAL when no certificate is provided', () => {
    const analysis = analyzeTamperState(null, baseSnapshot, '2026-10-28T12:05:00Z');
    expect(analysis.status).toBe('NO_SEAL');
  });

  it('reports SEAL_REVOKED when certificate status is REVOKED', () => {
    const revokedCert = { ...cert, status: 'REVOKED' as const };
    const analysis = analyzeTamperState(revokedCert, baseSnapshot, '2026-10-28T12:05:00Z');
    expect(analysis.status).toBe('SEAL_REVOKED');
  });

  it('detects modified fields and returns exact field diffs', () => {
    const tamperedSnapshot: CanonicalIssueSnapshot = {
      ...baseSnapshot,
      fields: [
        { id: 'summary', name: 'Summary', type: 'string', value: 'Rotate database credentials AND DROP DATABASE' },
        { id: 'customfield_10014', name: 'Scope', type: 'string', value: 'Production Azure SQL' }
      ]
    };

    const analysis = analyzeTamperState(cert, tamperedSnapshot, '2026-10-28T12:05:00Z');
    expect(analysis.status).toBe('SEAL_BROKEN');
    expect(analysis.tamperedFields).toHaveLength(1);
    expect(analysis.tamperedFields[0]).toEqual({
      fieldId: 'summary',
      fieldName: 'Summary',
      sealedValue: 'Rotate database credentials',
      liveValue: 'Rotate database credentials AND DROP DATABASE'
    });
  });

  it('detects brand new fields added to live issue', () => {
    const tamperedSnapshot: CanonicalIssueSnapshot = {
      ...baseSnapshot,
      fields: [
        ...baseSnapshot.fields,
        { id: 'customfield_new', name: 'NewField', type: 'string', value: 'Unauthorized value' }
      ]
    };

    const analysis = analyzeTamperState(cert, tamperedSnapshot, '2026-10-28T12:05:00Z');
    expect(analysis.status).toBe('SEAL_BROKEN');
    expect(analysis.tamperedFields.some(f => f.fieldId === 'customfield_new')).toBe(true);
  });

  it('detects added, removed, or modified attachments', () => {
    const tamperedSnapshot: CanonicalIssueSnapshot = {
      ...baseSnapshot,
      attachments: [
        { id: 'att-1', filename: 'runbook.md', size: 2048, created: '2026-10-28T10:00:00Z', authorAccountId: 'acc-1' }, // size changed
        { id: 'att-2', filename: 'malicious.sh', size: 128, created: '2026-10-28T12:04:00Z', authorAccountId: 'acc-2' }  // added
      ]
    };

    const analysis = analyzeTamperState(cert, tamperedSnapshot, '2026-10-28T12:05:00Z');
    expect(analysis.status).toBe('SEAL_BROKEN');
    expect(analysis.tamperedAttachments).toEqual([
      { type: 'MODIFIED', attachmentId: 'att-1', filename: 'runbook.md' },
      { type: 'ADDED', attachmentId: 'att-2', filename: 'malicious.sh' }
    ]);
  });

  it('detects when an attachment has been removed', () => {
    const tamperedSnapshot: CanonicalIssueSnapshot = {
      ...baseSnapshot,
      attachments: []
    };

    const analysis = analyzeTamperState(cert, tamperedSnapshot, '2026-10-28T12:05:00Z');
    expect(analysis.status).toBe('SEAL_BROKEN');
    expect(analysis.tamperedAttachments).toEqual([
      { type: 'REMOVED', attachmentId: 'att-1', filename: 'runbook.md' }
    ]);
  });

  it('detects added fields in live snapshot', () => {
    const tamperedSnapshot: CanonicalIssueSnapshot = {
      ...baseSnapshot,
      fields: [
        ...baseSnapshot.fields,
        { id: 'labels', name: 'Labels', type: 'array', value: ['urgent'] }
      ]
    };
    const analysis = analyzeTamperState(cert, tamperedSnapshot, '2026-10-28T12:05:00Z');
    expect(analysis.status).toBe('SEAL_BROKEN');
    expect(analysis.tamperedFields.some(f => f.fieldId === 'labels')).toBe(true);
  });

  it('detects non-monotonic tamper when content is reverted (SEAL_COMPROMISED)', () => {
    const compromisedCert = {
      ...cert,
      isCompromised: true,
      tamperHistory: [
        {
          detectedAt: '2026-10-28T12:03:00Z',
          alteredFields: ['Summary'],
          liveHash: 'some-hash',
          sealedHash: cert.snapshotHash,
          incidentType: 'ACTIVE_TAMPER' as const
        }
      ]
    };

    // Live snapshot is identical to original, but cert was previously compromised
    const analysis = analyzeTamperState(compromisedCert, baseSnapshot, '2026-10-28T12:05:00Z');
    expect(analysis.status).toBe('SEAL_COMPROMISED');
    expect(analysis.isCompromised).toBe(true);
    expect(analysis.compromiseReason).toContain('reverted');

    // Also test when isCompromised is false but tamperHistory exists
    const certWithHistoryOnly = {
      ...cert,
      isCompromised: false,
      tamperHistory: compromisedCert.tamperHistory
    };
    const analysis2 = analyzeTamperState(certWithHistoryOnly, baseSnapshot, '2026-10-28T12:05:00Z');
    expect(analysis2.status).toBe('SEAL_COMPROMISED');
  });

  it('detects comment changes as tamper', () => {
    const certWithComments = generateSealCertificate(
      {
        ...baseSnapshot,
        comments: [
          { id: 'c-1', authorAccountId: 'acc-1', body: 'Original comment', created: '2026-10-28T10:00:00Z' }
        ]
      },
      sampleSig
    );

    const liveWithDifferentComment: CanonicalIssueSnapshot = {
      ...baseSnapshot,
      comments: [
        { id: 'c-1', authorAccountId: 'acc-1', body: 'Modified comment', created: '2026-10-28T10:00:00Z' }
      ]
    };

    const analysis = analyzeTamperState(certWithComments, liveWithDifferentComment, '2026-10-28T12:05:00Z');
    expect(analysis.status).toBe('SEAL_BROKEN');
    expect(analysis.tamperedFields.some(f => f.fieldId === 'comment')).toBe(true);
  });
});
