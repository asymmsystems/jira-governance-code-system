/**
 * Copyright (c) 2026 Asymm Systems. All rights reserved.
 * @author Fahim Farook
 * FourRealities: pipeline, drift sentence, next action, alignment and score parts (B-33, B-36, B-37)
 */

import { GateResult, IssueGates, ProjectSummary, TrendPoint } from '../../src/contract/data/models';
import {
  GATE_QUESTION, alignmentText, driftText, heroDelta, nextActionText, pipelineTip, scoreParts, weakestGate
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

describe('B-36: drift sentence from the first missing gate', () => {
  it('names the break in the chain, using what later gates show', () => {
    expect(driftText({ gates: gates({ intent: miss('INTENT_NONE'), code: FH }) })).toBe('Code was merged, but it does not trace to a decision record.');
    expect(driftText({ gates: gates({ intent: miss('INTENT_NONE') }) })).toBe('No decision record is linked.');
    expect(driftText({ gates: gates({ intent: F, process: miss('DOD_OPEN_DG'), code: FH }) })).toBe('The Definition of Done is not complete.');
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
      intent: { found: 2, missing: 8, excepted: 0, recheck: 0, notApplicable: 0 },
      process: { found: 6, missing: 2, excepted: 0, recheck: 0, notApplicable: 0 },
      code: { found: 0, missing: 0, excepted: 0, recheck: 0, notApplicable: 10 },
      audit: { found: 4, missing: 4, excepted: 0, recheck: 0, notApplicable: 0 }
    },
    m11IntentRate: 20, m29PullRequestRate: null, m30ReworkRate: 0, dodRate: 75, sealRate: 50,
    startedIssues: 12, reworkIssues: 0, riskDistribution: { low: 1, medium: 2, high: 3, critical: 4, unrated: 8 }, ...o
  });

  it('names the weakest rated gate, so an average cannot hide it', () => {
    expect(weakestGate(summary({}))).toBe('Weakest gate: Intent, 20% (2 of 10 rated issues).');
    expect(weakestGate(summary({ gates: { intent: { found: 0, missing: 0, excepted: 0, recheck: 0, notApplicable: 1 }, process: { found: 0, missing: 0, excepted: 0, recheck: 0, notApplicable: 1 }, code: { found: 0, missing: 0, excepted: 0, recheck: 0, notApplicable: 1 }, audit: { found: 0, missing: 0, excepted: 0, recheck: 0, notApplicable: 1 } } }))).toBeUndefined();
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
