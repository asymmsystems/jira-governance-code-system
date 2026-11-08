/**
 * Copyright (c) 2026 Asymm Systems. All rights reserved.
 *
 * LedgerSeal: view model of the signature field on the transition screen (ADR-018, spec v4 section 16.1). Pure logic:
 * which form the field shows, from the same verify response as the panel. No React.
 *
 * @author Fahim Farook
 */

import { buildPanelView } from './view-model';

export type FieldMode = 'LOADING' | 'ERROR' | 'NO_RIGHT' | 'NOT_NEEDED' | 'SEAL' | 'APPROVE' | 'SIGNED';

export interface SignatureFieldView {
  mode: FieldMode;
  text: string;
  needsReason: boolean;
  reasonLabel: string | null;
  action: 'SEAL' | 'RESEAL' | null;
}

export const FIELD_ROUTED_TEXT = 'This issue has an approval route: sign its stages in the LedgerSeal panel, then move the issue.';

export const FIELD_SIGNED_TEXT = 'Signed. Select the transition button to finish. The signature can be used once, within 2 minutes.';

/** What the field shows: a seal or approval form, or why no signature is possible or needed. */
export function buildSignatureFieldView(input: { loading: boolean; result: any; error: boolean; intentId: string | null }): SignatureFieldView {
  const none = { needsReason: false, reasonLabel: null, action: null };
  if (input.intentId) return { mode: 'SIGNED', text: FIELD_SIGNED_TEXT, ...none };
  if (input.loading) return { mode: 'LOADING', text: 'Loading the seal state...', ...none };
  if (input.error || !input.result) return { mode: 'ERROR', text: 'LedgerSeal could not load this issue. Sign in the LedgerSeal panel instead.', ...none };
  if (input.result.ok === false) return { mode: 'ERROR', text: String(input.result.message ?? 'LedgerSeal could not load this issue.'), ...none };
  // ADR-017: a routed issue is signed stage by stage in the panel; this field does not sign route stages
  if (input.result.route && !input.result.route.invalid) return { mode: 'NO_RIGHT', text: FIELD_ROUTED_TEXT, ...none };
  const view = buildPanelView({ loading: false, result: input.result, error: false });
  if (view.actions.approveChanges) {
    return { mode: 'APPROVE', text: view.statusSentence, needsReason: true, reasonLabel: 'Reason for approving these changes (required)', action: 'RESEAL' };
  }
  if (view.actions.seal) {
    const reasonLabel = view.actions.seal.reasonLabel ?? null;
    return { mode: 'SEAL', text: view.statusSentence, needsReason: Boolean(reasonLabel), reasonLabel, action: 'SEAL' };
  }
  if (view.state === 'SEALED') return { mode: 'NOT_NEEDED', text: 'This issue is sealed and unchanged, so no signature is needed here. Select the transition button.', ...none };
  return { mode: 'NO_RIGHT', text: `${view.statusSentence} ${view.askText ?? 'You cannot sign this issue.'}`.trim(), ...none };
}
