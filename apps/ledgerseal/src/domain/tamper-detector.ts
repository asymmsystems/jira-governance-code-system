/**
 * Copyright (c) 2026 Asymm Systems. All rights reserved.
 *
 * LedgerSeal: Tamper Detection & Diff Analysis Engine
 * Compares live issue state against sealed cryptographic certificate.
 * Enforces non-monotonic tamper tracking: reverting tampered content does not heal the seal.
 *
 * @author Fahim Farook
 */

import { AttachmentDiff, CanonicalIssueSnapshot, FieldDiff, SealCertificate, TamperAnalysis, TamperIncident } from './models';
import { computeSnapshotHash } from './crypto';
import { canonicalJson } from './canonical-json';

/**
 * What the detector needs to know about a seal, independent of how it is stored (v1 certificate or v2 record).
 */
export interface SealedState {
  snapshotHash: string;
  snapshot: CanonicalIssueSnapshot;
  revoked: boolean;
  /** True when the current seal already has a recorded change incident. */
  compromised: boolean;
}

export function fromCertificate(certificate: SealCertificate): SealedState {
  return {
    snapshotHash: certificate.snapshotHash,
    snapshot: certificate.snapshot,
    revoked: certificate.status === 'REVOKED',
    compromised: Boolean(certificate.isCompromised || (certificate.tamperHistory && certificate.tamperHistory.length > 0))
  };
}

/**
 * Compares the live issue with a seal. Returns the status and the field and attachment diffs.
 * It records nothing: the caller decides whether a change is a new incident.
 */
export function compareToSeal(sealed: SealedState | null, liveSnapshot: CanonicalIssueSnapshot, verifiedAt: string): TamperAnalysis {
  if (!sealed) {
    return {
      status: 'NO_SEAL',
      tamperedFields: [],
      tamperedAttachments: [],
      verifiedAt
    };
  }

  if (sealed.revoked) {
    return {
      status: 'SEAL_REVOKED',
      tamperedFields: [],
      tamperedAttachments: [],
      verifiedAt
    };
  }

  const liveHash = computeSnapshotHash(liveSnapshot);
  const sealedHash = sealed.snapshotHash;

  // If hashes match exactly:
  if (liveHash === sealedHash) {
    if (sealed.compromised) {
      // Revert-then-tamper scenario (Fixes D-02)
      return {
        status: 'SEAL_COMPROMISED',
        liveHash,
        sealedHash,
        tamperedFields: [],
        tamperedAttachments: [],
        verifiedAt,
        isCompromised: true,
        compromiseReason: 'This issue changed after approval and was changed back. An approver must approve it again.'
      };
    }

    return {
      status: 'SEAL_VALID',
      liveHash,
      sealedHash,
      tamperedFields: [],
      tamperedAttachments: [],
      verifiedAt,
      isCompromised: false
    };
  }

  const { tamperedFields, tamperedAttachments } = diffSnapshots(sealed.snapshot, liveSnapshot);
  return {
    status: 'SEAL_BROKEN',
    liveHash,
    sealedHash,
    tamperedFields,
    tamperedAttachments,
    verifiedAt,
    isCompromised: true,
    compromiseReason: `${tamperedFields.length} item(s) changed after approval (${tamperedFields.map(f => f.fieldName).join(', ')}). An approver must approve the changes.`
  };
}

/**
 * Analyzes live issue state against a v1 seal certificate, and appends a v1 tamper incident on a broken seal.
 */
export function analyzeTamperState(
  certificate: SealCertificate | null,
  liveSnapshot: CanonicalIssueSnapshot,
  verifiedAt: string
): TamperAnalysis {
  if (!certificate) {
    return compareToSeal(null, liveSnapshot, verifiedAt);
  }
  const analysis: TamperAnalysis = { ...compareToSeal(fromCertificate(certificate), liveSnapshot, verifiedAt), certificate };
  if (analysis.status === 'SEAL_COMPROMISED') {
    analysis.tamperHistory = certificate.tamperHistory;
  }
  if (analysis.status === 'SEAL_BROKEN') {
    const incident: TamperIncident = {
      detectedAt: verifiedAt,
      alteredFields: analysis.tamperedFields.map(f => f.fieldName),
      liveHash: analysis.liveHash as string,
      sealedHash: certificate.snapshotHash,
      incidentType: 'ACTIVE_TAMPER',
      summary: `${analysis.tamperedFields.length} field(s) modified after sign-off`
    };
    analysis.tamperHistory = [...(certificate.tamperHistory || []), incident];
  }
  return analysis;
}

/**
 * Field, attachment and comment differences between a sealed snapshot and the live one.
 */
export function diffSnapshots(
  sealedSnapshot: CanonicalIssueSnapshot,
  liveSnapshot: CanonicalIssueSnapshot
): { tamperedFields: FieldDiff[]; tamperedAttachments: AttachmentDiff[] } {
  const tamperedFields: FieldDiff[] = [];

  // Changes outside `fields` that the hash covers: a move to another project, or a new issue type (NF-01)
  // Compared by the hashed id; shown by key or name
  const topLevel: [string, string, (s: CanonicalIssueSnapshot) => unknown, (s: CanonicalIssueSnapshot) => unknown][] = [
    ['issuekey', 'Issue key', s => s.issueKey, s => s.issueKey],
    ['project', 'Project', s => s.projectId ?? s.projectKey, s => s.projectKey],
    ['issuetype', 'Issue type', s => s.issueTypeId ?? s.issueType, s => s.issueType]
  ];
  for (const [fieldId, fieldName, id, shown] of topLevel) {
    if (id(sealedSnapshot) !== id(liveSnapshot)) {
      tamperedFields.push({ fieldId, fieldName, sealedValue: shown(sealedSnapshot), liveValue: shown(liveSnapshot) });
    }
  }

  const sealedFieldsMap = new Map<string, any>();
  for (const f of sealedSnapshot.fields) {
    sealedFieldsMap.set(f.id, f);
  }

  const liveFieldsMap = new Map<string, any>();
  for (const f of liveSnapshot.fields) {
    liveFieldsMap.set(f.id, f);
  }

  // A changed field shows its display text; rich text keeps its document for the paragraph summary
  const shown = (field: any) => {
    if (!field) return null;
    if (field.value && typeof field.value === 'object' && field.value.type === 'doc') return field.value;
    return field.display ?? field.value;
  };

  // Check changed or removed fields
  for (const [id, sealedField] of sealedFieldsMap.entries()) {
    const liveField = liveFieldsMap.get(id);
    const sealedSerialized = JSON.stringify(sealedField.value);
    const liveSerialized = JSON.stringify(liveField?.value ?? null);

    if (sealedSerialized !== liveSerialized) {
      tamperedFields.push({
        fieldId: id,
        fieldName: sealedField.name,
        sealedValue: shown(sealedField),
        liveValue: shown(liveField)
      });
    }
  }

  // Check added fields in live state
  for (const [id, liveField] of liveFieldsMap.entries()) {
    if (!sealedFieldsMap.has(id) && liveField.value !== null) {
      tamperedFields.push({
        fieldId: id,
        fieldName: liveField.name,
        sealedValue: null,
        liveValue: shown(liveField)
      });
    }
  }

  // Check attachments
  const tamperedAttachments: AttachmentDiff[] = [];
  const sealedAttMap = new Map(sealedSnapshot.attachments.map(a => [a.id, a]));
  const liveAttMap = new Map(liveSnapshot.attachments.map(a => [a.id, a]));

  for (const [id, sealedAtt] of sealedAttMap.entries()) {
    const liveAtt = liveAttMap.get(id);
    if (!liveAtt) {
      tamperedAttachments.push({
        type: 'REMOVED',
        attachmentId: id,
        filename: sealedAtt.filename
      });
    } else if (liveAtt.size !== sealedAtt.size || liveAtt.filename !== sealedAtt.filename) {
      tamperedAttachments.push({
        type: 'MODIFIED',
        attachmentId: id,
        filename: sealedAtt.filename
      });
    }
  }

  for (const [id, liveAtt] of liveAttMap.entries()) {
    if (!sealedAttMap.has(id)) {
      tamperedAttachments.push({
        type: 'ADDED',
        attachmentId: id,
        filename: liveAtt.filename
      });
    }
  }

  // Check comments one by one (Fixes D-10): added, edited and removed comments each get a row
  const sealedComments = new Map((sealedSnapshot.comments || []).map(c => [c.id, c]));
  const liveComments = new Map((liveSnapshot.comments || []).map(c => [c.id, c]));
  for (const [id, sealedComment] of sealedComments.entries()) {
    const liveComment = liveComments.get(id);
    if (!liveComment) {
      tamperedFields.push({ fieldId: `comment:${id}`, fieldName: 'Comment removed', sealedValue: sealedComment.body, liveValue: null });
    } else if (canonicalJson(liveComment.body) !== canonicalJson(sealedComment.body) || liveComment.authorAccountId !== sealedComment.authorAccountId) {
      tamperedFields.push({
        fieldId: `comment:${id}`,
        fieldName: 'Comment edited',
        sealedValue: sealedComment.body,
        liveValue: liveComment.body
      });
    }
  }
  for (const [id, liveComment] of liveComments.entries()) {
    if (!sealedComments.has(id)) {
      tamperedFields.push({ fieldId: `comment:${id}`, fieldName: 'Comment added', sealedValue: null, liveValue: liveComment.body });
    }
  }

  return { tamperedFields, tamperedAttachments };
}
