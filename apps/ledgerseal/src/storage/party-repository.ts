/**
 * Copyright (c) 2026 Asymm Systems. All rights reserved.
 *
 * LedgerSeal: the site key and the token-to-account map (ADR-010 decisions 2 and 4).
 * The map holds one key per account, outside every hashed record, so closing an account deletes one key.
 *
 * @author Fahim Farook
 */

import * as crypto from 'crypto';
import { isPartyToken, partyFunction, PartyFn } from '../domain/party';
import { StorageProvider } from './seal-repository';

export const SITE_KEY = 'ls3:partykey';
export const PARTY_PREFIX = 'ls3:party:';

export interface PartyEntry {
  accountId: string;
  updatedAt: string;
}

/** A new random site key (32 bytes), held in memory until a writer stores it. */
export function newSiteKey(): Buffer {
  return crypto.randomBytes(32);
}

export class PartyRepository {
  constructor(private readonly storage: StorageProvider) {}

  private async readKey(): Promise<Buffer | null> {
    const stored = await this.storage.get(SITE_KEY);
    return stored && typeof stored.key === 'string' ? Buffer.from(stored.key, 'base64') : null;
  }

  /** The party function, or null when the site has no key yet (then no record holds a token). Reads only. */
  async partyForRead(): Promise<PartyFn | null> {
    const key = await this.readKey();
    return key ? partyFunction(key) : null;
  }

  /** The party function, creating the site key once. A writer that loses the race uses the winner's key. */
  async partyForWrite(): Promise<PartyFn> {
    const existing = await this.readKey();
    if (existing) return partyFunction(existing);
    const candidate = newSiteKey();
    if (await this.storeKey(candidate)) return partyFunction(candidate);
    const winner = await this.readKey();
    if (!winner) throw new Error('LedgerSeal: the site key could not be read.');
    return partyFunction(winner);
  }

  /** Stores a candidate site key. False when another writer stored a key first. */
  async storeKey(candidate: Buffer): Promise<boolean> {
    return this.storage.createIfAbsent(SITE_KEY, { key: candidate.toString('base64'), createdAt: new Date().toISOString() });
  }

  /** Records that the app now holds data about these accounts (the map and the weekly report use it). */
  async register(accounts: string[], party: PartyFn, at: string): Promise<void> {
    for (const accountId of [...new Set(accounts.filter(Boolean))]) {
      await this.storage.set(PARTY_PREFIX + party(accountId), { accountId, updatedAt: at } as PartyEntry);
    }
  }

  /** The account id of a token, or null when the account was closed or never registered. */
  async accountOf(token: string): Promise<string | null> {
    const entry = await this.storage.get(PARTY_PREFIX + token);
    return entry && typeof entry.accountId === 'string' ? entry.accountId : null;
  }

  /** Every map entry, for the weekly report. */
  async all(): Promise<{ token: string; entry: PartyEntry }[]> {
    const rows = await this.storage.query(PARTY_PREFIX);
    return rows
      .map(row => ({ token: row.key.slice(PARTY_PREFIX.length), entry: row.value as PartyEntry }))
      .filter(row => isPartyToken(row.token) && row.entry && typeof row.entry.accountId === 'string');
  }

  /** Closure: the token then names no one (ADR-010 decision 4). */
  async forget(token: string): Promise<void> {
    await this.storage.delete(PARTY_PREFIX + token);
  }
}

/**
 * Turns stored party ids into account ids for display. A token is looked up in the map; an id that is not a
 * token is an account id from a record written before ADR-010. Null means a closed account.
 */
export class PartyResolver {
  private readonly cache = new Map<string, Promise<string | null>>();

  constructor(private readonly parties: PartyRepository) {}

  resolve(id: string | null | undefined): Promise<string | null> {
    if (!id) return Promise.resolve(null);
    if (!isPartyToken(id)) return Promise.resolve(id);
    let found = this.cache.get(id);
    if (!found) {
      found = this.parties.accountOf(id);
      this.cache.set(id, found);
    }
    return found;
  }
}
