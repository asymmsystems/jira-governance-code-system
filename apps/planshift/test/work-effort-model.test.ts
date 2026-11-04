/*
 * Copyright (c) 2026 Asymm Systems. All rights reserved.
 *
 * @author Fahim Farook
 */

/**
 * CascadePlan: WorkEffort model conformance in the resolvers and the one-time record migration (B-28).
 */

import { getProjectPlan, updateWbsTask, scheduleBacklogTask, setGlobalStorageProvider, setSleepForTests, getTimelineWeeks } from '../src/index';
import { MemStorage } from './helpers/mem-storage';

const mockRequestJira = jest.fn();
jest.mock('@forge/api', () => ({
  __esModule: true,
  default: {
    asApp: () => ({ requestJira: mockRequestJira }),
    asUser: () => ({ requestJira: mockRequestJira })
  },
  route: (strings: any, ...values: any[]) => strings.reduce((acc: string, str: string, i: number) => acc + str + (values[i] !== undefined ? values[i] : ''), '')
}));
jest.mock('@forge/kvs', () => ({ kvs: { get: jest.fn(), set: jest.fn(), delete: jest.fn() } }));

const weeks = getTimelineWeeks().weeks;
const status = { statusCategory: { key: 'new' } };
const type = (name: string, hierarchyLevel: number) => ({ name, hierarchyLevel, subtask: hierarchyLevel === -1 });
const blocks = (pred: string, id: string) => ({ type: { name: 'Blocks' }, inwardIssue: { key: pred, id } });
const USERS = [{ accountId: 'acc-1', displayName: 'Ann Lee', accountType: 'atlassian' }, { accountId: 'acc-2', displayName: 'Bo Chen', accountType: 'atlassian' }];
let ISSUES: any[];
const today = new Date().toISOString().slice(0, 10);

/** The raw stored WorkEffort record of an issue (not converted back to a task entry). */
async function recordOf(storage: MemStorage, issueKey: string): Promise<any> {
  return (await storage.query<any>('cp:TEST:we:')).find(r => r.value.issueKey === issueKey)?.value;
}

function issues(): any[] {
  return [
    { id: '1', key: 'TEST-1', fields: { summary: 'Story', issuetype: type('Story', 0), status } },
    { id: '2', key: 'TEST-2', fields: { summary: 'Sub A', issuetype: type('Sub-task', -1), status, parent: { id: '1', key: 'TEST-1', fields: { summary: 'Story', issuetype: type('Story', 0) } } } },
    { id: '3', key: 'TEST-3', fields: { summary: 'Sub B', issuetype: type('Sub-task', -1), status, parent: { id: '1', key: 'TEST-1', fields: { summary: 'Story', issuetype: type('Story', 0) } } } },
    { id: '4', key: 'TEST-4', fields: { summary: 'Task', issuetype: type('Task', 0), status, issuelinks: [blocks('TEST-5', '5'), blocks('TEST-6', '6')] } },
    { id: '5', key: 'TEST-5', fields: { summary: 'Pred', issuetype: type('Task', 0), status } },
    { id: '6', key: 'TEST-6', fields: { summary: 'Pred 2', issuetype: type('Task', 0), status } }
  ];
}

describe('WorkEffort model in the resolvers (B-28)', () => {
  let storage: MemStorage;

  beforeEach(() => {
    storage = new MemStorage();
    setGlobalStorageProvider(storage);
    setSleepForTests(async () => undefined);
    ISSUES = issues();
    mockRequestJira.mockReset();
    mockRequestJira.mockImplementation(async (routeStr: any, options?: any) => {
      const url = String(routeStr);
      const lookup = url.match(/\/rest\/api\/3\/issue\/([A-Z0-9_]+)-(\d+)\?fields=project/);
      if (lookup) return { status: 200, json: async () => ({ fields: { project: { key: lookup[1] } } }) };
      if (url.includes('/search/jql')) return { status: 200, json: async () => ({ issues: url.includes('Epic') ? [] : ISSUES, isLast: true }) };
      if (url.includes('/user/assignable/search')) return { status: 200, json: async () => USERS };
      if (url.includes('?fields=issuelinks')) return { status: 200, json: async () => ({ fields: { issuelinks: [] } }) };
      if (options?.method === 'POST' && url.endsWith('/issueLink')) return { status: 201, json: async () => ({}) };
      return { status: 204, json: async () => ({}) };
    });
  });

  const seed = async (map: Record<string, any>) => storage.set('scheduleMap:TEST', map);
  const plan = () => getProjectPlan('TEST', storage);

  it('a parent spans its dated children on load, is marked, and a child move writes nothing for the parent (criterion 5)', async () => {
    await seed({
      'TEST-1': { startWeek: weeks[0].weekKey, spanWeeks: 1, startDate: weeks[0].startDate, endDate: weeks[0].endDate },
      'TEST-2': { startWeek: weeks[4].weekKey, spanWeeks: 1, startDate: weeks[4].startDate, endDate: weeks[4].endDate },
      'TEST-3': { startWeek: weeks[5].weekKey, spanWeeks: 2, startDate: weeks[5].startDate, endDate: weeks[6].endDate }
    });
    const p = await plan();
    const parent = p.tasks.find(t => t.key === 'TEST-1')!;
    expect(parent).toMatchObject({ startDate: weeks[4].startDate, endDate: weeks[6].endDate, datesFromChildren: true });
    const before = (await recordOf(storage, 'TEST-1')).version;
    await updateWbsTask({ projectKey: 'TEST', taskId: 'TEST-3', updates: { startDate: weeks[7].startDate, endDate: weeks[8].endDate } });
    expect((await recordOf(storage, 'TEST-1')).version).toBe(before);
    expect((await plan()).tasks.find(t => t.key === 'TEST-1')).toMatchObject({ endDate: weeks[8].endDate });
  });

  it('several predecessors: stored links plus every Jira "Blocks" link not ended, all used by the engine (criterion 3)', async () => {
    await seed({
      'TEST-4': { startWeek: weeks[2].weekKey, spanWeeks: 1, startDate: weeks[2].startDate, endDate: weeks[2].endDate },
      'TEST-5': { startWeek: weeks[2].weekKey, spanWeeks: 2, startDate: weeks[2].startDate, endDate: weeks[3].endDate },
      'TEST-6': { startWeek: weeks[3].weekKey, spanWeeks: 2, startDate: weeks[3].startDate, endDate: weeks[4].endDate }
    });
    const t4 = (await plan()).tasks.find(t => t.key === 'TEST-4')!;
    expect(t4.dependencies!.map(d => [d.predecessorKey, d.triggerPercent])).toEqual([['TEST-5', 100], ['TEST-6', 100]]);
    // TEST-6 ends last, so it drives the earliest start.
    expect(t4.dependency!.driverKey).toBe('TEST-6');
    expect(t4.jiraBlockedBy!.map(b => b.key)).toEqual(['TEST-5', 'TEST-6']);
  });

  it('removing links ends them: no Jira link from those predecessors comes back (criterion 2)', async () => {
    await seed({ 'TEST-4': { startWeek: weeks[2].weekKey, spanWeeks: 1 }, 'TEST-5': { startWeek: weeks[2].weekKey, spanWeeks: 1 }, 'TEST-6': { startWeek: weeks[2].weekKey, spanWeeks: 1 } });
    await plan();
    await updateWbsTask({ projectKey: 'TEST', taskId: 'TEST-4', updates: { dependency: null } });
    const rec = await recordOf(storage, 'TEST-4');
    expect(rec.assocs.map((a: any) => [a.workEffortIdFrom, a.workEffortAssocTypeId, a.thruDate])).toEqual([
      ['TEST-5', 'WORK_EFF_PRECEDENCY', today], ['TEST-6', 'WORK_EFF_PRECEDENCY', today]]);
    expect((await plan()).tasks.find(t => t.key === 'TEST-4')!.dependency).toBeUndefined();
  });

  it('second people are stored by account id and shown with their live Jira name (criterion 4)', async () => {
    await seed({ 'TEST-5': { startWeek: weeks[2].weekKey, spanWeeks: 1 } });
    await plan();
    await updateWbsTask({ projectKey: 'TEST', taskId: 'TEST-5', updates: { contributors: [{ accountId: 'acc-2' }] } as any });
    expect((await recordOf(storage, 'TEST-5')).parties).toEqual([{ workEffortId: 'TEST-5', partyId: 'acc-2', roleTypeId: 'CONTRIBUTOR', fromDate: today }]);
    USERS[1].displayName = 'Bo Chen-Smith';
    expect((await plan()).tasks.find(t => t.key === 'TEST-5')!.contributingResources).toEqual(['Bo Chen-Smith']);
    USERS[1].displayName = 'Bo Chen';
    await updateWbsTask({ projectKey: 'TEST', taskId: 'TEST-5', updates: { contributingResources: ['Ann Lee', 'Bo Chen'] } });
    expect((await recordOf(storage, 'TEST-5')).parties.map((p: any) => p.partyId)).toEqual(['acc-1', 'acc-2']);
    const bad: any = await updateWbsTask({ projectKey: 'TEST', taskId: 'TEST-5', updates: { contributors: [{ accountId: '<x>' }] } as any }).catch(e => e);
    expect(String(bad.message || bad.error)).toMatch(/contributor/);
  });
});

describe('model 1 record migration (B-28 criterion 6)', () => {
  let storage: MemStorage;

  beforeEach(async () => {
    storage = new MemStorage();
    setGlobalStorageProvider(storage);
    ISSUES = issues();
    mockRequestJira.mockReset();
    mockRequestJira.mockImplementation(async (routeStr: any) => {
      const url = String(routeStr);
      if (url.includes('/search/jql')) return { status: 200, json: async () => ({ issues: url.includes('Epic') ? [] : ISSUES, isLast: true }) };
      if (url.includes('/user/assignable/search')) return { status: 200, json: async () => USERS };
      return { status: 200, json: async () => [] };
    });
    // Records in the B-24 shape, as an earlier build wrote them.
    await storage.set('cp:TEST:settings', { migratedAt: '2026-10-30T00:00:00Z' });
    await storage.set('cp:TEST:we:5', { issueKey: 'TEST-5', issueId: '5', version: 3,
      effort: { workEffortId: 'TEST-5', estimatedStartDate: weeks[2].startDate, estimatedCompletionDate: weeks[2].endDate },
      assocs: [{ workEffortIdFrom: 'TEST-6', workEffortIdTo: 'TEST-5', workEffortAssocTypeId: 'FRACTIONAL_MILESTONE', triggerPercent: 30, isTriggerSatisfied: false, jiraLinkId: '77' }],
      parties: [{ workEffortId: 'TEST-5', partyId: '', displayName: 'Ann Lee', roleTypeId: 'CONTRIBUTOR' },
        { workEffortId: 'TEST-5', partyId: '', displayName: 'Former Person', roleTypeId: 'CONTRIBUTOR' }],
      grid: { startWeek: weeks[2].weekKey, spanWeeks: 1 } });
    await storage.set('cp:TEST:we:4', { issueKey: 'TEST-4', issueId: '4', version: 1,
      effort: { workEffortId: 'TEST-4' }, assocs: [], parties: [], precedenceRemoved: true, grid: { startWeek: weeks[2].weekKey, spanWeeks: 1 } });
  });

  it('rewrites each old record once into the new shape, losing nothing', async () => {
    const p = await getProjectPlan('TEST', storage);
    const r5 = await storage.get<any>('cp:TEST:we:5');
    expect(r5).toMatchObject({ model: 2, version: 4, effort: { estimatedStartDate: weeks[2].startDate } });
    expect(r5.assocs).toEqual([{ workEffortIdFrom: 'TEST-6', workEffortIdTo: 'TEST-5', workEffortAssocTypeId: 'WORK_EFF_PRECEDENCY', fromDate: today, attrs: { triggerPercent: 30, jiraLinkId: '77' } }]);
    expect(r5.parties).toEqual([
      { workEffortId: 'TEST-5', partyId: 'acc-1', roleTypeId: 'CONTRIBUTOR', fromDate: today },
      { workEffortId: 'TEST-5', legacyName: 'Former Person', roleTypeId: 'CONTRIBUTOR', fromDate: today }
    ]);
    // The old "removed" flag on TEST-4 becomes ended links for the two Jira links it suppressed.
    const r4 = await storage.get<any>('cp:TEST:we:4');
    expect(r4.assocs.map((a: any) => [a.workEffortIdFrom, a.thruDate])).toEqual([['TEST-5', today], ['TEST-6', today]]);
    expect(r4.precedenceRemoved).toBeUndefined();
    expect(p.tasks.find(t => t.key === 'TEST-4')!.dependency).toBeUndefined();
    expect(p.tasks.find(t => t.key === 'TEST-5')!.contributingResources).toEqual(['Ann Lee', 'Former Person']);
    expect((await storage.get<any>('cp:TEST:settings')).modelVersion).toBe(2);
  });

  it('is idempotent: a second load writes nothing', async () => {
    await getProjectPlan('TEST', storage);
    const writes = storage.sets.length;
    await getProjectPlan('TEST', storage);
    expect(storage.sets.length).toBe(writes);
  });

  it('a legacy scheduleMap is converted with the same rules', async () => {
    storage = new MemStorage();
    setGlobalStorageProvider(storage);
    await storage.set('scheduleMap:TEST', {
      'TEST-5': { startWeek: weeks[2].weekKey, spanWeeks: 1, contributingResources: ['Bo Chen'], dependency: { predecessorKey: 'TEST-6', predecessorId: 'TEST-6', triggerPercent: 40, isTriggerSatisfied: false } },
      'TEST-4': { startWeek: weeks[2].weekKey, spanWeeks: 1, dependency: null }
    });
    await getProjectPlan('TEST', storage);
    expect((await recordOf(storage, 'TEST-5')).parties.map((p: any) => p.partyId)).toEqual(['acc-2']);
    expect((await recordOf(storage, 'TEST-5')).assocs[0]).toMatchObject({ workEffortIdFrom: 'TEST-6', attrs: { triggerPercent: 40 } });
    expect((await recordOf(storage, 'TEST-4')).assocs.map((a: any) => a.workEffortIdFrom)).toEqual(['TEST-5', 'TEST-6']);
  });
});

describe('scheduling at an exact date outside the server week list (B-27 criterion 2)', () => {
  let storage: MemStorage;
  beforeEach(() => {
    storage = new MemStorage();
    setGlobalStorageProvider(storage);
    ISSUES = issues();
    mockRequestJira.mockReset();
    mockRequestJira.mockImplementation(async (routeStr: any) => {
      const url = String(routeStr);
      const lookup = url.match(/\/rest\/api\/3\/issue\/([A-Z0-9_]+)-(\d+)\?fields=project/);
      if (lookup) return { status: 200, json: async () => ({ fields: { project: { key: lookup[1] } } }) };
      if (url.includes('/search/jql')) return { status: 200, json: async () => ({ issues: url.includes('Epic') ? [] : ISSUES, isLast: true }) };
      return { status: 204, json: async () => ({}) };
    });
  });

  it('a startDate places the task on that exact day for the given weeks and writes that due date', async () => {
    const res: any = await scheduleBacklogTask({ projectKey: 'TEST', taskId: 'TEST-5', startWeek: '', startDate: '2028-03-06', spanWeeks: 2 } as any);
    const rec = await recordOf(storage, 'TEST-5');
    expect(rec.effort).toMatchObject({ estimatedStartDate: '2028-03-06', estimatedCompletionDate: '2028-03-19' });
    expect(res.jiraSync.writes[0].changes).toEqual([{ field: 'due date', from: null, to: '2028-03-19' }]);
    await expect(scheduleBacklogTask({ projectKey: 'TEST', taskId: 'TEST-5', startWeek: '', startDate: '6 March' } as any)).rejects.toThrow(/startDate/);
  });
});
