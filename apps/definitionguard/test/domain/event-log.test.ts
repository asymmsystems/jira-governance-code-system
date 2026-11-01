/**
 * Event log: canonical JSON, chaining and the fold (B-03).
 *
 * Copyright (c) 2026 Asymm Systems. All rights reserved.
 * @author Fahim Farook
 */
import {
  canonicalJson,
  hashEvent,
  genesisHash,
  emptyState,
  makeEvent,
  createdEvent,
  migratedEvent,
  stateFromLegacy,
  itemsFromLegacy,
  legacyRefOf,
  applyEvent
} from '../../src/domain/event-log';
import { ChecklistEngine, DEFAULT_DEFINITION_OF_DONE } from '../../src/domain/checklist-engine';

const T = '2026-11-01T00:00:00.000Z';

describe('canonicalJson', () => {
  it('sorts keys at every level and drops undefined fields', () => {
    expect(canonicalJson({ b: 1, a: { d: [1, { z: 1, y: 2 }], c: undefined } })).toBe('{"a":{"d":[1,{"y":2,"z":1}]},"b":1}');
  });

  it('keeps nulls, writes undefined array entries as null, and handles scalars', () => {
    expect(canonicalJson([null, undefined, 'x', 2, true])).toBe('[null,null,"x",2,true]');
    expect(canonicalJson(null)).toBe('null');
    expect(canonicalJson('s')).toBe('"s"');
  });
});

describe('hashing and chaining', () => {
  it('gives a different genesis hash per issue', () => {
    expect(genesisHash('1')).not.toBe(genesisHash('2'));
    expect(genesisHash('1')).toMatch(/^[0-9a-f]{64}$/);
  });

  it('hashEvent ignores the hash field itself and changes with any other field', () => {
    const base = emptyState('9', 'D-9', 'p');
    const e = makeEvent(base, { type: 'RESET', at: T, actorAccountId: 'a' });
    expect(hashEvent({ ...e, hash: 'anything' })).toBe(e.hash);
    expect(hashEvent({ ...e, actorAccountId: 'b' })).not.toBe(e.hash);
  });

  it('makeEvent chains to the state head and increments seq', () => {
    const base = emptyState('9', 'D-9', 'p');
    const e = makeEvent(base, { type: 'RESET', at: T, actorAccountId: 'a' });
    expect(e).toMatchObject({ seq: 1, issueId: '9', prevHash: genesisHash('9') });
  });
});

describe('createdEvent and template version', () => {
  it('uses the template version when present, else 1', () => {
    const base = emptyState('9', 'D-9', 'p');
    expect(createdEvent(base, DEFAULT_DEFINITION_OF_DONE, 'a', T).templateVersion).toBe(1);
    expect(createdEvent(base, { ...DEFAULT_DEFINITION_OF_DONE, version: 4 } as any, 'a', T).templateVersion).toBe(4);
  });
});

describe('legacy (v1) records', () => {
  it('maps completed items to DONE with the accountId, and open items to OPEN with no actor', () => {
    let legacy = ChecklistEngine.initializeState('9', 'D-9', DEFAULT_DEFINITION_OF_DONE, 'system', T);
    legacy = ChecklistEngine.toggleItem(legacy, { issueId: '9', issueKey: 'D-9', itemId: 'item-unit-tests', isCompleted: true, userId: 'Alice', userAccountId: 'acc-a' }, T);
    const items = itemsFromLegacy(legacy);
    expect(items[0]).toMatchObject({ status: 'DONE', byAccountId: 'acc-a', at: T });
    expect(items[1]).toMatchObject({ status: 'OPEN' });
    expect(items[1].byAccountId).toBeUndefined();
    expect(JSON.stringify(items)).not.toContain('Alice');
  });

  it('legacyRefOf defaults a missing version and trail', () => {
    expect(legacyRefOf({ checklistHash: 'h' } as any)).toEqual({ stateVersion: 1, eventCount: 0, checklistHash: 'h' });
  });

  it('stateFromLegacy and migratedEvent default a missing templateId', () => {
    const legacy: any = { issueId: '9', issueKey: 'D-9', items: [], checklistHash: 'h' };
    expect(stateFromLegacy(legacy, 'p').templateId).toBe('');
    const e = migratedEvent(emptyState('9', '', 'p'), legacy, 'a', T);
    expect(e).toMatchObject({ templateId: '', issueKey: 'D-9' });
  });
});

describe('applyEvent', () => {
  const base = emptyState('9', 'D-9', 'p');
  const created = createdEvent(base, DEFAULT_DEFINITION_OF_DONE, 'a', T);
  const s1 = applyEvent(base, created);

  it('rejects an event for another issue', () => {
    expect(() => applyEvent(base, { ...created, issueId: '8' })).toThrow('another issue');
  });

  it('WAIVE sets WAIVED with the actor', () => {
    const s2 = applyEvent(s1, makeEvent(s1, { type: 'WAIVE', itemId: 'item-unit-tests', at: T, actorAccountId: 'b' }));
    expect(s2.items[0]).toMatchObject({ status: 'WAIVED', byAccountId: 'b', eventSeq: 2 });
    expect(s2.items[1].status).toBe('OPEN');
  });

  it('RESYNC keeps the template id and version when the event omits them', () => {
    const s2 = applyEvent(s1, makeEvent(s1, { type: 'RESYNC', items: [], at: T, actorAccountId: 'b' }));
    expect(s2.templateId).toBe(DEFAULT_DEFINITION_OF_DONE.id);
    expect(s2.templateVersion).toBe(1);
    expect(s2.items).toEqual([]);
  });

  it('RESET opens every item and updates the head', () => {
    const s2 = applyEvent(s1, makeEvent(s1, { type: 'TICK', itemId: 'item-unit-tests', at: T, actorAccountId: 'b' }));
    const e3 = makeEvent(s2, { type: 'RESET', at: T, actorAccountId: 'c' });
    const s3 = applyEvent(s2, e3);
    expect(s3.items.every(i => i.status === 'OPEN')).toBe(true);
    expect(s3).toMatchObject({ seq: 3, headHash: e3.hash, lastModifiedByAccountId: 'c' });
  });
});
