/**
 * Copyright (c) 2026 Asymm Systems. All rights reserved.
 *
 * LedgerSeal: v2 seal record helpers.
 *
 * @author Fahim Farook
 */

import { hashWithout } from './canonical-json';
import { SealRecord, SealSummary } from './models';

/** Returns the record with `recordHash` set to the SHA-256 of its other fields. */
export function withRecordHash(record: Omit<SealRecord, 'recordHash'> & { recordHash?: string }): SealRecord {
  const draft = { ...record, recordHash: '' } as SealRecord;
  return { ...draft, recordHash: hashWithout(draft, 'recordHash') };
}

/** True when `recordHash` matches the record's other fields. */
export function hasValidRecordHash(record: SealRecord): boolean {
  return typeof record.recordHash === 'string' && hashWithout(record, 'recordHash') === record.recordHash;
}

/** The seal facts the panel may show. It holds no snapshot and no email. */
export function summarise(record: SealRecord): SealSummary {
  return {
    certificateId: record.certificateId,
    state: record.state,
    sealedAt: record.sealedAt,
    sealedByAccountId: record.sealedBy.accountId,
    sealedByName: record.sealedBy.displayName,
    meaning: record.meaning,
    reason: record.reason,
    declarationVersion: record.declaration.version,
    snapshotHash: record.snapshotHash,
    canonicalizerVersion: record.canonicalizerVersion,
    everCompromised: record.everCompromised,
    incidentCount: record.incidentCount,
    revocation: record.revocation,
    historyLength: record.head.seq
  };
}
