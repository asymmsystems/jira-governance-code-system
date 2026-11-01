/*
 * Copyright (c) 2026 Asymm Systems. All rights reserved.
 *
 * @author Fahim Farook
 */

/**
 * CascadePlan: the schedule engine (spec section 3.3; B-11, INV-09, INV-10, INV-11).
 *
 * One function computes the earliest start for the auto-move, the violation check, the cascade,
 * the preview and the reason text. Input is the WorkEffort model (B-24): efforts with dates and
 * percent complete, and FRACTIONAL_MILESTONE associations with a trigger percent.
 * All dates are UTC calendar days in YYYY-MM-DD form; every division rounds up to a whole day.
 */

import { WorkEffort, WorkEffortAssoc } from './models';

export type ScheduleEffort = Pick<WorkEffort, 'workEffortId' | 'estimatedStartDate' | 'estimatedCompletionDate' | 'percentComplete'> & {
  started?: boolean; // Jira status says work has begun, even at 0%
};

export type ScheduleLink = Pick<WorkEffortAssoc, 'workEffortIdFrom' | 'workEffortIdTo' | 'workEffortAssocTypeId' | 'triggerPercent' | 'isTriggerSatisfied'>;

export interface EarliestStart {
  basis: 'planned' | 'observed' | 'satisfied';
  date: string | null;        // earliest start of the successor; null when the link places no constraint
  triggerDate: string | null; // the day the predecessor reaches the trigger
  reason: string;
}

export interface EffortEvaluation {
  earliestStartDate: string | null;
  driver: string | null;
  violated: boolean;
  reason: string | null;
  suggestion?: string;
}

export interface CascadeChange {
  key: string;
  fromStart: string;
  fromEnd: string;
  toStart: string;
  toEnd: string;
  reason: string;
}

const DAY_MS = 86400000;

function dayNumber(iso: string): number {
  return Math.round(Date.parse(`${iso}T00:00:00Z`) / DAY_MS);
}

function isoOf(day: number): string {
  return new Date(day * DAY_MS).toISOString().slice(0, 10);
}

/** Adds whole days to an ISO date. */
export function addDays(iso: string, days: number): string {
  return isoOf(dayNumber(iso) + days);
}

function durationDays(e: ScheduleEffort): number {
  const s = dayNumber(e.estimatedStartDate as string);
  const end = dayNumber((e.estimatedCompletionDate || e.estimatedStartDate) as string);
  return Math.max(1, end - s + 1);
}

/**
 * Earliest start that one link allows for its successor (spec 3.3, items 1 to 4).
 */
export function earliestStart(pred: ScheduleEffort, triggerPercent: number, today: string): EarliestStart {
  const p = pred.percentComplete || 0;
  const x = triggerPercent;
  // A 0% trigger means "start together with": it is satisfied only once the predecessor has started.
  if (p >= x && (x > 0 || p > 0 || pred.started === true)) {
    return { basis: 'satisfied', date: null, triggerDate: null, reason: `${pred.workEffortId} is at ${p}%, past the ${x}% trigger` };
  }
  const s = dayNumber(pred.estimatedStartDate as string);
  const t = dayNumber(today);
  if (p > 0 && t > s) {
    const elapsed = Math.max(1, t - s);
    const rate = p / elapsed;
    const e = t + Math.ceil((x - p) / rate);
    return { basis: 'observed', date: isoOf(e), triggerDate: isoOf(e - 1),
      reason: `${pred.workEffortId} reaches ${x}% on ${isoOf(e - 1)} (observed: ${p}% in ${elapsed} days)` };
  }
  const d = durationDays(pred);
  const e = s + Math.ceil((d * x) / 100);
  const trigger = x === 0 ? s : e - 1;
  return { basis: 'planned', date: isoOf(e), triggerDate: isoOf(trigger),
    reason: `${pred.workEffortId} reaches ${x}% on ${isoOf(trigger)} (planned: ${d} days)` };
}

/**
 * Earliest start of an effort over all its incoming links, the driving predecessor, whether the
 * effort violates it, the reason text and what the user can change (spec 3.3, items 5 and 6).
 */
export function evaluateEffort(key: string, efforts: Map<string, ScheduleEffort>, links: ScheduleLink[], today: string): EffortEvaluation {
  const own = efforts.get(key);
  const incoming = links.filter(l => l.workEffortIdTo === key);
  if (!own || incoming.length === 0) return { earliestStartDate: null, driver: null, violated: false, reason: null };

  let best: { link: ScheduleLink; pred: ScheduleEffort; res: EarliestStart } | null = null;
  let satisfiedReason: string | null = null;
  for (const l of incoming) {
    const pred = efforts.get(l.workEffortIdFrom);
    if (!pred) return { earliestStartDate: null, driver: null, violated: true, reason: `Predecessor ${l.workEffortIdFrom} is not on the plan.` };
    const res = earliestStart(pred, l.triggerPercent as number, today);
    if (res.date === null) { satisfiedReason = satisfiedReason || res.reason; continue; }
    if (!best || res.date > (best.res.date as string)) best = { link: l, pred, res };
  }
  if (!best) return { earliestStartDate: null, driver: null, violated: false, reason: `No wait: ${satisfiedReason}.` };

  const e = best.res.date as string;
  const reason = `Starts ${e} because ${best.res.reason}.`;
  const started = own.started === true || (own.percentComplete || 0) > 0;
  if (started) {
    return { earliestStartDate: e, driver: best.pred.workEffortId, violated: true, reason,
      suggestion: `${key} has started, but ${best.pred.workEffortId} is at ${best.pred.percentComplete || 0}% of the ${best.link.triggerPercent}% trigger.` };
  }
  const ownStart = own.estimatedStartDate as string;
  if (ownStart >= e) return { earliestStartDate: e, driver: best.pred.workEffortId, violated: false, reason };

  let suggestion = `Move ${key} to ${e}`;
  if (best.res.basis === 'planned') {
    const lower = Math.floor(((dayNumber(ownStart) - dayNumber(best.pred.estimatedStartDate as string)) / durationDays(best.pred)) * 100);
    if (lower >= 0) suggestion += ` or lower the trigger to ${lower}%`;
  }
  return { earliestStartDate: e, driver: best.pred.workEffortId, violated: true, reason, suggestion: `${suggestion}.` };
}

/**
 * Forward pass from a changed effort, in topological order (Kahn). Moves a successor only when it
 * starts before its earliest start; keeps its duration; never moves anything earlier (spec 3.3, item 7).
 */
export function cascade(
  efforts: Map<string, ScheduleEffort>,
  links: ScheduleLink[],
  changedKey: string,
  today: string
): { changes: CascadeChange[]; efforts: Map<string, ScheduleEffort> } {
  const work = new Map([...efforts].map(([k, v]) => [k, { ...v }]));
  const succ = new Map<string, string[]>();
  for (const l of links) succ.set(l.workEffortIdFrom, [...(succ.get(l.workEffortIdFrom) || []), l.workEffortIdTo]);

  // Efforts reachable from the changed one.
  const reach = new Set<string>();
  const stack = [changedKey];
  while (stack.length) {
    const k = stack.pop() as string;
    for (const s of succ.get(k) || []) if (!reach.has(s)) { reach.add(s); stack.push(s); }
  }
  if (reach.has(changedKey)) throw new Error(`Dependency cycle through ${changedKey}`);

  // Kahn order over the reachable sub-graph (plus the changed effort).
  const nodes = new Set([changedKey, ...reach]);
  const indeg = new Map([...nodes].map(n => [n, 0]));
  for (const l of links) if (nodes.has(l.workEffortIdFrom) && nodes.has(l.workEffortIdTo)) indeg.set(l.workEffortIdTo, (indeg.get(l.workEffortIdTo) as number) + 1);
  const queue = [...nodes].filter(n => indeg.get(n) === 0);
  const order: string[] = [];
  while (queue.length) {
    const n = queue.shift() as string;
    order.push(n);
    for (const s of succ.get(n) || []) {
      if (!nodes.has(s)) continue;
      indeg.set(s, (indeg.get(s) as number) - 1);
      if (indeg.get(s) === 0) queue.push(s);
    }
  }
  if (order.length !== nodes.size) throw new Error('Dependency cycle in the plan');

  const changes: CascadeChange[] = [];
  for (const key of order) {
    if (key === changedKey) continue;
    const cur = work.get(key);
    if (!cur) continue;
    const ev = evaluateEffort(key, work, links, today);
    if (!ev.earliestStartDate || (cur.estimatedStartDate as string) >= ev.earliestStartDate) continue;
    const dur = durationDays(cur);
    const toStart = ev.earliestStartDate;
    const toEnd = addDays(toStart, dur - 1);
    changes.push({ key, fromStart: cur.estimatedStartDate as string, fromEnd: (cur.estimatedCompletionDate || cur.estimatedStartDate) as string,
      toStart, toEnd, reason: ev.reason as string });
    cur.estimatedStartDate = toStart;
    cur.estimatedCompletionDate = toEnd;
  }
  return { changes, efforts: work };
}

/**
 * Team factor F(N) = 1 + 0.25 x (min(N, 5) - 1). An assumption, not a research result (H7):
 * no gain for a task that has started or is late.
 */
export function teamFactor(people: number, startedOrLate: boolean): number {
  if (startedOrLate) return 1;
  return 1 + 0.25 * (Math.max(1, Math.min(people, 5)) - 1);
}

/**
 * End date suggested when people are added at plan time. The engine never applies it on its own.
 */
export function suggestedEnd(start: string, end: string, people: number, startedOrLate: boolean): string {
  const d = Math.max(1, dayNumber(end) - dayNumber(start) + 1);
  const shorter = Math.max(1, Math.ceil(d / teamFactor(people, startedOrLate)));
  return addDays(start, shorter - 1);
}
