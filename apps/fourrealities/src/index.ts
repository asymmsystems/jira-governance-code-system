/**
 * Copyright (c) 2026 Asymm Systems. All rights reserved.
 * @author Fahim Farook
 * FourRealities: Forge entry point. Client layer (resolver and trigger registration) and the
 * single composition point that builds the Default implementations (ADR-002).
 */

import Resolver from '@forge/resolver';
import { AdminResult, AdminView, ApprovalView, PersonalDataRunResult, CallerContext, DecideExceptionPayload, ForgeContext, IssueRow, LinkDecisionPayload, ProjectDashboardView, RecordExceptionPayload, RequestReviewPayload, ResolverResult, ScheduledRunResult, WriteResult } from './contract/data/models';
import { ConfluencePage, ConfluencePageSearchAccessor, PrivacyReportAccessor, StorageProvider } from './contract/accessors';
import { DefaultForgeKvsStore } from './accessor/default-forge-kvs-store';
import { DefaultForgeConfluenceSearchAccessor } from './accessor/default-forge-confluence-search-accessor';
import { DefaultForgeJiraIssueAccessor, Principal } from './accessor/default-forge-jira-issue-accessor';
import { DefaultKvsSiteConfigAccessor } from './accessor/default-kvs-site-config-accessor';
import { DefaultKvsSnapshotAccessor } from './accessor/default-kvs-snapshot-accessor';
import { DefaultKvsReworkNoteAccessor } from './accessor/default-kvs-rework-note-accessor';
import { DefaultForgeAppContextAccessor } from './accessor/default-forge-app-context-accessor';
import { DefaultKvsExceptionEventAccessor } from './accessor/default-kvs-exception-event-accessor';
import { requestAs } from './accessor/default-forge-jira-issue-accessor';
import { attestationChecker, trustedKeysFor } from './accessor/attestation-verifier';
import { TrustedKey } from './accessor/attestation-keys';
import { DefaultGateEngine } from './engine/default-gate-engine';
import { DefaultMetricsEngine } from './engine/default-metrics-engine';
import { DefaultSnapshotEngine } from './engine/default-snapshot-engine';
import { DefaultPolicyEngine } from './engine/default-policy-engine';
import { DefaultExceptionPolicyEngine } from './engine/default-exception-policy-engine';
import { DefaultSnapshotManager } from './manager/default-snapshot-manager';
import { DefaultIssueEvidenceManager } from './manager/default-issue-evidence-manager';
import { DefaultKvsSettingsAccessor } from './accessor/default-kvs-settings-accessor';
import { DefaultKvsAttestationHistoryAccessor } from './accessor/default-kvs-attestation-history-accessor';
import { DefaultForgeJiraDirectoryAccessor } from './accessor/default-forge-jira-directory-accessor';
import { DefaultSourcePolicyEngine } from './engine/default-source-policy-engine';
import { DefaultAdminManager } from './manager/default-admin-manager';
import { DefaultPersonalDataManager } from './manager/default-personal-data-manager';
import { DefaultKvsPersonalDataAccessor } from './accessor/default-kvs-personal-data-accessor';
import { DefaultForgePrivacyAccessor } from './accessor/default-forge-privacy-accessor';
import { DefaultExceptionManager } from './manager/default-exception-manager';

/**
 * Time one resolver invocation may spend, from its start, inside the 25 s Forge limit. Every Jira
 * read and the page view's own steps share this one deadline (F-H2).
 */
export const RESOLVER_LINK_BUDGET_MS = 20_000;
/** Time the daily snapshot run may spend across all projects, inside its 600 s timeout. */
export const SCHEDULED_BUDGET_MS = 540_000;

let globalStorageProvider: StorageProvider | null = null;
let trustedKeysOverride: readonly TrustedKey[] | null = null;

/** Replaces the trusted sibling keys for every later call (tests and tools); null restores the bundled keys. */
export function setTrustedKeys(keys: readonly TrustedKey[] | null): void {
  trustedKeysOverride = keys;
}

/** The keys trusted in this Forge environment (ADR-012). */
function trustedKeys(): readonly TrustedKey[] {
  return trustedKeysOverride || trustedKeysFor(new DefaultForgeAppContextAccessor().environmentType());
}

/** Replaces the storage for every later call (tests and tools). */
export function setGlobalStorageProvider(provider: StorageProvider | null): void {
  globalStorageProvider = provider;
}

export function resolveStorage(customProvider?: StorageProvider): StorageProvider {
  return customProvider || globalStorageProvider || new DefaultForgeKvsStore();
}

/**
 * Builds the object graph for one invocation. Site configuration is read as the given
 * principal; the snapshot is built as the app; viewer checks (Browse projects, the issues the
 * viewer can browse, linked Confluence pages) and user actions run as the user.
 */
export function compose(storageProvider: StorageProvider | undefined, budgetMs: number, configPrincipal: Principal) {
  const storage = resolveStorage(storageProvider);
  const deadline = Date.now() + budgetMs;
  const verify = attestationChecker(trustedKeys());
  const appJira = new DefaultForgeJiraIssueAccessor('app', () => deadline, undefined, verify);
  const userJira = new DefaultForgeJiraIssueAccessor('user', () => deadline, undefined, verify);
  const siteConfig = new DefaultKvsSiteConfigAccessor(storage, requestAs(configPrincipal, () => deadline));
  const notes = new DefaultKvsReworkNoteAccessor(storage);
  const events = new DefaultKvsExceptionEventAccessor(storage);
  const lifecycle = new DefaultExceptionPolicyEngine();
  const gates = new DefaultGateEngine();
  const metrics = new DefaultMetricsEngine();
  const policy = new DefaultPolicyEngine();
  const settings = new DefaultKvsSettingsAccessor(storage);
  const sources = new DefaultSourcePolicyEngine();
  const history = new DefaultKvsAttestationHistoryAccessor(storage);
  const directory = new DefaultForgeJiraDirectoryAccessor(requestAs('user', () => deadline));
  const userConfluence = new DefaultForgeConfluenceSearchAccessor();
  return {
    settings,
    sources,
    directory,
    projects: new DefaultSnapshotManager({
      jira: appJira,
      viewerJira: userJira,
      budgetMs,
      deadline,
      siteConfig,
      snapshots: new DefaultKvsSnapshotAccessor(storage),
      notes,
      events,
      lifecycle,
      gates,
      metrics,
      snapshot: new DefaultSnapshotEngine(),
      settings,
      sources,
      directory,
      confluence: userConfluence,
      history
    }),
    issues: new DefaultIssueEvidenceManager({ userJira, siteConfig, notes, events, lifecycle, gates, metrics, policy, settings, sources, confluence: userConfluence, history }),
    exceptions: new DefaultExceptionManager({ userJira, appJira, directory, settings, siteConfig, notes, events, policy, lifecycle }),
    admin: new DefaultAdminManager({ directory, settings, siteConfig, sources }),
    personalData: (privacy: PrivacyReportAccessor) => new DefaultPersonalDataManager({ data: new DefaultKvsPersonalDataAccessor(storage), privacy, events, notes, lifecycle, appJira })
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
  if (new DefaultForgeAppContextAccessor().licenceActive() === false) {
    console.log('FourRealities: scheduled snapshot skipped: the licence is not active.');
    return;
  }
  const result = await runScheduledSnapshot();
  console.log('FourRealities: scheduled snapshot', JSON.stringify(result));
};

/**
 * Weekly personal data run (ADR-014): reports every stored account id, erases closed accounts.
 * It runs whatever the licence state: the duty to report and erase does not end with a licence.
 */
export async function reportPersonalData(storageProvider?: StorageProvider, privacy: PrivacyReportAccessor = new DefaultForgePrivacyAccessor()): Promise<PersonalDataRunResult> {
  return compose(storageProvider, SCHEDULED_BUDGET_MS, 'app').personalData(privacy).run();
}

/** Forge scheduledTrigger handler (manifest function "personal-data"). */
export const personalData = async (): Promise<void> => {
  try {
    const result = await reportPersonalData();
    console.log('FourRealities: personal data report', JSON.stringify(result));
  } catch (err) {
    console.error('FourRealities: personal data report failed', err instanceof Error ? err.message : String(err));
  }
};

/** Evaluates one Jira issue. The issue comes from the Forge context only. */
export async function getIssueAlignment(payload: unknown, context?: ForgeContext, storageProvider?: StorageProvider): Promise<ResolverResult<{ row: IssueRow; approval?: ApprovalView }>> {
  if (licenceInactive(context)) return LICENCE_READ_ERROR;
  const app = compose(storageProvider, RESOLVER_LINK_BUDGET_MS, 'user');
  const caller = callerOf(context);
  const evaluated = await app.issues.evaluate(caller);
  if (!evaluated.ok) return evaluated;
  // The decision buttons the viewer may use, checked as the viewer (ADR-013 decision 5).
  const approval = await app.exceptions.approval(caller, evaluated.row);
  return approval ? { ...evaluated, approval } : evaluated;
}

/**
 * After a successful write from the issue panel, reads the issue again as the user and adds its
 * row, so the panel shows the state Jira returns (B-17, FR-20). A failed read leaves no row.
 */
async function withRow(app: ReturnType<typeof compose>, caller: CallerContext, result: WriteResult): Promise<WriteResult> {
  if (!result.success || !caller.issueId) return result;
  const evaluated = await app.issues.evaluate(caller);
  if (!evaluated.ok) return result;
  const approval = await app.exceptions.approval(caller, evaluated.row);
  return { ...result, row: evaluated.row, ...(approval ? { approval } : {}) };
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

/** Requests a retrospective review by posting a comment as the user. */
export async function requestReview(payload: RequestReviewPayload | undefined, context?: ForgeContext, storageProvider?: StorageProvider): Promise<WriteResult> {
  if (licenceInactive(context)) return { ...LICENCE_WRITE_ERROR };
  const app = compose(storageProvider, RESOLVER_LINK_BUDGET_MS, 'user');
  const caller = callerOf(context);
  return withRow(app, caller, await app.issues.requestReview(caller, payload));
}

/** Searches Confluence pages by title as the user (B-41). */
export async function searchConfluencePages(
  payload: { query?: string } | undefined,
  context?: ForgeContext,
  confluenceAccessor?: ConfluencePageSearchAccessor
): Promise<{ ok: boolean; pages: ConfluencePage[]; error?: string }> {
  if (licenceInactive(context)) return { ok: false, pages: [], error: LICENCE_INACTIVE_MESSAGE };
  const query = typeof payload?.query === 'string' ? payload.query : '';
  const searcher = confluenceAccessor || new DefaultForgeConfluenceSearchAccessor();
  return searcher.searchPages(query);
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

resolver.define('requestReview', async (req) => {
  return await requestReview(req.payload, req.context);
});

resolver.define('searchConfluencePages', async (req) => {
  return await searchConfluencePages(req.payload as { query?: string }, req.context);
});

export const handler = resolver.getDefinitions();

const ADMIN_LICENCE_ERROR = { ok: false as const, code: 'LICENSE_INACTIVE' as const, message: LICENCE_INACTIVE_MESSAGE };

/** Admin page: the settings, the checks in use and the approver groups (ADR-013). Jira administrators only. */
export async function getAdminSettings(payload: unknown, context?: ForgeContext, storageProvider?: StorageProvider): Promise<AdminResult<AdminView>> {
  if (licenceInactive(context)) return ADMIN_LICENCE_ERROR;
  return compose(storageProvider, RESOLVER_LINK_BUDGET_MS, 'user').admin.view();
}

/** Admin page: saves the evidence sources and the decision issue types. */
export async function saveAdminSources(payload: unknown, context?: ForgeContext, storageProvider?: StorageProvider): Promise<AdminResult<AdminView>> {
  if (licenceInactive(context)) return ADMIN_LICENCE_ERROR;
  return compose(storageProvider, RESOLVER_LINK_BUDGET_MS, 'user').admin.saveSources(payload);
}

/** Admin page: searches Jira groups by name. */
export async function searchAdminGroups(payload: unknown, context?: ForgeContext, storageProvider?: StorageProvider): Promise<AdminResult<{ groups: Array<{ groupId: string; name: string }> }>> {
  if (licenceInactive(context)) return ADMIN_LICENCE_ERROR;
  return compose(storageProvider, RESOLVER_LINK_BUDGET_MS, 'user').admin.searchGroups(payload);
}

/** Admin page: saves the approver groups (Tier 2). */
export async function saveAdminApprovers(payload: unknown, context?: ForgeContext, storageProvider?: StorageProvider): Promise<AdminResult<AdminView>> {
  if (licenceInactive(context)) return ADMIN_LICENCE_ERROR;
  return compose(storageProvider, RESOLVER_LINK_BUDGET_MS, 'user').admin.saveApprovers(payload);
}

const adminResolver = new Resolver();
adminResolver.define('fr-admin-get', async req => getAdminSettings(req.payload, req.context));
adminResolver.define('fr-admin-save-sources', async req => saveAdminSources(req.payload, req.context));
adminResolver.define('fr-admin-search-groups', async req => searchAdminGroups(req.payload, req.context));
adminResolver.define('fr-admin-save-approvers', async req => saveAdminApprovers(req.payload, req.context));

/** Forge function of the admin page (manifest function admin-resolver). */
export const adminHandler = adminResolver.getDefinitions();
