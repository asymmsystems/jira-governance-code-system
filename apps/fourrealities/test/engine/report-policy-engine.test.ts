/**
 * Copyright (c) 2026 Asymm Systems. All rights reserved.
 * @author Fahim Farook
 * FourRealities: the evidence report policy (ADR-015): who may do what (Q2, Q8), request validation, the
 * caps (Q6), job transitions, schedule periods, retention (Q3) and the download rule.
 */

import { DefaultReportPolicyEngine, NOT_ALL_VISIBLE_TEXT } from '../../src/engine/default-report-policy-engine';
import { REPORT_LIMITS, ReportIndexEntry, ReportJob, ReportPermissions, ReportSchedule, ReportState } from '../../src/contract/data/reports';

const policy = new DefaultReportPolicyEngine();
const FIELDS = [{ id: 'status', name: 'Status' }, { id: 'resolution', name: 'Resolution' }];
const NOW = new Date('2026-11-08T12:00:00.000Z');
const perms = (o: Partial<ReportPermissions> = {}): ReportPermissions => ({ status: 200, browse: true, administerProjects: false, administerJira: false, ...o });
const entry = (reportId: string, state: ReportState, extra: Partial<ReportIndexEntry> = {}): ReportIndexEntry => ({ reportId, state, range: { from: 'a', to: 'b' }, filters: { fieldIds: [], actors: [] }, trigger: 'user', requestedBy: 'pty_x', createdAt: '2026-01-01T00:00:00.000Z', ...extra });

describe('rights (owner decisions Q2 and Q8)', () => {
  it('lets Browse projects alone see but not create, schedule or delete', () => {
    expect(policy.rights(perms(), false)).toEqual({ isTier1: false, canCreate: false, canSchedule: false, canDelete: false });
  });
  it('lets a member of a report group create, but not schedule', () => {
    expect(policy.rights(perms(), true)).toEqual({ isTier1: false, canCreate: true, canSchedule: false, canDelete: false });
  });
  it('lets a project administrator create and schedule, and only a Jira administrator delete', () => {
    expect(policy.rights(perms({ administerProjects: true }), false)).toEqual({ isTier1: true, canCreate: true, canSchedule: true, canDelete: false });
    expect(policy.rights(perms({ administerJira: true }), false)).toEqual({ isTier1: true, canCreate: true, canSchedule: true, canDelete: true });
  });
  it('fails closed without Browse projects or without an answer from Jira', () => {
    expect(policy.rights(perms({ browse: false, administerJira: true }), true).canCreate).toBe(false);
    expect(policy.rights(perms({ status: 500, administerJira: true }), true)).toEqual({ isTier1: false, canCreate: false, canSchedule: false, canDelete: false });
  });
});

describe('create validation', () => {
  it('accepts dates at 00:00 UTC and returns the range in ISO', () => {
    expect(policy.validateCreate({ from: '2026-10-01', to: '2026-11-01T00:00:00Z', fieldIds: ['status', 'status'], actorAccountIds: ['712020:abc'] }, FIELDS, NOW))
      .toEqual({ range: { from: '2026-10-01T00:00:00.000Z', to: '2026-11-01T00:00:00.000Z' }, fieldIds: ['status'], actorAccountIds: ['712020:abc'] });
  });
  it.each([
    [{ from: '2026-10-01' }, 'RANGE_INVALID', 'Choose a From date and a To date.'],
    [{ from: '2026-10-01T10:00:00Z', to: '2026-11-01' }, 'RANGE_INVALID', 'Choose a From date and a To date.'],
    [{ from: '2026-02-30', to: '2026-03-01' }, 'RANGE_INVALID', 'Choose a From date and a To date.'],
    [{ from: '2026-11-01', to: '2026-11-01' }, 'RANGE_INVALID', 'The From date must be before the To date.'],
    [{ from: '2025-10-01', to: '2026-10-03' }, 'RANGE_INVALID', 'A report covers at most 366 days.'],
    [{ from: '2026-11-01', to: '2026-11-10' }, 'RANGE_INVALID', 'The To date can be at most tomorrow.'],
    [{ from: '2026-10-01', to: '2026-11-01', fieldIds: 'status' }, 'INVALID_INPUT', 'Give the fields as a list.'],
    [{ from: '2026-10-01', to: '2026-11-01', actorAccountIds: ['bad id'] }, 'INVALID_INPUT', 'Give the people as a list of Jira users.'],
    [{ from: '2026-10-01', to: '2026-11-01', fieldIds: ['nope'] }, 'INVALID_INPUT', 'A chosen field is not a field of this site.'],
    [{ from: '2026-10-01', to: '2026-11-01', fieldIds: Array.from({ length: 11 }, (_, i) => `f${i}`) }, 'INVALID_INPUT', 'Choose at most 10 fields.'],
    [{ from: '2026-10-01', to: '2026-11-01', actorAccountIds: Array.from({ length: 11 }, (_, i) => `a${i}`) }, 'INVALID_INPUT', 'Choose at most 10 people.']
  ])('refuses %j with %s', (input, code, message) => {
    expect(policy.validateCreate(input, FIELDS, NOW)).toEqual({ error: { code, message } });
  });
  it('accepts tomorrow as the To date and 366 days', () => {
    expect('range' in policy.validateCreate({ from: '2025-11-08', to: '2026-11-09' }, FIELDS, NOW)).toBe(true);
    expect('error' in policy.validateCreate(null, FIELDS, NOW)).toBe(true);
  });
});

describe('schedule, settings and reason validation', () => {
  it('validates the schedule cadence, id and filters', () => {
    expect(policy.validateSchedule({ cadence: 'WEEKLY', fieldIds: ['status'] }, FIELDS)).toEqual({ cadence: 'WEEKLY', fieldIds: ['status'], actorAccountIds: [] });
    expect(policy.validateSchedule({ cadence: 'MONTHLY', scheduleId: '11111111-2222-4333-8444-555555555555' }, FIELDS)).toMatchObject({ scheduleId: '11111111-2222-4333-8444-555555555555' });
    expect(policy.validateSchedule({ cadence: 'DAILY' }, FIELDS)).toEqual({ error: { code: 'INVALID_INPUT', message: 'Choose weekly or monthly.' } });
    expect(policy.validateSchedule({ cadence: 'WEEKLY', scheduleId: 'x' }, FIELDS)).toEqual({ error: { code: 'INVALID_INPUT', message: 'Unknown schedule.' } });
    expect(policy.validateSchedule({ cadence: 'WEEKLY', fieldIds: ['x'] }, FIELDS)).toMatchObject({ error: { code: 'INVALID_INPUT' } });
    expect(policy.validateSchedule(undefined, FIELDS)).toMatchObject({ error: { code: 'INVALID_INPUT' } });
  });
  it('allows only the retention values of Q3 (90 days to 7 years) and at most 20 groups', () => {
    for (const d of [90, 180, 400, 730, 1095, 1825, 2555]) expect(policy.validateSettings({ retentionDays: d, reportGroupIds: ['g1', 'g1', ''] })).toEqual({ retentionDays: d, groupIds: ['g1'] });
    expect(policy.validateSettings({ retentionDays: 30 })).toEqual({ error: 'Choose a retention of 90, 180, 400, 730, 1095, 1825, 2555 days.' });
    expect(policy.validateSettings({ retentionDays: 2556 })).toHaveProperty('error');
    expect(policy.validateSettings({ retentionDays: 400 })).toEqual({ retentionDays: 400, groupIds: [] });
    expect(policy.validateSettings({ retentionDays: 400, reportGroupIds: 'g' })).toEqual({ error: 'Give the report groups as a list.' });
    expect(policy.validateSettings({ retentionDays: 400, reportGroupIds: Array.from({ length: 21 }, (_, i) => `g${i}`) })).toEqual({ error: 'Choose at most 20 groups.' });
    expect(policy.validateSettings(null)).toHaveProperty('error');
  });
  it('asks a reason of 15 to 500 characters for an early delete (Q8)', () => {
    expect(policy.validateReason('  Wrong filter was used.  ')).toEqual({ reason: 'Wrong filter was used.' });
    expect(policy.validateReason('too short')).toEqual({ error: { code: 'INVALID_INPUT', message: 'Give a reason of 15 to 500 characters.' } });
    expect(policy.validateReason('x'.repeat(501))).toHaveProperty('error');
    expect(policy.validateReason(42)).toHaveProperty('error');
  });
  it('knows a report id', () => {
    expect(policy.isReportId('11111111-2222-4333-8444-555555555555')).toBe(true);
    expect(policy.isReportId('../x')).toBe(false);
    expect(policy.isReportId(1)).toBe(false);
  });
});

describe('the caps (Q6)', () => {
  it('keeps 200 reports per project: the oldest failed, expired or deleted one makes room, else REPORT_LIMIT', () => {
    const full = Array.from({ length: 200 }, (_, i) => entry(`r${i}`, 'DONE'));
    expect(policy.admit(full)).toEqual({ error: { code: 'REPORT_LIMIT', message: 'This project keeps 200 reports. A Jira administrator can delete one before a new one is made.' } });
    full[10] = entry('r10', 'EXPIRED');
    full[150] = entry('r150', 'FAILED');
    const admitted = policy.admit(full);
    expect('entries' in admitted && admitted.entries.map(e => e.reportId)).not.toContain('r150');
    expect('entries' in admitted && admitted.entries).toHaveLength(199);
    expect(policy.admit([entry('a', 'DONE')])).toEqual({ entries: [entry('a', 'DONE')] });
  });
  it('allows at most 3 queued jobs per project', () => {
    expect(policy.jobLimit([entry('a', 'QUEUED'), entry('b', 'QUEUED'), entry('c', 'RUNNING')])).toBeUndefined();
    expect(policy.jobLimit([entry('a', 'QUEUED'), entry('b', 'QUEUED'), entry('c', 'QUEUED')])).toEqual({ code: 'JOB_LIMIT', message: 'This project has 3 reports waiting. Try again when one is ready.' });
  });
  it('starts one job per project, the oldest queued first, and at most 10 on the site', () => {
    const index = [entry('new', 'QUEUED'), entry('old', 'QUEUED')];
    expect(policy.mayStart(index, 'old', 0)).toBe(true);
    expect(policy.mayStart(index, 'new', 0)).toBe(false);
    expect(policy.mayStart([entry('x', 'RUNNING'), ...index], 'old', 1)).toBe(false);
    expect(policy.mayStart(index, 'old', REPORT_LIMITS.runningPerSite)).toBe(false);
    expect(policy.mayStart([], 'any', 0)).toBe(true);
  });
  it('refuses a report above 250,000 changes or with a file above 50 MB', () => {
    expect(policy.tooLarge([50 * 1024 * 1024, 1], 250_000)).toBeUndefined();
    expect(policy.tooLarge([50 * 1024 * 1024 + 1], 1)).toMatchObject({ code: 'REPORT_TOO_LARGE' });
    expect(policy.tooLarge([], 250_001)?.message).toBe('The report would hold more than 250,000 changes or a file larger than 50 MB, so no file was stored. Make a report for a shorter range or with a field filter.');
  });
});

describe('job states (HLD 7.6)', () => {
  it.each([
    [undefined, 'QUEUED', true], [undefined, 'RUNNING', false], ['QUEUED', 'RUNNING', true], ['QUEUED', 'FAILED', true], ['QUEUED', 'DONE', false],
    ['RUNNING', 'DONE', true], ['RUNNING', 'FAILED', true], ['DONE', 'EXPIRED', true], ['DONE', 'DELETED', true], ['DONE', 'RUNNING', false],
    ['FAILED', 'QUEUED', false], ['EXPIRED', 'DONE', false], ['DELETED', 'DONE', false]
  ])('%s to %s is %s', (from, to, ok) => {
    expect(policy.canTransition(from as ReportState | undefined, to as ReportState)).toBe(ok);
  });
  it('calls a queued or running job stalled after 2 hours without progress', () => {
    const job = { state: 'RUNNING', updatedAt: '2026-11-08T09:59:00.000Z' } as ReportJob;
    expect(policy.stalled(job, NOW)).toBe(true);
    expect(policy.stalled({ ...job, updatedAt: '2026-11-08T10:01:00.000Z' }, NOW)).toBe(false);
    expect(policy.stalled({ ...job, state: 'DONE' }, NOW)).toBe(false);
    expect(policy.stalled({ ...job, state: 'QUEUED' }, NOW)).toBe(true);
  });
});

describe('schedule periods (UTC)', () => {
  const schedule = (o: Partial<ReportSchedule>): ReportSchedule => ({ scheduleId: 's', cadence: 'WEEKLY', filters: { fieldIds: [], actors: [] }, createdBy: 'pty_x', createdAt: '2026-10-21T15:00:00.000Z', ...o });
  it('makes weekly periods Monday 00:00 UTC to the next Monday, from the week the schedule was made', () => {
    expect(policy.duePeriods(schedule({}), NOW)).toEqual([
      { from: '2026-10-19T00:00:00.000Z', to: '2026-10-26T00:00:00.000Z' },
      { from: '2026-10-26T00:00:00.000Z', to: '2026-11-02T00:00:00.000Z' }
    ]);
    expect(policy.duePeriods(schedule({ lastPeriodEnd: '2026-11-02T00:00:00.000Z' }), NOW)).toEqual([]);
    expect(policy.duePeriods(schedule({ createdAt: '2026-11-02T00:00:00.000Z', lastPeriodEnd: '2026-11-02T00:00:00.000Z' }), new Date('2026-11-09T00:00:00.000Z'))).toHaveLength(1);
  });
  it('makes monthly periods calendar months, and at most 3 per run', () => {
    expect(policy.duePeriods(schedule({ cadence: 'MONTHLY', createdAt: '2026-10-21T00:00:00.000Z' }), NOW)).toEqual([{ from: '2026-10-01T00:00:00.000Z', to: '2026-11-01T00:00:00.000Z' }]);
    expect(policy.duePeriods(schedule({ cadence: 'MONTHLY', createdAt: '2025-12-31T00:00:00.000Z' }), NOW)).toEqual([
      { from: '2025-12-01T00:00:00.000Z', to: '2026-01-01T00:00:00.000Z' },
      { from: '2026-01-01T00:00:00.000Z', to: '2026-02-01T00:00:00.000Z' },
      { from: '2026-02-01T00:00:00.000Z', to: '2026-03-01T00:00:00.000Z' }
    ]);
    // A Sunday belongs to the week that began the Monday before.
    expect(policy.duePeriods(schedule({ createdAt: '2026-11-01T23:00:00.000Z' }), NOW)[0].from).toBe('2026-10-26T00:00:00.000Z');
  });
});

describe('retention (Q3)', () => {
  it('expires a DONE report retentionDays after it was finished; a shorter setting applies at once', () => {
    expect(policy.expiresAt('2026-01-01T00:00:00.000Z', 400)).toBe('2027-02-05T00:00:00.000Z');
    const index = [entry('old', 'DONE', { finishedAt: '2026-08-01T00:00:00.000Z' }), entry('new', 'DONE', { finishedAt: '2026-11-01T00:00:00.000Z' }), entry('gone', 'EXPIRED'), entry('nofinish', 'DONE', { createdAt: '2025-01-01T00:00:00.000Z' })];
    expect(policy.retentionDue(index, 400, NOW)).toEqual(['nofinish']);
    expect(policy.retentionDue(index, 90, NOW)).toEqual(['old', 'nofinish']);
  });
});

describe('download rule (spec v4 11.4)', () => {
  it('allows a viewer who sees every issue that still exists', () => {
    expect(policy.download({ total: 412, hidden: 0, deleted: 0, isTier1: false })).toEqual({ allowed: true });
  });
  it('refuses a viewer who cannot see an issue that exists, with the count', () => {
    expect(policy.download({ total: 412, hidden: 3, deleted: 0, isTier1: true })).toEqual({ allowed: false, code: 'NOT_ALL_VISIBLE', count: 3, message: NOT_ALL_VISIBLE_TEXT(3, 412) });
    expect(NOT_ALL_VISIBLE_TEXT(3, 412)).toBe('You cannot see 3 of the 412 issues in this report, so you cannot download it. Ask a project administrator, or make a new report: it will hold only the issues you can see.');
  });
  it('lets only Tier 1 download a report that holds a deleted issue', () => {
    expect(policy.download({ total: 5, hidden: 0, deleted: 1, isTier1: false })).toMatchObject({ allowed: false, code: 'FORBIDDEN', count: 1 });
    expect(policy.download({ total: 5, hidden: 0, deleted: 1, isTier1: true })).toEqual({ allowed: true });
  });
});
