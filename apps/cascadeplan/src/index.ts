/*
 * Copyright (c) 2026 Asymm Systems. All rights reserved.
 *
 * @author Fahim Farook
 */

/**
 * CascadePlan: Main Forge Resolver & Entry Point
 * Implements Project Plan retrieval, live Jira issue/epic ingestion, multi-unit estimation,
 * subtask rollups with buffers, real assignee search & placeholders, and dependency management.
 */

import api, { route, privacy } from '@forge/api';
import Resolver from '@forge/resolver';
import { kvs, WhereConditions } from '@forge/kvs';
import {
  ProjectPlanState,
  WbsTask,
  WeeklySprintColumn,
  TaskDependency,
  InlineTaskCreateRequest,
  ScheduleBacklogRequest,
  UnscheduleTaskRequest,
  CreateSubtaskForResourceRequest,
  ReorderTasksRequest,
  ResourceUtilizationProfile,
  ProjectMilestone,
  JiraAssignableUser,
  JiraEpicItem,
  ColumnWidthConfig,
  SubtaskItem,
  TaskEffortConfig,
  EstimateUnit,
  JiraSyncReport,
  JiraWriteRecord,
  CURRENT_WEEK_INDEX,
  DEFAULT_STORY_POINT_RATIO,
  WORK_EFFORT_MODEL,
  PlanMetadata
} from './domain/models';
import { PlannerEngine } from './domain/planner-engine';
import { describeJiraChanges, JiraFieldChange } from './domain/jira-change';
import { applyLinkUpdate, dependenciesFromJira, contributorsFromNames, contributorNames, rollUpParentDates, migrateEntry } from './domain/work-effort-links';
import { formatSubtaskSummary } from './ui/second-person';
import { evaluateEffort, cascade, ScheduleEffort, ScheduleLink, addDays } from './domain/schedule-engine';
import { StorageProvider } from './storage/plan-repository';
import { PlanStore, StoredEntry, sequenceBetween } from './storage/plan-store';
import { BatchStorage } from './storage/batch-storage';
import { planBlockMove, BlockChange } from './domain/block-move';
import { logFailure } from './logger';
import { IssuePermission, deniedIssues, describeMissing, forbiddenResult, PermissionCheckError, ForbiddenError, requireIssuePermissions } from './security/write-permissions';
import {
  ValidationError,
  assertIssueKey,
  validateTaskUpdates,
  validateDependencyPayload,
  validateColumnWidths,
  validateHiddenColumns,
  validateMilestone,
  validatePlanName,
  validatePlanId,
  toValidationResult,
  validateSchedulePayload,
  reconcileIdsOf
} from './validation';
import { ResourceUtilizationEngine, ResourceUtilizationView } from './domain/resource-utilization';
import { BaselineStore, ShiftRequest, ACCOUNTS_KEY, eraseClosedAccounts } from './storage/baseline-store';
import { baselineItems, compareItems, baselineCsv } from './domain/baseline';
import {
  getApproverPolicyFlow,
  searchGroupsFlow,
  setApproverPolicyFlow,
  isPlanApprover,
  APPROVER_REQUIRED_MESSAGE
} from './security/policy-admin';


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

class ForgeKvsProvider implements StorageProvider {
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

  async swap<T>(key: string, value: T): Promise<T | undefined> {
    const res = await withKvsRetry(() => kvs.set<T, T>(key, value, { keyPolicy: 'OVERRIDE', returnValue: 'PREVIOUS' }));
    return res ? res.value : undefined;
  }
}

let globalStorageProvider: StorageProvider | null = null;

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

let sleep = (ms: number): Promise<void> => new Promise(resolve => setTimeout(resolve, ms));

/** Replaces the wait used by the 429 backoff (tests only). */
export function setSleepForTests(fn: (ms: number) => Promise<void>): void {
  sleep = fn;
}

const RETRY_BUDGET_MS = 20000;
const MAX_RETRIES = 3;

/**
 * Wraps a Jira caller so that a 429 is retried after Retry-After (1 s when missing), at most
 * three times and never waiting more than 20 s in total (resolver limit is 25 s, RS-19).
 */
function withRetry(caller: { requestJira: (...args: any[]) => Promise<any> }) {
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

export function getJiraCaller() {
  if (api.asUser && typeof api.asUser === 'function') {
    return withRetry(api.asUser());
  }
  return withRetry(api.asApp());
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

function noJiraWrites(): JiraSyncReport {
  return { ok: true, writes: [] };
}

function failedCreate(error: string): JiraSyncReport {
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

function isIsoDate(v: unknown): v is string {
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

function todayIso(d: Date = new Date()): string {
  return d.toISOString().slice(0, 10);
}

/**
 * Schedule engine input built from the plan: WorkEffort-shaped efforts for every task with dates,
 * and WORK_EFF_PRECEDENCY links from every active dependency (B-11, B-24, B-28).
 */
export function engineInputs(tasks: Array<Partial<WbsTask>>): { efforts: Map<string, ScheduleEffort>; links: ScheduleLink[] } {
  const efforts = new Map<string, ScheduleEffort>();
  const links: ScheduleLink[] = [];
  for (const t of tasks) {
    if (!t.key || !isIsoDate(t.startDate)) continue;
    efforts.set(t.key, {
      workEffortId: t.key,
      estimatedStartDate: t.startDate,
      estimatedCompletionDate: isIsoDate(t.endDate) ? t.endDate : t.startDate,
      percentComplete: t.progress || 0,
      started: t.status === 'IN_PROGRESS' || t.status === 'COMPLETED'
    });
    for (const d of t.dependencies || (t.dependency ? [t.dependency] : [])) {
      if (d.predecessorKey && typeof d.triggerPercent === 'number') {
        links.push({ workEffortIdFrom: d.predecessorKey, workEffortIdTo: t.key, workEffortAssocTypeId: 'WORK_EFF_PRECEDENCY', triggerPercent: d.triggerPercent });
      }
    }
  }
  return { efforts, links };
}

/** Week index for a date, clamped to the visible window (display only; dates stay exact). */
function clampedWeekIndex(weeks: WeeklySprintColumn[], iso: string): number {
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

function evenAllocations(weeks: WeeklySprintColumn[], startIdx: number, span: number): Record<string, number> {
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
 * Runs the one-time migration from the legacy keys, using live Jira ids for the new records.
 */
export async function migrateIfNeeded(store: PlanStore, projectKey: string): Promise<void> {
  const settings = await store.getSettings();
  if (settings.migratedAt && settings.modelVersion === WORK_EFFORT_MODEL) return;
  const [raw, users] = await Promise.all([fetchRawIssues(projectKey), fetchProjectUsers(projectKey)]);
  const live = mapLiveIssues(raw, {});
  const idByKey = new Map<string, string>();
  const blockedBy = new Map<string, string[]>();
  for (const t of [...live.tasks, ...live.backlogTasks]) {
    idByKey.set(t.key, t.id);
    blockedBy.set(t.key, (t.jiraBlockedBy || []).map(b => b.key));
  }
  const today = todayIso();
  // Links and people of an old entry in the B-28 model; everything else is kept as it is.
  const convert = (issueKey: string, old: Partial<WbsTask>): Partial<WbsTask> => {
    const rest: Partial<WbsTask> = { ...old };
    delete rest.dependency;
    delete rest.contributingResources;
    delete rest.model;
    return { ...rest, ...migrateEntry(old, users, blockedBy.get(issueKey) || [], today) };
  };
  if (!settings.migratedAt) await store.ensureMigrated(idByKey, convert);
  // B-28: rewrite each model 1 record once, under the version check; nothing is deleted.
  for (const [issueKey, entry] of await store.loadEntries()) {
    if (entry.model !== 1) continue;
    const { issueKey: _k, issueId, version, ...old } = entry;
    await store.putEntry(issueKey, issueId, convert(issueKey, old), version);
  }
  await store.saveSettings({ modelVersion: WORK_EFFORT_MODEL });
}

/**
 * Sequence number for a row inserted at targetIndex among the ordered scheduled entries.
 */
function sequenceForIndex(entries: Map<string, StoredEntry>, issueKey: string, targetIndex?: number): number {
  const seqs = [...entries.values()]
    .filter(e => e.issueKey !== issueKey && typeof e.sequenceNum === 'number' && e.startWeek)
    .map(e => e.sequenceNum as number)
    .sort((a, b) => a - b);
  if (typeof targetIndex !== 'number' || targetIndex < 0 || targetIndex >= seqs.length) {
    return sequenceBetween(seqs[seqs.length - 1], undefined);
  }
  return sequenceBetween(seqs[targetIndex - 1], seqs[targetIndex]);
}

function conflictResult(issueKey: string): any {
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


export { CURRENT_WEEK_INDEX } from './domain/models';

/**
 * Maps Jira status category to standard TaskStatus.
 */
export function mapJiraStatus(statusCategoryKey?: string, statusName?: string): 'NOT_STARTED' | 'IN_PROGRESS' | 'COMPLETED' {
  const normCategory = String(statusCategoryKey || '').toLowerCase();
  const normName = String(statusName || '').toLowerCase();

  if (normCategory === 'done' || normName.includes('done') || normName.includes('resolved') || normName.includes('closed')) {
    return 'COMPLETED';
  }
  if (normCategory === 'indeterminate' || normName.includes('progress') || normName.includes('review') || normName.includes('testing')) {
    return 'IN_PROGRESS';
  }
  return 'NOT_STARTED';
}

export const UNASSIGNED_USER: JiraAssignableUser = {
  accountId: 'unassigned',
  displayName: 'Unassigned',
  isPlaceholder: false
};

/**
 * Fetches the real Jira project assignees, plus "Unassigned" (B-18: no placeholder people).
 */
export async function fetchProjectUsers(projectKey: string): Promise<JiraAssignableUser[]> {
  const realUsers: JiraAssignableUser[] = [];
  try {
    const res = await getJiraCaller().requestJira(route`/rest/api/3/user/assignable/search?project=${projectKey}&maxResults=50`);
    if (res.status === 200) {
      const data: any[] = await res.json();
      for (const u of data) {
        if (u.accountId && u.displayName) {
          realUsers.push({
            accountId: u.accountId,
            displayName: u.displayName,
            avatarUrl: u.avatarUrls?.['24x24'] || u.avatarUrls?.['48x48'],
            isPlaceholder: false
          });
        }
      }
    }
  } catch (err) { logFailure('fetchProjectUsers', err); }
  return [UNASSIGNED_USER, ...realUsers];
}

/**
 * Fetches real Jira project Epics.
 */
export async function fetchProjectEpics(projectKey: string): Promise<JiraEpicItem[]> {
  const epics: JiraEpicItem[] = [];
  try {
    let res = await getJiraCaller().requestJira(
      route`/rest/api/3/search/jql?jql=project = "${projectKey}" AND issuetype in (Epic, "Initiative") order by created desc&fields=summary,status&maxResults=50`
    );
    if (!res || res.status !== 200) {
      res = await getJiraCaller().requestJira(
        route`/rest/api/3/search/jql?jql=project = "${projectKey}" AND issuetype = "Epic" order by created desc&fields=summary,status&maxResults=50`
      );
    }
    if (res && res.status === 200) {
      const data = await res.json();
      for (const iss of data.issues || []) {
        epics.push({
          id: String(iss.id),
          key: String(iss.key),
          summary: iss.fields?.summary || iss.key
        });
      }
    }
  } catch (err) { logFailure('fetchProjectEpics', err); }
  return epics;
}

/**
 * Fetches authentic Jira issues and maps them into scheduled tasks and backlog tray.
 */
export const PAGE_SIZE = 100;
export const MAX_PAGES = 10;

export interface RawIssues {
  issues: any[];
  isLive: boolean;
  status?: number; // Jira's HTTP status when the search failed (0 for no answer), F-21
  truncated?: { shown: number; total: number };
}

/**
 * Reads the project's issues page by page (nextPageToken), up to MAX_PAGES pages. When more
 * pages remain, reports how many were shown and Jira's approximate total (B-10).
 */
export async function fetchRawIssues(projectKey: string, reconcileIds: string[] = []): Promise<RawIssues> {
  const caller = getJiraCaller();
  // Issues written a moment ago: the search is eventually consistent, so it is asked for read-after-
  // write on them (at most 50, repeated parameter; F-03 part 3).
  const ids = [...new Set(reconcileIds.filter(id => /^\d+$/.test(id)))].slice(0, 50);
  const reconcile = new URLSearchParams();
  for (const id of ids) reconcile.append('reconcileIssues', id);
  const issues: any[] = [];
  let token: string | undefined;
  let pages = 0;
  try {
    do {
      const res = ids.length
        ? (token
          ? await caller.requestJira(route`/rest/api/3/search/jql?jql=project = "${projectKey}" order by created desc&fields=summary,status,issuetype,assignee,timeoriginalestimate,aggregatetimeoriginalestimate,timespent,aggregatetimespent,duedate,parent,subtasks,epic,issuelinks&properties=cascadeplan.dates,cascadeplan.links&maxResults=100&nextPageToken=${token}&${reconcile}`)
          : await caller.requestJira(route`/rest/api/3/search/jql?jql=project = "${projectKey}" order by created desc&fields=summary,status,issuetype,assignee,timeoriginalestimate,aggregatetimeoriginalestimate,timespent,aggregatetimespent,duedate,parent,subtasks,epic,issuelinks&properties=cascadeplan.dates,cascadeplan.links&maxResults=100&${reconcile}`))
        : (token
          ? await caller.requestJira(route`/rest/api/3/search/jql?jql=project = "${projectKey}" order by created desc&fields=summary,status,issuetype,assignee,timeoriginalestimate,aggregatetimeoriginalestimate,timespent,aggregatetimespent,duedate,parent,subtasks,epic,issuelinks&properties=cascadeplan.dates,cascadeplan.links&maxResults=100&nextPageToken=${token}`)
          : await caller.requestJira(route`/rest/api/3/search/jql?jql=project = "${projectKey}" order by created desc&fields=summary,status,issuetype,assignee,timeoriginalestimate,aggregatetimeoriginalestimate,timespent,aggregatetimespent,duedate,parent,subtasks,epic,issuelinks&properties=cascadeplan.dates,cascadeplan.links&maxResults=100`));
      if (!res || res.status !== 200) {
        logFailure('fetchRawIssues', res || new Error('no answer'));
        if (pages === 0) return { issues: [], isLive: false, status: res ? res.status : 0 };
        break;
      }
      const data = await res.json();
      issues.push(...(data.issues || []));
      pages++;
      token = data.isLast ? undefined : data.nextPageToken;
    } while (token && pages < MAX_PAGES);
  } catch (err) {
    logFailure('fetchRawIssues', err);
    if (pages === 0) return { issues: [], isLive: false, status: 0 };
  }
  if (!token) return { issues, isLive: true };
  let total = issues.length;
  try {
    const res = await caller.requestJira(route`/rest/api/3/search/approximate-count`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ jql: `project = "${projectKey}"` })
    });
    if (res && res.status === 200) total = Math.max(total, Number((await res.json()).count) || total);
  } catch (err) { logFailure('fetchRawIssues', err); }
  return { issues, isLive: true, truncated: { shown: issues.length, total } };
}

export async function fetchLiveJiraIssues(
  projectKey: string,
  storedScheduleMap: Record<string, Partial<WbsTask>> = {}
): Promise<{ tasks: WbsTask[]; backlogTasks: WbsTask[]; isLive: boolean; truncated?: { shown: number; total: number } }> {
  const raw = await fetchRawIssues(projectKey);
  return mapLiveIssues(raw, storedScheduleMap);
}

/**
 * Jira's search index can lag behind a create. An issue Jira has just confirmed (HTTP 201) is added to
 * the returned plan from its stored record until the search returns it; other entries Jira did not
 * return stay hidden (B-18).
 */
function includeCreated(plan: ProjectPlanState, entry: Partial<WbsTask> | undefined, issue: Partial<WbsTask> & { id: string; key: string }, targetIndex?: number): WbsTask {
  const found = plan.tasks.find(t => t.key === issue.key);
  if (found) return found;
  const task: WbsTask = {
    epic: '', story: 'Task', storyKey: issue.key, effortHours: 0, resource: 'Unassigned', progress: 0, targetProgress: 0,
    status: 'NOT_STARTED', startDate: '', endDate: '', spanWeeks: 1, subtasks: [], hierarchyLevel: 0, summary: issue.key,
    ...(entry ? fromStoredEntry(entry) : {}), ...issue
  } as WbsTask;
  const at = typeof targetIndex === 'number' ? Math.max(0, Math.min(plan.tasks.length, targetIndex)) : plan.tasks.length;
  plan.tasks.splice(at, 0, task);
  plan.staleEntries = (plan.staleEntries || []).filter(k => k !== issue.key);
  return task;
}

function fromStoredEntry(entry: Partial<WbsTask>): Partial<WbsTask> {
  const { startDate, endDate, startWeek, endWeek, spanWeeks, weeklyAllocations, version } = entry;
  return Object.fromEntries(Object.entries({ startDate, endDate, startWeek, endWeek, spanWeeks, weeklyAllocations, version }).filter(([, v]) => v !== undefined));
}

/**
 * Dates of an entry stored with only a week key (older records): the first day of that week and whole
 * weeks from it, from the weeks of this call. No date when the week is not known (B-18: no defaults).
 */
function weekDates(stored: Partial<WbsTask> | undefined, weeks: WeeklySprintColumn[]): { startDate: string; endDate: string } {
  const w = stored && stored.startWeek ? weeks.find(x => x.weekKey === stored.startWeek) : undefined;
  if (!w) return { startDate: '', endDate: '' };
  return { startDate: w.startDate, endDate: addDays(w.startDate, (stored!.spanWeeks || 1) * 7 - 1) };
}

/**
 * Merges raw Jira issues with the stored planning records into scheduled tasks and backlog.
 */
export function mapLiveIssues(
  raw: RawIssues,
  storedScheduleMap: Record<string, Partial<WbsTask>> = {}
): { tasks: WbsTask[]; backlogTasks: WbsTask[]; isLive: boolean; truncated?: { shown: number; total: number } } {
  try {
    if (raw.isLive) {
  const weeksNow = getDefaultWeeks(); // computed per call (B-18)
      const rawIssues: any[] = raw.issues;

      const issueByKey = new Map<string, any>();
      for (const iss of rawIssues) {
        issueByKey.set(String(iss.key), iss);
      }

      const tasks: WbsTask[] = [];
      const backlogTasks: WbsTask[] = [];

      for (const iss of rawIssues) {
        const key = String(iss.key);
        const id = String(iss.id);
        const summary = iss.fields?.summary || key;
        const typeName = iss.fields?.issuetype?.name || 'Task';
        const rawHierarchyLevel = iss.fields?.issuetype?.hierarchyLevel;
        let hierarchyLevel: number = 0;
        if (typeof rawHierarchyLevel === 'number') {
          hierarchyLevel = rawHierarchyLevel > 0 ? 1 : (rawHierarchyLevel < 0 ? -1 : 0);
        } else if (iss.fields?.issuetype?.subtask) {
          hierarchyLevel = -1;
        } else if (typeName.toLowerCase() === 'epic') {
          hierarchyLevel = 1;
        }

        const isEpic = hierarchyLevel === 1;
        const isSubtask = hierarchyLevel === -1;

        // Resolve parent issue details from raw issues map
        const directParentKey = iss.fields?.parent?.key;
        const parentIssue = directParentKey ? issueByKey.get(directParentKey) : undefined;
        const parentType = iss.fields?.parent?.fields?.issuetype?.name || parentIssue?.fields?.issuetype?.name || '';
        const parentLevel = iss.fields?.parent?.fields?.issuetype?.hierarchyLevel ?? parentIssue?.fields?.issuetype?.hierarchyLevel;
        const isParentEpic = parentLevel === 1 || parentType.toLowerCase() === 'epic';

        let epicKey: string | undefined = undefined;
        let epicName: string = '';

        if (isEpic) {
          epicKey = key;
          epicName = summary;
        } else if (isParentEpic) {
          epicKey = directParentKey;
          epicName = iss.fields?.parent?.fields?.summary || parentIssue?.fields?.summary || (epicKey ? String(epicKey) : '');
        } else if (iss.fields?.epic?.name || iss.fields?.epic?.summary) {
          epicKey = iss.fields.epic.key;
          epicName = iss.fields.epic.name || iss.fields.epic.summary || '';
        } else if (isSubtask && directParentKey) {
          // If subtask, inherit epic from its parent task if present
          const parentIss = parentIssue || issueByKey.get(directParentKey);
          const pParentKey = parentIss?.fields?.parent?.key;
          const pParentIss = pParentKey ? issueByKey.get(pParentKey) : undefined;
          const pType = parentIss?.fields?.parent?.fields?.issuetype?.name || pParentIss?.fields?.issuetype?.name || '';
          const pLevel = parentIss?.fields?.parent?.fields?.issuetype?.hierarchyLevel ?? pParentIss?.fields?.issuetype?.hierarchyLevel;
          if (pLevel === 1 || pType.toLowerCase() === 'epic') {
            epicKey = pParentKey || parentIss?.fields?.parent?.key;
            epicName = parentIss?.fields?.parent?.fields?.summary || pParentIss?.fields?.summary || (epicKey ? String(epicKey) : '');
          } else if (parentIss?.fields?.epic?.name || parentIss?.fields?.epic?.summary) {
            epicKey = parentIss.fields.epic.key;
            epicName = parentIss.fields.epic.name || parentIss.fields.epic.summary || '';
          }
        }

        const parentKey = isEpic ? undefined : directParentKey;
        const parentId = isEpic ? undefined : (iss.fields?.parent?.id ? String(iss.fields.parent.id) : undefined);

        const status = mapJiraStatus(iss.fields?.status?.statusCategory?.key, iss.fields?.status?.name);

        const rawSeconds = iss.fields?.timeoriginalestimate || 0;
        const effortHours = rawSeconds > 0 ? Math.round(rawSeconds / 3600) : 0;
        // Spec 3.3 item 9 (F-25): a leaf uses its own time spent and estimate; a parent with sub-tasks
        // uses the aggregates, so time logged on sub-tasks is measured against the whole estimate.
        const isParent = Array.isArray(iss.fields?.subtasks) && iss.fields.subtasks.length > 0;
        const spent = isParent ? (iss.fields?.aggregatetimespent || 0) : (iss.fields?.timespent ?? iss.fields?.aggregatetimespent ?? 0);
        const estimate = isParent ? (iss.fields?.aggregatetimeoriginalestimate || rawSeconds) : rawSeconds;

        let progress = 0;
        if (status === 'COMPLETED') {
          progress = 100;
        } else if (estimate > 0 && spent > 0) {
          progress = Math.min(100, Math.round((spent / estimate) * 100));
        }

        const subtasks: SubtaskItem[] = (iss.fields?.subtasks || []).map((sub: any) => ({
          id: String(sub.id),
          key: String(sub.key),
          summary: sub.fields?.summary || 'Subtask',
          estimateValue: 0,
          estimateUnit: 'HOURS' as const,
          normalizedHours: 0,
          status: mapJiraStatus(sub.fields?.status?.statusCategory?.key, sub.fields?.status?.name)
        }));

        const stored = storedScheduleMap[key] || storedScheduleMap[id];

        // The dependencies are the Jira "Blocks" links, the same in every plan; the trigger percent is
        // the issue property cascadeplan.links (ADR-006, N-11 L3 to L5).
        const jiraBlockedBy = (Array.isArray(iss.fields?.issuelinks) ? iss.fields.issuelinks : [])
          .filter((link: any) => ['blocks', 'dependency'].includes(String(link.type?.name || '').toLowerCase()) && link.inwardIssue?.key)
          .map((link: any) => ({ key: String(link.inwardIssue.key), id: String(link.inwardIssue.id || link.inwardIssue.key), ...(link.id ? { linkId: String(link.id) } : {}) }));
        const storedLinks = stored?.dependencies || (stored?.dependency ? [stored.dependency] : []);
        const percents = iss.properties?.[LINKS_PROPERTY]?.links;
        const liveDependencies: TaskDependency[] = dependenciesFromJira(jiraBlockedBy, percents && typeof percents === 'object' ? percents : {}, storedLinks);
        const liveDependency: TaskDependency | undefined = liveDependencies[0];

        // The sub-tasks are Jira's (ADR-004, F-23). Sub-tasks stored only in a plan record by an
        // earlier build never hide them; they are listed for the user to create in Jira or drop.
        const finalSubtasks: SubtaskItem[] = subtasks;
        const localSubtasks: SubtaskItem[] | undefined = stored?.subtasks && stored.subtasks.length > 0
          ? stored.subtasks.filter((s: SubtaskItem) => !s.key) : undefined;

        const calculatedEffortConfig = PlannerEngine.calculateEffortWithSubtasksAndBuffer({
          unit: 'HOURS',
          rawEstimate: effortHours,
          subtasks: finalSubtasks,
          bufferType: 'NONE'
        });

        const effortConfig = stored?.effortConfig || calculatedEffortConfig;
        // The estimate is Jira's original estimate, read live (INV-04).
        const totalHours = effortHours;

        // Jira is the single truth for a task's dates. A scheduled task ends on the Jira due date in
        // every plan, also when someone changed it directly in Jira. The start date has no standard Jira
        // field, so it is the one shared by every plan; it moves only when it would fall after the end.
        // ADR-008: the shared start (and a planner-only end) is the Jira issue property cascadeplan.dates,
        // the same in every plan. Without it, the plan's own record still holds them (lazy migration).
        // A property without a start marks a task taken off the timeline: it wins over an older plan record.
        const prop = iss.properties?.[DATES_PROPERTY];
        const hasProp = !!prop && typeof prop === 'object';
        const propStart = isIsoDate(prop?.startDate) ? String(prop.startDate).slice(0, 10) : undefined;
        const propEnd = isIsoDate(prop?.endDate) ? String(prop.endDate).slice(0, 10) : undefined;
        const scheduled = hasProp ? !!propStart : !!stored?.startWeek;
        const savedStart = propStart || stored?.startDate || weekDates(stored, weeksNow).startDate;
        const savedEnd = propEnd || stored?.endDate || weekDates(stored, weeksNow).endDate;
        const jiraDue = isIsoDate(iss.fields?.duedate) ? String(iss.fields.duedate).slice(0, 10) : undefined;
        const endFromJira = scheduled && !!jiraDue && jiraDue !== savedEnd && weeksNow.length > 0;
        const taskEnd = endFromJira ? jiraDue! : (savedEnd || iss.fields?.duedate || '');
        const taskStart = endFromJira && (!isIsoDate(savedStart) || savedStart > jiraDue!) ? jiraDue! : savedStart;
        const jiraGrid = (endFromJira || (!!propStart && weeksNow.length > 0)) ? gridFor(weeksNow, taskStart, taskEnd) : undefined;
        const autoTarget = PlannerEngine.calculateTargetProgress(taskStart, taskEnd);
        const targetProgress = stored?.manualTargetProgress === true && stored.targetProgress !== undefined
          ? stored.targetProgress
          : autoTarget;

        const wbsItem: WbsTask = {
          id,
          key,
          summary,
          epic: epicName,
          epicKey,
          story: typeName,
          storyKey: key,
          effortHours: totalHours,
          effortConfig,
          resource: iss.fields?.assignee?.displayName || 'Unassigned',
          resourceAccountId: iss.fields?.assignee?.accountId || undefined,
          contributingResources: stored?.contributingResources,
          progress: stored?.manualProgress === true && stored.progress !== undefined ? stored.progress : progress,
          targetProgress,
          manualProgress: stored?.manualProgress,
          manualTargetProgress: stored?.manualTargetProgress,
          status,
          startDate: taskStart,
          endDate: taskEnd,
          // The due date Jira holds, read live: the old value in the Changes panel (B-23).
          jiraDueDate: iss.fields?.duedate || undefined,
          startWeek: !scheduled ? undefined : jiraGrid ? jiraGrid.startWeek : stored?.startWeek,
          endWeek: jiraGrid ? jiraGrid.endWeek : stored?.endWeek,
          spanWeeks: jiraGrid ? jiraGrid.spanWeeks! : (stored?.spanWeeks || 3),
          weeklyAllocations: jiraGrid ? jiraGrid.weeklyAllocations : stored?.weeklyAllocations,
          dependency: liveDependency,
          dependencies: liveDependencies.length ? liveDependencies : undefined,
          endedLinks: stored?.endedLinks,
          contributors: stored?.contributors,
          jiraBlockedBy: jiraBlockedBy.length ? jiraBlockedBy : undefined,
          model: stored?.model,
          subtasks: finalSubtasks,
          ...(localSubtasks && localSubtasks.length ? { localSubtasks } : {}),
          isSubtask,
          isEpic,
          hierarchyLevel,
          parentKey,
          parentId,
          // The record version the client sends back as expectedVersion; 0 when nothing is stored yet.
          version: stored?.version ?? 0
        };

        if (wbsItem.startWeek) {
          tasks.push(wbsItem);
        } else {
          wbsItem.isBacklog = true;
          backlogTasks.push(wbsItem);
        }
      }

      return { tasks, backlogTasks, isLive: true, truncated: raw.truncated };
    }
  } catch (err) { logFailure('mapLiveIssues', err); }

  return { tasks: [], backlogTasks: [], isLive: false };
}

export interface LiveData {
  raw: RawIssues;
  users: JiraAssignableUser[];
  epics: JiraEpicItem[];
  hasEpic?: boolean;
}

/** One read of everything a plan needs from Jira. */
export async function loadLive(projectKey: string, reconcileIds: string[] = []): Promise<LiveData> {
  const [raw, users, epics] = await Promise.all([fetchRawIssues(projectKey, reconcileIds), fetchProjectUsers(projectKey), fetchProjectEpics(projectKey)]);
  let hasEpic = epics.length > 0;
  if (!hasEpic) {
    const meta = await resolveProjectIssueType(projectKey, 'Epic');
    hasEpic = Boolean(meta && meta.id);
  }
  return { raw, users, epics, hasEpic };
}

/**
 * Retrieves the complete project plan state.
 */
export async function getProjectPlan(
  projectKey: string,
  storageProvider?: StorageProvider,
  referenceDate: Date = new Date(),
  siteUrl?: string,
  projectId?: string,
  preloaded?: LiveData,
  planId?: string,
  reconcileIds: string[] = []
): Promise<ProjectPlanState> {
  const storage = resolveStorage(storageProvider);
  validatePlanId(planId);
  const availablePlans = await openStore(storage, projectKey, projectId).listPlans();
  // A plan id that is not listed (deleted, or a stale id saved by the browser) reads the Main Plan;
  // the returned planId tells the client which plan it got.
  // A plan that is still being copied or deleted is not opened either (N-02).
  if (!isMainPlan(planId) && !availablePlans.some(p => p.id === planId && !p.state)) planId = undefined;
  const store = openStore(storage, projectKey, projectId, planId);
  if (isMainPlan(planId)) await migrateIfNeeded(store, projectKey);

  const dynamicTimeline = getTimelineWeeks(referenceDate);
  const activeWeeks = dynamicTimeline.weeks;

  // getProjectPlan only reads; it writes nothing to KVS (INV-07).
  const entries = await store.loadEntries();
  const storedScheduleMap: Record<string, Partial<WbsTask>> = Object.fromEntries(entries);
  const settings = await store.getSettings();
  const storedMilestones = settings.milestones || [];
  const storedWidths = settings.columnWidths || DEFAULT_COLUMN_WIDTHS;
  const storedHiddenColumns = settings.hiddenColumns || [];

  // Query live Jira issues and assignees (once per resolver call when preloaded)
  const live = preloaded || await loadLive(projectKey, reconcileIds);
  const liveData = mapLiveIssues(live.raw, storedScheduleMap);
  const availableUsers = [...live.users];
  const availableEpics = [...live.epics];

  let tasks = liveData.tasks;
  const backlogTasks = liveData.backlogTasks;

  // An entry Jira did not return is not shown. When the Jira read worked and was complete it is listed, so the
  // client can say that some planned issues are not visible. Records are deleted only by the issue-deleted trigger (BL-9).
  const liveKeys = new Set([...tasks, ...backlogTasks].map(t => t.key));
  const staleEntries = !liveData.isLive || liveData.truncated ? [] : [...entries.keys()].filter(k => !liveKeys.has(k)).sort();

  // Second people are stored by account id; their names are read live from Jira (B-28, INV-04).
  for (const t of tasks) {
    if (t.contributors) t.contributingResources = contributorNames(t.contributors, availableUsers);
  }
  // A parent's dates are derived from its dated children on every load, never stored (B-28). A parent
  // with a dated child is on the timeline even with no record of its own, and so is its own parent
  // (N-06 rule 4).
  for (let pass = 0; pass < 4; pass++) {
    let added = false;
    for (const [key, span] of rollUpParentDates(tasks)) {
      let parent = tasks.find(t => t.key === key);
      if (!parent) {
        // Epics stay in the backlog until scheduled (B-05; epic blocks come later, DEC-5b).
        const idx = backlogTasks.findIndex(t => t.key === key && !t.isEpic && t.hierarchyLevel !== 1);
        if (idx === -1) continue;
        parent = backlogTasks.splice(idx, 1)[0];
        parent.isBacklog = false;
        tasks.push(parent);
        added = true;
      }
      Object.assign(parent, span, gridFor(activeWeeks, span.startDate, span.endDate), { datesFromChildren: true });
    }
    if (!added) break;
  }

  // Evaluate every dependency with the schedule engine: earliest start, reason, driver, fix (B-11).
  const engine = engineInputs(tasks);
  const today = todayIso(referenceDate);
  for (const t of tasks) {
    if (t.dependency) {
      const ev = evaluateEffort(t.key, engine.efforts, engine.links, today);
      t.dependency.isTriggerSatisfied = ev.earliestStartDate === null && !ev.violated;
      t.dependency.isViolated = ev.violated;
      t.dependency.violationReason = ev.violated ? (ev.suggestion || ev.reason || undefined) : undefined;
      t.dependency.earliestStartDate = ev.earliestStartDate || undefined;
      t.dependency.earliestStartReason = ev.reason || undefined;
      t.dependency.driverKey = ev.driver || undefined;
      t.dependency.fixSuggestion = ev.suggestion;
      t.dependency.triggerDate = ev.triggerDate || undefined;
      t.dependency.fixOptions = ev.fixes;
    }
  }

  // Order rows by the stored sequence number; rows without one keep Jira's order after them.
  const position = new Map(tasks.map((t, i) => [t.key, i]));
  const seqOf = (k: string) => {
    const s = entries.get(k)?.sequenceNum;
    return typeof s === 'number' ? s : Number.POSITIVE_INFINITY;
  };
  tasks.sort((a, b) => (seqOf(a.key) - seqOf(b.key)) || ((position.get(a.key) as number) - (position.get(b.key) as number)));
  tasks = PlannerEngine.buildWbsHierarchy(tasks, activeWeeks);
  tasks.forEach((t, i) => { t.orderIndex = i; });

  // Merge any Epics from tasks into availableEpics
  for (const t of tasks) {
    if (t.isEpic && !availableEpics.some(e => e.key === t.key)) {
      availableEpics.push({ id: t.id, key: t.key, summary: t.summary });
    }
  }

  const { actualCompletion, targetCompletion } = PlannerEngine.calculateProjectCompletion(tasks);

  const planState: ProjectPlanState = {
    planId: planId || 'default',
    projectKey,
    projectName: `Project ${projectKey}`,
    overallProjectCompletion: actualCompletion,
    overallTargetCompletion: targetCompletion,
    weeks: activeWeeks,
    tasks,
    backlogTasks,
    milestones: storedMilestones,
    columnWidths: storedWidths,
    hiddenColumns: storedHiddenColumns,
    availableEpics,
    availableUsers,
    availablePlans,
    hasEpic: live.hasEpic !== undefined ? live.hasEpic : (availableEpics.length > 0),
    lastUpdated: new Date().toISOString(),
    isLiveSynced: liveData.isLive,
    jiraStatus: liveData.isLive ? undefined : (live.raw.status ?? 0),
    truncated: liveData.truncated,
    staleEntries,
    siteUrl: siteUrl || (process.env.JIRA_BASE_URL || undefined)
  };

  return planState;
}

/**
 * Schedules an issue from the backlog shelf directly onto the timeline grid.
 */
export async function scheduleBacklogTask(
  request: ScheduleBacklogRequest,
  storageProvider?: StorageProvider
): Promise<ProjectPlanState> {
  const weeksNow = getDefaultWeeks(); // computed per call (B-18)
  validateSchedulePayload(request as unknown as Record<string, unknown>);
  const { projectKey, projectId, taskId, startWeek, startDate, spanWeeks = 3, effortHours, resource, targetIndex } = request;
  if (startDate !== undefined && !isIsoDate(startDate)) throw new ValidationError('startDate', 'startDate must be a date in YYYY-MM-DD form');
  if (request.endDate !== undefined && !isIsoDate(request.endDate)) throw new ValidationError('endDate', 'endDate must be a date in YYYY-MM-DD form');
  const issueId = await verifyIssueInProject(taskId, projectKey, 'taskId');
  await requireIssuePermissions([{ key: taskId, id: issueId }], request.endDate ? ['EDIT_ISSUES', 'SCHEDULE_ISSUES'] : ['EDIT_ISSUES']);
  // INV-03 (F-06): the default span is planner data only. The bar ends on the Jira due date when the
  // issue has one, and a due date is written to Jira only when the user chose an end.
  const jiraDue = request.endDate ? undefined : await readJiraDueDate(taskId);
  const storage = resolveStorage(storageProvider);
  const planId = await writablePlanId(storage, projectKey, projectId, request.planId);
  const store = openStore(storage, projectKey, projectId, planId);
  if (isMainPlan(planId)) await migrateIfNeeded(store, projectKey);
  const entries = await store.loadEntries();

  const startIdx = Math.max(0, weeksNow.findIndex(w => w.weekKey === startWeek));
  const endIdx = Math.min(weeksNow.length - 1, startIdx + spanWeeks - 1);
  const endWeek = weeksNow[endIdx].weekKey;

  const allocations: Record<string, number> = {};
  for (let i = startIdx; i <= endIdx; i++) {
    allocations[weeksNow[i].weekKey] = Math.round(100 / spanWeeks);
  }

  const current = entries.get(taskId);
  // Estimate and assignee are Jira-owned: an entered estimate goes to Jira, never to KVS (INV-04).
  const entry = stripJiraOwnedFields({
    ...(current || {}),
    startWeek,
    endWeek,
    spanWeeks,
    startDate: weeksNow[startIdx].startDate,
    endDate: weeksNow[endIdx].endDate,
    weeklyAllocations: allocations,
    sequenceNum: sequenceForIndex(entries, taskId, targetIndex),
    // An exact day (B-27): the drop date and whole weeks from it, anywhere on the timeline.
    ...(startDate ? { startDate, endDate: addDays(startDate, spanWeeks * 7 - 1), ...gridFor(weeksNow, startDate, addDays(startDate, spanWeeks * 7 - 1)) } : {})
  });
  const chosenEnd = request.endDate || jiraDue;
  if (chosenEnd) {
    const start = entry.startDate as string;
    if (chosenEnd < start) {
      throw new ValidationError(request.endDate ? 'endDate' : 'startDate', request.endDate
        ? 'The end must be on or after the start.'
        : `${taskId} is due on ${chosenEnd} in Jira, before ${start}. Drop it on or before ${chosenEnd}, or change its due date first.`);
    }
    Object.assign(entry, { endDate: chosenEnd }, gridFor(weeksNow, start, chosenEnd));
  }
  void resource;
  const put = await store.putEntry(taskId, issueId, entry, current ? current.version : 0);
  if (!put.ok) return conflictResult(taskId);

  // The dates are the same in every plan: the start (and the planner's end) is the issue property
  // (ADR-008); the due date only when the user chose an end (F-06), and the effort, go to Jira fields.
  const log = new SyncLog();
  const jiraUpdates: Partial<WbsTask> = { startDate: put.entry.startDate as string };
  if (request.endDate) jiraUpdates.endDate = request.endDate;
  if (typeof effortHours === 'number') jiraUpdates.effortHours = effortHours;
  await syncTaskToJira(taskId, jiraUpdates, log, {}, { propertyEnd: put.entry.endDate as string });

  return Object.assign(await getProjectPlan(projectKey, storage, new Date(), undefined, projectId, undefined, planId), { ok: true, jiraSync: log.report() });
}

/** The issue's Jira due date as the user sees it, or undefined when it has none or Jira cannot say. */
async function readJiraDueDate(issueKey: string): Promise<string | undefined> {
  try {
    const res = await getJiraCaller().requestJira(route`/rest/api/3/issue/${issueKey}?fields=duedate`);
    if (!res || res.status !== 200) return undefined;
    const due = (await res.json())?.fields?.duedate;
    return isIsoDate(due) ? String(due).slice(0, 10) : undefined;
  } catch {
    return undefined;
  }
}

/**
 * Resolves valid Jira issue type metadata (id and name) dynamically for a project.
 * Handles company-managed and team-managed schemes to avoid "Specify a valid issue type".
 */
export async function resolveProjectIssueType(
  projectKey: string,
  kind: 'Epic' | 'Task'
): Promise<{ id?: string; name: string }> {
  try {
    const caller = getJiraCaller();
    const projRes = await caller.requestJira(route`/rest/api/3/project/${projectKey}`);
    if (projRes && projRes.status === 200) {
      const projData = await projRes.json();
      const issueTypes: any[] = projData?.issueTypes || [];
      if (kind === 'Epic') {
        const found = issueTypes.find(it =>
          it.hierarchyLevel === 1 ||
          it.name?.toLowerCase() === 'epic' ||
          it.name?.toLowerCase() === 'feature' ||
          it.name?.toLowerCase() === 'initiative'
        );
        if (found) {
          return { id: String(found.id), name: found.name };
        }
      } else {
        const found = issueTypes.find(it =>
          !it.subtask &&
          it.hierarchyLevel !== 1 &&
          (it.name?.toLowerCase() === 'task' || it.name?.toLowerCase() === 'story' || it.name?.toLowerCase() === 'item')
        );
        if (found) {
          return { id: String(found.id), name: found.name };
        }
      }
    }
  } catch (err) {
    // Fallback to standard defaults if metadata call is unavailable
  }
  return { name: kind };
}

/**
 * Creates a new Jira issue and places it on the schedule or backlog.
 */
export async function createInlineTask(
  request: InlineTaskCreateRequest,
  storageProvider?: StorageProvider
): Promise<{ success: boolean; ok: boolean; jiraSync: JiraSyncReport; task?: WbsTask; plan?: ProjectPlanState; error?: string }> {
  validateSchedulePayload(request as unknown as Record<string, unknown>, { summaryRequired: true });
  const weeksNow = getDefaultWeeks(); // computed per call (B-18)
  const currentWeekKey = weeksNow.find(w => w.isCurrentWeek)?.weekKey || weeksNow[0].weekKey;
  const {
    projectKey, projectId, epic, epicKey, parentKey, story, summary, effortHours,
    resource = 'Unassigned', resourceAccountId, assigneeAccountId, startWeek, spanWeeks = 3, targetIndex
  } = request;

  let jiraIssueId = '';
  let jiraIssueKey = '';
  // The plan check runs before the Jira create, so a deleted plan creates no issue (R-14, H9).
  const storage = resolveStorage(storageProvider);
  const planId = await writablePlanId(storage, projectKey, projectId, request.planId);

  try {
    let res: any;
    const caller = getJiraCaller();
    const effectiveParent = parentKey || epicKey;
    const rawAssignee = (assigneeAccountId && assigneeAccountId !== 'unassigned' && assigneeAccountId !== 'Unassigned')
      ? assigneeAccountId
      : (resourceAccountId && !resourceAccountId.startsWith('ph:') && resourceAccountId !== 'unassigned' && resourceAccountId !== 'Unassigned' ? resourceAccountId : undefined);
    const effectiveAssignee = rawAssignee && rawAssignee.trim().length > 0 ? rawAssignee.trim() : undefined;

    const body: any = {
      fields: {
        project: { key: projectKey },
        summary,
        issuetype: { name: 'Task' }
      }
    };
    if (effectiveParent) {
      body.fields.parent = { key: effectiveParent };
    }
    if (effectiveAssignee) {
      body.fields.assignee = { accountId: effectiveAssignee };
    }

    res = await caller.requestJira(route`/rest/api/3/issue`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });

    if (res && res.status === 400) {
      let isIssueTypeError = false;
      try {
        const cloned = res.clone ? res.clone() : res;
        const errJson = await cloned.json();
        const errStr = JSON.stringify(errJson).toLowerCase();
        if (errStr.includes('issue type') || errStr.includes('issuetype')) {
          isIssueTypeError = true;
        }
      } catch (err) { logFailure('createInlineTask', err); }

      if (isIssueTypeError) {
        const issueTypeMeta = await resolveProjectIssueType(projectKey, 'Task');
        if (issueTypeMeta.id) {
          body.fields.issuetype = { id: issueTypeMeta.id } as any;
          res = await caller.requestJira(route`/rest/api/3/issue`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body)
          });
        }
      }
    }

    if (!res || res.status !== 201) {
      let errMsg = `Failed to create Jira issue (HTTP ${res?.status || 500})`;
      try {
        const errJson = await res.json();
        if (errJson.errorMessages && errJson.errorMessages.length > 0) {
          errMsg = errJson.errorMessages.join(', ');
        } else if (errJson.errors && Object.keys(errJson.errors).length > 0) {
          errMsg = Object.values(errJson.errors).join(', ');
        }
      } catch (err) { logFailure('createInlineTask', err); }
      return { success: false, ok: false, error: errMsg, jiraSync: failedCreate(errMsg) };
    }

    const data = await res.json();
    jiraIssueId = String(data.id);
    jiraIssueKey = String(data.key);
  } catch (err: any) {
    const message = err?.message || 'Network error while contacting Jira';
    return { success: false, ok: false, error: message, jiraSync: failedCreate(message) };
  }

  const store = openStore(storage, projectKey, projectId, planId);
  if (isMainPlan(planId)) await migrateIfNeeded(store, projectKey);
  const entries = await store.loadEntries();

  const assignedStartWeek = startWeek || currentWeekKey;
  const startIdx = Math.max(0, weeksNow.findIndex(w => w.weekKey === assignedStartWeek));
  const endIdx = Math.min(weeksNow.length - 1, startIdx + spanWeeks - 1);
  const endWeek = weeksNow[endIdx].weekKey;

  const allocations: Record<string, number> = {};
  for (let i = startIdx; i <= endIdx; i++) {
    allocations[weeksNow[i].weekKey] = Math.round(100 / spanWeeks);
  }

  const created = await store.putEntry(jiraIssueKey, jiraIssueId, {
    startWeek: assignedStartWeek,
    endWeek,
    spanWeeks,
    startDate: weeksNow[startIdx].startDate,
    endDate: weeksNow[endIdx].endDate,
    weeklyAllocations: allocations,
    sequenceNum: sequenceForIndex(entries, jiraIssueKey, targetIndex)
  });
  void epic; void story; void resource;

  // The new issue has the same dates in every plan (the issue property, ADR-008); its due date, estimate,
  // assignee and epic go to Jira. The default span stays in the planner; only an end the user chose
  // becomes the Jira due date (F-06).
  const log = new SyncLog();
  await syncTaskToJira(jiraIssueKey, {
    ...(created.ok ? { startDate: created.entry.startDate as string } : {}),
    ...(request.endDate ? { endDate: request.endDate } : {}),
    effortHours,
    resourceAccountId,
    epicKey
  }, log, {}, { propertyEnd: created.ok ? created.entry.endDate as string : undefined });

  const plan = await getProjectPlan(projectKey, storage, new Date(), undefined, projectId, undefined, planId);
  const createdTask = includeCreated(plan, (await store.loadEntries()).get(jiraIssueKey),
    { id: jiraIssueId, key: jiraIssueKey, summary, epic: epic || '', epicKey, story: story || 'Task', effortHours: effortHours || 0, resource, resourceAccountId }, targetIndex);

  return { success: true, ok: true, jiraSync: log.report(), task: createdTask, plan };
}

/**
 * Creates a new Jira Epic.
 */
export async function createJiraEpic(
  payload: { projectKey: string; summary: string },
  storageProvider?: StorageProvider
): Promise<{ success: boolean; ok: boolean; jiraSync: JiraSyncReport; epic?: JiraEpicItem; error?: string }> {
  const { projectKey, summary } = payload;
  try {
    let res: any;
    const caller = getJiraCaller();
    let body = {
      fields: {
        project: { key: projectKey },
        summary,
        issuetype: { name: 'Epic' }
      }
    };

    res = await caller.requestJira(route`/rest/api/3/issue`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });

    if (res && res.status === 400) {
      let isIssueTypeError = false;
      try {
        const cloned = res.clone ? res.clone() : res;
        const errJson = await cloned.json();
        const errStr = JSON.stringify(errJson).toLowerCase();
        if (errStr.includes('issue type') || errStr.includes('issuetype')) {
          isIssueTypeError = true;
        }
      } catch (err) { logFailure('createJiraEpic', err); }

      if (isIssueTypeError) {
        const issueTypeMeta = await resolveProjectIssueType(projectKey, 'Epic');
        if (issueTypeMeta.id) {
          body.fields.issuetype = { id: issueTypeMeta.id } as any;
          res = await caller.requestJira(route`/rest/api/3/issue`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body)
          });
        } else {
          const errMsg = 'Epics are not enabled in this project type';
          return { success: false, ok: false, error: errMsg, jiraSync: failedCreate(errMsg) };
        }
      }
    }

    if (!res || res.status !== 201) {
      let errMsg = `Failed to create Jira Epic (HTTP ${res?.status || 500})`;
      try {
        const errJson = await res.json();
        if (errJson.errorMessages && errJson.errorMessages.length > 0) {
          errMsg = errJson.errorMessages.join(', ');
        } else if (errJson.errors && Object.keys(errJson.errors).length > 0) {
          errMsg = Object.values(errJson.errors).join(', ');
        }
      } catch (err) { logFailure('createJiraEpic', err); }
      return { success: false, ok: false, error: errMsg, jiraSync: failedCreate(errMsg) };
    }

    const data = await res.json();
    return {
      success: true,
      ok: true,
      jiraSync: { ok: true, writes: [{ key: String(data.key), fields: ['create'], ok: true }] },
      epic: { id: String(data.id), key: String(data.key), summary }
    };
  } catch (err: any) {
    const message = err?.message || 'Network error while contacting Jira';
    return { success: false, ok: false, error: message, jiraSync: failedCreate(message) };
  }
}

/**
 * Synchronizes task edits back to Jira Cloud (two-way sync).
 */
export async function syncTaskToJira(
  taskIdOrKey: string,
  updates: Partial<WbsTask>,
  log?: SyncLog,
  before: Partial<WbsTask> = {},
  options: { propertyEnd?: string } = {}
): Promise<{ synced: boolean; error?: string; fields: string[] }> {
  const result = await syncTaskFields(taskIdOrKey, updates, options.propertyEnd);
  if (log) {
    // Each write is logged with its old and new values; a field Jira refused is logged as not written (B-23).
    // A start date written unchanged (moving the task onto the shared property, ADR-008) is not listed.
    const shown = result.fields.filter(f => !(f === 'startdate' && typeof updates.startDate === 'string' && before.startDate === updates.startDate));
    log.record(taskIdOrKey, shown, result, describeJiraChanges(shown, before, updates));
    // Each refused field is reported with its own reason (F-08).
    for (const field of result.rejected) {
      log.record(taskIdOrKey, [field], { synced: false, error: result.reasons[field] || 'Jira did not accept the change' },
        describeJiraChanges([field], before, updates));
    }
  }
  return result;
}

async function syncTaskFields(
  taskIdOrKey: string,
  updates: Partial<WbsTask>,
  propertyEnd?: string
): Promise<{ synced: boolean; error?: string; fields: string[]; rejected: string[]; reasons: Record<string, string> }> {
  const fields: Record<string, any> = {};
  let dropped: string[] = [];
  const reasons: Record<string, string> = {};
  let statusReason: string | undefined;

  if (updates.summary && typeof updates.summary === 'string' && updates.summary.trim()) {
    fields.summary = updates.summary.trim();
  }

  if (updates.endDate && typeof updates.endDate === 'string') {
    fields.duedate = updates.endDate.slice(0, 10);
  }

  if (typeof updates.effortHours === 'number' && updates.effortHours > 0) {
    fields.timetracking = {
      originalEstimate: `${updates.effortHours}h`
    };
  }

  if (updates.epicKey !== undefined) {
    // The epic link is the Jira parent; an empty key removes it.
    fields.parent = updates.epicKey ? { key: updates.epicKey } : null;
  }

  if (updates.resourceAccountId) {
    if (updates.resourceAccountId === 'unassigned') {
      fields.assignee = null;
    } else if (!updates.resourceAccountId.startsWith('ph:')) {
      fields.assignee = {
        accountId: updates.resourceAccountId
      };
    }
  }

  const caller = getJiraCaller();
  let syncSuccess = true;
  let errMsg: string | undefined;

  // Update Jira issue fields if any
  if (Object.keys(fields).length > 0) {
    try {
      let res = await caller.requestJira(route`/rest/api/3/issue/${taskIdOrKey}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fields })
      });

      if (!res || res.status < 200 || res.status >= 300) {
        // Graceful retry without duedate if duedate is rejected by screen layout
        if (res?.status === 400 && fields.duedate) {
          try {
            const errJson = await res.json();
            if (errJson?.errors?.duedate) {
              const fallbackFields = { ...fields };
              delete fallbackFields.duedate;
              if (Object.keys(fallbackFields).length > 0) {
                const retryRes = await caller.requestJira(route`/rest/api/3/issue/${taskIdOrKey}`, {
                  method: 'PUT',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ fields: fallbackFields })
                });
                res = retryRes;
                dropped = ['duedate'];
              }
            }
          } catch (err) { logFailure('syncTaskFields', err); }
        }

        // Dedicated assignee fallback if resourceAccountId is set
        let assigneeRecovered = false;
        if (updates.resourceAccountId) {
          try {
            const assBody = {
              accountId: (updates.resourceAccountId === 'unassigned' || updates.resourceAccountId.startsWith('ph:'))
                ? null
                : updates.resourceAccountId
            };
            const assRes = await caller.requestJira(route`/rest/api/3/issue/${taskIdOrKey}/assignee`, {
              method: 'PUT',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(assBody)
            });
            if (assRes?.status >= 200 && assRes?.status < 300) {
              assigneeRecovered = true;
            }
          } catch (err) { logFailure('syncTaskFields', err); }
        }

        if (res && res.status >= 200 && res.status < 300) {
          syncSuccess = true;
        } else if (assigneeRecovered && Object.keys(fields).length === 1 && fields.assignee !== undefined) {
          syncSuccess = true;
        } else {
          syncSuccess = false;
          try {
            const errJson = await res.json();
            if (errJson.errorMessages && errJson.errorMessages.length > 0) {
              errMsg = errJson.errorMessages.join(', ');
            } else if (errJson.errors && Object.keys(errJson.errors).length > 0) {
              errMsg = Object.values(errJson.errors).join(', ');
            } else {
              errMsg = JSON.stringify(errJson);
            }
          } catch {
            errMsg = `Jira status ${res?.status || 500}`;
          }
        }
      }
    } catch (err: any) {
      return { synced: false, error: err?.message || 'Network error updating Jira issue', fields: Object.keys(fields), rejected: [], reasons };
    }
  }

  // After a successful retry without the due date, the due date was not written.
  const rejected = syncSuccess ? [...dropped] : [];
  if (rejected.includes('duedate')) reasons.duedate = 'Jira did not accept the due date on this issue screen';
  const sentFields = Object.keys(fields).filter(f => !rejected.includes(f));
  // ADR-008: the shared start is the issue property, written after Jira accepted the due date (or when
  // the end did not change). It needs the start; an update with only an end leaves the property alone.
  if (typeof updates.startDate === 'string' && syncSuccess && !rejected.includes('duedate')) {
    const end = typeof updates.endDate === 'string' ? updates.endDate : propertyEnd;
    const value = { startDate: updates.startDate.slice(0, 10), ...(isIsoDate(end) ? { endDate: end.slice(0, 10) } : {}), v: 1 };
    let ok = false;
    try {
      const res = await caller.requestJira(route`/rest/api/3/issue/${taskIdOrKey}/properties/${DATES_PROPERTY}`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(value)
      });
      ok = !!res && (res.status === 200 || res.status === 201 || res.status === 204);
      if (!ok) logFailure('startDateProperty', res);
    } catch (err) { logFailure('startDateProperty', err); }
    if (ok) sentFields.push('startdate');
    else { rejected.push('startdate'); reasons.startdate = 'Jira did not save the start date'; }
  }
  // Status workflow transition sync
  if (updates.status) {
    // The status counts as written only when Jira applied a transition (F-08).
    statusReason = 'Jira could not read the workflow transitions of this issue';
    try {
      const transRes = await caller.requestJira(route`/rest/api/3/issue/${taskIdOrKey}/transitions`);
      if (transRes.status === 200) {
        const transData = await transRes.json();
        const targetStatus = updates.status;
        const match = (transData.transitions || []).find((tr: any) => {
          const cat = tr.to?.statusCategory?.key?.toLowerCase();
          const nm = tr.name?.toLowerCase() || '';
          if (targetStatus === 'COMPLETED' && (cat === 'done' || nm.includes('done') || nm.includes('resolve') || nm.includes('close'))) return true;
          if (targetStatus === 'IN_PROGRESS' && (cat === 'indeterminate' || nm.includes('progress'))) return true;
          if (targetStatus === 'NOT_STARTED' && (cat === 'new' || cat === 'undefined' || nm.includes('to do') || nm.includes('open') || nm.includes('reopen'))) return true;
          return false;
        });
        if (match) {
          const postRes = await caller.requestJira(route`/rest/api/3/issue/${taskIdOrKey}/transitions`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ transition: { id: match.id } })
          });
          statusReason = postRes && postRes.status === 204 ? undefined : `Jira did not apply the "${match.name || match.id}" transition`;
        } else {
          statusReason = `No workflow transition leads to ${String(targetStatus).replace('_', ' ').toLowerCase()} from the current status`;
        }
      }
    } catch (err) { logFailure('syncTaskFields', err); }
  }

  if (updates.status) {
    if (statusReason) {
      rejected.push('status');
      reasons.status = statusReason;
    } else {
      sentFields.push('status');
    }
  }
  return { synced: syncSuccess, error: errMsg, fields: sentFields, rejected, reasons };
}

/**
 * Id of the "Blocks" link from the predecessor to the successor, if Jira has one.
 */
async function findBlocksLinkId(successorKey: string, predecessorKey: string): Promise<string | undefined> {
  try {
    const res = await getJiraCaller().requestJira(route`/rest/api/3/issue/${successorKey}?fields=issuelinks`);
    if (res && res.status === 200) {
      const data = await res.json();
      const link = (data?.fields?.issuelinks || []).find((l: any) =>
        String(l.type?.name || '').toLowerCase() === 'blocks' && l.inwardIssue?.key === predecessorKey);
      return link ? String(link.id) : undefined;
    }
  } catch (err) { logFailure('findBlocksLinkId', err); }
  return undefined;
}

/**
 * Mirrors a dependency into a native Jira "Blocks" link. Reuses an existing link, so saving the
 * same dependency twice creates one link, and returns the link id.
 */
/**
 * Sets and removes trigger percents on the successor's issue property cascadeplan.links, as the user
 * (ADR-006). Returns the saved value, or null when Jira did not save it.
 */
export async function updateLinkPercents(successorKey: string, set: Record<string, number>, remove: string[]): Promise<{ v: number; links: Record<string, number> } | null> {
  const caller = getJiraCaller();
  try {
    const cur = await caller.requestJira(route`/rest/api/3/issue/${successorKey}/properties/${LINKS_PROPERTY}`);
    let links: Record<string, number> = {};
    if (cur && cur.status === 200) {
      const body = await cur.json();
      if (body?.value?.links && typeof body.value.links === 'object') links = { ...body.value.links };
    } else if (!cur || cur.status !== 404) {
      logFailure('updateLinkPercents', cur);
      return null;
    }
    for (const id of remove) delete links[id];
    Object.assign(links, set);
    const value = { v: 1, links };
    const res = await caller.requestJira(route`/rest/api/3/issue/${successorKey}/properties/${LINKS_PROPERTY}`, {
      method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(value)
    });
    if (!res || ![200, 201, 204].includes(res.status)) { logFailure('updateLinkPercents', res); return null; }
    return value;
  } catch (err) {
    logFailure('updateLinkPercents', err);
    return null;
  }
}

/** The Jira due date of one issue, read with reconcileIssues (C3); null when it has none, undefined when Jira does not say. */
async function currentJiraDueDate(key: string, id: string | undefined): Promise<string | null | undefined> {
  try {
    const params = new URLSearchParams({ jql: `key = ${key}`, fields: 'duedate' });
    if (id && /^\d+$/.test(id)) params.append('reconcileIssues', id);
    const res = await getJiraCaller().requestJira(route`/rest/api/3/search/jql?${params}`);
    if (!res || res.status !== 200) return undefined;
    const issue = ((await res.json())?.issues || [])[0];
    if (!issue) return undefined;
    const due = issue.fields?.duedate;
    return isIsoDate(due) ? String(due).slice(0, 10) : null;
  } catch (err) {
    logFailure('currentJiraDueDate', err);
    return undefined;
  }
}

/** Records a link this call created or deleted in the Jira data it already holds (as applyAcceptedDueDate does). */
function patchLiveLinks(live: LiveData, successorKey: string, add: { key: string; linkId?: string } | undefined, removeLinkIds: string[]): void {
  const pred = add ? (live.raw.issues || []).find((i: any) => i && i.key === add.key) : undefined;
  live.raw = { ...live.raw, issues: (live.raw.issues || []).map((i: any) => {
    if (!i || i.key !== successorKey) return i;
    let links = (Array.isArray(i.fields?.issuelinks) ? i.fields.issuelinks : []).filter((l: any) => !removeLinkIds.includes(String(l.id)));
    if (add && !links.some((l: any) => l.inwardIssue?.key === add.key && ['blocks', 'dependency'].includes(String(l.type?.name || '').toLowerCase()))) {
      links = [...links, { ...(add.linkId ? { id: add.linkId } : {}), type: { name: 'Blocks' }, inwardIssue: { key: add.key, id: pred ? String(pred.id) : add.key } }];
    }
    return { ...i, fields: { ...(i.fields || {}), issuelinks: links } };
  }) };
}

function patchLiveProperty(live: LiveData, issueKey: string, property: string, value: unknown): void {
  live.raw = { ...live.raw, issues: (live.raw.issues || []).map((i: any) =>
    (!i || i.key !== issueKey ? i : { ...i, properties: { ...(i.properties || {}), [property]: value } })) };
}

export async function mirrorDependencyToJira(
  successorKey: string,
  predecessorKey: string
): Promise<{ linked: boolean; linkId?: string; created?: boolean; error?: string }> {
  try {
    const existing = await findBlocksLinkId(successorKey, predecessorKey);
    if (existing) return { linked: true, linkId: existing, created: false };
    const body = {
      type: { name: 'Blocks' },
      inwardIssue: { key: predecessorKey },
      outwardIssue: { key: successorKey }
    };
    const caller = getJiraCaller();
    const res = await caller.requestJira(route`/rest/api/3/issueLink`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
    if (res?.status !== 201) return { linked: false };
    return { linked: true, linkId: await findBlocksLinkId(successorKey, predecessorKey), created: true };
  } catch (err: any) {
    return { linked: false, error: err?.message };
  }
}

/**
 * Deletes a Jira issue link by id. Used only for links that CascadePlan created.
 */
export async function removeMirroredLink(linkId: string): Promise<boolean> {
  try {
    const res = await getJiraCaller().requestJira(route`/rest/api/3/issueLink/${linkId}`, { method: 'DELETE' });
    return res?.status === 204 || res?.status === 200;
  } catch {
    return false;
  }
}

/**
 * Records a due date that Jira accepted in the Jira data this call already holds, so the plan built
 * afterwards (the response, or the next item of a batch) shows the written end, not the end read
 * before the write (F-03). A due date Jira refused is left as Jira holds it.
 */
export function applyAcceptedDueDate(
  live: LiveData, issueKey: string, updates: Partial<WbsTask>, result: { synced: boolean; fields: string[] }
): void {
  if (!result.synced) return;
  const due = result.fields.includes('duedate') && typeof updates.endDate === 'string' ? updates.endDate.slice(0, 10) : undefined;
  // The start property this call wrote (ADR-008) is recorded the same way.
  const prop = result.fields.includes('startdate') && typeof updates.startDate === 'string'
    ? { startDate: updates.startDate.slice(0, 10), ...(typeof updates.endDate === 'string' ? { endDate: updates.endDate.slice(0, 10) } : {}), v: 1 }
    : undefined;
  if (!due && !prop) return;
  // A new list on this call's own data: the issue objects themselves are never changed.
  live.raw = { ...live.raw, issues: (live.raw.issues || []).map((i: any) => {
    if (!i || i.key !== issueKey) return i;
    return { ...i,
      fields: due ? { ...(i.fields || {}), duedate: due } : i.fields,
      properties: prop ? { ...(i.properties || {}), [DATES_PROPERTY]: prop } : i.properties };
  }) };
}

/**
 * The Jira writes of one task update, run after its record is saved (F-07). A dependency exists only
 * as a Jira link (ADR-004): when Jira refuses the link, the record is put back and nothing else is
 * written. The link id and new sub-task keys Jira returns are stored with a second versioned write.
 */
async function applyPlannedJiraWrites(
  store: PlanStore, projectKey: string, target: WbsTask, savedEntry: StoredEntry, previous: StoredEntry | undefined,
  plan: { link?: { predecessorKey: string }; removeLinkIds: string[]; newSubtasks: Array<{ accountId: string; summary: string }>;
    subtaskAction?: { subtaskKey: string; action: 'delete' | 'unassign' | 'keep' }; percents: Record<string, number>; removePercentIds: string[] },
  log: SyncLog,
  live?: LiveData
): Promise<{ ok: true; entry: StoredEntry } | { ok: false; result: any }> {
  let entry: any = { ...savedEntry };
  let changed = false;
  if (plan.link) {
    const mirror = await mirrorDependencyToJira(target.key, plan.link.predecessorKey);
    log.record(target.key, ['issuelink'], { synced: mirror.linked, error: mirror.error || 'Jira did not create the link' });
    if (!mirror.linked) {
      const { issueKey: _k, issueId: _i, version: _v, ...prior } = (previous || {}) as any;
      await store.putEntry(target.key, target.id, stripJiraOwnedFields(prior), savedEntry.version);
      return { ok: false, result: { ok: false, success: false, error: 'link_refused', jiraSync: log.report(),
        message: `Jira did not create the link from ${plan.link.predecessorKey} to ${target.key}, so the dependency was not added and nothing was changed.` } };
    }
    if (live) patchLiveLinks(live, target.key, { key: plan.link.predecessorKey, linkId: mirror.linkId }, []);
  }
  // Any Jira link the user removes is deleted, whoever created it (N-11 L3).
  const removedLinkIds: string[] = [];
  for (const linkId of plan.removeLinkIds) {
    const ok = await removeMirroredLink(linkId);
    if (ok) removedLinkIds.push(linkId);
    log.record(target.key, ['issuelink'], { synced: ok, error: 'Jira did not delete the link' });
  }
  if (live && removedLinkIds.length) patchLiveLinks(live, target.key, undefined, removedLinkIds);
  // The trigger percents are the successor's issue property (ADR-006, N-11 L4).
  if (Object.keys(plan.percents).length || plan.removePercentIds.length) {
    const saved = await updateLinkPercents(target.key, plan.percents, plan.removePercentIds);
    log.record(target.key, ['linkpercent'], { synced: !!saved, error: 'Jira did not save the trigger percent' });
    if (live && saved) patchLiveProperty(live, target.key, LINKS_PROPERTY, saved);
  }
  if (plan.newSubtasks.length) {
    const caller = getJiraCaller();
    for (const s of plan.newSubtasks) {
      let subtaskKey: string | undefined;
      for (const stType of ['Sub-task', 'Subtask']) {
        try {
          const subRes = await caller.requestJira(route`/rest/api/3/issue`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ fields: { project: { key: projectKey }, parent: { key: target.key }, summary: s.summary,
              issuetype: { name: stType }, assignee: { accountId: s.accountId } } })
          });
          if (subRes && subRes.status === 201) {
            subtaskKey = String((await subRes.json()).key);
            log.record(subtaskKey, ['create'], { synced: true });
            break;
          }
        } catch (err) { logFailure('applyPlannedJiraWrites', err); }
      }
      // A person is a contributor only through a real Jira sub-task (ADR-004).
      entry.contributors = (entry.contributors || []).flatMap((c: any) =>
        (c.accountId === s.accountId && !c.subtaskKey ? (subtaskKey ? [{ ...c, subtaskKey }] : []) : [c]));
      if (!subtaskKey) log.record(target.key, ['contributor'], { synced: false, error: 'Jira did not create the sub-task, so the person was not added' });
      changed = true;
    }
  }
  if (plan.subtaskAction && plan.subtaskAction.action !== 'keep') {
    const { subtaskKey, action } = plan.subtaskAction;
    const caller = getJiraCaller();
    if (action === 'delete') {
      const delRes = await caller.requestJira(route`/rest/api/3/issue/${subtaskKey}`, { method: 'DELETE' });
      const ok = !!delRes && (delRes.status === 204 || delRes.status === 200);
      log.record(subtaskKey, ['delete'], { synced: ok, error: ok ? undefined : 'Jira did not delete the subtask' });
    } else if (action === 'unassign') {
      const unassignRes = await caller.requestJira(route`/rest/api/3/issue/${subtaskKey}`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ fields: { assignee: null } })
      });
      const ok = !!unassignRes && (unassignRes.status === 200 || unassignRes.status === 204);
      log.record(subtaskKey, ['unassign'], { synced: ok, error: ok ? undefined : 'Jira did not unassign the subtask' });
    }
  }
  if (changed) {
    const { issueKey: _k, issueId: _i, version, ...rest } = entry;
    const put = await store.putEntry(target.key, target.id, stripJiraOwnedFields(rest), version);
    if (put.ok) entry = put.entry;
  }
  return { ok: true, entry };
}

/**
 * Updates a task schedule, dates, effort, progress, or resource.
 */
export async function updateWbsTask(
  payload: { projectKey: string; projectId?: string; planId?: string; taskId: string; updates: Partial<WbsTask>; expectedVersion?: number; reconcileIds?: string[]; restore?: boolean; expectedDueDate?: string | null },
  storageProvider?: StorageProvider,
  preloaded?: LiveData,
  options?: { skipResponse?: boolean }
): Promise<ProjectPlanState> {
  const { projectKey, projectId, taskId, updates, expectedVersion } = payload;
  validateTaskUpdates(updates as Record<string, unknown>);
  // Undo and Redo send restore: they write the exact dates of every task the action changed, so no
  // new cascade runs; a cascade would move again a successor whose old dates broke a link (B-14).
  if (payload.restore !== undefined && typeof payload.restore !== 'boolean') throw new ValidationError('restore', 'restore must be true or false');
  const restoring = payload.restore === true;
  if (expectedVersion !== undefined && (!Number.isInteger(expectedVersion) || expectedVersion < 0)) {
    throw new ValidationError('expectedVersion', 'expectedVersion must be a whole number of at least 0');
  }
  const storage = resolveStorage(storageProvider);
  const log = new SyncLog();
  const planId = await writablePlanId(storage, projectKey, projectId, payload.planId);

  // Jira is read once per update (or once per batch); the returned plan reuses the same read (B-10, B-16).
  const live = preloaded || await loadLive(projectKey, reconcileIdsOf(payload.reconcileIds));
  const plan = await getProjectPlan(projectKey, storage, new Date(), undefined, projectId, live, planId);
  const targetTask = plan.tasks.find(t => t.id === taskId || t.key === taskId) ||
    (plan.backlogTasks || []).find(t => t.id === taskId || t.key === taskId);
  if (!targetTask) {
    throw new Error(`Task '${taskId}' not found in project plan`);
  }
  const store = openStore(storage, projectKey, projectId, planId);
  const entries = await store.loadEntries();
  const baseVersion = entries.get(targetTask.key)?.version ?? 0;
  if (expectedVersion !== undefined && expectedVersion !== baseVersion) {
    // The user edited an older copy: refuse before any Jira write (INV-08).
    return conflictResult(targetTask.key);
  }
  // C3: a date change carries the Jira due date the user saw. When someone changed it in Jira since,
  // the move is refused before any write. The check reads with reconcileIssues for this issue,
  // because the plain search can still show the old value.
  if (payload.expectedDueDate !== undefined && (updates.startDate !== undefined || updates.endDate !== undefined)) {
    if (payload.expectedDueDate !== null && !isIsoDate(payload.expectedDueDate)) throw new ValidationError('expectedDueDate', 'expectedDueDate must be a date in YYYY-MM-DD form, or null');
    const now = await currentJiraDueDate(targetTask.key, targetTask.id);
    if (now !== undefined && now !== (payload.expectedDueDate ? String(payload.expectedDueDate).slice(0, 10) : null)) {
      return { ...conflictResult(targetTask.key), error: 'due_date_changed',
        message: `${targetTask.key}'s due date was changed in Jira a moment ago (now ${now || 'none'}). Reload to see it, then move it again.` };
    }
  }
  // A sub-task's epic comes from its parent; an epic write would change its parent instead (N-07).
  if ((targetTask.isSubtask || targetTask.hierarchyLevel === -1) && (updates as Record<string, unknown>).epicKey !== undefined) {
    throw new ValidationError('epicKey', `${targetTask.key} is a sub-task; its epic comes from its parent work item.`);
  }
  // A parent whose dates come from its sub-tasks is not moved directly (N-06 rule 3, ADR-003).
  if (targetTask.datesFromChildren && ['startDate', 'endDate', 'startWeek', 'spanWeeks', 'endWeek'].some(f => (updates as Record<string, unknown>)[f] !== undefined)) {
    throw new ValidationError('startDate', `${targetTask.key} takes its dates from its sub-tasks. Move its sub-tasks instead.`);
  }
  // BL-2, INV-16: the user's own Jira permissions on the target, before any KVS or Jira write.
  const needed: IssuePermission[] = ['EDIT_ISSUES'];
  const u = updates as Record<string, unknown>;
  if (['startDate', 'endDate', 'startWeek', 'spanWeeks', 'endWeek'].some(f => u[f] !== undefined)) needed.push('SCHEDULE_ISSUES');
  if (u.dependency !== undefined || u.dependencies !== undefined || u.removeDependency !== undefined) needed.push('LINK_ISSUES');
  const deniedTarget = await deniedIssues([{ key: targetTask.key, id: targetTask.id }], needed);
  if (deniedTarget.length) {
    return forbiddenResult(`You cannot change ${targetTask.key}: your Jira role lacks ${describeMissing(deniedTarget[0].missing)}.`);
  }
  const idByKey = new Map([...plan.tasks, ...(plan.backlogTasks || [])].map(t => [t.key, t.id]));
  const planKeys = new Set([...plan.tasks, ...(plan.backlogTasks || [])].map(t => t.key));
  if (updates.dependency && updates.dependency.predecessorKey && !planKeys.has(updates.dependency.predecessorKey)) {
    throw new ValidationError('dependency.predecessorKey', `${updates.dependency.predecessorKey} is not in project ${projectKey}`);
  }

  const ALLOWED_KEYS = [
    'summary', 'epic', 'epicKey', 'story', 'effortHours', 'effortConfig', 'resource',
    'resourceAccountId', 'contributingResources', 'progress', 'targetProgress', 'manualProgress',
    'manualTargetProgress', 'status', 'startDate',
    'endDate', 'startWeek', 'endWeek', 'spanWeeks', 'weeklyAllocations', 'subtasks',
    'dependency', 'contributors', 'removeSubtaskAction'
  ];
  const sanitized: Partial<WbsTask> = {};
  for (const k of ALLOWED_KEYS) {
    if ((updates as any)[k] !== undefined) {
      (sanitized as any)[k] = (updates as any)[k];
    }
  }

  // Progress and Target Progress handling & Status auto-transition
  if (sanitized.progress !== undefined) {
    const rawP = Number(sanitized.progress);
    sanitized.progress = isNaN(rawP) ? 0 : Math.max(0, Math.min(100, Math.round(rawP)));
    // A progress the user sets by hand is stored as manual; "Use rollup" sends manualProgress false.
    if (sanitized.manualProgress === undefined) {
      sanitized.manualProgress = true;
    }
    // Progress never changes the Jira status: only a status the user chose is sent (F-06, INV-03).
  }
  if (sanitized.targetProgress !== undefined) {
    const rawT = Number(sanitized.targetProgress);
    sanitized.targetProgress = isNaN(rawT) ? 0 : Math.max(0, Math.min(100, Math.round(rawT)));
    if (sanitized.manualTargetProgress === undefined) {
      sanitized.manualTargetProgress = true;
    }
  }
  if (sanitized.manualTargetProgress === false) {
    const s = sanitized.startDate || targetTask.startDate;
    const e = sanitized.endDate || targetTask.endDate;
    sanitized.targetProgress = PlannerEngine.calculateTargetProgress(s, e);
  }

  // Fractional progress-threshold dependency validation and Jira link mirroring
  // Links are time-bound WORK_EFF_PRECEDENCY associations: a new link replaces the active set and the
  // others end; only the Jira links CascadePlan created are removed from Jira (B-28, NF-02).
  // Jira writes this update needs, made only after the target record is saved (F-07).
  const jiraPlan: {
    link?: { predecessorKey: string };
    removeLinkIds: string[];
    /** The trigger percents to set on this successor's cascadeplan.links property, and to remove (ADR-006). */
    percents: Record<string, number>;
    removePercentIds: string[];
    newSubtasks: Array<{ accountId: string; summary: string }>;
    subtaskAction?: { subtaskKey: string; action: 'delete' | 'unassign' | 'keep' };
  } = { removeLinkIds: [], newSubtasks: [], percents: {}, removePercentIds: [] };
  // Dependencies are Jira "Blocks" links, the same in every plan; the trigger percent is the issue
  // property cascadeplan.links of the successor (ADR-006, N-11). A dependency adds or updates one link
  // and keeps the others; removeDependency removes exactly one, whoever created it in Jira (L3);
  // dependency null removes every link. The plan record keeps no links (L5).
  let activeAfter: TaskDependency[] | undefined;
  const removeKey = (updates as any).removeDependency?.predecessorKey as string | undefined;
  if (sanitized.dependency !== undefined || removeKey) {
    const update = sanitized.dependency && sanitized.dependency.predecessorKey ? sanitized.dependency : null;
    if (update) {
      const validation = PlannerEngine.validateDependency(targetTask.key, update.predecessorKey, update.triggerPercent, plan.tasks);
      if (!validation.valid) {
        throw new Error(validation.error);
      }
    }
    const currentEntry = entries.get(targetTask.key);
    const activeNow = targetTask.dependencies || [];
    const storedNow: TaskDependency[] = currentEntry?.dependencies || (currentEntry?.dependency ? [currentEntry.dependency] : []);
    let removing: TaskDependency[] = [];
    if (removeKey) {
      const d = activeNow.find(x => x.predecessorKey === removeKey);
      if (!d) throw new ValidationError('removeDependency', `${targetTask.key} has no dependency on ${removeKey}`);
      removing = [d];
    } else if (!update && sanitized.dependency !== undefined) {
      removing = activeNow;
    }
    const idOf = (key: string) => idByKey.get(key) || key;
    if (update) {
      // The Jira link is created only after the record is saved under its version check (F-07).
      if (!activeNow.some(d => d.predecessorKey === update.predecessorKey && !d.planOnly)) jiraPlan.link = { predecessorKey: update.predecessorKey };
      jiraPlan.percents[idOf(update.predecessorKey)] = update.triggerPercent;
    }
    jiraPlan.removeLinkIds = removing.filter(d => !d.planOnly && d.jiraLinkId).map(d => d.jiraLinkId as string);
    jiraPlan.removePercentIds = removing.filter(d => !d.planOnly).map(d => idOf(d.predecessorKey));
    const touched = new Set([...(update ? [update.predecessorKey] : []), ...removing.map(d => d.predecessorKey)]);
    activeAfter = activeNow.filter(d => !touched.has(d.predecessorKey));
    if (update) activeAfter.unshift({ predecessorId: idOf(update.predecessorKey), predecessorKey: update.predecessorKey, triggerPercent: update.triggerPercent, isTriggerSatisfied: false });
    // A plan-only link the user touched leaves the record (created in Jira, or dropped).
    const keptStored = storedNow.filter(d => d && !touched.has(d.predecessorKey));
    sanitized.dependencies = keptStored;
    sanitized.dependency = keptStored[0] || null;
    // Ended links are history only (B-28); they never hide a Jira link (L3).
    const applied = applyLinkUpdate(removing, currentEntry?.endedLinks || [], undefined, todayIso());
    sanitized.endedLinks = [...applied.endedLinks.filter(e => !touched.has(e.predecessorKey)),
      ...removing.map(d => ({ predecessorKey: d.predecessorKey, triggerPercent: d.triggerPercent, until: todayIso(), ...(d.since ? { since: d.since } : {}) }))];
  }
  // The dependencies the engine sees for the target after this update.
  const depView = activeAfter ? { dependencies: activeAfter, dependency: activeAfter[0] || null } : {};
  // Second people: by account id from the picker, or names matched to exactly one Jira user (B-28).
  if ((updates as any).contributors !== undefined) {
    const prev = entries.get(targetTask.key)?.contributors || [];
    const nextContributors: any[] = [];
    for (const c of (updates as any).contributors as Array<{ accountId: string; subtaskKey?: string }>) {
      const prevMatch = prev.find(p => p.accountId === c.accountId);
      let subtaskKey = c.subtaskKey || prevMatch?.subtaskKey;
      if (!subtaskKey) {
        // Criterion 1: adding a second person creates a Jira sub-task assigned to that person,
        // after the record is saved (F-07); until then the person has no sub-task key.
        const userObj = live.users.find(u => u.accountId === c.accountId);
        const displayName = userObj ? userObj.displayName : c.accountId;
        jiraPlan.newSubtasks.push({ accountId: c.accountId, summary: formatSubtaskSummary(targetTask.summary, displayName) });
      }
      nextContributors.push({
        accountId: c.accountId,
        since: prevMatch?.since || todayIso(),
        ...(subtaskKey ? { subtaskKey } : {})
      });
    }
    sanitized.contributors = nextContributors;
  } else if (sanitized.contributingResources !== undefined) {
    sanitized.contributors = contributorsFromNames(sanitized.contributingResources || [], live.users, entries.get(targetTask.key)?.contributors || [], todayIso());
  }

  if ((updates as any).removeSubtaskAction) {
    const { subtaskKey, action } = (updates as any).removeSubtaskAction as { subtaskKey: string; action: 'delete' | 'unassign' | 'keep' };
    if (subtaskKey && action) jiraPlan.subtaskAction = { subtaskKey, action };
  }

  // Derive schedule dates and weeks dynamically
  const activeWeeks = plan.weeks || getDefaultWeeks();

  const userPickedDates = sanitized.startDate !== undefined || sanitized.endDate !== undefined;
  if (userPickedDates) {
    // Dates the user picked are kept exactly; the week grid position is derived from them (CP-07).
    const s = sanitized.startDate || targetTask.startDate;
    const e = sanitized.endDate || targetTask.endDate;
    // Also when only one end is sent, the end stays on or after the start (F-18).
    if (isIsoDate(s) && isIsoDate(e) && e < s) throw new ValidationError('endDate', 'The end must be on or after the start.');
    sanitized.startDate = s;
    sanitized.endDate = e;
    const sIdx = weekIndexContaining(activeWeeks, s);
    const eIdx = weekIndexContaining(activeWeeks, e);
    if (sIdx !== -1) sanitized.startWeek = activeWeeks[sIdx].weekKey;
    if (sIdx !== -1 && eIdx !== -1 && eIdx >= sIdx) {
      sanitized.endWeek = activeWeeks[eIdx].weekKey;
      sanitized.spanWeeks = eIdx - sIdx + 1;
    }
    if (!sanitized.weeklyAllocations && sanitized.startWeek && sanitized.spanWeeks) {
      sanitized.weeklyAllocations = evenAllocations(activeWeeks, sIdx, sanitized.spanWeeks);
    }
  } else if (sanitized.startWeek || sanitized.spanWeeks) {
    // The old week is the week of the start date itself (ADR-008: the date is the truth, the week is derived).
    const hasDates = isIsoDate(targetTask.startDate) && isIsoDate(targetTask.endDate);
    const oldIdx = hasDates ? weekIndexContaining(activeWeeks, targetTask.startDate as string) : -1;
    const oldSpan = targetTask.spanWeeks || 3;
    const sWk = sanitized.startWeek || targetTask.startWeek || activeWeeks[0].weekKey;
    const span = sanitized.spanWeeks || oldSpan;
    const sIdx = Math.max(0, activeWeeks.findIndex(w => w.weekKey === sWk));
    const eIdx = Math.min(activeWeeks.length - 1, sIdx + span - 1);

    sanitized.startWeek = activeWeeks[sIdx].weekKey;
    sanitized.endWeek = activeWeeks[eIdx].weekKey;
    sanitized.spanWeeks = span;
    if (oldIdx !== -1) {
      // A move or resize by whole weeks keeps the exact days of the bar.
      const shiftStart = (sIdx - oldIdx) * 7;
      sanitized.startDate = addDaysIso(targetTask.startDate as string, shiftStart);
      sanitized.endDate = addDaysIso(targetTask.endDate as string, shiftStart + (span - oldSpan) * 7);
    } else if (hasDates) {
      // A start outside the visible weeks has no week to shift from: the bar starts in the chosen week
      // and keeps its length in days.
      const days = Math.max(0, Math.round((Date.parse(`${targetTask.endDate}T00:00:00Z`) - Date.parse(`${targetTask.startDate}T00:00:00Z`)) / 86400000));
      sanitized.startDate = activeWeeks[sIdx].startDate;
      sanitized.endDate = addDaysIso(activeWeeks[sIdx].startDate, days + (span - oldSpan) * 7);
    } else {
      sanitized.startDate = activeWeeks[sIdx].startDate;
      sanitized.endDate = activeWeeks[eIdx].endDate;
    }
    if (!sanitized.weeklyAllocations) {
      sanitized.weeklyAllocations = evenAllocations(activeWeeks, sIdx, span);
    }
  }

  // A new or changed dependency moves the task to its earliest start, keeping its duration (B-11).
  if (!restoring && activeAfter && sanitized.dependency !== undefined && (updates as any).dependency && (updates as any).dependency.predecessorKey) {
    const start = sanitized.startDate || targetTask.startDate;
    const end = sanitized.endDate || targetTask.endDate;
    const candidate = plan.tasks.map(t => (t.key === targetTask.key ? { ...t, startDate: start, endDate: end, ...depView } : t));
    const inputs = engineInputs(candidate);
    const ev = evaluateEffort(targetTask.key, inputs.efforts, inputs.links, todayIso());
    if (ev.earliestStartDate && isIsoDate(start) && start < ev.earliestStartDate) {
      const days = isIsoDate(end) ? Math.max(0, Math.round((Date.parse(`${end}T00:00:00Z`) - Date.parse(`${start}T00:00:00Z`)) / 86400000)) : 0;
      sanitized.startDate = ev.earliestStartDate;
      sanitized.endDate = addDays(ev.earliestStartDate, days);
      Object.assign(sanitized, gridFor(activeWeeks, sanitized.startDate, sanitized.endDate));
    }
  }

  // Recalculate targetProgress if auto-target is active and dates were modified
  if (!targetTask.manualTargetProgress && sanitized.manualTargetProgress !== true && sanitized.targetProgress === undefined && (sanitized.startDate !== undefined || sanitized.endDate !== undefined)) {
    const s = sanitized.startDate || targetTask.startDate;
    const e = sanitized.endDate || targetTask.endDate;
    sanitized.targetProgress = PlannerEngine.calculateTargetProgress(s, e);
  }

  const scheduleMap: Record<string, Partial<WbsTask>> = Object.fromEntries(entries);
  const current = scheduleMap[targetTask.key] || {};
  const changedKeys = new Set<string>([targetTask.key]);
  const pendingSyncs: Array<{ key: string; updates: Partial<WbsTask> }> = [];

  // Links, ended links and second people not in this update stay as stored (merged below); links
  // imported from Jira stay live and are not copied into KVS.

  // Preserve existing manualProgress if updates didn't explicitly modify or clear it
  if (sanitized.manualProgress === undefined && (current.manualProgress !== undefined || targetTask.manualProgress !== undefined)) {
    sanitized.manualProgress = current.manualProgress !== undefined ? current.manualProgress : targetTask.manualProgress;
  }
  // Preserve existing manualTargetProgress if updates didn't explicitly modify or clear it
  if (sanitized.manualTargetProgress === undefined && (current.manualTargetProgress !== undefined || targetTask.manualTargetProgress !== undefined)) {
    sanitized.manualTargetProgress = current.manualTargetProgress !== undefined ? current.manualTargetProgress : targetTask.manualTargetProgress;
  }

  scheduleMap[targetTask.key] = stripJiraOwnedFields({
    ...current,
    ...sanitized
  });

  // Cascade date shifts to conflicting successors, at most CASCADE_BATCH_LIMIT per call (B-10, B-11).
  let cascadeRemaining: string[] = [];
  if (!restoring && (sanitized.startDate || sanitized.endDate || activeAfter)) {
    // The parents' roll-ups are recomputed with the new dates before the cascade (N-06 rule 1).
    const candidateTasks = withRollUps(plan.tasks.map(t => (t.key === targetTask.key ? { ...t, ...sanitized, ...depView } : t)));
    const inputs = engineInputs(candidateTasks);
    const first = cascade(inputs.efforts, inputs.links, targetTask.key, todayIso());
    reportCycle(first.cycle, log);
    const changes = [...first.changes];
    let efforts = first.efforts;
    // Every ancestor whose roll-up changed also cascades to its own successors. (The parent's own Jira
    // due date follows only when the drag preview lists it, INV-03; DEC-6 is not built yet.)
    for (const anc of ancestorKeys(targetTask.key, plan.tasks)) {
      const was = plan.tasks.find(t => t.key === anc);
      const now = candidateTasks.find(t => t.key === anc);
      if (!was || !now || !now.datesFromChildren || (was.startDate === now.startDate && was.endDate === now.endDate)) continue;
      const more = cascade(efforts, inputs.links, anc, todayIso());
      reportCycle(more.cycle, log);
      for (const c of more.changes) if (!changes.some(x => x.key === c.key)) changes.push(c);
      efforts = more.efforts;
    }
    // A cascade into a task or story parent moves its block (N-06 rule 2).
    const expanded = expandParentCascades(changes, [...plan.tasks, ...(plan.backlogTasks || [])], todayIso(), new Set([targetTask.key]));
    reportEpicsNotMoved(expanded.epics, log);
    cascadeRemaining = expanded.changes.slice(CASCADE_BATCH_LIMIT).map(c => c.key);
    for (const c of expanded.changes.slice(0, CASCADE_BATCH_LIMIT)) {
      scheduleMap[c.key] = { ...(scheduleMap[c.key] || {}), startDate: c.toStart, endDate: c.toEnd, ...gridFor(activeWeeks, c.toStart, c.toEnd) };
      changedKeys.add(c.key);
      pendingSyncs.push({ key: c.key, updates: { startDate: c.toStart, endDate: c.toEnd } });
    }
  }

  // A parent's dates follow its children on every load (B-28); nothing is stored for the parent.

  // A cascaded successor the user may not edit and schedule is not moved, and is reported (BL-2).
  const notMoved = new Set<string>();
  const successors = [...changedKeys].filter(k => k !== targetTask.key).map(k => ({ key: k, id: idByKey.get(k) }));
  for (const d of await deniedIssues(successors, ['EDIT_ISSUES', 'SCHEDULE_ISSUES'])) {
    notMoved.add(d.key);
    changedKeys.delete(d.key);
    log.record(d.key, ['plan'], { synced: false, error: `not moved: you lack ${describeMissing(d.missing)} on this issue in Jira` });
  }

  // KVS first, with a version check per record; Jira only after the target record is saved.
  let targetPut = await store.putEntry(targetTask.key, targetTask.id, stripJiraOwnedFields(scheduleMap[targetTask.key]), baseVersion);
  if (!targetPut.ok) return conflictResult(targetTask.key);
  const saved = await applyPlannedJiraWrites(store, projectKey, targetTask, targetPut.entry as any, entries.get(targetTask.key), jiraPlan, log, live);
  if (!saved.ok) return saved.result;
  targetPut = { ok: true, entry: saved.entry } as any;

  // The target's fields go to Jira first. Dates are shared and successors move only when Jira accepted
  // the due date; when it did not, the target keeps its old dates and nothing else moves (F-19, C6).
  const targetSync: any = await syncTaskToJira(targetTask.key, sanitized, log, targetTask);
  applyAcceptedDueDate(live, targetTask.key, sanitized, targetSync);
  if (typeof sanitized.endDate === 'string' && !(targetSync.synced && targetSync.fields.includes('duedate'))) {
    const prev: Record<string, unknown> = (entries.get(targetTask.key) || {}) as any;
    const { issueKey: _k, issueId: _i, version, ...cur } = targetPut.entry as any;
    const restored: Record<string, unknown> = { ...cur };
    for (const f of SHARED_DATE_FIELDS) {
      if (prev[f] === undefined) delete restored[f]; else restored[f] = prev[f];
    }
    if (!restored.startWeek) restored.isBacklog = true; else delete restored.isBacklog;
    const back = await store.putEntry(targetTask.key, targetTask.id, stripJiraOwnedFields(restored as Partial<WbsTask>), version);
    const reason = (targetSync.reasons && targetSync.reasons.duedate) || targetSync.error || 'Jira did not save the due date';
    return Object.assign(await getProjectPlan(projectKey, storage, new Date(), undefined, projectId, live, planId), {
      ok: false, success: false, error: 'due_date_refused', jiraSync: log.report(),
      message: back.ok
        ? `${reason}, so ${targetTask.key} keeps its dates and nothing else moved.`
        : `${reason}. Someone else changed ${targetTask.key} since; reload to see the latest plan.`
    });
  }
  for (const key of changedKeys) {
    if (key === targetTask.key) continue;
    const put = await store.putEntry(key, idByKey.get(key), stripJiraOwnedFields(scheduleMap[key]), entries.get(key)?.version ?? 0);
    if (!put.ok) { notMoved.add(key); log.record(key, ['plan'], { synced: false, error: 'not moved: someone else changed it; move the task again' }); }
  }
  // Jira is the single truth for a task: every changed field, the due date and the shared start
  // property included (ADR-008), goes to Jira from whichever plan the change was made in.
  for (const s of pendingSyncs) {
    if (notMoved.has(s.key)) continue;
    applyAcceptedDueDate(live, s.key, s.updates, await syncTaskToJira(s.key, s.updates, log, plan.tasks.find(t => t.key === s.key)));
  }
  // DEC-6: a parent whose roll-up end changed gets that end as its Jira due date.
  const movedDates = new Map<string, { startDate?: string; endDate?: string }>();
  if (sanitized.startDate || sanitized.endDate) movedDates.set(targetTask.key, { startDate: sanitized.startDate || targetTask.startDate, endDate: sanitized.endDate || targetTask.endDate });
  for (const s of pendingSyncs) if (!notMoved.has(s.key)) movedDates.set(s.key, { startDate: s.updates.startDate, endDate: s.updates.endDate });
  await followParentDueDates([...plan.tasks, ...(plan.backlogTasks || [])], movedDates, log, live);

  const result = { ok: true, jiraSync: log.report(), cascadeRemaining, cascadeSkipped: [...notMoved], writtenIssueIds: writtenIssueIds(log, plan.tasks) };
  // A batch builds one plan at the end, so its items skip building their own (F-17).
  if (options?.skipResponse) return result as any;
  return Object.assign(await getProjectPlan(projectKey, storage, new Date(), undefined, projectId, live, planId), result);
}

/**
 * Deletes every CascadePlan record of one issue, in the Main Plan and in every scenario plan (BL-9).
 * Called only for Jira's issue-deleted event. Records are matched by the issue id and by the issue
 * key, because older records can be stored under the key (FX-05). Both the project id and the
 * project key prefixes are checked. Running it twice for the same issue changes nothing.
 */
export async function deleteIssueRecords(
  storage: StorageProvider,
  target: { projectKey?: string; projectId?: string; issueKey?: string; issueId?: string }
): Promise<{ deleted: string[] }> {
  const deleted: string[] = [];
  const projectKey = target.projectKey;
  const scopes = new Set<string>([target.projectId, projectKey].filter((s): s is string => !!s));
  for (const scope of scopes) {
    const main = new PlanStore(storage, scope, projectKey || scope);
    const planIds: Array<string | undefined> = [undefined, ...(await main.listPlans()).map(p => p.id).filter(id => id && id !== 'default')];
    for (const planId of planIds) {
      const store = new PlanStore(storage, scope, projectKey || scope, planId);
      for (const [key, entry] of await store.loadEntries()) {
        const matches = (target.issueKey && key === target.issueKey)
          || (target.issueId && (entry.issueId === target.issueId || key === target.issueId));
        if (!matches) continue;
        await store.deleteEntry(key);
        deleted.push(`${scope}:${planId || 'default'}:${key}`);
      }
    }
  }
  return { deleted };
}

/**
 * Forge trigger for avi:jira:deleted:issue (BL-9). Runs as the app; it never calls Jira, so no
 * user's permissions can cause a delete. Logs one line per run, without names or summaries.
 */
export async function issueDeleted(event: any, storageProvider?: StorageProvider): Promise<{ deleted: string[] }> {
  const issue = event?.issue || {};
  const target = {
    issueId: issue.id !== undefined ? String(issue.id) : undefined,
    issueKey: typeof issue.key === 'string' ? issue.key : undefined,
    projectId: issue.fields?.project?.id !== undefined ? String(issue.fields.project.id) : undefined,
    projectKey: typeof issue.fields?.project?.key === 'string' ? issue.fields.project.key
      : (typeof issue.key === 'string' ? issue.key.replace(/-\d+$/, '') : undefined)
  };
  if (!target.issueId && !target.issueKey) return { deleted: [] };
  const res = await deleteIssueRecords(resolveStorage(storageProvider), target);
  // eslint-disable-next-line no-console
  console.log(`issue-deleted ${target.issueKey || target.issueId} (project id ${target.projectId ? 'present' : 'missing'}): ${res.deleted.length} record(s) deleted`);
  return res;
}

/**
 * Applies several task updates in one call (B-16 standup flow), with one Jira read. Each item runs
 * like updateWbsTask, including its cascade. When an item's version was changed by an earlier item of
 * the same batch (a cascade), it is retried once with the current version; a version changed by
 * anyone else is reported as a conflict and the other items still apply.
 */
export async function batchUpdateTasks(
  payload: { projectKey: string; projectId?: string; planId?: string; items: Array<{ taskId: string; updates: Partial<WbsTask>; expectedVersion?: number }>; reconcileIds?: string[] },
  storageProvider?: StorageProvider
): Promise<ProjectPlanState & { results: Array<{ taskId: string; ok: boolean; conflict?: boolean }> }> {
  const { projectKey, projectId, items } = payload;
  if (!Array.isArray(items) || items.length === 0 || items.length > 50) throw new ValidationError('items', 'items must be a list of 1 to 50 updates');
  for (const item of items) {
    assertIssueKey(item.taskId, 'taskId');
    validateTaskUpdates(item.updates as Record<string, unknown>);
  }
  // One read of each KVS key and prefix for the whole batch (F-17): later items read the batch's own
  // writes from memory. The version check still reaches KVS on every write.
  const storage = new BatchStorage(resolveStorage(storageProvider));
  const planId = await writablePlanId(storage, projectKey, projectId, payload.planId);
  const store = openStore(storage, projectKey, projectId, planId);
  const live = await loadLive(projectKey, reconcileIdsOf(payload.reconcileIds));
  const startVersions = new Map([...(await store.loadEntries())].map(([k, e]) => [k, e.version]));
  const writes: JiraWriteRecord[] = [];
  const results: Array<{ taskId: string; ok: boolean; conflict?: boolean }> = [];
  const cascadeRoots: string[] = [];
  const remaining: string[] = [];
  let plan: ProjectPlanState | null = null;
  for (const item of items) {
    const run = (expectedVersion?: number) => updateWbsTask({ projectKey, projectId, planId, taskId: item.taskId, updates: item.updates, expectedVersion }, storage, live, { skipResponse: true });
    let res: any = await run(item.expectedVersion);
    if (res && res.conflict) {
      const now = (await store.loadEntries()).get(item.taskId)?.version ?? 0;
      const changedByBatch = now !== (startVersions.get(item.taskId) ?? 0) && item.expectedVersion === (startVersions.get(item.taskId) ?? 0);
      if (changedByBatch) res = await run(now);
    }
    const conflict = !!(res && res.conflict);
    results.push(conflict ? { taskId: item.taskId, ok: false, conflict: true } : { taskId: item.taskId, ok: true });
    if (res && Array.isArray(res.cascadeRemaining) && res.cascadeRemaining.length) {
      cascadeRoots.push(item.taskId);
      remaining.push(...res.cascadeRemaining);
    }
    writes.push(...((res && res.jiraSync && res.jiraSync.writes) || []));
    if (res && Array.isArray(res.tasks)) plan = res;
  }
  const finalPlan = plan || await getProjectPlan(projectKey, storage, new Date(), undefined, projectId, live, planId);
  const failed = writes.filter(w => !w.ok);
  const jiraSync: JiraSyncReport = { ok: failed.length === 0, writes };
  if (failed.length) jiraSync.error = failed.map(w => `${w.key}: ${w.error}`).join('; ');
  // Each item whose cascade has successors left is a root the client continues from (F-20).
  return Object.assign(finalPlan, { ok: results.every(r => r.ok), jiraSync, results, cascadeRoots, cascadeRemaining: [...new Set(remaining)],
    writtenIssueIds: writtenIssueIds({ report: () => jiraSync } as any, finalPlan.tasks) });
}

/** Ids of the issues this call wrote to Jira, for the client's next read-after-write search (F-03). */
function writtenIssueIds(log: { report: () => JiraSyncReport }, tasks: Array<{ key: string; id?: string }>): string[] {
  const idByKey = new Map(tasks.map(t => [t.key, t.id]));
  const ids = log.report().writes.filter(w => w.ok).map(w => idByKey.get(w.key)).filter((id): id is string => !!id && /^\d+$/.test(id));
  return [...new Set(ids)].slice(0, 50);
}

/** The keys of every ancestor of a task, nearest first. */
function ancestorKeys(key: string, tasks: Array<{ key: string; parentKey?: string }>): string[] {
  const byKey = new Map(tasks.map(t => [t.key, t]));
  const out: string[] = [];
  let cur = byKey.get(key)?.parentKey;
  while (cur && !out.includes(cur)) { out.push(cur); cur = byKey.get(cur)?.parentKey; }
  return out;
}

/** A copy of the tasks with every roll-up parent's dates recomputed from its dated children. */
export function withRollUps<T extends { key: string; parentKey?: string; startDate?: string; endDate?: string; datesFromChildren?: boolean }>(tasks: T[]): T[] {
  let out = tasks.map(t => ({ ...t }));
  for (let pass = 0; pass < 4; pass++) {
    const spans = rollUpParentDates(out);
    let changed = false;
    out = out.map(t => {
      const span = spans.get(t.key);
      if (!span || (t.startDate === span.startDate && t.endDate === span.endDate)) return t;
      changed = true;
      return { ...t, ...span, datesFromChildren: true };
    });
    if (!changed) break;
  }
  return out;
}

/** Tasks in a dependency cycle are not moved by a cascade; each is reported (F-15). */
function reportCycle(cycle: string[] | undefined, log: SyncLog): void {
  for (const key of cycle || []) {
    log.record(key, ['plan'], { synced: false, error: 'not moved: it is in a dependency cycle; remove one of its links' });
  }
}

export const CASCADE_BATCH_LIMIT = 25;

/**
 * N-06 rule 2, ADR-003 section 3: a cascade that reaches a task or story roll-up parent moves the
 * parent's block by the block rules; the parent has no record of its own to write. A cascade into
 * an epic is not applied in v1 (DEC-5b): the epic is returned, to be reported "not moved".
 * Keys in `exclude` (the task the user moved) are never changed by the expansion.
 */
export function expandParentCascades<C extends { key: string; toStart: string; toEnd: string }>(
  changes: C[], tasks: WbsTask[], today: string, exclude: Set<string> = new Set()
): { changes: Array<{ key: string; toStart: string; toEnd: string }>; epics: string[] } {
  const out: Array<{ key: string; toStart: string; toEnd: string }> = [];
  const epics: string[] = [];
  const seen = new Set(exclude);
  for (const c of changes) {
    const t = tasks.find(x => x.key === c.key);
    if (!t || !t.datesFromChildren) {
      if (!seen.has(c.key)) { out.push(c); seen.add(c.key); }
      continue;
    }
    if (t.isEpic || (t.hierarchyLevel ?? 0) >= 1) { epics.push(c.key); continue; }
    if (!isIsoDate(t.startDate)) continue;
    const days = Math.round((Date.parse(`${c.toStart}T00:00:00Z`) - Date.parse(`${t.startDate}T00:00:00Z`)) / 86400000);
    if (days === 0) continue;
    for (const b of planBlockMove(tasks.filter(x => x.parentKey === t.key), days, today).changes) {
      if (!seen.has(b.key)) { out.push({ key: b.key, toStart: b.toStart, toEnd: b.toEnd }); seen.add(b.key); }
    }
  }
  return { changes: out, epics };
}

function reportEpicsNotMoved(epics: string[], log: SyncLog): void {
  for (const key of epics) log.record(key, ['plan'], { synced: false, error: 'not moved: it is an epic; move its work items' });
}

/**
 * Applies the next batch of a cascade from a task: moves at most CASCADE_BATCH_LIMIT conflicting
 * successors and returns the keys still to move (D-05: the client calls again until empty).
 */
export async function continueCascade(
  payload: { projectKey: string; projectId?: string; planId?: string; taskId: string; reconcileIds?: string[] },
  storageProvider?: StorageProvider
): Promise<ProjectPlanState> {
  const { projectKey, projectId, taskId } = payload;
  assertIssueKey(taskId, 'taskId');
  const storage = resolveStorage(storageProvider);
  const planId = await writablePlanId(storage, projectKey, projectId, payload.planId);
  const log = new SyncLog();
  const live = await loadLive(projectKey, reconcileIdsOf(payload.reconcileIds));
  const plan = await getProjectPlan(projectKey, storage, new Date(), undefined, projectId, live, planId);
  const store = openStore(storage, projectKey, projectId, planId);
  const entries = await store.loadEntries();
  const inputs = engineInputs(plan.tasks);
  const first = cascade(inputs.efforts, inputs.links, taskId, todayIso());
  reportCycle(first.cycle, log);
  // A cascade into a task or story parent moves its block (N-06 rule 2).
  const expanded = expandParentCascades(first.changes, [...plan.tasks, ...(plan.backlogTasks || [])], todayIso(), new Set([taskId]));
  reportEpicsNotMoved(expanded.epics, log);
  const changes = expanded.changes;
  // BL-2: a successor the user may not edit and schedule is not moved, and is reported.
  const batch = changes.slice(0, CASCADE_BATCH_LIMIT);
  // Successors this round could not move are returned, never dropped (F-20, INV-11).
  const skipped: string[] = [];
  const denied = new Map((await deniedIssues(batch.map(c => ({ key: c.key, id: [...plan.tasks, ...(plan.backlogTasks || [])].find(t => t.key === c.key)?.id })),
    ['EDIT_ISSUES', 'SCHEDULE_ISSUES'])).map(d => [d.key, d.missing]));
  for (const c of batch) {
    const missing = denied.get(c.key);
    if (missing) { skipped.push(c.key); log.record(c.key, ['plan'], { synced: false, error: `not moved: you lack ${describeMissing(missing)} on this issue in Jira` }); continue; }
    const cur = entries.get(c.key);
    const task = [...plan.tasks, ...(plan.backlogTasks || [])].find(t => t.key === c.key);
    const put = await store.putEntry(c.key, task?.id, stripJiraOwnedFields({ ...(cur || {}), startDate: c.toStart, endDate: c.toEnd,
      ...gridFor(plan.weeks, c.toStart, c.toEnd) }), cur ? cur.version : 0);
    if (!put.ok) { skipped.push(c.key); log.record(c.key, ['plan'], { synced: false, error: 'not moved: someone else changed it; move the task again' }); continue; }
    applyAcceptedDueDate(live, c.key, { startDate: c.toStart, endDate: c.toEnd }, await syncTaskToJira(c.key, { startDate: c.toStart, endDate: c.toEnd }, log, task));
  }
  return Object.assign(await getProjectPlan(projectKey, storage, new Date(), undefined, projectId, live, planId),
    { ok: true, jiraSync: log.report(), cascadeRemaining: changes.slice(CASCADE_BATCH_LIMIT).map(c => c.key), cascadeSkipped: skipped,
      writtenIssueIds: writtenIssueIds(log, plan.tasks) });
}

/**
 * Lists the moves that a change of start week or span would cause, without writing anything.
 */
export async function previewCascade(
  payload: { projectKey: string; projectId?: string; planId?: string; taskId: string; updates: { startDate?: string; endDate?: string; startWeek?: string; spanWeeks?: number } },
  storageProvider?: StorageProvider
): Promise<{ ok: boolean; changes: Array<{ key: string; field: string; from?: string; to?: string; reason?: string }> }> {
  const { projectKey, projectId, taskId, updates } = payload;
  assertIssueKey(taskId, 'taskId');
  validateTaskUpdates(updates as Record<string, unknown>);
  const plan = await getProjectPlan(projectKey, resolveStorage(storageProvider), new Date(), undefined, projectId, undefined, payload.planId);
  const target = plan.tasks.find(t => t.key === taskId);
  let start = updates.startDate || target?.startDate;
  let end = updates.endDate || target?.endDate;
  if (target && !updates.startDate && updates.startWeek && isIsoDate(target.startDate) && isIsoDate(target.endDate)) {
    // A move by weeks keeps the exact days of the bar (as updateWbsTask does).
    const shift = (plan.weeks.findIndex(w => w.weekKey === updates.startWeek) - plan.weeks.findIndex(w => w.weekKey === target.startWeek)) * 7;
    start = addDays(target.startDate, shift);
    end = addDays(target.endDate, shift + ((updates.spanWeeks || target.spanWeeks || 1) - (target.spanWeeks || 1)) * 7);
  }
  const candidate = plan.tasks.map(t => (t.key === taskId ? { ...t, startDate: start, endDate: end } : t));
  const inputs = engineInputs(candidate);
  const { changes } = cascade(inputs.efforts, inputs.links, taskId, todayIso());
  return { ok: true, changes: changes.map(c => ({ key: c.key, field: 'startDate', from: c.fromStart, to: c.toStart, reason: c.reason })) };
}

/**
 * Removes a task from the scheduled planner timeline and moves it back to unmapped backlog.
 */
export async function unscheduleTask(
  payload: UnscheduleTaskRequest,
  storageProvider?: StorageProvider
): Promise<ProjectPlanState> {
  const { projectKey, projectId, taskId } = payload;
  const issueId = await verifyIssueInProject(taskId, projectKey, 'taskId');
  await requireIssuePermissions([{ key: taskId, id: issueId }], ['EDIT_ISSUES']);
  const storage = resolveStorage(storageProvider);
  const planId = await writablePlanId(storage, projectKey, projectId, payload.planId);
  const store = openStore(storage, projectKey, projectId, planId);
  if (isMainPlan(planId)) await migrateIfNeeded(store, projectKey);
  const current = (await store.loadEntries()).get(taskId);
  if (current) {
    const entry: Partial<WbsTask> = { ...current };
    for (const f of ['startWeek', 'endWeek', 'startDate', 'endDate', 'weeklyAllocations', 'sequenceNum'] as const) delete entry[f];
    entry.isBacklog = true;
    const put = await store.putEntry(taskId, issueId, stripJiraOwnedFields(entry), current.version);
    if (!put.ok) return conflictResult(taskId);
    // The task leaves the timeline in every plan. Its Jira due date is left as it is.
    const log = new SyncLog();
    await markUnscheduled(taskId, log, current.startDate);
    return Object.assign(await getProjectPlan(projectKey, storage, new Date(), undefined, projectId, undefined, planId, issueId ? [issueId] : []),
      { ok: true, jiraSync: log.report() });
  }
  // Scheduled only through the shared property (ADR-008): the marker takes the task off every plan.
  const log = new SyncLog();
  await markUnscheduled(taskId, log);
  return Object.assign(await getProjectPlan(projectKey, storage, new Date(), undefined, projectId, undefined, planId, issueId ? [issueId] : []),
    { ok: true, jiraSync: log.report() });
}

/**
 * Takes a task off the timeline in every plan (ADR-008): the issue property keeps no start. A property
 * without a start wins over the start in any plan's older record, which a deleted property would not.
 */
async function markUnscheduled(issueKey: string, log: SyncLog, oldStart?: string): Promise<void> {
  let ok = false;
  try {
    const res = await getJiraCaller().requestJira(route`/rest/api/3/issue/${issueKey}/properties/${DATES_PROPERTY}`, {
      method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ v: 1 })
    });
    ok = !!res && (res.status === 200 || res.status === 201 || res.status === 204);
    if (!ok) logFailure('markUnscheduled', res);
  } catch (err) { logFailure('markUnscheduled', err); }
  const changes = [{ field: 'start date', from: isIsoDate(oldStart) ? oldStart : null, to: null }];
  log.record(issueKey, ['startdate'], ok ? { synced: true } : { synced: false, error: 'Jira did not save that the task is off the timeline' }, changes);
}

/**
 * Reorders tasks within the WBS planner grid.
 */
export async function reorderWbsTasks(
  payload: ReorderTasksRequest,
  storageProvider?: StorageProvider
): Promise<ProjectPlanState> {
  const { projectKey, projectId, taskId, targetIndex } = payload;
  const storage = resolveStorage(storageProvider);
  const planId = await writablePlanId(storage, projectKey, projectId, payload.planId);

  const live = await loadLive(projectKey);
  const plan = await getProjectPlan(projectKey, storage, new Date(), undefined, projectId, live, planId);
  const moving = plan.tasks.find(t => t.key === taskId || t.id === taskId);
  if (moving) await requireIssuePermissions([{ key: moving.key, id: moving.id }], ['EDIT_ISSUES']);
  const reordered = PlannerEngine.reorderTasks(plan.tasks, taskId, targetIndex);
  const store = openStore(storage, projectKey, projectId, planId);
  const entries = await store.loadEntries();
  const pos = reordered.findIndex(t => t.key === taskId || t.id === taskId);
  if (pos !== -1) {
    const movedKey = reordered[pos].key;
    // Scheduled rows always have a record. Rows without a sequence number get one first,
    // in their current order (one write per such row, once).
    let last: number | undefined;
    for (const row of reordered) {
      const e = entries.get(row.key);
      if (row.key === movedKey || !e) continue;
      if (typeof e.sequenceNum === 'number') { last = e.sequenceNum; continue; }
      const seq = sequenceBetween(last, undefined);
      const put = await store.putEntry(row.key, row.id, { ...e, sequenceNum: seq }, e.version);
      // A row someone else changed meanwhile: refuse, so the client reloads (F-28).
      if (!put.ok) return conflictResult(row.key);
      entries.set(row.key, put.entry);
      last = seq;
    }
    const seqAt = (i: number) => (i >= 0 && i < reordered.length ? entries.get(reordered[i].key)?.sequenceNum : undefined);
    const moved = entries.get(movedKey);
    if (moved) {
      const put = await store.putEntry(movedKey, reordered[pos].id, { ...moved, sequenceNum: sequenceBetween(seqAt(pos - 1), seqAt(pos + 1)) }, moved.version);
      if (!put.ok) return conflictResult(movedKey);
    }
  }
  return Object.assign(await getProjectPlan(projectKey, storage, new Date(), undefined, projectId, live, planId), { ok: true, jiraSync: noJiraWrites() });
}

/**
 * Creates a subtask in Jira specifically allocated to a secondary or specific team resource.
 * Adheres to Jira single-assignee best practice by creating background subtasks per resource.
 */
export async function createSubtaskForResource(
  payload: CreateSubtaskForResourceRequest,
  storageProvider?: StorageProvider
): Promise<{ success: boolean; ok: boolean; jiraSync: JiraSyncReport; subtask?: WbsTask; plan?: ProjectPlanState; error?: string }> {
  validateSchedulePayload(payload as unknown as Record<string, unknown>);
  const projectKey = payload.projectKey;
  const projectId = payload.projectId;
  const parentKey = payload.parentKey || payload.parentTaskId;
  const resource = payload.resource || payload.assigneeName || 'Unassigned';
  const resourceAccountId = payload.resourceAccountId || payload.assigneeAccountId;
  const summary = payload.summary || `Subtask: ${resource}`;
  // Only what the user entered goes to Jira: no default estimate and no default due date (F-06, INV-03).
  const effortHours = typeof payload.effortHours === 'number' && payload.effortHours > 0 ? payload.effortHours : undefined;
  const startWeek = payload.startWeek;
  const spanWeeks = payload.spanWeeks ?? 2;
  if (payload.endDate !== undefined && !isIsoDate(payload.endDate)) throw new ValidationError('endDate', 'endDate must be a date in YYYY-MM-DD form');

  if (!parentKey) {
    return { success: false, ok: false, error: 'parentKey is required', jiraSync: noJiraWrites() };
  }
  const parentIssueId = await verifyIssueInProject(parentKey, projectKey, 'parentKey');
  // The sub-task is created under the parent, and the parent's record changes (BL-2).
  await requireIssuePermissions([{ key: parentKey, id: parentIssueId }], ['EDIT_ISSUES']);
  const storage = resolveStorage(storageProvider);
  const planId = await writablePlanId(storage, projectKey, projectId, payload.planId);

  const caller = getJiraCaller();

  let createdId = '';
  let createdKey = '';
  const subtaskTypes = ['Sub-task', 'Subtask'];
  let lastErr = '';

  for (const stType of subtaskTypes) {
    try {
      const body: any = {
        fields: {
          project: { key: projectKey },
          parent: { key: parentKey },
          summary,
          issuetype: { name: stType }
        }
      };
      if (resourceAccountId && !resourceAccountId.startsWith('ph:') && resourceAccountId !== 'unassigned') {
        body.fields.assignee = { accountId: resourceAccountId };
      }

      const res = await caller.requestJira(route`/rest/api/3/issue`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });

      if (res && res.status === 201) {
        const data = await res.json();
        createdId = String(data.id);
        createdKey = String(data.key);
        break;
      } else {
        const errJson = await res.json().catch(() => ({}));
        lastErr = errJson.errorMessages?.join(', ') || JSON.stringify(errJson.errors || {});
      }
    } catch (err: any) {
      lastErr = err?.message || 'Network error';
    }
  }

  if (!createdKey) {
    const message = `Failed to create subtask in Jira: ${lastErr}`;
    return { success: false, ok: false, error: message, jiraSync: failedCreate(message) };
  }

  const dynamicWeeks = getTimelineWeeks();
  const activeWeeks = dynamicWeeks.weeks;
  const assignedStart = startWeek || activeWeeks[dynamicWeeks.currentWeekIndex].weekKey;
  const sIdx = Math.max(0, activeWeeks.findIndex(w => w.weekKey === assignedStart));
  const eIdx = Math.min(activeWeeks.length - 1, sIdx + spanWeeks - 1);

  const allocations: Record<string, number> = {};
  for (let i = sIdx; i <= eIdx; i++) {
    allocations[activeWeeks[i].weekKey] = Math.round(100 / spanWeeks);
  }

  const store = openStore(storage, projectKey, projectId, planId);
  if (isMainPlan(planId)) await migrateIfNeeded(store, projectKey);
  const createdPut = await store.putEntry(createdKey, createdId, {
    startWeek: assignedStart,
    endWeek: activeWeeks[eIdx].weekKey,
    startDate: activeWeeks[sIdx].startDate,
    endDate: activeWeeks[eIdx].endDate,
    spanWeeks,
    weeklyAllocations: allocations
  });
  const log = new SyncLog();

  if (parentKey && resourceAccountId) {
    const parentEntries = await store.loadEntries();
    const parentStored = parentEntries.get(parentKey);
    if (parentStored) {
      const parentId = parentStored.issueId || (await verifyIssueInProject(parentKey, projectKey, 'parentKey'));
      const existingContributors = parentStored.contributors ? [...parentStored.contributors] : [];
      const partyIdx = existingContributors.findIndex(c => c.accountId === resourceAccountId);
      if (partyIdx !== -1) {
        existingContributors[partyIdx] = { ...existingContributors[partyIdx], subtaskKey: createdKey };
      } else {
        existingContributors.push({ accountId: resourceAccountId, since: todayIso(), subtaskKey: createdKey });
      }
      await store.putEntry(parentKey, parentId, stripJiraOwnedFields({
        ...parentStored,
        contributors: existingContributors
      }), parentStored.version);
    }
  }

  // Sync the estimate and the end the user entered, and the assignee, to the new subtask, from any plan.
  log.record(createdKey, ['create'], { synced: true });
  await syncTaskToJira(createdKey, {
    ...(createdPut.ok ? { startDate: createdPut.entry.startDate as string } : {}),
    ...(effortHours !== undefined ? { effortHours } : {}),
    ...(payload.endDate ? { endDate: payload.endDate } : {}),
    resourceAccountId
  }, log, {}, { propertyEnd: createdPut.ok ? createdPut.entry.endDate as string : undefined });

  const plan = await getProjectPlan(projectKey, storage, new Date(), undefined, projectId, undefined, planId);
  const subtask = includeCreated(plan, (await store.loadEntries()).get(createdKey),
    { id: createdId, key: createdKey, summary, isSubtask: true, hierarchyLevel: -1, parentKey, effortHours: effortHours || 0, resourceAccountId });
  return { success: true, ok: true, jiraSync: log.report(), subtask, plan };
}

/**
 * Adds a subtask to a parent task, re-calculating the parent effort with optional buffer.
 */
export async function addSubtaskToTask(
  payload: {
    projectKey: string;
    projectId?: string;
    planId?: string;
    parentTaskId: string;
    subtask: { summary: string; estimateValue?: number; estimateUnit?: EstimateUnit };
    bufferType?: 'PERCENTAGE' | 'FIXED_HOURS' | 'NONE';
    bufferValue?: number;
  },
  storageProvider?: StorageProvider
): Promise<ProjectPlanState> {
  // A sub-task is a real Jira sub-task, created as the user (ADR-004, F-23); nothing is stored in the
  // plan. Only an estimate the user entered goes to Jira: there is no default (BL-3, INV-03).
  const { projectKey, projectId, parentTaskId, subtask } = payload;
  const parentId = await verifyIssueInProject(parentTaskId, projectKey, 'parentTaskId');
  await requireIssuePermissions([{ key: parentTaskId, id: parentId }], ['EDIT_ISSUES', 'CREATE_ISSUES']);
  const storage = resolveStorage(storageProvider);
  const planId = await writablePlanId(storage, projectKey, projectId, payload.planId);
  const summary = typeof subtask?.summary === 'string' ? subtask.summary.trim() : '';
  if (!summary || summary.length > 255) throw new ValidationError('subtask.summary', 'A sub-task needs a summary of at most 255 characters');
  let effortHours: number | undefined;
  if (subtask.estimateValue !== undefined && subtask.estimateValue !== null) {
    if (typeof subtask.estimateValue !== 'number' || !(subtask.estimateValue > 0) || subtask.estimateValue > 10000) {
      throw new ValidationError('subtask.estimateValue', 'The estimate must be a number above 0');
    }
    effortHours = PlannerEngine.normalizeEstimateToHours(subtask.estimateUnit || 'HOURS', subtask.estimateValue);
  }
  const log = new SyncLog();
  const created = await createJiraSubtask(projectKey, parentTaskId, summary, effortHours);
  if (!created.key) {
    log.record(parentTaskId, ['subtask'], { synced: false, error: `Jira did not create the sub-task: ${created.error}` });
    return Object.assign(await getProjectPlan(projectKey, storage, new Date(), undefined, projectId, undefined, planId),
      { ok: false, success: false, error: 'subtask_refused', message: `Jira did not create the sub-task: ${created.error}`, jiraSync: log.report() });
  }
  log.record(created.key, ['create'], { synced: true });
  const reconcile = [parentId, created.id].filter((id): id is string => !!id && /^\d+$/.test(id));
  return Object.assign(await getProjectPlan(projectKey, storage, new Date(), undefined, projectId, undefined, planId, reconcile),
    { ok: true, jiraSync: log.report(), createdKey: created.key, writtenIssueIds: reconcile });
}

/** Creates a Jira sub-task under a parent, as the user, trying the two usual type names. */
async function createJiraSubtask(projectKey: string, parentKey: string, summary: string, effortHours?: number): Promise<{ key?: string; id?: string; error?: string }> {
  const caller = getJiraCaller();
  let error = 'no sub-task issue type';
  for (const stType of ['Sub-task', 'Subtask']) {
    try {
      const fields: any = { project: { key: projectKey }, parent: { key: parentKey }, summary, issuetype: { name: stType } };
      if (effortHours) fields.timetracking = { originalEstimate: `${effortHours}h` };
      const res = await caller.requestJira(route`/rest/api/3/issue`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ fields }) });
      if (res && res.status === 201) {
        const data = await res.json();
        return { key: String(data.key), id: String(data.id) };
      }
      const errJson = await res.json().catch(() => ({}));
      error = errJson.errorMessages?.join(', ') || JSON.stringify(errJson.errors || {}) || `HTTP ${res?.status}`;
    } catch (err: any) {
      error = err?.message || 'Network error';
    }
  }
  return { error };
}

/**
 * Sub-tasks an earlier build stored only in the plan record (before ADR-004): the user creates them
 * in Jira or drops them, never silently (F-23). 'create' makes one Jira sub-task for each, with its
 * stored estimate; each one Jira creates leaves the record. 'drop' removes them from the record.
 */
export async function resolveLocalSubtasks(
  payload: { projectKey: string; projectId?: string; planId?: string; parentTaskId: string; action: 'create' | 'drop' },
  storageProvider?: StorageProvider
): Promise<any> {
  const { projectKey, projectId, parentTaskId, action } = payload;
  if (action !== 'create' && action !== 'drop') throw new ValidationError('action', 'action must be create or drop');
  const parentId = await verifyIssueInProject(parentTaskId, projectKey, 'parentTaskId');
  await requireIssuePermissions([{ key: parentTaskId, id: parentId }], action === 'create' ? ['EDIT_ISSUES', 'CREATE_ISSUES'] : ['EDIT_ISSUES']);
  const storage = resolveStorage(storageProvider);
  const planId = await writablePlanId(storage, projectKey, projectId, payload.planId);
  const store = openStore(storage, projectKey, projectId, planId);
  const stored = (await store.loadEntries()).get(parentTaskId);
  const local: SubtaskItem[] = (stored?.subtasks || []).filter((s: SubtaskItem) => !s.key);
  const log = new SyncLog();
  const left: SubtaskItem[] = [];
  const ids: string[] = [parentId].filter((id): id is string => !!id);
  if (action === 'create') {
    for (const s of local) {
      const created = await createJiraSubtask(projectKey, parentTaskId, s.summary, s.normalizedHours > 0 ? s.normalizedHours : undefined);
      if (created.key) { log.record(created.key, ['create'], { synced: true }); if (created.id) ids.push(created.id); }
      else { left.push(s); log.record(parentTaskId, ['subtask'], { synced: false, error: `Jira did not create "${s.summary}": ${created.error}` }); }
    }
  }
  if (stored) {
    const { issueKey: _k, issueId: _i, version, ...rest } = stored as any;
    const put = await store.putEntry(parentTaskId, parentId, stripJiraOwnedFields({ ...rest, subtasks: left }), version);
    if (!put.ok) return conflictResult(parentTaskId);
  }
  const reconcile = ids.filter(id => /^\d+$/.test(id));
  return Object.assign(await getProjectPlan(projectKey, storage, new Date(), undefined, projectId, undefined, planId, reconcile),
    { ok: left.length === 0, jiraSync: log.report(), writtenIssueIds: reconcile });
}

/**
 * Saves an inter-task fractional dependency.
 */
export async function saveTaskDependency(
  payload: { projectKey: string; projectId?: string; planId?: string; taskId: string; dependency: TaskDependency },
  storageProvider?: StorageProvider
): Promise<ProjectPlanState> {
  const { projectKey, projectId, taskId, dependency } = payload;
  validateDependencyPayload(dependency);
  const storage = resolveStorage(storageProvider);
  const planId = await writablePlanId(storage, projectKey, projectId, payload.planId);

  const live = await loadLive(projectKey);
  const plan = await getProjectPlan(projectKey, storage, new Date(), undefined, projectId, live, planId);
  const planKeys = new Set([...plan.tasks, ...(plan.backlogTasks || [])].map(t => t.key));
  if (!planKeys.has(dependency.predecessorKey)) {
    throw new ValidationError('dependency.predecessorKey', `${dependency.predecessorKey} is not in project ${projectKey}`);
  }
  const targetTask = plan.tasks.find(t => t.id === taskId || t.key === taskId) ||
    plan.backlogTasks?.find(t => t.id === taskId || t.key === taskId);
  if (!targetTask) {
    throw new Error(`Target task '${taskId}' not found in project plan`);
  }

  const validation = PlannerEngine.validateDependency(
    targetTask.key,
    dependency.predecessorKey,
    dependency.triggerPercent,
    plan.tasks
  );
  if (!validation.valid) {
    throw new Error(validation.error);
  }

  // Mirror dependency to a native Jira issue link (reused when it already exists)
  const mirror = await mirrorDependencyToJira(targetTask.key, dependency.predecessorKey);
  const log = new SyncLog();
  log.record(targetTask.key, ['issuelink'], { synced: mirror.linked, error: mirror.error || 'Jira did not create the link' });
  const keep = (targetTask.dependencies || []).find(d => d.predecessorKey === dependency.predecessorKey);
  const ownedLinkId = mirror.created ? mirror.linkId : (keep ? keep.jiraLinkId : undefined);

  const store = openStore(storage, projectKey, projectId, planId);
  const stored = (await store.loadEntries()).get(targetTask.key);
  // The new link replaces the active set; the others end (B-28).
  const next: TaskDependency = { predecessorId: dependency.predecessorKey, predecessorKey: dependency.predecessorKey,
    triggerPercent: dependency.triggerPercent, isTriggerSatisfied: false };
  if (ownedLinkId) next.jiraLinkId = ownedLinkId;
  const applied = applyLinkUpdate(targetTask.dependencies || [], stored?.endedLinks || [], next, todayIso());
  for (const gone of applied.removed) {
    if (gone.jiraLinkId) log.record(targetTask.key, ['issuelink'], { synced: await removeMirroredLink(gone.jiraLinkId), error: 'Jira did not delete the link' });
  }
  const put = await store.putEntry(targetTask.key, targetTask.id, stripJiraOwnedFields({
    ...(stored || {}),
    dependency: applied.dependencies[0],
    dependencies: applied.dependencies,
    endedLinks: applied.endedLinks
  }), stored ? stored.version : 0);
  if (!put.ok) return conflictResult(targetTask.key);

  return Object.assign(await getProjectPlan(projectKey, storage, new Date(), undefined, projectId, live, planId), { ok: true, jiraSync: log.report() });
}

/**
 * Saves column width configurations.
 */
export async function saveColumnWidths(
  payload: { projectKey: string; projectId?: string; planId?: string; columnWidths: ColumnWidthConfig },
  storageProvider?: StorageProvider
): Promise<{ success: boolean; ok: boolean; jiraSync: JiraSyncReport; columnWidths: ColumnWidthConfig }> {
  const { projectKey, projectId, columnWidths } = payload;
  validateColumnWidths(columnWidths as unknown as Record<string, unknown>);
  const storage = resolveStorage(storageProvider);
  const store = openStore(storage, projectKey, projectId, await writablePlanId(storage, projectKey, projectId, payload.planId));
  await store.saveSettings({ columnWidths });
  return { success: true, ok: true, jiraSync: noJiraWrites(), columnWidths };
}

/**
 * Saves hidden columns configuration.
 */
export async function saveHiddenColumns(
  payload: { projectKey: string; projectId?: string; planId?: string; hiddenColumns: string[] },
  storageProvider?: StorageProvider
): Promise<{ success: boolean; ok: boolean; jiraSync: JiraSyncReport; hiddenColumns: string[] }> {
  const { projectKey, projectId, hiddenColumns } = payload;
  validateHiddenColumns(hiddenColumns);
  const storage = resolveStorage(storageProvider);
  const store = openStore(storage, projectKey, projectId, await writablePlanId(storage, projectKey, projectId, payload.planId));
  const cols = Array.isArray(hiddenColumns) ? hiddenColumns : [];
  await store.saveSettings({ hiddenColumns: cols });
  return { success: true, ok: true, jiraSync: noJiraWrites(), hiddenColumns: cols };
}

/**
 * Saves a milestone marker.
 */
export async function saveProjectMilestone(
  payload: { projectKey: string; projectId?: string; planId?: string; milestone: ProjectMilestone },
  storageProvider?: StorageProvider
): Promise<{ success: boolean; ok: boolean; jiraSync: JiraSyncReport; milestones: ProjectMilestone[] }> {
  const { projectKey, projectId, milestone } = payload;
  validateMilestone(milestone as unknown as Record<string, unknown>);
  const storage = resolveStorage(storageProvider);
  const store = openStore(storage, projectKey, projectId, await writablePlanId(storage, projectKey, projectId, payload.planId));
  const current = (await store.getSettings()).milestones || DEFAULT_MILESTONES;
  const filtered = current.filter(m => m.id !== milestone.id).slice(-99);
  filtered.push(milestone);
  await store.saveSettings({ milestones: filtered });
  return { success: true, ok: true, jiraSync: noJiraWrites(), milestones: filtered };
}

/**
 * DEC-6 (adopted Option A): when a planner action changes the roll-up end of a parent, the parent's
 * Jira due date follows it, written as the user. A parent the user may not edit or schedule keeps
 * its due date, and the write is reported "not written" (the sub-task move itself stands).
 */
async function followParentDueDates(
  before: WbsTask[], moved: Map<string, { startDate?: string; endDate?: string }>, log: SyncLog, live: LiveData,
  reparent?: { key: string; parentKey?: string }
): Promise<void> {
  if (moved.size === 0 && !reparent) return;
  const shifted = before.map(t => {
    let n = moved.has(t.key) ? { ...t, ...moved.get(t.key) } : t;
    if (reparent && t.key === reparent.key) n = { ...n, parentKey: reparent.parentKey };
    return n;
  });
  const after = withRollUps(shifted);
  const parents = new Set<string>();
  for (const key of moved.keys()) for (const a of ancestorKeys(key, before)) if (!moved.has(a)) parents.add(a);
  if (reparent) for (const list of [before, shifted]) for (const a of ancestorKeys(reparent.key, list)) parents.add(a);
  const targets: Array<{ key: string; id?: string; endDate: string; was: WbsTask }> = [];
  for (const key of parents) {
    const was = before.find(t => t.key === key);
    const now = after.find(t => t.key === key);
    if (!was || !now || !now.datesFromChildren || !isIsoDate(now.endDate) || was.endDate === now.endDate) continue;
    if (String(was.jiraDueDate || '').slice(0, 10) === now.endDate) continue;
    targets.push({ key, id: was.id, endDate: now.endDate as string, was });
  }
  if (targets.length === 0) return;
  const denied = new Map((await deniedIssues(targets, ['EDIT_ISSUES', 'SCHEDULE_ISSUES'])).map(d => [d.key, d.missing]));
  for (const t of targets) {
    const change = describeJiraChanges(['duedate'], t.was, { endDate: t.endDate });
    const missing = denied.get(t.key);
    if (missing) {
      log.record(t.key, ['duedate'], { synced: false, error: `not written: you lack ${describeMissing(missing)} on this parent in Jira` }, change);
      continue;
    }
    applyAcceptedDueDate(live, t.key, { endDate: t.endDate }, await syncTaskToJira(t.key, { endDate: t.endDate }, log, t.was));
  }
}

/**
 * Cascades from the roots on a candidate plan (N-06 rule 2: a cascade into a parent moves its block)
 * and applies at most CASCADE_BATCH_LIMIT changes: permission check, record write with its version,
 * Jira due date and start. Every applied change is added to `moved`.
 */
async function cascadeAndApply(ctx: {
  candidate: WbsTask[]; all: WbsTask[]; roots: string[]; exclude: Set<string>; store: PlanStore; entries: Map<string, StoredEntry>;
  idByKey: Map<string, string | undefined>; activeWeeks: WeeklySprintColumn[]; log: SyncLog; live: LiveData;
  moved: Map<string, { startDate?: string; endDate?: string }>;
}): Promise<{ cascadeRemaining: string[]; notMoved: Set<string> }> {
  const { candidate, all, store, entries, idByKey, activeWeeks, log, live, moved } = ctx;
  const inputs = engineInputs(candidate);
  let efforts = inputs.efforts;
  const cascaded: Array<{ key: string; toStart: string; toEnd: string }> = [];
  const notMoved = new Set<string>();
  for (const root of ctx.roots) {
    const r = cascade(efforts, inputs.links, root, todayIso());
    reportCycle(r.cycle, log);
    efforts = r.efforts;
    const expanded = expandParentCascades(r.changes, all, todayIso(), ctx.exclude);
    reportEpicsNotMoved(expanded.epics, log);
    for (const c of expanded.changes) if (!cascaded.some(x => x.key === c.key)) cascaded.push(c);
  }
  const cascadeRemaining = cascaded.slice(CASCADE_BATCH_LIMIT).map(c => c.key);
  const now = cascaded.slice(0, CASCADE_BATCH_LIMIT);
  for (const d of await deniedIssues(now.map(c => ({ key: c.key, id: idByKey.get(c.key) })), ['EDIT_ISSUES', 'SCHEDULE_ISSUES'])) {
    notMoved.add(d.key);
    log.record(d.key, ['plan'], { synced: false, error: `not moved: you lack ${describeMissing(d.missing)} on this issue in Jira` });
  }
  for (const c of now) {
    if (notMoved.has(c.key)) continue;
    const cur = entries.get(c.key);
    const put = await store.putEntry(c.key, idByKey.get(c.key), stripJiraOwnedFields({ ...(cur || {}), startDate: c.toStart, endDate: c.toEnd, ...gridFor(activeWeeks, c.toStart, c.toEnd) }), cur?.version ?? 0);
    if (!put.ok) { notMoved.add(c.key); log.record(c.key, ['plan'], { synced: false, error: 'not moved: someone else changed it; move the task again' }); continue; }
    applyAcceptedDueDate(live, c.key, { startDate: c.toStart, endDate: c.toEnd },
      await syncTaskToJira(c.key, { startDate: c.toStart, endDate: c.toEnd }, log, all.find(t => t.key === c.key)));
    moved.set(c.key, { startDate: c.toStart, endDate: c.toEnd });
  }
  return { cascadeRemaining, notMoved };
}

/**
 * N-08, ADR-005: the hierarchy belongs to Jira; every change is a Jira write, so every plan shows it.
 * The rules Jira enforces are checked first, with Jira's rule as the plain reason.
 */
function hierarchyRefusal(task: WbsTask, target: WbsTask | undefined, all: WbsTask[]): string | null {
  const level = (t: WbsTask) => (t.isEpic ? 1 : (t.hierarchyLevel ?? 0));
  if (level(task) >= 1) return `${task.key} is an epic. An epic cannot move under another work item.`;
  if (!target) return null;
  if (target.key === task.key) return `${task.key} cannot be its own parent.`;
  if (ancestorKeys(target.key, all).includes(task.key)) return `${target.key} is below ${task.key}, so ${task.key} cannot move under it.`;
  if (target.isSubtask || level(target) === -1) return `${target.key} is a sub-task. A sub-task cannot have children in Jira.`;
  return null;
}

/** A link between the task and the new parent or one of its ancestors is a cycle through the roll-up (N-06 rule 6). */
function linkCycleWithParent(task: WbsTask, newParentKey: string, all: WbsTask[]): string | null {
  const chain = new Set([newParentKey, ...ancestorKeys(newParentKey, all)]);
  for (const d of task.dependencies || []) if (chain.has(d.predecessorKey)) return d.predecessorKey;
  for (const t of all) if (chain.has(t.key) && (t.dependencies || []).some(d => d.predecessorKey === task.key)) return t.key;
  return null;
}

/**
 * Changes the parent of a work item, through Jira's edit endpoint (proven on the development site):
 * R1, a task or story under another epic (or none); R2, a sub-task under another task or story.
 * A standard work item onto a standard work item is a type conversion (convertIssueType).
 */
export async function changeParent(
  payload: { projectKey: string; projectId?: string; planId?: string; taskId: string; newParentKey?: string | null; reconcileIds?: string[] },
  storageProvider?: StorageProvider
): Promise<any> {
  const { projectKey, projectId, taskId } = payload;
  assertIssueKey(taskId, 'taskId');
  const newParentKey = payload.newParentKey || null;
  if (newParentKey !== null) assertIssueKey(newParentKey, 'newParentKey');
  const storage = resolveStorage(storageProvider);
  const planId = await writablePlanId(storage, projectKey, projectId, payload.planId);
  const log = new SyncLog();
  const live = await loadLive(projectKey, reconcileIdsOf(payload.reconcileIds));
  const plan = await getProjectPlan(projectKey, storage, new Date(), undefined, projectId, live, planId);
  const all = [...plan.tasks, ...(plan.backlogTasks || [])];
  const task = all.find(t => t.key === taskId);
  if (!task) throw new ValidationError('taskId', `${taskId} is not in project ${projectKey}`);
  const target = newParentKey ? all.find(t => t.key === newParentKey) : undefined;
  if (newParentKey && !target) throw new ValidationError('newParentKey', `${newParentKey} is not in project ${projectKey}`);
  const refusal = hierarchyRefusal(task, target, all);
  if (refusal) throw new ValidationError('newParentKey', refusal);
  const isSub = task.isSubtask || task.hierarchyLevel === -1;
  const targetIsEpic = !!target && (target.isEpic || (target.hierarchyLevel ?? 0) >= 1);
  if (isSub && (!target || targetIsEpic)) {
    throw new ValidationError('newParentKey', `${task.key} is a sub-task: its parent must be a task or story. To make it a task, convert its type.`);
  }
  if (!isSub && target && !targetIsEpic) {
    throw new ValidationError('newParentKey', `Making ${task.key} a sub-task of ${target.key} changes its work type. Use the type conversion.`);
  }
  if ((task.parentKey || null) === newParentKey) throw new ValidationError('newParentKey', `${task.key} is already under ${newParentKey || 'no parent'}.`);
  if (newParentKey) {
    const linked = linkCycleWithParent(task, newParentKey, all);
    if (linked) throw new ValidationError('newParentKey', `${task.key} has a dependency with ${linked}, which would be its parent. Remove that link first.`);
  }
  // BL-2 step 2b: Edit issues on the moved issue.
  const denied = await deniedIssues([{ key: task.key, id: task.id }], ['EDIT_ISSUES']);
  if (denied.length) return forbiddenResult(`You cannot move ${task.key}: your Jira role lacks ${describeMissing(denied[0].missing)}.`);

  const oldParentKey = task.parentKey;
  let ok = false;
  let reason = 'Jira did not change the parent';
  try {
    const res = await getJiraCaller().requestJira(route`/rest/api/3/issue/${task.key}`, {
      method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ fields: { parent: newParentKey ? { key: newParentKey } : null } })
    });
    ok = !!res && (res.status === 204 || res.status === 200);
    if (!ok) {
      const body = await res.json().catch(() => ({}));
      reason = body?.errorMessages?.join(', ') || Object.values(body?.errors || {}).join(', ') || reason;
    }
  } catch (err: any) { reason = err?.message || reason; }
  log.record(task.key, ['parent'], ok ? { synced: true } : { synced: false, error: reason },
    [{ field: 'parent', from: oldParentKey || null, to: newParentKey }]);
  if (!ok) return Object.assign(plan, { ok: false, success: false, error: 'parent_refused', message: `${reason}.`, jiraSync: log.report() });

  // The record stays (keyed by issue id, proven on the development site). The old parent's contributor
  // entry for this sub-task is removed: under the new parent it is an ordinary sub-task.
  const store = openStore(storage, projectKey, projectId, planId);
  const entries = await store.loadEntries();
  if (isSub && oldParentKey) {
    const op = entries.get(oldParentKey);
    if (op?.contributors?.some((c: any) => c.subtaskKey === task.key)) {
      const { issueKey: _k, issueId: _i, version, ...rest } = op as any;
      await store.putEntry(oldParentKey, op.issueId, stripJiraOwnedFields({ ...rest, contributors: op.contributors.filter((c: any) => c.subtaskKey !== task.key) }), version);
    }
  }
  // The roll-ups of both parents change: DEC-6 for both, and their successors cascade (N-06 rule 1).
  live.raw = { ...live.raw, issues: (live.raw.issues || []).map((i: any) => (i && i.key === task.key
    ? { ...i, fields: { ...(i.fields || {}), parent: newParentKey ? { key: newParentKey, id: target!.id, fields: { summary: target!.summary } } : null } } : i)) };
  const candidate = withRollUps(all.map(t => (t.key === task.key ? { ...t, parentKey: newParentKey || undefined } : t)));
  const roots = [oldParentKey, newParentKey].filter((k): k is string => !!k);
  for (const r of [...roots]) roots.push(...ancestorKeys(r, candidate));
  const moved = new Map<string, { startDate?: string; endDate?: string }>();
  const { cascadeRemaining, notMoved } = await cascadeAndApply({ candidate, all, roots, exclude: new Set([task.key]), store, entries,
    idByKey: new Map(all.map(t => [t.key, t.id])), activeWeeks: plan.weeks || getDefaultWeeks(), log, live, moved });
  await followParentDueDates(all, moved, log, live, { key: task.key, parentKey: newParentKey || undefined });
  const ids = [task.id, all.find(t => t.key === oldParentKey)?.id, target?.id].filter((id): id is string => !!id && /^\d+$/.test(id));
  const out = Object.assign(await getProjectPlan(projectKey, storage, new Date(), undefined, projectId, live, planId, ids),
    { ok: true, jiraSync: log.report(), cascadeRemaining, cascadeSkipped: [...notMoved] });
  return Object.assign(out, { writtenIssueIds: [...new Set([...ids, ...writtenIssueIds(log, all)])].slice(0, 50) });
}

/** Whether the user holds a global Jira permission, as the user. Fails closed. */
async function hasGlobalPermission(permission: string): Promise<boolean> {
  try {
    const res = await getJiraCaller().requestJira(route`/rest/api/3/permissions/check`, {
      method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'application/json' }, body: JSON.stringify({ globalPermissions: [permission] })
    });
    if (!res || res.status !== 200) return false;
    const data = await res.json();
    return Array.isArray(data?.globalPermissions) && data.globalPermissions.includes(permission);
  } catch { return false; }
}

/**
 * Converts the work type through Jira's bulk move (proven on the development site): R3, a task or
 * story without sub-tasks becomes a sub-task of `toSubtaskOf`; R4, a sub-task becomes a standard work
 * item of `toTypeName` (default Task). Returns Jira's job id; checkConversion follows the job.
 */
export async function convertIssueType(
  payload: { projectKey: string; projectId?: string; planId?: string; taskId: string; toSubtaskOf?: string; toTypeName?: string },
  storageProvider?: StorageProvider
): Promise<any> {
  const { projectKey, projectId, taskId } = payload;
  assertIssueKey(taskId, 'taskId');
  if (payload.toSubtaskOf !== undefined) assertIssueKey(payload.toSubtaskOf, 'toSubtaskOf');
  if (payload.toTypeName !== undefined && (typeof payload.toTypeName !== 'string' || !/^[\w -]{1,60}$/.test(payload.toTypeName))) {
    throw new ValidationError('toTypeName', 'toTypeName must be a work type name');
  }
  const storage = resolveStorage(storageProvider);
  await writablePlanId(storage, projectKey, projectId, payload.planId);
  const plan = await getProjectPlan(projectKey, storage, new Date(), undefined, projectId, undefined, payload.planId);
  const all = [...plan.tasks, ...(plan.backlogTasks || [])];
  const task = all.find(t => t.key === taskId);
  if (!task) throw new ValidationError('taskId', `${taskId} is not in project ${projectKey}`);
  const isSub = task.isSubtask || task.hierarchyLevel === -1;
  const target = payload.toSubtaskOf ? all.find(t => t.key === payload.toSubtaskOf) : undefined;
  if (payload.toSubtaskOf) {
    if (isSub) throw new ValidationError('toSubtaskOf', `${task.key} is already a sub-task. Change its parent instead.`);
    if (!target) throw new ValidationError('toSubtaskOf', `${payload.toSubtaskOf} is not in project ${projectKey}`);
    const refusal = hierarchyRefusal(task, target, all);
    if (refusal) throw new ValidationError('toSubtaskOf', refusal);
    if (target.isEpic || (target.hierarchyLevel ?? 0) >= 1) throw new ValidationError('toSubtaskOf', `${target.key} is an epic. Change the parent of ${task.key} instead.`);
    if (all.some(t => t.parentKey === task.key)) throw new ValidationError('toSubtaskOf', `${task.key} has sub-tasks, so Jira cannot make it a sub-task.`);
    const linked = linkCycleWithParent(task, target.key, all);
    if (linked) throw new ValidationError('toSubtaskOf', `${task.key} has a dependency with ${linked}, which would be its parent. Remove that link first.`);
  } else if (!isSub) {
    throw new ValidationError('toSubtaskOf', `${task.key} is not a sub-task. Name the parent it should become a sub-task of.`);
  }
  // BL-2 step 2b: Edit, Move and Create issues in the project, and the global Make bulk changes.
  const denied = await deniedIssues([{ key: task.key, id: task.id }], ['EDIT_ISSUES', 'MOVE_ISSUES', 'CREATE_ISSUES']);
  if (denied.length) return forbiddenResult(`You cannot convert ${task.key}: your Jira role lacks ${describeMissing(denied[0].missing)}.`);
  if (!(await hasGlobalPermission('BULK_CHANGE'))) return forbiddenResult(`You cannot convert ${task.key}: Jira's "Make bulk changes" permission is needed, and you do not have it.`);

  const caller = getJiraCaller();
  const types = await caller.requestJira(route`/rest/api/3/issue/createmeta/${projectKey}/issuetypes`);
  const list: any[] = types && types.status === 200 ? ((await types.json())?.issueTypes || []) : [];
  const wantName = payload.toSubtaskOf ? undefined : (payload.toTypeName || 'Task');
  const type = payload.toSubtaskOf ? list.find(x => x.subtask) : list.find(x => !x.subtask && x.name === wantName);
  if (!type) throw new ValidationError('toTypeName', payload.toSubtaskOf ? `Project ${projectKey} has no sub-task work type.` : `Project ${projectKey} has no work type "${wantName}".`);
  const mapping = `${projectKey},${type.id}${payload.toSubtaskOf ? `,${payload.toSubtaskOf}` : ''}`;
  const res = await caller.requestJira(route`/rest/api/3/bulk/issues/move`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ sendBulkNotification: false, targetToSourcesMapping: { [mapping]: {
      inferClassificationDefaults: true, inferFieldDefaults: true, inferStatusDefaults: true, inferSubtaskTypeDefault: true, issueIdsOrKeys: [task.key] } } })
  });
  if (!res || (res.status !== 201 && res.status !== 200)) {
    const body = await res?.json().catch(() => ({}));
    const text = body?.errorMessages?.join(', ') || Object.values(body?.errors || {}).join(', ') || `Jira status ${res?.status}`;
    const busy = res?.status === 429 || /concurrent|already running|limit/i.test(text);
    return { ok: false, success: false, error: busy ? 'bulk_busy' : 'convert_refused', jiraSync: noJiraWrites(),
      message: busy ? 'Jira is already running the most bulk changes it allows on this site. Try again in a minute.' : `Jira did not convert ${task.key}: ${text}.` };
  }
  const job = await res.json();
  return { ok: true, jobId: String(job.taskId), taskId: task.key, oldParentKey: task.parentKey || null, newParentKey: payload.toSubtaskOf || null, jiraSync: noJiraWrites() };
}

/**
 * Follows a type conversion job. When Jira reports it complete, the parents' due dates follow their
 * new roll-ups (DEC-6) and the plan is returned with the converted issue read after the write.
 */
export async function checkConversion(
  payload: { projectKey: string; projectId?: string; planId?: string; jobId: string; taskId: string; oldParentKey?: string | null; newParentKey?: string | null },
  storageProvider?: StorageProvider
): Promise<any> {
  const { projectKey, projectId } = payload;
  if (typeof payload.jobId !== 'string' || !/^\d{1,20}$/.test(payload.jobId)) throw new ValidationError('jobId', 'jobId must be a Jira task id');
  assertIssueKey(payload.taskId, 'taskId');
  for (const k of [payload.oldParentKey, payload.newParentKey]) if (k) assertIssueKey(k, 'parentKey');
  const res = await getJiraCaller().requestJira(route`/rest/api/3/bulk/queue/${payload.jobId}`);
  if (!res || res.status !== 200) return { ok: false, done: false, error: 'job_unknown', message: 'Jira did not report on the conversion. Reload to see the work type.' };
  const job = await res.json();
  const status = String(job?.status || '');
  const failed = job?.failedAccessibleIssues && Object.keys(job.failedAccessibleIssues).length > 0;
  if (!['COMPLETE', 'FAILED', 'CANCELLED', 'DEAD'].includes(status)) return { ok: true, done: false, status, progress: job?.progressPercent ?? 0 };
  const log = new SyncLog();
  if (status !== 'COMPLETE' || failed) {
    const reason = failed ? Object.values(job.failedAccessibleIssues).flat().join(', ') : `the job ended as ${status}`;
    log.record(payload.taskId, ['type'], { synced: false, error: `Jira did not convert it: ${reason}` });
    return { ok: false, done: true, status, error: 'convert_failed', message: `Jira did not convert ${payload.taskId}: ${reason}.`, jiraSync: log.report() };
  }
  log.record(payload.taskId, ['type'], { synced: true }, [{ field: 'parent', from: payload.oldParentKey || null, to: payload.newParentKey || null }]);
  const storage = resolveStorage(storageProvider);
  const planId = await writablePlanId(storage, projectKey, projectId, payload.planId);
  const live = await loadLive(projectKey);
  const plan = await getProjectPlan(projectKey, storage, new Date(), undefined, projectId, live, planId);
  const all = [...plan.tasks, ...(plan.backlogTasks || [])];
  // DEC-6: each parent whose roll-up end now differs from its Jira due date gets that end.
  for (const key of [payload.oldParentKey, payload.newParentKey]) {
    const p = key ? all.find(t => t.key === key) : undefined;
    if (!p || !p.datesFromChildren || !isIsoDate(p.endDate) || String(p.jiraDueDate || '').slice(0, 10) === p.endDate) continue;
    const denied = await deniedIssues([{ key: p.key, id: p.id }], ['EDIT_ISSUES', 'SCHEDULE_ISSUES']);
    if (denied.length) { log.record(p.key, ['duedate'], { synced: false, error: `not written: you lack ${describeMissing(denied[0].missing)} on this parent in Jira` }); continue; }
    applyAcceptedDueDate(live, p.key, { endDate: p.endDate }, await syncTaskToJira(p.key, { endDate: p.endDate }, log, p));
  }
  const ids = [payload.taskId, payload.oldParentKey, payload.newParentKey].map(k => all.find(t => t.key === k)?.id).filter((id): id is string => !!id && /^\d+$/.test(id));
  return Object.assign(await getProjectPlan(projectKey, storage, new Date(), undefined, projectId, live, planId, ids),
    { ok: true, done: true, status, jiraSync: log.report(), writtenIssueIds: ids });
}

/** Sub-tasks whose Jira dates one call writes; a larger block continues in continueBlockMove calls. */
export const BLOCK_MOVE_LIMIT = 25;
/** A block larger than this is refused (checks and record writes of one call stay within its time). */
export const BLOCK_MOVE_HARD_LIMIT = 500;

/**
 * Moves a task or story and its sub-tasks as one block by `days` (ADR-003, N-05). Each sub-task
 * moves by its state (src/domain/block-move.ts). All or nothing: every sub-task that will change is
 * checked for the user's Jira permissions and its record version before any write, and when Jira
 * refuses a sub-task's due date, the sub-tasks already moved are put back. Then the parent's Jira
 * due date follows the new roll-up end (DEC-6), and successors outside the block are cascaded.
 */
export async function moveTaskGroup(
  payload: { projectKey: string; projectId?: string; planId?: string; taskId: string; days: number; expectedVersions?: Record<string, number>; reconcileIds?: string[] },
  storageProvider?: StorageProvider
): Promise<any> {
  const { projectKey, projectId, taskId, days } = payload;
  assertIssueKey(taskId, 'taskId');
  if (!Number.isInteger(days) || days === 0 || Math.abs(days) > 3660) throw new ValidationError('days', 'days must be a whole number of days, not 0, at most 3660 either way');
  const expected = payload.expectedVersions;
  if (expected !== undefined && (typeof expected !== 'object' || expected === null || Array.isArray(expected) ||
      Object.keys(expected).length > 100 || Object.entries(expected).some(([k, v]) => !/^[A-Z][A-Z0-9_]+-\d+$/.test(k) || !Number.isInteger(v) || (v as number) < 0))) {
    throw new ValidationError('expectedVersions', 'expectedVersions must map issue keys to whole numbers of at least 0');
  }
  const storage = new BatchStorage(resolveStorage(storageProvider));
  const planId = await writablePlanId(storage, projectKey, projectId, payload.planId);
  const log = new SyncLog();
  const live = await loadLive(projectKey, reconcileIdsOf(payload.reconcileIds));
  const plan = await getProjectPlan(projectKey, storage, new Date(), undefined, projectId, live, planId);
  const all = [...plan.tasks, ...(plan.backlogTasks || [])];
  const parent = all.find(t => t.key === taskId || t.id === taskId);
  if (!parent) throw new ValidationError('taskId', `${taskId} is not in project ${projectKey}`);
  // DEC-5b: epics keep "move a child instead" in v1.
  if (parent.isEpic || (parent.hierarchyLevel ?? 0) >= 1) throw new ValidationError('taskId', `${parent.key} is an epic. Move one of its work items instead.`);
  const members = all.filter(t => t.parentKey === parent.key);
  if (!parent.datesFromChildren || members.length === 0) throw new ValidationError('taskId', `${parent.key} has no dated sub-tasks. Move it directly.`);
  const { changes, fixed } = planBlockMove(members, days, todayIso());
  const block = { moved: changes, fixed };
  if (changes.length === 0) {
    return Object.assign(plan, { ok: true, jiraSync: log.report(), block, message: `Nothing in ${parent.key} can move: ${fixed.map(f => `${f.key} ${f.reason}`).join('; ')}.` });
  }
  if (changes.length > BLOCK_MOVE_HARD_LIMIT) {
    throw new ValidationError('taskId', `${parent.key} has ${changes.length} sub-tasks to move; at most ${BLOCK_MOVE_HARD_LIMIT} move as one block.`);
  }

  // All or nothing, before any write: permissions as the user, then every record version.
  const idByKey = new Map(all.map(t => [t.key, t.id]));
  const denied = await deniedIssues(changes.map(c => ({ key: c.key, id: idByKey.get(c.key) })), ['EDIT_ISSUES', 'SCHEDULE_ISSUES']);
  if (denied.length) {
    return forbiddenResult(`Nothing moved: you cannot change ${denied[0].key}, a sub-task of ${parent.key}: your Jira role lacks ${describeMissing(denied[0].missing)}.`);
  }
  const store = openStore(storage, projectKey, projectId, planId);
  const entries = await store.loadEntries();
  for (const c of changes) {
    const v = entries.get(c.key)?.version ?? 0;
    if (expected && expected[c.key] !== undefined && expected[c.key] !== v) return conflictResult(c.key);
  }
  const activeWeeks = plan.weeks || getDefaultWeeks();
  const written: Array<{ change: BlockChange; previous: Partial<WbsTask> | undefined; version: number }> = [];
  const putBack = async () => {
    for (const w of written.reverse()) {
      const { issueKey: _k, issueId: _i, version: _v, ...prev } = (w.previous || {}) as any;
      if (w.previous) await store.putEntry(w.change.key, idByKey.get(w.change.key), stripJiraOwnedFields(prev), w.version);
      else await store.deleteEntry(w.change.key);
    }
  };
  // Records of the first batch; a larger block continues in continueBlockMove calls.
  for (const c of changes.slice(0, BLOCK_MOVE_LIMIT)) {
    const cur = entries.get(c.key);
    const next = stripJiraOwnedFields({ ...(cur || {}), startDate: c.toStart, endDate: c.toEnd, ...gridFor(activeWeeks, c.toStart, c.toEnd) });
    const put = await store.putEntry(c.key, idByKey.get(c.key), next, cur?.version ?? 0);
    if (!put.ok) { await putBack(); return conflictResult(c.key); }
    written.push({ change: c, previous: cur, version: put.entry.version });
  }

  // Jira: each sub-task's due date and shared start, BLOCK_MOVE_LIMIT per call; a larger block continues
  // in later calls (continueBlockMove). A refusal in this first call puts every sub-task back.
  const synced: BlockChange[] = [];
  for (const c of changes.slice(0, BLOCK_MOVE_LIMIT)) {
    const before = all.find(t => t.key === c.key);
    const res: any = await syncTaskToJira(c.key, { startDate: c.toStart, endDate: c.toEnd }, log, before);
    applyAcceptedDueDate(live, c.key, { startDate: c.toStart, endDate: c.toEnd }, res);
    if (!(res.synced && res.fields.includes('duedate'))) {
      for (const s of synced) {
        applyAcceptedDueDate(live, s.key, { startDate: s.fromStart, endDate: s.fromEnd },
          await syncTaskToJira(s.key, { startDate: s.fromStart, endDate: s.fromEnd }, log, { startDate: s.toStart, endDate: s.toEnd, jiraDueDate: s.toEnd }));
      }
      await putBack();
      const reason = (res.reasons && res.reasons.duedate) || res.error || 'Jira did not save the due date';
      return Object.assign(await getProjectPlan(projectKey, storage, new Date(), undefined, projectId, live, planId), {
        ok: false, success: false, error: 'due_date_refused', jiraSync: log.report(), block,
        message: `${reason} for ${c.key}, so nothing in ${parent.key} moved.`
      });
    }
    synced.push(c);
  }
  if (changes.length > BLOCK_MOVE_LIMIT) {
    // The rest follow in continueBlockMove calls, each checked against the dates it moves from.
    const rest = changes.slice(BLOCK_MOVE_LIMIT).map(c => ({ key: c.key, fromStart: c.fromStart, fromEnd: c.fromEnd, toStart: c.toStart, toEnd: c.toEnd }));
    const out = Object.assign(await getProjectPlan(projectKey, storage, new Date(), undefined, projectId, live, planId),
      { ok: true, jiraSync: log.report(), block, blockRemaining: rest });
    return Object.assign(out, { writtenIssueIds: writtenIssueIds(log, out.tasks.concat(out.backlogTasks || [])) });
  }

  // DEC-6 and the cascade, from the parent and from each moved sub-task, outside the block.
  const moved = new Map(changes.map(c => [c.key, { startDate: c.toStart, endDate: c.toEnd }]));
  const blockKeys = new Set([parent.key, ...members.map(m => m.key)]);
  const candidate = withRollUps(all.map(t => (moved.has(t.key) ? { ...t, ...moved.get(t.key) } : t)));
  const roots = [parent.key, ...changes.map(c => c.key), ...ancestorKeys(parent.key, all)];
  const { cascadeRemaining, notMoved } = await cascadeAndApply({ candidate, all, roots, exclude: blockKeys, store, entries, idByKey, activeWeeks, log, live, moved });
  await followParentDueDates(all, moved, log, live);

  const result = { ok: true, jiraSync: log.report(), block, cascadeRemaining, cascadeSkipped: [...notMoved] };
  const out = Object.assign(await getProjectPlan(projectKey, storage, new Date(), undefined, projectId, live, planId), result);
  return Object.assign(out, { writtenIssueIds: writtenIssueIds(log, out.tasks.concat(out.backlogTasks || [])) });
}

/**
 * Continues a block move of more than BLOCK_MOVE_LIMIT sub-tasks (moveTaskGroup returns the rest in
 * `blockRemaining`). Each item moves only when the sub-task still has the dates it moves from; its record
 * and its Jira due date and start are written, and a refused due date leaves it as it was. With `last`,
 * the cascade from the block and DEC-6 for the parent follow.
 */
export async function continueBlockMove(
  payload: { projectKey: string; projectId?: string; planId?: string; taskId: string; items: Array<{ key: string; fromStart: string; fromEnd: string; toStart: string; toEnd: string }>; last?: boolean; reconcileIds?: string[] },
  storageProvider?: StorageProvider
): Promise<any> {
  const { projectKey, projectId, taskId } = payload;
  assertIssueKey(taskId, 'taskId');
  const items = payload.items;
  if (!Array.isArray(items) || items.length > BLOCK_MOVE_LIMIT) throw new ValidationError('items', `items must be a list of at most ${BLOCK_MOVE_LIMIT} sub-tasks`);
  for (const it of items) {
    if (!it || typeof it !== 'object') throw new ValidationError('items', 'each item must be an object');
    assertIssueKey(it.key, 'items.key');
    for (const f of ['fromStart', 'fromEnd', 'toStart', 'toEnd'] as const) if (!isIsoDate(it[f])) throw new ValidationError(`items.${f}`, `${f} must be a date in YYYY-MM-DD form`);
    if (it.toEnd < it.toStart) throw new ValidationError('items.toEnd', 'The end must be on or after the start.');
  }
  if (payload.last !== undefined && typeof payload.last !== 'boolean') throw new ValidationError('last', 'last must be true or false');
  const storage = new BatchStorage(resolveStorage(storageProvider));
  const planId = await writablePlanId(storage, projectKey, projectId, payload.planId);
  const log = new SyncLog();
  const live = await loadLive(projectKey, reconcileIdsOf(payload.reconcileIds));
  const plan = await getProjectPlan(projectKey, storage, new Date(), undefined, projectId, live, planId);
  const all = [...plan.tasks, ...(plan.backlogTasks || [])];
  const parent = all.find(t => t.key === taskId);
  if (!parent) throw new ValidationError('taskId', `${taskId} is not in project ${projectKey}`);
  const members = all.filter(t => t.parentKey === parent.key);
  const strangers = items.filter(it => !members.some(m => m.key === it.key)).map(it => it.key);
  if (strangers.length) throw new ValidationError('items', `${strangers.join(', ')} ${strangers.length === 1 ? 'is not a sub-task' : 'are not sub-tasks'} of ${parent.key}`);
  const denied = new Map((await deniedIssues(items.map(it => ({ key: it.key, id: members.find(m => m.key === it.key)?.id })), ['EDIT_ISSUES', 'SCHEDULE_ISSUES'])).map(d => [d.key, d.missing]));
  const store = openStore(storage, projectKey, projectId, planId);
  const entries = await store.loadEntries();
  const activeWeeks = plan.weeks || getDefaultWeeks();
  const moved = new Map<string, { startDate?: string; endDate?: string }>();
  for (const it of items) {
    const shown = members.find(m => m.key === it.key)!;
    const missing = denied.get(it.key);
    if (missing) { log.record(it.key, ['plan'], { synced: false, error: `not moved: you lack ${describeMissing(missing)} on this issue in Jira` }); continue; }
    if (shown.startDate !== it.fromStart || shown.endDate !== it.fromEnd) {
      if (shown.startDate !== it.toStart || shown.endDate !== it.toEnd) log.record(it.key, ['plan'], { synced: false, error: 'not moved: someone else changed it; move the block again' });
      continue;
    }
    const cur = entries.get(it.key);
    const put = await store.putEntry(it.key, shown.id, stripJiraOwnedFields({ ...(cur || {}), startDate: it.toStart, endDate: it.toEnd, ...gridFor(activeWeeks, it.toStart, it.toEnd) }), cur?.version ?? 0);
    if (!put.ok) { log.record(it.key, ['plan'], { synced: false, error: 'not moved: someone else changed it; move the block again' }); continue; }
    const res: any = await syncTaskToJira(it.key, { startDate: it.toStart, endDate: it.toEnd }, log, shown);
    applyAcceptedDueDate(live, it.key, { startDate: it.toStart, endDate: it.toEnd }, res);
    if (res.synced && res.fields.includes('duedate')) { moved.set(it.key, { startDate: it.toStart, endDate: it.toEnd }); continue; }
    // Refused: this sub-task keeps its dates.
    const { issueKey: _k, issueId: _i, version, ...back } = put.entry as any;
    await store.putEntry(it.key, shown.id, stripJiraOwnedFields({ ...back, startDate: it.fromStart, endDate: it.fromEnd, ...gridFor(activeWeeks, it.fromStart, it.fromEnd) }), version);
  }
  let cascadeRemaining: string[] = [];
  let notMoved = new Set<string>();
  if (payload.last) {
    // The whole block is in Jira now: the cascade from it, then DEC-6 for the parent.
    const after = withRollUps(all.map(t => (moved.has(t.key) ? { ...t, ...moved.get(t.key) } : t)));
    const blockKeys = new Set([parent.key, ...members.map(m => m.key)]);
    const roots = [parent.key, ...members.map(m => m.key), ...ancestorKeys(parent.key, all)];
    ({ cascadeRemaining, notMoved } = await cascadeAndApply({ candidate: after, all, roots, exclude: blockKeys, store, entries,
      idByKey: new Map(all.map(t => [t.key, t.id])), activeWeeks, log, live, moved }));
    const rolled = after.find(t => t.key === parent.key);
    if (rolled && rolled.datesFromChildren && isIsoDate(rolled.endDate) && String(parent.jiraDueDate || '').slice(0, 10) !== rolled.endDate) {
      const d = await deniedIssues([{ key: parent.key, id: parent.id }], ['EDIT_ISSUES', 'SCHEDULE_ISSUES']);
      if (d.length) log.record(parent.key, ['duedate'], { synced: false, error: `not written: you lack ${describeMissing(d[0].missing)} on this parent in Jira` });
      else applyAcceptedDueDate(live, parent.key, { endDate: rolled.endDate }, await syncTaskToJira(parent.key, { endDate: rolled.endDate }, log, parent));
    }
  }
  const out = Object.assign(await getProjectPlan(projectKey, storage, new Date(), undefined, projectId, live, planId),
    { ok: true, jiraSync: log.report(), cascadeRemaining, cascadeSkipped: [...notMoved] });
  return Object.assign(out, { writtenIssueIds: writtenIssueIds(log, out.tasks.concat(out.backlogTasks || [])) });
}

/**
 * Retrieves the available named plans for a project (UX-05).
 */
export async function getProjectPlans(
  payload: { projectKey: string; projectId?: string; planId?: string },
  storageProvider?: StorageProvider
): Promise<{ ok: boolean; plans: PlanMetadata[]; activePlanId: string }> {
  const storage = resolveStorage(storageProvider);
  const store = openStore(storage, payload.projectKey, payload.projectId, payload.planId);
  const plans = await store.listPlans();
  return { ok: true, plans, activePlanId: payload.planId || 'default' };
}

/**
 * Creates a new named plan, optionally cloning tasks and settings from an existing plan (UX-05).
 * A clone copies its first page of records here; the client calls continuePlanCopy until `done`
 * (N-02). The new plan is listed as 'copying' until then.
 */
export async function createProjectPlan(
  payload: { projectKey: string; projectId?: string; name: string; cloneFromPlanId?: string },
  storageProvider?: StorageProvider
): Promise<{ ok: boolean; plan: PlanMetadata; plans: PlanMetadata[]; done?: boolean; remaining?: number; error?: string; message?: string }> {
  try {
    const trimmed = validatePlanName(payload.name);
    validatePlanId(payload.cloneFromPlanId);
    const storage = resolveStorage(storageProvider);
    const store = openStore(storage, payload.projectKey, payload.projectId);
    if (payload.cloneFromPlanId && !isMainPlan(payload.cloneFromPlanId)) {
      const source = (await store.listPlans()).find(p => p.id === payload.cloneFromPlanId);
      if (!source || source.state) throw new ValidationError('cloneFromPlanId', 'That plan cannot be copied now. Reload to see the current plans.');
    }
    const plan = await store.createPlan(trimmed, payload.cloneFromPlanId);
    const page = plan.state === 'copying' ? await store.copyPlanPage(plan.id) : { ok: true, done: true, remaining: 0 };
    const plans = await store.listPlans();
    return { ok: true, plan: plans.find(p => p.id === plan.id) || plan, plans, done: page.done, remaining: page.remaining };
  } catch (err: any) {
    return { ok: false, plan: undefined as any, plans: [], error: 'validation', message: err?.message || 'Invalid plan name' };
  }
}

/** Copies the next page of records of a plan that is still being cloned (N-02). */
export async function continuePlanCopy(
  payload: { projectKey: string; projectId?: string; planId: string },
  storageProvider?: StorageProvider
): Promise<{ ok: boolean; done: boolean; remaining: number; plans: PlanMetadata[]; message?: string }> {
  validatePlanId(payload.planId);
  const store = openStore(resolveStorage(storageProvider), payload.projectKey, payload.projectId);
  const page = await store.copyPlanPage(payload.planId);
  const plans = await store.listPlans();
  return { ...page, plans, ...(page.ok ? {} : { message: 'This plan is not being copied. Reload to see the current plans.' }) };
}

/**
 * Deletes a named plan (UX-05). The default plan cannot be deleted. The plan is marked 'deleting'
 * and its first page of records is removed here; the client calls continuePlanDelete until `done`
 * (N-02). It leaves the list with its last record, so a stopped delete can always be finished.
 */
export async function deleteProjectPlan(
  payload: { projectKey: string; projectId?: string; planId: string },
  storageProvider?: StorageProvider
): Promise<{ ok: boolean; plans: PlanMetadata[]; done?: boolean; remaining?: number; error?: string; message?: string }> {
  if (!payload.planId || payload.planId === 'default') {
    return { ok: false, plans: [], error: 'cannot_delete_default', message: 'Cannot delete the default plan' };
  }
  validatePlanId(payload.planId);
  const storage = resolveStorage(storageProvider);
  const store = openStore(storage, payload.projectKey, payload.projectId);
  try {
    const marked = await store.deletePlan(payload.planId);
    const already = (await store.listPlans()).find(p => p.id === payload.planId)?.state === 'deleting';
    if (!marked && !already) return { ok: false, plans: await store.listPlans(), message: 'This plan no longer exists. Reload to see the current plans.' };
    const page = await store.deletePlanPage(payload.planId);
    return { ok: true, plans: await store.listPlans(), done: page.done, remaining: page.remaining };
  } catch (err: any) {
    return { ok: false, plans: [], error: 'busy', message: err?.message || 'The plan could not be deleted. Try again.' };
  }
}

/** Deletes the next page of records of a plan that is being deleted (N-02). */
export async function continuePlanDelete(
  payload: { projectKey: string; projectId?: string; planId: string },
  storageProvider?: StorageProvider
): Promise<{ ok: boolean; done: boolean; remaining: number; plans: PlanMetadata[] }> {
  validatePlanId(payload.planId);
  const store = openStore(resolveStorage(storageProvider), payload.projectKey, payload.projectId);
  const page = await store.deletePlanPage(payload.planId);
  return { ...page, plans: await store.listPlans() };
}

/**
 * Renames an existing plan (UX-05).
 */
export async function renameProjectPlan(
  payload: { projectKey: string; projectId?: string; planId: string; name: string },
  storageProvider?: StorageProvider
): Promise<{ ok: boolean; plan?: PlanMetadata | null; plans: PlanMetadata[]; error?: string; message?: string }> {
  try {
    const trimmed = validatePlanName(payload.name);
    validatePlanId(payload.planId);
    const storage = resolveStorage(storageProvider);
    const store = openStore(storage, payload.projectKey, payload.projectId);
    const plan = await store.renamePlan(payload.planId, trimmed);
    const plans = await store.listPlans();
    return { ok: !!plan, plan, plans };
  } catch (err: any) {
    return { ok: false, plans: [], error: 'validation', message: err?.message || 'Invalid plan name' };
  }
}


/**
 * Helper to extract projectKey from trusted Jira Forge context first, with payload fallback.
 */
export function extractProjectKey(req: any): string {
  // The project comes only from the Forge context of a project page, never from the payload (N-01).
  const contextKey = req?.context?.extension?.project?.key;
  if (contextKey && typeof contextKey === 'string' && contextKey.trim().length > 0) {
    return contextKey.trim();
  }
  throw new ValidationError('project', 'CascadePlan works only from a Jira project page.');
}

/**
 * Project id from the trusted Forge context; records are keyed by it (B-09).
 */
export function extractProjectId(req: any): string {
  const id = req?.context?.extension?.project?.id;
  if (id !== undefined && id !== null && String(id).trim().length > 0) return String(id);
  // Records are keyed by the project id; a call without it is refused, so nothing lands under a key (N-01, FX-04).
  throw new ValidationError('project', 'CascadePlan works only from a Jira project page.');
}

export function extractSiteUrl(req: any): string | undefined {
  const contextUrl = req?.context?.siteUrl;
  if (contextUrl && typeof contextUrl === 'string' && contextUrl.trim().length > 0) {
    return contextUrl.trim();
  }
  return undefined;
}

/**
 * Checks whether the request comes from an active licensed installation (B-21).
 * When licensing is enabled, Forge provides context.license with active/isActive.
 * If context.license is missing (free apps, dev/test environments), access is permitted.
 */
export function isLicenseActive(context: any): boolean {
  if (!context || !context.license) return true;
  const lic = context.license;
  if (lic.isActive === false || lic.active === false) return false;
  return true;
}

export function licenceRequiredResult(): { ok: false; success: false; error: 'license_required'; message: string } {
  return {
    ok: false,
    success: false,
    error: 'license_required',
    message: 'Licence required'
  };
}

/**
 * Runs a resolver function with licensing check and validation mapping (B-21).
 */
export async function withResolverHandler<T>(req: any, fn: () => Promise<T>): Promise<T | ReturnType<typeof licenceRequiredResult> | ReturnType<typeof toValidationResult>> {
  if (!isLicenseActive(req?.context)) {
    return licenceRequiredResult();
  }
  return withOk(await withValidation(fn));
}

/**
 * Every resolver result carries a boolean ok, so the client tests one field (F-13, INV-05). A result
 * that has none takes it from success, and is ok when success is not false.
 */
export function withOk<T>(result: T): T {
  if (result && typeof result === 'object' && typeof (result as any).ok !== 'boolean') {
    (result as any).ok = (result as any).success !== false;
  }
  return result;
}

// ---- Baselines, scope changes and their records (ADR-009, DEC-1 Option B) ----

function baselineStore(storage: StorageProvider, projectKey: string, projectId: string | undefined, planId: string | undefined): BaselineStore {
  return new BaselineStore(storage, projectId || projectKey, planId && planId !== 'default' ? planId : 'default');
}

function cleanText(field: string, v: unknown, max: number, required: boolean): string {
  const s = typeof v === 'string' ? v.trim() : '';
  if ((required && !s) || s.length > max) throw new ValidationError(field, `${field} must be text of ${required ? '1' : '0'} to ${max} characters`);
  return s;
}

/** Names of account ids, read live from the Jira users of the project (never stored, ADR-009). */
function nameOf(users: Array<{ accountId: string; displayName: string }>, accountId: string | null | undefined): string {
  if (!accountId) return 'a deleted user';
  return users.find(u => u.accountId === accountId)?.displayName || 'a Jira user';
}

/** The active baseline against a plan already loaded: no Jira call; a failure never breaks the load. */
export async function baselineStatusFor(storage: StorageProvider, projectKey: string, projectId: string | undefined, plan: ProjectPlanState): Promise<any> {
  try {
    const store = baselineStore(storage, projectKey, projectId, plan.planId);
    const active = (await store.readIndex()).active;
    const b = active ? await store.load(active) : undefined;
    if (!b) return { ok: false };
    // The items go to the browser, which compares them with the plan after every change (no extra call).
    return { ok: true, baseline: b.header, intact: b.intact, items: b.items };
  } catch (err) {
    logFailure('baselineStatusFor', err);
    return { ok: false };
  }
}

/** Freezes the scope of a plan as a new baseline, which becomes active. Plan approvers only. */
export async function freezePlanBaseline(
  payload: { projectKey: string; projectId?: string; planId?: string; name: string },
  storageProvider?: StorageProvider,
  context?: any
): Promise<any> {
  const storage = resolveStorage(storageProvider);
  const planId = await writablePlanId(storage, payload.projectKey, payload.projectId, payload.planId);
  const name = cleanText('name', payload.name, 80, true);
  const plan = await getProjectPlan(payload.projectKey, storage, new Date(), undefined, payload.projectId, undefined, planId);
  const items = baselineItems(plan.tasks);
  if (items.length === 0) return { ok: false, success: false, error: 'empty', message: 'Nothing is on the timeline of this plan, so there is nothing to freeze.' };
  const store = baselineStore(storage, payload.projectKey, payload.projectId, planId);
  const header = await store.save({ id: `bl-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`, name,
    frozenAt: new Date().toISOString(), frozenBy: context?.accountId || null, items });
  return { ok: true, success: true, baseline: header };
}

/** The baselines of a plan (versions), the active one checked for integrity, and the scope-change requests. */
export async function getPlanBaselines(
  payload: { projectKey: string; projectId?: string; planId?: string },
  storageProvider?: StorageProvider
): Promise<any> {
  const storage = resolveStorage(storageProvider);
  validatePlanId(payload.planId);
  const store = baselineStore(storage, payload.projectKey, payload.projectId, payload.planId);
  const { active, headers } = await store.list();
  const users = (await loadLive(payload.projectKey)).users || [];
  const loaded = active ? await store.load(active) : undefined;
  const shifts = (await store.shifts()).map(s => ({ ...s, requestedByName: nameOf(users, s.requestedBy),
    ...(s.status !== 'PENDING' ? { reviewedByName: nameOf(users, s.reviewedBy) } : {}) }));
  return { ok: true, success: true, active: active || null, activeIntact: loaded ? loaded.intact : null,
    baselines: headers.map(h => ({ ...h, frozenByName: nameOf(users, h.frozenBy) })).reverse(), shifts };
}

/** Item details for display: the summary of each key, read live from the current plan. */
function summariesOf(plan: ProjectPlanState): Record<string, string> {
  const out: Record<string, string> = {};
  for (const t of [...plan.tasks, ...(plan.backlogTasks || [])]) out[t.key] = t.summary;
  return out;
}

/** The scope delta: a baseline (the active one by default) against the current plan. */
export async function getScopeCreepReport(
  payload: { projectKey: string; projectId?: string; planId?: string; baselineId?: string },
  storageProvider?: StorageProvider
): Promise<any> {
  const storage = resolveStorage(storageProvider);
  validatePlanId(payload.planId);
  const store = baselineStore(storage, payload.projectKey, payload.projectId, payload.planId);
  const id = payload.baselineId ? cleanText('baselineId', payload.baselineId, 64, true) : (await store.readIndex()).active;
  if (!id) return { ok: false, success: false, error: 'no_baseline', message: 'This plan has no baseline yet. A plan approver can freeze one.' };
  const b = await store.load(id);
  if (!b) return { ok: false, success: false, error: 'no_baseline', message: 'That baseline no longer exists.' };
  const plan = await getProjectPlan(payload.projectKey, storage, new Date(), undefined, payload.projectId, undefined, payload.planId);
  return { ok: true, success: true, baseline: b.header, intact: b.intact, comparison: compareItems(b.items, baselineItems(plan.tasks)), summaries: summariesOf(plan) };
}

/** Two baseline versions compared. */
export async function compareBaselines(
  payload: { projectKey: string; projectId?: string; planId?: string; fromId: string; toId: string },
  storageProvider?: StorageProvider
): Promise<any> {
  const storage = resolveStorage(storageProvider);
  validatePlanId(payload.planId);
  const store = baselineStore(storage, payload.projectKey, payload.projectId, payload.planId);
  const a = await store.load(cleanText('fromId', payload.fromId, 64, true));
  const b = await store.load(cleanText('toId', payload.toId, 64, true));
  if (!a || !b) return { ok: false, success: false, error: 'no_baseline', message: 'One of the two baselines no longer exists.' };
  const plan = await getProjectPlan(payload.projectKey, storage, new Date(), undefined, payload.projectId, undefined, payload.planId);
  return { ok: true, success: true, from: a.header, to: b.header, intact: a.intact && b.intact, comparison: compareItems(a.items, b.items), summaries: summariesOf(plan) };
}

/** A baseline as CSV and JSON, with its digest and whether it is still intact. */
export async function exportBaseline(
  payload: { projectKey: string; projectId?: string; planId?: string; baselineId: string },
  storageProvider?: StorageProvider
): Promise<any> {
  const storage = resolveStorage(storageProvider);
  validatePlanId(payload.planId);
  const b = await baselineStore(storage, payload.projectKey, payload.projectId, payload.planId).load(cleanText('baselineId', payload.baselineId, 64, true));
  if (!b) return { ok: false, success: false, error: 'no_baseline', message: 'That baseline no longer exists.' };
  return { ok: true, success: true, header: b.header, intact: b.intact, items: b.items, csv: baselineCsv(b) };
}

/** Makes an earlier baseline version the active one. Plan approvers only. */
export async function setActiveBaseline(
  payload: { projectKey: string; projectId?: string; planId?: string; baselineId: string },
  storageProvider?: StorageProvider
): Promise<any> {
  const storage = resolveStorage(storageProvider);
  const planId = await writablePlanId(storage, payload.projectKey, payload.projectId, payload.planId);
  const ok = await baselineStore(storage, payload.projectKey, payload.projectId, planId).setActive(cleanText('baselineId', payload.baselineId, 64, true));
  return ok ? { ok: true, success: true } : { ok: false, success: false, error: 'no_baseline', message: 'That baseline no longer exists.' };
}

/** Any project user asks a plan approver to accept the current scope against the active baseline. */
export async function requestScopeShift(
  payload: { projectKey: string; projectId?: string; planId?: string; reason: string },
  storageProvider?: StorageProvider,
  context?: any
): Promise<any> {
  const storage = resolveStorage(storageProvider);
  const planId = await writablePlanId(storage, payload.projectKey, payload.projectId, payload.planId);
  const reason = cleanText('reason', payload.reason, 1000, true);
  const store = baselineStore(storage, payload.projectKey, payload.projectId, planId);
  const active = (await store.readIndex()).active;
  const b = active ? await store.load(active) : undefined;
  if (!b) return { ok: false, success: false, error: 'no_baseline', message: 'This plan has no active baseline to change.' };
  const plan = await getProjectPlan(payload.projectKey, storage, new Date(), undefined, payload.projectId, undefined, planId);
  const c = compareItems(b.items, baselineItems(plan.tasks));
  if (!c.added.length && !c.removed.length && !c.changed.length) return { ok: false, success: false, error: 'no_change', message: 'The plan matches its baseline, so there is no scope change to request.' };
  const request: ShiftRequest = { id: `shift-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`, planId: planId || 'default',
    baselineId: b.header.id, requestedBy: context?.accountId || null, requestedAt: new Date().toISOString(), reason, status: 'PENDING',
    summary: { added: c.added.length, removed: c.removed.length, changed: c.changed.length, deltaHours: c.deltaHours }, v: 1 };
  await store.saveShift(request);
  return { ok: true, success: true, request };
}

/**
 * A plan approver accepts or rejects a scope-change request, once, and never their own. Accepting
 * freezes a new baseline version from the current plan, which supersedes the old one and is active.
 */
export async function reviewScopeShift(
  payload: { projectKey: string; projectId?: string; planId?: string; shiftId: string; status: 'APPROVED' | 'REJECTED'; comment?: string },
  storageProvider?: StorageProvider,
  context?: any
): Promise<any> {
  const storage = resolveStorage(storageProvider);
  const planId = await writablePlanId(storage, payload.projectKey, payload.projectId, payload.planId);
  if (payload.status !== 'APPROVED' && payload.status !== 'REJECTED') return { ok: false, success: false, error: 'The review must be APPROVED or REJECTED.' };
  const comment = cleanText('comment', payload.comment ?? '', 1000, false);
  const store = baselineStore(storage, payload.projectKey, payload.projectId, planId);
  const target = await store.shift(cleanText('shiftId', payload.shiftId, 64, true));
  if (!target) return { ok: false, success: false, error: 'Shift request not found' };
  if (target.status !== 'PENDING') return { ok: false, success: false, error: 'This request has already been reviewed.' };
  const accountId = context?.accountId;
  if (!accountId) return { ok: false, success: false, error: 'The reviewer could not be identified.' };
  if (accountId === target.requestedBy) return { ok: false, success: false, error: 'A request cannot be approved or rejected by the person who made it.' };
  const reviewed: ShiftRequest = { ...target, status: payload.status, reviewedBy: accountId, reviewedAt: new Date().toISOString(), ...(comment ? { comment } : {}) };
  if (payload.status === 'APPROVED') {
    const plan = await getProjectPlan(payload.projectKey, storage, new Date(), undefined, payload.projectId, undefined, planId);
    const old = await store.header(target.baselineId);
    const versions = (await store.readIndex()).ids.length;
    const header = await store.save({ id: `bl-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
      name: `${(old?.name || 'Baseline').replace(/ \(version \d+\)$/, '')} (version ${versions + 1})`, frozenAt: reviewed.reviewedAt!,
      frozenBy: accountId, items: baselineItems(plan.tasks), supersedes: target.baselineId });
    reviewed.newBaselineId = header.id;
  }
  await store.saveShift(reviewed);
  return { ok: true, success: true, request: reviewed };
}

/**
 * Weekly scheduled trigger (ADR-009 decision 7, DEC-2, BL-5): reports every account id stored as an
 * audit subject with Forge's personal data reporting API, and makes the records of closed accounts
 * name no one.
 */
export async function reportPersonalData(storageProvider?: StorageProvider, report?: (a: Array<{ accountId: string; updatedAt: string }>) => Promise<Array<{ accountId: string; status: string }>>): Promise<{ reported: number; closed: string[] }> {
  const storage = resolveStorage(storageProvider);
  const idx = (await storage.get<Record<string, { keys: string[]; updatedAt: string }>>(ACCOUNTS_KEY)) || {};
  const accounts = Object.entries(idx).map(([accountId, v]) => ({ accountId, updatedAt: v.updatedAt }));
  if (accounts.length === 0) return { reported: 0, closed: [] };
  const updates = await (report || privacy.reportPersonalData)(accounts);
  const closed = await eraseClosedAccounts(storage, updates.filter(u => u.status === 'closed').map(u => u.accountId));
  return { reported: accounts.length, closed };
}

export const personalDataTrigger = async (): Promise<void> => {
  try {
    const r = await reportPersonalData();
    // eslint-disable-next-line no-console
    console.log(`personal data report: ${r.reported} account(s) reported, ${r.closed.length} closed and erased`);
  } catch (err) { logFailure('reportPersonalData', err); }
};

export async function getResourceUtilizationGrid(
  payload: { projectKey: string; projectId?: string; planId?: string; weeklyCapacityHours?: number },
  storageProvider?: StorageProvider
): Promise<{ success: boolean; utilization?: ResourceUtilizationView; error?: string }> {
  try {
    const planId = payload.planId || 'default';
    const plan = await getProjectPlan(payload.projectKey, storageProvider, new Date(), undefined, payload.projectId, undefined, planId);
    const utilization = ResourceUtilizationEngine.generateGrid(plan.tasks, plan.weeks, {
      weeklyCapacityHours: payload.weeklyCapacityHours || 40
    });
    return { success: true, utilization };
  } catch (err: any) {
    return { success: false, error: err?.message || 'Failed to generate resource utilization grid' };
  }
}

// Register Forge Resolvers
const resolver = new Resolver();

/**
 * BL-2, INV-16: the permission rule of every planner resolver. define() refuses a name with no rule,
 * so a new resolver cannot be registered without one.
 * - read: reads only.
 * - issue-checked: the resolver checks the user's Jira permissions on every issue it writes.
 * - plan-approver: Jira administrator, project administrator, or a member of an approver group.
 * - project-user: any user who can open the project page (writes only planner data).
 */
type ResolverRule = 'read' | 'issue-checked' | 'plan-approver' | 'project-user';
export const RESOLVER_RULES: Record<string, ResolverRule> = {
  getProjectPlan: 'read',
  checkPlanApprover: 'read',
  getPlanBaselines: 'read',
  getScopeCreepReport: 'read',
  updateWbsTask: 'issue-checked',
  batchUpdateTasks: 'issue-checked',
  continueCascade: 'issue-checked',
  moveTaskGroup: 'issue-checked',
  continueBlockMove: 'issue-checked',
  changeParent: 'issue-checked',
  convertIssueType: 'issue-checked',
  checkConversion: 'issue-checked',
  scheduleBacklogTask: 'issue-checked',
  unscheduleTask: 'issue-checked',
  reorderWbsTasks: 'issue-checked',
  addSubtaskToTask: 'issue-checked',
  resolveLocalSubtasks: 'issue-checked',
  createSubtaskForResource: 'issue-checked',
  createInlineTask: 'issue-checked',
  createJiraEpic: 'issue-checked',
  createProjectPlan: 'plan-approver',
  continuePlanCopy: 'plan-approver',
  renameProjectPlan: 'plan-approver',
  deleteProjectPlan: 'plan-approver',
  continuePlanDelete: 'plan-approver',
  freezePlanBaseline: 'plan-approver',
  setActiveBaseline: 'plan-approver',
  compareBaselines: 'read',
  exportBaseline: 'read',
  reviewScopeShift: 'plan-approver',
  requestScopeShift: 'project-user',
  saveColumnWidths: 'project-user',
  saveHiddenColumns: 'project-user'
};

function define(name: string, fn: (req: any) => Promise<any>): void {
  const rule = RESOLVER_RULES[name];
  if (!rule) throw new Error(`Resolver ${name} has no permission rule (BL-2).`);
  resolver.define(name, async (req) => withResolverHandler(req, async () => {
    if (rule === 'plan-approver' && !(await isPlanApprover(resolveStorage(), { projectId: extractProjectId(req) }))) {
      return forbiddenResult(APPROVER_REQUIRED_MESSAGE);
    }
    return fn(req);
  }));
}

const withProject = (req: any) => ({ ...req.payload, projectKey: extractProjectKey(req), projectId: extractProjectId(req) });

define('getProjectPlan', async (req) => {
  const plan = await getProjectPlan(extractProjectKey(req), undefined, new Date(), extractSiteUrl(req), extractProjectId(req), undefined, req.payload?.planId,
    reconcileIdsOf(req.payload?.reconcileIds));
  // The status of the active baseline comes with the plan, so the toolbar needs no second call (ADR-009).
  return Object.assign(plan, { baselineStatus: await baselineStatusFor(resolveStorage(), extractProjectKey(req), extractProjectId(req), plan) });
});
define('createProjectPlan', async (req) => createProjectPlan(withProject(req)));
define('deleteProjectPlan', async (req) => deleteProjectPlan(withProject(req)));
define('continuePlanCopy', async (req) => continuePlanCopy(withProject(req)));
define('moveTaskGroup', async (req) => moveTaskGroup({ ...withProject(req), reconcileIds: reconcileIdsOf(req.payload?.reconcileIds) }));
define('changeParent', async (req) => changeParent({ ...withProject(req), reconcileIds: reconcileIdsOf(req.payload?.reconcileIds) }));
define('continueBlockMove', async (req) => continueBlockMove({ ...withProject(req), reconcileIds: reconcileIdsOf(req.payload?.reconcileIds) }));
define('convertIssueType', async (req) => convertIssueType(withProject(req)));
define('checkConversion', async (req) => checkConversion(withProject(req)));
define('continuePlanDelete', async (req) => continuePlanDelete(withProject(req)));
define('renameProjectPlan', async (req) => renameProjectPlan(withProject(req)));
define('batchUpdateTasks', async (req) => batchUpdateTasks(withProject(req)));
define('scheduleBacklogTask', async (req) => scheduleBacklogTask(withProject(req)));
define('createInlineTask', async (req) => createInlineTask(withProject(req)));
define('createJiraEpic', async (req) => createJiraEpic(withProject(req)));
define('updateWbsTask', async (req) => {
  try {
    return await updateWbsTask(withProject(req));
  } catch (err: any) {
    if (err instanceof ValidationError || err instanceof ForbiddenError || err instanceof PermissionCheckError) throw err;
    const message = err?.message || 'Failed to update task';
    return { ok: false, success: false, error: message, message };
  }
});
define('addSubtaskToTask', async (req) => addSubtaskToTask(withProject(req)));
define('resolveLocalSubtasks', async (req) => resolveLocalSubtasks(withProject(req)));
define('saveColumnWidths', async (req) => saveColumnWidths(withProject(req)));
define('saveHiddenColumns', async (req) => saveHiddenColumns(withProject(req)));
define('continueCascade', async (req) => continueCascade(withProject(req)));
define('unscheduleTask', async (req) => unscheduleTask(withProject(req)));
define('reorderWbsTasks', async (req) => reorderWbsTasks(withProject(req)));
define('createSubtaskForResource', async (req) => createSubtaskForResource(withProject(req)));
define('freezePlanBaseline', async (req) => freezePlanBaseline(withProject(req), undefined, req.context));
define('getPlanBaselines', async (req) => getPlanBaselines(withProject(req)));
define('getScopeCreepReport', async (req) => getScopeCreepReport(withProject(req)));
define('requestScopeShift', async (req) => requestScopeShift(withProject(req), undefined, req.context));
define('reviewScopeShift', async (req) => reviewScopeShift(withProject(req), undefined, req.context));
define('compareBaselines', async (req) => compareBaselines(withProject(req)));
define('exportBaseline', async (req) => exportBaseline(withProject(req)));
define('setActiveBaseline', async (req) => setActiveBaseline(withProject(req)));

// The admin page has its own function with only the approver-policy resolvers, so no planner
// resolver can run without a project (N-01).
const adminResolver = new Resolver();
adminResolver.define('approver-policy-get-api', async (req) => getApproverPolicyFlow(resolveStorage(), req.context));
adminResolver.define('approver-policy-set-api', async (req) => setApproverPolicyFlow(req.payload, resolveStorage(), req.context));
adminResolver.define('approver-group-search-api', async (req) => searchGroupsFlow(req.payload, req.context));
const adminDefinitions = adminResolver.getDefinitions();

/** Forge function of the admin page (manifest key admin-resolver). */
export const adminHandler = async (event: any, context?: any) => adminDefinitions(event, context);

define('checkPlanApprover', async (req) => {
  const isApprover = await isPlanApprover(resolveStorage(), { projectId: extractProjectId(req) });
  return {
    ok: true,
    isApprover,
    guidance: isApprover ? null : APPROVER_REQUIRED_MESSAGE
  };
});

const definitions = resolver.getDefinitions();



/** Forge function for the issue-deleted trigger (manifest key issue-deleted). */
export const issueDeletedTrigger = async (event: any) => issueDeleted(event);

export const handler = async (event: any, context?: any) => {
  const backendContext = context || (event?.context?.license ? { license: event.context.license } : undefined);
  return definitions(event, backendContext);
};
