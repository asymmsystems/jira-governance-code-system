/**
 * Copyright (c) 2026 Asymm Systems. All rights reserved.
 * @author Asymm Systems Team
 * FourRealities: Domain Models for Cross-Reality Delivery Integrity
 */

export type RiskLevel = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL' | 'UNRATED';

export type GateStatus = 'PASSED' | 'ATTENTION' | 'BLOCKED' | 'HOLLOW';

export interface IssueGates {
  intent: GateStatus;
  process: GateStatus;
  code: GateStatus;
  audit: GateStatus;
}

export interface RealityGateCounts {
  passed: number;
  attention: number;
  blocked: number;
  hollow: number;
}

export interface RealitySignals {
  issueId: string;
  issueKey: string;
  summary?: string;
  status?: string;
  statusCategory?: string; // 'To Do' | 'In Progress' | 'Done'
  assigneeName?: string;
  sprintName?: string;
  hasDocumentedIntent: boolean;
  intentDocumentTitle?: string;
  intentDocumentUrl?: string;
  transitionCount: number;
  regressionCount: number; // Workflow rework loops: Bounces back from QA/Review to In Progress
  reworkReason?: string;
  prCount: number;
  hasApprovedReview: boolean; // Verified peer review approval (not merely merged)
  codeExceptionReason?: string; // Exception: e.g. "No code change: Configuration/Documentation"
  hasCryptographicSeal: boolean; // LedgerSeal active
  sealCertificateId?: string;
  sealSnapshotHash?: string;
  isDoDSatisfied: boolean; // DefinitionGuard complete
  dodCompletedCount?: number;
  dodTotalCount?: number;
}

export interface IssueIntegrityScore {
  issueId: string;
  issueKey: string;
  summary?: string;
  status?: string;
  statusCategory?: string;
  assigneeName?: string;
  sprintName?: string;
  isEvaluated: boolean; // False if all gates are HOLLOW (early planning stage)
  applicableGateCount: number;
  intentScore: number; // 0 - 100
  processScore: number; // 0 - 100
  codeScore: number; // 0 - 100
  auditScore: number; // 0 - 100
  realityAlignmentIndex: number; // Composite RAI 0 - 100 (scored only over applicable gates)
  riskLevel: RiskLevel;
  gates: IssueGates;
  synthesizedFinding: string;
  recoverablePoints: number;
  findings: string[];
  whyScoreExplanation: string; // Plain-English score attribution
}

export interface MetricSummary {
  m11TraceabilityRate: number; // % of issues with documented architecture intent
  m29ReviewComplianceRate: number; // % of issues with approved peer review
  m30ReworkLoopRate: number; // % of issues experiencing rework bounce
  m40AuditComplianceRate: number; // % of DONE issues sealed & verified
  averageRAI: number; // Mean Reality Alignment Index (0 - 100)
  totalAuditedIssues: number;
  doneCount: number; // Total count of completed (Done) issues
  sealedDoneCount: number; // Count of completed issues that are sealed
  healthyIssueCount: number;
  atRiskIssueCount: number;
  highRiskIssueKeys: string[];
  // UX Enhancement Fields
  gateBreakdown: {
    intent: RealityGateCounts;
    process: RealityGateCounts;
    code: RealityGateCounts;
    audit: RealityGateCounts;
  };
  weakestGate: 'intent' | 'process' | 'code' | 'audit';
  sprintDelta?: number; // Delta vs previous snapshot, undefined if <2 snapshots
  sprintName: string; // Dynamic sprint name or "Active Delivery"
  hasTrendHistory: boolean;
  trendNotice?: string; // Honest notice when trend history is not yet available
  biggestMover?: string; // Calculated dynamically from historical gate delta
  riskDistribution: {
    low: number;
    medium: number;
    high: number;
    critical: number;
  };
}

export interface ProjectAuditSnapshot {
  snapshotId: string;
  projectKey: string;
  generatedAt: string;
  generatedBy: string;
  summary: MetricSummary;
  issueScores: IssueIntegrityScore[];
  warning?: string;
}

export interface IssueExceptionRecord {
  issueId: string;
  issueKey: string;
  type: 'CODE' | 'REWORK';
  reason: string;
  notes?: string;
  recordedBy: string;
  recordedAt: string;
}
