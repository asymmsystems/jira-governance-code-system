/*
 * Copyright (c) 2026 Asymm Systems. All rights reserved.
 *
 * @author Fahim Farook
 */

/**
 * CascadePlan: the time axis of the timeline, computed in the browser (pure; B-27). Zoom levels set
 * the pixels per day and the snap unit; the range starts on a Monday and grows at either edge as the
 * user scrolls, so the timeline is not limited to the server's week list.
 */

import { addDays } from '../domain/schedule-engine';
import { daysBetween } from './timeline-geometry';

export type ZoomId = 'day' | 'week' | 'month' | 'quarter' | 'year';

export interface Zoom { id: ZoomId; label: string; dayPx: number; snap: 'day' | 'week' }

/** From the closest to the widest view. Week zoom keeps the 85 px week of the earlier grid. */
export const ZOOMS: Zoom[] = [
  { id: 'day', label: 'Day', dayPx: 40, snap: 'day' },
  { id: 'week', label: 'Week', dayPx: 85 / 7, snap: 'day' },
  { id: 'month', label: 'Month', dayPx: 4, snap: 'week' },
  { id: 'quarter', label: 'Quarter', dayPx: 1.5, snap: 'week' },
  { id: 'year', label: 'Year', dayPx: 0.5, snap: 'week' }
];

export function zoomById(id: ZoomId): Zoom {
  return ZOOMS.find(z => z.id === id) || ZOOMS[1];
}

/** dir 1 zooms in (toward Day), -1 zooms out (toward Year). */
export function zoomStep(id: ZoomId, dir: 1 | -1): ZoomId {
  const i = ZOOMS.findIndex(z => z.id === id);
  return ZOOMS[Math.max(0, Math.min(ZOOMS.length - 1, i - dir))].id;
}

export interface TimeRange { start: string; end: string }

export function mondayOf(iso: string): string {
  const dow = new Date(`${iso}T00:00:00Z`).getUTCDay();
  return addDays(iso, -((dow + 6) % 7));
}

/** 52 weeks from the Monday 8 weeks before today. */
export function initialRange(today: string): TimeRange {
  const start = addDays(mondayOf(today), -56);
  return { start, end: addDays(start, 52 * 7 - 1) };
}

export function rangeDays(r: TimeRange): number {
  return daysBetween(r.start, r.end) + 1;
}

export function extendRange(r: TimeRange, side: 'before' | 'after', weeks: number): TimeRange {
  return side === 'before' ? { start: addDays(r.start, -weeks * 7), end: r.end } : { start: r.start, end: addDays(r.end, weeks * 7) };
}

/** The edge the scroll position is within one viewport of, if any. */
export function edgeToExtend(scrollLeft: number, viewportW: number, trackW: number): 'before' | 'after' | null {
  if (scrollLeft < viewportW / 2) return 'before';
  if (scrollLeft + viewportW > trackW - viewportW / 2) return 'after';
  return null;
}

export interface HeaderCell { key: string; label: string; x: number; w: number; current: boolean }

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function parts(iso: string): { y: number; m: number; d: number; dow: number } {
  const dt = new Date(`${iso}T00:00:00Z`);
  return { y: dt.getUTCFullYear(), m: dt.getUTCMonth(), d: dt.getUTCDate(), dow: dt.getUTCDay() };
}

const iso = (y: number, m: number, d: number) => new Date(Date.UTC(y, m, d)).toISOString().slice(0, 10);

/** Start of the unit that contains a day, and the start of the next unit. */
function unitBounds(day: string, zoom: Zoom): [string, string] {
  const p = parts(day);
  switch (zoom.id) {
    case 'day': return [day, addDays(day, 1)];
    case 'week': return [mondayOf(day), addDays(mondayOf(day), 7)];
    case 'month': return [iso(p.y, p.m, 1), iso(p.y, p.m + 1, 1)];
    case 'quarter': return [iso(p.y, p.m - (p.m % 3), 1), iso(p.y, p.m - (p.m % 3) + 3, 1)];
    default: return [iso(p.y, 0, 1), iso(p.y + 1, 0, 1)];
  }
}

function label(start: string, zoom: Zoom): string {
  const p = parts(start);
  switch (zoom.id) {
    case 'day': return `${DAYS[p.dow]} ${p.d}`;
    case 'week': return `${String(p.d).padStart(2, '0')}-${MONTHS[p.m]}`;
    case 'month': return `${MONTHS[p.m]} ${p.y}`;
    case 'quarter': return `Q${Math.floor(p.m / 3) + 1} ${p.y}`;
    default: return String(p.y);
  }
}

/** One cell per unit of the zoom, clipped to the range; only cells inside [fromX, toX] when given. */
export function headerCells(r: TimeRange, zoom: Zoom, today: string, fromX = -Infinity, toX = Infinity): HeaderCell[] {
  const out: HeaderCell[] = [];
  const total = rangeDays(r);
  let day = r.start;
  while (daysBetween(r.start, day) < total) {
    const [, next] = unitBounds(day, zoom);
    const x = daysBetween(r.start, day) * zoom.dayPx;
    const w = Math.min(daysBetween(day, next), total - daysBetween(r.start, day)) * zoom.dayPx;
    if (x + w > fromX && x < toX) {
      const [uStart] = unitBounds(day, zoom);
      out.push({ key: uStart, label: label(uStart, zoom), x, w, current: today >= uStart && today < next });
    }
    day = next;
  }
  return out;
}

/** x of every unit boundary inside [fromX, toX]. */
export function gridLines(r: TimeRange, zoom: Zoom, fromX: number, toX: number): number[] {
  return headerCells(r, zoom, '', fromX, toX).map(c => c.x).filter(x => x >= fromX && x <= toX);
}

/** scrollLeft (relative to the track start) that puts a date at viewportX. */
export function anchorScroll(anchorIso: string, viewportX: number, originIso: string, dayPx: number): number {
  return daysBetween(originIso, anchorIso) * dayPx - viewportX;
}

/** The day at an x on the track. */
export function dateAt(x: number, originIso: string, dayPx: number): string {
  return addDays(originIso, Math.floor(x / dayPx));
}

/** Fewer weeks than this with all data columns turns on compact columns at first render. */
export const MIN_VISIBLE_WEEKS = 6;

/**
 * Compact columns: the user's own choice when there is one; otherwise on when the data columns would
 * leave fewer than MIN_VISIBLE_WEEKS of timeline (owner decision 2026-11-01).
 */
export function shouldAutoCompact(viewportW: number, columnsW: number, weekPx: number, userChoice: string | null): boolean {
  if (userChoice === 'on' || userChoice === 'off') return userChoice === 'on';
  return (viewportW - columnsW) / weekPx < MIN_VISIBLE_WEEKS;
}
