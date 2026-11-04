/*
 * Copyright (c) 2026 Asymm Systems. All rights reserved.
 *
 * @author Fahim Farook
 */

/**
 * CascadePlan: browser view state. The active plan survives a refresh (per project); collapsed
 * parents hide all their descendants, and only rows with child rows get an expand toggle.
 */

import * as fs from 'fs';
import * as path from 'path';
import {
  MAIN_PLAN_ID,
  activePlanStorageKey,
  getSavedPlanId,
  setSavedPlanId,
  chooseActivePlan,
  parentRowKey,
  parentKeysOf,
  hasChildRows,
  isHiddenByCollapse,
  visibleRows,
  KeyValueStore
} from '../../src/ui/plan-view-state';
import { UndoStack } from '../../src/ui/undo-stack';

class MemStore implements KeyValueStore {
  data = new Map<string, string>();
  getItem(k: string): string | null { return this.data.has(k) ? this.data.get(k)! : null; }
  setItem(k: string, v: string): void { this.data.set(k, v); }
}

const throwing: KeyValueStore = {
  getItem: () => { throw new Error('SecurityError'); },
  setItem: () => { throw new Error('QuotaExceeded'); }
};

describe('active plan persistence (refresh keeps the plan)', () => {
  it('saves and reads the plan per project scope', () => {
    const s = new MemStore();
    setSavedPlanId(s, 'site:DEMO', 'plan-b');
    setSavedPlanId(s, 'site:OTHER', 'plan-c');
    expect(getSavedPlanId(s, 'site:DEMO')).toBe('plan-b');
    expect(getSavedPlanId(s, 'site:OTHER')).toBe('plan-c');
    expect(s.data.get(activePlanStorageKey('site:DEMO'))).toBe('plan-b');
    expect(activePlanStorageKey('DEMO')).toBe('cp_active_plan_DEMO');
  });

  it('falls back to the Main Plan when nothing is saved, there is no scope, or storage throws', () => {
    const s = new MemStore();
    expect(getSavedPlanId(s, 'site:DEMO')).toBe(MAIN_PLAN_ID);
    expect(getSavedPlanId(s, undefined)).toBe(MAIN_PLAN_ID);
    expect(getSavedPlanId(undefined, 'site:DEMO')).toBe(MAIN_PLAN_ID);
    expect(getSavedPlanId(throwing, 'site:DEMO')).toBe(MAIN_PLAN_ID);
    expect(() => setSavedPlanId(throwing, 'site:DEMO', 'plan-b')).not.toThrow();
    setSavedPlanId(s, 'site:DEMO', undefined);
    expect(getSavedPlanId(s, 'site:DEMO')).toBe(MAIN_PLAN_ID);
  });

  it('opens a saved plan only while the project still lists it', () => {
    const plans = [{ id: 'default' }, { id: 'plan-b' }];
    expect(chooseActivePlan('plan-b', plans)).toBe('plan-b');
    expect(chooseActivePlan('plan-deleted', plans)).toBe(MAIN_PLAN_ID);
    expect(chooseActivePlan(undefined, plans)).toBe(MAIN_PLAN_ID);
    expect(chooseActivePlan('plan-b', undefined)).toBe(MAIN_PLAN_ID);
  });
});

describe('collapse and expand of parent rows', () => {
  // DEMO-1 epic > DEMO-9 story > DEMO-30, DEMO-29 subtasks; DEMO-26 task > DEMO-28, DEMO-31 subtasks; DEMO-40 alone.
  const rows = [
    { key: 'DEMO-1', isEpic: true, hierarchyLevel: 1 },
    { key: 'DEMO-9', parentKey: 'DEMO-1', epicKey: 'DEMO-1', hierarchyLevel: 0 },
    { key: 'DEMO-30', parentKey: 'DEMO-9', epicKey: 'DEMO-1', hierarchyLevel: -1 },
    { key: 'DEMO-29', parentKey: 'DEMO-9', epicKey: 'DEMO-1', hierarchyLevel: -1 },
    { key: 'DEMO-26', hierarchyLevel: 0 },
    { key: 'DEMO-28', parentKey: 'DEMO-26', hierarchyLevel: -1 },
    { key: 'DEMO-31', parentKey: 'DEMO-26', hierarchyLevel: -1 },
    { key: 'DEMO-40', hierarchyLevel: 0, childrenCount: 0 }
  ];
  const byKey = new Map(rows.map(r => [r.key, r]));
  const keysOf = (out: Array<{ task: { key: string } }>) => out.map(r => r.task.key);

  it('every row with child rows gets a toggle: epics, stories and tasks alike', () => {
    expect([...parentKeysOf(rows)].sort()).toEqual(['DEMO-1', 'DEMO-26', 'DEMO-9']);
    expect(hasChildRows(rows[1], rows)).toBe(true);
    expect(hasChildRows(rows[4], rows)).toBe(true);
    expect(hasChildRows(rows[2], rows)).toBe(false);
    expect(hasChildRows(rows[7], rows)).toBe(false);
    expect(hasChildRows({ key: 'X', childrenCount: 2 }, [])).toBe(true);
  });

  it('a subtask whose parent is not a row sits under its epic, else at the top', () => {
    const keys = new Set(['DEMO-1', 'DEMO-30']);
    expect(parentRowKey(rows[2], keys)).toBe('DEMO-1');
    expect(parentRowKey(rows[5], keys)).toBeUndefined();
    expect(parentRowKey({ key: 'E', isEpic: true, epicKey: 'E' }, new Set(['E']))).toBeUndefined();
  });

  it('nothing is hidden while every parent is expanded', () => {
    expect(keysOf(visibleRows(rows, new Set()))).toEqual(rows.map(r => r.key));
  });

  it('collapsing a story or task hides its subtasks only', () => {
    expect(keysOf(visibleRows(rows, new Set(['DEMO-9'])))).toEqual(['DEMO-1', 'DEMO-9', 'DEMO-26', 'DEMO-28', 'DEMO-31', 'DEMO-40']);
    expect(keysOf(visibleRows(rows, new Set(['DEMO-26'])))).toEqual(['DEMO-1', 'DEMO-9', 'DEMO-30', 'DEMO-29', 'DEMO-26', 'DEMO-40']);
  });

  it('collapsing an epic hides every descendant, and the story keeps its own collapsed state', () => {
    expect(keysOf(visibleRows(rows, new Set(['DEMO-1'])))).toEqual(['DEMO-1', 'DEMO-26', 'DEMO-28', 'DEMO-31', 'DEMO-40']);
    expect(isHiddenByCollapse(rows[2], byKey, new Set(['DEMO-1']))).toBe(true);
    expect(keysOf(visibleRows(rows, new Set(['DEMO-1', 'DEMO-9'])))).toEqual(['DEMO-1', 'DEMO-26', 'DEMO-28', 'DEMO-31', 'DEMO-40']);
  });

  it('a filtered view without the epic never hides its stories', () => {
    const stories = rows.filter(r => !r.isEpic);
    expect(keysOf(visibleRows(stories, new Set(['DEMO-1'])))).toEqual(stories.map(r => r.key));
  });

  it('a parent cycle in the data does not loop', () => {
    const cyc = [{ key: 'A', parentKey: 'B' }, { key: 'B', parentKey: 'A' }];
    expect(keysOf(visibleRows(cyc, new Set()))).toEqual(['A', 'B']);
    expect(keysOf(visibleRows(cyc, new Set(['A'])))).toEqual(['A']);
  });
});

describe('UndoStack.clear (a plan switch drops the other plan history)', () => {
  it('forgets undo and redo entries', () => {
    const s = new UndoStack<number>(5);
    s.push(1); s.push(2); s.undo();
    s.clear();
    expect(s.canUndo()).toBe(false);
    expect(s.canRedo()).toBe(false);
  });
});

describe('planner source: plan-scoped calls', () => {
  const src = fs.readFileSync(path.join(__dirname, '..', '..', 'src', 'frontend', 'legacy-planner.js'), 'utf8');
  const bridge = fs.readFileSync(path.join(__dirname, '..', '..', 'src', 'frontend', 'bridge.ts'), 'utf8');

  it('every direct bridge call outside the wrapper passes planId', () => {
    const direct = src.split('\n').filter(l => /rawCallResolver\('/.test(l));
    expect(direct.length).toBeGreaterThan(0);
    for (const line of direct) expect(line).toMatch(/planId/);
  });

  it('the cascade loop continues in the plan of the first write', () => {
    expect(bridge).toMatch(/callResolver\('continueCascade', \{[^}]*planId: payload\.planId/);
  });

  it('the active plan is only changed through setActivePlan (which saves it), apart from start-up', () => {
    const assigns = src.split('\n').filter(l => /\bactivePlanId = /.test(l));
    // Declaration, setActivePlan itself, start-up restore and the one-time scope fallback.
    expect(assigns.length).toBe(4);
  });

  it('renderPlan no longer re-expands every parent', () => {
    expect(src).not.toMatch(/expandedTasks/);
  });
});
