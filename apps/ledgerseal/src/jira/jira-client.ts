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

export type JiraError = 'UNREACHABLE' | 'NOT_FOUND' | 'FORBIDDEN' | 'TOO_LARGE';
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
  /** All comments, oldest first, from the paged comment endpoint. */
  getComments(issueId: string): Promise<JiraResult<any[]>>;
  /** F-06: the ids of the comments the calling user can see (read as the user). */
  getVisibleCommentIds(issueId: string): Promise<JiraResult<string[]>>;
  /** All work log entries, from the paged work log endpoint. */
  getWorklogs(issueId: string): Promise<JiraResult<any[]>>;
  /** The site's field list (GET /rest/api/3/field), read once per client. */
  getFields(): Promise<JiraResult<any[]>>;
  getChangelog(issueId: string): Promise<JiraResult<ChangelogEntry[]>>;
  getUserName(accountId: string): Promise<string | null>;
  /** Jira's answer about an account: active, inactive (deactivated or closed), gone (404), or null when Jira cannot answer. */
  accountState(accountId: string): Promise<'active' | 'inactive' | 'gone' | null>;
  /** True when the calling user may seal, reseal or revoke on this issue (spec v2 section 7.1). */
  hasApproverPermission(issueId: string): Promise<JiraResult<boolean>>;
  /** Group ids of the calling user, for the approver group policy. */
  getMyGroupIds(): Promise<JiraResult<string[]>>;
  /** True when the calling user is a Jira admin (global Administer Jira permission). */
  isJiraAdmin(): Promise<JiraResult<boolean>>;
  /** Groups whose name matches the query, for the admin page. */
  findGroups(query: string): Promise<JiraResult<JiraGroup[]>>;
  /** The groups with these ids, with the names Jira has. Unknown ids are left out. */
  getGroups(groupIds: string[]): Promise<JiraResult<JiraGroup[]>>;
  putSealProperty(issueId: string, body: unknown): Promise<boolean>;
}

export interface JiraGroup {
  groupId: string;
  name: string;
}

/** Keeps only groups that have both an id and a name; old groups without an id cannot be named in a policy. */
function groupsOf(items: unknown): JiraGroup[] {
  if (!Array.isArray(items)) return [];
  return items
    .filter((g: any) => typeof g?.groupId === 'string' && g.groupId && typeof g?.name === 'string')
    .map((g: any) => ({ groupId: g.groupId, name: g.name }));
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

  /**
   * Reads a startAt/total paged list until every item is read. A list longer than MAX_PAGES pages fails closed
   * with TOO_LARGE, so a seal or a check never works from a part of the list (F-10).
   */
  async function pages(path: (startAt: number) => any, listKey: string): Promise<JiraResult<any[]>> {
    const items: any[] = [];
    for (let page = 0; page < MAX_PAGES; page++) {
      const res = await getJson<any>(asApp, path(items.length));
      if (!res.ok) return res;
      const values: any[] = Array.isArray(res.value?.[listKey]) ? res.value[listKey] : [];
      items.push(...values);
      if (values.length === 0 || items.length >= Number(res.value?.total ?? 0)) return { ok: true, value: items };
    }
    console.error(`LedgerSeal: more than ${MAX_PAGES * PAGE_SIZE} ${listKey}; the issue is too large to check`);
    return { ok: false, error: 'TOO_LARGE' };
  }

  const changelogs = new Map<string, Promise<JiraResult<ChangelogEntry[]>>>();

  /** The full change log, oldest first; TOO_LARGE past MAX_PAGES pages (F-10). */
  async function readChangelog(issueId: string): Promise<JiraResult<ChangelogEntry[]>> {
    const entries: ChangelogEntry[] = [];
    for (let page = 0; page < MAX_PAGES; page++) {
      const startAt = page * PAGE_SIZE;
      const res = await getJson<any>(asApp, route`/rest/api/3/issue/${issueId}/changelog?startAt=${startAt}&maxResults=${PAGE_SIZE}`);
      if (!res.ok) return res;
      const values: ChangelogEntry[] = Array.isArray(res.value?.values) ? res.value.values : [];
      entries.push(...values);
      if (res.value?.isLast !== false || values.length === 0) return { ok: true, value: entries };
    }
    console.error(`LedgerSeal: more than ${MAX_PAGES * PAGE_SIZE} change log entries on issue ${issueId}; the issue is too large to check`);
    return { ok: false, error: 'TOO_LARGE' };
  }

  let fields: Promise<JiraResult<any[]>> | null = null;

  return {
    getIssue(issueIdOrKey) {
      // Comments are read from their own paged endpoint, so the issue body leaves them out
      return getJson<any>(asApp, route`/rest/api/3/issue/${issueIdOrKey}?fields=*all,-comment`);
    },

    getComments(issueId) {
      return pages(startAt => route`/rest/api/3/issue/${issueId}/comment?startAt=${startAt}&maxResults=${PAGE_SIZE}&orderBy=created`, 'comments');
    },

    async getVisibleCommentIds(issueId) {
      if (!asUser) return { ok: false, error: 'FORBIDDEN' };
      const ids: string[] = [];
      for (let page = 0; page < MAX_PAGES; page++) {
        const res = await getJson<any>(asUser, route`/rest/api/3/issue/${issueId}/comment?startAt=${ids.length}&maxResults=${PAGE_SIZE}`);
        if (!res.ok) return res;
        const values: any[] = Array.isArray(res.value?.comments) ? res.value.comments : [];
        ids.push(...values.map(c => String(c?.id ?? '')));
        if (values.length === 0 || ids.length >= Number(res.value?.total ?? 0)) return { ok: true, value: ids };
      }
      return { ok: false, error: 'TOO_LARGE' };
    },

    getWorklogs(issueId) {
      return pages(startAt => route`/rest/api/3/issue/${issueId}/worklog?startAt=${startAt}&maxResults=${PAGE_SIZE}`, 'worklogs');
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

    getChangelog(issueId) {
      // One read per issue per invocation (F-10); a failed read is not kept, so a retry can succeed
      let read = changelogs.get(issueId);
      if (!read) {
        read = readChangelog(issueId).then(res => {
          if (!res.ok) changelogs.delete(issueId);
          return res;
        });
        changelogs.set(issueId, read);
      }
      return read;
    },

    async getUserName(accountId) {
      const res = await getJson<any>(asApp, route`/rest/api/3/user?accountId=${accountId}`);
      return res.ok && typeof res.value?.displayName === 'string' ? res.value.displayName : null;
    },

    async accountState(accountId) {
      const res = await getJson<any>(asApp, route`/rest/api/3/user?accountId=${accountId}`);
      if (res.ok) return typeof res.value?.active === 'boolean' ? (res.value.active ? 'active' : 'inactive') : null;
      // Jira answers 404 for an account that no longer exists
      return res.error === 'NOT_FOUND' ? 'gone' : null;
    },

    async hasApproverPermission(issueId) {
      if (!asUser) return { ok: false, error: 'FORBIDDEN' };
      const res = await getJson<any>(asUser, route`/rest/api/3/mypermissions?issueId=${issueId}&permissions=${'ADMINISTER_PROJECTS,ADMINISTER'}`);
      if (!res.ok) return res;
      const perms = res.value?.permissions || {};
      return { ok: true, value: Boolean(perms.ADMINISTER_PROJECTS?.havePermission || perms.ADMINISTER?.havePermission) };
    },

    // Group and admin reads run as the user, so they see only what that user may see
    async getMyGroupIds() {
      if (!asUser) return { ok: false, error: 'FORBIDDEN' };
      const res = await getJson<any>(asUser, route`/rest/api/3/myself?expand=groups`);
      if (!res.ok) return res;
      return { ok: true, value: groupsOf(res.value?.groups?.items).map(g => g.groupId) };
    },

    async isJiraAdmin() {
      if (!asUser) return { ok: false, error: 'FORBIDDEN' };
      const res = await getJson<any>(asUser, route`/rest/api/3/mypermissions?permissions=${'ADMINISTER'}`);
      if (!res.ok) return res;
      return { ok: true, value: Boolean(res.value?.permissions?.ADMINISTER?.havePermission) };
    },

    async findGroups(query) {
      if (!asUser) return { ok: false, error: 'FORBIDDEN' };
      const res = await getJson<any>(asUser, route`/rest/api/3/groups/picker?query=${query}&maxResults=${20}`);
      if (!res.ok) return res;
      return { ok: true, value: groupsOf(res.value?.groups) };
    },

    async getGroups(groupIds) {
      if (!asUser) return { ok: false, error: 'FORBIDDEN' };
      const found: JiraGroup[] = [];
      for (const groupId of groupIds) {
        const res = await getJson<any>(asUser, route`/rest/api/3/group/bulk?groupId=${groupId}`);
        if (!res.ok) return res;
        found.push(...groupsOf(res.value?.values));
      }
      return { ok: true, value: found };
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
