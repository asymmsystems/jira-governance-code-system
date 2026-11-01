/**
 * Copyright (c) 2026 Asymm Systems. All rights reserved.
 * @author Fahim Farook
 * FourRealities: Jira issue reads and user writes over Forge, bound to one principal.
 * The only Jira I/O in the app, apart from the site configuration reads.
 */

import api, { Route, route } from '@forge/api';
import { DevFieldSummary, ExceptionProperty, IssueFacts, ProjectSearchResult, RemoteLink, SiteConfig, VisibleIds } from '../contract/data/models';
import { JiraIssueAccessor } from '../contract/accessors';
import { JiraRequest, withRetry } from './jira-request';
import { issueFields, searchProjectIssues, visibleIssueIds } from './jira-search';
import { readRemoteLinks } from './remote-links';
import { factsFromIssue, normalizeRemoteLinks, PROPERTY_KEYS } from './issue-facts';
import { parseDevField } from './dev-field';
import { JiraIssueJson, JiraRemoteLinkJson, JiraRequestInit } from './jira-types';

export type Principal = 'user' | 'app';

/** A request function for the principal, with 429 retry inside the deadline. */
export function requestAs(principal: Principal, deadline: () => number): JiraRequest {
  // The platform response has the status, json and headers that JiraRequest names.
  const send: JiraRequest = (r: Route, init?: JiraRequestInit) =>
    (principal === 'user' ? api.asUser() : api.asApp()).requestJira(r, init) as ReturnType<JiraRequest>;
  return withRetry(send, deadline);
}

export class DefaultForgeJiraIssueAccessor implements JiraIssueAccessor {
  readonly serviceType = 'accessor' as const;
  private readonly request: JiraRequest;

  constructor(principal: Principal, deadline: () => number, request?: JiraRequest) {
    this.request = request || requestAs(principal, deadline);
  }

  async searchProject(projectKey: string, config: SiteConfig, deadline: number): Promise<ProjectSearchResult> {
    const res = await searchProjectIssues(projectKey, config.devFieldId, this.request, deadline);
    const options = { devFieldId: config.devFieldId, siteHost: config.siteHost || undefined, statusCategories: config.statusCategories };
    return {
      facts: res.issues.map(iss => factsFromIssue(iss, options)),
      capped: res.capped,
      totalKnown: res.totalKnown,
      ...(res.status !== undefined ? { status: res.status } : {}),
      ...(res.error !== undefined ? { error: res.error } : {})
    };
  }

  visibleIssueIds(projectKey: string, deadline: number): Promise<VisibleIds> {
    return visibleIssueIds(projectKey, this.request, deadline);
  }

  /** Reads the issue and its remote links. A remote-link read that fails gives no links. */
  async readIssue(issueId: string, config: SiteConfig): Promise<{ status: number; facts?: IssueFacts }> {
    const [issueRes, remoteLinksRes] = await Promise.all([
      this.request(route`/rest/api/3/issue/${issueId}?fields=${issueFields(config.devFieldId)}&properties=${PROPERTY_KEYS.join(',')}&expand=changelog`),
      this.request(route`/rest/api/3/issue/${issueId}/remotelink`).catch(() => null)
    ]);
    if (issueRes.status !== 200) {
      return { status: issueRes.status };
    }
    const iss = (await issueRes.json()) as JiraIssueJson;
    let remoteLinks: JiraRemoteLinkJson[] = [];
    if (remoteLinksRes && remoteLinksRes.status === 200) {
      try {
        const body = await remoteLinksRes.json();
        remoteLinks = Array.isArray(body) ? body : [];
      } catch {}
    }
    return { status: 200, facts: factsFromIssue(iss, { remoteLinks, devFieldId: config.devFieldId, siteHost: config.siteHost || undefined, statusCategories: config.statusCategories }) };
  }

  async remoteLinks(issueIds: string[], deadline: number): Promise<Map<string, RemoteLink[]>> {
    const raw = await readRemoteLinks(issueIds, this.request, deadline);
    return new Map(Array.from(raw.entries()).map(([id, links]) => [id, normalizeRemoteLinks(links)]));
  }

  async issueProject(issueId: string): Promise<{ status: number; issueKey?: string; projectKey?: string; assigneeAccountId?: string }> {
    const res = await this.request(route`/rest/api/3/issue/${issueId}?fields=project,assignee`);
    if (res.status !== 200) {
      return { status: res.status };
    }
    const iss = (await res.json()) as JiraIssueJson | null;
    return { status: 200, issueKey: iss?.key, projectKey: iss?.fields?.project?.key, assigneeAccountId: iss?.fields?.assignee?.accountId };
  }

  /** "Get my permissions" for the principal, in one project (scope read:jira-work). */
  async hasProjectPermission(projectKey: string, permission: string): Promise<{ status: number; granted: boolean }> {
    const res = await this.request(route`/rest/api/3/mypermissions?projectKey=${projectKey}&permissions=${permission}`);
    if (res.status !== 200) {
      return { status: res.status, granted: false };
    }
    const body = (await res.json()) as { permissions?: Record<string, { havePermission?: boolean }> } | null;
    return { status: 200, granted: body?.permissions?.[permission]?.havePermission === true };
  }

  async pullRequests(issueId: string, devFieldId: string): Promise<{ status: number; issueKey?: string; summary?: DevFieldSummary }> {
    const res = await this.request(route`/rest/api/3/issue/${issueId}?fields=${devFieldId}`);
    if (res.status !== 200) {
      return { status: res.status };
    }
    const iss = (await res.json()) as JiraIssueJson | null;
    const dev = iss?.fields?.[devFieldId];
    return { status: 200, issueKey: iss?.key, summary: parseDevField(typeof dev === 'string' ? dev : undefined) };
  }

  async addRemoteLink(issueId: string, link: { url: string; title: string; summary: string }): Promise<number> {
    const res = await this.request(route`/rest/api/3/issue/${issueId}/remotelink`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ object: link })
    });
    return res.status;
  }

  async putExceptionProperty(issueId: string, value: ExceptionProperty): Promise<number> {
    const res = await this.request(route`/rest/api/3/issue/${issueId}/properties/fourrealities-exception`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(value)
    });
    return res.status;
  }
}
