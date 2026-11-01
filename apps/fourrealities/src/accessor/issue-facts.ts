/**
 * Copyright (c) 2026 Asymm Systems. All rights reserved.
 * @author Fahim Farook
 * FourRealities: parses Jira issue JSON into IssueFacts (spec v2, Validator step 1)
 */

import { ExceptionRecord, IssueExceptionRecord, IssueFacts, RemoteLink, StatusCategory } from '../contract/data/models';
import { parseDevField } from './dev-field';
import { JiraChangelogJson, JiraIssueJson, JiraIssueLinkJson, JiraRemoteLinkJson, JiraStatusJson } from './jira-types';

/** Issue properties read in one search or issue call. Only the producers' own keys. */
export const PROPERTY_KEYS = ['ledgerseal-cert', 'definitionguard-dod', 'checklist'];

/**
 * Counts status changes and rework loops from the changelog. A rework loop is a move from a
 * status in category done to one that is not done, or from in progress back to to do. Categories
 * come from the site's status list by status id; status names are never read (B-24, FR-25).
 */
export function analyzeIssueChangelog(changelog: JiraChangelogJson | null | undefined, categories: Readonly<Record<string, StatusCategory>>): { statusChanges: number; reworkLoops: number } {
  let statusChanges = 0;
  let reworkLoops = 0;
  for (const history of changelog?.histories || []) {
    for (const item of history.items || []) {
      if (item.field !== 'status') continue;
      statusChanges++;
      const from = categories[String(item.from)];
      const to = categories[String(item.to)];
      if ((from === 'done' && to !== undefined && to !== 'done') || (from === 'indeterminate' && to === 'new')) {
        reworkLoops++;
      }
    }
  }
  return { statusChanges, reworkLoops };
}

/** Status category key from Jira; falls back to the category name for older payloads. */
export function statusCategoryOf(status: JiraStatusJson | undefined): StatusCategory {
  const key = status?.statusCategory?.key;
  if (key === 'new' || key === 'indeterminate' || key === 'done') {
    return key;
  }
  const name = String(status?.statusCategory?.name || '').toLowerCase();
  if (name === 'done') return 'done';
  if (name === 'to do') return 'new';
  return 'indeterminate';
}

/** Reads a v1 ({type, reason, ...}) or v2 exception record into the v2 shape. */
export function normalizeException(value: unknown): ExceptionRecord | undefined {
  if (!value || typeof value !== 'object') {
    return undefined;
  }
  const record = value as { schemaVersion?: number };
  if (record.schemaVersion === 2) {
    return record as ExceptionRecord;
  }
  const v1 = record as IssueExceptionRecord;
  if (!v1.reason) {
    return undefined;
  }
  const note = { reason: v1.reason, notes: v1.notes, recordedBy: v1.recordedBy, recordedAt: v1.recordedAt };
  return {
    schemaVersion: 2,
    issueId: String(v1.issueId),
    issueKey: String(v1.issueKey),
    ...(v1.type === 'REWORK' ? { rework: note } : { code: note })
  };
}

/** Jira remote link objects to contract RemoteLinks. */
export function normalizeRemoteLinks(raw: JiraRemoteLinkJson[]): RemoteLink[] {
  return raw.map(rl => ({
    url: rl?.object?.url ?? rl?.url,
    title: rl?.object?.title ?? rl?.title,
    applicationType: rl?.application?.type
  }));
}

export interface FactOptions {
  remoteLinks?: JiraRemoteLinkJson[];
  siteHost?: string;
  /** Id of the Development field from the site configuration; null or absent when the site has none. */
  devFieldId?: string | null;
  /** Status id to category key, from the site configuration. */
  statusCategories?: Readonly<Record<string, StatusCategory>>;
}

export function factsFromIssue(iss: JiraIssueJson | undefined, options: FactOptions = {}): IssueFacts {
  const fields = iss?.fields || {};
  const { statusChanges, reworkLoops } = analyzeIssueChangelog(iss?.changelog, options.statusCategories || {});
  const sprintField = Array.isArray(fields.customfield_10020) ? fields.customfield_10020 : [];
  const sprintNames: string[] = [
    ...(fields.sprint?.name ? [String(fields.sprint.name)] : []),
    ...sprintField.map(s => s?.name).filter(Boolean).map(String)
  ];
  const devFieldId = options.devFieldId ?? null;
  // Present means the site has a Development field; an issue response may omit an empty value.
  const devPresent = devFieldId !== null;
  const devRaw = devPresent ? fields[devFieldId as string] : undefined;
  const statusCategory = statusCategoryOf(fields.status);

  return {
    issueId: String(iss?.id),
    issueKey: String(iss?.key),
    summary: String(fields.summary || ''),
    statusName: String(fields.status?.name || ''),
    statusCategory,
    assigneeName: fields.assignee?.displayName,
    sprintNames: Array.from(new Set(sprintNames)),
    updated: fields.updated,
    started: statusCategory !== 'new' || statusChanges > 0,
    statusChanges,
    reworkLoops,
    issueLinks: (Array.isArray(fields.issuelinks) ? fields.issuelinks : []).map((link: JiraIssueLinkJson) => {
      const linked = link.inwardIssue || link.outwardIssue;
      return {
        key: linked?.key,
        summary: linked?.fields?.summary,
        typeName: linked?.fields?.issuetype?.name,
        linkInward: link.type?.inward,
        linkOutward: link.type?.outward
      };
    }),
    remoteLinks: options.remoteLinks === undefined ? undefined : normalizeRemoteLinks(options.remoteLinks),
    siteHost: options.siteHost,
    devField: { present: devPresent, summary: parseDevField(typeof devRaw === 'string' ? devRaw : undefined) },
    properties: {
      ledgerseal: iss?.properties?.['ledgerseal-cert'],
      dod: iss?.properties?.['definitionguard-dod'],
      checklist: iss?.properties?.['checklist']
    }
  };
}
