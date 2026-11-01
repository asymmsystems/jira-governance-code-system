/**
 * Copyright (c) 2026 Asymm Systems. All rights reserved.
 * @author Fahim Farook
 * FourRealities: parses the Jira Development field summary for pull request count and state.
 * The field reports pull request state only. Review approval is not in it (research H11).
 */

export type PullRequestState = 'MERGED' | 'OPEN' | 'DECLINED';

export interface DevFieldSummary {
  count: number;
  state: PullRequestState | null;
  openCount: number;
  mergedCount: number;
  declinedCount: number;
}

const NONE: DevFieldSummary = { count: 0, state: null, openCount: 0, mergedCount: 0, declinedCount: 0 };

function asState(value: unknown): PullRequestState | null {
  return value === 'MERGED' || value === 'OPEN' || value === 'DECLINED' ? value : null;
}

function fromJson(raw: string): DevFieldSummary | undefined {
  const start = raw.indexOf('json=');
  if (start < 0) return undefined;
  try {
    // The value ends with the closing brace of the outer summary map.
    const parsed = JSON.parse(raw.slice(start + 5, raw.lastIndexOf('}')));
    const overall = parsed?.cachedValue?.summary?.pullrequest?.overall;
    if (!overall || typeof overall.count !== 'number') return undefined;
    const details = overall.details || {};
    return {
      count: overall.count,
      state: asState(overall.state),
      openCount: Number(details.openCount) || 0,
      mergedCount: Number(details.mergedCount) || 0,
      declinedCount: Number(details.declinedCount) || 0
    };
  } catch {
    return undefined;
  }
}

function fromSummary(raw: string): DevFieldSummary | undefined {
  const match = /pullrequest=\{[^}]*?state=(\w+)[^}]*?stateCount=(\d+)/.exec(raw);
  if (!match) return undefined;
  const state = asState(match[1]);
  const count = Number(match[2]);
  return {
    count,
    state,
    openCount: state === 'OPEN' ? count : 0,
    mergedCount: state === 'MERGED' ? count : 0,
    declinedCount: state === 'DECLINED' ? count : 0
  };
}

export function parseDevField(raw: string | undefined): DevFieldSummary {
  if (typeof raw !== 'string') return { ...NONE };
  return fromJson(raw) || fromSummary(raw) || { ...NONE };
}
