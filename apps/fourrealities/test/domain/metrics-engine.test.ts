/**
 * Copyright (c) 2026 Asymm Systems. All rights reserved.
 * @author Asymm Systems Team
 * FourRealities: MetricsEngine Unit Tests
 */

import { MetricsEngine } from '../../src/domain/metrics-engine';
import { RealitySignals, ProjectAuditSnapshot } from '../../src/domain/models';

describe('MetricsEngine', () => {
  const perfectSignals: RealitySignals = {
    issueId: '101',
    issueKey: 'CORE-101',
    status: 'Done',
    statusCategory: 'Done',
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
      expect(score.isEvaluated).toBe(true);
      expect(score.whyScoreExplanation).toContain('Why 100%?');
    });

    it('penalizes missing intent documentation with plain-English diagnosis', () => {
      const signals: RealitySignals = { ...perfectSignals, hasDocumentedIntent: false };
      const score = MetricsEngine.evaluateIssue(signals);

      expect(score.intentScore).toBe(0);
      expect(score.realityAlignmentIndex).toBe(75);
      expect(score.riskLevel).toBe('MEDIUM');
      expect(score.findings.some(f => f.includes('Architectural Intent: Missing Confluence ADR'))).toBe(true);
      // Ensures metric codes (M11) are not displayed to developers
      expect(score.findings.some(f => f.includes('M11'))).toBe(false);
    });

    it('penalizes workflow rework loops with plain-English diagnosis', () => {
      const signals: RealitySignals = { ...perfectSignals, regressionCount: 2 };
      const score = MetricsEngine.evaluateIssue(signals);

      expect(score.processScore).toBe(50); // 100 - (2 * 25) = 50
      expect(score.findings.some(f => f.includes('Workflow Stability: 2 rework loop(s) detected'))).toBe(true);
      expect(score.findings.some(f => f.includes('M30'))).toBe(false);
    });

    it('floors process score at 0 for excessive rework loops', () => {
      const signals: RealitySignals = { ...perfectSignals, regressionCount: 5 };
      const score = MetricsEngine.evaluateIssue(signals);

      expect(score.processScore).toBe(0);
    });

    it('penalizes issues with zero PRs when completed', () => {
      const signals: RealitySignals = { ...perfectSignals, prCount: 0, hasApprovedReview: false };
      const score = MetricsEngine.evaluateIssue(signals);

      expect(score.codeScore).toBe(0);
      expect(score.findings.some(f => f.includes('Review Compliance: No associated Pull Request'))).toBe(true);
    });

    it('penalizes unreviewed PRs (merged without verified approval)', () => {
      const signals: RealitySignals = { ...perfectSignals, prCount: 1, hasApprovedReview: false };
      const score = MetricsEngine.evaluateIssue(signals);

      expect(score.codeScore).toBe(40);
      expect(score.findings.some(f => f.includes('Review Compliance: Pull Request merged without verified peer review approval'))).toBe(true);
      expect(score.findings.some(f => f.includes('M29'))).toBe(false);
    });

    it('credits approved exceptions without requiring PRs', () => {
      const signals: RealitySignals = {
        ...perfectSignals,
        prCount: 0,
        hasApprovedReview: false,
        codeExceptionReason: 'No code change: Documentation update'
      };
      const score = MetricsEngine.evaluateIssue(signals);

      expect(score.codeScore).toBe(100);
      expect(score.gates.code).toBe('PASSED');
      expect(score.findings.some(f => f.includes('Approved Exception: No code change: Documentation update'))).toBe(true);
    });

    it('evaluates audit reality for partial compliance', () => {
      const signalsOnlyDoD: RealitySignals = { ...perfectSignals, hasCryptographicSeal: false };
      const score1 = MetricsEngine.evaluateIssue(signalsOnlyDoD);
      expect(score1.auditScore).toBe(50);
      expect(score1.findings.some(f => f.toLowerCase().includes('cryptographic seal is missing'))).toBe(true);

      const signalsOnlySeal: RealitySignals = { ...perfectSignals, isDoDSatisfied: false };
      const score2 = MetricsEngine.evaluateIssue(signalsOnlySeal);
      expect(score2.auditScore).toBe(50);
      expect(score2.findings.some(f => f.toLowerCase().includes('definition of done is incomplete'))).toBe(true);
    });

    it('does not penalize early unstarted To Do issues (excludes hollow gates from score)', () => {
      const todoSignals: RealitySignals = {
        issueId: '202',
        issueKey: 'TODO-202',
        statusCategory: 'To Do',
        transitionCount: 1,
        hasDocumentedIntent: false,
        regressionCount: 0,
        prCount: 0,
        hasApprovedReview: false,
        hasCryptographicSeal: false,
        isDoDSatisfied: false
      };
      const score = MetricsEngine.evaluateIssue(todoSignals);

      expect(score.gates.intent).toBe('HOLLOW');
      expect(score.gates.process).toBe('HOLLOW');
      expect(score.gates.code).toBe('HOLLOW');
      expect(score.gates.audit).toBe('HOLLOW');
      expect(score.isEvaluated).toBe(false);
      expect(score.riskLevel).toBe('LOW');
      expect(score.whyScoreExplanation).toContain('Early stage: Gates will be evaluated');
    });

    it('assigns HIGH and CRITICAL risk levels correctly on evaluated issues', () => {
      // High risk
      const highRiskSignals: RealitySignals = {
        ...perfectSignals,
        hasDocumentedIntent: false,
        hasApprovedReview: false,
        regressionCount: 1
      };
      const scoreHigh = MetricsEngine.evaluateIssue(highRiskSignals);
      expect(scoreHigh.riskLevel).toBe('HIGH');

      // Critical risk
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
    it('returns zero defaults with honest trend notice for empty issue list', () => {
      const summary = MetricsEngine.summarizeProject([]);

      expect(summary.totalAuditedIssues).toBe(0);
      expect(summary.m11TraceabilityRate).toBe(0);
      expect(summary.m29ReviewComplianceRate).toBe(0);
      expect(summary.m30ReworkLoopRate).toBe(0);
      expect(summary.averageRAI).toBe(0);
      expect(summary.hasTrendHistory).toBe(false);
      expect(summary.sprintDelta).toBeUndefined();
      expect(summary.trendNotice).toContain('Trend available after 2 scans');
    });

    it('aggregates project metrics accurately and calculates audit rate from DONE issues only', () => {
      const issueA: RealitySignals = { ...perfectSignals, issueKey: 'ISSUE-A', statusCategory: 'Done' }; // RAI 100, sealed
      const issueB: RealitySignals = {
        ...perfectSignals,
        issueKey: 'ISSUE-B',
        statusCategory: 'In Progress',
        hasDocumentedIntent: false, // Intent 0
        hasApprovedReview: false, // Code 40
        regressionCount: 1 // Process 75
      }; // Applicable: Intent (0), Process (75), Code (40). Audit is HOLLOW in In Progress. Average = (0+75+40)/3 = 38 (CRITICAL)

      const summary = MetricsEngine.summarizeProject([issueA, issueB]);

      expect(summary.totalAuditedIssues).toBe(2);
      expect(summary.doneCount).toBe(1); // Only issueA is done
      expect(summary.sealedDoneCount).toBe(1); // 1 out of 1 done issue sealed
      expect(summary.m40AuditComplianceRate).toBe(100); // 1 of 1 done sealed = 100% (honest audit rate!)
      expect(summary.m11TraceabilityRate).toBe(50);
      expect(summary.m29ReviewComplianceRate).toBe(50);
      expect(summary.healthyIssueCount).toBe(1);
      expect(summary.atRiskIssueCount).toBe(1);
    });

    it('calculates authentic sprint delta and biggest mover when previous snapshot exists', () => {
      const issueA: RealitySignals = { ...perfectSignals, issueKey: 'ISSUE-A' };
      const prevSnapshot: ProjectAuditSnapshot = {
        snapshotId: 'snap-old',
        projectKey: 'CORE',
        generatedAt: '2026-10-25T10:00:00Z',
        generatedBy: 'admin',
        summary: {
          m11TraceabilityRate: 80,
          m29ReviewComplianceRate: 80,
          m30ReworkLoopRate: 20,
          m40AuditComplianceRate: 70,
          averageRAI: 85,
          totalAuditedIssues: 10,
          doneCount: 10,
          sealedDoneCount: 7,
          healthyIssueCount: 8,
          atRiskIssueCount: 2,
          highRiskIssueKeys: [],
          gateBreakdown: {
            intent: { passed: 8, attention: 0, blocked: 2, hollow: 0 },
            process: { passed: 8, attention: 2, blocked: 0, hollow: 0 },
            code: { passed: 8, attention: 0, blocked: 2, hollow: 0 },
            audit: { passed: 7, attention: 1, blocked: 2, hollow: 0 }
          },
          weakestGate: 'audit',
          sprintName: 'Sprint 23',
          hasTrendHistory: true,
          riskDistribution: { low: 8, medium: 2, high: 0, critical: 0 }
        },
        issueScores: []
      };

      const summary = MetricsEngine.summarizeProject([issueA], prevSnapshot);
      expect(summary.hasTrendHistory).toBe(true);
      expect(summary.sprintDelta).toBe(15); // 100 - 85 = +15
      expect(summary.biggestMover).toBeDefined();

      // Test steady delivery alignment when delta is zero
      const identicalPrev: ProjectAuditSnapshot = {
        ...prevSnapshot,
        summary: {
          ...prevSnapshot.summary,
          m11TraceabilityRate: 100,
          m29ReviewComplianceRate: 100,
          m30ReworkLoopRate: 0,
          m40AuditComplianceRate: 100,
          averageRAI: 100
        }
      };
      const steadySummary = MetricsEngine.summarizeProject([issueA], identicalPrev);
      expect(steadySummary.biggestMover).toBe('Delivery alignment steady across monitored realities.');

      // Test CRITICAL risk aggregation in risk distribution
      const critSignals: RealitySignals = {
        ...perfectSignals,
        issueKey: 'CRIT-1',
        hasDocumentedIntent: false,
        prCount: 0,
        hasApprovedReview: false,
        hasCryptographicSeal: false,
        isDoDSatisfied: false,
        regressionCount: 3
      };
      const critSummary = MetricsEngine.summarizeProject([critSignals]);
      expect(critSummary.riskDistribution.critical).toBe(1);
    });

    it('identifies weakest gate accurately across intent, code, and process', () => {
      // Intent weakest
      const sig1: RealitySignals = { ...perfectSignals, hasDocumentedIntent: false };
      const sum1 = MetricsEngine.summarizeProject([sig1]);
      expect(sum1.weakestGate).toBe('intent');

      // Code weakest
      const sig2: RealitySignals = { ...perfectSignals, hasApprovedReview: false };
      const sum2 = MetricsEngine.summarizeProject([sig2]);
      expect(sum2.weakestGate).toBe('code');

      // Process weakest
      const sig3: RealitySignals = { ...perfectSignals, regressionCount: 3 };
      const sum3 = MetricsEngine.summarizeProject([sig3]);
      expect(sum3.weakestGate).toBe('process');
    });
  });

  describe('evaluateGates and synthesizeFinding', () => {
    it('marks early issues as HOLLOW across gates and returns early stage guidance', () => {
      const todoSignals: RealitySignals = {
        issueId: 'early-1',
        issueKey: 'EARLY-1',
        hasDocumentedIntent: false,
        regressionCount: 0,
        prCount: 0,
        hasApprovedReview: false,
        isDoDSatisfied: false,
        hasCryptographicSeal: false,
        statusCategory: 'To Do',
        transitionCount: 1
      };
      const gates = MetricsEngine.evaluateGates(todoSignals);
      expect(gates.intent).toBe('HOLLOW');
      expect(gates.code).toBe('HOLLOW');
      expect(gates.audit).toBe('HOLLOW');
      expect(gates.process).toBe('HOLLOW');

      const finding = MetricsEngine.synthesizeFinding(gates, todoSignals);
      expect(finding).toContain('early planning stage');
    });

    it('generates accurate synthesized findings and recoverable points', () => {
      // Intent blocked
      const intentBlocked: RealitySignals = { ...perfectSignals, hasDocumentedIntent: false };
      const scoreIntent = MetricsEngine.evaluateIssue(intentBlocked);
      expect(scoreIntent.synthesizedFinding).toContain('Work lacks documented architectural intent');
      expect(scoreIntent.recoverablePoints).toBe(25);

      // Code blocked without PR on done issue
      const codeNoPr: RealitySignals = { ...perfectSignals, prCount: 0, hasApprovedReview: false, statusCategory: 'Done' };
      const scoreNoPr = MetricsEngine.evaluateIssue(codeNoPr);
      expect(scoreNoPr.synthesizedFinding).toContain('Work completed without a linked Pull Request or code branch');
      expect(scoreNoPr.recoverablePoints).toBe(25);

      // Code blocked with unreviewed PR
      const codeUnreviewed: RealitySignals = { ...perfectSignals, prCount: 1, hasApprovedReview: false };
      const scoreUnreviewed = MetricsEngine.evaluateIssue(codeUnreviewed);
      expect(scoreUnreviewed.synthesizedFinding).toContain('without verified peer review approval');
      expect(scoreUnreviewed.recoverablePoints).toBe(15);

      // Audit blocked on Done issue
      const auditBlocked: RealitySignals = {
        ...perfectSignals,
        isDoDSatisfied: false,
        hasCryptographicSeal: false,
        statusCategory: 'Done'
      };
      const scoreAudit = MetricsEngine.evaluateIssue(auditBlocked);
      expect(scoreAudit.synthesizedFinding).toContain('Definition of Done is incomplete and cryptographic seal is missing');
      expect(scoreAudit.recoverablePoints).toBe(25);

      // Process attention
      const procAttention: RealitySignals = { ...perfectSignals, regressionCount: 2 };
      const scoreProc = MetricsEngine.evaluateIssue(procAttention);
      expect(scoreProc.synthesizedFinding).toContain('rework loop(s) indicating requirement churn');

      // Audit attention without seal
      const auditNoSeal: RealitySignals = {
        ...perfectSignals,
        isDoDSatisfied: true,
        hasCryptographicSeal: false,
        statusCategory: 'Done'
      };
      const scoreNoSeal = MetricsEngine.evaluateIssue(auditNoSeal);
      expect(scoreNoSeal.synthesizedFinding).toContain('Definition of Done satisfied, but cryptographic seal is unverified');
      expect(scoreNoSeal.recoverablePoints).toBe(12);

      // Audit attention without DoD
      const auditNoDod: RealitySignals = {
        ...perfectSignals,
        isDoDSatisfied: false,
        hasCryptographicSeal: true,
        statusCategory: 'Done'
      };
      const scoreNoDod = MetricsEngine.evaluateIssue(auditNoDod);
      expect(scoreNoDod.synthesizedFinding).toContain('Cryptographic seal recorded, but Definition of Done is incomplete');
      expect(scoreNoDod.recoverablePoints).toBe(12);

      // All passed
      const scoreAllPassed = MetricsEngine.evaluateIssue(perfectSignals);
      expect(scoreAllPassed.synthesizedFinding).toContain('All evaluated delivery reality gates verified and aligned');
      expect(scoreAllPassed.recoverablePoints).toBe(0);
    });
  });
});
