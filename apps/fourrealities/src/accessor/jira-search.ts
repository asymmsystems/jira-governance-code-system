/**
 * Copyright (c) 2026 Asymm Systems. All rights reserved.
 * @author Fahim Farook
 * FourRealities: paged project search on the enhanced /search/jql endpoint, and 429 retry.
 */

import { Route, route } from '@forge/api';
import { JiraRequest } from './jira-request';
import { PROPERTY_KEYS } from './issue-facts';

/** At most this many issues are read per project. Above it the UI shows "Showing N of M". */
export const ISSUE_CAP = 2000;
const PAGE_SIZE = 100;

const BASE_FIELDS = 'summary,status,issuetype,issuelinks,assignee,updated,customfield_10020,sprint';

/** Fields every issue read requests, plus the site's Development field when it has one. */
export function issueFields(devFieldId: string | null): string {
  return devFieldId ? `${BASE_FIELDS},${devFieldId}` : BASE_FIELDS;
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

/**
 * Ids of the project's issues that the caller can browse: an id-only search, paged with
 * nextPageToken. "complete" is false when the read stopped early (error or deadline).
 */
export async function visibleIssueIds(projectKey: string, request: JiraRequest, deadline: number): Promise<{ ids: Set<string>; complete: boolean; status?: number }> {
  const jql = `project = "${projectKey}" ORDER BY created DESC`;
  const ids = new Set<string>();
  let token: string | undefined;
  try {
    do {
      const res = token
        ? await request(route`/rest/api/3/search/jql?jql=${jql}&maxResults=${PAGE_SIZE}&fields=id&nextPageToken=${token}`)
        : await request(route`/rest/api/3/search/jql?jql=${jql}&maxResults=${PAGE_SIZE}&fields=id`);
      if (res.status !== 200) {
        return { ids, complete: false, status: res.status };
      }
      const data = await res.json();
      for (const iss of data.issues || []) ids.add(String(iss.id));
      token = data.isLast ? undefined : data.nextPageToken;
    } while (token && Date.now() < deadline);
  } catch {
    return { ids, complete: false };
  }
  return { ids, complete: !token };
}
