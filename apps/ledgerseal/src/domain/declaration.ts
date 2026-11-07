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
 * Declaration version 2, for code-signing projects (ADR-016 decision 11, owner decision Q-03 of 2026-11-08).
 * DRAFT BY THE DEVELOPER, PENDING THE OWNER'S APPROVAL. While `approved` is false, code signing cannot be turned
 * on and no code-signed signature can be made. The owner approves the text, then a release sets `approved` to true.
 */
export const DECLARATION_V2: { version: string; text: string; approved: boolean } = {
  version: '2',
  text:
    'I am signing this record electronically. My electronic signature is the legally binding equivalent of my handwritten signature. ' +
    'I approve this issue as it is now, with the meaning shown above, and I agree that this signature records my approval of its covered fields, comments and attachments.',
  approved: false
};

/** True once the owner approved declaration version 2 (Q-03). */
export function isDeclarationV2Approved(): boolean {
  return DECLARATION_V2.approved === true;
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
