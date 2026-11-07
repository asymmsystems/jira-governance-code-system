/**
 * Copyright (c) 2026 Asymm Systems. All rights reserved.
 * @author Fahim Farook
 * FourRealities: evidence report policy (ADR-015, owner decisions Q2, Q3, Q6, Q8): request validation,
 * rights, the caps, job transitions, schedule periods, retention and the download rule. Pure (ADR-002).
 */

import {
  DownloadDecision,
  FieldInfo,
  REPORT_LIMITS,
  RETENTION_DAYS,
  ReportError,
  ReportIndexEntry,
  ReportJob,
  ReportPermissions,
  ReportRange,
  ReportRights,
  ReportSchedule,
  ReportSettings,
  ReportState
} from '../contract/data/reports';
import { ReportPolicyEngine } from '../contract/reports';

const DAY_MS = 86_400_000;
const DATE = /^(\d{4})-(\d{2})-(\d{2})(?:T00:00(?::00(?:\.000)?)?Z)?$/;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const ACCOUNT_ID = /^[A-Za-z0-9:_-]{1,128}$/;

/** Allowed job transitions (HLD section 7.6). */
const TRANSITIONS: Record<string, ReportState[]> = {
  NONE: ['QUEUED'],
  QUEUED: ['RUNNING', 'FAILED'],
  RUNNING: ['DONE', 'FAILED'],
  DONE: ['EXPIRED', 'DELETED'],
  FAILED: [],
  EXPIRED: [],
  DELETED: []
};

/** Reports that may leave the full index to make room (the index keeps the newest 200). */
const REMOVABLE: ReportState[] = ['EXPIRED', 'DELETED', 'FAILED'];

export const NOT_ALL_VISIBLE_TEXT = (hidden: number, total: number) =>
  `You cannot see ${hidden} of the ${total} issues in this report, so you cannot download it. Ask a project administrator, or make a new report: it will hold only the issues you can see.`;

const err = (code: ReportError['code'], message: string): { error: ReportError } => ({ error: { code, message } });

/** 00:00 UTC of a date string, or NaN. */
function midnight(value: unknown): number {
  const m = typeof value === 'string' ? DATE.exec(value) : null;
  if (!m) return NaN;
  const t = Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  return new Date(t).toISOString().slice(0, 10) === `${m[1]}-${m[2]}-${m[3]}` ? t : NaN;
}

function filtersOf(input: Record<string, unknown>, fields: FieldInfo[]): { fieldIds: string[]; actorAccountIds: string[] } | { error: ReportError } {
  const rawFields = input.fieldIds ?? [];
  const rawPeople = input.actorAccountIds ?? [];
  if (!Array.isArray(rawFields) || !rawFields.every(f => typeof f === 'string')) return err('INVALID_INPUT', 'Give the fields as a list.');
  if (!Array.isArray(rawPeople) || !rawPeople.every(p => typeof p === 'string' && ACCOUNT_ID.test(p))) return err('INVALID_INPUT', 'Give the people as a list of Jira users.');
  const fieldIds = Array.from(new Set(rawFields as string[]));
  const actorAccountIds = Array.from(new Set(rawPeople as string[]));
  if (fieldIds.length > REPORT_LIMITS.maxFilterFields) return err('INVALID_INPUT', `Choose at most ${REPORT_LIMITS.maxFilterFields} fields.`);
  if (actorAccountIds.length > REPORT_LIMITS.maxFilterPeople) return err('INVALID_INPUT', `Choose at most ${REPORT_LIMITS.maxFilterPeople} people.`);
  const known = new Set(fields.map(f => f.id));
  const unknown = fieldIds.filter(f => !known.has(f));
  if (unknown.length > 0) return err('INVALID_INPUT', 'A chosen field is not a field of this site.');
  return { fieldIds, actorAccountIds };
}

/** The start of the period that holds `t` (UTC): Monday for a week, the 1st for a month. */
function periodStart(cadence: ReportSchedule['cadence'], t: number): number {
  const d = new Date(t);
  if (cadence === 'MONTHLY') return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1);
  const day = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
  return day - ((d.getUTCDay() + 6) % 7) * DAY_MS;
}

function periodEnd(cadence: ReportSchedule['cadence'], start: number): number {
  if (cadence === 'WEEKLY') return start + 7 * DAY_MS;
  const d = new Date(start);
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 1);
}

export class DefaultReportPolicyEngine implements ReportPolicyEngine {
  readonly serviceType = 'engine' as const;

  rights(p: ReportPermissions, inReportGroup: boolean): ReportRights {
    const ok = p.status === 200 && p.browse;
    const isTier1 = ok && (p.administerProjects || p.administerJira);
    return { isTier1, canCreate: ok && (isTier1 || inReportGroup), canSchedule: isTier1, canDelete: ok && p.administerJira };
  }

  validateCreate(input: unknown, fields: FieldInfo[], now: Date) {
    const i = (input && typeof input === 'object' ? input : {}) as Record<string, unknown>;
    const from = midnight(i.from);
    const to = midnight(i.to);
    if (Number.isNaN(from) || Number.isNaN(to)) return err('RANGE_INVALID', 'Choose a From date and a To date.');
    if (from >= to) return err('RANGE_INVALID', 'The From date must be before the To date.');
    if (to - from > REPORT_LIMITS.maxRangeDays * DAY_MS) return err('RANGE_INVALID', `A report covers at most ${REPORT_LIMITS.maxRangeDays} days.`);
    const tomorrow = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1);
    if (to > tomorrow) return err('RANGE_INVALID', 'The To date can be at most tomorrow.');
    const filters = filtersOf(i, fields);
    if ('error' in filters) return filters;
    const range: ReportRange = { from: new Date(from).toISOString(), to: new Date(to).toISOString() };
    return { range, ...filters };
  }

  validateSchedule(input: unknown, fields: FieldInfo[]) {
    const i = (input && typeof input === 'object' ? input : {}) as Record<string, unknown>;
    const cadence: ReportSchedule['cadence'] | undefined = i.cadence === 'WEEKLY' || i.cadence === 'MONTHLY' ? i.cadence : undefined;
    if (!cadence) return err('INVALID_INPUT', 'Choose weekly or monthly.');
    if (i.scheduleId !== undefined && !this.isReportId(i.scheduleId)) return err('INVALID_INPUT', 'Unknown schedule.');
    const filters = filtersOf(i, fields);
    if ('error' in filters) return filters;
    return { ...(i.scheduleId ? { scheduleId: String(i.scheduleId) } : {}), cadence, ...filters };
  }

  validateSettings(input: unknown): { retentionDays: ReportSettings['retentionDays']; groupIds: string[] } | { error: string } {
    const i = (input && typeof input === 'object' ? input : {}) as Record<string, unknown>;
    const days = Number(i.retentionDays);
    if (!(RETENTION_DAYS as readonly number[]).includes(days)) return { error: `Choose a retention of ${RETENTION_DAYS.join(', ')} days.` };
    const raw = i.reportGroupIds ?? [];
    if (!Array.isArray(raw)) return { error: 'Give the report groups as a list.' };
    const groupIds = Array.from(new Set(raw.map(String).filter(g => g.length > 0)));
    if (groupIds.length > REPORT_LIMITS.maxGroups) return { error: `Choose at most ${REPORT_LIMITS.maxGroups} groups.` };
    return { retentionDays: days as ReportSettings['retentionDays'], groupIds };
  }

  validateReason(input: unknown): { reason: string } | { error: ReportError } {
    const reason = typeof input === 'string' ? input.trim() : '';
    if (reason.length < REPORT_LIMITS.reasonMinChars || reason.length > REPORT_LIMITS.reasonMaxChars) {
      return err('INVALID_INPUT', `Give a reason of ${REPORT_LIMITS.reasonMinChars} to ${REPORT_LIMITS.reasonMaxChars} characters.`);
    }
    return { reason };
  }

  isReportId(value: unknown): value is string {
    return typeof value === 'string' && UUID.test(value);
  }

  admit(entries: ReportIndexEntry[]): { entries: ReportIndexEntry[] } | { error: ReportError } {
    if (entries.length < REPORT_LIMITS.reportsPerProject) return { entries };
    for (let i = entries.length - 1; i >= 0; i--) {
      if (REMOVABLE.includes(entries[i].state)) return { entries: [...entries.slice(0, i), ...entries.slice(i + 1)] };
    }
    return err('REPORT_LIMIT', `This project keeps ${REPORT_LIMITS.reportsPerProject} reports. A Jira administrator can delete one before a new one is made.`);
  }

  jobLimit(entries: ReportIndexEntry[]): ReportError | undefined {
    const queued = entries.filter(e => e.state === 'QUEUED').length;
    if (queued < REPORT_LIMITS.queuedPerProject) return undefined;
    return { code: 'JOB_LIMIT', message: `This project has ${queued} reports waiting. Try again when one is ready.` };
  }

  mayStart(projectEntries: ReportIndexEntry[], reportId: string, siteRunning: number): boolean {
    if (siteRunning >= REPORT_LIMITS.runningPerSite) return false;
    if (projectEntries.some(e => e.state === 'RUNNING' && e.reportId !== reportId)) return false;
    const queued = projectEntries.filter(e => e.state === 'QUEUED');
    return queued.length === 0 || queued[queued.length - 1].reportId === reportId;
  }

  canTransition(from: ReportJob['state'] | undefined, to: ReportJob['state']): boolean {
    return TRANSITIONS[from || 'NONE'].includes(to);
  }

  duePeriods(schedule: ReportSchedule, now: Date): ReportRange[] {
    let start = schedule.lastPeriodEnd ? Date.parse(schedule.lastPeriodEnd) : periodStart(schedule.cadence, Date.parse(schedule.createdAt));
    const out: ReportRange[] = [];
    while (out.length < 3) {
      const end = periodEnd(schedule.cadence, start);
      if (end > now.getTime()) break;
      out.push({ from: new Date(start).toISOString(), to: new Date(end).toISOString() });
      start = end;
    }
    return out;
  }

  expiresAt(finishedAt: string, retentionDays: number): string {
    return new Date(Date.parse(finishedAt) + retentionDays * DAY_MS).toISOString();
  }

  retentionDue(entries: ReportIndexEntry[], retentionDays: number, now: Date): string[] {
    return entries
      .filter(e => e.state === 'DONE' && Date.parse(this.expiresAt(e.finishedAt || e.createdAt, retentionDays)) <= now.getTime())
      .map(e => e.reportId);
  }

  stalled(job: ReportJob, now: Date): boolean {
    return (job.state === 'QUEUED' || job.state === 'RUNNING') && now.getTime() - Date.parse(job.updatedAt) > REPORT_LIMITS.stalledMs;
  }

  download(input: { total: number; hidden: number; deleted: number; isTier1: boolean }): DownloadDecision {
    if (input.hidden > 0) return { allowed: false, code: 'NOT_ALL_VISIBLE', count: input.hidden, message: NOT_ALL_VISIBLE_TEXT(input.hidden, input.total) };
    if (input.deleted > 0 && !input.isTier1) {
      return { allowed: false, code: 'FORBIDDEN', count: input.deleted, message: `This report holds ${input.deleted} issues that were deleted after it was made. Only a project administrator or a Jira administrator can download it.` };
    }
    return { allowed: true };
  }

  tooLarge(bytes: number[], changes: number): ReportError | undefined {
    if (changes <= REPORT_LIMITS.maxChanges && bytes.every(b => b <= REPORT_LIMITS.maxFileBytes)) return undefined;
    return { code: 'REPORT_TOO_LARGE', message: `The report would hold more than ${REPORT_LIMITS.maxChanges.toLocaleString('en-US')} changes or a file larger than 50 MB, so no file was stored. Make a report for a shorter range or with a field filter.` };
  }
}
