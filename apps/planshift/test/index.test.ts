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
  saveProjectMilestone,
  getPortfolioResourceHeatmap,
  resolveStorage,
  setGlobalStorageProvider,
  handler,
  DEFAULT_WEEKS,
  DEFAULT_COLUMN_WIDTHS,
  DEFAULT_MILESTONES,
  PLACEHOLDER_USERS,
  mapJiraStatus,
  extractProjectKey,
  syncTaskToJira,
  mirrorDependencyToJira,
  getJiraCaller
} from '../src/index';
import api from '@forge/api';
import { StorageProvider, PlanRepository } from '../src/storage/plan-repository';
import { EstimateUnit, ProjectMilestone, ColumnWidthConfig } from '../src/domain/models';

const mockRequestJira = jest.fn();
jest.mock('@forge/api', () => ({
  __esModule: true,
  default: {
    asApp: () => ({
      requestJira: mockRequestJira
    }),
    asUser: () => ({
      requestJira: mockRequestJira
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

class MockStorage implements StorageProvider {
  private store = new Map<string, any>();

  async get<T>(key: string): Promise<T | undefined> {
    return this.store.get(key);
  }

  async set(key: string, value: any): Promise<void> {
    this.store.set(key, JSON.parse(JSON.stringify(value)));
  }

  async delete(key: string): Promise<void> {
    this.store.delete(key);
  }
}

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

    await mockStorage.set('scheduleMap:TEST', {
      'TEST-1': {
        startWeek: '15-Jul',
        endWeek: '05-Aug',
        spanWeeks: 4,
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
    it('fetches Jira users and appends placeholders', async () => {
      const users = await fetchProjectUsers('TEST');
      expect(users.some(u => u.displayName === 'Fahim Farook')).toBe(true);
      expect(users.some(u => u.isPlaceholder)).toBe(true);
    });

    it('handles Jira user fetch errors gracefully', async () => {
      mockRequestJira.mockRejectedValueOnce(new Error('Network failure'));
      const users = await fetchProjectUsers('TEST');
      expect(users.length).toBe(PLACEHOLDER_USERS.length + 1);
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

    it('retrieves plan from repository fallback when Jira search fails', async () => {
      mockRequestJira.mockRejectedValue(new Error('Jira Down'));
      const plan = await getProjectPlan('TEST', mockStorage);
      expect(plan.tasks.length).toBeGreaterThan(0);
      expect(plan.isLiveSynced).toBe(false);
    });

    it('retrieves plan from PlanRepository fallback when live issues and schedule map are empty', async () => {
      const emptyStorage = new MockStorage();
      const repo = new PlanRepository(emptyStorage);
      await repo.saveProjectPlan({
        planId: 'plan-EMPTY',
        projectKey: 'EMPTY',
        projectName: 'Project EMPTY',
        overallProjectCompletion: 0,
        overallTargetCompletion: 0,
        weeks: DEFAULT_WEEKS,
        tasks: [
          {
            id: 't-cached',
            key: 'EMPTY-1',
            summary: 'Cached Task',
            epic: 'Infra',
            story: 'Core',
            effortHours: 16,
            resource: 'Resource 1',
            progress: 10,
            targetProgress: 20,
            status: 'IN_PROGRESS',
            startDate: '2026-08-05',
            endDate: '2026-08-26',
            startWeek: '05-Aug',
            endWeek: '26-Aug',
            spanWeeks: 4,
            weeklyAllocations: { '05-Aug': 25, '12-Aug': 25, '19-Aug': 25, '26-Aug': 25 },
            subtasks: []
          }
        ],
        milestones: DEFAULT_MILESTONES,
        columnWidths: DEFAULT_COLUMN_WIDTHS,
        availableEpics: [],
        availableUsers: [],
        lastUpdated: new Date().toISOString()
      });

      mockRequestJira.mockImplementation(async (routeStr: any) => {
        const url = String(routeStr);
        if (url.includes('/rest/api/3/search/jql')) {
          return { status: 200, json: async () => ({ issues: [] }) };
        }
        return { status: 200, json: async () => [] };
      });

      const plan = await getProjectPlan('EMPTY', emptyStorage);
      expect(plan.tasks.length).toBe(1);
      expect(plan.tasks[0].key).toBe('EMPTY-1');
    });
  });

  describe('scheduleBacklogTask', () => {
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

    it('applies default field values when optional attributes are empty', async () => {
      const res = await createInlineTask(
        {
          projectKey: 'TEST',
          summary: 'Defaulted task'
        },
        mockStorage
      );

      expect(res.success).toBe(true);
      expect(res.task?.epic).toBe('General');
      expect(res.task?.story).toBe('Task');
      expect(res.task?.effortHours).toBe(40);
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
      expect(modified?.effortHours).toBe(80);
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
      expect(modified?.effortHours).toBe(24);
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

    it('defaults triggerPercent to 30 when undefined in updateWbsTask dependency', async () => {
      const updatedPlan = await updateWbsTask(
        {
          projectKey: 'TEST',
          taskId: 'TEST-1',
          updates: {
            dependency: {
              predecessorId: 'TEST-2',
              predecessorKey: 'TEST-2',
              triggerPercent: undefined as any,
              isTriggerSatisfied: false
            }
          }
        },
        mockStorage
      );

      const modified = updatedPlan.tasks.find(t => t.key === 'TEST-1');
      expect(modified?.dependency?.triggerPercent).toBe(30);
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
      expect(parent?.effortConfig?.subtasks.length).toBeGreaterThanOrEqual(1);
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
      expect(item?.effortConfig?.subtasks.length).toBeGreaterThan(0);
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
      expect(successor?.dependency?.violationReason).toContain('threshold: 90%');
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
              predecessorId: 'P-1',
              predecessorKey: 'P-1',
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

  describe('getPortfolioResourceHeatmap', () => {
    it('returns portfolio rows and weeks and handles cached metadata', async () => {
      const first = await getPortfolioResourceHeatmap('TEST', { project: 'ALL' }, mockStorage);
      expect(first.rows.length).toBeGreaterThanOrEqual(2);

      const second = await getPortfolioResourceHeatmap('TEST', { project: 'ALL' }, mockStorage);
      expect(second.rows.length).toBe(first.rows.length);
    });

    it('handles plan whose weeks do not carry isCurrentWeek', async () => {
      const customStorage = new MockStorage();
      const repo = new PlanRepository(customStorage);
      const weeksWithoutCurrent = DEFAULT_WEEKS.map(w => ({ ...w, isCurrentWeek: false }));
      await repo.saveProjectPlan({
        planId: 'plan-NO-CUR',
        projectKey: 'NOCUR',
        projectName: 'No Current Week Project',
        overallProjectCompletion: 0,
        overallTargetCompletion: 0,
        weeks: weeksWithoutCurrent,
        tasks: [],
        milestones: [],
        columnWidths: DEFAULT_COLUMN_WIDTHS,
        availableEpics: [],
        availableUsers: [],
        lastUpdated: new Date().toISOString()
      });
      mockRequestJira.mockImplementation(async (routeStr: any) => {
        const url = String(routeStr);
        if (url.includes('/rest/api/3/search/jql')) {
          return { status: 200, json: async () => ({ issues: [] }) };
        }
        return { status: 200, json: async () => [] };
      });
      const res = await getPortfolioResourceHeatmap('NOCUR', {}, customStorage);
      expect(res.weeks).toBeDefined();
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

  describe('Forge Resolver Definitions (handler)', () => {
    it('handles bridge invocations for getProjectPlan with context fallback', async () => {
      const resContext: any = await handler({
        call: { functionKey: 'getProjectPlan' },
        context: { extension: { project: { key: 'TEST' } } }
      } as any);
      expect(resContext.projectKey).toBe('TEST');

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

    it('handles bridge invocations for getPortfolioResourceHeatmap with context fallback', async () => {
      const resCtx: any = await handler({
        call: { functionKey: 'getPortfolioResourceHeatmap' },
        context: { extension: { project: { key: 'TEST' } } }
      } as any);
      expect(resCtx.rows).toBeDefined();

      const resDef: any = await handler({
        call: { functionKey: 'getPortfolioResourceHeatmap' },
        context: {}
      } as any);
      expect(resDef.rows).toBeDefined();
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
      mockRequestJira.mockResolvedValueOnce({ status: 404 });
      const res1 = await mirrorDependencyToJira('TEST-2', 'TEST-1');
      expect(res1.linked).toBe(false);

      mockRequestJira.mockRejectedValueOnce(new Error('Link error'));
      const res2 = await mirrorDependencyToJira('TEST-2', 'TEST-1');
      expect(res2.linked).toBe(false);
      expect(res2.error).toBe('Link error');
    });
  });
});
