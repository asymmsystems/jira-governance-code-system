/*
 * Copyright (c) 2026 Asymm Systems. All rights reserved.
 *
 * @author Fahim Farook
 */

/**
 * CascadePlan server: Resolvers that change tasks: updates, cascades, scheduling, order, columns, milestones and utilization.
 * Split from src/index.ts without changes to any statement (F-31).
 */

import api, { route } from '@forge/api';
import { ProjectPlanState, WbsTask, WeeklySprintColumn, TaskDependency, ScheduleBacklogRequest, UnscheduleTaskRequest, ReorderTasksRequest, ProjectMilestone, ColumnWidthConfig, JiraSyncReport, JiraWriteRecord } from '../domain/models';
import { PlannerEngine } from '../domain/planner-engine';
import { describeJiraChanges } from '../domain/jira-change';
import { applyLinkUpdate, contributorsFromNames, rollUpParentDates } from '../domain/work-effort-links';
import { formatSubtaskSummary } from '../ui/second-person';
import { evaluateEffort, cascade, addDays } from '../domain/schedule-engine';
import { StorageProvider } from '../storage/plan-repository';
import { PlanStore, StoredEntry, sequenceBetween } from '../storage/plan-store';
import { BatchStorage } from '../storage/batch-storage';
import { planBlockMove } from '../domain/block-move';
import { logFailure } from '../logger';
import { IssuePermission, deniedIssues, describeMissing, forbiddenResult, requireIssuePermissions } from '../security/write-permissions';
import { ValidationError, assertIssueKey, validateTaskUpdates, validateDependencyPayload, validateColumnWidths, validateHiddenColumns, validateMilestone, validateSchedulePayload, reconcileIdsOf } from '../validation';
import { ResourceUtilizationEngine, ResourceUtilizationView } from '../domain/resource-utilization';
import { DATES_PROPERTY, DEFAULT_MILESTONES, SHARED_DATE_FIELDS, SyncLog, addDaysIso, conflictResult, engineInputs, evenAllocations, getDefaultWeeks, getJiraCaller, gridFor, isIsoDate, isMainPlan, noJiraWrites, openStore, resolveStorage, sequenceForIndex, stripJiraOwnedFields, todayIso, verifyIssueInProject, weekIndexContaining, writablePlanId } from './core';
import { LiveData, currentJiraDueDate, loadLive, readJiraDueDate } from './jira-read';
import { applyAcceptedDueDate, applyPlannedJiraWrites, createIdOf, mirrorDependencyToJira, removeMirroredLink, syncTaskToJira } from './jira-write';
import { getProjectPlan, migrateIfNeeded, planFilterOf } from './plan-read';

/**
 * Schedules an issue from the backlog shelf directly onto the timeline grid.
 */
export async function scheduleBacklogTask(
  request: ScheduleBacklogRequest,
  storageProvider?: StorageProvider
): Promise<ProjectPlanState> {
  const weeksNow = getDefaultWeeks(); // computed per call (B-18)
  validateSchedulePayload(request as unknown as Record<string, unknown>);
  const { projectKey, projectId, taskId, startWeek, startDate, spanWeeks = 3, effortHours, resource, targetIndex } = request;
  if (startDate !== undefined && !isIsoDate(startDate)) throw new ValidationError('startDate', 'startDate must be a date in YYYY-MM-DD form');
  if (request.endDate !== undefined && !isIsoDate(request.endDate)) throw new ValidationError('endDate', 'endDate must be a date in YYYY-MM-DD form');
  const issueId = await verifyIssueInProject(taskId, projectKey, 'taskId');
  await requireIssuePermissions([{ key: taskId, id: issueId }], request.endDate ? ['EDIT_ISSUES', 'SCHEDULE_ISSUES'] : ['EDIT_ISSUES']);
  // INV-03 (F-06): the default span is planner data only. The bar ends on the Jira due date when the
  // issue has one, and a due date is written to Jira only when the user chose an end.
  const jiraDue = request.endDate ? undefined : await readJiraDueDate(taskId);
  const storage = resolveStorage(storageProvider);
  const planId = await writablePlanId(storage, projectKey, projectId, request.planId);
  const store = openStore(storage, projectKey, projectId, planId);
  if (isMainPlan(planId)) await migrateIfNeeded(store, projectKey);
  const entries = await store.loadEntries();

  const startIdx = Math.max(0, weeksNow.findIndex(w => w.weekKey === startWeek));
  const endIdx = Math.min(weeksNow.length - 1, startIdx + spanWeeks - 1);
  const endWeek = weeksNow[endIdx].weekKey;

  const allocations: Record<string, number> = {};
  for (let i = startIdx; i <= endIdx; i++) {
    allocations[weeksNow[i].weekKey] = Math.round(100 / spanWeeks);
  }

  const current = entries.get(taskId);
  // Estimate and assignee are Jira-owned: an entered estimate goes to Jira, never to KVS (INV-04).
  const entry = stripJiraOwnedFields({
    ...(current || {}),
    startWeek,
    endWeek,
    spanWeeks,
    startDate: weeksNow[startIdx].startDate,
    endDate: weeksNow[endIdx].endDate,
    weeklyAllocations: allocations,
    sequenceNum: sequenceForIndex(entries, taskId, targetIndex),
    // An exact day (B-27): the drop date and whole weeks from it, anywhere on the timeline.
    ...(startDate ? { startDate, endDate: addDays(startDate, spanWeeks * 7 - 1), ...gridFor(weeksNow, startDate, addDays(startDate, spanWeeks * 7 - 1)) } : {})
  });
  const chosenEnd = request.endDate || jiraDue;
  if (chosenEnd) {
    const start = entry.startDate as string;
    if (chosenEnd < start) {
      throw new ValidationError(request.endDate ? 'endDate' : 'startDate', request.endDate
        ? 'The end must be on or after the start.'
        : `${taskId} is due on ${chosenEnd} in Jira, before ${start}. Drop it on or before ${chosenEnd}, or change its due date first.`);
    }
    Object.assign(entry, { endDate: chosenEnd }, gridFor(weeksNow, start, chosenEnd));
  }
  void resource;
  const put = await store.putEntry(taskId, issueId, entry, current ? current.version : 0);
  if (!put.ok) return conflictResult(taskId);

  // The dates are the same in every plan: the start (and the planner's end) is the issue property
  // (ADR-008); the due date only when the user chose an end (F-06), and the effort, go to Jira fields.
  const log = new SyncLog();
  const jiraUpdates: Partial<WbsTask> = { startDate: put.entry.startDate as string };
  if (request.endDate) jiraUpdates.endDate = request.endDate;
  if (typeof effortHours === 'number') jiraUpdates.effortHours = effortHours;
  await syncTaskToJira(taskId, jiraUpdates, log, {}, { propertyEnd: put.entry.endDate as string });

  return Object.assign(await getProjectPlan(projectKey, storage, new Date(), undefined, projectId, undefined, planId), { ok: true, jiraSync: log.report() });
}

/**
 * Updates a task schedule, dates, effort, progress, or resource.
 */
export async function updateWbsTask(
  payload: { projectKey: string; projectId?: string; planId?: string; taskId: string; updates: Partial<WbsTask>; expectedVersion?: number; reconcileIds?: string[]; restore?: boolean; expectedDueDate?: string | null },
  storageProvider?: StorageProvider,
  preloaded?: LiveData,
  options?: { skipResponse?: boolean }
): Promise<ProjectPlanState> {
  const { projectKey, projectId, taskId, updates, expectedVersion } = payload;
  validateTaskUpdates(updates as Record<string, unknown>);
  // Undo and Redo send restore: they write the exact dates of every task the action changed, so no
  // new cascade runs; a cascade would move again a successor whose old dates broke a link (B-14).
  if (payload.restore !== undefined && typeof payload.restore !== 'boolean') throw new ValidationError('restore', 'restore must be true or false');
  const restoring = payload.restore === true;
  if (expectedVersion !== undefined && (!Number.isInteger(expectedVersion) || expectedVersion < 0)) {
    throw new ValidationError('expectedVersion', 'expectedVersion must be a whole number of at least 0');
  }
  const storage = resolveStorage(storageProvider);
  const log = new SyncLog();
  const planId = await writablePlanId(storage, projectKey, projectId, payload.planId);

  // Jira is read once per update (or once per batch); the returned plan reuses the same read (B-10, B-16).
  const live = preloaded || await loadLive(projectKey, reconcileIdsOf(payload.reconcileIds), await planFilterOf(storage, projectKey, projectId, planId));
  const plan = await getProjectPlan(projectKey, storage, new Date(), undefined, projectId, live, planId);
  const targetTask = plan.tasks.find(t => t.id === taskId || t.key === taskId) ||
    (plan.backlogTasks || []).find(t => t.id === taskId || t.key === taskId);
  if (!targetTask) {
    throw new Error(`Task '${taskId}' not found in project plan`);
  }
  const store = openStore(storage, projectKey, projectId, planId);
  const entries = await store.loadEntries();
  const baseVersion = entries.get(targetTask.key)?.version ?? 0;
  if (expectedVersion !== undefined && expectedVersion !== baseVersion) {
    // The user edited an older copy: refuse before any Jira write (INV-08).
    return conflictResult(targetTask.key);
  }
  // C3: a date change carries the Jira due date the user saw. When someone changed it in Jira since,
  // the move is refused before any write. The check reads with reconcileIssues for this issue,
  // because the plain search can still show the old value.
  if (payload.expectedDueDate !== undefined && (updates.startDate !== undefined || updates.endDate !== undefined)) {
    if (payload.expectedDueDate !== null && !isIsoDate(payload.expectedDueDate)) throw new ValidationError('expectedDueDate', 'expectedDueDate must be a date in YYYY-MM-DD form, or null');
    const now = await currentJiraDueDate(targetTask.key, targetTask.id);
    if (now !== undefined && now !== (payload.expectedDueDate ? String(payload.expectedDueDate).slice(0, 10) : null)) {
      return { ...conflictResult(targetTask.key), error: 'due_date_changed',
        message: `${targetTask.key}'s due date was changed in Jira a moment ago (now ${now || 'none'}). Reload to see it, then move it again.` };
    }
  }
  // A sub-task's epic comes from its parent; an epic write would change its parent instead (N-07).
  if ((targetTask.isSubtask || targetTask.hierarchyLevel === -1) && (updates as Record<string, unknown>).epicKey !== undefined) {
    throw new ValidationError('epicKey', `${targetTask.key} is a sub-task; its epic comes from its parent work item.`);
  }
  // A parent whose dates come from its sub-tasks is not moved directly (N-06 rule 3, ADR-003).
  if (targetTask.datesFromChildren && ['startDate', 'endDate', 'startWeek', 'spanWeeks', 'endWeek'].some(f => (updates as Record<string, unknown>)[f] !== undefined)) {
    throw new ValidationError('startDate', `${targetTask.key} takes its dates from its sub-tasks. Move its sub-tasks instead.`);
  }
  // BL-2, INV-16: the user's own Jira permissions on the target, before any KVS or Jira write.
  const needed: IssuePermission[] = ['EDIT_ISSUES'];
  const u = updates as Record<string, unknown>;
  if (['startDate', 'endDate', 'startWeek', 'spanWeeks', 'endWeek'].some(f => u[f] !== undefined)) needed.push('SCHEDULE_ISSUES');
  if (u.dependency !== undefined || u.dependencies !== undefined || u.removeDependency !== undefined) needed.push('LINK_ISSUES');
  const deniedTarget = await deniedIssues([{ key: targetTask.key, id: targetTask.id }], needed);
  if (deniedTarget.length) {
    return forbiddenResult(`You cannot change ${targetTask.key}: your Jira role lacks ${describeMissing(deniedTarget[0].missing)}.`);
  }
  const idByKey = new Map([...plan.tasks, ...(plan.backlogTasks || [])].map(t => [t.key, t.id]));
  const planKeys = new Set([...plan.tasks, ...(plan.backlogTasks || [])].map(t => t.key));
  if (updates.dependency && updates.dependency.predecessorKey && !planKeys.has(updates.dependency.predecessorKey)) {
    throw new ValidationError('dependency.predecessorKey', `${updates.dependency.predecessorKey} is not in project ${projectKey}`);
  }

  const ALLOWED_KEYS = [
    'summary', 'epic', 'epicKey', 'story', 'effortHours', 'effortConfig', 'resource',
    'resourceAccountId', 'contributingResources', 'progress', 'targetProgress', 'manualProgress',
    'manualTargetProgress', 'status', 'startDate',
    'endDate', 'startWeek', 'endWeek', 'spanWeeks', 'weeklyAllocations', 'subtasks',
    'dependency', 'contributors', 'removeSubtaskAction'
  ];
  const sanitized: Partial<WbsTask> = {};
  for (const k of ALLOWED_KEYS) {
    if ((updates as any)[k] !== undefined) {
      (sanitized as any)[k] = (updates as any)[k];
    }
  }

  // Progress and Target Progress handling & Status auto-transition
  if (sanitized.progress !== undefined) {
    const rawP = Number(sanitized.progress);
    sanitized.progress = isNaN(rawP) ? 0 : Math.max(0, Math.min(100, Math.round(rawP)));
    // A progress the user sets by hand is stored as manual; "Use rollup" sends manualProgress false.
    if (sanitized.manualProgress === undefined) {
      sanitized.manualProgress = true;
    }
    // Progress never changes the Jira status: only a status the user chose is sent (F-06, INV-03).
  }
  if (sanitized.targetProgress !== undefined) {
    const rawT = Number(sanitized.targetProgress);
    sanitized.targetProgress = isNaN(rawT) ? 0 : Math.max(0, Math.min(100, Math.round(rawT)));
    if (sanitized.manualTargetProgress === undefined) {
      sanitized.manualTargetProgress = true;
    }
  }
  if (sanitized.manualTargetProgress === false) {
    const s = sanitized.startDate || targetTask.startDate;
    const e = sanitized.endDate || targetTask.endDate;
    sanitized.targetProgress = PlannerEngine.calculateTargetProgress(s, e);
  }

  // Fractional progress-threshold dependency validation and Jira link mirroring
  // Links are time-bound WORK_EFF_PRECEDENCY associations: a new link replaces the active set and the
  // others end; only the Jira links CascadePlan created are removed from Jira (B-28, NF-02).
  // Jira writes this update needs, made only after the target record is saved (F-07).
  const jiraPlan: {
    link?: { predecessorKey: string };
    removeLinkIds: string[];
    /** The trigger percents to set on this successor's cascadeplan.links property, and to remove (ADR-006). */
    percents: Record<string, number>;
    removePercentIds: string[];
    newSubtasks: Array<{ accountId: string; summary: string }>;
    subtaskAction?: { subtaskKey: string; action: 'delete' | 'unassign' | 'keep' };
  } = { removeLinkIds: [], newSubtasks: [], percents: {}, removePercentIds: [] };
  // Dependencies are Jira "Blocks" links, the same in every plan; the trigger percent is the issue
  // property cascadeplan.links of the successor (ADR-006, N-11). A dependency adds or updates one link
  // and keeps the others; removeDependency removes exactly one, whoever created it in Jira (L3);
  // dependency null removes every link. The plan record keeps no links (L5).
  let activeAfter: TaskDependency[] | undefined;
  const removeKey = (updates as any).removeDependency?.predecessorKey as string | undefined;
  if (sanitized.dependency !== undefined || removeKey) {
    const update = sanitized.dependency && sanitized.dependency.predecessorKey ? sanitized.dependency : null;
    if (update) {
      const validation = PlannerEngine.validateDependency(targetTask.key, update.predecessorKey, update.triggerPercent, plan.tasks);
      if (!validation.valid) {
        throw new Error(validation.error);
      }
    }
    const currentEntry = entries.get(targetTask.key);
    const activeNow = targetTask.dependencies || [];
    const storedNow: TaskDependency[] = currentEntry?.dependencies || (currentEntry?.dependency ? [currentEntry.dependency] : []);
    let removing: TaskDependency[] = [];
    if (removeKey) {
      const d = activeNow.find(x => x.predecessorKey === removeKey);
      if (!d) throw new ValidationError('removeDependency', `${targetTask.key} has no dependency on ${removeKey}`);
      removing = [d];
    } else if (!update && sanitized.dependency !== undefined) {
      removing = activeNow;
    }
    const idOf = (key: string) => idByKey.get(key) || key;
    if (update) {
      // The Jira link is created only after the record is saved under its version check (F-07).
      if (!activeNow.some(d => d.predecessorKey === update.predecessorKey && !d.planOnly)) jiraPlan.link = { predecessorKey: update.predecessorKey };
      jiraPlan.percents[idOf(update.predecessorKey)] = update.triggerPercent;
    }
    jiraPlan.removeLinkIds = removing.filter(d => !d.planOnly && d.jiraLinkId).map(d => d.jiraLinkId as string);
    jiraPlan.removePercentIds = removing.filter(d => !d.planOnly).map(d => idOf(d.predecessorKey));
    const touched = new Set([...(update ? [update.predecessorKey] : []), ...removing.map(d => d.predecessorKey)]);
    activeAfter = activeNow.filter(d => !touched.has(d.predecessorKey));
    if (update) activeAfter.unshift({ predecessorId: idOf(update.predecessorKey), predecessorKey: update.predecessorKey, triggerPercent: update.triggerPercent, isTriggerSatisfied: false });
    // A plan-only link the user touched leaves the record (created in Jira, or dropped).
    const keptStored = storedNow.filter(d => d && !touched.has(d.predecessorKey));
    sanitized.dependencies = keptStored;
    sanitized.dependency = keptStored[0] || null;
    // Ended links are history only (B-28); they never hide a Jira link (L3).
    const applied = applyLinkUpdate(removing, currentEntry?.endedLinks || [], undefined, todayIso());
    sanitized.endedLinks = [...applied.endedLinks.filter(e => !touched.has(e.predecessorKey)),
      ...removing.map(d => ({ predecessorKey: d.predecessorKey, triggerPercent: d.triggerPercent, until: todayIso(), ...(d.since ? { since: d.since } : {}) }))];
  }
  // The dependencies the engine sees for the target after this update.
  const depView = activeAfter ? { dependencies: activeAfter, dependency: activeAfter[0] || null } : {};
  // Second people: by account id from the picker, or names matched to exactly one Jira user (B-28).
  if ((updates as any).contributors !== undefined) {
    const prev = entries.get(targetTask.key)?.contributors || [];
    const nextContributors: any[] = [];
    for (const c of (updates as any).contributors as Array<{ accountId: string; subtaskKey?: string }>) {
      const prevMatch = prev.find(p => p.accountId === c.accountId);
      let subtaskKey = c.subtaskKey || prevMatch?.subtaskKey;
      if (!subtaskKey) {
        // Criterion 1: adding a second person creates a Jira sub-task assigned to that person,
        // after the record is saved (F-07); until then the person has no sub-task key.
        const userObj = live.users.find(u => u.accountId === c.accountId);
        const displayName = userObj ? userObj.displayName : c.accountId;
        jiraPlan.newSubtasks.push({ accountId: c.accountId, summary: formatSubtaskSummary(targetTask.summary, displayName) });
      }
      nextContributors.push({
        accountId: c.accountId,
        since: prevMatch?.since || todayIso(),
        ...(subtaskKey ? { subtaskKey } : {})
      });
    }
    sanitized.contributors = nextContributors;
  } else if (sanitized.contributingResources !== undefined) {
    sanitized.contributors = contributorsFromNames(sanitized.contributingResources || [], live.users, entries.get(targetTask.key)?.contributors || [], todayIso());
  }

  if ((updates as any).removeSubtaskAction) {
    const { subtaskKey, action } = (updates as any).removeSubtaskAction as { subtaskKey: string; action: 'delete' | 'unassign' | 'keep' };
    if (subtaskKey && action) jiraPlan.subtaskAction = { subtaskKey, action };
  }

  // Derive schedule dates and weeks dynamically
  const activeWeeks = plan.weeks || getDefaultWeeks();

  const userPickedDates = sanitized.startDate !== undefined || sanitized.endDate !== undefined;
  if (userPickedDates) {
    // Dates the user picked are kept exactly; the week grid position is derived from them (CP-07).
    const s = sanitized.startDate || targetTask.startDate;
    const e = sanitized.endDate || targetTask.endDate;
    // Also when only one end is sent, the end stays on or after the start (F-18).
    if (isIsoDate(s) && isIsoDate(e) && e < s) throw new ValidationError('endDate', 'The end must be on or after the start.');
    sanitized.startDate = s;
    sanitized.endDate = e;
    const sIdx = weekIndexContaining(activeWeeks, s);
    const eIdx = weekIndexContaining(activeWeeks, e);
    if (sIdx !== -1) sanitized.startWeek = activeWeeks[sIdx].weekKey;
    if (sIdx !== -1 && eIdx !== -1 && eIdx >= sIdx) {
      sanitized.endWeek = activeWeeks[eIdx].weekKey;
      sanitized.spanWeeks = eIdx - sIdx + 1;
    }
    if (!sanitized.weeklyAllocations && sanitized.startWeek && sanitized.spanWeeks) {
      sanitized.weeklyAllocations = evenAllocations(activeWeeks, sIdx, sanitized.spanWeeks);
    }
  } else if (sanitized.startWeek || sanitized.spanWeeks) {
    // The old week is the week of the start date itself (ADR-008: the date is the truth, the week is derived).
    const hasDates = isIsoDate(targetTask.startDate) && isIsoDate(targetTask.endDate);
    const oldIdx = hasDates ? weekIndexContaining(activeWeeks, targetTask.startDate as string) : -1;
    const oldSpan = targetTask.spanWeeks || 3;
    const sWk = sanitized.startWeek || targetTask.startWeek || activeWeeks[0].weekKey;
    const span = sanitized.spanWeeks || oldSpan;
    const sIdx = Math.max(0, activeWeeks.findIndex(w => w.weekKey === sWk));
    const eIdx = Math.min(activeWeeks.length - 1, sIdx + span - 1);

    sanitized.startWeek = activeWeeks[sIdx].weekKey;
    sanitized.endWeek = activeWeeks[eIdx].weekKey;
    sanitized.spanWeeks = span;
    if (oldIdx !== -1) {
      // A move or resize by whole weeks keeps the exact days of the bar.
      const shiftStart = (sIdx - oldIdx) * 7;
      sanitized.startDate = addDaysIso(targetTask.startDate as string, shiftStart);
      sanitized.endDate = addDaysIso(targetTask.endDate as string, shiftStart + (span - oldSpan) * 7);
    } else if (hasDates && !(updates as any).spanWeeks) {
      // A start outside the visible weeks has no week to shift from: the bar starts in the chosen week
      // and keeps its length in days. (A span given in weeks uses the week boundaries, below.)
      const days = Math.max(0, Math.round((Date.parse(`${targetTask.endDate}T00:00:00Z`) - Date.parse(`${targetTask.startDate}T00:00:00Z`)) / 86400000));
      sanitized.startDate = activeWeeks[sIdx].startDate;
      sanitized.endDate = addDaysIso(activeWeeks[sIdx].startDate, days + (span - oldSpan) * 7);
    } else {
      sanitized.startDate = activeWeeks[sIdx].startDate;
      sanitized.endDate = activeWeeks[eIdx].endDate;
    }
    if (!sanitized.weeklyAllocations) {
      sanitized.weeklyAllocations = evenAllocations(activeWeeks, sIdx, span);
    }
  }

  // A new or changed dependency moves the task to its earliest start, keeping its duration (B-11).
  if (!restoring && activeAfter && sanitized.dependency !== undefined && (updates as any).dependency && (updates as any).dependency.predecessorKey) {
    const start = sanitized.startDate || targetTask.startDate;
    const end = sanitized.endDate || targetTask.endDate;
    const candidate = plan.tasks.map(t => (t.key === targetTask.key ? { ...t, startDate: start, endDate: end, ...depView } : t));
    const inputs = engineInputs(candidate);
    const ev = evaluateEffort(targetTask.key, inputs.efforts, inputs.links, todayIso());
    if (ev.earliestStartDate && isIsoDate(start) && start < ev.earliestStartDate) {
      const days = isIsoDate(end) ? Math.max(0, Math.round((Date.parse(`${end}T00:00:00Z`) - Date.parse(`${start}T00:00:00Z`)) / 86400000)) : 0;
      sanitized.startDate = ev.earliestStartDate;
      sanitized.endDate = addDays(ev.earliestStartDate, days);
      Object.assign(sanitized, gridFor(activeWeeks, sanitized.startDate, sanitized.endDate));
    }
  }

  // Recalculate targetProgress if auto-target is active and dates were modified
  if (!targetTask.manualTargetProgress && sanitized.manualTargetProgress !== true && sanitized.targetProgress === undefined && (sanitized.startDate !== undefined || sanitized.endDate !== undefined)) {
    const s = sanitized.startDate || targetTask.startDate;
    const e = sanitized.endDate || targetTask.endDate;
    sanitized.targetProgress = PlannerEngine.calculateTargetProgress(s, e);
  }

  const scheduleMap: Record<string, Partial<WbsTask>> = Object.fromEntries(entries);
  const current = scheduleMap[targetTask.key] || {};
  const changedKeys = new Set<string>([targetTask.key]);
  const pendingSyncs: Array<{ key: string; updates: Partial<WbsTask> }> = [];

  // Links, ended links and second people not in this update stay as stored (merged below); links
  // imported from Jira stay live and are not copied into KVS.

  // Preserve existing manualProgress if updates didn't explicitly modify or clear it
  if (sanitized.manualProgress === undefined && (current.manualProgress !== undefined || targetTask.manualProgress !== undefined)) {
    sanitized.manualProgress = current.manualProgress !== undefined ? current.manualProgress : targetTask.manualProgress;
  }
  // Preserve existing manualTargetProgress if updates didn't explicitly modify or clear it
  if (sanitized.manualTargetProgress === undefined && (current.manualTargetProgress !== undefined || targetTask.manualTargetProgress !== undefined)) {
    sanitized.manualTargetProgress = current.manualTargetProgress !== undefined ? current.manualTargetProgress : targetTask.manualTargetProgress;
  }

  scheduleMap[targetTask.key] = stripJiraOwnedFields({
    ...current,
    ...sanitized
  });

  // Cascade date shifts to conflicting successors, at most CASCADE_BATCH_LIMIT per call (B-10, B-11).
  let cascadeRemaining: string[] = [];
  if (!restoring && (sanitized.startDate || sanitized.endDate || activeAfter)) {
    // The parents' roll-ups are recomputed with the new dates before the cascade (N-06 rule 1).
    const candidateTasks = withRollUps(plan.tasks.map(t => (t.key === targetTask.key ? { ...t, ...sanitized, ...depView } : t)));
    const inputs = engineInputs(candidateTasks);
    const first = cascade(inputs.efforts, inputs.links, targetTask.key, todayIso());
    reportCycle(first.cycle, log);
    const changes = [...first.changes];
    let efforts = first.efforts;
    // Every ancestor whose roll-up changed also cascades to its own successors. (The parent's own Jira
    // due date follows only when the drag preview lists it, INV-03; DEC-6 is not built yet.)
    for (const anc of ancestorKeys(targetTask.key, plan.tasks)) {
      const was = plan.tasks.find(t => t.key === anc);
      const now = candidateTasks.find(t => t.key === anc);
      if (!was || !now || !now.datesFromChildren || (was.startDate === now.startDate && was.endDate === now.endDate)) continue;
      const more = cascade(efforts, inputs.links, anc, todayIso());
      reportCycle(more.cycle, log);
      for (const c of more.changes) if (!changes.some(x => x.key === c.key)) changes.push(c);
      efforts = more.efforts;
    }
    // A cascade into a task or story parent moves its block (N-06 rule 2).
    const expanded = expandParentCascades(changes, [...plan.tasks, ...(plan.backlogTasks || [])], todayIso(), new Set([targetTask.key]));
    reportEpicsNotMoved(expanded.epics, log);
    cascadeRemaining = expanded.changes.slice(CASCADE_BATCH_LIMIT).map(c => c.key);
    for (const c of expanded.changes.slice(0, CASCADE_BATCH_LIMIT)) {
      scheduleMap[c.key] = { ...(scheduleMap[c.key] || {}), startDate: c.toStart, endDate: c.toEnd, ...gridFor(activeWeeks, c.toStart, c.toEnd) };
      changedKeys.add(c.key);
      pendingSyncs.push({ key: c.key, updates: { startDate: c.toStart, endDate: c.toEnd } });
    }
  }

  // A parent's dates follow its children on every load (B-28); nothing is stored for the parent.

  // A cascaded successor the user may not edit and schedule is not moved, and is reported (BL-2).
  const notMoved = new Set<string>();
  const successors = [...changedKeys].filter(k => k !== targetTask.key).map(k => ({ key: k, id: idByKey.get(k) }));
  for (const d of await deniedIssues(successors, ['EDIT_ISSUES', 'SCHEDULE_ISSUES'])) {
    notMoved.add(d.key);
    changedKeys.delete(d.key);
    log.record(d.key, ['plan'], { synced: false, error: `not moved: you lack ${describeMissing(d.missing)} on this issue in Jira` });
  }

  // KVS first, with a version check per record; Jira only after the target record is saved.
  let targetPut = await store.putEntry(targetTask.key, targetTask.id, stripJiraOwnedFields(scheduleMap[targetTask.key]), baseVersion);
  if (!targetPut.ok) return conflictResult(targetTask.key);
  const saved = await applyPlannedJiraWrites(store, projectKey, targetTask, targetPut.entry as any, entries.get(targetTask.key), jiraPlan, log, live, createIdOf((payload as any).createId));
  if (!saved.ok) return saved.result;
  targetPut = { ok: true, entry: saved.entry } as any;

  // The target's fields go to Jira first. Dates are shared and successors move only when Jira accepted
  // the due date; when it did not, the target keeps its old dates and nothing else moves (F-19, C6).
  const targetSync: any = await syncTaskToJira(targetTask.key, sanitized, log, targetTask);
  applyAcceptedDueDate(live, targetTask.key, sanitized, targetSync);
  if (typeof sanitized.endDate === 'string' && !(targetSync.synced && targetSync.fields.includes('duedate'))) {
    const prev: Record<string, unknown> = (entries.get(targetTask.key) || {}) as any;
    const { issueKey: _k, issueId: _i, version, ...cur } = targetPut.entry as any;
    const restored: Record<string, unknown> = { ...cur };
    for (const f of SHARED_DATE_FIELDS) {
      if (prev[f] === undefined) delete restored[f]; else restored[f] = prev[f];
    }
    if (!restored.startWeek) restored.isBacklog = true; else delete restored.isBacklog;
    const back = await store.putEntry(targetTask.key, targetTask.id, stripJiraOwnedFields(restored as Partial<WbsTask>), version);
    const reason = (targetSync.reasons && targetSync.reasons.duedate) || targetSync.error || 'Jira did not save the due date';
    return Object.assign(await getProjectPlan(projectKey, storage, new Date(), undefined, projectId, live, planId), {
      ok: false, success: false, error: 'due_date_refused', jiraSync: log.report(),
      message: back.ok
        ? `${reason}, so ${targetTask.key} keeps its dates and nothing else moved.`
        : `${reason}. Someone else changed ${targetTask.key} since; reload to see the latest plan.`
    });
  }
  for (const key of changedKeys) {
    if (key === targetTask.key) continue;
    const put = await store.putEntry(key, idByKey.get(key), stripJiraOwnedFields(scheduleMap[key]), entries.get(key)?.version ?? 0);
    if (!put.ok) { notMoved.add(key); log.record(key, ['plan'], { synced: false, error: 'not moved: someone else changed it; move the task again' }); }
  }
  // Jira is the single truth for a task: every changed field, the due date and the shared start
  // property included (ADR-008), goes to Jira from whichever plan the change was made in.
  for (const s of pendingSyncs) {
    if (notMoved.has(s.key)) continue;
    applyAcceptedDueDate(live, s.key, s.updates, await syncTaskToJira(s.key, s.updates, log, plan.tasks.find(t => t.key === s.key)));
  }
  // DEC-6: a parent whose roll-up end changed gets that end as its Jira due date.
  const movedDates = new Map<string, { startDate?: string; endDate?: string }>();
  if (sanitized.startDate || sanitized.endDate) movedDates.set(targetTask.key, { startDate: sanitized.startDate || targetTask.startDate, endDate: sanitized.endDate || targetTask.endDate });
  for (const s of pendingSyncs) if (!notMoved.has(s.key)) movedDates.set(s.key, { startDate: s.updates.startDate, endDate: s.updates.endDate });
  await followParentDueDates([...plan.tasks, ...(plan.backlogTasks || [])], movedDates, log, live);

  const result = { ok: true, jiraSync: log.report(), cascadeRemaining, cascadeSkipped: [...notMoved], writtenIssueIds: writtenIssueIds(log, plan.tasks) };
  // A batch builds one plan at the end, so its items skip building their own (F-17).
  if (options?.skipResponse) return result as any;
  return Object.assign(await getProjectPlan(projectKey, storage, new Date(), undefined, projectId, live, planId), result);
}

/**
 * Deletes every CascadePlan record of one issue, in the Main Plan and in every scenario plan (BL-9).
 * Called only for Jira's issue-deleted event. Records are matched by the issue id and by the issue
 * key, because older records can be stored under the key (FX-05). Both the project id and the
 * project key prefixes are checked. Running it twice for the same issue changes nothing.
 */
export async function deleteIssueRecords(
  storage: StorageProvider,
  target: { projectKey?: string; projectId?: string; issueKey?: string; issueId?: string }
): Promise<{ deleted: string[] }> {
  const deleted: string[] = [];
  const projectKey = target.projectKey;
  const scopes = new Set<string>([target.projectId, projectKey].filter((s): s is string => !!s));
  for (const scope of scopes) {
    const main = new PlanStore(storage, scope, projectKey || scope);
    const planIds: Array<string | undefined> = [undefined, ...(await main.listPlans()).map(p => p.id).filter(id => id && id !== 'default')];
    for (const planId of planIds) {
      const store = new PlanStore(storage, scope, projectKey || scope, planId);
      for (const [key, entry] of await store.loadEntries()) {
        const matches = (target.issueKey && key === target.issueKey)
          || (target.issueId && (entry.issueId === target.issueId || key === target.issueId));
        if (!matches) continue;
        await store.deleteEntry(key);
        deleted.push(`${scope}:${planId || 'default'}:${key}`);
      }
    }
  }
  return { deleted };
}

/**
 * Forge trigger for avi:jira:deleted:issue (BL-9). Runs as the app; it never calls Jira, so no
 * user's permissions can cause a delete. Logs one line per run, without names or summaries.
 */
export async function issueDeleted(event: any, storageProvider?: StorageProvider): Promise<{ deleted: string[] }> {
  const issue = event?.issue || {};
  const target = {
    issueId: issue.id !== undefined ? String(issue.id) : undefined,
    issueKey: typeof issue.key === 'string' ? issue.key : undefined,
    projectId: issue.fields?.project?.id !== undefined ? String(issue.fields.project.id) : undefined,
    projectKey: typeof issue.fields?.project?.key === 'string' ? issue.fields.project.key
      : (typeof issue.key === 'string' ? issue.key.replace(/-\d+$/, '') : undefined)
  };
  if (!target.issueId && !target.issueKey) return { deleted: [] };
  const res = await deleteIssueRecords(resolveStorage(storageProvider), target);
  // eslint-disable-next-line no-console
  console.log(`issue-deleted ${target.issueKey || target.issueId} (project id ${target.projectId ? 'present' : 'missing'}): ${res.deleted.length} record(s) deleted`);
  return res;
}

/**
 * Applies several task updates in one call (B-16 standup flow), with one Jira read. Each item runs
 * like updateWbsTask, including its cascade. When an item's version was changed by an earlier item of
 * the same batch (a cascade), it is retried once with the current version; a version changed by
 * anyone else is reported as a conflict and the other items still apply.
 */
export async function batchUpdateTasks(
  payload: { projectKey: string; projectId?: string; planId?: string; items: Array<{ taskId: string; updates: Partial<WbsTask>; expectedVersion?: number }>; reconcileIds?: string[] },
  storageProvider?: StorageProvider
): Promise<ProjectPlanState & { results: Array<{ taskId: string; ok: boolean; conflict?: boolean }> }> {
  const { projectKey, projectId, items } = payload;
  if (!Array.isArray(items) || items.length === 0 || items.length > 50) throw new ValidationError('items', 'items must be a list of 1 to 50 updates');
  for (const item of items) {
    assertIssueKey(item.taskId, 'taskId');
    validateTaskUpdates(item.updates as Record<string, unknown>);
  }
  // One read of each KVS key and prefix for the whole batch (F-17): later items read the batch's own
  // writes from memory. The version check still reaches KVS on every write.
  const storage = new BatchStorage(resolveStorage(storageProvider));
  const planId = await writablePlanId(storage, projectKey, projectId, payload.planId);
  const store = openStore(storage, projectKey, projectId, planId);
  const live = await loadLive(projectKey, reconcileIdsOf(payload.reconcileIds), await planFilterOf(storage, projectKey, projectId, planId));
  const startVersions = new Map([...(await store.loadEntries())].map(([k, e]) => [k, e.version]));
  const writes: JiraWriteRecord[] = [];
  const results: Array<{ taskId: string; ok: boolean; conflict?: boolean }> = [];
  const cascadeRoots: string[] = [];
  const remaining: string[] = [];
  let plan: ProjectPlanState | null = null;
  for (const item of items) {
    const run = (expectedVersion?: number) => updateWbsTask({ projectKey, projectId, planId, taskId: item.taskId, updates: item.updates, expectedVersion }, storage, live, { skipResponse: true });
    let res: any = await run(item.expectedVersion);
    if (res && res.conflict) {
      const now = (await store.loadEntries()).get(item.taskId)?.version ?? 0;
      const changedByBatch = now !== (startVersions.get(item.taskId) ?? 0) && item.expectedVersion === (startVersions.get(item.taskId) ?? 0);
      if (changedByBatch) res = await run(now);
    }
    const conflict = !!(res && res.conflict);
    results.push(conflict ? { taskId: item.taskId, ok: false, conflict: true } : { taskId: item.taskId, ok: true });
    if (res && Array.isArray(res.cascadeRemaining) && res.cascadeRemaining.length) {
      cascadeRoots.push(item.taskId);
      remaining.push(...res.cascadeRemaining);
    }
    writes.push(...((res && res.jiraSync && res.jiraSync.writes) || []));
    if (res && Array.isArray(res.tasks)) plan = res;
  }
  const finalPlan = plan || await getProjectPlan(projectKey, storage, new Date(), undefined, projectId, live, planId);
  const failed = writes.filter(w => !w.ok);
  const jiraSync: JiraSyncReport = { ok: failed.length === 0, writes };
  if (failed.length) jiraSync.error = failed.map(w => `${w.key}: ${w.error}`).join('; ');
  // Each item whose cascade has successors left is a root the client continues from (F-20).
  return Object.assign(finalPlan, { ok: results.every(r => r.ok), jiraSync, results, cascadeRoots, cascadeRemaining: [...new Set(remaining)],
    writtenIssueIds: writtenIssueIds({ report: () => jiraSync } as any, finalPlan.tasks) });
}

/** Ids of the issues this call wrote to Jira, for the client's next read-after-write search (F-03). */
export function writtenIssueIds(log: { report: () => JiraSyncReport }, tasks: Array<{ key: string; id?: string }>): string[] {
  const idByKey = new Map(tasks.map(t => [t.key, t.id]));
  const ids = log.report().writes.filter(w => w.ok).map(w => idByKey.get(w.key)).filter((id): id is string => !!id && /^\d+$/.test(id));
  return [...new Set(ids)].slice(0, 50);
}

/** The keys of every ancestor of a task, nearest first. */
export function ancestorKeys(key: string, tasks: Array<{ key: string; parentKey?: string }>): string[] {
  const byKey = new Map(tasks.map(t => [t.key, t]));
  const out: string[] = [];
  let cur = byKey.get(key)?.parentKey;
  while (cur && !out.includes(cur)) { out.push(cur); cur = byKey.get(cur)?.parentKey; }
  return out;
}

/** A copy of the tasks with every roll-up parent's dates recomputed from its dated children. */
export function withRollUps<T extends { key: string; parentKey?: string; startDate?: string; endDate?: string; datesFromChildren?: boolean }>(tasks: T[]): T[] {
  let out = tasks.map(t => ({ ...t }));
  for (let pass = 0; pass < 4; pass++) {
    const spans = rollUpParentDates(out);
    let changed = false;
    out = out.map(t => {
      const span = spans.get(t.key);
      if (!span || (t.startDate === span.startDate && t.endDate === span.endDate)) return t;
      changed = true;
      return { ...t, ...span, datesFromChildren: true };
    });
    if (!changed) break;
  }
  return out;
}

/** Tasks in a dependency cycle are not moved by a cascade; each is reported (F-15). */
export function reportCycle(cycle: string[] | undefined, log: SyncLog): void {
  for (const key of cycle || []) {
    log.record(key, ['plan'], { synced: false, error: 'not moved: it is in a dependency cycle; remove one of its links' });
  }
}

export const CASCADE_BATCH_LIMIT = 25;

/**
 * N-06 rule 2, ADR-003 section 3: a cascade that reaches a task or story roll-up parent moves the
 * parent's block by the block rules; the parent has no record of its own to write. A cascade into
 * an epic is not applied in v1 (DEC-5b): the epic is returned, to be reported "not moved".
 * Keys in `exclude` (the task the user moved) are never changed by the expansion.
 */
export function expandParentCascades<C extends { key: string; toStart: string; toEnd: string }>(
  changes: C[], tasks: WbsTask[], today: string, exclude: Set<string> = new Set()
): { changes: Array<{ key: string; toStart: string; toEnd: string }>; epics: string[] } {
  const out: Array<{ key: string; toStart: string; toEnd: string }> = [];
  const epics: string[] = [];
  const seen = new Set(exclude);
  for (const c of changes) {
    const t = tasks.find(x => x.key === c.key);
    if (!t || !t.datesFromChildren) {
      if (!seen.has(c.key)) { out.push(c); seen.add(c.key); }
      continue;
    }
    if (t.isEpic || (t.hierarchyLevel ?? 0) >= 1) { epics.push(c.key); continue; }
    if (!isIsoDate(t.startDate)) continue;
    const days = Math.round((Date.parse(`${c.toStart}T00:00:00Z`) - Date.parse(`${t.startDate}T00:00:00Z`)) / 86400000);
    if (days === 0) continue;
    for (const b of planBlockMove(tasks.filter(x => x.parentKey === t.key), days, today).changes) {
      if (!seen.has(b.key)) { out.push({ key: b.key, toStart: b.toStart, toEnd: b.toEnd }); seen.add(b.key); }
    }
  }
  return { changes: out, epics };
}

export function reportEpicsNotMoved(epics: string[], log: SyncLog): void {
  for (const key of epics) log.record(key, ['plan'], { synced: false, error: 'not moved: it is an epic; move its work items' });
}

/**
 * Applies the next batch of a cascade from a task: moves at most CASCADE_BATCH_LIMIT conflicting
 * successors and returns the keys still to move (D-05: the client calls again until empty).
 */
export async function continueCascade(
  payload: { projectKey: string; projectId?: string; planId?: string; taskId: string; reconcileIds?: string[] },
  storageProvider?: StorageProvider
): Promise<ProjectPlanState> {
  const { projectKey, projectId, taskId } = payload;
  assertIssueKey(taskId, 'taskId');
  const storage = resolveStorage(storageProvider);
  const planId = await writablePlanId(storage, projectKey, projectId, payload.planId);
  const log = new SyncLog();
  const live = await loadLive(projectKey, reconcileIdsOf(payload.reconcileIds), await planFilterOf(storage, projectKey, projectId, planId));
  const plan = await getProjectPlan(projectKey, storage, new Date(), undefined, projectId, live, planId);
  const store = openStore(storage, projectKey, projectId, planId);
  const entries = await store.loadEntries();
  const inputs = engineInputs(plan.tasks);
  const first = cascade(inputs.efforts, inputs.links, taskId, todayIso());
  reportCycle(first.cycle, log);
  // A cascade into a task or story parent moves its block (N-06 rule 2).
  const expanded = expandParentCascades(first.changes, [...plan.tasks, ...(plan.backlogTasks || [])], todayIso(), new Set([taskId]));
  reportEpicsNotMoved(expanded.epics, log);
  const changes = expanded.changes;
  // BL-2: a successor the user may not edit and schedule is not moved, and is reported.
  const batch = changes.slice(0, CASCADE_BATCH_LIMIT);
  // Successors this round could not move are returned, never dropped (F-20, INV-11).
  const skipped: string[] = [];
  const denied = new Map((await deniedIssues(batch.map(c => ({ key: c.key, id: [...plan.tasks, ...(plan.backlogTasks || [])].find(t => t.key === c.key)?.id })),
    ['EDIT_ISSUES', 'SCHEDULE_ISSUES'])).map(d => [d.key, d.missing]));
  for (const c of batch) {
    const missing = denied.get(c.key);
    if (missing) { skipped.push(c.key); log.record(c.key, ['plan'], { synced: false, error: `not moved: you lack ${describeMissing(missing)} on this issue in Jira` }); continue; }
    const cur = entries.get(c.key);
    const task = [...plan.tasks, ...(plan.backlogTasks || [])].find(t => t.key === c.key);
    const put = await store.putEntry(c.key, task?.id, stripJiraOwnedFields({ ...(cur || {}), startDate: c.toStart, endDate: c.toEnd,
      ...gridFor(plan.weeks, c.toStart, c.toEnd) }), cur ? cur.version : 0);
    if (!put.ok) { skipped.push(c.key); log.record(c.key, ['plan'], { synced: false, error: 'not moved: someone else changed it; move the task again' }); continue; }
    applyAcceptedDueDate(live, c.key, { startDate: c.toStart, endDate: c.toEnd }, await syncTaskToJira(c.key, { startDate: c.toStart, endDate: c.toEnd }, log, task));
  }
  return Object.assign(await getProjectPlan(projectKey, storage, new Date(), undefined, projectId, live, planId),
    { ok: true, jiraSync: log.report(), cascadeRemaining: changes.slice(CASCADE_BATCH_LIMIT).map(c => c.key), cascadeSkipped: skipped,
      writtenIssueIds: writtenIssueIds(log, plan.tasks) });
}

/**
 * Lists the moves that a change of start week or span would cause, without writing anything.
 */
export async function previewCascade(
  payload: { projectKey: string; projectId?: string; planId?: string; taskId: string; updates: { startDate?: string; endDate?: string; startWeek?: string; spanWeeks?: number } },
  storageProvider?: StorageProvider
): Promise<{ ok: boolean; changes: Array<{ key: string; field: string; from?: string; to?: string; reason?: string }> }> {
  const { projectKey, projectId, taskId, updates } = payload;
  assertIssueKey(taskId, 'taskId');
  validateTaskUpdates(updates as Record<string, unknown>);
  const plan = await getProjectPlan(projectKey, resolveStorage(storageProvider), new Date(), undefined, projectId, undefined, payload.planId);
  const target = plan.tasks.find(t => t.key === taskId);
  let start = updates.startDate || target?.startDate;
  let end = updates.endDate || target?.endDate;
  if (target && !updates.startDate && updates.startWeek && isIsoDate(target.startDate) && isIsoDate(target.endDate)) {
    // A move by weeks keeps the exact days of the bar (as updateWbsTask does).
    const shift = (plan.weeks.findIndex(w => w.weekKey === updates.startWeek) - plan.weeks.findIndex(w => w.weekKey === target.startWeek)) * 7;
    start = addDays(target.startDate, shift);
    end = addDays(target.endDate, shift + ((updates.spanWeeks || target.spanWeeks || 1) - (target.spanWeeks || 1)) * 7);
  }
  const candidate = plan.tasks.map(t => (t.key === taskId ? { ...t, startDate: start, endDate: end } : t));
  const inputs = engineInputs(candidate);
  const { changes } = cascade(inputs.efforts, inputs.links, taskId, todayIso());
  return { ok: true, changes: changes.map(c => ({ key: c.key, field: 'startDate', from: c.fromStart, to: c.toStart, reason: c.reason })) };
}

/**
 * Removes a task from the scheduled planner timeline and moves it back to unmapped backlog.
 */
export async function unscheduleTask(
  payload: UnscheduleTaskRequest,
  storageProvider?: StorageProvider
): Promise<ProjectPlanState> {
  const { projectKey, projectId, taskId } = payload;
  const issueId = await verifyIssueInProject(taskId, projectKey, 'taskId');
  await requireIssuePermissions([{ key: taskId, id: issueId }], ['EDIT_ISSUES']);
  const storage = resolveStorage(storageProvider);
  const planId = await writablePlanId(storage, projectKey, projectId, payload.planId);
  const store = openStore(storage, projectKey, projectId, planId);
  if (isMainPlan(planId)) await migrateIfNeeded(store, projectKey);
  const current = (await store.loadEntries()).get(taskId);
  if (current) {
    const entry: Partial<WbsTask> = { ...current };
    for (const f of ['startWeek', 'endWeek', 'startDate', 'endDate', 'weeklyAllocations', 'sequenceNum'] as const) delete entry[f];
    entry.isBacklog = true;
    const put = await store.putEntry(taskId, issueId, stripJiraOwnedFields(entry), current.version);
    if (!put.ok) return conflictResult(taskId);
    // The task leaves the timeline in every plan. Its Jira due date is left as it is.
    const log = new SyncLog();
    await markUnscheduled(taskId, log, current.startDate);
    return Object.assign(await getProjectPlan(projectKey, storage, new Date(), undefined, projectId, undefined, planId, issueId ? [issueId] : []),
      { ok: true, jiraSync: log.report() });
  }
  // Scheduled only through the shared property (ADR-008): the marker takes the task off every plan.
  const log = new SyncLog();
  await markUnscheduled(taskId, log);
  return Object.assign(await getProjectPlan(projectKey, storage, new Date(), undefined, projectId, undefined, planId, issueId ? [issueId] : []),
    { ok: true, jiraSync: log.report() });
}

/**
 * Takes a task off the timeline in every plan (ADR-008): the issue property keeps no start. A property
 * without a start wins over the start in any plan's older record, which a deleted property would not.
 */
export async function markUnscheduled(issueKey: string, log: SyncLog, oldStart?: string): Promise<void> {
  let ok = false;
  try {
    const res = await getJiraCaller().requestJira(route`/rest/api/3/issue/${issueKey}/properties/${DATES_PROPERTY}`, {
      method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ v: 1 })
    });
    ok = !!res && (res.status === 200 || res.status === 201 || res.status === 204);
    if (!ok) logFailure('markUnscheduled', res);
  } catch (err) { logFailure('markUnscheduled', err); }
  const changes = [{ field: 'start date', from: isIsoDate(oldStart) ? oldStart : null, to: null }];
  log.record(issueKey, ['startdate'], ok ? { synced: true } : { synced: false, error: 'Jira did not save that the task is off the timeline' }, changes);
}

/**
 * Reorders tasks within the WBS planner grid.
 */
export async function reorderWbsTasks(
  payload: ReorderTasksRequest,
  storageProvider?: StorageProvider
): Promise<ProjectPlanState> {
  const { projectKey, projectId, taskId, targetIndex } = payload;
  const storage = resolveStorage(storageProvider);
  const planId = await writablePlanId(storage, projectKey, projectId, payload.planId);

  const live = await loadLive(projectKey, [], await planFilterOf(storage, projectKey, projectId, planId));
  const plan = await getProjectPlan(projectKey, storage, new Date(), undefined, projectId, live, planId);
  const moving = plan.tasks.find(t => t.key === taskId || t.id === taskId);
  if (moving) await requireIssuePermissions([{ key: moving.key, id: moving.id }], ['EDIT_ISSUES']);
  const reordered = PlannerEngine.reorderTasks(plan.tasks, taskId, targetIndex);
  const store = openStore(storage, projectKey, projectId, planId);
  const entries = await store.loadEntries();
  const pos = reordered.findIndex(t => t.key === taskId || t.id === taskId);
  if (pos !== -1) {
    const movedKey = reordered[pos].key;
    // Rows without a sequence number sort after the numbered ones, in Jira's order. So every row
    // above the new position gets a number first, in its current order (once per row); rows below
    // keep Jira's order. A row can have no record at all: since ADR-008 its dates are the issue
    // property, so a record is written with the number only.
    let last: number | undefined;
    for (const row of reordered.slice(0, pos)) {
      const e = entries.get(row.key);
      if (e && typeof e.sequenceNum === 'number') { last = e.sequenceNum; continue; }
      const seq = sequenceBetween(last, undefined);
      const put = await store.putEntry(row.key, row.id, { ...(e || {}), sequenceNum: seq }, e ? e.version : 0);
      // A row someone else changed meanwhile: refuse, so the client reloads (F-28).
      if (!put.ok) return conflictResult(row.key);
      entries.set(row.key, put.entry);
      last = seq;
    }
    const seqAt = (i: number) => (i >= 0 && i < reordered.length ? entries.get(reordered[i].key)?.sequenceNum : undefined);
    const moved = entries.get(movedKey);
    const put = await store.putEntry(movedKey, reordered[pos].id, { ...(moved || {}), sequenceNum: sequenceBetween(seqAt(pos - 1), seqAt(pos + 1)) }, moved ? moved.version : 0);
    if (!put.ok) return conflictResult(movedKey);
  }
  return Object.assign(await getProjectPlan(projectKey, storage, new Date(), undefined, projectId, live, planId), { ok: true, jiraSync: noJiraWrites() });
}

/**
 * Saves an inter-task fractional dependency.
 */
export async function saveTaskDependency(
  payload: { projectKey: string; projectId?: string; planId?: string; taskId: string; dependency: TaskDependency },
  storageProvider?: StorageProvider
): Promise<ProjectPlanState> {
  const { projectKey, projectId, taskId, dependency } = payload;
  validateDependencyPayload(dependency);
  const storage = resolveStorage(storageProvider);
  const planId = await writablePlanId(storage, projectKey, projectId, payload.planId);

  const live = await loadLive(projectKey, [], await planFilterOf(storage, projectKey, projectId, planId));
  const plan = await getProjectPlan(projectKey, storage, new Date(), undefined, projectId, live, planId);
  const planKeys = new Set([...plan.tasks, ...(plan.backlogTasks || [])].map(t => t.key));
  if (!planKeys.has(dependency.predecessorKey)) {
    throw new ValidationError('dependency.predecessorKey', `${dependency.predecessorKey} is not in project ${projectKey}`);
  }
  const targetTask = plan.tasks.find(t => t.id === taskId || t.key === taskId) ||
    plan.backlogTasks?.find(t => t.id === taskId || t.key === taskId);
  if (!targetTask) {
    throw new Error(`Target task '${taskId}' not found in project plan`);
  }

  const validation = PlannerEngine.validateDependency(
    targetTask.key,
    dependency.predecessorKey,
    dependency.triggerPercent,
    plan.tasks
  );
  if (!validation.valid) {
    throw new Error(validation.error);
  }

  // Mirror dependency to a native Jira issue link (reused when it already exists)
  const mirror = await mirrorDependencyToJira(targetTask.key, dependency.predecessorKey);
  const log = new SyncLog();
  log.record(targetTask.key, ['issuelink'], { synced: mirror.linked, error: mirror.error || 'Jira did not create the link' });
  const keep = (targetTask.dependencies || []).find(d => d.predecessorKey === dependency.predecessorKey);
  const ownedLinkId = mirror.created ? mirror.linkId : (keep ? keep.jiraLinkId : undefined);

  const store = openStore(storage, projectKey, projectId, planId);
  const stored = (await store.loadEntries()).get(targetTask.key);
  // The new link replaces the active set; the others end (B-28).
  const next: TaskDependency = { predecessorId: dependency.predecessorKey, predecessorKey: dependency.predecessorKey,
    triggerPercent: dependency.triggerPercent, isTriggerSatisfied: false };
  if (ownedLinkId) next.jiraLinkId = ownedLinkId;
  const applied = applyLinkUpdate(targetTask.dependencies || [], stored?.endedLinks || [], next, todayIso());
  for (const gone of applied.removed) {
    if (gone.jiraLinkId) log.record(targetTask.key, ['issuelink'], { synced: await removeMirroredLink(gone.jiraLinkId), error: 'Jira did not delete the link' });
  }
  const put = await store.putEntry(targetTask.key, targetTask.id, stripJiraOwnedFields({
    ...(stored || {}),
    dependency: applied.dependencies[0],
    dependencies: applied.dependencies,
    endedLinks: applied.endedLinks
  }), stored ? stored.version : 0);
  if (!put.ok) return conflictResult(targetTask.key);

  return Object.assign(await getProjectPlan(projectKey, storage, new Date(), undefined, projectId, live, planId), { ok: true, jiraSync: log.report() });
}

/**
 * Saves column width configurations.
 */
export async function saveColumnWidths(
  payload: { projectKey: string; projectId?: string; planId?: string; columnWidths: ColumnWidthConfig },
  storageProvider?: StorageProvider
): Promise<{ success: boolean; ok: boolean; jiraSync: JiraSyncReport; columnWidths: ColumnWidthConfig }> {
  const { projectKey, projectId, columnWidths } = payload;
  validateColumnWidths(columnWidths as unknown as Record<string, unknown>);
  const storage = resolveStorage(storageProvider);
  const store = openStore(storage, projectKey, projectId, await writablePlanId(storage, projectKey, projectId, payload.planId));
  await store.saveSettings({ columnWidths });
  return { success: true, ok: true, jiraSync: noJiraWrites(), columnWidths };
}

/**
 * Saves hidden columns configuration.
 */
export async function saveHiddenColumns(
  payload: { projectKey: string; projectId?: string; planId?: string; hiddenColumns: string[] },
  storageProvider?: StorageProvider
): Promise<{ success: boolean; ok: boolean; jiraSync: JiraSyncReport; hiddenColumns: string[] }> {
  const { projectKey, projectId, hiddenColumns } = payload;
  validateHiddenColumns(hiddenColumns);
  const storage = resolveStorage(storageProvider);
  const store = openStore(storage, projectKey, projectId, await writablePlanId(storage, projectKey, projectId, payload.planId));
  const cols = Array.isArray(hiddenColumns) ? hiddenColumns : [];
  await store.saveSettings({ hiddenColumns: cols });
  return { success: true, ok: true, jiraSync: noJiraWrites(), hiddenColumns: cols };
}

/**
 * Saves a milestone marker.
 */
export async function saveProjectMilestone(
  payload: { projectKey: string; projectId?: string; planId?: string; milestone: ProjectMilestone },
  storageProvider?: StorageProvider
): Promise<{ success: boolean; ok: boolean; jiraSync: JiraSyncReport; milestones: ProjectMilestone[] }> {
  const { projectKey, projectId, milestone } = payload;
  validateMilestone(milestone as unknown as Record<string, unknown>);
  const storage = resolveStorage(storageProvider);
  const store = openStore(storage, projectKey, projectId, await writablePlanId(storage, projectKey, projectId, payload.planId));
  const current = (await store.getSettings()).milestones || DEFAULT_MILESTONES;
  const filtered = current.filter(m => m.id !== milestone.id).slice(-99);
  filtered.push(milestone);
  await store.saveSettings({ milestones: filtered });
  return { success: true, ok: true, jiraSync: noJiraWrites(), milestones: filtered };
}

/**
 * DEC-6 (adopted Option A): when a planner action changes the roll-up end of a parent, the parent's
 * Jira due date follows it, written as the user. A parent the user may not edit or schedule keeps
 * its due date, and the write is reported "not written" (the sub-task move itself stands).
 */
export async function followParentDueDates(
  before: WbsTask[], moved: Map<string, { startDate?: string; endDate?: string }>, log: SyncLog, live: LiveData,
  reparent?: { key: string; parentKey?: string }
): Promise<void> {
  if (moved.size === 0 && !reparent) return;
  const shifted = before.map(t => {
    let n = moved.has(t.key) ? { ...t, ...moved.get(t.key) } : t;
    if (reparent && t.key === reparent.key) n = { ...n, parentKey: reparent.parentKey };
    return n;
  });
  const after = withRollUps(shifted);
  const parents = new Set<string>();
  for (const key of moved.keys()) for (const a of ancestorKeys(key, before)) if (!moved.has(a)) parents.add(a);
  if (reparent) for (const list of [before, shifted]) for (const a of ancestorKeys(reparent.key, list)) parents.add(a);
  const targets: Array<{ key: string; id?: string; endDate: string; was: WbsTask }> = [];
  for (const key of parents) {
    const was = before.find(t => t.key === key);
    const now = after.find(t => t.key === key);
    if (!was || !now || !now.datesFromChildren || !isIsoDate(now.endDate) || was.endDate === now.endDate) continue;
    if (String(was.jiraDueDate || '').slice(0, 10) === now.endDate) continue;
    targets.push({ key, id: was.id, endDate: now.endDate as string, was });
  }
  if (targets.length === 0) return;
  const denied = new Map((await deniedIssues(targets, ['EDIT_ISSUES', 'SCHEDULE_ISSUES'])).map(d => [d.key, d.missing]));
  for (const t of targets) {
    const change = describeJiraChanges(['duedate'], t.was, { endDate: t.endDate });
    const missing = denied.get(t.key);
    if (missing) {
      log.record(t.key, ['duedate'], { synced: false, error: `not written: you lack ${describeMissing(missing)} on this parent in Jira` }, change);
      continue;
    }
    applyAcceptedDueDate(live, t.key, { endDate: t.endDate }, await syncTaskToJira(t.key, { endDate: t.endDate }, log, t.was));
  }
}

/**
 * Cascades from the roots on a candidate plan (N-06 rule 2: a cascade into a parent moves its block)
 * and applies at most CASCADE_BATCH_LIMIT changes: permission check, record write with its version,
 * Jira due date and start. Every applied change is added to `moved`.
 */
export async function cascadeAndApply(ctx: {
  candidate: WbsTask[]; all: WbsTask[]; roots: string[]; exclude: Set<string>; store: PlanStore; entries: Map<string, StoredEntry>;
  idByKey: Map<string, string | undefined>; activeWeeks: WeeklySprintColumn[]; log: SyncLog; live: LiveData;
  moved: Map<string, { startDate?: string; endDate?: string }>;
}): Promise<{ cascadeRemaining: string[]; notMoved: Set<string> }> {
  const { candidate, all, store, entries, idByKey, activeWeeks, log, live, moved } = ctx;
  const inputs = engineInputs(candidate);
  let efforts = inputs.efforts;
  const cascaded: Array<{ key: string; toStart: string; toEnd: string }> = [];
  const notMoved = new Set<string>();
  for (const root of ctx.roots) {
    const r = cascade(efforts, inputs.links, root, todayIso());
    reportCycle(r.cycle, log);
    efforts = r.efforts;
    const expanded = expandParentCascades(r.changes, all, todayIso(), ctx.exclude);
    reportEpicsNotMoved(expanded.epics, log);
    for (const c of expanded.changes) if (!cascaded.some(x => x.key === c.key)) cascaded.push(c);
  }
  const cascadeRemaining = cascaded.slice(CASCADE_BATCH_LIMIT).map(c => c.key);
  const now = cascaded.slice(0, CASCADE_BATCH_LIMIT);
  for (const d of await deniedIssues(now.map(c => ({ key: c.key, id: idByKey.get(c.key) })), ['EDIT_ISSUES', 'SCHEDULE_ISSUES'])) {
    notMoved.add(d.key);
    log.record(d.key, ['plan'], { synced: false, error: `not moved: you lack ${describeMissing(d.missing)} on this issue in Jira` });
  }
  for (const c of now) {
    if (notMoved.has(c.key)) continue;
    const cur = entries.get(c.key);
    const put = await store.putEntry(c.key, idByKey.get(c.key), stripJiraOwnedFields({ ...(cur || {}), startDate: c.toStart, endDate: c.toEnd, ...gridFor(activeWeeks, c.toStart, c.toEnd) }), cur?.version ?? 0);
    if (!put.ok) { notMoved.add(c.key); log.record(c.key, ['plan'], { synced: false, error: 'not moved: someone else changed it; move the task again' }); continue; }
    applyAcceptedDueDate(live, c.key, { startDate: c.toStart, endDate: c.toEnd },
      await syncTaskToJira(c.key, { startDate: c.toStart, endDate: c.toEnd }, log, all.find(t => t.key === c.key)));
    moved.set(c.key, { startDate: c.toStart, endDate: c.toEnd });
  }
  return { cascadeRemaining, notMoved };
}

export async function getResourceUtilizationGrid(
  payload: { projectKey: string; projectId?: string; planId?: string; weeklyCapacityHours?: number },
  storageProvider?: StorageProvider
): Promise<{ success: boolean; utilization?: ResourceUtilizationView; error?: string }> {
  try {
    const planId = payload.planId || 'default';
    const plan = await getProjectPlan(payload.projectKey, storageProvider, new Date(), undefined, payload.projectId, undefined, planId);
    const utilization = ResourceUtilizationEngine.generateGrid(plan.tasks, plan.weeks, {
      weeklyCapacityHours: payload.weeklyCapacityHours || 40
    });
    return { success: true, utilization };
  } catch (err: any) {
    return { success: false, error: err?.message || 'Failed to generate resource utilization grid' };
  }
}
