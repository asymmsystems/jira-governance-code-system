/**
 * DefinitionGuard: what a log line may say about a failure (security questionnaire question 8).
 *
 * Copyright (c) 2026 Asymm Systems. All rights reserved.
 * @author Fahim Farook
 *
 * Only a fixed place name and the error's name, code and HTTP status are written, never its message,
 * its stack or the object. So no issue content, account id or token can reach the Forge logs (or the
 * browser console) through an error, whatever Forge storage or a Jira API puts in its errors. The
 * rules are the same as LedgerSeal's (apps/ledgerseal/src/service/log.ts).
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

/** Writes "DefinitionGuard: <where>: <name, code, status>" to the error log. `where` is fixed text from the code. */
export function logFailure(where: string, err: unknown): void {
  console.error(`DefinitionGuard: ${where}: ${errorSummary(err)}`);
}
