/*
 * Copyright (c) 2026 Asymm Systems. All rights reserved.
 *
 * @author Fahim Farook
 */

/** F-17: the batch read-through cache reads each key and prefix once, and keeps the version check. */
import { BatchStorage } from '../../src/storage/batch-storage';
import { PlanStore } from '../../src/storage/plan-store';
import { MemStorage } from '../helpers/mem-storage';

describe('BatchStorage (F-17)', () => {
  let inner: MemStorage;
  let counts: { get: number; query: number };

  beforeEach(async () => {
    inner = new MemStorage();
    for (let n = 1; n <= 3; n++) await inner.set(`cp:P:we:${n}`, { issueKey: `K-${n}`, issueId: String(n), version: 1 });
    counts = { get: 0, query: 0 };
    const g = inner.get.bind(inner), q = inner.query.bind(inner);
    inner.get = async (k: string) => { counts.get++; return g(k); };
    inner.query = async (p: string) => { counts.query++; return q(p) as any; };
  });

  it('answers a repeated query and the gets under it from memory', async () => {
    const s = new BatchStorage(inner);
    expect((await s.query('cp:P:we:')).length).toBe(3);
    expect((await s.query('cp:P:we:')).length).toBe(3);
    expect(await s.get<any>('cp:P:we:2')).toMatchObject({ issueKey: 'K-2' });
    expect(await s.get('cp:P:we:9')).toBeUndefined();
    expect(counts).toEqual({ get: 0, query: 1 });
  });

  it('reads its own writes and deletes, and writes them to KVS', async () => {
    const s = new BatchStorage(inner);
    await s.query('cp:P:we:');
    await s.set('cp:P:we:4', { issueKey: 'K-4', version: 1 });
    await s.delete('cp:P:we:1');
    expect((await s.query('cp:P:we:')).map(r => r.key)).toEqual(['cp:P:we:2', 'cp:P:we:3', 'cp:P:we:4']);
    expect([...inner.store.keys()].sort()).toEqual(['cp:P:we:2', 'cp:P:we:3', 'cp:P:we:4']);
  });

  it('a returned value cannot change the cache', async () => {
    const s = new BatchStorage(inner);
    const v: any = await s.get('cp:P:we:1');
    v.version = 99;
    expect((await s.get<any>('cp:P:we:1')).version).toBe(1);
  });

  it('a write by someone else during the batch is still refused by the version check', async () => {
    const s = new BatchStorage(inner);
    const store = new PlanStore(s, 'P', 'P');
    const e = (await store.loadEntries()).get('K-1')!;
    // Another user saves K-1 after the batch read it.
    await inner.set('cp:P:we:1', { ...(await inner.get<any>('cp:P:we:1')), version: 2 });
    const put = await store.putEntry('K-1', '1', { startWeek: 'w2' }, e.version);
    expect(put.ok).toBe(false);
    expect(put.conflict).toBe(true);
    // The other user's value is back in KVS.
    expect((await inner.get<any>('cp:P:we:1')).version).toBe(2);
  });
});
