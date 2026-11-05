/*
 * Copyright (c) 2026 Asymm Systems. All rights reserved.
 *
 * @author Fahim Farook
 */

/**
 * CascadePlan server: Plan management: create, copy, rename, delete, and the JQL filter of a plan.
 * Split from src/index.ts without changes to any statement (F-31).
 */

import { PlanMetadata } from '../domain/models';
import { StorageProvider } from '../storage/plan-repository';
import { cleanPlanFilter } from '../domain/plan-filter';
import { ValidationError, validatePlanName, validatePlanId } from '../validation';
import { isMainPlan, openStore, resolveStorage, writablePlanId } from './core';
import { testPlanFilter } from './jira-read';

/**
 * Sets or clears the JQL filter of a plan (F-27). Plan approvers only. The filter is checked here and
 * by Jira before it is saved; an empty filter reads the whole project again.
 */
export async function setPlanFilter(
  payload: { projectKey: string; projectId?: string; planId?: string; filter?: string },
  storageProvider?: StorageProvider
): Promise<{ ok: boolean; filter?: string; count?: number; error?: string; message?: string }> {
  let filter: string;
  try {
    filter = cleanPlanFilter(payload.filter);
  } catch (err: any) {
    return { ok: false, error: 'validation', message: err.message };
  }
  const storage = resolveStorage(storageProvider);
  const planId = await writablePlanId(storage, payload.projectKey, payload.projectId, payload.planId);
  let count: number | undefined;
  if (filter) {
    const test = await testPlanFilter(payload.projectKey, filter);
    if (!test.ok) return { ok: false, error: 'jql', message: test.message };
    count = test.count;
  }
  await openStore(storage, payload.projectKey, payload.projectId, planId).saveSettings({ jqlFilter: filter || undefined });
  return { ok: true, filter, count };
}

/**
 * Retrieves the available named plans for a project (UX-05).
 */
export async function getProjectPlans(
  payload: { projectKey: string; projectId?: string; planId?: string },
  storageProvider?: StorageProvider
): Promise<{ ok: boolean; plans: PlanMetadata[]; activePlanId: string }> {
  const storage = resolveStorage(storageProvider);
  const store = openStore(storage, payload.projectKey, payload.projectId, payload.planId);
  const plans = await store.listPlans();
  return { ok: true, plans, activePlanId: payload.planId || 'default' };
}

/**
 * Creates a new named plan, optionally cloning tasks and settings from an existing plan (UX-05).
 * A clone copies its first page of records here; the client calls continuePlanCopy until `done`
 * (N-02). The new plan is listed as 'copying' until then.
 */
export async function createProjectPlan(
  payload: { projectKey: string; projectId?: string; name: string; cloneFromPlanId?: string },
  storageProvider?: StorageProvider
): Promise<{ ok: boolean; plan: PlanMetadata; plans: PlanMetadata[]; done?: boolean; remaining?: number; error?: string; message?: string }> {
  try {
    const trimmed = validatePlanName(payload.name);
    validatePlanId(payload.cloneFromPlanId);
    const storage = resolveStorage(storageProvider);
    const store = openStore(storage, payload.projectKey, payload.projectId);
    if (payload.cloneFromPlanId && !isMainPlan(payload.cloneFromPlanId)) {
      const source = (await store.listPlans()).find(p => p.id === payload.cloneFromPlanId);
      if (!source || source.state) throw new ValidationError('cloneFromPlanId', 'That plan cannot be copied now. Reload to see the current plans.');
    }
    const plan = await store.createPlan(trimmed, payload.cloneFromPlanId);
    const page = plan.state === 'copying' ? await store.copyPlanPage(plan.id) : { ok: true, done: true, remaining: 0 };
    const plans = await store.listPlans();
    return { ok: true, plan: plans.find(p => p.id === plan.id) || plan, plans, done: page.done, remaining: page.remaining };
  } catch (err: any) {
    return { ok: false, plan: undefined as any, plans: [], error: 'validation', message: err?.message || 'Invalid plan name' };
  }
}

/** Copies the next page of records of a plan that is still being cloned (N-02). */
export async function continuePlanCopy(
  payload: { projectKey: string; projectId?: string; planId: string },
  storageProvider?: StorageProvider
): Promise<{ ok: boolean; done: boolean; remaining: number; plans: PlanMetadata[]; message?: string }> {
  validatePlanId(payload.planId);
  const store = openStore(resolveStorage(storageProvider), payload.projectKey, payload.projectId);
  const page = await store.copyPlanPage(payload.planId);
  const plans = await store.listPlans();
  return { ...page, plans, ...(page.ok ? {} : { message: 'This plan is not being copied. Reload to see the current plans.' }) };
}

/**
 * Deletes a named plan (UX-05). The default plan cannot be deleted. The plan is marked 'deleting'
 * and its first page of records is removed here; the client calls continuePlanDelete until `done`
 * (N-02). It leaves the list with its last record, so a stopped delete can always be finished.
 */
export async function deleteProjectPlan(
  payload: { projectKey: string; projectId?: string; planId: string },
  storageProvider?: StorageProvider
): Promise<{ ok: boolean; plans: PlanMetadata[]; done?: boolean; remaining?: number; error?: string; message?: string }> {
  if (!payload.planId || payload.planId === 'default') {
    return { ok: false, plans: [], error: 'cannot_delete_default', message: 'Cannot delete the default plan' };
  }
  validatePlanId(payload.planId);
  const storage = resolveStorage(storageProvider);
  const store = openStore(storage, payload.projectKey, payload.projectId);
  try {
    const marked = await store.deletePlan(payload.planId);
    const already = (await store.listPlans()).find(p => p.id === payload.planId)?.state === 'deleting';
    if (!marked && !already) return { ok: false, plans: await store.listPlans(), message: 'This plan no longer exists. Reload to see the current plans.' };
    const page = await store.deletePlanPage(payload.planId);
    return { ok: true, plans: await store.listPlans(), done: page.done, remaining: page.remaining };
  } catch (err: any) {
    return { ok: false, plans: [], error: 'busy', message: err?.message || 'The plan could not be deleted. Try again.' };
  }
}

/** Deletes the next page of records of a plan that is being deleted (N-02). */
export async function continuePlanDelete(
  payload: { projectKey: string; projectId?: string; planId: string },
  storageProvider?: StorageProvider
): Promise<{ ok: boolean; done: boolean; remaining: number; plans: PlanMetadata[] }> {
  validatePlanId(payload.planId);
  const store = openStore(resolveStorage(storageProvider), payload.projectKey, payload.projectId);
  const page = await store.deletePlanPage(payload.planId);
  return { ...page, plans: await store.listPlans() };
}

/**
 * Renames an existing plan (UX-05).
 */
export async function renameProjectPlan(
  payload: { projectKey: string; projectId?: string; planId: string; name: string },
  storageProvider?: StorageProvider
): Promise<{ ok: boolean; plan?: PlanMetadata | null; plans: PlanMetadata[]; error?: string; message?: string }> {
  try {
    const trimmed = validatePlanName(payload.name);
    validatePlanId(payload.planId);
    const storage = resolveStorage(storageProvider);
    const store = openStore(storage, payload.projectKey, payload.projectId);
    const plan = await store.renamePlan(payload.planId, trimmed);
    const plans = await store.listPlans();
    return { ok: !!plan, plan, plans };
  } catch (err: any) {
    return { ok: false, plans: [], error: 'validation', message: err?.message || 'Invalid plan name' };
  }
}
