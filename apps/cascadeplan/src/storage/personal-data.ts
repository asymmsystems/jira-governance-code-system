/*
 * Copyright (c) 2026 Asymm Systems. All rights reserved.
 *
 * @author Fahim Farook
 */

/**
 * CascadePlan: the personal data report (ADR-009 decision 7, DEC-2, BL-5).
 *
 * The app stores Atlassian account ids in these places, and nowhere else:
 *   - a baseline header: `frozenBy` (who froze it);
 *   - a scope-change request: `requestedBy` and `reviewedBy`;
 *   - a plan record: `parties[].partyId` (a person who works on the task through a Jira sub-task);
 *   - the approver policy (`cascadeplan:cfg:approver_policy`, legacy `planshift:cfg:approver_policy`):
 *     `setByPartyId` (the Jira administrator who last saved the approver groups);
 *   - records written by builds before November 2026 that a project has not opened since
 *     (`scheduleMap:*`, `ps:*`): `resourceAccountId`, `contributors[].accountId` and the fields above.
 * Records are written by many paths (moves, plan copies, migrations), so the report finds the ids by
 * reading every stored record, not from an index that each path must keep.
 *
 * The work is a job that runs in steps across invocations of an hourly scheduled trigger, inside a
 * time budget, and keeps its progress in `cppd:state`:
 *   1. scan: read every record, page by page, and note each account id found (`cppd:f:<id>`);
 *   2. report: send the noted ids to Atlassian's personal data reporting API, 90 at a time, and keep
 *      the closed ones;
 *   3. erase: read every record again and remove each closed account's id from it;
 *   4. done: wait until 7 days after the last report, then start again. So no account id is reported
 *      more often than once in 7 days (Atlassian's default cycle period).
 */

import { StorageProvider } from './plan-repository';
import { ACCOUNTS_KEY, eraseClosedAccounts } from './baseline-store';

/** Key prefixes of every record the app stores (and the legacy prefixes of builds before November 2026). */
export const SCAN_PREFIXES = ['cp:', 'cascadeplan:', 'planshift:', 'scheduleMap:', 'ps:'];
/** The job's own keys; this prefix is outside SCAN_PREFIXES, so the scan never reads them. */
export const PD_STATE_KEY = 'cppd:state';
export const PD_FOUND_PREFIX = 'cppd:f:';

/** Atlassian's default cycle period: an account id is reported at most once in this time. */
export const CYCLE_MS = 7 * 24 * 3600 * 1000;
/** Time one invocation spends before it stops and saves its progress (the function timeout is 900 s). */
export const DEFAULT_BUDGET_MS = 600 * 1000;
/** A run that holds the job longer than this has ended (900 s timeout plus a margin). */
export const LEASE_MS = 960 * 1000;
export const SCAN_PAGE = 100;
/** One request of the reporting API takes at most 90 accounts. */
export const REPORT_PAGE = 90;
/** Closed ids kept for one erase pass; more closed ids are reported closed again next cycle. */
export const MAX_CLOSED = 2000;

/** Fields that hold an Atlassian account id. */
const ID_FIELDS = new Set(['partyId', 'accountId', 'resourceAccountId', 'assigneeAccountId', 'setByPartyId', 'frozenBy', 'requestedBy', 'reviewedBy']);
/** Audit fields that name no one after erasure (null), so the record keeps its shape and digest. */
const NULLED_FIELDS = new Set(['frozenBy', 'requestedBy', 'reviewedBy']);
/** Values that old builds wrote in place of an account id. */
const NOT_IDS = new Set(['system', 'anonymous', 'unknown', 'unassigned', 'Unassigned']);
const ACCOUNT_ID = /^[A-Za-z0-9:_-]{1,128}$/;

export type PdPhase = 'scan' | 'report' | 'erase' | 'done';

export interface PdState {
  v: 1;
  phase: PdPhase;
  /** When this cycle's scan started (ISO). */
  cycle: string;
  /** When this cycle's last report was sent (ISO); the next cycle starts CYCLE_MS after it. */
  reportedAt?: string;
  prefix: number;
  cursor?: string;
  closed: string[];
  reported: number;
  erased: number;
  leaseUntil?: number;
}

export interface PdRunResult {
  status: 'busy' | 'waiting' | 'progress' | 'done';
  phase: PdPhase;
  reported: number;
  closed: string[];
  pages: number;
}

export type ReportFn = (accounts: Array<{ accountId: string; updatedAt: string }>) => Promise<Array<{ accountId: string; status: string }>>;

export interface PdOptions {
  now?: () => number;
  budgetMs?: number;
  scanPage?: number;
}

/** True for a value that is an Atlassian account id (not a group, placeholder or old stand-in). */
export function isAccountId(v: unknown): v is string {
  return typeof v === 'string' && ACCOUNT_ID.test(v) && !NOT_IDS.has(v) && !v.startsWith('ph:');
}

function dateOf(holder: any): string | undefined {
  for (const f of ['reviewedAt', 'requestedAt', 'frozenAt', 'fromDate', 'since', 'updatedAt']) {
    const v = holder && holder[f];
    if (typeof v === 'string' && /^\d{4}-\d{2}-\d{2}/.test(v)) return v.length === 10 ? `${v}T00:00:00.000Z` : v;
  }
  return undefined;
}

/**
 * Every account id a stored value holds, with the latest date the value gives for it. A party of type
 * GROUP (the approver groups) holds a group id, not an account id.
 */
export function accountIdsIn(value: unknown, out: Map<string, string | undefined> = new Map(), depth = 0): Map<string, string | undefined> {
  if (!value || typeof value !== 'object' || depth > 12) return out;
  if (Array.isArray(value)) {
    for (const v of value) accountIdsIn(v, out, depth + 1);
    return out;
  }
  const holder = value as Record<string, unknown>;
  const group = holder.partyTypeId === 'GROUP';
  for (const [k, v] of Object.entries(holder)) {
    if (ID_FIELDS.has(k)) {
      if (group && k === 'partyId') continue;
      if (!isAccountId(v)) continue;
      const at = dateOf(holder);
      const cur = out.get(v);
      if (!out.has(v) || (at && (!cur || at > cur))) out.set(v, at || cur);
    } else if (v && typeof v === 'object') {
      accountIdsIn(v, out, depth + 1);
    }
  }
  return out;
}

/**
 * A copy of a stored value in which no closed account is named: audit fields become null, other id
 * fields are removed (a contributor keeps its Jira sub-task key, so the work stays linked).
 */
export function eraseAccountsIn<T>(value: T, closed: Set<string>, depth = 0): { value: T; changed: boolean } {
  if (!value || typeof value !== 'object' || depth > 12) return { value, changed: false };
  if (Array.isArray(value)) {
    let changed = false;
    const next = value.map(v => { const r = eraseAccountsIn(v, closed, depth + 1); changed = changed || r.changed; return r.value; });
    return { value: (changed ? next : value) as unknown as T, changed };
  }
  const holder = value as unknown as Record<string, unknown>;
  const group = holder.partyTypeId === 'GROUP';
  let changed = false;
  const next: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(holder)) {
    if (ID_FIELDS.has(k) && !(group && k === 'partyId') && typeof v === 'string' && closed.has(v)) {
      changed = true;
      if (NULLED_FIELDS.has(k)) next[k] = null;
      continue;
    }
    const r = eraseAccountsIn(v, closed, depth + 1);
    changed = changed || r.changed;
    next[k] = r.value;
  }
  return { value: (changed ? next : value) as unknown as T, changed };
}

/** One page of the keys under a prefix: the provider's own paging, else a page of its full query. */
export async function pageOf<T>(storage: StorageProvider, prefix: string, limit: number, cursor?: string):
  Promise<{ results: Array<{ key: string; value: T }>; nextCursor?: string }> {
  if (storage.queryPage) return storage.queryPage<T>(prefix, limit, cursor);
  const all = (await storage.query!<T>(prefix)).sort((a, b) => (a.key < b.key ? -1 : a.key > b.key ? 1 : 0));
  const from = cursor ? all.findIndex(r => r.key > cursor) : 0;
  const results = from === -1 ? [] : all.slice(from, from + limit);
  const more = from !== -1 && from + limit < all.length;
  return { results, nextCursor: more ? results[results.length - 1].key : undefined };
}

function newCycle(now: number): PdState {
  return { v: 1, phase: 'scan', cycle: new Date(now).toISOString(), prefix: 0, closed: [], reported: 0, erased: 0 };
}

/**
 * One step of the personal data job. Runs until the job is done for this cycle or the time budget is
 * spent, saving its progress after every page, so a later invocation continues where it stopped.
 */
export async function runPersonalDataJob(storage: StorageProvider, report: ReportFn, options: PdOptions = {}): Promise<PdRunResult> {
  const now = options.now || Date.now;
  const started = now();
  const budget = options.budgetMs ?? DEFAULT_BUDGET_MS;
  const scanPage = options.scanPage ?? SCAN_PAGE;
  const stored = await storage.get<PdState>(PD_STATE_KEY);
  if (stored && stored.leaseUntil && stored.leaseUntil > started) {
    return { status: 'busy', phase: stored.phase, reported: 0, closed: [], pages: 0 };
  }
  const fresh = !stored || (stored.phase === 'done' && started - Date.parse(stored.reportedAt || stored.cycle) >= CYCLE_MS);
  const state: PdState = fresh ? newCycle(started) : stored as PdState;
  if (state.phase === 'done') return { status: 'waiting', phase: 'done', reported: 0, closed: [], pages: 0 };

  // A lease, so that a duplicated invocation of the trigger does not run the same step twice.
  const lease = started + LEASE_MS;
  const previous = storage.swap ? await storage.swap<PdState>(PD_STATE_KEY, { ...state, leaseUntil: lease }) : (await storage.set(PD_STATE_KEY, { ...state, leaseUntil: lease }), undefined);
  if (previous && previous.leaseUntil && previous.leaseUntil > started) {
    await storage.set(PD_STATE_KEY, previous);
    return { status: 'busy', phase: previous.phase, reported: 0, closed: [], pages: 0 };
  }
  state.leaseUntil = lease;

  const run = { reported: 0, closed: [] as string[], pages: 0 };
  const noted = new Map<string, string>();
  const note = async (accountId: string, at: string | undefined): Promise<void> => {
    const when = at || state.cycle;
    const seen = noted.get(accountId);
    if (seen && seen >= when) return;
    const key = `${PD_FOUND_PREFIX}${accountId}`;
    const cur = await storage.get<{ at: string; cycle: string }>(key);
    const best = cur && cur.cycle === state.cycle && cur.at > when ? cur.at : when;
    if (!cur || cur.cycle !== state.cycle || cur.at !== best) await storage.set(key, { at: best, cycle: state.cycle });
    noted.set(accountId, best);
  };
  const save = async () => { await storage.set(PD_STATE_KEY, state); };
  // A stored cursor that storage no longer accepts restarts the pass of that prefix: the scan and the
  // erasure are safe to repeat, and reported ids have already left the list. Busy storage stops the run.
  const readPage = async <T>(prefix: string, limit: number) => {
    try {
      return await pageOf<T>(storage, prefix, limit, state.cursor);
    } catch (err: any) {
      if (!state.cursor || (err && err.name === 'StorageBusyError')) throw err;
      state.cursor = undefined;
      return pageOf<T>(storage, prefix, limit, undefined);
    }
  };

  try {
    while (now() - started < budget && (state.phase as PdPhase) !== 'done') {
      run.pages++;
      // An error (busy storage, a failed report) stops this run with the progress saved; the next
      // hourly run continues from the same page.
      await step();
      await save();
    }
  } finally {
    state.leaseUntil = undefined;
    await save();
  }
  return { status: (state.phase as PdPhase) === 'done' ? 'done' : 'progress', phase: state.phase, reported: run.reported, closed: run.closed, pages: run.pages };

  async function step(): Promise<void> {
    if (state.phase === 'scan') {
      if (state.prefix === 0 && !state.cursor) {
        // The audit subjects' index gives the time each id was last written.
        const idx = (await storage.get<Record<string, { updatedAt?: string }>>(ACCOUNTS_KEY)) || {};
        for (const [accountId, v] of Object.entries(idx)) if (isAccountId(accountId)) await note(accountId, v && v.updatedAt);
      }
      const page = await readPage<any>(SCAN_PREFIXES[state.prefix], scanPage);
      for (const row of page.results) for (const [accountId, at] of accountIdsIn(row.value)) await note(accountId, at);
      advance(state, page.nextCursor, 'report');
    } else if (state.phase === 'report') {
      const page = await readPage<{ at: string; cycle: string }>(PD_FOUND_PREFIX, REPORT_PAGE);
      const due: Array<{ accountId: string; updatedAt: string }> = [];
      for (const row of page.results) {
        // An id noted in an earlier cycle and not found again is no longer stored: it is not reported.
        if (!row.value || row.value.cycle !== state.cycle) { await storage.delete(row.key); continue; }
        due.push({ accountId: row.key.slice(PD_FOUND_PREFIX.length), updatedAt: row.value.at });
      }
      if (due.length) {
        const updates = await report(due);
        for (const u of updates || []) {
          if (u && u.status === 'closed' && isAccountId(u.accountId) && !state.closed.includes(u.accountId) && state.closed.length < MAX_CLOSED) {
            state.closed.push(u.accountId);
            run.closed.push(u.accountId);
          }
        }
        // Each reported id leaves the list, so a restarted page never reports it twice in a cycle.
        for (const d of due) await storage.delete(`${PD_FOUND_PREFIX}${d.accountId}`);
        state.reported += due.length;
        run.reported += due.length;
        state.reportedAt = new Date(now()).toISOString();
      }
      state.cursor = page.nextCursor;
      if (!state.cursor) {
        state.reportedAt = state.reportedAt || new Date(now()).toISOString();
        state.phase = state.closed.length ? 'erase' : 'done';
        state.prefix = 0;
      }
    } else {
      const closed = new Set(state.closed);
      const page = await readPage<any>(SCAN_PREFIXES[state.prefix], scanPage);
      for (const row of page.results) {
        const r = eraseAccountsIn(row.value, closed);
        if (!r.changed) continue;
        const next: any = r.value;
        // A plan record is version-checked: a write made from an older read is refused, not lost.
        if (next && typeof next.version === 'number') next.version += 1;
        await storage.set(row.key, next);
      }
      advance(state, page.nextCursor, 'done');
      if (state.phase === 'done') {
        await eraseClosedAccounts(storage, state.closed);
        state.erased += state.closed.length;
        state.closed = [];
      }
    }
  }
}

/** Moves the scan or erase pass to its next page, the next prefix, or the next phase. */
function advance(state: PdState, nextCursor: string | undefined, then: PdPhase): void {
  state.cursor = nextCursor;
  if (nextCursor) return;
  state.prefix += 1;
  if (state.prefix < SCAN_PREFIXES.length) return;
  state.prefix = 0;
  state.phase = then;
}
