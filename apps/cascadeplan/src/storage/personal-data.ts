/*
 * Copyright (c) 2026 Asymm Systems. All rights reserved.
 *
 * @author Fahim Farook
 */

/**
 * CascadePlan: the account ids of contributors in the plan records, for the weekly personal data
 * report (ADR-009 decision 7). A plan record names a contributor by account id (`parties[].partyId`,
 * a person working on the task through a Jira sub-task, ADR-004). Records are written by many paths
 * (moves, copies of plans, migrations), so the report finds these ids by reading the stored records,
 * which also leaves out records that no longer exist.
 */

import { StorageProvider } from './plan-repository';

/** Every record of the app starts with this prefix; plan records hold `parties`. */
const RECORD_PREFIX = 'cp:';

export interface ContributorAccounts {
  /** For each account id, the keys of the records that name it and its earliest date there. */
  accounts: Map<string, { keys: string[]; since: string }>;
}

/** The contributor account ids of every stored plan record. */
export async function contributorAccounts(storage: StorageProvider): Promise<ContributorAccounts> {
  const accounts = new Map<string, { keys: string[]; since: string }>();
  for (const row of await storage.query!<any>(RECORD_PREFIX)) {
    const parties = row.value && Array.isArray(row.value.parties) ? row.value.parties : [];
    for (const p of parties) {
      if (!p || typeof p.partyId !== 'string' || !p.partyId) continue;
      const cur: { keys: string[]; since: string } = accounts.get(p.partyId) || { keys: [], since: p.fromDate || '' };
      if (!cur.keys.includes(row.key)) cur.keys.push(row.key);
      if (p.fromDate && (!cur.since || p.fromDate < cur.since)) cur.since = p.fromDate;
      accounts.set(p.partyId, cur);
    }
  }
  return { accounts };
}

/**
 * For a closed account, removes its account id from the contributors of each record that names it.
 * The contributor keeps its Jira sub-task key, so the work stays linked; it names no one.
 */
export async function eraseContributor(storage: StorageProvider, accountId: string, keys: string[]): Promise<void> {
  for (const key of keys) {
    const rec = await storage.get<any>(key);
    if (!rec || !Array.isArray(rec.parties)) continue;
    if (!rec.parties.some((p: any) => p && p.partyId === accountId)) continue;
    const parties = rec.parties.map((p: any) => {
      if (!p || p.partyId !== accountId) return p;
      const { partyId: _gone, ...rest } = p;
      return rest;
    });
    await storage.set(key, { ...rec, parties });
  }
}
