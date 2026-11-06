/**
 * Copyright (c) 2026 Asymm Systems. All rights reserved.
 *
 * LedgerSeal: separation of duties (readiness review B2, F-01, F-13).
 * Finds who changed the covered content of an issue after a point in time, so the author of a change cannot
 * approve it or revoke the seal. Jira records field changes in the change log, but not comments, work logs and
 * attachments, so those come from the items themselves. A deleted comment or work log names no author in Jira,
 * so it cannot be attributed.
 *
 * @author Fahim Farook
 */

import { ChangelogEntry } from '../jira/jira-client';

function instant(iso: string | undefined | null): number {
  return Date.parse(String(iso ?? ''));
}

/** True when `at` is after `since`; an unreadable time counts as after, so the check fails closed. */
function after(at: string | undefined | null, since: number): boolean {
  const t = instant(at);
  return Number.isNaN(t) || Number.isNaN(since) || t > since;
}

/**
 * Returns the account ids of everyone with a change log entry strictly after `sinceIso`.
 * `counts` decides which change log items count; without it every item counts.
 */
export function authorsSince(changelog: ChangelogEntry[], sinceIso: string, counts: (fieldId: string) => boolean = () => true): Set<string> {
  const since = instant(sinceIso);
  const authors = new Set<string>();
  for (const entry of changelog) {
    const accountId = entry.author?.accountId;
    if (!accountId || !after(entry.created, since)) continue;
    const items = Array.isArray(entry.items) ? entry.items : [];
    // An entry with no readable item counts, so the check fails closed
    if (items.length === 0 || items.some(item => counts(String(item.fieldId ?? item.field ?? '')))) authors.add(accountId);
  }
  return authors;
}

/** Who added or edited a comment or a work log, or added an attachment, strictly after `sinceIso`. */
export function itemAuthorsSince(raw: any, sinceIso: string): Set<string> {
  const since = instant(sinceIso);
  const authors = new Set<string>();
  const add = (id: unknown) => {
    if (typeof id === 'string' && id) authors.add(id);
  };
  const edited = (item: any) => {
    if (after(item?.created, since)) add(item?.author?.accountId);
    // An item edited after the seal, by whoever edited it last
    if (item?.updated && item.updated !== item.created && after(item.updated, since)) add(item?.updateAuthor?.accountId);
  };
  const fields = raw?.fields ?? {};
  for (const comment of Array.isArray(fields.comment?.comments) ? fields.comment.comments : []) edited(comment);
  for (const worklog of Array.isArray(fields.worklog?.worklogs) ? fields.worklog.worklogs : []) edited(worklog);
  for (const attachment of Array.isArray(fields.attachment) ? fields.attachment : []) {
    if (after(attachment?.created, since)) add(attachment?.author?.accountId);
  }
  return authors;
}

/** Everyone who changed covered content after `sinceIso`: change log items that count, comments, work logs, attachments. */
export function changeAuthorsSince(changelog: ChangelogEntry[], raw: any, sinceIso: string, counts: (fieldId: string) => boolean): Set<string> {
  return new Set([...authorsSince(changelog, sinceIso, counts), ...itemAuthorsSince(raw, sinceIso)]);
}
