/**
 * Copyright (c) 2026 Asymm Systems. All rights reserved.
 *
 * LedgerSeal admin page view model: pure logic for choosing approver groups. No React.
 *
 * @author Fahim Farook
 */

import { policyText } from './view-model';

export interface GroupChoice {
  groupId: string;
  name: string;
}

export interface AdminInput {
  loading: boolean;
  /** The approver-policy-get-api response; null when the call failed. */
  response: any;
  chosen: GroupChoice[];
  results: GroupChoice[];
}

export interface AdminView {
  state: 'LOADING' | 'ERROR' | 'NOT_ADMIN' | 'READY';
  message: string;
  chosen: GroupChoice[];
  results: GroupChoice[];
  canSave: boolean;
}

export function savedGroups(response: any): GroupChoice[] {
  const parties: any[] = response?.policy?.parties ?? [];
  return parties.map(p => ({ groupId: String(p.partyId), name: String(p.name) }));
}

export function addGroup(chosen: GroupChoice[], group: GroupChoice): GroupChoice[] {
  return chosen.some(g => g.groupId === group.groupId) ? chosen : [...chosen, group];
}

export function removeGroup(chosen: GroupChoice[], groupId: string): GroupChoice[] {
  return chosen.filter(g => g.groupId !== groupId);
}

const ids = (groups: GroupChoice[]) => groups.map(g => g.groupId).sort().join('\n');

export function buildAdminView(input: AdminInput): AdminView {
  const empty = { chosen: [], results: [], canSave: false };
  if (input.loading) return { state: 'LOADING', message: 'Loading the approver groups...', ...empty };
  const r = input.response;
  if (!r) return { state: 'ERROR', message: 'LedgerSeal could not load the approver groups. Try again.', ...empty };
  if (r.ok === false) return { state: r.code === 'NOT_ADMIN' ? 'NOT_ADMIN' : 'ERROR', message: String(r.message), ...empty };
  const chosenIds = new Set(input.chosen.map(g => g.groupId));
  return {
    state: 'READY',
    message: policyText(savedGroups(r).map(g => g.name).sort()),
    chosen: input.chosen,
    results: input.results.filter(g => !chosenIds.has(g.groupId)),
    canSave: ids(input.chosen) !== ids(savedGroups(r))
  };
}
