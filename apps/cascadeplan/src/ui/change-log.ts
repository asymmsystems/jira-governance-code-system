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
  parentKey?: string;
}

/**
 * Every issue and field a drop will change. A new end date is a Jira due date write. A new start date
 * is a write to the issue property cascadeplan.dates, so every plan shows it (ADR-008). The parent's
 * dates follow its children (its due date in Jira too, DEC-6). (INV-11: no task moves unseen.)
 */
export function describePendingWrites(tasks: PlanTask[], moves: Map<string, { start: string; end: string }>, key: string):
  { jira: string[]; starts: string[]; text: string } {
  const byKey = new Map(tasks.map(t => [t.key, t]));
  const jira: string[] = [];
  const starts: string[] = [];
  for (const [k, m] of moves) {
    const t = byKey.get(k);
    if (!t) continue;
    if (m.end !== t.endDate) jira.push(`${k} due ${m.end}`);
    if (m.start !== t.startDate) starts.push(`${k} ${m.start}`);
  }
  const parent = byKey.get(key)?.parentKey;
  const rollUp = parent && byKey.has(parent) ? ` ${parent} dates follow its children.` : '';
  const text = `Jira: ${jira.length ? jira.join(', ') : 'no due date change'}.`
    + (starts.length ? ` Start dates (every plan): ${starts.join(', ')}.` : '') + rollUp;
  return { jira, starts, text };
}
