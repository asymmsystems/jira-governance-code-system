/**
 * TASK-00006: a refusal comes back to the panel as a typed result. Nothing is thrown, so the Forge
 * runtime writes no ERROR line with the message and stack (production, 2026-11-18: the assignee
 * ticking a "Not the assignee" item). The panel shows the same text as before.
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
const invoke = jest.fn();
jest.mock('@forge/bridge', () => ({ invoke }));

import { handler, ASSIGNEE_DENIED, setGlobalStorageProvider } from '../../src/index';
import { settingsHandler } from '../../src/settings/settings-resolvers';
import { BROWSE_CHECK_FAILED } from '../../src/security/permissions';
import { TemplateStore } from '../../src/settings/template-store';
import { guardResolver, isResolverFailure, RefusalError, toResolverFailure, UnavailableError } from '../../src/resolver-boundary';
import { callResolver, ResolverCallError } from '../../src/frontend/call';
import { panelErrorText } from '../../src/ui/panel-view-model';

const project = { id: '10000', key: 'DEMO' };
const issue = { id: '94001', key: 'DEMO-94001', type: 'Task', typeId: '10004' };
const template = {
  name: 'SoD DoD',
  waiverPermission: 'ADMINISTER_PROJECTS',
  items: [{ id: 'peer-review', title: 'Peer review approved', isMandatory: true, category: 'CODE_QUALITY', notAssignee: true }]
};
const SECRET = 'DEMO-94001 Confidential summary';

function respond() {
  jira.handler = (c: JiraCall) => {
    if (c.path.includes('/mypermissions')) {
      const keys = decodeURIComponent(c.path.split('permissions=')[1]).split(',');
      return { status: 200, body: { permissions: Object.fromEntries(keys.map(k => [k, { havePermission: true }])) } };
    }
    if (/^\/rest\/api\/3\/issue\/(94001|DEMO-94001)\/changelog\?/.test(c.path)) {
      return { status: 200, body: { startAt: 0, maxResults: 100, total: 0, isLast: true, values: [] } };
    }
    if (/^\/rest\/api\/3\/issue\/(94001|DEMO-94001)\?/.test(c.path)) {
      return { status: 200, body: { id: '94001', fields: { assignee: { accountId: 'dev' }, issuetype: { id: '10004' }, project } } };
    }
    return { status: 204 };
  };
}

/** Calls a registered resolver as the Forge runtime does: the caller comes from the runtime payload. */
const run = (h: any, functionKey: string, payload: any, context: any, accountId = 'dev') =>
  h({ call: { functionKey, payload }, context }, { principal: { accountId } });

describe('TASK-00006 refusals are typed results, not thrown errors', () => {
  let storage: CountingStorage;
  let errorLog: jest.SpyInstance;

  beforeEach(async () => {
    jira.reset();
    respond();
    storage = new CountingStorage();
    setGlobalStorageProvider(storage);
    await new TemplateStore(storage).save('10000', '10004', template, 'admin');
    errorLog = jest.spyOn(console, 'error').mockImplementation(() => undefined);
    invoke.mockReset();
  });

  afterEach(() => errorLog.mockRestore());

  it('the assignee ticking a "Not the assignee" item gets the refusal as a result, and nothing is logged', async () => {
    const out = await run(handler, 'toggleItem', { itemId: 'peer-review', isCompleted: true }, { extension: { issue, project } });
    expect(out).toEqual({ ok: false, error: { kind: 'PERMISSION', message: ASSIGNEE_DENIED } });
    expect(errorLog).not.toHaveBeenCalled();
    expect(storage.sets.filter(k => k.startsWith('dg:evt:') || k.startsWith('dg:state:'))).toEqual([]);
  });

  it('the panel shows the same text for the typed result as it did for the thrown error', async () => {
    invoke.mockResolvedValueOnce({ ok: false, error: { kind: 'PERMISSION', message: ASSIGNEE_DENIED } });
    let err: unknown;
    try {
      await callResolver('toggleItem', { itemId: 'peer-review', isCompleted: true });
    } catch (e) {
      err = e;
    }
    expect(err).toBeInstanceOf(ResolverCallError);
    expect(panelErrorText(err, 'complete the item')).toBe(ASSIGNEE_DENIED);
    // The text the panel showed before, when the bridge rejected with the thrown message
    expect(panelErrorText(new Error(`There was an error invoking the function - ${ASSIGNEE_DENIED}`), 'complete the item')).toBe(ASSIGNEE_DENIED);
  });

  it('a failed permission check refuses (fail closed), says so, and logs the failure by name only', async () => {
    jira.browse = 503;
    const out = await run(handler, 'getChecklist', {}, { extension: { issue, project } });
    expect(out).toEqual({ ok: false, error: { kind: 'UNAVAILABLE', message: BROWSE_CHECK_FAILED } });
    expect(errorLog.mock.calls).toEqual([['DefinitionGuard: resolver getChecklist failed: PermissionDeniedError']]);
  });

  it('a fault is logged by name only and comes back as FAILURE, so the panel shows its generic next step', async () => {
    const fault = guardResolver('getChecklist', async () => { throw Object.assign(new TypeError(SECRET), { status: 500 }); });
    const out = await fault({});
    expect(out).toEqual({ ok: false, error: { kind: 'FAILURE', message: '' } });
    expect(errorLog.mock.calls).toEqual([['DefinitionGuard: resolver getChecklist failed: TypeError status=500']]);
    invoke.mockResolvedValueOnce(out);
    const err = await callResolver('getChecklist').catch(e => e);
    expect(panelErrorText(err, 'load the checklist')).toBe(panelErrorText(new Error(SECRET), 'load the checklist'));
  });

  it('the settings resolvers go through the same boundary', async () => {
    const out = await run(settingsHandler, 'getSettings', {}, {});
    expect(out).toEqual({ ok: false, error: { kind: 'VALIDATION', message: 'DefinitionGuard: Missing project context. Open this page from the project settings.' } });
    expect(errorLog).not.toHaveBeenCalled();
  });

  it('passes results through, and tells a failure result from any other result', async () => {
    invoke.mockResolvedValueOnce({ ok: false, code: 'NOT_ADMIN', message: 'x' });
    await expect(callResolver('authority-policy-get')).resolves.toEqual({ ok: false, code: 'NOT_ADMIN', message: 'x' });
    expect(isResolverFailure(null)).toBe(false);
    expect(isResolverFailure({ ok: true })).toBe(false);
    expect(isResolverFailure({ ok: false, error: { kind: 'PERMISSION' } })).toBe(false);
    expect(toResolverFailure(new UnavailableError('u'))).toEqual({ result: { ok: false, error: { kind: 'UNAVAILABLE', message: 'u' } }, log: true });
    expect(toResolverFailure(new RefusalError('CONFLICT', 'c'))).toEqual({ result: { ok: false, error: { kind: 'CONFLICT', message: 'c' } }, log: false });
    expect(new UnavailableError('u').name).toBe('UnavailableError');
  });
});
