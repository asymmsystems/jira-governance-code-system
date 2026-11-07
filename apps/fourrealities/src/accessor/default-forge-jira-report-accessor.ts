/**
 * Copyright (c) 2026 Asymm Systems. All rights reserved.
 * @author Fahim Farook
 * FourRealities: the Jira reads of an evidence report (ADR-015), bound to one principal: id searches,
 * the visibility and existence checks, the gate facts of a batch, the bulk changelog fetch and the field
 * list. Scope read:jira-work. The changelog fetch was proven from Forge as the app in spike S-2.
 */

import { route } from '@forge/api';
import { IssueFacts, SiteConfig } from '../contract/data/models';
import { ChangelogEntry, ChangelogItem, FieldInfo, REPORT_LIMITS, ReportIssueBasics } from '../contract/data/reports';
import { JiraReportAccessor } from '../contract/reports';
import { JiraRequest } from './jira-request';
import { issueFields } from './jira-search';
import { factsFromIssue, PROPERTY_KEYS } from './issue-facts';
import { AttestationCheckFn } from './attestation-verifier';
import { JiraIssueJson } from './jira-types';

const JSON_HEADERS = { 'Content-Type': 'application/json', Accept: 'application/json' };
/** Jira returns up to 5,000 issues per page when only the id is asked for. */
const ID_PAGE = 5_000;
const CHANGELOG_PAGE = 10_000;

type ChangeHistoryJson = {
  id?: string | number;
  author?: { accountId?: string } | null;
  created?: string | number;
  items?: Array<{ field?: string; fieldId?: string; from?: string | null; fromString?: string | null; to?: string | null; toString?: string | null }>;
};

type BulkChangelogJson = { issueChangeLogs?: Array<{ issueId?: string | number; changeHistories?: ChangeHistoryJson[] }>; nextPageToken?: string };

const strOrNull = (v: unknown): string | null => (v === null || v === undefined ? null : String(v));
/** An item's own value: an item without "toString" must not give Object.prototype.toString. */
const own = (o: object, key: string): unknown => (Object.prototype.hasOwnProperty.call(o, key) ? (o as Record<string, unknown>)[key] : undefined);

/** A Jira changelog time (epoch milliseconds in the bulk fetch, an ISO text elsewhere) as ISO UTC. */
export function changelogTime(value: unknown): string {
  const t = typeof value === 'number' ? value : Date.parse(String(value));
  return Number.isFinite(t) ? new Date(t).toISOString() : new Date(0).toISOString();
}

/** One changelog history as a contract entry. Account ids stay only in memory until tokens replace them. */
export function changelogEntry(h: ChangeHistoryJson): ChangelogEntry {
  const items: ChangelogItem[] = (h.items || []).map(i => ({
    fieldId: String(i.fieldId || i.field || ''),
    field: String(i.field || i.fieldId || ''),
    from: strOrNull(i.from),
    to: strOrNull(i.to),
    fromString: strOrNull(own(i, 'fromString')),
    toString: strOrNull(own(i, 'toString'))
  }));
  return { changelogId: String(h.id ?? ''), at: changelogTime(h.created), authorAccountId: h.author?.accountId || null, items };
}

export class DefaultForgeJiraReportAccessor implements JiraReportAccessor {
  readonly serviceType = 'accessor' as const;

  /** verify checks sibling signatures (ADR-012); the same check as the dashboard. */
  constructor(private readonly request: JiraRequest, private readonly verify?: AttestationCheckFn) {}

  private async post(path: 'search' | 'changelog', body: unknown) {
    const r = path === 'search' ? route`/rest/api/3/search/jql` : route`/rest/api/3/changelog/bulkfetch`;
    return this.request(r, { method: 'POST', headers: JSON_HEADERS, body: JSON.stringify(body) });
  }

  async searchIds(jql: string, limit: number, deadline: number): Promise<{ status: number; ids: string[] }> {
    const ids: string[] = [];
    let token: string | undefined;
    do {
      const res = await this.post('search', { jql, fields: ['id'], maxResults: ID_PAGE, ...(token ? { nextPageToken: token } : {}) });
      if (res.status !== 200) return { status: res.status, ids: [] };
      const page = ((await res.json()) || {}) as { issues?: Array<{ id?: string | number }>; nextPageToken?: string; isLast?: boolean };
      for (const issue of page.issues || []) ids.push(String(issue.id));
      token = page.isLast ? undefined : page.nextPageToken;
    } while (token && ids.length <= limit && Date.now() < deadline);
    // A read cut by the deadline is an error, never a smaller scope (spec v4 invariant 11).
    return token && ids.length <= limit ? { status: 504, ids: [] } : { status: 200, ids };
  }

  async presentAmong(ids: string[], deadline: number): Promise<Set<string> | null> {
    const found = new Set<string>();
    for (let i = 0; i < ids.length; i += REPORT_LIMITS.visibilityBatch) {
      if (Date.now() >= deadline) return null;
      const batch = ids.slice(i, i + REPORT_LIMITS.visibilityBatch).filter(id => /^\d+$/.test(id));
      if (batch.length === 0) continue;
      const res = await this.post('search', { jql: `id in (${batch.join(',')})`, fields: ['id'], maxResults: ID_PAGE });
      if (res.status !== 200) return null;
      const page = ((await res.json()) || {}) as { issues?: Array<{ id?: string | number }> };
      for (const issue of page.issues || []) found.add(String(issue.id));
    }
    return found;
  }

  /**
   * Reads every page: Jira may return fewer issues per page than asked when many fields and properties are
   * requested (review H-1). A read that does not reach the last page is an error, never a smaller batch.
   */
  async factsByIds(ids: string[], config: SiteConfig): Promise<{ status: number; issues: Array<{ facts: IssueFacts; basics: ReportIssueBasics }> }> {
    const batch = ids.filter(id => /^\d+$/.test(id));
    if (batch.length === 0) return { status: 200, issues: [] };
    const fields = [...issueFields(config.devFieldId).split(','), 'created', 'issuetype', 'project'];
    const options = { devFieldId: config.devFieldId, siteHost: config.siteHost || undefined, statusCategories: config.statusCategories, verify: this.verify };
    const issues: Array<{ facts: IssueFacts; basics: ReportIssueBasics }> = [];
    let token: string | undefined;
    // One page per issue at most: a token that never ends the read cannot loop for ever.
    for (let pages = 0; pages <= batch.length; pages++) {
      const res = await this.post('search', { jql: `id in (${batch.join(',')})`, fields, properties: PROPERTY_KEYS, expand: 'changelog', maxResults: REPORT_LIMITS.batchSize, ...(token ? { nextPageToken: token } : {}) });
      if (res.status !== 200) return { status: res.status, issues: [] };
      const page = ((await res.json()) || {}) as { issues?: JiraIssueJson[]; nextPageToken?: string; isLast?: boolean };
      for (const iss of page.issues || []) {
        const f = iss.fields || {};
        const type = f.issuetype as { name?: string } | undefined;
        issues.push({
          facts: factsFromIssue(iss, options),
          basics: { issueId: String(iss.id), issueKey: String(iss.key), issueTypeName: String(type?.name || ''), created: changelogTime(f.created), statusId: String(f.status?.id || ''), ...(f.project?.key ? { projectKey: String(f.project.key) } : {}) }
        });
      }
      token = page.isLast === false || (page.isLast === undefined && page.nextPageToken) ? page.nextPageToken : undefined;
      if (!token) return { status: 200, issues };
    }
    return { status: 504, issues: [] };
  }

  async changelogs(ids: string[], fieldIds: string[], deadline: number): Promise<{ status: number; byIssue: Map<string, ChangelogEntry[]> }> {
    const byIssue = new Map<string, ChangelogEntry[]>();
    let token: string | undefined;
    do {
      const res = await this.post('changelog', { issueIdsOrKeys: ids, maxResults: CHANGELOG_PAGE, ...(fieldIds.length ? { fieldIds } : {}), ...(token ? { nextPageToken: token } : {}) });
      if (res.status !== 200) return { status: res.status, byIssue: new Map() };
      const page = ((await res.json()) || {}) as BulkChangelogJson;
      for (const log of page.issueChangeLogs || []) {
        const id = String(log.issueId);
        const list = byIssue.get(id) || [];
        for (const h of log.changeHistories || []) list.push(changelogEntry(h));
        byIssue.set(id, list);
      }
      token = page.nextPageToken || undefined;
    } while (token && Date.now() < deadline);
    return token ? { status: 504, byIssue: new Map() } : { status: 200, byIssue };
  }

  async fields(): Promise<{ status: number; fields: FieldInfo[] }> {
    const res = await this.request(route`/rest/api/3/field`);
    if (res.status !== 200) return { status: res.status, fields: [] };
    const list = (await res.json()) as Array<{ id?: string; name?: string; custom?: boolean; schema?: { type?: string; items?: string; custom?: string } }> | null;
    return {
      status: 200,
      fields: (Array.isArray(list) ? list : [])
        .filter(f => typeof f?.id === 'string')
        .map(f => ({ id: String(f.id), name: String(f.name || f.id), ...(f.schema?.type ? { schemaType: f.schema.type } : {}), ...(f.schema?.items ? { schemaItems: f.schema.items } : {}), ...(f.schema?.custom ? { custom: f.schema.custom } : {}) }))
    };
  }
}
