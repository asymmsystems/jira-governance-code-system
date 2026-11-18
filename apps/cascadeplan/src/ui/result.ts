/*
 * Copyright (c) 2026 Asymm Systems. All rights reserved.
 *
 * @author Fahim Farook
 */

/**
 * CascadePlan: decides whether a resolver result is a failure the user must see (B-07, INV-05).
 */

export interface ResultVerdict {
  failed: boolean;
  message?: string;
}

/**
 * A null or missing result, ok false, success false or a failed Jira sync is a failure.
 */
export function classifyResult(res: any): ResultVerdict {
  if (res === null || res === undefined) {
    return { failed: true, message: 'The planner could not reach Jira. Nothing was changed.' };
  }
  if (res.ok === false || res.success === false) {
    const text = res.message || (res.error && res.error !== 'validation' ? res.error : undefined);
    return { failed: true, message: text || 'The change failed.' };
  }
  if (res.jiraSync && res.jiraSync.ok === false) {
    return {
      failed: true,
      message: res.jiraSync.error
        ? `Saved in CascadePlan, but Jira rejected part of it: ${res.jiraSync.error}`
        : 'Saved in CascadePlan, but Jira rejected part of it.'
    };
  }
  return { failed: false };
}

/**
 * TASK-00006: what a resolver returns in place of a thrown error. Refusals are already typed results
 * (forbidden, busy, validation); a real failure that escaped a resolver used to reach the Forge
 * resolver runtime, which logged its message and stack. The resolver boundary (src/index.ts) logs it
 * by name only (logFailure) and returns this value; the UI raises it again on the client
 * (frontend/bridge.ts, frontend/admin.tsx), so each screen shows the same text as when the call threw.
 */
export const INTERNAL_FAILURE = 'INTERNAL_FAILURE';

export interface InternalFailure {
  ok: false;
  success: false;
  error: typeof INTERNAL_FAILURE;
  message: string;
}

export function internalFailure(): InternalFailure {
  return { ok: false, success: false, error: INTERNAL_FAILURE, message: 'CascadePlan could not complete this request. Try again.' };
}

/** True for the value the resolver boundary returns in place of a thrown error. */
export function isInternalFailure(value: unknown): value is InternalFailure {
  const v = value as { ok?: unknown; error?: unknown } | null | undefined;
  return !!v && typeof v === 'object' && v.ok === false && v.error === INTERNAL_FAILURE;
}

/**
 * The error the UI raises for an INTERNAL_FAILURE value. It has no message, so each caller shows its
 * own fallback text, as it did when the call threw.
 */
export class ResolverFailure extends Error {
  constructor(readonly resolver: string) {
    super('');
    this.name = 'ResolverFailure';
  }
}
