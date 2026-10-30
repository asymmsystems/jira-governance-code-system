import {
  RealitySignals,
  IssueIntegrityScore,
  MetricSummary,
  RiskLevel,
  GateStatus,
  IssueGates,
  RealityGateCounts
} from './models';

export class MetricsEngine {
  /**
   * Evaluates the status of the four gates for a single issue.
   */
  public static evaluateGates(signals: RealitySignals): IssueGates {
    // 1. Intent Gate
    let intent: GateStatus = 'BLOCKED';
    if (signals.hasDocumentedIntent) {
      intent = 'PASSED';
    } else if (signals.statusCategory === 'To Do' && signals.transitionCount <= 1) {
      intent = 'HOLLOW';
    }

    // 2. Process Gate
    const process: GateStatus = signals.regressionCount > 0 ? 'ATTENTION' : 'PASSED';

    // 3. Code Gate
    let code: GateStatus = 'BLOCKED';
    if (signals.prCount === 0) {
      code = signals.statusCategory === 'To Do' ? 'HOLLOW' : 'BLOCKED';
    } else {
      code = signals.hasApprovedReview ? 'PASSED' : 'BLOCKED';
    }

    // 4. Audit Gate
    let audit: GateStatus = 'BLOCKED';
    if (signals.statusCategory !== 'Done' && !signals.isDoDSatisfied && !signals.hasCryptographicSeal) {
      audit = 'HOLLOW';
    } else if (signals.isDoDSatisfied && signals.hasCryptographicSeal) {
      audit = 'PASSED';
    } else if (signals.isDoDSatisfied || signals.hasCryptographicSeal) {
      audit = 'ATTENTION';
    } else {
      audit = 'BLOCKED';
    }

    return { intent, process, code, audit };
  }

  /**
   * Synthesizes a human-readable one-line finding based on the first blocked or attention gate.
   */
  public static synthesizeFinding(gates: IssueGates, signals: RealitySignals): string {
    if (gates.intent === 'BLOCKED') {
      return 'Work lacks documented architectural intent or Confluence ADR link.';
    }
    if (gates.code === 'BLOCKED') {
      return signals.prCount === 0
        ? 'Work is progressing without a linked Pull Request or branch.'
        : 'Pull Request was merged without verified peer review approval.';
    }
    if (gates.audit === 'BLOCKED') {
      return 'Definition of Done is incomplete and cryptographic seal is missing.';
    }
    if (gates.process === 'ATTENTION') {
      return `Workflow experienced ${signals.regressionCount} rework loop(s) indicating requirement churn.`;
    }
    if (gates.audit === 'ATTENTION') {
      return !signals.hasCryptographicSeal
        ? 'Definition of Done satisfied, but cryptographic seal is unverified.'
        : 'Cryptographic seal recorded, but Definition of Done is incomplete.';
    }
    return 'All four delivery reality gates verified and aligned.';
  }

  /**
   * Calculates points recoverable by closing the primary blocked gate.
   */
  public static calculateRecoverablePoints(gates: IssueGates, signals: RealitySignals): number {
    if (gates.intent === 'BLOCKED') return 25;
    if (gates.code === 'BLOCKED') return signals.prCount === 0 ? 25 : 15;
    if (gates.audit === 'BLOCKED') return 25;
    if (gates.audit === 'ATTENTION') return 12;
    return 0;
  }

  /**
   * Calculates reality alignment scores across the 4 realities for a single issue.
   */
  public static evaluateIssue(signals: RealitySignals): IssueIntegrityScore {
    const findings: string[] = [];

    // 1. Intent Reality (ADR / Requirements Documentation)
    const intentScore = signals.hasDocumentedIntent ? 100 : 0;
    if (!signals.hasDocumentedIntent) {
      findings.push('M11 Drift: Missing architectural documentation or Confluence ADR link.');
    }

    // 2. Process Reality (Rework churn & workflow stability)
    const processPenalty = signals.regressionCount * 30;
    const processScore = Math.max(0, 100 - processPenalty);
    if (signals.regressionCount > 0) {
      findings.push(`M30 Churn: ${signals.regressionCount} workflow rework loop(s) detected.`);
    }

    // 3. Code Reality (Pull requests and peer code review)
    let codeScore = 0;
    if (signals.prCount === 0) {
      codeScore = 0;
      findings.push('Code Reality: No associated Pull Request or commit branch linked.');
    } else if (!signals.hasApprovedReview) {
      codeScore = 40;
      findings.push('M29 Non-Compliance: Pull Request merged without verified peer review approval.');
    } else {
      codeScore = 100;
    }

    // 4. Audit Reality (Definition of Done & Cryptographic Seal)
    let auditScore = 0;
    if (signals.isDoDSatisfied) {
      auditScore += 50;
    } else {
      findings.push('Audit Reality: Definition of Done checklist incomplete.');
    }

    if (signals.hasCryptographicSeal) {
      auditScore += 50;
    } else {
      findings.push('Audit Reality: Cryptographic seal missing or unverified.');
    }

    // Composite Reality Alignment Index (Weighted equally across the 4 realities)
    const realityAlignmentIndex = Math.round(
      intentScore * 0.25 + processScore * 0.25 + codeScore * 0.25 + auditScore * 0.25
    );

    let riskLevel: RiskLevel = 'LOW';
    if (realityAlignmentIndex < 50) {
      riskLevel = 'CRITICAL';
    } else if (realityAlignmentIndex < 70) {
      riskLevel = 'HIGH';
    } else if (realityAlignmentIndex < 85) {
      riskLevel = 'MEDIUM';
    }

    const gates = this.evaluateGates(signals);
    const synthesizedFinding = this.synthesizeFinding(gates, signals);
    const recoverablePoints = this.calculateRecoverablePoints(gates, signals);

    return {
      issueId: signals.issueId,
      issueKey: signals.issueKey,
      summary: signals.summary,
      status: signals.status,
      statusCategory: signals.statusCategory,
      assigneeName: signals.assigneeName,
      intentScore,
      processScore,
      codeScore,
      auditScore,
      realityAlignmentIndex,
      riskLevel,
      gates,
      synthesizedFinding,
      recoverablePoints,
      findings
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
   */
  public static summarizeProject(signalsList: RealitySignals[]): MetricSummary {
    const total = signalsList.length;
    const gateBreakdown = {
      intent: this.createEmptyGateCounts(),
      process: this.createEmptyGateCounts(),
      code: this.createEmptyGateCounts(),
      audit: this.createEmptyGateCounts()
    };
    const riskDistribution = { low: 0, medium: 0, high: 0, critical: 0 };

    if (total === 0) {
      return {
        m11TraceabilityRate: 0,
        m29ReviewComplianceRate: 0,
        m30ReworkLoopRate: 0,
        m40AuditComplianceRate: 0,
        averageRAI: 0,
        totalAuditedIssues: 0,
        healthyIssueCount: 0,
        atRiskIssueCount: 0,
        highRiskIssueKeys: [],
        gateBreakdown,
        weakestGate: 'audit',
        sprintDelta: 0,
        sprintName: 'Sprint 24',
        riskDistribution
      };
    }

    let countWithIntent = 0;
    let countWithApprovedReview = 0;
    let countWithRework = 0;
    let countWithFullAudit = 0;
    let sumRAI = 0;
    let healthyCount = 0;
    let atRiskCount = 0;
    const highRiskKeys: string[] = [];

    for (const signals of signalsList) {
      if (signals.hasDocumentedIntent) countWithIntent++;
      if (signals.hasApprovedReview) countWithApprovedReview++;
      if (signals.regressionCount > 0) countWithRework++;
      if (signals.hasCryptographicSeal && signals.isDoDSatisfied) countWithFullAudit++;

      const score = this.evaluateIssue(signals);
      sumRAI += score.realityAlignmentIndex;

      // Update gate breakdown
      gateBreakdown.intent[score.gates.intent.toLowerCase() as keyof RealityGateCounts]++;
      gateBreakdown.process[score.gates.process.toLowerCase() as keyof RealityGateCounts]++;
      gateBreakdown.code[score.gates.code.toLowerCase() as keyof RealityGateCounts]++;
      gateBreakdown.audit[score.gates.audit.toLowerCase() as keyof RealityGateCounts]++;

      // Update risk distribution
      if (score.riskLevel === 'LOW') riskDistribution.low++;
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

    // Determine weakest gate by pass rate
    const intentRate = (gateBreakdown.intent.passed / total) * 100;
    const processRate = (gateBreakdown.process.passed / total) * 100;
    const codeRate = (gateBreakdown.code.passed / total) * 100;
    const auditRate = (gateBreakdown.audit.passed / total) * 100;

    let weakestGate: 'intent' | 'process' | 'code' | 'audit' = 'audit';
    let minRate = auditRate;
    if (intentRate < minRate) { minRate = intentRate; weakestGate = 'intent'; }
    if (processRate < minRate) { minRate = processRate; weakestGate = 'process'; }
    if (codeRate < minRate) { minRate = codeRate; weakestGate = 'code'; }

    return {
      m11TraceabilityRate: Math.round((countWithIntent / total) * 100),
      m29ReviewComplianceRate: Math.round((countWithApprovedReview / total) * 100),
      m30ReworkLoopRate: Math.round((countWithRework / total) * 100),
      m40AuditComplianceRate: Math.round((countWithFullAudit / total) * 100),
      averageRAI: Math.round(sumRAI / total),
      totalAuditedIssues: total,
      healthyIssueCount: healthyCount,
      atRiskIssueCount: atRiskCount,
      highRiskIssueKeys: highRiskKeys,
      gateBreakdown,
      weakestGate,
      sprintDelta: 6,
      sprintName: 'Sprint 24',
      riskDistribution
    };
  }
}
