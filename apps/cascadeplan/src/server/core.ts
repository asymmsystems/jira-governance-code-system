/*
 * Copyright (c) 2026 Asymm Systems. All rights reserved.
 *
 * @author Fahim Farook
 */

/**
 * CascadePlan server: Storage and its retries, the Jira caller, request-scoped "today", date helpers, plan store helpers and defaults.
 * Split from src/index.ts without changes to any statement (F-31).
 */

import api, { route } from '@forge/api';
import { AsyncLocalStorage } from 'async_hooks';
import { kvs, WhereConditions } from '@forge/kvs';
import { WbsTask, WeeklySprintColumn, ProjectMilestone, ColumnWidthConfig, JiraSyncReport, JiraWriteRecord } from '../domain/models';
import { PlannerEngine } from '../domain/planner-engine';
import { JiraFieldChange } from '../domain/jira-change';
import { StorageProvider } from '../storage/plan-repository';
import { PlanStore, StoredEntry, sequenceBetween } from '../storage/plan-store';
import { logFailure } from '../logger';
import { forbiddenResult, PermissionCheckError, ForbiddenError } from '../security/write-permissions';
import { ValidationError, assertIssueKey, validatePlanId, toValidationResult } from '../validation';

/** Forge storage refused the call for its rate limit, also after the retries (C10). */
export class StorageBusyError extends Error {
  constructor() {
    super('CascadePlan is busy. Try again in a minute.');
    this.name = 'StorageBusyError';
  }
}

/** True for Forge storage's rate-limit errors, by code or status, not by error class (C10). */
export function isRateLimited(err: any): boolean {
  const code = err?.code;
  const status = err?.responseDetails?.status ?? err?.status;
  return code === 'RATE_LIMIT_EXCEEDED' || code === 'TOO_MANY_REQUESTS' || status === 429;
}

/**
 * Retries a storage call after a rate-limit error: waits 1, 2 and 4 s (7 s in all, inside the 25 s
 * resolver limit), then gives up with StorageBusyError, which the resolver reports plainly (C10).
 */
export async function withKvsRetry<T>(fn: () => Promise<T>): Promise<T> {
  for (let attempt = 0; ; attempt++) {
    try {
      return await fn();
    } catch (err) {
      if (!isRateLimited(err)) throw err;
      if (attempt >= 3) {
        logFailure('kvs', err);
        throw new StorageBusyError();
      }
      await sleep(1000 * 2 ** attempt);
    }
  }
}

export class ForgeKvsProvider implements StorageProvider {
  async get<T>(key: string): Promise<T | undefined> {
    const val = await withKvsRetry(() => kvs.get(key));
    return val as T;
  }

  async set(key: string, value: any): Promise<void> {
    await withKvsRetry(() => kvs.set(key, value));
  }

  async delete(key: string): Promise<void> {
    await withKvsRetry(() => kvs.delete(key));
  }

  async query<T>(prefix: string): Promise<Array<{ key: string; value: T }>> {
    const out: Array<{ key: string; value: T }> = [];
    let cursor: string | undefined;
    do {
      let q = kvs.query().where('key', WhereConditions.beginsWith(prefix)).limit(100);
      if (cursor) q = q.cursor(cursor);
      const page = await withKvsRetry(() => q.getMany<T>());
      for (const r of page.results) out.push({ key: r.key, value: r.value });
      cursor = page.nextCursor;
    } while (cursor);
    return out;
  }

  async queryPage<T>(prefix: string, limit: number, cursor?: string): Promise<{ results: Array<{ key: string; value: T }>; nextCursor?: string }> {
    let q = kvs.query().where('key', WhereConditions.beginsWith(prefix)).limit(limit);
    if (cursor) q = q.cursor(cursor);
    const page = await withKvsRetry(() => q.getMany<T>());
    return { results: page.results.map(r => ({ key: r.key, value: r.value })), nextCursor: page.nextCursor || undefined };
  }

  async swap<T>(key: string, value: T): Promise<T | undefined> {
    const res = await withKvsRetry(() => kvs.set<T, T>(key, value, { keyPolicy: 'OVERRIDE', returnValue: 'PREVIOUS' }));
    return res ? res.value : undefined;
  }
}

export let globalStorageProvider: StorageProvider | null = null;

export function setGlobalStorageProvider(provider: StorageProvider | null): void {
  globalStorageProvider = provider;
}

export function resolveStorage(customProvider?: StorageProvider): StorageProvider {
  if (customProvider) return customProvider;
  if (globalStorageProvider) return globalStorageProvider;
  if (process.env.NODE_ENV === 'test') {
    throw new Error('CascadePlan: StorageProvider must be initialized in test mode.');
  }
  return new ForgeKvsProvider();
}

export let sleep = (ms: number): Promise<void> => new Promise(resolve => setTimeout(resolve, ms));

/** Replaces the wait used by the 429 backoff (tests only). */
export function setSleepForTests(fn: (ms: number) => Promise<void>): void {
  sleep = fn;
}

export const RETRY_BUDGET_MS = 20000;
export const MAX_RETRIES = 3;

/**
 * Wraps a Jira caller so that a 429 is retried after Retry-After (1 s when missing), at most
 * three times and never waiting more than 20 s in total (resolver limit is 25 s, RS-19).
 */
export function withRetry(caller: { requestJira: (...args: any[]) => Promise<any> }) {
  return {
    requestJira: async (r: any, opts?: any): Promise<any> => {
      let waited = 0;
      for (let attempt = 0; ; attempt++) {
        const res = opts === undefined ? await caller.requestJira(r) : await caller.requestJira(r, opts);
        if (!res || res.status !== 429 || attempt >= MAX_RETRIES) return res;
        const header = Number(res.headers && typeof res.headers.get === 'function' ? res.headers.get('retry-after') : NaN);
        const ms = Number.isFinite(header) && header > 0 ? header * 1000 : 1000;
        if (waited + ms > RETRY_BUDGET_MS) return res;
        await sleep(ms);
        waited += ms;
      }
    }
  };
}

/**
 * The only way CascadePlan calls Jira: as the user who invoked the resolver, so Jira applies that
 * user's permissions and issue security. CascadePlan never calls Jira as the app. Where there is no
 * user (the issue-deleted trigger and the personal data report), the code makes no Jira call; a call
 * without a user context fails here instead of falling back to the app.
 */
export function getJiraCaller() {
  if (typeof api.asUser !== 'function') {
    throw new Error('CascadePlan calls Jira only as the user, and no user context is available');
  }
  return withRetry(api.asUser());
}

/**
 * Throws ValidationError unless Jira reports the issue as part of the given project (INV-15).
 */
export async function verifyIssueInProject(issueKey: unknown, projectKey: string, field: string): Promise<string | undefined> {
  assertIssueKey(issueKey, field);
  let projectOfIssue: string | undefined;
  let issueId: string | undefined;
  try {
    const res = await getJiraCaller().requestJira(route`/rest/api/3/issue/${issueKey}?fields=project`);
    if (res && res.status === 200) {
      const data = await res.json();
      projectOfIssue = data?.fields?.project?.key;
      issueId = data?.id !== undefined ? String(data.id) : undefined;
    }
  } catch (err) { logFailure('verifyIssueInProject', err); }
  if (projectOfIssue !== projectKey) {
    throw new ValidationError(field, `${issueKey} is not in project ${projectKey}`);
  }
  return issueId;
}

/**
 * Runs a resolver and maps a ValidationError to { ok: false, error: 'validation', field, message }.
 */
export async function withValidation<T>(fn: () => Promise<T>): Promise<T | ReturnType<typeof toValidationResult>> {
  try {
    return await fn();
  } catch (err) {
    // A permission check that could not run refuses the write (BL-2: fail closed).
    if (err instanceof PermissionCheckError || err instanceof ForbiddenError) return forbiddenResult(err.message);
    if (err instanceof StorageBusyError) return { ok: false, success: false, error: 'busy', message: err.message } as any;
    const result = toValidationResult(err);
    if (result) return result;
    throw err;
  }
}

/**
 * Collects the result of every Jira write that one resolver call makes (B-07, INV-05).
 */
export class SyncLog {
  private readonly writes: JiraWriteRecord[] = [];

  record(key: string, fields: string[], result: { synced: boolean; error?: string }, changes?: JiraFieldChange[]): void {
    if (!fields || fields.length === 0) return;
    const entry: JiraWriteRecord = { key, fields, ok: result.synced };
    if (!result.synced) entry.error = result.error || 'Jira rejected the change';
    if (changes) entry.changes = changes;
    this.writes.push(entry);
  }

  report(): JiraSyncReport {
    const failed = this.writes.filter(w => !w.ok);
    const out: JiraSyncReport = { ok: failed.length === 0, writes: [...this.writes] };
    if (failed.length > 0) out.error = failed.map(w => `${w.key}: ${w.error}`).join('; ');
    return out;
  }
}

export function noJiraWrites(): JiraSyncReport {
  return { ok: true, writes: [] };
}

export function failedCreate(error: string): JiraSyncReport {
  return { ok: false, error, writes: [{ key: 'new issue', fields: ['create'], ok: false, error }] };
}

/**
 * Fields that Jira owns. They are read live on every load and never stored in KVS (INV-04).
 */
export const JIRA_OWNED_FIELDS = [
  'summary', 'status', 'resource', 'resourceAccountId', 'isPlaceholderResource', 'epic', 'epicKey', 'story', 'storyKey',
  'effortHours', 'parentKey', 'parentId', 'isSubtask', 'isEpic', 'hierarchyLevel', 'id', 'key', 'jiraDueDate',
  'contributingResources', 'jiraBlockedBy', 'datesFromChildren', 'model', 'localSubtasks'
];

/**
 * Copy of a stored schedule entry with every Jira-owned field removed. Progress is kept only
 * when the user set it by hand (manualProgress). Idempotent.
 */
export function stripJiraOwnedFields(entry: Partial<WbsTask>): Partial<WbsTask> {
  const out: Record<string, unknown> = { ...entry };
  for (const f of JIRA_OWNED_FIELDS) delete out[f];
  if (out.manualProgress !== true) delete out.progress;
  if (out.manualProgress === false) delete out.manualProgress;
  if (out.manualTargetProgress === false) {
    delete out.manualTargetProgress;
    delete out.targetProgress;
  }
  delete out.removeSubtaskAction;
  return out as Partial<WbsTask>;
}

export function isIsoDate(v: unknown): v is string {
  return typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v);
}

/** Adds whole days to an ISO date (UTC). */
export function addDaysIso(iso: string, days: number): string {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/** Index of the week whose date range contains the ISO date, or -1. */
export function weekIndexContaining(weeks: WeeklySprintColumn[], iso: string | undefined): number {
  if (!isIsoDate(iso)) return -1;
  return weeks.findIndex(w => w.startDate <= iso && w.endDate >= iso);
}

/**
 * F-29: "today" of the request is the user's local date when the client sent one within a day of the
 * server's UTC date (requestScope, set per resolver call); otherwise the UTC date.
 */
export const requestScope = new AsyncLocalStorage<{ today?: string }>();

export function clientTodayOf(value: unknown, now: Date = new Date()): string | undefined {
  if (typeof value !== 'string' || !isIsoDate(value)) return undefined;
  const diff = Math.abs(Date.parse(`${value}T00:00:00Z`) - Date.parse(`${now.toISOString().slice(0, 10)}T00:00:00Z`)) / 86400000;
  return diff <= 1 ? value : undefined;
}

/** Runs fn with the client's local date as "today" for this request. */
export function withClientToday<T>(clientToday: unknown, fn: () => Promise<T>): Promise<T> {
  return requestScope.run({ today: clientTodayOf(clientToday) }, fn);
}

export function todayIso(d?: Date): string {
  if (d) return d.toISOString().slice(0, 10);
  return requestScope.getStore()?.today || new Date().toISOString().slice(0, 10);
}

export { engineInputs } from '../domain/drop-plan';

/** Week index for a date, clamped to the visible window (display only; dates stay exact). */
export function clampedWeekIndex(weeks: WeeklySprintColumn[], iso: string): number {
  const idx = weekIndexContaining(weeks, iso);
  if (idx !== -1) return idx;
  return iso < weeks[0].startDate ? 0 : weeks.length - 1;
}

/** Week-grid fields for exact dates. */
export function gridFor(weeks: WeeklySprintColumn[], start: string, end: string): Partial<WbsTask> {
  const sIdx = clampedWeekIndex(weeks, start);
  const eIdx = Math.max(sIdx, clampedWeekIndex(weeks, end));
  const span = eIdx - sIdx + 1;
  return { startWeek: weeks[sIdx].weekKey, endWeek: weeks[eIdx].weekKey, spanWeeks: span, weeklyAllocations: evenAllocations(weeks, sIdx, span) };
}

export function evenAllocations(weeks: WeeklySprintColumn[], startIdx: number, span: number): Record<string, number> {
  const allocations: Record<string, number> = {};
  for (let i = startIdx; i < Math.min(weeks.length, startIdx + span); i++) {
    allocations[weeks[i].weekKey] = Math.round(100 / span);
  }
  return allocations;
}

/**
 * The planning store of a project. Records are keyed by the project id from the Forge context;
 * direct callers without a context use the project key (B-09).
 */
export function openStore(storage: StorageProvider, projectKey: string, projectId?: string, planId?: string): PlanStore {
  return new PlanStore(storage, projectId || projectKey, projectKey, planId);
}

/** True for the Main Plan (no plan id, or 'default'). */
export function isMainPlan(planId?: string): boolean {
  return !planId || planId === 'default';
}

/**
 * The fields that place a task on the timeline. Jira is the single truth for a task, so these have
 * one value per task: every plan shows the same dates, read from the issue property DATES_PROPERTY
 * and the Jira due date (ADR-008). A plan record keeps them only for a task not yet moved since.
 * Order, columns, milestones and dependency settings stay per plan.
 */
export const SHARED_DATE_FIELDS = ['startDate', 'endDate', 'startWeek', 'endWeek', 'spanWeeks', 'weeklyAllocations'] as const;

/** The Jira issue property that holds a task's shared start, and its end when Jira has no due date (ADR-008). */
export const DATES_PROPERTY = 'cascadeplan.dates';

/** The Jira issue property on a successor: the trigger percent of each incoming link, by predecessor id (ADR-006). */
export const LINKS_PROPERTY = 'cascadeplan.links';

/**
 * The plan a write goes to: undefined for the Main Plan, else the id of a plan that still exists.
 * A write to a plan that was deleted (for example in another tab) is refused, so it never lands in
 * orphaned keys or in the Main Plan.
 */
export async function writablePlanId(storage: StorageProvider, projectKey: string, projectId: string | undefined, planId: unknown): Promise<string | undefined> {
  validatePlanId(planId);
  if (isMainPlan(planId as string | undefined)) return undefined;
  const plan = (await openStore(storage, projectKey, projectId).listPlans()).find(p => p.id === planId);
  if (!plan || plan.state === 'deleting') {
    throw new ValidationError('planId', 'This plan no longer exists. Reload to see the current plans.');
  }
  // A clone takes no writes until every record is copied (N-02).
  if (plan.state === 'copying') throw new ValidationError('planId', 'This plan is still being copied. Open it again when the copy has finished.');
  return planId as string;
}

/**
 * Sequence number for a row inserted at targetIndex among the ordered scheduled entries.
 */
export function sequenceForIndex(entries: Map<string, StoredEntry>, issueKey: string, targetIndex?: number): number {
  const seqs = [...entries.values()]
    .filter(e => e.issueKey !== issueKey && typeof e.sequenceNum === 'number' && e.startWeek)
    .map(e => e.sequenceNum as number)
    .sort((a, b) => a - b);
  if (typeof targetIndex !== 'number' || targetIndex < 0 || targetIndex >= seqs.length) {
    return sequenceBetween(seqs[seqs.length - 1], undefined);
  }
  return sequenceBetween(seqs[targetIndex - 1], seqs[targetIndex]);
}

export function conflictResult(issueKey: string): any {
  return {
    ok: false, success: false, error: 'conflict', conflict: true,
    message: `Someone else changed ${issueKey} a moment ago. Reload to see the latest plan, then try again.`,
    jiraSync: { ok: true, writes: [] }
  };
}

export function getTimelineWeeks(referenceDate: Date = new Date()): { weeks: WeeklySprintColumn[]; currentWeekIndex: number } {
  return PlannerEngine.generateDynamicWeeks(referenceDate, 4, 10);
}

export function getDefaultWeeks(referenceDate: Date = new Date()): WeeklySprintColumn[] {
  return getTimelineWeeks(referenceDate).weeks;
}

export const DEFAULT_COLUMN_WIDTHS: ColumnWidthConfig = {
  epic: 110,
  story: 100,
  task: 260,
  resource: 130,
  effort: 75,
  progress: 95,
  target: 95,
  status: 125
};

export const DEFAULT_MILESTONES: ProjectMilestone[] = [];
