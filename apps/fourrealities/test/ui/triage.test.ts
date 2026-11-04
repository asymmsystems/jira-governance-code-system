/**
 * Copyright (c) 2026 Asymm Systems. All rights reserved.
 * @author Fahim Farook
 * FourRealities: triage order and error text as plain functions, no React (B-22)
 */

import { GateResult, IssueRow } from '../../src/contract/data/models';
import { errorText, priorityActions, triageOrder } from '../../src/ui/triage';

const F: GateResult = { state: 'FOUND', verification: 'VERIFIED', reason: 'INTENT_CONFLUENCE_LINK' };
const M: GateResult = { state: 'MISSING', reason: 'INTENT_NONE' };
const r = (issueKey: string, missing: number, risk: IssueRow['risk'], rai: number | null): IssueRow => ({
  issueKey, summary: `Summary of ${issueKey}`,
  gates: { intent: missing > 0 ? M : F, process: missing > 1 ? M : F, code: missing > 2 ? M : F, audit: missing > 3 ? M : F },
  risk, rai
} as IssueRow);

describe('triageOrder', () => {
  it('orders by missing gates, then risk, then RAI with unrated last, then key', () => {
    const rows = [
      r('K-6', 0, 'LOW', 90), r('K-5', 0, 'UNRATED', null), r('K-4', 1, 'HIGH', 50),
      r('K-3', 1, 'HIGH', null), r('K-2', 1, 'CRITICAL', 25), r('K-1', 2, 'LOW', 10), r('K-0', 0, 'LOW', 90)
    ];
    expect(triageOrder(rows).map(x => x.issueKey)).toEqual(['K-1', 'K-2', 'K-4', 'K-3', 'K-0', 'K-6', 'K-5']);
  });

  it('does not change the input array', () => {
    const rows = [r('B', 0, 'LOW', 90), r('A', 1, 'LOW', 50)];
    triageOrder(rows);
    expect(rows.map(x => x.issueKey)).toEqual(['B', 'A']);
  });
});

describe('errorText', () => {
  it('prefers the envelope message, then a thrown message, then the fallback', () => {
    expect(errorText({ error: { message: 'envelope' }, message: 'thrown' }, 'fallback')).toBe('envelope');
    expect(errorText({ message: 'thrown' }, 'fallback')).toBe('thrown');
    expect(errorText(null, 'fallback')).toBe('fallback');
  });
});

describe('B-44: priority actions ranking', () => {
  it('returns up to limit issues with the most missing gates, respecting filters', () => {
    const rows = [
      r('K-1', 2, 'LOW', 10),
      r('K-2', 0, 'LOW', 90),
      r('K-3', 1, 'HIGH', 50),
      r('K-4', 1, 'CRITICAL', 20),
      r('K-5', 1, 'MEDIUM', 30),
      r('K-6', 2, 'HIGH', 15),
      r('K-7', 3, 'CRITICAL', 5)
    ];
    // Test with default limit of 5
    const actions = priorityActions(rows);
    expect(actions).toHaveLength(5);
    expect(actions[0].issueKey).toBe('K-7');
    expect(actions[0].missingCount).toBe(3);
    expect(actions[0].nextStep).toBe('Next: link the decision record.');
    expect(actions[1].issueKey).toBe('K-6');
    expect(actions[1].missingCount).toBe(2);

    // Test with explicit limit of 2
    const top2 = priorityActions(rows, 2);
    expect(top2).toHaveLength(2);
  });

  it('returns an empty array when no issues have missing gates', () => {
    const rows = [r('K-1', 0, 'LOW', 90)];
    expect(priorityActions(rows)).toEqual([]);
  });
});

