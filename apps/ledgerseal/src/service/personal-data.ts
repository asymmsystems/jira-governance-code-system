/**
 * Copyright (c) 2026 Asymm Systems. All rights reserved.
 *
 * LedgerSeal: the weekly personal data report and the deletion of an issue's records (ADR-010 decisions 5 and 9).
 * The report sends every account id the app holds: the token-to-account map and the admin who last saved the
 * approver policy. For a closed account it deletes the map key, so its tokens name no one, and removes the admin id.
 *
 * @author Fahim Farook
 */

import { ApproverPolicy } from '../domain/models';
import { PartyRepository } from '../storage/party-repository';
import { PolicyRepository } from '../storage/policy-repository';
import { SealRepository, StorageProvider } from '../storage/seal-repository';

export interface ReportedAccount {
  accountId: string;
  updatedAt: string;
}

export interface AccountUpdate {
  accountId: string;
  status: string;
}

/** Forge's privacy.reportPersonalData, or a stand-in in tests. */
export type ReportFn = (accounts: ReportedAccount[]) => Promise<AccountUpdate[]>;

export interface ReportResult {
  reported: number;
  closed: string[];
}

/** One entry per account, with its newest update time. */
function accountsToReport(entries: ReportedAccount[]): ReportedAccount[] {
  const latest = new Map<string, string>();
  for (const { accountId, updatedAt } of entries) {
    const at = updatedAt || new Date(0).toISOString();
    if (!latest.has(accountId) || (latest.get(accountId) as string) < at) latest.set(accountId, at);
  }
  return [...latest].map(([accountId, updatedAt]) => ({ accountId, updatedAt })).sort((a, b) => (a.accountId < b.accountId ? -1 : 1));
}

export async function reportPersonalData(storage: StorageProvider, report: ReportFn): Promise<ReportResult> {
  const parties = new PartyRepository(storage);
  const policies = new PolicyRepository(storage);
  const map = await parties.all();
  const policy = await policies.getApproverPolicy();
  const entries: ReportedAccount[] = map.map(m => ({ accountId: m.entry.accountId, updatedAt: m.entry.updatedAt }));
  if (policy?.setByPartyId) entries.push({ accountId: policy.setByPartyId, updatedAt: policy.fromDate });
  const accounts = accountsToReport(entries);
  if (accounts.length === 0) return { reported: 0, closed: [] };

  const updates = await report(accounts);
  const closed = [...new Set(updates.filter(u => u.status === 'closed').map(u => u.accountId))];
  const closedSet = new Set(closed);
  for (const m of map) {
    if (closedSet.has(m.entry.accountId)) await parties.forget(m.token);
  }
  if (policy?.setByPartyId && closedSet.has(policy.setByPartyId)) {
    const kept: ApproverPolicy = { ...policy, setByPartyId: null };
    await policies.saveApproverPolicy(kept);
  }
  return { reported: accounts.length, closed };
}

/**
 * Deletes every LedgerSeal key of a deleted issue (readiness finding F-11): the sealed issue, the seals, the
 * history, the snapshots of every seal and an old-format record. Returns the number of keys deleted.
 */
export async function deleteIssueRecords(storage: StorageProvider, issueId: string): Promise<number> {
  const repo = new SealRepository(storage);
  const rows = await storage.query(`ls3:wes:${issueId}:`);
  const certificates = new Set<string>();
  for (const row of rows) {
    const id = row.value?.data?.certificateId;
    if (typeof id === 'string' && id) certificates.add(id);
  }
  const we = await repo.getWorkEffort(issueId);
  if (we?.currentContentId) certificates.add(we.currentContentId);
  const keys = [
    ...rows.map(r => r.key),
    ...(await storage.query(`ls3:wepa:${issueId}:`)).map(r => r.key)
  ];
  for (const id of certificates) keys.push(...(await storage.query(`ls3:content:${id}:`)).map(r => r.key));
  if (we) keys.push(`ls3:we:${issueId}`);
  if (await storage.get(`cert:active:${issueId}`)) keys.push(`cert:active:${issueId}`);
  for (const key of keys) await storage.delete(key);
  return keys.length;
}
