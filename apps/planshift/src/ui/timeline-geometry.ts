/*
 * Copyright (c) 2026 Asymm Systems. All rights reserved.
 *
 * @author Fahim Farook
 */

/**
 * CascadePlan: geometry of the canvas timeline (pure, no DOM access; B-13).
 * Bars are placed by exact dates in days from the first visible week; an end date is inclusive.
 */

import { cascade, addDays, ScheduleEffort, ScheduleLink } from '../domain/schedule-engine';

/** Pointer hit area of a resize handle, centred on the bar edge (WCAG 2.5.8, UR-04). */
export const HANDLE_PX = 24;

const DAY_MS = 86400000;

export function daysBetween(fromIso: string, toIso: string): number {
  return Math.round((Date.parse(`${toIso}T00:00:00Z`) - Date.parse(`${fromIso}T00:00:00Z`)) / DAY_MS);
}

export function xForDate(iso: string, originIso: string, dayPx: number): number {
  return daysBetween(originIso, iso) * dayPx;
}

export interface Rect { x: number; y: number; w: number; h: number }

/** Bar rectangle for a task row at rowTop, or null when the task has no start date. */
export function barRect(task: { startDate?: string; endDate?: string }, originIso: string, dayPx: number, rowTop: number, rowH: number, barH: number): Rect | null {
  if (!task.startDate) return null;
  const x = xForDate(task.startDate, originIso, dayPx);
  const end = task.endDate && task.endDate >= task.startDate ? task.endDate : task.startDate;
  const w = Math.max(dayPx, (daysBetween(task.startDate, end) + 1) * dayPx);
  return { x, y: rowTop + (rowH - barH) / 2, w, h: barH };
}

/** Rows inside the viewport plus a buffer each side. */
export function visibleRange(scrollTop: number, viewportH: number, rowH: number, count: number, buffer: number): { first: number; last: number } {
  if (count === 0) return { first: 0, last: -1 };
  const first = Math.max(0, Math.floor(scrollTop / rowH) - buffer);
  const last = Math.min(count - 1, Math.ceil((scrollTop + viewportH) / rowH) + buffer);
  return { first, last };
}

/**
 * Resize handle positions relative to the bar's left edge. A wide bar has 24 px handles centred on
 * its edges; a narrow bar has them just outside, so the body stays reachable for a drag.
 */
export function handleOffsets(barW: number): { left: number; right: number } {
  if (barW >= HANDLE_PX * 2) return { left: -HANDLE_PX / 2, right: barW - HANDLE_PX / 2 };
  return { left: -HANDLE_PX, right: barW };
}

/** Days for a horizontal drag, snapped to whole weeks or whole days. */
export function snapDays(deltaPx: number, dayPx: number, mode: 'week' | 'day'): number {
  const days = mode === 'week' ? Math.round(deltaPx / (dayPx * 7)) * 7 : Math.round(deltaPx / dayPx);
  return days === 0 ? 0 : days;
}

interface PreviewTask {
  key: string;
  startDate?: string;
  endDate?: string;
  progress?: number;
  status?: string;
  dependency?: { predecessorKey?: string; triggerPercent?: number } | null;
  dependencies?: Array<{ predecessorKey?: string; triggerPercent?: number }>;
}

/**
 * Dates of the dragged task (start and end shifted by days) and of every dependent the schedule
 * engine would move, for the live preview while dragging (UR-05). Uses the same engine as the server.
 */
export function previewMoves(tasks: PreviewTask[], key: string, startShift: number, endShift: number, today: string): Map<string, { start: string; end: string }> {
  const out = new Map<string, { start: string; end: string }>();
  const target = tasks.find(t => t.key === key);
  if (!target || !target.startDate) return out;
  const start = addDays(target.startDate, startShift);
  let end = addDays(target.endDate || target.startDate, endShift);
  if (end < start) end = start;
  out.set(key, { start, end });
  const efforts = new Map<string, ScheduleEffort>();
  const links: ScheduleLink[] = [];
  for (const t of tasks) {
    if (!t.startDate) continue;
    const moved = t.key === key;
    efforts.set(t.key, { workEffortId: t.key, estimatedStartDate: moved ? start : t.startDate, estimatedCompletionDate: moved ? end : (t.endDate || t.startDate),
      percentComplete: t.progress || 0, started: t.status === 'IN_PROGRESS' || t.status === 'COMPLETED' });
    for (const d of t.dependencies || (t.dependency ? [t.dependency] : [])) {
      if (d.predecessorKey && typeof d.triggerPercent === 'number') {
        links.push({ workEffortIdFrom: d.predecessorKey, workEffortIdTo: t.key, workEffortAssocTypeId: 'WORK_EFF_PRECEDENCY', triggerPercent: d.triggerPercent });
      }
    }
  }
  try {
    for (const c of cascade(efforts, links, key, today).changes) out.set(c.key, { start: c.toStart, end: c.toEnd });
  } catch {
    // A cycle shows no preview of dependents; the server rejects cycles on save.
  }
  return out;
}
