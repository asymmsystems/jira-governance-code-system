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
import { deniedIssues } from '../security/write-permissions';
import { ValidationError, validatePlanId } from '../validation';
import { BaselineStore, ShiftRequest } from '../storage/baseline-store';
import { runPersonalDataJob, PdOptions, PdRunResult, ReportFn } from '../storage/personal-data';
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

/**
 * The baseline items the caller may see (merge review M1): an item is kept when its issue is in the
 * caller's own live read of the plan, or when Jira's permission check, as the caller, grants Browse
 * projects on it. Jira decides issue security; when the check fails, the unchecked items are left out
 * (fail closed). Header totals (hours and item count) stay those of the whole baseline.
 */
export async function visibleItems<T extends { id?: string; key: string }>(items: T[], liveIds: Set<string>): Promise<{ items: T[]; hidden: number }> {
  const unknown = items.filter(i => !liveIds.has(String(i.id)));
  if (unknown.length === 0) return { items, hidden: 0 };
  let denied: Set<string>;
  try {
    denied = new Set((await deniedIssues(unknown.map(i => ({ key: i.key, id: i.id })), ['BROWSE_PROJECTS'])).map(d => d.key));
  } catch (err) {
    logFailure('visibleItems', err);
    denied = new Set(unknown.map(i => i.key));
  }
  const kept = items.filter(i => !denied.has(i.key));
  return { items: kept, hidden: items.length - kept.length };
}

/** Ids of the issues in the caller's live read of a plan. */
function liveIdsOf(plan: ProjectPlanState): Set<string> {
  return new Set([...plan.tasks, ...(plan.backlogTasks || [])].map(t => String(t.id)).filter(id => /^\d+$/.test(id)));
}

/** The active baseline against a plan already loaded: no Jira call; a failure never breaks the load. */
export async function baselineStatusFor(storage: StorageProvider, projectKey: string, projectId: string | undefined, plan: ProjectPlanState): Promise<any> {
  try {
    const store = baselineStore(storage, projectKey, projectId, plan.planId);
    const active = (await store.readIndex()).active;
    const b = active ? await store.load(active) : undefined;
    if (!b) return { ok: false };
    // The items go to the browser, which compares them with the plan after every change (no extra call).
    const seen = await visibleItems(b.items, liveIdsOf(plan));
    return { ok: true, baseline: b.header, intact: b.intact, items: seen.items, hidden: seen.hidden };
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
  const seen = await visibleItems(b.items, liveIdsOf(plan));
  return { ok: true, success: true, baseline: b.header, intact: b.intact, comparison: compareItems(seen.items, baselineItems(plan.tasks)), summaries: summariesOf(plan), hidden: seen.hidden };
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
  const live = liveIdsOf(plan);
  const sa = await visibleItems(a.items, live);
  const sb = await visibleItems(b.items, live);
  return { ok: true, success: true, from: a.header, to: b.header, intact: a.intact && b.intact, comparison: compareItems(sa.items, sb.items), summaries: summariesOf(plan),
    hidden: Math.max(sa.hidden, sb.hidden) };
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
  // Every item is checked as the caller; the digest line still covers the whole baseline as frozen.
  const seen = await visibleItems(b.items, new Set());
  const csv = baselineCsv({ ...b, items: seen.items }) + (seen.hidden ? `# ${seen.hidden} item(s) of issues you cannot browse are left out; the SHA-256 covers the whole baseline.\n` : '');
  return { ok: true, success: true, header: b.header, intact: b.intact, items: seen.items, hidden: seen.hidden, csv };
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
 * The personal data report (ADR-009 decision 7, DEC-2, BL-5, merge review H1 and M2): one step of the
 * job in src/storage/personal-data.ts, which finds every account id the app stores, reports each with
 * Forge's personal data reporting API at most once in 7 days, and makes the records of closed accounts
 * name no one. The step stops inside its time budget and saves its progress; the next run continues.
 */
export async function reportPersonalData(storageProvider?: StorageProvider, report?: ReportFn, options?: PdOptions): Promise<PdRunResult> {
  return runPersonalDataJob(resolveStorage(storageProvider), report || privacy.reportPersonalData, options);
}

/** Hourly scheduled trigger (manifest `personal-data-report`, function timeout 900 s). */
export const personalDataTrigger = async (): Promise<void> => {
  try {
    const r = await reportPersonalData();
    if (r.status === 'waiting') return;
    // eslint-disable-next-line no-console
    console.log(`personal data report: ${r.status} (${r.phase}), ${r.reported} account(s) reported, ${r.closed.length} closed, ${r.pages} page(s)`);
  } catch (err) { logFailure('reportPersonalData', err); }
};
