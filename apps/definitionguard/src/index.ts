/**
 * DefinitionGuard resolvers and the Jira workflow validator entry point.
 *
 * Copyright (c) 2026 Asymm Systems. All rights reserved.
 * @author Fahim Farook
 */
import api, { route } from '@forge/api';
import Resolver from '@forge/resolver';
import {
  getTemplateForCategory,
  getAvailableTemplates
} from './domain/checklist-engine';
import { evaluateGate, blockMessage, needsAssigneeCheck } from './domain/gate-rule';
import { assigneeChanges, assigneesSince } from './jira/assignee-history';
import { ProjectConfigStore } from './settings/project-config';
import { StorageProvider } from './storage/checklist-repository';
import { resolveStorage } from './storage/forge-storage';
import { ChecklistStore, eventKey } from './storage/checklist-store';
import { applyEntry, createEntry, emptyState, statusEntry, resetEntry, chainMessage, verifyChain, CHAIN_LIMIT_NOTE } from './domain/event-log';
import { ChangeEntry, DodState, DodTemplate, IssueChecklistState, ChecklistAuditEvent } from './domain/models';
import { permissionKeyOf } from './domain/roles';
import {
  checkIssuePermissions,
  getIssuePermissions,
  permissionLabel,
  PermissionDeniedError,
  EDIT_DENIED,
  RESET_DENIED
} from './security/permissions';
import {
  hasApproverPermission,
  approverGroupNames,
  APPROVER_REQUIRED_MESSAGE
} from './security/approver';
import {
  getApproverPolicyFlow,
  searchGroupsFlow,
  setApproverPolicyFlow
} from './security/policy-admin';
import { resolveTemplate } from './settings/template-store';
import { assertLicensed, isLicenceInactive } from './security/licence';
import { validateEvidence, EVIDENCE_REQUIRED } from './domain/evidence';
import { publishAttestation } from './integrity/attestation';
import { withRetry } from './jira/jira-client';
import { PartyStore, ShownParty } from './storage/party-store';

export { settingsHandler } from './settings/settings-resolvers';
export { personalDataTrigger } from './privacy/personal-data';

export { setGlobalStorageProvider, resolveStorage } from './storage/forge-storage';

/**
 * Fetches the authentic Jira issue representation to determine issue type.
 */
export async function fetchLiveJiraIssue(issueIdOrKey: string): Promise<any | null> {
  try {
    const res = await withRetry(() => api.asApp().requestJira(route`/rest/api/3/issue/${issueIdOrKey}?fields=issuetype,project,status`));
    if (res.status === 200) {
      return await res.json();
    }
  } catch {}
  return null;
}

export const VALIDATOR_FAILURE_MESSAGE =
  'DefinitionGuard could not check the Definition of Done, so this move is blocked. ' +
  'Try again. If it keeps failing, ask your Jira admin.';

/**
 * Fetches the issue for the validator. Unlike fetchLiveJiraIssue, any failure throws,
 * so the validator blocks instead of guessing (fail closed).
 */
async function fetchIssueForValidator(issueIdOrKey: string): Promise<any> {
  const res = await withRetry(() => api.asApp().requestJira(route`/rest/api/3/issue/${issueIdOrKey}?fields=issuetype,project,assignee`));
  if (res.status !== 200) {
    throw new Error(`DefinitionGuard: issue lookup returned ${res.status}`);
  }
  return await res.json();
}

/** A checklist built in memory from a template. Nothing is stored. */
function stateFromTemplate(issueId: string, issueKey: string, projectId: string, template: DodTemplate): DodState {
  const base = emptyState(issueId, issueKey, projectId);
  return applyEntry(base, createEntry(base, template, 'system', new Date().toISOString()));
}

/** How each stored party id is shown: an account id for the User component, or a text. */
type Shown = Map<string, ShownParty>;
const shownAccount = (shown: Shown, id?: string) => {
  const p = id ? shown.get(id) : undefined;
  return p && 'accountId' in p ? p.accountId : undefined;
};
const shownText = (shown: Shown, id?: string) => {
  const p = id ? shown.get(id) : undefined;
  return p && 'text' in p ? p.text : undefined;
};

/** The panel's item shape (frozen contract), from the criteria. People come as account ids, resolved from pseudonyms. */
function toLegacyItems(state: DodState, shown: Shown) {
  return state.criteria.map(c => {
    const closed = c.currentStatusId !== 'DOD_OPEN';
    const accountId = closed ? shownAccount(shown, c.lastStatusByPartyId) : undefined;
    return {
      id: c.templateItemId,
      title: c.workEffortName,
      isMandatory: c.isMandatory,
      category: c.purposeTypeId,
      isCompleted: closed,
      completedBy: accountId,
      completedByAccountId: accountId,
      completedAt: closed ? c.lastStatusUpdate : undefined,
      completedByLegacyName: closed ? c.legacyName || shownText(shown, c.lastStatusByPartyId) : undefined,
      waived: c.currentStatusId === 'DOD_WAIVED',
      evidenceRequired: c.evidenceRequired,
      hasEvidence: Boolean(c.evidenceContentId)
    };
  });
}

/**
 * Jira Workflow Validator entry point:
 * Blocks transition if any mandatory checklist item remains incomplete.
 * Supports both { issue: { key } } and { issue: { id } } payloads.
 * Fails closed: any error returns result false. Never writes storage.
 */
export async function validateTransition(payload: any, context?: any, storageProvider?: StorageProvider) {
  try {
    return await evaluateTransition(payload, context, storageProvider);
  } catch {
    return { result: false, errorMessage: VALIDATOR_FAILURE_MESSAGE };
  }
}

async function evaluateTransition(payload: any, context?: any, storageProvider?: StorageProvider) {
  // BL-4: an inactive licence turns the gate off. The move goes through; the panel says why.
  if (isLicenceInactive(context)) {
    console.log('DefinitionGuard: the licence is not active, so the gate let this move through.');
    return { result: true };
  }

  const issueKey = payload?.issue?.key || payload?.issueKey;
  let issueId = String(payload?.issue?.id || payload?.issueId || '');
  let live: any = null;

  if (!issueId && issueKey) {
    live = await fetchIssueForValidator(issueKey);
    if (!live?.id) {
      throw new Error('DefinitionGuard: issue lookup returned no id');
    }
    issueId = String(live.id);
  }

  if (!issueId) {
    return {
      result: false,
      errorMessage: 'DefinitionGuard Validator: Missing issue context.'
    };
  }

  const store = new ChecklistStore(resolveStorage(storageProvider));
  let state = await store.loadOrLegacy(issueId);

  // No checklist yet: apply the template in memory and block on it (Fixes D-14).
  // The project template for the issue type comes first, then the built-in one. Nothing is stored.
  if (!state) {
    const ctxIssue = context?.extension?.issue;
    let projectId = String(context?.extension?.project?.id || '');
    let issueTypeId = String(ctxIssue?.typeId || '');
    let issueType = ctxIssue?.type;
    if (!projectId || !issueTypeId) {
      live = live || await fetchIssueForValidator(issueId);
      projectId = projectId || String(live?.fields?.project?.id || '');
      issueTypeId = issueTypeId || String(live?.fields?.issuetype?.id || '');
      issueType = issueType || live?.fields?.issuetype?.name;
    }
    const template = await resolveTemplate(resolveStorage(storageProvider), projectId, issueTypeId, issueType || 'Task');
    state = stateFromTemplate(issueId, String(issueKey || issueId), projectId, template);
  }

  // Separation of duties holds at the moment of Done: re-check not-the-assignee items
  // against the current assignee, read from the Jira issue (never from an issue property).
  // Separation of duties (H-1, H-2): a not-the-assignee item that was completed or waived by anyone
  // who was the assignee after the item was opened counts as open. Read from Jira (current assignee
  // and changelog), never from an issue property. Stored records hold pseudonyms (ADR-010), so each
  // assignee is looked up, read only.
  const excludedIds = new Set<string>();
  const checked = state.criteria.filter(needsAssigneeCheck);
  if (checked.length > 0) {
    live = live?.fields && 'assignee' in live.fields ? live : await fetchIssueForValidator(issueId);
    const current = live?.fields?.assignee?.accountId;
    const changes = await assigneeChanges(issueId, 'app');
    const parties = new PartyStore(resolveStorage(storageProvider));
    for (const c of checked) {
      const ids = await parties.idsOf(assigneesSince(changes, current, c.openedAt || c.breakdownFromDate));
      if (c.lastStatusByPartyId && ids.has(c.lastStatusByPartyId)) excludedIds.add(c.workEffortId);
    }
  }

  const gate = evaluateGate(state, c => excludedIds.has(c.workEffortId));
  if (gate.satisfied) {
    return { result: true };
  }

  // Unsatisfied: the gate applies to moves into a Done-category status that the admin has not exempted.
  // A missing target is treated as a Done move (fail closed).
  const targetId = String(payload?.transition?.to?.id || '');
  if (targetId) {
    const res = await withRetry(() => api.asApp().requestJira(route`/rest/api/3/status/${targetId}`));
    if (res.status !== 200) {
      throw new Error(`DefinitionGuard: status lookup returned ${res.status}`);
    }
    const status = await res.json();
    if (status?.statusCategory?.key !== 'done') {
      return { result: true };
    }
    let projectId = state.issue.projectId || String(context?.extension?.project?.id || '');
    if (!projectId) {
      live = live || await fetchIssueForValidator(issueId);
      projectId = String(live?.fields?.project?.id || '');
    }
    const config = await new ProjectConfigStore(resolveStorage(storageProvider)).get(projectId);
    if (config?.exemptStatusIds.includes(targetId)) {
      return { result: true };
    }
  }

  return { result: false, errorMessage: blockMessage(gate.openMandatory) };
}

/** Issue identity and actor come from the Forge context only, never from the payload. */
function panelContext(context: any) {
  const issue = context?.extension?.issue;
  const issueId = String(issue?.id || '');
  if (!issueId) {
    throw new Error('DefinitionGuard: Missing issue context. Open this panel from a Jira issue.');
  }
  return {
    issueId,
    issueKey: String(issue?.key || issueId),
    issueType: issue?.type as string | undefined,
    issueTypeId: String(issue?.typeId || ''),
    projectId: String(context?.extension?.project?.id || ''),
    actorAccountId: String(context?.accountId || 'unknown')
  };
}

const AUDIT_TYPE: Record<ChangeEntry['transitionName'], ChecklistAuditEvent['eventType']> = {
  Create: 'TEMPLATE_CONFIGURED',
  Migrate: 'TEMPLATE_CONFIGURED',
  Resync: 'TEMPLATE_CONFIGURED',
  Complete: 'CHECK',
  Waive: 'WAIVE',
  Reopen: 'UNCHECK',
  Reset: 'RESET',
  Redact: 'REDACT'
};

/** One history row per change-log entry, in the panel's audit shape (frozen contract). */
function auditRow(state: DodState, e: ChangeEntry, shown: Shown): ChecklistAuditEvent {
  const accountId = shownAccount(shown, e.actorPartyId) || '';
  const row: ChecklistAuditEvent = {
    id: `evt-${e.seq}`,
    timestamp: e.at,
    eventType: AUDIT_TYPE[e.transitionName],
    actorName: accountId || shownText(shown, e.actorPartyId) || '',
    actorAccountId: accountId
  };
  if (e.transitionName === 'Complete' || e.transitionName === 'Reopen' || e.transitionName === 'Waive') {
    const status = e.rows.find(r => r.entity === 'WorkEffortStatus') as Extract<ChangeEntry['rows'][number], { entity: 'WorkEffortStatus' }>;
    const criterion = state.criteria.find(c => c.workEffortId === status.workEffortId);
    row.itemId = criterion?.templateItemId || status.workEffortId.split(':').pop();
    row.itemTitle = criterion?.workEffortName || row.itemId;
    if (status.reason) row.details = status.reason;
    const content = e.rows.find(r => r.entity === 'Content') as Extract<ChangeEntry['rows'][number], { entity: 'Content' }> | undefined;
    if (content) row.evidence = { ...(content.objectInfo ? { url: content.objectInfo } : {}), ...(content.textData ? { note: content.textData } : {}) };
  }
  return row;
}

/**
 * The panel response (frozen contract). People are account ids, resolved from the stored
 * pseudonyms (ADR-010); the panel renders them. A person whose account was closed and erased, or
 * the app itself, comes as text in completedByLegacyName or actorName.
 */
export function toPanelResponse(state: DodState, entries: ChangeEntry[] = [], shown: Shown = new Map()): IssueChecklistState {
  const items = toLegacyItems(state, shown);
  const gate = evaluateGate(state);
  return {
    issueId: state.issue.sourceReferenceId,
    issueKey: state.issue.workEffortName,
    templateId: state.template.workEffortId,
    items,
    lastModifiedAt: state.lastModifiedAt || '',
    lastModifiedBy: shownAccount(shown, state.lastModifiedByPartyId) || '',
    isFullySatisfied: gate.satisfied,
    openMandatoryTitles: gate.openMandatory.map(c => c.workEffortName),
    checklistHash: state.headHash,
    stateVersion: state.seq,
    auditTrail: entries.map(e => auditRow(state, e, shown))
  };
}

/** Every party id the panel response shows. */
function partiesIn(state: DodState, entries: ChangeEntry[]): string[] {
  return [
    ...state.criteria.map(c => c.lastStatusByPartyId || ''),
    state.lastModifiedByPartyId || '',
    ...entries.map(e => e.actorPartyId)
  ];
}

/** The panel response with every stored pseudonym resolved to the person, read only. */
export async function panelResponse(storage: StorageProvider, state: DodState, entries: ChangeEntry[] = []): Promise<IssueChecklistState> {
  return {
    ...toPanelResponse(state, entries, await new PartyStore(storage).show(partiesIn(state, entries))),
    // M-1: the approver line names the configured groups and the template's waiver permission.
    approverGroups: await approverGroupNames(storage),
    waiverPermissionLabel: permissionLabel(permissionKeyOf(state.template.waiverRoleTypeId))
  };
}

/** The template for a panel action: ids from the context, else from one issue lookup. */
async function templateFor(storage: StorageProvider, c: ReturnType<typeof panelContext>): Promise<DodTemplate> {
  let { projectId, issueTypeId, issueType } = c;
  if (!projectId || !issueTypeId) {
    const live = await fetchLiveJiraIssue(c.issueId);
    projectId = projectId || String(live?.fields?.project?.id || '');
    issueTypeId = issueTypeId || String(live?.fields?.issuetype?.id || '');
    issueType = issueType || live?.fields?.issuetype?.name;
  }
  return resolveTemplate(storage, projectId, issueTypeId, issueType);
}

/**
 * Retrieves the current checklist state for an issue. When none is stored, applies the
 * issue-type template in memory. Never writes.
 */
export async function getIssueChecklist(_payload: any, context?: any, storageProvider?: StorageProvider): Promise<IssueChecklistState> {
  const c = panelContext(context);
  const storage = resolveStorage(storageProvider);
  const store = new ChecklistStore(storage);

  let state = await store.loadOrLegacy(c.issueId, c.projectId);
  if (!state) {
    const base = emptyState(c.issueId, c.issueKey, c.projectId);
    state = applyEntry(base, createEntry(base, await templateFor(storage, c), 'system', new Date().toISOString()));
    state = { ...state, seq: 0 };
  }
  return withLicenceNotice(await panelResponse(storage, state), context);
}

/** Adds the licence notice to a panel response when the licence is inactive (BL-4). */
function withLicenceNotice(res: IssueChecklistState, context: any): IssueChecklistState {
  return isLicenceInactive(context) ? { ...res, licenceInactive: true } : res;
}

/**
 * One page of the issue's events (at most 100), oldest first, for the history view.
 */
export async function getChecklistHistory(payload: any, context?: any, storageProvider?: StorageProvider) {
  const c = panelContext(context);
  const storage = resolveStorage(storageProvider);
  const store = new ChecklistStore(storage);
  const cursor = typeof payload?.cursor === 'string' ? payload.cursor : undefined;
  const page = await store.history(c.issueId, cursor);
  const state = await store.load(c.issueId);
  const check = await store.verify(c.issueId);
  return {
    events: page.events,
    chain: { ...check, message: chainMessage(check), limit: CHAIN_LIMIT_NOTE },
    auditTrail: (await panelResponse(storage, state || emptyState(c.issueId, c.issueKey, c.projectId), page.events)).auditTrail,
    nextCursor: page.nextCursor,
    eventCount: state?.seq || 0
  };
}

export const ASSIGNEE_DENIED = 'The assignee cannot complete this item. Ask a reviewer.';
export const FORMER_ASSIGNEE_DENIED =
  'The assignee cannot complete this item, and you were the assignee of this issue after the item was opened. Ask a reviewer.';
export const ASSIGNEE_WAIVE_DENIED =
  'The assignee cannot waive this item, and you are or were the assignee of this issue after the item was opened. Ask another approver.';

/**
 * True when the actor is the current assignee, or was the assignee at any moment after the item
 * was last opened (H-2). Read as the user; fails closed when Jira cannot be read.
 */
async function actorWasAssignee(issueKey: string, actorAccountId: string, criterion: { openedAt?: string; breakdownFromDate?: string }): Promise<'current' | 'former' | false> {
  const current = await currentAssignee(issueKey);
  if (current === actorAccountId) return 'current';
  const changes = await assigneeChanges(issueKey, 'user');
  return assigneesSince(changes, current, criterion.openedAt || criterion.breakdownFromDate).has(actorAccountId) ? 'former' : false;
}
export const WAIVER_REASON_INVALID = 'Give a reason of 10 to 500 characters for the waiver.';

/** The stored checklist, or the one a first change would create, built in memory. */
async function currentState(storage: StorageProvider, store: ChecklistStore, c: ReturnType<typeof panelContext>): Promise<DodState> {
  const stored = await store.loadOrLegacy(c.issueId, c.projectId);
  if (stored) return stored;
  return stateFromTemplate(c.issueId, c.issueKey, c.projectId, await templateFor(storage, c));
}

/** The current assignee, read as the user. Throws when it cannot be read (fail closed). */
async function currentAssignee(issueKey: string): Promise<string | undefined> {
  let res: any;
  try {
    res = await withRetry(() => api.asUser().requestJira(route`/rest/api/3/issue/${issueKey}?fields=assignee`));
  } catch {
    res = { status: 0 };
  }
  if (res.status !== 200) {
    throw new Error('DefinitionGuard could not read the assignee, so the change was not saved. Try again.');
  }
  return (await res.json())?.fields?.assignee?.accountId;
}

/**
 * Waives an item with a reason. Needs the template's waiver permission (default Administer projects).
 * A waived mandatory item counts as done for the gate.
 */
export async function waiveChecklistItem(payload: any, context?: any, storageProvider?: StorageProvider): Promise<IssueChecklistState> {
  const c = panelContext(context);
  const itemId = String(payload?.itemId || '');
  const reason = typeof payload?.reason === 'string' ? payload.reason.trim() : '';
  if (reason.length < 10 || reason.length > 500) {
    throw new Error(WAIVER_REASON_INVALID);
  }
  assertLicensed(context);

  const storage = resolveStorage(storageProvider);
  const store = new ChecklistStore(storage);
  const at = new Date().toISOString();
  const current = await currentState(storage, store, c);
  if (!current.criteria.some(x => x.templateItemId === itemId)) {
    throw new Error(`Checklist item with id '${itemId}' not found on issue ${current.issue.workEffortName}`);
  }
  // Refuse an invalid change before the permission call (StatusValidChange, spec v3 section 5).
  statusEntry(current, { templateItemId: itemId, statusIdTo: 'DOD_WAIVED', transitionName: 'Waive', actorPartyId: c.actorAccountId, at, reason });
  const isApprover = await hasApproverPermission(c.issueKey, storage);
  if (!isApprover) {
    const waiverPermission = permissionKeyOf(current.template.waiverRoleTypeId);
    await checkIssuePermissions(c.issueKey, [waiverPermission],
      `Only users with the ${permissionLabel(waiverPermission)} Jira permission can waive this item.`);
  }
  // H-1: an approver who is or was the assignee cannot waive a not-the-assignee item.
  const target = current.criteria.find(x => x.templateItemId === itemId)!;
  if (target.excludedRoleTypeId === 'ASSIGNEE' && (await actorWasAssignee(c.issueKey, c.actorAccountId, target))) {
    throw new PermissionDeniedError(ASSIGNEE_WAIVE_DENIED);
  }

  const actor = await new PartyStore(storage).pseudonymFor(c.actorAccountId);
  const state = await store.mutate(
    c.issueId,
    base => store.initFromLegacyOr(base, () => templateFor(storage, c), actor, at),
    st => [statusEntry(st, { templateItemId: itemId, statusIdTo: 'DOD_WAIVED', transitionName: 'Waive', actorPartyId: actor, at, reason })],
    { issueKey: c.issueKey, projectId: c.projectId }
  );

  await publishAttestation(state, new Date().toISOString());
  return panelResponse(storage, state);
}

/**
 * The evidence recorded with an item's current tick, read from its event on request.
 * The state keeps only a flag, so the state value stays small (spec v2, D-13).
 */
export async function getItemEvidence(payload: any, context?: any, storageProvider?: StorageProvider) {
  const c = panelContext(context);
  const itemId = String(payload?.itemId || '');
  const storage = resolveStorage(storageProvider);
  const state = await new ChecklistStore(storage).load(c.issueId);
  if (!state) return { itemId, evidence: undefined };
  const criterion = state.criteria.find(x => x.templateItemId === itemId);
  if (!criterion) {
    throw new Error(`Checklist item with id '${itemId}' not found on issue ${state.issue.workEffortName}`);
  }
  if (!criterion.evidenceContentId || !criterion.lastStatusSeq) return { itemId, evidence: undefined };
  const entry = await storage.get<ChangeEntry>(eventKey(c.issueId, criterion.lastStatusSeq));
  const content = entry?.rows.find(r => r.entity === 'Content' && r.contentId === criterion.evidenceContentId) as
    Extract<ChangeEntry['rows'][number], { entity: 'Content' }> | undefined;
  if (!content) return { itemId, evidence: undefined };
  return { itemId, evidence: { ...(content.objectInfo ? { url: content.objectInfo } : {}), ...(content.textData ? { note: content.textData } : {}) } };
}

export const EXPORT_DENIED = 'Only a project admin can export this history.';

/**
 * The whole history of the issue as JSON text, with the chain check and its limit, for an
 * auditor. Project admins only. The panel shows the text to copy (UI Kit has no file download).
 */
export async function exportChecklistHistory(_payload: any, context?: any, storageProvider?: StorageProvider) {
  const c = panelContext(context);
  await checkIssuePermissions(c.issueKey, ['ADMINISTER_PROJECTS'], EXPORT_DENIED);
  const storage = resolveStorage(storageProvider);
  const store = new ChecklistStore(storage);
  const state = await store.load(c.issueId);
  const events = await store.allEvents(c.issueId, state);
  const check = verifyChain(c.issueId, events, state);
  const doc = {
    format: 'definitionguard-history-export',
    formatVersion: 2,
    // ADR-010: events name people by pseudonym. This maps each pseudonym to the person's account
    // id while the account exists; a closed account is erased from the map, not from the events.
    parties: await new PartyStore(storage).accountsOf(events.map(e => e.actorPartyId)
      .concat(events.flatMap(e => e.rows.map(r => (r.entity === 'WorkEffortStatus' ? r.setByPartyId : ''))))),
    issueId: c.issueId,
    issueKey: c.issueKey,
    exportedAt: new Date().toISOString(),
    exportedByAccountId: c.actorAccountId,
    state: state
      ? { stateVersion: state.seq, templateId: state.template.workEffortId, templateVersion: state.template.revisionNumber, headHash: state.headHash, legacy: state.legacy }
      : null,
    chain: { ...check, message: chainMessage(check) },
    limit: CHAIN_LIMIT_NOTE,
    events
  };
  return { fileName: `${c.issueKey}-definitionguard-history.json`, text: JSON.stringify(doc, null, 2) };
}

/**
 * Toggles a checklist item's completion state and records it as an event.
 */
export async function toggleChecklistItem(payload: any, context?: any, storageProvider?: StorageProvider): Promise<IssueChecklistState> {
  const c = panelContext(context);
  const itemId = String(payload?.itemId || '');
  const isCompleted = Boolean(payload?.isCompleted);
  if (!itemId) {
    throw new Error('DefinitionGuard: Missing itemId.');
  }
  const checked = validateEvidence(payload?.evidence);
  if (!checked.ok) {
    throw new Error(checked.error);
  }
  const evidence = isCompleted ? checked.evidence : undefined;

  assertLicensed(context);

  const storage = resolveStorage(storageProvider);
  const store = new ChecklistStore(storage);
  const at = new Date().toISOString();

  // The item's rules decide which permissions to check, so read the current checklist first.
  const current = await currentState(storage, store, c);
  const target = current.criteria.find(x => x.templateItemId === itemId);
  if (!target) {
    throw new Error(`Checklist item with id '${itemId}' not found on issue ${current.issue.workEffortName}`);
  }
  let actor = c.actorAccountId;
  const change = (st: DodState) => statusEntry(st, {
    templateItemId: itemId,
    statusIdTo: isCompleted ? 'DOD_DONE' : 'DOD_OPEN',
    transitionName: isCompleted ? 'Complete' : 'Reopen',
    actorPartyId: actor,
    at,
    evidence
  });
  // Refuse an invalid change (StatusValidChange) and missing evidence before any Jira call.
  change(current);
  if (isCompleted && target.evidenceRequired && !evidence) {
    throw new Error(EVIDENCE_REQUIRED);
  }
  const waiverPermission = permissionKeyOf(current.template.waiverRoleTypeId);
  const requiredPermission = target.requiredRoleTypeId ? permissionKeyOf(target.requiredRoleTypeId) : undefined;
  const reopensWaiver = !isCompleted && target.currentStatusId === 'DOD_WAIVED';
  const keys = ['EDIT_ISSUES'];
  if (isCompleted && requiredPermission) keys.push(requiredPermission);
  if (reopensWaiver) keys.push(waiverPermission);
  const granted = await getIssuePermissions(c.issueKey, [...new Set(keys)]);
  if (!granted.EDIT_ISSUES) throw new PermissionDeniedError(EDIT_DENIED);
  if (isCompleted && requiredPermission && !granted[requiredPermission]) {
    throw new PermissionDeniedError(`You need the ${permissionLabel(requiredPermission)} Jira permission to complete this item.`);
  }
  if (reopensWaiver) {
    const isApprover = await hasApproverPermission(c.issueKey, storage);
    if (!isApprover && !granted[waiverPermission]) {
      throw new PermissionDeniedError(`Only users with the ${permissionLabel(waiverPermission)} Jira permission can reopen a waived item.`);
    }
  }
  if (isCompleted && target.excludedRoleTypeId === 'ASSIGNEE') {
    const was = await actorWasAssignee(c.issueKey, c.actorAccountId, target);
    if (was) throw new PermissionDeniedError(was === 'current' ? ASSIGNEE_DENIED : FORMER_ASSIGNEE_DENIED);
  }

  actor = await new PartyStore(storage).pseudonymFor(c.actorAccountId);
  const state = await store.mutate(
    c.issueId,
    base => store.initFromLegacyOr(base, () => templateFor(storage, c), actor, at),
    st => {
      const item = st.criteria.find(x => x.templateItemId === itemId);
      if (isCompleted && item?.evidenceRequired && !evidence) {
        throw new Error(EVIDENCE_REQUIRED);
      }
      return [change(st)];
    },
    { issueKey: c.issueKey, projectId: c.projectId }
  );

  await publishAttestation(state, new Date().toISOString());
  return panelResponse(storage, state);
}

/**
 * Resets an issue's checklist while monotonically preserving audit history (Fixes D-13).
 */
export async function resetChecklist(_payload: any, context?: any, storageProvider?: StorageProvider): Promise<IssueChecklistState> {
  const c = panelContext(context);

  assertLicensed(context);
  const storage = resolveStorage(storageProvider);
  const isApprover = await hasApproverPermission(c.issueKey, storage);
  if (!isApprover) {
    await checkIssuePermissions(c.issueKey, ['ADMINISTER_PROJECTS'], RESET_DENIED);
  }

  const store = new ChecklistStore(storage);
  const at = new Date().toISOString();

  const actor = await new PartyStore(storage).pseudonymFor(c.actorAccountId);
  const state = await store.mutate(
    c.issueId,
    base => store.initFromLegacyOr(base, () => templateFor(storage, c), actor, at),
    st => [resetEntry(st, actor, at)],
    { issueKey: c.issueKey, projectId: c.projectId }
  );

  await publishAttestation(state, new Date().toISOString());
  return panelResponse(storage, state);
}

// Register Forge Resolver for UI Kit 2 bridge invocations
const resolver = new Resolver();

resolver.define('getChecklist', async (req) => {
  return await getIssueChecklist(req.payload, req.context);
});

resolver.define('toggleItem', async (req) => {
  return await toggleChecklistItem(req.payload, req.context);
});

resolver.define('resetChecklist', async (req) => {
  return await resetChecklist(req.payload, req.context);
});

resolver.define('waiveItem', async (req) => {
  return await waiveChecklistItem(req.payload, req.context);
});

resolver.define('getEvidence', async (req) => {
  return await getItemEvidence(req.payload, req.context);
});

resolver.define('exportHistory', async (req) => {
  return await exportChecklistHistory(req.payload, req.context);
});

resolver.define('getHistory', async (req) => {
  return await getChecklistHistory(req.payload, req.context);
});

resolver.define('authority-policy-get', async (req) => {
  return await getApproverPolicyFlow(resolveStorage(), req.context);
});

resolver.define('authority-group-search', async (req) => {
  return await searchGroupsFlow(req.payload, req.context);
});

resolver.define('authority-policy-set', async (req) => {
  return await setApproverPolicyFlow(req.payload, resolveStorage(), req.context);
});

resolver.define('getAvailableTemplates', async () => {
  return getAvailableTemplates();
});

export const handler = resolver.getDefinitions();

const adminResolver = new Resolver();

adminResolver.define('authority-policy-get', async (req) => {
  return await getApproverPolicyFlow(resolveStorage(), req.context);
});

adminResolver.define('authority-group-search', async (req) => {
  return await searchGroupsFlow(req.payload, req.context);
});

adminResolver.define('authority-policy-set', async (req) => {
  return await setApproverPolicyFlow(req.payload, resolveStorage(), req.context);
});

export const adminHandler = adminResolver.getDefinitions();

