/**
 * Copyright (c) 2026 Asymm Systems. All rights reserved.
 * @author Fahim Farook
 * FourRealities: Confluence search accessor using Forge requestConfluence, as the user.
 */

import api, { route, Route } from '@forge/api';
import { ConfluencePage, ConfluencePageCheckAccessor, ConfluencePageSearchAccessor } from '../contract/accessors';
import { RemoteLink } from '../contract/data/models';
import { messageOf } from '../contract/data/errors';

export type ConfluenceRequester = (path: Route) => Promise<{
  status: number;
  json: () => Promise<unknown>;
}>;

interface ConfluenceSearchItem {
  readonly id?: string;
  readonly title?: string;
  readonly space?: { readonly key?: string; readonly name?: string };
  readonly _links?: { readonly webui?: string; readonly base?: string };
}

interface ConfluenceSearchResponse {
  readonly results?: ConfluenceSearchItem[];
  readonly _links?: { readonly base?: string };
}

/** Page ids per existence query; CQL "id in (...)" with this many ids stays well inside the URL limit. */
export const PAGE_CHECK_BATCH = 50;

/**
 * The message for a refused search. A refusal can mean the user may not search Confluence, or that
 * FourRealities has no access to Confluence on this site (for example, installed in Jira only), so
 * both are named (F-H3).
 */
export const CONFLUENCE_REFUSED = (status: number) =>
  `Confluence refused the search (HTTP ${status}). Either you cannot search Confluence, or FourRealities has no access to Confluence on this site. You can still enter the page address and title by hand.`;

export class DefaultForgeConfluenceSearchAccessor implements ConfluencePageSearchAccessor, ConfluencePageCheckAccessor {
  readonly serviceType = 'accessor' as const;

  private readonly requester: ConfluenceRequester;

  /**
   * Always as the user: the search, the panel check and the dashboard check (MK-02 Q3). Confluence
   * is never read as the app. A requester replaces it in tests.
   */
  constructor(principal: ConfluenceRequester | 'user' = 'user') {
    this.requester = typeof principal === 'function'
      ? principal
      : (r: Route) => api.asUser().requestConfluence(r);
  }

  async searchPages(query: string): Promise<{ readonly ok: boolean; readonly pages: ConfluencePage[]; readonly error?: string }> {
    const trimmed = query.trim();
    if (!trimmed || trimmed.length < 2) {
      return { ok: true, pages: [] };
    }
    try {
      const sanitized = trimmed.replace(/["\\]/g, '');
      const cql = `type=page AND title ~ "${sanitized}"`;
      const res = await this.requester(route`/wiki/rest/api/content/search?cql=${cql}&limit=10`);
      if (res.status === 401 || res.status === 403) {
        return { ok: false, pages: [], error: CONFLUENCE_REFUSED(res.status) };
      }
      if (res.status !== 200) {
        return { ok: false, pages: [], error: `Confluence returned status ${res.status}.` };
      }
      const data = (await res.json()) as ConfluenceSearchResponse;
      const results = Array.isArray(data?.results) ? data.results : [];
      const base = typeof data?._links?.base === 'string' ? data._links.base : '';

      const pages: ConfluencePage[] = results
        .filter(item => typeof item.title === 'string' && item.title.trim().length > 0)
        .map(item => {
          const title = String(item.title).trim();
          const webui = String(item._links?.webui || '');
          const url = webui.startsWith('http') ? webui : `${base}${webui}`;
          const spaceKey = item.space?.key ? String(item.space.key) : undefined;
          return { title, url, spaceKey };
        });

      return { ok: true, pages };
    } catch (err) {
      return { ok: false, pages: [], error: messageOf(err, 'Failed to search Confluence.') };
    }
  }

  async checkPages(linksByIssue: Map<string, RemoteLink[]>, deadline: number): Promise<Map<string, RemoteLink[]>> {
    const ids = Array.from(linksByIssue.values()).flat().map(l => l.pageId).filter((id): id is string => Boolean(id));
    if (ids.length === 0) return linksByIssue;
    const found = await this.existingPages(ids, deadline);
    if (!found) return linksByIssue;
    return new Map(Array.from(linksByIssue.entries()).map(([issueId, links]) => [
      issueId,
      links.map(l => (l.pageId ? { ...l, pageExists: found.has(l.pageId) } : l))
    ]));
  }

  async existingPages(pageIds: string[], deadline: number): Promise<Set<string> | null> {
    const ids = Array.from(new Set(pageIds.filter(id => /^\d+$/.test(id))));
    const found = new Set<string>();
    try {
      for (let i = 0; i < ids.length; i += PAGE_CHECK_BATCH) {
        if (Date.now() >= deadline) return null;
        const batch = ids.slice(i, i + PAGE_CHECK_BATCH);
        const cql = `id in (${batch.join(',')})`;
        const res = await this.requester(route`/wiki/rest/api/content/search?cql=${cql}&limit=${String(PAGE_CHECK_BATCH)}`);
        if (res.status !== 200) return null;
        const data = (await res.json()) as ConfluenceSearchResponse | null;
        for (const item of data?.results || []) if (item?.id !== undefined) found.add(String(item.id));
      }
      return found;
    } catch {
      return null;
    }
  }
}
