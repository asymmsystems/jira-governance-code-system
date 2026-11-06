/**
 * Copyright (c) 2026 Asymm Systems. All rights reserved.
 *
 * LedgerSeal: separation of duties.
 * Finds who changed an issue after a point in time, so the author of a change cannot approve it.
 *
 * @author Fahim Farook
 */

import { ChangelogEntry } from '../jira/jira-client';

function instant(iso: string | undefined | null): number {
  return Date.parse(String(iso ?? ''));
}

/**
 * Returns the account ids of everyone with a change log entry strictly after `sinceIso`.
 * An entry with an unreadable time counts as after, so the check fails closed.
 */
export function authorsSince(changelog: ChangelogEntry[], sinceIso: string): Set<string> {
  const since = instant(sinceIso);
  const authors = new Set<string>();
  for (const entry of changelog) {
    const at = instant(entry.created);
    const accountId = entry.author?.accountId;
    if (accountId && (Number.isNaN(at) || Number.isNaN(since) || at > since)) {
      authors.add(accountId);
    }
  }
  return authors;
}
