/**
 * Copyright (c) 2026 Asymm Systems. All rights reserved.
 * @author Fahim Farook
 * FourRealities: per-site configuration read from Jira and cached in KVS for 24 hours.
 */

import { StorageProvider } from '../storage/metrics-repository';

export const SITE_CONFIG_KEY = 'fr:cfg:site';
export const SITE_CONFIG_TTL_MS = 24 * 60 * 60 * 1000;

const DEV_FIELD_TYPE = 'com.atlassian.jira.plugins.jira-development-integration-plugin:devsummarycf';

export interface SiteConfig {
  /** Id of the Development field, or null when the site has none. */
  devFieldId: string | null;
  readAt: string;
}

export type JiraRequest = (path: string) => Promise<{ status: number; json: () => Promise<any> }>;

/**
 * Returns the cached site configuration, or reads the field list and caches it.
 * The Development field is found by its custom type or by its name, never by a fixed id.
 */
export async function getSiteConfig(storage: StorageProvider, request: JiraRequest, now: number = Date.now()): Promise<SiteConfig> {
  const cached = await storage.get<SiteConfig>(SITE_CONFIG_KEY);
  if (cached && now - Date.parse(cached.readAt) < SITE_CONFIG_TTL_MS) {
    return cached;
  }
  const res = await request('/rest/api/3/field');
  if (res.status !== 200) {
    throw new Error(`Jira returned HTTP ${res.status} reading the field list.`);
  }
  const fields = await res.json();
  const list: any[] = Array.isArray(fields) ? fields : [];
  const dev = list.find(f => f?.schema?.custom === DEV_FIELD_TYPE) || list.find(f => f?.name === 'Development');
  const config: SiteConfig = { devFieldId: dev?.id ? String(dev.id) : null, readAt: new Date(now).toISOString() };
  await storage.set(SITE_CONFIG_KEY, config);
  return config;
}
