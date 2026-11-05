/**
 * CascadePlan: Domain Data Models
 * Supports flexible estimation (Hours, Story Points, T-Shirts), subtask rollups with buffers,
 * authentic Jira assignee typeahead / placeholders, existing & new Epics,
 * visual Gantt with "Today" line and milestones, resizable columns, and fractional dependencies.
 */

import type { EndedLink, Contributor } from './work-effort-links';

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
  subtasks?: SubtaskItem[];
  subtasksSumHours?: number;
  bufferType?: BufferType;
  bufferValue?: number; // e.g. 15 (%) or 10 (hours)
  bufferHours?: number;
  totalCalculatedHours?: number;
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
  jiraLinkId?: string; // id of the Jira "Blocks" link of this dependency
  /**
   * A link stored only in this plan's record, with no Jira link (before ADR-006). It stays shown and
   * scheduled until the user creates it in Jira or drops it (ADR-006 migration, N-11 L5).
   */
  planOnly?: boolean;
  since?: string;        // fromDate of the stored association (B-28)
  driverKey?: string;    // the predecessor that sets the earliest start (B-11)
  fixSuggestion?: string; // what the user can change to resolve a violation (B-11, B-12)
  triggerDate?: string;   // the day the driver reaches its trigger (B-12)
  fixOptions?: Array<{ kind: 'move'; startDate: string; endDate: string } | { kind: 'trigger'; triggerPercent: number }>;
}

export interface WbsTask {
  id: string;
  key: string;
  /** Due date as Jira holds it, read live and never stored (B-23). */
  jiraDueDate?: string;
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
  manualTargetProgress?: boolean;
  status: TaskStatus;
  startDate: string;      // YYYY-MM-DD
  endDate: string;        // YYYY-MM-DD
  startWeek?: string;     // weekKey, e.g. "05-Aug"
  endWeek?: string;       // weekKey, e.g. "26-Aug"
  spanWeeks?: number;     // number of weeks duration
  weeklyAllocations?: Record<string, number>; // weekKey -> % of week effort (e.g. { '15-Jul': 50 })
  dependency?: TaskDependency | null; // the first active link; null in an update removes every link
  dependencies?: TaskDependency[];    // every active precedency link (B-28)
  endedLinks?: EndedLink[];           // links the user removed; their Jira links are not imported again
  contributors?: Contributor[];       // second people by account id (B-28); names are read live
  removeSubtaskAction?: { subtaskKey: string; action: 'delete' | 'unassign' | 'keep' };
  jiraBlockedBy?: Array<{ key: string; id: string }>; // Jira "Blocks" predecessors, read live, never stored
  datesFromChildren?: boolean;        // a parent whose dates are derived from its children (B-28)
  model?: number;                     // stored record model; 1 = before B-28, read for the migration only
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
  sequenceNum?: number; // stored row order with gaps (B-09)
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

export interface PlanMetadata {
  id: string;
  name: string;
  createdAt: string;
  isDefault?: boolean;
  /**
   * Absent when the plan is ready. 'copying': a clone whose records are still being copied, page by
   * page; 'deleting': a delete whose records are still being removed (N-02). Such a plan is not
   * opened, and every write to it is refused.
   */
  state?: 'copying' | 'deleting';
  /** The plan a 'copying' plan is cloned from. */
  copyFrom?: string;
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
  availablePlans?: PlanMetadata[];  // Available named plans for project (UX-05)
  hasEpic?: boolean;                // Whether the project supports Epic issue type
  lastUpdated: string;
  isLiveSynced?: boolean;
  jiraStatus?: number; // Jira's HTTP status when the issue search failed (0 for no answer), F-21
  siteUrl?: string;
  hiddenColumns?: string[];
  truncated?: { shown: number; total: number }; // more issues exist than were read (B-10)
  ok?: boolean;                     // set by write resolvers (B-07)
  jiraSync?: JiraSyncReport;        // set by write resolvers (B-07)
  staleEntries?: string[];          // stored entries Jira did not return (complete reads only, B-18)
}

export interface JiraWriteRecord {
  key: string;
  fields: string[];
  ok: boolean;
  error?: string;
  /** Old and new value of each field, for the Changes panel (B-23). */
  changes?: Array<{ field: string; from: string | null; to: string | null }>;
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


export interface InlineTaskCreateRequest {
  projectKey: string;
  projectId?: string; // from the Forge context; keys records by project id (B-09)
  parentKey?: string;
  assigneeAccountId?: string;
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
  planId?: string;
}

export interface ScheduleBacklogRequest {
  projectKey: string;
  projectId?: string; // from the Forge context; keys records by project id (B-09)
  taskId: string;
  startWeek: string;
  startDate?: string; // an exact start day; the timeline is not limited to the server week list (B-27)
  endDate?: string;   // an end the user chose; only then is a Jira due date written (F-06, INV-03)
  spanWeeks?: number;
  effortHours?: number;
  resource?: string;
  targetIndex?: number;
  planId?: string;
}

export interface UnscheduleTaskRequest {
  projectKey: string;
  projectId?: string; // from the Forge context; keys records by project id (B-09)
  taskId: string;
  planId?: string;
}

export interface CreateSubtaskForResourceRequest {
  projectKey: string;
  projectId?: string; // from the Forge context; keys records by project id (B-09)
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
  endDate?: string;   // an end the user chose; only then is a Jira due date written (F-06)
  planId?: string;
}

export interface ReorderTasksRequest {
  projectKey: string;
  projectId?: string; // from the Forge context; keys records by project id (B-09)
  taskId: string;
  targetIndex: number;
  planId?: string;
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
 * WorkEffort model (Silverston pattern; reference: Apache OFBiz workeffort-entitymodel.xml, see
 * silverston-conformance.md). Only app-owned planning data is stored (INV-04); the hierarchy, name,
 * status and assignee stay in Jira.
 */
export const WORK_EFFORT_MODEL = 2;

/** OFBiz WorkEffortAssocType; a percent trigger is a WORK_EFF_PRECEDENCY with a triggerPercent attribute. */
export type WorkEffortAssocType = 'WORK_EFF_BREAKDOWN' | 'WORK_EFF_DEPENDENCY' | 'WORK_EFF_PRECEDENCY' | 'WORK_EFF_CONCURRENCY';

/** An extension role (RoleType is open in the pattern): a second person on a task. */
export type WorkEffortRoleType = 'CONTRIBUTOR';

/** Time-bound association: the link is active until thruDate. Extra facts are attributes. */
export interface WorkEffortAssoc {
  workEffortIdFrom: string;
  workEffortIdTo: string;
  workEffortAssocTypeId: WorkEffortAssocType;
  fromDate: string;
  thruDate?: string;
  attrs: { triggerPercent: number; jiraLinkId?: string };
}

/** Keyed by partyId (Atlassian account id), role and fromDate; legacyName only for an unmatched old name. */
export interface WorkEffortPartyAssignment {
  workEffortId: string;
  partyId?: string;
  legacyName?: string;
  roleTypeId: WorkEffortRoleType;
  fromDate: string;
  thruDate?: string;
  subtaskKey?: string;
}

/** Extension: the estimate as the user entered it (mixed units have no home in the pattern). */
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
 * Stored part of a WorkEffort: only app-owned planning data (INV-04). Name, status and the
 * Jira estimate stay in Jira and are read live.
 */
export interface StoredWorkEffort {
  workEffortId: string;
  estimatedStartDate?: string;
  estimatedCompletionDate?: string;
  sequenceNum?: number;
  targetPercentComplete?: number;
  manualProgress?: boolean;
  manualTargetProgress?: boolean;
  percentComplete?: number; // only when the user set progress by hand
}

/** Week-grid position and other planner view data kept with the record. */
export interface WorkEffortGrid {
  startWeek?: string;
  endWeek?: string;
  spanWeeks?: number;
  weeklyAllocations?: Record<string, number>;
  isBacklog?: boolean;
  localSubtasks?: SubtaskItem[];
}

/** Parts of the estimate form that WorkEffortEstimate does not name. */
export interface WorkEffortEstimateExtras {
  hoursConversionRatio?: number;
  tshirtSize?: TShirtSize;
  subtasks?: SubtaskItem[];
  subtasksSumHours?: number;
  bufferHours?: number;
}

/**
 * The stored form of one issue's planning data (spec 3.1, B-24): the Silverston / OFBiz / Moqui
 * WorkEffort pattern with its associations, party assignments and estimate.
 */
export interface WorkEffortRecordBody {
  model: number;
  effort: StoredWorkEffort;
  assocs: WorkEffortAssoc[];
  parties: WorkEffortPartyAssignment[];
  estimate?: WorkEffortEstimate;
  estimateExtras?: WorkEffortEstimateExtras;
  grid?: WorkEffortGrid;
}

function normalizedHoursOf(cfg: TaskEffortConfig): number {
  if (cfg.unit === 'STORY_POINTS') return Math.max(0, Math.round(cfg.rawEstimate * (cfg.hoursConversionRatio || DEFAULT_STORY_POINT_RATIO)));
  if (cfg.unit === 'TSHIRT') return DEFAULT_TSHIRT_MAP[cfg.tshirtSize || 'M'];
  return Math.max(0, Math.round(cfg.rawEstimate));
}

function defined<T extends object>(o: T): T {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(o)) if (v !== undefined) out[k] = v;
  return out as T;
}

/**
 * Converts the app-owned planning fields of a task into the stored WorkEffort record.
 * Jira-owned fields in the input are ignored.
 */
export function toWorkEffortRecord(issueKey: string, entry: Partial<WbsTask>, today: string = new Date().toISOString().slice(0, 10)): WorkEffortRecordBody {
  const effort: StoredWorkEffort = defined({
    workEffortId: issueKey,
    estimatedStartDate: entry.startDate,
    estimatedCompletionDate: entry.endDate,
    sequenceNum: entry.sequenceNum,
    targetPercentComplete: entry.targetProgress,
    manualProgress: entry.manualProgress,
    manualTargetProgress: entry.manualTargetProgress,
    percentComplete: entry.manualProgress === true ? entry.progress : undefined
  });
  const link = (from: string, fromDate: string, triggerPercent: number, jiraLinkId?: string, thruDate?: string): WorkEffortAssoc => defined({
    workEffortIdFrom: from, workEffortIdTo: issueKey, workEffortAssocTypeId: 'WORK_EFF_PRECEDENCY' as WorkEffortAssocType,
    fromDate, thruDate, attrs: defined({ triggerPercent, jiraLinkId })
  });
  const active = entry.dependencies || (entry.dependency && entry.dependency.predecessorKey ? [entry.dependency] : []);
  const assocs: WorkEffortAssoc[] = [
    ...active.map(d => link(d.predecessorKey, d.since || today, d.triggerPercent, d.jiraLinkId)),
    ...(entry.endedLinks || []).map(e => link(e.predecessorKey, e.since || e.until, typeof e.triggerPercent === 'number' ? e.triggerPercent : 100, e.jiraLinkId, e.until))
  ];
  const parties: WorkEffortPartyAssignment[] = (entry.contributors || []).map(c => defined({
    workEffortId: issueKey, partyId: c.accountId, legacyName: c.accountId ? undefined : c.legacyName,
    roleTypeId: 'CONTRIBUTOR' as WorkEffortRoleType, fromDate: c.since || today, subtaskKey: c.subtaskKey
  }));
  const body: WorkEffortRecordBody = { model: WORK_EFFORT_MODEL, effort, assocs, parties };
  const cfg = entry.effortConfig;
  if (cfg) {
    const norm = normalizedHoursOf(cfg);
    body.estimate = {
      workEffortId: issueKey, estimateUnit: cfg.unit, rawEstimate: cfg.rawEstimate, normalizedHours: norm,
      bufferType: cfg.bufferType || 'NONE', bufferValue: cfg.bufferValue || 0, totalCalculatedHours: cfg.totalCalculatedHours ?? norm
    };
    const extras = defined({ hoursConversionRatio: cfg.hoursConversionRatio, tshirtSize: cfg.tshirtSize, subtasks: cfg.subtasks,
      subtasksSumHours: cfg.subtasksSumHours, bufferHours: cfg.bufferHours });
    if (Object.keys(extras).length > 0) body.estimateExtras = extras;
  }
  const grid = defined({ startWeek: entry.startWeek, endWeek: entry.endWeek, spanWeeks: entry.spanWeeks,
    weeklyAllocations: entry.weeklyAllocations, isBacklog: entry.isBacklog, localSubtasks: entry.subtasks });
  if (Object.keys(grid).length > 0) body.grid = grid;
  return body;
}

/**
 * Converts a stored WorkEffort record back into the app-owned planning fields of a task.
 * A record written before B-24 (entry-shaped) is returned as it is.
 */
export function fromWorkEffortRecord(rec: WorkEffortRecordBody): Partial<WbsTask> {
  if (!rec || !(rec as any).effort) return { model: 1, ...(rec as any) };
  const e = rec.effort;
  const out: Partial<WbsTask> = defined({
    startDate: e.estimatedStartDate,
    endDate: e.estimatedCompletionDate,
    sequenceNum: e.sequenceNum,
    targetProgress: e.targetPercentComplete,
    manualProgress: e.manualProgress,
    manualTargetProgress: e.manualTargetProgress,
    progress: e.percentComplete,
    ...(rec.grid ? defined({ startWeek: rec.grid.startWeek, endWeek: rec.grid.endWeek, spanWeeks: rec.grid.spanWeeks,
      weeklyAllocations: rec.grid.weeklyAllocations, isBacklog: rec.grid.isBacklog, subtasks: rec.grid.localSubtasks }) : {})
  });
  if (rec.model === WORK_EFFORT_MODEL) {
    const toDep = (a: WorkEffortAssoc): TaskDependency => defined({ predecessorId: a.workEffortIdFrom, predecessorKey: a.workEffortIdFrom,
      triggerPercent: a.attrs.triggerPercent, isTriggerSatisfied: false, jiraLinkId: a.attrs.jiraLinkId, since: a.fromDate });
    const active = rec.assocs.filter(a => !a.thruDate).map(toDep);
    const ended = rec.assocs.filter(a => a.thruDate).map(a => defined({ predecessorKey: a.workEffortIdFrom, triggerPercent: a.attrs.triggerPercent,
      since: a.fromDate, until: a.thruDate as string, jiraLinkId: a.attrs.jiraLinkId }));
    if (active.length) {
      out.dependencies = active;
      out.dependency = active[0];
    }
    if (ended.length) out.endedLinks = ended;
    if (rec.parties.length) out.contributors = rec.parties.map(p => defined({ accountId: p.partyId, legacyName: p.legacyName, since: p.fromDate, subtaskKey: p.subtaskKey }));
  } else {
    // Model 1 (B-24 shape), read so that the migration can convert it (B-28).
    out.model = 1;
    const old: any = (rec.assocs || []).find((a: any) => a.workEffortAssocTypeId === 'FRACTIONAL_MILESTONE' || a.workEffortAssocTypeId === 'PRECEDENCE');
    if (old) {
      out.dependency = defined({ predecessorId: old.workEffortIdFrom, predecessorKey: old.workEffortIdFrom, triggerPercent: old.triggerPercent as number,
        isTriggerSatisfied: false, jiraLinkId: old.jiraLinkId });
    } else if ((rec as any).precedenceRemoved) {
      out.dependency = null;
    }
    if (rec.parties && rec.parties.length > 0) out.contributingResources = rec.parties.map((p: any) => p.displayName);
  }
  if (rec.estimate) {
    const x = rec.estimateExtras || {};
    out.effortConfig = defined({
      unit: rec.estimate.estimateUnit, rawEstimate: rec.estimate.rawEstimate, tshirtSize: x.tshirtSize,
      hoursConversionRatio: x.hoursConversionRatio, subtasks: x.subtasks as SubtaskItem[], subtasksSumHours: x.subtasksSumHours as number,
      bufferType: rec.estimate.bufferType, bufferValue: rec.estimate.bufferValue, bufferHours: x.bufferHours as number,
      totalCalculatedHours: rec.estimate.totalCalculatedHours
    });
  }
  return out;
}

/**
 * Configurable approver policy stored at cascadeplan:cfg:approver_policy.
 * Adheres to the Uniform Permission Management Standard across the Jira suite.
 */
export interface ApproverPolicy {
  roleTypeId: 'CP_APPROVER' | 'PS_APPROVER';
  parties: Array<{ partyId: string; partyTypeId: 'GROUP'; name: string }>;
  fromDate: string;
  setByPartyId: string;
}

