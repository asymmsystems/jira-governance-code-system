/*
 * Copyright (c) 2026 Asymm Systems. All rights reserved.
 *
 * @author Fahim Farook
 */

/**
 * CascadePlan: multi-select and batch edits for the standup flow (pure; B-16).
 */

import { addDays } from '../domain/schedule-engine';

/** Ctrl/Cmd+click or Space: add the key, or remove it when it is selected. */
export function toggleKey(selected: Set<string>, key: string): Set<string> {
  const next = new Set(selected);
  if (next.has(key)) next.delete(key);
  else next.add(key);
  return next;
}

/** Shift+click: the rows from the anchor to the key, in display order. */
export function rangeKeys(order: string[], anchor: string | null, key: string): string[] {
  const a = anchor ? order.indexOf(anchor) : -1;
  const b = order.indexOf(key);
  if (a < 0 || b < 0) return [key];
  return order.slice(Math.min(a, b), Math.max(a, b) + 1);
}

interface Movable { key: string; startDate?: string; endDate?: string; version?: number; isEpic?: boolean; hierarchyLevel?: number; datesFromChildren?: boolean; parentKey?: string }

/** Selected task or story parents whose dates follow their sub-tasks: each moves as a block (ADR-003). */
export function selectedBlockParents(tasks: Movable[], selected: Set<string>): string[] {
  return tasks.filter(t => selected.has(t.key) && t.datesFromChildren && !t.isEpic && (t.hierarchyLevel ?? 0) === 0).map(t => t.key);
}

/**
 * "Move by N days": exact new dates for each selected task that has dates, earliest first, so a
 * predecessor moves before its dependents. Epics and parents whose dates follow their children are left out;
 * a selected sub-task of a selected block parent is left out too, because it moves with its block (each
 * issue moves once, ADR-003 section 7).
 */
export function moveSelectionBy(tasks: Movable[], selected: Set<string>, days: number): Array<{ taskId: string; updates: { startDate: string; endDate: string }; expectedVersion: number }> {
  if (!days) return [];
  const blocks = new Set(selectedBlockParents(tasks, selected));
  const byKey = new Map(tasks.map(t => [t.key, t]));
  const inSelectedBlock = (t: Movable): boolean => {
    const seen = new Set<string>();
    for (let k = t.parentKey; k && !seen.has(k); k = byKey.get(k)?.parentKey) {
      if (blocks.has(k)) return true;
      seen.add(k);
    }
    return false;
  };
  return tasks
    .filter(t => selected.has(t.key) && t.startDate && !t.isEpic && t.hierarchyLevel !== 1 && !t.datesFromChildren && !inSelectedBlock(t))
    .sort((a, b) => (a.startDate! < b.startDate! ? -1 : a.startDate! > b.startDate! ? 1 : 0))
    .map(t => ({ taskId: t.key, updates: { startDate: addDays(t.startDate!, days), endDate: addDays(t.endDate || t.startDate!, days) }, expectedVersion: t.version || 0 }));
}

/** Digits 0 to 9 set progress in steps of 10 (keyboard standup flow). */
export function progressFromDigit(key: string): number | null {
  return /^[0-9]$/.test(key) ? Number(key) * 10 : null;
}
