/**
 * Copyright (c) 2026 Asymm Systems. All rights reserved.
 * @author Fahim Farook
 * FourRealities: StorageProvider over Forge KVS.
 */

import { kvs, WhereConditions } from '@forge/kvs';
import { StorageProvider } from '../contract/accessors';

export class DefaultForgeKvsStore implements StorageProvider {
  async get<T>(key: string): Promise<T | undefined> {
    const val = await kvs.get(key);
    return val as T;
  }

  async set(key: string, value: any): Promise<void> {
    await kvs.set(key, value);
  }

  async delete(key: string): Promise<void> {
    await kvs.delete(key);
  }

  async queryPrefix<T>(prefix: string, cursor?: string): Promise<{ results: Array<{ key: string; value: T }>; nextCursor?: string }> {
    let query = kvs.query().where('key', WhereConditions.beginsWith(prefix)).limit(100);
    if (cursor) {
      query = query.cursor(cursor);
    }
    const page = await query.getMany<T>();
    return { results: page.results.map(r => ({ key: r.key, value: r.value })), nextCursor: page.nextCursor };
  }
}
