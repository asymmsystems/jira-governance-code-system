/**
 * Pseudonyms for the people DefinitionGuard records (ADR-010).
 *
 * Copyright (c) 2026 Asymm Systems. All rights reserved.
 * @author Fahim Farook
 *
 * Every stored record names a person by a random per-site pseudonym, never by the Atlassian
 * account id. Only two keys per person link the two, and nothing else holds the link:
 *   dg:pty:<accountId>   { accountId, pseudonym, firstSeen, updatedAt }  (also the report list)
 *   dg:pid:<pseudonym>   { accountId }                                   (to show the person)
 * Erasing a closed account deletes both keys. The hashed history keeps the pseudonym and still
 * verifies, and nothing links the pseudonym back to the person any more.
 */
import * as crypto from 'crypto';
import { StorageProvider } from './checklist-repository';

export const PSEUDONYM_PREFIX = 'dgp-';
export const accountKey = (accountId: string) => `dg:pty:${accountId}`;
export const pseudonymKey = (pseudonym: string) => `dg:pid:${pseudonym}`;
export const ACCOUNT_PREFIX = 'dg:pty:';

/** Party ids that name no person: the app itself, an unknown caller, or nothing. */
const NOT_A_PERSON = new Set(['', 'system', 'unknown']);

/** updatedAt is refreshed at most this often per person, to save writes. */
export const REFRESH_MS = 24 * 60 * 60 * 1000;

export interface PartyRecord {
  accountId: string;
  pseudonym: string;
  firstSeen: string;
  updatedAt: string;
}

export const isPseudonym = (partyId: string | undefined): boolean => Boolean(partyId && partyId.startsWith(PSEUDONYM_PREFIX));

/** True for a stored party id that is an Atlassian account id (written before ADR-010). */
export const isRawAccountId = (partyId: string | undefined): partyId is string =>
  typeof partyId === 'string' && !NOT_A_PERSON.has(partyId) && !isPseudonym(partyId);

/** What the panel shows for a stored party id. */
export type ShownParty = { accountId: string } | { text: string };

export const DELETED_USER = 'A deleted user';
export const UNKNOWN_USER = 'An unknown user';
export const APP_ACTOR = 'DefinitionGuard';

export class PartyStore {
  constructor(private readonly storage: StorageProvider, private readonly now: () => Date = () => new Date()) {}

  /**
   * The pseudonym to store for the person who acts now. Creates it on the person's first action.
   * Party ids that name no person are returned unchanged.
   */
  public async pseudonymFor(accountId: string): Promise<string> {
    if (!isRawAccountId(accountId)) return accountId;
    const at = this.now().toISOString();
    const existing = await this.storage.get<PartyRecord>(accountKey(accountId));
    if (existing?.pseudonym) {
      if (this.now().getTime() - Date.parse(existing.updatedAt || '') >= REFRESH_MS || Number.isNaN(Date.parse(existing.updatedAt || ''))) {
        await this.storage.set(accountKey(accountId), { ...existing, updatedAt: at });
        await this.storage.set(pseudonymKey(existing.pseudonym), { accountId });
      }
      return existing.pseudonym;
    }
    const record: PartyRecord = { accountId, pseudonym: PSEUDONYM_PREFIX + crypto.randomBytes(16).toString('hex'), firstSeen: at, updatedAt: at };
    if (await this.storage.setIfAbsent(accountKey(accountId), record)) {
      await this.storage.set(pseudonymKey(record.pseudonym), { accountId });
      return record.pseudonym;
    }
    // Another call made it first: use theirs, and make sure the way back exists.
    const winner = await this.storage.get<PartyRecord>(accountKey(accountId));
    if (!winner?.pseudonym) throw new Error('DefinitionGuard could not record who made the change. Try again.');
    await this.storage.set(pseudonymKey(winner.pseudonym), { accountId });
    return winner.pseudonym;
  }

  /** The stored pseudonym of an account, without creating one. Never writes. */
  public async lookupPseudonym(accountId: string): Promise<string | undefined> {
    if (!isRawAccountId(accountId)) return undefined;
    return (await this.storage.get<PartyRecord>(accountKey(accountId)))?.pseudonym;
  }

  /**
   * Every id that may stand for these accounts in stored records: the account id itself (records
   * not yet rewritten) and its pseudonym, if it has one. Never writes.
   */
  public async idsOf(accountIds: Iterable<string>): Promise<Set<string>> {
    const ids = new Set<string>();
    for (const accountId of accountIds) {
      if (!isRawAccountId(accountId)) continue;
      ids.add(accountId);
      const p = await this.lookupPseudonym(accountId);
      if (p) ids.add(p);
    }
    return ids;
  }

  /** How to show each stored party id. One read per distinct pseudonym. Never writes. */
  public async show(partyIds: Iterable<string | undefined>): Promise<Map<string, ShownParty>> {
    const out = new Map<string, ShownParty>();
    for (const id of new Set([...partyIds].filter((p): p is string => typeof p === 'string' && p.length > 0))) {
      if (id === 'system') out.set(id, { text: APP_ACTOR });
      else if (id === 'unknown') out.set(id, { text: UNKNOWN_USER });
      else if (!isPseudonym(id)) out.set(id, { accountId: id });
      else {
        const link = await this.storage.get<{ accountId: string }>(pseudonymKey(id));
        out.set(id, link?.accountId ? { accountId: link.accountId } : { text: DELETED_USER });
      }
    }
    return out;
  }

  /** The account id behind each pseudonym that still has one (for the export). Never writes. */
  public async accountsOf(partyIds: Iterable<string>): Promise<Record<string, string>> {
    const out: Record<string, string> = {};
    for (const [id, shown] of await this.show(partyIds)) {
      if (isPseudonym(id) && 'accountId' in shown) out[id] = shown.accountId;
    }
    return out;
  }

  /** Every recorded person, for the personal data report. */
  public async all(): Promise<PartyRecord[]> {
    const out: PartyRecord[] = [];
    let cursor: string | undefined;
    do {
      const page = await this.storage.listByPrefix(ACCOUNT_PREFIX, cursor, 100);
      out.push(...(page.values as PartyRecord[]).filter(r => r && typeof r.accountId === 'string' && r.accountId));
      cursor = page.nextCursor;
    } while (cursor);
    return out;
  }

  /** Erases a closed account: deletes both keys of the link. Returns false when none was stored. */
  public async erase(accountId: string): Promise<boolean> {
    const record = await this.storage.get<PartyRecord>(accountKey(accountId));
    if (!record) return false;
    if (record.pseudonym) await this.storage.delete(pseudonymKey(record.pseudonym));
    await this.storage.delete(accountKey(accountId));
    return true;
  }
}
