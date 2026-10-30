export type RiskLevel = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

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
  summary?: string;
  status?: string;
  statusCategory?: string;
  assigneeName?: string;
  intentScore: number; // 0 - 100
  processScore: number; // 0 - 100
  codeScore: number; // 0 - 100
  auditScore: number; // 0 - 100
  realityAlignmentIndex: number; // Composite RAI 0 - 100
  riskLevel: RiskLevel;
  gates: IssueGates;
  synthesizedFinding: string;
  recoverablePoints: number;
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
  // UX Enhancement Fields
  gateBreakdown: {
    intent: RealityGateCounts;
    process: RealityGateCounts;
    code: RealityGateCounts;
    audit: RealityGateCounts;
  };
  weakestGate: 'intent' | 'process' | 'code' | 'audit';
  sprintDelta: number; // e.g. +6 vs previous sprint
  sprintName: string; // e.g. "Sprint 24"
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
