/**
 * B-17: gate coverage check on the settings page.
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

import { gateCoverage, coverageFromWorkflows, isDefinitionGuardRule } from '../../src/settings/coverage';
import { saveExemptions, settingsHandler } from '../../src/settings/settings-resolvers';
import { setGlobalStorageProvider } from '../../src/index';
import { projectConfigKey } from '../../src/settings/project-config';

const project = { id: '10001', key: 'DEMO' };
const ctx = { accountId: '712020:admin', extension: { project } };

// The shape of /rest/api/3/workflows/search?projectId=10001 on the DEMO site (live GET, 2026-11-01, L-01 and L-07),
// trimmed to the fields the check reads. One "Mark as done" transition carries a DefinitionGuard rule for the test.
// The rule exactly as Jira stored it on DEMO "Mark as done" (live GET, 2026-11-01): a function validator
// is stored with ruleKey forge:expression-validator and the module key in parameters.key.
const DG_RULE = { ruleKey: 'forge:expression-validator', parameters: { key: 'ari:cloud:ecosystem::extension/73e4f63d-7d60-450c-96d5-f81ca68a709c/b575a3a8-ffe9-4570-ac50-42a6a555c167/static/definitionguard-workflow-validator', config: '', id: '92c2e007-4a00-40f2-b141-04d6dedfe263' }, id: '40142776' };
const FIXTURE = {
  isLast: true,
  statuses: [
    { statusReference: '1', name: 'Open', statusCategory: 'TODO' },
    { statusReference: '3', name: 'In Progress', statusCategory: 'IN_PROGRESS' },
    { statusReference: '5', name: 'Resolved', statusCategory: 'DONE' },
    { statusReference: '6', name: 'Closed', statusCategory: 'DONE' },
    { statusReference: '10001', name: 'Done', statusCategory: 'DONE' },
    { statusReference: '10006', name: 'Canceled', statusCategory: 'DONE' }
  ],
  values: [
    { name: 'DEMO: Jira Service Management default workflow', transitions: [
      { id: '1', type: 'INITIAL', name: 'Create', toStatusReference: '1', validators: [] },
      { id: '61', type: 'DIRECTED', name: 'Mark as done', toStatusReference: '10001', validators: [DG_RULE] },
      { id: '11', type: 'DIRECTED', name: 'Start progress', toStatusReference: '3', validators: [] }
    ] },
    { name: 'DEMO: Service Request Fulfilment workflow for Jira Service Management', transitions: [
      { id: '901', type: 'DIRECTED', name: 'Cancel request', toStatusReference: '10006', validators: [] },
      { id: '761', type: 'DIRECTED', name: 'Resolve this issue', toStatusReference: '5', validators: [{ ruleKey: 'system:check-permission-validator', parameters: {} }] },
      { id: '941', type: 'DIRECTED', name: 'Close', toStatusReference: '6' }
    ] }
  ]
};

describe('B-17 coverageFromWorkflows', () => {
  it('lists every transition into a DONE-category status, gated or not, and marks exempt targets', () => {
    const c = coverageFromWorkflows([FIXTURE], ['10006']);
    expect(c.transitions).toEqual([
      { workflow: 'DEMO: Jira Service Management default workflow', transition: 'Mark as done', toStatus: 'Done', gated: true, exempt: false },
      { workflow: 'DEMO: Service Request Fulfilment workflow for Jira Service Management', transition: 'Cancel request', toStatus: 'Canceled', gated: false, exempt: true },
      { workflow: 'DEMO: Service Request Fulfilment workflow for Jira Service Management', transition: 'Resolve this issue', toStatus: 'Resolved', gated: false, exempt: false },
      { workflow: 'DEMO: Service Request Fulfilment workflow for Jira Service Management', transition: 'Close', toStatus: 'Closed', gated: false, exempt: false }
    ]);
    expect(c).toMatchObject({ gated: 1, needed: 3, missing: 2 });
    expect(c.summary).toBe('1 of 3 completion transitions are gated. DefinitionGuard is not on 2 of them yet: issues can reach Done through them without the checklist.');
  });

  it('says so when every needed transition is gated, or when there is none', () => {
    expect(coverageFromWorkflows([FIXTURE], ['10006', '5', '6']).summary).toBe('All 1 completion transitions are gated.');
    expect(coverageFromWorkflows([{ isLast: true, statuses: [], values: [] }], []).summary).toBe('This project has no transition into a Done-category status.');
  });

  it('treats missing arrays in a page as empty', () => {
    expect(coverageFromWorkflows([{}, { statuses: FIXTURE.statuses, values: [{ name: 'w' }] }], []).transitions).toEqual([]);
  });

  it('recognises the DefinitionGuard rule by its module key, and nothing else', () => {
    expect(isDefinitionGuardRule(DG_RULE)).toBe(true);
    expect(isDefinitionGuardRule({ ruleKey: 'system:check-permission-validator', parameters: {} })).toBe(false);
    expect(isDefinitionGuardRule(null)).toBe(false);
  });
});

describe('B-17 gateCoverage resolver', () => {
  let storage: CountingStorage;
  let admin = true;

  beforeEach(() => {
    jira.reset();
    admin = true;
    storage = new CountingStorage();
    jira.handler = (c: JiraCall) => {
      if (c.path.includes('/mypermissions')) return { status: 200, body: { permissions: { ADMINISTER_PROJECTS: { havePermission: admin } } } };
      if (c.path.startsWith('/rest/api/3/workflows/search')) {
        const startAt = Number(new URLSearchParams(c.path.split('?')[1]).get('startAt') || 0);
        return startAt === 0
          ? { status: 200, body: { ...FIXTURE, isLast: false, values: [FIXTURE.values[0]] } }
          : { status: 200, body: { ...FIXTURE, isLast: true, values: [FIXTURE.values[1]] } };
      }
      if (c.path.includes('/statuses')) return { status: 200, body: [{ statuses: [{ id: '10006', name: 'Canceled', statusCategory: { key: 'done' } }] }] };
      return { status: 204 };
    };
  });

  it('reads the project workflows as the app, read only and paged, and applies the saved exemptions', async () => {
    storage.put(projectConfigKey('10001'), { exemptStatusIds: ['10006'], updatedAt: 't', updatedByAccountId: 'a' });
    const c: any = await gateCoverage({}, ctx, storage);
    expect(c).toMatchObject({ gated: 1, needed: 3, missing: 2 });
    const calls = jira.callsTo('/rest/api/3/workflows/search', 'app');
    expect(calls).toHaveLength(2);
    expect(decodeURIComponent(calls[0].path)).toContain('projectId=10001&expand=values.transitions');
    expect(jira.calls.every(x => x.method === 'GET')).toBe(true);
    expect(storage.sets).toEqual([]);
  });

  it('works with no saved exemptions, and dispatches through the settings handler', async () => {
    setGlobalStorageProvider(storage);
    const c: any = await settingsHandler({ call: { functionKey: 'gateCoverage', payload: {} }, context: ctx } as any);
    expect(c).toMatchObject({ gated: 1, needed: 4, missing: 3 });
  });

  it('refuses a non-admin before reading any workflow', async () => {
    admin = false;
    await expect(gateCoverage({}, ctx, storage)).rejects.toThrow('Only a project admin');
    expect(jira.callsTo('/workflows/search')).toEqual([]);
  });

  it('reports a failed workflow read with a next step', async () => {
    jira.handler = (c: JiraCall) => (c.path.includes('/mypermissions') ? { status: 200, body: { permissions: { ADMINISTER_PROJECTS: { havePermission: true } } } } : { status: 403 });
    await expect(gateCoverage({}, ctx, storage)).rejects.toThrow('could not read the project workflows. Ask a Jira admin to check that DefinitionGuard has workflow read access.');
  });

  it('requests only the read-only workflow scope in the manifest, not manage:jira-configuration', () => {
    const manifest = fs.readFileSync(path.join(__dirname, '../../manifest.yml'), 'utf8');
    expect(manifest).toContain('- read:workflow:jira');
    expect(manifest).not.toContain('manage:jira-configuration');
  });

  it('still lets an admin save exemptions (unchanged)', async () => {
    await expect(saveExemptions({ exemptStatusIds: ['10006'] }, ctx, storage)).resolves.toMatchObject({ exemptStatusIds: ['10006'] });
  });
});
