/**
 * The storage interface every DefinitionGuard store uses.
 *
 * Copyright (c) 2026 Asymm Systems. All rights reserved.
 * @author Fahim Farook
 */

export interface StorageProvider {
  get<T>(key: string): Promise<T | undefined>;
  set(key: string, value: any): Promise<void>;
  delete(key: string): Promise<void>;
  /** Writes only when the key is absent. Returns false when another writer already wrote it. */
  setIfAbsent(key: string, value: any): Promise<boolean>;
  /**
   * One page of values whose keys start with the prefix (eventually consistent in Forge KVS).
   * keys[i] is the key of values[i].
   */
  listByPrefix(prefix: string, cursor?: string, limit?: number): Promise<{ values: any[]; keys?: string[]; nextCursor?: string }>;
}
