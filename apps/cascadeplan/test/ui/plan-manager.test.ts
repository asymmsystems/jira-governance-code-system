/*
 * Copyright (c) 2026 Asymm Systems. All rights reserved.
 *
 * @author Fahim Farook
 */

import {
  validateNewPlanName,
  formatPlanOptionText,
  canDeletePlan,
  buildPlanListViewModel,
  resolveNextActivePlanAfterDelete,
  categorizePlan,
  suggestCloneName,
  filterPlans
} from '../../src/ui/plan-manager';
import { PlanMetadata } from '../../src/domain/models';

describe('Plan Manager Pure Logic (UX-05)', () => {
  const samplePlans: PlanMetadata[] = [
    { id: 'default', name: 'Main Plan', createdAt: '2026-11-01T00:00:00Z', isDefault: true },
    { id: 'plan-scenario-a', name: 'Scenario A', createdAt: '2026-11-02T00:00:00Z' },
    { id: 'plan-scenario-b', name: 'Optimistic Baseline', createdAt: '2026-11-02T01:00:00Z' }
  ];

  describe('validateNewPlanName', () => {
    it('accepts valid non-empty trimmed plan names', () => {
      const res = validateNewPlanName('  Q1 Release Target  ');
      expect(res.valid).toBe(true);
      expect(res.cleanName).toBe('Q1 Release Target');
      expect(res.error).toBeUndefined();
    });

    it('rejects empty or whitespace-only names', () => {
      const empty = validateNewPlanName('');
      expect(empty.valid).toBe(false);
      expect(empty.error).toBe('Plan name cannot be empty');

      const whitespace = validateNewPlanName('    ');
      expect(whitespace.valid).toBe(false);
      expect(whitespace.error).toBe('Plan name cannot be empty');

      const nonString = validateNewPlanName(null as any);
      expect(nonString.valid).toBe(false);
      expect(nonString.error).toBe('Plan name must be text');
    });

    it('rejects names exceeding 80 characters', () => {
      const longName = 'A'.repeat(81);
      const res = validateNewPlanName(longName);
      expect(res.valid).toBe(false);
      expect(res.error).toBe('Plan name must be at most 80 characters');
    });
  });

  describe('formatPlanOptionText', () => {
    it('formats active plan with indicator', () => {
      expect(formatPlanOptionText(samplePlans[0], true)).toBe('Main Plan (Active)');
    });

    it('formats inactive plan without indicator', () => {
      expect(formatPlanOptionText(samplePlans[1], false)).toBe('Scenario A');
    });
  });

  describe('canDeletePlan', () => {
    it('prevents deleting default plan', () => {
      expect(canDeletePlan(samplePlans[0])).toBe(false);
      expect(canDeletePlan({ id: 'default', name: 'Custom Name', createdAt: '' })).toBe(false);
    });

    it('allows deleting non-default named plans', () => {
      expect(canDeletePlan(samplePlans[1])).toBe(true);
      expect(canDeletePlan(samplePlans[2])).toBe(true);
    });
  });

  describe('buildPlanListViewModel', () => {
    it('N-02: hides a plan being deleted and marks a clone whose copy is not finished', () => {
      const models = buildPlanListViewModel([
        { id: 'default', name: 'Main Plan', createdAt: 'x', isDefault: true },
        { id: 'plan-a', name: 'A', createdAt: 'x', state: 'copying', copyFrom: 'default' },
        { id: 'plan-b', name: 'B', createdAt: 'x', state: 'deleting' }
      ], 'default');
      expect(models.map(m => m.id)).toEqual(['default', 'plan-a']);
      expect(models.find(m => m.id === 'plan-a')!.copying).toBe(true);
      expect(models.find(m => m.id === 'default')!.copying).toBeUndefined();
    });

    it('constructs view models with active and delete permissions', () => {
      const models = buildPlanListViewModel(samplePlans, 'plan-scenario-a');
      expect(models).toEqual([
        { id: 'default', name: 'Main Plan', isDefault: true, isActive: false, canDelete: false, category: 'baseline' },
        { id: 'plan-scenario-a', name: 'Scenario A', isDefault: false, isActive: true, canDelete: true, category: 'scenario' },
        { id: 'plan-scenario-b', name: 'Optimistic Baseline', isDefault: false, isActive: false, canDelete: true, category: 'baseline' }
      ]);
    });

    it('handles empty plans list with default fallback', () => {
      const models = buildPlanListViewModel([], 'default');
      expect(models).toHaveLength(1);
      expect(models[0]).toMatchObject({ id: 'default', name: 'Main Plan', isActive: true, canDelete: false, category: 'baseline' });
    });
  });

  describe('categorizePlan', () => {
    it('categorizes default or baseline names as baseline', () => {
      expect(categorizePlan({ isDefault: true, name: 'Custom' })).toBe('baseline');
      expect(categorizePlan({ name: 'Q4 Baseline' })).toBe('baseline');
      expect(categorizePlan({ name: 'Actual Plan' })).toBe('baseline');
    });

    it('categorizes other plans as scenario', () => {
      expect(categorizePlan({ name: 'Optimistic Timeline' })).toBe('scenario');
      expect(categorizePlan({ name: 'Hiring Delay What-If' })).toBe('scenario');
    });
  });

  describe('suggestCloneName', () => {
    it('appends (Copy) to original name', () => {
      expect(suggestCloneName('Sprint 42 Plan')).toBe('Sprint 42 Plan (Copy)');
    });

    it('increments copy counter if (Copy) already exists in project', () => {
      const existing = ['Sprint 42 Plan', 'Sprint 42 Plan (Copy)'];
      expect(suggestCloneName('Sprint 42 Plan', existing)).toBe('Sprint 42 Plan (Copy 2)');
    });
  });

  describe('filterPlans', () => {
    const models = buildPlanListViewModel(samplePlans, 'default');

    it('filters by search query', () => {
      const matches = filterPlans(models, 'scenario');
      expect(matches).toHaveLength(1);
      expect(matches[0].id).toBe('plan-scenario-a');
    });

    it('filters by category tab', () => {
      const baselines = filterPlans(models, '', 'baselines');
      expect(baselines).toHaveLength(2); // Main Plan and Optimistic Baseline
      const scenarios = filterPlans(models, '', 'scenarios');
      expect(scenarios).toHaveLength(1); // Scenario A
    });

    it('filters by both category and search query', () => {
      const matches = filterPlans(models, 'Optimistic', 'baselines');
      expect(matches).toHaveLength(1);
      expect(matches[0].name).toBe('Optimistic Baseline');
    });
  });

  describe('resolveNextActivePlanAfterDelete', () => {
    it('falls back to default if currently active plan is deleted', () => {
      expect(resolveNextActivePlanAfterDelete('plan-scenario-a', 'plan-scenario-a')).toBe('default');
    });

    it('preserves current active plan if a different plan is deleted', () => {
      expect(resolveNextActivePlanAfterDelete('plan-scenario-b', 'plan-scenario-a')).toBe('plan-scenario-a');
    });
  });
});

