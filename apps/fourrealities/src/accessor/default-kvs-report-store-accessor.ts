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
 *   fr:p:{projectKey}:rep:{createdAt}:{id}  one ReportIndexEntry per report, at most 200 per project; each writer
 *                                           writes only its own report's key (review M-1). The older single value
 *                                           fr:p:{projectKey}:reports is moved to these keys when it is read.
 *   fr:p:{projectKey}:reports:head          ChainLink of the newest DONE report
 *   fr:p:{projectKey}:schedules             ReportSchedule[], at most 5
 *   fr:rt:{projectKey}:{deletedAt}:{seq}    ReportTombstone, written once
 *   fr:reports:projects                     { projectKey: projectId } of the projects with reports or schedules
 *   fr:tmp:{id}                             a temporary people file (Object Store cannot list its objects)
 */

import { ChainLink, DEFAULT_REPORT_SETTINGS, REPORT_LIMITS, ReportIndexEntry, ReportJob, ReportSchedule, ReportSettings, ReportTombstone, TmpObject } from '../contract/data/reports';
import { StorageProvider } from '../contract/accessors';
import { ReportStoreAccessor } from '../contract/reports';
import { queryAll } from './kvs-v2-exception';

const PROJECTS = 'fr:reports:projects';
const entryKey = (projectKey: string, e: ReportIndexEntry) => `fr:p:${projectKey}:rep:${e.createdAt}:${e.reportId}`;

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
  async getIndex(projectKey: string): Promise<ReportIndexEntry[]> {
    const legacy = await this.storage.get<ReportIndexEntry[]>(`fr:p:${projectKey}:reports`);
    if (legacy) {
      for (const e of legacy) await this.putEntry(projectKey, e);
      await this.storage.delete(`fr:p:${projectKey}:reports`);
    }
    const rows = (await queryAll(this.storage, `fr:p:${projectKey}:rep:`)).map(r => r.value as ReportIndexEntry);
    return rows.sort((x, y) => (x.createdAt < y.createdAt ? 1 : x.createdAt > y.createdAt ? -1 : x.reportId < y.reportId ? 1 : -1));
  }

  async putEntry(projectKey: string, entry: ReportIndexEntry): Promise<void> {
    await this.storage.set(entryKey(projectKey, entry), entry);
  }

  async deleteEntry(projectKey: string, entry: ReportIndexEntry): Promise<void> {
    await this.storage.delete(entryKey(projectKey, entry));
  }

  /** Makes the index exactly these entries (tests and tools; the Manager writes one entry at a time). */
  async saveIndex(projectKey: string, entries: ReportIndexEntry[]): Promise<void> {
    const keep = new Set(entries.slice(0, REPORT_LIMITS.reportsPerProject).map(e => entryKey(projectKey, e)));
    for (const r of await queryAll(this.storage, `fr:p:${projectKey}:rep:`)) if (!keep.has(r.key)) await this.storage.delete(r.key);
    for (const e of entries.slice(0, REPORT_LIMITS.reportsPerProject)) await this.putEntry(projectKey, e);
  }

  getHead(projectKey: string): Promise<ChainLink | undefined> {
    return this.storage.get<ChainLink>(`fr:p:${projectKey}:reports:head`);
  }

  commitDone(job: ReportJob, projectKey: string, entry: ReportIndexEntry, head: ChainLink): Promise<void> {
    return writeAll(this.storage, [
      { key: `fr:rj:${job.reportId}`, value: job },
      { key: entryKey(projectKey, entry), value: entry },
      { key: `fr:p:${projectKey}:reports:head`, value: head }
    ]);
  }

  async getSchedules(projectKey: string): Promise<ReportSchedule[]> {
    return (await this.storage.get<ReportSchedule[]>(`fr:p:${projectKey}:schedules`)) || [];
  }

  async saveSchedules(projectKey: string, schedules: ReportSchedule[]): Promise<void> {
    await this.storage.set(`fr:p:${projectKey}:schedules`, schedules.slice(0, REPORT_LIMITS.schedulesPerProject));
  }

  async addTombstone(projectKey: string, tombstone: ReportTombstone): Promise<void> {
    for (let seq = 0; seq < 100; seq++) {
      const key = `fr:rt:${projectKey}:${tombstone.deletedAt}:${seq}`;
      if (this.storage.setIfAbsent) {
        if (await this.storage.setIfAbsent(key, tombstone)) return;
      } else if ((await this.storage.get(key)) === undefined) {
        await this.storage.set(key, tombstone);
        return;
      }
    }
    throw new Error('No free tombstone key');
  }

  async listTombstones(projectKey: string): Promise<ReportTombstone[]> {
    return (await queryAll(this.storage, `fr:rt:${projectKey}:`)).map(r => r.value as ReportTombstone).sort((a, b) => (a.deletedAt < b.deletedAt ? 1 : a.deletedAt > b.deletedAt ? -1 : 0));
  }

  async projects(): Promise<string[]> {
    return Object.keys((await this.storage.get<Record<string, string>>(PROJECTS)) || {}).sort();
  }

  async registerProject(projectKey: string, projectId: string): Promise<void> {
    const map = (await this.storage.get<Record<string, string>>(PROJECTS)) || {};
    if (map[projectKey] === projectId) return;
    await this.storage.set(PROJECTS, { ...map, [projectKey]: projectId });
  }

  async projectId(projectKey: string): Promise<string | undefined> {
    return ((await this.storage.get<Record<string, string>>(PROJECTS)) || {})[projectKey];
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
