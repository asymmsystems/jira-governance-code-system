/**
 * Copyright (c) 2026 Asymm Systems. All rights reserved.
 * @author Fahim Farook
 * FourRealities: dashboard filters by assignee, sprint and missing gate (B-18, NF-01)
 */

import { GateResult, IssueRow } from '../../src/contract/data/models';
import { NO_FILTERS, activeFilters, applyFilters, filterOptions, UNASSIGNED } from '../../src/ui/filters';

const F: GateResult = { state: 'FOUND', verification: 'VERIFIED', reason: 'INTENT_CONFLUENCE_LINK' };
const M: GateResult = { state: 'MISSING', reason: 'INTENT_NONE' };
const r = (key: string, assigneeName: string | undefined, sprintNames: string[], intent = F): IssueRow => ({
  issueId: key, issueKey: key, summary: `Work ${key}`, statusName: 'Done', statusCategory: 'done', assigneeName, sprintNames,
  started: true, gates: { intent, process: F, code: F, audit: F }, reworkLoops: 0, rai: 100, risk: 'LOW', applicableGates: 4, recoverablePoints: 0
} as IssueRow);

const rows = [r('A-1', 'Ana Silva', ['Sprint 2']), r('A-2', undefined, ['Sprint 1', 'Sprint 2'], M), r('A-3', 'Bo Chen', [], M)];

describe('filterOptions', () => {
  it('lists assignees by name with Unassigned last, and sprints in name order', () => {
    expect(filterOptions(rows)).toEqual({ assignees: ['Ana Silva', 'Bo Chen', UNASSIGNED], sprints: ['Sprint 1', 'Sprint 2'] });
  });

  it('has no sprints for a project without sprints, so the Sprint filter is hidden', () => {
    expect(filterOptions([r('S-1', 'Ana Silva', [])]).sprints).toEqual([]);
    expect(filterOptions([r('S-1', 'Ana Silva', [])]).assignees).toEqual(['Ana Silva']);
  });
});

describe('applyFilters', () => {
  it('returns every row with no filter', () => {
    expect(applyFilters(rows, NO_FILTERS).map(x => x.issueKey)).toEqual(['A-1', 'A-2', 'A-3']);
  });

  it('filters by assignee, by Unassigned, by sprint and by missing gate, and combines them', () => {
    expect(applyFilters(rows, { ...NO_FILTERS, assignee: 'Ana Silva' }).map(x => x.issueKey)).toEqual(['A-1']);
    expect(applyFilters(rows, { ...NO_FILTERS, assignee: UNASSIGNED }).map(x => x.issueKey)).toEqual(['A-2']);
    expect(applyFilters(rows, { ...NO_FILTERS, sprint: 'Sprint 2' }).map(x => x.issueKey)).toEqual(['A-1', 'A-2']);
    expect(applyFilters(rows, { ...NO_FILTERS, missingGate: 'intent' }).map(x => x.issueKey)).toEqual(['A-2', 'A-3']);
    expect(applyFilters(rows, { assignee: UNASSIGNED, sprint: 'Sprint 1', missingGate: 'intent', search: 'a-2' }).map(x => x.issueKey)).toEqual(['A-2']);
  });

  it('matches the search text on key or summary, without case', () => {
    expect(applyFilters(rows, { ...NO_FILTERS, search: ' WORK A-3 ' }).map(x => x.issueKey)).toEqual(['A-3']);
  });
});

describe('activeFilters', () => {
  it('names each active filter so it can be removed on its own', () => {
    expect(activeFilters(NO_FILTERS)).toEqual([]);
    expect(activeFilters({ assignee: 'Ana Silva', sprint: 'Sprint 2', missingGate: 'code', search: 'x' })).toEqual([
      { field: 'assignee', label: 'Assignee: Ana Silva' },
      { field: 'sprint', label: 'Sprint: Sprint 2' },
      { field: 'missingGate', label: 'Code missing' }
    ]);
  });
});
