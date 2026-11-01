/*
 * Copyright (c) 2026 Asymm Systems. All rights reserved.
 *
 * @author Fahim Farook
 */

/**
 * CascadePlan: client-side time axis with zoom levels and an open-ended range (B-27).
 */

import { ZOOMS, zoomById, zoomStep, mondayOf, initialRange, rangeDays, extendRange, edgeToExtend, headerCells, gridLines, anchorScroll, dateAt } from '../../src/ui/time-scale';

describe('zoom levels (B-27 criteria 1 and 4)', () => {
  it('Day, Week, Month, Quarter, Year; days snap at Day and Week, weeks at Month and above', () => {
    expect(ZOOMS.map(z => [z.id, z.label, z.snap])).toEqual([
      ['day', 'Day', 'day'], ['week', 'Week', 'day'], ['month', 'Month', 'week'], ['quarter', 'Quarter', 'week'], ['year', 'Year', 'week']]);
    expect(zoomById('week').dayPx).toBeCloseTo(85 / 7);
    expect(zoomById('nope' as any).id).toBe('week');
    for (let i = 1; i < ZOOMS.length; i++) expect(ZOOMS[i].dayPx).toBeLessThan(ZOOMS[i - 1].dayPx);
  });

  it('zoom in moves toward Day, zoom out toward Year, clamped at the ends', () => {
    expect(zoomStep('week', 1)).toBe('day');
    expect(zoomStep('week', -1)).toBe('month');
    expect(zoomStep('day', 1)).toBe('day');
    expect(zoomStep('year', -1)).toBe('year');
  });
});

describe('range (B-27 criterion 2)', () => {
  it('starts on a Monday 8 weeks before today and covers 52 weeks', () => {
    expect(mondayOf('2026-11-01')).toBe('2026-10-26');
    expect(mondayOf('2026-11-02')).toBe('2026-11-02');
    const r = initialRange('2026-11-01');
    expect(r).toEqual({ start: '2026-08-31', end: '2027-08-29' });
    expect(rangeDays(r)).toBe(364);
  });

  it('extends before or after by whole weeks, and says which edge the scroll position is near', () => {
    const r = { start: '2026-08-31', end: '2027-08-29' };
    expect(extendRange(r, 'before', 26)).toEqual({ start: '2026-03-02', end: '2027-08-29' });
    expect(extendRange(r, 'after', 26)).toEqual({ start: '2026-08-31', end: '2028-02-27' });
    expect(edgeToExtend(100, 1000, 10000)).toBe('before');
    expect(edgeToExtend(8900, 1000, 10000)).toBe('after');
    expect(edgeToExtend(4000, 1000, 10000)).toBeNull();
  });
});

describe('header cells and grid lines (B-27 criterion 5)', () => {
  const r = { start: '2026-10-26', end: '2027-01-31' };
  it('week zoom: one cell per Monday labelled like the week key, the current week marked', () => {
    const cells = headerCells(r, zoomById('week'), '2026-11-04');
    expect(cells.slice(0, 3).map(c => [c.label, Math.round(c.x), Math.round(c.w), !!c.current])).toEqual([['26-Oct', 0, 85, false], ['02-Nov', 85, 85, true], ['09-Nov', 170, 85, false]]);
    expect(cells.length).toBe(14);
  });

  it('day, month, quarter and year zoom cells; only cells in a pixel window when one is given', () => {
    expect(headerCells(r, zoomById('day'), '2026-10-27').slice(0, 2).map(c => [c.label, c.x, !!c.current])).toEqual([['Mon 26', 0, false], ['Tue 27', 40, true]]);
    expect(headerCells(r, zoomById('month'), '2026-11-04').map(c => [c.label, c.x, c.w])).toEqual([['Oct 2026', 0, 24], ['Nov 2026', 24, 120], ['Dec 2026', 144, 124], ['Jan 2027', 268, 124]]);
    expect(headerCells({ start: '2026-08-31', end: '2027-08-29' }, zoomById('quarter'), '2026-11-04').map(c => c.label)).toEqual(['Q3 2026', 'Q4 2026', 'Q1 2027', 'Q2 2027', 'Q3 2027']);
    expect(headerCells({ start: '2026-08-31', end: '2027-08-29' }, zoomById('year'), '2026-11-04').map(c => [c.label, !!c.current])).toEqual([['2026', true], ['2027', false]]);
    expect(headerCells(r, zoomById('day'), '2026-10-27', 399, 480).map(c => c.label)).toEqual(['Wed 4', 'Thu 5', 'Fri 6']);
  });

  it('grid lines sit on unit boundaries inside the window', () => {
    expect(gridLines(r, zoomById('week'), 0, 300).map(Math.round)).toEqual([0, 85, 170, 255]);
    expect(gridLines(r, zoomById('month'), 0, 200)).toEqual([0, 24, 144]);
  });
});

describe('scroll anchoring (B-27 criteria 1 and 3)', () => {
  it('scrollLeft that puts a date at a viewport position, and the date at an x', () => {
    expect(anchorScroll('2026-11-09', 300, '2026-10-26', 85 / 7)).toBeCloseTo(170 - 300);
    expect(dateAt(170, '2026-10-26', 85 / 7)).toBe('2026-11-09');
    expect(dateAt(-5, '2026-10-26', 40)).toBe('2026-10-25');
  });
});
