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

    const nonRollupTasks = tasks.filter(t => !t.isRollup);
    const targetTasks = nonRollupTasks.length > 0 ? nonRollupTasks : tasks;

    const totalEffort = targetTasks.reduce((acc, t) => acc + (t.effortHours > 0 ? t.effortHours : 1), 0);
    const actualWork = targetTasks.reduce((acc, t) => acc + (t.effortHours > 0 ? t.effortHours : 1) * (t.progress / 100), 0);
    const targetWork = targetTasks.reduce((acc, t) => acc + (t.effortHours > 0 ? t.effortHours : 1) * (t.targetProgress / 100), 0);

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
          const wIdx = weeks.findIndex(w => w.weekKey === week.weekKey);
          const sIdx = t.startWeek ? weeks.findIndex(w => w.weekKey === t.startWeek) : -1;
          const span = Math.max(1, t.spanWeeks || 1);
          const eIdx = t.endWeek
            ? weeks.findIndex(w => w.weekKey === t.endWeek)
            : (sIdx !== -1 ? sIdx + span - 1 : -1);

          if (t.weeklyAllocations && typeof t.weeklyAllocations[week.weekKey] === 'number') {
            weeklyWorkload[week.weekKey] = t.weeklyAllocations[week.weekKey];
          } else if (sIdx !== -1 && eIdx !== -1 && wIdx >= sIdx && wIdx <= eIdx) {
            const totalSpan = Math.max(1, eIdx - sIdx + 1);
            weeklyWorkload[week.weekKey] = Math.round(100 / totalSpan);
          } else if (t.startDate && t.endDate) {
            const taskStart = new Date(t.startDate.slice(0, 10)).getTime();
            const taskEnd = new Date(t.endDate.slice(0, 10)).getTime();
            const weekStart = new Date(week.startDate).getTime();
            const weekEnd = new Date(week.endDate).getTime();
            const isWithinRange = !(taskEnd < weekStart || taskStart > weekEnd);
            weeklyWorkload[week.weekKey] = isWithinRange ? Math.max(10, Math.round(100 / span)) : 0;
          } else {
            weeklyWorkload[week.weekKey] = 0;
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

  /**
   * Calculates the earliest week index that a dependent task can start based on a predecessor's
   * fractional completion trigger threshold (e.g. 50%), accounting for:
   * 1. The predecessor's startWeek and spanWeeks
   * 2. The predecessor's weeklyAllocations (% of work per week)
   * 3. The number and capacity of assigned resources (primary, contributing, subtask assignees)
   */
  public static calculateEarliestStartWeekIndex(
    predecessorTask: WbsTask,
    triggerPercent: number,
    activeWeeks: WeeklySprintColumn[]
  ): number {
    if (!predecessorTask || !activeWeeks || activeWeeks.length === 0) return 0;

    const predStartIdx = Math.max(0, activeWeeks.findIndex(w => w.weekKey === predecessorTask.startWeek));
    const predSpan = Math.max(1, predecessorTask.spanWeeks || 1);
    const predEndIdx = Math.min(activeWeeks.length - 1, predStartIdx + predSpan - 1);
    const targetTrigger = typeof triggerPercent === 'number' && !isNaN(triggerPercent) ? triggerPercent : 30;

    // 1. Determine assigned team size and capacity on predecessor
    const distinctTeam = new Set<string>();
    if (predecessorTask.resource && predecessorTask.resource !== 'Unassigned' && predecessorTask.resource !== 'Unallocated') {
      distinctTeam.add(predecessorTask.resource.trim());
    }
    (predecessorTask.contributingResources || []).forEach(r => {
      if (r && r !== 'Unassigned' && r !== 'Unallocated') distinctTeam.add(r.trim());
    });
    (predecessorTask.subtasks || []).forEach(s => {
      if (s.assignee && s.assignee !== 'Unassigned' && s.assignee !== 'Unallocated') distinctTeam.add(s.assignee.trim());
    });
    const teamSize = Math.max(1, distinctTeam.size);

    // 2. Accumulate progress week by week across predecessor's scheduled duration
    let cumulativeProgress = 0;
    let reachedWeekIdx = predStartIdx;

    for (let i = predStartIdx; i <= predEndIdx; i++) {
      const wk = activeWeeks[i];
      let weekPct = 0;
      if (predecessorTask.weeklyAllocations && typeof predecessorTask.weeklyAllocations[wk.weekKey] === 'number') {
        weekPct = predecessorTask.weeklyAllocations[wk.weekKey];
        if (teamSize > 1 && weekPct > 0) {
          weekPct = Math.min(100, weekPct * (1 + (teamSize - 1) * 0.25));
        }
      } else {
        const baseAlloc = 100 / predSpan;
        weekPct = Math.min(100, baseAlloc * (1 + (teamSize - 1) * 0.25));
      }

      cumulativeProgress += weekPct;
      reachedWeekIdx = i;

      if (cumulativeProgress >= targetTrigger) {
        return Math.min(activeWeeks.length - 1, i + 1);
      }
    }

    return Math.min(activeWeeks.length - 1, reachedWeekIdx + 1);
  }

  /**
   * Cascades timeline shifts downstream to any dependent successor tasks.
   * Auto-adjusts successor start/end weeks and redistributes weekly allocations.
   */
  public static cascadeSchedule(
    tasks: WbsTask[],
    changedTaskKey: string,
    activeWeeks: WeeklySprintColumn[]
  ): { updatedTasks: WbsTask[]; affectedTaskKeys: string[] } {
    if (!tasks || tasks.length === 0 || !activeWeeks || activeWeeks.length === 0) {
      return { updatedTasks: tasks || [], affectedTaskKeys: [] };
    }

    const taskMap = new Map<string, WbsTask>();
    tasks.forEach(t => taskMap.set(t.key, { ...t }));

    const queue: string[] = [changedTaskKey];
    const visited = new Set<string>();
    const affected = new Set<string>();

    while (queue.length > 0) {
      const currentKey = queue.shift()!;
      if (visited.has(currentKey)) continue;
      visited.add(currentKey);

      const parentTask = taskMap.get(currentKey);
      if (!parentTask) continue;

      for (const t of taskMap.values()) {
        if (t.dependency && (t.dependency.predecessorKey === currentKey || t.dependency.predecessorId === currentKey)) {
          const triggerPercent = typeof t.dependency.triggerPercent === 'number' ? t.dependency.triggerPercent : 30;
          const earliestStartIdx = PlannerEngine.calculateEarliestStartWeekIndex(parentTask, triggerPercent, activeWeeks);

          const currentSuccStartIdx = activeWeeks.findIndex(w => w.weekKey === t.startWeek);
          if (currentSuccStartIdx < earliestStartIdx) {
            const succSpan = t.spanWeeks || 3;
            const newStartIdx = earliestStartIdx;
            const newEndIdx = Math.min(activeWeeks.length - 1, newStartIdx + succSpan - 1);

            t.startWeek = activeWeeks[newStartIdx].weekKey;
            t.endWeek = activeWeeks[newEndIdx].weekKey;
            t.startDate = activeWeeks[newStartIdx].startDate;
            t.endDate = activeWeeks[newEndIdx].endDate;

            const allocations: Record<string, number> = {};
            for (let i = newStartIdx; i <= newEndIdx; i++) {
              allocations[activeWeeks[i].weekKey] = Math.round(100 / succSpan);
            }
            t.weeklyAllocations = allocations;

            affected.add(t.key);
            queue.push(t.key);
          }
        }
      }
    }

    return {
      updatedTasks: Array.from(taskMap.values()),
      affectedTaskKeys: Array.from(affected)
    };
  }

  /**
   * Reorders tasks list by moving a task to a target row index and updating order indices.
   */
  public static reorderTasks(tasks: WbsTask[], taskId: string, targetIndex: number): WbsTask[] {
    const list = [...tasks];
    const currentIndex = list.findIndex(t => t.key === taskId || t.id === taskId);
    if (currentIndex === -1) return list;

    const [item] = list.splice(currentIndex, 1);
    const clampedIndex = Math.max(0, Math.min(list.length, targetIndex));
    list.splice(clampedIndex, 0, item);

    list.forEach((t, idx) => {
      t.orderIndex = idx;
    });

    return list;
  }

  /**
   * Organizes tasks into a hierarchical multi-tier tree (Epics -> Stories/Tasks -> Subtasks)
   * and computes memory roll-up statistics (bounding dates, total hours, weighted progress)
   * for parent tasks.
   */
  public static buildWbsHierarchy(tasks: WbsTask[], weeks?: WeeklySprintColumn[]): WbsTask[] {
    if (!tasks || tasks.length === 0) return [];

    const taskList = tasks.map(t => ({ ...t }));

    // 1. Establish hierarchyLevel, isEpic, and isSubtask
    taskList.forEach(t => {
      let level = t.hierarchyLevel;
      if (level === undefined) {
        if (t.isSubtask) {
          level = -1;
        } else if (t.isEpic || t.story === 'Epic' || t.story?.toLowerCase() === 'epic' || (t.epicKey && t.epicKey === t.key)) {
          level = 1;
        }
      }
      if (level !== undefined) {
        t.hierarchyLevel = level;
        t.isEpic = (level === 1);
        t.isSubtask = (level === -1);
      }
    });

    // 2. Map parent-child relationships
    const taskByKey = new Map<string, WbsTask>();
    const taskById = new Map<string, WbsTask>();
    taskList.forEach(t => {
      if (t.key) taskByKey.set(t.key, t);
      if (t.id) taskById.set(t.id, t);
    });

    const childrenMap = new Map<string, WbsTask[]>();
    const childSet = new Set<string>();

    taskList.forEach(t => {
      let parentTask: WbsTask | undefined;
      const targetParentKey = t.parentKey;
      const targetParentId = t.parentId;

      if (targetParentKey && (taskByKey.has(targetParentKey) || taskById.has(targetParentKey))) {
        parentTask = taskByKey.get(targetParentKey) || taskById.get(targetParentKey);
      } else if (targetParentId && (taskById.has(targetParentId) || taskByKey.has(targetParentId))) {
        parentTask = taskById.get(targetParentId) || taskByKey.get(targetParentId);
      } else if (t.epicKey && !t.isEpic && (taskByKey.has(t.epicKey) || taskById.has(t.epicKey))) {
        parentTask = taskByKey.get(t.epicKey) || taskById.get(t.epicKey);
      }

      if (parentTask && parentTask.key !== t.key && parentTask.id !== t.id) {
        const pk = parentTask.key || parentTask.id;
        if (!childrenMap.has(pk)) childrenMap.set(pk, []);
        childrenMap.get(pk)!.push(t);
        childSet.add(t.key || t.id);

        if (parentTask.isEpic) {
          t.parentKey = parentTask.key;
          t.epicKey = parentTask.key;
          t.epic = parentTask.summary || parentTask.key;
          if (t.hierarchyLevel === undefined || t.hierarchyLevel === 0) {
            t.isSubtask = false;
            t.hierarchyLevel = 0;
          }
        } else {
          t.parentKey = parentTask.key;
          t.isSubtask = true;
          t.hierarchyLevel = -1;
          if (parentTask.epic) {
            t.epic = parentTask.epic;
            t.epicKey = parentTask.epicKey;
          }
        }
      } else {
        if (t.hierarchyLevel === undefined) {
          t.isSubtask = Boolean(t.isSubtask || t.parentKey || t.parentId);
          t.hierarchyLevel = t.isSubtask ? -1 : 0;
        }
      }
      t.isEpic = (t.hierarchyLevel === 1);
    });

    // 3. Compute roll-ups bottom-up for parents
    taskList.forEach(t => {
      const pk = t.key || t.id;
      const children = childrenMap.get(pk) || [];
      if (children.length > 0) {
        t.childrenCount = children.length;
        t.isRollup = true;

        let totalHours = 0;
        let completedHours = 0;
        const validStartDates: string[] = [];
        const validEndDates: string[] = [];
        const distinctResources = new Set<string>();

        const addResource = (res?: string) => {
          if (res && res !== 'Unassigned' && res !== 'Unallocated') {
            distinctResources.add(res);
          }
        };

        addResource(t.resource);

        children.forEach(c => {
          const effort = c.effortHours > 0 ? c.effortHours : 0;
          totalHours += effort;
          completedHours += effort * ((c.progress || 0) / 100);
          if (c.startDate) validStartDates.push(c.startDate.slice(0, 10));
          if (c.endDate) validEndDates.push(c.endDate.slice(0, 10));

          addResource(c.resource);
          (c.contributingResources || []).forEach(addResource);
          (c.subtasks || []).forEach(s => addResource(s.assignee));
        });

        (t.subtasks || []).forEach(s => addResource(s.assignee));
        (t.contributingResources || []).forEach(addResource);

        const contributingResources = Array.from(distinctResources);
        if (contributingResources.length > 0) {
          t.contributingResources = contributingResources;
        }

        validStartDates.sort();
        validEndDates.sort();

        const earliestStart = validStartDates[0];
        const latestEnd = validEndDates[validEndDates.length - 1];
        const progressPct = totalHours > 0 ? Math.round((completedHours / totalHours) * 100) : 0;

        let startWeek = t.startWeek;
        let spanWeeks = t.spanWeeks;

        if (weeks && weeks.length > 0 && earliestStart && latestEnd) {
          const sIdx = weeks.findIndex(w => w.startDate <= earliestStart && w.endDate >= earliestStart);
          const eIdx = weeks.findIndex(w => w.startDate <= latestEnd && w.endDate >= latestEnd);
          if (sIdx !== -1 && eIdx !== -1 && eIdx >= sIdx) {
            startWeek = weeks[sIdx].weekKey;
            spanWeeks = Math.max(1, eIdx - sIdx + 1);
          }
        }

        t.rollupStats = {
          startDate: earliestStart || t.startDate,
          endDate: latestEnd || t.endDate,
          totalHours,
          completedHours,
          progressPct,
          startWeek,
          spanWeeks,
          childrenCount: children.length,
          contributingResources
        };

        // Dynamically adjust bounding box and progress for all parent rollups (Epics AND Stories/Tasks with subtasks)
        if (t.isRollup || t.isEpic || children.length > 0) {
          if (t.isEpic && totalHours > 0) {
            t.effortHours = totalHours;
          }
          if (!t.manualProgress) {
            t.progress = progressPct;
          }
          if (earliestStart) t.startDate = earliestStart;
          if (latestEnd) t.endDate = latestEnd;
          if (startWeek) t.startWeek = startWeek;
          if (spanWeeks) t.spanWeeks = spanWeeks;
        }
      } else {
        const distinctResources = new Set<string>();
        const addResource = (res?: string) => {
          if (res && res !== 'Unassigned' && res !== 'Unallocated') {
            distinctResources.add(res);
          }
        };
        addResource(t.resource);
        (t.subtasks || []).forEach(s => addResource(s.assignee));
        (t.contributingResources || []).forEach(addResource);
        const contributingResources = Array.from(distinctResources);
        if (contributingResources.length > 0) {
          t.contributingResources = contributingResources;
        }
      }
    });

    // 4. Construct ordered hierarchy list
    const orderedResult: WbsTask[] = [];
    const addedKeys = new Set<string>();

    const appendWithChildren = (task: WbsTask) => {
      const idStr = task.key || task.id;
      if (addedKeys.has(idStr)) return;
      addedKeys.add(idStr);
      orderedResult.push(task);

      const children = childrenMap.get(idStr) || [];
      // Preserve the input taskList order among children
      children.sort((a, b) => taskList.indexOf(a) - taskList.indexOf(b));
      children.forEach(c => appendWithChildren(c));
    };

    taskList.forEach(t => {
      const idStr = t.key || t.id;
      if (!childSet.has(idStr)) {
        appendWithChildren(t);
      }
    });

    taskList.forEach(t => {
      const idStr = t.key || t.id;
      if (!addedKeys.has(idStr)) {
        appendWithChildren(t);
      }
    });

    return orderedResult;
  }
}
