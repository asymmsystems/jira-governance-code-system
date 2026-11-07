/*
 * Copyright (c) 2026 Asymm Systems. All rights reserved.
 *
 * @author Fahim Farook
 */

/**
 * F-21: one log line for each failed Jira or storage call, so forge logs shows what went wrong. The
 * line names the place and the HTTP status or the error type, never issue text, names or account ids.
 * The frontend logs its failures here too, so the browser console gets the same line.
 */
export function logFailure(where: string, detail: unknown): void {
  console.warn(`cascadeplan ${where}: ${failureSummary(detail)}`);
}

/**
 * What a log line may say about a failure (security questionnaire question 8): "HTTP <status>" for a
 * response or an error with a whole-number status, else the error's name and code, else the type name.
 * A name or a code is kept only when it is a plain identifier, so an error's message, stack or values
 * never reach the logs, whatever a Forge or Jira API puts in its errors.
 */
export function failureSummary(detail: unknown): string {
  const d = detail as { status?: unknown; name?: unknown; code?: unknown } | null | undefined;
  if (d && typeof d === 'object' && typeof d.status === 'number' && Number.isInteger(d.status)) return `HTTP ${d.status}`;
  if (detail instanceof Error) {
    const name = typeof d!.name === 'string' && /^[A-Za-z]{1,40}$/.test(d!.name) ? d!.name : 'Error';
    const code = typeof d!.code === 'string' || typeof d!.code === 'number' ? String(d!.code) : '';
    return /^[A-Za-z0-9_.:-]{1,40}$/.test(code) ? `${name} ${code}` : name;
  }
  return typeof detail;
}
