/**
 * B-09: Marketplace licensing.
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

import { toggleChecklistItem, resetChecklist, getIssueChecklist, validateTransition } from '../../src/index';
import { saveTemplate } from '../../src/settings/settings-resolvers';
import { LICENCE_INACTIVE, VALIDATOR_LICENCE_INACTIVE, isLicenceInactive } from '../../src/security/licence';

const issue = { id: '91001', key: 'DEMO-91001', type: 'Task', typeId: '10004' };
const project = { id: '10000', key: 'DEMO' };
const inactive = { isActive: false };

function grantAll() {
  jira.handler = (c: JiraCall) => {
    if (c.path.includes('/mypermissions')) return { status: 200, body: { permissions: { EDIT_ISSUES: { havePermission: true }, ADMINISTER_PROJECTS: { havePermission: true } } } };
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

  it('(V-a, V-b) the validator blocks with a licence message when the licence is inactive, and still names open items otherwise', async () => {
    const blocked = await validateTransition({ issue: { id: '91001' } }, { license: inactive, extension: { issue, project } }, storage);
    expect(blocked).toEqual({ result: false, errorMessage: VALIDATOR_LICENCE_INACTIVE });
    const normal = await validateTransition({ issue: { id: '91001' } }, { extension: { issue, project } }, storage);
    expect(normal.result).toBe(false);
    expect(normal.errorMessage).toContain('Pending items:');
  });
});
