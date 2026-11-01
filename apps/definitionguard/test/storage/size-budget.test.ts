/**
 * B-04: bounded record. Small state, events in their own keys, paged history.
 *
 * Copyright (c) 2026 Asymm Systems. All rights reserved.
 * @author Fahim Farook
 */
import { jira, CountingStorage } from '../helpers/forge-mocks';

jest.mock('@forge/api', () => {
  const m = require('../helpers/forge-mocks');
  const asApp = { requestJira: m.makeRequester('app') };
  const asUser = { requestJira: m.makeRequester('user') };
  return { __esModule: true, default: { asApp: () => asApp, asUser: () => asUser }, route: m.routeImpl };
});
jest.mock('@forge/kvs', () => ({ kvs: {}, WhereConditions: { beginsWith: (v: string) => v } }));

import { ChecklistStore, stateKey, eventKey } from '../../src/storage/checklist-store';
import { createEntry, statusEntry } from '../../src/domain/event-log';
import { toDodTemplate } from '../../src/domain/dod-template';
import { getIssueChecklist, getChecklistHistory, validateTransition } from '../../src/index';
import { ChecklistTemplate } from '../../src/domain/models';

const KIB = 1024;
const T = '2026-11-01T00:00:00.000Z';
const ACTOR = '712020:0123456789abcdef01234567';

function template(n: number): ChecklistTemplate {
  return {
    id: `tmpl-${n}`, name: `Synthetic ${n}`, description: 'budget',
    items: Array.from({ length: n }, (_, i) => ({
      id: `item-${String(i).padStart(2, '0')}`,
      title: `${'T'.repeat(190)} ${String(i).padStart(3, '0')}`, // 200-character titles
      isMandatory: i % 5 !== 4,
      category: 'TESTING' as const
    }))
  };
}

function largestValue(storage: CountingStorage, issueId: string): number {
  let max = 0;
  for (const [k, v] of storage.store) {
    if (k === stateKey(issueId) || k.startsWith(`dg:evt:${issueId}:`)) max = Math.max(max, Buffer.byteLength(v, 'utf8'));
  }
  return max;
}

async function toggles(store: ChecklistStore, issueId: string, tmpl: ChecklistTemplate, n: number) {
  const dod = toDodTemplate(tmpl);
  for (let k = 0; k < n; k++) {
    const item = tmpl.items[k % tmpl.items.length];
    const tick = Math.floor(k / tmpl.items.length) % 2 === 0;
    await store.mutate(
      issueId,
      async base => [createEntry(base, dod, ACTOR, T)],
      st => [statusEntry(st, { templateItemId: item.id, statusIdTo: tick ? 'DOD_DONE' : 'DOD_OPEN', transitionName: tick ? 'Complete' : 'Reopen', actorPartyId: ACTOR, at: T })],
      { issueKey: `DEMO-${issueId}`, projectId: '10000' }
    );
  }
}

describe('B-04 size budget', () => {
  it('keeps the largest KVS value at 32 KiB or less after 1,000 toggles at 50 items with 200-character titles', async () => {
    const storage = new CountingStorage();
    await toggles(new ChecklistStore(storage), '60001', template(50), 1000);
    expect(largestValue(storage, '60001')).toBeLessThanOrEqual(32 * KIB);
    expect(storage.read(stateKey('60001')).seq).toBe(1001);
  });

  it('keeps each change event at 2 KiB or less', async () => {
    const storage = new CountingStorage();
    await toggles(new ChecklistStore(storage), '60002', template(50), 10);
    for (let seq = 2; seq <= 11; seq++) {
      expect(Buffer.byteLength(storage.store.get(eventKey('60002', seq))!, 'utf8')).toBeLessThanOrEqual(2 * KIB);
    }
  });

  it('keeps no per-item history in the state value', async () => {
    const storage = new CountingStorage();
    await toggles(new ChecklistStore(storage), '60003', template(6), 30);
    const st = storage.read(stateKey('60003'));
    for (const c of st.criteria) expect(c.history).toBeUndefined();
    expect(st.auditTrail).toBeUndefined();
    expect(st.items).toBeUndefined();
  });

  it('still accepts a toggle after 5,000 prior events', async () => {
    const storage = new CountingStorage();
    const store = new ChecklistStore(storage);
    await toggles(store, '60004', template(6), 5000);
    await toggles(store, '60004', template(6), 1);
    expect(storage.read(stateKey('60004')).seq).toBe(5002);
    expect(largestValue(storage, '60004')).toBeLessThanOrEqual(32 * KIB);
  }, 60000);
});

describe('B-04 paged history and panel reads', () => {
  const ctx = { accountId: ACTOR, extension: { issue: { id: '60005', key: 'DEMO-60005', type: 'Task' }, project: { id: '10000' } } };

  beforeEach(() => jira.reset());

  it('returns history in pages of at most 100, in seq order, with a cursor', async () => {
    const storage = new CountingStorage();
    await toggles(new ChecklistStore(storage), '60005', template(6), 149);
    const p1 = await getChecklistHistory({}, ctx, storage);
    expect(p1.events).toHaveLength(100);
    expect(p1.events.map(e => e.seq)).toEqual(Array.from({ length: 100 }, (_, i) => i + 1));
    expect(p1.nextCursor).toBeDefined();
    const p2 = await getChecklistHistory({ cursor: p1.nextCursor }, ctx, storage);
    expect(p2.events.map(e => e.seq)).toEqual(Array.from({ length: 50 }, (_, i) => i + 101));
    expect(p2.nextCursor).toBeUndefined();
    expect(p2.eventCount).toBe(150);
  });

  it('reads the state and one head probe on a panel load, and writes nothing', async () => {
    const storage = new CountingStorage();
    await toggles(new ChecklistStore(storage), '60005', template(6), 200);
    storage.gets = []; storage.sets = [];
    const res = await getIssueChecklist({}, ctx, storage);
    // 200 toggles plus the CREATED event: seq 201, so the head probe reads event 202.
    expect(storage.gets).toEqual([stateKey('60005'), eventKey('60005', 202)]);
    expect(storage.sets).toEqual([]);
    expect(res.stateVersion).toBe(201);
  });

  it('(V-a, V-b) still blocks a missing record and names the open items', async () => {
    const storage = new CountingStorage();
    const res = await validateTransition({ issue: { id: '60006' } }, { extension: { issue: { type: 'Task' } } }, storage);
    expect(res.result).toBe(false);
    expect(res.errorMessage).toContain('Open mandatory items:');
    expect(storage.sets).toEqual([]);
  });
});
