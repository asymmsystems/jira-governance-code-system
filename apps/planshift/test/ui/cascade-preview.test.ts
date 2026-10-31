/*
 * Copyright (c) 2026 Asymm Systems. All rights reserved.
 *
 * @author Fahim Farook
 */

import { earliestStartWeek, cascadePreview, PreviewTask } from '../../src/ui/cascade-preview';

const weeks = ['w0', 'w1', 'w2', 'w3', 'w4', 'w5', 'w6', 'w7'].map(k => ({ weekKey: k, startDate: k, endDate: k }));

describe('cascade-preview (B-01: client copy moved out of the inline script)', () => {
  it('earliestStartWeek returns the week after the predecessor crosses the trigger', () => {
    const pred: PreviewTask = { key: 'A', startWeek: 'w1', spanWeeks: 4 };
    expect(earliestStartWeek(pred, 30, weeks)).toBe(3);
    expect(earliestStartWeek(pred, 0, weeks)).toBe(2);
    expect(earliestStartWeek(pred, 100, weeks)).toBe(5);
  });

  it('earliestStartWeek uses stored weekly allocations when present', () => {
    const pred: PreviewTask = { key: 'A', startWeek: 'w0', spanWeeks: 2, weeklyAllocations: { w0: 10, w1: 90 } };
    expect(earliestStartWeek(pred, 50, weeks)).toBe(2);
  });

  it('earliestStartWeek defaults a missing trigger to 30 and clamps to the window end', () => {
    const pred: PreviewTask = { key: 'A', startWeek: 'w6', spanWeeks: 4 };
    expect(earliestStartWeek(pred, Number.NaN, weeks)).toBe(7);
    expect(earliestStartWeek(undefined as unknown as PreviewTask, 30, weeks)).toBe(0);
    expect(earliestStartWeek(pred, 30, [])).toBe(0);
  });

  it('earliestStartWeek returns the week after the bar when the trigger is never reached', () => {
    const pred: PreviewTask = { key: 'A', startWeek: 'w0', spanWeeks: 2, weeklyAllocations: { w0: 10, w1: 10 } };
    expect(earliestStartWeek(pred, 50, weeks)).toBe(2);
  });

  it('cascadePreview matches by predecessor id, defaults trigger and span, and ignores unknown keys', () => {
    const tasks: PreviewTask[] = [
      { key: 'A', startWeek: 'w0', spanWeeks: 2 },
      { key: 'B', startWeek: 'w0', dependency: { predecessorKey: 'X', predecessorId: 'A' } }
    ];
    const out = cascadePreview(tasks, 'A', weeks);
    const b = out.find(t => t.key === 'B')!;
    expect(b.startWeek).toBe('w1');
    expect(b.endWeek).toBe('w3');
    expect(cascadePreview(tasks, 'ZZ', weeks).find(t => t.key === 'B')!.startWeek).toBe('w0');
  });

  it('cascadePreview visits each task once in a diamond', () => {
    const tasks: PreviewTask[] = [
      { key: 'A', startWeek: 'w0', spanWeeks: 1 },
      { key: 'B', startWeek: 'w0', spanWeeks: 1, dependency: { predecessorKey: 'A', triggerPercent: 100 } },
      { key: 'C', startWeek: 'w0', spanWeeks: 1, dependency: { predecessorKey: 'A', triggerPercent: 100 } }
    ];
    const out = cascadePreview(tasks, 'A', weeks);
    expect(out.map(t => t.startWeek)).toEqual(['w0', 'w1', 'w1']);
  });

  it('cascadePreview moves conflicting successors and leaves others', () => {
    const tasks: PreviewTask[] = [
      { key: 'A', startWeek: 'w1', spanWeeks: 4 },
      { key: 'B', startWeek: 'w1', spanWeeks: 2, dependency: { predecessorKey: 'A', triggerPercent: 30 } },
      { key: 'C', startWeek: 'w7', spanWeeks: 1, dependency: { predecessorKey: 'A', triggerPercent: 30 } },
      { key: 'D', startWeek: 'w0', spanWeeks: 1, dependency: { predecessorKey: 'B', triggerPercent: 100 } }
    ];
    const out = cascadePreview(tasks, 'A', weeks);
    const byKey = new Map(out.map(t => [t.key, t]));
    expect(byKey.get('B')!.startWeek).toBe('w3');
    expect(byKey.get('C')!.startWeek).toBe('w7');
    expect(byKey.get('D')!.startWeek).toBe('w5');
    expect(tasks[1].startWeek).toBe('w1');
  });
});
