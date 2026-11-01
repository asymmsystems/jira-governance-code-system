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
  evidenceRequired?: boolean;   // v2: a tick needs a link or a note
  requiredPermission?: string;  // v2: Jira permission key needed to tick, besides EDIT_ISSUES
  notAssignee?: boolean;        // v2: the current assignee may not complete it
}

export interface ChecklistTemplate {
  id: string;
  name: string;
  description: string;
  projectKey?: string;
  issueType?: string;
  version?: number;             // v2: increases on every save of a project template
  waiverPermission?: string;    // v2: Jira permission key needed to waive; default ADMINISTER_PROJECTS
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
  evidence?: { url?: string; note?: string };  // v2 history view
}

export interface ChecklistItemInstance {
  id: string;
  title: string;
  isMandatory: boolean;
  isCompleted: boolean;
  category: ChecklistCategory;
  completedBy?: string;
  completedByAccountId?: string;
  completedByLegacyName?: string;  // v2 panel response: v1 name when no accountId exists
  evidenceRequired?: boolean;      // v2 panel response
  hasEvidence?: boolean;           // v2 panel response
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
  openMandatoryTitles?: string[];  // v2 panel response: from the shared gate rule
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

// ---------------------------------------------------------------------------
// v2: append-only event log (docs/spec/definitionguard-spec-v2.md)
// ---------------------------------------------------------------------------

export type ItemStatus = 'OPEN' | 'DONE' | 'WAIVED';

export type ChecklistEventType = 'CREATED' | 'MIGRATED' | 'TICK' | 'UNTICK' | 'WAIVE' | 'RESET' | 'RESYNC';

export interface ItemState {
  id: string;
  title: string;
  isMandatory: boolean;
  category: ChecklistCategory;
  status: ItemStatus;
  byAccountId?: string;
  legacyName?: string;          // v1 display name, kept only when v1 recorded no accountId
  at?: string;
  eventSeq?: number;
  evidenceRequired?: boolean;   // from the template (B-11)
  hasEvidence?: boolean;        // the DONE event carried evidence (B-11)
  notAssignee?: boolean;        // from the template (B-12)
}

export interface LegacyRef {
  stateVersion: number;
  eventCount: number;
  checklistHash: string;
}

/** Cache of the event log, stored at dg:state:<issueId>. */
export interface ChecklistState {
  schemaVersion: 2;
  issueId: string;
  issueKey: string;
  projectId: string;
  templateId: string;
  templateVersion: number;
  items: ItemState[];
  seq: number;
  headHash: string;
  lastModifiedAt?: string;
  lastModifiedByAccountId?: string;
  legacy?: LegacyRef;
}

/** One change, stored at dg:evt:<issueId>:<seq as 8 digits>. Never changed after it is written. */
export interface ChecklistEvent {
  seq: number;
  issueId: string;
  type: ChecklistEventType;
  at: string;
  actorAccountId: string;
  itemId?: string;
  itemTitle?: string;
  evidence?: { url?: string; note?: string };  // TICK: link and or note
  items?: ItemState[];          // CREATED, MIGRATED, RESYNC: the item list
  issueKey?: string;            // CREATED, MIGRATED: lets a rebuild from events restore the state
  projectId?: string;
  templateId?: string;
  templateVersion?: number;
  legacy?: LegacyRef;           // MIGRATED
  prevHash: string;
  hash: string;
}

/** What a resolver asks the log to record; seq, prevHash and hash are added by makeEvent. */
export type EventInput = Omit<ChecklistEvent, 'seq' | 'issueId' | 'prevHash' | 'hash'>;
