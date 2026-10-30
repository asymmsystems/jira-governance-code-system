import {
  ChecklistTemplate,
  ChecklistItemInstance,
  IssueChecklistState,
  ChecklistToggleRequest,
  ChecklistMetrics,
  ChecklistAuditEvent
} from './models';
import { calculateChecklistHash } from './hasher';

export const DEFAULT_DEFINITION_OF_DONE: ChecklistTemplate = {
  id: 'template-default-dod',
  name: 'Standard Engineering Definition of Done',
  description: 'Enterprise compliance, security, and quality gate for Jira Cloud',
  items: [
    {
      id: 'item-unit-tests',
      title: 'Automated test suite passes with zero regressions',
      description: 'All unit and integration tests run in CI/CD cleanly',
      isMandatory: true,
      category: 'TESTING'
    },
    {
      id: 'item-coverage-threshold',
      title: 'Branch test coverage meets or exceeds policy threshold',
      description: 'Mandatory >= 90% branch coverage on modified code',
      isMandatory: true,
      category: 'TESTING'
    },
    {
      id: 'item-peer-review',
      title: 'Peer code review approved by authorized reviewers',
      description: 'PR approved with no outstanding unresolved review comments',
      isMandatory: true,
      category: 'CODE_QUALITY'
    },
    {
      id: 'item-security-scan',
      title: 'Static analysis and dependency vulnerability scan clear',
      description: 'No Critical or High severity findings open',
      isMandatory: true,
      category: 'SECURITY'
    },
    {
      id: 'item-documentation',
      title: 'User documentation and API specifications updated',
      description: 'Changes documented in Confluence, OpenAPI, or README',
      isMandatory: false,
      category: 'DOCUMENTATION'
    },
    {
      id: 'item-compliance-evidence',
      title: 'Compliance and regulatory sign-off criteria satisfied',
      description: 'Evidence captured for SOC 2 and ISO 27001 audit trail',
      isMandatory: true,
      category: 'COMPLIANCE'
    }
  ]
};

export const BUG_DEFINITION_OF_DONE: ChecklistTemplate = {
  id: 'template-bug-dod',
  name: 'Bug Fix Definition of Done',
  description: 'Mandatory verification gate for defect remediation',
  items: [
    {
      id: 'item-bug-root-cause',
      title: 'Root cause analysis documented in issue description',
      description: 'Underlying defect trigger identified and recorded',
      isMandatory: true,
      category: 'CODE_QUALITY'
    },
    {
      id: 'item-bug-regression-test',
      title: 'Automated regression test reproduces defect and passes',
      description: 'Dedicated test added to prevent recurrence',
      isMandatory: true,
      category: 'TESTING'
    },
    {
      id: 'item-bug-staging-verification',
      title: 'Fix verified in staging environment',
      description: 'Confirmed working in pre-production environment',
      isMandatory: true,
      category: 'TESTING'
    },
    {
      id: 'item-bug-peer-review',
      title: 'Peer code review approved by authorized reviewers',
      description: 'PR approved with no outstanding unresolved review comments',
      isMandatory: true,
      category: 'CODE_QUALITY'
    },
    {
      id: 'item-bug-security',
      title: 'Security and regression scan clean',
      description: 'No new security vulnerabilities or regressions introduced',
      isMandatory: true,
      category: 'SECURITY'
    }
  ]
};

export const STORY_DEFINITION_OF_DONE: ChecklistTemplate = {
  id: 'template-story-dod',
  name: 'Feature & Story Definition of Done',
  description: 'Enterprise quality and compliance gate for feature releases',
  items: [
    {
      id: 'item-story-acceptance-criteria',
      title: 'Acceptance criteria validated against requirements',
      description: 'All functional criteria signed off',
      isMandatory: true,
      category: 'COMPLIANCE'
    },
    {
      id: 'item-story-unit-tests',
      title: 'Automated test suite passes with zero regressions',
      description: 'Unit and integration tests pass cleanly in CI/CD',
      isMandatory: true,
      category: 'TESTING'
    },
    {
      id: 'item-story-peer-review',
      title: 'Peer code review approved by authorized reviewers',
      description: 'PR approved with no unresolved comments',
      isMandatory: true,
      category: 'CODE_QUALITY'
    },
    {
      id: 'item-story-security',
      title: 'Static analysis and dependency vulnerability scan clear',
      description: 'No Critical or High severity findings open',
      isMandatory: true,
      category: 'SECURITY'
    },
    {
      id: 'item-story-documentation',
      title: 'User documentation and API specifications updated',
      description: 'Documentation updated for release',
      isMandatory: false,
      category: 'DOCUMENTATION'
    }
  ]
};

export const TASK_DEFINITION_OF_DONE: ChecklistTemplate = {
  id: 'template-task-dod',
  name: 'Technical Task Definition of Done',
  description: 'Verification checklist for engineering chores and refactoring tasks',
  items: [
    {
      id: 'item-task-unit-tests',
      title: 'Automated test suite passes with zero regressions',
      description: 'Existing tests continue to pass in CI/CD pipeline',
      isMandatory: true,
      category: 'TESTING'
    },
    {
      id: 'item-task-peer-review',
      title: 'Peer code review approved by authorized reviewers',
      description: 'PR approved with no unresolved comments',
      isMandatory: true,
      category: 'CODE_QUALITY'
    },
    {
      id: 'item-task-lint-clean',
      title: 'Static analysis and lint checks clean',
      description: 'Zero lint warnings or code style issues',
      isMandatory: true,
      category: 'CODE_QUALITY'
    }
  ]
};

export const SERVICE_REQUEST_DEFINITION_OF_DONE: ChecklistTemplate = {
  id: 'template-jsm-service-request',
  name: 'Service Desk Request Definition of Done',
  description: 'Verification gate for Jira Service Management requests (Fixes D-04)',
  items: [
    {
      id: 'item-jsm-req-verified',
      title: 'Customer request requirements verified and triaged',
      description: 'Request details and business impact verified',
      isMandatory: true,
      category: 'COMPLIANCE'
    },
    {
      id: 'item-jsm-approvals-obtained',
      title: 'Required administrative approvals captured',
      description: 'Manager or resource owner approval verified',
      isMandatory: true,
      category: 'COMPLIANCE'
    },
    {
      id: 'item-jsm-fulfillment-executed',
      title: 'Service fulfillment actions executed and tested',
      description: 'System changes, provisioning, or fixes applied',
      isMandatory: true,
      category: 'TESTING'
    },
    {
      id: 'item-jsm-customer-notified',
      title: 'Customer communication completed with resolution details',
      description: 'Resolution communicated via portal or email',
      isMandatory: true,
      category: 'DOCUMENTATION'
    }
  ]
};

export const IT_HELP_DEFINITION_OF_DONE: ChecklistTemplate = {
  id: 'template-jsm-it-help',
  name: 'IT Help Desk Definition of Done',
  description: 'Verification gate for IT Help tickets (Fixes D-04)',
  items: [
    {
      id: 'item-help-diagnosis',
      title: 'Diagnostic troubleshooting and root issue identified',
      description: 'Technical cause verified',
      isMandatory: true,
      category: 'CODE_QUALITY'
    },
    {
      id: 'item-help-resolution',
      title: 'Remediation applied and hardware/software operational',
      description: 'Service restored to operational baseline',
      isMandatory: true,
      category: 'TESTING'
    },
    {
      id: 'item-help-security-check',
      title: 'Access authorization and security baseline maintained',
      description: 'No unauthorized access or security policy bypass',
      isMandatory: true,
      category: 'SECURITY'
    },
    {
      id: 'item-help-feedback',
      title: 'Customer verification and sign-off confirmed',
      description: 'User confirmed satisfaction with resolution',
      isMandatory: false,
      category: 'COMPLIANCE'
    }
  ]
};

export const ALL_TEMPLATES: ChecklistTemplate[] = [
  DEFAULT_DEFINITION_OF_DONE,
  BUG_DEFINITION_OF_DONE,
  STORY_DEFINITION_OF_DONE,
  TASK_DEFINITION_OF_DONE,
  SERVICE_REQUEST_DEFINITION_OF_DONE,
  IT_HELP_DEFINITION_OF_DONE
];

export function getAvailableTemplates(): ChecklistTemplate[] {
  return ALL_TEMPLATES;
}

export function getTemplateById(id?: string): ChecklistTemplate | undefined {
  if (!id) return undefined;
  return ALL_TEMPLATES.find(t => t.id === id);
}

export function getTemplateForCategory(
  categoryOrType?: string,
  customTemplates?: Record<string, ChecklistTemplate>
): ChecklistTemplate {
  const norm = String(categoryOrType || '').toLowerCase().trim();

  // 1. Check custom configured templates first (Fixes D-04)
  if (customTemplates && categoryOrType && customTemplates[categoryOrType]) {
    return customTemplates[categoryOrType];
  }
  if (customTemplates) {
    for (const [key, tmpl] of Object.entries(customTemplates)) {
      if (key.toLowerCase() === norm) {
        return tmpl;
      }
    }
  }

  // 2. Built-in type recognition
  if (norm.includes('service request') || norm.includes('service_request') || norm.includes('general request')) {
    return SERVICE_REQUEST_DEFINITION_OF_DONE;
  }
  if (norm.includes('it help') || norm.includes('it_help') || norm.includes('help desk') || norm.includes('support')) {
    return IT_HELP_DEFINITION_OF_DONE;
  }
  if (norm.includes('bug') || norm.includes('defect') || norm.includes('incident') || norm.includes('problem')) {
    return BUG_DEFINITION_OF_DONE;
  }
  if (norm.includes('story') || norm.includes('feature') || norm.includes('enhancement')) {
    return STORY_DEFINITION_OF_DONE;
  }
  if (norm.includes('chore') || norm.includes('refactor') || norm.includes('maintenance')) {
    return TASK_DEFINITION_OF_DONE;
  }
  return DEFAULT_DEFINITION_OF_DONE;
}

export class ChecklistEngine {
  /**
   * Initializes a new checklist state for a Jira issue from a template.
   */
  public static initializeState(
    issueId: string,
    issueKey: string,
    template: ChecklistTemplate = DEFAULT_DEFINITION_OF_DONE,
    initialUser: string = 'system',
    timestamp?: string
  ): IssueChecklistState {
    const now = timestamp || new Date().toISOString();

    const items: ChecklistItemInstance[] = template.items.map(t => ({
      id: t.id,
      title: t.title,
      isMandatory: t.isMandatory,
      isCompleted: false,
      category: t.category
    }));

    const isFullySatisfied = items.filter(i => i.isMandatory).every(i => i.isCompleted);
    const checklistHash = calculateChecklistHash(items, 1, []);

    return {
      issueId,
      issueKey,
      templateId: template.id,
      items,
      lastModifiedAt: now,
      lastModifiedBy: initialUser,
      isFullySatisfied,
      checklistHash,
      stateVersion: 1,
      auditTrail: []
    };
  }

  /**
   * Calculates metrics for a checklist state.
   */
  public static calculateMetrics(state: IssueChecklistState): ChecklistMetrics {
    const totalItems = state.items.length;
    const completedItems = state.items.filter(i => i.isCompleted).length;
    const mandatory = state.items.filter(i => i.isMandatory);
    const mandatoryItems = mandatory.length;
    const completedMandatoryItems = mandatory.filter(i => i.isCompleted).length;

    const completionPercentage = totalItems > 0
      ? Math.round((completedItems / totalItems) * 100)
      : 100;

    const isFullySatisfied = mandatoryItems === completedMandatoryItems;

    return {
      totalItems,
      completedItems,
      mandatoryItems,
      completedMandatoryItems,
      completionPercentage,
      isFullySatisfied
    };
  }

  /**
   * Toggles the completion state of a specific checklist item with attribution and non-monotonic audit history.
   */
  public static toggleItem(
    state: IssueChecklistState,
    request: ChecklistToggleRequest,
    timestamp?: string
  ): IssueChecklistState {
    const now = timestamp || new Date().toISOString();
    let found = false;
    let toggledTitle = '';

    const updatedItems = state.items.map(item => {
      if (item.id === request.itemId) {
        found = true;
        toggledTitle = item.title;
        const history = item.history ? [...item.history] : [];
        history.push({
          action: request.isCompleted ? 'TICK' : 'UNTICK',
          userId: request.userId,
          userAccountId: request.userAccountId,
          timestamp: now
        });
        if (history.length > 25) {
          history.shift();
        }

        const cappedNotes = request.notes !== undefined
          ? request.notes.slice(0, 500)
          : item.notes;

        return {
          ...item,
          isCompleted: request.isCompleted,
          completedBy: request.isCompleted ? request.userId : undefined,
          completedByAccountId: request.isCompleted ? request.userAccountId : undefined,
          completedAt: request.isCompleted ? now : undefined,
          notes: cappedNotes,
          history
        };
      }
      return item;
    });

    if (!found) {
      throw new Error(`Checklist item with id '${request.itemId}' not found on issue ${state.issueKey}`);
    }

    const nextVersion = (state.stateVersion || 1) + 1;
    const auditEvent: ChecklistAuditEvent = {
      id: `evt-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      timestamp: now,
      eventType: request.isCompleted ? 'CHECK' : 'UNCHECK',
      actorName: request.userId,
      actorAccountId: request.userAccountId || 'unknown',
      itemId: request.itemId,
      itemTitle: toggledTitle
    };

    const auditTrail = [...(state.auditTrail || []), auditEvent];
    const isFullySatisfied = updatedItems.filter(i => i.isMandatory).every(i => i.isCompleted);
    const checklistHash = calculateChecklistHash(updatedItems, nextVersion, auditTrail);

    return {
      ...state,
      items: updatedItems,
      lastModifiedAt: now,
      lastModifiedBy: request.userId,
      isFullySatisfied,
      checklistHash,
      stateVersion: nextVersion,
      auditTrail
    };
  }

  /**
   * Resets an issue's checklist while monotonically preserving audit history (Fixes D-13).
   */
  public static resetChecklist(
    state: IssueChecklistState,
    actorName: string,
    actorAccountId: string = 'unknown',
    timestamp?: string
  ): IssueChecklistState {
    const now = timestamp || new Date().toISOString();
    const previousCompleted = state.items.filter(i => i.isCompleted).length;

    const resetItems = state.items.map(item => ({
      ...item,
      isCompleted: false,
      completedBy: undefined,
      completedByAccountId: undefined,
      completedAt: undefined
    }));

    const nextVersion = (state.stateVersion || 1) + 1;
    const auditEvent: ChecklistAuditEvent = {
      id: `evt-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      timestamp: now,
      eventType: 'RESET',
      actorName,
      actorAccountId,
      details: `Checklist reset. Previously ${previousCompleted} items completed.`
    };

    const auditTrail = [...(state.auditTrail || []), auditEvent];
    const checklistHash = calculateChecklistHash(resetItems, nextVersion, auditTrail);

    return {
      ...state,
      items: resetItems,
      lastModifiedAt: now,
      lastModifiedBy: actorName,
      isFullySatisfied: false,
      checklistHash,
      stateVersion: nextVersion,
      auditTrail
    };
  }
}
