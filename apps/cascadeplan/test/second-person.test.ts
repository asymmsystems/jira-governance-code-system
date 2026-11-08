/*
 * Copyright (c) 2026 Asymm Systems. All rights reserved.
 *
 * @author Fahim Farook
 */

/**
 * CascadePlan: One honest second person path tests (B-19).
 */

import {
  createInlineTask,
  createSubtaskForResource,
  updateWbsTask,
  setGlobalStorageProvider
} from '../src/index';
import { enteredAllocationHours, allocationCreatedText } from '../src/ui/second-person';
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

describe('second person path (B-19)', () => {
  let storage: MemStorage;

  beforeEach(async () => {
    storage = new MemStorage();
    setGlobalStorageProvider(storage);
    mockRequestJira.mockReset();

    mockRequestJira.mockImplementation(async (routeStr: any, opts?: any) => {
      const url = String(routeStr);
      if (url.includes('/rest/api/3/issue/')) {
        if (opts?.method === 'DELETE') {
          return { status: 204 };
        }
        if (opts?.method === 'PUT') {
          return { status: 200, json: async () => ({}) };
        }
        return { status: 200, json: async () => ({ id: '10001', key: 'TEST-1', fields: { project: { key: 'TEST' } } }) };
      }
      if (url.includes('/rest/api/3/issue')) {
        return {
          status: 201,
          json: async () => ({ id: '10099', key: 'TEST-99' })
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
                  summary: 'Parent task',
                  status: { name: 'To Do', statusCategory: { key: 'new' } },
                  issuetype: { name: 'Task', subtask: false },
                  project: { key: 'TEST' },
                  created: '2026-11-01T00:00:00Z',
                  updated: '2026-11-01T00:00:00Z'
                }
              }
            ],
            isLast: true
          })
        };
      }
      if (url.includes('/user/assignable/search')) {
        return {
          status: 200,
          json: async () => [
            { accountId: 'acc-jane', displayName: 'Jane Engineer' },
            { accountId: 'acc-bob', displayName: 'Bob Developer' }
          ]
        };
      }
      return { status: 200, json: async () => ({}) };
    });

    await storage.set('cp:TEST:settings', { migratedAt: '2026-11-01T00:00:00Z' });
    await storage.set('cp:TEST:we:10001', {
      model: 2,
      issueKey: 'TEST-1',
      issueId: '10001',
      version: 1,
      effort: { workEffortId: 'TEST-1', sequenceNum: 1000 },
      assocs: [],
      parties: []
    });
  });

  it('createInlineTask sends assignee.accountId and parent.key to Jira (criterion 3)', async () => {
    const res = await createInlineTask({
      projectKey: 'TEST',
      summary: 'Task under Epic',
      parentKey: 'EPIC-10',
      assigneeAccountId: 'acc-jane'
    }, storage);

    expect(res.ok).toBe(true);
    const postCalls = mockRequestJira.mock.calls.filter(c => c[1]?.method === 'POST' && String(c[0]).includes('/rest/api/3/issue'));
    expect(postCalls.length).toBeGreaterThan(0);
    const postBody = JSON.parse(postCalls[0][1].body);
    expect(postBody.fields.parent).toEqual({ key: 'EPIC-10' });
    expect(postBody.fields.assignee).toEqual({ accountId: 'acc-jane' });
  });

  it('createSubtaskForResource creates Jira subtask and records subtaskKey in parent contributors (criterion 1)', async () => {
    const res = await createSubtaskForResource({
      projectKey: 'TEST',
      parentKey: 'TEST-1',
      assigneeAccountId: 'acc-bob',
      assigneeName: 'Bob Developer',
      effortHours: 10
    }, storage);

    expect(res.ok).toBe(true);
    expect(res.subtask?.key).toBe('TEST-99');

    // Verify POST payload has parent and assignee
    const postCalls = mockRequestJira.mock.calls.filter(c => c[1]?.method === 'POST' && String(c[0]).includes('/rest/api/3/issue'));
    expect(postCalls.length).toBeGreaterThan(0);
    const postBody = JSON.parse(postCalls[0][1].body);
    expect(postBody.fields.parent).toEqual({ key: 'TEST-1' });
    expect(postBody.fields.assignee).toEqual({ accountId: 'acc-bob' });

    // Verify subtaskKey recorded in parent's stored contributors / parties
    const parentRec: any = await storage.get('cp:TEST:we:10001');
    const bobParty = parentRec.parties.find((p: any) => p.partyId === 'acc-bob');
    expect(bobParty?.partyId).toBe('acc-bob');
    expect(bobParty.subtaskKey).toBe('TEST-99');

    // Calling again updates existing contributor party
    const res2 = await createSubtaskForResource({
      projectKey: 'TEST',
      parentKey: 'TEST-1',
      assigneeAccountId: 'acc-bob',
      assigneeName: 'Bob Developer',
      effortHours: 15
    }, storage);
    expect(res2.ok).toBe(true);
    const parentRec2: any = await storage.get('cp:TEST:we:10001');
    const bobParty2 = parentRec2.parties.find((p: any) => p.partyId === 'acc-bob');
    expect(bobParty2.subtaskKey).toBe('TEST-99');
  });

  it('createSubtaskForResource with no hours sends no estimate to Jira (CP-1, INV-03)', async () => {
    const res = await createSubtaskForResource({
      projectKey: 'TEST',
      parentKey: 'TEST-1',
      assigneeAccountId: 'acc-bob',
      assigneeName: 'Bob Developer'
    }, storage);
    expect(res.ok).toBe(true);
    const postCalls = mockRequestJira.mock.calls.filter(c => c[1]?.method === 'POST' && /\/rest\/api\/3\/issue$/.test(String(c[0])));
    expect(postCalls.length).toBe(1);
    const fields = JSON.parse(postCalls[0][1].body).fields;
    expect(fields.timetracking).toBeUndefined();
    expect(JSON.stringify(fields)).not.toMatch(/originalEstimate|timeoriginalestimate/);
  });

  it('updateWbsTask creates Jira subtask when adding a contributor and records subtaskKey (criterion 1)', async () => {
    const res = await updateWbsTask({
      projectKey: 'TEST',
      taskId: 'TEST-1',
      updates: {
        contributors: [{ accountId: 'acc-jane' }]
      }
    }, storage);

    expect(res.ok).toBe(true);

    // Verify Jira POST call had parent and assignee
    const postCalls = mockRequestJira.mock.calls.filter(c => c[1]?.method === 'POST' && String(c[0]).includes('/rest/api/3/issue'));
    expect(postCalls.length).toBeGreaterThan(0);
    const postBody = JSON.parse(postCalls[0][1].body);
    expect(postBody.fields.parent).toEqual({ key: 'TEST-1' });
    expect(postBody.fields.assignee).toEqual({ accountId: 'acc-jane' });

    // Verify subtaskKey stored on parent record
    const parentRec: any = await storage.get('cp:TEST:we:10001');
    const janeParty = parentRec.parties.find((p: any) => p.partyId === 'acc-jane');
    expect(janeParty?.partyId).toBe('acc-jane');
    expect(janeParty.subtaskKey).toBe('TEST-99');
  });

  it('updateWbsTask deletes subtask on explicit choice (criterion 2)', async () => {
    // Seed parent with contributor holding subtaskKey
    await storage.set('cp:TEST:we:10001', {
      model: 2,
      issueKey: 'TEST-1',
      issueId: '10001',
      version: 1,
      effort: { workEffortId: 'TEST-1', sequenceNum: 1000 },
      assocs: [],
      parties: [{ workEffortId: 'TEST-1', partyId: 'acc-jane', roleTypeId: 'CONTRIBUTOR', fromDate: '2026-11-01', subtaskKey: 'TEST-99' }]
    });

    const res = await updateWbsTask({
      projectKey: 'TEST',
      taskId: 'TEST-1',
      updates: {
        contributors: [],
        removeSubtaskAction: { subtaskKey: 'TEST-99', action: 'delete' }
      }
    }, storage);

    expect(res.ok).toBe(true);
    const deleteCalls = mockRequestJira.mock.calls.filter(c => c[1]?.method === 'DELETE');
    expect(deleteCalls.length).toBe(1);
    expect(String(deleteCalls[0][0])).toContain('TEST-99');
  });

  it('updateWbsTask unassigns subtask on explicit choice (criterion 2)', async () => {
    await storage.set('cp:TEST:we:10001', {
      model: 2,
      issueKey: 'TEST-1',
      issueId: '10001',
      version: 1,
      effort: { workEffortId: 'TEST-1', sequenceNum: 1000 },
      assocs: [],
      parties: [{ workEffortId: 'TEST-1', partyId: 'acc-jane', roleTypeId: 'CONTRIBUTOR', fromDate: '2026-11-01', subtaskKey: 'TEST-99' }]
    });

    const res = await updateWbsTask({
      projectKey: 'TEST',
      taskId: 'TEST-1',
      updates: {
        contributors: [],
        removeSubtaskAction: { subtaskKey: 'TEST-99', action: 'unassign' }
      }
    }, storage);

    expect(res.ok).toBe(true);
    const putCalls = mockRequestJira.mock.calls.filter(c => c[1]?.method === 'PUT' && String(c[0]).includes('/rest/api/3/issue/TEST-99'));
    expect(putCalls.length).toBe(1);
    expect(JSON.parse(putCalls[0][1].body).fields.assignee).toBeNull();
  });
});

describe('"+ Allocate Resource" hours and status text (CP-1)', () => {
  it('an empty field, blanks and values that are not positive whole numbers send no estimate', () => {
    for (const raw of ['', '   ', null, undefined, '0', '-4', 'abc']) expect(enteredAllocationHours(raw as any)).toBeUndefined();
    expect(enteredAllocationHours('20')).toBe(20);
    expect(enteredAllocationHours(' 8 ')).toBe(8);
    expect(enteredAllocationHours('7.5')).toBe(7);
  });

  it('the status names the hours only when an estimate was sent, never "undefinedh"', () => {
    expect(allocationCreatedText('Bob Developer', 20)).toBe('✓ Created Jira subtask for Bob Developer (20h)');
    expect(allocationCreatedText('Bob Developer', undefined)).toBe('✓ Created Jira subtask for Bob Developer, with no estimate');
    expect(allocationCreatedText('', undefined)).toBe('✓ Created Jira subtask for Unassigned, with no estimate');
    expect(allocationCreatedText('Bob Developer', undefined)).not.toMatch(/undefined/);
  });
});
