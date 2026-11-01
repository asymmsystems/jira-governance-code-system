/**
 * Copyright (c) 2026 Asymm Systems. All rights reserved.
 * @author Fahim Farook
 * FourRealities: Metrics Evaluation Engine (spec v2, Metrics)
 */

import {
  GATE_NAMES,
  GateCount,
  IssueFacts,
  IssueGates,
  IssueRow,
  ProjectSummary,
  RECOVERY_ORDER,
  RiskLevel
} from '../contract/data/models';
import { MetricsEngine } from '../contract/engines';

const SUMMARY_MAX = 120;

export class DefaultMetricsEngine implements MetricsEngine {
  readonly serviceType = 'engine' as const;

  /**
   * RAI is the rounded mean of the scored gates: FOUND = 100, MISSING = 0.
   * EXCEPTED, NEEDS_RECHECK and NOT_APPLICABLE are not scored. No scored gate gives null (UNRATED).
   */
  public rai(gates: IssueGates): number | null {
    const scored = GATE_NAMES.map(g => gates[g].state).filter(s => s === 'FOUND' || s === 'MISSING');
    if (scored.length === 0) {
      return null;
    }
    const found = scored.filter(s => s === 'FOUND').length;
    return Math.round((found * 100) / scored.length);
  }

  public risk(rai: number | null): RiskLevel {
    if (rai === null) return 'UNRATED';
    if (rai < 50) return 'CRITICAL';
    if (rai < 70) return 'HIGH';
    if (rai < 85) return 'MEDIUM';
    return 'LOW';
  }

  /**
   * Points gained by fixing the first missing gate (Intent, Code, Process, Audit):
   * RAI recomputed with that gate found, minus the current RAI.
   */
  public recoverablePoints(gates: IssueGates): number {
    const current = this.rai(gates);
    const first = RECOVERY_ORDER.find(g => gates[g].state === 'MISSING');
    if (current === null || !first) {
      return 0;
    }
    const fixed: IssueGates = { ...gates, [first]: { state: 'FOUND', reason: gates[first].reason } };
    return (this.rai(fixed) as number) - current;
  }

  public buildRow(facts: IssueFacts, gates: IssueGates): IssueRow {
    const rai = this.rai(gates);
    const summary = facts.summary.length > SUMMARY_MAX ? facts.summary.slice(0, SUMMARY_MAX - 3) + '...' : facts.summary;
    return {
      issueId: facts.issueId,
      issueKey: facts.issueKey,
      summary,
      statusName: facts.statusName,
      statusCategory: facts.statusCategory,
      assigneeName: facts.assigneeName,
      sprintNames: facts.sprintNames,
      started: facts.started,
      gates,
      reworkLoops: facts.reworkLoops,
      rai,
      risk: this.risk(rai),
      applicableGates: GATE_NAMES.filter(g => gates[g].state === 'FOUND' || gates[g].state === 'MISSING').length,
      recoverablePoints: this.recoverablePoints(gates),
      codeException: facts.codeException,
      reworkNote: facts.exception?.rework
    };
  }

  private emptyCount(): GateCount {
    return { found: 0, missing: 0, excepted: 0, recheck: 0, notApplicable: 0 };
  }

  /** found / (found + missing) as a rounded percentage, or null when nothing is scored. */
  public rate(count: Pick<GateCount, 'found' | 'missing'>): number | null {
    const denominator = count.found + count.missing;
    return denominator === 0 ? null : Math.round((count.found * 100) / denominator);
  }

  /**
   * Project summary over the given rows. Rows are counted once each; UNRATED rows are
   * excluded from the average and counted separately.
   */
  public summarize(rows: IssueRow[]): ProjectSummary {
    const gates = {
      intent: this.emptyCount(),
      process: this.emptyCount(),
      code: this.emptyCount(),
      audit: this.emptyCount()
    };
    const riskDistribution = { low: 0, medium: 0, high: 0, critical: 0, unrated: 0 };
    let raiSum = 0;
    let rated = 0;
    let started = 0;
    let rework = 0;

    for (const row of rows) {
      for (const g of GATE_NAMES) {
        const s = row.gates[g].state;
        if (s === 'FOUND') gates[g].found++;
        else if (s === 'MISSING') gates[g].missing++;
        else if (s === 'EXCEPTED') gates[g].excepted++;
        else if (s === 'NEEDS_RECHECK') gates[g].recheck++;
        else gates[g].notApplicable++;
      }
      riskDistribution[row.risk.toLowerCase() as keyof typeof riskDistribution]++;
      if (row.rai !== null) {
        raiSum += row.rai;
        rated++;
      }
      if (row.started) {
        started++;
        if (row.reworkLoops > 0) rework++;
      }
    }

    return {
      totalIssues: rows.length,
      ratedIssues: rated,
      unratedIssues: rows.length - rated,
      averageRAI: rated === 0 ? null : Math.round(raiSum / rated),
      gates,
      m11IntentRate: this.rate(gates.intent),
      m29PullRequestRate: this.rate(gates.code),
      m30ReworkRate: started === 0 ? null : Math.round((rework * 100) / started),
      dodRate: this.rate(gates.process),
      sealRate: this.rate(gates.audit),
      startedIssues: started,
      reworkIssues: rework,
      riskDistribution
    };
  }
}

