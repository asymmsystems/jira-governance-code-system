/*
 * Copyright (c) 2026 Asymm Systems. All rights reserved.
 *
 * @author Fahim Farook
 */

/**
 * CascadePlan: treegrid navigation, row cells and levels, keyboard move mode (B-15).
 */

import { navigate, GRID_COLUMNS, rowCells, rowLevel, moveKey, moveAnnouncement, dependencyText } from '../../src/ui/keyboard-grid';

describe('navigate (B-15 criterion 3)', () => {
  const at = { row: 5, col: 2 };
  const go = (key: string, ctrlKey = false) => navigate(at, { key, ctrlKey }, 100, 7, 10);
  it('arrows move by one cell, clamped at the edges', () => {
    expect(go('ArrowDown')).toEqual({ row: 6, col: 2 });
    expect(go('ArrowUp')).toEqual({ row: 4, col: 2 });
    expect(go('ArrowRight')).toEqual({ row: 5, col: 3 });
    expect(go('ArrowLeft')).toEqual({ row: 5, col: 1 });
    expect(navigate({ row: 0, col: 0 }, { key: 'ArrowUp', ctrlKey: false }, 100, 7, 10)).toEqual({ row: 0, col: 0 });
    expect(navigate({ row: 99, col: 6 }, { key: 'ArrowRight', ctrlKey: false }, 100, 7, 10)).toEqual({ row: 99, col: 6 });
  });
  it('Home, End, Ctrl+Home, Ctrl+End, Page Up and Page Down', () => {
    expect(go('Home')).toEqual({ row: 5, col: 0 });
    expect(go('End')).toEqual({ row: 5, col: 6 });
    expect(go('Home', true)).toEqual({ row: 0, col: 2 });
    expect(go('End', true)).toEqual({ row: 99, col: 2 });
    expect(go('PageDown')).toEqual({ row: 15, col: 2 });
    expect(go('PageUp')).toEqual({ row: 0, col: 2 });
    expect(go('x')).toBeNull();
  });
});

describe('row cells and levels (B-15 criteria 1 and 2)', () => {
  const tasks: any[] = [
    { key: 'E-1', isEpic: true, hierarchyLevel: 1, summary: 'Epic', startDate: '2026-11-01', endDate: '2026-12-01', progress: 10, status: 'IN_PROGRESS' },
    { key: 'S-2', epicKey: 'E-1', summary: 'Story', startDate: '2026-11-04', endDate: '2026-11-13', progress: 0, status: 'NOT_STARTED',
      dependency: { predecessorKey: 'E-1', triggerPercent: 30, triggerDate: '2026-11-10' } },
    { key: 'T-3', isSubtask: true, parentKey: 'S-2', summary: 'Sub', progress: 100, status: 'COMPLETED',
      dependency: { predecessorKey: 'S-2', triggerPercent: 50, isViolated: true } },
    { key: 'S-4', epicKey: 'X-9', summary: '', startDate: '2026-11-04', endDate: '', status: 'OTHER' }
  ];
  const keys = new Set(tasks.map(t => t.key));
  it('names the seven cells, with the dependency read as a sentence', () => {
    expect(GRID_COLUMNS).toEqual(['Key', 'Summary', 'Start', 'Due', 'Progress', 'Status', 'Dependencies']);
    expect(rowCells(tasks[1])).toEqual(['S-2', 'Story', '2026-11-04', '2026-11-13', '0%', 'Not started', 'Starts when E-1 reaches 30% (2026-11-10)']);
    expect(rowCells(tasks[2])).toEqual(['T-3', 'Sub', 'Not scheduled', 'Not scheduled', '100%', 'Done', 'Starts when S-2 reaches 50%. Starts too early']);
    expect(rowCells(tasks[0])[5]).toBe('In progress');
    expect(rowCells(tasks[3])).toEqual(['S-4', 'No summary', '2026-11-04', 'Not scheduled', '0%', 'OTHER', 'None']);
    expect(dependencyText(null)).toBe('None');
  });

  it('says when 100% is not Done in Jira (2026-11-06)', () => {
    expect(rowCells({ key: 'A-1', progress: 100, status: 'IN_PROGRESS' })[4]).toBe('100%, not Done in Jira');
  });
  it('levels: epic 1, story under a shown epic 2, sub-task one below its parent', () => {
    expect(tasks.map(t => rowLevel(t, keys))).toEqual([1, 2, 3, 1]);
    expect(rowLevel({ key: 'T-9', isSubtask: true, parentKey: 'Z-1' }, keys)).toBe(2);
  });
});

describe('keyboard move mode (B-15 criterion 4)', () => {
  const s0 = { key: 'A-1', start: 0, end: 0 };
  it('Left and Right move a day, Shift a week, [ and ] change the due date, Enter commits, Escape cancels', () => {
    expect(moveKey(s0, { key: 'ArrowRight', shiftKey: false })).toEqual({ state: { key: 'A-1', start: 1, end: 1 }, action: 'move' });
    expect(moveKey(s0, { key: 'ArrowLeft', shiftKey: true })).toEqual({ state: { key: 'A-1', start: -7, end: -7 }, action: 'move' });
    expect(moveKey(s0, { key: ']', shiftKey: false })).toEqual({ state: { key: 'A-1', start: 0, end: 1 }, action: 'move' });
    expect(moveKey(s0, { key: '[', shiftKey: false })).toEqual({ state: { key: 'A-1', start: 0, end: -1 }, action: 'move' });
    expect(moveKey(s0, { key: 'Enter', shiftKey: false }).action).toBe('commit');
    expect(moveKey(s0, { key: 'Escape', shiftKey: false }).action).toBe('cancel');
    expect(moveKey(s0, { key: 'q', shiftKey: false })).toEqual({ state: s0, action: null });
  });
  it('announces the mode, the dates and the keys', () => {
    expect(moveAnnouncement('A-1', '2026-11-11', '2026-11-20', true)).toBe(
      'Move mode for A-1: 2026-11-11 to 2026-11-20. Left and Right move 1 day, with Shift 1 week; [ and ] change the due date; Enter saves; Escape cancels.');
    expect(moveAnnouncement('A-1', '2026-11-12', '2026-11-20', false)).toBe('A-1: 2026-11-12 to 2026-11-20.');
  });
});
