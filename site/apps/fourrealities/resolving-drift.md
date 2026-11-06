# Resolving missing evidence

Each check that shows "Evidence missing" has one next step in the issue panel.

## Intent: "No decision record is linked."

Click **Link decision record** and choose the Confluence page, or link an issue of a decision type (the types are set on the admin page).

## Process: "No Definition of Done record is on this issue."

Complete the items in the **Definition of Done** panel of DefinitionGuard on the issue (or the checklist of Checklists for Jira, when that is your Process source). A record that failed its signature check was changed after DefinitionGuard wrote it; change any item in DefinitionGuard so it writes its record again.

## Code: "The issue is done, but no pull request is linked."

Link the pull request through your Git integration for Jira, or click **Request Code exception** for work that needed no code. If the pull request is open, merge it.

## Audit: "The issue is not sealed in LedgerSeal."

Seal the issue in its **Approval Seal** panel of LedgerSeal. A broken seal means sealed content changed after approval; an approver reseals it in LedgerSeal.

## A check you do not use

If a check shows "Not used on this site", it is not scored and needs no action. A Jira administrator can turn it on in **Jira settings > Apps > FourRealities gate authority**.
