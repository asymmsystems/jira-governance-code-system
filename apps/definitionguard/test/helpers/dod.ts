/**
 * Builders for v3 change-log entries in tests.
 *
 * Copyright (c) 2026 Asymm Systems. All rights reserved.
 * @author Fahim Farook
 */
import { applyEntry, createEntry, emptyState, makeEntry, statusEntry } from '../../src/domain/event-log';
import { toDodTemplate } from '../../src/domain/dod-template';
import { ChangeEntry, ChecklistTemplate, DodState, EntryInput } from '../../src/domain/models';
import { Evidence } from '../../src/domain/evidence';

export const T = '2026-11-01T00:00:00.000Z';

/** A created checklist: the state after entry 1, and entry 1. */
export function created(issueId: string, template: ChecklistTemplate, actor = 'creator', at = T): { state: DodState; entry: ChangeEntry } {
  const base = emptyState(issueId, `DEMO-${issueId}`, '10000');
  const entry = createEntry(base, toDodTemplate(template), actor, at);
  return { state: applyEntry(base, entry), entry };
}

export const tick = (itemId: string, actor: string, at = T, evidence?: Evidence) => (st: DodState): EntryInput[] =>
  [statusEntry(st, { templateItemId: itemId, statusIdTo: 'DOD_DONE', transitionName: 'Complete', actorPartyId: actor, at, evidence })];

export const untick = (itemId: string, actor: string, at = T) => (st: DodState): EntryInput[] =>
  [statusEntry(st, { templateItemId: itemId, statusIdTo: 'DOD_OPEN', transitionName: 'Reopen', actorPartyId: actor, at })];

/** Appends one change to an in-memory chain. */
export function append(state: DodState, inputs: EntryInput[]): { state: DodState; entries: ChangeEntry[] } {
  const entries: ChangeEntry[] = [];
  for (const input of inputs) {
    const e = makeEntry(state, input);
    state = applyEntry(state, e);
    entries.push(e);
  }
  return { state, entries };
}

/** The status row of an entry (the first one). */
export function statusRow(entry: ChangeEntry): any {
  return entry.rows.find(r => r.entity === 'WorkEffortStatus');
}

/** A criterion by template item id. */
export function criterion(state: DodState, itemId: string) {
  return state.criteria.find(c => c.templateItemId === itemId)!;
}
