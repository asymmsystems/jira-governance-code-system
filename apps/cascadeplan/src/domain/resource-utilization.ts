/*
 * Copyright (c) 2026 Asymm Systems. All rights reserved.
 *
 * @author Fahim Farook
 */

/**
 * CascadePlan: Resource Allocation Utilization Domain Engine
 * Computes weekly resource workloads, detects allocation bottlenecks,
 * and highlights over-allocated and under-utilized team members.
 */

import {
  WbsTask,
  WeeklySprintColumn,
  ResourceUtilizationProfile,
  UtilizationState
} from './models';
import { PlannerEngine } from './planner-engine';

export interface WeeklyUtilizationSummary {
  weekKey: string;
  totalCapacityHours: number;
  totalAllocatedHours: number;
  averageUtilizationPercent: number;
  overAllocatedCount: number;
  underAllocatedCount: number;
  status: UtilizationState;
}

export interface ResourceUtilizationRow {
  resourceName: string;
  resourceAccountId?: string;
  weeklyUtilization: Record<string, number>;
  weeklyHours: Record<string, number>;
  weeklyState: Record<string, UtilizationState>;
  averageUtilization: number;
  isOverAllocated: boolean;
  allocatedTaskCount: number;
}

export interface ResourceUtilizationView {
  weeks: WeeklySprintColumn[];
  resources: ResourceUtilizationRow[];
  weeklySummaries: Record<string, WeeklyUtilizationSummary>;
  unassignedTasks: Array<{ id: string; key?: string; summary: string; effortHours: number }>;
  unassignedTotalHours: number;
  bottleneckWeeks: string[];
}

export interface UtilizationGridOptions {
  weeklyCapacityHours?: number;
  currentWeekIndex?: number;
  projectName?: string;
}

export class ResourceUtilizationEngine {
  public static readonly DEFAULT_WEEKLY_CAPACITY_HOURS = 40;

  public static generateGrid(
    tasks: WbsTask[],
    weeks: WeeklySprintColumn[],
    options: UtilizationGridOptions = {}
  ): ResourceUtilizationView {
    const weeklyCapacityHours = options.weeklyCapacityHours || this.DEFAULT_WEEKLY_CAPACITY_HOURS;
    const currentWeekIndex = typeof options.currentWeekIndex === 'number'
      ? options.currentWeekIndex
      : Math.floor(weeks.length / 2);
    const projectName = options.projectName || 'Current Project';

    const profiles: ResourceUtilizationProfile[] = PlannerEngine.calculateResourceUtilization(
      tasks,
      weeks,
      currentWeekIndex,
      projectName
    );

    const resources: ResourceUtilizationRow[] = [];
    const unassignedTasks: Array<{ id: string; key?: string; summary: string; effortHours: number }> = [];
    let unassignedTotalHours = 0;

    for (const task of tasks) {
      const res = (task.resource || '').trim();
      if (!res || res.toLowerCase() === 'unassigned') {
        const effort = task.effortHours || 1;
        unassignedTasks.push({
          id: task.id,
          key: task.key,
          summary: task.summary,
          effortHours: effort
        });
        unassignedTotalHours += effort;
      }
    }

    for (const profile of profiles) {
      if (profile.resourceName === 'Unassigned') {
        continue;
      }

      const weeklyHours: Record<string, number> = {};
      let totalPct = 0;
      let hasOverAllocated = false;

      for (const week of weeks) {
        const pct = profile.overallWeeklyUtilization[week.weekKey] || 0;
        weeklyHours[week.weekKey] = Math.round((pct * weeklyCapacityHours) / 100 * 10) / 10;
        totalPct += pct;
        if (pct > 100) {
          hasOverAllocated = true;
        }
      }

      const avgPct = weeks.length > 0 ? Math.round(totalPct / weeks.length) : 0;

      resources.push({
        resourceName: profile.resourceName,
        resourceAccountId: profile.resourceAccountId,
        weeklyUtilization: profile.overallWeeklyUtilization,
        weeklyHours,
        weeklyState: profile.overallWeeklyState,
        averageUtilization: avgPct,
        isOverAllocated: hasOverAllocated,
        allocatedTaskCount: profile.allocations.length
      });
    }

    // Sort: over-allocated resources first, then alphabetical
    resources.sort((a, b) => {
      if (a.isOverAllocated && !b.isOverAllocated) return -1;
      if (!a.isOverAllocated && b.isOverAllocated) return 1;
      return a.resourceName.localeCompare(b.resourceName);
    });

    const weeklySummaries: Record<string, WeeklyUtilizationSummary> = {};
    const bottleneckWeeks: string[] = [];

    const activeResourceCount = resources.length;
    const teamWeeklyCapacity = activeResourceCount * weeklyCapacityHours;

    for (let i = 0; i < weeks.length; i++) {
      const week = weeks[i];
      let weekTotalHours = 0;
      let overCount = 0;
      let underCount = 0;

      for (const res of resources) {
        const pct = res.weeklyUtilization[week.weekKey] || 0;
        const hrs = res.weeklyHours[week.weekKey] || 0;
        weekTotalHours += hrs;

        if (pct > 100) {
          overCount++;
        } else if (pct < 70) {
          underCount++;
        }
      }

      const avgPct = teamWeeklyCapacity > 0
        ? Math.round((weekTotalHours / teamWeeklyCapacity) * 100)
        : 0;

      let state: UtilizationState = 'UNPLANNED';
      if (avgPct === 0) {
        state = 'UNPLANNED';
      } else if (avgPct > 100 || overCount > 0) {
        state = 'OVER_ALLOCATED';
      } else if (avgPct === 100) {
        state = i <= currentWeekIndex ? 'PAST_UTILIZED' : 'FUTURE_PLANNED';
      } else {
        state = 'UNDER_UTILIZED';
      }

      weeklySummaries[week.weekKey] = {
        weekKey: week.weekKey,
        totalCapacityHours: teamWeeklyCapacity,
        totalAllocatedHours: Math.round(weekTotalHours * 10) / 10,
        averageUtilizationPercent: avgPct,
        overAllocatedCount: overCount,
        underAllocatedCount: underCount,
        status: state
      };

      if (overCount > 0 || avgPct > 100) {
        bottleneckWeeks.push(week.weekKey);
      }
    }

    return {
      weeks,
      resources,
      weeklySummaries,
      unassignedTasks,
      unassignedTotalHours,
      bottleneckWeeks
    };
  }
}
