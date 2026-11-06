/**
 * Copyright (c) 2026 Asymm Systems. All rights reserved.
 * @author Fahim Farook
 * FourRealities: snapshot rules (spec v2, Snapshot schedule). Pure, no I/O.
 */

import { IssueGates, IssueRow, ProjectSummary, SnapshotMeta, TrendPoint } from '../contract/data/models';
import { SnapshotEngine } from '../contract/engines';

const STALE_AFTER_MS = 7 * 24 * 60 * 60 * 1000;

/** Text cuts for a stored row (F-M2): an Intent title, sprint names and how many sprints. */
export const STORED_TEXT_MAX = 120;
export const STORED_SPRINT_MAX = 60;
export const STORED_SPRINTS = 5;

const cut = (text: string, max: number) => (text.length > max ? text.slice(0, max - 3) + '...' : text);

/** Monday (UTC) of the ISO week that holds the given time, as YYYY-MM-DD. */
export function weekStartOf(iso: string): string {
  const d = new Date(iso);
  const day = (d.getUTCDay() + 6) % 7;
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() - day)).toISOString().slice(0, 10);
}

export class DefaultSnapshotEngine implements SnapshotEngine {
  readonly serviceType = 'engine' as const;

  weekStartOf(iso: string): string {
    return weekStartOf(iso);
  }

  /** One trend point per ISO week, from the project summary. */
  trendPoint(summary: ProjectSummary, generatedAt: string): TrendPoint {
    const g = summary.gates;
    return {
      weekStart: weekStartOf(generatedAt),
      generatedAt,
      ratedIssues: summary.ratedIssues,
      averageRAI: summary.averageRAI,
      gates: {
        intent: { found: g.intent.found, missing: g.intent.missing },
        process: { found: g.process.found, missing: g.process.missing },
        code: { found: g.code.found, missing: g.code.missing },
        audit: { found: g.audit.found, missing: g.audit.missing }
      },
      startedIssues: summary.startedIssues,
      reworkIssues: summary.reworkIssues
    };
  }

  /** An issue whose remote links were not read keeps its previous Intent result, if it had one. */
  keepPreviousIntent(gates: IssueGates, remoteLinksRead: boolean, previous?: IssueRow): IssueGates {
    if (!remoteLinksRead && previous && previous.gates.intent.state !== 'NEEDS_RECHECK') {
      return { ...gates, intent: previous.gates.intent };
    }
    return gates;
  }

  /**
   * The row as a snapshot stores it (ADR-014, F-M2): no Code exception, no rework note and no
   * other person's id; the gate state already says what counts. Free text is cut.
   */
  storedRow(row: IssueRow): IssueRow {
    const { codeException: _exception, reworkNote: _note, reworkNoteCount: _count, ...rest } = row;
    const gates = Object.fromEntries(Object.entries(row.gates).map(([g, r]) => [g, r.args
      ? { ...r, args: Object.fromEntries(Object.entries(r.args).map(([k, v]) => [k, typeof v === 'string' ? cut(v, STORED_TEXT_MAX) : v])) }
      : r])) as IssueGates;
    return { ...rest, gates, sprintNames: row.sprintNames.slice(0, STORED_SPRINTS).map(n => cut(n, STORED_SPRINT_MAX)) };
  }

  visibleRows(rows: IssueRow[], ids: Set<string>): IssueRow[] {
    return rows.filter(r => ids.has(r.issueId));
  }

  staleWarning(meta: SnapshotMeta, now: number): string | undefined {
    return now - Date.parse(meta.generatedAt) > STALE_AFTER_MS
      ? `Snapshot read on ${meta.generatedAt.slice(0, 10)} is more than 7 days old. Refresh to read Jira again.`
      : undefined;
  }
}
