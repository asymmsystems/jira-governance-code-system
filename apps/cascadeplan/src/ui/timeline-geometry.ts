/*
 * Copyright (c) 2026 Asymm Systems. All rights reserved.
 *
 * @author Fahim Farook
 */

/**
 * CascadePlan: geometry of the canvas timeline (pure, no DOM access; B-13).
 * Bars are placed by exact dates in days from the first visible week; an end date is inclusive.
 */

import { addDays } from '../domain/schedule-engine';
import { DropTask, previewSingleMove } from '../domain/drop-plan';

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

/** Size of a link port (the arrow circle shown on hover at each end of a bar). */
export const PORT_PX = 20;

/**
 * Link port positions relative to the bar's left edge. Each port sits just outside the resize handle
 * of its end, touching it, so the handle (the bar edge) is never covered and the pointer can move from
 * the bar to the port without leaving the bar's hover area.
 */
export function portOffsets(barW: number): { left: number; right: number } {
  const h = handleOffsets(barW);
  return { left: h.left - PORT_PX, right: h.right + HANDLE_PX };
}

export type Point = [number, number];

/** n + 1 points along a cubic Bezier curve, from p0 to p3. */
export function bezierPoints(p0: Point, p1: Point, p2: Point, p3: Point, n = 16): Point[] {
  const out: Point[] = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    const u = 1 - t;
    const a = u * u * u, b = 3 * u * u * t, c = 3 * u * t * t, d = t * t * t;
    out.push([a * p0[0] + b * p1[0] + c * p2[0] + d * p3[0], a * p0[1] + b * p1[1] + c * p2[1] + d * p3[1]]);
  }
  return out;
}

/** The shortest distance from a point to a polyline. */
export function distanceToPath(path: Point[], x: number, y: number): number {
  let best = Infinity;
  for (let i = 0; i < path.length; i++) {
    const [ax, ay] = path[i];
    const [bx, by] = path[Math.min(i + 1, path.length - 1)];
    const dx = bx - ax, dy = by - ay;
    const len2 = dx * dx + dy * dy;
    const t = len2 === 0 ? 0 : Math.max(0, Math.min(1, ((x - ax) * dx + (y - ay) * dy) / len2));
    best = Math.min(best, Math.hypot(x - (ax + t * dx), y - (ay + t * dy)));
  }
  return best;
}

/** The arrow whose line passes nearest to (x, y), within tolerance px, or null. */
export function nearestArrow<T extends { path?: Point[] }>(links: T[], x: number, y: number, tolerance = 6): T | null {
  let best: T | null = null;
  let bestD = tolerance;
  for (const link of links) {
    if (!link.path || link.path.length === 0) continue;
    const d = distanceToPath(link.path, x, y);
    if (d <= bestD) { best = link; bestD = d; }
  }
  return best;
}

/** Days for a horizontal drag, snapped to whole weeks or whole days. */
export function snapDays(deltaPx: number, dayPx: number, mode: 'week' | 'day'): number {
  const days = mode === 'week' ? Math.round(deltaPx / (dayPx * 7)) * 7 : Math.round(deltaPx / dayPx);
  return days === 0 ? 0 : days;
}

/**
 * Dates of the dragged task (start and end shifted by days) and of every task the drop moves, for the
 * live preview while dragging (UR-05). The same computation as the server (src/domain/drop-plan.ts).
 */
export function previewMoves(tasks: DropTask[], key: string, startShift: number, endShift: number, today: string): Map<string, { start: string; end: string }> {
  const target = tasks.find(t => t.key === key);
  const dates = target && shiftDates(target, startShift, endShift);
  if (!dates) return new Map();
  return previewSingleMove({ tasks }, key, dates.start, dates.end, today).moves;
}

/** A task's dates shifted by days at each end (the end never before the start), or null without a start. */
export function shiftDates(task: { startDate?: string; endDate?: string }, startShift: number, endShift: number): { start: string; end: string } | null {
  if (!task.startDate) return null;
  const start = addDays(task.startDate, startShift);
  let end = addDays(task.endDate || task.startDate, endShift);
  if (end < start) end = start;
  return { start, end };
}

/**
 * Total width of frozen columns from an array of visible column keys and a width config.
 * Aligns timeline canvas strictly to the outer boundary of the frozen data table.
 */
export function frozenColumnsWidth(visibleKeys: string[], widths: Record<string, number>): number {
  return visibleKeys.reduce((sum, k) => sum + (widths[k] || 0), 0);
}
