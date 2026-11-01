/**
 * Copyright (c) 2026 Asymm Systems. All rights reserved.
 * @author Fahim Farook
 * FourRealities: paged prefix reads and the v2 record at fr:issue:{issueId}:exception, which
 * the event and note Accessors read for migration only (ADR-001 Patterns 3 and 6).
 */

import { ExceptionRecord } from '../contract/data/models';
import { StorageProvider } from '../contract/accessors';
import { normalizeException } from './issue-facts';

export type KeyValue = { key: string; value: any };

export function v2Key(issueId: string): string {
  return `fr:issue:${issueId}:exception`;
}

/** Every key under the prefix, page by page. */
export async function queryAll(storage: StorageProvider, prefix: string): Promise<KeyValue[]> {
  const all: KeyValue[] = [];
  let cursor: string | undefined;
  do {
    const page: { results: KeyValue[]; nextCursor?: string } = await storage.queryPrefix<any>(prefix, cursor);
    all.push(...page.results);
    cursor = page.nextCursor;
  } while (cursor);
  return all;
}

/** v1 and v2 exception records, normalised to v2. */
export async function v2Records(storage: StorageProvider): Promise<ExceptionRecord[]> {
  return (await queryAll(storage, 'fr:issue:'))
    .filter(r => r.key.endsWith(':exception'))
    .map(r => normalizeException(r.value))
    .filter((r): r is ExceptionRecord => Boolean(r));
}

/** Removes one note from a v2 record; deletes the record when no note is left. */
export async function removeV2Note(storage: StorageProvider, record: ExceptionRecord, note: 'code' | 'rework'): Promise<void> {
  const rest: ExceptionRecord = { ...record };
  delete rest[note];
  if (rest.code || rest.rework) {
    await storage.set(v2Key(record.issueId), rest);
  } else {
    await storage.delete(v2Key(record.issueId));
  }
}

/** A key suffix that keeps two writes in the same millisecond apart. */
export function seq(): string {
  return Math.random().toString(36).slice(2, 10);
}
