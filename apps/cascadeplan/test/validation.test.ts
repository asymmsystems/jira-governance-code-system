/*
 * Copyright (c) 2026 Asymm Systems. All rights reserved.
 *
 * @author Fahim Farook
 */

import {
  ValidationError,
  assertIssueKey,
  validateTaskUpdates,
  validateColumnWidths,
  validateHiddenColumns,
  validateMilestone,
  validateDependencyPayload,
  toValidationResult
} from '../src/validation';

describe('validation (B-02, INV-15)', () => {
  it('assertIssueKey accepts Jira keys and rejects anything else', () => {
    expect(() => assertIssueKey('TEST-1', 'taskId')).not.toThrow();
    expect(() => assertIssueKey('AB_C2-99', 'taskId')).not.toThrow();
    for (const bad of ['test-1', 'TEST', '<img>', 'TEST-1 OR 1=1', 'A-1', '', 42, null, 'T'.repeat(60) + '-1']) {
      expect(() => assertIssueKey(bad as any, 'taskId')).toThrow(ValidationError);
    }
  });

  it('ValidationError names the field', () => {
    try {
      assertIssueKey('x', 'predecessorKey');
      fail('expected throw');
    } catch (e: any) {
      expect(e.field).toBe('predecessorKey');
      expect(toValidationResult(e)).toEqual({ ok: false, success: false, error: 'validation', field: 'predecessorKey', message: e.message });
    }
  });

  it('toValidationResult returns undefined for other errors', () => {
    expect(toValidationResult(new Error('boom'))).toBeUndefined();
  });

  it('validateTaskUpdates accepts well-typed values', () => {
    expect(() => validateTaskUpdates({
      summary: 'Ok', epic: 'E', epicKey: 'TEST-4', story: 'Story', effortHours: 16, resource: 'Ann',
      resourceAccountId: '5b10a2844c20165700ede21g', contributingResources: ['Ann', 'Bo'], progress: 50,
      targetProgress: 10, manualProgress: true, status: 'IN_PROGRESS', startDate: '2026-11-04',
      endDate: '2026-11-20', startWeek: '04-Nov', endWeek: '18-Nov', spanWeeks: 3,
      weeklyAllocations: { '04-Nov': 33 }, subtasks: [{ summary: 's', estimateValue: 2 }],
      dependency: { predecessorKey: 'TEST-1', triggerPercent: 30 }, effortConfig: { unit: 'HOURS' }
    })).not.toThrow();
    expect(() => validateTaskUpdates({ dependency: null, epicKey: '', resourceAccountId: 'unassigned' })).not.toThrow();
    expect(() => validateTaskUpdates({ dependency: {} })).not.toThrow();
    expect(() => validateTaskUpdates({ dependency: { predecessorKey: 'TEST-1' } })).toThrow('dependency.triggerPercent');
    expect(() => validateTaskUpdates({ progress: 150, targetProgress: -20 })).not.toThrow();
    expect(() => validateTaskUpdates({ resourceAccountId: 'ph:res-1' })).not.toThrow();
  });

  it.each([
    [{ summary: 5 }, 'summary'],
    [{ summary: 'x'.repeat(256) }, 'summary'],
    [{ epic: {} }, 'epic'],
    [{ epicKey: '<b>' }, 'epicKey'],
    [{ resource: 'x'.repeat(300) }, 'resource'],
    [{ resourceAccountId: '<script>' }, 'resourceAccountId'],
    [{ contributingResources: 'Ann' }, 'contributingResources'],
    [{ contributingResources: new Array(21).fill('a') }, 'contributingResources'],
    [{ contributingResources: [5] }, 'contributingResources'],
    [{ effortHours: -1 }, 'effortHours'],
    [{ effortHours: 'ten' }, 'effortHours'],
    [{ progress: 'high' }, 'progress'],
    [{ targetProgress: Number.NaN }, 'targetProgress'],
    [{ manualProgress: 'yes' }, 'manualProgress'],
    [{ status: 'DONE' }, 'status'],
    [{ startDate: '2026-13-01' }, 'startDate'],
    [{ endDate: '01/02/2026' }, 'endDate'],
    [{ startWeek: 'x'.repeat(20) }, 'startWeek'],
    [{ spanWeeks: 0 }, 'spanWeeks'],
    [{ spanWeeks: 2.5 }, 'spanWeeks'],
    [{ weeklyAllocations: [] }, 'weeklyAllocations'],
    [{ weeklyAllocations: { a: 200 } }, 'weeklyAllocations'],
    [{ subtasks: {} }, 'subtasks'],
    [{ subtasks: [{ summary: 7 }] }, 'subtasks'],
    [{ dependency: { predecessorKey: 'bad', triggerPercent: 30 } }, 'dependency.predecessorKey'],
    [{ dependency: { predecessorKey: 'TEST-1', triggerPercent: 130 } }, 'dependency.triggerPercent'],
    [{ dependency: 'x' }, 'dependency'],
    [{ effortConfig: 'x' }, 'effortConfig'],
    [{ removeSubtaskAction: 'bad' }, 'removeSubtaskAction'],
    [{ removeSubtaskAction: { subtaskKey: 'bad-key', action: 'delete' } }, 'removeSubtaskAction.subtaskKey'],
    [{ removeSubtaskAction: { subtaskKey: 'TEST-1', action: 'explode' } }, 'removeSubtaskAction.action'],
    [{ contributors: [{ accountId: 'acc-1', subtaskKey: 'bad' }] }, 'contributors.subtaskKey']
  ])('validateTaskUpdates rejects %j', (updates, field) => {
    try {
      validateTaskUpdates(updates as any);
      fail('expected throw');
    } catch (e: any) {
      expect(e).toBeInstanceOf(ValidationError);
      expect(e.field).toBe(field);
    }
  });

  it('validateTaskUpdates rejects a non-object', () => {
    expect(() => validateTaskUpdates(null as any)).toThrow(ValidationError);
  });

  it('validateDependencyPayload checks key and trigger', () => {
    expect(() => validateDependencyPayload({ predecessorKey: 'TEST-1', triggerPercent: 0 })).not.toThrow();
    expect(() => validateDependencyPayload({ predecessorKey: 'TEST-1' } as any)).toThrow(ValidationError);
    expect(() => validateDependencyPayload(undefined as any)).toThrow(ValidationError);
  });

  it('validateColumnWidths accepts known columns with sane widths only', () => {
    expect(() => validateColumnWidths({ epic: 120, task: 240 })).not.toThrow();
    expect(() => validateColumnWidths({ epic: 'red;background:url(x)' } as any)).toThrow(ValidationError);
    expect(() => validateColumnWidths({ hacker: 100 } as any)).toThrow(ValidationError);
    expect(() => validateColumnWidths({ epic: 5000 })).toThrow(ValidationError);
    expect(() => validateColumnWidths(null as any)).toThrow(ValidationError);
  });

  it('validateHiddenColumns accepts known column keys only', () => {
    expect(() => validateHiddenColumns(['epic', 'story'])).not.toThrow();
    expect(() => validateHiddenColumns(['task'])).toThrow(ValidationError);
    expect(() => validateHiddenColumns('epic' as any)).toThrow(ValidationError);
    expect(() => validateHiddenColumns(undefined)).not.toThrow();
  });

  it('validateMilestone checks every field', () => {
    const ok = { id: 'm1', title: 'Gate', date: '2026-11-20', weekKey: '18-Nov', type: 'GATE' };
    expect(() => validateMilestone(ok as any)).not.toThrow();
    expect(() => validateMilestone({ ...ok, title: 'x'.repeat(300) } as any)).toThrow(ValidationError);
    expect(() => validateMilestone({ ...ok, type: 'PARTY' } as any)).toThrow(ValidationError);
    expect(() => validateMilestone({ ...ok, date: 'tomorrow' } as any)).toThrow(ValidationError);
    expect(() => validateMilestone({ ...ok, id: '' } as any)).toThrow(ValidationError);
    expect(() => validateMilestone(undefined as any)).toThrow(ValidationError);
  });
});
