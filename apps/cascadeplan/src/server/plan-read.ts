/*
 * Copyright (c) 2026 Asymm Systems. All rights reserved.
 *
 * @author Fahim Farook
 */

/**
 * CascadePlan server: The plan state: one-time record migration, the plan filter of a plan, and getProjectPlan.
 * Split from src/index.ts without changes to any statement (F-31).
 */

import { ProjectPlanState, WbsTask, WORK_EFFORT_MODEL } from '../domain/models';
import { PlannerEngine } from '../domain/planner-engine';
import { contributorNames, rollUpParentDates, migrateEntry } from '../domain/work-effort-links';
import { evaluateEffort } from '../domain/schedule-engine';
import { StorageProvider } from '../storage/plan-repository';
import { PlanStore } from '../storage/plan-store';
import { validatePlanId } from '../validation';
import { DEFAULT_COLUMN_WIDTHS, engineInputs, getTimelineWeeks, gridFor, isMainPlan, openStore, resolveStorage, todayIso } from './core';
import { LiveData, fetchProjectUsers, fetchRawIssues, loadLive, mapLiveIssues } from './jira-read';

/**
 * Runs the one-time migration from the legacy keys, using live Jira ids for the new records.
 */
export async function migrateIfNeeded(store: PlanStore, projectKey: string): Promise<void> {
  const settings = await store.getSettings();
  if (settings.migratedAt && settings.modelVersion === WORK_EFFORT_MODEL) return;
  const [raw, users] = await Promise.all([fetchRawIssues(projectKey), fetchProjectUsers(projectKey)]);
  const live = mapLiveIssues(raw, {});
  const idByKey = new Map<string, string>();
  const blockedBy = new Map<string, string[]>();
  for (const t of [...live.tasks, ...live.backlogTasks]) {
    idByKey.set(t.key, t.id);
    blockedBy.set(t.key, (t.jiraBlockedBy || []).map(b => b.key));
  }
  const today = todayIso();
  // Links and people of an old entry in the B-28 model; everything else is kept as it is.
  const convert = (issueKey: string, old: Partial<WbsTask>): Partial<WbsTask> => {
    const rest: Partial<WbsTask> = { ...old };
    delete rest.dependency;
    delete rest.contributingResources;
    delete rest.model;
    return { ...rest, ...migrateEntry(old, users, blockedBy.get(issueKey) || [], today) };
  };
  if (!settings.migratedAt) await store.ensureMigrated(idByKey, convert);
  // B-28: rewrite each model 1 record once, under the version check; nothing is deleted.
  for (const [issueKey, entry] of await store.loadEntries()) {
    if (entry.model !== 1) continue;
    const { issueKey: _k, issueId, version, ...old } = entry;
    await store.putEntry(issueKey, issueId, convert(issueKey, old), version);
  }
  await store.saveSettings({ modelVersion: WORK_EFFORT_MODEL });
}

/** The JQL filter of a plan, or undefined (F-27). */
export async function planFilterOf(storage: StorageProvider, projectKey: string, projectId: string | undefined, planId?: string): Promise<string | undefined> {
  return (await openStore(storage, projectKey, projectId, planId).getSettings()).jqlFilter || undefined;
}

/**
 * Retrieves the complete project plan state.
 */
export async function getProjectPlan(
  projectKey: string,
  storageProvider?: StorageProvider,
  referenceDate: Date = new Date(),
  siteUrl?: string,
  projectId?: string,
  preloaded?: LiveData,
  planId?: string,
  reconcileIds: string[] = []
): Promise<ProjectPlanState> {
  const storage = resolveStorage(storageProvider);
  validatePlanId(planId);
  const availablePlans = await openStore(storage, projectKey, projectId).listPlans();
  // A plan id that is not listed (deleted, or a stale id saved by the browser) reads the Main Plan;
  // the returned planId tells the client which plan it got.
  // A plan that is still being copied or deleted is not opened either (N-02).
  if (!isMainPlan(planId) && !availablePlans.some(p => p.id === planId && !p.state)) planId = undefined;
  const store = openStore(storage, projectKey, projectId, planId);
  if (isMainPlan(planId)) await migrateIfNeeded(store, projectKey);

  const dynamicTimeline = getTimelineWeeks(referenceDate);
  const activeWeeks = dynamicTimeline.weeks;

  // getProjectPlan only reads; it writes nothing to KVS (INV-07).
  const entries = await store.loadEntries();
  const storedScheduleMap: Record<string, Partial<WbsTask>> = Object.fromEntries(entries);
  const settings = await store.getSettings();
  const storedMilestones = settings.milestones || [];
  const storedWidths = settings.columnWidths || DEFAULT_COLUMN_WIDTHS;
  const storedHiddenColumns = settings.hiddenColumns || [];

  // Query live Jira issues and assignees (once per resolver call when preloaded)
  const live = preloaded || await loadLive(projectKey, reconcileIds, settings.jqlFilter || undefined);
  const liveData = mapLiveIssues(live.raw, storedScheduleMap);
  const availableUsers = [...live.users];
  const availableEpics = [...live.epics];

  let tasks = liveData.tasks;
  const backlogTasks = liveData.backlogTasks;

  // An entry Jira did not return is not shown. When the Jira read worked and was complete it is listed, so the
  // client can say that some planned issues are not visible. Records are deleted only by the issue-deleted trigger (BL-9).
  const liveKeys = new Set([...tasks, ...backlogTasks].map(t => t.key));
  // With a plan filter, a record outside the filter is expected, not stale (F-27).
  const staleEntries = !liveData.isLive || liveData.truncated || settings.jqlFilter ? [] : [...entries.keys()].filter(k => !liveKeys.has(k)).sort();

  // Second people are stored by account id; their names are read live from Jira (B-28, INV-04).
  for (const t of tasks) {
    if (t.contributors) t.contributingResources = contributorNames(t.contributors, availableUsers);
  }
  // A parent's dates are derived from its dated children on every load, never stored (B-28). A parent
  // with a dated child is on the timeline even with no record of its own, and so is its own parent
  // (N-06 rule 4).
  for (let pass = 0; pass < 4; pass++) {
    let added = false;
    for (const [key, span] of rollUpParentDates(tasks)) {
      let parent = tasks.find(t => t.key === key);
      if (!parent) {
        // Epics stay in the backlog until scheduled (B-05; epic blocks come later, DEC-5b).
        const idx = backlogTasks.findIndex(t => t.key === key && !t.isEpic && t.hierarchyLevel !== 1);
        if (idx === -1) continue;
        parent = backlogTasks.splice(idx, 1)[0];
        parent.isBacklog = false;
        tasks.push(parent);
        added = true;
      }
      Object.assign(parent, span, gridFor(activeWeeks, span.startDate, span.endDate), { datesFromChildren: true });
    }
    if (!added) break;
  }

  // Evaluate every dependency with the schedule engine: earliest start, reason, driver, fix (B-11).
  const engine = engineInputs(tasks);
  // The reference date given by a caller wins; otherwise the request's today (F-29).
  const today = referenceDate && Math.abs(referenceDate.getTime() - Date.now()) > 60000 ? todayIso(referenceDate) : todayIso();
  for (const t of tasks) {
    if (t.dependency) {
      const ev = evaluateEffort(t.key, engine.efforts, engine.links, today);
      t.dependency.isTriggerSatisfied = ev.earliestStartDate === null && !ev.violated;
      t.dependency.isViolated = ev.violated;
      t.dependency.violationReason = ev.violated ? (ev.suggestion || ev.reason || undefined) : undefined;
      t.dependency.earliestStartDate = ev.earliestStartDate || undefined;
      t.dependency.earliestStartReason = ev.reason || undefined;
      t.dependency.driverKey = ev.driver || undefined;
      t.dependency.fixSuggestion = ev.suggestion;
      t.dependency.triggerDate = ev.triggerDate || undefined;
      t.dependency.fixOptions = ev.fixes;
    }
  }

  // Order rows by the stored sequence number; rows without one keep Jira's order after them.
  const position = new Map(tasks.map((t, i) => [t.key, i]));
  const seqOf = (k: string) => {
    const s = entries.get(k)?.sequenceNum;
    return typeof s === 'number' ? s : Number.POSITIVE_INFINITY;
  };
  tasks.sort((a, b) => (seqOf(a.key) - seqOf(b.key)) || ((position.get(a.key) as number) - (position.get(b.key) as number)));
  tasks = PlannerEngine.buildWbsHierarchy(tasks, activeWeeks);
  tasks.forEach((t, i) => { t.orderIndex = i; });

  // Merge any Epics from tasks into availableEpics
  for (const t of tasks) {
    if (t.isEpic && !availableEpics.some(e => e.key === t.key)) {
      availableEpics.push({ id: t.id, key: t.key, summary: t.summary });
    }
  }

  const { actualCompletion, targetCompletion } = PlannerEngine.calculateProjectCompletion(tasks);

  const planState: ProjectPlanState = {
    planId: planId || 'default',
    projectKey,
    projectName: `Project ${projectKey}`,
    overallProjectCompletion: actualCompletion,
    overallTargetCompletion: targetCompletion,
    weeks: activeWeeks,
    tasks,
    backlogTasks,
    milestones: storedMilestones,
    columnWidths: storedWidths,
    hiddenColumns: storedHiddenColumns,
    availableEpics,
    availableUsers,
    availablePlans,
    hasEpic: live.hasEpic !== undefined ? live.hasEpic : (availableEpics.length > 0),
    lastUpdated: new Date().toISOString(),
    isLiveSynced: liveData.isLive,
    jiraStatus: liveData.isLive ? undefined : (live.raw.status ?? 0),
    truncated: liveData.truncated,
    jqlFilter: settings.jqlFilter || undefined,
    staleEntries,
    siteUrl: siteUrl || (process.env.JIRA_BASE_URL || undefined)
  };

  return planState;
}
