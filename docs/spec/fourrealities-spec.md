# FourRealities: Architecture Specification & Data Contracts

## Executive Summary
FourRealities is an enterprise architecture and delivery integrity dashboard built natively on Atlassian Forge ("Runs on Atlassian").
It continuously audits alignment across the four realities of software engineering:
1. **Intent Reality**: Architecture Decision Records (ADRs) and requirements documented in Confluence.
2. **Process Reality**: Delivery tickets, status flows, and cycle milestones in Jira.
3. **Code Reality**: Git Pull Requests, commit history, and peer reviews.
4. **Audit Reality**: Cryptographic seals and Definition of Done checklists from LedgerSeal and DefinitionGuard.

The application calculates critical delivery integrity metrics:
- **M11 (Traceability & Architecture Drift)**: Proportion of delivered features with verified architectural traceability.
- **M29 (Review Compliance)**: Percentage of issues closed with verified peer review approvals.
- **M30 (Rework Churn)**: Frequency of state regression loops (e.g., QA Rejections, Review Bounces).
- **Reality Alignment Index (RAI)**: Composite integrity score from 0% to 100%.

FourRealities executes entirely within Atlassian Forge cloud compute with zero external infrastructure and zero external egress.

## Invariants
1. **Zero External Egress**: No telemetry or issue metadata leaves the Atlassian Forge environment.
2. **Deterministic Metric Computations**: All reality alignment formulas produce identical, verifiable values from identical input records.
3. **Data Residency**: All metric snapshots and historical summaries reside strictly in `@forge/storage`.
4. **Least Privilege Scopes**: Scopes restricted strictly to Jira reading and Forge app storage.
5. **Non-Blocking Audit**: The dashboard provides real-time audit intelligence without impeding active development workflows.

## Domain Model
```typescript
export interface RealitySignals {
  issueId: string;
  issueKey: string;
  hasDocumentedIntent: boolean; // Confluence/ADR link present
  transitionCount: number;
  regressionCount: number; // M30: bounces back to In Progress
  prCount: number;
  hasApprovedReview: boolean; // M29: code review verified
  hasCryptographicSeal: boolean; // LedgerSeal active
  isDoDSatisfied: boolean; // DefinitionGuard complete
}

export interface MetricSummary {
  m11TraceabilityRate: number; // % of issues with linked intent
  m29ReviewComplianceRate: number; // % of issues with approved peer review
  m30ReworkLoopRate: number; // % of issues experiencing state bounce
  realityAlignmentIndex: number; // Overall composite score (0 - 100)
  totalAuditedIssues: number;
  highRiskIssueKeys: string[];
}

export interface RealityAuditSnapshot {
  snapshotId: string;
  projectKey: string;
  generatedAt: string;
  generatedBy: string;
  metrics: MetricSummary;
  signals: RealitySignals[];
}
```

## Manifest
The application declares native Jira modules in `manifest.yml`:
- `jira:projectPage`: Project-level audit dashboard and reality alignment overview.
- `jira:issuePanel`: Single-issue reality health and metric breakdown.
- Scopes:
  - `read:jira-work`: Read issue metadata, changelogs, and remote links.
  - `storage:app`: Store project audit metrics and cached evaluation states.

## Storage Schema
Partitioned in Forge Storage (`@forge/storage`):
- `fr:project:{projectKey}:latest`: Most recent `RealityAuditSnapshot` for the project.
- `fr:project:{projectKey}:history`: Historical RAI time-series records for trend analysis.
- `fr:issue:{issueId}:signals`: Cached `RealitySignals` for individual issues.

## Validator
The metrics calculation and integrity validator:
1. Evaluates each issue against the 4 realities.
2. Computes M11, M29, M30, and RAI using deterministic arithmetic formulas.
3. Classifies issues with RAI < 60% as high risk.
4. Identifies governance anomalies (e.g. issue marked "Done" without PR review or architectural specification).
