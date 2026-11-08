/**
 * Copyright (c) 2026 Asymm Systems. All rights reserved.
 *
 * LedgerSeal: the seal declaration and the signature meanings (spec v2 section 10).
 * This is the only copy. The panel shows it and the seal record stores it, so the two cannot differ.
 * A new text needs a new version; old records keep theirs.
 *
 * @author Fahim Farook
 */

export const DECLARATION = {
  version: '1',
  text: 'I approve this issue as it is now. I agree that this seal records my approval of its covered fields, comments and attachments.'
} as const;

/**
 * Declaration version 2, for code-signing projects (ADR-016 decision 11). Approved by the owner on 2026-11-08 (Q-03,
 * option A, with the second sentence replaced: under section 11.100(c) of the FDA rule the customer organisation certifies that
 * its staff's electronic signatures are legally binding, so the text states the signer's understanding of that, and
 * the app does not assert it). The `approved` gate stays: a future version ships with `approved: false` until approved.
 */
export const DECLARATION_V2: { version: string; text: string; approved: boolean } = {
  version: '2',
  text:
    'I am signing this record electronically. I understand that my organisation treats this electronic signature as the legally binding equivalent of my handwritten signature. ' +
    'I approve this issue as it is now, with the meaning shown above, and I agree that this signature records my approval of its covered fields, comments and attachments.',
  approved: true
};

/**
 * The rejection declaration for code-signing projects, `reject/1`. Approved by the owner on 2026-11-08 (review round 3,
 * D-5): a rejection records a rejection, not the approval text (section 11.50 of the FDA rule: the meaning of each
 * signature).
 */
export const DECLARATION_REJECT: { version: string; text: string; approved: boolean } = {
  version: '1',
  text:
    'I am signing this record electronically. I understand that my organisation treats this electronic signature as the legally binding equivalent of my handwritten signature. ' +
    'I reject this issue as it is now, for the reason I give, and I agree that this signature records my rejection.',
  approved: true
};

/** The revoke declaration for code-signing projects, `revoke/1`. Approved by the owner on 2026-11-08 (D-5). */
export const DECLARATION_REVOKE: { version: string; text: string; approved: boolean } = {
  version: '1',
  text:
    'I am signing this record electronically. I understand that my organisation treats this electronic signature as the legally binding equivalent of my handwritten signature. ' +
    'I withdraw the approval seal on this issue, for the reason I give, and I agree that this signature records the withdrawal.',
  approved: true
};

/** True once the owner approved every code-signing declaration: approval version 2 (Q-03), rejection and revoke (D-5). */
export function isDeclarationV2Approved(): boolean {
  return DECLARATION_V2.approved === true && DECLARATION_REJECT.approved === true && DECLARATION_REVOKE.approved === true;
}

/** What a signature states: approval (seal, approval of changes, stage signature), rejection, or the withdrawal of a seal. */
export type DeclarationKind = 'approve' | 'reject' | 'revoke';

export interface Declaration {
  id: DeclarationKind;
  version: string;
  text: string;
}

/**
 * The declaration a signing shows and records for its own action (D-5). In a code-signing project: `approve/2`,
 * `reject/1` or `revoke/1`. Elsewhere only an approval has one (`approve/1`); a rejection and a revoke have none.
 */
export function declarationForAction(kind: DeclarationKind, part11: boolean): Declaration | null {
  if (kind === 'approve') return { id: 'approve', ...declarationFor(part11) };
  if (!part11) return null;
  const d = kind === 'reject' ? DECLARATION_REJECT : DECLARATION_REVOKE;
  return { id: kind, version: d.version, text: d.text };
}

/** True when the payload's signature agrees to exactly this declaration (an id, when given, must match too). */
export function agreesTo(signature: any, d: Declaration): boolean {
  if (signature?.declarationId !== undefined && signature.declarationId !== d.id) return false;
  return signature?.declarationVersion === d.version && signature?.declarationText === d.text;
}

/** The declaration the form shows: version 2 in a code-signing project, version 1 elsewhere. */
export function declarationFor(part11: boolean): { version: string; text: string } {
  return part11 ? { version: DECLARATION_V2.version, text: DECLARATION_V2.text } : { version: DECLARATION.version, text: DECLARATION.text };
}

export const MEANINGS = [
  { value: 'APPROVAL', label: 'Approved' },
  { value: 'REVIEW', label: 'Reviewed' },
  { value: 'VERIFICATION', label: 'Verified' }
] as const;

export type Meaning = (typeof MEANINGS)[number]['value'];

export const REASON_MAX = 500;

export function isMeaning(value: unknown): value is Meaning {
  return MEANINGS.some(m => m.value === value);
}

/** A trimmed reason of 1 to 500 characters, or null. */
export function validReason(value: unknown): string | null {
  const reason = typeof value === 'string' ? value.trim() : '';
  return reason.length > 0 && reason.length <= REASON_MAX ? reason : null;
}

/** Every declaration the app has shown, by `id/version` (the evidence's `declarations` map). */
export function declarationTexts(): Record<string, string> {
  return {
    [`approve/${DECLARATION.version}`]: DECLARATION.text,
    [`approve/${DECLARATION_V2.version}`]: DECLARATION_V2.text,
    [`reject/${DECLARATION_REJECT.version}`]: DECLARATION_REJECT.text,
    [`revoke/${DECLARATION_REVOKE.version}`]: DECLARATION_REVOKE.text
  };
}

/** The `declarations` key of a row: its declaration id (rows written before ids were approvals) and version. */
export function declarationKey(data: any): string {
  return `${typeof data?.declarationId === 'string' ? data.declarationId : 'approve'}/${String(data?.declarationVersion)}`;
}
