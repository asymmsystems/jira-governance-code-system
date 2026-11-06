/**
 * B-10: one gate rule. Done-category moves, an exempt list, shared with the panel.
 *
 * Copyright (c) 2026 Asymm Systems. All rights reserved.
 * @author Fahim Farook
 */
import { jira, CountingStorage, JiraCall, pseudonymOf, storedOutsideMap } from '../helpers/forge-mocks';

jest.mock('@forge/api', () => {
  const m = require('../helpers/forge-mocks');
  const asApp = { requestJira: m.makeRequester('app') };
  const asUser = { requestJira: m.makeRequester('user') };
  return { __esModule: true, default: { asApp: () => asApp, asUser: () => asUser }, route: m.routeImpl };
});
jest.mock('@forge/kvs', () => ({ kvs: {}, WhereConditions: { beginsWith: (v: string) => v } }));

import { evaluateGate, blockMessage } from '../../src/domain/gate-rule';
import { gateStatusText } from '../../src/ui/panel-view-model';
import { validateTransition, toggleChecklistItem, getIssueChecklist, VALIDATOR_FAILURE_MESSAGE } from '../../src/index';
import { getSettings, saveExemptions } from '../../src/settings/settings-resolvers';
import { projectConfigKey } from '../../src/settings/project-config';
import { DEFAULT_DEFINITION_OF_DONE } from '../../src/domain/checklist-engine';
import { CriterionState } from '../../src/domain/models';

const project = { id: '10000', key: 'DEMO' };
const issue = { id: '92001', key: 'DEMO-92001', type: 'Task', typeId: '10004' };
const issueCtx = { accountId: '712020:dev', extension: { issue, project } };
const STATUS: Record<string, string> = { '3': 'indeterminate', '10001': 'done', '10006': 'done', '1': 'new' };

function respond(opts: { statusFails?: boolean } = {}) {
  jira.handler = (c: JiraCall) => {
    if (c.path.includes('/mypermissions')) return { status: 200, body: { permissions: { EDIT_ISSUES: { havePermission: true }, ADMINISTER_PROJECTS: { havePermission: true } } } };
    const m = c.path.match(/^\/rest\/api\/3\/status\/(\d+)/);
    if (m) return opts.statusFails ? { status: 500 } : { status: 200, body: { id: m[1], statusCategory: { key: STATUS[m[1]] } } };
    if (c.path.includes('/project/10000/statuses')) {
      return { status: 200, body: [{ statuses: [{ id: '10001', name: 'Done', statusCategory: { key: 'done' } }, { id: '10006', name: 'Canceled', statusCategory: { key: 'done' } }, { id: '3', name: 'In Progress', statusCategory: { key: 'indeterminate' } }] }] };
    }
    if (c.path.startsWith('/rest/api/3/project/')) return { status: 200, body: { issueTypes: [{ id: '10004', name: 'Task' }] } };
    if (c.path.startsWith('/rest/api/3/issue/')) return { status: 200, body: { id: '92001', fields: { issuetype: { id: '10004', name: 'Task' }, project } } };
    return { status: 204 };
  };
}

const move = (to?: string) => ({ issue: { id: '92001', key: 'DEMO-92001' }, ...(to ? { transition: { from: { id: '3' }, to: { id: to } } } : {}) });
const item = (p: Partial<CriterionState>): CriterionState => ({
  workEffortId: 'crit:1:x', templateItemId: 'x', workEffortName: 'X', sequenceNum: 1, purposeTypeId: 'TESTING',
  isMandatory: true, evidenceRequired: false, currentStatusId: 'DOD_OPEN', ...p
});

describe('B-10 evaluateGate (one rule)', () => {
  it('counts DOD_DONE and DOD_WAIVED mandatory criteria as done, and ignores optional ones', () => {
    const g = evaluateGate({ criteria: [item({ templateItemId: 'a', currentStatusId: 'DOD_DONE' }), item({ templateItemId: 'b', currentStatusId: 'DOD_WAIVED' }), item({ templateItemId: 'c', isMandatory: false })] });
    expect(g).toEqual({ satisfied: true, openMandatory: [] });
  });

  it('lists open mandatory items in template order', () => {
    const g = evaluateGate({ criteria: [item({ templateItemId: 'a', workEffortName: 'A' }), item({ templateItemId: 'b', currentStatusId: 'DOD_DONE' }), item({ templateItemId: 'c', workEffortName: 'C' })] });
    expect(g.satisfied).toBe(false);
    expect(g.openMandatory.map(c => c.workEffortName)).toEqual(['A', 'C']);
  });

  it('counts zero mandatory items as satisfied', () => {
    expect(evaluateGate({ criteria: [item({ isMandatory: false })] }).satisfied).toBe(true);
    expect(evaluateGate({ criteria: [] }).satisfied).toBe(true);
  });

  it('needs evidence on a DONE item that requires it', () => {
    expect(evaluateGate({ criteria: [item({ currentStatusId: 'DOD_DONE', evidenceRequired: true })] }).satisfied).toBe(false);
    expect(evaluateGate({ criteria: [item({ currentStatusId: 'DOD_DONE', evidenceRequired: true, evidenceContentId: 'content:1:2' })] }).satisfied).toBe(true);
  });

  it('treats a notAssignee item done by the current assignee as open', () => {
    const st = { criteria: [item({ currentStatusId: 'DOD_DONE', excludedRoleTypeId: 'ASSIGNEE', lastStatusByPartyId: 'dev' })] };
    expect(evaluateGate(st, 'dev').satisfied).toBe(false);
    expect(evaluateGate(st, 'reviewer').satisfied).toBe(true);
    expect(evaluateGate(st).satisfied).toBe(true);
  });

  it('(H-1) treats a notAssignee item waived by an excluded assignee as open, and any other waiver as done', () => {
    const st = { criteria: [item({ currentStatusId: 'DOD_WAIVED', excludedRoleTypeId: 'ASSIGNEE', lastStatusByPartyId: 'dgp-dev' })] };
    expect(evaluateGate(st, new Set(['712020:dev', 'dgp-dev'])).satisfied).toBe(false);
    expect(evaluateGate(st, () => true).satisfied).toBe(false);
    expect(evaluateGate(st, new Set(['dgp-other'])).satisfied).toBe(true);
    expect(evaluateGate(st).satisfied).toBe(true);
    const plain = { criteria: [item({ currentStatusId: 'DOD_WAIVED', lastStatusByPartyId: 'dgp-dev' })] };
    expect(evaluateGate(plain, () => true).satisfied).toBe(true);
    const unknown = { criteria: [item({ currentStatusId: 'DOD_DONE', excludedRoleTypeId: 'ASSIGNEE', lastStatusByPartyId: undefined })] };
    expect(evaluateGate(unknown, () => true).satisfied).toBe(true);
  });

  it('words the block message with every open item and a next step', () => {
    expect(blockMessage([item({ workEffortName: 'A' }), item({ workEffortName: 'B' })]))
      .toBe('Definition of Done is not complete. Open mandatory items: A; B. Open the Definition of Done panel on this issue (from the Apps button if it is not shown) to finish them.');
  });
});

describe('B-10 validator: Done-category moves only', () => {
  let storage: CountingStorage;

  beforeEach(() => {
    jira.reset();
    respond();
    storage = new CountingStorage();
  });

  it('(V-a, V-b) blocks a move into a DONE-category status with no record, and names every open mandatory item', async () => {
    const res = await validateTransition(move('10001'), {}, storage);
    expect(res.result).toBe(false);
    for (const i of DEFAULT_DEFINITION_OF_DONE.items.filter(x => x.isMandatory)) expect(res.errorMessage).toContain(i.title);
    expect(res.errorMessage).toContain('Open the Definition of Done panel');
  });

  it('allows a move into a status that is not DONE category', async () => {
    expect(await validateTransition(move('3'), {}, storage)).toEqual({ result: true });
    expect(await validateTransition(move('1'), {}, storage)).toEqual({ result: true });
  });

  it('blocks when the transition target is missing (fail closed)', async () => {
    const res = await validateTransition(move(), {}, storage);
    expect(res.result).toBe(false);
    expect(res.errorMessage).toContain('Open mandatory items:');
  });

  it('blocks when the status category cannot be read', async () => {
    respond({ statusFails: true });
    expect(await validateTransition(move('3'), {}, storage)).toEqual({ result: false, errorMessage: VALIDATOR_FAILURE_MESSAGE });
  });

  it('allows a satisfied checklist with no status lookup', async () => {
    for (const i of DEFAULT_DEFINITION_OF_DONE.items.filter(x => x.isMandatory)) {
      await toggleChecklistItem({ itemId: i.id, isCompleted: true }, issueCtx, storage);
    }
    jira.calls = [];
    expect(await validateTransition(move('10001'), { extension: { issue, project } }, storage)).toEqual({ result: true });
    expect(jira.callsTo('/rest/api/3/status/')).toEqual([]);
  });

  it('reads the project from the issue when the state has none, then applies its exemptions', async () => {
    const { ChecklistEngine } = require('../../src/domain/checklist-engine');
    storage.put('dg:checklist:92001', ChecklistEngine.initializeState('92001', 'DEMO-92001', DEFAULT_DEFINITION_OF_DONE, 'system'));
    storage.put(projectConfigKey('10000'), { exemptStatusIds: ['10006'], updatedAt: 't', updatedByAccountId: 'a' });
    expect(await validateTransition(move('10006'), {}, storage)).toEqual({ result: true });
    expect(jira.callsTo('/rest/api/3/issue/92001')).toHaveLength(1);
  });

  it('allows an exempt target status, and blocks a non-exempt DONE status', async () => {
    storage.put(projectConfigKey('10000'), { exemptStatusIds: ['10006'], updatedAt: 't', updatedByAccountId: 'a' });
    expect(await validateTransition(move('10006'), {}, storage)).toEqual({ result: true });
    expect((await validateTransition(move('10001'), {}, storage)).result).toBe(false);
  });
});

describe('B-10 gateStatusText', () => {
  it('lists no items when the response carries none', () => {
    expect(gateStatusText({ isFullySatisfied: false }).body).toBe('Moving to Done is blocked while these items are open: .');
  });
});

describe('B-10 panel uses the same rule', () => {
  beforeEach(() => {
    jira.reset();
    respond();
  });

  it('says what the gate does, without claiming a block the workflow may not have', async () => {
    const storage = new CountingStorage();
    const open = await getIssueChecklist({}, issueCtx, storage);
    expect(gateStatusText(open)).toEqual({
      satisfied: false,
      title: 'Definition of Done incomplete',
      body: `Moving to Done is blocked while these items are open: ${DEFAULT_DEFINITION_OF_DONE.items.filter(i => i.isMandatory).map(i => i.title).join(', ')}.`,
      nextStep: `Complete mandatory item: ${DEFAULT_DEFINITION_OF_DONE.items.find(i => i.isMandatory)!.title}.`,
      scope: 'This applies on workflows where your Jira admin added the DefinitionGuard validator.'
    });
    for (const i of DEFAULT_DEFINITION_OF_DONE.items.filter(x => x.isMandatory)) {
      await toggleChecklistItem({ itemId: i.id, isCompleted: true }, issueCtx, storage);
    }
    const done = await getIssueChecklist({}, issueCtx, storage);
    expect(done.isFullySatisfied).toBe(true);
    expect(gateStatusText(done)).toMatchObject({ satisfied: true, title: 'Definition of Done satisfied', body: 'This issue can be moved to Done.' });
  });
});

describe('B-10 exemptions on the settings page', () => {
  const settingsCtx = { accountId: '712020:admin', extension: { project } };
  let storage: CountingStorage;

  beforeEach(() => {
    jira.reset();
    respond();
    storage = new CountingStorage();
  });

  it('lists the project DONE-category statuses and the current exemptions', async () => {
    await saveExemptions({ exemptStatusIds: ['10006'] }, settingsCtx, storage);
    const s: any = await getSettings({}, settingsCtx, storage);
    expect(s.doneStatuses).toEqual([{ id: '10001', name: 'Done' }, { id: '10006', name: 'Canceled' }]);
    expect(s.exemptStatusIds).toEqual(['10006']);
  });

  it('saves exemptions with who and when, and rejects anything that is not a DONE-category status of the project', async () => {
    const saved: any = await saveExemptions({ exemptStatusIds: ['10006'] }, settingsCtx, storage);
    expect(saved).toMatchObject({ exemptStatusIds: ['10006'], updatedByPartyId: pseudonymOf(storage, '712020:admin') });
    expect(storedOutsideMap(storage, '712020:admin')).toEqual([]);
    await expect(saveExemptions({ exemptStatusIds: ['3'] }, settingsCtx, storage)).rejects.toThrow('Only Done-category statuses of this project can be exempt.');
    await expect(saveExemptions({ exemptStatusIds: 'x' }, settingsCtx, storage)).rejects.toThrow('Only Done-category statuses of this project can be exempt.');
    expect(storage.read(projectConfigKey('10000')).exemptStatusIds).toEqual(['10006']);
  });

  it('rejects more than 50 exemptions', async () => {
    await expect(saveExemptions({ exemptStatusIds: Array.from({ length: 51 }, () => '10006') }, settingsCtx, storage)).rejects.toThrow('Only Done-category statuses');
  });

  it('reports a failed status read with a next step, and treats a non-list answer as no statuses', async () => {
    const perms = { status: 200, body: { permissions: { ADMINISTER_PROJECTS: { havePermission: true } } } };
    jira.handler = (c: JiraCall) => (c.path.includes('/mypermissions') ? perms : c.path.includes('/statuses') ? { status: 500 } : { status: 200, body: { issueTypes: [] } });
    await expect(getSettings({}, settingsCtx, storage)).rejects.toThrow('could not read the project statuses. Refresh the page.');
    jira.handler = (c: JiraCall) => (c.path.includes('/mypermissions') ? perms : { status: 200, body: { issueTypes: [] } });
    expect((await getSettings({}, settingsCtx, storage) as any).doneStatuses).toEqual([]);
  });

  it('project config is empty for a missing project id', async () => {
    const { ProjectConfigStore } = require('../../src/settings/project-config');
    expect(await new ProjectConfigStore(storage).get('')).toBeUndefined();
  });

  it('refuses a non-admin', async () => {
    jira.handler = (c: JiraCall) => (c.path.includes('/mypermissions') ? { status: 200, body: { permissions: { ADMINISTER_PROJECTS: { havePermission: false } } } } : { status: 200, body: [] });
    await expect(saveExemptions({ exemptStatusIds: [] }, settingsCtx, storage)).rejects.toThrow('Only a project admin');
  });
});
