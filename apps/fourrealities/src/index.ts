/**
 * Copyright (c) 2026 Asymm Systems. All rights reserved.
 * @author Fahim Farook
 * FourRealities: Forge entry point. Client layer (resolver and trigger registration) and the
 * single composition point that builds the Default implementations (ADR-002).
 */

import Resolver from '@forge/resolver';
import { CallerContext, ExceptionRecord, IssueRow, ProjectDashboardView, ResolverResult, ScheduledRunResult } from './contract/data/models';
import { StorageProvider } from './contract/accessors';
import { DefaultForgeKvsStore } from './accessor/default-forge-kvs-store';
import { DefaultForgeJiraIssueAccessor, Principal } from './accessor/default-forge-jira-issue-accessor';
import { DefaultKvsSiteConfigAccessor } from './accessor/default-kvs-site-config-accessor';
import { DefaultKvsSnapshotAccessor } from './accessor/default-kvs-snapshot-accessor';
import { DefaultKvsExceptionAccessor } from './accessor/default-kvs-exception-accessor';
import { requestAs } from './accessor/default-forge-jira-issue-accessor';
import { DefaultGateEngine } from './engine/default-gate-engine';
import { DefaultMetricsEngine } from './engine/default-metrics-engine';
import { DefaultSnapshotEngine } from './engine/default-snapshot-engine';
import { DefaultPolicyEngine } from './engine/default-policy-engine';
import { DefaultSnapshotManager } from './manager/default-snapshot-manager';
import { DefaultIssueEvidenceManager } from './manager/default-issue-evidence-manager';
import { DefaultExceptionManager } from './manager/default-exception-manager';

/** Time a resolver may spend on Jira reads, inside the 25 s Forge limit. */
export const RESOLVER_LINK_BUDGET_MS = 18_000;
/** Time the daily snapshot run may spend across all projects, inside its 600 s timeout. */
export const SCHEDULED_BUDGET_MS = 540_000;

let globalStorageProvider: StorageProvider | null = null;

/** Replaces the storage for every later call (tests and tools). */
export function setGlobalStorageProvider(provider: StorageProvider | null): void {
  globalStorageProvider = provider;
}

export function resolveStorage(customProvider?: StorageProvider): StorageProvider {
  return customProvider || globalStorageProvider || new DefaultForgeKvsStore();
}

/**
 * Builds the object graph for one invocation. Site configuration is read as the given
 * principal; the snapshot is built as the app; viewer checks and user actions run as the user.
 */
export function compose(storageProvider: StorageProvider | undefined, budgetMs: number, configPrincipal: Principal) {
  const storage = resolveStorage(storageProvider);
  const deadline = Date.now() + budgetMs;
  const appJira = new DefaultForgeJiraIssueAccessor('app', () => deadline);
  const userJira = new DefaultForgeJiraIssueAccessor('user', () => deadline);
  const siteConfig = new DefaultKvsSiteConfigAccessor(storage, requestAs(configPrincipal, () => deadline));
  const exceptions = new DefaultKvsExceptionAccessor(storage);
  const gates = new DefaultGateEngine();
  const metrics = new DefaultMetricsEngine();
  const policy = new DefaultPolicyEngine();
  return {
    projects: new DefaultSnapshotManager({
      jira: appJira,
      viewerJira: userJira,
      budgetMs,
      siteConfig,
      snapshots: new DefaultKvsSnapshotAccessor(storage),
      exceptions,
      gates,
      metrics,
      snapshot: new DefaultSnapshotEngine()
    }),
    issues: new DefaultIssueEvidenceManager({ userJira, siteConfig, exceptions, gates, metrics, policy }),
    exceptions: new DefaultExceptionManager({ userJira, siteConfig, exceptions, policy })
  };
}

/** The parts of the Forge context that Managers use. */
export function callerOf(context: any): CallerContext {
  const issue = context?.extension?.issue;
  return {
    accountId: context?.accountId ? String(context.accountId) : undefined,
    issueId: issue?.id ? String(issue.id) : undefined,
    issueKey: issue?.key ? String(issue.key) : undefined,
    projectKey: context?.extension?.project?.key ? String(context.extension.project.key) : undefined
  };
}

/**
 * Project dashboard. Reads the stored snapshot and builds one only when none exists; a page
 * view never writes trend history. The project comes from the Forge context only.
 */
export async function getProjectDashboard(payload: any, context?: any, storageProvider?: StorageProvider): Promise<ResolverResult<ProjectDashboardView>> {
  return compose(storageProvider, RESOLVER_LINK_BUDGET_MS, 'app').projects.view(callerOf(context), false);
}

/** Rebuilds the project snapshot now ("Refresh"), inside the resolver time budget. */
export async function refreshProjectSnapshot(payload: any, context?: any, storageProvider?: StorageProvider): Promise<ResolverResult<ProjectDashboardView>> {
  return compose(storageProvider, RESOLVER_LINK_BUDGET_MS, 'app').projects.view(callerOf(context), true);
}

/** Daily scheduled run over every registered project (spec v2, Snapshot schedule). */
export async function runScheduledSnapshot(storageProvider?: StorageProvider, deadline: number = Date.now() + SCHEDULED_BUDGET_MS): Promise<ScheduledRunResult> {
  return compose(storageProvider, Math.max(0, deadline - Date.now()), 'app').projects.runScheduled(deadline);
}

/** Forge scheduledTrigger handler (manifest function "snapshot"). */
export const snapshot = async (): Promise<void> => {
  const result = await runScheduledSnapshot();
  console.log('FourRealities: scheduled snapshot', JSON.stringify(result));
};

/** Evaluates one Jira issue. The issue comes from the Forge context only. */
export async function getIssueAlignment(payload: any, context?: any, storageProvider?: StorageProvider): Promise<ResolverResult<{ row: IssueRow }>> {
  return compose(storageProvider, RESOLVER_LINK_BUDGET_MS, 'user').issues.evaluate(callerOf(context));
}

/**
 * Remediation Resolvers. FourRealities never writes the LedgerSeal or DefinitionGuard
 * properties: that evidence belongs to the producer apps (one writer per fact).
 */
export async function linkDecision(payload: any, context?: any): Promise<{ success: boolean; remoteLink?: any; error?: string }> {
  return compose(undefined, RESOLVER_LINK_BUDGET_MS, 'user').issues.linkDecision(callerOf(context), payload);
}

export async function recordException(payload: any, context?: any, storageProvider?: StorageProvider): Promise<{ success: boolean; record?: ExceptionRecord; error?: string }> {
  return compose(storageProvider, RESOLVER_LINK_BUDGET_MS, 'user').exceptions.record(callerOf(context), payload);
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

resolver.define('refreshProjectSnapshot', async (req) => {
  return await refreshProjectSnapshot(req.payload, req.context);
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
