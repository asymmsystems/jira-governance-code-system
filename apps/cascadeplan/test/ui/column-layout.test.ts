/*
 * Copyright (c) 2026 Asymm Systems. All rights reserved.
 *
 * @author Fahim Farook
 */

import {
  ALL_COLUMN_KEYS,
  DEFAULT_COLUMN_WIDTHS,
  MIN_COLUMN_WIDTHS,
  COMPACT_TASK_DEFAULT_WIDTH,
  sanitizeLoadedColumnWidths,
  clampColumnResize,
  computeFrozenLayout
} from '../../src/ui/column-layout';

describe('column layout pure helpers', () => {
  it('defines readable defaults for all 8 planner columns without clipping headers or badges', () => {
    expect(ALL_COLUMN_KEYS).toEqual(['epic', 'story', 'task', 'resource', 'effort', 'progress', 'target', 'status']);
    expect(DEFAULT_COLUMN_WIDTHS.effort).toBeGreaterThanOrEqual(65);
    expect(DEFAULT_COLUMN_WIDTHS.progress).toBeGreaterThanOrEqual(65);
    expect(DEFAULT_COLUMN_WIDTHS.target).toBeGreaterThanOrEqual(65);
    expect(DEFAULT_COLUMN_WIDTHS.status).toBeGreaterThanOrEqual(95);

    const total = ALL_COLUMN_KEYS.reduce((sum, key) => sum + DEFAULT_COLUMN_WIDTHS[key], 0);
    expect(total).toBe(890);
    expect(1440 - total).toBeGreaterThanOrEqual(6 * 85);
  });

  it('sanitizes invalid or too-narrow saved widths while preserving valid custom widths', () => {
    const validSaved = {
      epic: 110,
      story: 100,
      task: 260,
      resource: 130,
      effort: 65,
      progress: 65,
      target: 65,
      status: 95
    };
    const loaded = sanitizeLoadedColumnWidths(validSaved);
    expect(loaded.effort).toBe(65);
    expect(loaded.progress).toBe(65);
    expect(loaded.target).toBe(65);
    expect(loaded.status).toBe(95);

    const tooNarrow = sanitizeLoadedColumnWidths({
      effort: 20,
      status: 30,
      task: 'invalid' as unknown as number
    });
    expect(tooNarrow.effort).toBe(DEFAULT_COLUMN_WIDTHS.effort);
    expect(tooNarrow.status).toBe(DEFAULT_COLUMN_WIDTHS.status);
    expect(tooNarrow.task).toBe(DEFAULT_COLUMN_WIDTHS.task);

    const customWide = sanitizeLoadedColumnWidths({
      epic: 150,
      task: 340,
      progress: 130
    });
    expect(customWide.epic).toBe(150);
    expect(customWide.task).toBe(340);
    expect(customWide.progress).toBe(130);

    expect(sanitizeLoadedColumnWidths(null)).toEqual(DEFAULT_COLUMN_WIDTHS);
    expect(sanitizeLoadedColumnWidths(undefined)).toEqual(DEFAULT_COLUMN_WIDTHS);
  });

  it('clamps interactive column resizing to safe minimum and maximum bounds', () => {
    expect(clampColumnResize('progress', 20)).toBe(MIN_COLUMN_WIDTHS.progress);
    expect(clampColumnResize('task', 80)).toBe(MIN_COLUMN_WIDTHS.task);
    expect(clampColumnResize('status', 150.4)).toBe(150);
    expect(clampColumnResize('task', 9999)).toBe(640);
    expect(clampColumnResize('unknown_col', 40)).toBe(64);
    expect(clampColumnResize('effort', Number.NaN)).toBe(DEFAULT_COLUMN_WIDTHS.effort);
  });

  it('computes exact cumulative frozen offsets and total width in full and compact modes', () => {
    const full = computeFrozenLayout(ALL_COLUMN_KEYS, DEFAULT_COLUMN_WIDTHS, false, COMPACT_TASK_DEFAULT_WIDTH);
    expect(full.visibleKeys).toEqual(ALL_COLUMN_KEYS);
    expect(full.offsets.epic).toBe(0);
    expect(full.offsets.story).toBe(DEFAULT_COLUMN_WIDTHS.epic);
    expect(full.offsets.task).toBe(DEFAULT_COLUMN_WIDTHS.epic + DEFAULT_COLUMN_WIDTHS.story);
    expect(full.totalWidth).toBe(ALL_COLUMN_KEYS.reduce((s, k) => s + DEFAULT_COLUMN_WIDTHS[k], 0));
    expect(full.lastKey).toBe('status');

    const compact = computeFrozenLayout(['task'], DEFAULT_COLUMN_WIDTHS, true, 245);
    expect(compact.widths.task).toBe(245);
    expect(compact.offsets.task).toBe(0);
    expect(compact.totalWidth).toBe(245);
    expect(compact.lastKey).toBe('task');

    const empty = computeFrozenLayout([], DEFAULT_COLUMN_WIDTHS, false);
    expect(empty.totalWidth).toBe(0);
    expect(empty.lastKey).toBeNull();

    const fallback = computeFrozenLayout(['effort', 'custom_extra'], {}, false);
    expect(fallback.widths.effort).toBe(DEFAULT_COLUMN_WIDTHS.effort);
    expect(fallback.widths.custom_extra).toBe(100);
  });
});
