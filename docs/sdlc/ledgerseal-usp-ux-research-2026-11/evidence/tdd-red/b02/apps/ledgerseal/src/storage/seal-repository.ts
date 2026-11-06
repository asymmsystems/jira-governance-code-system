/**
 * LedgerSeal: Forge Storage Repository Abstraction
 * Enforces key naming conventions and historical audit logging.
 */

import { SealCertificate } from '../domain/models';

export interface StorageProvider {
  get(key: string): Promise<any>;
  set(key: string, value: any): Promise<void>;
  delete(key: string): Promise<void>;
}

export class SealRepository {
  constructor(private storage: StorageProvider) {}

  private getActiveCertKey(issueId: string): string {
    return `cert:active:${issueId}`;
  }

  private getHistoryKey(issueId: string): string {
    return `cert:history:${issueId}`;
  }

  private getArchiveKey(certificateId: string): string {
    return `cert:archive:${certificateId}`;
  }

  /**
   * Retrieves the currently active seal certificate for an issue.
   */
  async getActiveCertificate(issueId: string): Promise<SealCertificate | null> {
    const cert = await this.storage.get(this.getActiveCertKey(issueId));
    return cert || null;
  }

  /**
   * Saves a new seal certificate.
   * If an active certificate already exists, archives it into the append-only history.
   */
  async saveCertificate(certificate: SealCertificate): Promise<void> {
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
  async revokeCertificate(
    issueId: string,
    revokedByAccountId: string,
    revocationReason: string
  ): Promise<SealCertificate | null> {
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
  async getCertificateHistory(issueId: string): Promise<any[]> {
    return (await this.storage.get(this.getHistoryKey(issueId))) || [];
  }
}
