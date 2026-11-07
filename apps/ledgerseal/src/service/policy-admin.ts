/**
 * Copyright (c) 2026 Asymm Systems. All rights reserved.
 *
 * LedgerSeal: the admin page flows for the approver policy (spec v2 section 7.1).
 * Only a Jira admin may read, search or change it. Identity comes from context; group names come from Jira.
 *
 * @author Fahim Farook
 */

import { ApproverPolicy } from '../domain/models';
import { PolicyRepository } from '../storage/policy-repository';
import { fail, LedgerSealDeps, licenseInactive, SealFailure } from './ledger';

export const MAX_APPROVER_GROUPS = 20;
const MAX_QUERY_CHARS = 100;
const MAX_GROUP_ID_CHARS = 128;

/** The caller's account id when the caller is a Jira admin, or the failure to return. */
export async function adminCaller(context: any, deps: LedgerSealDeps): Promise<string | SealFailure> {
  const accountId = context?.accountId ? String(context.accountId) : '';
  if (!accountId) return fail('NO_IDENTITY');
  if (licenseInactive(context)) return fail('LICENSE_INACTIVE');
  const admin = await deps.jira.isJiraAdmin();
  if (!admin.ok) return fail(admin.error === 'FORBIDDEN' ? 'NOT_ADMIN' : 'JIRA_UNREACHABLE');
  return admin.value ? accountId : fail('NOT_ADMIN');
}

export async function getPolicyFlow(context: any, deps: LedgerSealDeps) {
  const caller = await adminCaller(context, deps);
  if (typeof caller !== 'string') return caller;
  return { ok: true as const, policy: await new PolicyRepository(deps.storage).getApproverPolicy() };
}

export async function searchGroupsFlow(payload: any, context: any, deps: LedgerSealDeps) {
  const caller = await adminCaller(context, deps);
  if (typeof caller !== 'string') return caller;
  const query = typeof payload?.query === 'string' ? payload.query : '';
  if (query.length > MAX_QUERY_CHARS) return fail('INVALID_REQUEST', `Search with at most ${MAX_QUERY_CHARS} characters.`);
  const groups = await deps.jira.findGroups(query);
  if (!groups.ok) return fail('JIRA_UNREACHABLE', 'LedgerSeal could not search the groups in Jira. Try again.');
  return { ok: true as const, groups: groups.value };
}

/**
 * Replaces the approver groups. Only group ids are read from the payload; each must exist in Jira,
 * and its name is taken from Jira. An empty list removes every approver group.
 */
export async function setPolicyFlow(payload: any, context: any, deps: LedgerSealDeps) {
  const caller = await adminCaller(context, deps);
  if (typeof caller !== 'string') return caller;
  const raw = payload?.groupIds;
  const validId = (id: unknown) => typeof id === 'string' && id.length > 0 && id.length <= MAX_GROUP_ID_CHARS;
  if (!Array.isArray(raw) || !raw.every(validId)) return fail('INVALID_REQUEST', 'LedgerSeal: invalid list of groups.');
  const groupIds = [...new Set(raw as string[])];
  if (groupIds.length > MAX_APPROVER_GROUPS) return fail('INVALID_REQUEST', `Choose at most ${MAX_APPROVER_GROUPS} groups.`);

  const found = await deps.jira.getGroups(groupIds);
  if (!found.ok) return fail('JIRA_UNREACHABLE', 'LedgerSeal could not read the groups from Jira. Nothing was saved. Try again.');
  const byId = new Map(found.value.map(g => [g.groupId, g]));
  if (groupIds.some(id => !byId.has(id))) return fail('INVALID_REQUEST', 'A chosen group was not found in Jira. Nothing was saved.');

  const policy: ApproverPolicy = {
    roleTypeId: 'LS_APPROVER',
    parties: groupIds.map(id => ({ partyId: id, partyTypeId: 'GROUP' as const, name: byId.get(id)!.name })),
    fromDate: new Date().toISOString(),
    setByPartyId: caller
  };
  await new PolicyRepository(deps.storage).saveApproverPolicy(policy);
  return { ok: true as const, policy };
}
