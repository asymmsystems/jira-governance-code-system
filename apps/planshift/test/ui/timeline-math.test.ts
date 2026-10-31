/*
 * Copyright (c) 2026 Asymm Systems. All rights reserved.
 *
 * @author Fahim Farook
 */

import { weekIndexOf, deltaWeeksFromPixels, clampStartIndex, spanFromResize } from '../../src/ui/timeline-math';

const weeks = [{ weekKey: '07-Oct' }, { weekKey: '14-Oct' }, { weekKey: '21-Oct' }, { weekKey: '28-Oct' }];

describe('timeline-math (B-01)', () => {
  it('weekIndexOf returns the index of a known week and the fallback for an unknown one', () => {
    expect(weekIndexOf(weeks, '21-Oct', 0)).toBe(2);
    expect(weekIndexOf(weeks, 'nope', 0)).toBe(0);
    expect(weekIndexOf(weeks, undefined, 3)).toBe(3);
  });

  it('deltaWeeksFromPixels rounds the drag distance to whole weeks', () => {
    expect(deltaWeeksFromPixels(0, 85)).toBe(0);
    expect(deltaWeeksFromPixels(42, 85)).toBe(0);
    expect(deltaWeeksFromPixels(43, 85)).toBe(1);
    expect(deltaWeeksFromPixels(170, 85)).toBe(2);
    expect(deltaWeeksFromPixels(-130, 85)).toBe(-2);
  });

  it('clampStartIndex keeps the whole bar inside the window', () => {
    expect(clampStartIndex(1, 2, 3, 10)).toBe(3);
    expect(clampStartIndex(1, -5, 3, 10)).toBe(0);
    expect(clampStartIndex(5, 9, 3, 10)).toBe(7);
    expect(clampStartIndex(0, 4, 20, 10)).toBe(0);
  });

  it('spanFromResize changes the right edge or the left edge only', () => {
    expect(spanFromResize('right', 2, 3, 1, 10)).toEqual({ startIdx: 2, span: 4 });
    expect(spanFromResize('right', 2, 3, -9, 10)).toEqual({ startIdx: 2, span: 1 });
    expect(spanFromResize('right', 8, 2, 5, 10)).toEqual({ startIdx: 8, span: 2 });
    expect(spanFromResize('left', 2, 3, -1, 10)).toEqual({ startIdx: 1, span: 4 });
    expect(spanFromResize('left', 2, 3, 5, 10)).toEqual({ startIdx: 4, span: 1 });
    expect(spanFromResize('left', 1, 3, -5, 10)).toEqual({ startIdx: 0, span: 4 });
  });
});
