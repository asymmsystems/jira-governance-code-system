/*
 * Copyright (c) 2026 Asymm Systems. All rights reserved.
 *
 * @author Fahim Farook
 */

/**
 * CascadePlan: one date-based schedule engine with a stated reason (B-11, INV-09, INV-10).
 */

import {
  earliestStart,
  evaluateEffort,
  cascade,
  teamFactor,
  suggestedEnd,
  addDays,
  ScheduleEffort,
  ScheduleLink
} from '../../src/domain/schedule-engine';

const eff = (id: string, start: string, end: string, percentComplete = 0): ScheduleEffort =>
  ({ workEffortId: id, estimatedStartDate: start, estimatedCompletionDate: end, percentComplete });
const link = (from: string, to: string, triggerPercent: number): ScheduleLink =>
  ({ workEffortIdFrom: from, workEffortIdTo: to, workEffortAssocTypeId: 'FRACTIONAL_MILESTONE', triggerPercent, isTriggerSatisfied: false });
const TODAY = '2026-11-04';

describe('earliestStart (spec 3.3)', () => {
  // API-4 runs 27 days: 2026-11-04 to 2026-11-30.
  const api4 = eff('API-4', '2026-11-04', '2026-11-30');

  it('planned basis: start + ceil(duration x trigger / 100), with the trigger date the day before', () => {
    const r = earliestStart(api4, 30, TODAY);
    expect(r).toEqual({ basis: 'planned', date: '2026-11-13', triggerDate: '2026-11-12',
      reason: 'API-4 reaches 30% on 2026-11-12 (planned: 27 days)' });
  });

  it('trigger 0 starts with the predecessor, trigger 100 starts the day after it ends', () => {
    expect(earliestStart(api4, 0, TODAY)).toMatchObject({ date: '2026-11-04', triggerDate: '2026-11-04' });
    expect(earliestStart(api4, 100, TODAY)).toMatchObject({ date: '2026-12-01', triggerDate: '2026-11-30' });
  });

  it('observed basis: uses the progress rate so far when the predecessor has started', () => {
    const started = eff('API-4', '2026-10-29', '2026-11-30', 15);
    // 15% in 6 days = 2.5% a day; 15% more takes 6 days.
    expect(earliestStart(started, 30, TODAY)).toEqual({ basis: 'observed', date: '2026-11-10', triggerDate: '2026-11-09',
      reason: 'API-4 reaches 30% on 2026-11-09 (observed: 15% in 6 days)' });
  });

  it('satisfied: a predecessor at or past the trigger places no constraint', () => {
    expect(earliestStart(eff('API-4', '2026-10-01', '2026-11-30', 45), 30, TODAY)).toEqual({ basis: 'satisfied', date: null, triggerDate: null,
      reason: 'API-4 is at 45%, past the 30% trigger' });
  });

  it('a one-day predecessor and rounding up to whole days', () => {
    expect(earliestStart(eff('A', '2026-11-04', '2026-11-04'), 50, TODAY)).toMatchObject({ date: '2026-11-05' });
    expect(earliestStart(eff('A', '2026-11-04', '2026-11-03'), 50, TODAY)).toMatchObject({ date: '2026-11-05' });
  });
});

describe('evaluateEffort (several predecessors, violation, reason, suggestion)', () => {
  const efforts = new Map([
    ['A', eff('A', '2026-11-04', '2026-11-13')],
    ['B', eff('B', '2026-11-02', '2026-11-30')],
    ['S', eff('S', '2026-11-09', '2026-11-20')]
  ]);

  it('takes the latest earliest start and names that predecessor as the driver', () => {
    const r = evaluateEffort('S', efforts, [link('A', 'S', 50), link('B', 'S', 20)], TODAY);
    // A: 10 days, 50% -> 2026-11-09. B: 29 days, 20% -> ceil(5.8)=6 -> 2026-11-08. Driver: A.
    expect(r.earliestStartDate).toBe('2026-11-09');
    expect(r.driver).toBe('A');
    expect(r.violated).toBe(false);
    expect(r.reason).toBe('Starts 2026-11-09 because A reaches 50% on 2026-11-08 (planned: 10 days).');
  });

  it('flags a successor that starts before its earliest start and says what to change', () => {
    const early = new Map(efforts); early.set('S', eff('S', '2026-11-06', '2026-11-20'));
    const r = evaluateEffort('S', early, [link('A', 'S', 50)], TODAY);
    expect(r.violated).toBe(true);
    expect(r.suggestion).toBe('Move S to 2026-11-09 or lower the trigger to 20%.');
  });

  it('a successor that has started is a violation even when its dates fit', () => {
    const started = new Map(efforts); started.set('S', eff('S', '2026-11-20', '2026-11-30', 10));
    const r = evaluateEffort('S', started, [link('B', 'S', 90)], TODAY);
    expect(r.violated).toBe(true);
    expect(r.suggestion).toBe('S has started, but B is at 0% of the 90% trigger.');
  });

  it('no trigger suggestion when even 0% is too late; satisfied links give no constraint', () => {
    const early = new Map(efforts); early.set('S', eff('S', '2026-11-01', '2026-11-20'));
    expect(evaluateEffort('S', early, [link('A', 'S', 50)], TODAY).suggestion).toBe('Move S to 2026-11-09.');
    const done = new Map(efforts); done.set('A', eff('A', '2026-11-04', '2026-11-13', 100));
    const r = evaluateEffort('S', done, [link('A', 'S', 50)], TODAY);
    expect(r).toMatchObject({ earliestStartDate: null, violated: false, driver: null, reason: 'No wait: A is at 100%, past the 50% trigger.' });
  });

  it('a missing predecessor is reported, and an effort with no links has no constraint', () => {
    expect(evaluateEffort('S', efforts, [link('ZZ', 'S', 30)], TODAY)).toMatchObject({ violated: true, reason: 'Predecessor ZZ is not on the plan.' });
    expect(evaluateEffort('S', efforts, [], TODAY)).toMatchObject({ earliestStartDate: null, violated: false, reason: null });
  });
});

describe('cascade (forward pass, conflicts only)', () => {
  it('moves only successors that conflict, keeps their duration, in topological order', () => {
    const efforts = new Map([
      ['A', eff('A', '2026-11-04', '2026-11-13')],
      ['B', eff('B', '2026-11-05', '2026-11-08')],
      ['C', eff('C', '2026-12-20', '2026-12-24')],
      ['D', eff('D', '2026-11-06', '2026-11-06')]
    ]);
    const links = [link('A', 'B', 100), link('A', 'C', 100), link('B', 'D', 100)];
    const out = cascade(efforts, links, 'A', TODAY);
    expect(out.changes).toEqual([
      { key: 'B', fromStart: '2026-11-05', fromEnd: '2026-11-08', toStart: '2026-11-14', toEnd: '2026-11-17',
        reason: 'Starts 2026-11-14 because A reaches 100% on 2026-11-13 (planned: 10 days).' },
      { key: 'D', fromStart: '2026-11-06', fromEnd: '2026-11-06', toStart: '2026-11-18', toEnd: '2026-11-18',
        reason: 'Starts 2026-11-18 because B reaches 100% on 2026-11-17 (planned: 4 days).' }
    ]);
  });

  it('never moves a successor earlier, and a far-future successor stays put', () => {
    const efforts = new Map([['A', eff('A', '2026-11-04', '2026-11-13')], ['C', eff('C', '2027-01-04', '2027-01-08')]]);
    expect(cascade(efforts, [link('A', 'C', 50)], 'A', TODAY).changes).toEqual([]);
  });

  it('only successors downstream of the changed effort move', () => {
    const efforts = new Map([['A', eff('A', '2026-11-04', '2026-11-13')], ['X', eff('X', '2026-11-04', '2026-11-30')], ['Y', eff('Y', '2026-11-05', '2026-11-06')]]);
    expect(cascade(efforts, [link('X', 'Y', 100)], 'A', TODAY).changes).toEqual([]);
  });

  it('throws on a cycle', () => {
    const efforts = new Map([['A', eff('A', '2026-11-04', '2026-11-05')], ['B', eff('B', '2026-11-04', '2026-11-05')]]);
    expect(() => cascade(efforts, [link('A', 'B', 50), link('B', 'A', 50)], 'A', TODAY)).toThrow('cycle');
  });
});

describe('team factor (assumption, H7) and helpers', () => {
  it('1 + 0.25 x (min(N, 5) - 1), and no gain for a started or late task', () => {
    expect([1, 2, 3, 5, 10].map(n => teamFactor(n, false))).toEqual([1, 1.25, 1.5, 2, 2]);
    expect(teamFactor(3, true)).toBe(1);
    expect(teamFactor(0, false)).toBe(1);
  });

  it('suggestedEnd shortens the duration by the team factor, never below one day', () => {
    expect(suggestedEnd('2026-11-04', '2026-11-13', 2, false)).toBe('2026-11-11');
    expect(suggestedEnd('2026-11-04', '2026-11-13', 3, true)).toBe('2026-11-13');
    expect(suggestedEnd('2026-11-04', '2026-11-04', 5, false)).toBe('2026-11-04');
  });

  it('addDays works across month and year ends', () => {
    expect(addDays('2026-12-30', 3)).toBe('2027-01-02');
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28');
  });
});

describe('evaluation details for "Why this date" (B-12)', () => {
  const efforts = new Map([
    ['A', eff('A', '2026-11-04', '2026-11-13')],
    ['S', eff('S', '2026-11-06', '2026-11-20')]
  ]);

  it('returns the trigger date, trigger percent, basis and structured fixes of the driver', () => {
    const r = evaluateEffort('S', efforts, [link('A', 'S', 50)], TODAY);
    expect(r).toMatchObject({ triggerDate: '2026-11-08', triggerPercent: 50, basis: 'planned' });
    expect(r.fixes).toEqual([
      { kind: 'move', startDate: '2026-11-09', endDate: '2026-11-23' },
      { kind: 'trigger', triggerPercent: 20 }
    ]);
  });

  it('offers only a move when no lower trigger fits, and no fixes when there is no violation', () => {
    const early = new Map(efforts); early.set('S', eff('S', '2026-11-01', '2026-11-02'));
    expect(evaluateEffort('S', early, [link('A', 'S', 50)], TODAY).fixes).toEqual([{ kind: 'move', startDate: '2026-11-09', endDate: '2026-11-10' }]);
    const ok = new Map(efforts); ok.set('S', eff('S', '2026-11-12', '2026-11-20'));
    expect(evaluateEffort('S', ok, [link('A', 'S', 50)], TODAY).fixes).toBeUndefined();
  });
});
