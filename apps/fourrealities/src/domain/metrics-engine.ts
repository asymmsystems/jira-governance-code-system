import {
  RealitySignals,
  IssueIntegrityScore,
  MetricSummary,
  RiskLevel
} from './models';

export class MetricsEngine {
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

    return {
      issueId: signals.issueId,
      issueKey: signals.issueKey,
      intentScore,
      processScore,
      codeScore,
      auditScore,
      realityAlignmentIndex,
      riskLevel,
      findings
    };
  }

  /**
   * Calculates project-level executive summary metrics across all audited issues.
   */
  public static summarizeProject(signalsList: RealitySignals[]): MetricSummary {
    const total = signalsList.length;
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
        highRiskIssueKeys: []
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

      if (score.realityAlignmentIndex >= 70) {
        healthyCount++;
      } else {
        atRiskCount++;
      }

      if (score.riskLevel === 'CRITICAL' || score.riskLevel === 'HIGH') {
        highRiskKeys.push(signals.issueKey);
      }
    }

    return {
      m11TraceabilityRate: Math.round((countWithIntent / total) * 100),
      m29ReviewComplianceRate: Math.round((countWithApprovedReview / total) * 100),
      m30ReworkLoopRate: Math.round((countWithRework / total) * 100),
      m40AuditComplianceRate: Math.round((countWithFullAudit / total) * 100),
      averageRAI: Math.round(sumRAI / total),
      totalAuditedIssues: total,
      healthyIssueCount: healthyCount,
      atRiskIssueCount: atRiskCount,
      highRiskIssueKeys: highRiskKeys
    };
  }
}
