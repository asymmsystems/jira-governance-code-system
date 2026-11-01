/**
 * B-18: Jira call hygiene. One retry policy for 429 on every Jira read.
 *
 * Copyright (c) 2026 Asymm Systems. All rights reserved.
 * @author Fahim Farook
 */
import * as fs from 'fs';
import * as path from 'path';
import { jira, CountingStorage, JiraCall } from '../helpers/forge-mocks';

jest.mock('@forge/api', () => {
  const m = require('../helpers/forge-mocks');
  const asApp = { requestJira: m.makeRequester('app') };
  const asUser = { requestJira: m.makeRequester('user') };
  return { __esModule: true, default: { asApp: () => asApp, asUser: () => asUser }, route: m.routeImpl };
});
jest.mock('@forge/kvs', () => ({ kvs: {}, WhereConditions: { beginsWith: (v: string) => v } }));

import { withRetry, retryPolicy, MAX_TRIES, MAX_WAIT_MS } from '../../src/jira/jira-client';
import { toggleChecklistItem, validateTransition } from '../../src/index';
import { getIssuePermissions } from '../../src/security/permissions';

const res = (status: number, retryAfter?: string) => ({ status, headers: { get: (n: string) => (n.toLowerCase() === 'retry-after' ? retryAfter ?? null : null) } });

describe('B-18 withRetry', () => {
  let sleeps: number[];
  beforeEach(() => {
    sleeps = [];
    retryPolicy.sleep = async (ms: number) => { sleeps.push(ms); };
  });

  it('returns the first response that is not 429', async () => {
    const replies = [res(429, '2'), res(429), res(200)];
    const out = await withRetry(async () => replies.shift() as any);
    expect(out.status).toBe(200);
    expect(sleeps).toEqual([2000, 2000]);
  });

  it('gives up after MAX_TRIES and returns the last 429', async () => {
    const out = await withRetry(async () => res(429) as any);
    expect(out.status).toBe(429);
    expect(sleeps).toHaveLength(MAX_TRIES - 1);
  });

  it('caps a long Retry-After, and does not retry other statuses', async () => {
    await withRetry(async () => (sleeps.length ? res(200) : res(429, '120')) as any);
    expect(sleeps).toEqual([MAX_WAIT_MS]);
    sleeps = [];
    expect((await withRetry(async () => res(500) as any)).status).toBe(500);
    expect(sleeps).toEqual([]);
  });

  it('every Jira read in src goes through withRetry (source scan)', () => {
    const root = path.join(__dirname, '../../src');
    const walk = (d: string): string[] => fs.readdirSync(d, { withFileTypes: true }).flatMap(f => (f.isDirectory() ? walk(path.join(d, f.name)) : [path.join(d, f.name)]));
    for (const f of walk(root).filter(x => x.endsWith('.ts') && !x.endsWith('jira-client.ts'))) {
      const src = fs.readFileSync(f, 'utf8');
      const raw = (src.match(/\.requestJira\(/g) || []).length;
      const wrapped = (src.match(/withRetry\(\(\) => api\.as(App|User)\(\)\.requestJira\(/g) || []).length;
      // The property write keeps its own 429/5xx retry (B-14).
      const ownRetry = f.endsWith('attestation.ts') ? 1 : 0;
      expect({ file: path.basename(f), unwrapped: raw - wrapped - ownRetry }).toEqual({ file: path.basename(f), unwrapped: 0 });
    }
  });
});

describe('B-18 resolvers and the validator retry a 429', () => {
  beforeEach(() => {
    jira.reset();
    retryPolicy.sleep = async () => {};
  });

  it('the permission check retries a 429 and then succeeds', async () => {
    let n = 0;
    jira.handler = (c: JiraCall) => (c.path.includes('/mypermissions')
      ? (n++ === 0 ? { status: 429 } : { status: 200, body: { permissions: { EDIT_ISSUES: { havePermission: true } } } })
      : { status: 204 });
    expect(await getIssuePermissions('DEMO-1', ['EDIT_ISSUES'])).toEqual({ EDIT_ISSUES: true });
    expect(jira.callsTo('/mypermissions')).toHaveLength(2);
  });

  it('a toggle makes 2 Jira calls on the happy path: the permission check and the property write', async () => {
    jira.handler = (c: JiraCall) => (c.path.includes('/mypermissions') ? { status: 200, body: { permissions: { EDIT_ISSUES: { havePermission: true } } } } : { status: 204 });
    const ctx = { accountId: 'a', extension: { issue: { id: '97001', key: 'DEMO-97001', type: 'Task', typeId: '10004' }, project: { id: '10000' } } };
    const storage = new CountingStorage();
    await toggleChecklistItem({ itemId: 'item-unit-tests', isCompleted: true }, ctx, storage);
    jira.calls = [];
    await toggleChecklistItem({ itemId: 'item-peer-review', isCompleted: true }, ctx, storage);
    expect(jira.calls.map(c => `${c.who} ${c.method} ${c.path.split('?')[0]}`)).toEqual([
      'user GET /rest/api/3/mypermissions',
      'app PUT /rest/api/3/issue/97001/properties/definitionguard-dod'
    ]);
  });

  it('(V-a, V-b) the validator retries a 429 on the status lookup and still blocks and names items', async () => {
    let n = 0;
    jira.handler = (c: JiraCall) => (c.path.startsWith('/rest/api/3/status/')
      ? (n++ === 0 ? { status: 429 } : { status: 200, body: { statusCategory: { key: 'done' } } })
      : { status: 204 });
    const out = await validateTransition({ issue: { id: '97002' }, transition: { to: { id: '10001' } } }, { extension: { issue: { type: 'Task', typeId: '10004' }, project: { id: '10000' } } }, new CountingStorage());
    expect(out.result).toBe(false);
    expect(out.errorMessage).toContain('Open mandatory items:');
    expect(jira.callsTo('/rest/api/3/status/')).toHaveLength(2);
  });

  it('the validator makes no Jira call when the context gives the ids and no record exists', async () => {
    jira.handler = () => ({ status: 500 });
    const out = await validateTransition({ issue: { id: '97003' } }, { extension: { issue: { type: 'Task', typeId: '10004' }, project: { id: '10000' } } }, new CountingStorage());
    expect(out.result).toBe(false);
    expect(jira.calls).toEqual([]);
  });
});
