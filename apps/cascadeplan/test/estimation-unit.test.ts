/*
 * Copyright (c) 2026 Asymm Systems. All rights reserved.
 *
 * @author Fahim Farook
 */

/**
 * CascadePlan: estimation unit stored per task tests (B-20).
 */

import {
  updateWbsTask,
  getProjectPlan,
  setGlobalStorageProvider
} from '../src/index';
import { MemStorage } from './helpers/mem-storage';

const mockRequestJira = jest.fn();
jest.mock('@forge/api', () => ({
  __esModule: true,
  default: {
    asUser: () => ({ requestJira: mockRequestJira }),
    asApp: () => ({ requestJira: mockRequestJira })
  },
  route: (strings: TemplateStringsArray, ...values: any[]) =>
    strings.reduce((acc, str, i) => acc + str + (values[i] !== undefined ? values[i] : ''), '')
}));

describe('estimation unit per task (B-20)', () => {
  let storage: MemStorage;

  beforeEach(async () => {
    storage = new MemStorage();
    setGlobalStorageProvider(storage);
    mockRequestJira.mockReset();

    mockRequestJira.mockImplementation(async (routeStr: any, opts?: any) => {
      const url = String(routeStr);
      if (url.includes('/rest/api/3/issue/TEST-1')) {
        if (opts?.method === 'PUT') {
          return { status: 200, json: async () => ({}) };
        }
        return {
          status: 200,
          json: async () => ({
            id: '10001',
            key: 'TEST-1',
            fields: {
              summary: 'Task 1',
              status: { name: 'To Do', statusCategory: { key: 'new' } },
              issuetype: { name: 'Task', subtask: false },
              project: { key: 'TEST' },
              timeoriginalestimate: 144000,
              timetracking: { originalEstimateSeconds: 144000 } // 40 hours
            }
          })
        };
      }
      if (url.includes('/search/jql')) {
        return {
          status: 200,
          json: async () => ({
            issues: [
              {
                id: '10001',
                key: 'TEST-1',
                fields: {
                  summary: 'Task 1',
                  status: { name: 'To Do', statusCategory: { key: 'new' } },
                  issuetype: { name: 'Task', subtask: false },
                  project: { key: 'TEST' },
                  timeoriginalestimate: 144000,
                  timetracking: { originalEstimateSeconds: 144000 }
                }
              }
            ],
            isLast: true
          })
        };
      }
      if (url.includes('/user/assignable/search')) {
        return { status: 200, json: async () => [] };
      }
      return { status: 200, json: async () => ({}) };
    });

    await storage.set('cp:TEST:settings', { migratedAt: '2026-11-01T00:00:00Z', modelVersion: 2 });
    await storage.set('cp:TEST:we:10001', {
      model: 2,
      issueKey: 'TEST-1',
      issueId: '10001',
      version: 1,
      effort: { workEffortId: 'TEST-1', sequenceNum: 1000 },
      grid: { startWeek: '05-Aug', spanWeeks: 3 },
      assocs: [],
      parties: []
    });
  });

  it('saves 5 story points and converted 40 h, sending only 40h to Jira (criteria 1 and 2)', async () => {
    const res = await updateWbsTask({
      projectKey: 'TEST',
      taskId: 'TEST-1',
      updates: {
        effortHours: 40,
        effortConfig: {
          unit: 'STORY_POINTS',
          rawEstimate: 5,
          totalCalculatedHours: 40
        }
      }
    }, storage);

    expect(res.ok).toBe(true);

    // Verify Jira PUT sent timetracking with originalEstimate 40h
    const putCalls = mockRequestJira.mock.calls.filter(c => c[1]?.method === 'PUT' && String(c[0]).includes('/rest/api/3/issue/TEST-1'));
    expect(putCalls.length).toBe(1);
    const putBody = JSON.parse(putCalls[0][1].body);
    expect(putBody.fields.timetracking).toEqual({ originalEstimate: '40h' });
    expect(putBody.fields.effortConfig).toBeUndefined();

    // Verify KVS stored estimate unit and rawEstimate
    const storedRec: any = await storage.get('cp:TEST:we:10001');
    expect(storedRec.estimate.estimateUnit).toBe('STORY_POINTS');
    expect(storedRec.estimate.rawEstimate).toBe(5);
    expect(storedRec.estimate.normalizedHours).toBe(40);

    // Verify getProjectPlan loads effortConfig with unit and rawEstimate intact
    const plan = await getProjectPlan('TEST', storage);
    const task = plan.tasks.find(t => t.key === 'TEST-1');
    expect(task?.key).toBe('TEST-1');
    expect(task?.effortHours).toBe(40);
    expect(task?.effortConfig?.unit).toBe('STORY_POINTS');
    expect(task?.effortConfig?.rawEstimate).toBe(5);
  });

  it('sends no timetracking write to Jira when estimate is unchanged (criterion 2)', async () => {
    // Seed task with existing story point estimate
    await storage.set('cp:TEST:we:10001', {
      model: 2,
      issueKey: 'TEST-1',
      issueId: '10001',
      version: 1,
      effort: { workEffortId: 'TEST-1', sequenceNum: 1000 },
      assocs: [],
      parties: [],
      estimate: {
        workEffortId: 'TEST-1',
        estimateUnit: 'STORY_POINTS',
        rawEstimate: 5,
        normalizedHours: 40,
        totalCalculatedHours: 40
      }
    });

    const res = await updateWbsTask({
      projectKey: 'TEST',
      taskId: 'TEST-1',
      updates: {
        summary: 'Updated Summary'
      }
    }, storage);

    expect(res.ok).toBe(true);
    const putCalls = mockRequestJira.mock.calls.filter(c => c[1]?.method === 'PUT' && String(c[0]).includes('/rest/api/3/issue/TEST-1'));
    expect(putCalls.length).toBe(1);
    const putBody = JSON.parse(putCalls[0][1].body);
    expect(putBody.fields.summary).toBe('Updated Summary');
    expect(putBody.fields.timetracking).toBeUndefined();
  });

  it('saves T-shirt size L and converted 32 h (criterion 1)', async () => {
    const res = await updateWbsTask({
      projectKey: 'TEST',
      taskId: 'TEST-1',
      updates: {
        effortHours: 32,
        effortConfig: {
          unit: 'TSHIRT',
          rawEstimate: 32,
          tshirtSize: 'L',
          totalCalculatedHours: 32
        }
      }
    }, storage);

    expect(res.ok).toBe(true);

    const putCalls = mockRequestJira.mock.calls.filter(c => c[1]?.method === 'PUT' && String(c[0]).includes('/rest/api/3/issue/TEST-1'));
    expect(putCalls.length).toBe(1);
    const putBody = JSON.parse(putCalls[0][1].body);
    expect(putBody.fields.timetracking).toEqual({ originalEstimate: '32h' });

    const plan = await getProjectPlan('TEST', storage);
    const task = plan.tasks.find(t => t.key === 'TEST-1');
    expect(task?.effortConfig?.unit).toBe('TSHIRT');
    expect(task?.effortConfig?.tshirtSize).toBe('L');
    expect(task?.effortConfig?.totalCalculatedHours).toBe(32);
  });

  it('sends no timetracking write when only unit changes and hours stay unchanged (criterion 2)', async () => {
    const res = await updateWbsTask({
      projectKey: 'TEST',
      taskId: 'TEST-1',
      updates: {
        effortConfig: {
          unit: 'STORY_POINTS',
          rawEstimate: 5,
          totalCalculatedHours: 40
        }
      }
    }, storage);

    expect(res.ok).toBe(true);
    const putCalls = mockRequestJira.mock.calls.filter(c => c[1]?.method === 'PUT' && String(c[0]).includes('/rest/api/3/issue/TEST-1'));
    expect(putCalls.length).toBe(0);

    const plan = await getProjectPlan('TEST', storage);
    const task = plan.tasks.find(t => t.key === 'TEST-1');
    expect(task?.effortConfig?.unit).toBe('STORY_POINTS');
    expect(task?.effortConfig?.rawEstimate).toBe(5);
  });
});
