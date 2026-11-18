/*
 * Copyright (c) 2026 Asymm Systems. All rights reserved.
 *
 * @author Fahim Farook
 */

/**
 * TASK-00003, the Backlog drop (owner's option 2, 2026-11-18): the day under the pointer wherever a
 * date is under the pointer (a row's timeline and the empty timeline below the rows), today
 * everywhere else. On master a drop below the rows measured the pointer from the wrapper's left edge,
 * so it started the width of the grid columns later (82 days at Week zoom in the harness), and the
 * grid columns and the "Drop here" rows started on the Monday of the current week.
 */

import * as fs from 'fs';
import * as path from 'path';
import { backlogDropStart } from '../../src/ui/backlog-drop';

const base = { originIso: '2026-09-21', dayPx: 16, snapWeek: false, todayIso: '2026-11-18' };
const planner = fs.readFileSync(path.join(__dirname, '../../src/frontend/legacy-planner.js'), 'utf8');

/** The source of a function or handler, from its first line to the next blank-line-separated block. */
function block(start: string, length = 1800): string {
  const at = planner.indexOf(start);
  expect(at).toBeGreaterThanOrEqual(0);
  return planner.slice(at, at + length);
}

describe('TASK-00003 the start date of a Backlog drop', () => {
  it('is the day under the pointer, measured from the left edge of the timeline', () => {
    // The timeline starts at x = 700 (after the grid columns); 32 days of 16 px later is 2026-10-23.
    expect(backlogDropStart({ ...base, pointerX: 700 + 32 * 16 + 5, timelineLeft: 700 })).toBe('2026-10-23');
    expect(backlogDropStart({ ...base, pointerX: 700, timelineLeft: 700 })).toBe('2026-09-21');
  });

  it('snaps to the Monday at Month zoom and wider', () => {
    expect(backlogDropStart({ ...base, snapWeek: true, pointerX: 700 + 32 * 16 + 5, timelineLeft: 700 })).toBe('2026-10-19');
  });

  it('is today where no date is under the pointer', () => {
    expect(backlogDropStart({ ...base, pointerX: 300, timelineLeft: null })).toBe('2026-11-18');
    // Left of the timeline (below the grid columns)
    expect(backlogDropStart({ ...base, pointerX: 300, timelineLeft: 700 })).toBe('2026-11-18');
    expect(backlogDropStart({ ...base, pointerX: 900, timelineLeft: Number.NaN })).toBe('2026-11-18');
    expect(backlogDropStart({ ...base, dayPx: 0, pointerX: 900, timelineLeft: 700 })).toBe('2026-11-18');
  });

  it('below the frozen grid columns of a scrolled timeline is today; right of them is the day under the pointer', () => {
    // The timeline is scrolled 400 px left: its date origin is at x = 300, under the grid columns that end at 700.
    expect(backlogDropStart({ ...base, pointerX: 650, timelineLeft: 300, visibleLeft: 700 })).toBe('2026-11-18');
    expect(backlogDropStart({ ...base, pointerX: 300 + 32 * 16 + 5, timelineLeft: 300, visibleLeft: 700 })).toBe('2026-10-23');
  });

  it('a drop below the rows and a drop on a row at the same x start on the same day', () => {
    // Both handlers pass the left edge of the timeline track cell, never the wrapper's
    const wrapperDrop = block("wrapper.addEventListener('drop'");
    expect(wrapperDrop).toContain("wrapper.querySelector('#ganttBody td.timeline-track-cell')");
    expect(wrapperDrop).toContain('backlogDropStart(');
    expect(wrapperDrop).toContain('visibleLeft: wrapper.getBoundingClientRect().left + (layout.trackLeft || 0)');
    expect(wrapperDrop).not.toMatch(/e\.clientX - rect\.left \+ wrapper\.scrollLeft/);
    const trackDrop = block('function setupTrackDrop(');
    expect(trackDrop).toContain('timelineLeft: trackTd.getBoundingClientRect().left');
  });

  it('the grid columns and the two "Drop here" rows start the item today, not on the Monday of the current week', () => {
    const rowDrop = block("tr.addEventListener('drop'");
    expect(rowDrop).toContain('startDate: todayIso()');
    expect(rowDrop).not.toContain('isCurrentWeek');
    const dropRow = block('function setupDropTargetRow(');
    expect(dropRow).toContain('startDate: todayIso()');
    expect(dropRow).not.toContain('isCurrentWeek');
  });
});
