# CascadePlan Admin Guide

This guide is for Jira administrators and project leads: who can do what in CascadePlan, how to name plan approvers, and what data the app keeps.

---

## 1. Who can do what

CascadePlan uses the user's own Jira permissions. It checks them before every write, and Jira checks them again.

| Action | Needs |
| :--- | :--- |
| Open the planner and read plans and baselines | Jira **Browse projects** |
| Change a field, the dates, a due date | **Edit issues**; **Schedule issues** for dates |
| Add or remove a dependency | **Link issues** |
| Create a sub-task | **Create issues** and **Edit issues** on the parent |
| Change a parent | **Edit issues** on the moved issue |
| Change a task into a sub-task, or back | **Edit issues**, **Move issues**, **Create issues**, and the global **Make bulk changes** |
| Request approval of a scope change | Any user of the project |
| Create, rename, delete plans; freeze a baseline; make a version active; accept or reject a scope change | A **plan approver** (below) |

A plan approver is a project administrator, a Jira administrator, or a member of a group named on the CascadePlan admin page.

---

## 2. Name plan approver groups

1. In Jira, go to **Settings > Apps**, and open **CascadePlan approvers**.
2. Search for a group and add it. Save.

Members of these groups are plan approvers in every project. A scope-change request is never reviewed by the person who made it.

---

## 3. Data, retention and uninstall

- **Forge storage of your site:** each plan's row order, columns and milestones; the dates of work items not moved since the shared start date was introduced; the plan list; baselines (issue id and key, Jira estimate, start, end, done) and scope-change requests.
- **Jira issue properties:** `cascadeplan.dates` (the shared start and the planner's end) and `cascadeplan.links` (trigger percents). They belong to the issues.
- **Personal data:** the Atlassian account id of who froze a baseline, of who requested or reviewed a scope change, and of each person who works on a task through a Jira sub-task. CascadePlan reports these ids each week to Atlassian's personal data reporting service, and changes the records of a closed account to name no one. A contributor name that matches no account (for example a placeholder role) is kept as typed; no summaries or other Jira text are stored.
- **Deleting a plan** deletes its records, settings, baselines and requests.
- **Uninstall:** Atlassian keeps Forge hosted storage for 28 days after an uninstall ("Forge hosted storage retains data for 28 days after uninstallation", Forge storage documentation). CascadePlan does not remove its issue properties when it is uninstalled; they stay with the issues.
- CascadePlan makes no calls outside your Atlassian site.
