/**
 * Copyright (c) 2026 Asymm Systems. All rights reserved.
 * @author Fahim Farook
 * FourRealities: append-only exception event storage and v2 migration (ADR-001 Pattern 3)
 */

import { DefaultKvsExceptionEventAccessor } from '../src/accessor/default-kvs-exception-event-accessor';
import { GateExceptionEvent } from '../src/contract/data/models';
import { MemoryStorage } from './storage/memory-storage';

const ev = (issueId: string, status: GateExceptionEvent['status'], at: string, by = 'u'): GateExceptionEvent => ({
  schemaVersion: 3, issueId, issueKey: `DEMO-${issueId}`, gate: 'code', status, at, byAccountId: by,
  asRole: status === 'REQUESTED' ? 'REQUESTER' : 'APPROVER', reason: 'A reason of enough length'
});
const v2 = (issueId: string, extra: any = {}) => ({ schemaVersion: 2, issueId, issueKey: `DEMO-${issueId}`, ...extra });
const note = { reason: 'Configuration change only', recordedBy: 'dev-1', recordedAt: '2026-10-01T00:00:00.000Z' };

describe('DefaultKvsExceptionEventAccessor', () => {
  it('writes each event under its own key and never rewrites one', async () => {
    const storage = new MemoryStorage();
    const events = new DefaultKvsExceptionEventAccessor(storage);
    expect(events.serviceType).toBe('accessor');
    await events.append(ev('1', 'REQUESTED', '2026-11-01T10:00:00.000Z'));
    await events.append(ev('1', 'APPROVED', '2026-11-01T10:05:00.000Z'));
    const keys = Array.from(storage.store.keys()).filter(k => k.startsWith('fr:ex:'));
    expect(keys).toHaveLength(2);
    expect(keys.every(k => /^fr:ex:1:code:2026-11-01T10:0[05]:00\.000Z:[a-z0-9]+$/.test(k))).toBe(true);
    expect(storage.count('set', /^fr:ex:/)).toBe(2);
  });

  it('lists one issue oldest first, and does not mix issue 1 with issue 10', async () => {
    const storage = new MemoryStorage();
    const events = new DefaultKvsExceptionEventAccessor(storage);
    await events.append(ev('1', 'APPROVED', '2026-11-01T10:05:00.000Z'));
    await events.append(ev('1', 'REQUESTED', '2026-11-01T10:00:00.000Z'));
    await events.append(ev('10', 'REQUESTED', '2026-11-01T09:00:00.000Z'));
    expect((await events.list('1')).map(e => e.status)).toEqual(['REQUESTED', 'APPROVED']);
    const all = await events.listAll();
    expect(Array.from(all.keys()).sort()).toEqual(['1', '10']);
    expect(all.get('10')).toHaveLength(1);
  });

  it('reads a v2 code note with no events as two migrated events, by the note author', async () => {
    const storage = new MemoryStorage();
    await storage.set('fr:issue:5:exception', v2('5', { code: note }));
    await storage.set('fr:issue:6:exception', v2('6', { rework: note }));
    const events = new DefaultKvsExceptionEventAccessor(storage);
    const list = await events.list('5');
    expect(list.map(e => [e.status, e.byAccountId, e.migrated, e.reason])).toEqual([
      ['REQUESTED', 'dev-1', true, 'Configuration change only'],
      ['APPROVED', 'dev-1', true, 'Approved before administrator approval was required.']
    ]);
    expect(await events.list('6')).toEqual([]);
    expect((await events.listAll()).get('5')).toHaveLength(2);
  });

  it('migrates at most the limit, keeps the rework note, and is idempotent', async () => {
    const storage = new MemoryStorage();
    await storage.set('fr:issue:5:exception', v2('5', { code: note, rework: note }));
    await storage.set('fr:issue:7:exception', v2('7', { code: note }));
    const events = new DefaultKvsExceptionEventAccessor(storage);
    expect(await events.migrateV2CodeNotes(1)).toBe(1);
    expect(await events.migrateV2CodeNotes(10)).toBe(1);
    expect(await events.migrateV2CodeNotes(10)).toBe(0);
    expect(await storage.get('fr:issue:5:exception')).toEqual(v2('5', { rework: note }));
    expect(storage.store.has('fr:issue:7:exception')).toBe(false);
    expect((await events.list('5')).every(e => e.migrated)).toBe(true);
    expect(Array.from(storage.store.keys()).filter(k => k.startsWith('fr:ex:5:'))).toHaveLength(2);
  });
});
