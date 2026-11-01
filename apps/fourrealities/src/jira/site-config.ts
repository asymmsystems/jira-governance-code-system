/**
 * Copyright (c) 2026 Asymm Systems. All rights reserved.
 * @author Fahim Farook
 * FourRealities: per-site configuration read from Jira and cached in KVS for 24 hours.
 */

import { Route, route } from '@forge/api';
import { StorageProvider } from '../storage/metrics-repository';

export const SITE_CONFIG_KEY = 'fr:cfg:site';
export const SITE_CONFIG_TTL_MS = 24 * 60 * 60 * 1000;

const DEV_FIELD_TYPE = 'com.atlassian.jira.plugins.jira-development-integration-plugin:devsummarycf';

export interface SiteConfig {
  /** Id of the Development field, or null when the site has none. */
  devFieldId: string | null;
  /** Host name of this Jira site, used to recognise Confluence pages on the same site. */
  siteHost: string | null;
  readAt: string;
}

/**
 * Sends one request as a chosen principal. Callers build the route with the @forge/api route tag,
 * which rejects interpolated values that contain '/', '?' or '#'.
 */
export type JiraRequest = (path: Route, init?: any) => Promise<{ status: number; json: () => Promise<any>; headers?: { get: (name: string) => string | null } }>;

/** Host of the site from serverInfo; null when it cannot be read. Not fatal: only same-site links depend on it. */
async function readSiteHost(request: JiraRequest): Promise<string | null> {
  try {
    const res = await request(route`/rest/api/3/serverInfo`);
    if (res.status !== 200) return null;
    return new URL(String((await res.json())?.baseUrl)).host || null;
  } catch {
    return null;
  }
}

/**
 * Returns the cached site configuration, or reads the field list and the site host and caches them.
 * The Development field is found by its custom type or by its name, never by a fixed id.
 */
export async function getSiteConfig(storage: StorageProvider, request: JiraRequest, now: number = Date.now()): Promise<SiteConfig> {
  const cached = await storage.get<SiteConfig>(SITE_CONFIG_KEY);
  if (cached && now - Date.parse(cached.readAt) < SITE_CONFIG_TTL_MS) {
    return cached;
  }
  const res = await request(route`/rest/api/3/field`);
  if (res.status !== 200) {
    throw new Error(`Jira returned HTTP ${res.status} reading the field list.`);
  }
  const fields = await res.json();
  const list: any[] = Array.isArray(fields) ? fields : [];
  const dev = list.find(f => f?.schema?.custom === DEV_FIELD_TYPE) || list.find(f => f?.name === 'Development');
  const config: SiteConfig = { devFieldId: dev?.id ? String(dev.id) : null, siteHost: await readSiteHost(request), readAt: new Date(now).toISOString() };
  await storage.set(SITE_CONFIG_KEY, config);
  return config;
}
