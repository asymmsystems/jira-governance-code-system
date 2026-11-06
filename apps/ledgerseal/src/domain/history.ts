/**
 * Copyright (c) 2026 Asymm Systems. All rights reserved.
 *
 * LedgerSeal: hash-chained status history (spec v2 section 3.2, ADR-01 A-4).
 * Each WorkEffortStatus row holds the hash of the row before it, so a changed or removed row breaks the chain.
 * The chain fields are a LedgerSeal extension of the Silverston pattern.
 *
 * @author Fahim Farook
 */

import { hashWithout } from './canonical-json';
import { WorkEffortStatus } from './models';
import { LedgerSealStatusId, TransitionName } from './status';

export const GENESIS_HASH = '0'.repeat(64);

export interface ChainHead {
  seq: number;
  entryHash: string;
}

export function buildStatusRow(
  prev: ChainHead | null,
  fields: {
    workEffortId: string;
    statusId: LedgerSealStatusId | 'LS_REDACTED';
    statusDatetime: string;
    setByPartyId: string | null;
    reason: string | null;
    transitionName: TransitionName;
    data: Record<string, unknown>;
  }
): WorkEffortStatus {
  const draft: WorkEffortStatus = {
    ...fields,
    seq: (prev?.seq ?? 0) + 1,
    prevEntryHash: prev?.entryHash ?? GENESIS_HASH,
    entryHash: ''
  };
  return { ...draft, entryHash: hashWithout(draft, 'entryHash') };
}

/** True when the row's entryHash matches its other fields. */
export function hasValidEntryHash(row: WorkEffortStatus): boolean {
  return hashWithout(row, 'entryHash') === row.entryHash;
}

export interface ChainCheck {
  valid: boolean;
  firstInvalidSeq: number | null;
}

/**
 * Checks consecutive rows, oldest first. `before` is the hash the first row must point to
 * (GENESIS_HASH when the list starts at seq 1). `head`, when given, must match the last row.
 */
export function verifyChain(rows: WorkEffortStatus[], before: string = GENESIS_HASH, head?: ChainHead): ChainCheck {
  let expectedPrev = before;
  let expectedSeq = rows.length > 0 ? rows[0].seq : 0;
  for (const row of rows) {
    if (row.seq !== expectedSeq || row.prevEntryHash !== expectedPrev || !hasValidEntryHash(row)) {
      return { valid: false, firstInvalidSeq: row.seq };
    }
    expectedPrev = row.entryHash;
    expectedSeq++;
  }
  if (head && rows.length > 0) {
    const last = rows[rows.length - 1];
    if (last.seq === head.seq && last.entryHash !== head.entryHash) return { valid: false, firstInvalidSeq: last.seq };
  }
  return { valid: true, firstInvalidSeq: null };
}
