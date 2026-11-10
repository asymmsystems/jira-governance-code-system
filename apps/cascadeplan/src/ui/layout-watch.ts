/*
 * Copyright (c) 2026 Asymm Systems. All rights reserved.
 *
 * @author Fahim Farook
 */

/**
 * CascadePlan: the canvas timeline follows the layout it is drawn from.
 *
 * The canvas draws each bar from measured positions: where the first row starts in the table, the
 * header height, the width of the data columns and where the scroll wrapper sits in its section.
 * These positions move when an element changes size: a bar above the grid is shown or hidden (the
 * hidden-columns bar, the first-link tip, the loading line), the backlog tray opens or closes, or
 * the drop rows grow and shrink with their CSS transition during a backlog drag. Each of these
 * changes the size of the scroll wrapper or of the table, so a size observer on those two elements
 * tells the planner to measure again and redraw, also after a transition has ended.
 */

/** The part of ResizeObserver the planner uses. */
export interface SizeObserverLike {
  observe(target: Element): void;
  disconnect(): void;
}

export type SizeObserverConstructor = new (callback: () => void) => SizeObserverLike;

/**
 * Calls onChange each time one of the elements changes size. Returns a function that stops
 * watching. Without a ResizeObserver (old browsers, tests) it watches nothing.
 */
export function watchSizes(
  elements: ReadonlyArray<Element | null | undefined>,
  onChange: () => void,
  Observer: SizeObserverConstructor | undefined = (globalThis as any).ResizeObserver
): () => void {
  const targets = elements.filter((el): el is Element => !!el);
  if (!Observer || targets.length === 0) return () => undefined;
  const observer = new Observer(() => onChange());
  for (const el of targets) observer.observe(el);
  return () => observer.disconnect();
}

/**
 * The timeline scroll position after the data columns change width (columns hidden or shown,
 * Compact on or off). The date in the middle of the visible timeline stays in the middle, so bars
 * that were in view stay in view. Keeping the old position instead keeps only the left edge: when
 * columns come back, the visible timeline loses its right part and the bars there go out of view.
 *
 * `trackViewBefore` and `trackViewAfter` are the visible timeline widths (wrapper width minus the
 * data columns) before and after the change.
 */
export function keepMiddleInView(scrollLeft: number, trackViewBefore: number, trackViewAfter: number): number {
  const before = Math.max(0, trackViewBefore);
  const after = Math.max(0, trackViewAfter);
  return Math.max(0, Math.round(scrollLeft + (before - after) / 2));
}
