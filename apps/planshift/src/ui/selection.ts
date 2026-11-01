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

interface Movable { key: string; startDate?: string; endDate?: string; version?: number; isEpic?: boolean; hierarchyLevel?: number; datesFromChildren?: boolean }

/**
 * "Move by N days": exact new dates for each selected task that has dates, earliest first, so a
 * predecessor moves before its dependents. Epics and parents whose dates follow their children are left out.
 */
export function moveSelectionBy(tasks: Movable[], selected: Set<string>, days: number): Array<{ taskId: string; updates: { startDate: string; endDate: string }; expectedVersion: number }> {
  if (!days) return [];
  return tasks
    .filter(t => selected.has(t.key) && t.startDate && !t.isEpic && t.hierarchyLevel !== 1 && !t.datesFromChildren)
    .sort((a, b) => (a.startDate! < b.startDate! ? -1 : a.startDate! > b.startDate! ? 1 : 0))
    .map(t => ({ taskId: t.key, updates: { startDate: addDays(t.startDate!, days), endDate: addDays(t.endDate || t.startDate!, days) }, expectedVersion: t.version || 0 }));
}

/** Digits 0 to 9 set progress in steps of 10 (keyboard standup flow). */
export function progressFromDigit(key: string): number | null {
  return /^[0-9]$/.test(key) ? Number(key) * 10 : null;
}
