<!--
Copyright (c) 2026 Asymm Systems. All rights reserved.

@author Fahim Farook
-->
# Jira Governance Suite: the cloud governance layer for regulated migrations

**Asymm Systems. Four Atlassian Forge apps for Jira Cloud. Status on 2026-11-08: pending Atlassian Marketplace approval.**

## The situation

Atlassian ends Jira Data Center on 2029-03-28. New Data Center apps could not be submitted after 2025-12-16 (Atlassian developer blog, https://www.atlassian.com/blog/developer/from-data-center-to-cloud-the-next-chapter-for-marketplace-apps), and new customers could not buy Data Center after 2026-03-30 (Atlassian, "Data Center end of life", https://www.atlassian.com/licensing/data-center-end-of-life). Regulated teams must keep their change control when they move. Some Data Center governance apps have no cloud version; the migration assistant then says "This app is not available in cloud".

## The four apps

| App | The governance step | How |
|---|---|---|
| **LedgerSeal** | An approval that stays bound to what was approved | Seals the issue at approval with a SHA-256 snapshot of covered fields, comments and attachments. Names each later change and who made it. The person who made the changes cannot approve them. A workflow validator blocks the transition until another approver approves the changes. |
| **DefinitionGuard** | A Definition of Done that blocks the move to Done | Per-issue-type checklists; items that need evidence; items the assignee may not tick; waivers with a reason; a hash-chained history. |
| **FourRealities** | Delivery evidence per issue, for audit preparation | Four checks per issue: decision record, Definition of Done, pull request, approval seal. Signed records count only when the signature is verified. |
| **CascadePlan** | A planning baseline with reviewed scope changes | Percent-trigger dependencies, every Jira write shown first and undoable, frozen baselines with a SHA-256 digest, scope changes approved by someone other than the requester. |

## Why it fits a regulated cloud

- **Runs on Atlassian Forge.** No manifest declares external egress. The apps call only the Atlassian APIs of the customer's own site. Asymm Systems operates no servers for them.
- **Data stays in Atlassian.** App data is in Forge storage for the customer's installation and in Jira issue properties, under Atlassian's data residency rules for Forge apps.
- **Forge only, no Connect.** That is a condition for Atlassian Isolated Cloud.
- **Evidence an auditor can check.** LedgerSeal evidence can be checked offline with an open-source (Apache-2.0) verifier and the published key.

## Compliance mapping (supports; the auditor decides)

| Framework | What the suite supports | Stated limit |
|---|---|---|
| SOC 2 CC8.1 | Change authorization, post-approval integrity, separation of duties, testing evidence before Done | The apps do not certify a team |
| ISO/IEC 27001:2022 A.8.32 | Record of changes, formal approval enforced by validators, hash-chained history | A Jira admin must add the validators to each transition |
| FDA 21 CFR Part 11 | LedgerSeal: audit trail 11.10(e); 11.50 partly met | Not met: 11.200 and 11.300 (no re-authentication at sealing) |

Full mapping: https://asymm.systems/product/jira-governance/compliance.html

## What the suite does not do

- It does not make a team compliant or certify it.
- No Part 11 electronic signatures by themselves.
- No approval routing with several steps or parallel approvers.
- No Confluence page approval or document control.
- No general Jira audit log of admin and configuration events.
- Asymm Systems holds the signing keys, so the signatures do not protect against the vendor.

## Availability

| Where | Status on 2026-11-08 |
|---|---|
| Jira Cloud (Standard, Premium, Enterprise, with data residency) | Pending Marketplace approval |
| Atlassian Isolated Cloud | Planned. Needs a separate listing after the cloud listing is live |
| Atlassian Government Cloud | Planned. Onboarding not started |

## Price

Per user per month, sold through Atlassian. Free for 1 to 10 users. LedgerSeal and DefinitionGuard: $0.95 (11 to 100), $0.75 (101 to 250), $0.24 (251 and more). FourRealities: $1.40, $1.10, $0.80. CascadePlan: $1.50, $1.20, $0.90.

## Contact

Asymm Systems, https://asymm.systems/product/jira-governance.html. Support: support@asymm.systems. Security: security@asymm.systems.
