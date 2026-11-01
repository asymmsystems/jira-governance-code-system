/**
 * B-16: template versions and admin re-sync.
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

import { resyncEntry, applyEntry, makeEntry } from '../../src/domain/event-log';
import { toDodTemplate } from '../../src/domain/dod-template';
import { resyncIssues, saveTemplate, settingsHandler } from '../../src/settings/settings-resolvers';
import { toggleChecklistItem, getIssueChecklist, validateTransition, setGlobalStorageProvider } from '../../src/index';
import { stateKey, eventKey } from '../../src/storage/checklist-store';
import { retryPolicy } from '../../src/integrity/attestation';
import { created, tick, append, criterion } from '../helpers/dod';

const project = { id: '10000', key: 'DEMO' };
const settingsCtx = { accountId: '712020:admin', extension: { project } };
const issueCtx = (id: string) => ({ accountId: '712020:dev', extension: { issue: { id, key: `DEMO-${id}`, type: 'Task', typeId: '10004' }, project } });

const v1 = { name: 'Team DoD', items: [
  { id: 'review', title: 'Peer review', isMandatory: true, category: 'CODE_QUALITY' },
  { id: 'docs', title: 'Docs', isMandatory: false, category: 'DOCUMENTATION' }
] };
const v2 = { name: 'Team DoD', items: [
  { id: 'review', title: 'Peer review approved', isMandatory: true, category: 'CODE_QUALITY' },
  { id: 'security', title: 'Security scan', isMandatory: true, category: 'SECURITY' }
] };

describe('B-16 resyncEntry', () => {
  it('keeps the status of unchanged ids, adds new criteria open, and ends removed ones with thruDate', () => {
    const { state } = created('1', { id: 'project-10000-10004', name: 'n', description: '', version: 1, items: v1.items as any });
    const ticked = append(state, [...tick('review', 'dev')(state)]).state;
    const docsDone = append(ticked, [...tick('docs', 'dev')(ticked)]).state;
    const input = resyncEntry(docsDone, toDodTemplate({ id: 'project-10000-10004', name: 'n', description: '', version: 2, items: v2.items as any }), 'admin', 'T2');
    const ended = input.rows.filter(r => r.entity === 'WorkEffortAssoc' && r.thruDate);
    expect(ended).toEqual([{ entity: 'WorkEffortAssoc', workEffortIdFrom: 'issue:1', workEffortIdTo: 'crit:1:docs', workEffortAssocTypeId: 'WORK_EFF_BREAKDOWN', sequenceNum: 2, fromDate: '2026-11-01T00:00:00.000Z', thruDate: 'T2' }]);
    const after = applyEntry(docsDone, makeEntry(docsDone, input));
    expect(after.template.revisionNumber).toBe(2);
    expect(after.criteria.map(c => c.templateItemId)).toEqual(['review', 'security']);
    expect(criterion(after, 'review')).toMatchObject({ currentStatusId: 'DOD_DONE', workEffortName: 'Peer review approved', lastStatusByPartyId: 'dev' });
    expect(criterion(after, 'security').currentStatusId).toBe('DOD_OPEN');
  });
});

describe('B-16 resyncIssues', () => {
  let storage: CountingStorage;
  let searchPages: Array<{ issues: any[]; nextPageToken?: string }>;
  let admin = true;

  beforeEach(() => {
    jira.reset();
    admin = true;
    retryPolicy.sleep = async () => {};
    storage = new CountingStorage();
    setGlobalStorageProvider(storage);
    searchPages = [];
    jira.handler = (c: JiraCall) => {
      if (c.path.includes('/mypermissions')) return { status: 200, body: { permissions: { ADMINISTER_PROJECTS: { havePermission: admin }, EDIT_ISSUES: { havePermission: true } } } };
      if (c.path.startsWith('/rest/api/3/search/jql')) return { status: 200, body: searchPages.shift() || { issues: [] } };
      if (c.path.startsWith('/rest/api/3/project/')) return { status: 200, body: { issueTypes: [{ id: '10004', name: 'Task' }] } };
      if (c.path.startsWith('/rest/api/3/status/')) return { status: 200, body: { statusCategory: { key: 'done' } } };
      return { status: 204 };
    };
  });

  async function setup() {
    await saveTemplate({ issueTypeId: '10004', template: v1 }, settingsCtx, storage);
    for (const id of ['501', '502']) await toggleChecklistItem({ itemId: 'review', isCompleted: true }, issueCtx(id), storage);
    await saveTemplate({ issueTypeId: '10004', template: v2 }, settingsCtx, storage);
  }

  it('leaves open issues on their version until an admin re-syncs', async () => {
    await setup();
    const panel = await getIssueChecklist({}, issueCtx('501'), storage);
    expect(panel.items.map(i => i.id)).toEqual(['review', 'docs']);
    expect(storage.read(stateKey('501')).template.revisionNumber).toBe(1);
  });

  it('re-syncs the open issues of the issue type, keeping ticks on unchanged ids, with one Resync entry each', async () => {
    await setup();
    searchPages = [{ issues: [{ id: '501', key: 'DEMO-501' }, { id: '502', key: 'DEMO-502' }, { id: '503', key: 'DEMO-503' }] }];
    const res = await resyncIssues({ issueTypeId: '10004' }, settingsCtx, storage);
    expect(res).toEqual({ updated: 2, skipped: 1, nextCursor: undefined, templateVersion: 2 });
    for (const id of ['501', '502']) {
      const st = storage.read(stateKey(id));
      expect(st.template.revisionNumber).toBe(2);
      expect(st.criteria.map((c: any) => c.templateItemId)).toEqual(['review', 'security']);
      expect(st.criteria[0].currentStatusId).toBe('DOD_DONE');
      expect(storage.read(eventKey(id, 3)).transitionName).toBe('Resync');
    }
    const search = jira.callsTo('/rest/api/3/search/jql', 'app')[0];
    expect(decodeURIComponent(search.path)).toContain('project = 10000 AND issuetype = 10004 AND statusCategory != Done');
    expect(decodeURIComponent(search.path)).toContain('maxResults=25');
  });

  it('skips issues already on the current version, so a second run changes nothing', async () => {
    await setup();
    searchPages = [{ issues: [{ id: '501', key: 'DEMO-501' }] }, { issues: [{ id: '501', key: 'DEMO-501' }] }];
    await resyncIssues({ issueTypeId: '10004' }, settingsCtx, storage);
    expect(await resyncIssues({ issueTypeId: '10004' }, settingsCtx, storage)).toMatchObject({ updated: 0, skipped: 1 });
    expect(storage.store.has(eventKey('501', 4))).toBe(false);
  });

  it('pages with nextPageToken and returns it as the cursor', async () => {
    await setup();
    searchPages = [{ issues: [{ id: '501', key: 'DEMO-501' }], nextPageToken: 'tok-2' }];
    expect((await resyncIssues({ issueTypeId: '10004' }, settingsCtx, storage)).nextCursor).toBe('tok-2');
    searchPages = [{ issues: [{ id: '502', key: 'DEMO-502' }] }];
    await resyncIssues({ issueTypeId: '10004', cursor: 'tok-2' }, settingsCtx, storage);
    expect(decodeURIComponent(jira.callsTo('/rest/api/3/search/jql')[1].path)).toContain('nextPageToken=tok-2');
  });

  it('does not touch an issue that uses another template', async () => {
    await setup();
    await toggleChecklistItem({ itemId: 'item-unit-tests', isCompleted: true }, { ...issueCtx('504'), extension: { ...issueCtx('504').extension, issue: { id: '504', key: 'DEMO-504', type: 'Task', typeId: '99999' } } }, storage);
    searchPages = [{ issues: [{ id: '504', key: 'DEMO-504' }] }];
    expect(await resyncIssues({ issueTypeId: '10004' }, settingsCtx, storage)).toMatchObject({ updated: 0, skipped: 1 });
  });

  it('refuses a non-admin, an issue type with no template, and a failed search', async () => {
    await setup();
    admin = false;
    await expect(resyncIssues({ issueTypeId: '10004' }, settingsCtx, storage)).rejects.toThrow('Only a project admin');
    admin = true;
    await expect(resyncIssues({ issueTypeId: '77777' }, settingsCtx, storage)).rejects.toThrow('This issue type has no project template to re-sync to.');
    jira.handler = (c: JiraCall) => (c.path.includes('/mypermissions') ? { status: 200, body: { permissions: { ADMINISTER_PROJECTS: { havePermission: true } } } } : { status: 500 });
    await expect(resyncIssues({ issueTypeId: '10004' }, settingsCtx, storage)).rejects.toThrow('could not search the open issues. Try again.');
  });

  it('(V-a, V-b) the validator blocks a re-synced issue on the new open mandatory item and names it', async () => {
    await setup();
    searchPages = [{ issues: [{ id: '501', key: 'DEMO-501' }] }];
    await resyncIssues({ issueTypeId: '10004' }, settingsCtx, storage);
    const res = await validateTransition({ issue: { id: '501' }, transition: { to: { id: '10001' } } }, {}, storage);
    expect(res.result).toBe(false);
    expect(res.errorMessage).toContain('Security scan');
    expect(res.errorMessage).not.toContain('Peer review approved');
  });

  it('dispatches resyncIssues through the settings handler', async () => {
    await setup();
    searchPages = [{ issues: [] }];
    const res: any = await settingsHandler({ call: { functionKey: 'resyncIssues', payload: { issueTypeId: '10004' } }, context: settingsCtx } as any);
    expect(res).toMatchObject({ updated: 0, skipped: 0 });
  });
});
