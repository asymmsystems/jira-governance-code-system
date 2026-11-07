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

  async set(key: string, value: unknown): Promise<void> {
    await kvs.set(key, value);
  }

  async delete(key: string): Promise<void> {
    await kvs.delete(key);
  }

  async transact(sets: Array<{ key: string; value: unknown }>): Promise<void> {
    let tx = kvs.transact();
    for (const { key, value } of sets) tx = tx.set(key, value);
    await tx.execute();
  }

  async setIfAbsent(key: string, value: unknown): Promise<boolean> {
    try {
      await kvs.set(key, value, { keyPolicy: 'FAIL_IF_EXISTS' });
      return true;
    } catch (failure) {
      // FAIL_IF_EXISTS refused the write: the key is there. Any other failure is passed on.
      if ((await kvs.get(key)) !== undefined) return false;
      throw failure;
    }
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
