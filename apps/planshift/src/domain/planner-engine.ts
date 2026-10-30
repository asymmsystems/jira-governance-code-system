/**
 * CascadePlan: Pure Deterministic Planning & Calculation Engine
 * Implements multi-unit estimation reconciliation, subtask summation with buffers,
 * WBS cell styling, resource utilization aggregation, and fractional completion dependencies.
 */

import {
  WbsTask,
  WeeklySprintColumn,
  CellVisualState,
  UtilizationState,
  TaskDependency,
  ResourceUtilizationProfile,
  PortfolioResourceHeatmapRow,
  ResourceProjectAllocation,
  EstimateUnit,
  TShirtSize,
  TaskEffortConfig,
  SubtaskItem,
  DEFAULT_TSHIRT_MAP,
  DEFAULT_STORY_POINT_RATIO
} from './models';

export class PlannerEngine {
  /**
   * Normalizes an estimate in any supported unit (Hours, Story Points, T-Shirt) into standard working hours.
   */
  public static normalizeEstimateToHours(
    unit: EstimateUnit,
    value: number = 0,
    tshirtSize?: TShirtSize,
    conversionRatio: number = DEFAULT_STORY_POINT_RATIO
  ): number {
    if (unit === 'HOURS') {
      return Math.max(0, Math.round(value));
    }
    if (unit === 'STORY_POINTS') {
      return Math.max(0, Math.round(value * conversionRatio));
    }
    if (unit === 'TSHIRT') {
      const sizeKey = tshirtSize || 'M';
      return DEFAULT_TSHIRT_MAP[sizeKey] || 16;
    }
    return Math.max(0, Math.round(value));
  }

  /**
   * Calculates total task effort, reconciling subtasks and buffer (fixed hours or percentage).
   */
  public static calculateEffortWithSubtasksAndBuffer(
    config: Partial<TaskEffortConfig>
  ): TaskEffortConfig {
    const unit: EstimateUnit = config.unit || 'HOURS';
    const rawEstimate = typeof config.rawEstimate === 'number' ? config.rawEstimate : 40;
    const tshirtSize = config.tshirtSize;
    const ratio = config.hoursConversionRatio || DEFAULT_STORY_POINT_RATIO;
    const subtasks = config.subtasks || [];
    const bufferType = config.bufferType || 'NONE';
    const bufferValue = typeof config.bufferValue === 'number' ? config.bufferValue : 0;

    const subtasksSumHours = subtasks.reduce((sum, s) => sum + (s.normalizedHours || 0), 0);

    const baseHours = subtasksSumHours > 0
      ? subtasksSumHours
      : this.normalizeEstimateToHours(unit, rawEstimate, tshirtSize, ratio);

    let bufferHours = 0;
    if (bufferType === 'PERCENTAGE') {
      bufferHours = Math.round((baseHours * bufferValue) / 100);
    } else if (bufferType === 'FIXED_HOURS') {
      bufferHours = Math.round(bufferValue);
    }

    const totalCalculatedHours = baseHours + bufferHours;

    return {
      unit,
      rawEstimate,
      tshirtSize,
      hoursConversionRatio: ratio,
      subtasks,
      subtasksSumHours,
      bufferType,
      bufferValue,
      bufferHours,
      totalCalculatedHours
    };
  }

  /**
   * Evaluates the visual cell state for a task in a specific timeline week.
   * Matches the visual rules in the project tracking view:
   * - Green: Completed / on-track progress
   * - Red: Behind schedule (actual progress < target progress)
   * - Light Blue: Planned remaining time in future weeks
   * - Empty: No work allocated for this week
   */
  public static calculateCellVisualState(
    task: WbsTask,
    week: WeeklySprintColumn,
    weekIndex: number,
    currentWeekIndex: number
  ): CellVisualState {
    const taskStart = new Date(task.startDate).getTime();
    const taskEnd = new Date(task.endDate).getTime();
    const weekStart = new Date(week.startDate).getTime();
    const weekEnd = new Date(week.endDate).getTime();

    // Check if task active range overlaps with the week
    const isWithinRange = !(taskEnd < weekStart || taskStart > weekEnd);
    const hasExplicitAllocation = Boolean(
      task.weeklyAllocations && task.weeklyAllocations[week.weekKey] && task.weeklyAllocations[week.weekKey] > 0
    );

    if (!isWithinRange && !hasExplicitAllocation) {
      return 'EMPTY';
    }

    // Past or Current week evaluation
    if (weekIndex <= currentWeekIndex) {
      if (task.status === 'COMPLETED' || task.progress >= 100) {
        return 'COMPLETED';
      }
      if (task.progress < task.targetProgress || task.progress === 0) {
        return 'BEHIND_SCHEDULE';
      }
      return 'PLANNED_LEFT';
    }

    // Future week evaluation
    if (task.status === 'COMPLETED') {
      return 'COMPLETED';
    }
    return 'PLANNED_LEFT';
  }

  /**
   * Validates a candidate dependency for threshold range, self-dependency, and cycles.
   */
  public static validateDependency(
    successorKey: string,
    predecessorKey: string,
    triggerPercent: number,
    existingTasks: { key: string; dependency?: TaskDependency }[] = []
  ): { valid: boolean; error?: string } {
    if (typeof triggerPercent !== 'number' || isNaN(triggerPercent) || triggerPercent < 0 || triggerPercent > 100) {
      return {
        valid: false,
        error: 'Dependency trigger threshold must be a number between 0 and 100%.'
      };
    }

    if (successorKey === predecessorKey) {
      return {
        valid: false,
        error: `Invalid dependency: Task '${successorKey}' cannot depend on itself.`
      };
    }

    // Graph cycle detection: follow predecessor links starting at predecessorKey
    const visited = new Set<string>();
    const chain: string[] = [successorKey, predecessorKey];
    let currentKey: string | undefined = predecessorKey;

    while (currentKey) {
      if (currentKey === successorKey) {
        return {
          valid: false,
          error: `Cyclic dependency detected: ${chain.join(' -> ')}`
        };
      }
      if (visited.has(currentKey)) {
        break;
      }
      visited.add(currentKey);

      const target = existingTasks.find(t => t.key === currentKey);
      currentKey = target?.dependency?.predecessorKey;
      if (currentKey) {
        chain.push(currentKey);
      }
    }

    return { valid: true };
  }

  /**
   * Checks whether a partial completion dependency trigger is satisfied.
   * Calculates earliest possible start date and flags timeline violations.
   * Example: Task 2 can start as soon as Task 1 reaches 30% progress.
   */
  public static evaluateDependency(
    predecessor: WbsTask | undefined,
    dependency: TaskDependency,
    successor?: WbsTask,
    now: Date = new Date()
  ): {
    isSatisfied: boolean;
    isViolated?: boolean;
    blockerMessage?: string;
    earliestStartDate?: string;
    earliestStartReason?: string;
  } {
    if (!predecessor) {
      return {
        isSatisfied: false,
        isViolated: true,
        blockerMessage: `Predecessor task '${dependency.predecessorKey}' not found.`
      };
    }

    const p = predecessor.progress || 0;
    const X = dependency.triggerPercent;

    if (p >= X) {
      return {
        isSatisfied: true,
        isViolated: false
      };
    }

    // Predecessor has not yet reached threshold X%
    const predStartMs = new Date(predecessor.startDate || now).getTime();
    const predEndMs = new Date(predecessor.endDate || predecessor.startDate || now).getTime();
    const durationDays = Math.max(1, Math.round((Math.max(predEndMs, predStartMs + 86400000) - predStartMs) / 86400000));

    let earliestDate: Date;
    let earliestStartReason: string;

    if (p === 0) {
      const offsetDays = Math.max(1, Math.round((X / 100) * durationDays));
      earliestDate = new Date(predStartMs + offsetDays * 86400000);
      earliestStartReason = `Planned timeline: ${durationDays} days duration at 0% progress; requires ${offsetDays} days to reach ${X}%`;
    } else {
      const nowMs = now.getTime();
      const elapsedDays = Math.max(1, Math.round((nowMs - predStartMs) / 86400000));
      const observedRate = (p / 100) / elapsedDays;
      const remainingFraction = (X - p) / 100;
      const remainingDays = Math.max(1, Math.round(remainingFraction / (observedRate > 0 ? observedRate : 0.01)));
      earliestDate = new Date(nowMs + remainingDays * 86400000);
      earliestStartReason = `Observed velocity: ${p}% achieved over ${elapsedDays} days; estimated ${remainingDays} days to reach ${X}%`;
    }

    const earliestStartDate = earliestDate.toISOString().slice(0, 10);

    let isViolated = false;
    let blockerMessage: string | undefined;

    if (successor) {
      const successorStarted = successor.progress > 0 || successor.status === 'IN_PROGRESS' || successor.status === 'COMPLETED';
      const succStartMs = new Date(successor.startDate).getTime();

      if (successorStarted) {
        isViolated = true;
        blockerMessage = `'${successor.key}' has already started (${successor.progress}%), but predecessor '${predecessor.key}' is only at ${p}% (threshold: ${X}%).`;
      } else if (succStartMs < earliestDate.getTime()) {
        isViolated = true;
        blockerMessage = `'${successor.key}' scheduled to start on ${successor.startDate}, before earliest possible start date ${earliestStartDate} (${earliestStartReason}).`;
      }
    } else {
      isViolated = true;
      blockerMessage = `Blocked: '${predecessor.key}' is at ${p}%, requires ${X}% completion to start.`;
    }

    return {
      isSatisfied: false,
      isViolated,
      blockerMessage,
      earliestStartDate,
      earliestStartReason
    };
  }

  /**
   * Generates a rolling window of weekly sprint columns dynamically centered around a reference date.
   */
  public static generateDynamicWeeks(
    referenceDate: Date = new Date(),
    pastWeeksCount: number = 6,
    futureWeeksCount: number = 8
  ): { weeks: WeeklySprintColumn[]; currentWeekIndex: number } {
    const ref = new Date(referenceDate);
    const day = ref.getDay();
    const diffToWed = (day >= 3 ? day - 3 : day + 4);
    const currentWeekStart = new Date(ref);
    currentWeekStart.setDate(ref.getDate() - diffToWed);
    currentWeekStart.setHours(0, 0, 0, 0);

    const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const weeks: WeeklySprintColumn[] = [];

    for (let i = -pastWeeksCount; i <= futureWeeksCount; i++) {
      const wkStart = new Date(currentWeekStart);
      wkStart.setDate(currentWeekStart.getDate() + i * 7);

      const wkEnd = new Date(wkStart);
      wkEnd.setDate(wkStart.getDate() + 6);

      const startDay = String(wkStart.getDate()).padStart(2, '0');
      const startMon = MONTHS[wkStart.getMonth()];
      const weekKey = `${startDay}-${startMon}`;

      const sprintNum = Math.floor((i + pastWeeksCount) / 2);
      const sprintName = `Sprint ${sprintNum}`;
      const isCurrentWeek = (i === 0);

      const toIsoDate = (d: Date) => d.toISOString().slice(0, 10);

      weeks.push({
        weekKey,
        sprintName,
        startDate: toIsoDate(wkStart),
        endDate: toIsoDate(wkEnd),
        isCurrentWeek
      });
    }

    return {
      weeks,
      currentWeekIndex: pastWeeksCount
    };
  }

  /**
   * Calculates overall weighted project completion and target completion percentages.
   */
  public static calculateProjectCompletion(tasks: WbsTask[]): {
    actualCompletion: number;
    targetCompletion: number;
  } {
    if (!tasks || tasks.length === 0) {
      return { actualCompletion: 0, targetCompletion: 0 };
    }

    const totalEffort = tasks.reduce((acc, t) => acc + (t.effortHours > 0 ? t.effortHours : 1), 0);
    const actualWork = tasks.reduce((acc, t) => acc + (t.effortHours > 0 ? t.effortHours : 1) * (t.progress / 100), 0);
    const targetWork = tasks.reduce((acc, t) => acc + (t.effortHours > 0 ? t.effortHours : 1) * (t.targetProgress / 100), 0);

    return {
      actualCompletion: Math.round((actualWork / totalEffort) * 100),
      targetCompletion: Math.round((targetWork / totalEffort) * 100)
    };
  }

  /**
   * Aggregates tasks into multi-project resource utilization profiles.
   */
  public static calculateResourceUtilization(
    tasks: WbsTask[],
    weeks: WeeklySprintColumn[],
    currentWeekIndex: number,
    projectName: string = 'Current Project'
  ): ResourceUtilizationProfile[] {
    const resourceMap = new Map<string, WbsTask[]>();

    for (const task of tasks) {
      const resName = (task.resource || 'Unassigned').trim();
      const list = resourceMap.get(resName) || [];
      list.push(task);
      resourceMap.set(resName, list);
    }

    const profiles: ResourceUtilizationProfile[] = [];

    for (const [resourceName, resTasks] of resourceMap.entries()) {
      const allocations: ResourceProjectAllocation[] = resTasks.map(t => {
        const weeklyWorkload: Record<string, number> = {};
        for (const week of weeks) {
          if (t.weeklyAllocations && typeof t.weeklyAllocations[week.weekKey] === 'number') {
            weeklyWorkload[week.weekKey] = t.weeklyAllocations[week.weekKey];
          } else if (t.startWeek && t.endWeek) {
            const wIdx = weeks.findIndex(w => w.weekKey === week.weekKey);
            const sIdx = weeks.findIndex(w => w.weekKey === t.startWeek);
            const eIdx = weeks.findIndex(w => w.weekKey === t.endWeek);
            if (sIdx !== -1 && eIdx !== -1 && wIdx >= sIdx && wIdx <= eIdx) {
              const span = Math.max(1, eIdx - sIdx + 1);
              weeklyWorkload[week.weekKey] = Math.round(100 / span);
            } else {
              weeklyWorkload[week.weekKey] = 0;
            }
          } else {
            const taskStart = new Date(t.startDate).getTime();
            const taskEnd = new Date(t.endDate).getTime();
            const weekStart = new Date(week.startDate).getTime();
            const weekEnd = new Date(week.endDate).getTime();
            const isWithinRange = !(taskEnd < weekStart || taskStart > weekEnd);
            weeklyWorkload[week.weekKey] = isWithinRange ? Math.round(100 / Math.max(1, t.spanWeeks || 4)) : 0;
          }
        }
        return {
          projectName,
          epic: t.epic,
          story: t.story,
          task: t.summary,
          effortHours: t.effortHours,
          progress: t.progress,
          targetProgress: t.targetProgress,
          status: t.status,
          startDate: t.startDate,
          endDate: t.endDate,
          weeklyWorkload
        };
      });

      const overallWeeklyUtilization: Record<string, number> = {};
      const overallWeeklyState: Record<string, UtilizationState> = {};

      for (let i = 0; i < weeks.length; i++) {
        const week = weeks[i];
        let totalPct = 0;
        for (const alloc of allocations) {
          totalPct += alloc.weeklyWorkload[week.weekKey] || 0;
        }
        overallWeeklyUtilization[week.weekKey] = totalPct;

        if (totalPct === 0) {
          overallWeeklyState[week.weekKey] = 'UNPLANNED';
        } else if (totalPct > 100) {
          overallWeeklyState[week.weekKey] = 'OVER_ALLOCATED';
        } else if (totalPct === 100) {
          if (i <= currentWeekIndex) {
            overallWeeklyState[week.weekKey] = 'PAST_UTILIZED';
          } else {
            overallWeeklyState[week.weekKey] = 'FUTURE_PLANNED';
          }
        } else {
          overallWeeklyState[week.weekKey] = 'UNDER_UTILIZED';
        }
      }

      profiles.push({
        resourceName,
        allocations,
        overallWeeklyUtilization,
        overallWeeklyState
      });
    }

    return profiles;
  }

  /**
   * Builds the executive resource heatmap.
   */
  public static buildPortfolioHeatmap(
    profiles: ResourceUtilizationProfile[],
    metadata: Record<string, { coe: string; vertical: string; project: string }>
  ): PortfolioResourceHeatmapRow[] {
    return profiles.map((profile, idx) => {
      const meta = metadata[profile.resourceName] || {
        coe: 'Core Engineering',
        vertical: 'Core Platform',
        project: 'Project 1'
      };

      return {
        resourceId: `res-${idx + 1}`,
        resourceName: profile.resourceName,
        project: meta.project,
        coe: meta.coe,
        vertical: meta.vertical,
        weeklyUtilization: profile.overallWeeklyUtilization,
        weeklyState: profile.overallWeeklyState
      };
    });
  }

  /**
   * Filters the portfolio heatmap by project, COE, or vertical.
   */
  public static filterPortfolioHeatmap(
    rows: PortfolioResourceHeatmapRow[],
    filters: { project?: string; coe?: string; vertical?: string }
  ): PortfolioResourceHeatmapRow[] {
    return rows.filter(row => {
      if (filters.project && filters.project !== 'ALL' && row.project !== filters.project) {
        return false;
      }
      if (filters.coe && filters.coe !== 'ALL' && row.coe !== filters.coe) {
        return false;
      }
      if (filters.vertical && filters.vertical !== 'ALL' && row.vertical !== filters.vertical) {
        return false;
      }
      return true;
    });
  }
}
