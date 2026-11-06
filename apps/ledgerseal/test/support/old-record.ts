/**
 * Copyright (c) 2026 Asymm Systems. All rights reserved.
 *
 * Test support: writes a seal record the way LedgerSeal wrote it before ADR-011 (canonical form 2.1.0, account
 * ids and the signer's display name in hashed data), to test the conversion of existing records.
 *
 * @author Fahim Farook
 */

import { canonicalizeIssueState } from '../../src/domain/canonicalizer';
import { computeSnapshotHash } from '../../src/domain/crypto';
import { DECLARATION } from '../../src/domain/declaration';
import { buildStatusRow } from '../../src/domain/history';
import { assignmentHash, withRecordHash } from '../../src/domain/seal-record';
import { MemoryStore } from './fakes';

const pad = (seq: number) => String(seq).padStart(6, '0');

export interface OldRecordOptions {
  issueId?: string;
  signer?: string;
  signerName?: string;
  sealedAt?: string;
  certificateId?: string;
  fields?: any[];
  /** When set, the record has a change incident by this account, made to the given issue state. */
  changedTo?: { issue: any; by: string; at: string };
}

/** Writes a pre-ADR-011 record of `issue` and returns its parts. */
export async function writeOldRecord(storage: MemoryStore, issue: any, options: OldRecordOptions = {}) {
  const issueId = options.issueId ?? String(issue.id);
  const signer = options.signer ?? 'ann';
  const sealedAt = options.sealedAt ?? '2026-10-01T00:00:00.000Z';
  const certificateId = options.certificateId ?? '11111111-1111-4111-8111-111111111111';
  const fields = options.fields ?? [];
  const snapshot = canonicalizeIssueState(issue, sealedAt, fields, '2.1.0');
  const snapshotHash = computeSnapshotHash(snapshot);
  const sealing = buildStatusRow(null, {
    workEffortId: issueId,
    statusId: 'LS_SEALED',
    statusDatetime: sealedAt,
    setByPartyId: signer,
    reason: null,
    transitionName: 'SEAL',
    data: { certificateId, snapshotHash, meaning: 'APPROVAL', declarationVersion: '1', signerName: options.signerName ?? 'Ann Approver', previousCertificateId: null, previousState: null }
  });
  const assignment = {
    workEffortId: issueId,
    partyId: signer,
    roleTypeId: 'LS_APPROVER' as const,
    fromDate: sealedAt,
    thruDate: null,
    comments: null,
    contentId: certificateId,
    declaration: { version: DECLARATION.version, text: DECLARATION.text }
  };
  let head = { seq: sealing.seq, entryHash: sealing.entryHash };
  let status: 'LS_SEALED' | 'LS_CHANGED' = 'LS_SEALED';
  let lastIncidentHash: string | null = null;
  let incidentCount = 0;
  storage.map.set(`ls3:wes:${issueId}:${pad(1)}`, sealing);
  if (options.changedTo) {
    const liveHash = computeSnapshotHash(canonicalizeIssueState(options.changedTo.issue, options.changedTo.at, fields, '2.1.0'));
    const incident = buildStatusRow(head, {
      workEffortId: issueId,
      statusId: 'LS_CHANGED',
      statusDatetime: options.changedTo.at,
      setByPartyId: null,
      reason: null,
      transitionName: 'CHANGE',
      data: { liveHash, certificateId, changes: [{ fieldId: 'summary', fieldName: 'Summary', changedBy: [options.changedTo.by], changedAt: options.changedTo.at }], attachmentChanges: 0 }
    });
    storage.map.set(`ls3:wes:${issueId}:${pad(2)}`, incident);
    head = { seq: incident.seq, entryHash: incident.entryHash };
    status = 'LS_CHANGED';
    lastIncidentHash = liveHash;
    incidentCount = 1;
  }
  const we = withRecordHash({
    schemaVersion: 3,
    workEffortId: issueId,
    workEffortTypeId: 'JIRA_ISSUE',
    sourceReferenceId: String(issue.key),
    currentStatusId: status,
    lastStatusUpdate: sealedAt,
    revisionNumber: head.seq,
    statusHead: head,
    currentAssignment: { partyId: signer, roleTypeId: 'LS_APPROVER', fromDate: sealedAt, assignmentHash: assignmentHash(assignment), sealingSeq: 1, sealingEntryHash: sealing.entryHash },
    currentContentId: certificateId,
    attributes: { snapshotHash, canonicalizerVersion: '2.1.0', declarationVersion: '1', statusAtSeal: snapshot.status, snapshotParts: 1 },
    everCompromised: incidentCount > 0,
    incidentCount,
    lastIncidentHash
  });
  storage.map.set(`ls3:wepa:${issueId}:${sealedAt}`, assignment);
  storage.map.set(`ls3:content:${certificateId}:0`, JSON.stringify(snapshot));
  storage.map.set(`ls3:we:${issueId}`, we);
  return { we, sealing, assignment, snapshot };
}
