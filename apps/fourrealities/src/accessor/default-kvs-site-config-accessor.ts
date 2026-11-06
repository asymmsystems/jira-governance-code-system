/**
 * Copyright (c) 2026 Asymm Systems. All rights reserved.
 * @author Fahim Farook
 * FourRealities: per-site configuration read from Jira and cached in KVS for 24 hours.
 */

import { route } from '@forge/api';
import { SiteConfig, StatusCategory } from '../contract/data/models';
import { SiteConfigAccessor, StorageProvider } from '../contract/accessors';
import { JiraRequest } from './jira-request';
import { JiraFieldJson, JiraStatusJson } from './jira-types';

export const SITE_CONFIG_KEY = 'fr:cfg:site';
export const SITE_CONFIG_TTL_MS = 24 * 60 * 60 * 1000;

const DEV_FIELD_TYPE = 'com.atlassian.jira.plugins.jira-development-integration-plugin:devsummarycf';

/** Host of the site from serverInfo; null when it cannot be read. Not fatal: only same-site links depend on it. */
async function readSiteHost(request: JiraRequest): Promise<string | null> {
  try {
    const res = await request(route`/rest/api/3/serverInfo`);
    if (res.status !== 200) return null;
    return new URL(String(((await res.json()) as { baseUrl?: string } | null)?.baseUrl)).host || null;
  } catch {
    return null;
  }
}

const CATEGORY_KEYS: StatusCategory[] = ['new', 'indeterminate', 'done'];

/** Status id to category key for every status on the site (read:jira-work). Statuses without both are left out. */
async function readStatusCategories(request: JiraRequest): Promise<Record<string, StatusCategory>> {
  const res = await request(route`/rest/api/3/status`);
  if (res.status !== 200) {
    throw new Error(`Jira returned HTTP ${res.status} reading the status list.`);
  }
  const body = await res.json();
  const statuses: JiraStatusJson[] = Array.isArray(body) ? body : [];
  const categories: Record<string, StatusCategory> = {};
  for (const s of statuses) {
    const key = s?.statusCategory?.key as StatusCategory | undefined;
    if (s?.id !== undefined && key && CATEGORY_KEYS.includes(key)) categories[String(s.id)] = key;
  }
  return categories;
}

/**
 * Whether any issue the reader can see has pull request data (ADR-011, F-H5). Jira Software sites
 * have a Development field even without a Git integration, so the field alone does not show that
 * Code evidence can exist. null when the probe fails.
 */
async function readPullRequestsSeen(request: JiraRequest): Promise<boolean | null> {
  try {
    const jql = 'development[pullrequests].all > 0';
    const res = await request(route`/rest/api/3/search/jql?jql=${jql}&maxResults=1&fields=created`);
    if (res.status !== 200) return null;
    const body = (await res.json()) as { issues?: unknown[] } | null;
    return Array.isArray(body?.issues) && body.issues.length > 0;
  } catch {
    return null;
  }
}

/**
 * Returns the cached site configuration, or reads the field list, the status categories and the
 * site host and caches them. A cache written before status categories or the pull request probe
 * existed is read again.
 * The Development field is found by its custom type or by its name, never by a fixed id.
 */
export async function getSiteConfig(storage: StorageProvider, request: JiraRequest, now: number = Date.now()): Promise<SiteConfig> {
  const cached = await storage.get<SiteConfig>(SITE_CONFIG_KEY);
  if (cached && cached.statusCategories && cached.pullRequestsSeen !== undefined && now - Date.parse(cached.readAt) < SITE_CONFIG_TTL_MS) {
    return cached;
  }
  const res = await request(route`/rest/api/3/field`);
  if (res.status !== 200) {
    throw new Error(`Jira returned HTTP ${res.status} reading the field list.`);
  }
  const fields = await res.json();
  const list: JiraFieldJson[] = Array.isArray(fields) ? fields : [];
  const dev = list.find(f => f?.schema?.custom === DEV_FIELD_TYPE) || list.find(f => f?.name === 'Development');
  const statusCategories = await readStatusCategories(request);
  const devFieldId = dev?.id ? String(dev.id) : null;
  const pullRequestsSeen = devFieldId ? await readPullRequestsSeen(request) : false;
  const config: SiteConfig = { devFieldId, siteHost: await readSiteHost(request), statusCategories, pullRequestsSeen, readAt: new Date(now).toISOString() };
  await storage.set(SITE_CONFIG_KEY, config);
  return config;
}

export class DefaultKvsSiteConfigAccessor implements SiteConfigAccessor {
  readonly serviceType = 'accessor' as const;

  constructor(private readonly storage: StorageProvider, private readonly request: JiraRequest) {}

  get(): Promise<SiteConfig> {
    return getSiteConfig(this.storage, this.request);
  }
}
