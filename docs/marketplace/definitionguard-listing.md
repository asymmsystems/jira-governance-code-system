# Atlassian Marketplace Listing: DefinitionGuard for Jira

## Tagline
Definition of Done & Compliance Checklist Workflow Gates for Jira Cloud. Runs on Atlassian with zero external servers.

## Key Capabilities
- **Mandatory DoD Gating**: Block issue transitions to "Done", "Resolved", or "Deployed" until all required checks are satisfied.
- **Audit Attribution**: Log exact user identity, timestamp, and verification evidence for every checklist item.
- **Deterministic Checksum**: Calculate SHA-256 state hash for compliance verification and audit reporting.
- **Zero Config Setup**: Instant default engineering DoD template ready immediately upon installation.
- **Seamless LedgerSeal Integration**: Feed checklist state hash into LedgerSeal's cryptographic audit certificates.

## Runs on Atlassian
DefinitionGuard is built exclusively on Atlassian Forge.
It carries the official "Runs on Atlassian" badge.
- Zero customer data leaves your Atlassian Cloud site.
- No external databases, no third-party APIs, and no foreign cloud servers.
- Inherits enterprise SOC 2, ISO 27001, and GDPR compliance natively from Atlassian Cloud.

## Security
- **Data Residency**: Stored strictly in Atlassian Forge hosted key-value storage.
- **Zero Egress**: The application manifest specifies zero egress permissions. No HTTP traffic can leave Atlassian.
- **Least Privilege**: Restricted to `read:jira-work` and `storage:app`.
- **Static Analysis**: 100% automated test coverage with strict branch coverage enforcement.

## Pricing
DefinitionGuard offers transparent, tiered user-based pricing with automated Atlassian billing:
- **Free Tier**: Free forever for small teams up to 10 users.
- **Standard Tier (11-100 users)**: $1.00 / user / month.
- **Growth Tier (101-250 users)**: $0.80 / user / month.
- **Enterprise Tier (251+ users)**: Tiered volume discount down to $0.40 / user / month.
- **Annual Plans**: 2 months free with annual subscription.
