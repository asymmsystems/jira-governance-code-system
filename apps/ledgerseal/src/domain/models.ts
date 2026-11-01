/**
 * LedgerSeal: Domain Data Models and Contracts
 */

export interface CanonicalField {
  id: string;
  name: string;
  type: string;
  value: any;
}

export interface CanonicalAttachment {
  id: string;
  filename: string;
  size: number;
  created: string;
  authorAccountId: string;
}

export interface CanonicalComment {
  id: string;
  authorAccountId: string;
  body: string;
  created: string;
}

export interface CanonicalIssueSnapshot {
  issueId: string;
  issueKey: string;
  projectKey: string;
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
  reauthConfirmation?: string; // Identity challenge confirmation
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
}

export interface AttachmentDiff {
  type: 'ADDED' | 'REMOVED' | 'MODIFIED';
  attachmentId: string;
  filename: string;
}

export type TamperStatus = 'SEAL_VALID' | 'SEAL_BROKEN' | 'SEAL_COMPROMISED' | 'NO_SEAL' | 'SEAL_REVOKED' | 'LEGACY' | 'RECORD_INVALID' | 'ERROR';

/** What the panel may know about a v2 seal (no snapshot, no email). */
export interface SealSummary {
  certificateId: string;
  state: 'ACTIVE' | 'REVOKED';
  sealedAt: string;
  sealedByAccountId: string;
  sealedByName: string;
  meaning: string;
  reason: string | null;
  declarationVersion: string;
  snapshotHash: string;
  canonicalizerVersion: string;
  everCompromised: boolean;
  incidentCount: number;
  revocation: { revokedAt: string; revokedByAccountId: string; reason: string } | null;
  historyLength: number;
}

export interface TamperAnalysis {
  status: TamperStatus;
  certificate?: SealCertificate;
  seal?: SealSummary;
  errorReason?: 'JIRA_UNREACHABLE' | 'STORAGE';
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
 * v2 seal record, one per issue (spec v2 section 3.2). v1 `SealCertificate` records are read as legacy only.
 */
export interface SealRecord {
  schemaVersion: 2;
  issueId: string;
  issueKey: string;
  certificateId: string;
  state: 'ACTIVE' | 'REVOKED';
  sealedAt: string;
  sealedBy: { accountId: string; displayName: string };
  meaning: string;
  declaration: { version: string; text: string };
  reason: string | null;
  statusAtSeal: string;
  snapshotHash: string;
  canonicalizerVersion: string;
  coveredFields: { id: string; name: string }[];
  excludedFields: { id: string; name: string; reason: string }[];
  snapshotChunks: number;
  everCompromised: boolean;
  incidentCount: number;
  lastIncidentHash: string | null;
  head: { seq: number; entryHash: string };
  revocation: { revokedAt: string; revokedByAccountId: string; reason: string } | null;
  recordHash: string;
}

export type HistoryEntryType = 'SEALED' | 'RESEALED' | 'INCIDENT' | 'REVOKED';

export interface HistoryEntry {
  seq: number;
  type: HistoryEntryType;
  at: string;
  actorAccountId: string | null;
  certificateId: string;
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
    signerName?: string;
    tamperCount?: number;
  };
}
