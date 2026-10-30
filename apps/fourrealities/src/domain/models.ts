export type RiskLevel = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

export interface RealitySignals {
  issueId: string;
  issueKey: string;
  hasDocumentedIntent: boolean;
  transitionCount: number;
  regressionCount: number; // M30: Bounces back from QA/Review to In Progress
  prCount: number;
  hasApprovedReview: boolean; // M29: Verified peer review approval
  hasCryptographicSeal: boolean; // LedgerSeal active
  isDoDSatisfied: boolean; // DefinitionGuard complete
}

export interface IssueIntegrityScore {
  issueId: string;
  issueKey: string;
  intentScore: number; // 0 - 100
  processScore: number; // 0 - 100
  codeScore: number; // 0 - 100
  auditScore: number; // 0 - 100
  realityAlignmentIndex: number; // Composite RAI 0 - 100
  riskLevel: RiskLevel;
  findings: string[];
}

export interface MetricSummary {
  m11TraceabilityRate: number; // % of issues with documented architecture intent
  m29ReviewComplianceRate: number; // % of issues with approved peer review
  m30ReworkLoopRate: number; // % of issues experiencing rework bounce
  m40AuditComplianceRate: number; // % of issues with DoD and cryptographic seal
  averageRAI: number; // Mean Reality Alignment Index (0 - 100)
  totalAuditedIssues: number;
  healthyIssueCount: number;
  atRiskIssueCount: number;
  highRiskIssueKeys: string[];
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
