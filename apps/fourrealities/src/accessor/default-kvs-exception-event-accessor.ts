/**
 * Copyright (c) 2026 Asymm Systems. All rights reserved.
 * @author Fahim Farook
 * FourRealities: append-only gate exception events in Forge KVS (ADR-001 Pattern 3).
 * Key fr:ex:{issueId}:code:{at}:{seq}; an event is written once and never rewritten.
 */

import { ExceptionRecord, GateExceptionEvent } from '../contract/data/models';
import { ExceptionEventAccessor, StorageProvider } from '../contract/accessors';
import { normalizeException } from './issue-facts';

const MIGRATED_APPROVAL = 'Approved before administrator approval was required.';

function v2Key(issueId: string): string {
  return `fr:issue:${issueId}:exception`;
}

/** Two migrated events for a v2 code note: requested and approved by the note's author. */
function migratedEvents(record: ExceptionRecord): GateExceptionEvent[] {
  const note = record.code!;
  const base = { schemaVersion: 3 as const, issueId: record.issueId, issueKey: record.issueKey, gate: 'code' as const, byAccountId: note.recordedBy, migrated: true };
  return [
    { ...base, status: 'REQUESTED', at: note.recordedAt, asRole: 'REQUESTER', reason: note.reason, notes: note.notes },
    { ...base, status: 'APPROVED', at: note.recordedAt, asRole: 'APPROVER', reason: MIGRATED_APPROVAL }
  ];
}

export class DefaultKvsExceptionEventAccessor implements ExceptionEventAccessor {
  readonly serviceType = 'accessor' as const;

  constructor(private readonly storage: StorageProvider) {}

  private async query(prefix: string): Promise<Array<{ key: string; value: any }>> {
    const all: Array<{ key: string; value: any }> = [];
    let cursor: string | undefined;
    do {
      const page: { results: Array<{ key: string; value: any }>; nextCursor?: string } = await this.storage.queryPrefix<any>(prefix, cursor);
      all.push(...page.results);
      cursor = page.nextCursor;
    } while (cursor);
    return all;
  }

  async append(event: GateExceptionEvent): Promise<void> {
    const seq = Math.random().toString(36).slice(2, 10);
    await this.storage.set(`fr:ex:${event.issueId}:${event.gate}:${event.at}:${seq}`, event);
  }

  async list(issueId: string): Promise<GateExceptionEvent[]> {
    const events = (await this.query(`fr:ex:${issueId}:`)).map(r => r.value as GateExceptionEvent);
    if (events.length > 0) {
      return events.sort((a, b) => a.at.localeCompare(b.at));
    }
    const v2 = normalizeException(await this.storage.get(v2Key(issueId)));
    return v2?.code ? migratedEvents(v2) : [];
  }

  async listAll(): Promise<Map<string, GateExceptionEvent[]>> {
    const byIssue = new Map<string, GateExceptionEvent[]>();
    for (const { value } of await this.query('fr:ex:')) {
      const e = value as GateExceptionEvent;
      byIssue.set(e.issueId, [...(byIssue.get(e.issueId) || []), e]);
    }
    for (const record of await this.v2CodeNotes()) {
      if (!byIssue.has(record.issueId)) byIssue.set(record.issueId, migratedEvents(record));
    }
    for (const list of byIssue.values()) list.sort((a, b) => a.at.localeCompare(b.at));
    return byIssue;
  }

  async migrateV2CodeNotes(limit: number): Promise<number> {
    let migrated = 0;
    for (const record of (await this.v2CodeNotes()).slice(0, limit)) {
      for (const e of migratedEvents(record)) await this.append(e);
      const { code, ...rest } = record;
      if (rest.rework) {
        await this.storage.set(v2Key(record.issueId), rest);
      } else {
        await this.storage.delete(v2Key(record.issueId));
      }
      migrated++;
    }
    return migrated;
  }

  /** v2 records that still hold a code note. */
  private async v2CodeNotes(): Promise<ExceptionRecord[]> {
    return (await this.query('fr:issue:'))
      .filter(r => r.key.endsWith(':exception'))
      .map(r => normalizeException(r.value))
      .filter((r): r is ExceptionRecord => Boolean(r?.code));
  }
}
