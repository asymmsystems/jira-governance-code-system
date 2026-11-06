"use strict";
/**
 * LedgerSeal: Forge Storage Repository Abstraction
 * Enforces key naming conventions and historical audit logging.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.SealRepository = void 0;
class SealRepository {
    storage;
    constructor(storage) {
        this.storage = storage;
    }
    getActiveCertKey(issueId) {
        return `cert:active:${issueId}`;
    }
    getHistoryKey(issueId) {
        return `cert:history:${issueId}`;
    }
    getArchiveKey(certificateId) {
        return `cert:archive:${certificateId}`;
    }
    /**
     * Retrieves the currently active seal certificate for an issue.
     */
    async getActiveCertificate(issueId) {
        const cert = await this.storage.get(this.getActiveCertKey(issueId));
        return cert || null;
    }
    /**
     * Saves a new seal certificate.
     * If an active certificate already exists, archives it into the append-only history.
     */
    async saveCertificate(certificate) {
        const issueId = certificate.issueId;
        const activeKey = this.getActiveCertKey(issueId);
        // 1. Fetch current active certificate to archive if present
        const existing = await this.storage.get(activeKey);
        if (existing) {
            existing.status = 'SUPERSEDED';
            await this.storage.set(this.getArchiveKey(existing.certificateId), existing);
            // Append to history list
            const historyKey = this.getHistoryKey(issueId);
            const history = (await this.storage.get(historyKey)) || [];
            history.push({
                certificateId: existing.certificateId,
                sealedAt: existing.sealedAt,
                signerAccountId: existing.sealedBy.signerAccountId,
                signerName: existing.sealedBy.signerDisplayName,
                snapshotHash: existing.snapshotHash,
                status: 'SUPERSEDED'
            });
            await this.storage.set(historyKey, history);
        }
        // 2. Save new certificate as active
        await this.storage.set(activeKey, certificate);
    }
    /**
     * Revokes an active certificate with a recorded reason.
     */
    async revokeCertificate(issueId, revokedByAccountId, revocationReason) {
        const activeKey = this.getActiveCertKey(issueId);
        const cert = await this.storage.get(activeKey);
        if (!cert) {
            return null;
        }
        cert.status = 'REVOKED';
        cert.revocation = {
            revokedAt: new Date().toISOString(),
            revokedByAccountId,
            revocationReason
        };
        await this.storage.set(activeKey, cert);
        return cert;
    }
    /**
     * Retrieves historical certificate summaries for audit trail.
     */
    async getCertificateHistory(issueId) {
        return (await this.storage.get(this.getHistoryKey(issueId))) || [];
    }
}
exports.SealRepository = SealRepository;
