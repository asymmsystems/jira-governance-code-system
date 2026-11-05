/*
 * Copyright (c) 2026 Asymm Systems. All rights reserved.
 *
 * @author Fahim Farook
 */

/**
 * CascadePlan: keys of the baselines and scope-shift requests that development builds before ADR-009
 * wrote under the project key (ps:baseline:*, ps:baselines_idx:*, ps:active_baseline:*, ps:shifts:*).
 * They had no user interface and are not carried over; deleting a plan deletes them (F-22, R-20).
 */

import { StorageProvider } from './plan-repository';

/** Deletes every legacy baseline key of one plan. */
export async function deleteLegacyBaselineKeys(storage: StorageProvider, projectKey: string, planId: string): Promise<void> {
  const keys = new Set<string>();
  const ids = (await storage.get<string[]>(`ps:baselines_idx:${projectKey}:${planId}`)) || [];
  for (const id of ids) keys.add(`ps:baseline:${projectKey}:${planId}:${id}`);
  if (storage.query) {
    for (const row of await storage.query(`ps:baseline:${projectKey}:${planId}:`)) keys.add(row.key);
  }
  for (const key of keys) await storage.delete(key);
  for (const key of [`ps:baselines_idx:${projectKey}:${planId}`, `ps:active_baseline:${projectKey}:${planId}`, `ps:shifts:${projectKey}:${planId}`]) {
    await storage.delete(key);
  }
}
