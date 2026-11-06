/*
 * Copyright (c) 2026 Asymm Systems. All rights reserved.
 *
 * @author Fahim Farook
 */

/**
 * CascadePlan: the accessible treegrid layer of the timeline (pure; B-15). Cell text and row
 * levels for each row, arrow-key navigation, and the keyboard move mode with its announcements.
 */

import { progressText } from './progress-status';

export const GRID_COLUMNS = ['Key', 'Summary', 'Start', 'Due', 'Progress', 'Status', 'Dependencies'];

export interface GridPos { row: number; col: number }

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

/** Next cell for a navigation key (ARIA grid pattern), or null for any other key. */
export function navigate(pos: GridPos, e: { key: string; ctrlKey: boolean }, rows: number, cols: number, page: number): GridPos | null {
  const last = rows - 1;
  switch (e.key) {
    case 'ArrowDown': return { row: clamp(pos.row + 1, 0, last), col: pos.col };
    case 'ArrowUp': return { row: clamp(pos.row - 1, 0, last), col: pos.col };
    case 'ArrowRight': return { row: pos.row, col: clamp(pos.col + 1, 0, cols - 1) };
    case 'ArrowLeft': return { row: pos.row, col: clamp(pos.col - 1, 0, cols - 1) };
    case 'Home': return e.ctrlKey ? { row: 0, col: pos.col } : { row: pos.row, col: 0 };
    case 'End': return e.ctrlKey ? { row: last, col: pos.col } : { row: pos.row, col: cols - 1 };
    case 'PageDown': return { row: clamp(pos.row + page, 0, last), col: pos.col };
    case 'PageUp': return { row: clamp(pos.row - page, 0, last), col: pos.col };
    default: return null;
  }
}

const STATUS: Record<string, string> = { NOT_STARTED: 'Not started', IN_PROGRESS: 'In progress', COMPLETED: 'Done' };

/** A dependency as a sentence, e.g. "Starts when ABC-12 reaches 30% (2026-11-10)". */
export function dependencyText(dep: { predecessorKey?: string; triggerPercent?: number; triggerDate?: string; isViolated?: boolean } | null | undefined): string {
  if (!dep || !dep.predecessorKey) return 'None';
  const when = dep.triggerDate ? ` (${dep.triggerDate})` : '';
  return `Starts when ${dep.predecessorKey} reaches ${dep.triggerPercent}%${when}` + (dep.isViolated ? '. Starts too early' : '');
}

/** Text of the seven cells of a row, in GRID_COLUMNS order. */
export function rowCells(t: any): string[] {
  return [t.key, t.summary || 'No summary', t.startDate || 'Not scheduled', t.endDate || 'Not scheduled', progressText(t),
    STATUS[t.status] || t.status, dependencyText(t.dependency)];
}

/** aria-level: epics 1, a story under an epic on the plan 2, a sub-task one level below its parent. */
export function rowLevel(t: any, planKeys: Set<string>): number {
  if (t.isEpic || t.hierarchyLevel === 1) return 1;
  if (t.isSubtask || t.hierarchyLevel === -1) return t.parentKey && planKeys.has(t.parentKey) ? 3 : 2;
  return t.epicKey && planKeys.has(t.epicKey) ? 2 : 1;
}

export interface MoveState { key: string; start: number; end: number }

/** One key in move mode: day shifts of the start and end, or commit or cancel. */
export function moveKey(s: MoveState, e: { key: string; shiftKey: boolean }): { state: MoveState; action: 'move' | 'commit' | 'cancel' | null } {
  const step = e.shiftKey ? 7 : 1;
  switch (e.key) {
    case 'ArrowRight': return { state: { ...s, start: s.start + step, end: s.end + step }, action: 'move' };
    case 'ArrowLeft': return { state: { ...s, start: s.start - step, end: s.end - step }, action: 'move' };
    case ']': return { state: { ...s, end: s.end + 1 }, action: 'move' };
    case '[': return { state: { ...s, end: s.end - 1 }, action: 'move' };
    case 'Enter': return { state: s, action: 'commit' };
    case 'Escape': return { state: s, action: 'cancel' };
    default: return { state: s, action: null };
  }
}

/** Text for the aria-live region: the keys on entering move mode, then the dates after each move. */
export function moveAnnouncement(key: string, start: string, end: string, entering: boolean): string {
  const dates = `${key}: ${start} to ${end}.`;
  return entering
    ? `Move mode for ${dates} Left and Right move 1 day, with Shift 1 week; [ and ] change the due date; Enter saves; Escape cancels.`
    : dates;
}
