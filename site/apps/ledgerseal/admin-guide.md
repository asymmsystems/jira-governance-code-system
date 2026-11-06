# LedgerSeal Administrator Guide

This guide covers configuring approver groups under the Uniform Permission Standard and attaching the workflow transition validator to Jira project workflows.

---

## 1. Configuring Approver Groups

By default, any Jira Administrator or Project Administrator can apply approval seals. To restrict sealing authority to dedicated compliance or release engineering groups:

1. In Jira Cloud, navigate to **Jira Settings (Gear Icon)** -> **Apps**.
2. In the left sidebar under **Apps**, click **LedgerSeal approvers**.
3. In the search input, search for authorized Jira user groups (e.g. `release-managers`, `compliance-officers`, `tech-leads`).
4. Select one or more groups and click **Save Policy**.

![LedgerSeal Admin Page](/assets/ledgerseal/04-admin-approvers.png)

*Figure: Configuring authorized approver groups under the Uniform Permission Standard.*

---

## 2. Attaching the Workflow Transition Validator

The LedgerSeal validator enforces that an issue cannot transition to **Done** or **Released** unless it carries an intact, verified approval seal.

### Steps to Attach Validator:
1. Navigate to **Jira Settings** -> **Issues** -> **Workflows**.
2. Locate the workflow associated with your project and click **Edit**.
3. Select the transition leading into your completion status (e.g. `In Review` -> `Done`).
4. In the transition details panel, click **Validators**.
5. Click **Add validator**.
6. Select **Require Valid LedgerSeal**.
7. Click **Add**.
8. Click **Publish Draft** to activate the validator.

> **Comments on the transition screen.** If the gated transition has a screen with a comment box, a comment typed there is new content on a sealed issue. The validator then blocks the transition with "Comment added". Add the comment after the transition, or ask another approver to approve it first.

![Transition Blocked](/assets/ledgerseal/03-transition-blocked.png)

*Figure: Transition blocked by the LedgerSeal validator when an issue is modified post-approval.*

---

## 3. Separation of Duties Enforcement

LedgerSeal enforces separation of duties automatically at the code level:
- An authorized approver **cannot seal an issue if they made the most recent ticket change**.
- If a lead edits an issue description, another authorized approver must review the change and apply the seal.
- This rule prevents an individual from bypassing change controls by editing requirements and immediately re-approving their own work.
