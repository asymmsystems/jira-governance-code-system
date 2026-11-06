/**
 * Tests of the v1 checklist engine and the built-in templates.
 *
 * Copyright (c) 2026 Asymm Systems. All rights reserved.
 * @author Fahim Farook
 */
import { ChecklistEngine, DEFAULT_DEFINITION_OF_DONE, getTemplateForCategory } from '../../src/domain/checklist-engine';
import { ChecklistTemplate } from '../../src/domain/models';

describe('ChecklistEngine', () => {
  const customTemplate: ChecklistTemplate = {
    id: 'custom-template-1',
    name: 'Microservice DoD',
    description: 'Custom checklist for microservices',
    items: [
      {
        id: 'c-1',
        title: 'Docker image scanned',
        isMandatory: true,
        category: 'SECURITY'
      },
      {
        id: 'c-2',
        title: 'Changelog updated',
        isMandatory: false,
        category: 'DOCUMENTATION'
      }
    ]
  };

  it('initializes issue checklist state with default template', () => {
    const state = ChecklistEngine.initializeState('issue-100', 'PROJ-100');

    expect(state.issueId).toBe('issue-100');
    expect(state.issueKey).toBe('PROJ-100');
    expect(state.templateId).toBe(DEFAULT_DEFINITION_OF_DONE.id);
    expect(state.items.length).toBe(DEFAULT_DEFINITION_OF_DONE.items.length);
    expect(state.isFullySatisfied).toBe(false);
    expect(state.checklistHash).toBeDefined();
  });

  it('initializes issue checklist state with custom template and user attribution', () => {
    const state = ChecklistEngine.initializeState('issue-200', 'PROJ-200', customTemplate, 'author-123', '2026-10-29T10:00:00Z');

    expect(state.templateId).toBe('custom-template-1');
    expect(state.items.length).toBe(2);
    expect(state.lastModifiedBy).toBe('author-123');
    expect(state.lastModifiedAt).toBe('2026-10-29T10:00:00Z');
  });

  it('calculates metrics correctly for partial and complete states', () => {
    let state = ChecklistEngine.initializeState('issue-300', 'PROJ-300', customTemplate);
    let metrics = ChecklistEngine.calculateMetrics(state);

    expect(metrics.totalItems).toBe(2);
    expect(metrics.completedItems).toBe(0);
    expect(metrics.mandatoryItems).toBe(1);
    expect(metrics.completedMandatoryItems).toBe(0);
    expect(metrics.completionPercentage).toBe(0);
    expect(metrics.isFullySatisfied).toBe(false);

    // Complete the mandatory item
    state = ChecklistEngine.toggleItem(state, {
      issueId: 'issue-300',
      issueKey: 'PROJ-300',
      itemId: 'c-1',
      isCompleted: true,
      userId: 'eng-1'
    });

    metrics = ChecklistEngine.calculateMetrics(state);
    expect(metrics.completedItems).toBe(1);
    expect(metrics.completedMandatoryItems).toBe(1);
    expect(metrics.completionPercentage).toBe(50);
    expect(metrics.isFullySatisfied).toBe(true);

    // Complete the optional item
    state = ChecklistEngine.toggleItem(state, {
      issueId: 'issue-300',
      issueKey: 'PROJ-300',
      itemId: 'c-2',
      isCompleted: true,
      userId: 'eng-1'
    });

    metrics = ChecklistEngine.calculateMetrics(state);
    expect(metrics.completionPercentage).toBe(100);
    expect(metrics.isFullySatisfied).toBe(true);
  });

  it('handles empty item list metrics calculation gracefully', () => {
    const emptyTemplate: ChecklistTemplate = {
      id: 'empty',
      name: 'Empty',
      description: 'Empty template',
      items: []
    };
    const state = ChecklistEngine.initializeState('issue-empty', 'PROJ-EMPTY', emptyTemplate);
    const metrics = ChecklistEngine.calculateMetrics(state);

    expect(metrics.totalItems).toBe(0);
    expect(metrics.completionPercentage).toBe(100);
    expect(metrics.isFullySatisfied).toBe(true);
  });

  it('toggles item to completed with user, timestamp, and optional notes', () => {
    const state = ChecklistEngine.initializeState('issue-400', 'PROJ-400', customTemplate);
    const updated = ChecklistEngine.toggleItem(
      state,
      {
        issueId: 'issue-400',
        issueKey: 'PROJ-400',
        itemId: 'c-1',
        isCompleted: true,
        userId: 'auditor-9',
        notes: 'Verified scan in Trivy'
      },
      '2026-10-29T12:00:00Z'
    );

    const item = updated.items.find(i => i.id === 'c-1');
    expect(item?.isCompleted).toBe(true);
    expect(item?.completedBy).toBe('auditor-9');
    expect(item?.completedAt).toBe('2026-10-29T12:00:00Z');
    expect(item?.notes).toBe('Verified scan in Trivy');
    expect(updated.lastModifiedBy).toBe('auditor-9');
    expect(updated.lastModifiedAt).toBe('2026-10-29T12:00:00Z');
  });

  it('uncompletes an item and clears completion attribution', () => {
    let state = ChecklistEngine.initializeState('issue-500', 'PROJ-500', customTemplate);
    state = ChecklistEngine.toggleItem(state, {
      issueId: 'issue-500',
      issueKey: 'PROJ-500',
      itemId: 'c-1',
      isCompleted: true,
      userId: 'user-1'
    });

    const untoggled = ChecklistEngine.toggleItem(state, {
      issueId: 'issue-500',
      issueKey: 'PROJ-500',
      itemId: 'c-1',
      isCompleted: false,
      userId: 'user-2'
    });

    const item = untoggled.items.find(i => i.id === 'c-1');
    expect(item?.isCompleted).toBe(false);
    expect(item?.completedBy).toBeUndefined();
    expect(item?.completedAt).toBeUndefined();
    expect(untoggled.isFullySatisfied).toBe(false);
  });

  it('throws an error when toggling an item that does not exist', () => {
    const state = ChecklistEngine.initializeState('issue-600', 'PROJ-600', customTemplate);

    expect(() => {
      ChecklistEngine.toggleItem(state, {
        issueId: 'issue-600',
        issueKey: 'PROJ-600',
        itemId: 'non-existent-item',
        isCompleted: true,
        userId: 'user-1'
      });
    }).toThrow("Checklist item with id 'non-existent-item' not found on issue PROJ-600");
  });

  it('tests template helpers and category selection', () => {
    const {
      getAvailableTemplates,
      getTemplateById,
      getTemplateForCategory,
      BUG_DEFINITION_OF_DONE,
      STORY_DEFINITION_OF_DONE,
      TASK_DEFINITION_OF_DONE
    } = require('../../src/domain/checklist-engine');

    expect(getAvailableTemplates().length).toBeGreaterThanOrEqual(4);
    expect(getTemplateById('template-bug-dod')).toBe(BUG_DEFINITION_OF_DONE);
    expect(getTemplateById('non-existent')).toBeUndefined();
    expect(getTemplateById(undefined)).toBeUndefined();

    expect(getTemplateForCategory('Incident')).toBe(BUG_DEFINITION_OF_DONE);
    expect(getTemplateForCategory('Defect')).toBe(BUG_DEFINITION_OF_DONE);
    expect(getTemplateForCategory('Feature')).toBe(STORY_DEFINITION_OF_DONE);
    expect(getTemplateForCategory('Enhancement')).toBe(STORY_DEFINITION_OF_DONE);
    expect(getTemplateForCategory('Chore')).toBe(TASK_DEFINITION_OF_DONE);
    expect(getTemplateForCategory('Refactor')).toBe(TASK_DEFINITION_OF_DONE);
    expect(getTemplateForCategory('Maintenance')).toBe(TASK_DEFINITION_OF_DONE);
    expect(getTemplateForCategory('Unknown')).toBe(DEFAULT_DEFINITION_OF_DONE);
  });

  it('records untick audit history and caps notes to 500 characters', () => {
    let state = ChecklistEngine.initializeState('issue-700', 'PROJ-700', customTemplate);
    const longNote = 'a'.repeat(600);

    state = ChecklistEngine.toggleItem(state, {
      issueId: 'issue-700',
      issueKey: 'PROJ-700',
      itemId: 'c-1',
      isCompleted: true,
      userId: 'tester',
      userAccountId: 'acc-tester',
      notes: longNote
    });

    const item = state.items.find(i => i.id === 'c-1');
    expect(item?.notes?.length).toBe(500);
    expect(item?.completedByAccountId).toBe('acc-tester');
    expect(item?.history?.length).toBe(1);
    expect(item?.history?.[0].action).toBe('TICK');

    // Untick
    state = ChecklistEngine.toggleItem(state, {
      issueId: 'issue-700',
      issueKey: 'PROJ-700',
      itemId: 'c-1',
      isCompleted: false,
      userId: 'reviewer',
      userAccountId: 'acc-reviewer'
    });

    const unticked = state.items.find(i => i.id === 'c-1');
    expect(unticked?.isCompleted).toBe(false);
    expect(unticked?.history?.length).toBe(2);
    expect(unticked?.history?.[1].action).toBe('UNTICK');
    expect(unticked?.history?.[1].userId).toBe('reviewer');
  });

  it('recognizes JSM issue types and custom template mappings', () => {
    const {
      getTemplateForCategory,
      SERVICE_REQUEST_DEFINITION_OF_DONE,
      IT_HELP_DEFINITION_OF_DONE
    } = require('../../src/domain/checklist-engine');

    expect(getTemplateForCategory('Service Request')).toBe(SERVICE_REQUEST_DEFINITION_OF_DONE);
    expect(getTemplateForCategory('service_request')).toBe(SERVICE_REQUEST_DEFINITION_OF_DONE);
    expect(getTemplateForCategory('general request')).toBe(SERVICE_REQUEST_DEFINITION_OF_DONE);
    expect(getTemplateForCategory('IT Help')).toBe(IT_HELP_DEFINITION_OF_DONE);
    expect(getTemplateForCategory('it_help')).toBe(IT_HELP_DEFINITION_OF_DONE);
    expect(getTemplateForCategory('help desk')).toBe(IT_HELP_DEFINITION_OF_DONE);
    expect(getTemplateForCategory('support')).toBe(IT_HELP_DEFINITION_OF_DONE);

    const custom: Record<string, any> = {
      'Security Review': customTemplate,
      'devops': customTemplate
    };
    expect(getTemplateForCategory('Security Review', custom)).toBe(customTemplate);
    expect(getTemplateForCategory('DevOps', custom)).toBe(customTemplate);
  });

  it('tests resetChecklist and history overflow > 25', () => {
    let state = ChecklistEngine.initializeState('issue-800', 'PROJ-800', customTemplate);
    for (let i = 0; i < 30; i++) {
      state = ChecklistEngine.toggleItem(state, {
        issueId: 'issue-800',
        issueKey: 'PROJ-800',
        itemId: 'c-1',
        isCompleted: i % 2 === 0,
        userId: `user-${i}`
      });
    }
    const item = state.items.find(i => i.id === 'c-1');
    expect(item?.history?.length).toBe(25);

    const resetState = ChecklistEngine.resetChecklist(state, 'Reset Manager', 'acc-reset', '2026-10-30T00:00:00Z');
    expect(resetState.isFullySatisfied).toBe(false);
    expect(resetState.items.every(i => !i.isCompleted)).toBe(true);
    expect(resetState.auditTrail?.length).toBeGreaterThan(0);
    const lastEvent = resetState.auditTrail?.[resetState.auditTrail.length - 1];
    expect(lastEvent?.eventType).toBe('RESET');
    expect(lastEvent?.actorName).toBe('Reset Manager');
  });

  describe('v1 record edge cases (the format the migration reads)', () => {
    const bare = () => {
      const st: any = ChecklistEngine.initializeState('v1-1', 'V1-1', DEFAULT_DEFINITION_OF_DONE, 'system', '2026-01-01T00:00:00.000Z');
      delete st.stateVersion;
      delete st.auditTrail;
      return st;
    };

    it('matches no type when the issue type is missing', () => {
      expect(getTemplateForCategory(undefined).id).toBe(DEFAULT_DEFINITION_OF_DONE.id);
    });

    it('toggles a v1 record that has no version and no audit trail', () => {
      const next = ChecklistEngine.toggleItem(bare(), { issueId: 'v1-1', issueKey: 'V1-1', itemId: 'item-unit-tests', isCompleted: true, userId: 'u' });
      expect(next.stateVersion).toBe(2);
      expect(next.auditTrail).toHaveLength(1);
    });

    it('resets a v1 record with the default actor and time, and no version or trail', () => {
      const next = ChecklistEngine.resetChecklist(bare(), 'Admin');
      expect(next.stateVersion).toBe(2);
      expect(next.auditTrail![0]).toMatchObject({ eventType: 'RESET', actorAccountId: 'unknown' });
      expect(Number.isNaN(Date.parse(next.lastModifiedAt))).toBe(false);
    });
  });
});
