# Atlassian Marketplace Listing: FourRealities

## App Information
* **App Title:** FourRealities
* **Tagline:** Delivery evidence per Jira issue: decision, Definition of Done, PR, audit seal.
* **Categories:** Project Management, Security, Workflow & Automation

---

## Short Highlight Description (Max 250 chars)
Shows, for each Jira issue, which delivery evidence exists: a decision record, a Definition of Done, a pull request and an audit seal. Project dashboard with gate rates, triage and trend. Reads only Jira and your Confluence site. (229 characters)

---

## The Unaddressed Native Problem

Delivery evidence for one piece of work is spread over four places:

1. **Intent:** the architecture decision record or specification, usually a Confluence page or a decision issue.
2. **Process:** the Definition of Done for the issue.
3. **Code:** the pull request that delivered the work.
4. **Audit:** the approval seal on the finished issue.

Jira shows each of these in a different place, or not at all. When an auditor asks "which of these Done issues have a decision record, a completed Definition of Done, a merged pull request and an approval seal?", someone must open every issue by hand.

FourRealities checks the four kinds of evidence for each issue, shows each one as a gate with a state (for example "Evidence found", "Evidence missing" or "Not applicable") and its source, and adds a project dashboard. The Reality Alignment Index (RAI) is the share of rated gates with evidence found. It is shown after the gates and with its parts.

---

## Key Capabilities & Verifiable Proof

| Capability | Underlying Mechanism | Verifiable Proof in Code & Tests |
|---|---|---|
| **Four Gates per Issue** | Intent: a Confluence page link on this site or a link to a decision-type issue. Process: a DefinitionGuard record, or a HeroCoders `checklist` property as a hint. Code: pull request count and state from the Jira Development field. Audit: a LedgerSeal record. | `apps/fourrealities/src/engine/default-gate-engine.ts`, `apps/fourrealities/test/domain/gates.test.ts` |
| **Reality Alignment Index (RAI)** | Percent of rated gates with evidence found (0 to 100), with risk levels Critical, High, Medium and Low. | `apps/fourrealities/src/engine/default-metrics-engine.ts`, `apps/fourrealities/test/domain/metrics-engine.test.ts` |
| **Pull Request State (Heuristic)** | Reads the Jira Development field populated by the GitHub, GitLab or Bitbucket integration. It cannot read pull request approvals, so a merged pull request is not shown as reviewed. | `apps/fourrealities/src/accessor/dev-field.ts`, `apps/fourrealities/test/jira/dev-field.test.ts` |
| **Link Decision Record with Confluence Search** | The **Link decision record** dialog searches Confluence pages by title through the Confluence REST API of your own Atlassian site, as the user, and adds a Jira remote link. | `apps/fourrealities/src/accessor/default-forge-confluence-search-accessor.ts`, `apps/fourrealities/src/frontend/modals.tsx`, `apps/fourrealities/test/accessor-confluence-search.test.ts` |
| **Code Exceptions with Separation of Duties** | A user can request a Code exception for work with no pull request. A project or Jira administrator who is not the requester or the assignee approves, rejects or revokes it. Every step is kept with who and when. | `apps/fourrealities/src/engine/default-exception-policy-engine.ts`, `apps/fourrealities/test/engine/exception-policy-engine.test.ts`, `apps/fourrealities/test/manager/exception-manager.test.ts` |
| **Rework Loops and Reasons** | A rework loop is a status change from a Done category back to a not-Done category, or from In Progress back to To Do. Users can add a rework reason. Reasons never change a gate. | `apps/fourrealities/src/accessor/issue-facts.ts`, `apps/fourrealities/test/jira/issue-facts.test.ts`, `apps/fourrealities/test/accessor-rework-notes.test.ts` |
| **Project Dashboard** | Audit readiness, gate rates with counts, Priority actions, Coverage at a glance, Issue triage with filters (search, assignee, sprint, gate) and a four-week trend. Snapshots refresh daily and on **Refresh**. | `apps/fourrealities/src/frontend/project-dashboard.tsx`, `apps/fourrealities/test/frontend/project-dashboard.test.tsx`, `apps/fourrealities/test/snapshot.test.ts` |
| **Issue Panel and Issue Context** | The "Four Realities" issue panel and issue context show the gates, the next step, the RAI with "Why N%?" and the actions. | `apps/fourrealities/src/frontend/issue-panel.tsx`, `apps/fourrealities/test/frontend/issue-panel.test.tsx` |

---

## Enterprise Compliance Grounding

FourRealities collects delivery evidence in one place. It can support compliance with these controls:

- **SOC 2 Type II (CC8.1 Change Management):** Shows, for each change, whether a decision record, a Definition of Done, a merged pull request and an approval seal exist.
- **ISO/IEC 27001:2022 (A.8.32 Change Management):** Shows which changes have documented intent and an approval record, and keeps a who-and-when history of Code exceptions.

*Honest Compliance Boundary:* FourRealities reports which evidence exists. It does not verify the content of records written by other apps, and it cannot read pull request approvals. It does not certify your organization. Your auditor decides whether your controls meet a standard.

*Honest Integration Note:* Pull request data comes from the Jira Development field, which your GitHub, GitLab or Bitbucket integration for Jira populates. Confluence page search uses the Confluence REST API of your own Atlassian site, as the signed-in user, through Forge. FourRealities calls no external (non-Atlassian) APIs.

---

## Data Privacy & "Runs on Atlassian" Architecture Guarantee

- **100% Forge Native Execution:** Runs entirely on Atlassian Cloud serverless compute.
- **Zero External Egress:** The manifest declares no external egress endpoints. No data is sent to servers outside Atlassian.
- **Customer Tenant Storage:** Snapshots, exception events, rework reasons and site settings are stored in Atlassian Forge Key-Value Storage (KVS).
- **Tenant Data Residency:** Data stays with your Atlassian Cloud site.

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

1. `01-dashboard.png` - **Project Dashboard:** Audit readiness, the four gate cards with counts, Priority actions, Coverage at a glance and the start of Issue triage.
2. `02-rai-glance.png` - **Issue Panel:** The "Four Realities" panel on an issue, with the four gate statuses, the next step and links to the LedgerSeal and DefinitionGuard panels.
3. `03-rework-alert.png` - **RECAPTURE REQUIRED:** The file shows the "Record a rework reason for AUDT-1" dialog, not an alert. Capture the issue panel with **Gate findings** expanded on an issue with rework loops, showing "Rework loops: N." and the **Add rework reason** button.
4. `04-settings.png` - **RECAPTURE REQUIRED:** The file shows a plain Jira issue (AUDT-2) with FourRealities collapsed; there is no settings screen. Capture the **Link decision record** dialog with Confluence search results ("Search Confluence pages").
5. `05-drift-breakdown.png` - **RECAPTURE REQUIRED:** The file shows the dashboard loading spinner ("Evaluating delivery evidence..."). Capture the dashboard Issue triage after clicking **Inspect** on an issue, or the issue panel with **Gate findings** expanded and "Why N%?" open.

---

## Support, Documentation & Legal Links

- **Documentation Portal:** https://asymm.systems/product/jira-governance/user-guide/fourrealities.html
- **Privacy Policy:** https://asymm.systems/privacy
- **Terms of Service:** https://asymm.systems/terms
- **Support Portal & SLA:** https://asymm.systems/support
- **Direct Support Contact:** `support@asymm.systems`
