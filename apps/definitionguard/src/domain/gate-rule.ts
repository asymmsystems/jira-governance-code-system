/**
 * The one Definition of Done rule. The validator and the panel both call evaluateGate.
 *
 * Copyright (c) 2026 Asymm Systems. All rights reserved.
 * @author Fahim Farook
 */
import { ItemState } from './models';

export interface GateResult {
  satisfied: boolean;
  openMandatory: ItemState[];
}

/**
 * A mandatory item counts as done when it is WAIVED, or DONE with evidence when the item
 * requires evidence. A notAssignee item DONE by the current assignee counts as open.
 * Zero mandatory items means satisfied.
 */
export function itemCountsAsDone(item: ItemState, assigneeAccountId?: string): boolean {
  if (item.status === 'WAIVED') return true;
  if (item.status !== 'DONE') return false;
  if (item.evidenceRequired && !item.hasEvidence) return false;
  if (item.notAssignee && assigneeAccountId && item.byAccountId === assigneeAccountId) return false;
  return true;
}

export function evaluateGate(state: { items: ItemState[] }, assigneeAccountId?: string): GateResult {
  const openMandatory = state.items.filter(i => i.isMandatory && !itemCountsAsDone(i, assigneeAccountId));
  return { satisfied: openMandatory.length === 0, openMandatory };
}

export function blockMessage(openMandatory: Array<Pick<ItemState, 'title'>>): string {
  return `Definition of Done is not complete. Open mandatory items: ${openMandatory.map(i => i.title).join('; ')}. ` +
    'Open the DefinitionGuard panel on this issue to finish them.';
}
