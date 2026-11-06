/*
 * Copyright (c) 2026 Asymm Systems. All rights reserved.
 *
 * @author Fahim Farook
 */

/**
 * CascadePlan: the Forge entry point. It registers every resolver with its permission rule (BL-2),
 * the admin resolvers, the issue-deleted trigger and the personal data report. The resolvers
 * themselves are in src/server/ (F-31): core, jira-read, plan-read, jira-write, tasks, create,
 * hierarchy, block-moves, plans, request and baselines.
 */

import api from '@forge/api';
import Resolver from '@forge/resolver';
import { forbiddenResult, PermissionCheckError, ForbiddenError } from './security/write-permissions';
import { ValidationError, reconcileIdsOf } from './validation';
import { getApproverPolicyFlow, searchGroupsFlow, setApproverPolicyFlow, isPlanApprover, APPROVER_REQUIRED_MESSAGE } from './security/policy-admin';
import { baselineStatusFor, compareBaselines, exportBaseline, freezePlanBaseline, getPlanBaselines, getScopeCreepReport, requestScopeShift, reviewScopeShift, setActiveBaseline } from './server/baselines';
import { continueBlockMove, moveTaskGroup } from './server/block-moves';
import { resolveStorage, withClientToday } from './server/core';
import { addSubtaskToTask, createInlineTask, createJiraEpic, createSubtaskForResource, resolveLocalSubtasks } from './server/create';
import { changeParent, checkConversion, convertIssueType } from './server/hierarchy';
import { getProjectPlan } from './server/plan-read';
import { continuePlanCopy, continuePlanDelete, createProjectPlan, deleteProjectPlan, renameProjectPlan, setPlanFilter } from './server/plans';
import { extractProjectId, extractProjectKey, extractSiteUrl, withResolverHandler } from './server/request';
import { batchUpdateTasks, continueCascade, issueDeleted, reorderWbsTasks, saveColumnWidths, saveHiddenColumns, scheduleBacklogTask, unscheduleTask, updateWbsTask } from './server/tasks';

// Everything the modules export stays importable from src/index (tests, triggers) (F-31).
export * from './server/core';
export * from './server/plan-read';
export * from './server/jira-read';
export * from './server/plans';
export * from './server/tasks';
export * from './server/jira-write';
export * from './server/create';
export * from './server/hierarchy';
export * from './server/block-moves';
export * from './server/request';
export * from './server/baselines';

export { CURRENT_WEEK_INDEX } from './domain/models';
// Manifest handlers are exported by name here, where forge lint and the Forge runtime look for them.
export { personalDataTrigger } from './server/baselines';

// Register Forge Resolvers
const resolver = new Resolver();

/**
 * BL-2, INV-16: the permission rule of every planner resolver. define() refuses a name with no rule,
 * so a new resolver cannot be registered without one.
 * - read: reads only.
 * - issue-checked: the resolver checks the user's Jira permissions on every issue it writes.
 * - plan-approver: Jira administrator, project administrator, or a member of an approver group.
 * - project-user: any user who can open the project page (writes only planner data).
 */
type ResolverRule = 'read' | 'issue-checked' | 'plan-approver' | 'project-user';
export const RESOLVER_RULES: Record<string, ResolverRule> = {
  getProjectPlan: 'read',
  checkPlanApprover: 'read',
  getPlanBaselines: 'read',
  getScopeCreepReport: 'read',
  updateWbsTask: 'issue-checked',
  batchUpdateTasks: 'issue-checked',
  continueCascade: 'issue-checked',
  moveTaskGroup: 'issue-checked',
  continueBlockMove: 'issue-checked',
  changeParent: 'issue-checked',
  convertIssueType: 'issue-checked',
  checkConversion: 'issue-checked',
  scheduleBacklogTask: 'issue-checked',
  unscheduleTask: 'issue-checked',
  reorderWbsTasks: 'issue-checked',
  addSubtaskToTask: 'issue-checked',
  resolveLocalSubtasks: 'issue-checked',
  createSubtaskForResource: 'issue-checked',
  createInlineTask: 'issue-checked',
  createJiraEpic: 'issue-checked',
  createProjectPlan: 'plan-approver',
  continuePlanCopy: 'plan-approver',
  renameProjectPlan: 'plan-approver',
  setPlanFilter: 'plan-approver',
  deleteProjectPlan: 'plan-approver',
  continuePlanDelete: 'plan-approver',
  freezePlanBaseline: 'plan-approver',
  setActiveBaseline: 'plan-approver',
  compareBaselines: 'read',
  exportBaseline: 'read',
  reviewScopeShift: 'plan-approver',
  requestScopeShift: 'project-user',
  saveColumnWidths: 'project-user',
  saveHiddenColumns: 'project-user'
};

function define(name: string, fn: (req: any) => Promise<any>): void {
  const rule = RESOLVER_RULES[name];
  if (!rule) throw new Error(`Resolver ${name} has no permission rule (BL-2).`);
  resolver.define(name, async (req) => withClientToday(req?.payload?.clientToday, () => withResolverHandler(req, async () => {
    if (rule === 'plan-approver' && !(await isPlanApprover(resolveStorage(), { projectId: extractProjectId(req) }))) {
      return forbiddenResult(APPROVER_REQUIRED_MESSAGE);
    }
    return fn(req);
  })));
}

const withProject = (req: any) => ({ ...req.payload, projectKey: extractProjectKey(req), projectId: extractProjectId(req) });

define('getProjectPlan', async (req) => {
  const plan = await getProjectPlan(extractProjectKey(req), undefined, new Date(), extractSiteUrl(req), extractProjectId(req), undefined, req.payload?.planId,
    reconcileIdsOf(req.payload?.reconcileIds));
  // The status of the active baseline comes with the plan, so the toolbar needs no second call (ADR-009).
  return Object.assign(plan, { baselineStatus: await baselineStatusFor(resolveStorage(), extractProjectKey(req), extractProjectId(req), plan) });
});
define('createProjectPlan', async (req) => createProjectPlan(withProject(req)));
define('deleteProjectPlan', async (req) => deleteProjectPlan(withProject(req)));
define('continuePlanCopy', async (req) => continuePlanCopy(withProject(req)));
define('moveTaskGroup', async (req) => moveTaskGroup({ ...withProject(req), reconcileIds: reconcileIdsOf(req.payload?.reconcileIds) }));
define('changeParent', async (req) => changeParent({ ...withProject(req), reconcileIds: reconcileIdsOf(req.payload?.reconcileIds) }));
define('continueBlockMove', async (req) => continueBlockMove({ ...withProject(req), reconcileIds: reconcileIdsOf(req.payload?.reconcileIds) }));
define('convertIssueType', async (req) => convertIssueType(withProject(req)));
define('checkConversion', async (req) => checkConversion(withProject(req)));
define('continuePlanDelete', async (req) => continuePlanDelete(withProject(req)));
define('renameProjectPlan', async (req) => renameProjectPlan(withProject(req)));
define('setPlanFilter', async (req) => setPlanFilter(withProject(req)));
define('batchUpdateTasks', async (req) => batchUpdateTasks(withProject(req)));
define('scheduleBacklogTask', async (req) => scheduleBacklogTask(withProject(req)));
define('createInlineTask', async (req) => createInlineTask(withProject(req)));
define('createJiraEpic', async (req) => createJiraEpic(withProject(req)));
define('updateWbsTask', async (req) => {
  try {
    return await updateWbsTask(withProject(req));
  } catch (err: any) {
    if (err instanceof ValidationError || err instanceof ForbiddenError || err instanceof PermissionCheckError) throw err;
    const message = err?.message || 'Failed to update task';
    return { ok: false, success: false, error: message, message };
  }
});
define('addSubtaskToTask', async (req) => addSubtaskToTask(withProject(req)));
define('resolveLocalSubtasks', async (req) => resolveLocalSubtasks(withProject(req)));
define('saveColumnWidths', async (req) => saveColumnWidths(withProject(req)));
define('saveHiddenColumns', async (req) => saveHiddenColumns(withProject(req)));
define('continueCascade', async (req) => continueCascade(withProject(req)));
define('unscheduleTask', async (req) => unscheduleTask(withProject(req)));
define('reorderWbsTasks', async (req) => reorderWbsTasks(withProject(req)));
define('createSubtaskForResource', async (req) => createSubtaskForResource(withProject(req)));
define('freezePlanBaseline', async (req) => freezePlanBaseline(withProject(req), undefined, req.context));
define('getPlanBaselines', async (req) => getPlanBaselines(withProject(req)));
define('getScopeCreepReport', async (req) => getScopeCreepReport(withProject(req)));
define('requestScopeShift', async (req) => requestScopeShift(withProject(req), undefined, req.context));
define('reviewScopeShift', async (req) => reviewScopeShift(withProject(req), undefined, req.context));
define('compareBaselines', async (req) => compareBaselines(withProject(req)));
define('exportBaseline', async (req) => exportBaseline(withProject(req)));
define('setActiveBaseline', async (req) => setActiveBaseline(withProject(req)));

// The admin page has its own function with only the approver-policy resolvers, so no planner
// resolver can run without a project (N-01).
const adminResolver = new Resolver();
adminResolver.define('approver-policy-get-api', async (req) => getApproverPolicyFlow(resolveStorage(), req.context));
adminResolver.define('approver-policy-set-api', async (req) => setApproverPolicyFlow(req.payload, resolveStorage(), req.context));
adminResolver.define('approver-group-search-api', async (req) => searchGroupsFlow(req.payload, req.context));
const adminDefinitions = adminResolver.getDefinitions();

/** Forge function of the admin page (manifest key admin-resolver). */
export const adminHandler = async (event: any, context?: any) => adminDefinitions(event, context);

define('checkPlanApprover', async (req) => {
  const isApprover = await isPlanApprover(resolveStorage(), { projectId: extractProjectId(req) });
  return {
    ok: true,
    isApprover,
    guidance: isApprover ? null : APPROVER_REQUIRED_MESSAGE
  };
});

const definitions = resolver.getDefinitions();



/** Forge function for the issue-deleted trigger (manifest key issue-deleted). */
export const issueDeletedTrigger = async (event: any) => issueDeleted(event);

export const handler = async (event: any, context?: any) => {
  const backendContext = context || (event?.context?.license ? { license: event.context.license } : undefined);
  return definitions(event, backendContext);
};
