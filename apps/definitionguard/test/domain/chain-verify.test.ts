/**
 * B-05: a verified hash chain, and no "tamper-evident" claim.
 *
 * Copyright (c) 2026 Asymm Systems. All rights reserved.
 * @author Fahim Farook
 */
import * as fs from 'fs';
import * as path from 'path';
import { jira, CountingStorage } from '../helpers/forge-mocks';

jest.mock('@forge/api', () => {
  const m = require('../helpers/forge-mocks');
  const asApp = { requestJira: m.makeRequester('app') };
  const asUser = { requestJira: m.makeRequester('user') };
  return { __esModule: true, default: { asApp: () => asApp, asUser: () => asUser }, route: m.routeImpl };
});
jest.mock('@forge/kvs', () => ({ kvs: {}, WhereConditions: { beginsWith: (v: string) => v } }));

import { verifyChain, chainMessage, CHAIN_LIMIT_NOTE, createdEvent, emptyState, hashEvent, genesisHash, makeEvent, applyEvent } from '../../src/domain/event-log';
import { ChecklistStore, eventKey, stateKey } from '../../src/storage/checklist-store';
import { getChecklistHistory, validateTransition } from '../../src/index';
import { DEFAULT_DEFINITION_OF_DONE } from '../../src/domain/checklist-engine';
import { ChecklistEvent, ChecklistState } from '../../src/domain/models';

const T = '2026-11-01T00:00:00.000Z';

function chain(issueId: string, n: number): { events: ChecklistEvent[]; state: ChecklistState } {
  let state = emptyState(issueId, `DEMO-${issueId}`, '10000');
  const events: ChecklistEvent[] = [];
  const e1 = createdEvent(state, DEFAULT_DEFINITION_OF_DONE, 'a', T);
  state = applyEvent(state, e1); events.push(e1);
  for (let k = 0; k < n; k++) {
    const e = makeEvent(state, { type: k % 2 ? 'UNTICK' : 'TICK', itemId: 'item-unit-tests', at: T, actorAccountId: 'a' });
    state = applyEvent(state, e); events.push(e);
  }
  return { events, state };
}

describe('B-05 verifyChain', () => {
  it('passes an intact chain', () => {
    const { events, state } = chain('70001', 5);
    expect(verifyChain('70001', events, state)).toEqual({ ok: true, checked: 6 });
  });

  it('binds event 1 to the issue through the genesis hash, and every hash covers issueId, seq and prevHash', () => {
    const { events } = chain('70001', 1);
    expect(events[0].prevHash).toBe(genesisHash('70001'));
    expect(events[1].prevHash).toBe(events[0].hash);
    expect(hashEvent({ ...events[1], issueId: '70002' })).not.toBe(events[1].hash);
    expect(hashEvent({ ...events[1], seq: 9 })).not.toBe(events[1].hash);
    expect(hashEvent({ ...events[1], prevHash: 'x' })).not.toBe(events[1].hash);
  });

  it('reports the first broken event when an old event is edited', () => {
    const { events, state } = chain('70001', 5);
    events[2] = { ...events[2], actorAccountId: 'mallory' };
    expect(verifyChain('70001', events, state)).toMatchObject({ ok: false, brokenAt: 3, reason: 'content changed' });
  });

  it('reports a removed event as a gap', () => {
    const { events, state } = chain('70001', 5);
    events.splice(3, 1);
    expect(verifyChain('70001', events, state)).toMatchObject({ ok: false, brokenAt: 4, reason: 'event missing' });
  });

  it('reports reordered events, even when their seq numbers are swapped', () => {
    const { events, state } = chain('70001', 5);
    const a = events[2], b = events[3];
    events[2] = { ...b, seq: 3 }; events[3] = { ...a, seq: 4 };
    expect(verifyChain('70001', events, state).ok).toBe(false);
    expect(verifyChain('70001', events, state).brokenAt).toBe(3);
  });

  it('reports an event copied from another issue', () => {
    const { events, state } = chain('70001', 3);
    const other = chain('70002', 3).events;
    events[2] = other[2];
    expect(verifyChain('70001', events, state)).toMatchObject({ ok: false, brokenAt: 3, reason: 'event belongs to another issue' });
  });

  it('reports a truncated tail against the stored state', () => {
    const { events, state } = chain('70001', 5);
    expect(verifyChain('70001', events.slice(0, 4), state)).toMatchObject({ ok: false, brokenAt: 5, reason: 'event missing' });
  });

  it('reports a recomputed but unchained replacement of the last event', () => {
    const { events, state } = chain('70001', 2);
    const forged = { ...events[2], actorAccountId: 'mallory' };
    forged.hash = hashEvent(forged);
    events[2] = forged;
    expect(verifyChain('70001', events, state)).toMatchObject({ ok: false, brokenAt: 3, reason: 'does not match the stored head' });
  });

  it('words the result and states the limit of the check', () => {
    expect(chainMessage({ ok: true, checked: 37 })).toBe('History checked: 37 events, chain intact.');
    expect(chainMessage({ ok: false, checked: 11, brokenAt: 12, reason: 'content changed' }))
      .toBe('History check failed at event 12 (content changed). Ask your Jira admin to review this issue.');
    expect(CHAIN_LIMIT_NOTE).toContain('does not stop');
    expect(CHAIN_LIMIT_NOTE).toContain('vendor');
  });
});

describe('B-05 store and resolvers', () => {
  const ctx = { accountId: 'a', extension: { issue: { id: '70003', key: 'DEMO-70003', type: 'Task' }, project: { id: '10000' } } };

  function seed(storage: CountingStorage, n: number) {
    const { events, state } = chain('70003', n);
    for (const e of events) storage.put(eventKey('70003', e.seq), e);
    storage.put(stateKey('70003'), state);
    return { events, state };
  }

  beforeEach(() => jira.reset());

  it('verifies across pages and fills a tail the eventually consistent query missed', async () => {
    const storage = new CountingStorage();
    const { events } = seed(storage, 230);
    const orig = storage.listByPrefix.bind(storage);
    storage.listByPrefix = async (p, c, l) => {
      const page = await orig(p, c, l);
      return { ...page, values: page.values.filter((v: any) => v.seq <= events.length - 2) };
    };
    const res = await new ChecklistStore(storage).verify('70003');
    expect(res).toEqual({ ok: true, checked: 231 });
  });

  it('getHistory returns the chain result and the limit note', async () => {
    const storage = new CountingStorage();
    seed(storage, 3);
    const h: any = await getChecklistHistory({}, ctx, storage);
    expect(h.chain).toEqual({ ok: true, checked: 4, message: 'History checked: 4 events, chain intact.', limit: CHAIN_LIMIT_NOTE });
  });

  it('getHistory reports a broken chain', async () => {
    const storage = new CountingStorage();
    const { events } = seed(storage, 3);
    storage.put(eventKey('70003', 2), { ...events[1], actorAccountId: 'mallory' });
    const h: any = await getChecklistHistory({}, ctx, storage);
    expect(h.chain.ok).toBe(false);
    expect(h.chain.message).toContain('History check failed at event 2');
  });

  it('the validator decides from the state and does not depend on the chain', async () => {
    const storage = new CountingStorage();
    const { events } = seed(storage, 3);
    const before = await validateTransition({ issue: { id: '70003' } }, {}, storage);
    storage.put(eventKey('70003', 1), { ...events[0], actorAccountId: 'mallory' });
    const after = await validateTransition({ issue: { id: '70003' } }, {}, storage);
    expect(after).toEqual(before);
    expect(after.result).toBe(false);
    expect(after.errorMessage).toContain('Pending items:');
  });
});

describe('B-05 no tamper-evident claim', () => {
  it('no source file says tamper-evident', () => {
    const root = path.join(__dirname, '../../src');
    const files: string[] = [];
    const walk = (d: string) => fs.readdirSync(d, { withFileTypes: true }).forEach(f => f.isDirectory() ? walk(path.join(d, f.name)) : files.push(path.join(d, f.name)));
    walk(root);
    for (const f of files) expect(fs.readFileSync(f, 'utf8').toLowerCase()).not.toContain('tamper-evident');
  });
});
