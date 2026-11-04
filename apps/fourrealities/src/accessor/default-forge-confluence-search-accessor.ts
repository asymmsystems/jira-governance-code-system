/**
 * Copyright (c) 2026 Asymm Systems. All rights reserved.
 * @author Fahim Farook
 * FourRealities: Confluence search accessor using Forge requestConfluence.
 */

import api, { route, Route } from '@forge/api';
import { ConfluencePage, ConfluencePageSearchAccessor } from '../contract/accessors';
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

export class DefaultForgeConfluenceSearchAccessor implements ConfluencePageSearchAccessor {
  readonly serviceType = 'accessor' as const;

  constructor(
    private readonly requester: ConfluenceRequester = (r: Route) => api.asUser().requestConfluence(r)
  ) {}

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
        return { ok: false, pages: [], error: 'You do not have permission to search Confluence.' };
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
}
