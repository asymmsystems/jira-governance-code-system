<!--
Copyright (c) 2026 Asymm Systems. All rights reserved.

@author Fahim Farook
-->
# CascadePlan: timeline and dependencies with reviewed scope changes

**Jira timeline with percent-trigger links, block moves, baselines and undo.** Atlassian Forge app by Asymm Systems. Status on 2026-11-08: pending Marketplace approval.

## The need it answers

A regulated project must show what scope it committed to and who accepted each change. CascadePlan is a planning tool first; its governance angle is narrow and is stated below.

## What it does

1. **Start at a percent, not only at 100%.** A successor can start when its predecessor reaches a percent of its work. The link is a Jira "Blocks" link.
2. **Every Jira write shown first.** Before a drop, a line lists every date the drop will change. Only values the user chose are written, as the user, after a Jira permission check. Undo and redo for the last 20 changes.
3. **Jira stays the record.** Links, parents and dates are Jira's own; contributors are Jira sub-tasks.
4. **Baselines and scope reviews.** A plan approver freezes a baseline with a SHA-256 digest. A scope change is accepted or rejected by a plan approver who is not the requester. Versions can be compared and exported as CSV.

## Compliance mapping (supports; the auditor decides)

| Control | CascadePlan |
|---|---|
| SOC 2 CC8.1, ISO/IEC 27001:2022 A.8.32 | Every Jira write is a normal Jira edit by the signed-in user, in Jira's own issue history |
| Scope control | A frozen baseline records the committed scope; a change of scope needs an approver other than the requester |

## What it does not do

- It is not an approval or change-control app for releases. Use LedgerSeal for that.
- No capacity planning: the Utilization view shows estimated hours, with no capacity assumed.

## Data and hosting

Runs on Atlassian Forge. No external endpoint in the manifest. Plans, baselines, scope-change requests and approver groups in Forge storage; dates, trigger percents and create ids as issue properties. Account ids of who froze a baseline, who requested or reviewed a scope change, each contributor through a Jira sub-task, and the Jira administrator who last saved the approver groups; reported every 7 days; removed for closed accounts. Scopes: `read:jira-work`, `write:jira-work`, `read:jira-user`, `storage:app`, `report:personal-data`.

Isolated Cloud: planned. Government Cloud: planned.

## Price

Free for 1 to 10 users. $1.50 per user per month (11 to 100), $1.20 (101 to 250), $0.90 (251 and more).

## Links

User guide: https://asymm.systems/product/jira-governance/user-guide/cascadeplan.html.
