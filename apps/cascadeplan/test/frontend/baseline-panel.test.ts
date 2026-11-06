/*
 * Copyright (c) 2026 Asymm Systems. All rights reserved.
 *
 * @author Fahim Farook
 */

/** ADR-009: the toolbar line of the baseline status. */
import { statusText } from '../../src/frontend/baseline-panel';

const cmp = (o: any) => ({ added: [], removed: [], changed: [], deltaHours: 0, deltaPercent: 0, slipped: 0, grew: false, ...o });

describe('baseline status text', () => {
  it('none, on scope, grown, and changed since frozen', () => {
    expect(statusText({ ok: false })).toBe('Baseline: none');
    expect(statusText({ ok: true, intact: true, baseline: { name: 'S7' }, comparison: cmp({}) })).toBe('Baseline: S7 · on scope');
    expect(statusText({ ok: true, intact: true, baseline: { name: 'S7' }, comparison: cmp({ added: [{}], deltaHours: 12, deltaPercent: 50, slipped: 1, grew: true }) }))
      .toBe('Baseline: S7 · +12 h (+50%), 1 added, 1 later');
    expect(statusText({ ok: true, intact: false, baseline: { name: 'S7' }, comparison: cmp({ removed: [{}], deltaHours: -4, deltaPercent: -10 }) }))
      .toBe('Baseline: S7 (changed since frozen!) · -4 h (-10%), 1 removed');
  });
});
