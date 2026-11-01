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
import { applyEvent, createdEvent, emptyState, chainMessage, CHAIN_LIMIT_NOTE } from './domain/event-log';
import { ChecklistEvent, ChecklistState, IssueChecklistState, ChecklistAuditEvent } from './domain/models';
import { checkIssuePermissions, getIssuePermissions, permissionLabel, PermissionDeniedError, EDIT_DENIED, RESET_DENIED } from './security/permissions';
import { resolveTemplate } from './settings/template-store';
import { assertLicensed, isLicenceInactive, VALIDATOR_LICENCE_INACTIVE } from './security/licence';
import { validateEvidence, EVIDENCE_REQUIRED } from './domain/evidence';
import { publishAttestation } from './integrity/attestation';
import { ChecklistTemplate } from './domain/models';

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
function stateFromTemplate(issueId: string, issueKey: string, projectId: string, template: ChecklistTemplate): ChecklistState {
  const base = emptyState(issueId, issueKey, projectId);
  return applyEvent(base, createdEvent(base, template, 'system', new Date().toISOString()));
}

/** The v1 item shape that TransitionValidator and the current panel read. */
function toLegacyItems(state: ChecklistState) {
  return state.items.map(i => ({
    id: i.id,
    title: i.title,
    isMandatory: i.isMandatory,
    category: i.category,
    isCompleted: i.status !== 'OPEN',
    completedBy: i.status !== 'OPEN' ? i.byAccountId : undefined,
    completedByAccountId: i.status !== 'OPEN' ? i.byAccountId : undefined,
    completedAt: i.status !== 'OPEN' ? i.at : undefined,
    completedByLegacyName: i.status !== 'OPEN' ? i.legacyName : undefined,
    waived: i.status === 'WAIVED',
    evidenceRequired: Boolean(i.evidenceRequired),
    hasEvidence: Boolean(i.hasEvidence)
  }));
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
  if (state.items.some(i => i.notAssignee && i.status === 'DONE')) {
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
    let projectId = state.projectId || String(context?.extension?.project?.id || '');
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

const AUDIT_TYPE: Record<string, ChecklistAuditEvent['eventType']> = {
  CREATED: 'TEMPLATE_CONFIGURED',
  MIGRATED: 'TEMPLATE_CONFIGURED',
  RESYNC: 'TEMPLATE_CONFIGURED',
  TICK: 'CHECK',
  WAIVE: 'WAIVE',
  UNTICK: 'UNCHECK',
  RESET: 'RESET'
};

/** The panel response. Keeps the fields the panel reads; names are accountIds. */
export function toPanelResponse(state: ChecklistState, events: ChecklistEvent[] = []): IssueChecklistState {
  const items = toLegacyItems(state);
  const gate = evaluateGate(state);
  return {
    issueId: state.issueId,
    issueKey: state.issueKey,
    templateId: state.templateId,
    items,
    lastModifiedAt: state.lastModifiedAt || '',
    lastModifiedBy: state.lastModifiedByAccountId || '',
    isFullySatisfied: gate.satisfied,
    openMandatoryTitles: gate.openMandatory.map(i => i.title),
    checklistHash: state.headHash,
    stateVersion: state.seq,
    auditTrail: events.map(e => ({
      id: `evt-${e.seq}`,
      timestamp: e.at,
      eventType: AUDIT_TYPE[e.type],
      actorName: e.actorAccountId,
      actorAccountId: e.actorAccountId,
      itemId: e.itemId,
      itemTitle: e.itemTitle,
      evidence: e.evidence,
      details: e.reason
    }))
  };
}


/** The template for a panel action: ids from the context, else from one issue lookup. */
async function templateFor(storage: StorageProvider, c: ReturnType<typeof panelContext>): Promise<ChecklistTemplate> {
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
    state = applyEvent(base, createdEvent(base, await templateFor(storage, c), c.actorAccountId, new Date().toISOString()));
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
async function currentState(storage: StorageProvider, store: ChecklistStore, c: ReturnType<typeof panelContext>): Promise<ChecklistState> {
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
  if (!current.items.some(i => i.id === itemId)) {
    throw new Error(`Checklist item with id '${itemId}' not found on issue ${current.issueKey}`);
  }
  const waiverPermission = current.waiverPermission || 'ADMINISTER_PROJECTS';
  await checkIssuePermissions(c.issueKey, [waiverPermission],
    `Only users with the ${permissionLabel(waiverPermission)} Jira permission can waive this item.`);

  const state = await store.mutate(
    c.issueId,
    base => store.initFromLegacyOr(base, () => templateFor(storage, c), c.actorAccountId, at),
    st => {
      const item = st.items.find(i => i.id === itemId);
      if (!item) {
        throw new Error(`Checklist item with id '${itemId}' not found on issue ${st.issueKey}`);
      }
      return [{ type: 'WAIVE', itemId, itemTitle: item.title, reason, actorAccountId: c.actorAccountId, at }];
    },
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
  const item = state.items.find(i => i.id === itemId);
  if (!item) {
    throw new Error(`Checklist item with id '${itemId}' not found on issue ${state.issueKey}`);
  }
  if (!item.hasEvidence || !item.eventSeq) return { itemId, evidence: undefined };
  const event = await storage.get<ChecklistEvent>(eventKey(c.issueId, item.eventSeq));
  return { itemId, evidence: event?.evidence };
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
  const target = current.items.find(i => i.id === itemId);
  if (!target) {
    throw new Error(`Checklist item with id '${itemId}' not found on issue ${current.issueKey}`);
  }
  const waiverPermission = current.waiverPermission || 'ADMINISTER_PROJECTS';
  const reopensWaiver = !isCompleted && target.status === 'WAIVED';
  const keys = ['EDIT_ISSUES'];
  if (isCompleted && target.requiredPermission) keys.push(target.requiredPermission);
  if (reopensWaiver) keys.push(waiverPermission);
  const granted = await getIssuePermissions(c.issueKey, [...new Set(keys)]);
  if (!granted.EDIT_ISSUES) throw new PermissionDeniedError(EDIT_DENIED);
  if (isCompleted && target.requiredPermission && !granted[target.requiredPermission]) {
    throw new PermissionDeniedError(`You need the ${permissionLabel(target.requiredPermission)} Jira permission to complete this item.`);
  }
  if (reopensWaiver && !granted[waiverPermission]) {
    throw new PermissionDeniedError(`Only users with the ${permissionLabel(waiverPermission)} Jira permission can reopen a waived item.`);
  }
  if (isCompleted && target.notAssignee && (await currentAssignee(c.issueKey)) === c.actorAccountId) {
    throw new PermissionDeniedError(ASSIGNEE_DENIED);
  }

  const state = await store.mutate(
    c.issueId,
    base => store.initFromLegacyOr(base, () => templateFor(storage, c), c.actorAccountId, at),
    st => {
      const item = st.items.find(i => i.id === itemId);
      if (!item) {
        throw new Error(`Checklist item with id '${itemId}' not found on issue ${st.issueKey}`);
      }
      if (isCompleted && item.evidenceRequired && !evidence) {
        throw new Error(EVIDENCE_REQUIRED);
      }
      return [{ type: isCompleted ? 'TICK' : 'UNTICK', itemId, itemTitle: item.title, actorAccountId: c.actorAccountId, at, ...(evidence ? { evidence } : {}) }];
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
    () => [{ type: 'RESET', actorAccountId: c.actorAccountId, at }],
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

resolver.define('getHistory', async (req) => {
  return await getChecklistHistory(req.payload, req.context);
});

resolver.define('getAvailableTemplates', async () => {
  return getAvailableTemplates();
});

export const handler = resolver.getDefinitions();
