/**
 * Copyright (c) 2026 Asymm Systems. All rights reserved.
 * @author Fahim Farook
 * FourRealities: party tokens (the LedgerSeal pattern of ADR-011): pty_ and 32 hexadecimal characters, an
 * HMAC-SHA-256 of an account id under a per-site key. Signed report files hold tokens, never account ids,
 * so the erasure of a closed account never changes a signed file (spec v4 invariant 10).
 *
 *   fr:partykey        the site key, 32 random bytes in base64, written once
 *   fr:party:{token}   { accountId, updatedAt }, or { closed: true, closedAt } after erasure
 */

import * as crypto from 'crypto';
import { StorageProvider } from '../contract/accessors';
import { PartyEntry } from '../contract/data/reports';
import { PartyTokenAccessor } from '../contract/reports';

const SITE_KEY = 'fr:partykey';

export class DefaultKvsPartyTokenAccessor implements PartyTokenAccessor {
  readonly serviceType = 'accessor' as const;
  private siteKey: Buffer | null = null;

  constructor(private readonly storage: StorageProvider, private readonly random: () => Buffer = () => crypto.randomBytes(32)) {}

  /** The site key; the first call writes it once, and a racing writer's key wins for both. */
  private async key(): Promise<Buffer> {
    if (this.siteKey) return this.siteKey;
    let stored = await this.storage.get<string>(SITE_KEY);
    if (!stored) {
      const fresh = this.random().toString('base64');
      if (this.storage.setIfAbsent) await this.storage.setIfAbsent(SITE_KEY, fresh);
      else await this.storage.set(SITE_KEY, fresh);
      stored = (await this.storage.get<string>(SITE_KEY)) || fresh;
    }
    this.siteKey = Buffer.from(stored, 'base64');
    return this.siteKey;
  }

  async tokensFor(accountIds: string[], now: string): Promise<Record<string, string>> {
    const out: Record<string, string> = {};
    const ids = Array.from(new Set(accountIds.filter(Boolean)));
    if (ids.length === 0) return out;
    const key = await this.key();
    for (const accountId of ids) {
      const token = 'pty_' + crypto.createHmac('sha256', key).update(accountId, 'utf8').digest('hex').slice(0, 32);
      out[accountId] = token;
      const entry = await this.storage.get<PartyEntry>(`fr:party:${token}`);
      // A token is never mapped to another account, and a closed mark is never reopened.
      if (!entry || ('accountId' in entry && entry.accountId === accountId && entry.updatedAt.slice(0, 10) < now.slice(0, 10))) {
        await this.storage.set(`fr:party:${token}`, { accountId, updatedAt: now });
      }
    }
    return out;
  }

  async entries(tokens: string[]): Promise<Record<string, PartyEntry | undefined>> {
    const out: Record<string, PartyEntry | undefined> = {};
    for (const token of Array.from(new Set(tokens))) {
      out[token] = /^pty_[0-9a-f]{32}$/.test(token) ? await this.storage.get<PartyEntry>(`fr:party:${token}`) : undefined;
    }
    return out;
  }
}
