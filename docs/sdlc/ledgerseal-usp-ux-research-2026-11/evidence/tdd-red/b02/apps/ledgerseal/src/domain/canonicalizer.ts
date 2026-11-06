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

/**
 * Checks whether a custom field represents volatile JSM, SLA, CSAT, board, sprint, or dev metadata.
 */
function isVolatileOrJsmCustomField(key: string, val: any): boolean {
  const lowerKey = key.toLowerCase();

  const volatileKeys = new Set([
    'customfield_10010',
    'customfield_10027',
    'customfield_10028',
    'customfield_10050',
    'customfield_10037',
    'customfield_10000',
    'customfield_10019',
    'customfield_10020',
    'customfield_10001',
    'customfield_10002',
    'customfield_10003',
    'customfield_10004',
    'customfield_10005'
  ]);

  if (volatileKeys.has(key)) {
    return true;
  }

  if (lowerKey.includes('sla') || lowerKey.includes('satisfaction') || lowerKey.includes('rank') || lowerKey.includes('sprint')) {
    return true;
  }

  // Value-based inspection for JSM structures
  if (val && typeof val === 'object') {
    if ('ongoingCycle' in val || 'completedCycles' in val) return true;
    if ('requestType' in val || 'customerRequestType' in val) return true;
    if ('rating' in val || 'satisfactionDate' in val) return true;
    if ('approvals' in val || 'approvers' in val || 'participants' in val) return true;
    if ('pullrequest' in val || 'cachedValue' in val) return true;
  }

  if (typeof val === 'string') {
    if (val.startsWith('0|') || val.includes('pullrequest') || val.includes('branch={')) {
      return true;
    }
  }

  if (Array.isArray(val) && val.length > 0 && val[0]?.state) {
    return true;
  }

  return false;
}

/**
 * Normalizes entity reference objects to stable identity values,
 * stripping volatile embedded data (avatars, remote issue statuses, URLs).
 */
function normalizeEntityField(key: string, val: any): any {
  if (!val || typeof val !== 'object') return null;

  if (key === 'assignee') {
    return {
      accountId: val.accountId || 'unknown',
      displayName: val.displayName || 'unknown'
    };
  }

  if (key === 'priority') {
    return {
      id: val.id || 'unknown',
      name: val.name || 'unknown'
    };
  }

  if (key === 'components' && Array.isArray(val)) {
    const list = val.map(c => c.name || String(c)).filter(Boolean).sort(codeUnitCompare);
    return list.length > 0 ? list : null;
  }

  if (key === 'labels' && Array.isArray(val)) {
    const list = val.map(String).filter(Boolean).sort(codeUnitCompare);
    return list.length > 0 ? list : null;
  }

  if (key === 'fixVersions' && Array.isArray(val)) {
    const list = val.map(v => v.name || String(v)).filter(Boolean).sort(codeUnitCompare);
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
export function canonicalizeIssueState(rawIssue: any, capturedAt: string): CanonicalIssueSnapshot {
  const issueId = String(rawIssue?.id || '');
  const issueKey = String(rawIssue?.key || '');
  const fieldsObj = rawIssue?.fields || {};

  const projectKey = fieldsObj.project?.key || '';
  const issueType = fieldsObj.issuetype?.name || '';
  const status = fieldsObj.status?.name || '';

  const canonicalFields: CanonicalField[] = [];

  // Exclude volatile, transient, and non-content fields to prevent false positive tamper warnings
  const excludedFieldKeys = new Set([
    'project',
    'issuetype',
    'status',
    'statuscategory',
    'statusCategory',
    'statuscategorychangedate',
    'statusCategoryChangeDate',
    'resolution',
    'resolutiondate',
    'attachment',
    'comment',
    'worklog',
    'created',
    'creator',
    'reporter',
    'updated',
    'updatedBy',
    'lastViewed',
    'watches',
    'votes',
    'rank',
    'sprint',
    'workratio',
    'aggregateprogress',
    'progress',
    'timeestimate',
    'timespent',
    'timeoriginalestimate',
    'aggregatetimeestimate',
    'aggregatetimespent',
    'aggregatetimeoriginalestimate'
  ]);

  const fieldKeys = Object.keys(fieldsObj).sort(codeUnitCompare);
  for (const key of fieldKeys) {
    if (excludedFieldKeys.has(key)) {
      continue;
    }

    const rawValue = fieldsObj[key];
    // Skip unpopulated null or empty fields
    if (rawValue === null || rawValue === undefined) {
      continue;
    }

    // Skip volatile JSM, SLA, CSAT, or board custom fields
    if (isVolatileOrJsmCustomField(key, rawValue)) {
      continue;
    }

    // Normalize entity references (assignee, priority, components, labels, fixVersions, issuelinks, subtasks)
    const normalizedEntity = normalizeEntityField(key, rawValue);
    const normalizedVal = normalizedEntity !== null ? normalizedEntity : canonicalizeValue(rawValue);

    if (normalizedVal === null) {
      continue;
    }

    // Derive readable field name
    let fieldName = key;
    if (key === 'summary') fieldName = 'Summary';
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
    capturedAt
  };
}
