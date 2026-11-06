/*
 * Copyright (c) 2026 Asymm Systems. All rights reserved.
 *
 * @author Fahim Farook
 */

import { daysBetween, xForDate, barRect, visibleRange, handleOffsets, snapDays, previewMoves, frozenColumnsWidth, HANDLE_PX, portOffsets, PORT_PX, bezierPoints, distanceToPath, nearestArrow, Point } from '../../src/ui/timeline-geometry';

const ORIGIN = '2026-10-07';
const DAY = 85 / 7;

describe('timeline geometry (B-13)', () => {
  it('maps dates to x in days from the origin', () => {
    expect(daysBetween(ORIGIN, '2026-10-14')).toBe(7);
    expect(xForDate('2026-10-14', ORIGIN, DAY)).toBeCloseTo(85);
    expect(xForDate(ORIGIN, ORIGIN, DAY)).toBe(0);
  });

  it('gives a bar rectangle with an inclusive end day and at least one day wide', () => {
    expect(barRect({ startDate: '2026-10-14', endDate: '2026-10-20' }, ORIGIN, DAY, 100, 44, 22)).toEqual({ x: 85, y: 111, w: 85, h: 22 });
    expect(barRect({ startDate: '2026-10-14', endDate: '2026-10-10' }, ORIGIN, DAY, 0, 44, 22)!.w).toBeCloseTo(DAY);
    expect(barRect({}, ORIGIN, DAY, 0, 44, 22)).toBeNull();
  });

  it('visibleRange returns the rows in the viewport plus a buffer, clamped', () => {
    expect(visibleRange(0, 440, 44, 1000, 10)).toEqual({ first: 0, last: 20 });
    expect(visibleRange(44 * 500, 440, 44, 1000, 10)).toEqual({ first: 490, last: 520 });
    expect(visibleRange(44 * 995, 440, 44, 1000, 10)).toEqual({ first: 985, last: 999 });
    expect(visibleRange(0, 440, 44, 0, 10)).toEqual({ first: 0, last: -1 });
  });

  it('resize handles are 24 px, centred on the edges of a wide bar and outside a narrow one', () => {
    expect(HANDLE_PX).toBe(24);
    expect(handleOffsets(200)).toEqual({ left: -12, right: 188 });
    expect(handleOffsets(48)).toEqual({ left: -12, right: 36 });
    expect(handleOffsets(30)).toEqual({ left: -24, right: 30 });
  });

  it('snapDays snaps a drag to whole weeks or days', () => {
    expect(snapDays(170, DAY, 'week')).toBe(14);
    expect(snapDays(40, DAY, 'week')).toBe(0);
    expect(snapDays(-50, DAY, 'week')).toBe(-7);
    expect(snapDays(30, DAY, 'day')).toBe(2);
    expect(snapDays(0, DAY, 'day')).toBe(0);
  });

  it('previewMoves shifts the dragged task and moves conflicting dependents with the engine', () => {
    const tasks: any[] = [
      { key: 'A', startDate: '2026-11-04', endDate: '2026-11-13', progress: 0 },
      { key: 'B', startDate: '2026-11-14', endDate: '2026-11-17', progress: 0, dependency: { predecessorKey: 'A', triggerPercent: 100 } },
      { key: 'C', startDate: '2026-12-20', endDate: '2026-12-21', progress: 0, dependency: { predecessorKey: 'A', triggerPercent: 100 } }
    ];
    const moves = previewMoves(tasks, 'A', 7, 7, '2026-11-01');
    expect(moves.get('A')).toEqual({ start: '2026-11-11', end: '2026-11-20' });
    expect(moves.get('B')).toEqual({ start: '2026-11-21', end: '2026-11-24' });
    expect(moves.has('C')).toBe(false);
    expect(previewMoves(tasks, 'ZZ', 7, 7, '2026-11-01').size).toBe(0);
    expect(previewMoves(tasks, 'A', 0, 3, '2026-11-01').get('A')).toEqual({ start: '2026-11-04', end: '2026-11-16' });
    expect(previewMoves(tasks, 'A', 0, -30, '2026-11-01').get('A')).toEqual({ start: '2026-11-04', end: '2026-11-04' });
  });

  it('previewMoves skips undated tasks, treats started tasks as started, and shows no dependents on a cycle', () => {
    const undated: any[] = [{ key: 'A', startDate: '2026-11-04' }, { key: 'U', status: 'IN_PROGRESS' },
      { key: 'S', startDate: '2026-11-05', endDate: '2026-11-06', status: 'IN_PROGRESS', dependency: { predecessorKey: 'A', triggerPercent: 100 } }];
    expect(previewMoves(undated, 'A', 2, 2, '2026-11-01').get('A')).toEqual({ start: '2026-11-06', end: '2026-11-06' });
    expect(previewMoves(undated, 'U', 2, 2, '2026-11-01').size).toBe(0);
    const cycle: any[] = [
      { key: 'A', startDate: '2026-11-04', endDate: '2026-11-05', dependency: { predecessorKey: 'B', triggerPercent: 50 } },
      { key: 'B', startDate: '2026-11-04', endDate: '2026-11-05', dependency: { predecessorKey: 'A', triggerPercent: 50 } }
    ];
    expect([...previewMoves(cycle, 'A', 3, 3, '2026-11-01').keys()]).toEqual(['A']);
  });

  it('computes exact frozen columns boundary without offset gap', () => {
    const widths = { epic: 110, story: 100, task: 260, resource: 130, effort: 75, progress: 95, target: 95, status: 125 };
    const keys = ['epic', 'story', 'task', 'resource', 'effort', 'progress', 'target', 'status'];
    expect(frozenColumnsWidth(keys, widths)).toBe(990);
    expect(frozenColumnsWidth(['task'], widths)).toBe(260);
  });
});

describe('link ports and arrow hit tests (owner report 2026-11-05)', () => {
  it('ports sit just outside the resize handles, touching them, on wide and narrow bars', () => {
    for (const w of [200, 30]) {
      const h = handleOffsets(w);
      const p = portOffsets(w);
      expect(p.right).toBe(h.right + HANDLE_PX); // starts where the right handle ends
      expect(p.left + PORT_PX).toBe(h.left);      // ends where the left handle starts
      expect(p.right).toBeGreaterThanOrEqual(w);  // never over the bar body
      expect(p.left + PORT_PX).toBeLessThanOrEqual(0);
    }
  });

  it('bezierPoints runs from the first to the last control point', () => {
    const pts = bezierPoints([0, 0], [10, 0], [20, 10], [30, 10], 4);
    expect(pts).toHaveLength(5);
    expect(pts[0]).toEqual([0, 0]);
    expect(pts[4]).toEqual([30, 10]);
  });

  it('distanceToPath and nearestArrow find the line under the pointer, within the tolerance', () => {
    const a = { id: 'a', path: [[0, 0], [100, 0]] as Point[] };
    const b = { id: 'b', path: [[0, 20], [100, 20]] as Point[] };
    expect(distanceToPath(a.path, 50, 3)).toBeCloseTo(3);
    expect(distanceToPath([[5, 5]], 8, 9)).toBeCloseTo(5);
    expect(nearestArrow([a, b], 50, 4)?.id).toBe('a');
    expect(nearestArrow([a, b], 50, 15)?.id).toBe('b');
    expect(nearestArrow([a, b], 50, 10)).toBeNull();
    expect(nearestArrow([{ id: 'c' } as { id: string; path?: Point[] }], 0, 0)).toBeNull();
  });
});
