/**
 * Copyright (c) 2026 Asymm Systems. All rights reserved.
 * @author Fahim Farook
 * FourRealities: the words of the evidence reports (HLD 8, owner decision Q7): periods, filters, sizes, states,
 * the form payload, and no word the listing must not use for a report.
 */

import * as fs from 'fs';
import * as path from 'path';
import {
  createPayload, dateText, filtersText, newReportNote, periodText, pickedAccountIds, pickedValues, retentionText, scheduleLine, shortHash, signingText, sizeText, stateOf
} from '../../src/ui/report-text';
import { ReportListRow } from '../../src/contract/data/reports';
import { withoutComments } from '../support/console-rule';

const row = (o: Partial<ReportListRow>): ReportListRow => ({ reportId: 'r', state: 'DONE', range: { from: 'a', to: 'b' }, filters: { fieldIds: [], actors: [] }, trigger: 'user', requestedBy: 'x', requestedByText: 'by you', createdAt: 't', ...o });

describe('report words', () => {
  it('writes dates and periods in UTC, the last day shown being the day before the exclusive end', () => {
    expect(dateText('2026-10-01T00:00:00.000Z')).toBe('1 Oct 2026');
    expect(periodText({ from: '2026-10-01T00:00:00.000Z', to: '2026-11-01T00:00:00.000Z' })).toBe('1 Oct 2026 to 31 Oct 2026');
  });
  it('names the filters, the size and the short hash', () => {
    const fields = [{ id: 'status', name: 'Status' }];
    expect(filtersText({ fieldIds: [], actors: [] }, fields)).toBe('All fields');
    expect(filtersText({ fieldIds: ['status', 'resolution'], actors: ['p'] }, fields)).toBe('Status, resolution; 1 person');
    expect(filtersText({ fieldIds: [], actors: ['p', 'q'] }, fields)).toBe('All fields; 2 people');
    expect([sizeText(undefined), sizeText(512), sizeText(2048), sizeText(5 * 1024 * 1024)]).toEqual(['', '512 bytes', '2.0 KB', '5.0 MB']);
    expect([shortHash(undefined), shortHash('0123456789abcdef')]).toEqual(['', '0123456789ab']);
  });
  it('gives each state its words and lozenge', () => {
    expect(stateOf(row({ state: 'QUEUED' }))).toEqual({ text: 'Queued', appearance: 'new' });
    expect(stateOf(row({ state: 'RUNNING' }))).toEqual({ text: 'Running', appearance: 'inprogress' });
    expect(stateOf(row({ state: 'DONE', unsigned: true })).text).toBe('Ready, not signed');
    expect(stateOf(row({ state: 'FAILED' })).text).toBe('Failed: unknown reason');
    expect(stateOf(row({ state: 'FAILED', error: { code: 'X', message: 'Too large.' } })).text).toBe('Failed: Too large.');
    expect(stateOf(row({ state: 'EXPIRED' })).appearance).toBe('default');
    expect(stateOf(row({ state: 'DELETED' }))).toEqual({ text: 'Deleted', appearance: 'moved' });
  });
  it('writes the retention, signing and form notes', () => {
    expect(retentionText(400)).toBe('Reports are kept for 400 days.');
    expect(signingText('fr-prod-2026-11')).toBe('Signed with fr-prod-2026-11.');
    expect(newReportNote(new Date('2026-11-04T10:00:00.000Z'), 400)).toBe('The report holds every change in the range that you can see. It is kept until 9 Dec 2027. Free-text fields show that they changed, not the text.');
    expect(scheduleLine({ scheduleId: 's', cadence: 'MONTHLY', filters: { fieldIds: [], actors: [] }, createdBy: 'p', createdAt: 't' }, [])).toBe('Monthly (calendar month, UTC): All fields');
  });
  it('builds the create payload and reads picker values', () => {
    expect(createPayload({ from: '2026-10-01', to: '2026-10-31', fieldIds: ['status'], people: ['a'] })).toEqual({ from: '2026-10-01', to: '2026-11-01', fieldIds: ['status'], actorAccountIds: ['a'] });
    expect(createPayload({ from: '', to: '', fieldIds: [], people: [] }).to).toBe('');
    expect(pickedAccountIds(undefined)).toEqual([]);
    expect(pickedAccountIds('acc')).toEqual(['acc']);
    expect(pickedAccountIds([{ id: 'a' }, { accountId: 'b' }, {}])).toEqual(['a', 'b']);
    expect(pickedValues(null)).toEqual([]);
    expect(pickedValues({ value: 'x' })).toEqual(['x']);
    expect(pickedValues([{ value: 'x' }, {}])).toEqual(['x']);
  });
  it('never calls a report an audit log, tamper-proof, tamper-evident or compliant (HLD 8.3)', () => {
    const src = path.join(__dirname, '..', '..', 'src');
    for (const f of ['ui/report-text.ts', 'frontend/evidence-reports.tsx', 'frontend/report-settings.tsx']) {
      const text = withoutComments(fs.readFileSync(path.join(src, f), 'utf8')).replace(/is not an administrative audit log: Jira\\?.s audit log/g, '').replace(/Jira\\?.s own history and audit log/g, '');
      expect(text).not.toMatch(/audit log|tamper-proof|tamper-evident|compliant/i);
    }
  });
});
