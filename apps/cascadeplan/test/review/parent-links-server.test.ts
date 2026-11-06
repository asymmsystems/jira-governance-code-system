/*
 * Copyright (c) 2026 Asymm Systems. All rights reserved.
 *
 * @author Fahim Farook
 */

/**
 * Merge review L5 (N-06 rule 5 on the server): with "Enforce dependencies" on, the server refuses a
 * start that breaks a link into the task or into any of its ancestors, before any write. TEST-1 is a
 * parent that depends on TEST-3; TEST-2 is its sub-task.
 */

import { getProjectPlan, updateWbsTask, moveTaskGroup, setGlobalStorageProvider, setSleepForTests, getTimelineWeeks } from '../../src/index';
import { PlanStore } from '../../src/storage/plan-store';
import { MemStorage } from '../helpers/mem-storage';

const mockRequestJira = jest.fn();
jest.mock('@forge/api', () => ({
  __esModule: true,
  default: { asApp: () => ({ requestJira: mockRequestJira }), asUser: () => ({ requestJira: mockRequestJira }) },
  route: (strings: any, ...values: any[]) => strings.reduce((acc: string, str: string, i: number) => acc + str + (values[i] !== undefined ? values[i] : ''), '')
}));
jest.mock('@forge/kvs', () => ({ kvs: { get: jest.fn(), set: jest.fn(), delete: jest.fn() } }));

const weeks = getTimelineWeeks().weeks;
const add = (iso: string, d: number) => new Date(Date.parse(`${iso}T00:00:00Z`) + d * 86400000).toISOString().slice(0, 10);
const start = weeks[5].startDate;
const task = { name: 'Task', hierarchyLevel: 0 };
const subtask = { name: 'Subtask', hierarchyLevel: -1, subtask: true };
const issue = (n: number, type: any, parent?: number) => ({ id: String(n), key: `TEST-${n}`, fields: {
  summary: `T${n}`, issuetype: type, status: { statusCategory: { key: 'new' } },
  ...(parent ? { parent: { id: String(parent), key: `TEST-${parent}`, fields: { summary: `T${parent}`, issuetype: task } } } : {}) } });

let storage: MemStorage;
const puts = () => mockRequestJira.mock.calls.filter(([, o]) => o?.method === 'PUT');

beforeEach(async () => {
  storage = new MemStorage();
  setGlobalStorageProvider(storage);
  setSleepForTests(async () => undefined);
  mockRequestJira.mockReset();
  mockRequestJira.mockImplementation(async (r: any) => {
    const url = String(r);
    if (/\/rest\/api\/3\/issue\/TEST-\d+\?fields=project/.test(url)) return { status: 200, json: async () => ({ id: '1', fields: { project: { key: 'TEST', id: 'TEST' } } }) };
    if (url.includes('/search/jql')) return { status: 200, json: async () => ({ issues: url.includes('Epic') ? [] : [issue(1, task), issue(2, subtask, 1), issue(3, task)], isLast: true }) };
    return { status: 204, json: async () => ({}) };
  });
  const w = weeks[5].weekKey;
  await storage.set('scheduleMap:TEST', {
    'TEST-3': { startWeek: w, spanWeeks: 1, startDate: start, endDate: add(start, 4) },
    'TEST-1': { startWeek: w, spanWeeks: 1, startDate: add(start, 5), endDate: add(start, 9), dependency: { predecessorKey: 'TEST-3', predecessorId: '3', triggerPercent: 100, isTriggerSatisfied: false } },
    'TEST-2': { startWeek: w, spanWeeks: 1, startDate: add(start, 5), endDate: add(start, 9) }
  });
  await getProjectPlan('TEST', storage);
  mockRequestJira.mockClear();
});

const version = async (key: string) => (await new PlanStore(storage, 'TEST', 'TEST').loadEntries()).get(key)?.version || 0;

describe('L5: a parent\'s links bind its sub-tasks on the server', () => {
  it('with enforce on, a sub-task move before the parent\'s predecessor allows is refused, with no write', async () => {
    const v = await version('TEST-2');
    // A validation error: the resolver wrapper returns it as { ok: false, message }.
    await expect(updateWbsTask({ projectKey: 'TEST', taskId: 'TEST-2', updates: { startDate: add(start, 2), endDate: add(start, 6) },
      expectedVersion: v, enforceDependencies: true }, storage))
      .rejects.toThrow(`TEST-2 cannot start before ${add(start, 5)}: its parent TEST-1 depends on TEST-3 (100%). Turn off "Enforce dependencies" to move it anyway.`);
    expect(await version('TEST-2')).toBe(v);
    expect(puts()).toEqual([]);
  });

  it('a move that meets the link goes ahead; with enforce off the move is made (the planner shows the conflict)', async () => {
    const ok: any = await updateWbsTask({ projectKey: 'TEST', taskId: 'TEST-2', updates: { startDate: add(start, 6), endDate: add(start, 10) },
      expectedVersion: await version('TEST-2'), enforceDependencies: true }, storage);
    expect(ok.ok).toBe(true);
    const off: any = await updateWbsTask({ projectKey: 'TEST', taskId: 'TEST-2', updates: { startDate: add(start, 1), endDate: add(start, 5) },
      expectedVersion: await version('TEST-2') }, storage);
    expect(off.ok).toBe(true);
  });

  it('a block move with enforce on is refused when a moving sub-task would break the parent\'s link', async () => {
    await expect(moveTaskGroup({ projectKey: 'TEST', taskId: 'TEST-1', days: -3, enforceDependencies: true }, storage))
      .rejects.toThrow(/^Nothing moved: TEST-2 cannot start before .*its parent TEST-1 depends on TEST-3/);
    expect(puts()).toEqual([]);
  });

  it('a value other than true or false is refused', async () => {
    await expect(updateWbsTask({ projectKey: 'TEST', taskId: 'TEST-2', updates: { startDate: add(start, 6) }, enforceDependencies: 'yes' as any }, storage)).rejects.toThrow('enforceDependencies must be true or false');
    await expect(moveTaskGroup({ projectKey: 'TEST', taskId: 'TEST-1', days: 7, enforceDependencies: 1 as any }, storage)).rejects.toThrow('enforceDependencies must be true or false');
  });
});
