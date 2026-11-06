/**
 * DefinitionGuard change log: pure functions that build, chain and fold change-log entries.
 *
 * Copyright (c) 2026 Asymm Systems. All rights reserved.
 * @author Fahim Farook
 *
 * Each entry is one transaction of Silverston/OFBiz entity rows (spec v3 sections 3 and 7):
 * WorkEffort, WorkEffortAssoc, WorkEffortStatus, Content, WorkEffortContent. The state is a fold
 * over the entries. The first entry (Create or Migrate) carries every criterion, so the state can
 * always be rebuilt from the entries alone. Each entry stores the hash of the previous one
 * (prevHash), starting from a per-issue genesis hash.
 */
import * as crypto from 'crypto';
import {
  ChangeEntry,
  CriterionState,
  DodRow,
  DodState,
  DodStatusId,
  DodTemplate,
  EntryInput,
  IssueChecklistState,
  LegacyRef,
  TemplateCriterion,
  TransitionName
} from './models';
import { isValidChange, invalidChangeMessage } from './dod-status';
import { DEFAULT_WAIVER_ROLE } from './roles';
import { Evidence } from './evidence';

/** JSON with sorted object keys and no spaces, so equal values always hash the same. */
export function canonicalJson(value: unknown): string {
  if (value === null || typeof value !== 'object') {
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return `[${value.map(v => canonicalJson(v === undefined ? null : v)).join(',')}]`;
  }
  const obj = value as Record<string, unknown>;
  const keys = Object.keys(obj).filter(k => obj[k] !== undefined).sort();
  return `{${keys.map(k => `${JSON.stringify(k)}:${canonicalJson(obj[k])}`).join(',')}}`;
}

function sha256(text: string): string {
  return crypto.createHash('sha256').update(text, 'utf8').digest('hex');
}

/** The prevHash of entry 1. Binds the chain to one issue. */
export function genesisHash(issueId: string): string {
  return sha256(`definitionguard:${issueId}`);
}

/** Hash of an entry over every field except `hash`, rows included. */
export function hashEntry(entry: Omit<ChangeEntry, 'hash'> & { hash?: string }): string {
  const { hash: _ignored, ...rest } = entry;
  return sha256(canonicalJson(rest));
}

export const issueWorkEffortId = (issueId: string) => `issue:${issueId}`;
export const criterionWorkEffortId = (issueId: string, templateItemId: string) => `crit:${issueId}:${templateItemId}`;

export function emptyState(issueId: string, issueKey: string, projectId: string): DodState {
  return {
    schemaVersion: 3,
    issue: { workEffortId: issueWorkEffortId(issueId), workEffortTypeId: 'ISSUE', sourceReferenceId: issueId, workEffortName: issueKey, projectId },
    template: { workEffortId: '', revisionNumber: 0, waiverRoleTypeId: DEFAULT_WAIVER_ROLE },
    criteria: [],
    seq: 0,
    headHash: genesisHash(issueId)
  };
}

/** Builds the next entry after `state`: seq + 1, chained to state.headHash. */
export function makeEntry(state: DodState, input: EntryInput): ChangeEntry {
  const unsigned = { ...input, seq: state.seq + 1, issueId: state.issue.sourceReferenceId, prevHash: state.headHash };
  return { ...unsigned, hash: hashEntry(unsigned) };
}

/** WorkEffort rows for the issue and its criteria, the template link and the breakdown links. */
function structureRows(state: DodState, templateId: string, revisionNumber: number, waiverRoleTypeId: DodTemplate['waiverRoleTypeId'], criteria: TemplateCriterion[], at: string): DodRow[] {
  const issueId = state.issue.sourceReferenceId;
  const rows: DodRow[] = [
    { entity: 'WorkEffort', ...state.issue },
    { entity: 'WorkEffortAssoc', workEffortIdFrom: templateId, workEffortIdTo: state.issue.workEffortId, workEffortAssocTypeId: 'WORK_EFF_TEMPLATE', revisionNumber, waiverRoleTypeId, fromDate: at }
  ];
  for (const c of criteria) {
    const { sequenceNum: _s, ...fields } = c;
    rows.push({ entity: 'WorkEffort', workEffortId: criterionWorkEffortId(issueId, c.templateItemId), workEffortTypeId: 'DOD_CRITERION', ...fields, sequenceNum: c.sequenceNum });
    rows.push({ entity: 'WorkEffortAssoc', workEffortIdFrom: state.issue.workEffortId, workEffortIdTo: criterionWorkEffortId(issueId, c.templateItemId), workEffortAssocTypeId: 'WORK_EFF_BREAKDOWN', sequenceNum: c.sequenceNum, fromDate: at });
  }
  return rows;
}

export function createEntry(state: DodState, template: DodTemplate, actorPartyId: string, at: string): ChangeEntry {
  return makeEntry(state, {
    transitionName: 'Create',
    at,
    actorPartyId,
    rows: structureRows(state, template.workEffortId, template.revisionNumber, template.waiverRoleTypeId, template.criteria, at)
  });
}

/** Criteria taken from a v1 record (dg:checklist:<issueId>), as template criteria. */
function legacyCriteria(legacy: IssueChecklistState): TemplateCriterion[] {
  return legacy.items.map((i, idx) => ({
    templateItemId: i.id,
    workEffortName: i.title,
    sequenceNum: idx + 1,
    purposeTypeId: i.category,
    isMandatory: i.isMandatory,
    evidenceRequired: false
  }));
}

export function legacyRefOf(legacy: IssueChecklistState): LegacyRef {
  return {
    stateVersion: legacy.stateVersion || 1,
    eventCount: legacy.auditTrail?.length || 0,
    checklistHash: legacy.checklistHash
  };
}

/** WorkEffortStatus rows for the completed v1 items. A v1 display name is kept only when no accountId exists. */
function legacyStatusRows(state: DodState, legacy: IssueChecklistState, at: string): DodRow[] {
  return legacy.items.filter(i => i.isCompleted).map(i => {
    const row: DodRow = {
      entity: 'WorkEffortStatus',
      workEffortId: criterionWorkEffortId(state.issue.sourceReferenceId, i.id),
      statusId: 'DOD_DONE',
      statusDatetime: i.completedAt || at,
      setByPartyId: i.completedByAccountId || ''
    };
    if (!i.completedByAccountId && i.completedBy) row.setByLegacyName = i.completedBy;
    return row;
  });
}

function migrateRows(state: DodState, legacy: IssueChecklistState, at: string): DodRow[] {
  return [
    ...structureRows(state, legacy.templateId || '', 1, DEFAULT_WAIVER_ROLE, legacyCriteria(legacy), at),
    ...legacyStatusRows(state, legacy, at),
    { entity: 'LegacyImport', legacy: legacyRefOf(legacy) }
  ];
}

export function migrateEntry(state: DodState, legacy: IssueChecklistState, actorPartyId: string, at: string): ChangeEntry {
  const base = { ...state, issue: { ...state.issue, workEffortName: state.issue.workEffortName || legacy.issueKey } };
  return makeEntry(state, { transitionName: 'Migrate', at, actorPartyId, rows: migrateRows(base, legacy, at) });
}

/** A state derived in memory from a v1 record. seq 0: nothing is stored yet. */
export function stateFromLegacy(legacy: IssueChecklistState, projectId: string): DodState {
  const base = emptyState(legacy.issueId, legacy.issueKey, projectId);
  const derived = foldRows(base, 'Migrate', 0, migrateRows(base, legacy, ''));
  return { ...derived, seq: 0, headHash: base.headHash };
}

export interface StatusChange {
  templateItemId: string;
  statusIdTo: DodStatusId;
  transitionName: TransitionName;
  actorPartyId: string;
  at: string;
  reason?: string;
  evidence?: Evidence;
}

/**
 * The entry for one criterion's status change: a WorkEffortStatus row, and for evidence a
 * Content row with a WorkEffortContent link from the same moment (spec v3 D3-05).
 * Throws with a user message when StatusValidChange does not allow the change.
 */
export function statusEntry(state: DodState, change: StatusChange): EntryInput {
  const criterion = state.criteria.find(c => c.templateItemId === change.templateItemId);
  if (!criterion) {
    throw new Error(`Checklist item with id '${change.templateItemId}' not found on issue ${state.issue.workEffortName}`);
  }
  if (!isValidChange(criterion.currentStatusId, change.statusIdTo, change.transitionName)) {
    throw new Error(invalidChangeMessage(criterion.currentStatusId, change.transitionName));
  }
  const status: DodRow = { entity: 'WorkEffortStatus', workEffortId: criterion.workEffortId, statusId: change.statusIdTo, statusDatetime: change.at, setByPartyId: change.actorPartyId };
  if (change.reason) status.reason = change.reason;
  const rows: DodRow[] = [status];
  if (change.evidence) {
    const contentId = `content:${state.issue.sourceReferenceId}:${state.seq + 1}`;
    const content: DodRow = { entity: 'Content', contentId, contentTypeId: 'DOD_EVIDENCE' };
    if (change.evidence.url) content.objectInfo = change.evidence.url;
    if (change.evidence.note) content.textData = change.evidence.note;
    rows.push(content, { entity: 'WorkEffortContent', workEffortId: criterion.workEffortId, contentId, workEffortContentTypeId: 'DOD_EVIDENCE', fromDate: change.at });
  }
  return { transitionName: change.transitionName, at: change.at, actorPartyId: change.actorPartyId, rows };
}

/**
 * Resync to a new template revision (B-16): the template link gets the new revisionNumber; every
 * criterion of the new revision is restated (an unchanged id keeps its status and its original
 * breakdown link); new criteria start open; a removed criterion's breakdown link is ended with
 * thruDate, never deleted.
 */
export function resyncEntry(state: DodState, template: DodTemplate, actorPartyId: string, at: string): EntryInput {
  const issueId = state.issue.sourceReferenceId;
  const existing = new Map(state.criteria.map(c => [c.workEffortId, c]));
  const keep = new Set(template.criteria.map(c => criterionWorkEffortId(issueId, c.templateItemId)));
  const rows: DodRow[] = [
    { entity: 'WorkEffortAssoc', workEffortIdFrom: template.workEffortId, workEffortIdTo: state.issue.workEffortId, workEffortAssocTypeId: 'WORK_EFF_TEMPLATE', revisionNumber: template.revisionNumber, waiverRoleTypeId: template.waiverRoleTypeId, fromDate: at }
  ];
  for (const c of template.criteria) {
    const workEffortId = criterionWorkEffortId(issueId, c.templateItemId);
    rows.push({ entity: 'WorkEffort', workEffortId, workEffortTypeId: 'DOD_CRITERION', ...c });
    rows.push({ entity: 'WorkEffortAssoc', workEffortIdFrom: state.issue.workEffortId, workEffortIdTo: workEffortId, workEffortAssocTypeId: 'WORK_EFF_BREAKDOWN', sequenceNum: c.sequenceNum, fromDate: existing.get(workEffortId)?.breakdownFromDate || at });
  }
  for (const c of state.criteria) {
    if (keep.has(c.workEffortId)) continue;
    rows.push({ entity: 'WorkEffortAssoc', workEffortIdFrom: state.issue.workEffortId, workEffortIdTo: c.workEffortId, workEffortAssocTypeId: 'WORK_EFF_BREAKDOWN', sequenceNum: c.sequenceNum, fromDate: c.breakdownFromDate || at, thruDate: at });
  }
  return { transitionName: 'Resync', at, actorPartyId, rows };
}

/** Reset: one WorkEffortStatus row back to DOD_OPEN for every criterion that is not open. */
export function resetEntry(state: DodState, actorPartyId: string, at: string): EntryInput {
  return {
    transitionName: 'Reset',
    at,
    actorPartyId,
    rows: state.criteria
      .filter(c => c.currentStatusId !== 'DOD_OPEN')
      .map(c => ({ entity: 'WorkEffortStatus' as const, workEffortId: c.workEffortId, statusId: 'DOD_OPEN' as const, statusDatetime: at, setByPartyId: actorPartyId, reason: 'Checklist reset' }))
  };
}

/** Applies the rows of one entry. Criterion rows replace the criterion list (Create, Migrate, Resync). */
function foldRows(state: DodState, transitionName: TransitionName, seq: number, rows: DodRow[]): DodState {
  const next: DodState = { ...state, issue: { ...state.issue }, template: { ...state.template }, criteria: state.criteria.map(c => ({ ...c })) };
  const criterionRows = rows.filter(r => r.entity === 'WorkEffort' && r.workEffortTypeId === 'DOD_CRITERION');
  if (criterionRows.length > 0) {
    const previous = new Map(next.criteria.map(c => [c.workEffortId, c]));
    next.criteria = criterionRows.map(r => {
      const { entity: _e, workEffortTypeId: _t, ...fields } = r as any;
      const old = previous.get(fields.workEffortId);
      return old
        ? { ...fields, currentStatusId: old.currentStatusId, lastStatusUpdate: old.lastStatusUpdate, lastStatusByPartyId: old.lastStatusByPartyId, lastStatusSeq: old.lastStatusSeq, evidenceContentId: old.evidenceContentId, legacyName: old.legacyName, breakdownFromDate: old.breakdownFromDate, openedAt: old.openedAt }
        : { ...fields, currentStatusId: 'DOD_OPEN' };
    }) as CriterionState[];
  }
  const byId = new Map(next.criteria.map(c => [c.workEffortId, c]));
  for (const row of rows) {
    switch (row.entity) {
      case 'WorkEffort':
        if (row.workEffortTypeId === 'ISSUE') {
          next.issue = { workEffortId: row.workEffortId, workEffortTypeId: 'ISSUE', sourceReferenceId: row.sourceReferenceId, workEffortName: row.workEffortName, projectId: row.projectId };
        }
        break;
      case 'WorkEffortAssoc':
        if (row.workEffortAssocTypeId === 'WORK_EFF_TEMPLATE') {
          next.template = { workEffortId: row.workEffortIdFrom, revisionNumber: row.revisionNumber || 1, waiverRoleTypeId: row.waiverRoleTypeId || DEFAULT_WAIVER_ROLE };
        } else {
          const c = byId.get(row.workEffortIdTo);
          if (c && !row.thruDate) {
            if (row.sequenceNum !== undefined) c.sequenceNum = row.sequenceNum;
            c.breakdownFromDate = row.fromDate;
          }
        }
        break;
      case 'WorkEffortStatus': {
        const c = byId.get(row.workEffortId);
        if (!c) throw new Error(`DefinitionGuard: status for unknown criterion ${row.workEffortId}`);
        if (transitionName !== 'Migrate' && !isValidChange(c.currentStatusId, row.statusId, transitionName)) {
          throw new Error(`DefinitionGuard: ${c.currentStatusId} to ${row.statusId} is not a valid ${transitionName}`);
        }
        // H-2: openedAt is set only when a closed item is opened again (Reopen, Reset). A criterion that
        // was never reopened has none, so the not-the-assignee rule looks at the whole issue history:
        // the checklist exists, at least in memory, from the moment the issue exists.
        if (row.statusId === 'DOD_OPEN' && c.currentStatusId !== 'DOD_OPEN') c.openedAt = row.statusDatetime;
        c.currentStatusId = row.statusId;
        c.lastStatusUpdate = row.statusId === 'DOD_OPEN' ? undefined : row.statusDatetime;
        c.lastStatusByPartyId = row.statusId === 'DOD_OPEN' ? undefined : row.setByPartyId || undefined;
        c.lastStatusSeq = seq;
        c.evidenceContentId = undefined;
        c.legacyName = row.setByLegacyName;
        break;
      }
      case 'WorkEffortContent': {
        const c = byId.get(row.workEffortId);
        if (c && c.currentStatusId === 'DOD_DONE' && c.lastStatusUpdate === row.fromDate) c.evidenceContentId = row.contentId;
        break;
      }
      case 'LegacyImport':
        next.legacy = row.legacy;
        break;
      case 'Content':
      case 'Redaction':
        break;
    }
  }
  next.criteria.sort((a, b) => a.sequenceNum - b.sequenceNum);
  return next;
}

/**
 * Applies one entry to the state and returns the new state. Pure.
 * Throws when the entry does not follow the state (wrong seq, issue or prevHash), or when a
 * status row is not a valid change.
 */
export function applyEntry(state: DodState, entry: ChangeEntry): DodState {
  if (entry.seq !== state.seq + 1) {
    throw new Error(`DefinitionGuard: entry sequence ${entry.seq} does not follow ${state.seq}`);
  }
  if (entry.issueId !== state.issue.sourceReferenceId) {
    throw new Error('DefinitionGuard: entry belongs to another issue');
  }
  if (entry.prevHash !== state.headHash) {
    throw new Error(`DefinitionGuard: entry ${entry.seq} prevHash does not match`);
  }
  return {
    ...foldRows(state, entry.transitionName, entry.seq, entry.rows),
    seq: entry.seq,
    headHash: entry.hash,
    lastModifiedAt: entry.at,
    lastModifiedByPartyId: entry.actorPartyId
  };
}

export interface ChainCheck {
  ok: boolean;
  checked: number;
  brokenAt?: number;
  reason?: string;
}

/** Shown with every check result, in the panel and in exports. */
export const CHAIN_LIMIT_NOTE =
  "This check shows edits, removals and reordering of the stored history. It does not stop someone " +
  "who can rewrite all of the app's stored data and the chain with it, and that includes the app vendor.";

/**
 * Re-hashes every entry in seq order. Reports the first entry that is missing, belongs to
 * another issue, breaks the chain, or no longer matches its hash. With `state`, also checks
 * that the chain reaches the stored head (no truncated or replaced tail).
 */
export function verifyChain(issueId: string, entries: ChangeEntry[], state?: DodState): ChainCheck {
  const sorted = [...entries].sort((a, b) => a.seq - b.seq);
  const redactions = redactionsOf(sorted);
  let expectedPrev = genesisHash(issueId);
  let checked = 0;
  for (let i = 0; i < sorted.length; i++) {
    const e = sorted[i];
    const seq = i + 1;
    if (e.seq !== seq) return { ok: false, checked, brokenAt: seq, reason: 'event missing' };
    if (e.issueId !== issueId) return { ok: false, checked, brokenAt: seq, reason: 'event belongs to another issue' };
    if (e.prevHash !== expectedPrev) return { ok: false, checked, brokenAt: seq, reason: 'chain broken' };
    const actual = hashEntry(e);
    const redacted = (redactions.get(seq) || []).some(r => r.originalHash === e.hash && r.redactedHash === actual);
    if (actual !== e.hash && !redacted) return { ok: false, checked, brokenAt: seq, reason: 'content changed' };
    expectedPrev = e.hash;
    checked++;
  }
  if (state) {
    if (sorted.length < state.seq) return { ok: false, checked, brokenAt: sorted.length + 1, reason: 'event missing' };
    if (state.seq > 0 && expectedPrev !== state.headHash) {
      return { ok: false, checked: checked - 1, brokenAt: sorted.length, reason: 'does not match the stored head' };
    }
  }
  return { ok: true, checked };
}

/**
 * The Redaction rows of the chain (ADR-010), by the seq they name. A row counts only when its
 * Redact event comes after the event it names.
 */
function redactionsOf(sorted: ChangeEntry[]): Map<number, Array<{ originalHash: string; redactedHash: string }>> {
  const out = new Map<number, Array<{ originalHash: string; redactedHash: string }>>();
  for (const e of sorted) {
    if (e.transitionName !== 'Redact') continue;
    for (const r of e.rows) {
      if (r.entity !== 'Redaction' || r.seq >= e.seq) continue;
      out.set(r.seq, [...(out.get(r.seq) || []), { originalHash: r.originalHash, redactedHash: r.redactedHash }]);
    }
  }
  return out;
}

/** Most Redaction rows in one Redact event, so each event stays small. */
export const REDACTIONS_PER_EVENT = 50;

/** The Redact events that record rewritten earlier events (ADR-010). */
export function redactEntries(redactions: Array<{ seq: number; originalHash: string; redactedHash: string }>, at: string): EntryInput[] {
  const out: EntryInput[] = [];
  for (let i = 0; i < redactions.length; i += REDACTIONS_PER_EVENT) {
    out.push({
      transitionName: 'Redact',
      at,
      actorPartyId: 'system',
      rows: redactions.slice(i, i + REDACTIONS_PER_EVENT).map(r => ({ entity: 'Redaction' as const, seq: r.seq, originalHash: r.originalHash, redactedHash: r.redactedHash }))
    });
  }
  return out;
}

export function chainMessage(check: ChainCheck): string {
  if (check.ok) return `History checked: ${check.checked} events, chain intact.`;
  return `History check failed at event ${check.brokenAt} (${check.reason}). Ask your Jira admin to review this issue.`;
}
