/**
 * DefinitionGuard event log: pure functions that build, chain and fold checklist events.
 *
 * Copyright (c) 2026 Asymm Systems. All rights reserved.
 * @author Fahim Farook
 *
 * The state is a fold over the events. The first event (CREATED or MIGRATED) carries the
 * item list, so the state can always be rebuilt from the events alone. Each event stores
 * the hash of the previous one (prevHash), starting from a per-issue genesis hash.
 */
import * as crypto from 'crypto';
import {
  ChecklistEvent,
  ChecklistState,
  ChecklistTemplate,
  EventInput,
  IssueChecklistState,
  ItemState
} from './models';

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

/** The prevHash of event 1. Binds the chain to one issue. */
export function genesisHash(issueId: string): string {
  return sha256(`definitionguard:${issueId}`);
}

/** Hash of an event over every field except `hash`. */
export function hashEvent(event: Omit<ChecklistEvent, 'hash'> & { hash?: string }): string {
  const { hash: _ignored, ...rest } = event;
  return sha256(canonicalJson(rest));
}

export function emptyState(issueId: string, issueKey: string, projectId: string): ChecklistState {
  return {
    schemaVersion: 2,
    issueId,
    issueKey,
    projectId,
    templateId: '',
    templateVersion: 0,
    items: [],
    seq: 0,
    headHash: genesisHash(issueId)
  };
}

/** Builds the next event after `state`: seq + 1, chained to state.headHash. */
export function makeEvent(state: ChecklistState, input: EventInput): ChecklistEvent {
  const unsigned = { ...input, seq: state.seq + 1, issueId: state.issueId, prevHash: state.headHash };
  return { ...unsigned, hash: hashEvent(unsigned) };
}

export function itemsFromTemplate(template: ChecklistTemplate): ItemState[] {
  return template.items.map(t => ({
    id: t.id,
    title: t.title,
    isMandatory: t.isMandatory,
    category: t.category,
    status: 'OPEN' as const
  }));
}

export function createdEvent(state: ChecklistState, template: ChecklistTemplate, actorAccountId: string, at: string): ChecklistEvent {
  return makeEvent(state, {
    type: 'CREATED',
    at,
    actorAccountId,
    issueKey: state.issueKey,
    projectId: state.projectId,
    items: itemsFromTemplate(template),
    templateId: template.id,
    templateVersion: (template as any).version || 1
  });
}

/** Item states taken from a v1 record (dg:checklist:<issueId>). Display names are not carried over. */
export function itemsFromLegacy(legacy: IssueChecklistState): ItemState[] {
  return legacy.items.map(i => ({
    id: i.id,
    title: i.title,
    isMandatory: i.isMandatory,
    category: i.category,
    status: i.isCompleted ? 'DONE' as const : 'OPEN' as const,
    byAccountId: i.isCompleted ? i.completedByAccountId : undefined,
    at: i.isCompleted ? i.completedAt : undefined
  }));
}

export function legacyRefOf(legacy: IssueChecklistState) {
  return {
    stateVersion: legacy.stateVersion || 1,
    eventCount: legacy.auditTrail?.length || 0,
    checklistHash: legacy.checklistHash
  };
}

/** A state derived in memory from a v1 record. seq 0: nothing is stored yet. */
export function stateFromLegacy(legacy: IssueChecklistState, projectId: string): ChecklistState {
  return {
    ...emptyState(legacy.issueId, legacy.issueKey, projectId),
    templateId: legacy.templateId || '',
    templateVersion: 1,
    items: itemsFromLegacy(legacy),
    legacy: legacyRefOf(legacy)
  };
}

export function migratedEvent(state: ChecklistState, legacy: IssueChecklistState, actorAccountId: string, at: string): ChecklistEvent {
  return makeEvent(state, {
    type: 'MIGRATED',
    at,
    actorAccountId,
    issueKey: state.issueKey || legacy.issueKey,
    projectId: state.projectId,
    items: itemsFromLegacy(legacy),
    templateId: legacy.templateId || '',
    templateVersion: 1,
    legacy: legacyRefOf(legacy)
  });
}

/**
 * Applies one event to the state and returns the new state. Pure.
 * Throws when the event does not follow the state (wrong seq, issue or prevHash).
 */
export function applyEvent(state: ChecklistState, event: ChecklistEvent): ChecklistState {
  if (event.seq !== state.seq + 1) {
    throw new Error(`DefinitionGuard: event sequence ${event.seq} does not follow ${state.seq}`);
  }
  if (event.issueId !== state.issueId) {
    throw new Error('DefinitionGuard: event belongs to another issue');
  }
  if (event.prevHash !== state.headHash) {
    throw new Error(`DefinitionGuard: event ${event.seq} prevHash does not match`);
  }

  const next: ChecklistState = {
    ...state,
    seq: event.seq,
    headHash: event.hash,
    lastModifiedAt: event.at,
    lastModifiedByAccountId: event.actorAccountId
  };

  switch (event.type) {
    case 'CREATED':
    case 'MIGRATED':
    case 'RESYNC':
      next.items = (event.items || []).map(i => ({ ...i }));
      next.templateId = event.templateId || state.templateId;
      next.templateVersion = event.templateVersion || state.templateVersion;
      if (event.legacy) next.legacy = event.legacy;
      if (event.issueKey) next.issueKey = event.issueKey;
      if (event.projectId) next.projectId = event.projectId;
      break;
    case 'TICK':
    case 'UNTICK':
    case 'WAIVE':
      next.items = state.items.map(i => {
        if (i.id !== event.itemId) return i;
        if (event.type === 'UNTICK') {
          return { ...i, status: 'OPEN' as const, byAccountId: undefined, at: undefined, eventSeq: event.seq };
        }
        return {
          ...i,
          status: event.type === 'WAIVE' ? 'WAIVED' as const : 'DONE' as const,
          byAccountId: event.actorAccountId,
          at: event.at,
          eventSeq: event.seq
        };
      });
      break;
    case 'RESET':
      next.items = state.items.map(i => ({ ...i, status: 'OPEN' as const, byAccountId: undefined, at: undefined, eventSeq: event.seq }));
      break;
  }
  return next;
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
 * Re-hashes every event in seq order. Reports the first event that is missing, belongs to
 * another issue, breaks the chain, or no longer matches its hash. With `state`, also checks
 * that the chain reaches the stored head (no truncated or replaced tail).
 */
export function verifyChain(issueId: string, events: ChecklistEvent[], state?: ChecklistState): ChainCheck {
  const sorted = [...events].sort((a, b) => a.seq - b.seq);
  let expectedPrev = genesisHash(issueId);
  let checked = 0;
  for (let i = 0; i < sorted.length; i++) {
    const e = sorted[i];
    const seq = i + 1;
    if (e.seq !== seq) return { ok: false, checked, brokenAt: seq, reason: 'event missing' };
    if (e.issueId !== issueId) return { ok: false, checked, brokenAt: seq, reason: 'event belongs to another issue' };
    if (e.prevHash !== expectedPrev) return { ok: false, checked, brokenAt: seq, reason: 'chain broken' };
    if (hashEvent(e) !== e.hash) return { ok: false, checked, brokenAt: seq, reason: 'content changed' };
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

export function chainMessage(check: ChainCheck): string {
  if (check.ok) return `History checked: ${check.checked} events, chain intact.`;
  return `History check failed at event ${check.brokenAt} (${check.reason}). Ask your Jira admin to review this issue.`;
}
