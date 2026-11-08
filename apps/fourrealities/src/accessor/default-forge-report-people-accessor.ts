/**
 * Copyright (c) 2026 Asymm Systems. All rights reserved.
 * @author Fahim Farook
 * FourRealities: people as the downloading or creating user (scope read:jira-user): names and the active
 * flag for the unsigned people file, read at download and never stored in KVS, and the caller's groups for
 * the report group rule (owner decision Q2).
 */

import { assumeTrustedRoute, route } from '@forge/api';
import { ReportPeopleAccessor } from '../contract/reports';
import { JiraRequest } from './jira-request';

const USER_BATCH = 50;

export class DefaultForgeReportPeopleAccessor implements ReportPeopleAccessor {
  readonly serviceType = 'accessor' as const;

  constructor(private readonly request: JiraRequest) {}

  async people(accountIds: string[]): Promise<Record<string, { displayName: string; active: boolean }>> {
    const out: Record<string, { displayName: string; active: boolean }> = {};
    const ids = Array.from(new Set(accountIds.filter(Boolean)));
    for (let i = 0; i < ids.length; i += USER_BATCH) {
      const query = ids.slice(i, i + USER_BATCH).map(id => `accountId=${encodeURIComponent(id)}`).join('&');
      try {
        // The route tag cannot repeat a query parameter; every value here is encoded.
        const res = await this.request(assumeTrustedRoute(`/rest/api/3/user/bulk?maxResults=${USER_BATCH}&${query}`));
        if (res.status !== 200) continue;
        const body = (await res.json()) as { values?: Array<{ accountId?: string; displayName?: string; active?: boolean }> } | null;
        for (const u of body?.values || []) {
          if (u?.accountId) out[u.accountId] = { displayName: String(u.displayName || ''), active: u.active !== false };
        }
      } catch {
        // People that cannot be read are left out; the file says so.
      }
    }
    return out;
  }

  async myGroupIds(): Promise<{ status: number; groupIds: string[] }> {
    try {
      const res = await this.request(route`/rest/api/3/myself?expand=groups`);
      if (res.status !== 200) return { status: res.status, groupIds: [] };
      const body = (await res.json()) as { groups?: { items?: Array<{ groupId?: string; name?: string }> } } | null;
      return { status: 200, groupIds: (body?.groups?.items || []).map(g => String(g.groupId || g.name || '')).filter(Boolean) };
    } catch {
      return { status: 0, groupIds: [] };
    }
  }
}
