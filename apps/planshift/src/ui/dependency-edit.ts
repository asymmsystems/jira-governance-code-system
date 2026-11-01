/*
 * Copyright (c) 2026 Asymm Systems. All rights reserved.
 *
 * @author Fahim Farook
 */

/**
 * Pure functions for editing dependency relationships and trigger percentages.
 */

import { earliestStart, ScheduleEffort } from '../domain/schedule-engine';

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
