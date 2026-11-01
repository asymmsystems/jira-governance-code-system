/*
 * Copyright (c) 2026 Asymm Systems. All rights reserved.
 *
 * @author Fahim Farook
 */

/**
 * CascadePlan: undo entries from plan snapshots, including the cascade (B-14 criterion 1).
 */

import { snapshotPlan, buildUndoEntry, actionLabel, UndoOp } from '../../src/ui/undo-plan';
import { UndoStack } from '../../src/ui/undo-stack';
import { addDays } from '../../src/domain/schedule-engine';

const task = (key: string, startDate: string, endDate: string, extra: any = {}) =>
  ({ key, startDate, endDate, progress: 0, manualProgress: false, targetProgress: 0, status: 'NOT_STARTED', summary: key, dependency: null, ...extra });
const plan = (tasks: any[], backlogTasks: any[] = []) => ({ tasks, backlogTasks });

describe('buildUndoEntry', () => {
  it('a move with a cascade restores the target and every moved dependent, and reapplies them', () => {
    const before = plan([task('A', '2026-11-04', '2026-11-13'), task('B', '2026-11-14', '2026-11-17', { dependency: { predecessorKey: 'A', triggerPercent: 100 } })]);
    const after = plan([task('A', '2026-11-11', '2026-11-20'), task('B', '2026-11-21', '2026-11-24', { dependency: { predecessorKey: 'A', triggerPercent: 100 } })]);
    const e = buildUndoEntry(snapshotPlan(before), snapshotPlan(after), 'A')!;
    expect(e.keys).toEqual(['A', 'B']);
    expect(e.restore).toEqual([
      { kind: 'update', key: 'A', updates: { startDate: '2026-11-04', endDate: '2026-11-13' } },
      { kind: 'update', key: 'B', updates: { startDate: '2026-11-14', endDate: '2026-11-17' } }
    ]);
    expect(e.reapply[0]).toEqual({ kind: 'update', key: 'A', updates: { startDate: '2026-11-11', endDate: '2026-11-20' } });
    expect(actionLabel('updateWbsTask', { taskId: 'A', updates: { startDate: 'x' } }, e)).toBe('Moved A and 1 dependent');
  });

  it('progress, status, link, summary, estimate, epic and assignee are restored to their old values', () => {
    const before = plan([task('A', '2026-11-04', '2026-11-13', { progress: 40, manualProgress: true, effortHours: 8, epicKey: 'E-1', resourceAccountId: 'acc-1' }),
      task('B', '2026-11-04', '2026-11-13', { dependency: { predecessorKey: 'A', triggerPercent: 30, isViolated: false } })]);
    const after = plan([task('A', '2026-11-04', '2026-11-13', { progress: 100, manualProgress: true, status: 'COMPLETED', summary: 'New', effortHours: 16, epicKey: '', resourceAccountId: 'acc-2' }),
      task('B', '2026-11-04', '2026-11-13', { dependency: null })]);
    const e = buildUndoEntry(snapshotPlan(before), snapshotPlan(after), 'A')!;
    expect(e.restore).toEqual([
      { kind: 'update', key: 'A', updates: { progress: 40, status: 'NOT_STARTED', summary: 'A', effortHours: 8, epicKey: 'E-1', resourceAccountId: 'acc-1' } },
      { kind: 'update', key: 'B', updates: { dependency: { predecessorKey: 'A', triggerPercent: 30 } } }
    ]);
    expect(e.reapply[1]).toEqual({ kind: 'update', key: 'B', updates: { dependency: null } });
  });

  it('a computed progress is restored by going back to the roll-up, and an empty assignee to unassigned', () => {
    const before = plan([task('A', '2026-11-04', '2026-11-13', { progress: 20 })]);
    const after = plan([task('A', '2026-11-04', '2026-11-13', { progress: 50, manualProgress: true, resourceAccountId: 'acc-2' })]);
    expect(buildUndoEntry(snapshotPlan(before), snapshotPlan(after), 'A')!.restore).toEqual([
      { kind: 'update', key: 'A', updates: { manualProgress: false, resourceAccountId: 'unassigned' } }
    ]);
  });

  it('unschedule is undone by scheduling at the old dates, and scheduling by unscheduling', () => {
    const on = plan([task('A', '2026-11-04', '2026-11-13', { startWeek: '03-Nov', spanWeeks: 2 })]);
    const off = plan([], [task('A', '', '')]);
    const un = buildUndoEntry(snapshotPlan(on), snapshotPlan(off), 'A')!;
    expect(un.restore).toEqual([{ kind: 'schedule', key: 'A', updates: { startWeek: '03-Nov', spanWeeks: 2, startDate: '2026-11-04', endDate: '2026-11-13' } }]);
    expect(un.reapply).toEqual([{ kind: 'unschedule', key: 'A' }]);
    expect(actionLabel('unscheduleTask', { taskId: 'A' }, un)).toBe('Moved A to the backlog');
    const sch = buildUndoEntry(snapshotPlan(off), snapshotPlan(on), 'A')!;
    expect(sch.restore).toEqual([{ kind: 'unschedule', key: 'A' }]);
    expect(actionLabel('scheduleBacklogTask', { taskId: 'A' }, sch)).toBe('Scheduled A');
  });

  it('a parent whose dates or computed progress follow a changed child is left out (plan-only roll-up, INV-03)', () => {
    const before = plan([task('P', '2026-11-01', '2026-11-13', { progress: 10 }), task('C', '2026-11-04', '2026-11-13', { parentKey: 'P' })]);
    const after = plan([task('P', '2026-11-01', '2026-11-20', { progress: 30 }), task('C', '2026-11-11', '2026-11-20', { parentKey: 'P' })]);
    const e = buildUndoEntry(snapshotPlan(before), snapshotPlan(after), 'C')!;
    expect(e.keys).toEqual(['C']);
    expect(actionLabel('updateWbsTask', { taskId: 'C', updates: { endDate: 'x' } }, e)).toBe('Moved C');
  });

  it('no change gives no entry; labels for links, progress, other edits and several dependents', () => {
    const p = plan([task('A', '2026-11-04', '2026-11-13')]);
    expect(buildUndoEntry(snapshotPlan(p), snapshotPlan(p), 'A')).toBeNull();
    expect(snapshotPlan(null).size).toBe(0);
    const e = { keys: ['A', 'B', 'C'], restore: [], reapply: [] };
    expect(actionLabel('updateWbsTask', { taskId: 'A', updates: { startDate: 'x' } }, e)).toBe('Moved A and 2 dependents');
    expect(actionLabel('updateWbsTask', { taskId: 'A', updates: { dependency: { predecessorKey: 'B', triggerPercent: 30 } } }, e)).toBe('Linked A to B at 30%');
    expect(actionLabel('updateWbsTask', { taskId: 'A', updates: { dependency: null } }, e)).toBe('Removed the link of A');
    expect(actionLabel('updateWbsTask', { taskId: 'A', updates: { progress: 60 } }, e)).toBe('Set A to 60%');
    expect(actionLabel('updateWbsTask', { taskId: 'A', updates: { summary: 'x' } }, e)).toBe('Changed A');
    expect(actionLabel('reorderWbsTasks', { taskId: 'A' }, e)).toBe('Changed A');
  });
});

describe('20 edits then 20 undos restore every date exactly (B-14 criterion 1)', () => {
  // A small stand-in for the resolver: dates move, and B follows A finish-to-start (the cascade).
  function apply(tasks: any[], op: UndoOp): any[] {
    let out = tasks.map(t => (t.key === op.key ? { ...t, ...op.updates } : { ...t }));
    const a = out.find(t => t.key === 'A');
    const b = out.find(t => t.key === 'B');
    if (op.key === 'A' && b.startDate <= a.endDate) {
      const len = (Date.parse(b.endDate) - Date.parse(b.startDate)) / 86400000;
      const start = addDays(a.endDate, 1);
      out = out.map(t => (t.key === 'B' ? { ...t, startDate: start, endDate: addDays(start, len) } : t));
    }
    return out;
  }

  it('restores the initial plan and redo reapplies the last edit', () => {
    const initial = [task('A', '2026-11-04', '2026-11-13'), task('B', '2026-11-14', '2026-11-17', { dependency: { predecessorKey: 'A', triggerPercent: 100 } }), task('C', '2026-12-01', '2026-12-02')];
    const stack = new UndoStack<ReturnType<typeof buildUndoEntry>>(20);
    let tasks = initial;
    const history: any[][] = [tasks];
    for (let i = 0; i < 20; i++) {
      const key = ['A', 'B', 'C'][i % 3];
      const t = tasks.find(x => x.key === key);
      const op: UndoOp = { kind: 'update', key, updates: { startDate: addDays(t.startDate, 3), endDate: addDays(t.endDate, 3 + (i % 2)) } };
      const next = apply(tasks, op);
      stack.push(buildUndoEntry(snapshotPlan(plan(tasks)), snapshotPlan(plan(next)), key));
      tasks = next;
      history.push(tasks);
    }
    for (let i = 0; i < 20; i++) {
      const entry = stack.undo()!;
      for (const op of entry.restore) tasks = tasks.map(t => (t.key === op.key ? { ...t, ...op.updates } : t));
      expect(tasks.map(t => [t.key, t.startDate, t.endDate])).toEqual(history[19 - i].map(t => [t.key, t.startDate, t.endDate]));
    }
    expect(stack.canUndo()).toBe(false);
    const redo = stack.redo()!;
    for (const op of redo.reapply) tasks = tasks.map(t => (t.key === op.key ? { ...t, ...op.updates } : t));
    expect(tasks.map(t => [t.key, t.startDate, t.endDate])).toEqual(history[1].map(t => [t.key, t.startDate, t.endDate]));
  });
});
