/**
 * Copyright (c) 2026 Asymm Systems. All rights reserved.
 * @author Fahim Farook
 * FourRealities: dashboard filters by assignee, sprint, missing gate and search text (B-18, NF-01).
 * Pure functions over snapshot rows; the dashboard only renders them.
 */

import { GATE_NAMES, GateName, IssueRow, RiskLevel } from '../contract/data/models';
import { GATE_LABEL } from './gate-text';

/** Assignee filter value for rows with no assignee. */
export const UNASSIGNED = 'Unassigned';

export interface DashboardFilters {
  assignee: string | null;
  sprint: string | null;
  missingGate: GateName | null;
  risk: RiskLevel | null;
  search: string;
}

export const NO_FILTERS: DashboardFilters = { assignee: null, sprint: null, missingGate: null, risk: null, search: '' };

export type FilterField = 'assignee' | 'sprint' | 'missingGate' | 'risk';

export const RISK_WORD: Record<RiskLevel, string> = { CRITICAL: 'Critical', HIGH: 'High', MEDIUM: 'Medium', LOW: 'Low', UNRATED: 'Unrated' };

const byName = (a: string, b: string) => a.localeCompare(b);

/** The values each filter offers. A project without sprints has no sprint values. */
export function filterOptions(rows: IssueRow[]): { assignees: string[]; sprints: string[] } {
  const names = new Set(rows.map(r => r.assigneeName).filter((n): n is string => Boolean(n)));
  const unassigned = rows.some(r => !r.assigneeName);
  const sprints = new Set(rows.flatMap(r => r.sprintNames || []));
  return {
    assignees: [...Array.from(names).sort(byName), ...(unassigned ? [UNASSIGNED] : [])],
    sprints: Array.from(sprints).sort(byName)
  };
}

export function applyFilters(rows: IssueRow[], f: DashboardFilters): IssueRow[] {
  const q = f.search.trim().toLowerCase();
  return rows.filter(r =>
    (f.assignee === null || (r.assigneeName || UNASSIGNED) === f.assignee) &&
    (f.sprint === null || (r.sprintNames || []).includes(f.sprint)) &&
    (f.missingGate === null || r.gates[f.missingGate].state === 'MISSING') &&
    (f.risk === null || r.risk === f.risk) &&
    (!q || r.issueKey.toLowerCase().includes(q) || r.summary.toLowerCase().includes(q)));
}

export function missingGateLabel(gate: GateName): string {
  return `${GATE_LABEL[gate]} missing`;
}

export const GATE_FILTER_OPTIONS = GATE_NAMES.map(g => ({ label: missingGateLabel(g), value: g }));

/** Active filters other than search, each with the text of its remove button. */
export function activeFilters(f: DashboardFilters): Array<{ field: FilterField; label: string }> {
  return [
    ...(f.assignee !== null ? [{ field: 'assignee' as const, label: `Assignee: ${f.assignee}` }] : []),
    ...(f.sprint !== null ? [{ field: 'sprint' as const, label: `Sprint: ${f.sprint}` }] : []),
    ...(f.missingGate !== null ? [{ field: 'missingGate' as const, label: missingGateLabel(f.missingGate) }] : []),
    ...(f.risk !== null ? [{ field: 'risk' as const, label: `Risk: ${RISK_WORD[f.risk]}` }] : [])
  ];
}
