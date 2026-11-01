import api, { route } from '@forge/api';
import Resolver from '@forge/resolver';
import {
  getTemplateForCategory,
  getAvailableTemplates
} from './domain/checklist-engine';
import { TransitionValidator } from './validator/transition-validator';
import { StorageProvider } from './storage/checklist-repository';
import { resolveStorage } from './storage/forge-storage';
import { ChecklistStore } from './storage/checklist-store';
import { applyEvent, createdEvent, emptyState, chainMessage, CHAIN_LIMIT_NOTE } from './domain/event-log';
import { ChecklistEvent, ChecklistState, IssueChecklistState, ChecklistAuditEvent } from './domain/models';
import { checkIssuePermissions, EDIT_DENIED, RESET_DENIED } from './security/permissions';
import { resolveTemplate } from './settings/template-store';
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

/**
 * Fetches the authentic Jira user display name.
 */
export async function fetchJiraUser(accountId: string): Promise<string> {
  try {
    const res = await api.asApp().requestJira(route`/rest/api/3/user?accountId=${accountId}`);
    if (res.status === 200) {
      const data = await res.json();
      return data.displayName || accountId;
    }
  } catch {}
  return accountId;
}

export const VALIDATOR_FAILURE_MESSAGE =
  'DefinitionGuard could not check the Definition of Done, so this move is blocked. ' +
  'Try again. If it keeps failing, ask your Jira admin.';

/**
 * Fetches the issue for the validator. Unlike fetchLiveJiraIssue, any failure throws,
 * so the validator blocks instead of guessing (fail closed).
 */
async function fetchIssueForValidator(issueIdOrKey: string): Promise<any> {
  const res = await api.asApp().requestJira(route`/rest/api/3/issue/${issueIdOrKey}?fields=issuetype,project`);
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
    completedAt: i.status !== 'OPEN' ? i.at : undefined
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

  const validation = TransitionValidator.validate({ ...state, items: toLegacyItems(state) } as any);
  return TransitionValidator.toForgeValidatorResult(validation);
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
  WAIVE: 'CHECK',
  UNTICK: 'UNCHECK',
  RESET: 'RESET'
};

/** The panel response. Keeps the fields the panel reads; names are accountIds. */
export function toPanelResponse(state: ChecklistState, events: ChecklistEvent[] = []): IssueChecklistState {
  const items = toLegacyItems(state);
  return {
    issueId: state.issueId,
    issueKey: state.issueKey,
    templateId: state.templateId,
    items,
    lastModifiedAt: state.lastModifiedAt || '',
    lastModifiedBy: state.lastModifiedByAccountId || '',
    isFullySatisfied: items.filter(i => i.isMandatory).every(i => i.isCompleted),
    checklistHash: state.headHash,
    stateVersion: state.seq,
    auditTrail: events.map(e => ({
      id: `evt-${e.seq}`,
      timestamp: e.at,
      eventType: AUDIT_TYPE[e.type],
      actorName: e.actorAccountId,
      actorAccountId: e.actorAccountId,
      itemId: e.itemId,
      itemTitle: e.itemTitle
    }))
  };
}

async function publishProperty(issueId: string, response: IssueChecklistState): Promise<void> {
  // Publish DoD status to Jira issue entity property for cross-reality audits
  try {
    await api.asApp().requestJira(route`/rest/api/3/issue/${issueId}/properties/definitionguard-dod`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        isFullySatisfied: response.isFullySatisfied,
        completedCount: response.items.filter(i => i.isCompleted).length,
        totalCount: response.items.length,
        checklistHash: response.checklistHash,
        lastModifiedAt: response.lastModifiedAt
      })
    });
  } catch {}
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

  await checkIssuePermissions(c.issueKey, ['EDIT_ISSUES'], EDIT_DENIED);

  const storage = resolveStorage(storageProvider);
  const store = new ChecklistStore(storage);
  const at = new Date().toISOString();

  const state = await store.mutate(
    c.issueId,
    base => store.initFromLegacyOr(base, () => templateFor(storage, c), c.actorAccountId, at),
    st => {
      const item = st.items.find(i => i.id === itemId);
      if (!item) {
        throw new Error(`Checklist item with id '${itemId}' not found on issue ${st.issueKey}`);
      }
      return [{ type: isCompleted ? 'TICK' : 'UNTICK', itemId, itemTitle: item.title, actorAccountId: c.actorAccountId, at }];
    },
    { issueKey: c.issueKey, projectId: c.projectId }
  );

  const response = toPanelResponse(state);
  await publishProperty(c.issueId, response);
  return response;
}

/**
 * Resets an issue's checklist while monotonically preserving audit history (Fixes D-13).
 */
export async function resetChecklist(_payload: any, context?: any, storageProvider?: StorageProvider): Promise<IssueChecklistState> {
  const c = panelContext(context);

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

  const response = toPanelResponse(state);
  await publishProperty(c.issueId, response);
  return response;
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

resolver.define('getHistory', async (req) => {
  return await getChecklistHistory(req.payload, req.context);
});

resolver.define('getAvailableTemplates', async () => {
  return getAvailableTemplates();
});

export const handler = resolver.getDefinitions();
