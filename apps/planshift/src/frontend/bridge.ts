/*
 * Copyright (c) 2026 Asymm Systems. All rights reserved.
 *
 * @author Fahim Farook
 */

/**
 * CascadePlan: the only path from the UI to the Forge backend and the Jira router.
 * Uses the public @forge/bridge API (B-01, INV-02).
 */

import { invoke, router } from '@forge/bridge';

/**
 * Calls a resolver. Returns null when the call fails, as the planner expects today.
 */
export async function callResolver(fnName: string, payload: Record<string, unknown> = {}): Promise<any> {
  try {
    return await invoke(fnName, payload);
  } catch (err) {
    console.error('Forge resolver error:', fnName, err);
    return null;
  }
}

/**
 * Opens a Jira issue in a new browser tab through the Forge router.
 */
export function openIssueInNewTab(issueKey: string): void {
  void router.open(`/browse/${encodeURIComponent(issueKey)}`);
}
