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
import { checkAnyProjectPermission, ADMIN_KEYS } from '../security/permissions';
import { assertLicensed, isLicenceInactive, LICENCE_GATE_OFF } from '../security/licence';
import { TemplateStore, validateTemplate } from './template-store';
import { toTemplateView } from '../domain/dod-template';
import { ChecklistTemplate } from '../domain/models';
import { ChecklistStore } from '../storage/checklist-store';
import { resyncEntry } from '../domain/event-log';
import { publishAttestation } from '../integrity/attestation';
import { ProjectConfigStore } from './project-config';
import { withRetry } from '../jira/jira-client';
import { PartyStore } from '../storage/party-store';
import { cursorOf } from '../domain/input-rules';

export const TEMPLATE_DENIED = 'Only a project admin or a Jira admin can change DefinitionGuard templates.';

export function settingsContext(context: any) {
  const project = context?.extension?.project;
  if (!project?.id || !project?.key) {
    throw new Error('DefinitionGuard: Missing project context. Open this page from the project settings.');
  }
  return { projectId: String(project.id), projectKey: String(project.key), actorAccountId: String(context?.accountId || 'unknown') };
}

export async function requireProjectAdmin(context: any) {
  const c = settingsContext(context);
  await checkAnyProjectPermission(c.projectKey, ADMIN_KEYS, TEMPLATE_DENIED);
  return c;
}

/** The project's issue types, read as the user. */
export async function projectIssueTypes(projectId: string): Promise<Array<{ id: string; name: string }>> {
  const res = await withRetry(() => api.asUser().requestJira(route`/rest/api/3/project/${projectId}`));
  if (res.status !== 200) {
    throw new Error('DefinitionGuard could not read the project issue types. Refresh the page.');
  }
  const body = await res.json();
  return (body.issueTypes || []).map((t: any) => ({ id: String(t.id), name: String(t.name) }));
}

/** The project's Done-category statuses, read as the user, without duplicates. */
export async function projectDoneStatuses(projectId: string): Promise<Array<{ id: string; name: string }>> {
  const res = await withRetry(() => api.asUser().requestJira(route`/rest/api/3/project/${projectId}/statuses`));
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
  return {
    projectId: c.projectId, projectKey: c.projectKey, issueTypes, templates, doneStatuses, exemptStatusIds: config?.exemptStatusIds || [],
    ...(isLicenceInactive(context) ? { licenceNotice: LICENCE_GATE_OFF } : {})
  };
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
  const storage = resolveStorage(storageProvider);
  const actor = await new PartyStore(storage).pseudonymFor(c.actorAccountId);
  return await new ProjectConfigStore(storage).saveExemptions(c.projectId, ids, actor);
}

export async function saveTemplate(payload: any, context?: any, storageProvider?: StorageProvider) {
  assertLicensed(context);
  const c = await requireProjectAdmin(context);
  const issueTypeId = String(payload?.issueTypeId || '');
  const issueTypes = await projectIssueTypes(c.projectId);
  if (!issueTypes.some(t => t.id === issueTypeId)) {
    throw new Error('This issue type is not in the project.');
  }
  const storage = resolveStorage(storageProvider);
  const store = new TemplateStore(storage);
  const errors = validateTemplate(payload?.template);
  if (errors.length > 0) throw new Error(errors.join(' '));
  const actor = await new PartyStore(storage).pseudonymFor(c.actorAccountId);
  const template = await store.save(c.projectId, issueTypeId, payload?.template, actor);
  return { template: toTemplateView(template) };
}

// M-8: each issue costs several KVS reads, two writes and a property PUT with up to 3 tries, so a
// page of 10 stays well inside the 25 s invocation limit even under Jira rate limiting.
export const RESYNC_PAGE = 10;
export const RESYNC_CURSOR_INVALID = 'DefinitionGuard could not continue the re-sync. Start it again.';
export const NO_TEMPLATE_TO_RESYNC = 'This issue type has no project template to re-sync to.';

/**
 * Re-syncs open issues of one issue type to the current project template revision (B-16),
 * one page of at most RESYNC_PAGE (10) issues per call. Issues on another template or already current are
 * skipped. Each update is one Resync entry; ticks on unchanged ids are kept.
 */
export async function resyncIssues(payload: any, context?: any, storageProvider?: StorageProvider) {
  assertLicensed(context);
  const c = await requireProjectAdmin(context);
  const issueTypeId = String(payload?.issueTypeId || '');
  const storage = resolveStorage(storageProvider);
  const template = await new TemplateStore(storage).get(c.projectId, issueTypeId);
  if (!template) {
    throw new Error(NO_TEMPLATE_TO_RESYNC);
  }
  const jql = `project = ${c.projectId} AND issuetype = ${issueTypeId} AND statusCategory != Done`;
  const cursor = cursorOf(payload?.cursor, RESYNC_CURSOR_INVALID) || '';
  const res = cursor
    ? await withRetry(() => api.asApp().requestJira(route`/rest/api/3/search/jql?jql=${jql}&maxResults=${RESYNC_PAGE}&fields=id,key&nextPageToken=${cursor}`))
    : await withRetry(() => api.asApp().requestJira(route`/rest/api/3/search/jql?jql=${jql}&maxResults=${RESYNC_PAGE}&fields=id,key`));
  if (res.status !== 200) {
    throw new Error('DefinitionGuard could not search the open issues. Try again.');
  }
  const body = await res.json();
  const store = new ChecklistStore(storage);
  const at = new Date().toISOString();
  const outdated = (st: { template: { workEffortId: string; revisionNumber: number } }) =>
    st.template.workEffortId === template.workEffortId && st.template.revisionNumber < template.revisionNumber;
  let updated = 0;
  let skipped = 0;
  let actor: string | undefined;
  for (const issue of body.issues || []) {
    const issueId = String(issue.id);
    const current = await store.load(issueId);
    if (!current || !outdated(current)) {
      skipped++;
      continue;
    }
    actor = actor || await new PartyStore(storage).pseudonymFor(c.actorAccountId);
    const state = await store.mutate(
      issueId,
      async () => { throw new Error('DefinitionGuard: the record disappeared during re-sync'); },
      st => (outdated(st) ? [resyncEntry(st, template, actor!, at)] : [])
    );
    await publishAttestation(state, at);
    updated++;
  }
  return { updated, skipped, nextCursor: body.nextPageToken || undefined, templateVersion: template.revisionNumber };
}

const resolver = new Resolver();

resolver.define('getSettings', async (req) => getSettings(req.payload, req.context));
resolver.define('saveTemplate', async (req) => saveTemplate(req.payload, req.context));
resolver.define('saveExemptions', async (req) => saveExemptions(req.payload, req.context));
resolver.define('resyncIssues', async (req) => resyncIssues(req.payload, req.context));
resolver.define('gateCoverage', async (req) => {
  // Loaded lazily: coverage.ts imports requireProjectAdmin from this module.
  const { gateCoverage } = await import('./coverage');
  return gateCoverage(req.payload, req.context);
});

export const settingsHandler = resolver.getDefinitions();
