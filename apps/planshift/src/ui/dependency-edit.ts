/*
 * Copyright (c) 2026 Asymm Systems. All rights reserved.
 *
 * @author Fahim Farook
 */

/**
 * Pure functions for editing dependency relationships and trigger percentages.
 */

import { earliestStart, addDays, ScheduleEffort } from '../domain/schedule-engine';
import { daysBetween } from './timeline-geometry';

/** Clamps a percentage value to the valid range [0, 100]. */
export function clampTriggerPercent(value: number | string | undefined | null): number {
  if (value === undefined || value === null) return 100;
  const num = typeof value === 'number' ? value : parseInt(String(value), 10);
  if (isNaN(num)) return 100;
  return Math.max(0, Math.min(100, num));
}

/** Formats the title for a dependency edit popover. */
export function dependencyPopoverTitle(predKey: string, succKey: string): string {
  return `${predKey} ➔ ${succKey}`;
}

export interface EditableDependencyLink {
  predecessorKey: string;
  successorKey: string;
  triggerPercent: number;
  isViolated: boolean;
  isNew?: boolean;
}

/**
 * Builds a dependency link when dragging a connector from Task A (sourceKey) onto Task B (targetKey).
 * side === 'right' (forward link port): sourceKey is Predecessor, targetKey is Successor (targetKey depends on sourceKey).
 * side === 'left' (backward link port): targetKey is Predecessor, sourceKey is Successor (sourceKey depends on targetKey).
 */
export function buildDraggedDependencyLink(
  sourceKey: string,
  targetKey: string,
  triggerPercent = 100,
  side: 'right' | 'left' = 'right'
): EditableDependencyLink {
  const isRight = side === 'right';
  return {
    predecessorKey: isRight ? sourceKey : targetKey,
    successorKey: isRight ? targetKey : sourceKey,
    triggerPercent: clampTriggerPercent(triggerPercent),
    isViolated: false,
    isNew: true
  };
}

/**
 * Reverses predecessor and successor on a dependency link while preserving triggerPercent.
 */
export function swapDependencyDirection<T extends { predecessorKey: string; successorKey: string }>(link: T): T {
  return {
    ...link,
    predecessorKey: link.successorKey,
    successorKey: link.predecessorKey
  };
}

/** Formats text for a dependency badge on the canvas timeline. */
export function formatDependencyBadge(dep: { triggerPercent?: number; triggerDate?: string; isViolated?: boolean }): string {
  const pct = typeof dep.triggerPercent === 'number' ? dep.triggerPercent : 100;
  const when = dep.triggerDate ? `, ${dep.triggerDate}` : '';
  const reason = dep.isViolated ? ': starts too early' : '';
  return `${pct}%${when}${reason}`;
}

export interface DependencyPreview {
  isSatisfied: boolean;
  earliestStartDate: string | null;
  triggerDate: string | null;
  summary: string;
}

/**
 * Computes the earliest start date and summary for a successor task based on predecessor progress and dates.
 */
export function computeDependencyPreview(
  pred: { key: string; startDate?: string; endDate?: string; progress?: number; status?: string },
  triggerPercent: number,
  today: string
): DependencyPreview {
  if (!pred.startDate) {
    return {
      isSatisfied: false,
      earliestStartDate: null,
      triggerDate: null,
      summary: 'Predecessor has no planned start date.'
    };
  }

  const effort: ScheduleEffort = {
    workEffortId: pred.key,
    estimatedStartDate: pred.startDate,
    estimatedCompletionDate: pred.endDate || pred.startDate,
    percentComplete: pred.progress || 0,
    started: pred.status === 'IN_PROGRESS' || pred.status === 'COMPLETED'
  };

  const res = earliestStart(effort, triggerPercent, today);
  return {
    isSatisfied: res.basis === 'satisfied',
    earliestStartDate: res.date,
    triggerDate: res.triggerDate,
    summary: res.reason
  };
}

export interface DependencyConflictResult {
  hasConflict: boolean;
  predKey?: string;
  triggerPercent?: number;
  earliestDate?: string | null;
  triggerDate?: string | null;
  reason?: string;
}

/**
 * Checks whether a candidate task move conflicts with any of its incoming predecessor milestones.
 */
export function checkDependencyConflict(
  task: { key: string; startDate?: string },
  tasks: any[],
  today: string
): DependencyConflictResult {
  if (!task.startDate) return { hasConflict: false };
  const target = tasks.find(t => t.key === task.key);
  if (!target) return { hasConflict: false };

  const deps = target.dependencies || (target.dependency ? [target.dependency] : []);
  for (const dep of deps) {
    if (!dep || !dep.predecessorKey) continue;
    const pred = tasks.find(t => t.key === dep.predecessorKey);
    if (!pred || !pred.startDate) continue;
    const triggerPercent = typeof dep.triggerPercent === 'number' ? dep.triggerPercent : 100;
    const preview = computeDependencyPreview(pred, triggerPercent, today);
    if (preview.earliestStartDate && task.startDate < preview.earliestStartDate) {
      return {
        hasConflict: true,
        predKey: pred.key,
        triggerPercent,
        earliestDate: preview.earliestStartDate,
        triggerDate: preview.triggerDate,
        reason: preview.summary
      };
    }
  }
  return { hasConflict: false };
}

/**
 * Shifts candidate dates forward to earliest start preserving duration.
 */
export function clampToEarliestStart(
  candidateStart: string,
  candidateEnd: string,
  earliestDate: string | null
): { startDate: string; endDate: string } {
  if (!earliestDate || candidateStart >= earliestDate) {
    return { startDate: candidateStart, endDate: candidateEnd };
  }
  const diffDays = daysBetween(candidateStart, earliestDate);
  return {
    startDate: earliestDate,
    endDate: addDays(candidateEnd, diffDays)
  };
}

/**
 * Suggests maximum trigger percentage on a predecessor allowing successor start date.
 */
export function suggestTriggerToFit(
  pred: { key: string; startDate?: string; endDate?: string },
  succStartDate: string
): number {
  if (!pred.startDate || succStartDate <= pred.startDate) return 0;
  const predEnd = pred.endDate || pred.startDate;
  const totalDays = Math.max(1, daysBetween(pred.startDate, predEnd) + 1);
  const elapsedDays = Math.max(0, daysBetween(pred.startDate, succStartDate));
  const pct = Math.floor((elapsedDays / totalDays) * 100);
  return Math.max(0, Math.min(100, pct));
}
