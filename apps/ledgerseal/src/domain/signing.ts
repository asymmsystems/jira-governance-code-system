/**
 * Copyright (c) 2026 Asymm Systems. All rights reserved.
 *
 * LedgerSeal: code signing, option B (ADR-016, spec v4 section 14). The signer is the Atlassian account of the
 * invocation; the second component is a single-use code that the app emails to that account through Jira. Pure
 * logic only: policy versions, codes and their keyed hashes, and the hash-chained signing history.
 * A code is never kept in clear: only HMAC-SHA-256(site signing key, challengeId + ":" + code) is stored.
 *
 * @author Fahim Farook
 */

import * as crypto from 'crypto';
import { hashWithout } from './canonical-json';

export const SIGNING_METHOD = 'LS_ATL_EMAIL_OTP_1';
export const CODE_DIGITS = 6;
export const CODE_LIFETIME_SECONDS = 300;
export const MAX_WRONG_PER_CHALLENGE = 3;
export const REQUEST_MIN_INTERVAL_SECONDS = 30;
export const REQUEST_WINDOW_SECONDS = 900;
export const MAX_REQUESTS_PER_WINDOW = 5;
export const LOCKOUT_DEFAULT = 5;
export const LOCKOUT_MIN = 3;
export const LOCKOUT_MAX = 10;
export const MAX_PART11_PROJECTS = 100;
export const GENESIS = '0'.repeat(64);

export type SigningAction = 'SEAL' | 'RESEAL' | 'REVOKE' | 'SIGN_STAGE' | 'REJECT' | 'TRANSITION';
export const SIGNING_ACTIONS: readonly SigningAction[] = ['SEAL', 'RESEAL', 'REVOKE', 'SIGN_STAGE', 'REJECT', 'TRANSITION'];

export interface SigningPolicy {
  schemaVersion: 1;
  version: number;
  enabled: boolean;
  /** Code-signing projects (Jira project ids), sorted. */
  projectIds: string[];
  lockoutThreshold: number;
  codeLifetimeSeconds: number;
  declarationVersion: string;
  setByPartyId: string;
  fromDate: string;
  prevPolicyHash: string;
  policyHash: string;
}

export interface SigningChallenge {
  challengeId: string;
  partyId: string;
  issueId: string;
  action: SigningAction;
  stageId: string | null;
  codeMac: string;
  createdAt: string;
  expiresAt: string;
}

export interface SigningState {
  partyId: string;
  /** The current failure series; a success or an unlock starts the next one, so "failures in a row" restart. */
  series: number;
  locked: boolean;
  lockedAt: string | null;
  lastRequestAt: string | null;
}

export type ChainKind = 'CODE_SENT' | 'CODE_NOT_SENT' | 'SIGN_OK' | 'SIGN_FAIL' | 'CODE_REUSED' | 'LOCKED' | 'UNLOCKED' | 'RATE_LIMITED' | 'ACK';

export interface ChainEntry {
  seq: number;
  at: string;
  kind: ChainKind;
  /** Whom the entry is about (a party token). */
  partyId: string | null;
  /** Who acted: an admin for UNLOCKED and ACK, the person for their own requests; null for the app. */
  byPartyId: string | null;
  issueId: string | null;
  action: string | null;
  challengeId: string | null;
  reason: string | null;
  ackSeq: number | null;
  prevEntryHash: string;
  entryHash: string;
}

/** What a code-signed signature adds to its status row (`WorkEffortStatus.data.signing`). It names no code and no email. */
export interface SigningEvidence {
  method: typeof SIGNING_METHOD;
  components: 2;
  mode: 'PART11';
  challengeId: string;
  policyVersion: number;
  policyHash: string;
}

/** The policy hash covers every other field, so a stored version cannot be changed without notice. */
export function withPolicyHash(policy: Omit<SigningPolicy, 'policyHash'> & { policyHash?: string }): SigningPolicy {
  const draft = { ...policy, policyHash: '' } as SigningPolicy;
  return { ...draft, policyHash: hashWithout(draft, 'policyHash') };
}

export function hasValidPolicyHash(policy: SigningPolicy): boolean {
  return typeof policy?.policyHash === 'string' && hashWithout(policy, 'policyHash') === policy.policyHash;
}

/** The next policy version after `previous` (null for the first). */
export function nextPolicy(
  previous: SigningPolicy | null,
  fields: { enabled: boolean; projectIds: string[]; lockoutThreshold: number; declarationVersion: string; setByPartyId: string; fromDate: string }
): SigningPolicy {
  return withPolicyHash({
    schemaVersion: 1,
    version: (previous?.version ?? 0) + 1,
    enabled: fields.enabled,
    projectIds: [...new Set(fields.projectIds)].sort(),
    lockoutThreshold: fields.lockoutThreshold,
    codeLifetimeSeconds: CODE_LIFETIME_SECONDS,
    declarationVersion: fields.declarationVersion,
    setByPartyId: fields.setByPartyId,
    fromDate: fields.fromDate,
    prevPolicyHash: previous?.policyHash ?? GENESIS
  });
}

/** True when the policy is on and names the project. */
export function isPart11Project(policy: SigningPolicy | null | undefined, projectId: string | null | undefined): boolean {
  return Boolean(policy && policy.enabled && projectId && policy.projectIds.includes(String(projectId)));
}

export function isSigningAction(value: unknown): value is SigningAction {
  return typeof value === 'string' && (SIGNING_ACTIONS as readonly string[]).includes(value);
}

/** A uniform 6-digit code from the operating system's random source. */
export function newCode(random: (max: number) => number = max => crypto.randomInt(0, max)): string {
  return String(random(10 ** CODE_DIGITS)).padStart(CODE_DIGITS, '0');
}

export function newChallengeId(): string {
  return crypto.randomBytes(16).toString('base64url');
}

/** The typed code with spaces and hyphens removed, or null when it is not exactly 6 digits. */
export function normaliseCode(input: unknown): string | null {
  if (typeof input !== 'string' || input.length > 32) return null;
  const code = input.replace(/[\s-]/g, '');
  return new RegExp(`^\\d{${CODE_DIGITS}}$`).test(code) ? code : null;
}

/** The keyed hash that is stored in place of the code. */
export function codeMac(siteKey: Buffer, challengeId: string, code: string): string {
  return crypto.createHmac('sha256', siteKey).update(`${challengeId}:${code}`, 'utf8').digest('hex');
}

/** Constant-time comparison of two hex MACs. */
export function macEquals(a: string, b: string): boolean {
  if (typeof a !== 'string' || typeof b !== 'string' || a.length !== b.length || !/^[0-9a-f]+$/.test(a) || !/^[0-9a-f]+$/.test(b)) return false;
  return crypto.timingSafeEqual(Buffer.from(a, 'hex'), Buffer.from(b, 'hex'));
}

/** The 15-minute window a request falls in, for the rate limit. */
export function requestWindow(atMs: number): number {
  return Math.floor(atMs / (REQUEST_WINDOW_SECONDS * 1000));
}

export function validLockout(value: unknown): number | null {
  const n = typeof value === 'number' ? value : Number.NaN;
  return Number.isInteger(n) && n >= LOCKOUT_MIN && n <= LOCKOUT_MAX ? n : null;
}

/** Builds a chain entry after `prev` (null for the first). */
export function buildChainEntry(
  prev: { seq: number; entryHash: string } | null,
  fields: Partial<Omit<ChainEntry, 'seq' | 'prevEntryHash' | 'entryHash'>> & { at: string; kind: ChainKind }
): ChainEntry {
  const draft: ChainEntry = {
    seq: (prev?.seq ?? 0) + 1,
    at: fields.at,
    kind: fields.kind,
    partyId: fields.partyId ?? null,
    byPartyId: fields.byPartyId ?? null,
    issueId: fields.issueId ?? null,
    action: fields.action ?? null,
    challengeId: fields.challengeId ?? null,
    reason: fields.reason ?? null,
    ackSeq: fields.ackSeq ?? null,
    prevEntryHash: prev?.entryHash ?? GENESIS,
    entryHash: ''
  };
  return { ...draft, entryHash: hashWithout(draft, 'entryHash') };
}

/** Checks consecutive entries, oldest first, starting at seq 1. */
export function verifyEntries(entries: ChainEntry[]): boolean {
  let prev = GENESIS;
  return entries.every((entry, i) => {
    const ok = entry.seq === i + 1 && entry.prevEntryHash === prev && hashWithout(entry, 'entryHash') === entry.entryHash;
    prev = entry.entryHash;
    return ok;
  });
}

/** The alert kinds: shown on the admin page until a Jira admin acknowledges them. */
export const ALERT_KINDS: readonly ChainKind[] = ['SIGN_FAIL', 'CODE_REUSED', 'LOCKED', 'RATE_LIMITED', 'CODE_NOT_SENT'];

/** The words of the email; the code is the only secret in it, and the email goes only to the signer. */
export function codeEmail(code: string, issueKey: string, action: SigningAction): { subject: string; textBody: string; htmlBody: string } {
  const what: Record<SigningAction, string> = {
    SEAL: 'seal',
    RESEAL: 'approve the changes of',
    REVOKE: 'revoke the seal of',
    SIGN_STAGE: 'sign an approval stage of',
    REJECT: 'reject',
    TRANSITION: 'sign and move'
  };
  const key = issueKey.replace(/[^A-Za-z0-9_-]/g, '');
  const line = `Your LedgerSeal signing code to ${what[action]} ${key} is ${code}. It works once, for 5 minutes. If you did not ask for it, tell your Jira admin.`;
  return {
    subject: `LedgerSeal signing code for ${key}`,
    textBody: line,
    htmlBody: `<p>Your LedgerSeal signing code to ${what[action]} ${key} is <b>${code}</b>.</p><p>It works once, for 5 minutes. If you did not ask for it, tell your Jira admin.</p>`
  };
}
