<!--
Copyright (c) 2026 Asymm Systems. All rights reserved.

@author Fahim Farook
-->
# Migrating regulated Jira to cloud: governance checklist

For migration leads, Jira admins and QA or compliance leads. Prepared by Asymm Systems, 2026-11-08. Most items apply whatever apps you choose. The last column says where our apps can help; leave it out if you use other apps.

## A. Find the controls you have today

| # | Check | Why | Where the suite can help |
|---|---|---|---|
| A1 | List every Jira workflow transition that a control depends on (approval, release, move to Done) | A control is often a validator or condition from an app or a script | |
| A2 | For each, name the app, script or plugin that enforces it, and the regulation it supports (SOC 2 CC8.1, ISO 27001 A.8.32, 21 CFR Part 11, SOX ITGC) | You must replace the control, not only the app | |
| A3 | Run the app assessment in the Jira Cloud Migration Assistant. Note every app with "This app is not available in cloud" and every "Choose alternative" decision | Atlassian's suggested alternatives are "not recommended by Atlassian, and are selected based on similarity in functionality" (support.atlassian.com, "Audit apps for your migration to cloud") | |
| A4 | For apps with a cloud version, read the vendor's own feature comparison. Some rows are Data Center only | A missing row can be the control you rely on | |
| A5 | List in-house Data Center plugins and scripts. They have no cloud version | Forge apps or Jira automation must replace them | |

## B. Choose the cloud target

| # | Check | Why | Where the suite can help |
|---|---|---|---|
| B1 | Choose Cloud Enterprise with data residency, Isolated Cloud or Government Cloud | Each has its own app rules | |
| B2 | Isolated Cloud: check each app is in the Isolated Cloud collection; only Forge apps are supported, egress is blocked by default | Connect and Connect-on-Forge are not supported | Our apps are Forge only with no egress. Isolated Cloud listing: planned |
| B3 | Government Cloud: apps are installed by Atlassian support; each app needs the customer's own security assessment | No self-install in production | Government Cloud: planned |
| B4 | Set the data residency region; check each app's Privacy and Security tab for data residency | App data residency is the app vendor's choice | Our apps keep data in Forge storage and Jira issue properties, under Atlassian's residency rules |

## C. Rebuild each control in cloud

| # | Check | Why | Where the suite can help |
|---|---|---|---|
| C1 | Approval: can an approved issue change before release without anyone seeing it? | The most common audit finding on change tickets | LedgerSeal seals at approval and names later changes |
| C2 | Separation of duties: can the person who changed a ticket approve it? Can the assignee tick their own review item? | SOC 2 and ISO 27001 auditors test this | LedgerSeal; DefinitionGuard's not-the-assignee rule |
| C3 | Release gate: is the release transition blocked until the control passes? Who adds the validator? | A validator does nothing until an admin adds it | LedgerSeal and DefinitionGuard validators; DefinitionGuard Gate coverage |
| C4 | Definition of Done: is evidence required, and are waivers recorded with a reason? | Honour-system checklists fail audits | DefinitionGuard |
| C5 | Electronic signatures (21 CFR 11.200, 11.300): if your predicate rules need them, which tool re-authenticates the signer? | Many approval tools do not | Not LedgerSeal: it does not meet 11.200 or 11.300 |
| C6 | Audit trail: is it computer-generated, time-stamped and tamper-evident? Can it be exported and checked? | 21 CFR 11.10(e); audit readiness | LedgerSeal and DefinitionGuard hash-chained histories; LedgerSeal offline verifier |
| C7 | Evidence per change: decision record, Definition of Done, pull request, approval | Audit sampling | FourRealities |
| C8 | Scope baseline: who accepted each change of scope? | Project governance | CascadePlan |

## D. Validate and migrate the evidence

| # | Check | Why | Where the suite can help |
|---|---|---|---|
| D1 | Decide how Data Center records stay available after 2029-03-28, when Data Center becomes read-only | Retention rules outlive the platform | |
| D2 | Check which app data migrates. "No path" means the app's data does not move to cloud | Old approvals may need an export | Our apps start in cloud; they do not import Data Center app data |
| D3 | GxP: validate the cloud system and its apps for intended use; keep the test evidence | Computerised system validation | Each listing names the app's automated tests; we provide no validation package today |
| D4 | Security review of each app: scopes, egress, data storage, vendor security policy, DPA | Procurement | Privacy policy, security policy, compliance mapping. DPA: being drafted |
| D5 | Train approvers and admins on the new controls; update the SOPs | The auditor tests the procedure, not the tool | User guides with quick starts |

## E. Dates to plan around

| Date | Event (Atlassian, https://www.atlassian.com/licensing/data-center-end-of-life) |
|---|---|
| 2026-03-30 | No new Data Center customers |
| 2028-03-30 | Existing customers can no longer buy or expand Data Center or Data Center apps |
| 2029-03-28 | Data Center products and apps become read-only |
