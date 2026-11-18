/*
 * Copyright (c) 2026 Asymm Systems. All rights reserved.
 *
 * @author Fahim Farook
 */

/**
 * CascadePlan: the start date of a Backlog item dropped on the planner (TASK-00003, the owner's
 * option 2 of 2026-11-18). One rule: the day under the pointer wherever a date is under the pointer
 * (the timeline part of a row, and the empty timeline below the rows), and today everywhere else
 * (the grid columns of a row, the two "Drop here" rows, an empty plan, "+ Schedule"). At Month zoom
 * and wider the day under the pointer snaps to its Monday, as the timeline itself does (B-27).
 *
 * The pointer is measured from the left edge of the timeline, never from the edge of the scroll
 * wrapper: the wrapper also holds the grid columns, so measuring from its edge added their width
 * and a drop below the rows started weeks after the day under the pointer.
 */

import { dateAt, mondayOf } from './time-scale';

export interface BacklogDropInput {
  /** The pointer's x in the viewport (clientX). */
  pointerX: number;
  /**
   * The viewport x of the timeline's left edge (the date origin), or null when no timeline is under
   * the pointer (a grid column, a "Drop here" row, an empty plan, "+ Schedule").
   */
  timelineLeft: number | null;
  /**
   * The viewport x where the visible timeline begins: the right edge of the frozen grid columns,
   * which stay in place while the timeline scrolls under them. Left of it no date is visible.
   * Defaults to timelineLeft.
   */
  visibleLeft?: number;
  originIso: string;
  dayPx: number;
  /** True at Month zoom and wider, where the timeline snaps to Mondays. */
  snapWeek: boolean;
  todayIso: string;
}

/** The start date for a Backlog drop (see the rule above). */
export function backlogDropStart(input: BacklogDropInput): string {
  const { pointerX, timelineLeft, originIso, dayPx, snapWeek, todayIso } = input;
  if (timelineLeft === null || !Number.isFinite(timelineLeft) || !(dayPx > 0)) return todayIso;
  const visibleLeft = Number.isFinite(input.visibleLeft) ? Math.max(timelineLeft, input.visibleLeft as number) : timelineLeft;
  if (pointerX < visibleLeft) return todayIso;
  const day = dateAt(pointerX - timelineLeft, originIso, dayPx);
  return snapWeek ? mondayOf(day) : day;
}
