/*
 * Copyright (c) 2026 Asymm Systems. All rights reserved.
 *
 * @author Fahim Farook
 */

/**
 * CascadePlan: old and new value of each Jira field a write sends, for the Changes panel (B-23).
 */

import { describeJiraChanges } from '../../src/domain/jira-change';

describe('describeJiraChanges (B-23)', () => {
  it('names each field in words with its old and new value', () => {
    const before = { summary: 'Old', jiraDueDate: '2026-11-13', effortHours: 8, epicKey: 'TEST-9', resource: 'Ann Lee', status: 'NOT_STARTED' };
    const after = { summary: ' New ', endDate: '2026-11-20T00:00:00', effortHours: 16, epicKey: 'TEST-8', resource: 'Bo Chen', resourceAccountId: 'acc-1', status: 'IN_PROGRESS' };
    expect(describeJiraChanges(['summary', 'duedate', 'timetracking', 'parent', 'assignee', 'status'], before, after)).toEqual([
      { field: 'summary', from: 'Old', to: 'New' },
      { field: 'due date', from: '2026-11-13', to: '2026-11-20' },
      { field: 'estimate', from: '8h', to: '16h' },
      { field: 'epic', from: 'TEST-9', to: 'TEST-8' },
      { field: 'assignee', from: 'Ann Lee', to: 'Bo Chen' },
      { field: 'status', from: 'NOT_STARTED', to: 'IN_PROGRESS' }
    ]);
  });

  it('shows an empty old value as null, a removed epic or assignee as null, and an account id when no name is known', () => {
    expect(describeJiraChanges(['duedate', 'timetracking', 'parent', 'assignee'], {}, { endDate: '2026-11-20', effortHours: 4, epicKey: '', resourceAccountId: 'unassigned' })).toEqual([
      { field: 'due date', from: null, to: '2026-11-20' },
      { field: 'estimate', from: null, to: '4h' },
      { field: 'epic', from: null, to: null },
      { field: 'assignee', from: null, to: null }
    ]);
    expect(describeJiraChanges(['assignee'], { resource: 'Unassigned' }, { resourceAccountId: 'acc-7' })).toEqual([{ field: 'assignee', from: null, to: 'acc-7' }]);
  });

  it('keeps an unknown field by name, and skips nothing that was sent', () => {
    expect(describeJiraChanges(['issuelink', 'summary'], {}, {})).toEqual([
      { field: 'issuelink', from: null, to: null },
      { field: 'summary', from: null, to: null }
    ]);
    expect(describeJiraChanges([], {}, {})).toEqual([]);
  });
});
