/**
 * Project settings page resolvers (jira:projectSettingsPage). Project admins only.
 *
 * Copyright (c) 2026 Asymm Systems. All rights reserved.
 * @author Fahim Farook
 *
 * The project always comes from context.extension.project, never from the payload.
 * Every function first checks ADMINISTER_PROJECTS for the calling user.
 */
import api, { route } from '@forge/api';
import Resolver from '@forge/resolver';
import { StorageProvider } from '../storage/checklist-repository';
import { resolveStorage } from '../storage/forge-storage';
import { checkProjectPermissions } from '../security/permissions';
import { assertLicensed } from '../security/licence';
import { TemplateStore } from './template-store';
import { toTemplateView } from '../domain/dod-template';
import { ChecklistTemplate } from '../domain/models';
import { ProjectConfigStore } from './project-config';

export const TEMPLATE_DENIED = 'Only a project admin can change DefinitionGuard templates.';

export function settingsContext(context: any) {
  const project = context?.extension?.project;
  if (!project?.id || !project?.key) {
    throw new Error('DefinitionGuard: Missing project context. Open this page from the project settings.');
  }
  return { projectId: String(project.id), projectKey: String(project.key), actorAccountId: String(context?.accountId || 'unknown') };
}

export async function requireProjectAdmin(context: any) {
  const c = settingsContext(context);
  await checkProjectPermissions(c.projectKey, ['ADMINISTER_PROJECTS'], TEMPLATE_DENIED);
  return c;
}

/** The project's issue types, read as the user. */
export async function projectIssueTypes(projectId: string): Promise<Array<{ id: string; name: string }>> {
  const res = await api.asUser().requestJira(route`/rest/api/3/project/${projectId}`);
  if (res.status !== 200) {
    throw new Error('DefinitionGuard could not read the project issue types. Refresh the page.');
  }
  const body = await res.json();
  return (body.issueTypes || []).map((t: any) => ({ id: String(t.id), name: String(t.name) }));
}

/** The project's Done-category statuses, read as the user, without duplicates. */
export async function projectDoneStatuses(projectId: string): Promise<Array<{ id: string; name: string }>> {
  const res = await api.asUser().requestJira(route`/rest/api/3/project/${projectId}/statuses`);
  if (res.status !== 200) {
    throw new Error('DefinitionGuard could not read the project statuses. Refresh the page.');
  }
  const body = await res.json();
  const byId = new Map<string, string>();
  for (const type of Array.isArray(body) ? body : []) {
    for (const st of type.statuses || []) {
      if (st?.statusCategory?.key === 'done') byId.set(String(st.id), String(st.name));
    }
  }
  return [...byId].map(([id, name]) => ({ id, name }));
}

export async function getSettings(_payload: any, context?: any, storageProvider?: StorageProvider) {
  const c = await requireProjectAdmin(context);
  const storage = resolveStorage(storageProvider);
  const store = new TemplateStore(storage);
  const issueTypes = await projectIssueTypes(c.projectId);
  const templates: Record<string, ChecklistTemplate> = {};
  for (const t of issueTypes) {
    const saved = await store.get(c.projectId, t.id);
    if (saved) templates[t.id] = toTemplateView(saved);
  }
  const doneStatuses = await projectDoneStatuses(c.projectId);
  const config = await new ProjectConfigStore(storage).get(c.projectId);
  return { projectId: c.projectId, projectKey: c.projectKey, issueTypes, templates, doneStatuses, exemptStatusIds: config?.exemptStatusIds || [] };
}

export const EXEMPT_INVALID = 'Only Done-category statuses of this project can be exempt.';

/** Saves the Done-category statuses that the gate lets through, for example Canceled. */
export async function saveExemptions(payload: any, context?: any, storageProvider?: StorageProvider) {
  assertLicensed(context);
  const c = await requireProjectAdmin(context);
  const ids = payload?.exemptStatusIds;
  const done = new Set((await projectDoneStatuses(c.projectId)).map(s => s.id));
  if (!Array.isArray(ids) || ids.length > 50 || !ids.every((id: any) => typeof id === 'string' && done.has(id))) {
    throw new Error(EXEMPT_INVALID);
  }
  return await new ProjectConfigStore(resolveStorage(storageProvider)).saveExemptions(c.projectId, ids, c.actorAccountId);
}

export async function saveTemplate(payload: any, context?: any, storageProvider?: StorageProvider) {
  assertLicensed(context);
  const c = await requireProjectAdmin(context);
  const issueTypeId = String(payload?.issueTypeId || '');
  const issueTypes = await projectIssueTypes(c.projectId);
  if (!issueTypes.some(t => t.id === issueTypeId)) {
    throw new Error('This issue type is not in the project.');
  }
  const store = new TemplateStore(resolveStorage(storageProvider));
  const template = await store.save(c.projectId, issueTypeId, payload?.template, c.actorAccountId);
  return { template: toTemplateView(template) };
}

const resolver = new Resolver();

resolver.define('getSettings', async (req) => getSettings(req.payload, req.context));
resolver.define('saveTemplate', async (req) => saveTemplate(req.payload, req.context));
resolver.define('saveExemptions', async (req) => saveExemptions(req.payload, req.context));

export const settingsHandler = resolver.getDefinitions();
