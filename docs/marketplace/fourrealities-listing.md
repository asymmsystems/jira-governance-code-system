# Atlassian Marketplace Listing: FourRealities

## App Information
* **App Title:** FourRealities
* **Tagline:** Delivery evidence per Jira issue: decision, Definition of Done, PR, audit seal.
* **Categories:** Project Management, Security, Workflow & Automation

---

## Short Highlight Description (Max 250 chars)
Shows, for each Jira issue, which delivery evidence exists: a decision record, a Definition of Done, a pull request and an approval seal. Scores only the checks your site uses. Reads only Jira and your Confluence site. (218 characters)

---

## The Unaddressed Native Problem

Delivery evidence for one piece of work is spread over four places:

1. **Intent:** the architecture decision record or specification, usually a Confluence page or a decision issue.
2. **Process:** the Definition of Done for the issue.
3. **Code:** the pull request that delivered the work.
4. **Audit:** the approval seal on the finished issue.

Jira shows each of these in a different place, or not at all. When an auditor asks "which of these Done issues have a decision record, a completed Definition of Done, a merged pull request and an approval seal?", someone must open every issue by hand.

FourRealities checks the evidence for each issue, shows each check with a state (for example "Evidence found", "Evidence missing", "Reported, not verified" or "Not used on this site") and its source, and adds a project dashboard. The Reality Alignment Index (RAI) is the share of scored checks with evidence found. It is shown after the checks and with its parts.

---

## Key Capabilities & Verifiable Proof

| Capability | Underlying Mechanism | Verifiable Proof in Code & Tests |
|---|---|---|
| **Four Checks per Issue** | Intent: a link to a Confluence page on this site, or a link to an issue of a decision type (the types are a setting). Process: the Definition of Done record of DefinitionGuard, or the `checklist` property of Checklists for Jira (HeroCoders). Code: pull request count and state from the Jira Development field. Audit: the approval seal record of LedgerSeal. | `apps/fourrealities/src/engine/default-gate-engine.ts`, `apps/fourrealities/test/domain/gates.test.ts` |
| **Signed Records Are Verified** | DefinitionGuard and LedgerSeal sign their records with Ed25519. FourRealities checks the signature with the public key of the producer. A verified record is scored. A record it cannot verify is shown as "Reported, not verified" and is not scored. A record whose signature does not match, or that belongs to another issue, counts as evidence missing. Checklists for Jira records cannot be signed, so they are always "Reported, not verified". | `apps/fourrealities/src/accessor/attestation-verifier.ts`, `apps/fourrealities/test/contract/sibling-attestations.test.ts`, `apps/fourrealities/test/accessor-attestation-verifier.test.ts` |
| **Only the Checks Your Site Uses** | A Jira administrator sets the source of each check on the **FourRealities gate authority** admin page, or leaves it on **Detect**: Process and Audit are used once a signed DefinitionGuard or LedgerSeal record is found on the site, and Code once pull request data is found. A check that is not in use is not scored and shows "Not used on this site", with no next step. The dashboard lists the checks in use. | `apps/fourrealities/src/engine/default-source-policy-engine.ts`, `apps/fourrealities/src/frontend/admin.tsx`, `apps/fourrealities/test/engine/source-policy-engine.test.ts` |
| **Reality Alignment Index (RAI)** | Percent of scored checks with evidence found (0 to 100), with risk levels Critical, High, Medium and Low. Checks that are not applicable, not in use, excepted, reported or need a re-check are not scored. | `apps/fourrealities/src/engine/default-metrics-engine.ts`, `apps/fourrealities/test/domain/metrics-engine.test.ts` |
| **Pull Request State (Heuristic)** | Reads the Jira Development field populated by the GitHub, GitLab or Bitbucket integration. It cannot read pull request approvals, so a merged pull request is not shown as reviewed. | `apps/fourrealities/src/accessor/dev-field.ts`, `apps/fourrealities/test/jira/dev-field.test.ts` |
| **Link Decision Record with Confluence Search** | The **Link decision record** dialog searches Confluence pages by title through the Confluence REST API of your own Atlassian site, as the user, and adds a Jira remote link. A linked page counts as "Evidence found" (verified) when Confluence returns the page by its id; otherwise it shows "Evidence found (link only)". | `apps/fourrealities/src/accessor/default-forge-confluence-search-accessor.ts`, `apps/fourrealities/src/frontend/modals.tsx`, `apps/fourrealities/test/accessor-confluence-search.test.ts` |
| **Code Exceptions with Separation of Duties** | A user can request a Code exception for work with no pull request. A project administrator, a Jira administrator, or a member of an approver group set on the admin page approves, rejects or revokes it; never the requester or the assignee. Every step is kept with who and when. | `apps/fourrealities/src/engine/default-exception-policy-engine.ts`, `apps/fourrealities/src/manager/default-exception-manager.ts`, `apps/fourrealities/test/manager/exception-manager.test.ts` |
| **Rework Loops and Reasons** | A rework loop is a status change from a Done category back to a not-Done category, or from In Progress back to To Do. Users can add a rework reason. Reasons never change a check. | `apps/fourrealities/src/accessor/issue-facts.ts`, `apps/fourrealities/test/jira/issue-facts.test.ts`, `apps/fourrealities/test/accessor-rework-notes.test.ts` |
| **Project Dashboard** | Audit readiness, the four check cards with counts, the checks in use, Priority actions, Coverage at a glance, Issue triage with filters (search, assignee, sprint, gate) and a four-week trend. Snapshots refresh daily and on **Refresh**. | `apps/fourrealities/src/frontend/project-dashboard.tsx`, `apps/fourrealities/test/frontend/project-dashboard.test.tsx`, `apps/fourrealities/test/snapshot.test.ts` |
| **Issue Panel and Issue Context** | The "Four Realities" issue panel and issue context show the checks, the next step, the RAI with "Why N%?" and the actions. The next step names the sibling panel to use ("Definition of Done", "Approval Seal") only when that check is in use. | `apps/fourrealities/src/frontend/issue-panel.tsx`, `apps/fourrealities/test/frontend/issue-panel.test.tsx` |

---

## Works with, and works alone

- **On its own:** Intent always works. Code works when your Git integration for Jira fills the Development field. Process and Audit show "Not used on this site" and are not scored, so a finished issue is never marked down because another app is not installed.
- **With DefinitionGuard and LedgerSeal** (same publisher): their signed records are verified and scored. Until those apps publish production signing keys, their records show "Reported, not verified" in production and are not scored; a Jira administrator turns the checks on by hand on the admin page.
- **With Checklists for Jira (HeroCoders):** its `checklist` property is shown as "Reported, not verified" when a Jira administrator chooses it as the Process source.

---

## Enterprise Compliance Grounding

FourRealities collects delivery evidence in one place. It can support compliance with these controls:

- **SOC 2 Type II (CC8.1 Change Management):** Shows, for each change, whether a decision record, a Definition of Done, a merged pull request and an approval seal exist.
- **ISO/IEC 27001:2022 (A.8.32 Change Management):** Shows which changes have documented intent and an approval record, and keeps a who-and-when history of Code exceptions.

*Honest Compliance Boundary:* FourRealities reports which evidence exists. It verifies the signature of DefinitionGuard and LedgerSeal records, not their content, and it cannot read pull request approvals. It does not certify your organization. Your auditor decides whether your controls meet a standard.

*Honest Integration Note:* Pull request data comes from the Jira Development field, which your GitHub, GitLab or Bitbucket integration for Jira populates. Confluence page search and the page check use the Confluence REST API of your own Atlassian site through Forge. FourRealities calls no external (non-Atlassian) APIs.

---

## Data Privacy & "Runs on Atlassian" Architecture

- **Forge Native Execution:** Runs on Atlassian Cloud serverless compute.
- **Zero External Egress:** The manifest declares no external egress endpoints. No data is sent to servers outside Atlassian.
- **Customer Tenant Storage:** Snapshots, exception events, rework reasons and site settings are stored in Atlassian Forge Key-Value Storage (KVS). The `fourrealities-exception` issue property and remote links added by users are stored in Jira.
- **Personal Data:** FourRealities stores Atlassian account ids only where a rule needs them (who requested or decided a Code exception, who gave a rework reason, and the assignee for the "My issues" filter), and no names. It reports these ids to Atlassian every week and erases the ids of closed accounts.
- **Scopes:** `read:jira-work`, `write:jira-work`, `storage:app`, `search:confluence`, `read:confluence-content.summary`, `read:jira-user`, `report:personal-data`.

---

## Transparent Pricing

| Tier | Monthly Price | Annual Price (2 Months Free) |
|---|---|---|
| **1 to 10 Users** | **Free** | **Free** |
| **11 to 100 Users** | $1.40 per user / month | $14.00 per user / year |
| **101 to 250 Users** | $1.10 per user / month | $11.00 per user / year |
| **251 to 1,000 Users** | $0.80 per user / month | $8.00 per user / year |
| **Above 1,000 Users** | Custom | Custom |

*All billing is handled natively through Atlassian.*

---

## Highlights (images 580 x 330: `docs/marketplace/assets/fourrealities/highlight-1.png` to `highlight-3.png`)

1. **Four checks per issue, each with its source.** Intent, Process, Code and Audit, each with a state, a plain sentence and where the evidence comes from.
2. **Signed records are checked, not trusted.** A DefinitionGuard or LedgerSeal record counts only when its signature is verified; anything else is shown as reported and not scored.
3. **Only the checks your site uses.** A check that is not in use is not scored and says so; the dashboard lists the checks in use.

---

## Banner (1120 x 548: `docs/marketplace/assets/fourrealities/banner.png`)

Sources of the banner and highlights: `docs/marketplace/assets/fourrealities/media-src/` (rendered by `render.py`).

---

## Retina Screenshot Gallery Manifest (1840 x 900, captured from the app only, project "Payments Platform" on the development site)

1. `01-dashboard.png` - **Project dashboard.** Audit readiness, the four check cards (Code "Not used" on a site with no pull request data), the checks in use and Priority actions.
2. `02-issue-panel.png` - **Issue panel.** The checks of PAY-4 as a chain, the next step naming the Definition of Done panel, and the findings with their sources: a Confluence page linked and found.
3. `03-link-decision.png` - **Link a decision record.** Confluence search results in the dialog; the link is added as the user.
4. `04-inspect.png` - **Inspect from the triage table.** One issue's checks, gaps and sources, with Previous and Next.
5. `05-admin.png` - **FourRealities gate authority.** The evidence source of each check, what was detected on the site, and the decision issue types (the approver groups follow below).

Capture: `apps/fourrealities/test/live/marketplace_shots.py`.

---

## Support, Documentation & Legal Links

- **Documentation Portal:** https://asymm.systems/product/jira-governance/user-guide/fourrealities.html
- **Privacy Policy:** https://asymm.systems/privacy
- **Terms of Service:** https://asymm.systems/terms
- **Support Portal & SLA:** https://asymm.systems/support
- **Direct Support Contact:** `support@asymm.systems`
