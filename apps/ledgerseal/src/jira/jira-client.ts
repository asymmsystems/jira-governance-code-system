/**
 * Copyright (c) 2026 Asymm Systems. All rights reserved.
 *
 * LedgerSeal: Jira REST client.
 * Every Jira call goes through this interface, so resolvers and tests never depend on the Forge runtime.
 * Reads and the app's own property write run as the app. The approver check runs as the user.
 *
 * @author Fahim Farook
 */

import { route } from '@forge/api';

export type JiraError = 'UNREACHABLE' | 'NOT_FOUND' | 'FORBIDDEN';
export type JiraResult<T> = { ok: true; value: T } | { ok: false; error: JiraError; status?: number };

export interface ChangelogItem {
  field: string;
  fieldId?: string;
  fromString?: string | null;
  toString?: string | null;
}

export interface ChangelogEntry {
  id: string;
  author?: { accountId?: string };
  created: string;
  items: ChangelogItem[];
}

export interface JiraClient {
  getIssue(issueIdOrKey: string): Promise<JiraResult<any>>;
  /** The site's field list (GET /rest/api/3/field), read once per client. */
  getFields(): Promise<JiraResult<any[]>>;
  getChangelog(issueId: string): Promise<JiraResult<ChangelogEntry[]>>;
  getUserName(accountId: string): Promise<string | null>;
  /** True when the calling user may seal, reseal or revoke on this issue (spec v2 section 7.1). */
  hasApproverPermission(issueId: string): Promise<JiraResult<boolean>>;
  putSealProperty(issueId: string, body: unknown): Promise<boolean>;
}

/** The part of a Forge `requestJira` response the client reads. */
export interface JiraResponse {
  status: number;
  json(): Promise<any>;
  headers?: { get(name: string): string | null };
}

export interface JiraRequester {
  requestJira(path: any, options?: any): Promise<JiraResponse>;
}

export interface RetryOptions {
  maxRetries?: number;
  budgetMs?: number;
  sleep?: (ms: number) => Promise<void>;
  now?: () => number;
}

const PAGE_SIZE = 100;
const MAX_PAGES = 50;

function failure(status: number): { ok: false; error: JiraError; status: number } {
  if (status === 404) return { ok: false, error: 'NOT_FOUND', status };
  if (status === 401 || status === 403) return { ok: false, error: 'FORBIDDEN', status };
  return { ok: false, error: 'UNREACHABLE', status };
}

function isRetryable(status: number): boolean {
  return status === 429 || status >= 500;
}

export function createJiraClient(asApp: JiraRequester, asUser: JiraRequester | null, options: RetryOptions = {}): JiraClient {
  const maxRetries = options.maxRetries ?? 3;
  const budgetMs = options.budgetMs ?? 20000;
  const sleep = options.sleep ?? ((ms: number) => new Promise<void>(resolve => setTimeout(resolve, ms)));
  const now = options.now ?? (() => Date.now());

  /**
   * Sends one request. Retries 429 and 5xx with Retry-After or exponential backoff, inside the time budget.
   * A thrown network error is not retried: the caller reports UNREACHABLE.
   */
  async function send(requester: JiraRequester, path: any, init?: any): Promise<JiraResponse | null> {
    const started = now();
    for (let attempt = 0; ; attempt++) {
      let res: JiraResponse;
      try {
        res = await requester.requestJira(path, init);
      } catch {
        return null;
      }
      if (!isRetryable(res.status) || attempt >= maxRetries) return res;
      const retryAfter = Number(res.headers?.get('Retry-After'));
      const waitMs = Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter * 1000 : 500 * 2 ** attempt;
      if (now() - started + waitMs > budgetMs) return res;
      await sleep(waitMs);
    }
  }

  async function getJson<T>(requester: JiraRequester, path: any): Promise<JiraResult<T>> {
    const res = await send(requester, path, { headers: { Accept: 'application/json' } });
    if (!res) return { ok: false, error: 'UNREACHABLE' };
    if (res.status !== 200) return failure(res.status);
    return { ok: true, value: (await res.json()) as T };
  }

  let fields: Promise<JiraResult<any[]>> | null = null;

  return {
    getIssue(issueIdOrKey) {
      return getJson<any>(asApp, route`/rest/api/3/issue/${issueIdOrKey}`);
    },

    getFields() {
      // One field list per invocation; a failed read is not cached, so a retry can succeed
      if (!fields) {
        fields = getJson<any[]>(asApp, route`/rest/api/3/field`).then(res => {
          if (!res.ok) fields = null;
          return res;
        });
      }
      return fields;
    },

    async getChangelog(issueId) {
      const entries: ChangelogEntry[] = [];
      for (let page = 0; page < MAX_PAGES; page++) {
        const startAt = page * PAGE_SIZE;
        const res = await getJson<any>(asApp, route`/rest/api/3/issue/${issueId}/changelog?startAt=${startAt}&maxResults=${PAGE_SIZE}`);
        if (!res.ok) return res;
        const values: ChangelogEntry[] = Array.isArray(res.value?.values) ? res.value.values : [];
        entries.push(...values);
        if (res.value?.isLast !== false || values.length === 0) break;
      }
      return { ok: true, value: entries };
    },

    async getUserName(accountId) {
      const res = await getJson<any>(asApp, route`/rest/api/3/user?accountId=${accountId}`);
      return res.ok && typeof res.value?.displayName === 'string' ? res.value.displayName : null;
    },

    async hasApproverPermission(issueId) {
      if (!asUser) return { ok: false, error: 'FORBIDDEN' };
      const res = await getJson<any>(asUser, route`/rest/api/3/mypermissions?issueId=${issueId}&permissions=${'ADMINISTER_PROJECTS,ADMINISTER'}`);
      if (!res.ok) return res;
      const perms = res.value?.permissions || {};
      return { ok: true, value: Boolean(perms.ADMINISTER_PROJECTS?.havePermission || perms.ADMINISTER?.havePermission) };
    },

    async putSealProperty(issueId, body) {
      const res = await send(asApp, route`/rest/api/3/issue/${issueId}/properties/ledgerseal-cert`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });
      return Boolean(res && res.status >= 200 && res.status < 300);
    }
  };
}
