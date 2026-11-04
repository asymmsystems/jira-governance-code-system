/*
 * Copyright (c) 2026 Asymm Systems. All rights reserved.
 *
 * @author Fahim Farook
 */

/**
 * CascadePlan: empty states and the first-link hint (B-25).
 */

import { emptyState, showLinkHint } from '../../src/ui/first-run';

describe('emptyState (B-25 criterion 2)', () => {
  it('nothing scheduled but issues in the backlog: one action to schedule them', () => {
    expect(emptyState({ tasks: [], backlogTasks: [{ key: 'A-1' }] })).toEqual({
      title: 'Nothing is scheduled yet', text: '1 issue is waiting in the backlog. Drag issues onto the timeline to plan them.',
      action: { id: 'schedule', label: 'Schedule your first issues' } });
    expect(emptyState({ tasks: [], backlogTasks: [{ key: 'A-1' }, { key: 'A-2' }] })!.text).toContain('2 issues are waiting');
  });

  it('no issues at all: one action to create one; a plan with tasks has no empty state', () => {
    expect(emptyState({ tasks: [], backlogTasks: [] })).toEqual({
      title: 'This project has no issues yet', text: 'Create an issue to start the plan. It is created in Jira.',
      action: { id: 'create', label: 'Create an issue' } });
    expect(emptyState({ tasks: [{ key: 'A-1' }] })).toBeNull();
    expect(emptyState(null)).toBeNull();
    expect(emptyState({})!.action.id).toBe('create');
  });
});

describe('showLinkHint (B-25 criterion 3)', () => {
  const two = [{ key: 'A-1', startDate: '2026-11-02' }, { key: 'A-2', startDate: '2026-11-09' }];
  it('shows with two scheduled tasks and no link, until the user has linked or dismissed it', () => {
    expect(showLinkHint({ tasks: two }, null)).toBe(true);
    expect(showLinkHint({ tasks: two }, 'done')).toBe(false);
    expect(showLinkHint({ tasks: [two[0]] }, null)).toBe(false);
    expect(showLinkHint({ tasks: [two[0], { ...two[1], dependency: { predecessorKey: 'A-1' } }] }, null)).toBe(false);
    expect(showLinkHint({ tasks: [two[0], { key: 'A-3' }] }, null)).toBe(false);
    expect(showLinkHint(null, null)).toBe(false);
    expect(showLinkHint({}, null)).toBe(false);
  });
});
