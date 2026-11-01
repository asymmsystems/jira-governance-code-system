/**
 * Copyright (c) 2026 Asymm Systems. All rights reserved.
 * @author Asymm Systems Team
 * FourRealities: MetricsRepository Unit Tests
 */

import { MetricsRepository, StorageProvider } from '../../src/storage/metrics-repository';
import { ProjectAuditSnapshot, RealitySignals, IssueExceptionRecord } from '../../src/domain/models';

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
      doneCount: 15,
      sealedDoneCount: 14,
      healthyIssueCount: 19,
      atRiskIssueCount: 1,
      highRiskIssueKeys: ['PROJ-5'],
      gateBreakdown: {
        intent: { passed: 18, attention: 0, blocked: 2, hollow: 0 },
        process: { passed: 19, attention: 1, blocked: 0, hollow: 0 },
        code: { passed: 19, attention: 0, blocked: 1, hollow: 0 },
        audit: { passed: 18, attention: 1, blocked: 1, hollow: 0 }
      },
      weakestGate: 'intent',
      sprintDelta: 6,
      sprintName: 'Sprint 24',
      hasTrendHistory: true,
      riskDistribution: { low: 18, medium: 1, high: 1, critical: 0 }
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

  it('maintains snapshot history and retrieves previous snapshot', async () => {
    const snap1 = { ...sampleSnapshot, snapshotId: 'snap-1', summary: { ...sampleSnapshot.summary, averageRAI: 80 } };
    const snap2 = { ...sampleSnapshot, snapshotId: 'snap-2', summary: { ...sampleSnapshot.summary, averageRAI: 85 } };

    await repository.saveProjectSnapshot(snap1);
    const prevInitial = await repository.getPreviousProjectSnapshot('PROJ');
    expect(prevInitial).toBeUndefined();

    await repository.saveProjectSnapshot(snap2);
    const prevAfterTwo = await repository.getPreviousProjectSnapshot('PROJ');
    expect(prevAfterTwo?.snapshotId).toBe('snap-1');
    expect(prevAfterTwo?.summary.averageRAI).toBe(80);
  });

  it('caps snapshot history at 10 items', async () => {
    for (let i = 1; i <= 12; i++) {
      await repository.saveProjectSnapshot({
        ...sampleSnapshot,
        snapshotId: `snap-${i}`
      });
    }
    const prev = await repository.getPreviousProjectSnapshot('PROJ');
    expect(prev?.snapshotId).toBe('snap-11');
  });

  it('returns undefined when project snapshot is not found', async () => {
    const retrieved = await repository.getLatestProjectSnapshot('UNKNOWN');
    expect(retrieved).toBeUndefined();
  });

  it('deletes a v1 signals record', async () => {
    await mockStorage.set('fr:issue:900:signals', sampleSignals);
    await repository.deleteIssueSignals('900');
    expect(await mockStorage.get('fr:issue:900:signals')).toBeUndefined();
  });

  it('saves and retrieves issue exceptions', async () => {
    const exception: IssueExceptionRecord = {
      issueId: '900',
      issueKey: 'PROJ-900',
      type: 'CODE',
      reason: 'No code change: Documentation only',
      notes: 'PR not needed for readme fix',
      recordedBy: 'user-1',
      recordedAt: '2026-10-30T12:00:00Z'
    };

    await repository.saveIssueException(exception);
    const retrieved = await repository.getIssueException('900');
    expect(retrieved).toEqual(exception);
  });
});
