/*
 * Copyright (c) 2026 Asymm Systems. All rights reserved.
 *
 * @author Fahim Farook
 */

/**
 * CascadePlan: write transparency (pure; B-23). Rows for the Changes panel from the jiraSync report
 * of each write, and the text that names every change a drop will make before the user lets go.
 */

interface SyncWrite {
  key: string;
  fields: string[];
  ok: boolean;
  error?: string;
  changes?: Array<{ field: string; from: string | null; to: string | null }>;
}

export interface ChangeEntry {
  key: string;
  field: string;
  from: string | null;
  to: string | null;
  result: string;
}

/** One row per field of each Jira write, in the order the writes were made. */
export function toChangeEntries(sync: { ok?: boolean; writes?: SyncWrite[] } | undefined): ChangeEntry[] {
  const out: ChangeEntry[] = [];
  for (const w of (sync && sync.writes) || []) {
    const result = w.ok ? 'Written' : w.error ? `Not written: ${w.error}` : 'Not written';
    const changes = w.changes && w.changes.length ? w.changes : [{ field: w.fields.join(', '), from: null, to: null }];
    for (const c of changes) out.push({ key: w.key, field: c.field, from: c.from, to: c.to, result });
  }
  return out;
}

interface PlanTask {
  key: string;
  startDate?: string;
  endDate?: string;
  jiraDueDate?: string;
  parentKey?: string;
}

/**
 * Every Jira write a drop makes, before the drop (INV-03, INV-11, merge review H2). The moves come from
 * src/domain/drop-plan.ts, the same computation the server applies: the moved task, the cascaded
 * successors, the sub-tasks of a parent the cascade reaches, and each parent whose Jira due date
 * follows its roll-up end (DEC-6). A due date is listed when it differs from the issue's Jira due date
 * (the server sends the end of every moved issue). A new start date is a write to the issue property
 * cascadeplan.dates, so every plan shows it (ADR-008).
 */
export function describePendingWrites(tasks: PlanTask[], moves: Map<string, { start: string; end: string }>, key: string,
  extra: { parentDue?: Map<string, string>; epics?: string[] } = {}): { jira: string[]; starts: string[]; text: string } {
  void key;
  const byKey = new Map(tasks.map(t => [t.key, t]));
  const jira: string[] = [];
  const starts: string[] = [];
  const dueOf = (t: PlanTask) => (t.jiraDueDate ? String(t.jiraDueDate).slice(0, 10) : null);
  for (const [k, m] of moves) {
    const t = byKey.get(k);
    if (!t) continue;
    if (m.end !== dueOf(t)) jira.push(`${k} due ${m.end}`);
    if (m.start !== t.startDate) starts.push(`${k} ${m.start}`);
  }
  for (const [k, end] of extra.parentDue || []) {
    const t = byKey.get(k);
    if (t && end !== dueOf(t) && !moves.has(k)) jira.push(`${k} due ${end}`);
  }
  const epics = extra.epics || [];
  const text = `Jira: ${jira.length ? jira.join(', ') : 'no due date change'}.`
    + (starts.length ? ` Start dates (every plan): ${starts.join(', ')}.` : '')
    + (epics.length ? ` Not moved: ${epics.join(', ')} (epic; move its work items).` : '');
  return { jira, starts, text };
}
