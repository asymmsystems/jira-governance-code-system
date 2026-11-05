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
 *         cp:<projectId>:plans          { v, plans }: the list of plans, with a version (F-22)
 * Writes use an atomic swap that returns the previous value. When the previous version is not
 * the version the caller started from, the previous value is restored and a conflict is returned.
 * A plan is cloned and deleted in pages of PLAN_PAGE_SIZE records, one page per call (N-02).
 */

import { WbsTask, ColumnWidthConfig, ProjectMilestone, WorkEffortRecordBody, toWorkEffortRecord, fromWorkEffortRecord, PlanMetadata } from '../domain/models';
import { StorageProvider } from './plan-repository';
import { deleteLegacyBaselineKeys } from './baseline-repository';
import { BaselineStore } from './baseline-store';

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
  jqlFilter?: string; // the plan reads only the project's issues that match this JQL (F-27)
}

/** Records copied or deleted in one call (N-02): small enough for one resolver call. */
export const PLAN_PAGE_SIZE = 100;

/** The stored plan list: the plans and a version that every change checks (F-22). */
export interface PlanList {
  v: number;
  plans: PlanMetadata[];
}

/** The result of one page of a clone or a delete. */
export interface PlanPageResult {
  ok: boolean;
  done: boolean;
  remaining: number;
}

const MAIN_PLAN: PlanMetadata = { id: 'default', name: 'Main Plan', createdAt: new Date(0).toISOString(), isDefault: true };

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

  constructor(
    private readonly storage: StorageProvider,
    private readonly projectId: string,
    private readonly projectKey: string,
    private readonly planId: string = 'default'
  ) {
    if (!storage.query || !storage.swap) {
      throw new Error('CascadePlan: the storage provider must support query and swap');
    }
    const cleanPlanId = planId && planId !== 'default' ? `plan:${planId}:` : '';
    this.prefix = `cp:${projectId}:${cleanPlanId}we:`;
    this.settingsKey = `cp:${projectId}:${cleanPlanId}settings`;
  }

  getSettingsKey(): string {
    return this.settingsKey;
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

  private plansKey(): string {
    return `cp:${this.projectId}:plans`;
  }

  /** The plan list and its version. An older list stored as a plain array reads as version 0. */
  async readPlanList(): Promise<PlanList> {
    const raw = await this.storage.get<PlanList | PlanMetadata[]>(this.plansKey());
    const plans = Array.isArray(raw) ? raw : (raw && Array.isArray(raw.plans) ? raw.plans : []);
    const v = Array.isArray(raw) || !raw ? 0 : (raw.v || 0);
    return { v, plans: plans.length > 0 ? plans : [{ ...MAIN_PLAN }] };
  }

  async listPlans(): Promise<PlanMetadata[]> {
    return (await this.readPlanList()).plans;
  }

  /**
   * Changes the plan list with a version check (F-22). `change` gets a copy of the current plans and
   * returns the new list, or null to change nothing. When another writer saved the list first, its
   * value is put back and the change is applied again to it, at most 3 times.
   */
  async updatePlans(change: (plans: PlanMetadata[]) => PlanMetadata[] | null): Promise<{ ok: boolean; plans: PlanMetadata[] }> {
    for (let attempt = 0; attempt < 3; attempt++) {
      const cur = await this.readPlanList();
      const next = change(cur.plans.map(p => ({ ...p })));
      if (!next) return { ok: false, plans: cur.plans };
      const previous = await this.storage.swap!<PlanList | PlanMetadata[]>(this.plansKey(), { v: cur.v + 1, plans: next });
      const prevV = !previous || Array.isArray(previous) ? 0 : (previous.v || 0);
      if (prevV === cur.v) return { ok: true, plans: next };
      if (previous) await this.storage.set(this.plansKey(), previous);
    }
    throw new PlanListBusyError();
  }

  /** A new plan. A clone is listed as 'copying' until copyPlanPage has copied every record (N-02). */
  async createPlan(name: string, cloneFromPlanId?: string): Promise<PlanMetadata> {
    const id = `plan-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
    const newPlan: PlanMetadata = { id, name: name.trim(), createdAt: new Date().toISOString() };
    if (cloneFromPlanId) {
      const source = new PlanStore(this.storage, this.projectId, this.projectKey, cloneFromPlanId);
      // The settings first, so the copy is complete once the records are.
      const settings = await source.getSettings();
      if (Object.keys(settings).length > 0) {
        await new PlanStore(this.storage, this.projectId, this.projectKey, id).saveSettings(settings);
      }
      newPlan.state = 'copying';
      newPlan.copyFrom = cloneFromPlanId || 'default';
    }
    await this.updatePlans(plans => [...plans, newPlan]);
    return newPlan;
  }

  /**
   * Copies the next page of records of a 'copying' plan from its source. Records already copied
   * are skipped, so a page can be run again. The last page marks the plan ready.
   */
  async copyPlanPage(planId: string): Promise<PlanPageResult> {
    const plan = (await this.listPlans()).find(p => p.id === planId);
    if (!plan || plan.state !== 'copying') return { ok: !!plan && !plan.state, done: true, remaining: 0 };
    const source = new PlanStore(this.storage, this.projectId, this.projectKey, plan.copyFrom || 'default');
    const target = new PlanStore(this.storage, this.projectId, this.projectKey, planId);
    const copied = new Set((await this.storage.query!<StoredRecord>(target.prefix)).map(r => r.key.slice(target.prefix.length)));
    const todo = (await this.storage.query!<StoredRecord>(source.prefix)).filter(r => !copied.has(r.key.slice(source.prefix.length)));
    // The target records are new, and writes to a 'copying' plan are refused, so a plain set is safe.
    for (const row of todo.slice(0, PLAN_PAGE_SIZE)) {
      await this.storage.set(`${target.prefix}${row.key.slice(source.prefix.length)}`, { ...row.value, version: 1 });
    }
    const remaining = Math.max(0, todo.length - PLAN_PAGE_SIZE);
    if (remaining === 0) {
      await this.updatePlans(plans => plans.map(p => {
        if (p.id !== planId || p.state !== 'copying') return p;
        const { state: _s, copyFrom: _c, ...ready } = p;
        return ready;
      }));
    }
    return { ok: true, done: remaining === 0, remaining };
  }

  /**
   * Starts a delete: the plan is marked 'deleting', so it is not opened and takes no writes. It
   * stays in the list until deletePlanPage has removed its last record, so nothing is orphaned.
   */
  async deletePlan(planId: string): Promise<boolean> {
    if (!planId || planId === 'default') return false;
    const res = await this.updatePlans(plans => {
      const idx = plans.findIndex(p => p.id === planId);
      if (idx === -1) return null;
      plans[idx] = { ...plans[idx], state: 'deleting' };
      return plans;
    });
    return res.ok;
  }

  /** Deletes the next page of records of a 'deleting' plan; the last page removes it from the list. */
  async deletePlanPage(planId: string): Promise<PlanPageResult> {
    const plan = (await this.listPlans()).find(p => p.id === planId);
    if (!plan || plan.state !== 'deleting') return { ok: !plan, done: true, remaining: 0 };
    const target = new PlanStore(this.storage, this.projectId, this.projectKey, planId);
    const rows = await this.storage.query!<StoredRecord>(target.prefix);
    for (const row of rows.slice(0, PLAN_PAGE_SIZE)) await this.storage.delete(row.key);
    const remaining = Math.max(0, rows.length - PLAN_PAGE_SIZE);
    if (remaining === 0) {
      // The plan's baselines and scope-change requests go with it (F-22, ADR-009), and any left by
      // earlier development builds under the project key.
      await new BaselineStore(this.storage, this.projectId, planId).deleteAll();
      await deleteLegacyBaselineKeys(this.storage, this.projectKey, planId);
      await this.storage.delete(target.getSettingsKey());
      await this.updatePlans(plans => plans.filter(p => p.id !== planId));
    }
    return { ok: true, done: remaining === 0, remaining };
  }

  async renamePlan(planId: string, newName: string): Promise<PlanMetadata | null> {
    const trimmed = newName.trim();
    let renamed: PlanMetadata | null = null;
    await this.updatePlans(plans => {
      const plan = plans.find(p => p.id === planId && !p.state);
      if (!plan) return null;
      plan.name = trimmed;
      renamed = plan;
      return plans;
    });
    return renamed;
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

/** The plan list kept changing under this write (three tries); nothing was changed. */
export class PlanListBusyError extends Error {
  constructor() {
    super('Someone else is changing the plans of this project. Try again.');
    this.name = 'PlanListBusyError';
  }
}
