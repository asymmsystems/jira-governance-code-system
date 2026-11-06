/**
 * Copyright (c) 2026 Asymm Systems. All rights reserved.
 * @author Fahim Farook
 * FourRealities: the four-gate pipeline in words: questions, tooltips, the drift sentence, the next
 * action, alignment text, score parts, the weakest gate and the week-on-week delta (B-33, B-36, B-37).
 * Pure functions; no I/O.
 */

import { GATE_NAMES, GateName, GateResult, IssueGates, IssueRow, ProjectSummary, TrendPoint } from '../contract/data/models';
import { GATE_LABEL, sourceLine, stateLabel } from './gate-text';
import { recentWeeks } from './trend';

/** One plain question per gate. Code says nothing about review: apps cannot read approvals (H11). */
export const GATE_QUESTION: Record<GateName, string> = {
  intent: 'Is the work traced to a decision record?',
  process: 'Is the Definition of Done complete?',
  code: 'Was the work merged through a pull request?',
  audit: 'Is the finished work sealed?'
};

/** Fewest rated issues in each of two weeks before a delta is shown. */
export const MIN_RATED_FOR_DELTA = 10;

export function pipelineTip(gate: GateName, result: GateResult): string {
  return `${GATE_LABEL[gate]}: ${stateLabel(result)}. ${sourceLine(result)}`;
}

type GatesOnly = { gates: IssueGates };

function firstMissing(row: GatesOnly): GateName | undefined {
  return GATE_NAMES.find(g => row.gates[g].state === 'MISSING');
}

const isFound = (r: GateResult) => r.state === 'FOUND';

/** One sentence about the first break in the chain Intent, Process, Code, Audit. */
export function driftText(row: GatesOnly): string {
  const g = firstMissing(row);
  const { gates } = row;
  switch (g) {
    case 'intent':
      return isFound(gates.code) ? 'Code was merged, but it does not trace to a decision record.' : 'No decision record is linked.';
    case 'process':
      if (gates.process.reason === 'DOD_SHAPE_UNKNOWN') return 'The Definition of Done record has a shape DefinitionGuard does not write.';
      if (gates.process.reason === 'DOD_SIGNATURE_INVALID') return 'The Definition of Done record failed its signature check.';
      if (gates.process.reason === 'CHECKLIST_NONE') return 'No Checklists for Jira checklist is on this issue.';
      return gates.process.reason === 'DOD_NONE' ? 'No Definition of Done record is on this issue.' : 'The Definition of Done is not complete.';
    case 'code':
      return gates.code.reason === 'PR_OPEN_AT_DONE' ? 'The issue is done, but its pull request is not merged.' : 'The issue is done, but no pull request is linked.';
    case 'audit':
      if (gates.audit.reason === 'SEAL_SIGNATURE_INVALID') return 'The LedgerSeal record failed its signature check.';
      return gates.audit.reason === 'SEAL_SHAPE_UNKNOWN' ? 'The LedgerSeal record has a shape LedgerSeal does not write.' : 'The issue is not sealed in LedgerSeal.';
    default: {
      const recheck = GATE_NAMES.find(n => gates[n].state === 'NEEDS_RECHECK');
      if (recheck) return `${GATE_LABEL[recheck]} needs a re-check. Use Refresh.`;
      const reported = GATE_NAMES.find(n => gates[n].state === 'REPORTED');
      const evidenced = GATE_NAMES.some(n => isFound(gates[n]) || gates[n].state === 'EXCEPTED');
      if (reported) {
        const note = `${GATE_LABEL[reported]} has a record that is not verified, so it is not scored.`;
        return evidenced ? `Every rated gate has evidence. ${note}` : note;
      }
      return evidenced ? 'Every rated gate has evidence.' : 'No gate applies yet.';
    }
  }
}

/** The one action for the first missing gate, or undefined when nothing is missing. */
export function nextActionText(row: GatesOnly): string | undefined {
  switch (firstMissing(row)) {
    case 'intent': return 'Next: link the decision record.';
    case 'process': return row.gates.process.reason === 'CHECKLIST_NONE'
      ? 'Next: add and complete the checklist in Checklists for Jira.'
      : 'Next: complete the items in the Definition of Done panel on this issue (DefinitionGuard).';
    case 'code': return row.gates.code.reason === 'PR_OPEN_AT_DONE' ? 'Next: merge the pull request.' : 'Next: link a pull request, or request a Code exception.';
    case 'audit': return 'Next: seal the issue in its Approval Seal panel (LedgerSeal).';
    default: return undefined;
  }
}

export function alignmentText(row: Pick<IssueRow, 'rai' | 'risk'>): string {
  return row.rai === null ? 'Alignment: not rated yet' : `Alignment ${row.rai}%`;
}

/** What each gate adds to the score, and what fixing the first missing gate recovers. */
export function scoreParts(row: Pick<IssueRow, 'rai' | 'applicableGates' | 'recoverablePoints' | 'gates'>): string[] {
  if (row.rai === null || row.applicableGates === 0) return ['No gate applies yet, so there is no score.'];
  // The parts add up to the shown score: the rounding remainder goes to the first found gates (F-L5).
  const found = GATE_NAMES.filter(g => row.gates[g].state === 'FOUND');
  const base = found.length === 0 ? 0 : Math.floor(row.rai / found.length);
  const extra = row.rai - base * found.length;
  const lines = GATE_NAMES.map(g => {
    const r = row.gates[g];
    if (r.state === 'FOUND') return `${GATE_LABEL[g]}: +${base + (found.indexOf(g) < extra ? 1 : 0)} (evidence found)`;
    if (r.state === 'MISSING') return `${GATE_LABEL[g]}: 0 (evidence missing)`;
    return `${GATE_LABEL[g]}: not rated (${stateLabel(r).toLowerCase()})`;
  });
  const first = firstMissing(row);
  return first && row.recoverablePoints > 0
    ? [...lines, `Fix ${GATE_LABEL[first]} to reach ${Math.min(100, row.rai + row.recoverablePoints)}%.`]
    : lines;
}

/** The rated gate with the lowest share of evidence found, with its counts. */
export function weakestGate(summary: ProjectSummary): string | undefined {
  const rated = GATE_NAMES
    .map(g => ({ g, found: summary.gates[g].found, of: summary.gates[g].found + summary.gates[g].missing }))
    .filter(x => x.of > 0)
    .map(x => ({ ...x, rate: Math.round((x.found * 100) / x.of) }))
    .sort((a, b) => a.rate - b.rate);
  const w = rated[0];
  return w ? `Weakest gate: ${GATE_LABEL[w.g]}, ${w.rate}% (${w.found} of ${w.of} rated issues).` : undefined;
}

/** Change of average RAI against the previous weekly point, when both weeks rate enough issues. */
export function heroDelta(trend: TrendPoint[]): string {
  const [prev, last] = recentWeeks(trend, 2);
  if (!prev || !last || prev.averageRAI === null || last.averageRAI === null
    || prev.ratedIssues < MIN_RATED_FOR_DELTA || last.ratedIssues < MIN_RATED_FOR_DELTA) {
    return 'Not enough data for a trend yet.';
  }
  const d = last.averageRAI - prev.averageRAI;
  if (d === 0) return `No change since the week of ${prev.weekStart}`;
  return `${d > 0 ? '▲' : '▼'} ${Math.abs(d)} pts since the week of ${prev.weekStart}`;
}

export interface AuditReadinessSummary {
  readonly status: string;
  readonly statusWord: string;
  readonly appearance: 'default' | 'success' | 'removed' | 'inprogress' | 'new' | 'moved';
  readonly summary: string;
  readonly nextStep: string;
}

/** Delivery assurance status banner text across rated issues (B-44). */
export function auditReadiness(issues: IssueRow[]): AuditReadinessSummary {
  if (issues.length === 0) {
    return {
      status: 'Audit readiness: Incomplete',
      statusWord: 'Incomplete',
      appearance: 'removed',
      summary: 'No issues found.',
      nextStep: 'Create issues or adjust filters to review audit readiness.'
    };
  }

  const rated = issues.filter(i => i.rai !== null);
  const unrated = issues.filter(i => i.rai === null);

  if (rated.length === 0) {
    return {
      status: 'Audit readiness: Incomplete',
      statusWord: 'Incomplete',
      appearance: 'removed',
      summary: `0 of ${issues.length} issues are rated.`,
      nextStep: 'Rate issues to assess delivery audit readiness.'
    };
  }

  let applicableGates = 0;
  let evidencedGates = 0;
  let reportedGates = 0;
  const missingByGate: Record<GateName, number> = { intent: 0, process: 0, code: 0, audit: 0 };

  for (const issue of rated) {
    for (const g of GATE_NAMES) {
      const state = issue.gates[g].state;
      if (state === 'REPORTED') {
        // Not verified, so not scored: counted apart, never as evidence (ADR-012).
        reportedGates++;
      } else if (state !== 'NOT_APPLICABLE') {
        applicableGates++;
        if (state === 'FOUND' || state === 'EXCEPTED') {
          evidencedGates++;
        } else if (state === 'MISSING') {
          missingByGate[g]++;
        }
      }
    }
  }

  const reportedNote = reportedGates > 0
    ? ` ${reportedGates} record${reportedGates === 1 ? ' is' : 's are'} reported but not verified, so not scored.`
    : '';
  if (evidencedGates === applicableGates && applicableGates > 0) {
    return {
      status: 'Audit readiness: Complete',
      statusWord: 'Complete',
      appearance: 'success',
      summary: `Evidence found for all ${evidencedGates} applicable gates across ${rated.length} rated issue${rated.length === 1 ? '' : 's'}.${reportedNote}`,
      nextStep: 'All rated gates are evidenced.'
    };
  }

  const mostMissing = GATE_NAMES
    .map(g => ({ gate: g, count: missingByGate[g] }))
    .filter(x => x.count > 0)
    .sort((a, b) => b.count - a.count)[0];

  let nextStep = 'Review gate evidence across rated issues.';
  if (mostMissing) {
    const { gate, count } = mostMissing;
    const issueWord = count === 1 ? 'issue' : 'issues';
    switch (gate) {
      case 'intent':
        nextStep = `Next step: link decision records for ${count} ${issueWord}.`;
        break;
      case 'process':
        nextStep = `Next step: complete the Definition of Done for ${count} ${issueWord}.`;
        break;
      case 'code':
        nextStep = `Next step: link pull requests or request Code exceptions for ${count} ${issueWord}.`;
        break;
      case 'audit':
        nextStep = `Next step: seal ${count} ${issueWord} in LedgerSeal.`;
        break;
    }
  }

  const unratedNote = unrated.length > 0 ? ` (${unrated.length} unrated)` : '';
  return {
    status: 'Audit readiness: Incomplete',
    statusWord: 'Incomplete',
    appearance: 'removed',
    summary: `Evidence found for ${evidencedGates} of ${applicableGates} gates across ${rated.length} rated issue${rated.length === 1 ? '' : 's'}${unratedNote}.${reportedNote}`,
    nextStep
  };
}

/** Formats a compact summary of missing gates for a single issue row (B-44). */
export function issueGapsText(gates: IssueGates): string {
  const missing = GATE_NAMES.filter(g => gates[g].state === 'MISSING');
  if (missing.length === 0) {
    const hasRated = GATE_NAMES.some(g => gates[g].state !== 'NOT_APPLICABLE');
    return hasRated ? 'None' : 'Not rated';
  }
  if (missing.length === 1) {
    return `1 gap: ${GATE_LABEL[missing[0]]}`;
  }
  return `${missing.length} gaps: ${missing.map(g => GATE_LABEL[g]).join(', ')}`;
}

/** Formats how many of the 4 gates have evidence found or excepted (B-44). */
export function evidencedRatioText(gates: IssueGates): string {
  const count = GATE_NAMES.filter(g => gates[g].state === 'FOUND' || gates[g].state === 'EXCEPTED').length;
  return `${count} / 4 evidenced`;
}

export interface IssueReadinessBadge {
  readonly statusWord: string;
  readonly appearance: 'default' | 'success' | 'removed' | 'moved';
}

/** Derives the single-issue readiness badge shown in the issue panel header. */
export function issueReadiness(row: Pick<IssueRow, 'rai' | 'gates'>): IssueReadinessBadge {
  const states = GATE_NAMES.map(g => row.gates[g].state);
  if (states.some(s => s === 'MISSING')) {
    return { statusWord: 'Incomplete', appearance: 'removed' };
  }
  if (states.some(s => s === 'NEEDS_RECHECK')) {
    return { statusWord: 'Needs re-check', appearance: 'moved' };
  }
  if (states.some(s => s === 'FOUND' || s === 'EXCEPTED')) {
    return { statusWord: 'Complete', appearance: 'success' };
  }
  return { statusWord: 'Not rated', appearance: 'default' };
}
