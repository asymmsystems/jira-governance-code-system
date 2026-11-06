/**
 * Copyright (c) 2026 Asymm Systems. All rights reserved.
 *
 * LedgerSeal: Domain Data Models and Contracts
 *
 * @author Fahim Farook
 */

import { LedgerSealRoleTypeId, LedgerSealStatusId, TransitionName } from './status';

export interface CanonicalField {
  id: string;
  name: string;
  type: string;
  value: any;
  /** Display text for the change list (not hashed). */
  display?: string;
}

export interface CanonicalAttachment {
  id: string;
  filename: string;
  size: number;
  mimeType?: string;
  created: string;
  authorAccountId: string;
}

export interface CanonicalComment {
  id: string;
  authorAccountId: string;
  /** Canonical value of the comment body (spec v2 section 4.4). */
  body: unknown;
  created: string;
}

export interface CanonicalIssueSnapshot {
  /** Version of the canonical form (spec v2 section 4). Absent on v1 snapshots. */
  canonicalizerVersion?: string;
  issueId: string;
  issueKey: string;
  /** Hashed project and issue type ids. projectKey and issueType are display text. */
  projectId?: string;
  projectKey: string;
  issueTypeId?: string;
  issueType: string;
  status: string;
  fields: CanonicalField[];
  attachments: CanonicalAttachment[];
  comments?: CanonicalComment[];
  /** Fields with a value that the seal does not cover, and why (not hashed). */
  excluded?: { id: string; name: string; reason: string }[];
  capturedAt: string;
}

export interface ElectronicSignature {
  signerAccountId: string;
  signerDisplayName: string;
  signerEmail?: string;
  signedAt: string;
  meaning: string;
  reasonCode: 'APPROVAL' | 'REVIEW' | 'VERIFICATION' | 'RELEASE_GATE';
  declarationText: string;
}

export interface TamperIncident {
  detectedAt: string;
  alteredFields: string[];
  liveHash: string;
  sealedHash: string;
  incidentType: 'ACTIVE_TAMPER' | 'TAMPER_THEN_REVERT';
  summary?: string;
}

export interface SealCertificate {
  certificateId: string;
  issueId: string;
  issueKey: string;
  snapshotHash: string;
  certificateHash: string;
  algorithm: 'SHA-256';
  schemaVersion: '1.0';
  sealedAt: string;
  sealedBy: ElectronicSignature;
  snapshot: CanonicalIssueSnapshot;
  status: 'ACTIVE' | 'SUPERSEDED' | 'REVOKED';
  isCompromised?: boolean;
  tamperHistory?: TamperIncident[];
  revocation?: {
    revokedAt: string;
    revokedByAccountId: string;
    revocationReason: string;
  };
}

export interface FieldDiff {
  fieldId: string;
  fieldName: string;
  sealedValue: any;
  liveValue: any;
  /** Set on panel responses when the display text was cut (spec v2 section 3.4). */
  sealedTruncated?: boolean;
  liveTruncated?: boolean;
  /** Set on panel responses: the value is longer than 200 characters, so the panel collapses it. */
  sealedLong?: boolean;
  liveLong?: boolean;
  /** Set on panel responses: which rich text blocks changed. */
  detail?: string;
  /** Set on panel responses: who changed the item after the seal, and when (from the change log or the comment). */
  changedBy?: string[];
  /** How many of the people who changed the item have closed accounts (ADR-010). */
  changedByClosed?: number;
  changedAt?: string | null;
}

export interface AttachmentDiff {
  type: 'ADDED' | 'REMOVED' | 'MODIFIED';
  attachmentId: string;
  filename: string;
}

export type TamperStatus = 'SEAL_VALID' | 'SEAL_BROKEN' | 'SEAL_COMPROMISED' | 'NO_SEAL' | 'SEAL_REVOKED' | 'LEGACY' | 'RECORD_INVALID' | 'ERROR';

/**
 * Who may approve, besides project admins and Jira admins: group parties in the LS_APPROVER role
 * (Silverston PartyRole, ADR-01). Set by a Jira admin on the admin page; names come from Jira, not the payload.
 */
export interface ApproverPolicy {
  roleTypeId: 'LS_APPROVER';
  parties: { partyId: string; partyTypeId: 'GROUP'; name: string }[];
  fromDate: string;
  setByPartyId: string;
}

export interface ViewerRights {
  canSeal: boolean;
  canApproveChanges: boolean;
  canRevoke: boolean;
  blockedBySelfChange: boolean;
}

/** What the panel may know about a v2 seal (no snapshot, no email). */
export interface SealSummary {
  certificateId: string;
  state: 'ACTIVE' | 'REVOKED';
  sealedAt: string;
  /** The signer's account id; empty when the account was closed (then `sealedByClosed`). */
  sealedByAccountId: string;
  sealedByClosed?: boolean;
  meaning: string;
  reason: string | null;
  declarationVersion: string;
  snapshotHash: string;
  canonicalizerVersion: string;
  everCompromised: boolean;
  incidentCount: number;
  revocation: { revokedAt: string; revokedByAccountId: string; revokedByClosed?: boolean; reason: string } | null;
  historyLength: number;
}

export interface TamperAnalysis {
  status: TamperStatus;
  certificate?: SealCertificate;
  seal?: SealSummary;
  errorReason?: 'JIRA_UNREACHABLE' | 'STORAGE';
  /** Panel response only: the covered and excluded fields of the seal, and what the viewer may do. */
  coveredFields?: { id: string; name: string }[];
  excludedFields?: { id: string; name: string; reason: string }[];
  rights?: ViewerRights;
  /** Names of the approver groups, for the "who can seal" text. */
  approverGroups?: string[];
  liveHash?: string;
  sealedHash?: string;
  tamperedFields: FieldDiff[];
  tamperedAttachments: AttachmentDiff[];
  verifiedAt: string;
  isCompromised?: boolean;
  tamperHistory?: TamperIncident[];
  compromiseReason?: string;
}

/**
 * The sealed Jira issue as a Silverston WorkEffort (spec v2 section 3.2, ADR-01). One per issue.
 * Jira-owned issue fields are not stored; only LedgerSeal's own facts are.
 */
export interface SealedWorkEffort {
  schemaVersion: 3;
  workEffortId: string;
  workEffortTypeId: 'JIRA_ISSUE';
  sourceReferenceId: string;
  currentStatusId: LedgerSealStatusId;
  lastStatusUpdate: string;
  revisionNumber: number;
  statusHead: { seq: number; entryHash: string };
  currentAssignment: {
    partyId: string;
    roleTypeId: LedgerSealRoleTypeId;
    fromDate: string;
    assignmentHash: string;
    sealingSeq: number;
    sealingEntryHash: string;
  };
  currentContentId: string;
  attributes: {
    snapshotHash: string;
    canonicalizerVersion: string;
    declarationVersion: string;
    statusAtSeal: string;
    snapshotParts: number;
    /** Set by the redaction event of ADR-010 decision 7: an older-version record whose people are party tokens. */
    parties?: 'TOKEN';
  };
  everCompromised: boolean;
  incidentCount: number;
  lastIncidentHash: string | null;
  recordHash: string;
}

/** One seal: the party, the role (the meaning) and the time window (Silverston WorkEffortPartyAssignment). */
export interface WorkEffortPartyAssignment {
  workEffortId: string;
  partyId: string;
  roleTypeId: LedgerSealRoleTypeId;
  fromDate: string;
  thruDate: string | null;
  comments: string | null;
  contentId: string;
  declaration: { version: string; text: string };
}

/** One state change, created once (Silverston WorkEffortStatus with the LedgerSeal hash chain). */
export interface WorkEffortStatus {
  workEffortId: string;
  statusId: LedgerSealStatusId;
  statusDatetime: string;
  setByPartyId: string | null;
  reason: string | null;
  transitionName: TransitionName;
  seq: number;
  data: Record<string, unknown>;
  prevEntryHash: string;
  entryHash: string;
}

export interface WorkflowTransitionValidationResult {
  isValid: boolean;
  errorMessage?: string;
  details?: {
    certificateId?: string;
    sealedAt?: string;
    tamperCount?: number;
  };
}
