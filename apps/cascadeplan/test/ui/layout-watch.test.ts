/*
 * Copyright (c) 2026 Asymm Systems. All rights reserved.
 *
 * @author Fahim Farook
 */

/**
 * TASK-00003 (2026-11-10): with columns hidden the timeline bars drew one row lower than their task
 * rows, and after "Unhide All Columns" the bars were not in view.
 *
 * 1. The canvas draws from measured positions. The planner measured them once, also while the drop
 *    rows were still in their CSS height transition after a backlog drag, and nothing measured again
 *    when the rows stopped moving. Now a size observer on the scroll wrapper and the table measures
 *    again after every size change.
 * 2. A column change kept the scroll position, so only the left edge date stayed. When columns came
 *    back, the visible timeline lost its right part. Now the middle date stays in the middle.
 *
 * The browser check is test/e2e/e2e_hidden_columns_probe.py (fails on the old planner, passes now).
 */

import * as fs from 'fs';
import * as path from 'path';
import { watchSizes, keepMiddleInView, SizeObserverLike } from '../../src/ui/layout-watch';

class FakeObserver implements SizeObserverLike {
  static last: FakeObserver | null = null;
  observed: Element[] = [];
  disconnected = false;
  constructor(readonly callback: () => void) {
    FakeObserver.last = this;
  }
  observe(target: Element): void {
    this.observed.push(target);
  }
  disconnect(): void {
    this.disconnected = true;
  }
}

const el = (name: string) => ({ name } as unknown as Element);

describe('watchSizes: the timeline measures again after a size change', () => {
  beforeEach(() => {
    FakeObserver.last = null;
  });

  it('observes the wrapper and the table and calls back on each size change', () => {
    const wrapper = el('ganttWrapper');
    const table = el('ganttTable');
    const onChange = jest.fn();
    watchSizes([wrapper, table], onChange, FakeObserver);
    const obs = FakeObserver.last!;
    expect(obs.observed).toEqual([wrapper, table]);
    obs.callback();
    obs.callback();
    expect(onChange).toHaveBeenCalledTimes(2);
  });

  it('skips missing elements and stops on request', () => {
    const wrapper = el('ganttWrapper');
    const stop = watchSizes([null, wrapper, undefined], () => undefined, FakeObserver);
    expect(FakeObserver.last!.observed).toEqual([wrapper]);
    stop();
    expect(FakeObserver.last!.disconnected).toBe(true);
  });

  it('watches nothing without a ResizeObserver or without elements', () => {
    const onChange = jest.fn();
    expect(() => watchSizes([el('ganttWrapper')], onChange, undefined)()).not.toThrow();
    expect(() => watchSizes([null], onChange, FakeObserver)()).not.toThrow();
    expect(FakeObserver.last).toBeNull();
    expect(onChange).not.toHaveBeenCalled();
  });

  it('uses the browser ResizeObserver by default', () => {
    const g = globalThis as any;
    const saved = g.ResizeObserver;
    g.ResizeObserver = FakeObserver;
    try {
      const onChange = jest.fn();
      watchSizes([el('ganttWrapper')], onChange);
      FakeObserver.last!.callback();
      expect(onChange).toHaveBeenCalledTimes(1);
    } finally {
      g.ResizeObserver = saved;
    }
  });
});

describe('keepMiddleInView: a column change keeps the middle date in view', () => {
  it('the track x in the middle of the view is the same before and after', () => {
    // Five columns hidden: 1,345 px of timeline. All columns back: 835 px.
    const before = { scrollLeft: 2000, width: 1345 };
    const afterWidth = 835;
    const scrollLeft = keepMiddleInView(before.scrollLeft, before.width, afterWidth);
    expect(scrollLeft + afterWidth / 2).toBe(before.scrollLeft + before.width / 2);
  });

  it('a bar right of the middle stays in view, where the old rule (same scroll) lost it', () => {
    const before = { scrollLeft: 2000, width: 1345 };
    const afterWidth = 835;
    const bar = { x: 2000 + 900, w: 120 }; // in view before: 900 px into the view
    const inView = (s: number, w: number) => bar.x + bar.w > s && bar.x < s + w;
    expect(inView(before.scrollLeft, before.width)).toBe(true);
    expect(inView(before.scrollLeft, afterWidth)).toBe(false);
    expect(inView(keepMiddleInView(before.scrollLeft, before.width, afterWidth), afterWidth)).toBe(true);
  });

  it('hiding columns widens the view around the same middle; it never scrolls before the start', () => {
    expect(keepMiddleInView(1000, 835, 1345)).toBe(745);
    expect(keepMiddleInView(100, 835, 1345)).toBe(0);
    expect(keepMiddleInView(500, 600, 600)).toBe(500);
    expect(keepMiddleInView(500, -20, 300)).toBe(350);
  });
});

describe('the planner uses both', () => {
  const src = fs.readFileSync(path.join(__dirname, '..', '..', 'src', 'frontend', 'legacy-planner.js'), 'utf8');

  it('watches the wrapper and the table and measures again on a change', () => {
    expect(src).toMatch(/watchSizes\(\[wrapper, document\.getElementById\('ganttTable'\)\], scheduleVirtualRows\)/);
  });

  it('keeps the middle date in view after a column change', () => {
    const fn = src.slice(src.indexOf('function onColumnsChanged()'), src.indexOf('function updateColumnManagerUI()'));
    expect(fn).toContain('keepMiddleInView(viewBefore.scrollLeft, viewBefore.width, wrapper.clientWidth - layout.trackLeft)');
  });
});
