/**
 * Copyright (c) 2026 Asymm Systems. All rights reserved.
 * @author Fahim Farook
 * FourRealities: project snapshot use cases: the dashboard view, the on-demand build and the
 * daily scheduled run (spec v2, Snapshot schedule). Orchestration only.
 */

import { IssueFacts, AttestationHistory, CallerContext, CHUNK_SIZE_HINT, IssueRow, ProjectDashboardView, ProjectSummary, ResolverResult, ScheduledRunResult, SiteConfig, SnapshotMeta, StoredSnapshot } from '../contract/data/models';
import { AttestationHistoryAccessor, ConfluencePageCheckAccessor, ExceptionEventAccessor, JiraDirectoryAccessor, ReworkNoteAccessor, JiraIssueAccessor, SettingsAccessor, SiteConfigAccessor, SnapshotAccessor } from '../contract/accessors';
import { ExceptionPolicyEngine, GateEngine, MetricsEngine, SnapshotEngine, SourcePolicyEngine } from '../contract/engines';
import { DashboardManager, SnapshotManager } from '../contract/managers';
import { jiraError, messageOf } from '../contract/data/errors';

export interface SnapshotManagerDeps {
  /** Jira as the app: builds the shared snapshot. */
  jira: JiraIssueAccessor;
  /** Jira as the viewer: the viewer's Browse projects permission and the issues the viewer can browse. */
  viewerJira: JiraIssueAccessor;
  /** Time of the whole invocation, from its start (F-H2). */
  budgetMs: number;
  /** End of the whole invocation; the default is now plus budgetMs when the manager is built. */
  deadline?: number;
  siteConfig: SiteConfigAccessor;
  snapshots: SnapshotAccessor;
  notes: ReworkNoteAccessor;
  events: ExceptionEventAccessor;
  lifecycle: ExceptionPolicyEngine;
  gates: GateEngine;
  metrics: MetricsEngine;
  snapshot: SnapshotEngine;
  settings: SettingsAccessor;
  sources: SourcePolicyEngine;
  /** Confluence as the viewer: checks that the linked pages shown exist (F-H4, MK-02 Q3). Never as the app. */
  confluence: ConfluencePageCheckAccessor;
  /** The newest verified sibling records seen per issue (ADR-012, rollback). */
  history: AttestationHistoryAccessor;
  /** Jira users as the viewer: assignee names for the view. */
  directory: JiraDirectoryAccessor;
  now?: () => Date;
}

/** History writes run in parallel batches of this size (merge review N-1). */
export const HISTORY_BATCH = 25;
/** History writes may run this long past the build deadline, inside VIEW_RESERVE_MS. */
export const HISTORY_GRACE_MS = 3_000;
/** Time a page view keeps after building the snapshot: the KVS writes, the viewer check and the names (F-H2). */
export const VIEW_RESERVE_MS = 7_000;
/** Time the viewer check leaves before the end of the invocation. */
export const VISIBLE_RESERVE_MS = 1_000;

export const BROWSE_DENIED = 'FourRealities: you need the Browse projects Jira permission on this project to see its dashboard.';
export const BROWSE_CHECK_FAILED = 'FourRealities could not check your Jira permissions for this project, so nothing is shown. Refresh to try again.';
export const TREND_WITHHELD = 'The trend counts issues of this project that you cannot see, so it is not shown to you.';

export class DefaultSnapshotManager implements SnapshotManager, DashboardManager {
  readonly serviceType = 'manager' as const;
  private readonly deadline: number;

  constructor(private readonly d: SnapshotManagerDeps) {
    this.deadline = d.deadline ?? Date.now() + d.budgetMs;
  }

  /**
   * Reads the project from Jira, evaluates every issue, and stores the snapshot, the project
   * summary and this week's trend point. Started issues get their remote links read inside the
   * deadline; an issue not reached keeps its previous Intent result, else it needs a re-check.
   * Linked Confluence pages are not checked here: the view checks them as the viewer (MK-02 Q3).
   * A trend point is recorded only for a complete read (not capped, not timed out), with the ids of
   * the issues it counts; when an issue the trend counts has left the project, the trend restarts.
   */
  async build(projectKey: string, generatedBy: string, deadline: number): Promise<ResolverResult<{ meta: SnapshotMeta; rows: IssueRow[]; summary: ProjectSummary }>> {
    const now = this.d.now || (() => new Date());
    let config: SiteConfig;
    try {
      config = await this.d.siteConfig.get();
    } catch (err) {
      return jiraError(undefined, `Live Jira sync failed (${messageOf(err, 'network error')}).`);
    }

    const search = await this.d.jira.searchProject(projectKey, config, deadline);
    if (search.error) {
      return jiraError(search.status, `Live Jira sync failed (${search.error}).`);
    }

    // Sources seen in this read are recorded first, so a first build already uses them (ADR-013).
    const settings = await this.d.settings.getSettings();
    const merged = this.d.sources.merge(await this.d.settings.getDetected(), this.d.sources.sightings(search.facts, now().toISOString()));
    if (merged.changed) await this.d.settings.saveDetected(merged.detected);
    const sources = this.d.sources.resolve(settings, merged.detected, config);

    const history = await this.d.history.listAll();
    const notes = await this.d.notes.listAll();
    const events = await this.d.events.listAll();
    const previous = new Map((await this.d.snapshots.loadSnapshot(projectKey))?.rows.map(r => [r.issueId, r]) || []);
    const started = search.facts.filter(f => f.started).map(f => f.issueId);
    const links = await this.d.jira.remoteLinks(started, deadline);

    const rows = search.facts.map(base => {
      const id = base.issueId;
      const read = links.has(id) || !base.started;
      const facts = {
        ...base,
        attestationHistory: history.get(id) || {},
        reworkNotes: notes.get(id),
        codeException: this.d.lifecycle.currentState(events.get(id) || []),
        remoteLinks: links.get(id) ?? (base.started ? undefined : [])
      };
      const gates = this.d.snapshot.keepPreviousIntent(this.d.gates.evaluate(facts, sources), read, previous.get(id));
      return this.d.snapshot.storedRow(this.d.metrics.buildRow(facts, gates));
    });

    const summary = this.d.metrics.summarize(rows);
    const generatedAt = now().toISOString();
    const meta: SnapshotMeta = {
      schemaVersion: 2,
      projectKey,
      snapshotId: `snap-${now().getTime()}`,
      generatedAt,
      generatedBy,
      chunkCount: Math.ceil(rows.length / CHUNK_SIZE_HINT),
      shownCount: rows.length,
      totalKnown: search.totalKnown,
      capped: search.capped,
      ...(search.timedOut ? { timedOut: true } : {}),
      remoteLinksRead: links.size
    };
    await this.d.snapshots.saveSnapshot(meta, rows, summary);
    if (!search.capped) {
      const ids = rows.map(r => r.issueId);
      const stored = await this.d.snapshots.getTrend(projectKey);
      const restart = !this.d.snapshot.continuesTrend(await this.d.snapshots.getTrendIssueIds(projectKey), stored.length, ids);
      await this.d.snapshots.recordTrendPoint(projectKey, this.d.snapshot.trendPoint(summary, generatedAt), ids, restart);
    }
    await this.d.snapshots.deleteV1ProjectKeys(projectKey);
    await this.raiseHistory(search.facts, history, deadline + HISTORY_GRACE_MS);
    return { ok: true, meta, rows, summary };
  }

  /**
   * Stores the newest verified sibling record per issue (ADR-012 decision 7), after the snapshot is
   * saved, in parallel batches, and only until the given time (merge review N-1). An issue not
   * reached keeps its stored history; the next build or the daily run writes it.
   */
  private async raiseHistory(facts: IssueFacts[], history: Map<string, AttestationHistory>, until: number): Promise<void> {
    const pending = facts
      .map(f => ({ id: f.issueId, current: history.get(f.issueId) || {}, seen: this.d.gates.verifiedVersions({ ...f, attestationHistory: history.get(f.issueId) || {} }) }))
      .filter(p => p.seen.dod || p.seen.ledgerseal);
    for (let i = 0; i < pending.length && Date.now() < until; i += HISTORY_BATCH) {
      await Promise.all(pending.slice(i, i + HISTORY_BATCH).map(p => this.d.history.raise(p.id, p.seen, p.current)));
    }
  }

  /**
   * Daily scheduled run: builds every registered project as the app while the budget lasts,
   * then deletes at most 100 v1 signals keys, converts at most 100 v2 code notes to
   * migrated events and at most 100 v2 rework notes to notes (spec v2, Migration; ADR-001).
   */
  async runScheduled(deadline: number): Promise<ScheduledRunResult> {
    const result: ScheduledRunResult = { built: [], failed: [], skipped: [], signalsDeleted: 0, exceptionsMigrated: 0, reworkNotesMigrated: 0 };
    for (const projectKey of await this.d.snapshots.listProjects()) {
      if (Date.now() >= deadline) {
        result.skipped.push(projectKey);
        continue;
      }
      // One project's failure (for example a storage error) never stops the others (F-L1).
      try {
        const built = await this.build(projectKey, 'scheduled', deadline);
        (built.ok ? result.built : result.failed).push(projectKey);
      } catch {
        result.failed.push(projectKey);
      }
    }
    if (Date.now() < deadline) {
      result.signalsDeleted = await this.d.snapshots.deleteV1Signals();
      result.exceptionsMigrated = await this.d.events.migrateV2CodeNotes(100);
      result.reworkNotesMigrated = await this.d.notes.migrateV2ReworkNotes(100);
    }
    return result;
  }

  /**
   * Reads the stored snapshot and builds one only when none exists (or on refresh); a page
   * view never writes trend history. Every number shown covers only issues the viewer can browse
   * (FR-18, MK-02 Q3): first the viewer's Browse projects permission on the project is checked as
   * the viewer with the permissions REST API (fail closed), before anything is read or built as the
   * app; then the rows, the summary and the coverage come from the issues the viewer's own search
   * returns; the trend is shown only when the viewer can browse every issue it counts; and linked
   * Confluence pages are checked as the viewer.
   */
  async view(caller: CallerContext, rebuild: boolean): Promise<ResolverResult<ProjectDashboardView>> {
    const projectKey = caller.projectKey;
    if (!projectKey) {
      return { ok: false, error: { code: 'INVALID_INPUT', message: 'FourRealities: open this page from a Jira project.' } };
    }
    let browse: { status: number; granted: boolean };
    try {
      browse = await this.d.viewerJira.hasAnyPermission(projectKey, ['BROWSE_PROJECTS']);
    } catch {
      browse = { status: 0, granted: false };
    }
    if (browse.status !== 200) {
      return jiraError(browse.status || undefined, BROWSE_CHECK_FAILED);
    }
    if (!browse.granted) {
      return { ok: false, error: { code: 'FORBIDDEN', message: BROWSE_DENIED } };
    }
    await this.d.snapshots.registerProject(projectKey);

    let stored: StoredSnapshot | undefined = rebuild ? undefined : await this.d.snapshots.loadSnapshot(projectKey);
    const settings = await this.d.settings.getSettings();
    // A snapshot built before the administrator changed the settings is built again (ADR-013).
    if (stored && settings.updatedAt && settings.updatedAt > stored.meta.generatedAt) {
      stored = undefined;
    }
    if (!stored) {
      // No account id in the snapshot (ADR-014). One deadline for the whole invocation; the build
      // stops early enough to leave time for the writes and the viewer check (F-H2).
      const built = await this.build(projectKey, 'user', this.deadline - VIEW_RESERVE_MS);
      if (!built.ok) {
        return built;
      }
      stored = { meta: built.meta, rows: built.rows };
    }

    const trendIds = await this.d.snapshots.getTrendIssueIds(projectKey);
    const wanted = new Set([...stored.rows.map(r => r.issueId), ...(trendIds || [])]);
    const visible = await this.d.viewerJira.visibleIssueIds(projectKey, this.deadline - VISIBLE_RESERVE_MS, wanted);
    if (visible.status !== undefined) {
      return jiraError(visible.status, `FourRealities could not check which issues you can see (HTTP ${visible.status}).`);
    }
    const shownRows = this.d.snapshot.visibleRows(stored.rows, visible.ids);
    const rows = this.d.snapshot.withCheckedPages(shownRows, await this.checkPages(shownRows));
    const seesTrend = Boolean(trendIds) && trendIds!.every(id => visible.ids.has(id));
    const { capped, timedOut } = stored.meta;
    const view: ProjectDashboardView = {
      projectKey,
      generatedAt: stored.meta.generatedAt,
      summary: this.d.metrics.summarize(rows),
      rows,
      trend: seesTrend ? await this.d.snapshots.getTrend(projectKey) : [],
      ...(seesTrend || !trendIds ? {} : { trendWithheld: TREND_WITHHELD }),
      coverage: {
        shown: rows.length,
        // Counted from the issues this viewer is shown. A capped read does not hold every issue, and
        // the project's own count includes issues the viewer may not see, so the total is unknown.
        totalKnown: capped ? null : rows.length,
        capped,
        ...(timedOut ? { timedOut: true } : {})
      }
    };
    // Names of the assignees, read as the viewer now and never stored (ADR-014).
    const assignees = Array.from(new Set(rows.map(r => r.assigneeAccountId).filter((id): id is string => Boolean(id))));
    // Only while the invocation has time left; without names the table says "Name not available" (L-5).
    if (assignees.length > 0 && Date.now() < this.deadline - VISIBLE_RESERVE_MS) view.people = await this.d.directory.userNames(assignees);
    try {
      const detected = await this.d.settings.getDetected();
      const sources = this.d.sources.resolve(settings, detected, await this.d.siteConfig.get());
      view.sources = sources;
      const sourceNotes = this.d.sources.notes(settings, detected, sources);
      if (sourceNotes.length > 0) view.sourceNotes = sourceNotes;
    } catch {
      // The view still shows the stored gates; only the list of checks in use is left out.
    }
    const stale = this.d.snapshot.staleWarning(stored.meta, Date.now());
    if (stale) view.warning = stale;
    if (!visible.complete) {
      view.warning = 'FourRealities could not finish checking which issues you can see. Only the issues it checked are shown.';
    }
    return { ok: true, ...view };
  }

  /** The page ids found by the viewer's Confluence search, or null when it could not be asked. */
  private async checkPages(rows: IssueRow[]): Promise<Set<string> | null> {
    const ids = this.d.snapshot.pagesToCheck(rows);
    if (ids.length === 0) return new Set();
    try {
      return await this.d.confluence.existingPages(ids, this.deadline - VISIBLE_RESERVE_MS);
    } catch {
      return null;
    }
  }
}
