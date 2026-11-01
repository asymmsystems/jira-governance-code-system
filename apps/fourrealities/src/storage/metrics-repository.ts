/**
 * Copyright (c) 2026 Asymm Systems. All rights reserved.
 * @author Fahim Farook
 * FourRealities: Metrics & Audit Snapshot Storage Repository
 */

import { ExceptionRecord, IssueExceptionRecord } from '../domain/models';

export interface StorageProvider {
  get<T>(key: string): Promise<T | undefined>;
  set(key: string, value: any): Promise<void>;
  delete(key: string): Promise<void>;
}

export class MetricsRepository {
  private storage: StorageProvider;

  constructor(storage: StorageProvider) {
    this.storage = storage;
  }

  private getIssueKey(issueId: string): string {
    return `fr:issue:${issueId}:signals`;
  }

  private getExceptionKey(issueId: string): string {
    return `fr:issue:${issueId}:exception`;
  }

  /**
   * Deletes a v1 signals record. Signals are never stored any more; this exists for clean-up only.
   */
  public async deleteIssueSignals(issueId: string): Promise<void> {
    await this.storage.delete(this.getIssueKey(issueId));
  }

  public async saveIssueException(record: ExceptionRecord): Promise<void> {
    await this.storage.set(this.getExceptionKey(record.issueId), record);
  }

  /** Returns the stored record as written: v1 or v2. Callers normalise it. */
  public async getIssueException(issueId: string): Promise<IssueExceptionRecord | ExceptionRecord | undefined> {
    return await this.storage.get<IssueExceptionRecord | ExceptionRecord>(this.getExceptionKey(issueId));
  }
}
