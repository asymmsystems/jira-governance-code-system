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
  dependency?: TaskDependency;
  isBacklog?: boolean;
  subtasks?: SubtaskItem[];
  version?: number;
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
}

export interface ScheduleBacklogRequest {
  projectKey: string;
  taskId: string;
  startWeek: string;
  spanWeeks?: number;
  effortHours?: number;
  resource?: string;
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
