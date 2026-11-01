/*
 * Copyright (c) 2026 Asymm Systems. All rights reserved.
 *
 * @author Fahim Farook
 */

/**
 * CascadePlan: content of the "Why this date?" popup (pure, no DOM access; B-12, U1, U2).
 * Pattern: the driving-path explanation of MS Project's Task Inspector and Smartsheet (UP-60, UP-62).
 */

export interface WhyFix {
  label: string;
  updates: Record<string, unknown>;
}

export interface WhyModel {
  title: string;
  reason: string;
  chain: Array<{ key: string; text: string }>;
  violation?: string;
  fixes: WhyFix[];
  driverKeys: string[];
}

interface WhyTask {
  key: string;
  startDate?: string;
  dependency?: {
    predecessorKey?: string;
    triggerPercent?: number;
    triggerDate?: string;
    earliestStartReason?: string;
    violationReason?: string;
    driverKey?: string;
    isViolated?: boolean;
    fixSuggestion?: string;
    fixOptions?: Array<{ kind: 'move'; startDate: string; endDate: string } | { kind: 'trigger'; triggerPercent: number }>;
  } | null;
}

/**
 * Explanation of a task's start: the reason, the chain of driving predecessors back to the first
 * task with no constraint, any violation and the fixes the user can apply. Null for an unknown task.
 */
export function buildWhyModel(tasks: WhyTask[], key: string): WhyModel | null {
  const byKey = new Map(tasks.map(t => [t.key, t]));
  const task = byKey.get(key);
  if (!task) return null;
  const title = `Why ${key} starts on ${task.startDate}`;
  const dep = task.dependency;
  if (!dep || !dep.predecessorKey) {
    return { title, reason: `${key} has no dependency. Its start date is the one set on the plan.`, chain: [], fixes: [], driverKeys: [] };
  }

  const chain: Array<{ key: string; text: string }> = [];
  const visited = new Set([key]);
  let next = dep.driverKey;
  while (next && !visited.has(next)) {
    visited.add(next);
    const t = byKey.get(next);
    if (!t) break;
    const d = t.dependency;
    if (d && d.predecessorKey) {
      chain.push({ key: next, text: `${next}: starts when ${d.predecessorKey} reaches ${d.triggerPercent}% (${d.triggerDate})` });
      next = d.driverKey;
    } else {
      chain.push({ key: next, text: `${next}: no dependency; starts ${t.startDate}` });
      next = undefined;
    }
  }

  const fixes: WhyFix[] = (dep.fixOptions || []).map(f => f.kind === 'move'
    ? { label: `Move ${key} to ${f.startDate}`, updates: { startDate: f.startDate, endDate: f.endDate } }
    : { label: `Lower the trigger to ${f.triggerPercent}%`, updates: { dependency: { predecessorId: dep.predecessorKey, predecessorKey: dep.predecessorKey, triggerPercent: f.triggerPercent, isTriggerSatisfied: false } } });

  const model: WhyModel = {
    title,
    reason: dep.earliestStartReason || dep.violationReason || `${key} waits for ${dep.predecessorKey}.`,
    chain,
    fixes,
    driverKeys: chain.map(c => c.key)
  };
  if (dep.isViolated) model.violation = dep.fixSuggestion || dep.violationReason;
  return model;
}
