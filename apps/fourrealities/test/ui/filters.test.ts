/**
 * Copyright (c) 2026 Asymm Systems. All rights reserved.
 * @author Fahim Farook
 * FourRealities: dashboard filters by assignee, sprint and missing gate (B-18, NF-01)
 */

import { GateResult, IssueRow } from '../../src/contract/data/models';
import { NO_FILTERS, PRESETS, activeFilters, personName, applyFilters, filterOptions, isPresetActive, presetFilters, togglePreset, toggleRisk, UNASSIGNED } from '../../src/ui/filters';

const F: GateResult = { state: 'FOUND', verification: 'VERIFIED', reason: 'INTENT_CONFLUENCE_LINK' };
const M: GateResult = { state: 'MISSING', reason: 'INTENT_NONE' };
const r = (key: string, assigneeAccountId: string | undefined, sprintNames: string[], intent = F): IssueRow => ({
  issueId: key, issueKey: key, summary: `Work ${key}`, statusName: 'Done', statusCategory: 'done', ...(assigneeAccountId ? { assigneeAccountId } : {}), sprintNames,
  started: true, gates: { intent, process: F, code: F, audit: F }, reworkLoops: 0, rai: 100, risk: 'LOW', applicableGates: 4, recoverablePoints: 0
} as IssueRow);

const rows = [r('A-1', 'acc-ana', ['Sprint 2']), r('A-2', undefined, ['Sprint 1', 'Sprint 2'], M), r('A-3', 'acc-bo', [], M)];
/** Names as the dashboard reads them for one view; they are never stored (ADR-014). */
const PEOPLE = { 'acc-bo': 'Bo Chen', 'acc-ana': 'Ana Silva' };

describe('filterOptions', () => {
  it('lists assignees by name, with the account id as the value and Unassigned last, and sprints in name order', () => {
    expect(filterOptions(rows, PEOPLE)).toEqual({
      assignees: [{ label: 'Ana Silva', value: 'acc-ana' }, { label: 'Bo Chen', value: 'acc-bo' }, { label: UNASSIGNED, value: UNASSIGNED }],
      sprints: ['Sprint 1', 'Sprint 2']
    });
  });

  it('has no sprints for a project without sprints, and says when a name could not be read', () => {
    expect(filterOptions([r('S-1', 'acc-ana', [])], PEOPLE).sprints).toEqual([]);
    expect(filterOptions([r('S-1', 'acc-zed', [])]).assignees).toEqual([{ label: 'Name not available', value: 'acc-zed' }]);
    expect(personName(PEOPLE, undefined)).toBe(UNASSIGNED);
  });
});

describe('applyFilters', () => {
  it('returns every row with no filter', () => {
    expect(applyFilters(rows, NO_FILTERS).map(x => x.issueKey)).toEqual(['A-1', 'A-2', 'A-3']);
  });

  it('filters by assignee, by Unassigned, by sprint and by missing gate, and combines them', () => {
    expect(applyFilters(rows, { ...NO_FILTERS, assignee: 'acc-ana' }).map(x => x.issueKey)).toEqual(['A-1']);
    expect(applyFilters(rows, { ...NO_FILTERS, assignee: UNASSIGNED }).map(x => x.issueKey)).toEqual(['A-2']);
    expect(applyFilters(rows, { ...NO_FILTERS, sprint: 'Sprint 2' }).map(x => x.issueKey)).toEqual(['A-1', 'A-2']);
    expect(applyFilters(rows, { ...NO_FILTERS, missingGate: 'intent' }).map(x => x.issueKey)).toEqual(['A-2', 'A-3']);
    expect(applyFilters(rows, { ...NO_FILTERS, assignee: UNASSIGNED, sprint: 'Sprint 1', missingGate: 'intent', search: 'a-2' }).map(x => x.issueKey)).toEqual(['A-2']);
  });

  it('matches the search text on key or summary, without case', () => {
    expect(applyFilters(rows, { ...NO_FILTERS, search: ' WORK A-3 ' }).map(x => x.issueKey)).toEqual(['A-3']);
  });
});

describe('activeFilters', () => {
  it('names each active filter so it can be removed on its own', () => {
    expect(activeFilters(NO_FILTERS)).toEqual([]);
    expect(activeFilters({ ...NO_FILTERS, assignee: UNASSIGNED }, PEOPLE)).toEqual([{ field: 'assignee', label: 'Assignee: Unassigned' }]);
    expect(activeFilters({ ...NO_FILTERS, assignee: 'acc-ana', sprint: 'Sprint 2', missingGate: 'code', search: 'x' }, PEOPLE)).toEqual([
      { field: 'assignee', label: 'Assignee: Ana Silva' },
      { field: 'sprint', label: 'Sprint: Sprint 2' },
      { field: 'missingGate', label: 'Code missing' }
    ]);
  });
});

describe('B-39: risk filter', () => {
  it('keeps the rows of the chosen risk levels, and names the filter for removal', () => {
    const risky = [{ ...rows[0], risk: 'HIGH' as const }, { ...rows[1], risk: 'LOW' as const }, { ...rows[2], risk: 'CRITICAL' as const }];
    expect(applyFilters(risky, { ...NO_FILTERS, risks: ['HIGH'] }).map(x => x.issueKey)).toEqual(['A-1']);
    expect(applyFilters(risky, { ...NO_FILTERS, risks: ['CRITICAL', 'HIGH'] }).map(x => x.issueKey)).toEqual(['A-1', 'A-3']);
    expect(activeFilters({ ...NO_FILTERS, risks: ['CRITICAL', 'HIGH'] })).toEqual([{ field: 'risks', label: 'Risk: Critical, High' }]);
    expect(toggleRisk(['CRITICAL'], 'HIGH')).toEqual(['CRITICAL', 'HIGH']);
    expect(toggleRisk(['CRITICAL', 'HIGH'], 'CRITICAL')).toEqual(['HIGH']);
  });
});

describe('B-40: preset views', () => {
  const mine = [{ ...rows[0], assigneeAccountId: 'acc-1' }, { ...rows[1], assigneeAccountId: 'acc-2' }, rows[2]];

  it('sets the filters of each preset, keeping the search text', () => {
    expect(presetFilters('mine', 'acc-1', 'x')).toEqual({ ...NO_FILTERS, assigneeId: 'acc-1', search: 'x' });
    expect(presetFilters('urgent', 'acc-1', '')).toEqual({ ...NO_FILTERS, risks: ['CRITICAL', 'HIGH'] });
    expect(presetFilters('audit', 'acc-1', '')).toEqual({ ...NO_FILTERS, missingGate: 'audit' });
    expect(presetFilters('decision', 'acc-1', '')).toEqual({ ...NO_FILTERS, missingGate: 'intent' });
    expect(PRESETS.map(p => p.label)).toEqual(['My issues', 'Critical and high', 'Audit prep', 'Needs a decision link']);
  });

  it('filters by the viewer account and names it "My issues"', () => {
    expect(applyFilters(mine, { ...NO_FILTERS, assigneeId: 'acc-1' }).map(x => x.issueKey)).toEqual(['A-1']);
    expect(activeFilters({ ...NO_FILTERS, assigneeId: 'acc-1' })).toEqual([{ field: 'assigneeId', label: 'My issues' }]);
  });

  it('B-48: detects active preset state accurately and toggles an active preset off while keeping search', () => {
    expect(isPresetActive(NO_FILTERS, 'mine', 'acc-1')).toBe(false);
    expect(isPresetActive(NO_FILTERS, 'mine', '')).toBe(false);
    const activeMine = togglePreset({ ...NO_FILTERS, search: 'DEMO' }, 'mine', 'acc-1');
    expect(activeMine).toEqual({ ...NO_FILTERS, assigneeId: 'acc-1', search: 'DEMO' });
    expect(isPresetActive(activeMine, 'mine', 'acc-1')).toBe(true);
    expect(isPresetActive(activeMine, 'urgent', 'acc-1')).toBe(false);
    expect(isPresetActive({ ...activeMine, sprint: 'Sprint 1' }, 'mine', 'acc-1')).toBe(false);
    expect(togglePreset(activeMine, 'mine', 'acc-1')).toEqual({ ...NO_FILTERS, search: 'DEMO' });

    const activeUrgent = togglePreset(NO_FILTERS, 'urgent', '');
    expect(isPresetActive(activeUrgent, 'urgent')).toBe(true);
    expect(isPresetActive({ ...NO_FILTERS, risks: ['CRITICAL'] }, 'urgent')).toBe(false);
    expect(togglePreset(activeUrgent, 'urgent', '')).toEqual(NO_FILTERS);

    const activeAudit = togglePreset(NO_FILTERS, 'audit', '');
    expect(isPresetActive(activeAudit, 'audit')).toBe(true);
    const activeDecision = togglePreset(activeAudit, 'decision', '');
    expect(isPresetActive(activeDecision, 'decision')).toBe(true);
    expect(isPresetActive(activeDecision, 'audit')).toBe(false);
  });
});
