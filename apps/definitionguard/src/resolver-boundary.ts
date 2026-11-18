/**
 * DefinitionGuard: the resolver boundary (TASK-00006).
 *
 * Copyright (c) 2026 Asymm Systems. All rights reserved.
 * @author Fahim Farook
 *
 * A resolver used to THROW its expected refusals (no permission, an invalid input, a conflict, an
 * item not found, an inactive licence), and the Forge resolver runtime wrote every thrown error to
 * the logs with its message and stack. Now every resolver function goes through `guardResolver`:
 *
 * - a refusal (`RefusalError`) comes back as `{ ok: false, error: { kind, message } }` and is not
 *   logged, because it is an answer, not a fault;
 * - a failure the user is told about (`RefusalError` of kind UNAVAILABLE, for example Jira could not
 *   be read) comes back the same way, after one `logFailure` line (name only, never the message);
 * - any other error is a fault: one `logFailure` line, then kind FAILURE with no message, so the UI
 *   shows its generic next step, as it did when the error was thrown.
 *
 * The UI raises the result again on the client (`frontend/call.ts`), so `panelErrorText` shows
 * the same text as before.
 */
import { logFailure } from './log';
import { RefusalError, RefusalKind } from './domain/refusal';

export { RefusalError, UnavailableError, RefusalKind } from './domain/refusal';

export type ResolverErrorKind = RefusalKind | 'FAILURE';

export interface ResolverFailure {
  ok: false;
  error: { kind: ResolverErrorKind; message: string };
}

/** True for the result the boundary returns in place of a thrown error. */
export function isResolverFailure(value: unknown): value is ResolverFailure {
  const v = value as { ok?: unknown; error?: { kind?: unknown; message?: unknown } } | null;
  return Boolean(v) && typeof v === 'object' && v!.ok === false && Boolean(v!.error) && typeof v!.error!.kind === 'string' && typeof v!.error!.message === 'string';
}

/** The typed result for an error, and whether it must be logged. */
export function toResolverFailure(err: unknown): { result: ResolverFailure; log: boolean } {
  if (err instanceof RefusalError) {
    return { result: { ok: false, error: { kind: err.kind, message: err.message } }, log: err.kind === 'UNAVAILABLE' };
  }
  return { result: { ok: false, error: { kind: 'FAILURE', message: '' } }, log: true };
}

/** A resolver function as Forge calls it. */
export type ResolverFunction = (request: { payload?: any; context?: any }) => Promise<unknown>;

/** Wraps one resolver function. `name` is the fixed resolver key from the code. */
export function guardResolver(name: string, fn: ResolverFunction): ResolverFunction {
  return async request => {
    try {
      return await fn(request);
    } catch (err) {
      const { result, log } = toResolverFailure(err);
      if (log) logFailure(`resolver ${name} failed`, err);
      return result;
    }
  };
}
