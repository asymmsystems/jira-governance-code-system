/**
 * One retry policy for Jira REST reads: a 429 is retried up to MAX_TRIES, honouring Retry-After.
 *
 * Copyright (c) 2026 Asymm Systems. All rights reserved.
 * @author Fahim Farook
 *
 * Waits are capped at MAX_WAIT_MS so a validator stays well inside the 25 s invocation limit.
 * Other statuses are returned to the caller, which decides (fail closed in the validator).
 */
export const MAX_TRIES = 3;
export const MAX_WAIT_MS = 5000;

/** Test seam: the wait between tries. Shared with the property write (integrity/attestation). */
export const retryPolicy = {
  sleep: (ms: number) => new Promise<void>(resolve => setTimeout(resolve, ms))
};

/** Wait before the next try: Retry-After seconds when given, else 1 s, 2 s; never more than MAX_WAIT_MS. */
export function backoffMs(res: any, attempt: number): number {
  const retryAfter = Number(res?.headers?.get?.('retry-after'));
  const ms = Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter * 1000 : 1000 * attempt;
  return Math.min(ms, MAX_WAIT_MS);
}

export async function withRetry<T extends { status: number }>(call: () => Promise<T>): Promise<T> {
  let res = await call();
  for (let attempt = 1; attempt < MAX_TRIES && res.status === 429; attempt++) {
    await retryPolicy.sleep(backoffMs(res, attempt));
    res = await call();
  }
  return res;
}
