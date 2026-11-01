/*
 * Copyright (c) 2026 Asymm Systems. All rights reserved.
 *
 * @author Fahim Farook
 */

/**
 * CascadePlan: rules of the WorkEffort model that are not plain storage (pure; B-28).
 * Precedency links are time-bound: a removed link ends (thruDate) and keeps its record, so a Jira
 * link from that predecessor is not imported again. Second people are parties keyed by account id;
 * their names are read live. A parent's dates are derived from its children, never stored.
 */

import { TaskDependency } from './models';

export interface EndedLink {
  predecessorKey: string;
  triggerPercent?: number;
  since?: string;
  until: string;
  jiraLinkId?: string;
}

export interface Contributor {
  accountId?: string;
  legacyName?: string;
  since?: string;
  subtaskKey?: string;
}

interface User { accountId: string; displayName: string }

function ended(d: TaskDependency, today: string): EndedLink {
  const e: EndedLink = { predecessorKey: d.predecessorKey, triggerPercent: d.triggerPercent, since: d.since, until: today };
  if (d.jiraLinkId) e.jiraLinkId = d.jiraLinkId;
  if (!e.since) delete e.since;
  return e;
}

/**
 * Applies a dependency update. Undefined changes nothing; null ends every active link; a link
 * replaces the active set: the same predecessor keeps its start date, the others end today.
 * Returns the links that ended, so the caller can remove the Jira links CascadePlan created.
 */
export function applyLinkUpdate(current: TaskDependency[], endedLinks: EndedLink[], update: TaskDependency | null | undefined, today: string):
  { dependencies: TaskDependency[]; endedLinks: EndedLink[]; removed: TaskDependency[] } {
  if (update === undefined) return { dependencies: current, endedLinks, removed: [] };
  const keep = update ? current.find(d => d.predecessorKey === update.predecessorKey) : undefined;
  const removed = current.filter(d => d !== keep);
  const dependencies: TaskDependency[] = [];
  if (update) {
    const next: TaskDependency = { ...(keep || {}), ...update, since: keep && keep.since ? keep.since : today };
    if (!next.jiraLinkId && keep && keep.jiraLinkId) next.jiraLinkId = keep.jiraLinkId;
    if (!next.jiraLinkId) delete next.jiraLinkId;
    dependencies.push(next);
  }
  // One ended record per predecessor, the latest; a re-added predecessor has none.
  const byKey = new Map<string, EndedLink>();
  for (const e of [...endedLinks, ...removed.map(d => ended(d, today))]) byKey.set(e.predecessorKey, e);
  if (update) byKey.delete(update.predecessorKey);
  return { dependencies, endedLinks: [...byKey.values()], removed };
}

/** Stored links plus a 100% link (finish-to-start) for each Jira "Blocks" predecessor not stored or ended. */
export function importJiraLinks(stored: TaskDependency[], endedLinks: EndedLink[], blockedBy: Array<{ key: string; id: string }>): TaskDependency[] {
  const known = new Set([...stored.map(d => d.predecessorKey), ...endedLinks.map(e => e.predecessorKey)]);
  const imported = blockedBy.filter(b => !known.has(b.key))
    .map(b => ({ predecessorId: b.id, predecessorKey: b.key, triggerPercent: 100, isTriggerSatisfied: false }));
  return [...stored, ...imported];
}

/**
 * Contributors from display names: a name that exactly one Jira user has becomes that user's
 * account id; any other name is kept as legacyName, so nothing is lost and nothing is guessed.
 */
export function contributorsFromNames(names: string[], users: User[], previous: Contributor[], today: string): Contributor[] {
  return names.map(name => {
    const matches = users.filter(u => u.displayName === name);
    const c: Contributor = matches.length === 1 ? { accountId: matches[0].accountId } : { legacyName: name };
    const old = previous.find(p => (c.accountId && p.accountId === c.accountId) || (c.legacyName && p.legacyName === c.legacyName));
    c.since = old && old.since ? old.since : today;
    return c;
  });
}

/** Names to show, read live from the Jira users; a person no longer in the project is left out. */
export function contributorNames(contributors: Contributor[] | undefined, users: User[]): string[] {
  const byId = new Map(users.map(u => [u.accountId, u.displayName]));
  const out: string[] = [];
  for (const c of contributors || []) {
    const name = c.accountId ? byId.get(c.accountId) : c.legacyName;
    if (name) out.push(name);
  }
  return out;
}

/** Dates of every task that has dated children: from the earliest child start to the latest child end. */
export function rollUpParentDates(tasks: Array<{ key: string; parentKey?: string; startDate?: string; endDate?: string }>): Map<string, { startDate: string; endDate: string }> {
  const out = new Map<string, { startDate: string; endDate: string }>();
  for (const t of tasks) {
    if (!t.parentKey || !t.startDate) continue;
    const end = t.endDate && t.endDate >= t.startDate ? t.endDate : t.startDate;
    const cur = out.get(t.parentKey);
    out.set(t.parentKey, cur
      ? { startDate: t.startDate < cur.startDate ? t.startDate : cur.startDate, endDate: end > cur.endDate ? end : cur.endDate }
      : { startDate: t.startDate, endDate: end });
  }
  return out;
}

/**
 * Converts the links and people of a model 1 entry. An old link starts on the migration day; an old
 * "removed" flag ends the Jira links it was suppressing; names become contributors.
 */
export function migrateEntry(old: { dependency?: TaskDependency | null; contributingResources?: string[] }, users: User[], jiraBlockedBy: string[], today: string):
  { dependencies: TaskDependency[]; endedLinks: EndedLink[]; contributors: Contributor[] } {
  const dependencies = old.dependency ? [{ ...old.dependency, since: today }] : [];
  const endedLinks = old.dependency === null ? jiraBlockedBy.map(k => ({ predecessorKey: k, triggerPercent: 100, until: today })) : [];
  return { dependencies, endedLinks, contributors: contributorsFromNames(old.contributingResources || [], users, [], today) };
}
