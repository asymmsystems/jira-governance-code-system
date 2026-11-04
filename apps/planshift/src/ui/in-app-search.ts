/*
 * Copyright (c) 2026 Asymm Systems. All rights reserved.
 *
 * @author Fahim Farook
 */

/**
 * CascadePlan: in-app task search matching and navigation (pure; B-26).
 */

export interface SearchableTask {
  key?: string;
  summary?: string;
}

export function matchTask(task: SearchableTask, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return false;
  const k = task.key ? task.key.toLowerCase() : '';
  const s = task.summary ? task.summary.toLowerCase() : '';
  return k.includes(q) || s.includes(q);
}

export function findMatchingTasks(tasks: SearchableTask[], query: string): Array<{ task: SearchableTask; index: number }> {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  const results: Array<{ task: SearchableTask; index: number }> = [];
  tasks.forEach((task, index) => {
    if (matchTask(task, q)) {
      results.push({ task, index });
    }
  });
  return results;
}

export function findNextMatch(matchIndices: number[], currentMatchPos: number, direction: 1 | -1 = 1): number {
  const count = matchIndices.length;
  if (count === 0) return -1;
  if (currentMatchPos < 0) return direction === 1 ? 0 : count - 1;
  return (currentMatchPos + direction + count) % count;
}

export function formatMatchCount(query: string, matchCount: number, currentMatchPos: number): string {
  const q = query.trim();
  if (!q) return '';
  if (matchCount === 0) return 'No matches';
  const pos = Math.max(0, currentMatchPos);
  return `${pos + 1} of ${matchCount}`;
}

export function isSearchShortcut(e: {
  key: string;
  ctrlKey?: boolean;
  metaKey?: boolean;
  altKey?: boolean;
  shiftKey?: boolean;
}): boolean {
  if (e.altKey) return false;
  const isCtrlOrCmd = Boolean(e.ctrlKey || e.metaKey);
  return isCtrlOrCmd && (e.key === 'f' || e.key === 'F');
}
