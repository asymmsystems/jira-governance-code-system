/**
 * LedgerSeal: Forge Storage Repository Abstraction
 * Enforces key naming conventions and historical audit logging (spec v2 section 6).
 * History entries are created once and never rewritten. v1 certificates are read as legacy only.
 */

import { CanonicalIssueSnapshot, HistoryEntry, SealCertificate, SealRecord } from '../domain/models';

export interface StorageProvider {
  get(key: string): Promise<any>;
  set(key: string, value: any): Promise<void>;
  delete(key: string): Promise<void>;
  /** Writes `value` only if `key` does not exist yet. Returns false when the key already exists. */
  createIfAbsent(key: string, value: any): Promise<boolean>;
  /** Writes all items together, or none of them (one KVS transaction). */
  commit(items: { key: string; value: any }[]): Promise<void>;
}

export const HISTORY_PAGE_SIZE = 50;

export class SealRepository {
  constructor(private storage: StorageProvider) {}

  private getSealKey(issueId: string): string {
    return `ls2:seal:${issueId}`;
  }

  private getEntryKey(issueId: string, seq: number): string {
    return `ls2:entry:${issueId}:${String(seq).padStart(6, '0')}`;
  }

  private getSnapshotKey(certificateId: string, part: number): string {
    return `ls2:snap:${certificateId}:${part}`;
  }

  private getLegacyCertKey(issueId: string): string {
    return `cert:active:${issueId}`;
  }

  /**
   * Retrieves the v2 seal record for an issue.
   */
  async getSeal(issueId: string): Promise<SealRecord | null> {
    return (await this.storage.get(this.getSealKey(issueId))) || null;
  }

  /**
   * Retrieves a v1 certificate, if one exists. v2 never writes or deletes v1 keys.
   */
  async getLegacyCertificate(issueId: string): Promise<SealCertificate | null> {
    return (await this.storage.get(this.getLegacyCertKey(issueId))) || null;
  }

  /**
   * Reads the sealed snapshot of a record from its parts.
   */
  async getSnapshot(record: SealRecord): Promise<CanonicalIssueSnapshot | null> {
    let text = '';
    for (let part = 0; part < record.snapshotChunks; part++) {
      const chunk = await this.storage.get(this.getSnapshotKey(record.certificateId, part));
      if (typeof chunk !== 'string') return null;
      text += chunk;
    }
    try {
      return JSON.parse(text);
    } catch {
      return null;
    }
  }

  /**
   * Creates the next history entry. Returns false if an entry with that number exists,
   * which means another writer changed the seal first.
   */
  async appendEntry(issueId: string, entry: HistoryEntry): Promise<boolean> {
    return this.storage.createIfAbsent(this.getEntryKey(issueId, entry.seq), entry);
  }

  /**
   * Saves a seal record, and the snapshot parts of a new certificate, in one transaction.
   */
  async saveSeal(record: SealRecord, snapshotParts: string[] = []): Promise<void> {
    const items: { key: string; value: unknown }[] = snapshotParts.map((value, part) => ({
      key: this.getSnapshotKey(record.certificateId, part),
      value
    }));
    items.push({ key: this.getSealKey(record.issueId), value: record });
    await this.storage.commit(items);
  }

  /**
   * Retrieves history entries, oldest first, from `fromSeq` up to `toSeq`, at most one page.
   */
  async getEntries(issueId: string, fromSeq: number, toSeq: number): Promise<HistoryEntry[]> {
    const entries: HistoryEntry[] = [];
    const last = Math.min(toSeq, fromSeq + HISTORY_PAGE_SIZE - 1);
    for (let seq = Math.max(1, fromSeq); seq <= last; seq++) {
      const entry = await this.storage.get(this.getEntryKey(issueId, seq));
      if (entry) entries.push(entry);
    }
    return entries;
  }
}
