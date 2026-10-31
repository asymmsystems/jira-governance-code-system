/**
 * CascadePlan: Main Forge Resolver & Entry Point
 * Implements Project Plan retrieval, live Jira issue/epic ingestion, multi-unit estimation,
 * subtask rollups with buffers, real assignee search & placeholders, and dependency management.
 */

import api, { route } from '@forge/api';
import Resolver from '@forge/resolver';
import { kvs } from '@forge/kvs';
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
import { PlanRepository, StorageProvider } from './storage/plan-repository';
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

export function getJiraCaller() {
  if (api.asUser && typeof api.asUser === 'function') {
    return api.asUser();
  }
  return api.asApp();
}

/**
 * Throws ValidationError unless Jira reports the issue as part of the given project (INV-15).
 */
export async function verifyIssueInProject(issueKey: unknown, projectKey: string, field: string): Promise<void> {
  assertIssueKey(issueKey, field);
  let projectOfIssue: string | undefined;
  try {
    const res = await getJiraCaller().requestJira(route`/rest/api/3/issue/${issueKey}?fields=project`);
    if (res && res.status === 200) {
      const data = await res.json();
      projectOfIssue = data?.fields?.project?.key;
    }
  } catch {}
  if (projectOfIssue !== projectKey) {
    throw new ValidationError(field, `${issueKey} is not in project ${projectKey}`);
  }
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

  record(key: string, fields: string[], result: { synced: boolean; error?: string }): void {
    if (!fields || fields.length === 0) return;
    const entry: JiraWriteRecord = { key, fields, ok: result.synced };
    if (!result.synced) entry.error = result.error || 'Jira rejected the change';
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
  'effortHours', 'parentKey', 'parentId', 'isSubtask', 'isEpic', 'hierarchyLevel', 'id', 'key'
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

function hasJiraOwnedFields(map: Record<string, Partial<WbsTask>>): boolean {
  return Object.values(map).some(e => e && (JIRA_OWNED_FIELDS.some(f => (e as any)[f] !== undefined) ||
    (e.progress !== undefined && e.manualProgress !== true)));
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

function evenAllocations(weeks: WeeklySprintColumn[], startIdx: number, span: number): Record<string, number> {
  const allocations: Record<string, number> = {};
  for (let i = startIdx; i < Math.min(weeks.length, startIdx + span); i++) {
    allocations[weeks[i].weekKey] = Math.round(100 / span);
  }
  return allocations;
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
    const res = await api.asApp().requestJira(route`/rest/api/3/user/assignable/search?project=${projectKey}&maxResults=50`);
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
    let res = await api.asApp().requestJira(
      route`/rest/api/3/search/jql?jql=project = "${projectKey}" AND issuetype in (Epic, "Initiative") order by created desc&fields=summary,status&maxResults=50`
    );
    if (!res || res.status !== 200) {
      res = await api.asApp().requestJira(
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
export async function fetchLiveJiraIssues(
  projectKey: string,
  storedScheduleMap: Record<string, Partial<WbsTask>> = {}
): Promise<{ tasks: WbsTask[]; backlogTasks: WbsTask[]; isLive: boolean }> {
  try {
    const res = await api.asApp().requestJira(
      route`/rest/api/3/search/jql?jql=project = "${projectKey}" order by created desc&fields=summary,status,issuetype,assignee,timeoriginalestimate,aggregatetimespent,duedate,parent,subtasks,epic,issuelinks&maxResults=100`
    );

    if (res.status === 200) {
      const data = await res.json();
      const rawIssues: any[] = data.issues || [];

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
              triggerPercent: 30,
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
          parentId
        };

        if (wbsItem.startWeek) {
          tasks.push(wbsItem);
        } else {
          wbsItem.isBacklog = true;
          backlogTasks.push(wbsItem);
        }
      }

      return { tasks, backlogTasks, isLive: true };
    }
  } catch {}

  return { tasks: [], backlogTasks: [], isLive: false };
}

/**
 * Retrieves the complete project plan state.
 */
export async function getProjectPlan(
  projectKey: string,
  storageProvider?: StorageProvider,
  referenceDate: Date = new Date(),
  siteUrl?: string
): Promise<ProjectPlanState> {
  const storage = resolveStorage(storageProvider);
  const repository = new PlanRepository(storage);

  const dynamicTimeline = getTimelineWeeks(referenceDate);
  const activeWeeks = dynamicTimeline.weeks;

  let storedScheduleMap = (await storage.get<Record<string, Partial<WbsTask>>>(`scheduleMap:${projectKey}`)) || {};
  if (hasJiraOwnedFields(storedScheduleMap)) {
    // One-time migration: entries written before B-04 held Jira-owned fields (approved [MIGRATE]).
    const migrated: Record<string, Partial<WbsTask>> = {};
    for (const [k, v] of Object.entries(storedScheduleMap)) migrated[k] = stripJiraOwnedFields(v);
    await storage.set(`scheduleMap:${projectKey}`, migrated);
    storedScheduleMap = migrated;
  }
  const storedMilestones = (await storage.get<ProjectMilestone[]>(`milestones:${projectKey}`)) || [];
  const storedWidths = (await storage.get<ColumnWidthConfig>(`colWidths:${projectKey}`)) || DEFAULT_COLUMN_WIDTHS;
  const storedHiddenColumns = (await storage.get<string[]>(`hiddenColumns:${projectKey}`)) || [];

  // Query live Jira issues and assignees
  const [liveData, availableUsers, availableEpics] = await Promise.all([
    fetchLiveJiraIssues(projectKey, storedScheduleMap),
    fetchProjectUsers(projectKey),
    fetchProjectEpics(projectKey)
  ]);

  let tasks = liveData.tasks;
  let backlogTasks = liveData.backlogTasks;

  // Fallback to repository stored plan if live sync returns empty and stored exists
  if (tasks.length === 0 && backlogTasks.length === 0) {
    const existingPlan = await repository.getProjectPlan(projectKey);
    if (existingPlan) {
      tasks = existingPlan.tasks;
      backlogTasks = existingPlan.backlogTasks || [];
    }
  }

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

  // Validate dependencies against actual predecessor progress and dates
  for (const t of tasks) {
    if (t.dependency) {
      const pred = tasks.find(p => p.key === t.dependency?.predecessorKey || p.id === t.dependency?.predecessorId);
      const evalRes = PlannerEngine.evaluateDependency(pred, t.dependency, t);
      t.dependency.isTriggerSatisfied = evalRes.isSatisfied;
      t.dependency.isViolated = evalRes.isViolated;
      t.dependency.violationReason = evalRes.blockerMessage;
      t.dependency.earliestStartDate = evalRes.earliestStartDate;
      t.dependency.earliestStartReason = evalRes.earliestStartReason;
    }
  }

  // Order tasks according to stored taskOrder and organize into WbsHierarchy
  const taskOrder = (await storage.get<string[]>(`taskOrder:${projectKey}`)) || [];
  const knownOrderKeys = new Set(taskOrder);
  const updatedTaskOrder = [...taskOrder];
  for (const t of tasks) {
    if (!knownOrderKeys.has(t.key)) {
      updatedTaskOrder.push(t.key);
      knownOrderKeys.add(t.key);
    }
  }
  if (updatedTaskOrder.length !== taskOrder.length) {
    await storage.set(`taskOrder:${projectKey}`, updatedTaskOrder);
  }

  if (updatedTaskOrder.length > 0) {
    tasks.sort((a, b) => {
      const idxA = updatedTaskOrder.indexOf(a.key);
      const idxB = updatedTaskOrder.indexOf(b.key);
      return idxA - idxB;
    });
  }
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
    siteUrl: siteUrl || (process.env.JIRA_BASE_URL || undefined)
  };

  await repository.saveProjectPlan(planState);
  return planState;
}

/**
 * Schedules an issue from the backlog shelf directly onto the timeline grid.
 */
export async function scheduleBacklogTask(
  request: ScheduleBacklogRequest,
  storageProvider?: StorageProvider
): Promise<ProjectPlanState> {
  const { projectKey, taskId, startWeek, spanWeeks = 3, effortHours, resource, targetIndex } = request;
  await verifyIssueInProject(taskId, projectKey, 'taskId');
  const storage = resolveStorage(storageProvider);

  const scheduleMap = (await storage.get<Record<string, Partial<WbsTask>>>(`scheduleMap:${projectKey}`)) || {};

  const startIdx = Math.max(0, DEFAULT_WEEKS.findIndex(w => w.weekKey === startWeek));
  const endIdx = Math.min(DEFAULT_WEEKS.length - 1, startIdx + spanWeeks - 1);
  const endWeek = DEFAULT_WEEKS[endIdx].weekKey;

  const allocations: Record<string, number> = {};
  for (let i = startIdx; i <= endIdx; i++) {
    allocations[DEFAULT_WEEKS[i].weekKey] = Math.round(100 / spanWeeks);
  }

  const current = scheduleMap[taskId] || {};
  scheduleMap[taskId] = {
    ...current,
    startWeek,
    endWeek,
    spanWeeks,
    startDate: DEFAULT_WEEKS[startIdx].startDate,
    endDate: DEFAULT_WEEKS[endIdx].endDate,
    weeklyAllocations: allocations
  };
  // Estimate and assignee are Jira-owned: an entered estimate goes to Jira, never to KVS (INV-04).
  scheduleMap[taskId] = stripJiraOwnedFields(scheduleMap[taskId]);
  void resource;

  await storage.set(`scheduleMap:${projectKey}`, scheduleMap);

  // If targetIndex is specified, insert into taskOrder
  const taskOrder = (await storage.get<string[]>(`taskOrder:${projectKey}`)) || [];
  const filteredOrder = taskOrder.filter(k => k !== taskId);
  if (typeof targetIndex === 'number' && targetIndex >= 0) {
    const insertIdx = Math.min(filteredOrder.length, targetIndex);
    filteredOrder.splice(insertIdx, 0, taskId);
  } else {
    filteredOrder.push(taskId);
  }
  await storage.set(`taskOrder:${projectKey}`, filteredOrder);

  // Sync scheduled due date and effort back to Jira issue
  const log = new SyncLog();
  await syncTaskToJira(taskId, {
    endDate: DEFAULT_WEEKS[endIdx].endDate,
    effortHours
  }, log);

  return Object.assign(await getProjectPlan(projectKey, storage), { ok: true, jiraSync: log.report() });
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
    projectKey, epic, epicKey, story, summary, effortHours,
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
  const scheduleMap = (await storage.get<Record<string, Partial<WbsTask>>>(`scheduleMap:${projectKey}`)) || {};

  const assignedStartWeek = startWeek || currentWeekKey;
  const startIdx = Math.max(0, DEFAULT_WEEKS.findIndex(w => w.weekKey === assignedStartWeek));
  const endIdx = Math.min(DEFAULT_WEEKS.length - 1, startIdx + spanWeeks - 1);
  const endWeek = DEFAULT_WEEKS[endIdx].weekKey;

  const allocations: Record<string, number> = {};
  for (let i = startIdx; i <= endIdx; i++) {
    allocations[DEFAULT_WEEKS[i].weekKey] = Math.round(100 / spanWeeks);
  }

  scheduleMap[jiraIssueKey] = {
    startWeek: assignedStartWeek,
    endWeek,
    spanWeeks,
    startDate: DEFAULT_WEEKS[startIdx].startDate,
    endDate: DEFAULT_WEEKS[endIdx].endDate,
    weeklyAllocations: allocations
  };
  void epic; void story; void resource;

  await storage.set(`scheduleMap:${projectKey}`, scheduleMap);

  // If targetIndex is specified, insert into taskOrder at targetIndex and shift rest down
  const taskOrder = (await storage.get<string[]>(`taskOrder:${projectKey}`)) || [];
  const filteredOrder = taskOrder.filter(k => k !== jiraIssueKey);
  if (typeof targetIndex === 'number' && targetIndex >= 0) {
    const insertIdx = Math.min(filteredOrder.length, targetIndex);
    filteredOrder.splice(insertIdx, 0, jiraIssueKey);
  } else {
    filteredOrder.push(jiraIssueKey);
  }
  await storage.set(`taskOrder:${projectKey}`, filteredOrder);

  // Sync scheduled due date and effort back to Jira
  const log = new SyncLog();
  await syncTaskToJira(jiraIssueKey, {
    endDate: DEFAULT_WEEKS[endIdx].endDate,
    effortHours,
    resourceAccountId,
    epicKey
  }, log);

  const plan = await getProjectPlan(projectKey, storage);
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
  log?: SyncLog
): Promise<{ synced: boolean; error?: string; fields: string[] }> {
  const result = await syncTaskFields(taskIdOrKey, updates);
  if (log) log.record(taskIdOrKey, result.fields, result);
  return result;
}

async function syncTaskFields(
  taskIdOrKey: string,
  updates: Partial<WbsTask>
): Promise<{ synced: boolean; error?: string; fields: string[] }> {
  const fields: Record<string, any> = {};

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
      return { synced: false, error: err?.message || 'Network error updating Jira issue', fields: Object.keys(fields) };
    }
  }

  const sentFields = Object.keys(fields);
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
  return { synced: syncSuccess, error: errMsg, fields: sentFields };
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
  payload: { projectKey: string; taskId: string; updates: Partial<WbsTask> },
  storageProvider?: StorageProvider
): Promise<ProjectPlanState> {
  const { projectKey, taskId, updates } = payload;
  validateTaskUpdates(updates as Record<string, unknown>);
  const storage = resolveStorage(storageProvider);
  const log = new SyncLog();

  const plan = await getProjectPlan(projectKey, storage);
  const targetTask = plan.tasks.find(t => t.id === taskId || t.key === taskId) ||
    (plan.backlogTasks || []).find(t => t.id === taskId || t.key === taskId);
  if (!targetTask) {
    throw new Error(`Task '${taskId}' not found in project plan`);
  }
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
      const rawTrigger = sanitized.dependency.triggerPercent;
      const triggerPercent = typeof rawTrigger === 'number' && !isNaN(rawTrigger) ? rawTrigger : 30;
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

  // Auto-move targetTask bar to earliest allowed week based on predecessor's fractional milestone
  if (sanitized.dependency && sanitized.dependency.predecessorKey) {
    const predTask = plan.tasks.find(t => t.key === sanitized.dependency!.predecessorKey || t.id === sanitized.dependency!.predecessorKey);
    if (predTask) {
      const earliestStartIdx = PlannerEngine.calculateEarliestStartWeekIndex(
        predTask,
        sanitized.dependency.triggerPercent,
        activeWeeks
      );
      const currentStart = sanitized.startWeek || targetTask.startWeek || activeWeeks[0].weekKey;
      const currentStartIdx = activeWeeks.findIndex(w => w.weekKey === currentStart);
      if (currentStartIdx < earliestStartIdx) {
        sanitized.startWeek = activeWeeks[earliestStartIdx].weekKey;
      }
    }
  }

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

  const scheduleMap = (await storage.get<Record<string, Partial<WbsTask>>>(`scheduleMap:${projectKey}`)) || {};
  const current = scheduleMap[targetTask.key] || {};
  const currentVersion = (current as any).version || 0;

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
    ...sanitized,
    version: currentVersion + 1
  });

  // Cascade schedule shifts to dependent tasks
  if (sanitized.startWeek || sanitized.spanWeeks || sanitized.dependency) {
    const candidateTasks = plan.tasks.map(t => (t.key === targetTask.key ? { ...t, ...sanitized } : t));
    const { updatedTasks, affectedTaskKeys } = PlannerEngine.cascadeSchedule(candidateTasks, targetTask.key, activeWeeks);
    for (const affKey of affectedTaskKeys) {
      const affTask = updatedTasks.find(t => t.key === affKey);
      if (affTask) {
        const curAff = scheduleMap[affKey] || {};
        if (affTask.dependency && !curAff.dependency) {
          curAff.dependency = affTask.dependency;
        }
        scheduleMap[affKey] = {
          ...curAff,
          startWeek: affTask.startWeek,
          endWeek: affTask.endWeek,
          startDate: affTask.startDate,
          endDate: affTask.endDate,
          weeklyAllocations: affTask.weeklyAllocations
        };
        await syncTaskToJira(affKey, { endDate: affTask.endDate }, log);
      }
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
        await syncTaskToJira(pKey, { endDate: activeWeeks[maxEndIdx].endDate }, log);
      }
    }
  }

  await storage.set(`scheduleMap:${projectKey}`, scheduleMap);
  await storage.set(`ps:${projectKey}:task:${targetTask.key}`, scheduleMap[targetTask.key]);

  // Two-way sync: write-back changed fields to Jira
  await syncTaskToJira(targetTask.key, sanitized, log);

  return Object.assign(await getProjectPlan(projectKey, storage), { ok: true, jiraSync: log.report() });
}

/**
 * Removes a task from the scheduled planner timeline and moves it back to unmapped backlog.
 */
export async function unscheduleTask(
  payload: UnscheduleTaskRequest,
  storageProvider?: StorageProvider
): Promise<ProjectPlanState> {
  const { projectKey, taskId } = payload;
  await verifyIssueInProject(taskId, projectKey, 'taskId');
  const storage = resolveStorage(storageProvider);

  const scheduleMap = (await storage.get<Record<string, Partial<WbsTask>>>(`scheduleMap:${projectKey}`)) || {};
  if (scheduleMap[taskId]) {
    delete scheduleMap[taskId].startWeek;
    delete scheduleMap[taskId].endWeek;
    delete scheduleMap[taskId].startDate;
    delete scheduleMap[taskId].endDate;
    delete scheduleMap[taskId].weeklyAllocations;
    scheduleMap[taskId].isBacklog = true;
    await storage.set(`scheduleMap:${projectKey}`, scheduleMap);
  }

  // Also remove from taskOrder
  const taskOrder = (await storage.get<string[]>(`taskOrder:${projectKey}`)) || [];
  const updatedOrder = taskOrder.filter(k => k !== taskId);
  await storage.set(`taskOrder:${projectKey}`, updatedOrder);

  return Object.assign(await getProjectPlan(projectKey, storage), { ok: true, jiraSync: noJiraWrites() });
}

/**
 * Reorders tasks within the WBS planner grid.
 */
export async function reorderWbsTasks(
  payload: ReorderTasksRequest,
  storageProvider?: StorageProvider
): Promise<ProjectPlanState> {
  const { projectKey, taskId, targetIndex } = payload;
  const storage = resolveStorage(storageProvider);

  const plan = await getProjectPlan(projectKey, storage);
  const reordered = PlannerEngine.reorderTasks(plan.tasks, taskId, targetIndex);
  const newOrder = Array.from(new Set(reordered.map(t => t.key).filter(Boolean)));

  await storage.set(`taskOrder:${projectKey}`, newOrder);
  return Object.assign(await getProjectPlan(projectKey, storage), { ok: true, jiraSync: noJiraWrites() });
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

  const scheduleMap = (await storage.get<Record<string, Partial<WbsTask>>>(`scheduleMap:${projectKey}`)) || {};
  scheduleMap[createdKey] = {
    startWeek: assignedStart,
    endWeek: activeWeeks[eIdx].weekKey,
    startDate: activeWeeks[sIdx].startDate,
    endDate: activeWeeks[eIdx].endDate,
    spanWeeks,
    weeklyAllocations: allocations
  };

  await storage.set(`scheduleMap:${projectKey}`, scheduleMap);

  // Sync estimate & duedate to newly created subtask
  const log = new SyncLog();
  log.record(createdKey, ['create'], { synced: true });
  await syncTaskToJira(createdKey, {
    effortHours,
    endDate: activeWeeks[eIdx].endDate,
    resourceAccountId
  }, log);

  const plan = await getProjectPlan(projectKey, storage);
  const subtask = plan.tasks.find(t => t.key === createdKey);
  return { success: true, ok: true, jiraSync: log.report(), subtask, plan };
}

/**
 * Adds a subtask to a parent task, re-calculating the parent effort with optional buffer.
 */
export async function addSubtaskToTask(
  payload: {
    projectKey: string;
    parentTaskId: string;
    subtask: { summary: string; estimateValue: number; estimateUnit: EstimateUnit };
    bufferType?: 'PERCENTAGE' | 'FIXED_HOURS' | 'NONE';
    bufferValue?: number;
  },
  storageProvider?: StorageProvider
): Promise<ProjectPlanState> {
  const { projectKey, parentTaskId, subtask, bufferType = 'NONE', bufferValue = 0 } = payload;
  await verifyIssueInProject(parentTaskId, projectKey, 'parentTaskId');
  const storage = resolveStorage(storageProvider);

  const scheduleMap = (await storage.get<Record<string, Partial<WbsTask>>>(`scheduleMap:${projectKey}`)) || {};
  const current = scheduleMap[parentTaskId] || {};
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

  scheduleMap[parentTaskId] = {
    ...current,
    subtasks: updatedSubtasks,
    effortHours: effortConfig.totalCalculatedHours,
    effortConfig
  };

  await storage.set(`scheduleMap:${projectKey}`, scheduleMap);
  return Object.assign(await getProjectPlan(projectKey, storage), { ok: true, jiraSync: noJiraWrites() });
}

/**
 * Saves an inter-task fractional dependency.
 */
export async function saveTaskDependency(
  payload: { projectKey: string; taskId: string; dependency: TaskDependency },
  storageProvider?: StorageProvider
): Promise<ProjectPlanState> {
  const { projectKey, taskId, dependency } = payload;
  validateDependencyPayload(dependency);
  const storage = resolveStorage(storageProvider);

  const plan = await getProjectPlan(projectKey, storage);
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

  const scheduleMap = (await storage.get<Record<string, Partial<WbsTask>>>(`scheduleMap:${projectKey}`)) || {};
  const current = scheduleMap[targetTask.key] || {};
  scheduleMap[targetTask.key] = {
    ...current,
    dependency: ownedLinkId ? { ...dependency, jiraLinkId: ownedLinkId } : dependency
  };

  await storage.set(`scheduleMap:${projectKey}`, scheduleMap);
  await storage.set(`ps:${projectKey}:task:${targetTask.key}`, scheduleMap[targetTask.key]);

  return Object.assign(await getProjectPlan(projectKey, storage), { ok: true, jiraSync: log.report() });
}

/**
 * Saves column width configurations.
 */
export async function saveColumnWidths(
  payload: { projectKey: string; columnWidths: ColumnWidthConfig },
  storageProvider?: StorageProvider
): Promise<{ success: boolean; ok: boolean; jiraSync: JiraSyncReport; columnWidths: ColumnWidthConfig }> {
  const { projectKey, columnWidths } = payload;
  validateColumnWidths(columnWidths as unknown as Record<string, unknown>);
  const storage = resolveStorage(storageProvider);
  await storage.set(`colWidths:${projectKey}`, columnWidths);
  return { success: true, ok: true, jiraSync: noJiraWrites(), columnWidths };
}

/**
 * Saves hidden columns configuration.
 */
export async function saveHiddenColumns(
  payload: { projectKey: string; hiddenColumns: string[] },
  storageProvider?: StorageProvider
): Promise<{ success: boolean; ok: boolean; jiraSync: JiraSyncReport; hiddenColumns: string[] }> {
  const { projectKey, hiddenColumns } = payload;
  validateHiddenColumns(hiddenColumns);
  const storage = resolveStorage(storageProvider);
  const cols = Array.isArray(hiddenColumns) ? hiddenColumns : [];
  await storage.set(`hiddenColumns:${projectKey}`, cols);
  return { success: true, ok: true, jiraSync: noJiraWrites(), hiddenColumns: cols };
}

/**
 * Saves a milestone marker.
 */
export async function saveProjectMilestone(
  payload: { projectKey: string; milestone: ProjectMilestone },
  storageProvider?: StorageProvider
): Promise<{ success: boolean; ok: boolean; jiraSync: JiraSyncReport; milestones: ProjectMilestone[] }> {
  const { projectKey, milestone } = payload;
  validateMilestone(milestone as unknown as Record<string, unknown>);
  const storage = resolveStorage(storageProvider);
  const current = (await storage.get<ProjectMilestone[]>(`milestones:${projectKey}`)) || DEFAULT_MILESTONES;
  const filtered = current.filter(m => m.id !== milestone.id);
  filtered.push(milestone);
  await storage.set(`milestones:${projectKey}`, filtered);
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
  const repository = new PlanRepository(storage);

  const plan = await getProjectPlan(projectKey, storage, referenceDate);
  let metadata = await repository.getResourceMetadata(projectKey);
  if (!metadata) {
    metadata = DEFAULT_RESOURCE_METADATA;
    await repository.saveResourceMetadata(projectKey, metadata);
  }

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

export function extractSiteUrl(req: any): string | undefined {
  const contextUrl = req?.context?.siteUrl;
  if (contextUrl && typeof contextUrl === 'string' && contextUrl.trim().length > 0) {
    return contextUrl.trim();
  }
  return undefined;
}

// Register Forge Resolvers
const resolver = new Resolver();

resolver.define('getProjectPlan', async (req) => withValidation(() => getProjectPlan(extractProjectKey(req), undefined, new Date(), extractSiteUrl(req))));

resolver.define('scheduleBacklogTask', async (req) => withValidation(() => scheduleBacklogTask({ ...req.payload, projectKey: extractProjectKey(req) })));

resolver.define('createInlineTask', async (req) => withValidation(() => createInlineTask({ ...req.payload, projectKey: extractProjectKey(req) })));

resolver.define('createJiraEpic', async (req) => withValidation(() => createJiraEpic({ ...req.payload, projectKey: extractProjectKey(req) })));

resolver.define('updateWbsTask', async (req) => {
  try {
    return await withValidation(() => updateWbsTask({ ...req.payload, projectKey: extractProjectKey(req) }));
  } catch (err: any) {
    return { success: false, error: err?.message || 'Failed to update task' };
  }
});

resolver.define('addSubtaskToTask', async (req) => withValidation(() => addSubtaskToTask({ ...req.payload, projectKey: extractProjectKey(req) })));

resolver.define('saveTaskDependency', async (req) => withValidation(() => saveTaskDependency({ ...req.payload, projectKey: extractProjectKey(req) })));

resolver.define('saveColumnWidths', async (req) => withValidation(() => saveColumnWidths({ ...req.payload, projectKey: extractProjectKey(req) })));

resolver.define('saveHiddenColumns', async (req) => withValidation(() => saveHiddenColumns({ ...req.payload, projectKey: extractProjectKey(req) })));

resolver.define('saveProjectMilestone', async (req) => withValidation(() => saveProjectMilestone({ ...req.payload, projectKey: extractProjectKey(req) })));

resolver.define('getPortfolioResourceHeatmap', async (req) => withValidation(() => getPortfolioResourceHeatmap(extractProjectKey(req), req.payload?.filters)));

resolver.define('unscheduleTask', async (req) => withValidation(() => unscheduleTask({ ...req.payload, projectKey: extractProjectKey(req) })));

resolver.define('reorderWbsTasks', async (req) => withValidation(() => reorderWbsTasks({ ...req.payload, projectKey: extractProjectKey(req) })));

resolver.define('createSubtaskForResource', async (req) => withValidation(() => createSubtaskForResource({ ...req.payload, projectKey: extractProjectKey(req) })));

export const handler = resolver.getDefinitions();
