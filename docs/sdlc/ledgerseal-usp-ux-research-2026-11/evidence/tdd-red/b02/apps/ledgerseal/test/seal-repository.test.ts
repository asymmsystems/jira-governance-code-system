import { SealRepository, StorageProvider } from '../src/storage/seal-repository';
import { generateSealCertificate } from '../src/domain/crypto';
import { CanonicalIssueSnapshot, ElectronicSignature } from '../src/domain/models';

class InMemoryStorage implements StorageProvider {
  private map = new Map<string, any>();

  async get(key: string): Promise<any> {
    return this.map.get(key) || null;
  }

  async set(key: string, value: any): Promise<void> {
    this.map.set(key, JSON.parse(JSON.stringify(value)));
  }

  async delete(key: string): Promise<void> {
    this.map.delete(key);
  }
}

describe('Seal Repository', () => {
  let storage: InMemoryStorage;
  let repo: SealRepository;

  const sampleSnapshot: CanonicalIssueSnapshot = {
    issueId: '10001',
    issueKey: 'AUDIT-1',
    projectKey: 'AUDIT',
    issueType: 'Story',
    status: 'Done',
    fields: [{ id: 'summary', name: 'Summary', type: 'string', value: 'First build' }],
    attachments: [],
    capturedAt: '2026-10-28T10:00:00Z'
  };

  const sampleSig: ElectronicSignature = {
    signerAccountId: 'acc-1',
    signerDisplayName: 'Lead Auditor',
    signedAt: '2026-10-28T10:05:00Z',
    meaning: 'Initial approval',
    reasonCode: 'APPROVAL',
    declarationText: 'Verified'
  };

  beforeEach(() => {
    storage = new InMemoryStorage();
    repo = new SealRepository(storage);
  });

  it('saves and retrieves active certificate', async () => {
    const cert = generateSealCertificate(sampleSnapshot, sampleSig);
    await repo.saveCertificate(cert);

    const retrieved = await repo.getActiveCertificate('10001');
    expect(retrieved).not.toBeNull();
    expect(retrieved?.certificateId).toBe(cert.certificateId);
    expect(retrieved?.status).toBe('ACTIVE');
  });

  it('archives previous certificate into history when resealed', async () => {
    const cert1 = generateSealCertificate(sampleSnapshot, sampleSig);
    await repo.saveCertificate(cert1);

    const cert2 = generateSealCertificate(
      { ...sampleSnapshot, fields: [{ id: 'summary', name: 'Summary', type: 'string', value: 'Updated build' }] },
      { ...sampleSig, signedAt: '2026-10-28T11:00:00Z' }
    );
    await repo.saveCertificate(cert2);

    const active = await repo.getActiveCertificate('10001');
    expect(active?.certificateId).toBe(cert2.certificateId);

    const history = await repo.getCertificateHistory('10001');
    expect(history).toHaveLength(1);
    expect(history[0].certificateId).toBe(cert1.certificateId);
    expect(history[0].status).toBe('SUPERSEDED');
  });

  it('revokes an active certificate with recorded audit reason', async () => {
    const cert = generateSealCertificate(sampleSnapshot, sampleSig);
    await repo.saveCertificate(cert);

    const revoked = await repo.revokeCertificate('10001', 'admin-acc', 'Security flaw discovered');
    expect(revoked).not.toBeNull();
    expect(revoked?.status).toBe('REVOKED');
    expect(revoked?.revocation?.revocationReason).toBe('Security flaw discovered');

    const active = await repo.getActiveCertificate('10001');
    expect(active?.status).toBe('REVOKED');
  });

  it('returns null when attempting to revoke non-existent certificate', async () => {
    const revoked = await repo.revokeCertificate('99999', 'admin-acc', 'Does not exist');
    expect(revoked).toBeNull();
  });
});
