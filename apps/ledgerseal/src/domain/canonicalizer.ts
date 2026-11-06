/**
 * Copyright (c) 2026 Asymm Systems. All rights reserved.
 *
 * LedgerSeal: Canonicalization Engine
 * Produces byte-for-byte deterministic normalized representations of Jira issue states.
 *
 * @author Fahim Farook
 */

import { CanonicalAttachment, CanonicalComment, CanonicalField, CanonicalIssueSnapshot } from './models';
import { plainText } from './display';

/**
 * Deterministic code-unit comparison for string sorting.
 */
function codeUnitCompare(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

/** A field from GET /rest/api/3/field. Only id, name and schema are read. */
export interface FieldSchema {
  id: string;
  name?: string;
  schema?: { type?: string; items?: string; system?: string; custom?: string };
}

const STATUS_REASON = 'The gated transition changes the status. The status at seal is recorded.';
// NF-05 (live, LSP-1): a transition to a resolving status sets these, so they follow the status rule (D-2)
const RESOLUTION_REASON = 'The gated transition sets the resolution. The status at seal is recorded.';
const JIRA_TIME_REASON = 'Jira sets this time itself.';
const DERIVED_REASON = 'Derived from work logs or sub-tasks.';

/**
 * System fields outside the seal in every canonical form, with the reason the panel shows (spec v2 section 4.2).
 * Matched on the field id, which equals schema.system for system fields.
 */
const BASE_SYSTEM_EXCLUDED: Record<string, string> = {
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
  aggregatetimeoriginalestimate: DERIVED_REASON
};

/**
 * Custom field types outside the seal in every canonical form, matched on schema.custom (spec v2 section 4.2).
 * Any other custom type is covered, so an unknown type can only cause a false alarm, never hide a change.
 */
const BASE_CUSTOM_EXCLUDED: Record<string, string> = {
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

/** The fields one canonical form leaves out. */
interface ExclusionRules {
  system: Record<string, string>;
  custom: Record<string, string>;
  /** 2.2.0 and later: `{ id }` only for reference fields; every other object is hashed in full (F-07). */
  idOnlyInReferenceFields?: boolean;
}

/**
 * Each canonical form version keeps its own rules, so a seal is always checked with the rules it was made with
 * (spec v2 section 4.1). A change to the covered set is a new version; an old version is never edited.
 */
const RULES: Record<string, ExclusionRules> = {
  '2.0.0': {
    system: { ...BASE_SYSTEM_EXCLUDED, resolutiondate: 'Set together with Resolution, which is covered.' },
    custom: BASE_CUSTOM_EXCLUDED
  },
  '2.1.0': {
    // NF-05 (live, LSP-1): a transition to a resolving status sets these, so they follow the status rule (D-2)
    system: { ...BASE_SYSTEM_EXCLUDED, resolution: RESOLUTION_REASON, resolutiondate: RESOLUTION_REASON },
    custom: {
      ...BASE_CUSTOM_EXCLUDED,
      // NF-04: computed on JSM sites and seen live on DEMO; each changes without a user edit
      'com.atlassian.servicedesk.sentiment:sd-sentiment': 'Computed by Jira.',
      'com.atlassian.jira.plugins.proforma-managed-fields:forms-total-field-cftype': 'Computed by Jira.',
      'com.atlassian.jira.plugins.proforma-managed-fields:forms-submitted-field-cftype': 'Computed by Jira.',
      'com.atlassian.jira.plugins.proforma-managed-fields:forms-locked-field-cftype': 'Computed by Jira.',
      'com.atlassian.jira.plugins.proforma-managed-fields:forms-open-field-cftype': 'Computed by Jira.',
      'com.atlassian.jira.plugin.system.customfieldtypes:agent-sessions': 'Computed by Jira.'
    }
  }
};

/**
 * 2.2.0 (ADR-011, readiness finding F-07): the exclusions of 2.1.0. People are party tokens (the caller
 * pseudonymises the issue first), and an object with an `id` is reduced to `{ id }` only in a reference field.
 */
RULES['2.2.0'] = { ...RULES['2.1.0'], idOnlyInReferenceFields: true };

/** Versions whose sealed snapshots hold party tokens, never account ids. */
export const PSEUDONYMOUS_VERSIONS = new Set(['2.2.0']);

/** System fields whose values point at another Jira item, so the item is identified by its id. */
const REFERENCE_SYSTEM_FIELDS = new Set([
  'priority', 'issuetype', 'project', 'resolution', 'security', 'components', 'fixVersions', 'versions', 'parent', 'subtasks', 'status', 'statusCategory'
]);
/** Field schema types (or array item types) that point at another Jira item. */
const REFERENCE_TYPES = new Set([
  'option', 'option-with-child', 'priority', 'version', 'component', 'project', 'issuetype', 'resolution', 'securitylevel',
  'issuelink', 'issuelinks', 'status', 'statuscategory', 'team', 'sd-customerorganization'
]);

/** True when a field's object values are references, identified by their id alone (2.2.0 and later). */
export function isReferenceField(key: string, schema: FieldSchema | undefined): boolean {
  if (REFERENCE_SYSTEM_FIELDS.has(key)) return true;
  const type = schema?.schema?.type;
  if (type && REFERENCE_TYPES.has(type)) return true;
  return type === 'array' && REFERENCE_TYPES.has(String(schema?.schema?.items));
}

/** Hashed outside `fields` (top-level ids, attachments and comments), so never listed as excluded. */
const COVERED_ELSEWHERE = new Set(['project', 'issuetype', 'attachment', 'comment']);

/** The canonical form new seals use. Read through the module export, so a test can stand in for an older app. */
export const CANONICALIZER_VERSION: string = '2.2.0';

export function isKnownCanonicalizerVersion(version: unknown): boolean {
  return typeof version === 'string' && Object.prototype.hasOwnProperty.call(RULES, version);
}

/** Fields that are sets whatever their schema says: their order carries no meaning (spec v2 section 4.3). */
const SET_FIELDS = new Set(['labels', 'components', 'fixVersions', 'versions', 'issuelinks', 'subtasks']);
/** Array item types that make a field a set. */
const SET_ITEM_TYPES = new Set(['option', 'user', 'group', 'version', 'component']);

function exclusionReason(rules: ExclusionRules, key: string, schema: FieldSchema | undefined): string | null {
  if (rules.system[key]) return rules.system[key];
  const system = schema?.schema?.system;
  if (system && rules.system[system]) return rules.system[system];
  const custom = schema?.schema?.custom;
  return custom && rules.custom[custom] ? rules.custom[custom] : null;
}

/**
 * True when a field is outside the seal under a canonical form's rules (F-13): a change to it, such as a status
 * move or a Rank change, is not a change of covered content. An unknown version uses the newest rules.
 */
export function isExcludedField(version: string, fieldId: string, fieldSchemas: FieldSchema[] = []): boolean {
  const rules = RULES[version] ?? RULES[CANONICALIZER_VERSION];
  return exclusionReason(rules, fieldId, fieldSchemas.find(f => f.id === fieldId)) !== null;
}

function isSetField(key: string, schema: FieldSchema | undefined): boolean {
  if (SET_FIELDS.has(key)) return true;
  return schema?.schema?.type === 'array' && SET_ITEM_TYPES.has(String(schema.schema.items));
}

/** Line endings become \n. Nothing is trimmed, because the spaces a person typed are content (LS-11). */
function normalizeText(text: string): string {
  return text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
}

const DATE_TIME = /^(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d{1,9})?)?)(Z|[+-]\d{2}:?\d{2})$/;

/** An ISO-8601 date-time with an offset becomes UTC with milliseconds. Any other string is text. */
function normalizeString(text: string): string | null {
  const m = DATE_TIME.exec(text);
  if (m) {
    const offset = m[2] === 'Z' ? 'Z' : `${m[2].slice(0, 3)}:${m[2].slice(-2)}`;
    const instant = new Date(m[1] + offset);
    if (!Number.isNaN(instant.getTime())) return instant.toISOString();
  }
  const normalized = normalizeText(text);
  return normalized.length > 0 ? normalized : null;
}

function isAdfNode(val: any): boolean {
  return Boolean(val && typeof val === 'object' && !Array.isArray(val) && typeof val.type === 'string');
}

/**
 * Canonical value (spec v2 section 4.3):
 * - users become { accountId }; options, versions, components and issue references become { id } (a cascading
 *   option keeps its child), so a rename keeps the seal and a different item breaks it;
 * - date-times become UTC; text keeps its spaces and gets \n line endings;
 * - rich text keeps its order, and its volatile `localId` attributes are removed;
 * - an array is sorted only when `asSet` is true; empty values become null;
 * - `byId` false (2.2.0, a field that is not a reference field) hashes objects with an `id` in full (F-07).
 */
export function canonicalizeValue(val: any, asSet: boolean = false, inRichText: boolean = false, byId: boolean = true): any {
  if (val === undefined || val === null) return null;
  if (typeof val === 'string') return inRichText ? normalizeText(val) : normalizeString(val);
  if (typeof val === 'number') return Number.isFinite(val) ? val : null;
  if (typeof val === 'boolean') return val;

  if (Array.isArray(val)) {
    const items = val.map(item => canonicalizeValue(item, false, inRichText, byId)).filter(item => item !== null);
    if (items.length === 0) return null;
    return asSet ? items.sort((a, b) => codeUnitCompare(JSON.stringify(a), JSON.stringify(b))) : items;
  }

  if (typeof val === 'object') {
    if (isAdfNode(val) || inRichText) {
      const node: Record<string, any> = {};
      for (const key of Object.keys(val).sort(codeUnitCompare)) {
        if (key === 'localId') continue;
        const child = canonicalizeValue(val[key], false, true);
        if (child !== null) node[key] = child;
      }
      return Object.keys(node).length > 0 ? node : null;
    }
    if (typeof val.accountId === 'string' && val.accountId.length > 0) return { accountId: val.accountId };
    if (byId && val.id !== undefined && val.id !== null && String(val.id).length > 0) {
      const child = val.child ? canonicalizeValue(val.child) : null;
      return child ? { id: String(val.id), child } : { id: String(val.id) };
    }
    const obj: Record<string, any> = {};
    for (const key of Object.keys(val).sort(codeUnitCompare)) {
      if (key === 'self' || key === 'avatarUrls' || key === 'iconUrl') continue;
      const child = canonicalizeValue(val[key], false, false, byId);
      if (child !== null) obj[key] = child;
    }
    return Object.keys(obj).length > 0 ? obj : null;
  }

  return null;
}

/** Fields whose canonical value has its own rule. Returns undefined for the general rule. */
function specialValue(key: string, val: any): any {
  if (key === 'issuelinks' && Array.isArray(val)) {
    const links = val
      .map(link => {
        const outward = link?.outwardIssue;
        const other = outward ?? link?.inwardIssue;
        const issue = other?.id ?? other?.key;
        if (issue === undefined) return null;
        return { type: String(link.type?.id ?? link.type?.name ?? ''), direction: outward ? 'outward' : 'inward', issue: String(issue) };
      })
      .filter(Boolean)
      .sort((a, b) => codeUnitCompare(JSON.stringify(a), JSON.stringify(b)));
    return links.length > 0 ? links : null;
  }
  if (key === 'timetracking' && val && typeof val === 'object') {
    const seconds = Number(val.originalEstimateSeconds);
    return Number.isFinite(seconds) ? { originalEstimateSeconds: seconds } : null;
  }
  if (key === 'worklog' && val && Array.isArray(val.worklogs)) {
    const logs = val.worklogs
      .map((w: any) => ({
        id: String(w.id ?? ''),
        authorAccountId: String(w.author?.accountId ?? ''),
        started: typeof w.started === 'string' ? normalizeString(w.started) ?? '' : '',
        timeSpentSeconds: Number(w.timeSpentSeconds ?? 0),
        comment: canonicalizeValue(w.comment, false, isAdfNode(w.comment))
      }))
      .sort((a: any, b: any) => codeUnitCompare(a.id, b.id));
    return logs.length > 0 ? logs : null;
  }
  return undefined;
}

/** Display text for the change list. Not hashed. */
function displayValue(key: string, val: any): string {
  if (key === 'issuelinks' && Array.isArray(val)) {
    // The same links as the hash: a link with no other issue is left out of both
    return val
      .filter(link => link?.outwardIssue ?? link?.inwardIssue)
      .map(link => {
        const outward = link?.outwardIssue;
        const other = outward ?? link?.inwardIssue;
        const verb = outward ? link?.type?.outward ?? link?.type?.name : link?.type?.inward ?? link?.type?.name;
        return `${verb ?? 'relates to'} ${other?.key ?? other?.id ?? ''}`.trim();
      })
      .join(', ');
  }
  if (key === 'timetracking' && val && typeof val === 'object') return String(val.originalEstimate ?? val.originalEstimateSeconds ?? '');
  if (key === 'worklog' && val && Array.isArray(val.worklogs)) return `${val.worklogs.length} work log entries`;
  return normalizeText(plainText(val));
}

const BUILT_IN_NAMES: Record<string, string> = {
  summary: 'Summary',
  description: 'Description',
  priority: 'Priority',
  labels: 'Labels',
  components: 'Components',
  assignee: 'Assignee',
  reporter: 'Reporter',
  issuelinks: 'Linked Issues',
  subtasks: 'Subtasks',
  fixVersions: 'Fix Versions',
  environment: 'Environment',
  duedate: 'Due Date',
  resolution: 'Resolution',
  timetracking: 'Time tracking',
  worklog: 'Work log'
};

/**
 * Extracts and canonicalizes issue fields, attachments, and comments from raw Jira REST API response.
 * `version` picks the canonical form rules; an unknown version throws rather than guess its rules.
 */
export function canonicalizeIssueState(
  rawIssue: any,
  capturedAt: string,
  fieldSchemas: FieldSchema[] = [],
  version: string = CANONICALIZER_VERSION
): CanonicalIssueSnapshot {
  if (!isKnownCanonicalizerVersion(version)) throw new Error(`Unknown canonical form version ${version}`);
  const rules = RULES[version];
  const issueId = String(rawIssue?.id || '');
  const issueKey = String(rawIssue?.key || '');
  const fieldsObj = rawIssue?.fields || {};

  // Project and issue type are hashed by id; the key and name are kept for display
  const projectId = String(fieldsObj.project?.id ?? fieldsObj.project?.key ?? '');
  const projectKey = String(fieldsObj.project?.key ?? '');
  const issueTypeId = String(fieldsObj.issuetype?.id ?? fieldsObj.issuetype?.name ?? '');
  const issueType = String(fieldsObj.issuetype?.name ?? '');
  const status = fieldsObj.status?.name || '';

  const canonicalFields: CanonicalField[] = [];
  const excluded: { id: string; name: string; reason: string }[] = [];
  const schemaById = new Map(fieldSchemas.map(f => [f.id, f]));

  for (const key of Object.keys(fieldsObj).sort(codeUnitCompare)) {
    if (COVERED_ELSEWHERE.has(key)) continue;
    const rawValue = fieldsObj[key];
    if (rawValue === null || rawValue === undefined) continue;

    // Fields are chosen by schema type, never by id or value (spec v2 section 4.2)
    const schema = schemaById.get(key);
    const reason = exclusionReason(rules, key, schema);
    if (reason) {
      excluded.push({ id: key, name: schema?.name || key, reason });
      continue;
    }

    const special = specialValue(key, rawValue);
    const byId = !rules.idOnlyInReferenceFields || isReferenceField(key, schema);
    const value = special !== undefined ? special : canonicalizeValue(rawValue, isSetField(key, schema), false, byId);
    if (value === null) continue;

    // A set field's display text is sorted too, so the snapshot does not depend on the order Jira returns
    const display = isSetField(key, schema) && Array.isArray(rawValue)
      ? rawValue.map(item => displayValue(key, [item])).filter(Boolean).sort(codeUnitCompare).join(', ')
      : displayValue(key, rawValue);

    canonicalFields.push({
      id: key,
      name: schema?.name || BUILT_IN_NAMES[key] || key,
      type: Array.isArray(rawValue) ? 'array' : typeof rawValue,
      value,
      display
    });
  }

  // Attachments by id. Content is not hashed: Jira gives a replaced file a new id (spec v2 section 4.5)
  const rawAttachments: any[] = Array.isArray(fieldsObj.attachment) ? fieldsObj.attachment : [];
  const canonicalAttachments: CanonicalAttachment[] = rawAttachments
    .map(att => ({
      id: String(att.id ?? ''),
      filename: String(att.filename ?? ''),
      size: Number(att.size ?? 0),
      mimeType: String(att.mimeType ?? ''),
      created: typeof att.created === 'string' ? normalizeString(att.created) ?? '' : '',
      authorAccountId: String(att.author?.accountId ?? '')
    }))
    .sort((a, b) => codeUnitCompare(a.id, b.id));

  // Comments by id, with their body canonicalised (Fixes D-10, spec v2 section 4.4)
  const rawComments: any[] = Array.isArray(fieldsObj.comment?.comments) ? fieldsObj.comment.comments : [];
  const canonicalComments: CanonicalComment[] = rawComments
    .map(c => ({
      id: String(c.id ?? ''),
      authorAccountId: String(c.author?.accountId ?? ''),
      body: canonicalizeValue(c.body, false, isAdfNode(c.body)),
      created: typeof c.created === 'string' ? normalizeString(c.created) ?? '' : ''
    }))
    .sort((a, b) => codeUnitCompare(a.id, b.id));

  // F-06: which comments Jira restricts to a role or group. Kept next to the snapshot, outside the hashed form, so
  // the panel and the evidence export show such a comment only to a viewer who can see it in Jira.
  const restrictedComments = rawComments
    .filter(c => c?.visibility && typeof c.visibility === 'object' && (c.visibility.value || c.visibility.identifier))
    .map(c => ({ id: String(c.id ?? ''), type: String(c.visibility.type ?? ''), value: String(c.visibility.value ?? c.visibility.identifier ?? '') }))
    .sort((a, b) => codeUnitCompare(a.id, b.id));

  return {
    canonicalizerVersion: version,
    issueId,
    issueKey,
    projectId,
    projectKey,
    issueTypeId,
    issueType,
    status,
    fields: canonicalFields,
    attachments: canonicalAttachments,
    comments: canonicalComments,
    excluded,
    restrictedComments,
    capturedAt
  };
}
