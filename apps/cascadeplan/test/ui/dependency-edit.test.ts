/*
 * Copyright (c) 2026 Asymm Systems. All rights reserved.
 *
 * @author Fahim Farook
 */

import {
  clampTriggerPercent,
  dependencyPopoverTitle,
  formatDependencyBadge,
  computeDependencyPreview,
  checkDependencyConflict,
  clampToEarliestStart,
  suggestTriggerToFit,
  buildDraggedDependencyLink,
  swapDependencyDirection,
  isEnforceDepsActive
} from '../../src/ui/dependency-edit';

describe('dependency editing pure helpers', () => {
  describe('clampTriggerPercent', () => {
    it('clamps numeric and string percentage values to [0, 100]', () => {
      expect(clampTriggerPercent(50)).toBe(50);
      expect(clampTriggerPercent('35')).toBe(35);
      expect(clampTriggerPercent(-15)).toBe(0);
      expect(clampTriggerPercent(120)).toBe(100);
      expect(clampTriggerPercent('abc')).toBe(100);
      expect(clampTriggerPercent(undefined)).toBe(100);
      expect(clampTriggerPercent(null)).toBe(100);
    });
  });

  describe('dependencyPopoverTitle and drag direction helpers', () => {
    it('formats predecessor to successor title and builds directional drag links', () => {
      expect(dependencyPopoverTitle('PROJ-1', 'PROJ-2')).toBe('PROJ-1 ➔ PROJ-2');
      // Dragging forward from right port of A to B: A is predecessor, B is successor
      const forwardLink = buildDraggedDependencyLink('TASK-A', 'TASK-B', 40, 'right');
      expect(forwardLink).toEqual({
        predecessorKey: 'TASK-A',
        successorKey: 'TASK-B',
        triggerPercent: 40,
        isViolated: false,
        isNew: true
      });
      // Dragging backward from left port of A to B: B is predecessor, A is successor
      const backwardLink = buildDraggedDependencyLink('TASK-A', 'TASK-B', 40, 'left');
      expect(backwardLink).toEqual({
        predecessorKey: 'TASK-B',
        successorKey: 'TASK-A',
        triggerPercent: 40,
        isViolated: false,
        isNew: true
      });
      const defaultLink = buildDraggedDependencyLink('TASK-A', 'TASK-B');
      expect(defaultLink.triggerPercent).toBe(100);
      expect(defaultLink.predecessorKey).toBe('TASK-A');
      const swapped = swapDependencyDirection(forwardLink);
      expect(swapped.predecessorKey).toBe('TASK-B');
      expect(swapped.successorKey).toBe('TASK-A');
      expect(swapped.triggerPercent).toBe(40);
    });
  });

  describe('formatDependencyBadge', () => {
    it('formats badge label with percent, date, and violation status', () => {
      expect(formatDependencyBadge({})).toBe('100%');
      expect(formatDependencyBadge({ triggerPercent: 50 })).toBe('50%');
      expect(formatDependencyBadge({ triggerPercent: 30, triggerDate: '2026-10-15' })).toBe('30%, 2026-10-15');
      expect(formatDependencyBadge({ triggerPercent: 100, triggerDate: '2026-10-20', isViolated: true })).toBe('100%, 2026-10-20: starts too early');
    });
  });

  describe('computeDependencyPreview', () => {
    it('calculates planned earliest start date and reason when unstarted', () => {
      const pred = { key: 'PROJ-1', startDate: '2026-10-01', endDate: '2026-10-10', progress: 0 };
      const preview = computeDependencyPreview(pred, 40, '2026-10-01');
      expect(preview.isSatisfied).toBe(false);
      expect(preview.earliestStartDate).toBe('2026-10-05');
      expect(preview.triggerDate).toBe('2026-10-04');
      expect(preview.summary).toContain('reaches 40%');
    });

    it('reports satisfied when predecessor progress meets or exceeds trigger', () => {
      const pred = { key: 'PROJ-1', startDate: '2026-10-01', endDate: '2026-10-10', progress: 50 };
      const preview = computeDependencyPreview(pred, 40, '2026-10-05');
      expect(preview.isSatisfied).toBe(true);
      expect(preview.earliestStartDate).toBeNull();
      expect(preview.summary).toContain('past the 40% trigger');
    });

    it('handles predecessor with status IN_PROGRESS or COMPLETED and missing endDate', () => {
      const predInProg = { key: 'PROJ-1', startDate: '2026-10-01', status: 'IN_PROGRESS', progress: 0 };
      const preview1 = computeDependencyPreview(predInProg, 0, '2026-10-01');
      expect(preview1.isSatisfied).toBe(true);

      const predCompleted = { key: 'PROJ-2', startDate: '2026-10-01', status: 'COMPLETED', progress: 0 };
      const preview2 = computeDependencyPreview(predCompleted, 0, '2026-10-01');
      expect(preview2.isSatisfied).toBe(true);
    });

    it('handles predecessor with missing start date gracefully', () => {
      const pred = { key: 'PROJ-1' };
      const preview = computeDependencyPreview(pred, 50, '2026-10-01');
      expect(preview.isSatisfied).toBe(false);
      expect(preview.earliestStartDate).toBeNull();
      expect(preview.summary).toBe('Predecessor has no planned start date.');
    });
  });

  describe('checkDependencyConflict', () => {
    const tasks = [
      { key: 'PROJ-1', startDate: '2026-10-01', endDate: '2026-10-10', progress: 0 },
      { key: 'PROJ-2', startDate: '2026-10-02', endDate: '2026-10-08', dependency: { predecessorKey: 'PROJ-1', triggerPercent: 40 } }
    ];

    it('flags conflict when candidate start is before earliest start', () => {
      const res = checkDependencyConflict({ key: 'PROJ-2', startDate: '2026-10-02' }, tasks, '2026-10-01');
      expect(res.hasConflict).toBe(true);
      expect(res.predKey).toBe('PROJ-1');
      expect(res.earliestDate).toBe('2026-10-05');
      expect(res.triggerPercent).toBe(40);
    });

    it('reports no conflict when candidate start is on or after earliest start', () => {
      const res = checkDependencyConflict({ key: 'PROJ-2', startDate: '2026-10-06' }, tasks, '2026-10-01');
      expect(res.hasConflict).toBe(false);
    });

    it('N-06 rule 5: a parent\'s incoming link binds its sub-task, and the latest earliest day wins', () => {
      const tree = [
        { key: 'X', startDate: '2026-10-01', endDate: '2026-10-10', progress: 0 },
        { key: 'Y', startDate: '2026-10-01', endDate: '2026-10-04', progress: 0 },
        { key: 'P', startDate: '2026-10-12', endDate: '2026-10-20', datesFromChildren: true, dependency: { predecessorKey: 'X', triggerPercent: 100 } },
        { key: 'S', parentKey: 'P', startDate: '2026-10-12', endDate: '2026-10-20', dependency: { predecessorKey: 'Y', triggerPercent: 100 } },
        { key: 'C', parentKey: 'S', startDate: '2026-10-12', endDate: '2026-10-13' }
      ];
      const res = checkDependencyConflict({ key: 'S', startDate: '2026-10-06' }, tree, '2026-10-01');
      expect(res).toMatchObject({ hasConflict: true, predKey: 'X', earliestDate: '2026-10-11', viaParent: 'P' });
      expect(checkDependencyConflict({ key: 'S', startDate: '2026-10-11' }, tree, '2026-10-01').hasConflict).toBe(false);
      // Two levels up: the grandparent's link binds a sub-sub-task.
      expect(checkDependencyConflict({ key: 'C', startDate: '2026-10-08' }, tree, '2026-10-01')).toMatchObject({ predKey: 'X', viaParent: 'P' });
    });

    it('N-06 rule 6: a link from a task\'s own descendant is not a constraint on it', () => {
      const tree = [
        { key: 'P', startDate: '2026-10-12', endDate: '2026-10-20', dependency: { predecessorKey: 'S', triggerPercent: 100 } },
        { key: 'S', parentKey: 'P', startDate: '2026-10-12', endDate: '2026-10-20' }
      ];
      expect(checkDependencyConflict({ key: 'P', startDate: '2026-10-01' }, tree, '2026-10-01').hasConflict).toBe(false);
    });

    it('reports no conflict when task has no incoming dependencies', () => {
      const res = checkDependencyConflict({ key: 'PROJ-1', startDate: '2026-09-20' }, tasks, '2026-10-01');
      expect(res.hasConflict).toBe(false);
    });

    it('handles edge cases with missing startDate, missing target, or unmapped predecessor', () => {
      expect(checkDependencyConflict({ key: 'PROJ-1' }, tasks, '2026-10-01').hasConflict).toBe(false);
      expect(checkDependencyConflict({ key: 'UNKNOWN', startDate: '2026-10-01' }, tasks, '2026-10-01').hasConflict).toBe(false);

      const tasksWithInvalidDep = [
        { key: 'PROJ-1', dependencies: [null, { predecessorKey: '' }, { predecessorKey: 'MISSING' }] },
        { key: 'PROJ-2', startDate: '2026-10-05', dependencies: [{ predecessorKey: 'UNSCHEDULED' }] },
        { key: 'UNSCHEDULED' }
      ];
      expect(checkDependencyConflict({ key: 'PROJ-1', startDate: '2026-10-01' }, tasksWithInvalidDep, '2026-10-01').hasConflict).toBe(false);
      expect(checkDependencyConflict({ key: 'PROJ-2', startDate: '2026-10-05' }, tasksWithInvalidDep, '2026-10-01').hasConflict).toBe(false);
    });
  });

  describe('clampToEarliestStart', () => {
    it('shifts candidate start and end forward to earliest start preserving duration', () => {
      const clamped = clampToEarliestStart('2026-10-02', '2026-10-06', '2026-10-05');
      expect(clamped.startDate).toBe('2026-10-05');
      expect(clamped.endDate).toBe('2026-10-09');
    });

    it('leaves dates unchanged when already after earliest start', () => {
      const unchanged = clampToEarliestStart('2026-10-07', '2026-10-11', '2026-10-05');
      expect(unchanged.startDate).toBe('2026-10-07');
      expect(unchanged.endDate).toBe('2026-10-11');
    });

    it('returns original dates when earliest start is null', () => {
      const res = clampToEarliestStart('2026-10-02', '2026-10-06', null);
      expect(res.startDate).toBe('2026-10-02');
      expect(res.endDate).toBe('2026-10-06');
    });
  });

  describe('suggestTriggerToFit', () => {
    it('computes maximum trigger percentage allowing successor start date', () => {
      const pct = suggestTriggerToFit({ key: 'PROJ-1', startDate: '2026-10-01', endDate: '2026-10-10' }, '2026-10-03');
      expect(pct).toBe(20);
    });

    it('returns 0 when successor starts before predecessor start or predecessor has no start date', () => {
      expect(suggestTriggerToFit({ key: 'PROJ-1', startDate: '2026-10-05', endDate: '2026-10-10' }, '2026-10-02')).toBe(0);
      expect(suggestTriggerToFit({ key: 'PROJ-1' }, '2026-10-02')).toBe(0);
    });

    it('computes trigger percentage when predecessor endDate is omitted', () => {
      const pct = suggestTriggerToFit({ key: 'PROJ-1', startDate: '2026-10-01' }, '2026-10-02');
      expect(pct).toBe(100);
    });
  });

  describe('isEnforceDepsActive', () => {
    it('returns true when checkbox is checked', () => {
      expect(isEnforceDepsActive({ checked: true }, 'off')).toBe(true);
      expect(isEnforceDepsActive({ checked: true }, null)).toBe(true);
    });

    it('returns false when checkbox is unchecked even if storage was on', () => {
      expect(isEnforceDepsActive({ checked: false }, 'on')).toBe(false);
    });

    it('falls back to storage when checkbox element is not present', () => {
      expect(isEnforceDepsActive(null, 'on')).toBe(true);
      expect(isEnforceDepsActive(undefined, 'on')).toBe(true);
      expect(isEnforceDepsActive(null, 'off')).toBe(false);
      expect(isEnforceDepsActive(null, null)).toBe(false);
    });
  });
});
