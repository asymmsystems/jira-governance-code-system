/**
 * CascadePlan: Scope Creep Detection & Baseline Freezing Engine
 * Freezes commitment baselines, audits variance in scope and timeline,
 * and manages formal scope shift approval requests.
 */

import { WbsTask } from './models';

export interface BaselineTaskSnapshot {
  id: string;
  key?: string;
  summary: string;
  effortHours: number;
  startWeek?: string;
  endWeek?: string;
  spanWeeks?: number;
  resource?: string;
  status?: string;
}

export interface PlanBaseline {
  baselineId: string;
  planId: string;
  projectKey: string;
  name: string;
  frozenAt: string;
  frozenBy: string;
  tasks: Record<string, BaselineTaskSnapshot>;
  totalCommitmentHours: number;
  totalTaskCount: number;
  metadata?: Record<string, unknown>;
}

export type ScopeShiftStatus = 'PENDING' | 'APPROVED' | 'REJECTED';

export interface ScopeShiftRequest {
  shiftId: string;
  planId: string;
  baselineId: string;
  projectKey: string;
  requestedBy: string;
  requestedAt: string;
  status: ScopeShiftStatus;
  deltaHours: number;
  reason: string;
  addedTaskKeys: string[];
  removedTaskKeys: string[];
  modifiedTaskKeys: string[];
  reviewedBy?: string;
  reviewedAt?: string;
  reviewComment?: string;
}

export interface ModifiedTaskDiff {
  id: string;
  key?: string;
  summary: string;
  baselineEffort: number;
  currentEffort: number;
  deltaEffort: number;
  scheduleChanged: boolean;
  oldSchedule: { startWeek?: string; endWeek?: string; spanWeeks?: number };
  newSchedule: { startWeek?: string; endWeek?: string; spanWeeks?: number };
}

export interface ScopeCreepReport {
  baselineId: string;
  baselineName: string;
  frozenAt: string;
  frozenBy: string;
  isCreeping: boolean;
  baselineHours: number;
  currentHours: number;
  deltaHours: number;
  creepPercentage: number;
  baselineTaskCount: number;
  currentTaskCount: number;
  deltaTaskCount: number;
  addedTasks: Array<{ id: string; key?: string; summary: string; effortHours: number }>;
  removedTasks: Array<{ id: string; key?: string; summary: string; effortHours: number }>;
  modifiedTasks: ModifiedTaskDiff[];
  pendingShiftRequests: ScopeShiftRequest[];
  hasPendingApproval: boolean;
}

export class ScopeCreepEngine {
  public static freezeBaseline(
    planId: string,
    projectKey: string,
    name: string,
    frozenBy: string,
    tasks: WbsTask[]
  ): PlanBaseline {
    const baselineId = `bl-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;
    const taskMap: Record<string, BaselineTaskSnapshot> = {};
    let totalHours = 0;

    for (const task of tasks) {
      const effort = task.effortHours || 1;
      totalHours += effort;
      taskMap[task.id] = {
        id: task.id,
        key: task.key,
        summary: task.summary,
        effortHours: effort,
        startWeek: task.startWeek,
        endWeek: task.endWeek,
        spanWeeks: task.spanWeeks,
        resource: task.resource,
        status: task.status
      };
    }

    return {
      baselineId,
      planId,
      projectKey,
      name: name.trim() || `Baseline ${new Date().toISOString().slice(0, 10)}`,
      frozenAt: new Date().toISOString(),
      frozenBy: frozenBy.trim() || 'system',
      tasks: taskMap,
      totalCommitmentHours: Math.round(totalHours * 10) / 10,
      totalTaskCount: tasks.length
    };
  }

  public static detectScopeCreep(
    baseline: PlanBaseline,
    currentTasks: WbsTask[],
    pendingRequests: ScopeShiftRequest[] = []
  ): ScopeCreepReport {
    const currentTaskMap = new Map<string, WbsTask>();
    let currentTotalHours = 0;

    for (const t of currentTasks) {
      currentTaskMap.set(t.id, t);
      currentTotalHours += (t.effortHours || 1);
    }

    const addedTasks: Array<{ id: string; key?: string; summary: string; effortHours: number }> = [];
    const removedTasks: Array<{ id: string; key?: string; summary: string; effortHours: number }> = [];
    const modifiedTasks: ModifiedTaskDiff[] = [];

    // Check existing baseline tasks against current
    for (const baseId of Object.keys(baseline.tasks)) {
      const baseTask = baseline.tasks[baseId];
      const curTask = currentTaskMap.get(baseId);

      if (!curTask) {
        removedTasks.push({
          id: baseTask.id,
          key: baseTask.key,
          summary: baseTask.summary,
          effortHours: baseTask.effortHours
        });
      } else {
        const curEffort = curTask.effortHours || 1;
        const deltaEffort = Math.round((curEffort - baseTask.effortHours) * 10) / 10;
        const schedChanged =
          baseTask.startWeek !== curTask.startWeek ||
          baseTask.endWeek !== curTask.endWeek ||
          baseTask.spanWeeks !== curTask.spanWeeks;

        if (deltaEffort !== 0 || schedChanged) {
          modifiedTasks.push({
            id: curTask.id,
            key: curTask.key,
            summary: curTask.summary,
            baselineEffort: baseTask.effortHours,
            currentEffort: curEffort,
            deltaEffort,
            scheduleChanged: schedChanged,
            oldSchedule: {
              startWeek: baseTask.startWeek,
              endWeek: baseTask.endWeek,
              spanWeeks: baseTask.spanWeeks
            },
            newSchedule: {
              startWeek: curTask.startWeek,
              endWeek: curTask.endWeek,
              spanWeeks: curTask.spanWeeks
            }
          });
        }
      }
    }

    // Check newly added tasks
    for (const curTask of currentTasks) {
      if (!baseline.tasks[curTask.id]) {
        addedTasks.push({
          id: curTask.id,
          key: curTask.key,
          summary: curTask.summary,
          effortHours: curTask.effortHours || 1
        });
      }
    }

    const deltaHours = Math.round((currentTotalHours - baseline.totalCommitmentHours) * 10) / 10;
    const creepPct = baseline.totalCommitmentHours > 0
      ? Math.round((deltaHours / baseline.totalCommitmentHours) * 1000) / 10
      : 0;

    const deltaTaskCount = currentTasks.length - baseline.totalTaskCount;
    const isCreeping = deltaHours > 0 || addedTasks.length > 0 || modifiedTasks.some(m => m.deltaEffort > 0);

    const activePending = pendingRequests.filter(
      r => r.baselineId === baseline.baselineId && r.status === 'PENDING'
    );

    return {
      baselineId: baseline.baselineId,
      baselineName: baseline.name,
      frozenAt: baseline.frozenAt,
      frozenBy: baseline.frozenBy,
      isCreeping,
      baselineHours: baseline.totalCommitmentHours,
      currentHours: Math.round(currentTotalHours * 10) / 10,
      deltaHours,
      creepPercentage: creepPct,
      baselineTaskCount: baseline.totalTaskCount,
      currentTaskCount: currentTasks.length,
      deltaTaskCount,
      addedTasks,
      removedTasks,
      modifiedTasks,
      pendingShiftRequests: activePending,
      hasPendingApproval: activePending.length > 0
    };
  }

  public static createShiftRequest(
    baseline: PlanBaseline,
    currentTasks: WbsTask[],
    requestedBy: string,
    reason: string
  ): ScopeShiftRequest {
    const report = this.detectScopeCreep(baseline, currentTasks);
    const shiftId = `shift-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;

    const addedKeys = report.addedTasks.map(t => t.key || t.id);
    const removedKeys = report.removedTasks.map(t => t.key || t.id);
    const modifiedKeys = report.modifiedTasks.map(t => t.key || t.id);

    return {
      shiftId,
      planId: baseline.planId,
      baselineId: baseline.baselineId,
      projectKey: baseline.projectKey,
      requestedBy: requestedBy.trim() || 'anonymous',
      requestedAt: new Date().toISOString(),
      status: 'PENDING',
      deltaHours: report.deltaHours,
      reason: reason.trim() || 'Scope expansion during sprint execution',
      addedTaskKeys: addedKeys,
      removedTaskKeys: removedKeys,
      modifiedTaskKeys: modifiedKeys
    };
  }

  public static reviewShiftRequest(
    request: ScopeShiftRequest,
    status: 'APPROVED' | 'REJECTED',
    reviewedBy: string,
    reviewComment?: string
  ): ScopeShiftRequest {
    return {
      ...request,
      status,
      reviewedBy: reviewedBy.trim() || 'system',
      reviewedAt: new Date().toISOString(),
      reviewComment: reviewComment ? reviewComment.trim() : undefined
    };
  }
}
