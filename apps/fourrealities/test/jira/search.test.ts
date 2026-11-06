/**
 * Copyright (c) 2026 Asymm Systems. All rights reserved.
 * @author Fahim Farook
 * FourRealities: paged project search and 429 retry unit tests (real @forge/api route tag)
 */

import { ISSUE_CAP, searchProjectIssues } from '../../src/accessor/jira-search';
import { withRetry } from '../../src/accessor/jira-request';

const pathOf = (r: any): string => (typeof r === 'string' ? r : r.value);

/** A Jira mock that follows the enhanced search contract: startAt is ignored, no total, nextPageToken paging. */
function jira(total: number) {
  const issues = Array.from({ length: total }, (_, i) => ({ id: String(1000 + i), key: `P-${i + 1}`, fields: {} }));
  return jest.fn(async (r: any, init?: any) => {
    const path = pathOf(r);
    if (path === '/rest/api/3/search/approximate-count') {
      return { status: 200, json: async () => ({ count: total, jql: JSON.parse(init.body).jql }) };
    }
    const url = new URL('https://x' + path);
    const max = Number(url.searchParams.get('maxResults'));
    const start = Number(url.searchParams.get('nextPageToken') || 0);
    const batch = issues.slice(start, start + max);
    const next = start + max < total ? String(start + max) : undefined;
    return { status: 200, json: async () => ({ issues: batch, nextPageToken: next, isLast: !next }) };
  });
}

describe('searchProjectIssues', () => {
  const deadline = () => Date.now() + 60_000;

  it.each([50, 300, 1000])('reads %i unique issues with nextPageToken paging', async (n) => {
    const request = jira(n);
    const res = await searchProjectIssues('DEMO', 'customfield_10000', request, deadline());
    expect(res.issues).toHaveLength(n);
    expect(new Set(res.issues.map(i => i.id)).size).toBe(n);
    expect(res.capped).toBe(false);
    expect(res.totalKnown).toBe(n);
    expect(request).toHaveBeenCalledTimes(Math.ceil(n / 100));
    const first = pathOf(request.mock.calls[0][0]);
    expect(first).toContain('jql=project%20%3D%20%22DEMO%22%20ORDER%20BY%20created%20DESC');
    expect(first).toContain('customfield_10000');
    expect(first).not.toContain('startAt');
  });

  it('stops at the cap and asks for the approximate total', async () => {
    const request = jira(2300);
    const res = await searchProjectIssues('DEMO', null, request, deadline());
    expect(res.issues).toHaveLength(ISSUE_CAP);
    expect(res.capped).toBe(true);
    expect(res.totalKnown).toBe(2300);
    const last = request.mock.calls[request.mock.calls.length - 1];
    expect(pathOf(last[0])).toBe('/rest/api/3/search/approximate-count');
    expect(last[1].method).toBe('POST');
    expect(JSON.parse(last[1].body).jql).toBe('project = "DEMO" ORDER BY created DESC');
  });

  it('keeps each issue once if Jira repeats a page', async () => {
    let calls = 0;
    const request = jest.fn(async () => {
      calls++;
      return { status: 200, json: async () => ({ issues: [{ id: '1' }, { id: '2' }], nextPageToken: calls < 2 ? 't' : undefined, isLast: calls >= 2 }) };
    });
    const res = await searchProjectIssues('DEMO', null, request, deadline());
    expect(res.issues.map(i => i.id)).toEqual(['1', '2']);
  });

  it('returns the status of a failed page and a null total when the count fails', async () => {
    const failing = jest.fn(async () => ({ status: 403, json: async () => ({}) }));
    expect(await searchProjectIssues('DEMO', null, failing, deadline())).toEqual({ issues: [], capped: false, totalKnown: null, status: 403, error: 'Jira search/jql failed with HTTP 403' });
    const request = jira(2100);
    const capped = jest.fn(async (r: any, init?: any) => (pathOf(r).includes('approximate') ? { status: 500, json: async () => ({}) } : request(r, init)));
    expect((await searchProjectIssues('DEMO', null, capped, deadline())).totalKnown).toBeNull();
    const thrown = jest.fn(async () => { throw new Error('socket'); });
    expect((await searchProjectIssues('DEMO', null, thrown, deadline())).error).toBe('socket');
    const silent = jest.fn(async () => { throw {}; });
    expect((await searchProjectIssues('DEMO', null, silent, deadline())).error).toBe('Network error querying Jira search/jql');
    const page = jira(2100);
    const countThrows = jest.fn(async (r: any, init?: any) => { if (pathOf(r).includes('approximate')) throw new Error('x'); return page(r, init); });
    expect((await searchProjectIssues('DEMO', null, countThrows, deadline())).totalKnown).toBeNull();
  });
});

describe('withRetry', () => {
  const ok = { status: 200, json: async () => ({}) };
  const limited = (after?: string) => ({ status: 429, headers: { get: (h: string) => (h === 'Retry-After' ? after ?? null : null) }, json: async () => ({}) });

  it('retries a 429 up to 3 times, waiting Retry-After seconds capped at 5', async () => {
    const waits: number[] = [];
    const send = jest.fn().mockResolvedValueOnce(limited('2')).mockResolvedValueOnce(limited('30')).mockResolvedValueOnce(limited()).mockResolvedValueOnce(ok);
    const request = withRetry(send, () => Date.now() + 60_000, async (ms) => { waits.push(ms); });
    expect((await request('/x' as any)).status).toBe(200);
    expect(waits).toEqual([2000, 5000, 1000]);
    const zero = jest.fn().mockResolvedValueOnce(limited('0')).mockResolvedValueOnce(limited('soon')).mockResolvedValueOnce(ok);
    const zeroWaits: number[] = [];
    await withRetry(zero, () => Date.now() + 60_000, async (ms) => { zeroWaits.push(ms); })('/x' as any);
    expect(zeroWaits).toEqual([0, 1000]);
  });

  it('returns the 429 after 3 retries or when the wait would pass the deadline', async () => {
    const send = jest.fn().mockResolvedValue(limited('1'));
    const sleep = jest.fn(async () => undefined);
    expect((await withRetry(send, () => Date.now() + 60_000, sleep)('/x' as any)).status).toBe(429);
    expect(send).toHaveBeenCalledTimes(4);
    send.mockClear();
    expect((await withRetry(send, () => Date.now() + 500, sleep)('/x' as any)).status).toBe(429);
    expect(send).toHaveBeenCalledTimes(1);
  });

  it('passes the request options through', async () => {
    const send = jest.fn().mockResolvedValue(ok);
    await withRetry(send, () => Date.now() + 1000)('/x' as any, { method: 'POST' });
    expect(send).toHaveBeenCalledWith('/x', { method: 'POST' });
  });
});

describe('visibleIssueIds', () => {
  const { visibleIssueIds } = require('../../src/accessor/jira-search');

  it('pages an id-only search and returns the ids the caller can see', async () => {
    const request = jest.fn(async (r: any) => {
      const path = pathOf(r);
      const token = new URL('https://x' + path).searchParams.get('nextPageToken');
      return token
        ? { status: 200, json: async () => ({ issues: [{ id: '3' }], isLast: true }) }
        : { status: 200, json: async () => ({ issues: [{ id: '1' }, { id: '2' }], nextPageToken: 'p2' }) };
    });
    const res = await visibleIssueIds('DEMO', request, Date.now() + 10_000);
    expect(res).toEqual({ ids: new Set(['1', '2', '3']), complete: true });
    const first = pathOf(request.mock.calls[0][0]);
    expect(first).toContain('fields=id');
    expect(first).toContain('maxResults=100');
  });

  it('reports the status of a refused search, and an incomplete read at the deadline', async () => {
    const refused = jest.fn(async () => ({ status: 403, json: async () => ({}) }));
    expect(await visibleIssueIds('DEMO', refused, Date.now() + 10_000)).toEqual({ ids: new Set(), complete: false, status: 403 });
    const endless = jest.fn(async () => ({ status: 200, json: async () => ({ issues: [{ id: '1' }], nextPageToken: 'more' }) }));
    const partial = await visibleIssueIds('DEMO', endless, Date.now() + 5);
    expect(partial.complete).toBe(false);
    const thrown = jest.fn(async () => { throw new Error('x'); });
    expect((await visibleIssueIds('DEMO', thrown, Date.now() + 10_000)).complete).toBe(false);
  });
});

describe('B-24: a 200 with an empty body', () => {
  const { visibleIssueIds } = require('../../src/accessor/jira-search');
  const empty = () => jest.fn(async () => ({ status: 200, json: async () => null }));

  it('reads as no issues and the last page, for both searches', async () => {
    expect(await searchProjectIssues('DEMO', null, empty(), Date.now() + 10_000)).toEqual({ issues: [], capped: false, totalKnown: 0 });
    expect(await visibleIssueIds('DEMO', empty(), Date.now() + 10_000)).toEqual({ ids: new Set(), complete: true });
    const noIssues = jest.fn(async () => ({ status: 200, json: async () => ({ isLast: true }) }));
    expect((await searchProjectIssues('DEMO', null, noIssues, Date.now() + 10_000)).issues).toEqual([]);
    expect((await visibleIssueIds('DEMO', noIssues, Date.now() + 10_000)).ids.size).toBe(0);
  });
});

describe('B-25: the checklist property comes in the same search call', () => {
  it('asks for the DefinitionGuard, LedgerSeal and HeroCoders properties in one request', async () => {
    const request = jest.fn(async () => ({ status: 200, json: async () => ({ issues: [], isLast: true }) }));
    await searchProjectIssues('DEMO', null, request, Date.now() + 10_000);
    expect(request).toHaveBeenCalledTimes(1);
    const props = new URL('https://x' + pathOf((request.mock.calls[0] as any[])[0])).searchParams.get('properties');
    expect(props?.split(',')).toEqual(['ledgerseal-cert', 'definitionguard-dod', 'checklist']);
  });
});

describe('F-H2: reads stop in time on large projects', () => {
  const { visibleIssueIds, VISIBLE_ID_MARGIN, ISSUE_CAP } = require('../../src/accessor/jira-search');
  let n = 0;
  const pages = () => jest.fn(async () => {
    const issues = Array.from({ length: 100 }, () => ({ id: String(++n) }));
    return { status: 200, json: async () => ({ issues, nextPageToken: `p${n}` }) };
  });

  it('marks a project read that stopped at the deadline before the cap as timed out', async () => {
    n = 0;
    const res = await searchProjectIssues('DEMO', null, pages(), Date.now() - 1);
    expect(res.capped).toBe(true);
    expect(res.timedOut).toBe(true);
    expect(res.issues.length).toBeLessThan(2000);
  });

  it('stops the viewer check once every snapshot id is seen', async () => {
    n = 0;
    const request = pages();
    const res = await visibleIssueIds('DEMO', request, Date.now() + 60_000, new Set(['5', '150']));
    expect(res.complete).toBe(true);
    expect(request).toHaveBeenCalledTimes(2);
  });

  it('stops after the cap plus a margin when a snapshot id is not visible, and counts it complete', async () => {
    n = 0;
    const request = pages();
    const res = await visibleIssueIds('DEMO', request, Date.now() + 60_000, new Set(['hidden']));
    expect(res.complete).toBe(true);
    expect(res.ids.size).toBe(ISSUE_CAP + VISIBLE_ID_MARGIN);
    expect(res.ids.has('hidden')).toBe(false);
  });
});
