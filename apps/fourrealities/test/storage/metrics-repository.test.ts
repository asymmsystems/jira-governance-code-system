import { MetricsRepository, StorageProvider } from '../../src/storage/metrics-repository';
import { ProjectAuditSnapshot, RealitySignals } from '../../src/domain/models';

class MockStorageProvider implements StorageProvider {
  private store: Map<string, any> = new Map();

  async get<T>(key: string): Promise<T | undefined> {
    return this.store.get(key);
  }

  async set(key: string, value: any): Promise<void> {
    this.store.set(key, value);
  }

  async delete(key: string): Promise<void> {
    this.store.delete(key);
  }
}

describe('MetricsRepository', () => {
  let mockStorage: MockStorageProvider;
  let repository: MetricsRepository;

  beforeEach(() => {
    mockStorage = new MockStorageProvider();
    repository = new MetricsRepository(mockStorage);
  });

  const sampleSnapshot: ProjectAuditSnapshot = {
    snapshotId: 'snap-1',
    projectKey: 'PROJ',
    generatedAt: '2026-10-29T10:00:00Z',
    generatedBy: 'admin',
    summary: {
      m11TraceabilityRate: 90,
      m29ReviewComplianceRate: 95,
      m30ReworkLoopRate: 5,
      m40AuditComplianceRate: 90,
      averageRAI: 92,
      totalAuditedIssues: 20,
      healthyIssueCount: 19,
      atRiskIssueCount: 1,
      highRiskIssueKeys: ['PROJ-5']
    },
    issueScores: []
  };

  const sampleSignals: RealitySignals = {
    issueId: '900',
    issueKey: 'PROJ-900',
    hasDocumentedIntent: true,
    transitionCount: 2,
    regressionCount: 0,
    prCount: 1,
    hasApprovedReview: true,
    hasCryptographicSeal: true,
    isDoDSatisfied: true
  };

  it('saves and retrieves latest project audit snapshot', async () => {
    await repository.saveProjectSnapshot(sampleSnapshot);
    const retrieved = await repository.getLatestProjectSnapshot('PROJ');

    expect(retrieved).toEqual(sampleSnapshot);
  });

  it('returns undefined when project snapshot is not found', async () => {
    const retrieved = await repository.getLatestProjectSnapshot('UNKNOWN');
    expect(retrieved).toBeUndefined();
  });

  it('saves and retrieves issue signals', async () => {
    await repository.saveIssueSignals(sampleSignals);
    const retrieved = await repository.getIssueSignals('900');

    expect(retrieved).toEqual(sampleSignals);
  });

  it('deletes issue signals', async () => {
    await repository.saveIssueSignals(sampleSignals);
    await repository.deleteIssueSignals('900');

    const retrieved = await repository.getIssueSignals('900');
    expect(retrieved).toBeUndefined();
  });
});
