/**
 * Copyright (c) 2026 Asymm Systems. All rights reserved.
 * @author Asymm Systems Team
 * FourRealities: Metrics Evaluation Engine
 */

import {
  RealitySignals,
  IssueIntegrityScore,
  MetricSummary,
  RiskLevel,
  GateStatus,
  IssueGates,
  RealityGateCounts,
  ProjectAuditSnapshot
} from './models';

export class MetricsEngine {
  /**
   * Evaluates the status of the four delivery reality gates for a single issue.
   */
  public static evaluateGates(signals: RealitySignals): IssueGates {
    // 1. Intent Gate
    let intent: GateStatus = 'BLOCKED';
    if (signals.hasDocumentedIntent) {
      intent = 'PASSED';
    } else if (signals.statusCategory === 'To Do' && signals.transitionCount <= 1) {
      intent = 'HOLLOW';
    } else {
      intent = 'BLOCKED';
    }

    // 2. Process Gate
    let process: GateStatus = 'PASSED';
    if (signals.statusCategory === 'To Do' && signals.transitionCount <= 1) {
      process = 'HOLLOW';
    } else if (signals.regressionCount > 0) {
      process = 'ATTENTION';
    } else {
      process = 'PASSED';
    }

    // 3. Code Gate
    let code: GateStatus = 'BLOCKED';
    if (signals.codeExceptionReason) {
      code = 'PASSED';
    } else if (signals.prCount === 0) {
      code = (signals.statusCategory === 'To Do' || signals.statusCategory === 'In Progress')
        ? 'HOLLOW'
        : 'BLOCKED';
    } else {
      code = signals.hasApprovedReview ? 'PASSED' : 'BLOCKED';
    }

    // 4. Audit Gate
    let audit: GateStatus = 'BLOCKED';
    if (signals.statusCategory !== 'Done') {
      if (signals.isDoDSatisfied && signals.hasCryptographicSeal) {
        audit = 'PASSED';
      } else {
        audit = 'HOLLOW';
      }
    } else {
      // Done status: verification required
      if (signals.isDoDSatisfied && signals.hasCryptographicSeal) {
        audit = 'PASSED';
      } else if (signals.isDoDSatisfied || signals.hasCryptographicSeal) {
        audit = 'ATTENTION';
      } else {
        audit = 'BLOCKED';
      }
    }

    return { intent, process, code, audit };
  }

  /**
   * Synthesizes a human-readable one-line finding based on the first blocked or attention gate.
   * Free of obscure metric codes.
   */
  public static synthesizeFinding(gates: IssueGates, signals: RealitySignals): string {
    if (gates.intent === 'BLOCKED') {
      return 'Work lacks documented architectural intent or Confluence ADR link.';
    }
    if (gates.code === 'BLOCKED') {
      return signals.prCount === 0
        ? 'Work completed without a linked Pull Request or code branch.'
        : 'Pull Request was merged without verified peer review approval.';
    }
    if (gates.audit === 'BLOCKED') {
      return 'Definition of Done is incomplete and cryptographic seal is missing.';
    }
    if (gates.process === 'ATTENTION') {
      return signals.reworkReason
        ? `Workflow rework noted: ${signals.reworkReason}.`
        : `Workflow experienced ${signals.regressionCount} rework loop(s) indicating requirement churn.`;
    }
    if (gates.audit === 'ATTENTION') {
      return !signals.hasCryptographicSeal
        ? 'Definition of Done satisfied, but cryptographic seal is unverified.'
        : 'Cryptographic seal recorded, but Definition of Done is incomplete.';
    }
    if (gates.intent === 'HOLLOW' && gates.process === 'HOLLOW' && gates.code === 'HOLLOW' && gates.audit === 'HOLLOW') {
      return 'Work is in early planning stage. Link an architectural decision to begin alignment tracking.';
    }
    return 'All evaluated delivery reality gates verified and aligned.';
  }

  /**
   * Calculates points recoverable by closing the primary blocked gate.
   */
  public static calculateRecoverablePoints(gates: IssueGates, signals: RealitySignals, currentRAI: number): number {
    let potential = 0;
    if (gates.intent === 'BLOCKED') potential = 25;
    else if (gates.code === 'BLOCKED') potential = signals.prCount === 0 ? 25 : 15;
    else if (gates.audit === 'BLOCKED') potential = 25;
    else if (gates.audit === 'ATTENTION') potential = 12;
    else if (gates.process === 'ATTENTION') potential = 15;

    return Math.min(potential, Math.max(0, 100 - currentRAI));
  }

  /**
   * Calculates reality alignment scores across applicable delivery realities for a single issue.
   * Hollow gates (not yet applicable) are excluded from scoring so early-stage issues are not penalized.
   */
  public static evaluateIssue(signals: RealitySignals): IssueIntegrityScore {
    const gates = this.evaluateGates(signals);
    const findings: string[] = [];

    // Calculate individual gate scores (0 - 100)
    const intentScore = signals.hasDocumentedIntent ? 100 : 0;
    const processPenalty = signals.regressionCount * 25;
    const processScore = Math.max(0, 100 - processPenalty);

    let codeScore = 0;
    if (signals.codeExceptionReason || signals.hasApprovedReview) {
      codeScore = 100;
    } else if (signals.prCount > 0) {
      codeScore = 40; // Merged without approval
    } else {
      codeScore = 0;
    }

    let auditScore = 0;
    if (signals.isDoDSatisfied) auditScore += 50;
    if (signals.hasCryptographicSeal) auditScore += 50;

    // Collect applicable (non-hollow) gates for non-punitive composite scoring
    const applicableGates: Array<{ name: string; score: number }> = [];
    if (gates.intent !== 'HOLLOW') applicableGates.push({ name: 'Intent', score: intentScore });
    if (gates.process !== 'HOLLOW') applicableGates.push({ name: 'Process', score: processScore });
    if (gates.code !== 'HOLLOW') applicableGates.push({ name: 'Code', score: codeScore });
    if (gates.audit !== 'HOLLOW') applicableGates.push({ name: 'Audit', score: auditScore });

    const isEvaluated = applicableGates.length > 0;
    const applicableGateCount = applicableGates.length;

    let realityAlignmentIndex = 100;
    let riskLevel: RiskLevel = 'LOW';

    if (isEvaluated) {
      const sumScores = applicableGates.reduce((acc, g) => acc + g.score, 0);
      realityAlignmentIndex = Math.round(sumScores / applicableGateCount);

      if (realityAlignmentIndex < 50) {
        riskLevel = 'CRITICAL';
      } else if (realityAlignmentIndex < 70) {
        riskLevel = 'HIGH';
      } else if (realityAlignmentIndex < 85) {
        riskLevel = 'MEDIUM';
      } else {
        riskLevel = 'LOW';
      }
    } else {
      // Early state with zero applicable gates: unrated baseline
      riskLevel = 'LOW';
    }

    // Build plain-English finding items
    if (gates.intent === 'BLOCKED') {
      findings.push('Architectural Intent: Missing Confluence ADR or technical specification link.');
    }
    if (gates.process === 'ATTENTION') {
      findings.push(`Workflow Stability: ${signals.regressionCount} rework loop(s) detected (reopened from review/testing).`);
    }
    if (gates.code === 'BLOCKED') {
      if (signals.prCount === 0) {
        findings.push('Review Compliance: No associated Pull Request or commit branch linked.');
      } else {
        findings.push('Review Compliance: Pull Request merged without verified peer review approval.');
      }
    }
    if (gates.audit === 'BLOCKED') {
      findings.push('Audit Verification: Definition of Done incomplete and cryptographic seal missing.');
    } else if (gates.audit === 'ATTENTION') {
      if (!signals.hasCryptographicSeal) {
        findings.push('Audit Verification: Definition of Done satisfied, but cryptographic seal is missing.');
      } else {
        findings.push('Audit Verification: Cryptographic seal recorded, but Definition of Done is incomplete.');
      }
    }
    if (signals.codeExceptionReason) {
      findings.push(`Approved Exception: ${signals.codeExceptionReason}`);
    }

    // Generate plain-English score attribution explanation
    let whyScoreExplanation = '';
    if (!isEvaluated) {
      whyScoreExplanation = 'Early stage: Gates will be evaluated as work moves through delivery.';
    } else {
      const weight = Math.round(100 / applicableGateCount);
      const intentContrib = gates.intent === 'HOLLOW' ? 'Intent —' : `Intent +${Math.round((intentScore / 100) * weight)}`;
      const processContrib = gates.process === 'HOLLOW' ? 'Process —' : `Process +${Math.round((processScore / 100) * weight)}`;
      const codeContrib = gates.code === 'HOLLOW' ? 'Code —' : `Code +${Math.round((codeScore / 100) * weight)}`;
      const auditContrib = gates.audit === 'HOLLOW' ? 'Audit —' : `Audit +${Math.round((auditScore / 100) * weight)}`;
      whyScoreExplanation = `Why ${realityAlignmentIndex}%? ${intentContrib} · ${processContrib} · ${codeContrib} · ${auditContrib}`;
    }

    const synthesizedFinding = this.synthesizeFinding(gates, signals);
    const recoverablePoints = this.calculateRecoverablePoints(gates, signals, realityAlignmentIndex);

    return {
      issueId: signals.issueId,
      issueKey: signals.issueKey,
      summary: signals.summary,
      status: signals.status,
      statusCategory: signals.statusCategory,
      assigneeName: signals.assigneeName,
      sprintName: signals.sprintName,
      isEvaluated,
      applicableGateCount,
      intentScore,
      processScore,
      codeScore,
      auditScore,
      realityAlignmentIndex,
      riskLevel,
      gates,
      synthesizedFinding,
      recoverablePoints,
      findings,
      whyScoreExplanation
    };
  }

  /**
   * Helper to create empty gate counts.
   */
  private static createEmptyGateCounts(): RealityGateCounts {
    return { passed: 0, attention: 0, blocked: 0, hollow: 0 };
  }

  /**
   * Calculates project-level executive summary metrics across all audited issues.
   * Compares against authentic previous snapshot if provided.
   */
  public static summarizeProject(
    signalsList: RealitySignals[],
    previousSnapshot?: ProjectAuditSnapshot
  ): MetricSummary {
    const total = signalsList.length;
    const gateBreakdown = {
      intent: this.createEmptyGateCounts(),
      process: this.createEmptyGateCounts(),
      code: this.createEmptyGateCounts(),
      audit: this.createEmptyGateCounts()
    };
    const riskDistribution = { low: 0, medium: 0, high: 0, critical: 0 };

    // Detect sprint name dynamically from issues
    const dynamicSprintName = signalsList.find(s => Boolean(s.sprintName))?.sprintName || 'Active Delivery';

    if (total === 0) {
      return {
        m11TraceabilityRate: 0,
        m29ReviewComplianceRate: 0,
        m30ReworkLoopRate: 0,
        m40AuditComplianceRate: 0,
        averageRAI: 0,
        totalAuditedIssues: 0,
        doneCount: 0,
        sealedDoneCount: 0,
        healthyIssueCount: 0,
        atRiskIssueCount: 0,
        highRiskIssueKeys: [],
        gateBreakdown,
        weakestGate: 'audit',
        sprintDelta: undefined,
        sprintName: dynamicSprintName,
        hasTrendHistory: false,
        trendNotice: 'Trend available after 2 scans (minimum 10 completed issues)',
        biggestMover: undefined,
        riskDistribution
      };
    }

    let countWithIntent = 0;
    let countWithApprovedReview = 0;
    let countWithRework = 0;
    let doneCount = 0;
    let sealedDoneCount = 0;
    let sumRAI = 0;
    let healthyCount = 0;
    let atRiskCount = 0;
    const highRiskKeys: string[] = [];

    for (const signals of signalsList) {
      if (signals.hasDocumentedIntent) countWithIntent++;
      if (signals.hasApprovedReview || signals.codeExceptionReason) countWithApprovedReview++;
      if (signals.regressionCount > 0) countWithRework++;

      const isDone = signals.statusCategory === 'Done';
      if (isDone) {
        doneCount++;
        if (signals.hasCryptographicSeal && signals.isDoDSatisfied) {
          sealedDoneCount++;
        }
      }

      const score = this.evaluateIssue(signals);
      sumRAI += score.realityAlignmentIndex;

      // Update gate breakdown
      gateBreakdown.intent[score.gates.intent.toLowerCase() as keyof RealityGateCounts]++;
      gateBreakdown.process[score.gates.process.toLowerCase() as keyof RealityGateCounts]++;
      gateBreakdown.code[score.gates.code.toLowerCase() as keyof RealityGateCounts]++;
      gateBreakdown.audit[score.gates.audit.toLowerCase() as keyof RealityGateCounts]++;

      // Update risk distribution
      if (score.riskLevel === 'LOW' || score.riskLevel === 'UNRATED') riskDistribution.low++;
      else if (score.riskLevel === 'MEDIUM') riskDistribution.medium++;
      else if (score.riskLevel === 'HIGH') riskDistribution.high++;
      else if (score.riskLevel === 'CRITICAL') riskDistribution.critical++;

      if (score.realityAlignmentIndex >= 70) {
        healthyCount++;
      } else {
        atRiskCount++;
      }

      if (score.riskLevel === 'CRITICAL' || score.riskLevel === 'HIGH') {
        highRiskKeys.push(signals.issueKey);
      }
    }

    // Determine weakest gate by pass rate among evaluated (non-hollow) gates
    const intentEval = total - gateBreakdown.intent.hollow;
    const processEval = total - gateBreakdown.process.hollow;
    const codeEval = total - gateBreakdown.code.hollow;
    const auditEval = total - gateBreakdown.audit.hollow;

    const intentPassRate = intentEval > 0 ? (gateBreakdown.intent.passed / intentEval) * 100 : 100;
    const processPassRate = processEval > 0 ? (gateBreakdown.process.passed / processEval) * 100 : 100;
    const codePassRate = codeEval > 0 ? (gateBreakdown.code.passed / codeEval) * 100 : 100;
    const auditPassRate = auditEval > 0 ? (gateBreakdown.audit.passed / auditEval) * 100 : 100;

    let weakestGate: 'intent' | 'process' | 'code' | 'audit' = 'audit';
    let minRate = auditPassRate;
    if (intentPassRate < minRate) { minRate = intentPassRate; weakestGate = 'intent'; }
    if (processPassRate < minRate) { minRate = processPassRate; weakestGate = 'process'; }
    if (codePassRate < minRate) { minRate = codePassRate; weakestGate = 'code'; }

    const averageRAI = Math.round(sumRAI / total);

    // Audit compliance rate: % of DONE issues sealed & verified
    const m40AuditComplianceRate = doneCount > 0 ? Math.round((sealedDoneCount / doneCount) * 100) : 0;
    const m11TraceabilityRate = Math.round((countWithIntent / total) * 100);
    const m29ReviewComplianceRate = Math.round((countWithApprovedReview / total) * 100);
    const m30ReworkLoopRate = Math.round((countWithRework / total) * 100);

    // Dynamic trend & biggest mover calculation from authentic snapshot history
    let sprintDelta: number | undefined = undefined;
    let hasTrendHistory = false;
    let trendNotice: string | undefined = undefined;
    let biggestMover: string | undefined = undefined;

    if (previousSnapshot && previousSnapshot.summary) {
      hasTrendHistory = true;
      sprintDelta = averageRAI - previousSnapshot.summary.averageRAI;

      const prev = previousSnapshot.summary;
      const deltas = [
        { name: 'Intent', delta: m11TraceabilityRate - prev.m11TraceabilityRate, unit: 'decision links' },
        { name: 'Process', delta: (100 - m30ReworkLoopRate) - (100 - prev.m30ReworkLoopRate), unit: 'rework loops' },
        { name: 'Code', delta: m29ReviewComplianceRate - prev.m29ReviewComplianceRate, unit: 'peer reviews' },
        { name: 'Audit', delta: m40AuditComplianceRate - prev.m40AuditComplianceRate, unit: 'sealed issues' }
      ];

      // Find largest absolute delta
      deltas.sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta));
      const top = deltas[0];
      if (Math.abs(top.delta) > 0) {
        const direction = top.delta > 0 ? 'improved' : 'declined';
        biggestMover = `${top.name} ${direction}: ${Math.abs(top.delta)} pts change in ${top.unit}.`;
      } else {
        biggestMover = 'Delivery alignment steady across monitored realities.';
      }
    } else {
      hasTrendHistory = false;
      sprintDelta = undefined;
      trendNotice = 'Trend available after 2 scans (minimum 10 completed issues)';
      biggestMover = undefined;
    }

    return {
      m11TraceabilityRate,
      m29ReviewComplianceRate,
      m30ReworkLoopRate,
      m40AuditComplianceRate,
      averageRAI,
      totalAuditedIssues: total,
      doneCount,
      sealedDoneCount,
      healthyIssueCount: healthyCount,
      atRiskIssueCount: atRiskCount,
      highRiskIssueKeys: highRiskKeys,
      gateBreakdown,
      weakestGate,
      sprintDelta,
      sprintName: dynamicSprintName,
      hasTrendHistory,
      trendNotice,
      biggestMover,
      riskDistribution
    };
  }
}
