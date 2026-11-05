/*
 * Copyright (c) 2026 Asymm Systems. All rights reserved.
 *
 * @author Fahim Farook
 */

/* Harness stub of Node's AsyncLocalStorage: one store per run, kept until the run's promise settles. */
export class AsyncLocalStorage<T> {
  private store: T | undefined;
  getStore(): T | undefined { return this.store; }
  run<R>(store: T, fn: () => R): R {
    const prev = this.store;
    this.store = store;
    const out: any = fn();
    if (out && typeof out.finally === 'function') return out.finally(() => { this.store = prev; });
    this.store = prev;
    return out;
  }
}
