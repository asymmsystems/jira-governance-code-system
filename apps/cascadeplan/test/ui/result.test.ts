/*
 * Copyright (c) 2026 Asymm Systems. All rights reserved.
 *
 * @author Fahim Farook
 */

import { classifyResult } from '../../src/ui/result';

describe('classifyResult (B-07)', () => {
  it('treats null and undefined as a failure', () => {
    expect(classifyResult(null)).toEqual({ failed: true, message: 'The planner could not reach Jira. Nothing was changed.' });
    expect(classifyResult(undefined).failed).toBe(true);
  });

  it('reports ok false with the error or message text', () => {
    expect(classifyResult({ ok: false, error: 'validation', message: 'taskId must be a Jira issue key' }))
      .toEqual({ failed: true, message: 'taskId must be a Jira issue key' });
    expect(classifyResult({ ok: false, error: 'Issue type is required' }))
      .toEqual({ failed: true, message: 'Issue type is required' });
    expect(classifyResult({ success: false, error: 'Failed to create subtask' }))
      .toEqual({ failed: true, message: 'Failed to create subtask' });
    expect(classifyResult({ ok: false })).toEqual({ failed: true, message: 'The change failed.' });
  });

  it('reports a partial Jira sync failure even when the planner change worked', () => {
    expect(classifyResult({ ok: true, jiraSync: { ok: false, error: 'TEST-1: Field duedate cannot be set' } }))
      .toEqual({ failed: true, message: 'Saved in CascadePlan, but Jira rejected part of it: TEST-1: Field duedate cannot be set' });
    expect(classifyResult({ ok: true, jiraSync: { ok: false } }))
      .toEqual({ failed: true, message: 'Saved in CascadePlan, but Jira rejected part of it.' });
  });

  it('passes a successful result', () => {
    expect(classifyResult({ ok: true, jiraSync: { ok: true, writes: [] } })).toEqual({ failed: false });
    expect(classifyResult({ tasks: [] })).toEqual({ failed: false });
  });
});
