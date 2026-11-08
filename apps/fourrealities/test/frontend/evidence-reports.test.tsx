/**
 * Copyright (c) 2026 Asymm Systems. All rights reserved.
 * @author Fahim Farook
 * FourRealities: the "Evidence reports" tab (HLD 8.1): the list, a new report, the download modal with
 * FileCard and useObjectStore, early deletion, schedules, the licence and signing notices, and the tab.
 */

import * as React from 'react';
// eslint-disable-next-line @typescript-eslint/no-var-requires
const TestRenderer = require('react-test-renderer');
const { act } = TestRenderer;
import { bridgeState, findAll, findButton, flatText, settle, textOf } from './forge-mocks';

const mockDownload = jest.fn();
jest.mock('@forge/react', () => {
  const base = require('./forge-mocks').reactMock();
  return new Proxy({}, { get: (_t, prop: string) => (prop === 'useObjectStore' ? () => ({ downloadObjects: (...a: unknown[]) => mockDownload(...a) }) : base[prop]) });
});
jest.mock('@forge/bridge', () => require('./forge-mocks').bridgeMock());

import { EvidenceReports } from '../../src/frontend/evidence-reports';
import { FourRealitiesApp } from '../../src/frontend/app';

const RID = '1a2b3c4d-0000-4000-8000-000000000000';
const DONE = {
  reportId: RID, state: 'DONE', range: { from: '2026-10-01T00:00:00.000Z', to: '2026-11-01T00:00:00.000Z' }, filters: { fieldIds: ['status'], actors: ['pty_a', 'pty_b'] },
  trigger: 'user', requestedBy: 'pty_a', requestedByText: 'by you', createdAt: 't', finishedAt: 't', bytes: 2048, reportSha256: 'abcdef0123456789abcdef', expiresAt: '2027-12-09T00:00:00.000Z',
  objectKeys: { 'manifest.json': `reports/1/${RID}/manifest.json`, 'report.json': `reports/1/${RID}/report.json`, 'report.csv': `reports/1/${RID}/report.csv` }
};
const VIEW = {
  ok: true, projectKey: 'PAY',
  reports: [DONE, { ...DONE, reportId: 'q', state: 'RUNNING', progress: { issuesTotal: 412, issuesDone: 312, changes: 0, linksNotRead: 0 }, objectKeys: undefined, reportSha256: undefined, bytes: undefined, expiresAt: undefined }, { ...DONE, reportId: 'e', state: 'EXPIRED', objectKeys: undefined, expiresAt: '2026-01-01T00:00:00.000Z' }],
  schedules: [{ scheduleId: 's1', cadence: 'WEEKLY', filters: { fieldIds: [], actors: [] }, createdBy: 'pty_a', createdAt: 't' }],
  tombstones: [{ reportId: '99999999-0000-4000-8000-000000000000', deletedAt: '2026-11-05T00:00:00.000Z', by: 'pty_a', reason: 'Made with a wrong filter.' }],
  canCreate: true, canSchedule: true, canDelete: true, licenceActive: true, retentionDays: 400, signingKeyId: 'fr-dev-2026-11',
  fields: [{ id: 'status', name: 'Status' }, { id: 'resolution', name: 'Resolution' }]
};
const DETAIL = { ok: true, report: DONE, download: { allowed: true }, fileNames: { 'report.json': 'f.json', 'report.csv': 'f.csv', 'manifest.json': 'f-manifest.json', 'people.json': 'f-people.json', 'people.csv': 'f-people.csv' } };

/** Answers the bridge by resolver name. */
function answer(map: Record<string, unknown>) {
  bridgeState.invoke.mockImplementation(async (name: string) => {
    const v = map[name];
    if (v instanceof Error) throw v;
    return typeof v === 'function' ? (v as () => unknown)() : v;
  });
}

/** The table rows as text, and the buttons in the Action cell of a row (DynamicTable cells are props, not children). */
const table = (r: any) => findAll(r.root, 'DynamicTable')[0].props.rows as Array<{ key: string; cells: Array<{ key: string; content: any }> }>;
const rowText = (r: any) => table(r).map(row => row.cells.map(c => (typeof c.content === 'string' ? c.content : flatText(c.content) || String(c.content?.props?.content ?? ''))).join(' | '));
function actionButton(r: any, rowIndex: number, label: string): any {
  const content = table(r)[rowIndex].cells.find(c => c.key === 'action')!.content;
  const children = React.Children.toArray(content.props.children) as any[];
  const button = children.find(b => flatText(b.props.children) === label);
  if (!button) throw new Error(`No ${label} in row ${rowIndex}`);
  return button;
}

const mounted: any[] = [];
afterEach(() => {
  // Unmounting clears the refresh timer of a list with a running report.
  for (const r of mounted.splice(0)) act(() => { r.unmount(); });
});

async function mount(): Promise<any> {
  let r: any;
  await act(async () => { r = TestRenderer.create(<EvidenceReports />); });
  mounted.push(r);
  await settle(act);
  return r;
}

beforeEach(() => {
  bridgeState.invoke.mockReset();
  mockDownload.mockReset();
});

describe('the list', () => {
  it('shows the retention, the signing key, the rows, the deleted reports, the schedules and how to check a report', async () => {
    answer({ getEvidenceReports: VIEW });
    const r = await mount();
    const text = textOf(r.toJSON());
    expect(findAll(r.root, 'PageHeader')[0]?.props.metaText ?? text).toContain('Reports are kept for 400 days. Signed with fr-dev-2026-11.');
    const rows = rowText(r);
    expect(rows[0]).toContain('1 Oct 2026 to 31 Oct 2026 | Status; 2 people | by you | Ready | 2.0 KB | abcdef012345');
    expect(rows[1]).toContain('Running 312 of 412 issues');
    expect(rows[2]).toContain('Expired');
    expect(rows[2]).toContain('1 Jan 2026');
    const sha = table(r)[0].cells.find(c => c.key === 'sha')!.content;
    expect(sha.props.content).toBe('abcdef0123456789abcdef');
    expect(table(r)[1].cells.find(c => c.key === 'sha')!.content).toBe('');
    expect(text).toContain('Made with a wrong filter.');
    expect(text).toContain('Weekly (Monday to Sunday, UTC): All fields');
    expect(text).toContain('not an administrative audit log');
    expect(findAll(r.root, 'CodeBlock')[0].props.text).toContain('verify-fourrealities-report.mjs');
    expect(text).not.toMatch(/tamper|compliant/i);
  });

  it('shows a warning when the list cannot be loaded, and the server message when it refuses', async () => {
    answer({ getEvidenceReports: new Error('down') });
    expect(textOf((await mount()).toJSON())).toContain('FourRealities could not load the evidence reports. Try again.');
    answer({ getEvidenceReports: { ok: false, error: { code: 'FORBIDDEN', message: 'You need Browse projects.' } } });
    expect(textOf((await mount()).toJSON())).toContain('You need Browse projects.');
    answer({ getEvidenceReports: undefined });
    expect(textOf((await mount()).toJSON())).toContain('could not load');
  });

  it('says when the licence is inactive or the report is not signed, and hides what the viewer may not do', async () => {
    answer({ getEvidenceReports: { ...VIEW, licenceActive: false, canCreate: false, canSchedule: false, canDelete: false, signingKeyId: null, tombstones: [], reports: [DONE] } });
    const r = await mount();
    const text = textOf(r.toJSON());
    expect(findAll(r.root, 'SectionMessage').map(m => m.props.title)).toContain('Licence not active');
    expect(text).toContain('no new reports are made. Existing reports can still be viewed and downloaded.');
    expect(text).toContain('This report is not signed');
    expect(() => findButton(r.root, 'New evidence report')).toThrow();
    expect(() => actionButton(r, 0, 'Delete')).toThrow();
    expect(actionButton(r, 0, 'Download')).toBeTruthy();
    expect(text).not.toContain('Add schedule');
  });
});

describe('a new report', () => {
  it('sends the range with the day after the To date, the fields and the people, then reloads', async () => {
    answer({ getEvidenceReports: VIEW, createEvidenceReport: { ok: true, reportId: 'x', state: 'QUEUED' } });
    const r = await mount();
    await act(async () => { findButton(r.root, 'New evidence report').props.onClick(); });
    expect(textOf(r.toJSON())).toContain('Free-text fields show that they changed, not the text.');
    const [from, to] = findAll(r.root, 'DatePicker');
    await act(async () => { from.props.onChange('2026-10-01'); to.props.onChange('2026-10-31'); });
    await act(async () => { findAll(r.root, 'Select', p => p.id === 'fr-report-fields')[0].props.onChange([{ value: 'status' }]); });
    await act(async () => { findAll(r.root, 'UserPicker', p => p.name === 'fr-report-people')[0].props.onChange([{ id: '712020:ana' }]); });
    await act(async () => { findButton(r.root, 'Make report').props.onClick(); });
    await settle(act);
    expect(bridgeState.invoke).toHaveBeenCalledWith('createEvidenceReport', { from: '2026-10-01', to: '2026-11-01', fieldIds: ['status'], actorAccountIds: ['712020:ana'] });
    expect(textOf(r.toJSON())).toContain('The report is queued.');
    expect(bridgeState.invoke.mock.calls.filter(c => c[0] === 'getEvidenceReports')).toHaveLength(2);
  });

  it('shows the server refusal and a failed call in the form, and closes on Cancel', async () => {
    answer({ getEvidenceReports: VIEW, createEvidenceReport: { ok: false, error: { code: 'TOO_MANY_ISSUES', message: 'More than 10,000 issues.' } } });
    const r = await mount();
    await act(async () => { findButton(r.root, 'New evidence report').props.onClick(); });
    const [from, to] = findAll(r.root, 'DatePicker');
    await act(async () => { from.props.onChange(''); from.props.onChange('2026-10-01'); to.props.onChange('2026-10-31'); });
    await act(async () => { findButton(r.root, 'Make report').props.onClick(); });
    expect(textOf(r.toJSON())).toContain('More than 10,000 issues.');
    answer({ getEvidenceReports: VIEW, createEvidenceReport: new Error('x') });
    await act(async () => { findButton(r.root, 'Make report').props.onClick(); });
    expect(textOf(r.toJSON())).toContain('FourRealities could not make the report. Try again.');
    await act(async () => { findAll(r.root, 'DatePicker')[1].props.onChange(undefined); });
    expect(findButton(r.root, 'Make report').props.isDisabled).toBe(true);
    await act(async () => { findButton(r.root, 'Cancel').props.onClick(); });
    expect(findAll(r.root, 'Modal')).toHaveLength(0);
  });
});

describe('the download modal', () => {
  it('offers four files and returns the Blob of useObjectStore to FileCard', async () => {
    answer({ getEvidenceReports: VIEW, getEvidenceReport: DETAIL });
    const blob = { size: 3 };
    mockDownload.mockResolvedValue([{ success: true, key: 'k', blob }]);
    const r = await mount();
    await act(async () => { actionButton(r, 0, 'Download').props.onClick(); });
    await settle(act);
    const cards = findAll(r.root, 'FileCard');
    expect(cards.map(c => c.props.fileName)).toEqual(['f.json', 'f.csv', 'f-manifest.json', 'f-people.csv']);
    expect(await cards[0].props.onDownload()).toBe(blob);
    expect(mockDownload).toHaveBeenCalledWith({ functionKey: 'generateReportDownloadUrls', keys: [`reports/1/${RID}/report.json`] });
    await cards[3].props.onDownload();
    expect(mockDownload).toHaveBeenLastCalledWith({ functionKey: 'generateReportDownloadUrls', keys: [`people:${RID}:csv`] });
    mockDownload.mockResolvedValue([]);
    await act(async () => { expect(await cards[1].props.onDownload()).toBeUndefined(); });
    expect(textOf(r.toJSON())).toContain('could not download this file');
    expect(textOf(r.toJSON())).toContain('The people file is not signed.');
    await act(async () => { findButton(r.root, 'Close').props.onClick(); });
    expect(findAll(r.root, 'FileCard')).toHaveLength(0);
  });

  it('says why a viewer cannot download, and shows a refusal or a failed load', async () => {
    answer({ getEvidenceReports: VIEW, getEvidenceReport: { ...DETAIL, download: { allowed: false, code: 'NOT_ALL_VISIBLE', message: 'You cannot see 3 of the 412 issues in this report, so you cannot download it.' } } });
    const r = await mount();
    await act(async () => { actionButton(r, 0, 'Download').props.onClick(); });
    await settle(act);
    expect(textOf(r.toJSON())).toContain('You cannot see 3 of the 412 issues');
    expect(findAll(r.root, 'FileCard')).toHaveLength(0);
    answer({ getEvidenceReports: VIEW, getEvidenceReport: { ok: false, error: { code: 'NOT_FOUND', message: 'No such report.' } } });
    const r2 = await mount();
    await act(async () => { actionButton(r2, 0, 'Download').props.onClick(); });
    await settle(act);
    expect(textOf(r2.toJSON())).toContain('No such report.');
    answer({ getEvidenceReports: VIEW, getEvidenceReport: new Error('x') });
    const r3 = await mount();
    await act(async () => { actionButton(r3, 0, 'Download').props.onClick(); });
    await settle(act);
    expect(findAll(r3.root, 'Spinner').length).toBeGreaterThan(0);
  });

  it('gives no key for a file the row does not name', async () => {
    answer({ getEvidenceReports: { ...VIEW, reports: [{ ...DONE, objectKeys: {} }] }, getEvidenceReport: DETAIL });
    const r = await mount();
    await act(async () => { actionButton(r, 0, 'Download').props.onClick(); });
    await settle(act);
    expect(await findAll(r.root, 'FileCard')[0].props.onDownload()).toBeUndefined();
    expect(mockDownload).not.toHaveBeenCalled();
  });
});

describe('early deletion', () => {
  it('asks a reason of at least 15 characters, deletes, and reloads', async () => {
    answer({ getEvidenceReports: VIEW, deleteEvidenceReport: { ok: true, tombstone: {} } });
    const r = await mount();
    await act(async () => { actionButton(r, 0, 'Delete').props.onClick(); });
    expect(textOf(r.toJSON())).toContain('A record of the deletion, with your reason, stays in their place');
    expect(findButton(r.root, 'Delete report').props.isDisabled).toBe(true);
    await act(async () => { findAll(r.root, 'Textfield')[0].props.onChange({ target: { value: 'Made with a wrong filter.' } }); });
    await act(async () => { findButton(r.root, 'Delete report').props.onClick(); });
    await settle(act);
    expect(bridgeState.invoke).toHaveBeenCalledWith('deleteEvidenceReport', { reportId: RID, reason: 'Made with a wrong filter.' });
    expect(textOf(r.toJSON())).toContain('The report was deleted.');
  });

  it('shows a refusal and a failed call, and closes on Cancel', async () => {
    answer({ getEvidenceReports: VIEW, deleteEvidenceReport: { ok: false, error: { code: 'FORBIDDEN', message: 'Only a Jira administrator can delete a report before it expires.' } } });
    const r = await mount();
    await act(async () => { actionButton(r, 0, 'Delete').props.onClick(); });
    await act(async () => { findAll(r.root, 'Textfield')[0].props.onChange({}); });
    await act(async () => { findButton(r.root, 'Delete report').props.onClick(); });
    expect(textOf(r.toJSON())).toContain('Only a Jira administrator');
    answer({ getEvidenceReports: VIEW, deleteEvidenceReport: new Error('x') });
    await act(async () => { findButton(r.root, 'Delete report').props.onClick(); });
    expect(textOf(r.toJSON())).toContain('FourRealities could not delete the report.');
    await act(async () => { findButton(r.root, 'Cancel').props.onClick(); });
    expect(findAll(r.root, 'Modal')).toHaveLength(0);
  });
});

describe('schedules', () => {
  it('adds and removes a schedule, and shows a refusal or a failed call', async () => {
    answer({ getEvidenceReports: VIEW, saveReportSchedule: { ok: true, schedules: [...VIEW.schedules, { scheduleId: 's2', cadence: 'MONTHLY', filters: { fieldIds: ['status'], actors: [] }, createdBy: 'pty_a', createdAt: 't', lastPeriodEnd: '2026-11-01T00:00:00.000Z' }] }, deleteReportSchedule: { ok: true, schedules: [] } });
    const r = await mount();
    await act(async () => { findAll(r.root, 'Select', p => p.id === 'fr-schedule-cadence')[0].props.onChange({ value: 'MONTHLY' }); });
    await act(async () => { findAll(r.root, 'Select', p => p.id === 'fr-schedule-cadence')[0].props.onChange(null); });
    await act(async () => { findAll(r.root, 'Select', p => p.id === 'fr-schedule-fields')[0].props.onChange([{ value: 'status' }]); });
    await act(async () => { findAll(r.root, 'UserPicker', p => p.name === 'fr-schedule-people')[0].props.onChange({ accountId: '712020:bo' }); });
    await act(async () => { findButton(r.root, 'Add schedule').props.onClick(); });
    expect(bridgeState.invoke).toHaveBeenCalledWith('saveReportSchedule', { cadence: 'MONTHLY', fieldIds: ['status'], actorAccountIds: ['712020:bo'] });
    expect(textOf(r.toJSON())).toContain('Monthly (calendar month, UTC): Status; last period ended 31 Oct 2026');
    expect(textOf(r.toJSON())).toContain('Schedule added.');
    await act(async () => { findButton(r.root, 'Remove').props.onClick(); });
    expect(bridgeState.invoke).toHaveBeenCalledWith('deleteReportSchedule', { scheduleId: 's1' });
    expect(textOf(r.toJSON())).toContain('No schedules.');
    answer({ getEvidenceReports: VIEW, saveReportSchedule: { ok: false, error: { code: 'FORBIDDEN', message: 'Only a project administrator.' } } });
    await act(async () => { findButton(r.root, 'Add schedule').props.onClick(); });
    expect(textOf(r.toJSON())).toContain('Only a project administrator.');
    answer({ getEvidenceReports: VIEW, saveReportSchedule: new Error('x') });
    await act(async () => { findButton(r.root, 'Add schedule').props.onClick(); });
    expect(textOf(r.toJSON())).toContain('FourRealities could not save the schedule.');
  });
});

describe('the project page tabs', () => {
  it('shows the dashboard first and loads the reports only when their tab is opened', async () => {
    bridgeState.context = { extension: { project: { key: 'PAY' } }, accountId: 'acc' };
    const dashboard = { ok: true, projectKey: 'PAY', generatedAt: '2026-11-08T00:00:00.000Z', summary: { totalIssues: 0, ratedIssues: 0, unratedIssues: 0, averageRAI: null, gates: { intent: { found: 0, missing: 0, reported: 0, excepted: 0, recheck: 0, notApplicable: 0 }, process: { found: 0, missing: 0, reported: 0, excepted: 0, recheck: 0, notApplicable: 0 }, code: { found: 0, missing: 0, reported: 0, excepted: 0, recheck: 0, notApplicable: 0 }, audit: { found: 0, missing: 0, reported: 0, excepted: 0, recheck: 0, notApplicable: 0 } }, m11IntentRate: null, m29PullRequestRate: null, m30ReworkRate: null, dodRate: null, sealRate: null, startedIssues: 0, reworkIssues: 0, riskDistribution: { low: 0, medium: 0, high: 0, critical: 0, unrated: 0 } }, rows: [], trend: [], coverage: { shown: 0, totalKnown: 0, capped: false } };
    answer({ getProjectDashboard: dashboard, getEvidenceReports: VIEW });
    let r: any;
    await act(async () => { r = TestRenderer.create(<FourRealitiesApp />); });
    mounted.push(r);
    await settle(act);
    expect(findAll(r.root, 'Tab').map(t => textOf(t.props.children))).toEqual(['Dashboard', 'Evidence reports']);
    expect(bridgeState.invoke.mock.calls.map(c => c[0])).not.toContain('getEvidenceReports');
    await act(async () => { findAll(r.root, 'Tabs')[0].props.onChange(1); });
    await settle(act);
    expect(bridgeState.invoke.mock.calls.map(c => c[0])).toContain('getEvidenceReports');
    bridgeState.context = {};
  });
});

describe('review round 2: issues not in the report (N-1)', () => {
  it('shows a badge with the count on the row and a notice in the download modal', async () => {
    answer({ getEvidenceReports: { ...VIEW, reports: [{ ...DONE, notReadable: 3 }, { ...DONE, reportId: 'one', notReadable: 1 }] }, getEvidenceReport: { ...DETAIL, notReadable: [{ issueId: '7', issueKey: 'PAY-7', reason: 'MOVED' }, { issueId: '8', issueKey: '', reason: 'NOT_READABLE' }] } });
    const r = await mount();
    const state = table(r)[0].cells.find(c => c.key === 'state')!.content;
    const badges = React.Children.toArray(state.props.children) as any[];
    expect(badges.map(b => flatText(b.props.children))).toEqual(['Ready', '3 issues not in report']);
    expect(badges[1].props.appearance).toBe('moved');
    const single = table(r)[1].cells.find(c => c.key === 'state')!.content;
    expect(flatText((React.Children.toArray(single.props.children) as any[])[1].props.children)).toBe('1 issue not in report');
    await act(async () => { actionButton(r, 0, 'Download').props.onClick(); });
    await settle(act);
    expect(textOf(r.toJSON())).toContain('3 issues of the scope are not in this report');
    expect(textOf(r.toJSON())).toContain('PAY-7 (id 7): moved to another project before the report was made.');
    expect(textOf(r.toJSON())).toContain('Issue id 8: FourRealities could not read it when the report was made');
    expect(findAll(r.root, 'SectionMessage').map(m => m.props.title)).toContain('Not every issue is in this report');
  });
});

describe('review round 3', () => {
  it('R4-3: pages through every missing issue, asking the server for each page', async () => {
    const all = Array.from({ length: 120 }, (_, i) => ({ issueId: String(i + 1), issueKey: `PAY-${i + 1}`, reason: 'NOT_READABLE' }));
    bridgeState.invoke.mockImplementation(async (name: string, payload: { notReadPage?: number }) => {
      if (name === 'getEvidenceReports') return { ...VIEW, reports: [{ ...DONE, notReadable: 120 }] };
      const p = payload?.notReadPage || 0;
      return { ...DETAIL, notReadable: all.slice(p * 50, p * 50 + 50), notReadablePage: { page: p, pageSize: 50, total: 120 } };
    });
    const r = await mount();
    await act(async () => { actionButton(r, 0, 'Download').props.onClick(); });
    await settle(act);
    expect(textOf(r.toJSON())).toContain('Issues 1 to 50 of 120');
    expect(textOf(r.toJSON())).toContain('PAY-50 (id 50)');
    expect(findButton(r.root, 'Previous').props.isDisabled).toBe(true);
    await act(async () => { findButton(r.root, 'Next').props.onClick(); });
    await settle(act);
    expect(bridgeState.invoke).toHaveBeenLastCalledWith('getEvidenceReport', { reportId: RID, notReadPage: 1 });
    expect(textOf(r.toJSON())).toContain('Issues 51 to 100 of 120');
    await act(async () => { findButton(r.root, 'Next').props.onClick(); });
    await settle(act);
    expect(textOf(r.toJSON())).toContain('Issues 101 to 120 of 120');
    expect(textOf(r.toJSON())).toContain('PAY-120 (id 120)');
    expect(findButton(r.root, 'Next').props.isDisabled).toBe(true);
    await act(async () => { findButton(r.root, 'Previous').props.onClick(); });
    await settle(act);
    expect(textOf(r.toJSON())).toContain('Issues 51 to 100 of 120');
  });

  it('R4-3: shows no paging controls when every missing issue fits on one page', async () => {
    answer({ getEvidenceReports: { ...VIEW, reports: [{ ...DONE, notReadable: 2 }] }, getEvidenceReport: { ...DETAIL, notReadable: [{ issueId: '1', issueKey: 'PAY-1', reason: 'MOVED' }, { issueId: '2', issueKey: 'PAY-2', reason: 'MOVED' }], notReadablePage: { page: 0, pageSize: 50, total: 2 } } });
    const r = await mount();
    await act(async () => { actionButton(r, 0, 'Download').props.onClick(); });
    await settle(act);
    expect(textOf(r.toJSON())).toContain('PAY-2 (id 2)');
    expect(() => findButton(r.root, 'Next')).toThrow();
  });

  it('R3-5: says why no report can be made, and offers no button', async () => {
    answer({ getEvidenceReports: { ...VIEW, canCreate: false, signingKeyId: null, cannotCreateReason: 'FourRealities has no valid signing key for this production site, so it makes no report.' } });
    const r = await mount();
    expect(findAll(r.root, 'SectionMessage').map(m => m.props.title)).toContain('No reports can be made on this site');
    expect(textOf(r.toJSON())).toContain('no valid signing key for this production site');
    expect(() => findButton(r.root, 'New evidence report')).toThrow();
  });
});

