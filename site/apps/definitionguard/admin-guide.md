# DefinitionGuard Administrator Guide

This guide covers the Definition of Done templates for each issue type, evidence and reviewer
rules, the statuses the gate lets through, the workflow gate, and the approver groups.

---

## 1. Configuring DoD templates in space settings

Space (project) administrators set the Definition of Done items for each issue type:

1. In your Jira space, open **Space settings** -> **Apps** -> **DefinitionGuard**.
2. Choose an issue type in the list at the top (for example `Story`, `Bug` or `Task`).
3. Give the template a name, for example `Team DoD`.
4. Type the item title in **New item title** and click **Add item**. Repeat for each item.
5. For each item, set:
   - **Mandatory:** a mandatory item must be done or waived before the move to Done.
   - **Evidence required:** the item is ticked only with a link (http or https), a note, or both.
   - **Not the assignee:** the issue's assignee cannot tick this item, so someone else checks it.
   - The permission a user needs to tick the item, and the item's category.
   - **Move up**, **Move down** and **Remove** change the order or drop an item.
6. Under **Who else can waive**, choose which Jira permission also lets users waive and reopen
   items: Administer projects (the default), Resolve issues or Transition issues. Approvers can
   always waive.
7. Click **Save template**. New checklists for this issue type use the new version. Open issues
   keep their version until you click **Re-sync open issues**.

![Project Settings](/assets/definitionguard/04-project-settings.png)

*Figure: DefinitionGuard space settings, with the template editor and the gate coverage.*

---

## 2. Choosing the statuses the gate lets through

The gate blocks moves into Done-category statuses while mandatory items are open. Some Done
statuses are not completions, such as Canceled, Declined or Duplicate.

1. On the same **DefinitionGuard** space settings page, go to **Statuses the gate lets through**.
2. Tick each Done-category status that is not a completion.
3. Click **Save statuses**.

---

## 3. Attaching the workflow gate

DefinitionGuard blocks a move only on transitions where a Jira administrator added its rule.

1. Open **Settings (gear icon)** -> **Work items** -> **Workflows**, and edit the workflow that
   your space uses.
2. Select the transition into a Done-category status.
3. Under **Validate details**, add a rule and choose **DefinitionGuard DoD Enforcement**. The rule
   has no settings of its own.
4. Click **Update workflow**.
5. Back on the **DefinitionGuard** space settings page, **Gate coverage** shows how many
   completion transitions are gated. Click **Check again** after a workflow change.

![Transition Blocked](/assets/definitionguard/03-transition-blocked.png)

*Figure: A move into Done blocked by DefinitionGuard because mandatory items are still open.*

Jira's workflow editor shows the rule with a letter avatar ("DD"). Jira builds it from the rule
name; Forge workflow rules have no icon setting.

---

## 4. Choosing the approver groups

Approvers can waive items, reopen a waiver and reset a checklist. Jira administrators are always
approvers.

1. Open **Settings (gear icon)** -> **Apps** -> **DefinitionGuard approvers**.
2. Search for groups and add the ones that may approve (for example `engineering-leads` or
   `qa-managers`).
3. Click **Save changes**.
