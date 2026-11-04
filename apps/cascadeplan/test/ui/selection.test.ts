/*
 * Copyright (c) 2026 Asymm Systems. All rights reserved.
 *
 * @author Fahim Farook
 */

/**
 * CascadePlan: multi-select, batch edits and their undo label (B-16).
 */

import { toggleKey, rangeKeys, moveSelectionBy, progressFromDigit } from '../../src/ui/selection';
import { actionLabel } from '../../src/ui/undo-plan';

describe('selection (B-16 criterion 1)', () => {
  const order = ['A-1', 'A-2', 'A-3', 'A-4', 'A-5'];
  it('Ctrl/Cmd+click and Space toggle one row; Shift+click selects the range from the anchor', () => {
    expect([...toggleKey(new Set(['A-1']), 'A-2')]).toEqual(['A-1', 'A-2']);
    expect([...toggleKey(new Set(['A-1', 'A-2']), 'A-1')]).toEqual(['A-2']);
    expect(rangeKeys(order, 'A-2', 'A-4')).toEqual(['A-2', 'A-3', 'A-4']);
    expect(rangeKeys(order, 'A-4', 'A-2')).toEqual(['A-2', 'A-3', 'A-4']);
    expect(rangeKeys(order, null, 'A-3')).toEqual(['A-3']);
    expect(rangeKeys(order, 'X-9', 'A-3')).toEqual(['A-3']);
  });
});

describe('batch edits (B-16 criteria 2 and 3)', () => {
  const tasks: any[] = [
    { key: 'A-1', startDate: '2026-11-02', endDate: '2026-11-06', version: 2 },
    { key: 'A-2', startDate: '2026-11-09', endDate: '2026-11-13' },
    { key: 'E-1', startDate: '2026-11-02', endDate: '2026-12-01', isEpic: true },
    { key: 'P-1', startDate: '2026-11-02', endDate: '2026-12-01', datesFromChildren: true },
    { key: 'U-1' }
  ];
  it('moves each selected task with dates by N days, earliest first; epics, derived parents and undated tasks are left out', () => {
    expect(moveSelectionBy(tasks, new Set(['A-2', 'A-1', 'E-1', 'P-1', 'U-1']), 3)).toEqual([
      { taskId: 'A-1', updates: { startDate: '2026-11-05', endDate: '2026-11-09' }, expectedVersion: 2 },
      { taskId: 'A-2', updates: { startDate: '2026-11-12', endDate: '2026-11-16' }, expectedVersion: 0 }
    ]);
    expect(moveSelectionBy(tasks, new Set(['A-1']), 0)).toEqual([]);
    const same: any[] = [{ key: 'C-2', startDate: '2026-11-02' }, { key: 'C-1', startDate: '2026-11-02', endDate: '2026-11-03' },
      { key: 'C-0', startDate: '2026-11-01', endDate: '2026-11-01' }, { key: 'L-1', startDate: '2026-11-01', hierarchyLevel: 1 }];
    expect(moveSelectionBy(same, new Set(['C-2', 'C-1', 'C-0', 'L-1']), -1).map(i => [i.taskId, i.updates.endDate])).toEqual([
      ['C-0', '2026-10-31'], ['C-2', '2026-11-01'], ['C-1', '2026-11-02']]);
  });

  it('digits 0 to 9 set progress in steps of 10', () => {
    expect(['0', '7', '9', 'x', '10'].map(progressFromDigit)).toEqual([0, 70, 90, null, null]);
  });

  it('one undo label for a batch', () => {
    const e = { keys: ['A-1', 'A-2', 'B-9'], restore: [], reapply: [] };
    expect(actionLabel('batchUpdateTasks', { items: [{ taskId: 'A-1', updates: { startDate: 'x' } }, { taskId: 'A-2', updates: { startDate: 'y' } }] } as any, e))
      .toBe('Moved 2 issues and 1 dependent');
    expect(actionLabel('batchUpdateTasks', { items: [{ taskId: 'A-1', updates: { progress: 50 } }] } as any, { keys: ['A-1'], restore: [], reapply: [] }))
      .toBe('Set progress on 1 issue');
    expect(actionLabel('batchUpdateTasks', { items: [{ taskId: 'A-1', updates: { resourceAccountId: 'acc' } }, { taskId: 'A-2', updates: { resourceAccountId: 'acc' } }] } as any, e))
      .toBe('Assigned 2 issues');
    expect(actionLabel('batchUpdateTasks', { items: [] } as any, { keys: [], restore: [], reapply: [] })).toBe('Changed 0 issues');
  });
});
