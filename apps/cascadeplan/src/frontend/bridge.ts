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

import { invoke, router, view } from '@forge/bridge';
import { classifyResult } from '../ui/result';
import { showErrorBanner } from './banner';
import { recordChanges } from './changes-panel';

/**
 * Issues written in the last minute. Jira's search is eventually consistent, so every call sends
 * them as reconcileIds and the server asks Jira for read-after-write on them (F-03 part 3).
 */
const recentWrites = new Map<string, number>();
const RECENT_MS = 60000;

export function recentWriteIds(now = Date.now()): string[] {
  for (const [id, at] of recentWrites) if (now - at > RECENT_MS) recentWrites.delete(id);
  return [...recentWrites.keys()].slice(-50);
}

function rememberWrites(res: any, now = Date.now()): void {
  for (const id of (res && Array.isArray(res.writtenIssueIds) ? res.writtenIssueIds : [])) recentWrites.set(String(id), now);
}

/**
 * C7: resolvers that create Jira issues take a create id. A create that ended without an answer keeps
 * its id, so the same request made again sends the same id and the server returns the issue the first
 * call created, if it did, instead of creating a second one.
 */
export const CREATE_RESOLVERS = new Set(['createInlineTask', 'createJiraEpic', 'createSubtaskForResource', 'addSubtaskToTask', 'resolveLocalSubtasks', 'updateWbsTask']);
const unansweredCreates = new Map<string, string>();

function newCreateId(): string {
  const c: any = (globalThis as any).crypto;
  if (c && typeof c.randomUUID === 'function') return c.randomUUID();
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
}

/** The payload with its create id: the id of an unanswered identical request, or a new one. */
export function withCreateId(fnName: string, payload: Record<string, unknown>): { payload: Record<string, unknown>; signature?: string } {
  if (!CREATE_RESOLVERS.has(fnName)) return { payload };
  const signature = `${fnName}:${JSON.stringify(payload)}`;
  return { payload: { ...payload, createId: unansweredCreates.get(signature) || newCreateId() }, signature };
}

/** Records the outcome of a create: an unanswered one keeps its id for a repeat, an answered one drops it. */
export function noteCreateOutcome(signature: string | undefined, createId: unknown, answered: boolean): void {
  if (!signature) return;
  if (answered) unansweredCreates.delete(signature);
  else unansweredCreates.set(signature, String(createId));
}

/** One resolver call: a thrown call becomes { ok: false }, and a failed write shows the error banner. */
async function callOnce(fnName: string, rawPayload: Record<string, unknown>): Promise<any> {
  let res: any;
  const { payload, signature } = withCreateId(fnName, rawPayload);
  const ids = recentWriteIds();
  try {
    // F-29: the user's local date is "today" for the server's schedule rules.
    const d = new Date();
    const clientToday = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    res = await invoke(fnName, { ...(ids.length ? { ...payload, reconcileIds: ids } : payload), clientToday });
    rememberWrites(res);
    noteCreateOutcome(signature, payload.createId, true);
  } catch (err: any) {
    console.error('Forge resolver error:', fnName, err);
    noteCreateOutcome(signature, payload.createId, false);
    // C7: a write call that ended without an answer (for example a timeout) may already have written
    // to Jira, so the planner never says it failed or succeeded: the result is unknown. A create made
    // again with the same values is safe: it returns the issue the first call created, if it did.
    const message = fnName.startsWith('get') || fnName.startsWith('check')
      ? (err?.message || 'The planner could not reach Jira.')
      : (signature
        ? 'The result is unknown. Check the plan, or make the same request again: CascadePlan will not create the work item twice.'
        : 'The result is unknown. Check the plan before you try again.');
    res = { ok: false, success: false, error: fnName.startsWith('get') || fnName.startsWith('check') ? 'unavailable' : 'unknown', message };
  }
  if (!fnName.startsWith('get')) {
    const verdict = classifyResult(res);
    if (verdict.failed && verdict.message) showErrorBanner(verdict.message);
    // Every Jira write goes to the Changes panel with its old value, new value and result (B-23).
    recordChanges(res);
  }
  return res;
}

/**
 * Calls a resolver. A thrown call becomes { ok: false, error }, and every failed write
 * (ok false, success false, or a failed Jira sync) shows the error banner (B-07, INV-05).
 * A long cascade is applied in batches: the call continues from each cascade root until nothing
 * remains, with one round counter for the whole call (B-10, D-05, M3). A batch names its roots in
 * cascadeRoots (F-20).
 */
export async function callResolver(fnName: string, payload: Record<string, unknown> = {}): Promise<any> {
  let res = await callOnce(fnName, payload);
  const pending = (r: any) => !!r && Array.isArray(r.cascadeRemaining) && r.cascadeRemaining.length > 0;
  const roots: string[] = Array.isArray(res?.cascadeRoots) && res.cascadeRoots.length
    ? res.cascadeRoots.map(String)
    : (pending(res) && payload.taskId ? [String(payload.taskId)] : []);
  let rounds = 0;
  let unfinished = false;
  for (const root of roots) {
    let more = true;
    while (more) {
      if (rounds >= MAX_CASCADE_ROUNDS) { unfinished = true; break; }
      rounds++;
      // The cascade continues in the plan the first write went to.
      const next = await callOnce('continueCascade', { taskId: root, planId: payload.planId });
      if (next && Array.isArray(next.tasks)) res = next;
      more = pending(next) && next.ok !== false;
    }
    if (unfinished) break;
  }
  if (unfinished) showErrorBanner('The cascade did not finish. Move the task again to continue.');
  return res;
}

const MAX_CASCADE_ROUNDS = 40;

/**
 * The browser-storage scope of the open project: "<cloudId>:<project key>" from the Forge context,
 * or undefined when the context cannot be read (the planner then uses the key of the loaded plan).
 */
export async function getProjectScope(): Promise<string | undefined> {
  try {
    const ctx: any = await view.getContext();
    const key = ctx?.extension?.project?.key;
    if (!key) return undefined;
    return ctx?.cloudId ? `${ctx.cloudId}:${key}` : String(key);
  } catch {
    return undefined;
  }
}

/**
 * Opens a Jira issue in a new browser tab through the Forge router.
 */
export function openIssueInNewTab(issueKey: string): void {
  void router.open(`/browse/${encodeURIComponent(issueKey)}`);
}
