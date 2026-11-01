/**
 * Pure view model for the issue panel. No UI and no Forge calls, so it is unit-tested.
 *
 * Copyright (c) 2026 Asymm Systems. All rights reserved.
 * @author Fahim Farook
 */
import { ItemState } from '../domain/models';

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
