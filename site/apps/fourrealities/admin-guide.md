# FourRealities Admin Guide

![FourRealities gate authority](/assets/fourrealities/05-admin.png)

## 1. Install

Install FourRealities and accept its scopes: `read:jira-work`, `write:jira-work`, `storage:app`, `search:confluence`, `read:confluence-content.summary`, `read:jira-user`, `report:personal-data`. FourRealities needs no other app.

## 2. Evidence sources

Go to **Jira settings > Apps > FourRealities gate authority** (Jira administrators only). For each check choose:

- **Intent:** In use (default) or Not in use.
- **Process:** Detect (default), DefinitionGuard, Checklists for Jira (HeroCoders), or Not in use. Detect uses DefinitionGuard once a DefinitionGuard record with a verified signature has been read on the site.
- **Code:** Detect (default), In use, or Not in use. Detect uses Code once pull request data exists on the site (your GitHub, GitLab or Bitbucket integration for Jira fills the Development field).
- **Audit:** Detect (default), LedgerSeal, or Not in use. Detect uses LedgerSeal once a LedgerSeal record with a verified signature has been read.

The page shows what FourRealities has seen of each source. A check that is not in use is not scored. Records that FourRealities cannot verify (unsigned, signed with a key it does not trust, or older than one already seen) count like no record: evidence missing on a Done issue. In production FourRealities trusts the production signing keys of DefinitionGuard (`dg-prod-2026-11`) and LedgerSeal (`ls-prod-2026-11`) only, so a record from a development or staging install of those apps is not verified there. A Checklists for Jira checklist cannot be verified, so with that source Process never counts a checklist as evidence.

**Decision issue types** are the issue type names that count as a decision record for Intent (default: adr, architecture decision, decision, decision record, spec, specification, requirement).

After a change, each dashboard builds its snapshot again on its next view.

## 3. Approver groups

Code exceptions are approved, rejected or revoked by project administrators, Jira administrators, and members of the approver groups you add on the same page (at most 20). The requester and the issue's assignee can never decide.

## 4. Projects and snapshots

A project's dashboard is built the first time someone opens **Four Realities** in the project, and again every day and on **Refresh**. FourRealities reads at most 2,000 issues per project, newest first.

## 5. Data

App data stays in Forge storage. FourRealities stores account ids only where a rule needs them and no names; it reports them to Atlassian every week and erases the ids of closed accounts. When you uninstall the app, Forge removes its storage; the `fourrealities-exception` issue property, remote links and comments that users added stay in Jira.
