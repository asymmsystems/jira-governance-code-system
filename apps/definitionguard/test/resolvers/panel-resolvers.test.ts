/**
 * Issue panel resolvers on the v2 event log (B-03), and the Forge KVS provider.
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

const kvsMock = {
  get: jest.fn(),
  set: jest.fn(),
  delete: jest.fn(),
  query: jest.fn()
};
jest.mock('@forge/kvs', () => ({
  kvs: kvsMock,
  WhereConditions: { beginsWith: (v: string) => ({ condition: 'BEGINS_WITH', values: [v] }) }
}));

import {
  getIssueChecklist,
  toggleChecklistItem,
  resetChecklist,
  validateTransition,
  handler,
  setGlobalStorageProvider,
  resolveStorage,
  fetchLiveJiraIssue
} from '../../src/index';
import { eventKey, stateKey, legacyKey } from '../../src/storage/checklist-store';
import { ChecklistEngine, DEFAULT_DEFINITION_OF_DONE, BUG_DEFINITION_OF_DONE, STORY_DEFINITION_OF_DONE } from '../../src/domain/checklist-engine';

const T = '2026-11-01T00:00:00.000Z';
const ctx = (id = '40001', type = 'Task', accountId = '712020:alice') => ({
  accountId,
  extension: { issue: { id, key: `DEMO-${id}`, type }, project: { id: '10000', key: 'DEMO' } }
});

function allow(extra?: (c: JiraCall) => any) {
  jira.handler = (c: JiraCall) => {
    const e = extra && extra(c);
    if (e) return e;
    if (c.path.includes('/mypermissions')) {
      return { status: 200, body: { permissions: { EDIT_ISSUES: { havePermission: true }, ADMINISTER_PROJECTS: { havePermission: true } } } };
    }
    if (c.path.includes('/properties/')) return { status: 204 };
    return { status: 200, body: { id: '40001', fields: { issuetype: { name: 'Task' } } } };
  };
}

describe('panel resolvers (v3 change log)', () => {
  let storage: CountingStorage;

  beforeEach(() => {
    jira.reset();
    allow();
    storage = new CountingStorage();
    setGlobalStorageProvider(storage);
  });

  describe('getChecklist', () => {
    it('applies the issue-type template in memory and writes nothing', async () => {
      const res = await getIssueChecklist({}, ctx('40001', 'Bug'), storage);
      expect(res.templateId).toBe(BUG_DEFINITION_OF_DONE.id);
      expect(res.items).toHaveLength(BUG_DEFINITION_OF_DONE.items.length);
      expect(res.stateVersion).toBe(0);
      expect(storage.sets).toEqual([]);
      expect(jira.callsTo('/properties/')).toEqual([]);
    });

    it('looks up the issue type in Jira when the context has none', async () => {
      allow(c => (c.path.includes('/issue/40002') ? { status: 200, body: { fields: { issuetype: { name: 'Story' } } } } : undefined));
      const res = await getIssueChecklist({}, { extension: { issue: { id: '40002', key: 'DEMO-2' } } }, storage);
      expect(res.templateId).toBe(STORY_DEFINITION_OF_DONE.id);
    });

    it('ignores an issue id in the payload', async () => {
      await expect(getIssueChecklist({ issueId: 'payload-id' }, {}, storage)).rejects.toThrow('Missing issue context');
    });

    it('returns the stored state after changes, and the history from getHistory', async () => {
      await toggleChecklistItem({ itemId: 'item-unit-tests', isCompleted: true }, ctx(), storage);
      const res = await getIssueChecklist({}, ctx(), storage);
      expect(res.stateVersion).toBe(2);
      expect(res.items.find(i => i.id === 'item-unit-tests')).toMatchObject({ isCompleted: true, completedByAccountId: '712020:alice' });
      expect(res.auditTrail).toEqual([]);
      const history: any = await handler({ call: { functionKey: 'getHistory', payload: {} }, context: ctx() } as any);
      expect(history.auditTrail.map((e: any) => e.eventType)).toEqual(['TEMPLATE_CONFIGURED', 'CHECK']);
      expect(history.eventCount).toBe(2);
    });

    it('returns an empty history for an issue with no record', async () => {
      const history: any = await handler({ call: { functionKey: 'getHistory', payload: { cursor: 7 } }, context: ctx('49999') } as any);
      expect(history).toMatchObject({ events: [], auditTrail: [], eventCount: 0, chain: { ok: true, checked: 0 } });
    });
  });

  describe('toggleItem', () => {
    it('writes a Create entry, a Complete entry and the state on the first change', async () => {
      const res = await toggleChecklistItem({ itemId: 'item-unit-tests', isCompleted: true }, ctx(), storage);
      expect(storage.read(eventKey('40001', 1)).transitionName).toBe('Create');
      expect(storage.read(eventKey('40001', 2))).toMatchObject({ transitionName: 'Complete', actorPartyId: pseudonymOf(storage, '712020:alice') });
      expect(storage.read(eventKey('40001', 2)).rows[0]).toMatchObject({ entity: 'WorkEffortStatus', workEffortId: 'crit:40001:item-unit-tests', statusId: 'DOD_DONE' });
      expect(storage.read(stateKey('40001')).seq).toBe(2);
      expect(res.checklistHash).toBe(storage.read(eventKey('40001', 2)).hash);
    });

    it('records an untick as a Reopen entry and clears the item', async () => {
      await toggleChecklistItem({ itemId: 'item-unit-tests', isCompleted: true }, ctx(), storage);
      const res = await toggleChecklistItem({ itemId: 'item-unit-tests', isCompleted: false }, ctx(), storage);
      expect(storage.read(eventKey('40001', 3)).transitionName).toBe('Reopen');
      expect(res.items.find(i => i.id === 'item-unit-tests')!.isCompleted).toBe(false);
    });

    it('(ADR-010) stores a pseudonym, never the account id or a display name, and makes no user lookup', async () => {
      const res = await toggleChecklistItem({ itemId: 'item-unit-tests', isCompleted: true }, ctx(), storage);
      const p = pseudonymOf(storage, '712020:alice');
      expect(p).toMatch(/^dgp-[0-9a-f]{32}$/);
      expect(storage.read(stateKey('40001')).criteria[0].lastStatusByPartyId).toBe(p);
      expect(storage.read(`dg:pid:${p}`)).toEqual({ accountId: '712020:alice' });
      expect(storedOutsideMap(storage, '712020:alice')).toEqual([]);
      // The panel still gets the account id, for the User component.
      expect(res.items.find(i => i.id === 'item-unit-tests')!.completedByAccountId).toBe('712020:alice');
      expect(res.lastModifiedBy).toBe('712020:alice');
      expect(jira.callsTo('/rest/api/3/user')).toEqual([]);
    });

    it('(ADR-010) reuses the same pseudonym for the same person', async () => {
      await toggleChecklistItem({ itemId: 'item-unit-tests', isCompleted: true }, ctx(), storage);
      await toggleChecklistItem({ itemId: 'item-unit-tests', isCompleted: false }, ctx(), storage);
      expect(storage.read(eventKey('40001', 3)).actorPartyId).toBe(storage.read(eventKey('40001', 2)).actorPartyId);
    });

    it('refuses a change that StatusValidChange does not allow, before any Jira call or write (B-21)', async () => {
      await toggleChecklistItem({ itemId: 'item-unit-tests', isCompleted: true }, ctx(), storage);
      storage.sets = [];
      jira.calls = [];
      await expect(toggleChecklistItem({ itemId: 'item-unit-tests', isCompleted: true }, ctx(), storage)).rejects.toThrow('This item is already done.');
      await expect(toggleChecklistItem({ itemId: 'item-peer-review', isCompleted: false }, ctx(), storage)).rejects.toThrow('This item is already open.');
      expect(storage.sets).toEqual([]);
      expect(jira.calls).toEqual([]);
    });

    it('rejects an unknown item and writes nothing', async () => {
      await expect(toggleChecklistItem({ itemId: 'no-such-item', isCompleted: true }, ctx(), storage)).rejects.toThrow("Checklist item with id 'no-such-item' not found");
      expect(storage.sets).toEqual([]);
    });

    it('rejects a missing itemId', async () => {
      await expect(toggleChecklistItem({}, ctx(), storage)).rejects.toThrow('Missing itemId');
    });

    it('publishes the schema v3 property with the counts and the head hash', async () => {
      const res = await toggleChecklistItem({ itemId: 'item-unit-tests', isCompleted: true }, ctx(), storage);
      const put = jira.callsTo('/properties/definitionguard-dod', 'app')[0];
      expect(put.method).toBe('PUT');
      expect(put.body).toMatchObject({
        schemaVersion: 3,
        issueId: '40001',
        mandatoryTotal: DEFAULT_DEFINITION_OF_DONE.items.filter(i => i.isMandatory).length,
        mandatoryCompleted: 1,
        headHash: res.checklistHash,
        isFullySatisfied: false
      });
    });

    it('still returns the new state when the property write throws', async () => {
      allow(c => (c.path.includes('/properties/') ? { status: 0, throws: 'down' } : undefined));
      const res = await toggleChecklistItem({ itemId: 'item-unit-tests', isCompleted: true }, ctx(), storage);
      expect(res.stateVersion).toBe(2);
    });

    it('migrates a v1 record on the first change and keeps the v1 key', async () => {
      let legacy = ChecklistEngine.initializeState('40003', 'DEMO-40003', DEFAULT_DEFINITION_OF_DONE, 'system', T);
      legacy = ChecklistEngine.toggleItem(legacy, { issueId: '40003', issueKey: 'DEMO-40003', itemId: 'item-unit-tests', isCompleted: true, userId: 'Alice', userAccountId: '712020:alice' }, T);
      storage.put(legacyKey('40003'), legacy);
      const before = storage.store.get(legacyKey('40003'));
      const res = await toggleChecklistItem({ itemId: 'item-peer-review', isCompleted: true }, ctx('40003'), storage);
      expect(storage.read(eventKey('40003', 1)).transitionName).toBe('Migrate');
      expect(res.items.filter(i => i.isCompleted).map(i => i.id).sort()).toEqual(['item-peer-review', 'item-unit-tests']);
      expect(storage.store.get(legacyKey('40003'))).toBe(before);
    });
  });

  describe('resetChecklist', () => {
    it('records a Reset entry and opens every item', async () => {
      await toggleChecklistItem({ itemId: 'item-unit-tests', isCompleted: true }, ctx(), storage);
      const res = await resetChecklist({}, ctx(), storage);
      expect(storage.read(eventKey('40001', 3)).transitionName).toBe('Reset');
      expect(res.items.every(i => !i.isCompleted)).toBe(true);
      expect(res.stateVersion).toBe(3);
    });

    it('creates the record and records RESET on an issue with no record', async () => {
      const res = await resetChecklist({}, ctx('40004', 'Bug'), storage);
      expect(res.templateId).toBe(BUG_DEFINITION_OF_DONE.id);
      expect(storage.read(eventKey('40004', 2)).transitionName).toBe('Reset');
    });
  });

  describe('validator on v2 and migrated records', () => {
    it('(V-a, V-b) blocks an incomplete v2 record and names every open mandatory item', async () => {
      await toggleChecklistItem({ itemId: 'item-unit-tests', isCompleted: true }, ctx(), storage);
      const res = await validateTransition({ issue: { id: '40001', key: 'DEMO-40001' } }, {}, storage);
      expect(res.result).toBe(false);
      for (const i of DEFAULT_DEFINITION_OF_DONE.items.filter(x => x.isMandatory && x.id !== 'item-unit-tests')) {
        expect(res.errorMessage).toContain(i.title);
      }
      expect(res.errorMessage).not.toContain(DEFAULT_DEFINITION_OF_DONE.items[0].title + ';');
    });

    it('allows a complete v2 record', async () => {
      for (const i of DEFAULT_DEFINITION_OF_DONE.items.filter(x => x.isMandatory)) {
        await toggleChecklistItem({ itemId: i.id, isCompleted: true }, ctx(), storage);
      }
      expect(await validateTransition({ issue: { id: '40001' } }, {}, storage)).toEqual({ result: true });
    });

    it('(V-a, V-b) blocks a migrated record and names its open items', async () => {
      const legacy = ChecklistEngine.initializeState('40005', 'DEMO-40005', DEFAULT_DEFINITION_OF_DONE, 'system', T);
      storage.put(legacyKey('40005'), legacy);
      await toggleChecklistItem({ itemId: 'item-unit-tests', isCompleted: true }, ctx('40005'), storage);
      const res = await validateTransition({ issue: { id: '40005' } }, {}, storage);
      expect(res.result).toBe(false);
      expect(res.errorMessage).toContain('Peer code review approved by authorized reviewers');
    });
  });

  describe('helpers and dispatch', () => {
    it('fetchLiveJiraIssue returns the issue, or null on a non-200 or a throw', async () => {
      expect((await fetchLiveJiraIssue('DEMO-1')).fields.issuetype.name).toBe('Task');
      allow(() => ({ status: 404 }));
      expect(await fetchLiveJiraIssue('DEMO-404')).toBeNull();
      allow(() => ({ status: 0, throws: 'down' }));
      expect(await fetchLiveJiraIssue('DEMO-ERR')).toBeNull();
    });

    it('dispatches getChecklist, toggleItem, resetChecklist and getAvailableTemplates', async () => {
      const got: any = await handler({ call: { functionKey: 'getChecklist', payload: {} }, context: ctx('40006') } as any);
      expect(got.issueId).toBe('40006');
      const toggled: any = await handler({ call: { functionKey: 'toggleItem', payload: { itemId: 'item-unit-tests', isCompleted: true } }, context: ctx('40006') } as any);
      expect(toggled.stateVersion).toBe(2);
      const reset: any = await handler({ call: { functionKey: 'resetChecklist', payload: {} }, context: ctx('40006') } as any);
      expect(reset.stateVersion).toBe(3);
      const templates: any = await handler({ call: { functionKey: 'getAvailableTemplates' } } as any);
      expect(templates.length).toBeGreaterThanOrEqual(6);
    });
  });

  describe('storage resolution and the Forge KVS provider', () => {
    it('uses Forge KVS when no provider is set, with FAIL_IF_EXISTS for setIfAbsent and a prefix query', async () => {
      try {
        setGlobalStorageProvider(null);
        const kv = resolveStorage();

        kvsMock.get.mockResolvedValueOnce({ v: 1 });
        expect(await kv.get('k')).toEqual({ v: 1 });
        await kv.set('k', { v: 2 });
        expect(kvsMock.set).toHaveBeenLastCalledWith('k', { v: 2 });
        await kv.delete('k');
        expect(kvsMock.delete).toHaveBeenLastCalledWith('k');

        kvsMock.set.mockResolvedValueOnce(undefined);
        expect(await kv.setIfAbsent('e1', { a: 1 })).toBe(true);
        expect(kvsMock.set).toHaveBeenLastCalledWith('e1', { a: 1 }, { keyPolicy: 'FAIL_IF_EXISTS' });

        kvsMock.set.mockRejectedValueOnce(new Error('exists'));
        kvsMock.get.mockResolvedValueOnce({ a: 0 });
        expect(await kv.setIfAbsent('e1', { a: 1 })).toBe(false);

        kvsMock.set.mockRejectedValueOnce(new Error('KVS down'));
        kvsMock.get.mockResolvedValueOnce(undefined);
        await expect(kv.setIfAbsent('e2', { a: 1 })).rejects.toThrow('KVS down');

        const builder: any = { where: jest.fn(() => builder), limit: jest.fn(() => builder), cursor: jest.fn(() => builder), getMany: jest.fn(async () => ({ results: [{ key: 'p:1', value: 1 }], nextCursor: 'c2' })) };
        kvsMock.query.mockReturnValue(builder);
        expect(await kv.listByPrefix('p:', 'c1', 50)).toEqual({ values: [1], keys: ['p:1'], nextCursor: 'c2' });
        expect(builder.cursor).toHaveBeenCalledWith('c1');
        expect(builder.limit).toHaveBeenCalledWith(50);
        await kv.listByPrefix('p:');
        expect(builder.cursor).toHaveBeenCalledTimes(1);
      } finally {
        setGlobalStorageProvider(storage);
      }
    });
  });
});
