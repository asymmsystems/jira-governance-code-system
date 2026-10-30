import { MetricsEngine } from '../../src/domain/metrics-engine';
import { RealitySignals } from '../../src/domain/models';

describe('MetricsEngine', () => {
  const perfectSignals: RealitySignals = {
    issueId: '101',
    issueKey: 'CORE-101',
    hasDocumentedIntent: true,
    transitionCount: 3,
    regressionCount: 0,
    prCount: 1,
    hasApprovedReview: true,
    hasCryptographicSeal: true,
    isDoDSatisfied: true
  };

  describe('evaluateIssue', () => {
    it('evaluates a perfect issue with 100% RAI and LOW risk', () => {
      const score = MetricsEngine.evaluateIssue(perfectSignals);

      expect(score.intentScore).toBe(100);
      expect(score.processScore).toBe(100);
      expect(score.codeScore).toBe(100);
      expect(score.auditScore).toBe(100);
      expect(score.realityAlignmentIndex).toBe(100);
      expect(score.riskLevel).toBe('LOW');
      expect(score.findings).toHaveLength(0);
    });

    it('penalizes missing intent documentation (M11 drift)', () => {
      const signals: RealitySignals = { ...perfectSignals, hasDocumentedIntent: false };
      const score = MetricsEngine.evaluateIssue(signals);

      expect(score.intentScore).toBe(0);
      expect(score.realityAlignmentIndex).toBe(75);
      expect(score.riskLevel).toBe('MEDIUM');
      expect(score.findings.some(f => f.includes('M11 Drift'))).toBe(true);
    });

    it('penalizes workflow rework loops (M30 churn)', () => {
      const signals: RealitySignals = { ...perfectSignals, regressionCount: 2 };
      const score = MetricsEngine.evaluateIssue(signals);

      expect(score.processScore).toBe(40); // 100 - (2 * 30) = 40
      expect(score.findings.some(f => f.includes('M30 Churn'))).toBe(true);
    });

    it('floors process score at 0 for excessive rework loops', () => {
      const signals: RealitySignals = { ...perfectSignals, regressionCount: 5 };
      const score = MetricsEngine.evaluateIssue(signals);

      expect(score.processScore).toBe(0);
    });

    it('penalizes issues with zero PRs', () => {
      const signals: RealitySignals = { ...perfectSignals, prCount: 0, hasApprovedReview: false };
      const score = MetricsEngine.evaluateIssue(signals);

      expect(score.codeScore).toBe(0);
      expect(score.findings.some(f => f.includes('No associated Pull Request'))).toBe(true);
    });

    it('penalizes unreviewed PRs (M29 non-compliance)', () => {
      const signals: RealitySignals = { ...perfectSignals, prCount: 1, hasApprovedReview: false };
      const score = MetricsEngine.evaluateIssue(signals);

      expect(score.codeScore).toBe(40);
      expect(score.findings.some(f => f.includes('M29 Non-Compliance'))).toBe(true);
    });

    it('evaluates audit reality for partial compliance', () => {
      const signalsOnlyDoD: RealitySignals = { ...perfectSignals, hasCryptographicSeal: false };
      const score1 = MetricsEngine.evaluateIssue(signalsOnlyDoD);
      expect(score1.auditScore).toBe(50);
      expect(score1.findings.some(f => f.includes('Cryptographic seal missing'))).toBe(true);

      const signalsOnlySeal: RealitySignals = { ...perfectSignals, isDoDSatisfied: false };
      const score2 = MetricsEngine.evaluateIssue(signalsOnlySeal);
      expect(score2.auditScore).toBe(50);
      expect(score2.findings.some(f => f.includes('Definition of Done checklist incomplete'))).toBe(true);
    });

    it('assigns HIGH and CRITICAL risk levels correctly', () => {
      // High risk (score between 50 and 69)
      const highRiskSignals: RealitySignals = {
        ...perfectSignals,
        hasDocumentedIntent: false,
        hasApprovedReview: false,
        regressionCount: 1
      };
      const scoreHigh = MetricsEngine.evaluateIssue(highRiskSignals);
      expect(scoreHigh.riskLevel).toBe('HIGH');

      // Critical risk (score < 50)
      const criticalSignals: RealitySignals = {
        ...perfectSignals,
        hasDocumentedIntent: false,
        prCount: 0,
        hasApprovedReview: false,
        hasCryptographicSeal: false,
        isDoDSatisfied: false,
        regressionCount: 3
      };
      const scoreCritical = MetricsEngine.evaluateIssue(criticalSignals);
      expect(scoreCritical.riskLevel).toBe('CRITICAL');
    });
  });

  describe('summarizeProject', () => {
    it('returns zero defaults for empty issue list', () => {
      const summary = MetricsEngine.summarizeProject([]);

      expect(summary.totalAuditedIssues).toBe(0);
      expect(summary.m11TraceabilityRate).toBe(0);
      expect(summary.m29ReviewComplianceRate).toBe(0);
      expect(summary.m30ReworkLoopRate).toBe(0);
      expect(summary.averageRAI).toBe(0);
    });

    it('aggregates project metrics accurately across diverse issues', () => {
      const issueA: RealitySignals = { ...perfectSignals, issueKey: 'ISSUE-A' }; // RAI 100
      const issueB: RealitySignals = {
        ...perfectSignals,
        issueKey: 'ISSUE-B',
        hasDocumentedIntent: false, // Intent 0
        hasApprovedReview: false, // Code 40
        regressionCount: 1 // Process 70
      }; // RAI = 0.25*(0 + 70 + 40 + 100) = 52.5 -> 53 (HIGH risk)

      const summary = MetricsEngine.summarizeProject([issueA, issueB]);

      expect(summary.totalAuditedIssues).toBe(2);
      expect(summary.m11TraceabilityRate).toBe(50); // 1 out of 2
      expect(summary.m29ReviewComplianceRate).toBe(50); // 1 out of 2
      expect(summary.m30ReworkLoopRate).toBe(50); // 1 out of 2
      expect(summary.averageRAI).toBe(77); // (100 + 53) / 2 = 76.5 -> 77
      expect(summary.healthyIssueCount).toBe(1);
      expect(summary.atRiskIssueCount).toBe(1);
      expect(summary.highRiskIssueKeys).toEqual(['ISSUE-B']);
    });
  });
});
