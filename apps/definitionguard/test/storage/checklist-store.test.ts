/**
 * B-03: no lost updates. Ordered append-only events with a FAIL_IF_EXISTS lock.
 *
 * Copyright (c) 2026 Asymm Systems. All rights reserved.
 * @author Fahim Farook
 */
import { CountingStorage } from '../helpers/forge-mocks';
import { ChecklistStore, ConflictError, CONFLICT_MESSAGE, stateKey, eventKey, legacyKey } from '../../src/storage/checklist-store';
import { createdEvent, applyEvent, emptyState, genesisHash, makeEvent } from '../../src/domain/event-log';
import { ChecklistEngine, DEFAULT_DEFINITION_OF_DONE } from '../../src/domain/checklist-engine';
import { ChecklistState } from '../../src/domain/models';

const T = '2026-11-01T00:00:00.000Z';
const ISSUE = '30001';

function seedCreated(storage: CountingStorage): ChecklistState {
  const e1 = createdEvent(emptyState(ISSUE, 'DEMO-31', '10000'), DEFAULT_DEFINITION_OF_DONE, '712020:creator', T);
  const st = applyEvent(emptyState(ISSUE, 'DEMO-31', '10000'), e1);
  storage.put(eventKey(ISSUE, 1), e1);
  storage.put(stateKey(ISSUE), st);
  return st;
}

const tick = (itemId: string, actor: string) => (st: ChecklistState) => [{ type: 'TICK' as const, itemId, actorAccountId: actor, at: T }];
const noInit = async () => { throw new Error('init must not run'); };

describe('B-03 ChecklistStore', () => {
  let storage: CountingStorage;
  let store: ChecklistStore;

  beforeEach(() => {
    storage = new CountingStorage();
    store = new ChecklistStore(storage);
  });

  it('keeps both of two concurrent ticks, with 2 events and the version incremented twice', async () => {
    seedCreated(storage);
    storage.getDelayMs = 5;
    await Promise.all([
      store.mutate(ISSUE, noInit, tick('item-unit-tests', '712020:alice')),
      store.mutate(ISSUE, noInit, tick('item-peer-review', '712020:bob'))
    ]);
    storage.getDelayMs = 0;
    const fin = await store.load(ISSUE);
    expect(fin!.seq).toBe(3);
    expect(fin!.items.filter(i => i.status === 'DONE').map(i => i.id).sort()).toEqual(['item-peer-review', 'item-unit-tests']);
    expect(storage.read(eventKey(ISSUE, 2)).type).toBe('TICK');
    expect(storage.read(eventKey(ISSUE, 3)).type).toBe('TICK');
    expect(storage.read(eventKey(ISSUE, 3)).prevHash).toBe(storage.read(eventKey(ISSUE, 2)).hash);
  });

  it('retries after a collision and succeeds', async () => {
    seedCreated(storage);
    let raced = false;
    const orig = storage.setIfAbsent.bind(storage);
    storage.setIfAbsent = async (key: string, value: any) => {
      if (!raced && key === eventKey(ISSUE, 2)) {
        // Another writer appends event 2 between our read and our write.
        raced = true;
        const st = (await store.load(ISSUE))!;
        await orig(key, makeEvent(st, { type: 'TICK', itemId: 'item-documentation', actorAccountId: '712020:other', at: T }));
      }
      return orig(key, value);
    };
    const res = await store.mutate(ISSUE, noInit, tick('item-unit-tests', '712020:alice'));
    expect(res.seq).toBe(3);
    expect(res.items.find(i => i.id === 'item-unit-tests')!.status).toBe('DONE');
    expect(res.items.find(i => i.id === 'item-documentation')!.status).toBe('DONE');
  });

  it('gives up after 3 collisions with the conflict message and leaves no partial write', async () => {
    const st = seedCreated(storage);
    storage.setIfAbsent = async () => false;
    const before = storage.store.get(stateKey(ISSUE));
    await expect(store.mutate(ISSUE, noInit, tick('item-unit-tests', '712020:alice'))).rejects.toThrow(ConflictError);
    await expect(store.mutate(ISSUE, noInit, tick('item-unit-tests', '712020:alice'))).rejects.toThrow(CONFLICT_MESSAGE);
    expect(storage.store.get(stateKey(ISSUE))).toBe(before);
    expect(storage.store.has(eventKey(ISSUE, st.seq + 1))).toBe(false);
  });

  it('keeps a change when the state write fails after the event write, by folding forward on the next read', async () => {
    seedCreated(storage);
    storage.failSet = key => key === stateKey(ISSUE);
    await expect(store.mutate(ISSUE, noInit, tick('item-unit-tests', '712020:alice'))).rejects.toThrow();
    storage.failSet = null;
    const st = await store.load(ISSUE);
    expect(st!.seq).toBe(2);
    expect(st!.items.find(i => i.id === 'item-unit-tests')!.status).toBe('DONE');
  });

  it('rebuilds the state from the events when the state key is missing', async () => {
    seedCreated(storage);
    await store.mutate(ISSUE, noInit, tick('item-unit-tests', '712020:alice'));
    storage.store.delete(stateKey(ISSUE));
    const st = await store.load(ISSUE);
    expect(st!.seq).toBe(2);
    expect(st!.items.find(i => i.id === 'item-unit-tests')!.byAccountId).toBe('712020:alice');
  });

  it('returns undefined when nothing is stored, and makes no write', async () => {
    expect(await store.load(ISSUE)).toBeUndefined();
    expect(storage.sets).toEqual([]);
  });

  it('creates the record with a CREATED event on the first change', async () => {
    const res = await store.mutate(ISSUE, async st => [createdEvent(st, DEFAULT_DEFINITION_OF_DONE, '712020:alice', T)], tick('item-unit-tests', '712020:alice'), { issueKey: 'DEMO-31', projectId: '10000' });
    expect(res.seq).toBe(2);
    expect(storage.read(eventKey(ISSUE, 1)).type).toBe('CREATED');
    expect(storage.read(eventKey(ISSUE, 1)).prevHash).toBe(genesisHash(ISSUE));
  });

  describe('migration from v1', () => {
    function seedLegacy(): any {
      let legacy = ChecklistEngine.initializeState(ISSUE, 'DEMO-31', DEFAULT_DEFINITION_OF_DONE, 'system', T);
      legacy = ChecklistEngine.toggleItem(legacy, { issueId: ISSUE, issueKey: 'DEMO-31', itemId: 'item-unit-tests', isCompleted: true, userId: 'Alice', userAccountId: '712020:alice' }, T);
      storage.put(legacyKey(ISSUE), legacy);
      return legacy;
    }

    it('derives the state from a v1 record on read, without writing', async () => {
      const legacy = seedLegacy();
      const st = await store.loadOrLegacy(ISSUE);
      expect(st!.seq).toBe(0);
      expect(st!.legacy).toEqual({ stateVersion: legacy.stateVersion, eventCount: 1, checklistHash: legacy.checklistHash });
      expect(st!.items.find(i => i.id === 'item-unit-tests')).toMatchObject({ status: 'DONE', byAccountId: '712020:alice' });
      expect(storage.sets).toEqual([]);
    });

    it('writes MIGRATED then the change on the first write, and keeps the v1 key unchanged', async () => {
      seedLegacy();
      const legacyBefore = storage.store.get(legacyKey(ISSUE));
      const res = await store.mutate(ISSUE, async st => store.initFromLegacyOr(st, async () => { throw new Error('no template'); }, '712020:bob', T), tick('item-peer-review', '712020:bob'), { issueKey: 'DEMO-31', projectId: '10000' });
      expect(storage.read(eventKey(ISSUE, 1)).type).toBe('MIGRATED');
      expect(storage.read(eventKey(ISSUE, 2)).type).toBe('TICK');
      expect(res.items.filter(i => i.status === 'DONE').map(i => i.id).sort()).toEqual(['item-peer-review', 'item-unit-tests']);
      expect(storage.store.get(legacyKey(ISSUE))).toBe(legacyBefore);
    });
  });

  it('rejects an event out of sequence or with a broken prevHash', () => {
    const base = emptyState(ISSUE, 'DEMO-31', '10000');
    const e1 = createdEvent(base, DEFAULT_DEFINITION_OF_DONE, '712020:creator', T);
    expect(() => applyEvent(base, { ...e1, seq: 2 })).toThrow('sequence');
    expect(() => applyEvent(base, { ...e1, prevHash: 'bad' })).toThrow('prevHash');
  });
});
