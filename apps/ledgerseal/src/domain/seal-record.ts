/**
 * Copyright (c) 2026 Asymm Systems. All rights reserved.
 *
 * LedgerSeal: the stored seal as one unit (the WorkEffort, its current party assignment and the status row
 * that sealed it), its integrity bindings (spec v2 section 3.3) and the panel summary.
 *
 * @author Fahim Farook
 */

import { canonicalJson, hashWithout, sha256Hex } from './canonical-json';
import { hasValidEntryHash } from './history';
import { SealedWorkEffort, SealSummary, WorkEffortPartyAssignment, WorkEffortStatus } from './models';
import { meaningForRole } from './status';

/** A seal as read from storage. */
export interface LoadedSeal {
  workEffort: SealedWorkEffort;
  assignment: WorkEffortPartyAssignment;
  sealingRow: WorkEffortStatus;
  /** The newest status row, read only when the seal is revoked (for the revoke facts). */
  headRow?: WorkEffortStatus;
}

/** Returns the work effort with `recordHash` set to the SHA-256 of its other fields. */
export function withRecordHash(we: Omit<SealedWorkEffort, 'recordHash'> & { recordHash?: string }): SealedWorkEffort {
  const draft = { ...we, recordHash: '' } as SealedWorkEffort;
  return { ...draft, recordHash: hashWithout(draft, 'recordHash') };
}

export function hasValidRecordHash(we: SealedWorkEffort): boolean {
  return typeof we.recordHash === 'string' && hashWithout(we, 'recordHash') === we.recordHash;
}

export function assignmentHash(assignment: WorkEffortPartyAssignment): string {
  return sha256Hex(canonicalJson(assignment));
}

/**
 * True when the work effort, its assignment and its sealing row still match each other and their own hashes.
 * The snapshot hash of the content is checked by the caller, once the content is read.
 */
export function isConsistent(seal: LoadedSeal): boolean {
  const { workEffort: we, assignment, sealingRow } = seal;
  return (
    hasValidRecordHash(we) &&
    assignmentHash(assignment) === we.currentAssignment.assignmentHash &&
    hasValidEntryHash(sealingRow) &&
    sealingRow.entryHash === we.currentAssignment.sealingEntryHash &&
    sealingRow.seq === we.currentAssignment.sealingSeq
  );
}

/** The seal facts the panel may show. It holds no snapshot and no email. */
export function summarise(seal: LoadedSeal): SealSummary {
  const { workEffort: we, assignment, headRow } = seal;
  const revoked = we.currentStatusId === 'LS_REVOKED' && headRow;
  return {
    certificateId: we.currentContentId,
    state: we.currentStatusId === 'LS_REVOKED' ? 'REVOKED' : 'ACTIVE',
    sealedAt: assignment.fromDate,
    sealedByAccountId: assignment.partyId,
    meaning: meaningForRole(assignment.roleTypeId),
    reason: assignment.comments,
    declarationVersion: assignment.declaration.version,
    snapshotHash: we.attributes.snapshotHash,
    canonicalizerVersion: we.attributes.canonicalizerVersion,
    everCompromised: we.everCompromised,
    incidentCount: we.incidentCount,
    revocation: revoked
      ? { revokedAt: headRow.statusDatetime, revokedByAccountId: String(headRow.setByPartyId ?? ''), reason: String(headRow.reason ?? '') }
      : null,
    historyLength: we.revisionNumber
  };
}
