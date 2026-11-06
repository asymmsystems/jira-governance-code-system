/**
 * Copyright (c) 2026 Asymm Systems. All rights reserved.
 * @author Fahim Farook
 * FourRealities: Jira users and groups as the user, for the admin page, the Tier 2 approver check
 * and the names on the dashboard (Uniform Permission Management Standard; ADR-013, ADR-014).
 * Scope read:jira-user (groups, users) and read:jira-work (permissions).
 */

import { assumeTrustedRoute, route } from '@forge/api';
import { GroupRef, JiraDirectoryAccessor } from '../contract/accessors';
import { JiraRequest } from './jira-request';

/** Account ids per user bulk read. */
const USER_BATCH = 50;
const MAX_QUERY_CHARS = 100;

type GroupJson = { groupId?: string; name?: string };

function groupsOf(list: unknown): GroupRef[] {
  return (Array.isArray(list) ? (list as GroupJson[]) : [])
    .map(g => ({ groupId: String(g?.groupId || g?.name || ''), name: String(g?.name || g?.groupId || '') }))
    .filter(g => g.groupId.length > 0 && g.name.length > 0);
}

export class DefaultForgeJiraDirectoryAccessor implements JiraDirectoryAccessor {
  readonly serviceType = 'accessor' as const;

  constructor(private readonly request: JiraRequest) {}

  async isJiraAdmin(): Promise<boolean> {
    try {
      const res = await this.request(route`/rest/api/3/mypermissions?permissions=ADMINISTER`);
      if (res.status !== 200) return false;
      const body = (await res.json()) as { permissions?: { ADMINISTER?: { havePermission?: boolean } } } | null;
      return body?.permissions?.ADMINISTER?.havePermission === true;
    } catch {
      return false;
    }
  }

  async myGroups(): Promise<{ status: number; groups: GroupRef[] }> {
    try {
      const res = await this.request(route`/rest/api/3/myself?expand=groups`);
      if (res.status !== 200) return { status: res.status, groups: [] };
      const body = (await res.json()) as { groups?: { items?: unknown } } | null;
      return { status: 200, groups: groupsOf(body?.groups?.items) };
    } catch {
      return { status: 0, groups: [] };
    }
  }

  async searchGroups(query: string): Promise<{ status: number; groups: GroupRef[] }> {
    try {
      const q = query.trim().slice(0, MAX_QUERY_CHARS);
      const res = await this.request(route`/rest/api/3/groups/picker?query=${q}&maxResults=20`);
      if (res.status !== 200) return { status: res.status, groups: [] };
      const body = (await res.json()) as { groups?: unknown } | null;
      return { status: 200, groups: groupsOf(body?.groups) };
    } catch {
      return { status: 0, groups: [] };
    }
  }

  async groupNames(groupIds: string[]): Promise<GroupRef[]> {
    const out: GroupRef[] = [];
    for (const groupId of groupIds) {
      let name = groupId;
      try {
        const res = await this.request(route`/rest/api/3/group/bulk?groupId=${groupId}`);
        if (res.status === 200) {
          const found = groupsOf(((await res.json()) as { values?: unknown } | null)?.values)[0];
          if (found) name = found.name;
        }
      } catch {
        // The id stays as the name.
      }
      out.push({ groupId, name });
    }
    return out;
  }

  async userNames(accountIds: string[]): Promise<Record<string, string>> {
    const names: Record<string, string> = {};
    const ids = Array.from(new Set(accountIds.filter(Boolean)));
    for (let i = 0; i < ids.length; i += USER_BATCH) {
      const batch = ids.slice(i, i + USER_BATCH);
      try {
        // The route tag cannot repeat a query parameter; every value here is encoded.
        const query = batch.map(id => `accountId=${encodeURIComponent(id)}`).join('&');
        const res = await this.request(assumeTrustedRoute(`/rest/api/3/user/bulk?maxResults=${USER_BATCH}&${query}`));
        if (res.status !== 200) continue;
        const body = (await res.json()) as { values?: Array<{ accountId?: string; displayName?: string }> } | null;
        for (const u of body?.values || []) {
          if (u?.accountId && u.displayName) names[u.accountId] = u.displayName;
        }
      } catch {
        // Names that cannot be read are left out.
      }
    }
    return names;
  }
}
