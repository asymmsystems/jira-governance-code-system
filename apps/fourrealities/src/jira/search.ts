/**
 * Copyright (c) 2026 Asymm Systems. All rights reserved.
 * @author Fahim Farook
 * FourRealities: paged project search on the enhanced /search/jql endpoint, and 429 retry.
 */

import { Route, route } from '@forge/api';
import { JiraRequest } from './site-config';
import { PROPERTY_KEYS } from './issue-facts';

/** At most this many issues are read per project. Above it the UI shows "Showing N of M". */
export const ISSUE_CAP = 2000;
const PAGE_SIZE = 100;
const MAX_RETRIES = 3;
const MAX_WAIT_MS = 5000;

const BASE_FIELDS = 'summary,status,issuetype,issuelinks,assignee,updated,customfield_10020,sprint';

/** Fields every issue read requests, plus the site's Development field when it has one. */
export function issueFields(devFieldId: string | null): string {
  return devFieldId ? `${BASE_FIELDS},${devFieldId}` : BASE_FIELDS;
}

const defaultSleep = (ms: number) => new Promise<void>(resolve => setTimeout(resolve, ms));

/**
 * Wraps a request so that a 429 is retried at most 3 times, waiting Retry-After seconds
 * (default 1, at most 5) while the wait still ends before the deadline. Then the 429 is returned.
 */
export function withRetry(send: JiraRequest, deadline: () => number, sleep: (ms: number) => Promise<void> = defaultSleep): JiraRequest {
  return async (r: Route, init?: any) => {
    let res = await send(r, init);
    for (let attempt = 0; attempt < MAX_RETRIES && res.status === 429; attempt++) {
      const header = res.headers?.get('Retry-After');
      const seconds = header !== null && header !== undefined && header !== '' && Number(header) >= 0 ? Number(header) : 1;
      const wait = Math.min(seconds, MAX_WAIT_MS / 1000) * 1000;
      if (Date.now() + wait > deadline()) {
        break;
      }
      await sleep(wait);
      res = await send(r, init);
    }
    return res;
  };
}

export interface SearchResult {
  issues: any[];
  capped: boolean;
  /** Exact count when not capped; approximate count when capped; null when unknown. */
  totalKnown: number | null;
  status?: number;
  error?: string;
}

/**
 * Reads the project's issues with nextPageToken paging until isLast or the cap. startAt is
 * not used: the enhanced endpoint ignores it (audit FR-08, Observed-live). Each issue is kept once.
 */
export async function searchProjectIssues(projectKey: string, devFieldId: string | null, request: JiraRequest, deadline: number): Promise<SearchResult> {
  const jql = `project = "${projectKey}" ORDER BY created DESC`;
  const fields = issueFields(devFieldId);
  const properties = PROPERTY_KEYS.join(',');
  const seen = new Map<string, any>();
  let token: string | undefined;
  try {
    do {
      const res = token
        ? await request(route`/rest/api/3/search/jql?jql=${jql}&maxResults=${PAGE_SIZE}&fields=${fields}&properties=${properties}&expand=changelog&nextPageToken=${token}`)
        : await request(route`/rest/api/3/search/jql?jql=${jql}&maxResults=${PAGE_SIZE}&fields=${fields}&properties=${properties}&expand=changelog`);
      if (res.status !== 200) {
        return { issues: [], capped: false, totalKnown: null, status: res.status, error: `Jira search/jql failed with HTTP ${res.status}` };
      }
      const data = await res.json();
      for (const iss of data.issues || []) {
        if (seen.size < ISSUE_CAP) seen.set(String(iss.id), iss);
      }
      token = data.isLast ? undefined : data.nextPageToken;
    } while (token && seen.size < ISSUE_CAP && Date.now() < deadline);
  } catch (err: any) {
    return { issues: [], capped: false, totalKnown: null, error: err?.message || 'Network error querying Jira search/jql' };
  }

  const issues = Array.from(seen.values());
  const capped = Boolean(token);
  return { issues, capped, totalKnown: capped ? await approximateCount(jql, request) : issues.length };
}

async function approximateCount(jql: string, request: JiraRequest): Promise<number | null> {
  try {
    const res = await request(route`/rest/api/3/search/approximate-count`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ jql })
    });
    return res.status === 200 ? Number((await res.json())?.count) : null;
  } catch {
    return null;
  }
}
