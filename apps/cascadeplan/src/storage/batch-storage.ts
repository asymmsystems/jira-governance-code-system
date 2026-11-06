/*
 * Copyright (c) 2026 Asymm Systems. All rights reserved.
 *
 * @author Fahim Farook
 */

/**
 * CascadePlan: a read-through cache over a StorageProvider for one batch call (F-17).
 *
 * Each prefix query and each get reaches KVS once per batch; later reads are answered from memory.
 * Every write goes to KVS first and then updates the cache, so the batch reads its own writes.
 * `swap` always reaches KVS and returns the value KVS replaced, so the version check of each record
 * still sees a write made by anyone else since the batch started (B-09).
 * Values are copied in and out, so a caller cannot change the cache by changing a returned value.
 */

import { StorageProvider } from './plan-repository';

const copy = <T>(v: T): T => (v === undefined ? v : JSON.parse(JSON.stringify(v)));

export class BatchStorage implements StorageProvider {
  /** Every key read or written in this batch; undefined = known to be absent. */
  private readonly values = new Map<string, unknown>();
  /** Prefixes already read in full: every key under them is in `values` or absent from KVS. */
  private readonly fullPrefixes: string[] = [];

  constructor(private readonly inner: StorageProvider) {
    if (!inner.query || !inner.swap) throw new Error('CascadePlan: the storage provider must support query and swap');
  }

  private covered(key: string): boolean {
    return this.fullPrefixes.some(p => key.startsWith(p));
  }

  async get<T>(key: string): Promise<T | undefined> {
    if (this.values.has(key) || this.covered(key)) return copy(this.values.get(key) as T | undefined);
    const v = await this.inner.get<T>(key);
    this.values.set(key, copy(v));
    return v;
  }

  async set(key: string, value: any): Promise<void> {
    await this.inner.set(key, value);
    this.values.set(key, copy(value));
  }

  async delete(key: string): Promise<void> {
    await this.inner.delete(key);
    this.values.set(key, undefined);
  }

  async query<T>(prefix: string): Promise<Array<{ key: string; value: T }>> {
    if (!this.covered(prefix)) {
      const rows = await this.inner.query!<T>(prefix);
      // A key written in this batch keeps its written value; every other row is taken from KVS.
      for (const row of rows) if (!this.values.has(row.key)) this.values.set(row.key, copy(row.value));
      this.fullPrefixes.push(prefix);
    }
    return [...this.values.entries()]
      .filter(([k, v]) => k.startsWith(prefix) && v !== undefined)
      .sort(([a], [b]) => (a < b ? -1 : 1))
      .map(([key, value]) => ({ key, value: copy(value as T) }));
  }

  async swap<T>(key: string, value: T): Promise<T | undefined> {
    const previous = await this.inner.swap!<T>(key, value);
    this.values.set(key, copy(value));
    return previous;
  }
}
