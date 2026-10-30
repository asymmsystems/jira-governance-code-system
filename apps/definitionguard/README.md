# DefinitionGuard: Definition of Done & Compliance Gate for Jira

DefinitionGuard is an enterprise compliance, security, and quality gating application built on Atlassian Forge.
It enforces automated Definition-of-Done (DoD) checklists directly inside Atlassian Jira Cloud.

## Platform Architecture: Runs on Atlassian
DefinitionGuard is built with the Forge platform and UI Kit 2.
The app executes exclusively within Atlassian's secure cloud compute infrastructure.
It satisfies the "Runs on Atlassian" badge standards:
- **Zero External Egress**: No telemetry, no third-party HTTP connections, and no egress endpoints.
- **Data Residency**: 100% of checklist definitions, item instances, and audit attribution records reside in Atlassian Forge Hosted Storage (`@forge/storage`).
- **Least Privilege**: Only requests `read:jira-work` and `storage:app` scopes.

## Key Capabilities
1. **Automated Definition of Done**: Standardizes required quality and compliance items across Jira issues.
2. **Jira Workflow Validator**: Halts transitions to "Done", "Resolved", or "Released" when mandatory checklist items are incomplete.
3. **Audit Attribution**: Tracks exact user account IDs and timestamps for every item completion event.
4. **Deterministic Checksums**: Computes a SHA-256 state hash for audit proof and integration with LedgerSeal.

## Build and Test
```bash
npm install
npm test
npm run build
```
All unit tests and coverage thresholds (>90% branch coverage) run via Jest.
