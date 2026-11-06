/**
 * Copyright (c) 2026 Asymm Systems. All rights reserved.
 *
 * LedgerSeal: pseudonymous parties (ADR-011). Hashed records name a person by a party token, never by an
 * account id. A token is the first 128 bits of HMAC-SHA-256 over the account id, keyed with the site key that
 * only the app can read, so the live issue gives the same token again after the account is closed, and nobody
 * without the site key can link a token to an account.
 *
 * @author Fahim Farook
 */

import * as crypto from 'crypto';

export const PARTY_TOKEN_PREFIX = 'pty_';
const TOKEN_PATTERN = /^pty_[0-9a-f]{32}$/;
/** Finds tokens inside display text. */
export const TOKEN_IN_TEXT = /pty_[0-9a-f]{32}/g;

/** Turns an account id into its party token. */
export type PartyFn = (accountId: string) => string;

export function isPartyToken(value: unknown): value is string {
  return typeof value === 'string' && TOKEN_PATTERN.test(value);
}

/** The party function of one site key (32 random bytes). */
export function partyFunction(siteKey: Buffer): PartyFn {
  const cache = new Map<string, string>();
  return accountId => {
    let token = cache.get(accountId);
    if (!token) {
      token = PARTY_TOKEN_PREFIX + crypto.createHmac('sha256', siteKey).update(accountId, 'utf8').digest('hex').slice(0, 32);
      cache.set(accountId, token);
    }
    return token;
  };
}

/** A person found in Jira data: the token, the account id and the name Jira gave (for display only). */
export interface PartySeen {
  accountId: string;
  displayName: string | null;
}

export interface Pseudonymised<T> {
  value: T;
  /** Every person the data named, by token. */
  seen: Map<string, PartySeen>;
}

function isMention(node: any): boolean {
  return node && node.type === 'mention' && node.attrs && typeof node.attrs.id === 'string' && node.attrs.id.length > 0;
}

/**
 * Replaces every person in Jira data by its token (ADR-011 decision 1). A user object (any object with a
 * non-empty string `accountId`) becomes `{ accountId: token, displayName: token }`, so names, emails and avatars
 * are dropped. A rich text mention keeps its other attributes and gets the token as its id and its text.
 * The input is not changed.
 */
export function pseudonymise<T>(data: T, party: PartyFn): Pseudonymised<T> {
  const seen = new Map<string, PartySeen>();
  const walk = (value: any): any => {
    if (Array.isArray(value)) return value.map(walk);
    if (!value || typeof value !== 'object') return value;
    if (typeof value.accountId === 'string' && value.accountId.length > 0) {
      const token = party(value.accountId);
      if (!seen.has(token)) seen.set(token, { accountId: value.accountId, displayName: typeof value.displayName === 'string' ? value.displayName : null });
      return { accountId: token, displayName: token };
    }
    const copy: Record<string, any> = {};
    for (const key of Object.keys(value)) copy[key] = walk(value[key]);
    if (isMention(value)) {
      const token = party(value.attrs.id);
      if (!seen.has(token)) {
        const text = typeof value.attrs.text === 'string' ? value.attrs.text.replace(/^@/, '') : null;
        seen.set(token, { accountId: value.attrs.id, displayName: text });
      }
      copy.attrs = { ...copy.attrs, id: token, text: token };
    }
    return copy;
  };
  return { value: walk(data), seen };
}
