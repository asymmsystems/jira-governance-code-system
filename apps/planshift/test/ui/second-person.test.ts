/*
 * Copyright (c) 2026 Asymm Systems. All rights reserved.
 *
 * @author Fahim Farook
 */

/**
 * CascadePlan: second person contributor helpers and removal actions (pure; B-19).
 */

import {
  findNewContributors,
  findRemovedContributorsWithSubtask,
  formatSubtaskSummary,
  formatRemovalPrompt
} from '../../src/ui/second-person';

describe('second-person helpers (B-19 criteria 1 and 2)', () => {
  it('finds newly added contributors that need a subtask created', () => {
    const prev = [{ accountId: 'acc-1', since: '2026-11-01', subtaskKey: 'SUB-1' }];
    const next = [
      { accountId: 'acc-1', since: '2026-11-01', subtaskKey: 'SUB-1' },
      { accountId: 'acc-2', since: '2026-11-02' }
    ];
    expect(findNewContributors(prev, next)).toEqual([{ accountId: 'acc-2', since: '2026-11-02' }]);

    // Same contributors: no new ones
    expect(findNewContributors(prev, prev)).toEqual([]);
    expect(findNewContributors([], [])).toEqual([]);

    // Contributor with missing subtaskKey is treated as new
    const withoutSubtask = [{ accountId: 'acc-1', since: '2026-11-01' }];
    expect(findNewContributors([], withoutSubtask)).toEqual(withoutSubtask);
  });

  it('finds removed contributors that have an existing Jira subtask', () => {
    const prev = [
      { accountId: 'acc-1', since: '2026-11-01', subtaskKey: 'SUB-1' },
      { accountId: 'acc-2', since: '2026-11-01' }
    ];
    const next = [{ accountId: 'acc-2', since: '2026-11-01' }];

    expect(findRemovedContributorsWithSubtask(prev, next)).toEqual([
      { accountId: 'acc-1', since: '2026-11-01', subtaskKey: 'SUB-1' }
    ]);

    // Removal of a contributor without subtaskKey returns empty
    const nextEmpty: any[] = [];
    const prevNoSubtask = [{ accountId: 'acc-2', since: '2026-11-01' }];
    expect(findRemovedContributorsWithSubtask(prevNoSubtask, nextEmpty)).toEqual([]);
    expect(findRemovedContributorsWithSubtask([], nextEmpty)).toEqual([]);
  });

  it('formats subtask summary and in-form removal prompt', () => {
    expect(formatSubtaskSummary('Build API', 'Jane Engineer')).toBe('Subtask: Jane Engineer');
    expect(formatSubtaskSummary('', 'Bob')).toBe('Subtask: Bob');

    // Fallbacks and default arguments
    expect(findNewContributors()).toEqual([]);
    expect(findRemovedContributorsWithSubtask()).toEqual([]);
    expect(formatSubtaskSummary('', '')).toBe('Subtask: Contributor');

    const prompt = formatRemovalPrompt('Jane Engineer', 'TEST-42');
    expect(prompt).toContain('TEST-42');
    expect(prompt).toContain('Jane Engineer');
    expect(prompt).toContain('delete');
    expect(prompt).toContain('unassign');
  });
});
