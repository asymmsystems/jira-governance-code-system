/**
 * Forge KVS storage provider and storage resolution for every resolver module.
 *
 * Copyright (c) 2026 Asymm Systems. All rights reserved.
 * @author Fahim Farook
 */
import { kvs, WhereConditions } from '@forge/kvs';
import { StorageProvider } from './checklist-repository';

class ForgeKvsProvider implements StorageProvider {
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

  async setIfAbsent(key: string, value: any): Promise<boolean> {
    try {
      await kvs.set(key, value, { keyPolicy: 'FAIL_IF_EXISTS' });
      return true;
    } catch (err) {
      // A failed FAIL_IF_EXISTS write is a lost race only if the key now exists (strict read).
      if ((await kvs.get(key)) !== undefined) return false;
      throw err;
    }
  }

  async listByPrefix(prefix: string, cursor?: string, limit = 100): Promise<{ values: any[]; nextCursor?: string }> {
    let query = kvs.query().where('key', WhereConditions.beginsWith(prefix)).limit(limit);
    if (cursor) query = query.cursor(cursor);
    const page = await query.getMany<any>();
    return { values: page.results.map(r => r.value), nextCursor: page.nextCursor };
  }
}

let globalStorageProvider: StorageProvider | null = null;

export function setGlobalStorageProvider(provider: StorageProvider | null): void {
  globalStorageProvider = provider;
}

export function resolveStorage(customProvider?: StorageProvider): StorageProvider {
  if (customProvider) {
    return customProvider;
  }
  if (globalStorageProvider) {
    return globalStorageProvider;
  }
  if (process.env.NODE_ENV === 'test') {
    throw new Error('DefinitionGuard: StorageProvider must be initialized.');
  }
  return new ForgeKvsProvider();
}
