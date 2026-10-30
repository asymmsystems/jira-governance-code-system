import {
  validateTransition,
  getIssueChecklist,
  toggleChecklistItem,
  resetChecklist,
  renderIssuePanel,
  handler,
  setGlobalStorageProvider,
  resolveStorage,
  fetchLiveJiraIssue,
  fetchJiraUser
} from '../src/index';
import { StorageProvider } from '../src/storage/checklist-repository';
import { ChecklistEngine, DEFAULT_DEFINITION_OF_DONE, BUG_DEFINITION_OF_DONE, STORY_DEFINITION_OF_DONE } from '../src/domain/checklist-engine';

const mockRequestJira = jest.fn();
jest.mock('@forge/api', () => ({
  __esModule: true,
  default: {
    asApp: () => ({
      requestJira: mockRequestJira
    })
  },
  route: (strings: any, ...values: any[]) => strings.join('')
}));

jest.mock('@forge/kvs', () => ({
  kvs: {
    get: jest.fn().mockResolvedValue({ dummy: 'val' }),
    set: jest.fn().mockResolvedValue(undefined),
    delete: jest.fn().mockResolvedValue(undefined)
  }
}));

class MockStorage implements StorageProvider {
  private store: Map<string, any> = new Map();

  async get<T>(key: string): Promise<T | undefined> {
    return this.store.get(key);
  }

  async set(key: string, value: any): Promise<void> {
    this.store.set(key, value);
  }

  async delete(key: string): Promise<void> {
    this.store.delete(key);
  }
}

describe('DefinitionGuard Index / Forge Handlers', () => {
  let mockStorage: MockStorage;

  beforeEach(() => {
    mockStorage = new MockStorage();
    setGlobalStorageProvider(mockStorage);
    mockRequestJira.mockReset();
    mockRequestJira.mockResolvedValue({
      status: 200,
      json: async () => ({ id: 'live-id', displayName: 'Mock User', fields: { issuetype: { name: 'Task' } } })
    });
  });

  describe('fetchLiveJiraIssue and fetchJiraUser', () => {
    it('fetches live Jira issue successfully', async () => {
      const issue = await fetchLiveJiraIssue('TEST-10');
      expect(issue).toBeDefined();
      expect(issue.id).toBe('live-id');
    });

    it('returns null on fetchLiveJiraIssue failure or non-200', async () => {
      mockRequestJira.mockResolvedValueOnce({ status: 404 });
      const issue = await fetchLiveJiraIssue('TEST-404');
      expect(issue).toBeNull();

      mockRequestJira.mockRejectedValueOnce(new Error('Network error'));
      const issueErr = await fetchLiveJiraIssue('TEST-ERR');
      expect(issueErr).toBeNull();
    });

    it('fetches Jira user display name successfully', async () => {
      const name = await fetchJiraUser('acc-1');
      expect(name).toBe('Mock User');
    });

    it('falls back to accountId on user fetch failure', async () => {
      mockRequestJira.mockResolvedValueOnce({ status: 404 });
      const name = await fetchJiraUser('acc-404');
      expect(name).toBe('acc-404');

      mockRequestJira.mockRejectedValueOnce(new Error('API error'));
      const nameErr = await fetchJiraUser('acc-err');
      expect(nameErr).toBe('acc-err');
    });
  });

  describe('validateTransition', () => {
    it('returns error when issue context is missing', async () => {
      const res = await validateTransition({}, {}, mockStorage);
      expect(res.result).toBe(false);
      expect(res.errorMessage).toContain('Missing issue context');
    });

    it('resolves issueId from issueKey when issue.id is omitted in transition payload', async () => {
      mockRequestJira.mockResolvedValueOnce({
        status: 200,
        json: async () => ({ id: 'resolved-issue-id' })
      });

      const res = await validateTransition({ issue: { key: 'KEY-ONLY-1' } }, {}, mockStorage);
      expect(res.result).toBe(false);
      expect(res.errorMessage).toContain('Definition of Done incomplete:');
    });

    it('falls back to issueKey when live resolution returns null id', async () => {
      mockRequestJira.mockResolvedValueOnce({ status: 500 });

      const res = await validateTransition({ issue: { key: 'KEY-ONLY-FALLBACK' } }, {}, mockStorage);
      expect(res.result).toBe(false);
      expect(res.errorMessage).toContain('Definition of Done incomplete:');
    });

    it('blocks transition when checklist is not completed', async () => {
      const res = await validateTransition({ issue: { id: 'issue-10', key: 'TEST-10' } }, {}, mockStorage);
      expect(res.result).toBe(false);
      expect(res.errorMessage).toContain('Definition of Done incomplete:');
    });

    it('allows transition when all mandatory checklist items are complete', async () => {
      const state = await getIssueChecklist({ issueId: 'issue-10', issueKey: 'TEST-10' }, {}, mockStorage);
      for (const item of state.items) {
        if (item.isMandatory) {
          await toggleChecklistItem(
            { issueId: 'issue-10', issueKey: 'TEST-10', itemId: item.id, isCompleted: true, userId: 'tester' },
            {},
            mockStorage
          );
        }
      }

      const res = await validateTransition({ issue: { id: 'issue-10', key: 'TEST-10' } }, {}, mockStorage);
      expect(res.result).toBe(true);
    });
  });

  describe('getIssueChecklist and Category-Specific DoD', () => {
    it('throws error when issueId is missing', async () => {
      await expect(getIssueChecklist({}, {}, mockStorage)).rejects.toThrow('Missing issueId');
    });

    it('initializes category-specific DoD for Bug issue type', async () => {
      mockRequestJira.mockResolvedValueOnce({
        status: 200,
        json: async () => ({ fields: { issuetype: { name: 'Bug' } } })
      });

      const state = await getIssueChecklist({ issueId: 'issue-bug', issueKey: 'BUG-1' }, {}, mockStorage);
      expect(state.templateId).toBe('template-bug-dod');
      expect(state.items.length).toBe(BUG_DEFINITION_OF_DONE.items.length);
    });

    it('initializes category-specific DoD for Story issue type', async () => {
      const state = await getIssueChecklist(
        { issueId: 'issue-story', issueKey: 'STORY-1' },
        { extension: { issue: { id: 'issue-story', key: 'STORY-1', type: 'Story' } } },
        mockStorage
      );
      expect(state.templateId).toBe('template-story-dod');
      expect(state.items.length).toBe(STORY_DEFINITION_OF_DONE.items.length);
    });

    it('initializes default checklist when issue type is generic', async () => {
      const state1 = await getIssueChecklist({ issueId: 'issue-20', issueKey: 'TEST-20' }, {}, mockStorage);
      expect(state1.items.length).toBe(DEFAULT_DEFINITION_OF_DONE.items.length);

      const state2 = await getIssueChecklist({ issueId: 'issue-20' }, {}, mockStorage);
      expect(state2.checklistHash).toBe(state1.checklistHash);
    });
  });

  describe('toggleChecklistItem', () => {
    it('throws error when issueId or itemId is missing', async () => {
      await expect(toggleChecklistItem({ issueId: 'issue-1' }, {}, mockStorage)).rejects.toThrow(
        'Missing issueId or itemId'
      );
    });

    it('toggles item status and updates attribution with display name', async () => {
      const state = await getIssueChecklist({ issueId: 'issue-30', issueKey: 'TEST-30' }, {}, mockStorage);
      const targetItem = state.items[0];

      const updated = await toggleChecklistItem(
        {
          issueId: 'issue-30',
          issueKey: 'TEST-30',
          itemId: targetItem.id,
          isCompleted: true,
          notes: 'QA approved'
        },
        { accountId: 'acc-123' },
        mockStorage
      );

      const itemAfter = updated.items.find((i: any) => i.id === targetItem.id);
      expect(itemAfter?.isCompleted).toBe(true);
      expect(itemAfter?.completedBy).toBe('Mock User');
      expect(itemAfter?.notes).toBe('QA approved');
    });

    it('initializes state on toggleChecklistItem when state does not exist in storage', async () => {
      const res = await toggleChecklistItem(
        {
          issueId: 'new-issue-99',
          itemId: DEFAULT_DEFINITION_OF_DONE.items[0].id,
          isCompleted: true
        },
        {},
        mockStorage
      );
      expect(res.issueId).toBe('new-issue-99');
      expect(res.items.find(i => i.id === DEFAULT_DEFINITION_OF_DONE.items[0].id)?.isCompleted).toBe(true);
    });
  });

  describe('resetChecklist', () => {
    it('throws error when issueId is missing', async () => {
      await expect(resetChecklist({}, {}, mockStorage)).rejects.toThrow('Missing issueId');
    });

    it('resets checklist back to initial uncompleted state and updates property', async () => {
      await getIssueChecklist({ issueId: 'issue-40', issueKey: 'TEST-40' }, {}, mockStorage);
      await toggleChecklistItem(
        { issueId: 'issue-40', itemId: DEFAULT_DEFINITION_OF_DONE.items[0].id, isCompleted: true },
        {},
        mockStorage
      );

      const resetState = await resetChecklist({ issueId: 'issue-40', issueKey: 'TEST-40' }, {}, mockStorage);
      expect(resetState.items.every((i: any) => !i.isCompleted)).toBe(true);
      expect(resetState.isFullySatisfied).toBe(false);
    });
  });

  describe('renderIssuePanel', () => {
    it('returns issue panel metadata', async () => {
      const panel = await renderIssuePanel({ test: true });
      expect(panel.moduleKey).toBe('definitionguard-panel');
    });
  });

  describe('handler (Forge resolver dispatcher)', () => {
    it('dispatches getChecklist', async () => {
      const res: any = await handler({
        call: {
          functionKey: 'getChecklist',
          payload: { issueId: 'issue-50', issueKey: 'TEST-50' }
        }
      } as any);
      expect(res.issueId).toBe('issue-50');
    });

    it('dispatches toggleItem', async () => {
      await handler({
        call: {
          functionKey: 'getChecklist',
          payload: { issueId: 'issue-60', issueKey: 'TEST-60' }
        }
      } as any);

      const res: any = await handler({
        call: {
          functionKey: 'toggleItem',
          payload: {
            issueId: 'issue-60',
            itemId: DEFAULT_DEFINITION_OF_DONE.items[0].id,
            isCompleted: true
          }
        }
      } as any);
      expect(res.items.find((i: any) => i.id === DEFAULT_DEFINITION_OF_DONE.items[0].id)?.isCompleted).toBe(true);
    });

    it('dispatches resetChecklist', async () => {
      const res: any = await handler({
        call: {
          functionKey: 'resetChecklist',
          payload: { issueId: 'issue-70', issueKey: 'TEST-70' }
        }
      } as any);
      expect(res.issueId).toBe('issue-70');
    });

    it('throws error on unsupported call', async () => {
      await expect(
        handler({
          call: { functionKey: 'unknownAction' }
        } as any)
      ).rejects.toThrow("Resolver has no definition for 'unknownAction'");
    });

    it('falls back to context when payload issueId is omitted and throws if both omitted', async () => {
      const resContext: any = await handler({
        call: { functionKey: 'getChecklist' },
        context: { extension: { issue: { id: 'ctx-issue-1', key: 'CTX-1' } } }
      } as any);
      expect(resContext.issueId).toBe('ctx-issue-1');

      await expect(
        handler({
          call: { functionKey: 'getChecklist' },
          context: {}
        } as any)
      ).rejects.toThrow('DefinitionGuard: Missing issueId.');

      const toggleCtx: any = await handler({
        call: {
          functionKey: 'toggleItem',
          payload: { itemId: DEFAULT_DEFINITION_OF_DONE.items[0].id, isCompleted: true }
        },
        context: { extension: { issue: { id: 'ctx-issue-2', key: 'CTX-2' } } }
      } as any);
      expect(toggleCtx.issueId).toBe('ctx-issue-2');

      const resetCtx: any = await handler({
        call: { functionKey: 'resetChecklist' },
        context: { extension: { issue: { id: 'ctx-issue-3', key: 'CTX-3' } } }
      } as any);
      expect(resetCtx.issueId).toBe('ctx-issue-3');
    });
  });

  describe('Storage Resolution and Edge Cases', () => {
    it('throws error in test mode when resolveStorage is called without provider', () => {
      setGlobalStorageProvider(null);
      expect(() => resolveStorage()).toThrow('DefinitionGuard: StorageProvider must be initialized.');
    });

    it('uses ForgeKvsProvider in non-test mode and handles operations and kvs errors', async () => {
      const origEnv = process.env.NODE_ENV;
      try {
        process.env.NODE_ENV = 'production';
        setGlobalStorageProvider(null);
        const { kvs } = require('@forge/kvs');
        const storage = resolveStorage();
        expect(storage).toBeDefined();

        await storage.set('test-key', { a: 1 });
        expect(kvs.set).toHaveBeenCalledWith('test-key', { a: 1 });

        const val = await storage.get('test-key');
        expect(val).toEqual({ dummy: 'val' });

        await storage.delete('test-key');
        expect(kvs.delete).toHaveBeenCalledWith('test-key');

        (kvs.get as jest.Mock).mockRejectedValueOnce(new Error('KVS get failed'));
        await expect(storage.get('error-key')).rejects.toThrow('KVS get failed');
      } finally {
        process.env.NODE_ENV = origEnv;
      }
    });

    it('covers getAvailableTemplates via handler and reset with explicit templateId', async () => {
      const templatesRes: any = await handler({
        call: { functionKey: 'getAvailableTemplates' }
      } as any);
      expect(Array.isArray(templatesRes)).toBe(true);
      expect(templatesRes.length).toBeGreaterThanOrEqual(4);

      const resetCustom = await resetChecklist(
        { issueId: 'custom-reset-1', issueKey: 'CR-1', templateId: 'template-bug-dod' },
        {},
        mockStorage
      );
      expect(resetCustom.templateId).toBe('template-bug-dod');
    });

    it('covers validateTransition fallback lookup by issueKey', async () => {
      // Save checklist with issueKey CR-2 but query with issueId different
      const initial = ChecklistEngine.initializeState('cr-key-only', 'CR-2');
      await mockStorage.set('issue:CR-2', initial);

      const result = await validateTransition(
        { issue: { id: 'mismatched-id', key: 'CR-2' } },
        {},
        mockStorage
      );
      expect(result.result).toBe(false);
    });

    it('retroactively resolves raw account IDs in existing checklist items and history', async () => {
      const existing = ChecklistEngine.initializeState('issue-retro-1', 'RETRO-1');
      existing.items[0].isCompleted = true;
      existing.items[0].completedBy = '712020:raw-acc-id';
      existing.items[0].history = [
        { action: 'TICK', userId: '712020:raw-acc-id', timestamp: '2026-10-29T10:00:00Z' },
        { action: 'UNTICK', userId: '712020:raw-acc-id', timestamp: '2026-10-29T11:00:00Z' }
      ];
      await mockStorage.set('dg:checklist:issue-retro-1', existing);

      mockRequestJira.mockResolvedValue({
        status: 200,
        json: async () => ({ displayName: 'Audited Lead' })
      });

      const resolvedState = await getIssueChecklist({ issueId: 'issue-retro-1' }, {}, mockStorage);
      expect(resolvedState.items[0].completedBy).toBe('Audited Lead');
      expect(resolvedState.items[0].history?.[0].userId).toBe('Audited Lead');
      expect(resolvedState.items[0].history?.[1].userId).toBe('Audited Lead');
    });

    it('handles user fetch failures gracefully during retroactive resolution', async () => {
      const existing = ChecklistEngine.initializeState('issue-retro-2', 'RETRO-2');
      existing.items[0].completedBy = '712020:err-acc-id';
      existing.items[0].history = [
        { action: 'UNTICK', userId: '712020:err-acc-id', timestamp: '2026-10-29T11:00:00Z' }
      ];
      await mockStorage.set('dg:checklist:issue-retro-2', existing);

      mockRequestJira.mockRejectedValue(new Error('API user lookup failure'));

      const res = await getIssueChecklist({ issueId: 'issue-retro-2' }, {}, mockStorage);
      expect(res.items[0].completedBy).toBe('712020:err-acc-id');
    });

    it('toggles checklist item with accountId context and notes', async () => {
      mockRequestJira.mockResolvedValueOnce({
        status: 200,
        json: async () => ({ displayName: 'Reviewer Alice' })
      });

      const updated = await toggleChecklistItem(
        { issueId: 'toggle-ctx-1', itemId: 'item-unit-tests', isCompleted: true, notes: 'Verified in QA' },
        { accountId: 'acc-alice-123' },
        mockStorage
      );
      expect(updated.items[0].isCompleted).toBe(true);
      expect(updated.items[0].completedBy).toBe('Reviewer Alice');
    });

    it('toggles item on an uninitialized issue and initializes default state', async () => {
      mockRequestJira.mockResolvedValueOnce({
        status: 200,
        json: async () => ({ fields: { issuetype: { name: 'Bug' } } })
      });

      const updated = await toggleChecklistItem(
        { issueId: 'toggle-new-1', issueKey: 'NEW-1', itemId: 'item-bug-root-cause', isCompleted: true },
        {},
        mockStorage
      );
      expect(updated.issueId).toBe('toggle-new-1');
      expect(updated.templateId).toBe('template-bug-dod');
    });

    it('covers saveProjectTemplate and getProjectTemplates via handler', async () => {
      const tmpl = {
        id: 'tmpl-custom',
        name: 'Custom Task',
        items: [{ id: 'i1', title: 'Task Done', isMandatory: true, category: 'GENERAL' }]
      };
      const saveRes: any = await handler({
        call: {
          functionKey: 'saveProjectTemplate',
          payload: { projectKey: 'PROJ-TEST', issueType: 'Task', template: tmpl }
        },
        context: { accountId: 'admin-acc' }
      } as any);
      expect(saveRes.success).toBe(true);

      const getRes: any = await handler({
        call: {
          functionKey: 'getProjectTemplates',
          payload: { projectKey: 'PROJ-TEST' }
        }
      } as any);
      expect(getRes.templates['Task']).toBeDefined();
      expect(getRes.templates['Task'].id).toBe('tmpl-custom');

      // Update existing config
      const saveRes2: any = await handler({
        call: {
          functionKey: 'saveProjectTemplate',
          payload: { projectKey: 'PROJ-TEST', issueType: 'Bug', template: tmpl }
        },
        context: { accountId: 'admin-acc' }
      } as any);
      expect(saveRes2.success).toBe(true);
    });

    it('covers resetChecklist with accountId resolving to displayName', async () => {
      const existing = ChecklistEngine.initializeState('reset-acc-1', 'RST-1');
      await mockStorage.set('dg:checklist:reset-acc-1', existing);

      mockRequestJira.mockResolvedValueOnce({
        status: 200,
        json: async () => ({ displayName: 'Audited Lead' })
      });
      const reset = await resetChecklist(
        { issueId: 'reset-acc-1' },
        { accountId: 'acc-lead-99' },
        mockStorage
      );
      expect(reset.items.every(i => !i.isCompleted)).toBe(true);
      expect(reset.auditTrail?.[reset.auditTrail.length - 1].actorName).toBe('Audited Lead');
    });

    it('covers validateTransition with context.extension.issue', async () => {
      const res = await validateTransition(
        { issue: { id: 'ctx-issue-1' } },
        { extension: { issue: { type: 'Bug' } } },
        mockStorage
      );
      expect(res.result).toBe(false);
      expect(res.errorMessage).toContain('Definition of Done incomplete:');
    });

    it('covers context project key and anonymous userId branches', async () => {
      const saveRes: any = await handler({
        call: {
          functionKey: 'saveProjectTemplate',
          payload: { issueType: 'Task', template: { id: 't1', name: 'T', items: [] } }
        },
        context: { extension: { project: { key: 'CTX-PRJ' } } }
      } as any);
      expect(saveRes.success).toBe(true);

      const getRes: any = await handler({
        call: { functionKey: 'getProjectTemplates' },
        context: { extension: { project: { key: 'CTX-PRJ' } } }
      } as any);
      expect(getRes.projectKey).toBe('CTX-PRJ');

      // Toggle with anonymous userId
      const state = ChecklistEngine.initializeState('anon-1', 'ANON-1');
      await mockStorage.set('dg:checklist:anon-1', state);
      const updated = await toggleChecklistItem(
        { issueId: 'anon-1', itemId: state.items[0].id, isCompleted: true, userId: 'anonymous' },
        {},
        mockStorage
      );
      expect(updated.items[0].isCompleted).toBe(true);
    });
  });
});

