/**
 * B-02: permission checks on tick, reset and template save.
 *
 * Copyright (c) 2026 Asymm Systems. All rights reserved.
 * @author Fahim Farook
 */
import { jira, CountingStorage, JiraCall, JiraReply } from '../helpers/forge-mocks';

jest.mock('@forge/api', () => {
  const m = require('../helpers/forge-mocks');
  const asApp = { requestJira: m.makeRequester('app') };
  const asUser = { requestJira: m.makeRequester('user') };
  return { __esModule: true, default: { asApp: () => asApp, asUser: () => asUser }, route: m.routeImpl };
});
jest.mock('@forge/kvs', () => ({ kvs: { get: jest.fn(), set: jest.fn(), delete: jest.fn() } }));

import { toggleChecklistItem, resetChecklist, handler, setGlobalStorageProvider } from '../../src/index';
import { checkIssuePermissions, PermissionDeniedError } from '../../src/security/permissions';
import { ChecklistEngine, DEFAULT_DEFINITION_OF_DONE } from '../../src/domain/checklist-engine';

const ctx = { accountId: '712020:caller', extension: { issue: { id: '20001', key: 'DEMO-21', type: 'Task' }, project: { key: 'DEMO' } } };

function grant(perms: Record<string, boolean>, extra?: (c: JiraCall) => JiraReply | undefined) {
  jira.handler = (c: JiraCall) => {
    const e = extra && extra(c);
    if (e) return e;
    if (c.path.includes('/mypermissions')) {
      const out: any = {};
      for (const [k, v] of Object.entries(perms)) out[k] = { key: k, havePermission: v };
      return { status: 200, body: { permissions: out } };
    }
    if (c.path.includes('/rest/api/3/user')) return { status: 200, body: { displayName: 'Caller' } };
    return { status: 200, body: { id: '20001', fields: { issuetype: { name: 'Task' } } } };
  };
}

describe('B-02 permission checks', () => {
  let storage: CountingStorage;

  beforeEach(() => {
    jira.reset();
    storage = new CountingStorage();
    storage.put('dg:checklist:20001', ChecklistEngine.initializeState('20001', 'DEMO-21', DEFAULT_DEFINITION_OF_DONE, 'system', '2026-11-01T00:00:00.000Z'));
  });

  it('rejects a toggle without EDIT_ISSUES and leaves the stored state unchanged', async () => {
    grant({ EDIT_ISSUES: false });
    const before = storage.store.get('dg:checklist:20001');
    await expect(toggleChecklistItem({ itemId: 'item-unit-tests', isCompleted: true }, ctx, storage))
      .rejects.toThrow('You need Edit issues permission to change this checklist.');
    expect(storage.store.get('dg:checklist:20001')).toBe(before);
    expect(storage.sets).toEqual([]);
  });

  it('allows a toggle with EDIT_ISSUES', async () => {
    grant({ EDIT_ISSUES: true });
    const updated = await toggleChecklistItem({ itemId: 'item-unit-tests', isCompleted: true }, ctx, storage);
    expect(updated.items.find(i => i.id === 'item-unit-tests')!.isCompleted).toBe(true);
  });

  it('rejects a reset without ADMINISTER_PROJECTS and leaves the stored state unchanged', async () => {
    grant({ ADMINISTER_PROJECTS: false, EDIT_ISSUES: true });
    const before = storage.store.get('dg:checklist:20001');
    await expect(resetChecklist({}, ctx, storage)).rejects.toThrow('Only a project admin can reset this checklist.');
    expect(storage.store.get('dg:checklist:20001')).toBe(before);
  });

  it('allows a reset with ADMINISTER_PROJECTS', async () => {
    grant({ ADMINISTER_PROJECTS: true });
    const reset = await resetChecklist({}, ctx, storage);
    expect(reset.items.every(i => !i.isCompleted)).toBe(true);
    expect(storage.read('dg:evt:20001:00000002').transitionName).toBe('Reset');
  });

  it('sends the permission check as the user, with the issue key, and never as the app', async () => {
    grant({ EDIT_ISSUES: true });
    await toggleChecklistItem({ itemId: 'item-unit-tests', isCompleted: true }, ctx, storage);
    const userCalls = jira.callsTo('/mypermissions', 'user');
    expect(userCalls).toHaveLength(1);
    expect(userCalls[0].path).toContain('issueKey=DEMO-21');
    expect(userCalls[0].path).toContain('permissions=EDIT_ISSUES');
    expect(jira.callsTo('/mypermissions', 'app')).toEqual([]);
  });

  it('fails closed when the permission call returns a non-200', async () => {
    grant({}, c => (c.path.includes('/mypermissions') ? { status: 500 } : undefined));
    await expect(toggleChecklistItem({ itemId: 'item-unit-tests', isCompleted: true }, ctx, storage)).rejects.toThrow(PermissionDeniedError);
    expect(storage.sets).toEqual([]);
  });

  it('fails closed when the permission call throws', async () => {
    grant({}, c => (c.path.includes('/mypermissions') ? ({ status: 0, throws: 'down' } as any) : undefined));
    await expect(resetChecklist({}, ctx, storage)).rejects.toThrow(PermissionDeniedError);
  });

  it('fails closed when the answer omits the permission', async () => {
    grant({});
    await expect(checkIssuePermissions('DEMO-21', ['EDIT_ISSUES'])).rejects.toThrow(PermissionDeniedError);
  });

  it('rejects a check with no issue key', async () => {
    await expect(checkIssuePermissions('', ['EDIT_ISSUES'])).rejects.toThrow(PermissionDeniedError);
  });

  it('exposes no resolver that writes dod-templates from the issue panel', async () => {
    grant({ EDIT_ISSUES: true, ADMINISTER_PROJECTS: true });
    setGlobalStorageProvider(storage);
    for (const functionKey of ['saveProjectTemplate', 'getProjectTemplates']) {
      await expect(handler({ call: { functionKey, payload: { projectKey: 'OTHER', issueType: 'Bug', template: { items: [] } } }, context: ctx } as any))
        .rejects.toThrow();
    }
    expect([...storage.store.keys()].some(k => k.startsWith('dod-templates:'))).toBe(false);
  });
});
