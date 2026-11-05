/*
 * Copyright (c) 2026 Asymm Systems. All rights reserved.
 *
 * @author Fahim Farook
 */

/**
 * CascadePlan server: Resolvers that create Jira issues: tasks, epics and sub-tasks.
 * Split from src/index.ts without changes to any statement (F-31).
 */

import { ProjectPlanState, WbsTask, InlineTaskCreateRequest, CreateSubtaskForResourceRequest, JiraEpicItem, SubtaskItem, EstimateUnit, JiraSyncReport } from '../domain/models';
import { PlannerEngine } from '../domain/planner-engine';
import { StorageProvider } from '../storage/plan-repository';
import { logFailure } from '../logger';
import { requireIssuePermissions } from '../security/write-permissions';
import { ValidationError, validateSchedulePayload } from '../validation';
import { SyncLog, conflictResult, failedCreate, getDefaultWeeks, getTimelineWeeks, isIsoDate, isMainPlan, noJiraWrites, openStore, resolveStorage, sequenceForIndex, stripJiraOwnedFields, todayIso, verifyIssueInProject, writablePlanId } from './core';
import { includeCreated, resolveProjectIssueType } from './jira-read';
import { createIdOf, partCreateId, postIssueOnce, syncTaskToJira } from './jira-write';
import { getProjectPlan, migrateIfNeeded } from './plan-read';
import { writtenIssueIds } from './tasks';

export async function createInlineTask(
  request: InlineTaskCreateRequest,
  storageProvider?: StorageProvider
): Promise<{ success: boolean; ok: boolean; jiraSync: JiraSyncReport; task?: WbsTask; plan?: ProjectPlanState; error?: string }> {
  validateSchedulePayload(request as unknown as Record<string, unknown>, { summaryRequired: true });
  const weeksNow = getDefaultWeeks(); // computed per call (B-18)
  const currentWeekKey = weeksNow.find(w => w.isCurrentWeek)?.weekKey || weeksNow[0].weekKey;
  const {
    projectKey, projectId, epic, epicKey, parentKey, story, summary, effortHours,
    resource = 'Unassigned', resourceAccountId, assigneeAccountId, startWeek, spanWeeks = 3, targetIndex
  } = request;

  const createId = createIdOf(request.createId);
  let jiraIssueId = '';
  let jiraIssueKey = '';
  // The plan check runs before the Jira create, so a deleted plan creates no issue (R-14, H9).
  const storage = resolveStorage(storageProvider);
  const planId = await writablePlanId(storage, projectKey, projectId, request.planId);

  try {
    let res: any;
    const effectiveParent = parentKey || epicKey;
    const rawAssignee = (assigneeAccountId && assigneeAccountId !== 'unassigned' && assigneeAccountId !== 'Unassigned')
      ? assigneeAccountId
      : (resourceAccountId && !resourceAccountId.startsWith('ph:') && resourceAccountId !== 'unassigned' && resourceAccountId !== 'Unassigned' ? resourceAccountId : undefined);
    const effectiveAssignee = rawAssignee && rawAssignee.trim().length > 0 ? rawAssignee.trim() : undefined;

    const body: any = {
      fields: {
        project: { key: projectKey },
        summary,
        issuetype: { name: 'Task' }
      }
    };
    if (effectiveParent) {
      body.fields.parent = { key: effectiveParent };
    }
    if (effectiveAssignee) {
      body.fields.assignee = { accountId: effectiveAssignee };
    }

    res = await postIssueOnce(projectKey, body, createId);

    if (res && res.status === 400) {
      let isIssueTypeError = false;
      try {
        const cloned = res.clone ? res.clone() : res;
        const errJson = await cloned.json();
        const errStr = JSON.stringify(errJson).toLowerCase();
        if (errStr.includes('issue type') || errStr.includes('issuetype')) {
          isIssueTypeError = true;
        }
      } catch (err) { logFailure('createInlineTask', err); }

      if (isIssueTypeError) {
        const issueTypeMeta = await resolveProjectIssueType(projectKey, 'Task');
        if (issueTypeMeta.id) {
          body.fields.issuetype = { id: issueTypeMeta.id } as any;
          res = await postIssueOnce(projectKey, body, createId);
        }
      }
    }

    if (!res || res.status !== 201) {
      let errMsg = `Failed to create Jira issue (HTTP ${res?.status || 500})`;
      try {
        const errJson = await res.json();
        if (errJson.errorMessages && errJson.errorMessages.length > 0) {
          errMsg = errJson.errorMessages.join(', ');
        } else if (errJson.errors && Object.keys(errJson.errors).length > 0) {
          errMsg = Object.values(errJson.errors).join(', ');
        }
      } catch (err) { logFailure('createInlineTask', err); }
      return { success: false, ok: false, error: errMsg, jiraSync: failedCreate(errMsg) };
    }

    const data = await res.json();
    jiraIssueId = String(data.id);
    jiraIssueKey = String(data.key);
  } catch (err: any) {
    const message = err?.message || 'Network error while contacting Jira';
    return { success: false, ok: false, error: message, jiraSync: failedCreate(message) };
  }

  const store = openStore(storage, projectKey, projectId, planId);
  if (isMainPlan(planId)) await migrateIfNeeded(store, projectKey);
  const entries = await store.loadEntries();

  const assignedStartWeek = startWeek || currentWeekKey;
  const startIdx = Math.max(0, weeksNow.findIndex(w => w.weekKey === assignedStartWeek));
  const endIdx = Math.min(weeksNow.length - 1, startIdx + spanWeeks - 1);
  const endWeek = weeksNow[endIdx].weekKey;

  const allocations: Record<string, number> = {};
  for (let i = startIdx; i <= endIdx; i++) {
    allocations[weeksNow[i].weekKey] = Math.round(100 / spanWeeks);
  }

  const created = await store.putEntry(jiraIssueKey, jiraIssueId, {
    startWeek: assignedStartWeek,
    endWeek,
    spanWeeks,
    startDate: weeksNow[startIdx].startDate,
    endDate: weeksNow[endIdx].endDate,
    weeklyAllocations: allocations,
    sequenceNum: sequenceForIndex(entries, jiraIssueKey, targetIndex)
  });
  void epic; void story; void resource;

  // The new issue has the same dates in every plan (the issue property, ADR-008); its due date, estimate,
  // assignee and epic go to Jira. The default span stays in the planner; only an end the user chose
  // becomes the Jira due date (F-06).
  const log = new SyncLog();
  await syncTaskToJira(jiraIssueKey, {
    ...(created.ok ? { startDate: created.entry.startDate as string } : {}),
    ...(request.endDate ? { endDate: request.endDate } : {}),
    effortHours,
    resourceAccountId,
    epicKey
  }, log, {}, { propertyEnd: created.ok ? created.entry.endDate as string : undefined });

  const plan = await getProjectPlan(projectKey, storage, new Date(), undefined, projectId, undefined, planId);
  const createdTask = includeCreated(plan, (await store.loadEntries()).get(jiraIssueKey),
    { id: jiraIssueId, key: jiraIssueKey, summary, epic: epic || '', epicKey, story: story || 'Task', effortHours: effortHours || 0, resource, resourceAccountId }, targetIndex);

  return { success: true, ok: true, jiraSync: log.report(), task: createdTask, plan };
}

/**
 * Creates a new Jira Epic.
 */
export async function createJiraEpic(
  payload: { projectKey: string; summary: string; createId?: string },
  storageProvider?: StorageProvider
): Promise<{ success: boolean; ok: boolean; jiraSync: JiraSyncReport; epic?: JiraEpicItem; error?: string }> {
  const { projectKey, summary } = payload;
  const createId = createIdOf(payload.createId);
  try {
    let res: any;
    let body = {
      fields: {
        project: { key: projectKey },
        summary,
        issuetype: { name: 'Epic' }
      }
    };

    res = await postIssueOnce(projectKey, body, createId);

    if (res && res.status === 400) {
      let isIssueTypeError = false;
      try {
        const cloned = res.clone ? res.clone() : res;
        const errJson = await cloned.json();
        const errStr = JSON.stringify(errJson).toLowerCase();
        if (errStr.includes('issue type') || errStr.includes('issuetype')) {
          isIssueTypeError = true;
        }
      } catch (err) { logFailure('createJiraEpic', err); }

      if (isIssueTypeError) {
        const issueTypeMeta = await resolveProjectIssueType(projectKey, 'Epic');
        if (issueTypeMeta.id) {
          body.fields.issuetype = { id: issueTypeMeta.id } as any;
          res = await postIssueOnce(projectKey, body, createId);
        } else {
          const errMsg = 'Epics are not enabled in this project type';
          return { success: false, ok: false, error: errMsg, jiraSync: failedCreate(errMsg) };
        }
      }
    }

    if (!res || res.status !== 201) {
      let errMsg = `Failed to create Jira Epic (HTTP ${res?.status || 500})`;
      try {
        const errJson = await res.json();
        if (errJson.errorMessages && errJson.errorMessages.length > 0) {
          errMsg = errJson.errorMessages.join(', ');
        } else if (errJson.errors && Object.keys(errJson.errors).length > 0) {
          errMsg = Object.values(errJson.errors).join(', ');
        }
      } catch (err) { logFailure('createJiraEpic', err); }
      return { success: false, ok: false, error: errMsg, jiraSync: failedCreate(errMsg) };
    }

    const data = await res.json();
    return {
      success: true,
      ok: true,
      jiraSync: { ok: true, writes: [{ key: String(data.key), fields: ['create'], ok: true }] },
      epic: { id: String(data.id), key: String(data.key), summary }
    };
  } catch (err: any) {
    const message = err?.message || 'Network error while contacting Jira';
    return { success: false, ok: false, error: message, jiraSync: failedCreate(message) };
  }
}

/**
 * Creates a subtask in Jira specifically allocated to a secondary or specific team resource.
 * Adheres to Jira single-assignee best practice by creating background subtasks per resource.
 */
export async function createSubtaskForResource(
  payload: CreateSubtaskForResourceRequest,
  storageProvider?: StorageProvider
): Promise<{ success: boolean; ok: boolean; jiraSync: JiraSyncReport; subtask?: WbsTask; plan?: ProjectPlanState; error?: string }> {
  validateSchedulePayload(payload as unknown as Record<string, unknown>);
  const projectKey = payload.projectKey;
  const projectId = payload.projectId;
  const parentKey = payload.parentKey || payload.parentTaskId;
  const resource = payload.resource || payload.assigneeName || 'Unassigned';
  const resourceAccountId = payload.resourceAccountId || payload.assigneeAccountId;
  const summary = payload.summary || `Subtask: ${resource}`;
  // Only what the user entered goes to Jira: no default estimate and no default due date (F-06, INV-03).
  const effortHours = typeof payload.effortHours === 'number' && payload.effortHours > 0 ? payload.effortHours : undefined;
  const startWeek = payload.startWeek;
  const spanWeeks = payload.spanWeeks ?? 2;
  if (payload.endDate !== undefined && !isIsoDate(payload.endDate)) throw new ValidationError('endDate', 'endDate must be a date in YYYY-MM-DD form');

  if (!parentKey) {
    return { success: false, ok: false, error: 'parentKey is required', jiraSync: noJiraWrites() };
  }
  const createId = createIdOf(payload.createId);
  const parentIssueId = await verifyIssueInProject(parentKey, projectKey, 'parentKey');
  // The sub-task is created under the parent, and the parent's record changes (BL-2).
  await requireIssuePermissions([{ key: parentKey, id: parentIssueId }], ['EDIT_ISSUES']);
  const storage = resolveStorage(storageProvider);
  const planId = await writablePlanId(storage, projectKey, projectId, payload.planId);

  let createdId = '';
  let createdKey = '';
  const subtaskTypes = ['Sub-task', 'Subtask'];
  let lastErr = '';

  for (const stType of subtaskTypes) {
    try {
      const body: any = {
        fields: {
          project: { key: projectKey },
          parent: { key: parentKey },
          summary,
          issuetype: { name: stType }
        }
      };
      if (resourceAccountId && !resourceAccountId.startsWith('ph:') && resourceAccountId !== 'unassigned') {
        body.fields.assignee = { accountId: resourceAccountId };
      }

      const res = await postIssueOnce(projectKey, body, createId);

      if (res && res.status === 201) {
        const data = await res.json();
        createdId = String(data.id);
        createdKey = String(data.key);
        break;
      } else {
        const errJson = await res.json().catch(() => ({}));
        lastErr = errJson.errorMessages?.join(', ') || JSON.stringify(errJson.errors || {});
      }
    } catch (err: any) {
      lastErr = err?.message || 'Network error';
    }
  }

  if (!createdKey) {
    const message = `Failed to create subtask in Jira: ${lastErr}`;
    return { success: false, ok: false, error: message, jiraSync: failedCreate(message) };
  }

  const dynamicWeeks = getTimelineWeeks();
  const activeWeeks = dynamicWeeks.weeks;
  const assignedStart = startWeek || activeWeeks[dynamicWeeks.currentWeekIndex].weekKey;
  const sIdx = Math.max(0, activeWeeks.findIndex(w => w.weekKey === assignedStart));
  const eIdx = Math.min(activeWeeks.length - 1, sIdx + spanWeeks - 1);

  const allocations: Record<string, number> = {};
  for (let i = sIdx; i <= eIdx; i++) {
    allocations[activeWeeks[i].weekKey] = Math.round(100 / spanWeeks);
  }

  const store = openStore(storage, projectKey, projectId, planId);
  if (isMainPlan(planId)) await migrateIfNeeded(store, projectKey);
  const createdPut = await store.putEntry(createdKey, createdId, {
    startWeek: assignedStart,
    endWeek: activeWeeks[eIdx].weekKey,
    startDate: activeWeeks[sIdx].startDate,
    endDate: activeWeeks[eIdx].endDate,
    spanWeeks,
    weeklyAllocations: allocations
  });
  const log = new SyncLog();

  if (parentKey && resourceAccountId) {
    const parentEntries = await store.loadEntries();
    const parentStored = parentEntries.get(parentKey);
    if (parentStored) {
      const parentId = parentStored.issueId || (await verifyIssueInProject(parentKey, projectKey, 'parentKey'));
      const existingContributors = parentStored.contributors ? [...parentStored.contributors] : [];
      const partyIdx = existingContributors.findIndex(c => c.accountId === resourceAccountId);
      if (partyIdx !== -1) {
        existingContributors[partyIdx] = { ...existingContributors[partyIdx], subtaskKey: createdKey };
      } else {
        existingContributors.push({ accountId: resourceAccountId, since: todayIso(), subtaskKey: createdKey });
      }
      await store.putEntry(parentKey, parentId, stripJiraOwnedFields({
        ...parentStored,
        contributors: existingContributors
      }), parentStored.version);
    }
  }

  // Sync the estimate and the end the user entered, and the assignee, to the new subtask, from any plan.
  log.record(createdKey, ['create'], { synced: true });
  await syncTaskToJira(createdKey, {
    ...(createdPut.ok ? { startDate: createdPut.entry.startDate as string } : {}),
    ...(effortHours !== undefined ? { effortHours } : {}),
    ...(payload.endDate ? { endDate: payload.endDate } : {}),
    resourceAccountId
  }, log, {}, { propertyEnd: createdPut.ok ? createdPut.entry.endDate as string : undefined });

  const plan = await getProjectPlan(projectKey, storage, new Date(), undefined, projectId, undefined, planId);
  const subtask = includeCreated(plan, (await store.loadEntries()).get(createdKey),
    { id: createdId, key: createdKey, summary, isSubtask: true, hierarchyLevel: -1, parentKey, effortHours: effortHours || 0, resourceAccountId });
  return { success: true, ok: true, jiraSync: log.report(), subtask, plan };
}

/**
 * Adds a subtask to a parent task, re-calculating the parent effort with optional buffer.
 */
export async function addSubtaskToTask(
  payload: {
    projectKey: string;
    projectId?: string;
    planId?: string;
    parentTaskId: string;
    subtask: { summary: string; estimateValue?: number; estimateUnit?: EstimateUnit };
    bufferType?: 'PERCENTAGE' | 'FIXED_HOURS' | 'NONE';
    bufferValue?: number;
  },
  storageProvider?: StorageProvider
): Promise<ProjectPlanState> {
  // A sub-task is a real Jira sub-task, created as the user (ADR-004, F-23); nothing is stored in the
  // plan. Only an estimate the user entered goes to Jira: there is no default (BL-3, INV-03).
  const { projectKey, projectId, parentTaskId, subtask } = payload;
  const createId = createIdOf((payload as any).createId);
  const parentId = await verifyIssueInProject(parentTaskId, projectKey, 'parentTaskId');
  await requireIssuePermissions([{ key: parentTaskId, id: parentId }], ['EDIT_ISSUES', 'CREATE_ISSUES']);
  const storage = resolveStorage(storageProvider);
  const planId = await writablePlanId(storage, projectKey, projectId, payload.planId);
  const summary = typeof subtask?.summary === 'string' ? subtask.summary.trim() : '';
  if (!summary || summary.length > 255) throw new ValidationError('subtask.summary', 'A sub-task needs a summary of at most 255 characters');
  let effortHours: number | undefined;
  if (subtask.estimateValue !== undefined && subtask.estimateValue !== null) {
    if (typeof subtask.estimateValue !== 'number' || !(subtask.estimateValue > 0) || subtask.estimateValue > 10000) {
      throw new ValidationError('subtask.estimateValue', 'The estimate must be a number above 0');
    }
    effortHours = PlannerEngine.normalizeEstimateToHours(subtask.estimateUnit || 'HOURS', subtask.estimateValue);
  }
  const log = new SyncLog();
  const created = await createJiraSubtask(projectKey, parentTaskId, summary, effortHours, createId);
  if (!created.key) {
    log.record(parentTaskId, ['subtask'], { synced: false, error: `Jira did not create the sub-task: ${created.error}` });
    return Object.assign(await getProjectPlan(projectKey, storage, new Date(), undefined, projectId, undefined, planId),
      { ok: false, success: false, error: 'subtask_refused', message: `Jira did not create the sub-task: ${created.error}`, jiraSync: log.report() });
  }
  log.record(created.key, ['create'], { synced: true });
  const reconcile = [parentId, created.id].filter((id): id is string => !!id && /^\d+$/.test(id));
  return Object.assign(await getProjectPlan(projectKey, storage, new Date(), undefined, projectId, undefined, planId, reconcile),
    { ok: true, jiraSync: log.report(), createdKey: created.key, writtenIssueIds: reconcile });
}

/** Creates a Jira sub-task under a parent, as the user, trying the two usual type names. */
export async function createJiraSubtask(projectKey: string, parentKey: string, summary: string, effortHours?: number, createId?: string): Promise<{ key?: string; id?: string; error?: string }> {
  let error = 'no sub-task issue type';
  for (const stType of ['Sub-task', 'Subtask']) {
    try {
      const fields: any = { project: { key: projectKey }, parent: { key: parentKey }, summary, issuetype: { name: stType } };
      if (effortHours) fields.timetracking = { originalEstimate: `${effortHours}h` };
      const res = await postIssueOnce(projectKey, { fields }, createId);
      if (res && res.status === 201) {
        const data = await res.json();
        return { key: String(data.key), id: String(data.id) };
      }
      const errJson = await res.json().catch(() => ({}));
      error = errJson.errorMessages?.join(', ') || JSON.stringify(errJson.errors || {}) || `HTTP ${res?.status}`;
    } catch (err: any) {
      error = err?.message || 'Network error';
    }
  }
  return { error };
}

/**
 * Sub-tasks an earlier build stored only in the plan record (before ADR-004): the user creates them
 * in Jira or drops them, never silently (F-23). 'create' makes one Jira sub-task for each, with its
 * stored estimate; each one Jira creates leaves the record. 'drop' removes them from the record.
 */
export async function resolveLocalSubtasks(
  payload: { projectKey: string; projectId?: string; planId?: string; parentTaskId: string; action: 'create' | 'drop' },
  storageProvider?: StorageProvider
): Promise<any> {
  const { projectKey, projectId, parentTaskId, action } = payload;
  if (action !== 'create' && action !== 'drop') throw new ValidationError('action', 'action must be create or drop');
  const createId = createIdOf((payload as any).createId);
  const parentId = await verifyIssueInProject(parentTaskId, projectKey, 'parentTaskId');
  await requireIssuePermissions([{ key: parentTaskId, id: parentId }], action === 'create' ? ['EDIT_ISSUES', 'CREATE_ISSUES'] : ['EDIT_ISSUES']);
  const storage = resolveStorage(storageProvider);
  const planId = await writablePlanId(storage, projectKey, projectId, payload.planId);
  const store = openStore(storage, projectKey, projectId, planId);
  const stored = (await store.loadEntries()).get(parentTaskId);
  const local: SubtaskItem[] = (stored?.subtasks || []).filter((s: SubtaskItem) => !s.key);
  const log = new SyncLog();
  const left: SubtaskItem[] = [];
  const ids: string[] = [parentId].filter((id): id is string => !!id);
  if (action === 'create') {
    for (const s of local) {
      const created = await createJiraSubtask(projectKey, parentTaskId, s.summary, s.normalizedHours > 0 ? s.normalizedHours : undefined, partCreateId(createId, s.id || s.summary));
      if (created.key) { log.record(created.key, ['create'], { synced: true }); if (created.id) ids.push(created.id); }
      else { left.push(s); log.record(parentTaskId, ['subtask'], { synced: false, error: `Jira did not create "${s.summary}": ${created.error}` }); }
    }
  }
  if (stored) {
    const { issueKey: _k, issueId: _i, version, ...rest } = stored as any;
    const put = await store.putEntry(parentTaskId, parentId, stripJiraOwnedFields({ ...rest, subtasks: left }), version);
    if (!put.ok) return conflictResult(parentTaskId);
  }
  const reconcile = ids.filter(id => /^\d+$/.test(id));
  return Object.assign(await getProjectPlan(projectKey, storage, new Date(), undefined, projectId, undefined, planId, reconcile),
    { ok: left.length === 0, jiraSync: log.report(), writtenIssueIds: reconcile });
}
