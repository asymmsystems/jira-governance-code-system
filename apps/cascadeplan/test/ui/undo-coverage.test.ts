/*
 * Copyright (c) 2026 Asymm Systems. All rights reserved.
 *
 * @author Fahim Farook
 */

/**
 * CascadePlan: what Undo covers, as the listing and the user guide state it (CP-2).
 *
 * Covered: date moves, scheduling and unscheduling, block moves, changes to several rows, and every
 * task field and link change sent through updateWbsTask (the link editor's Save and Remove Link
 * included). Parent and type changes have their own Undo in the message. Not covered: creates, plan
 * management, baselines, plan filters, row order and column settings. The history holds 20 steps,
 * in memory only, and is cleared on a plan switch.
 */

import * as fs from 'fs';
import * as path from 'path';
import { snapshotPlan, buildUndoEntry, actionLabel } from '../../src/ui/undo-plan';

const ui = fs.readFileSync(path.join(__dirname, '../../src/frontend/legacy-planner.js'), 'utf8');

/** The body of one function of the planner, up to the next top-level function. */
function body(name: string): string {
  const start = ui.search(new RegExp(`\\n(async )?function ${name}\\(`));
  expect(start).toBeGreaterThan(-1);
  const next = ui.slice(start + 1).search(/\n(async )?function \w+\(/);
  return ui.slice(start, next < 0 ? undefined : start + 1 + next);
}

describe('Undo coverage matches the documented claim (CP-2)', () => {
  it('exactly the documented resolvers are undoable, with 20 steps', () => {
    const set = ui.match(/const UNDOABLE = new Set\(\[([^\]]*)\]\)/);
    expect(set).not.toBeNull();
    const names = set![1].split(',').map(s => s.trim().replace(/'/g, '')).sort();
    expect(names).toEqual(['batchUpdateTasks', 'moveTaskGroup', 'scheduleBacklogTask', 'unscheduleTask', 'updateWbsTask']);
    expect(ui).toMatch(/const undoStack = new UndoStack\(20\);/);
  });

  it('the link editor and the add-link popup save through the undoable wrapper', () => {
    for (const fn of ['saveDependencyEdit', 'removeDependencyLink', 'saveDependency']) {
      const b = body(fn);
      expect(b).toMatch(/await callResolver\('updateWbsTask'/);
      expect(b).not.toMatch(/rawCallResolver\('updateWbsTask'/);
    }
  });

  it('a link-only change gives an undo entry: a percent change restores the old percent, a removal adds the link back', () => {
    const plan = (links: Array<{ predecessorKey: string; triggerPercent: number }>) => ({
      tasks: [{ key: 'A' }, { key: 'B', dependencies: links }]
    });
    const pct = buildUndoEntry(snapshotPlan(plan([{ predecessorKey: 'A', triggerPercent: 30 }])),
      snapshotPlan(plan([{ predecessorKey: 'A', triggerPercent: 50 }])), 'B');
    expect(pct!.restore).toEqual([{ kind: 'update', key: 'B', updates: { dependency: { predecessorKey: 'A', predecessorId: 'A', triggerPercent: 30, isTriggerSatisfied: false } } }]);
    const removed = buildUndoEntry(snapshotPlan(plan([{ predecessorKey: 'A', triggerPercent: 30 }])), snapshotPlan(plan([])), 'B');
    expect(removed!.restore[0].updates).toEqual({ dependency: { predecessorKey: 'A', predecessorId: 'A', triggerPercent: 30, isTriggerSatisfied: false } });
    expect(actionLabel('updateWbsTask', { taskId: 'B', updates: { removeDependency: { predecessorKey: 'A' } } }, removed!))
      .toBe('Removed the link from A to B');
  });

  it('creates, plan management, baselines, filters, row order and column settings are not undoable', () => {
    for (const fn of ['createInlineTask', 'createJiraEpic', 'addSubtaskToTask', 'createSubtaskForResource', 'createProjectPlan',
      'renameProjectPlan', 'deleteProjectPlan', 'freezePlanBaseline', 'setActiveBaseline', 'reviewScopeShift', 'requestScopeShift',
      'setPlanFilter', 'reorderWbsTasks', 'saveColumnWidths', 'saveHiddenColumns']) {
      expect(ui).not.toMatch(new RegExp(`UNDOABLE = new Set\\([^)]*'${fn}'`));
    }
  });

  it('the history is in memory only and is cleared when another plan opens', () => {
    expect(body('setActivePlan')).toMatch(/undoStack\.clear\(\);/);
    expect(ui).not.toMatch(/localStorage\.setItem\([^)]*undo/i);
  });
});
