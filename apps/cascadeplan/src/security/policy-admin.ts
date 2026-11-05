/**
 * CascadePlan: Admin policy management flows and authorization engine.
 *
 * Copyright (c) 2026 Asymm Systems. All rights reserved.
 * @author Fahim Farook
 *
 * Server-side enforcement for the CascadePlan admin page (manifest module cascadeplan-admin).
 * Restricted strictly to Jira Administrators holding global ADMINISTER permission.
 * Two-tier fail-closed authorization model adheres to the Uniform Permission Management Standard.
 */

import api, { route } from '@forge/api';
import { ApproverPolicy } from '../domain/models';
import { StorageProvider } from '../storage/plan-repository';
import { PolicyRepository } from '../storage/policy-repository';

export const MAX_APPROVER_GROUPS = 20;
export const MAX_QUERY_CHARS = 100;

export const NOT_ADMIN_MESSAGE =
  'CascadePlan: you do not have permission to view or manage authorization settings. ' +
  'Contact your Jira site administrator.';

export const APPROVER_REQUIRED_MESSAGE =
  'Requires Project Admin, Jira Admin, or membership in an authorized group. ' +
  'Configured by your Jira administrator in Jira Settings > Apps > CascadePlan.';

export interface GroupSearchResult {
  groupId: string;
  name: string;
}

/** Checks whether the calling user holds the global ADMINISTER Jira permission. */
export async function isJiraAdmin(): Promise<boolean> {
  try {
    const res = await api.asUser().requestJira(route`/rest/api/3/mypermissions?permissions=ADMINISTER`);
    if (res.status !== 200) return false;
    const body = await res.json();
    return body?.permissions?.ADMINISTER?.havePermission === true;
  } catch {
    return false;
  }
}

/**
 * Checks Tier 1 admin permissions on an issue or project for the calling user.
 * Returns true if the user holds either ADMINISTER or ADMINISTER_PROJECTS.
 */
export interface PermissionScope { projectId?: string; issueId?: string }

export async function hasTier1AdminPermission(scope?: PermissionScope): Promise<boolean> {
  // A check with no project or issue would answer for the user's rights anywhere: refuse it (F-24).
  const projectId = scope?.projectId && /^\d+$/.test(scope.projectId) ? scope.projectId : undefined;
  const issueId = scope?.issueId && /^\d+$/.test(scope.issueId) ? scope.issueId : undefined;
  if (!projectId && !issueId) return false;
  try {
    const path = projectId
      ? route`/rest/api/3/mypermissions?projectId=${projectId}&permissions=ADMINISTER_PROJECTS,ADMINISTER`
      : route`/rest/api/3/mypermissions?issueId=${issueId as string}&permissions=ADMINISTER_PROJECTS,ADMINISTER`;
    const res = await api.asUser().requestJira(path);
    if (res.status !== 200) return false;
    const body = await res.json();
    const perms = body?.permissions;
    if (!perms) return false;
    return Boolean(
      perms.ADMINISTER_PROJECTS?.havePermission === true ||
      perms.ADMINISTER?.havePermission === true
    );
  } catch {
    return false;
  }
}

/**
 * Evaluates whether the caller holds CascadePlan approver authority (CP_APPROVER / PS_APPROVER).
 * Tier 1: Jira Admin or Project Admin.
 * Tier 2: Member of any configured approver group stored in cascadeplan:cfg:approver_policy.
 * Fail-closed: any failure evaluates to false.
 */
export async function isPlanApprover(
  storage: StorageProvider,
  scope?: PermissionScope
): Promise<boolean> {
  // Without a project or issue there is no scope to approve in (F-24): fail closed.
  if (!scope || (!scope.projectId && !scope.issueId)) return false;
  // Step 1: Tier 1 check
  const isTier1 = await hasTier1AdminPermission(scope);
  if (isTier1) return true;

  // Step 2: Tier 2 check against configured policy groups
  try {
    const policy = await new PolicyRepository(storage).getApproverPolicy();
    const configuredParties = policy?.parties ?? [];
    if (configuredParties.length === 0) {
      return false;
    }
    const targetGroupIds = new Set(configuredParties.map(p => p.partyId));
    const targetGroupNames = new Set(configuredParties.map(p => p.name));

    const myselfRes = await api.asUser().requestJira(route`/rest/api/3/myself?expand=groups`);
    if (myselfRes.status !== 200) return false;
    const myself = await myselfRes.json();
    const userGroups = myself?.groups?.items ?? [];

    for (const g of userGroups) {
      const gId = String(g?.groupId || '');
      const gName = String(g?.name || '');
      if ((gId && targetGroupIds.has(gId)) || (gName && targetGroupNames.has(gName))) {
        return true;
      }
    }
    return false;
  } catch {
    return false;
  }
}

/** Handles the approver-policy-get-api resolver invocation. */
export async function getApproverPolicyFlow(
  storage: StorageProvider,
  context?: any
): Promise<any> {
  const admin = await isJiraAdmin();
  if (!admin) {
    return { ok: false, code: 'NOT_ADMIN', message: NOT_ADMIN_MESSAGE };
  }
  const policy = await new PolicyRepository(storage).getApproverPolicy();
  return { ok: true, policy };
}

/** Handles the approver-group-search-api resolver invocation. */
export async function searchGroupsFlow(
  payload: any,
  context?: any
): Promise<any> {
  const admin = await isJiraAdmin();
  if (!admin) {
    return { ok: false, code: 'NOT_ADMIN', message: NOT_ADMIN_MESSAGE };
  }
  const query = typeof payload?.query === 'string' ? payload.query.trim() : '';
  if (query.length > MAX_QUERY_CHARS) {
    return { ok: false, message: `Search query must not exceed ${MAX_QUERY_CHARS} characters.` };
  }

  try {
    const path = route`/rest/api/3/groups/picker?query=${query}&maxResults=20`;
    const res = await api.asUser().requestJira(path);
    if (res.status !== 200) {
      return { ok: false, message: 'CascadePlan could not search groups in Jira. Try again.' };
    }
    const body = await res.json();
    const rawGroups = Array.isArray(body?.groups) ? body.groups : [];
    const groups: GroupSearchResult[] = rawGroups
      .map((g: any) => ({
        groupId: String(g.groupId || g.name || ''),
        name: String(g.name || g.groupId || '')
      }))
      .filter((g: GroupSearchResult) => g.groupId.length > 0 && g.name.length > 0);

    return { ok: true, groups };
  } catch {
    return { ok: false, message: 'CascadePlan could not search groups in Jira. Try again.' };
  }
}

/**
 * Handles the approver-policy-set-api resolver invocation.
 * Saves up to 20 Jira groups in cascadeplan:cfg:approver_policy.
 */
export async function setApproverPolicyFlow(
  payload: any,
  storage: StorageProvider,
  context?: any
): Promise<any> {
  const admin = await isJiraAdmin();
  if (!admin) {
    return { ok: false, code: 'NOT_ADMIN', message: NOT_ADMIN_MESSAGE };
  }
  const raw = payload?.groupIds;
  if (!Array.isArray(raw)) {
    return { ok: false, message: 'Invalid group list provided.' };
  }
  const groupIds = [...new Set(raw.map(id => String(id)).filter(id => id.length > 0))];
  if (groupIds.length > MAX_APPROVER_GROUPS) {
    return { ok: false, message: `Choose at most ${MAX_APPROVER_GROUPS} groups.` };
  }

  const callerAccountId = String(context?.accountId || 'unknown');
  const parties: Array<{ partyId: string; partyTypeId: 'GROUP'; name: string }> = [];

  for (const groupId of groupIds) {
    try {
      const res = await api.asUser().requestJira(route`/rest/api/3/group/bulk?groupId=${groupId}`);
      if (res.status === 200) {
        const body = await res.json();
        const found = Array.isArray(body?.values) ? body.values[0] : null;
        if (found?.name) {
          parties.push({ partyId: groupId, partyTypeId: 'GROUP', name: String(found.name) });
          continue;
        }
      }
    } catch {}
    parties.push({ partyId: groupId, partyTypeId: 'GROUP', name: groupId });
  }

  const policy: ApproverPolicy = {
    roleTypeId: 'CP_APPROVER',
    parties,
    fromDate: new Date().toISOString(),
    setByPartyId: callerAccountId
  };

  await new PolicyRepository(storage).saveApproverPolicy(policy);
  return { ok: true, policy };
}
