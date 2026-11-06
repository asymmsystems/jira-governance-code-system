/**
 * Copyright (c) 2026 Asymm Systems. All rights reserved.
 *
 * @author Fahim Farook
 */

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
    expect(result.errorMessage).toContain('this issue is not sealed');
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
    expect(result.errorMessage).toContain('reason: not given');
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
    expect(result.errorMessage).toContain('1 field changed after approval (Summary)');
    expect(result.details?.tamperCount).toBe(1);
  });

  it('rejects transition if only attachments were tampered with', () => {
    const tamperedSnapshot = {
      ...validSnapshot,
      attachments: [] // removed attachment
    };
    const result = validateTransitionGate(fromCertificate(cert), tamperedSnapshot, info(cert));
    expect(result.isValid).toBe(false);
    expect(result.errorMessage).toContain('(Attachments)');
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
    expect(result.errorMessage).toContain('was changed back');
  });

  it('permits transition if certificate is active and ticket is untampered', () => {
    const result = validateTransitionGate(fromCertificate(cert), validSnapshot, info(cert));
    expect(result.isValid).toBe(true);
    expect(result.details?.certificateId).toBe(cert.certificateId);
    expect(result.details?.signerName).toBe(cert.sealedBy.signerDisplayName);
  });
});

describe('Validator message sizes', () => {
  const { changedItemsMessage } = require('../src/validator/workflow-validator');

  it('names at most five items, counts the rest, and stays under 250 characters', () => {
    const names = ['Summary', 'Description', 'Due Date', 'Priority', 'Labels', 'Fix Versions', 'Approved budget for the Q4 rollout'];
    const message = changedItemsMessage(names);
    expect(message).toBe(
      'LedgerSeal: 7 fields changed after approval (Summary, Description, Due Date, Priority, Labels, and 2 more). Ask a project admin who did not make the change to approve it in the LedgerSeal panel.'
    );
    expect(message.length).toBeLessThanOrEqual(250);
    expect(changedItemsMessage(['Summary', 'Labels'])).toContain('2 fields changed after approval (Summary, Labels)');
  });

  it('omits the date of a revoke when it is not known', () => {
    const live = { issueId: '1', issueKey: 'X-1', projectKey: 'X', issueType: 'T', status: 'S', fields: [], attachments: [], capturedAt: 't' };
    const result = validateTransitionGate({ snapshotHash: 'x', snapshot: live, revoked: true, compromised: false }, live, { revocationReason: 'withdrawn' });
    expect(result.errorMessage).toBe('LedgerSeal: the seal was revoked (reason: withdrawn). Seal it again to continue.');
  });
});
