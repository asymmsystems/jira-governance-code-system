/**
 * Copyright (c) 2026 Asymm Systems. All rights reserved.
 * @author Fahim Farook
 * FourRealities: four-week trend with denominators (B-19, FR-15, FR-16)
 */

import { TrendPoint } from '../../src/contract/data/models';
import { chartData, nextWeeklySnapshot, recentWeeks, trendNotice, trendTableRows } from '../../src/ui/trend';

const pt = (weekStart: string, intentFound: number, intentMissing: number, averageRAI: number | null = 50, ratedIssues = 10): TrendPoint => ({
  weekStart, generatedAt: `${weekStart}T06:00:00.000Z`, ratedIssues, averageRAI,
  gates: { intent: { found: intentFound, missing: intentMissing }, process: { found: 1, missing: 3 }, code: { found: 0, missing: 0 }, audit: { found: 2, missing: 2 } },
  startedIssues: 12, reworkIssues: 1
});

const five = [pt('2026-10-05', 1, 9), pt('2026-10-26', 4, 6), pt('2026-10-12', 2, 8), pt('2026-11-02', 5, 5), pt('2026-10-19', 3, 7)];

describe('recentWeeks', () => {
  it('keeps the last four weeks, oldest first', () => {
    expect(recentWeeks(five).map(p => p.weekStart)).toEqual(['2026-10-12', '2026-10-19', '2026-10-26', '2026-11-02']);
    expect(recentWeeks([])).toEqual([]);
  });
});

describe('trendTableRows', () => {
  it('shows each rate with its numerator and denominator, and n/a for an empty denominator', () => {
    expect(trendTableRows([pt('2026-10-26', 12, 28, 64, 30)])).toEqual([{
      week: 'Week of 2026-10-26',
      rai: 'RAI 64% (30 rated issues)',
      intent: 'Intent 12 of 40 rated (30%)',
      process: 'Process 1 of 4 rated (25%)',
      code: 'Code n/a (0 rated)',
      audit: 'Audit 2 of 4 rated (50%)'
    }]);
    expect(trendTableRows([pt('2026-10-26', 0, 0, null, 0)])[0].rai).toBe('RAI n/a (0 rated issues)');
  });
});

describe('chartData', () => {
  it('has one point per week and series, as a percent, and leaves out empty denominators', () => {
    const data = chartData([pt('2026-10-19', 1, 3, 40), pt('2026-10-26', 3, 1, 60)]);
    expect(data.filter(d => d.series === 'RAI')).toEqual([{ week: '2026-10-19', series: 'RAI', percent: 40 }, { week: '2026-10-26', series: 'RAI', percent: 60 }]);
    expect(data.filter(d => d.series === 'Intent').map(d => d.percent)).toEqual([25, 75]);
    expect(data.filter(d => d.series === 'Code')).toEqual([]);
    expect(chartData([pt('2026-10-19', 1, 3, null)]).some(d => d.series === 'RAI')).toBe(false);
  });
});

describe('trendNotice', () => {
  it('names the next weekly snapshot when fewer than two weeks exist', () => {
    expect(nextWeeklySnapshot('2026-11-01T08:30:00.000Z')).toBe('2026-11-02');
    expect(nextWeeklySnapshot('2026-11-02T00:00:00.000Z')).toBe('2026-11-09');
    expect(trendNotice([], '2026-11-01T08:30:00.000Z')).toBe('Trend starts after two weekly snapshots. Next snapshot: 2026-11-02.');
    expect(trendNotice([pt('2026-10-26', 1, 1)], '2026-11-01T08:30:00.000Z')).toBe('Trend starts after two weekly snapshots. Next snapshot: 2026-11-02.');
    expect(trendNotice([pt('2026-10-19', 1, 1), pt('2026-10-26', 1, 1)], '2026-11-01T08:30:00.000Z')).toBeUndefined();
  });
});
