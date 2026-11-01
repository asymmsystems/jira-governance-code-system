/**
 * Copyright (c) 2026 Asymm Systems. All rights reserved.
 *
 * LedgerSeal: the issue panel view model (B-15, ux-spec.md section 2).
 * Pure logic with no React import: which state to show, which text, and which actions this user may take.
 * index.tsx only maps this model to UI Kit components.
 *
 * @author Fahim Farook
 */

import { MEANINGS } from '../domain/declaration';
import { LONG_VALUE_CHARS } from '../domain/display';
import { FieldDiff, SealSummary, ViewerRights } from '../domain/models';

export type PanelState =
  | 'LOADING'
  | 'NOT_SEALED'
  | 'SEALED'
  | 'CHANGED'
  | 'CHANGED_BACK'
  | 'REVOKED'
  | 'RECORD_INVALID'
  | 'LEGACY'
  | 'ERROR'
  | 'LICENSE_INACTIVE';

export type LozengeAppearance = 'default' | 'success' | 'removed' | 'moved' | 'inprogress';
export type MessageAppearance = 'information' | 'success' | 'warning' | 'error';

export interface ChangeRowView {
  fieldId: string;
  fieldName: string;
  was: string;
  now: string;
  wasFull: string;
  nowFull: string;
  showFullToggle: boolean;
  detail?: string;
  changedBy: string[];
  changedAt: string;
}

export interface PanelView {
  state: PanelState;
  title: string;
  lozenge: { text: string; appearance: LozengeAppearance } | null;
  message: { appearance: MessageAppearance; lines: string[] };
  actions: { seal?: { label: string; reasonLabel?: string }; approveChanges?: { label: string }; revoke?: { label: string }; retry?: { label: string } };
  askText?: string;
  policyText: string;
  changes: ChangeRowView[];
  covered: string[];
  excluded: { name: string; reason: string }[];
  seal?: {
    certificateId: string;
    signerAccountId: string;
    signerName: string;
    sealedAt: string;
    meaningLabel: string;
    reason: string | null;
    hash: string;
    hashShort: string;
    canonicalizerVersion: string;
    declarationVersion: string;
    historyLength: number;
  };
  revokedByAccountId?: string;
}

export interface PanelInput {
  loading: boolean;
  /** The verify-issue-api result, or null when the call failed. */
  result: any;
  /** True when the call itself threw. */
  error?: boolean;
  locale?: string;
  timeZone?: string;
}

/** The "who can seal" text, naming the approver groups when a Jira admin set some (spec v2 section 7.1). */
export function policyText(groupNames: string[] = []): string {
  if (groupNames.length === 0) return 'Who can seal: project admins and Jira admins.';
  return `Who can seal: project admins, Jira admins and members of ${groupNames.join(', ')}.`;
}

const ASK_APPROVER = 'You cannot seal this issue. Ask a project admin.';
const ASK_OTHER_APPROVER = 'You changed this issue, so another approver must approve it.';
const UNKNOWN_TIME = 'Unknown time';

/** A time in the viewer's locale with the time zone, for example "1 Nov 2026, 14:05 GMT+5:30" (LS-21). */
export function formatTime(iso: string | null | undefined, locale?: string, timeZone?: string): string {
  const instant = iso ? new Date(iso) : null;
  if (!instant || Number.isNaN(instant.getTime())) return UNKNOWN_TIME;
  return new Intl.DateTimeFormat(locale, {
    timeZone,
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
    timeZoneName: 'short'
  }).format(instant);
}

function shortHash(hash: string): string {
  return hash.length > 16 ? `${hash.slice(0, 8)}...${hash.slice(-8)}` : hash;
}

function short(text: string): string {
  return text.length > LONG_VALUE_CHARS ? `${text.slice(0, LONG_VALUE_CHARS)}...` : text;
}

function stateOf(input: PanelInput): PanelState {
  if (input.loading) return 'LOADING';
  const r = input.result;
  if (input.error || !r) return 'ERROR';
  if (r.ok === false) return r.code === 'LICENSE_INACTIVE' ? 'LICENSE_INACTIVE' : 'ERROR';
  switch (r.status) {
    case 'NO_SEAL':
      return 'NOT_SEALED';
    case 'SEAL_VALID':
      return 'SEALED';
    case 'SEAL_BROKEN':
      return 'CHANGED';
    case 'SEAL_COMPROMISED':
      return 'CHANGED_BACK';
    case 'SEAL_REVOKED':
      return 'REVOKED';
    case 'RECORD_INVALID':
      return 'RECORD_INVALID';
    case 'LEGACY':
      return 'LEGACY';
    default:
      return 'ERROR';
  }
}

const TITLES: Record<PanelState, string> = {
  LOADING: 'Checking the seal...',
  NOT_SEALED: 'Not sealed',
  SEALED: 'Sealed. No change since approval.',
  CHANGED: 'Changed after approval',
  CHANGED_BACK: 'Changed after approval, then changed back',
  REVOKED: 'Seal revoked',
  RECORD_INVALID: 'Seal record failed its check',
  LEGACY: 'Sealed with an old format',
  ERROR: 'LedgerSeal could not check this issue',
  LICENSE_INACTIVE: 'LedgerSeal licence is not active'
};

const LOZENGES: Partial<Record<PanelState, { text: string; appearance: LozengeAppearance }>> = {
  NOT_SEALED: { text: 'NOT SEALED', appearance: 'default' },
  SEALED: { text: 'SEALED', appearance: 'success' },
  CHANGED: { text: 'CHANGED', appearance: 'removed' },
  CHANGED_BACK: { text: 'CHANGED', appearance: 'removed' },
  REVOKED: { text: 'REVOKED', appearance: 'moved' },
  RECORD_INVALID: { text: 'CHECK FAILED', appearance: 'removed' },
  LEGACY: { text: 'OLD FORMAT', appearance: 'inprogress' }
};

const APPEARANCES: Record<PanelState, MessageAppearance> = {
  LOADING: 'information',
  NOT_SEALED: 'information',
  SEALED: 'success',
  CHANGED: 'error',
  CHANGED_BACK: 'error',
  REVOKED: 'warning',
  RECORD_INVALID: 'error',
  LEGACY: 'warning',
  ERROR: 'warning',
  LICENSE_INACTIVE: 'warning'
};

function messageLines(state: PanelState, input: PanelInput, seal: SealSummary | undefined): string[] {
  const r = input.result;
  switch (state) {
    case 'NOT_SEALED':
      return ['Seal this issue to record approval of its current content.'];
    case 'SEALED':
      return seal?.everCompromised
        ? [`Resealed after ${seal.incidentCount} change ${seal.incidentCount === 1 ? 'incident' : 'incidents'}. See the history.`]
        : [];
    case 'CHANGED_BACK':
      return ['This issue changed after approval and was later changed back. An approver must approve it again.'];
    case 'REVOKED':
      return seal?.revocation
        ? [`Revoked on ${formatTime(seal.revocation.revokedAt, input.locale, input.timeZone)}. Reason: ${seal.revocation.reason}`]
        : ['This seal was revoked.'];
    case 'RECORD_INVALID':
      return ['The stored seal record failed its integrity check. Contact your Jira admin.'];
    case 'LEGACY':
      return ['This seal uses an old format. Reseal to get the new record.'];
    case 'LICENSE_INACTIVE':
      return ['Ask your Jira admin to renew the LedgerSeal licence. Seals stay in place.'];
    case 'ERROR':
      return r?.errorReason === 'STORAGE'
        ? ['LedgerSeal could not read its seal record. The seal state is unknown. Try again.']
        : ['Jira did not answer. The seal state is unknown. Try again.'];
    default:
      return [];
  }
}

function changeRows(diffs: FieldDiff[], input: PanelInput): ChangeRowView[] {
  return (diffs || []).map(diff => {
    const wasFull = String(diff.sealedValue ?? '(empty)');
    const nowFull = String(diff.liveValue ?? '(empty)');
    return {
      fieldId: diff.fieldId,
      fieldName: diff.fieldName,
      was: short(wasFull),
      now: short(nowFull),
      wasFull,
      nowFull,
      showFullToggle: Boolean(diff.sealedLong || diff.liveLong),
      ...(diff.detail ? { detail: diff.detail } : {}),
      changedBy: diff.changedBy ?? [],
      changedAt: formatTime(diff.changedAt, input.locale, input.timeZone)
    };
  });
}

const NO_RIGHTS: ViewerRights = { canSeal: false, canApproveChanges: false, canRevoke: false, blockedBySelfChange: false };

export function buildPanelView(input: PanelInput): PanelView {
  const state = stateOf(input);
  const r = input.result;
  const rights: ViewerRights = r?.rights ?? NO_RIGHTS;
  const seal: SealSummary | undefined = r?.seal;

  const actions: PanelView['actions'] = {};
  const mayActOn = ['NOT_SEALED', 'SEALED', 'CHANGED', 'CHANGED_BACK', 'REVOKED', 'RECORD_INVALID', 'LEGACY'].includes(state);
  if (state === 'ERROR') actions.retry = { label: 'Try again' };
  if (['NOT_SEALED', 'REVOKED', 'RECORD_INVALID', 'LEGACY'].includes(state) && rights.canSeal) actions.seal = { label: 'Seal this issue' };
  // A seal after a revoke may need a reason (spec v2 section 7.2), and the panel cannot tell whether the issue changed
  if (state === 'REVOKED' && actions.seal) actions.seal.reasonLabel = 'Reason for sealing again (required)';
  if (['CHANGED', 'CHANGED_BACK'].includes(state) && rights.canApproveChanges) actions.approveChanges = { label: 'Approve these changes' };
  if (['SEALED', 'CHANGED', 'CHANGED_BACK'].includes(state) && rights.canRevoke) actions.revoke = { label: 'Revoke seal' };

  let askText: string | undefined;
  if (mayActOn && !actions.seal && !actions.approveChanges && !actions.revoke) {
    askText = rights.blockedBySelfChange ? ASK_OTHER_APPROVER : ASK_APPROVER;
  } else if (mayActOn && rights.blockedBySelfChange && !actions.approveChanges) {
    askText = ASK_OTHER_APPROVER;
  }

  const view: PanelView = {
    state,
    title: TITLES[state],
    lozenge: LOZENGES[state] ?? null,
    message: { appearance: APPEARANCES[state], lines: messageLines(state, input, seal) },
    actions,
    ...(askText ? { askText } : {}),
    policyText: policyText(Array.isArray(r?.approverGroups) ? r.approverGroups : []),
    changes: ['CHANGED', 'CHANGED_BACK'].includes(state) ? changeRows(r?.tamperedFields, input) : [],
    covered: (r?.coveredFields ?? []).map((f: { name: string }) => f.name),
    excluded: (r?.excludedFields ?? []).map((f: { name: string; reason: string }) => ({ name: f.name, reason: f.reason }))
  };

  if (seal) {
    view.seal = {
      certificateId: seal.certificateId,
      signerAccountId: seal.sealedByAccountId,
      signerName: seal.sealedByName,
      sealedAt: formatTime(seal.sealedAt, input.locale, input.timeZone),
      meaningLabel: MEANINGS.find(m => m.value === seal.meaning)?.label ?? seal.meaning,
      reason: seal.reason,
      hash: seal.snapshotHash,
      hashShort: shortHash(seal.snapshotHash),
      canonicalizerVersion: seal.canonicalizerVersion,
      declarationVersion: seal.declarationVersion,
      historyLength: seal.historyLength
    };
    if (seal.revocation) view.revokedByAccountId = seal.revocation.revokedByAccountId;
  }
  return view;
}
