/*
 * Copyright (c) 2026 Asymm Systems. All rights reserved.
 *
 * @author Fahim Farook
 */

/**
 * CascadePlan: baselines and their comparison (ADR-009). Pure functions.
 *
 * A baseline holds, for each leaf work item on the timeline, only its issue id and key, its Jira
 * estimate (none when unestimated), its start and end, and whether it was done. Summaries and names
 * are read live when shown.
 */

export interface BaselineItem {
  id: string;
  key: string;
  /** The Jira estimate in hours; absent when the issue has none (never a made-up value). */
  hours?: number;
  start?: string;
  end?: string;
  done?: boolean;
}

export interface BaselineHeader {
  id: string;
  planId: string;
  name: string;
  frozenAt: string;
  /** Account id of the plan approver who froze it (an audit subject, ADR-009 decision 7). */
  frozenBy: string | null;
  itemCount: number;
  totalHours: number;
  unestimated: number;
  chunks: number;
  digest: string;
  /** The baseline this one replaced when a scope change was approved. */
  supersedes?: string;
  v: 1;
}

export interface Baseline { header: BaselineHeader; items: BaselineItem[] }

export interface PlanItemLike {
  id: string;
  key: string;
  effortHours?: number;
  startDate?: string;
  endDate?: string;
  status?: string;
  isEpic?: boolean;
  hierarchyLevel?: number;
  datesFromChildren?: boolean;
  startWeek?: string;
}

const round1 = (n: number) => Math.round(n * 10) / 10;

/** The items of a plan a baseline freezes: leaf work items on the timeline, so hours count once. */
export function baselineItems(tasks: PlanItemLike[]): BaselineItem[] {
  return tasks
    .filter(t => t && t.id && t.key && !t.isEpic && (t.hierarchyLevel ?? 0) < 1 && !t.datesFromChildren && !!t.startDate)
    .map(t => {
      const item: BaselineItem = { id: String(t.id), key: t.key };
      if (typeof t.effortHours === 'number' && t.effortHours > 0) item.hours = round1(t.effortHours);
      if (t.startDate) item.start = t.startDate.slice(0, 10);
      if (t.endDate) item.end = t.endDate.slice(0, 10);
      if (t.status === 'COMPLETED') item.done = true;
      return item;
    })
    .sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
}

export function totals(items: BaselineItem[]): { itemCount: number; totalHours: number; unestimated: number } {
  return {
    itemCount: items.length,
    totalHours: round1(items.reduce((s, i) => s + (i.hours || 0), 0)),
    unestimated: items.filter(i => i.hours === undefined).length
  };
}

/** The canonical text the digest covers: the header fields that describe the content, then the items. */
export function canonicalText(h: Pick<BaselineHeader, 'id' | 'planId' | 'name' | 'frozenAt' | 'itemCount' | 'totalHours' | 'unestimated'>, items: BaselineItem[]): string {
  const head = { id: h.id, planId: h.planId, name: h.name, frozenAt: h.frozenAt, itemCount: h.itemCount, totalHours: h.totalHours, unestimated: h.unestimated };
  const rows = items.map(i => [i.id, i.key, i.hours ?? null, i.start ?? null, i.end ?? null, !!i.done]);
  return JSON.stringify({ head, rows });
}

export interface ItemChange {
  id: string;
  key: string;
  fromHours?: number;
  toHours?: number;
  fromStart?: string;
  toStart?: string;
  fromEnd?: string;
  toEnd?: string;
}

export interface Comparison {
  added: BaselineItem[];
  removed: BaselineItem[];
  changed: ItemChange[];
  fromHours: number;
  toHours: number;
  deltaHours: number;
  /** Change of the total hours in percent of the baseline, one decimal; 0 when the baseline has none. */
  deltaPercent: number;
  fromCount: number;
  toCount: number;
  /** Items whose end moved later. */
  slipped: number;
  /** True when work was added, an estimate grew or an end moved later. */
  grew: boolean;
}

/** Compares two sets of items: a baseline against the current plan, or against another baseline. */
export function compareItems(from: BaselineItem[], to: BaselineItem[]): Comparison {
  const a = new Map(from.map(i => [i.id, i]));
  const b = new Map(to.map(i => [i.id, i]));
  const added = to.filter(i => !a.has(i.id));
  const removed = from.filter(i => !b.has(i.id));
  const changed: ItemChange[] = [];
  for (const x of from) {
    const y = b.get(x.id);
    if (!y) continue;
    if (x.hours === y.hours && x.start === y.start && x.end === y.end) continue;
    const c: ItemChange = { id: x.id, key: y.key };
    if (x.hours !== y.hours) { c.fromHours = x.hours; c.toHours = y.hours; }
    if (x.start !== y.start) { c.fromStart = x.start; c.toStart = y.start; }
    if (x.end !== y.end) { c.fromEnd = x.end; c.toEnd = y.end; }
    changed.push(c);
  }
  const fromHours = totals(from).totalHours;
  const toHours = totals(to).totalHours;
  const deltaHours = round1(toHours - fromHours);
  const slipped = changed.filter(c => c.fromEnd && c.toEnd && c.toEnd > c.fromEnd).length;
  const grew = added.length > 0 || deltaHours > 0 || slipped > 0 || changed.some(c => (c.toHours || 0) > (c.fromHours || 0));
  return {
    added, removed, changed, fromHours, toHours, deltaHours,
    deltaPercent: fromHours > 0 ? round1((deltaHours / fromHours) * 100) : 0,
    fromCount: from.length, toCount: to.length, slipped, grew
  };
}

/** CSV of a baseline: one row per item, with the digest in a comment line (RFC 4180 quoting). */
export function baselineCsv(b: Baseline): string {
  const q = (v: unknown) => {
    const s = v === undefined || v === null ? '' : String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const lines = [
    `# ${q(b.header.name)}, frozen ${b.header.frozenAt}, SHA-256 ${b.header.digest}`,
    'issue_id,issue_key,estimate_hours,start,end,done',
    ...b.items.map(i => [i.id, i.key, i.hours, i.start, i.end, i.done ? 'yes' : 'no'].map(q).join(','))
  ];
  return lines.join('\n') + '\n';
}
