/**
 * Copyright (c) 2026 Asymm Systems. All rights reserved.
 * @author Fahim Farook
 * FourRealities: snapshot rules (spec v2, Snapshot schedule). Pure, no I/O.
 */

import { IssueGates, IssueRow, ProjectSummary, SnapshotMeta, TrendPoint } from '../contract/data/models';
import { SnapshotEngine } from '../contract/engines';

const STALE_AFTER_MS = 7 * 24 * 60 * 60 * 1000;

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

  visibleRows(rows: IssueRow[], ids: Set<string>): IssueRow[] {
    return rows.filter(r => ids.has(r.issueId));
  }

  staleWarning(meta: SnapshotMeta, now: number): string | undefined {
    return now - Date.parse(meta.generatedAt) > STALE_AFTER_MS
      ? `Snapshot read on ${meta.generatedAt.slice(0, 10)} is more than 7 days old. Refresh to read Jira again.`
      : undefined;
  }
}
