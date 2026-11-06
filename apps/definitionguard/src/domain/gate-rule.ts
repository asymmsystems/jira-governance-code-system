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
 * Says whether the person who last set a criterion's status is an assignee that the criterion
 * excludes. A string is one stored party id (the current assignee); a set holds every stored id
 * that stands for an excluded person (account id and pseudonym, ADR-010); a function decides per
 * criterion.
 */
export type ExcludedParties = string | ReadonlySet<string> | ((c: CriterionState) => boolean);

function isExcludedActor(c: CriterionState, excluded?: ExcludedParties): boolean {
  if (!excluded || !c.lastStatusByPartyId) return false;
  if (typeof excluded === 'function') return excluded(c);
  if (typeof excluded === 'string') return c.lastStatusByPartyId === excluded;
  return excluded.has(c.lastStatusByPartyId);
}

/**
 * A mandatory criterion counts as done when it is DOD_WAIVED, or DOD_DONE with evidence when the
 * criterion requires evidence. A criterion that excludes the ASSIGNEE role and was completed or
 * waived by an excluded assignee counts as open (H-1: a waiver is no way around the rule).
 * Zero mandatory criteria means satisfied.
 */
export function criterionCountsAsDone(c: CriterionState, excluded?: ExcludedParties): boolean {
  if (c.currentStatusId === 'DOD_OPEN') return false;
  if (c.excludedRoleTypeId === 'ASSIGNEE' && isExcludedActor(c, excluded)) return false;
  if (c.currentStatusId === 'DOD_WAIVED') return true;
  return !(c.evidenceRequired && !c.evidenceContentId);
}

/** True for a criterion whose last actor the not-the-assignee rule must check at the gate. */
export const needsAssigneeCheck = (c: CriterionState): boolean =>
  c.excludedRoleTypeId === 'ASSIGNEE' && (c.currentStatusId === 'DOD_DONE' || c.currentStatusId === 'DOD_WAIVED');

export function evaluateGate(state: { criteria: CriterionState[] }, excluded?: ExcludedParties): GateResult {
  const openMandatory = state.criteria.filter(c => c.isMandatory && !criterionCountsAsDone(c, excluded));
  return { satisfied: openMandatory.length === 0, openMandatory };
}

export function blockMessage(openMandatory: Array<Pick<CriterionState, 'workEffortName'>>): string {
  return `Definition of Done is not complete. Open mandatory items: ${openMandatory.map(c => c.workEffortName).join('; ')}. ` +
    'Open the Definition of Done panel on this issue (from the View app actions button if it is not shown) to finish them.';
}
