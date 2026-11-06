/**
 * Copyright (c) 2026 Asymm Systems. All rights reserved.
 * @author Fahim Farook
 * FourRealities resolver harness (Part A baseline, reused in Part B).
 *
 * Calls getProjectDashboard and getIssueAlignment against a mocked Jira that follows the
 * enhanced /rest/api/3/search/jql contract seen live in the audit (section 7.1 item 3):
 * startAt is ignored, the response has no `total`, paging is by nextPageToken / isLast.
 * Measures CPU time per call, Jira calls per principal, KVS operations and KVS value sizes.
 * The KVS mock rejects a value above 240 KiB, which is the documented Forge limit.
 */
import * as fs from 'fs';
import * as path from 'path';

const APP = '/home/fahimfarookme/Documents/projects/jira-governance/repository/code/jira-governance-code-system/apps/fourrealities';
const KVS_LIMIT = 240 * 1024;

type Call = { principal: 'asApp' | 'asUser'; method: string; path: string };
const mockState: { calls: Call[]; issues: any[] } = { calls: [], issues: [] };

function mockSearch(url: string) {
  const q = new URL('https://x' + url).searchParams;
  const max = Math.min(Number(q.get('maxResults') || 50), 100);
  const token = q.get('nextPageToken');
  const start = token ? Number(token) : 0; // startAt is ignored, as live
  const batch = mockState.issues.slice(start, start + max);
  const next = start + max < mockState.issues.length ? String(start + max) : undefined;
  return { issues: batch, nextPageToken: next, isLast: !next };
}

function mockHandle(principal: 'asApp' | 'asUser', url: string, opts?: any) {
  const method = opts?.method || 'GET';
  mockState.calls.push({ principal, method, path: url.split('?')[0] });
  let body: any = {};
  let status = 200;
  if (url.startsWith('/rest/api/3/search/jql')) {
    body = mockSearch(url);
  } else if (/\/rest\/api\/3\/issue\/[^/?]+\/remotelink/.test(url)) {
    body = [];
  } else if (url.startsWith('/rest/dev-status/')) {
    body = { detail: [] };
  } else if (/\/rest\/api\/3\/issue\/[^/?]+/.test(url)) {
    const id = url.split('/rest/api/3/issue/')[1].split(/[/?]/)[0];
    body = mockState.issues.find(i => i.id === id);
    if (!body) status = 404;
  }
  return Promise.resolve({ status, json: async () => body });
}

jest.mock('@forge/api', () => ({
  __esModule: true,
  default: {
    asApp: () => ({ requestJira: (u: string, o?: any) => mockHandle('asApp', u, o) }),
    asUser: () => ({ requestJira: (u: string, o?: any) => mockHandle('asUser', u, o) })
  },
  route: (s: TemplateStringsArray, ...v: any[]) => s.reduce((a, x, i) => a + x + (i < v.length ? String(v[i]) : ''), '')
}));
jest.mock('@forge/kvs', () => ({ kvs: { get: jest.fn(), set: jest.fn(), delete: jest.fn() } }));

// eslint-disable-next-line @typescript-eslint/no-var-requires
const app = require(APP + '/src/index');

class CountingStorage {
  store = new Map<string, any>();
  gets = 0; sets = 0; deletes = 0;
  maxBytes: Record<string, number> = {};
  async get(key: string) { this.gets++; return this.store.get(key); }
  async set(key: string, value: any) {
    this.sets++;
    const bytes = Buffer.byteLength(JSON.stringify(value), 'utf8');
    const k = key.replace(/fr:issue:[^:]+:/, 'fr:issue:{id}:');
    this.maxBytes[k] = Math.max(this.maxBytes[k] || 0, bytes);
    if (bytes > KVS_LIMIT) throw new Error(`KVS value too large: ${key} ${bytes} bytes`);
    this.store.set(key, JSON.parse(JSON.stringify(value)));
  }
  async delete(key: string) { this.deletes++; this.store.delete(key); }
}

// Deterministic fixture: realistic mix of status categories, links, properties and changelog.
function rng(seed: number) { return () => { seed = (seed * 1103515245 + 12345) % 2147483648; return seed / 2147483648; }; }
function makeIssues(n: number) {
  const r = rng(42);
  const cats = ['To Do', 'In Progress', 'Done'];
  const people = ['Ana Silva', 'Bo Chen', 'Chandra Perera', 'Dee Okafor', 'Eli Novak', 'Fatima Rahman'];
  const out: any[] = [];
  for (let i = 1; i <= n; i++) {
    const x = r();
    const cat = x < 0.3 ? 'To Do' : x < 0.6 ? 'In Progress' : 'Done';
    const histories: any[] = [];
    if (cat !== 'To Do') {
      histories.push({ items: [{ field: 'status', fromString: 'To Do', toString: 'In Progress' }] });
      if (r() < 0.6) histories.push({ items: [{ field: 'status', fromString: 'In Progress', toString: 'In Review' }] });
      if (r() < 0.25) histories.push({ items: [{ field: 'status', fromString: 'In Review', toString: 'In Progress' }] });
      if (cat === 'Done') histories.push({ items: [{ field: 'status', fromString: 'In Review', toString: 'Done' }] });
      for (let h = 0; h < 4; h++) histories.push({ items: [{ field: 'description', fromString: 'x'.repeat(40), toString: 'y'.repeat(60) }] });
    }
    const props: any = {};
    if (cat === 'Done' && r() < 0.5) props['ledgerseal-cert'] = { status: 'SEAL_VALID', certificateId: 'c-' + i, snapshotHash: 'h'.repeat(64), sealedAt: '2026-10-01T00:00:00Z', tamperedFieldCount: 0, isCompromised: false };
    if (cat !== 'To Do' && r() < 0.5) props['definitionguard-dod'] = { isFullySatisfied: r() < 0.7, completedCount: 4, totalCount: 5, checklistHash: 'd'.repeat(64) };
    out.push({
      id: String(10000 + i), key: 'PERF-' + i,
      fields: {
        summary: `Perf issue ${i}: deliver part of the payment settlement flow`,
        status: { name: cat === 'Done' ? 'Done' : cat, statusCategory: { name: cat } },
        issuetype: { name: 'Story' },
        assignee: { displayName: people[i % people.length] },
        issuelinks: r() < 0.3 ? [{ type: { inward: 'is implemented by', outward: 'implements' }, outwardIssue: { fields: { summary: '[ADR] Decision ' + i } } }] : [],
        customfield_10020: [{ name: 'Sprint ' + (1 + (i % 6)) }]
      },
      properties: props,
      changelog: { histories }
    });
  }
  return out;
}

const results: any[] = [];

describe('FourRealities resolver harness', () => {
  for (const n of [50, 300, 1000]) {
    it(`getProjectDashboard with ${n} issues, 11 page views`, async () => {
      mockState.issues = makeIssues(n);
      const storage = new CountingStorage();
      const views: any[] = [];
      for (let v = 1; v <= 11; v++) {
        mockState.calls = [];
        const g0 = storage.gets, s0 = storage.sets;
        const t0 = process.hrtime.bigint();
        let err: string | undefined; let snap: any;
        try {
          snap = await app.getProjectDashboard({}, { extension: { project: { key: 'PERF' } }, accountId: 'acc-1' }, storage);
        } catch (e: any) { err = e.message; }
        const ms = Number(process.hrtime.bigint() - t0) / 1e6;
        const rows = snap?.issueScores?.length ?? 0;
        const unique = snap ? new Set(snap.issueScores.map((s: any) => s.issueId)).size : 0;
        views.push({
          view: v, cpuMs: Math.round(ms * 10) / 10,
          jiraCalls: mockState.calls.length,
          jiraByPrincipal: { asApp: mockState.calls.filter(c => c.principal === 'asApp').length, asUser: mockState.calls.filter(c => c.principal === 'asUser').length },
          kvsGets: storage.gets - g0, kvsSets: storage.sets - s0,
          rows, uniqueIssues: unique, averageRAI: snap?.summary?.averageRAI, error: err
        });
      }
      const firstFail = views.find(v => v.error);
      results.push({ resolver: 'getProjectDashboard', issues: n, views, maxValueBytes: storage.maxBytes, firstFailingView: firstFail?.view ?? null, firstError: firstFail?.error ?? null });
      expect(views[0].jiraCalls).toBeGreaterThan(0);
    });
  }

  it('getIssueAlignment for one issue', async () => {
    mockState.issues = makeIssues(50);
    const storage = new CountingStorage();
    const target = mockState.issues.find(i => i.fields.status.statusCategory.name === 'Done');
    mockState.calls = [];
    const t0 = process.hrtime.bigint();
    const score = await app.getIssueAlignment({}, { extension: { issue: { id: target.id, key: target.key } }, accountId: 'acc-1' }, storage);
    const ms = Number(process.hrtime.bigint() - t0) / 1e6;
    results.push({
      resolver: 'getIssueAlignment', cpuMs: Math.round(ms * 10) / 10,
      jiraCalls: mockState.calls.map(c => `${c.principal} ${c.method} ${c.path}`),
      kvsGets: storage.gets, kvsSets: storage.sets, maxValueBytes: storage.maxBytes,
      gates: score.gates
    });
    expect(mockState.calls.length).toBe(5);
  });

  afterAll(() => {
    const dir = path.join(__dirname, 'results');
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, 'resolver-baseline.json'), JSON.stringify({ runAt: new Date().toISOString(), node: process.version, results }, null, 2));
  });
});
