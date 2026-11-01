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

export function matchesDeclaration(version: unknown, text: unknown): boolean {
  return version === DECLARATION.version && text === DECLARATION.text;
}

/** A trimmed reason of 1 to 500 characters, or null. */
export function validReason(value: unknown): string | null {
  const reason = typeof value === 'string' ? value.trim() : '';
  return reason.length > 0 && reason.length <= REASON_MAX ? reason : null;
}
