/**
 * Copyright (c) 2026 Asymm Systems. All rights reserved.
 * @author Fahim Farook
 * FourRealities: the words of the "Evidence reports" tab and admin section (HLD section 8). No React.
 * Words not used for a report (HLD 8.3, owner decision Q7): "audit log", "tamper-proof", "tamper-evident",
 * "compliant". A report is signed by FourRealities; a changed file fails the check.
 */

import { ReportCadence, ReportFilters, ReportListRow, ReportRange, ReportSchedule } from '../contract/data/reports';

const DAY_MS = 86_400_000;
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export type ReportLozenge = 'default' | 'success' | 'removed' | 'inprogress' | 'new' | 'moved';

export const REPORT_TAB = 'Evidence reports';
export const DASHBOARD_TAB = 'Dashboard';
export const TAB_SUBTITLE = 'Evidence reports for change-management audits: one project and one period, signed by FourRealities.';
export const BOUNDARY_TEXT = 'FourRealities is not an administrative audit log: Jira\'s audit log and Atlassian Guard keep it.';
export const SCHEDULE_TEXT = 'The report for a period is made the day after the period ends and stored here. It is not sent anywhere.';
export const ADMIN_TEXT = 'Reports are FourRealities records. Jira\'s own history and audit log keep their own retention.';
export const SHORTER_RETENTION_TEXT = 'A shorter retention applies to existing reports from the next daily run: older reports are then removed.';
export const VERIFY_TEXT = 'A report is signed by FourRealities; a changed file fails the check. Download the three report files and run the open verifier (Node.js 18 or later):';
export const VERIFY_COMMAND = 'node verify-fourrealities-report.mjs <manifest.json> <report.json> <report.csv> [--previous <previous-manifest.json>]';
export const SIGNING_KEYS_URL = 'https://asymm.systems/product/jira-governance/signing-keys.html';
export const PEOPLE_FILE_TEXT = 'The people file is not signed. It names the people of the report as you can see them today, and it is removed 24 to 25 hours after the download.';
export const DELETE_TEXT = 'The report files are removed now. A record of the deletion, with your reason, stays in their place and the next report still links to this one.';

/** "1 Oct 2026" for an ISO time (UTC). */
export function dateText(iso: string): string {
  const d = new Date(iso);
  return `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
}

/** "1 Oct 2026 to 31 Oct 2026": the range ends at 00:00 UTC of the day after the last day shown. */
export function periodText(range: ReportRange): string {
  return `${dateText(range.from)} to ${dateText(new Date(Date.parse(range.to) - DAY_MS).toISOString())}`;
}

/** "All fields" or "Status, Resolution; 2 people". */
export function filtersText(filters: ReportFilters, fields: Array<{ id: string; name: string }>): string {
  const names = filters.fieldIds.map(id => fields.find(f => f.id === id)?.name || id);
  const fieldPart = names.length ? names.join(', ') : 'All fields';
  const people = filters.actors.length;
  return people ? `${fieldPart}; ${people} ${people === 1 ? 'person' : 'people'}` : fieldPart;
}

export function sizeText(bytes: number | undefined): string {
  if (bytes === undefined) return '';
  if (bytes < 1024) return `${bytes} bytes`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function shortHash(sha: string | undefined): string {
  return sha ? sha.slice(0, 12) : '';
}

/** The state words and lozenge of a report row. */
export function stateOf(row: ReportListRow): { text: string; appearance: ReportLozenge } {
  switch (row.state) {
    case 'QUEUED':
      return { text: 'Queued', appearance: 'new' };
    case 'RUNNING':
      return { text: row.progress ? `Running ${row.progress.issuesDone} of ${row.progress.issuesTotal} issues` : 'Running', appearance: 'inprogress' };
    case 'DONE':
      return { text: row.unsigned ? 'Ready, not signed' : 'Ready', appearance: 'success' };
    case 'FAILED':
      return { text: `Failed: ${row.error?.message || 'unknown reason'}`, appearance: 'removed' };
    case 'EXPIRED':
      return { text: 'Expired', appearance: 'default' };
    default:
      return { text: 'Deleted', appearance: 'moved' };
  }
}

export function retentionText(days: number): string {
  return `Reports are kept for ${days} days.`;
}

export function signingText(keyId: string | null): string {
  return keyId ? `Signed with ${keyId}.` : 'This report is not signed: no signing key is set for this environment.';
}

/** The note of the new report form, with the date the report will expire. */
export function newReportNote(now: Date, retentionDays: number): string {
  return `The report holds every change in the range that you can see. It is kept until ${dateText(new Date(now.getTime() + retentionDays * DAY_MS).toISOString())}. Free-text fields show that they changed, not the text.`;
}

export function cadenceText(cadence: ReportCadence): string {
  return cadence === 'WEEKLY' ? 'Weekly (Monday to Sunday, UTC)' : 'Monthly (calendar month, UTC)';
}

export function scheduleLine(schedule: ReportSchedule, fields: Array<{ id: string; name: string }>): string {
  const last = schedule.lastPeriodEnd ? `; last period ended ${dateText(new Date(Date.parse(schedule.lastPeriodEnd) - DAY_MS).toISOString())}` : '';
  return `${cadenceText(schedule.cadence)}: ${filtersText(schedule.filters, fields)}${last}`;
}

/** The create payload from the form: To is the last day shown, so the range ends at 00:00 UTC the day after. */
export function createPayload(form: { from: string; to: string; fieldIds: string[]; people: string[] }): { from: string; to: string; fieldIds: string[]; actorAccountIds: string[] } {
  const to = /^\d{4}-\d{2}-\d{2}$/.test(form.to) ? new Date(Date.parse(`${form.to}T00:00:00.000Z`) + DAY_MS).toISOString().slice(0, 10) : form.to;
  return { from: form.from, to, fieldIds: form.fieldIds, actorAccountIds: form.people };
}

/** The account ids a UserPicker change gives: one user, a list, or nothing. */
export function pickedAccountIds(value: unknown): string[] {
  const list = Array.isArray(value) ? value : value ? [value] : [];
  return list.map(u => (u && typeof u === 'object' ? String((u as { id?: unknown; accountId?: unknown }).id ?? (u as { accountId?: unknown }).accountId ?? '') : String(u))).filter(Boolean);
}

/** The values a multi Select change gives. */
export function pickedValues(value: unknown): string[] {
  const list = Array.isArray(value) ? value : value ? [value] : [];
  return list.map(o => String((o as { value?: unknown })?.value ?? '')).filter(Boolean);
}

/** The wait before the n-th refresh of a list with a queued or running report: 5 s, doubling to 60 s; null after 40 refreshes. */
export function pollDelayMs(polls: number): number | null {
  if (polls >= 40) return null;
  return Math.min(60_000, 5_000 * 2 ** Math.min(polls, 4));
}

/** Why the newest period of a schedule was not made yet (review M-3). */
export function refusalLine(refusal: { message: string; range: ReportRange }): string {
  return `The report for ${periodText(refusal.range)} is not made yet: ${refusal.message} FourRealities tries again on its next daily run.`;
}
