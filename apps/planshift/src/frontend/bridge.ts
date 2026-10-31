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
import { classifyResult } from '../ui/result';
import { showErrorBanner } from './banner';

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
  }
  return res;
}

/**
 * Opens a Jira issue in a new browser tab through the Forge router.
 */
export function openIssueInNewTab(issueKey: string): void {
  void router.open(`/browse/${encodeURIComponent(issueKey)}`);
}
