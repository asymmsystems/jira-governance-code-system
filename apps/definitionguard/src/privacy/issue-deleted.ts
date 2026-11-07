/**
 * Deletes DefinitionGuard's records of a Jira issue when the issue is deleted (M-4).
 *
 * Copyright (c) 2026 Asymm Systems. All rights reserved.
 * @author Fahim Farook
 *
 * Trigger avi:jira:deleted:issue. Removes the state cache, every history event and any v1 record
 * of the issue, so evidence notes, waiver reasons and pseudonyms of a deleted issue do not stay
 * until uninstall. The issue property is deleted by Jira with the issue. Logs hold counts only.
 */
import { StorageProvider } from '../storage/checklist-repository';
import { resolveStorage } from '../storage/forge-storage';
import { eventPrefix, legacyKey, stateKey } from '../storage/checklist-store';
import { logFailure } from '../log';

/** At most this many history pages are deleted per call (100 events each). */
export const MAX_DELETE_PAGES = 200;

/** Deletes every record of the issue. Returns the number of keys deleted. */
export async function deleteIssueRecords(storage: StorageProvider, issueId: string): Promise<number> {
  if (!/^\d+$/.test(issueId)) return 0;
  let deleted = 0;
  for (let page = 0; page < MAX_DELETE_PAGES; page++) {
    // Deleted keys leave the result, so the first page is read again until it is empty.
    const res = await storage.listByPrefix(eventPrefix(issueId), undefined, 100);
    const keys = res.keys || [];
    if (keys.length === 0) break;
    for (const key of keys) {
      await storage.delete(key);
      deleted++;
    }
  }
  for (const key of [stateKey(issueId), legacyKey(issueId)]) {
    if ((await storage.get(key)) !== undefined) {
      await storage.delete(key);
      deleted++;
    }
  }
  return deleted;
}

/** Trigger handler (manifest: issue-deleted on avi:jira:deleted:issue). Never throws. */
export async function issueDeletedTrigger(event: any, _context?: any, storageProvider?: StorageProvider): Promise<void> {
  const issueId = String(event?.issue?.id || '');
  try {
    const n = await deleteIssueRecords(resolveStorage(storageProvider), issueId);
    console.log(`DefinitionGuard issue deleted: ${n} record(s) removed.`);
  } catch (err) {
    logFailure('could not remove the records of a deleted issue', err);
  }
}
