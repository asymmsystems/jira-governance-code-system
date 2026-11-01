/**
 * Copyright (c) 2026 Asymm Systems. All rights reserved.
 *
 * LedgerSeal: hash-chained seal history (spec v2 section 3.3).
 * Each entry holds the hash of the entry before it, so a changed or removed entry breaks the chain.
 *
 * @author Fahim Farook
 */

import { hashWithout } from './canonical-json';
import { HistoryEntry, HistoryEntryType } from './models';

export const GENESIS_HASH = '0'.repeat(64);

export interface ChainHead {
  seq: number;
  entryHash: string;
}

export function buildEntry(
  prev: ChainHead | null,
  fields: { type: HistoryEntryType; at: string; actorAccountId: string | null; certificateId: string; data: Record<string, unknown> }
): HistoryEntry {
  const draft = {
    seq: (prev?.seq ?? 0) + 1,
    ...fields,
    prevEntryHash: prev?.entryHash ?? GENESIS_HASH,
    entryHash: ''
  };
  return { ...draft, entryHash: hashWithout(draft, 'entryHash') };
}

export interface ChainCheck {
  valid: boolean;
  firstInvalidSeq: number | null;
}

/**
 * Checks consecutive entries, oldest first. `before` is the hash the first entry must point to
 * (GENESIS_HASH when the list starts at seq 1). `head`, when given, must match the last entry.
 */
export function verifyChain(entries: HistoryEntry[], before: string = GENESIS_HASH, head?: ChainHead): ChainCheck {
  let expectedPrev = before;
  let expectedSeq = entries.length > 0 ? entries[0].seq : 0;
  for (const entry of entries) {
    if (entry.seq !== expectedSeq || entry.prevEntryHash !== expectedPrev || hashWithout(entry, 'entryHash') !== entry.entryHash) {
      return { valid: false, firstInvalidSeq: entry.seq };
    }
    expectedPrev = entry.entryHash;
    expectedSeq++;
  }
  if (head && entries.length > 0) {
    const last = entries[entries.length - 1];
    if (last.seq === head.seq && last.entryHash !== head.entryHash) return { valid: false, firstInvalidSeq: last.seq };
  }
  return { valid: true, firstInvalidSeq: null };
}
