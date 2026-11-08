/**
 * Copyright (c) 2026 Asymm Systems. All rights reserved.
 * @author Fahim Farook
 * FourRealities: the evidence report records in Forge KVS (spec v4, Storage Schema). Every key has the fr:
 * prefix (spec v3 invariant 1). No value holds an account id: people are party tokens.
 *
 *   fr:cfg:reports                          ReportSettings
 *   fr:rj:{reportId}                        ReportJob
 *   fr:rj:{reportId}:ids:{i}                issue ids, at most 5,000 per value (kept while the report is kept)
 *   fr:rj:{reportId}:tokens:{i}             party tokens of the report, at most 4,000 per value
 *   Every project record is keyed by the Jira project id, which a key rename does not change (review N-2).
 *   fr:rp:{projectId}:rep:{createdAt}:{id}  one ReportIndexEntry per report, at most 200 per project; each writer
 *                                           writes only its own report's key (review M-1)
 *   fr:rp:{projectId}:head                  ChainLink of the newest DONE report
 *   fr:rp:{projectId}:schedules             ReportSchedule[], at most 5
 *   fr:rt:{projectId}:{deletedAt}:{seq}     ReportTombstone, written once
 *   fr:reports:project:{projectId}          the project's current key; one key per project with reports or schedules
 *   fr:rj:{reportId}:nr:{i}                 the report's issues not in it, "{id}:{reason}:{key}", for the download modal
 *   Records of the development builds 7.7.0 and 7.8.0 (keyed by project key) are not read (review N-4).
 *   fr:tmp:{id}                             a temporary people file (Object Store cannot list its objects)
 */

import { ChainLink, DEFAULT_REPORT_SETTINGS, NotReadableIssue, REPORT_LIMITS, ReportIndexEntry, ReportJob, ReportSchedule, ReportSettings, ReportTombstone, TmpObject } from '../contract/data/reports';
import { StorageProvider } from '../contract/accessors';
import { ReportStoreAccessor } from '../contract/reports';
import { queryAll } from './kvs-v2-exception';

/** One key per project: fr:reports:project:{projectId} holds the project's current key (review R3-2). */
const PROJECT_PREFIX = 'fr:reports:project:';
const entryKey = (projectId: string, e: ReportIndexEntry) => `fr:rp:${projectId}:rep:${e.createdAt}:${e.reportId}`;

async function writeAll(storage: StorageProvider, sets: Array<{ key: string; value: unknown }>): Promise<void> {
  if (storage.transact) {
    await storage.transact(sets);
    return;
  }
  for (const { key, value } of sets) await storage.set(key, value);
}

export class DefaultKvsReportStoreAccessor implements ReportStoreAccessor {
  readonly serviceType = 'accessor' as const;

  constructor(private readonly storage: StorageProvider) {}

  async getSettings(): Promise<ReportSettings> {
    return (await this.storage.get<ReportSettings>('fr:cfg:reports')) || DEFAULT_REPORT_SETTINGS;
  }

  async saveSettings(settings: ReportSettings): Promise<void> {
    await this.storage.set('fr:cfg:reports', settings);
  }

  getJob(reportId: string): Promise<ReportJob | undefined> {
    return this.storage.get<ReportJob>(`fr:rj:${reportId}`);
  }

  async saveJob(job: ReportJob): Promise<void> {
    await this.storage.set(`fr:rj:${job.reportId}`, job);
  }

  async deleteJob(reportId: string): Promise<void> {
    await this.storage.delete(`fr:rj:${reportId}`);
  }

  private async saveChunks(prefix: string, values: string[], size: number): Promise<number> {
    let chunks = 0;
    for (let i = 0; i < values.length; i += size) await this.storage.set(`${prefix}:${chunks++}`, values.slice(i, i + size));
    return chunks;
  }

  private async loadChunks(prefix: string, chunks: number): Promise<string[]> {
    const out: string[] = [];
    for (let i = 0; i < chunks; i++) out.push(...((await this.storage.get<string[]>(`${prefix}:${i}`)) || []));
    return out;
  }

  private async deleteChunks(prefix: string, chunks: number): Promise<void> {
    for (let i = 0; i < chunks; i++) await this.storage.delete(`${prefix}:${i}`);
  }

  saveIds(reportId: string, ids: string[]): Promise<number> {
    return this.saveChunks(`fr:rj:${reportId}:ids`, ids, REPORT_LIMITS.idsPerValue);
  }

  loadIds(reportId: string, chunks: number): Promise<string[]> {
    return this.loadChunks(`fr:rj:${reportId}:ids`, chunks);
  }

  deleteIds(reportId: string, chunks: number): Promise<void> {
    return this.deleteChunks(`fr:rj:${reportId}:ids`, chunks);
  }

  saveTokens(reportId: string, tokens: string[]): Promise<number> {
    return this.saveChunks(`fr:rj:${reportId}:tokens`, tokens, REPORT_LIMITS.tokensPerValue);
  }

  loadTokens(reportId: string, chunks: number): Promise<string[]> {
    return this.loadChunks(`fr:rj:${reportId}:tokens`, chunks);
  }

  deleteTokens(reportId: string, chunks: number): Promise<void> {
    return this.deleteChunks(`fr:rj:${reportId}:tokens`, chunks);
  }

  /** The project's entries, newest first. */
  async getIndex(projectId: string): Promise<ReportIndexEntry[]> {
    const rows = (await queryAll(this.storage, `fr:rp:${projectId}:rep:`)).map(r => r.value as ReportIndexEntry);
    // Newest first by creation time, then by report id: one comparison of the two keys.
    const key = (e: ReportIndexEntry) => `${e.createdAt} ${e.reportId}`;
    return rows.sort((x, y) => Number(key(x) < key(y)) - Number(key(x) > key(y)));
  }

  async putEntry(projectId: string, entry: ReportIndexEntry): Promise<void> {
    await this.storage.set(entryKey(projectId, entry), entry);
  }

  async deleteEntry(projectId: string, entry: ReportIndexEntry): Promise<void> {
    await this.storage.delete(entryKey(projectId, entry));
  }

  /** Makes the index exactly these entries (tests and tools; the Manager writes one entry at a time). */
  async saveIndex(projectId: string, entries: ReportIndexEntry[]): Promise<void> {
    const keep = new Set(entries.slice(0, REPORT_LIMITS.reportsPerProject).map(e => entryKey(projectId, e)));
    for (const r of await queryAll(this.storage, `fr:rp:${projectId}:rep:`)) if (!keep.has(r.key)) await this.storage.delete(r.key);
    for (const e of entries.slice(0, REPORT_LIMITS.reportsPerProject)) await this.putEntry(projectId, e);
  }

  getHead(projectId: string): Promise<ChainLink | undefined> {
    return this.storage.get<ChainLink>(`fr:rp:${projectId}:head`);
  }

  commitDone(job: ReportJob, projectId: string, entry: ReportIndexEntry, head: ChainLink): Promise<void> {
    return writeAll(this.storage, [
      { key: `fr:rj:${job.reportId}`, value: job },
      { key: entryKey(projectId, entry), value: entry },
      { key: `fr:rp:${projectId}:head`, value: head }
    ]);
  }

  async getSchedules(projectId: string): Promise<ReportSchedule[]> {
    return (await this.storage.get<ReportSchedule[]>(`fr:rp:${projectId}:schedules`)) || [];
  }

  async saveSchedules(projectId: string, schedules: ReportSchedule[]): Promise<void> {
    await this.storage.set(`fr:rp:${projectId}:schedules`, schedules.slice(0, REPORT_LIMITS.schedulesPerProject));
  }

  async addTombstone(projectId: string, tombstone: ReportTombstone): Promise<void> {
    for (let seq = 0; seq < 100; seq++) {
      const key = `fr:rt:${projectId}:${tombstone.deletedAt}:${seq}`;
      if (this.storage.setIfAbsent) {
        if (await this.storage.setIfAbsent(key, tombstone)) return;
      } else if ((await this.storage.get(key)) === undefined) {
        await this.storage.set(key, tombstone);
        return;
      }
    }
    throw new Error('No free tombstone key');
  }

  async listTombstones(projectId: string): Promise<ReportTombstone[]> {
    return (await queryAll(this.storage, `fr:rt:${projectId}:`)).map(r => r.value as ReportTombstone).sort((a, b) => Number(a.deletedAt < b.deletedAt) - Number(a.deletedAt > b.deletedAt));
  }

  async projects(): Promise<string[]> {
    return (await queryAll(this.storage, PROJECT_PREFIX)).map(r => r.key.slice(PROJECT_PREFIX.length)).sort();
  }

  /**
   * Records the project's current key under its own KVS key, so two projects registering at the same time
   * never drop each other (review R3-2); a renamed project keeps its id and gets its new key.
   */
  async registerProject(projectId: string, projectKey: string): Promise<void> {
    if ((await this.storage.get<string>(`${PROJECT_PREFIX}${projectId}`)) === projectKey) return;
    await this.storage.set(`${PROJECT_PREFIX}${projectId}`, projectKey);
  }

  async projectKey(projectId: string): Promise<string | undefined> {
    return this.storage.get<string>(`${PROJECT_PREFIX}${projectId}`);
  }

  saveNotReadable(reportId: string, entries: NotReadableIssue[]): Promise<number> {
    return this.saveChunks(`fr:rj:${reportId}:nr`, entries.map(e => `${e.issueId}:${e.reason}:${e.issueKey}`), REPORT_LIMITS.idsPerValue);
  }

  async loadNotReadable(reportId: string, chunks: number): Promise<NotReadableIssue[]> {
    return (await this.loadChunks(`fr:rj:${reportId}:nr`, chunks)).map(v => {
      const [issueId, reason, ...key] = v.split(':');
      return { issueId, reason: reason === 'MOVED' ? 'MOVED' : 'NOT_READABLE', issueKey: key.join(':') };
    });
  }

  deleteNotReadable(reportId: string, chunks: number): Promise<void> {
    return this.deleteChunks(`fr:rj:${reportId}:nr`, chunks);
  }

  async addTmp(id: string, entry: TmpObject): Promise<void> {
    await this.storage.set(`fr:tmp:${id}`, entry);
  }

  async listTmp(): Promise<Array<{ id: string; entry: TmpObject }>> {
    return (await queryAll(this.storage, 'fr:tmp:')).map(r => ({ id: r.key.slice('fr:tmp:'.length), entry: r.value as TmpObject }));
  }

  async deleteTmp(id: string): Promise<void> {
    await this.storage.delete(`fr:tmp:${id}`);
  }
}
