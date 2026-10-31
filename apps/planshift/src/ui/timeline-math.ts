/*
 * Copyright (c) 2026 Asymm Systems. All rights reserved.
 *
 * @author Fahim Farook
 */

/**
 * CascadePlan: pure timeline geometry used by the planner UI (no DOM access).
 */

export interface WeekLike {
  weekKey: string;
}

/**
 * Index of a week by key, or the fallback index when the key is missing or unknown.
 */
export function weekIndexOf(weeks: WeekLike[], weekKey: string | undefined, fallback: number): number {
  if (!weekKey) return fallback;
  const idx = weeks.findIndex(w => w.weekKey === weekKey);
  return idx === -1 ? fallback : idx;
}

/**
 * Converts a horizontal drag distance in pixels into whole weeks.
 */
export function deltaWeeksFromPixels(deltaX: number, weekWidth: number): number {
  const weeks = Math.round(deltaX / weekWidth);
  return weeks === 0 ? 0 : weeks;
}

/**
 * Start index after a move, kept so that the whole bar stays inside the window.
 */
export function clampStartIndex(origStartIdx: number, deltaWeeks: number, span: number, weekCount: number): number {
  const maxStart = Math.max(0, weekCount - span);
  return Math.max(0, Math.min(maxStart, origStartIdx + deltaWeeks));
}

/**
 * New start index and span after dragging the left or the right edge of a bar.
 */
export function spanFromResize(
  edge: 'left' | 'right',
  origStartIdx: number,
  origSpan: number,
  deltaWeeks: number,
  weekCount: number
): { startIdx: number; span: number } {
  if (edge === 'right') {
    const span = Math.max(1, Math.min(weekCount - origStartIdx, origSpan + deltaWeeks));
    return { startIdx: origStartIdx, span };
  }
  const origEndIdx = Math.min(weekCount - 1, origStartIdx + origSpan - 1);
  const startIdx = Math.max(0, Math.min(origEndIdx, origStartIdx + deltaWeeks));
  return { startIdx, span: Math.max(1, origEndIdx - startIdx + 1) };
}
