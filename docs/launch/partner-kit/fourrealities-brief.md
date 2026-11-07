<!--
Copyright (c) 2026 Asymm Systems. All rights reserved.

@author Fahim Farook
-->
# FourRealities: delivery evidence per Jira issue

**Delivery evidence per Jira issue: decision, Definition of Done, PR, audit seal.** Atlassian Forge app by Asymm Systems. Status on 2026-11-08: pending Marketplace approval.

## The Data Center need it answers

Before an audit, someone opens every Done issue to see which ones have a decision record, a completed Definition of Done, a merged pull request and an approval. On Data Center, some teams used audit or reporting apps for this; for example Auditor for Jira (Enhancera) is listed for Data Center and Server only (https://marketplace.atlassian.com/apps/43203, checked 2026-11-08). FourRealities is not a general audit log; it answers the per-issue evidence question.

## What it does

1. **Four checks per issue.** Intent (a linked Confluence page on the site, or a decision issue), Process (the DefinitionGuard record, or the Checklists for Jira property), Code (pull requests in the Jira Development field), Audit (the LedgerSeal seal record).
2. **Signed records are verified, not trusted.** DefinitionGuard and LedgerSeal records count only when the Ed25519 signature is verified against the production key and the record is not older than one already seen.
3. **Only the checks the site uses.** A check not in use shows "Not used on this site" and is not scored.
4. **Project dashboard.** Audit readiness, the four check cards, priority actions, issue triage and a four-week trend.
5. **Code exceptions with separation of duties.** Work with no pull request can get an exception, approved by an approver who is not the requester or the assignee.

## Compliance mapping (supports; the auditor decides)

| Control | FourRealities |
|---|---|
| SOC 2 CC8.1 | Shows, per change, whether a decision record, a Definition of Done, a merged pull request and an approval seal exist |
| ISO/IEC 27001:2022 A.8.32 | Shows which changes have documented intent and an approval record; keeps a who-and-when history of Code exceptions |

## What it does not do

- It cannot read pull request approvals, so a merged pull request is not shown as reviewed.
- It verifies the signature of DefinitionGuard and LedgerSeal records, not their content.
- A Checklists for Jira record cannot be signed, so with that source a checklist never counts as evidence.
- On its own, Process and Audit are "Not used on this site". It is strongest with DefinitionGuard and LedgerSeal.
- Not a general Jira audit log.

## Data and hosting

Runs on Atlassian Forge. No external egress. Calls only Jira and the Confluence REST API of the customer's own site. Snapshots, exception events, rework reasons and settings in Forge storage. Account ids only where a rule needs them; reported weekly; ids of closed accounts erased. Scopes: `read:jira-work`, `write:jira-work`, `storage:app`, `search:confluence`, `read:confluence-content.summary`, `read:jira-user`, `report:personal-data`.

Isolated Cloud: planned. Government Cloud: planned.

## Price

Free for 1 to 10 users. $1.40 per user per month (11 to 100), $1.10 (101 to 250), $0.80 (251 and more).

## Links

User guide: https://asymm.systems/product/jira-governance/user-guide/fourrealities.html.
