/**
 * Copyright (c) 2026 Asymm Systems. All rights reserved.
 *
 * LedgerSeal: canonical JSON and SHA-256 (spec v2 section 4.1).
 * Keys are sorted by UTF-16 code unit at every level, with no whitespace, so equal values give equal bytes.
 *
 * @author Fahim Farook
 */

import * as crypto from 'crypto';

export function canonicalJson(value: unknown): string {
  if (value === null || value === undefined) return 'null';
  if (typeof value === 'number') return Number.isFinite(value) ? JSON.stringify(value) : 'null';
  if (typeof value === 'string' || typeof value === 'boolean') return JSON.stringify(value);
  if (Array.isArray(value)) return '[' + value.map(item => canonicalJson(item)).join(',') + ']';
  if (typeof value === 'object') {
    const obj = value as Record<string, unknown>;
    const keys = Object.keys(obj)
      .filter(key => obj[key] !== undefined)
      .sort((a, b) => (a < b ? -1 : 1));
    return '{' + keys.map(key => JSON.stringify(key) + ':' + canonicalJson(obj[key])).join(',') + '}';
  }
  return 'null';
}

export function sha256Hex(text: string): string {
  return crypto.createHash('sha256').update(text, 'utf8').digest('hex');
}

/** SHA-256 of the canonical JSON of `value` without the named field. */
export function hashWithout<T extends object>(value: T, field: keyof T): string {
  const copy: Record<string, unknown> = { ...(value as Record<string, unknown>) };
  delete copy[field as string];
  return sha256Hex(canonicalJson(copy));
}
