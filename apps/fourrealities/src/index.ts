/**
 * Copyright (c) 2026 Asymm Systems. All rights reserved.
 * @author Fahim Farook
 * FourRealities: Main Atlassian Forge Entry Point & Resolvers
 */

import Resolver from '@forge/resolver';
import { kvs } from '@forge/kvs';
import api, { route } from '@forge/api';
import { MetricsEngine } from './domain/metrics-engine';
import { MetricsRepository, StorageProvider } from './storage/metrics-repository';
import { factsFromIssue, normalizeException, PROPERTY_KEYS } from './jira/issue-facts';
import {
  IssueExceptionRecord,
  IssueRow,
  ProjectDashboardView,
  ResolverError,
  ResolverResult
} from './domain/models';

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
    throw new Error('FourRealities: StorageProvider must be initialized.');
  }
  return new ForgeKvsProvider();
}

/** Fields every issue read requests. */
const ISSUE_FIELDS = 'summary,status,issuetype,issuelinks,assignee,updated,customfield_10000,customfield_10020,sprint';

function jiraError(status: number | undefined, message: string): { ok: false; error: ResolverError } {
  if (status === 403) return { ok: false, error: { code: 'FORBIDDEN', message, status } };
  if (status === 404) return { ok: false, error: { code: 'NOT_FOUND', message, status } };
  if (status === 429) return { ok: false, error: { code: 'RATE_LIMITED', message, status } };
  return { ok: false, error: { code: 'JIRA_ERROR', message, status } };
}

/**
 * Queries live Jira issues using search/jql. Returns raw issues with the producers' properties.
 */
export async function fetchProjectIssues(projectKey: string): Promise<{ issues: any[]; status?: number; error?: string }> {
  try {
    const allIssues: any[] = [];
    let startAt = 0;
    const maxResults = 100;
    let isLast = false;

    // Paginate Jira search up to 2 pages (200 issues) for comprehensive audit
    while (!isLast && allIssues.length < 200) {
      const res = await api.asApp().requestJira(
        route`/rest/api/3/search/jql?jql=project = "${projectKey}" order by created desc&startAt=${startAt}&maxResults=${maxResults}&fields=${ISSUE_FIELDS}&properties=${PROPERTY_KEYS.join(',')}&expand=changelog`
      );

      if (res.status !== 200) {
        return { issues: [], status: res.status, error: `Jira search/jql failed with HTTP ${res.status}` };
      }

      const data = await res.json();
      const batch: any[] = data.issues || [];
      allIssues.push(...batch);

      if (batch.length < maxResults || (data.total && allIssues.length >= data.total)) {
        isLast = true;
      } else {
        startAt += maxResults;
      }
    }
    return { issues: allIssues };
  } catch (err: any) {
    return { issues: [], error: err?.message || 'Network error querying Jira search/jql' };
  }
}

/**
 * Builds the project dashboard view from live Jira issues. The project comes from the Forge
 * context only. A page view stores nothing.
 */
export async function getProjectDashboard(
  payload: any,
  context?: any,
  storageProvider?: StorageProvider
): Promise<ResolverResult<ProjectDashboardView>> {
  const projectKey = context?.extension?.project?.key;
  if (!projectKey) {
    return { ok: false, error: { code: 'INVALID_INPUT', message: 'FourRealities: open this page from a Jira project.' } };
  }

  const storage = resolveStorage(storageProvider);
  const repository = new MetricsRepository(storage);
  const { issues, status, error } = await fetchProjectIssues(String(projectKey));
  if (error) {
    return jiraError(status, `Live Jira sync failed (${error}).`);
  }

  const rows: IssueRow[] = [];
  for (const iss of issues) {
    const exception = normalizeException(await repository.getIssueException(String(iss.id)));
    rows.push(MetricsEngine.buildRow(factsFromIssue(iss, { exception })));
  }

  return {
    ok: true,
    projectKey: String(projectKey),
    generatedAt: new Date().toISOString(),
    summary: MetricsEngine.summarize(rows),
    rows,
    trend: []
  };
}

/**
 * Evaluates one Jira issue. The issue comes from the Forge context only.
 */
export async function getIssueAlignment(
  payload: any,
  context?: any,
  storageProvider?: StorageProvider
): Promise<ResolverResult<{ row: IssueRow }>> {
  const contextIssue = context?.extension?.issue;
  const issueId = contextIssue?.id ? String(contextIssue.id) : '';
  const issueKey = String(contextIssue?.key || issueId);

  if (!issueId) {
    return { ok: false, error: { code: 'INVALID_INPUT', message: 'FourRealities: open this panel from a Jira issue.' } };
  }

  const storage = resolveStorage(storageProvider);
  const repository = new MetricsRepository(storage);
  const exception = normalizeException(await repository.getIssueException(issueId));

  // Signals come from Jira only. There is no cached fallback: a failed read is reported.
  try {
    const [issueRes, remoteLinksRes, stashDevRes, githubDevRes, bitbucketDevRes] = await Promise.all([
      api.asApp().requestJira(
        route`/rest/api/3/issue/${issueId}?fields=${ISSUE_FIELDS}&properties=${PROPERTY_KEYS.join(',')}&expand=changelog`
      ),
      api.asApp().requestJira(route`/rest/api/3/issue/${issueId}/remotelink`).catch(() => null),
      api.asApp().requestJira(route`/rest/dev-status/latest/issue/detail?issueId=${issueId}&applicationType=stash&dataType=pullrequest`).catch(() => null),
      api.asApp().requestJira(route`/rest/dev-status/latest/issue/detail?issueId=${issueId}&applicationType=github&dataType=pullrequest`).catch(() => null),
      api.asApp().requestJira(route`/rest/dev-status/latest/issue/detail?issueId=${issueId}&applicationType=bitbucket&dataType=pullrequest`).catch(() => null)
    ]);

    if (issueRes.status !== 200) {
      return jiraError(issueRes.status, `FourRealities: Jira returned HTTP ${issueRes.status} for issue '${issueKey}'.`);
    }
    const iss = await issueRes.json();

    let remoteLinks: any[] = [];
    if (remoteLinksRes && remoteLinksRes.status === 200) {
      try {
        const body = await remoteLinksRes.json();
        remoteLinks = Array.isArray(body) ? body : [];
      } catch {}
    }

    const pullRequests: any[] = [];
    for (const devRes of [stashDevRes, githubDevRes, bitbucketDevRes]) {
      if (devRes && devRes.status === 200) {
        try {
          const devData = await devRes.json();
          if (Array.isArray(devData.detail)) {
            for (const item of devData.detail) {
              if (Array.isArray(item.pullRequests)) {
                pullRequests.push(...item.pullRequests);
              }
            }
          }
        } catch {}
      }
    }

    return { ok: true, row: MetricsEngine.buildRow(factsFromIssue(iss, { remoteLinks, pullRequests, exception })) };
  } catch (err: any) {
    return jiraError(undefined, `FourRealities: Failed to query Jira for issue '${issueKey}': ${err?.message || 'network error'}`);
  }
}

/**
 * Remediation Resolvers. FourRealities never writes the LedgerSeal or DefinitionGuard
 * properties: that evidence belongs to the producer apps (one writer per fact).
 */

/**
 * Checks that a payload issue id belongs to the caller's Forge context (FR-06).
 * Issue context: the id must equal the context issue. Project context: the issue is read
 * as the user and its project key must equal the context project key.
 */
export async function checkIssueScope(issueId: string, context?: any): Promise<string | undefined> {
  const contextIssueId = context?.extension?.issue?.id;
  if (contextIssueId) {
    return String(contextIssueId) === String(issueId) ? undefined : 'Unauthorized: issue is outside this issue view.';
  }
  const contextProject = context?.extension?.project?.key;
  if (!contextProject) {
    return 'Forbidden: no Jira project or issue context.';
  }
  const res = await api.asUser().requestJira(route`/rest/api/3/issue/${issueId}?fields=project`);
  if (res.status !== 200) {
    return `Jira returned HTTP ${res.status} reading issue ${issueId}.`;
  }
  const iss = await res.json();
  const projectKey = iss?.fields?.project?.key;
  if (projectKey !== contextProject) {
    return `Forbidden: issue ${iss?.key || issueId} is not in project ${contextProject}.`;
  }
  return undefined;
}

/**
 * Links an authentic architecture decision or specification document as a remote link.
 * Runs as calling user with explicit validation (rejects hardcoded fake links).
 */
export async function linkDecision(payload: any, context?: any): Promise<{ success: boolean; remoteLink?: any; error?: string }> {
  const contextIssueId = context?.extension?.issue?.id;
  const issueId = payload?.issueId || contextIssueId;

  // Authorization check: if in issue context, target issue must match context
  if (contextIssueId && payload?.issueId && contextIssueId !== payload.issueId) {
    return { success: false, error: 'Unauthorized: Cannot link decision to external issue.' };
  }

  if (!issueId) {
    return { success: false, error: 'Missing issueId.' };
  }

  const url = String(payload?.url || '').trim();
  const title = String(payload?.title || '').trim();
  const summary = String(payload?.summary || 'Architecture decision record verifying Intent gate.').trim();

  // Validate URL format
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      return { success: false, error: 'Invalid URL protocol. HTTP or HTTPS required.' };
    }
  } catch {
    return { success: false, error: 'Invalid specification URL provided.' };
  }

  if (!title) {
    return { success: false, error: 'Document title or ADR identifier required.' };
  }

  try {
    const scopeError = await checkIssueScope(issueId, context);
    if (scopeError) {
      return { success: false, error: scopeError };
    }

    const res = await api.asUser().requestJira(route`/rest/api/3/issue/${issueId}/remotelink`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        object: {
          url,
          title,
          summary
        }
      })
    });

    if (res.status >= 200 && res.status < 300) {
      return { success: true, remoteLink: { url, title } };
    }
    if (res.status === 403) {
      // A user action stays a user action: no retry as the app (FR-05).
      return { success: false, error: `You need the Edit issues permission on ${payload?.issueKey || issueId} to add a link.` };
    }
    return { success: false, error: `Jira returned status ${res.status} linking decision.` };
  } catch (err: any) {
    return { success: false, error: err?.message || 'Failed to link architecture decision.' };
  }
}

/**
 * Records a justified exception (e.g., "Explain: No code change" or "Rework Reason").
 */
export async function recordException(
  payload: any,
  context?: any,
  storageProvider?: StorageProvider
): Promise<{ success: boolean; record?: IssueExceptionRecord; error?: string }> {
  const contextIssueId = context?.extension?.issue?.id;
  const issueId = payload?.issueId || contextIssueId;

  if (contextIssueId && payload?.issueId && contextIssueId !== payload.issueId) {
    return { success: false, error: 'Unauthorized: Cannot record exception on external issue.' };
  }

  if (!issueId) {
    return { success: false, error: 'Missing issueId.' };
  }

  const type = payload?.type === 'REWORK' ? 'REWORK' : 'CODE';
  const reason = String(payload?.reason || '').trim();
  const notes = payload?.notes ? String(payload.notes).trim() : undefined;

  if (!reason) {
    return { success: false, error: 'Exception reason required.' };
  }

  try {
    const scopeError = await checkIssueScope(issueId, context);
    if (scopeError) {
      return { success: false, error: scopeError };
    }
  } catch (err: any) {
    return { success: false, error: err?.message || 'Failed to check the issue.' };
  }

  const record: IssueExceptionRecord = {
    issueId,
    issueKey: String(payload?.issueKey || issueId),
    type,
    reason,
    notes,
    recordedBy: String(context?.accountId || 'system-user'),
    recordedAt: new Date().toISOString()
  };

  // Write the issue property as the user first. The KVS record follows only after Jira accepts
  // the write, so a user without edit rights cannot change the gate (FR-05, FR-24).
  try {
    const res = await api.asUser().requestJira(route`/rest/api/3/issue/${issueId}/properties/fourrealities-exception`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(record)
    });
    if (res.status === 403) {
      return { success: false, error: `You need the Edit issues permission on ${record.issueKey} to record an exception.` };
    }
    if (res.status < 200 || res.status >= 300) {
      return { success: false, error: `Jira returned status ${res.status} recording the exception.` };
    }
  } catch (err: any) {
    return { success: false, error: err?.message || 'Failed to record exception.' };
  }

  const storage = resolveStorage(storageProvider);
  const repository = new MetricsRepository(storage);
  await repository.saveIssueException(record);

  return { success: true, record };
}

/**
 * Rendering hooks for Forge modules.
 */
export async function renderProjectPage(context: any) {
  return { moduleKey: 'fourrealities-project-dashboard', context };
}

export async function renderIssuePanel(context: any) {
  return { moduleKey: 'fourrealities-issue-panel', context };
}

export async function renderIssueContext(context: any) {
  return { moduleKey: 'fourrealities-issue-context', context };
}

// Register Forge Resolver for UI Kit invocations
const resolver = new Resolver();

resolver.define('getProjectDashboard', async (req) => {
  return await getProjectDashboard(req.payload, req.context);
});

resolver.define('getIssueAlignment', async (req) => {
  return await getIssueAlignment(req.payload, req.context);
});

resolver.define('linkDecision', async (req) => {
  return await linkDecision(req.payload, req.context);
});

resolver.define('recordException', async (req) => {
  return await recordException(req.payload, req.context);
});

export const handler = resolver.getDefinitions();
