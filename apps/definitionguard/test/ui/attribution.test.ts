/**
 * B-07: store accountIds only; render names at view time.
 *
 * Copyright (c) 2026 Asymm Systems. All rights reserved.
 * @author Fahim Farook
 */
import { jira, CountingStorage, JiraCall } from '../helpers/forge-mocks';

jest.mock('@forge/api', () => {
  const m = require('../helpers/forge-mocks');
  const asApp = { requestJira: m.makeRequester('app') };
  const asUser = { requestJira: m.makeRequester('user') };
  return { __esModule: true, default: { asApp: () => asApp, asUser: () => asUser }, route: m.routeImpl };
});
jest.mock('@forge/kvs', () => ({ kvs: {}, WhereConditions: { beginsWith: (v: string) => v } }));

import * as fs from 'fs';
import * as path from 'path';
import { getIssueChecklist, toggleChecklistItem, resetChecklist } from '../../src/index';
import { attributionOf } from '../../src/ui/panel-view-model';
import { itemsFromLegacy } from '../../src/domain/event-log';
import { ChecklistEngine, DEFAULT_DEFINITION_OF_DONE } from '../../src/domain/checklist-engine';

const ctx = { accountId: '712020:alice', extension: { issue: { id: '90001', key: 'DEMO-90001', type: 'Task', typeId: '10004' }, project: { id: '10000', key: 'DEMO' } } };

function grantAll(userLookupFails = false) {
  jira.handler = (c: JiraCall) => {
    if (c.path.includes('/mypermissions')) return { status: 200, body: { permissions: { EDIT_ISSUES: { havePermission: true }, ADMINISTER_PROJECTS: { havePermission: true } } } };
    if (c.path.includes('/rest/api/3/user')) return userLookupFails ? { status: 404 } : { status: 200, body: { displayName: 'Alice Example' } };
    return { status: 204 };
  };
}

describe('B-07 attribution', () => {
  let storage: CountingStorage;

  beforeEach(() => {
    jira.reset();
    grantAll();
    storage = new CountingStorage();
  });

  it('stores only the accountId in every event and in the state', async () => {
    await toggleChecklistItem({ itemId: 'item-unit-tests', isCompleted: true }, ctx, storage);
    await resetChecklist({}, ctx, storage);
    const all = [...storage.store.values()].join('\n');
    expect(all).toContain('712020:alice');
    expect(all).not.toContain('Alice Example');
    expect(all).not.toMatch(/"(completedBy|actorName|userId)"/);
  });

  it('makes 0 user lookups and 0 KVS writes on panel loads, also when lookups fail', async () => {
    await toggleChecklistItem({ itemId: 'item-unit-tests', isCompleted: true }, ctx, storage);
    for (const failing of [false, true]) {
      grantAll(failing);
      jira.calls = [];
      storage.sets = [];
      await getIssueChecklist({}, ctx, storage);
      expect(jira.callsTo('/rest/api/3/user')).toEqual([]);
      expect(storage.sets).toEqual([]);
    }
  });

  it('never changes a stored event across 10 panel loads', async () => {
    await toggleChecklistItem({ itemId: 'item-unit-tests', isCompleted: true }, ctx, storage);
    const before = new Map(storage.store);
    for (let n = 0; n < 10; n++) await getIssueChecklist({}, ctx, storage);
    expect(new Map(storage.store)).toEqual(before);
  });

  it('renders a user from the accountId, and a v1 name as plain text only when no accountId exists', () => {
    expect(attributionOf({ byAccountId: '712020:alice' } as any)).toEqual({ kind: 'user', accountId: '712020:alice' });
    expect(attributionOf({ byAccountId: '712020:alice', legacyName: 'Old Name' } as any)).toEqual({ kind: 'user', accountId: '712020:alice' });
    expect(attributionOf({ legacyName: 'Old Name' } as any)).toEqual({ kind: 'text', text: 'Old Name' });
    expect(attributionOf({} as any)).toBeUndefined();
  });

  it('keeps a v1 display name as text when the v1 record has no accountId', () => {
    let legacy = ChecklistEngine.initializeState('90002', 'DEMO-90002', DEFAULT_DEFINITION_OF_DONE, 'system');
    legacy = ChecklistEngine.toggleItem(legacy, { issueId: '90002', issueKey: 'DEMO-90002', itemId: 'item-unit-tests', isCompleted: true, userId: 'Old Name' });
    const items = itemsFromLegacy(legacy);
    expect(items[0]).toMatchObject({ status: 'DONE', legacyName: 'Old Name' });
    expect(items[0].byAccountId).toBeUndefined();
  });

  it('no source file calls the Jira user API', () => {
    const root = path.join(__dirname, '../../src');
    const walk = (d: string): string[] => fs.readdirSync(d, { withFileTypes: true }).flatMap(f => (f.isDirectory() ? walk(path.join(d, f.name)) : [path.join(d, f.name)]));
    for (const f of walk(root)) expect(fs.readFileSync(f, 'utf8')).not.toContain('/rest/api/3/user?');
  });
});
