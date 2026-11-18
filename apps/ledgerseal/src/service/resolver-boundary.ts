/**
 * Copyright (c) 2026 Asymm Systems. All rights reserved.
 *
 * LedgerSeal: the resolver boundary (TASK-00006). Every expected outcome (a permission refusal, a validation
 * failure, a conflict, a missing issue, an inactive licence) is already returned as a typed `{ ok: false, code,
 * message }` result by the flows. A real failure (a storage error, an unreadable key) used to escape the resolver as
 * a thrown error, and the Forge resolver runtime then wrote the error's message and stack to the logs. Here it is
 * caught, written through `logFailure` (name, code and status only), and returned as an INTERNAL_FAILURE result, so
 * no message or stack reaches the logs. The UI raises that result again on the client (`frontend/call.ts`), so each
 * screen shows the same text it showed before.
 *
 * @author Fahim Farook
 */

import { logFailure } from './log';

export const INTERNAL_FAILURE_CODE = 'INTERNAL_FAILURE' as const;

export const INTERNAL_FAILURE_MESSAGE = 'LedgerSeal could not complete this request. Try again.';

export interface InternalFailure {
  ok: false;
  code: typeof INTERNAL_FAILURE_CODE;
  message: string;
}

export function internalFailure(): InternalFailure {
  return { ok: false, code: INTERNAL_FAILURE_CODE, message: INTERNAL_FAILURE_MESSAGE };
}

/** True for the result the boundary returns in place of a thrown error. */
export function isInternalFailure(value: unknown): value is InternalFailure {
  return Boolean(value) && typeof value === 'object' && (value as { ok?: unknown }).ok === false && (value as { code?: unknown }).code === INTERNAL_FAILURE_CODE;
}

/** A resolver function as Forge calls it. */
export type ResolverFunction = (request: { payload?: any; context?: any }) => Promise<unknown>;

/**
 * Wraps one resolver function: what it returns passes through unchanged; what it throws is logged by name only and
 * returned as an INTERNAL_FAILURE result. The resolver name in the log line is a fixed key from the manifest code.
 */
export function guardResolver(name: string, fn: ResolverFunction): ResolverFunction {
  return async request => {
    try {
      return await fn(request);
    } catch (err) {
      logFailure(`resolver ${name} failed`, err);
      return internalFailure();
    }
  };
}
