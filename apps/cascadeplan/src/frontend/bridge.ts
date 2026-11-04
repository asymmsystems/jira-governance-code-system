/*
 * Copyright (c) 2026 Asymm Systems. All rights reserved.
 *
 * @author Fahim Farook
 */

/**
 * CascadePlan: the only path from the UI to the Forge backend and the Jira router.
 * Uses the public @forge/bridge API (B-01, INV-02).
 * Decision D-09: Custom UI canvas planner with @forge/bridge; @forge/react (UI Kit 2) has no canvas support.
 */

import { invoke, router } from '@forge/bridge';
import { classifyResult } from '../ui/result';
import { showErrorBanner } from './banner';
import { recordChanges } from './changes-panel';

/**
 * Calls a resolver. A thrown call becomes { ok: false, error }, and every failed write
 * (ok false, success false, or a failed Jira sync) shows the error banner (B-07, INV-05).
 */
export async function callResolver(fnName: string, payload: Record<string, unknown> = {}): Promise<any> {
  let res: any;
  try {
    res = await invoke(fnName, payload);
  } catch (err: any) {
    console.error('Forge resolver error:', fnName, err);
    res = { ok: false, error: err?.message || 'The planner could not reach Jira.' };
  }
  if (!fnName.startsWith('get')) {
    const verdict = classifyResult(res);
    if (verdict.failed && verdict.message) showErrorBanner(verdict.message);
    // Every Jira write goes to the Changes panel with its old value, new value and result (B-23).
    recordChanges(res);
  }
  // A long cascade is applied in batches; keep going until nothing remains (B-10, D-05).
  let rounds = 0;
  while (res && Array.isArray(res.cascadeRemaining) && res.cascadeRemaining.length > 0 && rounds < MAX_CASCADE_ROUNDS) {
    rounds++;
    res = await callResolver('continueCascade', { taskId: payload.taskId });
  }
  return res;
}

const MAX_CASCADE_ROUNDS = 40;

/**
 * Opens a Jira issue in a new browser tab through the Forge router.
 */
export function openIssueInNewTab(issueKey: string): void {
  void router.open(`/browse/${encodeURIComponent(issueKey)}`);
}
