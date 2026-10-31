/**
 * CascadePlan: Domain Data Models
 * Supports flexible estimation (Hours, Story Points, T-Shirts), subtask rollups with buffers,
 * authentic Jira assignee typeahead / placeholders, existing & new Epics,
 * visual Gantt with "Today" line and milestones, resizable columns, and fractional dependencies.
 */

export type TaskStatus = 'NOT_STARTED' | 'IN_PROGRESS' | 'COMPLETED';

export type EstimateUnit = 'HOURS' | 'STORY_POINTS' | 'TSHIRT';

export type TShirtSize = 'XS' | 'S' | 'M' | 'L' | 'XL';

export type BufferType = 'PERCENTAGE' | 'FIXED_HOURS' | 'NONE';

export interface SubtaskItem {
  id: string;
  key?: string;
  summary: string;
  estimateValue: number;
  estimateUnit: EstimateUnit;
  normalizedHours: number;
  status: TaskStatus;
  assignee?: string;
}

export interface TaskEffortConfig {
  unit: EstimateUnit;
  rawEstimate: number; // e.g. 5 points, or 16 hours, or size ordinal
  tshirtSize?: TShirtSize;
  hoursConversionRatio?: number; // default 8h per story point
  subtasks: SubtaskItem[];
  subtasksSumHours: number;
  bufferType: BufferType;
  bufferValue: number; // e.g. 15 (%) or 10 (hours)
  bufferHours: number;
  totalCalculatedHours: number;
}

export type CellVisualState =
  | 'COMPLETED'       // Green: Task completed or progress achieved
  | 'BEHIND_SCHEDULE' // Red: Delay / actual progress < target progress
  | 'PLANNED_LEFT'    // Light Blue: Planned remaining time
  | 'EMPTY';          // White: No allocation

export type UtilizationState =
  | 'PAST_UTILIZED'   // Green: 100% past completed utilization
  | 'UNDER_UTILIZED'  // Red: Under 100% during active sprint / delay
  | 'OVER_ALLOCATED'  // Red: Over 100% burnout warning
  | 'FUTURE_PLANNED'  // Light Blue: 100% future planned work
  | 'UNPLANNED';      // Yellow: 0% bench capacity / unallocated

export interface TaskDependency {
  predecessorId: string;
  predecessorKey: string;
  triggerPercent: number; // e.g. 30 -> Can start when predecessor reaches 30%
  isTriggerSatisfied: boolean;
  isViolated?: boolean;
  violationReason?: string;
  earliestStartDate?: string;
  earliestStartReason?: string;
  notes?: string;
  jiraLinkId?: string; // id of the "Blocks" link that CascadePlan created for this dependency
}

export interface WbsTask {
  id: string;
  key: string;
  summary: string;
  epic: string;
  epicKey?: string;
  story: string;
  storyKey?: string;
  effortHours: number;
  effortConfig?: TaskEffortConfig;
  resource: string;
  resourceAccountId?: string;
  isPlaceholderResource?: boolean;
  progress: number;       // Actual progress (0 - 100%)
  targetProgress: number; // Target progress (0 - 100%)
  status: TaskStatus;
  startDate: string;      // YYYY-MM-DD
  endDate: string;        // YYYY-MM-DD
  startWeek?: string;     // weekKey, e.g. "05-Aug"
  endWeek?: string;       // weekKey, e.g. "26-Aug"
  spanWeeks?: number;     // number of weeks duration
  weeklyAllocations?: Record<string, number>; // weekKey -> % of week effort (e.g. { '15-Jul': 50 })
  dependency?: TaskDependency | null; // null: the user removed it; a Jira link must not bring it back
  isBacklog?: boolean;
  subtasks?: SubtaskItem[];
  parentId?: string;
  parentKey?: string;
  isSubtask?: boolean;
  isEpic?: boolean;
  hierarchyLevel?: number; // 1 = Epic, 0 = Story/Task, -1 = Subtask
  childrenCount?: number;
  isRollup?: boolean;
  rollupStats?: WbsHierarchyStats;
  contributingResources?: string[];
  manualProgress?: boolean;
  isExpanded?: boolean;
  orderIndex?: number;
  version?: number;
}

export interface WbsHierarchyStats {
  startDate: string;
  endDate: string;
  totalHours: number;
  completedHours: number;
  progressPct: number;
  startWeek?: string;
  endWeek?: string;
  spanWeeks?: number;
  childrenCount: number;
  contributingResources?: string[];
}

export interface WeeklySprintColumn {
  weekKey: string;     // e.g. "15-Jul", "22-Jul"
  sprintName: string;  // e.g. "Sprint 0", "Sprint 1", "Env Delay"
  startDate: string;   // YYYY-MM-DD
  endDate: string;     // YYYY-MM-DD
  isCurrentWeek?: boolean;
}

export interface ProjectMilestone {
  id: string;
  title: string;
  date: string; // YYYY-MM-DD
  weekKey: string;
  type: 'GATE' | 'RELEASE' | 'TARGET';
  isPassed?: boolean;
}

export interface JiraAssignableUser {
  accountId: string;
  displayName: string;
  avatarUrl?: string;
  isPlaceholder?: boolean;
}

export interface JiraEpicItem {
  id: string;
  key: string;
  summary: string;
  color?: string;
}

export interface ColumnWidthConfig {
  epic: number;
  story: number;
  task: number;
  resource: number;
  effort: number;
  progress: number;
  target: number;
  status: number;
}

export interface ProjectPlanState {
  planId: string;
  projectKey: string;
  projectName: string;
  overallProjectCompletion: number; // Weighted actual completion %
  overallTargetCompletion: number;  // Weighted expected completion %
  weeks: WeeklySprintColumn[];
  tasks: WbsTask[];
  backlogTasks?: WbsTask[];         // Unmapped Jira backlog issues
  milestones?: ProjectMilestone[];  // Visual milestone markers
  columnWidths?: ColumnWidthConfig; // User-adjusted column widths
  availableEpics?: JiraEpicItem[];  // Real project Epics
  availableUsers?: JiraAssignableUser[]; // Real project assignees
  lastUpdated: string;
  isLiveSynced?: boolean;
  siteUrl?: string;
  hiddenColumns?: string[];
  ok?: boolean;                     // set by write resolvers (B-07)
  jiraSync?: JiraSyncReport;        // set by write resolvers (B-07)
}

export interface JiraWriteRecord {
  key: string;
  fields: string[];
  ok: boolean;
  error?: string;
}

export interface JiraSyncReport {
  ok: boolean;
  error?: string;
  writes: JiraWriteRecord[];
}

export interface ResourceProjectAllocation {
  projectName: string;
  epic: string;
  story: string;
  task: string;
  effortHours: number;
  progress: number;
  targetProgress: number;
  status: TaskStatus;
  startDate: string;
  endDate: string;
  weeklyWorkload: Record<string, number>; // weekKey -> %
}

export interface ResourceUtilizationProfile {
  resourceName: string;
  resourceAccountId?: string;
  allocations: ResourceProjectAllocation[];
  overallWeeklyUtilization: Record<string, number>; // weekKey -> total % (e.g. 100, 50, 0)
  overallWeeklyState: Record<string, UtilizationState>;
}

export interface PortfolioResourceHeatmapRow {
  resourceId: string;
  resourceName: string;
  project: string;
  coe: string;       // Center of Excellence (e.g., "Frontend", "Backend", "QA", "Infra")
  vertical: string;  // Business vertical (e.g., "Fintech", "Telecom", "Retail")
  weeklyUtilization: Record<string, number>;
  weeklyState: Record<string, UtilizationState>;
}

export interface InlineTaskCreateRequest {
  projectKey: string;
  epic?: string;
  epicKey?: string;
  story?: string;
  summary: string;
  effortHours?: number;
  estimateUnit?: EstimateUnit;
  estimateValue?: number;
  tshirtSize?: TShirtSize;
  resource?: string;
  resourceAccountId?: string;
  isPlaceholderResource?: boolean;
  startDate?: string;
  endDate?: string;
  targetProgress?: number;
  startWeek?: string;
  spanWeeks?: number;
  targetIndex?: number;
}

export interface ScheduleBacklogRequest {
  projectKey: string;
  taskId: string;
  startWeek: string;
  spanWeeks?: number;
  effortHours?: number;
  resource?: string;
  targetIndex?: number;
}

export interface UnscheduleTaskRequest {
  projectKey: string;
  taskId: string;
}

export interface CreateSubtaskForResourceRequest {
  projectKey: string;
  parentKey?: string;
  parentTaskId?: string;
  summary?: string;
  resource?: string;
  assigneeName?: string;
  resourceAccountId?: string;
  assigneeAccountId?: string;
  effortHours?: number;
  startWeek?: string;
  spanWeeks?: number;
}

export interface ReorderTasksRequest {
  projectKey: string;
  taskId: string;
  targetIndex: number;
}

export const DEFAULT_TSHIRT_MAP: Record<TShirtSize, number> = {
  XS: 4,
  S: 8,
  M: 16,
  L: 32,
  XL: 64
};

export const DEFAULT_STORY_POINT_RATIO = 8; // 1 pt = 8 hours

export const CURRENT_WEEK_INDEX = 6; // '26-Aug'

/**
 * Universal Data Models for Project Management (Silverston / OFBiz / Moqui Pattern)
 * Provides canonical enterprise data modeling alignment for work efforts, associations,
 * party assignments, and estimation standards.
 */
export type WorkEffortType = 'PROJECT' | 'PHASE' | 'PROGRAM' | 'EPIC' | 'TASK' | 'ACTIVITY' | 'MILESTONE';

export type WorkEffortStatus = 'WE_PLANNED' | 'WE_IN_PROGRESS' | 'WE_ON_HOLD' | 'WE_COMPLETE' | 'WE_CANCELLED';

export type WorkEffortAssocType = 'WORK_BREAKDOWN' | 'PRECEDENCE' | 'FRACTIONAL_MILESTONE' | 'DEPENDENCY';

export type WorkEffortRoleType = 'PRIMARY_ASSIGNEE' | 'CONTRIBUTOR' | 'QA_LEAD' | 'REVIEWER' | 'STAKEHOLDER';

export interface WorkEffort {
  workEffortId: string;
  workEffortTypeId: WorkEffortType;
  workEffortName: string;
  description?: string;
  currentStatusId: WorkEffortStatus;
  estimatedStartDate?: string;
  estimatedCompletionDate?: string;
  actualStartDate?: string;
  actualCompletionDate?: string;
  estimatedHours: number;
  actualHours?: number;
  percentComplete: number;
  targetPercentComplete: number;
  manualProgress?: boolean;
  sequenceNum?: number;
  workEffortParentId?: string;
}

export interface WorkEffortAssoc {
  workEffortIdFrom: string;
  workEffortIdTo: string;
  workEffortAssocTypeId: WorkEffortAssocType;
  sequenceNum?: number;
  triggerPercent?: number;
  lagTimeDays?: number;
  isTriggerSatisfied: boolean;
  isViolated?: boolean;
  violationReason?: string;
  notes?: string;
}

export interface WorkEffortPartyAssignment {
  workEffortId: string;
  partyId: string;
  displayName: string;
  roleTypeId: WorkEffortRoleType;
  allocatedHours?: number;
  capacityPercent?: number;
  fromDate?: string;
  thruDate?: string;
}

export interface WorkEffortEstimate {
  workEffortId: string;
  estimateUnit: EstimateUnit;
  rawEstimate: number;
  normalizedHours: number;
  bufferType: BufferType;
  bufferValue: number;
  totalCalculatedHours: number;
}

/**
 * Converts a CascadePlan WbsTask into a canonical Silverston / Moqui WorkEffort entity.
 */
export function toWorkEffort(task: WbsTask): WorkEffort {
  let statusId: WorkEffortStatus = 'WE_PLANNED';
  if (task.status === 'COMPLETED') statusId = 'WE_COMPLETE';
  else if (task.status === 'IN_PROGRESS') statusId = 'WE_IN_PROGRESS';

  let typeId: WorkEffortType = 'TASK';
  if (task.isEpic || task.hierarchyLevel === 1) typeId = 'EPIC';
  else if (task.isSubtask || task.hierarchyLevel === -1) typeId = 'ACTIVITY';

  return {
    workEffortId: task.key || task.id,
    workEffortTypeId: typeId,
    workEffortName: task.summary,
    currentStatusId: statusId,
    estimatedStartDate: task.startDate,
    estimatedCompletionDate: task.endDate,
    estimatedHours: task.effortHours || 0,
    percentComplete: task.progress || 0,
    targetPercentComplete: task.targetProgress || 0,
    manualProgress: task.manualProgress,
    sequenceNum: task.orderIndex,
    workEffortParentId: task.parentKey || task.parentId
  };
}

/**
 * Converts a canonical Silverston / Moqui WorkEffort entity back into a CascadePlan WbsTask.
 */
export function fromWorkEffort(
  we: WorkEffort,
  assocs?: WorkEffortAssoc[],
  parties?: WorkEffortPartyAssignment[]
): Partial<WbsTask> {
  let status: TaskStatus = 'NOT_STARTED';
  if (we.currentStatusId === 'WE_COMPLETE') status = 'COMPLETED';
  else if (we.currentStatusId === 'WE_IN_PROGRESS') status = 'IN_PROGRESS';

  const isEpic = we.workEffortTypeId === 'EPIC';
  const isSubtask = we.workEffortTypeId === 'ACTIVITY';

  const primaryParty = (parties || []).find(p => p.roleTypeId === 'PRIMARY_ASSIGNEE');
  const otherParties = (parties || []).filter(p => p.roleTypeId !== 'PRIMARY_ASSIGNEE').map(p => p.displayName);

  let dependency: TaskDependency | undefined;
  const precAssoc = (assocs || []).find(a => a.workEffortIdTo === we.workEffortId && (a.workEffortAssocTypeId === 'PRECEDENCE' || a.workEffortAssocTypeId === 'FRACTIONAL_MILESTONE'));
  if (precAssoc) {
    dependency = {
      predecessorId: precAssoc.workEffortIdFrom,
      predecessorKey: precAssoc.workEffortIdFrom,
      triggerPercent: precAssoc.triggerPercent !== undefined ? precAssoc.triggerPercent : 30,
      isTriggerSatisfied: precAssoc.isTriggerSatisfied,
      isViolated: precAssoc.isViolated,
      violationReason: precAssoc.violationReason
    };
  }

  return {
    id: we.workEffortId,
    key: we.workEffortId,
    summary: we.workEffortName,
    status,
    effortHours: we.estimatedHours,
    progress: we.percentComplete,
    targetProgress: we.targetPercentComplete,
    manualProgress: we.manualProgress,
    startDate: we.estimatedStartDate || '',
    endDate: we.estimatedCompletionDate || '',
    isEpic,
    isSubtask,
    hierarchyLevel: isEpic ? 1 : (isSubtask ? -1 : 0),
    parentKey: we.workEffortParentId,
    resource: primaryParty ? primaryParty.displayName : 'Unassigned',
    resourceAccountId: primaryParty ? primaryParty.partyId : undefined,
    contributingResources: otherParties.length > 0 ? otherParties : undefined,
    dependency
  };
}
