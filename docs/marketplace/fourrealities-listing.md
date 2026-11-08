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

FourRealities checks the evidence for each issue, shows each check with a state (for example "Evidence found", "Evidence missing", "Not applicable" or "Not used on this site") and its source, and adds a project dashboard. The Reality Alignment Index (RAI) is the share of scored checks with evidence found. It is shown after the checks and with its parts.

---

## Key Capabilities & Verifiable Proof

| Capability | Underlying Mechanism | Verifiable Proof in Code & Tests |
|---|---|---|
| **Four Checks per Issue** | Intent: a link to a Confluence page on this site, or a link to an issue of a decision type (the types are a setting). Process: the Definition of Done record of DefinitionGuard, or the `checklist` property of Checklists for Jira (HeroCoders). Code: pull request count and state from the Jira Development field. Audit: the approval seal record of LedgerSeal. | `apps/fourrealities/src/engine/default-gate-engine.ts`, `apps/fourrealities/test/domain/gates.test.ts` |
| **Signed Records Are Verified** | DefinitionGuard and LedgerSeal sign their records with Ed25519. FourRealities checks the signature with the public key of the producer. A verified record is scored. A record it cannot verify (unsigned, or signed with a key it does not trust) counts exactly like no record: evidence missing on a Done issue, not applicable before Done. A record changed after signing, copied from another issue, or older than a record already seen counts as evidence missing, also before Done. The panel still says what the record reports and why it did not count. Checklists for Jira records cannot be signed, so with that source a checklist never counts as evidence. | `apps/fourrealities/src/accessor/attestation-verifier.ts`, `apps/fourrealities/test/contract/sibling-attestations.test.ts`, `apps/fourrealities/test/accessor-attestation-verifier.test.ts` |
| **Only the Checks Your Site Uses** | A Jira administrator sets the source of each check on the **FourRealities gate authority** admin page, or leaves it on **Detect**: Process and Audit are used once a signed DefinitionGuard or LedgerSeal record is found on the site, and Code once pull request data is found. A check that is not in use is not scored and shows "Not used on this site", with no next step. The dashboard lists the checks in use. Code needs Jira's Development field: on a site without it, Code is "Not applicable" on every issue, whatever the setting, and the admin page says so. | `apps/fourrealities/src/engine/default-source-policy-engine.ts`, `apps/fourrealities/src/frontend/admin.tsx`, `apps/fourrealities/src/ui/sources-text.ts`, `apps/fourrealities/test/engine/source-policy-engine.test.ts`, `apps/fourrealities/test/ui/sources-text.test.ts` |
| **Reality Alignment Index (RAI)** | Percent of scored checks with evidence found (0 to 100), with risk levels Critical, High, Medium and Low. Checks that are not applicable, not in use, excepted or need a re-check are not scored. | `apps/fourrealities/src/engine/default-metrics-engine.ts`, `apps/fourrealities/test/domain/metrics-engine.test.ts` |
| **Pull Request State (Heuristic)** | Reads the Jira Development field populated by the GitHub, GitLab or Bitbucket integration. It cannot read pull request approvals, so a merged pull request is not shown as reviewed. | `apps/fourrealities/src/accessor/dev-field.ts`, `apps/fourrealities/test/jira/dev-field.test.ts` |
| **Link Decision Record with Confluence Search** | The **Link decision record** dialog searches Confluence pages by title through the Confluence REST API of your own Atlassian site, as the user, and adds a Jira remote link. A linked page counts as "Evidence found" (verified) when Confluence returns the page by its id; otherwise it shows "Evidence found (link only)". | `apps/fourrealities/src/accessor/default-forge-confluence-search-accessor.ts`, `apps/fourrealities/src/frontend/modals.tsx`, `apps/fourrealities/test/accessor-confluence-search.test.ts` |
| **Code Exceptions with Separation of Duties** | A user can request a Code exception for work with no pull request. A project administrator, a Jira administrator, or a member of an approver group set on the admin page approves, rejects or revokes it; never the requester or the assignee. Every step is kept with who and when. | `apps/fourrealities/src/engine/default-exception-policy-engine.ts`, `apps/fourrealities/src/manager/default-exception-manager.ts`, `apps/fourrealities/test/manager/exception-manager.test.ts` |
| **Rework Loops and Reasons** | A rework loop is a status change from a Done category back to a not-Done category, or from In Progress back to To Do. Users can add a rework reason. Reasons never change a check. | `apps/fourrealities/src/accessor/issue-facts.ts`, `apps/fourrealities/test/jira/issue-facts.test.ts`, `apps/fourrealities/test/accessor-rework-notes.test.ts` |
| **Project Dashboard** | Audit readiness, the four check cards with counts, the checks in use, Priority actions, Coverage at a glance, Issue triage with filters (search, assignee, sprint, gate) and a four-week trend. Snapshots refresh daily and on **Refresh**. | `apps/fourrealities/src/frontend/project-dashboard.tsx`, `apps/fourrealities/test/frontend/project-dashboard.test.tsx`, `apps/fourrealities/test/snapshot.test.ts` |
| **Issue Panel and Issue Context** | The "Four Realities" issue panel and issue context show the checks, the next step, the RAI with "Why N%?" and the actions. The next step names the sibling panel to use ("Definition of Done", "Approval Seal") only when that check is in use. | `apps/fourrealities/src/frontend/issue-panel.tsx`, `apps/fourrealities/test/frontend/issue-panel.test.tsx` |

---

## Works with, and works alone

- **On its own:** Intent always works. Code works when your Git integration for Jira fills the Development field. Process and Audit show "Not used on this site" and are not scored, so a finished issue is never marked down because another app is not installed.
- **With DefinitionGuard and LedgerSeal** (same publisher): their signed records are verified and scored. In production FourRealities trusts only the production signing keys of those apps (`dg-prod-2026-11` and `ls-prod-2026-11`, published at https://asymm.systems/product/jira-governance/signing-keys.html); a record signed with a development key counts as not verified.
- **With Checklists for Jira (HeroCoders):** a Jira administrator can choose it as the Process source; its `checklist` property is shown, but it cannot be verified, so it never counts as evidence.

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
| **Above 1,000 Users** | $0.80 per user / month | $8.00 per user / year |

*All billing is handled natively through Atlassian.*

---

## Highlights (images 1840 x 900: the Marketplace form needs at least 920 x 450, so the matching screenshots are used; `highlight-1.png` to `highlight-3.png` in `docs/marketplace/assets/fourrealities/` are too small)

Images used: highlight 1 `02-issue-panel.png`, highlight 2 `04-inspect.png`, highlight 3 `01-dashboard.png`.

1. **Four checks per issue, each with its source.** Intent, Process, Code and Audit, each with a state, a plain sentence and where the evidence comes from.
2. **Signed records are checked, not trusted.** A DefinitionGuard or LedgerSeal record counts only when its signature is verified and it is not older than one already seen; a hand-written record counts like no record.
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


---

## Post-approval copy: regulated migration

Added 2026-11-08. For use **after** Atlassian approves this listing: a listing cannot be edited while it is pending. Facts only, from the sections above. Do not name another vendor or app in the listing. Do not mention Isolated Cloud or Government Cloud until those listings exist. Strategy: `docs/launch/regulated-enterprise-playbook.md`.

- **Tagline (69 characters):** Delivery evidence per Jira issue, for audits after the move to cloud.
- **Highlight (205 characters):** Moving from Data Center? FourRealities shows, per Jira issue, whether a decision record, a Definition of Done, a pull request and an approval seal exist. Signed records count only when verified. No egress.
- **Description lines:**
  - Moving regulated Jira from Data Center to cloud? Answer the auditor's sampling question per issue, without opening every issue by hand.
  - Four checks per issue: Intent, Process, Code and Audit, each with its state and its source.
  - DefinitionGuard and LedgerSeal records count only when their Ed25519 signature is verified. Checks your site does not use are not scored.
  - Supports SOC 2 CC8.1 and ISO/IEC 27001:2022 A.8.32. It cannot read pull request approvals, and it verifies signatures, not content.
  - Runs on Atlassian Forge. It calls only Jira and the Confluence REST API of your own site; no external APIs.
- **Search words to keep in the text:** audit evidence, audit readiness, traceability, change management, Definition of Done, approval.

---

## Release copy: evidence reports (ADR-015)

Added 2026-11-08 (owner decision Q7). Use **when the version with evidence reports is in production** (it is in development only, version 7.7.0), not before: the listing must not claim a feature that the Marketplace version does not have. The words for the feature are "evidence reports for change-management audits", never "audit log", "tamper-proof", "tamper-evident" or "compliant" (spec v4 section 11.9).

- **Capability row** (add to "Key Capabilities & Verifiable Proof"):

| Capability | Underlying Mechanism | Verifiable Proof in Code & Tests |
|---|---|---|
| **Evidence Reports for Change-Management Audits** | For one project and one period, a report of the issues in scope with their four checks, the verified DefinitionGuard and LedgerSeal records, Code exceptions and rework notes, and who changed which field and when, from Jira's history. A JSON file, a CSV file and a manifest that FourRealities signs with Ed25519; each manifest holds the hash of the project's previous one, and the open verifier checks a report offline. Made on request by project or Jira administrators or an evidence report group, or on a weekly or monthly schedule; kept in the app (400 days by default) and never sent anywhere; deletion records, the list entries of removed reports and the party token map are kept longer, as the privacy policy says. The files hold, in plain text, issue keys and summaries (up to 120 characters), the reasons of Code exceptions, rework notes, the address and title of a linked Confluence page (typed by users, so any text), linked decision-issue keys (never their content), and evidence references (LedgerSeal certificate ids and hashes). A download needs every issue of the report to be visible to you. People appear as tokens in the signed files; free-text fields show that they changed, not the text. | `apps/fourrealities/src/manager/default-evidence-report-manager.ts`, `apps/fourrealities/src/engine/default-report-engine.ts`, `tools/verifier/verify-fourrealities-report.mjs`, `apps/fourrealities/test/contract/report-verifier.test.ts` |

- **Compliance boundary sentence** (add to "Honest Compliance Boundary"): FourRealities is not an administrative audit log: Jira's audit log and Atlassian Guard keep it. An evidence report holds what Jira's history held when the report was made; an issue deleted before then is not in it.
- **Customer Tenant Storage** (replace the bullet): Snapshots, exception events, rework reasons, site settings and report records are stored in Atlassian Forge Key-Value Storage (KVS); evidence report files are stored in Atlassian Forge Object Store. The `fourrealities-exception` issue property and remote links added by users are stored in Jira.
- **Personal Data** (add): Evidence report files name people by party token, never by account id or name; they also hold, in plain text, issue summaries (up to 120 characters), Code exception reasons, rework notes, and the address and title of a linked Confluence page, which you or your users wrote and which can hold any text, plus linked decision-issue keys and evidence references (LedgerSeal certificate ids and hashes). Reports are removed when their retention ends (400 days by default; a Jira administrator can choose 90 days to 7 years). Some small records outlive it: a deletion record (tombstone, with the administrator's reason) stays while the app is installed; the list entries of failed, expired and deleted reports stay until the newest 200 entries of the project push them out; and the link from each party token to an Atlassian account id stays while the account is open (it is reported to Atlassian every week, and removed when the account closes). The token map is reported to Atlassian every week with the other account ids, and a closed account's entry is removed, so the signed files never change. The people file of a download is made as you, is not signed, and is removed 24 to 25 hours after the download.
- **Description line** (add to the regulated migration copy): Evidence reports for change-management audits: one signed record per project and period, for the auditor's sample, checked offline with the open verifier.
- **Release note**: Adding Forge Object Store makes this a major version: each site administrator accepts the update. No new scope.

