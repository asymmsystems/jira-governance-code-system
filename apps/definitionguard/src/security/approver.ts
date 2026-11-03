/**
 * Two-Tier Fail-Closed Authorization Model for DefinitionGuard.
 *
 * Copyright (c) 2026 Asymm Systems. All rights reserved.
 * @author Fahim Farook
 *
 * Tier 1: Built-in administrative roles (ADMINISTER, ADMINISTER_PROJECTS) via Jira mypermissions.
 * Tier 2: Configurable authority groups stored in dg:cfg:approver_policy, verified via myself?expand=groups.
 * Fail-Closed: any network error or permission check failure evaluates to DENIED.
 */
import api, { route } from '@forge/api';
import { withRetry } from '../jira/jira-client';
import { StorageProvider } from '../storage/checklist-repository';
import { PolicyRepository } from '../storage/policy-repository';
import { PermissionDeniedError } from './permissions';

export const APPROVER_REQUIRED_MESSAGE =
  'Requires Project Admin, Jira Admin, or membership in an authorized group. ' +
  'Configured by your Jira administrator in Jira Settings > Apps > DefinitionGuard.';

export interface JiraGroupItem {
  groupId?: string;
  name?: string;
}

/** Checks whether the calling user holds the global ADMINISTER Jira permission. */
export async function isJiraAdmin(): Promise<boolean> {
  try {
    const res = await withRetry(() => api.asUser().requestJira(route`/rest/api/3/mypermissions?permissions=ADMINISTER`));
    if (res.status !== 200) return false;
    const body = await res.json();
    return body?.permissions?.ADMINISTER?.havePermission === true;
  } catch {
    return false;
  }
}

/**
 * Checks Tier 1 admin permissions on an issue for the calling user.
 * Returns true if the user holds either ADMINISTER or ADMINISTER_PROJECTS.
 */
export async function hasTier1AdminPermission(issueIdOrKey: string): Promise<boolean> {
  if (!issueIdOrKey) return false;
  try {
    const isId = /^\d+$/.test(issueIdOrKey);
    const path = isId
      ? route`/rest/api/3/mypermissions?issueId=${issueIdOrKey}&permissions=ADMINISTER_PROJECTS,ADMINISTER`
      : route`/rest/api/3/mypermissions?issueKey=${issueIdOrKey}&permissions=ADMINISTER_PROJECTS,ADMINISTER`;
    const res = await withRetry(() => api.asUser().requestJira(path));
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

/** Reads the group IDs of the calling user from Jira. Fails closed on any error. */
export async function getCallerGroupIds(): Promise<string[] | null> {
  try {
    const res = await withRetry(() => api.asUser().requestJira(route`/rest/api/3/myself?expand=groups`));
    if (res.status !== 200) return null;
    const body = await res.json();
    const rawItems = body?.groups?.items;
    if (!Array.isArray(rawItems)) return [];
    return rawItems
      .map(item => String(item.groupId || item.name || ''))
      .filter(id => id.length > 0);
  } catch {
    return null;
  }
}

/**
 * Evaluates whether the caller holds DG_APPROVER authority on the given issue.
 * Evaluates Tier 1 (admin permissions) first, then Tier 2 (configured authority groups).
 * Fails closed on any network error or permission issue.
 */
export async function hasApproverPermission(
  issueIdOrKey: string,
  storage: StorageProvider
): Promise<boolean> {
  const isTier1 = await hasTier1AdminPermission(issueIdOrKey);
  if (isTier1) return true;

  const policy = await new PolicyRepository(storage).getApproverPolicy();
  if (!policy || policy.parties.length === 0) return false;

  const callerGroups = await getCallerGroupIds();
  if (!callerGroups) return false;

  const groupSet = new Set(callerGroups);
  return policy.parties.some(party => groupSet.has(party.partyId) || groupSet.has(party.name));
}

/** Throws PermissionDeniedError unless the calling user holds approver authority. */
export async function checkApproverPermission(
  issueIdOrKey: string,
  storage: StorageProvider,
  deniedMessage?: string
): Promise<void> {
  const allowed = await hasApproverPermission(issueIdOrKey, storage);
  if (!allowed) {
    throw new PermissionDeniedError(deniedMessage || APPROVER_REQUIRED_MESSAGE);
  }
}

/** Returns the sorted list of designated approver group names from policy storage. */
export async function approverGroupNames(storage: StorageProvider): Promise<string[]> {
  const policy = await new PolicyRepository(storage).getApproverPolicy();
  return (policy?.parties || []).map(p => p.name).sort();
}
