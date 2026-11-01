/**
 * The one Definition of Done rule. The validator and the panel both call evaluateGate.
 *
 * Copyright (c) 2026 Asymm Systems. All rights reserved.
 * @author Fahim Farook
 */
import { CriterionState } from './models';

export interface GateResult {
  satisfied: boolean;
  openMandatory: CriterionState[];
}

/**
 * A mandatory criterion counts as done when it is DOD_WAIVED, or DOD_DONE with evidence when the
 * criterion requires evidence. A criterion that excludes the ASSIGNEE role and was completed by
 * the current assignee counts as open. Zero mandatory criteria means satisfied.
 */
export function criterionCountsAsDone(c: CriterionState, assigneeAccountId?: string): boolean {
  if (c.currentStatusId === 'DOD_WAIVED') return true;
  if (c.currentStatusId !== 'DOD_DONE') return false;
  if (c.evidenceRequired && !c.evidenceContentId) return false;
  if (c.excludedRoleTypeId === 'ASSIGNEE' && assigneeAccountId && c.lastStatusByPartyId === assigneeAccountId) return false;
  return true;
}

export function evaluateGate(state: { criteria: CriterionState[] }, assigneeAccountId?: string): GateResult {
  const openMandatory = state.criteria.filter(c => c.isMandatory && !criterionCountsAsDone(c, assigneeAccountId));
  return { satisfied: openMandatory.length === 0, openMandatory };
}

export function blockMessage(openMandatory: Array<Pick<CriterionState, 'workEffortName'>>): string {
  return `Definition of Done is not complete. Open mandatory items: ${openMandatory.map(c => c.workEffortName).join('; ')}. ` +
    'Open the DefinitionGuard panel on this issue to finish them.';
}
