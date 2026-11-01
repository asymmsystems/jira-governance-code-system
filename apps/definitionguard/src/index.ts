import api, { route } from '@forge/api';
import Resolver from '@forge/resolver';
import {
  getTemplateForCategory,
  getAvailableTemplates
} from './domain/checklist-engine';
import { evaluateGate, blockMessage } from './domain/gate-rule';
import { ProjectConfigStore } from './settings/project-config';
import { StorageProvider } from './storage/checklist-repository';
import { resolveStorage } from './storage/forge-storage';
import { ChecklistStore, eventKey } from './storage/checklist-store';
import { applyEntry, createEntry, emptyState, statusEntry, resetEntry, chainMessage, verifyChain, CHAIN_LIMIT_NOTE } from './domain/event-log';
import { ChangeEntry, DodState, DodTemplate, IssueChecklistState, ChecklistAuditEvent } from './domain/models';
import { permissionKeyOf } from './domain/roles';
import { checkIssuePermissions, getIssuePermissions, permissionLabel, PermissionDeniedError, EDIT_DENIED, RESET_DENIED } from './security/permissions';
import { resolveTemplate } from './settings/template-store';
import { assertLicensed, isLicenceInactive, VALIDATOR_LICENCE_INACTIVE } from './security/licence';
import { validateEvidence, EVIDENCE_REQUIRED } from './domain/evidence';
import { publishAttestation } from './integrity/attestation';

export { settingsHandler } from './settings/settings-resolvers';

export { setGlobalStorageProvider, resolveStorage } from './storage/forge-storage';

/**
 * Fetches the authentic Jira issue representation to determine issue type.
 */
export async function fetchLiveJiraIssue(issueIdOrKey: string): Promise<any | null> {
  try {
    const res = await api.asApp().requestJira(route`/rest/api/3/issue/${issueIdOrKey}?fields=issuetype,project,status`);
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
  const res = await api.asApp().requestJira(route`/rest/api/3/issue/${issueIdOrKey}?fields=issuetype,project,assignee`);
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

/** The panel's item shape (frozen contract), from the criteria. */
function toLegacyItems(state: DodState) {
  return state.criteria.map(c => {
    const closed = c.currentStatusId !== 'DOD_OPEN';
    return {
      id: c.templateItemId,
      title: c.workEffortName,
      isMandatory: c.isMandatory,
      category: c.purposeTypeId,
      isCompleted: closed,
      completedBy: closed ? c.lastStatusByPartyId : undefined,
      completedByAccountId: closed ? c.lastStatusByPartyId : undefined,
      completedAt: closed ? c.lastStatusUpdate : undefined,
      completedByLegacyName: closed ? c.legacyName : undefined,
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
  if (isLicenceInactive(context)) {
    return { result: false, errorMessage: VALIDATOR_LICENCE_INACTIVE };
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
  let assigneeAccountId: string | undefined;
  if (state.criteria.some(c => c.excludedRoleTypeId === 'ASSIGNEE' && c.currentStatusId === 'DOD_DONE')) {
    live = live?.fields && 'assignee' in live.fields ? live : await fetchIssueForValidator(issueId);
    assigneeAccountId = live?.fields?.assignee?.accountId;
  }

  const gate = evaluateGate(state, assigneeAccountId);
  if (gate.satisfied) {
    return { result: true };
  }

  // Unsatisfied: the gate applies to moves into a Done-category status that the admin has not exempted.
  // A missing target is treated as a Done move (fail closed).
  const targetId = String(payload?.transition?.to?.id || '');
  if (targetId) {
    const res = await api.asApp().requestJira(route`/rest/api/3/status/${targetId}`);
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
  Reset: 'RESET'
};

/** One history row per change-log entry, in the panel's audit shape (frozen contract). */
function auditRow(state: DodState, e: ChangeEntry): ChecklistAuditEvent {
  const row: ChecklistAuditEvent = {
    id: `evt-${e.seq}`,
    timestamp: e.at,
    eventType: AUDIT_TYPE[e.transitionName],
    actorName: e.actorPartyId,
    actorAccountId: e.actorPartyId
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

/** The panel response (frozen contract). Names are accountIds; the panel renders them. */
export function toPanelResponse(state: DodState, entries: ChangeEntry[] = []): IssueChecklistState {
  const items = toLegacyItems(state);
  const gate = evaluateGate(state);
  return {
    issueId: state.issue.sourceReferenceId,
    issueKey: state.issue.workEffortName,
    templateId: state.template.workEffortId,
    items,
    lastModifiedAt: state.lastModifiedAt || '',
    lastModifiedBy: state.lastModifiedByPartyId || '',
    isFullySatisfied: gate.satisfied,
    openMandatoryTitles: gate.openMandatory.map(c => c.workEffortName),
    checklistHash: state.headHash,
    stateVersion: state.seq,
    auditTrail: entries.map(e => auditRow(state, e))
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
    state = applyEntry(base, createEntry(base, await templateFor(storage, c), c.actorAccountId, new Date().toISOString()));
    state = { ...state, seq: 0 };
  }
  return toPanelResponse(state);
}

/**
 * One page of the issue's events (at most 100), oldest first, for the history view.
 */
export async function getChecklistHistory(payload: any, context?: any, storageProvider?: StorageProvider) {
  const c = panelContext(context);
  const store = new ChecklistStore(resolveStorage(storageProvider));
  const cursor = typeof payload?.cursor === 'string' ? payload.cursor : undefined;
  const page = await store.history(c.issueId, cursor);
  const state = await store.load(c.issueId);
  const check = await store.verify(c.issueId);
  return {
    events: page.events,
    chain: { ...check, message: chainMessage(check), limit: CHAIN_LIMIT_NOTE },
    auditTrail: toPanelResponse(state || emptyState(c.issueId, c.issueKey, c.projectId), page.events).auditTrail,
    nextCursor: page.nextCursor,
    eventCount: state?.seq || 0
  };
}

export const ASSIGNEE_DENIED = 'The assignee cannot complete this item. Ask a reviewer.';
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
    res = await api.asUser().requestJira(route`/rest/api/3/issue/${issueKey}?fields=assignee`);
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
  const waiverPermission = permissionKeyOf(current.template.waiverRoleTypeId);
  await checkIssuePermissions(c.issueKey, [waiverPermission],
    `Only users with the ${permissionLabel(waiverPermission)} Jira permission can waive this item.`);

  const state = await store.mutate(
    c.issueId,
    base => store.initFromLegacyOr(base, () => templateFor(storage, c), c.actorAccountId, at),
    st => [statusEntry(st, { templateItemId: itemId, statusIdTo: 'DOD_WAIVED', transitionName: 'Waive', actorPartyId: c.actorAccountId, at, reason })],
    { issueKey: c.issueKey, projectId: c.projectId }
  );

  await publishAttestation(state, new Date().toISOString());
  return toPanelResponse(state);
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
  const store = new ChecklistStore(resolveStorage(storageProvider));
  const state = await store.load(c.issueId);
  const events = await store.allEvents(c.issueId, state);
  const check = verifyChain(c.issueId, events, state);
  const doc = {
    format: 'definitionguard-history-export',
    formatVersion: 1,
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
  const change = (st: DodState) => statusEntry(st, {
    templateItemId: itemId,
    statusIdTo: isCompleted ? 'DOD_DONE' : 'DOD_OPEN',
    transitionName: isCompleted ? 'Complete' : 'Reopen',
    actorPartyId: c.actorAccountId,
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
  if (reopensWaiver && !granted[waiverPermission]) {
    throw new PermissionDeniedError(`Only users with the ${permissionLabel(waiverPermission)} Jira permission can reopen a waived item.`);
  }
  if (isCompleted && target.excludedRoleTypeId === 'ASSIGNEE' && (await currentAssignee(c.issueKey)) === c.actorAccountId) {
    throw new PermissionDeniedError(ASSIGNEE_DENIED);
  }

  const state = await store.mutate(
    c.issueId,
    base => store.initFromLegacyOr(base, () => templateFor(storage, c), c.actorAccountId, at),
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
  return toPanelResponse(state);
}

/**
 * Resets an issue's checklist while monotonically preserving audit history (Fixes D-13).
 */
export async function resetChecklist(_payload: any, context?: any, storageProvider?: StorageProvider): Promise<IssueChecklistState> {
  const c = panelContext(context);

  assertLicensed(context);
  await checkIssuePermissions(c.issueKey, ['ADMINISTER_PROJECTS'], RESET_DENIED);

  const storage = resolveStorage(storageProvider);
  const store = new ChecklistStore(storage);
  const at = new Date().toISOString();

  const state = await store.mutate(
    c.issueId,
    base => store.initFromLegacyOr(base, () => templateFor(storage, c), c.actorAccountId, at),
    st => [resetEntry(st, c.actorAccountId, at)],
    { issueKey: c.issueKey, projectId: c.projectId }
  );

  await publishAttestation(state, new Date().toISOString());
  return toPanelResponse(state);
}

/**
 * Issue panel rendering function.
 */
export async function renderIssuePanel(context: any) {
  return {
    moduleKey: 'definitionguard-panel',
    context
  };
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

resolver.define('getAvailableTemplates', async () => {
  return getAvailableTemplates();
});

export const handler = resolver.getDefinitions();
