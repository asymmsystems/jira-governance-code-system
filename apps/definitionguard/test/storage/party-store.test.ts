/**
 * ADR-010: pseudonyms for the people DefinitionGuard records.
 *
 * Copyright (c) 2026 Asymm Systems. All rights reserved.
 * @author Fahim Farook
 */
import { CountingStorage } from '../helpers/forge-mocks';
import {
  PartyStore, accountKey, pseudonymKey, isPseudonym, isRawAccountId, DELETED_USER, UNKNOWN_USER, APP_ACTOR, REFRESH_MS
} from '../../src/storage/party-store';

describe('ADR-010 party store', () => {
  let storage: CountingStorage;
  let now: Date;
  let parties: PartyStore;

  beforeEach(() => {
    storage = new CountingStorage();
    now = new Date('2026-11-06T10:00:00.000Z');
    parties = new PartyStore(storage, () => now);
  });

  it('makes a random dgp- pseudonym on the first action and stores both directions of the link', async () => {
    const p = await parties.pseudonymFor('712020:alice');
    expect(p).toMatch(/^dgp-[0-9a-f]{32}$/);
    expect(storage.read(accountKey('712020:alice'))).toEqual({ accountId: '712020:alice', pseudonym: p, firstSeen: now.toISOString(), updatedAt: now.toISOString() });
    expect(storage.read(pseudonymKey(p))).toEqual({ accountId: '712020:alice' });
    expect(await parties.pseudonymFor('712020:bob')).not.toBe(p);
  });

  it('reuses the pseudonym, and refreshes updatedAt at most once a day', async () => {
    const p = await parties.pseudonymFor('712020:alice');
    storage.sets = [];
    now = new Date(now.getTime() + REFRESH_MS - 1);
    expect(await parties.pseudonymFor('712020:alice')).toBe(p);
    expect(storage.sets).toEqual([]);
    now = new Date(now.getTime() + 1);
    expect(await parties.pseudonymFor('712020:alice')).toBe(p);
    expect(storage.read(accountKey('712020:alice')).updatedAt).toBe(now.toISOString());
    expect(storage.sets).toEqual([accountKey('712020:alice'), pseudonymKey(p)]);
  });

  it('refreshes a record whose updatedAt cannot be read', async () => {
    storage.put(accountKey('712020:alice'), { accountId: '712020:alice', pseudonym: 'dgp-1', firstSeen: 'x', updatedAt: 'garbage' });
    expect(await parties.pseudonymFor('712020:alice')).toBe('dgp-1');
    expect(storage.read(accountKey('712020:alice')).updatedAt).toBe(now.toISOString());
  });

  it('returns party ids that name no person unchanged and stores nothing for them', async () => {
    for (const id of ['', 'system', 'unknown', 'dgp-abc']) expect(await parties.pseudonymFor(id)).toBe(id);
    expect(storage.sets).toEqual([]);
    expect(isPseudonym('dgp-1')).toBe(true);
    expect(isPseudonym(undefined)).toBe(false);
    expect(isRawAccountId('712020:a')).toBe(true);
    expect(isRawAccountId('system')).toBe(false);
    expect(isRawAccountId(undefined)).toBe(false);
  });

  it('uses the pseudonym of a call that made it first, and restores the way back', async () => {
    const racing = new CountingStorage();
    racing.setIfAbsent = async (key: string) => {
      racing.put(key, { accountId: '712020:alice', pseudonym: 'dgp-winner', firstSeen: 'a', updatedAt: now.toISOString() });
      return false;
    };
    const p = await new PartyStore(racing, () => now).pseudonymFor('712020:alice');
    expect(p).toBe('dgp-winner');
    expect(racing.read(pseudonymKey('dgp-winner'))).toEqual({ accountId: '712020:alice' });
  });

  it('throws a next step when the race left no record', async () => {
    storage.setIfAbsent = async () => false;
    await expect(parties.pseudonymFor('712020:alice')).rejects.toThrow('could not record who made the change. Try again.');
  });

  it('looks up without creating, and gives every id that stands for a set of accounts', async () => {
    expect(await parties.lookupPseudonym('712020:alice')).toBeUndefined();
    expect(await parties.lookupPseudonym('system')).toBeUndefined();
    const p = await parties.pseudonymFor('712020:alice');
    storage.sets = [];
    expect(await parties.lookupPseudonym('712020:alice')).toBe(p);
    expect(await parties.idsOf(['712020:alice', '712020:bob', 'system'])).toEqual(new Set(['712020:alice', p, '712020:bob']));
    expect(storage.sets).toEqual([]);
  });

  it('shows a pseudonym as its account, an erased one as "A deleted user", and the app and unknown as text', async () => {
    const p = await parties.pseudonymFor('712020:alice');
    const shown = await parties.show([p, 'dgp-gone', 'system', 'unknown', '712020:legacy', '', undefined]);
    expect(shown.get(p)).toEqual({ accountId: '712020:alice' });
    expect(shown.get('dgp-gone')).toEqual({ text: DELETED_USER });
    expect(shown.get('system')).toEqual({ text: APP_ACTOR });
    expect(shown.get('unknown')).toEqual({ text: UNKNOWN_USER });
    expect(shown.get('712020:legacy')).toEqual({ accountId: '712020:legacy' });
    expect(shown.has('')).toBe(false);
    expect(await parties.accountsOf([p, 'dgp-gone', 'system', '712020:legacy'])).toEqual({ [p]: '712020:alice' });
  });

  it('lists every recorded person across pages, and erases a closed account by deleting both keys', async () => {
    const ids = Array.from({ length: 150 }, (_, i) => `712020:u${i}`);
    for (const id of ids) await parties.pseudonymFor(id);
    storage.put('dg:pty:broken', null);
    const all = await parties.all();
    expect(all.map(r => r.accountId).sort()).toEqual([...ids].sort());
    const p = await parties.lookupPseudonym('712020:u7');
    expect(await parties.erase('712020:u7')).toBe(true);
    expect(storage.read(accountKey('712020:u7'))).toBeUndefined();
    expect(storage.read(pseudonymKey(p!))).toBeUndefined();
    expect(await parties.erase('712020:u7')).toBe(false);
    storage.put(accountKey('712020:odd'), { accountId: '712020:odd' });
    expect(await parties.erase('712020:odd')).toBe(true);
  });
});
