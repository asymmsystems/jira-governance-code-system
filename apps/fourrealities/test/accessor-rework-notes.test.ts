/**
 * Copyright (c) 2026 Asymm Systems. All rights reserved.
 * @author Fahim Farook
 * FourRealities: append-only rework notes and v2 migration (ADR-001 Pattern 6; B-32)
 */

import { DefaultKvsReworkNoteAccessor } from '../src/accessor/default-kvs-rework-note-accessor';
import { ReworkNote } from '../src/contract/data/models';
import { MemoryStorage } from './storage/memory-storage';

const rn = (issueId: string, recordedAt: string, reason = 'Requirement changed after review'): ReworkNote => ({
  schemaVersion: 1, issueId, issueKey: `DEMO-${issueId}`, reason, recordedBy: 'dev-1', recordedAt
});
const v2 = (issueId: string, extra: any = {}) => ({ schemaVersion: 2, issueId, issueKey: `DEMO-${issueId}`, ...extra });
const note = { reason: 'Scope grew after review', recordedBy: 'dev-2', recordedAt: '2026-10-01T00:00:00.000Z' };
const code = { reason: 'Configuration change only', recordedBy: 'dev-1', recordedAt: '2026-09-01T00:00:00.000Z' };

describe('DefaultKvsReworkNoteAccessor', () => {
  it('writes each note under its own key, so a second note never replaces the first', async () => {
    const storage = new MemoryStorage();
    const notes = new DefaultKvsReworkNoteAccessor(storage);
    expect(notes.serviceType).toBe('accessor');
    await notes.append(rn('1', '2026-11-01T10:00:00.000Z'));
    await notes.append(rn('1', '2026-11-01T10:00:00.000Z', 'A second reason, same second'));
    const keys = Array.from(storage.store.keys()).filter(k => k.startsWith('fr:note:'));
    expect(keys).toHaveLength(2);
    expect(keys.every(k => /^fr:note:1:2026-11-01T10:00:00\.000Z:[a-z0-9]+$/.test(k))).toBe(true);
  });

  it('lists one issue oldest first, and does not mix issue 1 with issue 10', async () => {
    const storage = new MemoryStorage();
    const notes = new DefaultKvsReworkNoteAccessor(storage);
    await notes.append(rn('1', '2026-11-02T00:00:00.000Z', 'second reason text'));
    await notes.append(rn('1', '2026-11-01T00:00:00.000Z', 'first reason text'));
    await notes.append(rn('10', '2026-11-01T00:00:00.000Z'));
    expect((await notes.list('1')).map(n => n.reason)).toEqual(['first reason text', 'second reason text']);
    const all = await notes.listAll();
    expect(Array.from(all.keys()).sort()).toEqual(['1', '10']);
    expect(all.get('1')?.[1].reason).toBe('second reason text');
  });

  it('reads a v2 rework note with no notes as one migrated note, also in listAll', async () => {
    const storage = new MemoryStorage();
    await storage.set('fr:issue:5:exception', v2('5', { rework: note }));
    await storage.set('fr:issue:6:exception', v2('6', { code }));
    const notes = new DefaultKvsReworkNoteAccessor(storage);
    expect(await notes.list('5')).toEqual([{ schemaVersion: 1, issueId: '5', issueKey: 'DEMO-5', ...note, migrated: true }]);
    expect(await notes.list('6')).toEqual([]);
    const all = await notes.listAll();
    expect(Array.from(all.keys())).toEqual(['5']);
  });

  it('prefers stored notes over a v2 note that was not removed', async () => {
    const storage = new MemoryStorage();
    await storage.set('fr:issue:5:exception', v2('5', { rework: note }));
    const notes = new DefaultKvsReworkNoteAccessor(storage);
    await notes.append(rn('5', '2026-11-01T00:00:00.000Z'));
    expect(await notes.list('5')).toHaveLength(1);
    expect((await notes.listAll()).get('5')).toHaveLength(1);
  });

  it('migrates at most the limit, keeps a code note in the v2 record, and deletes an emptied record', async () => {
    const storage = new MemoryStorage();
    await storage.set('fr:issue:5:exception', v2('5', { rework: note, code }));
    await storage.set('fr:issue:7:exception', v2('7', { rework: note }));
    await storage.set('fr:issue:8:exception', v2('8', { rework: note }));
    const notes = new DefaultKvsReworkNoteAccessor(storage);
    expect(await notes.migrateV2ReworkNotes(2)).toBe(2);
    expect(await notes.migrateV2ReworkNotes(2)).toBe(1);
    expect(await notes.migrateV2ReworkNotes(2)).toBe(0);
    expect(await storage.get('fr:issue:5:exception')).toEqual(v2('5', { code }));
    expect(storage.store.has('fr:issue:7:exception')).toBe(false);
    expect((await notes.list('7'))[0]).toEqual(expect.objectContaining({ reason: note.reason, recordedBy: 'dev-2', migrated: true }));
    expect(Array.from(storage.store.keys()).filter(k => k.startsWith('fr:note:'))).toHaveLength(3);
  });

  it('reads more than one page of keys', async () => {
    const storage = new MemoryStorage();
    const notes = new DefaultKvsReworkNoteAccessor(storage);
    for (let i = 0; i < 150; i++) await notes.append(rn(String(i), '2026-11-01T00:00:00.000Z'));
    expect((await notes.listAll()).size).toBe(150);
  });
});
