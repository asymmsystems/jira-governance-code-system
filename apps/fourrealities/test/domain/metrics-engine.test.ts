/**
 * Copyright (c) 2026 Asymm Systems. All rights reserved.
 * @author Fahim Farook
 * FourRealities: MetricsEngine unit tests (spec v2, Metrics)
 */

import { DefaultMetricsEngine } from '../../src/engine/default-metrics-engine';
import { evaluateGates } from '../../src/engine/default-gate-engine';

const MetricsEngine = new DefaultMetricsEngine();
import { EXCEPTED, FOUND_V, MISSING, NA, RECHECK, gates, makeFacts } from './fixtures';

describe('MetricsEngine.rai and risk', () => {
  it('scores only FOUND and MISSING gates', () => {
    expect(MetricsEngine.rai(gates(FOUND_V, FOUND_V, FOUND_V, FOUND_V))).toBe(100);
    expect(MetricsEngine.rai(gates(FOUND_V, MISSING, NA, NA))).toBe(50);
    expect(MetricsEngine.rai(gates(FOUND_V, MISSING, MISSING, NA))).toBe(33);
  });

  it('never counts EXCEPTED, NEEDS_RECHECK or NOT_APPLICABLE as pass or fail', () => {
    expect(MetricsEngine.rai(gates(MISSING, EXCEPTED, RECHECK, NA))).toBe(0);
    expect(MetricsEngine.rai(gates(FOUND_V, EXCEPTED, RECHECK, NA))).toBe(100);
  });

  it('is null (UNRATED) when no gate is scored', () => {
    expect(MetricsEngine.rai(gates(NA, NA, EXCEPTED, RECHECK))).toBeNull();
    expect(MetricsEngine.risk(null)).toBe('UNRATED');
  });

  it('maps RAI to risk bands', () => {
    expect(MetricsEngine.risk(49)).toBe('CRITICAL');
    expect(MetricsEngine.risk(50)).toBe('HIGH');
    expect(MetricsEngine.risk(69)).toBe('HIGH');
    expect(MetricsEngine.risk(70)).toBe('MEDIUM');
    expect(MetricsEngine.risk(84)).toBe('MEDIUM');
    expect(MetricsEngine.risk(85)).toBe('LOW');
  });
});

describe('MetricsEngine.recoverablePoints', () => {
  it('recomputes RAI with the first missing gate found', () => {
    // Intent missing, Process found: 50 now, 100 after the fix.
    expect(MetricsEngine.recoverablePoints(gates(MISSING, FOUND_V, NA, NA))).toBe(50);
    // Four gates, one found: 25 now, 50 after fixing Intent.
    expect(MetricsEngine.recoverablePoints(gates(MISSING, MISSING, MISSING, FOUND_V))).toBe(25);
  });

  it('is 0 when nothing is missing or nothing is rated', () => {
    expect(MetricsEngine.recoverablePoints(gates(FOUND_V, FOUND_V, NA, NA))).toBe(0);
    expect(MetricsEngine.recoverablePoints(gates(NA, NA, NA, NA))).toBe(0);
  });
});

describe('MetricsEngine.buildRow', () => {
  it('builds a row with gates, RAI, risk and applicable count', () => {
    const row = MetricsEngine.buildRow(makeFacts(), gates(FOUND_V, MISSING, NA, MISSING));
    expect(row.rai).toBe(33);
    expect(row.risk).toBe('CRITICAL');
    expect(row.applicableGates).toBe(3);
    expect(row.recoverablePoints).toBe(34);
    expect(row.started).toBe(true);
  });

  it('truncates long summaries to 120 characters', () => {
    const row = MetricsEngine.buildRow(makeFacts({ summary: 'x'.repeat(200) }), evaluateGates(makeFacts()));
    expect(row.summary.length).toBe(120);
    expect(row.summary.endsWith('...')).toBe(true);
  });

  it('carries the exception and rework notes', () => {
    const note = { reason: 'Configuration change only', recordedBy: 'acc-1', recordedAt: '2026-11-01T00:00:00Z' };
    const facts = makeFacts({ exception: { schemaVersion: 2, issueId: '1', issueKey: 'A-1', code: note, rework: note } });
    const row = MetricsEngine.buildRow(facts, evaluateGates(facts));
    expect(row.exception).toEqual(note);
    expect(row.reworkNote).toEqual(note);
  });

  it('builds an UNRATED row for an unstarted issue', () => {
    const facts = makeFacts({ statusCategory: 'new', statusChanges: 0, devField: { present: false, summary: { count: 0, state: null, openCount: 0, mergedCount: 0, declinedCount: 0 } } });
    const row = MetricsEngine.buildRow(facts, evaluateGates(facts));
    expect(row.rai).toBeNull();
    expect(row.risk).toBe('UNRATED');
    expect(row.started).toBe(false);
  });
});

describe('MetricsEngine.summarize', () => {
  it('returns null rates and averages for an empty project', () => {
    const s = MetricsEngine.summarize([]);
    expect(s.totalIssues).toBe(0);
    expect(s.averageRAI).toBeNull();
    expect(s.m11IntentRate).toBeNull();
    expect(s.m29PullRequestRate).toBeNull();
    expect(s.m30ReworkRate).toBeNull();
    expect(s.dodRate).toBeNull();
    expect(s.sealRate).toBeNull();
  });

  it('counts each gate state and divides rates by FOUND plus MISSING', () => {
    const rows = [
      MetricsEngine.buildRow(makeFacts({ issueKey: 'A-1' }), gates(FOUND_V, FOUND_V, EXCEPTED, MISSING)),
      MetricsEngine.buildRow(makeFacts({ issueKey: 'A-2', reworkLoops: 2 }), gates(MISSING, MISSING, FOUND_V, RECHECK)),
      MetricsEngine.buildRow(makeFacts({ issueKey: 'A-3', statusCategory: 'new', statusChanges: 0 }), gates(NA, NA, NA, NA))
    ];
    const s = MetricsEngine.summarize(rows);
    expect(s.gates.intent).toEqual({ found: 1, missing: 1, excepted: 0, recheck: 0, notApplicable: 1 });
    expect(s.gates.code).toEqual({ found: 1, missing: 0, excepted: 1, recheck: 0, notApplicable: 1 });
    expect(s.gates.audit).toEqual({ found: 0, missing: 1, excepted: 0, recheck: 1, notApplicable: 1 });
    expect(s.m11IntentRate).toBe(50);
    expect(s.m29PullRequestRate).toBe(100);
    expect(s.sealRate).toBe(0);
    expect(s.ratedIssues).toBe(2);
    expect(s.unratedIssues).toBe(1);
    expect(s.averageRAI).toBe(Math.round((67 + 33) / 2));
    expect(s.startedIssues).toBe(2);
    expect(s.reworkIssues).toBe(1);
    expect(s.m30ReworkRate).toBe(50);
    expect(s.riskDistribution.unrated).toBe(1);
  });
});

describe('B-06: an excepted Code gate is outside RAI and M29', () => {
  it('removes the excepted gate from the RAI average and from the M29 numerator and denominator', () => {
    const row = MetricsEngine.buildRow(makeFacts(), gates(FOUND_V, MISSING, EXCEPTED, NA));
    expect(row.rai).toBe(50);
    const s = MetricsEngine.summarize([row]);
    expect(s.gates.code.excepted).toBe(1);
    expect(s.m29PullRequestRate).toBeNull();
  });
});

describe('B-14: UNRATED issues, denominators and recoverable points', () => {
  it('FR-14 case: 80 unstarted and 20 poor Done issues average the rated issues only', () => {
    const unstarted = Array.from({ length: 80 }, (_, i) =>
      MetricsEngine.buildRow(makeFacts({ issueKey: `U-${i}`, statusCategory: 'new', statusChanges: 0 }), gates(NA, NA, NA, NA)));
    const poor = Array.from({ length: 20 }, (_, i) =>
      MetricsEngine.buildRow(makeFacts({ issueKey: `P-${i}` }), gates(FOUND_V, MISSING, MISSING, MISSING)));
    const s = MetricsEngine.summarize([...unstarted, ...poor]);
    expect(s.averageRAI).toBe(25);
    expect(s.unratedIssues).toBe(80);
    expect(s.ratedIssues).toBe(20);
    expect(s.riskDistribution.unrated).toBe(80);
    expect(s.riskDistribution.low).toBe(0);
  });

  it('FR-17 case: Intent missing and Process found gives RAI 50 and 50 recoverable points', () => {
    const row = MetricsEngine.buildRow(makeFacts({ statusCategory: 'indeterminate' }), gates(MISSING, FOUND_V, NA, NA));
    expect(row.rai).toBe(50);
    expect(row.recoverablePoints).toBe(50);
  });

  it('divides each rate by the issues where the gate applies', () => {
    const rows = [
      MetricsEngine.buildRow(makeFacts({ issueKey: 'A' }), gates(FOUND_V, NA, NA, NA)),
      MetricsEngine.buildRow(makeFacts({ issueKey: 'B' }), gates(MISSING, NA, NA, NA)),
      MetricsEngine.buildRow(makeFacts({ issueKey: 'C', statusCategory: 'new', statusChanges: 0 }), gates(NA, NA, NA, NA))
    ];
    const s = MetricsEngine.summarize(rows);
    expect(s.m11IntentRate).toBe(50);
    expect(s.dodRate).toBeNull();
    expect(s.sealRate).toBeNull();
  });
});
