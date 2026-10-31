/*
 * Copyright (c) 2026 Asymm Systems. All rights reserved.
 *
 * @author Fahim Farook
 */

/**
 * CascadePlan: client-side cascade preview on the week grid (pure, no DOM access).
 * Moved out of the inline planner script. The date-based engine (B-11) replaces it.
 */

export interface PreviewWeek {
  weekKey: string;
  startDate: string;
  endDate: string;
}

export interface PreviewTask {
  key: string;
  startWeek?: string;
  endWeek?: string;
  startDate?: string;
  endDate?: string;
  spanWeeks?: number;
  weeklyAllocations?: Record<string, number>;
  dependency?: { predecessorKey: string; predecessorId?: string; triggerPercent?: number };
}

/**
 * Week index after the week in which the predecessor reaches the trigger percent.
 */
export function earliestStartWeek(pred: PreviewTask, triggerPercent: number, weeks: PreviewWeek[]): number {
  if (!pred || weeks.length === 0) return 0;
  const startIdx = Math.max(0, weeks.findIndex(w => w.weekKey === pred.startWeek));
  const span = Math.max(1, pred.spanWeeks || 1);
  const endIdx = Math.min(weeks.length - 1, startIdx + span - 1);
  const trigger = typeof triggerPercent === 'number' && !isNaN(triggerPercent) ? triggerPercent : 30;
  let cumulative = 0;
  let reached = startIdx;
  for (let i = startIdx; i <= endIdx; i++) {
    const alloc = pred.weeklyAllocations ? pred.weeklyAllocations[weeks[i].weekKey] : undefined;
    cumulative += typeof alloc === 'number' ? alloc : 100 / span;
    reached = i;
    if (cumulative >= trigger) return Math.min(weeks.length - 1, i + 1);
  }
  return Math.min(weeks.length - 1, reached + 1);
}

/**
 * Copies of the tasks with conflicting successors of the changed task moved later.
 */
export function cascadePreview(tasks: PreviewTask[], changedKey: string, weeks: PreviewWeek[]): PreviewTask[] {
  const map = new Map<string, PreviewTask>();
  tasks.forEach(t => map.set(t.key, { ...t, dependency: t.dependency ? { ...t.dependency } : undefined }));
  const queue = [changedKey];
  const visited = new Set<string>();
  while (queue.length > 0) {
    const cur = queue.shift() as string;
    if (visited.has(cur)) continue;
    visited.add(cur);
    const parent = map.get(cur);
    if (!parent) continue;
    for (const t of map.values()) {
      if (!t.dependency || (t.dependency.predecessorKey !== cur && t.dependency.predecessorId !== cur)) continue;
      const trig = typeof t.dependency.triggerPercent === 'number' ? t.dependency.triggerPercent : 30;
      const earliest = earliestStartWeek(parent, trig, weeks);
      const succIdx = weeks.findIndex(w => w.weekKey === t.startWeek);
      if (succIdx < earliest) {
        const span = t.spanWeeks || 3;
        const endIdx = Math.min(weeks.length - 1, earliest + span - 1);
        t.startWeek = weeks[earliest].weekKey;
        t.endWeek = weeks[endIdx].weekKey;
        t.startDate = weeks[earliest].startDate;
        t.endDate = weeks[endIdx].endDate;
        queue.push(t.key);
      }
    }
  }
  return Array.from(map.values());
}
