/**
 * Copyright (c) 2026 Asymm Systems. All rights reserved.
 * @author Fahim Farook
 * FourRealities: in-memory StorageProvider for tests, with operation counts and value sizes
 */

import { StorageProvider } from '../../src/contract/accessors';

export class MemoryStorage implements StorageProvider {
  store = new Map<string, any>();
  ops: Array<{ op: 'get' | 'set' | 'delete' | 'query'; key: string }> = [];
  maxBytes = 0;

  async get<T>(key: string): Promise<T | undefined> {
    this.ops.push({ op: 'get', key });
    const v = this.store.get(key);
    return v === undefined ? undefined : JSON.parse(JSON.stringify(v));
  }

  async set(key: string, value: any): Promise<void> {
    this.ops.push({ op: 'set', key });
    this.maxBytes = Math.max(this.maxBytes, Buffer.byteLength(JSON.stringify(value)));
    this.store.set(key, JSON.parse(JSON.stringify(value)));
  }

  async delete(key: string): Promise<void> {
    this.ops.push({ op: 'delete', key });
    this.store.delete(key);
  }

  async queryPrefix<T>(prefix: string, cursor?: string): Promise<{ results: Array<{ key: string; value: T }>; nextCursor?: string }> {
    this.ops.push({ op: 'query', key: prefix });
    const keys = Array.from(this.store.keys()).filter(k => k.startsWith(prefix)).sort();
    const start = cursor ? Number(cursor) : 0;
    const page = keys.slice(start, start + 100);
    return {
      results: page.map(key => ({ key, value: JSON.parse(JSON.stringify(this.store.get(key))) })),
      nextCursor: start + 100 < keys.length ? String(start + 100) : undefined
    };
  }

  count(op: 'get' | 'set' | 'delete' | 'query', pattern: RegExp = /.*/): number {
    return this.ops.filter(o => o.op === op && pattern.test(o.key)).length;
  }
}
