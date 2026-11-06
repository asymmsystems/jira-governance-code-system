"use strict";
/**
 * LedgerSeal: Cryptographic Sealing & Verification Module
 * Uses standard Node.js crypto (SHA-256) inside Atlassian Forge Node runtime.
 */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.computeSnapshotHash = computeSnapshotHash;
exports.generateSealCertificate = generateSealCertificate;
exports.verifyCertificateIntegrity = verifyCertificateIntegrity;
const crypto = __importStar(require("crypto"));
/**
 * Computes deterministic SHA-256 hash of a CanonicalIssueSnapshot.
 */
function computeSnapshotHash(snapshot) {
    // Exclude capturedAt timestamp so hash reflects pure state content
    const stateOnly = {
        issueId: snapshot.issueId,
        issueKey: snapshot.issueKey,
        projectKey: snapshot.projectKey,
        issueType: snapshot.issueType,
        fields: snapshot.fields,
        attachments: snapshot.attachments,
        comments: snapshot.comments || []
    };
    const serialized = JSON.stringify(stateOnly);
    return crypto.createHash('sha256').update(serialized, 'utf8').digest('hex');
}
/**
 * Generates an immutable SealCertificate combining snapshot state and electronic signature.
 */
function generateSealCertificate(snapshot, signature, certificateId = crypto.randomUUID()) {
    const snapshotHash = computeSnapshotHash(snapshot);
    // Compute certificate signature hash
    const certPayload = JSON.stringify({
        certificateId,
        issueId: snapshot.issueId,
        issueKey: snapshot.issueKey,
        snapshotHash,
        sealedBy: signature
    });
    const certificateHash = crypto.createHash('sha256').update(certPayload, 'utf8').digest('hex');
    return {
        certificateId,
        issueId: snapshot.issueId,
        issueKey: snapshot.issueKey,
        snapshotHash,
        certificateHash,
        algorithm: 'SHA-256',
        schemaVersion: '1.0',
        sealedAt: signature.signedAt,
        sealedBy: signature,
        snapshot,
        status: 'ACTIVE'
    };
}
/**
 * Verifies certificate internal cryptographic integrity.
 */
function verifyCertificateIntegrity(certificate) {
    // 1. Verify snapshot hash matches snapshot content
    const expectedSnapshotHash = computeSnapshotHash(certificate.snapshot);
    if (expectedSnapshotHash !== certificate.snapshotHash) {
        return false;
    }
    // 2. Verify certificate hash matches certificate envelope
    const certPayload = JSON.stringify({
        certificateId: certificate.certificateId,
        issueId: certificate.issueId,
        issueKey: certificate.issueKey,
        snapshotHash: certificate.snapshotHash,
        sealedBy: certificate.sealedBy
    });
    const expectedCertHash = crypto.createHash('sha256').update(certPayload, 'utf8').digest('hex');
    return expectedCertHash === certificate.certificateHash;
}
