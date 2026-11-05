/*
 * Copyright (c) 2026 Asymm Systems. All rights reserved.
 *
 * @author Fahim Farook
 */

/**
 * CascadePlan server: Baselines, scope changes and the personal data report (ADR-009).
 * Split from src/index.ts without changes to any statement (F-31).
 */

import { privacy } from '@forge/api';
import { ProjectPlanState } from '../domain/models';
import { StorageProvider } from '../storage/plan-repository';
import { logFailure } from '../logger';
import { ValidationError, validatePlanId } from '../validation';
import { BaselineStore, ShiftRequest, ACCOUNTS_KEY, eraseClosedAccounts } from '../storage/baseline-store';
import { contributorAccounts, eraseContributor } from '../storage/personal-data';
import { baselineItems, compareItems, baselineCsv } from '../domain/baseline';
import { resolveStorage, writablePlanId } from './core';
import { loadLive } from './jira-read';
import { getProjectPlan } from './plan-read';

// ---- Baselines, scope changes and their records (ADR-009, DEC-1 Option B) ----

export function baselineStore(storage: StorageProvider, projectKey: string, projectId: string | undefined, planId: string | undefined): BaselineStore {
  return new BaselineStore(storage, projectId || projectKey, planId && planId !== 'default' ? planId : 'default');
}

export function cleanText(field: string, v: unknown, max: number, required: boolean): string {
  const s = typeof v === 'string' ? v.trim() : '';
  if ((required && !s) || s.length > max) throw new ValidationError(field, `${field} must be text of ${required ? '1' : '0'} to ${max} characters`);
  return s;
}

/** Names of account ids, read live from the Jira users of the project (never stored, ADR-009). */
export function nameOf(users: Array<{ accountId: string; displayName: string }>, accountId: string | null | undefined): string {
  if (!accountId) return 'a deleted user';
  return users.find(u => u.accountId === accountId)?.displayName || 'a Jira user';
}

/** The active baseline against a plan already loaded: no Jira call; a failure never breaks the load. */
export async function baselineStatusFor(storage: StorageProvider, projectKey: string, projectId: string | undefined, plan: ProjectPlanState): Promise<any> {
  try {
    const store = baselineStore(storage, projectKey, projectId, plan.planId);
    const active = (await store.readIndex()).active;
    const b = active ? await store.load(active) : undefined;
    if (!b) return { ok: false };
    // The items go to the browser, which compares them with the plan after every change (no extra call).
    return { ok: true, baseline: b.header, intact: b.intact, items: b.items };
  } catch (err) {
    logFailure('baselineStatusFor', err);
    return { ok: false };
  }
}

/** Freezes the scope of a plan as a new baseline, which becomes active. Plan approvers only. */
export async function freezePlanBaseline(
  payload: { projectKey: string; projectId?: string; planId?: string; name: string },
  storageProvider?: StorageProvider,
  context?: any
): Promise<any> {
  const storage = resolveStorage(storageProvider);
  const planId = await writablePlanId(storage, payload.projectKey, payload.projectId, payload.planId);
  const name = cleanText('name', payload.name, 80, true);
  const plan = await getProjectPlan(payload.projectKey, storage, new Date(), undefined, payload.projectId, undefined, planId);
  const items = baselineItems(plan.tasks);
  if (items.length === 0) return { ok: false, success: false, error: 'empty', message: 'Nothing is on the timeline of this plan, so there is nothing to freeze.' };
  const store = baselineStore(storage, payload.projectKey, payload.projectId, planId);
  const header = await store.save({ id: `bl-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`, name,
    frozenAt: new Date().toISOString(), frozenBy: context?.accountId || null, items });
  return { ok: true, success: true, baseline: header };
}

/** The baselines of a plan (versions), the active one checked for integrity, and the scope-change requests. */
export async function getPlanBaselines(
  payload: { projectKey: string; projectId?: string; planId?: string },
  storageProvider?: StorageProvider
): Promise<any> {
  const storage = resolveStorage(storageProvider);
  validatePlanId(payload.planId);
  const store = baselineStore(storage, payload.projectKey, payload.projectId, payload.planId);
  const { active, headers } = await store.list();
  const users = (await loadLive(payload.projectKey)).users || [];
  const loaded = active ? await store.load(active) : undefined;
  const shifts = (await store.shifts()).map(s => ({ ...s, requestedByName: nameOf(users, s.requestedBy),
    ...(s.status !== 'PENDING' ? { reviewedByName: nameOf(users, s.reviewedBy) } : {}) }));
  return { ok: true, success: true, active: active || null, activeIntact: loaded ? loaded.intact : null,
    baselines: headers.map(h => ({ ...h, frozenByName: nameOf(users, h.frozenBy) })).reverse(), shifts };
}

/** Item details for display: the summary of each key, read live from the current plan. */
export function summariesOf(plan: ProjectPlanState): Record<string, string> {
  const out: Record<string, string> = {};
  for (const t of [...plan.tasks, ...(plan.backlogTasks || [])]) out[t.key] = t.summary;
  return out;
}

/** The scope delta: a baseline (the active one by default) against the current plan. */
export async function getScopeCreepReport(
  payload: { projectKey: string; projectId?: string; planId?: string; baselineId?: string },
  storageProvider?: StorageProvider
): Promise<any> {
  const storage = resolveStorage(storageProvider);
  validatePlanId(payload.planId);
  const store = baselineStore(storage, payload.projectKey, payload.projectId, payload.planId);
  const id = payload.baselineId ? cleanText('baselineId', payload.baselineId, 64, true) : (await store.readIndex()).active;
  if (!id) return { ok: false, success: false, error: 'no_baseline', message: 'This plan has no baseline yet. A plan approver can freeze one.' };
  const b = await store.load(id);
  if (!b) return { ok: false, success: false, error: 'no_baseline', message: 'That baseline no longer exists.' };
  const plan = await getProjectPlan(payload.projectKey, storage, new Date(), undefined, payload.projectId, undefined, payload.planId);
  return { ok: true, success: true, baseline: b.header, intact: b.intact, comparison: compareItems(b.items, baselineItems(plan.tasks)), summaries: summariesOf(plan) };
}

/** Two baseline versions compared. */
export async function compareBaselines(
  payload: { projectKey: string; projectId?: string; planId?: string; fromId: string; toId: string },
  storageProvider?: StorageProvider
): Promise<any> {
  const storage = resolveStorage(storageProvider);
  validatePlanId(payload.planId);
  const store = baselineStore(storage, payload.projectKey, payload.projectId, payload.planId);
  const a = await store.load(cleanText('fromId', payload.fromId, 64, true));
  const b = await store.load(cleanText('toId', payload.toId, 64, true));
  if (!a || !b) return { ok: false, success: false, error: 'no_baseline', message: 'One of the two baselines no longer exists.' };
  const plan = await getProjectPlan(payload.projectKey, storage, new Date(), undefined, payload.projectId, undefined, payload.planId);
  return { ok: true, success: true, from: a.header, to: b.header, intact: a.intact && b.intact, comparison: compareItems(a.items, b.items), summaries: summariesOf(plan) };
}

/** A baseline as CSV and JSON, with its digest and whether it is still intact. */
export async function exportBaseline(
  payload: { projectKey: string; projectId?: string; planId?: string; baselineId: string },
  storageProvider?: StorageProvider
): Promise<any> {
  const storage = resolveStorage(storageProvider);
  validatePlanId(payload.planId);
  const b = await baselineStore(storage, payload.projectKey, payload.projectId, payload.planId).load(cleanText('baselineId', payload.baselineId, 64, true));
  if (!b) return { ok: false, success: false, error: 'no_baseline', message: 'That baseline no longer exists.' };
  return { ok: true, success: true, header: b.header, intact: b.intact, items: b.items, csv: baselineCsv(b) };
}

/** Makes an earlier baseline version the active one. Plan approvers only. */
export async function setActiveBaseline(
  payload: { projectKey: string; projectId?: string; planId?: string; baselineId: string },
  storageProvider?: StorageProvider
): Promise<any> {
  const storage = resolveStorage(storageProvider);
  const planId = await writablePlanId(storage, payload.projectKey, payload.projectId, payload.planId);
  const ok = await baselineStore(storage, payload.projectKey, payload.projectId, planId).setActive(cleanText('baselineId', payload.baselineId, 64, true));
  return ok ? { ok: true, success: true } : { ok: false, success: false, error: 'no_baseline', message: 'That baseline no longer exists.' };
}

/** Any project user asks a plan approver to accept the current scope against the active baseline. */
export async function requestScopeShift(
  payload: { projectKey: string; projectId?: string; planId?: string; reason: string },
  storageProvider?: StorageProvider,
  context?: any
): Promise<any> {
  const storage = resolveStorage(storageProvider);
  const planId = await writablePlanId(storage, payload.projectKey, payload.projectId, payload.planId);
  const reason = cleanText('reason', payload.reason, 1000, true);
  const store = baselineStore(storage, payload.projectKey, payload.projectId, planId);
  const active = (await store.readIndex()).active;
  const b = active ? await store.load(active) : undefined;
  if (!b) return { ok: false, success: false, error: 'no_baseline', message: 'This plan has no active baseline to change.' };
  const plan = await getProjectPlan(payload.projectKey, storage, new Date(), undefined, payload.projectId, undefined, planId);
  const c = compareItems(b.items, baselineItems(plan.tasks));
  if (!c.added.length && !c.removed.length && !c.changed.length) return { ok: false, success: false, error: 'no_change', message: 'The plan matches its baseline, so there is no scope change to request.' };
  const request: ShiftRequest = { id: `shift-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`, planId: planId || 'default',
    baselineId: b.header.id, requestedBy: context?.accountId || null, requestedAt: new Date().toISOString(), reason, status: 'PENDING',
    summary: { added: c.added.length, removed: c.removed.length, changed: c.changed.length, deltaHours: c.deltaHours }, v: 1 };
  await store.saveShift(request);
  return { ok: true, success: true, request };
}

/**
 * A plan approver accepts or rejects a scope-change request, once, and never their own. Accepting
 * freezes a new baseline version from the current plan, which supersedes the old one and is active.
 */
export async function reviewScopeShift(
  payload: { projectKey: string; projectId?: string; planId?: string; shiftId: string; status: 'APPROVED' | 'REJECTED'; comment?: string },
  storageProvider?: StorageProvider,
  context?: any
): Promise<any> {
  const storage = resolveStorage(storageProvider);
  const planId = await writablePlanId(storage, payload.projectKey, payload.projectId, payload.planId);
  if (payload.status !== 'APPROVED' && payload.status !== 'REJECTED') return { ok: false, success: false, error: 'The review must be APPROVED or REJECTED.' };
  const comment = cleanText('comment', payload.comment ?? '', 1000, false);
  const store = baselineStore(storage, payload.projectKey, payload.projectId, planId);
  const target = await store.shift(cleanText('shiftId', payload.shiftId, 64, true));
  if (!target) return { ok: false, success: false, error: 'Shift request not found' };
  if (target.status !== 'PENDING') return { ok: false, success: false, error: 'This request has already been reviewed.' };
  const accountId = context?.accountId;
  if (!accountId) return { ok: false, success: false, error: 'The reviewer could not be identified.' };
  if (accountId === target.requestedBy) return { ok: false, success: false, error: 'A request cannot be approved or rejected by the person who made it.' };
  const reviewed: ShiftRequest = { ...target, status: payload.status, reviewedBy: accountId, reviewedAt: new Date().toISOString(), ...(comment ? { comment } : {}) };
  if (payload.status === 'APPROVED') {
    const plan = await getProjectPlan(payload.projectKey, storage, new Date(), undefined, payload.projectId, undefined, planId);
    const old = await store.header(target.baselineId);
    const versions = (await store.readIndex()).ids.length;
    const header = await store.save({ id: `bl-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
      name: `${(old?.name || 'Baseline').replace(/ \(version \d+\)$/, '')} (version ${versions + 1})`, frozenAt: reviewed.reviewedAt!,
      frozenBy: accountId, items: baselineItems(plan.tasks), supersedes: target.baselineId });
    reviewed.newBaselineId = header.id;
  }
  await store.saveShift(reviewed);
  return { ok: true, success: true, request: reviewed };
}

/**
 * Weekly scheduled trigger (ADR-009 decision 7, DEC-2, BL-5): reports every account id the app stores
 * with Forge's personal data reporting API, and makes the records of closed accounts name no one.
 * The account ids are the audit subjects of baselines and scope changes (their index) and the
 * contributors of the plan records (found by reading the records).
 */
export async function reportPersonalData(storageProvider?: StorageProvider, report?: (a: Array<{ accountId: string; updatedAt: string }>) => Promise<Array<{ accountId: string; status: string }>>): Promise<{ reported: number; closed: string[] }> {
  const storage = resolveStorage(storageProvider);
  const idx = (await storage.get<Record<string, { keys: string[]; updatedAt: string }>>(ACCOUNTS_KEY)) || {};
  const contributors = (await contributorAccounts(storage)).accounts;
  const updatedAt = new Map<string, string>(Object.entries(idx).map(([accountId, v]) => [accountId, v.updatedAt]));
  for (const [accountId, c] of contributors) {
    if (!updatedAt.has(accountId)) updatedAt.set(accountId, c.since ? `${c.since}T00:00:00.000Z` : new Date().toISOString());
  }
  const accounts = [...updatedAt].map(([accountId, at]) => ({ accountId, updatedAt: at }));
  if (accounts.length === 0) return { reported: 0, closed: [] };
  const updates = await (report || privacy.reportPersonalData)(accounts);
  const closedIds = updates.filter(u => u.status === 'closed').map(u => u.accountId);
  const closed = new Set(await eraseClosedAccounts(storage, closedIds));
  for (const accountId of closedIds) {
    const c = contributors.get(accountId);
    if (!c) continue;
    await eraseContributor(storage, accountId, c.keys);
    closed.add(accountId);
  }
  return { reported: accounts.length, closed: closedIds.filter(id => closed.has(id)) };
}

export const personalDataTrigger = async (): Promise<void> => {
  try {
    const r = await reportPersonalData();
    // eslint-disable-next-line no-console
    console.log(`personal data report: ${r.reported} account(s) reported, ${r.closed.length} closed and erased`);
  } catch (err) { logFailure('reportPersonalData', err); }
};
