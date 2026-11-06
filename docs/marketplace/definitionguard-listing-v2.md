# Atlassian Marketplace Listing: DefinitionGuard

## App Information
* **App Title:** DefinitionGuard
* **Tagline:** Enforceable Definition of Done with evidence, review rules, and audit history.
* **Categories:** Workflow & Automation, Security, Project Management

---

## Short Highlight Description (Max 250 chars)
Enforce your Definition of Done at workflow transitions. DefinitionGuard can require evidence links or notes, keep review items away from the assignee, and record waivers with reasons before issues move to Done. (211 characters)

---

## The Unaddressed Native Problem

In modern engineering teams, "Definition of Done" (DoD) is usually documented in a wiki page or listed as an unchecked text field in a Jira ticket description. Because native Jira cannot gate workflow transitions based on structured DoD evidence, teams face common release breakdowns:

1. **Unverified Checklists:** Developers tick manual checkboxes without linking test results, design sign-offs, or documentation PRs.
2. **Self-Review Loopholes:** The ticket assignee can tick "Peer Review Complete" on their own work.
3. **Silent Waivers:** Quality gates are bypassed informally in Slack or standups without a recorded reason.
4. **Ungated Done Transitions:** Tickets move cleanly to Done even when mandatory steps remain incomplete.

DefinitionGuard turns your Definition of Done from a checklist into a gate on the move to Done.

---

## Key Capabilities & Verifiable Proof

| Capability | Underlying Mechanism | Verifiable Proof in Code & Tests |
|---|---|---|
| **Per-Issue-Type DoD Checklists** | Project administrators edit a template for each issue type in Project Settings > DefinitionGuard and can re-sync open issues to a changed template. | `apps/definitionguard/src/settings/settings-resolvers.ts`, `apps/definitionguard/src/ui/template-editor.ts`, `apps/definitionguard/test/settings/project-templates.test.ts` |
| **Evidence on Items** | Items marked "Evidence required" can only be ticked with a link (http or https), a note, or both. The app checks the link format, not what it points to. | `apps/definitionguard/src/domain/evidence.ts`, `apps/definitionguard/test/resolvers/evidence.test.ts` |
| **Not-the-Assignee Rule** | Items marked "Not the assignee" cannot be ticked or waived by the current assignee, or by anyone who was the assignee of the issue after the item was opened (read from the issue's change history). The validator checks this again at the move to Done. | `apps/definitionguard/src/index.ts`, `apps/definitionguard/test/resolvers/roles-waivers.test.ts` |
| **Waivers with Reasons** | Approvers and users with the waiver permission (default: Administer projects) can waive an open mandatory item with a reason of 10 to 500 characters, recorded in the history. | `apps/definitionguard/src/index.ts`, `apps/definitionguard/test/resolvers/roles-waivers.test.ts` |
| **Move-to-Done Gate** | The **DefinitionGuard DoD Enforcement** workflow validator blocks a move into a Done-category status while any mandatory item is open and not waived. Exempt statuses are let through. It blocks when it cannot read the data it needs. | `apps/definitionguard/src/index.ts`, `apps/definitionguard/src/domain/gate-rule.ts`, `apps/definitionguard/test/validator/validate-transition.test.ts` |
| **Gate Coverage Check** | Project settings list each workflow transition into a Done status as Gated, Not gated, or Exempt. | `apps/definitionguard/src/settings/coverage.ts`, `apps/definitionguard/test/settings/coverage.test.ts` |
| **Hash-Chained History** | Every tick, reopen, waiver, reset, and template re-sync on the issue is recorded in a hash-chained history. The panel shows whether the chain is intact. | `apps/definitionguard/src/domain/event-log.ts`, `apps/definitionguard/test/domain/chain-verify.test.ts` |
| **JSON History Export** | Project administrators click **Export history** in the issue panel and copy the JSON text, which holds every event and the result of the history check. The panel has no download button. | `apps/definitionguard/src/index.ts`, `apps/definitionguard/test/resolvers/export.test.ts` |

**How the gate works.** A Jira admin adds the DefinitionGuard validator to each transition in the workflow editor. The app cannot add it for you. The Gate Coverage Check shows where it is missing. Works in company-managed projects; the validator is also offered in team-managed projects.

### Each Capability and Its Backlog Item

Each row names the backlog item in `docs/sdlc/definitionguard-usp-ux-research-2026-11/backlog.md` and its test in `apps/definitionguard/`.

| Capability | Backlog item | Test |
|---|---|---|
| Fails closed: any error blocks the move and writes nothing | B-01 | `test/validator/validate-transition.test.ts` |
| Permission checks as the user on every change | B-02 | `test/security/permissions.test.ts` |
| No lost updates when two people tick at once | B-03 | `test/storage/checklist-store.test.ts` |
| Bounded storage, history in pages | B-04 | `test/storage/size-budget.test.ts` |
| History check with its stated limit | B-05 | `test/domain/chain-verify.test.ts` |
| Project templates for admins | B-06 | `test/settings/project-templates.test.ts` |
| People shown from their Jira account, never stored by name | B-07 | `test/ui/attribution.test.ts` |
| Marketplace licensing | B-09 | `test/security/licence.test.ts` |
| One rule for Done-category moves, exempt statuses | B-10 | `test/validator/gate-rule.test.ts` |
| Evidence and evidence-required items | B-11 | `test/resolvers/evidence.test.ts` |
| Required permission, not the assignee, waivers | B-12 | `test/resolvers/roles-waivers.test.ts` |
| Clear panel text, accessible names, no raw errors | B-13 | `test/ui/panel-view-model.test.ts` |
| Signed issue property on every change | B-14 | `test/integrity/attestation.test.ts` |
| History export | B-15 | `test/resolvers/export.test.ts` |
| Template versions and re-sync | B-16 | `test/settings/resync.test.ts` |
| Coverage check | B-17 | `test/settings/coverage.test.ts` |
| Retry on Jira rate limits | B-18 | `test/jira/jira-client.test.ts` |
| Data model after the Silverston patterns (as Apache OFBiz implements them) | B-21 | `test/domain/event-log.test.ts` |

---

## Enterprise Compliance Grounding

DefinitionGuard provides records that support internal and external audits:

- **SOC 2 Type II (CC8.1 & CC7.2):** Supports compliance by recording that the testing, security review, and documentation items you define were completed or waived before an issue moved to Done.
- **ISO/IEC 27001:2022 (Control A.8.29 & A.8.32):** Supports compliance by recording that documented security and testing requirements were met before release.
- **GxP / MedTech Quality Systems:** Supports compliance by keeping a hash-chained record of verification and review sign-offs and of waivers with reasons. The history check shows edits, removals, and reordering of the stored history. It does not stop someone who can rewrite all of the app's stored data, and that includes the app vendor.

*Honest Compliance Boundary:* DefinitionGuard enforces the criteria you define. DefinitionGuard does not certify your team against any standard. It does not certify your processes. Your auditor decides whether your quality management procedures meet these frameworks.

---

## Data Privacy & "Runs on Atlassian" Architecture

- **Forge Native Execution:** Runs on Atlassian Forge.
- **No External Egress:** The app manifest declares no external fetch permissions. The app calls only the Jira REST API of your site.
- **Forge Storage:** Checklist state and history are kept in Atlassian Forge key-value storage for your site.
- **Data Residency:** Data residency follows Atlassian's rules for Forge app storage.

---

## Security

- **Scopes.** The app requests these scopes, and why:
- `read:jira-work`: read issues, statuses and your Jira permissions.
- `write:jira-work`: write the `definitionguard-dod` issue property.
- `read:jira-user`: read group memberships and search groups for approver authority.
- `storage:app`: keep checklists, their history and settings in Forge storage.
- `read:workflow:jira`: read workflows for the coverage check. Read only.
- `report:personal-data`: report the stored people to Atlassian once a week, so the app can erase the link to each closed account.
- **Who can change what.** Ticking needs Edit issues on the issue. An item can also need a chosen Jira permission, or be closed to the current assignee. Exporting and the project settings need Administer projects. Waiving and resetting need an approver: a project admin, a Jira admin, or a member of a group that a Jira admin chooses on the **DefinitionGuard approvers** page. A user with the waiver permission of the template can also waive. Each check runs as the user.
- **Where data lives.** Checklists, history, templates and approver groups are stored in Forge storage for your site.
- **The signature.** On every change the app writes a summary of the checklist to the `definitionguard-dod` issue property and signs it with Ed25519. The signature shows that DefinitionGuard wrote the issue property. The app vendor holds the signing key, so the signature does not protect against the vendor. The public key to check it is published in `docs/marketplace/definitionguard-public-key.pem`. If the signing key is not set, the property is written without a signature. Other apps and users can still write the issue property; the gate never reads it.
- **The history check.** It shows edits, removals and reordering of the stored history. It does not stop someone who can rewrite all of the app's stored data and the history check with it, and that includes the app vendor.
- **Tests.** The code has automated tests with at least 90% branch coverage for each source file. The UI files are rendered from tested view models; the UI files themselves are not measured.

---

## Transparent Pricing

| Tier | Monthly Price | Annual Price (2 Months Free) |
|---|---|---|
| **1 to 10 Users** | **Free** | **Free** |
| **11 to 100 Users** | $0.95 per user / month | $9.50 per user / year |
| **101 to 250 Users** | $0.75 per user / month | $7.50 per user / year |
| **251 to 1,000 Users** | $0.24 per user / month | $2.40 per user / year |
| **More than 1,000 Users** | Custom price | Custom price |

*All billing is integrated directly into your Atlassian subscription.*

---

## Retina Screenshot Gallery Manifest

1. `01-checklist-open.png` - **DoD Checklist Panel:** The Definition of Done panel with the Incomplete lozenge, the open mandatory items, Mandatory, Optional, and Waived lozenges, Tick with evidence and Waive buttons, and who completed or waived each item (3 of 6 done).
2. `02-evidence-link.png` - **RECAPTURE REQUIRED:** The current file shows Jira's own "Linked work items" picker on DEMO-35 and the top of the DefinitionGuard panel. It shows no DefinitionGuard evidence form. Capture instead: the evidence form open on an item in the panel ("This item needs evidence. Add a link, a note, or both.", the link and note fields, and Save and tick).
3. `03-transition-blocked.png` - **RECAPTURE REQUIRED:** The current file is a mock-up modal ("Workflow Transition Blocked" with a status table and an Acknowledge button) that does not exist in Jira or in DefinitionGuard. Capture instead: the real Jira transition error that shows the DefinitionGuard DoD Enforcement message listing the open mandatory items.
4. `04-project-settings.png` - **RECAPTURE REQUIRED:** The current file shows Jira's "App management has moved to Administration" page, not DefinitionGuard. Capture instead: Project Settings > DefinitionGuard with the Definition of Done templates editor (issue type, items with Mandatory, Evidence required, and Not the assignee) and the Gate coverage list.
5. `05-audit-export.png` - **JSON History Export:** The checklist history export shown in the issue panel as JSON text to copy, with the chain check result and the events with who acted and when.

---

## Support, Documentation & Legal Links

- **Documentation Portal:** https://asymm.systems/product/jira-governance/user-guide/definitionguard.html
- **Privacy Policy:** https://asymm.systems/privacy
- **Terms of Service:** https://asymm.systems/terms
- **Support Portal & SLA:** https://asymm.systems/support
- **Direct Support Contact:** `support@asymm.systems`
