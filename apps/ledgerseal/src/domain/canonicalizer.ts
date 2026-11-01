/**
 * LedgerSeal: Canonicalization Engine
 * Produces byte-for-byte deterministic normalized representations of Jira issue states.
 */

import { CanonicalAttachment, CanonicalComment, CanonicalField, CanonicalIssueSnapshot } from './models';

/**
 * Deterministic code-unit comparison for string sorting.
 */
function codeUnitCompare(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

function isAdfContentArray(arr: any[]): boolean {
  return arr.length > 0 && arr.some(item => item && typeof item === 'object' && typeof item.type === 'string');
}

/** A field from GET /rest/api/3/field. Only id, name and schema are read. */
export interface FieldSchema {
  id: string;
  name?: string;
  schema?: { type?: string; items?: string; system?: string; custom?: string };
}

const STATUS_REASON = 'The gated transition changes the status. The status at seal is recorded.';
const JIRA_TIME_REASON = 'Jira sets this time itself.';
const DERIVED_REASON = 'Derived from work logs or sub-tasks.';

/**
 * System fields outside the seal, with the reason the panel shows (spec v2 section 4.2).
 * Matched on the field id, which equals schema.system for system fields.
 */
const SYSTEM_EXCLUDED: Record<string, string> = {
  status: STATUS_REASON,
  statuscategory: STATUS_REASON,
  statusCategory: STATUS_REASON,
  statuscategorychangedate: STATUS_REASON,
  statusCategoryChangeDate: STATUS_REASON,
  updated: JIRA_TIME_REASON,
  lastViewed: JIRA_TIME_REASON,
  created: JIRA_TIME_REASON,
  watches: 'Interest counters, not content.',
  votes: 'Interest counters, not content.',
  workratio: DERIVED_REASON,
  progress: DERIVED_REASON,
  aggregateprogress: DERIVED_REASON,
  timespent: DERIVED_REASON,
  aggregatetimespent: DERIVED_REASON,
  timeestimate: DERIVED_REASON,
  aggregatetimeestimate: DERIVED_REASON,
  aggregatetimeoriginalestimate: DERIVED_REASON,
  resolutiondate: 'Set together with Resolution, which is covered.'
};

/**
 * Custom field types outside the seal, matched on schema.custom (spec v2 section 4.2).
 * Any other custom type is covered, so an unknown type can only cause a false alarm, never hide a change.
 */
const CUSTOM_EXCLUDED: Record<string, string> = {
  'com.pyxis.greenhopper.jira:gh-lexo-rank': 'Rank changes on every board drag.',
  'com.pyxis.greenhopper.jira:gh-sprint': 'Sprint changes when a sprint closes.',
  'com.atlassian.servicedesk:sd-sla-field': 'SLA timers change by themselves.',
  'com.atlassian.servicedesk:sd-request-feedback': 'Customer satisfaction is not request content.',
  'com.atlassian.servicedesk:sd-request-feedback-date': 'Customer satisfaction is not request content.',
  'com.atlassian.servicedesk:sd-request-participants': 'Participants change as people join.',
  'com.atlassian.servicedesk.approvals-plugin:sd-approvals': 'Approvals change as approvers decide.',
  'com.atlassian.jira.plugins.jira-development-integration-plugin:devsummarycf': 'Development summary changes with commits.',
  'com.atlassian.jira.ext.charting:timeinstatus': 'Computed by Jira.',
  'com.atlassian.jira.ext.charting:firstresponsedate': 'Computed by Jira.'
};

/** Hashed outside `fields` (top-level keys, attachments and comments), so never listed as excluded. */
const COVERED_ELSEWHERE = new Set(['project', 'issuetype', 'attachment', 'comment']);

function exclusionReason(key: string, schema: FieldSchema | undefined): string | null {
  if (SYSTEM_EXCLUDED[key]) return SYSTEM_EXCLUDED[key];
  const system = schema?.schema?.system;
  if (system && SYSTEM_EXCLUDED[system]) return SYSTEM_EXCLUDED[system];
  const custom = schema?.schema?.custom;
  return custom && CUSTOM_EXCLUDED[custom] ? CUSTOM_EXCLUDED[custom] : null;
}

function normalizeUser(val: any): { accountId: string; displayName: string } {
  return {
    accountId: val.accountId || 'unknown',
    displayName: val.displayName || 'unknown'
  };
}

function isUser(val: any): boolean {
  return Boolean(val && typeof val === 'object' && !Array.isArray(val) && typeof val.accountId === 'string');
}

/**
 * Normalizes entity reference objects to stable identity values,
 * stripping volatile embedded data (avatars, remote issue statuses, URLs).
 */
function normalizeEntityField(key: string, val: any): any {
  if (!val || typeof val !== 'object') return null;

  if (key === 'assignee' || isUser(val)) {
    return normalizeUser(val);
  }

  if (Array.isArray(val) && val.length > 0 && val.every(isUser)) {
    return val.map(normalizeUser).sort((a, b) => codeUnitCompare(a.accountId, b.accountId));
  }

  if (key === 'worklog' && Array.isArray(val.worklogs)) {
    const logs = val.worklogs
      .map((w: any) => ({
        id: String(w.id || ''),
        authorAccountId: String(w.author?.accountId || ''),
        started: String(w.started || ''),
        timeSpentSeconds: Number(w.timeSpentSeconds || 0),
        comment: canonicalizeValue(w.comment)
      }))
      .sort((a: any, b: any) => codeUnitCompare(a.id, b.id));
    return logs.length > 0 ? logs : null;
  }

  if (key === 'priority' || key === 'resolution') {
    return {
      id: val.id || 'unknown',
      name: val.name || 'unknown'
    };
  }

  if (key === 'components' && Array.isArray(val)) {
    const list = val.map(c => (typeof c === 'string' ? c : String(c?.name || c?.id || ''))).filter(Boolean).sort(codeUnitCompare);
    return list.length > 0 ? list : null;
  }

  if (key === 'labels' && Array.isArray(val)) {
    const list = val.map(String).filter(Boolean).sort(codeUnitCompare);
    return list.length > 0 ? list : null;
  }

  if (key === 'fixVersions' && Array.isArray(val)) {
    const list = val.map(v => (typeof v === 'string' ? v : String(v?.name || v?.id || ''))).filter(Boolean).sort(codeUnitCompare);
    return list.length > 0 ? list : null;
  }

  if (key === 'issuelinks' && Array.isArray(val)) {
    const links = val
      .map(link => ({
        type: link.type?.name || 'relates',
        outwardIssueKey: link.outwardIssue?.key || null,
        inwardIssueKey: link.inwardIssue?.key || null
      }))
      .sort((a, b) => codeUnitCompare(JSON.stringify(a), JSON.stringify(b)));
    return links.length > 0 ? links : null;
  }

  if (key === 'subtasks' && Array.isArray(val)) {
    const subs = val
      .map(sub => ({
        key: sub.key || sub.id || 'unknown'
      }))
      .sort((a, b) => codeUnitCompare(JSON.stringify(a), JSON.stringify(b)));
    return subs.length > 0 ? subs : null;
  }

  return null;
}

/**
 * Recursively normalizes values:
 * - Trims strings and normalizes newlines (\r\n -> \n)
 * - Empty string or whitespace normalizes to null
 * - Empty array [] normalizes to null (unifying null vs [] across Jira REST queries)
 * - Empty object {} normalizes to null
 * - Preserves interior whitespace in ADF text nodes
 * - Preserves ordered sequences (ADF content nodes)
 * - Sorts unordered sets and object keys deterministically
 */
export function canonicalizeValue(val: any, isAdfTextNode: boolean = false): any {
  if (val === undefined || val === null) {
    return null;
  }

  if (typeof val === 'string') {
    if (isAdfTextNode) {
      return val.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
    }
    const trimmed = val.trim();
    if (trimmed.length === 0) {
      return null;
    }
    return trimmed.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  }

  if (typeof val === 'number') {
    return Number.isFinite(val) ? val : null;
  }

  if (typeof val === 'boolean') {
    return val;
  }

  if (Array.isArray(val)) {
    if (val.length === 0) {
      return null;
    }
    const isAdf = isAdfContentArray(val);
    const normalizedArray: any[] = [];
    for (const item of val) {
      const normalizedItem = canonicalizeValue(item, false);
      if (normalizedItem !== null) {
        normalizedArray.push(normalizedItem);
      }
    }

    if (normalizedArray.length === 0) {
      return null;
    }

    // Preserve sequential order for ADF document blocks (paragraphs, list items)
    if (isAdf) {
      return normalizedArray;
    }

    // Sort unordered sets deterministically by code-unit string representation
    return normalizedArray.sort((a, b) => codeUnitCompare(JSON.stringify(a), JSON.stringify(b)));
  }

  if (typeof val === 'object') {
    const isTextNode = val.type === 'text';
    const sortedKeys = Object.keys(val)
      .filter(key => key !== 'localId')
      .sort(codeUnitCompare);
    const sortedObj: Record<string, any> = {};
    let hasNonEmptyProp = false;

    for (const key of sortedKeys) {
      const canonProp = canonicalizeValue(val[key], isTextNode && key === 'text');
      if (canonProp !== null) {
        sortedObj[key] = canonProp;
        hasNonEmptyProp = true;
      }
    }
    return hasNonEmptyProp ? sortedObj : null;
  }

  return null;
}

/**
 * Extracts and canonicalizes issue fields, attachments, and comments from raw Jira REST API response.
 */
export function canonicalizeIssueState(rawIssue: any, capturedAt: string, fieldSchemas: FieldSchema[] = []): CanonicalIssueSnapshot {
  const issueId = String(rawIssue?.id || '');
  const issueKey = String(rawIssue?.key || '');
  const fieldsObj = rawIssue?.fields || {};

  const projectKey = fieldsObj.project?.key || '';
  const issueType = fieldsObj.issuetype?.name || '';
  const status = fieldsObj.status?.name || '';

  const canonicalFields: CanonicalField[] = [];

  const excluded: { id: string; name: string; reason: string }[] = [];
  const schemaById = new Map(fieldSchemas.map(f => [f.id, f]));

  const fieldKeys = Object.keys(fieldsObj).sort(codeUnitCompare);
  for (const key of fieldKeys) {
    if (COVERED_ELSEWHERE.has(key)) {
      continue;
    }

    const rawValue = fieldsObj[key];
    // Skip unpopulated null or empty fields
    if (rawValue === null || rawValue === undefined) {
      continue;
    }

    // Fields are chosen by schema type, never by id or value (spec v2 section 4.2)
    const schema = schemaById.get(key);
    const reason = exclusionReason(key, schema);
    if (reason) {
      excluded.push({ id: key, name: schema?.name || key, reason });
      continue;
    }

    // Normalize entity references (assignee, priority, components, labels, fixVersions, issuelinks, subtasks)
    const normalizedEntity = normalizeEntityField(key, rawValue);
    const normalizedVal = normalizedEntity !== null ? normalizedEntity : canonicalizeValue(rawValue);

    if (normalizedVal === null) {
      continue;
    }

    // Derive readable field name: the Jira name from the field list, else a built-in name, else the id
    let fieldName = key;
    if (schema?.name) fieldName = schema.name;
    else if (key === 'summary') fieldName = 'Summary';
    else if (key === 'description') fieldName = 'Description';
    else if (key === 'priority') fieldName = 'Priority';
    else if (key === 'labels') fieldName = 'Labels';
    else if (key === 'components') fieldName = 'Components';
    else if (key === 'assignee') fieldName = 'Assignee';
    else if (key === 'issuelinks') fieldName = 'Linked Issues';
    else if (key === 'subtasks') fieldName = 'Subtasks';
    else if (key === 'fixVersions') fieldName = 'Fix Versions';
    else if (key === 'environment') fieldName = 'Environment';
    else if (key === 'duedate') fieldName = 'Due Date';

    canonicalFields.push({
      id: key,
      name: fieldName,
      type: Array.isArray(rawValue) ? 'array' : typeof rawValue,
      value: normalizedVal
    });
  }

  // Process attachments sorted deterministically by attachment ID
  const rawAttachments: any[] = Array.isArray(fieldsObj.attachment) ? fieldsObj.attachment : [];
  const canonicalAttachments: CanonicalAttachment[] = rawAttachments
    .map(att => ({
      id: String(att.id || ''),
      filename: String(att.filename || '').trim(),
      size: Number(att.size || 0),
      created: String(att.created || ''),
      authorAccountId: String(att.author?.accountId || '')
    }))
    .sort((a, b) => codeUnitCompare(a.id, b.id));

  // Process comments sorted deterministically by comment ID (Fixes D-10)
  const rawComments: any[] = Array.isArray(fieldsObj.comment?.comments) ? fieldsObj.comment.comments : [];
  const canonicalComments: CanonicalComment[] = rawComments
    .map(c => ({
      id: String(c.id || ''),
      authorAccountId: String(c.author?.accountId || ''),
      body: JSON.stringify(canonicalizeValue(c.body)),
      created: String(c.created || '')
    }))
    .sort((a, b) => codeUnitCompare(a.id, b.id));

  return {
    issueId,
    issueKey,
    projectKey,
    issueType,
    status,
    fields: canonicalFields,
    attachments: canonicalAttachments,
    comments: canonicalComments,
    excluded,
    capturedAt
  };
}
