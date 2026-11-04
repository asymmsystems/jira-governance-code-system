# DefinitionGuard Administrator Guide

This guide covers configuring per-issue-type DoD checklist templates, setting evidence requirements, and attaching workflow transition gates.

---

## 1. Configuring DoD Templates in Project Settings

Project administrators can customize Definition of Done items for each issue type:

1. In your Jira project, navigate to **Project Settings** -> **DefinitionGuard**.
2. Select an issue type tab (e.g. `Story`, `Bug`, `Epic`).
3. Click **Add Item**.
4. Configure item properties:
   - **Title:** e.g. `Unit tests added with >80% coverage`.
   - **Requirement:** `Mandatory` (blocks Done transition) or `Optional`.
   - **Evidence Required:** Check if a valid URL or note is required.
   - **Reviewer Rule:** Set to `Non-assignee review required` to prevent self-signing.
5. Click **Save Changes**.

![Project Settings](/assets/definitionguard/04-project-settings.png)

*Figure: DefinitionGuard project settings editor for managing templates and viewing transition coverage.*

---

## 2. Attaching the Workflow Transition Gate

To enforce the checklist at the workflow level:

1. Navigate to **Jira Settings (Gear Icon)** -> **Issues** -> **Workflows**.
2. Edit the workflow associated with your project.
3. Select the transition leading into the **Done** status category.
4. Click **Validators** -> **Add validator**.
5. Choose **DefinitionGuard DoD Enforcement**.
6. (Optional) Configure exempt statuses (e.g. `Won't Fix`, `Duplicate`, `Canceled`).
7. Click **Add** and **Publish Draft**.

![Transition Blocked](/assets/definitionguard/03-transition-blocked.png)

*Figure: Transition into Done blocked by DefinitionGuard because mandatory criteria remain open.*

---

## 3. Configuring Waiver Authorities

To configure which Jira groups can grant audited waivers:
1. Navigate to **Jira Settings** -> **Apps** -> **DefinitionGuard approvers**.
2. Search for and select authorized groups (e.g. `engineering-leads`, `qa-managers`).
3. Click **Save Policy**.
