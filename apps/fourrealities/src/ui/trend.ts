/**
 * Copyright (c) 2026 Asymm Systems. All rights reserved.
 * @author Fahim Farook
 * FourRealities: four-week trend text and chart data from the weekly trend points (B-19, FR-15, FR-16).
 * Every rate is shown with its numerator and denominator. Pure functions; no I/O.
 */

import { GATE_NAMES, GateName, TrendPoint } from '../contract/data/models';
import { GATE_LABEL } from './gate-text';

export const TREND_WEEKS = 4;

const DAY_MS = 24 * 60 * 60 * 1000;

/** The last weeks, oldest first. */
export function recentWeeks(trend: TrendPoint[], weeks = TREND_WEEKS): TrendPoint[] {
  return [...trend].sort((a, b) => a.weekStart.localeCompare(b.weekStart)).slice(-weeks);
}

function percent(found: number, missing: number): number | null {
  const rated = found + missing;
  return rated === 0 ? null : Math.round((found * 100) / rated);
}

function gateText(gate: GateName, p: TrendPoint): string {
  const { found, missing } = p.gates[gate];
  const rate = percent(found, missing);
  return rate === null ? `${GATE_LABEL[gate]} n/a (0 rated)` : `${GATE_LABEL[gate]} ${found} of ${found + missing} rated (${rate}%)`;
}

export type TrendTableRow = { week: string; rai: string } & Record<GateName, string>;

export function trendTableRows(points: TrendPoint[]): TrendTableRow[] {
  return points.map(p => ({
    week: `Week of ${p.weekStart}`,
    rai: p.averageRAI === null ? `RAI n/a (${p.ratedIssues} rated issues)` : `RAI ${p.averageRAI}% (${p.ratedIssues} rated issues)`,
    intent: gateText('intent', p),
    process: gateText('process', p),
    code: gateText('code', p),
    audit: gateText('audit', p)
  }));
}

export interface ChartPoint {
  week: string;
  series: string;
  percent: number;
}

/** One point per week and series (RAI and each gate). A week with an empty denominator has no point. */
export function chartData(points: TrendPoint[]): ChartPoint[] {
  return points.flatMap(p => [
    ...(p.averageRAI === null ? [] : [{ week: p.weekStart, series: 'RAI', percent: p.averageRAI }]),
    ...GATE_NAMES.flatMap(g => {
      const rate = percent(p.gates[g].found, p.gates[g].missing);
      return rate === null ? [] : [{ week: p.weekStart, series: GATE_LABEL[g], percent: rate }];
    })
  ]);
}

/** The Monday (UTC) after the ISO week of the given time: when the next trend point starts. */
export function nextWeeklySnapshot(at: string): string {
  const d = new Date(at);
  const sinceMonday = (d.getUTCDay() + 6) % 7;
  const monday = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()) - sinceMonday * DAY_MS;
  return new Date(monday + 7 * DAY_MS).toISOString().slice(0, 10);
}

/** Text shown instead of a trend until two weekly points exist. */
export function trendNotice(points: TrendPoint[], generatedAt: string): string | undefined {
  return points.length >= 2 ? undefined : `Trend starts after two weekly snapshots. Next snapshot: ${nextWeeklySnapshot(generatedAt)}.`;
}
