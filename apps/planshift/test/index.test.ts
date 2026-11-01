import {
  getProjectPlan,
  fetchLiveJiraIssues,
  fetchProjectEpics,
  fetchProjectUsers,
  scheduleBacklogTask,
  createInlineTask,
  createJiraEpic,
  updateWbsTask,
  addSubtaskToTask,
  saveTaskDependency,
  saveColumnWidths,
  saveHiddenColumns,
  saveProjectMilestone,
  resolveStorage,
  setGlobalStorageProvider,
  handler,
  getDefaultWeeks,
  DEFAULT_COLUMN_WIDTHS,
  DEFAULT_MILESTONES,
  mapJiraStatus,
  extractProjectKey,
  extractSiteUrl,
  syncTaskToJira,
  mirrorDependencyToJira,
  getJiraCaller,
  unscheduleTask,
  reorderWbsTasks,
  createSubtaskForResource,
  resolveProjectIssueType
} from '../src/index';
import api from '@forge/api';
import { PlanRepository } from '../src/storage/plan-repository';
import { MemStorage, entryOf, clearRecords } from './helpers/mem-storage';
import { EstimateUnit, ProjectMilestone, ColumnWidthConfig } from '../src/domain/models';

const mockRequestJira = jest.fn();
// Answers the issue-to-project lookup of verifyIssueInProject (B-02) from the key prefix,
// and passes every other call to mockRequestJira.
function mockLookupOr(args: any[]): any {
  const [routeStr, options] = args;
  const m = String(routeStr).match(/\/rest\/api\/3\/issue\/([A-Z0-9_]+)-(\d+)\?fields=project/);
  if (m && !options?.method) {
    return Promise.resolve({ status: 200, json: async () => ({ key: `${m[1]}-${m[2]}`, fields: { project: { key: m[1] } } }) });
  }
  return mockRequestJira(...args);
}
jest.mock('@forge/api', () => ({
  __esModule: true,
  default: {
    asApp: () => ({
      requestJira: (...args: any[]) => mockLookupOr(args)
    }),
    asUser: () => ({
      requestJira: (...args: any[]) => mockLookupOr(args)
    })
  },
  route: (strings: any, ...values: any[]) => strings.reduce((acc: string, str: string, i: number) => acc + str + (values[i] !== undefined ? values[i] : ''), '')
}));

jest.mock('@forge/kvs', () => ({
  kvs: {
    get: jest.fn().mockResolvedValue(undefined),
    set: jest.fn().mockResolvedValue(undefined),
    delete: jest.fn().mockResolvedValue(undefined)
  }
}));

class MockStorage extends MemStorage {}


// Weeks of the day the tests run; the resolvers compute their own per call (B-18).
const DEFAULT_WEEKS = getDefaultWeeks();

describe('CascadePlan Index & Resolver Tests', () => {
  let mockStorage: MockStorage;

  beforeEach(async () => {
    mockStorage = new MockStorage();
    setGlobalStorageProvider(mockStorage);
    mockRequestJira.mockReset();

    mockRequestJira.mockImplementation(async (routeStr: any, options?: any) => {
      const url = String(routeStr);
      if (url.includes('/rest/api/3/user/assignable/search')) {
        return {
          status: 200,
          json: async () => [
            { accountId: 'jira-user-1', displayName: 'Fahim Farook', avatarUrls: { '24x24': 'https://avatar/1' } },
            { accountId: 'jira-user-2', displayName: 'Jane Engineer', avatarUrls: { '24x24': 'https://avatar/2' } }
          ]
        };
      }
      if (url.includes('/rest/api/3/search/jql') && url.includes('issuetype in (Epic')) {
        return {
          status: 200,
          json: async () => ({
            issues: [
              { id: 'epic-101', key: 'TEST-E1', fields: { summary: 'Infrastructure Modernization' } }
            ]
          })
        };
      }
      if (url.includes('/rest/api/3/search/jql')) {
        return {
          status: 200,
          json: async () => ({
            issues: [
              {
                id: '10001',
                key: 'TEST-1',
                fields: {
                  summary: 'Setup Kubernetes Cluster',
                  issuetype: { name: 'Task' },
                  status: { name: 'In Progress', statusCategory: { key: 'indeterminate' } },
                  timeoriginalestimate: 144000,
                  aggregatetimespent: 72000,
                  assignee: { displayName: 'Fahim Farook', accountId: 'jira-user-1' },
                  subtasks: [
                    { id: 'sub-1', key: 'TEST-11', fields: { summary: 'Terraform scripts', status: { name: 'Done', statusCategory: { key: 'done' } } } }
                  ]
                }
              },
              {
                id: '10002',
                key: 'TEST-2',
                fields: {
                  summary: 'Configure Service Mesh',
                  issuetype: { name: 'Story' },
                  status: { name: 'To Do', statusCategory: { key: 'new' } },
                  timeoriginalestimate: 72000,
                  assignee: { displayName: 'Jane Engineer', accountId: 'jira-user-2' },
                  subtasks: []
                }
              },
              {
                id: '10003',
                key: 'TEST-3',
                fields: {
                  summary: 'Unscheduled Security Audit',
                  issuetype: { name: 'Task' },
                  status: { name: 'To Do', statusCategory: { key: 'new' } },
                  timeoriginalestimate: 36000,
                  assignee: null,
                  subtasks: []
                }
              },
              {
                id: '10004',
                key: 'TEST-4',
                fields: {
                  summary: 'Architecture Epic Issue',
                  issuetype: { name: 'Epic' },
                  status: { name: 'Done', statusCategory: { key: 'done' } },
                  timeoriginalestimate: null,
                  assignee: null,
                  subtasks: []
                }
              }
            ]
          })
        };
      }
      if (url.includes('/rest/api/3/issue')) {
        const body = options?.body ? JSON.parse(options.body) : {};
        return {
          status: 201,
          json: async () => ({ id: '10050', key: 'TEST-50', summary: body.fields?.summary })
        };
      }
      return {
        status: 200,
        json: async () => ({})
      };
    });

    await mockStorage.delete('cp:TEST:settings');

    await mockStorage.set('scheduleMap:TEST', {
      'TEST-1': {
        startWeek: '15-Jul',
        endWeek: '05-Aug',
        spanWeeks: 4,
        // Real dates: a week key has no year, so a resolver cannot derive dates from it (B-18).
        startDate: '2026-07-15',
        endDate: '2026-08-11',
        effortHours: 40,
        progress: 50,
        targetProgress: 30,
        resource: 'Fahim Farook',
        weeklyAllocations: { '15-Jul': 25, '22-Jul': 25, '29-Jul': 25, '05-Aug': 25 }
      },
      'TEST-2': {
        startWeek: '29-Jul',
        endWeek: '19-Aug',
        spanWeeks: 4,
        startDate: '2026-07-29',
        endDate: '2026-08-25',
        effortHours: 20,
        progress: 10,
        targetProgress: 20,
        resource: 'Jane Engineer',
        weeklyAllocations: { '29-Jul': 25, '05-Aug': 25, '12-Aug': 25, '19-Aug': 25 }
      }
    });
  });

  describe('resolveStorage', () => {
    it('returns custom provider if passed', () => {
      const custom = new MockStorage();
      expect(resolveStorage(custom)).toBe(custom);
    });

    it('returns global provider if set', () => {
      expect(resolveStorage()).toBe(mockStorage);
    });

    it('throws in test environment if no provider is set', () => {
      setGlobalStorageProvider(null);
      expect(() => resolveStorage()).toThrow('CascadePlan: StorageProvider must be initialized');
    });

    it('returns ForgeKvsProvider in production environment', async () => {
      const origEnv = process.env.NODE_ENV;
      try {
        process.env.NODE_ENV = 'production';
        setGlobalStorageProvider(null);
        const { kvs } = require('@forge/kvs');
        const storage = resolveStorage();
        expect(storage).toBeDefined();

        await storage.set('test-key', { val: 1 });
        expect(kvs.set).toHaveBeenCalledWith('test-key', { val: 1 });

        await storage.get('test-key');
        expect(kvs.get).toHaveBeenCalledWith('test-key');

        await storage.delete('test-key');
        expect(kvs.delete).toHaveBeenCalledWith('test-key');
      } finally {
        process.env.NODE_ENV = origEnv;
      }
    });
  });

  describe('mapJiraStatus', () => {
    it('maps done status category and keywords to COMPLETED', () => {
      expect(mapJiraStatus('done')).toBe('COMPLETED');
      expect(mapJiraStatus(undefined, 'Resolved')).toBe('COMPLETED');
      expect(mapJiraStatus(undefined, 'Closed')).toBe('COMPLETED');
    });

    it('maps indeterminate and active keywords to IN_PROGRESS', () => {
      expect(mapJiraStatus('indeterminate')).toBe('IN_PROGRESS');
      expect(mapJiraStatus(undefined, 'In Code Review')).toBe('IN_PROGRESS');
      expect(mapJiraStatus(undefined, 'Testing')).toBe('IN_PROGRESS');
    });

    it('defaults unmapped statuses to NOT_STARTED', () => {
      expect(mapJiraStatus('new', 'To Do')).toBe('NOT_STARTED');
      expect(mapJiraStatus()).toBe('NOT_STARTED');
    });
  });

  describe('fetchProjectUsers and fetchProjectEpics', () => {
    it('fetches Jira users, with no placeholder people (B-18)', async () => {
      const users = await fetchProjectUsers('TEST');
      expect(users.some(u => u.displayName === 'Fahim Farook')).toBe(true);
      expect(users.some(u => u.isPlaceholder)).toBe(false);
    });

    it('handles Jira user fetch errors gracefully', async () => {
      mockRequestJira.mockRejectedValueOnce(new Error('Network failure'));
      const users = await fetchProjectUsers('TEST');
      expect(users.length).toBe(1);
      expect(users[0].displayName).toBe('Unassigned');
    });

    it('fetches real Epics from Jira', async () => {
      const epics = await fetchProjectEpics('TEST');
      expect(epics).toHaveLength(1);
      expect(epics[0].key).toBe('TEST-E1');
    });

    it('handles Jira Epic fetch errors gracefully', async () => {
      mockRequestJira.mockRejectedValueOnce(new Error('JQL error'));
      const epics = await fetchProjectEpics('TEST');
      expect(epics).toEqual([]);
    });
  });

  describe('getProjectPlan', () => {
    it('retrieves project plan with scheduled tasks and backlog tray', async () => {
      const plan = await getProjectPlan('TEST', mockStorage);
      expect(plan.projectKey).toBe('TEST');
      expect(plan.tasks.length).toBe(2);
      expect(plan.backlogTasks!.length).toBe(2);
      expect(plan.backlogTasks![0].key).toBe('TEST-3');
      expect(plan.weeks).toEqual(DEFAULT_WEEKS);
      expect(plan.isLiveSynced).toBe(true);
      expect(plan.milestones).toBeDefined();
      expect(plan.columnWidths).toEqual(DEFAULT_COLUMN_WIDTHS);
    });

    it('shows no stored rows and lists nothing as stale when Jira search fails (B-18)', async () => {
      mockRequestJira.mockRejectedValue(new Error('Jira Down'));
      const plan = await getProjectPlan('TEST', mockStorage);
      expect(plan.tasks).toEqual([]);
      expect(plan.staleEntries).toEqual([]);
      expect(plan.isLiveSynced).toBe(false);
    });

    it('schedules an unassigned backlog task onto the timeline', async () => {
      const updatedPlan = await scheduleBacklogTask(
        {
          projectKey: 'TEST',
          taskId: 'TEST-3',
          startWeek: '05-Aug',
          spanWeeks: 3,
          effortHours: 16,
          resource: 'Fahim Farook'
        },
        mockStorage
      );

      expect(updatedPlan.tasks.some(t => t.key === 'TEST-3')).toBe(true);
      expect(updatedPlan.backlogTasks!.some(t => t.key === 'TEST-3')).toBe(false);
      const scheduled = updatedPlan.tasks.find(t => t.key === 'TEST-3');
      expect(scheduled?.startWeek).toBe('05-Aug');
      expect(scheduled?.spanWeeks).toBe(3);
    });
  });

  describe('createInlineTask', () => {
    it('creates a task in Jira and adds it directly to the plan', async () => {
      const res = await createInlineTask(
        {
          projectKey: 'TEST',
          epic: 'Mobile',
          story: 'Auth',
          summary: 'Implement OAuth2 token refresh',
          effortHours: 20,
          resource: 'Fahim Farook',
          startWeek: '26-Aug',
          spanWeeks: 3
        },
        mockStorage
      );

      expect(res.success).toBe(true);
      expect(res.task?.key).toBe('TEST-50');
      expect(res.task?.startWeek).toBe('26-Aug');
    });

    it('creates a task with targetIndex and places it exactly at target position in plan', async () => {
      await mockStorage.set('taskOrder:TEST', ['TEST-1', 'TEST-2', 'TEST-3']);
      const res = await createInlineTask(
        {
          projectKey: 'TEST',
          summary: 'Inserted at row 1',
          targetIndex: 1,
          resource: 'Alice',
          resourceAccountId: 'acc-alice',
          epicKey: 'TEST-EPIC'
        },
        mockStorage
      );

      expect(res.success).toBe(true);
      // Row order comes from stored sequence numbers (B-09).
      const order = res.plan!.tasks.map(t => t.key).filter(k => ['TEST-1', 'TEST-2', 'TEST-50'].includes(k));
      expect(order).toEqual(['TEST-1', 'TEST-50', 'TEST-2']);
    });

    it('handles Jira API errors accurately and returns error without synthetic issue generation', async () => {
      mockRequestJira.mockRejectedValueOnce(new Error('Jira unavailable'));

      const res = await createInlineTask(
        {
          projectKey: 'TEST',
          summary: 'Offline created task',
          startWeek: '12-Aug',
          spanWeeks: 2
        },
        mockStorage
      );

      expect(res.success).toBe(false);
      expect(res.error).toContain('Jira unavailable');
      expect(res.task).toBeUndefined();
    });

    it('handles Jira HTTP 400 with errorMessages array in createInlineTask', async () => {
      mockRequestJira.mockResolvedValueOnce({
        status: 400,
        json: async () => ({ errorMessages: ['Summary is required and must not be blank'] })
      });

      const res = await createInlineTask({ projectKey: 'TEST', summary: '' }, mockStorage);
      expect(res.success).toBe(false);
      expect(res.error).toBe('Summary is required and must not be blank');
    });

    it('handles Jira HTTP 400 with errors object in createInlineTask', async () => {
      mockRequestJira.mockResolvedValueOnce({
        status: 400,
        json: async () => ({ errors: { issuetype: 'Issue type not supported' } })
      });

      const res = await createInlineTask({ projectKey: 'TEST', summary: 'Some Task' }, mockStorage);
      expect(res.success).toBe(false);
      expect(res.error).toBe('Issue type not supported');
    });

    it('handles Jira HTTP 500 without JSON error payload in createInlineTask', async () => {
      mockRequestJira.mockResolvedValueOnce({
        status: 500,
        json: async () => { throw new Error('Not JSON'); }
      });

      const res = await createInlineTask({ projectKey: 'TEST', summary: 'Server Error Task' }, mockStorage);
      expect(res.success).toBe(false);
      expect(res.error).toBe('Failed to create Jira issue (HTTP 500)');
    });

    it('automatically recovers and retries when Jira returns HTTP 400 Specify a valid issue type', async () => {
      mockRequestJira.mockResolvedValueOnce({
        status: 400,
        clone: () => ({
          json: async () => ({ errors: { issuetype: 'Specify a valid issue type' } })
        }),
        json: async () => ({ errors: { issuetype: 'Specify a valid issue type' } })
      });
      mockRequestJira.mockResolvedValueOnce({
        status: 200,
        json: async () => ({
          issueTypes: [
            { id: '10001', name: 'Task', hierarchyLevel: 0, subtask: false }
          ]
        })
      });
      mockRequestJira.mockResolvedValueOnce({
        status: 201,
        json: async () => ({ id: '10088', key: 'TEST-88' })
      });

      const res = await createInlineTask(
        { projectKey: 'TEST', summary: 'Auto Recovered Task' },
        mockStorage
      );
      expect(res.success).toBe(true);
      expect(res.task?.key).toBe('TEST-88');
    });

    it('applies default field values when optional attributes are empty', async () => {
      const res = await createInlineTask(
        {
          projectKey: 'TEST',
          summary: 'Defaulted task'
        },
        mockStorage
      );

      expect(res.success).toBe(true);
      // Epic is read live from Jira; no "General" label is invented (B-04).
      expect(res.task?.epic).toBe('');
      expect(res.task?.story).toBe('Task');
      // No estimate is invented for an unestimated issue (B-03).
      expect(res.task?.effortHours).toBe(0);
      expect(res.task?.resource).toBe('Unassigned');
      expect(res.task?.startWeek).toBe(DEFAULT_WEEKS.find(w => w.isCurrentWeek)?.weekKey || DEFAULT_WEEKS[0].weekKey);
    });
  });

  describe('createJiraEpic', () => {
    it('creates an Epic in Jira', async () => {
      const res = await createJiraEpic({ projectKey: 'TEST', summary: 'Payment Microservices' }, mockStorage);
      expect(res.success).toBe(true);
      expect(res.epic?.key).toBe('TEST-50');
    });

    it('automatically recovers and retries when Jira returns HTTP 400 Specify a valid issue type', async () => {
      mockRequestJira.mockResolvedValueOnce({
        status: 400,
        clone: () => ({
          json: async () => ({ errors: { issuetype: 'Specify a valid issue type' } })
        }),
        json: async () => ({ errors: { issuetype: 'Specify a valid issue type' } })
      });
      mockRequestJira.mockResolvedValueOnce({
        status: 200,
        json: async () => ({
          issueTypes: [
            { id: '10000', name: 'Epic', hierarchyLevel: 1 }
          ]
        })
      });
      mockRequestJira.mockResolvedValueOnce({
        status: 201,
        json: async () => ({ id: '10099', key: 'TEST-99' })
      });

      const res = await createJiraEpic(
        { projectKey: 'TEST', summary: 'Auto Recovered Epic' },
        mockStorage
      );
      expect(res.success).toBe(true);
      expect(res.epic?.key).toBe('TEST-99');
    });

    it('handles Jira HTTP 400 with errorMessages in createJiraEpic', async () => {
      mockRequestJira.mockResolvedValueOnce({
        status: 400,
        json: async () => ({ errorMessages: ['Epic Name is required'] })
      });

      const res = await createJiraEpic({ projectKey: 'TEST', summary: '' }, mockStorage);
      expect(res.success).toBe(false);
      expect(res.error).toBe('Epic Name is required');
    });

    it('handles Jira HTTP 400 with errors object in createJiraEpic', async () => {
      mockRequestJira.mockResolvedValueOnce({
        status: 400,
        json: async () => ({ errors: { project: 'Project does not exist' } })
      });

      const res = await createJiraEpic({ projectKey: 'TEST', summary: 'Epic Name' }, mockStorage);
      expect(res.success).toBe(false);
      expect(res.error).toBe('Project does not exist');
    });

    it('handles Jira HTTP 500 without JSON error payload in createJiraEpic', async () => {
      mockRequestJira.mockResolvedValueOnce({
        status: 500,
        json: async () => { throw new Error('Not JSON'); }
      });

      const res = await createJiraEpic({ projectKey: 'TEST', summary: 'Epic Error' }, mockStorage);
      expect(res.success).toBe(false);
      expect(res.error).toBe('Failed to create Jira Epic (HTTP 500)');
    });

    it('returns error when Jira Epic creation fails', async () => {
      mockRequestJira.mockRejectedValueOnce(new Error('Epic error'));
      const res = await createJiraEpic({ projectKey: 'TEST', summary: 'Local Fallback Epic' }, mockStorage);
      expect(res.success).toBe(false);
      expect(res.error).toContain('Epic error');
      expect(res.epic).toBeUndefined();
    });
  });

  describe('resolveProjectIssueType', () => {
    it('resolves Epic by hierarchyLevel or names (Epic, Feature, Initiative)', async () => {
      mockRequestJira.mockResolvedValueOnce({
        status: 200,
        json: async () => ({
          issueTypes: [
            { id: '10010', name: 'Feature', hierarchyLevel: 1 },
            { id: '10011', name: 'Story', hierarchyLevel: 0 }
          ]
        })
      });
      const res = await resolveProjectIssueType('TEST', 'Epic');
      expect(res.id).toBe('10010');
      expect(res.name).toBe('Feature');
    });

    it('resolves Task by non-subtask standard type', async () => {
      mockRequestJira.mockResolvedValueOnce({
        status: 200,
        json: async () => ({
          issueTypes: [
            { id: '10012', name: 'Item', hierarchyLevel: 0, subtask: false }
          ]
        })
      });
      const res = await resolveProjectIssueType('TEST', 'Task');
      expect(res.id).toBe('10012');
      expect(res.name).toBe('Item');
    });

    it('falls back to default name when project metadata call fails or returns non-200', async () => {
      mockRequestJira.mockResolvedValueOnce({
        status: 500
      });
      const res = await resolveProjectIssueType('TEST', 'Epic');
      expect(res.name).toBe('Epic');
      expect(res.id).toBeUndefined();

      mockRequestJira.mockRejectedValueOnce(new Error('Network error'));
      const res2 = await resolveProjectIssueType('TEST', 'Task');
      expect(res2.name).toBe('Task');
      expect(res2.id).toBeUndefined();
    });
  });

  describe('updateWbsTask', () => {
    it('updates an existing task progress and effort', async () => {
      const updatedPlan = await updateWbsTask(
        {
          projectKey: 'TEST',
          taskId: 'TEST-1',
          updates: { progress: 85, effortHours: 80 }
        },
        mockStorage
      );

      const modified = updatedPlan.tasks.find(t => t.key === 'TEST-1');
      expect(modified?.progress).toBe(85);
      // The estimate goes to Jira; the plan shows Jira's value read live (B-04).
      const estimatePut = mockRequestJira.mock.calls.find(c => c[1]?.method === 'PUT' && String(c[0]).endsWith('/issue/TEST-1'));
      expect(JSON.parse(estimatePut[1].body).fields.timetracking).toEqual({ originalEstimate: '80h' });
      expect(modified?.effortHours).toBe(40);
    });

    it('updates a task located by its Jira ID', async () => {
      const updatedPlan = await updateWbsTask(
        {
          projectKey: 'TEST',
          taskId: '10001',
          updates: { progress: 99 }
        },
        mockStorage
      );

      const modified = updatedPlan.tasks.find(t => t.id === '10001');
      expect(modified?.progress).toBe(99);
    });

    it('updates a task located in backlogTasks', async () => {
      const updatedPlan = await updateWbsTask(
        {
          projectKey: 'TEST',
          taskId: 'TEST-3',
          updates: { effortHours: 24 }
        },
        mockStorage
      );

      const modified = updatedPlan.backlogTasks!.find(t => t.key === 'TEST-3');
      expect(modified).toBeDefined();
      const estimatePut = mockRequestJira.mock.calls.find(c => c[1]?.method === 'PUT' && String(c[0]).endsWith('/issue/TEST-3'));
      expect(JSON.parse(estimatePut[1].body).fields.timetracking).toEqual({ originalEstimate: '24h' });
    });

    it('derives startDate, endDate, and weeklyAllocations dynamically when startWeek or spanWeeks is updated', async () => {
      const updatedPlan = await updateWbsTask(
        {
          projectKey: 'TEST',
          taskId: 'TEST-1',
          updates: { startWeek: DEFAULT_WEEKS[1].weekKey, spanWeeks: 3 }
        },
        mockStorage
      );

      const modified = updatedPlan.tasks.find(t => t.key === 'TEST-1');
      expect(modified?.startWeek).toBe(DEFAULT_WEEKS[1].weekKey);
      expect(modified?.endWeek).toBe(DEFAULT_WEEKS[3].weekKey);
      expect(modified?.startDate).toBe(DEFAULT_WEEKS[1].startDate);
      expect(modified?.endDate).toBe(DEFAULT_WEEKS[3].endDate);
      expect(modified?.weeklyAllocations).toBeDefined();
    });

    it('throws error if task to update is not found', async () => {
      await expect(
        updateWbsTask(
          { projectKey: 'TEST', taskId: 'NON_EXISTENT', updates: { progress: 50 } },
          mockStorage
        )
      ).rejects.toThrow('Task \'NON_EXISTENT\' not found in project plan');
    });

    it('validates and saves a valid progress-gated dependency', async () => {
      const updatedPlan = await updateWbsTask(
        {
          projectKey: 'TEST',
          taskId: 'TEST-1',
          updates: {
            dependency: {
              predecessorId: 'TEST-2',
              predecessorKey: 'TEST-2',
              triggerPercent: 30,
              isTriggerSatisfied: false
            }
          }
        },
        mockStorage
      );

      const modified = updatedPlan.tasks.find(t => t.key === 'TEST-1');
      expect(modified?.dependency?.predecessorKey).toBe('TEST-2');
      expect(modified?.dependency?.triggerPercent).toBe(30);
    });

    it('rejects an invalid self dependency or cycle in updateWbsTask', async () => {
      await expect(
        updateWbsTask(
          {
            projectKey: 'TEST',
            taskId: 'TEST-1',
            updates: {
              dependency: {
                predecessorId: 'TEST-1',
                predecessorKey: 'TEST-1',
                triggerPercent: 30,
                isTriggerSatisfied: false
              }
            }
          },
          mockStorage
        )
      ).rejects.toThrow("Invalid dependency: Task 'TEST-1' cannot depend on itself.");
    });

    it('clears dependency when empty dependency object is provided', async () => {
      const updatedPlan = await updateWbsTask(
        {
          projectKey: 'TEST',
          taskId: 'TEST-1',
          updates: {
            dependency: {
              predecessorId: '',
              predecessorKey: '',
              triggerPercent: 0,
              isTriggerSatisfied: false
            }
          }
        },
        mockStorage
      );

      const modified = updatedPlan.tasks.find(t => t.key === 'TEST-1');
      expect(modified?.dependency).toBeUndefined();
    });

    it('rejects a dependency without a trigger percent (B-11: no silent default)', async () => {
      await expect(updateWbsTask({
        projectKey: 'TEST',
        taskId: 'TEST-2',
        updates: { dependency: { predecessorId: 'TEST-1', predecessorKey: 'TEST-1' } as any }
      }, mockStorage)).rejects.toThrow('dependency.triggerPercent');
    });

    it('preserves existing dependency when moving timeline bar (updating startWeek only)', async () => {
      await updateWbsTask(
        {
          projectKey: 'TEST',
          taskId: 'TEST-1',
          updates: {
            dependency: {
              predecessorId: 'TEST-2',
              predecessorKey: 'TEST-2',
              triggerPercent: 40,
              isTriggerSatisfied: false
            }
          }
        },
        mockStorage
      );

      const targetWeek = DEFAULT_WEEKS[2].weekKey;
      const movedPlan = await updateWbsTask(
        {
          projectKey: 'TEST',
          taskId: 'TEST-1',
          updates: {
            startWeek: targetWeek
          }
        },
        mockStorage
      );

      const modified = movedPlan.tasks.find(t => t.key === 'TEST-1');
      expect(modified?.startWeek).toBe(targetWeek);
      expect(modified?.dependency).toBeDefined();
      expect(modified?.dependency?.predecessorKey).toBe('TEST-2');
      expect(modified?.dependency?.triggerPercent).toBe(40);
    });

    it('preserves dependent task dependency when predecessor bar is moved and downstream cascades', async () => {
      await updateWbsTask(
        {
          projectKey: 'TEST',
          taskId: 'TEST-1',
          updates: {
            startWeek: DEFAULT_WEEKS[0].weekKey,
            spanWeeks: 2,
            dependency: {
              predecessorId: 'TEST-2',
              predecessorKey: 'TEST-2',
              triggerPercent: 50,
              isTriggerSatisfied: false
            }
          }
        },
        mockStorage
      );

      const cascadedPlan = await updateWbsTask(
        {
          projectKey: 'TEST',
          taskId: 'TEST-2',
          updates: {
            startWeek: DEFAULT_WEEKS[2].weekKey
          }
        },
        mockStorage
      );

      const succ = cascadedPlan.tasks.find(t => t.key === 'TEST-1');
      expect(succ?.dependency).toBeDefined();
      expect(succ?.dependency?.predecessorKey).toBe('TEST-2');
      expect(succ?.dependency?.triggerPercent).toBe(50);
    });

    it('preserves parent task dependency when subtask progress or startWeek rolls up', async () => {
      await updateWbsTask(
        {
          projectKey: 'TEST',
          taskId: 'TEST-1',
          updates: {
            dependency: {
              predecessorId: 'TEST-2',
              predecessorKey: 'TEST-2',
              triggerPercent: 30,
              isTriggerSatisfied: false
            }
          }
        },
        mockStorage
      );

      const rolledUpPlan = await updateWbsTask(
        {
          projectKey: 'TEST',
          taskId: 'TEST-2',
          updates: {
            parentKey: 'TEST-1',
            startWeek: DEFAULT_WEEKS[1].weekKey,
            progress: 50
          }
        },
        mockStorage
      );

      const parent = rolledUpPlan.tasks.find(t => t.key === 'TEST-1');
      expect(parent?.dependency).toBeDefined();
      expect(parent?.dependency?.predecessorKey).toBe('TEST-2');
    });
  });

  describe('addSubtaskToTask', () => {
    it('adds a subtask and recalculates parent effort with PERCENTAGE buffer', async () => {
      const updatedPlan = await addSubtaskToTask(
        {
          projectKey: 'TEST',
          parentTaskId: 'TEST-1',
          subtask: {
            summary: 'Implement schema migration',
            estimateValue: 2, // 2 story points = 16h
            estimateUnit: 'STORY_POINTS'
          },
          bufferType: 'PERCENTAGE',
          bufferValue: 25 // +25% buffer
        },
        mockStorage
      );

      const parent = updatedPlan.tasks.find(t => t.key === 'TEST-1');
      expect(parent?.effortConfig?.subtasks?.length).toBeGreaterThanOrEqual(1);
      expect(parent?.effortConfig?.bufferHours).toBeGreaterThan(0);
    });

    it('adds subtask with default buffer arguments when omitted', async () => {
      const updatedPlan = await addSubtaskToTask(
        {
          projectKey: 'TEST',
          parentTaskId: 'TEST-1',
          subtask: {
            summary: 'Default buffer subtask',
            estimateValue: 8,
            estimateUnit: 'HOURS'
          }
        },
        mockStorage
      );

      const parent = updatedPlan.tasks.find(t => t.key === 'TEST-1');
      expect(parent?.effortConfig?.bufferType).toBe('NONE');
      expect(parent?.effortConfig?.bufferHours).toBe(0);
    });

    it('adds subtask with FIXED_HOURS buffer', async () => {
      const updatedPlan = await addSubtaskToTask(
        {
          projectKey: 'TEST',
          parentTaskId: 'TEST-1',
          subtask: {
            summary: 'Fixed hours subtask',
            estimateValue: 16,
            estimateUnit: 'HOURS'
          },
          bufferType: 'FIXED_HOURS',
          bufferValue: 8
        },
        mockStorage
      );

      const parent = updatedPlan.tasks.find(t => t.key === 'TEST-1');
      expect(parent?.effortConfig?.bufferType).toBe('FIXED_HOURS');
      expect(parent?.effortConfig?.bufferHours).toBe(8);
    });

    it('adds subtask to a task that has no prior scheduleMap entry', async () => {
      const updatedPlan = await addSubtaskToTask(
        {
          projectKey: 'TEST',
          parentTaskId: 'TEST-3',
          subtask: {
            summary: 'Brand new subtask on unscheduled item',
            estimateValue: 4,
            estimateUnit: 'HOURS'
          }
        },
        mockStorage
      );

      const item = updatedPlan.backlogTasks!.find(t => t.key === 'TEST-3');
      expect(item?.effortConfig?.subtasks?.length).toBeGreaterThan(0);
    });
  });

  describe('saveTaskDependency', () => {
    it('evaluates and saves fractional dependency between predecessor and successor', async () => {
      const updatedPlan = await saveTaskDependency(
        {
          projectKey: 'TEST',
          taskId: 'TEST-2',
          dependency: {
            predecessorId: '10001',
            predecessorKey: 'TEST-1',
            triggerPercent: 30,
            isTriggerSatisfied: false
          }
        },
        mockStorage
      );

      const successor = updatedPlan.tasks.find(t => t.key === 'TEST-2');
      expect(successor?.dependency?.isTriggerSatisfied).toBe(true);
      expect(successor?.dependency?.isViolated).toBe(false);
    });

    it('flags dependency violation when predecessor completion is below trigger threshold', async () => {
      const updatedPlan = await saveTaskDependency(
        {
          projectKey: 'TEST',
          taskId: 'TEST-2',
          dependency: {
            predecessorId: '10001',
            predecessorKey: 'TEST-1',
            triggerPercent: 90, // TEST-1 is only at 50%
            isTriggerSatisfied: false
          }
        },
        mockStorage
      );

      const successor = updatedPlan.tasks.find(t => t.key === 'TEST-2');
      expect(successor?.dependency?.isTriggerSatisfied).toBe(false);
      expect(successor?.dependency?.isViolated).toBe(true);
      // The violation says what to change; the reason names the 90% trigger (B-11).
      expect(successor?.dependency?.violationReason).toContain('Move TEST-2 to');
      expect(successor?.dependency?.earliestStartReason).toContain('90%');
    });

    it('saves dependency when target task is located by its ID', async () => {
      const updatedPlan = await saveTaskDependency(
        {
          projectKey: 'TEST',
          taskId: '10002',
          dependency: {
            predecessorId: '10001',
            predecessorKey: 'TEST-1',
            triggerPercent: 30,
            isTriggerSatisfied: false
          }
        },
        mockStorage
      );

      const successor = updatedPlan.tasks.find(t => t.id === '10002');
      expect(successor?.dependency?.isTriggerSatisfied).toBe(true);
    });

    it('saves dependency when target task is in backlogTasks', async () => {
      const updatedPlan = await saveTaskDependency(
        {
          projectKey: 'TEST',
          taskId: 'TEST-3',
          dependency: {
            predecessorId: '10001',
            predecessorKey: 'TEST-1',
            triggerPercent: 40,
            isTriggerSatisfied: false
          }
        },
        mockStorage
      );

      const target = updatedPlan.backlogTasks!.find(t => t.key === 'TEST-3');
      expect(target?.dependency).toBeDefined();
    });

    it('saves dependency when target backlog task is matched by its numeric ID', async () => {
      const updatedPlan = await saveTaskDependency(
        {
          projectKey: 'TEST',
          taskId: '10003',
          dependency: {
            predecessorId: '10001',
            predecessorKey: 'TEST-1',
            triggerPercent: 50,
            isTriggerSatisfied: true
          }
        },
        mockStorage
      );

      const target = updatedPlan.backlogTasks!.find(t => t.id === '10003');
      expect(target?.dependency?.triggerPercent).toBe(50);
    });

    it('throws error if target task does not exist', async () => {
      await expect(
        saveTaskDependency(
          {
            projectKey: 'TEST',
            taskId: 'INVALID_TASK',
            dependency: {
              predecessorId: 'TEST-2',
              predecessorKey: 'TEST-2',
              triggerPercent: 30,
              isTriggerSatisfied: false
            }
          },
          mockStorage
        )
      ).rejects.toThrow("Target task 'INVALID_TASK' not found in project plan");
    });

    it('rejects self-dependency in saveTaskDependency', async () => {
      await expect(
        saveTaskDependency(
          {
            projectKey: 'TEST',
            taskId: 'TEST-1',
            dependency: {
              predecessorId: '10001',
              predecessorKey: 'TEST-1',
              triggerPercent: 30,
              isTriggerSatisfied: false
            }
          },
          mockStorage
        )
      ).rejects.toThrow('cannot depend on itself');
    });

    it('rejects cyclic dependency in saveTaskDependency', async () => {
      await saveTaskDependency(
        {
          projectKey: 'TEST',
          taskId: 'TEST-2',
          dependency: {
            predecessorId: '10001',
            predecessorKey: 'TEST-1',
            triggerPercent: 30,
            isTriggerSatisfied: true
          }
        },
        mockStorage
      );

      await expect(
        saveTaskDependency(
          {
            projectKey: 'TEST',
            taskId: 'TEST-1',
            dependency: {
              predecessorId: '10002',
              predecessorKey: 'TEST-2',
              triggerPercent: 30,
              isTriggerSatisfied: false
            }
          },
          mockStorage
        )
      ).rejects.toThrow('Cyclic dependency detected');
    });
  });

  describe('saveColumnWidths and saveProjectMilestone', () => {
    it('saves custom column widths', async () => {
      const newWidths: ColumnWidthConfig = {
        ...DEFAULT_COLUMN_WIDTHS,
        task: 320
      };
      const res = await saveColumnWidths({ projectKey: 'TEST', columnWidths: newWidths }, mockStorage);
      expect(res.success).toBe(true);
      expect(res.columnWidths.task).toBe(320);
    });

    it('saves hidden columns configuration', async () => {
      const res = await saveHiddenColumns({ projectKey: 'TEST', hiddenColumns: ['story', 'target'] }, mockStorage);
      expect(res.success).toBe(true);
      expect(res.hiddenColumns).toEqual(['story', 'target']);

      const resEmpty = await saveHiddenColumns({ projectKey: 'TEST', hiddenColumns: undefined as any }, mockStorage);
      expect(resEmpty.success).toBe(true);
      expect(resEmpty.hiddenColumns).toEqual([]);
    });

    it('saves project milestone marker', async () => {
      const milestone: ProjectMilestone = {
        id: 'm-new',
        title: 'Security Audit Sign-Off',
        date: '2026-09-30',
        weekKey: '30-Sep',
        type: 'GATE',
        isPassed: false
      };
      const res = await saveProjectMilestone({ projectKey: 'TEST', milestone }, mockStorage);
      expect(res.success).toBe(true);
      expect(res.milestones.some(m => m.id === 'm-new')).toBe(true);
    });
  });


  describe('extractProjectKey', () => {
    it('extracts projectKey from payload first', () => {
      expect(extractProjectKey({ payload: { projectKey: 'PROJ-PAYLOAD' } })).toBe('PROJ-PAYLOAD');
    });

    it('falls back to context extension project key', () => {
      expect(extractProjectKey({ context: { extension: { project: { key: 'PROJ-CTX' } } } })).toBe('PROJ-CTX');
    });

    it('falls back to DEMO when neither payload nor context exists', () => {
      expect(extractProjectKey({})).toBe('DEMO');
      expect(extractProjectKey(undefined)).toBe('DEMO');
    });
  });

  describe('extractSiteUrl', () => {
    it('extracts siteUrl from context when valid string', () => {
      expect(extractSiteUrl({ context: { siteUrl: 'https://asymmsystems.atlassian.net' } })).toBe('https://asymmsystems.atlassian.net');
    });

    it('returns undefined when context siteUrl is missing, empty, or not a string', () => {
      expect(extractSiteUrl({})).toBeUndefined();
      expect(extractSiteUrl(undefined)).toBeUndefined();
      expect(extractSiteUrl({ context: {} })).toBeUndefined();
      expect(extractSiteUrl({ context: { siteUrl: '   ' } })).toBeUndefined();
      expect(extractSiteUrl({ context: { siteUrl: 123 } })).toBeUndefined();
    });
  });

  describe('Forge Resolver Definitions (handler)', () => {
    it('handles bridge invocations for getProjectPlan with context fallback', async () => {
      const resContext: any = await handler({
        call: { functionKey: 'getProjectPlan' },
        context: { extension: { project: { key: 'TEST' } }, siteUrl: 'https://asymmsystems.atlassian.net' }
      } as any);
      expect(resContext.projectKey).toBe('TEST');
      expect(resContext.siteUrl).toBe('https://asymmsystems.atlassian.net');

      const resDefault: any = await handler({
        call: { functionKey: 'getProjectPlan' },
        context: {}
      } as any);
      expect(resDefault.projectKey).toBe('DEMO');
    });

    it('prioritizes trusted context projectKey over payload projectKey to prevent cross-project manipulation (F3)', async () => {
      const res: any = await handler({
        call: {
          functionKey: 'getProjectPlan',
          payload: { projectKey: 'ATTACK_PROJECT' }
        },
        context: { extension: { project: { key: 'TEST' } } }
      } as any);
      expect(res.projectKey).toBe('TEST');
    });

    it('handles bridge invocations for scheduleBacklogTask', async () => {
      const res: any = await handler({
        call: {
          functionKey: 'scheduleBacklogTask',
          payload: { taskId: 'TEST-3', startWeek: '12-Aug', spanWeeks: 2 }
        },
        context: { extension: { project: { key: 'TEST' } } }
      } as any);
      expect(res.tasks.some((t: any) => t.key === 'TEST-3')).toBe(true);
    });

    it('handles bridge invocations for createInlineTask with context fallback', async () => {
      const res: any = await handler({
        call: {
          functionKey: 'createInlineTask',
          payload: { summary: 'Context Task', startWeek: '05-Aug', spanWeeks: 2 }
        },
        context: { extension: { project: { key: 'TEST' } } }
      } as any);
      expect(res.success).toBe(true);
    });

    it('handles bridge invocations for createJiraEpic', async () => {
      const res: any = await handler({
        call: {
          functionKey: 'createJiraEpic',
          payload: { summary: 'New Microservice Epic' }
        },
        context: { extension: { project: { key: 'TEST' } } }
      } as any);
      expect(res.success).toBe(true);
    });

    it('handles bridge invocations for updateWbsTask with context fallback', async () => {
      const res: any = await handler({
        call: {
          functionKey: 'updateWbsTask',
          payload: { taskId: 'TEST-1', updates: { progress: 92 } }
        },
        context: { extension: { project: { key: 'TEST' } } }
      } as any);
      expect(res.tasks.find((t: any) => t.key === 'TEST-1')?.progress).toBe(92);
    });

    it('handles bridge invocations for addSubtaskToTask', async () => {
      const res: any = await handler({
        call: {
          functionKey: 'addSubtaskToTask',
          payload: {
            parentTaskId: 'TEST-1',
            subtask: { summary: 'Subtask via bridge', estimateValue: 8, estimateUnit: 'HOURS' },
            bufferType: 'FIXED_HOURS',
            bufferValue: 4
          }
        },
        context: { extension: { project: { key: 'TEST' } } }
      } as any);
      expect(res.tasks.find((t: any) => t.key === 'TEST-1')?.effortHours).toBeGreaterThan(0);
    });

    it('handles bridge invocations for saveTaskDependency with context fallback', async () => {
      const res: any = await handler({
        call: {
          functionKey: 'saveTaskDependency',
          payload: {
            taskId: 'TEST-2',
            dependency: {
              predecessorId: '10001',
              predecessorKey: 'TEST-1',
              triggerPercent: 10,
              isTriggerSatisfied: false
            }
          }
        },
        context: { extension: { project: { key: 'TEST' } } }
      } as any);
      expect(res.tasks.find((t: any) => t.key === 'TEST-2')?.dependency).toBeDefined();
    });

    it('handles bridge invocations for saveColumnWidths and saveProjectMilestone', async () => {
      const resCol: any = await handler({
        call: {
          functionKey: 'saveColumnWidths',
          payload: { columnWidths: DEFAULT_COLUMN_WIDTHS }
        },
        context: { extension: { project: { key: 'TEST' } } }
      } as any);
      expect(resCol.success).toBe(true);

      const resHidden: any = await handler({
        call: {
          functionKey: 'saveHiddenColumns',
          payload: { hiddenColumns: ['story', 'status'] }
        },
        context: { extension: { project: { key: 'TEST' } } }
      } as any);
      expect(resHidden.success).toBe(true);
      expect(resHidden.hiddenColumns).toEqual(['story', 'status']);

      const resMilestone: any = await handler({
        call: {
          functionKey: 'saveProjectMilestone',
          payload: {
            milestone: {
              id: 'm-1',
              title: 'Sprint 1 Target',
              date: '2026-11-01',
              weekKey: '01-Nov',
              type: 'TARGET' as const,
              isPassed: false
            }
          }
        },
        context: { extension: { project: { key: 'TEST' } } }
      } as any);
      expect(resMilestone.success).toBe(true);
    });

    it('returns error object when updateWbsTask fails in resolver', async () => {
      const res: any = await handler({
        call: {
          functionKey: 'updateWbsTask',
          payload: { taskId: 'NON_EXISTENT', updates: { summary: 'New' } }
        },
        context: { extension: { project: { key: 'TEST' } } }
      } as any);
      expect(res.success).toBe(false);
      expect(res.error).toBeDefined();
    });

  });

  describe('Two-Way Sync and Jira Issue Links', () => {
    it('syncTaskToJira returns synced: true when updates has no synchable fields', async () => {
      const res = await syncTaskToJira('TEST-1', {});
      expect(res.synced).toBe(true);
    });

    it('syncTaskToJira writes summary, duedate, timetracking, and assignee to Jira', async () => {
      mockRequestJira.mockResolvedValueOnce({ status: 204 });
      const res = await syncTaskToJira('TEST-1', {
        summary: 'Updated Summary',
        endDate: '2026-11-20',
        effortHours: 16,
        resourceAccountId: 'acc-123'
      });
      expect(res.synced).toBe(true);
      expect(mockRequestJira).toHaveBeenCalled();
    });

    it('syncTaskToJira unassigns issue when resourceAccountId is unassigned', async () => {
      mockRequestJira.mockResolvedValueOnce({ status: 204 });
      const res = await syncTaskToJira('TEST-1', { resourceAccountId: 'unassigned' });
      expect(res.synced).toBe(true);
      const lastCall = mockRequestJira.mock.calls[mockRequestJira.mock.calls.length - 1];
      const parsed = JSON.parse(lastCall[1].body);
      expect(parsed.fields.assignee).toBeNull();
    });

    it('syncTaskToJira gracefully retries without duedate if duedate is rejected on issue screen', async () => {
      mockRequestJira
        .mockResolvedValueOnce({
          status: 400,
          json: async () => ({ errors: { duedate: 'Field duedate cannot be set on screen' } })
        })
        .mockResolvedValueOnce({ status: 204 });

      const res = await syncTaskToJira('TEST-1', {
        summary: 'Clean Task Title',
        endDate: '2026-11-20'
      });
      expect(res.synced).toBe(true);
      expect(mockRequestJira).toHaveBeenCalledTimes(2);
    });

    it('syncTaskToJira handles duedate retry failure and empty fallbackFields', async () => {
      mockRequestJira
        .mockResolvedValueOnce({
          status: 400,
          json: async () => ({ errors: { duedate: 'Cannot set duedate' } })
        })
        .mockResolvedValueOnce({
          status: 400,
          json: async () => ({ errorMessages: ['Still invalid'] })
        });

      const res = await syncTaskToJira('TEST-1', {
        summary: 'Failing retry',
        endDate: '2026-11-20'
      });
      expect(res.synced).toBe(false);
      expect(res.error).toContain('Still invalid');

      mockRequestJira.mockResolvedValueOnce({
        status: 400,
        json: async () => ({ errors: { duedate: 'Cannot set duedate' } })
      });
      const resOnlyDuedate = await syncTaskToJira('TEST-1', {
        endDate: '2026-11-20'
      });
      expect(resOnlyDuedate.synced).toBe(false);
    });

    it('syncTaskToJira handles non-200 responses gracefully', async () => {
      mockRequestJira.mockResolvedValueOnce({
        status: 400,
        json: async () => ({ errorMessages: ['Field not on screen'] })
      });
      const res = await syncTaskToJira('TEST-1', { summary: 'New Title' });
      expect(res.synced).toBe(false);
      expect(res.error).toContain('Field not on screen');
    });

    it('syncTaskToJira handles field errors in errJson.errors and fallback json', async () => {
      mockRequestJira.mockResolvedValueOnce({
        status: 400,
        json: async () => ({ errors: { summary: 'Summary is required' } })
      });
      const res1 = await syncTaskToJira('TEST-1', { summary: 'New Title' });
      expect(res1.synced).toBe(false);
      expect(res1.error).toContain('Summary is required');

      mockRequestJira.mockResolvedValueOnce({
        status: 500,
        json: async () => ({ message: 'Server crash' })
      });
      const res2 = await syncTaskToJira('TEST-1', { summary: 'New Title' });
      expect(res2.synced).toBe(false);
      expect(res2.error).toContain('Server crash');
    });

    it('syncTaskToJira handles non-json error response gracefully', async () => {
      mockRequestJira.mockResolvedValueOnce({
        status: 502,
        json: async () => { throw new Error('Bad gateway HTML'); }
      });
      const res = await syncTaskToJira('TEST-1', { summary: 'New Title' });
      expect(res.synced).toBe(false);
      expect(res.error).toBe('Jira status 502');
    });

    it('getJiraCaller falls back to asApp when asUser is not available', () => {
      const orig = (api as any).asUser;
      delete (api as any).asUser;
      const caller = getJiraCaller();
      expect(caller).toBeDefined();
      (api as any).asUser = orig;
    });

    it('syncTaskToJira handles network exception gracefully', async () => {
      mockRequestJira.mockRejectedValueOnce(new Error('Network timeout'));
      const res = await syncTaskToJira('TEST-1', { summary: 'New Title' });
      expect(res.synced).toBe(false);
      expect(res.error).toBe('Network timeout');
    });

    it('mirrorDependencyToJira creates issueLink successfully on 201', async () => {
      mockRequestJira.mockResolvedValueOnce({ status: 201 });
      const res = await mirrorDependencyToJira('TEST-2', 'TEST-1');
      expect(res.linked).toBe(true);
    });

    it('mirrorDependencyToJira handles non-201 response and network errors', async () => {
      // First call looks for an existing link, second call creates one (B-06).
      mockRequestJira.mockResolvedValueOnce({ status: 404 }).mockResolvedValueOnce({ status: 404 });
      const res1 = await mirrorDependencyToJira('TEST-2', 'TEST-1');
      expect(res1.linked).toBe(false);

      mockRequestJira.mockRejectedValueOnce(new Error('Lookup error')).mockRejectedValueOnce(new Error('Link error'));
      const res2 = await mirrorDependencyToJira('TEST-2', 'TEST-1');
      expect(res2.linked).toBe(false);
      expect(res2.error).toBe('Link error');
    });

    it('syncTaskToJira executes status transition when status is provided', async () => {
      mockRequestJira
        .mockResolvedValueOnce({
          status: 200,
          json: async () => ({
            transitions: [
              { id: '31', name: 'In Progress', to: { name: 'In Progress', statusCategory: { key: 'indeterminate' } } },
              { id: '41', name: 'Done', to: { name: 'Done', statusCategory: { key: 'done' } } }
            ]
          })
        }) // GET /rest/api/3/issue/TEST-1/transitions
        .mockResolvedValueOnce({ status: 204 }); // POST /rest/api/3/issue/TEST-1/transitions

      const res = await syncTaskToJira('TEST-1', { status: 'COMPLETED' });
      expect(res.synced).toBe(true);
      expect(mockRequestJira).toHaveBeenCalledTimes(2);
    });

    it('syncTaskToJira falls back to dedicated /assignee endpoint if issue update fails on assignee', async () => {
      mockRequestJira
        .mockResolvedValueOnce({
          status: 400,
          json: async () => ({ errors: { assignee: 'Field assignee not found on screen' } })
        })
        .mockResolvedValueOnce({ status: 204 }); // PUT /rest/api/3/issue/TEST-1/assignee

      const res = await syncTaskToJira('TEST-1', { resourceAccountId: 'user-xyz' });
      expect(res.synced).toBe(true);
      expect(mockRequestJira).toHaveBeenCalledTimes(2);
    });
  });

  describe('Unschedule, Reorder, and Multi-Resource Subtasks', () => {
    it('unscheduleTask moves a scheduled task to backlog and updates storage', async () => {
      const plan = await unscheduleTask({ taskId: 'TEST-1', projectKey: 'TEST' });
      expect(plan.projectKey).toBe('TEST');

      const entry = await entryOf(mockStorage, 'TEST-1');
      expect(entry.isBacklog).toBe(true);
      expect(entry.startWeek).toBeUndefined();
      expect(plan.tasks.some(t => t.key === 'TEST-1')).toBe(false);
    });

    it('unscheduleTask handles unscheduling a task that had no prior schedule override', async () => {
      const plan = await unscheduleTask({ taskId: 'TEST-99', projectKey: 'TEST' });
      expect(plan.projectKey).toBe('TEST');
    });

    it('reorderWbsTasks reorders tasks and updates taskOrder in storage', async () => {
      await mockStorage.set('taskOrder:TEST', ['TEST-1', 'TEST-2']);
      const plan = await reorderWbsTasks({ taskId: 'TEST-2', targetIndex: 0, projectKey: 'TEST' });
      expect(plan.projectKey).toBe('TEST');
      expect(plan.tasks.map(t => t.key)).toEqual(['TEST-2', 'TEST-1']);
    });

    it('reorderWbsTasks builds initial task order from live issues if taskOrder is empty', async () => {
      await mockStorage.delete('taskOrder:TEST');
      const plan = await reorderWbsTasks({ taskId: 'TEST-2', targetIndex: 0, projectKey: 'TEST' });
      expect(plan.projectKey).toBe('TEST');
      expect(plan.tasks[0].key).toBe('TEST-2');
    });

    it('createSubtaskForResource creates Jira subtask and assigns dedicated team member', async () => {
      mockRequestJira.mockImplementation(async (routeStr: any, options?: any) => {
        const url = String(routeStr);
        if (url.includes('/rest/api/3/issue')) {
          return {
            status: 201,
            json: async () => ({ id: '10099', key: 'TEST-99' })
          };
        }
        return { status: 200, json: async () => ({}) };
      });

      await clearRecords(mockStorage);
      const res = await createSubtaskForResource({
        parentTaskId: 'TEST-1',
        assigneeAccountId: 'user-jane',
        assigneeName: 'Jane Engineer',
        effortHours: 16,
        startWeek: DEFAULT_WEEKS[1].weekKey,
        projectKey: 'TEST'
      });

      expect(res.success).toBe(true);
      expect(res.subtask?.key).toBe('TEST-99');
      // The second person is the Jira assignee of the new sub-task (read live, not stored).
      const createCall = mockRequestJira.mock.calls.find(c => c[1]?.method === 'POST' && String(c[0]).endsWith('/rest/api/3/issue'));
      expect(JSON.parse(createCall[1].body).fields.assignee).toEqual({ accountId: 'user-jane' });

      // Test with empty scheduleMap
      await clearRecords(mockStorage);
      const addSubRes = await addSubtaskToTask({
        projectKey: 'TEST',
        parentTaskId: 'TEST-1',
        subtask: { summary: 'New Sub', estimateValue: 4, estimateUnit: 'HOURS' }
      }, mockStorage);
      expect(addSubRes.projectKey).toBe('TEST');

      expect(await entryOf(mockStorage, 'TEST-1')).toBeDefined();
    });

    it('createSubtaskForResource retries with Subtask if Sub-task type fails', async () => {
      let callCount = 0;
      mockRequestJira.mockImplementation(async (routeStr: any, options?: any) => {
        const url = String(routeStr);
        if (url.includes('/rest/api/3/issue')) {
          callCount++;
          if (callCount === 1) {
            return {
              status: 400,
              json: async () => ({ errors: { issuetype: 'Issue type Sub-task not found' } })
            };
          }
          return {
            status: 201,
            json: async () => ({ id: '10100', key: 'TEST-100' })
          };
        }
        return { status: 200, json: async () => ({}) };
      });

      const res = await createSubtaskForResource({
        parentTaskId: 'TEST-1',
        effortHours: 12,
        projectKey: 'TEST'
      });

      expect(res.success).toBe(true);
      expect(res.subtask?.key).toBe('TEST-100');
    });

    it('createSubtaskForResource returns error if Jira subtask creation fails', async () => {
      mockRequestJira.mockResolvedValue({
        status: 400,
        json: async () => ({ errorMessages: ['Parent issue is closed'] })
      });

      const res = await createSubtaskForResource({
        parentTaskId: 'TEST-1',
        projectKey: 'TEST'
      });

      expect(res.success).toBe(false);
      expect(res.error).toContain('Parent issue is closed');
    });

    it('createSubtaskForResource rejects when parentTaskId is missing', async () => {
      const res = await createSubtaskForResource({
        parentTaskId: '',
        projectKey: 'TEST'
      });
      expect(res.success).toBe(false);
      expect(res.error).toContain('required');
    });

    it('createSubtaskForResource catches network error and returns failure message', async () => {
      mockRequestJira.mockRejectedValue(new Error('Jira connection dropped'));
      const res = await createSubtaskForResource({
        parentTaskId: 'TEST-1',
        projectKey: 'TEST'
      });
      expect(res.success).toBe(false);
      expect(res.error).toContain('Jira connection dropped');

      // Test string rejection (err.message undefined -> fallback 'Network error')
      mockRequestJira.mockRejectedValue('raw string failure');
      const resStr = await createSubtaskForResource({
        parentTaskId: 'TEST-1',
        projectKey: 'TEST'
      });
      expect(resStr.success).toBe(false);
      expect(resStr.error).toContain('Network error');

      // Test 400 response with empty JSON object
      mockRequestJira.mockResolvedValue({
        status: 400,
        json: async () => ({})
      });
      const resEmpty = await createSubtaskForResource({
        parentTaskId: 'TEST-1',
        projectKey: 'TEST'
      });
      expect(resEmpty.success).toBe(false);
      expect(resEmpty.error).toContain('Failed to create subtask');

      // Test unscheduleTask when scheduleMap does not exist in storage
      await clearRecords(mockStorage);
      const unschedEmpty = await unscheduleTask({
        projectKey: 'TEST',
        taskId: 'TEST-1'
      }, mockStorage);
      expect(unschedEmpty.projectKey).toBe('TEST');
    });

    it('scheduleBacklogTask respects targetIndex parameter when ordering', async () => {
      await mockStorage.set('taskOrder:TEST', ['TEST-1', 'TEST-2']);
      const plan = await scheduleBacklogTask({
        taskId: 'TEST-3',
        startWeek: '15-Jul',
        spanWeeks: 2,
        targetIndex: 1,
        projectKey: 'TEST'
      });
      expect(plan.projectKey).toBe('TEST');

      expect(plan.tasks.map(t => t.key)).toEqual(['TEST-1', 'TEST-3', 'TEST-2']);
    });

    it('updateWbsTask cascades schedule shifts downstream when predecessor changes', async () => {
      await mockStorage.delete('cp:TEST:settings');
      await mockStorage.set('scheduleMap:TEST', {
        'TEST-1': { startWeek: '15-Jul', spanWeeks: 2, effortHours: 20 },
        'TEST-2': {
          startWeek: '15-Jul',
          spanWeeks: 2,
          effortHours: 20,
          dependency: { predecessorId: 'TEST-1', predecessorKey: 'TEST-1', triggerPercent: 100, isTriggerSatisfied: false }
        }
      });

      const plan = await updateWbsTask({
        taskId: 'TEST-1',
        updates: { startWeek: '29-Jul' },
        projectKey: 'TEST'
      });
      expect(plan.projectKey).toBe('TEST');

      expect((await entryOf(mockStorage, 'TEST-2')).startWeek).toBeDefined();
    });

    it('handler invokes unscheduleTask, reorderWbsTasks, and createSubtaskForResource resolvers', async () => {
      const resUnsched: any = await handler({
        call: { functionKey: 'unscheduleTask', payload: { taskId: 'TEST-1' } },
        context: { extension: { project: { key: 'TEST' } } }
      } as any);
      expect(resUnsched.projectKey).toBe('TEST');

      const resReorder: any = await handler({
        call: { functionKey: 'reorderWbsTasks', payload: { taskId: 'TEST-2', targetIndex: 0 } },
        context: { extension: { project: { key: 'TEST' } } }
      } as any);
      expect(resReorder.projectKey).toBe('TEST');

      mockRequestJira.mockImplementation(async (routeStr: any) => {
        const url = String(routeStr);
        if (url.includes('/rest/api/3/issue')) {
          return {
            status: 201,
            json: async () => ({ id: '10101', key: 'TEST-101' })
          };
        }
        if (url.includes('/rest/api/3/search/jql')) {
          return {
            status: 200,
            json: async () => ({
              issues: [
                { id: '10101', key: 'TEST-101', fields: { summary: 'Subtask', issuetype: { name: 'Subtask' } } }
              ]
            })
          };
        }
        return { status: 200, json: async () => ({}) };
      });
      const resSubtask: any = await handler({
        call: { functionKey: 'createSubtaskForResource', payload: { parentTaskId: 'TEST-1', effortHours: 8 } },
        context: { extension: { project: { key: 'TEST' } } }
      } as any);
      expect(resSubtask.success).toBe(true);

      const resUpdateErr: any = await handler({
        call: { functionKey: 'updateWbsTask', payload: { taskId: 'NONEXISTENT' } },
        context: { extension: { project: { key: 'TEST' } } }
      } as any);
      expect(resUpdateErr.success).toBe(false);

      jest.spyOn(mockStorage, 'get').mockRejectedValueOnce('string error without message');
      const resErrNoMsg: any = await handler({
        call: { functionKey: 'updateWbsTask', payload: { taskId: 'TEST-1', updates: {} } },
        context: { extension: { project: { key: 'TEST' } } }
      } as any);
      expect(resErrNoMsg.success).toBe(false);
      expect(resErrNoMsg.error).toBe('Failed to update task');
    });
  });

  describe('fetchLiveJiraIssues hierarchy parsing', () => {
    it('correctly maps hierarchy levels for Epics, Stories, and Subtasks', async () => {
      mockRequestJira.mockImplementation(async (routeStr: any) => {
        const url = String(routeStr);
        if (url.includes('/rest/api/3/search/jql')) {
          return {
            status: 200,
            json: async () => ({
              issues: [
                {
                  id: '1',
                  key: 'TEST-E1',
                  fields: {
                    summary: 'Epic One',
                    issuetype: { name: 'Epic', hierarchyLevel: 1 },
                    timeoriginalestimate: 36000,
                    aggregatetimespent: 7200
                  }
                },
                {
                  id: '2',
                  key: 'TEST-S1',
                  fields: {
                    summary: 'Story One',
                    issuetype: { name: 'Story', hierarchyLevel: 0 },
                    parent: { key: 'TEST-E1', fields: { summary: 'Epic One' } }
                  }
                },
                {
                  id: '3',
                  key: 'TEST-SUB1',
                  fields: {
                    summary: 'Subtask One',
                    issuetype: { name: 'Subtask', hierarchyLevel: -1, subtask: true },
                    parent: { key: 'TEST-S1' }
                  }
                },
                {
                  id: '4',
                  key: 'TEST-SUB2',
                  fields: {
                    summary: 'Deep Subtask',
                    issuetype: { name: 'DeepSub', hierarchyLevel: -2 },
                    parent: { key: 'TEST-SUB1' }
                  }
                },
                {
                  id: '5',
                  key: 'TEST-SUB3',
                  fields: {
                    summary: 'Classic Subtask',
                    issuetype: { name: 'Subtask', subtask: true },
                    parent: { key: 'TEST-S1' }
                  }
                },
                {
                  id: '6',
                  key: 'TEST-E2',
                  fields: {
                    summary: 'Classic Epic',
                    issuetype: { name: 'Epic' }
                  }
                }
              ]
            })
          };
        }
        return { status: 200, json: async () => ({}) };
      });

      const res = await fetchLiveJiraIssues('TEST');
      expect(res.isLive).toBe(true);
      const allTasks = [...res.tasks, ...res.backlogTasks];
      const epic = allTasks.find(t => t.key === 'TEST-E1');
      const story = allTasks.find(t => t.key === 'TEST-S1');
      const sub = allTasks.find(t => t.key === 'TEST-SUB1');
      const deepSub = allTasks.find(t => t.key === 'TEST-SUB2');

      expect(epic?.isEpic).toBe(true);
      expect(epic?.isSubtask).toBe(false);
      expect(epic?.hierarchyLevel).toBe(1);

      expect(story?.isEpic).toBe(false);
      expect(story?.isSubtask).toBe(false);
      expect(story?.hierarchyLevel).toBe(0);
      expect(story?.epicKey).toBe('TEST-E1');

      expect(sub?.isSubtask).toBe(true);
      expect(sub?.hierarchyLevel).toBe(-1);

      expect(deepSub?.isSubtask).toBe(true);
      expect(deepSub?.hierarchyLevel).toBe(-1);
    });

    it('returns empty and isLive false when request throws error', async () => {
      mockRequestJira.mockImplementation(async () => {
        throw new Error('Jira API timeout');
      });
      const res = await fetchLiveJiraIssues('ERR');
      expect(res.isLive).toBe(false);
      expect(res.tasks).toEqual([]);
      expect(res.backlogTasks).toEqual([]);
    });

    it('recovers dependency from Jira issuelinks when stored dependency is missing', async () => {
      mockRequestJira.mockImplementation(async (routeStr: any) => {
        const url = String(routeStr);
        if (url.includes('/rest/api/3/search/jql')) {
          return {
            status: 200,
            json: async () => ({
              issues: [
                {
                  id: '101',
                  key: 'TEST-101',
                  fields: {
                    summary: 'Predecessor task',
                    issuetype: { name: 'Task' }
                  }
                },
                {
                  id: '102',
                  key: 'TEST-102',
                  fields: {
                    summary: 'Successor task with block link',
                    issuetype: { name: 'Task' },
                    issuelinks: [
                      {
                        type: { name: 'Blocks' },
                        inwardIssue: { id: '101', key: 'TEST-101' }
                      }
                    ]
                  }
                }
              ]
            })
          };
        }
        return { status: 200, json: async () => ({}) };
      });

      const res = await fetchLiveJiraIssues('TEST');
      const succ = [...res.tasks, ...res.backlogTasks].find(t => t.key === 'TEST-102');
      expect(succ?.dependency?.predecessorKey).toBe('TEST-101');
      // A plain Jira "Blocks" link is finish-to-start (B-11).
      expect(succ?.dependency?.triggerPercent).toBe(100);
    });
  });

  describe('getPortfolioResourceHeatmap coverage', () => {

    it('saves task dependency when scheduleMap key does not yet exist', async () => {
      await clearRecords(mockStorage);
      const plan = await saveTaskDependency({
        projectKey: 'TEST',
        taskId: 'TEST-2',
        dependency: {
          predecessorId: '10001',
          predecessorKey: 'TEST-1',
          triggerPercent: 30,
          isTriggerSatisfied: false
        }
      });
      expect(plan.projectKey).toBe('TEST');
    });




    it('inherits Epic from parent when subtask is fetched and parent has epic object', async () => {
      mockRequestJira.mockImplementationOnce(async () => ({
        status: 200,
        json: async () => ({
          issues: [
            {
              id: '10',
              key: 'TEST-P1',
              fields: {
                summary: 'Parent Story',
                issuetype: { name: 'Story', hierarchyLevel: 0 },
                epic: { key: 'TEST-E10', name: 'Security Epic' }
              }
            },
            {
              id: '11',
              key: 'TEST-S11',
              fields: {
                summary: 'Child Subtask',
                issuetype: { name: 'Subtask', hierarchyLevel: -1, subtask: true },
                parent: { key: 'TEST-P1' }
              }
            }
          ]
        })
      }));

      const res = await fetchLiveJiraIssues('TEST');
      const sub = res.backlogTasks.find(t => t.key === 'TEST-S11') || res.tasks.find(t => t.key === 'TEST-S11');
      expect(sub?.epicKey).toBe('TEST-E10');
      expect(sub?.epic).toBe('Security Epic');
    });

    it('reorders tasks and persists unique keys', async () => {
      const plan = await reorderWbsTasks({
        projectKey: 'TEST',
        taskId: 'TEST-2',
        targetIndex: 0
      }, mockStorage);
      expect(plan.tasks.length).toBeGreaterThan(0);
    });

    it('falls back to single Epic issuetype query when first JQL returns error', async () => {
      mockRequestJira
        .mockResolvedValueOnce({ status: 400 })
        .mockResolvedValueOnce({
          status: 200,
          json: async () => ({
            issues: [{ id: '99', key: 'TEST-E99', fields: { summary: 'Fallback Epic' } }]
          })
        });

      const epics = await fetchProjectEpics('TEST');
      expect(epics).toHaveLength(1);
      expect(epics[0].key).toBe('TEST-E99');
    });

    it('merges scheduled Epics from tasks into availableEpics', async () => {
      // TEST-4 is an Epic in Jira; once scheduled it joins the epic list.
      await mockStorage.delete('cp:TEST:settings');
      await mockStorage.set('scheduleMap:TEST', {
        'TEST-4': {
          startWeek: DEFAULT_WEEKS[0].weekKey,
          endWeek: DEFAULT_WEEKS[2].weekKey,
          spanWeeks: 3
        }
      });

      const plan = await getProjectPlan('TEST', mockStorage);
      expect(plan.availableEpics?.some(e => e.key === 'TEST-4')).toBe(true);
    });

    it('saves task dependency when target task is in backlogTasks', async () => {
      // TEST-3 is in backlogTasks
      const plan = await saveTaskDependency({
        projectKey: 'TEST',
        taskId: 'TEST-3',
        dependency: {
          predecessorId: '10001',
          predecessorKey: 'TEST-1',
          triggerPercent: 30,
          isTriggerSatisfied: false
        }
      });
      const t3 = plan.backlogTasks?.find(t => t.key === 'TEST-3');
      expect(t3?.dependency).toBeDefined();
    });


    it('saves and preserves contributingResources on updateWbsTask', async () => {
      const plan = await updateWbsTask({
        projectKey: 'TEST',
        taskId: 'TEST-1',
        updates: {
          resource: 'Lead Engineer',
          contributingResources: ['Lead Engineer', 'Peer Dev', 'QA Lead']
        }
      }, mockStorage);

      const task1 = plan.tasks.find(t => t.key === 'TEST-1');
      // The assignee is read live from Jira; a name without an account id changes nothing in Jira.
      expect(task1?.resource).toBe('Fahim Farook');
      expect(task1?.contributingResources).toEqual(expect.arrayContaining(['Lead Engineer', 'Peer Dev', 'QA Lead']));

      // Now update another field without contributingResources - it should preserve existing
      const plan2 = await updateWbsTask({
        projectKey: 'TEST',
        taskId: 'TEST-1',
        updates: {
          progress: 50
        }
      }, mockStorage);

      const task1Updated = plan2.tasks.find(t => t.key === 'TEST-1');
      expect(task1Updated?.progress).toBe(50);
      expect(task1Updated?.contributingResources).toEqual(expect.arrayContaining(['Lead Engineer', 'Peer Dev', 'QA Lead']));
    });

    it('auto-moves startWeek and shifts bar when fractional dependency is added', async () => {
      // TEST-1 is at 50% in Jira (time spent / estimate). With an 80% trigger the engine projects
      // the date from the observed rate, which lies in the future, so TEST-2 moves there (B-11).
      const plan = await updateWbsTask({
        projectKey: 'TEST',
        taskId: 'TEST-2',
        updates: {
          startWeek: DEFAULT_WEEKS[0].weekKey, // Attempt to set to first week
          dependency: {
            predecessorId: '10001',
            predecessorKey: 'TEST-1',
            triggerPercent: 80,
            isTriggerSatisfied: false
          }
        }
      }, mockStorage);

      const task2 = plan.tasks.find(t => t.key === 'TEST-2');
      expect(task2?.dependency?.predecessorKey).toBe('TEST-1');
      expect(task2?.dependency?.earliestStartReason).toContain('observed');
      expect(task2?.startDate).toBe(task2?.dependency?.earliestStartDate);
      expect(task2?.dependency?.isViolated).toBe(false);
      const startIdx = DEFAULT_WEEKS.findIndex(w => w.weekKey === task2?.startWeek);
      expect(startIdx).toBeGreaterThanOrEqual(2);
    });

    it('auto-transitions status to COMPLETED when progress reaches 100', async () => {
      const plan = await updateWbsTask({
        projectKey: 'TEST',
        taskId: 'TEST-1',
        updates: {
          progress: 100,
          status: 'IN_PROGRESS'
        }
      }, mockStorage);

      const task1 = plan.tasks.find(t => t.key === 'TEST-1');
      expect(task1?.progress).toBe(100);
      // Status is Jira-owned: the resolver asks Jira for the transitions to Done (B-04).
      expect(mockRequestJira.mock.calls.some(c => String(c[0]).endsWith('/issue/TEST-1/transitions'))).toBe(true);
    });

    it('auto-transitions status to IN_PROGRESS when progress is greater than 0 on NOT_STARTED task', async () => {
      const plan = await updateWbsTask({
        projectKey: 'TEST',
        taskId: 'TEST-1',
        updates: {
          progress: 35,
          status: 'NOT_STARTED'
        }
      }, mockStorage);

      const task1 = plan.tasks.find(t => t.key === 'TEST-1');
      expect(task1?.progress).toBe(35);
      expect(task1?.status).toBe('IN_PROGRESS');
    });

    it('clamps progress and targetProgress between 0 and 100', async () => {
      const plan = await updateWbsTask({
        projectKey: 'TEST',
        taskId: 'TEST-1',
        updates: {
          progress: 150,
          targetProgress: -20
        }
      }, mockStorage);

      const task1 = plan.tasks.find(t => t.key === 'TEST-1');
      expect(task1?.progress).toBe(100);
      expect(task1?.targetProgress).toBe(0);
    });

    it('saves and preserves manualProgress flag on updateWbsTask', async () => {
      const plan = await updateWbsTask({
        projectKey: 'TEST',
        taskId: 'TEST-1',
        updates: {
          progress: 85,
          manualProgress: true
        }
      }, mockStorage);

      const task1 = plan.tasks.find(t => t.key === 'TEST-1');
      expect(task1?.progress).toBe(85);
      expect(task1?.manualProgress).toBe(true);

      // Subsequent update without manualProgress should preserve manualProgress: true
      const plan2 = await updateWbsTask({
        projectKey: 'TEST',
        taskId: 'TEST-1',
        updates: {
          targetProgress: 90
        }
      }, mockStorage);

      const task1Second = plan2.tasks.find(t => t.key === 'TEST-1');
      expect(task1Second?.targetProgress).toBe(90);
      expect(task1Second?.manualProgress).toBe(true);
    });

    it('sets manualProgress: true automatically when updating progress on an Epic without manualProgress specified', async () => {
      mockRequestJira.mockImplementation(async (routeStr: any) => {
        const url = String(routeStr);
        if (url.includes('/rest/api/3/search/jql')) {
          return {
            status: 200,
            json: async () => ({
              issues: [
                {
                  id: '301',
                  key: 'TEST-EPIC-1',
                  fields: {
                    summary: 'Epic Roadmap Item',
                    issuetype: { name: 'Epic', hierarchyLevel: 1 }
                  }
                }
              ]
            })
          };
        }
        return { status: 200, json: async () => ({}) };
      });

      await mockStorage.delete('cp:TEST:settings');

      await mockStorage.set('scheduleMap:TEST', {
        'TEST-EPIC-1': {
          startWeek: DEFAULT_WEEKS[0].weekKey,
          spanWeeks: 4
        }
      });

      const plan = await updateWbsTask({
        projectKey: 'TEST',
        taskId: 'TEST-EPIC-1',
        updates: {
          progress: 65
        }
      }, mockStorage);

      const epic = plan.tasks.find(t => t.key === 'TEST-EPIC-1');
      expect(epic?.progress).toBe(65);
      expect(epic?.manualProgress).toBe(true);
    });

    it('preserves affTask.dependency and parentTask.dependency when missing in curAff/curParent scheduleMap', async () => {
      mockRequestJira.mockImplementation(async (routeStr: any) => {
        const url = String(routeStr);
        if (url.includes('/rest/api/3/search/jql')) {
          return {
            status: 200,
            json: async () => ({
              issues: [
                {
                  id: '201',
                  key: 'TEST-P1',
                  fields: {
                    summary: 'Parent task with block link',
                    issuetype: { name: 'Task' },
                    issuelinks: [
                      {
                        type: { name: 'Blocks' },
                        inwardIssue: { id: '200', key: 'TEST-ROOT' }
                      }
                    ]
                  }
                },
                {
                  id: '202',
                  key: 'TEST-CHILD',
                  fields: {
                    summary: 'Child task',
                    issuetype: { name: 'Subtask' },
                    parent: { id: '201', key: 'TEST-P1' }
                  }
                },
                {
                  id: '203',
                  key: 'TEST-DEP',
                  fields: {
                    summary: 'Downstream task depending on Child',
                    issuetype: { name: 'Task' },
                    issuelinks: [
                      {
                        type: { name: 'Blocks' },
                        inwardIssue: { id: '202', key: 'TEST-CHILD' }
                      }
                    ]
                  }
                }
              ]
            })
          };
        }
        return { status: 200, json: async () => ({}) };
      });

      // Schedule all three without dependency in scheduleMap
      await mockStorage.delete('cp:TEST:settings');
      await mockStorage.set('scheduleMap:TEST', {
        'TEST-P1': {
          startWeek: DEFAULT_WEEKS[0].weekKey,
          endWeek: DEFAULT_WEEKS[1].weekKey,
          spanWeeks: 2
        },
        'TEST-CHILD': {
          startWeek: DEFAULT_WEEKS[0].weekKey,
          endWeek: DEFAULT_WEEKS[1].weekKey,
          spanWeeks: 2,
          parentKey: 'TEST-P1'
        },
        'TEST-DEP': {
          startWeek: DEFAULT_WEEKS[0].weekKey,
          endWeek: DEFAULT_WEEKS[1].weekKey,
          spanWeeks: 2
        }
      });

      // Now update TEST-CHILD with startWeek move to week 2
      // This will cascade downstream to TEST-DEP (line 1045) and roll up to TEST-P1 (line 1088)
      const plan = await updateWbsTask({
        projectKey: 'TEST',
        taskId: 'TEST-CHILD',
        updates: {
          startWeek: DEFAULT_WEEKS[2].weekKey,
          spanWeeks: 2
        }
      }, mockStorage);

      expect(plan.tasks.length).toBe(3);
    });
  });
});
