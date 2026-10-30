/**
 * LedgerSeal: Tamper Detection & Diff Analysis Engine
 * Compares live issue state against sealed cryptographic certificate.
 * Enforces non-monotonic tamper tracking: reverting tampered content does not heal the seal.
 */

import { AttachmentDiff, CanonicalIssueSnapshot, FieldDiff, SealCertificate, TamperAnalysis, TamperIncident } from './models';
import { computeSnapshotHash } from './crypto';

/**
 * Analyzes live issue state against the active seal certificate.
 */
export function analyzeTamperState(
  certificate: SealCertificate | null,
  liveSnapshot: CanonicalIssueSnapshot,
  verifiedAt: string
): TamperAnalysis {
  if (!certificate) {
    return {
      status: 'NO_SEAL',
      tamperedFields: [],
      tamperedAttachments: [],
      verifiedAt
    };
  }

  if (certificate.status === 'REVOKED') {
    return {
      status: 'SEAL_REVOKED',
      certificate,
      tamperedFields: [],
      tamperedAttachments: [],
      verifiedAt
    };
  }

  const liveHash = computeSnapshotHash(liveSnapshot);
  const sealedHash = certificate.snapshotHash;

  // Check if this certificate was previously flagged as compromised
  const wasPreviouslyCompromised = Boolean(
    certificate.isCompromised || (certificate.tamperHistory && certificate.tamperHistory.length > 0)
  );

  // If hashes match exactly:
  if (liveHash === sealedHash) {
    if (wasPreviouslyCompromised) {
      // Revert-then-tamper scenario (Fixes D-02)
      return {
        status: 'SEAL_COMPROMISED',
        certificate,
        liveHash,
        sealedHash,
        tamperedFields: [],
        tamperedAttachments: [],
        verifiedAt,
        isCompromised: true,
        tamperHistory: certificate.tamperHistory,
        compromiseReason:
          'Cryptographic integrity compromised! This issue was modified after sign-off and reverted. Re-authorization required.'
      };
    }

    return {
      status: 'SEAL_VALID',
      certificate,
      liveHash,
      sealedHash,
      tamperedFields: [],
      tamperedAttachments: [],
      verifiedAt,
      isCompromised: false
    };
  }

  // Hashes differ: compute granular diffs
  const tamperedFields: FieldDiff[] = [];
  const sealedFieldsMap = new Map<string, any>();
  for (const f of certificate.snapshot.fields) {
    sealedFieldsMap.set(f.id, f);
  }

  const liveFieldsMap = new Map<string, any>();
  for (const f of liveSnapshot.fields) {
    liveFieldsMap.set(f.id, f);
  }

  // Check changed or removed fields
  for (const [id, sealedField] of sealedFieldsMap.entries()) {
    const liveField = liveFieldsMap.get(id);
    const sealedSerialized = JSON.stringify(sealedField.value);
    const liveSerialized = JSON.stringify(liveField?.value ?? null);

    if (sealedSerialized !== liveSerialized) {
      tamperedFields.push({
        fieldId: id,
        fieldName: sealedField.name,
        sealedValue: sealedField.value,
        liveValue: liveField?.value ?? null
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
        liveValue: liveField.value
      });
    }
  }

  // Check attachments
  const tamperedAttachments: AttachmentDiff[] = [];
  const sealedAttMap = new Map(certificate.snapshot.attachments.map(a => [a.id, a]));
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

  // Check comments (Fixes D-10)
  const sealedComments = certificate.snapshot.comments || [];
  const liveComments = liveSnapshot.comments || [];
  if (JSON.stringify(sealedComments) !== JSON.stringify(liveComments)) {
    tamperedFields.push({
      fieldId: 'comment',
      fieldName: 'Comments / Discussion',
      sealedValue: `${sealedComments.length} comment(s)`,
      liveValue: `${liveComments.length} comment(s)`
    });
  }

  const incident: TamperIncident = {
    detectedAt: verifiedAt,
    alteredFields: tamperedFields.map(f => f.fieldName),
    liveHash,
    sealedHash,
    incidentType: 'ACTIVE_TAMPER',
    summary: `${tamperedFields.length} field(s) modified after sign-off`
  };

  const updatedHistory = [...(certificate.tamperHistory || []), incident];

  return {
    status: 'SEAL_BROKEN',
    certificate,
    liveHash,
    sealedHash,
    tamperedFields,
    tamperedAttachments,
    verifiedAt,
    isCompromised: true,
    tamperHistory: updatedHistory,
    compromiseReason: `Cryptographic seal broken! ${tamperedFields.length} item(s) modified after sign-off (${tamperedFields
      .map(f => f.fieldName)
      .join(', ')}). Re-authorization required.`
  };
}
