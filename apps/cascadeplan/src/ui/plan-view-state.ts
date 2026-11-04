/*
 * Copyright (c) 2026 Asymm Systems. All rights reserved.
 *
 * @author Fahim Farook
 */

/**
 * CascadePlan: browser-side view state of the planner that is not stored in KVS.
 *
 * 1. The active plan per project, kept in browser storage so a page refresh reopens the same plan.
 * 2. The parent rows the user collapsed, and which rows they hide.
 */

/** The part of Web Storage the planner uses; any call may throw (private mode, blocked storage). */
export interface KeyValueStore {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

export const MAIN_PLAN_ID = 'default';
const ACTIVE_PLAN_PREFIX = 'cp_active_plan_';

/** Browser storage key of the active plan of one project (scope = project key, optionally site-qualified). */
export function activePlanStorageKey(scope: string): string {
  return ACTIVE_PLAN_PREFIX + scope;
}

/** The plan id saved for a project, or the Main Plan when nothing is saved or storage is unavailable. */
export function getSavedPlanId(store: KeyValueStore | undefined, scope: string | undefined): string {
  if (!store || !scope) return MAIN_PLAN_ID;
  try {
    return store.getItem(activePlanStorageKey(scope)) || MAIN_PLAN_ID;
  } catch {
    return MAIN_PLAN_ID;
  }
}

/** Saves the active plan of a project; a storage failure is ignored (the plan still opens, it is just not remembered). */
export function setSavedPlanId(store: KeyValueStore | undefined, scope: string | undefined, planId: string | undefined): void {
  if (!store || !scope) return;
  try {
    store.setItem(activePlanStorageKey(scope), planId || MAIN_PLAN_ID);
  } catch {
    // Storage blocked: nothing to do.
  }
}

/** The plan to open: the requested one when the project still lists it, else the Main Plan. */
export function chooseActivePlan(requested: string | undefined, availablePlans: Array<{ id: string }> | undefined): string {
  if (!requested || requested === MAIN_PLAN_ID) return MAIN_PLAN_ID;
  return (availablePlans || []).some(p => p.id === requested) ? requested : MAIN_PLAN_ID;
}

export interface HierarchyRow {
  key: string;
  parentKey?: string;
  epicKey?: string;
  isEpic?: boolean;
  hierarchyLevel?: number;
  childrenCount?: number;
}

function isEpicRow(t: HierarchyRow): boolean {
  return Boolean(t.isEpic || t.hierarchyLevel === 1);
}

/**
 * The key of the row directly above a row in the tree: its Jira parent when that is a row, else
 * (for a non-epic) its epic when that is a row. Undefined for a top-level row.
 */
export function parentRowKey(task: HierarchyRow, rowKeys: Set<string>): string | undefined {
  if (task.parentKey && task.parentKey !== task.key && rowKeys.has(task.parentKey)) return task.parentKey;
  if (!isEpicRow(task) && task.epicKey && task.epicKey !== task.key && rowKeys.has(task.epicKey)) return task.epicKey;
  return undefined;
}

/**
 * True when a row has child rows to show or hide: the server counted children, or another row
 * names it as its parent or epic. Jira subtasks that are not rows (unscheduled) do not count,
 * because collapsing would hide nothing.
 */
export function hasChildRows(task: HierarchyRow, rows: HierarchyRow[]): boolean {
  if (typeof task.childrenCount === 'number' && task.childrenCount > 0) return true;
  return parentKeysOf(rows).has(task.key);
}

/** Keys of every row that some other row of the list sits under (one pass, for a whole render). */
export function parentKeysOf(rows: HierarchyRow[]): Set<string> {
  const keys = new Set(rows.map(r => r.key));
  const out = new Set<string>();
  for (const r of rows) {
    const up = parentRowKey(r, keys);
    if (up) out.add(up);
  }
  return out;
}

/**
 * True when any row above this one (parent, grandparent, ...) is collapsed. byKey holds the rows
 * the current view shows, so an epic left out by a filtered view never hides its stories.
 */
export function isHiddenByCollapse(task: HierarchyRow, byKey: Map<string, HierarchyRow>, collapsed: Set<string>): boolean {
  const keys = new Set(byKey.keys());
  const seen = new Set<string>([task.key]);
  let up = parentRowKey(task, keys);
  while (up && !seen.has(up)) {
    if (collapsed.has(up)) return true;
    seen.add(up);
    const parent = byKey.get(up);
    up = parent ? parentRowKey(parent, keys) : undefined;
  }
  return false;
}

/**
 * The rows the view shows, in order, with the collapsed parents' descendants left out.
 */
export function visibleRows<T extends HierarchyRow>(rows: T[], collapsed: Set<string>): Array<{ task: T; rowIdx: number }> {
  const byKey = new Map<string, HierarchyRow>(rows.map(r => [r.key, r]));
  const out: Array<{ task: T; rowIdx: number }> = [];
  rows.forEach((task, rowIdx) => {
    if (!isHiddenByCollapse(task, byKey, collapsed)) out.push({ task, rowIdx });
  });
  return out;
}
