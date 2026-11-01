/*
 * Copyright (c) 2026 Asymm Systems. All rights reserved.
 *
 * @author Fahim Farook
 */

import {
  clampTriggerPercent,
  dependencyPopoverTitle,
  formatDependencyBadge,
  computeDependencyPreview
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

  describe('dependencyPopoverTitle', () => {
    it('formats predecessor to successor title with arrow', () => {
      expect(dependencyPopoverTitle('PROJ-1', 'PROJ-2')).toBe('PROJ-1 ➔ PROJ-2');
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
});
