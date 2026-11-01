/**
 * LedgerSeal: Jira Workflow Transition Validator Gate
 * Blocks issue transitions if issue is unsealed, certificate is revoked, or seal is broken.
 */

import { CanonicalIssueSnapshot, WorkflowTransitionValidationResult } from '../domain/models';
import { compareToSeal, SealedState } from '../domain/tamper-detector';

/** Seal facts that the validator messages name. */
export interface SealInfo {
  certificateId?: string;
  sealedAt?: string;
  signerName?: string;
  revocationReason?: string;
}

/**
 * Validates transition gate against active certificate and live snapshot.
 */
export function validateTransitionGate(
  sealed: SealedState | null,
  liveSnapshot: CanonicalIssueSnapshot,
  info: SealInfo = {}
): WorkflowTransitionValidationResult {
  const now = new Date().toISOString();
  const analysis = compareToSeal(sealed, liveSnapshot, now);

  if (analysis.status === 'NO_SEAL') {
    return {
      isValid: false,
      errorMessage: 'This issue must be cryptographically sealed with an authorized electronic signature before this transition is permitted.'
    };
  }

  if (analysis.status === 'SEAL_REVOKED') {
    return {
      isValid: false,
      errorMessage: `The seal certificate for this issue has been revoked (Reason: ${info.revocationReason || 'Unspecified'}). Resealing is required.`
    };
  }

  if (analysis.status === 'SEAL_BROKEN') {
    const totalTampered = analysis.tamperedFields.length + analysis.tamperedAttachments.length;
    const fieldNames = analysis.tamperedFields.map(f => f.fieldName).join(', ');
    return {
      isValid: false,
      errorMessage: `Cryptographic seal broken! ${totalTampered} item(s) modified after sign-off (${fieldNames || 'attachments'}). Re-authorization required.`,
      details: {
        certificateId: info.certificateId,
        sealedAt: info.sealedAt,
        signerName: info.signerName,
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
        certificateId: info.certificateId,
        sealedAt: info.sealedAt,
        signerName: info.signerName,
        tamperCount: 1
      }
    };
  }

  return {
    isValid: true,
    details: {
      certificateId: info.certificateId,
      sealedAt: info.sealedAt,
      signerName: info.signerName,
      tamperCount: 0
    }
  };
}
