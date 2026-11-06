/*
 * Copyright (c) 2026 Asymm Systems. All rights reserved.
 *
 * @author Fahim Farook
 */

import { PlanMetadata } from '../domain/models';

export type PlanCategory = 'all' | 'scenarios';

export interface PlanItemViewModel {
  id: string;
  name: string;
  isDefault: boolean;
  isActive: boolean;
  canDelete: boolean;
  /** 'main' for the Main Plan, else 'scenario'. Real baselines are frozen in the Baseline panel (ADR-009). */
  category: 'main' | 'scenario';
  /** True for a clone whose records are not all copied yet (N-02): it opens only after the copy. */
  copying?: boolean;
}

/** The Main Plan, or a scenario. A plan's name never makes it a baseline (BL-1 step 6). */
export function categorizePlan(plan: { id?: string; name?: string; isDefault?: boolean }): 'main' | 'scenario' {
  return plan.isDefault || plan.id === 'default' ? 'main' : 'scenario';
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

export function suggestCloneName(originalName: string, existingNames: string[] = []): string {
  const base = originalName.replace(/\s*\(Copy(\s+\d+)?\)$/i, '').trim();
  let candidate = `${base} (Copy)`;
  let counter = 2;
  const lowerSet = new Set(existingNames.map(n => n.toLowerCase().trim()));
  while (lowerSet.has(candidate.toLowerCase())) {
    candidate = `${base} (Copy ${counter})`;
    counter++;
  }
  return candidate;
}

export function formatPlanOptionText(plan: PlanMetadata, isActive: boolean): string {
  return isActive ? `${plan.name} (Active)` : plan.name;
}

export function canDeletePlan(plan: PlanMetadata): boolean {
  return plan.id !== 'default' && plan.isDefault !== true;
}

export function buildPlanListViewModel(plans: PlanMetadata[], activePlanId: string): PlanItemViewModel[] {
  if (!plans || plans.length === 0) {
    return [{ id: 'default', name: 'Main Plan', isDefault: true, isActive: true, canDelete: false, category: 'main' }];
  }
  // A plan being deleted is not offered (N-02); its delete is finished in the background.
  return plans.filter(p => p.state !== 'deleting').map(p => {
    const isDefault = p.id === 'default' || p.isDefault === true;
    return {
      id: p.id,
      name: p.name,
      isDefault,
      isActive: p.id === activePlanId,
      canDelete: !isDefault,
      category: categorizePlan(p),
      ...(p.state === 'copying' ? { copying: true } : {})
    };
  });
}

export function filterPlans(
  plans: PlanItemViewModel[],
  query: string = '',
  category: PlanCategory = 'all'
): PlanItemViewModel[] {
  const q = (query || '').trim().toLowerCase();
  return plans.filter(p => {
    if (category === 'scenarios' && p.category !== 'scenario') return false;
    if (q.length > 0 && !p.name.toLowerCase().includes(q)) return false;
    return true;
  });
}

export function resolveNextActivePlanAfterDelete(deletedPlanId: string, currentActivePlanId: string): string {
  if (deletedPlanId === currentActivePlanId) {
    return 'default';
  }
  return currentActivePlanId;
}

