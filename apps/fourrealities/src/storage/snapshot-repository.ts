/**
 * Copyright (c) 2026 Asymm Systems. All rights reserved.
 * @author Fahim Farook
 * FourRealities: bounded snapshot storage (spec v2, Storage Schema). No value grows with page views.
 */

import { ExceptionRecord, IssueRow, ProjectSummary, SnapshotMeta, TrendPoint } from '../domain/models';
import { normalizeException } from '../jira/issue-facts';
import { StorageProvider } from './metrics-repository';

export const CHUNK_SIZE = 100;
export const MAX_TREND_POINTS = 52;
export const MAX_PROJECTS = 500;
const V1_SIGNALS_PER_RUN = 100;

/** Monday (UTC) of the ISO week that holds the given time, as YYYY-MM-DD. */
export function weekStartOf(iso: string): string {
  const d = new Date(iso);
  const day = (d.getUTCDay() + 6) % 7;
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() - day)).toISOString().slice(0, 10);
}

interface Chunk {
  snapshotId: string;
  rows: IssueRow[];
}

export class SnapshotRepository {
  constructor(private readonly storage: StorageProvider) {}

  private key(projectKey: string, part: string): string {
    return `fr:p:${projectKey}:${part}`;
  }

  /**
   * Writes the rows in chunks, then the project summary, then the meta. A reader that finds a
   * chunk missing or from another snapshot treats the snapshot as absent.
   */
  public async saveSnapshot(meta: SnapshotMeta, rows: IssueRow[], summary: ProjectSummary): Promise<void> {
    const previous = await this.storage.get<SnapshotMeta>(this.key(meta.projectKey, 'meta'));
    const chunkCount = Math.ceil(rows.length / CHUNK_SIZE);
    for (let i = 0; i < chunkCount; i++) {
      const chunk: Chunk = { snapshotId: meta.snapshotId, rows: rows.slice(i * CHUNK_SIZE, (i + 1) * CHUNK_SIZE) };
      await this.storage.set(this.key(meta.projectKey, `chunk:${i}`), chunk);
    }
    await this.storage.set(this.key(meta.projectKey, 'summary'), summary);
    await this.storage.set(this.key(meta.projectKey, 'meta'), { ...meta, chunkCount });
    for (let i = chunkCount; i < (previous?.chunkCount || 0); i++) {
      await this.storage.delete(this.key(meta.projectKey, `chunk:${i}`));
    }
  }

  public async loadSnapshot(projectKey: string): Promise<{ meta: SnapshotMeta; rows: IssueRow[] } | undefined> {
    const meta = await this.storage.get<SnapshotMeta>(this.key(projectKey, 'meta'));
    if (!meta || meta.schemaVersion !== 2) {
      return undefined;
    }
    const rows: IssueRow[] = [];
    for (let i = 0; i < meta.chunkCount; i++) {
      const chunk = await this.storage.get<Chunk>(this.key(projectKey, `chunk:${i}`));
      if (!chunk || chunk.snapshotId !== meta.snapshotId) {
        return undefined;
      }
      rows.push(...chunk.rows);
    }
    return { meta, rows };
  }

  /** Records the point for its ISO week; a later point in the same week replaces it. */
  public async recordTrendPoint(projectKey: string, point: TrendPoint): Promise<void> {
    const trend = (await this.getTrend(projectKey)).filter(p => p.weekStart !== point.weekStart);
    trend.push(point);
    trend.sort((a, b) => a.weekStart.localeCompare(b.weekStart));
    await this.storage.set(this.key(projectKey, 'trend'), trend.slice(-MAX_TREND_POINTS));
  }

  public async getTrend(projectKey: string): Promise<TrendPoint[]> {
    return (await this.storage.get<TrendPoint[]>(this.key(projectKey, 'trend'))) || [];
  }

  /** Remembers a project for the daily snapshot. Writes only when the project is new. */
  public async registerProject(projectKey: string): Promise<void> {
    const projects = await this.listProjects();
    if (!projects.includes(projectKey) && projects.length < MAX_PROJECTS) {
      await this.storage.set('fr:projects', [...projects, projectKey]);
    }
  }

  public async listProjects(): Promise<string[]> {
    return (await this.storage.get<string[]>('fr:projects')) || [];
  }

  /** Exception records keyed by issue id, read with a paged prefix query. */
  public async listExceptions(): Promise<Map<string, ExceptionRecord>> {
    const result = new Map<string, ExceptionRecord>();
    if (!this.storage.queryPrefix) {
      return result;
    }
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

  /** Deletes the v1 per-view snapshot keys of one project (spec v2, Migration). */
  public async deleteV1ProjectKeys(projectKey: string): Promise<void> {
    await this.storage.delete(`fr:project:${projectKey}:latest`);
    await this.storage.delete(`fr:project:${projectKey}:history`);
  }

  /** Deletes at most 100 v1 fr:issue:{id}:signals keys; returns how many it deleted. */
  public async deleteV1Signals(): Promise<number> {
    if (!this.storage.queryPrefix) {
      return 0;
    }
    // Collect first, then delete, so deletes never move the query cursor.
    const keys: string[] = [];
    let cursor: string | undefined;
    do {
      const page: { results: Array<{ key: string }>; nextCursor?: string } = await this.storage.queryPrefix('fr:issue:', cursor);
      keys.push(...page.results.map(r => r.key).filter(k => k.endsWith(':signals')));
      cursor = page.nextCursor;
    } while (cursor && keys.length < V1_SIGNALS_PER_RUN);
    const batch = keys.slice(0, V1_SIGNALS_PER_RUN);
    for (const key of batch) {
      await this.storage.delete(key);
    }
    const deleted = batch.length;
    return deleted;
  }
}
