/*
 * Copyright (c) 2026 Asymm Systems. All rights reserved.
 *
 * @author Fahim Farook
 */

/**
 * CascadePlan: rows of the Changes panel, and the text that names every change before a drop (B-23).
 */

import { toChangeEntries, describePendingWrites } from '../../src/ui/change-log';

describe('toChangeEntries (B-23 criterion 2)', () => {
  it('gives one row per changed field with its old value, new value and result', () => {
    const sync = { ok: false, writes: [
      { key: 'API-5', fields: ['summary', 'duedate'], ok: true, changes: [{ field: 'summary', from: 'A', to: 'B' }, { field: 'due date', from: null, to: '2026-11-18' }] },
      { key: 'API-6', fields: ['duedate'], ok: false, error: 'screen', changes: [{ field: 'due date', from: '2026-11-20', to: '2026-11-25' }] },
      { key: 'API-6', fields: ['issuelink'], ok: true }
    ] };
    expect(toChangeEntries(sync)).toEqual([
      { key: 'API-5', field: 'summary', from: 'A', to: 'B', result: 'Written' },
      { key: 'API-5', field: 'due date', from: null, to: '2026-11-18', result: 'Written' },
      { key: 'API-6', field: 'due date', from: '2026-11-20', to: '2026-11-25', result: 'Not written: screen' },
      { key: 'API-6', field: 'issuelink', from: null, to: null, result: 'Written' }
    ]);
  });

  it('gives no rows for a result without Jira writes', () => {
    expect(toChangeEntries(undefined)).toEqual([]);
    expect(toChangeEntries({ ok: true, writes: [] })).toEqual([]);
    expect(toChangeEntries({ ok: false, writes: [{ key: 'X-1', fields: ['plan'], ok: false }] })).toEqual([
      { key: 'X-1', field: 'plan', from: null, to: null, result: 'Not written' }
    ]);
  });
});

describe('describePendingWrites (B-23 criterion 1)', () => {
  const tasks = [
    { key: 'API-4', startDate: '2026-11-01', endDate: '2026-11-10' },
    { key: 'API-5', startDate: '2026-11-11', endDate: '2026-11-17', parentKey: 'API-1' },
    { key: 'API-6', startDate: '2026-11-18', endDate: '2026-11-24' },
    { key: 'API-1', startDate: '2026-11-01', endDate: '2026-11-30' }
  ];

  it('names every issue and field: Jira due dates, then start dates (the shared issue property) and the parent roll-up', () => {
    const moves = new Map([['API-5', { start: '2026-11-12', end: '2026-11-18' }], ['API-6', { start: '2026-11-19', end: '2026-11-25' }]]);
    expect(describePendingWrites(tasks, moves, 'API-5')).toEqual({
      jira: ['API-5 due 2026-11-18', 'API-6 due 2026-11-25'],
      starts: ['API-5 2026-11-12', 'API-6 2026-11-19'],
      text: 'Jira: API-5 due 2026-11-18, API-6 due 2026-11-25. Start dates (every plan): API-5 2026-11-12, API-6 2026-11-19. API-1 dates follow its children.'
    });
  });

  it('a start-only change writes no due date, and no parent on the plan adds no roll-up', () => {
    const moves = new Map([['API-4', { start: '2026-11-03', end: '2026-11-10' }]]);
    expect(describePendingWrites(tasks, moves, 'API-4')).toEqual({ jira: [], starts: ['API-4 2026-11-03'],
      text: 'Jira: no due date change. Start dates (every plan): API-4 2026-11-03.' });
    const orphan = [{ key: 'B-2', startDate: '2026-11-01', endDate: '2026-11-02', parentKey: 'B-1' }];
    expect(describePendingWrites(orphan, new Map([['B-2', { start: '2026-11-01', end: '2026-11-04' }]]), 'B-2'))
      .toEqual({ jira: ['B-2 due 2026-11-04'], starts: [], text: 'Jira: B-2 due 2026-11-04.' });
    expect(describePendingWrites(tasks, new Map([['ZZ-1', { start: 'a', end: 'b' }]]), 'ZZ-1').jira).toEqual([]);
  });
});
