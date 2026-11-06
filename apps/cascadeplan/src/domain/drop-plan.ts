/*
 * Copyright (c) 2026 Asymm Systems. All rights reserved.
 *
 * @author Fahim Farook
 */

/**
 * CascadePlan: what a drop changes, computed once for the server and the drop preview (INV-03,
 * merge review H2). The server's updateWbsTask and moveTaskGroup apply these changes; the planner
 * lists the same changes before the drop. The rules:
 *   - the moved task, and the successors the schedule engine moves (B-10, B-11);
 *   - the cascade also runs from every ancestor whose roll-up changed (N-06 rule 1);
 *   - a cascade into a task or story parent moves its sub-tasks as a block (N-06 rule 2, ADR-003);
 *     a cascade into an epic moves nothing (DEC-5b);
 *   - a parent whose roll-up end changed gets that end as its Jira due date (DEC-6).
 * Pure functions only: no Forge or browser import.
 */

import { ScheduleEffort, ScheduleLink, cascade } from './schedule-engine';
import { planBlockMove } from './block-move';
import { rollUpParentDates } from './work-effort-links';

export interface DropTask {
  key: string;
  id?: string;
  parentKey?: string;
  startDate?: string;
  endDate?: string;
  progress?: number;
  status?: string;
  datesFromChildren?: boolean;
  isEpic?: boolean;
  hierarchyLevel?: number;
  jiraDueDate?: string;
  dependency?: { predecessorKey?: string; triggerPercent?: number } | null;
  dependencies?: Array<{ predecessorKey?: string; triggerPercent?: number }>;
}

export interface DropChange { key: string; toStart: string; toEnd: string }

const ISO = /^\d{4}-\d{2}-\d{2}$/;
const isIso = (v: unknown): v is string => typeof v === 'string' && ISO.test(v);
const dayDiff = (a: string, b: string) => Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / 86400000);

/** Efforts and links of the schedule engine for a task list. */
export function engineInputs(tasks: Array<Partial<DropTask>>): { efforts: Map<string, ScheduleEffort>; links: ScheduleLink[] } {
  const efforts = new Map<string, ScheduleEffort>();
  const links: ScheduleLink[] = [];
  for (const t of tasks) {
    if (!t.key || !isIso(t.startDate)) continue;
    efforts.set(t.key, {
      workEffortId: t.key,
      estimatedStartDate: t.startDate,
      estimatedCompletionDate: isIso(t.endDate) ? t.endDate : t.startDate,
      percentComplete: t.progress || 0,
      started: t.status === 'IN_PROGRESS' || t.status === 'COMPLETED'
    });
    for (const d of t.dependencies || (t.dependency ? [t.dependency] : [])) {
      if (d.predecessorKey && typeof d.triggerPercent === 'number') {
        links.push({ workEffortIdFrom: d.predecessorKey, workEffortIdTo: t.key, workEffortAssocTypeId: 'WORK_EFF_PRECEDENCY', triggerPercent: d.triggerPercent });
      }
    }
  }
  return { efforts, links };
}

/** The keys of every ancestor of a task, nearest first. */
export function ancestorKeys(key: string, tasks: Array<{ key: string; parentKey?: string }>): string[] {
  const byKey = new Map(tasks.map(t => [t.key, t]));
  const out: string[] = [];
  let cur = byKey.get(key)?.parentKey;
  while (cur && !out.includes(cur)) { out.push(cur); cur = byKey.get(cur)?.parentKey; }
  return out;
}

/** A copy of the tasks with every roll-up parent's dates recomputed from its dated children. */
export function withRollUps<T extends { key: string; parentKey?: string; startDate?: string; endDate?: string; datesFromChildren?: boolean }>(tasks: T[]): T[] {
  let out = tasks.map(t => ({ ...t }));
  for (let pass = 0; pass < 4; pass++) {
    const spans = rollUpParentDates(out);
    let changed = false;
    out = out.map(t => {
      const span = spans.get(t.key);
      if (!span || (t.startDate === span.startDate && t.endDate === span.endDate)) return t;
      changed = true;
      return { ...t, ...span, datesFromChildren: true };
    });
    if (!changed) break;
  }
  return out;
}

/**
 * N-06 rule 2, ADR-003 section 3: a cascade that reaches a task or story roll-up parent moves the
 * parent's block by the block rules; the parent has no record of its own to write. A cascade into
 * an epic is not applied in v1 (DEC-5b): the epic is returned, to be reported "not moved".
 * Keys in `exclude` (the task the user moved) are never changed by the expansion.
 */
export function expandParentCascades<C extends DropChange>(
  changes: C[], tasks: DropTask[], today: string, exclude: Set<string> = new Set()
): { changes: DropChange[]; epics: string[] } {
  const out: DropChange[] = [];
  const epics: string[] = [];
  const seen = new Set(exclude);
  for (const c of changes) {
    const t = tasks.find(x => x.key === c.key);
    if (!t || !t.datesFromChildren) {
      if (!seen.has(c.key)) { out.push(c); seen.add(c.key); }
      continue;
    }
    if (t.isEpic || (t.hierarchyLevel ?? 0) >= 1) { epics.push(c.key); continue; }
    if (!isIso(t.startDate)) continue;
    const days = dayDiff(t.startDate, c.toStart);
    if (days === 0) continue;
    for (const b of planBlockMove(tasks.filter(x => x.parentKey === t.key), days, today).changes) {
      if (!seen.has(b.key)) { out.push({ key: b.key, toStart: b.toStart, toEnd: b.toEnd }); seen.add(b.key); }
    }
  }
  return { changes: out, epics };
}

export interface CascadeResult { changes: DropChange[]; epics: string[]; cycles: string[] }

/**
 * The cascade of a single task's new dates (updateWbsTask): from the task, then from every ancestor
 * whose roll-up changed, expanded into parents' blocks. `timeline` is the plan's timeline tasks,
 * `all` adds the backlog.
 */
export function singleMoveCascade(timeline: DropTask[], all: DropTask[], key: string, patch: Partial<DropTask>, today: string): CascadeResult {
  const candidate = withRollUps(timeline.map(t => (t.key === key ? { ...t, ...patch } : t)));
  const inputs = engineInputs(candidate);
  const first = cascade(inputs.efforts, inputs.links, key, today);
  const cycles = [...(first.cycle || [])];
  const changes: DropChange[] = first.changes.map(c => ({ key: c.key, toStart: c.toStart, toEnd: c.toEnd }));
  let efforts = first.efforts;
  for (const anc of ancestorKeys(key, timeline)) {
    const was = timeline.find(t => t.key === anc);
    const now = candidate.find(t => t.key === anc);
    if (!was || !now || !now.datesFromChildren || (was.startDate === now.startDate && was.endDate === now.endDate)) continue;
    const more = cascade(efforts, inputs.links, anc, today);
    cycles.push(...(more.cycle || []));
    for (const c of more.changes) if (!changes.some(x => x.key === c.key)) changes.push({ key: c.key, toStart: c.toStart, toEnd: c.toEnd });
    efforts = more.efforts;
  }
  const expanded = expandParentCascades(changes, all, today, new Set([key]));
  return { changes: expanded.changes, epics: expanded.epics, cycles };
}

/** The cascade from several roots on a candidate plan (block moves, parent changes). */
export function cascadeFromRoots(candidate: DropTask[], all: DropTask[], roots: string[], exclude: Set<string>, today: string): CascadeResult {
  const inputs = engineInputs(candidate);
  let efforts = inputs.efforts;
  const out: DropChange[] = [];
  const epics: string[] = [];
  const cycles: string[] = [];
  for (const root of roots) {
    const r = cascade(efforts, inputs.links, root, today);
    cycles.push(...(r.cycle || []));
    efforts = r.efforts;
    const expanded = expandParentCascades(r.changes, all, today, exclude);
    epics.push(...expanded.epics);
    for (const c of expanded.changes) if (!out.some(x => x.key === c.key)) out.push(c);
  }
  return { changes: out, epics, cycles };
}

/**
 * DEC-6: the parents whose roll-up end changes with these moves, and the end that becomes their Jira
 * due date (skipped when Jira already holds it).
 */
export function parentDueDateTargets<T extends DropTask>(
  before: T[], moved: Map<string, { startDate?: string; endDate?: string }>, reparent?: { key: string; parentKey?: string }
): Array<{ key: string; id?: string; endDate: string; was: T }> {
  const shifted = before.map(t => {
    let n: T = moved.has(t.key) ? { ...t, ...moved.get(t.key) } : t;
    if (reparent && t.key === reparent.key) n = { ...n, parentKey: reparent.parentKey };
    return n;
  });
  const after = withRollUps(shifted);
  const parents = new Set<string>();
  for (const key of moved.keys()) for (const a of ancestorKeys(key, before)) if (!moved.has(a)) parents.add(a);
  if (reparent) for (const list of [before, shifted]) for (const a of ancestorKeys(reparent.key, list)) parents.add(a);
  const out: Array<{ key: string; id?: string; endDate: string; was: T }> = [];
  for (const key of parents) {
    const was = before.find(t => t.key === key);
    const now = after.find(t => t.key === key);
    if (!was || !now || !now.datesFromChildren || !isIso(now.endDate) || was.endDate === now.endDate) continue;
    if (String(was.jiraDueDate || '').slice(0, 10) === now.endDate) continue;
    out.push({ key, id: was.id, endDate: now.endDate as string, was });
  }
  return out;
}

/** Every Jira write a drop makes, for the preview: new dates per issue, parent due dates, epics not moved. */
export interface DropPreview {
  moves: Map<string, { start: string; end: string }>;
  parentDue: Map<string, string>;
  epics: string[];
}

function finish(all: DropTask[], moves: Map<string, { start: string; end: string }>, epics: string[]): DropPreview {
  const moved = new Map([...moves].map(([k, m]) => [k, { startDate: m.start, endDate: m.end }]));
  const parentDue = new Map(parentDueDateTargets(all, moved).map(t => [t.key, t.endDate]));
  return { moves, parentDue, epics: [...new Set(epics)] };
}

/** The writes of a single task's move to exact dates (the server's updateWbsTask). */
export function previewSingleMove(plan: { tasks: DropTask[]; backlogTasks?: DropTask[] }, key: string, start: string, end: string, today: string): DropPreview {
  const all = [...plan.tasks, ...(plan.backlogTasks || [])];
  const moves = new Map<string, { start: string; end: string }>();
  if (!all.some(t => t.key === key)) return { moves, parentDue: new Map(), epics: [] };
  moves.set(key, { start, end });
  const r = singleMoveCascade(plan.tasks, all, key, { startDate: start, endDate: end }, today);
  for (const c of r.changes) moves.set(c.key, { start: c.toStart, end: c.toEnd });
  return finish(all, moves, r.epics);
}

/** The writes of a block move of a parent by `days` (the server's moveTaskGroup). */
export function previewBlockMove(plan: { tasks: DropTask[]; backlogTasks?: DropTask[] }, parentKey: string, days: number, today: string): DropPreview {
  const all = [...plan.tasks, ...(plan.backlogTasks || [])];
  const members = all.filter(t => t.parentKey === parentKey);
  const moves = new Map<string, { start: string; end: string }>();
  const block = planBlockMove(members, days, today).changes;
  if (block.length === 0) return { moves, parentDue: new Map(), epics: [] };
  for (const c of block) moves.set(c.key, { start: c.toStart, end: c.toEnd });
  const moved = new Map(block.map(c => [c.key, { startDate: c.toStart, endDate: c.toEnd }]));
  const candidate = withRollUps(all.map(t => (moved.has(t.key) ? { ...t, ...moved.get(t.key) } : t)));
  const roots = [parentKey, ...block.map(c => c.key), ...ancestorKeys(parentKey, all)];
  const r = cascadeFromRoots(candidate, all, roots, new Set([parentKey, ...members.map(m => m.key)]), today);
  for (const c of r.changes) moves.set(c.key, { start: c.toStart, end: c.toEnd });
  return finish(all, moves, r.epics);
}
