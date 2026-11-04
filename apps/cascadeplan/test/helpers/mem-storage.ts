/*
 * Copyright (c) 2026 Asymm Systems. All rights reserved.
 *
 * @author Fahim Farook
 */

/**
 * CascadePlan test helper: in-memory StorageProvider with prefix query and atomic swap,
 * plus helpers to read per-issue records by issue key.
 */

import { StorageProvider } from '../../src/storage/plan-repository';
import { fromWorkEffortRecord } from '../../src/domain/models';

export class MemStorage implements StorageProvider {
  store = new Map<string, any>();
  sets: string[] = [];
  deletes: string[] = [];

  async get<T>(key: string): Promise<T | undefined> {
    const v = this.store.get(key);
    return v === undefined ? undefined : JSON.parse(JSON.stringify(v));
  }

  async set(key: string, value: any): Promise<void> {
    this.sets.push(key);
    this.store.set(key, JSON.parse(JSON.stringify(value)));
  }

  async delete(key: string): Promise<void> {
    this.deletes.push(key);
    this.store.delete(key);
  }

  async query<T>(prefix: string): Promise<Array<{ key: string; value: T }>> {
    return [...this.store.entries()]
      .filter(([k]) => k.startsWith(prefix))
      .sort(([a], [b]) => (a < b ? -1 : 1))
      .map(([key, value]) => ({ key, value: JSON.parse(JSON.stringify(value)) }));
  }

  async swap<T>(key: string, value: T): Promise<T | undefined> {
    const previous = this.store.get(key);
    this.sets.push(key);
    this.store.set(key, JSON.parse(JSON.stringify(value)));
    return previous === undefined ? undefined : JSON.parse(JSON.stringify(previous));
  }
}

const BOOKKEEPING = ['issueKey', 'issueId', 'version', 'sequenceNum'];

/**
 * App-owned fields of the record for an issue key (bookkeeping fields removed), or undefined.
 */
export async function entryOf(storage: MemStorage, issueKey: string, projectId = 'TEST'): Promise<any> {
  const records = await storage.query<any>(`cp:${projectId}:we:`);
  const rec = records.find(r => r.value.issueKey === issueKey);
  if (!rec) return undefined;
  const out: any = fromWorkEffortRecord(rec.value);
  for (const f of BOOKKEEPING) delete out[f];
  return out;
}

/**
 * Full stored record (with bookkeeping fields) for an issue key, or undefined.
 */
export async function recordOf(storage: MemStorage, issueKey: string, projectId = 'TEST'): Promise<any> {
  const records = await storage.query<any>(`cp:${projectId}:we:`);
  const raw = records.find(r => r.value.issueKey === issueKey)?.value;
  if (!raw) return undefined;
  return { ...fromWorkEffortRecord(raw), issueKey: raw.issueKey, issueId: raw.issueId, version: raw.version, note: raw.note };
}

/**
 * Removes every per-issue record of a project (the old tests cleared the single map this way).
 */
export async function clearRecords(storage: MemStorage, projectId = 'TEST'): Promise<void> {
  for (const r of await storage.query<any>(`cp:${projectId}:we:`)) await storage.delete(r.key);
}
