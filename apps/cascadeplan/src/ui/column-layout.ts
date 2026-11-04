/*
 * Copyright (c) 2026 Asymm Systems. All rights reserved.
 *
 * @author Fahim Farook
 */

/**
 * Single source of truth for planner column widths, readable floors on load,
 * interactive resize clamping, and frozen sticky column offsets.
 */

export type ColumnKey = 'epic' | 'story' | 'task' | 'resource' | 'effort' | 'progress' | 'target' | 'status';

export const ALL_COLUMN_KEYS: readonly ColumnKey[] = [
  'epic',
  'story',
  'task',
  'resource',
  'effort',
  'progress',
  'target',
  'status'
];

export const DEFAULT_COLUMN_WIDTHS: Record<ColumnKey, number> = {
  epic: 110,
  story: 100,
  task: 260,
  resource: 130,
  effort: 65,
  progress: 65,
  target: 65,
  status: 95
};

export const MIN_COLUMN_WIDTHS: Record<ColumnKey, number> = {
  epic: 68,
  story: 64,
  task: 160,
  resource: 80,
  effort: 48,
  progress: 50,
  target: 50,
  status: 70
};

export const COMPACT_TASK_DEFAULT_WIDTH = 220;
export const MAX_COLUMN_WIDTH = 640;

/**
 * Validates widths loaded from storage or server: enforces minimum readable floor
 * per column, clamps to maximum bounds, and preserves user-customized widths.
 */
export function sanitizeLoadedColumnWidths(
  saved?: Partial<Record<string, number>> | null
): Record<ColumnKey, number> {
  const out = { ...DEFAULT_COLUMN_WIDTHS };
  if (!saved || typeof saved !== 'object') return out;
  for (const key of ALL_COLUMN_KEYS) {
    const raw = Number(saved[key]);
    if (Number.isFinite(raw) && raw >= MIN_COLUMN_WIDTHS[key]) {
      out[key] = Math.min(MAX_COLUMN_WIDTH, Math.round(raw));
    }
  }
  return out;
}

/**
 * Clamps a live user-dragged column width to safe readable bounds.
 */
export function clampColumnResize(key: string, candidateWidth: number): number {
  const k = key as ColumnKey;
  const fallback = DEFAULT_COLUMN_WIDTHS[k] ?? 96;
  if (!Number.isFinite(candidateWidth)) return fallback;
  const minW = MIN_COLUMN_WIDTHS[k] ?? 64;
  return Math.max(minW, Math.min(MAX_COLUMN_WIDTH, Math.round(candidateWidth)));
}

export interface FrozenLayout {
  visibleKeys: readonly string[];
  widths: Record<string, number>;
  offsets: Record<string, number>;
  totalWidth: number;
  lastKey: string | null;
}

/**
 * Computes exact rendered widths, cumulative sticky left offsets, and total frozen boundary
 * for both full hierarchy columns and compact task-only mode.
 */
export function computeFrozenLayout(
  visibleKeys: readonly string[],
  columnWidths: Partial<Record<string, number>>,
  compactColumns: boolean,
  compactTaskWidth = COMPACT_TASK_DEFAULT_WIDTH
): FrozenLayout {
  const widths: Record<string, number> = {};
  const offsets: Record<string, number> = {};
  let x = 0;
  let lastKey: string | null = null;

  for (const k of visibleKeys) {
    const base = compactColumns && k === 'task'
      ? compactTaskWidth
      : (columnWidths[k] ?? DEFAULT_COLUMN_WIDTHS[k as ColumnKey] ?? 100);
    const w = Math.round(base);
    widths[k] = w;
    offsets[k] = x;
    x += w;
    lastKey = k;
  }

  return { visibleKeys, widths, offsets, totalWidth: x, lastKey };
}
