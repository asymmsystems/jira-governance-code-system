/*
 * Copyright (c) 2026 Asymm Systems. All rights reserved.
 *
 * @author Fahim Farook
 */

/**
 * CascadePlan: per-issue planning records in KVS (spec section 5; B-09, INV-07, INV-08).
 *
 * Keys:   cp:<projectId>:we:<issueId>   one record per issue (app-owned planning data only)
 *         cp:<projectId>:settings       column widths, hidden columns, milestones, migratedAt
 * Writes use an atomic swap that returns the previous value. When the previous version is not
 * the version the caller started from, the previous value is restored and a conflict is returned.
 */

import { WbsTask, ColumnWidthConfig, ProjectMilestone, WorkEffortRecordBody, toWorkEffortRecord, fromWorkEffortRecord } from '../domain/models';
import { StorageProvider } from './plan-repository';

export interface StoredEntry extends Partial<WbsTask> {
  issueKey: string;
  issueId: string;
  version: number;
  sequenceNum?: number;
}

/** The KVS value of one issue: its WorkEffort record plus bookkeeping. */
export interface StoredRecord extends WorkEffortRecordBody {
  issueKey: string;
  issueId: string;
  version: number;
}

function toStoredEntry(rec: StoredRecord): StoredEntry {
  if (!rec) return rec;
  return { ...fromWorkEffortRecord(rec), issueKey: rec.issueKey, issueId: rec.issueId, version: rec.version } as StoredEntry;
}

export interface PlanSettings {
  columnWidths?: ColumnWidthConfig;
  hiddenColumns?: string[];
  milestones?: ProjectMilestone[];
  migratedAt?: string;
  modelVersion?: number; // WorkEffort record model of every record (B-28)
}

export interface PutResult {
  ok: boolean;
  conflict?: boolean;
  entry: StoredEntry;
}

const LEGACY_JIRA_FIELDS = [
  'summary', 'status', 'resource', 'resourceAccountId', 'isPlaceholderResource', 'epic', 'epicKey', 'story', 'storyKey',
  'effortHours', 'parentKey', 'parentId', 'isSubtask', 'isEpic', 'hierarchyLevel', 'id', 'key'
];

/**
 * Sequence number between two neighbours; gaps of 1000 leave room for later inserts.
 */
export function sequenceBetween(prev: number | undefined, next: number | undefined): number {
  if (prev === undefined && next === undefined) return 1000;
  if (prev === undefined) return (next as number) - 1000;
  if (next === undefined) return prev + 1000;
  return (prev + next) / 2;
}

export class PlanStore {
  private readonly prefix: string;
  private readonly settingsKey: string;
  private keyByIssue: Map<string, string> | null = null;

  constructor(private readonly storage: StorageProvider, private readonly projectId: string, private readonly projectKey: string) {
    if (!storage.query || !storage.swap) {
      throw new Error('CascadePlan: the storage provider must support query and swap');
    }
    this.prefix = `cp:${projectId}:we:`;
    this.settingsKey = `cp:${projectId}:settings`;
  }

  /** Every record of the project, by issue key. */
  async loadEntries(): Promise<Map<string, StoredEntry>> {
    const rows = await this.storage.query!<StoredRecord>(this.prefix);
    const out = new Map<string, StoredEntry>();
    this.keyByIssue = new Map();
    for (const row of rows) {
      out.set(row.value.issueKey, toStoredEntry(row.value));
      this.keyByIssue.set(row.value.issueKey, row.key);
    }
    return out;
  }

  private async storageKeyFor(issueKey: string, issueId: string | undefined): Promise<string> {
    if (!this.keyByIssue) await this.loadEntries();
    return this.keyByIssue!.get(issueKey) || `${this.prefix}${issueId || issueKey}`;
  }

  /**
   * Writes the app-owned entry of an issue. baseVersion is the version the caller read; when it
   * is omitted, the version found just before the write is used.
   */
  async putEntry(issueKey: string, issueId: string | undefined, entry: Partial<WbsTask>, baseVersion?: number): Promise<PutResult> {
    const key = await this.storageKeyFor(issueKey, issueId);
    const existing = await this.storage.get<StoredRecord>(key);
    const expected = baseVersion !== undefined ? baseVersion : (existing ? existing.version : 0);
    const current = existing ? existing.version : 0;
    if (current !== expected) {
      return { ok: false, conflict: true, entry: toStoredEntry(existing as StoredRecord) };
    }
    // The stored value is the WorkEffort record (B-24); Jira-owned fields are not part of it.
    const record: StoredRecord = {
      ...toWorkEffortRecord(issueKey, entry),
      issueKey,
      issueId: existing ? existing.issueId : (issueId || issueKey),
      version: expected + 1
    };
    const previous = await this.storage.swap!<StoredRecord>(key, record);
    const previousVersion = previous ? previous.version : 0;
    if (previousVersion !== expected) {
      // Another writer saved first: put its value back and report the conflict.
      if (previous) await this.storage.set(key, previous);
      return { ok: false, conflict: true, entry: toStoredEntry(previous as StoredRecord) };
    }
    this.keyByIssue!.set(issueKey, key);
    return { ok: true, entry: toStoredEntry(record) };
  }

  async deleteEntry(issueKey: string): Promise<void> {
    if (!this.keyByIssue) await this.loadEntries();
    const key = this.keyByIssue!.get(issueKey);
    if (!key) return;
    await this.storage.delete(key);
    this.keyByIssue!.delete(issueKey);
  }

  async getSettings(): Promise<PlanSettings> {
    return (await this.storage.get<PlanSettings>(this.settingsKey)) || {};
  }

  async saveSettings(patch: Partial<PlanSettings>): Promise<PlanSettings> {
    const next = { ...(await this.getSettings()), ...patch };
    await this.storage.set(this.settingsKey, next);
    return next;
  }

  /**
   * One-time migration from the legacy keys (scheduleMap, taskOrder, colWidths, hiddenColumns,
   * milestones, ps:plan, ps:<key>:task:*). Writes every new record first, then deletes the old keys.
   * Returns true when legacy data was migrated.
   */
  async ensureMigrated(idByKey: Map<string, string>, convert: (issueKey: string, entry: Partial<WbsTask>) => Partial<WbsTask> = (_k, e) => e): Promise<boolean> {
    const settings = await this.getSettings();
    if (settings.migratedAt) return false;
    const k = this.projectKey;
    const map = (await this.storage.get<Record<string, Partial<WbsTask>>>(`scheduleMap:${k}`)) || {};
    const order = (await this.storage.get<string[]>(`taskOrder:${k}`)) || [];
    const widths = await this.storage.get<ColumnWidthConfig>(`colWidths:${k}`);
    const hidden = await this.storage.get<string[]>(`hiddenColumns:${k}`);
    const milestones = await this.storage.get<ProjectMilestone[]>(`milestones:${k}`);
    const legacy = Object.keys(map).length > 0 || order.length > 0 || !!widths || !!hidden || !!milestones;

    for (const [issueKey, raw] of Object.entries(map)) {
      const entry: Record<string, unknown> = { ...raw };
      for (const f of LEGACY_JIRA_FIELDS) delete entry[f];
      if (entry.manualProgress !== true) delete entry.progress;
      const pos = order.indexOf(issueKey);
      if (pos !== -1) entry.sequenceNum = (pos + 1) * 1000;
      await this.putEntry(issueKey, idByKey.get(issueKey), convert(issueKey, entry as Partial<WbsTask>));
    }
    const patch: Partial<PlanSettings> = { migratedAt: new Date().toISOString() };
    if (widths) patch.columnWidths = widths;
    if (hidden) patch.hiddenColumns = hidden;
    if (milestones) patch.milestones = milestones;
    await this.saveSettings(patch);

    if (legacy) {
      for (const old of [`scheduleMap:${k}`, `taskOrder:${k}`, `colWidths:${k}`, `hiddenColumns:${k}`, `milestones:${k}`, `ps:plan:${k}`, `ps:resmeta:${k}`]) {
        await this.storage.delete(old);
      }
      for (const issueKey of Object.keys(map)) await this.storage.delete(`ps:${k}:task:${issueKey}`);
    }
    return legacy;
  }
}
