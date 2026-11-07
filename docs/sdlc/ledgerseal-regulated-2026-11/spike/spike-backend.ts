/**
 * Copyright (c) 2026 Asymm Systems. All rights reserved.
 *
 * LedgerSeal regulated build, Phase 1 platform spikes (development only, removed after the spikes).
 * S-5 and S-8 (notify), S-7 (secret store, transactions, TTL), S-1 to S-3 (signing intent for the field).
 * Nothing here logs a code, a secret or an account id.
 *
 * @author Fahim Farook
 */

import api, { route } from '@forge/api';
import { kvs, WhereConditions } from '@forge/kvs';
import * as crypto from 'crypto';

const INTENT = /^lsi_[0-9a-f]{32}$/;

/** S-8: one email notification to the caller themself, as the app or as the user, on the given issue. */
export async function spikeNotify(payload: any, context: any) {
  const accountId = String(context?.accountId || '');
  const issueId = String(payload?.issueId || '');
  const asUser = payload?.as === 'user';
  const nonce = crypto.randomBytes(4).toString('hex');
  const code = String(crypto.randomInt(0, 1000000)).padStart(6, '0');
  const sentAt = new Date().toISOString();
  const body: any = {
    subject: `LedgerSeal spike ${nonce}`,
    textBody: `LedgerSeal spike code ${code}. Nonce ${nonce}. Sent ${sentAt}. Spike only, no action needed.`,
    htmlBody: `<p>LedgerSeal spike code <b>${code}</b>. Nonce ${nonce}. Sent ${sentAt}. Spike only, no action needed.</p>`,
    to: payload?.target === 'group' ? { groupIds: [String(payload.groupId)] } : { users: [{ accountId }] }
  };
  const requester = asUser ? api.asUser() : api.asApp();
  const res = await requester.requestJira(route`/rest/api/3/issue/${issueId}/notify`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify(body)
  });
  const text = await res.text();
  return { status: res.status, text: text.slice(0, 600), nonce, code, sentAt, as: asUser ? 'user' : 'app', target: payload?.target ?? 'self' };
}

/** S-7: secret store reads and writes, FAIL_IF_EXISTS on a secret, TTL on a plain key, and what a transaction offers. */
export async function spikeSecret() {
  const out: Record<string, unknown> = {};
  const at = new Date().toISOString();
  const step = async (name: string, fn: () => Promise<unknown>) => {
    try {
      out[name] = { ok: true, value: await fn() };
    } catch (err: any) {
      out[name] = { ok: false, error: err?.name ?? 'Error', code: err?.code ?? null };
    }
  };
  await step('setSecret', () => kvs.setSecret('ls3:spike:secret', { seed: 'not-a-real-seed', at }));
  await step('getSecret', () => kvs.getSecret('ls3:spike:secret'));
  await step('getPlainOfSecretKey', () => kvs.get('ls3:spike:secret'));
  await step('setSecretFailIfExists', () => kvs.setSecret('ls3:spike:secret', { seed: 'second' }, { keyPolicy: 'FAIL_IF_EXISTS' }));
  await step('setSecretTtl', () => kvs.setSecret('ls3:spike:secret-ttl', { at }, { ttl: { value: 2, unit: 'MINUTES' } }));
  await step('getSecretTtlMeta', () => kvs.getSecret('ls3:spike:secret-ttl', { metadataFields: ['EXPIRE_TIME' as any] } as any));
  await step('setPlainTtl', () => kvs.set('ls3:spike:ttl', { at }, { ttl: { value: 2, unit: 'MINUTES' } }));
  await step('getPlainTtlMeta', () => kvs.get('ls3:spike:ttl', { metadataFields: ['EXPIRE_TIME' as any] } as any));
  await step('transactWithTtl', async () => {
    await kvs.transact().set('ls3:spike:txttl', { at }, undefined, { ttl: { value: 2, unit: 'MINUTES' } }).execute();
    return kvs.get('ls3:spike:txttl', { metadataFields: ['EXPIRE_TIME' as any] } as any);
  });
  out.transactionMethods = Object.getOwnPropertyNames(Object.getPrototypeOf(kvs.transact())).filter(n => n !== 'constructor');
  await step('queryListsSecret', async () => {
    const page = await kvs.query().where('key', WhereConditions.beginsWith('ls3:spike:')).limit(20).getMany();
    return page.results.map(r => r.key);
  });
  await step('ttlExpiredRead', () => kvs.get('ls3:spike:ttl-old'));
  await step('setOldTtl', () => kvs.set('ls3:spike:ttl-old', { at }, { ttl: { value: 1, unit: 'SECONDS' } }));
  return out;
}

/** S-1 to S-3: a short-lived signing intent, bound to the caller and the issue. Only its id leaves the app. */
export async function spikeIntent(payload: any, context: any) {
  const accountId = String(context?.accountId || '');
  const issueId = String(context?.extension?.issue?.id || payload?.issueId || '');
  const intentId = 'lsi_' + crypto.randomBytes(16).toString('hex');
  await kvs.set(`ls3:spike:intent:${intentId}`, { accountId, issueId, at: new Date().toISOString() }, { ttl: { value: 1, unit: 'HOURS' } });
  return { intentId, issueKnown: Boolean(issueId), extensionType: String(context?.extension?.type ?? ''), keys: Object.keys(context?.extension ?? {}) };
}

/**
 * S-2: what the validator payload carries. Logs only field ids, booleans and the entry point shape. When a field holds
 * a spike intent of the transitioning user, the spike passes the gate on LSP only (development, spike window only).
 */
export async function spikeValidator(payload: any): Promise<{ result: boolean; errorMessage?: string } | null> {
  const top = payload?.modifiedFields && typeof payload.modifiedFields === 'object' ? payload.modifiedFields : {};
  const nested = payload?.transition?.modifiedFields && typeof payload.transition.modifiedFields === 'object' ? payload.transition.modifiedFields : {};
  const fields = { ...nested, ...top };
  const intentFields = Object.keys(fields).filter(k => typeof fields[k] === 'string' && INTENT.test(fields[k]));
  const userId = payload?.user?.accountId ? String(payload.user.accountId) : '';
  let matches = false;
  let known = false;
  if (intentFields.length > 0) {
    const intent: any = await kvs.get(`ls3:spike:intent:${fields[intentFields[0]]}`);
    known = Boolean(intent);
    matches = Boolean(intent && userId && intent.accountId === userId && String(intent.issueId) === String(payload?.issue?.id ?? ''));
  }
  console.log(
    `LedgerSeal spike S-2: payloadKeys=${Object.keys(payload ?? {}).sort().join(',')} userPresent=${Boolean(userId)} ` +
      `modifiedFieldIds=${Object.keys(fields).sort().join(',')} topLevel=${Object.keys(top).length} nested=${Object.keys(nested).length} ` +
      `intentFields=${intentFields.join(',')} intentKnown=${known} intentMatchesUser=${matches} to=${payload?.transition?.to?.id ?? ''} from=${payload?.transition?.from?.id ?? ''}`
  );
  if (intentFields.length === 0) return null;
  return matches ? { result: true } : { result: false, errorMessage: 'LedgerSeal spike: the intent is unknown or belongs to another user.' };
}
