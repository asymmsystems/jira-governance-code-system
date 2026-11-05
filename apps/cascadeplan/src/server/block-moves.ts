/*
 * Copyright (c) 2026 Asymm Systems. All rights reserved.
 *
 * @author Fahim Farook
 */

/**
 * CascadePlan server: Moving a parent with its sub-tasks (ADR-003), in calls of at most 25 sub-tasks.
 * Split from src/index.ts without changes to any statement (F-31).
 */

import { WbsTask } from '../domain/models';
import { StorageProvider } from '../storage/plan-repository';
import { BatchStorage } from '../storage/batch-storage';
import { planBlockMove, BlockChange } from '../domain/block-move';
import { deniedIssues, describeMissing, forbiddenResult } from '../security/write-permissions';
import { ValidationError, assertIssueKey, reconcileIdsOf } from '../validation';
import { SyncLog, conflictResult, getDefaultWeeks, gridFor, isIsoDate, openStore, resolveStorage, stripJiraOwnedFields, todayIso, writablePlanId } from './core';
import { loadLive } from './jira-read';
import { applyAcceptedDueDate, syncTaskToJira } from './jira-write';
import { getProjectPlan, planFilterOf } from './plan-read';
import { ancestorKeys, cascadeAndApply, followParentDueDates, withRollUps, writtenIssueIds } from './tasks';

/** Sub-tasks whose Jira dates one call writes; a larger block continues in continueBlockMove calls. */
export const BLOCK_MOVE_LIMIT = 25;
/** A block larger than this is refused (checks and record writes of one call stay within its time). */
export const BLOCK_MOVE_HARD_LIMIT = 500;

/**
 * Moves a task or story and its sub-tasks as one block by `days` (ADR-003, N-05). Each sub-task
 * moves by its state (src/domain/block-move.ts). All or nothing: every sub-task that will change is
 * checked for the user's Jira permissions and its record version before any write, and when Jira
 * refuses a sub-task's due date, the sub-tasks already moved are put back. Then the parent's Jira
 * due date follows the new roll-up end (DEC-6), and successors outside the block are cascaded.
 */
export async function moveTaskGroup(
  payload: { projectKey: string; projectId?: string; planId?: string; taskId: string; days: number; expectedVersions?: Record<string, number>; reconcileIds?: string[] },
  storageProvider?: StorageProvider
): Promise<any> {
  const { projectKey, projectId, taskId, days } = payload;
  assertIssueKey(taskId, 'taskId');
  if (!Number.isInteger(days) || days === 0 || Math.abs(days) > 3660) throw new ValidationError('days', 'days must be a whole number of days, not 0, at most 3660 either way');
  const expected = payload.expectedVersions;
  if (expected !== undefined && (typeof expected !== 'object' || expected === null || Array.isArray(expected) ||
      Object.keys(expected).length > 100 || Object.entries(expected).some(([k, v]) => !/^[A-Z][A-Z0-9_]+-\d+$/.test(k) || !Number.isInteger(v) || (v as number) < 0))) {
    throw new ValidationError('expectedVersions', 'expectedVersions must map issue keys to whole numbers of at least 0');
  }
  const storage = new BatchStorage(resolveStorage(storageProvider));
  const planId = await writablePlanId(storage, projectKey, projectId, payload.planId);
  const log = new SyncLog();
  const live = await loadLive(projectKey, reconcileIdsOf(payload.reconcileIds), await planFilterOf(storage, projectKey, projectId, planId));
  const plan = await getProjectPlan(projectKey, storage, new Date(), undefined, projectId, live, planId);
  const all = [...plan.tasks, ...(plan.backlogTasks || [])];
  const parent = all.find(t => t.key === taskId || t.id === taskId);
  if (!parent) throw new ValidationError('taskId', `${taskId} is not in project ${projectKey}`);
  // DEC-5b: epics keep "move a child instead" in v1.
  if (parent.isEpic || (parent.hierarchyLevel ?? 0) >= 1) throw new ValidationError('taskId', `${parent.key} is an epic. Move one of its work items instead.`);
  const members = all.filter(t => t.parentKey === parent.key);
  if (!parent.datesFromChildren || members.length === 0) throw new ValidationError('taskId', `${parent.key} has no dated sub-tasks. Move it directly.`);
  const { changes, fixed } = planBlockMove(members, days, todayIso());
  const block = { moved: changes, fixed };
  if (changes.length === 0) {
    return Object.assign(plan, { ok: true, jiraSync: log.report(), block, message: `Nothing in ${parent.key} can move: ${fixed.map(f => `${f.key} ${f.reason}`).join('; ')}.` });
  }
  if (changes.length > BLOCK_MOVE_HARD_LIMIT) {
    throw new ValidationError('taskId', `${parent.key} has ${changes.length} sub-tasks to move; at most ${BLOCK_MOVE_HARD_LIMIT} move as one block.`);
  }

  // All or nothing, before any write: permissions as the user, then every record version.
  const idByKey = new Map(all.map(t => [t.key, t.id]));
  const denied = await deniedIssues(changes.map(c => ({ key: c.key, id: idByKey.get(c.key) })), ['EDIT_ISSUES', 'SCHEDULE_ISSUES']);
  if (denied.length) {
    return forbiddenResult(`Nothing moved: you cannot change ${denied[0].key}, a sub-task of ${parent.key}: your Jira role lacks ${describeMissing(denied[0].missing)}.`);
  }
  const store = openStore(storage, projectKey, projectId, planId);
  const entries = await store.loadEntries();
  for (const c of changes) {
    const v = entries.get(c.key)?.version ?? 0;
    if (expected && expected[c.key] !== undefined && expected[c.key] !== v) return conflictResult(c.key);
  }
  const activeWeeks = plan.weeks || getDefaultWeeks();
  const written: Array<{ change: BlockChange; previous: Partial<WbsTask> | undefined; version: number }> = [];
  const putBack = async () => {
    for (const w of written.reverse()) {
      const { issueKey: _k, issueId: _i, version: _v, ...prev } = (w.previous || {}) as any;
      if (w.previous) await store.putEntry(w.change.key, idByKey.get(w.change.key), stripJiraOwnedFields(prev), w.version);
      else await store.deleteEntry(w.change.key);
    }
  };
  // Records of the first batch; a larger block continues in continueBlockMove calls.
  for (const c of changes.slice(0, BLOCK_MOVE_LIMIT)) {
    const cur = entries.get(c.key);
    const next = stripJiraOwnedFields({ ...(cur || {}), startDate: c.toStart, endDate: c.toEnd, ...gridFor(activeWeeks, c.toStart, c.toEnd) });
    const put = await store.putEntry(c.key, idByKey.get(c.key), next, cur?.version ?? 0);
    if (!put.ok) { await putBack(); return conflictResult(c.key); }
    written.push({ change: c, previous: cur, version: put.entry.version });
  }

  // Jira: each sub-task's due date and shared start, BLOCK_MOVE_LIMIT per call; a larger block continues
  // in later calls (continueBlockMove). A refusal in this first call puts every sub-task back.
  const synced: BlockChange[] = [];
  for (const c of changes.slice(0, BLOCK_MOVE_LIMIT)) {
    const before = all.find(t => t.key === c.key);
    const res: any = await syncTaskToJira(c.key, { startDate: c.toStart, endDate: c.toEnd }, log, before);
    applyAcceptedDueDate(live, c.key, { startDate: c.toStart, endDate: c.toEnd }, res);
    if (!(res.synced && res.fields.includes('duedate'))) {
      for (const s of synced) {
        applyAcceptedDueDate(live, s.key, { startDate: s.fromStart, endDate: s.fromEnd },
          await syncTaskToJira(s.key, { startDate: s.fromStart, endDate: s.fromEnd }, log, { startDate: s.toStart, endDate: s.toEnd, jiraDueDate: s.toEnd }));
      }
      await putBack();
      const reason = (res.reasons && res.reasons.duedate) || res.error || 'Jira did not save the due date';
      return Object.assign(await getProjectPlan(projectKey, storage, new Date(), undefined, projectId, live, planId), {
        ok: false, success: false, error: 'due_date_refused', jiraSync: log.report(), block,
        message: `${reason} for ${c.key}, so nothing in ${parent.key} moved.`
      });
    }
    synced.push(c);
  }
  if (changes.length > BLOCK_MOVE_LIMIT) {
    // The rest follow in continueBlockMove calls, each checked against the dates it moves from.
    const rest = changes.slice(BLOCK_MOVE_LIMIT).map(c => ({ key: c.key, fromStart: c.fromStart, fromEnd: c.fromEnd, toStart: c.toStart, toEnd: c.toEnd }));
    const out = Object.assign(await getProjectPlan(projectKey, storage, new Date(), undefined, projectId, live, planId),
      { ok: true, jiraSync: log.report(), block, blockRemaining: rest });
    return Object.assign(out, { writtenIssueIds: writtenIssueIds(log, out.tasks.concat(out.backlogTasks || [])) });
  }

  // DEC-6 and the cascade, from the parent and from each moved sub-task, outside the block.
  const moved = new Map(changes.map(c => [c.key, { startDate: c.toStart, endDate: c.toEnd }]));
  const blockKeys = new Set([parent.key, ...members.map(m => m.key)]);
  const candidate = withRollUps(all.map(t => (moved.has(t.key) ? { ...t, ...moved.get(t.key) } : t)));
  const roots = [parent.key, ...changes.map(c => c.key), ...ancestorKeys(parent.key, all)];
  const { cascadeRemaining, notMoved } = await cascadeAndApply({ candidate, all, roots, exclude: blockKeys, store, entries, idByKey, activeWeeks, log, live, moved });
  await followParentDueDates(all, moved, log, live);

  const result = { ok: true, jiraSync: log.report(), block, cascadeRemaining, cascadeSkipped: [...notMoved] };
  const out = Object.assign(await getProjectPlan(projectKey, storage, new Date(), undefined, projectId, live, planId), result);
  return Object.assign(out, { writtenIssueIds: writtenIssueIds(log, out.tasks.concat(out.backlogTasks || [])) });
}

/**
 * Continues a block move of more than BLOCK_MOVE_LIMIT sub-tasks (moveTaskGroup returns the rest in
 * `blockRemaining`). Each item moves only when the sub-task still has the dates it moves from; its record
 * and its Jira due date and start are written, and a refused due date leaves it as it was. With `last`,
 * the cascade from the block and DEC-6 for the parent follow.
 */
export async function continueBlockMove(
  payload: { projectKey: string; projectId?: string; planId?: string; taskId: string; items: Array<{ key: string; fromStart: string; fromEnd: string; toStart: string; toEnd: string }>; last?: boolean; reconcileIds?: string[] },
  storageProvider?: StorageProvider
): Promise<any> {
  const { projectKey, projectId, taskId } = payload;
  assertIssueKey(taskId, 'taskId');
  const items = payload.items;
  if (!Array.isArray(items) || items.length > BLOCK_MOVE_LIMIT) throw new ValidationError('items', `items must be a list of at most ${BLOCK_MOVE_LIMIT} sub-tasks`);
  for (const it of items) {
    if (!it || typeof it !== 'object') throw new ValidationError('items', 'each item must be an object');
    assertIssueKey(it.key, 'items.key');
    for (const f of ['fromStart', 'fromEnd', 'toStart', 'toEnd'] as const) if (!isIsoDate(it[f])) throw new ValidationError(`items.${f}`, `${f} must be a date in YYYY-MM-DD form`);
    if (it.toEnd < it.toStart) throw new ValidationError('items.toEnd', 'The end must be on or after the start.');
  }
  if (payload.last !== undefined && typeof payload.last !== 'boolean') throw new ValidationError('last', 'last must be true or false');
  const storage = new BatchStorage(resolveStorage(storageProvider));
  const planId = await writablePlanId(storage, projectKey, projectId, payload.planId);
  const log = new SyncLog();
  const live = await loadLive(projectKey, reconcileIdsOf(payload.reconcileIds), await planFilterOf(storage, projectKey, projectId, planId));
  const plan = await getProjectPlan(projectKey, storage, new Date(), undefined, projectId, live, planId);
  const all = [...plan.tasks, ...(plan.backlogTasks || [])];
  const parent = all.find(t => t.key === taskId);
  if (!parent) throw new ValidationError('taskId', `${taskId} is not in project ${projectKey}`);
  const members = all.filter(t => t.parentKey === parent.key);
  const strangers = items.filter(it => !members.some(m => m.key === it.key)).map(it => it.key);
  if (strangers.length) throw new ValidationError('items', `${strangers.join(', ')} ${strangers.length === 1 ? 'is not a sub-task' : 'are not sub-tasks'} of ${parent.key}`);
  const denied = new Map((await deniedIssues(items.map(it => ({ key: it.key, id: members.find(m => m.key === it.key)?.id })), ['EDIT_ISSUES', 'SCHEDULE_ISSUES'])).map(d => [d.key, d.missing]));
  const store = openStore(storage, projectKey, projectId, planId);
  const entries = await store.loadEntries();
  const activeWeeks = plan.weeks || getDefaultWeeks();
  const moved = new Map<string, { startDate?: string; endDate?: string }>();
  for (const it of items) {
    const shown = members.find(m => m.key === it.key)!;
    const missing = denied.get(it.key);
    if (missing) { log.record(it.key, ['plan'], { synced: false, error: `not moved: you lack ${describeMissing(missing)} on this issue in Jira` }); continue; }
    if (shown.startDate !== it.fromStart || shown.endDate !== it.fromEnd) {
      if (shown.startDate !== it.toStart || shown.endDate !== it.toEnd) log.record(it.key, ['plan'], { synced: false, error: 'not moved: someone else changed it; move the block again' });
      continue;
    }
    const cur = entries.get(it.key);
    const put = await store.putEntry(it.key, shown.id, stripJiraOwnedFields({ ...(cur || {}), startDate: it.toStart, endDate: it.toEnd, ...gridFor(activeWeeks, it.toStart, it.toEnd) }), cur?.version ?? 0);
    if (!put.ok) { log.record(it.key, ['plan'], { synced: false, error: 'not moved: someone else changed it; move the block again' }); continue; }
    const res: any = await syncTaskToJira(it.key, { startDate: it.toStart, endDate: it.toEnd }, log, shown);
    applyAcceptedDueDate(live, it.key, { startDate: it.toStart, endDate: it.toEnd }, res);
    if (res.synced && res.fields.includes('duedate')) { moved.set(it.key, { startDate: it.toStart, endDate: it.toEnd }); continue; }
    // Refused: this sub-task keeps its dates.
    const { issueKey: _k, issueId: _i, version, ...back } = put.entry as any;
    await store.putEntry(it.key, shown.id, stripJiraOwnedFields({ ...back, startDate: it.fromStart, endDate: it.fromEnd, ...gridFor(activeWeeks, it.fromStart, it.fromEnd) }), version);
  }
  let cascadeRemaining: string[] = [];
  let notMoved = new Set<string>();
  if (payload.last) {
    // The whole block is in Jira now: the cascade from it, then DEC-6 for the parent.
    const after = withRollUps(all.map(t => (moved.has(t.key) ? { ...t, ...moved.get(t.key) } : t)));
    const blockKeys = new Set([parent.key, ...members.map(m => m.key)]);
    const roots = [parent.key, ...members.map(m => m.key), ...ancestorKeys(parent.key, all)];
    ({ cascadeRemaining, notMoved } = await cascadeAndApply({ candidate: after, all, roots, exclude: blockKeys, store, entries,
      idByKey: new Map(all.map(t => [t.key, t.id])), activeWeeks, log, live, moved }));
    const rolled = after.find(t => t.key === parent.key);
    if (rolled && rolled.datesFromChildren && isIsoDate(rolled.endDate) && String(parent.jiraDueDate || '').slice(0, 10) !== rolled.endDate) {
      const d = await deniedIssues([{ key: parent.key, id: parent.id }], ['EDIT_ISSUES', 'SCHEDULE_ISSUES']);
      if (d.length) log.record(parent.key, ['duedate'], { synced: false, error: `not written: you lack ${describeMissing(d[0].missing)} on this parent in Jira` });
      else applyAcceptedDueDate(live, parent.key, { endDate: rolled.endDate }, await syncTaskToJira(parent.key, { endDate: rolled.endDate }, log, parent));
    }
  }
  const out = Object.assign(await getProjectPlan(projectKey, storage, new Date(), undefined, projectId, live, planId),
    { ok: true, jiraSync: log.report(), cascadeRemaining, cascadeSkipped: [...notMoved] });
  return Object.assign(out, { writtenIssueIds: writtenIssueIds(log, out.tasks.concat(out.backlogTasks || [])) });
}
