/*
 * Copyright (c) 2026 Asymm Systems. All rights reserved.
 *
 * @author Fahim Farook
 */

/**
 * CascadePlan: epic, story and sub-task levels come from Jira's hierarchy level (B-05, CP-08).
 */

import { getProjectPlan, setGlobalStorageProvider, getTimelineWeeks } from '../src/index';
import { StorageProvider } from '../src/storage/plan-repository';

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

class MemStorage implements StorageProvider {
  store = new Map<string, any>();
  async get<T>(key: string): Promise<T | undefined> { return this.store.get(key); }
  async set(key: string, value: any): Promise<void> { this.store.set(key, JSON.parse(JSON.stringify(value))); }
  async delete(key: string): Promise<void> { this.store.delete(key); }
}

const type = (name: string, level: number) => ({ name, hierarchyLevel: level, subtask: level === -1 });
const status = { statusCategory: { key: 'new' } };
// Jira Cloud shape: stories carry the epic as `parent`; the sub-task carries its story as `parent`.
const ISSUES = [
  { id: '1', key: 'SW-1', fields: { summary: 'Epic', issuetype: type('Epic', 1), status } },
  { id: '2', key: 'SW-2', fields: { summary: 'Story A', issuetype: type('Story', 0), status, parent: { id: '1', key: 'SW-1', fields: { summary: 'Epic', issuetype: type('Epic', 1) } } } },
  { id: '4', key: 'SW-4', fields: { summary: 'Sub of A', issuetype: type('Sub-task', -1), status, parent: { id: '2', key: 'SW-2', fields: { summary: 'Story A', issuetype: type('Story', 0) } } } },
  { id: '3', key: 'SW-3', fields: { summary: 'Story B', issuetype: type('Story', 0), status, parent: { id: '1', key: 'SW-1', fields: { summary: 'Epic', issuetype: type('Epic', 1) } } } },
  { id: '9', key: 'SW-9', fields: { summary: 'Orphan story', issuetype: type('Story', 0), status, parent: { id: '8', key: 'SW-8', fields: { summary: 'Unscheduled epic', issuetype: type('Epic', 1) } } } }
];

describe('hierarchy regression lock (B-05)', () => {
  let storage: MemStorage;
  const weeks = getTimelineWeeks().weeks;
  const sched = { startWeek: weeks[5].weekKey, spanWeeks: 2 };

  beforeEach(() => {
    storage = new MemStorage();
    setGlobalStorageProvider(storage);
    mockRequestJira.mockReset();
    mockRequestJira.mockImplementation(async (url: string) => {
      if (String(url).includes('/search/jql')) return { status: 200, json: async () => ({ issues: ISSUES }) };
      return { status: 200, json: async () => [] };
    });
  });

  it('maps epic, stories and sub-task to levels 1, 0, 0, -1 with the sub-task after its story', async () => {
    await storage.set('scheduleMap:SW', { 'SW-1': sched, 'SW-2': sched, 'SW-3': sched, 'SW-4': sched });
    const plan = await getProjectPlan('SW', storage);
    const order = plan.tasks.map(t => `${t.key}:${t.hierarchyLevel}`);
    expect(order).toEqual(['SW-1:1', 'SW-2:0', 'SW-4:-1', 'SW-3:0']);
    expect(plan.tasks.find(t => t.key === 'SW-2')!.isSubtask).toBe(false);
    expect(plan.tasks.find(t => t.key === 'SW-4')!.parentKey).toBe('SW-2');
    expect(plan.tasks.find(t => t.key === 'SW-2')!.epicKey).toBe('SW-1');
  });

  it('a story whose epic is not on the timeline is a top-level story, not a hidden sub-task', async () => {
    await storage.set('scheduleMap:SW', { 'SW-9': sched });
    const plan = await getProjectPlan('SW', storage);
    const orphan = plan.tasks.find(t => t.key === 'SW-9')!;
    expect(orphan.hierarchyLevel).toBe(0);
    expect(orphan.isSubtask).toBe(false);
    expect(orphan.epic).toBe('Unscheduled epic');
  });

  it('the epic itself stays in the backlog until scheduled, while its stories can be scheduled', async () => {
    await storage.set('scheduleMap:SW', { 'SW-2': sched });
    const plan = await getProjectPlan('SW', storage);
    expect(plan.tasks.map(t => t.key)).toEqual(['SW-2']);
    expect(plan.backlogTasks!.find(t => t.key === 'SW-1')!.isEpic).toBe(true);
  });
});
