/*
 * Copyright (c) 2026 Asymm Systems. All rights reserved.
 *
 * @author Fahim Farook
 */

/**
 * CascadePlan: per-issue KVS records with a version check (B-09, INV-07, INV-08).
 */

import { PlanStore, sequenceBetween } from '../../src/storage/plan-store';
import { MemStorage } from '../helpers/mem-storage';

describe('PlanStore (B-09)', () => {
  let storage: MemStorage;
  let store: PlanStore;

  beforeEach(() => {
    storage = new MemStorage();
    store = new PlanStore(storage, '10000', 'TEST');
  });

  it('writes one record per issue under the project id prefix', async () => {
    await store.putEntry('TEST-1', '101', { startWeek: 'w1', spanWeeks: 2 });
    await store.putEntry('TEST-2', '102', { startWeek: 'w2', spanWeeks: 1 });
    expect([...storage.store.keys()].sort()).toEqual(['cp:10000:we:101', 'cp:10000:we:102']);
    const rec = await storage.get<any>('cp:10000:we:101');
    // The stored value is the WorkEffort record (B-24) plus bookkeeping fields.
    expect(rec).toEqual({ model: 2, issueKey: 'TEST-1', issueId: '101', version: 1, effort: { workEffortId: 'TEST-1' },
      assocs: [], parties: [], grid: { startWeek: 'w1', spanWeeks: 2 } });
  });

  it('loadEntries returns entries by issue key', async () => {
    await store.putEntry('TEST-1', '101', { startWeek: 'w1' });
    const map = await store.loadEntries();
    expect(map.get('TEST-1')).toMatchObject({ startWeek: 'w1', version: 1 });
    expect(map.size).toBe(1);
  });

  it('an update keeps the existing record key even when called with the issue key as id', async () => {
    await store.putEntry('TEST-1', '101', { startWeek: 'w1' });
    await store.putEntry('TEST-1', undefined, { startWeek: 'w3' });
    expect([...storage.store.keys()]).toEqual(['cp:10000:we:101']);
    expect((await store.loadEntries()).get('TEST-1')).toMatchObject({ startWeek: 'w3', version: 2 });
  });

  it('a write with a stale base version is rejected and the newer value survives', async () => {
    await store.putEntry('TEST-1', '101', { startWeek: 'w1' });
    const first = await store.putEntry('TEST-1', '101', { startWeek: 'w2' }, 1);
    const second = await store.putEntry('TEST-1', '101', { startWeek: 'w9' }, 1);
    expect(first.ok).toBe(true);
    expect(second.ok).toBe(false);
    expect(second.conflict).toBe(true);
    expect((await store.loadEntries()).get('TEST-1')).toMatchObject({ startWeek: 'w2', version: 2 });
  });

  it('a concurrent write between read and swap is detected and undone', async () => {
    await store.putEntry('TEST-1', '101', { startWeek: 'w1' });
    const realSwap = storage.swap.bind(storage);
    storage.swap = async (key: string, value: any) => {
      // Another writer saves version 2 just before our swap.
      await storage.set(key, { issueKey: 'TEST-1', issueId: '101', version: 2, startWeek: 'other' });
      storage.swap = realSwap;
      return realSwap(key, value);
    };
    const res = await store.putEntry('TEST-1', '101', { startWeek: 'mine' });
    expect(res.ok).toBe(false);
    expect((await store.loadEntries()).get('TEST-1')).toMatchObject({ startWeek: 'other', version: 2 });
  });

  it('deleteEntry removes the record of an issue', async () => {
    await store.putEntry('TEST-1', '101', { startWeek: 'w1' });
    await store.deleteEntry('TEST-1');
    expect(storage.store.size).toBe(0);
    await expect(store.deleteEntry('TEST-404')).resolves.toBeUndefined();
  });

  it('settings live in one record and merge patches', async () => {
    expect(await store.getSettings()).toEqual({});
    await store.saveSettings({ hiddenColumns: ['epic'] });
    await store.saveSettings({ columnWidths: { epic: 100 } as any });
    expect(await store.getSettings()).toEqual({ hiddenColumns: ['epic'], columnWidths: { epic: 100 } });
    expect([...storage.store.keys()]).toEqual(['cp:10000:settings']);
  });

  it('migrates the legacy single-key map once and deletes the old keys after writing', async () => {
    await storage.set('scheduleMap:TEST', {
      'TEST-1': { startWeek: 'w1', spanWeeks: 2, summary: 'Jira field' },
      'TEST-2': { startWeek: 'w2', dependency: { predecessorKey: 'TEST-1', predecessorId: 'TEST-1', triggerPercent: 30, isTriggerSatisfied: false } }
    });
    await storage.set('taskOrder:TEST', ['TEST-2', 'TEST-1']);
    await storage.set('colWidths:TEST', { epic: 90 });
    await storage.set('hiddenColumns:TEST', ['story']);
    await storage.set('milestones:TEST', [{ id: 'm1', title: 'Gate', date: '2026-11-20', weekKey: 'x', type: 'GATE' }]);
    await storage.set('ps:plan:TEST', { big: true });
    await storage.set('ps:TEST:task:TEST-1', { old: true });
    const migrated = await store.ensureMigrated(new Map([['TEST-1', '101']]));
    expect(migrated).toBe(true);
    const map = await store.loadEntries();
    expect(map.get('TEST-1')).toMatchObject({ issueId: '101', startWeek: 'w1', spanWeeks: 2, sequenceNum: 2000 });
    expect(map.get('TEST-1')!.summary).toBeUndefined();
    expect(map.get('TEST-2')).toMatchObject({ issueId: 'TEST-2', sequenceNum: 1000 });
    expect(await store.getSettings()).toMatchObject({ columnWidths: { epic: 90 }, hiddenColumns: ['story'], milestones: [{ id: 'm1' }] });
    for (const k of ['scheduleMap:TEST', 'taskOrder:TEST', 'colWidths:TEST', 'hiddenColumns:TEST', 'milestones:TEST', 'ps:plan:TEST', 'ps:TEST:task:TEST-1']) {
      expect(storage.store.has(k)).toBe(false);
    }
    storage.sets = [];
    expect(await store.ensureMigrated(new Map())).toBe(false);
    expect(storage.sets).toEqual([]);
  });

  it('a project with no legacy data is marked as migrated without other writes', async () => {
    expect(await store.ensureMigrated(new Map())).toBe(false);
    expect([...storage.store.keys()]).toEqual(['cp:10000:settings']);
    storage.sets = [];
    await store.ensureMigrated(new Map());
    expect(storage.sets).toEqual([]);
  });

  it('records stay far below the size limit at 1,000 tasks', async () => {
    for (let i = 1; i <= 1000; i++) {
      await store.putEntry(`TEST-${i}`, String(10000 + i), {
        startWeek: '04-Nov', endWeek: '18-Nov', startDate: '2026-11-04', endDate: '2026-11-24', spanWeeks: 3,
        weeklyAllocations: { '04-Nov': 33, '11-Nov': 33, '18-Nov': 33 }, sequenceNum: i * 1000,
        dependency: { predecessorKey: `TEST-${i - 1}`, predecessorId: `TEST-${i - 1}`, triggerPercent: 30, isTriggerSatisfied: false, jiraLinkId: '123456' },
        contributingResources: ['Ann Lee', 'Bo Chen']
      });
    }
    const largest = Math.max(...[...storage.store.values()].map(v => Buffer.byteLength(JSON.stringify(v))));
    expect(largest).toBeLessThan(8 * 1024);
  });

  it('records are keyed by project id, so a renamed project keeps its plan', async () => {
    await store.putEntry('TEST-1', '101', { startWeek: 'w1' });
    const renamed = new PlanStore(storage, '10000', 'NEWKEY');
    expect((await renamed.loadEntries()).get('TEST-1')).toMatchObject({ startWeek: 'w1' });
    const other = new PlanStore(storage, '20000', 'TEST');
    expect((await other.loadEntries()).size).toBe(0);
  });

  it('sequenceBetween places a value between neighbours', () => {
    expect(sequenceBetween(undefined, undefined)).toBe(1000);
    expect(sequenceBetween(undefined, 3000)).toBe(2000);
    expect(sequenceBetween(3000, undefined)).toBe(4000);
    expect(sequenceBetween(1000, 2000)).toBe(1500);
  });

  describe('Multiple plans per project (UX-05)', () => {
    it('listPlans returns default Main Plan when no plans exist', async () => {
      const plans = await store.listPlans();
      expect(plans).toHaveLength(1);
      expect(plans[0]).toMatchObject({ id: 'default', name: 'Main Plan', isDefault: true });
    });

    it('creates a new empty plan and lists it', async () => {
      const created = await store.createPlan('Optimistic Schedule');
      expect(created.name).toBe('Optimistic Schedule');
      expect(created.id).toMatch(/^plan-/);

      const plans = await store.listPlans();
      expect(plans).toHaveLength(2);
      expect(plans.map(p => p.name)).toEqual(['Main Plan', 'Optimistic Schedule']);
    });

    it('isolates entries between default plan and a named plan', async () => {
      await store.putEntry('TEST-1', '101', { startWeek: 'w1' });

      const scenarioStore = new PlanStore(storage, '10000', 'TEST', 'scenario-a');
      await scenarioStore.putEntry('TEST-1', '101', { startWeek: 'w5' });

      const defaultEntries = await store.loadEntries();
      const scenarioEntries = await scenarioStore.loadEntries();

      expect(defaultEntries.get('TEST-1')).toMatchObject({ startWeek: 'w1' });
      expect(scenarioEntries.get('TEST-1')).toMatchObject({ startWeek: 'w5' });
    });

    it('clones existing plan entries and settings when creating a cloned plan', async () => {
      await store.putEntry('TEST-1', '101', { startWeek: 'w1', spanWeeks: 3 });
      await store.saveSettings({ hiddenColumns: ['status'] });

      const clonedMeta = await store.createPlan('Cloned Plan', 'default');
      const clonedStore = new PlanStore(storage, '10000', 'TEST', clonedMeta.id);

      const clonedEntries = await clonedStore.loadEntries();
      expect(clonedEntries.get('TEST-1')).toMatchObject({ startWeek: 'w1', spanWeeks: 3 });

      const clonedSettings = await clonedStore.getSettings();
      expect(clonedSettings.hiddenColumns).toEqual(['status']);
    });

    it('deleting a plan removes its metadata and entries, but cannot delete default plan', async () => {
      const planMeta = await store.createPlan('Temporary Plan');
      const tempStore = new PlanStore(storage, '10000', 'TEST', planMeta.id);
      await tempStore.putEntry('TEST-99', '199', { startWeek: 'w9' });

      const cannotDeleteDefault = await store.deletePlan('default');
      expect(cannotDeleteDefault).toBe(false);

      const deleted = await store.deletePlan(planMeta.id);
      expect(deleted).toBe(true);

      const plans = await store.listPlans();
      expect(plans.map(p => p.id)).not.toContain(planMeta.id);

      const remainingEntries = await tempStore.loadEntries();
      expect(remainingEntries.size).toBe(0);
    });

    it('renames an existing plan', async () => {
      const planMeta = await store.createPlan('Old Name');
      const renamed = await store.renamePlan(planMeta.id, 'New Name');
      expect(renamed?.name).toBe('New Name');

      const plans = await store.listPlans();
      expect(plans.find(p => p.id === planMeta.id)?.name).toBe('New Name');
    });
  });
});

