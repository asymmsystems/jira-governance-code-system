/**
 * Copyright (c) 2026 Asymm Systems. All rights reserved.
 *
 * LedgerSeal: storage of code signing (spec v4 section 14.5). Claims are keys created once (`FAIL_IF_EXISTS`),
 * so concurrent invocations cannot count a failure twice or use a code twice. The site signing key lives in the
 * Forge secret store. Short-lived keys carry a time to live.
 *
 * @author Fahim Farook
 */

import * as crypto from 'crypto';
import {
  ALERT_KINDS,
  buildChainEntry,
  ChainEntry,
  ChainKind,
  hasValidPolicyHash,
  MAX_REQUESTS_PER_WINDOW,
  MAX_WRONG_PER_CHALLENGE,
  REQUEST_MIN_INTERVAL_SECONDS,
  SigningChallenge,
  SigningPolicy,
  SigningState
} from '../domain/signing';
import { SecretStore, StorageProvider } from './seal-repository';

export const SIGNING_KEY = 'ls3:sig:key';
export const POLICY_KEY = 'ls3:sig:policy';
const DAY = 86400;
const MAX_CHAIN_PROBE = 200;
/** The slot size of the 30-second request rule (review H-2). */
const REQUEST_SLOT_SECONDS = 5;
const pad = (n: number) => String(n).padStart(6, '0');

export class SigningRepository {
  constructor(private readonly storage: StorageProvider, private readonly secrets: SecretStore | null) {}

  /** The newest policy, or null. A policy whose hash does not match is not trusted (treated as on, failing closed, by callers). */
  async getPolicy(): Promise<SigningPolicy | null> {
    return (await this.storage.get(POLICY_KEY)) || null;
  }

  async getPolicyVersion(version: number): Promise<SigningPolicy | null> {
    return (await this.storage.get(`ls3:sig:policyver:${pad(version)}`)) || null;
  }

  /**
   * Review round 3 (P-1): the versions that came into force, oldest first: every stored version up to the current
   * one. A version stored by a save that died before it came into force is not listed (it was never in force).
   */
  async policiesInForce(): Promise<SigningPolicy[]> {
    const current = await this.getPolicy();
    if (!current) return [];
    return (await this.allPolicies()).filter(p => p.version <= current.version);
  }

  /**
   * Review round 3 (P-1): the current policy, after removing versions that a save stored but never brought into force
   * (it died after the version and its alert). A version younger than `staleMs` may be a save still running: 'busy'.
   * Returns the removed versions, so the caller can say so in the alert log.
   */
  async recoverPolicy(nowMs: number, staleMs: number): Promise<{ current: SigningPolicy | null; dropped: SigningPolicy[] } | 'busy'> {
    const current = await this.getPolicy();
    const orphans = (await this.allPolicies()).filter(p => p.version > (current?.version ?? 0));
    if (orphans.some(p => nowMs - Date.parse(p.fromDate) < staleMs)) return 'busy';
    for (const p of orphans) await this.storage.delete(`ls3:sig:policyver:${pad(p.version)}`);
    return { current, dropped: orphans };
  }

  /** Every stored policy version, oldest first. */
  async allPolicies(): Promise<SigningPolicy[]> {
    const rows = await this.storage.query('ls3:sig:policyver:');
    return rows.map(r => r.value as SigningPolicy).sort((a, b) => a.version - b.version);
  }

  /**
   * Creates the version once (a concurrent save of the same number loses), runs `beforeInForce` (the policy-change
   * alert, review round 2 L-5), then makes it the current one. When `beforeInForce` throws, the version is removed
   * again and the save fails: a policy is never in force without its alert.
   */
  async savePolicy(policy: SigningPolicy, beforeInForce: () => Promise<unknown> = async () => undefined): Promise<boolean> {
    if (!hasValidPolicyHash(policy)) throw new Error('LedgerSeal: refusing to store a policy with a wrong hash.');
    const key = `ls3:sig:policyver:${pad(policy.version)}`;
    if (!(await this.storage.createIfAbsent(key, policy))) return false;
    try {
      await beforeInForce();
    } catch (err) {
      await this.storage.delete(key);
      throw err;
    }
    await this.storage.set(POLICY_KEY, policy);
    return true;
  }

  /** The site signing key (32 bytes), created once in the secret store. */
  async siteKey(): Promise<Buffer> {
    if (!this.secrets) throw new Error('LedgerSeal: no secret store.');
    const read = async () => {
      const stored = await this.secrets!.getSecret(SIGNING_KEY);
      return stored && typeof stored.key === 'string' ? Buffer.from(stored.key, 'base64') : null;
    };
    const existing = await read();
    if (existing) return existing;
    const candidate = crypto.randomBytes(32);
    if (await this.secrets.createSecretIfAbsent(SIGNING_KEY, { key: candidate.toString('base64'), createdAt: new Date().toISOString() })) return candidate;
    const winner = await read();
    if (!winner) throw new Error('LedgerSeal: the signing key could not be read.');
    return winner;
  }

  async saveChallenge(challenge: SigningChallenge): Promise<void> {
    await this.storage.set(`ls3:sig:chal:${challenge.challengeId}`, challenge, { ttlSeconds: DAY });
  }

  async getChallenge(challengeId: string): Promise<SigningChallenge | null> {
    if (!/^[A-Za-z0-9_-]{16,64}$/.test(challengeId)) return null;
    return (await this.storage.get(`ls3:sig:chal:${challengeId}`)) || null;
  }

  async deleteChallenge(challengeId: string): Promise<void> {
    await this.storage.delete(`ls3:sig:chal:${challengeId}`);
  }

  /** Marks the challenge used. False when it was used already (single use). */
  claimUse(challengeId: string, at: string): Promise<boolean> {
    return this.storage.createIfAbsent(`ls3:sig:used:${challengeId}`, { at }, { ttlSeconds: DAY });
  }

  /**
   * Review H-2: takes one of the request's 3 attempt slots before the code is compared, so parallel attempts cannot
   * compare more than 3 codes for one request. Returns the slot number, or null when the request is used up.
   */
  async claimAttempt(challengeId: string, at: string): Promise<number | null> {
    for (let n = 1; n <= MAX_WRONG_PER_CHALLENGE; n++) {
      if (await this.storage.createIfAbsent(`ls3:sig:attempt:${challengeId}:${n}`, { at }, { ttlSeconds: DAY })) return n;
    }
    return null;
  }

  /**
   * Review H-2: takes the next failure slot of the person's current series before the code is compared. A series
   * has `threshold` slots; null means they are all taken, so the person is (or is about to be) locked.
   */
  async claimFailureSlot(partyId: string, series: number, threshold: number, at: string, issueId: string | null): Promise<number | null> {
    for (let n = 1; n <= threshold; n++) {
      if (await this.storage.createIfAbsent(`ls3:sig:fail:${partyId}:${series}:${n}`, { at, issueId }, { ttlSeconds: 30 * DAY })) return n;
    }
    return null;
  }

  /** Gives a failure slot back (an attempt that turned out not to be a failure, such as a code already used). */
  async releaseFailureSlot(partyId: string, series: number, n: number): Promise<void> {
    await this.storage.delete(`ls3:sig:fail:${partyId}:${series}:${n}`);
  }

  /** Counts a code request in its 15-minute window. Returns false once the window has its maximum. */
  async claimRequest(partyId: string, window: number, at: string): Promise<boolean> {
    for (let n = 1; n <= MAX_REQUESTS_PER_WINDOW; n++) {
      if (await this.storage.createIfAbsent(`ls3:sig:req:${partyId}:${window}:${n}`, { at }, { ttlSeconds: DAY })) return true;
    }
    return false;
  }

  /**
   * Review H-2: the 30-second rule as claims. A request claims its own 5-second slot and the 6 slots after it (7
   * keys). A second request less than 30 seconds later always meets a claimed slot and loses; the loser gives back
   * the slots it took. Requests 35 seconds or more apart never meet. False when refused.
   */
  async claimRequestSlot(partyId: string, atMs: number, at: string): Promise<boolean> {
    const first = Math.floor(atMs / (REQUEST_SLOT_SECONDS * 1000));
    const taken: string[] = [];
    for (let n = 0; n <= REQUEST_MIN_INTERVAL_SECONDS / REQUEST_SLOT_SECONDS; n++) {
      const key = `ls3:sig:reqslot:${partyId}:${first + n}`;
      if (!(await this.storage.createIfAbsent(key, { at }, { ttlSeconds: DAY }))) {
        for (const mine of taken) await this.storage.delete(mine);
        return false;
      }
      taken.push(key);
    }
    return true;
  }

  /**
   * The person's current failure series. Series 1 needs no key; series k + 1 starts when its key is created (once),
   * by a success or an unlock. The stored state only holds a hint, so a lost write cannot move the series back.
   */
  async currentSeries(partyId: string): Promise<number> {
    const stored = await this.storage.get(`ls3:sig:state:${partyId}`);
    let series = Math.max(1, Number(stored?.series) || 1);
    while (await this.storage.get(`ls3:sig:series:${partyId}:${series + 1}`)) series++;
    return series;
  }

  /** Starts the next series after `from` (once). False when another writer started it first. */
  async advanceSeries(partyId: string, from: number, at: string): Promise<boolean> {
    const started = await this.storage.createIfAbsent(`ls3:sig:series:${partyId}:${from + 1}`, { at });
    const stored = (await this.storage.get(`ls3:sig:state:${partyId}`)) || {};
    if (!(Number(stored.series) > from + 1)) await this.storage.set(`ls3:sig:state:${partyId}`, { ...stored, partyId, series: from + 1 });
    return started;
  }

  /**
   * Review round 2 (R2-3): how a series ended, decided once. A success and a lock race for the same create-once key
   * (`ls3:sig:end:{party}:{series}`), so a success can never undo a lock made at the same moment, and the other way
   * round. Returns true when this call decided it.
   */
  endSeries(partyId: string, series: number, kind: 'OK' | 'LOCK', at: string): Promise<boolean> {
    return this.storage.createIfAbsent(`ls3:sig:end:${partyId}:${series}`, { kind, at });
  }

  async seriesEnd(partyId: string, series: number): Promise<{ kind: 'OK' | 'LOCK'; at: string } | null> {
    return (await this.storage.get(`ls3:sig:end:${partyId}:${series}`)) || null;
  }

  /** The lock of a series, if any. A lock is decided once; only a new series (an unlock) ends it. */
  async lockOf(partyId: string, series: number): Promise<{ at: string } | null> {
    const end = await this.seriesEnd(partyId, series);
    if (end?.kind === 'LOCK') return { at: end.at };
    return (await this.storage.get(`ls3:sig:lock:${partyId}:${series}`)) || null;
  }

  /**
   * Locks the series. True when this call created the lock. False when it was locked already, or when a success
   * ended the series first (the failure then belongs to a series that is over).
   */
  async lock(partyId: string, series: number, at: string): Promise<boolean> {
    if (!(await this.endSeries(partyId, series, 'LOCK', at))) return false;
    await this.storage.createIfAbsent(`ls3:sig:lock:${partyId}:${series}`, { at });
    return true;
  }

  /** Review round 2 (R2-2): gives a code back when the signature it was checked for was not written. */
  async releaseUse(challengeId: string): Promise<void> {
    await this.storage.delete(`ls3:sig:used:${challengeId}`);
  }

  /** The person's state, derived from the claims: the current series, its lock, and the last request time. */
  async getState(partyId: string): Promise<SigningState> {
    const stored = (await this.storage.get(`ls3:sig:state:${partyId}`)) || {};
    const series = await this.currentSeries(partyId);
    const lock = await this.lockOf(partyId, series);
    return { partyId, series, locked: Boolean(lock), lockedAt: lock?.at ?? null, lastRequestAt: stored.lastRequestAt ?? null };
  }

  /**
   * Saves the last request time and the series hint. `locked: true` locks the current series (create-once); a lock
   * is never cleared here: only `advanceSeries` (a success or an unlock) leaves it behind.
   */
  async saveState(state: SigningState): Promise<void> {
    const stored = (await this.storage.get(`ls3:sig:state:${state.partyId}`)) || {};
    await this.storage.set(`ls3:sig:state:${state.partyId}`, { ...stored, partyId: state.partyId, series: Math.max(Number(stored.series) || 1, state.series), lastRequestAt: state.lastRequestAt });
    if (state.locked) await this.lock(state.partyId, await this.currentSeries(state.partyId), state.lockedAt ?? new Date().toISOString());
  }

  /** Every person whose current series is locked (the admin page's locked list). Reads only the lock keys. */
  async lockedStates(): Promise<SigningState[]> {
    const out: SigningState[] = [];
    for (const row of await this.storage.query('ls3:sig:lock:')) {
      const m = /^ls3:sig:lock:(.+):(\d+)$/.exec(row.key);
      if (!m) continue;
      if ((await this.currentSeries(m[1])) !== Number(m[2])) continue;
      out.push({ partyId: m[1], series: Number(m[2]), locked: true, lockedAt: row.value?.at ?? null, lastRequestAt: null });
    }
    return out;
  }

  /** Appends to the person's signing history. */
  appendEvent(partyId: string, fields: Partial<ChainEntry> & { at: string; kind: ChainKind }): Promise<ChainEntry> {
    return this.append(`ls3:sig:ev:${partyId}:`, `ls3:sig:evhead:${partyId}`, { ...fields, partyId });
  }

  /** Appends to the site alert log. */
  async appendAlert(fields: Partial<ChainEntry> & { at: string; kind: ChainKind }): Promise<ChainEntry> {
    await this.indexAlertsOnce();
    const entry = await this.append('ls3:sig:alert:', 'ls3:sig:alerthead', fields);
    if (ALERT_KINDS.includes(entry.kind)) await this.storage.set(`ls3:sig:open:${pad(entry.seq)}`, entry);
    if (entry.kind === 'ACK' && entry.ackSeq) await this.storage.delete(`ls3:sig:open:${pad(entry.ackSeq)}`);
    return entry;
  }

  async events(partyId: string): Promise<ChainEntry[]> {
    return (await this.storage.query(`ls3:sig:ev:${partyId}:`)).map(r => r.value as ChainEntry).sort((a, b) => a.seq - b.seq);
  }

  /**
   * Review L-8: the open alerts, oldest first, from an index kept with the log (an alert adds its key, its
   * acknowledgement removes it). The index is built once from the log on first use (records written before it).
   */
  async openAlerts(): Promise<ChainEntry[]> {
    await this.indexAlertsOnce();
    return (await this.storage.query('ls3:sig:open:')).map(r => r.value as ChainEntry).sort((a, b) => a.seq - b.seq);
  }

  async alert(seq: number): Promise<ChainEntry | null> {
    return (await this.storage.get(`ls3:sig:alert:${pad(seq)}`)) || null;
  }

  async isAlertOpen(seq: number): Promise<boolean> {
    await this.indexAlertsOnce();
    return Boolean(await this.storage.get(`ls3:sig:open:${pad(seq)}`));
  }

  /** One admin alert per name (for example a rate rule in one window). False when it was raised already. */
  claimAlertOnce(name: string, at: string): Promise<boolean> {
    return this.storage.createIfAbsent(`ls3:sig:alertonce:${name}`, { at }, { ttlSeconds: DAY });
  }

  private async indexAlertsOnce(): Promise<void> {
    if (await this.storage.get('ls3:sig:openindex')) return;
    const all = await this.alerts();
    const acked = new Set(all.filter(e => e.kind === 'ACK').map(e => e.ackSeq));
    for (const e of all) if (ALERT_KINDS.includes(e.kind) && !acked.has(e.seq)) await this.storage.set(`ls3:sig:open:${pad(e.seq)}`, e);
    // Review round 2 (L-8): an acknowledgement written while the index was built is applied again from a fresh read
    for (const e of await this.alerts()) if (e.kind === 'ACK' && e.ackSeq) await this.storage.delete(`ls3:sig:open:${pad(e.ackSeq)}`);
    await this.storage.set('ls3:sig:openindex', { at: new Date().toISOString() });
  }

  async alerts(): Promise<ChainEntry[]> {
    return (await this.storage.query('ls3:sig:alert:')).map(r => r.value as ChainEntry).sort((a, b) => a.seq - b.seq);
  }

  /**
   * A chained append: start at the stored head, move over entries that exist (a head update may lag), claim the
   * next seq once; a lost race moves on to the following seq. The head is then moved forward.
   */
  private async append(prefix: string, headKey: string, fields: Partial<ChainEntry> & { at: string; kind: ChainKind }): Promise<ChainEntry> {
    let head: { seq: number; entryHash: string } | null = (await this.storage.get(headKey)) || null;
    for (let tries = 0; tries < MAX_CHAIN_PROBE; tries++) {
      const next = (head?.seq ?? 0) + 1;
      const existing: ChainEntry | null = (await this.storage.get(prefix + pad(next))) || null;
      if (existing) {
        head = { seq: existing.seq, entryHash: existing.entryHash };
        continue;
      }
      const entry = buildChainEntry(head, fields);
      if (await this.storage.createIfAbsent(prefix + pad(entry.seq), entry)) {
        await this.storage.set(headKey, { seq: entry.seq, entryHash: entry.entryHash });
        return entry;
      }
    }
    throw new Error('LedgerSeal: the signing history could not be appended.');
  }
}
