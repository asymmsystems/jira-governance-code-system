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

export function jiraError(status: number | undefined, message: string): { ok: false; error: ResolverError } {
  if (status === 403) return { ok: false, error: { code: 'FORBIDDEN', message, status } };
  if (status === 404) return { ok: false, error: { code: 'NOT_FOUND', message, status } };
  if (status === 429) return { ok: false, error: { code: 'RATE_LIMITED', message, status } };
  return { ok: false, error: { code: 'JIRA_ERROR', message, status } };
}
