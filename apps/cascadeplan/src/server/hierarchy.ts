/*
 * Copyright (c) 2026 Asymm Systems. All rights reserved.
 *
 * @author Fahim Farook
 */

/**
 * CascadePlan server: Hierarchy changes in Jira: parent changes and work type conversions (ADR-005).
 * Split from src/index.ts without changes to any statement (F-31).
 */

import api, { route } from '@forge/api';
import { WbsTask } from '../domain/models';
import { StorageProvider } from '../storage/plan-repository';
import { deniedIssues, describeMissing, forbiddenResult } from '../security/write-permissions';
import { ValidationError, assertIssueKey, reconcileIdsOf } from '../validation';
import { SyncLog, getDefaultWeeks, getJiraCaller, isIsoDate, noJiraWrites, openStore, resolveStorage, stripJiraOwnedFields, writablePlanId } from './core';
import { loadLive } from './jira-read';
import { applyAcceptedDueDate, syncTaskToJira } from './jira-write';
import { getProjectPlan, planFilterOf } from './plan-read';
import { ancestorKeys, cascadeAndApply, followParentDueDates, withRollUps, writtenIssueIds } from './tasks';

/**
 * N-08, ADR-005: the hierarchy belongs to Jira; every change is a Jira write, so every plan shows it.
 * The rules Jira enforces are checked first, with Jira's rule as the plain reason.
 */
export function hierarchyRefusal(task: WbsTask, target: WbsTask | undefined, all: WbsTask[]): string | null {
  const level = (t: WbsTask) => (t.isEpic ? 1 : (t.hierarchyLevel ?? 0));
  if (level(task) >= 1) return `${task.key} is an epic. An epic cannot move under another work item.`;
  if (!target) return null;
  if (target.key === task.key) return `${task.key} cannot be its own parent.`;
  if (ancestorKeys(target.key, all).includes(task.key)) return `${target.key} is below ${task.key}, so ${task.key} cannot move under it.`;
  if (target.isSubtask || level(target) === -1) return `${target.key} is a sub-task. A sub-task cannot have children in Jira.`;
  return null;
}

/** A link between the task and the new parent or one of its ancestors is a cycle through the roll-up (N-06 rule 6). */
export function linkCycleWithParent(task: WbsTask, newParentKey: string, all: WbsTask[]): string | null {
  const chain = new Set([newParentKey, ...ancestorKeys(newParentKey, all)]);
  for (const d of task.dependencies || []) if (chain.has(d.predecessorKey)) return d.predecessorKey;
  for (const t of all) if (chain.has(t.key) && (t.dependencies || []).some(d => d.predecessorKey === task.key)) return t.key;
  return null;
}

/**
 * Changes the parent of a work item, through Jira's edit endpoint (proven on the development site):
 * R1, a task or story under another epic (or none); R2, a sub-task under another task or story.
 * A standard work item onto a standard work item is a type conversion (convertIssueType).
 */
export async function changeParent(
  payload: { projectKey: string; projectId?: string; planId?: string; taskId: string; newParentKey?: string | null; reconcileIds?: string[] },
  storageProvider?: StorageProvider
): Promise<any> {
  const { projectKey, projectId, taskId } = payload;
  assertIssueKey(taskId, 'taskId');
  const newParentKey = payload.newParentKey || null;
  if (newParentKey !== null) assertIssueKey(newParentKey, 'newParentKey');
  const storage = resolveStorage(storageProvider);
  const planId = await writablePlanId(storage, projectKey, projectId, payload.planId);
  const log = new SyncLog();
  const live = await loadLive(projectKey, reconcileIdsOf(payload.reconcileIds), await planFilterOf(storage, projectKey, projectId, planId));
  const plan = await getProjectPlan(projectKey, storage, new Date(), undefined, projectId, live, planId);
  const all = [...plan.tasks, ...(plan.backlogTasks || [])];
  const task = all.find(t => t.key === taskId);
  if (!task) throw new ValidationError('taskId', `${taskId} is not in project ${projectKey}`);
  const target = newParentKey ? all.find(t => t.key === newParentKey) : undefined;
  if (newParentKey && !target) throw new ValidationError('newParentKey', `${newParentKey} is not in project ${projectKey}`);
  const refusal = hierarchyRefusal(task, target, all);
  if (refusal) throw new ValidationError('newParentKey', refusal);
  const isSub = task.isSubtask || task.hierarchyLevel === -1;
  const targetIsEpic = !!target && (target.isEpic || (target.hierarchyLevel ?? 0) >= 1);
  if (isSub && (!target || targetIsEpic)) {
    throw new ValidationError('newParentKey', `${task.key} is a sub-task: its parent must be a task or story. To make it a task, convert its type.`);
  }
  if (!isSub && target && !targetIsEpic) {
    throw new ValidationError('newParentKey', `Making ${task.key} a sub-task of ${target.key} changes its work type. Use the type conversion.`);
  }
  if ((task.parentKey || null) === newParentKey) throw new ValidationError('newParentKey', `${task.key} is already under ${newParentKey || 'no parent'}.`);
  if (newParentKey) {
    const linked = linkCycleWithParent(task, newParentKey, all);
    if (linked) throw new ValidationError('newParentKey', `${task.key} has a dependency with ${linked}, which would be its parent. Remove that link first.`);
  }
  // BL-2 step 2b: Edit issues on the moved issue.
  const denied = await deniedIssues([{ key: task.key, id: task.id }], ['EDIT_ISSUES']);
  if (denied.length) return forbiddenResult(`You cannot move ${task.key}: your Jira role lacks ${describeMissing(denied[0].missing)}.`);

  const oldParentKey = task.parentKey;
  let ok = false;
  let reason = 'Jira did not change the parent';
  try {
    const res = await getJiraCaller().requestJira(route`/rest/api/3/issue/${task.key}`, {
      method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ fields: { parent: newParentKey ? { key: newParentKey } : null } })
    });
    ok = !!res && (res.status === 204 || res.status === 200);
    if (!ok) {
      const body = await res.json().catch(() => ({}));
      reason = body?.errorMessages?.join(', ') || Object.values(body?.errors || {}).join(', ') || reason;
    }
  } catch (err: any) { reason = err?.message || reason; }
  log.record(task.key, ['parent'], ok ? { synced: true } : { synced: false, error: reason },
    [{ field: 'parent', from: oldParentKey || null, to: newParentKey }]);
  if (!ok) return Object.assign(plan, { ok: false, success: false, error: 'parent_refused', message: `${reason}.`, jiraSync: log.report() });

  // The record stays (keyed by issue id, proven on the development site). The old parent's contributor
  // entry for this sub-task is removed: under the new parent it is an ordinary sub-task.
  const store = openStore(storage, projectKey, projectId, planId);
  const entries = await store.loadEntries();
  if (isSub && oldParentKey) {
    const op = entries.get(oldParentKey);
    if (op?.contributors?.some((c: any) => c.subtaskKey === task.key)) {
      const { issueKey: _k, issueId: _i, version, ...rest } = op as any;
      await store.putEntry(oldParentKey, op.issueId, stripJiraOwnedFields({ ...rest, contributors: op.contributors.filter((c: any) => c.subtaskKey !== task.key) }), version);
    }
  }
  // The roll-ups of both parents change: DEC-6 for both, and their successors cascade (N-06 rule 1).
  live.raw = { ...live.raw, issues: (live.raw.issues || []).map((i: any) => (i && i.key === task.key
    ? { ...i, fields: { ...(i.fields || {}), parent: newParentKey ? { key: newParentKey, id: target!.id, fields: { summary: target!.summary } } : null } } : i)) };
  const candidate = withRollUps(all.map(t => (t.key === task.key ? { ...t, parentKey: newParentKey || undefined } : t)));
  const roots = [oldParentKey, newParentKey].filter((k): k is string => !!k);
  for (const r of [...roots]) roots.push(...ancestorKeys(r, candidate));
  const moved = new Map<string, { startDate?: string; endDate?: string }>();
  const { cascadeRemaining, notMoved } = await cascadeAndApply({ candidate, all, roots, exclude: new Set([task.key]), store, entries,
    idByKey: new Map(all.map(t => [t.key, t.id])), activeWeeks: plan.weeks || getDefaultWeeks(), log, live, moved });
  await followParentDueDates(all, moved, log, live, { key: task.key, parentKey: newParentKey || undefined });
  const ids = [task.id, all.find(t => t.key === oldParentKey)?.id, target?.id].filter((id): id is string => !!id && /^\d+$/.test(id));
  const out = Object.assign(await getProjectPlan(projectKey, storage, new Date(), undefined, projectId, live, planId, ids),
    { ok: true, jiraSync: log.report(), cascadeRemaining, cascadeSkipped: [...notMoved] });
  return Object.assign(out, { writtenIssueIds: [...new Set([...ids, ...writtenIssueIds(log, all)])].slice(0, 50) });
}

/** Whether the user holds a global Jira permission, as the user. Fails closed. */
export async function hasGlobalPermission(permission: string): Promise<boolean> {
  try {
    const res = await getJiraCaller().requestJira(route`/rest/api/3/permissions/check`, {
      method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'application/json' }, body: JSON.stringify({ globalPermissions: [permission] })
    });
    if (!res || res.status !== 200) return false;
    const data = await res.json();
    return Array.isArray(data?.globalPermissions) && data.globalPermissions.includes(permission);
  } catch { return false; }
}

/**
 * Converts the work type through Jira's bulk move (proven on the development site): R3, a task or
 * story without sub-tasks becomes a sub-task of `toSubtaskOf`; R4, a sub-task becomes a standard work
 * item of `toTypeName` (default Task). Returns Jira's job id; checkConversion follows the job.
 */
export async function convertIssueType(
  payload: { projectKey: string; projectId?: string; planId?: string; taskId: string; toSubtaskOf?: string; toTypeName?: string },
  storageProvider?: StorageProvider
): Promise<any> {
  const { projectKey, projectId, taskId } = payload;
  assertIssueKey(taskId, 'taskId');
  if (payload.toSubtaskOf !== undefined) assertIssueKey(payload.toSubtaskOf, 'toSubtaskOf');
  if (payload.toTypeName !== undefined && (typeof payload.toTypeName !== 'string' || !/^[\w -]{1,60}$/.test(payload.toTypeName))) {
    throw new ValidationError('toTypeName', 'toTypeName must be a work type name');
  }
  const storage = resolveStorage(storageProvider);
  await writablePlanId(storage, projectKey, projectId, payload.planId);
  const plan = await getProjectPlan(projectKey, storage, new Date(), undefined, projectId, undefined, payload.planId);
  const all = [...plan.tasks, ...(plan.backlogTasks || [])];
  const task = all.find(t => t.key === taskId);
  if (!task) throw new ValidationError('taskId', `${taskId} is not in project ${projectKey}`);
  const isSub = task.isSubtask || task.hierarchyLevel === -1;
  const target = payload.toSubtaskOf ? all.find(t => t.key === payload.toSubtaskOf) : undefined;
  if (payload.toSubtaskOf) {
    if (isSub) throw new ValidationError('toSubtaskOf', `${task.key} is already a sub-task. Change its parent instead.`);
    if (!target) throw new ValidationError('toSubtaskOf', `${payload.toSubtaskOf} is not in project ${projectKey}`);
    const refusal = hierarchyRefusal(task, target, all);
    if (refusal) throw new ValidationError('toSubtaskOf', refusal);
    if (target.isEpic || (target.hierarchyLevel ?? 0) >= 1) throw new ValidationError('toSubtaskOf', `${target.key} is an epic. Change the parent of ${task.key} instead.`);
    if (all.some(t => t.parentKey === task.key)) throw new ValidationError('toSubtaskOf', `${task.key} has sub-tasks, so Jira cannot make it a sub-task.`);
    const linked = linkCycleWithParent(task, target.key, all);
    if (linked) throw new ValidationError('toSubtaskOf', `${task.key} has a dependency with ${linked}, which would be its parent. Remove that link first.`);
  } else if (!isSub) {
    throw new ValidationError('toSubtaskOf', `${task.key} is not a sub-task. Name the parent it should become a sub-task of.`);
  }
  // BL-2 step 2b: Edit, Move and Create issues in the project, and the global Make bulk changes.
  const denied = await deniedIssues([{ key: task.key, id: task.id }], ['EDIT_ISSUES', 'MOVE_ISSUES', 'CREATE_ISSUES']);
  if (denied.length) return forbiddenResult(`You cannot convert ${task.key}: your Jira role lacks ${describeMissing(denied[0].missing)}.`);
  if (!(await hasGlobalPermission('BULK_CHANGE'))) return forbiddenResult(`You cannot convert ${task.key}: Jira's "Make bulk changes" permission is needed, and you do not have it.`);

  const caller = getJiraCaller();
  const types = await caller.requestJira(route`/rest/api/3/issue/createmeta/${projectKey}/issuetypes`);
  const list: any[] = types && types.status === 200 ? ((await types.json())?.issueTypes || []) : [];
  const wantName = payload.toSubtaskOf ? undefined : (payload.toTypeName || 'Task');
  const type = payload.toSubtaskOf ? list.find(x => x.subtask) : list.find(x => !x.subtask && x.name === wantName);
  if (!type) throw new ValidationError('toTypeName', payload.toSubtaskOf ? `Project ${projectKey} has no sub-task work type.` : `Project ${projectKey} has no work type "${wantName}".`);
  const mapping = `${projectKey},${type.id}${payload.toSubtaskOf ? `,${payload.toSubtaskOf}` : ''}`;
  const res = await caller.requestJira(route`/rest/api/3/bulk/issues/move`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ sendBulkNotification: false, targetToSourcesMapping: { [mapping]: {
      inferClassificationDefaults: true, inferFieldDefaults: true, inferStatusDefaults: true, inferSubtaskTypeDefault: true, issueIdsOrKeys: [task.key] } } })
  });
  if (!res || (res.status !== 201 && res.status !== 200)) {
    const body = await res?.json().catch(() => ({}));
    const text = body?.errorMessages?.join(', ') || Object.values(body?.errors || {}).join(', ') || `Jira status ${res?.status}`;
    const busy = res?.status === 429 || /concurrent|already running|limit/i.test(text);
    return { ok: false, success: false, error: busy ? 'bulk_busy' : 'convert_refused', jiraSync: noJiraWrites(),
      message: busy ? 'Jira is already running the most bulk changes it allows on this site. Try again in a minute.' : `Jira did not convert ${task.key}: ${text}.` };
  }
  const job = await res.json();
  return { ok: true, jobId: String(job.taskId), taskId: task.key, oldParentKey: task.parentKey || null, newParentKey: payload.toSubtaskOf || null, jiraSync: noJiraWrites() };
}

/**
 * Follows a type conversion job. When Jira reports it complete, the parents' due dates follow their
 * new roll-ups (DEC-6) and the plan is returned with the converted issue read after the write.
 */
export async function checkConversion(
  payload: { projectKey: string; projectId?: string; planId?: string; jobId: string; taskId: string; oldParentKey?: string | null; newParentKey?: string | null },
  storageProvider?: StorageProvider
): Promise<any> {
  const { projectKey, projectId } = payload;
  if (typeof payload.jobId !== 'string' || !/^\d{1,20}$/.test(payload.jobId)) throw new ValidationError('jobId', 'jobId must be a Jira task id');
  assertIssueKey(payload.taskId, 'taskId');
  for (const k of [payload.oldParentKey, payload.newParentKey]) if (k) assertIssueKey(k, 'parentKey');
  const res = await getJiraCaller().requestJira(route`/rest/api/3/bulk/queue/${payload.jobId}`);
  if (!res || res.status !== 200) return { ok: false, done: false, error: 'job_unknown', message: 'Jira did not report on the conversion. Reload to see the work type.' };
  const job = await res.json();
  const status = String(job?.status || '');
  const failed = job?.failedAccessibleIssues && Object.keys(job.failedAccessibleIssues).length > 0;
  if (!['COMPLETE', 'FAILED', 'CANCELLED', 'DEAD'].includes(status)) return { ok: true, done: false, status, progress: job?.progressPercent ?? 0 };
  const log = new SyncLog();
  if (status !== 'COMPLETE' || failed) {
    const reason = failed ? Object.values(job.failedAccessibleIssues).flat().join(', ') : `the job ended as ${status}`;
    log.record(payload.taskId, ['type'], { synced: false, error: `Jira did not convert it: ${reason}` });
    return { ok: false, done: true, status, error: 'convert_failed', message: `Jira did not convert ${payload.taskId}: ${reason}.`, jiraSync: log.report() };
  }
  log.record(payload.taskId, ['type'], { synced: true }, [{ field: 'parent', from: payload.oldParentKey || null, to: payload.newParentKey || null }]);
  const storage = resolveStorage(storageProvider);
  const planId = await writablePlanId(storage, projectKey, projectId, payload.planId);
  const live = await loadLive(projectKey, [], await planFilterOf(storage, projectKey, projectId, planId));
  const plan = await getProjectPlan(projectKey, storage, new Date(), undefined, projectId, live, planId);
  const all = [...plan.tasks, ...(plan.backlogTasks || [])];
  // DEC-6: each parent whose roll-up end now differs from its Jira due date gets that end.
  for (const key of [payload.oldParentKey, payload.newParentKey]) {
    const p = key ? all.find(t => t.key === key) : undefined;
    if (!p || !p.datesFromChildren || !isIsoDate(p.endDate) || String(p.jiraDueDate || '').slice(0, 10) === p.endDate) continue;
    const denied = await deniedIssues([{ key: p.key, id: p.id }], ['EDIT_ISSUES', 'SCHEDULE_ISSUES']);
    if (denied.length) { log.record(p.key, ['duedate'], { synced: false, error: `not written: you lack ${describeMissing(denied[0].missing)} on this parent in Jira` }); continue; }
    applyAcceptedDueDate(live, p.key, { endDate: p.endDate }, await syncTaskToJira(p.key, { endDate: p.endDate }, log, p));
  }
  const ids = [payload.taskId, payload.oldParentKey, payload.newParentKey].map(k => all.find(t => t.key === k)?.id).filter((id): id is string => !!id && /^\d+$/.test(id));
  return Object.assign(await getProjectPlan(projectKey, storage, new Date(), undefined, projectId, live, planId, ids),
    { ok: true, done: true, status, jiraSync: log.report(), writtenIssueIds: ids });
}
