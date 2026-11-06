/**
 * B-09: Marketplace licensing.
 *
 * Copyright (c) 2026 Asymm Systems. All rights reserved.
 * @author Fahim Farook
 */
import * as fs from 'fs';
import * as path from 'path';
import { jira, CountingStorage, JiraCall } from '../helpers/forge-mocks';

// The runtime app context, as getAppContext() returns it inside Forge (H-3). A test sets it.
let mockAppContext: (() => any) | undefined;
jest.mock('@forge/api', () => {
  const m = require('../helpers/forge-mocks');
  const asApp = { requestJira: m.makeRequester('app') };
  const asUser = { requestJira: m.makeRequester('user') };
  return {
    __esModule: true,
    default: { asApp: () => asApp, asUser: () => asUser },
    route: m.routeImpl,
    getAppContext: () => (mockAppContext ? mockAppContext() : undefined)
  };
});
jest.mock('@forge/kvs', () => ({ kvs: {}, WhereConditions: { beginsWith: (v: string) => v } }));

import { toggleChecklistItem, resetChecklist, getIssueChecklist, validateTransition } from '../../src/index';
import { saveTemplate, getSettings } from '../../src/settings/settings-resolvers';
import { LICENCE_INACTIVE, LICENCE_GATE_OFF, isLicenceInactive, licenceOf } from '../../src/security/licence';
import { buildPanelViewModel } from '../../src/ui/panel-view-model';

const issue = { id: '91001', key: 'DEMO-91001', type: 'Task', typeId: '10004' };
const project = { id: '10000', key: 'DEMO' };
const inactive = { isActive: false };

function grantAll() {
  jira.handler = (c: JiraCall) => {
    if (c.path.includes('/mypermissions')) return { status: 200, body: { permissions: { EDIT_ISSUES: { havePermission: true }, ADMINISTER_PROJECTS: { havePermission: true } } } };
    if (c.path.endsWith('/statuses')) return { status: 200, body: [] };
    if (c.path.startsWith('/rest/api/3/project/')) return { status: 200, body: { issueTypes: [{ id: '10004', name: 'Task' }] } };
    return { status: 204 };
  };
}

describe('B-09 licensing', () => {
  let storage: CountingStorage;

  beforeEach(() => {
    jira.reset();
    grantAll();
    storage = new CountingStorage();
    mockAppContext = undefined;
  });

  it('enables licensing in the manifest', () => {
    const manifest = fs.readFileSync(path.join(__dirname, '../../manifest.yml'), 'utf8');
    expect(manifest).toMatch(/app:\n(?:.*\n)*?\s+licensing:\n\s+enabled: true/);
  });

  it('reads the licence state: inactive only when the licence says so', () => {
    expect(isLicenceInactive({ license: inactive })).toBe(true);
    expect(isLicenceInactive({ license: { isActive: true } })).toBe(false);
    expect(isLicenceInactive({})).toBe(false);
    expect(isLicenceInactive(undefined)).toBe(false);
  });

  it('refuses toggle, reset and template save with an inactive licence, and writes nothing', async () => {
    const ctx = { accountId: 'a', license: inactive, extension: { issue, project } };
    await expect(toggleChecklistItem({ itemId: 'item-unit-tests', isCompleted: true }, ctx, storage)).rejects.toThrow(LICENCE_INACTIVE);
    await expect(resetChecklist({}, ctx, storage)).rejects.toThrow(LICENCE_INACTIVE);
    await expect(saveTemplate({ issueTypeId: '10004', template: { name: 'x', items: [{ id: 'a', title: 'a', isMandatory: true, category: 'TESTING' }] } }, { accountId: 'a', license: inactive, extension: { project } }, storage))
      .rejects.toThrow(LICENCE_INACTIVE);
    expect(storage.sets).toEqual([]);
    expect(LICENCE_INACTIVE).toBe('Your DefinitionGuard licence is not active. Ask your Jira admin.');
  });

  it('still shows the checklist with an inactive licence (reads are allowed)', async () => {
    const res = await getIssueChecklist({}, { accountId: 'a', license: inactive, extension: { issue, project } }, storage);
    expect(res.items.length).toBeGreaterThan(0);
  });

  it('behaves as before when the licence context is absent', async () => {
    const res = await toggleChecklistItem({ itemId: 'item-unit-tests', isCompleted: true }, { accountId: 'a', extension: { issue, project } }, storage);
    expect(res.stateVersion).toBe(2);
  });

  it('(BL-4) the validator lets every move through when the licence is inactive, complete or not, and writes nothing', async () => {
    const incomplete = await validateTransition({ issue: { id: '91001' }, transition: { to: { id: '10002' } } }, { license: inactive, extension: { issue, project } }, storage);
    expect(incomplete).toEqual({ result: true });
    expect(jira.calls).toEqual([]);
    expect(storage.sets).toEqual([]);
  });

  it('(BL-4) still blocks an incomplete move when the licence is active or absent', async () => {
    for (const ctx of [{ license: { isActive: true }, extension: { issue, project } }, { extension: { issue, project } }]) {
      const res = await validateTransition({ issue: { id: '91001' } }, ctx, storage);
      expect(res.result).toBe(false);
      expect(res.errorMessage).toContain('Open mandatory items:');
    }
  });

  it('(H-3) reads the licence from the Forge app context when the call context has none', async () => {
    mockAppContext = () => ({ license: { isActive: false } });
    expect(isLicenceInactive({})).toBe(true);
    expect(await validateTransition({ issue: { id: '91001' } }, { extension: { issue, project } }, storage)).toEqual({ result: true });
    await expect(toggleChecklistItem({ itemId: 'item-unit-tests', isCompleted: true }, { accountId: 'a', extension: { issue, project } }, storage)).rejects.toThrow(LICENCE_INACTIVE);
    mockAppContext = () => ({ license: { isActive: true } });
    expect(isLicenceInactive({})).toBe(false);
  });

  it('(H-3) the call context wins over the app context, and the older "active" field is understood', () => {
    mockAppContext = () => ({ license: { isActive: false } });
    expect(isLicenceInactive({ license: { isActive: true } })).toBe(false);
    mockAppContext = undefined;
    expect(isLicenceInactive({ license: { active: false } })).toBe(true);
    expect(isLicenceInactive({ license: { active: true } })).toBe(false);
    expect(isLicenceInactive({ license: {} })).toBe(false);
  });

  it('(H-3) outside the Forge runtime (no app context) there is no licence and nothing changes', () => {
    mockAppContext = () => { throw new Error('no runtime'); };
    expect(licenceOf({})).toBeUndefined();
    expect(isLicenceInactive({})).toBe(false);
  });

  it('(BL-4) the panel and the settings page say the gate is off while the licence is inactive', async () => {
    const res = await getIssueChecklist({}, { accountId: 'a', license: inactive, extension: { issue, project } }, storage);
    expect(res.licenceInactive).toBe(true);
    expect(buildPanelViewModel(res)!.licenceNotice).toBe(LICENCE_GATE_OFF);
    const active = await getIssueChecklist({}, { accountId: 'a', license: { isActive: true }, extension: { issue, project } }, storage);
    expect(active.licenceInactive).toBeUndefined();
    expect(buildPanelViewModel(active)!.licenceNotice).toBeUndefined();
    const settings = await getSettings({}, { accountId: 'a', license: inactive, extension: { project } }, storage);
    expect(settings.licenceNotice).toBe(LICENCE_GATE_OFF);
    const licensed = await getSettings({}, { accountId: 'a', extension: { project } }, storage);
    expect(licensed.licenceNotice).toBeUndefined();
    expect(LICENCE_GATE_OFF).toContain('moves to Done are not blocked');
  });
});
