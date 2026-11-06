/*
 * Copyright (c) 2026 Asymm Systems. All rights reserved.
 *
 * @author Fahim Farook
 */

/**
 * CascadePlan: the dates of each sub-task when its parent moves as a block (ADR-003, N-05).
 *
 * A parent has no dates of its own; its bar is the roll-up of its sub-tasks. Moving it by N days
 * moves each sub-task by its state:
 * - not started: the start and the end move by N days;
 * - in progress: the start stays, the end moves by N days, never before today or the start;
 * - done: nothing moves;
 * - undated: stays undated.
 * Pure functions, used by the server and by the client preview.
 */

export type BlockState = 'not-started' | 'in-progress' | 'done' | 'undated';

export interface BlockMember {
  key: string;
  startDate?: string;
  endDate?: string;
  /** The planner status: 'NOT_STARTED' | 'IN_PROGRESS' | 'COMPLETED' ... */
  status?: string;
  progress?: number;
}

export interface BlockChange {
  key: string;
  state: BlockState;
  fromStart: string;
  fromEnd: string;
  toStart: string;
  toEnd: string;
}

export interface BlockFixed {
  key: string;
  state: BlockState;
  /** Plain text for the preview, e.g. "done" or "in progress: start kept, end not before today". */
  reason: string;
}

const ISO = /^\d{4}-\d{2}-\d{2}$/;

function addDays(iso: string, days: number): string {
  return new Date(Date.parse(`${iso}T00:00:00Z`) + days * 86400000).toISOString().slice(0, 10);
}

/** The state of a sub-task, as the schedule engine reads it. */
export function blockState(m: BlockMember): BlockState {
  if (!m.startDate || !ISO.test(m.startDate)) return 'undated';
  if (m.status === 'COMPLETED') return 'done';
  // The state comes from the Jira status category only; progress never decides it (INV-03, 2026-11-06).
  if (m.status === 'IN_PROGRESS') return 'in-progress';
  return 'not-started';
}

/** The new dates of each sub-task for a block move by `days`, and the sub-tasks that stay. */
export function planBlockMove(members: BlockMember[], days: number, today: string): { changes: BlockChange[]; fixed: BlockFixed[] } {
  const changes: BlockChange[] = [];
  const fixed: BlockFixed[] = [];
  for (const m of members) {
    const state = blockState(m);
    if (state === 'undated') { fixed.push({ key: m.key, state, reason: 'undated: stays in the backlog' }); continue; }
    if (state === 'done') { fixed.push({ key: m.key, state, reason: 'done: its dates record finished work' }); continue; }
    const fromStart = m.startDate as string;
    const fromEnd = m.endDate && ISO.test(m.endDate) ? m.endDate : fromStart;
    if (state === 'not-started') {
      changes.push({ key: m.key, state, fromStart, fromEnd, toStart: addDays(fromStart, days), toEnd: addDays(fromEnd, days) });
      continue;
    }
    // In progress: the work began on its start, so the start stays.
    let toEnd = addDays(fromEnd, days);
    if (toEnd < today) toEnd = today;
    if (toEnd < fromStart) toEnd = fromStart;
    if (toEnd === fromEnd) fixed.push({ key: m.key, state, reason: 'in progress: start kept, end not before today' });
    else changes.push({ key: m.key, state, fromStart, fromEnd, toStart: fromStart, toEnd });
  }
  return { changes, fixed };
}

/** The roll-up span of dated members after the changes, or null when none is dated. */
export function rollUpAfter(members: BlockMember[], changes: BlockChange[]): { startDate: string; endDate: string } | null {
  const byKey = new Map(changes.map(c => [c.key, c]));
  let start: string | null = null;
  let end: string | null = null;
  for (const m of members) {
    const c = byKey.get(m.key);
    const s = c ? c.toStart : m.startDate;
    const e = c ? c.toEnd : (m.endDate || m.startDate);
    if (!s || !ISO.test(s)) continue;
    if (start === null || s < start) start = s;
    if (e && ISO.test(e) && (end === null || e > end)) end = e;
  }
  return start && end ? { startDate: start, endDate: end } : null;
}
