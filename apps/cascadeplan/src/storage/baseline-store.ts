/*
 * Copyright (c) 2026 Asymm Systems. All rights reserved.
 *
 * @author Fahim Farook
 */

/**
 * CascadePlan: baseline and scope-change storage (ADR-009). Keys under the project id:
 *   cp:<projectId>:bl:<planId>:index            { v, active, ids }   (version-checked)
 *   cp:<projectId>:bl:<planId>:h:<id>           the header, with the SHA-256 digest
 *   cp:<projectId>:bl:<planId>:c:<id>:<n>       at most CHUNK_SIZE items
 *   cp:<projectId>:shift:<planId>:<shiftId>     one scope-change request
 *   cp:pd:accounts                              account ids stored as audit subjects (DEC-2)
 * Chunks are written before the header, and the header before the index, so a listed baseline is
 * always complete.
 */

import { sha256Hex } from '../domain/sha256';
import { StorageProvider } from './plan-repository';
import { Baseline, BaselineHeader, BaselineItem, canonicalText, totals } from '../domain/baseline';

export const CHUNK_SIZE = 200;
export const ACCOUNTS_KEY = 'cp:pd:accounts';

export type ShiftStatus = 'PENDING' | 'APPROVED' | 'REJECTED';

export interface ShiftRequest {
  id: string;
  planId: string;
  baselineId: string;
  requestedBy: string | null;
  requestedAt: string;
  reason: string;
  status: ShiftStatus;
  /** The scope change at the time of the request (counts and hours). */
  summary: { added: number; removed: number; changed: number; deltaHours: number };
  reviewedBy?: string | null;
  reviewedAt?: string;
  comment?: string;
  /** The baseline frozen when the request was approved. */
  newBaselineId?: string;
  v: 1;
}

interface BaselineIndex { v: number; active?: string; ids: string[] }

export function digestOf(header: Pick<BaselineHeader, 'id' | 'planId' | 'name' | 'frozenAt' | 'itemCount' | 'totalHours' | 'unestimated'>, items: BaselineItem[]): string {
  return sha256Hex(canonicalText(header, items));
}

export class BaselineStore {
  private readonly base: string;
  private readonly shiftPrefix: string;

  constructor(private readonly storage: StorageProvider, private readonly projectId: string, private readonly planId: string = 'default') {
    if (!storage.query || !storage.swap) throw new Error('CascadePlan: the storage provider must support query and swap');
    this.base = `cp:${projectId}:bl:${planId}:`;
    this.shiftPrefix = `cp:${projectId}:shift:${planId}:`;
  }

  private indexKey() { return `${this.base}index`; }
  private headerKey(id: string) { return `${this.base}h:${id}`; }
  private chunkKey(id: string, n: number) { return `${this.base}c:${id}:${n}`; }

  async readIndex(): Promise<BaselineIndex> {
    const raw = await this.storage.get<BaselineIndex>(this.indexKey());
    return raw && Array.isArray(raw.ids) ? raw : { v: 0, ids: [] };
  }

  /** Changes the index with a version check; at most 3 tries (as the plan list, F-22). */
  async updateIndex(change: (idx: BaselineIndex) => BaselineIndex | null): Promise<boolean> {
    for (let attempt = 0; attempt < 3; attempt++) {
      const cur = await this.readIndex();
      const next = change({ ...cur, ids: [...cur.ids] });
      if (!next) return false;
      const prev = await this.storage.swap!<BaselineIndex>(this.indexKey(), { ...next, v: cur.v + 1 });
      if ((prev?.v || 0) === cur.v) return true;
      if (prev) await this.storage.set(this.indexKey(), prev);
    }
    throw new Error('Someone else is changing the baselines of this plan. Try again.');
  }

  /** Freezes items as a new baseline: chunks, then header, then the index (which makes it active). */
  async save(input: { id: string; name: string; frozenAt: string; frozenBy: string | null; items: BaselineItem[]; supersedes?: string }): Promise<BaselineHeader> {
    const t = totals(input.items);
    const chunks = Math.ceil(input.items.length / CHUNK_SIZE);
    const head = { id: input.id, planId: this.planId, name: input.name, frozenAt: input.frozenAt, ...t };
    const header: BaselineHeader = { ...head, frozenBy: input.frozenBy, chunks, digest: digestOf(head, input.items), v: 1,
      ...(input.supersedes ? { supersedes: input.supersedes } : {}) };
    for (let n = 0; n < chunks; n++) await this.storage.set(this.chunkKey(input.id, n), input.items.slice(n * CHUNK_SIZE, (n + 1) * CHUNK_SIZE));
    await this.storage.set(this.headerKey(input.id), header);
    await this.updateIndex(idx => ({ ...idx, ids: [...idx.ids.filter(x => x !== input.id), input.id], active: input.id }));
    if (input.frozenBy) await this.noteAccount(input.frozenBy, this.headerKey(input.id));
    return header;
  }

  async header(id: string): Promise<BaselineHeader | undefined> {
    return this.storage.get<BaselineHeader>(this.headerKey(id));
  }

  /** A baseline with its items and whether its digest still matches (integrity, ADR-009 decision 3). */
  async load(id: string): Promise<(Baseline & { intact: boolean }) | undefined> {
    const header = await this.header(id);
    if (!header) return undefined;
    const items: BaselineItem[] = [];
    let missing = false;
    for (let n = 0; n < header.chunks; n++) {
      const chunk = await this.storage.get<BaselineItem[]>(this.chunkKey(id, n));
      if (!Array.isArray(chunk)) { missing = true; continue; }
      items.push(...chunk);
    }
    const intact = !missing && digestOf(header, items) === header.digest;
    return { header, items, intact };
  }

  async list(): Promise<{ active?: string; headers: BaselineHeader[] }> {
    const idx = await this.readIndex();
    const headers: BaselineHeader[] = [];
    for (const id of idx.ids) {
      const h = await this.header(id);
      if (h) headers.push(h);
    }
    return { active: idx.active, headers };
  }

  async setActive(id: string): Promise<boolean> {
    if (!(await this.header(id))) return false;
    return this.updateIndex(idx => (idx.ids.includes(id) ? { ...idx, active: id } : null));
  }

  async saveShift(s: ShiftRequest): Promise<void> {
    await this.storage.set(`${this.shiftPrefix}${s.id}`, s);
    if (s.requestedBy) await this.noteAccount(s.requestedBy, `${this.shiftPrefix}${s.id}`);
    if (s.reviewedBy) await this.noteAccount(s.reviewedBy, `${this.shiftPrefix}${s.id}`);
  }

  async shift(id: string): Promise<ShiftRequest | undefined> {
    return this.storage.get<ShiftRequest>(`${this.shiftPrefix}${id}`);
  }

  async shifts(): Promise<ShiftRequest[]> {
    return (await this.storage.query!<ShiftRequest>(this.shiftPrefix)).map(r => r.value)
      .sort((a, b) => (a.requestedAt < b.requestedAt ? 1 : -1));
  }

  /** Deletes every baseline, chunk, index and scope-change request of the plan (with the plan, F-22). */
  async deleteAll(): Promise<void> {
    for (const prefix of [this.base, this.shiftPrefix]) {
      for (const row of await this.storage.query!(prefix)) await this.storage.delete(row.key);
    }
  }

  /** Records that a key names an account id, for the weekly personal data report (DEC-2, BL-5). */
  private async noteAccount(accountId: string, key: string): Promise<void> {
    // Only the time of the last write is kept: the personal data job finds the records themselves by
    // reading them, so the index stays small however many records name the account (M2).
    void key;
    const idx = (await this.storage.get<Record<string, { keys?: string[]; updatedAt: string }>>(ACCOUNTS_KEY)) || {};
    idx[accountId] = { updatedAt: new Date().toISOString() };
    await this.storage.set(ACCOUNTS_KEY, idx);
  }
}

/**
 * Applies the personal data report: for each closed account, every record that names it is changed
 * to name no one, and the account leaves the index. Returns the closed account ids handled.
 */
export async function eraseClosedAccounts(storage: StorageProvider, closed: string[]): Promise<string[]> {
  if (closed.length === 0) return [];
  const idx = (await storage.get<Record<string, { keys?: string[]; updatedAt: string }>>(ACCOUNTS_KEY)) || {};
  const done: string[] = [];
  for (const accountId of closed) {
    const entry = idx[accountId];
    if (!entry) continue;
    for (const key of entry.keys || []) {
      const rec = await storage.get<any>(key);
      if (!rec) continue;
      const next = { ...rec };
      for (const f of ['frozenBy', 'requestedBy', 'reviewedBy']) if (next[f] === accountId) next[f] = null;
      await storage.set(key, next);
    }
    delete idx[accountId];
    done.push(accountId);
  }
  await storage.set(ACCOUNTS_KEY, idx);
  return done;
}
