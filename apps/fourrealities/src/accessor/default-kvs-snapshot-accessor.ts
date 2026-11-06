/**
 * Copyright (c) 2026 Asymm Systems. All rights reserved.
 * @author Fahim Farook
 * FourRealities: bounded snapshot storage (spec v2, Storage Schema). No value grows with page views.
 */

import { CHUNK_SIZE_HINT, IssueRow, ProjectSummary, SnapshotMeta, StoredSnapshot, TrendPoint } from '../contract/data/models';
import { SnapshotAccessor, StorageProvider } from '../contract/accessors';

export const CHUNK_SIZE = CHUNK_SIZE_HINT;
/** Largest chunk in bytes of JSON, well under the 240 KiB KVS value limit (F-M2). */
export const CHUNK_BYTES_MAX = 200_000;
export const MAX_TREND_POINTS = 52;
export const MAX_PROJECTS = 500;
const V1_SIGNALS_PER_RUN = 100;

interface Chunk {
  snapshotId: string;
  rows: IssueRow[];
}

export class SnapshotRepository {
  constructor(private readonly storage: StorageProvider) {}

  private key(projectKey: string, part: string): string {
    return `fr:p:${projectKey}:${part}`;
  }

  /** Rows in chunks of at most CHUNK_SIZE rows and CHUNK_BYTES_MAX bytes of JSON (F-M2). */
  public static chunksOf(rows: IssueRow[]): IssueRow[][] {
    const chunks: IssueRow[][] = [];
    let current: IssueRow[] = [];
    let bytes = 0;
    for (const row of rows) {
      const size = Buffer.byteLength(JSON.stringify(row), 'utf8') + 1;
      if (current.length > 0 && (current.length >= CHUNK_SIZE || bytes + size > CHUNK_BYTES_MAX)) {
        chunks.push(current);
        current = [];
        bytes = 0;
      }
      current.push(row);
      bytes += size;
    }
    if (current.length > 0) chunks.push(current);
    return chunks;
  }

  /**
   * Writes the rows in chunks, the assignee account ids of the rows (for the personal data report,
   * ADR-014), then the project summary, then the meta. A reader that finds a chunk missing or from
   * another snapshot treats the snapshot as absent.
   */
  public async saveSnapshot(meta: SnapshotMeta, rows: IssueRow[], summary: ProjectSummary): Promise<void> {
    const previous = await this.storage.get<SnapshotMeta>(this.key(meta.projectKey, 'meta'));
    const chunks = SnapshotRepository.chunksOf(rows);
    const chunkCount = chunks.length;
    for (let i = 0; i < chunkCount; i++) {
      const chunk: Chunk = { snapshotId: meta.snapshotId, rows: chunks[i] };
      await this.storage.set(this.key(meta.projectKey, `chunk:${i}`), chunk);
    }
    const accounts = Array.from(new Set(rows.map(r => r.assigneeAccountId).filter((id): id is string => Boolean(id)))).sort();
    await this.storage.set(this.key(meta.projectKey, 'accounts'), { generatedAt: meta.generatedAt, accountIds: accounts });
    await this.storage.set(this.key(meta.projectKey, 'summary'), summary);
    await this.storage.set(this.key(meta.projectKey, 'meta'), { ...meta, chunkCount });
    for (let i = chunkCount; i < (previous?.chunkCount || 0); i++) {
      await this.storage.delete(this.key(meta.projectKey, `chunk:${i}`));
    }
  }

  public async loadSnapshot(projectKey: string): Promise<StoredSnapshot | undefined> {
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

  /**
   * Records the point for its ISO week; a later point in the same week replaces it. With restart,
   * the earlier points are dropped. The ids of the issues the point counts are stored next to the
   * trend (at most ISSUE_CAP ids), so a page view can check that the viewer can browse each one.
   */
  public async recordTrendPoint(projectKey: string, point: TrendPoint, issueIds: string[], restart: boolean): Promise<void> {
    const trend = restart ? [] : (await this.getTrend(projectKey)).filter(p => p.weekStart !== point.weekStart);
    trend.push(point);
    trend.sort((a, b) => a.weekStart.localeCompare(b.weekStart));
    await this.storage.set(this.key(projectKey, 'trend-ids'), issueIds);
    await this.storage.set(this.key(projectKey, 'trend'), trend.slice(-MAX_TREND_POINTS));
  }

  public async getTrendIssueIds(projectKey: string): Promise<string[] | undefined> {
    const ids = await this.storage.get<string[]>(this.key(projectKey, 'trend-ids'));
    return Array.isArray(ids) ? ids : undefined;
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

  /** Deletes the v1 per-view snapshot keys of one project (spec v2, Migration). */
  public async deleteV1ProjectKeys(projectKey: string): Promise<void> {
    await this.storage.delete(`fr:project:${projectKey}:latest`);
    await this.storage.delete(`fr:project:${projectKey}:history`);
  }

  /** Deletes at most 100 v1 fr:issue:{id}:signals keys; returns how many it deleted. */
  public async deleteV1Signals(): Promise<number> {
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

export class DefaultKvsSnapshotAccessor extends SnapshotRepository implements SnapshotAccessor {
  readonly serviceType = 'accessor' as const;
}
