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
  eventType: 'CHECK' | 'UNCHECK' | 'RESET' | 'TEMPLATE_CONFIGURED' | 'WAIVE';
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
  waived?: boolean;                // v2 panel response
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
// v3: Silverston-aligned model (docs/spec/definitionguard-spec-v3.md).
// Entity and field names follow Apache OFBiz, which implements Silverston's
// Data Model Resource Book. Section 3 of the spec maps every concept.
// ---------------------------------------------------------------------------

/** StatusItem ids of StatusType DOD_CRITERION_STATUS. */
export type DodStatusId = 'DOD_OPEN' | 'DOD_DONE' | 'DOD_WAIVED';

/** StatusValidChange transition names, plus the change-log entries that are not status changes. */
export type TransitionName = 'Create' | 'Migrate' | 'Complete' | 'Reopen' | 'Waive' | 'Reset' | 'Resync';

/** RoleType ids. Parties hold them through Jira, read live (spec v3 section 6). */
export type RoleTypeId = 'ASSIGNEE' | 'PROJECT_ADMIN' | `JIRA_PERM_${string}`;

/** A criterion as it appears in a template: a DOD_CRITERION WorkEffort under a DOD_TEMPLATE WorkEffort. */
export interface TemplateCriterion {
  templateItemId: string;
  workEffortName: string;
  description?: string;
  sequenceNum: number;
  purposeTypeId: ChecklistCategory;        // WorkEffort.workEffortPurposeTypeId
  isMandatory: boolean;                    // WorkEffortAttribute "mandatory"
  evidenceRequired: boolean;               // WorkEffortAttribute "evidenceRequired"
  requiredRoleTypeId?: RoleTypeId;
  excludedRoleTypeId?: 'ASSIGNEE';
}

/** A WorkEffort of type DOD_TEMPLATE with its criteria (WORK_EFF_BREAKDOWN children). */
export interface DodTemplate {
  workEffortId: string;
  workEffortTypeId: 'DOD_TEMPLATE';
  workEffortName: string;
  description: string;
  revisionNumber: number;
  waiverRoleTypeId: RoleTypeId;
  criteria: TemplateCriterion[];
}

/** The Jira issue as a WorkEffort, held by reference: Jira owns the issue. */
export interface IssueWorkEffort {
  workEffortId: string;
  workEffortTypeId: 'ISSUE';
  sourceReferenceId: string;               // Jira issue id
  workEffortName: string;                  // Jira issue key
  projectId: string;
}

/** A DOD_CRITERION WorkEffort under the issue WorkEffort, with its current status (cached). */
export interface CriterionState extends TemplateCriterion {
  workEffortId: string;
  currentStatusId: DodStatusId;
  lastStatusUpdate?: string;
  lastStatusByPartyId?: string;
  lastStatusSeq?: number;
  evidenceContentId?: string;              // WorkEffortContent DOD_EVIDENCE for the current DONE
  legacyName?: string;                     // v1 display name, only when v1 recorded no accountId
}

export interface LegacyRef {
  stateVersion: number;
  eventCount: number;
  checklistHash: string;
}

/** Cache of the change log, stored at dg:state:<issueId>. */
export interface DodState {
  schemaVersion: 3;
  issue: IssueWorkEffort;
  template: { workEffortId: string; revisionNumber: number; waiverRoleTypeId: RoleTypeId };
  criteria: CriterionState[];
  seq: number;
  headHash: string;
  lastModifiedAt?: string;
  lastModifiedByPartyId?: string;
  legacy?: LegacyRef;
}

/** One entity row inside a change-log entry. */
export type DodRow =
  | ({ entity: 'WorkEffort'; workEffortId: string; workEffortTypeId: 'ISSUE'; workEffortName: string; sourceReferenceId: string; projectId: string })
  | ({ entity: 'WorkEffort'; workEffortId: string; workEffortTypeId: 'DOD_CRITERION' } & TemplateCriterion)
  | { entity: 'WorkEffortAssoc'; workEffortIdFrom: string; workEffortIdTo: string; workEffortAssocTypeId: 'WORK_EFF_BREAKDOWN' | 'WORK_EFF_TEMPLATE'; sequenceNum?: number; revisionNumber?: number; waiverRoleTypeId?: RoleTypeId; fromDate: string; thruDate?: string }
  | { entity: 'WorkEffortStatus'; workEffortId: string; statusId: DodStatusId; statusDatetime: string; setByPartyId: string; reason?: string; setByLegacyName?: string }
  | { entity: 'Content'; contentId: string; contentTypeId: 'DOD_EVIDENCE'; objectInfo?: string; textData?: string }
  | { entity: 'WorkEffortContent'; workEffortId: string; contentId: string; workEffortContentTypeId: 'DOD_EVIDENCE'; fromDate: string }
  | { entity: 'LegacyImport'; legacy: LegacyRef };

/** One transaction of entity rows, stored at dg:evt:<issueId>:<seq as 8 digits>. Never changed after it is written. */
export interface ChangeEntry {
  seq: number;
  issueId: string;
  transitionName: TransitionName;
  at: string;
  actorPartyId: string;                    // the Jira accountId (PartyIdentification JIRA_ACCOUNT_ID)
  rows: DodRow[];
  prevHash: string;
  hash: string;
}

/** What a resolver asks the log to record; seq, issueId, prevHash and hash are added by makeEntry. */
export type EntryInput = Pick<ChangeEntry, 'transitionName' | 'at' | 'actorPartyId' | 'rows'>;
