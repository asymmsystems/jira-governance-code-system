/**
 * Copyright (c) 2026 Asymm Systems. All rights reserved.
 * @author Fahim Farook
 * FourRealities: Forge entry point. Client layer (resolver and trigger registration) and the
 * single composition point that builds the Default implementations (ADR-002).
 */

import Resolver from '@forge/resolver';
import { CallerContext, DecideExceptionPayload, ForgeContext, IssueRow, LinkDecisionPayload, ProjectDashboardView, RecordExceptionPayload, ResolverResult, ScheduledRunResult, WriteResult } from './contract/data/models';
import { StorageProvider } from './contract/accessors';
import { DefaultForgeKvsStore } from './accessor/default-forge-kvs-store';
import { DefaultForgeJiraIssueAccessor, Principal } from './accessor/default-forge-jira-issue-accessor';
import { DefaultKvsSiteConfigAccessor } from './accessor/default-kvs-site-config-accessor';
import { DefaultKvsSnapshotAccessor } from './accessor/default-kvs-snapshot-accessor';
import { DefaultKvsReworkNoteAccessor } from './accessor/default-kvs-rework-note-accessor';
import { DefaultKvsExceptionEventAccessor } from './accessor/default-kvs-exception-event-accessor';
import { requestAs } from './accessor/default-forge-jira-issue-accessor';
import { DefaultGateEngine } from './engine/default-gate-engine';
import { DefaultMetricsEngine } from './engine/default-metrics-engine';
import { DefaultSnapshotEngine } from './engine/default-snapshot-engine';
import { DefaultPolicyEngine } from './engine/default-policy-engine';
import { DefaultExceptionPolicyEngine } from './engine/default-exception-policy-engine';
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
  const notes = new DefaultKvsReworkNoteAccessor(storage);
  const events = new DefaultKvsExceptionEventAccessor(storage);
  const lifecycle = new DefaultExceptionPolicyEngine();
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
      notes,
      events,
      lifecycle,
      gates,
      metrics,
      snapshot: new DefaultSnapshotEngine()
    }),
    issues: new DefaultIssueEvidenceManager({ userJira, siteConfig, notes, events, lifecycle, gates, metrics, policy }),
    exceptions: new DefaultExceptionManager({ userJira, siteConfig, notes, events, policy, lifecycle })
  };
}

export const LICENCE_INACTIVE_MESSAGE = 'The FourRealities licence for this site is not active. A site administrator can renew it in Manage apps.';

/** True only when Forge says the licence is inactive; no licence (development) is allowed (D-10, B-23). */
export function licenceInactive(context: ForgeContext | undefined): boolean {
  return context?.license?.isActive === false;
}

const LICENCE_READ_ERROR = { ok: false as const, error: { code: 'LICENSE_INACTIVE' as const, message: LICENCE_INACTIVE_MESSAGE } };
const LICENCE_WRITE_ERROR: WriteResult = { success: false, error: LICENCE_INACTIVE_MESSAGE };

/** The parts of the Forge context that Managers use. */
export function callerOf(context: ForgeContext | undefined): CallerContext {
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
export async function getProjectDashboard(payload: unknown, context?: ForgeContext, storageProvider?: StorageProvider): Promise<ResolverResult<ProjectDashboardView>> {
  if (licenceInactive(context)) return LICENCE_READ_ERROR;
  return compose(storageProvider, RESOLVER_LINK_BUDGET_MS, 'app').projects.view(callerOf(context), false);
}

/** Rebuilds the project snapshot now ("Refresh"), inside the resolver time budget. */
export async function refreshProjectSnapshot(payload: unknown, context?: ForgeContext, storageProvider?: StorageProvider): Promise<ResolverResult<ProjectDashboardView>> {
  if (licenceInactive(context)) return LICENCE_READ_ERROR;
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
export async function getIssueAlignment(payload: unknown, context?: ForgeContext, storageProvider?: StorageProvider): Promise<ResolverResult<{ row: IssueRow }>> {
  if (licenceInactive(context)) return LICENCE_READ_ERROR;
  return compose(storageProvider, RESOLVER_LINK_BUDGET_MS, 'user').issues.evaluate(callerOf(context));
}

/**
 * After a successful write from the issue panel, reads the issue again as the user and adds its
 * row, so the panel shows the state Jira returns (B-17, FR-20). A failed read leaves no row.
 */
async function withRow(app: ReturnType<typeof compose>, caller: CallerContext, result: WriteResult): Promise<WriteResult> {
  if (!result.success || !caller.issueId) return result;
  const evaluated = await app.issues.evaluate(caller);
  return evaluated.ok ? { ...result, row: evaluated.row } : result;
}

/**
 * Remediation Resolvers. FourRealities never writes the LedgerSeal or DefinitionGuard
 * properties: that evidence belongs to the producer apps (one writer per fact).
 */
export async function linkDecision(payload: LinkDecisionPayload | undefined, context?: ForgeContext, storageProvider?: StorageProvider): Promise<WriteResult> {
  if (licenceInactive(context)) return { ...LICENCE_WRITE_ERROR };
  const app = compose(storageProvider, RESOLVER_LINK_BUDGET_MS, 'user');
  const caller = callerOf(context);
  return withRow(app, caller, await app.issues.linkDecision(caller, payload));
}

/** Requests a Code exception, or records a rework note. */
export async function recordException(payload: RecordExceptionPayload | undefined, context?: ForgeContext, storageProvider?: StorageProvider): Promise<WriteResult> {
  if (licenceInactive(context)) return { ...LICENCE_WRITE_ERROR };
  const app = compose(storageProvider, RESOLVER_LINK_BUDGET_MS, 'user');
  const caller = callerOf(context);
  return withRow(app, caller, await app.exceptions.record(caller, payload));
}

/** Approves, rejects, revokes or withdraws a Code exception (ADR-001, Option C). */
export async function decideException(payload: DecideExceptionPayload | undefined, context?: ForgeContext, storageProvider?: StorageProvider): Promise<WriteResult> {
  if (licenceInactive(context)) return { ...LICENCE_WRITE_ERROR };
  const app = compose(storageProvider, RESOLVER_LINK_BUDGET_MS, 'user');
  const caller = callerOf(context);
  return withRow(app, caller, await app.exceptions.decide(caller, payload));
}

/**
 * Rendering hooks for Forge modules.
 */
export async function renderProjectPage(context: ForgeContext) {
  return { moduleKey: 'fourrealities-project-dashboard', context };
}

export async function renderIssuePanel(context: ForgeContext) {
  return { moduleKey: 'fourrealities-issue-panel', context };
}

export async function renderIssueContext(context: ForgeContext) {
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

resolver.define('decideException', async (req) => {
  return await decideException(req.payload, req.context);
});

export const handler = resolver.getDefinitions();
