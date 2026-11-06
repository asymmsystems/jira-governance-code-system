/**
 * Copyright (c) 2026 Asymm Systems. All rights reserved.
 * @author Fahim Farook
 * FourRealities: pipeline, drift sentence, next action, alignment and score parts (B-33, B-36, B-37)
 */

import { GateResult, IssueGates, IssueRow, ProjectSummary, TrendPoint } from '../../src/contract/data/models';
import {
  GATE_QUESTION, alignmentText, auditReadiness, driftText, evidencedRatioText, heroDelta, issueGapsText, issueReadiness, nextActionText, pipelineTip, scoreParts, weakestGate
} from '../../src/ui/pipeline';

const F: GateResult = { state: 'FOUND', verification: 'VERIFIED', reason: 'INTENT_CONFLUENCE_LINK' };
const FH: GateResult = { state: 'FOUND', verification: 'HEURISTIC', reason: 'PR_MERGED', args: { count: 1 } };
const NA: GateResult = { state: 'NOT_APPLICABLE', reason: 'NOT_DONE' };
const gates = (o: Partial<IssueGates>): IssueGates => ({ intent: NA, process: NA, code: NA, audit: NA, ...o });
const miss = (reason: GateResult['reason']): GateResult => ({ state: 'MISSING', reason });

describe('B-33: pipeline tips and questions', () => {
  it('asks one plain question per gate, and never claims a review approval for Code', () => {
    expect(GATE_QUESTION.code).toBe('Was the work merged through a pull request?');
    expect(Object.values(GATE_QUESTION).join(' ')).not.toMatch(/approv|review/i);
  });

  it('gives each gate a tooltip with its state and source', () => {
    expect(pipelineTip('intent', F)).toBe('Intent: Evidence found. Source: Jira remote link to Confluence, verified by FourRealities.');
    expect(pipelineTip('code', NA)).toBe('Code: Not applicable. Source: Jira status.');
  });
});

describe('ADR-010: drift sentence with a reported record', () => {
  const rep: GateResult = { state: 'REPORTED', verification: 'NOT_VERIFIED', reason: 'SEAL_VALID_LS' };
  it('says the record is not verified, with or without other evidence', () => {
    expect(driftText({ gates: gates({ intent: F, audit: rep }) })).toBe('Every rated gate has evidence. Audit has a record that is not verified, so it is not scored.');
    expect(driftText({ gates: gates({ audit: rep }) })).toBe('Audit has a record that is not verified, so it is not scored.');
  });
});

describe('F-L5: score parts add up to the shown score', () => {
  it('gives the rounding remainder to the first found gates', () => {
    const lines = scoreParts({ rai: 67, applicableGates: 3, recoverablePoints: 33, gates: gates({ intent: miss('INTENT_NONE'), process: F, audit: F }) });
    expect(lines).toContain('Process: +34 (evidence found)');
    expect(lines).toContain('Audit: +33 (evidence found)');
    expect(scoreParts({ rai: 0, applicableGates: 1, recoverablePoints: 100, gates: gates({ intent: miss('INTENT_NONE') }) })).toContain('Intent: 0 (evidence missing)');
  });
});

describe('B-36: drift sentence from the first missing gate', () => {
  it('names the break in the chain, using what later gates show', () => {
    expect(driftText({ gates: gates({ intent: miss('INTENT_NONE'), code: FH }) })).toBe('Code was merged, but it does not trace to a decision record.');
    expect(driftText({ gates: gates({ intent: miss('INTENT_NONE') }) })).toBe('No decision record is linked.');
    expect(driftText({ gates: gates({ intent: F, process: miss('DOD_OPEN_DG'), code: FH }) })).toBe('The Definition of Done is not complete.');
    // Found live on AUDT-1: with no DefinitionGuard record the sentence said "not complete".
    expect(driftText({ gates: gates({ intent: F, process: miss('DOD_NONE') }) })).toBe('No Definition of Done record is on this issue.');
    expect(driftText({ gates: gates({ intent: F, process: miss('DOD_OPEN_HC') }) })).toBe('The Definition of Done is not complete.');
    expect(driftText({ gates: gates({ intent: F, process: miss('DOD_SHAPE_UNKNOWN') }) })).toBe('The Definition of Done record has a shape DefinitionGuard does not write.');
    expect(driftText({ gates: gates({ intent: F, code: miss('PR_NONE') }) })).toBe('The issue is done, but no pull request is linked.');
    expect(driftText({ gates: gates({ intent: F, code: miss('PR_OPEN_AT_DONE') }) })).toBe('The issue is done, but its pull request is not merged.');
    expect(driftText({ gates: gates({ intent: F, audit: miss('SEAL_NONE') }) })).toBe('The issue is not sealed in LedgerSeal.');
    expect(driftText({ gates: gates({ intent: F, audit: miss('SEAL_SHAPE_UNKNOWN') }) })).toBe('The LedgerSeal record has a shape LedgerSeal does not write.');
  });

  it('says when nothing is missing, and when no gate applies yet', () => {
    expect(driftText({ gates: gates({ intent: F, code: FH }) })).toBe('Every rated gate has evidence.');
    expect(driftText({ gates: gates({}) })).toBe('No gate applies yet.');
    expect(driftText({ gates: gates({ intent: { state: 'NEEDS_RECHECK', reason: 'INTENT_LINKS_NOT_READ' } }) })).toBe('Intent needs a re-check. Use Refresh.');
  });

  it('gives one next action for the first missing gate', () => {
    expect(nextActionText({ gates: gates({ intent: miss('INTENT_NONE'), code: miss('PR_NONE') }) })).toBe('Next: link the decision record.');
    expect(nextActionText({ gates: gates({ intent: F, process: miss('DOD_NONE') }) })).toBe('Next: complete the Definition of Done in DefinitionGuard.');
    expect(nextActionText({ gates: gates({ intent: F, code: miss('PR_NONE') }) })).toBe('Next: link a pull request, or request a Code exception.');
    expect(nextActionText({ gates: gates({ intent: F, code: miss('PR_OPEN_AT_DONE') }) })).toBe('Next: merge the pull request.');
    expect(nextActionText({ gates: gates({ intent: F, audit: miss('SEAL_NONE') }) })).toBe('Next: seal the issue in LedgerSeal.');
    expect(nextActionText({ gates: gates({ intent: F }) })).toBeUndefined();
  });
});

describe('B-37: alignment, score parts, weakest gate, hero delta', () => {
  it('leads with Alignment, keeps risk as a word, and says when nothing is rated', () => {
    expect(alignmentText({ rai: 67, risk: 'HIGH' })).toBe('Alignment 67%');
    expect(alignmentText({ rai: null, risk: 'UNRATED' })).toBe('Alignment: not rated yet');
  });

  it('lists what each gate adds and what the first fix recovers', () => {
    const row = { rai: 50, applicableGates: 2, recoverablePoints: 50, gates: gates({ intent: F, code: miss('PR_NONE') }) };
    expect(scoreParts(row)).toEqual([
      'Intent: +50 (evidence found)',
      'Process: not rated (not applicable)',
      'Code: 0 (evidence missing)',
      'Audit: not rated (not applicable)',
      'Fix Code to reach 100%.'
    ]);
    expect(scoreParts({ rai: null, applicableGates: 0, recoverablePoints: 0, gates: gates({}) })).toEqual(['No gate applies yet, so there is no score.']);
  });

  const summary = (o: Partial<ProjectSummary>): ProjectSummary => ({
    totalIssues: 20, ratedIssues: 12, unratedIssues: 8, averageRAI: 60,
    gates: {
      intent: { found: 2, missing: 8, reported: 0, excepted: 0, recheck: 0, notApplicable: 0 },
      process: { found: 6, missing: 2, reported: 0, excepted: 0, recheck: 0, notApplicable: 0 },
      code: { found: 0, missing: 0, reported: 0, excepted: 0, recheck: 0, notApplicable: 10 },
      audit: { found: 4, missing: 4, reported: 0, excepted: 0, recheck: 0, notApplicable: 0 }
    },
    m11IntentRate: 20, m29PullRequestRate: null, m30ReworkRate: 0, dodRate: 75, sealRate: 50,
    startedIssues: 12, reworkIssues: 0, riskDistribution: { low: 1, medium: 2, high: 3, critical: 4, unrated: 8 }, ...o
  });

  it('names the weakest rated gate, so an average cannot hide it', () => {
    expect(weakestGate(summary({}))).toBe('Weakest gate: Intent, 20% (2 of 10 rated issues).');
    expect(weakestGate(summary({ gates: { intent: { found: 0, missing: 0, reported: 0, excepted: 0, recheck: 0, notApplicable: 1 }, process: { found: 0, missing: 0, reported: 0, excepted: 0, recheck: 0, notApplicable: 1 }, code: { found: 0, missing: 0, reported: 0, excepted: 0, recheck: 0, notApplicable: 1 }, audit: { found: 0, missing: 0, reported: 0, excepted: 0, recheck: 0, notApplicable: 1 } } }))).toBeUndefined();
  });

  const pt = (weekStart: string, averageRAI: number | null, ratedIssues = 12): TrendPoint => ({
    weekStart, generatedAt: `${weekStart}T00:00:00.000Z`, ratedIssues, averageRAI,
    gates: { intent: { found: 0, missing: 0 }, process: { found: 0, missing: 0 }, code: { found: 0, missing: 0 }, audit: { found: 0, missing: 0 } }, startedIssues: 0, reworkIssues: 0
  });

  it('compares with the previous week only when both weeks rate at least 10 issues', () => {
    expect(heroDelta([pt('2026-10-19', 54), pt('2026-10-26', 60)])).toBe('▲ 6 pts since the week of 2026-10-19');
    expect(heroDelta([pt('2026-10-19', 64), pt('2026-10-26', 60)])).toBe('▼ 4 pts since the week of 2026-10-19');
    expect(heroDelta([pt('2026-10-19', 60), pt('2026-10-26', 60)])).toBe('No change since the week of 2026-10-19');
    expect(heroDelta([pt('2026-10-19', 54, 3), pt('2026-10-26', 60)])).toBe('Not enough data for a trend yet.');
    expect(heroDelta([pt('2026-10-26', 60)])).toBe('Not enough data for a trend yet.');
    expect(heroDelta([pt('2026-10-19', null), pt('2026-10-26', 60)])).toBe('Not enough data for a trend yet.');
  });
});

describe('B-44: audit readiness sentence and gaps text', () => {
  const row = (issueKey: string, rai: number | null, g: Partial<IssueGates>): IssueRow => ({
    issueId: '1', issueKey, summary: `Summary of ${issueKey}`, statusName: 'Done',
    statusCategory: 'done', sprintNames: [], started: true, reworkLoops: 0,
    rai, gates: gates(g), risk: 'LOW', applicableGates: 4, recoverablePoints: 0
  });

  it('summarises audit readiness across rated issues', () => {
    expect(auditReadiness([])).toEqual({
      status: 'Audit readiness: Incomplete',
      statusWord: 'Incomplete',
      appearance: 'removed',
      summary: 'No issues found.',
      nextStep: 'Create issues or adjust filters to review audit readiness.'
    });

    const unrated = row('DEMO-1', null, {});
    expect(auditReadiness([unrated])).toEqual({
      status: 'Audit readiness: Incomplete',
      statusWord: 'Incomplete',
      appearance: 'removed',
      summary: '0 of 1 issues are rated.',
      nextStep: 'Rate issues to assess delivery audit readiness.'
    });

    const partial1 = row('AUDT-1', 25, { intent: F, process: miss('DOD_NONE') });
    const partial2 = row('AUDT-2', 25, { intent: F, process: miss('DOD_NONE'), code: miss('PR_NONE') });
    expect(auditReadiness([partial1, partial2])).toEqual({
      status: 'Audit readiness: Incomplete',
      statusWord: 'Incomplete',
      appearance: 'removed',
      summary: 'Evidence found for 2 of 5 gates across 2 rated issues.',
      nextStep: 'Next step: complete Definition of Done for 2 issues in DefinitionGuard.'
    });

    const singleMissingIntent = row('AUDT-1', 25, { intent: miss('INTENT_NONE') });
    expect(auditReadiness([singleMissingIntent]).nextStep).toBe('Next step: link decision records for 1 issue.');

    const singleMissingCode = row('AUDT-1', 25, { code: miss('PR_NONE') });
    expect(auditReadiness([singleMissingCode]).nextStep).toBe('Next step: link pull requests or request Code exceptions for 1 issue.');

    const singleMissingAudit = row('AUDT-1', 25, { audit: miss('SEAL_NONE') });
    expect(auditReadiness([singleMissingAudit]).nextStep).toBe('Next step: seal 1 issue in LedgerSeal.');

    const complete = row('AUDT-3', 100, { intent: F, process: F, code: F, audit: F });
    expect(auditReadiness([complete])).toEqual({
      status: 'Audit readiness: Complete',
      statusWord: 'Complete',
      appearance: 'success',
      summary: 'Evidence found for all 4 applicable gates across 1 rated issue.',
      nextStep: 'All rated gates are evidenced.'
    });
  });

  it('ADR-010: leaves reported records out of readiness and names how many there are', () => {
    const rep: GateResult = { state: 'REPORTED', verification: 'NOT_VERIFIED', reason: 'SEAL_VALID_LS' };
    expect(auditReadiness([row('AUDT-4', 100, { intent: F, audit: rep })])).toMatchObject({
      statusWord: 'Complete',
      summary: 'Evidence found for all 1 applicable gates across 1 rated issue. 1 record is reported but not verified, so not scored.'
    });
    expect(auditReadiness([row('AUDT-4', 0, { intent: miss('INTENT_NONE'), audit: rep, process: rep })]).summary)
      .toBe('Evidence found for 0 of 1 gates across 1 rated issue. 2 records are reported but not verified, so not scored.');
  });

  it('formats missing gates gaps text and evidenced ratio for triage rows', () => {
    expect(issueGapsText(gates({ intent: miss('INTENT_NONE'), code: miss('PR_NONE') }))).toBe('2 gaps: Intent, Code');
    expect(issueGapsText(gates({ process: miss('DOD_NONE') }))).toBe('1 gap: Process');
    expect(issueGapsText(gates({ intent: F, process: F }))).toBe('None');
    expect(issueGapsText(gates({}))).toBe('Not rated');

    expect(evidencedRatioText(gates({ intent: F, code: { state: 'EXCEPTED', reason: 'CODE_EXCEPTED' } }))).toBe('2 / 4 evidenced');
    expect(evidencedRatioText(gates({}))).toBe('0 / 4 evidenced');
  });

  it('derives single-issue readiness word and lozenge appearance for the panel header', () => {
    expect(issueReadiness(row('DEMO-1', null, {}))).toEqual({ statusWord: 'Not rated', appearance: 'default' });
    expect(issueReadiness(row('DEMO-2', 50, { intent: F, code: miss('PR_NONE') }))).toEqual({ statusWord: 'Incomplete', appearance: 'removed' });
    expect(issueReadiness(row('DEMO-3', null, { intent: { state: 'NEEDS_RECHECK', reason: 'INTENT_LINKS_NOT_READ' } }))).toEqual({ statusWord: 'Needs re-check', appearance: 'moved' });
    expect(issueReadiness(row('DEMO-4', 100, { intent: F, process: F }))).toEqual({ statusWord: 'Complete', appearance: 'success' });
  });
});
