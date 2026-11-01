/**
 * B-12: required permission, "not the assignee", waiver with a reason.
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

import { toggleChecklistItem, waiveChecklistItem, validateTransition, getChecklistHistory } from '../../src/index';
import { permissionLabel } from '../../src/security/permissions';
import { TemplateStore } from '../../src/settings/template-store';
import { eventKey } from '../../src/storage/checklist-store';

const project = { id: '10000', key: 'DEMO' };
const issue = { id: '94001', key: 'DEMO-94001', type: 'Task', typeId: '10004' };
const as = (accountId: string) => ({ accountId, extension: { issue, project } });
const template = {
  name: 'SoD DoD',
  waiverPermission: 'ADMINISTER_PROJECTS',
  items: [
    { id: 'peer-review', title: 'Peer review approved', isMandatory: true, category: 'CODE_QUALITY', notAssignee: true },
    { id: 'release-signoff', title: 'Release sign-off', isMandatory: true, category: 'COMPLIANCE', requiredPermission: 'RESOLVE_ISSUES' },
    { id: 'docs', title: 'Docs updated', isMandatory: true, category: 'DOCUMENTATION' }
  ]
};

let granted: Record<string, Record<string, boolean>>;
let assignee: string | null;

function respond() {
  jira.handler = (c: JiraCall) => {
    if (c.path.includes('/mypermissions')) {
      const keys = decodeURIComponent(c.path.split('permissions=')[1]).split(',');
      const who = (global as any).__caller as string;
      const out: any = {};
      for (const k of keys) out[k] = { havePermission: Boolean(granted[who]?.[k]) };
      return { status: 200, body: { permissions: out } };
    }
    if (c.path.startsWith('/rest/api/3/status/')) return { status: 200, body: { statusCategory: { key: 'done' } } };
    if (/^\/rest\/api\/3\/issue\/(94001|DEMO-94001)\?/.test(c.path)) {
      return { status: 200, body: { id: '94001', fields: { assignee: assignee ? { accountId: assignee } : null, issuetype: { id: '10004' }, project } } };
    }
    return { status: 204 };
  };
}

async function call<T>(who: string, fn: () => Promise<T>): Promise<T> {
  (global as any).__caller = who;
  return fn();
}

describe('B-12 roles and waivers', () => {
  let storage: CountingStorage;

  beforeEach(async () => {
    jira.reset();
    granted = {
      dev: { EDIT_ISSUES: true },
      reviewer: { EDIT_ISSUES: true },
      lead: { EDIT_ISSUES: true, RESOLVE_ISSUES: true },
      admin: { EDIT_ISSUES: true, ADMINISTER_PROJECTS: true }
    };
    assignee = 'dev';
    respond();
    storage = new CountingStorage();
    await new TemplateStore(storage).save('10000', '10004', template, 'admin');
  });

  it('names a permission in plain words', () => {
    expect(permissionLabel('RESOLVE_ISSUES')).toBe('Resolve issues');
    expect(permissionLabel('ADMINISTER_PROJECTS')).toBe('Administer projects');
  });

  it('requires the item permission, checked as the user in one call with EDIT_ISSUES', async () => {
    await expect(call('dev', () => toggleChecklistItem({ itemId: 'release-signoff', isCompleted: true }, as('dev'), storage)))
      .rejects.toThrow('You need the Resolve issues Jira permission to complete this item.');
    jira.calls = [];
    const res = await call('lead', () => toggleChecklistItem({ itemId: 'release-signoff', isCompleted: true }, as('lead'), storage));
    expect(res.items.find(i => i.id === 'release-signoff')!.isCompleted).toBe(true);
    const perm = jira.callsTo('/mypermissions', 'user');
    expect(perm).toHaveLength(1);
    expect(decodeURIComponent(perm[0].path)).toContain('permissions=EDIT_ISSUES,RESOLVE_ISSUES');
  });

  it('refuses a tick by the current assignee on a not-the-assignee item, read as the user', async () => {
    await expect(call('dev', () => toggleChecklistItem({ itemId: 'peer-review', isCompleted: true }, as('dev'), storage)))
      .rejects.toThrow('The assignee cannot complete this item. Ask a reviewer.');
    expect(jira.callsTo('/rest/api/3/issue/DEMO-94001?fields=assignee', 'user')).toHaveLength(1);
    const res = await call('reviewer', () => toggleChecklistItem({ itemId: 'peer-review', isCompleted: true }, as('reviewer'), storage));
    expect(res.items.find(i => i.id === 'peer-review')!.isCompleted).toBe(true);
  });

  it('fails closed when the assignee cannot be read', async () => {
    jira.handler = (c: JiraCall) => (c.path.includes('/mypermissions') ? { status: 200, body: { permissions: { EDIT_ISSUES: { havePermission: true } } } } : { status: 500 });
    await expect(call('reviewer', () => toggleChecklistItem({ itemId: 'peer-review', isCompleted: true }, as('reviewer'), storage)))
      .rejects.toThrow('could not read the assignee');
  });

  it('waives with a reason, for the waiver permission only, and records the reason', async () => {
    await expect(call('dev', () => waiveChecklistItem({ itemId: 'docs', reason: 'No user-facing change in this fix.' }, as('dev'), storage)))
      .rejects.toThrow('Only users with the Administer projects Jira permission can waive this item.');
    await expect(call('admin', () => waiveChecklistItem({ itemId: 'docs', reason: 'too short' }, as('admin'), storage)))
      .rejects.toThrow('Give a reason of 10 to 500 characters for the waiver.');
    await expect(call('admin', () => waiveChecklistItem({ itemId: 'docs', reason: 'x'.repeat(501) }, as('admin'), storage)))
      .rejects.toThrow('Give a reason of 10 to 500 characters for the waiver.');
    await expect(call('admin', () => waiveChecklistItem({ itemId: 'nope', reason: 'No user-facing change.' }, as('admin'), storage)))
      .rejects.toThrow("Checklist item with id 'nope' not found");
    const res = await call('admin', () => waiveChecklistItem({ itemId: 'docs', reason: '  No user-facing change in this fix.  ' }, as('admin'), storage));
    expect(res.items.find(i => i.id === 'docs')).toMatchObject({ isCompleted: true, waived: true });
    const evt = storage.read(eventKey('94001', 2));
    expect(evt).toMatchObject({ transitionName: 'Waive', actorPartyId: 'admin' });
    expect(evt.rows[0]).toMatchObject({ entity: 'WorkEffortStatus', workEffortId: 'crit:94001:docs', statusId: 'DOD_WAIVED', reason: 'No user-facing change in this fix.', setByPartyId: 'admin' });
    const h: any = await getChecklistHistory({}, as('admin'), storage);
    expect(h.auditTrail[1]).toMatchObject({ eventType: 'WAIVE', details: 'No user-facing change in this fix.' });
  });

  it('needs the waiver permission to reopen a waived item', async () => {
    await call('admin', () => waiveChecklistItem({ itemId: 'docs', reason: 'No user-facing change in this fix.' }, as('admin'), storage));
    await expect(call('dev', () => toggleChecklistItem({ itemId: 'docs', isCompleted: false }, as('dev'), storage)))
      .rejects.toThrow('Only users with the Administer projects Jira permission can reopen a waived item.');
    const res = await call('admin', () => toggleChecklistItem({ itemId: 'docs', isCompleted: false }, as('admin'), storage));
    expect(res.items.find(i => i.id === 'docs')!.isCompleted).toBe(false);
  });

  describe('validator', () => {
    const move = { issue: { id: '94001', key: 'DEMO-94001' }, transition: { to: { id: '10001' } } };

    async function completeAllAs(peerReviewer: string) {
      await call(peerReviewer, () => toggleChecklistItem({ itemId: 'peer-review', isCompleted: true }, as(peerReviewer), storage));
      await call('lead', () => toggleChecklistItem({ itemId: 'release-signoff', isCompleted: true }, as('lead'), storage));
      await call('admin', () => waiveChecklistItem({ itemId: 'docs', reason: 'No user-facing change in this fix.' }, as('admin'), storage));
    }

    it('counts a waived item as done and passes a complete checklist', async () => {
      await completeAllAs('reviewer');
      expect(await validateTransition(move, {}, storage)).toEqual({ result: true });
    });

    it('(V-a, V-b) re-checks not-the-assignee against the current assignee from the Jira issue', async () => {
      await completeAllAs('reviewer');
      assignee = 'reviewer';  // the reviewer became the assignee after the tick
      const res = await validateTransition(move, {}, storage);
      expect(res.result).toBe(false);
      expect(res.errorMessage).toContain('Peer review approved');
      expect(jira.callsTo('/properties/', 'app').filter(c => c.method === 'GET')).toEqual([]);
      expect(jira.callsTo('/rest/api/3/issue/94001', 'app').length).toBeGreaterThanOrEqual(1);
    });

    it('a refused tick is never written, so it never counts', async () => {
      await expect(call('dev', () => toggleChecklistItem({ itemId: 'peer-review', isCompleted: true }, as('dev'), storage))).rejects.toThrow();
      const res = await validateTransition(move, {}, storage);
      expect(res.result).toBe(false);
      expect(res.errorMessage).toContain('Peer review approved');
    });

    it('blocks when the assignee lookup fails while a not-the-assignee item is done', async () => {
      await completeAllAs('reviewer');
      jira.handler = () => ({ status: 500 });
      expect((await validateTransition(move, {}, storage)).result).toBe(false);
    });
  });
});
