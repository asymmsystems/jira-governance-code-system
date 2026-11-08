/**
 * Copyright (c) 2026 Asymm Systems. All rights reserved.
 * @author Fahim Farook
 * FourRealities: every Atlassian account id the app stores, and its erasure (ADR-014).
 * Account ids sit in: Code exception events (fr:ex:*, byAccountId), rework notes (fr:note:*,
 * recordedBy), v1 and v2 exception records kept for migration (fr:issue:*:exception, recordedBy),
 * snapshot rows (fr:p:{key}:chunk:*, assigneeAccountId, indexed at fr:p:{key}:accounts), and the party
 * token map of the evidence reports (fr:party:{token}, ADR-015): on erasure a token's entry becomes a
 * closed mark, so the signed report files, which hold only tokens, never change.
 * Snapshots written before ADR-014 may also hold names and exception fields; erasure removes them.
 */

import { ERASED_ACCOUNT, IssueRow, SnapshotMeta } from '../contract/data/models';
import { PersonalDataAccessor, StoredAccount, StorageProvider } from '../contract/accessors';
import { KeyValue, queryAll } from './kvs-v2-exception';

type Rec = Record<string, unknown>;
type Note = { recordedBy?: string; recordedAt?: string };

/** The later of two ISO times. */
const later = (a: string, b: string) => (a >= b ? a : b);

/** Account ids a snapshot row written before ADR-014 can hold. */
function rowIds(row: Rec): string[] {
  const ex = (row.codeException || {}) as Rec;
  const note = (row.reworkNote || {}) as Rec;
  return [row.assigneeAccountId, ex.requestedBy, ex.decidedBy, note.recordedBy].filter((id): id is string => typeof id === 'string' && id.length > 0);
}

/** A snapshot row with the closed accounts removed, and the fields that ADR-014 no longer stores. */
function erasedRow(row: Rec, closed: Set<string>): Rec {
  const { codeException: _e, reworkNote: _n, reworkNoteCount: _c, assigneeName: _a, ...rest } = row;
  if (typeof rest.assigneeAccountId === 'string' && closed.has(rest.assigneeAccountId)) delete rest.assigneeAccountId;
  return rest;
}

export class DefaultKvsPersonalDataAccessor implements PersonalDataAccessor {
  readonly serviceType = 'accessor' as const;

  constructor(private readonly storage: StorageProvider) {}

  async accounts(now: string): Promise<StoredAccount[]> {
    const found = new Map<string, StoredAccount>();
    const add = (accountId: unknown, at: unknown, issueId?: string) => {
      if (typeof accountId !== 'string' || !accountId || accountId === ERASED_ACCOUNT || accountId === 'unknown-user') return;
      const when = typeof at === 'string' && at ? at : now;
      const cur = found.get(accountId) || { accountId, updatedAt: when, issueIds: [] };
      cur.updatedAt = later(cur.updatedAt, when);
      if (issueId && !cur.issueIds.includes(issueId)) cur.issueIds.push(issueId);
      found.set(accountId, cur);
    };
    for (const { value } of await queryAll(this.storage, 'fr:ex:')) {
      const e = (value || {}) as Rec;
      add(e.byAccountId, e.at, String(e.issueId));
    }
    for (const { value } of await queryAll(this.storage, 'fr:note:')) {
      const n = (value || {}) as Rec;
      add(n.recordedBy, n.recordedAt, String(n.issueId));
    }
    for (const { key, value } of await this.v2()) {
      const r = (value || {}) as Rec & { code?: Note; rework?: Note };
      const issueId = key.split(':')[2];
      add(r.recordedBy, r.recordedAt, issueId);
      add(r.code?.recordedBy, r.code?.recordedAt, issueId);
      add(r.rework?.recordedBy, r.rework?.recordedAt, issueId);
    }
    for (const { value } of await queryAll(this.storage, 'fr:party:')) {
      const p = (value || {}) as Rec;
      if (p.closed !== true) add(p.accountId, p.updatedAt);
    }
    for (const projectKey of await this.projects()) {
      const index = await this.storage.get<{ generatedAt: string; accountIds: string[] }>(`fr:p:${projectKey}:accounts`);
      if (index) {
        for (const id of index.accountIds || []) add(id, index.generatedAt);
        continue;
      }
      // A snapshot written before ADR-014 has no index: read its rows.
      const meta = await this.storage.get<SnapshotMeta>(`fr:p:${projectKey}:meta`);
      for (const row of await this.rows(projectKey, meta)) for (const id of rowIds(row)) add(id, meta?.generatedAt);
    }
    return Array.from(found.values()).sort((a, b) => a.accountId.localeCompare(b.accountId));
  }

  async erase(closed: string[]): Promise<void> {
    const gone = new Set(closed);
    if (gone.size === 0) return;
    const swap = (id: unknown) => (typeof id === 'string' && gone.has(id) ? ERASED_ACCOUNT : id);
    for (const { key, value } of await queryAll(this.storage, 'fr:ex:')) {
      const e = (value || {}) as Rec;
      if (typeof e.byAccountId === 'string' && gone.has(e.byAccountId)) await this.storage.set(key, { ...e, byAccountId: ERASED_ACCOUNT });
    }
    for (const { key, value } of await queryAll(this.storage, 'fr:note:')) {
      const n = (value || {}) as Rec;
      if (typeof n.recordedBy === 'string' && gone.has(n.recordedBy)) await this.storage.set(key, { ...n, recordedBy: ERASED_ACCOUNT });
    }
    for (const { key, value } of await this.v2()) {
      const r = (value || {}) as Rec & { code?: Note; rework?: Note };
      const next: Rec = { ...r, ...(r.recordedBy !== undefined ? { recordedBy: swap(r.recordedBy) } : {}) };
      if (r.code) next.code = { ...r.code, recordedBy: swap(r.code.recordedBy) };
      if (r.rework) next.rework = { ...r.rework, recordedBy: swap(r.rework.recordedBy) };
      if (JSON.stringify(next) !== JSON.stringify(r)) await this.storage.set(key, next);
    }
    const closedAt = new Date().toISOString();
    for (const { key, value } of await queryAll(this.storage, 'fr:party:')) {
      const p = (value || {}) as Rec;
      if (typeof p.accountId === 'string' && gone.has(p.accountId)) await this.storage.set(key, { closed: true, closedAt });
    }
    for (const projectKey of await this.projects()) {
      const meta = await this.storage.get<SnapshotMeta>(`fr:p:${projectKey}:meta`);
      const index = await this.storage.get<{ generatedAt: string; accountIds: string[] }>(`fr:p:${projectKey}:accounts`);
      if (index && !(index.accountIds || []).some(id => gone.has(id))) continue;
      for (let i = 0; i < (meta?.chunkCount || 0); i++) {
        const chunkKey = `fr:p:${projectKey}:chunk:${i}`;
        const chunk = await this.storage.get<{ snapshotId: string; rows: IssueRow[] }>(chunkKey);
        if (!chunk) continue;
        const rows = (chunk.rows as unknown as Rec[]).map(row => erasedRow(row, gone));
        await this.storage.set(chunkKey, { ...chunk, rows });
      }
      if (index) await this.storage.set(`fr:p:${projectKey}:accounts`, { ...index, accountIds: index.accountIds.filter(id => !gone.has(id)) });
    }
  }

  async minimiseMeta(): Promise<number> {
    let changed = 0;
    for (const projectKey of await this.projects()) {
      const key = `fr:p:${projectKey}:meta`;
      const meta = await this.storage.get<SnapshotMeta>(key);
      // Snapshots written before ADR-014 named the viewer who built them; now "user" or "scheduled".
      if (meta && meta.generatedBy !== 'user' && meta.generatedBy !== 'scheduled') {
        await this.storage.set(key, { ...meta, generatedBy: 'user' });
        changed++;
      }
    }
    return changed;
  }

  private async projects(): Promise<string[]> {
    return (await this.storage.get<string[]>('fr:projects')) || [];
  }

  private async v2(): Promise<KeyValue[]> {
    return (await queryAll(this.storage, 'fr:issue:')).filter(r => r.key.endsWith(':exception'));
  }

  private async rows(projectKey: string, meta: SnapshotMeta | undefined): Promise<Rec[]> {
    const rows: Rec[] = [];
    for (let i = 0; i < (meta?.chunkCount || 0); i++) {
      const chunk = await this.storage.get<{ rows?: Rec[] }>(`fr:p:${projectKey}:chunk:${i}`);
      rows.push(...(chunk?.rows || []));
    }
    return rows;
  }
}
