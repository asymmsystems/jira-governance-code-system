/**
 * B-06: project templates, admin only, applied on every path.
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

import { validateTemplate, TemplateStore, templateKey, MAX_TEMPLATE_BYTES, WAIVER_PERMISSIONS, WAIVER_PERMISSION_INVALID } from '../../src/settings/template-store';
import { getSettings, saveTemplate, settingsHandler } from '../../src/settings/settings-resolvers';
import { getIssueChecklist, toggleChecklistItem, resetChecklist, validateTransition, setGlobalStorageProvider } from '../../src/index';
import { PermissionDeniedError, getProjectPermissions } from '../../src/security/permissions';
import { addItem, editorFromTemplate, setWaiverPermission, toTemplatePayload, WAIVER_PERMISSION_OPTIONS } from '../../src/ui/template-editor';

const PROJECT = { id: '10000', key: 'DEMO' };
const settingsCtx = (accountId = '712020:admin') => ({ accountId, extension: { project: PROJECT } });
const issueCtx = (id = '80001', typeId = '10004') => ({
  accountId: '712020:dev',
  extension: { issue: { id, key: `DEMO-${id}`, type: 'Task', typeId }, project: PROJECT }
});

const goodTemplate = {
  name: 'Team DoD',
  description: 'Our own Definition of Done',
  items: [
    { id: 'security-signoff', title: 'Security sign-off', isMandatory: true, category: 'SECURITY' },
    { id: 'docs', title: 'Docs updated', isMandatory: false, category: 'DOCUMENTATION' }
  ]
};

function respond(opts: { admin?: boolean; edit?: boolean; issueTypeId?: string; jiraAdmin?: boolean } = {}) {
  const { admin = true, edit = true, issueTypeId = '10004', jiraAdmin = false } = opts;
  jira.handler = (c: JiraCall) => {
    if (c.path.includes('/mypermissions')) {
      return { status: 200, body: { permissions: { ADMINISTER_PROJECTS: { havePermission: admin }, ADMINISTER: { havePermission: jiraAdmin }, EDIT_ISSUES: { havePermission: edit } } } };
    }
    if (c.path.startsWith('/rest/api/3/project/')) {
      return { status: 200, body: { id: '10000', key: 'DEMO', issueTypes: [{ id: '10004', name: 'Task' }, { id: '10005', name: 'Bug' }] } };
    }
    if (c.path.startsWith('/rest/api/3/issue/')) {
      return { status: 200, body: { id: c.path.split('/')[5].split('?')[0], fields: { issuetype: { id: issueTypeId, name: 'Task' }, project: { id: '10000', key: 'DEMO' } } } };
    }
    if (c.path.includes('/properties/')) return { status: 204 };
    return { status: 404 };
  };
}

describe('B-06 validateTemplate', () => {
  it('accepts a valid template', () => {
    expect(validateTemplate(goodTemplate)).toEqual([]);
  });

  it.each([
    [{ ...goodTemplate, items: [] }, 'A template needs 1 to 50 items.'],
    [{ ...goodTemplate, items: Array.from({ length: 51 }, (_, i) => ({ id: `i${i}`, title: 't', isMandatory: true, category: 'TESTING' })) }, 'A template needs 1 to 50 items.'],
    [{ ...goodTemplate, items: [{ ...goodTemplate.items[0], title: '' }] }, 'Item 1 needs a title.'],
    [{ ...goodTemplate, items: [goodTemplate.items[0], { ...goodTemplate.items[1], title: 'x'.repeat(201) }] }, 'Item 2 title is longer than 200 characters.'],
    [{ ...goodTemplate, items: [goodTemplate.items[0], { ...goodTemplate.items[1], id: 'security-signoff' }] }, 'Item 2 uses the id "security-signoff" twice.'],
    [{ ...goodTemplate, items: [{ ...goodTemplate.items[0], id: 'bad id!' }] }, 'Item 1 id may use only letters, digits, - and _ (1 to 64 characters).'],
    [{ ...goodTemplate, items: [{ ...goodTemplate.items[0], category: 'NOPE' }] }, 'Item 1 has an unknown category.'],
    [{ ...goodTemplate, items: [{ ...goodTemplate.items[0], isMandatory: 'yes' }] }, 'Item 1 must say whether it is mandatory.'],
    [{ ...goodTemplate, items: [{ ...goodTemplate.items[0], script: 'x' }] }, 'Item 1 has an unknown field "script".'],
    [{ ...goodTemplate, name: '' }, 'The template needs a name.'],
    [{ ...goodTemplate, description: 7 }, 'The template description must be text of 500 characters or less.'],
    [{ ...goodTemplate, waiverPermission: 'not a key' }, WAIVER_PERMISSION_INVALID],
    [{ ...goodTemplate, waiverPermission: 5 }, WAIVER_PERMISSION_INVALID],
    [{ ...goodTemplate, items: [null] }, 'Item 1 is missing.'],
    [{ ...goodTemplate, items: [{ ...goodTemplate.items[0], description: 'd'.repeat(501) }] }, 'Item 1 description must be text of 500 characters or less.'],
    [{ ...goodTemplate, items: [{ ...goodTemplate.items[0], evidenceRequired: 'yes' }] }, 'Item 1 evidenceRequired must be true or false.'],
    [{ ...goodTemplate, items: [{ ...goodTemplate.items[0], notAssignee: 1 }] }, 'Item 1 notAssignee must be true or false.'],
    [{ ...goodTemplate, items: [{ ...goodTemplate.items[0], requiredPermission: 'resolve issues' }] }, 'Item 1 required permission must be a Jira permission key.'],
    [{ ...goodTemplate, items: [{ ...goodTemplate.items[0], requiredPermission: 3 }] }, 'Item 1 required permission must be a Jira permission key.'],
    [null, 'The template is missing.']
  ])('rejects %#: %s', (tmpl, message) => {
    expect(validateTemplate(tmpl)).toContain(message);
  });

  it('rejects a template larger than 32 KiB', () => {
    const big = { ...goodTemplate, items: Array.from({ length: 50 }, (_, i) => ({ id: `i${i}`, title: 't'.repeat(200), description: 'd'.repeat(500), isMandatory: true, category: 'TESTING' })) };
    expect(validateTemplate(big)).toContain(`The template is larger than ${MAX_TEMPLATE_BYTES / 1024} KiB.`);
  });
});

describe('B-06 settings resolvers', () => {
  let storage: CountingStorage;

  beforeEach(() => {
    jira.reset();
    respond();
    storage = new CountingStorage();
  });

  it('refuses a non-admin, as the user, and writes nothing', async () => {
    respond({ admin: false });
    await expect(saveTemplate({ issueTypeId: '10004', template: goodTemplate }, settingsCtx('712020:dev'), storage)).rejects.toThrow('Only a project admin or a Jira admin can change DefinitionGuard templates.');
    await expect(getSettings({}, settingsCtx('712020:dev'), storage)).rejects.toThrow(PermissionDeniedError);
    expect(storage.sets).toEqual([]);
    expect(jira.callsTo('/mypermissions', 'user')[0].path).toContain('projectKey=DEMO');
    expect(jira.callsTo('/mypermissions', 'app')).toEqual([]);
  });

  it('lets a Jira admin who is not a project admin use the settings, as Jira does (found live on PAY)', async () => {
    respond({ admin: false, jiraAdmin: true });
    const res: any = await saveTemplate({ issueTypeId: '10004', template: goodTemplate }, settingsCtx('712020:site-admin'), storage);
    expect(res.template.version).toBe(1);
    expect(decodeURIComponent(jira.callsTo('/mypermissions', 'user')[0].path)).toContain('permissions=ADMINISTER_PROJECTS,ADMINISTER');
  });

  it('rejects an invalid template and names the field', async () => {
    await expect(saveTemplate({ issueTypeId: '10004', template: { ...goodTemplate, items: [{ ...goodTemplate.items[0], title: '' }] } }, settingsCtx(), storage))
      .rejects.toThrow('Item 1 needs a title.');
    expect(storage.sets).toEqual([]);
  });

  it('rejects an issue type that is not in the project', async () => {
    await expect(saveTemplate({ issueTypeId: '99999', template: goodTemplate }, settingsCtx(), storage)).rejects.toThrow('This issue type is not in the project.');
  });

  it('keys by project id and issue type id, and sets version, updatedBy and updatedAt on every save', async () => {
    const first: any = await saveTemplate({ issueTypeId: '10004', template: goodTemplate }, settingsCtx('712020:admin-1'), storage);
    const second: any = await saveTemplate({ issueTypeId: '10004', template: goodTemplate }, settingsCtx('712020:admin-2'), storage);
    const stored = storage.read(templateKey('10000', '10004'));
    expect(first.template.version).toBe(1);
    expect(second.template.version).toBe(2);
    expect(stored).toMatchObject({ workEffortTypeId: 'DOD_TEMPLATE', revisionNumber: 2, lastModifiedByPartyId: pseudonymOf(storage, '712020:admin-2'), projectId: '10000', issueTypeId: '10004' });
    expect(storedOutsideMap(storage, '712020:admin-2')).toEqual([]);
    expect(typeof stored.lastModifiedDate).toBe('string');
    expect(stored.workEffortId).toBe('project-10000-10004');
    expect(stored.criteria.map((c: any) => c.templateItemId)).toEqual(['security-signoff', 'docs']);
  });

  it('lists the project issue types and the saved templates', async () => {
    await saveTemplate({ issueTypeId: '10005', template: goodTemplate }, settingsCtx(), storage);
    const s: any = await getSettings({}, settingsCtx(), storage);
    expect(s.issueTypes).toEqual([{ id: '10004', name: 'Task' }, { id: '10005', name: 'Bug' }]);
    expect(s.templates['10005'].name).toBe('Team DoD');
    expect(s.templates['10004']).toBeUndefined();
  });

  it('keeps the optional item fields and the waiver permission on save, and drops empty ones', async () => {
    const rich = {
      ...goodTemplate,
      waiverPermission: 'RESOLVE_ISSUES',
      items: [
        { ...goodTemplate.items[0], description: 'Signed by security', evidenceRequired: true, notAssignee: true, requiredPermission: 'RESOLVE_ISSUES' },
        { ...goodTemplate.items[1], evidenceRequired: false }
      ]
    };
    const { description: _d, ...noDescription } = rich;
    const res: any = await saveTemplate({ issueTypeId: '10004', template: noDescription }, settingsCtx(), storage);
    expect(res.template.waiverPermission).toBe('RESOLVE_ISSUES');
    expect(res.template.description).toBe('');
    expect(res.template.items[0]).toEqual({ id: 'security-signoff', title: 'Security sign-off', isMandatory: true, category: 'SECURITY', description: 'Signed by security', evidenceRequired: true, notAssignee: true, requiredPermission: 'RESOLVE_ISSUES' });
    expect(res.template.items[1]).toEqual({ id: 'docs', title: 'Docs updated', isMandatory: false, category: 'DOCUMENTATION' });
  });

  it('DG-1: a save without waiverPermission keeps a non-default waiver permission', async () => {
    await saveTemplate({ issueTypeId: '10004', template: { ...goodTemplate, waiverPermission: 'RESOLVE_ISSUES' } }, settingsCtx(), storage);
    // An older page, or any caller, that leaves the field out.
    const res: any = await saveTemplate({ issueTypeId: '10004', template: { ...goodTemplate, name: 'Renamed DoD' } }, settingsCtx(), storage);
    expect(res.template.version).toBe(2);
    expect(res.template.waiverPermission).toBe('RESOLVE_ISSUES');
    expect(storage.read(templateKey('10000', '10004')).waiverRoleTypeId).toBe('JIRA_PERM_RESOLVE_ISSUES');
    const s: any = await getSettings({}, settingsCtx(), storage);
    expect(s.templates['10004'].waiverPermission).toBe('RESOLVE_ISSUES');
  });

  it('DG-1: the settings page payload keeps a non-default waiver permission when only the items change', async () => {
    await saveTemplate({ issueTypeId: '10004', template: { ...goodTemplate, waiverPermission: 'TRANSITION_ISSUES' } }, settingsCtx(), storage);
    const view = (await getSettings({}, settingsCtx(), storage) as any).templates['10004'];
    const editor = addItem(editorFromTemplate(view), 'Release notes');
    const res: any = await saveTemplate({ issueTypeId: '10004', template: toTemplatePayload(editor) }, settingsCtx(), storage);
    expect(res.template.items.map((i: any) => i.id)).toEqual(['security-signoff', 'docs', 'release-notes']);
    expect(res.template.waiverPermission).toBe('TRANSITION_ISSUES');
  });

  it('DG-1: changing the waiver permission saves it, and choosing the default again stores the default role', async () => {
    await saveTemplate({ issueTypeId: '10004', template: goodTemplate }, settingsCtx(), storage);
    expect(storage.read(templateKey('10000', '10004')).waiverRoleTypeId).toBe('PROJECT_ADMIN');
    let view = (await getSettings({}, settingsCtx(), storage) as any).templates['10004'];
    let res: any = await saveTemplate({ issueTypeId: '10004', template: toTemplatePayload(setWaiverPermission(editorFromTemplate(view), 'RESOLVE_ISSUES')) }, settingsCtx(), storage);
    expect(res.template.waiverPermission).toBe('RESOLVE_ISSUES');
    expect(storage.read(templateKey('10000', '10004')).waiverRoleTypeId).toBe('JIRA_PERM_RESOLVE_ISSUES');
    view = (await getSettings({}, settingsCtx(), storage) as any).templates['10004'];
    res = await saveTemplate({ issueTypeId: '10004', template: toTemplatePayload(setWaiverPermission(editorFromTemplate(view), 'ADMINISTER_PROJECTS')) }, settingsCtx(), storage);
    expect(res.template.waiverPermission).toBeUndefined();
    expect(storage.read(templateKey('10000', '10004')).waiverRoleTypeId).toBe('PROJECT_ADMIN');
  });

  it('DG-1a: the server accepts only the three offered waiver permissions and refuses any other key before a write', async () => {
    expect([...WAIVER_PERMISSIONS]).toEqual(WAIVER_PERMISSION_OPTIONS.map(o => o.value));
    for (const key of ['BROWSE_PROJECTS', 'EDIT_ISSUES', 'SCHEDULE_ISSUES', 'ADMINISTER', 'administer_projects', '']) {
      await expect(saveTemplate({ issueTypeId: '10004', template: { ...goodTemplate, waiverPermission: key } }, settingsCtx(), storage))
        .rejects.toThrow(WAIVER_PERMISSION_INVALID);
    }
    expect(storage.sets).toEqual([]);
    await expect(new TemplateStore(storage).save('10000', '10004', { ...goodTemplate, waiverPermission: 'BROWSE_PROJECTS' }, 'pseudo-1'))
      .rejects.toThrow(WAIVER_PERMISSION_INVALID);
    for (const key of WAIVER_PERMISSIONS) {
      const res: any = await saveTemplate({ issueTypeId: '10004', template: { ...goodTemplate, waiverPermission: key } }, settingsCtx(), storage);
      expect(res.template.version).toBeGreaterThan(0);
    }
  });

  it('DG-1: a new template without waiverPermission gets the default, Administer projects', async () => {
    const saved = await new TemplateStore(storage).save('10000', '10005', goodTemplate, 'pseudo-1');
    expect(saved.waiverRoleTypeId).toBe('PROJECT_ADMIN');
  });

  it('refuses without a project context', async () => {
    await expect(getSettings({}, { accountId: 'a', extension: {} }, storage)).rejects.toThrow('Missing project context');
  });

  it('reports a failed project read with a next step, and treats a missing issue type list as empty', async () => {
    jira.handler = (c: JiraCall) => (c.path.includes('/mypermissions')
      ? { status: 200, body: { permissions: { ADMINISTER_PROJECTS: { havePermission: true } } } }
      : { status: 500 });
    await expect(getSettings({}, settingsCtx(), storage)).rejects.toThrow('could not read the project issue types. Refresh the page.');
    jira.handler = (c: JiraCall) => (c.path.includes('/mypermissions')
      ? { status: 200, body: { permissions: { ADMINISTER_PROJECTS: { havePermission: true } } } }
      : { status: 200, body: {} });
    expect((await getSettings({}, settingsCtx(), storage) as any).issueTypes).toEqual([]);
    await expect(saveTemplate({ template: goodTemplate }, settingsCtx(), storage)).rejects.toThrow('This issue type is not in the project.');
  });

  it('getProjectPermissions refuses an empty project key', async () => {
    await expect(getProjectPermissions('', ['ADMINISTER_PROJECTS'])).rejects.toThrow(PermissionDeniedError);
  });

  it('dispatches through the settings handler', async () => {
    setGlobalStorageProvider(storage);
    const s: any = await settingsHandler({ call: { functionKey: 'getSettings', payload: {} }, context: settingsCtx() } as any);
    expect(s.issueTypes).toHaveLength(2);
    const saved: any = await settingsHandler({ call: { functionKey: 'saveTemplate', payload: { issueTypeId: '10004', template: goodTemplate } }, context: settingsCtx() } as any);
    expect(saved.template.version).toBe(1);
  });
});

describe('B-06 the project template is applied on every path', () => {
  let storage: CountingStorage;

  beforeEach(async () => {
    jira.reset();
    respond();
    storage = new CountingStorage();
    await new TemplateStore(storage).save('10000', '10004', goodTemplate as any, '712020:admin');
  });

  it('panel load', async () => {
    const res = await getIssueChecklist({}, issueCtx(), storage);
    expect(res.items.map(i => i.id)).toEqual(['security-signoff', 'docs']);
    expect(res.templateId).toBe('project-10000-10004');
  });

  it('first toggle', async () => {
    const res = await toggleChecklistItem({ itemId: 'security-signoff', isCompleted: true }, issueCtx(), storage);
    expect(res.items.find(i => i.id === 'security-signoff')!.isCompleted).toBe(true);
  });

  it('reset of a new issue', async () => {
    const res = await resetChecklist({}, issueCtx('80002'), storage);
    expect(res.items.map(i => i.id)).toEqual(['security-signoff', 'docs']);
  });

  it('(V-a, V-b) validator: blocks a missing record on the custom template and names its items', async () => {
    const res = await validateTransition({ issue: { key: 'DEMO-80003' } }, {}, storage);
    expect(res.result).toBe(false);
    expect(res.errorMessage).toContain('Security sign-off');
    expect(res.errorMessage).not.toContain('Docs updated');
    expect(storage.sets.filter(k => !k.startsWith('dg:tmpl:'))).toEqual([]);
  });

  it('falls back to the built-in template for an issue type with no project template', async () => {
    respond({ issueTypeId: '10005' });
    const res = await getIssueChecklist({}, { ...issueCtx('80004', '10005'), extension: { ...issueCtx('80004', '10005').extension, issue: { id: '80004', key: 'DEMO-80004', type: 'Bug', typeId: '10005' } } }, storage);
    expect(res.templateId).toBe('template-bug-dod');
  });

  it('zero mandatory items: the panel and the validator both say satisfied', async () => {
    await new TemplateStore(storage).save('10000', '10004', { ...goodTemplate, items: [goodTemplate.items[1]] } as any, '712020:admin');
    const panel = await getIssueChecklist({}, issueCtx('80005'), storage);
    expect(panel.isFullySatisfied).toBe(true);
    expect(await validateTransition({ issue: { key: 'DEMO-80005' } }, {}, storage)).toEqual({ result: true });
  });
});
