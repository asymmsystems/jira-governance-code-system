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
  /** Account id of the assignee, or UNASSIGNED. Names are only shown, never stored (ADR-014). */
  assignee: string | null;
  sprint: string | null;
  missingGate: GateName | null;
  /** Risk levels to keep; empty keeps all. */
  risks: RiskLevel[];
  /** Account id of the assignee ("My issues"). */
  assigneeId: string | null;
  search: string;
}

export const NO_FILTERS: DashboardFilters = { assignee: null, sprint: null, missingGate: null, risks: [], assigneeId: null, search: '' };

export type FilterField = 'assignee' | 'sprint' | 'missingGate' | 'risks' | 'assigneeId';

export const RISK_WORD: Record<RiskLevel, string> = { CRITICAL: 'Critical', HIGH: 'High', MEDIUM: 'Medium', LOW: 'Low', UNRATED: 'Unrated' };

const byName = (a: string, b: string) => a.localeCompare(b);

/** The name shown for an assignee: from the names read for this view, else a neutral text. */
export function personName(people: Readonly<Record<string, string>> | undefined, accountId: string | undefined): string {
  if (!accountId) return UNASSIGNED;
  return people?.[accountId] || 'Name not available';
}

/**
 * The values each filter offers. Assignees are offered by name (read for this view) with their
 * account id as the value; Unassigned last. A project without sprints has no sprint values.
 */
export function filterOptions(rows: IssueRow[], people: Readonly<Record<string, string>> = {}): { assignees: Array<{ label: string; value: string }>; sprints: string[] } {
  const ids = Array.from(new Set(rows.map(r => r.assigneeAccountId).filter((id): id is string => Boolean(id))));
  const unassigned = rows.some(r => !r.assigneeAccountId);
  const sprints = new Set(rows.flatMap(r => r.sprintNames || []));
  return {
    assignees: [
      ...ids.map(id => ({ label: personName(people, id), value: id })).sort((a, b) => byName(a.label, b.label)),
      ...(unassigned ? [{ label: UNASSIGNED, value: UNASSIGNED }] : [])
    ],
    sprints: Array.from(sprints).sort(byName)
  };
}

export function applyFilters(rows: IssueRow[], f: DashboardFilters): IssueRow[] {
  const q = f.search.trim().toLowerCase();
  return rows.filter(r =>
    (f.assignee === null || (r.assigneeAccountId || UNASSIGNED) === f.assignee) &&
    (f.sprint === null || (r.sprintNames || []).includes(f.sprint)) &&
    (f.missingGate === null || r.gates[f.missingGate].state === 'MISSING') &&
    (f.risks.length === 0 || f.risks.includes(r.risk)) &&
    (f.assigneeId === null || r.assigneeAccountId === f.assigneeId) &&
    (!q || r.issueKey.toLowerCase().includes(q) || r.summary.toLowerCase().includes(q)));
}

export function missingGateLabel(gate: GateName): string {
  return `${GATE_LABEL[gate]} missing`;
}

export const GATE_FILTER_OPTIONS = GATE_NAMES.map(g => ({ label: missingGateLabel(g), value: g }));

/** Active filters other than search, each with the text of its remove button. */
export function activeFilters(f: DashboardFilters, people: Readonly<Record<string, string>> = {}): Array<{ field: FilterField; label: string }> {
  return [
    ...(f.assignee !== null ? [{ field: 'assignee' as const, label: `Assignee: ${f.assignee === UNASSIGNED ? UNASSIGNED : personName(people, f.assignee)}` }] : []),
    ...(f.sprint !== null ? [{ field: 'sprint' as const, label: `Sprint: ${f.sprint}` }] : []),
    ...(f.missingGate !== null ? [{ field: 'missingGate' as const, label: missingGateLabel(f.missingGate) }] : []),
    ...(f.risks.length > 0 ? [{ field: 'risks' as const, label: `Risk: ${f.risks.map(r => RISK_WORD[r]).join(', ')}` }] : []),
    ...(f.assigneeId !== null ? [{ field: 'assigneeId' as const, label: 'My issues' }] : [])
  ];
}

const RISK_ORDER: RiskLevel[] = ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW', 'UNRATED'];

/** Adds or removes one risk level, kept in severity order. */
export function toggleRisk(risks: RiskLevel[], level: RiskLevel): RiskLevel[] {
  const next = risks.includes(level) ? risks.filter(r => r !== level) : [...risks, level];
  return RISK_ORDER.filter(r => next.includes(r));
}

export type PresetName = 'mine' | 'urgent' | 'audit' | 'decision';

/** Preset views (B-40). "My issues" needs the viewer's account id. */
export const PRESETS: Array<{ name: PresetName; label: string }> = [
  { name: 'mine', label: 'My issues' },
  { name: 'urgent', label: 'Critical and high' },
  { name: 'audit', label: 'Audit prep' },
  { name: 'decision', label: 'Needs a decision link' }
];

export function presetFilters(name: PresetName, viewerAccountId: string, search: string): DashboardFilters {
  const base = { ...NO_FILTERS, search };
  switch (name) {
    case 'mine': return { ...base, assigneeId: viewerAccountId };
    case 'urgent': return { ...base, risks: ['CRITICAL', 'HIGH'] };
    case 'audit': return { ...base, missingGate: 'audit' };
    default: return { ...base, missingGate: 'intent' };
  }
}

/** True when the active filters match the preset exactly (ignoring free-text search). */
export function isPresetActive(f: DashboardFilters, name: PresetName, viewerAccountId = ''): boolean {
  if (name === 'mine' && !viewerAccountId) return false;
  const target = presetFilters(name, viewerAccountId, f.search);
  const sameScalars = [f.assignee, f.sprint, f.missingGate, f.assigneeId]
    .every((v, i) => v === [target.assignee, target.sprint, target.missingGate, target.assigneeId][i]);
  const sameRisks = f.risks.length === target.risks.length && f.risks.every((r, i) => r === target.risks[i]);
  return sameScalars && sameRisks;
}

/** Applies a preset, or clears back to NO_FILTERS (preserving search) when clicked again. */
export function togglePreset(f: DashboardFilters, name: PresetName, viewerAccountId: string): DashboardFilters {
  return isPresetActive(f, name, viewerAccountId)
    ? { ...NO_FILTERS, search: f.search }
    : presetFilters(name, viewerAccountId, f.search);
}

