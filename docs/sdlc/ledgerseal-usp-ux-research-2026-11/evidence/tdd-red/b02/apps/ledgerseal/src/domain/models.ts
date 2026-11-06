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
}

export interface AttachmentDiff {
  type: 'ADDED' | 'REMOVED' | 'MODIFIED';
  attachmentId: string;
  filename: string;
}

export type TamperStatus = 'SEAL_VALID' | 'SEAL_BROKEN' | 'SEAL_COMPROMISED' | 'NO_SEAL' | 'SEAL_REVOKED';

export interface TamperAnalysis {
  status: TamperStatus;
  certificate?: SealCertificate;
  liveHash?: string;
  sealedHash?: string;
  tamperedFields: FieldDiff[];
  tamperedAttachments: AttachmentDiff[];
  verifiedAt: string;
  isCompromised?: boolean;
  tamperHistory?: TamperIncident[];
  compromiseReason?: string;
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
