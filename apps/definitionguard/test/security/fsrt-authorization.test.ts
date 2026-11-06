/**
 * AMS-76722: Atlassian's FSRT authorization check. Every resolver refuses a user without the Jira
 * permission before it reads app storage or calls Jira as the app, and every permission check is
 * written in the form FSRT recognises (a direct asUser() call to /rest/api/3/mypermissions).
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

import { handler, adminHandler, settingsHandler, setGlobalStorageProvider } from '../../src/index';
import { retryPolicy, retryAfter, MAX_TRIES } from '../../src/jira/jira-client';
import { BROWSE_DENIED, EDIT_DENIED } from '../../src/security/permissions';
import { NOT_ADMIN_MESSAGE } from '../../src/security/policy-admin';
import { TEMPLATE_DENIED } from '../../src/settings/settings-resolvers';

const issueCtx = { accountId: '712020:mallory', extension: { issue: { id: '76722', key: 'DEMO-76722', type: 'Task', typeId: '10004' }, project: { id: '10000', key: 'DEMO' } } };
const projectCtx = { accountId: '712020:mallory', extension: { project: { id: '10000', key: 'DEMO' } } };

/** Jira answers every permission question with "no": the user holds no permission at all. */
function denyEverything() {
  jira.browse = 'deny';
  jira.handler = (c: JiraCall) => {
    if (c.path.includes('/mypermissions')) {
      const keys = decodeURIComponent(c.path.split('permissions=')[1] || '').split(',');
      return { status: 200, body: { permissions: Object.fromEntries(keys.map(k => [k, { havePermission: false }])) } };
    }
    if (c.path.includes('/myself')) return { status: 200, body: { groups: { items: [] } } };
    return { status: 200, body: {} };
  };
}

type Case = [string, (h: any) => Promise<unknown>, (out: unknown, err: any) => void];
const call = (h: any, functionKey: string, payload: any, context: any) => h({ call: { functionKey, payload }, context });
const rejectedWith = (message: string) => (_out: unknown, err: any) => expect(err?.message).toBe(message);
const notAdmin = (out: any, err: any) => {
  expect(err).toBeUndefined();
  expect(out).toMatchObject({ ok: false, code: 'NOT_ADMIN', message: NOT_ADMIN_MESSAGE });
};

const waive = { itemId: 'item-unit-tests', reason: 'Covered by the release test plan.' };

/** Every resolver key of the three handlers, except getAvailableTemplates (a static list). */
const CASES: Case[] = [
  ['handler getChecklist', () => call(handler, 'getChecklist', {}, issueCtx), rejectedWith(BROWSE_DENIED)],
  ['handler getHistory', () => call(handler, 'getHistory', {}, issueCtx), rejectedWith(BROWSE_DENIED)],
  ['handler getEvidence', () => call(handler, 'getEvidence', { itemId: 'item-unit-tests' }, issueCtx), rejectedWith(BROWSE_DENIED)],
  ['handler exportHistory', () => call(handler, 'exportHistory', {}, issueCtx), rejectedWith(BROWSE_DENIED)],
  ['handler toggleItem', () => call(handler, 'toggleItem', { itemId: 'item-unit-tests', isCompleted: true }, issueCtx), rejectedWith(BROWSE_DENIED)],
  ['handler waiveItem', () => call(handler, 'waiveItem', waive, issueCtx), rejectedWith(BROWSE_DENIED)],
  ['handler resetChecklist', () => call(handler, 'resetChecklist', {}, issueCtx), rejectedWith(BROWSE_DENIED)],
  ['handler authority-policy-get', () => call(handler, 'authority-policy-get', {}, issueCtx), notAdmin],
  ['handler authority-group-search', () => call(handler, 'authority-group-search', { query: 'dev' }, issueCtx), notAdmin],
  ['handler authority-policy-set', () => call(handler, 'authority-policy-set', { groupIds: ['g-1'] }, issueCtx), notAdmin],
  ['adminHandler authority-policy-get', () => call(adminHandler, 'authority-policy-get', {}, {}), notAdmin],
  ['adminHandler authority-group-search', () => call(adminHandler, 'authority-group-search', { query: 'dev' }, {}), notAdmin],
  ['adminHandler authority-policy-set', () => call(adminHandler, 'authority-policy-set', { groupIds: ['g-1'] }, {}), notAdmin],
  ['settingsHandler getSettings', () => call(settingsHandler, 'getSettings', {}, projectCtx), rejectedWith(TEMPLATE_DENIED)],
  ['settingsHandler saveTemplate', () => call(settingsHandler, 'saveTemplate', { issueTypeId: '10004', template: {} }, projectCtx), rejectedWith(TEMPLATE_DENIED)],
  ['settingsHandler saveExemptions', () => call(settingsHandler, 'saveExemptions', { exemptStatusIds: [] }, projectCtx), rejectedWith(TEMPLATE_DENIED)],
  ['settingsHandler resyncIssues', () => call(settingsHandler, 'resyncIssues', { issueTypeId: '10004' }, projectCtx), rejectedWith(TEMPLATE_DENIED)],
  ['settingsHandler gateCoverage', () => call(settingsHandler, 'gateCoverage', {}, projectCtx), rejectedWith(TEMPLATE_DENIED)]
];

describe('AMS-76722: every resolver refuses a user without the Jira permission', () => {
  let storage: CountingStorage;

  beforeEach(() => {
    jira.reset();
    denyEverything();
    retryPolicy.sleep = async () => {};
    storage = new CountingStorage();
    setGlobalStorageProvider(storage);
  });

  it.each(CASES)('%s: refused, with no storage access and no call as the app', async (_name, run, check) => {
    let out: unknown;
    let err: any;
    try {
      out = await run(undefined);
    } catch (e) {
      err = e;
    }
    check(out, err);
    expect(storage.gets).toEqual([]);
    expect(storage.sets).toEqual([]);
    expect(jira.calls.filter(c => c.who === 'app')).toEqual([]);
    // The only Jira call is the permission question, asked as the user.
    expect(jira.calls.map(c => `${c.who} ${c.path.split('?')[0]}`)).toEqual(['user /rest/api/3/mypermissions']);
  });

  it('the cases cover every resolver key the source defines', () => {
    const src = (f: string) => fs.readFileSync(path.join(__dirname, '../../src', f), 'utf8');
    const keys = (text: string, name: string) => [...text.matchAll(new RegExp(`${name}\\.define\\('([^']+)'`, 'g'))].map(m => m[1]);
    const index = src('index.ts');
    const defined = [
      ...keys(index.slice(0, index.indexOf('export const handler')), 'resolver').map(k => `handler ${k}`),
      ...keys(index, 'adminResolver').map(k => `adminHandler ${k}`),
      ...keys(src('settings/settings-resolvers.ts'), 'resolver').map(k => `settingsHandler ${k}`)
    ].filter(k => k !== 'handler getAvailableTemplates');
    expect(CASES.map(c => c[0]).sort()).toEqual(defined.sort());
  });

  it('a user with Browse but without Edit issues still cannot tick an item', async () => {
    jira.browse = 'grant';
    await expect(call(handler, 'toggleItem', { itemId: 'item-unit-tests', isCompleted: true }, issueCtx)).rejects.toThrow(EDIT_DENIED);
    expect(storage.sets).toEqual([]);
    expect(jira.calls.filter(c => c.who === 'app')).toEqual([]);
  });
});

describe('AMS-76722: permission checks are in the form FSRT recognises', () => {
  const root = path.join(__dirname, '../../src');
  const walk = (d: string): string[] => fs.readdirSync(d, { withFileTypes: true }).flatMap(f => (f.isDirectory() ? walk(path.join(d, f.name)) : [path.join(d, f.name)]));

  // FSRT (crates/forge_analyzer/src/definitions.rs, classify_api_call) treats a requestJira call
  // as an authorization check when a literal part of its route contains "permission". It does not
  // follow a call inside a closure passed to another function (an arrow argument lowers to
  // undefined), nor a route held in a variable.
  it('every /mypermissions call in src is a direct asUser() call with a literal route, not inside withRetry', () => {
    let direct = 0;
    for (const f of walk(root).filter(x => x.endsWith('.ts'))) {
      const src = fs.readFileSync(f, 'utf8');
      const code = src.split('\n').filter(l => !/^\s*(\*|\/\*|\/\/)/.test(l));
      for (const line of code.filter(l => l.includes('/mypermissions'))) {
        expect({ file: path.basename(f), line: line.trim(), direct: /await api\.asUser\(\)\.requestJira\(route`\/rest\/api\/3\/mypermissions\?/.test(line) })
          .toEqual({ file: path.basename(f), line: line.trim(), direct: true });
        expect(line).not.toContain('withRetry(');
        direct++;
      }
    }
    expect(direct).toBeGreaterThanOrEqual(6);
  });
});

describe('retryAfter: the inline form of the 429 policy', () => {
  let sleeps: number[];
  beforeEach(() => {
    sleeps = [];
    retryPolicy.sleep = async (ms: number) => { sleeps.push(ms); };
  });
  const res = (status: number, retryAfterHeader?: string) => ({ status, headers: { get: (n: string) => (n.toLowerCase() === 'retry-after' ? retryAfterHeader ?? null : null) } });

  it('waits and asks for another try on a 429 with tries left', async () => {
    expect(await retryAfter(res(429, '3'), 1)).toBe(true);
    expect(sleeps).toEqual([3000]);
  });

  it('stops on the last try, on any other status, and on no response', async () => {
    expect(await retryAfter(res(429), MAX_TRIES)).toBe(false);
    expect(await retryAfter(res(200), 1)).toBe(false);
    expect(await retryAfter(undefined, 1)).toBe(false);
    expect(sleeps).toEqual([]);
  });
});
