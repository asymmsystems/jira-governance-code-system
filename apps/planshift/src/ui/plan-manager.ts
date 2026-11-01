/*
 * Copyright (c) 2026 Asymm Systems. All rights reserved.
 *
 * @author Fahim Farook
 */

import { PlanMetadata } from '../domain/models';

export interface PlanItemViewModel {
  id: string;
  name: string;
  isDefault: boolean;
  isActive: boolean;
  canDelete: boolean;
}

export function validateNewPlanName(name: string): { valid: boolean; error?: string; cleanName: string } {
  if (typeof name !== 'string') {
    return { valid: false, error: 'Plan name must be text', cleanName: '' };
  }
  const clean = name.trim();
  if (clean.length === 0) {
    return { valid: false, error: 'Plan name cannot be empty', cleanName: '' };
  }
  if (clean.length > 80) {
    return { valid: false, error: 'Plan name must be at most 80 characters', cleanName: clean };
  }
  return { valid: true, cleanName: clean };
}

export function formatPlanOptionText(plan: PlanMetadata, isActive: boolean): string {
  return isActive ? `${plan.name} (Active)` : plan.name;
}

export function canDeletePlan(plan: PlanMetadata): boolean {
  return plan.id !== 'default' && plan.isDefault !== true;
}

export function buildPlanListViewModel(plans: PlanMetadata[], activePlanId: string): PlanItemViewModel[] {
  if (!plans || plans.length === 0) {
    return [{ id: 'default', name: 'Main Plan', isDefault: true, isActive: true, canDelete: false }];
  }
  return plans.map(p => {
    const isDefault = p.id === 'default' || p.isDefault === true;
    return {
      id: p.id,
      name: p.name,
      isDefault,
      isActive: p.id === activePlanId,
      canDelete: !isDefault
    };
  });
}

export function resolveNextActivePlanAfterDelete(deletedPlanId: string, currentActivePlanId: string): string {
  if (deletedPlanId === currentActivePlanId) {
    return 'default';
  }
  return currentActivePlanId;
}
