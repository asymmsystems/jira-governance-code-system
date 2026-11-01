/*
 * Copyright (c) 2026 Asymm Systems. All rights reserved.
 *
 * @author Fahim Farook
 */

/**
 * CascadePlan: hours per person per week from estimates (D-10: replaces the heatmap).
 */

import { weeklyHours } from '../../src/ui/weekly-hours';

describe('weeklyHours (D-10)', () => {
  it('spreads each estimate evenly over its days and adds it up per person and week', () => {
    const tasks: any[] = [
      { key: 'A-1', resource: 'Ann Lee', effortHours: 14, startDate: '2026-11-02', endDate: '2026-11-15' },
      { key: 'A-2', resource: 'Ann Lee', effortHours: 7, startDate: '2026-11-09', endDate: '2026-11-15' },
      { key: 'B-1', resource: 'Bo Chen', effortHours: 10, startDate: '2026-11-13', endDate: '2026-11-17' },
      { key: 'E-1', resource: 'Ann Lee', effortHours: 99, startDate: '2026-11-02', endDate: '2026-11-08', isEpic: true },
      { key: 'U-1', resource: 'Unassigned', effortHours: 5, startDate: '2026-11-02', endDate: '2026-11-08' },
      { key: 'N-1', resource: 'Bo Chen', effortHours: 0, startDate: '2026-11-02', endDate: '2026-11-08' },
      { key: 'D-1', resource: 'Bo Chen', effortHours: 8 }
    ];
    expect(weeklyHours(tasks, ['2026-11-02', '2026-11-09', '2026-11-16'])).toEqual([
      { name: 'Ann Lee', hours: [7, 14, 0] },
      { name: 'Bo Chen', hours: [0, 6, 4] }
    ]);
    expect(weeklyHours([], ['2026-11-02'])).toEqual([]);
  });
});
