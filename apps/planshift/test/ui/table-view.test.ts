/*
 * Copyright (c) 2026 Asymm Systems. All rights reserved.
 *
 * @author Fahim Farook
 */

/**
 * CascadePlan: Table view data formatting and toggle logic (pure; B-26).
 */

import {
  buildTableViewRows,
  formatTableDate,
  formatTableProgress,
  formatTableDependencies,
  toggleTableView
} from '../../src/ui/table-view';

describe('table-view (B-26 criteria 1 and 2)', () => {
  it('formats dates, progress and dependencies for plain table display', () => {
    expect(formatTableDate('2026-11-02')).toBe('2026-11-02');
    expect(formatTableDate(undefined)).toBe('-');
    expect(formatTableDate('')).toBe('-');
    expect(formatTableDate('   ')).toBe('-');

    expect(formatTableProgress(50)).toBe('50%');
    expect(formatTableProgress(0)).toBe('0%');
    expect(formatTableProgress(undefined)).toBe('0%');
    expect(formatTableProgress(NaN)).toBe('0%');
    expect(formatTableProgress(150)).toBe('100%');
    expect(formatTableProgress(-20)).toBe('0%');

    expect(formatTableDependencies({
      dependencies: [
        { predecessorKey: 'SYN-1', triggerPercent: 30 },
        { predecessorKey: 'SYN-2', triggerPercent: 100 }
      ]
    })).toBe('SYN-1 (30%), SYN-2 (100%)');

    expect(formatTableDependencies({
      dependencies: [
        { predecessorKey: 'SYN-1' }
      ]
    })).toBe('SYN-1 (100%)');

    expect(formatTableDependencies({
      dependencies: [
        { predecessorKey: '' }
      ]
    })).toBe('-');

    expect(formatTableDependencies({
      dependency: { predecessorKey: 'SYN-3', triggerPercent: 50 }
    })).toBe('SYN-3 (50%)');

    expect(formatTableDependencies({
      dependency: { triggerPercent: 50 }
    })).toBe('-');

    expect(formatTableDependencies({})).toBe('-');
    expect(formatTableDependencies({ dependencies: [] })).toBe('-');
  });

  it('builds table view rows from tasks in order with all columns populated', () => {
    const tasks: any[] = [
      {
        key: 'EPIC-1',
        summary: 'Cloud Migration',
        isEpic: true,
        issueType: 'Epic',
        epic: 'Cloud Migration',
        resource: 'Ann Lee',
        startDate: '2026-11-02',
        endDate: '2026-12-15',
        progress: 40,
        status: 'In Progress',
        dependencies: []
      },
      {
        key: 'SYN-1',
        summary: 'Database Schema',
        issueType: 'Story',
        epic: 'EPIC-1',
        resource: 'Unassigned',
        startDate: '2026-11-02',
        endDate: '2026-11-09',
        progress: 100,
        status: 'Done',
        dependencies: []
      },
      {
        key: 'SYN-2',
        summary: 'API Service',
        issueType: 'Task',
        epic: 'EPIC-1',
        resource: 'Bo Chen',
        startDate: '2026-11-05',
        endDate: '2026-11-20',
        progress: 20,
        status: 'In Progress',
        dependencies: [{ predecessorKey: 'SYN-1', triggerPercent: 50 }]
      },
      {
        key: 'BKL-1',
        summary: 'Unscheduled Item',
        issueType: 'Story',
        status: 'To Do'
      },
      {
        key: 'EMPTY-1'
      }
    ];

    const rows = buildTableViewRows(tasks);
    expect(rows).toHaveLength(5);
    expect(rows[0]).toEqual({
      key: 'EPIC-1',
      summary: 'Cloud Migration',
      issueType: 'Epic',
      epic: 'Cloud Migration',
      assignee: 'Ann Lee',
      startDate: '2026-11-02',
      dueDate: '2026-12-15',
      progress: '40%',
      status: 'In Progress',
      dependencies: '-'
    });

    expect(rows[2]).toEqual({
      key: 'SYN-2',
      summary: 'API Service',
      issueType: 'Task',
      epic: 'EPIC-1',
      assignee: 'Bo Chen',
      startDate: '2026-11-05',
      dueDate: '2026-11-20',
      progress: '20%',
      status: 'In Progress',
      dependencies: 'SYN-1 (50%)'
    });

    expect(rows[3]).toEqual({
      key: 'BKL-1',
      summary: 'Unscheduled Item',
      issueType: 'Story',
      epic: '-',
      assignee: 'Unassigned',
      startDate: '-',
      dueDate: '-',
      progress: '0%',
      status: 'To Do',
      dependencies: '-'
    });

    expect(rows[4]).toEqual({
      key: 'EMPTY-1',
      summary: '',
      issueType: 'Task',
      epic: '-',
      assignee: 'Unassigned',
      startDate: '-',
      dueDate: '-',
      progress: '0%',
      status: 'To Do',
      dependencies: '-'
    });
  });

  it('toggles table view state between table and timeline', () => {
    expect(toggleTableView('timeline')).toBe('table');
    expect(toggleTableView('utilization')).toBe('table');
    expect(toggleTableView('table')).toBe('timeline');
  });
});
