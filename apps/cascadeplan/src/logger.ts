/*
 * Copyright (c) 2026 Asymm Systems. All rights reserved.
 *
 * @author Fahim Farook
 */

/**
 * F-21: one log line for each failed Jira or storage call, so forge logs shows what went wrong. The
 * line names the place and the HTTP status or the error type, never issue text, names or account ids.
 */
export function logFailure(where: string, detail: unknown): void {
  let what: string;
  if (detail && typeof detail === 'object' && typeof (detail as any).status === 'number') what = `HTTP ${(detail as any).status}`;
  else if (detail instanceof Error) what = `${detail.name}${(detail as any).code ? ` ${(detail as any).code}` : ''}`;
  else what = typeof detail;
  // eslint-disable-next-line no-console
  console.warn(`cascadeplan ${where}: ${what}`);
}
