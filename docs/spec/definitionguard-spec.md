# DefinitionGuard: Architecture Specification & Data Contracts

## Executive Summary
DefinitionGuard provides automated Definition-of-Done (DoD), security sign-off, and compliance checklist enforcement inside Atlassian Jira Cloud. 
The application runs entirely on Atlassian Forge ("Runs on Atlassian"). 
It keeps all checklist data, state transitions, and audit records in Atlassian hosted storage.
DefinitionGuard installs zero external infrastructure. It has zero external egress.
It prevents issues from moving to "Done", "Resolved", or "Released" until all mandatory checklist items are satisfied.
It integrates directly with LedgerSeal to provide cryptographically sealed compliance packages.

## Invariants
1. **Zero External Egress**: The application must never make HTTP calls to third-party endpoints.
2. **Complete Data Residency**: All checklist definitions, instances, and audit events reside in `@forge/storage`.
3. **Workflow Transition Gate**: The workflow validator strictly prevents transition if any mandatory item is incomplete.
4. **Attribution Integrity**: Every state change records the user account ID and ISO-8601 timestamp.
5. **Deterministic Checklist State Hash**: The completed checklist state generates a deterministic SHA-256 digest for audit verification.

## Domain Model
```typescript
export interface ChecklistTemplate {
  id: string;
  name: string;
  description: string;
  projectKey?: string;
  issueType?: string;
  items: ChecklistItemTemplate[];
}

export interface ChecklistItemTemplate {
  id: string;
  title: string;
  description?: string;
  isMandatory: boolean;
  category: 'CODE_QUALITY' | 'SECURITY' | 'TESTING' | 'COMPLIANCE' | 'DOCUMENTATION';
}

export interface ChecklistItemInstance {
  id: string;
  title: string;
  isMandatory: boolean;
  isCompleted: boolean;
  category: string;
  completedBy?: string;
  completedAt?: string;
  notes?: string;
}

export interface IssueChecklistState {
  issueId: string;
  issueKey: string;
  templateId?: string;
  items: ChecklistItemInstance[];
  lastModifiedAt: string;
  lastModifiedBy: string;
  isFullySatisfied: boolean;
  checklistHash: string;
}

export interface ChecklistToggleResult {
  success: boolean;
  updatedState: IssueChecklistState;
  error?: string;
}

export interface TransitionValidationResult {
  canTransition: boolean;
  reasons: string[];
  incompleteMandatoryItems: string[];
}
```

## Manifest
The application declares native Jira modules in `manifest.yml`:
- `jira:issuePanel`: Native UI panel in the Jira issue view.
- `jira:workflowValidator`: Gating validator function evaluated during workflow transitions.
- Permissions and Scopes:
  - `read:jira-work`: Read issue context and project metadata.
  - `storage:app`: Store checklists securely within Atlassian Forge cloud storage.

## Storage Schema
Data is partitioned in Forge Storage (`@forge/storage`):
- `checklist:issue:{issueId}`: Key storing `IssueChecklistState` for a specific issue.
- `checklist:template:{templateId}`: Key storing reusable `ChecklistTemplate` definitions.
- `checklist:project:{projectKey}:default`: Default template assignment for a project.

## Validator
The workflow validator function (`validateTransition`):
1. Reads issue context (`issueId`).
2. Retrieves `IssueChecklistState` from Forge Storage.
3. If no checklist exists and mandatory templates apply, transition is blocked.
4. Inspects all items in `items`.
5. If any item where `isMandatory === true` has `isCompleted === false`, transition is rejected.
6. Returns `{ result: false, errorMessage: "Definition of Done incomplete: [item titles]" }`.
7. Returns `{ result: true }` only when all mandatory items are verified complete.
