/**
 * Copyright (c) 2026 Asymm Systems. All rights reserved.
 * @author Fahim Farook
 * FourRealities: triage order of the dashboard table and resolver error text (B-22). Pure functions.
 */

import { GATE_NAMES, IssueRow } from '../contract/data/models';

const RISK_RANK: Record<IssueRow['risk'], number> = { CRITICAL: 1, HIGH: 2, MEDIUM: 3, LOW: 4, UNRATED: 5 };

/** Rows sorted for triage: most missing evidence first, then risk, then lowest RAI, then key. */
export function triageOrder(rows: IssueRow[]): IssueRow[] {
  const missing = (r: IssueRow) => GATE_NAMES.filter(g => r.gates[g].state === 'MISSING').length;
  return [...rows].sort((a, b) =>
    missing(b) - missing(a) || RISK_RANK[a.risk] - RISK_RANK[b.risk] || (a.rai ?? 101) - (b.rai ?? 101) || a.issueKey.localeCompare(b.issueKey));
}

/** Error text from a resolver envelope or a thrown error. */
export function errorText(res: unknown, fallback: string): string {
  const r = res as { error?: { message?: string }; message?: string } | null | undefined;
  return r?.error?.message || r?.message || fallback;
}
