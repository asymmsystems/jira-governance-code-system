/**
 * Copyright (c) 2026 Asymm Systems. All rights reserved.
 * @author Fahim Farook
 * FourRealities resolver harness, v2 resolvers (Part B "After" column).
 * Same fixture and Jira contract as resolver-perf.test.ts (startAt ignored, nextPageToken paging,
 * no total). The KVS mock rejects a value above 240 KiB and supports a prefix query.
 * App path: FR_APP, default the Part B worktree.
 */
import * as fs from 'fs';
import * as path from 'path';

const APP = process.env.FR_APP || '/home/fahimfarookme/Documents/projects/jira-governance/repository/code/jira-governance-code-system/apps/fourrealities';
const KVS_LIMIT = 240 * 1024;

type Call = { principal: 'asApp' | 'asUser'; method: string; path: string };
const mockState: { calls: Call[]; issues: any[] } = { calls: [], issues: [] };

function mockHandle(principal: 'asApp' | 'asUser', url: any, opts?: any) {
  const p = typeof url === 'string' ? url : url.value;
  const method = opts?.method || 'GET';
  mockState.calls.push({ principal, method, path: p.split('?')[0] });
  let body: any = {};
  let status = 200;
  if (p === '/rest/api/3/field') body = [{ id: 'customfield_10000', name: 'Development' }];
  else if (p === '/rest/api/3/serverInfo') body = { baseUrl: 'https://perf.atlassian.net' };
  else if (p === '/rest/api/3/status') body = [{ id: '1', statusCategory: { key: 'new' } }, { id: '3', statusCategory: { key: 'indeterminate' } }, { id: '10002', statusCategory: { key: 'done' } }];
  else if (p === '/rest/api/3/search/approximate-count') body = { count: mockState.issues.length };
  else if (p.startsWith('/rest/api/3/search/jql')) {
    const q = new URL('https://x' + p).searchParams;
    const max = Number(q.get('maxResults') || 50);
    const start = Number(q.get('nextPageToken') || 0);
    const batch = mockState.issues.slice(start, start + max);
    const next = start + max < mockState.issues.length ? String(start + max) : undefined;
    body = { issues: batch, nextPageToken: next, isLast: !next };
  } else if (/\/remotelink$/.test(p)) {
    const id = p.split('/')[5];
    body = Number(id) % 3 === 0 ? [{ object: { url: 'https://perf.atlassian.net/wiki/spaces/A/pages/' + id, title: 'ADR ' + id } }] : [];
  } else if (/\/rest\/api\/3\/issue\/[^/?]+$/.test(p.split('?')[0])) {
    const id = p.split('/rest/api/3/issue/')[1].split(/[/?]/)[0];
    body = mockState.issues.find(i => i.id === id);
    if (!body) status = 404;
  } else status = 404;
  return Promise.resolve({ status, headers: { get: () => null }, json: async () => body });
}

jest.mock('@forge/api', () => ({
  __esModule: true,
  default: {
    asApp: () => ({ requestJira: (u: any, o?: any) => mockHandle('asApp', u, o) }),
    asUser: () => ({ requestJira: (u: any, o?: any) => mockHandle('asUser', u, o) })
  },
  route: (s: TemplateStringsArray, ...v: any[]) => s.reduce((a, x, i) => a + x + (i < v.length ? String(v[i]) : ''), '')
}));
jest.mock('@forge/kvs', () => ({ kvs: { get: jest.fn(), set: jest.fn(), delete: jest.fn() }, WhereConditions: { beginsWith: (v: string) => v } }));

// eslint-disable-next-line @typescript-eslint/no-var-requires
const app = require(APP + '/src/index');

class CountingStorage {
  store = new Map<string, any>();
  gets = 0; sets = 0; deletes = 0; queries = 0;
  maxBytes: Record<string, number> = {};
  async get(key: string) { this.gets++; const v = this.store.get(key); return v === undefined ? undefined : JSON.parse(JSON.stringify(v)); }
  async set(key: string, value: any) {
    this.sets++;
    const bytes = Buffer.byteLength(JSON.stringify(value), 'utf8');
    const k = key.replace(/fr:issue:[^:]+:/, 'fr:issue:{id}:').replace(/chunk:\d+/, 'chunk:{i}');
    this.maxBytes[k] = Math.max(this.maxBytes[k] || 0, bytes);
    if (bytes > KVS_LIMIT) throw new Error(`KVS value too large: ${key} ${bytes} bytes`);
    this.store.set(key, JSON.parse(JSON.stringify(value)));
  }
  async delete(key: string) { this.deletes++; this.store.delete(key); }
  async queryPrefix(prefix: string, cursor?: string) {
    this.queries++;
    const keys = Array.from(this.store.keys()).filter(k => k.startsWith(prefix)).sort();
    const start = cursor ? Number(cursor) : 0;
    return { results: keys.slice(start, start + 100).map(key => ({ key, value: this.store.get(key) })), nextCursor: start + 100 < keys.length ? String(start + 100) : undefined };
  }
}

function rng(seed: number) { return () => { seed = (seed * 1103515245 + 12345) % 2147483648; return seed / 2147483648; }; }
function makeIssues(n: number) {
  const r = rng(42);
  const people = ['Ana Silva', 'Bo Chen', 'Chandra Perera', 'Dee Okafor', 'Eli Novak', 'Fatima Rahman'];
  const out: any[] = [];
  for (let i = 1; i <= n; i++) {
    const x = r();
    const cat = x < 0.3 ? 'new' : x < 0.6 ? 'indeterminate' : 'done';
    const histories: any[] = [];
    if (cat !== 'new') {
      histories.push({ items: [{ field: 'status', fromString: 'To Do', toString: 'In Progress' }] });
      if (r() < 0.6) histories.push({ items: [{ field: 'status', fromString: 'In Progress', toString: 'In Review' }] });
      if (r() < 0.25) histories.push({ items: [{ field: 'status', fromString: 'In Review', toString: 'In Progress' }] });
      if (cat === 'done') histories.push({ items: [{ field: 'status', fromString: 'In Review', toString: 'Done' }] });
    }
    const props: any = {};
    if (cat === 'done' && r() < 0.5) props['ledgerseal-cert'] = { status: 'SEAL_VALID', certificateId: '3f2b8c1e-9d4a-4e7b-8c2d-1a2b3c4d5e6f', snapshotHash: 'a'.repeat(64), sealedAt: '2026-10-01T00:00:00.000Z', isCompromised: false };
    if (cat !== 'new' && r() < 0.5) props['definitionguard-dod'] = { isFullySatisfied: r() < 0.7, completedCount: 4, totalCount: 5, checklistHash: 'd'.repeat(64) };
    out.push({
      id: String(10000 + i), key: 'PERF-' + i,
      fields: {
        summary: `Perf issue ${i}: deliver part of the payment settlement flow`,
        status: { name: cat, statusCategory: { key: cat } },
        assignee: { displayName: people[i % people.length] },
        issuelinks: r() < 0.3 ? [{ type: { inward: 'is implemented by', outward: 'implements' }, outwardIssue: { key: 'PERF-0', fields: { summary: 'x', issuetype: { name: 'Decision' } } } }] : [],
        customfield_10020: [{ name: 'Sprint ' + (1 + (i % 6)) }],
        customfield_10000: r() < 0.5 ? '{pullrequest={dataType=pullrequest, state=MERGED, stateCount=1}}' : '{}'
      },
      properties: props,
      changelog: { histories }
    });
  }
  return out;
}

const results: any[] = [];
const VIEWS = 52;

describe('FourRealities v2 resolver harness', () => {
  for (const n of [50, 300, 1000]) {
    it(`getProjectDashboard with ${n} issues, ${VIEWS} page views`, async () => {
      mockState.issues = makeIssues(n);
      const storage = new CountingStorage();
      const views: any[] = [];
      for (let v = 1; v <= VIEWS; v++) {
        mockState.calls = [];
        const g0 = storage.gets, s0 = storage.sets, q0 = storage.queries;
        const t0 = process.hrtime.bigint();
        let err: string | undefined; let res: any;
        try {
          res = await app.getProjectDashboard({}, { extension: { project: { key: 'PERF' } }, accountId: 'acc-1' }, storage);
          if (!res.ok) err = res.error.message;
        } catch (e: any) { err = e.message; }
        const ms = Number(process.hrtime.bigint() - t0) / 1e6;
        views.push({
          view: v, cpuMs: Math.round(ms * 10) / 10,
          jiraCalls: mockState.calls.length,
          jiraByPrincipal: { asApp: mockState.calls.filter(c => c.principal === 'asApp').length, asUser: mockState.calls.filter(c => c.principal === 'asUser').length },
          kvsGets: storage.gets - g0, kvsSets: storage.sets - s0, kvsQueries: storage.queries - q0,
          rows: res?.rows?.length ?? 0, uniqueIssues: res?.rows ? new Set(res.rows.map((r: any) => r.issueId)).size : 0,
          averageRAI: res?.summary?.averageRAI, error: err
        });
      }
      const failures = views.filter(v => v.error);
      results.push({
        resolver: 'getProjectDashboard', issues: n, views: [views[0], views[1], views[VIEWS - 1]],
        failures: failures.length, firstError: failures[0]?.error ?? null,
        maxValueBytes: storage.maxBytes,
        maxReadViewCpuMs: Math.max(...views.slice(1).map(v => v.cpuMs)),
        maxReadViewKvsGets: Math.max(...views.slice(1).map(v => v.kvsGets))
      });
      expect(failures).toEqual([]);
    });
  }

  it('refreshProjectSnapshot with 1000 issues (build cost)', async () => {
    mockState.issues = makeIssues(1000);
    const storage = new CountingStorage();
    mockState.calls = [];
    const t0 = process.hrtime.bigint();
    const res = await app.refreshProjectSnapshot({}, { extension: { project: { key: 'PERF' } }, accountId: 'acc-1' }, storage);
    const ms = Number(process.hrtime.bigint() - t0) / 1e6;
    results.push({
      resolver: 'refreshProjectSnapshot', issues: 1000, ok: res.ok, cpuMs: Math.round(ms * 10) / 10,
      jiraCalls: mockState.calls.length,
      searchCalls: mockState.calls.filter(c => c.path === '/rest/api/3/search/jql').length,
      remoteLinkCalls: mockState.calls.filter(c => c.path.endsWith('/remotelink')).length,
      kvsGets: storage.gets, kvsSets: storage.sets, kvsQueries: storage.queries, maxValueBytes: storage.maxBytes
    });
    expect(res.ok).toBe(true);
  });

  it('runScheduledSnapshot with 1000 issues (daily run)', async () => {
    mockState.issues = makeIssues(1000);
    const storage = new CountingStorage();
    await storage.set('fr:projects', ['PERF']);
    mockState.calls = [];
    const t0 = process.hrtime.bigint();
    const res = await app.runScheduledSnapshot(storage);
    const ms = Number(process.hrtime.bigint() - t0) / 1e6;
    results.push({
      resolver: 'runScheduledSnapshot', issues: 1000, result: res, wallMs: Math.round(ms * 10) / 10,
      jiraCalls: mockState.calls.length,
      searchCalls: mockState.calls.filter(c => c.path === '/rest/api/3/search/jql').length,
      remoteLinkCalls: mockState.calls.filter(c => c.path.endsWith('/remotelink')).length
    });
    expect(res.built).toEqual(['PERF']);
  });

  it('getIssueAlignment for one issue (site config cached)', async () => {
    mockState.issues = makeIssues(50);
    const storage = new CountingStorage();
    const target = mockState.issues.find(i => i.fields.status.statusCategory.key === 'done');
    await app.getIssueAlignment({}, { extension: { issue: { id: target.id, key: target.key } } }, storage);
    mockState.calls = [];
    const t0 = process.hrtime.bigint();
    const res = await app.getIssueAlignment({}, { extension: { issue: { id: target.id, key: target.key } } }, storage);
    const ms = Number(process.hrtime.bigint() - t0) / 1e6;
    results.push({ resolver: 'getIssueAlignment', cpuMs: Math.round(ms * 10) / 10, jiraCalls: mockState.calls.map(c => `${c.principal} ${c.method} ${c.path}`), gates: res.row.gates });
    expect(mockState.calls.every(c => c.principal === 'asUser')).toBe(true);
  });

  afterAll(() => {
    const dir = path.join(__dirname, 'results');
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, process.env.FR_OUT || 'resolver-after.json'), JSON.stringify({ runAt: new Date().toISOString(), app: APP, node: process.version, results }, null, 2));
  });
});
