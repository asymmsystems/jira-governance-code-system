/**
 * Copyright (c) 2026 Asymm Systems. All rights reserved.
 * @author Fahim Farook
 * FourRealities: triage order and error text as plain functions, no React (B-22)
 */

import { GateResult, IssueRow } from '../../src/contract/data/models';
import { errorText, triageOrder } from '../../src/ui/triage';

const F: GateResult = { state: 'FOUND', verification: 'VERIFIED', reason: 'INTENT_CONFLUENCE_LINK' };
const M: GateResult = { state: 'MISSING', reason: 'INTENT_NONE' };
const r = (issueKey: string, missing: number, risk: IssueRow['risk'], rai: number | null): IssueRow => ({
  issueKey, gates: { intent: missing > 0 ? M : F, process: missing > 1 ? M : F, code: F, audit: F }, risk, rai
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
