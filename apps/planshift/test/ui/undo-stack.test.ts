/*
 * Copyright (c) 2026 Asymm Systems. All rights reserved.
 *
 * @author Fahim Farook
 */

import { UndoStack } from '../../src/ui/undo-stack';

describe('UndoStack (B-01, B-14)', () => {
  it('undo returns the latest entry and redo returns it again', () => {
    const s = new UndoStack<string>(20);
    s.push('a');
    s.push('b');
    expect(s.canUndo()).toBe(true);
    expect(s.undo()).toBe('b');
    expect(s.redo()).toBe('b');
    expect(s.canRedo()).toBe(false);
  });

  it('a new push clears the redo branch', () => {
    const s = new UndoStack<number>(20);
    s.push(1);
    s.push(2);
    s.undo();
    s.push(3);
    expect(s.canRedo()).toBe(false);
    expect(s.undo()).toBe(3);
    expect(s.undo()).toBe(1);
    expect(s.undo()).toBeUndefined();
  });

  it('keeps at most the configured number of steps', () => {
    const s = new UndoStack<number>(20);
    for (let i = 1; i <= 25; i++) s.push(i);
    const undone: number[] = [];
    let v: number | undefined;
    while ((v = s.undo()) !== undefined) undone.push(v);
    expect(undone.length).toBe(20);
    expect(undone[0]).toBe(25);
    expect(undone[19]).toBe(6);
  });

  it('redo on an empty redo branch returns undefined', () => {
    const s = new UndoStack<number>(2);
    expect(s.redo()).toBeUndefined();
    expect(s.size()).toBe(0);
  });

  it('rejects a non-positive limit', () => {
    expect(() => new UndoStack<number>(0)).toThrow('limit');
  });
});
