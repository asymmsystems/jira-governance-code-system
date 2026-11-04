/**
 * Copyright (c) 2026 Asymm Systems. All rights reserved.
 * @author Fahim Farook
 * FourRealities: append-only rework notes in Forge KVS (ADR-001 Pattern 6).
 * Key fr:note:{issueId}:{recordedAt}:{seq}; a note is written once and never rewritten.
 */

import { ExceptionRecord, ReworkNote } from '../contract/data/models';
import { ReworkNoteAccessor, StorageProvider } from '../contract/accessors';
import { normalizeException } from './issue-facts';
import { queryAll, removeV2Note, seq, v2Key, v2Records } from './kvs-v2-exception';

function migratedNote(record: ExceptionRecord): ReworkNote {
  return { schemaVersion: 1, issueId: record.issueId, issueKey: record.issueKey, ...record.rework!, migrated: true };
}

const oldestFirst = (a: ReworkNote, b: ReworkNote) => a.recordedAt.localeCompare(b.recordedAt);

export class DefaultKvsReworkNoteAccessor implements ReworkNoteAccessor {
  readonly serviceType = 'accessor' as const;

  constructor(private readonly storage: StorageProvider) {}

  async append(note: ReworkNote): Promise<void> {
    await this.storage.set(`fr:note:${note.issueId}:${note.recordedAt}:${seq()}`, note);
  }

  async list(issueId: string): Promise<ReworkNote[]> {
    const notes = (await queryAll(this.storage, `fr:note:${issueId}:`)).map(r => r.value as ReworkNote);
    if (notes.length > 0) {
      return notes.sort(oldestFirst);
    }
    const v2 = normalizeException(await this.storage.get(v2Key(issueId)));
    return v2?.rework ? [migratedNote(v2)] : [];
  }

  async listAll(): Promise<Map<string, ReworkNote[]>> {
    const byIssue = new Map<string, ReworkNote[]>();
    for (const { value } of await queryAll(this.storage, 'fr:note:')) {
      const n = value as ReworkNote;
      byIssue.set(n.issueId, [...(byIssue.get(n.issueId) || []), n]);
    }
    for (const record of await this.v2ReworkNotes()) {
      if (!byIssue.has(record.issueId)) byIssue.set(record.issueId, [migratedNote(record)]);
    }
    for (const list of byIssue.values()) list.sort(oldestFirst);
    return byIssue;
  }

  async migrateV2ReworkNotes(limit: number): Promise<number> {
    const records = (await this.v2ReworkNotes()).slice(0, limit);
    for (const record of records) {
      await this.append(migratedNote(record));
      await removeV2Note(this.storage, record, 'rework');
    }
    return records.length;
  }

  private async v2ReworkNotes(): Promise<ExceptionRecord[]> {
    return (await v2Records(this.storage)).filter(r => Boolean(r.rework));
  }
}
