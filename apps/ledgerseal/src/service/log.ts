/**
 * Copyright (c) 2026 Asymm Systems. All rights reserved.
 *
 * LedgerSeal: what a backend log line may say about a failure. Only the error's name, code and HTTP status are
 * written, never its message, its stack or the object, so no issue content or personal data can reach the Forge
 * logs through an error (security questionnaire question 8).
 *
 * @author Fahim Farook
 */

/** The error's name, code and status, for example "Error", "TypeError code=ERR_X" or "Error status=503". */
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

/** Writes "LedgerSeal: <what>: <name, code, status>" to the error log. */
export function logFailure(what: string, err: unknown): void {
  console.error(`LedgerSeal: ${what}: ${errorSummary(err)}`);
}
