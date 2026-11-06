/*
 * Copyright (c) 2026 Asymm Systems. All rights reserved.
 *
 * @author Fahim Farook
 */

/**
 * CascadePlan server: Reads from Jira as the user: issues (with the plan filter), users, epics, due dates, issue types; mapping of the search results.
 * Split from src/index.ts without changes to any statement (F-31).
 */

import api, { route } from '@forge/api';
import { ProjectPlanState, WbsTask, WeeklySprintColumn, TaskDependency, JiraAssignableUser, JiraEpicItem, SubtaskItem } from '../domain/models';
import { PlannerEngine } from '../domain/planner-engine';
import { dependenciesFromJira } from '../domain/work-effort-links';
import { addDays } from '../domain/schedule-engine';
import { planJql } from '../domain/plan-filter';
import { logFailure } from '../logger';
import { DATES_PROPERTY, LINKS_PROPERTY, getDefaultWeeks, getJiraCaller, gridFor, isIsoDate } from './core';
import { shownProgress } from '../ui/progress-status';

/**
 * Maps Jira status category to standard TaskStatus.
 */
export function mapJiraStatus(statusCategoryKey?: string, statusName?: string): 'NOT_STARTED' | 'IN_PROGRESS' | 'COMPLETED' {
  const normCategory = String(statusCategoryKey || '').toLowerCase();
  const normName = String(statusName || '').toLowerCase();

  if (normCategory === 'done' || normName.includes('done') || normName.includes('resolved') || normName.includes('closed')) {
    return 'COMPLETED';
  }
  if (normCategory === 'indeterminate' || normName.includes('progress') || normName.includes('review') || normName.includes('testing')) {
    return 'IN_PROGRESS';
  }
  return 'NOT_STARTED';
}

export const UNASSIGNED_USER: JiraAssignableUser = {
  accountId: 'unassigned',
  displayName: 'Unassigned',
  isPlaceholder: false
};

/**
 * Fetches the real Jira project assignees, plus "Unassigned" (B-18: no placeholder people).
 */
/** Assignable users read per page, and the most pages read (1,000 users; F-27). */
export const USER_PAGE_SIZE = 50;
export const MAX_USER_PAGES = 20;

export async function fetchProjectUsers(projectKey: string): Promise<JiraAssignableUser[]> {
  const realUsers: JiraAssignableUser[] = [];
  const seen = new Set<string>();
  try {
    // Jira returns at most one page per call; a short page is the last one.
    for (let page = 0; page < MAX_USER_PAGES; page++) {
      const startAt = page * USER_PAGE_SIZE;
      const res = await getJiraCaller().requestJira(route`/rest/api/3/user/assignable/search?project=${projectKey}&startAt=${startAt}&maxResults=${USER_PAGE_SIZE}`);
      if (res.status !== 200) break;
      const data: any[] = await res.json();
      for (const u of data) {
        if (u.accountId && u.displayName && !seen.has(u.accountId)) {
          seen.add(u.accountId);
          realUsers.push({
            accountId: u.accountId,
            displayName: u.displayName,
            avatarUrl: u.avatarUrls?.['24x24'] || u.avatarUrls?.['48x48'],
            isPlaceholder: false
          });
        }
      }
      if (!Array.isArray(data) || data.length < USER_PAGE_SIZE) break;
    }
  } catch (err) { logFailure('fetchProjectUsers', err); }
  return [UNASSIGNED_USER, ...realUsers];
}

/**
 * Fetches real Jira project Epics.
 */
export async function fetchProjectEpics(projectKey: string): Promise<JiraEpicItem[]> {
  const epics: JiraEpicItem[] = [];
  try {
    let res = await getJiraCaller().requestJira(
      route`/rest/api/3/search/jql?jql=project = "${projectKey}" AND issuetype in (Epic, "Initiative") order by created desc&fields=summary,status&maxResults=50`
    );
    if (!res || res.status !== 200) {
      res = await getJiraCaller().requestJira(
        route`/rest/api/3/search/jql?jql=project = "${projectKey}" AND issuetype = "Epic" order by created desc&fields=summary,status&maxResults=50`
      );
    }
    if (res && res.status === 200) {
      const data = await res.json();
      for (const iss of data.issues || []) {
        epics.push({
          id: String(iss.id),
          key: String(iss.key),
          summary: iss.fields?.summary || iss.key
        });
      }
    }
  } catch (err) { logFailure('fetchProjectEpics', err); }
  return epics;
}

/**
 * Fetches authentic Jira issues and maps them into scheduled tasks and backlog tray.
 */
export const PAGE_SIZE = 100;
export const MAX_PAGES = 10;

export interface RawIssues {
  issues: any[];
  isLive: boolean;
  status?: number; // Jira's HTTP status when the search failed (0 for no answer), F-21
  truncated?: { shown: number; total: number };
}

/**
 * Reads the project's issues page by page (nextPageToken), up to MAX_PAGES pages. When more
 * pages remain, reports how many were shown and Jira's approximate total (B-10).
 */
export async function fetchRawIssues(projectKey: string, reconcileIds: string[] = [], filter?: string): Promise<RawIssues> {
  const caller = getJiraCaller();
  // The plan's filter narrows the project (F-27); route encodes the whole JQL as one query value.
  const scope = planJql(projectKey, filter);
  const jql = `${scope} order by created desc`;
  // Issues written a moment ago: the search is eventually consistent, so it is asked for read-after-
  // write on them (at most 50, repeated parameter; F-03 part 3).
  const ids = [...new Set(reconcileIds.filter(id => /^\d+$/.test(id)))].slice(0, 50);
  const reconcile = new URLSearchParams();
  for (const id of ids) reconcile.append('reconcileIssues', id);
  const issues: any[] = [];
  let token: string | undefined;
  let pages = 0;
  try {
    do {
      const res = ids.length
        ? (token
          ? await caller.requestJira(route`/rest/api/3/search/jql?jql=${jql}&fields=summary,status,issuetype,assignee,timeoriginalestimate,aggregatetimeoriginalestimate,timespent,aggregatetimespent,duedate,parent,subtasks,epic,issuelinks&properties=cascadeplan.dates,cascadeplan.links&maxResults=100&nextPageToken=${token}&${reconcile}`)
          : await caller.requestJira(route`/rest/api/3/search/jql?jql=${jql}&fields=summary,status,issuetype,assignee,timeoriginalestimate,aggregatetimeoriginalestimate,timespent,aggregatetimespent,duedate,parent,subtasks,epic,issuelinks&properties=cascadeplan.dates,cascadeplan.links&maxResults=100&${reconcile}`))
        : (token
          ? await caller.requestJira(route`/rest/api/3/search/jql?jql=${jql}&fields=summary,status,issuetype,assignee,timeoriginalestimate,aggregatetimeoriginalestimate,timespent,aggregatetimespent,duedate,parent,subtasks,epic,issuelinks&properties=cascadeplan.dates,cascadeplan.links&maxResults=100&nextPageToken=${token}`)
          : await caller.requestJira(route`/rest/api/3/search/jql?jql=${jql}&fields=summary,status,issuetype,assignee,timeoriginalestimate,aggregatetimeoriginalestimate,timespent,aggregatetimespent,duedate,parent,subtasks,epic,issuelinks&properties=cascadeplan.dates,cascadeplan.links&maxResults=100`));
      if (!res || res.status !== 200) {
        logFailure('fetchRawIssues', res || new Error('no answer'));
        if (pages === 0) return { issues: [], isLive: false, status: res ? res.status : 0 };
        break;
      }
      const data = await res.json();
      issues.push(...(data.issues || []));
      pages++;
      token = data.isLast ? undefined : data.nextPageToken;
    } while (token && pages < MAX_PAGES);
  } catch (err) {
    logFailure('fetchRawIssues', err);
    if (pages === 0) return { issues: [], isLive: false, status: 0 };
  }
  if (!token) return { issues, isLive: true };
  let total = issues.length;
  try {
    const res = await caller.requestJira(route`/rest/api/3/search/approximate-count`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ jql: scope })
    });
    if (res && res.status === 200) total = Math.max(total, Number((await res.json()).count) || total);
  } catch (err) { logFailure('fetchRawIssues', err); }
  return { issues, isLive: true, truncated: { shown: issues.length, total } };
}

/**
 * Asks Jira whether a plan filter is valid JQL and how many issues it matches (F-27). Jira's JQL parser
 * checks it in strict mode: the issue search answers an unknown field with no issues, not an error.
 * Jira's own messages are returned when Jira refuses the JQL.
 */
export async function testPlanFilter(projectKey: string, filter: string): Promise<{ ok: boolean; count?: number; message?: string }> {
  const caller = getJiraCaller();
  const scope = planJql(projectKey, filter);
  try {
    const res = await caller.requestJira(route`/rest/api/3/jql/parse?validation=strict`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ queries: [scope] })
    });
    let body: any;
    try { body = await res.json(); } catch { body = undefined; }
    const errors: string[] = [
      ...((res && res.status === 200 ? body?.queries?.[0]?.errors : body?.errorMessages) || []),
      ...Object.values((res && res.status !== 200 && body?.errors) || {})
    ].filter((e): e is string => typeof e === 'string' && e.length > 0);
    if (errors.length) return { ok: false, message: `Jira did not accept the filter: ${errors.join(' ')}` };
    if (!res || res.status !== 200) return { ok: false, message: `Jira did not accept the filter (HTTP ${res ? res.status : 0}).` };
    const count = await caller.requestJira(route`/rest/api/3/search/approximate-count`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ jql: scope })
    });
    if (count && count.status === 200) return { ok: true, count: Number((await count.json()).count) || 0 };
    return { ok: true };
  } catch (err) {
    logFailure('testPlanFilter', err);
    return { ok: false, message: 'Jira did not answer. Try again.' };
  }
}

export async function fetchLiveJiraIssues(
  projectKey: string,
  storedScheduleMap: Record<string, Partial<WbsTask>> = {}
): Promise<{ tasks: WbsTask[]; backlogTasks: WbsTask[]; isLive: boolean; truncated?: { shown: number; total: number } }> {
  const raw = await fetchRawIssues(projectKey);
  return mapLiveIssues(raw, storedScheduleMap);
}

/**
 * Jira's search index can lag behind a create. An issue Jira has just confirmed (HTTP 201) is added to
 * the returned plan from its stored record until the search returns it; other entries Jira did not
 * return stay hidden (B-18).
 */
export function includeCreated(plan: ProjectPlanState, entry: Partial<WbsTask> | undefined, issue: Partial<WbsTask> & { id: string; key: string }, targetIndex?: number): WbsTask {
  const found = plan.tasks.find(t => t.key === issue.key);
  if (found) return found;
  const task: WbsTask = {
    epic: '', story: 'Task', storyKey: issue.key, effortHours: 0, resource: 'Unassigned', progress: 0, targetProgress: 0,
    status: 'NOT_STARTED', startDate: '', endDate: '', spanWeeks: 1, subtasks: [], hierarchyLevel: 0, summary: issue.key,
    ...(entry ? fromStoredEntry(entry) : {}), ...issue
  } as WbsTask;
  const at = typeof targetIndex === 'number' ? Math.max(0, Math.min(plan.tasks.length, targetIndex)) : plan.tasks.length;
  plan.tasks.splice(at, 0, task);
  plan.staleEntries = (plan.staleEntries || []).filter(k => k !== issue.key);
  return task;
}

export function fromStoredEntry(entry: Partial<WbsTask>): Partial<WbsTask> {
  const { startDate, endDate, startWeek, endWeek, spanWeeks, weeklyAllocations, version } = entry;
  return Object.fromEntries(Object.entries({ startDate, endDate, startWeek, endWeek, spanWeeks, weeklyAllocations, version }).filter(([, v]) => v !== undefined));
}

/**
 * Dates of an entry stored with only a week key (older records): the first day of that week and whole
 * weeks from it, from the weeks of this call. No date when the week is not known (B-18: no defaults).
 */
export function weekDates(stored: Partial<WbsTask> | undefined, weeks: WeeklySprintColumn[]): { startDate: string; endDate: string } {
  const w = stored && stored.startWeek ? weeks.find(x => x.weekKey === stored.startWeek) : undefined;
  if (!w) return { startDate: '', endDate: '' };
  return { startDate: w.startDate, endDate: addDays(w.startDate, (stored!.spanWeeks || 1) * 7 - 1) };
}

/**
 * Merges raw Jira issues with the stored planning records into scheduled tasks and backlog.
 */
export function mapLiveIssues(
  raw: RawIssues,
  storedScheduleMap: Record<string, Partial<WbsTask>> = {}
): { tasks: WbsTask[]; backlogTasks: WbsTask[]; isLive: boolean; truncated?: { shown: number; total: number } } {
  try {
    if (raw.isLive) {
  const weeksNow = getDefaultWeeks(); // computed per call (B-18)
      const rawIssues: any[] = raw.issues;

      const issueByKey = new Map<string, any>();
      for (const iss of rawIssues) {
        issueByKey.set(String(iss.key), iss);
      }

      const tasks: WbsTask[] = [];
      const backlogTasks: WbsTask[] = [];

      for (const iss of rawIssues) {
        const key = String(iss.key);
        const id = String(iss.id);
        const summary = iss.fields?.summary || key;
        const typeName = iss.fields?.issuetype?.name || 'Task';
        const rawHierarchyLevel = iss.fields?.issuetype?.hierarchyLevel;
        let hierarchyLevel: number = 0;
        if (typeof rawHierarchyLevel === 'number') {
          hierarchyLevel = rawHierarchyLevel > 0 ? 1 : (rawHierarchyLevel < 0 ? -1 : 0);
        } else if (iss.fields?.issuetype?.subtask) {
          hierarchyLevel = -1;
        } else if (typeName.toLowerCase() === 'epic') {
          hierarchyLevel = 1;
        }

        const isEpic = hierarchyLevel === 1;
        const isSubtask = hierarchyLevel === -1;

        // Resolve parent issue details from raw issues map
        const directParentKey = iss.fields?.parent?.key;
        const parentIssue = directParentKey ? issueByKey.get(directParentKey) : undefined;
        const parentType = iss.fields?.parent?.fields?.issuetype?.name || parentIssue?.fields?.issuetype?.name || '';
        const parentLevel = iss.fields?.parent?.fields?.issuetype?.hierarchyLevel ?? parentIssue?.fields?.issuetype?.hierarchyLevel;
        const isParentEpic = parentLevel === 1 || parentType.toLowerCase() === 'epic';

        let epicKey: string | undefined = undefined;
        let epicName: string = '';

        if (isEpic) {
          epicKey = key;
          epicName = summary;
        } else if (isParentEpic) {
          epicKey = directParentKey;
          epicName = iss.fields?.parent?.fields?.summary || parentIssue?.fields?.summary || (epicKey ? String(epicKey) : '');
        } else if (iss.fields?.epic?.name || iss.fields?.epic?.summary) {
          epicKey = iss.fields.epic.key;
          epicName = iss.fields.epic.name || iss.fields.epic.summary || '';
        } else if (isSubtask && directParentKey) {
          // If subtask, inherit epic from its parent task if present
          const parentIss = parentIssue || issueByKey.get(directParentKey);
          const pParentKey = parentIss?.fields?.parent?.key;
          const pParentIss = pParentKey ? issueByKey.get(pParentKey) : undefined;
          const pType = parentIss?.fields?.parent?.fields?.issuetype?.name || pParentIss?.fields?.issuetype?.name || '';
          const pLevel = parentIss?.fields?.parent?.fields?.issuetype?.hierarchyLevel ?? pParentIss?.fields?.issuetype?.hierarchyLevel;
          if (pLevel === 1 || pType.toLowerCase() === 'epic') {
            epicKey = pParentKey || parentIss?.fields?.parent?.key;
            epicName = parentIss?.fields?.parent?.fields?.summary || pParentIss?.fields?.summary || (epicKey ? String(epicKey) : '');
          } else if (parentIss?.fields?.epic?.name || parentIss?.fields?.epic?.summary) {
            epicKey = parentIss.fields.epic.key;
            epicName = parentIss.fields.epic.name || parentIss.fields.epic.summary || '';
          }
        }

        const parentKey = isEpic ? undefined : directParentKey;
        const parentId = isEpic ? undefined : (iss.fields?.parent?.id ? String(iss.fields.parent.id) : undefined);

        const status = mapJiraStatus(iss.fields?.status?.statusCategory?.key, iss.fields?.status?.name);

        const rawSeconds = iss.fields?.timeoriginalestimate || 0;
        const effortHours = rawSeconds > 0 ? Math.round(rawSeconds / 3600) : 0;
        // Spec 3.3 item 9 (F-25): a leaf uses its own time spent and estimate; a parent with sub-tasks
        // uses the aggregates, so time logged on sub-tasks is measured against the whole estimate.
        const isParent = Array.isArray(iss.fields?.subtasks) && iss.fields.subtasks.length > 0;
        const spent = isParent ? (iss.fields?.aggregatetimespent || 0) : (iss.fields?.timespent ?? iss.fields?.aggregatetimespent ?? 0);
        const estimate = isParent ? (iss.fields?.aggregatetimeoriginalestimate || rawSeconds) : rawSeconds;

        let progress = 0;
        if (status === 'COMPLETED') {
          progress = 100;
        } else if (estimate > 0 && spent > 0) {
          progress = Math.min(100, Math.round((spent / estimate) * 100));
        }

        const subtasks: SubtaskItem[] = (iss.fields?.subtasks || []).map((sub: any) => ({
          id: String(sub.id),
          key: String(sub.key),
          summary: sub.fields?.summary || 'Subtask',
          estimateValue: 0,
          estimateUnit: 'HOURS' as const,
          normalizedHours: 0,
          status: mapJiraStatus(sub.fields?.status?.statusCategory?.key, sub.fields?.status?.name)
        }));

        const stored = storedScheduleMap[key] || storedScheduleMap[id];

        // The dependencies are the Jira "Blocks" links, the same in every plan; the trigger percent is
        // the issue property cascadeplan.links (ADR-006, N-11 L3 to L5).
        const jiraBlockedBy = (Array.isArray(iss.fields?.issuelinks) ? iss.fields.issuelinks : [])
          .filter((link: any) => ['blocks', 'dependency'].includes(String(link.type?.name || '').toLowerCase()) && link.inwardIssue?.key)
          .map((link: any) => ({ key: String(link.inwardIssue.key), id: String(link.inwardIssue.id || link.inwardIssue.key), ...(link.id ? { linkId: String(link.id) } : {}) }));
        const storedLinks = stored?.dependencies || (stored?.dependency ? [stored.dependency] : []);
        const percents = iss.properties?.[LINKS_PROPERTY]?.links;
        const liveDependencies: TaskDependency[] = dependenciesFromJira(jiraBlockedBy, percents && typeof percents === 'object' ? percents : {}, storedLinks);
        const liveDependency: TaskDependency | undefined = liveDependencies[0];

        // The sub-tasks are Jira's (ADR-004, F-23). Sub-tasks stored only in a plan record by an
        // earlier build never hide them; they are listed for the user to create in Jira or drop.
        const finalSubtasks: SubtaskItem[] = subtasks;
        const localSubtasks: SubtaskItem[] | undefined = stored?.subtasks && stored.subtasks.length > 0
          ? stored.subtasks.filter((s: SubtaskItem) => !s.key) : undefined;

        const calculatedEffortConfig = PlannerEngine.calculateEffortWithSubtasksAndBuffer({
          unit: 'HOURS',
          rawEstimate: effortHours,
          subtasks: finalSubtasks,
          bufferType: 'NONE'
        });

        const effortConfig = stored?.effortConfig || calculatedEffortConfig;
        // The estimate is Jira's original estimate, read live (INV-04).
        const totalHours = effortHours;

        // Jira is the single truth for a task's dates. A scheduled task ends on the Jira due date in
        // every plan, also when someone changed it directly in Jira. The start date has no standard Jira
        // field, so it is the one shared by every plan; it moves only when it would fall after the end.
        // ADR-008: the shared start (and a planner-only end) is the Jira issue property cascadeplan.dates,
        // the same in every plan. Without it, the plan's own record still holds them (lazy migration).
        // A property without a start marks a task taken off the timeline: it wins over an older plan record.
        const prop = iss.properties?.[DATES_PROPERTY];
        const hasProp = !!prop && typeof prop === 'object';
        const propStart = isIsoDate(prop?.startDate) ? String(prop.startDate).slice(0, 10) : undefined;
        const propEnd = isIsoDate(prop?.endDate) ? String(prop.endDate).slice(0, 10) : undefined;
        const scheduled = hasProp ? !!propStart : !!stored?.startWeek;
        const savedStart = propStart || stored?.startDate || weekDates(stored, weeksNow).startDate;
        const savedEnd = propEnd || stored?.endDate || weekDates(stored, weeksNow).endDate;
        const jiraDue = isIsoDate(iss.fields?.duedate) ? String(iss.fields.duedate).slice(0, 10) : undefined;
        const endFromJira = scheduled && !!jiraDue && jiraDue !== savedEnd && weeksNow.length > 0;
        const taskEnd = endFromJira ? jiraDue! : (savedEnd || iss.fields?.duedate || '');
        const taskStart = endFromJira && (!isIsoDate(savedStart) || savedStart > jiraDue!) ? jiraDue! : savedStart;
        // The week grid follows the dates on every read, so stored week keys of any earlier grid
        // (before F-29 weeks started on Wednesday) never place a bar (F-29, migration by derivation).
        const jiraGrid = scheduled && weeksNow.length > 0 && isIsoDate(taskStart) && isIsoDate(taskEnd) ? gridFor(weeksNow, taskStart, taskEnd) : undefined;
        const autoTarget = PlannerEngine.calculateTargetProgress(taskStart, taskEnd);
        const targetProgress = stored?.manualTargetProgress === true && stored.targetProgress !== undefined
          ? stored.targetProgress
          : autoTarget;

        const wbsItem: WbsTask = {
          id,
          key,
          summary,
          epic: epicName,
          epicKey,
          story: typeName,
          storyKey: key,
          effortHours: totalHours,
          effortConfig,
          resource: iss.fields?.assignee?.displayName || 'Unassigned',
          resourceAccountId: iss.fields?.assignee?.accountId || undefined,
          contributingResources: stored?.contributingResources,
          // Done always shows 100%; a manual value is kept and applies again when the item is reopened.
          progress: shownProgress(status, stored?.manualProgress === true ? stored.progress : undefined, progress),
          targetProgress,
          manualProgress: stored?.manualProgress,
          manualTargetProgress: stored?.manualTargetProgress,
          status,
          startDate: taskStart,
          endDate: taskEnd,
          // The due date Jira holds, read live: the old value in the Changes panel (B-23).
          jiraDueDate: iss.fields?.duedate || undefined,
          startWeek: !scheduled ? undefined : jiraGrid ? jiraGrid.startWeek : stored?.startWeek,
          endWeek: jiraGrid ? jiraGrid.endWeek : stored?.endWeek,
          spanWeeks: jiraGrid ? jiraGrid.spanWeeks! : (stored?.spanWeeks || 3),
          weeklyAllocations: jiraGrid ? jiraGrid.weeklyAllocations : stored?.weeklyAllocations,
          dependency: liveDependency,
          dependencies: liveDependencies.length ? liveDependencies : undefined,
          endedLinks: stored?.endedLinks,
          contributors: stored?.contributors,
          jiraBlockedBy: jiraBlockedBy.length ? jiraBlockedBy : undefined,
          model: stored?.model,
          subtasks: finalSubtasks,
          ...(localSubtasks && localSubtasks.length ? { localSubtasks } : {}),
          isSubtask,
          isEpic,
          hierarchyLevel,
          parentKey,
          parentId,
          // The record version the client sends back as expectedVersion; 0 when nothing is stored yet.
          version: stored?.version ?? 0
        };

        if (wbsItem.startWeek) {
          tasks.push(wbsItem);
        } else {
          wbsItem.isBacklog = true;
          backlogTasks.push(wbsItem);
        }
      }

      return { tasks, backlogTasks, isLive: true, truncated: raw.truncated };
    }
  } catch (err) { logFailure('mapLiveIssues', err); }

  return { tasks: [], backlogTasks: [], isLive: false };
}

export interface LiveData {
  raw: RawIssues;
  users: JiraAssignableUser[];
  epics: JiraEpicItem[];
  hasEpic?: boolean;
}

/** One read of everything a plan needs from Jira. */
export async function loadLive(projectKey: string, reconcileIds: string[] = [], filter?: string): Promise<LiveData> {
  const [raw, users, epics] = await Promise.all([fetchRawIssues(projectKey, reconcileIds, filter), fetchProjectUsers(projectKey), fetchProjectEpics(projectKey)]);
  let hasEpic = epics.length > 0;
  if (!hasEpic) {
    const meta = await resolveProjectIssueType(projectKey, 'Epic');
    hasEpic = Boolean(meta && meta.id);
  }
  return { raw, users, epics, hasEpic };
}

/** The issue's Jira due date as the user sees it, or undefined when it has none or Jira cannot say. */
export async function readJiraDueDate(issueKey: string): Promise<string | undefined> {
  try {
    const res = await getJiraCaller().requestJira(route`/rest/api/3/issue/${issueKey}?fields=duedate`);
    if (!res || res.status !== 200) return undefined;
    const due = (await res.json())?.fields?.duedate;
    return isIsoDate(due) ? String(due).slice(0, 10) : undefined;
  } catch {
    return undefined;
  }
}

/**
 * Resolves valid Jira issue type metadata (id and name) dynamically for a project.
 * Handles company-managed and team-managed schemes to avoid "Specify a valid issue type".
 */
export async function resolveProjectIssueType(
  projectKey: string,
  kind: 'Epic' | 'Task'
): Promise<{ id?: string; name: string }> {
  try {
    const caller = getJiraCaller();
    const projRes = await caller.requestJira(route`/rest/api/3/project/${projectKey}`);
    if (projRes && projRes.status === 200) {
      const projData = await projRes.json();
      const issueTypes: any[] = projData?.issueTypes || [];
      if (kind === 'Epic') {
        const found = issueTypes.find(it =>
          it.hierarchyLevel === 1 ||
          it.name?.toLowerCase() === 'epic' ||
          it.name?.toLowerCase() === 'feature' ||
          it.name?.toLowerCase() === 'initiative'
        );
        if (found) {
          return { id: String(found.id), name: found.name };
        }
      } else {
        const found = issueTypes.find(it =>
          !it.subtask &&
          it.hierarchyLevel !== 1 &&
          (it.name?.toLowerCase() === 'task' || it.name?.toLowerCase() === 'story' || it.name?.toLowerCase() === 'item')
        );
        if (found) {
          return { id: String(found.id), name: found.name };
        }
      }
    }
  } catch (err) {
    // Fallback to standard defaults if metadata call is unavailable
  }
  return { name: kind };
}

/**
 * Id of the "Blocks" link from the predecessor to the successor, if Jira has one.
 */
export async function findBlocksLinkId(successorKey: string, predecessorKey: string): Promise<string | undefined> {
  try {
    const res = await getJiraCaller().requestJira(route`/rest/api/3/issue/${successorKey}?fields=issuelinks`);
    if (res && res.status === 200) {
      const data = await res.json();
      const link = (data?.fields?.issuelinks || []).find((l: any) =>
        String(l.type?.name || '').toLowerCase() === 'blocks' && l.inwardIssue?.key === predecessorKey);
      return link ? String(link.id) : undefined;
    }
  } catch (err) { logFailure('findBlocksLinkId', err); }
  return undefined;
}

/** The Jira due date of one issue, read with reconcileIssues (C3); null when it has none, undefined when Jira does not say. */
export async function currentJiraDueDate(key: string, id: string | undefined): Promise<string | null | undefined> {
  try {
    const params = new URLSearchParams({ jql: `key = ${key}`, fields: 'duedate' });
    if (id && /^\d+$/.test(id)) params.append('reconcileIssues', id);
    const res = await getJiraCaller().requestJira(route`/rest/api/3/search/jql?${params}`);
    if (!res || res.status !== 200) return undefined;
    const issue = ((await res.json())?.issues || [])[0];
    if (!issue) return undefined;
    const due = issue.fields?.duedate;
    return isIsoDate(due) ? String(due).slice(0, 10) : null;
  } catch (err) {
    logFailure('currentJiraDueDate', err);
    return undefined;
  }
}
