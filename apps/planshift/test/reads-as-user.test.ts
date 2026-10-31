/*
 * Copyright (c) 2026 Asymm Systems. All rights reserved.
 *
 * @author Fahim Farook
 */

/**
 * CascadePlan: every Jira read runs as the user, so issue security applies (B-08, INV-06).
 */

import { getProjectPlan, fetchLiveJiraIssues, fetchProjectEpics, fetchProjectUsers, setGlobalStorageProvider } from '../src/index';
import { StorageProvider } from '../src/storage/plan-repository';

const mockAsUserRequest = jest.fn();
const mockAsAppRequest = jest.fn();
jest.mock('@forge/api', () => ({
  __esModule: true,
  default: {
    asApp: () => ({ requestJira: mockAsAppRequest }),
    asUser: () => ({ requestJira: mockAsUserRequest })
  },
  route: (strings: any, ...values: any[]) => strings.reduce((acc: string, str: string, i: number) => acc + str + (values[i] !== undefined ? values[i] : ''), '')
}));
jest.mock('@forge/kvs', () => ({ kvs: { get: jest.fn(), set: jest.fn(), delete: jest.fn() } }));

class MemStorage implements StorageProvider {
  store = new Map<string, any>();
  async get<T>(key: string): Promise<T | undefined> { return this.store.get(key); }
  async set(key: string, value: any): Promise<void> { this.store.set(key, value); }
  async delete(key: string): Promise<void> { this.store.delete(key); }
}

describe('reads as the user (B-08)', () => {
  beforeEach(() => {
    setGlobalStorageProvider(new MemStorage());
    mockAsAppRequest.mockReset();
    mockAsUserRequest.mockReset();
    mockAsAppRequest.mockImplementation(async () => { throw new Error('asApp must not be used for reads'); });
    mockAsUserRequest.mockImplementation(async (url: string) => {
      if (String(url).includes('/user/assignable')) return { status: 200, json: async () => [{ accountId: 'a1', displayName: 'Ann' }] };
      if (String(url).includes('issuetype in (Epic')) return { status: 200, json: async () => ({ issues: [{ id: '9', key: 'TEST-9', fields: { summary: 'Epic' } }] }) };
      return { status: 200, json: async () => ({ issues: [{ id: '1', key: 'TEST-1', fields: { summary: 'Visible to me', issuetype: { name: 'Task', hierarchyLevel: 0 }, status: { statusCategory: { key: 'new' } } } }] }) };
    });
  });

  it('issues, epics and users are read through asUser', async () => {
    const live = await fetchLiveJiraIssues('TEST');
    const epics = await fetchProjectEpics('TEST');
    const users = await fetchProjectUsers('TEST');
    expect(live.backlogTasks.map(t => t.summary)).toEqual(['Visible to me']);
    expect(epics.map(e => e.key)).toEqual(['TEST-9']);
    expect(users.some(u => u.displayName === 'Ann')).toBe(true);
    expect(mockAsAppRequest).not.toHaveBeenCalled();
  });

  it('a full plan load makes no asApp call', async () => {
    const plan = await getProjectPlan('TEST');
    expect(plan.isLiveSynced).toBe(true);
    expect(mockAsAppRequest).not.toHaveBeenCalled();
    expect(mockAsUserRequest).toHaveBeenCalled();
  });
});
