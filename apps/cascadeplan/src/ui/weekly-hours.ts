/*
 * Copyright (c) 2026 Asymm Systems. All rights reserved.
 *
 * @author Fahim Farook
 */

/**
 * CascadePlan: hours per person per week, computed from the Jira estimates on the plan (pure; D-10).
 * Each estimate is spread evenly over the days of its task. Epics are left out, so a roll-up is not
 * counted twice, and so are unassigned or unestimated tasks. No capacity is assumed.
 */

import { daysBetween } from './timeline-geometry';

interface HoursTask { resource?: string; effortHours?: number; startDate?: string; endDate?: string; isEpic?: boolean; hierarchyLevel?: number }

export function weeklyHours(tasks: HoursTask[], weekStarts: string[]): Array<{ name: string; hours: number[] }> {
  const byName = new Map<string, number[]>();
  for (const t of tasks) {
    if (t.isEpic || t.hierarchyLevel === 1 || !t.resource || t.resource === 'Unassigned' || !(t.effortHours! > 0) || !t.startDate || !t.endDate) continue;
    const days = daysBetween(t.startDate, t.endDate) + 1;
    const perDay = t.effortHours! / days;
    const row = byName.get(t.resource) || weekStarts.map(() => 0);
    weekStarts.forEach((ws, i) => {
      const from = Math.max(0, daysBetween(t.startDate!, ws));
      const to = Math.min(days - 1, daysBetween(t.startDate!, ws) + 6);
      if (to >= from) row[i] += (to - from + 1) * perDay;
    });
    byName.set(t.resource, row);
  }
  return [...byName.entries()].sort((a, b) => a[0].localeCompare(b[0]))
    .map(([name, hours]) => ({ name, hours: hours.map(h => Math.round(h * 10) / 10) }));
}
