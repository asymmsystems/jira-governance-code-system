/**
 * Copyright (c) 2026 Asymm Systems. All rights reserved.
 * @author Fahim Farook
 * FourRealities: parses Jira issue JSON into IssueFacts (spec v2, Validator step 1)
 */

import { ExceptionRecord, IssueExceptionRecord, IssueFacts, RemoteLink, StatusCategory } from '../contract/data/models';
import { parseDevField } from './dev-field';

/** Issue properties read in one search or issue call. Only the producers' own keys. */
export const PROPERTY_KEYS = ['ledgerseal-cert', 'definitionguard-dod', 'checklist'];

/**
 * Analyzes issue changelog histories for status transitions and rework bounces.
 * Detects regressions from review/testing/done stages back into development.
 */
export function analyzeIssueChangelog(changelog: any): { statusChanges: number; reworkLoops: number } {
  if (!changelog || !Array.isArray(changelog.histories)) {
    return { statusChanges: 0, reworkLoops: 0 };
  }

  let statusChanges = 0;
  let reworkLoops = 0;

  // Stages that indicate verification or completion
  const reviewCategoryWords = ['review', 'in review', 'qa', 'testing', 'verification', 'uat', 'test'];
  const doneCategoryWords = ['done', 'resolved', 'closed', 'complete', 'completed', 'shipped'];

  // Stages that indicate development rework or reopening
  const reworkTargetWords = ['in progress', 'to do', 'open', 'backlog', 'reopened', 'draft'];

  for (const history of changelog.histories) {
    if (!Array.isArray(history.items)) continue;
    for (const item of history.items) {
      if (item.field === 'status') {
        statusChanges++;
        const fromStatus = String(item.fromString || '').toLowerCase();
        const toStatus = String(item.toString || '').toLowerCase();

        const wasInReviewOrTesting = reviewCategoryWords.some(w => fromStatus.includes(w));
        const wasDone = doneCategoryWords.some(w => fromStatus.includes(w));
        const becameRework = reworkTargetWords.some(w => toStatus.includes(w));

        // Rework bounce: moved from review/testing or done back to open/in progress
        if ((wasInReviewOrTesting || wasDone) && becameRework) {
          reworkLoops++;
        }
      }
    }
  }

  return { statusChanges, reworkLoops };
}

/** Status category key from Jira; falls back to the category name for older payloads. */
export function statusCategoryOf(status: any): StatusCategory {
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
export function normalizeException(record: any): ExceptionRecord | undefined {
  if (!record || typeof record !== 'object') {
    return undefined;
  }
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
export function normalizeRemoteLinks(raw: any[]): RemoteLink[] {
  return raw.map((rl: any) => ({
    url: rl?.object?.url ?? rl?.url,
    title: rl?.object?.title ?? rl?.title,
    applicationType: rl?.application?.type
  }));
}

export interface FactOptions {
  remoteLinks?: any[];
  siteHost?: string;
  /** Id of the Development field from the site configuration; null or absent when the site has none. */
  devFieldId?: string | null;
}

export function factsFromIssue(iss: any, options: FactOptions = {}): IssueFacts {
  const fields = iss?.fields || {};
  const { statusChanges, reworkLoops } = analyzeIssueChangelog(iss?.changelog);
  const sprintField = Array.isArray(fields.customfield_10020) ? fields.customfield_10020 : [];
  const sprintNames: string[] = [
    ...(fields.sprint?.name ? [String(fields.sprint.name)] : []),
    ...sprintField.map((s: any) => s?.name).filter(Boolean).map(String)
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
    issueLinks: (Array.isArray(fields.issuelinks) ? fields.issuelinks : []).map((link: any) => {
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
