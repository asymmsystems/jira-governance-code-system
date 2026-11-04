/*
 * Copyright (c) 2026 Asymm Systems. All rights reserved.
 *
 * @author Fahim Farook
 */

/**
 * CascadePlan: bounded undo and redo stack (pure, no DOM access).
 * Each entry describes one user action, including the cascade it caused.
 */
export class UndoStack<T> {
  private readonly done: T[] = [];
  private readonly undone: T[] = [];

  constructor(private readonly limit: number) {
    if (!Number.isInteger(limit) || limit < 1) {
      throw new Error('UndoStack limit must be a positive integer');
    }
  }

  /** Records a new action. A new action clears the redo branch. */
  push(entry: T): void {
    this.done.push(entry);
    if (this.done.length > this.limit) this.done.shift();
    this.undone.length = 0;
  }

  /** Returns the latest action to revert, or undefined when there is none. */
  undo(): T | undefined {
    const entry = this.done.pop();
    if (entry !== undefined) this.undone.push(entry);
    return entry;
  }

  /** Returns the latest reverted action to apply again, or undefined. */
  redo(): T | undefined {
    const entry = this.undone.pop();
    if (entry !== undefined) this.done.push(entry);
    return entry;
  }

  /** Forgets every action, for example when another plan opens: its records are not this plan's. */
  clear(): void {
    this.done.length = 0;
    this.undone.length = 0;
  }

  canUndo(): boolean {
    return this.done.length > 0;
  }

  canRedo(): boolean {
    return this.undone.length > 0;
  }

  size(): number {
    return this.done.length;
  }
}
