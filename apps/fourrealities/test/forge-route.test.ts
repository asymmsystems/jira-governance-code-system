/**
 * Copyright (c) 2026 Asymm Systems. All rights reserved.
 * @author Fahim Farook
 * FourRealities: resolver calls through the real @forge/api route tag. Only the principals are mocked,
 * so a route that Forge would reject ("Disallowing path manipulation attempt") fails here.
 */

const mockRequests: Array<{ principal: string; path: string; init?: any }> = [];
const mockRespond = jest.fn();

jest.mock('@forge/api', () => {
  const actual = jest.requireActual('@forge/api');
  const client = (principal: string) => ({
    requestJira: (r: any, init?: any) => {
      mockRequests.push({ principal, path: r.value, init });
      return Promise.resolve(mockRespond(r.value, init));
    }
  });
  return { ...actual, __esModule: true, default: { ...actual.default, asApp: () => client('app'), asUser: () => client('user') } };
});
jest.mock('@forge/kvs', () => ({ kvs: { get: jest.fn(), set: jest.fn(), delete: jest.fn() } }));

import { getIssueAlignment, getProjectDashboard } from '../src/index';

class MapStorage {
  store = new Map<string, any>();
  async get(key: string) { return this.store.get(key); }
  async set(key: string, value: any) { this.store.set(key, value); }
  async delete(key: string) { this.store.delete(key); }
}

const issue = { id: '60001', key: 'DEMO-60', fields: { summary: 'S', status: { name: 'In Progress', statusCategory: { key: 'indeterminate' } } }, properties: {} };

function respond(path: string): any {
  if (path === '/rest/api/3/field') return { status: 200, json: async () => [{ id: 'customfield_10000', name: 'Development' }] };
  if (path === '/rest/api/3/serverInfo') return { status: 200, json: async () => ({ baseUrl: 'https://asymmsystems.atlassian.net' }) };
  if (path.startsWith('/rest/api/3/search/jql')) return { status: 200, json: async () => ({ issues: [issue] }) };
  if (path.endsWith('/remotelink')) return { status: 200, json: async () => [] };
  if (path.startsWith('/rest/api/3/issue/60001?')) return { status: 200, json: async () => issue };
  return { status: 404, json: async () => ({}) };
}

describe('resolvers build valid Forge routes', () => {
  beforeEach(() => {
    mockRequests.length = 0;
    mockRespond.mockReset();
    mockRespond.mockImplementation(respond);
  });

  it('reads the issue panel with an empty site-config cache', async () => {
    const res: any = await getIssueAlignment({}, { extension: { issue: { id: '60001', key: 'DEMO-60' } } }, new MapStorage());
    expect(res.ok).toBe(true);
    expect(mockRequests.map(r => r.path)).toEqual(expect.arrayContaining(['/rest/api/3/field', '/rest/api/3/serverInfo', '/rest/api/3/issue/60001/remotelink']));
  });

  it('reads the dashboard with remote links for started issues', async () => {
    const res: any = await getProjectDashboard({}, { extension: { project: { key: 'DEMO' } } }, new MapStorage());
    expect(res.ok).toBe(true);
    expect(res.rows[0].gates.intent.state).toBe('MISSING');
    expect(mockRequests.map(r => r.path)).toContain('/rest/api/3/issue/60001/remotelink');
  });
});
