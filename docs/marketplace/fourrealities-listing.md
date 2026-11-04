# Atlassian Marketplace Listing: FourRealities

## App Information
* **App Title:** FourRealities
* **Tagline:** Delivery integrity dashboard: align Confluence specs, Jira issues, and Git PRs.
* **Categories:** Project Management, Security, Workflow & Automation

---

## Short Highlight Description (Max 250 chars)
Audit delivery integrity across 4 perspectives: Intent (ADRs), Process (Jira), Code (PRs), and Audit. FourRealities computes an objective Reality Alignment Index, detects unreviewed PRs, and highlights hidden rework loops. (233 characters)

---

## The Unaddressed Native Problem

In modern software delivery, there is often a disconnect between what is planned, what is tracked, what is coded, and what is audited. Engineering leadership refers to this as delivery drift across four disjoint realities:

1. **Reality 1: Intent (Architectural Decisions):** Architecture Decision Records (ADRs) and RFCs live in Confluence, disconnected from everyday Jira tickets.
2. **Reality 2: Process (Jira Workflow):** Issues move from In Progress to Done based on status changes, but the workflow cannot tell whether the work adhered to the architectural intent.
3. **Reality 3: Code (Git Pull Requests):** Pull requests are merged with bypassed reviews, missing tests, or without being linked to the originating Jira issue.
4. **Reality 4: Audit (Delivery Traceability):** Compliance auditors must manually correlate Git commits, Confluence specs, and Jira tickets to prove traceability.

When these four realities diverge, software fails in production, architectural integrity erodes, and compliance audits fail.

FourRealities reconciles all four perspectives in real time directly within Jira, computing an objective **Reality Alignment Index (RAI)** that measures whether your shipped code reflects your documented architectural intent.

---

## Key Capabilities & Verifiable Proof

| Capability | Underlying Mechanism | Verifiable Proof in Code & Tests |
|---|---|---|
| **Reality Alignment Index (RAI)** | Algorithmic scoring (0 to 100) combining Intent, Process, Code, and Audit integrity metrics. | `apps/fourrealities/src/domain/metrics-engine.ts`, `apps/fourrealities/test/domain/metrics-engine.test.ts` |
| **Architectural Intent Traceability** | Validates links to authentic Confluence Architecture Decision Records (ADRs) and design RFCs. | `apps/fourrealities/src/domain/metrics-engine.ts`, `apps/fourrealities/test/index.test.ts` |
| **Code Review Compliance** | Inspects Jira native development status to ensure every delivered ticket has an approved PR. | `apps/fourrealities/src/index.ts`, `apps/fourrealities/test/security/permissions.test.ts` |
| **Rework Loop Detection** | Flags tickets repeatedly bounced between In Review, Testing, and In Progress with reason tracking. | `apps/fourrealities/src/domain/metrics-engine.ts`, `apps/fourrealities/test/domain/rework.test.ts` |
| **Project Audit Dashboard** | Project-level overview displaying aggregate RAI scores, reality drift trends, and high-risk issues. | `apps/fourrealities/src/frontend/index.tsx`, `apps/fourrealities/manifest.yml` |
| **Issue Glance & Context** | Real-time alignment glance directly in the Jira issue view for rapid developer feedback. | `apps/fourrealities/src/frontend/index.tsx`, `apps/fourrealities/test/ui/glance.test.tsx` |

---

## Enterprise Compliance Grounding

FourRealities provides transparent audit evidence for software delivery governance:

- **SOC 2 Type II (CC8.1 & CC7.1):** Demonstrates end-to-end traceability from architectural authorization through peer-reviewed pull request merge.
- **ISO/IEC 27001:2022 (Control A.8.28 Secure Coding & A.8.32 Change Management):** Proves that code changes were accompanied by documented specifications and authorized code reviews.
- **GxP / MedTech SDLC Verification:** Detects unapproved scope additions and undocumented engineering changes before release.

*Honest Integration Note:* FourRealities reads development status (pull requests, branches, reviews) through Jira's native development information integrations (GitHub, Bitbucket, GitLab) and reads specification links via Jira issue remote links. It does not establish direct external network connections to third-party git hosts.

---

## Data Privacy & "Runs on Atlassian" Architecture Guarantee

- **100% Forge Native Execution:** Runs entirely on Atlassian Cloud serverless compute.
- **Zero External Egress:** Declares zero external egress endpoints. No telemetry or code metadata is transmitted to external servers.
- **Customer Tenant Storage:** Configuration and alignment metrics are stored in customer Atlassian Forge Key-Value Storage (KVS).
- **Tenant Data Residency:** Complies with your Jira Cloud data residency boundary.

---

## Transparent Pricing

| Tier | Monthly Price | Annual Price (2 Months Free) |
|---|---|---|
| **1 to 10 Users** | **Free** | **Free** |
| **11 to 100 Users** | $1.50 per user / month | $15.00 per user / year |
| **101 to 250 Users** | $1.20 per user / month | $12.00 per user / year |
| **251 to 1,000 Users** | $0.90 per user / month | $9.00 per user / year |

*All billing is handled natively through Atlassian.*

---

## Retina Screenshot Gallery Manifest

1. `01-dashboard.png` - **Cross-Reality Audit Dashboard:** Project-level overview displaying Reality Alignment Index (RAI), reality breakdowns, and issue risk levels.
2. `02-rai-glance.png` - **Issue Alignment Glance:** Issue panel showing real-time alignment score and status across Intent, Process, Code, and Audit.
3. `03-rework-alert.png` - **Rework Loop Alert:** Detection banner flagging tickets repeatedly bounced between QA and development with root cause reasons.
4. `04-settings.png` - **Intent & Spec Linking:** Interface connecting Confluence Architecture Decision Records (ADRs) to Jira delivery items.
5. `05-drift-breakdown.png` - **Drift Breakdown Modal:** Deep-dive inspection modal showing specific variances between planned specifications and merged pull requests.

---

## Support, Documentation & Legal Links

- **Documentation Portal:** https://docs.asymm.systems/apps/fourrealities/
- **Privacy Policy:** https://asymm.systems/privacy
- **Terms of Service:** https://asymm.systems/terms
- **Support Portal & SLA:** https://asymm.systems/support
- **Direct Support Contact:** `support@asymm.systems`
