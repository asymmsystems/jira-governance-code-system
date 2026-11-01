/**
 * Copyright (c) 2026 Asymm Systems. All rights reserved.
 * @author Fahim Farook
 * FourRealities: gate labels, sources and plain-English text (no React; spec v2, Gates)
 */

import { GateName, GateReason, GateResult, IssueRow, RECOVERY_ORDER, Verification } from '../contract/data/models';

export const GATE_LABEL: Record<GateName, string> = {
  intent: 'Intent',
  process: 'Process',
  code: 'Code',
  audit: 'Audit'
};

export type LozengeAppearance = 'success' | 'inprogress' | 'removed' | 'moved' | 'default';

export function stateLabel(result: GateResult): string {
  switch (result.state) {
    case 'FOUND':
      if (result.verification === 'NOT_VERIFIED') return 'Evidence found (not verified)';
      if (result.verification === 'HEURISTIC') return 'Evidence found (heuristic)';
      return 'Evidence found';
    case 'MISSING': return 'Evidence missing';
    case 'EXCEPTED': return 'Excepted';
    case 'NEEDS_RECHECK': return 'Needs re-check';
    default: return 'Not applicable';
  }
}

/** ADS lozenge appearance. Only evidence that FourRealities verified itself is green. */
export function appearanceOf(result: GateResult): LozengeAppearance {
  switch (result.state) {
    case 'FOUND': return result.verification === 'VERIFIED' ? 'success' : 'inprogress';
    case 'MISSING': return 'removed';
    case 'EXCEPTED':
    case 'NEEDS_RECHECK': return 'moved';
    default: return 'default';
  }
}

/** Glyph shown next to the text label; never the only signal. */
export function glyphOf(result: GateResult): string {
  switch (result.state) {
    case 'FOUND': return '●';
    case 'MISSING': return '✕';
    case 'EXCEPTED': return '◆';
    case 'NEEDS_RECHECK': return '◐';
    default: return '○';
  }
}

/** Text name for a table chip, for example "Intent: evidence missing". */
export function chipText(gate: GateName, result: GateResult): string {
  return `${GATE_LABEL[gate]}: ${stateLabel(result).charAt(0).toLowerCase()}${stateLabel(result).slice(1)}`;
}

const SOURCE: Record<GateReason, string> = {
  NOT_STARTED: 'Jira status',
  NOT_DONE: 'Jira status',
  INTENT_CONFLUENCE_LINK: 'Jira remote link to Confluence',
  INTENT_DECISION_ISSUE: 'Jira issue link',
  INTENT_LINKS_NOT_READ: 'Jira remote links',
  INTENT_NONE: 'Jira issue links and remote links',
  DOD_COMPLETE_DG: 'DefinitionGuard property definitionguard-dod',
  DOD_OPEN_DG: 'DefinitionGuard property definitionguard-dod',
  DOD_SHAPE_UNKNOWN: 'property definitionguard-dod',
  DOD_COMPLETE_HC: 'Checklists for Jira (HeroCoders) property checklist',
  DOD_OPEN_HC: 'Checklists for Jira (HeroCoders) property checklist',
  DOD_NONE: 'DefinitionGuard property definitionguard-dod',
  CODE_EXCEPTED: 'FourRealities exception record',
  PR_MERGED: 'Jira Development field',
  PR_OPEN: 'Jira Development field',
  PR_OPEN_AT_DONE: 'Jira Development field',
  PR_NONE: 'Jira Development field',
  NO_DEV_TOOL: 'Jira Development field',
  SEAL_VALID_LS: 'LedgerSeal property ledgerseal-cert',
  SEAL_BROKEN_LS: 'LedgerSeal property ledgerseal-cert',
  SEAL_OTHER_LS: 'LedgerSeal property ledgerseal-cert',
  SEAL_SHAPE_UNKNOWN: 'property ledgerseal-cert',
  SEAL_NONE: 'LedgerSeal property ledgerseal-cert',
  CHANGED_SINCE_ATTESTATION: 'Jira issue update time'
};

const VERIFICATION_TEXT: Record<Verification, string> = {
  VERIFIED: 'verified by FourRealities',
  NOT_VERIFIED: 'not verified by FourRealities',
  HEURISTIC: 'heuristic'
};

/** "Source: <source>", plus how FourRealities knows it when evidence was found. */
export function sourceLine(result: GateResult): string {
  const base = `Source: ${SOURCE[result.reason]}`;
  return result.state === 'FOUND' && result.verification ? `${base}, ${VERIFICATION_TEXT[result.verification]}.` : `${base}.`;
}

function arg(result: GateResult, name: string): string {
  const value = result.args?.[name];
  return value === undefined ? '' : String(value);
}

/** One plain sentence that says what was found or what is missing. */
export function detailText(result: GateResult): string {
  switch (result.reason) {
    case 'NOT_STARTED': return 'Work has not started. This gate applies once it does.';
    case 'NOT_DONE': return 'This gate applies when the issue is done.';
    case 'INTENT_CONFLUENCE_LINK': return `Confluence page linked: ${arg(result, 'title')}. FourRealities does not read the page content.`;
    case 'INTENT_DECISION_ISSUE': return `Decision issue linked: ${arg(result, 'key')} (${arg(result, 'type')}).`;
    case 'INTENT_LINKS_NOT_READ': return 'Remote links were not read in this snapshot. Refresh to read them.';
    case 'INTENT_NONE': return 'No Confluence page or decision issue is linked.';
    case 'DOD_COMPLETE_DG': return `DefinitionGuard reports the Definition of Done is complete (${arg(result, 'completed')} of ${arg(result, 'total')} items).`;
    case 'DOD_OPEN_DG': return `DefinitionGuard reports open items (${arg(result, 'completed')} of ${arg(result, 'total')} done).`;
    case 'DOD_SHAPE_UNKNOWN': return 'Record shape not written by DefinitionGuard.';
    case 'DOD_COMPLETE_HC': return 'Checklists for Jira reports no open mandatory items.';
    case 'DOD_OPEN_HC': return `Checklists for Jira reports ${arg(result, 'open')} open mandatory items.`;
    case 'DOD_NONE': return 'No Definition of Done record on this issue.';
    case 'CODE_EXCEPTED': return 'An exception is recorded for this gate.';
    case 'PR_MERGED': return 'Pull request merged. Approval is not readable by apps.';
    case 'PR_OPEN': return 'Pull request open. Approval is not readable by apps.';
    case 'PR_OPEN_AT_DONE': return 'The issue is done and its pull request is not merged.';
    case 'PR_NONE': return 'No pull request is linked to this done issue.';
    case 'NO_DEV_TOOL': return 'No development tool is connected to this site.';
    case 'SEAL_VALID_LS': return `LedgerSeal reports the issue is sealed${arg(result, 'sealedAt') ? ` (${arg(result, 'sealedAt').slice(0, 10)})` : ''}.`;
    case 'SEAL_BROKEN_LS': return 'LedgerSeal reports the seal is broken.';
    case 'SEAL_OTHER_LS': return `LedgerSeal reports status ${arg(result, 'status')}.`;
    case 'SEAL_SHAPE_UNKNOWN': return 'Record shape not written by LedgerSeal.';
    case 'SEAL_NONE': return 'No LedgerSeal record on this issue.';
    case 'CHANGED_SINCE_ATTESTATION': return 'The issue changed after the record was written.';
  }
}

/** RAI text for a row: "62% (HIGH)" or "UNRATED". */
export function raiText(row: Pick<IssueRow, 'rai' | 'risk'>): string {
  return row.rai === null ? 'UNRATED' : `${row.rai}% (${row.risk})`;
}

/**
 * RAI with its parts, shown after the gates (B-21, H5): a single score invites gaming, so it is
 * never shown without the gate counts it comes from.
 */
export function raiPartsText(row: Pick<IssueRow, 'rai' | 'risk' | 'applicableGates' | 'gates'>): string {
  if (row.rai === null) return 'RAI: not rated. No gate applies to this issue yet.';
  const found = Object.values(row.gates).filter(g => g.state === 'FOUND').length;
  return `RAI ${raiText(row)}: ${found} of ${row.applicableGates} rated gates have evidence found. ${row.applicableGates} of 4 gates apply to this issue.`;
}

/** A rate or "n/a" when its denominator is zero. */
export function rateText(rate: number | null): string {
  return rate === null ? 'n/a' : `${rate}%`;
}

export function riskAppearance(risk: IssueRow['risk']): LozengeAppearance {
  if (risk === 'LOW') return 'success';
  if (risk === 'MEDIUM') return 'moved';
  if (risk === 'HIGH' || risk === 'CRITICAL') return 'removed';
  return 'default';
}

/** "Adding Intent evidence raises this issue's RAI by 50 points.", or undefined when nothing is recoverable. */
export function recoveryText(row: Pick<IssueRow, 'gates' | 'recoverablePoints'>): string | undefined {
  const gate = RECOVERY_ORDER.find(g => row.gates[g].state === 'MISSING');
  return gate && row.recoverablePoints > 0
    ? `Adding ${GATE_LABEL[gate]} evidence raises this issue's RAI by ${row.recoverablePoints} points.`
    : undefined;
}

export type PanelAction = 'link' | 'code' | 'rework' | 'decision';

const ACTION_DONE: Record<PanelAction, string> = {
  link: 'Link added.',
  code: 'Exception requested.',
  rework: 'Rework reason recorded.',
  decision: 'Decision recorded.'
};

/**
 * Feedback after a write, built from the row that Jira returned after it (FR-20). Without a
 * row the text says the gates were not read again, and never claims a state.
 */
export function afterActionText(action: PanelAction, row?: Pick<IssueRow, 'gates'>): string {
  const done = ACTION_DONE[action];
  if (action === 'rework') return `${done} It does not change any gate.`;
  if (!row) return `${done} The gates could not be read again. Use Refresh.`;
  if (action === 'link') return `${done} Intent: ${stateLabel(row.gates.intent)}.`;
  if (action === 'code') return `${done} A project administrator must approve it. Code: ${stateLabel(row.gates.code)}.`;
  return `${done} Code: ${stateLabel(row.gates.code)}.`;
}
