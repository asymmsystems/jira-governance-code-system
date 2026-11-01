/**
 * Copyright (c) 2026 Asymm Systems. All rights reserved.
 * @author Fahim Farook
 * FourRealities: exception records in Forge KVS (fr:issue:{id}:exception).
 */

import { ExceptionRecord, IssueExceptionRecord } from '../contract/data/models';
import { ExceptionAccessor, StorageProvider } from '../contract/accessors';
import { normalizeException } from './issue-facts';

export { StorageProvider };

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

export class DefaultKvsExceptionAccessor implements ExceptionAccessor {
  readonly serviceType = 'accessor' as const;
  private readonly repository: MetricsRepository;

  constructor(private readonly storage: StorageProvider) {
    this.repository = new MetricsRepository(storage);
  }

  async get(issueId: string): Promise<ExceptionRecord | undefined> {
    return normalizeException(await this.repository.getIssueException(issueId));
  }

  save(record: ExceptionRecord): Promise<void> {
    return this.repository.saveIssueException(record);
  }

  /** All v2 records by issue id, read with one paged prefix query. */
  async listByIssue(issueIds: string[]): Promise<Map<string, ExceptionRecord>> {
    const result = new Map<string, ExceptionRecord>();
    let cursor: string | undefined;
    do {
      const page: { results: Array<{ key: string; value: any }>; nextCursor?: string } = await this.storage.queryPrefix<any>('fr:issue:', cursor);
      for (const { key, value } of page.results) {
        const match = /^fr:issue:(.+):exception$/.exec(key);
        const record = match ? normalizeException(value) : undefined;
        if (match && record) {
          result.set(match[1], record);
        }
      }
      cursor = page.nextCursor;
    } while (cursor);
    return result;
  }
}
