/*
 * Copyright (c) 2026 Asymm Systems. All rights reserved.
 *
 * @author Fahim Farook
 */

/**
 * CascadePlan: every write resolver validates its payload before any KVS or Jira write (B-02).
 */

import {
  scheduleBacklogTask,
  unscheduleTask,
  addSubtaskToTask,
  createSubtaskForResource,
  saveTaskDependency,
  updateWbsTask,
  saveColumnWidths,
  saveHiddenColumns,
  saveProjectMilestone,
  setGlobalStorageProvider,
  withValidation
} from '../src/index';
import { ValidationError } from '../src/validation';
import { MemStorage, entryOf } from './helpers/mem-storage';

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

class RecordingStorage extends MemStorage {
  writes: string[] = [];
  async set(key: string, value: any): Promise<void> { this.writes.push(key); return super.set(key, value); }
  async delete(key: string): Promise<void> { this.writes.push(`delete:${key}`); return super.delete(key); }
  async swap<T>(key: string, value: T): Promise<T | undefined> { this.writes.push(key); return super.swap(key, value); }
}

const ISSUES = [
  { id: '1', key: 'TEST-1', fields: { summary: 'One', issuetype: { name: 'Task', hierarchyLevel: 0 }, status: { statusCategory: { key: 'new' } } } },
  { id: '2', key: 'TEST-2', fields: { summary: 'Two', issuetype: { name: 'Task', hierarchyLevel: 0 }, status: { statusCategory: { key: 'new' } } } }
];

function jiraWrites(): any[] {
  return mockRequestJira.mock.calls.filter(c => c[1] && c[1].method && c[1].method !== 'GET');
}

describe('resolver payload validation (B-02)', () => {
  let storage: RecordingStorage;

  beforeEach(async () => {
    storage = new RecordingStorage();
    setGlobalStorageProvider(storage);
    mockRequestJira.mockReset();
    mockRequestJira.mockImplementation(async (routeStr: any, options?: any) => {
      const url = String(routeStr);
      if (url.includes('/search/jql')) return { status: 200, json: async () => ({ issues: ISSUES }) };
      if (url.includes('/user/assignable')) return { status: 200, json: async () => [] };
      const m = url.match(/\/rest\/api\/3\/issue\/([A-Z0-9_]+)-(\d+)\?fields=project/);
      if (m && !options?.method) return { status: 200, json: async () => ({ key: `${m[1]}-${m[2]}`, fields: { project: { key: m[1] } } }) };
      return { status: 204, json: async () => ({}) };
    });
    await storage.set('scheduleMap:TEST', { 'TEST-1': { startWeek: 'x', spanWeeks: 1 } });
    storage.writes = [];
  });

  it('scheduleBacklogTask rejects an issue from another project with no write', async () => {
    await expect(scheduleBacklogTask({ projectKey: 'TEST', taskId: 'OTHER-5', startWeek: 'x' })).rejects.toThrow(ValidationError);
    expect(storage.writes).toEqual([]);
    expect(jiraWrites()).toEqual([]);
  });

  it('scheduleBacklogTask rejects a malformed key before any Jira call', async () => {
    await expect(scheduleBacklogTask({ projectKey: 'TEST', taskId: 'TEST-1 OR 1=1', startWeek: 'x' })).rejects.toThrow(ValidationError);
    expect(mockRequestJira).not.toHaveBeenCalled();
  });

  it('scheduleBacklogTask rejects an issue key that Jira cannot find', async () => {
    mockRequestJira.mockImplementation(async () => ({ status: 404, json: async () => ({}) }));
    await expect(scheduleBacklogTask({ projectKey: 'TEST', taskId: 'TEST-77', startWeek: 'x' })).rejects.toThrow('not in project TEST');
    expect(storage.writes).toEqual([]);
  });

  it('unscheduleTask and addSubtaskToTask reject keys from another project', async () => {
    await expect(unscheduleTask({ projectKey: 'TEST', taskId: 'OTHER-1' })).rejects.toThrow(ValidationError);
    await expect(addSubtaskToTask({ projectKey: 'TEST', parentTaskId: 'OTHER-1', subtask: { summary: 's', estimateValue: 1, estimateUnit: 'HOURS' } })).rejects.toThrow(ValidationError);
    expect(storage.writes).toEqual([]);
  });

  it('createSubtaskForResource rejects a parent from another project with no Jira write', async () => {
    await expect(createSubtaskForResource({ projectKey: 'TEST', parentKey: 'OTHER-9' })).rejects.toThrow(ValidationError);
    expect(jiraWrites()).toEqual([]);
  });

  it('saveTaskDependency rejects a predecessor that is not in the plan', async () => {
    await expect(saveTaskDependency({ projectKey: 'TEST', taskId: 'TEST-1', dependency: { predecessorId: 'OTHER-999', predecessorKey: 'OTHER-999', triggerPercent: 30, isTriggerSatisfied: false } })).rejects.toThrow(ValidationError);
    expect(jiraWrites()).toEqual([]);
  });

  it('updateWbsTask rejects wrong types with no KVS or Jira write', async () => {
    await expect(updateWbsTask({ projectKey: 'TEST', taskId: 'TEST-1', updates: { summary: { evil: true } as any } })).rejects.toThrow(ValidationError);
    await expect(updateWbsTask({ projectKey: 'TEST', taskId: 'TEST-1', updates: { resource: 'x'.repeat(500) } })).rejects.toThrow(ValidationError);
    expect(storage.writes.filter(k => k.startsWith('scheduleMap'))).toEqual([]);
    expect(jiraWrites()).toEqual([]);
  });

  it('updateWbsTask rejects a dependency on an issue outside the plan', async () => {
    await expect(updateWbsTask({ projectKey: 'TEST', taskId: 'TEST-1', updates: { dependency: { predecessorId: 'OTHER-1', predecessorKey: 'OTHER-1', triggerPercent: 30, isTriggerSatisfied: false } } })).rejects.toThrow(ValidationError);
    expect(jiraWrites()).toEqual([]);
  });

  it('settings resolvers reject bad payloads with no write', async () => {
    await expect(saveColumnWidths({ projectKey: 'TEST', columnWidths: { epic: 'url(x)' } as any })).rejects.toThrow(ValidationError);
    await expect(saveHiddenColumns({ projectKey: 'TEST', hiddenColumns: ['<b>'] })).rejects.toThrow(ValidationError);
    await expect(saveProjectMilestone({ projectKey: 'TEST', milestone: { id: 'm', title: '<img>', date: 'no', weekKey: 'x', type: 'GATE' } })).rejects.toThrow(ValidationError);
    expect(storage.writes).toEqual([]);
  });

  it('withValidation turns a ValidationError into a validation result and rethrows other errors', async () => {
    await expect(withValidation(async () => { throw new ValidationError('taskId', 'bad'); })).resolves.toEqual({ ok: false, success: false, error: 'validation', field: 'taskId', message: 'bad' });
    await expect(withValidation(async () => 7)).resolves.toBe(7);
    await expect(withValidation(async () => { throw new Error('boom'); })).rejects.toThrow('boom');
  });
});
