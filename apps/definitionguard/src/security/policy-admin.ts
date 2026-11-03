/**
 * DefinitionGuard: Admin policy management flows.
 *
 * Copyright (c) 2026 Asymm Systems. All rights reserved.
 * @author Fahim Farook
 *
 * Server-side enforcement for the DefinitionGuard admin page (manifest module definitionguard-admin).
 * Restricted strictly to Jira Administrators holding global ADMINISTER permission.
 * Fails closed on any permission check error.
 */
import api, { route } from '@forge/api';
import { ApproverPolicy } from '../domain/models';
import { withRetry } from '../jira/jira-client';
import { StorageProvider } from '../storage/checklist-repository';
import { PolicyRepository } from '../storage/policy-repository';
import { isJiraAdmin } from './approver';

export const MAX_APPROVER_GROUPS = 20;
export const MAX_QUERY_CHARS = 100;

export const NOT_ADMIN_MESSAGE =
  'DefinitionGuard: you do not have permission to view or manage authorization settings. ' +
  'Contact your Jira site administrator.';

export interface GroupSearchResult {
  groupId: string;
  name: string;
}

/** Handles the authority-policy-get resolver invocation. */
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

/** Handles the authority-group-search resolver invocation. */
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
    const res = await withRetry(() => api.asUser().requestJira(path));
    if (res.status !== 200) {
      return { ok: false, message: 'DefinitionGuard could not search groups in Jira. Try again.' };
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
    return { ok: false, message: 'DefinitionGuard could not search groups in Jira. Try again.' };
  }
}

/**
 * Handles the authority-policy-set resolver invocation.
 * Saves up to 20 Jira groups in dg:cfg:approver_policy.
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
      const res = await withRetry(() => api.asUser().requestJira(route`/rest/api/3/group/bulk?groupId=${groupId}`));
      if (res.status === 200) {
        const body = await res.json();
        const found = Array.isArray(body?.values) ? body.values[0] : null;
        if (found?.name) {
          parties.push({ partyId: groupId, partyTypeId: 'GROUP', name: String(found.name) });
          continue;
        }
      }
    } catch {}
    // Fall back to groupId as name if bulk endpoint did not return name
    parties.push({ partyId: groupId, partyTypeId: 'GROUP', name: groupId });
  }

  const policy: ApproverPolicy = {
    roleTypeId: 'DG_APPROVER',
    parties,
    fromDate: new Date().toISOString(),
    setByPartyId: callerAccountId
  };

  await new PolicyRepository(storage).saveApproverPolicy(policy);
  return { ok: true, policy };
}
