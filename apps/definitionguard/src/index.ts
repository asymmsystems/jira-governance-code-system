import api, { route } from '@forge/api';
import Resolver from '@forge/resolver';
import { kvs } from '@forge/kvs';
import {
  ChecklistEngine,
  getTemplateForCategory,
  getTemplateById,
  getAvailableTemplates,
  DEFAULT_DEFINITION_OF_DONE,
  ALL_TEMPLATES
} from './domain/checklist-engine';
import { TransitionValidator } from './validator/transition-validator';
import { ChecklistRepository, StorageProvider } from './storage/checklist-repository';
import { ChecklistToggleRequest, IssueChecklistState, ProjectDoDConfig, ChecklistTemplate } from './domain/models';

class ForgeKvsProvider implements StorageProvider {
  async get<T>(key: string): Promise<T | undefined> {
    const val = await kvs.get(key);
    return val as T;
  }

  async set(key: string, value: any): Promise<void> {
    await kvs.set(key, value);
  }

  async delete(key: string): Promise<void> {
    await kvs.delete(key);
  }
}

let globalStorageProvider: StorageProvider | null = null;

export function setGlobalStorageProvider(provider: StorageProvider | null): void {
  globalStorageProvider = provider;
}

export function resolveStorage(customProvider?: StorageProvider): StorageProvider {
  if (customProvider) {
    return customProvider;
  }
  if (globalStorageProvider) {
    return globalStorageProvider;
  }
  if (process.env.NODE_ENV === 'test') {
    throw new Error('DefinitionGuard: StorageProvider must be initialized.');
  }
  return new ForgeKvsProvider();
}

/**
 * Fetches the authentic Jira issue representation to determine issue type.
 */
export async function fetchLiveJiraIssue(issueIdOrKey: string): Promise<any | null> {
  try {
    const res = await api.asApp().requestJira(route`/rest/api/3/issue/${issueIdOrKey}?fields=issuetype,status`);
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
  const res = await api.asApp().requestJira(route`/rest/api/3/issue/${issueIdOrKey}?fields=issuetype`);
  if (res.status !== 200) {
    throw new Error(`DefinitionGuard: issue lookup returned ${res.status}`);
  }
  return await res.json();
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

  const storage = resolveStorage(storageProvider);
  const repository = new ChecklistRepository(storage);

  let checklistState = await repository.getIssueChecklist(issueId);

  // No checklist yet: apply the issue-type template in memory and block on it (Fixes D-14).
  // Nothing is stored; the first change on the panel creates the record.
  if (!checklistState) {
    let issueType = context?.extension?.issue?.type;
    if (!issueType) {
      live = live || await fetchIssueForValidator(issueId);
      issueType = live?.fields?.issuetype?.name;
    }
    const template = getTemplateForCategory(issueType || 'Task');
    checklistState = ChecklistEngine.initializeState(issueId, String(issueKey || issueId), template, 'system');
  }

  const validation = TransitionValidator.validate(checklistState);
  return TransitionValidator.toForgeValidatorResult(validation);
}

/**
 * Retrieves the current checklist state for an issue, initializing category-specific DoD if none exists.
 */
export async function getIssueChecklist(payload: any, context?: any, storageProvider?: StorageProvider): Promise<IssueChecklistState> {
  const contextIssue = context?.extension?.issue;
  const issueId = String(contextIssue?.id || payload?.issueId || payload?.issue?.id || '');
  const issueKey = String(contextIssue?.key || payload?.issueKey || payload?.issue?.key || issueId);
  const userId = String(context?.accountId || payload?.userId || 'anonymous');

  if (!issueId) {
    throw new Error('DefinitionGuard: Missing issueId.');
  }

  const storage = resolveStorage(storageProvider);
  const repository = new ChecklistRepository(storage);

  let state = await repository.getIssueChecklist(issueId);
  if (!state) {
    // Automatically select category template based on Jira issue type
    let issueType = contextIssue?.type;
    if (!issueType) {
      const live = await fetchLiveJiraIssue(issueId);
      issueType = live?.fields?.issuetype?.name;
    }
    const template = getTemplateForCategory(issueType);

    state = ChecklistEngine.initializeState(issueId, issueKey, template, userId);
    await repository.saveIssueChecklist(state);

    // Publish initial DoD status to Jira issue entity property (Fixes H2)
    try {
      await api.asApp().requestJira(route`/rest/api/3/issue/${issueId}/properties/definitionguard-dod`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          isFullySatisfied: state.isFullySatisfied,
          completedCount: state.items.filter(i => i.isCompleted).length,
          totalCount: state.items.length,
          checklistHash: state.checklistHash
        })
      });
    } catch {}
  } else {
    // Retroactively resolve any stored raw account IDs to human display names (Fixes M-1)
    let modified = false;
    for (const item of state.items) {
      if (item.completedBy && (item.completedBy.startsWith('712020:') || item.completedBy.includes(':'))) {
        try {
          const name = await fetchJiraUser(item.completedBy);
          if (name && name !== item.completedBy) {
            item.completedBy = name;
            modified = true;
          }
        } catch {}
      }
      if (item.history) {
        for (const entry of item.history) {
          if (entry.userId && (entry.userId.startsWith('712020:') || entry.userId.includes(':'))) {
            try {
              const name = await fetchJiraUser(entry.userId);
              if (name && name !== entry.userId) {
                entry.userId = name;
                modified = true;
              }
            } catch {}
          }
        }
      }
    }
    if (modified) {
      await repository.saveIssueChecklist(state);
    }
  }

  return state;
}

/**
 * Toggles a checklist item's completion state and updates attribution.
 */
export async function toggleChecklistItem(payload: any, context?: any, storageProvider?: StorageProvider): Promise<IssueChecklistState> {
  const contextIssue = context?.extension?.issue;
  const issueId = String(contextIssue?.id || payload?.issueId || payload?.issue?.id || '');
  const issueKey = String(contextIssue?.key || payload?.issueKey || payload?.issue?.key || issueId);
  const { itemId, isCompleted, notes } = payload || {};
  const rawUserId = String(context?.accountId || payload?.userId || 'anonymous');

  if (!issueId || !itemId) {
    throw new Error('DefinitionGuard: Missing issueId or itemId.');
  }

  // Resolve human display name for attribution
  let userDisplayName = rawUserId;
  if (context?.accountId) {
    userDisplayName = await fetchJiraUser(context.accountId);
  }

  const storage = resolveStorage(storageProvider);
  const repository = new ChecklistRepository(storage);

  let state = await repository.getIssueChecklist(String(issueId));
  if (!state) {
    const live = await fetchLiveJiraIssue(issueId);
    const template = getTemplateForCategory(live?.fields?.issuetype?.name || contextIssue?.type);
    state = ChecklistEngine.initializeState(String(issueId), String(issueKey || issueId), template, userDisplayName);
  }

  const request: ChecklistToggleRequest = {
    issueId: String(issueId),
    issueKey: String(issueKey || state.issueKey),
    itemId: String(itemId),
    isCompleted: Boolean(isCompleted),
    userId: userDisplayName,
    userAccountId: context?.accountId || (payload?.userId !== 'anonymous' ? payload?.userId : undefined),
    notes
  };

  const updatedState = ChecklistEngine.toggleItem(state, request);
  await repository.saveIssueChecklist(updatedState);

  // Publish DoD status to Jira issue entity property for cross-reality audits
  try {
    await api.asApp().requestJira(route`/rest/api/3/issue/${issueId}/properties/definitionguard-dod`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        isFullySatisfied: updatedState.isFullySatisfied,
        completedCount: updatedState.items.filter(i => i.isCompleted).length,
        totalCount: updatedState.items.length,
        checklistHash: updatedState.checklistHash
      })
    });
  } catch {}

  return updatedState;
}

/**
 * Resets an issue's checklist while monotonically preserving audit history (Fixes D-13).
 */
export async function resetChecklist(payload: any, context?: any, storageProvider?: StorageProvider): Promise<IssueChecklistState> {
  const contextIssue = context?.extension?.issue;
  const issueId = String(contextIssue?.id || payload?.issueId || payload?.issue?.id || '');
  const issueKey = String(contextIssue?.key || payload?.issueKey || payload?.issue?.key || issueId);
  const userAccountId = String(context?.accountId || payload?.userAccountId || 'anonymous');
  let actorName = String(payload?.userName || payload?.userId || userAccountId);

  if (!issueId) {
    throw new Error('DefinitionGuard: Missing issueId.');
  }

  if (context?.accountId) {
    try {
      const liveUser = await fetchJiraUser(context.accountId);
      if (liveUser) actorName = liveUser;
    } catch {}
  }

  const storage = resolveStorage(storageProvider);
  const repository = new ChecklistRepository(storage);

  let state = await repository.getIssueChecklist(issueId);
  if (!state && issueKey && issueKey !== issueId) {
    state = await repository.getIssueChecklist(issueKey);
  }

  if (!state) {
    const live = await fetchLiveJiraIssue(issueId);
    let template = payload?.templateId ? getTemplateById(payload.templateId) : null;
    if (!template) {
      template = getTemplateForCategory(live?.fields?.issuetype?.name || contextIssue?.type);
    }
    state = ChecklistEngine.initializeState(issueId, issueKey, template, actorName);
  } else {
    state = ChecklistEngine.resetChecklist(state, actorName, userAccountId);
  }

  await repository.saveIssueChecklist(state);

  // Publish fresh DoD status to Jira issue entity property
  try {
    await api.asApp().requestJira(route`/rest/api/3/issue/${issueId}/properties/definitionguard-dod`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        isFullySatisfied: state.isFullySatisfied,
        completedCount: state.items.filter(i => i.isCompleted).length,
        totalCount: state.items.length,
        checklistHash: state.checklistHash,
        lastModifiedAt: state.lastModifiedAt
      })
    });
  } catch {}

  return state;
}

/**
 * Retrieves custom configured templates for a project (Fixes D-04).
 */
export async function getProjectTemplates(payload: any, context?: any, storageProvider?: StorageProvider) {
  const projectKey = String(context?.extension?.project?.key || payload?.projectKey || 'DEMO');
  const storage = resolveStorage(storageProvider);
  const config = await storage.get<ProjectDoDConfig>(`dod-templates:${projectKey}`);
  return {
    projectKey,
    templates: config?.templatesByIssueType || {},
    availableDefaults: ALL_TEMPLATES
  };
}

/**
 * Saves a custom configured template for a project and issue type (Fixes D-04).
 */
export async function saveProjectTemplate(payload: any, context?: any, storageProvider?: StorageProvider) {
  const projectKey = String(context?.extension?.project?.key || payload?.projectKey || 'DEMO');
  const issueType = String(payload?.issueType || 'Task');
  const template = payload?.template as ChecklistTemplate;
  const storage = resolveStorage(storageProvider);

  let config = await storage.get<ProjectDoDConfig>(`dod-templates:${projectKey}`);
  if (!config) {
    config = {
      projectKey,
      templatesByIssueType: {},
      updatedAt: new Date().toISOString(),
      updatedBy: String(context?.accountId || 'anonymous')
    };
  }
  config.templatesByIssueType[issueType] = template;
  config.updatedAt = new Date().toISOString();
  await storage.set(`dod-templates:${projectKey}`, config);
  return { success: true, config };
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

resolver.define('getAvailableTemplates', async () => {
  return getAvailableTemplates();
});

resolver.define('getProjectTemplates', async (req) => {
  return await getProjectTemplates(req.payload, req.context);
});

resolver.define('saveProjectTemplate', async (req) => {
  return await saveProjectTemplate(req.payload, req.context);
});

export const handler = resolver.getDefinitions();

