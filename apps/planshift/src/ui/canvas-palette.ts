/*
 * Copyright (c) 2026 Asymm Systems. All rights reserved.
 *
 * @author Fahim Farook
 */

/**
 * CascadePlan: the colours the canvas timeline draws with, as --cp token names (pure; B-13).
 * axe cannot see canvas pixels, so every pair listed in CANVAS_PAIRS is checked by a unit test
 * against the ADS token values in light and dark mode (UR-10).
 */

export const CANVAS_TOKENS = {
  grid: '--cp-border',
  todayLine: '--cp-bg-brand',
  todayFlagBg: '--cp-bg-brand',
  todayFlagText: '--cp-text-inverse',
  labelChip: '--cp-surface-raised',
  labelText: '--cp-text',
  arrowOk: '--cp-border-bold',
  arrowViolated: '--cp-border-danger',
  arrowActive: '--cp-border-brand',
  badgeOkText: '--cp-text-success',
  badgeViolatedText: '--cp-text-danger',
  preview: '--cp-border-bold',
  focus: '--cp-border-focused',
  driverText: '--cp-text-brand'
} as const;

export interface BarTask {
  status?: string;
  progress?: number;
  targetProgress?: number;
  isEpic?: boolean;
  hierarchyLevel?: number;
}

export interface BarStyle {
  /** Outline and progress fill: the part that must reach 3:1 against the row. */
  fill: string;
  /** Remaining planned part inside the outline (decorative). */
  track: string;
}

/** Bar colours by state: done, behind target, epic, or normal. */
export function barStyle(task: BarTask): BarStyle {
  const epic = Boolean(task.isEpic || task.hierarchyLevel === 1);
  const track = epic ? '--cp-bar-epic' : '--cp-bar-planned';
  if (task.status === 'COMPLETED') return { fill: '--cp-bar-done', track };
  if ((task.progress || 0) < (task.targetProgress || 0)) return { fill: '--cp-bar-late', track };
  return { fill: epic ? '--cp-bar-epic-fill' : '--cp-bar-fill', track };
}

/**
 * Detects if a task is marked in-progress but has 0% explicit progress logged.
 * Used to draw a distinct diagonal hatched fill so in-progress work is immediately visible.
 */
export function isInProgressZero(task: BarTask): boolean {
  const norm = (task.status || '').toUpperCase().replace(/[\s_-]+/g, '');
  const inProgress = norm === 'INPROGRESS';
  const hasProgress = typeof task.progress === 'number' && task.progress > 0;
  return inProgress && !hasProgress;
}

/** Rows are drawn over these backgrounds: plain, sunken (subtask and hover rows). */
export const ROW_BACKGROUNDS = ['--cp-surface', '--cp-surface-sunken'] as const;

export interface ColourPair { name: string; fg: string; bg: string; min: number }

/** Every foreground/background pair the canvas draws, with the WCAG minimum it must reach. */
export const CANVAS_PAIRS: ColourPair[] = [
  ...['--cp-bar-fill', '--cp-bar-epic-fill', '--cp-bar-done', '--cp-bar-late',
    CANVAS_TOKENS.todayLine, CANVAS_TOKENS.arrowOk, CANVAS_TOKENS.arrowViolated, CANVAS_TOKENS.arrowActive,
    CANVAS_TOKENS.preview, CANVAS_TOKENS.focus]
    .flatMap(fg => ROW_BACKGROUNDS.map(bg => ({ name: `graphic ${fg}`, fg, bg, min: 3 }))),
  { name: 'label', fg: CANVAS_TOKENS.labelText, bg: CANVAS_TOKENS.labelChip, min: 4.5 },
  { name: 'today flag', fg: CANVAS_TOKENS.todayFlagText, bg: CANVAS_TOKENS.todayFlagBg, min: 4.5 },
  { name: 'badge ok', fg: CANVAS_TOKENS.badgeOkText, bg: CANVAS_TOKENS.labelChip, min: 4.5 },
  { name: 'badge violated', fg: CANVAS_TOKENS.badgeViolatedText, bg: CANVAS_TOKENS.labelChip, min: 4.5 },
  { name: 'driver', fg: CANVAS_TOKENS.driverText, bg: CANVAS_TOKENS.labelChip, min: 4.5 }
];

/** Gap between a label chip and the bar edge. */
export const LABEL_PAD = 4;

/**
 * Where a label goes: on its own opaque chip inside the bar when the chip fits, otherwise to the
 * right of the bar. The label never sits directly on a bar fill (B-13 criterion 9).
 */
export function labelPlacement(barX: number, barW: number, chipW: number): { x: number; inside: boolean } {
  if (chipW + LABEL_PAD * 2 <= barW) return { x: barX + LABEL_PAD, inside: true };
  return { x: barX + barW + LABEL_PAD, inside: false };
}

/**
 * System colours used instead of tokens when forced colours are active (Windows contrast themes,
 * B-15 criterion 12). Bars become outlined shapes with a Highlight progress fill.
 */
export const FORCED_COLOURS: Record<string, string> = {
  [CANVAS_TOKENS.grid]: 'GrayText',
  [CANVAS_TOKENS.todayLine]: 'Highlight',
  [CANVAS_TOKENS.todayFlagText]: 'HighlightText',
  [CANVAS_TOKENS.labelChip]: 'Canvas',
  [CANVAS_TOKENS.labelText]: 'CanvasText',
  [CANVAS_TOKENS.arrowOk]: 'CanvasText',
  [CANVAS_TOKENS.arrowViolated]: 'LinkText',
  [CANVAS_TOKENS.arrowActive]: 'Highlight',
  [CANVAS_TOKENS.badgeOkText]: 'CanvasText',
  [CANVAS_TOKENS.badgeViolatedText]: 'LinkText',
  [CANVAS_TOKENS.focus]: 'Highlight',
  [CANVAS_TOKENS.driverText]: 'CanvasText',
  '--cp-bar-fill': 'Highlight',
  '--cp-bar-epic-fill': 'Highlight',
  '--cp-bar-done': 'Highlight',
  '--cp-bar-late': 'Highlight',
  '--cp-bar-planned': 'Canvas',
  '--cp-bar-epic': 'Canvas'
};
