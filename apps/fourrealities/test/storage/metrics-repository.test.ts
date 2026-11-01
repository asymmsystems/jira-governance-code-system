/**
 * Copyright (c) 2026 Asymm Systems. All rights reserved.
 * @author Fahim Farook
 * FourRealities: MetricsRepository Unit Tests
 */

import { MetricsRepository, StorageProvider } from '../../src/storage/metrics-repository';
import { IssueExceptionRecord } from '../../src/domain/models';

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

  const sampleSignals = {
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
