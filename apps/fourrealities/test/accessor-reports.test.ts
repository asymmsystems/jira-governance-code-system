/**
 * Copyright (c) 2026 Asymm Systems. All rights reserved.
 * @author Fahim Farook
 * FourRealities: the evidence report Accessors (ADR-015): the Jira reads, the FSRT-form permission check,
 * the KVS records, Object Store "written once", the queue, hashes and the signature, party tokens, the
 * runtime facts, people as the user, and the token map in the personal data report and erasure.
 */

import * as crypto from 'crypto';

const asUserRequest = jest.fn();
const appContext = jest.fn();
jest.mock('@forge/api', () => ({
  __esModule: true,
  default: { asUser: () => ({ requestJira: (...a: unknown[]) => asUserRequest(...a) }), asApp: () => ({ requestJira: jest.fn() }) },
  route: (strings: TemplateStringsArray, ...values: unknown[]) => strings.reduce((acc, part, i) => acc + part + (i < values.length ? String(values[i]) : ''), ''),
  assumeTrustedRoute: (p: string) => p,
  getAppContext: () => appContext()
}));
const kvsSet = jest.fn();
const kvsGet = jest.fn();
const txSet = jest.fn();
const txExecute = jest.fn();
jest.mock('@forge/kvs', () => ({
  kvs: {
    set: (...a: unknown[]) => kvsSet(...a),
    get: (...a: unknown[]) => kvsGet(...a),
    transact: () => {
      const tx = { set: (...a: unknown[]) => { txSet(...a); return tx; }, execute: () => txExecute() };
      return tx;
    }
  },
  WhereConditions: { beginsWith: (v: string) => v }
}));

import { DefaultForgeJiraReportAccessor, changelogEntry, changelogTime } from '../src/accessor/default-forge-jira-report-accessor';
import { reportPermissionsAsUser, retryWaitMs, setPermissionPause } from '../src/accessor/default-forge-report-permission-accessor';
import { DefaultKvsReportStoreAccessor } from '../src/accessor/default-kvs-report-store-accessor';
import { DefaultForgeObjectStoreAccessor, ObjectStoreClient } from '../src/accessor/default-forge-object-store-accessor';
import { DefaultForgeReportQueueAccessor } from '../src/accessor/default-forge-report-queue-accessor';
import { DefaultReportCryptoAccessor } from '../src/accessor/default-report-crypto-accessor';
import { DefaultKvsPartyTokenAccessor } from '../src/accessor/default-kvs-party-token-accessor';
import { DefaultForgeReportRuntimeAccessor } from '../src/accessor/default-forge-report-runtime-accessor';
import { DefaultForgeReportPeopleAccessor } from '../src/accessor/default-forge-report-people-accessor';
import { DefaultKvsPersonalDataAccessor } from '../src/accessor/default-kvs-personal-data-accessor';
import { DefaultForgeKvsStore } from '../src/accessor/default-forge-kvs-store';
import { DEFAULT_REPORT_SETTINGS, ReportIndexEntry, ReportJob } from '../src/contract/data/reports';
import { MemoryStorage } from './storage/memory-storage';

type Res = { status: number; json?: unknown; headers?: Record<string, string> };
const res = (r: Res) => ({ status: r.status, json: async () => r.json, headers: { get: (n: string) => r.headers?.[n] ?? null } });
/** A JiraRequest that answers from a list, and records each call. */
function fakeRequest(answers: Res[]) {
  const calls: Array<{ path: string; body?: Record<string, unknown> }> = [];
  const request = jest.fn(async (path: unknown, init?: { body?: string }) => {
    calls.push({ path: String(path), ...(init?.body ? { body: JSON.parse(init.body) } : {}) });
    const next = answers.shift();
    if (!next) throw new Error('no answer');
    return res(next);
  });
  return { request, calls };
}
const FAR = Date.now() + 60_000;

describe('Jira report reads', () => {
  it('pages an id search to the end, stops above the limit, and fails a read cut by the deadline', async () => {
    const f = fakeRequest([{ status: 200, json: { issues: [{ id: 1 }, { id: 2 }], nextPageToken: 't', isLast: false } }, { status: 200, json: { issues: [{ id: 3 }], isLast: true } }]);
    const jira = new DefaultForgeJiraReportAccessor(f.request);
    expect(await jira.searchIds('project = 1', 10, FAR)).toEqual({ status: 200, ids: ['1', '2', '3'], keys: {} });
    expect(f.calls[1]).toEqual({ path: '/rest/api/3/search/jql', body: { jql: 'project = 1', fields: ['id'], maxResults: 5000, nextPageToken: 't' } });
    const over = fakeRequest([{ status: 200, json: { issues: [{ id: 1 }, { id: 2 }], nextPageToken: 't' } }]);
    expect((await new DefaultForgeJiraReportAccessor(over.request).searchIds('j', 1, FAR)).ids).toEqual(['1', '2']);
    const late = fakeRequest([{ status: 200, json: { issues: [{ id: 1 }], nextPageToken: 't' } }]);
    expect(await new DefaultForgeJiraReportAccessor(late.request).searchIds('j', 10, Date.now() - 1)).toEqual({ status: 504, ids: [], keys: {} });
    const failed = fakeRequest([{ status: 403, json: {} }]);
    expect(await new DefaultForgeJiraReportAccessor(failed.request).searchIds('j', 10, FAR)).toEqual({ status: 403, ids: [], keys: {} });
    const keyed = fakeRequest([{ status: 200, json: { issues: [{ id: 5, key: 'PAY-5' }, { id: 6 }], isLast: true } }]);
    expect(await new DefaultForgeJiraReportAccessor(keyed.request).searchIds('j', 10, FAR)).toEqual({ status: 200, ids: ['5', '6'], keys: { '5': 'PAY-5' } });
    const empty = fakeRequest([{ status: 200, json: null }]);
    expect(await new DefaultForgeJiraReportAccessor(empty.request).searchIds('j', 10, FAR)).toEqual({ status: 200, ids: [], keys: {} });
  });

  it('checks which ids a search returns, 500 per call, digits only; null on a failed call or the deadline', async () => {
    const ids = Array.from({ length: 501 }, (_, i) => String(i + 1));
    const f = fakeRequest([{ status: 200, json: { issues: [{ id: 1 }, { id: 2 }] } }, { status: 200, json: {} }]);
    const jira = new DefaultForgeJiraReportAccessor(f.request);
    expect(await jira.presentAmong([...ids, 'x) OR id > 0'], FAR)).toEqual(new Set(['1', '2']));
    expect(String(f.calls[0].body?.jql).split(',')).toHaveLength(500);
    expect(f.calls[1].body?.jql).toBe('id in (501)');
    expect(await new DefaultForgeJiraReportAccessor(fakeRequest([{ status: 500 }]).request).presentAmong(['1'], FAR)).toBeNull();
    expect(await new DefaultForgeJiraReportAccessor(fakeRequest([]).request).presentAmong(['1'], Date.now() - 1)).toBeNull();
    expect(await new DefaultForgeJiraReportAccessor(fakeRequest([]).request).presentAmong(['bad'], FAR)).toEqual(new Set());
  });

  it('reads the gate facts and report basics of a batch in one search', async () => {
    const f = fakeRequest([{ status: 200, json: { issues: [{ id: 7, key: 'PAY-7', fields: { summary: 'S', created: '2026-10-02T10:00:00.000+0100', issuetype: { name: 'Bug' }, status: { id: '3', statusCategory: { key: 'done' } } }, properties: {} }, { id: 8, key: 'PAY-8' }] } }]);
    const jira = new DefaultForgeJiraReportAccessor(f.request);
    const out = await jira.factsByIds(['7', '8', 'x'], { devFieldId: 'customfield_9', siteHost: 'h', statusCategories: {}, readAt: 't' });
    expect(out.status).toBe(200);
    expect(out.issues[0].basics).toEqual({ issueId: '7', issueKey: 'PAY-7', issueTypeName: 'Bug', created: '2026-10-02T09:00:00.000Z', statusId: '3' });
    expect(out.issues[0].facts.statusCategory).toBe('done');
    expect(out.issues[1].basics).toEqual({ issueId: '8', issueKey: 'PAY-8', issueTypeName: '', created: '1970-01-01T00:00:00.000Z', statusId: '' });
    expect(f.calls[0].body).toMatchObject({ jql: 'id in (7,8)', expand: 'changelog', properties: ['ledgerseal-cert', 'definitionguard-dod', 'checklist'], maxResults: 100 });
    expect(f.calls[0].body?.fields).toEqual(expect.arrayContaining(['customfield_9', 'created', 'issuetype', 'status']));
    expect(await jira.factsByIds([], { devFieldId: null, siteHost: null, statusCategories: {}, readAt: 't' })).toEqual({ status: 200, issues: [] });
    expect(await new DefaultForgeJiraReportAccessor(fakeRequest([{ status: 400 }]).request).factsByIds(['1'], { devFieldId: null, siteHost: null, statusCategories: {}, readAt: 't' })).toEqual({ status: 400, issues: [] });
    expect((await new DefaultForgeJiraReportAccessor(fakeRequest([{ status: 200, json: null }]).request).factsByIds(['1'], { devFieldId: null, siteHost: null, statusCategories: {}, readAt: 't' })).issues).toEqual([]);
  });

  it('H-1: reads every page of a batch, and fails a read that never reaches the last page', async () => {
    const config = { devFieldId: null, siteHost: null, statusCategories: {}, readAt: 't' };
    const f = fakeRequest([
      { status: 200, json: { issues: [{ id: 7, key: 'PAY-7', fields: { project: { key: 'PAY', id: '10000' } } }], nextPageToken: 'more', isLast: false } },
      { status: 200, json: { issues: [{ id: 8, key: 'PAY-8', fields: { project: { key: 'MOVED', id: 20000 } } }], isLast: true } }
    ]);
    const out = await new DefaultForgeJiraReportAccessor(f.request).factsByIds(['7', '8'], config);
    expect(out.issues.map(i => [i.basics.issueId, i.basics.projectKey, i.basics.projectId])).toEqual([['7', 'PAY', '10000'], ['8', 'MOVED', '20000']]);
    expect(f.calls[1].body).toMatchObject({ nextPageToken: 'more' });
    expect(f.calls[0].body?.fields).toContain('project');
    const tokenOnly = fakeRequest([{ status: 200, json: { issues: [], nextPageToken: 'x' } }, { status: 200, json: { issues: [] } }]);
    expect((await new DefaultForgeJiraReportAccessor(tokenOnly.request).factsByIds(['7'], config)).status).toBe(200);
    const endless = fakeRequest([{ status: 200, json: { issues: [], nextPageToken: 'x', isLast: false } }, { status: 200, json: { issues: [], nextPageToken: 'x', isLast: false } }]);
    expect(await new DefaultForgeJiraReportAccessor(endless.request).factsByIds(['7'], config)).toEqual({ status: 504, issues: [] });
    const second = fakeRequest([{ status: 200, json: { issues: [{ id: 7 }], nextPageToken: 'n', isLast: false } }, { status: 500 }]);
    expect(await new DefaultForgeJiraReportAccessor(second.request).factsByIds(['7', '8'], config)).toEqual({ status: 500, issues: [] });
  });

  it('reads the bulk changelog with paging and the field filter (spike S-2 shape)', async () => {
    const page1 = { issueChangeLogs: [{ issueId: '7', changeHistories: [{ id: '100', author: { accountId: 'acc-a' }, created: 1793900065243, items: [{ field: 'status', fieldId: 'status', from: '1', fromString: 'To Do', to: '3', toString: 'Done' }] }] }], nextPageToken: 'n' };
    const page2 = { issueChangeLogs: [{ issueId: '7', changeHistories: [{ id: 101, created: '2026-10-01T00:00:00.000Z', items: [{ field: 'Link', to: null }] }] }, { issueId: 8 }] };
    const f = fakeRequest([{ status: 200, json: page1 }, { status: 200, json: page2 }]);
    const out = await new DefaultForgeJiraReportAccessor(f.request).changelogs(['7', '8'], ['status'], FAR);
    expect(out.status).toBe(200);
    expect(out.byIssue.get('7')).toEqual([
      { changelogId: '100', at: new Date(1793900065243).toISOString(), authorAccountId: 'acc-a', items: [{ fieldId: 'status', field: 'status', from: '1', to: '3', fromString: 'To Do', toString: 'Done' }] },
      { changelogId: '101', at: '2026-10-01T00:00:00.000Z', authorAccountId: null, items: [{ fieldId: 'Link', field: 'Link', from: null, to: null, fromString: null, toString: null }] }
    ]);
    expect(out.byIssue.get('8')).toEqual([]);
    expect(f.calls[0]).toEqual({ path: '/rest/api/3/changelog/bulkfetch', body: { issueIdsOrKeys: ['7', '8'], maxResults: 10000, fieldIds: ['status'] } });
    expect(f.calls[1].body).toMatchObject({ nextPageToken: 'n' });
    expect(f.calls[1].body).toHaveProperty('fieldIds');
    expect(await new DefaultForgeJiraReportAccessor(fakeRequest([{ status: 429 }]).request).changelogs(['1'], [], FAR)).toEqual({ status: 429, byIssue: new Map() });
    expect((await new DefaultForgeJiraReportAccessor(fakeRequest([{ status: 200, json: { nextPageToken: 'x' } }]).request).changelogs(['1'], [], Date.now() - 1)).status).toBe(504);
    const noFilter = fakeRequest([{ status: 200, json: null }]);
    await new DefaultForgeJiraReportAccessor(noFilter.request).changelogs(['1'], [], FAR);
    expect(noFilter.calls[0].body).not.toHaveProperty('fieldIds');
    expect(changelogTime('bad')).toBe('1970-01-01T00:00:00.000Z');
    expect(changelogEntry({}).changelogId).toBe('');
  });

  it('reads the field list with the schema type, items and custom type', async () => {
    const f = fakeRequest([{ status: 200, json: [{ id: 'assignee', name: 'Assignee', schema: { type: 'user' } }, { id: 'customfield_1', schema: { type: 'array', items: 'user', custom: 'x:multiuserpicker' } }, { name: 'no id' }] }]);
    expect(await new DefaultForgeJiraReportAccessor(f.request).fields()).toEqual({ status: 200, fields: [{ id: 'assignee', name: 'Assignee', schemaType: 'user' }, { id: 'customfield_1', name: 'customfield_1', schemaType: 'array', schemaItems: 'user', custom: 'x:multiuserpicker' }] });
    expect(await new DefaultForgeJiraReportAccessor(fakeRequest([{ status: 401 }]).request).fields()).toEqual({ status: 401, fields: [] });
    expect(await new DefaultForgeJiraReportAccessor(fakeRequest([{ status: 200, json: {} }]).request).fields()).toEqual({ status: 200, fields: [] });
  });
});

describe('the permission check as the user (FSRT form, HLD 7.1)', () => {
  beforeEach(() => {
    asUserRequest.mockReset();
    setPermissionPause(async () => undefined);
  });
  afterAll(() => setPermissionPause(null));

  it('asks Browse projects, Administer projects and Administer Jira in one call for the context project', async () => {
    asUserRequest.mockResolvedValue(res({ status: 200, json: { permissions: { BROWSE_PROJECTS: { havePermission: true }, ADMINISTER_PROJECTS: { havePermission: false }, ADMINISTER: { havePermission: true } } } }));
    expect(await reportPermissionsAsUser('PAY')).toEqual({ status: 200, browse: true, administerProjects: false, administerJira: true });
    expect(asUserRequest).toHaveBeenCalledWith('/rest/api/3/mypermissions?projectKey=PAY&permissions=BROWSE_PROJECTS,ADMINISTER_PROJECTS,ADMINISTER');
  });

  it('fails closed: no project, a bad key, an error status, a thrown call or an empty body', async () => {
    expect(await reportPermissionsAsUser(undefined)).toEqual({ status: 400, browse: false, administerProjects: false, administerJira: false });
    expect(await reportPermissionsAsUser('pay/../x')).toMatchObject({ status: 400, browse: false });
    expect(asUserRequest).not.toHaveBeenCalled();
    asUserRequest.mockResolvedValueOnce(res({ status: 403 }));
    expect(await reportPermissionsAsUser('PAY')).toEqual({ status: 403, browse: false, administerProjects: false, administerJira: false });
    asUserRequest.mockRejectedValueOnce(new Error('down'));
    expect(await reportPermissionsAsUser('PAY')).toEqual({ status: 0, browse: false, administerProjects: false, administerJira: false });
    asUserRequest.mockResolvedValueOnce(res({ status: 200, json: null }));
    expect(await reportPermissionsAsUser('PAY')).toEqual({ status: 200, browse: false, administerProjects: false, administerJira: false });
  });

  it('retries a 429 at most 3 times after Retry-After', async () => {
    const waits: number[] = [];
    setPermissionPause(async ms => { waits.push(ms); });
    asUserRequest.mockResolvedValue(res({ status: 429, headers: { 'Retry-After': '9' } }));
    expect((await reportPermissionsAsUser('PAY')).status).toBe(429);
    expect(asUserRequest).toHaveBeenCalledTimes(4);
    expect(waits).toEqual([5000, 5000, 5000]);
    expect(retryWaitMs({})).toBe(1000);
    expect(retryWaitMs({ headers: { get: () => null } })).toBe(1000);
    expect(retryWaitMs({ headers: { get: () => 'soon' } })).toBe(1000);
    setPermissionPause(null);
    asUserRequest.mockReset();
    asUserRequest.mockResolvedValueOnce(res({ status: 429, headers: { 'Retry-After': '0' } })).mockResolvedValueOnce(res({ status: 200, json: { permissions: {} } }));
    expect((await reportPermissionsAsUser('PAY')).status).toBe(200);
    expect(retryWaitMs({ headers: { get: () => '2' } })).toBe(2000);
  });

  it('keeps the check in the form FSRT sees: direct asUser calls with a literal route, no closure', () => {
    const fs = require('fs');
    const text = fs.readFileSync(require('path').join(__dirname, '../src/accessor/default-forge-report-permission-accessor.ts'), 'utf8');
    const calls = text.match(/api\.asUser\(\)\.requestJira\(route`\/rest\/api\/3\/mypermissions\?projectKey=\$\{projectKey\}&permissions=BROWSE_PROJECTS,ADMINISTER_PROJECTS,ADMINISTER`\)/g) || [];
    expect(calls).toHaveLength(2);
    expect(text).not.toMatch(/withRetry\(|=>\s*api\.asUser/);
  });
});

const job = (o: Partial<ReportJob> = {}): ReportJob => ({ schemaVersion: 1, reportId: 'r1', projectId: '1', projectKey: 'PAY', range: { from: 'a', to: 'b' }, filters: { fieldIds: [], actors: [] }, trigger: 'user', requestedBy: 'pty_x', state: 'QUEUED', cursor: 0, parts: 0, idChunks: 0, failures: 0, progress: { issuesTotal: 0, issuesDone: 0, changes: 0, linksNotRead: 0 }, createdAt: 't', updatedAt: 't', ...o });

describe('report records in KVS', () => {
  it('keeps settings, jobs, ids, tokens, the index, the head, schedules and the site list under fr: keys', async () => {
    const storage = new MemoryStorage();
    const store = new DefaultKvsReportStoreAccessor(storage);
    expect(await store.getSettings()).toEqual(DEFAULT_REPORT_SETTINGS);
    await store.saveSettings({ ...DEFAULT_REPORT_SETTINGS, retentionDays: 90 });
    expect((await store.getSettings()).retentionDays).toBe(90);
    await store.saveJob(job());
    expect(await store.getJob('r1')).toEqual(job());
    const ids = Array.from({ length: 5001 }, (_, i) => String(i));
    expect(await store.saveIds('r1', ids)).toBe(2);
    expect(await store.loadIds('r1', 2)).toEqual(ids);
    expect(await store.saveTokens('r1', ['pty_a'])).toBe(1);
    expect(await store.loadTokens('r1', 1)).toEqual(['pty_a']);
    await store.deleteIds('r1', 2);
    await store.deleteTokens('r1', 1);
    await store.deleteJob('r1');
    expect(await store.loadIds('r1', 2)).toEqual([]);
    expect(await store.getJob('r1')).toBeUndefined();
    const many = Array.from({ length: 201 }, (_, i) => ({ reportId: `r${i}` }) as ReportIndexEntry);
    await store.saveIndex('PAY', many);
    expect(await store.getIndex('PAY')).toHaveLength(200);
    expect(await store.getIndex('OTHER')).toEqual([]);
    await store.commitDone(job({ state: 'DONE' }), 'PAY', { ...many[0], state: 'DONE' }, { reportId: 'r1', manifestSha256: 'm' });
    expect(await store.getHead('PAY')).toEqual({ reportId: 'r1', manifestSha256: 'm' });
    expect(await store.getIndex('PAY')).toHaveLength(200);
    expect((await store.getIndex('PAY')).find(e => e.reportId === 'r0')?.state).toBe('DONE');
    expect((await store.getJob('r1'))?.state).toBe('DONE');
    await store.saveSchedules('PAY', Array.from({ length: 6 }, (_, i) => ({ scheduleId: `s${i}` }) as never));
    expect(await store.getSchedules('PAY')).toHaveLength(5);
    expect(await store.getSchedules('X')).toEqual([]);
    await store.registerProject('1', 'PAY');
    await store.registerProject('1', 'PAY');
    await store.registerProject('2', 'ABC');
    expect(await store.projects()).toEqual(['1', '2']);
    expect(await store.projectKey('2')).toBe('ABC');
    expect(await store.projectKey('9')).toBeUndefined();
    // A key rename keeps the id and records the new key (review N-2).
    await store.registerProject('1', 'PAYMENTS');
    expect(await store.projectKey('1')).toBe('PAYMENTS');
    expect(Array.from(storage.store.keys()).every(k => k.startsWith('fr:'))).toBe(true);
  });

  it('writes the DONE job, the index and the head in one transaction when the platform has one', async () => {
    const storage = new MemoryStorage() as MemoryStorage & { transact?: (s: Array<{ key: string; value: unknown }>) => Promise<void> };
    const tx: string[] = [];
    storage.transact = async sets => { for (const s of sets) { tx.push(s.key); await storage.set(s.key, s.value); } };
    await new DefaultKvsReportStoreAccessor(storage).commitDone(job(), 'PAY', { reportId: 'r1', createdAt: 't' } as ReportIndexEntry, { reportId: 'r1', manifestSha256: 'm' });
    expect(tx).toEqual(['fr:rj:r1', 'fr:rp:PAY:rep:t:r1', 'fr:rp:PAY:head']);
  });

  it('keeps one key per index entry, so two writers never overwrite each other (review M-1), and reads no old-format record (review N-4)', async () => {
    const storage = new MemoryStorage();
    const store = new DefaultKvsReportStoreAccessor(storage);
    const a = { reportId: 'a', state: 'RUNNING', createdAt: '2026-11-01T00:00:00.000Z' } as ReportIndexEntry;
    const b = { reportId: 'b', state: 'QUEUED', createdAt: '2026-11-02T00:00:00.000Z' } as ReportIndexEntry;
    // The 7.7.0 and 7.8.0 development formats are not read, so no migration can write over a newer entry.
    await storage.set('fr:p:PAY:reports', [a]);
    await storage.set('fr:p:PAY:rep:2026-11-01T00:00:00.000Z:a', a);
    expect(await store.getIndex('PAY')).toEqual([]);
    await store.putEntry('PAY', a);
    const seenByCreate = await store.getIndex('PAY');
    await store.putEntry('PAY', { ...a, state: 'DONE' });
    await store.putEntry('PAY', b);
    expect(seenByCreate).toEqual([a]);
    expect((await store.getIndex('PAY')).map(e => `${e.reportId}:${e.state}`)).toEqual(['b:QUEUED', 'a:DONE']);
    await store.deleteEntry('PAY', b);
    expect((await store.getIndex('PAY')).map(e => e.reportId)).toEqual(['a']);
    await store.putEntry('PAY', { ...b, createdAt: a.createdAt, reportId: 'c' });
    expect((await store.getIndex('PAY')).map(e => e.reportId)).toEqual(['c', 'a']);
    await store.putEntry('PAY', { ...b, createdAt: a.createdAt, reportId: '0' });
    expect((await store.getIndex('PAY')).map(e => e.reportId)).toEqual(['c', 'a', '0']);
    expect(await new DefaultKvsReportStoreAccessor(new MemoryStorage()).projectKey('X')).toBeUndefined();
  });

  it('writes each tombstone once under a free key, and lists them newest first', async () => {
    const storage = new MemoryStorage();
    const store = new DefaultKvsReportStoreAccessor(storage);
    await store.addTombstone('PAY', { reportId: 'a', deletedAt: '2026-11-01T00:00:00.000Z', by: 'pty_x', reason: 'r' });
    await store.addTombstone('PAY', { reportId: 'b', deletedAt: '2026-11-01T00:00:00.000Z', by: 'pty_x', reason: 'r' });
    await store.addTombstone('PAY', { reportId: 'c', deletedAt: '2026-11-02T00:00:00.000Z', by: 'pty_x', reason: 'r' });
    expect(storage.store.has('fr:rt:PAY:2026-11-01T00:00:00.000Z:1')).toBe(true);
    expect((await store.listTombstones('PAY')).map(t => t.reportId)).toEqual(['c', 'a', 'b']);
    await store.addTombstone('PAY', { reportId: 'z', deletedAt: '2026-10-01T00:00:00.000Z', by: 'pty_x', reason: 'r' });
    expect((await store.listTombstones('PAY')).map(t => t.reportId)).toEqual(['c', 'a', 'b', 'z']);
    const policyStorage = Object.assign(new MemoryStorage(), { setIfAbsent: jest.fn().mockResolvedValueOnce(false).mockResolvedValueOnce(true) });
    await new DefaultKvsReportStoreAccessor(policyStorage).addTombstone('PAY', { reportId: 'd', deletedAt: 't', by: 'p', reason: 'r' });
    expect(policyStorage.setIfAbsent).toHaveBeenLastCalledWith('fr:rt:PAY:t:1', expect.objectContaining({ reportId: 'd' }));
    const full = Object.assign(new MemoryStorage(), { setIfAbsent: jest.fn().mockResolvedValue(false) });
    await expect(new DefaultKvsReportStoreAccessor(full).addTombstone('PAY', { reportId: 'e', deletedAt: 't', by: 'p', reason: 'r' })).rejects.toThrow('No free tombstone key');
  });

  it('registers temporary people files, because Object Store cannot list', async () => {
    const store = new DefaultKvsReportStoreAccessor(new MemoryStorage());
    await store.addTmp('2026-11-08T00:00:00.000Z:r1:d1', { objectKeys: ['tmp/r1/d1/people.json'], createdAt: '2026-11-08T00:00:00.000Z' });
    expect(await store.listTmp()).toEqual([{ id: '2026-11-08T00:00:00.000Z:r1:d1', entry: { objectKeys: ['tmp/r1/d1/people.json'], createdAt: '2026-11-08T00:00:00.000Z' } }]);
    await store.deleteTmp('2026-11-08T00:00:00.000Z:r1:d1');
    expect(await store.listTmp()).toEqual([]);
  });
});

describe('Forge KVS transaction and write-once policy', () => {
  beforeEach(() => { kvsSet.mockReset(); kvsGet.mockReset(); txSet.mockReset(); txExecute.mockReset(); });
  it('writes values in one transaction', async () => {
    await new DefaultForgeKvsStore().transact([{ key: 'a', value: 1 }, { key: 'b', value: 2 }]);
    expect(txSet.mock.calls).toEqual([['a', 1], ['b', 2]]);
    expect(txExecute).toHaveBeenCalledTimes(1);
  });
  it('sets a key only when absent, and tells an existing key from another failure', async () => {
    const store = new DefaultForgeKvsStore();
    kvsSet.mockResolvedValueOnce(undefined);
    expect(await store.setIfAbsent('k', 'v')).toBe(true);
    expect(kvsSet).toHaveBeenCalledWith('k', 'v', { keyPolicy: 'FAIL_IF_EXISTS' });
    kvsSet.mockRejectedValueOnce(new Error('exists'));
    kvsGet.mockResolvedValueOnce('old');
    expect(await store.setIfAbsent('k', 'v')).toBe(false);
    kvsSet.mockRejectedValueOnce(new Error('down'));
    kvsGet.mockResolvedValueOnce(undefined);
    await expect(store.setIfAbsent('k', 'v')).rejects.toThrow('down');
  });
});

/** An Object Store client that keeps objects in memory, and accepts a second write as the real one did (spike S-1). */
function fakeObjectStore() {
  const objects = new Map<string, { checksum: string; size: number; body: Buffer }>();
  const pending = new Map<string, { key: string; checksum: string; length: number }>();
  const client: ObjectStoreClient = {
    get: async key => { const o = objects.get(key); return o ? { checksum: o.checksum, size: o.size } : undefined; },
    delete: async key => { objects.delete(key); },
    createUploadUrl: async body => { const url = `https://os.test/up/${pending.size}`; pending.set(url, body); return { url }; },
    createDownloadUrl: async key => (objects.has(key) ? { url: `https://os.test/down/${encodeURIComponent(key)}` } : undefined)
  };
  const send = jest.fn(async (url: string, init?: { method?: string; body?: Uint8Array }) => {
    if (init?.method === 'PUT') {
      const p = pending.get(url)!;
      const body = Buffer.from(init.body as Uint8Array);
      objects.set(p.key, { checksum: crypto.createHash('sha256').update(body).digest('base64'), size: body.length, body });
      return { status: 201, text: async () => '' };
    }
    const key = decodeURIComponent(url.split('/down/')[1]);
    const o = objects.get(key);
    return o ? { status: 200, text: async () => o.body.toString('utf8') } : { status: 404, text: async () => '' };
  });
  return { client, send, objects };
}

describe('Object Store, written once (spec v4 invariant 12)', () => {
  it('writes an object once, reads it back, refuses the key a second time, and deletes it', async () => {
    const f = fakeObjectStore();
    const os = new DefaultForgeObjectStoreAccessor(f.client, f.send);
    expect(await os.putOnce('reports/1/r/report.json', '{"a":"é"}', 'application/json')).toBe(true);
    expect(f.send).toHaveBeenCalledWith('https://os.test/up/0', expect.objectContaining({ method: 'PUT', headers: { 'content-type': 'application/json' } }));
    expect(await os.readText('reports/1/r/report.json')).toBe('{"a":"é"}');
    expect(await os.putOnce('reports/1/r/report.json', 'other', 'application/json')).toBe(false);
    expect(await os.readText('reports/1/r/report.json')).toBe('{"a":"é"}');
    expect(await os.exists('reports/1/r/report.json')).toBe(true);
    expect(await os.downloadUrl('reports/1/r/report.json')).toMatch(/^https:\/\/os\.test\/down\//);
    await os.delete('reports/1/r/report.json');
    expect(await os.exists('reports/1/r/report.json')).toBe(false);
    expect(await os.readText('reports/1/r/report.json')).toBeUndefined();
  });

  it('uses the platform fetch by default', async () => {
    const f = fakeObjectStore();
    const original = global.fetch;
    global.fetch = jest.fn(async () => ({ status: 201, text: async () => '' })) as unknown as typeof fetch;
    try {
      await new DefaultForgeObjectStoreAccessor(f.client).putOnce('k', 'x', 'text/plain');
      expect(global.fetch).toHaveBeenCalledWith('https://os.test/up/0', expect.objectContaining({ method: 'PUT' }));
    } finally {
      global.fetch = original;
    }
  });

  it('reports a failed write: no upload URL, a refused PUT, or a stored checksum that differs', async () => {
    const f = fakeObjectStore();
    expect(await new DefaultForgeObjectStoreAccessor({ ...f.client, createUploadUrl: async () => undefined }, f.send).putOnce('k', 'x', 't')).toBe(false);
    expect(await new DefaultForgeObjectStoreAccessor(f.client, jest.fn(async () => ({ status: 403, text: async () => '' }))).putOnce('k', 'x', 't')).toBe(false);
    const tampered = { ...f.client, get: jest.fn().mockResolvedValueOnce(undefined).mockResolvedValueOnce({ checksum: 'other', size: 1 }) };
    expect(await new DefaultForgeObjectStoreAccessor(tampered, f.send).putOnce('k', 'x', 't')).toBe(false);
    const failedRead = new DefaultForgeObjectStoreAccessor({ ...f.client, createDownloadUrl: async () => ({ url: 'https://os.test/down/missing' }) }, f.send);
    expect(await failedRead.readText('missing')).toBeUndefined();
  });
});

describe('queue, hashes and signature, runtime, people', () => {
  it('pushes the report id, with a delay of 1 to 900 seconds', async () => {
    const queue = { push: jest.fn().mockResolvedValue({ jobId: 'j' }) };
    const q = new DefaultForgeReportQueueAccessor(queue);
    await q.push('r1');
    await q.push('r2', 0.2);
    await q.push('r3', 5000);
    expect(queue.push.mock.calls.map(c => c[0])).toEqual([{ body: { reportId: 'r1' } }, { body: { reportId: 'r2' }, delayInSeconds: 1 }, { body: { reportId: 'r3' }, delayInSeconds: 900 }]);
    await q.push('r4', 30);
    expect(queue.push).toHaveBeenLastCalledWith({ body: { reportId: 'r4' }, delayInSeconds: 30 });
  });

  it('signs with the Ed25519 key of the encrypted variable, and is unsigned without a usable key', () => {
    const { publicKey, privateKey } = crypto.generateKeyPairSync('ed25519');
    const signer = new DefaultReportCryptoAccessor({ FOURREALITIES_SIGNING_KEY: privateKey.export({ format: 'der', type: 'pkcs8' }).toString('base64'), FOURREALITIES_KEY_ID: 'fr-dev-2026-11' });
    expect(signer.keyId()).toBe('fr-dev-2026-11');
    const signed = signer.sign('text')!;
    expect(signed.keyId).toBe('fr-dev-2026-11');
    expect(crypto.verify(null, Buffer.from('text'), publicKey, Buffer.from(signed.sig, 'base64'))).toBe(true);
    expect(signer.digest('é')).toEqual({ sha256: crypto.createHash('sha256').update('é', 'utf8').digest('hex'), bytes: 2 });
    expect(signer.newId()).toMatch(/^[0-9a-f-]{36}$/);
    expect(new DefaultReportCryptoAccessor({}).sign('t')).toBeNull();
    expect(new DefaultReportCryptoAccessor({ FOURREALITIES_SIGNING_KEY: 'bm90IGEga2V5', FOURREALITIES_KEY_ID: 'k' }).keyId()).toBeNull();
    expect(new DefaultReportCryptoAccessor({ FOURREALITIES_SIGNING_KEY: privateKey.export({ format: 'der', type: 'pkcs8' }).toString('base64'), FOURREALITIES_KEY_ID: 'Bad Id!' }).keyId()).toBeNull();
    const rsa = crypto.generateKeyPairSync('rsa', { modulusLength: 1024 }).privateKey.export({ format: 'der', type: 'pkcs8' }).toString('base64');
    expect(new DefaultReportCryptoAccessor({ FOURREALITIES_SIGNING_KEY: rsa, FOURREALITIES_KEY_ID: 'k' }).keyId()).toBeNull();
    // Review L-7: a development key never signs a production report, a production key never a development one.
    const der = privateKey.export({ format: 'der', type: 'pkcs8' }).toString('base64');
    expect(new DefaultReportCryptoAccessor({ FOURREALITIES_SIGNING_KEY: der, FOURREALITIES_KEY_ID: 'fr-dev-2026-11' }, 'production').keyId()).toBeNull();
    expect(new DefaultReportCryptoAccessor({ FOURREALITIES_SIGNING_KEY: der, FOURREALITIES_KEY_ID: 'fr-dev-2026-11' }, 'development').keyId()).toBe('fr-dev-2026-11');
    expect(new DefaultReportCryptoAccessor({ FOURREALITIES_SIGNING_KEY: der, FOURREALITIES_KEY_ID: 'fr-prod-2026-11' }, 'staging').keyId()).toBeNull();
    expect(new DefaultReportCryptoAccessor({ FOURREALITIES_SIGNING_KEY: der, FOURREALITIES_KEY_ID: 'fr-prod-2026-11' }, 'production').keyId()).toBe('fr-prod-2026-11');
    expect(new DefaultReportCryptoAccessor().keyId() === null || typeof new DefaultReportCryptoAccessor().keyId() === 'string').toBe(true);
  });

  it('reads the environment, the app version and the licence, and copes with no context', () => {
    const rt = new DefaultForgeReportRuntimeAccessor(() => ({ environmentType: 'DEVELOPMENT', appVersion: '8.0.0', license: { isActive: false } }));
    expect([rt.environment(), rt.appVersion(), rt.licenceActive()]).toEqual(['development', '8.0.0', false]);
    const none = new DefaultForgeReportRuntimeAccessor(() => undefined);
    expect([none.environment(), none.appVersion(), none.licenceActive()]).toEqual(['production', undefined, undefined]);
    const broken = new DefaultForgeReportRuntimeAccessor(() => { throw new Error('no runtime'); });
    expect(broken.environment()).toBe('production');
    appContext.mockReturnValue({ environmentType: 'STAGING' });
    expect(new DefaultForgeReportRuntimeAccessor().environment()).toBe('staging');
  });

  it('reads names and the active flag as the user, 50 per call, and the caller\'s groups', async () => {
    const ids = Array.from({ length: 51 }, (_, i) => `acc-${i}`);
    const f = fakeRequest([{ status: 200, json: { values: [{ accountId: 'acc-0', displayName: 'Ana', active: true }, { accountId: 'acc-1', active: false }, {}] } }, { status: 500 }]);
    const people = new DefaultForgeReportPeopleAccessor(f.request);
    expect(await people.people([...ids, '', 'acc-0'])).toEqual({ 'acc-0': { displayName: 'Ana', active: true }, 'acc-1': { displayName: '', active: false } });
    expect(f.calls[0].path).toContain('accountId=acc-0&accountId=acc-1');
    expect(await new DefaultForgeReportPeopleAccessor(jest.fn().mockRejectedValue(new Error('x'))).people(['a'])).toEqual({});
    const g = fakeRequest([{ status: 200, json: { groups: { items: [{ groupId: 'g1', name: 'one' }, { name: 'two' }, {}] } } }]);
    expect(await new DefaultForgeReportPeopleAccessor(g.request).myGroupIds()).toEqual({ status: 200, groupIds: ['g1', 'two'] });
    expect(await new DefaultForgeReportPeopleAccessor(fakeRequest([{ status: 401 }]).request).myGroupIds()).toEqual({ status: 401, groupIds: [] });
    expect(await new DefaultForgeReportPeopleAccessor(fakeRequest([{ status: 200, json: null }]).request).myGroupIds()).toEqual({ status: 200, groupIds: [] });
    expect(await new DefaultForgeReportPeopleAccessor(jest.fn().mockRejectedValue(new Error('x'))).myGroupIds()).toEqual({ status: 0, groupIds: [] });
  });
});

describe('party tokens (ADR-011 pattern, spec v4 invariant 10)', () => {
  it('makes pty_ tokens with a site key written once, the same token for the same account, and maps each token', async () => {
    const storage = new MemoryStorage();
    const tokens = new DefaultKvsPartyTokenAccessor(storage, () => Buffer.alloc(32, 7));
    const out = await tokens.tokensFor(['acc-a', 'acc-b', 'acc-a', ''], '2026-11-08T00:00:00.000Z');
    expect(Object.keys(out)).toEqual(['acc-a', 'acc-b']);
    expect(out['acc-a']).toMatch(/^pty_[0-9a-f]{32}$/);
    expect(out['acc-a']).toBe('pty_' + crypto.createHmac('sha256', Buffer.alloc(32, 7)).update('acc-a').digest('hex').slice(0, 32));
    expect(await storage.get('fr:partykey')).toBe(Buffer.alloc(32, 7).toString('base64'));
    expect(await storage.get(`fr:party:${out['acc-a']}`)).toEqual({ accountId: 'acc-a', updatedAt: '2026-11-08T00:00:00.000Z' });
    const again = new DefaultKvsPartyTokenAccessor(storage, () => Buffer.alloc(32, 9));
    expect((await again.tokensFor(['acc-a'], '2026-11-08T05:00:00.000Z'))['acc-a']).toBe(out['acc-a']);
    expect(await again.tokensFor([], 'x')).toEqual({});
  });

  it('refreshes the date once a day and never reopens a closed mark', async () => {
    const storage = new MemoryStorage();
    const tokens = new DefaultKvsPartyTokenAccessor(storage);
    const t = (await tokens.tokensFor(['acc-a'], '2026-11-01T00:00:00.000Z'))['acc-a'];
    await tokens.tokensFor(['acc-a'], '2026-11-01T09:00:00.000Z');
    expect(await storage.get(`fr:party:${t}`)).toEqual({ accountId: 'acc-a', updatedAt: '2026-11-01T00:00:00.000Z' });
    await tokens.tokensFor(['acc-a'], '2026-11-02T00:00:00.000Z');
    expect(await storage.get(`fr:party:${t}`)).toEqual({ accountId: 'acc-a', updatedAt: '2026-11-02T00:00:00.000Z' });
    await storage.set(`fr:party:${t}`, { closed: true, closedAt: 'c' });
    await tokens.tokensFor(['acc-a'], '2026-11-09T00:00:00.000Z');
    expect(await storage.get(`fr:party:${t}`)).toEqual({ closed: true, closedAt: 'c' });
    expect(await tokens.entries([t, 'not-a-token', t])).toEqual({ [t]: { closed: true, closedAt: 'c' }, 'not-a-token': undefined });
  });

  it('keeps the first site key when two writers race (FAIL_IF_EXISTS)', async () => {
    const storage = Object.assign(new MemoryStorage(), {
      setIfAbsent: jest.fn(async (key: string) => { await storage.set(key, Buffer.alloc(32, 1).toString('base64')); return false; })
    });
    const tokens = new DefaultKvsPartyTokenAccessor(storage, () => Buffer.alloc(32, 2));
    const t = (await tokens.tokensFor(['acc-a'], 'n'))['acc-a'];
    expect(t).toBe('pty_' + crypto.createHmac('sha256', Buffer.alloc(32, 1)).update('acc-a').digest('hex').slice(0, 32));
  });
});

describe('personal data: the token map (ADR-014, spec v4 11.8)', () => {
  it('reports every open token entry and turns a closed account\'s entry into a closed mark', async () => {
    const storage = new MemoryStorage();
    await storage.set('fr:party:pty_' + 'a'.repeat(32), { accountId: 'acc-a', updatedAt: '2026-11-01T00:00:00.000Z' });
    await storage.set('fr:party:pty_' + 'b'.repeat(32), { accountId: 'acc-b', updatedAt: '2026-11-02T00:00:00.000Z' });
    await storage.set('fr:party:pty_' + 'c'.repeat(32), { closed: true, closedAt: 'x' });
    const data = new DefaultKvsPersonalDataAccessor(storage);
    expect(await data.accounts('now')).toEqual([{ accountId: 'acc-a', updatedAt: '2026-11-01T00:00:00.000Z', issueIds: [] }, { accountId: 'acc-b', updatedAt: '2026-11-02T00:00:00.000Z', issueIds: [] }]);
    await data.erase(['acc-a']);
    expect(await storage.get('fr:party:pty_' + 'a'.repeat(32))).toEqual({ closed: true, closedAt: expect.any(String) });
    expect(await storage.get('fr:party:pty_' + 'b'.repeat(32))).toEqual({ accountId: 'acc-b', updatedAt: '2026-11-02T00:00:00.000Z' });
    expect((await data.accounts('now')).map(a => a.accountId)).toEqual(['acc-b']);
  });
});
