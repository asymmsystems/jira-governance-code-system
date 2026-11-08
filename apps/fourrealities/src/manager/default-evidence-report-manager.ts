/**
 * Copyright (c) 2026 Asymm Systems. All rights reserved.
 * @author Fahim Farook
 * FourRealities: evidence reports for change-management audits (ADR-015, spec v4). One subject, the report:
 * the project page resolvers (each after the caller's permission check as the user, done by the resolver
 * before this Manager is called, and before any storage read or call as the app), the queue consumer that
 * builds a report as the app for the job's stored issue ids only, and the daily run (schedules, retention,
 * temporary files, stalled jobs). Orchestration only: rules are in the report Engines.
 */

import { AttestationHistory, GateExceptionEvent, IssueFacts, RemoteLink, ReworkNote, SourcesInUse } from '../contract/data/models';
import {
  ChainLink,
  ChangelogEntry,
  DownloadDecision,
  FieldInfo,
  ManifestHeader,
  NotReadableIssue,
  PeopleRow,
  REPORT_LIMITS,
  ReportCaller,
  ReportDailyResult,
  ReportDetail,
  ReportError,
  ReportErrorCode,
  ReportFileName,
  ReportFilters,
  ReportIndexEntry,
  ReportIssue,
  ReportIssueBasics,
  ReportJob,
  ReportListRow,
  ReportManifest,
  ReportPart,
  ReportPermissions,
  ReportRange,
  ReportResult,
  ReportSchedule,
  ReportSettings,
  ReportTombstone,
  ReportsView
} from '../contract/data/reports';
import { AttestationHistoryAccessor, ExceptionEventAccessor, JiraIssueAccessor, ReworkNoteAccessor, SettingsAccessor, SiteConfigAccessor } from '../contract/accessors';
import { ExceptionPolicyEngine, GateEngine, MetricsEngine, SourcePolicyEngine } from '../contract/engines';
import {
  EvidenceReportManager,
  JiraReportAccessor,
  ObjectStoreAccessor,
  PartyTokenAccessor,
  ReportCryptoAccessor,
  ReportEngine,
  ReportJobManager,
  ReportPeopleAccessor,
  ReportPolicyEngine,
  ReportQueueAccessor,
  ReportRuntimeAccessor,
  ReportStoreAccessor
} from '../contract/reports';

export interface EvidenceReportManagerDeps {
  store: ReportStoreAccessor;
  objects: ObjectStoreAccessor;
  queue: ReportQueueAccessor;
  crypto: ReportCryptoAccessor;
  tokens: PartyTokenAccessor;
  runtime: ReportRuntimeAccessor;
  /** Jira as the caller: the field list, the scope search and the visibility check. */
  userJira: JiraReportAccessor;
  /** Jira as the app: the job's reads (only its stored ids), the existence check, scheduled scope searches. */
  appJira: JiraReportAccessor;
  /** Jira as the app: remote links of the job's issues, for the Intent check. */
  appIssues: JiraIssueAccessor;
  /** People as the caller: names for the list and the people file, the caller's groups. */
  people: ReportPeopleAccessor;
  siteConfig: SiteConfigAccessor;
  settings: SettingsAccessor;
  sources: SourcePolicyEngine;
  gates: GateEngine;
  metrics: MetricsEngine;
  events: ExceptionEventAccessor;
  notes: ReworkNoteAccessor;
  lifecycle: ExceptionPolicyEngine;
  history: AttestationHistoryAccessor;
  engine: ReportEngine;
  policy: ReportPolicyEngine;
  /** End of a resolver invocation (25 s Forge limit, less a reserve). */
  deadline: number;
  now?: () => Date;
}

export const BROWSE_DENIED_TEXT = 'FourRealities: you need the Browse projects Jira permission on this project to see its evidence reports.';
export const CHECK_FAILED_TEXT = 'FourRealities could not check your Jira permissions for this project, so nothing is shown. Try again.';
export const NOT_AUTHOR_TEXT = 'Only a project administrator, a Jira administrator or a member of an evidence report group can make a report.';
export const NOT_SCHEDULER_TEXT = 'Only a project administrator or a Jira administrator can set report schedules.';
export const NOT_DELETER_TEXT = 'Only a Jira administrator can delete a report before it expires.';
export const LICENCE_TEXT = 'The FourRealities licence for this site is not active, so no new reports are made. Existing reports can still be viewed and downloaded.';
export const NOT_READY_TEXT = 'This report is not ready to download.';
export const NO_KEY_TEXT = 'FourRealities has no valid signing key for this site, so it makes no report. Contact Asymm Systems support (security@asymm.systems).';
export const PEOPLE_NOTE = 'Not signed. Maps each party token of the report to an account id and a display name, read as you when you downloaded it. A closed account shows as a former user. Removed 24 to 25 hours after the download.';

/** Time a consumer event keeps for saving the job and pushing the next event. */
export const EVENT_RESERVE_MS = 60_000;
/** Time the assembly of a 50 MB report needs (spike S-3: about 30 s for reading the parts, building and writing). */
export const ASSEMBLE_RESERVE_MS = 180_000;
export const RETRY_DELAY_SECONDS = 30;
/** Refusals of a scheduled period that are tried again the next day; others are final and get a FAILED row. */
const RETRY_LATER: ReportErrorCode[] = ['JIRA_ERROR', 'JOB_LIMIT', 'REPORT_LIMIT', 'NO_SIGNING_KEY'];

const FILES: ReportFileName[] = ['manifest.json', 'report.json', 'report.csv'];
const MEDIA: Record<ReportFileName, string> = { 'manifest.json': 'application/json', 'report.json': 'application/json', 'report.csv': 'text/csv; charset=utf-8' };
const FILE_KEY = /^reports\/(\d+)\/([0-9a-f-]{36})\/(manifest\.json|report\.json|report\.csv)$/;
const PEOPLE_KEY = /^people:([0-9a-f-]{36}):(json|csv)$/;

const fail = (code: ReportErrorCode, message: string, extra: Partial<ReportError> = {}): { ok: false; error: ReportError } => ({ ok: false, error: { code, message, ...extra } });

/** A failed step of a job: the code that the job records. */
class JobStepError extends Error {
  constructor(readonly code: string, message: string) {
    super(message);
  }
}

export const objectKey = (projectId: string, reportId: string, file: ReportFileName) => `reports/${projectId}/${reportId}/${file}`;
const partKey = (reportId: string, i: number) => `tmp/${reportId}/part-${i}.json`;
const idOf = (entry: string) => entry.split(':')[0];

export class DefaultEvidenceReportManager implements EvidenceReportManager, ReportJobManager {
  readonly serviceType = 'manager' as const;

  constructor(private readonly d: EvidenceReportManagerDeps) {}

  private now(): Date {
    return (this.d.now || (() => new Date()))();
  }

  /** The common refusal: no project, no answer from Jira, or no Browse projects. */
  private guard(caller: ReportCaller, p: ReportPermissions): { ok: false; error: ReportError } | undefined {
    if (!caller.projectKey || !caller.projectId) return fail('INVALID_INPUT', 'FourRealities: open this page from a Jira project.');
    if (p.status !== 200) return fail('JIRA_ERROR', CHECK_FAILED_TEXT, p.status ? { status: p.status } : {});
    if (!p.browse) return fail('FORBIDDEN', BROWSE_DENIED_TEXT);
    return undefined;
  }

  /** Tier 2 (owner decision Q2): the caller is in a report group set on the admin page. */
  private async inReportGroup(settings: ReportSettings): Promise<boolean> {
    if (settings.reportGroups.length === 0) return false;
    const mine = await this.d.people.myGroupIds();
    if (mine.status !== 200) return false;
    const groups = new Set(settings.reportGroups.map(g => g.partyId));
    return mine.groupIds.some(g => groups.has(g));
  }

  private async rightsOf(p: ReportPermissions, settings: ReportSettings) {
    const tier1 = this.d.policy.rights(p, false);
    return tier1.canCreate ? tier1 : this.d.policy.rights(p, await this.inReportGroup(settings));
  }

  private async fieldList(): Promise<FieldInfo[] | undefined> {
    const res = await this.d.userJira.fields();
    return res.status === 200 ? res.fields : undefined;
  }

  // ---------------------------------------------------------------- resolvers

  async list(caller: ReportCaller, p: ReportPermissions, payload: unknown): Promise<ReportResult<ReportsView>> {
    const refused = this.guard(caller, p);
    if (refused) return refused;
    const projectKey = String(caller.projectKey);
    const settings = await this.d.store.getSettings();
    const rights = await this.rightsOf(p, settings);
    const projectId = String(caller.projectId);
    // The project's current key, so a renamed project's schedules show its new key (review N-2). Only a project
    // that has reports or schedules is in the registry: opening the tab does not add one (review R3-6).
    const known = await this.d.store.projectKey(projectId);
    const index = await this.d.store.getIndex(projectId);
    const schedules = await this.d.store.getSchedules(projectId);
    // A project with reports or schedules but no registry key (for example a failed registration) is added
    // again, so the daily run covers its retention, schedules and stalled jobs (review R4-1).
    const hasRecords = index.length > 0 || schedules.length > 0;
    if ((known !== undefined || hasRecords) && known !== projectKey) await this.d.store.registerProject(projectId, projectKey);
    const offset = Math.max(0, Number((payload as { cursor?: unknown } | undefined)?.cursor) || 0);
    const page = index.slice(offset, offset + REPORT_LIMITS.pageSize);
    const fields = rights.canCreate || rights.canSchedule ? (await this.fieldList()) || [] : [];
    return {
      ok: true,
      projectKey,
      reports: await this.rows(caller, page, settings),
      schedules,
      tombstones: await this.d.store.listTombstones(projectId),
      canCreate: rights.canCreate && caller.licenceActive && !this.cannotSign(),
      ...(this.cannotSign() ? { cannotCreateReason: NO_KEY_TEXT } : {}),
      canSchedule: rights.canSchedule,
      canDelete: rights.canDelete,
      licenceActive: caller.licenceActive,
      retentionDays: settings.retentionDays,
      signingKeyId: this.d.crypto.keyId(),
      fields: fields.map(f => ({ id: f.id, name: f.name })).sort((a, b) => a.name.localeCompare(b.name)),
      ...(offset + REPORT_LIMITS.pageSize < index.length ? { next: String(offset + REPORT_LIMITS.pageSize) } : {})
    };
  }

  /** The rows as the viewer sees them: who asked (read as the viewer, never stored), progress and expiry. */
  private async rows(caller: ReportCaller, entries: ReportIndexEntry[], settings: ReportSettings): Promise<ReportListRow[]> {
    const tokens = entries.map(e => e.requestedBy).filter(t => t.startsWith('pty_'));
    const map = tokens.length ? await this.d.tokens.entries(tokens) : {};
    const ids = Object.values(map).flatMap(e => (e && 'accountId' in e ? [e.accountId] : []));
    const names = ids.length ? await this.d.people.people(ids.filter(id => id !== caller.accountId)) : {};
    const out: ReportListRow[] = [];
    for (const e of entries) {
      const party = map[e.requestedBy];
      let requestedByText = 'Scheduled';
      if (e.trigger === 'user') {
        if (!party || !('accountId' in party)) requestedByText = 'a former user';
        else if (party.accountId === caller.accountId) requestedByText = 'by you';
        else requestedByText = names[party.accountId]?.displayName || 'Name not available';
      }
      // No issue or change counts in the list: a viewer may not see every issue of a report (review L-8, D-4).
      const { issues: _issues, changes: _changes, ...shown } = e;
      const row: ReportListRow = { ...shown, requestedByText };
      if (e.state === 'DONE') {
        row.expiresAt = this.d.policy.expiresAt(e.finishedAt || e.createdAt, settings.retentionDays);
        row.objectKeys = Object.fromEntries(FILES.map(f => [f, objectKey(String(caller.projectId), e.reportId, f)]));
      }
      if (e.state === 'QUEUED' || e.state === 'RUNNING') row.progress = (await this.d.store.getJob(e.reportId))?.progress;
      out.push(row);
    }
    return out;
  }

  async create(caller: ReportCaller, p: ReportPermissions, payload: unknown): Promise<ReportResult<{ reportId: string; state: 'QUEUED' }>> {
    if (!caller.licenceActive) return fail('LICENSE_INACTIVE', LICENCE_TEXT);
    const refused = this.guard(caller, p);
    if (refused) return refused;
    const settings = await this.d.store.getSettings();
    if (!(await this.rightsOf(p, settings)).canCreate) return fail('NOT_REPORT_AUTHOR', NOT_AUTHOR_TEXT);
    const fields = await this.fieldList();
    if (!fields) return fail('JIRA_ERROR', 'FourRealities could not read the fields of this site. Try again.');
    const input = this.d.policy.validateCreate(payload, fields, this.now());
    if ('error' in input) return { ok: false, error: input.error };
    return this.enqueue({
      projectKey: String(caller.projectKey),
      projectId: String(caller.projectId),
      range: input.range,
      filters: { fieldIds: input.fieldIds, actors: [] },
      people: { accountId: caller.accountId, actorAccountIds: input.actorAccountIds },
      trigger: 'user',
      requestedBy: 'unknown',
      jira: this.d.userJira,
      deadline: this.d.deadline
    });
  }

  /** Party tokens for the caller and the people filter, made only after every refusal (review L-6). */
  private async tokensOfPeople(people: { accountId?: string; actorAccountIds: string[] }): Promise<{ requestedBy: string; actors: string[] }> {
    const tokenOf = await this.d.tokens.tokensFor([String(people.accountId || ''), ...people.actorAccountIds], this.now().toISOString());
    return { requestedBy: people.accountId ? tokenOf[people.accountId] : 'unknown', actors: people.actorAccountIds.map(id => tokenOf[id]).sort() };
  }

  /** Searches the scope, writes the job, its ids and its index entry, then queues it. Nothing is stored on a refusal. */
  /** True when this production site cannot sign: then no report is made at all (review N-7). */
  private cannotSign(): boolean {
    return this.d.crypto.keyRefused() || (this.d.runtime.environment() === 'production' && !this.d.crypto.keyId());
  }

  private async enqueue(r: { projectKey: string; projectId: string; range: ReportRange; filters: ReportFilters; people?: { accountId?: string; actorAccountIds: string[] }; trigger: ReportJob['trigger']; requestedBy: string; scheduleId?: string; jira: JiraReportAccessor; deadline: number }): Promise<ReportResult<{ reportId: string; state: 'QUEUED' }>> {
    if (this.cannotSign()) return fail('NO_SIGNING_KEY', NO_KEY_TEXT);
    const index = await this.d.store.getIndex(r.projectId);
    const limit = this.d.policy.jobLimit(index);
    if (limit) return { ok: false, error: limit };
    const admitted = this.d.policy.admit(index);
    if ('error' in admitted) return { ok: false, error: admitted.error };
    const found = await r.jira.searchIds(this.d.engine.scopeJql(r.projectId, r.range), REPORT_LIMITS.maxIssues, r.deadline);
    if (found.status !== 200) return fail('JIRA_ERROR', `FourRealities could not search the issues of this project (HTTP ${found.status}). Try again.`, { status: found.status });
    if (found.ids.length > REPORT_LIMITS.maxIssues) {
      return fail('TOO_MANY_ISSUES', `More than ${REPORT_LIMITS.maxIssues.toLocaleString('en-US')} issues may be in this range, so no report was made. Choose a shorter range.`);
    }
    if (r.people) {
      const t = await this.tokensOfPeople(r.people);
      r = { ...r, requestedBy: t.requestedBy, filters: { ...r.filters, actors: t.actors } };
    }
    // Strictly after the newest entry, so the index order is the order of creation, also within one millisecond.
    const newest = index[0] ? Date.parse(index[0].createdAt) : NaN;
    const now = new Date(Number.isFinite(newest) ? Math.max(this.now().getTime(), newest + 1) : this.now().getTime()).toISOString();
    const reportId = this.d.crypto.newId();
    // Each id with its key, so an issue the job cannot read later is still named (review N-1).
    const idEntries = found.ids.map(id => (found.keys[id] ? `${id}:${found.keys[id]}` : id));
    try {
      const idChunks = await this.d.store.saveIds(reportId, idEntries);
      const job: ReportJob = {
        schemaVersion: 1,
        reportId,
        projectId: r.projectId,
        projectKey: r.projectKey,
        range: r.range,
        filters: r.filters,
        trigger: r.trigger,
        requestedBy: r.requestedBy,
        ...(r.scheduleId ? { scheduleId: r.scheduleId } : {}),
        state: 'QUEUED',
        cursor: 0,
        parts: 0,
        idChunks,
        failures: 0,
        progress: { issuesTotal: found.ids.length, issuesDone: 0, changes: 0, linksNotRead: 0, notReadable: 0 },
        createdAt: now,
        updatedAt: now
      };
      await this.d.store.saveJob(job);
      const entry: ReportIndexEntry = { reportId, state: 'QUEUED', range: r.range, filters: r.filters, trigger: r.trigger, requestedBy: r.requestedBy, createdAt: now };
      // One write per entry: the new report's own key, and the removal of the entry that made room (review M-1).
      for (const gone of index.filter(e => !admitted.entries.includes(e))) await this.d.store.deleteEntry(r.projectId, gone);
      // Registered before the entry is written, so a failure between the two never leaves a report outside the daily run.
      await this.d.store.registerProject(r.projectId, r.projectKey);
      await this.d.store.putEntry(r.projectId, entry);
    } catch (failure) {
      // A create that fails before its index entry is written leaves no job record and no id chunk (review R5-3).
      await this.d.store.deleteIds(reportId, Math.ceil(idEntries.length / REPORT_LIMITS.idsPerValue));
      await this.d.store.deleteJob(reportId);
      throw failure;
    }
    await this.d.queue.push(reportId);
    return { ok: true, reportId, state: 'QUEUED' };
  }

  /** The report's issues that the viewer cannot see now (checked as the viewer), and those deleted since. */
  private async visibility(job: ReportJob, isTier1: boolean): Promise<DownloadDecision> {
    // A moved issue still exists, and the files name it: the downloader must be able to see it too (review R3-3).
    const moved = (await this.d.store.loadNotReadable(job.reportId, job.notReadableChunks || 0)).filter(n => n.reason === 'MOVED').map(n => n.issueId);
    const ids = [...(await this.d.store.loadIds(job.reportId, job.idChunks)).map(idOf), ...moved];
    const seen = await this.d.userJira.presentAmong(ids, this.d.deadline);
    if (!seen) return { allowed: false, code: 'JIRA_ERROR', message: 'FourRealities could not check which issues of this report you can see. Try again.' };
    const notSeen = ids.filter(id => !seen.has(id));
    let hidden = 0;
    if (notSeen.length > 0) {
      // As the app, after the caller's check: which of the issues the caller cannot see still exist.
      const existing = await this.d.appJira.presentAmong(notSeen, this.d.deadline);
      if (!existing) return { allowed: false, code: 'JIRA_ERROR', message: 'FourRealities could not check the issues of this report. Try again.' };
      hidden = existing.size;
    }
    return this.d.policy.download({ total: ids.length, hidden, deleted: notSeen.length - hidden, isTier1 });
  }

  /** The report of the context project, or undefined. */
  private async ownJob(caller: ReportCaller, reportId: unknown): Promise<{ job?: ReportJob; entry?: ReportIndexEntry }> {
    if (!this.d.policy.isReportId(reportId)) return {};
    const entry = (await this.d.store.getIndex(String(caller.projectId))).find(e => e.reportId === reportId);
    if (!entry) return {};
    const job = await this.d.store.getJob(reportId);
    // The project id decides; a renamed project keeps its reports (review N-2).
    return { entry, ...(job && job.projectId === caller.projectId ? { job } : {}) };
  }

  async detail(caller: ReportCaller, p: ReportPermissions, payload: unknown): Promise<ReportResult<ReportDetail>> {
    const refused = this.guard(caller, p);
    if (refused) return refused;
    const { job, entry } = await this.ownJob(caller, (payload as { reportId?: unknown } | undefined)?.reportId);
    if (!entry) return fail('NOT_FOUND', 'FourRealities found no such report in this project.');
    const settings = await this.d.store.getSettings();
    const [report] = await this.rows(caller, [entry], settings);
    const fileNames = Object.fromEntries(
      [...FILES, 'people.json', 'people.csv'].map(f => [f, this.d.engine.fileName(String(caller.projectKey), entry.range, entry.reportId, f)])
    ) as ReportDetail['fileNames'];
    if (entry.state !== 'DONE' || !job) return { ok: true, report, fileNames, download: { allowed: false, code: 'REPORT_NOT_READY', message: NOT_READY_TEXT } };
    const text = await this.d.objects.readText(objectKey(job.projectId, job.reportId, 'manifest.json'));
    const manifest = text ? (JSON.parse(text) as ReportManifest) : undefined;
    const download = await this.visibility(job, this.d.policy.rights(p, false).isTier1);
    // The manifest, and the issues not in the report with their keys, only for a viewer who may download it
    // (reviews L-8 and R3-1).
    // Every missing issue is named, one page at a time, and each page is behind the same check (owner decision R4-3).
    const all = download.allowed && job.notReadableChunks ? await this.d.store.loadNotReadable(job.reportId, job.notReadableChunks) : [];
    const size = REPORT_LIMITS.notReadPageSize;
    const last = Math.max(0, Math.ceil(all.length / size) - 1);
    const page = Math.min(last, Math.max(0, Math.floor(Number((payload as { notReadPage?: unknown } | undefined)?.notReadPage) || 0)));
    const named = all.length ? { notReadable: all.slice(page * size, (page + 1) * size), notReadablePage: { page, pageSize: size, total: all.length } } : {};
    return { ok: true, report, fileNames, download, ...(manifest && download.allowed ? { manifest } : {}), ...named };
  }

  async downloadUrls(caller: ReportCaller, p: ReportPermissions, payload: unknown): Promise<Record<string, string>> {
    if (this.guard(caller, p)) return {};
    const keys = (payload as { keys?: unknown } | undefined)?.keys;
    if (!Array.isArray(keys) || keys.length === 0 || keys.length > 5 || !keys.every(k => typeof k === 'string')) return {};
    const parsed = (keys as string[]).map(key => {
      const file = FILE_KEY.exec(key);
      if (file) return { key, reportId: file[2], projectId: file[1], people: undefined };
      const people = PEOPLE_KEY.exec(key);
      return people ? { key, reportId: people[1], projectId: String(caller.projectId), people: people[2] as 'json' | 'csv' } : undefined;
    });
    if (parsed.some(k => !k || k.projectId !== caller.projectId) || new Set(parsed.map(k => k?.reportId)).size !== 1) return {};
    const { job } = await this.ownJob(caller, parsed[0]?.reportId);
    if (!job || job.state !== 'DONE') return {};
    if (!(await this.visibility(job, this.d.policy.rights(p, false).isTier1)).allowed) return {};
    const out: Record<string, string> = {};
    let people: Record<'json' | 'csv', string> | undefined;
    for (const k of parsed) {
      if (!k) continue;
      if (k.people) people = people || (await this.peopleFile(job));
      const target = k.people ? people?.[k.people] : k.key;
      const url = target ? await this.d.objects.downloadUrl(target) : undefined;
      if (url) out[url] = k.key;
    }
    return out;
  }

  /** The unsigned people file (HLD 3.5): tokens to account ids from the token map, names read as the caller. */
  private async peopleFile(job: ReportJob): Promise<Record<'json' | 'csv', string> | undefined> {
    const tokens = await this.d.store.loadTokens(job.reportId, job.tokenChunks || 0);
    const entries = await this.d.tokens.entries(tokens);
    const ids = Object.values(entries).flatMap(e => (e && 'accountId' in e ? [e.accountId] : []));
    const people = await this.d.people.people(ids);
    const rows: PeopleRow[] = tokens.map(token => {
      const e = entries[token];
      if (!e || !('accountId' in e)) return { token, accountId: null, displayName: null, active: null };
      const person = people[e.accountId];
      return { token, accountId: e.accountId, displayName: person?.displayName ?? null, active: person ? person.active : null };
    });
    const createdAt = this.now().toISOString();
    const downloadId = this.d.crypto.newId();
    const keys = { json: `tmp/${job.reportId}/${downloadId}/people.json`, csv: `tmp/${job.reportId}/${downloadId}/people.csv` };
    await this.d.store.addTmp(`${createdAt}:${job.reportId}:${downloadId}`, { objectKeys: [keys.json, keys.csv], createdAt });
    const json = this.d.engine.canonicalJson({ format: 'fourrealities-evidence-report-people/1', reportId: job.reportId, generatedAt: createdAt, note: PEOPLE_NOTE, people: rows });
    const okJson = await this.d.objects.putOnce(keys.json, json, 'application/json');
    const okCsv = await this.d.objects.putOnce(keys.csv, this.d.engine.peopleCsv(rows), 'text/csv; charset=utf-8');
    return okJson && okCsv ? keys : undefined;
  }

  async saveSchedule(caller: ReportCaller, p: ReportPermissions, payload: unknown): Promise<ReportResult<{ schedules: ReportSchedule[] }>> {
    if (!caller.licenceActive) return fail('LICENSE_INACTIVE', LICENCE_TEXT);
    const refused = this.guard(caller, p);
    if (refused) return refused;
    if (!this.d.policy.rights(p, false).canSchedule) return fail('FORBIDDEN', NOT_SCHEDULER_TEXT);
    const fields = await this.fieldList();
    if (!fields) return fail('JIRA_ERROR', 'FourRealities could not read the fields of this site. Try again.');
    const input = this.d.policy.validateSchedule(payload, fields);
    if ('error' in input) return { ok: false, error: input.error };
    const projectId = String(caller.projectId);
    const schedules = await this.d.store.getSchedules(projectId);
    const now = this.now();
    const existing = input.scheduleId ? schedules.find(s => s.scheduleId === input.scheduleId) : undefined;
    if (input.scheduleId && !existing) return fail('NOT_FOUND', 'FourRealities found no such schedule.');
    if (!existing && schedules.length >= REPORT_LIMITS.schedulesPerProject) return fail('INVALID_INPUT', `A project has at most ${REPORT_LIMITS.schedulesPerProject} schedules.`);
    const t = await this.tokensOfPeople({ accountId: caller.accountId, actorAccountIds: input.actorAccountIds });
    const filters: ReportFilters = { fieldIds: input.fieldIds, actors: t.actors };
    const schedule: ReportSchedule = existing
      ? { ...existing, cadence: input.cadence, filters }
      : { scheduleId: this.d.crypto.newId(), cadence: input.cadence, filters, createdBy: t.requestedBy, createdAt: now.toISOString() };
    const next = existing ? schedules.map(s => (s.scheduleId === schedule.scheduleId ? schedule : s)) : [...schedules, schedule];
    await this.d.store.saveSchedules(projectId, next);
    await this.d.store.registerProject(projectId, String(caller.projectKey));
    return { ok: true, schedules: next };
  }

  async deleteSchedule(caller: ReportCaller, p: ReportPermissions, payload: unknown): Promise<ReportResult<{ schedules: ReportSchedule[] }>> {
    if (!caller.licenceActive) return fail('LICENSE_INACTIVE', LICENCE_TEXT);
    const refused = this.guard(caller, p);
    if (refused) return refused;
    if (!this.d.policy.rights(p, false).canSchedule) return fail('FORBIDDEN', NOT_SCHEDULER_TEXT);
    const id = (payload as { scheduleId?: unknown } | undefined)?.scheduleId;
    const projectId = String(caller.projectId);
    const schedules = await this.d.store.getSchedules(projectId);
    if (!this.d.policy.isReportId(id) || !schedules.some(s => s.scheduleId === id)) return fail('NOT_FOUND', 'FourRealities found no such schedule.');
    const next = schedules.filter(s => s.scheduleId !== id);
    await this.d.store.saveSchedules(projectId, next);
    return { ok: true, schedules: next };
  }

  async deleteReport(caller: ReportCaller, p: ReportPermissions, payload: unknown): Promise<ReportResult<{ tombstone: ReportTombstone }>> {
    const refused = this.guard(caller, p);
    if (refused) return refused;
    if (!this.d.policy.rights(p, false).canDelete) return fail('FORBIDDEN', NOT_DELETER_TEXT);
    const body = (payload || {}) as { reportId?: unknown; reason?: unknown };
    const reason = this.d.policy.validateReason(body.reason);
    if ('error' in reason) return { ok: false, error: reason.error };
    const { job, entry } = await this.ownJob(caller, body.reportId);
    if (!entry || !job || entry.state !== 'DONE') return fail('NOT_FOUND', 'FourRealities found no stored report with this id in this project.');
    const now = this.now().toISOString();
    const by = caller.accountId ? (await this.d.tokens.tokensFor([caller.accountId], now))[caller.accountId] : 'unknown';
    const tombstone: ReportTombstone = { reportId: job.reportId, deletedAt: now, by, reason: reason.reason };
    // The tombstone is written first, so a delete that stops half way still leaves its record (Q8).
    await this.d.store.addTombstone(job.projectId, tombstone);
    await this.removeStored(job);
    await this.setEntry(job.projectId, job.reportId, { state: 'DELETED' });
    return { ok: true, tombstone };
  }

  // ---------------------------------------------------------------- the job (as the app)

  /** Changes one report's entry; it writes only that entry's key (review M-1). */
  private async setEntry(projectId: string, reportId: string, patch: Partial<ReportIndexEntry>): Promise<ReportIndexEntry | undefined> {
    const entry = (await this.d.store.getIndex(projectId)).find(e => e.reportId === reportId);
    if (!entry) return undefined;
    const next = { ...entry, ...patch };
    await this.d.store.putEntry(projectId, next);
    return next;
  }

  /** Deletes the files, the ids, the tokens and the job of a report. */
  private async removeStored(job: ReportJob): Promise<void> {
    for (const f of FILES) await this.d.objects.delete(objectKey(job.projectId, job.reportId, f));
    await this.d.store.deleteIds(job.reportId, job.idChunks);
    await this.d.store.deleteTokens(job.reportId, job.tokenChunks || 0);
    await this.d.store.deleteNotReadable(job.reportId, job.notReadableChunks || 0);
    await this.d.store.deleteJob(job.reportId);
  }

  private async deleteParts(job: ReportJob): Promise<void> {
    for (let i = 0; i < job.parts; i++) await this.d.objects.delete(partKey(job.reportId, i));
  }

  /** A failed job stores no file (spec v4 invariant 11): parts, ids and the job record go; the index keeps the reason. */
  private async failJob(job: ReportJob, code: string, message: string): Promise<void> {
    await this.deleteParts(job);
    // A job stopped during the assembly may have written some files or tokens already (review L-2).
    for (const f of FILES) await this.d.objects.delete(objectKey(job.projectId, job.reportId, f));
    await this.d.store.deleteTokens(job.reportId, job.tokenChunks || 0);
    await this.d.store.deleteNotReadable(job.reportId, job.notReadableChunks || 0);
    await this.d.store.deleteIds(job.reportId, job.idChunks);
    await this.d.store.deleteJob(job.reportId);
    await this.setEntry(job.projectId, job.reportId, { state: 'FAILED', finishedAt: this.now().toISOString(), error: { code, message } });
  }

  private async siteRunning(): Promise<number> {
    let running = 0;
    for (const projectId of await this.d.store.projects()) running += (await this.d.store.getIndex(projectId)).filter(e => e.state === 'RUNNING').length;
    return running;
  }

  async work(reportId: string, deadline: number, eventId?: string): Promise<void> {
    if (!this.d.policy.isReportId(reportId)) return;
    const job = await this.d.store.getJob(reportId);
    if (!job || (job.state !== 'QUEUED' && job.state !== 'RUNNING')) return;
    const owner = eventId || this.d.crypto.newId();
    // Another event holds the job: try again when its lease ends, never drop the event (review L-1, N-5).
    // The same event delivered again (a retry after a crash) takes the job over.
    if (job.lease && job.lease.owner !== owner && Date.parse(job.lease.until) > Date.now()) {
      await this.d.queue.push(reportId, Math.ceil((Date.parse(job.lease.until) - Date.now()) / 1000) + 5);
      return;
    }
    if (job.state === 'QUEUED') {
      const index = await this.d.store.getIndex(job.projectId);
      if (!this.d.policy.mayStart(index, reportId, await this.siteRunning())) {
        await this.d.store.saveJob({ ...job, updatedAt: this.now().toISOString() });
        await this.d.queue.push(reportId, REPORT_LIMITS.requeueSeconds);
        return;
      }
      const now = this.now().toISOString();
      Object.assign(job, { state: 'RUNNING', step: 'FACTS', startedAt: now, updatedAt: now });
      await this.setEntry(job.projectId, reportId, { state: 'RUNNING' });
    }
    job.lease = { owner, until: new Date(deadline).toISOString() };
    await this.d.store.saveJob(job);
    try {
      await this.advance(job, deadline);
    } catch (failure) {
      const code = failure instanceof JobStepError ? failure.code : 'JOB_FAILED';
      const message = failure instanceof JobStepError ? failure.message : 'FourRealities could not finish this report.';
      job.failures++;
      if (code === 'REPORT_TOO_LARGE' || code === 'STORE_FAILED' || code === 'NO_SIGNING_KEY') {
        await this.failJob(job, code, message);
        return;
      }
      if (job.failures >= REPORT_LIMITS.maxStepFailures) {
        await this.failJob(job, code, `FourRealities could not read Jira for this report three times (${message}) Make the report again.`);
        return;
      }
      await this.d.store.saveJob({ ...job, lease: undefined, updatedAt: this.now().toISOString() });
      await this.d.queue.push(reportId, RETRY_DELAY_SECONDS);
    }
  }

  /** Reads batch after batch inside the event budget, then assembles; the cursor is saved after each batch. */
  private async advance(job: ReportJob, deadline: number): Promise<void> {
    const config = await this.d.siteConfig.get();
    const fieldsRes = await this.d.appJira.fields();
    if (fieldsRes.status !== 200) throw new JobStepError('JIRA_ERROR', `Jira field list failed with HTTP ${fieldsRes.status}.`);
    const sources = this.d.sources.resolve(await this.d.settings.getSettings(), await this.d.settings.getDetected(), config);
    const history = await this.d.history.listAll();
    const events = await this.d.events.listAll();
    const notes = await this.d.notes.listAll();
    const entries = await this.d.store.loadIds(job.reportId, job.idChunks);
    const ids = entries.map(idOf);
    const keyOf = new Map(entries.map(e => [idOf(e), e.slice(idOf(e).length + 1)]));
    const size = REPORT_LIMITS.batchSize;
    while (job.cursor * size < ids.length) {
      if (Date.now() > deadline - EVENT_RESERVE_MS) return this.pause(job);
      const batch = ids.slice(job.cursor * size, (job.cursor + 1) * size);
      job.step = 'FACTS';
      const read = await this.d.appJira.factsByIds(batch, config);
      if (read.status !== 200) throw new JobStepError('JIRA_ERROR', `Jira search failed with HTTP ${read.status}.`);
      // Every id of the batch is in the report, or listed as not readable or moved: none is left out silently (review H-1).
      const returned = new Set(read.issues.map(i => i.basics.issueId));
      // Moved means another project id: a renamed project keeps its id, so its issues are not moved (review N-2).
      const moved = read.issues.filter(i => i.basics.projectId !== undefined && i.basics.projectId !== job.projectId);
      const notReadable: NotReadableIssue[] = [
        ...batch.filter(id => !returned.has(id)).map(issueId => ({ issueId, issueKey: keyOf.get(issueId) || '', reason: 'NOT_READABLE' as const })),
        ...moved.map(i => ({ issueId: i.basics.issueId, issueKey: keyOf.get(i.basics.issueId) || i.basics.issueKey, reason: 'MOVED' as const }))
      ];
      const facts = { issues: read.issues.filter(i => !moved.includes(i)) };
      const started = facts.issues.filter(i => i.facts.started).map(i => i.facts.issueId);
      const links = await this.d.appIssues.remoteLinks(started, deadline - EVENT_RESERVE_MS);
      // A link read cut by time is not a result: the batch is read again in the next event.
      if (started.some(id => !links.has(id)) && Date.now() > deadline - EVENT_RESERVE_MS) return this.pause(job);
      job.step = 'CHANGES';
      const logs = await this.d.appJira.changelogs(facts.issues.map(i => i.basics.issueId), job.filters.fieldIds, deadline - EVENT_RESERVE_MS);
      if (logs.status !== 200) throw new JobStepError('JIRA_ERROR', `Jira changelog read failed with HTTP ${logs.status}.`);
      job.step = 'PARTS';
      const issues = await this.batchIssues(job, facts.issues, logs.byIssue, links, fieldsRes.fields, sources, history, events, notes);
      const part: ReportPart = { issues, notReadable };
      if (!(await this.d.objects.putOnce(partKey(job.reportId, job.parts), this.d.engine.canonicalJson(part), 'application/json'))) {
        throw new JobStepError('STORE_FAILED', 'FourRealities could not store a part of this report.');
      }
      job.parts++;
      job.cursor++;
      job.failures = 0;
      job.progress = {
        ...job.progress,
        issuesDone: Math.min(ids.length, job.cursor * size),
        changes: job.progress.changes + issues.reduce((n, i) => n + i.changes.length, 0),
        linksNotRead: job.progress.linksNotRead + started.filter(id => !links.has(id)).length,
        notReadable: (job.progress.notReadable || 0) + notReadable.length
      };
      job.updatedAt = this.now().toISOString();
      await this.d.store.saveJob(job);
      if (job.progress.changes > REPORT_LIMITS.maxChanges) throw new JobStepError('REPORT_TOO_LARGE', String(this.d.policy.tooLarge([], job.progress.changes)?.message));
    }
    if (Date.now() > deadline - ASSEMBLE_RESERVE_MS) return this.pause(job);
    job.step = 'ASSEMBLE';
    await this.assemble(job, ids, sources, deadline);
  }

  private async pause(job: ReportJob): Promise<void> {
    await this.d.store.saveJob({ ...job, lease: undefined, updatedAt: this.now().toISOString() });
    await this.d.queue.push(job.reportId);
  }

  private async batchIssues(
    job: ReportJob,
    read: Array<{ facts: IssueFacts; basics: ReportIssueBasics }>,
    logs: Map<string, ChangelogEntry[]>,
    links: Map<string, RemoteLink[]>,
    fields: FieldInfo[],
    sources: SourcesInUse,
    history: Map<string, AttestationHistory>,
    events: Map<string, GateExceptionEvent[]>,
    notes: Map<string, ReworkNote[]>
  ): Promise<ReportIssue[]> {
    const accountIds = read.flatMap(r => this.d.engine.accountIdsOf(logs.get(r.facts.issueId) || [], fields, events.get(r.facts.issueId) || [], notes.get(r.facts.issueId) || []));
    const tokenOf = await this.d.tokens.tokensFor(accountIds, this.now().toISOString());
    const out: ReportIssue[] = [];
    for (const { facts: base, basics } of read) {
      const id = base.issueId;
      const changes = this.d.engine.reportChanges(logs.get(id) || [], job.range, job.filters, fields, tokenOf);
      if (!this.d.engine.inScope(basics.created, changes, job.range)) continue;
      const issueEvents = events.get(id) || [];
      const issueNotes = notes.get(id) || [];
      const facts = {
        ...base,
        attestationHistory: history.get(id) || {},
        reworkNotes: issueNotes,
        codeException: this.d.lifecycle.currentState(issueEvents),
        remoteLinks: links.get(id) ?? (base.started ? undefined : [])
      };
      const gates = this.d.gates.evaluate(facts, sources);
      const row = this.d.metrics.buildRow(facts, gates);
      out.push(this.d.engine.reportIssue({ facts, basics, gates, rai: row.rai, risk: row.risk, events: issueEvents, notes: issueNotes, changes, tokenOf }));
    }
    return out;
  }

  /** Reads the parts, builds and checks the files, signs the manifest, stores the files once, then commits. */
  private async assemble(job: ReportJob, ids: string[], sources: SourcesInUse, deadline: number): Promise<void> {
    const issues: ReportIssue[] = [];
    const notReadable: NotReadableIssue[] = [];
    for (let i = 0; i < job.parts; i++) {
      const text = await this.d.objects.readText(partKey(job.reportId, i));
      if (text === undefined) throw new JobStepError('JOB_FAILED', 'A part of this report could not be read.');
      const part = JSON.parse(text) as ReportPart | ReportIssue[];
      issues.push(...(Array.isArray(part) ? part : part.issues));
      if (!Array.isArray(part)) notReadable.push(...part.notReadable);
    }
    const changes = issues.reduce((n, i) => n + i.changes.length, 0);
    const config = await this.d.siteConfig.get();
    const head = (await this.d.store.getHead(job.projectId)) || null;
    const missing = await this.missingSince(head, deadline);
    const keyId = this.d.crypto.keyId();
    if (this.d.crypto.keyRefused() || (!keyId && this.d.runtime.environment() === 'production')) throw new JobStepError('NO_SIGNING_KEY', NO_KEY_TEXT);
    const header: ManifestHeader = {
      format: 'fourrealities-evidence-report/1',
      reportId: job.reportId,
      siteHost: config.siteHost || '',
      environment: this.d.runtime.environment(),
      projectId: job.projectId,
      projectKey: job.projectKey,
      range: job.range,
      filters: job.filters,
      trigger: job.trigger,
      requestedBy: job.requestedBy,
      generatedAt: this.now().toISOString(),
      gatesObservedAt: job.startedAt || job.createdAt,
      ...(this.d.runtime.appVersion() ? { appVersion: this.d.runtime.appVersion() } : {}),
      counts: { issues: issues.length, changes, missingSincePrevious: missing.length, notReadable: notReadable.length },
      previous: head,
      ...(keyId ? {} : { warning: 'UNSIGNED' as const })
    };
    const json = this.d.engine.reportJson({ header, sourcesInUse: sources, issues, missingSincePrevious: missing, notReadable, linksNotRead: job.progress.linksNotRead });
    const csv = this.d.engine.reportCsv(job.reportId, issues, notReadable);
    const dj = this.d.crypto.digest(json);
    const dc = this.d.crypto.digest(csv);
    const large = this.d.policy.tooLarge([dj.bytes, dc.bytes], changes);
    if (large) throw new JobStepError(large.code, large.message);
    const files: ReportManifest['files'] = [
      { name: 'report.json', mediaType: MEDIA['report.json'], bytes: dj.bytes, sha256: dj.sha256 },
      { name: 'report.csv', mediaType: MEDIA['report.csv'], bytes: dc.bytes, sha256: dc.sha256 }
    ];
    const { manifest, signedText } = this.d.engine.manifest(header, files, keyId);
    const signed = keyId ? this.d.crypto.sign(signedText) : null;
    const manifestText = this.d.engine.canonicalJson(signed ? { ...manifest, sig: signed.sig } : manifest);
    const dm = this.d.crypto.digest(manifestText);
    const bodies: Record<ReportFileName, string> = { 'report.json': json, 'report.csv': csv, 'manifest.json': manifestText };
    for (const f of ['report.json', 'report.csv', 'manifest.json'] as ReportFileName[]) {
      if (!(await this.d.objects.putOnce(objectKey(job.projectId, job.reportId, f), bodies[f], MEDIA[f]))) {
        for (const g of FILES) await this.d.objects.delete(objectKey(job.projectId, job.reportId, g));
        throw new JobStepError('STORE_FAILED', 'FourRealities could not store the files of this report.');
      }
    }
    const tokens = this.d.engine.tokensOf(issues, job.filters, job.requestedBy);
    // The job knows its token chunks before they are written, so a failed commit's clean-up finds them (review N-3).
    job.tokenChunks = Math.ceil(tokens.length / REPORT_LIMITS.tokensPerValue);
    job.notReadableChunks = Math.ceil(notReadable.length / REPORT_LIMITS.idsPerValue);
    await this.d.store.saveJob(job);
    const tokenChunks = await this.d.store.saveTokens(job.reportId, tokens);
    await this.d.store.saveNotReadable(job.reportId, notReadable);
    await this.d.store.deleteIds(job.reportId, job.idChunks);
    const idChunks = await this.d.store.saveIds(job.reportId, issues.map(i => `${i.issueId}:${i.issueKey}`));
    const finishedAt = this.now().toISOString();
    const done: ReportJob = {
      ...job,
      state: 'DONE',
      step: 'ASSEMBLE',
      idChunks,
      tokenChunks,
      finishedAt,
      updatedAt: finishedAt,
      progress: { ...job.progress, issuesDone: ids.length, changes, notReadable: notReadable.length },
      lease: undefined,
      files: [
        { name: 'manifest.json', objectKey: objectKey(job.projectId, job.reportId, 'manifest.json'), bytes: dm.bytes, sha256: dm.sha256 },
        ...files.map(f => ({ name: f.name, objectKey: objectKey(job.projectId, job.reportId, f.name), bytes: f.bytes, sha256: f.sha256 }))
      ],
      manifestSha256: dm.sha256,
      previous: head,
      ...(signed ? { keyId: signed.keyId } : {})
    };
    const current = (await this.d.store.getIndex(job.projectId)).find(e => e.reportId === job.reportId);
    if (!current) throw new JobStepError('STORE_FAILED', 'The index entry of this report is missing.');
    const entry: ReportIndexEntry = { ...current, state: 'DONE', finishedAt, issues: issues.length, changes, notReadable: notReadable.length, bytes: dj.bytes + dc.bytes + dm.bytes, reportSha256: dj.sha256, manifestSha256: dm.sha256, ...(signed ? { keyId: signed.keyId } : { unsigned: true }) };
    await this.d.store.commitDone(done, job.projectId, entry, { reportId: job.reportId, manifestSha256: dm.sha256 });
    await this.deleteParts(done);
  }

  /** The issues of the previous report that the app can no longer read (deleted or moved away). */
  private async missingSince(head: ChainLink | null, deadline: number): Promise<Array<{ issueId: string; issueKey: string }>> {
    if (!head) return [];
    const previous = await this.d.store.getJob(head.reportId);
    if (!previous || previous.state !== 'DONE') return [];
    const entries = await this.d.store.loadIds(previous.reportId, previous.idChunks);
    const present = await this.d.appJira.presentAmong(entries.map(idOf), deadline);
    if (!present) throw new JobStepError('JIRA_ERROR', 'FourRealities could not check the issues of the previous report.');
    return entries.filter(e => !present.has(idOf(e))).map(e => ({ issueId: idOf(e), issueKey: e.slice(idOf(e).length + 1) }));
  }

  // ---------------------------------------------------------------- the daily run (as the app)

  async daily(deadline: number, licenceActive: boolean): Promise<ReportDailyResult> {
    const result: ReportDailyResult = { scheduled: 0, expired: 0, tmpDeleted: 0, stalled: 0, skipped: false };
    const now = this.now();
    const settings = await this.d.store.getSettings();
    // Temporary files first, so a long project loop never delays them (review L-3); the hourly run sweeps too.
    const swept = await this.sweepTmp(deadline);
    result.tmpDeleted = swept.deleted;
    result.skipped = swept.skipped;
    for (const projectId of await this.d.store.projects()) {
      if (Date.now() >= deadline) {
        result.skipped = true;
        break;
      }
      try {
        await this.dailyProject(projectId, now, settings, licenceActive, deadline, result);
      } catch {
        // One project's failure never stops the others; the next day tries again.
      }
    }
    return result;
  }

  /** Removes the temporary people files older than 24 hours. Run every hour, so a file lives at most 25 hours. */
  async sweepTmp(deadline: number): Promise<{ deleted: number; skipped: boolean }> {
    const now = this.now().getTime();
    let deleted = 0;
    for (const { id, entry } of await this.d.store.listTmp()) {
      if (Date.now() >= deadline) return { deleted, skipped: true };
      if (now - Date.parse(entry.createdAt) < REPORT_LIMITS.tmpMaxAgeMs) continue;
      for (const key of entry.objectKeys) await this.d.objects.delete(key);
      await this.d.store.deleteTmp(id);
      deleted++;
    }
    return { deleted, skipped: false };
  }

  private async dailyProject(projectId: string, now: Date, settings: ReportSettings, licenceActive: boolean, deadline: number, result: ReportDailyResult): Promise<void> {
    const index = await this.d.store.getIndex(projectId);
    for (const e of index.filter(x => x.state === 'QUEUED' || x.state === 'RUNNING')) {
      const job = await this.d.store.getJob(e.reportId);
      if (!job || this.d.policy.stalled(job, now)) {
        if (job) await this.failJob(job, 'STALLED', 'FourRealities stopped this report: it made no progress for 2 hours. Make the report again.');
        else await this.setEntry(projectId, e.reportId, { state: 'FAILED', error: { code: 'STALLED', message: 'The job record is missing.' } });
        result.stalled++;
      }
    }
    // Retention (owner decision Q3): a shorter setting applies to existing reports from this run on.
    for (const reportId of this.d.policy.retentionDue(await this.d.store.getIndex(projectId), settings.retentionDays, now)) {
      const job = await this.d.store.getJob(reportId);
      if (job) await this.removeStored(job);
      await this.setEntry(projectId, reportId, { state: 'EXPIRED' });
      result.expired++;
    }
    if (!licenceActive) return;
    // The key the project has now, as the tab last saw it; the scope search uses the id (review N-2).
    const projectKey = await this.d.store.projectKey(projectId);
    if (!projectKey) return;
    const schedules = await this.d.store.getSchedules(projectId);
    let changed = false;
    for (const schedule of schedules) {
      for (const range of this.d.policy.duePeriods(schedule, now)) {
        if (Date.now() >= deadline) break;
        const made = await this.enqueue({ projectKey, projectId, range, filters: schedule.filters, trigger: 'scheduled', requestedBy: 'scheduled', scheduleId: schedule.scheduleId, jira: this.d.appJira, deadline });
        changed = true;
        if (!made.ok && RETRY_LATER.includes(made.error.code)) {
          // A Jira error, a full queue or a full project: the period is kept and tried again tomorrow, and the
          // schedule says why (review M-3).
          schedule.lastRefusal = { code: made.error.code, message: made.error.message, at: now.toISOString(), range };
          break;
        }
        if (made.ok) result.scheduled++;
        else await this.recordRefusal(projectId, range, schedule, made.error);
        schedule.lastPeriodEnd = range.to;
        delete schedule.lastRefusal;
      }
    }
    if (changed) await this.d.store.saveSchedules(projectId, schedules);
  }

  /** A scheduled period that could not be made gets a FAILED row, so the list says why (nothing else is stored). */
  private async recordRefusal(projectId: string, range: ReportRange, schedule: ReportSchedule, error: ReportError): Promise<void> {
    const index = await this.d.store.getIndex(projectId);
    const admitted = this.d.policy.admit(index);
    if ('error' in admitted) return;
    const entry: ReportIndexEntry = { reportId: this.d.crypto.newId(), state: 'FAILED', range, filters: schedule.filters, trigger: 'scheduled', requestedBy: 'scheduled', createdAt: this.now().toISOString(), error: { code: error.code, message: error.message } };
    for (const gone of index.filter(e => !admitted.entries.includes(e))) await this.d.store.deleteEntry(projectId, gone);
    await this.d.store.putEntry(projectId, entry);
  }
}
