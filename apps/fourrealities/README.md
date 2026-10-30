# FourRealities: Architecture & Delivery Integrity Dashboard for Jira

FourRealities is an enterprise governance and engineering integrity dashboard built on Atlassian Forge.
It continuously audits alignment across the four realities of software engineering:
Intent (Confluence ADRs), Process (Jira workflows), Code (Git pull requests), and Audit (LedgerSeal certificates and DefinitionGuard checklists).

## Platform Architecture: Runs on Atlassian
FourRealities executes exclusively within Atlassian's secure cloud compute infrastructure.
It satisfies the "Runs on Atlassian" badge standards:
- **Zero External Egress**: No telemetry, no third-party HTTP connections, and no egress endpoints.
- **Data Residency**: 100% of audit metrics, issue scores, and project summaries reside in Atlassian Forge Hosted Storage (`@forge/storage`).
- **Least Privilege**: Only requests `read:jira-work` and `storage:app` scopes.

## Key Capabilities
1. **M11: Traceability & Architecture Drift**: Measures the proportion of delivered issues with verified Confluence requirements or Architecture Decision Records (ADRs).
2. **M29: Code Review Compliance**: Verifies that Pull Requests possess formal peer approvals prior to ticket closure.
3. **M30: Rework Loop Detection**: Flags status regression bounces (e.g., In Review -> In Progress) indicating unclear requirements.
4. **Reality Alignment Index (RAI)**: Calculates a composite 0-100% delivery integrity score across all four realities.

## Build and Test
```bash
npm install
npm test
npm run build
```
All unit tests and coverage thresholds (>90% branch coverage) run via Jest.
