/*
 * Copyright (c) 2026 Asymm Systems. All rights reserved.
 *
 * @author Fahim Farook
 */

/**
 * CascadePlan: undo entries from plan snapshots (pure; B-14). The plan before and after a write is
 * compared; every changed task, including dependents the cascade moved, gets an operation that
 * restores its old values and one that applies the new values again. A parent whose dates or
 * computed progress only follow a changed child is left out: the roll-up is plan-only and follows
 * the child, so an undo writes no parent value to Jira (INV-03).
 */

export interface TaskSnap {
  key: string;
  scheduled: boolean;
  startDate?: string;
  endDate?: string;
  startWeek?: string;
  spanWeeks?: number;
  progress?: number;
  manualProgress?: boolean;
  targetProgress?: number;
  /** Every incoming link, sorted by predecessor: Jira links are the truth (ADR-006), so each changes alone. */
  links: Array<{ predecessorKey: string; triggerPercent: number }>;
  summary?: string;
  effortHours?: number;
  status?: string;
  epicKey?: string;
  resourceAccountId?: string;
  parentKey?: string;
}

export interface UndoOp {
  kind: 'update' | 'schedule' | 'unschedule';
  key: string;
  updates?: Record<string, unknown>;
}

export interface UndoEntry {
  /** Changed tasks; the first is the task the user acted on. */
  keys: string[];
  restore: UndoOp[];
  reapply: UndoOp[];
}

const PLAIN = ['targetProgress', 'status', 'summary', 'effortHours', 'epicKey'] as const;

function snap(t: any, scheduled: boolean): TaskSnap {
  const all = t.dependencies || (t.dependency ? [t.dependency] : []);
  const links = all.filter((d: any) => d && d.predecessorKey)
    .map((d: any) => ({ predecessorKey: d.predecessorKey, triggerPercent: d.triggerPercent }))
    .sort((a: any, b: any) => (a.predecessorKey < b.predecessorKey ? -1 : a.predecessorKey > b.predecessorKey ? 1 : 0));
  return { key: t.key, scheduled, startDate: t.startDate, endDate: t.endDate, startWeek: t.startWeek, spanWeeks: t.spanWeeks,
    progress: t.progress, manualProgress: t.manualProgress, targetProgress: t.targetProgress, links, summary: t.summary,
    effortHours: t.effortHours, status: t.status, epicKey: t.epicKey, resourceAccountId: t.resourceAccountId, parentKey: t.parentKey };
}

/** The undo-relevant values of every task on the plan and in the backlog. */
export function snapshotPlan(plan: { tasks?: any[]; backlogTasks?: any[] } | null): Map<string, TaskSnap> {
  const out = new Map<string, TaskSnap>();
  for (const t of (plan && plan.backlogTasks) || []) out.set(t.key, snap(t, false));
  for (const t of (plan && plan.tasks) || []) out.set(t.key, snap(t, true));
  return out;
}

/** Fields that differ, as the updates that set them to the values of `to`. */
function updatesTo(from: TaskSnap, to: TaskSnap, rollUpOnly: boolean): Record<string, unknown> {
  const u: Record<string, unknown> = {};
  if (!rollUpOnly && (from.startDate !== to.startDate || from.endDate !== to.endDate)) {
    u.startDate = to.startDate;
    u.endDate = to.endDate;
  }
  if (from.progress !== to.progress && (to.manualProgress || !rollUpOnly)) {
    if (to.manualProgress) u.progress = to.progress;
    else u.manualProgress = false;
  }
  for (const f of PLAIN) if (from[f] !== to[f]) u[f] = to[f];
  if (from.resourceAccountId !== to.resourceAccountId) u.resourceAccountId = to.resourceAccountId || 'unassigned';
  return u;
}

/**
 * One operation per link that differs: a link to add or whose percent changed is set, a link that
 * is gone is removed by its predecessor. Never "remove every link", which would delete Jira links
 * the action did not touch (ADR-006).
 */
function linkOps(key: string, from: TaskSnap, to: TaskSnap): UndoOp[] {
  const ops: UndoOp[] = [];
  const target = new Map(to.links.map(l => [l.predecessorKey, l.triggerPercent]));
  const source = new Map(from.links.map(l => [l.predecessorKey, l.triggerPercent]));
  for (const [pred, pct] of target) {
    if (source.get(pred) !== pct) ops.push({ kind: 'update', key, updates: { dependency: { predecessorKey: pred, predecessorId: pred, triggerPercent: pct, isTriggerSatisfied: false } } });
  }
  for (const pred of source.keys()) {
    if (!target.has(pred)) ops.push({ kind: 'update', key, updates: { removeDependency: { predecessorKey: pred } } });
  }
  return ops;
}

function scheduleOp(s: TaskSnap): UndoOp {
  return { kind: 'schedule', key: s.key, updates: { startWeek: s.startWeek, spanWeeks: s.spanWeeks, startDate: s.startDate, endDate: s.endDate } };
}

/**
 * The after-snapshot with each status Jira applied in this write. A read right after a workflow
 * transition can still show the old status; without this, Undo would not move the status back
 * (live on PAY-10, 2026-11-06). A status counts only when its write record lists "status".
 */
export function withWrittenStatuses(
  after: Map<string, TaskSnap>,
  payload: { taskId?: string; updates?: any; items?: Array<{ taskId: string; updates: any }> } | null | undefined,
  jiraSync: { writes?: Array<{ key: string; fields?: string[] }> } | null | undefined
): Map<string, TaskSnap> {
  const sent = new Map<string, string>();
  if (payload && payload.taskId && payload.updates && payload.updates.status) sent.set(payload.taskId, payload.updates.status);
  for (const i of (payload && payload.items) || []) if (i && i.taskId && i.updates && i.updates.status) sent.set(i.taskId, i.updates.status);
  if (!sent.size) return after;
  const applied = new Set(((jiraSync && jiraSync.writes) || []).filter(w => (w.fields || []).includes('status')).map(w => w.key));
  const out = new Map(after);
  for (const [key, status] of sent) {
    const snapNow = out.get(key);
    if (snapNow && applied.has(key)) out.set(key, { ...snapNow, status });
  }
  return out;
}

/** The undo entry for one write, or null when the write changed nothing. */
export function buildUndoEntry(before: Map<string, TaskSnap>, after: Map<string, TaskSnap>, targetKey: string): UndoEntry | null {
  const changed = [...after.keys()].filter(k => before.has(k) && JSON.stringify(before.get(k)) !== JSON.stringify(after.get(k)));
  const parents = new Set(changed.map(k => after.get(k)!.parentKey).filter(Boolean));
  const keys: string[] = [];
  const restore: UndoOp[] = [];
  const reapply: UndoOp[] = [];
  const ordered = changed.includes(targetKey) ? [targetKey, ...changed.filter(k => k !== targetKey)] : changed;
  for (const k of ordered) {
    const b = before.get(k)!;
    const a = after.get(k)!;
    if (b.scheduled !== a.scheduled) {
      keys.push(k);
      restore.push(b.scheduled ? scheduleOp(b) : { kind: 'unschedule', key: k });
      reapply.push(a.scheduled ? scheduleOp(a) : { kind: 'unschedule', key: k });
      continue;
    }
    const rollUpOnly = parents.has(k);
    const back = updatesTo(a, b, rollUpOnly);
    const backLinks = linkOps(k, a, b);
    if (Object.keys(back).length === 0 && backLinks.length === 0) continue;
    keys.push(k);
    if (Object.keys(back).length) restore.push({ kind: 'update', key: k, updates: back });
    restore.push(...backLinks);
    const fwd = updatesTo(b, a, rollUpOnly);
    if (Object.keys(fwd).length) reapply.push({ kind: 'update', key: k, updates: fwd });
    reapply.push(...linkOps(k, b, a));
  }
  return keys.length ? { keys, restore, reapply } : null;
}

/** Flag text for a write, e.g. "Moved ABC-12 and 4 dependents". */
export function actionLabel(fn: string, payload: { taskId?: string; updates?: any; items?: Array<{ taskId: string; updates: any }> }, entry: UndoEntry): string {
  if (fn === 'batchUpdateTasks') {
    // One undo for the whole batch (B-16).
    const items = payload.items || [];
    const n = items.length;
    const issues = `${n} issue${n === 1 ? '' : 's'}`;
    const others = entry.keys.filter(k => !items.some(i => i.taskId === k)).length;
    const first = (items[0] && items[0].updates) || {};
    if (first.startDate || first.endDate) return `Moved ${issues}` + (others ? ` and ${others} dependent${others > 1 ? 's' : ''}` : '');
    if (first.progress !== undefined) return `Set progress on ${issues}`;
    if (first.resourceAccountId !== undefined) return `Assigned ${issues}`;
    return `Changed ${issues}`;
  }
  const key = payload.taskId || entry.keys[0];
  const u = payload.updates || {};
  const others = entry.keys.filter(k => k !== key).length;
  const dependents = others ? ` and ${others} dependent${others > 1 ? 's' : ''}` : '';
  // N-03: unscheduling keeps the Jira due date, and the message says so.
  if (fn === 'unscheduleTask') return `Moved ${key} to the backlog. Its Jira due date is kept`;
  if (fn === 'scheduleBacklogTask') return `Scheduled ${key}`;
  // A block move (ADR-003): the parent with its sub-tasks, as one undo.
  if (fn === 'moveTaskGroup') return `Moved ${key} with its sub-tasks` + (others ? ` (${others} issue${others > 1 ? 's' : ''} changed)` : '');
  if (fn !== 'updateWbsTask') return `Changed ${key}`;
  if ('dependency' in u) return u.dependency ? `Linked ${key} to ${u.dependency.predecessorKey} at ${u.dependency.triggerPercent}%` : `Removed the links of ${key}`;
  if (u.removeDependency) return `Removed the link from ${u.removeDependency.predecessorKey} to ${key}`;
  if (u.startDate || u.endDate || u.startWeek) return `Moved ${key}${dependents}`;
  if (u.progress !== undefined) return `Set ${key} to ${u.progress}%`;
  return `Changed ${key}`;
}
