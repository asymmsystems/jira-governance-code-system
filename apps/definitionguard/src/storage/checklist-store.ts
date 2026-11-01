/**
 * DefinitionGuard checklist store: the KVS layout and the compare-and-set write protocol.
 *
 * Copyright (c) 2026 Asymm Systems. All rights reserved.
 * @author Fahim Farook
 *
 * Keys (docs/spec/definitionguard-spec-v2.md, "Storage Schema"):
 *   dg:state:<issueId>              DodState, a cache of the event log
 *   dg:evt:<issueId>:<seq 8 digits> ChangeEntry, append-only
 *   dg:checklist:<issueId>          v1 record, read only
 *
 * A KVS transaction cannot carry keyPolicy, so the next entry key is the lock: it is written
 * with FAIL_IF_EXISTS before the state. A reader that finds an event beyond the cached state
 * folds it forward, so a failed state write never loses a change.
 */
import { StorageProvider } from './checklist-repository';
import {
  applyEntry,
  createEntry,
  emptyState,
  makeEntry,
  migrateEntry,
  stateFromLegacy,
  verifyChain,
  ChainCheck
} from '../domain/event-log';
import { ChangeEntry, DodState, DodTemplate, EntryInput, IssueChecklistState } from '../domain/models';

export const MAX_WRITE_ATTEMPTS = 3;
export const HISTORY_PAGE = 100;
const MAX_FOLD = 100;

export const CONFLICT_MESSAGE = 'Someone else changed this checklist. Refresh and try again.';

export class ConflictError extends Error {
  constructor() {
    super(CONFLICT_MESSAGE);
    this.name = 'ConflictError';
  }
}

export const stateKey = (issueId: string) => `dg:state:${issueId}`;
export const eventKey = (issueId: string, seq: number) => `dg:evt:${issueId}:${String(seq).padStart(8, '0')}`;
export const eventPrefix = (issueId: string) => `dg:evt:${issueId}:`;
export const legacyKey = (issueId: string) => `dg:checklist:${issueId}`;

export type InitEvents = (base: DodState) => Promise<ChangeEntry[]>;
export type ChangeEvents = (state: DodState) => EntryInput[];

export class ChecklistStore {
  constructor(private readonly storage: StorageProvider) {}

  /**
   * The current state: the cached state folded forward over any newer events,
   * or a rebuild from event 1 when the cache is missing. Undefined when nothing is stored. Never writes.
   */
  public async load(issueId: string): Promise<DodState | undefined> {
    let state = await this.storage.get<DodState>(stateKey(issueId));
    if (!state) {
      const first = await this.storage.get<ChangeEntry>(eventKey(issueId, 1));
      if (!first) return undefined;
      state = applyEntry(emptyState(issueId, '', ''), first);
    }
    for (let i = 0; i < MAX_FOLD; i++) {
      const next = await this.storage.get<ChangeEntry>(eventKey(issueId, state.seq + 1));
      if (!next) return state;
      state = applyEntry(state, next);
    }
    throw new Error('DefinitionGuard: event log is too far ahead of its cached state');
  }

  /**
   * One page of events in seq order (at most HISTORY_PAGE). The KVS prefix query is eventually
   * consistent, so the newest events may appear one read later; the gate never uses this.
   */
  public async history(issueId: string, cursor?: string): Promise<{ events: ChangeEntry[]; nextCursor?: string }> {
    const page = await this.storage.listByPrefix(eventPrefix(issueId), cursor, HISTORY_PAGE);
    const events = (page.values as ChangeEntry[]).slice().sort((a, b) => a.seq - b.seq);
    return { events, nextCursor: page.nextCursor };
  }

  /**
   * Every event in seq order. Reads every history page, then fills any seq the eventually
   * consistent query missed with strict reads, so a missing seq is really missing.
   */
  public async allEvents(issueId: string, state?: DodState): Promise<ChangeEntry[]> {
    const events: ChangeEntry[] = [];
    let cursor: string | undefined;
    do {
      const page = await this.history(issueId, cursor);
      events.push(...page.events);
      cursor = page.nextCursor;
    } while (cursor);
    const seen = new Set(events.map(e => e.seq));
    for (let seq = 1; state && seq <= state.seq; seq++) {
      if (seen.has(seq)) continue;
      const e = await this.storage.get<ChangeEntry>(eventKey(issueId, seq));
      if (e) events.push(e);
    }
    return events.sort((a, b) => a.seq - b.seq);
  }

  /** Verifies the whole chain against the stored head. */
  public async verify(issueId: string): Promise<ChainCheck> {
    const state = await this.load(issueId);
    return verifyChain(issueId, await this.allEvents(issueId, state), state);
  }

  /** As load, but falls back to a state derived in memory from a v1 record (seq 0). Never writes. */
  public async loadOrLegacy(issueId: string, projectId = ''): Promise<DodState | undefined> {
    const state = await this.load(issueId);
    if (state) return state;
    const legacy = await this.storage.get<IssueChecklistState>(legacyKey(issueId));
    return legacy ? stateFromLegacy(legacy, projectId) : undefined;
  }

  /** Init events for a new record: MIGRATED from a v1 record when one exists, else CREATED from the template. */
  public async initFromLegacyOr(
    base: DodState,
    template: () => Promise<DodTemplate>,
    actorAccountId: string,
    at: string
  ): Promise<ChangeEntry[]> {
    const legacy = await this.storage.get<IssueChecklistState>(legacyKey(base.issue.sourceReferenceId));
    if (legacy) return [migrateEntry(base, legacy, actorAccountId, at)];
    return [createEntry(base, await template(), actorAccountId, at)];
  }

  /**
   * Appends the events that `change` returns, with compare-and-set on the next sequence number.
   * `init` runs only when no record exists. `change` may throw to refuse; nothing is written then.
   * Retries on a collision, up to MAX_WRITE_ATTEMPTS, then throws ConflictError.
   */
  public async mutate(
    issueId: string,
    init: InitEvents,
    change: ChangeEvents,
    meta: { issueKey: string; projectId: string } = { issueKey: issueId, projectId: '' }
  ): Promise<DodState> {
    for (let attempt = 1; attempt <= MAX_WRITE_ATTEMPTS; attempt++) {
      let state = await this.load(issueId);
      const events: ChangeEntry[] = [];
      if (!state) {
        state = emptyState(issueId, meta.issueKey, meta.projectId);
        for (const e of await init(state)) {
          state = applyEntry(state, e);
          events.push(e);
        }
      }
      for (const input of change(state)) {
        const e = makeEntry(state, input);
        state = applyEntry(state, e);
        events.push(e);
      }

      let won = true;
      for (const e of events) {
        if (!(await this.storage.setIfAbsent(eventKey(issueId, e.seq), e))) {
          won = false;
          break;
        }
      }
      if (!won) continue;

      await this.storage.set(stateKey(issueId), state);
      return state;
    }
    throw new ConflictError();
  }
}
