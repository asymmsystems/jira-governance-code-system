/**
 * Copyright (c) 2026 Asymm Systems. All rights reserved.
 *
 * LedgerSeal: the hash of a declaration's text (review round 2, D-1). Kept apart from declaration.ts, which the panel
 * bundle also imports and which therefore uses no Node module.
 *
 * @author Fahim Farook
 */

import { createHash } from 'crypto';

/**
 * The SHA-256 (lowercase hex) of a declaration's exact UTF-8 text. Signature rows chain it with the version, and the
 * evidence carries the texts, so an outside verifier shows what each signer agreed to.
 */
export function declarationHash(text: string): string {
  return createHash('sha256').update(text, 'utf8').digest('hex');
}
