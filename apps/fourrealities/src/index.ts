/**
 * FourRealities: Main Atlassian Forge Entry Point
 * Cross-Reality Architecture & Delivery Integrity Dashboard
 */

import Resolver from '@forge/resolver';
import { kvs } from '@forge/kvs';
import { MetricsEngine } from './domain/metrics-engine';
import { MetricsRepository, StorageProvider } from './storage/metrics-repository';
import { RealitySignals, ProjectAuditSnapshot, IssueIntegrityScore } from './domain/models';

import api, { route } from '@forge/api';

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

/**
 * Analyzes issue changelog histories for status transitions and rework bounces.
 */
export function analyzeIssueChangelog(changelog: any): { transitionCount: number; regressionCount: number } {
  if (!changelog || !Array.isArray(changelog.histories)) {
    return { transitionCount: 1, regressionCount: 0 };
  }

  let transitionCount = 0;
  let regressionCount = 0;

  const doneCategoryWords = ['done', 'resolved', 'closed', 'complete', 'completed', 'shipped'];
  const reopenCategoryWords = ['open', 'reopened', 'in progress', 'to do', 'backlog', 'in review'];

  for (const history of changelog.histories) {
    if (!Array.isArray(history.items)) continue;
    for (const item of history.items) {
      if (item.field === 'status') {
        transitionCount++;
        const fromStatus = String(item.fromString || '').toLowerCase();
        const toStatus = String(item.toString || '').toLowerCase();

        const wasDone = doneCategoryWords.some(w => fromStatus.includes(w));
        const becameOpen = reopenCategoryWords.some(w => toStatus.includes(w));

        if (wasDone && becameOpen) {
          regressionCount++;
        }
      }
    }
  }

  return {
    transitionCount: Math.max(1, transitionCount),
    regressionCount
  };
}

/**
 * Validates authentic architectural documentation/intent traceability.
 * Only credits explicit ADR links, specs, architecture documents, or Confluence remote links.
 */
export function evaluateDocumentedIntent(issuelinks: any[], remotelinks?: any[]): boolean {
  if (Array.isArray(remotelinks) && remotelinks.length > 0) {
    for (const rl of remotelinks) {
      const url = String(rl.object?.url || rl.url || '').toLowerCase();
      const title = String(rl.object?.title || rl.title || '').toLowerCase();
      if (
        url.includes('wiki') ||
        url.includes('confluence') ||
        url.includes('notion') ||
        url.includes('rfc') ||
        url.includes('adr') ||
        url.includes('spec') ||
        title.includes('adr') ||
        title.includes('spec') ||
        title.includes('decision') ||
        title.includes('architecture') ||
        title.includes('requirement')
      ) {
        return true;
      }
    }
  }

  if (!Array.isArray(issuelinks) || issuelinks.length === 0) {
    return false;
  }

  const docLinkKeywords = ['document', 'specif', 'implement', 'verif', 'satisf', 'decision', 'design'];
  const docTypeKeywords = ['architecture', 'adr', 'spec', 'rfc', 'requirement', 'documentation', 'decision'];

  for (const link of issuelinks) {
    const linkTypeInward = String(link.type?.inward || '').toLowerCase();
    const linkTypeOutward = String(link.type?.outward || '').toLowerCase();
    const isDocLinkType = docLinkKeywords.some(kw => linkTypeInward.includes(kw) || linkTypeOutward.includes(kw));
    if (isDocLinkType) {
      return true;
    }

    const linkedIssue = link.inwardIssue || link.outwardIssue;
    if (linkedIssue) {
      const summary = String(linkedIssue.fields?.summary || '').toLowerCase();
      const typeName = String(linkedIssue.fields?.issuetype?.name || '').toLowerCase();

      if (
        summary.startsWith('[adr]') ||
        summary.startsWith('[spec]') ||
        summary.startsWith('[arch]') ||
        summary.startsWith('[rfc]') ||
        summary.includes('architecture decision') ||
        summary.includes('software design') ||
        summary.includes('design document')
      ) {
        return true;
      }

      if (docTypeKeywords.some(kw => typeName.includes(kw))) {
        return true;
      }
    }
  }

  return false;
}

/**
 * Queries live Jira issues using search/jql and extracts authentic cross-reality signals.
 */
export async function fetchLiveProjectAudit(projectKey: string): Promise<{ signals: RealitySignals[]; error?: string }> {
  try {
    const res = await api.asApp().requestJira(
      route`/rest/api/3/search/jql?jql=project = "${projectKey}" order by created desc&fields=summary,status,issuetype,issuelinks,assignee,customfield_10000&properties=ledgerseal-cert,ledgersealCert,definitionguard-dod,definitionguardDod&expand=changelog&maxResults=50`
    );
    if (res.status === 200) {
      const data = await res.json();
      const issues: any[] = data.issues || [];
      const signals: RealitySignals[] = issues.map(iss => {
        const certProp = iss.properties?.['ledgerseal-cert'] || iss.properties?.['ledgersealCert'];
        const dodProp = iss.properties?.['definitionguard-dod'] || iss.properties?.['definitionguardDod'];
        const links = iss.fields?.issuelinks;
        const hasDocumentedIntent = evaluateDocumentedIntent(links);

        const { transitionCount, regressionCount } = analyzeIssueChangelog(iss.changelog);

        let prCount = 0;
        let hasApprovedReview = false;
        const devField = iss.fields?.customfield_10000;
        if (typeof devField === 'string' && devField.includes('pullrequest')) {
          prCount = 1;
          if (devField.includes('MERGED') || devField.includes('APPROVED')) {
            hasApprovedReview = true;
          }
        }

        const isSealed = Boolean(
          certProp &&
          (certProp.status === 'SEAL_VALID' || certProp.valid === true) &&
          !certProp.isCompromised
        );
        const isDoDSatisfied = Boolean(
          dodProp &&
          (dodProp.isFullySatisfied === true || dodProp.satisfied === true)
        );

        return {
          issueId: String(iss.id),
          issueKey: String(iss.key),
          summary: iss.fields?.summary || '',
          status: iss.fields?.status?.name || 'In Progress',
          statusCategory: iss.fields?.status?.statusCategory?.name || 'In Progress',
          assigneeName: iss.fields?.assignee?.displayName,
          hasDocumentedIntent,
          transitionCount,
          regressionCount,
          prCount,
          hasApprovedReview,
          hasCryptographicSeal: isSealed,
          isDoDSatisfied
        };
      });
      return { signals };
    }
    return { signals: [], error: `Jira search/jql failed with HTTP ${res.status}` };
  } catch (err: any) {
    return { signals: [], error: err?.message || 'Network error querying Jira search/jql' };
  }
}

/**
 * Retrieves the project-level audit dashboard and reality alignment summary.
 */
export async function getProjectDashboard(
  payload: any,
  context?: any,
  storageProvider?: StorageProvider
): Promise<ProjectAuditSnapshot> {
  const contextProject = context?.extension?.project?.key;
  const projectKey = String(contextProject || payload?.projectKey || 'DEFAULT');
  const userId = String(context?.accountId || payload?.userId || 'anonymous');

  const storage = resolveStorage(storageProvider);
  const repository = new MetricsRepository(storage);

  // Attempt live Jira query for authentic project issues
  const { signals: liveSignals, error: syncError } = await fetchLiveProjectAudit(projectKey);

  // If live Jira returned authentic signals without error
  if (!syncError) {
    const issueScores = liveSignals.map(s => MetricsEngine.evaluateIssue(s));
    const summary = MetricsEngine.summarizeProject(liveSignals);
    const snapshot: ProjectAuditSnapshot = {
      snapshotId: `snap-${Date.now()}`,
      projectKey,
      generatedAt: new Date().toISOString(),
      generatedBy: userId,
      summary,
      issueScores
    };
    await repository.saveProjectSnapshot(snapshot);
    return snapshot;
  }

  // If sync error occurred, check if cached snapshot exists and flag warning
  const existing = await repository.getLatestProjectSnapshot(projectKey);
  if (existing) {
    return {
      ...existing,
      warning: `Live Jira sync failed (${syncError}). Displaying cached snapshot.`
    };
  }

  // If no cached snapshot exists, return initial baseline with error warning
  const now = new Date().toISOString();
  const emptySummary = MetricsEngine.summarizeProject([]);
  const initialSnapshot: ProjectAuditSnapshot = {
    snapshotId: `snap-${Date.now()}`,
    projectKey,
    generatedAt: now,
    generatedBy: userId,
    summary: emptySummary,
    issueScores: [],
    warning: `Live Jira sync failed (${syncError}). No cached snapshot available.`
  };

  await repository.saveProjectSnapshot(initialSnapshot);
  return initialSnapshot;
}

/**
 * Retrieves reality alignment metrics for a single Jira issue.
 */
export async function getIssueAlignment(
  payload: any,
  context?: any,
  storageProvider?: StorageProvider
): Promise<IssueIntegrityScore> {
  const contextIssue = context?.extension?.issue;
  const issueId = String(contextIssue?.id || payload?.issueId || payload?.issue?.id || '');
  const issueKey = String(contextIssue?.key || payload?.issueKey || payload?.issue?.key || issueId);

  if (!issueId || issueId === 'default-issue') {
    throw new Error('FourRealities: Missing issueId.');
  }

  // Attempt to fetch authentic live Jira issue state and entity properties
  try {
    const [issueRes, remoteLinksRes, devStatusRes] = await Promise.all([
      api.asApp().requestJira(
        route`/rest/api/3/issue/${issueId}?fields=summary,status,issuetype,issuelinks,assignee,customfield_10000&properties=ledgerseal-cert,ledgersealCert,definitionguard-dod,definitionguardDod&expand=changelog`
      ),
      api.asApp().requestJira(route`/rest/api/3/issue/${issueId}/remotelink`).catch(() => null),
      api.asApp().requestJira(route`/rest/dev-status/latest/issue/detail?issueId=${issueId}&applicationType=stash&dataType=pullrequest`).catch(() => null)
    ]);

    if (issueRes.status === 200) {
      const iss = await issueRes.json();
      if (iss?.id || iss?.key) {
        const certProp = iss.properties?.['ledgerseal-cert'] || iss.properties?.['ledgersealCert'];
        const dodProp = iss.properties?.['definitionguard-dod'] || iss.properties?.['definitionguardDod'];
        const links = iss.fields?.issuelinks;
        let remoteLinks: any[] = [];
        if (remoteLinksRes && remoteLinksRes.status === 200) {
          try {
            remoteLinks = await remoteLinksRes.json();
          } catch {}
        }
        const hasDocumentedIntent = evaluateDocumentedIntent(links, remoteLinks);
        const { transitionCount, regressionCount } = analyzeIssueChangelog(iss.changelog);

        let prCount = 0;
        let hasApprovedReview = false;

        // Dev Status check for authentic review approvals
        if (devStatusRes && devStatusRes.status === 200) {
          try {
            const devData = await devStatusRes.json();
            const pullRequests: any[] = [];
            if (Array.isArray(devData.detail)) {
              for (const item of devData.detail) {
                if (Array.isArray(item.pullRequests)) {
                  pullRequests.push(...item.pullRequests);
                }
              }
            }
            if (pullRequests.length > 0) {
              prCount = pullRequests.length;
              hasApprovedReview = pullRequests.some(pr =>
                Array.isArray(pr.reviewers) && pr.reviewers.some((r: any) => r.approvalStatus === 'APPROVED')
              );
            }
          } catch {}
        }

        // Fallback to customfield_10000 heuristic if dev-status returned no PRs
        if (prCount === 0) {
          const devField = iss.fields?.customfield_10000;
          if (typeof devField === 'string' && devField.includes('pullrequest')) {
            prCount = 1;
            if (devField.includes('MERGED') || devField.includes('APPROVED')) {
              hasApprovedReview = true;
            }
          }
        }

        const isSealed = Boolean(
          certProp &&
          (certProp.status === 'SEAL_VALID' || certProp.valid === true) &&
          !certProp.isCompromised
        );
        const isDoDSatisfied = Boolean(
          dodProp &&
          (dodProp.isFullySatisfied === true || dodProp.satisfied === true)
        );

        const signals: RealitySignals = {
          issueId: String(iss.id || issueId),
          issueKey: String(iss.key || issueKey),
          summary: iss.fields?.summary || '',
          status: iss.fields?.status?.name || 'In Progress',
          statusCategory: iss.fields?.status?.statusCategory?.name || 'In Progress',
          assigneeName: iss.fields?.assignee?.displayName,
          hasDocumentedIntent,
          transitionCount,
          regressionCount,
          prCount,
          hasApprovedReview,
          hasCryptographicSeal: isSealed,
          isDoDSatisfied
        };

        return MetricsEngine.evaluateIssue(signals);
      }
    }
  } catch {}

  const storage = resolveStorage(storageProvider);
  const repository = new MetricsRepository(storage);

  const stored = await repository.getIssueSignals(issueId);
  const activeSignals: RealitySignals = stored || {
    issueId,
    issueKey,
    hasDocumentedIntent: false,
    transitionCount: 1,
    regressionCount: 0,
    prCount: 0,
    hasApprovedReview: false,
    hasCryptographicSeal: false,
    isDoDSatisfied: false
  };

  return MetricsEngine.evaluateIssue(activeSignals);
}

/**
 * Records reality signals for an issue and updates project snapshot.
 * Enforces cross-project isolation to prevent unauthorized poisoning.
 */
export async function recordIssueSignals(
  payload: any,
  context?: any,
  storageProvider?: StorageProvider
): Promise<IssueIntegrityScore> {
  const contextProject = context?.extension?.project?.key;
  const targetProject = payload?.projectKey;

  // Prevent cross-project data poisoning
  if (contextProject && targetProject && contextProject !== targetProject) {
    throw new Error(`FourRealities: Forbidden. Cannot record signals for project '${targetProject}' from context '${contextProject}'.`);
  }

  const { signals, projectKey } = payload || {};
  if (!signals?.issueId || !signals?.issueKey) {
    throw new Error('FourRealities: Valid issue signals required.');
  }

  let effectiveProject = contextProject || targetProject || projectKey;
  if (!effectiveProject && signals?.issueKey?.includes('-')) {
    effectiveProject = signals.issueKey.split('-')[0];
  }
  if (!effectiveProject) {
    throw new Error('FourRealities: Project key required.');
  }

  const storage = resolveStorage(storageProvider);
  const repository = new MetricsRepository(storage);

  await repository.saveIssueSignals(signals);
  const score = MetricsEngine.evaluateIssue(signals);

  const current = await repository.getLatestProjectSnapshot(String(effectiveProject));
  const now = new Date().toISOString();
  const updatedIssues = current?.issueScores.filter(s => s.issueId !== signals.issueId) || [];
  updatedIssues.push(score);

  const dummySignals: RealitySignals[] = updatedIssues.map(s => ({
    issueId: s.issueId,
    issueKey: s.issueKey,
    summary: s.summary,
    status: s.status,
    statusCategory: s.statusCategory,
    assigneeName: s.assigneeName,
    hasDocumentedIntent: s.intentScore === 100,
    transitionCount: 1,
    regressionCount: Math.round((100 - s.processScore) / 30),
    prCount: s.codeScore > 0 ? 1 : 0,
    hasApprovedReview: s.codeScore === 100,
    hasCryptographicSeal: s.auditScore >= 50,
    isDoDSatisfied: s.auditScore === 100 || s.auditScore === 50
  }));

  const newSummary = MetricsEngine.summarizeProject(dummySignals);
  const updatedSnapshot: ProjectAuditSnapshot = {
    snapshotId: `snap-${Date.now()}`,
    projectKey: String(effectiveProject),
    generatedAt: now,
    generatedBy: String(context?.accountId || 'system'),
    summary: newSummary,
    issueScores: updatedIssues
  };
  await repository.saveProjectSnapshot(updatedSnapshot);

  return score;
}

/**
 * Remediation Resolvers: 1-Click fixes for reality gates
 */
export async function linkDecision(payload: any, context?: any): Promise<{ success: boolean; error?: string }> {
  const issueId = payload?.issueId || context?.extension?.issue?.id;
  const url = payload?.url || 'https://confluence.atlassian.net/wiki/spaces/ARCH/pages/ADR-014';
  const title = payload?.title || 'ADR-014: Architecture Decision Record';
  if (!issueId) {
    return { success: false, error: 'Missing issueId' };
  }
  try {
    const res = await api.asUser().requestJira(route`/rest/api/3/issue/${issueId}/remotelink`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        object: {
          url,
          title,
          summary: 'Linked architecture specification for FourRealities intent verification.'
        }
      })
    });
    return { success: res.status >= 200 && res.status < 300 };
  } catch (err: any) {
    return { success: false, error: err?.message || 'Failed to link decision' };
  }
}

export async function sealIssue(payload: any, context?: any): Promise<{ success: boolean; cert?: any; error?: string }> {
  const issueId = payload?.issueId || context?.extension?.issue?.id;
  if (!issueId) {
    return { success: false, error: 'Missing issueId' };
  }
  const cert = {
    status: 'SEAL_VALID',
    valid: true,
    sealedAt: new Date().toISOString(),
    isCompromised: false
  };
  try {
    const res = await api.asApp().requestJira(route`/rest/api/3/issue/${issueId}/properties/ledgerseal-cert`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(cert)
    });
    return { success: res.status >= 200 && res.status < 300, cert };
  } catch (err: any) {
    return { success: false, error: err?.message || 'Failed to seal issue' };
  }
}

export async function completeDod(payload: any, context?: any): Promise<{ success: boolean; dod?: any; error?: string }> {
  const issueId = payload?.issueId || context?.extension?.issue?.id;
  if (!issueId) {
    return { success: false, error: 'Missing issueId' };
  }
  const dod = {
    isFullySatisfied: true,
    satisfied: true,
    completedAt: new Date().toISOString()
  };
  try {
    const res = await api.asApp().requestJira(route`/rest/api/3/issue/${issueId}/properties/definitionguard-dod`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(dod)
    });
    return { success: res.status >= 200 && res.status < 300, dod };
  } catch (err: any) {
    return { success: false, error: err?.message || 'Failed to complete DoD' };
  }
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

// Register Forge Resolver for UI Kit 2 bridge invocations
const resolver = new Resolver();

resolver.define('getProjectDashboard', async (req) => {
  const projectKey = req.payload?.projectKey || req.context?.extension?.project?.key || 'DEFAULT';
  return await getProjectDashboard({ ...req.payload, projectKey }, req.context);
});

resolver.define('getIssueAlignment', async (req) => {
  const issueId = req.payload?.issueId || req.context?.extension?.issue?.id || 'default-issue';
  const issueKey = req.payload?.issueKey || req.context?.extension?.issue?.key || issueId;
  return await getIssueAlignment({ ...req.payload, issueId, issueKey }, req.context);
});

resolver.define('recordIssueSignals', async (req) => {
  return await recordIssueSignals(req.payload, req.context);
});

resolver.define('linkDecision', async (req) => {
  return await linkDecision(req.payload, req.context);
});

resolver.define('sealIssue', async (req) => {
  return await sealIssue(req.payload, req.context);
});

resolver.define('completeDod', async (req) => {
  return await completeDod(req.payload, req.context);
});

export const handler = resolver.getDefinitions();
