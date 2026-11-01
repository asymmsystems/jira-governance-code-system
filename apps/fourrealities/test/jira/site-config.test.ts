/**
 * Copyright (c) 2026 Asymm Systems. All rights reserved.
 * @author Fahim Farook
 * FourRealities: site configuration (Development field lookup) unit tests
 */

import { SITE_CONFIG_KEY, getSiteConfig } from '../../src/jira/site-config';

// These tests use the real @forge/api route tag, so a path that the tag would reject fails here.
const pathOf = (r: any): string => (typeof r === 'string' ? r : r.value);

class MapStorage {
  store = new Map<string, any>();
  async get(key: string) { return this.store.get(key); }
  async set(key: string, value: any) { this.store.set(key, value); }
  async delete(key: string) { this.store.delete(key); }
}

const fields = [
  { id: 'summary', name: 'Summary' },
  { id: 'customfield_10042', name: 'Development', schema: { custom: 'com.atlassian.jira.plugins.jira-development-integration-plugin:devsummarycf' } }
];

describe('getSiteConfig', () => {
  const NOW = Date.parse('2026-11-01T10:00:00Z');

  it('finds the Development field by name and caches it', async () => {
    const storage = new MapStorage();
    const request = jest.fn().mockResolvedValue({ status: 200, json: async () => fields });
    const first = await getSiteConfig(storage, request, NOW);
    expect(first.devFieldId).toBe('customfield_10042');
    expect((await storage.get(SITE_CONFIG_KEY)).devFieldId).toBe('customfield_10042');
    expect(request.mock.calls.map(c => pathOf(c[0]))).toEqual(['/rest/api/3/field', '/rest/api/3/serverInfo']);
    const second = await getSiteConfig(storage, request, NOW + 60_000);
    expect(second.devFieldId).toBe('customfield_10042');
    expect(request).toHaveBeenCalledTimes(2);
  });

  it('finds the field by its custom type when the name differs', async () => {
    const request = jest.fn().mockResolvedValue({ status: 200, json: async () => [{ id: 'customfield_7', name: 'Entwicklung', schema: { custom: 'com.atlassian.jira.plugins.jira-development-integration-plugin:devsummarycf' } }] });
    expect((await getSiteConfig(new MapStorage(), request, NOW)).devFieldId).toBe('customfield_7');
  });

  it('records null when the site has no Development field', async () => {
    const storage = new MapStorage();
    const request = jest.fn().mockResolvedValue({ status: 200, json: async () => [{ id: 'summary', name: 'Summary' }] });
    expect((await getSiteConfig(storage, request, NOW)).devFieldId).toBeNull();
    expect((await storage.get(SITE_CONFIG_KEY)).devFieldId).toBeNull();
  });

  it('reads the field list again after 24 hours', async () => {
    const storage = new MapStorage();
    await storage.set(SITE_CONFIG_KEY, { devFieldId: 'customfield_1', readAt: '2026-10-31T09:00:00.000Z' });
    const request = jest.fn().mockResolvedValue({ status: 200, json: async () => fields });
    expect((await getSiteConfig(storage, request, NOW)).devFieldId).toBe('customfield_10042');
  });

  it('throws when Jira refuses the field list, and caches nothing', async () => {
    const storage = new MapStorage();
    const request = jest.fn().mockResolvedValue({ status: 401, json: async () => ({}) });
    await expect(getSiteConfig(storage, request, NOW)).rejects.toThrow('Jira returned HTTP 401 reading the field list.');
    expect(await storage.get(SITE_CONFIG_KEY)).toBeUndefined();
    const notArray = jest.fn().mockResolvedValue({ status: 200, json: async () => ({}) });
    expect((await getSiteConfig(storage, notArray, NOW)).devFieldId).toBeNull();
  });

  it('reads the site host from serverInfo and keeps null when it cannot', async () => {
    const request = jest.fn((r: any) => Promise.resolve(pathOf(r) === '/rest/api/3/serverInfo'
      ? { status: 200, json: async () => ({ baseUrl: 'https://asymmsystems.atlassian.net' }) }
      : { status: 200, json: async () => fields }));
    expect((await getSiteConfig(new MapStorage(), request, NOW)).siteHost).toBe('asymmsystems.atlassian.net');
    const failing = jest.fn((r: any) => Promise.resolve(pathOf(r) === '/rest/api/3/serverInfo'
      ? { status: 403, json: async () => ({}) }
      : { status: 200, json: async () => fields }));
    expect((await getSiteConfig(new MapStorage(), failing, NOW)).siteHost).toBeNull();
    const badUrl = jest.fn((r: any) => Promise.resolve(pathOf(r) === '/rest/api/3/serverInfo'
      ? { status: 200, json: async () => ({ baseUrl: 'not a url' }) }
      : { status: 200, json: async () => fields }));
    expect((await getSiteConfig(new MapStorage(), badUrl, NOW)).siteHost).toBeNull();
  });
});

