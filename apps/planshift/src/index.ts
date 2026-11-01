/**
 * CascadePlan: Main Forge Resolver & Entry Point
 * Implements Project Plan retrieval, live Jira issue/epic ingestion, multi-unit estimation,
 * subtask rollups with buffers, real assignee search & placeholders, and dependency management.
 */

import api, { route } from '@forge/api';
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
  PortfolioResourceHeatmapRow,
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
  DEFAULT_STORY_POINT_RATIO
} from './domain/models';
import { PlannerEngine } from './domain/planner-engine';
import { describeJiraChanges, JiraFieldChange } from './domain/jira-change';
import { evaluateEffort, cascade, ScheduleEffort, ScheduleLink, addDays } from './domain/schedule-engine';
import { StorageProvider } from './storage/plan-repository';
import { PlanStore, StoredEntry, sequenceBetween } from './storage/plan-store';
import {
  ValidationError,
  assertIssueKey,
  validateTaskUpdates,
  validateDependencyPayload,
  validateColumnWidths,
  validateHiddenColumns,
  validateMilestone,
  toValidationResult
} from './validation';

class ForgeKvsProvider implements StorageProvider {
  async get<T>(key: string): Promise<T | undefined> {
    const val = await kvs.get(key);
    return val as T;
  }

  async set(key: string, value: any): Promise<void> {
    await kvs.set(key, value);
  }

  async delete(key: string): Promise<void> {
    await kvs.delete(key);
  }

  async query<T>(prefix: string): Promise<Array<{ key: string; value: T }>> {
    const out: Array<{ key: string; value: T }> = [];
    let cursor: string | undefined;
    do {
      let q = kvs.query().where('key', WhereConditions.beginsWith(prefix)).limit(100);
      if (cursor) q = q.cursor(cursor);
      const page = await q.getMany<T>();
      for (const r of page.results) out.push({ key: r.key, value: r.value });
      cursor = page.nextCursor;
    } while (cursor);
    return out;
  }

  async swap<T>(key: string, value: T): Promise<T | undefined> {
    const res = await kvs.set<T, T>(key, value, { keyPolicy: 'OVERRIDE', returnValue: 'PREVIOUS' });
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
  } catch {}
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
  'effortHours', 'parentKey', 'parentId', 'isSubtask', 'isEpic', 'hierarchyLevel', 'id', 'key', 'jiraDueDate'
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
 * and FRACTIONAL_MILESTONE links from the dependencies (B-11, B-24).
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
    if (t.dependency && t.dependency.predecessorKey && typeof t.dependency.triggerPercent === 'number') {
      links.push({ workEffortIdFrom: t.dependency.predecessorKey, workEffortIdTo: t.key, workEffortAssocTypeId: 'FRACTIONAL_MILESTONE',
        triggerPercent: t.dependency.triggerPercent, isTriggerSatisfied: false });
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
export function openStore(storage: StorageProvider, projectKey: string, projectId?: string): PlanStore {
  return new PlanStore(storage, projectId || projectKey, projectKey);
}

/**
 * Runs the one-time migration from the legacy keys, using live Jira ids for the new records.
 */
export async function migrateIfNeeded(store: PlanStore, projectKey: string): Promise<void> {
  const settings = await store.getSettings();
  if (settings.migratedAt) return;
  const live = await fetchLiveJiraIssues(projectKey, {});
  const idByKey = new Map<string, string>();
  for (const t of [...live.tasks, ...live.backlogTasks]) idByKey.set(t.key, t.id);
  await store.ensureMigrated(idByKey);
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

export const DEFAULT_WEEKS: WeeklySprintColumn[] = getDefaultWeeks();

export const DEFAULT_COLUMN_WIDTHS: ColumnWidthConfig = {
  epic: 120,
  story: 110,
  task: 240,
  resource: 120,
  effort: 70,
  progress: 70,
  target: 70,
  status: 100
};

export const DEFAULT_MILESTONES: ProjectMilestone[] = [];

export const PLACEHOLDER_USERS: JiraAssignableUser[] = [
  { accountId: 'ph:res-1', displayName: 'Resource 1 (Placeholder)', isPlaceholder: true },
  { accountId: 'ph:res-2', displayName: 'Resource 2 (Placeholder)', isPlaceholder: true },
  { accountId: 'ph:fe-lead', displayName: 'Frontend Lead (Placeholder)', isPlaceholder: true },
  { accountId: 'ph:be-lead', displayName: 'Backend Lead (Placeholder)', isPlaceholder: true },
  { accountId: 'ph:qa-lead', displayName: 'QA Automation Lead (Placeholder)', isPlaceholder: true },
  { accountId: 'ph:devops', displayName: 'DevOps & SRE (Placeholder)', isPlaceholder: true }
];

export const DEFAULT_RESOURCE_METADATA: Record<string, { coe: string; vertical: string; project: string }> = {};

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
 * Fetches real Jira project assignees and merges with placeholders.
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
  } catch {}
  return [UNASSIGNED_USER, ...realUsers, ...PLACEHOLDER_USERS];
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
  } catch {}
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
  truncated?: { shown: number; total: number };
}

/**
 * Reads the project's issues page by page (nextPageToken), up to MAX_PAGES pages. When more
 * pages remain, reports how many were shown and Jira's approximate total (B-10).
 */
export async function fetchRawIssues(projectKey: string): Promise<RawIssues> {
  const caller = getJiraCaller();
  const issues: any[] = [];
  let token: string | undefined;
  let pages = 0;
  try {
    do {
      const res = token
        ? await caller.requestJira(route`/rest/api/3/search/jql?jql=project = "${projectKey}" order by created desc&fields=summary,status,issuetype,assignee,timeoriginalestimate,aggregatetimespent,duedate,parent,subtasks,epic,issuelinks&maxResults=100&nextPageToken=${token}`)
        : await caller.requestJira(route`/rest/api/3/search/jql?jql=project = "${projectKey}" order by created desc&fields=summary,status,issuetype,assignee,timeoriginalestimate,aggregatetimespent,duedate,parent,subtasks,epic,issuelinks&maxResults=100`);
      if (!res || res.status !== 200) {
        if (pages === 0) return { issues: [], isLive: false };
        break;
      }
      const data = await res.json();
      issues.push(...(data.issues || []));
      pages++;
      token = data.isLast ? undefined : data.nextPageToken;
    } while (token && pages < MAX_PAGES);
  } catch {
    if (pages === 0) return { issues: [], isLive: false };
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
  } catch {}
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
 * Merges raw Jira issues with the stored planning records into scheduled tasks and backlog.
 */
export function mapLiveIssues(
  raw: RawIssues,
  storedScheduleMap: Record<string, Partial<WbsTask>> = {}
): { tasks: WbsTask[]; backlogTasks: WbsTask[]; isLive: boolean; truncated?: { shown: number; total: number } } {
  try {
    if (raw.isLive) {
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
        const rawSpent = iss.fields?.aggregatetimespent || 0;
        const effortHours = rawSeconds > 0 ? Math.round(rawSeconds / 3600) : 0;

        let progress = 0;
        if (status === 'COMPLETED') {
          progress = 100;
        } else if (rawSeconds > 0 && rawSpent > 0) {
          progress = Math.min(100, Math.round((rawSpent / rawSeconds) * 100));
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

        // A stored null means the user removed the dependency; a Jira link must not bring it back.
        const dependencyRemoved = stored ? stored.dependency === null : false;
        let liveDependency: TaskDependency | undefined = stored?.dependency || undefined;
        if (!liveDependency && !dependencyRemoved && Array.isArray(iss.fields?.issuelinks)) {
          const blockLink = iss.fields.issuelinks.find((link: any) => {
            const typeName = link.type?.name?.toLowerCase();
            return (typeName === 'blocks' || typeName === 'dependency') && link.inwardIssue?.key;
          });
          if (blockLink && blockLink.inwardIssue?.key) {
            liveDependency = {
              predecessorId: String(blockLink.inwardIssue.id || blockLink.inwardIssue.key),
              predecessorKey: String(blockLink.inwardIssue.key),
              // A plain Jira "Blocks" link means finish-to-start (B-11: no silent 30% default).
              triggerPercent: 100,
              isTriggerSatisfied: false
            };
          }
        }

        const finalSubtasks: SubtaskItem[] = (stored?.subtasks && stored.subtasks.length > 0)
          ? stored.subtasks
          : subtasks;

        const calculatedEffortConfig = PlannerEngine.calculateEffortWithSubtasksAndBuffer({
          unit: 'HOURS',
          rawEstimate: effortHours,
          subtasks: finalSubtasks,
          bufferType: 'NONE'
        });

        const effortConfig = stored?.effortConfig || calculatedEffortConfig;
        // The estimate is Jira's original estimate, read live (INV-04).
        const totalHours = effortHours;

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
          targetProgress: stored?.targetProgress !== undefined ? stored.targetProgress : 0,
          manualProgress: stored?.manualProgress,
          status,
          startDate: stored?.startDate || DEFAULT_WEEKS[0]?.startDate || '',
          endDate: stored?.endDate || iss.fields?.duedate || DEFAULT_WEEKS[3]?.endDate || '',
          // The due date Jira holds, read live: the old value in the Changes panel (B-23).
          jiraDueDate: iss.fields?.duedate || undefined,
          startWeek: stored?.startWeek,
          endWeek: stored?.endWeek,
          spanWeeks: stored?.spanWeeks || 3,
          weeklyAllocations: stored?.weeklyAllocations,
          dependency: liveDependency,
          subtasks: finalSubtasks,
          isSubtask,
          isEpic,
          hierarchyLevel,
          parentKey,
          parentId,
          version: stored?.version
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
  } catch {}

  return { tasks: [], backlogTasks: [], isLive: false };
}

export interface LiveData {
  raw: RawIssues;
  users: JiraAssignableUser[];
  epics: JiraEpicItem[];
}

/** One read of everything a plan needs from Jira. */
export async function loadLive(projectKey: string): Promise<LiveData> {
  const [raw, users, epics] = await Promise.all([fetchRawIssues(projectKey), fetchProjectUsers(projectKey), fetchProjectEpics(projectKey)]);
  return { raw, users, epics };
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
  preloaded?: LiveData
): Promise<ProjectPlanState> {
  const storage = resolveStorage(storageProvider);
  const store = openStore(storage, projectKey, projectId);
  await migrateIfNeeded(store, projectKey);

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
  const live = preloaded || await loadLive(projectKey);
  const liveData = mapLiveIssues(live.raw, storedScheduleMap);
  const availableUsers = [...live.users];
  const availableEpics = [...live.epics];

  let tasks = liveData.tasks;
  const backlogTasks = liveData.backlogTasks;

  // Restore any scheduled tasks from storedScheduleMap not returned by live sync
  for (const [key, stored] of Object.entries(storedScheduleMap)) {
    if (!tasks.some(t => t.key === key || t.id === key) &&
        !backlogTasks.some(t => t.key === key || t.id === key)) {
      tasks.push({
        id: stored.id || key,
        key: key,
        summary: stored.summary || `Task ${key}`,
        epic: stored.epic || '',
        epicKey: stored.epicKey,
        story: stored.story || 'Task',
        storyKey: key,
        effortHours: stored.effortHours || 0,
        resource: stored.resource || 'Unassigned',
        resourceAccountId: stored.resourceAccountId,
        progress: stored.progress || 0,
        targetProgress: stored.targetProgress || 0,
        status: stored.status || 'NOT_STARTED',
        startDate: stored.startDate || activeWeeks[0]?.startDate || '',
        endDate: stored.endDate || activeWeeks[3]?.endDate || '',
        startWeek: stored.startWeek || activeWeeks[0]?.weekKey || '',
        endWeek: stored.endWeek || activeWeeks[3]?.weekKey || '',
        spanWeeks: stored.spanWeeks || 3,
        weeklyAllocations: stored.weeklyAllocations,
        dependency: stored.dependency,
        subtasks: stored.subtasks || [],
        parentKey: stored.parentKey,
        parentId: stored.parentId,
        isSubtask: stored.isSubtask,
        isEpic: stored.isEpic,
        hierarchyLevel: stored.hierarchyLevel,
        manualProgress: stored.manualProgress
      });
    }
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
    planId: `plan-${projectKey}`,
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
    lastUpdated: new Date().toISOString(),
    isLiveSynced: liveData.isLive,
    truncated: liveData.truncated,
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
  const { projectKey, projectId, taskId, startWeek, spanWeeks = 3, effortHours, resource, targetIndex } = request;
  const issueId = await verifyIssueInProject(taskId, projectKey, 'taskId');
  const storage = resolveStorage(storageProvider);
  const store = openStore(storage, projectKey, projectId);
  await migrateIfNeeded(store, projectKey);
  const entries = await store.loadEntries();

  const startIdx = Math.max(0, DEFAULT_WEEKS.findIndex(w => w.weekKey === startWeek));
  const endIdx = Math.min(DEFAULT_WEEKS.length - 1, startIdx + spanWeeks - 1);
  const endWeek = DEFAULT_WEEKS[endIdx].weekKey;

  const allocations: Record<string, number> = {};
  for (let i = startIdx; i <= endIdx; i++) {
    allocations[DEFAULT_WEEKS[i].weekKey] = Math.round(100 / spanWeeks);
  }

  const current = entries.get(taskId);
  // Estimate and assignee are Jira-owned: an entered estimate goes to Jira, never to KVS (INV-04).
  const entry = stripJiraOwnedFields({
    ...(current || {}),
    startWeek,
    endWeek,
    spanWeeks,
    startDate: DEFAULT_WEEKS[startIdx].startDate,
    endDate: DEFAULT_WEEKS[endIdx].endDate,
    weeklyAllocations: allocations,
    sequenceNum: sequenceForIndex(entries, taskId, targetIndex)
  });
  void resource;
  const put = await store.putEntry(taskId, issueId, entry, current ? current.version : 0);
  if (!put.ok) return conflictResult(taskId);

  // Sync scheduled due date and effort back to Jira issue
  const log = new SyncLog();
  await syncTaskToJira(taskId, {
    endDate: DEFAULT_WEEKS[endIdx].endDate,
    effortHours
  }, log);

  return Object.assign(await getProjectPlan(projectKey, storage, new Date(), undefined, projectId), { ok: true, jiraSync: log.report() });
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
  const currentWeekKey = DEFAULT_WEEKS.find(w => w.isCurrentWeek)?.weekKey || DEFAULT_WEEKS[0].weekKey;
  const {
    projectKey, projectId, epic, epicKey, story, summary, effortHours,
    resource = 'Unassigned', resourceAccountId, startWeek, spanWeeks = 3, targetIndex
  } = request;

  let jiraIssueId = '';
  let jiraIssueKey = '';

  try {
    let res: any;
    const caller = getJiraCaller();
    let body = {
      fields: {
        project: { key: projectKey },
        summary,
        issuetype: { name: 'Task' }
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
      } catch {}

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
      } catch {}
      return { success: false, ok: false, error: errMsg, jiraSync: failedCreate(errMsg) };
    }

    const data = await res.json();
    jiraIssueId = String(data.id);
    jiraIssueKey = String(data.key);
  } catch (err: any) {
    const message = err?.message || 'Network error while contacting Jira';
    return { success: false, ok: false, error: message, jiraSync: failedCreate(message) };
  }

  const storage = resolveStorage(storageProvider);
  const store = openStore(storage, projectKey, projectId);
  await migrateIfNeeded(store, projectKey);
  const entries = await store.loadEntries();

  const assignedStartWeek = startWeek || currentWeekKey;
  const startIdx = Math.max(0, DEFAULT_WEEKS.findIndex(w => w.weekKey === assignedStartWeek));
  const endIdx = Math.min(DEFAULT_WEEKS.length - 1, startIdx + spanWeeks - 1);
  const endWeek = DEFAULT_WEEKS[endIdx].weekKey;

  const allocations: Record<string, number> = {};
  for (let i = startIdx; i <= endIdx; i++) {
    allocations[DEFAULT_WEEKS[i].weekKey] = Math.round(100 / spanWeeks);
  }

  await store.putEntry(jiraIssueKey, jiraIssueId, {
    startWeek: assignedStartWeek,
    endWeek,
    spanWeeks,
    startDate: DEFAULT_WEEKS[startIdx].startDate,
    endDate: DEFAULT_WEEKS[endIdx].endDate,
    weeklyAllocations: allocations,
    sequenceNum: sequenceForIndex(entries, jiraIssueKey, targetIndex)
  });
  void epic; void story; void resource;

  // Sync scheduled due date and effort back to Jira
  const log = new SyncLog();
  await syncTaskToJira(jiraIssueKey, {
    endDate: DEFAULT_WEEKS[endIdx].endDate,
    effortHours,
    resourceAccountId,
    epicKey
  }, log);

  const plan = await getProjectPlan(projectKey, storage, new Date(), undefined, projectId);
  const createdTask = plan.tasks.find(t => t.key === jiraIssueKey) || plan.tasks[0];

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
      } catch {}

      if (isIssueTypeError) {
        const issueTypeMeta = await resolveProjectIssueType(projectKey, 'Epic');
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
      let errMsg = `Failed to create Jira Epic (HTTP ${res?.status || 500})`;
      try {
        const errJson = await res.json();
        if (errJson.errorMessages && errJson.errorMessages.length > 0) {
          errMsg = errJson.errorMessages.join(', ');
        } else if (errJson.errors && Object.keys(errJson.errors).length > 0) {
          errMsg = Object.values(errJson.errors).join(', ');
        }
      } catch {}
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
  before: Partial<WbsTask> = {}
): Promise<{ synced: boolean; error?: string; fields: string[] }> {
  const result = await syncTaskFields(taskIdOrKey, updates);
  if (log) {
    // Each write is logged with its old and new values; a field Jira refused is logged as not written (B-23).
    log.record(taskIdOrKey, result.fields, result, describeJiraChanges(result.fields, before, updates));
    log.record(taskIdOrKey, result.rejected, { synced: false, error: 'Jira did not accept the due date on this issue screen' },
      describeJiraChanges(result.rejected, before, updates));
  }
  return result;
}

async function syncTaskFields(
  taskIdOrKey: string,
  updates: Partial<WbsTask>
): Promise<{ synced: boolean; error?: string; fields: string[]; rejected: string[] }> {
  const fields: Record<string, any> = {};
  let dropped: string[] = [];

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
          } catch {}
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
          } catch {}
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
      return { synced: false, error: err?.message || 'Network error updating Jira issue', fields: Object.keys(fields), rejected: [] };
    }
  }

  // After a successful retry without the due date, the due date was not written.
  const rejected = syncSuccess ? dropped : [];
  const sentFields = Object.keys(fields).filter(f => !rejected.includes(f));
  // Status workflow transition sync
  if (updates.status) {
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
          await caller.requestJira(route`/rest/api/3/issue/${taskIdOrKey}/transitions`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ transition: { id: match.id } })
          });
        }
      }
    } catch {}
  }

  if (updates.status) sentFields.push('status');
  return { synced: syncSuccess, error: errMsg, fields: sentFields, rejected };
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
  } catch {}
  return undefined;
}

/**
 * Mirrors a dependency into a native Jira "Blocks" link. Reuses an existing link, so saving the
 * same dependency twice creates one link, and returns the link id.
 */
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
 * Updates a task schedule, dates, effort, progress, or resource.
 */
export async function updateWbsTask(
  payload: { projectKey: string; projectId?: string; taskId: string; updates: Partial<WbsTask>; expectedVersion?: number },
  storageProvider?: StorageProvider
): Promise<ProjectPlanState> {
  const { projectKey, projectId, taskId, updates, expectedVersion } = payload;
  validateTaskUpdates(updates as Record<string, unknown>);
  if (expectedVersion !== undefined && (!Number.isInteger(expectedVersion) || expectedVersion < 0)) {
    throw new ValidationError('expectedVersion', 'expectedVersion must be a whole number of at least 0');
  }
  const storage = resolveStorage(storageProvider);
  const log = new SyncLog();

  // Jira is read once per update; the returned plan reuses the same read (B-10).
  const live = await loadLive(projectKey);
  const plan = await getProjectPlan(projectKey, storage, new Date(), undefined, projectId, live);
  const targetTask = plan.tasks.find(t => t.id === taskId || t.key === taskId) ||
    (plan.backlogTasks || []).find(t => t.id === taskId || t.key === taskId);
  if (!targetTask) {
    throw new Error(`Task '${taskId}' not found in project plan`);
  }
  const store = openStore(storage, projectKey, projectId);
  const entries = await store.loadEntries();
  const baseVersion = entries.get(targetTask.key)?.version ?? 0;
  if (expectedVersion !== undefined && expectedVersion !== baseVersion) {
    // The user edited an older copy: refuse before any Jira write (INV-08).
    return conflictResult(targetTask.key);
  }
  const idByKey = new Map([...plan.tasks, ...(plan.backlogTasks || [])].map(t => [t.key, t.id]));
  const planKeys = new Set([...plan.tasks, ...(plan.backlogTasks || [])].map(t => t.key));
  if (updates.dependency && updates.dependency.predecessorKey && !planKeys.has(updates.dependency.predecessorKey)) {
    throw new ValidationError('dependency.predecessorKey', `${updates.dependency.predecessorKey} is not in project ${projectKey}`);
  }

  const ALLOWED_KEYS = [
    'summary', 'epic', 'epicKey', 'story', 'effortHours', 'effortConfig', 'resource',
    'resourceAccountId', 'contributingResources', 'progress', 'targetProgress', 'manualProgress', 'status', 'startDate',
    'endDate', 'startWeek', 'endWeek', 'spanWeeks', 'weeklyAllocations', 'subtasks',
    'dependency'
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
    if (sanitized.progress === 100) {
      sanitized.status = 'COMPLETED';
    } else if (sanitized.progress > 0 && sanitized.progress < 100 && (sanitized.status === 'NOT_STARTED' || (!sanitized.status && targetTask.status === 'NOT_STARTED'))) {
      sanitized.status = 'IN_PROGRESS';
    }
  }
  if (sanitized.targetProgress !== undefined) {
    const rawT = Number(sanitized.targetProgress);
    sanitized.targetProgress = isNaN(rawT) ? 0 : Math.max(0, Math.min(100, Math.round(rawT)));
  }

  // Fractional progress-threshold dependency validation and Jira link mirroring
  if (sanitized.dependency !== undefined) {
    if (sanitized.dependency && sanitized.dependency.predecessorKey) {
      const predKey = sanitized.dependency.predecessorKey;
      const triggerPercent = sanitized.dependency.triggerPercent;
      const validation = PlannerEngine.validateDependency(
        targetTask.key,
        predKey,
        triggerPercent,
        plan.tasks
      );
      if (!validation.valid) {
        throw new Error(validation.error);
      }
      const previous = targetTask.dependency;
      if (previous && previous.jiraLinkId && previous.predecessorKey !== predKey) {
        log.record(targetTask.key, ['issuelink'], { synced: await removeMirroredLink(previous.jiraLinkId), error: 'Jira did not delete the old link' });
      }
      const mirror = await mirrorDependencyToJira(targetTask.key, predKey);
      log.record(targetTask.key, ['issuelink'], { synced: mirror.linked, error: mirror.error || 'Jira did not create the link' });
      sanitized.dependency = {
        predecessorId: predKey,
        predecessorKey: predKey,
        triggerPercent,
        isTriggerSatisfied: false
      };
      // Remember the link only when CascadePlan created it (or already owned it).
      const ownedLinkId = mirror.created ? mirror.linkId
        : (previous && previous.predecessorKey === predKey ? previous.jiraLinkId : undefined);
      if (ownedLinkId) sanitized.dependency.jiraLinkId = ownedLinkId;
    } else {
      // Explicit removal: delete only the link CascadePlan created, and keep a null so that
      // a Jira link the user made does not bring the dependency back (NF-02).
      const previous = targetTask.dependency;
      if (previous && previous.jiraLinkId) {
        log.record(targetTask.key, ['issuelink'], { synced: await removeMirroredLink(previous.jiraLinkId), error: 'Jira did not delete the link' });
      }
      sanitized.dependency = null;
    }
  }

  // Derive schedule dates and weeks dynamically
  const activeWeeks = plan.weeks || DEFAULT_WEEKS;

  const userPickedDates = sanitized.startDate !== undefined || sanitized.endDate !== undefined;
  if (userPickedDates) {
    // Dates the user picked are kept exactly; the week grid position is derived from them (CP-07).
    const s = sanitized.startDate || targetTask.startDate;
    const e = sanitized.endDate || targetTask.endDate;
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
    const oldIdx = activeWeeks.findIndex(w => w.weekKey === targetTask.startWeek);
    const oldSpan = targetTask.spanWeeks || 3;
    const sWk = sanitized.startWeek || targetTask.startWeek || activeWeeks[0].weekKey;
    const span = sanitized.spanWeeks || oldSpan;
    const sIdx = Math.max(0, activeWeeks.findIndex(w => w.weekKey === sWk));
    const eIdx = Math.min(activeWeeks.length - 1, sIdx + span - 1);

    sanitized.startWeek = activeWeeks[sIdx].weekKey;
    sanitized.endWeek = activeWeeks[eIdx].weekKey;
    sanitized.spanWeeks = span;
    if (oldIdx !== -1 && isIsoDate(targetTask.startDate) && isIsoDate(targetTask.endDate)) {
      // A move or resize by whole weeks keeps the exact days of the bar.
      const shiftStart = (sIdx - oldIdx) * 7;
      sanitized.startDate = addDaysIso(targetTask.startDate, shiftStart);
      sanitized.endDate = addDaysIso(targetTask.endDate, shiftStart + (span - oldSpan) * 7);
    } else {
      sanitized.startDate = activeWeeks[sIdx].startDate;
      sanitized.endDate = activeWeeks[eIdx].endDate;
    }
    if (!sanitized.weeklyAllocations) {
      sanitized.weeklyAllocations = evenAllocations(activeWeeks, sIdx, span);
    }
  }

  // A new or changed dependency moves the task to its earliest start, keeping its duration (B-11).
  if (sanitized.dependency && sanitized.dependency.predecessorKey) {
    const start = sanitized.startDate || targetTask.startDate;
    const end = sanitized.endDate || targetTask.endDate;
    const candidate = plan.tasks.map(t => (t.key === targetTask.key ? { ...t, startDate: start, endDate: end, dependency: sanitized.dependency } : t));
    const inputs = engineInputs(candidate);
    const ev = evaluateEffort(targetTask.key, inputs.efforts, inputs.links, todayIso());
    if (ev.earliestStartDate && isIsoDate(start) && start < ev.earliestStartDate) {
      const days = isIsoDate(end) ? Math.max(0, Math.round((Date.parse(`${end}T00:00:00Z`) - Date.parse(`${start}T00:00:00Z`)) / 86400000)) : 0;
      sanitized.startDate = ev.earliestStartDate;
      sanitized.endDate = addDays(ev.earliestStartDate, days);
      Object.assign(sanitized, gridFor(activeWeeks, sanitized.startDate, sanitized.endDate));
    }
  }

  const scheduleMap: Record<string, Partial<WbsTask>> = Object.fromEntries(entries);
  const current = scheduleMap[targetTask.key] || {};
  const changedKeys = new Set<string>([targetTask.key]);
  const pendingSyncs: Array<{ key: string; updates: Partial<WbsTask> }> = [];

  // Preserve existing dependency if updates didn't explicitly modify or clear it
  if (sanitized.dependency === undefined && current.dependency === undefined && targetTask.dependency) {
    sanitized.dependency = targetTask.dependency;
  }

  // Preserve existing contributingResources if updates didn't explicitly modify or clear it
  if (sanitized.contributingResources === undefined && (current.contributingResources || targetTask.contributingResources)) {
    sanitized.contributingResources = current.contributingResources || targetTask.contributingResources;
  }

  // Preserve existing manualProgress if updates didn't explicitly modify or clear it
  if (sanitized.manualProgress === undefined && (current.manualProgress !== undefined || targetTask.manualProgress !== undefined)) {
    sanitized.manualProgress = current.manualProgress !== undefined ? current.manualProgress : targetTask.manualProgress;
  }

  scheduleMap[targetTask.key] = stripJiraOwnedFields({
    ...current,
    ...sanitized
  });

  // Cascade date shifts to conflicting successors, at most CASCADE_BATCH_LIMIT per call (B-10, B-11).
  let cascadeRemaining: string[] = [];
  if (sanitized.startDate || sanitized.endDate || sanitized.dependency) {
    const candidateTasks = plan.tasks.map(t => (t.key === targetTask.key ? { ...t, ...sanitized } : t));
    const inputs = engineInputs(candidateTasks);
    const { changes } = cascade(inputs.efforts, inputs.links, targetTask.key, todayIso());
    cascadeRemaining = changes.slice(CASCADE_BATCH_LIMIT).map(c => c.key);
    for (const c of changes.slice(0, CASCADE_BATCH_LIMIT)) {
      scheduleMap[c.key] = { ...(scheduleMap[c.key] || {}), startDate: c.toStart, endDate: c.toEnd, ...gridFor(activeWeeks, c.toStart, c.toEnd) };
      changedKeys.add(c.key);
      pendingSyncs.push({ key: c.key, updates: { endDate: c.toEnd } });
    }
  }

  // Cascade roll-up bounds to parent task if targetTask has a parentKey
  const pKey = targetTask.parentKey || sanitized.parentKey;
  if (pKey && (sanitized.startWeek || sanitized.spanWeeks || sanitized.progress !== undefined)) {
    const parentTask = plan.tasks.find(t => t.key === pKey);
    if (parentTask) {
      const siblingTasks = plan.tasks.filter(t => t.parentKey === pKey || t.key === targetTask.key);
      let minStartIdx = activeWeeks.length;
      let maxEndIdx = -1;
      let totalHours = 0;
      let completedHours = 0;

      for (const sib of siblingTasks) {
        const item = (sib.key === targetTask.key ? { ...sib, ...sanitized } : sib);
        const effort = item.effortHours || 0;
        totalHours += effort;
        completedHours += effort * ((item.progress || 0) / 100);

        const sIdx = activeWeeks.findIndex(w => w.weekKey === item.startWeek);
        if (sIdx !== -1) {
          const span = item.spanWeeks || 1;
          minStartIdx = Math.min(minStartIdx, sIdx);
          maxEndIdx = Math.max(maxEndIdx, Math.min(activeWeeks.length - 1, sIdx + span - 1));
        }
      }

      if (minStartIdx <= maxEndIdx) {
        const curParent = scheduleMap[pKey] || {};
        if (parentTask.dependency && !curParent.dependency) {
          curParent.dependency = parentTask.dependency;
        }
        scheduleMap[pKey] = {
          ...curParent,
          startWeek: activeWeeks[minStartIdx].weekKey,
          endWeek: activeWeeks[maxEndIdx].weekKey,
          startDate: activeWeeks[minStartIdx].startDate,
          endDate: activeWeeks[maxEndIdx].endDate,
          spanWeeks: maxEndIdx - minStartIdx + 1
        };
        // A computed roll-up is derived on every load and is not stored (INV-04).
        void totalHours; void completedHours;
        // Plan-only: the parent's Jira due date is not written, because the user did not enter it (INV-03).
        changedKeys.add(pKey);
      }
    }
  }

  // KVS first, with a version check per record; Jira only after the target record is saved.
  const targetPut = await store.putEntry(targetTask.key, targetTask.id, stripJiraOwnedFields(scheduleMap[targetTask.key]), baseVersion);
  if (!targetPut.ok) return conflictResult(targetTask.key);
  for (const key of changedKeys) {
    if (key === targetTask.key) continue;
    const put = await store.putEntry(key, idByKey.get(key), stripJiraOwnedFields(scheduleMap[key]), entries.get(key)?.version ?? 0);
    if (!put.ok) log.record(key, ['plan'], { synced: false, error: 'changed by someone else; not moved' });
  }
  for (const s of pendingSyncs) await syncTaskToJira(s.key, s.updates, log, plan.tasks.find(t => t.key === s.key));

  // Two-way sync: write-back changed fields to Jira
  await syncTaskToJira(targetTask.key, sanitized, log, targetTask);

  return Object.assign(await getProjectPlan(projectKey, storage, new Date(), undefined, projectId, live),
    { ok: true, jiraSync: log.report(), cascadeRemaining });
}

export const CASCADE_BATCH_LIMIT = 25;

/**
 * Applies the next batch of a cascade from a task: moves at most CASCADE_BATCH_LIMIT conflicting
 * successors and returns the keys still to move (D-05: the client calls again until empty).
 */
export async function continueCascade(
  payload: { projectKey: string; projectId?: string; taskId: string },
  storageProvider?: StorageProvider
): Promise<ProjectPlanState> {
  const { projectKey, projectId, taskId } = payload;
  assertIssueKey(taskId, 'taskId');
  const storage = resolveStorage(storageProvider);
  const log = new SyncLog();
  const live = await loadLive(projectKey);
  const plan = await getProjectPlan(projectKey, storage, new Date(), undefined, projectId, live);
  const store = openStore(storage, projectKey, projectId);
  const entries = await store.loadEntries();
  const inputs = engineInputs(plan.tasks);
  const { changes } = cascade(inputs.efforts, inputs.links, taskId, todayIso());
  for (const c of changes.slice(0, CASCADE_BATCH_LIMIT)) {
    const cur = entries.get(c.key);
    const task = plan.tasks.find(t => t.key === c.key);
    const put = await store.putEntry(c.key, task?.id, stripJiraOwnedFields({ ...(cur || {}), startDate: c.toStart, endDate: c.toEnd,
      ...gridFor(plan.weeks, c.toStart, c.toEnd) }), cur ? cur.version : 0);
    if (!put.ok) { log.record(c.key, ['plan'], { synced: false, error: 'changed by someone else; not moved' }); continue; }
    await syncTaskToJira(c.key, { endDate: c.toEnd }, log, task);
  }
  return Object.assign(await getProjectPlan(projectKey, storage, new Date(), undefined, projectId, live),
    { ok: true, jiraSync: log.report(), cascadeRemaining: changes.slice(CASCADE_BATCH_LIMIT).map(c => c.key) });
}

/**
 * Lists the moves that a change of start week or span would cause, without writing anything.
 */
export async function previewCascade(
  payload: { projectKey: string; projectId?: string; taskId: string; updates: { startDate?: string; endDate?: string; startWeek?: string; spanWeeks?: number } },
  storageProvider?: StorageProvider
): Promise<{ ok: boolean; changes: Array<{ key: string; field: string; from?: string; to?: string; reason?: string }> }> {
  const { projectKey, projectId, taskId, updates } = payload;
  assertIssueKey(taskId, 'taskId');
  validateTaskUpdates(updates as Record<string, unknown>);
  const plan = await getProjectPlan(projectKey, resolveStorage(storageProvider), new Date(), undefined, projectId);
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
  const storage = resolveStorage(storageProvider);
  const store = openStore(storage, projectKey, projectId);
  await migrateIfNeeded(store, projectKey);
  const current = (await store.loadEntries()).get(taskId);
  if (current) {
    const entry: Partial<WbsTask> = { ...current };
    for (const f of ['startWeek', 'endWeek', 'startDate', 'endDate', 'weeklyAllocations', 'sequenceNum'] as const) delete entry[f];
    entry.isBacklog = true;
    const put = await store.putEntry(taskId, issueId, stripJiraOwnedFields(entry), current.version);
    if (!put.ok) return conflictResult(taskId);
  }

  return Object.assign(await getProjectPlan(projectKey, storage, new Date(), undefined, projectId), { ok: true, jiraSync: noJiraWrites() });
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

  const live = await loadLive(projectKey);
  const plan = await getProjectPlan(projectKey, storage, new Date(), undefined, projectId, live);
  const reordered = PlannerEngine.reorderTasks(plan.tasks, taskId, targetIndex);
  const store = openStore(storage, projectKey, projectId);
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
      entries.set(row.key, put.entry);
      last = seq;
    }
    const seqAt = (i: number) => (i >= 0 && i < reordered.length ? entries.get(reordered[i].key)?.sequenceNum : undefined);
    const moved = entries.get(movedKey);
    if (moved) {
      await store.putEntry(movedKey, reordered[pos].id, { ...moved, sequenceNum: sequenceBetween(seqAt(pos - 1), seqAt(pos + 1)) }, moved.version);
    }
  }
  return Object.assign(await getProjectPlan(projectKey, storage, new Date(), undefined, projectId, live), { ok: true, jiraSync: noJiraWrites() });
}

/**
 * Creates a subtask in Jira specifically allocated to a secondary or specific team resource.
 * Adheres to Jira single-assignee best practice by creating background subtasks per resource.
 */
export async function createSubtaskForResource(
  payload: CreateSubtaskForResourceRequest,
  storageProvider?: StorageProvider
): Promise<{ success: boolean; ok: boolean; jiraSync: JiraSyncReport; subtask?: WbsTask; plan?: ProjectPlanState; error?: string }> {
  const projectKey = payload.projectKey;
  const projectId = payload.projectId;
  const parentKey = payload.parentKey || payload.parentTaskId;
  const resource = payload.resource || payload.assigneeName || 'Unassigned';
  const resourceAccountId = payload.resourceAccountId || payload.assigneeAccountId;
  const summary = payload.summary || `Subtask: ${resource}`;
  const effortHours = payload.effortHours ?? 20;
  const startWeek = payload.startWeek;
  const spanWeeks = payload.spanWeeks ?? 2;

  if (!parentKey) {
    return { success: false, ok: false, error: 'parentKey is required', jiraSync: noJiraWrites() };
  }
  await verifyIssueInProject(parentKey, projectKey, 'parentKey');

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

  const storage = resolveStorage(storageProvider);
  const dynamicWeeks = getTimelineWeeks();
  const activeWeeks = dynamicWeeks.weeks;
  const assignedStart = startWeek || activeWeeks[dynamicWeeks.currentWeekIndex].weekKey;
  const sIdx = Math.max(0, activeWeeks.findIndex(w => w.weekKey === assignedStart));
  const eIdx = Math.min(activeWeeks.length - 1, sIdx + spanWeeks - 1);

  const allocations: Record<string, number> = {};
  for (let i = sIdx; i <= eIdx; i++) {
    allocations[activeWeeks[i].weekKey] = Math.round(100 / spanWeeks);
  }

  const store = openStore(storage, projectKey, projectId);
  await migrateIfNeeded(store, projectKey);
  await store.putEntry(createdKey, createdId, {
    startWeek: assignedStart,
    endWeek: activeWeeks[eIdx].weekKey,
    startDate: activeWeeks[sIdx].startDate,
    endDate: activeWeeks[eIdx].endDate,
    spanWeeks,
    weeklyAllocations: allocations
  });

  // Sync estimate & duedate to newly created subtask
  const log = new SyncLog();
  log.record(createdKey, ['create'], { synced: true });
  await syncTaskToJira(createdKey, {
    effortHours,
    endDate: activeWeeks[eIdx].endDate,
    resourceAccountId
  }, log);

  const plan = await getProjectPlan(projectKey, storage, new Date(), undefined, projectId);
  const subtask = plan.tasks.find(t => t.key === createdKey);
  return { success: true, ok: true, jiraSync: log.report(), subtask, plan };
}

/**
 * Adds a subtask to a parent task, re-calculating the parent effort with optional buffer.
 */
export async function addSubtaskToTask(
  payload: {
    projectKey: string;
    projectId?: string;
    parentTaskId: string;
    subtask: { summary: string; estimateValue: number; estimateUnit: EstimateUnit };
    bufferType?: 'PERCENTAGE' | 'FIXED_HOURS' | 'NONE';
    bufferValue?: number;
  },
  storageProvider?: StorageProvider
): Promise<ProjectPlanState> {
  const { projectKey, projectId, parentTaskId, subtask, bufferType = 'NONE', bufferValue = 0 } = payload;
  const parentId = await verifyIssueInProject(parentTaskId, projectKey, 'parentTaskId');
  const storage = resolveStorage(storageProvider);
  const store = openStore(storage, projectKey, projectId);
  await migrateIfNeeded(store, projectKey);
  const stored = (await store.loadEntries()).get(parentTaskId);
  const current: Partial<WbsTask> = stored || {};
  const existingSubtasks: SubtaskItem[] = (current.subtasks || []);

  const normalized = PlannerEngine.normalizeEstimateToHours(subtask.estimateUnit, subtask.estimateValue);

  const newSubtask: SubtaskItem = {
    id: `sub-${Date.now()}`,
    summary: subtask.summary,
    estimateValue: subtask.estimateValue,
    estimateUnit: subtask.estimateUnit,
    normalizedHours: normalized,
    status: 'NOT_STARTED'
  };

  const updatedSubtasks = [...existingSubtasks, newSubtask];
  const effortConfig = PlannerEngine.calculateEffortWithSubtasksAndBuffer({
    unit: 'HOURS',
    subtasks: updatedSubtasks,
    bufferType,
    bufferValue
  });

  const put = await store.putEntry(parentTaskId, parentId, stripJiraOwnedFields({
    ...current,
    subtasks: updatedSubtasks,
    effortConfig
  }), stored ? stored.version : 0);
  if (!put.ok) return conflictResult(parentTaskId);
  return Object.assign(await getProjectPlan(projectKey, storage, new Date(), undefined, projectId), { ok: true, jiraSync: noJiraWrites() });
}

/**
 * Saves an inter-task fractional dependency.
 */
export async function saveTaskDependency(
  payload: { projectKey: string; projectId?: string; taskId: string; dependency: TaskDependency },
  storageProvider?: StorageProvider
): Promise<ProjectPlanState> {
  const { projectKey, projectId, taskId, dependency } = payload;
  validateDependencyPayload(dependency);
  const storage = resolveStorage(storageProvider);

  const live = await loadLive(projectKey);
  const plan = await getProjectPlan(projectKey, storage, new Date(), undefined, projectId, live);
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
  const previous = targetTask.dependency;
  const ownedLinkId = mirror.created ? mirror.linkId
    : (previous && previous.predecessorKey === dependency.predecessorKey ? previous.jiraLinkId : undefined);

  const store = openStore(storage, projectKey, projectId);
  const stored = (await store.loadEntries()).get(targetTask.key);
  const put = await store.putEntry(targetTask.key, targetTask.id, stripJiraOwnedFields({
    ...(stored || {}),
    dependency: ownedLinkId ? { ...dependency, jiraLinkId: ownedLinkId } : dependency
  }), stored ? stored.version : 0);
  if (!put.ok) return conflictResult(targetTask.key);

  return Object.assign(await getProjectPlan(projectKey, storage, new Date(), undefined, projectId, live), { ok: true, jiraSync: log.report() });
}

/**
 * Saves column width configurations.
 */
export async function saveColumnWidths(
  payload: { projectKey: string; projectId?: string; columnWidths: ColumnWidthConfig },
  storageProvider?: StorageProvider
): Promise<{ success: boolean; ok: boolean; jiraSync: JiraSyncReport; columnWidths: ColumnWidthConfig }> {
  const { projectKey, projectId, columnWidths } = payload;
  validateColumnWidths(columnWidths as unknown as Record<string, unknown>);
  const store = openStore(resolveStorage(storageProvider), projectKey, projectId);
  await store.saveSettings({ columnWidths });
  return { success: true, ok: true, jiraSync: noJiraWrites(), columnWidths };
}

/**
 * Saves hidden columns configuration.
 */
export async function saveHiddenColumns(
  payload: { projectKey: string; projectId?: string; hiddenColumns: string[] },
  storageProvider?: StorageProvider
): Promise<{ success: boolean; ok: boolean; jiraSync: JiraSyncReport; hiddenColumns: string[] }> {
  const { projectKey, projectId, hiddenColumns } = payload;
  validateHiddenColumns(hiddenColumns);
  const store = openStore(resolveStorage(storageProvider), projectKey, projectId);
  const cols = Array.isArray(hiddenColumns) ? hiddenColumns : [];
  await store.saveSettings({ hiddenColumns: cols });
  return { success: true, ok: true, jiraSync: noJiraWrites(), hiddenColumns: cols };
}

/**
 * Saves a milestone marker.
 */
export async function saveProjectMilestone(
  payload: { projectKey: string; projectId?: string; milestone: ProjectMilestone },
  storageProvider?: StorageProvider
): Promise<{ success: boolean; ok: boolean; jiraSync: JiraSyncReport; milestones: ProjectMilestone[] }> {
  const { projectKey, projectId, milestone } = payload;
  validateMilestone(milestone as unknown as Record<string, unknown>);
  const store = openStore(resolveStorage(storageProvider), projectKey, projectId);
  const current = (await store.getSettings()).milestones || DEFAULT_MILESTONES;
  const filtered = current.filter(m => m.id !== milestone.id).slice(-99);
  filtered.push(milestone);
  await store.saveSettings({ milestones: filtered });
  return { success: true, ok: true, jiraSync: noJiraWrites(), milestones: filtered };
}

/**
 * Retrieves the portfolio-wide executive resource heatmap.
 */
export async function getPortfolioResourceHeatmap(
  projectKey: string,
  filters: { project?: string; coe?: string; vertical?: string } = {},
  storageProvider?: StorageProvider,
  referenceDate?: Date
): Promise<{ rows: PortfolioResourceHeatmapRow[]; weeks: WeeklySprintColumn[] }> {
  const storage = resolveStorage(storageProvider);

  const plan = await getProjectPlan(projectKey, storage, referenceDate);
  const metadata = DEFAULT_RESOURCE_METADATA;

  const activeWeekIdx = Math.max(0, plan.weeks.findIndex(w => w.isCurrentWeek));

  const profiles = PlannerEngine.calculateResourceUtilization(plan.tasks, plan.weeks, activeWeekIdx, plan.projectName);
  const allRows = PlannerEngine.buildPortfolioHeatmap(profiles, metadata);
  const filteredRows = PlannerEngine.filterPortfolioHeatmap(allRows, filters);

  return {
    rows: filteredRows,
    weeks: plan.weeks
  };
}

/**
 * Helper to extract projectKey from trusted Jira Forge context first, with payload fallback.
 */
export function extractProjectKey(req: any): string {
  // Enforce Jira context project key first to prevent cross-project manipulation (Finding F3)
  const contextKey = req?.context?.extension?.project?.key;
  if (contextKey && typeof contextKey === 'string' && contextKey.trim().length > 0) {
    return contextKey.trim();
  }
  return req?.payload?.projectKey || 'DEMO';
}

/**
 * Project id from the trusted Forge context; records are keyed by it (B-09).
 */
export function extractProjectId(req: any): string | undefined {
  const id = req?.context?.extension?.project?.id;
  return id !== undefined && id !== null && String(id).trim().length > 0 ? String(id) : undefined;
}

export function extractSiteUrl(req: any): string | undefined {
  const contextUrl = req?.context?.siteUrl;
  if (contextUrl && typeof contextUrl === 'string' && contextUrl.trim().length > 0) {
    return contextUrl.trim();
  }
  return undefined;
}

// Register Forge Resolvers
const resolver = new Resolver();

resolver.define('getProjectPlan', async (req) => withValidation(() => getProjectPlan(extractProjectKey(req), undefined, new Date(), extractSiteUrl(req), extractProjectId(req))));

resolver.define('scheduleBacklogTask', async (req) => withValidation(() => scheduleBacklogTask({ ...req.payload, projectKey: extractProjectKey(req), projectId: extractProjectId(req) })));

resolver.define('createInlineTask', async (req) => withValidation(() => createInlineTask({ ...req.payload, projectKey: extractProjectKey(req), projectId: extractProjectId(req) })));

resolver.define('createJiraEpic', async (req) => withValidation(() => createJiraEpic({ ...req.payload, projectKey: extractProjectKey(req), projectId: extractProjectId(req) })));

resolver.define('updateWbsTask', async (req) => {
  try {
    return await withValidation(() => updateWbsTask({ ...req.payload, projectKey: extractProjectKey(req), projectId: extractProjectId(req) }));
  } catch (err: any) {
    return { success: false, error: err?.message || 'Failed to update task' };
  }
});

resolver.define('addSubtaskToTask', async (req) => withValidation(() => addSubtaskToTask({ ...req.payload, projectKey: extractProjectKey(req), projectId: extractProjectId(req) })));

resolver.define('saveTaskDependency', async (req) => withValidation(() => saveTaskDependency({ ...req.payload, projectKey: extractProjectKey(req), projectId: extractProjectId(req) })));

resolver.define('saveColumnWidths', async (req) => withValidation(() => saveColumnWidths({ ...req.payload, projectKey: extractProjectKey(req), projectId: extractProjectId(req) })));

resolver.define('saveHiddenColumns', async (req) => withValidation(() => saveHiddenColumns({ ...req.payload, projectKey: extractProjectKey(req), projectId: extractProjectId(req) })));

resolver.define('saveProjectMilestone', async (req) => withValidation(() => saveProjectMilestone({ ...req.payload, projectKey: extractProjectKey(req), projectId: extractProjectId(req) })));

resolver.define('getPortfolioResourceHeatmap', async (req) => withValidation(() => getPortfolioResourceHeatmap(extractProjectKey(req), req.payload?.filters)));

resolver.define('continueCascade', async (req) => withValidation(() => continueCascade({ ...req.payload, projectKey: extractProjectKey(req), projectId: extractProjectId(req) })));

resolver.define('previewCascade', async (req) => withValidation(() => previewCascade({ ...req.payload, projectKey: extractProjectKey(req), projectId: extractProjectId(req) })));

resolver.define('unscheduleTask', async (req) => withValidation(() => unscheduleTask({ ...req.payload, projectKey: extractProjectKey(req), projectId: extractProjectId(req) })));

resolver.define('reorderWbsTasks', async (req) => withValidation(() => reorderWbsTasks({ ...req.payload, projectKey: extractProjectKey(req), projectId: extractProjectId(req) })));

resolver.define('createSubtaskForResource', async (req) => withValidation(() => createSubtaskForResource({ ...req.payload, projectKey: extractProjectKey(req), projectId: extractProjectId(req) })));

export const handler = resolver.getDefinitions();
