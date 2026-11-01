/**
 * Copyright (c) 2026 Asymm Systems. All rights reserved.
 *
 * LedgerSeal: who may seal, reseal and revoke (spec v2 section 7.1). Reads only.
 *
 * @author Fahim Farook
 */

import { JiraClient, JiraResult } from '../jira/jira-client';
import { StorageProvider } from '../storage/seal-repository';
import { PolicyRepository } from '../storage/policy-repository';

/**
 * Project admins and Jira admins always may. Otherwise the caller must be in an approver group.
 * Groups are read only when a policy names some, and a failed read fails closed.
 */
export async function isApprover(jira: JiraClient, storage: StorageProvider, issueId: string): Promise<JiraResult<boolean>> {
  const admin = await jira.hasApproverPermission(issueId);
  if (!admin.ok || admin.value) return admin;
  const policy = await new PolicyRepository(storage).getApproverPolicy();
  if (!policy || policy.parties.length === 0) return { ok: true, value: false };
  const groups = await jira.getMyGroupIds();
  if (!groups.ok) return groups;
  const mine = new Set(groups.value);
  return { ok: true, value: policy.parties.some(p => mine.has(p.partyId)) };
}

/** The approver group names, sorted, for the "who can seal" text. */
export async function approverGroupNames(storage: StorageProvider): Promise<string[]> {
  const policy = await new PolicyRepository(storage).getApproverPolicy();
  return (policy?.parties ?? []).map(p => p.name).sort();
}
