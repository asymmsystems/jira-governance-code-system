/**
 * MK-02 questionnaire Q3 and Q9: every issue panel resolver checks Browse projects as the user
 * before it reads app storage or Jira as the app; payload ids and cursors are checked first.
 *
 * Copyright (c) 2026 Asymm Systems. All rights reserved.
 * @author Fahim Farook
 */
import * as fs from 'fs';
import * as path from 'path';
import { jira, BROWSE_CHECK, CountingStorage, JiraCall } from '../helpers/forge-mocks';

jest.mock('@forge/api', () => {
  const m = require('../helpers/forge-mocks');
  const asApp = { requestJira: m.makeRequester('app') };
  const asUser = { requestJira: m.makeRequester('user') };
  return { __esModule: true, default: { asApp: () => asApp, asUser: () => asUser }, route: m.routeImpl };
});
jest.mock('@forge/kvs', () => ({ kvs: {}, WhereConditions: { beginsWith: (v: string) => v } }));

import {
  getIssueChecklist,
  getChecklistHistory,
  getItemEvidence,
  exportChecklistHistory,
  toggleChecklistItem,
  waiveChecklistItem,
  resetChecklist,
  handler,
  setGlobalStorageProvider
} from '../../src/index';
import { BROWSE_DENIED, BROWSE_CHECK_FAILED, PermissionDeniedError, requireBrowseIssue } from '../../src/security/permissions';
import { ITEM_ID_INVALID, CURSOR_INVALID, MAX_CURSOR_CHARS, MAX_GROUP_ID_CHARS, cursorOf, isGroupId, itemIdOf } from '../../src/domain/input-rules';
import { setApproverPolicyFlow } from '../../src/security/policy-admin';
import { resyncIssues, RESYNC_CURSOR_INVALID } from '../../src/settings/settings-resolvers';
import { panelErrorText } from '../../src/ui/panel-view-model';

const ctx = { accountId: '712020:alice', extension: { issue: { id: '61001', key: 'DEMO-61001', type: 'Task', typeId: '10004' }, project: { id: '10000', key: 'DEMO' } } };
// No project or issue type id in the context: the template lookup would read the issue as the app.
const bareCtx = { accountId: '712020:alice', extension: { issue: { id: '61002', key: 'DEMO-61002' } } };

const waive = { itemId: 'item-unit-tests', reason: 'Covered by the release test plan.' };

/** Every issue panel resolver, called directly, with a valid payload. */
const RESOLVERS: Array<[string, (c: any, s: CountingStorage) => Promise<unknown>]> = [
  ['getChecklist', (c, s) => getIssueChecklist({}, c, s)],
  ['getHistory', (c, s) => getChecklistHistory({}, c, s)],
  ['getEvidence', (c, s) => getItemEvidence({ itemId: 'item-unit-tests' }, c, s)],
  ['exportHistory', (c, s) => exportChecklistHistory({}, c, s)],
  ['toggleItem', (c, s) => toggleChecklistItem({ itemId: 'item-unit-tests', isCompleted: true }, c, s)],
  ['waiveItem', (c, s) => waiveChecklistItem(waive, c, s)],
  ['resetChecklist', (c, s) => resetChecklist({}, c, s)]
];

function grantAll() {
  jira.handler = (c: JiraCall) => {
    if (c.path.includes('/mypermissions')) {
      const keys = ['EDIT_ISSUES', 'ADMINISTER_PROJECTS', 'ADMINISTER'];
      return { status: 200, body: { permissions: Object.fromEntries(keys.map(k => [k, { havePermission: true }])) } };
    }
    if (c.path.includes('/properties/')) return { status: 204 };
    if (c.path.includes('/changelog')) return { status: 200, body: { values: [], isLast: true } };
    return { status: 200, body: { id: '61002', fields: { issuetype: { id: '10004', name: 'Task' }, project: { id: '10000' } } } };
  };
}

describe('MK-02 Q3: Browse projects before any read', () => {
  let storage: CountingStorage;

  beforeEach(() => {
    jira.reset();
    grantAll();
    storage = new CountingStorage();
    setGlobalStorageProvider(storage);
  });

  it.each(RESOLVERS)('%s: the first Jira call is the Browse check, as the user, by issue id', async (_name, run) => {
    await run(ctx, storage);
    expect(jira.calls[0]).toMatchObject({ who: 'user', method: 'GET' });
    expect(jira.calls[0].path).toBe('/rest/api/3/mypermissions?issueId=61001&permissions=BROWSE_PROJECTS');
  });

  it.each(RESOLVERS)('%s: refuses a user who cannot browse the issue, before any storage read or asApp call', async (_name, run) => {
    jira.browse = 'deny';
    await expect(run(ctx, storage)).rejects.toThrow(BROWSE_DENIED);
    expect(storage.gets).toEqual([]);
    expect(storage.sets).toEqual([]);
    expect(jira.calls.filter(c => c.who === 'app')).toEqual([]);
    expect(jira.calls.map(c => c.path)).toEqual(['/rest/api/3/mypermissions?issueId=61001&permissions=BROWSE_PROJECTS']);
  });

  it.each(RESOLVERS)('%s: fails closed when Jira cannot answer the Browse check', async (_name, run) => {
    jira.browse = 503;
    const err: any = await run(ctx, storage).catch(e => e);
    expect(err).toBeInstanceOf(PermissionDeniedError);
    expect(err.message).toBe(BROWSE_CHECK_FAILED);
    expect(storage.gets).toEqual([]);
    expect(jira.calls.filter(c => c.who === 'app')).toEqual([]);
  });

  it('fails closed when the Browse call throws', async () => {
    jira.browse = 'handler';
    jira.handler = () => ({ status: 0, throws: 'network down' } as any);
    await expect(getIssueChecklist({}, ctx, storage)).rejects.toThrow(BROWSE_CHECK_FAILED);
    expect(storage.gets).toEqual([]);
  });

  it('fails closed without an issue id, and makes no call', async () => {
    await expect(requireBrowseIssue('')).rejects.toThrow(BROWSE_CHECK_FAILED);
    expect(jira.calls).toEqual([]);
  });

  it('fails closed when the answer does not grant BROWSE_PROJECTS', async () => {
    jira.browse = 'handler';
    jira.handler = () => ({ status: 200, body: { permissions: {} } });
    await expect(getIssueChecklist({}, ctx, storage)).rejects.toThrow(BROWSE_DENIED);
  });

  it('never reads the issue as the app for the template when Browse is denied (fetchLiveJiraIssue)', async () => {
    jira.browse = 'deny';
    await expect(getIssueChecklist({}, bareCtx, storage)).rejects.toThrow(BROWSE_DENIED);
    await expect(toggleChecklistItem({ itemId: 'item-unit-tests', isCompleted: true }, bareCtx, storage)).rejects.toThrow(BROWSE_DENIED);
    await expect(waiveChecklistItem(waive, bareCtx, storage)).rejects.toThrow(BROWSE_DENIED);
    expect(jira.callsTo('/rest/api/3/issue/', 'app')).toEqual([]);
  });

  it('reads the issue for the template only after Browse is granted, and as the user (AMS-76722)', async () => {
    await getIssueChecklist({}, bareCtx, storage);
    const order = jira.calls.map(c => `${c.who} ${c.path.split('?')[0]}`);
    expect(order).toEqual(['user /rest/api/3/mypermissions', 'user /rest/api/3/issue/61002']);
  });

  it('the bridge resolvers go through the same check', async () => {
    jira.browse = 'deny';
    for (const functionKey of ['getChecklist', 'getHistory', 'getEvidence', 'exportHistory', 'toggleItem', 'waiveItem', 'resetChecklist']) {
      const payload = functionKey === 'waiveItem' ? waive : { itemId: 'item-unit-tests', isCompleted: true };
      await expect((handler as any)({ call: { functionKey, payload }, context: ctx })).rejects.toThrow(BROWSE_DENIED);
    }
    expect(jira.calls.filter(c => !BROWSE_CHECK.test(c.path))).toEqual([]);
  });

  it('the panel shows both messages as they are', () => {
    expect(panelErrorText(new Error(BROWSE_DENIED), 'load the checklist')).toBe(BROWSE_DENIED);
    expect(panelErrorText(new Error(BROWSE_CHECK_FAILED), 'load the checklist')).toBe(BROWSE_CHECK_FAILED);
  });

  it('every resolver in src/index.ts is either an issue resolver tested here or a listed non-issue resolver', () => {
    const src = fs.readFileSync(path.join(__dirname, '../../src/index.ts'), 'utf8');
    const panel = src.slice(src.indexOf('const resolver = new Resolver();'), src.indexOf('export const handler'));
    const names = [...panel.matchAll(/resolver\.define\('([^']+)'/g)].map(m => m[1]);
    // Site-wide, Jira admins only (isJiraAdmin as the user), or a static list: no issue data.
    const notIssue = ['authority-policy-get', 'authority-group-search', 'authority-policy-set', 'getAvailableTemplates'];
    expect(names.filter(n => !notIssue.includes(n)).sort()).toEqual(RESOLVERS.map(r => r[0]).sort());
  });
});

describe('MK-02 Q9: payload ids and cursors', () => {
  let storage: CountingStorage;

  beforeEach(() => {
    jira.reset();
    grantAll();
    storage = new CountingStorage();
    setGlobalStorageProvider(storage);
  });

  const badItemIds: unknown[] = ['', 'a'.repeat(65), 'item unit', "x'); drop", 'é', 42, null, undefined, { id: 'item-unit-tests' }];

  it('itemIdOf accepts the template id rule only', () => {
    expect(itemIdOf('item-unit-tests')).toBe('item-unit-tests');
    expect(itemIdOf('a'.repeat(64))).toBe('a'.repeat(64));
    for (const bad of badItemIds) expect(() => itemIdOf(bad)).toThrow(ITEM_ID_INVALID);
  });

  it.each([
    ['toggleItem', (id: unknown, s: CountingStorage) => toggleChecklistItem({ itemId: id, isCompleted: true }, ctx, s)],
    ['waiveItem', (id: unknown, s: CountingStorage) => waiveChecklistItem({ ...waive, itemId: id }, ctx, s)],
    ['getEvidence', (id: unknown, s: CountingStorage) => getItemEvidence({ itemId: id }, ctx, s)]
  ])('%s refuses a bad item id before any Jira call or storage read', async (_name, run) => {
    for (const bad of badItemIds) {
      await expect(run(bad, storage)).rejects.toThrow(ITEM_ID_INVALID);
    }
    expect(jira.calls).toEqual([]);
    expect(storage.gets).toEqual([]);
  });

  it('cursorOf accepts an absent or opaque cursor and refuses other values', () => {
    expect(cursorOf(undefined)).toBeUndefined();
    expect(cursorOf('')).toBeUndefined();
    expect(cursorOf('eyJrIjoiZGc6ZXZ0OjEifQ==')).toBe('eyJrIjoiZGc6ZXZ0OjEifQ==');
    expect(cursorOf('c'.repeat(MAX_CURSOR_CHARS))).toHaveLength(MAX_CURSOR_CHARS);
    for (const bad of ['c'.repeat(MAX_CURSOR_CHARS + 1), 'a b', 'a\nb', 'ü', 7, {}, []]) {
      expect(() => cursorOf(bad)).toThrow(CURSOR_INVALID);
    }
  });

  it('getHistory refuses a bad cursor before any Jira call or storage read', async () => {
    for (const cursor of ['x'.repeat(MAX_CURSOR_CHARS + 1), 'two words', 7]) {
      await expect(getChecklistHistory({ cursor }, ctx, storage)).rejects.toThrow(CURSOR_INVALID);
    }
    expect(jira.calls).toEqual([]);
    expect(storage.gets).toEqual([]);
  });

  it('resyncIssues refuses a bad cursor before the search', async () => {
    const settingsCtx = { accountId: '712020:admin', extension: { project: { id: '10000', key: 'DEMO' } } };
    storage.put('dg:tmpl:10000:10004', { workEffortId: 'project-10000-10004', revisionNumber: 2 });
    await expect(resyncIssues({ issueTypeId: '10004', cursor: 'next page' }, settingsCtx, storage)).rejects.toThrow(RESYNC_CURSOR_INVALID);
    expect(jira.callsTo('/search/jql')).toEqual([]);
  });

  it('isGroupId accepts a UUID or a group name, and refuses other values', () => {
    expect(isGroupId('3f1c2a9e-8f2b-4d1a-9c55-1b2e3d4f5a6b')).toBe(true);
    expect(isGroupId('jira-administrators')).toBe(true);
    expect(isGroupId('g'.repeat(MAX_GROUP_ID_CHARS))).toBe(true);
    for (const bad of ['', '   ', 'g'.repeat(MAX_GROUP_ID_CHARS + 1), 'a\u0000b', 'a\nb', 5, null, { groupId: 'x' }]) {
      expect(isGroupId(bad)).toBe(false);
    }
  });

  it('setApproverPolicyFlow refuses a bad group id and saves nothing', async () => {
    jira.handler = () => ({ status: 200, body: { permissions: { ADMINISTER: { havePermission: true } } } });
    for (const bad of ['g'.repeat(MAX_GROUP_ID_CHARS + 1), 'a\nb', '', 5, { groupId: 'x' }]) {
      const res = await setApproverPolicyFlow({ groupIds: ['ok-group', bad] }, storage, { accountId: '712020:admin' });
      expect(res.ok).toBe(false);
      expect(res.message).toContain(`1 to ${MAX_GROUP_ID_CHARS} characters`);
    }
    expect(storage.sets).toEqual([]);
    expect(jira.callsTo('/group/bulk')).toEqual([]);
  });
});
