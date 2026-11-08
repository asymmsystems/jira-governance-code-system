/**
 * Copyright (c) 2026 Asymm Systems. All rights reserved.
 *
 * LedgerSeal: view model of code signing (ADR-016) for the panel forms and the admin page. Pure logic, no React.
 *
 * @author Fahim Farook
 */

import { DECLARATION } from '../domain/declaration';
import { formatTime } from './view-model';

export interface SigningFormView {
  /** The project needs a code for every signature. */
  needsCode: boolean;
  /** The declaration this form shows and sends (review round 3, D-5), or null when the action has none. */
  declaration: { id: string; version: string; text: string } | null;
  /** Shown instead of the form when code signing cannot be used. */
  blockedText: string | null;
  /** Shown under the code field once a code was sent. */
  sentText: string | null;
  canSubmit: boolean;
}

/**
 * What a signing form shows, from the verify response and the form's code state. `kind` picks the declaration of the
 * form's own action: approval (seal, approval of changes, stage), rejection, or revoke (review round 3, D-5).
 */
export function buildSigningForm(
  result: any,
  state: { challengeId: string | null; expiresAt: string | null; code: string },
  kind: 'approve' | 'reject' | 'revoke' = 'approve'
): SigningFormView {
  const part11 = result?.part11;
  const approve = { id: 'approve', ...(part11?.declaration ?? { version: DECLARATION.version, text: DECLARATION.text }) };
  const own = kind === 'approve' ? approve : part11?.declarations?.[kind] ?? null;
  if (!part11 || !part11.on) return { needsCode: false, declaration: kind === 'approve' ? approve : null, blockedText: null, sentText: null, canSubmit: true };
  if (part11.invalid) {
    return { needsCode: true, declaration: own, blockedText: 'The code signing settings failed their integrity check, so LedgerSeal signs nothing. Ask your Jira admin.', sentText: null, canSubmit: false };
  }
  if (part11.pending) {
    return { needsCode: true, declaration: own, blockedText: 'Code signing is not available yet: its declaration text is waiting for approval.', sentText: null, canSubmit: false };
  }
  const sent = Boolean(state.challengeId);
  return {
    needsCode: true,
    declaration: own,
    blockedText: null,
    sentText: sent ? `We emailed a code to your Atlassian email address. It works once, until ${formatTime(state.expiresAt)}.` : null,
    canSubmit: sent && /^\s*\d{3}[\s-]?\d{3}\s*$/.test(state.code)
  };
}

export const ALERT_TEXT: Record<string, string> = {
  SIGN_FAIL: 'Failed signing attempt',
  CODE_REUSED: 'A used code was tried again',
  LOCKED: 'Locked out after failed attempts',
  RATE_LIMITED: 'Too many code requests',
  CODE_NOT_SENT: 'Jira could not send a code (outgoing email may be off)',
  POLICY_CHANGED: 'A Jira admin changed the code-signing policy'
};

export interface SigningAdminView {
  state: 'LOADING' | 'ERROR' | 'NOT_ADMIN' | 'READY';
  message: string;
  enabled: boolean;
  projectKeys: string;
  lockout: string;
  declarationText: string;
  declarationPending: boolean;
  policyNote: string;
}

/** The "Signing codes" tab, from the signing-policy-get-api response. */
export function buildSigningAdminView(loading: boolean, response: any): SigningAdminView {
  const empty = { enabled: false, projectKeys: '', lockout: '5', declarationText: '', declarationPending: true, policyNote: '' };
  if (loading) return { state: 'LOADING', message: 'Loading code signing...', ...empty };
  if (!response) return { state: 'ERROR', message: 'LedgerSeal could not load code signing. Try again.', ...empty };
  if (response.ok === false) return { state: response.code === 'NOT_ADMIN' ? 'NOT_ADMIN' : 'ERROR', message: String(response.message), ...empty };
  const policy = response.policy;
  const pending = !response.declaration?.approved;
  const keys = ((response.projects ?? []) as { key: string }[]).map(p => p.key).sort().join(', ');
  const note = !response.policyValid
    ? 'The saved settings failed their integrity check. Save them again.'
    : policy
      ? `Version ${policy.version}, saved ${formatTime(policy.fromDate)}. ${policy.enabled ? 'On' : 'Off'}.`
      : 'Not set up. Code signing is off.';
  return {
    state: 'READY',
    message: pending
      ? 'Code signing cannot be turned on yet: the text of declaration version 2 is waiting for the owner\'s approval. You can choose the projects now and save with code signing off.'
      : 'In the projects you name, every seal, approval of changes, revoke, stage signature and rejection needs a single-use code that LedgerSeal emails to the signer\'s own Atlassian address.',
    enabled: Boolean(policy?.enabled),
    projectKeys: keys,
    lockout: String(policy?.lockoutThreshold ?? response.lockoutDefault ?? 5),
    declarationText: String(response.declaration?.text ?? ''),
    declarationPending: pending,
    policyNote: note
  };
}

/** Splits "CHG, OPS ops" into upper-case project keys. */
export function parseProjectKeys(text: string): string[] {
  return [...new Set(String(text ?? '').split(/[\s,;]+/).map(k => k.trim().toUpperCase()).filter(Boolean))];
}

export interface AlertRowView {
  seq: number;
  title: string;
  at: string;
  accountId: string;
  detail: string;
}

/** The "Security alerts" tab rows, newest first as the resolver returns them. */
export function buildAlertRows(response: any): AlertRowView[] {
  return ((response?.alerts ?? []) as any[]).map(a => ({
    seq: Number(a.seq),
    title: ALERT_TEXT[a.kind] ?? String(a.kind),
    at: formatTime(a.at),
    accountId: String(a.accountId ?? ''),
    detail: [a.issueId ? `issue ${a.issueId}` : '', a.action ? `action ${a.action}` : '', a.reason ?? ''].filter(Boolean).join(', ')
  }));
}
