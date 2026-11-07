/**
 * Copyright (c) 2026 Asymm Systems. All rights reserved.
 * @author Fahim Farook
 * FourRealities: the reports list refreshes itself while a report is queued or running (live check of 7.7.0:
 * the row stayed "Queued" until a page reload), shows today as the date placeholder, and shows a schedule's
 * refusal. The refresh wait is shortened here; its real values are tested in test/ui/save-file.test.ts.
 */

import * as React from 'react';
// eslint-disable-next-line @typescript-eslint/no-var-requires
const TestRenderer = require('react-test-renderer');
const { act } = TestRenderer;
import { bridgeState, findAll, findButton, settle, textOf } from './forge-mocks';

jest.mock('@forge/react', () => {
  const base = require('./forge-mocks').reactMock();
  return new Proxy({}, { get: (_t, prop: string) => (prop === 'useObjectStore' ? () => ({ downloadObjects: jest.fn() }) : base[prop]) });
});
jest.mock('@forge/bridge', () => require('./forge-mocks').bridgeMock());
jest.mock('../../src/ui/report-text', () => ({ ...jest.requireActual('../../src/ui/report-text'), pollDelayMs: (n: number) => (n < 2 ? 5 : null) }));

import { EvidenceReports } from '../../src/frontend/evidence-reports';

const row = (state: string) => ({ reportId: 'r', state, range: { from: '2026-10-01T00:00:00.000Z', to: '2026-11-01T00:00:00.000Z' }, filters: { fieldIds: [], actors: [] }, trigger: 'user', requestedBy: 'p', requestedByText: 'by you', createdAt: 't' });
const view = (state: string, extra: Record<string, unknown> = {}) => ({ ok: true, projectKey: 'PAY', reports: [row(state)], schedules: [], tombstones: [], canCreate: true, canSchedule: true, canDelete: false, licenceActive: true, retentionDays: 400, signingKeyId: 'k', fields: [], ...extra });
const wait = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

describe('the reports list refresh', () => {
  beforeEach(() => bridgeState.invoke.mockReset());

  it('reads the list again while a report is queued, until it is ready, and then stops', async () => {
    const answers = [view('QUEUED'), view('RUNNING'), view('DONE')];
    bridgeState.invoke.mockImplementation(async () => answers.shift() || view('DONE'));
    let r: any;
    await act(async () => { r = TestRenderer.create(<EvidenceReports />); });
    await act(async () => { await wait(40); });
    await settle(act);
    expect(bridgeState.invoke.mock.calls.filter(c => c[0] === 'getEvidenceReports').length).toBe(3);
    expect(findAll(r.root, 'DynamicTable')[0].props.rows[0].cells.find((c: any) => c.key === 'state').content.props.children).toBe('Ready');
    await act(async () => { await wait(30); });
    expect(bridgeState.invoke.mock.calls.filter(c => c[0] === 'getEvidenceReports').length).toBe(3);
    act(() => { r.unmount(); });
  });

  it('stops after the cap, keeps the list when a refresh fails, and shows today and a schedule refusal', async () => {
    let calls = 0;
    const refused = { scheduleId: 's', cadence: 'MONTHLY', filters: { fieldIds: [], actors: [] }, createdBy: 'p', createdAt: 't', lastRefusal: { code: 'JIRA_ERROR', message: 'Jira did not answer.', at: 't', range: { from: '2026-10-01T00:00:00.000Z', to: '2026-11-01T00:00:00.000Z' } } };
    bridgeState.invoke.mockImplementation(async () => {
      calls++;
      if (calls === 2) throw new Error('x');
      return view('RUNNING', { schedules: [refused] });
    });
    let r: any;
    await act(async () => { r = TestRenderer.create(<EvidenceReports />); });
    await act(async () => { await wait(60); });
    await settle(act);
    expect(calls).toBe(3);
    expect(textOf(r.toJSON())).toContain('The report for 1 Oct 2026 to 31 Oct 2026 is not made yet: Jira did not answer.');
    await act(async () => { findButton(r.root, 'New evidence report').props.onClick(); });
    expect(findAll(r.root, 'DatePicker').map(d => d.props.placeholder)).toEqual([new Date().toISOString().slice(0, 10), new Date().toISOString().slice(0, 10)]);
    act(() => { r.unmount(); });
  });
});
