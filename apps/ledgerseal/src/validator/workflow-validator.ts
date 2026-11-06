/**
 * Copyright (c) 2026 Asymm Systems. All rights reserved.
 *
 * LedgerSeal: Jira Workflow Transition Validator Gate
 * Blocks issue transitions if issue is unsealed, certificate is revoked, or seal is broken.
 *
 * @author Fahim Farook
 */

import { CanonicalIssueSnapshot, WorkflowTransitionValidationResult } from '../domain/models';
import { compareToSeal, SealedState } from '../domain/tamper-detector';

/** Seal facts that the validator messages name. */
export interface SealInfo {
  certificateId?: string;
  sealedAt?: string;
  revocationReason?: string;
  revokedAt?: string;
}

/** Names at most five changed items and counts the rest, so a message stays under 250 characters. */
export function changedItemsMessage(names: string[]): string {
  const shown = names.slice(0, 5).join(', ');
  const rest = names.length > 5 ? `, and ${names.length - 5} more` : '';
  const noun = names.length === 1 ? 'field' : 'fields';
  return `LedgerSeal: ${names.length} ${noun} changed after approval (${shown}${rest}). Ask a project admin who did not make the change to approve it in the LedgerSeal panel.`;
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
      errorMessage:
        'LedgerSeal: this issue is not sealed. To proceed: open the LedgerSeal panel on this issue, select your sign-off role, agree to the declaration, and click "Seal this issue".'
    };
  }

  if (analysis.status === 'SEAL_REVOKED') {
    return {
      isValid: false,
      errorMessage: `LedgerSeal: the seal was revoked${info.revokedAt ? ` on ${info.revokedAt.slice(0, 10)}` : ''} (reason: ${
        info.revocationReason || 'not given'
      }). Seal it again to continue.`
    };
  }

  if (analysis.status === 'SEAL_BROKEN') {
    const totalTampered = analysis.tamperedFields.length + analysis.tamperedAttachments.length;
    const names = analysis.tamperedFields.map(f => f.fieldName);
    if (analysis.tamperedAttachments.length > 0) names.push('Attachments');
    return {
      isValid: false,
      errorMessage: changedItemsMessage(names),
      details: {
        certificateId: info.certificateId,
        sealedAt: info.sealedAt,
        tamperCount: totalTampered
      }
    };
  }

  if (analysis.status === 'SEAL_COMPROMISED') {
    return {
      isValid: false,
      errorMessage:
        'LedgerSeal: this issue changed after approval and was changed back. Ask a project admin to approve it again in the LedgerSeal panel.',
      details: {
        certificateId: info.certificateId,
        sealedAt: info.sealedAt,
        tamperCount: 1
      }
    };
  }

  return {
    isValid: true,
    details: {
      certificateId: info.certificateId,
      sealedAt: info.sealedAt,
      tamperCount: 0
    }
  };
}
