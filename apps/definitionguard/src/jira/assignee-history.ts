/**
 * Who was the assignee of an issue during a time window, from the Jira changelog (H-2).
 *
 * Copyright (c) 2026 Asymm Systems. All rights reserved.
 * @author Fahim Farook
 *
 * A "not the assignee" item must not be completed or waived by anyone who was the assignee
 * after the item was opened, not only by the current assignee. Otherwise the assignee could
 * unassign the issue, tick the review item, and move the issue to Done.
 */
import api, { route } from '@forge/api';
import { withRetry } from './jira-client';

export interface AssigneeChange {
  at: number;            // epoch milliseconds of the change
  from?: string;         // account id before
  to?: string;           // account id after
}

export const CHANGELOG_PAGE = 100;
/** At most this many changelog pages are read (10,000 changes); more fails closed. */
export const MAX_CHANGELOG_PAGES = 100;
/** Changes this close before the window start still count, to allow for clock differences. */
export const CLOCK_GRACE_MS = 5000;

export const ASSIGNEE_HISTORY_FAILED = 'DefinitionGuard could not read the assignee history, so the change was not saved. Try again.';

/**
 * Every assignee change of the issue, oldest first, read as the user or as the app.
 * Throws when a page cannot be read or the history is longer than MAX_CHANGELOG_PAGES (fail closed).
 */
export async function assigneeChanges(issueIdOrKey: string, who: 'user' | 'app'): Promise<AssigneeChange[]> {
  const out: AssigneeChange[] = [];
  let startAt = 0;
  for (let page = 0; page < MAX_CHANGELOG_PAGES; page++) {
    let res: any;
    try {
      const path = route`/rest/api/3/issue/${issueIdOrKey}/changelog?startAt=${startAt}&maxResults=${CHANGELOG_PAGE}`;
      res = who === 'user'
        ? await withRetry(() => api.asUser().requestJira(path))
        : await withRetry(() => api.asApp().requestJira(path));
    } catch {
      res = { status: 0 };
    }
    if (res.status !== 200) throw new Error(ASSIGNEE_HISTORY_FAILED);
    const body = await res.json();
    const values: any[] = Array.isArray(body?.values) ? body.values : [];
    for (const h of values) {
      const at = typeof h?.created === 'number' ? h.created : Date.parse(String(h?.created || ''));
      for (const item of Array.isArray(h?.items) ? h.items : []) {
        if (item?.fieldId !== 'assignee' && item?.field !== 'assignee') continue;
        out.push({ at: Number.isNaN(at) ? Number.POSITIVE_INFINITY : at, from: item.from || undefined, to: item.to || undefined });
      }
    }
    startAt += values.length;
    const total = typeof body?.total === 'number' ? body.total : startAt;
    if (body?.isLast === true || values.length === 0 || startAt >= total) {
      return out.sort((a, b) => a.at - b.at);
    }
  }
  throw new Error(ASSIGNEE_HISTORY_FAILED);
}

/**
 * Everyone who was the assignee at any moment from `sinceIso` until now: the current assignee,
 * and both sides of every assignee change after the window start. A change with an unreadable
 * date counts. Without `sinceIso`, the whole history counts.
 */
export function assigneesSince(changes: AssigneeChange[], currentAssignee: string | undefined, sinceIso?: string): Set<string> {
  const since = sinceIso ? Date.parse(sinceIso) : Number.NaN;
  const start = Number.isNaN(since) ? Number.NEGATIVE_INFINITY : since - CLOCK_GRACE_MS;
  const out = new Set<string>();
  if (currentAssignee) out.add(currentAssignee);
  for (const c of changes) {
    if (c.at < start) continue;
    if (c.from) out.add(c.from);
    if (c.to) out.add(c.to);
  }
  return out;
}
