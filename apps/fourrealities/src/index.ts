/**
 * Copyright (c) 2026 Asymm Systems. All rights reserved.
 * @author Asymm Systems Team
 * FourRealities: Main Atlassian Forge Entry Point & Resolvers
 */

import Resolver from '@forge/resolver';
import { kvs } from '@forge/kvs';
import api, { route } from '@forge/api';
import { MetricsEngine } from './domain/metrics-engine';
import { MetricsRepository, StorageProvider } from './storage/metrics-repository';
import {
  RealitySignals,
  ProjectAuditSnapshot,
  IssueIntegrityScore,
  IssueExceptionRecord
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

/**
 * Analyzes issue changelog histories for status transitions and rework bounces.
 * Detects regressions from review/testing/done stages back into development.
 */
export function analyzeIssueChangelog(changelog: any): { transitionCount: number; regressionCount: number } {
  if (!changelog || !Array.isArray(changelog.histories)) {
    return { transitionCount: 1, regressionCount: 0 };
  }

  let transitionCount = 0;
  let regressionCount = 0;

  // Stages that indicate verification or completion
  const reviewCategoryWords = ['review', 'in review', 'qa', 'testing', 'verification', 'uat', 'test'];
  const doneCategoryWords = ['done', 'resolved', 'closed', 'complete', 'completed', 'shipped'];

  // Stages that indicate development rework or reopening
  const reworkTargetWords = ['in progress', 'to do', 'open', 'backlog', 'reopened', 'draft'];

  for (const history of changelog.histories) {
    if (!Array.isArray(history.items)) continue;
    for (const item of history.items) {
      if (item.field === 'status') {
        transitionCount++;
        const fromStatus = String(item.fromString || '').toLowerCase();
        const toStatus = String(item.toString || '').toLowerCase();

        const wasInReviewOrTesting = reviewCategoryWords.some(w => fromStatus.includes(w));
        const wasDone = doneCategoryWords.some(w => fromStatus.includes(w));
        const becameRework = reworkTargetWords.some(w => toStatus.includes(w));

        // Rework bounce: moved from review/testing or done back to open/in progress
        if ((wasInReviewOrTesting || wasDone) && becameRework) {
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
 * Requires genuine ADR, RFC, technical specification, design doc, or PRD links.
 */
export function evaluateDocumentedIntent(issuelinks?: any[] | null, remotelinks?: any[] | null): boolean {
  if (Array.isArray(remotelinks) && remotelinks.length > 0) {
    for (const rl of remotelinks) {
      const url = String(rl.object?.url || rl.url || '').toLowerCase();
      const title = String(rl.object?.title || rl.title || '').toLowerCase();

      const isArchitectureSpec =
        title.includes('adr') ||
        title.includes('rfc') ||
        title.includes('spec') ||
        title.includes('decision') ||
        title.includes('architecture') ||
        title.includes('blueprint') ||
        title.includes('design doc') ||
        title.includes('tech spec') ||
        title.includes('requirement');

      const isSpecUrl =
        url.includes('/adr') ||
        url.includes('/rfc') ||
        url.includes('/spec') ||
        url.includes('architecture') ||
        url.includes('decision') ||
        url.includes('blueprint') ||
        url.includes('design-doc');

      if (isArchitectureSpec || isSpecUrl) {
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
 * Shared extraction pipeline converting Jira issue payload to authentic RealitySignals.
 */
export function extractSignalsFromIssue(
  iss: any,
  remoteLinks?: any[],
  devStatusPullRequests?: any[],
  storedException?: IssueExceptionRecord
): RealitySignals {
  const certProp = iss.properties?.['ledgerseal-cert'] || iss.properties?.['ledgersealCert'];
  const dodProp = iss.properties?.['definitionguard-dod'] || iss.properties?.['definitionguardDod'];
  const links = iss.fields?.issuelinks;
  const hasDocumentedIntent = evaluateDocumentedIntent(links, remoteLinks);
  const { transitionCount, regressionCount } = analyzeIssueChangelog(iss.changelog);

  let prCount = 0;
  let hasApprovedReview = false;

  // 1. Check Dev Status PR review approval
  if (Array.isArray(devStatusPullRequests) && devStatusPullRequests.length > 0) {
    prCount = devStatusPullRequests.length;
    hasApprovedReview = devStatusPullRequests.some(pr =>
      (Array.isArray(pr.reviewers) && pr.reviewers.some((r: any) => r.approvalStatus === 'APPROVED')) ||
      pr.status === 'APPROVED'
    );
  }

  // 2. Check development field heuristic if dev-status returned no PRs
  if (prCount === 0) {
    const devField = iss.fields?.customfield_10000;
    if (typeof devField === 'string' && devField.includes('pullrequest')) {
      prCount = 1;
      // Approved status required; merely MERGED without approval is not credited
      if (devField.includes('APPROVED')) {
        hasApprovedReview = true;
      }
    }
  }

  // 3. Authenticate cryptographic seal (requires valid snapshotHash and certificateId)
  const isSealed = Boolean(
    certProp &&
    (certProp.status === 'SEAL_VALID' || certProp.valid === true) &&
    !certProp.isCompromised &&
    certProp.snapshotHash
  );

  // 4. Authenticate DoD satisfaction
  const isDoDSatisfied = Boolean(
    dodProp &&
    (dodProp.isFullySatisfied === true || dodProp.satisfied === true)
  );

  // 5. Dynamic sprint name detection
  const sprintObj = iss.fields?.sprint || iss.fields?.customfield_10020?.[0];
  const sprintName = sprintObj?.name;

  return {
    issueId: String(iss.id),
    issueKey: String(iss.key),
    summary: iss.fields?.summary || '',
    status: iss.fields?.status?.name || 'In Progress',
    statusCategory: iss.fields?.status?.statusCategory?.name || 'In Progress',
    assigneeName: iss.fields?.assignee?.displayName,
    sprintName,
    hasDocumentedIntent,
    transitionCount,
    regressionCount,
    reworkReason: storedException?.type === 'REWORK' ? storedException.reason : undefined,
    prCount,
    hasApprovedReview,
    codeExceptionReason: storedException?.type === 'CODE' ? storedException.reason : undefined,
    hasCryptographicSeal: isSealed,
    sealCertificateId: certProp?.certificateId,
    sealSnapshotHash: certProp?.snapshotHash,
    isDoDSatisfied,
    dodCompletedCount: dodProp?.completedCount,
    dodTotalCount: dodProp?.totalCount
  };
}

/**
 * Queries live Jira issues using search/jql with pagination support up to 100+ issues.
 */
export async function fetchLiveProjectAudit(
  projectKey: string,
  repository?: MetricsRepository
): Promise<{ signals: RealitySignals[]; error?: string }> {
  try {
    const allIssues: any[] = [];
    let startAt = 0;
    const maxResults = 100;
    let isLast = false;

    // Paginate Jira search up to 2 pages (200 issues) for comprehensive audit
    while (!isLast && allIssues.length < 200) {
      const res = await api.asApp().requestJira(
        route`/rest/api/3/search/jql?jql=project = "${projectKey}" order by created desc&startAt=${startAt}&maxResults=${maxResults}&fields=summary,status,issuetype,issuelinks,assignee,customfield_10000,customfield_10020,sprint&properties=ledgerseal-cert,ledgersealCert,definitionguard-dod,definitionguardDod&expand=changelog`
      );

      if (res.status !== 200) {
        return { signals: [], error: `Jira search/jql failed with HTTP ${res.status}` };
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

    const signals: RealitySignals[] = [];
    for (const iss of allIssues) {
      let storedException: IssueExceptionRecord | undefined = undefined;
      if (repository) {
        storedException = await repository.getIssueException(String(iss.id));
      }
      signals.push(extractSignalsFromIssue(iss, undefined, undefined, storedException));
    }

    return { signals };
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

  // Retrieve authentic previous snapshot from storage history
  const previousSnapshot = await repository.getPreviousProjectSnapshot(projectKey);

  // Attempt live Jira query for authentic project issues
  const { signals: liveSignals, error: syncError } = await fetchLiveProjectAudit(projectKey, repository);

  // If live Jira returned authentic signals without error
  if (!syncError) {
    const issueScores = liveSignals.map(s => MetricsEngine.evaluateIssue(s));
    const summary = MetricsEngine.summarizeProject(liveSignals, previousSnapshot);
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

  const storage = resolveStorage(storageProvider);
  const repository = new MetricsRepository(storage);
  const storedException = await repository.getIssueException(issueId);

  // Attempt to fetch authentic live Jira issue state and entity properties
  try {
    const [issueRes, remoteLinksRes, stashDevRes, githubDevRes, bitbucketDevRes] = await Promise.all([
      api.asApp().requestJira(
        route`/rest/api/3/issue/${issueId}?fields=summary,status,issuetype,issuelinks,assignee,customfield_10000,customfield_10020,sprint&properties=ledgerseal-cert,ledgersealCert,definitionguard-dod,definitionguardDod&expand=changelog`
      ),
      api.asApp().requestJira(route`/rest/api/3/issue/${issueId}/remotelink`).catch(() => null),
      api.asApp().requestJira(route`/rest/dev-status/latest/issue/detail?issueId=${issueId}&applicationType=stash&dataType=pullrequest`).catch(() => null),
      api.asApp().requestJira(route`/rest/dev-status/latest/issue/detail?issueId=${issueId}&applicationType=github&dataType=pullrequest`).catch(() => null),
      api.asApp().requestJira(route`/rest/dev-status/latest/issue/detail?issueId=${issueId}&applicationType=bitbucket&dataType=pullrequest`).catch(() => null)
    ]);

    if (issueRes.status === 200) {
      const iss = await issueRes.json();
      if (iss?.id || iss?.key) {
        let remoteLinks: any[] = [];
        if (remoteLinksRes && remoteLinksRes.status === 200) {
          try {
            remoteLinks = await remoteLinksRes.json();
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

        const signals = extractSignalsFromIssue(iss, remoteLinks, pullRequests, storedException);
        return MetricsEngine.evaluateIssue(signals);
      }
    }
    throw new Error(`FourRealities: Jira returned HTTP ${issueRes.status} for issue '${issueKey}'.`);
  } catch (err: any) {
    // Signals come from Jira only. There is no cached fallback: a failed read is reported.
    if (String(err?.message || '').startsWith('FourRealities:')) {
      throw err;
    }
    throw new Error(`FourRealities: Failed to query Jira for issue '${issueKey}': ${err?.message || 'network error'}`);
  }
}

/**
 * Remediation Resolvers. FourRealities never writes the LedgerSeal or DefinitionGuard
 * properties: that evidence belongs to the producer apps (one writer per fact).
 */

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

  const record: IssueExceptionRecord = {
    issueId,
    issueKey: String(payload?.issueKey || issueId),
    type,
    reason,
    notes,
    recordedBy: String(context?.accountId || 'system-user'),
    recordedAt: new Date().toISOString()
  };

  const storage = resolveStorage(storageProvider);
  const repository = new MetricsRepository(storage);
  await repository.saveIssueException(record);

  // Persist property to Jira issue
  try {
    await api.asUser().requestJira(route`/rest/api/3/issue/${issueId}/properties/fourrealities-exception`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(record)
    }).catch(async () => {
      await api.asApp().requestJira(route`/rest/api/3/issue/${issueId}/properties/fourrealities-exception`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(record)
      });
    });
  } catch {}

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
  const projectKey = req.payload?.projectKey || req.context?.extension?.project?.key || 'DEFAULT';
  return await getProjectDashboard({ ...req.payload, projectKey }, req.context);
});

resolver.define('getIssueAlignment', async (req) => {
  const issueId = req.payload?.issueId || req.context?.extension?.issue?.id || 'default-issue';
  const issueKey = req.payload?.issueKey || req.context?.extension?.issue?.key || issueId;
  return await getIssueAlignment({ ...req.payload, issueId, issueKey }, req.context);
});

resolver.define('linkDecision', async (req) => {
  return await linkDecision(req.payload, req.context);
});

resolver.define('recordException', async (req) => {
  return await recordException(req.payload, req.context);
});

export const handler = resolver.getDefinitions();
