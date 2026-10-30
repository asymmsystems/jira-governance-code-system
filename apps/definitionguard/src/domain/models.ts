export type ChecklistCategory =
  | 'CODE_QUALITY'
  | 'SECURITY'
  | 'TESTING'
  | 'COMPLIANCE'
  | 'DOCUMENTATION';

export interface ChecklistItemTemplate {
  id: string;
  title: string;
  description?: string;
  isMandatory: boolean;
  category: ChecklistCategory;
}

export interface ChecklistTemplate {
  id: string;
  name: string;
  description: string;
  projectKey?: string;
  issueType?: string;
  items: ChecklistItemTemplate[];
}

export interface ChecklistItemAuditEntry {
  action: 'TICK' | 'UNTICK';
  userId: string;
  userAccountId?: string;
  timestamp: string;
}

export interface ChecklistAuditEvent {
  id: string;
  timestamp: string;
  eventType: 'CHECK' | 'UNCHECK' | 'RESET' | 'TEMPLATE_CONFIGURED';
  actorName: string;
  actorAccountId: string;
  itemId?: string;
  itemTitle?: string;
  details?: string;
}

export interface ChecklistItemInstance {
  id: string;
  title: string;
  isMandatory: boolean;
  isCompleted: boolean;
  category: ChecklistCategory;
  completedBy?: string;
  completedByAccountId?: string;
  completedAt?: string;
  notes?: string;
  history?: ChecklistItemAuditEntry[];
}

export interface IssueChecklistState {
  issueId: string;
  issueKey: string;
  projectKey?: string;
  issueType?: string;
  templateId?: string;
  items: ChecklistItemInstance[];
  lastModifiedAt: string;
  lastModifiedBy: string;
  isFullySatisfied: boolean;
  checklistHash: string;
  stateVersion?: number;
  auditTrail?: ChecklistAuditEvent[];
}

export interface ProjectDoDConfig {
  projectKey: string;
  templatesByIssueType: Record<string, ChecklistTemplate>;
  updatedAt: string;
  updatedBy: string;
}

export interface ChecklistToggleRequest {
  issueId: string;
  issueKey: string;
  itemId: string;
  isCompleted: boolean;
  userId: string;
  userAccountId?: string;
  notes?: string;
}

export interface ChecklistMetrics {
  totalItems: number;
  completedItems: number;
  mandatoryItems: number;
  completedMandatoryItems: number;
  completionPercentage: number;
  isFullySatisfied: boolean;
}

export interface TransitionValidationResult {
  canTransition: boolean;
  reasons: string[];
  incompleteMandatoryItems: string[];
}
