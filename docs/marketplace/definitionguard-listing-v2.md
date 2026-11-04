# Atlassian Marketplace Listing: DefinitionGuard

## App Information
* **App Title:** DefinitionGuard
* **Tagline:** Enforceable Definition of Done with evidence, review rules, and audit history.
* **Categories:** Workflow & Automation, Security, Project Management

---

## Short Highlight Description (Max 250 chars)
Enforce your Definition of Done at workflow transitions. DefinitionGuard requires verified evidence links, non-assignee peer reviews, and audited waivers before issues move to Done, backed by tamper-evident audit history. (223 characters)

---

## The Unaddressed Native Problem

In modern engineering teams, "Definition of Done" (DoD) is usually documented in a wiki page or listed as an unchecked text field in a Jira ticket description. Because native Jira cannot gate workflow transitions based on structured DoD evidence, teams face common release breakdowns:

1. **Unverified Checklists:** Developers tick manual checkboxes without linking test results, design sign-offs, or documentation PRs.
2. **Self-Review Loopholes:** The ticket assignee can tick "Peer Review Complete" on their own work without independent verification.
3. **Silent Waivers:** Quality gates are bypassed informally in Slack or standups without a recorded audit reason or approval trail.
4. **Ungated Done Transitions:** Tickets move cleanly to Done even when mandatory compliance steps remain incomplete.

DefinitionGuard converts your Definition of Done from an aspirational checklist into an automated, workflow-enforced quality gate.

---

## Key Capabilities & Verifiable Proof

| Capability | Underlying Mechanism | Verifiable Proof in Code & Tests |
|---|---|---|
| **Per-Issue-Type DoD Checklists** | Project admins configure distinct checklist templates for Stories, Bugs, and Epics. | `apps/definitionguard/src/domain/template-engine.ts`, `apps/definitionguard/test/settings/project-templates.test.ts` |
| **Mandatory Evidence Requirements** | Checklist items require an authentic URL or verification note before they can be completed. | `apps/definitionguard/src/resolvers/evidence.ts`, `apps/definitionguard/test/resolvers/evidence.test.ts` |
| **Peer Review Enforcement** | Enforces that ticket assignees cannot sign off on peer-review checklist items. | `apps/definitionguard/src/security/permissions.ts`, `apps/definitionguard/test/resolvers/roles-waivers.test.ts` |
| **Audited Waivers with Reasons** | Authorized leads can waive an item with an obligatory justification, recorded in audit history. | `apps/definitionguard/src/domain/checklist-engine.ts`, `apps/definitionguard/test/resolvers/roles-waivers.test.ts` |
| **Automated Move-to-Done Gate** | Jira workflow validator blocks transition into Done status if any mandatory item is open. | `apps/definitionguard/src/validator/index.ts`, `apps/definitionguard/test/validator/validate-transition.test.ts` |
| **Transition Coverage Audit** | Project settings scans active workflow transitions into Done and flags unprotected paths. | `apps/definitionguard/src/settings/coverage.ts`, `apps/definitionguard/test/validator/gate-rule.test.ts` |
| **Hash-Chained Audit History** | Every tick, waiver, evidence attachment, and template sync is recorded in a hash-chained log. | `apps/definitionguard/src/domain/chain-verify.ts`, `apps/definitionguard/test/domain/chain-verify.test.ts` |
| **JSON Audit Export** | One-click export of complete issue DoD history for compliance auditors. | `apps/definitionguard/src/resolvers/export.ts`, `apps/definitionguard/test/export_and_admin.test.ts` |

---

## Enterprise Compliance Grounding

DefinitionGuard provides verifiable evidence for internal and external audits:

- **SOC 2 Type II (CC8.1 & CC7.2):** Validates that software releases meet pre-defined testing, security review, and documentation criteria before deployment.
- **ISO/IEC 27001:2022 (Control A.8.29 & A.8.32):** Ensures documented security and testing requirements are verified prior to production releases.
- **GxP / MedTech Quality Systems:** Creates an indisputable record of design verification and peer review sign-offs with recorded waivers.

*Honest Compliance Boundary:* DefinitionGuard enforces the criteria you define. It does not certify your processes. External auditors assess your overall quality management procedures.

---

## Data Privacy & "Runs on Atlassian" Architecture Guarantee

- **100% Forge Native Execution:** Runs entirely on Atlassian Cloud serverless compute.
- **Zero External Egress:** Zero outbound fetch calls. The manifest declares zero external domains.
- **Customer Tenant Storage:** Checklist state and audit records are persisted exclusively in your Atlassian Forge Key-Value Storage (KVS).
- **Tenant Data Residency:** Operates within your designated Atlassian Cloud data region.

---

## Transparent Pricing

| Tier | Monthly Price | Annual Price (2 Months Free) |
|---|---|---|
| **1 to 10 Users** | **Free** | **Free** |
| **11 to 100 Users** | $1.50 per user / month | $15.00 per user / year |
| **101 to 250 Users** | $1.20 per user / month | $12.00 per user / year |
| **251 to 1,000 Users** | $0.90 per user / month | $9.00 per user / year |

*All billing is integrated directly into your Atlassian subscription.*

---

## Retina Screenshot Gallery Manifest

1. `01-checklist-open.png` - **DoD Checklist Panel:** Issue DoD checklist showing open mandatory criteria, required evidence badges, and role requirements.
2. `02-evidence-link.png` - **Verified Evidence Entry:** Input modal requiring build URL or documentation link to complete a mandatory item.
3. `03-transition-blocked.png` - **Workflow Gate Enforcement:** Transition into Done status blocked because mandatory verification items remain open.
4. `04-project-settings.png` - **DoD Template Editor:** Admin settings page managing per-issue-type DoD criteria and coverage check.
5. `05-audit-export.png` - **JSON Audit Export:** Full hash-chained audit export showing who verified each criterion, when, and with what evidence.

---

## Support, Documentation & Legal Links

- **Documentation Portal:** https://docs.asymm.systems/apps/definitionguard/
- **Privacy Policy:** https://asymm.systems/privacy
- **Terms of Service:** https://asymm.systems/terms
- **Support Portal & SLA:** https://asymm.systems/support
- **Direct Support Contact:** `support@asymm.systems`
