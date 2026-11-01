/**
 * Copyright (c) 2026 Asymm Systems. All rights reserved.
 * @author Fahim Farook
 * FourRealities: Snapshot and Policy Engine unit tests (plain inputs, no platform mocks)
 */

import { DefaultSnapshotEngine } from '../../src/engine/default-snapshot-engine';
import { DefaultPolicyEngine } from '../../src/engine/default-policy-engine';
import { DefaultMetricsEngine } from '../../src/engine/default-metrics-engine';
import { evaluateGates } from '../../src/engine/default-gate-engine';
import { SnapshotMeta } from '../../src/contract/data/models';
import { makeFacts, FOUND_V, NA, RECHECK, gates } from '../domain/fixtures';

const snapshot = new DefaultSnapshotEngine();
const policy = new DefaultPolicyEngine();
const metrics = new DefaultMetricsEngine();

describe('DefaultSnapshotEngine', () => {
  it('is an Engine', () => {
    expect(snapshot.serviceType).toBe('engine');
    expect(policy.serviceType).toBe('engine');
  });

  it('gives the Monday of the ISO week', () => {
    expect(snapshot.weekStartOf('2026-11-01T10:00:00.000Z')).toBe('2026-10-26');
  });

  it('builds a trend point from a summary', () => {
    const f = makeFacts();
    const summary = metrics.summarize([metrics.buildRow(f, gates(FOUND_V, NA, NA, NA))]);
    expect(snapshot.trendPoint(summary, '2026-11-01T10:00:00.000Z')).toEqual(expect.objectContaining({
      weekStart: '2026-10-26', ratedIssues: 1, averageRAI: 100, gates: expect.objectContaining({ intent: { found: 1, missing: 0 } })
    }));
  });

  it('keeps the previous Intent result only when links were not read and it was not a re-check', () => {
    const now = gates(RECHECK, NA, NA, NA);
    const before = metrics.buildRow(makeFacts(), gates(FOUND_V, NA, NA, NA));
    expect(snapshot.keepPreviousIntent(now, false, before).intent).toEqual(FOUND_V);
    expect(snapshot.keepPreviousIntent(now, true, before).intent).toEqual(RECHECK);
    expect(snapshot.keepPreviousIntent(now, false, undefined).intent).toEqual(RECHECK);
    expect(snapshot.keepPreviousIntent(now, false, metrics.buildRow(makeFacts(), now)).intent).toEqual(RECHECK);
  });

  it('filters rows to visible ids and warns on a stale snapshot', () => {
    const f = makeFacts();
    const rows = [metrics.buildRow({ ...f, issueId: 'a' }, evaluateGates(f)), metrics.buildRow({ ...f, issueId: 'b' }, evaluateGates(f))];
    expect(snapshot.visibleRows(rows, new Set(['b'])).map(r => r.issueId)).toEqual(['b']);
    const meta = { generatedAt: '2026-10-20T00:00:00.000Z' } as SnapshotMeta;
    expect(snapshot.staleWarning(meta, Date.parse('2026-10-28T00:00:01.000Z'))).toBe('Snapshot read on 2026-10-20 is more than 7 days old. Refresh to read Jira again.');
    expect(snapshot.staleWarning(meta, Date.parse('2026-10-21T00:00:00.000Z'))).toBeUndefined();
  });
});

describe('DefaultPolicyEngine', () => {
  it('applies the scope rule for an issue view and a project page', () => {
    expect(policy.scopeError({ issueId: '1' }, { issueId: '1' })).toBeUndefined();
    expect(policy.scopeError({ issueId: '2' }, { issueId: '1' })).toBe('Unauthorized: issue is outside this issue view.');
    expect(policy.scopeError({ issueId: '2' }, {})).toBe('Forbidden: no Jira project or issue context.');
    expect(policy.scopeError({ issueId: '2', projectKey: 'DEMO' }, { projectKey: 'DEMO' })).toBeUndefined();
    expect(policy.scopeError({ issueId: '2', issueKey: 'TEST-2', projectKey: 'TEST' }, { projectKey: 'DEMO' })).toBe('Forbidden: issue TEST-2 is not in project DEMO.');
    expect(policy.scopeError({ issueId: '2', projectKey: 'TEST' }, { projectKey: 'DEMO' })).toBe('Forbidden: issue 2 is not in project DEMO.');
  });

  it('validates link and exception input', () => {
    expect(policy.linkInputError('ftp://x', 't')).toBe('Invalid URL protocol. HTTP or HTTPS required.');
    expect(policy.linkInputError('nope', 't')).toBe('Invalid specification URL provided.');
    expect(policy.linkInputError('https://x', '')).toBe('Document title or ADR identifier required.');
    expect(policy.linkInputError('https://x', 't')).toBeUndefined();
    expect(policy.exceptionInputError('')).toBe('Exception reason required.');
    expect(policy.exceptionInputError('too short')).toBe('Give a reason of 15 to 500 characters.');
    expect(policy.exceptionInputError('Configuration change only', 'n'.repeat(1001))).toBe('Notes can be at most 1,000 characters.');
    expect(policy.exceptionInputError('Configuration change only', 'ok')).toBeUndefined();
  });

  it('merges notes', () => {
    const n = (r: string) => ({ reason: r, recordedBy: 'u', recordedAt: 't' });
    const first = policy.mergeException(undefined, { issueId: '1', issueKey: 'A-1' }, 'CODE', n('code reason'));
    const second = policy.mergeException(first, { issueId: '1', issueKey: 'A-1' }, 'REWORK', n('rework reason'));
    expect(second).toEqual({ schemaVersion: 2, issueId: '1', issueKey: 'A-1', code: n('code reason'), rework: n('rework reason') });
    expect(policy.mergeException(second, { issueId: '1', issueKey: 'A-1' }, 'CODE', n('new code')).code).toEqual(n('new code'));
  });
});
