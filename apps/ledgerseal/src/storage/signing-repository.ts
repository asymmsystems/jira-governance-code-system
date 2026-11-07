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
  buildChainEntry,
  ChainEntry,
  ChainKind,
  hasValidPolicyHash,
  MAX_REQUESTS_PER_WINDOW,
  MAX_WRONG_PER_CHALLENGE,
  SigningChallenge,
  SigningPolicy,
  SigningState
} from '../domain/signing';
import { SecretStore, StorageProvider } from './seal-repository';

export const SIGNING_KEY = 'ls3:sig:key';
export const POLICY_KEY = 'ls3:sig:policy';
const DAY = 86400;
const MAX_CHAIN_PROBE = 200;
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

  /** Every stored policy version, oldest first. */
  async allPolicies(): Promise<SigningPolicy[]> {
    const rows = await this.storage.query('ls3:sig:policyver:');
    return rows.map(r => r.value as SigningPolicy).sort((a, b) => a.version - b.version);
  }

  /** Creates the version once (a concurrent save of the same number loses), then makes it the current one. */
  async savePolicy(policy: SigningPolicy): Promise<boolean> {
    if (!hasValidPolicyHash(policy)) throw new Error('LedgerSeal: refusing to store a policy with a wrong hash.');
    if (!(await this.storage.createIfAbsent(`ls3:sig:policyver:${pad(policy.version)}`, policy))) return false;
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

  /** Counts one wrong code on a challenge. Returns its number, or null once the challenge has had its maximum. */
  async claimChallengeFailure(challengeId: string, at: string): Promise<number | null> {
    for (let n = 1; n <= MAX_WRONG_PER_CHALLENGE; n++) {
      if (await this.storage.createIfAbsent(`ls3:sig:chalfail:${challengeId}:${n}`, { at }, { ttlSeconds: DAY })) return n;
    }
    return null;
  }

  /** Counts one failure in the person's current series; returns how many failures in a row that makes. */
  async claimFailure(partyId: string, series: number, at: string, issueId: string | null): Promise<number> {
    for (let n = 1; ; n++) {
      if (await this.storage.createIfAbsent(`ls3:sig:fail:${partyId}:${series}:${n}`, { at, issueId }, { ttlSeconds: 30 * DAY })) return n;
    }
  }

  /** True once the request has had its maximum of wrong codes. */
  async challengeVoid(challengeId: string): Promise<boolean> {
    return Boolean(await this.storage.get(`ls3:sig:chalfail:${challengeId}:${MAX_WRONG_PER_CHALLENGE}`));
  }

  /** Counts a code request in its window. Returns false once the window has its maximum. */
  async claimRequest(partyId: string, window: number, at: string): Promise<boolean> {
    for (let n = 1; n <= MAX_REQUESTS_PER_WINDOW; n++) {
      if (await this.storage.createIfAbsent(`ls3:sig:req:${partyId}:${window}:${n}`, { at }, { ttlSeconds: DAY })) return true;
    }
    return false;
  }

  async getState(partyId: string): Promise<SigningState> {
    const stored = await this.storage.get(`ls3:sig:state:${partyId}`);
    return stored || { partyId, series: 1, locked: false, lockedAt: null, lastRequestAt: null };
  }

  async saveState(state: SigningState): Promise<void> {
    await this.storage.set(`ls3:sig:state:${state.partyId}`, state);
  }

  /** Every person with a stored state (for the locked list). */
  async allStates(): Promise<SigningState[]> {
    return (await this.storage.query('ls3:sig:state:')).map(r => r.value as SigningState);
  }

  /** Appends to the person's signing history. */
  appendEvent(partyId: string, fields: Partial<ChainEntry> & { at: string; kind: ChainKind }): Promise<ChainEntry> {
    return this.append(`ls3:sig:ev:${partyId}:`, `ls3:sig:evhead:${partyId}`, { ...fields, partyId });
  }

  /** Appends to the site alert log. */
  appendAlert(fields: Partial<ChainEntry> & { at: string; kind: ChainKind }): Promise<ChainEntry> {
    return this.append('ls3:sig:alert:', 'ls3:sig:alerthead', fields);
  }

  async events(partyId: string): Promise<ChainEntry[]> {
    return (await this.storage.query(`ls3:sig:ev:${partyId}:`)).map(r => r.value as ChainEntry).sort((a, b) => a.seq - b.seq);
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
