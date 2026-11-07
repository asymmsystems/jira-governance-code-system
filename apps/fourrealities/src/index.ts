/**
 * Copyright (c) 2026 Asymm Systems. All rights reserved.
 * @author Fahim Farook
 * FourRealities: Forge entry point. Client layer (resolver and trigger registration) and the
 * single composition point that builds the Default implementations (ADR-002).
 */

import Resolver from '@forge/resolver';
import { AdminResult, AdminView, ApprovalView, PersonalDataRunResult, CallerContext, DecideExceptionPayload, ForgeContext, IssueRow, LinkDecisionPayload, ProjectDashboardView, RecordExceptionPayload, RequestReviewPayload, ResolverResult, ScheduledRunResult, WriteResult } from './contract/data/models';
import { ConfluencePage, ConfluencePageSearchAccessor, PrivacyReportAccessor, StorageProvider } from './contract/accessors';
import { errorSummary } from './contract/data/errors';
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
import { ReportCaller, ReportDailyResult, ReportPermissions } from './contract/data/reports';
import { ObjectStoreAccessor, ReportCryptoAccessor, ReportQueueAccessor, ReportRuntimeAccessor } from './contract/reports';
import { reportPermissionsAsUser } from './accessor/default-forge-report-permission-accessor';
import { JOB_MAX_WAIT_MS } from './accessor/jira-request';
import { DefaultForgeJiraReportAccessor } from './accessor/default-forge-jira-report-accessor';
import { DefaultKvsReportStoreAccessor } from './accessor/default-kvs-report-store-accessor';
import { DefaultForgeObjectStoreAccessor } from './accessor/default-forge-object-store-accessor';
import { DefaultForgeReportQueueAccessor } from './accessor/default-forge-report-queue-accessor';
import { DefaultReportCryptoAccessor } from './accessor/default-report-crypto-accessor';
import { DefaultKvsPartyTokenAccessor } from './accessor/default-kvs-party-token-accessor';
import { DefaultForgeReportRuntimeAccessor } from './accessor/default-forge-report-runtime-accessor';
import { DefaultForgeReportPeopleAccessor } from './accessor/default-forge-report-people-accessor';
import { DefaultReportEngine } from './engine/default-report-engine';
import { DefaultReportPolicyEngine } from './engine/default-report-policy-engine';
import { DefaultEvidenceReportManager } from './manager/default-evidence-report-manager';
import { DefaultReportSettingsManager } from './manager/default-report-settings-manager';

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

/** Time one report job event works (HLD section 7.3), inside the 900 s consumer limit. */
export const REPORT_EVENT_BUDGET_MS = 780_000;

/** The platform parts of the reports that tests replace (Object Store, the queue, the key, the runtime). */
export interface ReportPlatform {
  objects?: ObjectStoreAccessor;
  queue?: ReportQueueAccessor;
  crypto?: ReportCryptoAccessor;
  runtime?: ReportRuntimeAccessor;
}

let reportPlatform: ReportPlatform = {};

/** Replaces the report platform for every later call (tests and tools); {} restores Forge. */
export function setReportPlatform(platform: ReportPlatform): void {
  reportPlatform = platform;
}

/**
 * Builds the evidence report object graph (ADR-015). The resolver's caller check is made before this graph
 * is used; the Manager reads as the user for scope and visibility, and as the app only for a job's ids.
 */
export function composeReports(storageProvider: StorageProvider | undefined, budgetMs: number) {
  const storage = resolveStorage(storageProvider);
  const deadline = Date.now() + budgetMs;
  const until = () => deadline;
  const verify = attestationChecker(trustedKeys());
  const store = new DefaultKvsReportStoreAccessor(storage);
  const runtime = reportPlatform.runtime || new DefaultForgeReportRuntimeAccessor();
  const crypto = reportPlatform.crypto || new DefaultReportCryptoAccessor(process.env, runtime.environment());
  const policy = new DefaultReportPolicyEngine();
  const appRequest = requestAs('app', until, JOB_MAX_WAIT_MS);
  const reports = new DefaultEvidenceReportManager({
    store,
    objects: reportPlatform.objects || new DefaultForgeObjectStoreAccessor(),
    queue: reportPlatform.queue || new DefaultForgeReportQueueAccessor(),
    crypto,
    tokens: new DefaultKvsPartyTokenAccessor(storage),
    runtime,
    userJira: new DefaultForgeJiraReportAccessor(requestAs('user', until), verify),
    appJira: new DefaultForgeJiraReportAccessor(appRequest, verify),
    appIssues: new DefaultForgeJiraIssueAccessor('app', until, appRequest, verify),
    people: new DefaultForgeReportPeopleAccessor(requestAs('user', until)),
    siteConfig: new DefaultKvsSiteConfigAccessor(storage, requestAs('app', until)),
    settings: new DefaultKvsSettingsAccessor(storage),
    sources: new DefaultSourcePolicyEngine(),
    gates: new DefaultGateEngine(),
    metrics: new DefaultMetricsEngine(),
    events: new DefaultKvsExceptionEventAccessor(storage),
    notes: new DefaultKvsReworkNoteAccessor(storage),
    lifecycle: new DefaultExceptionPolicyEngine(),
    history: new DefaultKvsAttestationHistoryAccessor(storage),
    engine: new DefaultReportEngine(),
    policy,
    deadline
  });
  const settings = new DefaultReportSettingsManager({ directory: new DefaultForgeJiraDirectoryAccessor(requestAs('user', until)), store, crypto, policy });
  return { reports, settings, runtime };
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
    console.error(`FourRealities: personal data report failed: ${errorSummary(err)}`);
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

/** The parts of the Forge context that the report Manager uses; the project comes from the context only. */
export function reportCallerOf(context: ForgeContext | undefined): ReportCaller {
  const project = context?.extension?.project;
  return {
    accountId: context?.accountId ? String(context.accountId) : undefined,
    projectKey: project?.key ? String(project.key) : undefined,
    projectId: project?.id !== undefined && project?.id !== null && String(project.id) !== '' ? String(project.id) : undefined,
    licenceActive: !licenceInactive(context)
  };
}

/*
 * Evidence report resolvers (ADR-015, HLD section 7.2). Each one first asks Jira, as the user, for the
 * caller's permissions in the context project (reportPermissionsAsUser, the FSRT-visible form of HLD 7.1),
 * before any storage read and before any call as the app. Listing and download work when the licence is
 * inactive; creation and schedules do not (owner decision Q9).
 */

export async function getEvidenceReports(payload: unknown, context?: ForgeContext, storageProvider?: StorageProvider) {
  const caller = reportCallerOf(context);
  const permissions: ReportPermissions = await reportPermissionsAsUser(caller.projectKey);
  return composeReports(storageProvider, RESOLVER_LINK_BUDGET_MS).reports.list(caller, permissions, payload);
}

export async function createEvidenceReport(payload: unknown, context?: ForgeContext, storageProvider?: StorageProvider) {
  const caller = reportCallerOf(context);
  const permissions: ReportPermissions = await reportPermissionsAsUser(caller.projectKey);
  return composeReports(storageProvider, RESOLVER_LINK_BUDGET_MS).reports.create(caller, permissions, payload);
}

export async function getEvidenceReport(payload: unknown, context?: ForgeContext, storageProvider?: StorageProvider) {
  const caller = reportCallerOf(context);
  const permissions: ReportPermissions = await reportPermissionsAsUser(caller.projectKey);
  return composeReports(storageProvider, RESOLVER_LINK_BUDGET_MS).reports.detail(caller, permissions, payload);
}

/** The functionKey of useObjectStore: { [presignedUrl]: key }, empty when refused. */
export async function generateReportDownloadUrls(payload: unknown, context?: ForgeContext, storageProvider?: StorageProvider) {
  const caller = reportCallerOf(context);
  const permissions: ReportPermissions = await reportPermissionsAsUser(caller.projectKey);
  const urls = await composeReports(storageProvider, RESOLVER_LINK_BUDGET_MS).reports.downloadUrls(caller, permissions, payload);
  // For diagnosis of a failed download: counts only, never a key, an id or a URL.
  console.log('FourRealities: report download URLs', JSON.stringify({ asked: Array.isArray((payload as { keys?: unknown } | undefined)?.keys) ? ((payload as { keys: unknown[] }).keys).length : 0, given: Object.keys(urls).length }));
  return urls;
}

export async function saveReportSchedule(payload: unknown, context?: ForgeContext, storageProvider?: StorageProvider) {
  const caller = reportCallerOf(context);
  const permissions: ReportPermissions = await reportPermissionsAsUser(caller.projectKey);
  return composeReports(storageProvider, RESOLVER_LINK_BUDGET_MS).reports.saveSchedule(caller, permissions, payload);
}

export async function deleteReportSchedule(payload: unknown, context?: ForgeContext, storageProvider?: StorageProvider) {
  const caller = reportCallerOf(context);
  const permissions: ReportPermissions = await reportPermissionsAsUser(caller.projectKey);
  return composeReports(storageProvider, RESOLVER_LINK_BUDGET_MS).reports.deleteSchedule(caller, permissions, payload);
}

export async function deleteEvidenceReport(payload: unknown, context?: ForgeContext, storageProvider?: StorageProvider) {
  const caller = reportCallerOf(context);
  const permissions: ReportPermissions = await reportPermissionsAsUser(caller.projectKey);
  return composeReports(storageProvider, RESOLVER_LINK_BUDGET_MS).reports.deleteReport(caller, permissions, payload);
}

/** One event of a report job, as the app, for the job's stored ids only. */
export async function runReportJob(reportId: string, storageProvider?: StorageProvider, deadline: number = Date.now() + REPORT_EVENT_BUDGET_MS, eventId?: string): Promise<void> {
  await composeReports(storageProvider, Math.max(0, deadline - Date.now())).reports.work(reportId, deadline, eventId);
}

/** Forge consumer of the queue fourrealities-report-jobs (manifest function report-worker). */
export const reportWorker = async (event: { body?: { reportId?: unknown }; eventId?: unknown } | undefined): Promise<void> => {
  const reportId = typeof event?.body?.reportId === 'string' ? event.body.reportId : '';
  const eventId = typeof event?.eventId === 'string' ? event.eventId : undefined;
  try {
    await runReportJob(reportId, undefined, Date.now() + REPORT_EVENT_BUDGET_MS, eventId);
  } catch (err) {
    console.error(`FourRealities: report job event failed: ${errorSummary(err)}`);
  }
};

/** The daily report run: schedules (licence active only), retention, temporary files, stalled jobs. */
export async function runReportDaily(storageProvider?: StorageProvider, deadline: number = Date.now() + SCHEDULED_BUDGET_MS): Promise<ReportDailyResult> {
  const app = composeReports(storageProvider, Math.max(0, deadline - Date.now()));
  // Retention and clean-up run whatever the licence; only new scheduled reports stop (Q9).
  return app.reports.daily(deadline, app.runtime.licenceActive() !== false);
}

/** The hourly sweep of temporary people files (review L-3: a file lives at most 25 hours). */
export async function runReportTmpSweep(storageProvider?: StorageProvider, deadline: number = Date.now() + SCHEDULED_BUDGET_MS): Promise<{ deleted: number; skipped: boolean }> {
  return composeReports(storageProvider, Math.max(0, deadline - Date.now())).reports.sweepTmp(deadline);
}

/** Forge scheduledTrigger handler (manifest function report-tmp). */
export const reportTmp = async (): Promise<void> => {
  try {
    const result = await runReportTmpSweep();
    console.log('FourRealities: report temporary files', JSON.stringify(result));
  } catch (err) {
    console.error(`FourRealities: report temporary files failed: ${errorSummary(err)}`);
  }
};

/** Forge scheduledTrigger handler (manifest function report-daily). */
export const reportDaily = async (): Promise<void> => {
  try {
    const result = await runReportDaily();
    console.log('FourRealities: report daily run', JSON.stringify(result));
  } catch (err) {
    console.error(`FourRealities: report daily run failed: ${errorSummary(err)}`);
  }
};

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

resolver.define('getEvidenceReports', async (req) => {
  return await getEvidenceReports(req.payload, req.context);
});

resolver.define('createEvidenceReport', async (req) => {
  return await createEvidenceReport(req.payload, req.context);
});

resolver.define('getEvidenceReport', async (req) => {
  return await getEvidenceReport(req.payload, req.context);
});

resolver.define('generateReportDownloadUrls', async (req) => {
  return await generateReportDownloadUrls(req.payload, req.context);
});

resolver.define('saveReportSchedule', async (req) => {
  return await saveReportSchedule(req.payload, req.context);
});

resolver.define('deleteReportSchedule', async (req) => {
  return await deleteReportSchedule(req.payload, req.context);
});

resolver.define('deleteEvidenceReport', async (req) => {
  return await deleteEvidenceReport(req.payload, req.context);
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

/** Admin page: the evidence report settings (retention, report groups, signing key id). Jira administrators only. */
export async function getReportSettings(payload: unknown, context?: ForgeContext, storageProvider?: StorageProvider) {
  if (licenceInactive(context)) return ADMIN_LICENCE_ERROR;
  return composeReports(storageProvider, RESOLVER_LINK_BUDGET_MS).settings.view();
}

/** Admin page: saves the retention and the report groups. */
export async function setReportSettings(payload: unknown, context?: ForgeContext, storageProvider?: StorageProvider) {
  if (licenceInactive(context)) return ADMIN_LICENCE_ERROR;
  return composeReports(storageProvider, RESOLVER_LINK_BUDGET_MS).settings.save(payload);
}

const adminResolver = new Resolver();
adminResolver.define('fr-admin-get', async req => getAdminSettings(req.payload, req.context));
adminResolver.define('fr-admin-save-sources', async req => saveAdminSources(req.payload, req.context));
adminResolver.define('fr-admin-search-groups', async req => searchAdminGroups(req.payload, req.context));
adminResolver.define('fr-admin-save-approvers', async req => saveAdminApprovers(req.payload, req.context));
adminResolver.define('fr-admin-reports-get', async req => getReportSettings(req.payload, req.context));
adminResolver.define('fr-admin-reports-save', async req => setReportSettings(req.payload, req.context));

/** Forge function of the admin page (manifest function admin-resolver). */
export const adminHandler = adminResolver.getDefinitions();
