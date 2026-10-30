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
  ResourceUtilizationProfile,
  PortfolioResourceHeatmapRow,
  ProjectMilestone,
  JiraAssignableUser,
  JiraEpicItem,
  ColumnWidthConfig,
  SubtaskItem,
  TaskEffortConfig,
  EstimateUnit,
  CURRENT_WEEK_INDEX,
  DEFAULT_STORY_POINT_RATIO
} from './domain/models';
import { PlannerEngine } from './domain/planner-engine';
import { PlanRepository, StorageProvider } from './storage/plan-repository';

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

export function getTimelineWeeks(referenceDate: Date = new Date()): { weeks: WeeklySprintColumn[]; currentWeekIndex: number } {
  return PlannerEngine.generateDynamicWeeks(referenceDate, 4, 10);
}

export const DEFAULT_WEEKS: WeeklySprintColumn[] = getTimelineWeeks(new Date('2026-10-30')).weeks;

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

export const DEFAULT_MILESTONES: ProjectMilestone[] = [
  { id: 'm-1', title: 'Architecture Baseline', date: '2026-10-14', weekKey: '14-Oct', type: 'GATE', isPassed: true },
  { id: 'm-2', title: 'Beta Feature Freeze', date: '2026-11-18', weekKey: '18-Nov', type: 'TARGET', isPassed: false },
  { id: 'm-3', title: 'Production Cutover', date: '2026-12-23', weekKey: '23-Dec', type: 'RELEASE', isPassed: false }
];

export const PLACEHOLDER_USERS: JiraAssignableUser[] = [
  { accountId: 'ph:res-1', displayName: 'Resource 1 (Placeholder)', isPlaceholder: true },
  { accountId: 'ph:res-2', displayName: 'Resource 2 (Placeholder)', isPlaceholder: true },
  { accountId: 'ph:fe-lead', displayName: 'Frontend Lead (Placeholder)', isPlaceholder: true },
  { accountId: 'ph:be-lead', displayName: 'Backend Lead (Placeholder)', isPlaceholder: true },
  { accountId: 'ph:qa-lead', displayName: 'QA Automation Lead (Placeholder)', isPlaceholder: true },
  { accountId: 'ph:devops', displayName: 'DevOps & SRE (Placeholder)', isPlaceholder: true }
];

export const DEFAULT_RESOURCE_METADATA: Record<string, { coe: string; vertical: string; project: string }> = {
  'Resource 1': { coe: 'Backend & Cloud', vertical: 'Fintech Core', project: 'Project 1' },
  'Resource 2': { coe: 'Frontend & UI/UX', vertical: 'Customer Portal', project: 'Project 1' },
  'Resource 3': { coe: 'QA Automation', vertical: 'Quality & SRE', project: 'Project 2' },
  'Resource 4': { coe: 'Data & Analytics', vertical: 'Business Intelligence', project: 'Project 2' },
  'Resource 5': { coe: 'Security & Compliance', vertical: 'Enterprise Risk', project: 'Project 3' },
  'Resource 6': { coe: 'DevOps & SRE', vertical: 'Infrastructure', project: 'Project 3' }
};

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

/**
 * Fetches real Jira project assignees and merges with placeholders.
 */
export async function fetchProjectUsers(projectKey: string): Promise<JiraAssignableUser[]> {
  const users: JiraAssignableUser[] = [...PLACEHOLDER_USERS];
  try {
    const res = await api.asApp().requestJira(route`/rest/api/3/user/assignable/search?project=${projectKey}&maxResults=50`);
    if (res.status === 200) {
      const data: any[] = await res.json();
      for (const u of data) {
        if (u.accountId && u.displayName) {
          users.push({
            accountId: u.accountId,
            displayName: u.displayName,
            avatarUrl: u.avatarUrls?.['24x24'] || u.avatarUrls?.['48x48'],
            isPlaceholder: false
          });
        }
      }
    }
  } catch {}
  return users;
}

/**
 * Fetches real Jira project Epics.
 */
export async function fetchProjectEpics(projectKey: string): Promise<JiraEpicItem[]> {
  const epics: JiraEpicItem[] = [];
  try {
    const res = await api.asApp().requestJira(
      route`/rest/api/3/search/jql?jql=project = "${projectKey}" AND issuetype in (Epic, "Initiative") order by created desc&fields=summary,status&maxResults=50`
    );
    if (res.status === 200) {
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
      route`/rest/api/3/search/jql?jql=project = "${projectKey}" order by created desc&fields=summary,status,issuetype,assignee,timeoriginalestimate,aggregatetimespent,duedate,parent,subtasks&maxResults=100`
    );

    if (res.status === 200) {
      const data = await res.json();
      const rawIssues: any[] = data.issues || [];

      const tasks: WbsTask[] = [];
      const backlogTasks: WbsTask[] = [];

      for (const iss of rawIssues) {
        const key = String(iss.key);
        const id = String(iss.id);
        const summary = iss.fields?.summary || key;
        const typeName = iss.fields?.issuetype?.name || 'Task';
        const epicName = iss.fields?.parent?.fields?.summary || (typeName === 'Epic' ? summary : 'Prerequisites');
        const epicKey = iss.fields?.parent?.key;
        const status = mapJiraStatus(iss.fields?.status?.statusCategory?.key, iss.fields?.status?.name);

        const rawSeconds = iss.fields?.timeoriginalestimate || 0;
        const effortHours = rawSeconds > 0 ? Math.round(rawSeconds / 3600) : 40;

        let progress = 0;
        if (status === 'COMPLETED') {
          progress = 100;
        } else if (status === 'IN_PROGRESS') {
          progress = 30;
        }

        const subtasks: SubtaskItem[] = (iss.fields?.subtasks || []).map((sub: any) => ({
          id: String(sub.id),
          key: String(sub.key),
          summary: sub.fields?.summary || 'Subtask',
          estimateValue: 8,
          estimateUnit: 'HOURS' as const,
          normalizedHours: 8,
          status: mapJiraStatus(sub.fields?.status?.statusCategory?.key, sub.fields?.status?.name)
        }));

        const stored = storedScheduleMap[key] || storedScheduleMap[id];

        const finalSubtasks: SubtaskItem[] = (stored?.subtasks && stored.subtasks.length > 0)
          ? stored.subtasks
          : subtasks;

        const calculatedEffortConfig = PlannerEngine.calculateEffortWithSubtasksAndBuffer({
          unit: 'HOURS',
          rawEstimate: stored?.effortHours !== undefined ? stored.effortHours : effortHours,
          subtasks: finalSubtasks,
          bufferType: 'NONE'
        });

        const effortConfig = stored?.effortConfig || calculatedEffortConfig;
        const totalHours = stored?.effortHours !== undefined
          ? stored.effortHours
          : effortConfig.totalCalculatedHours;

        const wbsItem: WbsTask = {
          id,
          key,
          summary: stored?.summary || summary,
          epic: stored?.epic || epicName,
          epicKey,
          story: stored?.story || typeName,
          storyKey: key,
          effortHours: totalHours,
          effortConfig,
          resource: (stored?.resource || iss.fields?.assignee?.displayName || 'Resource 1'),
          resourceAccountId: stored?.resourceAccountId || iss.fields?.assignee?.accountId,
          progress: stored?.progress !== undefined ? stored.progress : progress,
          targetProgress: stored?.targetProgress !== undefined ? stored.targetProgress : 20,
          status: stored?.status || status,
          startDate: stored?.startDate || '2026-08-05',
          endDate: stored?.endDate || '2026-09-16',
          startWeek: stored?.startWeek,
          endWeek: stored?.endWeek,
          spanWeeks: stored?.spanWeeks || 4,
          weeklyAllocations: stored?.weeklyAllocations || { '05-Aug': 50, '12-Aug': 50, '19-Aug': 50, '26-Aug': 50 },
          dependency: stored?.dependency,
          subtasks: finalSubtasks
        };

        const hasCustomSchedule = Object.keys(storedScheduleMap).length > 0;
        const autoSchedule = !hasCustomSchedule && (tasks.length < 6);

        if (wbsItem.startWeek || autoSchedule) {
          if (!wbsItem.startWeek) {
            const weekIdx = Math.min(DEFAULT_WEEKS.length - 4, tasks.length * 2);
            wbsItem.startWeek = DEFAULT_WEEKS[weekIdx].weekKey;
            wbsItem.endWeek = DEFAULT_WEEKS[weekIdx + 3].weekKey;
            wbsItem.spanWeeks = 4;
            wbsItem.startDate = DEFAULT_WEEKS[weekIdx].startDate;
            wbsItem.endDate = DEFAULT_WEEKS[weekIdx + 3].endDate;
            wbsItem.weeklyAllocations = {
              [DEFAULT_WEEKS[weekIdx].weekKey]: 25,
              [DEFAULT_WEEKS[weekIdx + 1].weekKey]: 25,
              [DEFAULT_WEEKS[weekIdx + 2].weekKey]: 25,
              [DEFAULT_WEEKS[weekIdx + 3].weekKey]: 25
            };
            if (tasks.length > 0) {
              const prev = tasks[tasks.length - 1];
              wbsItem.dependency = {
                predecessorId: prev.id,
                predecessorKey: prev.key,
                triggerPercent: 30,
                isTriggerSatisfied: prev.progress >= 30,
                isViolated: false
              };
            }
          }
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
  storageProvider?: StorageProvider
): Promise<ProjectPlanState> {
  const storage = resolveStorage(storageProvider);
  const repository = new PlanRepository(storage);

  const storedScheduleMap = (await storage.get<Record<string, Partial<WbsTask>>>(`scheduleMap:${projectKey}`)) || {};
  const storedMilestones = (await storage.get<ProjectMilestone[]>(`milestones:${projectKey}`)) || DEFAULT_MILESTONES;
  const storedWidths = (await storage.get<ColumnWidthConfig>(`colWidths:${projectKey}`)) || DEFAULT_COLUMN_WIDTHS;

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
        epic: stored.epic || 'General',
        epicKey: stored.epicKey,
        story: stored.story || 'Task',
        storyKey: key,
        effortHours: stored.effortHours || 40,
        resource: stored.resource || 'Resource 1',
        resourceAccountId: stored.resourceAccountId,
        progress: stored.progress || 0,
        targetProgress: stored.targetProgress || 20,
        status: stored.status || 'NOT_STARTED',
        startDate: stored.startDate || '2026-08-05',
        endDate: stored.endDate || '2026-08-26',
        startWeek: stored.startWeek || '05-Aug',
        endWeek: stored.endWeek || '26-Aug',
        spanWeeks: stored.spanWeeks || 4,
        weeklyAllocations: stored.weeklyAllocations || { '05-Aug': 50, '12-Aug': 50, '19-Aug': 50, '26-Aug': 50 },
        dependency: stored.dependency,
        subtasks: stored.subtasks || []
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

  const { actualCompletion, targetCompletion } = PlannerEngine.calculateProjectCompletion(tasks);

  const planState: ProjectPlanState = {
    planId: `plan-${projectKey}`,
    projectKey,
    projectName: `Project ${projectKey}`,
    overallProjectCompletion: actualCompletion,
    overallTargetCompletion: targetCompletion,
    weeks: DEFAULT_WEEKS,
    tasks,
    backlogTasks,
    milestones: storedMilestones,
    columnWidths: storedWidths,
    availableEpics,
    availableUsers,
    lastUpdated: new Date().toISOString(),
    isLiveSynced: liveData.isLive
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
  const { projectKey, taskId, startWeek, spanWeeks = 3, effortHours = 40, resource } = request;
  const storage = resolveStorage(storageProvider);

  const scheduleMap = (await storage.get<Record<string, Partial<WbsTask>>>(`scheduleMap:${projectKey}`)) || {};

  const startIdx = Math.max(0, DEFAULT_WEEKS.findIndex(w => w.weekKey === startWeek));
  const endIdx = Math.min(DEFAULT_WEEKS.length - 1, startIdx + spanWeeks - 1);
  const endWeek = DEFAULT_WEEKS[endIdx].weekKey;

  const allocations: Record<string, number> = {};
  for (let i = startIdx; i <= endIdx; i++) {
    allocations[DEFAULT_WEEKS[i].weekKey] = Math.round(100 / spanWeeks);
  }

  scheduleMap[taskId] = {
    startWeek,
    endWeek,
    spanWeeks,
    startDate: DEFAULT_WEEKS[startIdx].startDate,
    endDate: DEFAULT_WEEKS[endIdx].endDate,
    effortHours,
    resource: resource || 'Resource 1',
    weeklyAllocations: allocations
  };

  await storage.set(`scheduleMap:${projectKey}`, scheduleMap);

  return await getProjectPlan(projectKey, storage);
}

/**
 * Creates a new Jira issue and places it on the schedule or backlog.
 */
export async function createInlineTask(
  request: InlineTaskCreateRequest,
  storageProvider?: StorageProvider
): Promise<{ success: boolean; task?: WbsTask; plan?: ProjectPlanState; error?: string }> {
  const { projectKey, epic, story, summary, effortHours = 40, resource = 'Resource 1', startWeek, spanWeeks = 3 } = request;

  let jiraIssueId = '';
  let jiraIssueKey = '';

  try {
    let res: any;
    const body = {
      fields: {
        project: { key: projectKey },
        summary,
        issuetype: { name: 'Task' }
      }
    };

    const caller = getJiraCaller();
    res = await caller.requestJira(route`/rest/api/3/issue`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });

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
      return { success: false, error: errMsg };
    }

    const data = await res.json();
    jiraIssueId = String(data.id);
    jiraIssueKey = String(data.key);
  } catch (err: any) {
    return { success: false, error: err?.message || 'Network error while contacting Jira' };
  }

  const storage = resolveStorage(storageProvider);
  const scheduleMap = (await storage.get<Record<string, Partial<WbsTask>>>(`scheduleMap:${projectKey}`)) || {};

  const assignedStartWeek = startWeek || '05-Aug';
  const startIdx = Math.max(0, DEFAULT_WEEKS.findIndex(w => w.weekKey === assignedStartWeek));
  const endIdx = Math.min(DEFAULT_WEEKS.length - 1, startIdx + spanWeeks - 1);
  const endWeek = DEFAULT_WEEKS[endIdx].weekKey;

  const allocations: Record<string, number> = {};
  for (let i = startIdx; i <= endIdx; i++) {
    allocations[DEFAULT_WEEKS[i].weekKey] = Math.round(100 / spanWeeks);
  }

  scheduleMap[jiraIssueKey] = {
    summary,
    epic: epic || 'General',
    story: story || 'Task',
    startWeek: assignedStartWeek,
    endWeek,
    spanWeeks,
    startDate: DEFAULT_WEEKS[startIdx].startDate,
    endDate: DEFAULT_WEEKS[endIdx].endDate,
    effortHours,
    resource,
    weeklyAllocations: allocations
  };

  await storage.set(`scheduleMap:${projectKey}`, scheduleMap);
  const plan = await getProjectPlan(projectKey, storage);
  const createdTask = plan.tasks.find(t => t.key === jiraIssueKey) || plan.tasks[0];

  return { success: true, task: createdTask, plan };
}

/**
 * Creates a new Jira Epic.
 */
export async function createJiraEpic(
  payload: { projectKey: string; summary: string },
  storageProvider?: StorageProvider
): Promise<{ success: boolean; epic?: JiraEpicItem; error?: string }> {
  const { projectKey, summary } = payload;
  try {
    let res: any;
    const body = {
      fields: {
        project: { key: projectKey },
        summary,
        issuetype: { name: 'Epic' }
      }
    };

    const caller = getJiraCaller();
    res = await caller.requestJira(route`/rest/api/3/issue`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });

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
      return { success: false, error: errMsg };
    }

    const data = await res.json();
    return {
      success: true,
      epic: { id: String(data.id), key: String(data.key), summary }
    };
  } catch (err: any) {
    return {
      success: false,
      error: err?.message || 'Network error while contacting Jira'
    };
  }
}

/**
 * Synchronizes task edits back to Jira Cloud (two-way sync).
 */
export async function syncTaskToJira(
  taskIdOrKey: string,
  updates: Partial<WbsTask>
): Promise<{ synced: boolean; error?: string }> {
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

  if (updates.resourceAccountId && !updates.resourceAccountId.startsWith('ph:')) {
    fields.assignee = {
      accountId: updates.resourceAccountId
    };
  }

  if (Object.keys(fields).length === 0) {
    return { synced: true };
  }

  try {
    const caller = getJiraCaller();
    const res = await caller.requestJira(route`/rest/api/3/issue/${taskIdOrKey}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ fields })
    });

    if (res && res.status >= 200 && res.status < 300) {
      return { synced: true };
    } else {
      let errMsg = `Jira status ${res?.status || 500}`;
      try {
        const errJson = await res.json();
        if (errJson.errorMessages && errJson.errorMessages.length > 0) {
          errMsg = errJson.errorMessages.join(', ');
        } else if (errJson.errors && Object.keys(errJson.errors).length > 0) {
          errMsg = Object.values(errJson.errors).join(', ');
        } else {
          errMsg = JSON.stringify(errJson);
        }
      } catch {}
      return { synced: false, error: errMsg };
    }
  } catch (err: any) {
    return { synced: false, error: err?.message };
  }
}

/**
 * Mirrors dependency links into native Jira issue links.
 */
export async function mirrorDependencyToJira(
  successorKey: string,
  predecessorKey: string
): Promise<{ linked: boolean; error?: string }> {
  try {
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
    return { linked: res?.status === 201 };
  } catch (err: any) {
    return { linked: false, error: err?.message };
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
  const storage = resolveStorage(storageProvider);

  const plan = await getProjectPlan(projectKey, storage);
  const targetTask = plan.tasks.find(t => t.id === taskId || t.key === taskId) ||
    (plan.backlogTasks || []).find(t => t.id === taskId || t.key === taskId);
  if (!targetTask) {
    throw new Error(`Task '${taskId}' not found in project plan`);
  }

  const ALLOWED_KEYS = [
    'summary', 'epic', 'story', 'effortHours', 'effortConfig', 'resource',
    'resourceAccountId', 'progress', 'targetProgress', 'status', 'startDate',
    'endDate', 'startWeek', 'endWeek', 'spanWeeks', 'weeklyAllocations', 'subtasks'
  ];
  const sanitized: Partial<WbsTask> = {};
  for (const k of ALLOWED_KEYS) {
    if ((updates as any)[k] !== undefined) {
      (sanitized as any)[k] = (updates as any)[k];
    }
  }

  const scheduleMap = (await storage.get<Record<string, Partial<WbsTask>>>(`scheduleMap:${projectKey}`)) || {};
  const current = scheduleMap[targetTask.key] || {};
  const currentVersion = (current as any).version || 0;

  scheduleMap[targetTask.key] = {
    ...current,
    ...sanitized,
    version: currentVersion + 1
  };

  await storage.set(`scheduleMap:${projectKey}`, scheduleMap);
  await storage.set(`ps:${projectKey}:task:${targetTask.key}`, scheduleMap[targetTask.key]);

  // Two-way sync: write-back changed fields to Jira
  await syncTaskToJira(targetTask.key, sanitized);

  return await getProjectPlan(projectKey, storage);
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
  return await getProjectPlan(projectKey, storage);
}

/**
 * Saves an inter-task fractional dependency.
 */
export async function saveTaskDependency(
  payload: { projectKey: string; taskId: string; dependency: TaskDependency },
  storageProvider?: StorageProvider
): Promise<ProjectPlanState> {
  const { projectKey, taskId, dependency } = payload;
  const storage = resolveStorage(storageProvider);

  const plan = await getProjectPlan(projectKey, storage);
  const targetTask = plan.tasks.find(t => t.id === taskId || t.key === taskId) ||
    (plan.backlogTasks || []).find(t => t.id === taskId || t.key === taskId);
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

  const scheduleMap = (await storage.get<Record<string, Partial<WbsTask>>>(`scheduleMap:${projectKey}`)) || {};
  const current = scheduleMap[targetTask.key] || {};
  scheduleMap[targetTask.key] = {
    ...current,
    dependency
  };

  await storage.set(`scheduleMap:${projectKey}`, scheduleMap);
  await storage.set(`ps:${projectKey}:task:${targetTask.key}`, scheduleMap[targetTask.key]);

  // Mirror dependency to native Jira issue link
  await mirrorDependencyToJira(targetTask.key, dependency.predecessorKey);

  return await getProjectPlan(projectKey, storage);
}

/**
 * Saves column width configurations.
 */
export async function saveColumnWidths(
  payload: { projectKey: string; columnWidths: ColumnWidthConfig },
  storageProvider?: StorageProvider
): Promise<{ success: boolean; columnWidths: ColumnWidthConfig }> {
  const { projectKey, columnWidths } = payload;
  const storage = resolveStorage(storageProvider);
  await storage.set(`colWidths:${projectKey}`, columnWidths);
  return { success: true, columnWidths };
}

/**
 * Saves a milestone marker.
 */
export async function saveProjectMilestone(
  payload: { projectKey: string; milestone: ProjectMilestone },
  storageProvider?: StorageProvider
): Promise<{ success: boolean; milestones: ProjectMilestone[] }> {
  const { projectKey, milestone } = payload;
  const storage = resolveStorage(storageProvider);
  const current = (await storage.get<ProjectMilestone[]>(`milestones:${projectKey}`)) || DEFAULT_MILESTONES;
  const filtered = current.filter(m => m.id !== milestone.id);
  filtered.push(milestone);
  await storage.set(`milestones:${projectKey}`, filtered);
  return { success: true, milestones: filtered };
}

/**
 * Retrieves the portfolio-wide executive resource heatmap.
 */
export async function getPortfolioResourceHeatmap(
  projectKey: string,
  filters: { project?: string; coe?: string; vertical?: string } = {},
  storageProvider?: StorageProvider
): Promise<{ rows: PortfolioResourceHeatmapRow[]; weeks: WeeklySprintColumn[] }> {
  const storage = resolveStorage(storageProvider);
  const repository = new PlanRepository(storage);

  const plan = await getProjectPlan(projectKey, storage);
  let metadata = await repository.getResourceMetadata(projectKey);
  if (!metadata) {
    metadata = DEFAULT_RESOURCE_METADATA;
    await repository.saveResourceMetadata(projectKey, metadata);
  }

  const profiles = PlannerEngine.calculateResourceUtilization(plan.tasks, plan.weeks, CURRENT_WEEK_INDEX, plan.projectName);
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

// Register Forge Resolvers
const resolver = new Resolver();

resolver.define('getProjectPlan', async (req) => {
  return await getProjectPlan(extractProjectKey(req));
});

resolver.define('scheduleBacklogTask', async (req) => {
  return await scheduleBacklogTask({ ...req.payload, projectKey: extractProjectKey(req) });
});

resolver.define('createInlineTask', async (req) => {
  return await createInlineTask({ ...req.payload, projectKey: extractProjectKey(req) });
});

resolver.define('createJiraEpic', async (req) => {
  return await createJiraEpic({ ...req.payload, projectKey: extractProjectKey(req) });
});

resolver.define('updateWbsTask', async (req) => {
  return await updateWbsTask({ ...req.payload, projectKey: extractProjectKey(req) });
});

resolver.define('addSubtaskToTask', async (req) => {
  return await addSubtaskToTask({ ...req.payload, projectKey: extractProjectKey(req) });
});

resolver.define('saveTaskDependency', async (req) => {
  return await saveTaskDependency({ ...req.payload, projectKey: extractProjectKey(req) });
});

resolver.define('saveColumnWidths', async (req) => {
  return await saveColumnWidths({ ...req.payload, projectKey: extractProjectKey(req) });
});

resolver.define('saveProjectMilestone', async (req) => {
  return await saveProjectMilestone({ ...req.payload, projectKey: extractProjectKey(req) });
});

resolver.define('getPortfolioResourceHeatmap', async (req) => {
  return await getPortfolioResourceHeatmap(extractProjectKey(req), req.payload?.filters);
});

export const handler = resolver.getDefinitions();
