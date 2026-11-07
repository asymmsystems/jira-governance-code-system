<!--
Copyright (c) 2026 Asymm Systems. All rights reserved.

@author Fahim Farook
-->
# DefinitionGuard: enforced Definition of Done for Jira Cloud

**Enforceable Definition of Done with evidence, review rules, and audit history.** Atlassian Forge app by Asymm Systems. Status on 2026-11-08: pending Marketplace approval.

## The Data Center need it answers

On Data Center, teams use checklist apps and workflow conditions to keep issues out of Done until the checks are complete. Some of these have no cloud version, for example Kanoah Checklist for Jira (Adaptavist, Data Center and Server only, https://marketplace.atlassian.com/apps/1213102). For some cloud versions the vendor lists missing features; for example HeroCoders lists "Workflow condition" as not in its cloud edition, while its workflow validator is in both (https://docs.herocoders.com/checklist/checklist-for-jira-on-prem-vs-cloud-feature-compar). Checked 2026-11-08.

## What it does

1. **Per-issue-type checklists.** Project administrators edit a template per issue type and can re-sync open issues.
2. **Evidence on the items that need it.** An "Evidence required" item is ticked only with a link (http or https), a note, or both.
3. **Not the assignee.** Marked items cannot be ticked or waived by the current assignee, or by anyone who was the assignee after the item was opened.
4. **Waivers with reasons.** An open mandatory item can be waived with a reason of 10 to 500 characters, kept in the history.
5. **The move to Done waits.** The DefinitionGuard DoD Enforcement validator blocks a move into a Done-category status while a mandatory item is open and not waived. Gate coverage lists every transition into Done as Gated, Not gated or Exempt.
6. **A history you can check.** Hash-chained history, with a JSON export for project and Jira admins.

## Compliance mapping (supports; the auditor decides)

| Control | DefinitionGuard |
|---|---|
| SOC 2 CC8.1 | Records that testing, security review and documentation items were completed or waived before Done |
| ISO/IEC 27001:2022 A.8.29 and A.8.32 | Records that documented security and testing requirements were met before release |
| GxP and medtech quality systems | A hash-chained record of who ticked or waived each item, when and why |

## What it does not do

- A tick or a waiver is not an electronic signature (no re-authentication, no signature meaning). It does not meet 21 CFR Part 11 signature requirements on its own.
- It checks the format of an evidence link, not what the link points to.
- No workflow condition that hides a transition: it blocks with a validator, which a Jira admin adds to each transition.
- The history check does not stop someone who can rewrite all of the app's stored data, the vendor included.
- If the licence is not active, the gate is off and every move goes through.

## Data and hosting

Runs on Atlassian Forge. No external egress. Checklists and history in Forge storage for the site. Each person is stored as a random pseudonym; the account id is kept only in one link per person, reported weekly, and deleted when the account closes. Scopes: `read:jira-work`, `write:issue.property:jira`, `read:jira-user`, `storage:app`, `read:workflow:jira`, `report:personal-data`.

Isolated Cloud: planned. Government Cloud: planned.

## Price

Free for 1 to 10 users. $0.95 per user per month (11 to 100), $0.75 (101 to 250), $0.24 (251 and more).

## Links

User guide: https://asymm.systems/product/jira-governance/user-guide/definitionguard.html. Compliance mapping: https://asymm.systems/product/jira-governance/compliance.html.
