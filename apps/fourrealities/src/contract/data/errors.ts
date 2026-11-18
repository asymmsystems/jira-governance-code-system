/**
 * Copyright (c) 2026 Asymm Systems. All rights reserved.
 * @author Fahim Farook
 * FourRealities: builds the resolver error value from a Jira HTTP status (spec v2, Resolver contracts).
 */

import { ResolverError } from './models';

/** The message of a caught error, or the fallback when it has none. */
export function messageOf(err: unknown, fallback: string): string {
  const message = (err as { message?: unknown } | null | undefined)?.message;
  return typeof message === 'string' && message ? message : fallback;
}

/**
 * What a log line may say about a caught error (security questionnaire question 8): only its name, code and
 * HTTP status, for example "Error", "TypeError code=ERR_X" or "Error status=503". Never the message, the
 * stack or the object, so no account id, issue content or token can reach the Forge logs through an error,
 * whatever Forge storage or the personal data reporting API puts in it. The rules are LedgerSeal's
 * (apps/ledgerseal/src/service/log.ts).
 */
export function errorSummary(err: unknown): string {
  if (!err || typeof err !== 'object') return typeof err;
  const e = err as { name?: unknown; code?: unknown; status?: unknown; statusCode?: unknown };
  const name = typeof e.name === 'string' && /^[A-Za-z]{1,40}$/.test(e.name) ? e.name : 'Error';
  const code = typeof e.code === 'string' || typeof e.code === 'number' ? String(e.code).slice(0, 40) : '';
  const rawStatus = typeof e.status === 'number' ? e.status : typeof e.statusCode === 'number' ? e.statusCode : NaN;
  const parts = [name];
  if (code && /^[A-Za-z0-9_.:-]+$/.test(code)) parts.push(`code=${code}`);
  if (Number.isInteger(rawStatus)) parts.push(`status=${rawStatus}`);
  return parts.join(' ');
}

export function jiraError(status: number | undefined, message: string): { ok: false; error: ResolverError } {
  if (status === 403) return { ok: false, error: { code: 'FORBIDDEN', message, status } };
  if (status === 404) return { ok: false, error: { code: 'NOT_FOUND', message, status } };
  if (status === 429) return { ok: false, error: { code: 'RATE_LIMITED', message, status } };
  return { ok: false, error: { code: 'JIRA_ERROR', message, status } };
}

/**
 * TASK-00006: what a resolver returns in place of a thrown error. Refusals are already typed results
 * (`{ ok: false, error: { code, message } }`); a real failure (a storage or Jira error that escaped) used to reach
 * the Forge resolver runtime, which logged its message and stack. The resolver boundary in index.ts logs it by
 * name only (errorSummary) and returns this value; the UI raises it again on the client (frontend/call.ts), so
 * each screen shows the same text as before.
 */
export const INTERNAL_FAILURE_CODE = 'INTERNAL_FAILURE';

export const INTERNAL_FAILURE_MESSAGE = 'FourRealities could not complete this request. Try again.';

export type InternalFailure = { ok: false; error: { code: typeof INTERNAL_FAILURE_CODE; message: string } };

export function internalFailure(): InternalFailure {
  return { ok: false, error: { code: INTERNAL_FAILURE_CODE, message: INTERNAL_FAILURE_MESSAGE } };
}

/** True for the value the resolver boundary returns in place of a thrown error. */
export function isInternalFailure(value: unknown): value is InternalFailure {
  const v = value as { ok?: unknown; error?: { code?: unknown } } | null | undefined;
  return Boolean(v) && typeof v === 'object' && v?.ok === false && v?.error?.code === INTERNAL_FAILURE_CODE;
}
