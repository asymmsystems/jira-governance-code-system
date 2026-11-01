/**
 * Copyright (c) 2026 Asymm Systems. All rights reserved.
 * @author Fahim Farook
 * FourRealities: builds and stores one project snapshot (spec v2, Snapshot schedule).
 */

import { ExceptionRecord, IssueRow, ProjectSummary, ResolverError, SnapshotMeta, TrendPoint } from './domain/models';
import { MetricsEngine } from './domain/metrics-engine';
import { evaluateGates, isStarted } from './domain/gates';
import { factsFromIssue, normalizeException } from './jira/issue-facts';
import { JiraRequest, getSiteConfig } from './jira/site-config';
import { searchProjectIssues } from './jira/search';
import { readRemoteLinks } from './jira/remote-links';
import { jiraError } from './jira/errors';
import { MetricsRepository, StorageProvider } from './storage/metrics-repository';
import { CHUNK_SIZE, SnapshotRepository, weekStartOf } from './storage/snapshot-repository';

export interface BuildOptions {
  projectKey: string;
  storage: StorageProvider;
  request: JiraRequest;
  deadline: number;
  generatedBy: string;
  now?: () => Date;
}

export type BuildResult =
  | { ok: true; meta: SnapshotMeta; rows: IssueRow[]; summary: ProjectSummary }
  | { ok: false; error: ResolverError };

function trendPoint(summary: ProjectSummary, generatedAt: string): TrendPoint {
  const g = summary.gates;
  return {
    weekStart: weekStartOf(generatedAt),
    generatedAt,
    ratedIssues: summary.ratedIssues,
    averageRAI: summary.averageRAI,
    gates: {
      intent: { found: g.intent.found, missing: g.intent.missing },
      process: { found: g.process.found, missing: g.process.missing },
      code: { found: g.code.found, missing: g.code.missing },
      audit: { found: g.audit.found, missing: g.audit.missing }
    },
    startedIssues: summary.startedIssues,
    reworkIssues: summary.reworkIssues
  };
}

async function exceptionsFor(storage: StorageProvider, issueIds: string[]): Promise<Map<string, ExceptionRecord>> {
  if (storage.queryPrefix) {
    return new SnapshotRepository(storage).listExceptions();
  }
  // Storage without a prefix query: one read per issue.
  const repository = new MetricsRepository(storage);
  const result = new Map<string, ExceptionRecord>();
  for (const id of issueIds) {
    const record = normalizeException(await repository.getIssueException(id));
    if (record) result.set(id, record);
  }
  return result;
}

/**
 * Reads the project from Jira, evaluates every issue, and stores the snapshot, the project
 * summary and this week's trend point. Started issues get their remote links read inside the
 * deadline; an issue not reached keeps its previous Intent result, else it needs a re-check.
 */
export async function buildSnapshot(options: BuildOptions): Promise<BuildResult> {
  const { projectKey, storage, request, deadline, generatedBy } = options;
  const now = options.now || (() => new Date());
  const repo = new SnapshotRepository(storage);

  let devFieldId: string | null;
  let siteHost: string | undefined;
  try {
    const config = await getSiteConfig(storage, request);
    devFieldId = config.devFieldId;
    siteHost = config.siteHost || undefined;
  } catch (err: any) {
    return jiraError(undefined, `Live Jira sync failed (${err?.message}).`);
  }

  const search = await searchProjectIssues(projectKey, devFieldId, request, deadline);
  if (search.error) {
    return jiraError(search.status, `Live Jira sync failed (${search.error}).`);
  }

  const ids = search.issues.map(iss => String(iss.id));
  const exceptions = await exceptionsFor(storage, ids);
  const previous = new Map((await repo.loadSnapshot(projectKey))?.rows.map(r => [r.issueId, r]) || []);
  const started = search.issues.filter(iss => isStarted(factsFromIssue(iss))).map(iss => String(iss.id));
  const links = await readRemoteLinks(started, request, deadline);

  const rows = search.issues.map(iss => {
    const id = String(iss.id);
    const remoteLinks = links.get(id) ?? (started.includes(id) ? undefined : []);
    const facts = factsFromIssue(iss, { exception: exceptions.get(id), devFieldId, siteHost, remoteLinks });
    const gates = evaluateGates(facts);
    const before = previous.get(id);
    if (remoteLinks === undefined && before && before.gates.intent.state !== 'NEEDS_RECHECK') {
      gates.intent = before.gates.intent;
    }
    return MetricsEngine.buildRow(facts, gates);
  });

  const summary = MetricsEngine.summarize(rows);
  const generatedAt = now().toISOString();
  const meta: SnapshotMeta = {
    schemaVersion: 2,
    projectKey,
    snapshotId: `snap-${now().getTime()}`,
    generatedAt,
    generatedBy,
    chunkCount: 0,
    shownCount: rows.length,
    totalKnown: search.totalKnown,
    capped: search.capped,
    remoteLinksRead: links.size
  };
  await repo.saveSnapshot(meta, rows, summary);
  await repo.recordTrendPoint(projectKey, trendPoint(summary, generatedAt));
  await repo.deleteV1ProjectKeys(projectKey);
  return { ok: true, meta: { ...meta, chunkCount: Math.ceil(rows.length / CHUNK_SIZE) }, rows, summary };
}
