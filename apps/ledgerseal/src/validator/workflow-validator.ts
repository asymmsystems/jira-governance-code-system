/**
 * LedgerSeal: Jira Workflow Transition Validator Gate
 * Blocks issue transitions if issue is unsealed, certificate is revoked, or seal is broken.
 */

import { CanonicalIssueSnapshot, SealCertificate, WorkflowTransitionValidationResult } from '../domain/models';
import { analyzeTamperState } from '../domain/tamper-detector';

/**
 * Validates transition gate against active certificate and live snapshot.
 */
export function validateTransitionGate(
  certificate: SealCertificate | null,
  liveSnapshot: CanonicalIssueSnapshot
): WorkflowTransitionValidationResult {
  const now = new Date().toISOString();
  const analysis = analyzeTamperState(certificate, liveSnapshot, now);

  if (analysis.status === 'NO_SEAL') {
    return {
      isValid: false,
      errorMessage: 'This issue must be cryptographically sealed with an authorized electronic signature before this transition is permitted.'
    };
  }

  if (analysis.status === 'SEAL_REVOKED') {
    return {
      isValid: false,
      errorMessage: `The seal certificate for this issue has been revoked (Reason: ${certificate?.revocation?.revocationReason || 'Unspecified'}). Resealing is required.`
    };
  }

  if (analysis.status === 'SEAL_BROKEN') {
    const totalTampered = analysis.tamperedFields.length + analysis.tamperedAttachments.length;
    const fieldNames = analysis.tamperedFields.map(f => f.fieldName).join(', ');
    return {
      isValid: false,
      errorMessage: `Cryptographic seal broken! ${totalTampered} item(s) modified after sign-off (${fieldNames || 'attachments'}). Re-authorization required.`,
      details: {
        certificateId: certificate?.certificateId,
        sealedAt: certificate?.sealedAt,
        signerName: certificate?.sealedBy.signerDisplayName,
        tamperCount: totalTampered
      }
    };
  }

  if (analysis.status === 'SEAL_COMPROMISED') {
    return {
      isValid: false,
      errorMessage:
        analysis.compromiseReason ||
        'Cryptographic seal broken! Issue was modified after sign-off and reverted. Re-authorization required.',
      details: {
        certificateId: certificate?.certificateId,
        sealedAt: certificate?.sealedAt,
        signerName: certificate?.sealedBy.signerDisplayName,
        tamperCount: 1
      }
    };
  }

  return {
    isValid: true,
    details: {
      certificateId: certificate?.certificateId,
      sealedAt: certificate?.sealedAt,
      signerName: certificate?.sealedBy.signerDisplayName,
      tamperCount: 0
    }
  };
}
