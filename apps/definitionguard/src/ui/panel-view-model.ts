/**
 * Pure view model for the issue panel. No UI and no Forge calls, so it is unit-tested.
 *
 * Copyright (c) 2026 Asymm Systems. All rights reserved.
 * @author Fahim Farook
 */
import { IssueChecklistState, ItemState } from '../domain/models';

/** Who completed an item, for rendering: a Jira user from the accountId, or v1 text. */
export type Attribution = { kind: 'user'; accountId: string } | { kind: 'text'; text: string };

/**
 * The panel renders `user` with the UI Kit User component, so names are resolved at view time
 * and never stored. A v1 display name is shown as text only when no accountId was recorded.
 */
export function attributionOf(item: Pick<ItemState, 'byAccountId' | 'legacyName'>): Attribution | undefined {
  if (item.byAccountId) return { kind: 'user', accountId: item.byAccountId };
  if (item.legacyName) return { kind: 'text', text: item.legacyName };
  return undefined;
}

export interface GateStatusText {
  satisfied: boolean;
  title: string;
  body: string;
  scope?: string;
}

/**
 * The panel status, from the same gate rule the validator uses (isFullySatisfied and
 * openMandatoryTitles come from evaluateGate). It never claims a block: whether a move is
 * blocked depends on the workflow, so the scope line says where the gate applies.
 */
export function gateStatusText(response: Pick<IssueChecklistState, 'isFullySatisfied' | 'openMandatoryTitles'>): GateStatusText {
  if (response.isFullySatisfied) {
    return { satisfied: true, title: 'Definition of Done satisfied', body: 'This issue can be moved to Done.' };
  }
  return {
    satisfied: false,
    title: 'Definition of Done incomplete',
    body: `Moving to Done is blocked while these items are open: ${(response.openMandatoryTitles || []).join(', ')}.`,
    scope: 'This applies on workflows where your Jira admin added the DefinitionGuard validator.'
  };
}
