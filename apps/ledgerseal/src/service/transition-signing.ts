/**
 * Copyright (c) 2026 Asymm Systems. All rights reserved.
 *
 * LedgerSeal: signing on the transition screen (ADR-018 option A, spec v4 section 16; spikes S-1 to S-3).
 * The LedgerSeal signature field asks for a signing intent: every seal check runs as the user, and only a random
 * intent id becomes the field value (never a code). On submit the workflow validator finds the intent in the
 * screen's values, checks it is unused, unexpired and the transitioning user's own, then writes the seal with the
 * screen's values applied, so what is signed is what the signer saw (a changed field or a typed comment blocks).
 *
 * @author Fahim Farook
 */

import * as crypto from 'crypto';
import { SIGNATURE_FIELD_TYPE } from '../domain/canonicalizer';
import { SigningEvidence, SigningPolicy } from '../domain/signing';
import { PartyRepository } from '../storage/party-repository';
import { fail, LedgerSealDeps, PreparedSeal, SealFailure, sealIssueFlow } from './ledger';

export const INTENT_PATTERN = /^lsi_[0-9a-f]{32}$/;
export const INTENT_LIFETIME_SECONDS = 120;
const DAY = 86400;

export interface SigningIntent {
  intentId: string;
  partyId: string;
  issueId: string;
  viewHash: string;
  signature: { meaning: string; declarationVersion: string; declarationText: string; reason?: string };
  approvingChanges: boolean;
  policy: SigningPolicy | null;
  signingEvidence: SigningEvidence | null;
  createdAt: string;
  expiresAt: string;
}

export const INTENT_EXPIRED = 'LedgerSeal: this signature expired or was already used. Sign again in the LedgerSeal field.';
export const INTENT_OTHER_USER = 'LedgerSeal: the person moving the issue is not the person who signed. Sign again.';
export const INTENT_SCREEN_CHANGED =
  'LedgerSeal: fields on this screen changed the approved content. Use a screen with only the LedgerSeal signature field, or sign in the panel.';

const intentKey = (id: string) => `ls3:intent:${id}`;

/**
 * `transition-sign-intent-api` (spec v4 section 16.5): runs every seal check as the user and, instead of sealing,
 * stores a single-use intent that lives 120 seconds. Returns only its id.
 */
export async function createIntentFlow(payload: any, context: any, deps: LedgerSealDeps) {
  const prepared = (await sealIssueFlow(payload, context, deps, { prepare: true })) as PreparedSeal | SealFailure | { ok: true };
  if (!prepared.ok) return prepared;
  if (!('prepared' in prepared)) return fail('INVALID_REQUEST');
  const party = await new PartyRepository(deps.storage).partyForRead();
  if (!party) return fail('CONFLICT');
  const now = Date.now();
  const s = payload.signature;
  const intent: SigningIntent = {
    intentId: 'lsi_' + crypto.randomBytes(16).toString('hex'),
    partyId: party(String(context.accountId)),
    issueId: String(context.extension.issue.id),
    viewHash: prepared.viewHash,
    signature: {
      meaning: s.meaning === undefined ? 'APPROVAL' : String(s.meaning),
      declarationVersion: String(s.declarationVersion),
      declarationText: String(s.declarationText),
      ...(typeof s.reason === 'string' ? { reason: s.reason } : {})
    },
    approvingChanges: prepared.approvingChanges,
    policy: prepared.policy,
    signingEvidence: prepared.signingEvidence,
    createdAt: new Date(now).toISOString(),
    expiresAt: new Date(now + INTENT_LIFETIME_SECONDS * 1000).toISOString()
  };
  await deps.storage.set(intentKey(intent.intentId), intent, { ttlSeconds: DAY });
  return { ok: true as const, intentId: intent.intentId, expiresAt: intent.expiresAt };
}

/** The intent id the screen carries in LedgerSeal's own signature field, or null when there is none. */
export async function intentOnScreen(screen: Record<string, any>, deps: LedgerSealDeps): Promise<string | null> {
  const candidates = Object.entries(screen).filter(([, v]) => typeof v === 'string' && INTENT_PATTERN.test(v));
  if (candidates.length === 0) return null;
  const fields = await deps.jira.getFields();
  // A field list that cannot be read cannot prove the value is someone else's field: treat it as an intent (fail closed)
  if (!fields.ok) return candidates[0][1] as string;
  const ours = new Set(fields.value.filter((f: any) => SIGNATURE_FIELD_TYPE.test(String(f?.schema?.custom ?? ''))).map((f: any) => String(f.id)));
  const hit = candidates.find(([k]) => ours.has(k));
  return hit ? (hit[1] as string) : null;
}

/**
 * The validator's intent branch (spec v4 section 16.4). Null when the screen holds no intent. Otherwise either the
 * seal was written (`ok: true`), or the transition is blocked with a message of at most 250 characters.
 */
export async function completeIntent(
  payload: any,
  screen: Record<string, any>,
  deps: LedgerSealDeps,
  apply: (raw: any) => any
): Promise<{ ok: true } | { ok: false; message: string } | null> {
  const intentId = await intentOnScreen(screen, deps);
  if (!intentId) return null;
  const intent: SigningIntent | null = (await deps.storage.get(intentKey(intentId))) || null;
  if (!intent || Date.parse(intent.expiresAt) <= Date.now() || (await deps.storage.get(`ls3:intentuse:${intentId}`))) return { ok: false, message: INTENT_EXPIRED };
  const userId = payload?.user?.accountId ? String(payload.user.accountId) : '';
  const party = await new PartyRepository(deps.storage).partyForRead();
  if (!userId || !party || party(userId) !== intent.partyId) return { ok: false, message: INTENT_OTHER_USER };
  const issueId = String(payload?.issue?.id ?? '');
  if (issueId && issueId !== intent.issueId) return { ok: false, message: INTENT_EXPIRED };
  // Claimed once before the seal is written: a second submit of the same intent finds the claim
  if (!(await deps.storage.createIfAbsent(`ls3:intentuse:${intentId}`, { at: new Date().toISOString() }, { ttlSeconds: DAY }))) {
    return { ok: false, message: INTENT_EXPIRED };
  }
  const context = { accountId: userId, extension: { issue: { id: intent.issueId, key: String(payload?.issue?.key ?? intent.issueId) } } };
  const sealed: any = await sealIssueFlow({ viewHash: intent.viewHash, signature: intent.signature }, context, deps, {
    complete: { policy: intent.policy, signingEvidence: intent.signingEvidence, transitionToStatusId: String(payload?.transition?.to?.id ?? ''), apply }
  });
  if (sealed.ok) return { ok: true };
  if (sealed.code === 'ISSUE_CHANGED') return { ok: false, message: INTENT_SCREEN_CHANGED };
  return { ok: false, message: `LedgerSeal: the signature was not saved. ${String(sealed.message ?? '')}`.slice(0, 250) };
}
